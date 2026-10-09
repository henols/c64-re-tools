// The window move: the session moves the machine between a headless VICE
// and one with a window, and back, through a snapshot and a new VICE.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { WireFailure } from "../../protocol/messages.ts";
import { FakeVice } from "./fake-vice.testkit.ts";
import type { ViceMode, ViceProcess } from "./process.ts";
import { ViceSession, type ViceLauncher } from "./session.ts";

type FakeProcess = Awaited<ReturnType<FakeVice["start"]>>;

const fakes: FakeVice[] = [];
const processes: FakeProcess[] = [];
after(async () => {
  await Promise.all(processes.map((process) => process.stop()));
  for (const fake of fakes) fake.close();
});

const NOT_CARRIED = ["cpu history", "memory map", "profile", "keyboard input not yet typed"];

const failsWith = (code: string, message?: RegExp) => (error: unknown) =>
  error instanceof WireFailure && error.code === code && (message === undefined || message.test(error.message));

async function launchFake(mode: ViceMode, configure?: (fake: FakeVice, mode: ViceMode) => void): Promise<{ fake: FakeVice; process: FakeProcess }> {
  const fake = new FakeVice();
  fake.mode = mode;
  configure?.(fake, mode);
  fakes.push(fake);
  const process = await fake.start();
  processes.push(process);
  return { fake, process };
}

/**
 * A session on a headless fake, with a launcher that starts more fakes.
 * `vices` lists every fake in start order; `current()` is the last one started.
 */
async function startWindowSession(
  options: {
    refuse?: (mode: ViceMode, log: (line: string) => void) => void;
    configure?: (fake: FakeVice, mode: ViceMode) => void;
    gate?: Promise<void>;
    onLaunch?: () => void;
  } = {},
) {
  const vices: Array<{ fake: FakeVice; process: FakeProcess }> = [await launchFake("headless")];
  const launch: ViceLauncher = async (mode, log) => {
    options.onLaunch?.();
    await options.gate;
    options.refuse?.(mode, log);
    const started = await launchFake(mode, options.configure);
    vices.push(started);
    return started.process as ViceProcess;
  };
  const session = await ViceSession.start(vices[0]!.process, "pal", () => {}, { launch });
  return { session, vices, current: () => vices.at(-1)!.fake };
}

/** Calls status until the session takes commands again after the window closed by itself; returns the one-time notice. */
async function noticeAfterWindowClosed(session: ViceSession): Promise<unknown> {
  const deadline = Date.now() + 3000;
  for (;;) {
    try {
      await session.handle("status", {});
    } catch (error) {
      if (failsWith("machine-unavailable", /window closed/i)(error) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        continue;
      }
      return error;
    }
    if (Date.now() > deadline) throw new Error("no notice came");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("opening the window moves memory, registers, points, joysticks, warp and the stopwatch into a windowed VICE", async () => {
  const { session, vices, current } = await startWindowSession();
  const headless = vices[0]!.fake;
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xc000, data: "deadbeef", space: "c64", view: "cpu" });
  await session.handle("registersSet", { space: "c64", values: { pc: 0x2100 } });
  const breakpoint = await session.handle("breakpoint", {
    action: "add",
    address: 0x2200,
    space: "c64",
    condition: { kind: "register", register: "a", operator: "eq", value: 66 },
  });
  const watchpoint = await session.handle("watchpoint", { action: "add", address: 0xd020, size: 1, access: "write", space: "c64" });
  await session.handle("watchpoint", { action: "disable", id: (watchpoint as { id: number }).id });
  await session.handle("joystick", { port: 2, direction: "up", fire: true });
  await session.handle("warp", { enabled: true });
  await session.handle("timing", { action: "start" });
  headless.clock += 500n;

  assert.deepEqual(await session.handle("window", { action: "open" }), { window: true, state: "stopped", notCarried: NOT_CARRIED });

  const windowed = current();
  assert.equal(vices.length, 2);
  assert.equal(windowed.mode, "window");
  assert.equal(vices[0]!.process.stopCount, 1, "the headless VICE is stopped after the move");
  assert.equal(windowed.ram.subarray(0xc000, 0xc004).toString("hex"), "deadbeef");
  assert.equal(windowed.registers.PC, 0x2100);
  const points = [...windowed.checkpoints.values()];
  assert.equal(points.length, 2);
  const exec = points.find((point) => point.operation === 0x04)!;
  assert.deepEqual([exec.start, exec.end, exec.enabled, exec.condition], [0x2200, 0x2200, true, "(A == $42)"]);
  const store = points.find((point) => point.operation === 0x02)!;
  assert.deepEqual([store.start, store.end, store.enabled], [0xd020, 0xd020, false]);
  assert.deepEqual(windowed.joyport, headless.joyport);
  assert.equal(windowed.warp, true);
  assert.equal(windowed.profilerOn, true);
  assert.equal(windowed.running, false, "a stopped machine stays stopped");

  // The ids the agent knows still work, against the new VICE.
  assert.deepEqual(await session.handle("breakpoint", { action: "list" }), { breakpoints: [breakpoint] });
  await session.handle("breakpoint", { action: "disable", id: (breakpoint as { id: number }).id });
  assert.equal(exec.enabled, false);
  // The stopwatch goes on from where it was.
  assert.deepEqual(await session.handle("timing", { action: "read" }), { cycles: "500" });
  windowed.clock += 100n;
  assert.deepEqual(await session.handle("timing", { action: "read" }), { cycles: "600" });
  assert.equal((await session.handle("status", {})).window, true);
  await session.close();
});

