#!/usr/bin/env node
// dxa-blocks.ts
//
// Phase 35, plan 35-04 (DXA-03): the ONE emitter that turns the annotation
// store's frozen twelve-member `DATA_TYPES` vocabulary (`anno-types.ts`) into
// the two files dxa itself reads back -- a `-B` datablocks file (one
// `xxxx-yyyy` range per line) and a `-l` xa65-format labels file. Naming a
// range here is what makes dxa's OWN classification exclude those bytes from
// code discovery (A-11's whole point); this module writes the files, it
// never runs dxa and never observes dxa's output -- that observation belongs
// to `dxa-run.ts` (which passes these files' paths as the already-typed
// `datablocksPath`/`labelsPath` arguments `dxa.disassemble`'s allowlist
// landed in plan 35-01) and to the live tests that read dxa's listing.
//
// THIS MODULE MUST NEVER IMPORT `hostpath.ts` (mirrors `dxa-listing.ts`'s and
// `dxa-run.ts`'s own stated rule for themselves) and MUST NEVER CALL
// `node:child_process` (SEAM-05's `BANNED_COMMAND_SHAPES` already names
// `dxa`; nothing here spawns anything). It also NEVER NAMES `node:sqlite` and
// NEVER OPENS THE STORE FILE ITSELF: `anno-store.ts` is the one module
// `anno-seam.test.ts` allows to name that dependency, and this module reads
// only the ALREADY-FETCHED rows a caller passes in (typically
// `anno-store.ts`'s own `listRanges()` result, augmented with an optional
// `sym` per row for `emitLabels()`) -- it never opens the store's `.db` file,
// never imports `anno-store.ts`, and asserts nothing about how the caller got
// its rows.
//
// A-12: THE SELECTION IS DERIVED, NEVER HAND-LISTED. `DATA_BEARING_TYPES` is
// `DATA_TYPES` (the frozen twelve, `anno-types.ts`) filtered to exclude
// exactly `"code"` (bytes the store says ARE program) and `"undefined"`
// (bytes the store does not know) -- the remaining ten are every dataType the
// store already knows is data. A thirteenth member added to `DATA_TYPES`
// later is therefore caught by this derivation automatically rather than
// silently omitted from every future dxa run.
//
// A-13: THE `-B` GRAMMAR IS THE PLAIN FORM ONLY -- `xxxx-yyyy`, never `!` or
// `?`. Both stronger forms (`dxa.1`: "no vectors point here", "wholly
// unused") assert things a `dataType` alone does not tell this project, and
// the man page itself warns `?` can cause code to be listed as data. A later
// phase with a derived no-vectors-point-here fact may widen this by adding a
// field to the row shape, never by guessing from `dataType`.
//
// ADJACENCY IS SEPARATION, OVERLAP IS REFUSED. Two ranges that touch at a
// byte boundary (`1000-1fff`, `2000-2fff`) stay two lines -- coalescing them
// would erase the store's own row boundaries for no benefit, since dxa reads
// them identically either way. Two ranges that OVERLAP are a store
// inconsistency this module does not paper over: refused by name, quoting
// both, never merged and never silently dropped.
//
// ZERO SELECTED ROWS WRITES NO FILE. dxa's behaviour on an empty datablocks
// file is unmeasured, so `emitDataBlocks()`/`emitLabels()` never write one --
// the returned count is `0` and `path` is `undefined`, so the absence is
// visible in the result rather than inferred from a missing flag. It is the
// caller's job (`dxa-run.ts`) to omit the wire argument entirely on that
// result.
//
// DETERMINISM AND CONCURRENCY. Output is sorted ascending by start address
// before writing, so the same store state produces a byte-identical file on
// every run. The output path is a CALLER-SUPPLIED argument, never composed
// from a fixed name inside this module -- two invocations given different
// paths cannot collide, and a repeated call at the SAME path truncates and
// overwrites rather than appending.
//
// PHASE 37 REUSE EXPECTATION (A-11): this plan supplies known-data ranges by
// hand, from store rows an operator annotated -- `AUTO-06`'s automatic
// VIC-pointer-derived graphics ranges are Phase 37's `AUTO-07`, which is
// expected to call `emitDataBlocks()`/`emitLabels()` UNCHANGED with a
// derived row set, rather than building a second emitter.
import { writeFileSync } from "node:fs";

import { DATA_TYPES, type DataType } from "./anno-types.ts";

/** The ten `DATA_TYPES` members that are ALREADY known to be data --
 * every member of the frozen twelve EXCEPT `"code"` (program) and
 * `"undefined"` (the store does not know). See A-12 in this module's own
 * header for why this is a filter over the frozen array rather than a
 * hand-typed list. */
export const DATA_BEARING_TYPES: readonly DataType[] = Object.freeze(
  DATA_TYPES.filter((dataType) => dataType !== "code" && dataType !== "undefined"),
);

const DATA_BEARING_SET: ReadonlySet<DataType> = new Set(DATA_BEARING_TYPES);

/** One known-data row, as this module consumes it. `start`/`endInclusive`
 * mirror `anno-types.ts`'s own `RangeRow` shape (inclusive at both ends);
 * `sym`, when present, is the name `emitLabels()` binds to `start` in the
 * xa65-format labels file. A row with no `sym` is silently omitted from the
 * labels file -- never synthesised (a synthesised name would enter dxa's
 * output indistinguishable from one the store actually holds). */
export interface KnownDataRow {
  readonly start: number;
  readonly endInclusive: number;
  readonly dataType: DataType;
  readonly sym?: string;
}

