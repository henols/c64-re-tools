// acme-gate.test.ts
//
// WHY THIS FILE EXISTS (SEAM-01): the ACME availability gate's whole value is
// that a missing ACME under `VICE_REQUIRE_ACME` produces a hard FAIL rather
// than a named SKIP. That property has never been observed by a test -- it was
// observed once by hand when the gate was written, and CI reports green
// whether the gate works or not, because a gate that silently degrades into a
// skip produces a green run too. This file makes the FAIL an observation that
// is re-made on every suite run.
//
// WHY IT MUST BE A CHILD PROCESS: `ACME_AVAILABLE` in `acme-gate.ts` is a
// module-load `const`. By the time any test body runs, the probe has already
// happened, so assigning `process.env.ACME_BIN` in-process cannot affect it.
// No in-process test can prove criterion 1. The precedent copied here is
// `r2000-launch.test.ts`'s slow-child timeout test: spawn `process.execPath`
// with an `env` override and import the module under test by absolute path,
// built with `JSON.stringify(join(HERE, ...))`, so a genuinely new module load
// sees the overridden environment.
//
// TWO DIRECTIONS, NOT ONE. A FAIL observation with no paired control cannot
// distinguish "the gate fired" from "the harness broke" -- a typo'd import
// path, a syntax error or a missing file all exit non-zero too. So the same
// child run is repeated with `VICE_REQUIRE_ACME` DELETED from the environment
// (not set to an empty string -- the gate's actual unset behaviour is what is
// being asserted) and must exit ZERO. Either both directions hold or neither
// observation means anything.
//
// WHERE THE PROBE FILE LIVES: `mkdtempSync` under `tmpdir()`, never inside
// this module directory. A probe file written next to this one would be
// collected by `node --test '*.test.*'` on the next run and, if ever left
// behind, would break `test-gate.test.ts`'s "every on-disk `*.test.*` file
// lands in exactly one of the automated/manual sets" assertion. The temp
// directory is removed in a `finally`, on the failure path too -- this host's
// `/tmp` is RAM-backed, so a leaked probe directory is leaked memory.
//
// COST, STATED RATHER THAN SMUGGLED: three child processes per suite run,
// roughly one to two seconds. Two are the `node --test` FAIL/control pair
// above; the third is a much cheaper `-e` one-liner that reads the gate's
// default binary-name resolution with `ACME_BIN` absent, which is the only
// way to observe a module-load `const`'s unset-environment default without
// asserting on source text instead of behaviour.
//
// That count is three because the FAIL probe is MEMOISED (`failRun()` below).
// Two tests assert two properties of the failing run, and they previously
// called `runGateProbe(true)` once each -- four children, two of them
// identical runs of the same fixed input, plus a `mkdtemp`/`rm` cycle each on
// a host whose `/tmp` is RAM-backed, for no added observation (WR-11). The
// second test's own title says "that same failing child run"; memoising is
// what makes that true.
//
// This file verifies test-harness discipline, not shipped runtime behaviour,
// so `acme-gate.ts` stays OUT of `package.json`'s `files[]` -- asserted below
// -- and this file is deliberately never added to `MANUAL_ONLY_TESTS`
// (`test-gate.mjs`'s glob auto-discovers a new `*.test.ts`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE_PATH = join(HERE, "acme-gate.ts");

/** The gate's own refusal wording, read out of the module source rather than
 * retyped here from memory. Retyping it is how a test ends up passing for the
 * wrong reason: a typo'd import path also exits non-zero, and only matching
 * the gate's real message distinguishes "the assertion fired" from "the
 * harness broke". */
const REFUSAL_PREFIX = "VICE_REQUIRE_ACME is set but no real ACME was found at";

test("the gate's refusal wording asserted below is really present in acme-gate.ts (so this file cannot pass for the wrong reason)", () => {
  const src = readFileSync(GATE_PATH, "utf8");
  assert.ok(
    src.includes(REFUSAL_PREFIX),
    `acme-gate.ts no longer contains the refusal wording this file matches on ` +
      `(${JSON.stringify(REFUSAL_PREFIX)}) -- update both together, never only one`
  );
});

interface ChildRun {
  status: number | null;
  output: string;
}

/**
 * Writes a one-test probe file into a fresh temp directory, points its
 * `ACME_BIN` at a path inside that directory which is never created, and runs
 * it in a child `node --test`. `requireAcme: false` DELETES `VICE_REQUIRE_ACME`
 * from the child environment rather than blanking it, because the unset
 * behaviour is exactly what the control direction asserts.
 */
