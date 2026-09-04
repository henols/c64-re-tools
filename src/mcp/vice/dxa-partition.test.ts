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
// test (dxa-partition.ts never imports either) -- the only `spawnSync` calls
// in this FILE drive the CLI as a subprocess for the task-3 CLI cases, which
// is a property of the test, not of the module.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  directiveLength,
  partitionSourceDerived,
  renderSourceDerivedReport,
  partitionByteDerived,
  renderByteDerivedReport,
  renderPartitionReport,
  formatPercent,
  rangesAreDisjointAndSorted,
} from "./dxa-partition.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures", "dxa");
const DXA_PARTITION_TS = join(HERE, "dxa-partition.ts");

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

// ============================================================================
// Task 2: the byte-derived tier
// ============================================================================

/** The canonical `10 SYS 2064` stub body (12 bytes) plus a 4-byte
 * non-BASIC tail, byte-identical to fixtures/dxa/basic-stub.prg's own body
 * (its header stripped). Building negative cases from this array with ONE
 * field mutated keeps each negative case differing from the working
 * positive case by exactly the thing it claims to test. */
function stubBody(): number[] {
  return [0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x34, 0x00, 0x00, 0x00, 0xaa, 0xbb, 0xcc, 0xdd];
}

test("task2: a clean 10 SYS 2064 stub classifies exactly 12 bytes certain-data; everything after is unknown", () => {
  const body = new Uint8Array(stubBody());
  const partition = partitionByteDerived({ bytes: body, isPrg: false, origin: 0x0801 });
  assert.equal(partition.certainData.size, 12);
  assert.equal(partition.unknown.size, body.length - 12);
  assert.equal(partition.stubAttempted, true);
});

test("task2: the .prg header bytes appear in no class and in no denominator", () => {
  const prgBytes = readFileSync(join(FIXTURES, "basic-stub.prg"));
  assert.equal(prgBytes.length, 18);
  const partition = partitionByteDerived({ bytes: new Uint8Array(prgBytes), isPrg: true });
  assert.equal(partition.headerBytes, 2);
  assert.equal(partition.certainData.size, 12);
  assert.equal(partition.unknown.size, 4, "18 - 2 header - 12 certain-data = 4 unknown");
  const denominator = partition.certainCode.size + partition.certainData.size;
  assert.equal(denominator, 12, "the denominator is certain-code + certain-data, excluding the 2 header bytes entirely");
  // Neither header byte (the .prg's own load-address bytes 0x01, 0x08) ever
  // becomes an in-image ADDRESS at all -- the smallest classified address is
  // the stub's own origin, never anything below it.
  assert.equal(Math.min(...partition.certainData, ...partition.unknown), 0x0801);
});

test("task2 [unknown]: a link address pointing backwards (or to itself) makes the WHOLE stub unknown", () => {
  const body = stubBody();
  body[0] = 0x01;
  body[1] = 0x08; // link = $0801, equal to the line's own start address
  const partition = partitionByteDerived({ bytes: new Uint8Array(body), isPrg: false, origin: 0x0801 });
  assert.equal(partition.certainData.size, 0, "backwards link: whole stub must be unknown, not partially classified");
  assert.equal(partition.unknown.size, body.length);
  assert.match(partition.stubOutcome, /backwards or to itself/);
  assert.match(partition.stubOutcome, /\$0801/, "the reason must name the offending link value");
});

test("task2 [unknown]: a link address pointing outside the image makes the WHOLE stub unknown", () => {
  const body = stubBody();
  body[0] = 0xff;
  body[1] = 0xff; // link = $ffff, far outside the 16-byte body's window
  const partition = partitionByteDerived({ bytes: new Uint8Array(body), isPrg: false, origin: 0x0801 });
  assert.equal(partition.certainData.size, 0, "out-of-range link: whole stub must be unknown");
  assert.equal(partition.unknown.size, body.length);
  assert.match(partition.stubOutcome, /points outside the image/);
  assert.match(partition.stubOutcome, /\$ffff/, "the reason must name the offending link value");
});

