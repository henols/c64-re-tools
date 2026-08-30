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
// COST, STATED RATHER THAN SMUGGLED: NINE child processes per suite run, plus
// two spawns that fail before exec. The nine are: one `/bin/true`; six real
// ACME assembles (the tracer, MANDATORY RED 2's honest control and its red, the
// stale-output reproduction's direct spawn, and the `!error` test's
// honest-then-failing pair); and the two `node --test` children of the
// MANDATORY RED 1 harness, whose failing direction is MEMOISED so several
// assertions share ONE spawn. The two `node --test` children dominate at
// roughly a second each, because each pays a fresh Node start plus
// `acme-gate.ts`'s module-load probe of a binary that is not there; the six
// ACME runs are milliseconds apiece. On top of all of it sits this process's
// own `acme-gate.ts` probe, paid once per node process and shared with every
// other ACME-gated file, not billed again here.
//
// This file is deliberately never added to `MANUAL_ONLY_TESTS`: `test-gate.mjs`'s
// `automatedTestFiles()` auto-discovers every on-disk `*.test.*`, and
// `test-gate.test.ts`'s drift guard fails the build if a file escapes both sets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import {
  ACME_VERIFY_ARGV_FLAGS,
  classifySpawn,
  firstResultLineDisagreement,
  missingAssemblerIsNeverAPass,
  parseAcmeAggregateLines,
  parseAcmeDiagnostics,
  parseAcmeResultLines,
  refuseOnCompetingAggregates,
  verifyAcmeAssembles,
  type AcmeOutcome,
  type SpawnClassifier,
} from "./acme-verify.ts";
import { exportAsm } from "./anno-export-asm.ts";
import { openStore, closeStore, setDataType, setLabel } from "./anno-store.ts";
import { repoRoot } from "./repo-root.ts";

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
// through the `acmeBin` seam with its paired `/bin/true` direction; the ENV-VAR
// boundary -- `ACME_BIN` is read from the environment once at module load, so
// only a child process can move it -- is proved by MANDATORY RED 1's child
// harness, also above. Neither is a substitute for the other, and a third,
// weaker in-process copy of either would only dilute both.
// ---------------------------------------------------------------------------

/** The tracer subject's own bytes: `lda #$00` / `sta $d020` / `rts` -- six
 * bytes covering $0801..$0806. Index 1 is the `lda`'s immediate operand, which
 * MANDATORY RED 2 below corrupts. */
const TRACER_BODY: readonly number[] = [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60];

/**
 * Builds the tracer's store, image and export ONCE, in one place, and hands the
 * export to `fn`. Factored out so MANDATORY RED 2 is provably a change of ONE
 * BYTE against the same export and nothing else -- a second, separately-written
 * copy of the scenario would leave "the red differs from the control somewhere
 * else too" as an open possibility, and the red's whole claim is that one byte
 * is the entire difference.
 */
