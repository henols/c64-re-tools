// Real-VICE checks: a session starts headless, and c64_window moves the
// machine into a VICE with a window and back. Each test has its own session.
// The window tests open real VICE windows on the host's desktop, so they
// also need C64RT_LIVE_WINDOW=1.

import assert from "node:assert/strict";
import { test } from "node:test";

import { failsWith } from "../../../src/errors.testkit.ts";
import { ProcessSupervisor, type SpawnOptions, type SupervisedProcess } from "../../../src/native/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { buildD64 } from "../../fixtures/d64.ts";
import { borderLoopPrg } from "../../fixtures/prg/border-loop.ts";
import { waitFor } from "../../kit.ts";
import { liveWindowSkip, openLiveSession, screenOf, waitForStop } from "./live.ts";

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

/** Runs `body` with a fresh session on real VICE, and stops every VICE afterwards. */
async function withSession(body: (live: { session: ViceSessionHandle; supervisor: RecordingSupervisor }) => Promise<void>): Promise<void> {
  const supervisor = new RecordingSupervisor();
  const session = await openLiveSession({ supervisor });
  try {
    await body({ session, supervisor });
  } finally {
    await session.close();
    await supervisor.stopAll();
  }
  assert.deepEqual(supervisor.running(), [], "no VICE is left running");
}

/** Polls the screen (no fixed sleep) until `pattern` shows. The machine must run. */
async function waitForScreen(session: ViceSessionHandle, pattern: RegExp, timeoutMs = 30_000): Promise<string> {
  let text = "";
  await waitFor(async () => pattern.test((text = await screenOf(session))), `the screen with ${pattern}`, timeoutMs).catch((error: Error) => {
    throw new Error(`${error.message}. The screen:\n${text}`);
  });
  return text;
}

/** Types a line of uppercase text and RETURN into the running C64. */
async function typeLine(session: ViceSessionHandle, line: string): Promise<void> {
  await session.handle("keyboard", { data: Buffer.from(`${line}\r`, "latin1").toString("hex") });
}

/** Clears the screen and loads a file from drive 8; fails with the screen when the load fails. */
async function load(session: ViceSessionHandle, name: string): Promise<void> {
  await session.handle("keyboard", { data: "93" }); // CLR
  await waitForScreen(session, /^\s*$/);
  await typeLine(session, `LOAD"${name}",8`);
  const loaded = await waitForScreen(session, /LOADING\nREADY\.|ERROR/, 60_000);
  assert.doesNotMatch(loaded, /ERROR/, `${name} did not load:\n${loaded}`);
}

/** Lists the disk in drive 8 and returns the listing. */
async function directory(session: ViceSessionHandle): Promise<string> {
  await load(session, "$");
  await typeLine(session, "LIST");
  return waitForScreen(session, /BLOCKS FREE\.\nREADY\./, 30_000);
}

/** The whole 64 KiB of RAM, read in the largest allowed chunks. */
async function allRam(session: ViceSessionHandle): Promise<string> {
  let hex = "";
  for (let address = 0; address < 0x10000; address += 4096) {
    hex += (await session.handle("memoryRead", { address, size: 4096, space: "c64", view: "ram" })).data;
  }
  return hex;
}

async function startProgram(session: ViceSessionHandle): Promise<void> {
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xc000, data: PROGRAM, space: "c64", view: "cpu" });
  await session.handle("memoryWrite", { address: 0xc100, data: "00", space: "c64", view: "cpu" });
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc000 } });
}

