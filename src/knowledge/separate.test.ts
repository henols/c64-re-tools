import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "../cpu/coverage.ts";
import { separate, tableReach } from "./separate.ts";

/** A chain of `count` routines of JSR next / RTS from $1000: each one calls the next. */
function chain(count: number) {
  const memory = new Uint8Array(0x10000);
  const codeRegions: Array<{ start: number; end: number; type: string }> = [];
  const references: Array<{ from: number; to: number; kind: string }> = [];
  for (let index = 0; index < count; index++) {
    const at = 0x1000 + index * 4;
    memory.set([0x20, (at + 4) & 0xff, (at + 4) >> 8, 0x60], at);
    codeRegions.push({ start: at, end: at + 3, type: "code" });
    if (index + 1 < count) references.push({ from: at, to: at + 4, kind: "call" });
  }
  return { memory, codeRegions, references, segments: [{ start: 0x1000, end: 0x1000 + count * 4 - 1 }] };
}

test("a root of the input reaches code that the entry does not reach", () => {
  const input = chain(3);
  input.references = [];
  const plain = separate({ ...input, entry: 0x1000 });
  assert.deepEqual(plain.codeRegions.map((region) => region.reachable), [true, false, false]);
  const rooted = separate({ ...input, entry: 0x1000, roots: [{ address: 0x1008, from: "executed code" }] });
  assert.deepEqual(rooted.codeRegions.map((region) => region.reachable), [true, false, true]);
  assert.deepEqual(rooted.roots.at(-1), { address: 0x1008, from: "executed code" });
});

test("5000 regions in a call chain are all reached in less than a second", () => {
  const input = chain(5000);
  const started = performance.now();
  const found = separate({ ...input, entry: 0x1000 });
  assert.ok(performance.now() - started < 1000, `it took ${performance.now() - started} ms`);
  assert.ok(found.codeRegions.every((region) => region.reachable === true));
});

test("the targets of a table of addresses that a run read are roots, and a reference into a table goes on to its targets", () => {
  const input = chain(4);
  input.references = [];
  // A table at $1020 of the routines at $1008 and $100c, and one at $1024 of $1004 and $0000 (no code).
  input.memory.set([0x08, 0x10, 0x0c, 0x10], 0x1020);
  input.memory.set([0x04, 0x10, 0x00, 0x00], 0x1024);
  input.segments = [{ start: 0x1000, end: 0x1027 }];
  const tables = [
    { start: 0x1020, end: 0x1023, type: "addresses" },
    { start: 0x1024, end: 0x1027, type: "addresses" },
  ];
  const coverage = new Uint8Array(0x10000);
  coverage[0x1000] = COVERAGE.ramExecute;
  assert.deepEqual(separate({ ...input, entry: 0x1000, tables, coverage }).codeRegions.map((region) => region.reachable), [true, false, false, false], "no run read a table");
  coverage[0x1022] = COVERAGE.ramRead;
  const read = separate({ ...input, entry: 0x1000, tables, coverage });
  assert.deepEqual(read.codeRegions.map((region) => region.reachable), [true, false, true, true]);
  assert.deepEqual(read.roots.slice(1), [{ address: 0x1008, from: "table entry" }, { address: 0x100c, from: "table entry" }]);
  // The code at $1000 refers to the second table: its code target is reached through the reference, and $0000 is no root.
  const referred = separate({ ...input, entry: 0x1000, tables, references: [{ from: 0x1000, to: 0x1024, kind: "pointer" }] });
  assert.deepEqual(referred.codeRegions.map((region) => region.reachable), [true, true, false, false]);
  assert.deepEqual(referred.roots, [{ address: 0x1000, from: "entry" }]);
});

test("tableReach: a use that overlaps a table goes to each target, a table of jumps has a target each three bytes, and a table outside one segment leads nowhere", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([0x00, 0x20, 0x10, 0x20], 0x1000);
  const coverage = new Uint8Array(0x10000);
  coverage[0x1001] = COVERAGE.ramRead;
  const segments = [{ start: 0x1000, end: 0x10ff }];
  const tables = [
    { start: 0x1000, end: 0x1003, type: "addresses" },
    { start: 0x1010, end: 0x1018, type: "jumps" },
    { start: 0x1020, end: 0x1021, type: "bytes" },
    { start: 0x10fe, end: 0x1101, type: "addresses" },
  ];
  // An indexed read of table-1 starts before the table and ends inside it. The use at $10a0 is only in the bytes and in the table across the segment end.
  const uses = [{ from: 0x1080, start: 0x0fff, end: 0x1000 }, { from: 0x1090, start: 0x1013, end: 0x1013 }, { from: 0x10a0, start: 0x1020, end: 0x1100 }];
  assert.deepEqual(tableReach({ tables, uses, segments, memory, coverage }), {
    roots: [{ address: 0x2000, from: "table entry" }, { address: 0x2010, from: "table entry" }],
    flows: [
      { from: 0x1080, to: 0x2000 }, { from: 0x1080, to: 0x2010 },
      { from: 0x1090, to: 0x1010 }, { from: 0x1090, to: 0x1013 }, { from: 0x1090, to: 0x1016 },
    ],
  });
  // Without a read in the coverage, no target is a root.
  assert.deepEqual(tableReach({ tables, uses: [], segments, memory }), { roots: [], flows: [] });
});
