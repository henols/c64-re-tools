// audit-integrity.test.ts
//
// WHY THIS EXISTS: v0.3.0 closed at commit 4f048bb with its milestone audit
// frontmatter reading `status: passed` while `docs-review-disposition.test.ts`
// was already red. GATE-01 requires that failure mode be mechanically
// impossible. This file is Layer 1 -- the clean-checkout backstop that runs
// under this repo's own `npm test`/CI with zero setup, driving
// `scripts/audit-gate.mjs`'s real CLI contract against both the real tree
// and a set of deliberately-synthetic ones.
//
// WHAT NOT TO DO:
//  - Never rename this file into the `docs-` prefix (D-12-09, hard
//    correctness constraint). `scripts/audit-gate.mjs`'s guard set is
//    derived by globbing `docs-*.test.ts` in this directory; a `docs-`
//    prefixed name for THIS file would make it a member of its own guard
//    set, and the gate would spawn itself recursively.
//  - Never re-derive the guard glob here as a second, competing
//    implementation. Read it from `audit-gate.mjs`'s own `--json` output
//    (`runGate()` below) -- the one literal array in this file
//    (`EXPECTED_GUARD_NAMES_FOR_ASSERTION`) exists only to assert against
//    that derived output, exactly the way `test-gate.test.ts` hardcodes its
//    own expected list for the same reason; it is never used to build an
//    argv or a file-discovery step of its own.
//
// SCOPE FENCE: this is Layer 1, the clean-checkout backstop. It does not
// test the Claude Code `PreToolUse` hook runtime (plan 12-02) or the
// settings wiring (plan 12-03) -- both are manual by nature, the same class
// as `vice-sync.ts`'s deliberately-untested checkpoint waits (CLAUDE.md §
// Testing).
//
// Every synthetic-tree test below drives `scripts/audit-gate.mjs` as a
// SUBPROCESS, never as a direct `import` -- `tsconfig.json` sets
// `allowJs: false`, so importing the `.mjs` script directly fails
// `npm run typecheck` with TS7016 ("Could not find a declaration file"),
// measured while writing this file, not merely assumed. Driving the CLI
// instead also exercises the exact contract both a human operator and the
// future `--hook` mode use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { repoRoot } from "./repo-root.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");
const ROOT = repoRoot({ from: HERE });
const GATE = join(ROOT, "scripts", "audit-gate.mjs");

/** Mirrors `audit-gate.mjs`'s own `EXPECTED_DOCS_GUARD_NAMES` for assertion
 * purposes only (see the header's WHAT NOT TO DO) -- never used to build an
 * argv or to discover files; every discovery in this file goes through
 * `runGate()`'s real subprocess call. */
const EXPECTED_GUARD_NAMES_FOR_ASSERTION = [
  "docs-linerefs.test.ts",
  "docs-dangling-refs.test.ts",
  "docs-deferred-ledger.test.ts",
  "docs-review-disposition.test.ts",
];

interface GateJsonResult {
  allowed: boolean;
  redGuards: string[];
  gatedAudits: { file: string; status: string }[];
  guardFiles: string[];
  auditFiles: string[];
  statusCounts: Record<string, number>;
  structuralErrors: string[];
  reason: string;
}

interface GateRunResult {
  status: number;
  json: GateJsonResult;
  stderr: string;
}

/** Drives `scripts/audit-gate.mjs`'s real CLI contract as a subprocess
 * against `rootDir`, in `--json` mode, and parses its single stdout JSON
 * object. This is the ONE place this file spawns the gate. */
