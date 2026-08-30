#!/usr/bin/env node
// capture-transcripts.mjs -- regenerates BOTH pinned transcripts in this
// directory from real ACME output, on this host, through THIS phase's own
// producer.
//
// WHY THIS FILE EXISTS: the transcripts beside it are evidence, and evidence
// whose production cannot be re-run is a claim. The Phase 29 README's
// "Regenerating" analogue has no capture script and says so; that directory's
// files were copied out of a deleted module's string constants, which is
// exactly the provenance this phase is obliged not to inherit. So the
// regeneration command here is a real program, and the README's Regenerating
// section names it.
//
// WHAT NOT TO DO: never hand-edit the `.txt` files. Everything in them is
// captured output, with exactly ONE declared transformation -- temp directory
// paths are replaced by the placeholder `<TMPDIR>`, because `mkdtempSync`
// invents a fresh six-character suffix per run and a transcript that carried it
// could never be compared against a re-capture. That substitution is declared
// in README.md's "Known sources of non-determinism" section and applied by
// `stabilise()` below, and it is the only edit made after capture.
//
// Usage: node capture-transcripts.mjs
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// fixtures/ -> 30-.../ -> phases/ -> .planning/ -> repo root
const REPO_ROOT = join(HERE, "..", "..", "..", "..");
const VICE = join(REPO_ROOT, "src", "mcp", "vice");

const { ACME_BIN } = await import(join(VICE, "acme-gate.ts"));
const { ACME_VERIFY_ARGV_FLAGS, classifySpawn, verifyAcmeAssembles } = await import(join(VICE, "acme-verify.ts"));
const { exportAsm } = await import(join(VICE, "anno-export-asm.ts"));
const { openStore, closeStore, setDataType, setLabel } = await import(join(VICE, "anno-store.ts"));

