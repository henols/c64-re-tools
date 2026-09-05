// anno-import.test.ts -- Phase 37 plan 37-01's tracer: a host-written Ghidra
// export text file, imported by ONE tool-shaped call, produces `anno_xref`
// rows a later, separate store open reads back; a further call joins those
// rows against `memmap.json` and produces a comment row that ALSO survives a
// close-and-reopen. Plus the parser's own unit cases.
//
// Every temp directory is `mkdtempSync(join(tmpdir(), "anno-import-"))` torn
// down in a `finally` -- this host's `/tmp` is a RAM-backed filesystem whose
// ageing is disabled, so a leaked directory is leaked RAM (D-37-04). The
// transfer file is NEVER a committed fixture for the same reason: IMP-02
// deletes it, so a committed fixture would vanish on the first passing run.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closeStore, currentRevision, listComments, listXrefs, openStore } from "./anno-store.ts";
import { ANNO_TOOL_DEFINITIONS } from "./anno-tools.ts";
import { annoRegisterEntryFor } from "./anno-register.ts";
import {
  AnnoImportError,
  CONST_WRITE_WATCHED_ADDRESSES,
  GHIDRA_REFTYPE_TO_ACCESS_KIND,
  importGhidraExport,
  parseConstWrites,
  parseGhidraExport,
} from "./anno-import.ts";
import { runMemmapJoin } from "./anno-join.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** One temp directory per test, removed unconditionally -- mirrors
 * `anno-store.test.ts`'s own `inTempDir()`. */
function inTempDir(body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "anno-import-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Writes `text` as a transfer file inside `dir` and returns its path. */
function writeTransfer(dir: string, text: string, name = "export.txt"): string {
  const path = join(dir, name);
  writeFileSync(path, text, "utf8");
  return path;
}

const SINGLE_WRITE_EXPORT = ["## REFERENCES", "$0812 -> $d020 WRITE", "## REFERENCE_COUNT 1", ""].join("\n");

// ---------------------------------------------------------------------------
// THE TRACER'S OWN END-TO-END CASE.
// ---------------------------------------------------------------------------

test("tracer: import writes an anno_xref row that survives close+reopen, then the join writes a comment that also survives close+reopen", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const transferPath = writeTransfer(dir, SINGLE_WRITE_EXPORT);

    const handle = openStore(storePath, { workspaceRoot: dir });
    const counts = importGhidraExport(handle, { exportPath: transferPath });
    assert.equal(counts.referencesSeen, 1);
    assert.equal(counts.xrefsWritten, 1);
    assert.equal(counts.xrefsAlreadyPresent, 0);
    assert.deepEqual(counts.kindsSeenNotImported, {});
    assert.equal(counts.transferDeleted, true);
    assert.equal(existsSync(transferPath), false, "the transfer file must be gone after a successful import");
    closeStore(handle);

    // Read-back #1: a FRESH open, never the import call's own return value.
    const reopened1 = openStore(storePath, { workspaceRoot: dir });
    const xrefs = listXrefs(reopened1);
    assert.equal(xrefs.length, 1);
    assert.equal(xrefs[0]!.fromAddress, 0x0812);
    assert.equal(xrefs[0]!.toAddress, 0xd020);
    assert.equal(xrefs[0]!.accessKind, "WRITE");
    assert.equal(xrefs[0]!.bank, null, "every row this store writes today has bank null");

    // The join, over an image range that EXCLUDES $d020 so the address is
    // looked up in memmap.json rather than skipped as in-image.
    const { counts: joinCounts, decisions } = runMemmapJoin(reopened1, { imageOrigin: 0x0800, imageByteLength: 0x0100 });
    assert.equal(joinCounts.addressesConsidered, 1);
    assert.equal(joinCounts.annotated, 1);
    assert.equal(joinCounts.skippedInImage, 0);
    assert.equal(joinCounts.skippedNoMapEntry, 0);
    assert.equal(joinCounts.declined, 0);
    assert.equal(joinCounts.commentsChanged, 1);
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]!.address, 0xd020);
    assert.equal(decisions[0]!.outcome, "annotated");
    closeStore(reopened1);

    // Read-back #2: another fresh open, proving the comment landed in the
    // STORE and not merely in the join call's own returned text.
    const reopened2 = openStore(storePath, { workspaceRoot: dir });
    const comments = listComments(reopened2);
    assert.equal(comments.length, 1);
    assert.equal(comments[0]!.address, 0xd020);
    assert.equal(typeof comments[0]!.text, "string");
    assert.ok(comments[0]!.text.length > 0);
    closeStore(reopened2);
  });
});

