// ci-guardrails.test.mjs
//
// WHY THIS FILE EXISTS (Nyquist gap, phase 8 SKILL-01/DIST-02/DIST-03): the
// entirety of SKILL-01/DIST-02/DIST-03's mechanical enforcement is
// `scripts/check-skill-fork-honesty.mjs` exiting non-zero -- but that only
// matters if `.github/workflows/ci.yml` actually runs it as a BLOCKING step.
// Before this file existed, nothing failed if that CI step were deleted or
// given `continue-on-error: true`: the control would silently evaporate and
// every other Phase 8 test would still pass. The 08-VERIFICATION.md report
// verified this wiring only by a human reading ci.yml's line 97 -- this file
// makes that a mechanical, regression-tested assertion instead.
//
// WHY THIS FILE IS .mjs, NOT .ts (same reasoning as tool-support-table.test.mjs's
// header): this package's tsconfig.json sets `allowJs: false` and `include`
// covers only **/*.ts and **/*.mts, so a plain-text-parsing .mjs test that
// touches no TypeScript source is invisible to `tsc --noEmit` either way --
// keeping it .mjs matches tool-support-table.test.mjs's established
// repo-root-reaching-guard-test precedent exactly.
//
// SCOPE: this file parses ci.yml as plain text (regex/string split), NOT as
// YAML -- the repo has zero runtime dependencies for its scripts and this
// test must not add one (a real YAML parser is unavailable). The parser
// below is intentionally narrow: it only needs to (a) split the workflow
// into GitHub Actions "step" blocks, keyed on the 6-space `- ` step-start
// marker this file's `build` job actually uses (confirmed by direct
// inspection), and (b) find, per guard script, the ONE step block whose body
// invokes it and check that block for `continue-on-error`. It does not
// attempt to parse job/step semantics generally.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Deliberately NOT repoRoot() from the sibling repo-root.ts -- see
// host-scripts.test.ts's identical rationale: that resolver's
// CONTAINER_WORKSPACE_PATH short-circuit would silently redirect a parallel
// worktree executor to the wrong checkout. Plain `.git`-marker walk only.
function findRepoRoot(from) {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`findRepoRoot: no .git ancestor found above ${from}`);
    }
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot(HERE);
const CI_YAML_PATH = join(REPO_ROOT, ".github/workflows/ci.yml");

/** The exact three repo-root guard scripts SKILL-01/DIST-02/DIST-03's CI
 * enforcement depends on. Frozen list, matched against ci.yml's `run:`
 * lines below -- if a fourth guard script is added, extend this array (and
 * expect the "exactly 3 discovered" non-vacuity assertion to be updated
 * deliberately, not silently). */
const GUARD_SCRIPTS = [
  "scripts/check-npm-packages.mjs",
  "scripts/check-skill-tool-coverage.mjs",
  "scripts/check-skill-fork-honesty.mjs",
];

/** Splits a GitHub Actions workflow YAML source into step blocks, using the
 * 6-space `- ` step-start marker (`      - uses:` / `      - name:`) as the
 * boundary. Each returned block spans from one step-start line up to (but
 * not including) the next step-start line, or end of file for the last
 * step. This intentionally does not track which `jobs:`/`steps:` block a
 * step belongs to -- callers that need to distinguish jobs should slice the
 * source before calling this. */
function splitIntoStepBlocks(yamlSource) {
  const lines = yamlSource.split("\n");
  const stepStartIndices = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^ {6}- /.test(lines[i])) stepStartIndices.push(i);
  }
  const blocks = [];
  for (let i = 0; i < stepStartIndices.length; i++) {
    const start = stepStartIndices[i];
    const end = i + 1 < stepStartIndices.length ? stepStartIndices[i + 1] : lines.length;
    blocks.push(lines.slice(start, end).join("\n"));
  }
  return blocks;
}

/** Finds the step block(s) whose body contains a `run:` line invoking the
 * given script path (e.g. "scripts/check-npm-packages.mjs"). A word
 * boundary immediately after the script's basename-bearing path prevents a
 * script whose name is a literal prefix of another's from cross-matching
 * (not actually the case among the three today, but this must not become
 * true silently in future). */
function findRunStepBlocksFor(blocks, scriptRelPath) {
  const escaped = scriptRelPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`run:\\s*node ${escaped}\\b`);
  return blocks.filter((b) => re.test(b));
}

function blockHasContinueOnError(block) {
  return /continue-on-error/.test(block);
}

