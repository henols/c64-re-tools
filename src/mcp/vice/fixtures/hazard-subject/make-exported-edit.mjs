#!/usr/bin/env node
// make-exported-edit.mjs -- Phase 50 plan 50-08 Task 1: produce the
// EXPORTED-EDIT subject -- the same two behaviour changes plan 50-02 made by
// hand in `hazard-subject-align-nosprite.a`, made this time in a file
// `exportAsmTree()` itself emitted.
//
// WHY THIS FILE EXISTS
// --------------------
// Plans 50-02 and 50-06 proved the assembler works and that a hand-written
// twin subject reassembles and behaves as expected. Neither made its edit in
// a file the decomposition's own exporter wrote. This driver does: it walks
// the same real export-and-assemble path `make-rebuild.mjs` (plan 50-06)
// already proved out, then applies a COMMITTED, PRE-REGISTERED edit to one
// exported file, reassembles the edited tree through the same single
// oracle, and refuses rather than guesses at every step where the edit
// could silently go wrong.
//
//   importStoreDocument()      -- the store's own public import verb
//   exportAsmTree()            -- the same tree exporter every fixture uses
//   verifyAcmeAssemblesTree()  -- acme-verify.ts's ONE real-assembler entry
//                                 point, which is also the byte-diff oracle
//
// NO SECOND ASSEMBLER CALL SITE AND NO SECOND BYTE COMPARISON. This file
// contains no spawn/exec/spawnSync of its own: grep it, exactly as
// `make-rebuild.mjs`'s own header states for itself.
//
// THE PRE-REGISTRATION IS THE ACCEPTANCE CONTRACT. `exported-edit.manifest.json`
// is committed BEFORE this driver ever calls the assembler against the
// edited tree. Its `expected_byte_changes` are checked against the PRISTINE
// export's own `expectedBytes` (built from the committed IMAGE) before being
// applied -- a perturbed `from` value is refused, never silently overwritten.
// The patched bytes are what the driver hands to the byte-diff oracle as
// `expectedBytes`; the oracle never sees the manifest, and the manifest never
// sees the assembler's output. Two independent things must agree for this to
// pass: the manifest's own prediction, and ACME's own assembled bytes.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..", "..");
const VICE_DIR = join(HERE, "..", "..");
const FIXTURE_DIR = HERE;

const { openStore, closeStore } = await import(join(VICE_DIR, "anno-store.ts"));
const { importStoreDocument } = await import(join(VICE_DIR, "anno-store-export.ts"));
const { exportAsmTree, ROOT_FILE_NAME } = await import(join(VICE_DIR, "anno-export-asm.ts"));
const { verifyAcmeAssemblesTree, VERIFY_OUTPUT_FILE_NAME } = await import(join(VICE_DIR, "acme-verify.ts"));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const MANIFEST_PATH = arg("manifest", join(FIXTURE_DIR, "exported-edit.manifest.json"));
const STORE_DOC = arg("store", join(FIXTURE_DIR, "hazard-subject.annostore.json"));
const IMAGE = arg("image", join(FIXTURE_DIR, "hazard-subject.prg"));
const OUT_PRG = arg("out", join(FIXTURE_DIR, "hazard-subject-exported-edit.prg"));
const RECORD = arg(
  "record",
  join(REPO_ROOT, ".planning", "phases", "50-equivalence-and-modifiability", "evidence", "exported-edit-run.json"),
);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const hex4 = (n) => "$" + n.toString(16).toUpperCase().padStart(4, "0");

function fail(message) {
  console.error(`make-exported-edit: ${message}`);
  process.exit(1);
}

