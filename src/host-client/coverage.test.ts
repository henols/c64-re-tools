import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "../c64.ts";
import { executedIn, writtenBlocks } from "./coverage.ts";

test("written blocks are runs of RAM writes of at least the minimum size, and executedIn finds RAM code in them", () => {
  const map = new Uint8Array(0x10000);
  map.fill(COVERAGE.ramWrite, 0xc000, 0xc080); // an unpacked stage: 128 bytes
  map.fill(COVERAGE.ramWrite, 0x0900, 0x0902); // a self-modified operand: 2 bytes
  map.fill(COVERAGE.ioWrite, 0xd000, 0xd040); // I/O writes are no RAM writes
  map[0xc010]! |= COVERAGE.ramExecute;
  assert.deepEqual(writtenBlocks(map, 64), [{ start: 0xc000, end: 0xc07f }]);
  assert.deepEqual(writtenBlocks(map, 2).length, 2);
  assert.equal(executedIn(map, { start: 0xc000, end: 0xc07f }), true);
  assert.equal(executedIn(map, { start: 0x0900, end: 0x0901 }), false);
});
