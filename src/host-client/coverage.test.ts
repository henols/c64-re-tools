import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "../c64.ts";
import { markIoRamWrites, readCoverage, writtenBlocks } from "./coverage.ts";

test("a run of writes under the I/O area with a changed byte is RAM written; a run of register writes is not", () => {
  const map = new Uint8Array(0x10000);
  map.fill(COVERAGE.ioWrite, 0xd000, 0xd02f); // the VIC-II registers: no RAM changed
  map.fill(COVERAGE.ioWrite, 0xd800, 0xd900); // RAM writes that VICE maps as I/O
  const before = new Uint8Array(0x1000);
  const after = Uint8Array.from(before);
  after.fill(0x55, 0x810, 0x820); // the other bytes of the run were written with the value that was there
  after[0xa00] = 0x01; // a change that the map does not show
  markIoRamWrites(map, before, after);
  assert.deepEqual(writtenBlocks(map, 1), [
    { start: 0xd800, end: 0xd8ff },
    { start: 0xda00, end: 0xda00 },
  ]);
});

test("written blocks are runs of RAM writes of at least the minimum size", () => {
  const map = new Uint8Array(0x10000);
  map.fill(COVERAGE.ramWrite, 0xc000, 0xc080); // an unpacked stage: 128 bytes
  map.fill(COVERAGE.ramWrite, 0x0900, 0x0902); // a self-modified operand: 2 bytes
  map.fill(COVERAGE.ioWrite, 0xd000, 0xd040); // I/O writes are no RAM writes
  assert.deepEqual(writtenBlocks(map, 64), [{ start: 0xc000, end: 0xc07f }]);
  assert.deepEqual(writtenBlocks(map, 2).length, 2);
});

test("the coverage map is read again from next until no more ranges follow", async () => {
  // One range for each executed byte in $2000-$27ff: more ranges than one read gives.
  const executed = Array.from({ length: 0x800 }, (_, index) => ({ start: 0x2000 + index, end: 0x2000 + index, flags: COVERAGE.ramExecute }));
  const reads: number[] = [];
  const memmap = async ({ start, maxRanges }: { start: number; maxRanges: number }) => {
    reads.push(start);
    const rest = executed.filter((range) => range.start >= start);
    return rest.length > maxRanges ? { ranges: rest.slice(0, maxRanges), next: rest[maxRanges]!.start } : { ranges: rest };
  };
  const map = await readCoverage({ memmap } as unknown as Parameters<typeof readCoverage>[0]);
  assert.deepEqual([map[0x1fff], map[0x2000], map[0x27ff], map[0x2800]], [0, COVERAGE.ramExecute, COVERAGE.ramExecute, 0]);
  assert.deepEqual(reads, [0x0000, 0x2000 + 1000, 0x2000 + 2000]);
});
