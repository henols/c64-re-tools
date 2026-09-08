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
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, lstatSync, readlinkSync, symlinkSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DOT_SEGMENT_REFUSAL,
  GHIDRA_RUNS_HANDLE_NAME,
  GHIDRA_RUNS_HANDLE_TARGET,
  RUN_ID_PATTERN,
  hasDotPrefixedSegment,
  ghidraRunsRoot,
  ghidraRunsRealRoot,
  ensureGhidraRunsHandle,
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
  const result = hasDotPrefixedSegment("/home/u/proj/c64-re-tools/runs/ghidra/r1");
  assert.equal(result.dotted, false);
});

test("hasDotPrefixedSegment: a dot-prefixed LEAF directory is dotted, naming that segment", () => {
  const result = hasDotPrefixedSegment("/home/u/proj/c64-re-tools/runs/ghidra/.dotdir");
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
// ghidraRunsRoot / ghidraRunsRealRoot -- gap G-40-1 (plan 40-08). The ONE
// anchor case in this file that pins both literal shapes by hand rather than
// deriving them from the functions under test, so this suite cannot become
// vacuous. Every OTHER expectation in this file derives from these two
// functions instead of re-joining the segments itself.
// ---------------------------------------------------------------------------

test("ghidraRunsRoot()/ghidraRunsRealRoot(): pin the literal handle and physical-target shapes by hand", () => {
  const root = "/synthetic-repo-root";
  const expectedHandle = join(root, "c64-re-tools", "runs", "ghidra");
  const expectedReal = join(root, ".c64-re-tools", "runs", "ghidra");
  assert.equal(
    ghidraRunsRoot(root),
    expectedHandle,
    `the Ghidra runs location moved (gap G-40-1) -- expected the HANDLE at ${expectedHandle}, with the PHYSICAL root at ${expectedReal}`,
  );
  assert.equal(
    ghidraRunsRealRoot(root),
    expectedReal,
    `the Ghidra runs location moved (gap G-40-1) -- expected the PHYSICAL root at ${expectedReal}, reached through the HANDLE at ${expectedHandle}`,
  );
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

test("resolveGhidraProject: accepts a clean repoRoot and a well-shaped runId, returning ok:true with runsRoot/projectLocation/projectName derived from ghidraRunsRoot()", async () => {
  await withTempDir((dir) => {
    const result = resolveGhidraProject({ repoRoot: dir, runId: "r1" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.runsRoot, ghidraRunsRoot(dir));
    assert.equal(result.projectLocation, join(ghidraRunsRoot(dir), "r1"));
    assert.equal(result.projectName, "r1");
  });
});

test("resolveGhidraProject: an ok result lands the run directory PHYSICALLY under ghidraRunsRealRoot() -- the D-33 truth this whole plan exists for -- and remains reachable through ghidraRunsRoot() (the handle)", async () => {
  await withTempDir((dir) => {
    const result = resolveGhidraProject({ repoRoot: dir, runId: "physical-landing" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      existsSync(join(ghidraRunsRealRoot(dir), "physical-landing")),
      true,
      "the run directory must land physically under ghidraRunsRealRoot(), not merely be reachable through the handle",
    );
    assert.equal(existsSync(join(ghidraRunsRoot(dir), "physical-landing")), true, "the run directory must also be reachable through ghidraRunsRoot() (the handle)");
    assert.equal(result.projectLocation, join(ghidraRunsRoot(dir), "physical-landing"));
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

test("resolveGhidraProject: refuses a repoRoot that itself contains a dot-prefixed segment, naming that segment -- rules out .vice-supervisor/ and .planning/ as ancestors -- and creates NOTHING on disk (the dot check runs before any filesystem write)", async () => {
  await withTempDir((dir) => {
    const repoRoot = join(dir, ".vice-supervisor", "nested");
    const result = resolveGhidraProject({ repoRoot, runId: "r1" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /\.vice-supervisor/);
      assert.match(result.message, new RegExp(DOT_SEGMENT_REFUSAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    assert.deepEqual(readdirSync(dir), [], "a refused dot-prefixed repoRoot must create nothing on disk under the temp root -- no handle, no physical tree, nothing");
  });
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

test("resolveGhidraProject: still refuses reuse even when a run's directory was created by an EARLIER, separate process (e.g. a completed prior run) rather than by this call's own reservation -- pre-created PHYSICALLY under ghidraRunsRealRoot(), never through the handle, proving the resolver sees through it", async () => {
  await withTempDir((dir) => {
    mkdirSync(join(ghidraRunsRealRoot(dir), "pre-existing-run"), { recursive: true });
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
// ensureGhidraRunsHandle -- gap G-40-1 (plan 40-08). Mints/verifies the
// broker-owned symlink handle; never repairs a wrong or foreign handle.
// ---------------------------------------------------------------------------

test("ensureGhidraRunsHandle: refuses a non-string/empty repoRoot, naming the offending value", () => {
  for (const bad of [42, null, undefined, ""] as const) {
    const result = ensureGhidraRunsHandle(bad);
    assert.equal(result.ok, false, `expected a refusal for repoRoot=${JSON.stringify(bad)}`);
  }
});

test("ensureGhidraRunsHandle: on a clean temp root, creates the physical runs tree AND mints the handle -- a symbolic link whose target is exactly the relative string", async () => {
  await withTempDir((dir) => {
    const result = ensureGhidraRunsHandle(dir);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const handlePath = join(dir, GHIDRA_RUNS_HANDLE_NAME);
    assert.equal(result.handle, handlePath);
    assert.equal(result.target, GHIDRA_RUNS_HANDLE_TARGET);
    assert.equal(existsSync(ghidraRunsRealRoot(dir)), true, "the physical runs tree must exist");
    const stat = lstatSync(handlePath);
    assert.equal(stat.isSymbolicLink(), true, "the handle must be a symbolic link");
    assert.equal(readlinkSync(handlePath), GHIDRA_RUNS_HANDLE_TARGET, "the link target must be exactly the relative string, never absolute");
  });
});

test("ensureGhidraRunsHandle: called a second time on the same root returns ok unchanged -- fully idempotent, the existing link untouched", async () => {
  await withTempDir((dir) => {
    const first = ensureGhidraRunsHandle(dir);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const handlePath = join(dir, GHIDRA_RUNS_HANDLE_NAME);
    const targetBefore = readlinkSync(handlePath);
    const second = ensureGhidraRunsHandle(dir);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.handle, first.handle);
    assert.equal(second.target, first.target);
    assert.equal(readlinkSync(handlePath), targetBefore, "the existing link must be untouched by the second, idempotent call");
  });
});

test("ensureGhidraRunsHandle: refuses when a REAL DIRECTORY already sits at the handle path, naming the handle and that it is a directory -- and never repairs it", async () => {
  await withTempDir((dir) => {
    const handlePath = join(dir, GHIDRA_RUNS_HANDLE_NAME);
    mkdirSync(handlePath, { recursive: true });
    writeFileSync(join(handlePath, "sentinel.txt"), "untouched", "utf8");
    const result = ensureGhidraRunsHandle(dir);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, new RegExp(GHIDRA_RUNS_HANDLE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the refusal must name the handle path");
      assert.match(result.message, /directory/i, "the refusal must name what was found");
    }
    const stat = lstatSync(handlePath);
    assert.equal(stat.isDirectory(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(existsSync(join(handlePath, "sentinel.txt")), true, "ensureGhidraRunsHandle must NEVER delete, replace, or repair what it finds");
  });
});

test("ensureGhidraRunsHandle: refuses when a symlink at the handle path points somewhere else -- including an ABSOLUTE path to the otherwise-correct real directory -- naming the found and expected targets, and never repairs it", async () => {
  await withTempDir((dir) => {
    const handlePath = join(dir, GHIDRA_RUNS_HANDLE_NAME);
    mkdirSync(ghidraRunsRealRoot(dir), { recursive: true });
    const wrongTarget = join(dir, GHIDRA_RUNS_HANDLE_TARGET); // absolute -- wrong even though it names the correct real directory
    symlinkSync(wrongTarget, handlePath);
    const result = ensureGhidraRunsHandle(dir);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, new RegExp(wrongTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the refusal must name the found (wrong) target");
      assert.match(result.message, new RegExp(GHIDRA_RUNS_HANDLE_TARGET.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the refusal must name the expected target");
      assert.match(result.message, /absolute/i, "the refusal must state that an absolute target breaks the container route");
    }
    const stat = lstatSync(handlePath);
    assert.equal(stat.isSymbolicLink(), true);
    assert.equal(readlinkSync(handlePath), wrongTarget, "the wrong-target link must be untouched -- NEVER repaired");
  });
});

test("ensureGhidraRunsHandle: refuses when a plain FILE sits at the handle path, naming what was found -- and never repairs it", async () => {
  await withTempDir((dir) => {
    const handlePath = join(dir, GHIDRA_RUNS_HANDLE_NAME);
    writeFileSync(handlePath, "not a link", "utf8");
    const result = ensureGhidraRunsHandle(dir);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, new RegExp(GHIDRA_RUNS_HANDLE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the refusal must name the handle path");
      assert.match(result.message, /file/i, "the refusal must name what was found");
    }
    const stat = lstatSync(handlePath);
    assert.equal(stat.isFile(), true);
    assert.equal(readFileSync(handlePath, "utf8"), "not a link", "ensureGhidraRunsHandle must NEVER delete, replace, or repair what it finds");
  });
});

test("resolveGhidraProject: propagates an ensureGhidraRunsHandle() refusal without creating anything -- the regression test for the silent-violation hole where a missing/wrong handle let recursive mkdir materialise a second root", async () => {
  await withTempDir((dir) => {
    const handlePath = join(dir, GHIDRA_RUNS_HANDLE_NAME);
    mkdirSync(handlePath, { recursive: true });
    const result = resolveGhidraProject({ repoRoot: dir, runId: "should-never-exist" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, new RegExp(GHIDRA_RUNS_HANDLE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the propagated refusal must name the handle path");
    }
    assert.equal(
      existsSync(join(handlePath, "runs", "ghidra", "should-never-exist")),
      false,
      "no run directory may appear under the unverified handle path -- this is the exact hole T-40-08-02 closes",
    );
    assert.equal(existsSync(join(ghidraRunsRealRoot(dir), "should-never-exist")), false, "no run directory may appear under the physical root either");
  });
});

// ---------------------------------------------------------------------------
// buildAnalyzeHeadlessArgv -- positional order, -deleteProject, independent
// dot-segment re-check
// ---------------------------------------------------------------------------

test("buildAnalyzeHeadlessArgv: places projectLocation and projectName first, includes -import <importPath>, -processor <processor>, -loader BinaryLoader, -loader-baseAddr and -deleteProject", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.argv[0], "/repo/c64-re-tools/runs/ghidra/r1");
  assert.equal(result.argv[1], "r1");
  const importIdx = result.argv.indexOf("-import");
  assert.ok(importIdx !== -1);
  assert.equal(result.argv[importIdx + 1], "/repo/c64-re-tools/runs/ghidra/r1/input.bin");
  const processorIdx = result.argv.indexOf("-processor");
  assert.ok(processorIdx !== -1);
  assert.equal(result.argv[processorIdx + 1], "6502:LE:16:nmos");
  const loaderIdx = result.argv.indexOf("-loader");
  assert.ok(loaderIdx !== -1);
  assert.equal(result.argv[loaderIdx + 1], "BinaryLoader");
  const baseAddrIdx = result.argv.indexOf("-loader-baseAddr");
  assert.ok(baseAddrIdx !== -1);
  assert.equal(result.argv[baseAddrIdx + 1], "0x0");
  assert.ok(result.argv.includes("-deleteProject"));
  assert.equal(result.argv[result.argv.length - 1], "-deleteProject");
});

test('buildAnalyzeHeadlessArgv: refuses a missing "processor", naming the field and the accepted shape', () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /processor/);
});

test('buildAnalyzeHeadlessArgv: refuses a "processor" that does not match LANGUAGE_ID_PATTERN', () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "not a language id",
    loaderBaseAddr: "0x0",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /processor/);
});

test('buildAnalyzeHeadlessArgv: refuses a "loaderBaseAddr" that does not match LOADER_BASE_ADDR_PATTERN', () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0X0",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /loaderBaseAddr/);
});

test("buildAnalyzeHeadlessArgv: appends -preScript/-postScript in a fixed documented order when given", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
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
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /\.hidden/);
});

test("buildAnalyzeHeadlessArgv: refuses an unknown key BY NAME", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
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
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
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
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
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
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
    preScript: "..foo.java",
  });
  assert.equal(result.ok, true);
});

test("buildAnalyzeHeadlessArgv: a bare Ghidra script name for preScript/postScript (no path separator) is still accepted -- the parent-directory-segment check does not require absoluteness", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
    preScript: "Pre.java",
    postScript: "Post.java",
  });
  assert.equal(result.ok, true);
});

test("buildAnalyzeHeadlessArgv: is deterministic -- the same input yields two deepEqual argv arrays", () => {
  const input = {
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
  };
  const first = buildAnalyzeHeadlessArgv(input);
  const second = buildAnalyzeHeadlessArgv(input);
  assert.deepEqual(first, second);
});

// ---------------------------------------------------------------------------
// Phase 36, plan 36-02 (Task 3): the seven new fields' own second-layer
// refusals in buildAnalyzeHeadlessArgv() itself -- independent of
// host-tool.mts's own normaliseHostToolRequest() checks, exactly as the
// processor/dot-segment/parent-segment re-checks already are -- plus the
// full pinned argv for both import routes.
// ---------------------------------------------------------------------------

test('buildAnalyzeHeadlessArgv: refuses a "noanalysis" that is not a boolean, independently of host-tool.mts\'s own check', () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
    noanalysis: "true",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /noanalysis/);
});

test('buildAnalyzeHeadlessArgv: refuses an "expectedClassificationLines" that is not a non-negative integer, independently of host-tool.mts\'s own check', () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
    postScript: "Post.java",
    exportPath: "/repo/out.txt",
    expectedClassificationLines: -1,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /expectedClassificationLines/);
});

test('buildAnalyzeHeadlessArgv: refuses "entrypointsPath" without "preScript", independently of host-tool.mts\'s own check', () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
    entrypointsPath: "/repo/entry.txt",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /entrypointsPath/);
    assert.match(result.message, /preScript/);
  }
});

test('buildAnalyzeHeadlessArgv: refuses "exportPath" without "postScript", independently of host-tool.mts\'s own check', () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
    exportPath: "/repo/out.txt",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /exportPath/);
    assert.match(result.message, /postScript/);
  }
});

