// reassembly-gate-exported-edit-run.test.ts -- runs the reassembly gate's
// four in-process inputs for real, against real machinery, over the
// EXPORTED-EDIT hazard subject -- and prints them in the vocabulary a schema
// document froze before this file existed.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// `docs/phase50-modifiability-findings.md`'s `acknowledged` verdict (rule
// `R10`) is against the hand-written MODIFIED subject
// (`hazard-subject-modified.prg`, plan 50-02's own output). ROADMAP Phase 50
// criterion 4 also requires the same modifiability claim demonstrated in the
// source the decomposition itself EMITS -- plan 50-08's `hazard-subject-
// exported-edit.prg`, produced by editing a file `exportAsmTree()` itself
// wrote (`scope_087a.a`), reassembled through a pre-registered byte manifest.
// `reassembly-gate.ts` needs zero changes: this file supplies it a NEW
// `GateInput`, produced by the same real machinery
// `reassembly-gate-modified-run.test.ts` already drives, parameterized over
// the exported-edit subject instead. This file is a SIBLING of both
// `reassembly-gate-run.test.ts` and `reassembly-gate-modified-run.test.ts`,
// not an edit to either.
//
// THE STORE QUESTION, MEASURED. Unlike the hand-written modified subject
// (which needed its own separate `hazard-subject-modified.annostore.json`),
// the exported-edit subject's manifest preserves every block boundary and
// every symbol value -- Task 1's own guard proves this (every other exported
// file is byte-identical to a fresh export, and the block-origin/block-end
// assertions the exporter itself writes into every `.a` file would refuse an
// assembly whose length drifted). So the COMMITTED `hazard-subject.annostore.json`
// is used UNCHANGED here, exported directly against `hazard-subject-exported-
// edit.prg` -- the PRIMARY route the plan names, measured (not assumed) to
// round-trip byte-identical before this file was written. This is the
// STRONGER claim: the original decomposition still describes the program
// after the edit, which is exactly the modifiability claim ROADMAP criterion
// 4 asks for. No third `SUBJECTS` entry was needed in
// `make-hazard-subject-annostore.mjs`.
//
// THIS FILE MEASURES. IT DOES NOT DECIDE. Every assertion below checks that
// a printed token is a MEMBER of its declared domain, never that it holds a
// particular value -- see `reassembly-gate-run.test.ts`'s own header for why.
//
// THE DISAPPEARING FINDING IS ASSERTED IN BOTH DIRECTIONS, in the same run,
// against the SAME committed store and ranges: the committed subject's own
// hazard report carries `page-alignment` at `$088B`
// (`sprite-pointer-names-aligned-base`); the exported-edit subject's report
// does not. The `page-alignment` finding at `$0881`
// (`charset-base-pinned-by-register`) and the `self-modifying-code` finding
// at `$0825` (`store-target-in-instruction-opcode-byte`) are asserted PRESENT
// in both, so this is not merely observing that the whole hazard class
// vanished.
//
// GATE. Exactly one test always runs and is never skipped: "ACME
// availability gate". Every other test below is real-assembler-dependent and
// skips locally with a named reason computed once by the shared
// availability-gate module.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { verifyAcmeAssemblesTree } from "./acme-verify.ts";
import { exportAsmTree, ROOT_FILE_NAME, type ExportBlock } from "./anno-export-asm.ts";
import { openStore, closeStore } from "./anno-store.ts";
import { importStoreDocument, type StoreExportDocument } from "./anno-store-export.ts";
import type { ScopeRow } from "./anno-types.ts";
import { buildHazardReport, type HazardReport } from "./anno-hazard-report.ts";
import type { BlockEntry } from "./block-class.ts";
import { hazardCoverageOutsideDiffScope, movementRebuildFromResult, DIFF_SCOPE_COVERAGES, HAZARD_DISPOSITIONS, type DiffScopeExtent } from "./reassembly-gate.ts";
import { relocateSubject, buildMovementResult } from "./reassembly-gate-movement.ts";
import { MOVEMENT_ORIGIN, movementDocument, movementImage, ROUTINE_A_SITES, MOVEMENT_DELTA } from "./reassembly-gate-movement-subject.ts";
import { matchHazardAcknowledgements, disposeHazardReport, renderAcknowledgementLines, type HazardAcknowledgement } from "./reassembly-gate-ack.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKIP_REASON = acmeSkipReasonFor("reassembly-gate-exported-edit-run.test.ts");

