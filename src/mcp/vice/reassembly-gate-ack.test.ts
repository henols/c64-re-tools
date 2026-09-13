// reassembly-gate-ack.test.ts
//
// WHY THIS FILE EXISTS: `reassembly-gate-ack.ts` refuses to let a non-clean
// hazard report reach the gate's green outcome. That refusal is worthless
// unless every one of its own rules is actually exercised: the three-part
// key, the exactly-one matching (with zero-match and multi-match reported
// separately, never merged), the disposition rule's own ordering, and the
// deterministic rendering the verdict artifact reads.
//
// TWO KINDS OF CASES. Task 1's eleven `gate hazard:` cases (below) need no
// assembler and no store at all -- they drive `matchHazardAcknowledgements()`
// and `disposeHazardReport()` directly against hand-built `HazardFinding` and
// `HazardRegionDisposition` literals shaped like `anno-hazard-report.ts`'s
// own real output. A later commit in this same file adds Task 2's five
// cases: a REAL hazard report over the committed hazard-subject fixture, and
// an exhaustive enumeration of the gate's own seven-input token space.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildHazardReport, type HazardFinding, type HazardRegionDisposition, type HazardReport } from "./anno-hazard-report.ts";
import type { BlockEntry } from "./block-class.ts";
import type { StoreExportDocument } from "./anno-store-export.ts";
import {
  hazardFindingKey,
  matchHazardAcknowledgements,
  disposeHazardReport,
  renderAcknowledgementLines,
  type HazardAcknowledgement,
  type UndecidedRegionAcknowledgement,
} from "./reassembly-gate-ack.ts";
import {
  runReassemblyGate,
  HAZARD_DISPOSITIONS,
  DIFF_SCOPE_COVERAGES,
  RED_CONTROLS_OBSERVATIONS,
  GUARD_OBSERVATIONS,
  type GateInput,
} from "./reassembly-gate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Shared fixture builders -- realistic shapes (real hazard classes, real
// mechanism strings this codebase's own detectors emit), never bare stubs of
// the type.
// ---------------------------------------------------------------------------

function emptyReport(): HazardReport {
  return {
    findings: [],
    regions: [],
    limits: [],
    denominator: 0,
    classesEvaluated: [],
    unprovenDispatchCandidates: [],
    truncated: false,
  };
}

function sampleFinding(overrides: Partial<HazardFinding> = {}): HazardFinding {
  return {
    hazardClass: "self-modifying-code",
    anchorAddress: 0x0825,
    blockedAddress: 0x0825,
    mechanism: "store-target-in-instruction-opcode-byte",
    strength: "static-shape-matched",
    detail: "this write changes which instruction runs at the target address on a later pass.",
    corroboration: "none",
    ...overrides,
  };
}

function sampleUndecidedRegion(overrides: Partial<HazardRegionDisposition> = {}): HazardRegionDisposition {
  return {
    start: 0x0900,
    endInclusive: 0x09ff,
    outcome: "unclassified",
    reason: "the VIC-II register recovery for this combination is incomplete.",
    ...overrides,
  };
}

function ackFor(finding: HazardFinding, reason: string): HazardAcknowledgement {
  return { hazardClass: finding.hazardClass, anchorAddress: finding.anchorAddress, mechanism: finding.mechanism, reason };
}

function regionAckFor(region: HazardRegionDisposition, reason: string): UndecidedRegionAcknowledgement {
  return { start: region.start, endInclusive: region.endInclusive, reason };
}

// ---------------------------------------------------------------------------
// gate hazard: the three-part key
// ---------------------------------------------------------------------------

test("gate hazard: the finding key is built from the class, the anchor address and the mechanism, and two findings differing only in mechanism produce different keys", () => {
  const keyA = hazardFindingKey("self-modifying-code", 0x0825, "store-target-in-instruction-opcode-byte");
  const keyB = hazardFindingKey("self-modifying-code", 0x0825, "store-target-in-instruction-operand-byte");
  assert.notEqual(keyA, keyB, "two findings differing only in mechanism must produce different keys");

  const keyC = hazardFindingKey("self-modifying-code", 0x0825, "store-target-in-instruction-opcode-byte");
  assert.equal(keyA, keyC, "the same class/address/mechanism triple must produce the identical key");
});

