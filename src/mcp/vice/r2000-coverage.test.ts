// r2000-coverage.test.ts -- the six committed controls, the schema pin, the
// independence proof, and the reproducibility seal.
//
// WHY THIS FILE IS SHAPED THE WAY IT IS: a coverage instrument's own failure
// mode is a FALSELY-CLEAN VERDICT (T-19-14). An instrument that fails
// everything measures nothing, and an instrument that passes everything
// measures nothing either. So the controls come in both directions: five
// planted defects that must each be caught by a NAMED measure, and one
// genuinely well-documented program that must come back clean. The last one
// is the non-vacuity control and it is asserted explicitly.
//
// Three named guard classes for the sealed reproducibility evidence, mirroring
// `r2000-answer-key.test.ts`'s own vocabulary:
//
//   1. T-19-SEAL-DRIFT: ANSWER.sha256 silently stops matching ANSWER.md's own
//      canonical line (someone edits one file and forgets the other).
//   2. T-19-LEAK: QUESTION.md ends up containing the answer it asks for, so
//      the bytes route could answer by reading the question instead of by
//      walking the bytes.
//   3. T-19-RETROFIT / T-19-VACUOUS-CHECK: RE-DERIVED-ANSWER.md's own
//      canonical line, hashed under QUESTION.md's exact canonicalisation
//      rules, must equal the sealed ANSWER.sha256 -- and this check must FAIL
//      (never skip) when RE-DERIVED-ANSWER.md is missing or its marker fence
//      is empty, so a non-answer can never read as a vacuous pass.
//
// This file is TEST-ONLY: it is not (and must not be) listed in package.json's
// files[].

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTO_NAME_PREFIX_RE,
  BANNED_GENERIC_COMMENTS,
  COVERAGE_REPORT_KEYS,
  COVERAGE_SCHEMA_VERSION,
  MAX_TABLE_ENTRIES,
  R2000CoverageInputError,
  buildCoverageReport,
  classAt,
  computeCommentVacuity,
  computeLabelRatio,
  computeReproducibility,
  computeStructuralCensus,
  coverageFindings,
  normaliseComment,
  scanIndirectDispatch,
  type CoverageReport,
  type R2000BlockEntry,
  type R2000Comment,
  type R2000CrossReference,
  type R2000Symbol,
} from "./r2000-coverage.ts";
import { decode } from "./disasm-decoder.ts";
import { decodeRawData } from "./r2000-project.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(HERE, "fixtures", "coverage");

// src/mcp/vice -> repo root -> .planning/phases/19-.../evidence/coverage-reproducibility
const EVIDENCE_DIR = join(
  HERE,
  "..",
  "..",
  "..",
  ".planning",
  "phases",
  "19-absorbed-procedures-and-the-coverage-instrument",
  "evidence",
  "coverage-reproducibility",
);
const QUESTION_PATH = join(EVIDENCE_DIR, "QUESTION.md");
const ANSWER_PATH = join(EVIDENCE_DIR, "ANSWER.md");
const ANSWER_SHA_PATH = join(EVIDENCE_DIR, "ANSWER.sha256");
const RE_DERIVED_PATH = join(EVIDENCE_DIR, "RE-DERIVED-ANSWER.md");

const OPEN_MARKER = "<!-- CANONICAL-ANSWER-LINE -->";
const CLOSE_MARKER = "<!-- /CANONICAL-ANSWER-LINE -->";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

interface FixtureStore {
  control: string;
  purpose: string;
  origin: number;
  size: number;
  expect_clean: boolean;
  expect_measure: string | null;
  symbols: R2000Symbol[];
  comments: R2000Comment[];
  blocks: R2000BlockEntry[];
  cross_references: R2000CrossReference[];
}