// ---------------------------------------------------------------------------
// PARSER / IMPORTER UNIT CASES.
// ---------------------------------------------------------------------------

test("parseGhidraExport: a bare '## REFERENCES' header with zero body lines followed by '## REFERENCE_COUNT 0' is VALID", () => {
  const doc = parseGhidraExport(["## REFERENCES", "## REFERENCE_COUNT 0", ""].join("\n"));
  assert.deepEqual(doc.sections.get("REFERENCES"), []);
  assert.equal(doc.trailers.get("REFERENCE_COUNT"), "0");
});

test("parseGhidraExport: empty or whitespace-only text is refused as malformed", () => {
  assert.throws(() => parseGhidraExport(""), AnnoImportError);
  assert.throws(() => parseGhidraExport("   \n  \n"), AnnoImportError);
});

test("parseGhidraExport: a first non-blank line that is not a '## ' header is refused", () => {
  assert.throws(() => parseGhidraExport("$0816 -> $d020 WRITE\n"), AnnoImportError);
});

test("parseGhidraExport: a REFERENCES line with no '->' separator is refused, naming REFERENCES and the line number", () => {
  const text = ["## REFERENCES", "$0816 $d020 WRITE", "## REFERENCE_COUNT 1", ""].join("\n");
  assert.throws(
    () => parseGhidraExport(text),
    (err: unknown) => err instanceof AnnoImportError && /REFERENCES/.test(err.message) && /\b2\b/.test(err.message),
  );
});

test("parseGhidraExport: a REFERENCES line with four whitespace-separated tokens but the arrow out of position is refused", () => {
  const text = ["## REFERENCES", "$0816 $d020 -> WRITE", "## REFERENCE_COUNT 1", ""].join("\n");
  assert.throws(
    () => parseGhidraExport(text),
    (err: unknown) => err instanceof AnnoImportError && /REFERENCES/.test(err.message),
  );
});

test("parseGhidraExport: a REFERENCE_COUNT trailer disagreeing with the parsed body count refuses, naming both numbers", () => {
  const text = ["## REFERENCES", "$0812 -> $d020 WRITE", "$0813 -> $d021 WRITE", "## REFERENCE_COUNT 3", ""].join("\n");
  assert.throws(
    () => parseGhidraExport(text),
    (err: unknown) => err instanceof AnnoImportError && /3/.test(err.message) && /2/.test(err.message),
  );
});

test("importGhidraExport: a duplicate REFERENCES line dedupes to one row, reporting referencesSeen 2 / xrefsWritten 1 / xrefsAlreadyPresent 1", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const text = ["## REFERENCES", "$0812 -> $d020 WRITE", "$0812 -> $d020 WRITE", "## REFERENCE_COUNT 2", ""].join("\n");
    const transferPath = writeTransfer(dir, text);
    const handle = openStore(storePath, { workspaceRoot: dir });
    const counts = importGhidraExport(handle, { exportPath: transferPath });
    assert.equal(counts.referencesSeen, 2);
    assert.equal(counts.xrefsWritten, 1);
    assert.equal(counts.xrefsAlreadyPresent, 1);
    closeStore(handle);

    const reopened = openStore(storePath, { workspaceRoot: dir });
    assert.equal(listXrefs(reopened).length, 1);
    closeStore(reopened);
  });
});

test("importGhidraExport: adjacent-but-unequal target addresses produce two distinct rows, neither merged", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const text = ["## REFERENCES", "$0812 -> $d020 WRITE", "$0813 -> $d021 WRITE", "## REFERENCE_COUNT 2", ""].join("\n");
    const transferPath = writeTransfer(dir, text);
    const handle = openStore(storePath, { workspaceRoot: dir });
    importGhidraExport(handle, { exportPath: transferPath });
    closeStore(handle);

    const reopened = openStore(storePath, { workspaceRoot: dir });
    const xrefs = listXrefs(reopened).map((x) => x.toAddress).sort((a, b) => a - b);
    assert.deepEqual(xrefs, [0xd020, 0xd021]);
    closeStore(reopened);
  });
});

test("importGhidraExport: a zero-byte transfer file refuses, leaves currentRevision unchanged, and leaves the file on disk", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const transferPath = writeTransfer(dir, "");
    const handle = openStore(storePath, { workspaceRoot: dir });
    const before = currentRevision(handle);
    assert.throws(() => importGhidraExport(handle, { exportPath: transferPath }), AnnoImportError);
    assert.equal(currentRevision(handle), before);
    assert.equal(existsSync(transferPath), true);
    closeStore(handle);
  });
});