test('buildAnalyzeHeadlessArgv: refuses "expectedClassificationLines" without "exportPath" -- it is the export script\'s own SECOND argument', () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
    postScript: "Post.java",
    expectedClassificationLines: 3,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /expectedClassificationLines/);
});

test('buildAnalyzeHeadlessArgv: refuses a "scriptPath"/"entrypointsPath"/"exportPath" containing a parent-directory segment, naming the field', () => {
  for (const key of ["scriptPath", "entrypointsPath", "exportPath"] as const) {
    const input: Record<string, unknown> = {
      projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
      projectName: "r1",
      importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.bin",
      processor: "6502:LE:16:nmos",
      loaderBaseAddr: "0x0",
    };
    if (key === "entrypointsPath") input.preScript = "Pre.java";
    if (key === "exportPath") input.postScript = "Post.java";
    input[key] = "../escape";
    const result = buildAnalyzeHeadlessArgv(input);
    assert.equal(result.ok, false, `${key}: expected a refusal`);
    if (!result.ok) {
      assert.match(result.message, new RegExp(key), `${key}: message must name the field`);
      assert.match(result.message, /parent-directory/, `${key}: message must name the parent-directory rule`);
    }
  }
});

test("buildAnalyzeHeadlessArgv: the full prg-route argv is pinned by deep equality against the expected literal array, and no entry contains a space", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r1",
    projectName: "r1",
    importPath: "/repo/c64-re-tools/runs/ghidra/r1/input.prg",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x801",
    noanalysis: true,
    scriptPath: "/repo/scripts",
    preScript: "VolatileCarve.java",
    entrypointsPath: "/repo/entry.txt",
    postScript: "GhidraStructExport.java",
    exportPath: "/repo/out.txt",
    expectedClassificationLines: 42,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.argv, [
    "/repo/c64-re-tools/runs/ghidra/r1",
    "r1",
    "-import",
    "/repo/c64-re-tools/runs/ghidra/r1/input.prg",
    "-processor",
    "6502:LE:16:nmos",
    "-loader",
    "BinaryLoader",
    "-loader-baseAddr",
    "0x801",
    "-noanalysis",
    "-scriptPath",
    "/repo/scripts",
    "-preScript",
    "VolatileCarve.java",
    "/repo/entry.txt",
    "-postScript",
    "GhidraStructExport.java",
    "/repo/out.txt",
    "42",
    "-deleteProject",
  ]);
  assert.ok(
    result.argv.every((entry) => !entry.includes(" ")),
    "no argv entry may contain a space character",
  );
  assert.equal(result.argv[result.argv.length - 1], "-deleteProject");
});

