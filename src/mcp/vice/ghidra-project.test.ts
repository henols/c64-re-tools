// ghidra-project.test.ts
//
// Phase 34, plan 34-03, task 1: every case in ghidra-project.mts's own
// <behavior> block, as a case that can fail -- the dot-segment refusal
// (checking EVERY path segment, not just the leaf, per 34-RESEARCH.md
// Finding 2), the per-run project location, its idempotency refusal, and
// the argv builder's independent re-check.
//
// Extended, Task 3 (live finding): resolveGhidraProject() CREATES the run
// directory as the last step of a successful resolution -- real Ghidra
// 12.1.3 refuses a clean, well-formed project location that does not yet
// exist on disk (`Directory not found`, at `DefaultProjectManager.
// createProject()`; see evidence/34-ghidra-dotpath.md). Reservation-by-
// creation is what makes a second call under the SAME run id refused
// immediately, with no window where two callers could both see it absent.
//
// Imports the UNBUILT `.mts` source directly (the module has no sibling
// import -- only node:fs/node:path -- so the source resolves under native
// Node type-stripping with no build step first). This is what lets every
// case here run to completion with NO Ghidra installation present.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DOT_SEGMENT_REFUSAL,
  GHIDRA_RUNS_DIR_NAME,
  RUN_ID_PATTERN,
  hasDotPrefixedSegment,
  resolveGhidraProject,
  buildAnalyzeHeadlessArgv,
} from "./ghidra-project.mts";

const HERE = dirname(fileURLToPath(import.meta.url));

async function withTempDir<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "ghidra-project-test-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Install-free by construction -- the suite's own non-vacuity control.
// ---------------------------------------------------------------------------

test("ghidra-project.mts's own source text references no child-process call and no analyzeHeadless executable path -- this module is pure", () => {
  const source = readFileSync(join(HERE, "ghidra-project.mts"), "utf8");
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /\bspawn\s*\(/);
  assert.doesNotMatch(source, /\bexecFile\b/);
  // A path FRAGMENT naming the analyzeHeadless executable (e.g.
  // "support/analyzeHeadless" or "/analyzeHeadless") would mean this module
  // knows where the binary lives -- it must not; only host-tool.mts (Task 2)
  // resolves GHIDRA_HOME. Referring to `analyzeHeadless` in PROSE (this
  // module's own header comments explaining what it refuses before) is
  // fine and expected -- only a slash-joined path fragment is banned.
  assert.doesNotMatch(source, /[/\\]analyzeHeadless\b/, "no literal analyzeHeadless executable-path fragment");
});

// ---------------------------------------------------------------------------
// hasDotPrefixedSegment -- every path segment, not just the leaf (Finding 2)
// ---------------------------------------------------------------------------

test("hasDotPrefixedSegment: a clean absolute path with no dotted segment is not dotted", () => {
  const result = hasDotPrefixedSegment("/home/u/proj/tools/ghidra-runs/r1");
  assert.equal(result.dotted, false);
});

test("hasDotPrefixedSegment: a dot-prefixed LEAF directory is dotted, naming that segment", () => {
  const result = hasDotPrefixedSegment("/home/u/proj/tools/ghidra-runs/.dotdir");
  assert.equal(result.dotted, true);
  if (result.dotted) assert.equal(result.segment, ".dotdir");
});

test("hasDotPrefixedSegment: a dot-prefixed ANCESTOR two segments above a clean leaf is dotted, naming that ancestor segment -- Finding 2's whole discovery", () => {
  const result = hasDotPrefixedSegment("/home/u/.hidden/leafdir");
  assert.equal(result.dotted, true);
  if (result.dotted) assert.equal(result.segment, ".hidden");
});

test("hasDotPrefixedSegment: a trailing parent-directory segment ('..') is dotted -- it starts with '.' like any other name, no special-casing needed", () => {
  const result = hasDotPrefixedSegment("/home/u/proj/..");
  assert.equal(result.dotted, true);
  if (result.dotted) assert.equal(result.segment, "..");
});

test("hasDotPrefixedSegment: '/' is handled without throwing and reports no dotted segment", () => {
  assert.doesNotThrow(() => hasDotPrefixedSegment("/"));
  const result = hasDotPrefixedSegment("/");
  assert.equal(result.dotted, false);
});

test('hasDotPrefixedSegment: "" is handled without throwing and reports no dotted segment', () => {
  assert.doesNotThrow(() => hasDotPrefixedSegment(""));
  const result = hasDotPrefixedSegment("");
  assert.equal(result.dotted, false);
});

