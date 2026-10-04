// Real-VICE checks for execution control, reset and warp (src/host/vice/session.ts).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { WireFailure } from "../../../src/protocol.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
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

test("pause stops with a pc, status agrees, and resume runs again", { skip: liveSkip, timeout: 60_000 }, async () => {
  const paused = await session.handle("execution", { action: "pause", space: "c64" });
  assert.equal(paused.state, "stopped");
  assert.ok(paused.pc !== undefined);
  const status = await session.handle("status", {});
  assert.deepEqual(status, { state: "stopped", videoStandard: "pal", warp: false, pc: paused.pc });
  // A stopped CPU does not move between reads.
  assert.equal((await session.handle("registersGet", { space: "c64" })).pc, paused.pc);
  assert.deepEqual(await session.handle("execution", { action: "resume", space: "c64" }), { state: "running" });
  assert.deepEqual(await session.handle("status", {}), { state: "running", videoStandard: "pal", warp: false });
});

test("a hard reset without run stops at the KERNAL reset entry", { skip: liveSkip, timeout: 60_000 }, async () => {
  assert.deepEqual(await session.handle("reset", { mode: "hard", run: false }), { state: "stopped" });
  const status = await session.handle("status", {});
  assert.equal(status.state, "stopped");
  assert.equal(status.pc, 0xfce2, "the stock KERNAL reset vector points at $fce2");
});

test("step and next execute from the reset entry deterministically", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("reset", { mode: "hard", run: false });
  // $fce2: LDX #$ff; SEI; TXS; CLD; JSR $fd02 ...
  const one = await session.handle("execution", { action: "step", count: 1, space: "c64" });
  assert.deepEqual(one, { state: "stopped", pc: 0xfce4, executed: 1 });
  assert.equal((await session.handle("registersGet", { space: "c64" })).x, 0xff);
  const three = await session.handle("execution", { action: "step", count: 3, space: "c64" });
  assert.deepEqual(three, { state: "stopped", pc: 0xfce7, executed: 3 });
  // $fce7 is JSR $fd02; next runs the whole subroutine.
  const next = await session.handle("execution", { action: "next", count: 1, space: "c64" });
  assert.deepEqual(next, { state: "stopped", pc: 0xfcea, executed: 1 });
  // Same again after another reset: same results.
  await session.handle("reset", { mode: "hard", run: false });
  assert.deepEqual(await session.handle("execution", { action: "step", count: 4, space: "c64" }), { state: "stopped", pc: 0xfce7, executed: 4 });
});

test("warp turns on and off and keeps the run state", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "resume", space: "c64" });
  assert.deepEqual(await session.handle("warp", { enabled: true }), { enabled: true });
  assert.deepEqual(await session.handle("status", {}), { state: "running", videoStandard: "pal", warp: true });
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("warp", { enabled: false });
  const status = await session.handle("status", {});
  assert.equal(status.warp, false);
  assert.equal(status.state, "stopped");
});

test("stepping the drive CPU is refused with the reason", { skip: liveSkip, timeout: 60_000 }, async () => {
  for (const action of ["step", "next", "until-return"] as const) {
    await assert.rejects(
      session.handle("execution", { action, space: "drive8", ...(action === "until-return" ? {} : { count: 1 }) }),
      (error: unknown) => error instanceof WireFailure && error.code === "unsupported-in-space" && /single instruction/.test(error.message),
    );
  }
});

test("run-until with a drive8 address tells when the drive executes it, and where the drive stopped", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("reset", { mode: "hard", run: true });
  await session.handle("execution", { action: "advance-frames", count: 100, space: "c64" });
  // The idle drive runs its ROM main loop; stop when it comes to this address again.
  const { pc } = await session.handle("registersGet", { space: "drive8" });
  const reached = await session.handle("runUntil", { target: { kind: "address", address: pc, space: "drive8" }, timeoutFrames: 100 });
  assert.equal(reached.reached, true, JSON.stringify(reached));
  assert.equal(reached.stopReason, "target");
  // The drive catches up with the computer's clock before the machine stops, so it can stop a few
  // instructions after the target (found live: target $ec2b, stop $ec17). pc is where it stopped.
  assert.equal(reached.pc, (await session.handle("registersGet", { space: "drive8" })).pc);
});
