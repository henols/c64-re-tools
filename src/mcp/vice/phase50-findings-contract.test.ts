// phase50-findings-contract.test.ts -- validates the machine-readable contract
// in Phase 50's two EQUIV-03 verdict documents and the CI boundary document.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// The transcription step of the two committed EQUIV-03 verdict documents was
// unguarded. Both carry YAML frontmatter with seven `inputs:` keys and
// evidence citations on every key line. The plan-time automated command that
// aimed at them, `grep -ac '^\(tree_rebuild\|...\):'`, was anchored at
// column 0 and returned 0 against a correct document -- the keys are
// INDENTED under an `inputs:` mapping, not at column 0. That broken command
// is wired into no test and runs nowhere in CI. This file guards the
// transcription rule with a regex that matches the keys where they REALLY
// LIVE, indented inside `inputs:`, never re-introducing the column-0 anchor.
//
// A third guard covers the document recording where the continuous-
// integration boundary falls, so its required `## ` section (G4) cannot
// silently disappear unguarded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The plain `.git`-marker walk, with no environment short-circuit -- same
 * reasoning as phase50-transcript-freshness.test.ts. */
function findRepoRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`findRepoRoot: no .git ancestor found above ${from}`);
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot(HERE);
/** These findings documents are committed evidence artifacts of phase 50, so
 * they live under that phase's own `evidence/` directory rather than the
 * repository's operator-owned `docs/` -- moved there in phase 53. Renaming
 * or archiving this phase directory will break this guard; it reads a
 * committed artifact by path the same way `anno-derivation.test.ts` and
 * `host-scripts.test.ts` already do. */
const DOCS_DIR = join(REPO_ROOT, ".planning/phases/50-equivalence-and-modifiability/evidence");

/** The seven inputs keys that must appear in every EQUIV-03 findings document,
 * INDENTED under the `inputs:` YAML mapping -- not at column 0. The pattern
 * is anchored at optional leading whitespace, not column 0. (G1: the plan-time
 * column-0 grep against these keys returned 0.) */
const INPUTS_KEYS = ["tree_rebuild", "movement_rebuild", "hazard_disposition", "diff_scope_coverage", "red_controls", "second_path_guard", "ordering_proof"];

/** Passing levels for each input key, as they appear in the committed
 * findings documents. */
const PASSING_LEVELS: Record<string, string> = {
  tree_rebuild: "ok",
  movement_rebuild: "ok",
  hazard_disposition: "acknowledged",
  diff_scope_coverage: "complete",
  red_controls: "all-observed",
  second_path_guard: "held",
  ordering_proof: "held",
};

export interface FindingsAuditOptions {
  /** Directory the findings documents are in. */
  docsDir: string;
}

/** Splits `---`-delimited YAML frontmatter off the body. */
function splitFrontmatter(text: string): { frontmatter: string; body: string } | null {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      return { frontmatter: lines.slice(1, i).join("\n"), body: lines.slice(i + 1).join("\n") };
    }
  }
  return null;
}

/** The whole audit function, pure and reusable. Returns an array of failure
 * strings; empty array means the contract is satisfied. */
