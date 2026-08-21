// skill-honesty-checks.test.ts -- the non-vacuity/planted-violation proof
// for `scripts/lib/skill-honesty-checks.mjs`'s two exported predicates,
// used by `scripts/check-skill-fork-honesty.mjs` to close WR-11 (Task 1)
// and IN-03 (Task 2), per 11.1-CONTEXT.md / 11.1-05-PLAN.md.
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
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fileClaimViolations, isStandaloneDisasmToken } from "../../../scripts/lib/skill-honesty-checks.mjs";

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

// ---------------------------------------------------------------------------
// Task 2: isStandaloneDisasmToken() -- IN-03's narrowed predicate
// ---------------------------------------------------------------------------

test("isStandaloneDisasmToken(): Phase 4's protected disasm-decoder.ts is NOT a violation (IN-03's false positive, now impossible)", () => {
  assert.equal(isStandaloneDisasmToken("see .claude/mcp/vice/disasm-decoder.ts for the opcode table"), false);
});

test("isStandaloneDisasmToken(): other disasm-*.ts module names are likewise excluded", () => {
  assert.equal(isStandaloneDisasmToken("disasm-opcodes.ts and disasm-renderer.ts are the other two modules"), false);
});

test("isStandaloneDisasmToken(): a real standalone-verb reintroduction is still caught", () => {
  assert.equal(isStandaloneDisasmToken("run acme.mjs disasm foo.prg"), true);
});

test("isStandaloneDisasmToken(): the documented provenance-ledger exemption line still matches the bare token (exemption is applied by the caller, not the predicate)", () => {
  assert.equal(isStandaloneDisasmToken('note: "loader scratch", evidence: "disasm"'), true);
});

// ---------------------------------------------------------------------------
// Task 2: WR-03 regression check -- live child-process run against a
// scratch skill file, because that hole lived in the CHECK ORDERING
// (toacme/cmdDisasm must run before the exemption is consulted), not in
// the standalone-disasm-token predicate alone. Asserted against the real
// CI script, not the predicate, per the plan's own instruction.
// ---------------------------------------------------------------------------

function runCiScriptWithScratchFile(scratchRelPath: string, content: string) {
  // Written directly under .claude/skills/acme-build/ (an existing,
  // already-walked skill directory) rather than into a fresh tmpdir --
  // check-skill-fork-honesty.mjs only walks .claude/skills/, so a tmpdir
  // scratch file would never be seen at all.
  const scratchFile = join(ROOT, ".claude", "skills", "acme-build", scratchRelPath);
  writeFileSync(scratchFile, content, "utf8");
  try {
    return spawnSync(process.execPath, [CI_SCRIPT], { cwd: ROOT, encoding: "utf8" });
  } finally {
    rmSync(scratchFile, { force: true });
  }
}

test("WR-03/IN-03 live check: a scratch file naming disasm-decoder.ts does NOT make the script fail", () => {
  const result = runCiScriptWithScratchFile(
    "zz-scratch-in03-negative.md",
    "# Scratch\n\nSee disasm-decoder.ts for the opcode table.\n"
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("WR-03/IN-03 live check: a scratch line 'acme.mjs disasm out.a' DOES make it fail", () => {
  const result = runCiScriptWithScratchFile(
    "zz-scratch-in03-positive.md",
    "# Scratch\n\nRun `acme.mjs disasm out.a` to do the thing.\n"
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /a bare "disasm" verb token reappeared/);
});

test("WR-03 regression: a scratch line with both cmdDisasm and the exemption string DOES fail (ordering still correct)", () => {
  const result = runCiScriptWithScratchFile(
    "zz-scratch-wr03-regression.md",
    '# Scratch\n\n// see acme.mjs cmdDisasm / toacme, evidence: "disasm"\n'
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /"cmdDisasm" reappeared/);
});
