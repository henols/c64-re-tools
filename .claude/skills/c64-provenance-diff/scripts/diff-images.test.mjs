// Coverage for diff-images.mjs: the anchor-proven offset
// search, N-way byte diff, gap-tolerant coalescing, patch counting, and the
// generated ledger tier. Every test here runs with no emulator present --
// small synthetic fixtures for the arithmetic and boundary cases, plus a
// corpus-driven case that runs `anchorSearch` against whatever real committed
// dumps the host project has, skipping when it has none.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import {
  anchorSearch,
  proveOffset,
  applyOffset,
  diffRanges,
  coalesceRanges,
  countPatches,
  bucketManifest,
  findPrintableRuns,
  findCracktroRuns,
  renderLedger,
  enumerateManifests,
  splitRangeByManifestKind,
} from "./diff-images.mjs";
import { registryPath } from "../../c64-ram-capture/scripts/releases.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");  // scripts -> skill -> skills -> .claude -> repo root

// ------------------------------------------------------------ anchorSearch

// Deterministic, non-periodic pseudo-random fill (sha256 counter mode) --
// a linear-congruence fill like `(i*37+11)&0xff` has a short period (256
// here) and produces spurious repeated matches within a few KB, which is
// not what a "distinctive" run means for this test.
function pseudoRandomFill(length, seed) {
  const buf = Buffer.alloc(length);
  let counter = 0;
  let pos = 0;
  while (pos < length) {
    const chunk = createHash("sha256").update(`${seed}:${counter++}`).digest();
    chunk.copy(buf, pos);
    pos += chunk.length;
  }
  return buf.subarray(0, length);
}

test("anchorSearch finds a unique anchor and reports delta plus neighbour bytes", () => {
  // A distinctive, non-repeating pattern across the whole post-volatile-zone
  // region (rather than one narrow run in an otherwise-blank buffer) so the
  // search's own candidate-selection heuristics can't miss it by construction.
  const source = Buffer.alloc(4096, 0x00);
  pseudoRandomFill(4096 - 1024, "anchor-fixture").copy(source, 1024);
  const target = Buffer.from(source); // offset 0 -- identical placement

  const anchors = anchorSearch(source, target, { minRunLength: 48, count: 4 });
  assert.ok(anchors.length > 0, "expected at least one candidate anchor");
  const hit = anchors.find((a) => a.unique && a.delta === 0);
  assert.ok(hit, "expected at least one unique anchor agreeing on delta 0");
  assert.ok(hit.neighbourBytes, "neighbour bytes must be reported for a unique anchor");
  assert.equal(hit.neighbourBytes.at, target[hit.matchOffset]);
  assert.equal(hit.neighbourBytes.before, target[hit.matchOffset - 1]);
  assert.equal(hit.neighbourBytes.after, target[hit.matchOffset + 1]);
});

test("anchorSearch rejects a trivial constant-byte run as a candidate", () => {
  const source = Buffer.alloc(1024, 0xff);
  const target = Buffer.alloc(1024, 0xff);
  const anchors = anchorSearch(source, target, { minRunLength: 32, count: 4 });
  assert.equal(anchors.length, 0, "an all-constant image offers no non-trivial candidate anchors");
});

test("anchorSearch reports multiple match offsets when a run repeats in the target", () => {
  const run = Buffer.from(Array.from({ length: 48 }, (_, i) => (i * 13 + 3) & 0xff));
  const source = Buffer.alloc(4096, 0x00);
  run.copy(source, 1024);
  const target = Buffer.alloc(4096, 0x00);
  run.copy(target, 1024);
  run.copy(target, 3000); // the same run repeats elsewhere in the target
  const anchors = anchorSearch(source, target, { minRunLength: 48, count: 4 });
  const hit = anchors.find((a) => a.sourceOffset === 1024);
  assert.ok(hit);
  assert.equal(hit.matchCount, 2);
  assert.equal(hit.unique, false);
  assert.equal(hit.delta, null);
});

// ------------------------------------------------------------- proveOffset

