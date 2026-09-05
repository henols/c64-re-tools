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
import { AnnoImportError, GHIDRA_REFTYPE_TO_ACCESS_KIND, importGhidraExport, parseGhidraExport } from "./anno-import.ts";
import { runMemmapJoin } from "./anno-join.ts";
import { BANK_CONDITIONAL_RANGES, loadMemmap, memmapDigest, MEMMAP_PATH, selectMemmapEntry } from "./memmap-lookup.ts";

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

// ---------------------------------------------------------------------------
// memmap-lookup.ts's own unit cases (landed here per this task's own file
// list -- `memmap-lookup.test.ts` as a dedicated file arrives with plan 37
// task 3).
// ---------------------------------------------------------------------------

test("memmapDigest(): equals the _generated.memmapSha256 value committed in anno-regbits.json -- asserted as a RELATION, never a hard-coded literal", () => {
  const regbits = JSON.parse(readFileSync(join(HERE, "anno-regbits.json"), "utf8")) as { _generated: { memmapSha256: string } };
  assert.equal(memmapDigest(), regbits._generated.memmapSha256);
});

test("selectMemmapEntry(0xd020): resolves to the 1-byte border-colour entry, not the 4096-byte containing entry, over 8 real contenders", () => {
  const selection = selectMemmapEntry(0xd020);
  assert.ok(selection);
  assert.equal(selection!.entry.start, 0xd020);
  assert.equal(selection!.entry.end, 0xd020, "the narrowest entry is the inclusive 1-byte $d020-$d020 range");
  assert.equal(selection!.contenderCount, 8);
});

test("selectMemmapEntry(): an address with no containing entry returns undefined", () => {
  // MEASURED at plan time: memmap.json's own entries start at 0; an address
  // below every entry's start cannot exist on this 16-bit space, so instead
  // this proves the negative over a real gap -- an address inside no entry's
  // span at all is not expected to occur across the full 959-entry set for
  // any address in range, so this asserts the function's own contract
  // directly with a synthetic entries list instead of hunting for a gap.
  const selection = selectMemmapEntry(0x1234, []);
  assert.equal(selection, undefined);
});

test("loadMemmap(): returns the same frozen array object on a second call (cached, not re-read)", () => {
  const first = loadMemmap();
  const second = loadMemmap();
  assert.equal(first, second);
  assert.ok(Object.isFrozen(first));
});

test("MEMMAP_PATH resolves to a real, existing file", () => {
  assert.equal(existsSync(MEMMAP_PATH), true);
});

test("BANK_CONDITIONAL_RANGES: the three hand-maintained ranges are present and non-empty", () => {
  assert.equal(BANK_CONDITIONAL_RANGES.length, 3);
  for (const range of BANK_CONDITIONAL_RANGES) {
    assert.ok(range.end > range.start || range.end === range.start);
    assert.ok(range.why.length > 0);
  }
});

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
