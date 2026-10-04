// Real-VICE checks for advance-frames and run-until. VICE's stopwatch (CPU
// cycles) is the independent clock: a PAL frame is 312 x 63 = 19656 cycles,
// an NTSC frame 263 x 65 = 17095.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../../src/host/processes.ts";
import { launchVice, type ViceProcess } from "../../../src/host/vice/process.ts";
import { ViceSession } from "../../../src/host/vice/session.ts";
import type { VideoStandard } from "../../../src/protocol.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

// $c000: SEI ; LDX #$00 ; $c003: INX ; STX $c100 ; CPX #$0a ; BNE $c003 ; $c00b: JMP $c00b
const COUNTER = "78a200e88e00c1e00ad0f84c0bc0";

const opened: ViceSession[] = [];
after(async () => {
  await Promise.all(opened.map((session) => session.close()));
});

async function open(videoStandard: VideoStandard): Promise<{ session: ViceSession; vice: ViceProcess }> {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  const vice = await launchVice({ videoStandard, supervisor, env: liveEnv() });
  const session = await ViceSession.start(vice, videoStandard, liveLog);
  opened.push(session);
  return { session, vice };
}

async function cycles(vice: ViceProcess): Promise<number> {
  const answer = await vice.text.command("stopwatch");
  return Number(/Stopwatch:\s+(\d+)/.exec(answer)![1]);
}

async function load(session: ViceSession, program: string): Promise<void> {
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xc000, data: program, space: "c64", view: "cpu" });
  await session.handle("memoryWrite", { address: 0xc100, data: "00", space: "c64", view: "cpu" });
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc000 } });
}

test("advance-frames runs exactly that many PAL frames and finishes stopped", { skip: liveSkip, timeout: 120_000 }, async () => {
  const { session, vice } = await open("pal");
  await session.handle("execution", { action: "pause", space: "c64" });
  for (const frames of [1, 7, 50]) {
    const before = await cycles(vice);
    const result = await session.handle("execution", { action: "advance-frames", count: frames, space: "c64" });
    assert.equal(result.state, "stopped");
    assert.equal(result.advancedFrames, frames);
    const elapsed = (await cycles(vice)) - before;
    // The run ends at the first instruction at or after the start position: at most one instruction late.
    assert.ok(elapsed >= frames * 19656 && elapsed < frames * 19656 + 8, `${frames} frames took ${elapsed} cycles`);
    assert.equal((await session.handle("status", {})).state, "stopped");
  }
});

test("advance-frames from a running machine pauses first; NTSC frames are 17095 cycles", { skip: liveSkip, timeout: 120_000 }, async () => {
  const { session, vice } = await open("ntsc");
  const result = await session.handle("execution", { action: "advance-frames", count: 3, space: "c64" });
  assert.equal(result.advancedFrames, 3);
  const before = await cycles(vice);
  await session.handle("execution", { action: "advance-frames", count: 10, space: "c64" });
  const elapsed = (await cycles(vice)) - before;
  assert.ok(elapsed >= 10 * 17095 && elapsed < 10 * 17095 + 8, `10 NTSC frames took ${elapsed} cycles`);
});

test("the same start state gives the same result every time", { skip: liveSkip, timeout: 120_000 }, async () => {
  const { session } = await open("pal");
  const results = [];
  for (let run = 0; run < 2; run++) {
    await session.handle("reset", { mode: "hard", run: false });
    const advanced = await session.handle("execution", { action: "advance-frames", count: 30, space: "c64" });
    const registers = await session.handle("registersGet", { space: "c64" });
    const raster = await session.handle("memoryRead", { address: 0xd011, size: 2, space: "c64", view: "cpu" });
    results.push({ advanced, registers, raster });
  }
  assert.deepEqual(results[0], results[1]);
});

test("run-until reaches address, memory and raster targets", { skip: liveSkip, timeout: 120_000 }, async () => {
  const { session } = await open("pal");
  await load(session, COUNTER);
  assert.deepEqual(await session.handle("runUntil", { target: { kind: "address", address: 0xc00b, space: "c64" }, timeoutFrames: 100 }), {
    reached: true,
    stopReason: "target",
    state: "stopped",
    pc: 0xc00b,
  });
  assert.equal((await session.handle("registersGet", { space: "c64" })).x, 10);

  await load(session, COUNTER);
  const memory = await session.handle("runUntil", {
    target: { kind: "memory", address: 0xc100, operator: "eq", value: 7, space: "c64", view: "cpu" },
    timeoutFrames: 100,
  });
  assert.equal(memory.stopReason, "target");
  assert.equal((await session.handle("memoryRead", { address: 0xc100, size: 1, space: "c64", view: "cpu" })).data, "07");

  await load(session, COUNTER);
  const conditioned = await session.handle("runUntil", {
    target: { kind: "address", address: 0xc003, space: "c64", condition: { kind: "register", register: "x", operator: "eq", value: 4 } },
    timeoutFrames: 100,
  });
  assert.equal(conditioned.pc, 0xc003);
  assert.equal((await session.handle("registersGet", { space: "c64" })).x, 4);

  const raster = await session.handle("runUntil", { target: { kind: "raster", line: 200, cycle: 10 }, timeoutFrames: 2 });
  assert.equal(raster.stopReason, "target");
  const line = Number.parseInt((await session.handle("memoryRead", { address: 0xd012, size: 1, space: "c64", view: "cpu" })).data, 16);
  assert.equal(line, 200);
  // Already at the target: the next pass counts, a full frame later.
  const again = await session.handle("runUntil", { target: { kind: "raster", line: 200, cycle: 10 }, timeoutFrames: 2 });
  assert.equal(again.stopReason, "target");
});

test("run-until reports timeout, breakpoint and jam as the stop reason", { skip: liveSkip, timeout: 120_000 }, async () => {
  const { session, vice } = await open("pal");
  await load(session, COUNTER);
  const before = await cycles(vice);
  const timeout = await session.handle("runUntil", { target: { kind: "address", address: 0xc0ff, space: "c64" }, timeoutFrames: 5 });
  assert.deepEqual({ reached: timeout.reached, stopReason: timeout.stopReason, state: timeout.state }, { reached: false, stopReason: "timeout", state: "stopped" });
  const elapsed = (await cycles(vice)) - before;
  assert.ok(elapsed >= 5 * 19656 && elapsed < 5 * 19656 + 8, `timeout after ${elapsed} cycles`);

  await load(session, COUNTER);
  await session.handle("breakpoint", { action: "add", address: 0xc007, space: "c64" });
  const interrupted = await session.handle("execution", { action: "advance-frames", count: 10, space: "c64" });
  assert.equal(interrupted.pc, 0xc007);
  assert.equal(interrupted.advancedFrames, 0);
  const byBreakpoint = await session.handle("runUntil", { target: { kind: "address", address: 0xc0ff, space: "c64" }, timeoutFrames: 5 });
  assert.equal(byBreakpoint.stopReason, "breakpoint");
  await session.handle("breakpoint", { action: "remove", id: 1 });

  await load(session, "02");
  const jam = await session.handle("runUntil", { target: { kind: "address", address: 0xc0ff, space: "c64" }, timeoutFrames: 5 });
  assert.deepEqual(jam, { reached: false, stopReason: "jam", state: "stopped", pc: 0xc000 });
});
