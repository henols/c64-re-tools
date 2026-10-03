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
