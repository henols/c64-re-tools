// anno-overlap.test.ts -- the ONE file that owns overlap and adjacency
// semantics for the annotation store's range table (STORE-02, STORE-03).
//
// WHAT THIS FILE IS FOR: silently un-documenting a previously annotated region
// is the exact failure the store exists to prevent, and it has NO error
// message. A human typed a region, and a later partial overwrite either
// preserves what they said about the addresses outside the overwrite or throws
// it away -- and the difference is invisible until somebody notices, months
// later, that a region stopped being documented. So the preservation rule is
// asserted here directly, over every geometric relationship a new range can
// have with an existing one.
//
// ---------------------------------------------------------------------------
// THE FIVE OVERLAP CASES, with existing range `[a, b]` and new range `[c, d]`
// ---------------------------------------------------------------------------
//   1. identical                     `c === a && d === b`
//        -> one row, retyped
//   2. new fully CONTAINS existing   `c <= a && d >= b`
//        -> one row, retyped; the existing row is gone
//   3. new fully INSIDE existing     `a < c && d < b`   <-- LOAD-BEARING
//        -> THREE rows: `[a, c-1]` old type, `[c, d]` new type,
//           `[d+1, b]` old type
//   4. overlap at the LOW end        `c <= a && a <= d && d < b`
//        -> `[c, d]` new type, `[d+1, b]` old type
//   5. overlap at the HIGH end       `a < c && c <= b && d >= b`
//        -> `[a, c-1]` old type, `[c, d]` new type
//
// EACH GEOMETRY IS EXERCISED TWICE: once over a NON-SPLIT existing row (the
// `CASES` table below, a `byte` row retyped to `code`) and once over a SPLIT
// existing row (`SPLIT_CASES`, a `lo_hi_address` table retyped to `byte`). For
// a split row the LEGALITY OF EACH REMAINDER is part of the case's expected
// outcome, because a split-table layout needs an even byte count: the same
// geometry can be a legal three-row split or a refusal depending only on where
// the caller's boundary falls. A table that exercised the geometries over a
// non-split row alone would report full coverage of five shapes while leaving
// the entire split class untested -- which is how CR-09 survived five review
// rounds and 169 green tests.
//
// CASE 3'S PREDICATE HAS BOTH INEQUALITIES STRICT -- `a < c` AND `d < b`.
// Written with an equality at the low end (`c === a`) it is really case 4, and
// case 3 stops being tested at all: the three-row result never occurs, the
// only case whose correct answer requires BOTH a head and a tail to be
// preserved silently disappears from the table, and the planting below goes
// green on it. A five-case table whose case 3 is written weakly is a four-case
// table wearing a five-case label, and it proves nothing it claims to.
//
// ---------------------------------------------------------------------------
// THE TWO INVARIANTS, AND WHY ONE OF THEM IS NOT OPTIONAL
// ---------------------------------------------------------------------------
// INVARIANT A (no typed byte is lost): the sum of `endInclusive - start + 1`
// over `listRanges()` after the retype equals the size of
// `covered_before UNION [c, d]`. Stated as the naive "the total is UNCHANGED"
// it would be wrong in two directions at once: case 2 legitimately GROWS the
// total (the new range types addresses nothing had typed before), and -- worse
// -- the naive form is SATISFIED by a broken implementation in case 4, where
// 128 dropped tail bytes are exactly balanced by 128 newly typed low bytes.
// That balance is measured, not hypothesised, and it is asserted below as a
// named test, because it is the whole argument for invariant B.
//
// INVARIANT B (every previously typed address is still typed): the set of
// addresses the paint index resolves to a row before the retype is a SUBSET of
// the set it resolves after. This is what catches a hole that happens to
// balance on invariant A. Both invariants are asserted, in the same test, for
// every one of the five cases.
//
// ---------------------------------------------------------------------------
// PROJECT CONVENTIONS THIS FILE FOLLOWS
// ---------------------------------------------------------------------------
//   * Every temp directory is `mkdtempSync(join(tmpdir(), "anno-"))` inside a
//     `try` with an unconditional `finally rmSync(..., { recursive: true,
//     force: true })` -- `build-atomic.test.ts:44-46`'s pairing, copied
//     because `/tmp` on the development host is a tmpfs with periodic cleanup
//     disabled, so a leaked directory is leaked RAM until the next reboot.
//   * NOTHING here asserts that stderr is empty, and nothing may:
//     `node:sqlite` emits an `ExperimentalWarning` unconditionally on first
//     load, so such an assertion would fail for that alone.
//   * Everything goes through `anno-store.ts`'s exported entry points. This
//     file must never name `node:sqlite`: the store is the ONE module allowed
//     to, and `anno-seam.test.ts` fails the build if a second one does.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPaintIndex, NO_ROW, resolveAt } from "./anno-index.ts";
import {
  ADDRESS_MAX,
  ADDRESS_MIN,
  AnnoRangeShapeError,
  AnnoSplitRemainderError,
  assertRangeShape,
  isSplitDataType,
  resolveSplitTargets,
  type DataType,
  type RangeRow,
} from "./anno-types.ts";
import { applyWrite, closeStore, currentRevision, listRanges, openStore, setComment, setDataType } from "./anno-store.ts";
import { codeOnly } from "./shipped-modules.ts";
import { ViceError } from "./vice.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** One temp directory per test, removed unconditionally. */
function inTempDir(body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Opens a fresh store, runs `body`, closes it unconditionally. */
function inFreshStore(body: (store: ReturnType<typeof openStore>) => void): void {
  inTempDir((dir) => {
    const store = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    try {
      body(store);
    } finally {
      closeStore(store);
    }
  });
}

/** Invariant A's left-hand side: the total number of bytes the range table
 * claims to have typed. Rows never overlap on disk -- that is what
 * split-and-preserve is FOR -- so this sum and the covered-address count are
 * the same number, which is why a divergence between them is itself a defect. */
function totalTypedBytes(rows: readonly RangeRow[]): number {
  return rows.reduce((sum, row) => sum + row.endInclusive - row.start + 1, 0);
}

/** Invariant B's operand: every address the paint index resolves to a row.
 * Built from `listRanges()` output through the real index, so it answers the
 * same question a reader of the store would ask, not a re-derived one. */
function coveredAddresses(rows: readonly RangeRow[]): Set<number> {
  const index = buildPaintIndex(rows);
  const covered = new Set<number>();
  for (let address = ADDRESS_MIN; address <= ADDRESS_MAX; address += 1) {
    if (resolveAt(index, address) !== NO_ROW) covered.add(address);
  }
  return covered;
}

/** `|covered UNION [start, endInclusive]|` -- invariant A's right-hand side. */
function unionSize(covered: ReadonlySet<number>, start: number, endInclusive: number): number {
  const union = new Set(covered);
  for (let address = start; address <= endInclusive; address += 1) union.add(address);
  return union.size;
}

/** The addresses that HAD a type and no longer do. Non-empty is a silent
 * un-documenting, which is the whole failure this file exists to detect. */
function lostAddresses(before: ReadonlySet<number>, after: ReadonlySet<number>): number[] {
  return [...before].filter((address) => !after.has(address)).sort((x, y) => x - y);
}

/** The existing range every case starts from: `[a, b]`, 256 bytes, typed as a
 * non-code member so a retype to `code` is observably a different type. */
const A = 0x1000;
const B = 0x10ff;

interface OverlapCase {
  /** The case number from the table in this file's header. */
  readonly n: number;
  readonly name: string;
  /** `[c, d]` -- the new range. */
  readonly c: number;
  readonly d: number;
  /** The predicate, restated so a reader can check the geometry against the
   * header table without recomputing it. */
  readonly predicate: string;
}

const CASES: readonly OverlapCase[] = [
  { n: 1, name: "identical", c: A, d: B, predicate: "c === a && d === b" },
  { n: 2, name: "new fully CONTAINS existing", c: 0x0f00, d: 0x11ff, predicate: "c <= a && d >= b" },
  // BOTH INEQUALITIES STRICT. See the header: an equality at the low end turns
  // this into case 4 and the planting below goes green on it.
  { n: 3, name: "new fully INSIDE existing (LOAD-BEARING)", c: 0x1040, d: 0x107f, predicate: "a < c && d < b" },
  { n: 4, name: "overlap at the LOW end", c: 0x0f80, d: 0x107f, predicate: "c <= a && a <= d && d < b" },
  { n: 5, name: "overlap at the HIGH end", c: 0x1080, d: 0x11ff, predicate: "a < c && c <= b && d >= b" },
];

test("the five case definitions really do satisfy their own predicates -- case 3 with BOTH inequalities strict", () => {
  const byN = new Map(CASES.map((k) => [k.n, k]));
  const one = byN.get(1)!;
  assert.ok(one.c === A && one.d === B, "case 1 is the identical range");

  const two = byN.get(2)!;
  assert.ok(two.c <= A && two.d >= B, "case 2's new range fully contains the existing one");

  const three = byN.get(3)!;
  assert.ok(A < three.c, "case 3's LOW inequality is STRICT -- written as c === a this is case 4");
  assert.ok(three.d < B, "case 3's HIGH inequality is STRICT -- written as d === b this is case 5");

  const four = byN.get(4)!;
  assert.ok(four.c <= A && A <= four.d && four.d < B, "case 4 overlaps the low end and stops short of b");

  const five = byN.get(5)!;
  assert.ok(A < five.c && five.c <= B && five.d >= B, "case 5 starts inside and runs past b");

  assert.equal(CASES.length, 5, "all five cases are enumerated -- a shrunken table is a weakened proof");
});

/** What the seed range is and what the case retypes it to. Defaulted to the
 * non-split fixture the five original cases use, so every existing call site
 * reads exactly as it did before the split table was added. */
interface RunCaseOptions {
  readonly seedStart?: number;
  readonly seedEndInclusive?: number;
  readonly seedType?: DataType;
  readonly newType?: DataType;
}

interface RunCaseResult {
  before: RangeRow[];
  after: RangeRow[];
  beforeCovered: Set<number>;
  afterCovered: Set<number>;
  lost: number[];
  /** The refusal the retype threw, or `null` when it was accepted. Captured
   * rather than propagated so a REFUSING case is measured on the same path as
   * an accepted one -- the `after` values below are then the real post-refusal
   * state and can be compared with `before` directly. */
  thrown: unknown;
  revisionBefore: number;
  revisionAfter: number;
}

/** Runs one case against a retype callback and reports everything both
 * invariants need. The SAME harness drives the production path and the
 * planting, so the two results are comparable by construction rather than by
 * two hand-written measurements that could drift. It is also the ONE harness
 * for the non-split and split tables, for the same reason. */
function runCase(
  kase: { readonly c: number; readonly d: number },
  retype: (store: ReturnType<typeof openStore>, start: number, endInclusive: number, dataType: DataType) => void,
  opts: RunCaseOptions = {},
): RunCaseResult {
  const seedStart = opts.seedStart ?? A;
  const seedEndInclusive = opts.seedEndInclusive ?? B;
  const seedType = opts.seedType ?? "byte";
  const newType = opts.newType ?? "code";

  let captured!: RunCaseResult;
  inFreshStore((store) => {
    setDataType(store, { start: seedStart, endInclusive: seedEndInclusive, dataType: seedType });
    const before = listRanges(store);
    const beforeCovered = coveredAddresses(before);
    const revisionBefore = currentRevision(store);
    let thrown: unknown = null;
    try {
      retype(store, kase.c, kase.d, newType);
    } catch (e) {
      thrown = e;
    }
    const after = listRanges(store);
    const afterCovered = coveredAddresses(after);
    captured = {
      before,
      after,
      beforeCovered,
      afterCovered,
      lost: lostAddresses(beforeCovered, afterCovered),
      thrown,
      revisionBefore,
      revisionAfter: currentRevision(store),
    };
  });
  return captured;
}

/** The production retype path, through its own exported entry point. */
function productionRetype(
  store: ReturnType<typeof openStore>,
  start: number,
  endInclusive: number,
  dataType: DataType,
): void {
  setDataType(store, { start, endInclusive, dataType });
}

for (const kase of CASES) {
  test(`overlap case ${kase.n} (${kase.name}, ${kase.predicate}): both invariants hold`, () => {
    const r = runCase(kase, productionRetype);
    assert.equal(r.thrown, null, `case ${kase.n}: a NON-SPLIT existing row has no remainder rule to trip -- the retype is accepted`);

    // INVARIANT A -- no typed byte is lost. The right-hand side is the UNION,
    // not the before-total: case 2 legitimately grows the total.
    assert.equal(
      totalTypedBytes(r.after),
      unionSize(r.beforeCovered, kase.c, kase.d),
      `case ${kase.n}: the range table must claim exactly the addresses that were typed before plus the ones just typed -- ` +
        `a smaller total means a region a human annotated stopped being documented, with no error anywhere`,
    );

    // INVARIANT B -- every previously typed address is STILL typed. This is
    // the half that catches a hole balancing out on invariant A.
    assert.deepEqual(
      r.lost,
      [],
      `case ${kase.n}: every address that carried a type before the retype must still carry one afterwards`,
    );

    // ...and the addresses the caller asked for really do carry the new type.
    const index = buildPaintIndex(r.after);
    const byId = new Map(r.after.map((row) => [row.id, row]));
    for (const address of [kase.c, Math.floor((kase.c + kase.d) / 2), kase.d]) {
      const row = byId.get(resolveAt(index, address));
      assert.equal(row?.dataType, "code", `case ${kase.n}: address ${address} resolves to the newly typed row`);
    }
  });
}

test("case 3 is the LOAD-BEARING case: the fully-contained retype produces exactly THREE rows, asserted field by field", () => {
  // This is the only one of the five whose correct answer needs BOTH a head
  // and a tail preserved, and therefore the only one whose correct answer is
  // three rows. Invariant A can be satisfied by a balanced hole and invariant
  // B by coverage that holds while the BOUNDARIES are wrong, so the row shape
  // is asserted separately from either invariant.
  const kase = CASES.find((k) => k.n === 3)!;
  const r = runCase(kase, productionRetype);

  assert.equal(r.after.length, 3, "head, new range, tail -- three rows, not one");
  const shape = r.after
    .map((row) => ({ start: row.start, endInclusive: row.endInclusive, dataType: row.dataType }))
    .sort((x, y) => x.start - y.start);
  assert.deepEqual(shape, [
    { start: A, endInclusive: kase.c - 1, dataType: "byte" },
    { start: kase.c, endInclusive: kase.d, dataType: "code" },
    { start: kase.d + 1, endInclusive: B, dataType: "byte" },
  ]);
});

// ---------------------------------------------------------------------------
// PLANTING A: filter-and-insert in place of split-and-preserve.
// ---------------------------------------------------------------------------

/**
 * The implementation a maintainer reaches for when the split looks like
 * unnecessary work: delete every overlapping row, insert the new one, preserve
 * NO head and NO tail. Test-local on purpose -- it must never be reachable
 * from a shipped module.
 *
 * It is driven through `applyWrite()`, the same write sequence the production
 * path uses, so the only difference between the two measurements below is the
 * mutation itself.
 */
function retypeByFilterAndInsert(
  store: ReturnType<typeof openStore>,
  start: number,
  endInclusive: number,
  dataType: DataType,
): void {
  applyWrite(store, (db) => {
    const overlapping = db.prepare("select id from anno_range where end_inclusive >= ? and start <= ?").all(start, endInclusive) as {
      id: number;
    }[];
    for (const row of overlapping) {
      db.prepare("delete from anno_range where id = ?").run(row.id);
    }
    db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(start, endInclusive, dataType, null);
    return true;
  });
}

test("planting A, OBSERVED and SELECTIVE: filter-and-insert loses bytes in exactly the three cases that have a head or a tail, and is indistinguishable from the real path in the other two", () => {
  // MEASURED, not assumed. The measurement is the point of this test: it is
  // what makes the five-case table evidence rather than padding.
  //
  // A head exists whenever `row.start < c`; a tail whenever `row.end > d`.
  // Cases 1 and 2 have NEITHER, so filter-and-insert cannot differ from
  // split-and-preserve there -- there is nothing to preserve. Cases 3, 4 and 5
  // each have at least one, and case 3 has BOTH, which is why case 3 is the
  // one whose correct answer is three rows.
  const lostByCase = new Map<number, number>();
  const rowsByCase = new Map<number, number>();
  for (const kase of CASES) {
    const r = runCase(kase, retypeByFilterAndInsert);
    lostByCase.set(kase.n, r.lost.length);
    rowsByCase.set(kase.n, r.after.length);
  }

  assert.deepEqual(
    [...lostByCase.entries()].sort((x, y) => x[0] - y[0]),
    [
      [1, 0],
      [2, 0],
      [3, 192],
      [4, 128],
      [5, 128],
    ],
    "the planting's selectivity, measured: cases 1 and 2 have no head and no tail so nothing can be lost; " +
      "case 3 loses BOTH a 64-byte head and a 128-byte tail; cases 4 and 5 lose one side each",
  );

  // Case 3 is the only one whose CORRECT answer is three rows, and the planting
  // collapses it to one. That collapse is what a weakly written case 3 hides.
  assert.equal(rowsByCase.get(3), 1, "the planting collapses the fully-contained case to a single row");

  for (const n of [1, 2]) {
    const planted = runCase(CASES.find((k) => k.n === n)!, retypeByFilterAndInsert);
    const real = runCase(CASES.find((k) => k.n === n)!, productionRetype);
    assert.deepEqual(
      planted.after.map((row) => ({ start: row.start, endInclusive: row.endInclusive, dataType: row.dataType })),
      real.after.map((row) => ({ start: row.start, endInclusive: row.endInclusive, dataType: row.dataType })),
      `case ${n} has no head and no tail, so the planting is INDISTINGUISHABLE from the real path there -- ` +
        `which is exactly why a table missing case 3 would let it through`,
    );
  }
});

test("why invariant B is not optional, MEASURED: in case 4 the planting satisfies the naive total-unchanged metric while losing 128 addresses", () => {
  // The naive metric -- "the total number of typed bytes is UNCHANGED" -- is
  // the one an implementer reaches for first, and this is the measurement that
  // disqualifies it. In case 4 filter-and-insert drops a 128-byte tail and
  // gains 128 previously untyped low bytes; the two balance exactly, so the
  // naive total reads clean while a region a human annotated has silently
  // stopped being documented. Invariant B sees it immediately.
  const kase = CASES.find((k) => k.n === 4)!;
  const r = runCase(kase, retypeByFilterAndInsert);

  assert.equal(
    totalTypedBytes(r.after),
    totalTypedBytes(r.before),
    "the naive total-unchanged metric is SATISFIED here -- this is the false negative, not a passing case",
  );
  assert.equal(r.lost.length, 128, "invariant B catches the 128 addresses the balanced total hid");
  assert.notEqual(
    totalTypedBytes(r.after),
    unionSize(r.beforeCovered, kase.c, kase.d),
    "invariant A in its UNION form also catches it -- which is why the union form is the one asserted above",
  );
});

// ---------------------------------------------------------------------------
// PLANTING B: the contradiction query removed from the retype path.
// ---------------------------------------------------------------------------

/**
 * Split-and-preserve WITHOUT the contradicted-comment query -- the retype path
 * as it stood before the report existed. It returns the same result shape with
 * an always-empty list, which is precisely the failure mode being planted: the
 * call returns CLEAN SUCCESS and the caller has no way to know a comment it
 * relies on has just been made false.
 */
function retypeWithoutContradictionQuery(
  store: ReturnType<typeof openStore>,
  start: number,
  endInclusive: number,
  dataType: DataType,
): { changed: boolean; contradictedComments: readonly unknown[] } {
  const { result } = applyWrite(store, (db) => {
    const overlapping = db
      .prepare("select id, start, end_inclusive, data_type from anno_range where end_inclusive >= ? and start <= ? order by id")
      .all(start, endInclusive) as { id: number; start: number; end_inclusive: number; data_type: string }[];
    for (const row of overlapping) {
      db.prepare("delete from anno_range where id = ?").run(row.id);
      if (row.start < start) {
        db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(
          row.start,
          start - 1,
          row.data_type,
          null,
        );
      }
      if (row.end_inclusive > endInclusive) {
        db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(
          endInclusive + 1,
          row.end_inclusive,
          row.data_type,
          null,
        );
      }
    }
    db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(start, endInclusive, dataType, null);
    return true;
  });
  return { changed: result, contradictedComments: [] };
}

test("planting B, OBSERVED: with the contradiction query removed the identical scenario returns CLEAN SUCCESS with an empty list, while the production path reports one entry", () => {
  /** The one scenario, set up identically for both paths. */
  const scenario = (store: ReturnType<typeof openStore>): void => {
    setDataType(store, { start: 0x0810, endInclusive: 0x081f, dataType: "code" });
    setComment(store, { address: 0x0812, commentType: "line", text: "[confirmed-code] observed executing at $0812" });
  };

  let planted!: { changed: boolean; contradictedComments: readonly unknown[] };
  inFreshStore((store) => {
    scenario(store);
    planted = retypeWithoutContradictionQuery(store, 0x0810, 0x081f, "byte");
  });

  let real!: ReturnType<typeof setDataType>;
  inFreshStore((store) => {
    scenario(store);
    real = setDataType(store, { start: 0x0810, endInclusive: 0x081f, dataType: "byte" });
  });

  // THE RED. Both calls succeed and both retype the range -- the ONLY
  // observable difference is whether the caller is told that a comment it may
  // be relying on has just been made false.
  assert.equal(planted.changed, true, "the planted path succeeds");
  assert.deepEqual(planted.contradictedComments, [], "and reports NOTHING -- clean success over a loss the caller cannot see");

  assert.equal(real.changed, true, "the production path succeeds too -- the report is data, never a refusal");
  assert.equal(real.contradictedComments.length, 1, "and it reports the comment the retype just made false");
  assert.equal(real.contradictedComments[0].address, 0x0812);
  assert.equal(real.contradictedComments[0].grade, "[confirmed-code]");
  assert.equal(real.contradictedComments[0].contradictedBy, "byte");
});

// ---------------------------------------------------------------------------
// SPLIT-TABLE ROWS: THE REMAINDER RULE (CR-09).
// ---------------------------------------------------------------------------
//
// A split-table layout needs an EVEN byte count -- the low half and the high
// half must be the same length -- and `assertRangeShape()` refuses an odd one at
// the store's own entry point. Split-and-preserve re-inserts the surviving head
// and tail of an overlapped row carrying that row's own type forward, so a
// retype that lands off an entry boundary can propose a remainder that is an ODD
// split table: a row `setDataType` would refuse to create and
// `resolveSplitTargets()` cannot decode.
//
// THE RULE: the store never persists a range row it would refuse at its own
// entry point. Every remainder the split would produce is asked the SAME shape
// question -- `assertRangeShape` itself, not a second even-count test -- BEFORE
// the first delete, and an illegal one refuses the whole retype by name.
// `retype()`'s doc comment records the decision and the alternative not taken.

/** The split-table row every case in this section starts from: `$1000..$100f`
 * typed `lo_hi_address` -- 16 bytes, 8 entries, so an entry boundary falls on
 * every even offset and the two nearest legal boundaries around any odd
 * remainder are one address apart on each side. */
const SPLIT_A = 0x1000;
const SPLIT_B = 0x100f;

/** Seeds a fresh store with the split row above, through the production entry
 * point. Returns the rows and the revision as they stand before the case's own
 * retype, so a refusal can be asserted against real before-values. */
function seedSplitRow(store: ReturnType<typeof openStore>): { before: RangeRow[]; revision: number } {
  setDataType(store, { start: SPLIT_A, endInclusive: SPLIT_B, dataType: "lo_hi_address" });
  return { before: listRanges(store), revision: currentRevision(store) };
}

test("CR-09, PRODUCTION ENTRY POINTS ONLY: typing one byte inside a lo_hi_address table is REFUSED by name, and the refusal costs the store nothing", () => {
  // THE DRIVE IS THE POINT. No hand-edited store, no test-only export, no
  // `applyWrite`: two ordinary `setDataType` calls, which is what made the
  // round-5 report actionable. Before this rule existed the second call returned
  // `{ revision: 2, changed: true, contradictedComments: [] }` and left
  // `id=3 $1005..$100f lo_hi_address` -- an 11-byte split table -- on disk with
  // no diagnostic anywhere.
  inFreshStore((store) => {
    const { before, revision } = seedSplitRow(store);
    assert.deepEqual(
      before.map((row) => [row.start, row.endInclusive, row.dataType, row.bank]),
      [[SPLIT_A, SPLIT_B, "lo_hi_address", null]],
      "the seed is a single 16-byte lo_hi_address row",
    );

    let thrown: unknown = null;
    try {
      setDataType(store, { start: 0x1004, endInclusive: 0x1004, dataType: "byte" });
    } catch (e) {
      thrown = e;
    }

    assert.ok(thrown !== null, "the retype must be REFUSED -- it would leave an 11-byte lo_hi_address tail");
    assert.ok(thrown instanceof AnnoSplitRemainderError, "refused by its own name, not by a generic error");
    // IN-FAMILY, asserted rather than reasoned about: an existing caller
    // catching the shape family keeps working, and nothing escapes `ViceError`.
    assert.ok(thrown instanceof AnnoRangeShapeError, "AnnoSplitRemainderError IS a shape refusal");
    assert.ok(thrown instanceof ViceError, "and it stays inside the ViceError family");

    // BOTH NUMBERS THAT CONFLICTED, plus the legal alternatives (28-08 P2).
    const message = (thrown as Error).message;
    for (const needle of ["4096..4111", "lo_hi_address", "4101..4111", "11 byte", "tail", "4099", "even"]) {
      assert.ok(message.includes(needle), `the refusal must name ${needle}; got: ${message}`);
    }

    // THE REFUSAL COSTS NOTHING. The gate runs before the first delete, so this
    // is not a rollback claim -- nothing was ever applied.
    assert.deepEqual(listRanges(store), before, "the row set is byte-identical after the refusal, ids included");
    assert.equal(currentRevision(store), revision, "and the revision did not move");
  });
});

test("the LEGAL remainder case on the same split row: an even head and an even tail split into three rows, and every one of them is re-acceptable at setDataType", () => {
  inFreshStore((store) => {
    seedSplitRow(store);
    const result = setDataType(store, { start: 0x1004, endInclusive: 0x1007, dataType: "byte" });
    assert.equal(result.changed, true);

    const rows = listRanges(store);
    assert.deepEqual(
      rows.map((row) => ({ start: row.start, endInclusive: row.endInclusive, dataType: row.dataType, bank: row.bank })),
      [
        { start: 0x1000, endInclusive: 0x1003, dataType: "lo_hi_address", bank: null },
        { start: 0x1008, endInclusive: 0x100f, dataType: "lo_hi_address", bank: null },
        { start: 0x1004, endInclusive: 0x1007, dataType: "byte", bank: null },
      ],
      "head (4 bytes, even), tail (8 bytes, even), then the newly typed range",
    );

    // THE ROUND TRIP, on this one case: a row the store returned is a row the
    // store would accept. The class-level statement of it is the invariant
    // further down; this is the instance the gap was reported against.
    for (const row of rows) {
      setDataType(store, { start: row.start, endInclusive: row.endInclusive, dataType: row.dataType });
    }
  });
});

test("IN-06: a remainder carries the overlapped row's own `bank` forward, while the newly typed range carries null", () => {
  // THE INPUT STATE IS TEST-CONSTRUCTED AND THE READ-BACK IS NOT. MEASURED
  // AGAINST THE SOURCE: `insertRange()` is the module's ONLY range insert and it
  // binds whatever `bank` its caller passes -- and every production caller
  // passes `null` (a new range) or the overlapped row's own value (a remainder).
  // So NO production entry point can put a non-null `bank` on disk, and the
  // precondition for this claim can only be built through `applyWrite`. That
  // half is filed as a `backstop` truth in this plan's SUMMARY. What IS
  // production-driven is the preservation itself: the split below is an ordinary
  // `setDataType`, and the result is read back through `listRanges()`.
  inFreshStore((store) => {
    applyWrite(store, (db) => {
      db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(
        SPLIT_A,
        SPLIT_B,
        "lo_hi_address",
        7,
      );
      return true;
    });
    assert.deepEqual(
      listRanges(store).map((row) => [row.start, row.endInclusive, row.dataType, row.bank]),
      [[SPLIT_A, SPLIT_B, "lo_hi_address", 7]],
      "the constructed precondition: one split row carrying a NON-NULL bank",
    );

    // PRODUCTION FROM HERE ON.
    setDataType(store, { start: 0x1004, endInclusive: 0x1007, dataType: "byte" });

    assert.deepEqual(
      listRanges(store).map((row) => ({ start: row.start, endInclusive: row.endInclusive, dataType: row.dataType, bank: row.bank })),
      [
        { start: 0x1000, endInclusive: 0x1003, dataType: "lo_hi_address", bank: 7 },
        { start: 0x1008, endInclusive: 0x100f, dataType: "lo_hi_address", bank: 7 },
        { start: 0x1004, endInclusive: 0x1007, dataType: "byte", bank: null },
      ],
      "both remainders keep the overlapped row's bank; the newly typed range gets null",
    );
  });
});

/** One geometry against the SPLIT existing row, with its expected outcome. The
 * outcome is one of exactly two kinds: `rows` -- the row set asserted BY VALUE
 * in `listRanges()` order -- or `refused`, the remainder rule declining the
 * whole retype. A geometry appears TWICE where the same shape can be either,
 * depending only on which side of an entry boundary the caller's edge falls. */
interface SplitOverlapCase {
  /** The case number from the five-case table in this file's header. */
  readonly n: number;
  readonly name: string;
  /** `[c, d]` -- the new range, always retyped to `byte`. */
  readonly c: number;
  readonly d: number;
  readonly predicate: string;
  /** The expected row set, `[start, endInclusive, dataType]` each, in
   * `listRanges()` (ascending id) order. Absent for a refusing case. */
  readonly rows?: readonly (readonly [number, number, DataType])[];
  /** Set on the cases whose remainder is an odd-length split table. */
  readonly refused?: true;
  /** Which remainder is illegal, restated so the table documents the reason
   * rather than only the verdict. */
  readonly why?: string;
}

const SPLIT_CASES: readonly SplitOverlapCase[] = [
  {
    n: 1,
    name: "identical range retyped to byte",
    c: SPLIT_A,
    d: SPLIT_B,
    predicate: "c === a && d === b",
    rows: [[0x1000, 0x100f, "byte"]],
    why: "no remainder exists, so the rule cannot fire",
  },
  {
    n: 2,
    name: "new fully CONTAINS the split row",
    c: 0x0ff0,
    d: 0x101f,
    predicate: "c <= a && d >= b",
    rows: [[0x0ff0, 0x101f, "byte"]],
    why: "the split row is gone entirely -- again no remainder",
  },
  {
    n: 3,
    name: "new fully INSIDE the split row, BOTH remainders even (LOAD-BEARING)",
    c: 0x1004,
    d: 0x1007,
    predicate: "a < c && d < b",
    rows: [
      [0x1000, 0x1003, "lo_hi_address"],
      [0x1008, 0x100f, "lo_hi_address"],
      [0x1004, 0x1007, "byte"],
    ],
    why: "head 4 bytes and tail 8 bytes -- both even, both legal lo_hi_address tables",
  },
  {
    n: 3,
    name: "new fully INSIDE the split row, ODD tail remainder (the CR-09 drive)",
    c: 0x1004,
    d: 0x1004,
    predicate: "a < c && d < b",
    refused: true,
    why: "tail $1005..$100f is 11 bytes -- an odd lo_hi_address table the store refuses",
  },
  {
    n: 4,
    name: "overlap at the LOW end leaving an EVEN tail",
    c: 0x0ff8,
    d: 0x1007,
    predicate: "c <= a && a <= d && d < b",
    rows: [
      [0x1008, 0x100f, "lo_hi_address"],
      [0x0ff8, 0x1007, "byte"],
    ],
    why: "tail $1008..$100f is 8 bytes -- even",
  },
  {
    n: 4,
    name: "overlap at the LOW end leaving an ODD tail",
    c: 0x0ff8,
    d: 0x1006,
    predicate: "c <= a && a <= d && d < b",
    refused: true,
    why: "tail $1007..$100f is 9 bytes -- odd",
  },
  {
    n: 5,
    name: "overlap at the HIGH end leaving an EVEN head",
    c: 0x1008,
    d: 0x101f,
    predicate: "a < c && c <= b && d >= b",
    rows: [
      [0x1000, 0x1007, "lo_hi_address"],
      [0x1008, 0x101f, "byte"],
    ],
    why: "head $1000..$1007 is 8 bytes -- even",
  },
  {
    n: 5,
    name: "overlap at the HIGH end leaving an ODD head",
    c: 0x1009,
    d: 0x101f,
    predicate: "a < c && c <= b && d >= b",
    refused: true,
    why: "head $1000..$1008 is 9 bytes -- odd",
  },
];

test("the SPLIT case definitions really do satisfy their own predicates, and the table covers all five geometries with both outcomes", () => {
  // Same guard as the non-split table's: a weakened entry -- case 3 written
  // with an equality at either end, say -- would silently stop testing the
  // geometry it claims to, and a table that tested four shapes while labelling
  // itself five would pass unnoticed.
  for (const kase of SPLIT_CASES) {
    const label = `case ${kase.n} (${kase.name})`;
    switch (kase.n) {
      case 1:
        assert.ok(kase.c === SPLIT_A && kase.d === SPLIT_B, `${label}: the identical range`);
        break;
      case 2:
        assert.ok(kase.c <= SPLIT_A && kase.d >= SPLIT_B, `${label}: fully contains the existing row`);
        break;
      case 3:
        assert.ok(SPLIT_A < kase.c, `${label}: the LOW inequality is STRICT -- written as c === a this is case 4`);
        assert.ok(kase.d < SPLIT_B, `${label}: the HIGH inequality is STRICT -- written as d === b this is case 5`);
        break;
      case 4:
        assert.ok(kase.c <= SPLIT_A && SPLIT_A <= kase.d && kase.d < SPLIT_B, `${label}: overlaps the low end and stops short of b`);
        break;
      case 5:
        assert.ok(SPLIT_A < kase.c && kase.c <= SPLIT_B && kase.d >= SPLIT_B, `${label}: starts inside and runs past b`);
        break;
      default:
        assert.fail(`${label}: not one of the five geometries`);
    }
    // Exactly one outcome kind per entry -- never both, never neither.
    assert.equal(
      kase.refused === true,
      kase.rows === undefined,
      `${label}: an entry is either a refusal or a row set asserted by value`,
    );
  }

  assert.deepEqual(
    [...new Set(SPLIT_CASES.map((k) => k.n))].sort((x, y) => x - y),
    [1, 2, 3, 4, 5],
    "all five geometries are exercised against the split row",
  );
  assert.equal(SPLIT_CASES.length, 8, "eight entries -- a shrunken table is a weakened proof");
  assert.equal(SPLIT_CASES.filter((k) => k.refused === true).length, 3, "three refusing entries: cases 3, 4 and 5 with an odd remainder");
  assert.equal(SPLIT_CASES.filter((k) => k.rows !== undefined).length, 5, "five entries whose row set is asserted by value");
});

for (const kase of SPLIT_CASES) {
  const outcome = kase.refused === true ? "REFUSED" : "row set by value";
  test(`split overlap case ${kase.n} (${kase.name}) over $1000..$100f lo_hi_address -> ${outcome}`, () => {
    const r = runCase(kase, productionRetype, {
      seedStart: SPLIT_A,
      seedEndInclusive: SPLIT_B,
      seedType: "lo_hi_address",
      newType: "byte",
    });

    if (kase.refused === true) {
      // THREE ASSERTIONS, NOT ONE. A refusal that quietly advanced the revision
      // or churned a row id would satisfy a class-only check while still having
      // cost the caller something -- and 28-11 P5 is the prohibition on exactly
      // that. The gate runs before the first delete, so `after` is not a
      // rolled-back state: it is a state nothing ever touched.
      assert.ok(
        r.thrown instanceof AnnoSplitRemainderError,
        `case ${kase.n}: ${kase.why} -- expected AnnoSplitRemainderError, got ${String(r.thrown)}`,
      );
      assert.deepEqual(r.after, r.before, `case ${kase.n}: the row set is deep-equal after the refusal, ids included`);
      assert.equal(r.revisionAfter, r.revisionBefore, `case ${kase.n}: the revision did not move`);
      return;
    }

    assert.equal(r.thrown, null, `case ${kase.n}: ${kase.why} -- the retype must be accepted`);
    assert.deepEqual(
      r.after.map((row) => [row.start, row.endInclusive, row.dataType] as const),
      kase.rows,
      `case ${kase.n}: the resulting row set, by value and in listRanges() order`,
    );
    assert.deepEqual(
      r.after.map((row) => row.bank),
      r.after.map(() => null),
      `case ${kase.n}: every row's bank is null -- the seed carried none, so neither remainder can invent one`,
    );

    // The two invariants the non-split table asserts, asserted here too: an
    // accepted split must not lose a typed byte just because the row it split
    // was a split table.
    assert.equal(
      totalTypedBytes(r.after),
      unionSize(r.beforeCovered, kase.c, kase.d),
      `case ${kase.n}: invariant A -- the table claims exactly the addresses typed before plus the ones just typed`,
    );
    assert.deepEqual(r.lost, [], `case ${kase.n}: invariant B -- no previously typed address lost its type`);
  });
}

// ---------------------------------------------------------------------------
// WR-08: the two shapes STORE-02's evidence could not distinguish, PINNED.
// ---------------------------------------------------------------------------
//
// Both tests pin TODAY'S BEHAVIOUR AS INTENDED. The decision itself -- that a
// caller-spanning retype deletes the rows it spans and inserts one, that this
// does not contradict STORE-02, and why `changed: true` is right for it -- is
// recorded ONCE, in `retype()`'s doc comment in `anno-store.ts`, next to its
// STORE-02 reference. It is deliberately not restated here: two copies of a
// decision drift, and the pin's job is the numbers.

test("WR-08 pin, THE UNION RETYPE: a caller range spanning two adjacent rows leaves exactly ONE row and NEITHER original id", () => {
  inFreshStore((store) => {
    setDataType(store, { start: 0x1000, endInclusive: 0x1007, dataType: "byte" });
    setDataType(store, { start: 0x1008, endInclusive: 0x100f, dataType: "byte" });
    const before = listRanges(store);
    assert.deepEqual(
      before.map((row) => [row.id, row.start, row.endInclusive, row.dataType]),
      [
        [1, 0x1000, 0x1007, "byte"],
        [2, 0x1008, 0x100f, "byte"],
      ],
      "two adjacent same-type rows, not coalesced -- the store joined nothing of its own accord",
    );

    const result = setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
    // `changed: true` even though every address resolves to `byte` before AND
    // after. `changed` reports the ROW SET, and the row set really did change.
    assert.equal(result.changed, true, "the row identities changed, and that is what `changed` reports");

    const after = listRanges(store);
    assert.equal(after.length, 1, "exactly one surviving row");
    assert.deepEqual(
      after.map((row) => [row.start, row.endInclusive, row.dataType]),
      [[0x1000, 0x100f, "byte"]],
      "spanning 4096..4111",
    );

    // THE ASSERTION THAT DISTINGUISHES "does not join" FROM "was never asked to".
    const beforeIds = before.map((row) => row.id);
    const afterIds = after.map((row) => row.id);
    assert.deepEqual(beforeIds, [1, 2], "the ids before");
    assert.deepEqual(afterIds, [3], "and the id after -- a NEW row, not one of the two");
    for (const id of beforeIds) {
      assert.ok(!afterIds.includes(id), `id ${id} did not survive the union retype`);
    }
  });
});

test("WR-08 pin, THE SAME-TYPE SUBRANGE: retyping a subrange to the type it already has fragments one row into three, with every id churned", () => {
  inFreshStore((store) => {
    setDataType(store, { start: 0x1000, endInclusive: 0x1007, dataType: "byte" });
    setDataType(store, { start: 0x1008, endInclusive: 0x100f, dataType: "byte" });
    setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
    const before = listRanges(store);
    assert.deepEqual(before.map((row) => row.id), [3], "the single row the union retype left");

    const result = setDataType(store, { start: 0x1004, endInclusive: 0x1007, dataType: "byte" });
    assert.equal(result.changed, true, "three rows where there was one -- the row set changed");

    const after = listRanges(store);
    assert.deepEqual(
      after.map((row) => [row.start, row.endInclusive, row.dataType]),
      [
        [0x1000, 0x1003, "byte"],
        [0x1008, 0x100f, "byte"],
        [0x1004, 0x1007, "byte"],
      ],
      "head, tail, then the newly typed range -- the same order every split produces",
    );

    const beforeIds = before.map((row) => row.id);
    const afterIds = after.map((row) => row.id);
    assert.deepEqual(beforeIds, [3], "the id before");
    assert.deepEqual(afterIds, [4, 5, 6], "and the three ids after");
    for (const id of afterIds) {
      assert.ok(!beforeIds.includes(id), `id ${id} is new -- the split row did not survive under its own id`);
    }
  });
});

// ---------------------------------------------------------------------------
// ADJACENCY (STORE-02): ranges are stored AS RANGES and never merged.
// ---------------------------------------------------------------------------

test("adjacency, BEHAVIOURAL: two adjacent same-type ranges stay TWO rows with distinct ids, and the boundary addresses resolve to different rows", () => {
  inFreshStore((store) => {
    setDataType(store, { start: 0x0400, endInclusive: 0x04ff, dataType: "byte" });
    setDataType(store, { start: 0x0500, endInclusive: 0x05ff, dataType: "byte" });

    const rows = listRanges(store);
    assert.equal(rows.length, 2, "adjacent same-type ranges are NOT coalesced -- merging is designed out, not merely unimplemented");
    assert.deepEqual(
      rows.map((row) => [row.start, row.endInclusive, row.dataType]),
      [
        [0x0400, 0x04ff, "byte"],
        [0x0500, 0x05ff, "byte"],
      ],
      "both ranges keep their own boundaries and their own type",
    );
    assert.notEqual(rows[0].id, rows[1].id, "and their own identity");

    const index = buildPaintIndex(rows);
    assert.equal(resolveAt(index, 0x04ff), rows[0].id, "the last address of the first range resolves to the first row");
    assert.equal(resolveAt(index, 0x0500), rows[1].id, "the first address of the second range resolves to the SECOND row");
    assert.notEqual(resolveAt(index, 0x04ff), resolveAt(index, 0x0500), "the boundary between two adjacent rows is observable");
  });
});

test("adjacency, STRUCTURAL: no coalescing, merging or splitter identifier exists anywhere in the store's code", () => {
  // The behavioural half above cannot see a splitter that EXISTS but is not yet
  // called -- and an uncalled merge primitive is one edit away from being
  // called. `STORE-02`'s requirement is that no splitter concept is needed and
  // none is introduced, so the absence is asserted over the code itself.
  //
  // STRICT `codeOnly()` (literal bodies BLANKED, the default): the targets are
  // CODE IDENTIFIERS, so the store's own header prose about the absence of
  // merging -- and this file's own prose -- cannot redden the gate.
  const strict = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"));

  // NON-VACUITY: an empty or unreadable source would satisfy any absence
  // assertion trivially. Pin that the scanned source is real first.
  assert.ok(strict.length > 5_000, `the stripped source must be substantial, got ${strict.length} characters`);
  assert.ok(strict.includes("setDataType"), "the stripped source must still contain the store's real code");

  const offenders = ["coalesc", "merg", "splitter"].filter((needle) => strict.toLowerCase().includes(needle));
  assert.deepEqual(
    offenders,
    [],
    "ranges are stored AS ranges and never merged, so there is no splitter primitive to introduce -- " +
      "merging is the named blocker behind the decompiler and rebuild requirements and the predicted over-merge bias in the coverage census",
  );
});

// ---------------------------------------------------------------------------
// EMPTY, NON-OVERLAPPING, AND POST-SPLIT ORDERING.
// ---------------------------------------------------------------------------

test("empty and non-overlapping: the first range inserts exactly one row, and a second, non-overlapping range leaves both rows and both types intact", () => {
  inFreshStore((store) => {
    assert.deepEqual(listRanges(store), [], "an empty range table starts empty");

    setDataType(store, { start: 0x0400, endInclusive: 0x04ff, dataType: "byte" });
    const afterFirst = listRanges(store);
    assert.equal(afterFirst.length, 1, "typing into an empty range table inserts exactly one row");

    setDataType(store, { start: 0x2000, endInclusive: 0x2007, dataType: "lo_hi_address" });
    const afterSecond = listRanges(store);
    assert.equal(afterSecond.length, 2, "a non-overlapping second range is added, not merged into the first");
    assert.deepEqual(
      afterSecond.map((row) => [row.start, row.endInclusive, row.dataType]),
      [
        [0x0400, 0x04ff, "byte"],
        [0x2000, 0x2007, "lo_hi_address"],
      ],
      "the first row is untouched -- same boundaries, same type",
    );
    assert.deepEqual(afterSecond[0], afterFirst[0], "byte for byte, including its id");
  });
});

test("post-split row order is DETERMINISTIC and survives a close and a reopen: head, then tail, then the new range, in ascending id", () => {
  // THE RULE, stated rather than left incidental: `listRanges()` orders by
  // ascending id, and `retype()` re-inserts the surviving head first, then the
  // surviving tail, and inserts the new range LAST. So the three rows of the
  // fully-contained case carry consecutive new ids in that order, and the new
  // range always has the HIGHEST id of the three. Ascending id is therefore
  // head, tail, new range -- which is NOT ascending start address, and a reader
  // who assumes it is will be wrong.
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const first = openStore(path, { workspaceRoot: dir });
    let expected: [number, number, number, string][];
    try {
      setDataType(first, { start: A, endInclusive: B, dataType: "byte" });
      setDataType(first, { start: 0x1040, endInclusive: 0x107f, dataType: "code" });

      const rows = listRanges(first);
      assert.equal(rows.length, 3);
      assert.deepEqual(
        rows.map((row) => row.id),
        [...rows].sort((x, y) => x.id - y.id).map((row) => row.id),
        "listRanges() returns rows in ascending id",
      );
      assert.deepEqual(
        rows.map((row) => [row.start, row.endInclusive, row.dataType]),
        [
          [A, 0x103f, "byte"],
          [0x1080, B, "byte"],
          [0x1040, 0x107f, "code"],
        ],
        "head first, then tail, then the new range -- the survivors are re-inserted before the new row is",
      );
      assert.ok(rows[2].id > rows[1].id && rows[1].id > rows[0].id, "the new range carries the highest of the three ids");
      expected = rows.map((row) => [row.id, row.start, row.endInclusive, row.dataType]);
    } finally {
      closeStore(first);
    }

    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      assert.deepEqual(
        listRanges(reopened).map((row) => [row.id, row.start, row.endInclusive, row.dataType]),
        expected,
        "the same order, with the same ids, after a close and a reopen -- the order is a property of the store, not of one connection",
      );
    } finally {
      closeStore(reopened);
    }
  });
});

