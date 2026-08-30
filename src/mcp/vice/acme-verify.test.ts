// acme-verify.test.ts
//
// WHY THIS FILE EXISTS: `acme-verify.ts` exists to refuse a specific recorded
// false pass -- an exit-zero assembler run whose aggregate summary line read as
// a full pass while the one assembler the project cares about never ran. A
// module that refuses that shape is worthless unless the refusal is observed on
// every suite run, because a verdict layer that silently degrades back into
// "ACME exited 0, so it passed" produces a green run too. This file is where
// the three outcomes are observed rather than asserted about, and where the
// whole phase architecture -- store, exporter, real ACME, byte-diff -- is
// walked end to end exactly once.
//
// THE THIRD OUTCOME IS PROVED HERE, IN PROCESS, THROUGH THE `acmeBin` SEAM.
// `verifyAcmeAssembles()` takes an optional `acmeBin` whose only purpose is to
// make `"skipped"` reachable without a child `node --test`. Pointed at a path
// that was never created, `spawnSync` reports `ENOENT` and the verdict must be
// `"skipped"` -- never `"ok"` (the truthiness hole: `!r.status` is `true` for a
// spawn that never ran) and never silently folded into `"failed"`.
//
// TWO DIRECTIONS, NOT ONE. A control that only ever refuses is indistinguishable
// from one that refuses everything. So the same call is repeated against
// `/bin/true` -- a binary that spawns cleanly, prints nothing and writes nothing
// -- and must come back `"failed"`, not `"skipped"`. That single assertion
// carries two proofs at once: `"skipped"` is reachable only from a spawn that
// did NOT run, and the unanimity rule ran without being asked to (one expected
// segment against zero parsed result lines is rule 8 firing ahead of rule 9's
// absent output file, under the reason precedence `verifyAcmeAssembles()`
// documents).
//
// NEVER TREAT AN ACME STDERR WARNING AS A FAILURE. ACME 0.97 documents warnings
// for buggy-but-legal constructs (`jmp ($xxff)`, unstable ANE/LXA) and emits one
// under `-Wtype-mismatch` for a raw-number operand -- the TRACER below trips
// that very warning on its own `sta $d020` and must still come back `"ok"`,
// because every one of those cases assembles to exactly the right bytes. The
// verdict's basis is the byte-diff; `diagnostics` is recorded for a human and
// only `Error`/`Serious error` are fatal.
//
// THE `ACME_BIN` *ENVIRONMENT VARIABLE* BOUNDARY IS PROVED HERE TOO, AND ONLY
// IN A CHILD PROCESS. `ACME_BIN` and `ACME_AVAILABLE` are module-load `const`s
// in `acme-gate.ts`: by the time any test body in THIS process runs, the probe
// has already happened, so assigning `process.env.ACME_BIN` here cannot affect
// it. MANDATORY RED 1 (plan 30-02) therefore spawns `process.execPath --test`
// over a generated probe with the environment overridden -- and it spawns the
// paired control direction too, because a non-zero exit on its own cannot tell
// "the gate fired" from "the harness broke". The `acmeBin` option remains an
// in-process seam, deliberately NOT a second way to reach a real assembler, and
// deliberately NOT a substitute for this child-process observation.
//
// COST, STATED RATHER THAN SMUGGLED: four child processes per suite run -- one
// `/bin/true`, one REAL ACME assemble in the tracer, and the two `node --test`
// children of the MANDATORY RED 1 harness below (its failing direction is
// MEMOISED, so several assertions share one spawn) -- plus one spawn that fails
// before exec. The two `node --test` children dominate: roughly a second each,
// because each pays a fresh Node start plus `acme-gate.ts`'s module-load probe
// of a binary that is not there. On top of that sits this process's own
// `acme-gate.ts` probe, paid once per node process and shared with every other
// ACME-gated file, not billed again here.
//
// This file is deliberately never added to `MANUAL_ONLY_TESTS`: `test-gate.mjs`'s
// `automatedTestFiles()` auto-discovers every on-disk `*.test.*`, and
// `test-gate.test.ts`'s drift guard fails the build if a file escapes both sets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import {
  ACME_VERIFY_ARGV_FLAGS,
  classifySpawn,
  missingAssemblerIsNeverAPass,
  verifyAcmeAssembles,
  type AcmeOutcome,
  type SpawnClassifier,
} from "./acme-verify.ts";
import { exportAsm } from "./anno-export-asm.ts";
import { openStore, closeStore, setDataType, setLabel } from "./anno-store.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFY_MODULE_PATH = join(HERE, "acme-verify.ts");
const GATE_MODULE_PATH = join(HERE, "acme-gate.ts");
const SKILL_DRIVER_PATH = join(HERE, "..", "..", "skills", "acme-build", "scripts", "acme.mjs");

/** Computed exactly ONCE, by the shared `acme-gate.ts` seam. Every
 * ACME-dependent test in this file passes this through node:test's own
 * `{ skip }` option -- never a hand-rolled early return on this value, which
 * reports a false PASS rather than a SKIP. */
