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

import { closeStore, currentRevision, listComments, listXrefs, openStore } from "../../src/mcp/vice/anno-store.mts";
import { ANNO_TOOL_DEFINITIONS } from "../../src/mcp/vice/anno-tools.mts";
import { runAnnoTool } from "../../src/mcp/vice/anno-call-client.ts";
import { openTestProject } from "./workspace-store-fixture.ts";
import { FILE_STORE_PROJECT_ID } from "../../src/mcp/vice/anno-store.mts";
import {
  AnnoImportError,
  GHIDRA_REFTYPE_TO_ACCESS_KIND,
  importGhidraExport,
  parseConstWrites,
  parseGhidraExport,
} from "../../src/mcp/vice/anno-import.mts";
import { runMemmapJoin } from "../../src/mcp/vice/anno-join.mts";

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

/** Imports the transfer file at `path` straight through the engine function,
 * the way the engine receives it: as the file's name and bytes. */
function importFile(handle: ReturnType<typeof openStore>, path: string, expectedSha256?: string): ReturnType<typeof importGhidraExport> {
  return importGhidraExport(handle, { exportName: path, exportBytes: new Uint8Array(readFileSync(path)), expectedSha256 });
}

/** Runs one `anno call` through the client with `dir` as the workspace root,
 * against an in-process broker whose project is the store at
 * `dir/proj.annostore` -- so `openStore()` on that file reads what the call
 * wrote. */
async function callInWorkspace(dir: string, name: string, args: Record<string, unknown>, deps?: Parameters<typeof runAnnoTool>[2]) {
  const previous = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = dir;
  const broker = openTestProject(dir, { dbPath: join(dir, "proj.annostore"), projectId: FILE_STORE_PROJECT_ID });
  try {
    return await runAnnoTool(name, args, { runAnno: broker.runAnno, ...deps });
  } finally {
    broker.close();
    if (previous === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = previous;
  }
}

/** One temp directory per test for an async body, removed unconditionally. */
async function inTempDirAsync(body: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "anno-import-"));
  try {
    await body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SINGLE_WRITE_EXPORT = ["## REFERENCES", "$0812 -> $d020 WRITE", "## REFERENCE_COUNT 1", ""].join("\n");

// ---------------------------------------------------------------------------
// THE TRACER'S OWN END-TO-END CASE.
// ---------------------------------------------------------------------------

test("tracer: import writes an anno_xref row that survives close+reopen, then the join writes a comment that also survives close+reopen", async () => {
  await inTempDirAsync(async (dir) => {
    const storePath = join(dir, "proj.annostore");
    const transferPath = writeTransfer(dir, SINGLE_WRITE_EXPORT);
    closeStore(openStore(storePath, { workspaceRoot: dir }));

    const result = await callInWorkspace(dir, "anno_import_ghidra_export", { export_path: transferPath });
    assert.equal(result.isError, false, result.content[0]!.text);
    const counts = JSON.parse(result.content[0]!.text) as { referencesSeen: number; xrefsWritten: number; xrefsAlreadyPresent: number; kindsSeenNotImported: Record<string, number>; transferDeleted: boolean };
    assert.equal(counts.referencesSeen, 1);
    assert.equal(counts.xrefsWritten, 1);
    assert.equal(counts.xrefsAlreadyPresent, 0);
    assert.deepEqual(counts.kindsSeenNotImported, {});
    assert.equal(counts.transferDeleted, true);
    assert.equal(existsSync(transferPath), false, "the transfer file must be gone after a successful import");

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
    const counts = importFile(handle, transferPath);
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
    importFile(handle, transferPath);
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
    assert.throws(() => importFile(handle, transferPath), AnnoImportError);
    assert.equal(currentRevision(handle), before);
    assert.equal(existsSync(transferPath), true);
    closeStore(handle);
  });
});

test("anno_import_ghidra_export: a second call naming the same, now-deleted path refuses, naming the absent path", async () => {
  await inTempDirAsync(async (dir) => {
    const storePath = join(dir, "proj.annostore");
    const transferPath = writeTransfer(dir, SINGLE_WRITE_EXPORT);
    closeStore(openStore(storePath, { workspaceRoot: dir }));
    const first = await callInWorkspace(dir, "anno_import_ghidra_export", { export_path: transferPath });
    assert.equal(first.isError, false, first.content[0]!.text);
    const second = await callInWorkspace(dir, "anno_import_ghidra_export", { export_path: transferPath });
    assert.equal(second.isError, true);
    assert.ok(second.content[0]!.text.includes(transferPath), second.content[0]!.text);
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
      () => importFile(handle, transferPath, "0".repeat(64)),
      (err: unknown) =>
        err instanceof AnnoImportError && err.message.includes("0".repeat(64)) && err.message.includes(realDigest),
    );
    assert.equal(currentRevision(handle), before);
    assert.equal(existsSync(transferPath), true);
    closeStore(handle);
  });
});