// ---------------------------------------------------------------------------
// THE ROUND-TRIP RE-ACCEPTANCE INVARIANT, AND PLANTING C.
// ---------------------------------------------------------------------------
//
// THE CLASS-LEVEL STATEMENT of everything above: a row the store RETURNS must
// be a row the store would ACCEPT. Every hand-written case above catches one
// instance of a violation; this catches the class, so a future internal writer
// added without the shape gate is caught by an assertion rather than by whether
// somebody remembered to add a case for it.
//
// WHAT THIS INVARIANT PROVES, AND WHAT IT DOES NOT -- stated, not implied.
// It is driven over a DETERMINISTIC FINITE SEQUENCE of writes. It is therefore
// direct evidence for the geometries that sequence constructs, and a BACKSTOP
// for the unbounded input space of every reachable start/end pair. No
// property-based sweep over all 65,536 address pairs is run here. A later
// reader must not read the invariant's green as a proof over the whole input
// space; the same limit is filed as a structured `backstop` truth in this
// plan's SUMMARY.

/**
 * The rows `listRanges()` produced that the store would REFUSE at its own entry
 * point. Returns ROWS rather than a boolean so a failure message can name the
 * offending row by value instead of merely reporting that one exists.
 *
 * Two questions, both asked of the module's own functions rather than
 * re-implemented here:
 *   * `assertRangeShape(start, endInclusive, dataType)` -- the exact call
 *     `setDataType()` makes on a caller's range, which is what makes this a
 *     ROUND TRIP rather than a second opinion;
 *   * for a split member, `resolveSplitTargets()` over a byte array of the
 *     row's span -- the module's own resolver, and the one function ROADMAP
 *     criterion 1 names as the observable consequence of recording orientation.
 *     A row that shape-checks but cannot be decoded is still un-documented.
 *
 * Split membership is asked through the exported `isSplitDataType` predicate.
 * A hand-written list of the four names here would be a second copy of the
 * vocabulary, which is the module header's trap 2.
 */
