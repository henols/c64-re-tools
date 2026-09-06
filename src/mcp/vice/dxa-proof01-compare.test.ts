#!/usr/bin/env node
// dxa-proof01-compare.test.ts
//
// Phase 38, plan 38-01 (PROOF-01, D-02). HERMETIC: no dxa, no Ghidra, no
// corpus, no network. Every `DumpListingMap`/`ByteDerivedPartition` value
// below is a synthetic object literal built by hand, exercising the six
// behaviors this plan requires (its own `<behavior>` block) directly:
//
//   1. recovery, denominator and rate on a simple 2-of-3 case
//   2. an unclassified-overlap address counts toward neither bucket
//   3. an empty certainData set refuses the rate line, never 0.00/NaN/100.00
//   4. PROOF01_FALSE_POSITIVES is unconditionally the refusal string
//   5. two identical calls render byte-identical strings, addresses sorted
//   6. a structural, source-text assertion that this module imports neither
//      Node's child-process module nor any filesystem module
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  compareByteDerivedRecovery,
  renderProof01Report,
  PROOF01_FALSE_POSITIVES_REFUSAL,
  type Proof01ComparisonInput,
} from "./dxa-proof01-compare.ts";
import type { ByteDerivedPartition } from "./dxa-partition.ts";
import type { DumpListingMap, UnclassifiedByte } from "./dxa-listing.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, "dxa-proof01-compare.ts");

/** Builds a minimal, valid `ByteDerivedPartition` for a test -- every field
 * `compareByteDerivedRecovery()` actually reads (`certainCode`, `certainData`)
 * is real; the rest are structurally-required filler values a real
 * `partitionByteDerived()` call would also produce, never load-bearing here. */
function makeGroundTruth(certainData: number[], certainCode: number[] = []): ByteDerivedPartition {
  return {
    origin: 0x0801,
    bodyLength: certainData.length + certainCode.length,
    headerBytes: 2,
    certainCode: new Set(certainCode),
    certainData: new Set(certainData),
    unknown: new Set(),
    ranges: [],
    stubAttempted: certainData.length > 0,
    stubOutcome: "test fixture -- not a real BASIC-stub walk",
  };
}

/** Builds a minimal, valid `DumpListingMap`. Every field
 * `compareByteDerivedRecovery()` actually reads (`data`, `unclassified`) is
 * real; the rest are structurally-required filler a real `runDxaDisassemble()`
 * result would also carry. */
function makeListing(opts: { data?: number[]; unclassified?: number[] } = {}): DumpListingMap {
  const data = new Set(opts.data ?? []);
  const unclassifiedEntries = new Map<number, UnclassifiedByte>();
  for (const address of opts.unclassified ?? []) {
    unclassifiedEntries.set(address, {
      address,
      claims: [
        { raw: `test line claiming 0x${address.toString(16)} as code`, class: "code" },
        { raw: `test line claiming 0x${address.toString(16)} as data`, class: "data" },
      ],
      reason: `test fixture: 0x${address.toString(16)} claimed by two lines`,
    });
  }
  return {
    code: new Set(),
    data,
    unclassified: unclassifiedEntries,
    covered: new Set([...data, ...unclassifiedEntries.keys()]),
    codeBytes: 0,
    dataBytes: data.size,
    matchedLines: data.size + unclassifiedEntries.size,
    outOfWindow: [],
    lines: [],
    firstAddress: null,
    lastAddress: null,
    ranges: [],
  };
}

// ============================================================================
// Behavior 1: 3 certain-data addresses, 2 recovered by dxa's data set
// ============================================================================

test("3 certainData addresses, 2 in dxa's data set: recovered 2, denominator 3, rate 66.67 (2/3)", () => {
  const groundTruth = makeGroundTruth([0x0801, 0x0802, 0x0803]);
  const listing = makeListing({ data: [0x0801, 0x0802] });
  const comparison = compareByteDerivedRecovery({ listing, groundTruth });

  assert.equal(comparison.recovered, 2);
  assert.equal(comparison.denominator, 3);
  assert.equal(comparison.missed, 1);
  assert.equal(comparison.unclassifiedOverlap, 0);
  assert.deepEqual(comparison.recoveredAddresses, [0x0801, 0x0802]);
  assert.deepEqual(comparison.missedAddresses, [0x0803]);
  assert.equal(comparison.positiveClass, "data");
  assert.equal(comparison.tier, "byte-derived");

  const report = renderProof01Report(comparison, { dxaCodeAddresses: 0, dxaDataAddresses: 2 });
  assert.match(report, /^PROOF01_DATA_RECOVERY_PCT: 66\.67 \(2\/3\)$/m);
});

