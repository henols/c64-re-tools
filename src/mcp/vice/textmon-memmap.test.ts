// textmon-memmap.test.ts
//
// Deterministic, no-emulator coverage for textmon-memmap.ts's `memmapshow`
// parser -- the phase's tracer slice (PARSE-01, PARSE-03). Task 1 lands the
// tracer's own coverage: purity, both real two-binary captures parsing
// clean, the ROM-execute-without-read proof from real bytes, the `(dummy)`
// annotation, and `accessMapRanges()`'s adjacency-merge/truncation shape.
// Task 2 adds every refusal-code arm plus the encoding assertion; Task 3
// adds the planted-refusal controls and the declared-synthetic RAM-execute
// case. No fixture in this file is hand-rolled beyond a short, explicitly
// synthetic inline payload -- every real payload comes from
// textmon-fixtures.ts's loadTextFixture(), never a direct readFileSync
// against fixtures/textmon.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadTextFixture } from "./textmon-fixtures.ts";
import {
  parseAccessMap,
  accessMapRanges,
  type AccessMap,
  type AccessMapEntry,
  type AccessFlags,
} from "./textmon-memmap.ts";

const HERE = fileURLToPath(import.meta.url);
const OWN_MODULE = HERE.replace(/textmon-memmap\.test\.ts$/, "textmon-memmap.ts");

// ---------------------------------------------------------------------------
// Purity (PARSE-03): the module imports NOTHING. Asserted mechanically by
// reading this module's own source and scanning for a top-level ES import
// statement, not by review.
// ---------------------------------------------------------------------------

test("purity (PARSE-03): textmon-memmap.ts contains no top-level ES import statement", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  const importLines = src.split("\n").filter((line) => /^\s*import\s/.test(line));
  assert.deepEqual(importLines, [], `expected zero import lines, found: ${JSON.stringify(importLines)}`);
});

// ---------------------------------------------------------------------------
// Both real two-binary captures parse clean, and are provenance-checked
// through loadTextFixture -- never a hand-rolled sidecar check.
// ---------------------------------------------------------------------------

test("both real captures (access-map-stock, access-map-fork) parse to ok:true and are genuine hardware captures", () => {
  const stock = loadTextFixture("access-map-stock");
  const fork = loadTextFixture("access-map-fork");

  assert.equal(stock.synthetic, false, "access-map-stock must be a real capture, not synthetic");
  assert.equal(fork.synthetic, false, "access-map-fork must be a real capture, not synthetic");
  assert.match(String(stock.provenance.capturedFrom), /^stock:/);
  assert.match(String(stock.provenance.viceVersion), /3\.9/);
  assert.match(String(fork.provenance.capturedFrom), /^fork:/);
  assert.match(String(fork.provenance.viceVersion), /3\.10/);

  const stockResult = parseAccessMap(stock.text);
  assert.equal(stockResult.ok, true, `expected access-map-stock to parse, got ${JSON.stringify(!stockResult.ok ? stockResult.refusal : undefined)}`);
  const forkResult = parseAccessMap(fork.text);
  assert.equal(forkResult.ok, true, `expected access-map-fork to parse, got ${JSON.stringify(!forkResult.ok ? forkResult.refusal : undefined)}`);

  if (stockResult.ok) {
    assert.ok(stockResult.value.entries.length > 0, "expected a non-empty, sparse entries array");
  }
  if (forkResult.ok) {
    assert.ok(forkResult.value.entries.length > 0, "expected a non-empty, sparse entries array");
  }
});

// ---------------------------------------------------------------------------
// Execute is its own bit -- proven from REAL captured bytes (the ROM half;
// Task 3 adds the declared-synthetic RAM half).
// ---------------------------------------------------------------------------

function findEntry(map: AccessMap, predicate: (entry: AccessMapEntry) => boolean): AccessMapEntry | undefined {
  return map.entries.find(predicate);
}

test("real capture: a ROM column of r-x decodes rom.read===true, rom.write===false, rom.execute===true", () => {
  const stock = loadTextFixture("access-map-stock");
  const result = parseAccessMap(stock.text);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const entry = findEntry(result.value, (e) => e.rom.read && !e.rom.write && e.rom.execute);
  assert.ok(entry, "expected at least one real entry with ROM column r-x");
});

