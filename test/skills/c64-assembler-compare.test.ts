// The byte check of a build (D47): against an image.json of the unpacker,
// a reference PRG, or 64 KiB of memory.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { compareBuild } from "../../skills/c64-assembler/scripts/compare.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-compare-"));
const home = process.cwd();
beforeEach(() => process.chdir(project));
afterEach(() => process.chdir(home));
after(() => rmSync(project, { recursive: true, force: true }));

const prg = (start: number, bytes: number[]) => Uint8Array.from([start & 0xff, start >> 8, ...bytes]);

test("a build is identical to a reference PRG, or names its first different byte", () => {
  writeFileSync(join(project, "ref.prg"), prg(0xc000, [1, 2, 3, 4]));
  assert.deepEqual(compareBuild(prg(0xc000, [1, 2, 3, 4]), "ref.prg"), { against: "ref.prg", identical: true, segments: [{ start: "$c000", end: "$c003", result: "identical" }] });
  const different = compareBuild(prg(0xc000, [1, 9, 3, 8]), "ref.prg");
  assert.deepEqual(different.segments, [{ start: "$c000", end: "$c003", result: "different", differences: 2, firstDifference: { address: "$c001", built: 9, reference: 2 } }]);
  assert.equal(different.identical, false);
});

test("against an image.json each segment of the capture is checked, and a segment the build does not hold is not covered", () => {
  mkdirSync(join(project, "unpacked"));
  const image = new Uint8Array(0x10000);
  image.set([1, 2, 3, 4], 0x0400);
  image.set([5, 6], 0xe000);
  writeFileSync(join(project, "unpacked", "image.bin"), image);
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ image: "image.bin", segments: [{ start: "$0400", end: "$0403" }, { start: "$e000", end: "$e001" }] }));
  const checked = compareBuild(prg(0x0400, [1, 2, 3, 4]), "unpacked/image.json");
  assert.deepEqual(checked.segments, [
    { start: "$0400", end: "$0403", result: "identical" },
    { start: "$e000", end: "$e001", result: "not covered", uncovered: 2 },
  ]);
  assert.equal(checked.identical, false, "a segment the build does not hold is no proof");
});

test("against 64 KiB of memory the assembled range is checked", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([7, 7], 0x2000);
  writeFileSync(join(project, "memory.bin"), memory);
  assert.equal(compareBuild(prg(0x2000, [7, 7]), "memory.bin").identical, true);
});
