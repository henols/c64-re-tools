// Coverage for the on-demand-load detector's pure logic (01-04 Task 1).
// Every test here runs with no emulator present -- small synthetic fixtures
// for the boundary/attribution/ordering behaviour, plus two cases that read
// the real committed sidecars to prove the pure functions reproduce
// already-recorded evidence. The import-purity guard test at the bottom is
// the durable, mechanical statement of the one-permitted-route rule: this
// whole file runs to completion with the emulator absent, and the guard
// keeps it that way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import {
  WATCH_SET,
  attributeAddress,
  reportHits,
  idleGate,
  classifyHit,
  screenSignature,
  addrNum,
  hex4,
} from "./watch-loads.mjs";
import { buildChipState, buildRangeManifest } from "./dump-artifacts.mjs";
import { firstDumpArtifact, skipUnless } from "./test-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");  // scripts -> skill -> skills -> .claude -> repo root

// ----------------------------------------------------------------- addrNum

test("addrNum parses $-hex, 0x-hex, decimal strings and numbers", () => {
  assert.equal(addrNum("$08B1"), 0x08b1);
  assert.equal(addrNum("0x08b1"), 0x08b1);
  assert.equal(addrNum("2225"), 2225);
  assert.equal(addrNum(2225), 2225);
});

test("hex4 formats a 4-digit uppercase $ address", () => {
  assert.equal(hex4(0x08b1), "$08B1");
  assert.equal(hex4(0), "$0000");
});

// -------------------------------------------------------------- WATCH_SET

function fakeRegistry(loaderRanges) {
  return {
    releases: [
      {
        id: "fake",
        loader_ranges: loaderRanges,
        dumps: [{ label: "run1", range_manifest: "recovery/fake/dumps/fake-run1.map.json" }],
      },
    ],
  };
}

const FAKE_MANIFEST = {
  ranges: [
    { start: 0, end: 15, kind: "unclassified" },
    { start: 16, end: 31, kind: "unused", note: "power-on pattern" },
    { start: 32, end: 63, kind: "unclassified" },
  ],
};

test("WATCH_SET assigns tier stopping to loader-reentry ranges and tier counting to never-populated ranges and the register sentinel", () => {
  const reg = fakeRegistry([{ start: "$0900", end: "$0901", note: "cracktro poll", evidence: "LDA $DC00" }]);
  const set = WATCH_SET("fake", { registry: reg, manifest: FAKE_MANIFEST });
  const tiers = new Map(set.map((s) => [s.kind, s.tier]));
  assert.equal(tiers.get("loader-reentry"), "stopping");
  assert.equal(tiers.get("never-populated"), "counting");
  assert.equal(tiers.get("register"), "counting");
  const dd00 = set.find((s) => s.name === "reg:$DD00");
  assert.ok(dd00, "register sentinel present");
});

test("WATCH_SET throws an actionable message when the release has no loader_ranges recorded", () => {
  const reg = fakeRegistry([]);
  assert.throws(() => WATCH_SET("fake", { registry: reg, manifest: FAKE_MANIFEST }), /no loader_ranges recorded/);
});

// --------------------------------------------------------- attributeAddress

test("attributeAddress resolves the first and last byte of every declared range", () => {
  const sentinels = [
    { name: "a", start: 0x0900, end: 0x0910 },
    { name: "b", start: 0x1000, end: 0x1fff },
  ];
  assert.equal(attributeAddress(0x0900, sentinels).name, "a");
  assert.equal(attributeAddress(0x0910, sentinels).name, "a");
  assert.equal(attributeAddress(0x1000, sentinels).name, "b");
  assert.equal(attributeAddress(0x1fff, sentinels).name, "b");
});

test("attributeAddress keeps abutting ranges separate -- exactly one owner at the shared boundary", () => {
  const sentinels = [
    { name: "a", start: 0x1000, end: 0x1fff },
    { name: "b", start: 0x2000, end: 0x2fff },
  ];
  const atBoundaryEnd = attributeAddress(0x1fff, sentinels);
  const atBoundaryStart = attributeAddress(0x2000, sentinels);
  assert.equal(atBoundaryEnd.name, "a");
  assert.equal(atBoundaryStart.name, "b");
  assert.notEqual(atBoundaryEnd.name, atBoundaryStart.name);
});

test("attributeAddress throws naming both sentinels for an overlapping resolved set", () => {
  const sentinels = [
    { name: "a", start: 0x1000, end: 0x1fff },
    { name: "b", start: 0x1800, end: 0x2000 },
  ];
  assert.throws(() => attributeAddress(0x1900, sentinels), (err) => {
    return /overlapping or duplicate/.test(err.message) && err.message.includes("a") && err.message.includes("b");
  });
});