// ---------------------------------------------------------------------------
// gate hazard: clean / blocked over an otherwise-empty report
// ---------------------------------------------------------------------------

test("gate hazard: a report with zero findings, zero undecided regions and no acknowledgements disposes clean", () => {
  const result = disposeHazardReport(emptyReport(), [], []);
  assert.equal(result.disposition, "clean", result.reason);
});

test("gate hazard: that same report with one acknowledgement supplied disposes blocked, and the reason names the acknowledgement that matched nothing", () => {
  const finding = sampleFinding();
  const ack = ackFor(finding, "operator accepted this movement constraint");
  const result = disposeHazardReport(emptyReport(), [ack], []);
  assert.equal(result.disposition, "blocked");
  assert.ok(
    result.reason.includes(hazardFindingKey(ack.hazardClass, ack.anchorAddress, ack.mechanism)),
    `reason must name the acknowledgement that matched nothing: ${result.reason}`,
  );
});

// ---------------------------------------------------------------------------
// gate hazard: an undecided region alone
// ---------------------------------------------------------------------------

test("gate hazard: a report with zero findings and one undecided region does not dispose clean; with that region acknowledged it disposes acknowledged, and without disposes blocked", () => {
  const region = sampleUndecidedRegion();
  const report: HazardReport = { ...emptyReport(), regions: [region] };

  const withoutAck = disposeHazardReport(report, [], []);
  assert.notEqual(withoutAck.disposition, "clean", withoutAck.reason);
  assert.equal(withoutAck.disposition, "blocked", withoutAck.reason);

  const withAck = disposeHazardReport(report, [], [regionAckFor(region, "operator accepted -- recovery gap documented separately")]);
  assert.equal(withAck.disposition, "acknowledged", withAck.reason);
});

// ---------------------------------------------------------------------------
// gate hazard: a fully acknowledged report
// ---------------------------------------------------------------------------

test("gate hazard: a report whose every finding and every undecided region is matched by exactly one acknowledgement carrying a non-empty reason disposes acknowledged", () => {
  const findingA = sampleFinding();
  const findingB = sampleFinding({
    hazardClass: "cycle-exact-raster",
    anchorAddress: 0x1000,
    mechanism: "timer-reload-in-vectored-handler",
    strength: "static-signature-only",
    blockedAddress: null,
  });
  const region = sampleUndecidedRegion();
  const report: HazardReport = { ...emptyReport(), findings: [findingA, findingB], regions: [region] };

  const result = disposeHazardReport(
    report,
    [ackFor(findingA, "reason A"), ackFor(findingB, "reason B")],
    [regionAckFor(region, "reason C")],
  );
  assert.equal(result.disposition, "acknowledged", result.reason);
});

// ---------------------------------------------------------------------------
// gate hazard: one finding left unacknowledged
// ---------------------------------------------------------------------------

test("gate hazard: one finding left unacknowledged disposes blocked, and the reason names that finding's key", () => {
  const findingA = sampleFinding();
  const findingB = sampleFinding({
    hazardClass: "cycle-exact-raster",
    anchorAddress: 0x1000,
    mechanism: "timer-reload-in-vectored-handler",
    blockedAddress: null,
  });
  const report: HazardReport = { ...emptyReport(), findings: [findingA, findingB] };

  const result = disposeHazardReport(report, [ackFor(findingA, "reason A")], []);
  assert.equal(result.disposition, "blocked");
  assert.ok(
    result.reason.includes(hazardFindingKey(findingB.hazardClass, findingB.anchorAddress, findingB.mechanism)),
    `reason must name the unacknowledged finding's key: ${result.reason}`,
  );
});

// ---------------------------------------------------------------------------
// gate hazard: zero-match acknowledgement, distinct from an unacknowledged finding
// ---------------------------------------------------------------------------

