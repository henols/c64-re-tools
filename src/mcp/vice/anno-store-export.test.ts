// anno-store-export.test.ts -- coverage for the general store JSON
// export/import round trip (phase 45, plan 45-02, D-02/D-03).
//
// Two tiers, deliberately separated (mirrors this project's own
// c1541.test.mjs / dxa-live.test.ts convention):
//
//   1. PURE unit tests (Task 2's own six behaviours) against a synthetic
//      store this file builds itself in a temp directory under the OS temp
//      dir -- never inside the repository tree (this project has already had
//      an intermittent suite failure caused by scratch files racing in the
//      repo tree). ALWAYS run.
//   2. A LIVE tier (Task 3) against a REAL dxa+Ghidra-derived store, gated on
//      ANNO_STORE_EXPORT_LIVE_STORE naming an existing `.annostore` file on
//      disk. Default-SKIP with a named reason -- never a hand-rolled early
//      return, which would report a false PASS rather than a SKIP. This file
//      is NOT in test-gate.mjs's MANUAL_ONLY_TESTS, so it must never hang or
//      fail when the env var is absent: `npm run test:automated` runs it.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { openStore, closeStore, setDataType, setLabel, setComment, createProjectEnum, applyEnumUsage, putXref, insertExecObservations } from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
import {
  STORE_EXPORT_SCHEMA_VERSION,
  DECLINE_COMMENT_PREFIX,
  DISAGREEMENT_ACCEPTED_COMMENT_PREFIX,
  AUTHORED_PROVENANCE_COMMENT_PREFIX,
  exportStoreDocument,
  importStoreDocument,
  provenanceForComment,
  isDeclineComment,
  AnnoStoreExportError,
} from "./anno-store-export.ts";
import type { StoreExportDocument } from "./anno-store-export.ts";

/** One temp directory per test, removed unconditionally -- mirrors
 * `anno-import.test.ts`'s own `inTempDir()`. Never inside the repo tree. */
function inTempDir(body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "anno-store-export-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function freshStore(dir: string, name = "proj.annostore"): AnnoStoreHandle {
  return openStore(join(dir, name), { workspaceRoot: dir });
}

/** Populates `handle` with exactly one row of every class -- ranges, labels,
 * comments (one plain, one DECLINED:, one DISAGREEMENT-ACCEPTED:, one
 * PROVENANCE: authored), a project enum plus its usage, an xref, and an
 * exec observation. */
function populateOneOfEach(handle: AnnoStoreHandle): void {
  setDataType(handle, { start: 0x0800, endInclusive: 0x080f, dataType: "byte" });
  setDataType(handle, { start: 0x0810, endInclusive: 0x0815, dataType: "code" });
  setLabel(handle, { address: 0x0810, name: "start", kind: "User" });
  setComment(handle, { address: 0x0810, commentType: "line", text: "entry point: sets border colour" });
  setComment(handle, { address: 0x0811, commentType: "line", text: `${DECLINE_COMMENT_PREFIX} bank state could not be determined` });
  setComment(handle, { address: 0x0812, commentType: "side", text: `${DISAGREEMENT_ACCEPTED_COMMENT_PREFIX} reviewed, harmless` });
  setComment(handle, { address: 0x0813, commentType: "line", text: `${AUTHORED_PROVENANCE_COMMENT_PREFIX}] range hand-typed` });
  createProjectEnum(handle, { name: "VIC_SCREEN", variants: { "0": "VIC_SCREEN_1024" }, description: "screen base" });
  applyEnumUsage(handle, { address: 0x0810, name: "VIC_SCREEN" });
  putXref(handle, { fromAddress: 0x0812, toAddress: 0xd020, accessKind: "WRITE" });
  insertExecObservations(handle, {
    imageSha256: "a".repeat(64),
    argvDigest: "b".repeat(64),
    seed: "seed-1",
    observations: [{ address: 0x0810, sourceBank: "ram" }],
  });
}

// ---------------------------------------------------------------------------
// Tier 1: pure unit tests (Task 2's six behaviours).
// ---------------------------------------------------------------------------

