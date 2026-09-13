// reassembly-gate.test.ts
//
// WHY THIS FILE EXISTS: `reassembly-gate.ts` refuses to let a rebuild's
// verdict be judged rather than derived. That refusal is worthless unless
// every rule the committed rule table declares is actually exercised, in the
// document's own order, against the exact vocabulary the committed schema
// declares -- and unless the real byte-diff oracle from `acme-verify.ts`
// genuinely reaches this module's input, not a hand-rolled stand-in.
//
// TWO KINDS OF CASES. The pure-rule cases (behaviours 1-8 below) need no
// assembler at all: they drive `runReassemblyGate()` directly with literal
// inputs, proving the rule table's order and its absence handling. The two
// real-path cases (behaviours 9-10) reuse the committed hazard-subject
// fixture and the tree-aware entry point `acme-verify.ts` shipped in the
// plan before this one, so the gate's `TREE_REBUILD` input in at least one
// test traces back to a real assembler run rather than a literal the test
// author picked.
//
// STUBS OF THE PRODUCERS, NOT OF THE ARCHITECTURE. `GateInput`'s movement and
// hazard fields are simple tokens; a later plan's own modules
// (`reassembly-gate-movement.ts`, `reassembly-gate-ack.ts`) compute them for
// real. Every case here that needs one constructs it as an explicit literal,
// which is why replacing those literals with a real producer's output later
// changes no assertion in this file.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { verifyAcmeAssemblesTree } from "./acme-verify.ts";
import { exportAsmTree, ROOT_FILE_NAME, type ExportBlock } from "./anno-export-asm.ts";
import { openStore, closeStore } from "./anno-store.ts";
import { importStoreDocument, STORE_EXPORT_SCHEMA_VERSION, type StoreExportDocument, type StoreExportRangeRow } from "./anno-store-export.ts";
import type { ScopeRow } from "./anno-types.ts";
import { buildHazardReport, type HazardReport, type HazardFinding, type HazardRegionDisposition } from "./anno-hazard-report.ts";
import {
  runReassemblyGate,
  movementRebuildFromResult,
  hazardCoverageOutsideDiffScope,
  type GateInput,
  type MovementResult,
  type DiffScopeExtent,
} from "./reassembly-gate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKIP_REASON = acmeSkipReasonFor("reassembly-gate.test.ts");

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

// ---------------------------------------------------------------------------
// Fixture loading -- the SAME shapes `acme-verify.test.ts`'s own `gate tree:`
// cases already use, reused here rather than re-derived. Duplicated (never
// imported across these two test files, which is deliberate: neither ships,
// and a shared non-test module for this alone would be new surface for two
// call sites) exactly the way `ACME_VERIFY_ARGV_FLAGS`'s own sibling
// construction in `src/skills/acme-build/scripts/acme.mjs` is documented as a
// deliberate second copy in `acme-verify.ts`.
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(HERE, "fixtures", "hazard-subject");
const PRG_PATH = join(FIXTURE_DIR, "hazard-subject.prg");
const ANNOSTORE_PATH = join(FIXTURE_DIR, "hazard-subject.annostore.json");

let workDir: string | undefined;
let dirCounter = 0;

