#!/usr/bin/env node
// dxa-proof01-compare.ts
//
// Phase 38, plan 38-01 (PROOF-01, D-02): this module is precisely the caller
// `dxa-partition.ts`'s own header anticipates ("a rate comparing the two is
// always computed by a caller that names both, never folded together here",
// T-35-13) -- the ONE place that joins dxa's own claim about a listing
// (`dxa-listing.ts`'s `DumpListingMap`) against an independent ground truth
// (`dxa-partition.ts`'s `ByteDerivedPartition`). It exists because PROOF-01
// needs dxa's own claim measured against something that never saw dxa's
// output, and neither `dxa-listing.ts` nor `dxa-partition.ts` is allowed to be
// that caller (each names, in its own header, that it never imports the
// other).
//
// THE LOAD-BEARING FACT THIS MODULE MUST STATE, NOT COMPUTE AROUND
// (`dxa-partition.ts:463-467`, quoted verbatim):
//
//   "The byte-derived ground-truth partition. `certainCode` is ALWAYS empty
//   (A-09: this tier decides exactly two facts, and neither is ever code) --
//   it exists as a field purely so the denominator discipline (`certainCode
//   .size + certainData.size`, never the image size) reads identically to
//   the source-derived tier's."
//
// Because `certainCode` is always empty on a real release with no source, a
// "false positive" (dxa says data, ground truth says code) is definitionally
// uncomputable against this tier -- there is no denominator to test against.
// `PROOF01_FALSE_POSITIVES_REFUSAL` is the one string this module ever prints
// for that line, UNCONDITIONALLY, for every input -- never a bare `0`, which
// would misrepresent an absence of evidence (no known-code denominator) as a
// positive finding (D-03).
//
// NO EXECUTION ORACLE ANYWHERE IN THIS MODULE. No VICE observation, no chip
// state, no filesystem read, no process spawn. This module takes a
// `DumpListingMap` and a `ByteDerivedPartition` as plain data the caller
// ALREADY fetched (via `runDxaDisassemble()` and `partitionByteDerived()`
// respectively) and does nothing but join them -- it never spawns dxa itself,
// never reads a corpus byte, and never spawns a child process of any kind
// (SEAM-05's discipline, mirrored here even more strictly than
// `dxa-partition.ts` itself, which DOES read files for its own CLI -- this
// module's CLI mode below deliberately does not, so its source can be
// asserted filesystem-and-process-free by a structural test, not merely a
// documented intent).
//
// EVERY RATE CARRIES ITS NUMERATOR, DENOMINATOR AND POSITIVE CLASS, imported
// from `dxa-partition.ts`'s own `formatPercent()` -- never a local rounding
// helper. A zero denominator refuses by name, exactly like
// `renderByteDerivedReport()`'s own stated-refusal pattern, rather than
// printing `0.00`, `NaN` or `100.00`.
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";

import { formatPercent, type ByteDerivedPartition } from "./dxa-partition.ts";
import type { DumpListingMap } from "./dxa-listing.ts";

/** The one exact string this module ever prints for `PROOF01_FALSE_POSITIVES`,
 * regardless of input -- never a bare integer. Naming `certainCode.size` (not
 * a specific number) keeps the string itself independent of any one run's
 * counts, since the reason is structural (the tier's own design, D-03),
 * never a fact about this particular release. */
export const PROOF01_FALSE_POSITIVES_REFUSAL =
  "structurally-uncomputable (certainCode.size is 0 on the byte-derived tier -- see dxa-partition.ts:463-467)";

/** Plain data the caller already fetched -- this module never fetches either
 * side itself. `listing` is `runDxaDisassemble()`'s own result map; `groundTruth`
 * is `partitionByteDerived()`'s own result. Neither is re-derived here. */
export interface Proof01ComparisonInput {
  listing: DumpListingMap;
  groundTruth: ByteDerivedPartition;
}

/** The join's result. `denominator` mirrors `dxa-partition.ts`'s own
 * denominator discipline (`certainCode.size + certainData.size`, never the
 * image size) exactly -- computed here, not copied from either input, so a
 * caller can never accidentally substitute the image size instead. Every
 * address array is sorted ascending numerically (never insertion order,
 * which would depend on `Set`/`Map` iteration order and could differ across
 * two logically-identical inputs built by different code paths). */
