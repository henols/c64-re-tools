#!/usr/bin/env node
// c1541.test.mjs -- coverage for the `audit` subcommand's ported fakery
// detector (Phase 40, plan 40-04, PREP-01, D-06).
//
// Two tiers, deliberately separated:
//
//   1. PURE unit tests against the exported parsers and the `auditEntries()`
//      detector core, fed synthetic/literal-measured records -- never call
//      the seam, never need `c1541` installed, ALWAYS run (this is what
//      keeps this file safe under CI's `node --test 'src/skills/*/scripts/
//      *.test.mjs'` glob, which has no VICE install at all -- 40-02/40-03's
//      own SUMMARYs).
//   2. LIVE end-to-end cases that run the real `audit` CLI against the two
//      committed fixtures over the real seam -- gated on `c1541` actually
//      being resolvable on PATH, skipped with a named reason otherwise
//      (mirrors this project's own live-test skip convention, e.g.
//      dxa-live.test.ts's "no vendored binary -> skip", never a hand-rolled
//      early return that would report a false PASS).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { auditEntries, parseDirListing, parseBamAllocation, parseEntryFields, salvageFirstTsFromRefusal, sectorsPerTrack } from "./c1541.mjs";
import { projectRoot } from "../../c64-ram-capture/scripts/project-paths.mjs";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "c1541.mjs");
const FIXTURES_DIR = join(projectRoot(), "src", "mcp", "vice", "fixtures", "c1541");
const CLEAN_FIXTURE = join(FIXTURES_DIR, "synthetic.d64");
const CORRUPT_FIXTURE = join(FIXTURES_DIR, "synthetic-corrupt.d64");

// Phase 40, plan 40-04 (D-25): the acknowledged circularity is that
// synthetic.d64/synthetic-corrupt.d64 were both BUILT by the very c1541
// binary this suite tests reading back -- so their format-correctness claim
// ultimately rests on c1541 agreeing with itself. The stated mitigation is
// keeping ONE assertion against a real, INDEPENDENTLY-produced release image
// in a live-gated test (fixtures/c1541/README.md's own "acknowledged mild
// circularity" section names this). Phase 23's own evidence corpus is the
// one such image already in the tree -- never copied into fixtures/ here,
// since the point is that it is independently produced, not this phase's
// artifact.
const REAL_CORPUS_IMAGE = join(projectRoot(), ".planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64");

// ---------------------------------------------------------------------------
// Tier 1: pure parsers, against literal MEASURED text (see
// fixtures/c1541/README.md for the exact commands/builds these were
// captured from).
// ---------------------------------------------------------------------------

test("parseDirListing: skips the disk-header and trailer lines, keeps only file entries with trimmed names", () => {
  const stdout = ['0 "synthetic       " 00 2a', '1    "basicstub"        prg ', '1    "tracer"           prg ', "662 blocks free."].join(
    "\n",
  );
  assert.deepEqual(parseDirListing(stdout), [
    { name: "basicstub", blocks: 1 },
    { name: "tracer", blocks: 1 },
  ]);
});

test("parseBamAllocation: reads a per-track allocation row, ignoring the two column-header rows", () => {
  const stdout = [
    "                111111 11112",
    "     01234567 89012345 67890",
    "  1  ........ ........ .....",
    " 17  **...... ........ .....",
  ].join("\n");
  const map = parseBamAllocation(stdout);
  assert.deepEqual(map.get(1), new Set());
  assert.deepEqual(map.get(17), new Set([0, 1]));
  assert.equal(map.has(0), false, "no row for a nonexistent track 0");
});

test("parseEntryFields: reads first track/sector, blocks, and the next-directory pointer", () => {
  const stdout = [
    "Next directory T/S: 0/255",
    "Type: 0x82: prg",
    "T/S: 17/0,  1 blocks",
    "Name: 42 41 53 49 43 53 54 55 42",
  ].join("\n");
  assert.deepEqual(parseEntryFields(stdout), {
    firstTrack: 17,
    firstSector: 0,
    blocks: 1,
    nextDirTrack: 0,
    nextDirSector: 255,
  });
});

