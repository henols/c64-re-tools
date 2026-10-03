// Real-VICE checks for memory and register writes and for until-return on a
// routine written into memory.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { ProcessSupervisor } from "../../../src/host/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { WireFailure } from "../../../src/protocol.ts";
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

test("writes are refused while the CPU runs", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "resume", space: "c64" });
  await assert.rejects(
    session.handle("memoryWrite", { address: 0xc000, data: "ea", space: "c64", view: "cpu" }),
    (error: unknown) => error instanceof WireFailure && error.code === "machine-running",
  );
  assert.equal((await session.handle("status", {})).state, "running");
});

test("memory writes read back, and the views reach I/O or the RAM under it", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xc000, data: "0102030405", space: "c64", view: "cpu" });
  assert.equal((await session.handle("memoryRead", { address: 0xc000, size: 5, space: "c64", view: "cpu" })).data, "0102030405");

  // The border colour register is in I/O; the RAM under it is a separate byte.
  await session.handle("memoryWrite", { address: 0xd020, data: "02", space: "c64", view: "cpu" });
  await session.handle("memoryWrite", { address: 0xd020, data: "55", space: "c64", view: "ram" });
  assert.equal((await session.handle("memoryRead", { address: 0xd020, size: 1, space: "c64", view: "cpu" })).data.slice(1), "2");
  assert.equal((await session.handle("memoryRead", { address: 0xd020, size: 1, space: "c64", view: "ram" })).data, "55");
  assert.equal((await session.handle("status", {})).state, "stopped");
});

test("register writes set only the named registers", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "pause", space: "c64" });
  const before = await session.handle("registersGet", { space: "c64" });
  const after = await session.handle("registersSet", { space: "c64", values: { a: 0x42, flags: { c: !before.flags.c } } });
  assert.equal(after.a, 0x42);
  assert.equal(after.x, before.x);
  assert.equal(after.pc, before.pc);
  assert.equal(after.flags.c, !before.flags.c);
  assert.equal(after.flags.i, before.flags.i);
  assert.deepEqual(await session.handle("registersGet", { space: "c64" }), after);
});

test("until-return runs a called routine to its RTS", { skip: liveSkip, timeout: 60_000 }, async () => {
  await session.handle("execution", { action: "pause", space: "c64" });
  // $c100: JSR $c110 ; NOP     $c110: LDX #$05 ; DEX ; BNE $c112 ; RTS
  await session.handle("memoryWrite", { address: 0xc100, data: "2010c1ea", space: "c64", view: "cpu" });
  await session.handle("memoryWrite", { address: 0xc110, data: "a205cad0fd60", space: "c64", view: "cpu" });
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc100 } });
  assert.deepEqual(await session.handle("execution", { action: "step", count: 1, space: "c64" }), { state: "stopped", pc: 0xc110, executed: 1 });
  assert.deepEqual(await session.handle("execution", { action: "until-return", space: "c64" }), { state: "stopped", pc: 0xc103 });
  assert.equal((await session.handle("registersGet", { space: "c64" })).x, 0);

  // next steps over the whole call.
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc100 } });
  assert.deepEqual(await session.handle("execution", { action: "next", count: 1, space: "c64" }), { state: "stopped", pc: 0xc103, executed: 1 });
});
