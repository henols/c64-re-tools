// Real-VICE checks: a session starts headless, and c64_window moves the
// machine into a VICE with a window and back. Each test has its own session.
// The window tests open real VICE windows on the host's desktop.

import assert from "node:assert/strict";
import { test } from "node:test";

import { ProcessSupervisor, type SpawnOptions, type SupervisedProcess } from "../../../src/native/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { WireFailure } from "../../../src/protocol/messages.ts";
import { type ViceOperation, type ViceOperations } from "../../../src/protocol/vice.ts";
import { buildD64 } from "../../fixtures/d64.ts";
import { borderLoopPrg } from "../../fixtures/prg/border-loop.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

const NOT_CARRIED = ["cpu history", "memory map", "profile", "keyboard input not yet typed"];

// $c000: SEI ; LDX #$00 ; $c003: INX ; $c004: STX $c100 ; $c007: CPX #$0a ; BNE $c003 ; $c00b: JMP $c00b
const PROGRAM = "78a200e88e00c1e00ad0f84c0bc0";

/** A supervisor that remembers each VICE it starts, so a test can see its mode and end it. */
class RecordingSupervisor extends ProcessSupervisor {
  readonly started: Array<{ argv: readonly string[]; process: SupervisedProcess; alive: boolean }> = [];

  override spawn(argv: readonly string[], options: SpawnOptions = {}): SupervisedProcess {
    const process = super.spawn(argv, options);
    const entry = { argv, process, alive: true };
    this.started.push(entry);
    void process.exited.then(() => (entry.alive = false));
    return process;
  }

  /** The VICE processes that run now, as "headless" or "window". */
  running(): Array<"headless" | "window"> {
    return this.started.filter((entry) => entry.alive).map((entry) => (entry.argv.includes("-console") ? "headless" : "window"));
  }
}

interface Live {
  session: ViceSessionHandle;
  supervisor: RecordingSupervisor;
  call<O extends ViceOperation>(op: O, params: ViceOperations[O]["params"], attachments?: Buffer[]): Promise<ViceOperations[O]["result"]>;
}

/** Runs `body` with a fresh session on real VICE, and stops every VICE afterwards. */
async function withSession(body: (live: Live) => Promise<void>): Promise<void> {
  const supervisor = new RecordingSupervisor();
  supervisor.installExitGuard();
  const session = await viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })({ videoStandard: "pal" });
  try {
    await body({ session, supervisor, call: (op, params, attachments) => session.handle(op, params, attachments) });
  } finally {
    await session.close();
    await supervisor.stopAll();
  }
  assert.deepEqual(supervisor.running(), [], "no VICE is left running");
}

/** The text screen at $0400 as rows of ASCII, from screen codes. */
async function screen(live: Live): Promise<string> {
  const bytes = Buffer.from((await live.call("memoryRead", { address: 0x0400, size: 1000, space: "c64", view: "ram" })).data, "hex");
  const rows: string[] = [];
  for (let row = 0; row < 25; row++) {
    let text = "";
    for (let column = 0; column < 40; column++) {
      const code = bytes[row * 40 + column]! & 0x7f;
      text += code === 0 ? "@" : code < 27 ? String.fromCharCode(64 + code) : code < 64 ? String.fromCharCode(code) : " ";
    }
    rows.push(text.trimEnd());
  }
  return rows.join("\n");
}