function fixtureDirs(): string[] {
  return readdirSync(FIXTURE_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function loadFixture(dir: string): { projectPath: string; store: FixtureStore } {
  const projectPath = join(FIXTURE_ROOT, dir, "project.regen2000proj");
  const store = JSON.parse(readFileSync(join(FIXTURE_ROOT, dir, "store.json"), "utf8")) as FixtureStore;
  return { projectPath, store };
}

function reportFor(dir: string, overrides: Partial<FixtureStore> = {}): CoverageReport {
  const { projectPath, store } = loadFixture(dir);
  return buildCoverageReport({
    projectPath,
    symbols: overrides.symbols ?? store.symbols,
    comments: overrides.comments ?? store.comments,
    blocks: overrides.blocks ?? store.blocks,
    crossReferences: overrides.cross_references ?? store.cross_references,
  });
}

const WELL_DOCUMENTED = "nc5-well-documented";

// ---------------------------------------------------------------------------
// Hand-built payloads for the dispatch-scan classes. Each is the SMALLEST
// program that exhibits exactly one idiom, so a failure names the class.
// ---------------------------------------------------------------------------

const DISPATCH_ORIGIN = 0xc000;

/** `jmp ($0002)` -- a ZERO-PAGE vector. Upstream's own walk requires the
 * pointer to lie inside the image, so this idiom is invisible to it. */
const ZP_VECTOR = Uint8Array.from([0x6c, 0x02, 0x00, 0xea, 0xea, 0xea]);

/** `jmp ($c006)` into a three-entry table. Upstream reads exactly ONE entry. */
const MULTI_ENTRY_TABLE = Uint8Array.from([
  0x6c, 0x06, 0xc0, // $c000 jmp ($c006)
  0xea, 0xea, 0xea, // $c003
  0x0c, 0xc0, // $c006 -> $c00c
  0x0e, 0xc0, // $c008 -> $c00e
  0x10, 0xc0, // $c00a -> $c010
  0x60, 0xea, // $c00c
  0x60, 0xea, // $c00e
  0x60, 0xea, // $c010
]);

/** Two indexed loads whose bases are three apart -- a split lo/hi table. */
const SPLIT_TABLE = Uint8Array.from([
  0xbd, 0x10, 0xc0, // $c000 lda $c010,x   (lo base)
  0xbd, 0x13, 0xc0, // $c003 lda $c013,x   (hi base)
  0x60, // $c006 rts
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $c007..$c00f
  0x06, 0x06, 0x06, // $c010 lo bytes
  0xc0, 0xc0, 0xc0, // $c013 hi bytes
]);

/** `lda hi,x : pha : lda lo,x : pha : rts` -- the stack-return dispatch idiom.
 * Contains NO indirect-jump opcode, so an opcode-keyed walk cannot see it. */
const STACK_RETURN = Uint8Array.from([
  0xbd, 0x10, 0xc0, // $c000 lda $c010,x   (hi table)
  0x48, // $c003 pha
  0xbd, 0x13, 0xc0, // $c004 lda $c013,x   (lo table)
  0x48, // $c007 pha
  0x60, // $c008 rts
  0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // $c009..$c00f
  0xc0, 0xc0, 0xc0, // $c010 hi bytes
  0x05, 0x05, 0x05, // $c013 lo bytes
]);

/** A table whose every entry resolves in-image, far longer than the bound. */
function chainingTable(): Uint8Array {
  const bytes = new Uint8Array(3 + 300);
  bytes[0] = 0x6c;
  bytes[1] = 0x03;
  bytes[2] = 0xc0;
  for (let i = 3; i < bytes.length; i += 2) {
    bytes[i] = 0x00;
    bytes[i + 1] = 0xc0;
  }
  return bytes;
}

function scanOf(bytes: Uint8Array) {
  return scanIndirectDispatch(decode(bytes, DISPATCH_ORIGIN), bytes, DISPATCH_ORIGIN);
}

// ---------------------------------------------------------------------------
// 1. Schema
// ---------------------------------------------------------------------------

test("the report's top-level key set is exactly the pinned set, in order, and carries the schema version", () => {
  const report = reportFor(WELL_DOCUMENTED);
  assert.deepEqual(
    Object.keys(report),
    [...COVERAGE_REPORT_KEYS],
    "the report's top-level key set changed -- Phase 20 reads this shape throughout its sweep and Phase 21 reuses the dispatch scan, " +
      "so a rename here breaks both consumers. Bump COVERAGE_SCHEMA_VERSION deliberately if the change is intended.",
  );
  assert.equal(report.schemaVersion, COVERAGE_SCHEMA_VERSION);
  assert.equal(typeof report.generatedAt, "string");
});

test("COV-01: no key anywhere in the report matches a combined-figure vocabulary", () => {
  // The prohibition is structural, not stylistic: a single aggregate key is
  // exactly what would let a consumer report "78% covered" and lose the three
  // separately-addressable measures the requirement exists to preserve.
  const banned = /overall|combined|aggregate|composite|score|headline|totalcoverage/i;
  const seen: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const v of value) walk(v);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      seen.push(key);
      assert.ok(!banned.test(key), `report key ${JSON.stringify(key)} reads as a combined coverage figure -- COV-01 forbids one`);
      walk(v);
    }
  };
  walk(reportFor(WELL_DOCUMENTED));
  assert.ok(seen.length > 30, `the key walk visited only ${seen.length} keys -- it must actually traverse the report, not stop at the top level`);
});

// ---------------------------------------------------------------------------
// 2. Independence -- the load-bearing structural claim
// ---------------------------------------------------------------------------

test("independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report", () => {
  const before = reportFor(WELL_DOCUMENTED);
  const oneType: R2000BlockEntry[] = [{ start_address: 0x0810, end_address: 0x084f, type: "Byte" }];
  const after = reportFor(WELL_DOCUMENTED, { blocks: oneType });

  for (const key of ["reachedAsInstruction", "tableEntry", "referencedAsData", "unreached", "linearSweepDecodable", "rangeBytes"] as const) {
    assert.equal(
      after.structural[key],
      before.structural[key],
      `mass block-type rewrite moved structural.${key} -- the census must be a pure function of the bytes and the seed set`,
    );
  }
  assert.deepEqual(after.structural.classRuns, before.structural.classRuns);

  assert.equal(before.divergence.censusCodeStoreNotCode, 0);
  assert.ok(
    after.divergence.censusCodeStoreNotCode > 0,
    "the divergence sub-report did not move at all -- if it cannot move, the independence assertion above is vacuous",
  );
});

// ---------------------------------------------------------------------------
// 3. Decodability is not evidence of code
// ---------------------------------------------------------------------------