function freshDir(tag: string): string {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "reassembly-gate-"));
  const dir = join(workDir, `${tag}-${dirCounter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

/**
 * Reorders blocks into the order a REAL assembler reports them for a TREE --
 * file-inclusion order, never address order. See `acme-verify.test.ts`'s own
 * `blocksInTreeSourceOrder()` doc comment for the full reasoning (an unscoped
 * block sourced LAST can have the lowest address of all). Duplicated here on
 * the same terms as the fixture-loading shapes above.
 */
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

function exportSubjectTree(tag: string): { treeDir: string; result: ReturnType<typeof exportAsmTree> } {
  const dir = freshDir(tag);
  const storePath = join(dir, "hazard-subject.annostore");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    const doc = JSON.parse(readFileSync(ANNOSTORE_PATH, "utf8")) as StoreExportDocument;
    importStoreDocument(handle, doc);
  } finally {
    closeStore(handle);
  }
  const treeDir = join(dir, "tree");
  const result = exportAsmTree({ storePath, imagePath: PRG_PATH, workspaceRoot: dir, outDir: treeDir });
  return { treeDir, result };
}

// ---------------------------------------------------------------------------
// The pure-rule cases. No assembler, never skip-gated.
// ---------------------------------------------------------------------------

/** Every input at its passing value, `HAZARD_DISPOSITION: "clean"` -- the
 * ONE combination `runReassemblyGate()` may resolve to `"green"`. Every case
 * below starts here and corrupts exactly one field, so a failing assertion
 * names precisely which rule stopped firing where it should have. */
function passingInput(): GateInput {
  return {
    TREE_REBUILD: "ok",
    MOVEMENT_REBUILD: "ok",
    HAZARD_DISPOSITION: "clean",
    DIFF_SCOPE_COVERAGE: "complete",
    RED_CONTROLS: "all-observed",
    SECOND_PATH_GUARD: "held",
    ORDERING_PROOF: "held",
  };
}

test("gate tree: a fully passing input set with a clean hazard disposition returns the green outcome and records the all-inputs-passing rule's id", () => {
  const verdict = runReassemblyGate(passingInput());
  assert.equal(verdict.outcome, "green", verdict.reason);
  assert.equal(verdict.rule, "R11");
});

test("gate tree: the same input set with an acknowledged hazard disposition returns the acknowledged outcome and records the acknowledged-hazard rule's id", () => {
  const verdict = runReassemblyGate({ ...passingInput(), HAZARD_DISPOSITION: "acknowledged" });
  assert.equal(verdict.outcome, "acknowledged", verdict.reason);
  assert.equal(verdict.rule, "R10");
});

test("gate tree: a rebuild input carrying the no-assembler token returns red through the no-assembler rule, and never through a byte-comparison rule", () => {
  const verdict = runReassemblyGate({ ...passingInput(), TREE_REBUILD: "skipped" });
  assert.equal(verdict.outcome, "red", verdict.reason);
  assert.equal(verdict.rule, "R4");
  assert.notEqual(verdict.rule, "R6", "a skipped rebuild must never be read through the byte-comparison (failed) rule");
});

test("gate tree: a movement input carrying the refused token returns red through the movement rule, and a movement input whose relocation delta is zero is itself refused before the gate is reached", () => {
  const verdict = runReassemblyGate({ ...passingInput(), MOVEMENT_REBUILD: "refused" });
  assert.equal(verdict.outcome, "red", verdict.reason);
  assert.equal(verdict.rule, "R5");

  assert.equal(movementRebuildFromResult(null), "refused", "no movement input at all must derive to refused");
  const zeroDelta: MovementResult = {
    outcome: "ok",
    symbolName: "hazard_dispatch_entry",
    relocationDelta: 0,
    originalAddress: 0x0825,
    relocatedAddress: 0x0825,
    reason: "same-address round trip -- exercises nothing about a MOVED layout",
  };
  assert.equal(
    movementRebuildFromResult(zeroDelta),
    "refused",
    "a same-address round trip (relocationDelta 0) must derive to refused even though the oracle itself reported ok"
  );
});

test("gate tree: an incomplete diff-scope input returns red even when both rebuilds passed and the hazard disposition is clean", () => {
  const verdict = runReassemblyGate({ ...passingInput(), DIFF_SCOPE_COVERAGE: "incomplete" });
  assert.equal(verdict.outcome, "red", verdict.reason);
  assert.equal(verdict.rule, "R7");
});

test("gate tree: a red-controls input below the all-observed value returns red even when every other input is at its passing value", () => {
  const partial = runReassemblyGate({ ...passingInput(), RED_CONTROLS: "partial" });
  assert.equal(partial.outcome, "red", partial.reason);
  assert.equal(partial.rule, "R8");

  const none = runReassemblyGate({ ...passingInput(), RED_CONTROLS: "none" });
  assert.equal(none.outcome, "red", none.reason);
  assert.equal(none.rule, "R8");
});

test("gate tree: a breached ordering-proof input returns red through a rule that fires ahead of every byte-derived rule", () => {
  // TREE_REBUILD is ALSO corrupted here (a byte-derived rule's own trigger),
  // so a verdict recording anything other than R2 would prove the ordering
  // check does not actually run first.
  const verdict = runReassemblyGate({ ...passingInput(), ORDERING_PROOF: "breached", TREE_REBUILD: "failed" });
  assert.equal(verdict.outcome, "red", verdict.reason);
  assert.equal(verdict.rule, "R2", "R2 must fire ahead of R6 even though both inputs are individually red-worthy");
});

test("gate tree: an input object missing a required field at runtime returns red through the absence rule rather than throwing", () => {
  const broken = { ...passingInput() } as Partial<GateInput>;
  delete broken.HAZARD_DISPOSITION;
  let verdict: ReturnType<typeof runReassemblyGate> | undefined;
  assert.doesNotThrow(() => {
    verdict = runReassemblyGate(broken as GateInput);
  }, "a missing required field must resolve to a verdict, never throw");
  assert.equal(verdict?.outcome, "red");
  assert.equal(verdict?.rule, "R1");
});

test("gate tree: the diff-scope helper treats the extent's lower bound as inside and its exclusive upper bound as outside", () => {
  const extent = { start: 0x0800, endExclusive: 0x0810 };
  const insideBoth = {
    hazardClass: "self-modifying-code" as const,
    anchorAddress: 0x0800,
    blockedAddress: 0x080f,
    mechanism: "test-fixture",
    strength: "static-signature-only" as const,
    detail: "inside the extent on both ends",
    corroboration: "none" as const,
  };
  const anchorAtExclusiveUpperBound = { ...insideBoth, anchorAddress: 0x0810, blockedAddress: null };
  const { coverage, outside } = hazardCoverageOutsideDiffScope([insideBoth, anchorAtExclusiveUpperBound], extent);
  assert.equal(coverage, "incomplete", "the exclusive upper bound itself must count as OUTSIDE the extent");
  assert.equal(outside.length, 1);
  assert.equal(outside[0], anchorAtExclusiveUpperBound);

  const { coverage: coverageInsideOnly } = hazardCoverageOutsideDiffScope([insideBoth], extent);
  assert.equal(coverageInsideOnly, "complete", "a finding fully inside the extent must not be reported as outside it");
});

// ---------------------------------------------------------------------------
// The two real-path cases.
// ---------------------------------------------------------------------------

test(
  "gate tree: the real tracer path -- the committed subject's tree verified by the tree entry point, its outcome fed in as the rebuild input, the rest at passing literals -- returns green",
  { skip: SKIP_REASON },
  () => {
    const { treeDir, result } = exportSubjectTree("real-green");
    const rebuild = verifyAcmeAssemblesTree({
      treeDir,
      rootFileName: ROOT_FILE_NAME,
      expectedBytes: result.expectedBytes,
      expectedSegments: blocksInTreeSourceOrder(result),
    });
    assert.equal(rebuild.outcome, "ok", `the tree entry point must round-trip the committed subject: ${rebuild.reason}`);

    const verdict = runReassemblyGate({ ...passingInput(), TREE_REBUILD: rebuild.outcome });
    assert.equal(verdict.outcome, "green", verdict.reason);
    assert.equal(verdict.rule, "R11");
  }
);

test(
  "gate tree: the same real path with the assembler binary pointed at a path that does not exist returns red, and the recorded rule is the no-assembler one",
  () => {
    const { treeDir, result } = exportSubjectTree("real-no-assembler");
    const rebuild = verifyAcmeAssemblesTree({
      treeDir,
      rootFileName: ROOT_FILE_NAME,
      expectedBytes: result.expectedBytes,
      expectedSegments: blocksInTreeSourceOrder(result),
      acmeBin: join(tmpdir(), `reassembly-gate-does-not-exist-${process.pid}`),
    });
    assert.equal(rebuild.outcome, "skipped", `a nonexistent assembler binary must be skipped: ${rebuild.reason}`);

    const verdict = runReassemblyGate({ ...passingInput(), TREE_REBUILD: rebuild.outcome });
    assert.equal(verdict.outcome, "red", verdict.reason);
    assert.equal(verdict.rule, "R4");
  }
);

// ---------------------------------------------------------------------------
// gate red: the narrowed-scope control -- a clean byte-diff over a scope that
// stopped covering a hazard-anchored range.
//
// A small purpose-built subject (never the committed hazard-subject fixture
// above): a few dozen bytes carrying one detectable self-modification, one
// plain code block and one data block. The self-modification's WRITER
// instruction is stored as `byte`-typed data, never `code` -- the exporter's
// own in-tree-reference rule (`anno-export-asm.ts`'s `referencedAddress()` /
// `isInTree()`) treats ANY absolute- or zeropage-mode operand pointing at an
// address covered by some OTHER emitted range as a reference that must
// resolve through a store label, and this subject deliberately carries none.
// `buildHazardReport()` still finds the self-modification: it decodes the
// raw bytes independently of how the store types them, so the finding is
// real regardless of the writer's own dataType.
//
// The modified TARGET -- the finding's own anchor -- sits at the HIGHEST
// address of the subject's four ranges, deliberately: the export's own
// extent is `[minBlockStart, maxBlockEnd)`, and removing a MIDDLE range
// would leave that span unchanged (a gap is still spanned, per
// `anno-export-asm.ts`'s own $00-fill rule). Only removing the range at
// either END actually narrows the extent -- which is the whole point being
// pinned here: a clean byte-diff over a scope that quietly stopped covering
// the interesting range.
// ---------------------------------------------------------------------------

/** The origin the purpose-built subject loads at. */
const SCOPE_SUBJECT_ORIGIN = 0x0801;

/**
 * The subject's own bytes, laid out with NO gaps between any of its four
 * ranges (`SCOPE_SUBJECT_RANGES` below covers every one of these bytes
 * exactly once, contiguously):
 *
 *   $0801        nop                -- the plain code block
 *   $0802-$0804  8d 07 08           -- the modifier, stored as DATA ($0804
 *                                      is the last byte -- `sta $0807`,
 *                                      never disassembled, so its own
 *                                      operand never needs an in-tree label)
 *   $0805-$0806  00, 00             -- the unrelated data block
 *   $0807-$0808  a9 00              -- the modified target: a real decoded
 *                                      instruction (`lda #$00`) whose own
 *                                      address the modifier's raw bytes
 *                                      name, so the self-modifying-code
 *                                      detector reports an opcode-byte hit
 *                                      anchored here
 */
const SCOPE_SUBJECT_BYTES: Uint8Array = Uint8Array.from([
  0xea, // $0801 nop
  0x8d, 0x07, 0x08, // $0802 sta $0807 (raw bytes, exported as data)
  0x00, 0x00, // $0805 unrelated data
  0xa9, 0x00, // $0807 lda #$00 -- the modified target, the finding's anchor
]);

/** The finding's own anchor -- the modified target's address, the HIGHEST of
 * the subject's four ranges. Removing its range is what narrows the
 * export's own upper bound. */
const SCOPE_SUBJECT_TARGET_ADDRESS = 0x0807;

/** The subject's four ranges, contiguous and non-overlapping. The target
 * range (index 3, the highest address) is the one `narrowedScopeSubjectRanges()`
 * below removes for the red direction. */
const SCOPE_SUBJECT_RANGES: readonly StoreExportRangeRow[] = Object.freeze([
  Object.freeze({ start: 0x0801, endInclusive: 0x0801, dataType: "code" as const, bank: null, provenance: "derived" as const }),
  Object.freeze({ start: 0x0802, endInclusive: 0x0804, dataType: "byte" as const, bank: null, provenance: "derived" as const }),
  Object.freeze({ start: 0x0805, endInclusive: 0x0806, dataType: "byte" as const, bank: null, provenance: "derived" as const }),
  Object.freeze({ start: SCOPE_SUBJECT_TARGET_ADDRESS, endInclusive: 0x0808, dataType: "code" as const, bank: null, provenance: "derived" as const }),
]);

/** Every range EXCEPT the hazard-anchored one -- the narrowed direction's own
 * store document. */
function narrowedScopeSubjectRanges(): readonly StoreExportRangeRow[] {
  const narrowed = SCOPE_SUBJECT_RANGES.filter((r) => r.start !== SCOPE_SUBJECT_TARGET_ADDRESS);
  assert.equal(narrowed.length, SCOPE_SUBJECT_RANGES.length - 1, "exactly one range -- the hazard-anchored one -- must be removed");
  return narrowed;
}

/** Writes the subject's own bytes as a `.prg` (2-byte little-endian load
 * address then the payload), the same shape every other fixture in this
 * file already loads. */
function writeScopeSubjectImage(path: string): void {
  const header = Buffer.from([SCOPE_SUBJECT_ORIGIN & 0xff, (SCOPE_SUBJECT_ORIGIN >> 8) & 0xff]);
  writeFileSync(path, Buffer.concat([header, Buffer.from(SCOPE_SUBJECT_BYTES)]));
}

/** Imports a hand-built document (never `openStore`/`setDataType`, matching
 * this file's own "import a document" convention for the committed subject
 * above) carrying `ranges` over the subject's own bytes, then exports it as
 * a tree into a fresh directory. */
function exportScopeSubjectTree(tag: string, ranges: readonly StoreExportRangeRow[]): { treeDir: string; result: ReturnType<typeof exportAsmTree> } {
  const dir = freshDir(tag);
  const imagePath = join(dir, "scope-subject.prg");
  writeScopeSubjectImage(imagePath);
  const storePath = join(dir, "scope-subject.annostore");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    importStoreDocument(handle, {
      schemaVersion: STORE_EXPORT_SCHEMA_VERSION,
      store: "scope-subject",
      ranges: [...ranges],
      labels: [],
      comments: [],
      projectEnums: [],
      enumUsage: [],
      xrefs: [],
      execObservations: [],
      scopes: [],
    });
  } finally {
    closeStore(handle);
  }
  const treeDir = join(dir, "tree");
  const result = exportAsmTree({ storePath, imagePath, workspaceRoot: dir, outDir: treeDir });
  return { treeDir, result };
}