function rowsTheStoreWouldRefuse(rows: readonly RangeRow[]): { row: RangeRow; reason: string }[] {
  const refused: { row: RangeRow; reason: string }[] = [];
  for (const row of rows) {
    try {
      assertRangeShape(row.start, row.endInclusive, row.dataType);
    } catch (e) {
      refused.push({ row, reason: `assertRangeShape: ${(e as Error).message}` });
      continue;
    }
    if (isSplitDataType(row.dataType)) {
      try {
        resolveSplitTargets(new Uint8Array(row.endInclusive - row.start + 1), row.dataType);
      } catch (e) {
        refused.push({ row, reason: `resolveSplitTargets: ${(e as Error).message}` });
      }
    }
  }
  return refused;
}

/** Formats the offenders for a failure message -- by value, so the message
 * names the row rather than its count. */
function describeRefused(refused: readonly { row: RangeRow; reason: string }[]): string {
  return refused
    .map(({ row, reason }) => `id=${row.id} ${row.start}..${row.endInclusive} ${row.dataType} (${row.endInclusive - row.start + 1} bytes) -- ${reason}`)
    .join("; ");
}

/** The seed every sequence run starts from: one row of each of the four split
 * layouts plus one non-split row, all 16 bytes so an entry boundary falls on
 * every even offset. Written through the production entry point. */
