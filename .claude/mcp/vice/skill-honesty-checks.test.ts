// skill-honesty-checks.test.ts -- the non-vacuity/planted-violation proof
// for `scripts/lib/skill-honesty-checks.mjs`'s exported predicates, used by
// `scripts/check-skill-fork-honesty.mjs` to close WR-11 (Task 1) and IN-03
// (Task 2), per 11.1-CONTEXT.md / 11.1-05-PLAN.md.
//
// `check-skill-fork-honesty.mjs` runs its whole check at import time (a
// plain top-level script, not a callable function), so neither predicate
// could otherwise be proven non-vacuous by a committed test -- only by
// re-running the live script and reading its exit code, which says
// nothing about whether the PREDICATE itself distinguishes a violation
// from a clean file. This file imports the SAME module the CI script
// imports (never a second copy of either predicate), so proving them here
// proves the predicates the CI script runs in production.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fileClaimViolations } from "../../../scripts/lib/skill-honesty-checks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/.claude/mcp/vice
const ROOT = join(HERE, "..", "..", ".."); // <root>
const ACME_MJS = join(ROOT, ".claude", "skills", "acme-build", "scripts", "acme.mjs");
const CI_SCRIPT = join(ROOT, "scripts", "check-skill-fork-honesty.mjs");

// The same claim spec check-skill-fork-honesty.mjs's SKILL_FILE_CLAIMS
// entry uses for acme.mjs (WR-11) -- kept local rather than imported, since
// the CI script has no exported constant, only its own top-level array.
const WR11_SPEC = { forbidden: ["+ libs"], required: ["no libraries needed"] };

// ---------------------------------------------------------------------------
// Task 1: fileClaimViolations() -- planted-violation proof (WR-11)
// ---------------------------------------------------------------------------

test("fileClaimViolations(): real acme.mjs source is clean against the WR-11 spec", () => {
  const source = readFileSync(ACME_MJS, "utf8");
  assert.deepEqual(fileClaimViolations(source, WR11_SPEC), []);
});

test("planted-violation: both the false claim present AND the true claim missing yields two violations", () => {
  const synthetic = "usage: new <file.a>  scaffold a C64 program (BASIC stub + libs)\n";
  const violations = fileClaimViolations(synthetic, WR11_SPEC);
  assert.equal(violations.length, 2);
  assert.ok(violations.some((v) => v.includes('forbidden claim "+ libs" is present')));
  assert.ok(violations.some((v) => v.includes('required claim "no libraries needed" is absent')));
});

test("planted-violation, subtler direction: neither string present yields exactly one violation (the missing required claim)", () => {
  const synthetic = "usage: new <file.a>  scaffold a C64 program (BASIC stub)\n";
  const violations = fileClaimViolations(synthetic, WR11_SPEC);
  assert.equal(violations.length, 1);
  assert.ok(violations[0].includes('required claim "no libraries needed" is absent'));
  assert.ok(!violations[0].includes("+ libs"));
});

test("fileClaimViolations(): a file carrying only the required claim (the fixed state) is clean", () => {
  const synthetic = "usage: new <file.a>  scaffold a C64 program (BASIC stub, no libraries needed)\n";
  assert.deepEqual(fileClaimViolations(synthetic, WR11_SPEC), []);
});

test("live-execution control: check-skill-fork-honesty.mjs exits 0 with OK in its output", () => {
  const result = spawnSync(process.execPath, [CI_SCRIPT], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /check-skill-fork-honesty: OK/);
});