// ---------------------------------------------------------------------------
// The EXPORTED-EDIT subject -- plan 50-08's own output, against the SAME
// committed store the committed subject itself uses (see this file's own
// header for why no separate annostore was needed).
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(HERE, "fixtures", "hazard-subject");
const PRG_PATH = join(FIXTURE_DIR, "hazard-subject-exported-edit.prg");
const COMMITTED_PRG_PATH = join(FIXTURE_DIR, "hazard-subject.prg");
const ANNOSTORE_PATH = join(FIXTURE_DIR, "hazard-subject.annostore.json");

let workDir: string | undefined;
let dirCounter = 0;

function freshDir(tag: string): string {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "reassembly-gate-exported-edit-run-"));
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

/** Writes the COMMITTED store export into a fresh, throwaway store file --
 * through `importStoreDocument()`, the store's own public import verb, never
 * raw SQL -- the same discipline `reassembly-gate-run.test.ts` and
 * `reassembly-gate-modified-run.test.ts` already carry. Unlike the modified
 * subject's own sibling, this subject reuses the COMMITTED store unchanged --
 * see this file's own header. */
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

/** Reorders blocks into the order a REAL assembler reports them for a TREE --
 * file-inclusion order, never address order. Duplicated here on the same
 * terms `acme-verify.test.ts`, `reassembly-gate.test.ts`,
 * `reassembly-gate-run.test.ts` and `reassembly-gate-modified-run.test.ts`
 * already carry this exact helper. */
function blocksInTreeSourceOrder(result: { scopes: readonly ScopeRow[]; blocks: readonly ExportBlock[] }): ExportBlock[] {
  const sortedScopes = [...result.scopes].sort((a, b) => a.start - b.start);
  const byScopeStart = new Map<number, ExportBlock[]>();
  const unscoped: ExportBlock[] = [];
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
  const ordered: ExportBlock[] = [];
  for (const scope of sortedScopes) {
    const blocksInScope = byScopeStart.get(scope.start);
    if (blocksInScope) ordered.push(...[...blocksInScope].sort((a, b) => a.start - b.start));
  }
  ordered.push(...[...unscoped].sort((a, b) => a.start - b.start));
  return ordered;
}

/** A committed `.prg`'s bytes and load address -- the first two bytes are the
 * little-endian load address, never passed to `buildHazardReport()` as part
 * of the payload. Duplicated from `reassembly-gate-run.test.ts`'s own
 * `loadPrg()` on the same fixture-loading terms that file states. */
function loadPrg(path: string): { bytes: Uint8Array; origin: number } {
  const raw = readFileSync(path);
  const origin = raw[0]! | (raw[1]! << 8);
  return { bytes: new Uint8Array(raw.subarray(2)), origin };
}

/** The committed store export's ranges, converted to `BlockEntry`'s shape
 * (`start_address`/`end_address`/`type`) -- the shape `buildHazardReport()`
 * accepts. */
function rangesForHazardReport(doc: StoreExportDocument): BlockEntry[] {
  return doc.ranges.map((range) => ({ start_address: range.start, end_address: range.endInclusive, type: range.dataType }));
}

function diffScopeExtentFromBlocks(blocks: readonly ExportBlock[]): DiffScopeExtent {
  return { start: Math.min(...blocks.map((b) => b.start)), endExclusive: Math.max(...blocks.map((b) => b.endExclusive)) };
}

function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// The movement rebuild's own store/export plumbing -- the same shape
// `reassembly-gate-run.test.ts`'s own `exportMovementTree()` already uses,
// over the SAME shared movement subject that file imports. This phase's
// modification touches only the alignment routine; the movement subject
// (`reassembly-gate-movement-subject.ts`) is untouched, so this run reuses
// it rather than re-deriving a second one.
// ---------------------------------------------------------------------------

function writePrg(path: string, origin: number, body: Uint8Array): void {
  writeFileSync(path, Buffer.from([origin & 0xff, (origin >> 8) & 0xff, ...body]));
}

function freshStoreFromDocument(dir: string, doc: StoreExportDocument): string {
  const storePath = join(dir, "movement-subject.annostore");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    importStoreDocument(handle, doc);
  } finally {
    closeStore(handle);
  }
  return storePath;
}

function exportMovementTree(dir: string, doc: StoreExportDocument, image: Uint8Array, origin: number): ReturnType<typeof exportAsmTree> {
  const prgPath = join(dir, "subject.prg");
  writePrg(prgPath, origin, image);
  const storePath = freshStoreFromDocument(dir, doc);
  const outDir = join(dir, "tree");
  return exportAsmTree({ storePath, imagePath: prgPath, workspaceRoot: dir, outDir });
}

