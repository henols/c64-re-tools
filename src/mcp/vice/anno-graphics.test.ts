// anno-graphics.test.ts -- Phase 37 plan 37-07 (AUTO-06). Every `<behavior>`
// bullet is written first and checked against hand-built fact lists, per this
// plan's own TDD instruction: the committed capture
// (`fixtures/ghidra/export-bank-path-dependent.txt`) carries writes only to
// the processor port ($0001, three facts: $34/$33/$37), NEVER to $DD00/
// $D018/$D011 -- MEASURED this plan (plan 37-02's own fixture is a banking
// fixture, not a graphics one). Every register-value case below is therefore
// a hand-built fact list, and plan 37-08's own graphics-bearing fixture is
// the future real-capture case, not this one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BANK_SELECT_ADDRESS,
  CONTROL_REGISTER_1_ADDRESS,
  deriveGraphicsRanges,
  MEMORY_CONTROL_ADDRESS,
  SPRITE_POINTER_OFFSET,
} from "./anno-graphics.ts";
import type { GraphicsConstWriteFact, GraphicsMap } from "./anno-graphics.ts";
import { DATA_TYPES } from "./anno-types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ANNO_GRAPHICS_PATH = join(HERE, "anno-graphics.ts");

/** A hand-built fact list representing one complete, real-shaped
 * combination: bank 0 ($DD00 = 0x03, both low bits set), screen at
 * $D018 = 0x14 (screen offset 1 * 1024, character offset 2 * 2048), mode bit
 * clear ($D011 = 0x1b) -- a character set, not a bitmap. */
function completeFacts(): GraphicsConstWriteFact[] {
  return [
    { storeAddress: 0x1000, targetAddress: BANK_SELECT_ADDRESS, value: 0x03 },
    { storeAddress: 0x1004, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 },
    { storeAddress: 0x1008, targetAddress: CONTROL_REGISTER_1_ADDRESS, value: 0x1b },
  ];
}

// ---------------------------------------------------------------------------
// Task 1 -- the arithmetic, one rule per behaviour bullet.
// ---------------------------------------------------------------------------

test("a bank-select value with both low bits set yields bank base zero; one with both low bits clear yields the highest bank base (the inversion has a failing direction)", () => {
  const lo = deriveGraphicsRanges([
    { storeAddress: 0x1000, targetAddress: BANK_SELECT_ADDRESS, value: 0x03 },
    { storeAddress: 0x1004, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 },
  ]);
  const hi = deriveGraphicsRanges([
    { storeAddress: 0x1000, targetAddress: BANK_SELECT_ADDRESS, value: 0x00 },
    { storeAddress: 0x1004, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 },
  ]);
  assert.equal(lo.length, 1);
  assert.equal(hi.length, 1);
  const loScreen = lo[0]!.ranges.find((r) => r.kind === "screen-matrix")!;
  const hiScreen = hi[0]!.ranges.find((r) => r.kind === "screen-matrix")!;
  // bank 0's own base is 0; bank 3's own base is 3 * 16384 = 49152.
  assert.equal(loScreen.start, 0 + (0x14 >> 4) * 1024);
  assert.equal(hiScreen.start, 49152 + (0x14 >> 4) * 1024);
  assert.ok(loScreen.start < hiScreen.start);
});

test("the screen-matrix range is exactly 1024 bytes, starting at the bank base plus the high nibble times the matrix granularity", () => {
  const [map] = deriveGraphicsRanges(completeFacts());
  const screen = map!.ranges.find((r) => r.kind === "screen-matrix")!;
  assert.equal(screen.start, 0 + ((0x14 >> 4) & 0x0f) * 1024);
  assert.equal(screen.endInclusive - screen.start + 1, 1024);
  assert.deepEqual(screen.derivedFrom, { "bank-select": 0x03, "memory-control": 0x14 });
});