function buildTracerExport(fn: (result: ReturnType<typeof exportAsm>) => void): void {
  withStore(
    0x0801,
    TRACER_BODY,
    [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    [{ address: 0x0801, name: "entry" }],
    ({ dir, storePath, imagePath }) => fn(exportAsm({ storePath, imagePath, workspaceRoot: dir }))
  );
}

test("TRACER: store -> export -> real ACME 0.97 -> byte-diff -> ok", { skip: SKIP_REASON }, () => {
  buildTracerExport((result) => {
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
  });
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
      // Compared on the DEFINITION only, with any trailing comment split off:
      // `zpf_10` matches `AUTO_NAME_PREFIX_RE`, so the exporter appends its
      // auto-generated-name marker to that line. The digit count is what this
      // test is about, and a comment cannot change a byte.
      const zpIndex = lines.findIndex((l) => l.startsWith("zpf_10 = "));
      assert.equal(
        lines[zpIndex]?.split("  ;")[0],
        "zpf_10 = $10",
        `a zero-page definition must carry two hex digits; got:\n${result.source}`
      );
      assert.ok(
        lines.includes("entry = $0801"),
        `a definition at or above $0100 must carry four hex digits; got:\n${result.source}`
      );

      const firstOrigin = lines.findIndex((l) => l.startsWith("* ="));
      const lastDefinition = Math.max(zpIndex, lines.indexOf("entry = $0801"));
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

// ---------------------------------------------------------------------------
// MANDATORY RED 2 (plan 30-02): A CORRUPTED BYTE IS CAUGHT BY THE DIFF WHILE
// ACME ITSELF REPORTS SUCCESS.
//
// Measured on ACME 0.97 (RESEARCH.md Pitfall 3): `lda #$00` and `lda #$01` both
// assemble and both exit 0, and their bytes differ. The exit status cannot see
// a wrong byte, so it cannot be the verdict EVEN WHEN IT IS ZERO -- which is a
// separate and stronger claim than "a missing assembler is not a pass", and is
// why this red exists alongside red 1 rather than instead of it.
//
// The whole content of this red is the three fields co-occurring in ONE
// recorded result: `outcome: "failed"`, `byteDiff.equal: false`, and
// `exitStatus: 0`.
// ---------------------------------------------------------------------------

test("MANDATORY RED 2: a corrupted export byte fails the byte-diff while ACME itself exits 0", { skip: SKIP_REASON }, () => {
  buildTracerExport((result) => {
    // 1. The honest control FIRST, so the red below is a change of exactly one
    //    byte against the same export and nothing else.
    const honest = verifyAcmeAssembles({
      source: result.source,
      expectedBytes: result.expectedBytes,
      expectedSegments: result.blocks,
    });
    assert.equal(
      honest.outcome,
      "ok",
      `the honest control must pass before the corruption means anything; reason: ${honest.reason}`
    );
    // Rule 5 of the five, observed end to end: this very source trips ACME's
    // `-Wtype-mismatch` warning on its `sta $d020` raw-number operand, and a
    // WARNING NEVER FAILS THE VERDICT.
    assert.ok(
      honest.diagnostics.length >= 1,
      "the tracer source trips a real ACME Warning; if it stopped doing so this control silently stopped proving " +
        `that warnings are non-fatal. diagnostics: ${JSON.stringify(honest.diagnostics)}`
    );
    assert.equal(
      parseAcmeDiagnostics(honest.diagnostics.join("\n")).every((d) => d.severity === "Warning"),
      true,
      `an "ok" verdict must carry only Warnings; got ${JSON.stringify(honest.diagnostics)}`
    );

    // 2. Flip ONE operand byte. Index 1 is the `lda`'s immediate operand:
    //    `a9 00` becomes `a9 01`, which is the measured Pitfall 3 shape --
    //    both forms assemble, both exit 0, the bytes differ.
    const CORRUPTED_INDEX = 1;
    const corrupted = Uint8Array.from(result.expectedBytes);
    assert.equal(corrupted[CORRUPTED_INDEX], 0x00, "the byte about to be corrupted must be the `lda #$00` operand");
    corrupted[CORRUPTED_INDEX] = 0x01;

    // 3. The red.
    const red = verifyAcmeAssembles({
      source: result.source,
      expectedBytes: corrupted,
      expectedSegments: result.blocks,
    });
    const recorded = JSON.stringify(
      {
        outcome: red.outcome,
        exitStatus: red.exitStatus,
        acmeResultLines: red.acmeResultLines,
        aggregateLines: red.aggregateLines,
        diagnostics: red.diagnostics,
        byteDiff: red.byteDiff,
        reason: red.reason,
      },
      null,
      2
    );

    assert.equal(red.outcome, "failed", `a wrong expected byte must FAIL:\n${recorded}`);
    assert.equal(red.byteDiff?.equal, false, `the byte-diff is the verdict and it must disagree:\n${recorded}`);
    assert.equal(
      red.byteDiff?.firstDifferingOffset,
      CORRUPTED_INDEX,
      `the first differing offset is a BYTE offset and must name the byte that was flipped:\n${recorded}`
    );
    assert.equal(
      red.exitStatus,
      0,
      "ACME REPORTED SUCCESS -- exit status 0 -- AND THE BYTE-DIFF CAUGHT IT ANYWAY. That co-occurrence is the whole " +
        "content of this red: an exit status cannot see a wrong byte, so it can never be the verdict, not even when " +
        `it is zero:\n${recorded}`
    );
  });
});

// ---------------------------------------------------------------------------
// THE STALE-OUTPUT TRAP (RESEARCH.md Pitfall 1) -- the FOURTH false-pass
// vector, and the one undocumented anywhere in this repo before Phase 30.
//
// ACME fails, exits 1, prints an error, and LEAVES A PRE-EXISTING OUTPUT FILE
// COMPLETELY UNTOUCHED. A verify path that assembles to a fixed path and diffs
// it would find yesterday's correct bytes and report a pass on a tree where the
// exporter is broken.
//
// Two tests: ACME's behaviour reproduced directly on this host, and the
// module's defence against it observed behaviourally.
// ---------------------------------------------------------------------------

test("real ACME does NOT truncate its output file on failure: a pre-existing file survives an exit-1 run untouched", { skip: SKIP_REASON }, () => {
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-stale-"));
  try {
    const outPath = join(dir, "stale.bin");
    const KNOWN_BYTES = Buffer.from("STALE", "ascii");
    writeFileSync(outPath, KNOWN_BYTES);

    const srcPath = join(dir, "dup.a");
    writeFileSync(srcPath, ["!cpu 6510", "dup = $10", "dup = $20", "* = $0801", "\trts", ""].join("\n"), "utf8");

    // argv ARRAY, never a shell string (T-30-01), and the same `-f plain
    // --msvc` shape the verdict uses.
    const r = spawnSync(ACME_BIN, ["-f", "plain", "--msvc", "-o", outPath, srcPath], {
      encoding: "utf8",
      timeout: 30_000,
    });
    const transcript = `exit=${r.status}\nstdout:\n${r.stdout ?? ""}\nstderr:\n${r.stderr ?? ""}`;

    assert.equal(r.status, 1, `a duplicate symbol assignment must fail ACME:\n${transcript}`);
    const diagnostics = parseAcmeDiagnostics(r.stderr ?? "");
    assert.ok(
      diagnostics.some((d) => d.severity === "Error" && /already defined/i.test(d.message)),
      `ACME's own duplicate-symbol diagnostic must be parsed as an Error:\n${transcript}`
    );
    assert.equal(
      Buffer.compare(readFileSync(outPath), KNOWN_BYTES),
      0,
      "THE VECTOR: the pre-existing output file still holds the bytes it held BEFORE the failing run. Nothing " +
        "truncates it, because ACME opens the output only after a successful final pass. A verify path using a " +
        `fixed output path would byte-diff these bytes and call the failed run a pass:\n${transcript}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failing `!error` assertion is `failed` with byteDiff null, and an earlier honest run's diff never survives into it", { skip: SKIP_REASON }, () => {
  // Differs from TRIVIAL_SOURCE by exactly one trailing line: a `*`-assertion
  // that cannot hold. Measured on this host: exit 1, the `!error` text on
  // stderr, and NO output file written at all.
  const failingSource = [
    "!cpu 6510",
    "* = $0801",
    "\tlda #$00",
    "\trts",
    '!if * != $0899 { !error "block end drifted: expected $0899" }',
    "",
  ].join("\n");

  // Run 1: honest. Establishes that a passing `byteDiff` exists to be leaked.
  const honest = verifyAcmeAssembles({
    source: TRIVIAL_SOURCE,
    expectedBytes: TRIVIAL_BYTES,
    expectedSegments: TRIVIAL_SEGMENTS,
  });
  assert.equal(honest.outcome, "ok", `the honest run must pass first; reason: ${honest.reason}`);
  assert.equal(honest.byteDiff?.equal, true, "the honest run's diff is the thing that must NOT survive into run 2");

  // Run 2: the same primitive, immediately after, on a source that cannot
  // produce an output file.
  const failed = verifyAcmeAssembles({
    source: failingSource,
    expectedBytes: TRIVIAL_BYTES,
    expectedSegments: TRIVIAL_SEGMENTS,
  });
  assert.equal(failed.outcome, "failed", `reason: ${failed.reason}`);
  assert.equal(
    failed.byteDiff,
    null,
    "THE LOAD-BEARING HALF: a null byteDiff proves NO BYTES WERE READ AT ALL, and therefore that no previous run's " +
      "product could have been reported as a match. Every invocation assembles into its own fresh mkdtemp directory, " +
      `so the two runs cannot even share a path. reason: ${failed.reason}`
  );
  assert.match(
    failed.reason,
    /block end drifted/,
    "the reason quotes ACME's OWN `!error` text, which is the rule that fires FIRST under the documented reason " +
      "precedence -- a diagnostic beats the downstream absent-output-file consequence, so this case never reaches " +
      `the absent-file wording and must not be asserted against it. reason: ${failed.reason}`
  );
});

// ---------------------------------------------------------------------------
// ONE NAMED TEST PER VERDICT RULE, EACH AGAINST ITS OWN NAMED PURE HELPER.
//
// The end-to-end path exercises all five at once, which means a rule that
// silently stopped firing would still leave the tracer green as long as the
// bytes happened to agree. Driving each helper directly, with the VERBATIM real
// ACME output recorded in `30-RESEARCH.md` § Code Examples 7 and 2, is what
// makes each rule independently observable.
//
// These strings are COPIED, not paraphrased: a paraphrase would test the parser
// against a shape the assembler never printed.
// ---------------------------------------------------------------------------

/** Real ACME `-v2` STDOUT for the two-block case, verbatim (RESEARCH.md § Code
 * Examples 2), reproduced live on this host. */
const REAL_V2_STDOUT = [
  "First pass.",
  "Segment size is 3 (0x3) bytes (0x801 - 0x804 exclusive).",
  "Segment size is 1 (0x1) bytes (0x810 - 0x811 exclusive).",
  "Saving 16 (0x10) bytes (0x801 - 0x811 exclusive).",
  "",
].join("\n");

/** Real ACME `--msvc` STDERR lines, verbatim (RESEARCH.md § Code Examples 7). */
const REAL_MSVC_STDERR = [
  "dup.a(4) : Error (Zone <untitled>): Symbol already defined.",
  "warn.a(3) : Warning (Zone <untitled>): Assembling unstable LXA #NONZERO instruction",
  "warn.a(4) : Warning (Zone <untitled>): Assembling buggy JMP($xxff) instruction",
  "f1.a(3) : Warning (Zone <untitled>): Using oversized addressing mode.",
  "ovl.a(5) : Error (Zone <untitled>): Segment starts inside another one, overwriting it.",
  "",
].join("\n");

test("VERDICT RULE 1 of five: parseAcmeResultLines() reads ACME's OWN per-segment lines off real -v2 stdout", () => {
  const parsed = parseAcmeResultLines(REAL_V2_STDOUT);
  assert.deepEqual(
    parsed,
    [
      { start: 0x0801, endExclusive: 0x0804, size: 3, raw: "Segment size is 3 (0x3) bytes (0x801 - 0x804 exclusive)." },
      { start: 0x0810, endExclusive: 0x0811, size: 1, raw: "Segment size is 1 (0x1) bytes (0x810 - 0x811 exclusive)." },
    ],
    "one record per `Segment size is ...` line, with start and endExclusive parsed from the NON-zero-padded hex " +
      "extents (`0x801`, not `0x0801`) and the size read as decimal"
  );
  assert.equal(
    parsed.some((p) => p.raw.startsWith("Saving")),
    false,
    "the aggregate `Saving ...` line is NOT a per-segment result line -- folding it in would make the unanimity " +
      "subject include the very line this module refuses to trust"
  );
  assert.equal(parsed.some((p) => p.raw === "First pass."), false, "`First pass.` is progress noise, not a result line");
});

test("VERDICT RULE 2 of five: parseAcmeAggregateLines() returns the `Saving ...` lines and nothing else -- recorded, never trusted", () => {
  assert.deepEqual(
    parseAcmeAggregateLines(REAL_V2_STDOUT),
    ["Saving 16 (0x10) bytes (0x801 - 0x811 exclusive)."],
    "exactly the aggregate line: not the per-segment lines, not `First pass.`"
  );
  assert.deepEqual(parseAcmeAggregateLines(""), [], "no stdout means no aggregate lines, not an invented one");
  // The structural twin of the line that lied in the carried false-pass trap:
  // one line asserting a whole run passed, above per-item detail nobody read.
  assert.equal(
    parseAcmeAggregateLines(REAL_V2_STDOUT).length < parseAcmeResultLines(REAL_V2_STDOUT).length,
    true,
    "the aggregate summarises MORE detail than it carries, which is exactly why it is recorded and never consulted"
  );
});

test("VERDICT RULE 3 of five: refuseOnCompetingAggregates() refuses two disagreeing aggregates and passes one or none", () => {
  const reason = refuseOnCompetingAggregates([
    "Saving 16 (0x10) bytes (0x801 - 0x811 exclusive).",
    "Saving 32 (0x20) bytes (0x801 - 0x821 exclusive).",
  ]);
  assert.equal(typeof reason, "string", "two competing authoritative lines must produce a refusal");
  assert.match(String(reason), /refuses to pick/, `the refusal must say it is a refusal and not a guess; got ${reason}`);
  assert.match(String(reason), /0x811/, "the refusal must quote the competing lines so a human can see the disagreement");
  assert.match(String(reason), /0x821/, "both competing lines, not just the first");

  assert.equal(
    refuseOnCompetingAggregates(["Saving 16 (0x10) bytes (0x801 - 0x811 exclusive)."]),
    undefined,
    "one aggregate line is not a disagreement"
  );
  assert.equal(refuseOnCompetingAggregates([]), undefined, "no aggregate line is not a disagreement either");
});

test("VERDICT RULE 4 of five: firstResultLineDisagreement() names the FIRST disagreeing index, and agrees silently", () => {
  const parsed = parseAcmeResultLines(REAL_V2_STDOUT);
  assert.equal(
    firstResultLineDisagreement(parsed, [
      { start: 0x0801, endExclusive: 0x0804 },
      { start: 0x0810, endExclusive: 0x0811 },
    ]),
    undefined,
    "every pair agreeing means no reason at all -- silence is what unanimity looks like"
  );

  // A passing EARLIER line must never hide a later failing one.
  const later = firstResultLineDisagreement(parsed, [
    { start: 0x0801, endExclusive: 0x0804 },
    { start: 0x0810, endExclusive: 0x0812 },
  ]);
  assert.match(String(later), /result line 1 /, `the FIRST mismatch is at index 1 and must be named; got ${later}`);
  assert.match(String(later), /\$0812/, "the reason must state what was expected");
  assert.match(String(later), /\$0811/, "and what ACME actually reported");

  const count = firstResultLineDisagreement(parsed, [{ start: 0x0801, endExclusive: 0x0804 }]);
  assert.match(String(count), /in COUNT/, `a count disagreement is the degenerate case of the same property; got ${count}`);
  assert.match(String(count), /never skipped/, "the message must record that this rule runs on every verdict");
});

test("VERDICT RULE 5 of five: parseAcmeDiagnostics() classifies real Warning lines as warnings and real Error lines as errors", () => {
  const parsed = parseAcmeDiagnostics(REAL_MSVC_STDERR);
  assert.deepEqual(
    parsed.map((d) => d.severity),
    ["Error", "Warning", "Warning", "Warning", "Error"],
    "ACME's own three severity spellings, preserved rather than normalised to a lowercase form a reader has to map back"
  );
  assert.deepEqual(
    parsed.map((d) => `${d.file}:${d.line}`),
    ["dup.a:4", "warn.a:3", "warn.a:4", "f1.a:3", "ovl.a:5"],
    "the --msvc shape carries the file and the 1-based line, and both are parsed"
  );
  assert.equal(parsed[0]!.zone, "Zone <untitled>", "ACME's zone is captured verbatim");
  assert.equal(parsed[0]!.message, "Symbol already defined.", "the message is the text after the final colon");

  // The safety net: ACME's DEFAULT (non---msvc) spelling, measured verbatim.
  const bare = parseAcmeDiagnostics("Error - File dup.a, line 4 (Zone <untitled>): Symbol already defined.\n");
  assert.equal(bare.length, 1, "a build that ignored --msvc must not read as `no diagnostics were reported`");
  assert.equal(bare[0]!.severity, "Error");
  assert.equal(bare[0]!.file, "dup.a");
  assert.equal(bare[0]!.line, 4);

  // A `Serious error` must never be shortened to its `Error` suffix, and must
  // never fall through to the Warning branch.
  const serious = parseAcmeDiagnostics("x.a(1) : Serious error (Zone <untitled>): Out of memory.\n");
  assert.equal(serious[0]!.severity, "Serious error");
});

// ---------------------------------------------------------------------------
// EXPORT-03, STRUCTURALLY: THE VERDICT IS NEVER A STRING MATCH ON THE
// EXPORTER'S OWN OUTPUT.
//
// An oracle that decided by re-rendering, re-parsing or substring-matching the
// text the exporter produced would be a self-check wearing an oracle's clothes:
// it would agree with the exporter by construction, and this project's record
// is that an internally-verified opcode table still shipped fourteen wrong
// entries. The verdict's only basis is an octet comparison against bytes the
// CALLER derived from the image.
//
// The scan is paired with two controls, following
// `anno-cli-path-consumers.test.ts`'s discipline: a planted violation (so the
// predicate is provably able to report one) and a comment-only source (so the
// scan cannot degrade into a substring search that passes by counting its own
// prose).
// ---------------------------------------------------------------------------

/** Substring-containment / text-search calls whose RECEIVER is the
 * caller-supplied source text. */
const SOURCE_TEXT_SEARCH_RE =
  /\b(?:options\s*\.\s*)?source\s*\.\s*(?:includes|indexOf|lastIndexOf|search|match|matchAll|startsWith|endsWith|split)\s*\(/;

/** The mirrored form: a regex or string tested AGAINST the source text. */
const SOURCE_TEXT_TESTED_RE = /\.\s*(?:test|exec)\s*\(\s*(?:options\s*\.\s*)?source\s*[),]/;

/** THE ONE PREDICATE. The real scan and both controls call this same function,
 * so there is exactly one definition of "decides from the exporter's own text". */
function matchesOnCallerSourceText(strippedSrc: string): boolean {
  return SOURCE_TEXT_SEARCH_RE.test(strippedSrc) || SOURCE_TEXT_TESTED_RE.test(strippedSrc);
}

test("EXPORT-03: the verdict never string-matches the exporter's own output, and the scan that says so can go red", () => {
  const realSrc = stripComments(readFileSync(VERIFY_MODULE_PATH, "utf8"));
  assert.equal(
    matchesOnCallerSourceText(realSrc),
    false,
    "acme-verify.ts must never search, split or regex-test the caller-supplied `source` text. A verdict derived " +
      "from the exported text agrees with the exporter by construction -- it is a self-check wearing an oracle's " +
      "clothes, and the byte-diff against image-derived bytes is the only thing that makes this a round trip"
  );

  // Planted violation: the defect's minimal shape.
  const plantedViolation = [
    "export function verdict(options: { source: string }): string {",
    '  if (options.source.includes("!error")) return "failed";',
    '  return "ok";',
    "}",
    "",
  ].join("\n");
  assert.equal(
    matchesOnCallerSourceText(stripComments(plantedViolation)),
    true,
    "the predicate must REPORT a verdict derived from the source text -- if this passes, the real scan above is not " +
      "capable of catching a violation and a control that only ever refuses is indistinguishable from one that works"
  );

  // Comment-only control: the half that keeps the scan trustworthy by proving
  // it did not become a substring search over prose. Both shapes below are real
  // -- acme-verify.ts's own header names this hazard repeatedly.
  const commentOnly = [
    "// Never decide from options.source.includes(...) -- that is a self-check.",
    "/* A verdict must not do source.match(/!error/) either. */",
    "export function verdict(options: { expectedBytes: Uint8Array }): number {",
    "  return options.expectedBytes.length;",
    "}",
    "",
  ].join("\n");
  assert.equal(
    matchesOnCallerSourceText(stripComments(commentOnly)),
    false,
    "a mention inside only a // comment and a block comment must NOT be reported -- otherwise the guard fails by " +
      "matching the very prose that described the problem, and would have to be weakened to pass"
  );
});

// ---------------------------------------------------------------------------
// THE PINNED TRANSCRIPTS, KEPT HONEST.
//
// Phase 29 moved two verify transcripts under `.planning/` when it deleted the
// producer that made them, and its README set this phase an explicit
// obligation: RE-RECORD both from real assembler output through the NEW route,
// and never assert a rebuilt parser against the retired producer's bytes,
// because a green test over those bytes would prove only that the new parser
// can read a deleted tool's format.
//
// The obligation is discharged with evidence rather than deleted. This block is
// the evidence: the new transcripts exist, their provenance is recorded, the
// parser and its own evidence agree, the new files are provably NOT copies, and
// nothing else in this tree reads the retired producer's directory.
// ---------------------------------------------------------------------------

/** The Phase 29 fixtures directory, relative to `.planning/phases/`. Named in
 * ONE place -- this constant -- so the assertions below have a single site to
 * update if those files ever move, and so the scan further down can name the
 * exact literal a violation would have to contain. */
const PHASE_29_FIXTURES_REL = "29-the-mcp-surface/fixtures";

const PLANNING_PHASES = join(repoRoot(), ".planning", "phases");
const PHASE_29_FIXTURES_DIR = join(PLANNING_PHASES, PHASE_29_FIXTURES_REL);
const PHASE_30_FIXTURES_DIR = join(PLANNING_PHASES, "30-acme-export-and-the-real-acme-oracle", "fixtures");

/** The two transcript filenames, identical on both sides -- which is exactly
 * what makes the byte-inequality assertion below meaningful. */
const PINNED_TRANSCRIPTS = ["verify-honest-pass.txt", "verify-false-pass-trap.txt"] as const;

/** Pulls one delimited section out of a captured transcript. The delimiters are
 * written by `capture-transcripts.mjs`; a missing one is an assertion failure
 * rather than an empty string, so a reformatted transcript cannot make the
 * agreement assertion below pass by comparing nothing to nothing. */
function transcriptSection(text: string, name: string): string {
  const begin = `>>> BEGIN ${name}\n`;
  const end = `\n<<< END ${name}`;
  const from = text.indexOf(begin);
  assert.notEqual(from, -1, `the transcript no longer carries a ${JSON.stringify(name)} section`);
  const to = text.indexOf(end, from);
  assert.notEqual(to, -1, `the transcript's ${JSON.stringify(name)} section is unterminated`);
  return text.slice(from + begin.length, to);
}

test("the phase's own pinned transcripts and their provenance README are on disk", () => {
  for (const name of PINNED_TRANSCRIPTS) {
    assert.ok(existsSync(join(PHASE_30_FIXTURES_DIR, name)), `${name} is missing from ${PHASE_30_FIXTURES_DIR}`);
  }
  assert.ok(existsSync(join(PHASE_30_FIXTURES_DIR, "README.md")), "the fixtures README carries the provenance table");
  assert.ok(
    existsSync(join(PHASE_30_FIXTURES_DIR, "capture-transcripts.mjs")),
    "the README's Regenerating section names a real program; evidence whose production cannot be re-run is a claim"
  );
});

test("the fixtures README records the assembler release string and a capture date", () => {
  const readme = readFileSync(join(PHASE_30_FIXTURES_DIR, "README.md"), "utf8");
  assert.match(
    readme,
    /ACME 0\.97 "Zem"/,
    "the provenance table must name the exact assembler release the transcripts came out of -- `an assembler` is not provenance"
  );
  assert.match(
    readme,
    /\b20\d\d-\d\d-\d\d\b/,
    "the provenance table must carry a capture date, so a reader can tell a fresh capture from a stale one"
  );
  assert.match(
    readme,
    /read for shape only|read \*\*for shape only\*\*|for shape only/i,
    "the DO-NOT block must answer the Phase 29 README's obligation BY NAME: those transcripts were read for shape only " +
      "and are never asserted against"
  );
});

test("the honest-pass transcript and parseAcmeResultLines() agree -- the parser and its own evidence tell the same story", () => {
  const honest = readFileSync(join(PHASE_30_FIXTURES_DIR, "verify-honest-pass.txt"), "utf8");
  const stdoutSection = transcriptSection(honest, "ACME STDOUT");
  const recorded = transcriptSection(honest, "AcmeVerifyResult.acmeResultLines")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  assert.ok(
    recorded.length >= 1,
    "the transcript records at least one per-segment result line; zero would make the comparison below vacuous"
  );
  assert.deepEqual(
    parseAcmeResultLines(stdoutSection).map((p) => p.raw),
    recorded,
    "re-parsing the transcript's own captured STDOUT must reproduce exactly the acmeResultLines the transcript " +
      "records. A disagreement means either the parser drifted from the assembler output it claims to read, or the " +
      "transcript was edited by hand after capture -- and the README forbids the second"
  );
});

test("non-vacuity: each re-recorded transcript is NOT byte-equal to its Phase 29 counterpart", () => {
  for (const name of PINNED_TRANSCRIPTS) {
    const mine = readFileSync(join(PHASE_30_FIXTURES_DIR, name));
    const retired = readFileSync(join(PHASE_29_FIXTURES_DIR, name));
    assert.notEqual(
      Buffer.compare(mine, retired),
      0,
      `${name} is BYTE-EQUAL to the Phase 29 file of the same name, which means it was COPIED rather than ` +
        `re-recorded. The re-record obligation exists because the Phase 29 bytes are a deleted producer's output: ` +
        `pinning them again would prove this phase's parser can read a tool that no longer exists, which is the one ` +
        `piece of evidence it must not claim to have.`
    );
  }
});

test("no test in this phase reads the retired producer's fixtures directory", () => {
  const testFiles = readdirSync(HERE).filter((f) => /\.test\./.test(f));
  assert.ok(
    testFiles.length >= 20,
    `the test-file census went short (${testFiles.length}) -- a truncated listing would make the scan below pass trivially`
  );

  const offenders = testFiles.filter(
    (f) => f !== "acme-verify.test.ts" && readFileSync(join(HERE, f), "utf8").includes(PHASE_29_FIXTURES_REL)
  );
  assert.deepEqual(
    offenders,
    [],
    `these test files name the retired producer's fixtures directory: ${offenders.join(", ")}. THE HAZARD IS ` +
      `RE-PINNING: an assertion against those bytes would hold a rebuilt parser to a deleted tool's output format, ` +
      `and would keep passing long after the format it really has to read had moved. This file is the ONE exception, ` +
      `and it names that directory for exactly one purpose -- asserting the new transcripts are not copies of it.`
  );

  const self = readFileSync(join(HERE, "acme-verify.test.ts"), "utf8");
  assert.equal(
    self.split(PHASE_29_FIXTURES_REL).length - 1,
    1,
    "the retired directory is named EXACTLY ONCE in this file, in the PHASE_29_FIXTURES_REL constant, so there is " +
      "one place to update if those files ever move. A second occurrence means a path was rebuilt by hand somewhere"
  );
});

// ---------------------------------------------------------------------------
// D30-01 / USER-D-02: this module SHIPS NOWHERE, and that is mechanically
// enforced rather than promised.
//
// The mirror of `acme-gate.test.ts`'s own absence assertion, deliberately
// worded the same way and placed next to its subject rather than beside that
// one. Added 2026-08-31, in the plan that made `anno-export-asm.ts` reachable
// from `vice-proxy.ts` through `anno-cli.ts`: the exporter joining the
// published closure is exactly the change that makes it tempting to let the
// verifier follow it.
// ---------------------------------------------------------------------------

test("acme-verify.ts is absent from package.json's files[] array (test-only, mechanically enforced)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(
    pkg.files.includes("acme-verify.ts"),
    false,
    "acme-verify.ts is test-only and must never ship in the published npm tarball. Being absent is what lets it " +
      "import ACME_BIN from acme-gate.ts instead of resolving that environment variable itself -- which acme-gate.ts " +
      "forbids by name, because a second resolution of ACME_BIN is a second answer to which assembler ran"
  );
  // The paired direction, so this is a discrimination rather than a blanket
  // refusal: the module it verifies DOES ship, and shipped in the commit that
  // created it. Without this half, an accidentally-emptied files[] would
  // satisfy the assertion above.
  assert.equal(
    pkg.files.includes("anno-export-asm.ts"),
    true,
    "anno-export-asm.ts is shipped runtime -- it is reachable from vice-proxy.ts through anno-cli.ts's export-asm " +
      "verb, and check-npm-packages.mjs's closure walk fails the pack when a reachable module is unlisted"
  );
});