test("proveOffset accepts a single offset when every unique-match anchor agrees", () => {
  const anchors = [
    { sourceOffset: 100, unique: true, delta: 5 },
    { sourceOffset: 200, unique: true, delta: 5 },
    { sourceOffset: 300, unique: true, delta: 5 },
  ];
  const proof = proveOffset(anchors);
  assert.equal(proof.ok, true);
  assert.equal(proof.offset, 5);
});

test("proveOffset FAILS (never a majority vote) when one anchor's delta disagrees", () => {
  const anchors = [
    { sourceOffset: 100, unique: true, delta: 0 },
    { sourceOffset: 200, unique: true, delta: 0 },
    { sourceOffset: 300, unique: true, delta: 7 }, // disagrees
  ];
  const proof = proveOffset(anchors);
  assert.equal(proof.ok, false, "must fail rather than return the majority answer (0)");
  assert.equal(proof.offset, null);
  assert.ok(proof.reason.includes("disagree"));
  // The disagreeing anchor set must name every usable anchor, including the majority ones.
  assert.equal(proof.disagreeing.length, 3);
  assert.ok(proof.disagreeing.some((a) => a.sourceOffset === 300 && a.delta === 7));
});

test("proveOffset rejects an anchor that matched at more than one target offset", () => {
  const anchors = [
    { sourceOffset: 100, unique: true, delta: 0 },
    { sourceOffset: 200, unique: false, delta: null, matches: [50, 900] },
  ];
  const proof = proveOffset(anchors);
  assert.equal(proof.ok, true, "the remaining unique anchor still proves the offset");
  assert.equal(proof.offset, 0);
  assert.equal(proof.rejected.length, 1);
  assert.equal(proof.rejected[0].sourceOffset, 200);
});

test("proveOffset fails with an actionable reason when no anchor produced a unique match", () => {
  const anchors = [
    { sourceOffset: 100, unique: false, delta: null, matches: [1, 2] },
    { sourceOffset: 200, unique: false, delta: null, matches: [] },
  ];
  const proof = proveOffset(anchors);
  assert.equal(proof.ok, false);
  assert.ok(proof.reason.includes("no anchor produced a unique match"));
});

// ------------------------------------------------------------- applyOffset

test("applyOffset excludes an address whose offset-adjusted counterpart falls past $FFFF, with a named reason, no wrap", () => {
  const result = applyOffset(0xfff0, 0x20); // 0xfff0 + 0x20 = 0x10010, past $FFFF
  assert.equal(result.inRange, false);
  assert.ok(result.reason.includes("$0000-$FFFF"));
  assert.ok(!result.reason.includes("wrapped") || result.reason.includes("never wrapped"));
  assert.equal(result.target, 0x10010, "the raw target must not be silently wrapped modulo 65536");
});

test("applyOffset covers $0000 and $FFFF inclusive when the proven offset is zero", () => {
  const low = applyOffset(0x0000, 0);
  const high = applyOffset(0xffff, 0);
  assert.equal(low.inRange, true);
  assert.equal(low.target, 0);
  assert.equal(high.inRange, true);
  assert.equal(high.target, 0xffff);
});

test("applyOffset excludes a negative offset-adjusted address, never wrapping to a positive one", () => {
  const result = applyOffset(0x0005, -0x10);
  assert.equal(result.inRange, false);
  assert.equal(result.target, -11);
});

// ------------------------------------------------------------- coalesceRanges

function orig(start, end, agreeing = 2) {
  return { start, end, verdict: "ORIGINAL", agreeing_releases: agreeing, evidence: "identical", reason: "" };
}
function unk(start, end, reason = "no signature") {
  return { start, end, verdict: "UNKNOWN", agreeing_releases: 0, evidence: "", reason };
}
function patch(start, end, evidence = "loader region") {
  return { start, end, verdict: "CRACKER-PATCH", agreeing_releases: 0, evidence, reason: "" };
}

test("coalesceRanges merges two differing ranges across a gap strictly shorter than the tolerance", () => {
  const ranges = [unk(0, 9), orig(10, 19), unk(20, 29)]; // gap length 10 < tolerance 16
  const { ranges: out, coalesced } = coalesceRanges(ranges, 16);
  assert.equal(out.length, 1);
  assert.equal(out[0].start, 0);
  assert.equal(out[0].end, 29);
  assert.equal(coalesced, 2);
});

