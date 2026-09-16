// hazard-subject-exported-edit.test.ts -- Phase 50 plan 50-08 Task 1's own
// guard: the committed `hazard-subject-exported-edit.prg` is re-derived
// (never trusted) from the committed manifest and the committed store, and
// the driver's own refusal paths are each observed actually refusing.
//
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// `make-exported-edit.mjs` is a driver, not a test: it writes a committed
// fixture and a committed evidence record as a side effect of running once.
// This file is what proves that fixture is reproducible from committed
// inputs alone, and that the driver's five named refusal conditions each
// actually stop the run rather than silently degrading into a pass. Every
// case here runs the driver as a REAL subprocess (`spawnSync(process.execPath,
// [...])`) against a scratch copy of the manifest, on the same
// subprocess-not-import pattern `reassembly-gate-modified-run.test.ts`'s own
// header states for `compare-cross-binary.mjs`: the driver's own single
// real-assembler call still goes through `acme-verify.ts` and nothing here
// adds a second launch site of its own.
//
// GATE. Exactly one test always runs and is never skipped: "ACME
// availability gate". Every other test below is real-assembler-dependent and
// skips locally with a named reason computed once by the shared
// availability-gate module.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKIP_REASON = acmeSkipReasonFor("hazard-subject-exported-edit.test.ts");

const FIXTURE_DIR = join(HERE, "fixtures", "hazard-subject");
const DRIVER = join(FIXTURE_DIR, "make-exported-edit.mjs");
const MANIFEST_PATH = join(FIXTURE_DIR, "exported-edit.manifest.json");
const STORE_PATH = join(FIXTURE_DIR, "hazard-subject.annostore.json");
const IMAGE_PATH = join(FIXTURE_DIR, "hazard-subject.prg");
const COMMITTED_PRG_PATH = join(FIXTURE_DIR, "hazard-subject-exported-edit.prg");

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

