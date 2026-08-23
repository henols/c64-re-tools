// ci-suite-coverage.test.ts
//
// WHY THIS EXISTS (Phase 16 gap closure, 16-08, code review finding WR-01):
// this phase committed installer/wire-mcp.test.mjs (18 tests, pinning
// wireMcp() -- the installer's only code that reads, edits and rewrites a
// file it does not own, a consumer's .mcp.json) and left four skill suites
// under src/skills/*/scripts/ in the tree, and .github/workflows/ci.yml
// executed NONE of them. Both suites passed locally and were committed --
// they looked like coverage, but nothing in CI ever ran them. That is a
// false assurance, not a test.
//
// The reason no EXISTING guard could see this: the vice-mcp `npm test`
// script (src/mcp/vice/package.json) is `node --test '*.test.*'` -- cwd-only
// and non-recursive by construction. It structurally cannot reach a suite
// living outside src/mcp/vice/, no matter how many suites accumulate
// elsewhere in the repo. This guard closes that whole class of defect: it
// derives the set of directories holding committed test files from the
// repository itself, and fails when a directory is not provably covered by
// a step in .github/workflows/ci.yml's `build` job -- the only job that runs
// on a pull request (`release`, `publish-npm` and `release-on-merge` all
// declare `needs: build` and only fire on a tag or a push to `main`).
//
// WHAT THIS GUARD DELIBERATELY DOES NOT DO: it does not parse YAML. This
// package's runtime dependency set is pinned to exactly `@mastra/mcp` plus
// `@mastra/core` (DISASM-07, enforced by scripts/check-npm-packages.mjs),
// and adding a YAML parser as a dev dependency just for this guard was
// rejected as disproportionate to what it needs (recognising which text
// block belongs to one job, and whether a proof substring sits inside it).
// It works TEXTUALLY on the `build` job block instead, using the same
// two-space top-level-key indentation convention docs-linerefs.test.ts's
// sibling guards already rely on -- and asserts its own extraction is
// well-formed (non-empty, strictly shorter than the whole file) so a
// regex bug that silently returned the whole document could never make
// every subsequent check pass for the wrong reason.
//
// NOT SHIPPED: like docs-dangling-refs.test.ts and comment-phase-pointers.
// test.ts, this file verifies repository wiring, not runtime behaviour, and
// is deliberately absent from package.json's files[] (see the acceptance
// criterion in 16-08-PLAN.md that greps for it there).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

// ---------------------------------------------------------------------------
// Suite-directory walk. Skips are commented individually so a future editor
// knows WHY each one is excluded, not just that it is.
// ---------------------------------------------------------------------------
const TEST_FILE_RE = /\.test\.(ts|mts|mjs|js)$/;

/** Directory NAMES skipped anywhere in the tree, each for its own reason. */
const SKIP_DIR_NAMES: Record<string, string> = {
  node_modules: "third-party code, never a suite this repository committed",
  ".git": "version-control internals, not repository content",
  dist: "scripts/package.sh build output -- a build artifact, not a source suite",
  tools: "deployed host-launcher resources, not a source tree with tests",
  ".planning": "planning documents and phase artifacts, not shipped or tested source",
};

/** Relative-path skips (a bare directory NAME match is too broad for these --
 * "skills" alone would also skip the real src/skills/ tree this guard must
 * walk). installer/skills is .gitignored generated output of
 * installer/scripts/sync-skills.mjs, rebuilt from src/skills/ on every
 * `prepack` (Phase 16 gap closure, 16-08) -- walking it would either
 * double-count the same suites under a second path, or (before that plan's
 * filter landed) count files the filter had already excluded from the
 * published tarball. */
const SKIP_RELATIVE_PATHS = new Set<string>(["installer/skills"]);

function toPosixRelative(root: string, dir: string): string {
  const rel = relative(root, dir);
  return rel === "" ? "." : rel.split(sep).join("/");
}

/** Walks the repository from `root`, returning the sorted, distinct set of
 * directories (relative to `root`, posix-separated) that directly contain at
 * least one committed test file. */
function walkTestSuiteDirectories(root: string): string[] {
  const found = new Set<string>();

  function walk(dir: string): void {
    const relDir = toPosixRelative(root, dir);
    if (SKIP_RELATIVE_PATHS.has(relDir)) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name in SKIP_DIR_NAMES) continue;
        walk(join(dir, entry.name));
      } else if (entry.isFile() && TEST_FILE_RE.test(entry.name)) {
        found.add(relDir);
      }
    }
  }

  walk(root);
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// `build`-job text extraction. Textual, not a YAML parse -- see header.
// ---------------------------------------------------------------------------

/** Matches a top-level (two-space-indented) job key line, e.g. "\n  build:\n"
 * or "\n  release:\n". Anchored to exactly two leading spaces so a nested key
 * (four-plus spaces, e.g. "    runs-on:") never matches. */
