// reassembly-gate-modified-run.test.ts -- runs the reassembly gate's four
// in-process inputs for real, against real machinery, over the MODIFIED
// hazard subject -- and prints them in the vocabulary a schema document
// froze before this file existed.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// The reassembly gate's committed `acknowledged` verdict (rule `R10`,
// recorded the first time the gate ran against this hazard subject) is
// against the UNMODIFIED committed subject. ROADMAP
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
import { spawnSync } from "node:child_process";

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

// ---------------------------------------------------------------------------
// Task 3: the pre-registered allowlist's static proof. Needs no emulator --
// each committed subject's own payload is lifted into a fresh, zero-filled
// 65536-byte buffer at its own load address, and the SAME cross-binary
// comparison instrument plan 50-01 committed
// (`compare-cross-binary.mjs`) is run over the pair through its own CLI.
//
// A SUBPROCESS, NEVER AN IMPORT: `src/mcp/vice/**` and `src/skills/**`
// publish as separate npm packages and cannot import each other
// (`acme-verify.ts`'s own header states the identical constraint for
// `ACME_VERIFY_ARGV_FLAGS`). `skill-acme-build-cli.test.ts` already
// establishes this exact pattern -- a `src/mcp/vice/` test file driving a
// sibling `src/skills/` script via `spawnSync(process.execPath, [...])` --
// for `src/skills/acme-build/scripts/acme.mjs`; this is the same pattern
// applied to `compare-cross-binary.mjs`. This is NOT a second real-assembler
// launch site: `compare-cross-binary.mjs` never spawns anything and
// contacts nothing (its own header states this), so `T-50-09`'s "the one
// sanctioned assembler launch" is unaffected -- the assembler is reached
// only through `verifyAcmeAssemblesTree()`, above, exactly as Task 1 left
// it.
// ---------------------------------------------------------------------------

const ALLOWLIST_PATH = join(FIXTURE_DIR, "hazard-subject-modified.allowlist.json");
const CROSS_BINARY_SCRIPT = join(HERE, "..", "..", "skills", "c64-ram-capture", "scripts", "compare-cross-binary.mjs");

interface AllowlistEntry {
  start: number;
  endInclusive: number;
  domain?: "image" | "register";
  why?: string;
}

interface AllowlistDoc {
  entries: AllowlistEntry[];
  note?: string;
  checkpoint?: string;
  subjects?: Record<string, string>;
}

function loadAllowlistDoc(): AllowlistDoc {
  return JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as AllowlistDoc;
}

/** A minimal duplicate of `compare-cross-binary.mjs`'s own `IO_VOLATILE`
 * register mask and `IMAGE_VOLATILE` image mask, for the two static
 * mask-overlap assertions below. This file cannot import the real tables --
 * see this section's own header for why a subprocess, not an import, is
 * this file's only route to `src/skills/**` at all. This is the SAME
 * deliberate second-implementation pattern `acme-verify.ts`'s
 * `ACME_VERIFY_ARGV_FLAGS`/`MSVC` already carry across the identical
 * package boundary, kept minimal and matched address-for-address against
 * the real module's own committed tables. */
const IO_MASKED_CANONICAL: ReadonlyArray<{ lo: number; hi: number }> = [
  { lo: 0xd011, hi: 0xd011 },
  { lo: 0xd012, hi: 0xd012 },
  { lo: 0xd019, hi: 0xd019 },
  { lo: 0xd01e, hi: 0xd01f },
];
const IO_MASKED_FLAT: ReadonlyArray<{ lo: number; hi: number }> = [
  { lo: 0xd400, hi: 0xd7ff },
  { lo: 0xd800, hi: 0xdbff },
  { lo: 0xdc00, hi: 0xdcff },
  { lo: 0xdd00, hi: 0xddff },
  { lo: 0xde00, hi: 0xdfff },
];
const IMAGE_MASKED: ReadonlyArray<{ lo: number; hi: number }> = [
  { lo: 0x0000, hi: 0x0001 },
  { lo: 0x0100, hi: 0x01ff },
  { lo: 0x0200, hi: 0x03ff },
];

function isRegisterMasked(addr: number): boolean {
  if (addr >= 0xd000 && addr <= 0xd3ff) {
    const canonical = 0xd000 + (addr & 0x3f);
    return IO_MASKED_CANONICAL.some(({ lo, hi }) => canonical >= lo && canonical <= hi);
  }
  return IO_MASKED_FLAT.some(({ lo, hi }) => addr >= lo && addr <= hi);
}