test("with the mode bit clear the second range is a character set of the character-set size; with it set it is a bitmap of the bitmap size", () => {
  const charsetFacts = completeFacts(); // $D011 = 0x1b, bit 5 clear
  const [charsetMap] = deriveGraphicsRanges(charsetFacts);
  const charset = charsetMap!.ranges.find((r) => r.kind === "character-set" || r.kind === "bitmap")!;
  assert.equal(charset.kind, "character-set");
  assert.equal(charset.endInclusive - charset.start + 1, 2048);

  const bitmapFacts = completeFacts();
  bitmapFacts[2] = { storeAddress: 0x1008, targetAddress: CONTROL_REGISTER_1_ADDRESS, value: 0x3b }; // bit 5 set
  const [bitmapMap] = deriveGraphicsRanges(bitmapFacts);
  const bitmap = bitmapMap!.ranges.find((r) => r.kind === "character-set" || r.kind === "bitmap")!;
  assert.equal(bitmap.kind, "bitmap");
  assert.equal(bitmap.endInclusive - bitmap.start + 1, 8192);
  // Same bank/screen base either way -- only the mode bit moved.
  assert.equal(charset.start, bitmap.start);
});

test("the sprite-pointer range is exactly eight inclusive bytes, starting at the screen-matrix base plus the fixed sprite-pointer offset", () => {
  const [map] = deriveGraphicsRanges(completeFacts());
  const screen = map!.ranges.find((r) => r.kind === "screen-matrix")!;
  const sprites = map!.ranges.find((r) => r.kind === "sprite-pointers")!;
  assert.equal(sprites.start, screen.start + SPRITE_POINTER_OFFSET);
  assert.equal(sprites.endInclusive - sprites.start + 1, 8);
});

test("two distinct recovered combinations produce two maps in ascending tuple order, each carrying its own register values, and two runs over the same facts are deeply equal", () => {
  const facts: GraphicsConstWriteFact[] = [
    { storeAddress: 0x1000, targetAddress: BANK_SELECT_ADDRESS, value: 0x03 },
    { storeAddress: 0x1004, targetAddress: BANK_SELECT_ADDRESS, value: 0x00 },
    { storeAddress: 0x1008, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 },
    { storeAddress: 0x100c, targetAddress: CONTROL_REGISTER_1_ADDRESS, value: 0x1b },
  ];
  const first = deriveGraphicsRanges(facts);
  const second = deriveGraphicsRanges(facts);
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.equal(first[0]!.registerValues["bank-select"], 0x00); // ascending: 0x00 sorts before 0x03
  assert.equal(first[1]!.registerValues["bank-select"], 0x03);
});

test("a fact list missing the bank-select register produces a map naming that register in missingRegisters, with every range that depended on it omitted -- never a power-on default", () => {
  const [map] = deriveGraphicsRanges([
    { storeAddress: 0x1004, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 },
    { storeAddress: 0x1008, targetAddress: CONTROL_REGISTER_1_ADDRESS, value: 0x1b },
  ]);
  assert.deepEqual(map!.missingRegisters, ["bank-select"]);
  assert.equal(map!.ranges.length, 0);
  assert.equal(map!.registerValues["bank-select"], undefined);
});

test("every returned range has endInclusive >= start, and every dataType is a member of the frozen DATA_TYPES vocabulary", () => {
  const maps: GraphicsMap[] = [
    ...deriveGraphicsRanges(completeFacts()),
    ...deriveGraphicsRanges([{ storeAddress: 0x1004, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x14 }]),
  ];
  let sawRange = false;
  for (const map of maps) {
    for (const range of map.ranges) {
      sawRange = true;
      assert.ok(range.endInclusive >= range.start);
      assert.ok(DATA_TYPES.includes(range.dataType), `${range.dataType} must be one of DATA_TYPES`);
    }
  }
  assert.ok(sawRange, "non-vacuity: at least one range must have been checked");
});

test("the module header states the sprite-bitmap-out-of-scope boundary and the byte-datatype choice", () => {
  const src = readFileSync(REAL_ANNO_GRAPHICS_PATH, "utf8");
  assert.match(src, /SPRITE BITMAP LOCATIONS ARE OUT OF SCOPE/);
  assert.match(src, /NO GRAPHICS-SPECIFIC DATA TYPE EXISTS/);
});
