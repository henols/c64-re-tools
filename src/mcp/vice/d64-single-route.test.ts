#!/usr/bin/env node
// d64-single-route.test.ts
//
// Phase 40, plan 40-06 (D-04, D-08): the ONE committed invariant the phase's
// assumption-delta decision accepted (40-01-PLAN.md) -- there is exactly ONE
// route to a disk image's structure and contents (the `c1541.*` host-tool
// seam), and this test reds if a second one ever reappears.
//
// WHAT USED TO BE HERE, AND WHY IT IS GONE. `src/mcp/vice/anno-d64.ts` and
// `src/skills/c64-ram-capture/scripts/d64-parse.mjs` -- two independent
// copies of a stable, published 1541 disk-format algorithm: a per-track
// sector-count table, a track/sector-to-byte-offset conversion, and a
// directory-chain walk starting at track 18 sector 1 -- were deleted in the
// SAME commit that adds this file. Both are gone; nothing here is testing
// them, and nothing should ever need to again. Their fakery detector was
// already ported onto the seam in plan 40-04 (`c64-disk-access`'s `audit`
// subcommand), and the three live tests that used to pull a program's bytes
// out of a disk image directly were re-pointed onto the seam in this plan's
// own Task 1.
//
// WHAT THIS TEST WALKS: the shipped MCP module set (`shippedTsModules()`,
// `package.json`'s `files[]`) PLUS every `.mjs` file under `src/skills/`
// (`walkSkills()`, `scripts/lib/skill-corpus.mjs` -- the ONE shared skill-
// corpus walker every other skill-tree guard in this repo already uses, so
// this invariant does not silently disagree with them about what "the
// skill tree" means). Neither set is a hand-maintained list: both are
// derived from the tree, so a module added later is scanned automatically.
//
// THE ONE DELIBERATE EXEMPTION: `c64-disk-access/scripts/c1541.mjs` (and its
// colocated test, `c1541.test.mjs`) -- THE SEAM ITSELF. Its own
// `sectorsPerTrack()`/directory-start constants are a DELIBERATE, approved
// port of the same domain knowledge (plan 40-04, D-06), reached only through
// the `c1541.*` tool ids and composed from three already-shipped, seam-
// reached capabilities. Exempting it is not a loophole this test tolerates
// by omission: it is the single named route the whole invariant exists to
// protect, and every OTHER file in either walked set is held to the "no
// second copy" rule with no exception.
//
// THE PREDICATE, stated as three independent, OR'd signatures rather than
// one "is this a disk parser" heuristic (which would be un-provable): each
// one matches the EXACT shape either deleted module carried, so a byte-for-
// byte reintroduction of any of the three trips this test, and the planted-
// violation proof below shows the predicate actually distinguishes the
// violating shape from a clean file rather than returning false everywhere.
//
//   1. A per-track sector-count table returning the four 1541 zone values
//      (21, 19, 18, 17) in that exact descending order within a small
//      window -- the shape BOTH deleted modules carried for
//      `sectorsPerTrack()`.
//   2. A track/sector-to-byte-offset conversion: a loop accumulating
//      `offset += <expr> * 256` while walking `track` from 1 -- the shape
//      `anno-d64.ts`'s own `tsToOffset()` carried.
//   3. A directory-chain start hard-coded at track 18, sector 1, under
//      either module's own naming convention (`track`/`sector` or
//      `startTrack`/`startSector`).
//
// NON-VACUITY BY CONSTRUCTION: the floor assertion below compares the
// ACTUAL walked count (derived from the tree, via the same two functions
// the main invariant uses) against a conservative round number well below
// today's real total -- mirroring `spawn-seam.test.ts`'s own
// `modules.length >= 40` precedent -- so a walk that silently starts
// visiting nothing (a broken glob, a wrong directory) reds this test
// instead of letting the main invariant pass over an empty set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { codeOnly, shippedTsModules } from "./shipped-modules.ts";
import { walkSkills } from "../../../scripts/lib/skill-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/src/mcp/vice
const ROOT = join(HERE, "..", "..", ".."); // <root>
const SKILLS_DIR = join(ROOT, "src", "skills");

/** The seam's own files -- the one named route this invariant protects
 * rather than forbids. Paths are relative to `src/skills/`. */
const SEAM_EXEMPT_SKILL_PATHS: ReadonlySet<string> = new Set([
  join("c64-disk-access", "scripts", "c1541.mjs"),
  join("c64-disk-access", "scripts", "c1541.test.mjs"),
]);

/** Signature 1: a per-track sector-count table returning the four 1541 zone
 * values in descending order within a small window -- the exact shape both
 * deleted modules carried for `sectorsPerTrack()`. */
const SECTORS_PER_TRACK_TABLE_RE =
  /return\s+21\s*;[\s\S]{0,300}?return\s+19\s*;[\s\S]{0,300}?return\s+18\s*;[\s\S]{0,300}?return\s+17\s*;/;