const SEQUENCE_SEED: readonly (readonly [number, number, DataType])[] = [
  [0x1000, 0x100f, "lo_hi_address"],
  [0x1100, 0x110f, "hi_lo_address"],
  [0x1200, 0x120f, "lo_hi_word"],
  [0x1300, 0x130f, "hi_lo_word"],
  [0x1400, 0x140f, "byte"],
];

interface SequenceStep {
  readonly start: number;
  readonly endInclusive: number;
  readonly dataType: DataType;
  /** What the PRODUCTION path does with this step, applied to the SEED state. */
  readonly expect: "accepted" | "refused";
  readonly note: string;
}

/**
 * A DETERMINISTIC, TABLE-DRIVEN sequence. Determinism is required so a red is
 * reproducible: there is no pseudo-random generator here at all, and if one is
 * ever added it must be a small test-local one with a FIXED seed recorded in
 * this comment -- never `Math.random`, whose failures cannot be re-run.
 *
 * The sequence covers all four split members, one non-split member, both
 * accepted and refused writes, an identical repeat (idempotency), a union
 * retype spanning three rows, and a write that CREATES a split row.
 */
const SEQUENCE: readonly SequenceStep[] = [
  { start: 0x1004, endInclusive: 0x1007, dataType: "byte", expect: "accepted", note: "lo_hi_address, head 4 and tail 8 -- both even" },
  { start: 0x1004, endInclusive: 0x1007, dataType: "byte", expect: "accepted", note: "the identical write again -- idempotency" },
  { start: 0x1105, endInclusive: 0x1105, dataType: "byte", expect: "refused", note: "hi_lo_address, head $1100..$1104 is 5 bytes -- odd" },
  { start: 0x1102, endInclusive: 0x1109, dataType: "code", expect: "accepted", note: "hi_lo_address, head 2 and tail 6 -- both even" },
  { start: 0x1203, endInclusive: 0x120f, dataType: "code", expect: "refused", note: "lo_hi_word, head $1200..$1202 is 3 bytes -- odd" },
  { start: 0x1200, endInclusive: 0x1205, dataType: "petscii", expect: "accepted", note: "lo_hi_word, no head, tail 10 -- even" },
  { start: 0x1300, endInclusive: 0x1300, dataType: "word", expect: "refused", note: "hi_lo_word, tail $1301..$130f is 15 bytes -- odd" },
  { start: 0x130a, endInclusive: 0x130f, dataType: "screencode", expect: "accepted", note: "hi_lo_word, head 10 -- even, no tail" },
  { start: 0x1404, endInclusive: 0x1407, dataType: "word", expect: "accepted", note: "a non-split row -- its remainders can never be illegal" },
  { start: 0x1400, endInclusive: 0x140f, dataType: "address", expect: "accepted", note: "a union retype spanning all three rows of $1400" },
  { start: 0x1408, endInclusive: 0x140b, dataType: "lo_hi_address", expect: "accepted", note: "CREATES a split row inside a non-split one" },
];

