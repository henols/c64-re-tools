#!/usr/bin/env node
// hazard-subject-reassembly.test.ts -- runs the purpose-built hazard subject
// through the multi-file export and reassembly path a real assembler proves,
// on a program that path has never seen before.
//
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// A store's export can claim to reassemble; the only thing that settles the
// claim is a real assembler and a byte comparison. Every existing fixture the
// multi-file export path has been proven against was built for that path.
// This subject was not -- it was built to carry four movement-blocking
// constructions for an unrelated detector, and the export path has never seen
// it. This file is where that gap closes: the subject's own committed store
// export goes through the same tree writer, the same working-directory fix,
// and the same byte-diff oracle every other fixture already does, and nothing
// here re-derives any of that logic to check it.
//
// GATE
// ---------------------------------------------------------------------------
// Exactly one test always runs and is never skipped: "ACME availability
// gate". With the assembler requirement variable set (this project's CI Test
// step sets it), a missing assembler FAILS that test. Locally, with no real
// assembler on PATH, every other assembler-dependent test below skips with a
// named reason computed once by the shared availability-gate module -- never
// a hand-rolled probe.
//
// WHAT THIS FILE DOES NOT DO
// ---------------------------------------------------------------------------
// It does not modify the exporter or the host-tool seam, and it reaches the
// real assembler through exactly the same two routes the existing export
// test file already uses: the single-file oracle for the negative control,
// and the host-tool seam (with its working directory set to the tree) for
// every positive case. A third process-launch site here would be a defect,
// not a convenience.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "./build.ts";
import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { verifyAcmeAssembles } from "./acme-verify.ts";
import { exportAsmTree, ROOT_FILE_NAME, SYMBOLS_FILE_NAME, scopeFileName, type ExportAsmTreeResult } from "./anno-export-asm.ts";
import { openStore, closeStore } from "./anno-store.ts";
import { importStoreDocument, type StoreExportDocument } from "./anno-store-export.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, "fixtures", "hazard-subject");
const PRG_PATH = join(FIXTURE_DIR, "hazard-subject.prg");
const ANNOSTORE_PATH = join(FIXTURE_DIR, "hazard-subject.annostore.json");

const SKIP_REASON = acmeSkipReasonFor("hazard-subject-reassembly.test.ts");

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

// ---------------------------------------------------------------------------
// One temp directory for the whole file, removed in `after()`.
// ---------------------------------------------------------------------------

let workDir: string | undefined;
let dirCounter = 0;