/** The real hazard report over the subject's raw bytes -- independent of
 * however a caller's store types them, matching `buildHazardReport()`'s own
 * contract. */
function scopeSubjectHazardReport(): HazardReport {
  return buildHazardReport({ bytes: SCOPE_SUBJECT_BYTES, origin: SCOPE_SUBJECT_ORIGIN });
}

/** The planted self-modifying-code finding, or `undefined` if the subject
 * stopped producing it. */
function scopeSubjectFinding(report: HazardReport): HazardFinding | undefined {
  return report.findings.find(
    (f) => f.hazardClass === "self-modifying-code" && f.mechanism === "store-target-in-instruction-opcode-byte" && f.anchorAddress === SCOPE_SUBJECT_TARGET_ADDRESS
  );
}

/** The export's own extent -- `[minBlockStart, maxBlockEnd)` -- computed
 * from the SAME fields `DECISION-RULE.md`'s own derivation reads: the first
 * (lowest-address) block's start, and that same start plus the byte-diff's
 * own expected length. `result.blocks` is ascending by start (`anno-export-
 * asm.ts`'s own contract), so `blocks[0]` is always the lowest. */
function fullExtentOf(result: { blocks: readonly ExportBlock[]; expectedBytes: Uint8Array }): DiffScopeExtent {
  const start = result.blocks[0]!.start;
  return { start, endExclusive: start + result.expectedBytes.length };
}