function runGate(rootDir: string): GateRunResult {
  const result = spawnSync(process.execPath, [GATE, "--root", rootDir, "--json"], {
    encoding: "utf8",
  });
  if (result.error) {
    throw new Error(`failed to spawn audit-gate.mjs: ${result.error.message}`);
  }
  let json: GateJsonResult;
  try {
    json = JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(
      `audit-gate.mjs --json did not print parseable JSON on stdout: ${(err as Error).message}\n` +
        `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
  }
  return { status: result.status ?? 1, json, stderr: result.stderr ?? "" };
}

/** Builds an audit markdown file's full text: a two-key frontmatter block
 * (`status:` plus a filler key so the block is never a single line) and an
 * optional body appended after the closing `---`. */
function auditMarkdown(status: string, body = ""): string {
  return `---\nmilestone: v9.9.9\nstatus: ${status}\n---\n\n${body}`;
}

/** The two-line planted guard body: `assertTruth` selects whether the
 * guard's own assertion is true (green) or deliberately false (red). */
function plantedGuardBody(name: string, assertTruth: boolean): string {
  return (
    `import { test } from "node:test";\n` +
    `import assert from "node:assert/strict";\n` +
    `test("${name} planted", () => { assert.ok(${assertTruth ? "true" : "false"}, "PLANTED-ASSERTION-${name}"); });\n`
  );
}

interface SyntheticTreeOptions {
  /** How many of the four EXPECTED_GUARD_NAMES_FOR_ASSERTION-shaped guard
   * files to plant. Defaults to 4 (satisfies the floor). Set lower to
   * exercise the structural-failure path (test 11). */
  guardCount?: number;
  /** Index (0-based) of the planted guard that asserts falsely. `null`
   * plants an all-green guard set. */
  redGuardIndex?: number | null;
  /** The frontmatter `status:` value of the planted audit file. */
  auditStatus?: string;
  /** Extra body text appended after the planted audit's frontmatter. */
  auditBody?: string;
  /** Relative path (from the synthetic root) at which to write the planted
   * audit file. Defaults to `.planning/v9.9.9-MILESTONE-AUDIT.md`. */
  auditRelPath?: string;
}

/** Builds a synthetic tree under `mkdtempSync(join(tmpdir(), ...))`, never
 * inside this repo. This deliberately diverges from `12-PATTERNS.md`'s
 * committed-fixture recommendation: a committed file literally named
 * `docs-*.test.ts` that always fails is exactly the leak this phase must
 * not create -- it would be one recursive-glob change, or one change to
 * this directory's own `*.test.*` glob, away from redding CI permanently.
 * A `mkdtempSync` tree lives outside the repo entirely and is structurally
 * incapable of joining the real `docs-*` glob. `mkdtempSync` is already
 * this repo's established synthetic-tree idiom (`install-resources.test.ts`).
 */
function buildSyntheticTree(opts: SyntheticTreeOptions = {}): { root: string; cleanup: () => void } {
  const { guardCount = 4, redGuardIndex = 0, auditStatus = "passed", auditBody = "", auditRelPath } = opts;

  const root = mkdtempSync(join(tmpdir(), "audit-gate-planted-"));
  const viceDir = join(root, ".claude", "mcp", "vice");
  const planningDir = join(root, ".planning");
  mkdirSync(viceDir, { recursive: true });
  mkdirSync(planningDir, { recursive: true });

  for (let i = 0; i < guardCount; i++) {
    const name = EXPECTED_GUARD_NAMES_FOR_ASSERTION[i] ?? `docs-extra-${i}.test.ts`;
    const isRed = redGuardIndex !== null && i === redGuardIndex;
    writeFileSync(join(viceDir, name), plantedGuardBody(name, !isRed), "utf8");
  }

  const relPath = auditRelPath ?? join(".planning", "v9.9.9-MILESTONE-AUDIT.md");
  const auditPath = join(root, relPath);
  mkdirSync(join(auditPath, ".."), { recursive: true });
  writeFileSync(auditPath, auditMarkdown(auditStatus, auditBody), "utf8");

  const cleanup = () => rmSync(root, { recursive: true, force: true });
  return { root, cleanup };
}

test("the gate script exists and carries the node shebang", () => {
  assert.ok(existsSync(GATE), `expected ${GATE} to exist`);
  // Every committed .mjs in this repo is mode 644 and invoked as
  // `node <path>`, never `./<path>` -- do not re-add a `test -x`-style
  // assertion here; see scripts/audit-gate.mjs's own header for why.
  const firstLine = readFileSync(GATE, "utf8").split("\n")[0];
  assert.equal(firstLine, "#!/usr/bin/env node");
});

test("this test file is NOT a member of the guard set it audits (D-12-09 anti-recursion)", () => {
  const { json } = runGate(ROOT);
  assert.ok(
    !json.guardFiles.includes("audit-integrity.test.ts"),
    "audit-integrity.test.ts must never be a member of the derived docs-*.test.ts guard set",
  );
  const selfName = basename(fileURLToPath(import.meta.url));
  assert.ok(
    !selfName.startsWith("docs-"),
    `this file's own basename (${selfName}) must not start with docs- -- doing so would make it a member of its own guard set`,
  );
});