test("coalesceRanges leaves ranges separated by a gap EXACTLY equal to the tolerance as two separate rows -- the boundary is defined, not incidental", () => {
  const ranges = [unk(0, 9), orig(10, 25), unk(26, 35)]; // gap length exactly 16
  const { ranges: out } = coalesceRanges(ranges, 16);
  assert.equal(out.length, 3, "a gap of exactly the tolerance must NOT be swallowed");
  assert.deepEqual(
    out.map((r) => [r.start, r.end, r.verdict]),
    [
      [0, 9, "UNKNOWN"],
      [10, 25, "ORIGINAL"],
      [26, 35, "UNKNOWN"],
    ]
  );
});

test("coalesceRanges leaves ranges separated by a gap LONGER than the tolerance as two separate rows", () => {
  const ranges = [unk(0, 9), orig(10, 30), unk(31, 40)]; // gap length 21 > 16
  const { ranges: out } = coalesceRanges(ranges, 16);
  assert.equal(out.length, 3);
});

test("coalesceRanges merges runs of the SAME verdict directly (no gap) and preserves that verdict", () => {
  const ranges = [patch(0, 9), patch(10, 19)];
  const { ranges: out } = coalesceRanges(ranges, 16);
  assert.equal(out.length, 1);
  assert.equal(out[0].verdict, "CRACKER-PATCH");
});

test("coalesceRanges downgrades a mixed-verdict merge to UNKNOWN -- the conservative choice, never a fabricated stronger verdict", () => {
  const ranges = [patch(0, 9), orig(10, 15), unk(16, 25)]; // gap 6 < 16, differing verdicts on each side
  const { ranges: out } = coalesceRanges(ranges, 16);
  assert.equal(out.length, 1);
  assert.equal(out[0].verdict, "UNKNOWN");
  assert.ok(out[0].reason.length > 0, "a merged UNKNOWN row must still carry a non-empty reason");
});

test("coalesceRanges reports kept-vs-coalesced counts in the accumulate-both-counts shape", () => {
  const ranges = [orig(0, 100), unk(101, 110)];
  const { kept, coalesced } = coalesceRanges(ranges, 16);
  assert.equal(kept, 2);
  assert.equal(coalesced, 0);
});

// ---------------------------------------------------------------- diffRanges

function makeImage(fillByte) {
  return Buffer.alloc(65536, fillByte);
}

test("diffRanges: identical bytes across >=2 releases verdict ORIGINAL, never below agreeing_releases=2", () => {
  const a = makeImage(0x11);
  const b = makeImage(0x11);
  const result = diffRanges(
    [
      { id: "a", bytes: a, offset: 0, loaderRanges: [], cracktroRuns: [] },
      { id: "b", bytes: b, offset: 0, loaderRanges: [], cracktroRuns: [] },
    ],
    { gapTolerance: 16 }
  );
  assert.equal(result.ranges.length, 1);
  assert.equal(result.ranges[0].verdict, "ORIGINAL");
  assert.ok(result.ranges[0].agreeing_releases >= 2);
});

test("diffRanges: a range only one release covers yields UNKNOWN, never ORIGINAL", () => {
  const a = makeImage(0x22);
  const result = diffRanges([{ id: "solo", bytes: a, offset: 0, loaderRanges: [], cracktroRuns: [] }], { gapTolerance: 16 });
  assert.equal(result.ranges.length, 1);
  assert.equal(result.ranges[0].verdict, "UNKNOWN");
  assert.ok(result.ranges[0].reason.length > 0);
});

test("diffRanges: a differing byte inside a release's loader_ranges is classified CRACKER-PATCH with the technique named", () => {
  const a = Buffer.alloc(65536, 0x00);
  const b = Buffer.alloc(65536, 0x00);
  b[100] = 0x99; // differs at address 100
  const result = diffRanges(
    [
      { id: "a", bytes: a, offset: 0, loaderRanges: [{ start: 90, end: 110 }], cracktroRuns: [] },
      { id: "b", bytes: b, offset: 0, loaderRanges: [], cracktroRuns: [] },
    ],
    { gapTolerance: 0 }
  );
  const hit = result.ranges.find((r) => r.start <= 100 && r.end >= 100 && r.start !== 0);
  const patchRange = result.ranges.find((r) => r.verdict === "CRACKER-PATCH");
  assert.ok(patchRange, "expected at least one CRACKER-PATCH range");
  assert.ok(patchRange.evidence.includes("loader"));
});

