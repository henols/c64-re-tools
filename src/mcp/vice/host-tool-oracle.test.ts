// host-tool-oracle.test.ts
//
// Phase 40, plan 40-04 (PREP-04, D-09..D-12). PREP-04's non-vacuous control,
// as one dedicated file rather than more cases folded into host-tool.test.ts's
// already-large seam suite -- the objective this plan states is that the
// proof be "findable as one unit."
//
// D-12's requirement: for EACH of the six host_tool ids this phase added,
// one test body runs the id against a planted-failure fixture and asserts
// BOTH that the real, production classifier (imported from host-tool.mts,
// NEVER re-derived here) refuses, AND that a deliberately-WRONG, test-local
// "exit-status-only" predicate -- defined ONLY in this file, never exported,
// never imported by production code -- returns "pass" over the IDENTICAL
// captured output and exit code. The two verdicts must DISAGREE; a fixture
// on which they AGREE makes the control vacuous, and this file asserts the
// disagreement EXPLICITLY so a future change that quietly makes them agree
// reds this suite rather than passing it silently.
//
// MEASURED, re-verified live this plan's own session (2026-09-08) against
// BOTH installed VICE builds on this host -- /usr/bin (stock 3.9) and
// /usr/local/bin (the fork, 3.10, the one findSiblingBinary() actually
// resolves here, since backend-detect.mts resolves the fork's x64sc first):
// c1541's own exit code on a genuine failure is NOT uniform across
// subcommands, contrary to this module's own general D-11 comment (written
// from a `-dir`-only measurement). Against BOTH a nonexistent image path and
// the committed fixtures/c1541/not-a-disk.d64: `-dir` and `-entry` exit 0
// every time (genuinely non-vacuous with the REAL binary, no fake needed for
// those two); `-bam`, `-chain` and `-read` exit 1 every time on THIS host's
// resolved binary, which would make a naive exit-status check agree with the
// classifier's own refusal -- a VACUOUS pair, not usable as this plan's
// control. (The stock build additionally SEGFAULTS, exit 139, on `-entry`/
// `-chain`/`-read` against an unopenable image -- a real, separate crash this
// plan does not fix and which the shipped seam never reaches, since
// findSiblingBinary() only ever resolves the sibling of whichever x64sc is
// ALREADY resolved -- the fork build on every host measured this session.)
// `petcat.decode` exits 0 on the committed not-basic.prg (64 deterministic
// non-BASIC bytes), also genuinely non-vacuous with the real binary.
//
// Given CI has no c1541/petcat install at all (40-02's and 40-03's own
// SUMMARYs), and given a different VICE build could realise "exit 0 even on
// a genuine failure" for -bam/-chain/-read exactly as it already does for
// -dir/-entry on this host, every one of the six cases below runs against a
// FAKE, controllable stand-in reproducing the MEASURED (or, for the three
// verbs whose real exit code disagreed on this specific host, the
// DOCUMENTED general D-09 shape "any read verb ... exits 0") failure text --
// never the real binary. This keeps the suite hermetic and CI-safe while
// still proving the classifier does work an exit-code check would not, on
// the exact shape this module's own header names as the reason the oracle
// exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Build BEFORE importing the artifact -- host-tool.test.ts's own idiom --
// so this suite never reaches a stale committed resources/host-tool.mjs.
build();
const hostTool = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as {
  HOST_TOOL_IDS: readonly string[];
  HOST_TOOL_OUTPUT_CLASSIFIERS: Readonly<Record<string, unknown>>;
  runHostTool: (
    raw: unknown,
    deps: { repoRoot: string; log?: (line: string) => void; timeoutMs?: number },
  ) => Promise<{ ok: true; tool: string; message?: never } | { ok: false; message: string }>;
  classifyC1541DirOutput: (stdout: string) => { ok: true } | { ok: false; reason: string };
  classifyC1541BamOutput: (stdout: string) => { ok: true } | { ok: false; reason: string };
  classifyC1541EntryOutput: (stdout: string) => { ok: true } | { ok: false; reason: string };
  classifyC1541ChainOutput: (stdout: string) => { ok: true } | { ok: false; reason: string };
  classifyC1541ReadOutput: (results: readonly unknown[]) => { ok: true } | { ok: false; reason: string };
  classifyPetcatDecodeOutput: (stdout: string) => { ok: true } | { ok: false; reason: string };
};
const {
  runHostTool,
  HOST_TOOL_IDS,
  HOST_TOOL_OUTPUT_CLASSIFIERS,
  classifyC1541DirOutput,
  classifyC1541BamOutput,
  classifyC1541EntryOutput,
  classifyC1541ChainOutput,
  classifyC1541ReadOutput,
  classifyPetcatDecodeOutput,
} = hostTool;