/** Seeds a store with `SEQUENCE_SEED` through the production entry point. */
function seedSequenceStore(store: ReturnType<typeof openStore>): void {
  for (const [start, endInclusive, dataType] of SEQUENCE_SEED) {
    setDataType(store, { start, endInclusive, dataType });
  }
}

test("THE ROUND-TRIP INVARIANT: after every write of a deterministic sequence, every row listRanges() returns is re-acceptable at setDataType and decodable by resolveSplitTargets", () => {
  let accepted = 0;
  let refusals = 0;
  let finalRows = 0;
  let finalSplitRows = 0;

  inFreshStore((store) => {
    seedSequenceStore(store);
    assert.deepEqual(
      rowsTheStoreWouldRefuse(listRanges(store)),
      [],
      "the seed itself is round-trippable -- otherwise the sequence starts already violating the invariant",
    );

    for (const [i, step] of SEQUENCE.entries()) {
      const rowsBefore = listRanges(store);
      const revisionBefore = currentRevision(store);
      let thrown: unknown = null;
      try {
        setDataType(store, { start: step.start, endInclusive: step.endInclusive, dataType: step.dataType });
      } catch (e) {
        thrown = e;
      }

      if (step.expect === "refused") {
        refusals += 1;
        assert.ok(
          thrown instanceof AnnoSplitRemainderError,
          `step ${i} (${step.note}): expected a refusal, got ${thrown === null ? "acceptance" : String(thrown)}`,
        );
        assert.deepEqual(listRanges(store), rowsBefore, `step ${i}: a refusal leaves the row set byte-identical`);
        assert.equal(currentRevision(store), revisionBefore, `step ${i}: a refusal does not advance the revision`);
      } else {
        accepted += 1;
        assert.equal(thrown, null, `step ${i} (${step.note}): expected acceptance, got ${String(thrown)}`);
      }

      // THE INVARIANT, after EVERY write -- accepted or refused. A refused
      // write is checked too because a partially applied refusal is exactly the
      // state that would leave an unacceptable row behind.
      const refused = rowsTheStoreWouldRefuse(listRanges(store));
      assert.deepEqual(
        refused,
        [],
        `step ${i} (${step.note}): the store returned a row it would refuse at its own entry point -- ${describeRefused(refused)}`,
      );
    }

    const final = listRanges(store);
    finalRows = final.length;
    finalSplitRows = final.filter((row) => isSplitDataType(row.dataType)).length;

    // THE FOUR SPLIT MEMBERS ARE ALL STILL REPRESENTED, so the invariant was
    // asked about each orientation and each of address-versus-word, not only
    // about whichever one happened to survive.
    assert.deepEqual(
      [...new Set(final.filter((row) => isSplitDataType(row.dataType)).map((row) => row.dataType))].sort(),
      ["hi_lo_address", "hi_lo_word", "lo_hi_address", "lo_hi_word"],
      "all four split layouts are present in the final row set",
    );
  });

  // NON-VACUITY, in `anno-index.test.ts`'s style. Without these three counts a
  // sequence that silently degenerated to zero writes -- or to zero split rows,
  // or to zero refusals -- would satisfy the invariant trivially, which is the
  // exact failure mode this whole round exists to close.
  assert.ok(accepted >= 8, `the sequence must actually write: ${accepted} accepted writes, expected at least 8`);
  assert.ok(refusals >= 3, `the sequence must actually exercise the refusal path: ${refusals} refusals, expected at least 3`);
  assert.ok(finalSplitRows >= 4, `the invariant must be asked about split rows: ${finalSplitRows} split rows survive, expected at least 4`);
  assert.equal(finalRows, 13, "the sequence's final row count, pinned so a silently shortened sequence is visible");
});