export interface EmitDataBlocksResult {
  /** The number of `-B` lines written -- `0` when nothing was selected. */
  rangesCount: number;
  /** The path written, or `undefined` when `rangesCount` is `0` -- see this
   * module's header for why a zero-range result never writes a file. */
  path: string | undefined;
}

export interface EmitLabelsResult {
  /** The number of `-l` lines written -- `0` when no selected row carried a
   * `sym`. */
  count: number;
  /** The path written, or `undefined` when `count` is `0`. */
  path: string | undefined;
}

function hex4(address: number): string {
  return address.toString(16).padStart(4, "0");
}

function hexRange(start: number, endInclusive: number): string {
  return `${hex4(start)}-${hex4(endInclusive)}`;
}

/** Rows whose `dataType` is one of the ten data-bearing members -- the ONE
 * selection predicate both `emitDataBlocks()` and `emitLabels()` use, so
 * "counts as known data for this module's purposes" has exactly one
 * definition. */
function selectDataBearingRows(rows: readonly KnownDataRow[]): KnownDataRow[] {
  return rows.filter((row) => DATA_BEARING_SET.has(row.dataType));
}

/** Refuses BY NAME a row whose range is inverted (end before start) or whose
 * addresses fall outside `$0000-$ffff` -- before any line is written for it.
 * `context` names the throwing function so the message reads the same
 * `functionName: what went wrong` shape as the rest of this project's error
 * messages (e.g. `dxa-partition.ts`). */
function assertRowShape(row: KnownDataRow, context: string): void {
  if (row.start < 0x0000 || row.start > 0xffff || row.endInclusive < 0x0000 || row.endInclusive > 0xffff) {
    throw new Error(
      `${context}: row ${hexRange(row.start, row.endInclusive)} (dataType ${row.dataType}) falls outside the address space $0000-$ffff`,
    );
  }
  if (row.endInclusive < row.start) {
    throw new Error(
      `${context}: row ${hexRange(row.start, row.endInclusive)} (dataType ${row.dataType}) is inverted -- end address is before start address`,
    );
  }
}

/** Refuses BY NAME the first overlap found in `sorted` (ascending by
 * `start`), naming both ranges. Checking only CONSECUTIVE pairs after
 * sorting by start is sufficient to find every overlap in the set -- a
 * standard property of interval sets, not a shortcut that misses cases -- so
 * this never needs an O(n^2) pairwise scan. Ranges that merely TOUCH
 * (`endInclusive + 1 === nextStart`) are NOT an overlap (A-13's adjacency
 * rule) and pass through unrefused. */
function assertNoOverlaps(sorted: readonly KnownDataRow[], context: string): void {
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (b.start <= a.endInclusive) {
      throw new Error(
        `${context}: overlapping ranges ${hexRange(a.start, a.endInclusive)} and ${hexRange(b.start, b.endInclusive)} -- ` +
          "refused rather than silently merged or dropped",
      );
    }
  }
}

/**
 * Writes the ten data-bearing `DATA_TYPES` members among `rows` to
 * `outputPath` as a `-B` datablocks file: one lower-case, four-hex-digit,
 * inclusive `xxxx-yyyy` line per range, sorted ascending by start address.
 * Rows whose `dataType` is `"code"` or `"undefined"` are silently excluded
 * (they are not this module's concern); a selected row with an inverted or
 * out-of-range address, or two selected ranges that overlap, throws BEFORE
 * anything is written.
 *
 * Writes NOTHING and returns `{ rangesCount: 0, path: undefined }` when zero
 * rows are selected -- see this module's header for why an empty file is
 * never written. A repeated call with the same rows and the same
 * `outputPath` overwrites (truncates), producing a byte-identical file --
 * never appends, never accumulates.
 */
export function emitDataBlocks(rows: readonly KnownDataRow[], outputPath: string): EmitDataBlocksResult {
  const selected = selectDataBearingRows(rows);
  for (const row of selected) assertRowShape(row, "emitDataBlocks");
  const sorted = [...selected].sort((a, b) => a.start - b.start);
  assertNoOverlaps(sorted, "emitDataBlocks");

  if (sorted.length === 0) {
    return { rangesCount: 0, path: undefined };
  }

  const text = sorted.map((row) => `${hexRange(row.start, row.endInclusive)}\n`).join("");
  writeFileSync(outputPath, text);
  return { rangesCount: sorted.length, path: outputPath };
}

/**
 * Writes every data-bearing row among `rows` that carries a `sym` to
 * `outputPath` as a `-l` xa65-format labels file: `\t{name}\t= ${hex}\n`
 * (lower-case, no leading zeros -- the exact shape
 * `.planning/phases/23-.../evidence/fixture/fixture.lbl` demonstrates for a
 * comment-less row), one line per symbol-bearing row, sorted ascending by
 * address. Rows with no `sym` are omitted -- never synthesised (see this
 * module's header). A selected row with an inverted or out-of-range address
 * throws BEFORE anything is written, exactly as `emitDataBlocks()` does; no
 * overlap check applies here, since a label names a single address, not a
 * range.
 *
 * Writes NOTHING and returns `{ count: 0, path: undefined }` when no
 * selected row carries a `sym`.
 */
export function emitLabels(rows: readonly KnownDataRow[], outputPath: string): EmitLabelsResult {
  const selected = selectDataBearingRows(rows).filter((row) => row.sym !== undefined && row.sym !== "");
  for (const row of selected) assertRowShape(row, "emitLabels");
  const sorted = [...selected].sort((a, b) => a.start - b.start);

  if (sorted.length === 0) {
    return { count: 0, path: undefined };
  }

  const text = sorted.map((row) => `\t${row.sym}\t= $${row.start.toString(16)}\n`).join("");
  writeFileSync(outputPath, text);
  return { count: sorted.length, path: outputPath };
}