test("task2 [unknown]: a link address pointing to a non-existent line (not the terminator's true next-line address) makes the WHOLE stub unknown", () => {
  const body = stubBody();
  body[0] = 0x0c;
  body[1] = 0x08; // link = $080c: forward and in-bounds, but NOT where the terminator scan actually lands ($080b)
  const partition = partitionByteDerived({ bytes: new Uint8Array(body), isPrg: false, origin: 0x0801 });
  assert.equal(partition.certainData.size, 0, "non-line-start link: whole stub must be unknown");
  assert.equal(partition.unknown.size, body.length);
  assert.match(partition.stubOutcome, /does not point to the next line's actual start/);
  assert.match(partition.stubOutcome, /\$080c/, "the reason must name the offending link value");
});

test("task2 [unknown]: a missing line terminator makes the WHOLE stub unknown", () => {
  // Mutates the terminator field ($00 at offset 9) AND the two EOP-marker
  // bytes that would otherwise supply the next accidental zero (offsets
  // 10-11) -- together these ARE the terminator field this case tests: with
  // any one of them left as $00, the scan would simply find the NEXT zero
  // byte and report a (wrong) non-line-start mismatch instead of a missing
  // terminator, so all three must move together to genuinely remove every
  // zero from the remaining body. The link field itself (offset 0-1) is
  // untouched.
  const body = stubBody();
  body[9] = 0xff;
  body[10] = 0xff;
  body[11] = 0xff;
  const partition = partitionByteDerived({ bytes: new Uint8Array(body), isPrg: false, origin: 0x0801 });
  assert.equal(partition.certainData.size, 0, "missing terminator: whole stub must be unknown");
  assert.equal(partition.unknown.size, body.length);
  assert.match(partition.stubOutcome, /no \$00 line terminator/);
});

test("task2: a stub truncated before its end-of-program marker makes the WHOLE stub unknown", () => {
  const body = stubBody().slice(0, 11); // terminator present at offset 9, but only 1 byte follows it (need 2)
  const partition = partitionByteDerived({ bytes: new Uint8Array(body), isPrg: false, origin: 0x0801 });
  assert.equal(partition.certainData.size, 0);
  assert.equal(partition.unknown.size, body.length);
  assert.match(partition.stubOutcome, /truncated before its end-of-program marker/);
});

test("task2: the end-of-program marker is inside certain-data; the next address is unknown; the two never merge (two range entries)", () => {
  const prgBytes = readFileSync(join(FIXTURES, "basic-stub.prg"));
  const partition = partitionByteDerived({ bytes: new Uint8Array(prgBytes), isPrg: true });
  assert.equal(partition.certainData.has(0x080b), true, "the first EOP-marker byte is certain-data");
  assert.equal(partition.certainData.has(0x080c), true, "the second EOP-marker byte is certain-data");
  assert.equal(partition.unknown.has(0x080d), true, "the byte immediately after the marker is unknown");
  assert.equal(partition.ranges.length, 2, "certain-data and unknown must render as two separate entries, never merged");
  assert.equal(partition.ranges[0]!.class, "certain-data");
  assert.equal(partition.ranges[0]!.end, 0x080c);
  assert.equal(partition.ranges[1]!.class, "unknown");
  assert.equal(partition.ranges[1]!.start, 0x080d);
});

test("task2: a .prg whose load address is not $0801 gets no stub attempt; everything is unknown, with a stated reason", () => {
  const body = new Uint8Array([0x02, 0x08, ...stubBody()]); // header says load address $0802
  const partition = partitionByteDerived({ bytes: body, isPrg: true });
  assert.equal(partition.stubAttempted, false);
  assert.equal(partition.certainData.size, 0);
  assert.equal(partition.unknown.size, 16);
  assert.match(partition.stubOutcome, /is not \$0801/);
});

test("task2: a flat 64K-shaped image with no declared $0801 origin gets no stub attempt; everything is unknown", () => {
  const body = new Uint8Array(stubBody());
  const partition = partitionByteDerived({ bytes: body, isPrg: false, origin: 0 });
  assert.equal(partition.stubAttempted, false);
  assert.equal(partition.certainData.size, 0);
  assert.equal(partition.unknown.size, body.length);
});

test("task2: a zero-byte image is refused by name", () => {
  assert.throws(() => partitionByteDerived({ bytes: new Uint8Array(0), isPrg: true }), /refusing a 0-byte image/);
});

test("task2: a one-byte image is refused by name", () => {
  assert.throws(() => partitionByteDerived({ bytes: new Uint8Array([0x01]), isPrg: true }), /refusing a 1-byte image/);
});

test("task2: a two-byte .prg (header only) yields 0 classifiable bytes, zero counts, and no rate line at all", () => {
  const partition = partitionByteDerived({ bytes: new Uint8Array([0x01, 0x08]), isPrg: true });
  assert.equal(partition.bodyLength, 0);
  assert.equal(partition.certainCode.size, 0);
  assert.equal(partition.certainData.size, 0);
  assert.equal(partition.unknown.size, 0);
  const rendered = renderByteDerivedReport(partition);
  assert.doesNotMatch(rendered, /BYTE_DERIVED_DATA_FRACTION: \d/, "a zero-denominator run must never print a numeric rate line");
  assert.match(rendered, /BYTE_DERIVED_DATA_FRACTION: refused/);
});

test("task2: formatPercent renders 97/134 as 72.39, matching Phase 23's own shape", () => {
  assert.equal(formatPercent(97, 134), "72.39 (97/134)");
});

test("task2: formatPercent rounds a ratio landing exactly on a half at the second decimal UP (1/32 = 3.125% -> 3.13)", () => {
  assert.equal(formatPercent(1, 32), "3.13 (1/32)");
});

test("task2: formatPercent refuses a zero denominator by name rather than rendering 0.00, NaN or 100.00", () => {
  assert.throws(() => formatPercent(0, 0), /refusing a zero denominator/);
});

test("task2: no convention-based screen/charset address ($0400/$1000) is ever asserted in this module's source", () => {
  const source = readFileSync(DXA_PARTITION_TS, "utf8");
  const hits = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .filter((line) => /0x0400|0x1000|\$0400|\$1000/.test(line));
  assert.deepEqual(hits, [], "$0400/$1000 must never appear outside a comment in dxa-partition.ts");
});

// ============================================================================
// Task 3: the report -- both tiers named, no dxa-recovery claim
// ============================================================================

test("task3: renderPartitionReport always names both PARTITION_SOURCE_DERIVED and PARTITION_BYTE_DERIVED, and states POSITIVE_CLASS", () => {
  const byteDerivedPartition = partitionByteDerived({ bytes: new Uint8Array(stubBody()), isPrg: false, origin: 0x0801 });
  const rendered = renderPartitionReport({
    sourceDerived: { available: false, reason: "no ACME source for this input" },
    byteDerived: { available: true, data: { partition: byteDerivedPartition } },
  });
  assert.match(rendered, /PARTITION_SOURCE_DERIVED/);
  assert.match(rendered, /PARTITION_BYTE_DERIVED/);
  assert.match(rendered, /POSITIVE_CLASS: data/);
});

test("task3: the inapplicable tier carries a stated reason rather than being omitted", () => {
  const byteDerivedPartition = partitionByteDerived({ bytes: new Uint8Array(stubBody()), isPrg: false, origin: 0x0801 });
  const rendered = renderPartitionReport({
    sourceDerived: { available: false, reason: "no ACME source for this input" },
    byteDerived: { available: true, data: { partition: byteDerivedPartition } },
  });
  assert.match(rendered, /PARTITION_SOURCE_DERIVED: not run this invocation -- no ACME source for this input/);
});

test("task3: the abstention section is non-empty for both a byte-derived-only run and a source-derived-only run", () => {
  const byteDerivedPartition = partitionByteDerived({ bytes: new Uint8Array(stubBody()), isPrg: false, origin: 0x0801 });
  const byteOnly = renderPartitionReport({
    sourceDerived: { available: false, reason: "not attempted" },
    byteDerived: { available: true, data: { partition: byteDerivedPartition } },
  });
  const abstentionByte = byteOnly.slice(byteOnly.indexOf("=== ABSTENTION ==="));
  assert.ok(abstentionByte.trim().length > "=== ABSTENTION ===".length, "byte-derived abstention must be non-empty");

  const reportText = readFileSync(join(FIXTURES, "fixture.rep"), "utf8");
  const sourcePartition = partitionSourceDerived(reportText, 0x0801, 279);
  const sourceOnly = renderPartitionReport({
    sourceDerived: { available: true, data: { partition: sourcePartition } },
    byteDerived: { available: false, reason: "not attempted" },
  });
  const abstentionSource = sourceOnly.slice(sourceOnly.indexOf("=== ABSTENTION ==="));
  assert.ok(abstentionSource.trim().length > "=== ABSTENTION ===".length, "source-derived abstention must be non-empty");
});

test("task3: renderPartitionReport is byte-identical across two calls with the same inputs (idempotency)", () => {
  const byteDerivedPartition = partitionByteDerived({ bytes: new Uint8Array(stubBody()), isPrg: false, origin: 0x0801 });
  const opts = {
    sourceDerived: { available: false as const, reason: "not attempted" },
    byteDerived: { available: true as const, data: { partition: byteDerivedPartition } },
  };
  assert.equal(renderPartitionReport(opts), renderPartitionReport(opts));
});

test("task3: no line of the rendered report asserts a data-recovery rate for dxa on real cracked code", () => {
  const reportText = readFileSync(join(FIXTURES, "fixture.rep"), "utf8");
  const sourcePartition = partitionSourceDerived(reportText, 0x0801, 279);
  const byteDerivedPartition = partitionByteDerived({ bytes: new Uint8Array(stubBody()), isPrg: false, origin: 0x0801 });
  const rendered = renderPartitionReport({
    sourceDerived: { available: true, data: { partition: sourcePartition } },
    byteDerived: { available: true, data: { partition: byteDerivedPartition } },
  });
  assert.doesNotMatch(rendered, /PROOF-01/i);
  assert.doesNotMatch(rendered, /data.recovery.rate/i);
});

test("task3 [CLI]: node dxa-partition.ts with no arguments exits non-zero with a usage message", () => {
  const r = spawnSync("node", [DXA_PARTITION_TS], { encoding: "utf8", cwd: HERE });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Usage:/);
});