const TOP_LEVEL_JOB_KEY_RE = /\n {2}([A-Za-z_][\w-]*):[ \t]*\n/g;

/** Slices `ciYamlText` from the two-space-indented `build:` key to the next
 * two-space-indented top-level job key (or end of file, if `build` were the
 * last job -- not the case today, but the walk does not assume it). Returns
 * "" if no `build:` job key is found at all, so a caller can fail loudly
 * rather than silently treat the whole file as the build job. */
function extractBuildJobBlock(ciYamlText: string): string {
  const matches = [...ciYamlText.matchAll(TOP_LEVEL_JOB_KEY_RE)];
  const buildIndex = matches.findIndex((m) => m[1] === "build");
  if (buildIndex === -1) return "";
  const start = matches[buildIndex].index! + 1; // +1: keep from "  build:", drop the leading \n
  const next = matches[buildIndex + 1];
  const end = next ? next.index! + 1 : ciYamlText.length;
  return ciYamlText.slice(start, end);
}

/** An extraction is well-formed only if it found something AND did not
 * silently swallow the whole document -- the latter would make every
 * downstream `.includes()` check pass for the wrong reason (the file
 * trivially contains everything it contains). */
function isWellFormedExtraction(extracted: string, whole: string): boolean {
  return extracted.length > 0 && extracted.length < whole.length;
}

// ---------------------------------------------------------------------------
// The coverage registry. vice-mcp and installer are FROZEN single entries
// (exact directory, exact proof); skill suite directories are a RULE, not a
// hand-typed list -- any directory the walk finds under src/skills/*/scripts
// is satisfied by the same Task-2 glob, so a seventh or eighth skill needs no
// registry edit here, only a working test file.
// ---------------------------------------------------------------------------
interface FrozenEntry {
  /** The step's own `working-directory:` value -- must appear in the SAME
   * step block as `proof`, not merely anywhere in the build job (both the
   * vice-mcp `Test` step and the installer's `Test the installer` step
   * literally run `npm test`; pairing with working-directory disambiguates
   * them). */
  workingDirectory: string;
  proof: string;
}

const FROZEN_REGISTRY: Record<string, FrozenEntry> = {
  "src/mcp/vice": { workingDirectory: "src/mcp/vice", proof: "npm test" },
  installer: { workingDirectory: "installer", proof: "npm test" },
};

const SKILLS_SCRIPTS_DIR_RE = /^src\/skills\/[^/]+\/scripts$/;
const SKILLS_GLOB_PROOF = "src/skills/*/scripts/*.test.mjs";

/** Splits a `build`-job text block into its individual step chunks. Steps in
 * this repository's ci.yml are six-space-indented `- name:` / `- uses:` list
 * items (verified against the committed file's own indentation); splitting
 * on that exact marker keeps each step's `working-directory:` and `run:`
 * lines scoped to the step that declares them, rather than a bag of lines
 * that could pair the wrong two together. */
const STEP_SPLIT_RE = /\n {6}- /;

function splitSteps(buildBlock: string): string[] {
  const parts = buildBlock.split(STEP_SPLIT_RE);
  return parts.slice(1); // drop the job preamble (runs-on:, steps:) before the first step
}

/** Removes the step chunk whose `name:` line matches `stepName` exactly,
 * rejoining the remaining chunks with the same marker splitSteps() split on.
 * Used only by the planted-violation tests below to prove checkCoverage()
 * bites when a step disappears -- never by the production check itself. */
function removeStepByName(buildBlock: string, stepName: string): string {
  const [preamble, ...steps] = buildBlock.split(STEP_SPLIT_RE);
  const remaining = steps.filter((step) => !step.startsWith(`name: ${stepName}\n`));
  return preamble + remaining.map((step) => "\n      - " + step).join("");
}

interface CoverageResult {
  ok: boolean;
  /** Directories with no registry entry at all. */
  unregistered: string[];
  /** Directories WITH a registry entry whose proof was not found paired
   * correctly in any step. */
  unproven: string[];
}

/** Checks every directory in `directories` against the registry and the
 * extracted `build`-job step chunks. Never passes vacuously: a directory
 * neither in FROZEN_REGISTRY nor matching SKILLS_SCRIPTS_DIR_RE is reported
 * `unregistered`, naming the directory rather than being silently skipped. */
function checkCoverage(directories: string[], buildBlock: string): CoverageResult {
  const steps = splitSteps(buildBlock);
  const unregistered: string[] = [];
  const unproven: string[] = [];

  for (const dir of directories) {
    if (dir in FROZEN_REGISTRY) {
      const { workingDirectory, proof } = FROZEN_REGISTRY[dir];
      const covered = steps.some(
        (step) => step.includes(`working-directory: ${workingDirectory}`) && step.includes(`run: ${proof}`)
      );
      if (!covered) unproven.push(dir);
      continue;
    }
    if (SKILLS_SCRIPTS_DIR_RE.test(dir)) {
      const covered = buildBlock.includes(SKILLS_GLOB_PROOF);
      if (!covered) unproven.push(dir);
      continue;
    }
    unregistered.push(dir);
  }

  return { ok: unregistered.length === 0 && unproven.length === 0, unregistered, unproven };
}