test("decodability: removing the seed set collapses the reached count, so a census that barely responds to its seeds would fail here", () => {
  const { projectPath } = loadFixture(WELL_DOCUMENTED);
  const project = JSON.parse(readFileSync(projectPath, "utf8")) as { origin: number; raw_data_base64: string };
  const bytes = new Uint8Array(decodeRawData(project.raw_data_base64));

  const seeded = computeStructuralCensus(bytes, project.origin, [project.origin]);
  const seedless = computeStructuralCensus(bytes, project.origin, []);

  assert.ok(seeded.reachedAsInstruction > 0, "the seeded census reached nothing -- the comparison below would be vacuous");
  assert.equal(seedless.reachedAsInstruction, 0, "a seedless census must reach zero bytes: reaching means REACHED FROM A SEED");
  assert.equal(seedless.unreached, seedless.rangeBytes);
  assert.ok(
    seedless.linearSweepDecodable > seeded.reachedAsInstruction,
    "the linear sweep decodes MORE bytes than the descent reached, which is exactly why it is reported separately and never summed in",
  );
  assert.equal(
    seeded.linearSweepDecodable,
    seedless.linearSweepDecodable,
    "the linear-sweep figure must not depend on the seed set at all",
  );
});

// ---------------------------------------------------------------------------
// 4. Emptiness -- never an error, never a combined figure
// ---------------------------------------------------------------------------

test("emptiness: a zero-byte, a one-byte and a seedless payload each report zero reached and unreached == range, with no thrown error", () => {
  for (const [label, bytes, seeds] of [
    ["zero-byte", new Uint8Array(0), [0x0810]],
    ["one-byte", Uint8Array.from([0x60]), [0x0810]],
    ["seedless", Uint8Array.from([0xa9, 0x01, 0x60]), []],
  ] as const) {
    const census = computeStructuralCensus(bytes, 0x0810, seeds);
    assert.equal(census.rangeBytes, bytes.length, `${label}: rangeBytes`);
    assert.equal(census.unreached + census.reachedAsInstruction + census.tableEntry + census.referencedAsData, bytes.length, `${label}: classes must sum to the range`);
    if (label !== "one-byte") {
      assert.equal(census.reachedAsInstruction, 0, `${label}: reached count`);
      assert.equal(census.unreached, bytes.length, `${label}: unreached count`);
    }
    assert.equal(census.truncated, false, `${label}: must not report truncation`);
  }
});

test("emptiness: an undecodable payload reports an explicit reason rather than throwing or reading as clean (COV-02)", () => {
  const report = buildCoverageReport({ projectPath: join(FIXTURE_ROOT, WELL_DOCUMENTED, "store.json") });
  assert.equal(report.project.payloadDecoded, false);
  assert.ok(typeof report.project.reason === "string" && report.project.reason.length > 0, "an undecodable payload must carry a stated reason");
  assert.equal(report.structural.rangeBytes, 0);
  assert.ok(coverageFindings(report).findings.some((f) => f.measure === "project"), "an unavailable payload must produce a finding, never a silent skip");
});

test("a missing or empty project path is the ONE caller-contract violation this module throws for", () => {
  assert.throws(() => buildCoverageReport({ projectPath: "" }), R2000CoverageInputError);
  assert.throws(() => buildCoverageReport({ projectPath: join(FIXTURE_ROOT, "no-such-fixture", "project.regen2000proj") }), R2000CoverageInputError);
});

// ---------------------------------------------------------------------------
// 5. Idempotency and ordering
// ---------------------------------------------------------------------------

test("idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed", () => {
  const strip = (r: CoverageReport): Omit<CoverageReport, "generatedAt"> => {
    const { generatedAt, ...rest } = r;
    void generatedAt;
    return rest;
  };
  assert.deepEqual(strip(reportFor(WELL_DOCUMENTED)), strip(reportFor(WELL_DOCUMENTED)));
});

test("ordering: every offending-address list in every fixture's report is in ascending numeric order", () => {
  const ascending = (values: readonly number[], what: string): void => {
    for (let i = 1; i < values.length; i++) {
      assert.ok(values[i]! > values[i - 1]!, `${what} is not strictly ascending at index ${i}: ${JSON.stringify(values)}`);
    }
  };
  for (const dir of fixtureDirs()) {
    const report = reportFor(dir);
    ascending(report.structural.seeds, `${dir}: structural.seeds`);
    ascending(report.labels.autoPrefixNameAddresses, `${dir}: labels.autoPrefixNameAddresses`);
    ascending(report.labels.excludedByMultiCallerRule, `${dir}: labels.excludedByMultiCallerRule`);
    ascending(report.commentVacuity.bannedGenericAddresses, `${dir}: commentVacuity.bannedGenericAddresses`);
    ascending(report.commentVacuity.malformedGradeAddresses, `${dir}: commentVacuity.malformedGradeAddresses`);
    ascending(report.reproducibility.addresses, `${dir}: reproducibility.addresses`);
    ascending(report.reproducibility.multiCallerUndocumented.addresses, `${dir}: reproducibility.multiCallerUndocumented.addresses`);
    ascending(report.dispatch.discoveredTargets, `${dir}: dispatch.discoveredTargets`);
    ascending(report.dispatch.tableEntryAddresses, `${dir}: dispatch.tableEntryAddresses`);
  }
});

// ---------------------------------------------------------------------------
// 6. Comment normalisation and the vacuity measure
// ---------------------------------------------------------------------------

test("normalisation pins the exact rules: ASCII lowercase, backticks and emphasis stripped, whitespace runs collapsed, trimmed", () => {
  assert.equal(normaliseComment("  Handles   `Data`  "), "handles data");
  assert.equal(normaliseComment("**Handles**\tData\n"), "handles data");
  assert.equal(normaliseComment("_handles_ data"), "handles data");
  assert.equal(normaliseComment("HANDLES DATA"), "handles data");
  // Comparison is EXACT string equality after normalisation -- no stemming, no
  // similarity threshold. These two must NOT collapse together.
  assert.notEqual(normaliseComment("handles data"), normaliseComment("handles the data"));
});