function freshDir(tag: string): string {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "hazard-subject-reassembly-"));
  const dir = join(workDir, `${tag}-${dirCounter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

function loadCommittedExport(): StoreExportDocument {
  return JSON.parse(readFileSync(ANNOSTORE_PATH, "utf8")) as StoreExportDocument;
}

/** Writes the committed store export into a fresh, throwaway store file --
 * through `importStoreDocument()`, the store's own public import verb, never
 * raw SQL -- and returns the store's own path so a caller can hand it to
 * `exportAsmTree()`, which opens its own handle by path. */
function freshStoreFromCommittedExport(dir: string): string {
  const storePath = join(dir, "hazard-subject.annostore");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    importStoreDocument(handle, loadCommittedExport());
  } finally {
    closeStore(handle);
  }
  return storePath;
}

/** Exports the committed subject's store into a fresh tree under a fresh
 * subdirectory, through the same `exportAsmTree()` every other fixture's
 * tree export already goes through. The store and the tree share one
 * workspace root -- `exportAsmTree()` opens its own store handle by path and
 * confines it against that same root, so both must agree on it. */
function exportSubjectTree(tag: string): { dir: string; outDir: string; result: ExportAsmTreeResult } {
  const dir = freshDir(tag);
  const storePath = freshStoreFromCommittedExport(dir);
  const outDir = join(dir, "tree");
  const result = exportAsmTree({ storePath, imagePath: PRG_PATH, workspaceRoot: dir, outDir });
  return { dir, outDir, result };
}

async function importHostTool(): Promise<{
  runHostTool: (
    raw: unknown,
    deps: { repoRoot: string; log?: (line: string) => void; timeoutMs?: number },
  ) => Promise<
    | { ok: true; tool: string; exitStatus: number | null; results: Array<{ path: string; sha256: string; byteLength: number }>; stderrTail: string }
    | { ok: false; message: string }
  >;
}> {
  build();
  const hostToolModule = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as ReturnType<typeof importHostTool> extends Promise<infer T> ? T : never;
  return hostToolModule;
}

// ---------------------------------------------------------------------------
// hazard reassembly: the five export properties, asserted on this subject
// ---------------------------------------------------------------------------

test("hazard reassembly: the exported tree contains a root file, a symbols file, at least four scope files and exactly four binary data files", () => {
  const { outDir, result } = exportSubjectTree("tree-file-set");
  const onDisk = readdirSync(outDir).sort();
  assert.deepEqual(onDisk, [...result.files].sort(), "result.files must agree with what is actually on disk");
  assert.ok(onDisk.includes(ROOT_FILE_NAME), "the tree must contain a root file");
  assert.ok(onDisk.includes(SYMBOLS_FILE_NAME), "the tree must contain a symbols file");

  const scopeFiles = onDisk.filter((name) => name.startsWith("scope_"));
  assert.ok(scopeFiles.length >= 4, `expected at least four scope files, found ${scopeFiles.length}: ${scopeFiles.join(", ")}`);

  const binaryFiles = onDisk.filter((name) => name.endsWith(".bin"));
  assert.equal(binaryFiles.length, 4, `expected exactly four binary data files, found ${binaryFiles.length}: ${binaryFiles.join(", ")}`);
  assert.equal(result.binaries.length, 4, "result.binaries must report the same four external-file blocks");
});

test("hazard reassembly: root.a's !source arguments are all bare filenames with no directory component, one per written sibling .a file", () => {
  const { outDir, result } = exportSubjectTree("tree-root-bare-filenames");
  const rootText = readFileSync(join(outDir, ROOT_FILE_NAME), "utf8");
  const sourceArgs = [...rootText.matchAll(/^!source "([^"]*)"$/gm)].map((m) => m[1]!);
  assert.ok(sourceArgs.length > 0, "root.a must carry at least one !source line");
  for (const arg of sourceArgs) {
    assert.ok(!arg.includes("/") && !arg.includes("\\"), `!source argument "${arg}" must be a bare filename -- no directory component, no host path`);
  }
  assert.deepEqual([...sourceArgs].sort(), [...result.sourceOrder].sort(), "root.a's !source arguments must be exactly result.sourceOrder");
  assert.equal(sourceArgs[0], SYMBOLS_FILE_NAME, "symbols.a must be sourced first");
});

test("hazard reassembly: every external-file range produces its own binary file referenced by exactly one bare-filename !binary line, with no !byte line for it", () => {
  const { outDir, result } = exportSubjectTree("tree-external-file-binaries");
  const allTreeText = readdirSync(outDir)
    .filter((name) => name.endsWith(".a"))
    .map((name) => readFileSync(join(outDir, name), "utf8"))
    .join("\n");

  assert.equal(result.binaries.length, 4, "the subject carries exactly four external-file data tables");
  for (const binary of result.binaries) {
    assert.ok(!binary.name.includes("/") && !binary.name.includes("\\"), `binary file name "${binary.name}" must be a bare filename`);
    assert.ok(existsSync(join(outDir, binary.name)), `${binary.name} must actually exist on disk beside the tree`);
    const onDiskBytes = readFileSync(join(outDir, binary.name));
    assert.equal(onDiskBytes.length, binary.bytes.length, `${binary.name} must hold exactly the block's own byte count`);
    assert.deepEqual([...onDiskBytes], [...binary.bytes], `${binary.name} must hold exactly the block's own bytes`);

    const binaryLineRe = new RegExp(`^\\s*!binary "${binary.name}"`, "gm");
    const matches = [...allTreeText.matchAll(binaryLineRe)];
    assert.equal(matches.length, 1, `exactly one !binary line must reference ${binary.name}, found ${matches.length}`);

    // The block this binary file corresponds to must emit no !byte line at
    // all -- its whole extent goes out through the one !binary line above,
    // never a second, inline copy of the same bytes.
    const owningBlock = result.blocks.find((b) => b.start === binary.start && b.endExclusive === binary.endExclusive && b.dataType === "external_file");
    assert.ok(owningBlock, `an external_file block matching ${binary.name}'s own extent must exist in result.blocks`);
    const byteLines = owningBlock!.lines.filter((line) => /^\s*!byte\b/.test(line));
    assert.deepEqual(byteLines, [], `the block emitting ${binary.name} must carry no !byte line:\n${owningBlock!.lines.join("\n")}`);
  }
});

test("hazard reassembly: every reference to the dispatch and decline tables resolves through their own symbol name, across the file boundary between the consuming code and the tables it reads, and a hardware register write still renders as a literal address", () => {
  const { outDir } = exportSubjectTree("tree-cross-file-symbols");
  const allTreeText = readdirSync(outDir)
    .filter((name) => name.endsWith(".a"))
    .map((name) => readFileSync(join(outDir, name), "utf8"))
    .join("\n");

  // The consuming code (`hazard_dispatch_entry`, `dispatch_decline_entry`)
  // reads these four tables by name, never by raw hex address.
  for (const symbol of ["dispatch_hi", "dispatch_lo", "decline_hi", "decline_lo"]) {
    assert.ok(new RegExp(`\\b${symbol}\\b`).test(allTreeText), `the emitted tree must reference "${symbol}" by name`);
  }
  // The load that consumes each table must read it BY NAME, never by the
  // raw address the store already knows for it.
  assert.match(allTreeText, /lda\s+dispatch_hi\s*,\s*[xy]/i, "the dispatch table's high-byte load must read dispatch_hi by name");
  assert.match(allTreeText, /lda\s+dispatch_lo\s*,\s*[xy]/i, "the dispatch table's low-byte load must read dispatch_lo by name");

  // A store to a fixed hardware register outside every emitted range (the
  // border-colour register the subject's routines write on every pass) has
  // no symbol to resolve to and must still render as a literal address, not
  // a refusal and not an omission.
  assert.ok(/\$d020/i.test(allTreeText), "a hardware register write outside the image must still render as a literal address");
});