// ---------------------------------------------------------------------------
// D-12 / must_haves: the deliberately-WRONG, test-local oracle. It exists
// ONLY to prove the real classifier above is doing work an exit-code check
// would not -- it must NEVER be exported from this file and NEVER imported
// from production code. A committed grep (this plan's own <verify> block)
// fails the build if its name ever appears outside a `.test.ts` file.
// <planner-discipline-allow: exitStatusOnly>
// ---------------------------------------------------------------------------
function exitStatusOnly(exitCode: number): { ok: true } | { ok: false; reason: string } {
  return exitCode === 0 ? { ok: true } : { ok: false, reason: `exitStatusOnly: exit code ${exitCode} is non-zero` };
}

/** Asserts the real classifier and the deliberately-wrong exit-status-only
 * predicate reach OPPOSITE verdicts over the identical captured output --
 * the non-vacuity proof itself. A fixture on which they AGREE (both refuse,
 * or both pass) reds this assertion rather than passing silently. */
function assertDisagree(
  classifierVerdict: { ok: boolean },
  exitVerdict: { ok: boolean },
  label: string,
): void {
  assert.equal(classifierVerdict.ok, false, `${label}: the real classifier must refuse the planted-failure output`);
  assert.equal(exitVerdict.ok, true, `${label}: the exit-status-only predicate must (wrongly) pass a zero exit code`);
  assert.notEqual(
    classifierVerdict.ok,
    exitVerdict.ok,
    `${label}: the classifier and the exit-status-only predicate must reach OPPOSITE verdicts on this fixture -- ` +
      `an agreeing pair makes this control VACUOUS and must red this assertion, not pass it`,
  );
}

// --------------------------------------------------------------- fixtures

// MEASURED live this plan's own session (2026-09-08) against the committed
// fixtures/c1541/not-a-disk.d64, both installed c1541 builds: "-dir" and
// "-entry" print this text and exit 0 (see this file's own header comment
// for the -bam/-chain/-read divergence and fixtures/c1541/README.md for the
// full transcript).
const C1541_UNOPENABLE_TEXT =
  "cannot open file `not-a-disk.d64'\n" +
  "OPENCBM: opening dynamic library libopencbm.so failed!\n" +
  "Error - Import GCR: Unknown GCR image version 110.\n" +
  "Unknown disk image `not-a-disk.d64'.\n";

// MEASURED live this plan's own session against the committed
// fixtures/petcat/not-basic.prg (64 deterministic non-BASIC bytes -- see
// fixtures/petcat/README.md): petcat -2 prints a banner WITHOUT the
// "==<hex>==" address form and exits 0.
const PETCAT_NOT_BASIC_TEXT = ";not-basic.prg {stop}{$0a}{down}{CTRL-X}{blu}&-4;bipw^{$65}{$6c}{$73}{$7a}garbage\n";

// -------------------------------------------------------- fake stand-ins
//
// Dedicated to this file (a separate mkdtempSync root, never shared with
// host-tool.test.ts's own fakes) -- findSiblingBinary()'s per-binary-name
// memo is per-PROCESS, and `node --test` runs each file in its own process,
// so there is no cross-file interference. c1541 has no env-var override of
// its own (D-13/D-14/D-15); VICE_BACKEND=fork + VICE_BIN redirection is the
// same mechanism host-tool.test.ts's own withFakeC1541() uses.

const FAKE_DIR = realpathSync(mkdtempSync(join(tmpdir(), "host-tool-oracle-fake-")));
const FAKE_X64SC_PATH = join(FAKE_DIR, "fake-x64sc");
writeFileSync(FAKE_X64SC_PATH, "not a real binary -- only its directory matters for sibling resolution\n", "utf8");

const FAKE_C1541_PATH = join(FAKE_DIR, "c1541");
writeFileSync(
  FAKE_C1541_PATH,
  [
    "#!/usr/bin/env node",
    "const argv = process.argv.slice(2);",
    // "-read": the real, measured failure writes NO output file at all --
    // reproduced here by simply never calling writeFileSync.
    'if (argv.includes("-read")) { process.exit(0); }',
    `process.stdout.write(${JSON.stringify(C1541_UNOPENABLE_TEXT)});`,
    "process.exit(0);",
    "",
  ].join("\n"),
  "utf8",
);
chmodSync(FAKE_C1541_PATH, 0o755);

