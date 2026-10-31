// Real-VICE checks for the cycle profile and the memory access map.

import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE, EXECUTE } from "../../../src/c64.ts";
import type { MemmapRange, ProfileEntry } from "../../../src/protocol/vice.ts";
import { fileSession, liveSkip } from "./live.ts";

const session = fileSession();

// $c000: SEI ; loop: JSR $c010 ; JMP loop      $c010: INC $c100 ; RTS
const PROGRAM = { 0xc000: "782010c04c01c0", 0xc010: "ee00c160" };

test("a busy routine tops the profile and the memmap shows its accesses", { skip: liveSkip, timeout: 90_000 }, async () => {
  await session.handle("execution", { action: "pause", space: "c64" });
  for (const [address, data] of Object.entries(PROGRAM)) await session.handle("memoryWrite", { address: Number(address), data, space: "c64", view: "cpu" });
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc000 } });
  await session.handle("memmap", { action: "clear" });
  await session.handle("execution", { action: "advance-frames", count: 100, space: "c64" });

  const { entries } = (await session.handle("profile", { action: "read", limit: 5 })) as { entries: ProfileEntry[] };
  const routine = entries.find((entry) => entry.address === 0xc010);
  assert.ok(routine !== undefined, JSON.stringify(entries));
  assert.ok(BigInt(routine.selfCycles) > 0n);

  // After a clear, the profile counts only what runs after it.
  assert.deepEqual(await session.handle("profile", { action: "clear" }), { cleared: true });
  await session.handle("execution", { action: "advance-frames", count: 1, space: "c64" });
  const { entries: fresh } = (await session.handle("profile", { action: "read", limit: 5 })) as { entries: ProfileEntry[] };
  const again = fresh.find((entry) => entry.address === 0xc010);
  assert.ok(again !== undefined && BigInt(again.totalCycles) < BigInt(routine.totalCycles), JSON.stringify(fresh));

  const { ranges } = (await session.handle("memmap", { action: "read", start: 0xc000, end: 0xc1ff, maxRanges: 50 })) as { ranges: MemmapRange[] };
  const covering = (address: number) => ranges.find((range) => range.start <= address && address <= range.end);
  assert.ok((covering(0xc010)!.flags & COVERAGE.ramExecute) !== 0, JSON.stringify(ranges));
  assert.ok((covering(0xc100)!.flags & COVERAGE.ramWrite) !== 0, "INC writes $c100");
  assert.equal(covering(0xc100)!.flags & EXECUTE, 0);
  assert.equal(covering(0xc080), undefined, "an untouched address is in no range");

  await session.handle("memmap", { action: "clear" });
  const { ranges: cleared } = (await session.handle("memmap", { action: "read", start: 0xc000, end: 0xc1ff, maxRanges: 50 })) as { ranges: MemmapRange[] };
  assert.deepEqual(cleared, []);
});