test("diffRanges: a differing byte with no recognised signature is UNKNOWN with a reason naming the ruled-out alternatives", () => {
  const a = Buffer.alloc(65536, 0x00);
  const b = Buffer.alloc(65536, 0x00);
  b[5000] = 0x77; // differs, not inside any loader/cracktro range
  const result = diffRanges(
    [
      { id: "a", bytes: a, offset: 0, loaderRanges: [], cracktroRuns: [] },
      { id: "b", bytes: b, offset: 0, loaderRanges: [], cracktroRuns: [] },
    ],
    { gapTolerance: 0 }
  );
  const unkRange = result.ranges.find((r) => r.verdict === "UNKNOWN" && r.start <= 5000 && r.end >= 5000);
  assert.ok(unkRange);
  assert.ok(unkRange.reason.includes("no recognised cracker signature"));
});

test("diffRanges: ranges union covers exactly $0000-$FFFF with no gap and no overlap", () => {
  const a = Buffer.alloc(65536, 0x00);
  const b = Buffer.alloc(65536, 0x00);
  for (let i = 0; i < 65536; i += 137) b[i] = (b[i] + 1) & 0xff; // scatter some differences
  const result = diffRanges(
    [
      { id: "a", bytes: a, offset: 0, loaderRanges: [], cracktroRuns: [] },
      { id: "b", bytes: b, offset: 0, loaderRanges: [], cracktroRuns: [] },
    ],
    { gapTolerance: 16 }
  );
  let sum = 0;
  let prevEnd = -1;
  for (const r of [...result.ranges].sort((x, y) => x.start - y.start)) {
    assert.ok(r.start > prevEnd, `range starting at ${r.start} overlaps previous end ${prevEnd}`);
    assert.equal(r.start, prevEnd + 1, "no gap between consecutive ranges");
    sum += r.end - r.start + 1;
    prevEnd = r.end;
  }
  assert.equal(sum, 65536);
  assert.equal(prevEnd, 65535);
});

test("diffRanges: an out-of-range offset excludes that release from the address's coverage rather than wrapping", () => {
  const a = Buffer.alloc(65536, 0x11);
  const b = Buffer.alloc(65536, 0x11);
  // b's offset pushes it entirely out of range for address 0 -- but in range elsewhere.
  const result = diffRanges(
    [
      { id: "a", bytes: a, offset: 0, loaderRanges: [], cracktroRuns: [] },
      { id: "b", bytes: b, offset: -5, loaderRanges: [], cracktroRuns: [] }, // address 0 -> target -5, out of range
    ],
    { gapTolerance: 0 }
  );
  const first = result.ranges.find((r) => r.start === 0);
  assert.equal(first.verdict, "UNKNOWN", "only one release (a) covers address 0 once b's offset pushes it out of range");
});

// -------------------------------------------------------------- countPatches

test("countPatches counts CRACKER-PATCH bytes only within ranges bucketed 'game', per release, deterministically", () => {
  const a = Buffer.alloc(65536, 0x00);
  const b = Buffer.alloc(65536, 0x00);
  b[50000] = 0x42; // a difference inside a 'game'-bucketed region for both
  const images = [
    { id: "a", bytes: a, offset: 0, loaderRanges: [{ start: 49990, end: 50010 }], cracktroRuns: [] },
    { id: "b", bytes: b, offset: 0, loaderRanges: [{ start: 49990, end: 50010 }], cracktroRuns: [] },
  ];
  const diffResult = diffRanges(images, { gapTolerance: 0 });
  const gameManifest = { ranges: [{ start: 0, end: 65535, kind: "game" }] };
  const counts1 = countPatches(images, diffResult, { a: gameManifest, b: gameManifest });
  const counts2 = countPatches(images, diffResult, { a: gameManifest, b: gameManifest });
  assert.deepEqual(counts1, counts2, "must be re-runnable and byte-identical");
  assert.equal(counts1.a, 1);
  assert.equal(counts1.b, 1);
});

