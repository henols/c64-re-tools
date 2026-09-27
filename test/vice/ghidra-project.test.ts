// ghidra-project.test.ts
//
// Phase 34, plan 34-03, task 1: every case in ghidra-project.mts's own
// <behavior> block, as a case that can fail -- the dot-segment refusal
// (checking EVERY path segment, not just the leaf, per 34-RESEARCH.md
// Finding 2), the per-run project location, and
// the argv builder's independent re-check.
//
// resolveGhidraProject() CREATES a fresh run directory: real Ghidra 12.1.3
// refuses a clean, well-formed project location that does not yet exist on
// disk (`Directory not found`, at `DefaultProjectManager.createProject()`).
//
// Imports the UNBUILT `.mts` source directly (the module has no sibling
// import -- only node:fs/node:path -- so the source resolves under native
// Node type-stripping with no build step first). This is what lets every
// case here run to completion with NO Ghidra installation present.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import {
  DOT_SEGMENT_REFUSAL,
  RUN_ID_PATTERN,
  hasDotPrefixedSegment,
  resolveGhidraProject,
  buildAnalyzeHeadlessArgv,
} from "../../src/mcp/vice/ghidra-project.mts";
import { VICE_DIR } from "./paths.ts";


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
  const source = readFileSync(join(VICE_DIR, "ghidra-project.mts"), "utf8");
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
// resolveGhidraProject -- narrowing, the dotted-root refusal, one fresh
// directory per run
// ---------------------------------------------------------------------------

test("resolveGhidraProject: refuses a non-object input", () => {
  const result = resolveGhidraProject(null);
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses an unknown key BY NAME", () => {
  const result = resolveGhidraProject({ runsRoot: "/runs", runId: "r1", bogusKey: "x" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /bogusKey/);
});

test("resolveGhidraProject: refuses a non-string/absent runsRoot, never coerced", () => {
  const result = resolveGhidraProject({ runsRoot: 42, runId: "r1" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses a non-string/absent runId, never coerced", () => {
  const result = resolveGhidraProject({ runsRoot: "/runs" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: creates a fresh run directory under runsRoot, named after the run id, with no dotted segment", async () => {
  await withTempDir((dir) => {
    const runsRoot = join(dir, "runs");
    const result = resolveGhidraProject({ runsRoot, runId: "r1" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.runsRoot, runsRoot);
    assert.equal(result.projectName, "r1");
    assert.equal(dirname(result.projectLocation), runsRoot, "the run directory must sit directly under runsRoot");
    assert.match(result.projectLocation.slice(runsRoot.length + 1), /^r1-[A-Za-z0-9]+$/);
    assert.ok(existsSync(result.projectLocation), "analyzeHeadless does not create the project directory itself, so it must exist on return");
    assert.equal(hasDotPrefixedSegment(result.projectLocation).dotted, false);
  });
});

test("resolveGhidraProject: two runs under the SAME run id get two distinct, existing directories -- no reuse, no collision", async () => {
  await withTempDir((dir) => {
    const runsRoot = join(dir, "runs");
    const first = resolveGhidraProject({ runsRoot, runId: "same-run" });
    const second = resolveGhidraProject({ runsRoot, runId: "same-run" });
    assert.ok(first.ok && second.ok);
    if (!first.ok || !second.ok) return;
    assert.notEqual(first.projectLocation, second.projectLocation);
    assert.ok(existsSync(first.projectLocation) && existsSync(second.projectLocation));
  });
});

test("resolveGhidraProject: a relative runsRoot is absolutized before the dotted check, which is what Ghidra itself checks", async () => {
  await withTempDir((dir) => {
    const previous = process.cwd();
    process.chdir(dir);
    try {
      const result = resolveGhidraProject({ runsRoot: "runs", runId: "r1" });
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.runsRoot, join(realpathSync(dir), "runs"));
    } finally {
      process.chdir(previous);
    }
  });
});

test("resolveGhidraProject: refuses a runsRoot with a dot-prefixed segment, naming the segment and VICE_BROKER_GHIDRA_DIR, and creates nothing", async () => {
  await withTempDir((dir) => {
    const runsRoot = join(dir, ".c64-re-tools", "ghidra");
    const result = resolveGhidraProject({ runsRoot, runId: "r1" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /"\.c64-re-tools"/, "the refusal must name the offending segment");
    assert.match(result.message, /VICE_BROKER_GHIDRA_DIR/, "the refusal must name the variable that moves the root");
    assert.ok(result.message.includes(DOT_SEGMENT_REFUSAL), "the refusal must quote Ghidra's own reason");
    assert.equal(existsSync(join(dir, ".c64-re-tools")), false, "nothing may be created under a refused root");
  });
});

test("resolveGhidraProject: refuses a run id containing a path separator", () => {
  const result = resolveGhidraProject({ runsRoot: "/runs", runId: "a/b" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses a run id with a dot-prefixed component", () => {
  const result = resolveGhidraProject({ runsRoot: "/runs", runId: ".hidden" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses an empty run id", () => {
  const result = resolveGhidraProject({ runsRoot: "/runs", runId: "" });
  assert.equal(result.ok, false);
});

test("resolveGhidraProject: refuses a run id not matched by RUN_ID_PATTERN (disallowed character)", () => {
  const result = resolveGhidraProject({ runsRoot: "/runs", runId: "bad id!" });
  assert.equal(result.ok, false);
  assert.equal(RUN_ID_PATTERN.test("bad id!"), false);
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
