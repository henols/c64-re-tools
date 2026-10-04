// Real-VICE checks for the cycle profile and the memory access map.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import type { MemmapRange } from "../../../src/protocol.ts";
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

// $c000: SEI ; loop: JSR $c010 ; JMP loop      $c010: INC $c100 ; RTS
const PROGRAM = { 0xc000: "782010c04c01c0", 0xc010: "ee00c160" };

test("a busy routine tops the profile and the memmap shows its accesses", { skip: liveSkip, timeout: 90_000 }, async () => {
  await session.handle("execution", { action: "pause", space: "c64" });
  for (const [address, data] of Object.entries(PROGRAM)) await session.handle("memoryWrite", { address: Number(address), data, space: "c64", view: "cpu" });
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc000 } });
  await session.handle("memmap", { action: "clear" });
  await session.handle("execution", { action: "advance-frames", count: 100, space: "c64" });

  const { entries } = await session.handle("profile", { limit: 5 });
  const routine = entries.find((entry) => entry.address === 0xc010);
  assert.ok(routine !== undefined, JSON.stringify(entries));
  assert.ok(BigInt(routine.selfCycles) > 0n);

  const { ranges } = (await session.handle("memmap", { action: "read", start: 0xc000, end: 0xc1ff, maxRanges: 50 })) as { ranges: MemmapRange[] };
  const covering = (address: number) => ranges.find((range) => range.start <= address && address <= range.end);
  assert.equal(covering(0xc010)?.execute, true, JSON.stringify(ranges));
  assert.equal(covering(0xc100)?.write, true, "INC writes $c100");
  assert.equal(covering(0xc100)?.execute, false);
  assert.equal(covering(0xc080), undefined, "an untouched address is in no range");

  await session.handle("memmap", { action: "clear" });
  const { ranges: cleared } = (await session.handle("memmap", { action: "read", start: 0xc000, end: 0xc1ff, maxRanges: 50 })) as { ranges: MemmapRange[] };
  assert.deepEqual(cleared, []);
});