test("a session starts headless; open and close move RAM, registers, the screen and the stopwatch exactly", { skip: liveWindowSkip, timeout: 240_000 }, async () => {
  await withSession(async ({ session, supervisor }) => {
    assert.deepEqual(supervisor.running(), ["headless"]);
    assert.ok(supervisor.started[0]!.argv.includes("-sounddev"), "a headless VICE plays no sound");
    assert.equal((await session.handle("status", {})).window, false);
    await waitForScreen(session, /READY\./);

    await startProgram(session);
    await session.handle("registersSet", { space: "c64", values: { a: 0x42, x: 0x17, y: 0x99 } });
    await session.handle("execution", { action: "advance-frames", count: 1, space: "c64" });
    await session.handle("screenCapture", { baseline: "headless" });
    const registers = await session.handle("registersGet", { space: "c64" });
    const ram = await allRam(session);
    await session.handle("timing", { action: "start" });

    assert.deepEqual(await session.handle("window", { action: "open" }), { window: true, state: "stopped", notCarried: NOT_CARRIED });
    assert.deepEqual(supervisor.running(), ["window"], "only the window VICE runs");
    const status = await session.handle("status", {});
    assert.deepEqual([status.window, status.state, status.pc], [true, "stopped", registers.pc]);
    assert.deepEqual(await session.handle("registersGet", { space: "c64" }), registers);
    assert.equal(await allRam(session), ram, "all 64 KiB of RAM are the same");
    const cycles = BigInt((await session.handle("timing", { action: "read" }) as { cycles: string }).cycles);
    assert.ok(cycles < 100n, `the stopwatch goes on from where it was, not from the new VICE's start (${cycles})`);
    // A fresh VICE has drawn no frame yet; after one frame the screen is the same as before.
    await session.handle("execution", { action: "advance-frames", count: 1, space: "c64" });
    const inWindow = await session.handle("screenCompare", { baseline: "headless", maxMismatchRatio: 0, mask: [], includeDiff: false });
    assert.equal(inWindow.match, true, `the window VICE draws the same screen (${inWindow.mismatchingPixels} pixels differ)`);

    const ramInWindow = await allRam(session);
    const registersInWindow = await session.handle("registersGet", { space: "c64" });
    assert.deepEqual(await session.handle("window", { action: "close" }), { window: false, state: "stopped", notCarried: NOT_CARRIED });
    assert.deepEqual(supervisor.running(), ["headless"]);
    assert.equal((await session.handle("status", {})).window, false);
    assert.deepEqual(await session.handle("registersGet", { space: "c64" }), registersInWindow);
    assert.equal(await allRam(session), ramInWindow);
    await session.handle("execution", { action: "advance-frames", count: 1, space: "c64" });
    const back = await session.handle("screenCompare", { baseline: "headless", maxMismatchRatio: 0, mask: [], includeDiff: false });
    assert.equal(back.match, true, `the headless VICE draws the same screen again (${back.mismatchingPixels} pixels differ)`);
  });
});

test("a running machine runs on after each move, with warp and the joystick kept", { skip: liveWindowSkip, timeout: 240_000 }, async () => {
  await withSession(async ({ session }) => {
    await waitForScreen(session, /READY\./);
    await session.handle("warp", { enabled: true });
    await session.handle("joystick", { port: 2, direction: "up", fire: true });
    // CIA 1 port A holds joystick 2: bit 0 up and bit 4 fire read 0 when pressed.
    const port = async () => Number.parseInt((await session.handle("memoryRead", { address: 0xdc00, size: 1, space: "c64", view: "cpu" })).data, 16);
    assert.equal((await port()) & 0x11, 0x00);
    for (const action of ["open", "close"] as const) {
      const moved = await session.handle("window", { action });
      assert.deepEqual(moved, { window: action === "open", state: "running", notCarried: NOT_CARRIED });
      const status = await session.handle("status", {});
      assert.deepEqual([status.state, status.warp, status.window], ["running", true, action === "open"]);
      assert.equal((await port()) & 0x11, 0x00, `joystick 2 is still held after ${action}`);
      // The machine really runs: the jiffy clock at $a2 moves.
      const jiffy = async () => (await session.handle("memoryRead", { address: 0x00a2, size: 1, space: "c64", view: "ram" })).data;
      const before = await jiffy();
      await waitFor(async () => (await jiffy()) !== before, `the C64 runs after ${action}: the jiffy clock moves from ${before}`, 5_000);
    }
  });
});

test("breakpoints, watchpoints and their conditions act in each VICE, with the same ids", { skip: liveWindowSkip, timeout: 240_000 }, async () => {
  await withSession(async ({ session }) => {
    await waitForScreen(session, /READY\./);
    await startProgram(session);
    const breakpoint = await session.handle("breakpoint", {
      action: "add",
      address: 0xc003,
      space: "c64",
      condition: { kind: "register", register: "x", operator: "eq", value: 5 },
    });
    const watchpoint = await session.handle("watchpoint", { action: "add", address: 0xc100, size: 1, access: "write", space: "c64" });
    const watchId = (watchpoint as { id: number }).id;
    await session.handle("watchpoint", { action: "disable", id: watchId });
    const before = { breakpoints: await session.handle("breakpoint", { action: "list" }), watchpoints: await session.handle("watchpoint", { action: "list" }) };

    await session.handle("window", { action: "open" });
    assert.deepEqual({ breakpoints: await session.handle("breakpoint", { action: "list" }), watchpoints: await session.handle("watchpoint", { action: "list" }) }, before);
    await session.handle("execution", { action: "resume", space: "c64" });
    assert.equal(await waitForStop(session, 20_000), 0xc003, "the conditional breakpoint stops in the window VICE");
    assert.equal((await session.handle("registersGet", { space: "c64" })).x, 5, "only when its condition holds");
    // The disabled watchpoint did not stop the stores of x = 1 to 5; now enable it.
    assert.equal((await session.handle("memoryRead", { address: 0xc100, size: 1, space: "c64", view: "ram" })).data, "05");
    await session.handle("breakpoint", { action: "remove", id: (breakpoint as { id: number }).id });
    await session.handle("watchpoint", { action: "enable", id: watchId });
    await session.handle("execution", { action: "resume", space: "c64" });
    await waitForStop(session, 20_000);
    assert.equal((await session.handle("memoryRead", { address: 0xc100, size: 1, space: "c64", view: "ram" })).data, "06", "the watchpoint stops at the next store");

    await session.handle("window", { action: "close" });
    assert.deepEqual(await session.handle("breakpoint", { action: "list" }), { breakpoints: [] });
    await session.handle("watchpoint", { action: "disable", id: watchId });
    await session.handle("breakpoint", {
      action: "add",
      address: 0xc003,
      space: "c64",
      condition: { kind: "register", register: "x", operator: "eq", value: 8 },
    });
    await session.handle("execution", { action: "resume", space: "c64" });
    assert.equal(await waitForStop(session, 20_000), 0xc003, "a condition set after the moves works headless");
    assert.equal((await session.handle("registersGet", { space: "c64" })).x, 8);
  });
});