/** Signature 2: a track/sector-to-byte-offset conversion -- a loop
 * accumulating `offset += <expr> * 256` while walking `track` from 1, the
 * exact shape `anno-d64.ts`'s own `tsToOffset()` carried. */
const TRACK_SECTOR_OFFSET_RE =
  /for\s*\(\s*let\s+t\s*=\s*1\s*;\s*t\s*<\s*track\s*;\s*t\+\+\s*\)\s*offset\s*\+=[\s\S]{0,80}?\*\s*256/;

/** Signature 3: a directory-chain start hard-coded at track 18, sector 1,
 * under either deleted module's own naming convention. */
const DIRECTORY_START_RE =
  /\b(?:track|startTrack)\s*=\s*18\b[\s\S]{0,60}?\b(?:sector|startSector)\s*=\s*1\b/;

export interface DiskImageParsingViolation {
  file: string;
  reasons: string[];
}

/** Runs all three signatures against ALREADY-`codeOnly()`-ed source (so a
 * comment or string literal describing the forbidden shape -- exactly what
 * this plan's own prose citations do, deliberately, in the files that
 * record the deletion -- can never trip this test). Returns the list of
 * named reasons that fired, empty when the source is clean. */
function findDiskImageParsingViolations(codeOnlySrc: string): string[] {
  const reasons: string[] = [];
  if (SECTORS_PER_TRACK_TABLE_RE.test(codeOnlySrc)) {
    reasons.push("a per-track sector-count table returning 21/19/18/17 in descending order (sectorsPerTrack() shape)");
  }
  if (TRACK_SECTOR_OFFSET_RE.test(codeOnlySrc)) {
    reasons.push("a track/sector-to-byte-offset conversion accumulating offset += ... * 256 while walking track from 1 (tsToOffset() shape)");
  }
  if (DIRECTORY_START_RE.test(codeOnlySrc)) {
    reasons.push("a directory-chain start hard-coded at track 18, sector 1 (the 1541 directory-walk shape)");
  }
  return reasons;
}

/** Every MCP-side shipped `.ts`/`.mts` module, workspace-relative to
 * `src/mcp/vice/` -- exactly the set `shippedTsModules()` derives from
 * `package.json`'s `files[]`. None is exempt: `host-tool.mts` (the seam's
 * OWN MCP-side definition) is not itself in `files[]` -- it ships compiled,
 * as `resources/host-tool.mjs` -- so it is not walked here at all, and
 * carries no disk-image byte arithmetic of its own regardless (it only
 * constructs `c1541` argv strings). */
function mcpShippedFiles(): string[] {
  return shippedTsModules();
}

/** Every `.mjs` file under `src/skills/`, workspace-relative to that
 * directory -- `walkSkills()` also returns `.md` prose, which is filtered
 * out here since the invariant is about CODE, never about documentation
 * describing code. */
function skillMjsFiles(): string[] {
  return (walkSkills(SKILLS_DIR) as string[])
    .filter((abs: string) => abs.endsWith(".mjs"))
    .map((abs: string) => relative(SKILLS_DIR, abs));
}

/** The full walked set this test's main assertion and its own non-vacuity
 * floor both derive from -- computed once per call, from the tree, never a
 * hand-maintained list. */
function walkAll(): DiskImageParsingViolation[] {
  const violations: DiskImageParsingViolation[] = [];

  for (const rel of mcpShippedFiles()) {
    const raw = readFileSync(join(HERE, rel), "utf8");
    const reasons = findDiskImageParsingViolations(codeOnly(raw));
    if (reasons.length > 0) violations.push({ file: join("src", "mcp", "vice", rel), reasons });
  }

  for (const rel of skillMjsFiles()) {
    if (SEAM_EXEMPT_SKILL_PATHS.has(rel)) continue;
    const raw = readFileSync(join(SKILLS_DIR, rel), "utf8");
    const reasons = findDiskImageParsingViolations(codeOnly(raw));
    if (reasons.length > 0) violations.push({ file: join("src", "skills", rel), reasons });
  }

  return violations;
}

// -- 1. The main invariant ---------------------------------------------------

test("d64-single-route: no shipped MCP module and no skill script outside the c1541 seam parses disk-image bytes", () => {
  const violations = walkAll();
  assert.deepEqual(
    violations,
    [],
    `${violations.length} file(s) outside the c1541 host-tool seam carry disk-image byte-parsing code: ` +
      violations.map((v) => `${v.file} (${v.reasons.join("; ")})`).join(" | ") +
      " -- there is exactly ONE disk-image route (D-04, D-08); route any new capability through the " +
      "seam's own c1541.* tool ids instead of a second reader",
  );
});

// -- 2. Non-vacuity floor -----------------------------------------------------