test("a running machine runs again after each move, and close moves it back headless", async () => {
  const { session, vices, current } = await startWindowSession();
  assert.deepEqual(await session.handle("window", { action: "open" }), { window: true, state: "running", notCarried: NOT_CARRIED });
  assert.equal(current().running, true);
  assert.deepEqual(await session.handle("window", { action: "close" }), { window: false, state: "running", notCarried: NOT_CARRIED });
  assert.equal(current().mode, "headless");
  assert.equal(current().running, true);
  assert.equal(vices.length, 3);
  assert.equal(vices[1]!.process.stopCount, 1, "the window VICE is stopped after close");
  const status = await session.handle("status", {});
  assert.equal(status.window, false);
  assert.equal(status.state, "running");
  await session.close();
});

test("a request for the mode the session is in succeeds and sends VICE nothing", async () => {
  const { session, vices, current } = await startWindowSession();
  vices[0]!.fake.commands.length = 0;
  vices[0]!.fake.textCommands.length = 0;
  assert.deepEqual(await session.handle("window", { action: "close" }), { window: false, state: "running", notCarried: [] });
  assert.deepEqual([vices[0]!.fake.commands, vices[0]!.fake.textCommands], [[], []], "no monitor command for a headless close");
  await session.handle("window", { action: "open" });
  current().commands.length = 0;
  current().textCommands.length = 0;
  assert.deepEqual(await session.handle("window", { action: "open" }), { window: true, state: "running", notCarried: [] });
  assert.deepEqual([current().commands, current().textCommands], [[], []], "no monitor command for an open window");
  assert.equal(vices.length, 2, "no VICE was started");
  await session.close();
});

test("while the window VICE is paused by the user, open still succeeds and close is refused with the cause", async () => {
  const { session, vices, current } = await startWindowSession();
  await session.handle("window", { action: "open" });
  const windowed = current();
  // Short limits, so the paused VICE is noticed at once.
  vices[1]!.process.monitor.defaultTimeoutMs = 100;
  vices[1]!.process.text.defaultTimeoutMs = 100;
  windowed.pauseUi();
  await assert.rejects(session.handle("registersGet", { space: "c64" }), failsWith("machine-unavailable", /paused in its window/));
  const sent = windowed.commands.length;
  assert.deepEqual(await session.handle("window", { action: "open" }), { window: true, state: "running", notCarried: [] });
  await assert.rejects(session.handle("window", { action: "close" }), failsWith("machine-unavailable", /paused in its window/));
  assert.equal(windowed.commands.length, sent, "nothing is sent to the paused VICE");
  windowed.resumeUi();
  await session.close();
});

test("the disk in drive 8 moves through the snapshot; the image is never attached again", async () => {
  const { session, current } = await startWindowSession();
  const image = Buffer.alloc(174848, 0x5a);
  await session.handle("diskAttach", { type: "d64" }, [image]);
  await session.handle("window", { action: "open" });
  assert.deepEqual(current().attached, [image], "the restored drive holds the disk");
  assert.ok(!current().textCommands.some((command) => command.startsWith("attach")), "no attach on top of the restore");
  await session.handle("window", { action: "close" });
  assert.deepEqual(current().attached, [image]);
  await session.close();
});

test("named snapshots and screen baselines outlive the VICE that made them", async () => {
  const { session, current } = await startWindowSession();
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0x4000, data: "11", space: "c64", view: "cpu" });
  await session.handle("snapshot", { action: "save", name: "before" });
  await session.handle("screenCapture", { baseline: "start" });
  await session.handle("window", { action: "open" });
  await session.handle("memoryWrite", { address: 0x4000, data: "22", space: "c64", view: "cpu" });
  assert.deepEqual(await session.handle("snapshot", { action: "restore", name: "before" }), { restored: true, state: "stopped" });
  assert.equal(current().ram[0x4000], 0x11);
  assert.deepEqual(await session.handle("screenBaselines", {}), { baselines: ["start"] });
  await session.close();
});

