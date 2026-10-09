// Real-VICE checks for the session (src/host/vice/session.ts): reads keep the
// prior run state, views and spaces map to the right memory, and a crash is
// reported as lost machine state.

import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "../../../src/protocol/messages.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { liveEnv, liveLog, liveSkip, viceChildren } from "./live.ts";

test("a live session reads memory and registers without stopping a running machine", { skip: liveSkip, timeout: 90_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  const session = await viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })({ videoStandard: "pal" });
  try {
    assert.deepEqual(await session.handle("status", {}), { state: "running", videoStandard: "pal", warp: false, window: false });

    const kernal = await session.handle("memoryRead", { address: 0xe000, size: 4, space: "c64", view: "cpu" });
    assert.deepEqual(kernal, { address: 0xe000, data: "8556200f" });
    assert.equal((await session.handle("status", {})).state, "running", "a read must not leave the machine stopped");

    // Under the KERNAL ROM is RAM, which the ram view reads instead.
    const ram = await session.handle("memoryRead", { address: 0xe000, size: 4, space: "c64", view: "ram" });
    assert.notEqual(ram.data, kernal.data);

    const registers = await session.handle("registersGet", { space: "c64" });
    assert.ok(registers.sp > 0 && registers.sp <= 0xff);
    assert.equal(typeof registers.flags.i, "boolean");

    const dos = await session.handle("memoryRead", { address: 0xc000, size: 2, space: "drive8", view: "cpu" });
    assert.notEqual(dos.data, "0000");
    await session.handle("registersGet", { space: "drive8" });

    await assert.rejects(
      session.handle("memoryRead", { address: 0, size: 1, space: "drive8", view: "ram" }),
      (error: unknown) => error instanceof WireFailure && error.code === "unsupported-in-space",
    );
    assert.equal((await session.handle("status", {})).state, "running");
  } finally {
    await session.close();
  }
  assert.deepEqual(viceChildren(process.pid), []);
});

test("a VICE killed under a live session reports machine-state-lost", { skip: liveSkip, timeout: 90_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  const session = await viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })({ videoStandard: "pal" });
  try {
    const [pid] = viceChildren(process.pid);
    assert.ok(pid !== undefined, "no VICE child found");
    process.kill(pid, "SIGKILL");
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(
        session.handle("memoryRead", { address: 0xe000, size: 1, space: "c64", view: "cpu" }),
        (error: unknown) => error instanceof WireFailure && error.code === "machine-state-lost",
      );
    }
  } finally {
    await session.close();
  }
});