const FAKE_PETCAT_PATH = join(FAKE_DIR, "petcat");
writeFileSync(
  FAKE_PETCAT_PATH,
  ["#!/usr/bin/env node", `process.stdout.write(${JSON.stringify(PETCAT_NOT_BASIC_TEXT)});`, "process.exit(0);", ""].join("\n"),
  "utf8",
);
chmodSync(FAKE_PETCAT_PATH, 0o755);

async function withFakeHostTools<T>(fn: () => Promise<T> | T): Promise<T> {
  const previousBackend = process.env.VICE_BACKEND;
  const previousBin = process.env.VICE_BIN;
  process.env.VICE_BACKEND = "fork";
  process.env.VICE_BIN = FAKE_X64SC_PATH;
  try {
    return await fn();
  } finally {
    if (previousBackend === undefined) delete process.env.VICE_BACKEND;
    else process.env.VICE_BACKEND = previousBackend;
    if (previousBin === undefined) delete process.env.VICE_BIN;
    else process.env.VICE_BIN = previousBin;
  }
}

async function withTempDir<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "host-tool-oracle-test-")));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Six two-directional controls, one test body per tool id.
// ---------------------------------------------------------------------------

test("c1541.dir: the classifier and exitStatusOnly disagree on the committed not-a-disk.d64 fixture, and the full seam refuses", async () => {
  assertDisagree(classifyC1541DirOutput(C1541_UNOPENABLE_TEXT), exitStatusOnly(0), "c1541.dir");
  await withFakeHostTools(async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "not-a-disk.d64"), readFileSync(join(HERE, "fixtures/c1541/not-a-disk.d64")));
      const response = await runHostTool({ tool: "c1541.dir", args: { image: "not-a-disk.d64" } }, { repoRoot: dir });
      assert.equal(response.ok, false, "c1541.dir: the full seam must refuse the planted-failure fixture");
      if (!response.ok) assert.match(response.message, /blocks free/i, "the refusal must name the absent shape");
    });
  });
});

test("c1541.bam: the classifier and exitStatusOnly disagree on the committed not-a-disk.d64 fixture, and the full seam refuses", async () => {
  assertDisagree(classifyC1541BamOutput(C1541_UNOPENABLE_TEXT), exitStatusOnly(0), "c1541.bam");
  await withFakeHostTools(async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "not-a-disk.d64"), readFileSync(join(HERE, "fixtures/c1541/not-a-disk.d64")));
      const response = await runHostTool({ tool: "c1541.bam", args: { image: "not-a-disk.d64" } }, { repoRoot: dir });
      assert.equal(response.ok, false, "c1541.bam: the full seam must refuse the planted-failure fixture");
      if (!response.ok) assert.match(response.message, /allocation row/i, "the refusal must name the absent shape");
    });
  });
});

test("c1541.entry: the classifier and exitStatusOnly disagree on the committed not-a-disk.d64 fixture, and the full seam refuses", async () => {
  assertDisagree(classifyC1541EntryOutput(C1541_UNOPENABLE_TEXT), exitStatusOnly(0), "c1541.entry");
  await withFakeHostTools(async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "not-a-disk.d64"), readFileSync(join(HERE, "fixtures/c1541/not-a-disk.d64")));
      const response = await runHostTool(
        { tool: "c1541.entry", args: { image: "not-a-disk.d64", name: "basicstub" } },
        { repoRoot: dir },
      );
      assert.equal(response.ok, false, "c1541.entry: the full seam must refuse the planted-failure fixture");
      if (!response.ok) assert.match(response.message, /T\/S/i, "the refusal must name the absent shape");
    });
  });
});

test("c1541.chain: the classifier and exitStatusOnly disagree on the committed not-a-disk.d64 fixture, and the full seam refuses", async () => {
  assertDisagree(classifyC1541ChainOutput(C1541_UNOPENABLE_TEXT), exitStatusOnly(0), "c1541.chain");
  await withFakeHostTools(async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "not-a-disk.d64"), readFileSync(join(HERE, "fixtures/c1541/not-a-disk.d64")));
      const response = await runHostTool(
        { tool: "c1541.chain", args: { image: "not-a-disk.d64", name: "basicstub" } },
        { repoRoot: dir },
      );
      assert.equal(response.ok, false, "c1541.chain: the full seam must refuse the planted-failure fixture");
      if (!response.ok) assert.match(response.message, /arrow pair/i, "the refusal must name the absent shape");
    });
  });
});