// ============================================================================
// Behavior 1b: the denominator sums BOTH certainCode.size and certainData.size
// -- every other test in this file passes an empty certainCode, so without
// this case a regression that dropped certainCode.size from the sum would
// pass the whole suite unchanged (WR-03).
// ============================================================================

test("denominator sums certainCode.size and certainData.size, not certainData.size alone", () => {
  const groundTruth = makeGroundTruth([0x0801], [0x0900, 0x0901]);
  const listing = makeListing({ data: [0x0801] });
  const comparison = compareByteDerivedRecovery({ listing, groundTruth });
  assert.equal(comparison.denominator, 3, "denominator must include certainCode.size (2) plus certainData.size (1)");
});

// ============================================================================
// Behavior 2: a certainData address inside dxa's unclassified map counts
// toward neither recovered nor missed -- a third, named bucket
// ============================================================================

test("a certainData address in dxa's unclassified map counts toward neither recovered nor any false-positive tally", () => {
  const groundTruth = makeGroundTruth([0x0801, 0x0802, 0x0803]);
  const listing = makeListing({ data: [0x0801], unclassified: [0x0802] });
  const comparison = compareByteDerivedRecovery({ listing, groundTruth });

  assert.equal(comparison.recovered, 1);
  assert.equal(comparison.unclassifiedOverlap, 1);
  assert.equal(comparison.missed, 1, "0x0803 is neither in data nor unclassified -- it is missed");
  assert.deepEqual(comparison.overlapAddresses, [0x0802]);
  assert.ok(
    !comparison.recoveredAddresses.includes(0x0802) && !comparison.missedAddresses.includes(0x0802),
    "the overlapping address must appear in exactly one bucket: overlapAddresses",
  );
});

// ============================================================================
// Behavior 3: an empty certainData set refuses the rate line
// ============================================================================

test("an empty certainData set: renderProof01Report() refuses the recovery line, never 0.00/NaN/100.00", () => {
  const groundTruth = makeGroundTruth([]);
  const listing = makeListing({ data: [0x0801] });
  const comparison = compareByteDerivedRecovery({ listing, groundTruth });

  assert.equal(comparison.denominator, 0);
  const report = renderProof01Report(comparison, { dxaCodeAddresses: 0, dxaDataAddresses: 1 });
  assert.match(report, /^PROOF01_DATA_RECOVERY_PCT: refused/m);
  assert.doesNotMatch(report, /PROOF01_DATA_RECOVERY_PCT: 0\.00/);
  assert.doesNotMatch(report, /PROOF01_DATA_RECOVERY_PCT: NaN/);
  assert.doesNotMatch(report, /PROOF01_DATA_RECOVERY_PCT: 100\.00/);
});

// ============================================================================
// Behavior 4: PROOF01_FALSE_POSITIVES is unconditionally the refusal string
// ============================================================================

