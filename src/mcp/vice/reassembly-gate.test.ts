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
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { verifyAcmeAssemblesTree } from "./acme-verify.ts";
import { exportAsmTree, ROOT_FILE_NAME, type ExportBlock } from "./anno-export-asm.ts";
import { openStore, closeStore } from "./anno-store.ts";
import { importStoreDocument, type StoreExportDocument } from "./anno-store-export.ts";
import type { ScopeRow } from "./anno-types.ts";
import {
  runReassemblyGate,
  movementRebuildFromResult,
  hazardCoverageOutsideDiffScope,
  type GateInput,
  type MovementResult,
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
// D49-E's own guard for this module: test-only, never published.
// ---------------------------------------------------------------------------

test("reassembly-gate.ts and reassembly-gate.test.ts are absent from package.json's files[] array (test-only, mechanically enforced)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(pkg.files.includes("reassembly-gate.ts"), false, "reassembly-gate.ts is a development/CI gate and must never ship");
  assert.equal(pkg.files.includes("reassembly-gate.test.ts"), false, "test files never ship");
});