const SKIP_REASON: string | false = acmeSkipReasonFor("acme-verify.test.ts");

test("ACME availability gate (never skipped)", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

// ---------------------------------------------------------------------------
// A trivial one-segment subject, shared by the two seam tests below. Neither
// needs a real assembler: one never execs, the other execs a binary that emits
// nothing.
// ---------------------------------------------------------------------------

/** `lda #$00` / `rts` at $0801 -- three bytes, one segment, $0801..$0804. */
const TRIVIAL_SOURCE = ["!cpu 6510", "* = $0801", "\tlda #$00", "\trts", ""].join("\n");
const TRIVIAL_BYTES = new Uint8Array([0xa9, 0x00, 0x60]);
const TRIVIAL_SEGMENTS = [{ start: 0x0801, endExclusive: 0x0804 }] as const;

test("a spawn that never ran is `skipped`, never `ok` -- the ENOENT direction", () => {
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-skip-"));
  try {
    // Inside a directory that DOES exist, at a path that was never created:
    // `spawnSync` reports ENOENT with `status === null`, which is exactly the
    // `!r.status` truthiness hole the three-outcome verdict exists to close.
    const missingBinary = join(dir, "definitely-not-acme");
    assert.equal(existsSync(missingBinary), false, "the probe binary must not exist for this test to mean anything");

    const verdict = verifyAcmeAssembles({
      source: TRIVIAL_SOURCE,
      expectedBytes: TRIVIAL_BYTES,
      expectedSegments: TRIVIAL_SEGMENTS,
      acmeBin: missingBinary,
    });

    assert.equal(
      verdict.outcome,
      "skipped",
      `a spawn that never ran must be "skipped"; got ${JSON.stringify(verdict.outcome)} with reason ${JSON.stringify(verdict.reason)}`
    );
    assert.notEqual(
      verdict.outcome,
      "ok",
      "a spawn that never ran must NEVER read as a pass -- that is the exact false-pass shape this module exists against"
    );
    assert.equal(verdict.byteDiff, null, "nothing was assembled, so nothing can be reported as compared");
    assert.ok(
      verdict.reason.includes(missingBinary),
      `the reason must name the binary that was attempted so a human can see WHICH assembler was missing; got ${JSON.stringify(verdict.reason)}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test(
  "a spawn that DID run but emitted nothing is `failed`, not `skipped` -- the paired direction",
  { skip: existsSync("/bin/true") ? false : "no /bin/true on this host" },
  () => {
    const verdict = verifyAcmeAssembles({
      source: TRIVIAL_SOURCE,
      expectedBytes: TRIVIAL_BYTES,
      expectedSegments: TRIVIAL_SEGMENTS,
      acmeBin: "/bin/true",
    });

    assert.equal(
      verdict.outcome,
      "failed",
      `/bin/true spawns cleanly, prints nothing and writes nothing -- that is a FAILED verification, not a skipped one; ` +
        `got ${JSON.stringify(verdict.outcome)} with reason ${JSON.stringify(verdict.reason)}`
    );
    assert.notEqual(
      verdict.outcome,
      "skipped",
      "`skipped` must be reachable ONLY from a spawn that did not run; a clean exec that produced nothing is a real failure"
    );
    // Rule 8 (unanimity against the exporter's blocks) fires ahead of rule 9
    // (absent output file) under the documented reason precedence. Asserting
    // THIS reason rather than the absent-file one is what proves the unanimity
    // rule is unconditional: `expectedSegments` is a REQUIRED option and no
    // code path can skip it, so a verdict can never return `ok` with that rule
    // unrun (D30-06).
    assert.match(
      verdict.reason,
      /per-segment result line/i,
      `the reason must name the segment-count disagreement (1 expected block against 0 parsed result lines), which doubles as ` +
        `the proof that the unanimity rule ran unconditionally; got ${JSON.stringify(verdict.reason)}`
    );
    assert.match(
      verdict.reason,
      /\b1\b[\s\S]*\b0\b/,
      `the reason must state BOTH counts -- one expected block, zero parsed lines; got ${JSON.stringify(verdict.reason)}`
    );
    assert.equal(verdict.byteDiff, null, "no output file was read, so nothing can be reported as compared");
  }
);

// ---------------------------------------------------------------------------
// The arity of `AcmeOutcome` is proved by the COMPILER, not by a text grep.
// This switch is exhaustive with no `default` branch: adding a fourth member to
// the union leaves `outcome` un-narrowed at the assignment below, and
// `npm run typecheck` stops passing. A grep for the union's declaration would
// pass on a fourth member appended anywhere else.
// ---------------------------------------------------------------------------

function describeOutcome(outcome: AcmeOutcome): string {
  switch (outcome) {
    case "ok":
      return "the output file this run created is byte-identical to the expected bytes";
    case "failed":
      return "ACME ran and the result disagreed with the expected bytes or segments";
    case "skipped":
      return "ACME never ran, so no verdict about the bytes exists";
  }
  const exhaustive: never = outcome;
  return exhaustive;
}

test("AcmeOutcome has exactly three members (proved by the exhaustive switch above typechecking)", () => {
  assert.equal(describeOutcome("ok").length > 0, true);
  assert.equal(describeOutcome("failed").length > 0, true);
  assert.equal(describeOutcome("skipped").length > 0, true);
  assert.notEqual(
    describeOutcome("skipped"),
    describeOutcome("ok"),
    "`skipped` and `ok` must not describe the same thing -- a skipped assembler is not a pass on any surface"
  );
  assert.equal(SKIP_REASON === false || typeof SKIP_REASON === "string", true);
});

// ---------------------------------------------------------------------------
// MANDATORY RED 1 (plan 30-02): A MISSING ASSEMBLER IS NEVER A PASS.
//
// The ROADMAP records the founding false pass in one sentence: a verification
// route ran, exited zero and printed an aggregate line reading as a full pass
// while the one assembler the project cares about never ran at all. This
// section is where that refusal stops being a design statement and becomes an
// observation, in BOTH of the two ways it has to be made.
//
// IN PROCESS, the property itself: `missingAssemblerIsNeverAPass()` is the ONE
// predicate, and it is driven twice -- once with the real `classifySpawn` and
// once with a locally-defined classifier implementing the historical
// truthiness-of-exit-status rule. The second direction is what proves the guard
// is CAPABLE of biting; without it, a predicate that answered `true` for every
// input would look identical to a working one.
//
// IN A CHILD PROCESS, the environment-variable boundary: `ACME_BIN` and
// `ACME_AVAILABLE` are module-load `const`s, so no in-process assignment can
// move them, and the FAIL direction is paired with a control run that must exit
// ZERO.
// ---------------------------------------------------------------------------

/**
 * A DELIBERATE PLANTED VIOLATION -- the historical rule, in its own words: it
 * decides availability from the TRUTHINESS OF THE EXIT STATUS rather than from
 * the presence of a spawn error.
 *
 * The ROADMAP's note on the recorded false pass, quoted: a verification route
 * "ran, exited zero, and printed an aggregate summary line that read as a full
 * pass -- while the one assembler the project actually cares about never ran at
 * all". Measured (RESEARCH.md Pitfall 2), a spawn that never ran carries NO
 * exit status, so `!r.status` is `true` for it and this classifier calls it
 * `"ran"` -- the hole, exactly as recorded. It is not a constant function: for
 * a real non-zero exit it answers `"unavailable"`, which is wrong in the other
 * direction and is why the shortcut was never salvageable.
 */
const SHORTCUT_CLASSIFIER: SpawnClassifier = (r) => (!r.status ? "ran" : "unavailable");

test("MANDATORY RED 1 (in process): a missing assembler is never a pass, and the same predicate driven with the historical exit-status shortcut says it is", () => {
  assert.equal(
    missingAssemblerIsNeverAPass(classifySpawn),
    true,
    "the real classifier must refuse ALL THREE measured missing-binary spawn shapes (a bare nonexistent name, an " +
      "absolute nonexistent path, and a present-but-non-executable file). Any one of them classified as `ran` is a " +
      "missing assembler reaching the byte-diff rules with no bytes to diff"
  );
  assert.equal(
    missingAssemblerIsNeverAPass(SHORTCUT_CLASSIFIER),
    false,
    "the HISTORICAL truthiness-of-exit-status classifier must be REPORTED by this same predicate -- a control that " +
      "only ever refuses is indistinguishable from one that works, and a guard whose control cannot fail is not a " +
      "guard. Both directions call missingAssemblerIsNeverAPass(), so there is exactly one definition of the property"
  );
});

test("classifySpawn maps the three measured shapes: no exit status is `unavailable`, exit 0 and exit 1 are both `ran`", () => {
  const enoent = new Error("spawnSync acme-does-not-exist ENOENT") as NodeJS.ErrnoException;
  enoent.code = "ENOENT";
  assert.equal(classifySpawn({ error: enoent, status: null }), "unavailable");
  assert.equal(classifySpawn({ status: 0 }), "ran");
  assert.equal(
    classifySpawn({ status: 1 }),
    "ran",
    "a NON-ZERO exit is a process that really ran and made a real statement about the source. Folding it into " +
      "`unavailable` would hide a genuine assembly failure behind the outcome that means `no claim exists`"
  );
});

/** The gate's own refusal wording, read out of `acme-gate.ts` at run time
 * rather than retyped here. Retyping it is how the child-process observation
 * below ends up passing for the wrong reason: a typo'd import path, a syntax
 * error and a missing probe file all exit non-zero too, and only matching the
 * gate's REAL message distinguishes "the gate fired" from "the harness broke". */
const GATE_REFUSAL_PREFIX = "VICE_REQUIRE_ACME is set but no real ACME was found at";

test("non-vacuity guard: the refusal wording the child output is matched against is really present in acme-gate.ts", () => {
  assert.ok(
    readFileSync(GATE_MODULE_PATH, "utf8").includes(GATE_REFUSAL_PREFIX),
    `acme-gate.ts no longer contains the refusal wording this file matches on (${JSON.stringify(GATE_REFUSAL_PREFIX)}) ` +
      `-- update both together, never only one, or the child-process red below silently starts passing on any non-zero exit`
  );
});

interface ChildRun {
  status: number | null;
  output: string;
}

/**
 * Writes a generated probe into a FRESH temp directory, points the child's
 * `ACME_BIN` at a path inside it that is never created, and runs the probe
 * under a child `node --test`.
 *
 * WHY A CHILD AT ALL: `ACME_BIN` is a module-load `const` in `acme-gate.ts`, so
 * only a genuinely new module load can see an overridden environment. The
 * in-process `acmeBin` seam above proves the OUTCOME is reachable; only this
 * proves the ENV-VAR boundary.
 *
 * WHY THE PROBE LIVES UNDER `tmpdir()` AND NOT NEXT TO THIS FILE: a stray
 * `*.test.*` in the module directory would be collected by
 * `node --test '*.test.*'` on the next run and would break
 * `test-gate.test.ts`'s "every on-disk test file lands in exactly one of the
 * automated/manual sets" assertion. The directory is removed in a `finally`, on
 * the FAILURE path too -- this host's `/tmp` is RAM-backed, so a leaked probe
 * directory is leaked memory.
 *
 * `requireAcme: false` DELETES `VICE_REQUIRE_ACME` rather than blanking it: an
 * empty string is still a set variable to the gate, whose check is a plain
 * truthiness test on `process.env.VICE_REQUIRE_ACME`, so blanking it would
 * assert the wrong thing while looking right.
 */
function runVerifyProbe(requireAcme: boolean): ChildRun {
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-red-"));
  try {
    const probePath = join(dir, "probe.test.mjs");
    const missingBinary = join(dir, "definitely-not-acme");
    writeFileSync(
      probePath,
      `import { test } from "node:test";\n` +
        `import assert from "node:assert/strict";\n` +
        `import { assertAcmeRequiredIfEnvSet } from ${JSON.stringify(GATE_MODULE_PATH)};\n` +
        `import { verifyAcmeAssembles } from ${JSON.stringify(VERIFY_MODULE_PATH)};\n` +
        `test("ACME availability gate, under a deliberately nonexistent ACME_BIN", () => {\n` +
        `  assertAcmeRequiredIfEnvSet(assert);\n` +
        `});\n` +
        // The probe passes NO `acmeBin`. The whole point is the module-load
        // constant `ACME_BIN`, which only this child can move. It DOES pass
        // `expectedSegments` and a matching `expectedBytes`, because
        // `expectedSegments` is REQUIRED (D30-06) and a probe that could not
        // compile would exit non-zero for the wrong reason and read as the
        // gate firing.
        `test("verifyAcmeAssembles() with a nonexistent ACME_BIN is never ok", () => {\n` +
        `  const verdict = verifyAcmeAssembles({\n` +
        `    source: ${JSON.stringify(TRIVIAL_SOURCE)},\n` +
        `    expectedBytes: Uint8Array.from([0xa9, 0x00, 0x60]),\n` +
        `    expectedSegments: [{ start: 0x0801, endExclusive: 0x0804 }],\n` +
        `  });\n` +
        `  assert.notEqual(verdict.outcome, "ok", "outcome=" + verdict.outcome + " reason=" + verdict.reason);\n` +
        `});\n`,
      "utf8"
    );

    const env: Record<string, string | undefined> = { ...process.env, ACME_BIN: missingBinary };
    if (requireAcme) env.VICE_REQUIRE_ACME = "1";
    else delete env.VICE_REQUIRE_ACME;
    // MEASURED TRAP, not a precaution: Node sets `NODE_TEST_CONTEXT` in every
    // process it runs a test file in, and a child `node --test` that inherits
    // it refuses to run ANY file at all -- it prints "run() is being called
    // recursively within a test file. skipping running files" and exits ZERO.
    // Inherited, the FAIL direction below would report a zero exit on a
    // perfectly working gate, reading as "the hard FAIL degraded into a skip",
    // and the control direction would pass vacuously. Both directions would
    // then be measuring the harness rather than the gate. Delete it.
    delete env.NODE_TEST_CONTEXT;

    // `process.execPath`, never a bare binary name (WR-20): the child must be
    // THIS Node, whose version supports type-stripping the `.ts` modules the
    // probe imports by absolute path.
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

/** The ONE `VICE_REQUIRE_ACME=1` probe run, memoised (WR-11, the discipline
 * `acme-gate.test.ts` records at its own `failRun()`). Two tests below assert
 * two properties of the SAME failing child run against one fixed input, so a
 * second spawn would add a full Node start plus a `mkdtemp`/`rm` cycle on a
 * RAM-backed `/tmp` and no observation. Lazily computed rather than called at
 * the top level, so running a filtered subset of this file does not spawn a
 * child it never asserts on. */
let redRunCache: ChildRun | undefined;
function redRun(): ChildRun {
  if (redRunCache === undefined) redRunCache = runVerifyProbe(true);
  return redRunCache;
}

test("MANDATORY RED 1 (child process): VICE_REQUIRE_ACME=1 with a nonexistent ACME_BIN makes the child FAIL, never skip", () => {
  const r = redRun();
  assert.notEqual(
    r.status,
    0,
    `expected a NON-ZERO exit. A zero exit means the hard-FAIL gate degraded into a silent SKIP with a missing ` +
      `assembler -- the exact shape of the recorded false pass, and the reason this red is mandatory. Child output:\n${r.output}`
  );
});

test("MANDATORY RED 1 (child process): that same failing run names the gate's OWN refusal wording, so the non-zero exit is the assertion and not a broken import", () => {
  const r = redRun();
  assert.ok(
    r.output.includes(GATE_REFUSAL_PREFIX),
    `the child exited non-zero but its output never names the gate's refusal wording ` +
      `(${JSON.stringify(GATE_REFUSAL_PREFIX)}) -- a module-resolution error, a syntax error or a missing probe file ` +
      `also exit non-zero. Child output:\n${r.output}`
  );
});

test("MANDATORY RED 1, paired direction: the identical child run with VICE_REQUIRE_ACME ABSENT exits zero", () => {
  const r = runVerifyProbe(false);
  assert.equal(
    r.status,
    0,
    `expected a ZERO exit with VICE_REQUIRE_ACME unset and the same nonexistent ACME_BIN -- the probe's second test ` +
      `(outcome is never "ok") must still hold, so this run proves the harness itself works. A non-zero exit here ` +
      `means the FAIL observed above came from the harness rather than from the gate, and NEITHER direction proves ` +
      `anything. Child output:\n${r.output}`
  );
});

test("a verify driven with the missing-binary spawn shape is `skipped`, and `skipped` is never `ok`", () => {
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-missing-"));
  try {
    const missingBinary = join(dir, "definitely-not-acme");
    const verdict = verifyAcmeAssembles({
      source: TRIVIAL_SOURCE,
      expectedBytes: TRIVIAL_BYTES,
      expectedSegments: TRIVIAL_SEGMENTS,
      acmeBin: missingBinary,
    });
    assert.equal(verdict.outcome, "skipped", `reason: ${verdict.reason}`);
    assert.notEqual(verdict.outcome, "ok", "a skipped assembler must never be presented as a pass on any surface");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Store fixtures. Every one builds a REAL store with the store's own public
// write verbs -- never raw SQL -- in a fresh temp directory removed in a
// `finally`, because this host's `/tmp` is RAM-backed and a leaked directory is
// leaked memory.
// ---------------------------------------------------------------------------

interface StoreFixture {
  dir: string;
  storePath: string;
  imagePath: string;
}

/** Writes a `.prg` (2-byte little-endian load address then `body`) and a store
 * carrying `ranges` and `labels`, then runs `fn` against them. */
function withStore(
  origin: number,
  body: readonly number[],
  ranges: readonly { start: number; endInclusive: number; dataType: string }[],
  labels: readonly { address: number; name: string }[],
  fn: (fixture: StoreFixture) => void
): void {
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-store-"));
  try {
    const imagePath = join(dir, "game.prg");
    writeFileSync(imagePath, Buffer.from([origin & 0xff, (origin >> 8) & 0xff, ...body]));

    const storePath = join(dir, "anno.sqlite");
    const handle = openStore(storePath, { workspaceRoot: dir });
    try {
      for (const range of ranges) setDataType(handle, range);
      for (const label of labels) setLabel(handle, { ...label, kind: "User" });
    } finally {
      closeStore(handle);
    }

    fn({ dir, storePath, imagePath });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// THE TRACER. One store, one range, one image, one REAL ACME run, one
// byte-diff, one `ok` -- the whole phase architecture walked once.
//
// It passes NO `acmeBin`, which is itself the proof that the default resolves
// to the imported `ACME_BIN`: Task 1's test-only override did not quietly
// become the only path a real assembler is reached on.
//
// DIVISION OF LABOUR, recorded here so a later reader does not add a third,
// weaker copy: the `"skipped"` outcome is proved directly and in-process above,
// through the `acmeBin` seam with its paired `/bin/true` direction. What is
// still unproven is the ENV-VAR boundary -- `ACME_BIN` is read from the
// environment once at module load, so only a child process can move it -- and
// that observation belongs to the mandatory-red harness in a later plan of this
// phase, by design.
// ---------------------------------------------------------------------------

test("TRACER: store -> export -> real ACME 0.97 -> byte-diff -> ok", { skip: SKIP_REASON }, () => {
  // `lda #$00` / `sta $d020` / `rts` -- six bytes covering $0801..$0806.
  const body = [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60];

  withStore(
    0x0801,
    body,
    [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    [{ address: 0x0801, name: "entry" }],
    ({ dir, storePath, imagePath }) => {
      const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

      const verdict = verifyAcmeAssembles({
        source: result.source,
        expectedBytes: result.expectedBytes,
        expectedSegments: result.blocks,
      });

      const context =
        `\n  reason: ${verdict.reason}` +
        `\n  diagnostics: ${verdict.diagnostics.join(" | ") || "(none)"}` +
        `\n  acmeResultLines: ${verdict.acmeResultLines.join(" | ") || "(none)"}` +
        `\n  source:\n${result.source}`;

      assert.equal(verdict.outcome, "ok", `the tracer must round-trip through a real ACME:${context}`);
      assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS the verdict, and it must be equal:${context}`);
      assert.equal(
        verdict.byteDiff?.firstDifferingOffset,
        null,
        `an equal byte-diff has no first differing offset:${context}`
      );
      assert.ok(
        verdict.acmeResultLines.length >= 1,
        `ACME's own per-segment result lines must have been parsed and recorded:${context}`
      );
      assert.notEqual(
        verdict.exitStatus,
        undefined,
        "exitStatus is RECORDED so a human can read what happened, and CONSULTED BY NOTHING -- this assertion " +
          "checks only that it was populated, never that it was zero, because a zero exit is compatible with a wrong byte"
      );
    }
  );
});

// ---------------------------------------------------------------------------
// The exporter's own refusals and emission rules. These need no assembler: they
// are properties of the text and of `expectedBytes`, and the tracer above is
// what proves that text actually assembles.
// ---------------------------------------------------------------------------

test("a store with ZERO ranges is refused by name, never exported as an empty source", () => {
  withStore(0x0801, [0xa9, 0x00, 0x60], [], [], ({ dir, storePath, imagePath }) => {
    assert.throws(
      () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
      (err: unknown) => {
        assert.ok(err instanceof Error, "the refusal must be an Error");
        assert.ok(err.message.startsWith("exportAsm:"), `the message must name the function; got ${JSON.stringify(err.message)}`);
        assert.ok(err.message.includes(storePath), `the message must name the store path; got ${JSON.stringify(err.message)}`);
        return true;
      },
      '"nothing is annotated" and "the export produced nothing" must not read the same'
    );
  });
});

test("a store label below $0100 is defined with TWO hex digits, and one at or above with four", () => {
  withStore(
    0x0801,
    [0xa9, 0x00, 0x60],
    [{ start: 0x0801, endInclusive: 0x0803, dataType: "code" }],
    [
      { address: 0x10, name: "zpf_10" },
      { address: 0x0801, name: "entry" },
    ],
    ({ dir, storePath, imagePath }) => {
      const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
      const lines = result.source.split("\n");

      assert.equal(lines[0], "!cpu 6510", "the header opens with the CPU directive");
      // Measured on ACME 0.97: `zpf = $10` gives `lda zpf` -> `a5 10` (2 bytes),
      // `zpf = $0010` gives `ad 10 00` (3 bytes). The DEFINITION's digit count
      // decides the OPERAND's width, so this is a byte-level property wearing
      // the clothes of a formatting detail.
      assert.ok(
        lines.includes("zpf_10 = $10"),
        `a zero-page definition must carry two hex digits; got:\n${result.source}`
      );
      assert.ok(
        lines.includes("entry = $0801"),
        `a definition at or above $0100 must carry four hex digits; got:\n${result.source}`
      );

      const firstOrigin = lines.findIndex((l) => l.startsWith("* ="));
      const lastDefinition = Math.max(lines.indexOf("zpf_10 = $10"), lines.indexOf("entry = $0801"));
      assert.ok(
        lastDefinition < firstOrigin,
        "EVERY definition sits before the first `* =`. A symbol defined after its first reference widens the " +
          "referencing instruction from zeropage to absolute -- three bytes where the original was two -- with only " +
          "a Warning and exit status 0, and everything after it shifts"
      );
      assert.equal(result.symbolCount, 2);
    }
  );
});

test("two blocks with a gap: expectedBytes spans both and $00-fills between them", () => {
  const body = [0xa9, 0x00, 0x60, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xea];
  withStore(
    0x0801,
    body,
    [
      { start: 0x0801, endInclusive: 0x0803, dataType: "code" },
      { start: 0x0810, endInclusive: 0x0810, dataType: "code" },
    ],
    [],
    ({ dir, storePath, imagePath }) => {
      const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
      // ACME `-f plain` emits ONE contiguous span across every segment,
      // zero-filling the gaps (measured). `expectedBytes` is built to match, so
      // padding is never a false disagreement while a wrong byte inside a
      // covered range still fails.
      assert.deepEqual(
        [...result.expectedBytes],
        [0xa9, 0x00, 0x60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xea],
        "the gap between two blocks is $00-filled, and the image's own filler bytes are NOT carried into it"
      );
      assert.equal(result.blocks.length, 2);
      assert.deepEqual(
        result.blocks.map((b) => [b.start, b.endExclusive]),
        [
          [0x0801, 0x0804],
          [0x0810, 0x0811],
        ],
        "the store's INCLUSIVE end converts to an exclusive one exactly once, here"
      );
    }
  );
});

test("an opcode ACME cannot express goes out as `!byte` with all its bytes, and is counted", () => {
  // $12 is a `jam` whose bare mnemonic ACME assembles to $02 instead -- exactly
  // the over-substitution case `disasm-opcodes.ts`'s `acmeExpressible` column
  // exists to record.
  withStore(
    0x0801,
    [0x12, 0x60],
    [{ start: 0x0801, endInclusive: 0x0802, dataType: "code" }],
    [],
    ({ dir, storePath, imagePath }) => {
      const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
      assert.equal(result.unexpressibleCount, 1, `got:\n${result.source}`);
      assert.match(
        result.source,
        /!byte \$12\s+; jam/,
        `an unexpressible opcode emits every byte as !byte with its mnemonic in a comment; got:\n${result.source}`
      );
      assert.deepEqual([...result.expectedBytes], [0x12, 0x60]);
    }
  );
});

// ---------------------------------------------------------------------------
// THE ARGV-AGREEMENT INVARIANT.
//
// `ACME_VERIFY_ARGV_FLAGS` and `src/skills/acme-build/scripts/acme.mjs`'s `args`
// array are a DELIBERATE second implementation of the same ACME invocation:
// `src/mcp/vice/**` and `src/skills/**` publish as separate npm packages and
// cannot import each other, so a shared module is not reachable without
// inventing a third package for one flag array. The accepted cost is that the
// two lists can drift apart silently. This test is the only thing holding them
// together, so it reads BOTH off disk rather than trusting either side's
// in-memory value alone.
// ---------------------------------------------------------------------------

/** A quote-aware comment stripper, the same shape `anno-cli-path-consumers.test.ts`
 * carries. A naive `//`-to-end-of-line strip would delete the inside of any
 * string containing `//`, and a naive block strip would eat a `/*` inside a
 * string -- either way the extraction below would go quietly short and this
 * test would pass by missing the very literal a drift lives in. */
function stripComments(src: string): string {
  let out = "";
  const n = src.length;
  let i = 0;
  let quote: string | null = null;
  while (i < n) {
    const c = src[i]!;
    if (quote) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** The text of the first `[...]` array literal following the LAST of `markers`,
 * each of which is located in sequence, matched by bracket DEPTH rather than by
 * a regex, and quote-aware so a `]` inside a string cannot close it early.
 *
 * The markers are a sequence rather than one string because a TypeScript
 * declaration can carry an EMPTY bracket pair before the literal --
 * `readonly string[] = Object.freeze([...])` -- and a scan that anchored on the
 * first `[` after the name would return `[]` and then assert vacuously against
 * an empty member list. Each marker is asserted present, so a rename cannot
 * silently degrade this into a no-op. */
function arrayLiteralAfter(strippedSrc: string, ...markers: readonly string[]): string {
  let at = 0;
  for (const marker of markers) {
    const found = strippedSrc.indexOf(marker, at);
    assert.notEqual(found, -1, `the marker ${JSON.stringify(marker)} is gone from the source this test reads`);
    at = found + marker.length;
  }
  const open = strippedSrc.indexOf("[", at);
  assert.notEqual(open, -1, `no array literal follows ${JSON.stringify(markers.join(" -> "))}`);

  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < strippedSrc.length; i++) {
    const c = strippedSrc[i]!;
    if (quote) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return strippedSrc.slice(open, i + 1);
    }
  }
  assert.fail(`the array literal after ${JSON.stringify(markers.join(" -> "))} is unterminated`);
}

/** Every double-quoted string literal in `arrayText`, in order. */
function doubleQuotedMembers(arrayText: string): string[] {
  return [...arrayText.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!);
}

/** The members that are FLAGS -- tokens beginning with `-`. Values (`6510`,
 * `plain`, `cbm`) and interpolated paths are not part of the comparison
 * subject; the flag SET is. */
function flagsOf(members: readonly string[]): string[] {
  return members.filter((m) => m.startsWith("-"));
}

/**
 * The three divergences between the two constructions, each declared with its
 * own justification rather than absorbed into a widened comparison. A fourth
 * divergence goes RED instead of landing silently.
 */
const DECLARED_DIVERGENCES = Object.freeze([
  Object.freeze({
    name: "the binary token",
    skillOnly: Object.freeze([] as readonly string[]),
    verifyOnly: Object.freeze([] as readonly string[]),
    justification:
      "the build driver spawns the LITERAL string \"acme\"; the verify module spawns the imported ACME_BIN, because " +
      "the mandatory-red harness requires the binary to be overridable and acme-gate.ts is the one home of that env-var " +
      "name. This is not a flag, so it is asserted DIRECTLY on both sources below rather than subtracted from a flag set.",
  }),
  Object.freeze({
    name: "verbosity",
    skillOnly: Object.freeze(["-v1"] as readonly string[]),
    verifyOnly: Object.freeze(["-v2"] as readonly string[]),
    justification:
      "-v1 emits only the aggregate `Saving ...` line; -v2 adds ACME's own PER-SEGMENT result lines, which are the " +
      "unanimity subject. A build driver wants the aggregate; a verdict refuses to trust it.",
  }),
  Object.freeze({
    name: "the build driver's side outputs",
    skillOnly: Object.freeze(["-l", "--vicelabels", "-r"] as readonly string[]),
    verifyOnly: Object.freeze([] as readonly string[]),
    justification:
      "-l (symbol file), --vicelabels (debugger labels) and -r (report) exist so a BUILD can be inspected afterwards. " +
      "A verify path consumes none of them, and emitting files nothing reads would only widen the temp directory.",
  }),
]);

test("ACME_VERIFY_ARGV_FLAGS is really the list this test reads off disk (so the extraction cannot pass vacuously)", () => {
  const verifyArray = arrayLiteralAfter(
    stripComments(readFileSync(VERIFY_MODULE_PATH, "utf8")),
    "ACME_VERIFY_ARGV_FLAGS",
    "Object.freeze("
  );
  assert.deepEqual(
    doubleQuotedMembers(verifyArray),
    [...ACME_VERIFY_ARGV_FLAGS],
    "the members extracted from acme-verify.ts's source must equal the frozen constant it exports -- otherwise the " +
      "agreement test below is comparing something that is not the flag list actually spawned"
  );
});

test("the two ACME argv constructions agree on every flag except the three declared divergences", () => {
  const verifyFlags = new Set(
    flagsOf(doubleQuotedMembers(arrayLiteralAfter(stripComments(readFileSync(VERIFY_MODULE_PATH, "utf8")), "ACME_VERIFY_ARGV_FLAGS", "Object.freeze(")))
  );
  // `-o` lives in the skill's array literal but is appended at spawn time on
  // the verify side, deliberately excluded from the frozen constant because its
  // VALUE is per-invocation. Both sides do pass it, so it is added back here to
  // make the two sets comparable subjects rather than declared as a divergence
  // that does not exist.
  verifyFlags.add("-o");

  const skillFlags = new Set(
    flagsOf(doubleQuotedMembers(arrayLiteralAfter(stripComments(readFileSync(SKILL_DRIVER_PATH, "utf8")), "const args =")))
  );

  assert.ok(skillFlags.size >= 6, `the skill driver's args array extraction went short: ${[...skillFlags].join(" ")}`);

  for (const divergence of DECLARED_DIVERGENCES) {
    for (const flag of divergence.skillOnly) skillFlags.delete(flag);
    for (const flag of divergence.verifyOnly) verifyFlags.delete(flag);
  }

  const skillSorted = [...skillFlags].sort();
  const verifySorted = [...verifyFlags].sort();
  assert.deepEqual(
    verifySorted,
    skillSorted,
    `the two ACME argv constructions have DRIFTED.\n` +
      `  acme-verify.ts (after declared divergences): ${verifySorted.join(" ")}\n` +
      `  acme-build/scripts/acme.mjs                : ${skillSorted.join(" ")}\n` +
      `These live in SEPARATE npm packages that cannot import each other, so this test is the only thing holding them ` +
      `together. Either add the flag to both, or add a fourth entry to DECLARED_DIVERGENCES with its justification -- ` +
      `widening the exception list must be a visible edit, never a quiet one.`
  );
});

test("the binary-token divergence is real on both sides (the one declared divergence that is not a flag)", () => {
  const skillSrc = stripComments(readFileSync(SKILL_DRIVER_PATH, "utf8"));
  const verifySrc = stripComments(readFileSync(VERIFY_MODULE_PATH, "utf8"));

  assert.match(
    skillSrc,
    /spawnSync\(\s*"acme"\s*,/,
    "the build driver is expected to spawn the LITERAL string \"acme\"; if it now resolves a binary name, the first " +
      "declared divergence has been discharged and should be removed rather than left standing"
  );
  assert.match(
    verifySrc,
    /import\s*\{\s*ACME_BIN\s*\}\s*from\s*"\.\/acme-gate\.ts"/,
    "the verify module must IMPORT ACME_BIN from acme-gate.ts -- a second copy of that env-var name is what acme-gate.ts " +
      "forbids by name, because a rename on one side turns CI's hard FAIL into a silent SKIP with both sides green"
  );
  assert.equal(
    DECLARED_DIVERGENCES.length,
    3,
    "exactly three divergences are declared. Growing this list must be a visible edit with its own justification"
  );
});