test("countPatches reports zero for a release whose CRACKER-PATCH bytes fall outside its own 'game' bucket", () => {
  const a = Buffer.alloc(65536, 0x00);
  const b = Buffer.alloc(65536, 0x00);
  b[300] = 0x42;
  const images = [
    { id: "a", bytes: a, offset: 0, loaderRanges: [{ start: 290, end: 310 }], cracktroRuns: [] },
    { id: "b", bytes: b, offset: 0, loaderRanges: [{ start: 290, end: 310 }], cracktroRuns: [] },
  ];
  const diffResult = diffRanges(images, { gapTolerance: 0 });
  const loaderManifest = { ranges: [{ start: 0, end: 65535, kind: "loader" }] };
  const counts = countPatches(images, diffResult, { a: loaderManifest, b: loaderManifest });
  assert.equal(counts.a, 0);
  assert.equal(counts.b, 0);
});

// -------------------------------------------------------------- findPrintableRuns

test("findPrintableRuns finds a run of printable-ASCII bytes at least minLength long", () => {
  const buf = Buffer.alloc(64, 0x00);
  Buffer.from("SOME GAME CRACKED BY").copy(buf, 20);
  const runs = findPrintableRuns(buf, { minLength: 8 });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].start, 20);
});

test("findPrintableRuns ignores a printable run shorter than minLength", () => {
  const buf = Buffer.alloc(64, 0x00);
  Buffer.from("HI").copy(buf, 10);
  const runs = findPrintableRuns(buf, { minLength: 8 });
  assert.equal(runs.length, 0);
});

// -------------------------------------------------------------- findCracktroRuns

test("findCracktroRuns matches a printable run containing a recognised crack-credit word", () => {
  const buf = Buffer.alloc(64, 0x00);
  Buffer.from("SOME GAME CRACKED BY").copy(buf, 10);
  const runs = findCracktroRuns(buf, { minLength: 8 });
  assert.equal(runs.length, 1);
});

test("findCracktroRuns does NOT match a game's own title-screen text -- a real false positive found live against a two-release corpus, where the title text differed between releases and a bare printable scan called it cracker credit", () => {
  const buf = Buffer.alloc(64, 0x00);
  Buffer.from("PUBLISHER PRESENTS").copy(buf, 10);
  const runsPlain = findPrintableRuns(buf, { minLength: 8 });
  assert.equal(runsPlain.length, 1, "the plain scan does find this run -- it is genuinely printable text");
  const runsCracktro = findCracktroRuns(buf, { minLength: 8 });
  assert.equal(runsCracktro.length, 0, "but it must not be classified as cracktro credit content -- it's the game's own presentation text");
});

// -------------------------------------------------------------- bucketManifest

test("bucketManifest reclassifies an unclassified range against loader_ranges, seeding 'loader' from the registry, never NOTES.md prose", () => {
  const image = Buffer.alloc(65536, 0x00);
  const manifest = {
    schema_version: 1,
    classification_state: "ranges-only",
    ranges: [
      { start: 0, end: 99, kind: "unclassified" },
      { start: 100, end: 65535, kind: "unused", note: "power-on pattern" },
    ],
  };
  const bucketed = bucketManifest(image, manifest, { loaderRanges: [{ start: "$0000", end: "$001F", note: "loader scratch", evidence: "disasm" }] });
  assert.equal(bucketed.classification_state, "bucketed");
  const kinds = new Set(bucketed.ranges.map((r) => r.kind));
  assert.ok(![...kinds].includes("unclassified"), "no unclassified range may remain");
  const loaderRange = bucketed.ranges.find((r) => r.kind === "loader");
  assert.ok(loaderRange);
  assert.equal(loaderRange.start, 0);
  assert.equal(loaderRange.end, 31);
  const gameRange = bucketed.ranges.find((r) => r.kind === "game");
  assert.ok(gameRange, "the remainder reached by the trace must be bucketed game");
  assert.equal(gameRange.start, 32);
  assert.equal(gameRange.end, 99);
});

