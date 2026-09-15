#!/usr/bin/env node
// make-rebuild.mjs -- Phase 50 plan 50-06 Task 1: produce the REBUILD of the
// committed hazard subject from its own committed annotation store.
//
// WHY THIS FILE EXISTS
// --------------------
// Plan 50-06 Task 2 compares the original against a rebuild in a running
// emulator. A rebuild is only evidence for anything if it was actually
// produced by the export-and-assemble path -- copying `hazard-subject.prg`
// under a new name and calling it a rebuild would make the whole green
// comparison meaningless. So this file walks the real path, end to end, and
// nothing in it re-derives a step:
//
//   importStoreDocument()      -- the store's own public import verb
//   exportAsmTree()            -- the same tree exporter every fixture uses
//   verifyAcmeAssemblesTree()  -- acme-verify.ts's ONE real-assembler entry
//                                 point, which is also the byte-diff oracle
//
// NO SECOND ASSEMBLER CALL SITE AND NO SECOND BYTE COMPARISON. This file
// contains no spawn/exec/spawnSync of its own: grep it. The only process
// that runs an assembler on its behalf is the one `acme-verify.ts` starts,
// and `acme-verify.test.ts` pins that that module still holds exactly one
// real assembler launch. The only expected-versus-actual byte comparison is
// the one that same module performs against `exportAsmTree()`'s own
// `expectedBytes`, which are built FROM THE IMAGE, never from the exported
// text.
//
// THE TWO-BYTE HEADER, STATED RATHER THAN SLIPPED IN. `acme-verify.ts`'s
// oracle assembles with `-f plain`, which emits the raw body with no load
// address, because that is the form `expectedBytes` is built to match. A
// `.prg` the emulator's `load` verb can read needs the 2-byte little-endian
// load address in front of that body. Those two bytes are therefore written
// here, derived from the EXPORT's own lowest block start and cross-checked
// against the assembler's own `-v2` per-segment result line. They are not
// copied from the committed image, and the derivation is recorded in the
// emitted JSON record so a reader can check it rather than take it on
// trust.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
const VICE_DIR = join(REPO_ROOT, "src", "mcp", "vice");
const FIXTURE_DIR = join(VICE_DIR, "fixtures", "hazard-subject");

const { openStore, closeStore } = await import(join(VICE_DIR, "anno-store.ts"));
const { importStoreDocument } = await import(join(VICE_DIR, "anno-store-export.ts"));
const { exportAsmTree, ROOT_FILE_NAME } = await import(join(VICE_DIR, "anno-export-asm.ts"));
const { verifyAcmeAssemblesTree, VERIFY_OUTPUT_FILE_NAME } = await import(join(VICE_DIR, "acme-verify.ts"));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const STORE_DOC = arg("store", join(FIXTURE_DIR, "hazard-subject.annostore.json"));
const IMAGE = arg("image", join(FIXTURE_DIR, "hazard-subject.prg"));
const TREE_DIR = arg("tree-dir", join(mkdtempSync(join(tmpdir(), "phase50-rebuild-")), "tree"));
const OUT_PRG = arg("out", join(HERE, "hazard-subject-rebuild.prg"));
const RECORD = arg("record", join(HERE, "rebuild-run.json"));

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const hex4 = (n) => "$" + n.toString(16).toUpperCase().padStart(4, "0");

/**
 * THE THIRD COPY of `blocksInTreeSourceOrder()`, and the reason it is a copy
 * rather than an import is recorded here rather than left for a reader to
 * wonder about. `acme-verify.test.ts` and `reassembly-gate-modified-run.test.ts`
 * each already carry their own copy, with the first one's doc comment stating
 * the accepted-duplication rule: neither file ships. Neither does this one --
 * it is a phase-evidence driver under `.planning/`, and importing a `*.test.ts`
 * module to borrow a helper would RUN that module's whole suite as a side
 * effect of producing a rebuild.
 *
 * What it does, from `acme-verify.test.ts`'s own statement of it:
 * `result.blocks` is ascending by START, but `exportAsmTree()` sources
 * `symbols.a` first, then each populated scope ascending by scope start, then
 * `unscoped.a` LAST regardless of address. This subject's lowest block
 * ($0801) is unscoped, so its file is included last while its address is
 * lowest. ACME's own per-segment result lines follow FILE INCLUSION order,
 * never address order, so `firstResultLineDisagreement()`'s unanimity rule
 * needs `expectedSegments` in that same order. MEASURED here on the first
 * run of this script: passing `exported.blocks` unreordered produced
 * `ACME's own per-segment result line 0 disagrees with the exporter's block
 * 0: expected $0801..$080D (exclusive), ACME reported $0825..$0833`.
 */
function blocksInTreeSourceOrder(result) {
  const sortedScopes = [...result.scopes].sort((a, b) => a.start - b.start);
  const byScopeStart = new Map();
  const unscoped = [];
  for (const block of result.blocks) {
    const blockEndInclusive = block.endExclusive - 1;
    const owningScope = sortedScopes.find((scope) => scope.start <= block.start && blockEndInclusive <= scope.endInclusive);
    if (owningScope === undefined) {
      unscoped.push(block);
      continue;
    }
    const existing = byScopeStart.get(owningScope.start);
    if (existing) existing.push(block);
    else byScopeStart.set(owningScope.start, [block]);
  }
  const ordered = [];
  for (const scope of sortedScopes) {
    const blocksInScope = byScopeStart.get(scope.start);
    if (blocksInScope) ordered.push(...[...blocksInScope].sort((a, b) => a.start - b.start));
  }
  ordered.push(...[...unscoped].sort((a, b) => a.start - b.start));
  return ordered;
}

