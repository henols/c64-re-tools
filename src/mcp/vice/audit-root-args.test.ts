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
//      beyond the ones already here, and never run the SAME script to
//      completion twice. Sixteen of the eighteen matrix cases are refusals
//      that exit before their script reads or writes anything. Exactly three
//      runs go end to end, one per script and no script twice: the generator
//      against the repository root (proving an explicit root naming the
//      repository is byte-for-byte identical to no flag at all), the fate
//      guard against the repository root, and the description-overlap gate
//      against the synthetic corpus. Everything else is a refusal by
//      construction.
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
// THE SIX-SCRIPT MATRIX -- `gaps[1].missing[2]`, stated verbatim: "At least
// one spawnSync test per `--root`-ised script: contained root reads the
// synthetic tree; out-of-repo root exits 1 with REFUSED; `--root=<dir>` exits
// non-zero."
//
// Six scripts accept a root. Until plan 32-11 each of them carried its OWN
// copy of the same nine-line reader, so ONE defect shipped six times (IN-06)
// and a per-script test was the only thing that would have caught it. The
// table below is the whole population, and the completeness guard beneath it
// derives that population FROM DISK -- so a seventh root-accepting script
// added later fails this file by omission rather than passing unnoticed.
// ===========================================================================

/** How each script is expected to behave when handed a CONTAINED root that is
 *  not the default one. The three values are contracts, not conveniences:
 *   - "repo-root": the root IS the repository root. Accepted, runs, exits 0.
 *     This is the `[edge:CUT-04/adjacency]` accept side -- a root exactly
 *     equal to the default root is the same tree, never a second one.
 *   - "synthetic-corpus": the gate whose comparison data follows the root.
 *     Runs against a synthetic in-repository tree and REPORTS THAT TREE.
 *   - "refuses": the root is inside the repository but carries none of the
 *     script's inputs, so the run must stop with a diagnostic rather than
 *     silently falling back to the real tree. Asserted as "non-zero plus a
 *     diagnostic naming the script" and NOTHING NARROWER: at HEAD these
 *     report a missing-input TYPO diagnostic, and after plan 32-12 settles
 *     the split read they refuse earlier and for a different reason. Both
 *     satisfy this shape, so the case survives that change unedited. Plan
 *     32-12 pins the specific message; this file deliberately does not. */
type ContainedExpectation = "repo-root" | "synthetic-corpus" | "refuses";

interface MatrixRow {
  script: string;
  contained: ContainedExpectation;
}

const MATRIX: MatrixRow[] = [
  { script: "generate-tool-support-table", contained: "refuses" },
  { script: "check-guard-fates", contained: "repo-root" },
  { script: "check-skill-tool-coverage", contained: "refuses" },
  { script: "check-skill-fork-honesty", contained: "refuses" },
  { script: "check-skill-cli-invocations", contained: "refuses" },
  { script: "check-skill-description-overlap", contained: "synthetic-corpus" },
];

function runScript(script: string, args: string[]): RunResult {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", `${script}.mjs`), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Every top-level `scripts/*.mjs` that calls the shared argv seam. Derived
 *  from disk rather than listed, so the completeness guard below measures the
 *  tree instead of restating this file's own table. `scripts/lib/` is excluded
 *  because that is where the seam itself lives. */
function scriptsUsingTheSharedParser(): string[] {
  const dir = join(ROOT, "scripts");
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
    const src = readFileSync(join(dir, entry.name), "utf8");
    if (src.includes("parseRootArg(")) out.push(entry.name.replace(/\.mjs$/, ""));
  }
  return out.sort();
}

test("the matrix covers EVERY script wired to the shared argv seam", () => {
  const onDisk = scriptsUsingTheSharedParser();
  const covered = MATRIX.map((r) => r.script).sort();
  assert.deepEqual(
    onDisk,
    covered,
    "a root-accepting script exists that this file does not exercise (or vice versa). " +
      "The whole point of the shared seam is that no consumer is left untested -- add the " +
      "missing row to MATRIX rather than relaxing this assertion.",
  );
  assert.ok(
    covered.length >= 6,
    `expected at least the six known consumers, measured ${covered.length}`,
  );
});

