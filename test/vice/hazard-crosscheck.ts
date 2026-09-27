// hazard-crosscheck.ts
//
// WHY THIS FILE EXISTS: the test-side comparator that measures the hazard
// detectors in anno-hazard-report.mts against fixtures this project did not
// author. An expectation goes in, and a denominator, three counts and three
// sorted address arrays come out.
//
// WHAT NOT TO DO:
//   - Never derive an expectation from a detector run. A person reads it from
//     the fixture's own source or bytes before this runs, and it is never
//     edited to make a disagreeing row agree.
//   - Never add a score, a rate or a percentage to the result.
import type { HazardClass, HazardReport } from "../../src/mcp/vice/anno-hazard-report.mts";

function sortAscendingNumbers(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * One committed fixture's declared expectation for one hazard class --
 * ground truth this phase did NOT derive from any detector run.
 * `expectedAddresses` is populated only for `kind: "positive"`; empty for
 * the other two kinds. `kind` distinguishes three cases:
 *   - `positive`: an independently-sourced fixture genuinely carries this
 *     class, at exactly the named addresses.
 *   - `negative`: the fixture carries none of this class -- any reported
 *     address of this class on it is a false positive.
 *   - `no-example`: this phase has no independently-sourced positive
 *     fixture for this class at all. The comparator returns a marker for
 *     this row, not a measurement -- see `crossCheckHazardFixture()`.
 */
export interface HazardCrossCheckExpectation {
  fixture: string;
  hazardClass: HazardClass;
  kind: "positive" | "negative" | "no-example";
  expectedAddresses: readonly number[];
}

/**
 * The comparator's answer for one fixture, one class. An explicit
 * denominator, three counts, three sorted-ascending address arrays, and a
 * named positive class.
 * There is no boolean, no score, no rate and no percentage anywhere in this
 * type, and the comparator computes none at any point.
 *
 * For a `no-example` expectation, every count and the denominator are zero
 * and every address array is empty: a MEASUREMENT of "nothing to measure",
 * never silently absent -- the same distinction `HazardRegionOutcome`'s own
 * three-way split preserves one layer up.
 */
export interface HazardCrossCheckResult {
  fixture: string;
  hazardClass: HazardClass;
  kind: "positive" | "negative" | "no-example";
  /** Always equal to `hazardClass`: the class this row measures, named as
   * its own field rather than requiring a reader to infer it from
   * `hazardClass` alone. */
  positiveClass: HazardClass;
  /** `expectedAddresses.length` for a `positive` row, `0` for the other two
   * kinds. Never the image size and never a count copied from the report. */
  denominator: number;
  detected: number;
  missed: number;
  falsePositive: number;
  detectedAddresses: number[];
  missedAddresses: number[];
  falsePositiveAddresses: number[];
}

/**
 * Joins one already-built report against one declared expectation for one
 * fixture, one hazard class. See this module.s header for why the
 * expectation itself is never edited to match what this function returns.
 *
 * The join is a three-way branch:
 * walk the expected addresses first, partitioning into
 * detected and missed; then walk the reported addresses of this class,
 * adding any the expectation did not name to false-positive.
 */
export function crossCheckHazardFixture(report: HazardReport, expectation: HazardCrossCheckExpectation): HazardCrossCheckResult {
  const { fixture, hazardClass, kind, expectedAddresses } = expectation;

  if (kind === "no-example") {
    return {
      fixture,
      hazardClass,
      kind,
      positiveClass: hazardClass,
      denominator: 0,
      detected: 0,
      missed: 0,
      falsePositive: 0,
      detectedAddresses: [],
      missedAddresses: [],
      falsePositiveAddresses: [],
    };
  }

  // Joined against `blockedAddress` ONLY, never `anchorAddress` too: the
  // expectation names the address that cannot move (the thing a positive
  // row's own comment derives from the fixture's bytes), and the anchor is
  // merely where the write that blocks it is issued from -- counting the
  // anchor as a second "reported address" would manufacture a false
  // positive out of every real detection whose anchor and blocked address
  // legitimately differ (an operand-byte hit, a table dispatch, a
  // register-pinned charset base). A finding with no blocked address (class
  // 4's structural signatures, an unresolved sprite-pointer target) names no
  // address at all and contributes nothing here, exactly like a `no-example`
  // expectation contributes nothing to any count.
  const reportedAddresses = new Set<number>();
  for (const finding of report.findings) {
    if (finding.hazardClass !== hazardClass) continue;
    if (finding.blockedAddress !== null) reportedAddresses.add(finding.blockedAddress);
  }

  const expectedSet = new Set(expectedAddresses);
  const detectedAddresses: number[] = [];
  const missedAddresses: number[] = [];
  for (const address of expectedSet) {
    if (reportedAddresses.has(address)) detectedAddresses.push(address);
    else missedAddresses.push(address);
  }
  const falsePositiveAddresses: number[] = [];
  for (const address of reportedAddresses) {
    if (!expectedSet.has(address)) falsePositiveAddresses.push(address);
  }

  const detected = sortAscendingNumbers(detectedAddresses);
  const missed = sortAscendingNumbers(missedAddresses);
  const falsePositive = sortAscendingNumbers(falsePositiveAddresses);

  return {
    fixture,
    hazardClass,
    kind,
    positiveClass: hazardClass,
    denominator: expectedSet.size,
    detected: detected.length,
    missed: missed.length,
    falsePositive: falsePositive.length,
    detectedAddresses: detected,
    missedAddresses: missed,
    falsePositiveAddresses: falsePositive,
  };
}

