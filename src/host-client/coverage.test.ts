import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "../cpu/coverage.ts";
import { markIoRamWrites, writtenBlocks } from "./coverage.ts";

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