test("the docs guard set is derived from disk with a non-vacuity floor (D-12-07 / D-12-08)", () => {
  const { json } = runGate(ROOT);
  assert.ok(
    json.guardFiles.length >= 4,
    `expected >= 4 docs-*.test.ts guards on the real tree, got ${json.guardFiles.length} -- ` +
      "an empty or broken glob must fail loudly here rather than let the gate report green forever",
  );
  assert.deepEqual([...json.guardFiles].sort(), [...EXPECTED_GUARD_NAMES_FOR_ASSERTION].sort());
});

test("no milestone audit declares a gated status while any docs guard is red (D-12-02)", () => {
  const { status, json } = runGate(ROOT);
  assert.equal(status, 0, `expected exit 0 on the real tree; reason: ${json.reason}`);
  assert.equal(json.allowed, true, `expected allowed=true on the real tree; reason: ${json.reason}`);
});

test("the frontmatter scan reads only the frontmatter, not prose (T-12-04)", () => {
  const { json } = runGate(ROOT);
  // v0.2.0-MILESTONE-AUDIT.md contains 9 status: occurrences and
  // v0.3.0-MILESTONE-AUDIT.md contains 4, exactly one frontmatter key
  // each -- these counts are the direct proof the scan is frontmatter-only.
  assert.ok(json.auditFiles.length >= 6, `expected >= 6 milestone audit files, got ${json.auditFiles.length}`);
  assert.equal(json.statusCounts.passed, 1, `statusCounts: ${JSON.stringify(json.statusCounts)}`);
  assert.equal(json.statusCounts.tech_debt, 3, `statusCounts: ${JSON.stringify(json.statusCounts)}`);
  assert.equal(json.statusCounts.gaps_found, 2, `statusCounts: ${JSON.stringify(json.statusCounts)}`);
  assert.equal(json.gatedAudits.length, 4, `gatedAudits: ${JSON.stringify(json.gatedAudits)}`);
});

test("planted violation: a synthetic tree with a red guard and an audit declaring status: passed is refused (D-12-16)", () => {
  const { root, cleanup } = buildSyntheticTree({ redGuardIndex: 0, auditStatus: "passed" });
  try {
    const { status, json } = runGate(root);
    assert.equal(status, 1, `expected exit 1; got json: ${JSON.stringify(json)}`);
    assert.equal(json.allowed, false);
    assert.ok(json.redGuards.length >= 1, "expected at least one red guard reported");
    assert.ok(
      json.reason.includes(EXPECTED_GUARD_NAMES_FOR_ASSERTION[0]),
      `expected reason to name the offending guard's basename; reason: ${json.reason}`,
    );
    assert.ok(
      json.reason.includes(`PLANTED-ASSERTION-${EXPECTED_GUARD_NAMES_FOR_ASSERTION[0]}`),
      `expected reason to quote the planted assertion's own failure text; reason: ${json.reason}`,
    );
    assert.ok(
      /change or retire the guard/i.test(json.reason),
      `expected reason to name the change-or-retire-in-a-commit route; reason: ${json.reason}`,
    );
  } finally {
    cleanup();
  }
});

test("planted false-negative: the same synthetic audit with all guards green is allowed (D-12-16)", () => {
  const { root, cleanup } = buildSyntheticTree({ redGuardIndex: null, auditStatus: "passed" });
  try {
    const { status, json } = runGate(root);
    assert.equal(status, 0, `expected exit 0; got json: ${JSON.stringify(json)}`);
    assert.equal(json.allowed, true);
  } finally {
    cleanup();
  }
});