test("gate hazard: an acknowledgement whose key matches no finding disposes blocked and is reported as a zero-match, distinct from an unacknowledged finding", () => {
  const finding = sampleFinding();
  const report: HazardReport = { ...emptyReport(), findings: [finding] };
  const wrongAck: HazardAcknowledgement = {
    hazardClass: finding.hazardClass,
    anchorAddress: finding.anchorAddress,
    mechanism: "a-mechanism-this-finding-does-not-carry",
    reason: "reason",
  };

  const matchResult = matchHazardAcknowledgements(report.findings, report.regions, [wrongAck], []);
  assert.equal(matchResult.zeroMatchAcknowledgements.length, 1);
  assert.equal(matchResult.zeroMatchAcknowledgements[0], wrongAck);
  assert.equal(matchResult.unacknowledgedFindings.length, 1, "the real finding is ALSO unacknowledged -- a distinct fact from the zero-match acknowledgement");
  assert.equal(matchResult.unacknowledgedFindings[0], finding);

  const disposal = disposeHazardReport(report, [wrongAck], []);
  assert.equal(disposal.disposition, "blocked");
});

// ---------------------------------------------------------------------------
// gate hazard: duplicate acknowledgement keys refused
// ---------------------------------------------------------------------------

test("gate hazard: two acknowledgements carrying the same key are refused by name before matching runs", () => {
  const finding = sampleFinding();
  const dup1 = ackFor(finding, "reason 1");
  const dup2 = ackFor(finding, "reason 2");
  assert.throws(
    () => matchHazardAcknowledgements([finding], [], [dup1, dup2], []),
    /matchHazardAcknowledgements: duplicate acknowledgement key/,
  );
});

// ---------------------------------------------------------------------------
// gate hazard: empty or whitespace-only reason
// ---------------------------------------------------------------------------

test("gate hazard: an acknowledgement carrying an empty or whitespace-only reason disposes blocked, and the reason names the offending key", () => {
  const finding = sampleFinding();
  const report: HazardReport = { ...emptyReport(), findings: [finding] };
  const blankAck = ackFor(finding, "   ");
  const result = disposeHazardReport(report, [blankAck], []);
  assert.equal(result.disposition, "blocked");
  assert.ok(
    result.reason.includes(hazardFindingKey(finding.hazardClass, finding.anchorAddress, finding.mechanism)),
    `reason must name the offending key: ${result.reason}`,
  );
});

// ---------------------------------------------------------------------------
// gate hazard: order-independence
// ---------------------------------------------------------------------------

test("gate hazard: shuffling the findings array produces a match result that compares deeply equal to the unshuffled one", () => {
  const f1 = sampleFinding();
  const f2 = sampleFinding({ hazardClass: "cycle-exact-raster", anchorAddress: 0x1000, mechanism: "timer-reload-in-vectored-handler", blockedAddress: null });
  const f3 = sampleFinding({ hazardClass: "indexed-dispatch", anchorAddress: 0x0810, mechanism: "stack-return-dispatch", blockedAddress: 0x0820 });
  const acks = [ackFor(f1, "r1"), ackFor(f3, "r3")];

  const unshuffled = matchHazardAcknowledgements([f1, f2, f3], [], acks, []);
  const shuffled = matchHazardAcknowledgements([f3, f1, f2], [], acks, []);
  assert.deepEqual(shuffled, unshuffled);
});

// ---------------------------------------------------------------------------
// gate hazard: deterministic rendering order
// ---------------------------------------------------------------------------

test("gate hazard: the rendered acknowledgement lines are ordered by class, then anchor address, then mechanism, and two calls over the same report produce identical text", () => {
  const fSelfMod = sampleFinding({ anchorAddress: 0x0900 });
  const fDispatch = sampleFinding({ hazardClass: "indexed-dispatch", anchorAddress: 0x0800, mechanism: "stack-return-dispatch", blockedAddress: 0x0810 });
  const acks = [ackFor(fSelfMod, "r-selfmod"), ackFor(fDispatch, "r-dispatch")];

  const match = matchHazardAcknowledgements([fSelfMod, fDispatch], [], acks, []);
  const lines1 = renderAcknowledgementLines(match.matched);
  const lines2 = renderAcknowledgementLines(match.matched);
  assert.deepEqual(lines1, lines2);

  // indexed-dispatch precedes self-modifying-code in HAZARD_CLASSES's own order.
  assert.ok(lines1[0]!.startsWith("indexed-dispatch"), lines1[0]);
  assert.ok(lines1[1]!.startsWith("self-modifying-code"), lines1[1]);
});

