#!/usr/bin/env node
// anno-index.test.ts
//
// `STORE-03`'s proof: the narrowest-range-wins lookup is exact at every one of
// the 65,536 addresses, cross-validated against a SECOND, independently
// written implementation, with the equal-length tie-break, both inclusive
// range ends, the length-1 case and the `$FFFF` boundary each pinned
// SEPARATELY.
//
// ---------------------------------------------------------------------------
// WHY THE PINS EXIST SEPARATELY FROM THE EXHAUSTIVE LOOP
// ---------------------------------------------------------------------------
// The exhaustive agreement can be GREEN while any one of them is wrong. A
// fixture with no range touching `$FFFF` makes both implementations agree on
// `NO_ROW` there, so an exclusive paint upper bound -- which silently leaves
// the last address of every range unpainted -- is invisible to it. Agreement
// between two implementations proves that they agree, not that either is right
// at an address neither of them covers.
//
// ---------------------------------------------------------------------------
// WHY THE NON-DEGENERACY ASSERTIONS EXIST
// ---------------------------------------------------------------------------
// A fixture whose ranges never overlap makes narrowest-wins vacuous: every
// address has at most one candidate, so the two implementations would agree
// under ANY resolution rule. A fixture in which no two EQUAL-length ranges
// cover one address makes the tie-break half vacuous in the same way. Both are
// therefore measured from the fixture itself and asserted greater than zero,
// and the comparison counter is asserted to equal 65536 so a loop that
// silently visited no addresses cannot satisfy the agreement either.
//
// ---------------------------------------------------------------------------
// MEASURED COST -- why there is no MANUAL_ONLY_TESTS entry and no sampling
// ---------------------------------------------------------------------------
// Research host: the paint build over the 2,000-range fixture is 8.56 ms, the
// full 65,536-address cross-validation is 279 ms, 65,536 paint lookups alone
// are 1.30 ms, and the disagreement count is 0. 279 ms is cheap enough for the
// normal automated suite, so this file joins both `npm test` and
// `npm run test:automated` with no edit anywhere and the loop stays
// EXHAUSTIVE. `STORE-03` says "rather than by spot checks", and the
// measurement says weakening it is unnecessary.
//
// Oracle B -- `resolveByScan` below -- is the second implementation, and it is
// test-only: local to this file, never exported, never in `files[]`.
//
// No assertion in this file compares stderr to an empty string.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { NO_ROW, PAINT_INDEX_SIZE, buildPaintIndex, resolveAt, type IndexableRange } from "./anno-index.ts";
import { ADDRESS_MAX, ADDRESS_MIN, AnnoAddressError } from "./anno-types.ts";
import { codeOnly } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Oracle B -- the second, independently written implementation
// ---------------------------------------------------------------------------

/**
 * Oracle B. The winning row id at `address` by LINEAR SCAN: keep the smallest
 * span, break an equal-span tie on the higher id.
 *
 * This exists ONLY in this file. It is never exported, it never enters
 * `package.json`'s `files[]`, and the production module gains no injectable
 * comparator -- the "second, independently written implementation"
 * `STORE-03` asks for is a test artifact, not a second production strategy
 * that could disagree with the first in someone's running store.
 *
 * It shares no code path with Oracle A (the paint index): no sort, no typed
 * array, and no call into `anno-index.ts`. The tie-break is written out here
 * as an explicit length-then-id comparison rather than derived from any sort
 * order, so decision `A4` -- equal length, LATER insertion (higher id) wins --
 * is stated a second, independent time. A change to either statement of the
 * rule is caught by the other.
 */
function resolveByScan(rows: readonly IndexableRange[], address: number): number {
  let bestId = NO_ROW;
  let bestLen = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (address < row.start || address > row.endInclusive) {
      continue;
    }
    const len = row.endInclusive - row.start + 1;
    if (len < bestLen || (len === bestLen && row.id > bestId)) {
      bestLen = len;
      bestId = row.id;
    }
  }
  return bestId;
}

// ---------------------------------------------------------------------------
// The deterministic, deliberately overlapping fixture
// ---------------------------------------------------------------------------

const FIXTURE_RANGE_COUNT = 2000;