export function auditPhase50FindingsContract(options: FindingsAuditOptions): string[] {
  const failures: string[] = [];

  // =========================================================================
  // Discover findings documents by pattern and audit each one.
  // =========================================================================
  const findingsDocuments = readdirSync(options.docsDir)
    .filter((f) => f.startsWith("phase50-") && f.endsWith("-findings.md"))
    .sort();

  if (findingsDocuments.length === 0) {
    return [
      `no findings documents found in ${options.docsDir} -- discovered pattern matches nothing. ` +
        "Expected to find files named phase50-*-findings.md.",
    ];
  }

  // =========================================================================
  // Contract 1: every findings document carries requirement and verdict.
  // Contract 2: every inputs key is present at its passing level.
  // Contract 3: every key line carries an evidence citation.
  // =========================================================================
  for (const name of findingsDocuments) {
    const path = join(options.docsDir, name);
    const text = readFileSync(path, "utf8");
    const split = splitFrontmatter(text);

    if (!split) {
      failures.push(`${name}: document has no YAML frontmatter.`);
      continue;
    }

    const { frontmatter } = split;

    // Check requirement and verdict.
    if (!frontmatter.includes("requirement:") || !frontmatter.includes("[EQUIV-03]")) {
      failures.push(`${name}: frontmatter does not declare 'requirement: [EQUIV-03]'.`);
    }
    if (!frontmatter.includes("verdict:")) {
      failures.push(`${name}: frontmatter has no 'verdict:' key.`);
    }
    if (!frontmatter.includes("verdict_rule_applied:")) {
      failures.push(`${name}: frontmatter has no 'verdict_rule_applied:' key.`);
    }

    // Extract the inputs block and check all seven keys are present with
    // passing levels and evidence citations. The keys are INDENTED under
    // `inputs:`, not at column 0.
    const inputsMatch = frontmatter.match(/^inputs:\s*$/m);
    if (!inputsMatch) {
      failures.push(`${name}: frontmatter has no 'inputs:' mapping.`);
      continue;
    }

    const inputsStartIndex = frontmatter.indexOf(inputsMatch[0]) + inputsMatch[0].length;
    const inputsSection = frontmatter.substring(inputsStartIndex);

    for (const key of INPUTS_KEYS) {
      const expectedValue = PASSING_LEVELS[key];
      // Match: leading whitespace, the key, colon, the value, optional whitespace,
      // optional comment with # evidence/.
      // This regex is anchored at optional leading whitespace (^(?=\s), multiline),
      // NOT at column 0 -- matching the indented structure.
      const pattern = new RegExp(
        `^\\s+${key}:\\s+${expectedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:#.*)?$`,
        "m"
      );
      if (!pattern.test(inputsSection)) {
        failures.push(
          `${name}: inputs key '${key}' is missing, has wrong value (expected '${expectedValue}'), or is not at its expected level.`
        );
        continue;
      }

      // Check that this key line carries an evidence citation (contains 'evidence/').
      const keyLine = inputsSection.match(new RegExp(`^\\s+${key}:.*$`, "m"));
      if (keyLine && !keyLine[0].includes("evidence/")) {
        failures.push(`${name}: inputs key '${key}' line has no evidence citation (expected a reference to 'evidence/...').`);
      }
    }
  }

  // =========================================================================
  // Contract 4: the document recording where the continuous-integration
  // boundary falls carries the required section.
  // =========================================================================
  const ciBoundaryPath = join(options.docsDir, "phase50-ci-boundary.md");
  if (existsSync(ciBoundaryPath)) {
    const ciBoundaryText = readFileSync(ciBoundaryPath, "utf8");
    // The real heading is "## What a GitHub runner executes" (G4).
    if (!ciBoundaryText.includes("## What a GitHub runner executes")) {
      failures.push(
        `${ciBoundaryPath}: document does not carry the required '## What a GitHub runner executes' section.`
      );
    }
  } else {
    failures.push(`${ciBoundaryPath}: document not found.`);
  }

  return failures;
}

// ===========================================================================
// The committed case
// ===========================================================================

test("every phase-50 findings document carries its contract: EQUIV-03 verdict, all seven inputs at passing levels, all evidence cited, and CI boundary section survives", () => {
  assert.deepEqual(
    auditPhase50FindingsContract({ docsDir: DOCS_DIR }),
    [],
    "the committed findings documents do not satisfy the contract"
  );
});

test("the committed phase-50 evidence directory really does hold exactly the expected phase-50 findings documents", () => {
  // Guards the guard: the discovery pattern and the contract assertions are
  // only meaningful if the real tree holds the files they were written to protect.
  const found = readdirSync(DOCS_DIR)
    .filter((f) => f.startsWith("phase50-") && f.endsWith("-findings.md"))
    .sort();
  assert.deepEqual(found, ["phase50-exported-edit-findings.md", "phase50-modifiability-findings.md"]);
});

// ===========================================================================
// The negative cases
// ===========================================================================

