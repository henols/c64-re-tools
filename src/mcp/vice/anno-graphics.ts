#!/usr/bin/env node
// anno-graphics.ts
//
// Phase 37, plan 37-07 (AUTO-06): derives the VIC-II graphics areas -- screen
// matrix, character set or bitmap, and sprite POINTERS -- from RECOVERED VIC
// register VALUES, never from cross-references. The chip fetches its
// character/bitmap/screen data by direct memory access, so a character set
// may be referenced by NO INSTRUCTION ANYWHERE IN THE PROGRAM -- exactly the
// case a cross-reference-driven join structurally cannot find. That is
// AUTO-06's entire reason to exist (`37-RESEARCH.md` SS E: no existing code in
// this repository decodes these three registers for this purpose -- the
// stock-backend modules that name them read LIVE emulator state for a
// different question).
//
// THIS MODULE TAKES PLAIN REGISTER-WRITE VALUES AND RETURNS PLAIN RANGES --
// AND NOTHING ELSE (D-37-26). It never receives a store handle, never opens
// or names `node:sqlite`, never imports `anno-store.ts`, `anno-join.ts`, or
// any module that reads the stored cross-reference graph, and never imports
// `hostpath.ts`/`containerpath.ts` or the emulator backend
// (`stock-vicii.ts`/`stock-sprites.ts`). A module that could see the
// reference graph would let an implementation quietly lean on it for the
// very case this derivation exists to cover -- so its import list is scanned
// structurally (`anno-graphics.test.ts`) rather than merely reviewed.
//
// SPRITE BITMAP LOCATIONS ARE OUT OF SCOPE (D-37-29): this module derives the
// eight-byte sprite POINTER TABLE range only. The pointer VALUES themselves
// are program data, usually written at run time, and are not register values
// a static analysis recovers -- this module must never appear to promise
// them.
//
// A MISSING REGISTER IS A STATED ABSENCE, NEVER A DEFAULT (D-37-28): where a
// required register value was never recovered, the ranges that depend on it
// are omitted from that map and the map names the missing register in
// `missingRegisters`. Power-on defaults exist and are well known, which is
// exactly why substituting one is tempting and wrong: a range built on an
// assumed value is indistinguishable in the output from one built on a
// recovered value, and this phase exists to prevent exactly that class of
// confident wrong output.
//
// SEVERAL COMBINATIONS ARE SEVERAL MAPS, NEVER ONE MERGED MAP (D-37-27): a
// program that reprograms bank, screen or charset per raster split has
// several valid graphics maps, and a single derived map would be wrong for
// all but one -- the same path-dependence limit AUTO-05 names for the
// processor port. `deriveGraphicsRanges()` returns one map per DISTINCT
// combination of the three registers' own recovered values: the cross
// product of each register's own distinct-value set, with a register that
// carries zero facts contributing a single "missing" slot rather than an
// axis (never a synthesized value). Combinations are produced in ascending
// tuple order (missing sorts first), so two runs over the same facts return
// deeply equal arrays.
//
// NO GRAPHICS-SPECIFIC DATA TYPE EXISTS (D-37-30): the store's `DataType`
// vocabulary (`anno-types.ts`) is a frozen twelve with no graphics-specific
// member, and widening it is a schema decision no plan in this phase makes --
// widening it would require re-auditing every consumer of that frozen list,
// including `dxa-blocks.ts`'s own derivation of which types are data-bearing.
// Every range this module emits therefore carries the closest existing
// member, `"byte"`.
//
// BIT ARITHMETIC CROSS-CHECKED AGAINST `stock-vicii.ts`/`stock-sprites.ts`
// (READ-ONLY, NEVER IMPORTED): this module's bank/screen/charset/bitmap
// arithmetic was checked by hand against those two files' existing, tested
// decode of the SAME three registers for the live-emulator backend, and
// found to agree exactly -- see the plan 37-07 SUMMARY for the comparison.
// This module REIMPLEMENTS that arithmetic rather than importing it, because
// importing either file would reach the emulator backend's own transport
// seam, which this module must never touch.
//
// WHAT NOT TO DO:
//   - Never derive `kind` from a range's own size, or vice versa. The mode
//     bit decides `kind`; `kind` then decides size. Deriving the kind from
//     the size would make a wrong mode bit produce a plausible range of the
//     wrong length rather than a visibly wrong kind.
//   - Never merge two distinct register-value combinations into one map.
//     Each combination this module observes gets its own entry in the
//     returned array, even when two combinations' ranges happen to overlap.
//   - Never widen `missingRegisters` handling to substitute a guessed value
//     "just this once" -- every range depending on a missing register is
//     omitted, with no exception.

