// reassembly-gate-modified-run.test.ts -- runs the reassembly gate's four
// in-process inputs for real, against real machinery, over the MODIFIED
// hazard subject -- and prints them in the vocabulary a schema document
// froze before this file existed.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// `docs/phase49-the-reassembly-gate-findings.md`'s committed `acknowledged`
// verdict (rule `R10`) is against the UNMODIFIED committed subject. ROADMAP
// Phase 50 criterion 4 requires the MODIFIED source -- one behaviour removed,
// one added, both anchored to a named hazard-report finding -- to be
// "reassembled through Phase 49's gate". That is a NEW run against NEW
// inputs. `reassembly-gate.ts` needs zero changes: this file supplies it a
// different `GateInput`, produced by the same real machinery
// `reassembly-gate-run.test.ts` already drives, pointed at
// `hazard-subject-modified.prg` / `hazard-subject-modified.annostore.json`
// instead of the committed subject's own pair. This file is a SIBLING of
// `reassembly-gate-run.test.ts`, not an edit to it: the committed subject's
// own run stays on the record exactly as it was, and this run's verdict is a
// second, independent measurement, over a subject with its own real hazard
// report.
//
// THIS FILE MEASURES. IT DOES NOT DECIDE. Every assertion below checks that
// a printed token is a MEMBER of its declared domain, never that it holds a
// particular value -- see `reassembly-gate-run.test.ts`'s own header for why:
// a future reader will be tempted to add an assertion that this run is
// green, and that assertion would quietly turn a measuring instrument into a
// second, unfrozen decision rule sitting beside the committed one.
//
// `DIFF_SCOPE_COVERAGE` PRINTS TWICE, DELIBERATELY, on the same terms the
// committed run test already documents: once for the baseline rebuild, once
// for the movement rebuild -- the movement subject is untouched by this
// phase's modification and is reused exactly as `reassembly-gate-run.test.ts`
// reuses it, never re-derived.
//
// THE ACKNOWLEDGEMENT ARRAY BELOW IS BUILT FROM THIS SUBJECT'S OWN REAL
// HAZARD REPORT, never copied from the committed run test's five-entry
// array. The modified subject's report was measured (by running
// `buildHazardReport()` against it, at plan-authoring time) to carry FOUR
// findings, not five: the `page-alignment` finding at `$088B`
// (`sprite-pointer-names-aligned-base`) is ABSENT, because the sprite
// pointer write that produced it is REMOVED by this modification (see
// `hazard-subject-align-nosprite.a`'s own header). The other four findings
// -- `indexed-dispatch` at `$081C`, `self-modifying-code` at `$0825`,
// `page-alignment` at `$0881` (`charset-base-pinned-by-register`), and
// `cycle-exact-raster` at `$10C2` -- are UNCHANGED from the committed
// subject's report, because none of their constructions was touched by this
// modification. Below, each of those four gets its own entry, on the same
// ground the committed run test's own array already stands on: this run's
// baseline rebuild reproduces the modified subject at its ORIGINAL layout,
// so a relocation-scoped acknowledgement ("this run does not relocate the
// thing the finding names") is honest for all four. If the real report this
// run measures ever carries a fifth finding, or drops a fourth one, this
// frozen array does NOT grow or shrink to match -- the disposition would
// then come back `blocked`, and this file prints that token rather than
// silently acknowledging a finding it was never told to.
//
// GATE. Exactly one test always runs and is never skipped: "ACME
// availability gate". Every other test below is real-assembler-dependent
// and skips locally with a named reason computed once by the shared
// availability-gate module -- never a hand-rolled probe.
//
// WHAT THIS FILE DOES NOT DO
// ---------------------------------------------------------------------------
// It does not derive `RED_CONTROLS`, `SECOND_PATH_GUARD` or `ORDERING_PROOF`
// -- those three are properties of running OTHER test files and of git
// history, never of anything this file's own process can measure in place.
// It does not spawn an assembler directly: every real-assembler call in this
// file goes through the one tree-aware entry point (`acme-verify.ts`)
// already used by every other gate test. It does not add an acknowledgement
// entry to make a disposition come out clean or acknowledged -- if the real
// report carries a finding or an undecided region this file's frozen
// acknowledgement array does not name, the disposition comes back blocked
// and this file prints that token.
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
const SKIP_REASON = acmeSkipReasonFor("reassembly-gate-modified-run.test.ts");

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

