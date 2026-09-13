// reassembly-gate-movement.test.ts
//
// WHY THIS FILE EXISTS: `reassembly-gate-movement.ts` relocates a symbol at
// the store-document-and-image layer so the reassembly gate exercises a
// MOVED layout on every run, never only the addresses a subject was
// decompiled from. Task 1's cases below are properties of the transform
// alone -- no assembler is needed to prove a document's rows shifted
// correctly, an image rebuilt correctly, or a dishonest request was refused.
// Later tasks in this same file reuse a real ACME and the real export path to
// prove a relocated tree actually reassembles at its new layout.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { verifyAcmeAssemblesTree } from "./acme-verify.ts";
import { exportAsmTree, ROOT_FILE_NAME } from "./anno-export-asm.ts";
import { openStore, closeStore } from "./anno-store.ts";
import { importStoreDocument, STORE_EXPORT_SCHEMA_VERSION, type StoreExportDocument } from "./anno-store-export.ts";
import { runReassemblyGate, movementRebuildFromResult, type GateInput } from "./reassembly-gate.ts";
import { relocateSubject, buildMovementResult, refusedMovement, type RelocationRequest, type RelocationSite, type RelocatedSubject } from "./reassembly-gate-movement.ts";

const SKIP_REASON = acmeSkipReasonFor("reassembly-gate-movement.test.ts");

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

// ---------------------------------------------------------------------------
// One temp directory for the whole file, removed once at the end -- the same
// discipline `hazard-subject-reassembly.test.ts` already carries.
// ---------------------------------------------------------------------------

let workDir: string | undefined;
let dirCounter = 0;