// ---------------------------------------------------------------------------
// The real report, the exhaustive no-silent-green check, and the gate wiring.
//
// Fixture loading -- the SAME shapes `reassembly-gate.test.ts`'s own
// `exportSubjectTree()` and `anno-hazard-report.test.ts`'s own `loadPrg()`
// already use, reused here rather than re-derived. Duplicated (never
// imported across test files, which is deliberate: neither ships) on the
// same terms this codebase's other cross-file fixture-loading duplications
// already carry.
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(HERE, "fixtures", "hazard-subject");
const PRG_PATH = join(FIXTURE_DIR, "hazard-subject.prg");
const ANNOSTORE_PATH = join(FIXTURE_DIR, "hazard-subject.annostore.json");

/** A committed `.prg`'s bytes and load address -- the first two bytes are
 * the little-endian load address, never passed to `buildHazardReport()` as
 * part of the payload. */
function loadPrg(path: string): { bytes: Uint8Array; origin: number } {
  const raw = readFileSync(path);
  const origin = raw[0]! | (raw[1]! << 8);
  return { bytes: new Uint8Array(raw.subarray(2)), origin };
}

/** The committed store export's own ranges, converted to `BlockEntry`'s
 * shape (`start_address`/`end_address`/`type`) -- the shape
 * `buildHazardReport()`'s own `ranges` field accepts, which is NOT the same
 * shape `anno-store-export.ts`'s own `StoreExportRangeRow` uses
 * (`start`/`endInclusive`/`dataType`). This is the one place in this file
 * that bridges the two. */
function loadCommittedSubjectRanges(): BlockEntry[] {
  const doc = JSON.parse(readFileSync(ANNOSTORE_PATH, "utf8")) as StoreExportDocument;
  return doc.ranges.map((range) => ({ start_address: range.start, end_address: range.endInclusive, type: range.dataType }));
}

/** The real hazard report over the committed hazard-subject fixture: its
 * committed program image supplies the bytes, its committed store export
 * supplies the ranges. */
function realSubjectReport(): HazardReport {
  const { bytes, origin } = loadPrg(PRG_PATH);
  const ranges = loadCommittedSubjectRanges();
  return buildHazardReport({ bytes, origin, ranges });
}

/** Builds a complete acknowledgement set covering every one of `report`'s
 * own findings and undecided regions, each with its own distinct reason. */
function acknowledgeEveryFindingAndRegion(report: HazardReport): { acks: HazardAcknowledgement[]; regionAcks: UndecidedRegionAcknowledgement[] } {
  const acks = report.findings.map((finding, index) => ackFor(finding, `accepted for movement -- test reason ${index}`));
  const regionAcks = report.regions
    .filter((region) => region.outcome === "unclassified")
    .map((region, index) => regionAckFor(region, `accepted undecided region -- test reason ${index}`));
  return { acks, regionAcks };
}

/** Every gate input at its passing value except HAZARD_DISPOSITION, which a
 * caller overrides. Mirrors `reassembly-gate.test.ts`'s own `passingInput()`
 * -- duplicated here rather than imported, on the same fixture-duplication
 * terms as the loaders above. */
function passingGateInputExceptHazard(hazardDisposition: GateInput["HAZARD_DISPOSITION"]): GateInput {
  return {
    TREE_REBUILD: "ok",
    MOVEMENT_REBUILD: "ok",
    HAZARD_DISPOSITION: hazardDisposition,
    DIFF_SCOPE_COVERAGE: "complete",
    RED_CONTROLS: "all-observed",
    SECOND_PATH_GUARD: "held",
    ORDERING_PROOF: "held",
  };
}

test("gate hazard: the real report over the committed subject is genuinely non-clean, carrying at least one finding -- the precondition every case below rests on", () => {
  const report = realSubjectReport();
  assert.ok(
    report.findings.length > 0,
    `if the committed subject's report were clean, every disposition case below would pass vacuously; got zero findings: ${JSON.stringify(report.findings)}`,
  );
});

test("gate hazard: a complete acknowledgement set over the real report yields the acknowledged disposition and an acknowledged gate verdict -- never green", () => {
  const report = realSubjectReport();
  const { acks, regionAcks } = acknowledgeEveryFindingAndRegion(report);
  const disposal = disposeHazardReport(report, acks, regionAcks);
  assert.equal(disposal.disposition, "acknowledged", disposal.reason);

  const verdict = runReassemblyGate(passingGateInputExceptHazard(disposal.disposition));
  assert.equal(verdict.outcome, "acknowledged", verdict.reason);
  assert.equal(verdict.rule, "R10");
});