test("bucketManifest preserves 'unused' and 'io' ranges verbatim and only touches 'unclassified' ranges", () => {
  const image = Buffer.alloc(65536, 0x00);
  const manifest = {
    ranges: [
      { start: 0, end: 15, kind: "unused", note: "power-on" },
      { start: 16, end: 31, kind: "io", note: "I/O window" },
      { start: 32, end: 63, kind: "unclassified" },
    ],
  };
  const bucketed = bucketManifest(image, manifest, { loaderRanges: [] });
  assert.deepEqual(bucketed.ranges.find((r) => r.start === 0), { start: 0, end: 15, kind: "unused", note: "power-on" });
  assert.deepEqual(bucketed.ranges.find((r) => r.start === 16), { start: 16, end: 31, kind: "io", note: "I/O window" });
});

test("bucketManifest's output ranges form a complete, gapless, non-overlapping partition matching the input manifest's own span", () => {
  const image = Buffer.alloc(65536, 0x00);
  const manifest = {
    ranges: [
      { start: 0, end: 999, kind: "unclassified" },
      { start: 1000, end: 1015, kind: "unused" },
      { start: 1016, end: 65535, kind: "unclassified" },
    ],
  };
  const bucketed = bucketManifest(image, manifest, { loaderRanges: [{ start: "$0064", end: "$00C7" }] });
  const sorted = [...bucketed.ranges].sort((a, b) => a.start - b.start);
  let expected = 0;
  for (const r of sorted) {
    assert.equal(r.start, expected);
    expected = r.end + 1;
  }
  assert.equal(expected, 65536);
});

test("bucketManifest is idempotent -- re-running it on an already-bucketed manifest preserves game/loader/cracktro ranges rather than discarding them", () => {
  const image = Buffer.alloc(65536, 0x00);
  const manifest = {
    ranges: [
      { start: 0, end: 15, kind: "unused" },
      { start: 16, end: 999, kind: "unclassified" },
    ],
  };
  const firstPass = bucketManifest(image, manifest, { loaderRanges: [{ start: "$0020", end: "$003F" }] });
  assert.equal(firstPass.classification_state, "bucketed");
  const kindsAfterFirst = new Set(firstPass.ranges.map((r) => r.kind));
  assert.ok(kindsAfterFirst.has("game"));
  assert.ok(kindsAfterFirst.has("loader"));

  // Re-run on the manifest bucketManifest itself just produced.
  const secondPass = bucketManifest(image, firstPass, { loaderRanges: [{ start: "$0020", end: "$003F" }] });
  const kindsAfterSecond = new Set(secondPass.ranges.map((r) => r.kind));
  assert.ok(kindsAfterSecond.has("game"), "a second bucketing pass must not discard the game range");
  assert.ok(kindsAfterSecond.has("loader"), "a second bucketing pass must not discard the loader range");
  assert.ok(kindsAfterSecond.has("unused"));
  assert.deepEqual(
    [...firstPass.ranges].sort((a, b) => a.start - b.start),
    [...secondPass.ranges].sort((a, b) => a.start - b.start),
    "bucketing an already-bucketed manifest must be a no-op"
  );
});

// -------------------------------------------------------------- renderLedger

test("renderLedger refuses to emit (throws, writes nothing) when a row is UNKNOWN with an empty reason", () => {
  const generatedRanges = [
    { start: 0, end: 65535, verdict: "UNKNOWN", agreeing_releases: 0, evidence: "", reason: "" },
  ];
  assert.throws(() => renderLedger({ generatedRanges, gapTolerance: 16, prose: "x" }), /UNKNOWN with an empty reason/);
});

test("renderLedger refuses to emit when a row is ORIGINAL with agreeing_releases below two", () => {
  const generatedRanges = [
    { start: 0, end: 65535, verdict: "ORIGINAL", agreeing_releases: 1, evidence: "only one release", reason: "" },
  ];
  assert.throws(() => renderLedger({ generatedRanges, gapTolerance: 16, prose: "x" }), /agreeing_releases=1/);
});

test("renderLedger refuses to emit when ranges do not cover exactly $0000-$FFFF", () => {
  const generatedRanges = [
    { start: 0, end: 65534, verdict: "ORIGINAL", agreeing_releases: 2, evidence: "identical", reason: "" },
  ];
  assert.throws(() => renderLedger({ generatedRanges, gapTolerance: 16, prose: "x" }), /does not reach \$FFFF/);
});

