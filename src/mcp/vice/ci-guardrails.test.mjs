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
import { MANUAL_ONLY_TESTS, automatedTestFiles } from "./test-gate.mjs";

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

/** Finds step blocks whose `run:` line invokes the bare full-glob command
 * `npm test` (package.json's `test` script, `node --test '*.test.*'`) -- word
 * boundary after `test` so this cannot cross-match `npm test:automated` or
 * a hypothetical `npm testX`. */
function findRunStepBlocksForNpmTest(blocks) {
  const re = /run:\s*npm test\b/;
  return blocks.filter((b) => re.test(b));
}

/** Finds step blocks whose `run:` line invokes either spelling of the
 * NARROWED automated gate -- `npm run test:automated` or `node
 * test-gate.mjs` (package.json's `test:automated` script and its
 * underlying command are two different strings that must both be treated
 * as "narrowed" here, since either one reaching CI's Test step would drop
 * every MANUAL_ONLY_TESTS file, including vice-proxy.test.ts, from the
 * suite CI actually runs). */
function findRunStepBlocksForNarrowedGate(blocks) {
  const re = /run:\s*(npm run test:automated|node test-gate\.mjs)\b/;
  return blocks.filter((b) => re.test(b));
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
// GAP-3 (Nyquist audit, 2026-08-19): BACK-05 success criterion 1's only
// end-to-end wire proof is `vice-proxy.test.ts`'s `ok 116`-`ok 119` (see
// vice-proxy.test.ts, search "BACK-05"). That file is the SECOND entry of
// `MANUAL_ONLY_TESTS` in test-gate.mjs, so `node test-gate.mjs` -- the
// "Full suite command" 08-VALIDATION.md itself names -- never runs it. It
// reaches CI *only* because ci.yml's Test step happens to run bare `npm
// test` (the full `*.test.*` glob) rather than the narrowed
// `npm run test:automated`. Nothing asserted that stays true -- a pending
// todo (.planning/todos/pending/2026-08-13-reconcile-ci-test-command-with-
// narrowed-gate.md) already documents an intention to narrow it, and that
// todo's own acceptance item 3 admits vice-proxy.ts's dispatch seams "would
// then have none anywhere". The tests below make that dependency mechanical
// instead of tribal.
// ---------------------------------------------------------------------------

const FIXTURE_NARROWED_GATE = `
name: CI
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - name: Test
        run: npm run test:automated
      - name: Build
        run: bash scripts/package.sh
`;

const FIXTURE_NARROWED_GATE_TESTGATE_MJS = `
name: CI
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - name: Test
        run: node test-gate.mjs
      - name: Build
        run: bash scripts/package.sh
`;

test("ci-guardrails fixture: a Test step narrowed to npm run test:automated is rejected by the full-glob classifier (proves the check can fail)", () => {
  const blocks = splitIntoStepBlocks(FIXTURE_NARROWED_GATE);

  const fullGlobMatches = findRunStepBlocksForNpmTest(blocks);
  assert.equal(
    fullGlobMatches.length,
    0,
    "a fixture whose Test step runs the narrowed gate must NOT be classified as running the full glob",
  );

  const narrowedMatches = findRunStepBlocksForNarrowedGate(blocks);
  assert.equal(
    narrowedMatches.length,
    1,
    "the narrowed-gate classifier must detect the fixture's `npm run test:automated` step",
  );
});

test("ci-guardrails fixture: a Test step narrowed to node test-gate.mjs is also rejected by the full-glob classifier (proves the second spelling can fail too)", () => {
  const blocks = splitIntoStepBlocks(FIXTURE_NARROWED_GATE_TESTGATE_MJS);

  const fullGlobMatches = findRunStepBlocksForNpmTest(blocks);
  assert.equal(fullGlobMatches.length, 0, "a fixture whose Test step runs `node test-gate.mjs` must not be classified as running the full glob");

  const narrowedMatches = findRunStepBlocksForNarrowedGate(blocks);
  assert.equal(narrowedMatches.length, 1, "the narrowed-gate classifier must detect the fixture's `node test-gate.mjs` step");
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

test("ci-guardrails: ci.yml's Test step still runs the FULL *.test.* glob (npm test), not the narrowed automated gate -- BACK-05's only end-to-end wire proof (vice-proxy.test.ts, ok 116-ok 119) is a MANUAL_ONLY_TESTS entry and reaches CI only via this bare-glob invocation", () => {
  const source = readFileSync(CI_YAML_PATH, "utf8");
  const blocks = splitIntoStepBlocks(source);

  const fullGlobMatches = findRunStepBlocksForNpmTest(blocks);
  assert.equal(
    fullGlobMatches.length,
    1,
    `expected exactly one ci.yml step invoking "npm test" (the full *.test.* glob), found ${fullGlobMatches.length} -- ` +
      "if this is 0, CI's Test step has been narrowed (e.g. to `npm run test:automated` or `node test-gate.mjs`), " +
      "which would silently drop vice-proxy.test.ts (a MANUAL_ONLY_TESTS entry, see test-gate.mjs) from every CI run -- " +
      "and with it, Phase 8's BACK-05 success criterion 1's only end-to-end wire proof (the real stdio-proxy " +
      "assertions at `ok 116`-`ok 119` in vice-proxy.test.ts, search \"BACK-05\"). See " +
      ".planning/todos/pending/2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md, whose own acceptance " +
      'item 3 admits this exact consequence ("would then have none anywhere").',
  );

  assert.equal(
    blockHasContinueOnError(fullGlobMatches[0]),
    false,
    "ci.yml's \"npm test\" step carries continue-on-error -- this silently evaporates the same BACK-05 " +
      `wire-proof coverage described above. Offending step block:\n${fullGlobMatches[0]}`,
  );

  const narrowedMatches = findRunStepBlocksForNarrowedGate(blocks);
  assert.equal(
    narrowedMatches.length,
    0,
    `expected zero ci.yml steps invoking the narrowed automated gate ("npm run test:automated" or ` +
      `"node test-gate.mjs"), found ${narrowedMatches.length} -- if the narrowed gate has REPLACED the full-glob ` +
      "Test step (rather than being added as an unrelated extra step elsewhere), this is exactly the BACK-05 " +
      "coverage regression this guard exists to catch.",
  );
});

test("ci-guardrails: the ci.yml full-glob guard above is not vacuous -- vice-proxy.test.ts really is manual-only today and really is excluded from the narrowed automated gate (non-vacuity control, no second name list)", () => {
  assert.ok(
    MANUAL_ONLY_TESTS.includes("vice-proxy.test.ts"),
    "vice-proxy.test.ts is no longer in test-gate.mjs's MANUAL_ONLY_TESTS -- if it was deliberately moved into the " +
      "automated gate, the ci.yml full-glob guard immediately above is now REDUNDANT (a plain `node test-gate.mjs` " +
      "run would cover it too) and MAY be relaxed deliberately. This is a tripwire, not a bug: update this test and " +
      "the guard above together when that happens, do not silently delete either.",
  );

  const automated = automatedTestFiles(HERE);
  assert.ok(
    !automated.includes("vice-proxy.test.ts"),
    "vice-proxy.test.ts now appears in automatedTestFiles()'s narrowed set -- same tripwire as above: BACK-05's " +
      "wire proof would now run under the narrowed gate too, so the bare-`npm test`-in-ci.yml guard is no longer " +
      "the only thing keeping it alive in CI and may be deliberately relaxed.",
  );
});

test("ci-guardrails: package.json's \"test\" script still resolves to the full *.test.* glob (guards the other half of the BACK-05 hole: redefining the npm script instead of editing ci.yml)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts?.test,
    "node --test '*.test.*'",
    `package.json's "test" script is ${JSON.stringify(pkg.scripts?.test)}, expected the full glob ` +
      `"node --test '*.test.*'" -- if this was narrowed, ci.yml's bare \`npm test\` step would silently stop ` +
      "running vice-proxy.test.ts (BACK-05's only wire proof) even though the ci.yml assertion above still sees " +
      "a bare `npm test` invocation and passes.",
  );
});

// ---------------------------------------------------------------------------
// quick-260819-vie D-1/D-2/D-4: v0.2.0 shipped with `{"assets": []}` because
// the `release` job's three steps (stamp manifests / build zip / attach
// assets) are gated `startsWith(github.ref, 'refs/tags/v')`, which the
// merge path's GITHUB_TOKEN-created tag never re-triggers. Those three steps
// move into ONE seam, scripts/release-assets.sh, called from BOTH release
// paths. These assertions are the drift guard: the seam must be wired into
// exactly two gated, argument-passing step blocks, and nothing may re-derive
// its three steps (`version.mjs stamp` directly, or a second `package.sh`
// call) outside it.
//
// Written and run FIRST, against the pre-edit ci.yml, so each assertion
// below is proven to fail for the "not wired yet" reason before ci.yml is
// touched -- the RED half of this task's TDD gate.
// ---------------------------------------------------------------------------

/** Blocks whose body contains the given regex anywhere -- unlike
 * findRunStepBlocksFor() above (which anchors to a single `run:` line),
 * the release-assets.sh invocations live inside a multi-line `run: |`
 * block scalar, so this searches the whole step block's text. */
function findBlocksMatching(blocks, re) {
  return blocks.filter((b) => re.test(b));
}

/** The one line inside a step block that actually INVOKES release-assets.sh
 * (i.e. `bash scripts/release-assets.sh ...`), as opposed to a comment line
 * merely mentioning the script's name -- both this step's own explanatory
 * header comment and the seam's own header comment (quoted or referenced in
 * ci.yml prose) can contain the bare string "release-assets.sh" without
 * being the invocation line itself. */
function releaseAssetsInvocationLine(block) {
  return block.split("\n").find((line) => /bash scripts\/release-assets\.sh\b/.test(line));
}

test("ci-guardrails: scripts/release-assets.sh is invoked in exactly TWO step blocks of ci.yml (the tag path and the merge path) (D-1)", () => {
  const source = readFileSync(CI_YAML_PATH, "utf8");
  const blocks = splitIntoStepBlocks(source);
  const matches = findBlocksMatching(blocks, /bash scripts\/release-assets\.sh\b/);
  assert.equal(
    matches.length,
    2,
    `expected exactly 2 ci.yml step blocks invoking "bash scripts/release-assets.sh", found ${matches.length} -- ` +
      "the seam must be wired into both the tag-push release job and the release-on-merge job (D-1), no more and no fewer.",
  );
});

test("ci-guardrails: both scripts/release-assets.sh step blocks pass the version as an explicit argument, never a bare invocation (D-2)", () => {
  const source = readFileSync(CI_YAML_PATH, "utf8");
  const blocks = splitIntoStepBlocks(source);
  const matches = findBlocksMatching(blocks, /bash scripts\/release-assets\.sh\b/);
  assert.ok(matches.length > 0, "no release-assets.sh step blocks found -- cannot assert their argument shape");

  for (const block of matches) {
    const line = releaseAssetsInvocationLine(block);
    assert.ok(line, "matched block unexpectedly has no release-assets.sh invocation line");
    assert.match(
      line,
      /release-assets\.sh\s+"?\$/,
      `release-assets.sh invocation carries no explicit argument -- D-2 requires the version arrive as an ` +
        `explicit argument, never read from GITHUB_REF_NAME inside the seam itself. Offending line: ${line}`,
    );
    assert.doesNotMatch(
      line.trim(),
      /release-assets\.sh$/,
      `release-assets.sh invoked bare, with no argument at all. Offending line: ${line}`,
    );
  }
});

test("ci-guardrails: the release-on-merge step invoking release-assets.sh is gated on steps.gate.outputs.release == 'true' (D-4: a skipped release builds and uploads nothing)", () => {
  const source = readFileSync(CI_YAML_PATH, "utf8");
  const blocks = splitIntoStepBlocks(source);
  const matches = findBlocksMatching(blocks, /bash scripts\/release-assets\.sh\b/);
  const mergePathBlock = matches.find((b) => /steps\.ver\.outputs\.version/.test(b));
  assert.ok(
    mergePathBlock,
    "no release-assets.sh step block references steps.ver.outputs.version -- the merge-path wiring is missing or renamed its version source",
  );
  assert.match(
    mergePathBlock,
    /if:\s*steps\.gate\.outputs\.release\s*==\s*'true'/,
    `the merge-path release-assets.sh step is not gated on steps.gate.outputs.release == 'true' -- a skipped ` +
      `release ([skip release] in the commit subject) would still build and upload assets. Offending block:\n${mergePathBlock}`,
  );
});

test("ci-guardrails: neither scripts/release-assets.sh step block carries continue-on-error (a silently-evaporating asset step is exactly the v0.2.0 defect again)", () => {
  const source = readFileSync(CI_YAML_PATH, "utf8");
  const blocks = splitIntoStepBlocks(source);
  const matches = findBlocksMatching(blocks, /bash scripts\/release-assets\.sh\b/);
  assert.ok(matches.length > 0, "no release-assets.sh step blocks found -- cannot assert continue-on-error absence");
  for (const block of matches) {
    assert.equal(
      blockHasContinueOnError(block),
      false,
      `a release-assets.sh step block carries continue-on-error -- this would silently evaporate the release ` +
        `asset upload, exactly the v0.2.0 defect. Offending block:\n${block}`,
    );
  }
});

test("ci-guardrails: version.mjs stamp no longer appears in any ci.yml step block -- it lives inside scripts/release-assets.sh now, not re-derived in a job", () => {
  const source = readFileSync(CI_YAML_PATH, "utf8");
  const blocks = splitIntoStepBlocks(source);
  const matches = findBlocksMatching(blocks, /version\.mjs stamp\b/);
  assert.equal(
    matches.length,
    0,
    `expected zero ci.yml step blocks invoking "version.mjs stamp" directly, found ${matches.length} -- ` +
      "stamping the manifests is now the seam's job (scripts/release-assets.sh), not a job's own step; " +
      "re-deriving it in a job would be exactly the anti-pattern D-1 exists to close.",
  );

  const seamSource = readFileSync(join(REPO_ROOT, "scripts/release-assets.sh"), "utf8");
  assert.match(
    seamSource,
    /version\.mjs" stamp\b/,
    "scripts/release-assets.sh no longer contains the version.mjs stamp call -- the seam itself must own this step",
  );
});

test("ci-guardrails: bash scripts/package.sh appears in exactly ONE ci.yml step block (the build job's artifact build) -- every release path now reaches it only through the seam (D-1)", () => {
  const source = readFileSync(CI_YAML_PATH, "utf8");
  const blocks = splitIntoStepBlocks(source);
  const matches = findBlocksMatching(blocks, /bash scripts\/package\.sh\b/);
  assert.equal(
    matches.length,
    1,
    `expected exactly 1 ci.yml step block invoking "bash scripts/package.sh" directly, found ${matches.length} -- ` +
      "the build job's own artifact-build step is the only direct caller; both release paths must reach " +
      "package.sh only through scripts/release-assets.sh now.",
  );
});