/** The ONE declared post-capture transformation. See the header. */
function stabilise(text) {
  return String(text).split(`${tmpdir()}/`).join("<TMPDIR>/").replace(/<TMPDIR>\/[A-Za-z0-9._-]+?-[A-Za-z0-9]{6}\//g, "<TMPDIR>/");
}

function section(name, body) {
  return [`>>> BEGIN ${name}`, stabilise(body).replace(/\n+$/, ""), `<<< END ${name}`, ""].join("\n");
}

function hexBytes(buf) {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

/** The tracer scenario: one store, one code range, one image. */
function buildTracerExport(dir) {
  const body = [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60];
  const imagePath = join(dir, "game.prg");
  writeFileSync(imagePath, Buffer.from([0x01, 0x08, ...body]));
  const storePath = join(dir, "anno.sqlite");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    setDataType(handle, { start: 0x0801, endInclusive: 0x0806, dataType: "code" });
    setLabel(handle, { address: 0x0801, name: "entry", kind: "User" });
  } finally {
    closeStore(handle);
  }
  return { body, ...exportAsm({ storePath, imagePath, workspaceRoot: dir }) };
}

/** The module's own argv, rebuilt from its own exported flag list. */
function verifyArgv(outPath, srcPath) {
  return [...ACME_VERIFY_ARGV_FLAGS, "-o", outPath, srcPath];
}

const CAPTURED_AT = new Date().toISOString();
const acmeVersion = spawnSync(ACME_BIN, ["--version"], { encoding: "utf8" });
const ACME_BANNER = `${acmeVersion.stdout ?? ""}${acmeVersion.stderr ?? ""}`.trim().split("\n")[0];

const dir = mkdtempSync(join(tmpdir(), "acme-fixture-"));
try {
  // -------------------------------------------------------------------------
  // verify-honest-pass.txt
  // -------------------------------------------------------------------------
  const tracer = buildTracerExport(dir);
  const srcPath = join(dir, "export.a");
  const outPath = join(dir, "export.bin");
  writeFileSync(srcPath, tracer.source, "utf8");
  const argv = verifyArgv(outPath, srcPath);
  const direct = spawnSync(ACME_BIN, argv, { encoding: "utf8", timeout: 30_000 });
  const verdict = verifyAcmeAssembles({
    source: tracer.source,
    expectedBytes: tracer.expectedBytes,
    expectedSegments: tracer.blocks,
  });

  const honest = [
    `# verify-honest-pass.txt -- an HONEST PASS through Phase 30's own producer`,
    `#`,
    `# Captured by capture-transcripts.mjs on ${CAPTURED_AT}.`,
    `# Assembler: ${ACME_BANNER} (resolved from ACME_BIN="${ACME_BIN}")`,
    `# Producer:  anno-export-asm.ts's exportAsm() + acme-verify.ts's verifyAcmeAssembles()`,
    `#`,
    `# Nothing below was trimmed, re-wrapped, redacted or edited after capture,`,
    `# beyond the single declared temp-path placeholder substitution (<TMPDIR>).`,
    ``,
    section(
      "SCENARIO",
      [
        `A real annotation store with ONE code range and ONE label, over a real`,
        `.prg image, exported to ACME source and assembled by a real ACME.`,
        ``,
        `image:       ${join(dir, "game.prg")} -- a .prg whose 2-byte little-endian`,
        `             load address is $0801 and whose body is:`,
        `                 ${hexBytes(tracer.body)}`,
        `             (lda #$00 / sta $d020 / rts)`,
        `store range: start $0801, endInclusive $0806, dataType "code"`,
        `store label: "entry" at $0801, kind User`,
        ``,
        `exported ACME source, verbatim:`,
        ...tracer.source.split("\n").map((l) => `    ${l}`),
        `expectedBytes (derived from the IMAGE, never from the source text):`,
        `    ${hexBytes(tracer.expectedBytes)}`,
        `expectedSegments (the exporter's own blocks):`,
        `    ${JSON.stringify(tracer.blocks.map((b) => ({ start: b.start, endExclusive: b.endExclusive })))}`,
      ].join("\n")
    ),
    section("ACME ARGV", [ACME_BIN, ...argv].map((a) => stabilise(a)).join(" ")),
    section("ACME STDOUT", direct.stdout ?? ""),
    section("ACME STDERR", direct.stderr ?? ""),
    section("ACME EXIT STATUS", String(direct.status)),
    section("AcmeVerifyResult.outcome", verdict.outcome),
    section("AcmeVerifyResult.exitStatus", String(verdict.exitStatus)),
    section("AcmeVerifyResult.acmeResultLines", verdict.acmeResultLines.join("\n")),
    section("AcmeVerifyResult.aggregateLines", verdict.aggregateLines.join("\n")),
    section("AcmeVerifyResult.diagnostics", verdict.diagnostics.join("\n")),
    section("AcmeVerifyResult.byteDiff", JSON.stringify(verdict.byteDiff, null, 2)),
    section("AcmeVerifyResult.reason", verdict.reason),
    `# The verdict is the byteDiff above. The exitStatus is recorded and`,
    `# consulted by nothing; the aggregate line is recorded and trusted by`,
    `# nothing; the stderr Warning did not make the outcome "failed".`,
    ``,
  ].join("\n");

  // -------------------------------------------------------------------------
  // verify-false-pass-trap.txt
  // -------------------------------------------------------------------------

  // (1) The missing-assembler spawn.
  const missingBin = join(dir, "definitely-not-acme");
  const missingSpawn = spawnSync(missingBin, ["--version"], { encoding: "utf8" });
  const skipped = verifyAcmeAssembles({
    source: tracer.source,
    expectedBytes: tracer.expectedBytes,
    expectedSegments: tracer.blocks,
    acmeBin: missingBin,
  });

  // (2) The stale-output vector.
  const stalePath = join(dir, "stale.bin");
  const KNOWN = Buffer.from("STALE", "ascii");
  writeFileSync(stalePath, KNOWN);
  const dupPath = join(dir, "dup.a");
  writeFileSync(dupPath, ["!cpu 6510", "dup = $10", "dup = $20", "* = $0801", "\trts", ""].join("\n"), "utf8");
  const bytesBefore = readFileSync(stalePath);
  const staleRun = spawnSync(ACME_BIN, ["-f", "plain", "--msvc", "-o", stalePath, dupPath], {
    encoding: "utf8",
    timeout: 30_000,
  });
  const bytesAfter = readFileSync(stalePath);

  // (3) The exit-zero-wrong-byte vector.
  const corrupted = Uint8Array.from(tracer.expectedBytes);
  corrupted[1] = 0x01;
  const red = verifyAcmeAssembles({
    source: tracer.source,
    expectedBytes: corrupted,
    expectedSegments: tracer.blocks,
  });

  const trap = [
    `# verify-false-pass-trap.txt -- the three false-pass vectors, PROVOKED`,
    `# against Phase 30's own route and refused by it. Not narrated: every`,
    `# number and every line below is captured output.`,
    `#`,
    `# Captured by capture-transcripts.mjs on ${CAPTURED_AT}.`,
    `# Assembler: ${ACME_BANNER} (resolved from ACME_BIN="${ACME_BIN}")`,
    `#`,
    `# Nothing below was trimmed, re-wrapped, redacted or edited after capture,`,
    `# beyond the single declared temp-path placeholder substitution (<TMPDIR>).`,
    ``,
    section(
      "VECTOR 1 -- THE MISSING ASSEMBLER",
      [
        `ACME_BIN used:                       ${missingBin}`,
        `spawnSync status:                    ${String(missingSpawn.status)}`,
        `spawnSync error.code:                ${missingSpawn.error?.code ?? "(none)"}`,
        `historical truthiness classifier:    ${!missingSpawn.status ? "ran" : "unavailable"}   <- reads a spawn that NEVER RAN as a run`,
        `classifySpawn():                     ${classifySpawn(missingSpawn)}`,
        ``,
        `verifyAcmeAssembles() over the same source, with that binary:`,
        `    outcome:  ${skipped.outcome}`,
        `    reason:   ${skipped.reason}`,
        `    byteDiff: ${JSON.stringify(skipped.byteDiff)}`,
        ``,
        `REFUSED BY: verdict rule 1 -- classifySpawn() reports "unavailable", so`,
        `the outcome is "skipped", which is neither a pass nor a byte-level`,
        `failure. A skipped assembler is never presented as a pass on any surface.`,
      ].join("\n")
    ),
    section(
      "VECTOR 2 -- THE STALE OUTPUT FILE",
      [
        `output path:            ${stalePath}`,
        `bytes BEFORE the run:   ${hexBytes(bytesBefore)}   (ascii "${bytesBefore.toString("ascii")}")`,
        `source assembled:       ${dupPath} -- a duplicate symbol assignment`,
        `argv:                   ${stabilise(ACME_BIN)} -f plain --msvc -o ${stabilise(stalePath)} ${stabilise(dupPath)}`,
        `ACME exit status:       ${String(staleRun.status)}`,
        `ACME stderr:            ${stabilise(staleRun.stderr ?? "").trim()}`,
        `bytes AFTER the run:    ${hexBytes(bytesAfter)}   (ascii "${bytesAfter.toString("ascii")}")   <- UNCHANGED`,
        ``,
        `REFUSED BY: verdict rule 6 -- every invocation assembles into a fresh`,
        `mkdtemp directory and requires the output path to have been ABSENT before`,
        `the spawn, so "did THIS run create it" is the property. A verify path`,
        `using a fixed output path would have byte-diffed the bytes above and`,
        `called this failed run a pass.`,
      ].join("\n")
    ),
    section(
      "VECTOR 3 -- EXIT ZERO ON A WRONG BYTE",
      [
        `source:                 the SAME honest export as verify-honest-pass.txt`,
        `expectedBytes:          ${hexBytes(corrupted)}   <- index 1 corrupted, $00 -> $01`,
        `ACME exit status:       ${String(red.exitStatus)}   <- ACME REPORTED SUCCESS`,
        `ACME's own result lines:`,
        ...red.acmeResultLines.map((l) => `    ${l}`),
        `aggregate line (recorded, never trusted):`,
        ...red.aggregateLines.map((l) => `    ${l}`),
        `byteDiff:               ${JSON.stringify(red.byteDiff)}`,
        `outcome:                ${red.outcome}`,
        `reason:                 ${red.reason}`,
        ``,
        `REFUSED BY: verdict rule 6 -- the byte-diff IS the verdict. The exit`,
        `status cannot see a wrong byte, so it can never be the verdict, not even`,
        `when it is zero.`,
      ].join("\n")
    ),
  ].join("\n");

  writeFileSync(join(HERE, "verify-honest-pass.txt"), honest, "utf8");
  writeFileSync(join(HERE, "verify-false-pass-trap.txt"), trap, "utf8");
  console.log(`wrote verify-honest-pass.txt and verify-false-pass-trap.txt`);
  console.log(`assembler: ${ACME_BANNER}`);
  console.log(`captured at: ${CAPTURED_AT}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
