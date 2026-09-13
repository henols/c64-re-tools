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

import type { HazardFinding, HazardRegionDisposition, HazardReport } from "./anno-hazard-report.ts";
import {
  hazardFindingKey,
  matchHazardAcknowledgements,
  disposeHazardReport,
  renderAcknowledgementLines,
  type HazardAcknowledgement,
  type UndecidedRegionAcknowledgement,
} from "./reassembly-gate-ack.ts";

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