// ---------------------------------------------------------------------------
// The frozen acknowledgement array for the EXPORTED-EDIT subject's own real
// hazard report. Measured (at plan-authoring time, by running
// `buildHazardReport()` directly against `hazard-subject-exported-edit.prg`
// and the COMMITTED store's own ranges) to carry exactly FOUR findings, not
// the committed subject's five -- the `page-alignment` finding at `$088B` is
// absent, on the identical ground `reassembly-gate-modified-run.test.ts`'s
// own array already stands on for the hand-written twin. Each entry
// acknowledges on the SAME relocation-scoped ground: this run's baseline
// rebuild reproduces the exported-edit subject at its ORIGINAL layout, so the
// reasoned acceptance is that this run does not relocate the thing each
// finding names -- nothing broader than that.
// ---------------------------------------------------------------------------

const HAZARD_ACKNOWLEDGEMENTS: readonly HazardAcknowledgement[] = Object.freeze([
  {
    hazardClass: "indexed-dispatch",
    anchorAddress: 0x081c,
    mechanism: "stack-return-dispatch",
    reason:
      "the RTS-trick return address is reconstructed from a fixed hi/lo table pair; this run does not relocate that table or the " +
      "code that reads it, so the reconstructed return address stays correct as-is. Unchanged by this plan's edit, which touches " +
      "only the alignment routine's own exported scope file.",
  },
  {
    hazardClass: "self-modifying-code",
    anchorAddress: 0x0825,
    mechanism: "store-target-in-instruction-opcode-byte",
    reason:
      "the opcode-byte write targets a fixed, unrelocated address in this run; the instruction it patches is not moved by this " +
      "rebuild, so the write still lands on the intended opcode byte. This construction's own bytes are unchanged by this plan's " +
      "edit -- only its reachability changed, from never-called in the committed subject to called once from the amended " +
      "alignment routine, via the added jsr hazard_smc2_entry.",
  },
  {
    hazardClass: "page-alignment",
    anchorAddress: 0x0881,
    mechanism: "charset-base-pinned-by-register",
    reason:
      "the character-set selector is stated as a fixed immediate value naming the committed character-set base; this run does not " +
      "relocate the character set (the baseline rebuild reproduces the exported-edit subject at its original layout), so the " +
      "register value still names the correct 2048-byte-aligned block. Unchanged by this plan's edit.",
  },
  {
    hazardClass: "cycle-exact-raster",
    anchorAddress: 0x10c2,
    mechanism: "timer-reload-in-vectored-handler",
    reason:
      "the one-shot timer reload sits inside a vectored handler this run does not relocate; its cycle-exact timing is unaffected " +
      "by a rebuild that leaves the handler at its original address. Unchanged by this plan's edit.",
  },
]);

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

// ---------------------------------------------------------------------------
// The run.
// ---------------------------------------------------------------------------