test("c1541.read: the classifier and exitStatusOnly disagree on the committed not-a-disk.d64 fixture (no output file produced), and the full seam refuses", async () => {
  assertDisagree(classifyC1541ReadOutput([]), exitStatusOnly(0), "c1541.read");
  await withFakeHostTools(async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "not-a-disk.d64"), readFileSync(join(HERE, "fixtures/c1541/not-a-disk.d64")));
      const response = await runHostTool(
        { tool: "c1541.read", args: { image: "not-a-disk.d64", name: "basicstub" } },
        { repoRoot: dir },
      );
      assert.equal(response.ok, false, "c1541.read: the full seam must refuse when no output file was produced");
      if (!response.ok) assert.match(response.message, /byteLength greater than zero/i, "the refusal must name the absent shape");
    });
  });
});

test("petcat.decode: the classifier and exitStatusOnly disagree on the committed not-basic.prg fixture, and the full seam refuses", async () => {
  assertDisagree(classifyPetcatDecodeOutput(PETCAT_NOT_BASIC_TEXT), exitStatusOnly(0), "petcat.decode");
  await withFakeHostTools(async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "not-basic.prg"), readFileSync(join(HERE, "fixtures/petcat/not-basic.prg")));
      const response = await runHostTool({ tool: "petcat.decode", args: { image: "not-basic.prg" } }, { repoRoot: dir });
      assert.equal(response.ok, false, "petcat.decode: the full seam must refuse the planted-failure fixture");
      if (!response.ok) assert.match(response.message, /BASIC program/i, "the refusal must name the absent shape");
    });
  });
});

// ---------------------------------------------------------------------------
// A zero-byte captured output is refused by every one of the six
// classifiers, each with its own named reason -- never read as "nothing to
// check" and never as success.
// ---------------------------------------------------------------------------

test("zero-byte captured output: c1541.dir's classifier refuses with a named reason", () => {
  const verdict = classifyC1541DirOutput("");
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.ok(verdict.reason.length > 0, "the refusal must carry a non-empty reason");
});

test("zero-byte captured output: c1541.bam's classifier refuses with a named reason", () => {
  const verdict = classifyC1541BamOutput("");
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.ok(verdict.reason.length > 0, "the refusal must carry a non-empty reason");
});

test("zero-byte captured output: c1541.entry's classifier refuses with a named reason", () => {
  const verdict = classifyC1541EntryOutput("");
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.ok(verdict.reason.length > 0, "the refusal must carry a non-empty reason");
});

test("zero-byte captured output: c1541.chain's classifier refuses with a named reason", () => {
  const verdict = classifyC1541ChainOutput("");
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.ok(verdict.reason.length > 0, "the refusal must carry a non-empty reason");
});

test("zero-byte captured output: c1541.read's classifier refuses with a named reason (empty results, not empty stdout)", () => {
  const verdict = classifyC1541ReadOutput([]);
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.ok(verdict.reason.length > 0, "the refusal must carry a non-empty reason");
});

test("zero-byte captured output: petcat.decode's classifier refuses with a named reason", () => {
  const verdict = classifyPetcatDecodeOutput("");
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.ok(verdict.reason.length > 0, "the refusal must carry a non-empty reason");
});

// ---------------------------------------------------------------------------
// Classifier-table completeness, in BOTH directions.
// ---------------------------------------------------------------------------

test("HOST_TOOL_OUTPUT_CLASSIFIERS: one own property per HOST_TOOL_IDS member, in both directions", () => {
  for (const id of HOST_TOOL_IDS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(HOST_TOOL_OUTPUT_CLASSIFIERS, id),
      `HOST_TOOL_OUTPUT_CLASSIFIERS must carry an own property for "${id}" -- a tool id added without a classifier ` +
        `decision must red this`,
    );
  }
  for (const key of Object.keys(HOST_TOOL_OUTPUT_CLASSIFIERS)) {
    assert.ok(
      HOST_TOOL_IDS.includes(key),
      `HOST_TOOL_OUTPUT_CLASSIFIERS carries an entry for "${key}", which is not a member of HOST_TOOL_IDS -- a ` +
        `classifier left behind for a removed id must red this`,
    );
  }
});
