import assert from "node:assert/strict";
import { after, test } from "node:test";

import { WireFailure } from "../../protocol.ts";
import { Command } from "./binary-monitor.ts";
import { FakeVice } from "./fake-vice.testkit.ts";
import { ViceSession, type SessionOptions } from "./session.ts";

const fakes: FakeVice[] = [];
const processes: Array<{ stop(): Promise<void> }> = [];
// Stop every fake, so a failed assertion reports instead of leaving sockets that keep the run alive.
after(async () => {
  await Promise.all(processes.map((process) => process.stop()));
  for (const fake of fakes) fake.close();
});

async function startSession(options: SessionOptions = {}) {
  const fake = new FakeVice();
  fakes.push(fake);
  const process = await fake.start();
  processes.push(process);
  const session = await ViceSession.start(process, "pal", () => {}, options);
  fake.commands.length = 0;
  fake.textCommands.length = 0;
  return { fake, session, process };
}

const failsWith = (code: string) => (error: unknown) => error instanceof WireFailure && error.code === code;

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("condition not reached in time");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test("setup leaves the machine running", async () => {
  const { fake, session } = await startSession();
  assert.equal(fake.running, true);
  await session.close();
});

test("status reads warp from VICE, reports no pc while running and keeps it running", async () => {
  const { fake, session } = await startSession();
  fake.warp = true;
  assert.deepEqual(await session.handle("status", {}), { state: "running", videoStandard: "pal", warp: true });
  assert.deepEqual(fake.textCommands, ["warp"]);
  assert.equal(fake.running, true);
  await session.close();
});

test("a read while running pauses, reads and resumes", async () => {
  const { fake, session } = await startSession();
  const result = await session.handle("memoryRead", { address: 0x1000, size: 4, space: "c64", view: "cpu" });
  assert.deepEqual(result, { address: 0x1000, data: "00010203" });
  // The ping reads every earlier event before the session decides to resume.
  assert.deepEqual(fake.commands, [Command.memoryGet, Command.ping, Command.exit]);
  assert.equal(fake.running, true);
  await session.close();
});

test("the cpu view sees ROM where the ram view sees RAM", async () => {
  const { session } = await startSession();
  const cpu = await session.handle("memoryRead", { address: 0xe000, size: 2, space: "c64", view: "cpu" });
  const ram = await session.handle("memoryRead", { address: 0xe000, size: 2, space: "c64", view: "ram" });
  assert.equal(cpu.data, "e0e0");
  assert.equal(ram.data, "0001");
  await session.close();
});

test("a read while stopped leaves the machine stopped and status reports the pc", async () => {
  const { fake, session } = await startSession();
  fake.stopSpontaneously(0x2100);
  await waitFor(() => !fake.running);
  fake.commands.length = 0;
  // The first read may race the breakpoint's stopped event; it must still not resume.
  const registers = await session.handle("registersGet", { space: "c64" });
  assert.deepEqual(registers, {
    pc: 0x2100,
    a: 0x42,
    x: 3,
    y: 0,
    sp: 0xf9,
    flags: { n: true, v: false, b: false, d: false, i: true, z: false, c: true },
  });
  assert.ok(!fake.commands.includes(Command.exit), "a read must not resume a machine a breakpoint stopped");
  assert.equal(fake.running, false);
  assert.deepEqual(await session.handle("status", {}), { state: "stopped", videoStandard: "pal", warp: false, pc: 0x2100 });
  await session.close();
});

test("a refused read keeps the machine running", async () => {
  const { fake, session } = await startSession();
  await assert.rejects(session.handle("memoryRead", { address: 0, size: 1, space: "drive8", view: "ram" }), failsWith("unsupported-in-space"));
  assert.equal(fake.running, true);
  await session.close();
});

test("concurrent operations run one at a time", async () => {
  const { fake, session } = await startSession();
  await Promise.all([
    session.handle("memoryRead", { address: 0, size: 1, space: "c64", view: "cpu" }),
    session.handle("registersGet", { space: "c64" }),
    session.handle("memoryRead", { address: 1, size: 1, space: "c64", view: "ram" }),
  ]);
  const observe = (command: number) => [command, Command.ping, Command.exit];
  assert.deepEqual(fake.commands, [...observe(Command.memoryGet), ...observe(Command.registersGet), ...observe(Command.memoryGet)]);
  await session.close();
});

test("pause stops with the pc and resume runs again", async () => {
  const { fake, session } = await startSession();
  assert.deepEqual(await session.handle("execution", { action: "pause", space: "c64" }), { state: "stopped", pc: 0xe5cf });
  assert.equal(fake.running, false);
  // Pausing a stopped machine changes nothing.
  assert.deepEqual(await session.handle("execution", { action: "pause", space: "c64" }), { state: "stopped", pc: 0xe5cf });
  assert.deepEqual(await session.handle("execution", { action: "resume", space: "c64" }), { state: "running" });
  assert.equal(fake.running, true);
  assert.equal((await session.handle("status", {})).state, "running");
  await session.close();
});