test("importGhidraExport: a second call naming the same, now-deleted path refuses, naming the absent path", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const transferPath = writeTransfer(dir, SINGLE_WRITE_EXPORT);
    const handle = openStore(storePath, { workspaceRoot: dir });
    importGhidraExport(handle, { exportPath: transferPath });
    assert.throws(
      () => importGhidraExport(handle, { exportPath: transferPath }),
      (err: unknown) => err instanceof AnnoImportError && err.message.includes(transferPath),
    );
    closeStore(handle);
  });
});

test("importGhidraExport: an expectedSha256 mismatch refuses, naming both digests, and writes/deletes nothing", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const transferPath = writeTransfer(dir, SINGLE_WRITE_EXPORT);
    const realDigest = createHash("sha256").update(readFileSync(transferPath)).digest("hex");
    const handle = openStore(storePath, { workspaceRoot: dir });
    const before = currentRevision(handle);
    assert.throws(
      () => importGhidraExport(handle, { exportPath: transferPath, expectedSha256: "0".repeat(64) }),
      (err: unknown) =>
        err instanceof AnnoImportError && err.message.includes("0".repeat(64)) && err.message.includes(realDigest),
    );
    assert.equal(currentRevision(handle), before);
    assert.equal(existsSync(transferPath), true);
    closeStore(handle);
  });
});

test("importGhidraExport: when the delete step itself throws, the call still returns successfully with transferDeleted false and a non-empty reason, and every write is readable after a reopen", () => {
  // Injection route (per this task's own action text): making a directory
  // read-only does not reliably block a delete when the test process runs
  // as root (CI containers commonly do), so the delete step is a
  // caller-supplied function here rather than a chmod-based fixture.
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const transferPath = writeTransfer(dir, SINGLE_WRITE_EXPORT);
    const handle = openStore(storePath, { workspaceRoot: dir });
    const counts = importGhidraExport(handle, {
      exportPath: transferPath,
      deleteFile: () => {
        throw new Error("synthetic unlink failure for the deterministic injection test");
      },
    });
    assert.equal(counts.transferDeleted, false);
    assert.ok(counts.transferDeleteError && counts.transferDeleteError.length > 0);
    assert.equal(existsSync(transferPath), true, "the injected failure must leave the transfer file in place");
    closeStore(handle);

    const reopened = openStore(storePath, { workspaceRoot: dir });
    assert.equal(listXrefs(reopened).length, 1, "the write committed before the delete step ran, and must still be readable");
    closeStore(reopened);
  });
});

test("importGhidraExport: two byte-identical transfer files into two fresh stores produce element-wise-equal listXrefs() sequences, in file order", () => {
  const text = ["## REFERENCES", "$0900 -> $d020 WRITE", "$0901 -> $d021 READ", "## REFERENCE_COUNT 2", ""].join("\n");
  inTempDir((dirA) => {
    inTempDir((dirB) => {
      const pathA = join(dirA, "proj.annostore");
      const pathB = join(dirB, "proj.annostore");
      const transferA = writeTransfer(dirA, text);
      const transferB = writeTransfer(dirB, text);

      const handleA = openStore(pathA, { workspaceRoot: dirA });
      importGhidraExport(handleA, { exportPath: transferA });
      closeStore(handleA);

      const handleB = openStore(pathB, { workspaceRoot: dirB });
      importGhidraExport(handleB, { exportPath: transferB });
      closeStore(handleB);

      const reopenedA = openStore(pathA, { workspaceRoot: dirA });
      const reopenedB = openStore(pathB, { workspaceRoot: dirB });
      const rowsA = listXrefs(reopenedA).map((r) => ({ fromAddress: r.fromAddress, toAddress: r.toAddress, accessKind: r.accessKind }));
      const rowsB = listXrefs(reopenedB).map((r) => ({ fromAddress: r.fromAddress, toAddress: r.toAddress, accessKind: r.accessKind }));
      assert.deepEqual(rowsA, rowsB);
      closeStore(reopenedA);
      closeStore(reopenedB);
    });
  });
});