test("two identical normalised comments at different addresses count as ONE distinct comment", () => {
  const vac = computeCommentVacuity([
    { address: 0x1000, type: "line", comment: "Reads the **table**" },
    { address: 0x1010, type: "line", comment: "reads   the `table`" },
    { address: 0x1020, type: "line", comment: "writes the flag" },
  ]);
  assert.equal(vac.commentedAddresses, 3);
  assert.equal(vac.distinctComments, 2, "the same normalised text at two addresses must count once, not twice");
  assert.equal(vac.distinctCommentRatio, 2 / 3);
});

test("a zero-comment project reports a NULL distinct-comment ratio with a zero commented-address count, never a division", () => {
  const vac = computeCommentVacuity([]);
  assert.equal(vac.commentedAddresses, 0);
  assert.equal(vac.distinctCommentRatio, null);
  assert.equal(vac.gradedFraction, null);
  assert.ok(typeof vac.reason === "string" && vac.reason.length > 0, "an unavailable measure must carry a stated reason (COV-02)");
});

test("a comment equal to a banned-generic entry after normalisation never counts as documentation", () => {
  const vac = computeCommentVacuity([
    { address: 0x1000, type: "line", comment: "  **Handles Data**  " },
    { address: 0x1010, type: "line", comment: "[unknown] routine" },
    { address: 0x1020, type: "line", comment: "[confirmed-code] decodes the sprite pointer block" },
  ]);
  assert.deepEqual(vac.bannedGenericAddresses, [0x1000, 0x1010], "the banned check runs AFTER the confidence prefix is stripped");
  assert.equal(vac.gradedAddresses, 1, "[unknown] is not-yet-documented and must not count toward the graded fraction");
  assert.equal(vac.unknownGradedAddresses, 1);
});

test("a near-miss confidence token is reported as a measured defect, never thrown and never degraded to ungraded", () => {
  const vac = computeCommentVacuity([{ address: 0x1000, type: "line", comment: "[confirmed_code] decodes the sprite pointer block" }]);
  assert.deepEqual(vac.malformedGradeAddresses, [0x1000]);
});

test("BANNED_GENERIC_COMMENTS is a named, non-empty set with at least five entries", () => {
  assert.ok(BANNED_GENERIC_COMMENTS.size >= 5, `expected >= 5 banned-generic entries, found ${BANNED_GENERIC_COMMENTS.size}`);
  for (const entry of BANNED_GENERIC_COMMENTS) {
    assert.equal(entry, normaliseComment(entry), `banned entry ${JSON.stringify(entry)} is not stored already-normalised, so it could never match`);
  }
});

// ---------------------------------------------------------------------------
// 7. The label figures and the multi-caller rule
// ---------------------------------------------------------------------------

test("AUTO_NAME_PREFIX_RE deliberately excludes the prefix upstream shares between predefined and user-defined label types", () => {
  assert.ok(!/L_/.test(AUTO_NAME_PREFIX_RE.source), "`L_` must not be in the auto-prefix regex -- it cannot distinguish auto from user");
  assert.ok(!AUTO_NAME_PREFIX_RE.test("L_main_loop"));
  for (const name of ["zpf_00", "f_c000", "zpa_02", "a_0840", "p_1234", "zpp_04", "e_ffd2", "j_0810", "s_0820", "b_0830", "r_0840"]) {
    assert.ok(AUTO_NAME_PREFIX_RE.test(name), `${name} must match the auto-name prefix set`);
  }
  // ASCII case-sensitive: an uppercased auto name is a user rename, not an
  // auto name.
  assert.ok(!AUTO_NAME_PREFIX_RE.test("S_0820"));
});

test("the cross-reference rule engages at strictly MORE THAN ONE caller, and not at one", () => {
  const symbols: R2000Symbol[] = [
    { address: 0x0820, name: "two_callers", kind: "User", type: "Subroutine" },
    { address: 0x0828, name: "one_caller", kind: "User", type: "Subroutine" },
  ];
  const comments: R2000Comment[] = [
    { address: 0x0820, type: "line", comment: "[confirmed-code] sets the mode flag before the main loop runs" },
    { address: 0x0828, type: "line", comment: "[confirmed-code] reads the value table indexed by X" },
  ];
  const census = computeStructuralCensus(new Uint8Array(0), 0x0810, []);
  const dispatch = scanIndirectDispatch([], new Uint8Array(0), 0x0810);
  const crossReferences: R2000CrossReference[] = [
    { address: 0x0820, callers: [0x0810, 0x0816] },
    { address: 0x0828, callers: [0x0813] },
  ];

  const repro = computeReproducibility({ census, dispatch, symbols, comments, blocks: [], crossReferences });
  assert.deepEqual(
    repro.multiCallerUndocumented.addresses,
    [0x0820],
    "only the label with strictly more than one caller may be disqualified -- the single-caller label documents itself under the ordinary rules",
  );

  // Naming a caller rescues it, and the rescue works through the caller's own
  // user label name as well as through its hexadecimal address.
  const named = computeReproducibility({
    census,
    dispatch,
    symbols,
    comments: [{ address: 0x0820, type: "line", comment: "[confirmed-code] sets the mode flag; reached from $0810 and from $0816" }, comments[1]!],
    blocks: [],
    crossReferences,
  });
  assert.deepEqual(named.multiCallerUndocumented.addresses, [], "a comment naming a caller address must satisfy the rule");

  const excluded = computeLabelRatio(symbols, { excludeUserAddresses: repro.multiCallerUndocumented.addresses });
  assert.equal(excluded.kindRatio.user, 1, "a multi-caller-undocumented label must be excluded from the user tally");
  assert.deepEqual(excluded.excludedByMultiCallerRule, [0x0820]);
});

