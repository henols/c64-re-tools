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
import {
  applyWrite,
  closeStore,
  currentRevision,
  listRanges,
  openStore,
  setComment,
  setDataType,
  type SetDataTypeResult,
} from "./anno-store.ts";
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
  /** The write's own RESULT object, or `null` when the retype threw or when the
   * retype callback is one of this file's plantings (which do not go through
   * `setDataType` and therefore have no result to report). Captured because the
   * row set alone cannot see CR-10's class: a re-paired split table is legal,
   * re-acceptable and decodable, so the only observable difference between a
   * correct write and a silently corrupting one is what the store SAYS. */
  result: SetDataTypeResult | null;
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
  retype: (store: ReturnType<typeof openStore>, start: number, endInclusive: number, dataType: DataType) => SetDataTypeResult | null,
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
    let result: SetDataTypeResult | null = null;
    try {
      result = retype(store, kase.c, kase.d, newType);
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
      result,
      revisionBefore,
      revisionAfter: currentRevision(store),
    };
  });
  return captured;
}

/** The production retype path, through its own exported entry point. It RETURNS
 * the write's result, because `reinterpretedSplitTables` is the only channel
 * through which a split-table fragmentation is observable at all (CR-10). */
function productionRetype(
  store: ReturnType<typeof openStore>,
  start: number,
  endInclusive: number,
  dataType: DataType,
): SetDataTypeResult {
  return setDataType(store, { start, endInclusive, dataType });
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

    // THE POSITIVE DISCRIMINATION for CR-10's report (case-by-case, over a
    // NON-SPLIT overlapped row). Without this, an implementation that reported
    // NOTHING ANYWHERE would satisfy every split-side assertion in this file by
    // being empty everywhere. A non-split row's meaning does not depend on its
    // extent, so there is nothing to disclose -- and the field is EMPTY rather
    // than absent, so the caller still reads it unconditionally.
    assert.deepEqual(
      r.result?.reinterpretedSplitTables,
      [],
      `case ${kase.n}: a NON-SPLIT overlapped row is re-paired by nothing, so the write reports no re-interpretation`,
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
): null {
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
  // A planting does not go through `setDataType`, so it has NO result object --
  // which is itself the point: a writer that bypasses the entry point cannot
  // disclose anything, and `null` says so rather than pretending to an empty
  // report.
  return null;
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
// SPLIT-TABLE ROWS: TWO RULES, NEITHER SILENT (CR-09 and CR-10).
// ---------------------------------------------------------------------------
//
// RULE ONE -- PARITY REFUSES THE ODD FRAGMENT (CR-09). A split-table layout
// needs an EVEN byte count -- the low half and the high half must be the same
// length -- and `assertRangeShape()` refuses an odd one at the store's own entry
// point. Split-and-preserve re-inserts the surviving head and tail of an
// overlapped row carrying that row's own type forward, so a retype that lands
// off an entry boundary can propose a remainder that is an ODD split table: a
// row `setDataType` would refuse to create and `resolveSplitTargets()` cannot
// decode. The store never persists a range row it would refuse at its own entry
// point. Every remainder the split would produce is asked the SAME shape
// question -- `assertRangeShape` itself, not a second even-count test -- BEFORE
// the first delete, and an illegal one refuses the whole retype by name.
//
// RULE TWO -- EVERY FRAGMENTATION OF A SPLIT ROW IS REPORTED, WITH BOTH
// ENTRY-PAIR SETS (CR-10). Parity is not the only thing a fragment breaks. A
// split table pairs byte `i` with byte `n + i`, so an entry's partner is a
// function of the row's START and its LENGTH: a surviving fragment of `m`
// entries pairs its own byte `j` with its own byte `m + j`, which matches an
// original pair only when the fragment IS the whole row. No proper fragment
// preserves a single entry pair, at any boundary, THE MIDPOINT INCLUDED. So an
// accepted write returns, as data on a successful result, the pairs the
// overlapped row read before and the pairs each survivor reads now.
//
// WHY RULE TWO NEEDS ITS OWN CONTROL, AND WHY NOTHING ELSE HERE CAN BE IT: A
// RE-PAIRED TABLE DECODES PERFECTLY. Its rows are legal, re-acceptable at
// `setDataType`, and return plausible WRONG 16-bit values. Parity cannot see it,
// the row-set pins cannot see it, and the round-trip invariant's decodability
// check cannot see it -- decodability is not preservation. Only a
// `resolveSplitTargets()` comparison over the same bytes BEFORE and AFTER can,
// which is why every accepted case below carries one.
//
// `retype()`'s DECISION 1 in `anno-store.ts` records both rules, the answer not
// taken for each, and why the disclosure is a return channel rather than a
// column.

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

/**
 * The synthetic byte image the round-6 verification report drives CR-10 over:
 * `00 01 02 ... 0f` laid across `$1000..$100f`, so the byte at any address is
 * that address's offset from `SPLIT_A` and a resolved 16-bit target names its
 * own two source addresses unambiguously.
 *
 * The store holds no bytes, so this image is the test's own -- it is what turns
 * "which two addresses does this entry read" into a value a reader can compare.
 * `resolveSplitTargets()` is the module's own authority on what a row MEANS, and
 * the round-6 verifier names it as THE observation for this class; importing it
 * here is expected and correct. Importing the production PAIRING function would
 * not be -- every expected couple in this file is hand-written on purpose.
 */
function syntheticImage(start: number, endInclusive: number): Uint8Array {
  return Uint8Array.from(Array.from({ length: endInclusive - start + 1 }, (_, i) => (start - SPLIT_A + i) & 0xff));
}

/** Every 16-bit target the split rows lying inside `spanStart..spanEnd` resolve
 * to over `syntheticImage`, in `listRanges()` order. The comparison operand for
 * "did any recorded target survive this write". */
function survivingSplitTargets(rows: readonly RangeRow[], spanStart: number, spanEnd: number): number[] {
  return rows
    .filter((row) => isSplitDataType(row.dataType) && row.start >= spanStart && row.endInclusive <= spanEnd)
    .flatMap((row) => [...resolveSplitTargets(syntheticImage(row.start, row.endInclusive), row.dataType).targets]);
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

test("CR-10, PRODUCTION ENTRY POINTS ONLY: an even-remainder fragmentation of a split row is ACCEPTED AND REPORTED -- the three rows are correct and the store names both entry-pair sets", () => {
  // THIS TEST USED TO CERTIFY THE DEFECT. It was named "the LEGAL remainder
  // case" and pinned only the three-row set, which is CORRECT and always was --
  // and which is exactly why 210 green tests were blind to CR-10. The row set
  // says nothing about what the surviving rows MEAN, and a re-paired split table
  // is legal, re-acceptable and decodable. So the row assertions stay (they are
  // right) and the DISCLOSURE is what this test now measures.
  inFreshStore((store) => {
    seedSplitRow(store);
    const result = setDataType(store, { start: 0x1004, endInclusive: 0x1007, dataType: "byte" });
    assert.equal(result.changed, true);
    assert.deepEqual(result.contradictedComments, [], "no comment was contradicted -- the disclosure rides beside that field, not in it");

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

    // THE DISCLOSURE, BY VALUE. Every couple below is HAND-DERIVED from the
    // layout rule -- a table of n entries pairs its own byte i with its own byte
    // n + i -- and this file deliberately does NOT import the production pairing
    // function, so these expectations are an independent oracle rather than the
    // implementation checking itself.
    assert.equal(result.reinterpretedSplitTables.length, 1, "one overlapped split row was fragmented, so one record");
    const record = result.reinterpretedSplitTables[0];
    assert.equal(record.rowStart, 0x1000);
    assert.equal(record.rowEndInclusive, 0x100f);
    assert.equal(record.dataType, "lo_hi_address");
    assert.equal(record.entryCountBefore, 8, "16 bytes, so eight entries before the write");
    assert.deepEqual(
      record.entryPairsBefore.map((pair) => [...pair]),
      [
        [0x1000, 0x1008],
        [0x1001, 0x1009],
        [0x1002, 0x100a],
        [0x1003, 0x100b],
        [0x1004, 0x100c],
        [0x1005, 0x100d],
        [0x1006, 0x100e],
        [0x1007, 0x100f],
      ],
      "the eight couples the 16-byte table read BEFORE the write, n = 8 so entry i reads i and 8 + i",
    );

    // SURVIVORS ARE ORDERED HEAD THEN TAIL WITHIN THE RECORD -- the within-record
    // half of the report's ordering contract.
    assert.deepEqual(
      record.survivors.map((s) => ({ start: s.start, endInclusive: s.endInclusive, entryCount: s.entryCount })),
      [
        { start: 0x1000, endInclusive: 0x1003, entryCount: 2 },
        { start: 0x1008, endInclusive: 0x100f, entryCount: 4 },
      ],
      "the head survivor first, then the tail -- ascending address order within one record",
    );
    assert.equal(record.survivors[0].start, record.rowStart, "survivors[0] is the HEAD, and it starts where the row started");
    assert.ok(record.survivors[0].start < record.survivors[1].start, "and the TAIL follows it");
    assert.deepEqual(
      record.survivors[0].entryPairs.map((pair) => [...pair]),
      [
        [0x1000, 0x1002],
        [0x1001, 0x1003],
      ],
      "the 4-byte head is now a TWO-entry table: entry i reads i and 2 + i",
    );
    assert.deepEqual(
      record.survivors[1].entryPairs.map((pair) => [...pair]),
      [
        [0x1008, 0x100c],
        [0x1009, 0x100d],
        [0x100a, 0x100e],
        [0x100b, 0x100f],
      ],
      "the 8-byte tail is now a FOUR-entry table: entry i reads i and 4 + i",
    );
    assert.deepEqual(
      record.preservedEntryPairs.map((pair) => [...pair]),
      [],
      "NOT ONE of the eight couples survives -- a proper fragment of a split table pairs its own byte j with its own byte m + j, " +
        "which matches an original pair only when the fragment IS the whole row",
    );
    assert.match(record.summary, /0 of 8 entry-address pairs are preserved/, "and the summary carries BOTH of the numbers that conflicted");

    // THE VERIFIER'S OWN OBSERVATION, and the only one that can SEE this class:
    // resolve the ORIGINAL span and every surviving split row through the
    // module's own resolver over a synthetic byte image, and compare the TARGET
    // SETS. DECODABILITY IS NOT PRESERVATION -- every row below decodes
    // perfectly, and none of them decodes to anything the table used to say.
    const original = resolveSplitTargets(syntheticImage(0x1000, 0x100f), "lo_hi_address");
    assert.deepEqual(
      [...original.targets],
      [0x0800, 0x0901, 0x0a02, 0x0b03, 0x0c04, 0x0d05, 0x0e06, 0x0f07],
      "the original eight targets over the 00 01 02 ... 0f image, as the round-6 verification report records them",
    );
    const surviving = survivingSplitTargets(rows, 0x1000, 0x100f);
    assert.deepEqual(
      surviving,
      [0x0200, 0x0301, 0x0c08, 0x0d09, 0x0e0a, 0x0f0b],
      "what the two surviving split rows resolve to now, over the SAME bytes",
    );
    assert.deepEqual(
      surviving.filter((target) => original.targets.includes(target)),
      [],
      `the two target sets are DISJOINT: decodability is not preservation, and every surviving row here decodes cleanly to a value ` +
        `the human who typed this table never recorded. original: ${[...original.targets]} ; surviving: ${surviving}`,
    );

    // THE ROUND TRIP, on this one case: a row the store returned is a row the
    // store would accept. The class-level statement of it is the invariant
    // further down; this is the instance the gap was reported against.
    for (const row of rows) {
      setDataType(store, { start: row.start, endInclusive: row.endInclusive, dataType: row.dataType });
    }
  });
});

test("CR-10 idempotency: the identical repeat of an accepted fragmenting write reports changed:false and an EMPTY report", () => {
  // A second disclosure of a fragmentation that already happened would be a
  // FALSE report -- nothing was fragmented by this call. The field is EMPTY
  // rather than absent, so the caller still reads it unconditionally.
  inFreshStore((store) => {
    seedSplitRow(store);
    const first = setDataType(store, { start: 0x1004, endInclusive: 0x1007, dataType: "byte" });
    assert.equal(first.reinterpretedSplitTables.length, 1, "the first write fragments the table and says so");

    const again = setDataType(store, { start: 0x1004, endInclusive: 0x1007, dataType: "byte" });
    assert.equal(again.changed, false, "the identical write is a no-op on the row set");
    assert.deepEqual(again.reinterpretedSplitTables, [], "and it discloses nothing, because it cost nothing");
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

/**
 * ONE HAND-DERIVED EXPECTATION of what a fragmenting write DISCLOSED.
 *
 * EVERY COUPLE IN EVERY ENTRY BELOW IS WRITTEN OUT FROM THE LAYOUT RULE IN
 * WORDS -- a table of `n` entries pairs its own byte `i` with its own byte
 * `n + i` -- and this file deliberately does NOT import the production pairing
 * function. That makes the table an INDEPENDENT ORACLE rather than the
 * implementation checking itself, the same pattern `anno-index.test.ts` uses for
 * its narrowest-wins oracle. Importing `resolveSplitTargets` IS expected and
 * correct: it is the module's authority on what a row MEANS, and the round-6
 * verifier names it as the observation for this class.
 */
interface ExpectedReinterpretation {
  readonly rowStart: number;
  readonly rowEndInclusive: number;
  readonly dataType: DataType;
  readonly entryPairsBefore: readonly (readonly [number, number])[];
  readonly survivors: readonly {
    readonly start: number;
    readonly endInclusive: number;
    readonly entryPairs: readonly (readonly [number, number])[];
  }[];
  readonly preservedCount: number;
}

/** The eight couples the 16-byte `$1000..$100f` seed reads BEFORE any write:
 * n = 8, so entry `i` reads offset `i` and offset `8 + i`. Written out once by
 * hand and shared by every entry below, because it is the same table. */
const SEED_PAIRS_BEFORE: readonly (readonly [number, number])[] = [
  [0x1000, 0x1008],
  [0x1001, 0x1009],
  [0x1002, 0x100a],
  [0x1003, 0x100b],
  [0x1004, 0x100c],
  [0x1005, 0x100d],
  [0x1006, 0x100e],
  [0x1007, 0x100f],
];

/** The 4-byte head `$1000..$1003` as a TWO-entry table: entry `i` reads `i` and `2 + i`. */
const HEAD_1000_1003: readonly (readonly [number, number])[] = [
  [0x1000, 0x1002],
  [0x1001, 0x1003],
];

/** The 8-byte tail `$1008..$100f` as a FOUR-entry table: entry `i` reads `i` and `4 + i`. */
const TAIL_1008_100F: readonly (readonly [number, number])[] = [
  [0x1008, 0x100c],
  [0x1009, 0x100d],
  [0x100a, 0x100e],
  [0x100b, 0x100f],
];

/** The 8-byte head `$1000..$1007` as a FOUR-entry table. */
const HEAD_1000_1007: readonly (readonly [number, number])[] = [
  [0x1000, 0x1004],
  [0x1001, 0x1005],
  [0x1002, 0x1006],
  [0x1003, 0x1007],
];

interface SplitOverlapCase {
  /** The case number from the five-case table in this file's header. */
  readonly n: number;
  readonly name: string;
  /** `[c, d]` -- the new range. */
  readonly c: number;
  readonly d: number;
  readonly predicate: string;
  /** What the case retypes the new range TO. Defaults to `byte`; the SAME-TYPE
   * subrange geometry sets it to `lo_hi_address`, so that case lives in the
   * table rather than as a one-off test outside it. */
  readonly newType?: DataType;
  /** What the write is expected to DISCLOSE. Absent means "the array is empty",
   * and the per-case test asserts that POSITIVELY -- never by omission, so a
   * full-cover case is checked to report nothing rather than merely not
   * checked. */
  readonly reinterpreted?: readonly ExpectedReinterpretation[];
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
    reinterpreted: [
      {
        rowStart: 0x1000,
        rowEndInclusive: 0x100f,
        dataType: "lo_hi_address",
        entryPairsBefore: SEED_PAIRS_BEFORE,
        survivors: [
          { start: 0x1000, endInclusive: 0x1003, entryPairs: HEAD_1000_1003 },
          { start: 0x1008, endInclusive: 0x100f, entryPairs: TAIL_1008_100F },
        ],
        preservedCount: 0,
      },
    ],
    why: "head 4 bytes and tail 8 bytes -- both even, both legal lo_hi_address tables, and BOTH re-paired: an 8-entry table becomes a 2-entry and a 4-entry one, sharing not one couple with the original",
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
    reinterpreted: [
      {
        rowStart: 0x1000,
        rowEndInclusive: 0x100f,
        dataType: "lo_hi_address",
        entryPairsBefore: SEED_PAIRS_BEFORE,
        survivors: [{ start: 0x1008, endInclusive: 0x100f, entryPairs: TAIL_1008_100F }],
        preservedCount: 0,
      },
    ],
    why: "tail $1008..$100f is 8 bytes -- even, and re-paired: the surviving four entries read four couples the original table never had",
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
    reinterpreted: [
      {
        rowStart: 0x1000,
        rowEndInclusive: 0x100f,
        dataType: "lo_hi_address",
        entryPairsBefore: SEED_PAIRS_BEFORE,
        survivors: [{ start: 0x1000, endInclusive: 0x1007, entryPairs: HEAD_1000_1007 }],
        preservedCount: 0,
      },
    ],
    why: "head $1000..$1007 is 8 bytes -- even, and re-paired: the caller's range runs PAST the table's end, so this is the geometry a reader is least likely to think of as an edit to the table at all",
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
  {
    n: 5,
    name: "MIDPOINT split -- the caller's range abuts the table's exact halfway point",
    c: 0x1008,
    d: SPLIT_B,
    predicate: "a < c && c <= b && d >= b",
    rows: [
      [0x1000, 0x1007, "lo_hi_address"],
      [0x1008, 0x100f, "byte"],
    ],
    reinterpreted: [
      {
        rowStart: 0x1000,
        rowEndInclusive: 0x100f,
        dataType: "lo_hi_address",
        entryPairsBefore: SEED_PAIRS_BEFORE,
        survivors: [{ start: 0x1000, endInclusive: 0x1007, entryPairs: HEAD_1000_1007 }],
        preservedCount: 0,
      },
    ],
    why:
      "THE SHARPEST INSTANCE OF ADJACENCY, not a duplicate of the even-head entry above it: that one's range runs PAST the table, " +
      "while this one ENDS exactly at b, cutting the 16-byte table at its own halfway point $1007/$1008 -- the single boundary a " +
      "reader most expects the two halves to survive. It preserves nothing either. Every one of the surviving four entries now " +
      "reads its partner 4 bytes away instead of 8",
  },
  {
    n: 3,
    name: "SAME-TYPE subrange -- lo_hi_address over a sub-range of a lo_hi_address table",
    c: 0x1004,
    d: 0x1007,
    predicate: "a < c && d < b",
    newType: "lo_hi_address",
    rows: [
      [0x1000, 0x1003, "lo_hi_address"],
      [0x1008, 0x100f, "lo_hi_address"],
      [0x1004, 0x1007, "lo_hi_address"],
    ],
    reinterpreted: [
      {
        rowStart: 0x1000,
        rowEndInclusive: 0x100f,
        dataType: "lo_hi_address",
        entryPairsBefore: SEED_PAIRS_BEFORE,
        survivors: [
          { start: 0x1000, endInclusive: 0x1003, entryPairs: HEAD_1000_1003 },
          { start: 0x1008, endInclusive: 0x100f, entryPairs: TAIL_1008_100F },
        ],
        preservedCount: 0,
      },
    ],
    why:
      "THE SHARPEST INSTANCE OF THE FULLY-INSIDE GEOMETRY, not a duplicate of the even-remainder entry above it: nothing about the " +
      "TYPE changed anywhere. The caller asked for lo_hi_address over a sub-range of a lo_hi_address table and got three " +
      "lo_hi_address tables, none of whose couples is one of the original eight. ONE record with TWO survivors -- survivors are not " +
      "records, so this case says nothing about the report's ARRAY order; the two-row SEQUENCE step covers that",
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
  assert.equal(SPLIT_CASES.length, 10, "ten entries -- eight, plus the midpoint split and the same-type subrange; a shrunken table is a weakened proof");
  assert.equal(
    SPLIT_CASES.filter((k) => k.refused === true).length,
    3,
    "three refusing entries: cases 3, 4 and 5 with an odd remainder. UNCHANGED at 3 on purpose -- see the reinterpreting floor below",
  );
  assert.equal(SPLIT_CASES.filter((k) => k.rows !== undefined).length, 7, "seven entries whose row set is asserted by value");

  // THE FOURTH FLOOR, added with CR-10. The three counts above were all
  // satisfiable by a table that had quietly lost the geometries whose remainder
  // is LEGAL -- which is the half CR-10 lives in. This one makes a lost
  // fragmenting geometry visible.
  assert.equal(
    SPLIT_CASES.filter((k) => k.reinterpreted !== undefined && k.reinterpreted.length > 0).length,
    5,
    "five entries assert a DISCLOSURE by value: the even-remainder fully-inside case, the even tail, the even head, the midpoint " +
      "split and the same-type subrange. A table that silently lost one of them would still satisfy the three counts above",
  );

  // Every expectation in the table names a preserved count of ZERO, and that is
  // a consequence of the layout rather than a convention: no proper fragment of
  // a split table preserves a single entry pair, at any boundary.
  for (const kase of SPLIT_CASES) {
    for (const expected of kase.reinterpreted ?? []) {
      assert.equal(expected.preservedCount, 0, `case ${kase.n} (${kase.name}): no proper fragment preserves a couple, at any boundary`);
    }
  }
});

for (const kase of SPLIT_CASES) {
  const outcome = kase.refused === true ? "REFUSED" : "row set by value";
  test(`split overlap case ${kase.n} (${kase.name}) over $1000..$100f lo_hi_address -> ${outcome}`, () => {
    const r = runCase(kase, productionRetype, {
      seedStart: SPLIT_A,
      seedEndInclusive: SPLIT_B,
      seedType: "lo_hi_address",
      newType: kase.newType ?? "byte",
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

    // THE DISCLOSURE, BY VALUE (CR-10). Asserted for EVERY accepted entry --
    // never omitted -- so the two full-cover geometries are positively checked to
    // report NOTHING rather than merely left unchecked. They report nothing
    // because no remainder exists, so no preservation is claimed and none is
    // owed.
    assert.deepEqual(
      (r.result?.reinterpretedSplitTables ?? []).map((record) => ({
        rowStart: record.rowStart,
        rowEndInclusive: record.rowEndInclusive,
        dataType: record.dataType,
        entryPairsBefore: record.entryPairsBefore.map((pair) => [pair[0], pair[1]]),
        survivors: record.survivors.map((survivor) => ({
          start: survivor.start,
          endInclusive: survivor.endInclusive,
          entryPairs: survivor.entryPairs.map((pair) => [pair[0], pair[1]]),
        })),
        preservedCount: record.preservedEntryPairs.length,
      })),
      (kase.reinterpreted ?? []).map((expected) => ({
        rowStart: expected.rowStart,
        rowEndInclusive: expected.rowEndInclusive,
        dataType: expected.dataType,
        entryPairsBefore: expected.entryPairsBefore.map((pair) => [pair[0], pair[1]]),
        survivors: expected.survivors.map((survivor) => ({
          start: survivor.start,
          endInclusive: survivor.endInclusive,
          entryPairs: survivor.entryPairs.map((pair) => [pair[0], pair[1]]),
        })),
        preservedCount: expected.preservedCount,
      })),
      `case ${kase.n} (${kase.name}): the write must disclose exactly what it cost -- both entry-pair sets, hand-derived`,
    );
  });
}

test("CR-10, THE TARGET-SET COMPARISON over every accepted split geometry: what the surviving rows DECODE TO shares nothing with what the table recorded", () => {
  // THE ONLY OBSERVATION THAT CAN SEE THIS CLASS. Parity cannot: every fragment
  // here is even. The row set cannot: it is correct. The round-trip invariant's
  // decodability check cannot: a re-paired table decodes perfectly. Only
  // resolving the SAME bytes before and after and comparing the 16-bit targets
  // distinguishes "still documented" from "documented wrong".
  const original = resolveSplitTargets(syntheticImage(SPLIT_A, SPLIT_B), "lo_hi_address");
  assert.deepEqual(
    [...original.targets],
    [0x0800, 0x0901, 0x0a02, 0x0b03, 0x0c04, 0x0d05, 0x0e06, 0x0f07],
    "the eight targets the seed table records over the 00 01 02 ... 0f image",
  );

  let fragmenting = 0;
  let fullCover = 0;
  for (const kase of SPLIT_CASES) {
    if (kase.refused === true) continue;
    const r = runCase(kase, productionRetype, {
      seedStart: SPLIT_A,
      seedEndInclusive: SPLIT_B,
      seedType: "lo_hi_address",
      newType: kase.newType ?? "byte",
    });
    const surviving = survivingSplitTargets(r.after, SPLIT_A, SPLIT_B);
    const label = `case ${kase.n} (${kase.name})`;

    if ((kase.reinterpreted ?? []).length === 0) {
      // A full cover leaves NO split row inside the seed span, so there is
      // nothing to compare -- and nothing was claimed preserved.
      fullCover += 1;
      assert.deepEqual(surviving, [], `${label}: a full cover leaves no surviving split row to compare, so no preservation is claimed`);
      continue;
    }

    fragmenting += 1;
    assert.ok(surviving.length > 0, `${label}: a fragmenting geometry must leave a surviving split row, or the comparison is vacuous`);
    const kept = surviving.filter((target) => original.targets.includes(target));
    assert.deepEqual(
      kept,
      [],
      `${label}: the surviving rows decode CLEANLY to values the table never recorded. original: ` +
        `${[...original.targets].map((t) => `$${t.toString(16).padStart(4, "0")}`).join(" ")} ; surviving: ` +
        `${surviving.map((t) => `$${t.toString(16).padStart(4, "0")}`).join(" ")}. Decodability is not preservation`,
    );
  }

  assert.equal(fragmenting, 5, "all five fragmenting geometries were compared, not one");
  assert.equal(fullCover, 2, "and both full-cover geometries were checked to leave nothing to compare");
});

test("CR-10, THE ROUND-6 VERIFIER'S OWN FIVE DRIVES, re-run verbatim through production entry points", () => {
  // The five geometries the round-6 verification report drove, at ITS OWN caller
  // ranges -- two of which (the head-overlap and the tail-overlap) are not the
  // ranges the case table above happens to use. Re-driven here so the report's
  // numbers are reproduced literally rather than approximated by a neighbouring
  // geometry, and so a later reader can line this test up with the report line
  // for line.
  const original = resolveSplitTargets(syntheticImage(SPLIT_A, SPLIT_B), "lo_hi_address");
  const drives: readonly {
    readonly name: string;
    readonly c: number;
    readonly d: number;
    readonly newType: DataType;
    readonly survivingRows: number;
    readonly survivingTargets: readonly number[];
    readonly survivorPairCounts: readonly number[];
  }[] = [
    { name: "mid EVEN fragment", c: 0x1004, d: 0x1007, newType: "byte", survivingRows: 2, survivingTargets: [0x0200, 0x0301, 0x0c08, 0x0d09, 0x0e0a, 0x0f0b], survivorPairCounts: [2, 4] },
    { name: "head-overlap", c: 0x0ffe, d: 0x1003, newType: "byte", survivingRows: 1, survivingTargets: [0x0a04, 0x0b05, 0x0c06, 0x0d07, 0x0e08, 0x0f09], survivorPairCounts: [6] },
    { name: "tail-overlap", c: 0x100c, d: 0x1011, newType: "byte", survivingRows: 1, survivingTargets: [0x0600, 0x0701, 0x0802, 0x0903, 0x0a04, 0x0b05], survivorPairCounts: [6] },
    { name: "midpoint split", c: 0x1008, d: 0x100f, newType: "byte", survivingRows: 1, survivingTargets: [0x0400, 0x0501, 0x0602, 0x0703], survivorPairCounts: [4] },
    { name: "SAME-TYPE subrange", c: 0x1004, d: 0x1007, newType: "lo_hi_address", survivingRows: 3, survivingTargets: [0x0200, 0x0301, 0x0c08, 0x0d09, 0x0e0a, 0x0f0b, 0x0604, 0x0705], survivorPairCounts: [2, 4] },
  ];

  for (const drive of drives) {
    inFreshStore((store) => {
      seedSplitRow(store);
      const result = setDataType(store, { start: drive.c, endInclusive: drive.d, dataType: drive.newType });
      assert.equal(result.changed, true, `${drive.name}: ACCEPTED, exactly as the report records`);
      assert.deepEqual(result.contradictedComments, [], `${drive.name}: contradicted=0, exactly as the report records`);

      const rows = listRanges(store);
      const splitRows = rows.filter((row) => isSplitDataType(row.dataType) && row.start >= SPLIT_A && row.endInclusive <= SPLIT_B);
      assert.equal(splitRows.length, drive.survivingRows, `${drive.name}: the number of surviving split rows the report records`);

      const surviving = survivingSplitTargets(rows, SPLIT_A, SPLIT_B);
      assert.deepEqual(surviving, [...drive.survivingTargets], `${drive.name}: the surviving target set the report records, by value`);
      assert.deepEqual(
        surviving.filter((target) => original.targets.includes(target)),
        [],
        `${drive.name}: preserved 0 of 8 -- the report's own verdict, re-observed`,
      );

      // AND THE DIFFERENCE THIS ROUND MAKES: the report says the call was silent.
      // It is not any more.
      assert.equal(result.reinterpretedSplitTables.length, 1, `${drive.name}: ONE overlapped row was fragmented, so ONE record`);
      const record = result.reinterpretedSplitTables[0];
      assert.equal(record.entryCountBefore, 8, `${drive.name}: the record says the table WAS 16 bytes wide -- the fact nothing recorded before`);
      assert.deepEqual(
        record.survivors.map((survivor) => survivor.entryCount),
        [...drive.survivorPairCounts],
        `${drive.name}: each survivor's entry count, head then tail`,
      );
      assert.deepEqual(record.preservedEntryPairs, [], `${drive.name}: and it says, in its own report, that it preserved nothing`);
    });
  }
});

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
  /** How many OVERLAPPED SPLIT ROWS this step re-interprets -- derived from the
   * step's own geometry against the state the previous steps left, never copied
   * from a run. Zero for a refused step (it returns nothing at all), zero for a
   * step over non-split rows, and zero for a step that FULLY COVERS a split row
   * (nothing survives, so no preservation is claimed and none is owed). */
  readonly expectReinterpretedRows: number;
  readonly note: string;
}

/** A canonical key for one entry-address couple, so the set arithmetic in the
 * invariant below is exact. */
function pairKey(low: number, high: number): string {
  return `${low}:${high}`;
}

/** Renders a couple set for a failure message -- BY VALUE, because "two sets
 * differ" does not tell a reader which region stopped meaning what it said. */
function describePairKeys(keys: Iterable<string>): string {
  const rendered = [...keys]
    .sort()
    .map((key) => {
      const [low, high] = key.split(":").map(Number);
      return `($${low.toString(16).padStart(4, "0")},$${high.toString(16).padStart(4, "0")})`;
    });
  return rendered.length === 0 ? "(none)" : rendered.join(" ");
}

/**
 * Every entry-address couple across every split row in a `listRanges()` result.
 *
 * HAND-WRITTEN FROM THE LAYOUT RULE, and it must stay that way: a table of `n`
 * entries pairs its own byte `i` with its own byte `n + i`. It deliberately does
 * NOT import the production pairing function, so the invariant below is an
 * INDEPENDENT ORACLE rather than the implementation agreeing with itself -- the
 * same rule the `SPLIT_CASES` expectations follow. Split membership IS asked
 * through the exported `isSplitDataType`, because a hand-written list of the four
 * names here would be a second copy of the vocabulary (`anno-types.ts` trap 2).
 */
function splitPairsOf(rows: readonly RangeRow[]): Set<string> {
  const pairs = new Set<string>();
  for (const row of rows) {
    if (!isSplitDataType(row.dataType)) continue;
    const n = (row.endInclusive - row.start + 1) / 2;
    for (let i = 0; i < n; i += 1) pairs.add(pairKey(row.start + i, row.start + n + i));
  }
  return pairs;
}

/**
 * Drops every couple whose BOTH addresses lie inside `start..endInclusive`.
 *
 * WHY THE CARVE-OUT EXISTS: a couple the caller's own range wholly contains is a
 * couple the caller explicitly asked to retype. It is not "un-documented
 * silently" -- the caller named those addresses. A couple STRADDLING the
 * caller's boundary is the opposite: half of it was never mentioned, and the
 * region it belongs to keeps an annotation whose meaning changed.
 *
 * WHY IT IS APPLIED TO BOTH SIDES OF THE COMPARISON, and why ONE-SIDED IS WRONG
 * rather than merely different. The carve-out is a property of the COMPARISON,
 * never of the report -- the store carves nothing out of what it discloses. A
 * fragmenting write whose caller range wholly contains an entry pair (any range
 * covering 9 or more contiguous bytes of a 16-byte split row does) has that pair
 * in the overlapped row's `entryPairsBefore`, and therefore on the REPORTED side
 * too. Carving it out of the lost side alone makes the two sides differ by
 * exactly those pairs, and REDS ON A CORRECT WRITE.
 *
 * No step in today's `SEQUENCE` covers more than 8 contiguous bytes of a split
 * row, which is the ONLY reason a one-sided form would look green here. It is
 * written symmetrically now rather than left as a trap for the next geometry
 * somebody adds -- and the second planting below is the lost-side-only widening
 * that proves the symmetry is load-bearing.
 */
function dropContained(keys: Iterable<string>, start: number, endInclusive: number): Set<string> {
  const kept = new Set<string>();
  for (const key of keys) {
    const [low, high] = key.split(":").map(Number);
    if (low >= start && high <= endInclusive) continue;
    kept.add(key);
  }
  return kept;
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
  // The four "both even" notes below used to stop at "both even" -- which is
  // TRUE and was never the whole story. An even remainder passes the parity gate
  // and is still RE-PAIRED, so each note now says what the step actually does:
  // accepted AND reported.
  { start: 0x1004, endInclusive: 0x1007, dataType: "byte", expect: "accepted", expectReinterpretedRows: 1, note: "lo_hi_address, head 4 and tail 8 -- both even, so accepted; both re-paired, so REPORTED" },
  { start: 0x1004, endInclusive: 0x1007, dataType: "byte", expect: "accepted", expectReinterpretedRows: 0, note: "the identical write again -- idempotency, and it discloses NOTHING because it fragments nothing" },
  { start: 0x1105, endInclusive: 0x1105, dataType: "byte", expect: "refused", expectReinterpretedRows: 0, note: "hi_lo_address, head $1100..$1104 is 5 bytes -- odd; a refusal returns nothing at all, so no report" },
  { start: 0x1102, endInclusive: 0x1109, dataType: "code", expect: "accepted", expectReinterpretedRows: 1, note: "hi_lo_address, head 2 and tail 6 -- both even, so accepted; the 8-entry table becomes a 1-entry and a 3-entry one, so REPORTED" },
  { start: 0x1203, endInclusive: 0x120f, dataType: "code", expect: "refused", expectReinterpretedRows: 0, note: "lo_hi_word, head $1200..$1202 is 3 bytes -- odd" },
  { start: 0x1200, endInclusive: 0x1205, dataType: "petscii", expect: "accepted", expectReinterpretedRows: 1, note: "lo_hi_word, no head, tail 10 -- even, so accepted; the surviving 5 entries read 5 couples the table never had, so REPORTED" },
  { start: 0x1300, endInclusive: 0x1300, dataType: "word", expect: "refused", expectReinterpretedRows: 0, note: "hi_lo_word, tail $1301..$130f is 15 bytes -- odd" },
  { start: 0x130a, endInclusive: 0x130f, dataType: "screencode", expect: "accepted", expectReinterpretedRows: 1, note: "hi_lo_word, head 10 -- even and no tail, so accepted; the head is re-paired, so REPORTED" },
  { start: 0x1404, endInclusive: 0x1407, dataType: "word", expect: "accepted", expectReinterpretedRows: 0, note: "a non-split row -- its remainders can never be illegal, and its meaning does not depend on its extent, so nothing to report" },
  { start: 0x1400, endInclusive: 0x140f, dataType: "address", expect: "accepted", expectReinterpretedRows: 0, note: "a union retype spanning all three rows of $1400 -- none of them split" },
  { start: 0x1408, endInclusive: 0x140b, dataType: "lo_hi_address", expect: "accepted", expectReinterpretedRows: 0, note: "CREATES a split row inside a non-split one -- a creation fragments nothing, so nothing to report" },
  // THE ORDERING CASE, and the only one in this file where the report's ARRAY
  // ORDER has anything to say. By this point the sequence has left
  // `$1206..$120f lo_hi_word` (step 5) and `$1300..$1309 hi_lo_word` (step 7) on
  // disk. This range takes the last two bytes of the first (head remainder
  // `$1206..$120d`, 8 bytes, even) and the first two of the second (tail
  // remainder `$1302..$1309`, 8 bytes, even), so BOTH remainders pass the parity
  // gate and BOTH rows are re-interpreted -- ONE write, TWO records.
  { start: 0x120e, endInclusive: 0x1301, dataType: "byte", expect: "accepted", expectReinterpretedRows: 2, note: "spans the TAIL of one split row and the HEAD of another -- one write, TWO records, ordered by ascending row id" },
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
  let reinterpretingSteps = 0;
  let totalReportedLostPairs = 0;

  inFreshStore((store) => {
    seedSequenceStore(store);
    assert.deepEqual(
      rowsTheStoreWouldRefuse(listRanges(store)),
      [],
      "the seed itself is round-trippable -- otherwise the sequence starts already violating the invariant",
    );

    for (const [i, step] of SEQUENCE.entries()) {
      const rowsBefore = listRanges(store);
      const pairsBefore = splitPairsOf(rowsBefore);
      const revisionBefore = currentRevision(store);
      let thrown: unknown = null;
      let result: SetDataTypeResult | null = null;
      try {
        result = setDataType(store, { start: step.start, endInclusive: step.endInclusive, dataType: step.dataType });
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
        assert.equal(step.expectReinterpretedRows, 0, `step ${i}: a refused step returns nothing at all, so its expectation must be 0`);
      } else {
        accepted += 1;
        assert.equal(thrown, null, `step ${i} (${step.note}): expected acceptance, got ${String(thrown)}`);

        const records = result?.reinterpretedSplitTables ?? [];
        assert.equal(
          records.length,
          step.expectReinterpretedRows,
          `step ${i} (${step.note}): the store's own count of re-interpreted split rows must match the step's declared geometry`,
        );
        if (records.length > 0) reinterpretingSteps += 1;

        // ---------------------------------------------------------------
        // THE CLASS INVARIANT (CR-10). Stated over ENTRY PAIRS, not rows.
        // ---------------------------------------------------------------
        // The round-trip invariant below asks that every surviving row be
        // re-acceptable and DECODABLE, and a re-paired split table is both --
        // which is exactly why 210 green tests were blind to this class. What
        // follows is the assertion that can see it:
        //
        //   NO SPLIT ENTRY PAIR DISAPPEARS OUTSIDE THE CALLER'S OWN RANGE
        //   WITHOUT BEING NAMED BY THAT WRITE'S OWN REPORT.
        //
        // `dropContained` is applied to BOTH sides -- the lost side and the
        // reported side -- because the carve-out belongs to the COMPARISON and
        // never to the report. See its doc comment for why one-sided reds on a
        // correct write.
        const pairsAfter = splitPairsOf(listRanges(store));
        const vanished = [...pairsBefore].filter((key) => !pairsAfter.has(key));
        const reportedLost = records.flatMap((record) => {
          const preserved = new Set(record.preservedEntryPairs.map((pair) => pairKey(pair[0], pair[1])));
          return record.entryPairsBefore.map((pair) => pairKey(pair[0], pair[1])).filter((key) => !preserved.has(key));
        });
        totalReportedLostPairs += reportedLost.length;

        const lost = dropContained(vanished, step.start, step.endInclusive);
        const reported = dropContained(reportedLost, step.start, step.endInclusive);
        assert.deepEqual(
          [...lost].sort(),
          [...reported].sort(),
          `step ${i} (${step.note}): a split entry pair vanished outside the caller's own range and the write did not name it. ` +
            `An unreported lost pair is a region left annotated with a meaning it does not have -- which is the exact failure this ` +
            `store exists to prevent, and it is not caught by re-acceptability or by decodability. ` +
            `lost-and-unreported: ${describePairKeys([...lost].filter((key) => !reported.has(key)))} ; ` +
            `reported-but-not-lost: ${describePairKeys([...reported].filter((key) => !lost.has(key)))} ; ` +
            `lost: ${describePairKeys(lost)} ; reported: ${describePairKeys(reported)}`,
        );

        // THE ORDERING CASE, asserted on the ONE step that produces two records.
        // The expectation is derived from the ids the STORE ITSELF reported
        // BEFORE the write, sorted ascending -- not from address order, and not
        // from a pinned id value that a later re-insertion may legitimately
        // change. That is what makes this discriminate `order by id` from
        // `order by address` instead of restating one as the other.
        if (step.expectReinterpretedRows === 2) {
          const overlappedSplitIds = rowsBefore
            .filter(
              (row) =>
                isSplitDataType(row.dataType) &&
                row.endInclusive >= step.start &&
                row.start <= step.endInclusive &&
                (row.start < step.start || row.endInclusive > step.endInclusive),
            )
            .map((row) => row.id)
            .sort((x, y) => x - y);
          assert.equal(overlappedSplitIds.length, 2, `step ${i}: the ordering case must overlap exactly TWO split rows leaving a remainder`);
          assert.deepEqual(
            records.map((record) => record.rowId),
            overlappedSplitIds,
            `step ${i}: the report's array order is ASCENDING OVERLAPPED-ROW ID, matching the gate's own \`order by id\``,
          );
          for (const record of records) {
            assert.deepEqual(record.preservedEntryPairs, [], `step ${i}: neither re-interpreted row preserved a couple`);
          }
        }
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
  assert.ok(accepted >= 9, `the sequence must actually write: ${accepted} accepted writes, expected at least 9`);
  // THE REFUSAL FLOOR DOES NOT RISE, and that is a consequence of the answer
  // taken rather than an oversight. The round-6 verification report's `missing`
  // item 3 says "the `refusals >= 3` non-vacuity floor rises with them" -- that
  // sentence was written for ANSWER (a), which refuses every partial overlap of
  // a split row. The answer actually taken is (b): the even fragmentation is
  // ACCEPTED and REPORTED, so parity remains the ONLY thing this store refuses
  // and the three parity refusals are still the whole refusal set. The floor
  // that rises instead is `reinterpretingSteps` immediately below. The
  // divergence from the verifier's instruction is recorded here rather than left
  // to look like a forgotten line.
  assert.ok(refusals >= 3, `the sequence must actually exercise the refusal path: ${refusals} refusals, expected at least 3`);
  assert.ok(finalSplitRows >= 4, `the invariant must be asked about split rows: ${finalSplitRows} split rows survive, expected at least 4`);
  assert.equal(finalRows, 14, "the sequence's final row count, pinned so a silently shortened sequence is visible");

  // THE TWO FLOORS CR-10 ADDS. Without them a sequence that quietly stopped
  // FRAGMENTING anything -- every step landing on an entry boundary, say --
  // would satisfy the class invariant trivially by having nothing to compare,
  // which is the failure mode this whole round exists to close.
  assert.equal(
    reinterpretingSteps,
    5,
    `the sequence must actually fragment split tables: ${reinterpretingSteps} steps returned a non-empty report, expected exactly 5`,
  );
  assert.equal(
    totalReportedLostPairs,
    42,
    `the total entry pairs the sequence's own reports account for as lost: ${totalReportedLostPairs}. Pinned exactly, so a silently ` +
      "shortened sequence or a report that quietly narrowed is visible as a number rather than as a still-passing test",
  );
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
): null {
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
  return null; // see `retypeByFilterAndInsert` -- a planting has no report.
}

test("planting C, OBSERVED: the same sequence through a writer without the remainder rule leaves rows the store would refuse, named by value", () => {
  // Checked after EVERY step, exactly as the invariant above checks it, so the
  // planting is caught at the step that introduces the violation rather than
  // only at the end -- a later step can delete an offending row and hide it.
  let firstOffendingStep = -1;
  let firstOffenders!: { row: RangeRow; reason: string }[];
  let refusedAfterStep10!: { row: RangeRow; reason: string }[];
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
      // The state at the end of the ORIGINAL eleven steps, captured separately
      // -- see the comment on `refusedAfterStep10` below for why the final
      // state is no longer the right place to ask this question.
      if (i === 10) refusedAfterStep10 = refused;
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

  // ...and one survives ALL ELEVEN of the sequence's original steps, so the
  // damage is not merely transient: an odd hi_lo_word row nothing between step 2
  // and step 10 overwrites.
  assert.deepEqual(
    refusedAfterStep10.map(({ row }) => ({ start: row.start, endInclusive: row.endInclusive, dataType: row.dataType })),
    [{ start: 0x1301, endInclusive: 0x1309, dataType: "hi_lo_word" }],
    `the offending rows left standing after the original eleven steps: ${describeRefused(refusedAfterStep10)}`,
  );

  // AND THEN THE TWELFTH STEP CLEANS IT UP BY ACCIDENT, which is recorded here
  // rather than hidden. Step 11 (`$120e..$1301`) was added for the report's
  // ORDERING case, and under the PLANTING it clips exactly one byte off the head
  // of that surviving `$1301..$1309` row, leaving an EVEN `$1302..$1309` -- a row
  // the store would accept. So the planting's last standing offender disappears,
  // for a reason that has nothing to do with the remainder rule.
  //
  // THIS IS WHY THE SURVIVAL CLAIM IS ASKED AT STEP 10 AND NOT AT THE END. An
  // accidental cleanup is not evidence that the planting is harmless, and moving
  // the assertion to where the claim is actually true is the honest repair; the
  // alternative -- asserting an empty final set and calling it the expectation --
  // would quietly retire a control that still discriminates.
  assert.deepEqual(
    finalRefused.map(({ row }) => ({ start: row.start, endInclusive: row.endInclusive, dataType: row.dataType })),
    [],
    `after the twelfth step the planting leaves nothing refused, because that step's range overlaps the odd row's head and the ` +
      `remainder happens to be even: ${describeRefused(finalRefused)}`,
  );
});

test("planting C, SELECTIVE and MEASURED: it can differ from the production path on exactly the three steps whose remainder is illegal, and is indistinguishable on the other nine", () => {
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
  assert.deepEqual(
    identical,
    [0, 1, 3, 5, 7, 8, 9, 10, 11],
    "and on the other nine it produces the identical row set -- which is why a table of legal-only cases would let it through. " +
      "Step 11 joins this list rather than `differs` for the reason CR-10 exists: applied alone to the SEED, its two remainders " +
      "($1200..$120d and $1302..$130f, 14 bytes each) are both EVEN, so the parity gate has nothing to say and the planting is " +
      "indistinguishable from the production path ON THE ROW SET. What distinguishes them there is the REPORT, which this " +
      "row-set comparison cannot see -- and that is precisely why the class invariant above is stated over entry pairs",
  );
});