test("gate red: a purpose-built subject carrying one detectable self-modification produces a hazard report with a finding inside the full export's extent, and the scope check reports complete coverage", () => {
  const report = scopeSubjectHazardReport();
  const finding = scopeSubjectFinding(report);
  assert.ok(finding, `the purpose-built subject must produce the planted self-modifying-code finding; got ${JSON.stringify(report.findings)}`);

  const { result } = exportScopeSubjectTree("scope-honest", SCOPE_SUBJECT_RANGES);
  const extent = fullExtentOf(result);
  const { coverage, outside } = hazardCoverageOutsideDiffScope([finding!], extent);
  assert.equal(coverage, "complete", `the anchor at ${SCOPE_SUBJECT_TARGET_ADDRESS.toString(16)} must fall inside the full export's own extent ${JSON.stringify(extent)}`);
  assert.deepEqual(outside, []);
});

test(
  "gate red: the same subject exported from a store with the hazard-anchored range removed still assembles to an equal byte-diff, and the scope check reports incomplete naming that finding",
  { skip: SKIP_REASON },
  () => {
    const report = scopeSubjectHazardReport();
    const finding = scopeSubjectFinding(report);
    assert.ok(finding, "precondition: the planted finding must exist before its range is removed");

    const { treeDir, result } = exportScopeSubjectTree("scope-narrowed", narrowedScopeSubjectRanges());
    const verdict = verifyAcmeAssemblesTree({
      treeDir,
      rootFileName: ROOT_FILE_NAME,
      expectedBytes: result.expectedBytes,
      expectedSegments: blocksInTreeSourceOrder(result),
    });
    assert.equal(verdict.outcome, "ok", `the narrowed export must still assemble and byte-diff clean: ${verdict.reason}`);
    assert.equal(verdict.byteDiff?.equal, true, `nothing about the bytes changed by removing the range:\n${JSON.stringify(verdict.byteDiff)}`);

    const narrowedExtent = fullExtentOf(result);
    const { coverage, outside } = hazardCoverageOutsideDiffScope([finding!], narrowedExtent);
    assert.equal(
      coverage,
      "incomplete",
      `the narrowed extent ${JSON.stringify(narrowedExtent)} must no longer cover the anchor at ${SCOPE_SUBJECT_TARGET_ADDRESS.toString(16)}`
    );
    assert.equal(outside.length, 1);
    assert.equal(outside[0], finding);
  }
);