// ---------------------------------------------------------------------------
// The MODIFIED subject -- plan 50-02's own output, loaded on the same terms
// every other gate test file already loads the committed one.
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(HERE, "fixtures", "hazard-subject");
const PRG_PATH = join(FIXTURE_DIR, "hazard-subject-modified.prg");
const ANNOSTORE_PATH = join(FIXTURE_DIR, "hazard-subject-modified.annostore.json");

let workDir: string | undefined;
let dirCounter = 0;

function freshDir(tag: string): string {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "reassembly-gate-modified-run-"));
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

/** Writes the modified subject's committed store export into a fresh,
 * throwaway store file -- through `importStoreDocument()`, the store's own
 * public import verb, never raw SQL -- the same discipline
 * `reassembly-gate-run.test.ts` already carries for the unmodified
 * subject. */
function freshStoreFromCommittedExport(dir: string): string {
  const storePath = join(dir, "hazard-subject-modified.annostore");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    importStoreDocument(handle, loadCommittedExport());
  } finally {
    closeStore(handle);
  }
  return storePath;
}

/** Reorders blocks into the order a REAL assembler reports them for a TREE
 * -- file-inclusion order, never address order. Duplicated here on the same
 * terms `acme-verify.test.ts`, `reassembly-gate.test.ts` and
 * `reassembly-gate-run.test.ts` already carry this exact helper (an
 * unscoped block sourced LAST can have the lowest address of all, so a
 * positional unanimity check needs the tree's own emission order, not
 * `result.blocks`'s address-ascending one). */
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

/** A committed `.prg`'s bytes and load address -- the first two bytes are
 * the little-endian load address, never passed to `buildHazardReport()` as
 * part of the payload. Duplicated from `reassembly-gate-run.test.ts`'s own
 * `loadPrg()` on the same fixture-loading terms that file states for its own
 * duplication. */
function loadPrg(path: string): { bytes: Uint8Array; origin: number } {
  const raw = readFileSync(path);
  const origin = raw[0]! | (raw[1]! << 8);
  return { bytes: new Uint8Array(raw.subarray(2)), origin };
}

/** The committed store export's ranges, converted to `BlockEntry`'s shape
 * (`start_address`/`end_address`/`type`) -- the shape `buildHazardReport()`
 * accepts, which is NOT `StoreExportRangeRow`'s own shape
 * (`start`/`endInclusive`/`dataType`). */
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
// The frozen acknowledgement array for the MODIFIED subject's own real
// hazard report. Measured (at plan-authoring time, by running
// `buildHazardReport()` directly against `hazard-subject-modified.prg` and
// `hazard-subject-modified.annostore.json`) to carry exactly FOUR findings,
// not the committed subject's five -- see this file's own header for why
// the `page-alignment` finding at `$088B` is absent. Each entry below
// acknowledges on the SAME relocation-scoped ground
// `reassembly-gate-run.test.ts`'s own array already stands on: this run's
// baseline rebuild reproduces the MODIFIED subject at its ORIGINAL layout,
// so the reasoned acceptance is that this run does not relocate the thing
// each finding names -- nothing broader than that. With all four findings
// acknowledged and (measured) zero undecided regions, the disposition below
// is expected to come back `acknowledged`, on the identical `R10` ground
// the committed subject's own run already stands on.
// ---------------------------------------------------------------------------