import type { DataType } from "./anno-types.ts";

/** The address of the CIA2 Data Port A register (VIC bank select, bits 0-1)
 * this module watches. Matches `CONST_WRITE_WATCHED_ADDRESSES` in
 * `anno-import.ts` (kept in step there, not re-imported here -- see the
 * module header on why this file imports nothing from that module). */
export const BANK_SELECT_ADDRESS = 0xdd00;
/** The address of the VIC-II memory setup register (screen/charset-or-bitmap
 * pointers) this module watches. */
export const MEMORY_CONTROL_ADDRESS = 0xd018;
/** The address of VIC-II control register #1 (bit 5: bitmap mode) this
 * module watches. */
export const CONTROL_REGISTER_1_ADDRESS = 0xd011;

/** The three watched registers' own stable names, used both as
 * `GraphicsMap.registerValues`/`missingRegisters` keys and as
 * `GraphicsRange.derivedFrom` keys -- one place names them so a caller sees
 * the identical string whichever field it reads. */
const REGISTER_NAMES: Readonly<Record<number, string>> = Object.freeze({
  [BANK_SELECT_ADDRESS]: "bank-select",
  [MEMORY_CONTROL_ADDRESS]: "memory-control",
  [CONTROL_REGISTER_1_ADDRESS]: "control-register-1",
});

const BANK_SELECT_NAME = REGISTER_NAMES[BANK_SELECT_ADDRESS]!;
const MEMORY_CONTROL_NAME = REGISTER_NAMES[MEMORY_CONTROL_ADDRESS]!;
const CONTROL_REGISTER_1_NAME = REGISTER_NAMES[CONTROL_REGISTER_1_ADDRESS]!;

/** 16 KB per VIC-II bank ($DD00 bits 0-1, four banks). */
const VIC_BANK_SIZE = 16384;
/** $D018's high nibble is a screen-pointer unit of this many bytes. */
const SCREEN_MATRIX_GRANULARITY = 1024;
/** The fixed size of the screen matrix itself. */
const SCREEN_MATRIX_SIZE = 1024;
/** $D018's low nibble's upper three bits are a character/bitmap-pointer unit
 * of this many bytes. */
const CHARACTER_BASE_GRANULARITY = 2048;
/** The fixed size of a character set (256 characters, 8 bytes each). */
const CHARACTER_SET_SIZE = 2048;
/** The fixed size of a hi-res/multicolour bitmap. */
const BITMAP_SIZE = 8192;
/** The sprite pointer table's fixed offset from the screen matrix base. */
export const SPRITE_POINTER_OFFSET = 0x3f8;
/** The sprite pointer table's fixed size -- eight pointer bytes, one per
 * sprite. */
const SPRITE_POINTER_SIZE = 8;

/** The existing, byte-shaped `DataType` every range this module emits
 * carries (D-37-30). */
const GRAPHICS_DATA_TYPE: DataType = "byte";

/** One recovered register write, in the same shape `ConstWriteFact` in
 * `anno-import.ts` exports (`{ storeAddress, targetAddress, value }`).
 * Declared locally -- not imported -- so this module's own import list stays
 * free of any dependency on `anno-import.ts` (see the module header); plain
 * structural typing means a caller can still pass `ConstWriteFact[]`
 * directly with no translation layer. */
export interface GraphicsConstWriteFact {
  storeAddress: number;
  targetAddress: number;
  value: number;
}

/** One derived graphics range. Shaped to match `dxa-blocks.ts`'s
 * `KnownDataRow` (`start`/`endInclusive`/`dataType`) so a caller can produce
 * a `KnownDataRow` from one without a translation layer -- `kind` and
 * `derivedFrom` are this module's own additions, carrying which of the four
 * things the range is and which register values produced it. Both ends are
 * INCLUSIVE. */
export interface GraphicsRange {
  start: number;
  endInclusive: number;
  kind: string;
  dataType: DataType;
  derivedFrom: Record<string, number>;
}