test("gate hazard: removing one acknowledgement from the real report's complete set yields blocked and a red gate verdict under the blocked-hazard rule", () => {
  const report = realSubjectReport();
  const { acks, regionAcks } = acknowledgeEveryFindingAndRegion(report);
  assert.ok(acks.length > 0, "precondition: the real report must carry at least one finding acknowledgement to remove");
  const reduced = acks.slice(1);

  const disposal = disposeHazardReport(report, reduced, regionAcks);
  assert.equal(disposal.disposition, "blocked", disposal.reason);

  const verdict = runReassemblyGate(passingGateInputExceptHazard(disposal.disposition));
  assert.equal(verdict.outcome, "red", verdict.reason);
  assert.equal(verdict.rule, "R9");
});

// The exhaustive enumeration drives `runReassemblyGate()` directly over
// EVERY declared token of all seven `GateInput` fields. None of the seven
// fields is anything other than a bare token by its own type declaration
// (`TREE_REBUILD: RebuildOutcome`, `MOVEMENT_REBUILD: MovementOutcome`, and
// so on) -- `runReassemblyGate()` never reads a richer producer object
// (an `AcmeOutcome` verdict with its own byte-diff, a `MovementResult`, a
// `HazardAcknowledgementResult`), only the resolved token each producer's
// own derivation function reduces its result to. Enumerating the seven bare
// token domains directly is therefore already exhaustive over everything
// this gate function itself reads.
const TREE_REBUILD_TOKENS = ["ok", "failed", "skipped"] as const;
const MOVEMENT_REBUILD_TOKENS = ["ok", "failed", "skipped", "refused"] as const;

test("gate hazard: the exhaustive enumeration of the seven gate inputs' declared token sets never returns green for a non-clean hazard disposition, and at least one combination does return green", () => {
  let total = 0;
  let sawGreen = false;

  for (const TREE_REBUILD of TREE_REBUILD_TOKENS) {
    for (const MOVEMENT_REBUILD of MOVEMENT_REBUILD_TOKENS) {
      for (const HAZARD_DISPOSITION of HAZARD_DISPOSITIONS) {
        for (const DIFF_SCOPE_COVERAGE of DIFF_SCOPE_COVERAGES) {
          for (const RED_CONTROLS of RED_CONTROLS_OBSERVATIONS) {
            for (const SECOND_PATH_GUARD of GUARD_OBSERVATIONS) {
              for (const ORDERING_PROOF of GUARD_OBSERVATIONS) {
                total++;
                const input: GateInput = {
                  TREE_REBUILD,
                  MOVEMENT_REBUILD,
                  HAZARD_DISPOSITION,
                  DIFF_SCOPE_COVERAGE,
                  RED_CONTROLS,
                  SECOND_PATH_GUARD,
                  ORDERING_PROOF,
                };
                const verdict = runReassemblyGate(input);
                if (verdict.outcome === "green") {
                  sawGreen = true;
                  assert.equal(
                    HAZARD_DISPOSITION,
                    "clean",
                    `a green verdict must never occur with a non-clean hazard disposition: ${JSON.stringify(input)}`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  assert.ok(total > 0, "the enumeration must be non-empty");
  assert.ok(sawGreen, "at least one combination must return green, or the check above would pass by the gate rejecting everything");
});

test("gate hazard: rendering the real report's acknowledgement lines twice produces deeply equal arrays, each line carrying a hex anchor address and a non-empty reason", () => {
  const report = realSubjectReport();
  const { acks, regionAcks } = acknowledgeEveryFindingAndRegion(report);
  const match = matchHazardAcknowledgements(report.findings, report.regions, acks, regionAcks);

  const lines1 = renderAcknowledgementLines(match.matched);
  const lines2 = renderAcknowledgementLines(match.matched);
  assert.deepEqual(lines1, lines2);
  assert.ok(lines1.length > 0, "the real report's acknowledgement lines must not be empty");
  for (const line of lines1) {
    assert.match(line, /\$[0-9A-F]{4}/, `each line must carry the anchor address in hex: ${line}`);
    assert.ok(!/:\s*$/.test(line), `each line must carry a non-empty reason: ${line}`);
  }
});