test("a window VICE that does not start leaves the headless one current, and says why", async () => {
  const { session, vices } = await startWindowSession({
    refuse: (mode, log) => {
      if (mode !== "window") return;
      log("VICE failed to start: The emulator exited while it was starting.\nError - Cannot open the display.");
      throw new WireFailure("machine-unavailable", "The emulator could not be started on the host.");
    },
  });
  await session.handle("breakpoint", { action: "add", address: 0x2100, space: "c64" });
  await assert.rejects(session.handle("window", { action: "open" }), (error: unknown) => {
    assert.ok(failsWith("machine-unavailable")(error), String(error));
    assert.match((error as Error).message, /VICE with a window/);
    assert.match((error as Error).message, /Error - Cannot open the display\./);
    assert.match((error as Error).message, /stays headless/);
    return true;
  });
  assert.equal(vices.length, 1);
  assert.equal(vices[0]!.process.stopCount, 0);
  assert.equal(vices[0]!.fake.running, true, "the machine runs again as before");
  assert.equal(vices[0]!.fake.checkpoints.size, 1);
  const status = await session.handle("status", {});
  assert.equal(status.window, false);
  assert.equal(status.state, "running");
  await session.close();
});

test("a new VICE that refuses the snapshot is stopped, and the old one stays current and stopped as it was", async () => {
  const { session, vices } = await startWindowSession({
    configure: (fake, mode) => {
      if (mode === "window") fake.refuseUndump = true;
    },
  });
  await session.handle("execution", { action: "pause", space: "c64" });
  await assert.rejects(session.handle("window", { action: "open" }), failsWith("operation-failed", /stays headless/));
  assert.equal(vices.length, 2);
  assert.equal(vices[1]!.process.stopCount, 1, "the refused VICE is stopped");
  assert.equal(vices[0]!.process.stopCount, 0);
  assert.equal(vices[0]!.fake.running, false);
  const status = await session.handle("status", {});
  assert.deepEqual([status.window, status.state], [false, "stopped"]);
  await session.close();
});

test("the user closes the window: the session goes back headless from the state of when it opened, once with a notice", async () => {
  const { session, vices, current } = await startWindowSession();
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xc000, data: "01", space: "c64", view: "cpu" });
  await session.handle("execution", { action: "resume", space: "c64" });
  await session.handle("window", { action: "open" });
  // Work in the window that the close throws away; a point added there is kept.
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xc000, data: "02", space: "c64", view: "cpu" });
  const added = await session.handle("breakpoint", { action: "add", address: 0x3000, space: "c64" });
  vices[1]!.process.crash();

  const notice = await noticeAfterWindowClosed(session);
  assert.ok(failsWith("machine-state-lost", /window closed before c64_window close/i)(notice), String(notice));
  assert.match((notice as Error).message, /Breakpoints and watchpoints are kept/);

  const headless = current();
  assert.equal(vices.length, 3);
  assert.equal(headless.mode, "headless");
  assert.equal(headless.ram[0xc000], 0x01, "the state of when the window opened");
  assert.deepEqual([...headless.checkpoints.values()].map((point) => point.start), [0x3000]);
  assert.deepEqual(await session.handle("breakpoint", { action: "list" }), { breakpoints: [added] });
  const status = await session.handle("status", {});
  assert.equal(status.window, false);
  assert.equal(status.state, "running", "it ran when the window opened");
  // The notice comes once; a later window works again.
  await session.handle("window", { action: "open" });
  assert.equal(current().mode, "window");
  await session.close();
});

test("a crash of a headless VICE is still final", async () => {
  const { session, vices } = await startWindowSession();
  await session.handle("window", { action: "open" });
  await session.handle("window", { action: "close" });
  vices.at(-1)!.process.crash();
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(session.handle("status", {}), failsWith("machine-state-lost", /Restart the c64-re-tools MCP server/));
  }
  await session.close();
});

test("closing the session during a move stops the new VICE too", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let launching!: () => void;
  const launched = new Promise<void>((resolve) => (launching = resolve));
  const { session, vices } = await startWindowSession({ gate, onLaunch: () => launching() });
  const opening = session.handle("window", { action: "open" });
  await launched;
  const closing = session.close();
  release();
  await assert.rejects(opening, failsWith("machine-unavailable"));
  await closing;
  assert.equal(vices.length, 2, "the new VICE was started");
  for (const { process } of vices) assert.equal(process.stopCount, 1, "every VICE the session started is stopped");
});

test("a session closed while its window VICE ends starts no headless VICE", async () => {
  let launches = 0;
  const { session, vices } = await startWindowSession({ onLaunch: () => launches++ });
  await session.handle("window", { action: "open" });
  vices[1]!.process.crash();
  await new Promise((resolve) => setImmediate(resolve));
  await session.close();
  // Queued behind the work that the crash queued: it fails once that work has ended.
  await assert.rejects(session.handle("status", {}), failsWith("machine-unavailable", /closed/));
  assert.equal(launches, 1, "only the window VICE was started");
  assert.equal(vices.length, 2);
});

test("a session without a launcher cannot open a window", async () => {
  const { process } = await launchFake("headless");
  const session = await ViceSession.start(process, "pal");
  await assert.rejects(session.handle("window", { action: "open" }), failsWith("operation-failed"));
  await session.close();
});