test("PROOF01_FALSE_POSITIVES is always PROOF01_FALSE_POSITIVES_REFUSAL, even when dxa classified addresses as code", () => {
  const groundTruth = makeGroundTruth([0x0801, 0x0802]);
  // dxa's listing.code is non-empty in this case -- irrelevant to the
  // ground-truth tier, since certainCode is always empty on it regardless.
  const listing = makeListing({ data: [0x0801, 0x0802] });
  listing.code.add(0x0900); // dxa claims SOME code exists in the image
  const comparison = compareByteDerivedRecovery({ listing, groundTruth });

  const report = renderProof01Report(comparison, { dxaCodeAddresses: listing.code.size, dxaDataAddresses: listing.data.size });
  assert.match(report, new RegExp(`^PROOF01_FALSE_POSITIVES: ${PROOF01_FALSE_POSITIVES_REFUSAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  assert.doesNotMatch(report, /PROOF01_FALSE_POSITIVES: 0$/m);
  assert.doesNotMatch(report, /PROOF01_FALSE_POSITIVES: \d+$/m);
});

// ============================================================================
// Behavior 5: determinism -- two identical calls render byte-identical
// strings, and every address array is sorted ascending numerically
// ============================================================================

test("two calls with identical inputs return byte-identical strings; address arrays are sorted ascending", () => {
  // Addresses deliberately inserted out of ascending order, to prove the
  // comparator sorts rather than preserving Set insertion order.
  const groundTruth = makeGroundTruth([0x0803, 0x0801, 0x0802, 0x0805, 0x0804]);
  const listing = makeListing({ data: [0x0802, 0x0801], unclassified: [0x0805] });

  const input: Proof01ComparisonInput = { listing, groundTruth };
  const comparisonA = compareByteDerivedRecovery(input);
  const comparisonB = compareByteDerivedRecovery(input);

  assert.deepEqual(comparisonA.recoveredAddresses, [0x0801, 0x0802]);
  assert.deepEqual(comparisonA.missedAddresses, [0x0803, 0x0804]);
  assert.deepEqual(comparisonA.overlapAddresses, [0x0805]);
  assert.ok(
    comparisonA.recoveredAddresses.every((a, i, arr) => i === 0 || arr[i - 1]! < a),
    "recoveredAddresses must be strictly ascending",
  );
  assert.ok(
    comparisonA.missedAddresses.every((a, i, arr) => i === 0 || arr[i - 1]! < a),
    "missedAddresses must be strictly ascending",
  );

  const meta = { dxaCodeAddresses: 0, dxaDataAddresses: listing.data.size };
  const reportA = renderProof01Report(comparisonA, meta);
  const reportB = renderProof01Report(comparisonB, meta);
  assert.equal(reportA, reportB, "two calls with identical inputs must render byte-identical strings");

  // Fixed line order, always: GROUND_TRUTH_TIER, POSITIVE_CLASS,
  // DATA_RECOVERY_PCT, FALSE_POSITIVES, UNCLASSIFIED_OVERLAP,
  // DXA_CODE_ADDRESSES, DXA_DATA_ADDRESSES.
  const lineNames = reportA.split("\n").map((l) => l.split(":")[0]);
  assert.deepEqual(lineNames, [
    "PROOF01_GROUND_TRUTH_TIER",
    "PROOF01_POSITIVE_CLASS",
    "PROOF01_DATA_RECOVERY_PCT",
    "PROOF01_FALSE_POSITIVES",
    "PROOF01_UNCLASSIFIED_OVERLAP",
    "PROOF01_DXA_CODE_ADDRESSES",
    "PROOF01_DXA_DATA_ADDRESSES",
  ]);
});

// ============================================================================
// Behavior 6: source-text assertion -- no filesystem or process-spawn import
// ============================================================================

test("compareByteDerivedRecovery() never reads the filesystem and never starts a process: no such import in the module's own source", () => {
  // Read as raw bytes (Buffer), not through a grep-filtered stream, so a NUL
  // byte anywhere in the file could not silently hide a matching line from
  // this assertion.
  const sourceBytes = readFileSync(MODULE_PATH);
  const source = sourceBytes.toString("utf8");

  // Substring/bare-name checks, not regex-shaped import patterns -- mirrors
  // dxa-listing.test.ts's own (broader, simpler) guard. A regex tied to a
  // specific import/require shape misses bare specifiers (`from "fs"`,
  // no `node:` prefix), `require("node:fs")`, and any dynamic `import(...)`
  // form; a plain substring check catches all of those uniformly.
  const bannedSubstrings = ["child_process", "node:fs", '"fs"', "'fs'"];
  for (const banned of bannedSubstrings) {
    assert.equal(
      source.includes(banned),
      false,
      `dxa-proof01-compare.ts must never reference ${banned} (filesystem or child-process access)`,
    );
  }

  // No local rounding helper either -- formatPercent() must be imported, not
  // reimplemented. Comment lines (leading `//` or `*`) are excluded first,
  // exactly like the plan's own equivalent verify command, since this
  // module's header quotes dxa-partition.ts's own formatPercent() doc
  // comment, which names `toFixed` while forbidding it.
  const nonCommentLines = source.split("\n").filter((line) => !/^\s*[/*]/.test(line));
  for (const line of nonCommentLines) {
    assert.ok(!line.includes("toFixed"), `no local rounding helper allowed (found "toFixed" outside a comment): ${line}`);
  }
  assert.match(source, /from\s+["']\.\/dxa-partition\.ts["']/, "must import formatPercent from dxa-partition.ts");
});