test("GHIDRA_REFTYPE_TO_ACCESS_KIND: an unrecognised kind is dropped and counted, never refused; COMPUTED_CALL maps onto COMPUTED_JUMP", () => {
  assert.equal(GHIDRA_REFTYPE_TO_ACCESS_KIND.COMPUTED_CALL, "COMPUTED_JUMP");
  assert.equal(GHIDRA_REFTYPE_TO_ACCESS_KIND.UNCONDITIONAL_JUMP, undefined);

  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const text = [
      "## REFERENCES",
      "$0812 -> $0900 UNCONDITIONAL_JUMP",
      "$0813 -> $d021 COMPUTED_CALL",
      "## REFERENCE_COUNT 2",
      "",
    ].join("\n");
    const transferPath = writeTransfer(dir, text);
    const handle = openStore(storePath, { workspaceRoot: dir });
    const counts = importGhidraExport(handle, { exportPath: transferPath });
    assert.equal(counts.kindsSeenNotImported.UNCONDITIONAL_JUMP, 1);
    closeStore(handle);

    const reopened = openStore(storePath, { workspaceRoot: dir });
    const xrefs = listXrefs(reopened);
    assert.equal(xrefs.length, 1);
    assert.equal(xrefs[0]!.toAddress, 0xd021);
    assert.equal(xrefs[0]!.accessKind, "COMPUTED_JUMP");
    closeStore(reopened);
  });
});

test("runMemmapJoin: run twice over an unchanged store reports commentsChanged 0 on the second run, with the same annotated count", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const transferPath = writeTransfer(dir, SINGLE_WRITE_EXPORT);
    const handle = openStore(storePath, { workspaceRoot: dir });
    importGhidraExport(handle, { exportPath: transferPath });

    const first = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100 });
    assert.equal(first.counts.annotated, 1);
    assert.equal(first.counts.commentsChanged, 1);

    const second = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100 });
    assert.equal(second.counts.annotated, first.counts.annotated);
    assert.equal(second.counts.commentsChanged, 0);
    closeStore(handle);

    const reopened = openStore(storePath, { workspaceRoot: dir });
    assert.equal(listComments(reopened).length, 1);
    closeStore(reopened);
  });
});

// `memmap-lookup.ts`'s own unit cases (memmapDigest, selectMemmapEntry,
// loadMemmap, MEMMAP_PATH, BANK_CONDITIONAL_RANGES) moved to the dedicated
// `memmap-lookup.test.ts` (plan 37 task 3) -- this file keeps only the
// importer's own tracer and parser cases plus the registration surface below.

// ---------------------------------------------------------------------------
// Registration surface: the two new tool names exist, and both are
// registered per D-08 (no manifest classification, so both need a register
// entry citing a real requirement id and a real consumer path).
// ---------------------------------------------------------------------------

test("ANNO_TOOL_DEFINITIONS: contains both new tool names, and the surface grew by exactly two entries", () => {
  const names = ANNO_TOOL_DEFINITIONS.map((def) => def.name);
  assert.ok(names.includes("anno_import_ghidra_export"));
  assert.ok(names.includes("anno_join_memmap"));
});

test("annoRegisterEntryFor(): both new tools have a register entry citing a real consumer path and a declared requirement id", () => {
  const requirementsText = readFileSync(join(HERE, "..", "..", "..", ".planning", "REQUIREMENTS.md"), "utf8");
  for (const verb of ["anno_import_ghidra_export", "anno_join_memmap"]) {
    const entry = annoRegisterEntryFor(verb);
    assert.ok(entry, `${verb} has no register entry`);
    assert.ok(entry!.consumers.length > 0, `${verb}'s register entry cites no consumer`);
    assert.ok(entry!.requirements.length > 0, `${verb}'s register entry cites no requirement id`);
    for (const consumer of entry!.consumers) {
      const consumerPath = join(HERE, "..", "..", "..", consumer.path);
      assert.ok(existsSync(consumerPath), `${verb}'s cited consumer path does not exist: ${consumer.path}`);
    }
    for (const reqId of entry!.requirements) {
      assert.ok(requirementsText.includes(reqId), `${verb} cites requirement ${reqId}, not found in REQUIREMENTS.md`);
    }
  }
});

// ---------------------------------------------------------------------------
// Plan 37-02 (AUTO-04, AUTO-05): `parseConstWrites()` over hand-built
// documents, plus the committed real-capture non-vacuity/reproducibility
// cases. See `fixtures/ghidra/README.md` for the capture's own provenance
// (a real `.prg`-route `analyzeHeadless` run, chosen over the flat-64K
// route to match every other committed export/run-log fixture's size --
// that README also records the `.prg` route's own internal-`jsr` defect
// this fixture's live tests (`ghidra-live.test.ts`) work around).
// ---------------------------------------------------------------------------

const CONST_WRITES_CAPTURE_PATH = join(HERE, "fixtures", "ghidra", "export-bank-path-dependent.txt");

/** Non-vacuity floor (Task 3's own instruction): a truncated or emptied
 * committed capture must fail HERE, not pass every case below trivially. */
const CONST_WRITES_CAPTURE_MIN_LINES = 4000;
const CONST_WRITES_CAPTURE_MIN_FACTS = 3;

