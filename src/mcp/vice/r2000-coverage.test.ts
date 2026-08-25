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
  DISPATCH_CONTEXT_SHAPES,
  MAX_TABLE_ENTRIES,
  R2000CoverageInputError,
  SPLIT_TABLE_WINDOW,
  buildCoverageReport,
  classAt,
  computeCommentVacuity,
  computeLabelRatio,
  computeReproducibility,
  computeStructuralCensus,
  coverageFindings,
  normaliseComment,
  provenDispatchTargets,
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
  /** Declared ONLY by the false-positive census pair. The bound the census may
   * not exceed is the fixture's own declaration, not a constant typed here. */
  code_size?: number;
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

/** Two indexed loads whose bases are three apart, WITH the dispatch consumer
 * that makes them a split lo/hi table rather than an ordinary copy loop: each
 * load is stored into one half of a consecutive zero-page vector, and the
 * vector is then jumped through.
 *
 * The consumer is not decoration. 19-08 gated the class-3 scan because two
 * indexed loads on their own are the most ordinary shape in C64 code, and
 * this payload as originally committed carried NO consumer at all -- it was a
 * positive control for a heuristic that fired on anything. The store pair is
 * also what resolves the lo/hi orientation: the load reaching the LOWER of
 * two consecutive zero-page addresses holds the low byte, which is a fact
 * about the construction rather than `Math.min` over two addresses (WR-01). */
const SPLIT_TABLE = Uint8Array.from([
  0xbd, 0x10, 0xc0, // $c000 lda $c010,x   (lo base)
  0x85, 0xfb, //       $c003 sta $fb       (vector lo)
  0xbd, 0x13, 0xc0, // $c005 lda $c013,x   (hi base)
  0x85, 0xfc, //       $c008 sta $fc       (vector hi)
  0x6c, 0xfb, 0x00, // $c00a jmp ($00fb)   <- the dispatch consumer
  0xea, 0xea, 0xea, // $c00d..$c00f
  0x0d, 0x0d, 0x0d, // $c010 lo bytes  -> $c00d, a legal nop
  0xc0, 0xc0, 0xc0, // $c013 hi bytes
]);

/** `lda hi,x : pha : lda lo,x : pha : rts` -- the stack-return dispatch idiom.
 * Contains NO indirect-jump opcode, so an opcode-keyed walk cannot see it.
 *
 * THE TABLE BYTES NAME REAL ENTRY POINTS, WHICH THEY DID NOT UNTIL 19-11
 * (WR-14). As originally committed the tables held `c0 c0 c0` / `05 05 05`,
 * reconstructing `$c006` three times -- and `$c006` is the THIRD BYTE of this
 * payload's own second instruction, since `lda $c013,x` occupies
 * `$c004..$c006`. A mid-instruction address is not an address a program can be
 * entered at, so a positive control asserting it was correct was pinning a
 * defect: the value was being handed to `provenDispatchTargets()`, whose doc
 * comment says adding a source to it IS the decision to treat that source as
 * proof of code.
 *
 * The three entries now name `$c00a`, `$c00c` and `$c00e` -- three `rts`
 * instructions in the filler region between the idiom and its tables, each a
 * one-byte legal instruction, none of them inside any instruction of the
 * idiom's own five-instruction window (`$c000..$c008`). The table bytes encode
 * `target - 1` because the idiom pushes the address `rts` will increment past,
 * so the lo bytes read `09 0b 0d` for targets `$c00a $c00c $c00e`. Three
 * DISTINCT targets rather than one repeated value, so the walk reading three
 * real entries is a visible property rather than something a single value
 * could hide. */
const STACK_RETURN = Uint8Array.from([
  0xbd, 0x10, 0xc0, // $c000 lda $c010,x   (hi table)
  0x48, // $c003 pha
  0xbd, 0x13, 0xc0, // $c004 lda $c013,x   (lo table)
  0x48, // $c007 pha
  0x60, // $c008 rts        <- end of the idiom's own window
  0xea, // $c009 nop
  0x60, // $c00a rts        <- entry point 1, pushed as $c009
  0xea, // $c00b nop
  0x60, // $c00c rts        <- entry point 2, pushed as $c00b
  0xea, // $c00d nop
  0x60, // $c00e rts        <- entry point 3, pushed as $c00d
  0xea, // $c00f nop
  0xc0, 0xc0, 0xc0, // $c010 hi bytes
  0x09, 0x0b, 0x0d, // $c013 lo bytes
]);

/** `STACK_RETURN` with ONE defect: its second load indexes through Y while the
 * first indexes through X. Two tables walked by two different registers are
 * two tables, not one split one -- the sentence the class-3 comment already
 * makes, and which the class-4 pass did not make until 19-11 (WR-14).
 *
 * The second load MUST be `absolute_y` (`0xb9`) and no other mode. That is
 * load-bearing rather than stylistic: `INDEXED_LOAD_MODES` is exactly
 * `absolute_x`, `absolute_y`, `zeropage_x` and does NOT contain `zeropage_y`,
 * so a `zeropage_y` load would fail the class-4 window's own `isIndexedLoad`
 * check for a reason unrelated to the register mismatch. The payload would
 * then never enter the window at all and the control would pass by
 * construction -- an OUTSIDE-bracketing control wearing an interior control's
 * label, which is the exact defect this run exists to eliminate. */
const STACK_RETURN_MIXED_REGISTERS = (() => {
  const bytes = Uint8Array.from(STACK_RETURN);
  bytes[4] = 0xb9; // $c004 lda $c013,y   (was 0xbd, lda $c013,x)
  return bytes;
})();

/** `STACK_RETURN` with ONE defect: every reconstructed entry point lands on a
 * `$02` byte, which decodes as `jam` -- an illegal opcode. An address that
 * does not decode is not an entry point, so the walk must stop there rather
 * than publish it, and must SAY it stopped.
 *
 * `$02` at exactly the three target addresses, so the payload is otherwise
 * byte-identical to the genuine fixture: the reconstruction still succeeds and
 * still lands in-image, and the plausibility test is the only thing that
 * declines it. */
const STACK_RETURN_IMPLAUSIBLE_TARGET = (() => {
  const bytes = Uint8Array.from(STACK_RETURN);
  for (const target of [0xc00a, 0xc00c, 0xc00e]) bytes[target - DISPATCH_ORIGIN] = 0x02; // jam
  return bytes;
})();

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
// The FALSE-POSITIVE payloads for the class-3 negative controls (19-08).
//
// Same discipline as the four payloads above -- smallest program exhibiting
// exactly one shape -- but pointed the other way. Until 19-08 the class-3
// split-table scan had a POSITIVE control only, which is precisely how a
// green suite concealed a reproduced blocker: the scan paired ANY two indexed
// `ld*` instructions inside eight decoded instructions, with no dispatch
// context required, reconstructed up to 64 "targets" out of whatever bytes
// lay at the two operand bases, and fed them straight back as descent seeds.
// A heuristic with a positive control and no negative one is not evidence
// that it declines anything.
//
// The two payloads below are byte-identical apart from their seven-byte code
// prologue -- one immediate, one indexed -- and that identity is ASSERTED
// rather than asserted-about, so the "differing ONLY in addressing mode"
// claim is a checked property of the fixtures.
// ---------------------------------------------------------------------------

const ORDINARY_ORIGIN = 0x0810;

/** `lda $0827,x : lda $083f,x : rts` -- a screen-plus-colour copy loop, the
 * single most ordinary shape in C64 code. No indirect jump, no `pha`/`pha`/
 * `rts`, no zero-page vector construction: nothing dispatches through these
 * two tables, because they are not tables. */
const ORDINARY_INDEXED_PROLOGUE = [0xbd, 0x27, 0x08, 0xbd, 0x3f, 0x08, 0x60];

/** `lda #$20 : lda #$38 : nop : nop : rts` -- the immediate twin. Identical
 * in length and in every data byte; the two loads are immediate rather than
 * indexed, and that is the ONLY difference. */
const ORDINARY_IMMEDIATE_PROLOGUE = [0xa9, 0x20, 0xa9, 0x38, 0xea, 0xea, 0x60];

/** The real code size of both payloads, DERIVED from the prologue rather than
 * typed as a bare number, so the non-inflation control cannot drift away from
 * the payload it guards. */
const ORDINARY_CODE_BYTES = ORDINARY_INDEXED_PROLOGUE.length;