/** Polls the screen (no fixed sleep) until `pattern` shows. The machine must run. */
async function waitForScreen(live: Live, pattern: RegExp, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const text = await screen(live);
    if (pattern.test(text)) return text;
    if (Date.now() > deadline) throw new Error(`the screen did not show ${pattern}:\n${text}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Types a line of uppercase text and RETURN into the running C64. */
async function typeLine(live: Live, line: string): Promise<void> {
  await live.call("keyboard", { data: Buffer.from(`${line}\r`, "latin1").toString("hex") });
}

/** Clears the screen and loads a file from drive 8; fails with the screen when the load fails. */
async function load(live: Live, name: string): Promise<void> {
  await live.call("keyboard", { data: "93" }); // CLR
  await waitForScreen(live, /^\s*$/);
  await typeLine(live, `LOAD"${name}",8`);
  const loaded = await waitForScreen(live, /LOADING\nREADY\.|ERROR/, 60_000);
  assert.doesNotMatch(loaded, /ERROR/, `${name} did not load:\n${loaded}`);
}

/** Lists the disk in drive 8 and returns the listing. */
async function directory(live: Live): Promise<string> {
  await load(live, "$");
  await typeLine(live, "LIST");
  return waitForScreen(live, /BLOCKS FREE\.\nREADY\./, 30_000);
}

/** The whole 64 KiB of RAM, read in the largest allowed chunks. */
async function allRam(live: Live): Promise<string> {
  let hex = "";
  for (let address = 0; address < 0x10000; address += 4096) {
    hex += (await live.call("memoryRead", { address, size: 4096, space: "c64", view: "ram" })).data;
  }
  return hex;
}

/** Polls (no fixed sleep) until the machine has stopped; returns its pc. */
async function stopped(live: Live, timeoutMs = 20_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = await live.call("status", {});
    if (status.state === "stopped") return status.pc!;
    if (Date.now() > deadline) throw new Error("the machine did not stop");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function startProgram(live: Live): Promise<void> {
  await live.call("execution", { action: "pause", space: "c64" });
  await live.call("memoryWrite", { address: 0xc000, data: PROGRAM, space: "c64", view: "cpu" });
  await live.call("memoryWrite", { address: 0xc100, data: "00", space: "c64", view: "cpu" });
  await live.call("registersSet", { space: "c64", values: { pc: 0xc000 } });
}

const failsWith = (code: string, message?: RegExp) => (error: unknown) =>
  error instanceof WireFailure && error.code === code && (message === undefined || message.test(error.message));

test("a session starts headless; open and close move RAM, registers, the screen and the stopwatch exactly", { skip: liveSkip, timeout: 240_000 }, async () => {
  await withSession(async (live) => {
    assert.deepEqual(live.supervisor.running(), ["headless"]);
    assert.ok(live.supervisor.started[0]!.argv.includes("-sounddev"), "a headless VICE plays no sound");
    assert.equal((await live.call("status", {})).window, false);
    await waitForScreen(live, /READY\./);

    await startProgram(live);
    await live.call("registersSet", { space: "c64", values: { a: 0x42, x: 0x17, y: 0x99 } });
    await live.call("execution", { action: "advance-frames", count: 1, space: "c64" });
    await live.call("screenCapture", { baseline: "headless" });
    const registers = await live.call("registersGet", { space: "c64" });
    const ram = await allRam(live);
    await live.call("timing", { action: "start" });

    assert.deepEqual(await live.call("window", { action: "open" }), { window: true, state: "stopped", notCarried: NOT_CARRIED });
    assert.deepEqual(live.supervisor.running(), ["window"], "only the window VICE runs");
    const status = await live.call("status", {});
    assert.deepEqual([status.window, status.state, status.pc], [true, "stopped", registers.pc]);
    assert.deepEqual(await live.call("registersGet", { space: "c64" }), registers);
    assert.equal(await allRam(live), ram, "all 64 KiB of RAM are the same");
    const cycles = BigInt((await live.call("timing", { action: "read" }) as { cycles: string }).cycles);
    assert.ok(cycles < 100n, `the stopwatch goes on from where it was, not from the new VICE's start (${cycles})`);
    // A fresh VICE has drawn no frame yet; after one frame the screen is the same as before.
    await live.call("execution", { action: "advance-frames", count: 1, space: "c64" });
    const inWindow = await live.call("screenCompare", { baseline: "headless", maxMismatchRatio: 0, mask: [], includeDiff: false });
    assert.equal(inWindow.match, true, `the window VICE draws the same screen (${inWindow.mismatchingPixels} pixels differ)`);

    const ramInWindow = await allRam(live);
    const registersInWindow = await live.call("registersGet", { space: "c64" });
    assert.deepEqual(await live.call("window", { action: "close" }), { window: false, state: "stopped", notCarried: NOT_CARRIED });
    assert.deepEqual(live.supervisor.running(), ["headless"]);
    assert.equal((await live.call("status", {})).window, false);
    assert.deepEqual(await live.call("registersGet", { space: "c64" }), registersInWindow);
    assert.equal(await allRam(live), ramInWindow);
    await live.call("execution", { action: "advance-frames", count: 1, space: "c64" });
    const back = await live.call("screenCompare", { baseline: "headless", maxMismatchRatio: 0, mask: [], includeDiff: false });
    assert.equal(back.match, true, `the headless VICE draws the same screen again (${back.mismatchingPixels} pixels differ)`);
  });
});