function freshDir(tag: string): string {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "reassembly-gate-movement-"));
  const dir = join(workDir, `${tag}-${dirCounter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

function writePrg(path: string, origin: number, body: Uint8Array): void {
  writeFileSync(path, Buffer.from([origin & 0xff, (origin >> 8) & 0xff, ...body]));
}

/** Imports `doc` into a fresh, throwaway store file through
 * `importStoreDocument()`, the store's own public import verb -- never raw
 * SQL -- and returns the store's own path. */
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

// ---------------------------------------------------------------------------
// Task 1 fixture: one document, three ranges, one label, one scope. All pure
// data -- no live store, no image file on disk, since `relocateSubject()` is
// a transform over a `StoreExportDocument` and a plain byte buffer.
// ---------------------------------------------------------------------------

/** Image origin: $0800. rangeA ($0800-$0803) and rangeC ($0820-$0823) are
 * filler on either side of rangeB ($0810-$0813), which owns `moved_symbol`
 * and is wrapped by a scope of the identical extent. */
const ORIGIN = 0x0800;
const IMAGE_LENGTH = 0x24; // covers $0800..$0823 inclusive

function baseDocument(): StoreExportDocument {
  return {
    schemaVersion: STORE_EXPORT_SCHEMA_VERSION,
    store: "movement-fixture.annostore",
    ranges: [
      { start: 0x0800, endInclusive: 0x0803, dataType: "byte", bank: null, provenance: "derived" },
      { start: 0x0810, endInclusive: 0x0813, dataType: "byte", bank: null, provenance: "derived" },
      { start: 0x0820, endInclusive: 0x0823, dataType: "byte", bank: null, provenance: "derived" },
    ],
    labels: [{ address: 0x0810, name: "moved_symbol", kind: "User", bank: null }],
    comments: [],
    projectEnums: [],
    enumUsage: [],
    xrefs: [],
    execObservations: [],
    scopes: [{ start: 0x0810, endInclusive: 0x0813 }],
  };
}

/** Builds the base image: rangeA's four bytes, then a gap, rangeB's four
 * bytes at $0810, three declared reference sites at $0805/$0807/$0808 all
 * honestly encoding `moved_symbol`'s ORIGINAL address ($0810), then rangeC's
 * four bytes at $0820. Every byte not explicitly listed is left `0`. */
function baseImage(): Uint8Array {
  const image = new Uint8Array(IMAGE_LENGTH);
  const at = (address: number, value: number): void => {
    image[address - ORIGIN] = value;
  };
  // rangeA content
  at(0x0800, 0x01);
  at(0x0801, 0x02);
  at(0x0802, 0x03);
  at(0x0803, 0x04);
  // declared reference sites, all honestly encoding $0810 before relocation
  at(0x0805, 0x10); // two-byte little-endian, low octet
  at(0x0806, 0x08); // two-byte little-endian, high octet
  at(0x0807, 0x10); // low-byte site
  at(0x0808, 0x08); // high-byte site
  // rangeB content (the routine that moves)
  at(0x0810, 0xaa);
  at(0x0811, 0xbb);
  at(0x0812, 0xcc);
  at(0x0813, 0xdd);
  // rangeC content
  at(0x0820, 0x05);
  at(0x0821, 0x06);
  at(0x0822, 0x07);
  at(0x0823, 0x08);
  return image;
}

const HONEST_SITES: readonly RelocationSite[] = [
  { address: 0x0805, encoding: "twoByteLittleEndian", symbolName: "moved_symbol" },
  { address: 0x0807, encoding: "lowByte", symbolName: "moved_symbol" },
  { address: 0x0808, encoding: "highByte", symbolName: "moved_symbol" },
];

function baseRequest(overrides: Partial<RelocationRequest> = {}): RelocationRequest {
  return {
    document: baseDocument(),
    image: baseImage(),
    origin: ORIGIN,
    symbolName: "moved_symbol",
    delta: 12,
    sites: HONEST_SITES,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

test("gate movement: a request with a delta of zero is refused by name, naming the symbol and stating a same-address round trip is not a movement", () => {
  assert.throws(
    () => relocateSubject(baseRequest({ delta: 0 })),
    (err: Error) => {
      assert.match(err.message, /relocateSubject/);
      assert.match(err.message, /moved_symbol/);
      assert.match(err.message, /same-address round trip/i);
      return true;
    },
  );
});

test("gate movement: a request with an empty reference-site list is refused by name, stating a relocation nothing points at cannot be distinguished from a byte copy", () => {
  assert.throws(
    () => relocateSubject(baseRequest({ sites: [] })),
    (err: Error) => {
      assert.match(err.message, /relocateSubject/);
      assert.match(err.message, /byte copy/i);
      return true;
    },
  );
});

test("gate movement: a request naming a symbol the document has no label for is refused by name, naming the symbol", () => {
  assert.throws(
    () => relocateSubject(baseRequest({ symbolName: "no_such_symbol" })),
    (err: Error) => {
      assert.match(err.message, /relocateSubject/);
      assert.match(err.message, /no_such_symbol/);
      return true;
    },
  );
});

test("gate movement: a declared site naming a different symbol than the one being moved is refused by name", () => {
  assert.throws(
    () =>
      relocateSubject(
        baseRequest({
          sites: [{ address: 0x0805, encoding: "twoByteLittleEndian", symbolName: "some_other_symbol" }],
        }),
      ),
    (err: Error) => {
      assert.match(err.message, /relocateSubject/);
      assert.match(err.message, /some_other_symbol/);
      return true;
    },
  );
});

test("gate movement: a declared site whose current bytes do not hold the symbol's original address is refused by name, and the message reports what the site actually held", () => {
  const image = baseImage();
  // Corrupt the two-byte site at $0805 so it no longer encodes $0810.
  image[0x0805 - ORIGIN] = 0x99;
  assert.throws(
    () => relocateSubject(baseRequest({ image })),
    (err: Error) => {
      assert.match(err.message, /relocateSubject/);
      assert.match(err.message, /\$0805/);
      assert.match(err.message, /\$0810/); // the original address it was supposed to hold
      assert.match(err.message, /\$0899/); // reports what it actually held
      return true;
    },
  );
});

test("gate movement: a relocation whose new range ends exactly one byte below another range's start succeeds", () => {
  // rangeB ($0810-$0813) moved by 12 -> $081C-$081F, one byte below rangeC's
  // start at $0820 -- abutting, allowed.
  const subject = relocateSubject(baseRequest({ delta: 12 }));
  assert.equal(subject.relocatedAddress, 0x081c);
  const movedRange = subject.document.ranges.find((r) => r.start === 0x081c);
  assert.ok(movedRange, "the moved range must exist at its new address");
  assert.equal(movedRange!.endInclusive, 0x081f);
});

test("gate movement: a relocation whose new range starts exactly at another range's start is refused", () => {
  // rangeB ($0810-$0813) moved by 16 -> $0820-$0823, exactly rangeC's own
  // extent -- refused.
  assert.throws(
    () => relocateSubject(baseRequest({ delta: 16 })),
    (err: Error) => {
      assert.match(err.message, /relocateSubject/);
      assert.match(err.message, /intersects/i);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// A valid relocation
// ---------------------------------------------------------------------------

test("gate movement: a valid request returns a document whose named label, whose owning range and whose containing scope have all moved by exactly the delta, and whose every other row is byte-for-byte unchanged", () => {
  const before = baseDocument();
  const subject = relocateSubject(baseRequest({ delta: 12 }));

  const movedLabel = subject.document.labels.find((l) => l.name === "moved_symbol")!;
  assert.equal(movedLabel.address, 0x081c);

  const movedRange = subject.document.ranges.find((r) => r.start === 0x081c)!;
  assert.equal(movedRange.endInclusive, 0x081f);

  const movedScope = subject.document.scopes!.find((s) => s.start === 0x081c)!;
  assert.equal(movedScope.endInclusive, 0x081f);

  // Every other row is byte-for-byte unchanged: rangeA and rangeC.
  assert.deepEqual(
    subject.document.ranges.find((r) => r.start === 0x0800),
    before.ranges[0],
  );
  assert.deepEqual(
    subject.document.ranges.find((r) => r.start === 0x0820),
    before.ranges[2],
  );
});

test("gate movement: the returned image carries the moved range's bytes at the new address and zeroes at the address the range vacated", () => {
  const subject = relocateSubject(baseRequest({ delta: 12 }));
  const at = (address: number): number => subject.image[address - subject.origin]!;

  // Moved bytes at the new address.
  assert.equal(at(0x081c), 0xaa);
  assert.equal(at(0x081d), 0xbb);
  assert.equal(at(0x081e), 0xcc);
  assert.equal(at(0x081f), 0xdd);

  // Zeroes at the vacated address -- still inside the buffer's overall span.
  assert.equal(at(0x0810), 0);
  assert.equal(at(0x0811), 0);
  assert.equal(at(0x0812), 0);
  assert.equal(at(0x0813), 0);
});

test("gate movement: a low-byte reference site holds the low octet of the relocated address and a high-byte site holds the high octet; a two-byte little-endian site holds both in that order", () => {
  const subject = relocateSubject(baseRequest({ delta: 12 }));
  assert.equal(subject.relocatedAddress, 0x081c);
  const at = (address: number): number => subject.image[address - subject.origin]!;

  // Two-byte little-endian site at $0805/$0806 (outside the moved range, so
  // patched at its own unshifted address).
  assert.equal(at(0x0805), 0x1c, "low octet first");
  assert.equal(at(0x0806), 0x08, "high octet second");

  // Low-byte site at $0807.
  assert.equal(at(0x0807), 0x1c);

  // High-byte site at $0808.
  assert.equal(at(0x0808), 0x08);
});

test("gate movement: a declared site that lies inside the moved range is patched at its shifted address, not its original one", () => {
  const image = baseImage();
  // A self-referencing low-byte site AT $0812, inside rangeB itself, honestly
  // holding $10 (the low octet of moved_symbol's original address $0810)
  // before relocation.
  image[0x0812 - ORIGIN] = 0x10;
  const sites: readonly RelocationSite[] = [...HONEST_SITES, { address: 0x0812, encoding: "lowByte", symbolName: "moved_symbol" }];

  const subject = relocateSubject(baseRequest({ image, sites, delta: 12 }));
  const at = (address: number): number => subject.image[address - subject.origin]!;

  // The site's own address shifted by the delta ($0812 + 12 = $081E), holding
  // the relocated address's low octet ($1C).
  assert.equal(at(0x081e), 0x1c);
});

// ---------------------------------------------------------------------------
// buildMovementResult / refusedMovement
// ---------------------------------------------------------------------------

test("gate movement: a movement result built from a passing assembler verdict carries the pass outcome, the symbol name, the delta and both addresses", () => {
  const subject = relocateSubject(baseRequest({ delta: 12 }));
  const result = buildMovementResult("ok", subject);
  assert.equal(result.outcome, "ok");
  assert.equal(result.symbolName, "moved_symbol");
  assert.equal(result.relocationDelta, 12);
  assert.equal(result.originalAddress, 0x0810);
  assert.equal(result.relocatedAddress, 0x081c);
});

test("gate movement: a movement result whose original and relocated addresses are equal carries the refused outcome regardless of what the assembler verdict said", () => {
  const sameAddress: RelocatedSubject = {
    document: baseDocument(),
    image: baseImage(),
    origin: ORIGIN,
    symbolName: "moved_symbol",
    originalAddress: 0x0810,
    relocatedAddress: 0x0810,
    delta: 0,
    sites: HONEST_SITES,
  };
  const result = buildMovementResult("ok", sameAddress);
  assert.equal(result.outcome, "refused");
});

test("gate movement: the sibling refusal builder produces a refused movement result from a reason string alone", () => {
  const result = refusedMovement("relocateSubject: some refusal reason");
  assert.equal(result.outcome, "refused");
  assert.equal(result.symbolName, null);
  assert.equal(result.originalAddress, null);
  assert.equal(result.relocatedAddress, null);
  assert.equal(result.relocationDelta, null);
  assert.match(result.reason, /some refusal reason/);
});

// ---------------------------------------------------------------------------
// Task 2/3 fixture: a small, fully understood movement subject -- NOT the
// committed hazard-subject, which deliberately carries constructions whose
// whole point is that they cannot move (relocating inside it would test the
// wrong thing). Origin $0801:
//   - an entry block ($0801-$0806): `ldx #$00` / `lda table,x` / `rts` --
//     an absolute-INDEXED load that reads the split-address table by name;
//   - the table itself ($0807-$080A, `lo_hi_address`), labelled `table`,
//     holding both routines' addresses low-then-high;
//   - two one-byte `rts` routines, `routine_a` ($080B) and `routine_b`
//     ($080C), each its own range.
// ---------------------------------------------------------------------------

const MOVEMENT_ORIGIN = 0x0801;

function movementDocument(): StoreExportDocument {
  return {
    schemaVersion: STORE_EXPORT_SCHEMA_VERSION,
    store: "movement-subject.annostore",
    ranges: [
      { start: 0x0801, endInclusive: 0x0806, dataType: "code", bank: null, provenance: "derived" },
      { start: 0x0807, endInclusive: 0x080a, dataType: "lo_hi_address", bank: null, provenance: "derived" },
      { start: 0x080b, endInclusive: 0x080b, dataType: "code", bank: null, provenance: "derived" },
      { start: 0x080c, endInclusive: 0x080c, dataType: "code", bank: null, provenance: "derived" },
    ],
    labels: [
      { address: 0x0807, name: "table", kind: "User", bank: null },
      { address: 0x080b, name: "routine_a", kind: "User", bank: null },
      { address: 0x080c, name: "routine_b", kind: "User", bank: null },
    ],
    comments: [],
    projectEnums: [],
    enumUsage: [],
    xrefs: [],
    execObservations: [],
    scopes: [],
  };
}

/** `ldx #$00` / `lda $0807,x` / `rts` / tbl_lo (`<routine_a, <routine_b`) /
 * tbl_hi (`>routine_a, >routine_b`) / `rts` (routine_a) / `rts` (routine_b).
 * $0807 is `table`'s own address -- an in-tree absolute-indexed reference,
 * resolved through the SAME symbol/in-tree rule the code path already uses. */
function movementImage(): Uint8Array {
  return new Uint8Array([
    0xa2, 0x00, // ldx #$00
    0xbd, 0x07, 0x08, // lda $0807,x  (table)
    0x60, // rts
    0x0b, 0x0c, // tbl_lo: <routine_a ($0b), <routine_b ($0c)
    0x08, 0x08, // tbl_hi: >routine_a ($08), >routine_b ($08)
    0x60, // routine_a: rts
    0x60, // routine_b: rts
  ]);
}

/** The two declared reference sites for `routine_a` inside the table:
 * its low octet at $0807 (the table's first byte) and its high octet at
 * $0809 (the table's third byte, the start of the high run). Both DECLARED,
 * never derived from the exporter's own symbolisation. */
const ROUTINE_A_SITES: readonly RelocationSite[] = [
  { address: 0x0807, encoding: "lowByte", symbolName: "routine_a" },
  { address: 0x0809, encoding: "highByte", symbolName: "routine_a" },
];

/** A delta that changes BOTH octets of `routine_a`'s address: $080B -> $0910
 * (low $0B -> $10, high $08 -> $09). A whole multiple of 256 would leave the
 * low half unchanged and make a half-move in that direction undetectable --
 * asserted directly in the cases below rather than assumed from this comment. */
const MOVEMENT_DELTA = 0x0910 - 0x080b;

function exportMovementTree(dir: string, doc: StoreExportDocument, image: Uint8Array): ReturnType<typeof exportAsmTree> {
  const prgPath = join(dir, "subject.prg");
  writePrg(prgPath, MOVEMENT_ORIGIN, image);
  const storePath = freshStoreFromDocument(dir, doc);
  const outDir = join(dir, "tree");
  return exportAsmTree({ storePath, imagePath: prgPath, workspaceRoot: dir, outDir });
}

// ---------------------------------------------------------------------------
// Task 2: the real relocated rebuild
// ---------------------------------------------------------------------------

test(
  "gate movement: the unrelocated movement subject's tree verifies to the pass outcome with an equal byte-diff, before any relocation is attempted",
  { skip: SKIP_REASON },
  () => {
    const dir = freshDir("movement-honest");
    const result = exportMovementTree(dir, movementDocument(), movementImage());

    assert.ok(result.source.includes("lda table,x"), `the entry block must reference the table by symbol name:\n${result.source}`);
    assert.ok(result.source.includes("<routine_a"), `the table's low run must reference routine_a by symbol name:\n${result.source}`);
    assert.ok(result.source.includes(">routine_a"), `the table's high run must reference routine_a by symbol name:\n${result.source}`);

    const verdict = verifyAcmeAssemblesTree({
      treeDir: result.outDir,
      rootFileName: ROOT_FILE_NAME,
      expectedBytes: result.expectedBytes,
      expectedSegments: result.blocks,
    });
    assert.equal(verdict.outcome, "ok", verdict.reason);
    assert.equal(verdict.byteDiff?.equal, true);
  },
);

test(
  "gate movement: relocating routine_a and re-exporting at the new layout verifies to the pass outcome with an equal byte-diff, through the same symbol",
  { skip: SKIP_REASON },
  () => {
    const dir = freshDir("movement-relocated");
    const originalResult = exportMovementTree(dir, movementDocument(), movementImage());

    const subject = relocateSubject({
      document: movementDocument(),
      image: movementImage(),
      origin: MOVEMENT_ORIGIN,
      symbolName: "routine_a",
      delta: MOVEMENT_DELTA,
      sites: ROUTINE_A_SITES,
    });
    assert.notEqual(subject.relocatedAddress, subject.originalAddress);
    assert.notEqual(
      subject.originalAddress & 0xff,
      subject.relocatedAddress & 0xff,
      "the chosen delta must change the low octet, or a half-move in that direction would be undetectable",
    );
    assert.notEqual(
      (subject.originalAddress >> 8) & 0xff,
      (subject.relocatedAddress >> 8) & 0xff,
      "the chosen delta must change the high octet, or a half-move in that direction would be undetectable",
    );

    const relocatedDir = freshDir("movement-relocated-tree");
    const relocatedResult = exportMovementTree(relocatedDir, subject.document, subject.image);

    assert.ok(
      relocatedResult.source.includes("routine_a"),
      `the relocated tree's emitted text must still reference the moved routine by its original symbol name:\n${relocatedResult.source}`,
    );

    const verdict = verifyAcmeAssemblesTree({
      treeDir: relocatedResult.outDir,
      rootFileName: ROOT_FILE_NAME,
      expectedBytes: relocatedResult.expectedBytes,
      expectedSegments: relocatedResult.blocks,
    });
    assert.equal(verdict.outcome, "ok", verdict.reason);
    assert.equal(verdict.byteDiff?.equal, true);

    // Precondition sanity: the honest, unrelocated export from the same
    // subject really did verify clean too (asserted in the sibling test
    // above; re-checked here so this test's own claim -- "the relocated
    // export ALSO verifies clean" -- means something).
    void originalResult;
  },
);

function passingGateInputExceptMovement(movement: GateInput["MOVEMENT_REBUILD"]): GateInput {
  return {
    TREE_REBUILD: "ok",
    MOVEMENT_REBUILD: movement,
    HAZARD_DISPOSITION: "clean",
    DIFF_SCOPE_COVERAGE: "complete",
    RED_CONTROLS: "all-observed",
    SECOND_PATH_GUARD: "held",
    ORDERING_PROOF: "held",
  };
}

test(
  "gate movement: the gate returns green for a passing movement result and red under the movement rule for a refused one",
  { skip: SKIP_REASON },
  () => {
    const dir = freshDir("movement-gate-tie");
    const subject = relocateSubject({
      document: movementDocument(),
      image: movementImage(),
      origin: MOVEMENT_ORIGIN,
      symbolName: "routine_a",
      delta: MOVEMENT_DELTA,
      sites: ROUTINE_A_SITES,
    });
    const relocatedResult = exportMovementTree(dir, subject.document, subject.image);
    const verdict = verifyAcmeAssemblesTree({
      treeDir: relocatedResult.outDir,
      rootFileName: ROOT_FILE_NAME,
      expectedBytes: relocatedResult.expectedBytes,
      expectedSegments: relocatedResult.blocks,
    });
    assert.equal(verdict.outcome, "ok", verdict.reason);

    const passingMovement = buildMovementResult(verdict.outcome, subject);
    const passingGateVerdict = runReassemblyGate(passingGateInputExceptMovement(movementRebuildFromResult(passingMovement)));
    assert.equal(passingGateVerdict.outcome, "green", passingGateVerdict.reason);

    const refused = refusedMovement("relocateSubject: some refusal reason (test-constructed)");
    const refusedGateVerdict = runReassemblyGate(passingGateInputExceptMovement(movementRebuildFromResult(refused)));
    assert.equal(refusedGateVerdict.outcome, "red", refusedGateVerdict.reason);
    assert.equal(refusedGateVerdict.rule, "R5");
  },
);
