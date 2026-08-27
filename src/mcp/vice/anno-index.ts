#!/usr/bin/env node
// anno-index.ts
//
// The ONE place that answers "which annotated range owns this address" --
// a pure, narrowest-range-wins paint index over the whole 64K address space,
// rebuilt from rows and never maintained incrementally (STORE-03).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// The resolution rule is one sentence -- the SHORTEST range covering an address
// wins, and among equally short ones the LATER-inserted (higher id) wins -- and
// it has to be checkable against a second, independently written
// implementation. That cross-check is only possible if the rule is a pure
// function of a row list: an implementation that can only be reached by writing
// to a database cannot be fed the overlapping rows the tie-break case needs,
// because the store's write path exists precisely to prevent overlapping rows
// from ever being stored.
//
// So the rule lives here, taking rows as an argument, with no filesystem, no
// SQL, and no module-level state. The store calls it over `listRanges()`
// output; a test calls it over hand-built rows the store would never produce.
// Those are the same code path, which is the property that makes the
// cross-check mean anything.
//
// Rebuilding is affordable and was measured: a full rebuild over 2,000 rows is
// 8.56 ms, so there is no performance argument for the incremental variant that
// trap 4 forbids.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each entry names a specific, measured trap
// ---------------------------------------------------------------------------
//   1. NEVER move narrowest-wins behind the store's write path. That makes the
//      equal-length tie-break unreachable: the write path's split-and-preserve
//      is DESIGNED so overlapping rows never exist on disk, and the tie-break
//      pin needs overlapping rows fed in directly. A pure module taking rows as
//      an argument is the only shape that can be tested for it.
//   2. NEVER cache this index on disk. A cached index is a second truth that
//      can disagree with the range table -- exactly the failure the
//      derived-from-bytes coverage census (`COV-01`) exists to make impossible.
//      Rebuild it; see the measurement above.
//   3. NEVER add an adjacency, coalescing or merge pass. `STORE-02` stores
//      ranges AS ranges and never merges them, so there is no splitter
//      primitive here to introduce. Merging is the named blocker behind
//      `DECOMP-01` and `BUILD-02` and the predicted over-merge bias behind
//      `COV-01`; all three are designed out by construction here, not
//      documented as hazards to remember.
//   4. NEVER maintain the index incrementally. An incremental update has to
//      know what the row it is removing was covering UNDERNEATH, which the
//      index cannot say -- a painted cell records the winner, not the losers.
//   5. NEVER let the sort's stability decide the equal-length tie-break. It is
//      pinned explicitly in the comparator below (decision `A4`) because the
//      resolution rule requires SOME pinned tie-break and a stability-derived
//      one is an implementation detail that two independent implementations
//      would not share.
import { ADDRESS_MAX, ADDRESS_MIN, AnnoAddressError, AnnoRangeShapeError } from "./anno-types.ts";

/** One entry per 6510 address, 0x0000..0xFFFF inclusive. */
export const PAINT_INDEX_SIZE = 0x10000;

/** The value a cell holds when no range covers that address. Negative so it
 * can never collide with a row id (SQLite `autoincrement` ids start at 1). */
export const NO_ROW = -1;

/** The painted index: `index[address]` is the winning row id, or `NO_ROW`.
 * `Int32Array` rather than `number[]` so 65,536 cells cost 256 KB flat and the
 * `fill()` per row is a typed-array memset rather than a per-cell loop. */
export type PaintIndex = Int32Array;

/** The minimum a row must carry to be paintable: an id and an inclusive span.
 * Deliberately NOT `RangeRow` -- the index does not read, and must not read,
 * the data type or the bank. */
export interface IndexableRange {
  id: number;
  start: number;
  endInclusive: number;
}

/**
 * Builds the paint index from `rows`. Does not mutate `rows` -- it sorts a
 * copy.
 *
 * The algorithm is one line of insight: paint LONGEST span first, so any
 * shorter range covering the same address is painted over it and therefore
 * wins. Narrowest-wins falls out of the paint order rather than being
 * re-checked per cell. Among equal-length rows the comparator orders by
 * ASCENDING id, so the HIGHER id paints last and wins -- decision `A4`,
 * "equal length, later insertion wins", pinned here rather than left to
 * `Array.prototype.sort`'s stability (trap 5).
 *
 * Refuses a row whose span leaves the address space. This is not defensive
 * decoration: `TypedArray.prototype.fill` CLAMPS out-of-range indices silently,
 * so an unrefused bad row would paint a different span than it named, or
 * nothing at all, with no error anywhere.
 */
export function buildPaintIndex(rows: readonly IndexableRange[]): PaintIndex {
  const index = new Int32Array(PAINT_INDEX_SIZE).fill(NO_ROW);

  for (const row of rows) {
    if (!Number.isInteger(row.start) || row.start < ADDRESS_MIN || row.start > ADDRESS_MAX) {
      throw new AnnoRangeShapeError(
        `range id ${row.id}: start ${String(row.start)} is outside the address space -- expected an integer ${ADDRESS_MIN}..${ADDRESS_MAX} ($0000-$ffff)`,
        { start: row.start, endInclusive: row.endInclusive },
      );
    }
    if (!Number.isInteger(row.endInclusive) || row.endInclusive < ADDRESS_MIN || row.endInclusive > ADDRESS_MAX) {
      throw new AnnoRangeShapeError(
        `range id ${row.id}: endInclusive ${String(row.endInclusive)} is outside the address space -- expected an integer ${ADDRESS_MIN}..${ADDRESS_MAX} ($0000-$ffff)`,
        { start: row.start, endInclusive: row.endInclusive },
      );
    }
    if (row.endInclusive < row.start) {
      throw new AnnoRangeShapeError(
        `range id ${row.id}: endInclusive ${row.endInclusive} is below start ${row.start} -- both ends are INCLUSIVE`,
        { start: row.start, endInclusive: row.endInclusive },
      );
    }
  }

  const ordered = [...rows].sort((a, b) => {
    const spanA = a.endInclusive - a.start + 1;
    const spanB = b.endInclusive - b.start + 1;
    if (spanA !== spanB) {
      return spanB - spanA;
    }
    return a.id - b.id;
  });

  for (const row of ordered) {
    index.fill(row.id, row.start, row.endInclusive + 1);
  }

  return index;
}

/**
 * The winning row id at `address`, or `NO_ROW` when nothing covers it. Throws
 * `AnnoAddressError` for an address outside the space rather than returning
 * `undefined` -- an out-of-range probe is a caller bug, and `undefined` would
 * be indistinguishable from "nothing here" at the call site.
 */
export function resolveAt(index: PaintIndex, address: number): number {
  if (!Number.isInteger(address) || address < ADDRESS_MIN || address > ADDRESS_MAX) {
    throw new AnnoAddressError(
      `address ${String(address)} is out of range -- expected an integer ${ADDRESS_MIN}..${ADDRESS_MAX} ($0000-$ffff)`,
      { input: address, what: "address" },
    );
  }
  return index[address];
}
