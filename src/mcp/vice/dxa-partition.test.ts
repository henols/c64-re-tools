#!/usr/bin/env node
// dxa-partition.test.ts
//
// Phase 35, plan 35-03 (DXA-04). Three task sections, marked below:
//   Task 1 -- the source-derived tier, reproducing Phase 23's independently
//     re-derived 145/131/3/90/4 exactly from the committed `fixtures/dxa/
//     fixture.rep` and `fixtures/dxa/fixture.prg` (generated once from
//     `fixtures/dxa/fixture.a` by a real ACME run -- see fixtures/dxa/
//     README.md for the exact command, version, date and sha256 of each).
//   Task 2 -- the byte-derived tier: the `.prg` header exclusion and the
//     BASIC-stub certain-data classification, against `fixtures/dxa/
//     basic-stub.prg`, plus four negative mutation cases each differing
//     from the working stub by exactly the field it claims to test.
//   Task 3 -- `renderPartitionReport()` and the CLI entry point: both tier
//     names always present, the positive class stated, and no claim about
//     dxa's own recovery rate on real code anywhere in the rendered output.
//
// HERMETIC. No ACME, no dxa, no `node:child_process` INSIDE the module under
// test (dxa-partition.ts never imports either).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { directiveLength, partitionSourceDerived, renderSourceDerivedReport, rangesAreDisjointAndSorted, formatPercent } from "./dxa-partition.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures", "dxa");

// ============================================================================
// Task 1: the source-derived tier
// ============================================================================

test("task1: partitionSourceDerived reproduces Phase 23's re-derived 145/131/3/90/4 exactly, from the committed fixture", () => {
  const reportText = readFileSync(join(FIXTURES, "fixture.rep"), "utf8");
  const imageBytes = readFileSync(join(FIXTURES, "fixture.prg"));
  const loadAddr = imageBytes[0]! | (imageBytes[1]! << 8);
  const imageSize = imageBytes.length - 2;
  assert.equal(loadAddr, 0x0801);
  assert.equal(imageSize, 279);

  const partition = partitionSourceDerived(reportText, loadAddr, imageSize);

  // Targets taken verbatim from .planning/phases/23-.../evidence/fixture/
  // fixture-baseline.txt's "OUTCOME LINES" section and its section-5
  // transcript: GT_EMISSIONS: 90, GT_TRUNCATED_COLUMNS_RECOVERED: 4,
  // GT_CODE_BYTES: 145, GT_DATA_BYTES: 131, GT_PAD_BYTES: 3.
  assert.equal(partition.emissions.length, 90, "fixture-baseline.txt: GT_EMISSIONS: 90");
  assert.equal(
    partition.emissions.filter((e) => e.truncated).length,
    4,
    "fixture-baseline.txt: GT_TRUNCATED_COLUMNS_RECOVERED: 4",
  );
  assert.equal(partition.code.size, 145, "fixture-baseline.txt: GT_CODE_BYTES: 145");
  assert.equal(partition.data.size, 131, "fixture-baseline.txt: GT_DATA_BYTES: 131");
  assert.equal(partition.pad.size, 3, "fixture-baseline.txt: GT_PAD_BYTES: 3");
});

test("task1: the with-padding data figure (134) is a separately labelled second number, never the data count", () => {
  const reportText = readFileSync(join(FIXTURES, "fixture.rep"), "utf8");
  const partition = partitionSourceDerived(reportText, 0x0801, 279);
  const dataWithPadding = partition.data.size + partition.pad.size;
  assert.equal(dataWithPadding, 134, "fixture-baseline.txt: REDERIVED_GT_DATA_BYTES_WITH_PADDING: 134");
  assert.notEqual(partition.data.size, dataWithPadding, "the strict data count must not equal the with-padding figure");
  const rendered = renderSourceDerivedReport(partition);
  assert.match(rendered, /GT_DATA_BYTES: 131/);
  assert.match(rendered, /GT_DATA_BYTES_WITH_PADDING: 134/);
});

test("task1: the published 141/138 figures are recorded only as a non-match, never as ground truth", () => {
  const reportText = readFileSync(join(FIXTURES, "fixture.rep"), "utf8");
  const partition = partitionSourceDerived(reportText, 0x0801, 279);
  const rendered = renderSourceDerivedReport(partition);
  assert.match(rendered, /PUBLISHED_GT_CODE_BYTES: 141/);
  assert.match(rendered, /PUBLISHED_GT_DATA_BYTES: 138/);
  assert.match(rendered, /GT_PARTITION_MATCHES_PUBLISHED: no/);
});

test("task1: an unrecognized directive with a truncated byte column throws, quoting the offending source line", () => {
  assert.throws(
    () => directiveLength("!weird $05,$06"),
    /directiveLength:.*"!weird \$05,\$06"/,
  );
});

test("task1: a !fill directive's count is recovered correctly (a truncated column the fixture actually uses)", () => {
  assert.equal(directiveLength("!fill $20, $00"), 32);
});

test("task1: a report line with no address column (a comment) contributes zero bytes and is not counted as an emission", () => {
  const reportText = [
    "     1                          ; a comment line, no address column at all",
    "     2  0801 00                       !byte $00",
  ].join("\n");
  const partition = partitionSourceDerived(reportText, 0x0801, 1);
  assert.equal(partition.emissions.length, 1, "only the real emission counts -- the comment line matches nothing");
  assert.equal(partition.data.size, 1);
  assert.equal(partition.code.size, 0);
});

test("task1: code and data ranges are disjoint by construction, asserted rather than assumed, over the real fixture", () => {
  const reportText = readFileSync(join(FIXTURES, "fixture.rep"), "utf8");
  const partition = partitionSourceDerived(reportText, 0x0801, 279);
  assert.ok(rangesAreDisjointAndSorted(partition.ranges), "partition.ranges must be sorted ascending and pairwise disjoint");
  for (const a of partition.code) {
    assert.equal(partition.data.has(a), false, `address ${a.toString(16)} must not be in both code and data`);
  }
  const totalRangeBytes = partition.ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
  assert.equal(totalRangeBytes, 279, "the rendered range list must tile the whole 279-byte image");
});

test("task1: renderSourceDerivedReport is byte-identical across two runs on the same input (idempotency)", () => {
  const reportText = readFileSync(join(FIXTURES, "fixture.rep"), "utf8");
  const partition = partitionSourceDerived(reportText, 0x0801, 279);
  const first = renderSourceDerivedReport(partition);
  const second = renderSourceDerivedReport(partition);
  assert.equal(first, second);
});

test("task1: a report whose accounted total does not tile the declared image size refuses rather than under-counts", () => {
  // The emission itself claims 2 bytes ($0801-$0802) but the declared image
  // size is only 1 -- accounted (2) exceeds expected (1), so the function
  // must refuse rather than silently report a partition that overruns the
  // declared window.
  const reportText = "     1  0801 0000                     !byte $00,$00";
  assert.throws(() => partitionSourceDerived(reportText, 0x0801, 1), /accounted 2 bytes, expected 1/);
});

test("task1: formatPercent renders 97/134 as 72.39, matching Phase 23's own shape", () => {
  assert.equal(formatPercent(97, 134), "72.39 (97/134)");
});

test("task1: formatPercent rounds a ratio landing exactly on a half at the second decimal UP (1/32 = 3.125% -> 3.13)", () => {
  assert.equal(formatPercent(1, 32), "3.13 (1/32)");
});

test("task1: formatPercent refuses a zero denominator by name rather than rendering 0.00, NaN or 100.00", () => {
  assert.throws(() => formatPercent(0, 0), /refusing a zero denominator/);
});