test("step and next pause a running machine first and report the new pc", async () => {
  const { fake, session } = await startSession();
  assert.deepEqual(await session.handle("execution", { action: "step", count: 3, space: "c64" }), {
    state: "stopped",
    pc: 0xe5d2,
    executed: 3,
  });
  assert.deepEqual(fake.commands.slice(0, 2), [Command.ping, Command.advanceInstructions]);
  fake.stepTo = 0x2000;
  assert.deepEqual(await session.handle("execution", { action: "next", count: 1, space: "c64" }), {
    state: "stopped",
    pc: 0x2000,
    executed: 1,
  });
  assert.equal(fake.running, false);
  await session.close();
});

test("until-return waits for the routine to return", async () => {
  const { fake, session } = await startSession();
  await session.handle("execution", { action: "pause", space: "c64" });
  fake.returnTo = 0x1980;
  const result = session.handle("execution", { action: "until-return", space: "c64" });
  await waitFor(() => fake.running);
  fake.completeReturn();
  assert.deepEqual(await result, { state: "stopped", pc: 0x1980 });
  await session.close();
});

test("until-return that never returns stops the machine and reports the limit", async () => {
  const { fake, session } = await startSession({ untilReturnLimitMs: 50 });
  await assert.rejects(session.handle("execution", { action: "until-return", space: "c64" }), (error: unknown) => {
    assert.ok(failsWith("limit-exceeded")(error));
    assert.match((error as Error).message, /stopped at \$[0-9a-f]{4}/);
    return true;
  });
  assert.equal(fake.running, false);
  assert.equal((await session.handle("status", {})).state, "stopped");
  await session.close();
});

test("stepping drive8 is refused for now", async () => {
  const { session } = await startSession();
  await assert.rejects(session.handle("execution", { action: "step", count: 1, space: "drive8" }), failsWith("unsupported-in-space"));
  await session.close();
});

test("a reset without run stops at the reset vector and leaves no checkpoint", async () => {
  const { fake, session } = await startSession();
  assert.deepEqual(await session.handle("reset", { mode: "hard", run: false }), { state: "stopped" });
  assert.equal(fake.running, false);
  assert.equal(fake.registers.PC, 0xfce2);
  assert.equal(fake.checkpoints.size, 0);
  assert.deepEqual(await session.handle("status", {}), { state: "stopped", videoStandard: "pal", warp: false, pc: 0xfce2 });
  await session.close();
});

test("a reset with run leaves the machine running", async () => {
  const { fake, session } = await startSession();
  assert.deepEqual(await session.handle("reset", { mode: "soft", run: true }), { state: "running" });
  assert.equal(fake.running, true);
  await session.close();
});

test("warp is set through VICE and keeps the run state", async () => {
  const { fake, session } = await startSession();
  assert.deepEqual(await session.handle("warp", { enabled: true }), { enabled: true });
  assert.equal(fake.warp, true);
  assert.equal(fake.running, true);
  assert.equal((await session.handle("status", {})).warp, true);
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("warp", { enabled: false });
  assert.equal(fake.running, false, "warp must not resume a stopped machine");
  await session.close();
});

test("a VICE crash fails the operation and every later one with machine-state-lost", async () => {
  const { session, process } = await startSession();
  process.crash();
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(session.handle("registersGet", { space: "c64" }), failsWith("machine-state-lost"));
  }
  await session.close();
});

test("closing drops queued work and stops VICE", async () => {
  const { session, process } = await startSession();
  const queued = session.handle("memoryRead", { address: 0, size: 1, space: "c64", view: "cpu" });
  const closing = session.close();
  await assert.rejects(queued, failsWith("machine-unavailable"));
  await closing;
  assert.equal(process.stopCount, 1);
});

test("writes need a stopped CPU and never pause it themselves", async () => {
  const { fake, session } = await startSession();
  await assert.rejects(session.handle("memoryWrite", { address: 0x2000, data: "a9", space: "c64", view: "cpu" }), failsWith("machine-running"));
  await assert.rejects(session.handle("registersSet", { space: "c64", values: { a: 1 } }), failsWith("machine-running"));
  assert.equal(fake.running, true);
  assert.equal(fake.ram[0x2000], 0x00);
  await session.close();
});

test("a memory write lands in the selected space and the CPU stays stopped", async () => {
  const { fake, session } = await startSession();
  await session.handle("execution", { action: "pause", space: "c64" });
  assert.deepEqual(await session.handle("memoryWrite", { address: 0x2000, data: "a9008d20d0", space: "c64", view: "cpu" }), {
    address: 0x2000,
    bytesWritten: 5,
  });
  assert.deepEqual([...fake.ram.subarray(0x2000, 0x2005)], [0xa9, 0x00, 0x8d, 0x20, 0xd0]);
  await session.handle("memoryWrite", { address: 0x0300, data: "ff", space: "drive8", view: "cpu" });
  assert.equal(fake.drive[0x0300], 0xff);
  assert.equal(fake.running, false);
  await session.close();
});