test("attributeAddress returns an explicit unmatched result for an out-of-range address, never the nearest neighbour", () => {
  const sentinels = [{ name: "a", start: 0x1000, end: 0x1fff }];
  const result = attributeAddress(0x5000, sentinels);
  assert.equal(result.matched, false);
  assert.equal(result.name, null);
});

// ------------------------------------------------------------- reportHits

test("reportHits orders by cycle, then address, then sentinel name -- swapping input order is stable", () => {
  const hits = [
    { cycle: 5, address: "$1000", sentinel: "z" },
    { cycle: 5, address: "$1000", sentinel: "a" },
    { cycle: 3, address: "$2000", sentinel: "m" },
  ];
  const a = reportHits(hits);
  const b = reportHits([...hits].reverse());
  assert.deepEqual(a, b);
  assert.equal(a[0].cycle, 3);
  assert.equal(a[1].sentinel, "a");
  assert.equal(a[2].sentinel, "z");
});

test("reportHits over an empty hit log returns an empty result rather than throwing", () => {
  assert.deepEqual(reportHits({ hits: [] }), []);
  assert.deepEqual(reportHits([]), []);
  assert.doesNotThrow(() => reportHits({}));
});

test("reportHits is idempotent -- calling twice on the same log produces identical output", () => {
  const log = { hits: [{ cycle: 1, address: "$1000", sentinel: "a" }, { cycle: 1, address: "$1000", sentinel: "b" }] };
  assert.deepEqual(reportHits(log), reportHits(log));
});

// --------------------------------------------------------------- idleGate

test("idleGate accepts a calibration in which every stopping-tier sentinel recorded zero hits", () => {
  const cal = {
    cycles_advanced: 12345,
    sentinels: [
      { name: "loader:a", tier: "stopping", hits: 0 },
      { name: "unused:b", tier: "counting", hits: 3 },
    ],
  };
  assert.equal(idleGate(cal).ok, true);
});

test("idleGate rejects a calibration in which a stopping-tier sentinel recorded a non-zero count, naming it", () => {
  const cal = {
    cycles_advanced: 12345,
    sentinels: [{ name: "loader:a", tier: "stopping", hits: 113 }],
  };
  const result = idleGate(cal);
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].name, "loader:a");
  assert.equal(result.violations[0].hits, 113);
});

test("idleGate rejects a calibration whose cycles_advanced is zero even when every hit count is zero", () => {
  const cal = { cycles_advanced: 0, sentinels: [{ name: "loader:a", tier: "stopping", hits: 0 }] };
  const result = idleGate(cal);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /cycles_advanced/);
});

// -------------------------------------------------------------- classifyHit

test("classifyHit returns unattributed when pc, backtrace or disassembly is missing", () => {
  assert.equal(classifyHit({}), "unattributed");
  assert.equal(classifyHit({ pc: "$8E9D", backtrace: [], disassembly: "STA ($04),Y" }), "unattributed");
  assert.equal(classifyHit({ pc: "$8E9D", backtrace: ["$0800"], disassembly: "" }), "unattributed");
});

test("classifyHit returns the recorded classification only when pc, backtrace and disassembly are all present", () => {
  const hit = { pc: "$8E9D", backtrace: ["$0800"], disassembly: "STA ($04),Y", classification: "gameplay-write" };
  assert.equal(classifyHit(hit), "gameplay-write");
  const loadHit = { ...hit, classification: "load-candidate" };
  assert.equal(classifyHit(loadHit), "load-candidate");
});

// ---------------------------------------------------------- screenSignature

test("screenSignature hashes exactly 1000 bytes and carries the sprite-enable value through", () => {
  const hex = "00".repeat(1000);
  const result = screenSignature(hex, 60);
  assert.equal(result.sprite_enable, 60);
  assert.equal(typeof result.digest, "string");
  assert.equal(result.digest.length, 64);
});

test("screenSignature throws for a screen matrix that is not exactly 1000 bytes", () => {
  assert.throws(() => screenSignature("00".repeat(999), 0), /expected 1000 bytes/);
});

// ------------------------------------------------ real committed sidecars

const CHIP_STATE = firstDumpArtifact("chip_state");

test("buildChipState reproduces a committed sidecar's recorded derivations from that file's own raw readings",
  { skip: skipUnless(CHIP_STATE, "a committed chip-state sidecar") }, () => {
  const committed = JSON.parse(readFileSync(CHIP_STATE.path, "utf8"));
  const raw = {
    dd00_raw: committed.derived.dd00_raw,
    d018_raw: committed.derived.d018_raw,
    port01_raw: committed.derived.port01.raw,
    sprite_pointers: committed.derived.sprite_pointers,
    registers: committed.registers,
    sprites: committed.sprites,
    cpu: committed.cpu,
  };
  const result = buildChipState(raw);
  assert.equal(result.derived.vic_bank, committed.derived.vic_bank);
  assert.equal(result.derived.screen_base, committed.derived.screen_base);
  assert.equal(result.derived.charset_base, committed.derived.charset_base);
  assert.deepEqual(result.derived.sprite_data_addresses, committed.derived.sprite_data_addresses);
});

