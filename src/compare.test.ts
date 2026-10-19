// The byte check of a build: against the program in the knowledge,
// segment by segment.

import assert from "node:assert/strict";
import { test } from "node:test";

import { compareBuild, type Reference } from "./compare.ts";

const prg = (start: number, bytes: number[]) => Uint8Array.from([start & 0xff, start >> 8, ...bytes]);

/** A program with these bytes at their addresses. */
function program(...parts: Array<[number, number[]]>): Reference {
  const memory = new Uint8Array(0x10000);
  for (const [start, bytes] of parts) memory.set(bytes, start);
  return { segments: parts.map(([start, bytes]) => ({ start, end: start + bytes.length - 1 })), byteAt: (address) => memory[address]! };
}

test("a build is identical to the program, or names its first different byte", () => {
  const reference = program([0xc000, [1, 2, 3, 4]]);
  assert.deepEqual(compareBuild(prg(0xc000, [1, 2, 3, 4]), reference), { identical: true, segments: [{ start: "$c000", end: "$c003", result: "identical" }] });
  const different = compareBuild(prg(0xc000, [1, 9, 3, 8]), reference);
  assert.deepEqual(different.segments, [{ start: "$c000", end: "$c003", result: "different", differences: 2, firstDifference: { address: "$c001", built: "$09", reference: "$02" } }]);
  assert.equal(different.identical, false);
});

test("each segment of the program is checked, and a segment the build does not hold is not covered", () => {
  const checked = compareBuild(prg(0x0400, [1, 2, 3, 4]), program([0x0400, [1, 2, 3, 4]], [0xe000, [5, 6]]));
  assert.deepEqual(checked.segments, [
    { start: "$0400", end: "$0403", result: "identical" },
    { start: "$e000", end: "$e001", result: "not covered", uncovered: 2 },
  ]);
  assert.equal(checked.identical, false, "a segment the build does not hold is no proof");
});