test("hasDotPrefixedSegment: a doubled separator produces an empty internal segment, which is skipped rather than misreported as dotted", () => {
  const result = hasDotPrefixedSegment("/home/u//proj/tools");
  assert.equal(result.dotted, false);
});

// ---------------------------------------------------------------------------
// resolveGhidraProject -- narrowing, the dot-segment refusal, idempotency
// ---------------------------------------------------------------------------

test("resolveGhidraProject: refuses a non-object input", () => {
  const result = resolveGhidraProject(null);
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses an unknown key BY NAME", () => {
  const result = resolveGhidraProject({ repoRoot: "/repo", runId: "r1", bogusKey: "x" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /bogusKey/);
});

test("resolveGhidraProject: refuses a non-string/absent repoRoot, never coerced", () => {
  const result = resolveGhidraProject({ repoRoot: 42, runId: "r1" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses a non-string/absent runId, never coerced", () => {
  const result = resolveGhidraProject({ repoRoot: "/repo" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: accepts a clean repoRoot and a well-shaped runId, returning ok:true with runsRoot/projectLocation/projectName", async () => {
  await withTempDir((dir) => {
    const result = resolveGhidraProject({ repoRoot: dir, runId: "r1" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.runsRoot, join(dir, "tools", GHIDRA_RUNS_DIR_NAME));
    assert.equal(result.projectLocation, join(dir, "tools", GHIDRA_RUNS_DIR_NAME, "r1"));
    assert.equal(result.projectName, "r1");
  });
});

test("resolveGhidraProject: CREATES the run directory as the last step of a successful resolution -- the reservation, not merely a computed path (live finding, Task 3: analyzeHeadless refuses a clean location that does not yet exist)", async () => {
  await withTempDir((dir) => {
    const result = resolveGhidraProject({ repoRoot: dir, runId: "created-run" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(existsSync(result.projectLocation), true, "resolveGhidraProject must create the project location it returns");
  });
});

test("resolveGhidraProject: refuses a repoRoot that itself contains a dot-prefixed segment, naming that segment -- rules out .vice-supervisor/ and .planning/ as ancestors", () => {
  const result = resolveGhidraProject({ repoRoot: "/home/u/.vice-supervisor/nested", runId: "r1" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /\.vice-supervisor/);
    assert.match(result.message, new RegExp(DOT_SEGMENT_REFUSAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("resolveGhidraProject: refuses a run id containing a path separator", () => {
  const result = resolveGhidraProject({ repoRoot: "/repo", runId: "a/b" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses a run id with a dot-prefixed component", () => {
  const result = resolveGhidraProject({ repoRoot: "/repo", runId: ".hidden" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses an empty run id", () => {
  const result = resolveGhidraProject({ repoRoot: "/repo", runId: "" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses a run id not matched by RUN_ID_PATTERN (disallowed character)", () => {
  assert.equal(RUN_ID_PATTERN.test("bad id!"), false);
  const result = resolveGhidraProject({ repoRoot: "/repo", runId: "bad id!" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses reusing an existing run directory under the SAME run id (idempotency) -- the FIRST call's own directory creation is what the second call sees and refuses, with no separate simulated run needed", async () => {
  await withTempDir((dir) => {
    const first = resolveGhidraProject({ repoRoot: dir, runId: "same-run" });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = resolveGhidraProject({ repoRoot: dir, runId: "same-run" });
    assert.equal(second.ok, false);
    if (!second.ok) assert.match(second.message, /reused|reuse/i);
  });
});

test("resolveGhidraProject: still refuses reuse even when a run's directory was created by an EARLIER, separate process (e.g. a completed prior run) rather than by this call's own reservation", async () => {
  await withTempDir((dir) => {
    const runsRoot = join(dir, "tools", "ghidra-runs");
    mkdirSync(join(runsRoot, "pre-existing-run"), { recursive: true });
    const result = resolveGhidraProject({ repoRoot: dir, runId: "pre-existing-run" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /reused|reuse/i);
  });
});

test("resolveGhidraProject: two DIFFERENT run ids produce disjoint project locations sharing only the runsRoot prefix -- no shared segment below it (concurrency)", async () => {
  await withTempDir((dir) => {
    const a = resolveGhidraProject({ repoRoot: dir, runId: "run-a" });
    const b = resolveGhidraProject({ repoRoot: dir, runId: "run-b" });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.notEqual(a.projectLocation, b.projectLocation);
    assert.equal(a.runsRoot, b.runsRoot);
    const aRel = a.projectLocation.slice(a.runsRoot.length);
    const bRel = b.projectLocation.slice(b.runsRoot.length);
    assert.notEqual(aRel, bRel);
  });
});

// ---------------------------------------------------------------------------
// buildAnalyzeHeadlessArgv -- positional order, -deleteProject, independent
// dot-segment re-check
// ---------------------------------------------------------------------------

test("buildAnalyzeHeadlessArgv: places projectLocation and projectName first, includes -import <importPath>, -processor <processor> and -deleteProject", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/tools/ghidra-runs/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
    processor: "6502:LE:16:nmos",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.argv[0], "/repo/tools/ghidra-runs/r1");
  assert.equal(result.argv[1], "r1");
  const importIdx = result.argv.indexOf("-import");
  assert.ok(importIdx !== -1);
  assert.equal(result.argv[importIdx + 1], "/repo/tools/ghidra-runs/r1/input.bin");
  const processorIdx = result.argv.indexOf("-processor");
  assert.ok(processorIdx !== -1);
  assert.equal(result.argv[processorIdx + 1], "6502:LE:16:nmos");
  assert.ok(result.argv.includes("-deleteProject"));
});

test('buildAnalyzeHeadlessArgv: refuses a missing "processor", naming the field and the accepted shape', () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/tools/ghidra-runs/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /processor/);
});

test('buildAnalyzeHeadlessArgv: refuses a "processor" that does not match LANGUAGE_ID_PATTERN', () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/tools/ghidra-runs/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
    processor: "not a language id",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /processor/);
});

test("buildAnalyzeHeadlessArgv: appends -preScript/-postScript in a fixed documented order when given", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/tools/ghidra-runs/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
    processor: "6502:LE:16:nmos",
    preScript: "Pre.java",
    postScript: "Post.java",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const preIdx = result.argv.indexOf("-preScript");
  const postIdx = result.argv.indexOf("-postScript");
  assert.ok(preIdx !== -1 && postIdx !== -1 && preIdx < postIdx);
  assert.equal(result.argv[preIdx + 1], "Pre.java");
  assert.equal(result.argv[postIdx + 1], "Post.java");
});

test("buildAnalyzeHeadlessArgv: refuses outright when projectLocation is dot-prefixed, even bypassing resolveGhidraProject entirely (T-34-14)", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/.hidden/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
    processor: "6502:LE:16:nmos",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /\.hidden/);
});

test("buildAnalyzeHeadlessArgv: refuses an unknown key BY NAME", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/tools/ghidra-runs/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
    bogusKey: "x",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /bogusKey/);
});

test("buildAnalyzeHeadlessArgv: refuses a non-string/empty required field, never coerced", () => {
  const result = buildAnalyzeHeadlessArgv({ projectLocation: "", projectName: "r1", importPath: "/repo/x" });
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// 34-07 (CR-02): the independent second-layer refusal for a
// preScript/postScript carrying a parent-directory path segment.
// ---------------------------------------------------------------------------

test("buildAnalyzeHeadlessArgv: refuses a preScript containing a parent-directory segment, naming the field, even when projectLocation is clean", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/tools/ghidra-runs/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
    processor: "6502:LE:16:nmos",
    preScript: "../x.java",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /preScript/);
    assert.match(result.message, /parent-directory/);
  }
});

test("buildAnalyzeHeadlessArgv: refuses a postScript containing a parent-directory segment, naming the field, even when projectLocation is clean", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/tools/ghidra-runs/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
    processor: "6502:LE:16:nmos",
    postScript: "../y.java",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /postScript/);
    assert.match(result.message, /parent-directory/);
  }
});

test("buildAnalyzeHeadlessArgv: a preScript containing merely TWO DOTS in the filename (not a parent-directory SEGMENT) is accepted -- a substring test would have misjudged this", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/tools/ghidra-runs/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
    processor: "6502:LE:16:nmos",
    preScript: "..foo.java",
  });
  assert.equal(result.ok, true);
});

test("buildAnalyzeHeadlessArgv: a bare Ghidra script name for preScript/postScript (no path separator) is still accepted -- the parent-directory-segment check does not require absoluteness", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/tools/ghidra-runs/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
    processor: "6502:LE:16:nmos",
    preScript: "Pre.java",
    postScript: "Post.java",
  });
  assert.equal(result.ok, true);
});

test("buildAnalyzeHeadlessArgv: is deterministic -- the same input yields two deepEqual argv arrays", () => {
  const input = {
    projectLocation: "/repo/tools/ghidra-runs/r1",
    projectName: "r1",
    importPath: "/repo/tools/ghidra-runs/r1/input.bin",
    processor: "6502:LE:16:nmos",
  };
  const first = buildAnalyzeHeadlessArgv(input);
  const second = buildAnalyzeHeadlessArgv(input);
  assert.deepEqual(first, second);
});