/** One derived graphics map -- the ranges implied by one distinct
 * combination of the three registers' own recovered values.
 * `registerValues` carries every register value THIS map actually had;
 * `missingRegisters` names, by `REGISTER_NAMES`'s own spelling, every
 * register this map had no recovered value for at all. A non-empty
 * `missingRegisters` map carries only the ranges that did not depend on the
 * missing value(s) -- never nothing, and never a guess. */
export interface GraphicsMap {
  ranges: GraphicsRange[];
  registerValues: Record<string, number>;
  missingRegisters: string[];
}

/** VIC-II bank base: $DD00 bits 0-1, INVERTED (the chip's own convention --
 * the stored value is the complement of the bank number), times the 16 KB
 * bank size. A value with both low bits set (`0b11`) selects bank 0 (base
 * 0); a value with both low bits clear (`0b00`) selects bank 3 (the highest
 * base, $C000). Matches `stock-sprites.ts`'s `vicBank()`/`vicBankBase()`
 * exactly (read-only cross-check, never imported -- see module header). */
function vicBankBase(bankSelectValue: number): number {
  const invertedBankBits = 3 - (bankSelectValue & 0x03);
  return invertedBankBits * VIC_BANK_SIZE;
}

/** Screen matrix base: $D018's high nibble, scaled by the screen-matrix
 * granularity, added to the bank base. Matches `stock-sprites.ts`'s
 * `screenBase()`/`stock-vicii.ts`'s `memorySetup.screenOffset` exactly. */
function screenMatrixStart(bankBase: number, memoryControlValue: number): number {
  return bankBase + ((memoryControlValue >> 4) & 0x0f) * SCREEN_MATRIX_GRANULARITY;
}

/** Character-or-bitmap base: $D018's low nibble's upper three bits (bits
 * #1-#3), scaled by the character-base granularity, added to the bank base.
 * Matches `stock-vicii.ts`'s `memorySetup.charsetOffset` exactly. */
function characterOrBitmapStart(bankBase: number, memoryControlValue: number): number {
  return bankBase + ((memoryControlValue >> 1) & 0x07) * CHARACTER_BASE_GRANULARITY;
}

/** True iff $D011 bit 5 (bitmap mode) is set. Matches `stock-vicii.ts`'s
 * `control1.bitmapMode` exactly. Do not derive `kind` from a range's size --
 * this bit decides `kind`, and `kind` then decides size (module header). */
function isBitmapMode(controlRegister1Value: number): boolean {
  return ((controlRegister1Value >> 5) & 1) === 1;
}

/** Every DISTINCT value `facts` records for a write to `targetAddress`,
 * ascending. Two facts recording the SAME value are one combination axis
 * value, not two. */
function distinctValuesFor(facts: readonly GraphicsConstWriteFact[], targetAddress: number): number[] {
  const seen = new Set<number>();
  for (const fact of facts) {
    if (fact.targetAddress === targetAddress) seen.add(fact.value);
  }
  return [...seen].sort((a, b) => a - b);
}

/** One combination of the three registers' own recovered values --
 * `undefined` names a register with zero recovered facts (D-37-28). */
interface RegisterCombo {
  bankSelect: number | undefined;
  memoryControl: number | undefined;
  controlRegister1: number | undefined;
}

/** Ascending, with `undefined` (missing) sorting first -- a stated,
 * deterministic order over the tuple (D-37-27), not "whatever `Set`
 * iteration happened to produce". */
function compareSlot(a: number | undefined, b: number | undefined): number {
  const av = a ?? -1;
  const bv = b ?? -1;
  return av - bv;
}

function compareCombo(a: RegisterCombo, b: RegisterCombo): number {
  return (
    compareSlot(a.bankSelect, b.bankSelect) ||
    compareSlot(a.memoryControl, b.memoryControl) ||
    compareSlot(a.controlRegister1, b.controlRegister1)
  );
}

/** One map for one combination. Screen matrix and sprite pointers depend
 * only on `bankSelect`/`memoryControl`; the character-or-bitmap range
 * additionally depends on `controlRegister1` (the mode bit) and is omitted
 * on its own when that register alone is missing -- the other two ranges
 * still derive. A missing `bankSelect` OR `memoryControl` removes every
 * range (all three ultimately need the bank base and the screen-matrix
 * base). */