// --- Case 1 of 3, per script: the equals form ------------------------------

for (const { script } of MATRIX) {
  test(`${script}: the equals form exits non-zero and names itself`, () => {
    const r = runScript(script, ["--root=/tmp/definitely-not-here"]);
    assert.notEqual(r.status, 0, `expected a non-zero exit, got ${r.status}`);
    assert.ok(
      r.stderr.includes(`${script}: BAD ARGUMENTS --`),
      `stderr must carry the argument-rejection prefix naming this script, got: ${r.stderr}`,
    );
  });
}

// --- Case 2 of 3, per script: an out-of-repository root --------------------

for (const { script } of MATRIX) {
  test(`${script}: an out-of-repository root exits 1 with REFUSED`, () => {
    const outside = mkdtempSync(join(tmpdir(), "audit-root-args-"));
    try {
      const r = runScript(script, ["--root", outside]);
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

// --- Case 3 of 3, per script: a CONTAINED root -----------------------------
//
// The four "refuses" scripts share one empty in-repository fixture shape: a
// root that is contained but carries none of their inputs. The assertion is
// the SHAPE (non-zero, diagnostic, named script), never the specific message.

for (const { script, contained } of MATRIX) {
  if (contained !== "refuses") continue;
  test(`${script}: a contained root with none of its inputs stops with a diagnostic`, (t) => {
    const fixture = mkdtempSync(join(ROOT, ".audit-root-synth-"));
    t.after(() => rmSync(fixture, { recursive: true, force: true }));
    try {
      const r = runScript(script, ["--root", fixture]);
      assert.notEqual(
        r.status,
        0,
        "a contained root carrying none of this gate's inputs must NOT exit 0 -- exiting 0 " +
          `here would mean the run silently read the real tree instead (stdout: ${r.stdout})`,
      );
      assert.ok(
        r.stderr.includes(`${script}:`),
        `stderr must carry a diagnostic naming this script, got: ${r.stderr}`,
      );
      assert.ok(
        r.stderr.trim().length > `${script}:`.length,
        `the diagnostic must say something beyond the script's own name, got: ${r.stderr}`,
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}

test("check-guard-fates: a contained root equal to the repository root runs and exits 0", () => {
  // `[edge:CUT-04/adjacency]`, accept side. This gate derives its audited set
  // from a git object store, so its contained-root case is the repository
  // itself rather than an empty synthetic directory -- an empty tree has no
  // object store and would prove only that the guard fails on an empty tree.
  const r = runScript("check-guard-fates", ["--root", ROOT]);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status} (stderr: ${r.stderr})`);
  assert.match(
    r.stdout,
    /check-guard-fates: OK -- setA=\d+ setB=\d+ setC=\d+ total=\d+ rows=\d+/,
    "an explicit --root naming the repository root must produce the gate's normal report, " +
      `got stdout: ${r.stdout}`,
  );
});

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
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

// --- The repeated-flag rule, at process level ------------------------------

test("a repeated --root is rejected by the spawned script, naming BOTH values", () => {
  // `[edge:CUT-04/ordering]`, first half: where two argv tokens compare equal,
  // the resolution is SPECIFIED (a hard error) rather than positional, so no
  // invocation's meaning depends on which copy the parser happened to keep.
  const r = runScript("check-guard-fates", ["--root", "/a", "--root", "/b"]);
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
  const swallowed = runScript("check-guard-fates", ["--root", "--json"]);
  assert.notEqual(swallowed.status, 0, "`--root --json` must be a MISSING value, not a value");
  assert.ok(swallowed.stderr.includes("BAD ARGUMENTS"), `got: ${swallowed.stderr}`);
  assert.ok(
    swallowed.stderr.includes("--json"),
    `the rejection must name the token it refused to treat as a value, got: ${swallowed.stderr}`,
  );
});