test("gate red: the gate returns red for the narrowed export under the diff-scope rule even though its rebuild input carries the pass outcome and its hazard disposition is clean", () => {
  const report = scopeSubjectHazardReport();
  const finding = scopeSubjectFinding(report);
  assert.ok(finding, "precondition: the planted finding must exist before its range is removed");

  const { result } = exportScopeSubjectTree("scope-narrowed-gate", narrowedScopeSubjectRanges());
  const narrowedExtent = fullExtentOf(result);
  const { coverage } = hazardCoverageOutsideDiffScope([finding!], narrowedExtent);
  assert.equal(coverage, "incomplete", "precondition: the narrowed extent must no longer cover the anchor");

  const verdict = runReassemblyGate({ ...passingInput(), DIFF_SCOPE_COVERAGE: coverage });
  assert.equal(verdict.outcome, "red", verdict.reason);
  assert.equal(verdict.rule, "R7", "the red must be attributable to the scope input alone -- TREE_REBUILD is still ok and HAZARD_DISPOSITION is still clean");
});

test("gate red: a finding whose anchor address equals the extent's exclusive upper bound is reported outside the scope", () => {
  const extent: DiffScopeExtent = { start: 0x0800, endExclusive: 0x0810 };
  const finding: HazardFinding = {
    hazardClass: "self-modifying-code",
    anchorAddress: 0x0810,
    blockedAddress: null,
    mechanism: "test-fixture",
    strength: "static-signature-only",
    detail: "at the exclusive upper bound",
    corroboration: "none",
  };
  const { coverage, outside } = hazardCoverageOutsideDiffScope([finding], extent);
  assert.equal(coverage, "incomplete", "the exclusive upper bound itself must count as OUTSIDE the extent");
  assert.equal(outside.length, 1);
  assert.equal(outside[0], finding);
});