function buildGraphicsMap(combo: RegisterCombo): GraphicsMap {
  const { bankSelect, memoryControl, controlRegister1 } = combo;

  const registerValues: Record<string, number> = {};
  const missingRegisters: string[] = [];
  if (bankSelect === undefined) missingRegisters.push(BANK_SELECT_NAME);
  else registerValues[BANK_SELECT_NAME] = bankSelect;
  if (memoryControl === undefined) missingRegisters.push(MEMORY_CONTROL_NAME);
  else registerValues[MEMORY_CONTROL_NAME] = memoryControl;
  if (controlRegister1 === undefined) missingRegisters.push(CONTROL_REGISTER_1_NAME);
  else registerValues[CONTROL_REGISTER_1_NAME] = controlRegister1;

  const ranges: GraphicsRange[] = [];

  if (bankSelect !== undefined && memoryControl !== undefined) {
    const bankBase = vicBankBase(bankSelect);
    const screenStart = screenMatrixStart(bankBase, memoryControl);
    const screenAndSpriteDerivedFrom: Record<string, number> = {
      [BANK_SELECT_NAME]: bankSelect,
      [MEMORY_CONTROL_NAME]: memoryControl,
    };

    ranges.push({
      start: screenStart,
      endInclusive: screenStart + SCREEN_MATRIX_SIZE - 1,
      kind: "screen-matrix",
      dataType: GRAPHICS_DATA_TYPE,
      derivedFrom: { ...screenAndSpriteDerivedFrom },
    });

    if (controlRegister1 !== undefined) {
      const charOrBitmapStart = characterOrBitmapStart(bankBase, memoryControl);
      const bitmap = isBitmapMode(controlRegister1);
      ranges.push({
        start: charOrBitmapStart,
        endInclusive: charOrBitmapStart + (bitmap ? BITMAP_SIZE : CHARACTER_SET_SIZE) - 1,
        kind: bitmap ? "bitmap" : "character-set",
        dataType: GRAPHICS_DATA_TYPE,
        derivedFrom: {
          [BANK_SELECT_NAME]: bankSelect,
          [MEMORY_CONTROL_NAME]: memoryControl,
          [CONTROL_REGISTER_1_NAME]: controlRegister1,
        },
      });
    }

    const spriteStart = screenStart + SPRITE_POINTER_OFFSET;
    ranges.push({
      start: spriteStart,
      endInclusive: spriteStart + SPRITE_POINTER_SIZE - 1,
      kind: "sprite-pointers",
      dataType: GRAPHICS_DATA_TYPE,
      derivedFrom: { ...screenAndSpriteDerivedFrom },
    });
  }

  return { ranges, registerValues, missingRegisters };
}

/**
 * Derives the graphics areas -- screen matrix, character set or bitmap, and
 * sprite pointers -- from recovered VIC register values ALONE (D-37-26).
 * Returns one `GraphicsMap` per distinct combination of the three registers'
 * own recovered values (D-37-27), in ascending tuple order, so two calls
 * with the same `facts` return deeply equal arrays. A register with zero
 * recovered facts contributes a single "missing" combination slot rather
 * than an axis; every range depending on it is omitted from every map, and
 * the map names it in `missingRegisters` (D-37-28). `facts` carrying values
 * for addresses other than the three this module watches (e.g. the
 * processor port, $0001) are ignored -- this module only ever reads writes
 * to `BANK_SELECT_ADDRESS`/`MEMORY_CONTROL_ADDRESS`/`CONTROL_REGISTER_1_ADDRESS`.
 */
export function deriveGraphicsRanges(facts: readonly GraphicsConstWriteFact[]): GraphicsMap[] {
  const bankSelectValues = distinctValuesFor(facts, BANK_SELECT_ADDRESS);
  const memoryControlValues = distinctValuesFor(facts, MEMORY_CONTROL_ADDRESS);
  const controlRegister1Values = distinctValuesFor(facts, CONTROL_REGISTER_1_ADDRESS);

  const bankSlots: (number | undefined)[] = bankSelectValues.length > 0 ? bankSelectValues : [undefined];
  const memorySlots: (number | undefined)[] = memoryControlValues.length > 0 ? memoryControlValues : [undefined];
  const controlSlots: (number | undefined)[] = controlRegister1Values.length > 0 ? controlRegister1Values : [undefined];

  const combos: RegisterCombo[] = [];
  for (const bankSelect of bankSlots) {
    for (const memoryControl of memorySlots) {
      for (const controlRegister1 of controlSlots) {
        combos.push({ bankSelect, memoryControl, controlRegister1 });
      }
    }
  }
  combos.sort(compareCombo);

  return combos.map(buildGraphicsMap);
}