const HAZARD_ACKNOWLEDGEMENTS: readonly HazardAcknowledgement[] = Object.freeze([
  {
    hazardClass: "indexed-dispatch",
    anchorAddress: 0x081c,
    mechanism: "stack-return-dispatch",
    reason:
      "the RTS-trick return address is reconstructed from a fixed hi/lo table pair; this run does not relocate that table or the " +
      "code that reads it, so the reconstructed return address stays correct as-is. Unchanged by this phase's modification, which " +
      "touches only the alignment routine.",
  },
  {
    hazardClass: "self-modifying-code",
    anchorAddress: 0x0825,
    mechanism: "store-target-in-instruction-opcode-byte",
    reason:
      "the opcode-byte write targets a fixed, unrelocated address in this run; the instruction it patches is not moved by this " +
      "rebuild, so the write still lands on the intended opcode byte. This construction's own bytes are unchanged by this phase's " +
      "modification -- only its reachability changed, from never-called in the committed subject to called once from the amended " +
      "alignment routine.",
  },
  {
    hazardClass: "page-alignment",
    anchorAddress: 0x0881,
    mechanism: "charset-base-pinned-by-register",
    reason:
      "the character-set selector is stated as a fixed immediate value naming the committed character-set base; this run does not " +
      "relocate the character set (the baseline rebuild reproduces the modified subject at its original layout), so the register " +
      "value still names the correct 2048-byte-aligned block. Unchanged by this phase's modification.",
  },
  {
    hazardClass: "cycle-exact-raster",
    anchorAddress: 0x10c2,
    mechanism: "timer-reload-in-vectored-handler",
    reason:
      "the one-shot timer reload sits inside a vectored handler this run does not relocate; its cycle-exact timing is unaffected " +
      "by a rebuild that leaves the handler at its original address. Unchanged by this phase's modification.",
  },
]);

// ---------------------------------------------------------------------------
// The run.
// ---------------------------------------------------------------------------

test("gate run: the four in-process gate inputs, measured for real against the MODIFIED subject and a real assembler", { skip: SKIP_REASON }, () => {
  // -------------------------------------------------------------------
  // Baseline rebuild: the modified subject's own tree, at its original
  // layout, verified by the real tree-aware entry point.
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
  // The real hazard report over the same modified subject, and the
  // diff-scope check against the baseline export's own half-open extent.
  // -------------------------------------------------------------------
  const { bytes: subjectBytes, origin: subjectOrigin } = loadPrg(PRG_PATH);
  const hazardReport: HazardReport = buildHazardReport({ bytes: subjectBytes, origin: subjectOrigin, ranges: rangesForHazardReport(loadCommittedExport()) });
  const baselineExtent = diffScopeExtentFromBlocks(baselineExport.blocks);
  const baselineDiffScope = hazardCoverageOutsideDiffScope(hazardReport.findings, baselineExtent, hazardReport.regions);
  assert.ok(DIFF_SCOPE_COVERAGES.includes(baselineDiffScope.coverage), `DIFF_SCOPE_COVERAGE (baseline) must be a declared token, got ${baselineDiffScope.coverage}`);

  // -------------------------------------------------------------------
  // Movement rebuild: relocate the shared movement subject's routine_a by
  // the shared delta, re-export at the new layout, and verify it for real.
  // Untouched by this phase's modification -- reused, never re-derived.
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

  // The movement context must report two DIFFERENT addresses whenever the
  // movement outcome is not the refused token -- a same-address round trip
  // is exactly what "refused" exists to name.
  if (movementRebuildToken !== "refused") {
    assert.notEqual(
      relocatedSubject.originalAddress,
      relocatedSubject.relocatedAddress,
      "a non-refused movement outcome must report two different addresses",
    );
  }

  // The relocated subject's own hazard report and diff-scope check -- the
  // movement rebuild's own occurrence of DIFF_SCOPE_COVERAGE, over the
  // relocated tree's own extent, per SCHEMA.md's own two-source-file rule
  // for this one input.
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
  // array declared above. No region acknowledgement is supplied -- see
  // that array's own comment for why a `blocked` disposition here would be
  // the honest measurement of an unexpected finding, not a defect in this
  // harness.
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
  console.log("baseline rebuild (modified subject):");
  console.log(`TREE_REBUILD: ${baselineVerdict.outcome}`);
  console.log(`DIFF_SCOPE_COVERAGE: ${baselineDiffScope.coverage}`);
  console.log("");
  console.log("movement rebuild (shared, unmodified subject):");
  console.log(`MOVEMENT_REBUILD: ${movementRebuildToken}`);
  console.log(`DIFF_SCOPE_COVERAGE: ${movementDiffScope.coverage}`);
  console.log("");
  console.log("hazard disposition (modified subject's own real report):");
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
      `hazard-report-unclassified-regions=${hazardReport.regions.filter((r) => r.outcome === "unclassified").length}`,
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