function formatFailure(result: CoverageResult): string {
  const lines: string[] = [];
  for (const dir of result.unregistered) {
    lines.push(
      `${dir}: no registry entry -- a committed test suite lives here but nothing in ci-suite-coverage.test.ts knows how to prove CI runs it. Wire a build-job step for it (or extend the registry if a step already exists under a name this guard cannot recognise); do not add an exemption.`
    );
  }
  for (const dir of result.unproven) {
    lines.push(`${dir}: registered, but its proof substring was not found in the build job's steps.`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const CI_YAML_PATH = join(ROOT, ".github/workflows/ci.yml");
const ciYamlText = readFileSync(CI_YAML_PATH, "utf8");
const buildBlock = extractBuildJobBlock(ciYamlText);
const suiteDirectories = walkTestSuiteDirectories(ROOT);

test("extraction: the build job slice is non-empty and strictly shorter than the whole file", () => {
  assert.ok(isWellFormedExtraction(buildBlock, ciYamlText), "extractBuildJobBlock() returned an empty or whole-file block");
});

test("extraction: a degenerate extraction (whole file, or empty) is never treated as well-formed", () => {
  // Direct unit test of the invariant, independent of the real file: proves
  // the check itself would catch the bug class it exists to catch, rather
  // than relying solely on today's real ci.yml never triggering it.
  assert.equal(isWellFormedExtraction(ciYamlText, ciYamlText), false, "whole-file extraction must not be well-formed");
  assert.equal(isWellFormedExtraction("", ciYamlText), false, "empty extraction must not be well-formed");
});

test("extraction: the build job block contains at least one working-directory: line", () => {
  assert.ok(/working-directory:/.test(buildBlock), "extracted block has no working-directory: line -- the slice is probably wrong");
});

test("non-vacuity: the walk found at least three distinct suite directories", () => {
  assert.ok(
    suiteDirectories.length >= 3,
    `expected at least 3 suite directories, found ${suiteDirectories.length}: ${suiteDirectories.join(", ")} -- the corpus cannot silently shrink`
  );
});

test("non-vacuity: each of the three known roots has at least one test file", () => {
  assert.ok(suiteDirectories.includes("src/mcp/vice"), "no test file found directly under src/mcp/vice");
  assert.ok(suiteDirectories.includes("installer"), "no test file found under installer");
  assert.ok(
    suiteDirectories.some((d) => SKILLS_SCRIPTS_DIR_RE.test(d)),
    "no test file found under any src/skills/*/scripts directory"
  );
});

test("non-vacuity: every FROZEN_REGISTRY key is a directory that exists on disk", () => {
  for (const dir of Object.keys(FROZEN_REGISTRY)) {
    assert.ok(existsSync(join(ROOT, dir)), `registry key ${dir} does not exist on disk -- the registry has outlived a deleted suite`);
  }
});

test("the repository as committed passes: every walked suite directory is covered by the build job", () => {
  const result = checkCoverage(suiteDirectories, buildBlock);
  assert.ok(result.ok, formatFailure(result));
});

test("planted violation: removing the installer's build-job step fails coverage, naming installer", () => {
  const withoutInstallerStep = removeStepByName(buildBlock, "Test the installer");
  assert.notEqual(withoutInstallerStep, buildBlock, "the planted removal did not change the build block -- step text drifted");
  const result = checkCoverage(suiteDirectories, withoutInstallerStep);
  assert.equal(result.ok, false);
  assert.ok(result.unproven.includes("installer"), `expected "installer" in unproven, got: ${JSON.stringify(result)}`);
});

test("planted violation: removing the skills build-job step fails coverage, naming a src/skills directory", () => {
  const withoutSkillsStep = removeStepByName(buildBlock, "Test the skills");
  assert.notEqual(withoutSkillsStep, buildBlock, "the planted removal did not change the build block -- step text drifted");
  const result = checkCoverage(suiteDirectories, withoutSkillsStep);
  assert.equal(result.ok, false);
  assert.ok(
    result.unproven.some((d) => SKILLS_SCRIPTS_DIR_RE.test(d)),
    `expected a src/skills/*/scripts directory in unproven, got: ${JSON.stringify(result)}`
  );
});

test("planted violation (generalized case): a directory outside every known root fails, naming that directory", () => {
  const fakeDir = "src/some-new-tool/scripts";
  const result = checkCoverage([...suiteDirectories, fakeDir], buildBlock);
  assert.equal(result.ok, false);
  assert.ok(result.unregistered.includes(fakeDir), `expected ${fakeDir} in unregistered, got: ${JSON.stringify(result)}`);
});