test("ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean", () => {
  // A coverage instrument whose whole subject is refusing to be talked into a
  // clean verdict must not be talkable into one by a string that merely TOUCHES
  // a caller's short form. The adversarial input is built from the REAL
  // committed NC4 fixture rather than a hand-typed copy, so this control cannot
  // drift away from the fixture it claims to be about: NC4's own comment array,
  // with a mention of $8106 -- an unrelated and entirely ordinary C64 address
  // whose leading three digits coincide with caller $0810's bare hex form --
  // appended to the $0820 entry. The comment still names NEITHER caller.
  const { store } = loadFixture("nc4-multi-caller-unnamed");
  const gamed: R2000Comment[] = store.comments.map((c) =>
    c.address === 0x0820 ? { ...c, comment: `${c.comment}; see also the pointer table at $8106` } : c,
  );
  assert.equal(
    gamed.filter((c) => c.comment.includes("$8106")).length,
    1,
    "the adversarial mutation must land on exactly the $0820 comment, or this control is testing something else",
  );

  const report = reportFor("nc4-multi-caller-unnamed", { comments: gamed });
  assert.deepEqual(
    report.reproducibility.multiCallerUndocumented,
    { count: 1, addresses: [0x0820] },
    "$8106 is not $0810 -- a hex token must end on a non-hex-digit boundary before it can count as naming a caller",
  );

  const findings = coverageFindings(report);
  assert.equal(
    findings.clean,
    false,
    `a gaming attempt must not buy a clean verdict (T-19-14). Findings: ${JSON.stringify(findings.findings, null, 2)}`,
  );
  assert.ok(
    findings.findings.some((f) => f.measure === "reproducibility"),
    "the refusal must be attributable to the reproducibility measure BY NAME, never to an unnamed aggregate",
  );

  // Both directions, in the same test and therefore in the same commit: the
  // anchoring must not be a machine that now fails everything. NC5's $0820
  // comment reaches its callers through the canonical-width form ($0810 and
  // $0816), so the padded token is what carries it -- without this assertion
  // an over-tightened rule would break the well-documented control and the
  // five negative controls would not notice.
  const good = coverageFindings(reportFor(WELL_DOCUMENTED));
  assert.equal(
    good.clean,
    true,
    `the genuinely well-documented control must stay clean under the anchored rule. Findings: ${JSON.stringify(good.findings, null, 2)}`,
  );
  assert.deepEqual(good.findings, []);
});

test("ANCHORING: a caller's label name satisfies the rule only on an identifier boundary", () => {
  // Both directions are asserted here for the same reason as above: a
  // one-directional assertion would be satisfied either by a rule that never
  // matches a name or by one that matches any substring, and neither is the
  // rule. `my_entry_pointer` embeds `entry_point`; it names no caller.
  const symbols: R2000Symbol[] = [
    { address: 0x0810, name: "entry_point", kind: "User", type: "Subroutine" },
    { address: 0x0820, name: "two_callers", kind: "User", type: "Subroutine" },
  ];
  const census = computeStructuralCensus(new Uint8Array(0), 0x0810, []);
  const dispatch = scanIndirectDispatch([], new Uint8Array(0), 0x0810);
  const crossReferences: R2000CrossReference[] = [{ address: 0x0820, callers: [0x0810, 0x0816] }];
  const reproFor = (comment: string) =>
    computeReproducibility({
      census,
      dispatch,
      symbols,
      comments: [{ address: 0x0820, type: "line", comment }],
      blocks: [],
      crossReferences,
    });

  const embedded = reproFor("[confirmed-code] sets the mode flag; my_entry_pointer holds the vector");
  assert.deepEqual(
    embedded.multiCallerUndocumented.addresses,
    [0x0820],
    "a label name embedded in a longer identifier names no caller -- my_entry_pointer is not entry_point",
  );

  const standalone = reproFor("[confirmed-code] sets the mode flag; reached from entry_point on the cold path");
  assert.deepEqual(
    standalone.multiCallerUndocumented.addresses,
    [],
    "the caller's own label name standing alone must still satisfy the rule",
  );
});

test("the kind figure is over non-System labels only, and reports a null fraction rather than a divide when there are none", () => {
  const ratio = computeLabelRatio([
    { address: 0xffd2, name: "CHROUT", kind: "System", type: "Predefined" },
    { address: 0x0810, name: "entry_point", kind: "User", type: "Subroutine" },
    { address: 0x0820, name: "s_0820", kind: "Auto", type: "Subroutine" },
  ]);
  assert.equal(ratio.systemExcluded, 1, "a platform symbol set must not be able to inflate the user fraction for free");
  assert.equal(ratio.kindRatio.userFraction, 0.5);
  assert.equal(ratio.autoPrefixNamesRemaining, 1);

  const empty = computeLabelRatio([{ address: 0xffd2, name: "CHROUT", kind: "System", type: "Predefined" }]);
  assert.equal(empty.kindRatio.userFraction, null);
});

