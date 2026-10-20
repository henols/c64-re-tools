import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "../c64.ts";
import { markIoRamWrites, writtenBlocks } from "./coverage.ts";

test("a changed byte of the RAM under the I/O area is a RAM write, an unchanged one is not", () => {
  const map = new Uint8Array(0x10000);
  map.fill(COVERAGE.ioWrite, 0xd000, 0xd030); // the VIC-II registers, and RAM writes that VICE maps as I/O
  const before = new Uint8Array(0x1000);
  const after = Uint8Array.from(before);
  after.fill(0x55, 0x10, 0x20);
  markIoRamWrites(map, before, after);
  assert.deepEqual(writtenBlocks(map, 1), [{ start: 0xd010, end: 0xd01f }]);
});

test("written blocks are runs of RAM writes of at least the minimum size", () => {
  const map = new Uint8Array(0x10000);
  map.fill(COVERAGE.ramWrite, 0xc000, 0xc080); // an unpacked stage: 128 bytes
  map.fill(COVERAGE.ramWrite, 0x0900, 0x0902); // a self-modified operand: 2 bytes
  map.fill(COVERAGE.ioWrite, 0xd000, 0xd040); // I/O writes are no RAM writes
  assert.deepEqual(writtenBlocks(map, 64), [{ start: 0xc000, end: 0xc07f }]);
  assert.deepEqual(writtenBlocks(map, 2).length, 2);
});