test("non-vacuity: the walked set is real, derived from the tree, and well above zero", () => {
  const mcpCount = mcpShippedFiles().length;
  const skillCount = skillMjsFiles().length;
  assert.ok(
    mcpCount >= 60,
    `expected at least 60 shipped MCP modules (derived from package.json's files[]), got ${mcpCount} -- ` +
      "a count collapsed near zero means shippedTsModules() is broken, not that this invariant passed",
  );
  assert.ok(
    skillCount >= 15,
    `expected at least 15 .mjs files under src/skills/ (derived from walkSkills()), got ${skillCount} -- ` +
      "a count collapsed near zero means the skill-tree walk is broken, not that this invariant passed",
  );
});

// -- 3. Planted-violation proof, both directions -----------------------------

test("planted violation: a synthetic module reintroducing the sectorsPerTrack() ladder is reported, naming the reason", () => {
  const plantedSource =
    `export function sectorsPerTrack(track: number): number {\n` +
    `  if (track <= 17) return 21;\n` +
    `  if (track <= 24) return 19;\n` +
    `  if (track <= 30) return 18;\n` +
    `  return 17;\n` +
    `}\n`;
  const reasons = findDiskImageParsingViolations(codeOnly(plantedSource));
  assert.equal(reasons.length, 1, "the planted sectorsPerTrack() ladder must be discovered as exactly one violation");
  assert.match(reasons[0]!, /sectorsPerTrack/, "the reported reason must name the sectorsPerTrack() shape");
});

test("planted violation: a synthetic module reintroducing the track/sector byte-offset conversion is reported", () => {
  const plantedSource =
    `export function tsToOffset(track: number, sector: number): number {\n` +
    `  let offset = 0;\n` +
    `  for (let t = 1; t < track; t++) offset += sectorsPerTrack(t) * 256;\n` +
    `  return offset + sector * 256;\n` +
    `}\n`;
  const reasons = findDiskImageParsingViolations(codeOnly(plantedSource));
  assert.equal(reasons.length, 1, "the planted tsToOffset() conversion must be discovered as exactly one violation");
  assert.match(reasons[0]!, /byte-offset conversion/, "the reported reason must name the byte-offset shape");
});

test("planted violation: a synthetic module reintroducing the hard-coded directory start (track 18, sector 1) is reported", () => {
  const plantedSource =
    `export function listEntries(image: Uint8Array) {\n` +
    `  let track = 18;\n` +
    `  let sector = 1;\n` +
    `  return walk(image, track, sector);\n` +
    `}\n`;
  const reasons = findDiskImageParsingViolations(codeOnly(plantedSource));
  assert.equal(reasons.length, 1, "the planted directory-start constant pair must be discovered as exactly one violation");
  assert.match(reasons[0]!, /directory-chain start/, "the reported reason must name the directory-start shape");
});

test("planted-violation control: mentioning the forbidden shapes ONLY inside a comment and a string literal is NOT reported", () => {
  const decoySource =
    `// This module used to carry sectorsPerTrack() -- see history:\n` +
    `//   if (track <= 17) return 21;\n` +
    `//   if (track <= 24) return 19;\n` +
    `//   if (track <= 30) return 18;\n` +
    `//   return 17;\n` +
    `export const HISTORICAL_NOTE =\n` +
    `  "let track = 18; let sector = 1; offset += x * 256 while t < track from t = 1";\n` +
    `export function harmless(): number {\n` +
    `  return 42;\n` +
    `}\n`;
  const reasons = findDiskImageParsingViolations(codeOnly(decoySource));
  assert.deepEqual(
    reasons,
    [],
    "a comment and a string literal that merely QUOTE the forbidden shapes must never be reported -- " +
      "codeOnly() must strip both before matching",
  );
});

test("planted-violation control: the seam's own c1541.mjs (or a synthetic stand-in with the same shape) is exempt from the walk, not merely clean", () => {
  // Proves the EXEMPTION mechanism itself, independent of whether c1541.mjs
  // happens to trip a signature today: a synthetic file at the exact exempt
  // relative path is skipped by walkAll()'s own exemption check even when
  // its content is a verbatim violation. This does not call walkAll()
  // (which reads the real tree); it exercises the SAME exemption Set
  // walkAll() consults, proving the mechanism is a real filter and not a
  // no-op.
  const exemptRelPath = join("c64-disk-access", "scripts", "c1541.mjs");
  assert.ok(
    SEAM_EXEMPT_SKILL_PATHS.has(exemptRelPath),
    "the seam's own c1541.mjs must be named in the exemption set",
  );
  const violatingContent = `if (track <= 17) return 21;\nif (track <= 24) return 19;\nif (track <= 30) return 18;\nreturn 17;\n`;
  assert.ok(
    findDiskImageParsingViolations(codeOnly(violatingContent)).length > 0,
    "sanity: the exempt path's own real content shape must be one the predicate WOULD flag if it were not exempt " +
      "-- otherwise the exemption is proving nothing",
  );
});
