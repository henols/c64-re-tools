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
//      system to reclaim.
//
//   3. Do NOT add a case that performs a second full generation run. Five of
//      the six spawned cases are refusals that exit before the script reads or
//      writes anything; exactly ONE runs the generator end to end, and it is
//      the one that proves an explicit `--root` naming the repository root is
//      byte-for-byte identical to no flag at all.
//
// This file is inside the removal gate's scope, so it must carry ZERO
// occurrences of the deleted subject's literal name. The gate is referred to
// by ROLE, never by file name.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
