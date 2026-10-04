// Real-VICE checks for CPU history, backtrace and the cycle stopwatch.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

let session: ViceSessionHandle;
before(async () => {
  if (liveSkip !== false) return;
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  session = await viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })({ videoStandard: "pal" });
});
after(async () => {
  await session?.close();
});

// $c100: JSR $c110 ; NOP     $c110: LDX #$05 ; DEX ; BNE $c112 ; RTS
async function loadRoutine(): Promise<void> {
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xc100, data: "2010c1ea", space: "c64", view: "cpu" });
  await session.handle("memoryWrite", { address: 0xc110, data: "a205cad0fd60", space: "c64", view: "cpu" });
  // Interrupts off, so no KERNAL IRQ lands in the middle of the steps.
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc100, flags: { i: true } } });
}

test("the history lists the instructions just executed, oldest first, with registers", { skip: liveSkip, timeout: 60_000 }, async () => {
  await loadRoutine();
  await session.handle("execution", { action: "step", count: 4, space: "c64" });
  const { entries } = await session.handle("cpuHistory", { limit: 4, space: "c64" });
  assert.deepEqual(
    entries.map((entry) => [entry.address, entry.text]),
    [
      [0xc100, "JSR $c110"],
      [0xc110, "LDX #$05"],
      [0xc112, "DEX"],
      [0xc113, "BNE $c112"],
    ],
  );
  assert.equal(entries[2]!.x, 5, "registers are those before the instruction ran");
});

test("history raster positions agree with a raster stop", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("runUntil", { target: { kind: "raster", line: 150, cycle: 30 }, timeoutFrames: 2 });
  const { entries } = await session.handle("cpuHistory", { limit: 1, space: "c64" });
  const last = entries[0]!;
  const position = last.rasterLine! * 63 + last.rasterCycle!;
  // The last instruction started at most 8 cycles before the stop at line 150, cycle 30 or later.
  assert.ok(position <= 150 * 63 + 30 + 8 && position >= 150 * 63 + 30 - 8, `history at ${last.rasterLine}/${last.rasterCycle}`);
});

test("the backtrace shows the call into the routine", { skip: liveSkip, timeout: 60_000 }, async () => {
  await loadRoutine();
  await session.handle("execution", { action: "step", count: 2, space: "c64" });
  const { frames } = await session.handle("backtrace", { depth: 4, space: "c64" });
  assert.deepEqual(frames[0], { address: 0xc110, returnAddress: 0xc103 });
});

test("the stopwatch counts the cycles of exact frames", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("timing", { action: "start" });
  await session.handle("execution", { action: "advance-frames", count: 3, space: "c64" });
  const { cycles } = (await session.handle("timing", { action: "read" })) as { cycles: string };
  assert.ok(Number(cycles) >= 3 * 19656 && Number(cycles) < 3 * 19656 + 8, cycles);
});