test("buildAnalyzeHeadlessArgv: the full flat64k-route argv is pinned by deep equality against the expected literal array, and no entry contains a space", () => {
  const result = buildAnalyzeHeadlessArgv({
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r2",
    projectName: "r2",
    importPath: "/repo/c64-re-tools/runs/ghidra/r2/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
    noanalysis: true,
    scriptPath: "/repo/scripts",
    preScript: "VolatileCarve.java",
    entrypointsPath: "/repo/entry.txt",
    postScript: "GhidraStructExport.java",
    exportPath: "/repo/out.txt",
    expectedClassificationLines: 7,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.argv, [
    "/repo/c64-re-tools/runs/ghidra/r2",
    "r2",
    "-import",
    "/repo/c64-re-tools/runs/ghidra/r2/input.bin",
    "-processor",
    "6502:LE:16:nmos",
    "-loader",
    "BinaryLoader",
    "-loader-baseAddr",
    "0x0",
    "-noanalysis",
    "-scriptPath",
    "/repo/scripts",
    "-preScript",
    "VolatileCarve.java",
    "/repo/entry.txt",
    "-postScript",
    "GhidraStructExport.java",
    "/repo/out.txt",
    "7",
    "-deleteProject",
  ]);
  assert.ok(
    result.argv.every((entry) => !entry.includes(" ")),
    "no argv entry may contain a space character",
  );
  assert.equal(result.argv[result.argv.length - 1], "-deleteProject");
});

test("buildAnalyzeHeadlessArgv: is deterministic with every new field populated -- two calls with identical input return deeply equal argv arrays", () => {
  const input = {
    projectLocation: "/repo/c64-re-tools/runs/ghidra/r3",
    projectName: "r3",
    importPath: "/repo/c64-re-tools/runs/ghidra/r3/input.bin",
    processor: "6502:LE:16:nmos",
    loaderBaseAddr: "0x0",
    noanalysis: true,
    scriptPath: "/repo/scripts",
    preScript: "Pre.java",
    entrypointsPath: "/repo/entry.txt",
    postScript: "Post.java",
    exportPath: "/repo/out.txt",
    expectedClassificationLines: 3,
  };
  const first = buildAnalyzeHeadlessArgv(input);
  const second = buildAnalyzeHeadlessArgv(input);
  assert.deepEqual(first, second);
});