/**
 * PLANTING C: split-and-preserve WITHOUT the remainder rule -- `retype()` as it
 * stood before this rule existed. Test-local on purpose, and driven through
 * `applyWrite()`, the same write sequence the production path uses, so the ONLY
 * difference between the two measurements below is the missing gate.
 */
function retypeWithoutRemainderRule(
  store: ReturnType<typeof openStore>,
  start: number,
  endInclusive: number,
  dataType: DataType,
): void {
  applyWrite(store, (db) => {
    const overlapping = db
      .prepare("select id, start, end_inclusive, data_type, bank from anno_range where end_inclusive >= ? and start <= ? order by id")
      .all(start, endInclusive) as { id: number; start: number; end_inclusive: number; data_type: string; bank: number | null }[];

    if (
      overlapping.length === 1 &&
      overlapping[0].start === start &&
      overlapping[0].end_inclusive === endInclusive &&
      overlapping[0].data_type === dataType
    ) {
      return false;
    }

    for (const row of overlapping) {
      db.prepare("delete from anno_range where id = ?").run(row.id);
      if (row.start < start) {
        db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(
          row.start,
          start - 1,
          row.data_type,
          row.bank,
        );
      }
      if (row.end_inclusive > endInclusive) {
        db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(
          endInclusive + 1,
          row.end_inclusive,
          row.data_type,
          row.bank,
        );
      }
    }
    db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(start, endInclusive, dataType, null);
    return true;
  });
}