/** 57 bytes of ordinary data: 24 ascending from $10, 24 of $08, 9 of $20. */
function withOrdinaryData(prologue: readonly number[]): Uint8Array {
  const out = new Uint8Array(64);
  out.set(prologue, 0);
  let i = prologue.length;
  for (let k = 0; k < 24; k++) out[i++] = 0x10 + k;
  for (let k = 0; k < 24; k++) out[i++] = 0x08;
  for (let k = 0; k < 9; k++) out[i++] = 0x20;
  return out;
}

const ORDINARY_INDEXED_COPY = withOrdinaryData(ORDINARY_INDEXED_PROLOGUE);
const ORDINARY_IMMEDIATE_COPY = withOrdinaryData(ORDINARY_IMMEDIATE_PROLOGUE);

/** The census wired exactly as `buildCoverageReport()` wires it: the origin as
 * the only ordinary seed, the scan's table entries, and `extraSeeds` read from
 * the ONE proven-target seam. */
function wiredCensus(bytes: Uint8Array, origin: number) {
  const scan = scanIndirectDispatch(decode(bytes, origin), bytes, origin);
  const census = computeStructuralCensus(bytes, origin, [origin], {
    tableEntryAddresses: scan.tableEntryAddresses,
    extraSeeds: provenDispatchTargets(scan),
  });
  return { scan, census };
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
  assert.equal(
    COVERAGE_SCHEMA_VERSION,
    2,
    "the schema version is pinned to a LITERAL here so a bump is always deliberate. It moved 1 -> 2 in 19-08: the top-level key set above is UNCHANGED, but the " +
      "`dispatch` sub-object's target vocabulary changed -- `discoveredTargets` narrowed to evidence-backed targets only, and the ungated split lo/hi pairings it " +
      "used to include moved to the advisory sibling `splitTableCandidates`. A consumer reading `discoveredTargets` gets a smaller, honest set than at version 1, " +
      "and this number is the only signal it gets. Accepted by a human at 19-08's decision checkpoint (option `narrow-and-add-sibling`).",
  );
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
  // The advisory class is covered by the deep comparison above only if it is
  // actually ON the report object -- a silently-dropped field would make the
  // comparison pass vacuously. Assert its presence explicitly, so "two
  // consecutive reports are deeply equal INCLUDING the advisory field" is a
  // checked statement rather than an assumed one.
  const report = reportFor(WELL_DOCUMENTED);
  assert.ok(
    Array.isArray(report.dispatch.splitTableCandidates),
    "dispatch.splitTableCandidates must be present and an array on every report -- if it were dropped, the deep comparison above would cover nothing",
  );

  assert.deepEqual(strip(reportFor(WELL_DOCUMENTED)), strip(reportFor(WELL_DOCUMENTED)));

  // And over EVERY committed fixture, not one hand-picked case. Idempotency is
  // a property of the instrument, so a new fixture directory joins this loop
  // automatically -- which is what keeps the claim from going stale the moment
  // a payload with a different shape lands. `generatedAt` is the only field
  // that may differ between two runs; everything else, including the advisory
  // candidate list and every class run, must be byte-stable.
  for (const dir of fixtureDirs()) {
    assert.deepEqual(strip(reportFor(dir)), strip(reportFor(dir)), `${dir}: two consecutive reports over one input must be deeply equal`);
  }
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

test("every reported count is a count of the deduped list printed beside it", () => {
  // WR-02. `coverageFindings()` prints a count and an address list in ONE
  // sentence ("N label name(s) still carry an auto-name prefix at $..."), so a
  // count taken pre-dedup beside a post-dedup list makes the finding text
  // contradict itself. The invariant is asserted over the whole committed
  // fixture set so it cannot be satisfied by one hand-picked case.
  for (const dir of fixtureDirs()) {
    const report = reportFor(dir);
    assert.equal(
      report.labels.autoPrefixNamesRemaining,
      report.labels.autoPrefixNameAddresses.length,
      `${dir}: a count printed beside a list must be a count OF that list, or the finding text contradicts itself`,
    );
    assert.equal(
      report.reproducibility.multiCallerUndocumented.count,
      report.reproducibility.multiCallerUndocumented.addresses.length,
      `${dir}: a count printed beside a list must be a count OF that list, or the finding text contradicts itself`,
    );
  }
});

test("two symbols at one address produce a count of one, not two", () => {
  // The fixture-wide invariant above would pass VACUOUSLY against the pre-fix
  // code, because no committed fixture carries two symbols at one address.
  // This is the direct probe that shows the fix bites: pre-fix these inputs
  // reported 2 beside a one-element list on both measures.
  const dup = computeLabelRatio([
    { address: 0x1000, name: "s_1000", kind: "Auto", type: "Subroutine" },
    { address: 0x1000, name: "j_1000", kind: "Auto", type: "Jump" },
  ]);
  assert.equal(dup.autoPrefixNamesRemaining, 1, "two auto-prefixed names at ONE address are one address still carrying an auto name");
  assert.equal(dup.autoPrefixNameAddresses.length, 1);

  const census = computeStructuralCensus(new Uint8Array(0), 0x1000, []);
  const dispatch = scanIndirectDispatch([], new Uint8Array(0), 0x1000);
  const repro = computeReproducibility({
    census,
    dispatch,
    symbols: [
      { address: 0x1000, name: "first_name", kind: "User", type: "Subroutine" },
      { address: 0x1000, name: "second_name", kind: "User", type: "Subroutine" },
    ],
    comments: [],
    blocks: [],
    crossReferences: [{ address: 0x1000, callers: [0x0810, 0x0816] }],
  });
  assert.deepEqual(
    repro.multiCallerUndocumented,
    { count: 1, addresses: [0x1000] },
    "the multi-caller measure's count must agree with its own address list under a duplicate address",
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

test("dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases", () => {
  const scan = scanOf(SPLIT_TABLE);
  assert.equal(scan.splitTables.length, 1);
  assert.deepEqual(scan.splitTableCandidates, [], "a pairing with a real dispatch consumer is PROVEN, never advisory");
  const split = scan.splitTables[0]!;
  assert.equal(split.loBase, 0xc010);
  assert.equal(split.hiBase, 0xc013);
  assert.equal(
    split.orientationResolved,
    true,
    "the lo/hi roles must come from the store construction (the load reaching $fb holds the low byte), never from Math.min over the two bases -- WR-01",
  );
  assert.equal(split.entries, 3, "the entry count is the fixed distance between the two bases");
  assert.deepEqual(split.targets, [0xc00d, 0xc00d, 0xc00d]);
  assert.ok(
    provenDispatchTargets(scan).includes(0xc00d),
    "a proven split table's targets MUST reach the one seam that seeds the descent -- otherwise the gate is a machine that declines everything",
  );
});

test("dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode", () => {
  assert.ok(!STACK_RETURN.includes(0x6c), "the stack-return payload must contain NO indirect-jump opcode -- that is the whole point of the class");
  const scan = scanOf(STACK_RETURN);
  assert.equal(scan.stackReturnDispatch.length, 1);
  const idiom = scan.stackReturnDispatch[0]!;
  assert.equal(idiom.at, 0xc000);
  assert.equal(idiom.hiBase, 0xc010);
  assert.equal(idiom.loBase, 0xc013);
  assert.deepEqual(
    idiom.targets,
    [0xc00a, 0xc00c, 0xc00e],
    "the idiom pushes target-1 because rts increments, so the scan must add one back. This assertion read [$c006, $c006, $c006] until 19-11 " +
      "(WR-14): $c006 is the third byte of this payload's own `lda $c013,x` at $c004..$c006, so the committed positive control was pinning a " +
      "mid-instruction address as a proven entry point. The fixture was rebuilt to name three real one-byte routines in the filler region; a " +
      "number here that is neither triple-$c006 nor the three above is a rewrite, not a regression -- read the payload's comment first.",
  );
  assert.equal(idiom.truncated, false, "every one of the three entries is plausible, so nothing was cut short");

  // The property the old fixture violated, asserted rather than described: a
  // reconstructed entry point may not fall inside any instruction of the
  // matched window. Derived from the decoded stream, so it holds for whatever
  // the payload becomes rather than for the bytes committed today.
  const insns = decode(STACK_RETURN, DISPATCH_ORIGIN);
  const windowBytes = new Set<number>();
  for (const insn of insns.slice(0, 5)) for (const [k] of insn.bytes.entries()) windowBytes.add(insn.address + k);
  assert.deepEqual([...windowBytes].sort((x, y) => x - y), [0xc000, 0xc001, 0xc002, 0xc003, 0xc004, 0xc005, 0xc006, 0xc007, 0xc008]);
  for (const target of idiom.targets) {
    assert.ok(
      !windowBytes.has(target),
      `$${target.toString(16)} falls INSIDE the idiom's own five-instruction window ($c000..$c008), so it is a mid-instruction address rather ` +
        `than an entry point -- and it is being handed to provenDispatchTargets(), whose doc comment says adding a source to it IS the ` +
        `decision to treat that source as proof of code. Pre-19-11 the committed fixture reconstructed $c006 and this suite asserted it was correct.`,
    );
  }

  assert.deepEqual(
    provenDispatchTargets(scan),
    [0xc00a, 0xc00c, 0xc00e],
    "BOTH DIRECTIONS: the gate added in 19-11 must not turn class 4 into a machine that declines everything -- the genuine idiom's targets must " +
      "still reach the ONE seam that seeds a recursive descent",
  );
});

test("dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different index registers", () => {
  // WR-14, consequence 1. Reproduced against the shipped code at the phase's
  // HEAD: this payload was reported as a class-4 idiom with three targets and
  // yielded provenDispatchTargets = [$c006] (and [$c00a, $c00c, $c00e] once
  // the fixture was rebuilt) -- from two tables walked by two DIFFERENT
  // registers, which class 3's own comment calls "two tables, not one split
  // one".
  assert.equal(STACK_RETURN_MIXED_REGISTERS.length, STACK_RETURN.length, "the control must differ from the genuine fixture in ONE byte, not in its shape");
  let differing = 0;
  for (const [i, byte] of STACK_RETURN.entries()) if (byte !== STACK_RETURN_MIXED_REGISTERS[i]) differing++;
  assert.equal(differing, 1, "exactly one byte -- the second load's opcode -- may differ, or the control tests more than the register mismatch");

  const insns = decode(STACK_RETURN_MIXED_REGISTERS, DISPATCH_ORIGIN);
  assert.equal(insns[2]!.mode, "absolute_y", "the second load must be absolute_y: zeropage_y is absent from INDEXED_LOAD_MODES and would fail the window check for the wrong reason");
  assert.equal(insns[0]!.mode, "absolute_x");

  const scan = scanOf(STACK_RETURN_MIXED_REGISTERS);
  assert.deepEqual(
    scan.stackReturnDispatch,
    [],
    "two indexed tables walked by two DIFFERENT registers are two tables, not one split one. Pre-gate this reported one class-4 finding with " +
      "loBase $c013 / hiBase $c010 and three reconstructed targets.",
  );
  assert.deepEqual(
    provenDispatchTargets(scan),
    [],
    "pre-gate this returned [$c006] against the originally-committed table bytes, and [$c00a, $c00c, $c00e] against the rebuilt ones -- either " +
      "way a value manufactured out of two unrelated tables, seeding a recursive descent",
  );
  assert.deepEqual(scan.tableEntryAddresses, [], "a declined window must not claim a single byte as a table entry either");

  // NOT under-reported silently: class 4 declines the window WITHOUT claiming
  // it, so class 3 still sees the pairing and still reports it -- as an
  // advisory candidate with no orientation and no targets, which is the honest
  // statement "something indexes two tables here and we cannot prove what it
  // dispatches to".
  assert.equal(scan.splitTableCandidates.length, 1, "the pairing must still be REPORTED as advisory -- a declined window must not become silence");
  assert.equal(scan.splitTableCandidates[0]!.orientationResolved, false);
  assert.deepEqual(scan.splitTableCandidates[0]!.targets, []);
  assert.deepEqual(scan.splitTables, [], "class 3 must not promote it either: its own condition (b) is the same register match");

  // Both directions in one test.
  assert.equal(scanOf(STACK_RETURN).stackReturnDispatch.length, 1, "the genuine idiom must still be found -- a gate that declines everything measures nothing");
});

test("dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction", () => {
  // WR-14, consequence 2. Reproduced against the shipped code at the phase's
  // HEAD: setting the reconstructed target byte to $02 (jam) changed NOTHING
  // -- targets, provenDispatchTargets and the descent seed were identical to
  // the genuine fixture's.
  const decoded = decode(STACK_RETURN_IMPLAUSIBLE_TARGET.subarray(0xc00a - DISPATCH_ORIGIN), 0xc00a, { count: 1 })[0]!;
  assert.equal(decoded.illegal, true, "the control's target must actually be an illegal opcode, or it tests nothing");
  assert.equal(decoded.mnemonic, "jam");

  const scan = scanOf(STACK_RETURN_IMPLAUSIBLE_TARGET);
  const finding = scan.stackReturnDispatch[0];
  assert.ok(
    finding === undefined || (finding.targets.length === 0 && finding.truncated),
    `an entry point that does not decode may not be published: the finding must be absent, or carry an empty target list and a truthy truncated ` +
      `flag. Got ${JSON.stringify(finding)}. Pre-gate it carried three targets and truncated=false.`,
  );
  assert.deepEqual(
    provenDispatchTargets(scan),
    [],
    "pre-gate this returned [$c00a, $c00c, $c00e] -- three addresses whose bytes decode as `jam` -- and seeded a recursive descent from them",
  );
  assert.deepEqual(scan.tableEntryAddresses, [], "an implausible walk must not claim a single byte as a table entry either");

  // NOT under-reported silently: the walk was cut short, and the scan says so.
  assert.equal(
    scan.truncated,
    true,
    "the class-4 entry count is derived from the distance between the two bases and is therefore a GUESS, so a walk stopped by the plausibility " +
      "test must raise the scan-level truncated flag. Reporting a clean, empty result would be a silent under-report.",
  );

  // Both directions in one test.
  assert.equal(scanOf(STACK_RETURN).stackReturnDispatch.length, 1, "the genuine idiom must still be found");
  assert.equal(scanOf(STACK_RETURN).truncated, false, "and it must not be reported as truncated");
});

// ---------------------------------------------------------------------------
// 8b. The NEGATIVE controls the class-3 scan never had (19-08)
//
// The class-3 split-table scan's risk is FALSE POSITIVES, and until now it had
// a positive control only. That asymmetry is exactly why a fully green suite
// concealed a reproduced blocker: `19-REVIEW.md` CR-02 showed that two 64-byte
// programs differing ONLY in immediate versus indexed addressing reported
// reached=7 and reached=55 -- an 8x inflation of the headline structural
// measure, manufactured out of ordinary data, with `splitTables=1` and
// `discovered=8`. Every test in this section asserts that the instrument
// DECLINES something. A heuristic with a positive control and no negative one
// is not evidence that it declines anything.
//
// THE HALF THAT WAS STILL MISSING (`19-REVIEW.md` CR-04). Asserting that the
// instrument declines SOMETHING is not the same as asserting it declines the
// thing it must. Every negative control this section shipped in 19-08 --
// `ORDINARY_INDEXED_COPY`, `fp1`, `fp1b` -- carries no zero-page store at all,
// and the positive control `SPLIT_TABLE` carries a real `jmp ($00fb)`. The two
// bracket the gate from the OUTSIDE. Nothing exercised its INTERIOR: a vector
// that IS genuinely built and then consumed by something other than a jump,
// which is how every 16-bit pointer on a 6502 is built. A negative control
// built from the outside of the predicate it constrains is not a control at
// all, and that is why a 2517-passing suite concealed a reproduced false
// positive that inflated the headline census from 17 to 33 bytes.
//
// Section 8c below turns that sentence into a mechanism: every negative
// dispatch control DECLARES which side of the predicate it is on, the
// declaration is CHECKED by a witness that decodes the payload rather than
// accepted as a claim, every shape the predicate accepts must be claimed by an
// interior declaration, and the declared shape count is tied to the predicate's
// own source text. A future tightening therefore cannot be verified the way
// this one was.
// ---------------------------------------------------------------------------

test("dispatch class 3 DECLINES an ordinary two-table indexed read loop", () => {
  const scan = scanIndirectDispatch(decode(ORDINARY_INDEXED_COPY, ORDINARY_ORIGIN), ORDINARY_INDEXED_COPY, ORDINARY_ORIGIN);

  assert.deepEqual(
    scan.splitTables,
    [],
    "an indexed copy loop with NO indirect jump, NO pha/pha/rts and NO zero-page vector construction is not a dispatch table. " +
      "Pre-gate this reported splitTables=1 with 8 reconstructed 'targets' at $0820..$0827.",
  );
  assert.equal(
    scan.splitTableCandidates.length,
    1,
    "the pairing must still be REPORTED, as an advisory candidate -- discarding it would make the instrument quieter rather than more honest, " +
      "and Phase 21's hazard report wants to see 'something indexes two tables here and we cannot prove what it dispatches to'",
  );
  const candidate = scan.splitTableCandidates[0]!;
  assert.equal(candidate.orientationResolved, false, "nothing in this payload determines which base holds the low byte, so no orientation may be asserted");
  assert.deepEqual(candidate.targets, [], "an unoriented pairing must emit NO targets -- a byte-swapped value is not an address (WR-01)");

  assert.deepEqual(provenDispatchTargets(scan), [], "an ungated pairing must contribute nothing to the ONE seam that seeds a descent");
  assert.deepEqual(scan.tableEntryAddresses, [], "an ungated pairing must not claim a single byte as a table entry either");

  // Both directions in one test: the gate must not be a machine that declines
  // everything. The genuinely-consumed split table still passes.
  assert.equal(scanOf(SPLIT_TABLE).splitTables.length, 1, "a real split table with a genuine dispatch consumer must still be PROVEN");
});

test("an ordinary indexed copy loop does not inflate the census over its immediate twin", () => {
  // "Differing ONLY in addressing mode" is a CHECKED property of the fixtures,
  // not a claim about them: the comparison below is meaningless if the two
  // payloads differ anywhere outside their seven-byte prologue.
  assert.equal(ORDINARY_INDEXED_COPY.length, ORDINARY_IMMEDIATE_COPY.length);
  assert.equal(ORDINARY_INDEXED_PROLOGUE.length, ORDINARY_IMMEDIATE_PROLOGUE.length);
  assert.deepEqual(
    [...ORDINARY_INDEXED_COPY.subarray(ORDINARY_CODE_BYTES)],
    [...ORDINARY_IMMEDIATE_COPY.subarray(ORDINARY_CODE_BYTES)],
    "the 57 data bytes must be identical -- otherwise the two payloads differ in more than their addressing mode",
  );

  const indexed = wiredCensus(ORDINARY_INDEXED_COPY, ORDINARY_ORIGIN);
  const immediate = wiredCensus(ORDINARY_IMMEDIATE_COPY, ORDINARY_ORIGIN);

  assert.equal(
    indexed.census.reachedAsInstruction,
    immediate.census.reachedAsInstruction,
    `two programs with identical code content, differing ONLY in addressing mode, must report the same reachedAsInstruction. ` +
      `Pre-gate the indexed variant reported reached=55 / unreached=9 against the immediate twin's reached=7 / unreached=57 ` +
      `(splitTables=1, discovered=8): an 8x inflation of the headline structural measure, manufactured out of 57 bytes of ordinary data.`,
  );
  assert.ok(
    indexed.census.reachedAsInstruction <= ORDINARY_CODE_BYTES,
    `the census reached ${indexed.census.reachedAsInstruction} bytes of a program whose real code is ${ORDINARY_CODE_BYTES} bytes -- ` +
      `reachedAsInstruction means REACHED BY RECURSIVE DESCENT FROM A SEED, so it can never exceed the code that is actually there`,
  );
  assert.ok(immediate.census.reachedAsInstruction <= ORDINARY_CODE_BYTES);

  // The two operand bases are legitimately `referenced-as-data` -- which is
  // correct, and is NOT `reached-as-instruction`. That is the whole 2-byte
  // difference between the two unreached counts.
  assert.equal(
    immediate.census.unreached - indexed.census.unreached,
    2,
    "the indexed variant's only remaining difference is its two operand bases, marked referenced-as-data",
  );
  assert.equal(indexed.census.referencedAsData, 2);
});

test("the class-4 stack-return idiom is not also reported as a class-3 split table", () => {
  const scan = scanOf(STACK_RETURN);
  assert.equal(scan.stackReturnDispatch.length, 1);
  const idiom = scan.stackReturnDispatch[0]!;
  assert.ok(idiom.targets.length > 0, "the idiom reported no targets -- the byte-swap assertion below would be vacuous");

  for (const finding of [...scan.splitTables, ...scan.splitTableCandidates]) {
    assert.notEqual(
      finding.at,
      idiom.at,
      `WR-01: the same five instructions at $${idiom.at.toString(16)} were reported by BOTH class 4 and class 3, with contradictory lo/hi roles. ` +
        `Class 4 runs first and claims its window precisely so class 3 declines it.`,
    );
  }

  const byteSwap = (a: number): number => ((a & 0xff) << 8) | ((a >> 8) & 0xff);
  const reported = [...idiom.targets, ...scan.splitTables.flatMap((f) => f.targets), ...scan.splitTableCandidates.flatMap((f) => f.targets)];
  for (const a of reported) {
    for (const b of reported) {
      if (a === b) continue;
      assert.notEqual(
        b,
        byteSwap(a),
        `WR-01: $${b.toString(16)} is the byte-swap of $${a.toString(16)}, so the same two table bases were read in both orders and both results published as addresses`,
      );
    }
  }
});

test("an advisory split-table candidate never reaches the census", () => {
  // The advisory pairing in ORDINARY_INDEXED_COPY reconstructs $0820..$0827
  // from the bytes at its two operand bases, and every one of those values
  // lands inside the image -- so nothing but the gate keeps them out of the
  // census. Reconstructed here by hand from the payload, so this control does
  // not depend on the scan reporting them.
  const wouldBeTargets = [0x0820, 0x0821, 0x0822, 0x0823, 0x0824, 0x0825, 0x0826, 0x0827];
  const { scan, census } = wiredCensus(ORDINARY_INDEXED_COPY, ORDINARY_ORIGIN);
  assert.equal(scan.splitTableCandidates.length, 1, "the pairing must be advisory here, or this control tests nothing");

  for (const address of wouldBeTargets) {
    assert.ok(address >= ORDINARY_ORIGIN && address < ORDINARY_ORIGIN + ORDINARY_INDEXED_COPY.length, `$${address.toString(16)} must be in-image`);
    assert.notEqual(
      classAt(census, address),
      "reached-as-instruction",
      `$${address.toString(16)} was reconstructed from data bytes by an UNPROVEN pairing -- it must never be classified as reached by descent`,
    );
  }
  // $0827 is one of the two operand bases, so it is legitimately data.
  assert.equal(classAt(census, 0x0827), "referenced-as-data");
  for (const address of wouldBeTargets.filter((a) => a !== 0x0827)) {
    assert.equal(classAt(census, address), "unreached", `$${address.toString(16)}`);
  }
});

test("a census whose origin plus size would leave the 16-bit space is bounded", () => {
  // IN-04. A `.regen2000proj` the operator did not author can claim any origin
  // and carry any length; the contract on malformed input is a well-formed
  // census, never a wrap and never a classified address the machine cannot
  // address.
  const bytes = new Uint8Array(64).fill(0xea);
  const census = computeStructuralCensus(bytes, 0xfff0, [0xfff0]);

  assert.equal(census.rangeBytes, 0x10000 - 0xfff0, "only the bytes inside the 16-bit space are censused");
  assert.equal(
    census.reachedAsInstruction + census.tableEntry + census.referencedAsData + census.unreached,
    census.rangeBytes,
    "the four classes must sum to the censused range",
  );
  assert.equal(census.size, bytes.length, "the payload's own length is still reported, so the truncation is visible rather than hidden");
  assert.equal(classAt(census, 0x10000), null, "no address at or beyond $10000 may be classified");
  assert.equal(classAt(census, 0xffff), "reached-as-instruction", "the last in-space byte is still censused normally");
  assert.ok(census.linearSweepDecodable <= census.rangeBytes, "the linear sweep is bounded by the same range as the census");
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
// 9. The committed controls
// ---------------------------------------------------------------------------

/** The pinned size of the committed control set: five findings controls, one
 * non-vacuity control, the two-fixture false-positive census pair, and the
 * two-fixture INTERIOR control pair (`fp2-zeropage-data-pointer` and its
 * immediate twin `fp2b-immediate-data-pointer`) -- payloads that satisfy every
 * condition the pre-CR-04 gate required while dispatching nowhere at all. The
 * number lives here and in `fixtures/coverage/README.md`, and both must agree
 * with the directory count -- a stale count in either is the same defect class
 * this phase's gap closure exists to remove. */
const COMMITTED_CONTROL_FIXTURES = 10;

test("the committed control set is exactly the pinned size, and every fixture carries a project file and a store file", () => {
  const dirs = fixtureDirs();
  assert.equal(
    dirs.length,
    COMMITTED_CONTROL_FIXTURES,
    `expected ${COMMITTED_CONTROL_FIXTURES} committed control fixtures, found ${dirs.length}: ${dirs.join(", ")}`,
  );
  for (const dir of dirs) {
    const { store } = loadFixture(dir);
    assert.ok(readFileSync(join(FIXTURE_ROOT, dir, "project.regen2000proj"), "utf8").length > 0, `${dir}: project file is empty`);
    assert.equal(typeof store.expect_clean, "boolean", `${dir}: store.json must declare expect_clean`);
    if (store.code_size !== undefined) {
      // A fixture that declares a code size is asserted about NUMERICALLY, so
      // it owes a reader a sentence saying what property it holds down. A bare
      // number with no stated purpose is how a control decays into a constant.
      assert.equal(typeof store.purpose, "string", `${dir}: a store declaring code_size must declare a purpose`);
      assert.ok(store.purpose.trim().length > 0, `${dir}: a store declaring code_size must declare a NON-EMPTY purpose`);
    }
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

const FP_INDEXED = "fp1-indexed-copy-loop";
const FP_IMMEDIATE = "fp1b-immediate-copy-loop";

/** The 64 payload bytes a fixture's project file actually carries, read back
 * through the shipped decoder rather than re-derived from the generator. */
function payloadOf(dir: string): Uint8Array {
  const { projectPath } = loadFixture(dir);
  const project = JSON.parse(readFileSync(projectPath, "utf8")) as { raw_data_base64: string };
  return decodeRawData(project.raw_data_base64);
}

test("a false-positive control fixture is committed for the census, and the census declines to inflate on it", () => {
  // The scan-level negative controls in section 8 prove the GATE declines an
  // ordinary indexed copy loop. This is the REPORT-level statement of the same
  // property, run through `buildCoverageReport()` on committed fixtures --
  // which is where every other report-level control in this project lives, and
  // where the gap ("the census does NOT inflate") is actually phrased.
  const indexedStore = loadFixture(FP_INDEXED).store;
  const immediateStore = loadFixture(FP_IMMEDIATE).store;

  assert.equal(typeof indexedStore.code_size, "number", `${FP_INDEXED}: the bound must be DECLARED BY THE FIXTURE, not typed into this test`);
  assert.equal(typeof immediateStore.code_size, "number", `${FP_IMMEDIATE}: the bound must be DECLARED BY THE FIXTURE, not typed into this test`);

  const indexed = reportFor(FP_INDEXED);
  const immediate = reportFor(FP_IMMEDIATE);

  assert.equal(
    indexed.structural.reachedAsInstruction,
    immediate.structural.reachedAsInstruction,
    `two committed programs with identical code content, differing ONLY in addressing mode, must report the same ` +
      `structural.reachedAsInstruction. Pre-gate the indexed fixture reached 55 of its 64 bytes against 7 bytes of real code, ` +
      `while the immediate twin reached 7: an 8x inflation of the headline structural measure, manufactured out of 57 bytes ` +
      `of ordinary data. A number here that is neither 7 nor 55 is a rewrite, not a regression -- read the generator first.`,
  );
  assert.ok(
    indexed.structural.reachedAsInstruction <= indexedStore.code_size!,
    `${FP_INDEXED}: the census reached ${indexed.structural.reachedAsInstruction} bytes of a program whose store declares ` +
      `${indexedStore.code_size} bytes of code. reachedAsInstruction means REACHED BY RECURSIVE DESCENT FROM A SEED, so it can ` +
      `never exceed the code that is actually there (pre-gate: 55).`,
  );
  assert.ok(
    immediate.structural.reachedAsInstruction <= immediateStore.code_size!,
    `${FP_IMMEDIATE}: the census reached ${immediate.structural.reachedAsInstruction} bytes against a declared ${immediateStore.code_size}`,
  );

  // Two equal numbers alone would be satisfiable by an instrument that saw
  // nothing at all in either fixture. State the ONE structural difference
  // between the pair explicitly, so the equality above is the equality of two
  // reports that DID see the difference and declined to act on it.
  assert.equal(
    indexed.dispatch.splitTableCandidates.length,
    1,
    `${FP_INDEXED}: the ungated lo/hi pairing must still be REPORTED as an advisory candidate -- discarding it would make the ` +
      `instrument quieter rather than more honest`,
  );
  assert.equal(indexed.dispatch.splitTableCandidates[0]!.orientationResolved, false, "nothing in this payload determines which base holds the low byte");
  assert.deepEqual(indexed.dispatch.splitTableCandidates[0]!.targets, [], "an unoriented pairing must emit NO targets");
  assert.equal(immediate.dispatch.splitTableCandidates.length, 0, `${FP_IMMEDIATE}: the immediate twin has no indexed pair at all, so it has nothing to advise about`);

  // The proven-target seam -- the ONE thing that may seed a descent -- must
  // contribute nothing for either fixture. `provenDispatchTargets()` is read
  // here rather than `dispatch.discoveredTargets`, for the reason the seam
  // exists.
  assert.deepEqual(provenDispatchTargets(indexed.dispatch), [], `${FP_INDEXED}: an ungated pairing must contribute nothing to the seam that seeds a descent`);
  assert.deepEqual(provenDispatchTargets(immediate.dispatch), [], `${FP_IMMEDIATE}: nothing to contribute`);
  assert.deepEqual(indexed.dispatch.splitTables, [], `${FP_INDEXED}: an ordinary copy loop is not a PROVEN split table (pre-gate: splitTables=1, discovered=8)`);
  assert.deepEqual(indexed.dispatch.tableEntryAddresses, [], `${FP_INDEXED}: an ungated pairing must not claim a single byte as a table entry either`);
});

test("FP1b earns its place: without a committed twin, FP1's census could only be compared against a remembered number", () => {
  // The whole gap-closure run exists to replace remembered numbers with
  // measured ones. A lone indexed fixture asserting `reached <= 7` would be
  // satisfied by an instrument that had quietly stopped censusing anything;
  // the twin supplies the live baseline that makes the comparison mean
  // something, and it is COMMITTED rather than built inline so the pair's
  // relationship is a property of the repository.
  const indexed = loadFixture(FP_INDEXED).store;
  const immediate = loadFixture(FP_IMMEDIATE).store;

  assert.equal(indexed.origin, immediate.origin, "the pair must sit at the same origin, or their censuses are not comparable");
  assert.equal(indexed.size, immediate.size, "the pair must be the same length");
  assert.equal(indexed.code_size, immediate.code_size, "the pair must declare the same code size");

  const a = payloadOf(FP_INDEXED);
  const b = payloadOf(FP_IMMEDIATE);
  const codeSize = indexed.code_size!;
  assert.equal(a.length, b.length);
  assert.notDeepEqual(
    [...a.subarray(0, codeSize)],
    [...b.subarray(0, codeSize)],
    "the prologues must actually DIFFER -- two identical programs would make the comparison vacuous",
  );
  assert.deepEqual(
    [...a.subarray(codeSize)],
    [...b.subarray(codeSize)],
    "the 57 data bytes must be identical in the COMMITTED payloads, not merely in the generator that wrote them",
  );

  // And the baseline is a live measurement, not a constant: the twin must
  // reach something, or "equal to the twin" would be satisfiable by zero.
  const immediateReport = reportFor(FP_IMMEDIATE);
  assert.ok(immediateReport.structural.reachedAsInstruction > 0, "the baseline half of the pair must actually reach something");
  assert.equal(immediateReport.structural.reachedAsInstruction, codeSize, "the immediate twin's every code byte is reached, and nothing beyond it");
});

const FP2_INTERIOR = "fp2-zeropage-data-pointer";
const FP2_IMMEDIATE = "fp2b-immediate-data-pointer";

test("a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it", () => {
  // The gate's INTERIOR, at report level. FP1/FP1b carry no zero-page store at
  // all and the positive control SPLIT_TABLE carries a real `jmp ($00fb)`, so
  // those two bracket the gate from the OUTSIDE. This fixture is inside it: it
  // satisfies every condition the pre-CR-04 gate required -- two indexed loads
  // through the same register, two stores into CONSECUTIVE zero-page addresses
  // inside the pairing window, a resolvable lo/hi orientation, and eight
  // reconstructed targets that every one of them decodes -- and then consumes
  // its vector with `lda ($fb),y`, an indirect-indexed DATA read. Building a
  // 16-bit pointer is not dispatching through one.
  const store = loadFixture(FP2_INTERIOR).store;
  assert.equal(typeof store.code_size, "number", `${FP2_INTERIOR}: the bound must be DECLARED BY THE FIXTURE, not typed into this test`);

  const report = reportFor(FP2_INTERIOR);

  assert.deepEqual(
    report.dispatch.splitTables,
    [],
    `${FP2_INTERIOR}: a zero-page vector consumed by an indirect-indexed DATA read is not a PROVEN split table. ` +
      `Pre-fix splitTables.length was 1 { loBase: $0830, hiBase: $0838 } -- the gate accepted the CONSTRUCTION of a 16-bit ` +
      `pointer as proof of dispatch, which is how every 16-bit pointer on a 6502 is built (CR-04).`,
  );
  assert.deepEqual(
    provenDispatchTargets(report.dispatch),
    [],
    `${FP2_INTERIOR}: nothing here may seed a recursive descent. Pre-fix this returned the eight values ` +
      `$0840, $0841, $0842, $0843, $0844, $0845, $0846, $0847 -- reconstructed out of 16 bytes of ordinary pointer data.`,
  );
  assert.deepEqual(
    report.dispatch.tableEntryAddresses,
    [],
    `${FP2_INTERIOR}: an ungated pairing must not claim a single byte as a table entry either. Pre-fix it claimed 16 addresses ` +
      `($0830..$0837 and $0838..$083f).`,
  );
  assert.equal(
    classAt(report.structural, 0x0840),
    "unreached",
    `${FP2_INTERIOR}: $0840 holds ordinary data that nothing proven ever reaches. Pre-fix its class was ` +
      `"reached-as-instruction" -- the HEADLINE measure, manufactured out of data.`,
  );
  assert.ok(
    report.structural.reachedAsInstruction <= store.code_size!,
    `${FP2_INTERIOR}: the census reached ${report.structural.reachedAsInstruction} bytes of a program whose store declares ` +
      `${store.code_size} bytes of code. reachedAsInstruction means REACHED BY RECURSIVE DESCENT FROM A SEED, so it can never ` +
      `exceed the code that is actually there (pre-fix: 33 against a declared 17).`,
  );

  // The census baseline is MEASURED, not remembered: the immediate twin is a
  // committed fixture whose only difference is the addressing mode of the two
  // vector-byte loads. Two equal numbers alone would be satisfiable by an
  // instrument that saw nothing in either, so the twin's own non-zero census is
  // asserted in "FP2b earns its place" below.
  const twinStore = loadFixture(FP2_IMMEDIATE).store;
  const twin = reportFor(FP2_IMMEDIATE);
  assert.equal(
    report.structural.reachedAsInstruction,
    twin.structural.reachedAsInstruction,
    `the interior control and its immediate twin carry 17 bytes of real code EACH and differ only in the addressing mode of two ` +
      `loads, so they must report the same structural.reachedAsInstruction. Pre-fix the pair was asymmetric: 33 against the twin's ` +
      `17, because the indexed variant's two loads were promoted to a "proven" split table and their 16 bytes of pointer data ` +
      `became descent seeds. A number here that is neither 17 nor 33 is a rewrite, not a regression -- read the generator first.`,
  );
  assert.ok(
    twin.structural.reachedAsInstruction <= twinStore.code_size!,
    `${FP2_IMMEDIATE}: the census reached ${twin.structural.reachedAsInstruction} bytes against a declared ${twinStore.code_size}`,
  );

  // Both directions in one test: the gate must not become a machine that
  // declines everything. The genuinely-consumed split table -- whose
  // `jmp ($00fb)` operand value equals its own `sta $fb` target -- is still
  // PROVEN, and its targets still reach the one seam that seeds a descent.
  const proven = scanOf(SPLIT_TABLE);
  assert.equal(proven.splitTables.length, 1, "a real split table with a genuine dispatch consumer must still be PROVEN");
  assert.ok(
    provenDispatchTargets(proven).includes(0xc00d),
    "the proven split table's reconstructed target must still reach provenDispatchTargets() -- a tightening that declines everything measures nothing",
  );
});

test("FP2b earns its place: without a committed twin, the interior control's census could only be compared against a remembered number", () => {
  // The same reasoning as `FP1b earns its place`, pointed at the interior
  // control. A lone FP2 asserting `reached <= 17` would be satisfied by an
  // instrument that had quietly stopped censusing anything; the twin supplies
  // the live baseline that makes "equal to the twin" mean something, and it is
  // COMMITTED rather than built inline so the pair's relationship is a property
  // of the repository rather than of the generator that wrote it.
  const indexed = loadFixture(FP2_INTERIOR).store;
  const immediate = loadFixture(FP2_IMMEDIATE).store;

  assert.equal(indexed.origin, immediate.origin, "the pair must sit at the same origin, or their censuses are not comparable");
  assert.equal(indexed.size, immediate.size, "the pair must be the same length");
  assert.equal(indexed.code_size, immediate.code_size, "the pair must declare the same code size");

  const a = payloadOf(FP2_INTERIOR);
  const b = payloadOf(FP2_IMMEDIATE);
  const codeSize = indexed.code_size!;
  assert.equal(a.length, b.length);
  assert.notDeepEqual(
    [...a.subarray(0, codeSize)],
    [...b.subarray(0, codeSize)],
    "the prologues must actually DIFFER -- two identical programs would make the comparison vacuous",
  );
  assert.deepEqual(
    [...a.subarray(codeSize)],
    [...b.subarray(codeSize)],
    "the 47 data bytes must be identical in the COMMITTED payloads, not merely in the generator that wrote them",
  );

  // And the baseline is a live measurement, not a constant: the twin must reach
  // something, or "equal to the twin" would be satisfiable by zero.
  const twin = reportFor(FP2_IMMEDIATE);
  assert.ok(
    twin.structural.reachedAsInstruction > 0,
    "the baseline half of the interior pair must actually reach something -- otherwise the equality asserted above is satisfiable by an " +
      "instrument that censused nothing at all, which is the failure mode a measured baseline exists to rule out",
  );
  assert.equal(twin.structural.reachedAsInstruction, codeSize, "the immediate twin's every code byte is reached, and nothing beyond it");

  // The twin has no indexed pair at all, so it has nothing to advise about --
  // which is the ONE structural difference between the two reports, stated so
  // the equality above is the equality of two reports that DID see it.
  assert.equal(indexed.size, 0x40, "the interior control is a 64-byte payload");
  assert.equal(reportFor(FP2_INTERIOR).dispatch.splitTableCandidates.length, 1, `${FP2_INTERIOR}: the ungated lo/hi pairing must still be REPORTED as advisory`);
  assert.equal(twin.dispatch.splitTableCandidates.length, 0, `${FP2_IMMEDIATE}: the immediate twin has no indexed pair at all`);
});

// ---------------------------------------------------------------------------
// 8c. Which SIDE of the predicate each negative control is on (CR-04)
//
// THE ROOT CAUSE, IN ONE SENTENCE: a negative control built from the OUTSIDE of
// the predicate it constrains is not a control, and that is why a 2517-passing
// suite concealed CR-04 -- every negative control the dispatch gate had carried
// no zero-page store at all, so none of them was ever inside the region the
// gate had to rule on.
//
// The mechanism below makes a repeat of that fail the suite:
//
//   * `reachesGateInterior()` is a WITNESS. It decodes a payload with the same
//     `decode()` the scan uses and answers whether the payload satisfies the
//     PRE-GATE sufficient condition for a named shape -- deliberately NOT
//     whether the gate accepts it. "Is this payload inside the region the gate
//     must rule on?" is a different question from "does the gate accept it?",
//     and conflating the two is how an outside-bracketing control passes for an
//     interior one.
//   * `GATE_INTERIOR_DECLARATIONS` records, per negative dispatch control, the
//     shape id whose interior it reaches -- or `OUTSIDE`, explicitly.
//   * The tests check every declaration mechanically, require every shape in
//     `DISPATCH_CONTEXT_SHAPES` to be claimed by an interior declaration, and
//     tie the declared shape COUNT to the predicate's own source text. A shape
//     added without an interior control, or a sufficient branch added without a
//     declared shape, reds the suite BY NAME.
// ---------------------------------------------------------------------------

/** The explicit value a declaration uses to record that its control brackets
 * the predicate from the OUTSIDE rather than reaching any shape's interior.
 * A distinguishable sentinel, never `null` or the empty string, so an omitted
 * position cannot read as a deliberate one. */
const OUTSIDE = "OUTSIDE-BRACKETING" as const;

/**
 * Does `bytes` satisfy the PRE-GATE sufficient condition named by `shapeId`?
 *
 * The question is deliberately NOT "does `hasDispatchContext()` accept this?".
 * It is "is this payload inside the region the gate has to rule on?" -- the
 * question an interior control must answer yes to and an outside-bracketing one
 * no to.
 *
 * `zeropage-vector-jumped-through` starts from the class-3 pairing precondition
 * the gate itself requires, so a payload with no same-register indexed load
 * pair is outside it by construction. `stack-return-push-idiom` is reached by
 * EITHER of the two gates that rule on it: the class-4 pass's own
 * five-instruction window (register-agnostic -- see below), or the class-3
 * pairing precondition followed by `pha` ... `pha` ... `rts` in reach.
 *
 * THROWS on a shape id it carries no predicate for, and the message names the
 * id. Never returns a bare boolean for an unknown shape: returning `true` would
 * make the shape-coverage test pass VACUOUSLY for any newly minted id, so the
 * whole mechanism could be satisfied without anyone writing a real interior
 * predicate -- the same vacuity class this section exists to prevent. Returning
 * `false` would let a row dodge the check by declaring a shape that does not
 * exist. Throwing is the only behaviour that makes minting a shape id without
 * an interior predicate a test failure.
 */
function reachesGateInterior(bytes: Uint8Array, origin: number, shapeId: string): boolean {
  if (shapeId !== "stack-return-push-idiom" && shapeId !== "zeropage-vector-jumped-through") {
    throw new Error(
      `reachesGateInterior() has no interior predicate for shape id "${shapeId}". A shape listed in ` +
        `DISPATCH_CONTEXT_SHAPES must have a predicate here that says what its INTERIOR is, or a control could be ` +
        `declared as its interior control without anything checking the claim.`,
    );
  }

  const insns = decode(bytes, origin);
  const indexRegister = (i: number): "x" | "y" | null => {
    const m = insns[i]!.mode;
    if (m === "absolute_x" || m === "zeropage_x") return "x";
    if (m === "absolute_y" || m === "zeropage_y") return "y";
    return null;
  };
  const isIndexedLoad = (i: number): boolean => {
    const insn = insns[i]!;
    return !!insn.operand && insn.mnemonic.startsWith("ld") && indexRegister(i) !== null;
  };

  // THE CLASS-4 ROUTE INTO `stack-return-push-idiom` (19-11, WR-14). This
  // shape is ruled on by TWO gates, not one: `hasDispatchContext()`'s first
  // branch (reached only after the class-3 pairing precondition below), and
  // the class-4 pass's own five-instruction window -- which is the gate that
  // feeds `provenDispatchTargets()` directly and which had no negative control
  // at all until 19-11.
  //
  // The window shape is REGISTER-AGNOSTIC here, deliberately. The register
  // match is the CONDITION under test, so requiring it would put the
  // mismatched-register control outside the very predicate it constrains --
  // exactly the outside-bracketing mistake CR-04 turned on. "Is this payload
  // inside the region the gate must rule on?" is the question, and a
  // `lda ,x : pha : lda ,y : pha : rts` window is unambiguously inside it.
  if (shapeId === "stack-return-push-idiom") {
    for (let i = 0; i + 4 < insns.length; i++) {
      if (!isIndexedLoad(i)) continue;
      if (insns[i + 1]!.opcode !== 0x48) continue; // pha
      if (!isIndexedLoad(i + 2)) continue;
      if (insns[i + 3]!.opcode !== 0x48) continue; // pha
      if (insns[i + 4]!.opcode !== 0x60) continue; // rts
      return true;
    }
  }

  for (let i = 0; i < insns.length; i++) {
    if (!isIndexedLoad(i)) continue;
    const end = Math.min(insns.length, i + SPLIT_TABLE_WINDOW + 1);

    // The class-3 pairing precondition: a SECOND indexed load through the SAME
    // register inside the window. Without it the gate is never consulted, so
    // the payload is outside every shape.
    let paired = false;
    for (let j = i + 1; j < end; j++) {
      if (isIndexedLoad(j) && indexRegister(j) === indexRegister(i)) {
        paired = true;
        break;
      }
    }
    if (!paired) continue;

    if (shapeId === "stack-return-push-idiom") {
      // The interior: `pha` ... `pha` ... `rts` inside the window.
      let sawPha = 0;
      for (let k = i; k < end; k++) {
        if (insns[k]!.opcode === 0x48) sawPha++;
        if (insns[k]!.opcode === 0x60 && sawPha >= 2) return true;
      }
      continue;
    }

    // `zeropage-vector-jumped-through`. The interior is the CONSTRUCTION alone
    // -- two zero-page store targets differing by exactly one inside the window
    // -- with NO requirement that anything jump through it. That is precisely
    // the region the pre-CR-04 gate accepted wholesale and the fixed gate must
    // now rule on case by case.
    const zpStores: number[] = [];
    for (let k = i; k < end; k++) {
      const insn = insns[k]!;
      if (!insn.operand) continue;
      if (!["sta", "stx", "sty"].includes(insn.mnemonic)) continue;
      if (insn.operand.role !== "zeropage") continue;
      zpStores.push(insn.operand.value);
    }
    for (const a of zpStores) {
      for (const b of zpStores) {
        if (b - a === 1) return true;
      }
    }
  }
  return false;
}

interface GateInteriorDeclaration {
  /** The in-suite payload constant name, or the fixture directory name. */
  control: string;
  /** The committed or in-suite bytes, and the origin they sit at. */
  bytes: () => { bytes: Uint8Array; origin: number };
  /** The shape id whose interior this control reaches, or `OUTSIDE`. */
  position: string;
  /** Why this control exists, in one clause. Documentary. */
  note: string;
}

/**
 * One row per negative dispatch control this suite carries, with its POSITION
 * relative to the predicate it constrains. Populated honestly: four of these
 * bracket the gate from the outside and always did, and saying so plainly is
 * what makes the interior rows mean something.
 */
const GATE_INTERIOR_DECLARATIONS: readonly GateInteriorDeclaration[] = Object.freeze([
  {
    control: "ORDINARY_INDEXED_COPY",
    bytes: () => ({ bytes: ORDINARY_INDEXED_COPY, origin: ORDINARY_ORIGIN }),
    position: OUTSIDE,
    note: "an ordinary two-table indexed copy loop with NO zero-page store at all -- it never enters the region the gate rules on",
  },
  {
    control: FP_INDEXED,
    bytes: () => ({ bytes: payloadOf(FP_INDEXED), origin: loadFixture(FP_INDEXED).store.origin }),
    position: OUTSIDE,
    note: "the committed form of the same copy loop; no zero-page store, so outside by the same reasoning",
  },
  {
    control: FP_IMMEDIATE,
    bytes: () => ({ bytes: payloadOf(FP_IMMEDIATE), origin: loadFixture(FP_IMMEDIATE).store.origin }),
    position: OUTSIDE,
    note: "the immediate twin: not even an indexed load pair, so outside the class-3 pairing precondition itself",
  },
  {
    control: FP2_IMMEDIATE,
    bytes: () => ({ bytes: payloadOf(FP2_IMMEDIATE), origin: loadFixture(FP2_IMMEDIATE).store.origin }),
    position: OUTSIDE,
    note: "the interior control's twin. It BUILDS the same zero-page vector, but its two loads are immediate, so there is no indexed pair to rule on -- which is exactly why it is a census baseline and not a second interior control",
  },
  {
    control: FP2_INTERIOR,
    bytes: () => ({ bytes: payloadOf(FP2_INTERIOR), origin: loadFixture(FP2_INTERIOR).store.origin }),
    position: "zeropage-vector-jumped-through",
    note: "THE INTERIOR CONTROL. Two indexed loads through one register, two consecutive zero-page stores inside the window, a resolvable orientation, eight decodable targets -- and it dispatches nowhere (CR-04)",
  },
  {
    control: "STACK_RETURN",
    bytes: () => ({ bytes: STACK_RETURN, origin: DISPATCH_ORIGIN }),
    position: "stack-return-push-idiom",
    note: "reaches the push idiom's interior, and class 3 must still DECLINE it because class 4 runs first and claims the window (WR-01)",
  },
  {
    control: "STACK_RETURN_MIXED_REGISTERS",
    bytes: () => ({ bytes: STACK_RETURN_MIXED_REGISTERS, origin: DISPATCH_ORIGIN }),
    position: "stack-return-push-idiom",
    note: "THE CLASS-4 INTERIOR CONTROL for the register condition (WR-14). It matches the five-instruction window in every respect except that its two loads index through different registers, which is precisely what makes it interior rather than outside-bracketing",
  },
  {
    control: "STACK_RETURN_IMPLAUSIBLE_TARGET",
    bytes: () => ({ bytes: STACK_RETURN_IMPLAUSIBLE_TARGET, origin: DISPATCH_ORIGIN }),
    position: "stack-return-push-idiom",
    note: "THE CLASS-4 INTERIOR CONTROL for the entry-point condition (WR-14). Byte-identical to the genuine fixture apart from three data bytes, so the window matches, the reconstruction succeeds, and only the plausibility test declines it",
  },
]);

test("every gate-interior declaration is mechanically TRUE, not a claim in a table", () => {
  for (const row of GATE_INTERIOR_DECLARATIONS) {
    const { bytes, origin } = row.bytes();
    if (row.position === OUTSIDE) {
      for (const shapeId of DISPATCH_CONTEXT_SHAPES) {
        assert.equal(
          reachesGateInterior(bytes, origin, shapeId),
          false,
          `${row.control} is DECLARED as bracketing the predicate from the outside, but it reaches the interior of shape ` +
            `"${shapeId}". Either the declaration is wrong, or this control is more useful than its row claims -- and a control ` +
            `whose declared position is a claim rather than a fact is exactly the defect CR-04 turned on.`,
        );
      }
      continue;
    }
    assert.ok(
      reachesGateInterior(bytes, origin, row.position),
      `${row.control} is DECLARED as the interior control for shape "${row.position}", but the witness says the payload does not ` +
        `satisfy that shape's pre-gate sufficient condition. An interior control that is not actually inside the predicate ` +
        `bracketes it from the outside, which is not a control at all.`,
    );
  }
});

test("every shape the dispatch predicate accepts is claimed by an interior declaration", () => {
  // The standing mechanism. Adding a sufficient shape to DISPATCH_CONTEXT_SHAPES
  // without a negative control that reaches its interior reds the suite BY NAME
  // -- which is the exact failure the 19-08 tightening did not have.
  const claimed = new Set(GATE_INTERIOR_DECLARATIONS.filter((r) => r.position !== OUTSIDE).map((r) => r.position));
  for (const shapeId of DISPATCH_CONTEXT_SHAPES) {
    assert.ok(
      claimed.has(shapeId),
      `dispatch shape "${shapeId}" is listed in DISPATCH_CONTEXT_SHAPES but NO row of GATE_INTERIOR_DECLARATIONS claims its ` +
        `interior. A shape listed there is the decision to treat it as proof of code; that decision needs a control that reaches ` +
        `INSIDE it, not one that brackets it from the outside. Claimed shapes: ${[...claimed].join(", ") || "(none)"}.`,
    );
  }
  // And the reverse direction, so a stale row cannot satisfy a shape that no
  // longer exists.
  for (const shapeId of claimed) {
    assert.ok(
      DISPATCH_CONTEXT_SHAPES.includes(shapeId),
      `GATE_INTERIOR_DECLARATIONS claims the interior of shape "${shapeId}", which DISPATCH_CONTEXT_SHAPES does not list -- a ` +
        `stale declaration standing in for a shape the predicate no longer accepts`,
    );
  }
});

test("NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control", () => {
  // Without this, the mechanism above could be satisfied by a witness that
  // returned true for everything. Declaring the ordinary indexed copy loop as
  // the interior control for the zero-page-vector shape is the exact mistake
  // CR-04 describes, and the witness must reject it.
  assert.equal(
    reachesGateInterior(ORDINARY_INDEXED_COPY, ORDINARY_ORIGIN, "zeropage-vector-jumped-through"),
    false,
    "the ordinary indexed copy loop carries no zero-page store at all, so it cannot be the zero-page-vector shape's interior control",
  );
  assert.equal(
    reachesGateInterior(payloadOf(FP_INDEXED), loadFixture(FP_INDEXED).store.origin, "zeropage-vector-jumped-through"),
    false,
    "fp1's committed payload carries no zero-page store either",
  );
  // And the positive direction, so the witness is not a machine that returns
  // false for everything.
  assert.equal(
    reachesGateInterior(payloadOf(FP2_INTERIOR), loadFixture(FP2_INTERIOR).store.origin, "zeropage-vector-jumped-through"),
    true,
    "the interior control must be recognised as interior, or the witness declines everything and proves nothing",
  );

  // The same non-vacuity statement for the class-4 route into
  // `stack-return-push-idiom` added in 19-11. The window predicate is
  // register-agnostic, so it must accept the mismatched-register control --
  // otherwise that control would sit OUTSIDE the very predicate it constrains
  // -- and it must still decline a payload with no push idiom at all.
  assert.equal(
    reachesGateInterior(ORDINARY_INDEXED_COPY, ORDINARY_ORIGIN, "stack-return-push-idiom"),
    false,
    "the ordinary indexed copy loop carries no `pha` byte anywhere, so it cannot be the push idiom's interior control either",
  );
  assert.equal(
    reachesGateInterior(STACK_RETURN_MIXED_REGISTERS, DISPATCH_ORIGIN, "stack-return-push-idiom"),
    true,
    "the mismatched-register control must be recognised as INTERIOR to the class-4 window. If the witness required the register match here, the " +
      "control would be outside the predicate it constrains -- an outside-bracketing control wearing an interior label, which is CR-04's exact defect",
  );
});

test("minting a dispatch shape id without an interior predicate THROWS, naming the id", () => {
  const bogus = "shape-nobody-wrote-a-predicate-for";
  assert.throws(
    () => reachesGateInterior(ORDINARY_INDEXED_COPY, ORDINARY_ORIGIN, bogus),
    (err: unknown) => err instanceof Error && err.message.includes(bogus),
    `reachesGateInterior() must THROW for a shape id it has no predicate for, with the id in the message. Returning a bare ` +
      `boolean would let the shape-coverage test pass vacuously for any newly minted id.`,
  );
});

test("the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source", () => {
  // Without this assertion DISPATCH_CONTEXT_SHAPES is a hand-maintained mirror
  // with no link to what it mirrors: a future author who adds a fourth
  // sufficient branch to the predicate and does not touch the array leaves the
  // suite fully green -- the root cause displaced one level up rather than
  // removed. Same source-text idiom as the read-only-by-construction assertion
  // in section 11 over this same module, and the same enumerated-site
  // discipline as `r2000-spawn-seam.test.ts`'s spawn-site set: derive the real
  // number from the source, then assert set/count equality against the frozen
  // declaration.
  const source = readFileSync(join(HERE, "r2000-coverage.ts"), "utf8");
  const signature = "function hasDispatchContext(";
  const sigIdx = source.indexOf(signature);
  assert.ok(sigIdx !== -1, "hasDispatchContext() was renamed or removed -- this assertion would otherwise pass vacuously");

  const openIdx = source.indexOf("{", sigIdx);
  assert.ok(openIdx !== -1, "hasDispatchContext()'s body brace was not found");
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  assert.ok(closeIdx !== -1, "hasDispatchContext()'s body was not brace-balanced");

  const body = source.slice(openIdx + 1, closeIdx);
  const trueReturns = body.match(/\breturn\s+true\b/g) ?? [];
  assert.ok(trueReturns.length > 0, "no true-returning site was found in hasDispatchContext()'s body -- the extraction regressed");
  assert.equal(
    trueReturns.length,
    DISPATCH_CONTEXT_SHAPES.length,
    `hasDispatchContext() has ${trueReturns.length} true-returning site(s) but DISPATCH_CONTEXT_SHAPES declares ` +
      `${DISPATCH_CONTEXT_SHAPES.length} shape(s): a sufficient branch was added to the predicate without a matching declared ` +
      `shape (or a shape was declared with no branch behind it). Every sufficient branch is a decision to treat something as ` +
      `proof of code and owes the suite an interior control -- see CR-04.`,
  );
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