test("a findings document with a missing inputs key fails", () => {
  const root = mkdtempSync(join(tmpdir(), "phase50-findings-"));
  const docsDir = join(root, "docs");
  mkdirSync(docsDir, { recursive: true });

  const brokenDoc = `---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-03]
probe_date: 2026-09-16
verdict: acknowledged
verdict_rule_applied: R10
inputs:
  tree_rebuild: ok                 # evidence/test.md:1
  movement_rebuild: ok             # evidence/test.md:2
  hazard_disposition: acknowledged # evidence/test.md:3
  diff_scope_coverage: complete    # evidence/test.md:4
  red_controls: all-observed       # evidence/test.md:5
  second_path_guard: held          # evidence/test.md:6
---

Test document.
`;

  writeFileSync(join(docsDir, "phase50-test-findings.md"), brokenDoc);

  try {
    const failures = auditPhase50FindingsContract({ docsDir });
    assert.equal(
      failures.length >= 1,
      true,
      "a findings document with a missing key should fail; got: " + JSON.stringify(failures)
    );
    assert.ok(failures.some((f) => f.includes("ordering_proof")), "failure must name the missing key");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a findings document with an inputs key at a wrong value fails", () => {
  const root = mkdtempSync(join(tmpdir(), "phase50-findings-"));
  const docsDir = join(root, "docs");
  mkdirSync(docsDir, { recursive: true });

  const brokenDoc = `---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-03]
probe_date: 2026-09-16
verdict: acknowledged
verdict_rule_applied: R10
inputs:
  tree_rebuild: ok                 # evidence/test.md:1
  movement_rebuild: ok             # evidence/test.md:2
  hazard_disposition: acknowledged # evidence/test.md:3
  diff_scope_coverage: complete    # evidence/test.md:4
  red_controls: all-observed       # evidence/test.md:5
  second_path_guard: breached      # evidence/test.md:6
  ordering_proof: held             # evidence/test.md:7
---

Test document.
`;

  writeFileSync(join(docsDir, "phase50-test-findings.md"), brokenDoc);

  try {
    const failures = auditPhase50FindingsContract({ docsDir });
    assert.equal(
      failures.length >= 1,
      true,
      "a findings document with a wrong value should fail; got: " + JSON.stringify(failures)
    );
    assert.ok(
      failures.some((f) => f.includes("second_path_guard")),
      "failure must name the key with the wrong value"
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a findings document with an inputs key line missing evidence citation fails", () => {
  const root = mkdtempSync(join(tmpdir(), "phase50-findings-"));
  const docsDir = join(root, "docs");
  mkdirSync(docsDir, { recursive: true });

  const brokenDoc = `---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-03]
probe_date: 2026-09-16
verdict: acknowledged
verdict_rule_applied: R10
inputs:
  tree_rebuild: ok
  movement_rebuild: ok             # evidence/test.md:2
  hazard_disposition: acknowledged # evidence/test.md:3
  diff_scope_coverage: complete    # evidence/test.md:4
  red_controls: all-observed       # evidence/test.md:5
  second_path_guard: held          # evidence/test.md:6
  ordering_proof: held             # evidence/test.md:7
---

Test document.
`;

  writeFileSync(join(docsDir, "phase50-test-findings.md"), brokenDoc);

  try {
    const failures = auditPhase50FindingsContract({ docsDir });
    assert.equal(
      failures.length >= 1,
      true,
      "a findings document with a missing evidence citation should fail; got: " + JSON.stringify(failures)
    );
    assert.ok(
      failures.some((f) => f.includes("tree_rebuild") && f.includes("evidence")),
      "failure must name the key and mention evidence"
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an empty docs directory fails rather than passing vacuously", () => {
  const root = mkdtempSync(join(tmpdir(), "phase50-findings-empty-"));
  const docsDir = join(root, "docs");
  mkdirSync(docsDir, { recursive: true });

  try {
    const failures = auditPhase50FindingsContract({ docsDir });
    assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
    assert.match(failures[0], /no findings documents/, "empty directory must report no documents found");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a missing CI boundary section in phase50-ci-boundary.md fails", () => {
  const root = mkdtempSync(join(tmpdir(), "phase50-findings-"));
  const docsDir = join(root, "docs");
  mkdirSync(docsDir, { recursive: true });

  // Write valid findings documents
  const validDoc = `---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-03]
probe_date: 2026-09-16
verdict: acknowledged
verdict_rule_applied: R10
inputs:
  tree_rebuild: ok                 # evidence/test.md:1
  movement_rebuild: ok             # evidence/test.md:2
  hazard_disposition: acknowledged # evidence/test.md:3
  diff_scope_coverage: complete    # evidence/test.md:4
  red_controls: all-observed       # evidence/test.md:5
  second_path_guard: held          # evidence/test.md:6
  ordering_proof: held             # evidence/test.md:7
---

Test document.
`;

  writeFileSync(join(docsDir, "phase50-test-findings.md"), validDoc);

  // Write a broken CI boundary document (missing the required section)
  writeFileSync(join(docsDir, "phase50-ci-boundary.md"), "# CI Boundary\n\nNo section here.\n");

  try {
    const failures = auditPhase50FindingsContract({ docsDir });
    assert.equal(
      failures.length >= 1,
      true,
      "missing CI boundary section should fail; got: " + JSON.stringify(failures)
    );
    assert.ok(
      failures.some((f) => f.includes("What a GitHub runner executes")),
      "failure must name the missing section"
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a correct findings document with CI boundary section passes all checks", () => {
  const root = mkdtempSync(join(tmpdir(), "phase50-findings-"));
  const docsDir = join(root, "docs");
  mkdirSync(docsDir, { recursive: true });

  const validDoc = `---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-03]
probe_date: 2026-09-16
verdict: acknowledged
verdict_rule_applied: R10
inputs:
  tree_rebuild: ok                 # evidence/test.md:1
  movement_rebuild: ok             # evidence/test.md:2
  hazard_disposition: acknowledged # evidence/test.md:3
  diff_scope_coverage: complete    # evidence/test.md:4
  red_controls: all-observed       # evidence/test.md:5
  second_path_guard: held          # evidence/test.md:6
  ordering_proof: held             # evidence/test.md:7
---

Test document.
`;

  writeFileSync(join(docsDir, "phase50-test-findings.md"), validDoc);
  writeFileSync(
    join(docsDir, "phase50-ci-boundary.md"),
    "# CI Boundary\n\n## What a GitHub runner executes\n\nCI runs the offline segment.\n"
  );

  try {
    const failures = auditPhase50FindingsContract({ docsDir });
    assert.deepEqual(failures, [], `expected no failures, got: ${JSON.stringify(failures)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