export interface Proof01Comparison {
  /** `groundTruth.certainCode.size + groundTruth.certainData.size`. */
  denominator: number;
  /** Count of `recoveredAddresses`. */
  recovered: number;
  /** Count of `missedAddresses`. */
  missed: number;
  /** Count of `overlapAddresses`. */
  unclassifiedOverlap: number;
  /** Every `certainData` address also present in `listing.data`. */
  recoveredAddresses: number[];
  /** Every `certainData` address present in NEITHER `listing.data` NOR
   * `listing.unclassified`. */
  missedAddresses: number[];
  /** Every `certainData` address present in `listing.unclassified` -- a
   * THIRD bucket, counted in neither `recoveredAddresses` nor
   * `missedAddresses` (an overlapping decode is not a miss and not a
   * recovery; it is a distinct, named outcome). */
  overlapAddresses: number[];
  /** Always `"data"` -- the byte-derived tier's only positive class
   * (`dxa-partition.ts`'s own `POSITIVE_CLASS: data` convention, A-08). */
  positiveClass: "data";
  /** Always `"byte-derived"` -- this comparator only ever joins against the
   * byte-derived tier (`Proof01ComparisonInput.groundTruth`'s own type). */
  tier: "byte-derived";
}

function sortAscending(addresses: Iterable<number>): number[] {
  return [...addresses].sort((a, b) => a - b);
}

/**
 * The join. For every address in `groundTruth.certainData` (the ONLY
 * ground-truth-positive class the byte-derived tier ever asserts, per its own
 * header): `recovered` when it is also in `listing.data`; `unclassifiedOverlap`
 * when it is in `listing.unclassified` instead (a THIRD bucket -- an
 * overlapping decode is neither a recovery nor a miss); `missed` otherwise.
 * `groundTruth.certainCode` never contributes any address to any bucket here
 * because it is always empty on this tier (see this module's header) -- it is
 * read only for the denominator, mirroring `dxa-partition.ts`'s own
 * discipline of always summing both fields even when one is provably zero.
 */
export function compareByteDerivedRecovery(input: Proof01ComparisonInput): Proof01Comparison {
  const { listing, groundTruth } = input;
  const denominator = groundTruth.certainCode.size + groundTruth.certainData.size;

  const recoveredAddresses: number[] = [];
  const missedAddresses: number[] = [];
  const overlapAddresses: number[] = [];
  for (const address of groundTruth.certainData) {
    if (listing.unclassified.has(address)) {
      overlapAddresses.push(address);
    } else if (listing.data.has(address)) {
      recoveredAddresses.push(address);
    } else {
      missedAddresses.push(address);
    }
  }

  const recovered = sortAscending(recoveredAddresses);
  const missed = sortAscending(missedAddresses);
  const overlap = sortAscending(overlapAddresses);

  return {
    denominator,
    recovered: recovered.length,
    missed: missed.length,
    unclassifiedOverlap: overlap.length,
    recoveredAddresses: recovered,
    missedAddresses: missed,
    overlapAddresses: overlap,
    positiveClass: "data",
    tier: "byte-derived",
  };
}

/** The two counts `renderProof01Report()` needs that live on the DXA side of
 * the join rather than on `Proof01Comparison` itself (which is entirely
 * ground-truth-side) -- kept as a separate, minimal argument rather than
 * folded into `Proof01Comparison` so that type stays exactly what the join
 * computed, nothing more. */
export interface Proof01ReportMeta {
  /** `listing.code.size` -- dxa's own total classified-code address count,
   * over the WHOLE image, not scoped to the ground-truth window. */
  dxaCodeAddresses: number;
  /** `listing.data.size` -- dxa's own total classified-data address count. */
  dxaDataAddresses: number;
}

/**
 * Renders the outcome-line block, in this FIXED order, always:
 * `PROOF01_GROUND_TRUTH_TIER`, `PROOF01_POSITIVE_CLASS`,
 * `PROOF01_DATA_RECOVERY_PCT`, `PROOF01_FALSE_POSITIVES`,
 * `PROOF01_UNCLASSIFIED_OVERLAP`, `PROOF01_DXA_CODE_ADDRESSES`,
 * `PROOF01_DXA_DATA_ADDRESSES`. Byte-identical across two calls with
 * identical inputs -- no timestamp, no randomness, no reliance on `Set`/`Map`
 * iteration order (every count here is a plain number).
 *
 * `PROOF01_DATA_RECOVERY_PCT` goes through `formatPercent()` -- imported, not
 * reimplemented -- and states a named refusal, naming the zero denominator,
 * when `comparison.denominator` is `0`; it never prints `0.00`, `NaN` or
 * `100.00` in that case.
 *
 * `PROOF01_FALSE_POSITIVES` is `PROOF01_FALSE_POSITIVES_REFUSAL`
 * UNCONDITIONALLY, for every input -- including inputs where dxa classified
 * addresses as code, since the refusal is about the ground-truth tier's own
 * design (no known-code denominator exists on it AT ALL), never about what
 * dxa happened to report this run.
 */