test("a register write sets only the named registers and merges flags", async () => {
  const { fake, session } = await startSession();
  await session.handle("execution", { action: "pause", space: "c64" });
  const after = await session.handle("registersSet", { space: "c64", values: { pc: 0x2100, x: 7, flags: { z: true, c: false } } });
  // FL was %10100101 (n, i, c); z set and c cleared gives n, i, z.
  assert.deepEqual(after, {
    pc: 0x2100,
    a: 0x42,
    x: 7,
    y: 0,
    sp: 0xf9,
    flags: { n: true, v: false, b: false, d: false, i: true, z: true, c: false },
  });
  assert.equal(fake.registers.FL, 0b1010_0110);
  assert.equal(fake.running, false);
  await session.close();
});

test("a program load stops the machine and loads at the PRG's own address", async () => {
  const { fake, session } = await startSession();
  const prg = Buffer.from([0x00, 0xc0, 0xa9, 0x01, 0x60]);
  assert.deepEqual(await session.handle("programLoad", {}, [prg]), { state: "stopped", loadAddress: 0xc000, size: 3 });
  assert.deepEqual([...fake.ram.subarray(0xc000, 0xc003)], [0xa9, 0x01, 0x60]);
  assert.equal(fake.running, false);
  await session.close();
});

test("a program load with an address skips the PRG's own address", async () => {
  const { fake, session } = await startSession();
  const prg = Buffer.from([0x00, 0xc0, 0xa9, 0x01, 0x60]);
  assert.deepEqual(await session.handle("programLoad", { address: 0x2000 }, [prg]), { state: "stopped", loadAddress: 0x2000, size: 3 });
  assert.deepEqual([...fake.ram.subarray(0x2000, 0x2003)], [0xa9, 0x01, 0x60]);
  await session.close();
});

test("a program that is too short or runs past $ffff is refused before VICE sees it", async () => {
  const { fake, session } = await startSession();
  await assert.rejects(session.handle("programLoad", {}, [Buffer.from([0x00, 0xc0])]), failsWith("invalid-input"));
  await assert.rejects(session.handle("programLoad", {}, [Buffer.from([0xff, 0xff, 1, 2])]), failsWith("invalid-input"));
  assert.deepEqual(fake.textCommands, []);
  assert.equal(fake.running, true);
  await session.close();
});

test("autostart stages the bytes with their type and leaves the machine running", async () => {
  const { fake, session } = await startSession();
  await session.handle("execution", { action: "pause", space: "c64" });
  const image = Buffer.alloc(174848, 0x11);
  assert.deepEqual(await session.handle("autostart", { type: "d64", index: 2, run: false }, [image]), { state: "running" });
  assert.equal(fake.autostarts.length, 1);
  assert.match(fake.autostarts[0]!.file, /\.d64$/);
  assert.equal(fake.autostarts[0]!.run, false);
  assert.equal(fake.autostarts[0]!.index, 2);
  assert.ok(fake.autostarts[0]!.bytes.equals(image));
  assert.equal(fake.running, true);
  await session.close();
});

test("a disk attach keeps the run state; an image VICE refuses is a media error", async () => {
  const { fake, session } = await startSession();
  assert.deepEqual(await session.handle("diskAttach", { type: "d64" }, [Buffer.alloc(174848)]), { attached: true });
  assert.equal(fake.attached.length, 1);
  assert.equal(fake.running, true);
  await assert.rejects(session.handle("diskAttach", { type: "d64" }, [Buffer.alloc(100)]), failsWith("media-error"));
  assert.equal(fake.running, true, "a refused attach must not leave the machine stopped");
  await session.close();
});

test("the session releases both joysticks at start", async () => {
  const { fake, session } = await startSession();
  assert.deepEqual(fake.joyport, [0x1f, 0x1f]);
  await session.close();
});

test("joystick states set active-low lines on the right port and are held", async () => {
  const { fake, session } = await startSession();
  assert.deepEqual(await session.handle("joystick", { port: 2, direction: "up-left", fire: true }), { port: 2, direction: "up-left", fire: true });
  assert.deepEqual(fake.joyport, [0x1f, 0x1f & ~(0x01 | 0x04 | 0x10)]);
  await session.handle("joystick", { port: 1, direction: "down-right", fire: false });
  assert.deepEqual(fake.joyport, [0x1f & ~(0x02 | 0x08), 0x0a]);
  assert.equal(fake.running, true);
  await session.close();
});

test("keyboard bytes are fed in chunks VICE accepts and keep the run state", async () => {
  const { fake, session } = await startSession();
  const text = Buffer.alloc(600, 0x41);
  assert.deepEqual(await session.handle("keyboard", { data: text.toString("hex") }), { queuedBytes: 600 });
  assert.equal(fake.keyboard.length, 600);
  assert.equal(fake.commands.filter((command) => command === Command.keyboardFeed).length, 3);
  assert.equal(fake.running, true);
  await session.close();
});
