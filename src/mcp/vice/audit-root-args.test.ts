// src/mcp/vice/audit-root-args.test.ts
//
// WHY THIS FILE EXISTS: `scripts/lib/audit-root.mjs` is the containment seam
// for the `--root` flag -- the ONLY testability seam the audit scripts have.
// It shipped in phase 32 with zero callers and zero tests, and its central
// soundness claim ("every `--root` argument is resolved through
// `resolveContainedRoot()`") was false in two independent ways: every consumer
// hand-rolled an argv reader that matched only the exact token `--root` and
// read `argv[i + 1]`, so the equals form, a valueless flag and any typo were
// SILENTLY DISCARDED and the invocation fell back to the default root. On the
// one consumer that WRITES, `node scripts/generate-tool-support-table.mjs
// --root=/tmp/definitely-not-here` therefore overwrote the REAL
// `docs/tool-support.md` and exited 0 while reporting success. This file is
// that seam's first test, and it is written around the exact command the
// phase-32 verifier reproduced.
//
// WHAT NOT TO DO:
//
//   1. Do NOT assert against a re-implementation of the parsing rules. Every
//      unit assertion below drives the REAL exported `parseRootArg`, and every
//      process-level assertion spawns the REAL script. A rule proved against a
//      copy of itself proves nothing about the rule that actually runs --
//      which is precisely the defect this file exists to prevent recurring.
//
//   2. Do NOT let a case write outside the temporary directory it created.
//      `/tmp` on the development host is a RAM-backed filesystem whose
//      automatic aging is disabled: it empties only on reboot. Every fixture
//      directory below is removed in a `finally`, never left for the operating
//      system to reclaim. The synthetic-corpus fixture is the one exception to
//      WHERE, not to WHETHER: it must live INSIDE the repository, because a
//      contained root is exactly what it is proving, and it is removed twice
//      over -- in a `finally` and again in a `t.after` -- so a thrown assertion
//      cannot leave it behind. `.gitignore` carries a matching entry for the
//      same reason.
//
//   3. Do NOT add a case that performs a full end-to-end run of a script
//      beyond the ones already here. Sixteen of the eighteen matrix cases are
//      refusals that exit before their script reads or writes anything, and
//      the rule exists to keep this file from becoming a slow re-run of the
//      whole audit.
//
//      PLAN 32-12 WIDENED THIS DELIBERATELY, and the new budget is stated
//      rather than quietly spent. The rule used to add "and never run the SAME
//      script to completion twice". It cannot: the `[edge:CUT-04/adjacency]`
//      accept side has to prove that a root RESOLVING to the repository root
//      behaves like the unflagged run in every spelling, and "behaves like the
//      unflagged run" is a claim about a completed run. That is four scripts x
//      four runs (an unflagged baseline plus three spellings), measured at
//      194/299/151/353 ms each -- about four seconds, against a file that ran
//      in six. Total end-to-end runs: 19. Every one of them is load-bearing;
//      none is a convenience.
//
//      The one script with a working-tree side effect under the default root --
//      the invocations gate, which regenerates `installer/skills/` -- is
//      idempotent, and plan 32-12's evidence record carries the `git status
//      --porcelain` before/after proving the tree is byte-identical after a
//      full run of this file.
//
// WHAT THIS FILE DOES *NOT* COVER, stated so no reader infers coverage it does
// not carry. `[edge:CUT-04/ordering]` has two halves. The first -- where two
// argv tokens compare equal, i.e. a repeated `--root`, the resolution is
// SPECIFIED rather than positional -- IS asserted here, at unit level and again
// through a spawned process. The second -- whether the fate guard's verdict is
// independent of the order the derived audited set and the registry rows are
// produced in -- is NOT asserted by this file or by this round. It is recorded
// as a `backstop` in plan 32-11's `must_haves` and concerns code this round
// does not change.
//
// This file is inside the removal gate's scope, so it must carry ZERO
// occurrences of the deleted subject's literal name. The gate is referred to
// by ROLE, never by file name.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseRootArg } from "../../../scripts/lib/audit-root.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/src/mcp/vice
const ROOT = resolve(HERE, "..", "..", ".."); // <root>
const SCRIPT = join(ROOT, "scripts", "generate-tool-support-table.mjs");
const TABLE = join(ROOT, "docs", "tool-support.md");

const SCRIPT_NAME = "generate-tool-support-table";

// ---------------------------------------------------------------------------
// Helpers. `refusal()` returns the Error rather than asserting inside a
// callback so each test can make several independent claims about ONE message
// -- a refusal that names the wrong token is as much a defect as one that
// never fires.
// ---------------------------------------------------------------------------