/**
 * THE SAME COPY `make-rebuild.mjs` carries, for the SAME stated reason (its
 * own header): `exportAsmTree()` sources `symbols.a` first, then each
 * populated scope ascending by scope start, then `unscoped.a` LAST
 * regardless of address, while ACME's own `-v2` per-segment result lines
 * follow FILE INCLUSION order. A third copy, not an import: this is a phase
 * evidence/fixture driver, and importing a `*.test.ts` module to borrow the
 * helper would RUN that module's whole suite as a side effect.
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

function freshExport(workRoot, tag, storeDocument) {
  const dir = join(workRoot, tag);
  mkdirSync(dir, { recursive: true });
  const storePath = join(dir, "hazard-subject.annostore");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    importStoreDocument(handle, storeDocument);
  } finally {
    closeStore(handle);
  }
  const outDir = join(dir, "tree");
  return exportAsmTree({ storePath, imagePath: IMAGE, workspaceRoot: dir, outDir });
}

// -----------------------------------------------------------------------
// 0. Load the pre-registered manifest. Committed BEFORE this run.
// -----------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
if (!Array.isArray(manifest.source_edits) || manifest.source_edits.length === 0) {
  fail(`the manifest at "${MANIFEST_PATH}" carries no source_edits`);
}
if (!Array.isArray(manifest.expected_byte_changes) || manifest.expected_byte_changes.length === 0) {
  fail(`the manifest at "${MANIFEST_PATH}" carries no expected_byte_changes`);
}

// -----------------------------------------------------------------------
// 1. Import the committed store into a fresh, throwaway store.
// 2. Export the tree TWICE into two separate throwaway directories -- one
//    to edit, one left pristine as the comparison baseline.
// -----------------------------------------------------------------------
const workRoot = mkdtempSync(join(tmpdir(), "phase50-exported-edit-"));
const storeDocument = JSON.parse(readFileSync(STORE_DOC, "utf8"));

const pristineExport = freshExport(workRoot, "pristine", storeDocument);
const editExport = freshExport(workRoot, "edit", storeDocument);

// Sanity: the two exports agree byte-for-byte before any edit is applied.
// If they did not, nothing downstream in this driver could be trusted.
for (const name of pristineExport.files) {
  const a = readFileSync(join(pristineExport.outDir, name));
  const b = readFileSync(join(editExport.outDir, name));
  if (Buffer.compare(a, b) !== 0) {
    fail(`the two fresh exports disagree on "${name}" before any edit was applied -- exportAsmTree() is not deterministic on this run`);
  }
}

// -----------------------------------------------------------------------
// 3. Apply each manifest source_edits entry, in order, to the EDIT tree.
//    Each entry's `find` must occur EXACTLY ONCE in its target file at the
//    time it is applied -- refuse by name and write nothing on a missing or
//    ambiguous match. Entries are applied sequentially, so a later entry
//    may target text an earlier entry produced (the added `jsr` lands
//    inside the region the removal freed).
// -----------------------------------------------------------------------
const editedTargets = new Set();
for (const [i, edit] of manifest.source_edits.entries()) {
  const { file, find, replace, why } = edit;
  if (typeof file !== "string" || !Array.isArray(find) || !Array.isArray(replace) || typeof why !== "string" || why.trim() === "") {
    fail(`source_edits[${i}] is malformed -- must carry file, find (array), replace (array) and a non-empty why`);
  }
  if (!pristineExport.files.includes(file)) {
    fail(
      `source_edits[${i}] declares target file "${file}", which is NOT a member of this export's own files list ` +
        `(${pristineExport.files.join(", ")}) -- refusing before any assembler call`,
    );
  }
  editedTargets.add(file);

  const targetPath = join(editExport.outDir, file);
  const text = readFileSync(targetPath, "utf8");
  const lines = text.split("\n");
  const findJoined = find.join("\n");

  let occurrences = 0;
  let matchAt = -1;
  for (let start = 0; start + find.length <= lines.length; start++) {
    const candidate = lines.slice(start, start + find.length).join("\n");
    if (candidate === findJoined) {
      occurrences++;
      if (matchAt === -1) matchAt = start;
    }
  }
  if (occurrences === 0) {
    fail(`source_edits[${i}]'s find block does not occur in "${file}" -- refusing to apply an edit that matches nothing`);
  }
  if (occurrences > 1) {
    fail(`source_edits[${i}]'s find block occurs ${occurrences} times in "${file}" -- refusing an ambiguous edit`);
  }

  const newLines = [...lines.slice(0, matchAt), ...replace, ...lines.slice(matchAt + find.length)];
  writeFileSync(targetPath, newLines.join("\n"), "utf8");
}

// TEST-ONLY REACHABILITY SEAM. `hazard-subject-exported-edit.test.ts`'s
// "a second file mutated behind the driver's back" refusal case cannot be
// reached through a manifest alone -- every manifest-driven edit is applied
// to exactly the file it names, by construction, so no manifest content can
// make a DIFFERENT file drift. This flag exists only so that refusal branch
// is exercised by a real run rather than left untested. It is never used
// outside that one test, and it never touches a declared target.
const TEST_CORRUPT_FILE = arg("test-corrupt-file", null);
if (TEST_CORRUPT_FILE !== null) {
  if (!pristineExport.files.includes(TEST_CORRUPT_FILE) || editedTargets.has(TEST_CORRUPT_FILE)) {
    fail(`--test-corrupt-file must name a file the export produced that is NOT a declared source_edits target`);
  }
  const corruptPath = join(editExport.outDir, TEST_CORRUPT_FILE);
  writeFileSync(corruptPath, readFileSync(corruptPath, "utf8") + "\n; test-only corruption, never a real edit\n", "utf8");
}

// -----------------------------------------------------------------------
// 4. Assert every file OTHER than the declared targets is byte-identical to
//    its counterpart in the pristine tree -- the guard that makes "nothing
//    but the declared edit changed" a measurement.
// -----------------------------------------------------------------------
for (const name of pristineExport.files) {
  if (editedTargets.has(name)) continue;
  const a = readFileSync(join(pristineExport.outDir, name));
  const b = readFileSync(join(editExport.outDir, name));
  if (Buffer.compare(a, b) !== 0) {
    fail(`file "${name}" differs from the pristine export but is NOT a declared source_edits target -- refusing: a second file was mutated behind the driver's back`);
  }
}
// Also assert the directory listings agree (no stray file was added or removed).
{
  const pristineNames = new Set(readdirSync(pristineExport.outDir));
  const editNames = new Set(readdirSync(editExport.outDir));
  for (const name of pristineNames) {
    if (!editNames.has(name)) fail(`file "${name}" exists in the pristine tree but not the edited tree`);
  }
  for (const name of editNames) {
    if (!pristineNames.has(name)) fail(`file "${name}" exists in the edited tree but not the pristine tree -- no source_edits entry may add a file`);
  }
}

// -----------------------------------------------------------------------
// 5. Build the expected bytes by applying expected_byte_changes to the
//    PRISTINE export's own expectedBytes, refusing when any row's `from`
//    does not match the byte actually there.
// -----------------------------------------------------------------------
const patchedExpectedBytes = Uint8Array.from(pristineExport.expectedBytes);
const minStart = Math.min(...pristineExport.blocks.map((b) => b.start));
for (const row of manifest.expected_byte_changes) {
  const { address, from, to } = row;
  if (!Number.isInteger(address) || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 255 || to < 0 || to > 255) {
    fail(`expected_byte_changes row ${JSON.stringify(row)} is malformed`);
  }
  const offset = address - minStart;
  if (offset < 0 || offset >= patchedExpectedBytes.length) {
    fail(`expected_byte_changes row at ${hex4(address)} falls outside the exported tree's own extent`);
  }
  const actual = patchedExpectedBytes[offset];
  if (actual !== from) {
    fail(
      `expected_byte_changes row at ${hex4(address)} declares "from" = ${from} (0x${from.toString(16)}), but the committed image's ` +
        `own byte there is ${actual} (0x${actual.toString(16)}) -- the pre-registration disagrees with the committed image, refusing ` +
        `rather than patching over the disagreement`,
    );
  }
  patchedExpectedBytes[offset] = to;
}

// -----------------------------------------------------------------------
// 6. Call verifyAcmeAssemblesTree() ONCE with the edited tree, the patched
//    expected bytes, and the tree's own source-order segments.
// -----------------------------------------------------------------------
const outputDir = join(workRoot, "assembled");
mkdirSync(outputDir, { recursive: true });

const verdict = verifyAcmeAssemblesTree({
  treeDir: editExport.outDir,
  rootFileName: ROOT_FILE_NAME,
  expectedBytes: patchedExpectedBytes,
  expectedSegments: blocksInTreeSourceOrder(editExport),
  outputDir,
});

if (verdict.outcome !== "ok") {
  console.error(`verifyAcmeAssemblesTree returned "${verdict.outcome}": ${verdict.reason}`);
  console.error((verdict.diagnostics ?? []).join("\n"));
  process.exit(1);
}

const body = readFileSync(join(outputDir, VERIFY_OUTPUT_FILE_NAME));

// -----------------------------------------------------------------------
// 7. Derive the two-byte little-endian load address, cross-checked against
//    ACME's own per-segment result lines -- the same rule make-rebuild.mjs
//    states and follows.
// -----------------------------------------------------------------------
const loadAddress = minStart;
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

// -----------------------------------------------------------------------
// 8. Write the machine-readable record. Byte-identity against
//    hazard-subject-modified.prg is recorded as a measured extra, never the
//    acceptance criterion -- the hand-written subject placed its added call
//    at a different offset, so the two are not expected to match.
// -----------------------------------------------------------------------
const committedImage = readFileSync(IMAGE);
let modifiedComparison = null;
try {
  const modifiedPath = join(FIXTURE_DIR, "hazard-subject-modified.prg");
  const modifiedBytes = readFileSync(modifiedPath);
  modifiedComparison = {
    path: modifiedPath,
    bytes: modifiedBytes.length,
    sha256: sha256(modifiedBytes),
    byte_identical_to_exported_edit: sha256(modifiedBytes) === sha256(prg),
  };
} catch {
  modifiedComparison = null;
}

const record = {
  produced_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  manifest: MANIFEST_PATH,
  manifest_sha256: sha256(readFileSync(MANIFEST_PATH)),
  store_document: STORE_DOC,
  store_document_sha256: sha256(readFileSync(STORE_DOC)),
  image_the_export_was_taken_against: IMAGE,
  image_sha256: sha256(committedImage),
  export_entry_point: "exportAsmTree() (src/mcp/vice/anno-export-asm.ts)",
  import_entry_point: "importStoreDocument() (src/mcp/vice/anno-store-export.ts)",
  assemble_entry_point: "verifyAcmeAssemblesTree() (src/mcp/vice/acme-verify.ts)",
  tree_files: [...pristineExport.files].sort(),
  edited_files: [...editedTargets].sort(),
  source_edits_applied: manifest.source_edits.length,
  expected_byte_changes_applied: manifest.expected_byte_changes.length,
  block_count: editExport.blocks.length,
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
  exported_edit_prg: OUT_PRG,
  exported_edit_prg_bytes: prg.length,
  exported_edit_prg_sha256: sha256(prg),
  committed_subject_prg: IMAGE,
  committed_subject_prg_bytes: committedImage.length,
  committed_subject_prg_sha256: sha256(committedImage),
  optional_extra_comparison_to_hand_written_modified_subject: modifiedComparison,
  note_on_optional_extra: "Byte-identity to hazard-subject-modified.prg is NOT this plan's acceptance criterion and is not aimed for -- see docs/phase50-exported-edit-findings.md.",
};
writeFileSync(RECORD, JSON.stringify(record, null, 2) + "\n");

rmSync(workRoot, { recursive: true, force: true });

console.log(JSON.stringify(record, null, 2));