// ---------------------------------------------------------------------------
// Synthetic-fixture tests (no dependency on ci.yml's real content): prove the
// parser itself is correct, both directions, before trusting it against the
// real file below.
// ---------------------------------------------------------------------------

const FIXTURE_BLOCKING = `
name: CI
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - name: Validate thing
        run: node scripts/check-thing.mjs
      - name: Build
        run: bash scripts/package.sh
`;

const FIXTURE_NON_BLOCKING = `
name: CI
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - name: Validate thing
        continue-on-error: true
        run: node scripts/check-thing.mjs
      - name: Build
        run: bash scripts/package.sh
`;

const FIXTURE_MISSING = `
name: CI
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: bash scripts/package.sh
`;

test("ci-guardrails fixture: a plain run: step with no continue-on-error is classified blocking", () => {
  const blocks = splitIntoStepBlocks(FIXTURE_BLOCKING);
  const matches = findRunStepBlocksFor(blocks, "scripts/check-thing.mjs");
  assert.equal(matches.length, 1, "fixture parser must find exactly one matching step block");
  assert.equal(blockHasContinueOnError(matches[0]), false, "fixture parser must not see continue-on-error where none exists");
});

test("ci-guardrails fixture: a step carrying continue-on-error is classified non-blocking (proves the check can fail)", () => {
  const blocks = splitIntoStepBlocks(FIXTURE_NON_BLOCKING);
  const matches = findRunStepBlocksFor(blocks, "scripts/check-thing.mjs");
  assert.equal(matches.length, 1, "fixture parser must find exactly one matching step block");
  assert.equal(blockHasContinueOnError(matches[0]), true, "fixture parser must detect continue-on-error inside the matched step's own block");
});

test("ci-guardrails fixture: a deleted step is classified as zero matches, never a false pass", () => {
  const blocks = splitIntoStepBlocks(FIXTURE_MISSING);
  const matches = findRunStepBlocksFor(blocks, "scripts/check-thing.mjs");
  assert.equal(matches.length, 0, "fixture parser must find no matching step block once the step is deleted");
});

// ---------------------------------------------------------------------------
// Real-file assertions against the actual .github/workflows/ci.yml.
// ---------------------------------------------------------------------------

test("ci-guardrails: .github/workflows/ci.yml exists and is non-trivially long (non-vacuity)", () => {
  assert.ok(existsSync(CI_YAML_PATH), `${CI_YAML_PATH} does not exist`);
  const source = readFileSync(CI_YAML_PATH, "utf8");
  assert.ok(
    source.length > 2000,
    `ci.yml is suspiciously short (${source.length} bytes) -- the file may have been truncated or this test may be reading the wrong path`,
  );
});

test("ci-guardrails: exactly 3 guard scripts are discovered as run: steps in ci.yml (non-vacuity)", () => {
  const source = readFileSync(CI_YAML_PATH, "utf8");
  const blocks = splitIntoStepBlocks(source);
  assert.ok(blocks.length >= 10, `expected at least 10 step blocks in ci.yml, found ${blocks.length} -- the step splitter may be broken`);

  let discovered = 0;
  for (const script of GUARD_SCRIPTS) {
    const matches = findRunStepBlocksFor(blocks, script);
    if (matches.length > 0) discovered++;
  }
  assert.equal(
    discovered,
    3,
    `expected exactly 3 of the 3 known guard scripts to be discovered as run: steps in ci.yml, found ${discovered} -- ` +
      "a broken regex or a genuinely missing step must not pass this check vacuously",
  );
});

for (const script of GUARD_SCRIPTS) {
  test(`ci-guardrails: ${script} runs as exactly one BLOCKING step in ci.yml (no continue-on-error)`, () => {
    const source = readFileSync(CI_YAML_PATH, "utf8");
    const blocks = splitIntoStepBlocks(source);
    const matches = findRunStepBlocksFor(blocks, script);

    assert.equal(
      matches.length,
      1,
      `expected exactly one ci.yml step invoking "node ${script}", found ${matches.length} -- ` +
        "if 0: the step was deleted or renamed; if >1: an unexpected duplicate step exists",
    );

    assert.equal(
      blockHasContinueOnError(matches[0]),
      false,
      `ci.yml's step invoking "node ${script}" carries continue-on-error -- this silently ` +
        "evaporates SKILL-01/DIST-02/DIST-03's CI enforcement (the phase's entire mechanical " +
        `control for this requirement). Offending step block:\n${matches[0]}`,
    );
  });
}