const BIN = firstDumpArtifact("bin");

test("buildRangeManifest over a committed image produces ranges whose union covers all 65536 addresses",
  { skip: skipUnless(BIN, "a committed 64K image") }, () => {
  const image = readFileSync(BIN.path);
  const manifest = buildRangeManifest(image, { release: BIN.release, label: BIN.label });
  assert.equal(manifest.classification_state, "ranges-only");
  let expected = 0;
  for (const r of manifest.ranges) {
    assert.equal(r.start, expected, `gap or overlap before ${r.start}`);
    expected = r.end + 1;
  }
  assert.equal(expected, 65536);
});

// ------------------------------------------------- import-purity guard (T-01-25)

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

test("every import specifier in watch-loads.mjs and dump-artifacts.mjs is a node: built-in or a sibling file inside tools/ -- the mechanical proof of the one permitted route", () => {
  const files = ["watch-loads.mjs", "dump-artifacts.mjs"];
  let totalSpecifiers = 0;
  for (const f of files) {
    const src = stripComments(readFileSync(join(HERE, f), "utf8"));
    const specs = importSpecifiers(src);
    assert.ok(specs.length > 0, `${f} should have at least one import specifier (this assertion fails if removed, so it cannot pass vacuously)`);
    totalSpecifiers += specs.length;
    for (const spec of specs) {
      const isNodeBuiltin = spec.startsWith("node:");
      const isSiblingPath = spec.startsWith("./") || spec.startsWith("../");
      assert.ok(
        isNodeBuiltin || isSiblingPath,
        `${f} imports "${spec}", which is neither a node: built-in nor a relative path -- this module must never acquire an outside dependency`
      );
      if (isSiblingPath) {
        const resolved = resolve(HERE, spec);
        assert.ok(resolved.startsWith(HERE), `${f}'s import "${spec}" resolves outside tools/ (${resolved})`);
      }
    }
  }
  assert.ok(totalSpecifiers > 0, "at least one specifier must have been checked across both modules");
});

// ----------------------------------------------------------------- renderLoading

test("renderLoading flags a blocked run's zero count as unevidenced rather than rendering it as a plain zero", async () => {
  const { renderLoading } = await import("./watch-loads.mjs");
  const blockedLog = {
    machine: "C64SC",
    video_standard: "PAL",
    vice_version: "3.10",
    run_status: "blocked",
    run_status_note: "Boot never progressed past its pre-loader state; two independent cycles_advanced brackets both measured zero.",
    armed: [],
    idle_calibration: { cycles_advanced: 0, sentinels: [] },
    hits: [],
  };
  const md = renderLoading([{ id: "example", log: blockedLog }]);
  assert.match(md, /NOT AN EVIDENCED ZERO/, "a blocked run must not render its zero count as a plain, unqualified result");
  assert.match(md, /never progressed past its pre-loader state/, "the blocked-run reason must be surfaced in the rendered document");
});

test("renderLoading flags a blocked run's NON-zero count as a partial result, not a plain evidenced count", async () => {
  const { renderLoading } = await import("./watch-loads.mjs");
  const partialLog = {
    machine: "C64SC",
    video_standard: "PAL",
    vice_version: "3.10",
    run_status: "blocked",
    run_status_note: "Play-through halted by a genuine silent host VICE stall after 2 of the required milestones.",
    armed: [],
    idle_calibration: { cycles_advanced: 100, sentinels: [] },
    hits: [
      { sentinel: "reg:$DD00", address: "$DD00", cycle: 1, pc: "$07DB", backtrace: [{ return_address: 1 }], disassembly: "STA $DD00", classification: "gameplay-write" },
    ],
  };
  const md = renderLoading([{ id: "example", log: partialLog }]);
  assert.match(md, /PARTIAL RESULT, NOT A COMPLETED COVERAGE CLAIM/, "a blocked run with a non-zero count must not be rendered with the zero-specific warning text");
  assert.doesNotMatch(md, /The count above is `0` only because/, "must not claim the count is 0 when it is not");
  assert.match(md, /halted by a genuine silent host VICE stall/, "the blocked-run reason must still be surfaced");
});

test("renderLoading does NOT add the blocked-run warning for an ordinary (non-blocked) log", async () => {
  const { renderLoading } = await import("./watch-loads.mjs");
  const normalLog = {
    machine: "C64SC",
    video_standard: "PAL",
    vice_version: "3.10",
    armed: [],
    idle_calibration: { cycles_advanced: 100, sentinels: [] },
    hits: [],
  };
  const md = renderLoading([{ id: "example", log: normalLog }]);
  assert.doesNotMatch(md, /NOT AN EVIDENCED ZERO/, "an ordinary log must not be flagged as a blocked run");
});