test("renderLedger produces byte-identical generated-tier output across two runs from unchanged input", () => {
  const generatedRanges = [
    { start: 0, end: 32767, kind: "game", verdict: "ORIGINAL", agreeing_releases: 2, evidence: "identical", reason: "" },
    { start: 32768, end: 65535, kind: "loader", verdict: "CRACKER-PATCH", agreeing_releases: 0, evidence: "loader replacement", reason: "" },
  ];
  const md1 = renderLedger({ generatedRanges, gapTolerance: 16, prose: "prose text" });
  const md2 = renderLedger({ generatedRanges, gapTolerance: 16, prose: "prose text" });
  const tier1 = md1.split("## Prose tier")[0];
  const tier2 = md2.split("## Prose tier")[0];
  assert.equal(tier1, tier2);
});

test("renderLedger sorts rows by start address ascending then end address ascending", () => {
  const generatedRanges = [
    { start: 100, end: 199, kind: "game", verdict: "ORIGINAL", agreeing_releases: 2, evidence: "id", reason: "" },
    { start: 0, end: 99, kind: "game", verdict: "ORIGINAL", agreeing_releases: 2, evidence: "id", reason: "" },
    { start: 200, end: 65535, kind: "game", verdict: "ORIGINAL", agreeing_releases: 2, evidence: "id", reason: "" },
  ];
  const md = renderLedger({ generatedRanges, gapTolerance: 16, prose: "x" });
  const tier = md.split("## Prose tier")[0];
  const firstIdx = tier.indexOf("$0000");
  const secondIdx = tier.indexOf("$0064");
  const thirdIdx = tier.indexOf("$00C8");
  assert.ok(firstIdx < secondIdx && secondIdx < thirdIdx, "rows must appear in start-ascending order");
});

// -------------------------------------------------------------- enumerateManifests

test("enumerateManifests reads every dumps[] entry's range_manifest from the registry, never a hardcoded pair", () => {
  const fakeRegistry = {
    releases: [
      { id: "a", dumps: [{ label: "run1", range_manifest: "recovery/a/dumps/a-run1.map.json" }, { label: "run2", range_manifest: "recovery/a/dumps/a-run2.map.json" }] },
      { id: "b", dumps: [{ label: "run1", range_manifest: "recovery/b/dumps/b-run1.map.json" }] },
    ],
  };
  const list = enumerateManifests(fakeRegistry);
  assert.equal(list.length, 3);
  assert.ok(list.some((m) => m.release === "a" && m.label === "run2"));
});

// -------------------------------------------------------- splitRangeByManifestKind

test("splitRangeByManifestKind splits a range spanning a manifest kind boundary into per-kind sub-ranges", () => {
  // A real bug found live: a coalesced diff range can span straight through
  // a manifest's own kind boundary (e.g. a wide ORIGINAL range ORIGINAL range
  // crosses its own $0340-$035E loader sub-range), and resolving kind from
  // only the range's start address silently mislabels everything past the
  // first boundary.
  const manifestRanges = [
    { start: 0, end: 831, kind: "game" },
    { start: 832, end: 862, kind: "loader" },
    { start: 863, end: 65535, kind: "game" },
  ];
  const diffRange = { start: 828, end: 18288, verdict: "ORIGINAL", agreeing_releases: 2, evidence: "identical", reason: "" };
  const split = splitRangeByManifestKind(diffRange, manifestRanges);
  assert.equal(split.length, 3);
  assert.deepEqual(split.map((r) => [r.start, r.end, r.kind]), [
    [828, 831, "game"],
    [832, 862, "loader"],
    [863, 18288, "game"],
  ]);
  // Every sub-range must keep the original verdict/evidence, only start/end/kind change.
  for (const r of split) {
    assert.equal(r.verdict, "ORIGINAL");
    assert.equal(r.agreeing_releases, 2);
    assert.equal(r.evidence, "identical");
  }
});