test("gate run: the four in-process gate inputs, measured for real against the EXPORTED-EDIT subject and a real assembler", { skip: SKIP_REASON }, () => {
  // -------------------------------------------------------------------
  // Baseline rebuild: the exported-edit subject's own tree, exported
  // against the COMMITTED store, at its original layout, verified by the
  // real tree-aware entry point.
  // -------------------------------------------------------------------
  const baselineDir = freshDir("baseline");
  const baselineStorePath = freshStoreFromCommittedExport(baselineDir);
  const baselineOutDir = join(baselineDir, "tree");
  const baselineExport = exportAsmTree({ storePath: baselineStorePath, imagePath: PRG_PATH, workspaceRoot: baselineDir, outDir: baselineOutDir });
  const baselineVerdict = verifyAcmeAssemblesTree({
    treeDir: baselineExport.outDir,
    rootFileName: ROOT_FILE_NAME,
    expectedBytes: baselineExport.expectedBytes,
    expectedSegments: blocksInTreeSourceOrder(baselineExport),
  });

  // The membership check, never a value check: the harness measures, the
  // rule table decides.
  assert.ok(["ok", "failed", "skipped"].includes(baselineVerdict.outcome), `TREE_REBUILD must be a declared token, got ${baselineVerdict.outcome}`);

  // -------------------------------------------------------------------
  // The real hazard reports over BOTH subjects -- the committed subject
  // and the exported-edit subject -- against the SAME committed store's
  // own ranges, so the disappearing finding is asserted in both
  // directions in the same run.
  // -------------------------------------------------------------------
  const committedExportDoc = loadCommittedExport();
  const { bytes: subjectBytes, origin: subjectOrigin } = loadPrg(PRG_PATH);
  const hazardReport: HazardReport = buildHazardReport({ bytes: subjectBytes, origin: subjectOrigin, ranges: rangesForHazardReport(committedExportDoc) });

  const { bytes: committedBytes, origin: committedOrigin } = loadPrg(COMMITTED_PRG_PATH);
  const committedHazardReport: HazardReport = buildHazardReport({ bytes: committedBytes, origin: committedOrigin, ranges: rangesForHazardReport(committedExportDoc) });

  const baselineExtent = diffScopeExtentFromBlocks(baselineExport.blocks);
  const baselineDiffScope = hazardCoverageOutsideDiffScope(hazardReport.findings, baselineExtent, hazardReport.regions);
  assert.ok(DIFF_SCOPE_COVERAGES.includes(baselineDiffScope.coverage), `DIFF_SCOPE_COVERAGE (baseline) must be a declared token, got ${baselineDiffScope.coverage}`);

  // THE DISAPPEARING FINDING, asserted in both directions.
  const committedHasRemovedFinding = committedHazardReport.findings.some(
    (f) => f.hazardClass === "page-alignment" && f.anchorAddress === 0x088b && f.mechanism === "sprite-pointer-names-aligned-base",
  );
  assert.equal(committedHasRemovedFinding, true, "the committed subject's own hazard report must carry the page-alignment finding at $088B");
  const editedHasRemovedFinding = hazardReport.findings.some(
    (f) => f.hazardClass === "page-alignment" && f.anchorAddress === 0x088b && f.mechanism === "sprite-pointer-names-aligned-base",
  );
  assert.equal(editedHasRemovedFinding, false, "the exported-edit subject's own hazard report must NOT carry the page-alignment finding at $088B -- the construction that produced it was removed");

  // THE SURVIVING page-alignment finding, present in both.
  for (const [label, report] of [
    ["committed", committedHazardReport],
    ["exported-edit", hazardReport],
  ] as const) {
    const hasSurvivor = report.findings.some((f) => f.hazardClass === "page-alignment" && f.anchorAddress === 0x0881 && f.mechanism === "charset-base-pinned-by-register");
    assert.equal(hasSurvivor, true, `the ${label} subject's own hazard report must carry the page-alignment finding at $0881`);
  }

  // THE self-modifying-code finding, present in both, its own bytes unchanged.
  for (const [label, report] of [
    ["committed", committedHazardReport],
    ["exported-edit", hazardReport],
  ] as const) {
    const hasSmc = report.findings.some((f) => f.hazardClass === "self-modifying-code" && f.anchorAddress === 0x0825 && f.mechanism === "store-target-in-instruction-opcode-byte");
    assert.equal(hasSmc, true, `the ${label} subject's own hazard report must carry the self-modifying-code finding at $0825`);
  }
  // The construction's own bytes ($0825-$0832, scope_0825.a's whole span)
  // are byte-identical between the two subjects -- only its reachability
  // moved, never its own bytes.
  assert.deepEqual(
    committedBytes.subarray(0x0825 - committedOrigin, 0x0833 - committedOrigin),
    subjectBytes.subarray(0x0825 - subjectOrigin, 0x0833 - subjectOrigin),
    "the self-modifying-code construction's own bytes at $0825-$0832 must be unchanged between the committed and exported-edit subjects",
  );

  // -------------------------------------------------------------------
  // Movement rebuild: relocate the shared movement subject's routine_a by
  // the shared delta, re-export at the new layout, and verify it for real.
  // Untouched by this plan's edit -- reused, never re-derived.
  // -------------------------------------------------------------------
  const relocatedSubject = relocateSubject({
    document: movementDocument(),
    image: movementImage(),
    origin: MOVEMENT_ORIGIN,
    symbolName: "routine_a",
    delta: MOVEMENT_DELTA,
    sites: ROUTINE_A_SITES,
  });
  const movementDir = freshDir("movement");
  const movementExport = exportMovementTree(movementDir, relocatedSubject.document, relocatedSubject.image, relocatedSubject.origin);
  const movementVerdict = verifyAcmeAssemblesTree({
    treeDir: movementExport.outDir,
    rootFileName: ROOT_FILE_NAME,
    expectedBytes: movementExport.expectedBytes,
    expectedSegments: blocksInTreeSourceOrder(movementExport),
  });
  const movementResult = buildMovementResult(movementVerdict.outcome, relocatedSubject);
  const movementRebuildToken = movementRebuildFromResult(movementResult);
  assert.ok(
    ["ok", "failed", "skipped", "refused"].includes(movementRebuildToken),
    `MOVEMENT_REBUILD must be a declared token, got ${movementRebuildToken}`,
  );

  if (movementRebuildToken !== "refused") {
    assert.notEqual(
      relocatedSubject.originalAddress,
      relocatedSubject.relocatedAddress,
      "a non-refused movement outcome must report two different addresses",
    );
  }

  const movementHazardReport = buildHazardReport({
    bytes: relocatedSubject.image,
    origin: relocatedSubject.origin,
    ranges: rangesForHazardReport(relocatedSubject.document),
  });
  const movementExtent = diffScopeExtentFromBlocks(movementExport.blocks);
  const movementDiffScope = hazardCoverageOutsideDiffScope(movementHazardReport.findings, movementExtent, movementHazardReport.regions);
  assert.ok(DIFF_SCOPE_COVERAGES.includes(movementDiffScope.coverage), `DIFF_SCOPE_COVERAGE (movement) must be a declared token, got ${movementDiffScope.coverage}`);

  // -------------------------------------------------------------------
  // Hazard disposition: the real report against the frozen acknowledgement
  // array declared above.
  // -------------------------------------------------------------------
  const disposal = disposeHazardReport(hazardReport, HAZARD_ACKNOWLEDGEMENTS);
  assert.ok(HAZARD_DISPOSITIONS.includes(disposal.disposition), `HAZARD_DISPOSITION must be a declared token, got ${disposal.disposition}`);

  const match = matchHazardAcknowledgements(hazardReport.findings, hazardReport.regions, HAZARD_ACKNOWLEDGEMENTS);
  const renderedAckLines = renderAcknowledgementLines(match.matched);

  // -------------------------------------------------------------------
  // The printed record. Every outcome line below is a bare `NAME: value`
  // at column zero, spelled exactly as SCHEMA.md declares it -- nothing
  // printed here is an assertion that the value is any particular one.
  // -------------------------------------------------------------------
  console.log("baseline rebuild (exported-edit subject, against the COMMITTED store):");
  console.log(`TREE_REBUILD: ${baselineVerdict.outcome}`);
  console.log(`DIFF_SCOPE_COVERAGE: ${baselineDiffScope.coverage}`);
  console.log("");
  console.log("movement rebuild (shared, unmodified subject):");
  console.log(`MOVEMENT_REBUILD: ${movementRebuildToken}`);
  console.log(`DIFF_SCOPE_COVERAGE: ${movementDiffScope.coverage}`);
  console.log("");
  console.log("hazard disposition (exported-edit subject's own real report):");
  console.log(`HAZARD_DISPOSITION: ${disposal.disposition}`);
  console.log("");
  console.log("Acknowledged findings:");
  for (const line of renderedAckLines) console.log(`  ${line}`);
  if (renderedAckLines.length === 0) console.log("  (none matched)");
  console.log("");
  console.log(
    `context: subject=${basename(PRG_PATH)} baseline-outcome-reason=${JSON.stringify(baselineVerdict.reason)} ` +
      `baseline-byte-length=${baselineVerdict.byteDiff?.actualLength ?? "n/a"} baseline-segment-count=${baselineExport.blocks.length} ` +
      `baseline-diff-scope-extent=${hex4(baselineExtent.start)}..${hex4(baselineExtent.endExclusive)} (exclusive)`,
  );
  console.log(
    `context: hazard-report-findings=${hazardReport.findings.length} ` +
      `hazard-report-unclassified-regions=${hazardReport.regions.filter((r) => r.outcome === "unclassified").length} ` +
      `committed-hazard-report-findings=${committedHazardReport.findings.length}`,
  );
  console.log(
    `context: movement-subject=routine_a movement-delta=${relocatedSubject.delta} (${hex4(relocatedSubject.delta)}) ` +
      `movement-original-address=${hex4(relocatedSubject.originalAddress)} movement-relocated-address=${hex4(relocatedSubject.relocatedAddress)}`,
  );
  console.log(
    `context: movement-outcome-reason=${JSON.stringify(movementVerdict.reason)} ` +
      `movement-byte-length=${movementVerdict.byteDiff?.actualLength ?? "n/a"} movement-segment-count=${movementExport.blocks.length} ` +
      `movement-diff-scope-extent=${hex4(movementExtent.start)}..${hex4(movementExtent.endExclusive)} (exclusive)`,
  );
});