function isImageMasked(addr: number): boolean {
  return IMAGE_MASKED.some(({ lo, hi }) => addr >= lo && addr <= hi);
}

test("allowlist: every entry has a non-empty why", () => {
  const doc = loadAllowlistDoc();
  assert.ok(doc.entries.length > 0, "the allowlist must carry at least one entry");
  for (const entry of doc.entries) {
    assert.ok(
      typeof entry.why === "string" && entry.why.trim().length > 0,
      `entry ${entry.start}..${entry.endInclusive} has no non-empty why`,
    );
  }
});

test("allowlist: no entry's range intersects a masked span", () => {
  const doc = loadAllowlistDoc();
  for (const entry of doc.entries) {
    const domain = entry.domain === "register" ? "register" : "image";
    for (let addr = entry.start; addr <= entry.endInclusive; addr++) {
      const masked = domain === "register" ? isRegisterMasked(addr) : isImageMasked(addr);
      assert.equal(masked, false, `entry ${entry.start}..${entry.endInclusive} (${domain}) overlaps a masked span at ${addr}`);
    }
  }
});

test("allowlist: every register-domain entry names an address outside the narrowed mask", () => {
  const doc = loadAllowlistDoc();
  const registerEntries = doc.entries.filter((e) => e.domain === "register");
  assert.ok(registerEntries.length > 0, "the allowlist must carry at least one register-domain entry -- a .prg image carries no register state, so this is the only place those entries are exercised at all");
  for (const entry of registerEntries) {
    for (let addr = entry.start; addr <= entry.endInclusive; addr++) {
      assert.ok(addr >= 0xd000 && addr <= 0xd3ff, `register-domain entry address ${addr} must be a real VIC-II/SID/CIA register, inside $D000-$D3FF`);
      assert.equal(isRegisterMasked(addr), false, `register-domain entry address ${addr} is inside the narrowed mask -- it would be shadowed rather than meaningful`);
    }
  }
});

/** Lifts a committed `.prg`'s own payload into a fresh, zero-filled
 * 65536-byte buffer at its own load address -- never the raw `.prg` bytes,
 * which carry a two-byte little-endian load-address header
 * `compare-cross-binary.mjs` does not expect. */
function prgToImageBuffer(path: string): Buffer {
  const raw = readFileSync(path);
  const origin = raw[0]! | (raw[1]! << 8);
  const buf = Buffer.alloc(65536);
  raw.subarray(2).copy(buf, origin);
  return buf;
}

function runCrossBinary(argv: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [CROSS_BINARY_SCRIPT, "cross", ...argv], { encoding: "utf8", timeout: 30_000 });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

test("allowlist static proof: the committed pair passes with the allowlist and fails with --no-allowlist", () => {
  const dir = freshDir("allowlist-static-proof");
  const committedImagePath = join(dir, "committed.bin");
  const modifiedImagePath = join(dir, "modified.bin");
  writeFileSync(committedImagePath, prgToImageBuffer(join(FIXTURE_DIR, "hazard-subject.prg")));
  writeFileSync(modifiedImagePath, prgToImageBuffer(PRG_PATH));

  // WITH the committed allowlist: loading it must succeed (no refusal
  // printed to stderr), and the comparison must pass -- the allowlist's own
  // predicted entries must cover every real difference between the two
  // committed images.
  const withAllowlist = runCrossBinary([committedImagePath, modifiedImagePath, "--allowlist", ALLOWLIST_PATH]);
  assert.doesNotMatch(withAllowlist.stderr, /error:/, "the allowlist must load with zero refusals");
  assert.equal(withAllowlist.status, 0, `expected exit 0 with the allowlist, got ${withAllowlist.status}: ${withAllowlist.stderr}`);
  assert.match(withAllowlist.stdout, /^VERDICT: PASS$/m, "expected VERDICT: PASS with the allowlist");

  // WITHOUT it: the identical difference must fail -- proving the allowlist
  // is doing real work rather than being vacuously satisfied.
  const withoutAllowlist = runCrossBinary([committedImagePath, modifiedImagePath, "--no-allowlist"]);
  assert.equal(withoutAllowlist.status, 1, `expected exit 1 without the allowlist, got ${withoutAllowlist.status}`);
  assert.match(
    withoutAllowlist.stdout,
    /^VERDICT: FAIL$/m,
    "expected VERDICT: FAIL without the allowlist -- the same difference the allowlist covers must diverge without it",
  );
});
