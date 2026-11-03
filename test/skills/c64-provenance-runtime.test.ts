// The first access of a range in a run of c64-provenance: the coverage flags
// at a stop, and the instruction that made the access when they show a read
// and a write.

import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import { accessOf } from "../../skills/c64-provenance/scripts/lib/runtime.ts";

test("a read and a write at one stop are a write for a store and a read for a read-modify-write", () => {
  const both = COVERAGE.ramRead | COVERAGE.ramWrite;
  // Bruce Lee: STA ($06),Y at $4898 makes a dummy read at its target before the write.
  assert.equal(accessOf(both, 0x91), "write", "STA (zp),Y");
  assert.equal(accessOf(both, 0x9d), "write", "STA abs,X");
  assert.equal(accessOf(both, 0x9f), "write", "SHA abs,Y, an undocumented store");
  assert.equal(accessOf(both, 0xee), "read", "INC abs reads first");
  assert.equal(accessOf(both), "read", "without the instruction, the read is first");
  assert.equal(accessOf(both | COVERAGE.ramExecute, 0x91), "execute");
  assert.equal(accessOf(COVERAGE.ramRead, 0x91), "read", "a store decides only a read and a write");
  assert.equal(accessOf(COVERAGE.ioWrite), "write");
  assert.equal(accessOf(0), "none");
});