test("planting C, OBSERVED: the same sequence through a writer without the remainder rule leaves rows the store would refuse, named by value", () => {
  // Checked after EVERY step, exactly as the invariant above checks it, so the
  // planting is caught at the step that introduces the violation rather than
  // only at the end -- a later step can delete an offending row and hide it.
  let firstOffendingStep = -1;
  let firstOffenders!: { row: RangeRow; reason: string }[];
  let finalRefused!: { row: RangeRow; reason: string }[];
  inFreshStore((store) => {
    seedSequenceStore(store);
    for (const [i, step] of SEQUENCE.entries()) {
      retypeWithoutRemainderRule(store, step.start, step.endInclusive, step.dataType);
      const refused = rowsTheStoreWouldRefuse(listRanges(store));
      if (refused.length > 0 && firstOffendingStep === -1) {
        firstOffendingStep = i;
        firstOffenders = refused;
      }
    }
    finalRefused = rowsTheStoreWouldRefuse(listRanges(store));
  });

  assert.notEqual(firstOffendingStep, -1, "the planting MUST leave at least one unacceptable row -- otherwise the invariant is not discriminating");
  assert.equal(firstOffendingStep, 2, "and it does so at step 2, the first step whose remainder is an odd split table");

  // NAMED BY VALUE, not counted: the odd hi_lo_address head that step 2's
  // one-byte retype leaves behind.
  assert.deepEqual(
    firstOffenders.map(({ row }) => ({ start: row.start, endInclusive: row.endInclusive, dataType: row.dataType })),
    [{ start: 0x1100, endInclusive: 0x1104, dataType: "hi_lo_address" }],
    `the offending row at step 2, by value: ${describeRefused(firstOffenders)}`,
  );
  assert.ok(firstOffenders[0].reason.includes("assertRangeShape"), "and it is refused by the store's own shape rule");

  // ...and one survives all the way to the end, so the damage is not merely
  // transient: an odd hi_lo_word row nothing later overwrites.
  assert.deepEqual(
    finalRefused.map(({ row }) => ({ start: row.start, endInclusive: row.endInclusive, dataType: row.dataType })),
    [{ start: 0x1301, endInclusive: 0x1309, dataType: "hi_lo_word" }],
    `the offending rows left standing at the end: ${describeRefused(finalRefused)}`,
  );
});