// 1. A fresh, throwaway store, filled from the COMMITTED store document
//    through the store's own public import verb.
const workRoot = dirname(TREE_DIR);
mkdirSync(workRoot, { recursive: true });
const storePath = join(workRoot, "hazard-subject.annostore");
const storeDocument = JSON.parse(readFileSync(STORE_DOC, "utf8"));
{
  const handle = openStore(storePath, { workspaceRoot: workRoot });
  try {
    importStoreDocument(handle, storeDocument);
  } finally {
    closeStore(handle);
  }
}

// 2. Export the tree against the committed image.
mkdirSync(TREE_DIR, { recursive: true });
const exported = exportAsmTree({ storePath, imagePath: IMAGE, workspaceRoot: workRoot, outDir: TREE_DIR });

// 3. Assemble it through the ONE sanctioned real-assembler entry point,
//    which is also the byte-diff oracle. Its own fresh output directory is
//    replaced by one this script owns, so the assembled file survives the
//    call and can be read below; the rule that the output file must have
//    been ABSENT before the spawn runs against it unchanged.
const outputDir = join(workRoot, "assembled");
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const verdict = verifyAcmeAssemblesTree({
  treeDir: TREE_DIR,
  rootFileName: ROOT_FILE_NAME,
  expectedBytes: exported.expectedBytes,
  expectedSegments: blocksInTreeSourceOrder(exported),
  outputDir,
});

if (verdict.outcome !== "ok") {
  console.error(`verifyAcmeAssemblesTree returned "${verdict.outcome}": ${verdict.reason}`);
  console.error(verdict.diagnostics.join("\n"));
  process.exit(1);
}

const body = readFileSync(join(outputDir, VERIFY_OUTPUT_FILE_NAME));

// 4. The two-byte little-endian load address, DERIVED from the export's own
//    lowest block start, and cross-checked against the assembler's own
//    per-segment result line before it is written.
const loadAddress = Math.min(...exported.blocks.map((b) => b.start));
// `String.prototype.match`, not `RegExp.prototype.exec`, deliberately: a
// grep census for a process launch in this file must come back EMPTY, and
// `.exec(` is a substring of that census's own pattern.
const segmentLineLows = verdict.acmeResultLines
  .map((line) => line.match(/\(0x([0-9a-f]+)\s*-\s*0x([0-9a-f]+)\s*exclusive\)/i))
  .filter(Boolean)
  .map((m) => parseInt(m[1], 16));
const assemblerLowest = segmentLineLows.length > 0 ? Math.min(...segmentLineLows) : null;
if (assemblerLowest !== loadAddress) {
  console.error(
    `load-address derivation disagrees: the export's lowest block start is ${hex4(loadAddress)} but ACME's own ` +
      `per-segment result lines report ${assemblerLowest === null ? "(none parsed)" : hex4(assemblerLowest)} -- refusing to guess`,
  );
  process.exit(1);
}

const prg = Buffer.concat([Buffer.from([loadAddress & 0xff, (loadAddress >> 8) & 0xff]), body]);
writeFileSync(OUT_PRG, prg);

const committed = readFileSync(IMAGE);
const record = {
  produced_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  store_document: STORE_DOC,
  store_document_sha256: sha256(readFileSync(STORE_DOC)),
  image_the_export_was_taken_against: IMAGE,
  export_entry_point: "exportAsmTree() (src/mcp/vice/anno-export-asm.ts)",
  import_entry_point: "importStoreDocument() (src/mcp/vice/anno-store-export.ts)",
  assemble_entry_point: "verifyAcmeAssemblesTree() (src/mcp/vice/acme-verify.ts)",
  tree_dir: TREE_DIR,
  root_file_name: ROOT_FILE_NAME,
  tree_files: [...exported.files].sort(),
  block_count: exported.blocks.length,
  verdict: {
    outcome: verdict.outcome,
    reason: verdict.reason,
    exit_status: verdict.exitStatus,
    acme_result_lines: verdict.acmeResultLines,
    aggregate_lines: verdict.aggregateLines,
    diagnostics: verdict.diagnostics,
    byte_diff: verdict.byteDiff,
  },
  load_address: loadAddress,
  load_address_hex: hex4(loadAddress),
  load_address_source: "min(exportAsmTree().blocks[].start), cross-checked against ACME's own -v2 per-segment result lines",
  body_bytes: body.length,
  body_sha256: sha256(body),
  rebuild_prg: OUT_PRG,
  rebuild_prg_bytes: prg.length,
  rebuild_prg_sha256: sha256(prg),
  committed_subject_prg: IMAGE,
  committed_subject_prg_bytes: committed.length,
  committed_subject_prg_sha256: sha256(committed),
  byte_identical_to_committed_subject: sha256(prg) === sha256(committed),
};
writeFileSync(RECORD, JSON.stringify(record, null, 2) + "\n");

console.log(JSON.stringify(record, null, 2));
