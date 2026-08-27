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
import { ADDRESS_MAX, ADDRESS_MIN, type DataType, type RangeRow } from "./anno-types.ts";
import { applyWrite, closeStore, listRanges, openStore, setComment, setDataType } from "./anno-store.ts";
import { codeOnly } from "./shipped-modules.ts";

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

/** Runs one case against a retype callback and reports everything both
 * invariants need. The SAME harness drives the production path and the
 * planting, so the two results are comparable by construction rather than by
 * two hand-written measurements that could drift. */
function runCase(
  kase: OverlapCase,
  retype: (store: ReturnType<typeof openStore>, start: number, endInclusive: number, dataType: DataType) => void,
): {
  before: RangeRow[];
  after: RangeRow[];
  beforeCovered: Set<number>;
  afterCovered: Set<number>;
  lost: number[];
} {
  let captured!: {
    before: RangeRow[];
    after: RangeRow[];
    beforeCovered: Set<number>;
    afterCovered: Set<number>;
    lost: number[];
  };
  inFreshStore((store) => {
    setDataType(store, { start: A, endInclusive: B, dataType: "byte" });
    const before = listRanges(store);
    const beforeCovered = coveredAddresses(before);
    retype(store, kase.c, kase.d, "code");
    const after = listRanges(store);
    const afterCovered = coveredAddresses(after);
    captured = { before, after, beforeCovered, afterCovered, lost: lostAddresses(beforeCovered, afterCovered) };
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