test("real capture: a ROM column of --x decodes rom.read===false, rom.execute===true -- execute proven independent of read", () => {
  const stock = loadTextFixture("access-map-stock");
  const result = parseAccessMap(stock.text);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const entry = findEntry(result.value, (e) => !e.rom.read && !e.rom.write && e.rom.execute);
  assert.ok(entry, "expected at least one real entry with ROM column --x (execute recorded, no read)");
});

test("real capture: an entry carrying the (dummy) suffix decodes with the dummy annotation and unchanged glyph fields", () => {
  const stock = loadTextFixture("access-map-stock");
  const result = parseAccessMap(stock.text);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const entry = findEntry(result.value, (e) => e.annotations.includes("dummy"));
  assert.ok(entry, "expected at least one real entry carrying the (dummy) annotation");
  assert.deepEqual(entry!.annotations, ["dummy"]);
  // The 0000 address is documented (README.md) as carrying (dummy) on both
  // binaries with RAM column rw- -- glyph decoding is unaffected by the
  // trailing annotation.
  const zeroPage = findEntry(result.value, (e) => e.address === 0x0000);
  assert.ok(zeroPage);
  assert.deepEqual(zeroPage!.ram, { read: true, write: true, execute: false });
});

// ---------------------------------------------------------------------------
// accessMapRanges(): adjacency merge and the truncation budget, over a
// small hand-built map.
// ---------------------------------------------------------------------------

const FLAGS_A: AccessFlags = { read: false, write: false, execute: true };
const FLAGS_B: AccessFlags = { read: false, write: false, execute: false };
const NONE: AccessFlags = { read: false, write: false, execute: false };

function entry(address: number, rom: AccessFlags): AccessMapEntry {
  return { address, io: NONE, rom, ram: NONE, annotations: [] };
}

test("accessMapRanges: identical flags at consecutive addresses merge into ONE range", () => {
  const map: AccessMap = { entries: [entry(0x1000, FLAGS_A), entry(0x1001, FLAGS_A)] };
  const result = accessMapRanges(map);
  assert.equal(result.rangeCount, 1);
  assert.deepEqual(result.ranges, [{ start: 0x1000, end: 0x1001, io: NONE, rom: FLAGS_A, ram: NONE, annotations: [] }]);
});

test("accessMapRanges: a single differing execute bit at consecutive addresses emits TWO ranges", () => {
  const map: AccessMap = { entries: [entry(0x1000, FLAGS_A), entry(0x1001, FLAGS_B)] };
  const result = accessMapRanges(map);
  assert.equal(result.rangeCount, 2);
});

test("accessMapRanges: identical flags at NON-consecutive addresses emit TWO ranges", () => {
  const map: AccessMap = { entries: [entry(0x1000, FLAGS_A), entry(0x1002, FLAGS_A)] };
  const result = accessMapRanges(map);
  assert.equal(result.rangeCount, 2);
});

test("accessMapRanges: maxRanges smaller than the merged count returns truncated:true, rangeCount is the full merged count, and exactly maxRanges entries are emitted", () => {
  const entries: AccessMapEntry[] = [];
  for (let i = 0; i < 10; i++) {
    // Non-adjacent addresses (step 2) so every entry is its own range.
    entries.push(entry(0x2000 + i * 2, FLAGS_A));
  }
  const map: AccessMap = { entries };
  const result = accessMapRanges(map, { maxRanges: 3 });
  assert.equal(result.rangeCount, 10);
  assert.equal(result.truncated, true);
  assert.equal(result.ranges.length, 3);
});

test("accessMapRanges: addressesWithRecordedAccess and addressesQueried carry the denominator -- an address with no recorded access is never counted as data", () => {
  const map: AccessMap = { entries: [entry(0x0005, FLAGS_A)] };
  const result = accessMapRanges(map, { startAddress: 0x0000, endAddress: 0x000f });
  assert.equal(result.addressesQueried, 16);
  assert.equal(result.addressesWithRecordedAccess, 1);
});