test("task3 [CLI]: node dxa-partition.ts byte-derived <basic-stub.prg> prints both tier names, POSITIVE_CLASS, and no dxa-recovery-rate claim", () => {
  const r = spawnSync("node", [DXA_PARTITION_TS, "byte-derived", join(FIXTURES, "basic-stub.prg")], {
    encoding: "utf8",
    cwd: HERE,
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /PARTITION_SOURCE_DERIVED/);
  assert.match(r.stdout, /PARTITION_BYTE_DERIVED/);
  assert.match(r.stdout, /POSITIVE_CLASS: data/);
  assert.doesNotMatch(r.stdout, /PROOF-01/i);
  assert.doesNotMatch(r.stdout, /data.recovery.rate/i);
});

test("task3 [CLI]: node dxa-partition.ts source-derived <fixture.rep> <fixture.prg> reproduces the 145/131/3 fixture-tier numbers via the CLI", () => {
  const r = spawnSync(
    "node",
    [DXA_PARTITION_TS, "source-derived", join(FIXTURES, "fixture.rep"), join(FIXTURES, "fixture.prg")],
    { encoding: "utf8", cwd: HERE },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /GT_CODE_BYTES: 145/);
  assert.match(r.stdout, /GT_DATA_BYTES: 131/);
  assert.match(r.stdout, /GT_PAD_BYTES: 3/);
});