test("status: gaps_found is never gated even with a red guard (D-12-13)", () => {
  const { root, cleanup } = buildSyntheticTree({ redGuardIndex: 0, auditStatus: "gaps_found" });
  try {
    const { status, json } = runGate(root);
    assert.equal(status, 0, `honest bad news must never be obstructed; got json: ${JSON.stringify(json)}`);
    assert.equal(json.allowed, true);
  } finally {
    cleanup();
  }
});

test("status: tech_debt is gated (D-12-12)", () => {
  const { root, cleanup } = buildSyntheticTree({ redGuardIndex: 0, auditStatus: "tech_debt" });
  try {
    const { status, json } = runGate(root);
    assert.equal(status, 1, `expected refusal; got json: ${JSON.stringify(json)}`);
    assert.equal(json.allowed, false);
  } finally {
    cleanup();
  }
});

test("a prose-only occurrence of a gated status does not trigger the gate (T-12-04, the measured false-positive trap)", () => {
  const { root, cleanup } = buildSyntheticTree({
    redGuardIndex: 0,
    auditStatus: "gaps_found",
    auditBody: "The prior round recorded `status: passed` for reference, quoted here in prose only.\n",
  });
  try {
    const { status, json } = runGate(root);
    assert.equal(status, 0, `expected the body's prose status: passed to be ignored; got json: ${JSON.stringify(json)}`);
    assert.equal(json.allowed, true);
  } finally {
    cleanup();
  }
});

test("a synthetic tree below the guard floor is a structural failure, not a silent pass (D-12-08)", () => {
  const { root, cleanup } = buildSyntheticTree({ guardCount: 1, redGuardIndex: null, auditStatus: "passed" });
  try {
    const { status, json } = runGate(root);
    assert.equal(status, 1, `expected structural failure exit 1; got json: ${JSON.stringify(json)}`);
    assert.ok(json.structuralErrors.length >= 1, "expected at least one structural error");
    assert.ok(
      json.structuralErrors.some((e) => /floor|>=/.test(e)),
      `expected a structural error mentioning the floor; got: ${JSON.stringify(json.structuralErrors)}`,
    );
  } finally {
    cleanup();
  }
});

test("the milestone-audit walk descends neither a symlinked directory nor a dot-directory (T-12-06)", (t) => {
  const { root, cleanup } = buildSyntheticTree({ redGuardIndex: 0, auditStatus: "gaps_found" });
  try {
    const planningDir = join(root, ".planning");
    const outsideDir = join(root, "outside-planning");
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(join(outsideDir, "v9.9.8-MILESTONE-AUDIT.md"), auditMarkdown("passed"), "utf8");

    let symlinkOk = true;
    try {
      symlinkSync(outsideDir, join(planningDir, "linked"), "dir");
    } catch (err) {
      symlinkOk = false;
      t.diagnostic(`symlinkSync failed (EPERM on a restricted filesystem?), skipping symlink half: ${(err as Error).message}`);
    }

    const archiveDir = join(planningDir, ".archive");
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(join(archiveDir, "v9.9.7-MILESTONE-AUDIT.md"), auditMarkdown("passed"), "utf8");

    const { status, json } = runGate(root);

    assert.equal(json.auditFiles.length, 1, `expected exactly 1 discovered audit file, got: ${JSON.stringify(json.auditFiles)}`);
    assert.ok(json.auditFiles[0]?.endsWith("v9.9.9-MILESTONE-AUDIT.md"), `expected the single entry to be the real planted audit, got: ${json.auditFiles[0]}`);
    assert.ok(!json.auditFiles.some((f) => f.includes("linked")), "must never discover the symlinked directory's audit");
    assert.ok(!json.auditFiles.some((f) => f.includes(".archive")), "must never discover the dot-directory's audit");
    assert.equal(json.gatedAudits.length, 0, `expected 0 gated audits (the only discovered one is gaps_found), got: ${JSON.stringify(json.gatedAudits)}`);
    assert.equal(status, 0);
    assert.equal(json.allowed, true);

    if (!symlinkOk) {
      t.diagnostic("symlink half skipped on this filesystem; dot-directory half still asserted above");
    }
  } finally {
    cleanup();
  }
});