test("parseEntryFields: returns null when the T/S: line is absent (an error transcript, never a fabricated field)", () => {
  assert.equal(parseEntryFields("Error - Cannot open file `x.d64'.\n"), null);
});

test('salvageFirstTsFromRefusal: recovers the claimed track/sector from an "Error reading T:x S:y" refusal message, MEASURED against a real out-of-geometry read', () => {
  const message =
    'host_tool "c1541.entry" refuses: c1541.entry: captured stdout carries no "T/S: <t>/<s>, <n> blocks" line -- got: ' +
    '"...\\nError - Error reading T:40 S:1 from disk image.\\n..."';
  assert.deepEqual(salvageFirstTsFromRefusal(message), { firstTrack: 40, firstSector: 1 });
});

test("salvageFirstTsFromRefusal: returns null when the message names no track/sector at all", () => {
  assert.equal(salvageFirstTsFromRefusal("host_tool refuses: nothing readable here"), null);
});

// ---------------------------------------------------------------------------
// Tier 1: the pure detector core, auditEntries().
// ---------------------------------------------------------------------------

const CLEAN_BAM = new Map([
  [17, new Set([0, 1])],
  [18, new Set([0, 1])],
]);

test("auditEntries: a clean entry pointing into an allocated sector is NOT flagged -- the false-positive control", () => {
  const records = [{ name: "basicstub", blocks: 1, firstTrack: 17, firstSector: 0, nextDirTrack: 0, nextDirSector: 255 }];
  const { entries, chain_error } = auditEntries(records, { bamAllocated: CLEAN_BAM });
  assert.equal(chain_error, null);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].suspicious, false, "a genuinely-allocated entry must never be flagged");
  assert.deepEqual(entries[0].suspicious_reasons, []);
});

test("auditEntries: a block count of 0 is flagged, naming the zero block count", () => {
  const records = [{ name: "empty", blocks: 0, firstTrack: 17, firstSector: 0, nextDirTrack: 0, nextDirSector: 255 }];
  const { entries } = auditEntries(records, { bamAllocated: CLEAN_BAM });
  assert.equal(entries[0].suspicious, true);
  assert.ok(entries[0].suspicious_reasons.some((r) => r.includes("block count is 0")));
});

test("auditEntries: a first track/sector outside the image's geometry is flagged, naming the offending track and sector", () => {
  const records = [{ name: "bogus", blocks: 1, firstTrack: 40, firstSector: 1, nextDirTrack: 0, nextDirSector: 255 }];
  const { entries } = auditEntries(records, { bamAllocated: CLEAN_BAM });
  assert.equal(entries[0].suspicious, true);
  assert.ok(entries[0].suspicious_reasons.some((r) => r.includes("40/1") && r.includes("outside the image")));
});

test("auditEntries: a first sector the allocation map reports FREE is flagged, naming that it cannot really start there (sharper than a whole-track check)", () => {
  // Track 17 has sector 0 allocated but sector 5 free -- a whole-track-free
  // check (the replaced parser's own signature 3) would miss this; the
  // per-sector map catches it.
  const records = [{ name: "fake", blocks: 1, firstTrack: 17, firstSector: 5, nextDirTrack: 0, nextDirSector: 255 }];
  const { entries } = auditEntries(records, { bamAllocated: CLEAN_BAM });
  assert.equal(entries[0].suspicious, true);
  assert.ok(entries[0].suspicious_reasons.some((r) => r.includes("reported free") && r.includes("cannot really start there")));
});

test("auditEntries: an entry whose own directory record could not be read (entryFailed) is flagged, and a salvaged out-of-geometry track/sector still names itself", () => {
  const records = [
    { name: "tracer", blocks: 1, entryFailed: true, reason: "Error reading T:40 S:1 from disk image.", salvagedFirstTrack: 40, salvagedFirstSector: 1 },
  ];
  const { entries } = auditEntries(records, { bamAllocated: CLEAN_BAM });
  assert.equal(entries[0].suspicious, true);
  assert.equal(entries[0].first_track, 40);
  assert.equal(entries[0].first_sector, 1);
  assert.ok(entries[0].suspicious_reasons.some((r) => r.includes("40/1")));
});