test("a running machine runs on after each move, with warp and the joystick kept", { skip: liveSkip, timeout: 240_000 }, async () => {
  await withSession(async (live) => {
    await waitForScreen(live, /READY\./);
    await live.call("warp", { enabled: true });
    await live.call("joystick", { port: 2, direction: "up", fire: true });
    // CIA 1 port A holds joystick 2: bit 0 up and bit 4 fire read 0 when pressed.
    const port = async () => Number.parseInt((await live.call("memoryRead", { address: 0xdc00, size: 1, space: "c64", view: "cpu" })).data, 16);
    assert.equal((await port()) & 0x11, 0x00);
    for (const action of ["open", "close"] as const) {
      const moved = await live.call("window", { action });
      assert.deepEqual(moved, { window: action === "open", state: "running", notCarried: NOT_CARRIED });
      const status = await live.call("status", {});
      assert.deepEqual([status.state, status.warp, status.window], ["running", true, action === "open"]);
      assert.equal((await port()) & 0x11, 0x00, `joystick 2 is still held after ${action}`);
      // The machine really runs: the jiffy clock at $a2 moves.
      const jiffy = async () => (await live.call("memoryRead", { address: 0x00a2, size: 1, space: "c64", view: "ram" })).data;
      const before = await jiffy();
      const deadline = Date.now() + 5_000;
      while ((await jiffy()) === before) {
        assert.ok(Date.now() < deadline, `the C64 runs after ${action}: the jiffy clock stays at ${before}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  });
});

test("breakpoints, watchpoints and their conditions act in each VICE, with the same ids", { skip: liveSkip, timeout: 240_000 }, async () => {
  await withSession(async (live) => {
    await waitForScreen(live, /READY\./);
    await startProgram(live);
    const breakpoint = await live.call("breakpoint", {
      action: "add",
      address: 0xc003,
      space: "c64",
      condition: { kind: "register", register: "x", operator: "eq", value: 5 },
    });
    const watchpoint = await live.call("watchpoint", { action: "add", address: 0xc100, size: 1, access: "write", space: "c64" });
    const watchId = (watchpoint as { id: number }).id;
    await live.call("watchpoint", { action: "disable", id: watchId });
    const before = { breakpoints: await live.call("breakpoint", { action: "list" }), watchpoints: await live.call("watchpoint", { action: "list" }) };

    await live.call("window", { action: "open" });
    assert.deepEqual({ breakpoints: await live.call("breakpoint", { action: "list" }), watchpoints: await live.call("watchpoint", { action: "list" }) }, before);
    await live.call("execution", { action: "resume", space: "c64" });
    assert.equal(await stopped(live), 0xc003, "the conditional breakpoint stops in the window VICE");
    assert.equal((await live.call("registersGet", { space: "c64" })).x, 5, "only when its condition holds");
    // The disabled watchpoint did not stop the stores of x = 1 to 5; now enable it.
    assert.equal((await live.call("memoryRead", { address: 0xc100, size: 1, space: "c64", view: "ram" })).data, "05");
    await live.call("breakpoint", { action: "remove", id: (breakpoint as { id: number }).id });
    await live.call("watchpoint", { action: "enable", id: watchId });
    await live.call("execution", { action: "resume", space: "c64" });
    await stopped(live);
    assert.equal((await live.call("memoryRead", { address: 0xc100, size: 1, space: "c64", view: "ram" })).data, "06", "the watchpoint stops at the next store");

    await live.call("window", { action: "close" });
    assert.deepEqual(await live.call("breakpoint", { action: "list" }), { breakpoints: [] });
    await live.call("watchpoint", { action: "disable", id: watchId });
    await live.call("breakpoint", {
      action: "add",
      address: 0xc003,
      space: "c64",
      condition: { kind: "register", register: "x", operator: "eq", value: 8 },
    });
    await live.call("execution", { action: "resume", space: "c64" });
    assert.equal(await stopped(live), 0xc003, "a condition set after the moves works headless");
    assert.equal((await live.call("registersGet", { space: "c64" })).x, 8);
  });
});

test("the disk in drive 8 and what is written to it move into the window and back", { skip: liveSkip, timeout: 420_000 }, async () => {
  await withSession(async (live) => {
    await waitForScreen(live, /READY\./);
    await live.call("warp", { enabled: true });
    const image = buildD64([{ name: "ALPHA", bytes: borderLoopPrg }, { name: "BETA", bytes: borderLoopPrg }], "MOVEDISK");
    await live.call("diskAttach", { type: "d64" }, [image]);
    const headless = await directory(live);
    assert.match(headless, /"MOVEDISK/);
    assert.match(headless, /"ALPHA"/);
    assert.match(headless, /"BETA"/);

    await live.call("window", { action: "open" });
    const inWindow = await directory(live);
    assert.match(inWindow, /"ALPHA"/, `the window VICE reads the disk:\n${inWindow}`);
    assert.match(inWindow, /"BETA"/);
    await typeLine(live, "NEW");
    await typeLine(live, "10 REM MOVED");
    await typeLine(live, 'SAVE"GAMMA",8');
    await waitForScreen(live, /SAVING GAMMA\n(?:.*\n)*READY\./, 60_000);
    assert.match(await directory(live), /"GAMMA"/, "the save landed on the disk in the window VICE");

    await live.call("window", { action: "close" });
    const back = await directory(live);
    assert.match(back, /"ALPHA"/);
    assert.match(back, /"GAMMA"/, `what was saved in the window is on the disk headless:\n${back}`);
    await load(live, "GAMMA");
    await typeLine(live, "LIST");
    assert.match(await waitForScreen(live, /REM MOVED/), /10 REM MOVED/, "the saved program loads back");
  });
});

test("the window VICE ends by itself: the session goes back headless from the open state, once with a notice", { skip: liveSkip, timeout: 240_000 }, async () => {
  await withSession(async (live) => {
    await waitForScreen(live, /READY\./);
    await live.call("execution", { action: "pause", space: "c64" });
    await live.call("memoryWrite", { address: 0xc200, data: "11", space: "c64", view: "cpu" });
    await live.call("window", { action: "open" });
    await live.call("memoryWrite", { address: 0xc200, data: "22", space: "c64", view: "cpu" });
    const point = await live.call("breakpoint", { action: "add", address: 0xc300, space: "c64" });
    // The closest generic stand-in for a user who closes the window: VICE is told to end.
    const windowed = live.supervisor.started.find((entry) => entry.alive && !entry.argv.includes("-console"))!;
    windowed.process.child.kill("SIGTERM");

    const deadline = Date.now() + 60_000;
    let notice: unknown;
    for (;;) {
      try {
        await live.call("status", {});
      } catch (error) {
        if (failsWith("machine-unavailable", /window closed/i)(error) && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }
        notice = error;
        break;
      }
      if (Date.now() > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(failsWith("machine-state-lost", /window closed before c64_window close/i)(notice), String(notice));
    const status = await live.call("status", {});
    assert.deepEqual([status.window, status.state], [false, "stopped"]);
    assert.deepEqual(live.supervisor.running(), ["headless"]);
    assert.equal((await live.call("memoryRead", { address: 0xc200, size: 1, space: "c64", view: "ram" })).data, "11", "the state of when the window opened");
    assert.deepEqual(await live.call("breakpoint", { action: "list" }), { breakpoints: [point] });
    // The session works on, and a window opens again.
    await live.call("window", { action: "open" });
    assert.deepEqual(live.supervisor.running(), ["window"]);
  });
});

test("a request for the mode the session is in starts no VICE and changes nothing", { skip: liveSkip, timeout: 120_000 }, async () => {
  await withSession(async (live) => {
    await waitForScreen(live, /READY\./);
    assert.deepEqual(await live.call("window", { action: "close" }), { window: false, state: "running", notCarried: [] });
    assert.equal(live.supervisor.started.length, 1);
    await live.call("window", { action: "open" });
    assert.deepEqual(await live.call("window", { action: "open" }), { window: true, state: "running", notCarried: [] });
    assert.equal(live.supervisor.started.length, 2, "only the real move started a VICE");
  });
});