// ---------------------------------------------------------------------------
// 8. The widened dispatch scan -- one fixture per class
// ---------------------------------------------------------------------------

test("dispatch class 1: an indirect jump through a ZERO-PAGE vector is found and reported, with a null target", () => {
  const scan = scanOf(ZP_VECTOR);
  assert.equal(scan.indirectJumps.length, 1);
  const [found] = scan.indirectJumps;
  assert.equal(found!.pointer, 0x0002);
  assert.equal(found!.pointerInZeroPage, true);
  assert.equal(found!.pointerInImage, false);
  assert.equal(found!.target, null, "the vector's contents are outside the image, so the target is an explicit null rather than a guess");
});

test("dispatch class 2: a multi-entry table yields every entry, not the single entry upstream reads", () => {
  const scan = scanOf(MULTI_ENTRY_TABLE);
  assert.equal(scan.multiEntryTables.length, 1);
  const table = scan.multiEntryTables[0]!;
  assert.equal(table.base, 0xc006);
  assert.equal(table.entries, 3, "upstream reads exactly one entry here; the widened scan must read the whole run");
  assert.deepEqual(table.targets, [0xc00c, 0xc00e, 0xc010]);
  assert.equal(table.truncated, false);
});

test("dispatch class 3: a split lo/hi table pair is reconstructed from its two bases", () => {
  const scan = scanOf(SPLIT_TABLE);
  assert.equal(scan.splitTables.length >= 1, true);
  const split = scan.splitTables[0]!;
  assert.equal(split.loBase, 0xc010);
  assert.equal(split.hiBase, 0xc013);
  assert.equal(split.entries, 3, "the entry count is the fixed distance between the two bases");
  assert.deepEqual(split.targets, [0xc006, 0xc006, 0xc006]);
});

test("dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode", () => {
  assert.ok(!STACK_RETURN.includes(0x6c), "the stack-return payload must contain NO indirect-jump opcode -- that is the whole point of the class");
  const scan = scanOf(STACK_RETURN);
  assert.equal(scan.stackReturnDispatch.length, 1);
  const idiom = scan.stackReturnDispatch[0]!;
  assert.equal(idiom.at, 0xc000);
  assert.equal(idiom.hiBase, 0xc010);
  assert.equal(idiom.loBase, 0xc013);
  assert.deepEqual(idiom.targets, [0xc006, 0xc006, 0xc006], "the idiom pushes target-1 because rts increments, so the scan must add one back");
});

test("bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)", () => {
  const bytes = chainingTable();
  const scan = scanOf(bytes);
  assert.equal(scan.multiEntryTables.length, 1);
  assert.equal(scan.multiEntryTables[0]!.entries, MAX_TABLE_ENTRIES, "the walk must stop at the explicit entry bound, never 'while plausible'");
  assert.equal(scan.multiEntryTables[0]!.truncated, true);
  assert.equal(scan.truncated, true);
});

test("bounded walk: the descent walker honours an explicit step bound and reports truncation rather than looping", () => {
  const { projectPath } = loadFixture(WELL_DOCUMENTED);
  const project = JSON.parse(readFileSync(projectPath, "utf8")) as { origin: number; raw_data_base64: string };
  const bytes = new Uint8Array(decodeRawData(project.raw_data_base64));
  const census = computeStructuralCensus(bytes, project.origin, [project.origin], { maxSteps: 3 });
  assert.equal(census.truncated, true);
  assert.ok(census.steps <= 4, `the walker took ${census.steps} steps under a bound of 3`);
});

// ---------------------------------------------------------------------------
// 9. The six committed controls
// ---------------------------------------------------------------------------

test("six control fixtures are committed, each with a project file and a store file", () => {
  const dirs = fixtureDirs();
  assert.equal(dirs.length, 6, `expected six committed control fixtures, found ${dirs.length}: ${dirs.join(", ")}`);
  for (const dir of dirs) {
    const { store } = loadFixture(dir);
    assert.ok(readFileSync(join(FIXTURE_ROOT, dir, "project.regen2000proj"), "utf8").length > 0, `${dir}: project file is empty`);
    assert.equal(typeof store.expect_clean, "boolean", `${dir}: store.json must declare expect_clean`);
  }
});

for (const dir of fixtureDirs()) {
  const { store } = loadFixture(dir);
  const verdictWord = store.expect_clean ? "CLEAN" : "non-clean";
  test(`control ${store.control} (${dir}): produces a ${verdictWord} result${store.expect_measure ? ` naming ${store.expect_measure}` : ""}`, () => {
    const findings = coverageFindings(reportFor(dir));
    assert.equal(
      findings.clean,
      store.expect_clean,
      `${dir} expected clean=${store.expect_clean} but got clean=${findings.clean}. Findings: ${JSON.stringify(findings.findings, null, 2)}`,
    );
    if (store.expect_measure) {
      assert.ok(
        findings.findings.some((f) => f.measure === store.expect_measure),
        `${dir} was caught, but not by ${store.expect_measure}. Findings: ${JSON.stringify(findings.findings, null, 2)}`,
      );
    }
  });
}