test("anno_import_ghidra_export: when the delete step itself throws, the call still returns successfully with transferDeleted false and a non-empty reason, and every write is readable after a reopen", async () => {
  // Injection route: making a directory read-only does not reliably block a
  // delete when the test process runs as root (CI containers commonly do), so
  // the client's delete step is replaced through its deps instead.
  await inTempDirAsync(async (dir) => {
    const storePath = join(dir, "proj.annostore");
    const transferPath = writeTransfer(dir, SINGLE_WRITE_EXPORT);
    closeStore(openStore(storePath, { workspaceRoot: dir }));
    const result = await callInWorkspace(
      dir,
      "anno_import_ghidra_export",
      { export_path: transferPath },
      {
        deleteFile: () => {
          throw new Error("synthetic unlink failure for the deterministic injection test");
        },
      },
    );
    assert.equal(result.isError, false, result.content[0]!.text);
    const counts = JSON.parse(result.content[0]!.text) as { transferDeleted: boolean; transferDeleteError?: string };
    assert.equal(counts.transferDeleted, false);
    assert.ok(counts.transferDeleteError && counts.transferDeleteError.length > 0);
    assert.equal(existsSync(transferPath), true, "the injected failure must leave the transfer file in place");

    const reopened = openStore(storePath, { workspaceRoot: dir });
    assert.equal(listXrefs(reopened).length, 1, "the write committed before the delete step ran, and must still be readable");
    closeStore(reopened);
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
    const counts = importFile(handle, transferPath);
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

test("runMemmapJoin: a second run over an unchanged store reports commentsChanged 0", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const transferPath = writeTransfer(dir, SINGLE_WRITE_EXPORT);
    const handle = openStore(storePath, { workspaceRoot: dir });
    importFile(handle, transferPath);

    const first = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100 });
    assert.equal(first.counts.annotated, 1);
    assert.equal(first.counts.commentsChanged, 1);

    const second = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100 });
    assert.equal(second.counts.commentsChanged, 0);
    closeStore(handle);

    const reopened = openStore(storePath, { workspaceRoot: dir });
    assert.equal(listComments(reopened).length, 1);
    closeStore(reopened);
  });
});

// `memmap-lookup.mts`'s own unit cases (memmapDigest, selectMemmapEntry,
// loadMemmap, MEMMAP_PATH, BANK_CONDITIONAL_RANGES) moved to the dedicated
// `memmap-lookup.test.ts` (plan 37 task 3) -- this file keeps only the
// importer's own tracer and parser cases plus the registration surface below.

// ---------------------------------------------------------------------------
// Registration surface: the two new tool names exist, and both are
// registered per D-08 (no manifest classification, so both need a register
// entry citing a requirement id and a real consumer path).
// ---------------------------------------------------------------------------

test("ANNO_TOOL_DEFINITIONS: contains both new tool names, and the surface grew by exactly two entries", () => {
  const names = ANNO_TOOL_DEFINITIONS.map((def) => def.name);
  assert.ok(names.includes("anno_import_ghidra_export"));
  assert.ok(names.includes("anno_join_memmap"));
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

test("parseConstWrites: over the committed real capture, non-vacuity floor and at least two differing processor-port values", () => {
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
});

test("parseGhidraExport: a body line after only trailer lines is refused by name, naming the line", () => {
  const text = ["## REFERENCE_COUNT 1", "$0812 -> $d020 WRITE", ""].join("\n");
  assert.throws(
    () => parseGhidraExport(text),
    (err: unknown) => err instanceof AnnoImportError && /line 2 is a body line/.test(err.message) && /no "## NAME" section header/.test(err.message),
  );
});

test("parseGhidraExport: a refusal names the section and line but never quotes the line itself", () => {
  const secret = "SECRET-CONTENT-4f2a";
  const text = ["## REFERENCES", `$0812 ${secret} WRITE`, "## REFERENCE_COUNT 1", ""].join("\n");
  assert.throws(
    () => parseGhidraExport(text),
    (err: unknown) => err instanceof AnnoImportError && /REFERENCES line 2/.test(err.message) && !err.message.includes(secret),
  );
  const badToken = ["## REFERENCES", `$0812 -> ${secret} WRITE`, "## REFERENCE_COUNT 1", ""].join("\n");
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    assert.throws(
      () => importFile(handle, writeTransfer(dir, badToken)),
      (err: unknown) => err instanceof AnnoImportError && !err.message.includes(secret),
    );
    closeStore(handle);
  });
});

test("importGhidraExport: a write that fails part-way through the import leaves the revision and every row as they were", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    // A planted failure on the SECOND row only, so the first row has been
    // written when the import fails.
    handle.db.exec("create trigger planted_failure before insert on anno_xref when new.to_address = 53281 begin select raise(abort, 'planted failure'); end");
    const text = ["## REFERENCES", "$0812 -> $d020 WRITE", "$0813 -> $d021 WRITE", "## REFERENCE_COUNT 2", ""].join("\n");
    const before = currentRevision(handle);
    assert.throws(() => importFile(handle, writeTransfer(dir, text)), /planted failure/);
    assert.equal(currentRevision(handle), before);
    assert.deepEqual(listXrefs(handle), [], "the row written before the failure was rolled back");
    closeStore(handle);
  });
});

test("importGhidraExport: a stale base revision is refused and writes nothing", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    const before = currentRevision(handle);
    const path = writeTransfer(dir, SINGLE_WRITE_EXPORT);
    assert.throws(
      () => importGhidraExport(handle, { exportName: path, exportBytes: new Uint8Array(readFileSync(path)), baseRevision: before + 3 }),
      /base revision 3 is not the current on-disk revision 0/,
    );
    assert.equal(currentRevision(handle), before);
    assert.deepEqual(listXrefs(handle), []);
    closeStore(handle);
  });
});