test("splitRangeByManifestKind returns the range unchanged (one sub-range) when it doesn't cross a kind boundary", () => {
  const manifestRanges = [{ start: 0, end: 65535, kind: "game" }];
  const diffRange = { start: 100, end: 200, verdict: "UNKNOWN", agreeing_releases: 0, evidence: "", reason: "no signature" };
  const split = splitRangeByManifestKind(diffRange, manifestRanges);
  assert.equal(split.length, 1);
  assert.deepEqual(split[0], { ...diffRange, kind: "game" });
});

// ------------------------------------------------- real-dump integration case

// Corpus-driven: needs two committed primary dumps from different releases.
// Positional, never a release-id comparison -- the reference is simply the first
// release, and "the other one" is anything that isn't it. Skips when the host
// project has fewer than two releases with an existing run1 .bin.
const PAIR = (() => {
  let reg;
  try {
    reg = JSON.parse(readFileSync(registryPath, "utf8"));
  } catch {
    return null;
  }
  const withRun1 = (reg.releases ?? [])
    .map((r) => ({ r, d: (r.dumps ?? []).find((d) => d.label === "run1") }))
    .filter((x) => x.d && x.d.bin && existsSync(join(REPO_ROOT, x.d.bin)));
  return withRun1.length >= 2 ? [withRun1[0], withRun1[1]] : null;
})();

test("anchorSearch against two real committed primary dumps finds unique agreeing anchors",
  { skip: PAIR ? false : "fewer than two committed run1 dumps in this project -- integration case skipped" }, () => {
  const source = readFileSync(join(REPO_ROOT, PAIR[0].d.bin));
  const target = readFileSync(join(REPO_ROOT, PAIR[1].d.bin));
  assert.equal(source.length, 65536);
  assert.equal(target.length, 65536);

  const { anchorSearch: realAnchorSearch, proveOffset: realProveOffset } = { anchorSearch, proveOffset };
  const anchors = realAnchorSearch(source, target);
  const proof = realProveOffset(anchors);
  assert.ok(anchors.length > 0, "expected at least one candidate anchor from the real dumps");
  assert.ok(proof.usable.length > 0, "expected at least one anchor with a unique match against the real target dump");
  assert.equal(proof.ok, true, `expected the real dumps to agree on a single offset; got: ${proof.reason}`);
});

// ------------------------------------------------- import-purity guard

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function importSpecifiers(src) {
  const specs = [];
  const re = /import\s+(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) specs.push(m[1]);
  return specs;
}

// The invariant here is NOT "imports must be siblings" -- it is "this module
// cannot acquire an outside dependency", which is the mechanical proof that it
// never reaches the emulator by importing a transport module and never pulls a
// third-party package. The toolkit ships as a bundle of skills that may import
// each other, so a sibling *skill*'s scripts dir is legitimate; anything beyond
// the skills tree is not. Widened deliberately when the recovery pipeline moved
// out of `tools/` into the skills (2026-08-04) -- widened to the bundle boundary,
// not removed.
const SKILLS_ROOT = resolve(HERE, "..", "..");

test("every import specifier in diff-images.mjs is a node: built-in or a module inside the skills bundle -- the mechanical proof of the one permitted route", () => {
  const src = stripComments(readFileSync(join(HERE, "diff-images.mjs"), "utf8"));
  const specs = importSpecifiers(src);
  assert.ok(specs.length > 0, "diff-images.mjs should have at least one import specifier");
  for (const spec of specs) {
    const isNodeBuiltin = spec.startsWith("node:");
    const isRelativePath = spec.startsWith("./") || spec.startsWith("../");
    assert.ok(
      isNodeBuiltin || isRelativePath,
      `diff-images.mjs imports "${spec}", which is neither a node: built-in nor a relative path -- a bare specifier means a third-party package`,
    );
    if (isRelativePath) {
      const resolvedPath = resolve(HERE, spec);
      assert.ok(
        resolvedPath.startsWith(SKILLS_ROOT + "/"),
        `diff-images.mjs's import "${spec}" resolves to ${resolvedPath}, outside the skills bundle at ${SKILLS_ROOT}`,
      );
      assert.ok(
        /\/scripts\//.test(resolvedPath),
        `diff-images.mjs's import "${spec}" must resolve into some skill's scripts/ dir, not ${resolvedPath}`,
      );
    }
  }
});