test("NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything", () => {
  // Without this assertion the five negative controls above prove nothing --
  // a coverage instrument that returns non-clean unconditionally would satisfy
  // every one of them and measure nothing at all. This is the single most
  // load-bearing test in the file.
  const findings = coverageFindings(reportFor(WELL_DOCUMENTED));
  assert.equal(findings.clean, true, `the well-documented control must be clean. Findings: ${JSON.stringify(findings.findings, null, 2)}`);
  assert.deepEqual(findings.findings, []);
});

test("NC1b earns its place: the kind figure alone would pass the auto-renamed-in-place control, the name figure catches it", () => {
  const report = reportFor("nc1b-auto-renamed-in-place");
  assert.equal(report.labels.kindRatio.userFraction, 1, "the gameable figure looks perfect -- that is exactly why the second figure exists");
  assert.equal(report.labels.autoPrefixNamesRemaining, 4);
});

test("NC3 earns its place: the census does not move by one byte under a mass block-type set, only the divergence does", () => {
  const good = reportFor(WELL_DOCUMENTED);
  const massSet = reportFor("nc3-all-data-blocks");
  assert.equal(massSet.structural.reachedAsInstruction, good.structural.reachedAsInstruction);
  assert.equal(massSet.structural.unreached, good.structural.unreached);
  assert.ok(massSet.divergence.censusCodeStoreNotCode > 0);
  assert.equal(good.divergence.censusCodeStoreNotCode, 0);
});

// ---------------------------------------------------------------------------
// 10. The previously-unseen fixture
// ---------------------------------------------------------------------------

test("the previously-unseen Phase 11 fixture -- authored for a different phase, never used to write these rules -- produces a well-formed report", () => {
  const path = join(
    HERE,
    "..",
    "..",
    "..",
    ".planning",
    "phases",
    "11-annotation-store-enums-and-the-symbol-round-trip",
    "evidence",
    "criterion1",
    "recon-subject.regen2000proj",
  );
  const report = buildCoverageReport({ projectPath: path });
  assert.deepEqual(Object.keys(report), [...COVERAGE_REPORT_KEYS]);
  assert.equal(report.project.payloadDecoded, true);
  assert.equal(report.project.origin, 0x0810, "the report must name the fixture's own recorded origin");
  assert.equal(report.project.size, 100);

  const s = report.structural;
  assert.equal(
    s.reachedAsInstruction + s.tableEntry + s.referencedAsData + s.unreached,
    s.rangeBytes,
    "the four byte classes must be disjoint and must sum to the fixture's size",
  );
  assert.equal(s.rangeBytes, 100);
  assert.ok(s.reachedAsInstruction > 0, "the census must actually reach something in a real program");
  assert.equal(classAt(report.structural, 0x0810), "reached-as-instruction", "the origin is a seed, so its first byte is reached");
  assert.equal(classAt(report.structural, 0x0700), null, "an address outside the censused range has no class");
});

// ---------------------------------------------------------------------------
// 11. Read-only by construction (T-19-17)
// ---------------------------------------------------------------------------

test("the coverage module contains no file-write call, no project-save call and no live-session import", () => {
  const source = readFileSync(join(HERE, "r2000-coverage.ts"), "utf8");
  for (const forbidden of ["writeFileSync", "renameSync", "appendFileSync", "save_project", "r2000-session.ts"]) {
    assert.ok(!source.includes(forbidden), `r2000-coverage.ts mentions ${forbidden} -- a coverage run must be read-only by construction`);
  }
  assert.ok(!/hostpath|containerpath/.test(source), "the r2000 module family must stay absent from the path-translation consumer set");
});

// ---------------------------------------------------------------------------
// 12. The sealed reproducibility evidence
// ---------------------------------------------------------------------------

/**
 * Extracts the canonical answer line from a marker fence. Deliberately no
 * `existsSync` guard and no try/catch: a missing file must surface as
 * `readFileSync`'s own ENOENT, and an empty fence as the non-empty assertion
 * below -- never as a skip (T-19-VACUOUS-CHECK).
 */