test("auditEntries: two entries claiming the SAME first track/sector both get flagged with a chain error naming the repeated claim", () => {
  const records = [
    { name: "one", blocks: 1, firstTrack: 17, firstSector: 0, nextDirTrack: 0, nextDirSector: 255 },
    { name: "two", blocks: 1, firstTrack: 17, firstSector: 0, nextDirTrack: 0, nextDirSector: 255 },
  ];
  const { chain_error } = auditEntries(records, { bamAllocated: CLEAN_BAM });
  assert.match(chain_error, /same first track\/sector 17\/0/);
});

test("auditEntries: a next-directory pointer that refers back to the directory's own starting sector (18/1) is a chain error, and every remaining entry is still audited (never aborted early)", () => {
  const records = [
    { name: "one", blocks: 1, firstTrack: 17, firstSector: 0, nextDirTrack: 18, nextDirSector: 1 },
    { name: "two", blocks: 0, firstTrack: 17, firstSector: 1, nextDirTrack: 18, nextDirSector: 1 },
  ];
  const { entries, chain_error } = auditEntries(records, { bamAllocated: CLEAN_BAM });
  assert.match(chain_error, /revisited 18\/1/);
  assert.equal(entries.length, 2, "every remaining entry must still be audited after the first chain error is recorded");
  assert.equal(entries[1].suspicious, true, "entry two's OWN independent flag (0 blocks) must still be reported");
});

test("auditEntries: a repeated (non-starting) next-directory pointer is also a chain error, terminating in a bounded number of records regardless -- no unbounded loop is possible by construction", () => {
  const records = [
    { name: "a", blocks: 1, firstTrack: 17, firstSector: 0, nextDirTrack: 19, nextDirSector: 0 },
    { name: "b", blocks: 1, firstTrack: 17, firstSector: 1, nextDirTrack: 19, nextDirSector: 0 },
  ];
  const { chain_error, entries } = auditEntries(records, { bamAllocated: CLEAN_BAM });
  assert.match(chain_error, /revisited 19\/0/);
  assert.equal(entries.length, 2);
});

// ---------------------------------------------------------------------------
// Tier 2: LIVE, gated on c1541 actually being resolvable. CI has no VICE
// install (40-02/40-03's own SUMMARYs) -- this skips there, never fails.
// ---------------------------------------------------------------------------