export function renderProof01Report(comparison: Proof01Comparison, meta: Proof01ReportMeta): string {
  const lines: string[] = [];
  lines.push(`PROOF01_GROUND_TRUTH_TIER: ${comparison.tier}`);
  lines.push(`PROOF01_POSITIVE_CLASS: ${comparison.positiveClass}`);
  if (comparison.denominator === 0) {
    lines.push(
      "PROOF01_DATA_RECOVERY_PCT: refused -- denominator is 0 (no certain-data bytes on the ground-truth tier)",
    );
  } else {
    lines.push(`PROOF01_DATA_RECOVERY_PCT: ${formatPercent(comparison.recovered, comparison.denominator)}`);
  }
  lines.push(`PROOF01_FALSE_POSITIVES: ${PROOF01_FALSE_POSITIVES_REFUSAL}`);
  lines.push(`PROOF01_UNCLASSIFIED_OVERLAP: ${comparison.unclassifiedOverlap}`);
  lines.push(`PROOF01_DXA_CODE_ADDRESSES: ${meta.dxaCodeAddresses}`);
  lines.push(`PROOF01_DXA_DATA_ADDRESSES: ${meta.dxaDataAddresses}`);
  return lines.join("\n");
}

// ============================================================================
// CLI entry point
// ============================================================================
//
// This module reads no file and spawns no process (see header) -- there is no
// real file path or corpus argument for a CLI mode to accept. `main()` below
// exists only so the module is directly runnable and demonstrates the join
// over a small, self-contained, hand-built example; every REAL measurement in
// this phase is taken by `evidence/proof01-dxa-real-release.mjs`, which
// supplies real `DumpListingMap`/`ByteDerivedPartition` values obtained
// through the shipped seams (`runDxaDisassemble()`, `partitionByteDerived()`)
// and calls `compareByteDerivedRecovery()`/`renderProof01Report()` directly.

function demoInput(): Proof01ComparisonInput {
  // A tiny, entirely synthetic example: three certain-data addresses, of
  // which dxa's own listing recovers two as data and reports the third as an
  // overlapping (unclassified) decode -- exercising all three buckets in one
  // small demonstration.
  const groundTruth: ByteDerivedPartition = {
    origin: 0x0801,
    bodyLength: 3,
    headerBytes: 2,
    certainCode: new Set<number>(),
    certainData: new Set<number>([0x0801, 0x0802, 0x0803]),
    unknown: new Set<number>(),
    ranges: [],
    stubAttempted: true,
    stubOutcome: "demonstration only -- not a real BASIC-stub walk",
  };
  const listing: DumpListingMap = {
    code: new Set<number>(),
    data: new Set<number>([0x0801, 0x0802]),
    unclassified: new Map([
      [
        0x0803,
        {
          address: 0x0803,
          claims: [
            { raw: "0803 ab              lda #$ab", class: "code" },
            { raw: "0803 ab              .byt $ab", class: "data" },
          ],
          reason: "two matched lines both claim 0x0803 (demonstration only)",
        },
      ],
    ]),
    covered: new Set<number>([0x0801, 0x0802, 0x0803]),
    codeBytes: 0,
    dataBytes: 2,
    matchedLines: 2,
    outOfWindow: [],
    lines: [],
    firstAddress: 0x0801,
    lastAddress: 0x0803,
    ranges: [],
  };
  return { listing, groundTruth };
}

function main(_argv: string[]): void {
  const input = demoInput();
  const comparison = compareByteDerivedRecovery(input);
  const report = renderProof01Report(comparison, {
    dxaCodeAddresses: input.listing.code.size,
    dxaDataAddresses: input.listing.data.size,
  });
  process.stdout.write(report + "\n");
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