/** A small PALETTE of span sizes rather than a continuous distribution:
 * shared EXACT spans are what make equal-length overlaps plentiful, and the
 * tie-break half of the agreement is vacuous without them. The mix covers one
 * byte, tens of bytes and thousands of bytes so narrowest-wins has something
 * to decide at most addresses. */
const SPAN_PALETTE: readonly number[] = [1, 1, 2, 3, 8, 17, 64, 100, 333, 1024, 4096];

/** A plain 32-bit linear congruential step, seeded, so the fixture is
 * byte-identical on every run and a failure is reproducible. Only the HIGH 16
 * bits are consumed below -- an LCG's low bits have famously short periods and
 * would bias both the start addresses and the span choice. */
function seededSteps(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

/** ~2,000 ranges spanning `$0000-$FFFF`, DELIBERATELY overlapping. This is the
 * fixture the store's write path is designed never to produce -- split-and-
 * preserve (`STORE-02`) guarantees no two stored ranges overlap -- and feeding
 * it in directly is the whole reason `anno-index.ts` is a pure module taking
 * rows as an argument rather than a query behind the write path. */
function overlappingFixture(): readonly IndexableRange[] {
  const nextRaw = seededSteps(0x5eedc64d);
  const rows: IndexableRange[] = [];
  for (let i = 0; i < FIXTURE_RANGE_COUNT; i += 1) {
    const start = nextRaw() >>> 16;
    const span = SPAN_PALETTE[(nextRaw() >>> 16) % SPAN_PALETTE.length];
    rows.push({ id: i + 1, start, endInclusive: Math.min(start + span - 1, ADDRESS_MAX) });
  }
  return rows;
}

interface OverlapCensus {
  /** Addresses covered by two or more ranges of DIFFERENT lengths. */
  readonly differingLengthAddresses: number;
  /** Addresses covered by two or more ranges of EQUAL length. */
  readonly equalLengthAddresses: number;
}

/** Counts both non-degeneracy quantities from the fixture ALONE -- no paint
 * index, no oracle. A sweep over the address space maintaining the multiset of
 * active span lengths, so this is O(addresses + rows) rather than the
 * 131-million-comparison product a naive double loop would be. */
function fixtureOverlapCensus(rows: readonly IndexableRange[]): OverlapCensus {
  const starting = new Map<number, number[]>();
  const ending = new Map<number, number[]>();
  for (const row of rows) {
    const len = row.endInclusive - row.start + 1;
    const s = starting.get(row.start);
    if (s === undefined) starting.set(row.start, [len]);
    else s.push(len);
    const e = ending.get(row.endInclusive + 1);
    if (e === undefined) ending.set(row.endInclusive + 1, [len]);
    else e.push(len);
  }

  const active = new Map<number, number>();
  let duplicatedLengths = 0;
  let differingLengthAddresses = 0;
  let equalLengthAddresses = 0;

  for (let address = ADDRESS_MIN; address <= ADDRESS_MAX; address += 1) {
    const ends = ending.get(address);
    if (ends !== undefined) {
      for (const len of ends) {
        const n = (active.get(len) ?? 0) - 1;
        if (n === 1) duplicatedLengths -= 1;
        if (n === 0) active.delete(len);
        else active.set(len, n);
      }
    }
    const starts = starting.get(address);
    if (starts !== undefined) {
      for (const len of starts) {
        const n = (active.get(len) ?? 0) + 1;
        if (n === 2) duplicatedLengths += 1;
        active.set(len, n);
      }
    }
    if (active.size >= 2) differingLengthAddresses += 1;
    if (duplicatedLengths > 0) equalLengthAddresses += 1;
  }

  return { differingLengthAddresses, equalLengthAddresses };
}

/** How many disagreeing addresses a failure NAMES. Capped -- see the comment
 * in the cross-validation test for the measured reason. */
const FIRST_DISAGREEMENTS_REPORTED = 8;

const FIXTURE = overlappingFixture();

// ---------------------------------------------------------------------------
// 1. The exhaustive 65,536-address cross-validation
// ---------------------------------------------------------------------------

test("the paint index and an independently written linear scan agree at every one of the 65,536 addresses", () => {
  const index = buildPaintIndex(FIXTURE);

  interface Disagreement {
    address: number;
    paint: number;
    scan: number;
  }
  // The reported list is CAPPED and the total counted separately. An uncapped
  // list is not a cosmetic problem: a broken resolution rule disagrees at
  // thousands of addresses, and `assert.deepEqual`'s diff over thousands of
  // objects took 26-46 s and was killed by the OS before it could print --
  // measured, with the equal-length tie order deliberately reversed. A gate
  // whose failure cannot be RENDERED is a gate that reports nothing.
  const disagreements: Disagreement[] = [];
  let disagreementCount = 0;
  let comparisons = 0;

  for (let address = ADDRESS_MIN; address <= ADDRESS_MAX; address += 1) {
    const paint = resolveAt(index, address);
    const scan = resolveByScan(FIXTURE, address);
    comparisons += 1;
    if (paint !== scan) {
      disagreementCount += 1;
      if (disagreements.length < FIRST_DISAGREEMENTS_REPORTED) {
        disagreements.push({ address, paint, scan });
      }
    }
  }

  // The non-vacuity half, asserted FIRST: a loop that silently visited zero
  // addresses would satisfy the emptiness assertion below on its own.
  assert.equal(
    comparisons,
    0x10000,
    `the cross-validation must be EXHAUSTIVE, not sampled -- expected 65536 comparisons, performed ${comparisons}`,
  );

  // Counted first, so the failure states the SCALE, then `deepEqual` against
  // the capped list so it also NAMES addresses rather than only a number.
  // `deepEqual` goes last because it narrows its actual argument's type to
  // `never[]`.
  assert.equal(
    disagreementCount,
    0,
    `the paint index and the linear scan disagreed at ${disagreementCount} of ${comparisons} addresses; ` +
      `first ${disagreements.length}: ${JSON.stringify(disagreements)}`,
  );
  assert.deepEqual(
    disagreements,
    [],
    "each entry above is an address where the two implementations resolved different rows",
  );
});

// ---------------------------------------------------------------------------
// 2-3. The fixture is non-degenerate on BOTH axes of the resolution rule
// ---------------------------------------------------------------------------

test("the fixture is non-degenerate on the narrowest-wins axis: some address is covered by ranges of DIFFERENT lengths", () => {
  const census = fixtureOverlapCensus(FIXTURE);
  assert.ok(
    census.differingLengthAddresses > 0,
    "without an address covered by two ranges of DIFFERENT lengths, narrowest-wins has nothing to decide anywhere " +
      "and the exhaustive agreement is vacuous on that half -- two implementations would agree under ANY rule",
  );
});

test("the fixture is non-degenerate on the tie-break axis: some address is covered by two ranges of EQUAL length", () => {
  const census = fixtureOverlapCensus(FIXTURE);
  assert.ok(
    census.equalLengthAddresses > 0,
    "without an address covered by two ranges of EQUAL length, the equal-length tie-break is never exercised by the " +
      "exhaustive loop and that half of the agreement is vacuous",
  );
});

// ---------------------------------------------------------------------------
// 4. The two implementations share no code path
// ---------------------------------------------------------------------------

test("the linear-scan oracle shares no code path with the production paint index", () => {
  // Scoped to the oracle's OWN body, not to the whole file: this file
  // legitimately names `buildPaintIndex`, `resolveAt` and `Int32Array`
  // elsewhere, so a file-wide scan would be permanently red. Strict
  // `codeOnly()` mode, because the targets are code identifiers -- the prose
  // above discusses all four of them.
  const source = codeOnly(readFileSync(join(HERE, "anno-index.test.ts"), "utf8"));
  const declaration = source.indexOf("function resolveByScan");
  assert.ok(declaration >= 0, "the oracle's declaration must be findable in this file's own stripped source");
  // Inner braces are indented, so the first column-zero `}` after the
  // declaration closes the function.
  const closing = source.indexOf("\n}", declaration);
  assert.ok(closing > declaration, "the oracle's body must be extractable; an empty region would pass vacuously");
  const body = source.slice(declaration, closing + 2);
  assert.ok(body.includes("bestLen"), `the extracted region must be the real body, got ${body.length} chars`);

  for (const forbidden of ["buildPaintIndex", "resolveAt", "Int32Array", ".sort("]) {
    assert.equal(
      body.includes(forbidden),
      false,
      `the oracle must not reach for ${forbidden} -- it is the second implementation, and an implementation that ` +
        "borrows the first's algorithm or calls into it cross-validates nothing",
    );
  }
});

// ---------------------------------------------------------------------------
// 5. Pin 1 -- the $FFFF boundary, and the out-of-range refusal
// ---------------------------------------------------------------------------
//
// Every pin below uses its own small HAND-WRITTEN row set, never the
// 2,000-range fixture: a pin whose fixture is generated is a pin whose subject
// can move.

test("a range ending at 0xFFFF resolves AT 0xFFFF and the paint loop does not run off the array", () => {
  // The failure this pin exists against is an inclusive paint loop written as
  // an exclusive one. It silently leaves the LAST address of every range
  // unpainted, and it is invisible to any fixture whose ranges stop short of
  // the top of memory -- both implementations then agree on NO_ROW at 0xFFFF.
  const index = buildPaintIndex([{ id: 42, start: 0xff00, endInclusive: ADDRESS_MAX }]);

  assert.equal(resolveAt(index, ADDRESS_MAX), 42, "0xFFFF is INSIDE a range that ends at 0xFFFF");
  assert.equal(resolveAt(index, 0xff00), 42, "and so is its first address");
  assert.equal(resolveAt(index, 0xfeff), NO_ROW, "one below the range is uncovered");

  // A typed array silently IGNORES an out-of-bounds write rather than
  // throwing, so "did the paint loop run off the end" is only observable as a
  // length: a grown array would mean the paint wrote past 0xFFFF.
  assert.equal(index.length, PAINT_INDEX_SIZE, "the index is exactly one cell per address, 0x0000..0xFFFF");
});

test("resolveAt refuses an address outside 0x0000..0xFFFF with AnnoAddressError carrying the offending value", () => {
  // The refusal is at the READ side because the write side cannot report it:
  // `TypedArray.prototype.fill` clamps. Returning `undefined` here would be
  // indistinguishable from "nothing covers this address" at the call site.
  const index = buildPaintIndex([{ id: 1, start: 0x1000, endInclusive: 0x1fff }]);

  for (const offending of [PAINT_INDEX_SIZE, -1]) {
    assert.throws(
      () => resolveAt(index, offending),
      (error: unknown) => {
        assert.ok(error instanceof AnnoAddressError, `expected AnnoAddressError, got ${String(error)}`);
        assert.equal(error.input, offending, "the refusal must carry the offending value, not just a message");
        assert.equal(error.what, "address");
        return true;
      },
      `resolveAt must refuse ${offending} rather than returning a wrong row or reading out of bounds`,
    );
  }
});

// ---------------------------------------------------------------------------
// 6. Pin 2 -- both range ends inclusive, proven against a DIFFERENT row
// ---------------------------------------------------------------------------

test("start and endInclusive are BOTH inclusive, and one step either side resolves to the OUTER row", () => {
  // Deliberately stronger than the `NO_ROW` form this mirrors
  // (`block-class.test.ts`'s inclusive-ends pin): an off-by-one that shifted
  // the inner span by one address would still return NO_ROW outside the outer
  // range and hide. Against a second, longer covering row it cannot.
  const outer: IndexableRange = { id: 1, start: 0x0800, endInclusive: 0x08ff };
  const inner: IndexableRange = { id: 2, start: 0x0810, endInclusive: 0x084f };
  const index = buildPaintIndex([outer, inner]);

  assert.equal(resolveAt(index, 0x0810), inner.id, "start is inside the inner range, not one before it");
  assert.equal(resolveAt(index, 0x084f), inner.id, "endInclusive is inside the inner range, not one past it");
  assert.equal(resolveAt(index, 0x080f), outer.id, "one below the inner range belongs to the OUTER row");
  assert.equal(resolveAt(index, 0x0850), outer.id, "one above the inner range belongs to the OUTER row");
  assert.equal(resolveAt(index, 0x0830), inner.id, "and the narrower row wins in the middle");
});

// ---------------------------------------------------------------------------
// 7. Pin 3 -- length 1
// ---------------------------------------------------------------------------

test("a $0400-$0400 range has length 1 and resolves at exactly 0x0400", () => {
  const row: IndexableRange = { id: 3, start: 0x0400, endInclusive: 0x0400 };
  assert.equal(row.endInclusive - row.start + 1, 1, "length is endInclusive - start + 1; both ends are INCLUSIVE");

  const index = buildPaintIndex([row]);
  assert.equal(resolveAt(index, 0x0400), row.id);
  assert.equal(resolveAt(index, 0x03ff), NO_ROW, "and nowhere else -- not one below");
  assert.equal(resolveAt(index, 0x0401), NO_ROW, "and not one above");
});

// ---------------------------------------------------------------------------
// 8. Pin 4 -- the equal-length tie-break (decision A4)
// ---------------------------------------------------------------------------

test("two rows of EQUAL length covering one address resolve to the HIGHER id, and the oracle agrees", () => {
  // A4 is a DECISION, not a measurement. STORE-03 requires *a* pinned
  // tie-break and names none; "equal length, LATER insertion (higher id) wins"
  // is chosen because it is the cheapest rule to state independently in two
  // implementations. The rule is written once in the production comparator
  // (ascending id, so the higher id paints last) and a second, independent
  // time in this file's `resolveByScan` as an explicit length-then-id
  // comparison -- so a change to either statement is caught by the other.
  const lowFirst: readonly IndexableRange[] = [
    { id: 7, start: 0x1000, endInclusive: 0x10ff },
    { id: 9, start: 0x1000, endInclusive: 0x10ff },
  ];
  assert.equal(resolveAt(buildPaintIndex(lowFirst), 0x1080), 9, "the higher id wins an equal-length tie");
  assert.equal(resolveByScan(lowFirst, 0x1080), 9, "and the independently written oracle says the same");

  // Reversing ARRAY ORDER must not move the answer: the tie-break is pinned in
  // the comparator, NOT left to `Array.prototype.sort`'s stability or to
  // insertion order (trap 5 in anno-index.ts's header).
  const highFirst: readonly IndexableRange[] = [lowFirst[1], lowFirst[0]];
  assert.equal(resolveAt(buildPaintIndex(highFirst), 0x1080), 9, "array order must not decide an equal-length tie");
  assert.equal(resolveByScan(highFirst, 0x1080), 9);

  // The SAME two spans with a different id pair must FLIP the answer, so the
  // assertions above cannot be satisfied by a hard-coded 9. (The plan's literal
  // instruction -- "exchange the two ids and expect 7" -- cannot hold under A4:
  // exchanging 7 and 9 between two IDENTICAL spans is a no-op on the row set,
  // so the answer stays 9. Relabelling one row is the reachable form of the
  // same non-vacuity check, and it is strictly the one that matters: it proves
  // the answer TRACKS the id.)
  const relabelled: readonly IndexableRange[] = [
    { id: 7, start: 0x1000, endInclusive: 0x10ff },
    { id: 3, start: 0x1000, endInclusive: 0x10ff },
  ];
  assert.equal(resolveAt(buildPaintIndex(relabelled), 0x1080), 7, "the resolved id tracks the ids, and is not hard-coded");
  assert.equal(resolveByScan(relabelled, 0x1080), 7);
});

// ---------------------------------------------------------------------------
// 9. Pin 5 -- the empty and single-element indexes
// ---------------------------------------------------------------------------

test("buildPaintIndex([]) is a full-size index that resolves NO_ROW everywhere probed", () => {
  const index = buildPaintIndex([]);
  assert.equal(index.length, PAINT_INDEX_SIZE, "an empty row set still spans the whole address space");
  assert.equal(resolveAt(index, ADDRESS_MIN), NO_ROW, "the bottom of the space");
  assert.equal(resolveAt(index, 0x7fff), NO_ROW, "the middle of the space");
  assert.equal(resolveAt(index, ADDRESS_MAX), NO_ROW, "the top of the space");
});

test("a single-row index resolves that row inside its span and NO_ROW one step either side", () => {
  const index = buildPaintIndex([{ id: 11, start: 0x2000, endInclusive: 0x2fff }]);
  assert.equal(resolveAt(index, 0x2000), 11);
  assert.equal(resolveAt(index, 0x2800), 11);
  assert.equal(resolveAt(index, 0x2fff), 11);
  assert.equal(resolveAt(index, 0x1fff), NO_ROW, "one step below the only row");
  assert.equal(resolveAt(index, 0x3000), NO_ROW, "one step above the only row");
});

// ---------------------------------------------------------------------------
// 10. Purity -- the index must never become a SECOND truth
// ---------------------------------------------------------------------------

/** `anno-index.ts`'s own source, comment- and literal-stripped. */
function indexSource(keepLiteralBodies = false): string {
  return codeOnly(readFileSync(join(HERE, "anno-index.ts"), "utf8"), keepLiteralBodies);
}

test("anno-index.ts declares no module-level mutable binding, including a const bound to a mutable container", () => {
  // Reused from `block-class.test.ts:194-212`, whose comment must not be lost:
  // trap 3 forbids module-level MUTABLE STATE, not the `let`/`var` keywords,
  // and a `let`-only grep let the likeliest real offender straight through
  // when that scan was first written (WR-04). `const seen = new Map()` is a
  // memoising cache, IS module-level mutable state, is exactly the shape
  // someone reaches for to speed up an index rebuild, and is `const`. That
  // half must never be weakened back.
  //
  // Anchored at column zero AND allowing an `export ` prefix: this module's
  // functions hold genuine locals (`let state`-shaped loop variables are not
  // the subject), and every module-level binding here is exported, which the
  // unprefixed anchor would have missed entirely. A cached index is a second
  // answer to "what type is this address" that can disagree with the range
  // table -- the exact failure COV-01's derived-from-bytes census exists to
  // make impossible.
  const offenders = indexSource()
    .split("\n")
    .filter(
      (line) =>
        /^(?:export\s+)?(let|var)\s/.test(line) ||
        /^(?:export\s+)?const\s+\w+\s*(:[^=]*)?=\s*(new\s+(Map|Set|WeakMap|WeakSet)\b|\[|\{)/.test(line),
    );
  assert.deepEqual(offenders, [], "the index is a pure function of its rows; there is nothing to hold between calls");
});

test("anno-index.ts imports from exactly one module, anno-types.ts, and uses no dynamic import", () => {
  // Adapted from `block-class.test.ts:176-192`. `keepLiteralBodies: true` is
  // the right mode because an import specifier IS a string literal, and the
  // pattern set covers all three shapes the hand-rolled `from "`-line scan it
  // replaces could not see (WR-03): a bare `import "./x.ts"`, a single-quoted
  // specifier, and a dynamic `await import("./x.ts")`.
  //
  // NOT asserted as `import type`: `anno-index.ts` imports two ERROR CLASSES
  // it throws (`AnnoAddressError`, `AnnoRangeShapeError`), which are runtime
  // values, so a type-only import is unreachable here. Pinning the specifier
  // SET to one entry is what the constraint is actually for -- the index must
  // not acquire a runtime dependency on the store, on a decoder, or on the
  // filesystem -- and the family loop below states that directly.
  const specifiers = [
    ...indexSource(true).matchAll(
      /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm,
    ),
  ]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => specifier !== undefined);

  assert.ok(specifiers.length > 0, "the scanned set must be non-empty; a scan that saw nothing would pass vacuously");

  // The family loop runs FIRST and the `deepEqual` LAST, deliberately:
  // `deepEqual` narrows its actual argument's type, so a one-element
  // expectation makes every later read of `specifiers` a typecheck error.
  // The retired analyser family used to be listed here as a forbidden prefix.
  // It is gone from the tree entirely -- every module that carried it was
  // renamed into the `anno-` namespace or deleted -- so the entry is dropped
  // rather than re-pointed at `./anno-`, which would forbid this module's one
  // legitimate import, `./anno-types.ts`.
  for (const family of ["node:", "./anno-store", "./hostpath", "./containerpath", "./vice", "./disasm-"]) {
    assert.equal(
      specifiers.some((specifier) => specifier.startsWith(family)),
      false,
      `anno-index.ts imports from the ${family} family -- the index must have no store, no decoder and no filesystem`,
    );
  }

  // A specifier scan cannot see `import(someVariable)`, so prohibit the shape
  // itself, on strict-mode output so the prose above cannot redden this.
  assert.equal(
    /\bimport\s*\(/.test(indexSource()),
    false,
    "anno-index.ts must not use a dynamic import either -- it is an import the specifier scan cannot see",
  );

  assert.deepEqual(
    specifiers,
    ["./anno-types.ts"],
    "anno-index.ts must import from exactly one module: the type and error vocabulary, and nothing else",
  );
});
