// Real-VICE checks for program load, disk attach and autostart.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { ProcessSupervisor } from "../../../src/host/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { WireFailure } from "../../../src/protocol.ts";
import { buildD64 } from "../../fixtures/d64.ts";
import { BORDER_LOOP_END, BORDER_LOOP_START, borderLoopPrg } from "../../fixtures/prg/border-loop.ts";
import { liveEnv, liveSkip } from "./live.ts";

let session: ViceSessionHandle;
before(async () => {
  if (liveSkip !== false) return;
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  session = await viceSessionFactory({ supervisor, env: liveEnv() })({ videoStandard: "pal" });
});
after(async () => {
  await session?.close();
});

/** Polls (no fixed sleep) until the C64 CPU runs inside [start, end]. */
async function waitForPcIn(start: number, end: number, timeoutMs = 30_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { pc } = await session.handle("registersGet", { space: "c64" });
    if (pc >= start && pc <= end) return pc;
    if (Date.now() > deadline) throw new Error(`pc stayed outside $${start.toString(16)}-$${end.toString(16)} (last $${pc.toString(16)})`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

test("a program load puts the bytes in memory, stopped, at either address", { skip: liveSkip, timeout: 60_000 }, async () => {
  const prg = Buffer.from(borderLoopPrg);
  assert.deepEqual(await session.handle("programLoad", {}, [prg]), { state: "stopped", loadAddress: 0x0801, size: prg.length - 2 });
  assert.equal((await session.handle("memoryRead", { address: 0x0801, size: prg.length - 2, space: "c64", view: "cpu" })).data, prg.subarray(2).toString("hex"));
  assert.deepEqual(await session.handle("programLoad", { address: 0xc000 }, [prg]), { state: "stopped", loadAddress: 0xc000, size: prg.length - 2 });
  assert.equal((await session.handle("memoryRead", { address: 0xc000, size: 4, space: "c64", view: "cpu" })).data, prg.subarray(2, 6).toString("hex"));
  assert.equal((await session.handle("status", {})).state, "stopped");
});

test("a disk image attaches; a broken one is a media error", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "resume", space: "c64" });
  assert.deepEqual(await session.handle("diskAttach", { type: "d64" }, [buildD64([{ name: "LOOP", bytes: borderLoopPrg }])]), { attached: true });
  assert.equal((await session.handle("status", {})).state, "running");
  await assert.rejects(
    session.handle("diskAttach", { type: "d64" }, [Buffer.alloc(100)]),
    (error: unknown) => error instanceof WireFailure && error.code === "media-error",
  );
});

test("autostart of a PRG runs it", { skip: liveSkip, timeout: 90_000 }, async () => {
  assert.deepEqual(await session.handle("autostart", { type: "prg", index: 0, run: true }, [Buffer.from(borderLoopPrg)]), { state: "running" });
  await waitForPcIn(BORDER_LOOP_START, BORDER_LOOP_END);
});

test("autostart of a D64 loads the first file and runs it", { skip: liveSkip, timeout: 120_000 }, async () => {
  await session.handle("reset", { mode: "hard", run: true });
  const image = buildD64([{ name: "LOOP", bytes: borderLoopPrg }]);
  assert.deepEqual(await session.handle("autostart", { type: "d64", index: 0, run: true }, [image]), { state: "running" });
  await waitForPcIn(BORDER_LOOP_START, BORDER_LOOP_END, 60_000);
});