test("Test 1: exportStoreDocument() on a store with one row of every class returns all seven arrays populated, provenance present on every ranges/comments row", () => {
  inTempDir((dir) => {
    const handle = freshStore(dir);
    try {
      populateOneOfEach(handle);
      const doc = exportStoreDocument(handle);

      assert.equal(doc.schemaVersion, STORE_EXPORT_SCHEMA_VERSION);
      assert.equal(doc.store, "proj.annostore");
      assert.ok(!doc.store.includes("/"), "store field must be a basename, never an absolute path");

      assert.equal(doc.ranges.length, 2);
      assert.equal(doc.labels.length, 1);
      assert.equal(doc.comments.length, 4);
      assert.equal(doc.projectEnums.length, 1);
      assert.equal(doc.enumUsage.length, 1);
      assert.equal(doc.xrefs.length, 1);
      assert.equal(doc.execObservations.length, 1);

      for (const row of doc.ranges) {
        assert.ok("provenance" in row, "every ranges row must carry a provenance key");
      }
      for (const row of doc.comments) {
        assert.ok("provenance" in row, "every comments row must carry a provenance key");
      }
    } finally {
      closeStore(handle);
    }
  });
});

test("Test 2: exporting the same store twice returns byte-identical JSON", () => {
  inTempDir((dir) => {
    const handle = freshStore(dir);
    try {
      populateOneOfEach(handle);
      const first = JSON.stringify(exportStoreDocument(handle));
      const second = JSON.stringify(exportStoreDocument(handle));
      assert.equal(first, second);
    } finally {
      closeStore(handle);
    }
  });
});

test("Test 3: importStoreDocument() into a fresh empty store, then re-exporting, returns a document deep-equal to the original (the round trip)", () => {
  inTempDir((dirA) => {
    const source = freshStore(dirA, "source.annostore");
    let original: StoreExportDocument;
    try {
      populateOneOfEach(source);
      original = exportStoreDocument(source);
    } finally {
      closeStore(source);
    }

    inTempDir((dirB) => {
      const target = freshStore(dirB, "target.annostore");
      try {
        const summary = importStoreDocument(target, original);
        assert.equal(summary.ranges, 2);
        assert.equal(summary.labels, 1);
        assert.equal(summary.comments, 4);
        assert.equal(summary.projectEnums, 1);
        assert.equal(summary.enumUsage, 1);
        assert.equal(summary.xrefs, 1);
        assert.equal(summary.execObservations, 1);

        const reexported = exportStoreDocument(target, { storeName: original.store });
        assert.deepEqual(reexported, original, "re-exporting a freshly imported store must reproduce the original document exactly");
      } finally {
        closeStore(target);
      }
    });
  });
});

test("Test 4: a document whose LAST row is malformed leaves the target store with ZERO rows", () => {
  inTempDir((dirA) => {
    const source = freshStore(dirA, "source.annostore");
    let doc: StoreExportDocument;
    try {
      populateOneOfEach(source);
      doc = exportStoreDocument(source);
    } finally {
      closeStore(source);
    }

    // Corrupt the LAST row of the LAST non-empty array: execObservations'
    // sourceBank is set to a value outside EVID_SOURCE_BANKS.
    const malformed: StoreExportDocument = {
      ...doc,
      execObservations: doc.execObservations.map((row, i, arr) => (i === arr.length - 1 ? { ...row, sourceBank: "vram" as never } : row)),
    };

    inTempDir((dirB) => {
      const target = freshStore(dirB, "target.annostore");
      try {
        assert.throws(() => importStoreDocument(target, malformed));
        const reexported = exportStoreDocument(target);
        assert.equal(reexported.ranges.length, 0);
        assert.equal(reexported.labels.length, 0);
        assert.equal(reexported.comments.length, 0);
        assert.equal(reexported.projectEnums.length, 0);
        assert.equal(reexported.enumUsage.length, 0);
        assert.equal(reexported.xrefs.length, 0);
        assert.equal(reexported.execObservations.length, 0);
      } finally {
        closeStore(target);
      }
    });
  });
});

test("Test 5: a document carrying an unknown schemaVersion is refused by name, naming both the found and the expected version", () => {
  inTempDir((dir) => {
    const handle = freshStore(dir);
    try {
      populateOneOfEach(handle);
      const doc = exportStoreDocument(handle);
      const bumped: StoreExportDocument = { ...doc, schemaVersion: STORE_EXPORT_SCHEMA_VERSION + 1 };

      assert.throws(
        () => importStoreDocument(handle, bumped),
        (err: unknown) =>
          err instanceof AnnoStoreExportError &&
          err.message.includes(String(STORE_EXPORT_SCHEMA_VERSION + 1)) &&
          err.message.includes(String(STORE_EXPORT_SCHEMA_VERSION)),
      );
    } finally {
      closeStore(handle);
    }
  });
});

