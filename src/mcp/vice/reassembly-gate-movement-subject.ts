// reassembly-gate-movement-subject.ts -- the ONE movement subject the
// reassembly gate's movement transform was proven against: an
// absolute-indexed entry load, a two-entry `lo_hi_address` split table, and
// the two one-byte routines the table dispatches to.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// This subject was declared once, inline, in the test file that proved the
// relocation transform. A later measurement that needs to run the SAME
// relocation for real -- rather than invent a second, undocumented subject
// carrying its own address layout and its own split-table shape -- needs a
// way to reuse it that does not also duplicate the bytes by hand, since a
// hand copy of an address layout and a split-address table is exactly the
// kind of duplication that silently drifts the moment either copy changes.
// This file is that reuse point: the subject's construction, lifted out of
// its original test file into a small exported module, so a second consumer
// imports the identical document, image, delta and reference sites instead
// of re-declaring them.
//
// WHY A SEPARATE MODULE RATHER THAN IMPORTING THE `.test.ts` FILE DIRECTLY
// ---------------------------------------------------------------------------
// Importing a `.test.ts` module for its exports also re-runs every top-level
// `node:test` `test(...)` call that module registers, as an import side
// effect -- silently duplicating that file's own test execution inside
// whatever imports it. This is the exact reason `acme-verify.ts` and
// `acme-gate.ts` both state, in their own headers, for staying plain `.ts`
// modules rather than `.test.ts` ones. This file registers no `test(...)`
// call of any kind, so two test files importing it run nothing twice.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
// The movement subject's document, its image, the symbol it exercises
// relocating, the delta that changes both address octets, and the two
// declared reference sites inside the split table.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never add a `test(...)` call to this file. Doing so would turn every
//     importer of this module into a second, silent runner of that test.
//   - Never change a byte, an address or the delta here without re-running
//     every test that imports this module -- the whole point of one shared
//     declaration is that a change to it is visible everywhere it is used.
//   - Never carry this project's own planning bookkeeping in this file.
import type { StoreExportDocument } from "./anno-store-export.ts";
import { STORE_EXPORT_SCHEMA_VERSION } from "./anno-store-export.ts";
import type { RelocationSite } from "./reassembly-gate-movement.ts";

/** Image origin: $0801. */
export const MOVEMENT_ORIGIN = 0x0801;

/**
 * An entry block ($0801-$0806): `ldx #$00` / `lda table,x` / `rts` -- an
 * absolute-INDEXED load that reads the split-address table by name; the
 * table itself ($0807-$080A, `lo_hi_address`), labelled `table`, holding both
 * routines' addresses low-then-high; and two one-byte `rts` routines,
 * `routine_a` ($080B) and `routine_b` ($080C), each its own range.
 */
export function movementDocument(): StoreExportDocument {
  return {
    schemaVersion: STORE_EXPORT_SCHEMA_VERSION,
    store: "movement-subject.annostore",
    ranges: [
      { start: 0x0801, endInclusive: 0x0806, dataType: "code", bank: null, provenance: "derived" },
      { start: 0x0807, endInclusive: 0x080a, dataType: "lo_hi_address", bank: null, provenance: "derived" },
      { start: 0x080b, endInclusive: 0x080b, dataType: "code", bank: null, provenance: "derived" },
      { start: 0x080c, endInclusive: 0x080c, dataType: "code", bank: null, provenance: "derived" },
    ],
    labels: [
      { address: 0x0807, name: "table", kind: "User", bank: null },
      { address: 0x080b, name: "routine_a", kind: "User", bank: null },
      { address: 0x080c, name: "routine_b", kind: "User", bank: null },
    ],
    comments: [],
    projectEnums: [],
    enumUsage: [],
    xrefs: [],
    execObservations: [],
    scopes: [],
  };
}

/** `ldx #$00` / `lda $0807,x` / `rts` / tbl_lo (`<routine_a, <routine_b`) /
 * tbl_hi (`>routine_a, >routine_b`) / `rts` (routine_a) / `rts` (routine_b).
 * $0807 is `table`'s own address -- an in-tree absolute-indexed reference,
 * resolved through the same symbol/in-tree rule the code path already uses. */
export function movementImage(): Uint8Array {
  return new Uint8Array([
    0xa2, 0x00, // ldx #$00
    0xbd, 0x07, 0x08, // lda $0807,x  (table)
    0x60, // rts
    0x0b, 0x0c, // tbl_lo: <routine_a ($0b), <routine_b ($0c)
    0x08, 0x08, // tbl_hi: >routine_a ($08), >routine_b ($08)
    0x60, // routine_a: rts
    0x60, // routine_b: rts
  ]);
}

/** The two declared reference sites for `routine_a` inside the table: its
 * low octet at $0807 (the table's first byte) and its high octet at $0809
 * (the table's third byte, the start of the high run). Both DECLARED, never
 * derived from the exporter's own symbolisation. */
export const ROUTINE_A_SITES: readonly RelocationSite[] = [
  { address: 0x0807, encoding: "lowByte", symbolName: "routine_a" },
  { address: 0x0809, encoding: "highByte", symbolName: "routine_a" },
];

/** A delta that changes BOTH octets of `routine_a`'s address: $080B -> $0910
 * (low $0B -> $10, high $08 -> $09). A whole multiple of 256 would leave the
 * low half unchanged and make a half-move in that direction undetectable. */
export const MOVEMENT_DELTA = 0x0910 - 0x080b;