let workDir: string | undefined;
let dirCounter = 0;
function freshDir(tag: string): string {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "hazard-subject-exported-edit-"));
  const dir = join(workDir, `${tag}-${dirCounter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

test.after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

interface DriverRun {
  status: number | null;
  stdout: string;
  stderr: string;
  outPrgPath: string;
  recordPath: string;
}

/** Runs the real driver as a subprocess against `manifestPath`, writing its
 * `.prg` and record into a scratch directory that is never the committed
 * fixture path -- a refusal case must never be able to clobber the real
 * committed fixture, however it fails. */
function runDriver(dir: string, manifestPath: string, extraArgs: string[] = []): DriverRun {
  const outPrgPath = join(dir, "out.prg");
  const recordPath = join(dir, "record.json");
  const r = spawnSync(
    process.execPath,
    [DRIVER, "--manifest", manifestPath, "--store", STORE_PATH, "--image", IMAGE_PATH, "--out", outPrgPath, "--record", recordPath, ...extraArgs],
    { encoding: "utf8", timeout: 60_000 },
  );
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", outPrgPath, recordPath };
}

function loadManifest(): any {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function writeManifest(dir: string, manifest: unknown): string {
  const path = join(dir, "manifest.json");
  writeFileSync(path, JSON.stringify(manifest, null, 2));
  return path;
}

// ---------------------------------------------------------------------------
// The committed case: re-derived, never trusted.
// ---------------------------------------------------------------------------

test("the committed .prg is exactly what the committed manifest plus the committed store produce, re-derived", { skip: SKIP_REASON }, () => {
  const dir = freshDir("committed-case");
  const run = runDriver(dir, MANIFEST_PATH);
  assert.equal(run.status, 0, `expected the driver to succeed against the committed manifest, got status ${run.status}: ${run.stderr}`);

  const produced = readFileSync(run.outPrgPath);
  const committed = readFileSync(COMMITTED_PRG_PATH);
  assert.deepEqual(produced, committed, "the freshly-derived .prg must be byte-identical to the committed hazard-subject-exported-edit.prg");

  const record = JSON.parse(readFileSync(run.recordPath, "utf8"));
  assert.equal(record.verdict.outcome, "ok", `expected the assembler verdict to be "ok", got ${JSON.stringify(record.verdict)}`);
  assert.equal(record.verdict.byte_diff?.equal, true, "expected the byte-diff oracle to report equality against the pre-registered bytes");
});

// ---------------------------------------------------------------------------
// The refusal cases. Each is built in its own scratch directory and each
// assertion binds on the refusal's own message naming the offending file or
// offset -- never merely on a non-zero status.
// ---------------------------------------------------------------------------

test("refusal: a perturbed expected_byte_changes row is caught by the byte-diff oracle, not silently accepted", { skip: SKIP_REASON }, () => {
  const dir = freshDir("perturbed-byte-change");
  const manifest = loadManifest();
  // Perturb the FIRST row's `to` value -- the manifest's own prediction is
  // now wrong, but the "from" value (checked against the committed image
  // before any patch is applied) still matches, so this must be caught by
  // the real assembler's own byte-diff, not by the pre-check.
  manifest.expected_byte_changes[0].to = (manifest.expected_byte_changes[0].to + 1) & 0xff;
  const manifestPath = writeManifest(dir, manifest);

  const run = runDriver(dir, manifestPath);
  assert.notEqual(run.status, 0, "expected the driver to refuse (non-zero exit) on a perturbed expected_byte_changes row");
  assert.match(
    run.stderr,
    /differ from the expected bytes|first differing byte offset/,
    `expected a byte-diff-oracle refusal naming a first differing offset, got: ${run.stderr}`,
  );
});

test("refusal: an edit's find block that does not occur is refused before any assembler call", { skip: SKIP_REASON }, () => {
  const dir = freshDir("find-not-found");
  const manifest = loadManifest();
  manifest.source_edits[0].find = ["        this line does not occur anywhere in scope_087a.a"];
  const manifestPath = writeManifest(dir, manifest);

  const run = runDriver(dir, manifestPath);
  assert.notEqual(run.status, 0, "expected the driver to refuse when a find block does not occur");
  assert.match(run.stderr, /does not occur in "scope_087a\.a"/, `expected the refusal to name the offending file, got: ${run.stderr}`);
});

test("refusal: an edit's find block that occurs more than once is refused as ambiguous", { skip: SKIP_REASON }, () => {
  const dir = freshDir("find-ambiguous");
  const manifest = loadManifest();
  // "        nop" alone occurs hundreds of times in scope_087a.a's own
  // padding region -- an ambiguous find by construction.
  manifest.source_edits[0].find = ["        nop"];
  manifest.source_edits[0].replace = ["        nop"];
  const manifestPath = writeManifest(dir, manifest);

  const run = runDriver(dir, manifestPath);
  assert.notEqual(run.status, 0, "expected the driver to refuse an ambiguous find block");
  assert.match(run.stderr, /occurs \d+ times in "scope_087a\.a"/, `expected the refusal to name the offending file and the occurrence count, got: ${run.stderr}`);
});

test("refusal: an edit target not in the export's own files list is refused before any assembler call", { skip: SKIP_REASON }, () => {
  const dir = freshDir("target-not-in-files");
  const manifest = loadManifest();
  manifest.source_edits[0].file = "scope_no_such_file.a";
  const manifestPath = writeManifest(dir, manifest);

  const run = runDriver(dir, manifestPath);
  assert.notEqual(run.status, 0, "expected the driver to refuse a target that is not a member of the export's files list");
  assert.match(
    run.stderr,
    /"scope_no_such_file\.a", which is NOT a member of this export's own files list/,
    `expected the refusal to name the offending file, got: ${run.stderr}`,
  );
});

test("refusal: a second file mutated behind the driver's back is refused", { skip: SKIP_REASON }, () => {
  const dir = freshDir("second-file-mutated");
  // The committed manifest is unmodified for this case -- only the
  // test-only `--test-corrupt-file` seam introduces the out-of-band
  // mutation `make-exported-edit.mjs`'s own header documents.
  const run = runDriver(dir, MANIFEST_PATH, ["--test-corrupt-file", "symbols.a"]);
  assert.notEqual(run.status, 0, "expected the driver to refuse when a non-target file drifted from the pristine export");
  assert.match(
    run.stderr,
    /file "symbols\.a" differs from the pristine export but is NOT a declared source_edits target/,
    `expected the refusal to name the mutated file, got: ${run.stderr}`,
  );
});