function runGateProbe(requireAcme: boolean): ChildRun {
  const dir = mkdtempSync(join(tmpdir(), "acme-gate-test-"));
  try {
    const probePath = join(dir, "probe.test.mjs");
    const missingBinary = join(dir, "definitely-not-acme");
    writeFileSync(
      probePath,
      `import { test } from "node:test";\n` +
        `import assert from "node:assert/strict";\n` +
        `import { assertAcmeRequiredIfEnvSet } from ${JSON.stringify(GATE_PATH)};\n` +
        `test("ACME availability gate, under a deliberately nonexistent ACME_BIN", () => {\n` +
        `  assertAcmeRequiredIfEnvSet(assert);\n` +
        `});\n`,
      "utf8"
    );

    const env: Record<string, string | undefined> = { ...process.env, ACME_BIN: missingBinary };
    if (requireAcme) env.VICE_REQUIRE_ACME = "1";
    else delete env.VICE_REQUIRE_ACME;
    // MEASURED TRAP, not a precaution: Node sets `NODE_TEST_CONTEXT` in every
    // process it runs a test file in, and a child `node --test` that inherits
    // it refuses to run any file at all -- it prints "run() is being called
    // recursively within a test file. skipping running files" and exits ZERO.
    // Inherited, the FAIL direction below would report a zero exit and read as
    // "the gate degraded into a skip" on a perfectly working gate, and the
    // control direction would pass vacuously. Both directions would then be
    // measuring the harness. Delete it.
    delete env.NODE_TEST_CONTEXT;

    const r = spawnSync(process.execPath, ["--test", probePath], {
      encoding: "utf8",
      timeout: 30_000,
      env,
    });
    return { status: r.status, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The ONE `VICE_REQUIRE_ACME=1` probe run, memoised (WR-11). The two tests
 * below assert two properties of the SAME failing child run -- the exit code
 * and the refusal wording -- against one fixed input, so a second spawn adds
 * cost and no observation. Lazily computed rather than a top-level call, so
 * running a filtered subset of this file does not spawn a child it never
 * asserts on. */
let failRunCache: ChildRun | undefined;
function failRun(): ChildRun {
  if (failRunCache === undefined) failRunCache = runGateProbe(true);
  return failRunCache;
}

test("VICE_REQUIRE_ACME=1 with a nonexistent ACME_BIN makes a child run FAIL (non-zero exit), never skip", () => {
  const r = failRun();
  assert.notEqual(
    r.status,
    0,
    `expected a non-zero exit from the child run -- a zero exit means the hard-FAIL gate ` +
      `degraded into a silent SKIP, which is the exact failure SEAM-01 exists to make visible. ` +
      `Child output:\n${r.output}`
  );
});

test("that same failing child run names the gate's OWN refusal wording, so the non-zero exit is the assertion and not a broken import", () => {
  const r = failRun();
  assert.ok(
    r.output.includes(REFUSAL_PREFIX),
    `the child exited non-zero but its output never names the gate's refusal wording ` +
      `(${JSON.stringify(REFUSAL_PREFIX)}) -- a module-resolution error, a syntax error or a ` +
      `missing probe file also exits non-zero. Child output:\n${r.output}`
  );
});

test("non-vacuity control: the identical child run with VICE_REQUIRE_ACME ABSENT exits zero (a named skip, not a failure)", () => {
  const r = runGateProbe(false);
  assert.equal(
    r.status,
    0,
    `expected a zero exit with VICE_REQUIRE_ACME unset and the same nonexistent ACME_BIN. A ` +
      `non-zero exit here means the FAIL observed above came from the harness rather than from ` +
      `the gate, and neither direction proves anything. Child output:\n${r.output}`
  );
});

test("with ACME_BIN absent from the environment, the gate falls back to the bare \"acme\" binary name", () => {
  const childProgram =
    `import { ACME_BIN } from ${JSON.stringify(GATE_PATH)};\n` +
    `console.log("ACME_BIN:" + ACME_BIN);\n`;
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.ACME_BIN;
  delete env.NODE_TEST_CONTEXT;

  const r = spawnSync(process.execPath, ["--input-type=module", "-e", childProgram], {
    encoding: "utf8",
    timeout: 30_000,
    env,
  });
  assert.equal(r.status, 0, `child exited non-zero (stderr: ${r.stderr})`);
  assert.equal(
    (r.stdout ?? "").trim(),
    'ACME_BIN:acme',
    `with ACME_BIN unset the gate must resolve the same default the moved body used ("acme"); ` +
      `a changed default silently re-points every ACME-gated test in the tree`
  );
});

test("acme-gate.ts is absent from package.json's files[] array (test-only, mechanically enforced)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(
    pkg.files.includes("acme-gate.ts"),
    false,
    "acme-gate.ts is test-only and must never ship in the published npm tarball"
  );
});