function refusal(argv: string[], booleanFlags: string[] = []): Error {
  try {
    parseRootArg(argv, { script: SCRIPT_NAME, booleanFlags });
  } catch (e) {
    return e as Error;
  }
  return assert.fail(
    `expected parseRootArg(${JSON.stringify(argv)}) to throw; it returned normally, ` +
      "which is the silent-fallback defect this seam exists to prevent",
  );
}

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(args: string[]): RunResult {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function tableBytes(): Buffer {
  return readFileSync(TABLE);
}

// ===========================================================================
// UNIT -- the real exported parser, driven directly.
// ===========================================================================

test("parseRootArg: the unflagged invocation is untouched", () => {
  const parsed = parseRootArg([], { script: SCRIPT_NAME });
  assert.equal(parsed.root, undefined);
  assert.deepEqual(parsed.flags, {});
});

test("parseRootArg: the space-separated spelling is accepted", () => {
  const parsed = parseRootArg(["--root", "/some/dir"], { script: SCRIPT_NAME });
  assert.equal(parsed.root, "/some/dir");
  assert.deepEqual(parsed.flags, {});
});

test("parseRootArg: the equals form is REJECTED, not guessed at", () => {
  const e = refusal(["--root=/some/dir"]);
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.ok(
    e.message.includes("--root=/some/dir"),
    `message must quote the offending token, got: ${e.message}`,
  );
  assert.ok(
    e.message.includes("--root <dir>"),
    `message must show the accepted spelling, got: ${e.message}`,
  );
});

test("parseRootArg: a trailing --root with no value is REJECTED", () => {
  const e = refusal(["--root"]);
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.ok(e.message.includes("--root"), `message must name the flag, got: ${e.message}`);
  assert.match(e.message, /director/i);
});

test("parseRootArg: a following token that is itself a flag is a MISSING value", () => {
  const e = refusal(["--root", "--json"], ["--json"]);
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.ok(e.message.includes("--root"), `message must name the flag, got: ${e.message}`);
});

test("parseRootArg: an empty value never resolves to the default root", () => {
  const e = refusal(["--root", ""]);
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.match(e.message, /empty/i);
  assert.match(e.message, /default root/i);
});

test("parseRootArg: an unrecognised token is REJECTED and named", () => {
  const e = refusal(["--rooot", "/some/dir"]);
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.ok(
    e.message.includes("--rooot"),
    `message must quote the unrecognised token, got: ${e.message}`,
  );
});

test("parseRootArg: a repeated --root is REJECTED, not resolved by position", () => {
  const e = refusal(["--root", "/a", "--root", "/b"]);
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.ok(e.message.includes("/a"), `message must name the first value, got: ${e.message}`);
  assert.ok(e.message.includes("/b"), `message must name the second value, got: ${e.message}`);
});

test("parseRootArg: a declared boolean flag is reported, never eaten as a value", () => {
  const before = parseRootArg(["--json", "--root", "/a"], {
    script: SCRIPT_NAME,
    booleanFlags: ["--json"],
  });
  assert.equal(before.root, "/a");
  assert.equal(before.flags["--json"], true);

  const after = parseRootArg(["--root", "/a", "--json"], {
    script: SCRIPT_NAME,
    booleanFlags: ["--json"],
  });
  assert.equal(after.root, "/a");
  assert.equal(after.flags["--json"], true);

  const absent = parseRootArg(["--root", "/a"], {
    script: SCRIPT_NAME,
    booleanFlags: ["--json"],
  });
  assert.equal(absent.flags["--json"], undefined);
});

// ---------------------------------------------------------------------------
// UNIT -- declared VALUE-taking flags (plan 32-17).
//
// WHY THESE EXIST: `scripts/audit-mutation-harness.mjs` (RETIRED) -- the one instrument
// in this phase that both MUTATES the working tree and WRITES the registry and
// the evidence file -- could not join this seam, because its `--row`, `--rows`
// and `--out` are value-taking flags the parser did not know about. It
// therefore kept its own reader, and that reader took `argv[i + 1]` with no
// missing-value check: `--row <path> --root` yielded `root === undefined`,
// which `resolveContainedRoot()` maps to the repository root with no message,
// so the run read the REAL registry while the operator believed they had
// pointed it at a synthetic tree. The alternative to the option proved below
// -- restating the three rules inside the harness -- would have recreated
// `IN-06` inside the very file this seam was extracted from.
//
// Each case drives the REAL exported parser, one rule per test, in the shape
// the nine `--root` cases above already use.
// ---------------------------------------------------------------------------

function valueRefusal(
  argv: string[],
  options: { booleanFlags?: string[]; valueFlags?: string[] } = {},
): Error {
  try {
    parseRootArg(argv, { script: SCRIPT_NAME, ...options });
  } catch (e) {
    return e as Error;
  }
  return assert.fail(
    `expected parseRootArg(${JSON.stringify(argv)}) to throw; it returned normally, ` +
      "which is the silent-fallback defect this seam exists to prevent",
  );
}

test("parseRootArg: a declared value flag's value is returned under its own token", () => {
  const parsed = parseRootArg(["--row", "src/a.ts", "--root", "/a"], {
    script: SCRIPT_NAME,
    valueFlags: ["--row"],
  });
  assert.equal(parsed.values["--row"], "src/a.ts");
  assert.equal(parsed.root, "/a");
  assert.deepEqual(parsed.flags, {});
});

test("parseRootArg: a declared value flag as the LAST argument is REJECTED, naming ITSELF", () => {
  const e = valueRefusal(["--root", "/a", "--row"], { valueFlags: ["--row"] });
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.ok(e.message.includes("`--row`"), `message must name --row, got: ${e.message}`);
  assert.ok(
    !e.message.includes("`--root` requires"),
    `message must not blame --root, got: ${e.message}`,
  );
});

test("parseRootArg: a declared value flag followed by a flag is a MISSING value", () => {
  const e = valueRefusal(["--row", "--all"], {
    booleanFlags: ["--all"],
    valueFlags: ["--row"],
  });
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.ok(e.message.includes("`--row`"), `message must name --row, got: ${e.message}`);
  assert.ok(
    e.message.includes('"--all"'),
    `message must quote the following token, got: ${e.message}`,
  );
});

test("parseRootArg: a declared value flag given an empty string is REJECTED", () => {
  const e = valueRefusal(["--out", ""], { valueFlags: ["--out"] });
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.ok(e.message.includes("`--out`"), `message must name --out, got: ${e.message}`);
  assert.match(e.message, /empty/i);
  assert.match(e.message, /NOT a request for a default/);
});

test("parseRootArg: a repeated value flag is REJECTED, not resolved by position", () => {
  const e = valueRefusal(["--rows", "a,b", "--rows", "c,d"], { valueFlags: ["--rows"] });
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.ok(e.message.includes("`--rows`"), `message must name --rows, got: ${e.message}`);
  assert.ok(e.message.includes('"a,b"'), `message must quote the first value, got: ${e.message}`);
  assert.ok(e.message.includes('"c,d"'), `message must quote the second value, got: ${e.message}`);
});

test("parseRootArg: value flags and boolean flags parse identically in any order", () => {
  const options = {
    script: SCRIPT_NAME,
    booleanFlags: ["--all"],
    valueFlags: ["--row"],
  };
  const a = parseRootArg(["--all", "--row", "X", "--root", "Y"], options);
  const b = parseRootArg(["--row", "X", "--root", "Y", "--all"], options);
  const c = parseRootArg(["--root", "Y", "--all", "--row", "X"], options);
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
  assert.equal(a.root, "Y");
  assert.equal(a.values["--row"], "X");
  assert.equal(a.flags["--all"], true);
});

test("parseRootArg: unusual-but-valid paths are accepted unchanged as value-flag values", () => {
  for (const path of ["./a/b.ts", "a/b.ts", "/abs/a/b.ts", "-not-a-flag"]) {
    const parsed = parseRootArg(["--out", path], {
      script: SCRIPT_NAME,
      valueFlags: ["--out"],
    });
    assert.equal(parsed.values["--out"], path);
  }
});

test("parseRootArg: an undeclared flag is still unrecognised when valueFlags is supplied", () => {
  const e = valueRefusal(["--roww", "src/a.ts"], { valueFlags: ["--row"] });
  assert.match(e.message, /^BAD ARGUMENTS --/);
  assert.ok(
    e.message.includes("--roww"),
    `message must quote the unrecognised token, got: ${e.message}`,
  );
});

test("parseRootArg: the widened signature is ADDITIVE -- values is empty when unused", () => {
  const unflagged = parseRootArg([], { script: SCRIPT_NAME });
  assert.deepEqual(unflagged.values, {});
  assert.deepEqual(unflagged.flags, {});
  assert.equal(unflagged.root, undefined);

  const rootOnly = parseRootArg(["--root", "/a"], { script: SCRIPT_NAME });
  assert.deepEqual(rootOnly.values, {});
  assert.deepEqual(rootOnly.flags, {});
  assert.equal(rootOnly.root, "/a");
});

test("parseRootArg: a token declared in BOTH lists is a CALLER error, not a rejection", () => {
  const e = valueRefusal(["--root", "/a"], {
    booleanFlags: ["--dup"],
    valueFlags: ["--dup"],
  });
  assert.ok(
    !e.message.startsWith("BAD ARGUMENTS --"),
    `a caller mistake must not be reported as an operator rejection, got: ${e.message}`,
  );
  assert.ok(e.message.includes("--dup"), `message must name the token, got: ${e.message}`);
  assert.match(e.message, /parseRootArg:/);
  assert.match(e.message, /caller/i);
});

// ===========================================================================
// PROCESS -- the real writing script, spawned. These are the phase-32
// verifier's own reproduced commands, inverted into acceptance criteria.
// ===========================================================================

test("the equals form refuses and leaves the REAL table byte-identical", () => {
  const before = tableBytes();
  const r = run(["--root=/tmp/definitely-not-here"]);
  assert.notEqual(r.status, 0, `expected a non-zero exit, got ${r.status}`);
  assert.match(r.stderr, /BAD ARGUMENTS/);
  assert.ok(
    tableBytes().equals(before),
    "docs/tool-support.md was modified by an invocation that must never have reached a write",
  );
});

test("a mistyped flag refuses and names the token", () => {
  const before = tableBytes();
  const r = run(["--rooot", "/tmp"]);
  assert.notEqual(r.status, 0, `expected a non-zero exit, got ${r.status}`);
  assert.ok(
    r.stderr.includes("--rooot"),
    `stderr must quote the unrecognised token, got: ${r.stderr}`,
  );
  assert.ok(tableBytes().equals(before), "docs/tool-support.md was modified by a refused run");
});

test("a valueless --root refuses and names the flag", () => {
  const before = tableBytes();
  const r = run(["--root"]);
  assert.notEqual(r.status, 0, `expected a non-zero exit, got ${r.status}`);
  assert.match(r.stderr, /BAD ARGUMENTS/);
  assert.match(r.stderr, /director/i);
  assert.ok(tableBytes().equals(before), "docs/tool-support.md was modified by a refused run");
});

test("an out-of-repository --root is REFUSED", () => {
  const before = tableBytes();
  const outside = mkdtempSync(join(tmpdir(), "audit-root-args-"));
  try {
    const r = run(["--root", outside]);
    assert.equal(r.status, 1, `expected exit 1, got ${r.status}`);
    assert.match(r.stderr, /REFUSED/);
    assert.ok(tableBytes().equals(before), "docs/tool-support.md was modified by a refused run");
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test("a sibling sharing the root's string prefix is REFUSED, not treated as a typo", () => {
  const before = tableBytes();
  const r = run(["--root", `${ROOT}-evil`]);
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}`);
  assert.match(r.stderr, /REFUSED/);
  assert.ok(
    !/TYPO/.test(r.stderr),
    `a containment refusal must not be reported as a typo, got: ${r.stderr}`,
  );
  assert.ok(tableBytes().equals(before), "docs/tool-support.md was modified by a refused run");
});

test("--root naming the repository root itself is accepted and writes identical bytes", () => {
  const before = tableBytes();
  const r = run(["--root", ROOT]);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status} (stderr: ${r.stderr})`);
  assert.ok(
    tableBytes().equals(before),
    "an explicit --root naming the repository root must be identical to no flag at all",
  );
});

// ===========================================================================
// THE ROOT-ACCEPTING MATRIX -- `gaps[1].missing[2]`, stated verbatim: "At
// least one spawnSync test per `--root`-ised script: contained root reads the
// synthetic tree; out-of-repo root exits 1 with REFUSED; `--root=<dir>` exits
// non-zero."
//
// MEASURED, 2026-09-01: EIGHT top-level `scripts/*.mjs` accept a root. Until
// plan 32-11 each of the first six carried its OWN copy of the same nine-line
// reader, so ONE defect shipped six times (IN-06) and a per-script test was
// the only thing that would have caught it.
//
// THE POPULATION IS DERIVED FROM THE FLAG, and that is the whole content of
// the completeness guard beneath this table. A `scripts/*.mjs` whose source
// carries the token `--root` is a member WHETHER OR NOT it uses the shared
// seam -- because a script that hand-rolls the reader is the defect this file
// exists to catch, and keying on the seam excludes exactly those.
//
// WHAT THIS CORRECTS, recorded rather than quietly fixed (2026-09-01, phase 32
// gap-closure round 2, plan 32-18, closing `CR-08`/Gap 5). The predicate here
// used to be `src.includes("parseRootArg(")` -- the REMEDY, not the flag -- so
// the set compared against MATRIX was "scripts that already use the seam",
// which is tautologically the set MATRIX covers. Measured at that HEAD: eight
// scripts accepted `--root` and six contained `parseRootArg(`, and the two
// invisible ones were EXACTLY the two still hand-rolling the reader
// (`audit-gate` and `audit-mutation-harness`). This docblock asserted the
// opposite twice, and the second time in the present tense: it claimed the
// table was the whole population, and that "a seventh root-accepting script
// added later fails this file by omission rather than passing unnoticed" --
// while the seventh and eighth already existed and already passed unnoticed.
// A guard added by a phase whose success criterion is "none passes vacuously"
// was itself passing vacuously with respect to its own stated purpose.
//
// The forward-looking promise, restated correctly: a NINTH root-accepting
// script added later fails this file BY OMISSION rather than passing
// unnoticed. The correct response to that failure is a MATRIX row with a typed
// expectation and its own spawned test -- never a predicate exception, an
// exclusion list or a skip.
// ===========================================================================

/** How each script is expected to behave when handed a CONTAINED root that is
 *  not the default one. The three values are contracts, not conveniences:
 *   - "repo-root": the root IS the repository root. Accepted, runs, exits 0.
 *     This is the `[edge:CUT-04/adjacency]` accept side -- a root exactly
 *     equal to the default root is the same tree, never a second one.
 *   - "synthetic-corpus": the gate whose comparison data follows the root.
 *     Runs against a synthetic in-repository tree and REPORTS THAT TREE.
 *   - "refuses": the script binds its comparison data through a static import
 *     that cannot follow a root override, so ANY contained root that is not
 *     the default root is refused outright.
 *   - "uncontained-read-only": the script accepts an UNCONTAINED root BY
 *     DESIGN, and that asymmetry is a decision rather than an omission (plan
 *     32-16, recorded in `scripts/audit-gate.mjs`'s own header). The basis is
 *     measured, not assumed: the script performs NO FILESYSTEM WRITE, so the
 *     trust boundary containment guards -- which tree a script WRITES -- does
 *     not exist for it; and its own test suite REQUIRES the uncontained path,
 *     pointing it at `mkdtempSync(tmpdir())` trees outside the repository for
 *     a reason recorded at `audit-integrity.test.ts`. The expectation is
 *     therefore PAIRED WITH THE WRITE-FREEDOM ASSERTION at the bottom of this
 *     file, which REVOKES the acceptance the moment a write appears. It is not
 *     an escape hatch for a script whose test is inconvenient: carrying this
 *     value costs you a standing proof that you still write nothing.
 *
 *  WHAT CHANGED HERE AND WHY (plan 32-12): plan 32-11 wrote the "refuses"
 *  expectation deliberately loose -- "non-zero plus a diagnostic naming the
 *  script" and nothing narrower -- because at that point these four stopped
 *  for an INCIDENTAL reason (the fixture carried none of their inputs, so the
 *  missing-input TYPO diagnostic fired) and the plan that would give them a
 *  principled one had not landed. It has now. The expectation is tightened to
 *  the specific literal, because the loose shape is satisfied by BOTH the old
 *  incidental stop and the new principled refusal, and a test that cannot tell
 *  them apart cannot detect a regression back to the first. */
type ContainedExpectation =
  | "repo-root"
  | "synthetic-corpus"
  | "refuses"
  | "uncontained-read-only";

interface MatrixRow {
  script: string;
  contained: ContainedExpectation;
  /** Arguments this script needs before the behaviour under test is REACHABLE.
   *  Supplied in code and NEVER from argv, an environment variable or a file --
   *  the same rule `booleanFlags` and `valueFlags` already carry at the seam. */
  extraArgs?: string[];
}

const MATRIX: MatrixRow[] = [
  { script: "generate-tool-support-table", contained: "refuses" },
  { script: "check-skill-tool-coverage", contained: "refuses" },
  { script: "check-skill-fork-honesty", contained: "refuses" },
  { script: "check-skill-cli-invocations", contained: "refuses" },
  { script: "check-skill-description-overlap", contained: "synthetic-corpus" },
  // Uncontained by design (plan 32-16). Needs no extra arguments: `--root` is
  // its only positional concern and both its other flags are optional booleans.
  { script: "audit-gate", contained: "uncontained-read-only" },
];

function runScript(script: string, args: string[]): RunResult {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", `${script}.mjs`), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

// ---------------------------------------------------------------------------
// THE SPLIT-READ CONTRACT and its two text predicates.
// ---------------------------------------------------------------------------
//
// THE RULE, in one sentence a future reader can act on: a script that accepts
// a `--root` override may NOT statically import its comparison data from the
// default root unless it also refuses a root that is not the default root.
//
// This is the invariant companion to plan 32-10's `<assumption_delta_decision>`
// -- the promotion that exactly ONE root governs every read in one invocation.
// That decision says what must be true; this rule is what keeps it true, and
// the two are findable from each other by name.
//
// WHY A TEXT PREDICATE RATHER THAN A BEHAVIOURAL ONE: the antecedent is a
// property of the module graph ("binds a `../src/` specifier statically"), and
// a static import is not observable from outside the process. The spawned
// matrix above proves the CONSEQUENT behaves; this proves the IMPLICATION holds
// for every member of the population, including ones a future phase adds.
//
// The predicates are declared once and driven against BOTH the real files and
// the planted texts below -- following this repository's planted-violation
// convention: a violation is planted against the REAL predicate, never against
// a re-implementation of it.

/** The message prefix the four refusing scripts print. Contract surface: it is
 *  what the matrix above asserts and what the rule below looks for. */
const SPLIT_READ_REFUSAL = "SPLIT READ REFUSED";

/** Read a script exactly as bytes-to-text, with no transcoding surprises.
 *  `latin1` matches this phase's document-sweep convention. MEASURED, not
 *  assumed: no member of the ROOT-ACCEPTING POPULATION carries a NUL byte
 *  (asserted below, driven from the population function rather than from a
 *  hard-coded list, so the measurement cannot fall behind the way the matrix
 *  did), so a plain text read loses nothing here -- the hazard that motivates
 *  `grep -a` elsewhere in this repository does not apply to this population. */
function scriptText(script: string): string {
  return readFileSync(join(ROOT, "scripts", `${script}.mjs`), "latin1");
}

/** THE ANTECEDENT. Every `../src/` specifier the text binds through a static
 *  `import`/`export ... from` statement.
 *
 *  The pattern requires WHITESPACE after `from`, which is what distinguishes a
 *  static import specifier (`from "../src/x.ts"`) from the object property the
 *  four refusing scripts use to NAME those specifiers (`from: "../src/x.ts"`)
 *  and from a dynamic `import("../src/x.ts")`, neither of which is a static
 *  binding. That distinction is stated here rather than left to be rediscovered
 *  the first time someone wonders why the declaration list does not count
 *  itself. */
function staticSrcImports(text: string): string[] {
  return [...text.matchAll(/\bfrom\s+"(\.\.\/src\/[^"]*)"/g)].map((m) => m[1]!).sort();
}

/** THE CONSEQUENT. */
function carriesSplitReadRefusal(text: string): boolean {
  return text.includes(SPLIT_READ_REFUSAL);
}

/** THE RULE. True when the text breaks it. */
function violatesSplitReadContract(text: string): boolean {
  return staticSrcImports(text).length > 0 && !carriesSplitReadRefusal(text);
}

/** The specifiers a script DECLARES in its own `STATICALLY_BOUND` list -- the
 *  list its refusal message prints. Compared against `staticSrcImports()` below
 *  so a future third import cannot be added without also being named. */
function declaredSplitReadImports(text: string): string[] {
  const block = text.match(/const STATICALLY_BOUND = \[([\s\S]*?)\];/);
  if (!block) return [];
  return [...block[1]!.matchAll(/from:\s*"([^"]+)"/g)].map((m) => m[1]!).sort();
}

/** The `--root` flag itself -- the token the population is keyed on. Named as a
 *  constant so the population predicate and the assertion messages below cannot
 *  drift apart from each other. */
const ROOT_FLAG = "--root";

interface PopulationWalk {
  /** Every top-level `scripts/*.mjs` this walk VISITED, basename INCLUDING the
   *  extension. This is the set the independent cross-check compares against;
   *  it is deliberately the visited set rather than the population, because a
   *  file silently skipped by the walk never reaches the `--root` test at all. */
  visited: string[];
  /** The members: visited files whose source carries the `--root` token, with
   *  the extension stripped so they compare directly against MATRIX rows. */
  accepting: string[];
}

/** Every top-level `scripts/*.mjs` that ACCEPTS a root, HOWEVER IT READS IT.
 *
 *  DERIVING FROM THE FLAG RATHER THAN FROM THE REMEDY IS LOAD-BEARING, and is
 *  the single correction plan 32-18 exists to make: a script that hand-rolls
 *  the argv reader is precisely the defect this file exists to catch (IN-06),
 *  and keying the population on a call to the shared seam excludes exactly
 *  those. See the MATRIX docblock above for what that cost when it was keyed on
 *  `parseRootArg(` instead.
 *
 *  Derived from disk rather than listed, so the completeness guard below
 *  measures the tree instead of restating this file's own table. `scripts/lib/`
 *  is excluded by `entry.isFile()` because that is where the seam itself lives.
 *  The read is the same `latin1` byte-preserving read `scriptText()` uses, so a
 *  NUL byte cannot silently truncate it and shrink the population. */
function walkRootAcceptingScripts(): PopulationWalk {
  const dir = join(ROOT, "scripts");
  const visited: string[] = [];
  const accepting: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
    visited.push(entry.name);
    const src = readFileSync(join(dir, entry.name), "latin1");
    if (src.includes(ROOT_FLAG)) accepting.push(entry.name.replace(/\.mjs$/, ""));
  }
  return { visited: visited.sort(), accepting: accepting.sort() };
}

function scriptsAcceptingARoot(): string[] {
  return walkRootAcceptingScripts().accepting;
}

/** THE INDEPENDENT SIDE of the population cross-check, and the choice of
 *  mechanism IS the entire content of this function.
 *
 *  The walk above is `readdirSync` + `isFile()` + a Node-side read, inside this
 *  process. Comparing it against a SECOND `readdirSync` carrying the same
 *  filter would be an assertion that CANNOT DISAGREE -- a tautological guard
 *  added to the very file whose tautological population is the defect being
 *  closed here. So the second side is not a Node directory read at all: a shell
 *  is spawned and IT expands the glob, in another process, with no `isFile()`
 *  test and no Node-side read. A Node-side filter change, a read failure, or a
 *  byte that defeats a Node read therefore moves ONE number and not the other,
 *  which is exactly the class of skip this cross-check exists to catch.
 *
 *  THE SHELL COMMAND IS FIXED, because the obvious form is the wrong one.
 *  `printf '%s\n' scripts/*.mjs` emits one path per line. Do NOT use a bare
 *  `ls scripts/*.mjs`: measured in this repository against this plan's own
 *  probe, an `ls` whose glob matches a DIRECTORY descends into it and prints
 *  its contents under a `scripts/<name>:` header preceded by a blank line,
 *  emitting the directory's name with a trailing colon instead of the path
 *  itself. That defeats the probe twice over -- a phantom empty-string member
 *  and a colon-suffixed member enter the listing side, so the assertion reds
 *  for the wrong reason and a reader records a red that does not mean what it
 *  appears to mean. `ls -d scripts/*.mjs` is an acceptable equivalent; `ls`
 *  without `-d` is not. The two filters below guard that form against being
 *  reintroduced later rather than trusting this comment. */
function shellListedMjs(): string[] {
  const r = spawnSync("/bin/sh", ["-c", "printf '%s\\n' scripts/*.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `the independent shell listing failed: ${r.stderr}`);
  const raw = (r.stdout ?? "").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    const path = line.trim();
    // Both of these are the SIGNATURE OF A BARE `ls` recursing into a directory
    // member: a blank separator line, and the directory's own name emitted with
    // a trailing colon as a group header. Dropped explicitly so reintroducing
    // that form cannot quietly inject two phantom members.
    if (path.length === 0) continue;
    if (path.endsWith(":")) continue;
    // An unexpanded glob means NO match, not a member literally named `*.mjs`.
    if (path.includes("*")) continue;
    out.push(path.slice(path.lastIndexOf("/") + 1));
  }
  return out.sort();
}

test("the population walk sees every scripts/*.mjs an independent mechanism sees", () => {
  const walked = walkRootAcceptingScripts().visited;
  const listed = shellListedMjs();

  // Reported in BOTH directions, and as NAMED LISTS rather than counts. A count
  // comparison tells you a number moved; a list comparison names the file --
  // and this gap exists precisely because a guard reported a state without
  // naming the members it could not see.
  const walkedNotListed = walked.filter((n) => !listed.includes(n));
  const listedNotWalked = listed.filter((n) => !walked.includes(n));

  const why =
    "The population walk and this listing are DELIBERATELY DIFFERENT MECHANISMS: the walk is " +
    "readdirSync + isFile() + a Node read inside this process; the listing is a spawnSync " +
    "shell glob expansion in another process with no isFile() filter and no Node read. " +
    "COLLAPSING THEM INTO THE SAME MECHANISM SILENTLY VOIDS THIS CHECK -- two readdirSync " +
    "calls sharing a filter cannot disagree, which is the exact tautology this file was " +
    "corrected to remove. An equality produced by a census must be provably a real one here: " +
    "a plain census over this repository's sources has already produced one false decision.";

  assert.deepEqual(
    walkedNotListed,
    [],
    `a file the walk visited is absent from the independent listing. ${why}`,
  );
  assert.deepEqual(
    listedNotWalked,
    [],
    "a scripts/*.mjs is present on disk but was SKIPPED by the population walk, so it could " +
      `never have been tested for the ${ROOT_FLAG} token. ${why}`,
  );
  assert.deepEqual(walked, listed, `the two mechanisms disagree about scripts/*.mjs. ${why}`);
});

test("the matrix covers EVERY root-accepting script", () => {
  const onDisk = scriptsAcceptingARoot();
  const covered = MATRIX.map((r) => r.script).sort();
  // Both sides sorted by the same comparison, so the verdict does not depend on
  // directory-listing order and a row added in any position is equivalent
  // (`[edge:CUT-04/ordering]`).
  assert.deepEqual(
    onDisk,
    covered,
    `a script accepting ${ROOT_FLAG} exists that this file does not exercise (or vice versa). ` +
      "The population is derived from the FLAG, not from the shared seam, so a script that " +
      "hand-rolls the reader is a member too -- that is the whole point. Add the missing row " +
      "to MATRIX with a typed expectation and its own spawned test. Do NOT relax this " +
      "assertion, and do NOT add an exclusion list, an unmigrated-scripts array or a skip: " +
      "removing a " +
      "member from measurement is the defect this guard was corrected to stop having.",
  );
  // A NON-VACUITY FLOOR, to be RAISED and NEVER LOWERED BY ITSELF. It was six
  // while the population was keyed on the shared seam; the flag-derived
  // population was eight. It reads six again, and the ONE admissible reason a
  // floor like this moves down is recorded here rather than left to be
  // reconstructed: `check-guard-fates.mjs` and `audit-mutation-harness.mjs`
  // were RETIRED WITH THEIR SUBJECT, in the same commit that lowered this
  // number -- they are gone from the tree, not excluded from measurement. No
  // exclusion list, no skip, no unmigrated-scripts array was added. Lowering
  // this for any other reason would silently re-admit the state this guard
  // exists to report.
  assert.ok(
    covered.length >= 6,
    `expected at least the six known root-accepting scripts, measured ${covered.length}`,
  );
});

// --- Case 1 of 3, per script: the equals form ------------------------------

for (const { script, extraArgs = [] } of MATRIX) {
  test(`${script}: the equals form exits non-zero and names itself`, () => {
    const r = runScript(script, ["--root=/tmp/definitely-not-here", ...extraArgs]);
    assert.notEqual(r.status, 0, `expected a non-zero exit, got ${r.status}`);
    assert.ok(
      r.stderr.includes(`${script}: BAD ARGUMENTS --`),
      `stderr must carry the argument-rejection prefix naming this script, got: ${r.stderr}`,
    );
  });
}

// --- Case 2 of 3, per script: an out-of-repository root --------------------

// TYPED, NOT UNIVERSAL (plan 32-18). This case used to run for every row and
// assert that EVERY script refuses an out-of-repository root. That is true of
// seven of the eight and FALSE OF THE EIGHTH BY DESIGN, so the two directions
// are now two separate tests keyed on the expectation. Asserting both in one
// generic case would let either pass for the other's reason -- and `audit-gate`
// and `audit-mutation-harness` are exactly the adjacency that needs separating:
// both accept `--root`, both are on the shared argv seam, and they differ ONLY
// in containment (`[edge:CUT-06/adjacency]`).

for (const { script, contained, extraArgs = [] } of MATRIX) {
  if (contained === "uncontained-read-only") continue;
  test(`${script}: an out-of-repository root exits 1 with REFUSED`, () => {
    const outside = mkdtempSync(join(tmpdir(), "audit-root-args-"));
    try {
      const r = runScript(script, ["--root", outside, ...extraArgs]);
      assert.equal(r.status, 1, `expected exit 1, got ${r.status} (stderr: ${r.stderr})`);
      assert.ok(
        r.stderr.includes(`${script}: REFUSED --`),
        `stderr must carry the containment-refusal prefix naming this script, got: ${r.stderr}`,
      );
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
}

// --- Case 2b: the OPPOSITE direction, for the uncontained-by-design rows -----

for (const { script, contained, extraArgs = [] } of MATRIX) {
  if (contained !== "uncontained-read-only") continue;
  test(`${script}: an out-of-repository root is ACCEPTED as an argument, by design`, () => {
    const outside = mkdtempSync(join(tmpdir(), "audit-root-args-"));
    try {
      const r = runScript(script, ["--root", outside, ...extraArgs]);
      // The claim is NOT "it exits 0" -- an empty directory carries none of
      // this gate's inputs, so it will fail on its own terms. The claim is that
      // the run REACHED the gate's own logic instead of being turned away at
      // the argument boundary. Both refusal prefixes must therefore be absent.
      assert.ok(
        !r.stderr.includes(`${script}: REFUSED --`),
        "this script is uncontained BY DESIGN (it performs no write, see the write-freedom " +
          "assertion below); an out-of-repository root must NOT be turned away by the " +
          `containment seam, got: ${r.stderr}`,
      );
      assert.ok(
        !r.stderr.includes(`${script}: BAD ARGUMENTS --`),
        "an existing out-of-repository directory is a well-formed value for this flag; it " +
          `must not be reported as an argument rejection, got: ${r.stderr}`,
      );
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
}

// --- Case 3 of 3, per script: a CONTAINED root -----------------------------
//
// The four "refuses" scripts share one in-repository fixture shape: a root that
// is contained but is not the repository root. The refusal fires BEFORE the
// fixture's contents are ever consulted, so the fixture is deliberately left
// empty -- if a future change made the refusal depend on what the tree carries,
// this case would stop passing, which is the point.

for (const { script, contained, extraArgs = [] } of MATRIX) {
  if (contained !== "refuses") continue;
  test(`${script}: a contained root that is not the default root is a SPLIT READ refusal`, (t) => {
    const fixture = mkdtempSync(join(ROOT, ".audit-root-synth-"));
    t.after(() => rmSync(fixture, { recursive: true, force: true }));
    try {
      const r = runScript(script, ["--root", fixture, ...extraArgs]);
      assert.notEqual(
        r.status,
        0,
        "a contained root that is not the default root must NOT exit 0 -- exiting 0 here " +
          "would mean the run compared a corpus from the resolved root against comparison " +
          `data from the default root (stdout: ${r.stdout})`,
      );
      assert.ok(
        r.stderr.includes(`${script}: ${SPLIT_READ_REFUSAL}`),
        `stderr must carry the split-read refusal prefix naming this script, got: ${r.stderr}`,
      );
      // The refusal must be DIAGNOSABLE: it names the resolved root, the
      // default root, and at least one identifier it could not move. A refusal
      // that says only "refused" leaves the operator to re-derive the reason,
      // which is how the false claim this plan deleted survived so long.
      assert.ok(
        r.stderr.includes(fixture),
        `the refusal must name the resolved root it refused, got: ${r.stderr}`,
      );
      assert.ok(
        r.stderr.includes(ROOT),
        `the refusal must name the default root it would have read instead, got: ${r.stderr}`,
      );
      for (const specifier of declaredSplitReadImports(scriptText(script))) {
        assert.ok(
          r.stderr.includes(specifier),
          `the refusal must name ${specifier}, the module it could not move, got: ${r.stderr}`,
        );
      }
      // And it must have refused BEFORE reading anything: the missing-input
      // diagnostic that used to fire on this fixture must no longer appear.
      assert.ok(
        !r.stderr.includes("FAIL (--root)"),
        "the split-read refusal must precede the missing-input sweep -- reaching the sweep " +
          `means a read happened under a root that cannot be honoured: ${r.stderr}`,
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}

// --- The `[edge:CUT-04/adjacency]` accept side, per refusing script ---------
//
// A root that RESOLVES to the repository root is the same tree, however it is
// spelled, so it must behave exactly like the unflagged invocation. Three
// spellings are asserted per script -- `.`, the absolute path, and a path
// carrying a redundant `scripts/..` segment -- because the refusal compares
// RESOLVED paths, and a comparison written against the raw argument instead
// would accept only one of the three.
//
// This is the one place this file's "no repeated end-to-end run" discipline is
// deliberately widened, so the new budget is stated rather than quietly spent:
// four scripts x four runs (one unflagged baseline plus three spellings) = 16
// full runs, measured at 194/299/151/353 ms each, ~4 s in total. The rule's
// purpose is to keep this file from becoming a slow re-run of the whole audit;
// four seconds against a 6 s file is within that purpose. The one script with a
// working-tree side effect under the default root -- the invocations gate,
// which regenerates `installer/skills/` -- is idempotent, and the porcelain
// check in plan 32-12's evidence record confirms the tree is byte-identical
// afterwards.

for (const { script, contained, extraArgs = [] } of MATRIX) {
  if (contained !== "refuses") continue;
  test(`${script}: every spelling that RESOLVES to the repository root is accepted`, () => {
    const baseline = runScript(script, [...extraArgs]);
    for (const spelling of [".", ROOT, join(ROOT, "scripts", ".."), "./scripts/.."]) {
      const r = runScript(script, ["--root", spelling, ...extraArgs]);
      assert.equal(
        r.status,
        baseline.status,
        `--root ${spelling} resolves to the repository root and must behave exactly like the ` +
          `unflagged run (got ${r.status}, unflagged ${baseline.status}); stderr: ${r.stderr}`,
      );
      assert.ok(
        !r.stderr.includes(SPLIT_READ_REFUSAL),
        `--root ${spelling} resolves to the repository root, so there is no split read to ` +
          `refuse -- a refusal here means the comparison was written against the raw ` +
          `argument rather than the resolved path: ${r.stderr}`,
      );
    }
  });
}


// --- The synthetic-corpus read proof ---------------------------------------
//
// WHAT DISCRIMINATES THE TWO READS, stated explicitly because a case that
// passes under BOTH reads proves nothing and is the exact shape of the defect
// being closed:
//
//   - BOTH halves synthetic (what a correct single-root read produces):
//     exit 0, and stdout says `6 skills scanned (synth-...)` and
//     `CLAUDE.md project-skills table: 6 rows, all byte-identical to their
//     SKILL.md.`
//   - SPLIT read (skills from the synthetic tree, CLAUDE.md from the real
//     repository): the real table's rows name real skills the synthetic
//     corpus does not contain, and the synthetic corpus's skills are absent
//     from the real table, so every row on both sides is a disagreement and
//     the gate FAILS with exit 1 while printing real skill names.
//
// Exit 0 together with the synthetic counts is therefore reachable ONLY when
// both halves come from the resolved root. The negative assertion below -- no
// real skill name in the report -- is what makes that discrimination
// load-bearing rather than decorative.

/** Six synthetic skills. Six, not fewer, because the gate's non-vacuity floor
 *  is six; deliberately disjoint vocabulary so no pair can collide and turn
 *  this read proof into a collision test by accident. */
const SYNTH_SKILLS: ReadonlyArray<readonly [string, string]> = [
  ["synth-alpha", "Quintle vorbex ledgers for zephyr couriers."],
  ["synth-bravo", "Marrow flindle beacons for tarquin wardens."],
  ["synth-charlie", "Perigee snorkle almanacs for velvet janitors."],
  ["synth-delta", "Bramble quixote turbines for oyster harbingers."],
  ["synth-echo", "Fennel wobbleg cathedrals for nutmeg drovers."],
  ["synth-foxtrot", "Lantern grumbo pistons for cobalt thimbles."],
];

function buildSyntheticCorpus(): string {
  const dir = mkdtempSync(join(ROOT, ".audit-root-synth-"));
  const skillsDir = join(dir, "src", "skills");
  for (const [name, description] of SYNTH_SKILLS) {
    mkdirSync(join(skillsDir, name), { recursive: true });
    writeFileSync(
      join(skillsDir, name, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${description}\n---\n\nSynthetic fixture body.\n`,
      "utf8",
    );
  }
  const rows = SYNTH_SKILLS.map(
    ([name, description]) => `| ${name} | ${description} | \`src/skills/${name}/SKILL.md\` |`,
  ).join("\n");
  writeFileSync(
    join(dir, "CLAUDE.md"),
    `## Project Skills\n\n| Skill | Description | Path |\n|-------|-------------|------|\n${rows}\n`,
    "utf8",
  );
  return dir;
}

test("check-skill-description-overlap: a contained root REDIRECTS the reads, provably", (t) => {
  const fixture = buildSyntheticCorpus();
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  try {
    const r = runScript("check-skill-description-overlap", ["--root", fixture]);
    assert.equal(r.status, 0, `expected exit 0, got ${r.status} (stderr: ${r.stderr})`);

    // Positive: the synthetic corpus is what was read.
    assert.ok(
      r.stdout.includes(`${SYNTH_SKILLS.length} skills scanned`),
      `expected the synthetic corpus's count, got stdout: ${r.stdout}`,
    );
    for (const [name] of SYNTH_SKILLS) {
      assert.ok(r.stdout.includes(name), `expected ${name} in the report, got: ${r.stdout}`);
    }
    // Positive: the synthetic CLAUDE.md is what was compared against it. This
    // is the half a split-root read would take from the real repository.
    assert.ok(
      r.stdout.includes(`${SYNTH_SKILLS.length} rows, all byte-identical to their SKILL.md`),
      `expected the synthetic project-skills table to be the one compared, got: ${r.stdout}`,
    );

    // Negative: nothing from the real repository leaked into the answer. A
    // real skill name here means the corpus walk read the real tree.
    assert.ok(
      !r.stdout.includes("acme-build"),
      "a real skill name appeared in a --root run's report, which means the real tree was " +
        `read: ${r.stdout}`,
    );

    // THE TARGETING CONTROL for plan 32-12's refusal. This gate is handed
    // exactly the kind of root the other four now refuse, and it must NOT
    // refuse: the new rule is conditioned on binding comparison data through a
    // static import, and this gate binds none. Without this assertion a future
    // change could make the refusal blanket -- killing the one root override
    // that works -- and every other case in this file would still pass.
    assert.ok(
      !r.stderr.includes(SPLIT_READ_REFUSAL),
      "the split-read refusal must be targeted, not blanket: this gate's comparison data " +
        `follows --root, so there is no split read to refuse. stderr: ${r.stderr}`,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

// --- The repeated-flag rule, at process level ------------------------------

test("a repeated --root is rejected by the spawned script, naming BOTH values", () => {
  // `[edge:CUT-04/ordering]`, first half: where two argv tokens compare equal,
  // the resolution is SPECIFIED (a hard error) rather than positional, so no
  // invocation's meaning depends on which copy the parser happened to keep.
  const r = runScript("audit-gate", ["--root", "/a", "--root", "/b"]);
  assert.notEqual(r.status, 0, `expected a non-zero exit, got ${r.status}`);
  assert.ok(r.stderr.includes("BAD ARGUMENTS"), `got: ${r.stderr}`);
  assert.ok(r.stderr.includes("/a"), `stderr must name the first value, got: ${r.stderr}`);
  assert.ok(r.stderr.includes("/b"), `stderr must name the second value, got: ${r.stderr}`);
});

test("a declared boolean flag is never swallowed as the root's value", () => {
  // The shared parser must not regress a flag a consumer already accepted.
  // The ACCEPT side of that claim -- `--json --root .` and `--root . --json`
  // both exiting 0 with identical JSON -- is asserted against the real parser
  // in the unit block above, and is measured end to end in plan 32-11's
  // verification record. It is deliberately NOT re-run here: each of those
  // orderings is a FULL run of the fate guard, and this file runs no script to
  // completion twice.
  const swallowed = runScript("audit-gate", ["--root", "--json"]);
  assert.notEqual(swallowed.status, 0, "`--root --json` must be a MISSING value, not a value");
  assert.ok(swallowed.stderr.includes("BAD ARGUMENTS"), `got: ${swallowed.stderr}`);
  assert.ok(
    swallowed.stderr.includes("--json"),
    `the rejection must name the token it refused to treat as a value, got: ${swallowed.stderr}`,
  );
});

// ===========================================================================
// THE SPLIT-READ CONTRACT -- non-vacuous in BOTH directions.
//
// Every assertion in this block drives the predicates declared beside
// `runScript()` above. The planted cases drive the SAME functions the real
// files are driven through, so the rule cannot pass because the plant was
// checked against a copy of it.
// ===========================================================================

test("no root-accepting script carries a NUL byte, so a text read of them loses nothing", () => {
  // Recorded as a MEASURED fact rather than an assumption. A source file in
  // this repository is known to carry a NUL byte, which hides it from a plain
  // `grep` and has already produced one false decision; the predicates above
  // read text, so the population they read must be verified NUL-free rather
  // than presumed so.
  //
  // DRIVEN FROM THE POPULATION FUNCTION, not from MATRIX and not from a
  // hard-coded list. Keying this on MATRIX would make it measure whatever the
  // table happens to carry -- the same remedy-shaped derivation that let two
  // root-accepting scripts go unseen here for a whole round.
  const population = scriptsAcceptingARoot();
  assert.ok(
    population.length >= 6,
    "the NUL sweep must cover the whole root-accepting population; it selected " +
      `${population.length}: ${population.join(", ")}`,
  );
  for (const script of population) {
    assert.ok(
      !scriptText(script).includes("\u0000"),
      `${script}.mjs carries a NUL byte -- the text predicates above would silently ` +
        "mis-measure it, and this whole block would need a byte-level read instead",
    );
  }
});

test("split-read contract: every root-accepting script that binds ../src statically refuses", () => {
  const bound: string[] = [];
  const clean: string[] = [];

  for (const { script } of MATRIX) {
    const text = scriptText(script);
    (staticSrcImports(text).length > 0 ? bound : clean).push(script);
    assert.equal(
      violatesSplitReadContract(text),
      false,
      `${script}.mjs binds comparison data from the default root through a static import but ` +
        `carries no "${SPLIT_READ_REFUSAL}" refusal. Under a --root tree it would compare a ` +
        "corpus read from the resolved root against data read from the default root -- a false " +
        "green inside the audit instrument itself (CR-03). Either refuse the root, or make the " +
        "comparison data follow it; do NOT relax this assertion.",
    );
  }

  // NON-VACUITY, POSITIVE DIRECTION. A rule that passes because its antecedent
  // matched nothing proves nothing -- the exact failure mode `CUT-03` exists to
  // forbid -- so the population the antecedent actually selected is asserted.
  assert.ok(
    bound.length >= 4,
    `the antecedent must select at least the four known split-read scripts; it selected ` +
      `${bound.length}: ${bound.join(", ")}`,
  );
  for (const script of bound) {
    assert.ok(
      carriesSplitReadRefusal(scriptText(script)),
      `${script}.mjs is selected by the antecedent but carries no refusal literal`,
    );
  }

  // THE TWO CLEAN CONTROLS, asserted SPECIFICALLY rather than left to pass by
  // silence. They satisfy the rule by carrying no matching import at all, and
  // saying so here is what makes a future edit that gives one of them such an
  // import -- without a refusal -- fail this assertion instead of sliding past
  // it as "still no violations found".
  assert.deepEqual(
    clean.sort(),
    ["audit-gate", "check-skill-description-overlap"],
    "the clean controls changed. `check-skill-description-overlap` is the one skill gate that " +
      "honours an arbitrary contained root for BOTH halves of its comparison. `audit-gate` " +
      "joined this population in plan 32-18 when it was keyed on the FLAG rather than on the " +
      "shared seam; MEASURED there, it binds no ../src specifier statically, so the " +
      "split-read contract is satisfied for both by carrying no matching import at all rather " +
      "than by carrying a refusal. If either now binds a ../src import, it needs a refusal " +
      "too; if a THIRD script became clean, its refusal may have been deleted.",
  );
  for (const script of clean) {
    assert.deepEqual(
      staticSrcImports(scriptText(script)),
      [],
      `${script}.mjs must bind no ../src specifier statically -- that is the whole reason it ` +
        "is exempt from the refusal",
    );
  }
});

test("split-read contract: each refusal NAMES every specifier its script binds statically", () => {
  // The refusal message is only diagnosable if it enumerates what it could not
  // move. This ties the printed list to the actual imports, so adding a third
  // static import without adding it to STATICALLY_BOUND fails here rather than
  // producing a refusal that quietly under-reports its own reason.
  for (const { script, contained } of MATRIX) {
    if (contained !== "refuses") continue;
    const text = scriptText(script);
    assert.deepEqual(
      declaredSplitReadImports(text),
      staticSrcImports(text),
      `${script}.mjs's STATICALLY_BOUND list disagrees with the specifiers it actually binds`,
    );
    assert.ok(
      declaredSplitReadImports(text).length > 0,
      `${script}.mjs must declare at least one bound specifier`,
    );
  }
});

test("split-read contract: the predicate REPORTS a planted violation, and clears a planted fix", () => {
  // NON-VACUITY, NEGATIVE DIRECTION. Planted against the REAL predicate, per
  // this repository's convention -- text in place of a registry object.
  const planted =
    '#!/usr/bin/env node\nimport { CAPABILITY_REGISTRY } from "../src/mcp/vice/capability-registry.ts";\n' +
    'import { parseRootArg, resolveContainedRoot } from "./lib/audit-root.mjs";\n' +
    "const RESOLVED_ROOT = resolveContainedRoot(parseRootArg(process.argv.slice(2), {}).root, {});\n" +
    "console.log(RESOLVED_ROOT, CAPABILITY_REGISTRY.length);\n";

  assert.deepEqual(
    staticSrcImports(planted),
    ["../src/mcp/vice/capability-registry.ts"],
    "the planted text must be SELECTED by the antecedent, or the negative control proves " +
      "nothing about scripts that are",
  );
  assert.equal(
    carriesSplitReadRefusal(planted),
    false,
    "the planted text must carry no refusal -- that is the violation being planted",
  );
  assert.equal(
    violatesSplitReadContract(planted),
    true,
    "the predicate that clears all six real scripts must REPORT this planted violation; if it " +
      "does not, the pass above is vacuous",
  );

  // And the control on the control: the same predicate must CLEAR the same
  // text once the refusal is added, so it is reporting the missing refusal
  // rather than merely reporting the import.
  const fixed = planted.replace(
    "console.log(",
    `if (RESOLVED_ROOT !== ".") { console.error("x: ${SPLIT_READ_REFUSAL} -- y"); process.exit(1); }\nconsole.log(`,
  );
  assert.deepEqual(
    staticSrcImports(fixed),
    ["../src/mcp/vice/capability-registry.ts"],
    "the fixed text must still be selected by the antecedent",
  );
  assert.equal(
    violatesSplitReadContract(fixed),
    false,
    "the predicate must clear a text that carries the refusal -- otherwise it is reporting the " +
      "import, not the missing refusal, and every refusing script would be a false positive",
  );
});

// ===========================================================================
// THE WRITE-FREEDOM ASSERTION over `scripts/audit-gate.mjs` -- the SOLE
// MECHANICAL REVOCATION of plan 32-16's containment acceptance (`T-32-22`).
//
// That plan accepted `audit-gate` as uncontained on a MEASURED basis: the
// script performs no filesystem write, so the trust boundary containment
// guards -- which tree a script WRITES -- does not exist for it. Its header
// records the acceptance and names its own reversal trigger. This is where
// that trigger is armed: an acceptance whose reversal depends on somebody
// remembering it is not a reversal condition, it is a hope.
//
// TWO HALVES, because they fail in DIFFERENT DIRECTIONS. A deny-list over call
// sites is open-ended (a write can always be spelled a new way); an allow-list
// over the import surface is closed (a directly-imported name must be bound
// before it can be called). Neither alone is enough, and neither is a
// completeness proof -- the residual holes are NAMED below rather than implied.
// ===========================================================================

const UNCONTAINED_BY_DESIGN = MATRIX.filter(
  (r) => r.contained === "uncontained-read-only",
).map((r) => r.script);

/** Source with whole-line comments and trailing line comments removed.
 *
 *  STRIPPING COMMENTS FIRST IS LOAD-BEARING, and the reason is measured rather
 *  than defensive: `audit-gate.mjs` DISCUSSES writes in prose throughout its
 *  header and its Bash-writer section, and plan 32-16 added a further header
 *  note whose stated reversal condition is a write call appearing in this file.
 *  An unstripped count would therefore red on the prose that documents the
 *  assertion -- a self-invalidating header, which is the shape plan 32-16
 *  already avoids for its own containment-resolver count. Same form here. */
function withoutComments(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim().startsWith("//") ? "" : line.replace(/\/\/.*$/, "")))
    .join("\n");
}

/** The ENUMERATED filesystem-write API set. Enumerated rather than gestured at
 *  because a `writeFileSync`-only check is MEASURED-INADEQUATE: it would miss
 *  every other member below. Extend this list when Node grows a new write API;
 *  do not narrow it. */
const FS_WRITE_APIS = [
  "writeFileSync",
  "appendFileSync",
  "createWriteStream",
  "mkdirSync",
  "rmSync",
  "rmdirSync",
  "unlinkSync",
  "renameSync",
  "cpSync",
  "copyFileSync",
  "truncateSync",
  "writeSync",
  // The `node:fs/promises` forms.
  "writeFile(",
  "appendFile(",
  "copyFile(",
] as const;

for (const script of UNCONTAINED_BY_DESIGN) {
  test(`${script}: E1 -- the DIRECT fs import surface is exactly the read-only set`, () => {
    const text = scriptText(script);

    // Every name bound from `node:fs`, in declaration order.
    const fsImports = [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"node:fs"/g)]
      .flatMap((m) => m[1]!.split(","))
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .sort();

    assert.deepEqual(
      fsImports,
      ["readFileSync", "readdirSync"],
      `${script}.mjs must bind ONLY read APIs from node:fs. A new name here means the ` +
        "performs-no-filesystem-write basis recorded in this script's header and in plan " +
        "32-16's `T-32-22` is REVOKED, and the script must be moved onto the containment seam " +
        "in `lib/audit-root.mjs`. " +
        "SCOPE, stated because an unqualified completeness claim is exactly the CR-08 shape " +
        "this round exists to remove: this assertion is CLOSED over the DIRECT fs IMPORT " +
        "SURFACE and over nothing wider. Within that surface a write API cannot be called " +
        "without first being bound, so any fs name outside the permitted set is a failure. It " +
        "is NOT a claim that no filesystem write is reachable by any means. " +
        "This is an allow-list over an IMPORT SURFACE -- the exact OPPOSITE of an exclusion " +
        "list over a population, which removes members from measurement. This plan's " +
        "prohibition forbids the latter; the two differ in object and in direction, and this " +
        "one removes nothing from any population.",
    );

    assert.equal(
      /from\s*"node:fs\/promises"/.test(text),
      false,
      `${script}.mjs must bind nothing from node:fs/promises -- the promise forms are writes ` +
        "this file's E2 count would still see, but binding them at all breaks the read-only basis",
    );
    assert.equal(
      /import\s+\*\s+as\s+\w+\s+from\s*"node:fs/.test(text),
      false,
      `${script}.mjs must take no fs NAMESPACE import: a namespace binding makes every write ` +
        "API reachable under one name, which would defeat this allow-list entirely",
    );
    assert.equal(
      /require\(\s*"node:fs|import\(\s*"node:fs|require\(\s*"fs"|import\(\s*"fs"/.test(
        withoutComments(text),
      ),
      false,
      `${script}.mjs must perform no require() or dynamic import() of an fs module -- a ` +
        "dynamic binding is invisible to the static allow-list above",
    );
  });

  test(`${script}: E2 -- zero filesystem-write calls over comment-stripped source`, () => {
    const stripped = withoutComments(scriptText(script));
    const found = FS_WRITE_APIS.filter((api) => stripped.includes(api));

    assert.deepEqual(
      found,
      [],
      `${script}.mjs calls a filesystem-write API (${found.join(", ")}). CONSEQUENCE, not just ` +
        "a fact: the performs-no-filesystem-write basis recorded in this script's header " +
        "and accepted in plan 32-16 as `T-32-22` is REVOKED. This script now writes, so the " +
        "trust boundary containment guards DOES exist for it, and it must be moved onto the " +
        "containment seam in `lib/audit-root.mjs` rather than having this assertion relaxed. " +
        "TWO RESIDUAL HOLES, named as MEASURED limits rather than hypotheticals so this pair " +
        "is read as a scoped instrument and not as a completeness proof it cannot give. " +
        "(1) A write reached through a name outside the enumerated set AND not bound at " +
        "import time -- an openSync with a write flag, say -- evades this count, which is why " +
        "E1's import-surface check exists beside it. " +
        "(2) Present in this file TODAY rather than merely conceivable: it binds `spawnSync` " +
        "from `node:child_process`, so a write performed BY A SPAWNED PROCESS is outside BOTH " +
        "halves -- E1 sees no fs binding because there is none, and E2 counts no enumerated " +
        "fs API because none is called. Neither half claims to cover it.",
    );

    // The stdio control, asserted rather than left implicit. This file's
    // `process.stderr.write(` calls MUST NOT be caught: stdio is not a
    // filesystem write, and a bare `.write(` pattern would red on a correct
    // file -- making the assertion worthless in the other direction.
    assert.ok(
      stripped.includes("process.stderr.write("),
      `${script}.mjs is expected to carry process.stderr.write( calls in live code; if it no ` +
        "longer does, this stdio control has stopped controlling for anything and the " +
        "enumerated-set anchoring above is no longer being exercised in the negative direction",
    );
  });
}

test("the write-freedom pair actually guards something", () => {
  // NON-VACUITY. A pair of assertions that select no script proves nothing --
  // the same empty-antecedent failure `CUT-03` forbids and the same shape this
  // whole plan exists to remove one layer up.
  assert.deepEqual(
    UNCONTAINED_BY_DESIGN,
    ["audit-gate"],
    "the uncontained-by-design population changed. This expectation is not a general escape " +
      "hatch: a script may carry it ONLY while the write-freedom pair above proves it still " +
      "writes nothing. A new member needs its own recorded basis, in its own header, with the " +
      "same measurement.",
  );
});