test("gate red: a finding whose anchor address equals the extent's lower bound is reported inside the scope", () => {
  const extent: DiffScopeExtent = { start: 0x0800, endExclusive: 0x0810 };
  const finding: HazardFinding = {
    hazardClass: "self-modifying-code",
    anchorAddress: 0x0800,
    blockedAddress: null,
    mechanism: "test-fixture",
    strength: "static-signature-only",
    detail: "at the lower bound",
    corroboration: "none",
  };
  const { coverage, outside } = hazardCoverageOutsideDiffScope([finding], extent);
  assert.equal(coverage, "complete", "the lower bound itself must count as INSIDE the extent");
  assert.deepEqual(outside, []);
});

test("gate red: a report with zero findings but at least one undecided region is not reported as covered-and-clean; the undecided region is carried in the helper's output", () => {
  const extent: DiffScopeExtent = { start: 0x0800, endExclusive: 0x0810 };
  const undecided: HazardRegionDisposition = { start: 0x0805, endInclusive: 0x0806, outcome: "unclassified", reason: "test fixture -- no detector matched this region" };

  const { coverage, undecided: carried } = hazardCoverageOutsideDiffScope([], extent, [undecided]);
  assert.equal(coverage, "incomplete", "zero findings must not be read as covered-and-clean when an undecided region exists");
  assert.deepEqual(carried, [undecided], "the undecided region must be carried forward in the helper's own output, never silently dropped");

  const { coverage: cleanCoverage, undecided: noneCarried } = hazardCoverageOutsideDiffScope([], extent, []);
  assert.equal(cleanCoverage, "complete", "zero findings and zero undecided regions IS covered-and-clean -- the honest control for this case");
  assert.deepEqual(noneCarried, []);
});

test("gate red: a zero-length extent is refused by name rather than reported as complete", () => {
  assert.throws(
    () => hazardCoverageOutsideDiffScope([], { start: 0x0800, endExclusive: 0x0800 }),
    /hazardCoverageOutsideDiffScope: extent .* is empty or inverted/,
    "an empty extent cannot cover anything and must be refused as a caller error, never scored complete"
  );
  assert.throws(
    () => hazardCoverageOutsideDiffScope([], { start: 0x0800, endExclusive: 0x07ff }),
    /hazardCoverageOutsideDiffScope: extent .* is empty or inverted/,
    "an INVERTED extent (endExclusive below start) is refused on the same terms as a zero-length one"
  );
});

// ---------------------------------------------------------------------------
// This module's own guard: test-only, never published, mirroring the
// byte-diff oracle's identical absence assertion in acme-verify.test.ts.
// ---------------------------------------------------------------------------

test("reassembly-gate.ts and reassembly-gate.test.ts are absent from package.json's files[] array (test-only, mechanically enforced)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(pkg.files.includes("reassembly-gate.ts"), false, "reassembly-gate.ts is a development/CI gate and must never ship");
  assert.equal(pkg.files.includes("reassembly-gate.test.ts"), false, "test files never ship");
});