test("the disk in drive 8 and what is written to it move into the window and back", { skip: liveWindowSkip, timeout: 420_000 }, async () => {
  await withSession(async ({ session }) => {
    await waitForScreen(session, /READY\./);
    await session.handle("warp", { enabled: true });
    const image = buildD64([{ name: "ALPHA", bytes: borderLoopPrg }, { name: "BETA", bytes: borderLoopPrg }], "MOVEDISK");
    await session.handle("diskAttach", { type: "d64" }, [image]);
    const headless = await directory(session);
    assert.match(headless, /"MOVEDISK/);
    assert.match(headless, /"ALPHA"/);
    assert.match(headless, /"BETA"/);

    await session.handle("window", { action: "open" });
    const inWindow = await directory(session);
    assert.match(inWindow, /"ALPHA"/, `the window VICE reads the disk:\n${inWindow}`);
    assert.match(inWindow, /"BETA"/);
    await typeLine(session, "NEW");
    await typeLine(session, "10 REM MOVED");
    await typeLine(session, 'SAVE"GAMMA",8');
    await waitForScreen(session, /SAVING GAMMA\n(?:.*\n)*READY\./, 60_000);
    assert.match(await directory(session), /"GAMMA"/, "the save landed on the disk in the window VICE");

    await session.handle("window", { action: "close" });
    const back = await directory(session);
    assert.match(back, /"ALPHA"/);
    assert.match(back, /"GAMMA"/, `what was saved in the window is on the disk headless:\n${back}`);
    await load(session, "GAMMA");
    await typeLine(session, "LIST");
    assert.match(await waitForScreen(session, /REM MOVED/), /10 REM MOVED/, "the saved program loads back");
  });
});

test("the window VICE ends by itself: the session goes back headless from the open state, once with a notice", { skip: liveWindowSkip, timeout: 240_000 }, async () => {
  await withSession(async ({ session, supervisor }) => {
    await waitForScreen(session, /READY\./);
    await session.handle("execution", { action: "pause", space: "c64" });
    await session.handle("memoryWrite", { address: 0xc200, data: "11", space: "c64", view: "cpu" });
    await session.handle("window", { action: "open" });
    await session.handle("memoryWrite", { address: 0xc200, data: "22", space: "c64", view: "cpu" });
    const point = await session.handle("breakpoint", { action: "add", address: 0xc300, space: "c64" });
    // The closest generic stand-in for a user who closes the window: VICE is told to end.
    const windowed = supervisor.started.find((entry) => entry.alive && !entry.argv.includes("-console"))!;
    windowed.process.child.kill("SIGTERM");

    let notice: unknown;
    const noticed = async () => {
      try {
        await session.handle("status", {});
        return false;
      } catch (error) {
        notice = error;
        return !failsWith("machine-unavailable", /window closed/i)(error);
      }
    };
    await waitFor(noticed, "a notice other than that the window is closed", 60_000);
    assert.ok(failsWith("machine-state-lost", /window closed before c64_window close/i)(notice), String(notice));
    const status = await session.handle("status", {});
    assert.deepEqual([status.window, status.state], [false, "stopped"]);
    assert.deepEqual(supervisor.running(), ["headless"]);
    assert.equal((await session.handle("memoryRead", { address: 0xc200, size: 1, space: "c64", view: "ram" })).data, "11", "the state of when the window opened");
    assert.deepEqual(await session.handle("breakpoint", { action: "list" }), { breakpoints: [point] });
    // The session works on, and a window opens again.
    await session.handle("window", { action: "open" });
    assert.deepEqual(supervisor.running(), ["window"]);
  });
});

test("a request for the mode the session is in starts no VICE and changes nothing", { skip: liveWindowSkip, timeout: 120_000 }, async () => {
  await withSession(async ({ session, supervisor }) => {
    await waitForScreen(session, /READY\./);
    assert.deepEqual(await session.handle("window", { action: "close" }), { window: false, state: "running", notCarried: [] });
    assert.equal(supervisor.started.length, 1);
    await session.handle("window", { action: "open" });
    assert.deepEqual(await session.handle("window", { action: "open" }), { window: true, state: "running", notCarried: [] });
    assert.equal(supervisor.started.length, 2, "only the real move started a VICE");
  });
});