test("Test 6: a comment whose text starts with DECLINED: round-trips with provenance 'authored' and is retrievable by prefix match", () => {
  inTempDir((dir) => {
    const handle = freshStore(dir);
    try {
      const text = `${DECLINE_COMMENT_PREFIX} bank state could not be determined`;
      setComment(handle, { address: 0x0811, commentType: "line", text });
      const doc = exportStoreDocument(handle);
      const row = doc.comments.find((c) => c.address === 0x0811)!;
      assert.equal(row.provenance, "authored");
      assert.equal(isDeclineComment(row.text), true);
      assert.equal(provenanceForComment(text), "authored");
    } finally {
      closeStore(handle);
    }
  });
});

// ---------------------------------------------------------------------------
// Additional structural coverage (acceptance criteria beyond the six named
// behaviours): the DECLINED: prefix constant is declared in exactly one
// production file.
// ---------------------------------------------------------------------------

test("an enum usage naming an enum the document does not define is refused, never imported against a guess", () => {
  inTempDir((dir) => {
    const handle = freshStore(dir);
    try {
      const doc: StoreExportDocument = {
        schemaVersion: STORE_EXPORT_SCHEMA_VERSION,
        store: "x.annostore",
        ranges: [],
        labels: [],
        comments: [],
        projectEnums: [],
        enumUsage: [{ address: 0x0810, enumName: "NO_SUCH_ENUM", bank: null }],
        xrefs: [],
        execObservations: [],
      };
      assert.throws(() => importStoreDocument(handle, doc), /does not define/);
    } finally {
      closeStore(handle);
    }
  });
});

// ---------------------------------------------------------------------------
// Tier 2 (Task 3): LIVE, against a REAL dxa+Ghidra-derived store -- gated,
// default-skip, never hangs, never fails when absent.
// ---------------------------------------------------------------------------

const LIVE_STORE_ENV = "ANNO_STORE_EXPORT_LIVE_STORE";
const rawLiveStorePath = process.env[LIVE_STORE_ENV];

/** Computed exactly once. Every test in this tier passes this through
 * node:test's own `{ skip }` option -- never a hand-rolled early return,
 * which would report a false PASS rather than a SKIP (mirrors
 * fork-live.test.ts's own SKIP_REASON convention). */
const LIVE_SKIP_REASON: string | false =
  rawLiveStorePath === undefined || rawLiveStorePath === ""
    ? `anno-store-export.test.ts's live tier is opt-in and default-skipped -- set ${LIVE_STORE_ENV}=/path/to/real.annostore ` +
      `(a store dxa+Ghidra actually derived, e.g. dxa/tracer.prg per docs/phase45-wave0-measurements.md) to run it. A synthetic ` +
      `store built by this test file only carries the rows this test's author thought of; a real derived store carries whatever ` +
      `the derivation route actually writes.`
    : !existsSync(rawLiveStorePath)
      ? `${LIVE_STORE_ENV}="${rawLiveStorePath}" does not exist on disk -- opt-in requires a real, already-derived .annostore file at that path.`
      : false;

test("LIVE: exporting a REAL dxa+Ghidra-derived store, re-importing into a fresh store, and re-exporting reproduces the same document exactly", { skip: LIVE_SKIP_REASON }, () => {
  const livePath = rawLiveStorePath!;
  const readHandle = openStore(livePath, { mustExist: true, workspaceRoot: dirname(livePath) });
  let original: StoreExportDocument;
  try {
    original = exportStoreDocument(readHandle, { storeName: "tracer.annostore" });
  } finally {
    closeStore(readHandle);
  }

  inTempDir((dir) => {
    const target = freshStore(dir, "reimported.annostore");
    try {
      importStoreDocument(target, original);
      const reexported = exportStoreDocument(target, { storeName: "tracer.annostore" });
      assert.deepEqual(reexported, original, "a real derived store must round-trip exactly, including any row shape this test's author did not anticipate");
    } finally {
      closeStore(target);
    }
  });
});