test("CONST_WRITE_WATCHED_ADDRESSES: holds the same four addresses as the Java constant, in the TypeScript module", () => {
  assert.deepEqual([...CONST_WRITE_WATCHED_ADDRESSES].sort((a, b) => a - b), [0x0001, 0xd011, 0xd018, 0xdd00]);
});

test("parseConstWrites: one fact per body line, all three fields numbers", () => {
  const text = ["## CONST_WRITES", "$0815 $0001 $34", "$081c $0001 $33", "## CONST_WRITES_COUNT 2", ""].join("\n");
  const doc = parseGhidraExport(text);
  const facts = parseConstWrites(doc);
  assert.deepEqual(facts, [
    { storeAddress: 0x0815, targetAddress: 0x0001, value: 0x34 },
    { storeAddress: 0x081c, targetAddress: 0x0001, value: 0x33 },
  ]);
  for (const fact of facts) {
    assert.equal(typeof fact.storeAddress, "number");
    assert.equal(typeof fact.targetAddress, "number");
    assert.equal(typeof fact.value, "number");
  }
});

test("parseConstWrites: a section carrying only ## CONST_WRITES_NONE yields an empty array, not an error", () => {
  const text = ["## CONST_WRITES", "## CONST_WRITES_NONE", "## CONST_WRITES_COUNT 0", ""].join("\n");
  const doc = parseGhidraExport(text);
  assert.deepEqual(parseConstWrites(doc), []);
});

test("parseConstWrites: a document that never mentions CONST_WRITES at all yields an empty array, not an error", () => {
  const doc = parseGhidraExport(["## REFERENCES", "## REFERENCE_COUNT 0", ""].join("\n"));
  assert.deepEqual(parseConstWrites(doc), []);
});

test("parseConstWrites: a body line whose token count is not three throws the importer's named error, naming the section and the 1-based line number", () => {
  const text = ["## CONST_WRITES", "$0815 $0001 $34", "$081c $0001", "## CONST_WRITES_COUNT 2", ""].join("\n");
  const doc = parseGhidraExport(text);
  assert.throws(
    () => parseConstWrites(doc),
    (err: unknown) => err instanceof AnnoImportError && /CONST_WRITES/.test(err.message) && /\b2\b/.test(err.message),
  );
});

test("parseConstWrites: a value token that is not a resolvable constant refuses by name, never substituting a default", () => {
  const text = ["## CONST_WRITES", "$0815 $0001 not-a-number", "## CONST_WRITES_COUNT 1", ""].join("\n");
  const doc = parseGhidraExport(text);
  assert.throws(() => parseConstWrites(doc));
});

test("parseGhidraExport: a CONST_WRITES_COUNT trailer disagreeing with the parsed body count refuses at parse time, naming both numbers", () => {
  const text = [
    "## CONST_WRITES",
    "$0815 $0001 $34",
    "$081c $0001 $33",
    "$0823 $0001 $37",
    "## CONST_WRITES_COUNT 5",
    "",
  ].join("\n");
  assert.throws(
    () => parseGhidraExport(text),
    (err: unknown) => err instanceof AnnoImportError && /5/.test(err.message) && /3/.test(err.message),
  );
});

test("parseConstWrites: over the committed real capture, non-vacuity floor, at least two differing processor-port values, and element-wise-equal on a second parse", () => {
  const captureText = readFileSync(CONST_WRITES_CAPTURE_PATH, "utf8");
  const lineCount = captureText.split("\n").length;
  assert.ok(
    lineCount >= CONST_WRITES_CAPTURE_MIN_LINES,
    `export-bank-path-dependent.txt must carry at least ${CONST_WRITES_CAPTURE_MIN_LINES} lines; got ${lineCount} -- a truncated fixture must fail here, not pass every case below trivially`,
  );

  const doc = parseGhidraExport(captureText);
  const facts = parseConstWrites(doc);
  assert.ok(
    facts.length >= CONST_WRITES_CAPTURE_MIN_FACTS,
    `expected at least ${CONST_WRITES_CAPTURE_MIN_FACTS} CONST_WRITES facts in the committed capture; got ${facts.length}`,
  );

  const portFacts = facts.filter((f) => f.targetAddress === 0x0001);
  const distinctValues = new Set(portFacts.map((f) => f.value));
  assert.ok(
    portFacts.length >= 2 && distinctValues.size >= 2,
    `expected at least two processor-port facts with at least two distinct values; got ${JSON.stringify(portFacts)}`,
  );

  const facts2 = parseConstWrites(parseGhidraExport(captureText));
  assert.deepEqual(facts, facts2, "parsing the same committed capture twice must return element-wise-equal arrays");
});