function extractCanonicalLine(md: string, what: string): string {
  const openIdx = md.indexOf(OPEN_MARKER);
  const closeIdx = md.indexOf(CLOSE_MARKER);
  assert.ok(openIdx !== -1, `${what} is missing its ${OPEN_MARKER} marker`);
  assert.ok(closeIdx !== -1, `${what} is missing its ${CLOSE_MARKER} marker`);
  assert.ok(closeIdx > openIdx, `${what}'s close marker appears before its open marker`);
  const line = md.slice(openIdx + OPEN_MARKER.length, closeIdx).trim();
  assert.ok(line.length > 0, `${what}'s marker fence contains no canonical line -- an empty answer must FAIL, never skip`);
  assert.ok(!line.includes("\n"), `${what}'s marker fence must contain exactly one line, got: ${JSON.stringify(line)}`);
  return line;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const CANONICAL_GRAMMAR = /^sample=[0-9a-f]{4}(,[0-9a-f]{4})* classes=[a-z]+(,[a-z]+)* callers=(0|[1-9][0-9]*)(,(0|[1-9][0-9]*))*$/;

test("ANSWER.sha256 is exactly 64 lowercase hex characters", () => {
  const sealed = readFileSync(ANSWER_SHA_PATH, "utf8").trim();
  assert.match(sealed, /^[0-9a-f]{64}$/, `ANSWER.sha256 must be exactly 64 lowercase hex characters, got: ${JSON.stringify(sealed)}`);
});

test("ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-19-SEAL-DRIFT)", () => {
  const line = extractCanonicalLine(readFileSync(ANSWER_PATH, "utf8"), "ANSWER.md");
  const sealed = readFileSync(ANSWER_SHA_PATH, "utf8").trim();
  assert.equal(
    sha256(line),
    sealed,
    `ANSWER.sha256 (${sealed}) does not match the sha256 recomputed from ANSWER.md's canonical line ${JSON.stringify(line)} ` +
      `(${sha256(line)}) -- the seal has drifted from the answer it seals.`,
  );
});

test("both canonical lines match QUESTION.md's own grammar", () => {
  for (const [path, what] of [[ANSWER_PATH, "ANSWER.md"], [RE_DERIVED_PATH, "RE-DERIVED-ANSWER.md"]] as const) {
    const line = extractCanonicalLine(readFileSync(path, "utf8"), what);
    assert.match(line, CANONICAL_GRAMMAR, `${what}'s canonical line does not match the sample=/classes=/callers= grammar: ${JSON.stringify(line)}`);
    const fields = line.split(" ").map((f) => f.slice(f.indexOf("=") + 1).split(","));
    assert.equal(fields[0]!.length, fields[1]!.length, `${what}: the classes list must have one entry per sampled address`);
    assert.equal(fields[0]!.length, fields[2]!.length, `${what}: the callers list must have one entry per sampled address`);
  }
});

test("QUESTION.md does not contain either canonical answer line, nor any of its compound field assignments (T-19-LEAK)", () => {
  const question = readFileSync(QUESTION_PATH, "utf8");
  const line = extractCanonicalLine(readFileSync(ANSWER_PATH, "utf8"), "ANSWER.md");
  assert.ok(!question.includes(line), "QUESTION.md contains the full canonical answer line -- the bytes route could answer by reading the question");
  for (const field of line.split(" ")) {
    assert.ok(
      !question.includes(field),
      `QUESTION.md contains the compound assignment ${JSON.stringify(field)} verbatim -- that is the sealed answer's own field in canonical form`,
    );
  }
});

test("RE-DERIVED-ANSWER.md's canonical line hashes to the sealed ANSWER.sha256, and a missing or empty fence FAILS rather than skips (T-19-RETROFIT / T-19-VACUOUS-CHECK)", () => {
  const line = extractCanonicalLine(readFileSync(RE_DERIVED_PATH, "utf8"), "RE-DERIVED-ANSWER.md");
  const sealed = readFileSync(ANSWER_SHA_PATH, "utf8").trim();
  assert.equal(
    sha256(line),
    sealed,
    `RE-DERIVED-ANSWER.md's canonical line ${JSON.stringify(line)} hashes to ${sha256(line)}, which does not match the sealed ` +
      `ANSWER.sha256 (${sealed}). Per T-19-RETROFIT a mismatch is a real result to report -- ANSWER.md, ANSWER.sha256 and ` +
      "QUESTION.md must not be edited to force this test green.",
  );
});

test("LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line", () => {
  // The seal above proves nobody edited the two committed answers apart. This
  // proves the answers are still TRUE of the fixture: the store route is
  // recomputed from store.json alone, the bytes route from the payload alone,
  // and both must land on the sealed line. Without this, a fixture change
  // would leave two mutually-consistent but stale answers passing.
  const { projectPath, store } = loadFixture(WELL_DOCUMENTED);
  const report = reportFor(WELL_DOCUMENTED);
  const sample = report.reproducibility.addresses;
  assert.ok(sample.length > 0, "the sample is empty -- the reconstruction below would be vacuous");

  const hex = (a: number): string => a.toString(16).padStart(4, "0");
  const compose = (classes: readonly string[], callers: readonly number[]): string =>
    `sample=${sample.map(hex).join(",")} classes=${classes.join(",")} callers=${callers.join(",")}`;

  // --- store route: grades and cross-reference lists only.
  const storeLine = compose(
    report.reproducibility.comparisons.map((c) => c.fromStore),
    sample.map((a) => (store.cross_references.find((x) => x.address === a)?.callers ?? []).length),
  );

  // --- bytes route: the payload only, no comment and no block entry.
  const project = JSON.parse(readFileSync(projectPath, "utf8")) as { origin: number; raw_data_base64: string };
  const bytes = new Uint8Array(decodeRawData(project.raw_data_base64));
  const census = computeStructuralCensus(bytes, project.origin, [project.origin]);
  const reached = decode(bytes, project.origin).filter((i) => classAt(census, i.address) === "reached-as-instruction");
  const bytesLine = compose(
    sample.map((a) => {
      const klass = classAt(census, a);
      return klass === "reached-as-instruction" ? "code" : klass === "unreached" || klass === null ? "unreached" : "data";
    }),
    sample.map((a) => new Set(reached.filter((i) => i.resolvedTarget === a).map((i) => i.address)).size),
  );

  const sealed = readFileSync(ANSWER_SHA_PATH, "utf8").trim();
  assert.equal(sha256(storeLine), sealed, `the live store route produced ${JSON.stringify(storeLine)}, which does not hash to the seal`);
  assert.equal(sha256(bytesLine), sealed, `the live bytes route produced ${JSON.stringify(bytesLine)}, which does not hash to the seal`);
  assert.equal(storeLine, bytesLine, "the two independent routes disagree -- report the disagreement, do not edit the seal");
});