test("hazard reassembly: the dispatch and decline tables keep four distinct, table-specific symbol names rather than losing their pairing to a merged or unrelated name", () => {
  const { outDir, result } = exportSubjectTree("tree-distinct-table-symbols");
  const scopeText = result.scopes
    .map((scope) => scopeFileName(scope.start))
    .filter((name) => existsSync(join(outDir, name)))
    .map((name) => readFileSync(join(outDir, name), "utf8"))
    .join("\n");
  const allTreeText = `${scopeText}\n${readFileSync(join(outDir, SYMBOLS_FILE_NAME), "utf8")}`;

  const definitionLineFor = (name: string): RegExp => new RegExp(`^${name}\\b`, "m");
  for (const name of ["dispatch_hi", "dispatch_lo", "decline_hi", "decline_lo"]) {
    assert.match(allTreeText, definitionLineFor(name), `"${name}" must appear as its own label definition somewhere in the tree`);
  }
  // The four names are pairwise distinct strings -- the pairing survives
  // through naming, not through an accidental collision.
  const names = ["dispatch_hi", "dispatch_lo", "decline_hi", "decline_lo"];
  assert.equal(new Set(names).size, 4, "the four table names must be pairwise distinct");
});

test("hazard reassembly: two exports from the unchanged store produce byte-identical file sets", () => {
  const a = exportSubjectTree("tree-determinism-files-a");
  const b = exportSubjectTree("tree-determinism-files-b");
  assert.deepEqual([...a.result.files].sort(), [...b.result.files].sort(), "two exports of the same unchanged store must write the exact same file names");
});

test("hazard reassembly: two exports from the unchanged store produce byte-identical file contents", () => {
  const a = exportSubjectTree("tree-determinism-bytes-a");
  const b = exportSubjectTree("tree-determinism-bytes-b");
  for (const name of a.result.files) {
    const bytesA = readFileSync(join(a.outDir, name));
    const bytesB = readFileSync(join(b.outDir, name));
    assert.deepEqual([...bytesA], [...bytesB], `${name} must be byte-identical across two exports of the same unchanged store`);
  }
});

// ---------------------------------------------------------------------------
// hazard reassembly: the negative control and the real reassembly
// ---------------------------------------------------------------------------

test(
  "hazard reassembly: assembling the same root file with a directory that is not the tree as the working directory fails, and the assembler's own refusal text is captured",
  { skip: SKIP_REASON },
  () => {
    const { outDir, result } = exportSubjectTree("cwd-control-negative");
    const rootText = readFileSync(join(outDir, ROOT_FILE_NAME), "utf8");
    assert.match(rootText, /^!source "/m, "the root text must carry at least one !source line before this control means anything");

    const verdict = verifyAcmeAssembles({ source: rootText, expectedBytes: result.expectedBytes, expectedSegments: result.blocks });
    assert.equal(verdict.outcome, "failed", `expected the assembler to fail with no sibling files present, got outcome "${verdict.outcome}"`);
    assert.ok(
      verdict.diagnostics.some((line) => line.includes("Cannot open input file")),
      `diagnostics must carry the assembler's own could-not-open-file refusal text, got: ${verdict.diagnostics.join(" | ") || "(none)"}`,
    );
  },
);

test(
  "hazard reassembly: the tree assembles through the host-tool seam with its own directory as the working directory, reaches exit status zero, and produces bytes octet-identical to the export's own expected bytes",
  { skip: SKIP_REASON },
  async () => {
    const { outDir, result } = exportSubjectTree("cwd-control-positive");
    const { runHostTool } = await importHostTool();
    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0, "real ACME must exit 0 when its working directory is the tree's own directory");
    assert.equal(response.results.length, 1);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    assert.deepEqual(producedBytes, result.expectedBytes, "the produced .prg bytes must be octet-identical to bytes taken from the image");
  },
);

test(
  "hazard reassembly: the reassembled image is octet-identical to the committed subject image, proving the self-modified bytes survived the round trip",
  { skip: SKIP_REASON },
  async () => {
    const { outDir } = exportSubjectTree("octet-identity");
    const { runHostTool } = await importHostTool();
    const response = await runHostTool({ tool: "acme.build", args: { source: ROOT_FILE_NAME, format: "plain", noReport: true } }, { repoRoot: outDir });
    assert.equal(response.ok, true, response.ok ? "" : response.message);
    if (!response.ok) return;
    assert.equal(response.exitStatus, 0);
    const producedBytes = new Uint8Array(readFileSync(response.results[0]!.path));
    const committedBody = new Uint8Array(readFileSync(PRG_PATH)).subarray(2); // drop the 2-byte load address header
    assert.deepEqual(
      producedBytes,
      committedBody,
      "the reassembled image's body must be octet-identical to the committed subject image's own body -- the self-modification's " +
        "planted bytes, the mid-instruction labels and every data table must survive the export-then-reassemble round trip unchanged",
    );
  },
);