test("planting C, SELECTIVE and MEASURED: it can differ from the production path on exactly the three steps whose remainder is illegal, and is indistinguishable on the other eight", () => {
  // MEASURED, not assumed -- the same shape planting A uses. Each step is
  // applied ALONE to a freshly seeded store, so the comparison is per-step and
  // does not inherit a divergence from an earlier one.
  const differs: number[] = [];
  const identical: number[] = [];

  for (const [i, step] of SEQUENCE.entries()) {
    let real: string | null = null;
    inFreshStore((store) => {
      seedSequenceStore(store);
      try {
        setDataType(store, { start: step.start, endInclusive: step.endInclusive, dataType: step.dataType });
        real = JSON.stringify(listRanges(store).map((row) => [row.start, row.endInclusive, row.dataType]));
      } catch {
        real = null; // refused
      }
    });

    let planted!: string;
    inFreshStore((store) => {
      seedSequenceStore(store);
      retypeWithoutRemainderRule(store, step.start, step.endInclusive, step.dataType);
      planted = JSON.stringify(listRanges(store).map((row) => [row.start, row.endInclusive, row.dataType]));
    });

    if (real === null) {
      differs.push(i);
    } else {
      assert.equal(planted, real, `step ${i} (${step.note}): the planting must be INDISTINGUISHABLE where the remainder is legal`);
      identical.push(i);
    }
  }

  assert.deepEqual(differs, [2, 4, 6], "the planting differs on exactly the three steps whose remainder is an odd split table");
  assert.deepEqual(identical, [0, 1, 3, 5, 7, 8, 9, 10], "and on the other eight it produces the identical row set -- which is why a table of legal-only cases would let it through");
});