function findC1541OnPath() {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const candidate = join(dir, "c1541");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const C1541_SKIP_REASON = findC1541OnPath() === null ? "c1541 is not resolvable on PATH -- audit's live seam calls are skipped" : false;

async function runAuditCli(imagePath, outDir) {
  const { stdout } = await execFileP(process.execPath, [SCRIPT, "audit", "--image", imagePath, "--out-dir", outDir, "--json"]);
  return JSON.parse(stdout.trim().split("\n").pop());
}

test("LIVE: audit against the committed clean fixture flags no entry", { skip: C1541_SKIP_REASON }, async () => {
  const outDir = mkdtempSync(join(tmpdir(), "c1541-audit-clean-"));
  try {
    const result = await runAuditCli(CLEAN_FIXTURE, outDir);
    assert.ok(result.entries.length > 0, "the clean fixture must report at least one entry");
    for (const e of result.entries) {
      assert.equal(e.suspicious, false, `"${e.name}" is flagged on the CLEAN fixture -- a false positive`);
    }
    assert.equal(result.chain_error, null);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test(
  "LIVE: audit against the committed corrupt fixture flags the out-of-geometry entry and reports a chain error, terminating within the process timeout",
  { skip: C1541_SKIP_REASON },
  async () => {
    const outDir = mkdtempSync(join(tmpdir(), "c1541-audit-corrupt-"));
    try {
      const result = await runAuditCli(CORRUPT_FIXTURE, outDir);
      const flagged = result.entries.find((e) => e.suspicious);
      assert.ok(flagged, "at least one entry must be flagged on the corrupt fixture");
      assert.ok(
        flagged.suspicious_reasons.some((r) => /outside the image/.test(r)),
        "the flagged entry's reason must name the out-of-geometry track/sector",
      );
      assert.match(result.chain_error, /revisited/, "a chain error must be reported, naming the repeated pointer");
      for (const e of result.entries) {
        assert.ok(e.suspicious_reasons.length > 0 || !e.suspicious, "a flagged entry must never carry an empty reason array");
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// Phase 40, plan 40-04 (Task 3, D-25): ONE assertion against a real,
// INDEPENDENTLY-produced release image -- the stated mitigation for the
// acknowledged circularity that every other fixture in this file was built
// by the very tool under test. Gated on the corpus image's presence, never
// on an opt-in env var (a checkout without the evidence tree stays green).
// ---------------------------------------------------------------------------

const CORPUS_SKIP_REASON = !existsSync(REAL_CORPUS_IMAGE)
  ? `the Phase 23 evidence corpus image is absent at ${REAL_CORPUS_IMAGE} -- this case is skipped, never failed, on a checkout without that evidence tree`
  : false;

test(
  "LIVE: a real, independently-produced release image (Phase 23's danish.d64) cross-validates the directory listing, one entry's first track/sector, and that entry's own sector chain against each other",
  { skip: CORPUS_SKIP_REASON },
  async () => {
    const outDir = mkdtempSync(join(tmpdir(), "c1541-corpus-"));
    try {
      const { stdout: dirStdout } = await execFileP(process.execPath, [SCRIPT, "dir", "--image", REAL_CORPUS_IMAGE, "--out-dir", outDir, "--json"]);
      const dirResponse = JSON.parse(dirStdout.trim());
      assert.equal(dirResponse.ok, true, dirResponse.ok ? "" : dirResponse.message);
      const dirText = readFileSync(dirResponse.results[0].path, "utf8");
      // A self-agreeing tool could not fail to produce its own trailer, but
      // this is still a real structural assertion about a real disk image
      // this project never authored.
      assert.match(dirText, /\d+\s+blocks free/i, "the directory listing must end in a numeric block-count trailer");

      const names = parseDirListing(dirText);
      assert.ok(names.length > 0, "the real corpus image must report at least one directory entry");
      const { name } = names[0];

      const { stdout: entryStdout } = await execFileP(process.execPath, [
        SCRIPT,
        "entry",
        "--image",
        REAL_CORPUS_IMAGE,
        "--name",
        name,
        "--out-dir",
        outDir,
        "--json",
      ]);
      const entryResponse = JSON.parse(entryStdout.trim());
      assert.equal(entryResponse.ok, true, entryResponse.ok ? "" : entryResponse.message);
      const fields = parseEntryFields(readFileSync(entryResponse.results[0].path, "utf8"));
      assert.ok(fields, "the entry response must carry a parseable T/S: line");
      const spt = sectorsPerTrack(fields.firstTrack);
      assert.ok(
        fields.firstTrack >= 1 && fields.firstTrack <= 35 && spt !== null && fields.firstSector >= 0 && fields.firstSector < spt,
        `entry "${name}"'s first track/sector ${fields.firstTrack}/${fields.firstSector} must resolve inside the image's own geometry`,
      );

      // The real cross-validation: two INDEPENDENT capabilities (the
      // directory entry's own claimed first track/sector, and that same
      // file's own sector-chain walk) must agree on the SAME real data --
      // something a tool that merely agrees with itself could not fake by
      // construction, since either capability could have diverged.
      const { stdout: chainStdout } = await execFileP(process.execPath, [
        SCRIPT,
        "chain",
        "--image",
        REAL_CORPUS_IMAGE,
        "--name",
        name,
        "--out-dir",
        outDir,
        "--json",
      ]);
      const chainResponse = JSON.parse(chainStdout.trim());
      assert.equal(chainResponse.ok, true, chainResponse.ok ? "" : chainResponse.message);
      const chainText = readFileSync(chainResponse.results[0].path, "utf8");
      const firstHop = chainText.match(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
      assert.ok(firstHop, "the sector chain must begin with a (track,sector) tuple");
      assert.equal(Number(firstHop[1]), fields.firstTrack, "the chain's first track must equal the entry's own claimed first track");
      assert.equal(Number(firstHop[2]), fields.firstSector, "the chain's first sector must equal the entry's own claimed first sector");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  },
);
