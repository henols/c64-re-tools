// anno-store.test.ts -- the end-to-end proof that the whole store vertical
// works on ONE range: validate, type, persist, close, reopen a FRESH handle,
// read the row back BY VALUE, resolve it through the paint index, and revert.
//
// Every temp directory is `mkdtempSync(join(tmpdir(), "anno-"))` inside a
// `try` with an unconditional `finally rmSync(..., { recursive: true, force:
// true })` -- `build-atomic.test.ts:44-46`'s pairing, copied because `/tmp` on
// the development host is a tmpfs with periodic cleanup disabled, so a leaked
// directory is leaked RAM until the next reboot.
//
// NOTHING here asserts that stderr is empty, and nothing may. `node:sqlite`
// emits an `ExperimentalWarning` unconditionally on first load; an
// empty-stderr assertion anywhere in this file would fail for that alone.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPaintIndex, NO_ROW, resolveAt } from "./anno-index.ts";
import {
  AnnoCommentGradeError,
  AnnoLabelError,
  AnnoRangeShapeError,
  AnnoRevisionArgumentError,
  AnnoStoreCorruptError,
  AnnoStoreError,
  AnnoStorePathError,
  AnnoStoreStaleRevisionError,
  AnnoTypeError,
  DATA_TYPES,
  MAX_SNAPSHOT_REVISIONS,
  SCHEMA_VERSION,
} from "./anno-types.ts";
import {
  addScope,
  applyWrite,
  applyWriteWithoutCommit,
  closeStore,
  contradictedCommentsFor,
  createProjectEnum,
  currentRevision,
  listComments,
  listLabels,
  listProjectEnums,
  listRanges,
  listScopes,
  listXrefs,
  NO_RETAINED_REVISION,
  oldestRetainedRevision,
  openStore,
  paintIndexOf,
  pruneSnapshots,
  putXref,
  reconcileSnapshotRing,
  retainedRevisions,
  revertTo,
  setComment,
  setDataType,
  setLabel,
  snapshotDirFor,
  snapshotPathFor,
  stageSnapshot,
  updateProjectEnum,
} from "./anno-store.ts";
import { CONFIDENCE_GRADES, parseConfidencePrefix } from "./r2000-confidence.ts";
import { codeOnly } from "./shipped-modules.ts";
import { ViceError } from "./vice.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** One temp directory per test, removed unconditionally. */
function inTempDir(body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the store vertical: type $0810-$084F as lo_hi_address, close, reopen a FRESH handle, and read the row back BY VALUE -- then revertTo(0) returns the prior value", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    const first = openStore(path, { workspaceRoot: dir });
    assert.equal(currentRevision(first), 0, "a freshly created store starts at revision 0");
    assert.deepEqual(listRanges(first), [], "a freshly created store has no ranges");

    const write = setDataType(first, { start: 0x0810, endInclusive: 0x084f, dataType: "lo_hi_address" });
    assert.equal(write.revision, 1, "an accepted write advances the revision by exactly one");
    closeStore(first);

    // A FRESH handle over the same path -- the read below therefore cannot be
    // served from anything the writing handle held in memory.
    const reopened = openStore(path, { workspaceRoot: dir });
    const rows = listRanges(reopened);
    assert.equal(rows.length, 1, "exactly one range survived the close and reopen");
    assert.equal(rows[0].start, 0x0810);
    assert.equal(rows[0].endInclusive, 0x084f);
    assert.equal(rows[0].dataType, "lo_hi_address");
    assert.equal(rows[0].bank, null, "every row written today has bank null");
    assert.equal(currentRevision(reopened), 1);

    const index = buildPaintIndex(rows);
    assert.equal(resolveAt(index, 0x0820), rows[0].id, "an interior address resolves to that row's id");
    assert.equal(resolveAt(index, 0x0810), rows[0].id, "the inclusive start resolves to the row");
    assert.equal(resolveAt(index, 0x084f), rows[0].id, "the inclusive end resolves to the row");
    assert.equal(resolveAt(index, 0x0850), NO_ROW, "one past the inclusive end resolves to nothing");
    assert.equal(resolveAt(index, 0x080f), NO_ROW, "one before the start resolves to nothing");

    const reverted = revertTo(reopened, 0);
    try {
      assert.deepEqual(listRanges(reverted), [], "revertTo(0) returns the store to the prior value: no ranges");
      assert.equal(currentRevision(reverted), 0, "revertTo(0) returns the store to the prior value: revision 0");
    } finally {
      closeStore(reverted);
    }
  });
});

test("the range length rule is endInclusive - start + 1: a $0400-$0400 range is one byte long", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      setDataType(store, { start: 0x0400, endInclusive: 0x0400, dataType: "byte" });
      const rows = listRanges(store);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].endInclusive - rows[0].start + 1, 1, "a one-byte range has start === endInclusive and length 1");
      const index = buildPaintIndex(rows);
      assert.equal(resolveAt(index, 0x0400), rows[0].id);
      assert.equal(resolveAt(index, 0x0401), NO_ROW);
    } finally {
      closeStore(store);
    }
  });
});

test("boundary: a range ending at 0xFFFF is accepted and resolves at 0xFFFF", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      setDataType(store, { start: 0xfffe, endInclusive: 0xffff, dataType: "lo_hi_word" });
      const rows = listRanges(store);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].endInclusive, 0xffff);
      const index = buildPaintIndex(rows);
      assert.equal(resolveAt(index, 0xffff), rows[0].id, "the very last address of the space is inside the index, not off its end");
    } finally {
      closeStore(store);
    }
  });
});

test("boundary: a start or endInclusive of 0x10000 or -1 is refused with AnnoRangeShapeError naming the offending value and the valid range", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const offenders: { start: number; endInclusive: number; offending: string }[] = [
        { start: 0x10000, endInclusive: 0x10001, offending: "65536" },
        { start: -1, endInclusive: 0x0100, offending: "-1" },
        { start: 0x0100, endInclusive: 0x10000, offending: "65536" },
        { start: 0x0100, endInclusive: -1, offending: "-1" },
      ];
      for (const offender of offenders) {
        assert.throws(
          () => setDataType(store, { start: offender.start, endInclusive: offender.endInclusive, dataType: "byte" }),
          (e: unknown) => {
            assert.ok(e instanceof AnnoRangeShapeError, `expected AnnoRangeShapeError, got ${String(e)}`);
            assert.match(e.message, new RegExp(offender.offending.replace("-", "\\-")), "the message must carry the offending value");
            assert.match(e.message, /0\.\.65535/, "the message must carry the valid range");
            return true;
          },
        );
      }
      assert.deepEqual(listRanges(store), [], "a refused write leaves no row behind");
      assert.equal(currentRevision(store), 0, "a refused write does not advance the revision");
    } finally {
      closeStore(store);
    }
  });
});

test("empty input: on an empty store every list function returns [] and the index resolves NO_ROW at all 65,536 addresses", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      assert.deepEqual(listRanges(store), []);
      const index = buildPaintIndex(listRanges(store));
      // Named probes first, so a failure reports a recognisable address rather
      // than only "some address in a 65,536-iteration loop".
      for (const address of [0x0000, 0x8000, 0xffff]) {
        assert.equal(resolveAt(index, address), NO_ROW, `empty store must resolve NO_ROW at 0x${address.toString(16)}`);
      }
      const unresolved = [];
      for (let address = 0; address <= 0xffff; address += 1) {
        if (resolveAt(index, address) !== NO_ROW) unresolved.push(address);
      }
      assert.deepEqual(unresolved, [], "every one of the 65,536 addresses must resolve to NO_ROW on an empty store");
    } finally {
      closeStore(store);
    }
  });
});

test("a zero-length store file is REFUSED with AnnoStoreCorruptError instead of opening as a pristine empty database", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    // SQLite itself opens this file happily, reports integrity_check "ok" and
    // returns an empty sqlite_master -- which is exactly why the refusal has to
    // be the store's own.
    writeFileSync(path, "");
    assert.throws(
      () => openStore(path, { workspaceRoot: dir }),
      (e: unknown) => {
        assert.ok(e instanceof AnnoStoreCorruptError, `expected AnnoStoreCorruptError, got ${String(e)}`);
        assert.match(e.message, /empty store/, "the refusal must say it is refusing to read a truncated file as an empty store");
        return true;
      },
    );
  });
});

test("a file that is not a database at all is refused, and the refusal names what SQLite said as well as what the store refuses to assume", () => {
  inTempDir((dir) => {
    const foreign = join(dir, "foreign.annostore");
    writeFileSync(foreign, "this is not a database, it is a text file\n");
    assert.throws(
      () => openStore(foreign, { workspaceRoot: dir }),
      (e: unknown) => {
        // The CLASS and a substring of the MESSAGE, both. A class-only
        // assertion passes over a refusal whose message has lost the reason,
        // and the reason is the whole product here: a caller has to be able to
        // tell "your annotations are gone" from "there are no annotations".
        assert.ok(e instanceof AnnoStoreCorruptError, `expected AnnoStoreCorruptError, got ${String(e)}`);
        assert.match(e.message, /not an annotation store/, "the refusal must say what it refused");
        assert.match(e.message, /file is not a database/, "and must carry SQLite's own diagnostic rather than replacing it");
        assert.match(e.message, /empty store/, "and must say it is refusing to read a foreign file as an empty store");
        assert.equal(e.path, foreign, "the offending path rides on the error");
        return true;
      },
    );
  });
});

test("a store file whose schema_version is not this build's is refused, and the refusal names both versions", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    // Forging the corrupt state directly, deliberately outside the write
    // sequence -- the point is a file this build must refuse, not a write it
    // would ever perform.
    store.db.prepare("update anno_meta set schema_version = ? where id = 1").run(SCHEMA_VERSION + 98);
    closeStore(store);

    assert.throws(
      () => openStore(path, { workspaceRoot: dir }),
      (e: unknown) => {
        assert.ok(e instanceof AnnoStoreCorruptError, `expected AnnoStoreCorruptError, got ${String(e)}`);
        assert.match(e.message, new RegExp(`schema_version ${SCHEMA_VERSION + 98}`), "the refusal must name the version it found");
        assert.match(e.message, new RegExp(`expected ${SCHEMA_VERSION}`), "the refusal must name the version it wanted");
        return true;
      },
    );
  });
});

test("a store written by the previous on-disk shape is REFUSED by name, and its legacy snapshot directory is left untouched", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    // WHAT THE TWO HALVES OF THIS TEST ACTUALLY PROVE, because they are NOT
    // equally novel and saying so is the point.
    //
    // The fixture does NOT run a version-1 build. It opens a store under the
    // CURRENT DDL and sets `anno_meta.schema_version` back to `1` by hand. The
    // refusal keys on the declared integer alone, so the assertion holds -- but
    // the FIRST half is then a deliberate RESTATEMENT of the existing test "a
    // store file whose schema_version is not this build's is refused, and the
    // refusal names both versions", which already forges `SCHEMA_VERSION + 98`
    // and asserts both names. It is here purely for LOCALITY: the legacy-ring
    // half needs a version-1 declaration sitting NEXT TO a legacy ring in one
    // fixture. It is NOT a second independent claim about the version gate.
    //
    // THE GENUINELY NEW EVIDENCE IS THE SECOND HALF -- that the refusal is
    // NON-DESTRUCTIVE. Remove the `existsSync` assertions on the legacy
    // directory and this test still passes on a refusal that deleted or migrated
    // it, so those assertions are what carry the prohibition "MUST NOT adopt,
    // migrate, claim or sweep a snapshot ring whose ownership this store cannot
    // establish".
    const store = openStore(path, { workspaceRoot: dir });
    store.db.prepare("update anno_meta set schema_version = ? where id = 1").run(1);
    closeStore(store);

    // THE LEGACY PER-DIRECTORY RING, spelled as its OWN literal because it is the
    // OLD layout being asserted to survive -- this is the one deliberate
    // occurrence of `join(dir, "snapshots")` left anywhere in this file.
    const legacyRing = join(dir, "snapshots");
    mkdirSync(legacyRing, { recursive: true });
    const legacySnapshot = join(legacyRing, "r0.db");
    writeFileSync(legacySnapshot, "not a real database, and it does not need to be");

    // NON-VACUITY PIN, taken BEFORE `openStore` is called: an assertion that a
    // directory survives is trivially satisfiable by a directory that was never
    // there, so the "still exists" claims below are measurements rather than
    // restatements of an absence.
    assert.ok(existsSync(legacyRing), "the legacy ring is on disk BEFORE the refusal, so its survival below is a measurement");
    assert.ok(existsSync(legacySnapshot), "and so is the snapshot inside it");

    assert.throws(
      () => openStore(path, { workspaceRoot: dir }),
      (e: unknown) => {
        assert.ok(e instanceof AnnoStoreCorruptError, `expected AnnoStoreCorruptError, got ${String(e)}`);
        assert.match(e.message, /schema_version 1/, "the refusal must name the version it found");
        assert.match(e.message, new RegExp(`expected ${SCHEMA_VERSION}`), "the refusal must name the version it wanted");
        return true;
      },
    );

    assert.ok(
      existsSync(legacyRing),
      "the legacy <dir>/snapshots ring must SURVIVE the refusal untouched: its ownership is not establishable -- two stores in one " +
        "directory may both have written into it -- so it is never adopted, never migrated and never deleted, and the bytes stay " +
        "recoverable by hand",
    );
    assert.ok(existsSync(legacySnapshot), "and so must every snapshot inside it -- a refusal that deleted them would be the loss, not the guard");
    assert.deepEqual(readdirSync(legacyRing).sort(), ["r0.db"], "with nothing added to it either -- the refusal did not touch the directory at all");
    // AND NOTHING WAS MIGRATED INTO A NEW STORE-KEYED RING. Asserted over the
    // DIRECTORY LISTING rather than against one expected ring path, which is
    // both stronger -- it catches a migration into ANY store-keyed ring, not
    // just this store's -- and keeps this file's pinned count of bare
    // `join(dir, "proj.annostore.snapshots")` layout literals at seven, so the
    // count stays a measurement of the re-pointed sites rather than of the
    // assertions written around them.
    assert.deepEqual(
      readdirSync(dir)
        .filter((name) => name.endsWith(".snapshots"))
        .sort(),
      [],
      "the refusal MIGRATED nothing into a store-keyed ring -- adopting the legacy ring would attribute a possibly-neighbouring store's history to this one",
    );
  });
});

test("a store truncated mid-file is refused rather than read -- and integrity_check reports exactly one row reading ok on a healthy one", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    for (let i = 0; i < 40; i += 1) {
      setDataType(store, { start: i * 16, endInclusive: i * 16 + 15, dataType: "byte" });
    }
    // The refusal's own condition, exercised in its PASSING direction: this is
    // the exact query and the exact shape openStore() checks, so the check
    // cannot silently become a no-op through a changed result shape.
    const healthy = store.db.prepare("pragma integrity_check").all() as { integrity_check: string }[];
    assert.equal(healthy.length, 1, "integrity_check on a healthy store returns exactly one row");
    assert.equal(healthy[0].integrity_check, "ok");
    const size = statSync(path).size;
    closeStore(store);

    truncateSync(path, Math.floor(size / 2));
    assert.throws(
      () => openStore(path, { workspaceRoot: dir }),
      (e: unknown) => {
        assert.ok(e instanceof AnnoStoreCorruptError, `expected AnnoStoreCorruptError, got ${String(e)}`);
        assert.match(e.message, /not an annotation store/, "a store truncated mid-file must be refused, not read as a shorter store");
        assert.match(e.message, /database disk image is malformed/, "and the refusal carries SQLite's own errcode-11 diagnostic verbatim");
        return true;
      },
    );

    // ------------------------------------------------------------------
    // THE STATED RESIDUAL, recorded here deliberately WITHOUT AN ASSERTION.
    //
    // Measured on this host during phase research, on raw `node:sqlite` with
    // no store logic in front of it: removing 100 bytes from the TAIL of a
    // 12 KB database leaves a file that OPENS and RETURNS THE CORRECT ROWS.
    // `pragma integrity_check` on that file reports fragmentation and a
    // missing index row rather than `ok`, and that report is the ONLY thing
    // closing the case here -- `openStore()` runs the check and refuses on
    // any answer but `ok`.
    //
    // The residual, stated rather than claimed closed: a tail truncation
    // small enough to leave the last page internally consistent -- so that
    // `integrity_check` still reports `ok` -- WOULD OPEN, and this store
    // cannot tell it from a healthy one. That case is NOT asserted below,
    // because asserting a behaviour nobody measured is how a stated residual
    // quietly becomes a false claim. The half-file truncation above is the
    // measured case; the undetectable tail is the residual; and the two must
    // not be conflated by a later reader tempted to widen the claim to "any
    // truncation is refused". It is not.
    // ------------------------------------------------------------------
  });
});

test("every accepted write advances the revision by exactly one, and a write based on a stale revision is refused with both numbers", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      assert.equal(currentRevision(store), 0);
      for (let expected = 1; expected <= 3; expected += 1) {
        const write = setDataType(store, { start: 0x1000 + expected * 0x10, endInclusive: 0x1000 + expected * 0x10 + 1, dataType: "word" });
        assert.equal(write.revision, expected, "the write must report the revision it produced");
        assert.equal(currentRevision(store), expected, "and the on-disk revision must agree, having advanced by exactly one");
      }

      assert.throws(
        () => setDataType(store, { start: 0x2000, endInclusive: 0x2001, dataType: "word", baseRevision: 0 }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreStaleRevisionError, `expected AnnoStoreStaleRevisionError, got ${String(e)}`);
          assert.equal(e.baseRevision, 0, "the refusal carries the revision the caller based its edit on");
          assert.equal(e.currentRevision, 3, "and the revision actually on disk, so a caller can say WHICH two disagreed");
          return true;
        },
      );
      assert.equal(currentRevision(store), 3, "a refused write does not advance the revision");
    } finally {
      closeStore(store);
    }
  });
});

test("the reserved bank column exists and is nullable on all four annotated tables, and every row written today has it null", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      for (const table of ["anno_range", "anno_label", "anno_comment", "anno_xref"]) {
        const columns = store.db.prepare(`pragma table_info(${table})`).all() as { name: string; notnull: number }[];
        const bank = columns.find((column) => column.name === "bank");
        assert.ok(bank, `${table} must carry the reserved bank column`);
        assert.equal(bank.notnull, 0, `${table}.bank must be NULLABLE -- nothing interprets it yet`);
      }
      setDataType(store, { start: 0x0810, endInclusive: 0x084f, dataType: "lo_hi_address" });
      for (const row of listRanges(store)) {
        assert.equal(row.bank, null, "every row this store writes today has bank null");
      }
    } finally {
      closeStore(store);
    }
  });
});

test("anno_xref exists with its access_kind column from the first write, and the store creates NO FTS5 virtual table", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const columns = (store.db.prepare("pragma table_info(anno_xref)").all() as { name: string }[]).map((column) => column.name);
      assert.ok(columns.includes("access_kind"), "the cross-reference table carries access_kind from the very first write");
      assert.ok(columns.includes("from_address") && columns.includes("to_address"));
      assert.equal(
        store.db.prepare("select count(*) as n from anno_xref").get() !== undefined,
        true,
        "the table exists and is queryable even though nothing derivable is stored in it",
      );

      // Adding FTS5 later is additive; removing it is a schema migration. The
      // search surface is not this schema's, so it must not be foreclosed here.
      const objects = store.db.prepare("select type, name, sql from sqlite_master").all() as {
        type: string;
        name: string;
        sql: string | null;
      }[];
      const virtualTables = objects.filter((object) => (object.sql ?? "").toLowerCase().includes("virtual table"));
      assert.deepEqual(virtualTables, [], "the store must create no virtual table");
      const fts = objects.filter((object) => object.name.toLowerCase().includes("fts"));
      assert.deepEqual(fts, [], "the store must create no FTS5 table");
    } finally {
      closeStore(store);
    }
  });
});

test("pragma journal_mode on a freshly created store reads delete -- the default is the decision, and nothing sets it", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const mode = store.db.prepare("pragma journal_mode").get() as { journal_mode: string };
      assert.equal(
        mode.journal_mode,
        "delete",
        "journal_mode is a PERSISTENT database property, so a stray pragma anywhere would be inherited by every later connection",
      );
    } finally {
      closeStore(store);
    }

    // THE OTHER HALF OF THE SAME DECISION: `wal` is the only journal mode with
    // PERSISTENT `-wal`/`-shm` sidecars, so their absence beside a cleanly
    // closed store is the observable consequence of staying on `delete`. A
    // future edit that set WAL anywhere would be inherited by every later
    // connection to the file and would leave these behind; the mode assertion
    // above catches the pragma, and this catches its effect on disk.
    for (const suffix of ["-wal", "-shm", "-journal"]) {
      assert.equal(existsSync(`${path}${suffix}`), false, `a cleanly closed store must leave no ${suffix} sidecar beside it`);
    }
  });
});

test("a store path resolving outside the supplied workspace root is refused with AnnoStorePathError", () => {
  inTempDir((dir) => {
    const inside = join(dir, "nested");
    assert.throws(() => openStore(join(dir, "..", "escaped.annostore"), { workspaceRoot: inside }), AnnoStorePathError);
    // Boundary safety: a SIBLING whose name merely starts with the root's name
    // is outside it, and must be refused rather than accepted by prefix.
    assert.throws(() => openStore(`${inside}-sibling/proj.annostore`, { workspaceRoot: inside }), AnnoStorePathError);
  });
});

// ---------------------------------------------------------------------------
// The five annotation kinds: round-trip BY VALUE, the collision refusal, the
// idempotent repeat, the ordering guarantee, and the never-cached-derivation
// pin. Every round-trip below CLOSES the writing handle and reopens the file in
// a fresh one before reading, because a round-trip that never leaves the
// process proves nothing about persistence.
// ---------------------------------------------------------------------------

test("round-trip by value: a label survives a close and a reopen with every field equal to what was written", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    const first = openStore(path, { workspaceRoot: dir });
    const write = setLabel(first, { address: 0xc000, name: "init_screen", kind: "User" });
    assert.equal(write.changed, true, "a first write of a new label changed something");
    assert.equal(write.revision, 1);
    closeStore(first);

    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      const rows = listLabels(reopened);
      assert.equal(rows.length, 1, "exactly one label survived the close and reopen");
      assert.equal(rows[0].address, 0xc000);
      assert.equal(rows[0].name, "init_screen", "the name comes back byte-identical -- no normalisation anywhere on the write path");
      assert.equal(rows[0].kind, "User");
      assert.equal(rows[0].bank, null, "every row written today has bank null");
    } finally {
      closeStore(reopened);
    }
  });
});

test("round-trip by value: both comment placements coexist at one address, and rewriting one placement replaces rather than accumulates", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    const first = openStore(path, { workspaceRoot: dir });
    setComment(first, { address: 0x0810, commentType: "line", text: "the IRQ handler proper" });
    setComment(first, { address: 0x0810, commentType: "side", text: "entered 50x/s" });
    closeStore(first);

    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      const rows = listComments(reopened);
      assert.equal(rows.length, 2, "the two placements are two rows at one address, not one row that overwrote the other");
      assert.deepEqual(
        rows.map((row) => [row.address, row.commentType, row.text, row.bank]),
        [
          [0x0810, "line", "the IRQ handler proper", null],
          [0x0810, "side", "entered 50x/s", null],
        ],
        "every field of both comments round-trips by value",
      );

      const replaced = setComment(reopened, { address: 0x0810, commentType: "side", text: "entered 50x/s on a PAL machine" });
      assert.equal(replaced.changed, true);
      const after = listComments(reopened);
      assert.equal(after.length, 2, "rewriting one placement at one address leaves two rows, not three");
      assert.equal(after.find((row) => row.commentType === "side")?.text, "entered 50x/s on a PAL machine");
    } finally {
      closeStore(reopened);
    }
  });
});

test("round-trip by value: a scope keeps both inclusive ends, and a project enum's complete variant mapping and description survive a reopen", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    const first = openStore(path, { workspaceRoot: dir });
    addScope(first, { start: 0xc000, endInclusive: 0xc0ff });
    createProjectEnum(first, {
      name: "vic_registers",
      // Three key FORMS on purpose -- decimal, "$" hex and "0b" binary are all
      // forms the schema names, and all three must come back VERBATIM. A store
      // that canonicalised keys would return a value the caller never supplied.
      variants: { "32": "border_colour", $21: "background_colour", "0b00010001": "control_1" },
      description: "the VIC-II registers this program actually writes",
    });
    closeStore(first);

    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      assert.deepEqual(listScopes(reopened), [{ id: 1, start: 0xc000, endInclusive: 0xc0ff }], "both scope ends are inclusive and round-trip");

      const enums = listProjectEnums(reopened);
      assert.equal(enums.length, 1);
      assert.equal(enums[0].name, "vic_registers");
      assert.deepEqual(
        enums[0].variants,
        { "32": "border_colour", $21: "background_colour", "0b00010001": "control_1" },
        "the COMPLETE variant mapping round-trips by value, keys verbatim",
      );
      assert.equal(enums[0].description, "the VIC-II registers this program actually writes");

      // The update replaces the mapping WHOLESALE and renames in one call --
      // both halves of the schema's own update semantics.
      const updated = updateProjectEnum(reopened, {
        name: "vic_registers",
        newName: "vic_writes",
        variants: { $d020: "border_colour" },
        description: "narrowed after tracing",
      });
      assert.equal(updated.changed, true);
      closeStore(reopened);

      const third = openStore(path, { workspaceRoot: dir });
      try {
        const after = listProjectEnums(third);
        assert.equal(after.length, 1, "the update renamed the existing enum rather than adding a second one");
        assert.equal(after[0].name, "vic_writes");
        assert.deepEqual(
          after[0].variants,
          { $d020: "border_colour" },
          "the variants mapping was REPLACED wholesale, not merged -- a merge would make a variant impossible to remove",
        );
        assert.equal(after[0].description, "narrowed after tracing");
      } finally {
        closeStore(third);
      }
    } finally {
      // `reopened` is already closed above on the success path; closing twice
      // would throw, so the outer cleanup is the temp directory removal only.
    }
  });
});

test("the label collision is REFUSED by name before SQLite sees it: both addresses are in the message, the store is unchanged and the revision did not advance", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      setLabel(store, { address: 0xc000, name: "init_screen", kind: "User" });
      assert.equal(currentRevision(store), 1);

      assert.throws(
        () => setLabel(store, { address: 0xc100, name: "init_screen", kind: "User" }),
        (e: unknown) => {
          // The named error, NOT a SQLite unique-constraint error. The DDL's
          // `unique(name)` is a second line of defence and must not be the thing
          // this test observes -- an implementation that relied on it would give
          // a caller a message about a constraint instead of about two addresses.
          assert.ok(e instanceof AnnoLabelError, `expected AnnoLabelError, got ${String(e)}`);
          assert.equal(e.existingAddress, 0xc000, "the refusal carries the address the name is already bound to");
          assert.equal(e.requestedAddress, 0xc100, "and the address the caller asked for");
          assert.match(e.message, /49152/, "the message must name the existing address");
          assert.match(e.message, /49408/, "the message must name the requested address");
          assert.equal(e.identifier, "init_screen");
          return true;
        },
      );

      assert.equal(listLabels(store).length, 1, "a refused write leaves no row behind");
      assert.equal(listLabels(store)[0].address, 0xc000, "and does not rebind the existing one");
      assert.equal(
        currentRevision(store),
        1,
        "a refusal raised INSIDE the mutation must roll the sequence back -- the revision compare-and-swap must not survive it",
      );

      // The SAME name at the SAME address is not a collision: it is accepted and
      // reports no change.
      const repeat = setLabel(store, { address: 0xc000, name: "init_screen", kind: "User" });
      assert.equal(repeat.changed, false, "the same name at the same address is a no-op, not a refusal");
      assert.equal(listLabels(store).length, 1);
    } finally {
      closeStore(store);
    }
  });
});

test("idempotency: a repeated identical label, comment and range type each succeed, leave exactly one row and report changed:false -- while the revision still advances by exactly one", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const label1 = setLabel(store, { address: 0xc000, name: "irq_entry", kind: "Auto" });
      const label2 = setLabel(store, { address: 0xc000, name: "irq_entry", kind: "Auto" });
      assert.equal(label1.changed, true);
      assert.equal(label2.changed, false, "the repeat is a no-op");
      assert.equal(label2.revision, label1.revision + 1, "and the revision STILL advanced by exactly one -- changed:false is the only no-op signal");
      assert.equal(listLabels(store).length, 1, "exactly one row");

      const comment1 = setComment(store, { address: 0x0810, commentType: "line", text: "raster split" });
      const comment2 = setComment(store, { address: 0x0810, commentType: "line", text: "raster split" });
      assert.equal(comment1.changed, true);
      assert.equal(comment2.changed, false);
      assert.equal(comment2.revision, comment1.revision + 1);
      assert.equal(listComments(store).length, 1);

      const range1 = setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
      const range2 = setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
      assert.equal(range1.changed, true);
      assert.equal(range2.changed, false, "retyping a range to exactly what it already is changes nothing");
      assert.equal(range2.revision, range1.revision + 1);
      assert.equal(listRanges(store).length, 1, "and leaves exactly one row rather than a deleted-and-reinserted duplicate");
    } finally {
      closeStore(store);
    }
  });
});

test("ordering: every list function returns rows in ascending id order, and the same order after a close and a reopen", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    const first = openStore(path, { workspaceRoot: dir });
    for (let i = 0; i < 3; i += 1) {
      setLabel(first, { address: 0xc000 + i * 0x10, name: `routine_${i}`, kind: "User" });
      setComment(first, { address: 0x0800 + i * 0x10, commentType: "line", text: `note ${i}` });
      addScope(first, { start: 0x2000 + i * 0x100, endInclusive: 0x20ff + i * 0x100 });
      createProjectEnum(first, { name: `mode_${i}`, variants: { [String(i)]: `variant_${i}` } });
      putXref(first, { fromAddress: 0x3000 + i, toAddress: 0x4000 + i, accessKind: "COMPUTED_JUMP" });
    }

    /** Ascending-id assertion, applied to all five tables through one handle. */
    const assertOrdered = (handle: ReturnType<typeof openStore>, when: string): void => {
      const lists: readonly (readonly [string, readonly { id: number }[]])[] = [
        ["labels", listLabels(handle)],
        ["comments", listComments(handle)],
        ["scopes", listScopes(handle)],
        ["project enums", listProjectEnums(handle)],
        ["xrefs", listXrefs(handle)],
      ];
      for (const [what, rows] of lists) {
        assert.equal(rows.length, 3, `${what} must have three rows ${when}`);
        assert.deepEqual(
          rows.map((row) => row.id),
          [...rows].sort((a, b) => a.id - b.id).map((row) => row.id),
          `${what} must be in ascending id order ${when}`,
        );
      }
    };

    assertOrdered(first, "before the reopen");
    closeStore(first);

    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      assertOrdered(reopened, "after the reopen");
    } finally {
      closeStore(reopened);
    }
  });
});

test("xref adjacency: one from/to pair with two DIFFERENT access kinds is two rows, and a fifth access-kind value is refused with AnnoTypeError naming the four valid members", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      putXref(store, { fromAddress: 0xc000, toAddress: 0xd020, accessKind: "READ" });
      putXref(store, { fromAddress: 0xc000, toAddress: 0xd020, accessKind: "WRITE" });
      const rows = listXrefs(store);
      assert.equal(rows.length, 2, "READ and WRITE at one address pair are two different facts and must never be merged into one row");
      assert.deepEqual(
        rows.map((row) => row.accessKind),
        ["READ", "WRITE"],
      );
      assert.deepEqual(
        rows.map((row) => [row.fromAddress, row.toAddress, row.bank]),
        [
          [0xc000, 0xd020, null],
          [0xc000, 0xd020, null],
        ],
      );

      // A byte-identical triple IS a no-op, which is a different question from
      // adjacency: it leaves one row rather than merging two distinct ones.
      const repeat = putXref(store, { fromAddress: 0xc000, toAddress: 0xd020, accessKind: "READ" });
      assert.equal(repeat.changed, false);
      assert.equal(listXrefs(store).length, 2);

      assert.throws(
        () => putXref(store, { fromAddress: 0xc000, toAddress: 0xd020, accessKind: "EXECUTE" }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoTypeError, `expected AnnoTypeError, got ${String(e)}`);
          assert.equal(e.dataType, "EXECUTE", "the refusal carries the offending value");
          assert.deepEqual(e.validTypes, ["READ", "WRITE", "READ_WRITE", "COMPUTED_JUMP"], "and the full list of valid members");
          return true;
        },
      );
      assert.equal(listXrefs(store).length, 2, "a refused xref leaves no row behind");
    } finally {
      closeStore(store);
    }
  });
});

test("nothing derivable is cached: anno_xref holds ZERO rows after typing a lo_hi_address range whose targets are fully derivable, and after a lo_hi_word range -- only an explicit putXref produces a row", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      // $C000-$C007 as a four-entry split ADDRESS table. Its targets are fully
      // derivable from the bytes -- `resolveSplitTargets()` in anno-types.ts
      // computes them -- which is exactly why finding them on disk here would be
      // the failure. A non-empty result would mean the store had cached a
      // derivation: a SECOND on-disk truth that can disagree with the range
      // table it came from, invisibly, because both answers look authoritative.
      setDataType(store, { start: 0xc000, endInclusive: 0xc007, dataType: "lo_hi_address" });
      assert.deepEqual(listXrefs(store), [], "typing a lo_hi_address range must leave anno_xref empty -- the store must not cache a derivation");

      setDataType(store, { start: 0xc100, endInclusive: 0xc107, dataType: "lo_hi_word" });
      assert.deepEqual(listXrefs(store), [], "and typing a lo_hi_word range likewise");

      // The other half of the same claim: the table is not merely unreachable.
      // A non-derivable reference -- the computed-dispatch case, which produces
      // no reference derivable from the bytes at all -- does get a row.
      putXref(store, { fromAddress: 0xc000, toAddress: 0xc100, accessKind: "COMPUTED_JUMP" });
      const rows = listXrefs(store);
      assert.equal(rows.length, 1, "an explicit, non-derivable reference IS stored -- otherwise this pin would pass on an unreachable table");
      assert.equal(rows[0].accessKind, "COMPUTED_JUMP");
    } finally {
      closeStore(store);
    }
  });
});

test("the reserved bank field is never INTERPRETED: every list function returns bank null, and no line of the seam's own code branches on or computes with a bank value", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      setDataType(store, { start: 0x0810, endInclusive: 0x084f, dataType: "lo_hi_address" });
      setLabel(store, { address: 0xc000, name: "entry", kind: "User" });
      setComment(store, { address: 0xc000, commentType: "line", text: "entry point" });
      putXref(store, { fromAddress: 0xc000, toAddress: 0xd020, accessKind: "WRITE" });

      const banks = [
        ...listRanges(store).map((row) => row.bank),
        ...listLabels(store).map((row) => row.bank),
        ...listComments(store).map((row) => row.bank),
        ...listXrefs(store).map((row) => row.bank),
      ];
      assert.equal(banks.length, 4, "one row in each of the four tables that carry the column");
      assert.deepEqual(
        banks.filter((bank) => bank !== null),
        [],
        "every row this store writes today has bank null",
      );
    } finally {
      closeStore(store);
    }
  });

  // THE STRUCTURAL HALF. `PROOF-03` is recorded could-not-run and `memmap.json`
  // is flat, so nothing knows what a bank number would MEAN -- which makes any
  // code path branching on its value a guess dressed as logic. Scanned on
  // STRICT `codeOnly()` output, which blanks string-literal bodies: that is what
  // removes the `DDL` template's `bank integer` declarations and every `select
  // ... bank ...` column list from the scan without hand-excluding line spans,
  // leaving only real code that names the identifier.
  //
  // WHAT IN-06 CHANGED, AND WHY THE CONTROL IS NARROWED RATHER THAN DELETED.
  // Before IN-06 the store's only range insert bound the literal `null`, so
  // "no line outside the row mappers so much as names a bank value" was true
  // and was the assertion. `retype()`'s split-and-preserve now carries the
  // OVERLAPPED ROW'S OWN bank forward onto its remainders, because a split path
  // that dropped a reserved column is exactly the silent loss a future
  // banked-memory model would inherit. Carrying a value through verbatim is not
  // INTERPRETING it: the four lines allowed below declare it, bind it, and pass
  // it on, and not one of them asks what the number means. The prohibition that
  // actually matters -- no branch, no comparison, no arithmetic on a bank value
  // -- is asserted separately and unconditionally underneath, over the same
  // scanned lines, so narrowing the allow-list cannot quietly widen the rule.
  const strict = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"));
  const bankLines = strict.split("\n").filter((line) => /\bbank\b/.test(line));

  // NON-VACUITY: an allow-list is only evidence if the scan found the lines it
  // is excusing. 14 lines name a bank value on the tree this control was
  // written against; the floor is stated below it so an accidental change to
  // `codeOnly()` that stripped everything cannot pass here trivially.
  assert.ok(bankLines.length >= 13, `the scan must find the bank-naming lines it excuses, got ${bankLines.length}`);

  const offenders = bankLines
    // The row mappers ARE the one permitted read, one line each.
    .filter((line) => !/^\s*bank: row\.bank,$/.test(line))
    // ...and the local row-shape casts that name the column's type, whether
    // written over several lines or inline on the `.all()` that produced them.
    .filter((line) => !/^\s*bank: number \| null;$/.test(line))
    .filter((line) => !/^\s*\.all\(.*\) as \{[^}]*bank: number \| null \}\[\];$/.test(line))
    // IN-06's pass-through, four lines: the parameter, the bind, and the two
    // remainder call sites that hand the overlapped row's own value onward.
    .filter((line) => !/^function insertRange\(.*, bank: number \| null\): void \{$/.test(line))
    .filter((line) => !/^\s*db\.prepare\(\)\.run\(start, endInclusive, dataType, bank\);$/.test(line))
    .filter((line) => !/^\s*insertRange\(db, .*, row\.bank\);$/.test(line));
  assert.deepEqual(offenders, [], "no code outside the row mappers and IN-06's verbatim pass-through may touch a bank value");

  // THE RULE THE ALLOW-LIST MUST NOT SOFTEN: nothing may act on the value.
  const interpreters = bankLines.filter(
    (line) => /\bbank\b\s*(===|!==|==|!=|<=|>=|<|>|\+|-|\*|\/|\?\?|\|\||&&|\?)/.test(line) || /(===|!==|==|!=|<=|>=|<|>|\?\?)\s*\w*\.?\bbank\b/.test(line),
  );
  assert.deepEqual(interpreters, [], "no line may branch on, compare or compute with a bank value -- nothing knows what one would mean");
});

// ---------------------------------------------------------------------------
// THE CONTRADICTED-COMMENT RULE (STORE-03).
//
// A retype that makes an existing GRADED comment false reports that comment
// back on the SUCCESSFUL result. It is data, never an error and never a
// refusal: refusing would push a caller toward deleting the comment to get the
// retype through, which converts a reported loss into a silent one.
//
// "Contradicts" means the retype makes the comment FALSE -- not merely that a
// comment happens to sit at a retyped address. The broad reading (any comment
// at all is contradicted) was considered and rejected: it would make every
// retype of a commented range report, and a report that fires every time is a
// report nobody reads.
// ---------------------------------------------------------------------------

/** Opens a fresh store, runs `body`, and closes it unconditionally. */
function inFreshStore(body: (store: ReturnType<typeof openStore>) => void): void {
  inTempDir((dir) => {
    const store = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    try {
      body(store);
    } finally {
      closeStore(store);
    }
  });
}

test("a confirmed-code graded comment inside a range retyped to byte is REPORTED on the successful result, and the retype still happens", () => {
  inFreshStore((store) => {
    setDataType(store, { start: 0x0810, endInclusive: 0x081f, dataType: "code" });
    setComment(store, { address: 0x0812, commentType: "line", text: "[confirmed-code] observed executing at $0812" });

    const write = setDataType(store, { start: 0x0810, endInclusive: 0x081f, dataType: "byte" });

    assert.equal(write.changed, true, "the write is not refused -- the range really is retyped");
    assert.equal(write.contradictedComments.length, 1, "the contradicted comment comes back as data on the successful result");
    assert.deepEqual(write.contradictedComments[0], {
      address: 0x0812,
      commentType: "line",
      text: "[confirmed-code] observed executing at $0812",
      grade: "[confirmed-code]",
      contradictedBy: "byte",
    });

    const rows = listRanges(store);
    assert.equal(rows.length, 1, "the retype was applied, not rolled back");
    assert.equal(rows[0].dataType, "byte", "and it applied the type the caller asked for");
  });
});

test("a probable-code graded comment is reported by the same rule", () => {
  inFreshStore((store) => {
    setComment(store, { address: 0x0900, commentType: "side", text: "[probable-code] reachable via the JSR at $0880" });
    const write = setDataType(store, { start: 0x0900, endInclusive: 0x090f, dataType: "petscii" });
    assert.equal(write.contradictedComments.length, 1);
    assert.equal(write.contradictedComments[0].grade, "[probable-code]");
    assert.equal(write.contradictedComments[0].commentType, "side");
    assert.equal(write.contradictedComments[0].contradictedBy, "petscii");
  });
});

test("a data-graded comment is contradicted by a retype to code and NOT by a retype to another data member", () => {
  inFreshStore((store) => {
    setComment(store, { address: 0x2000, commentType: "line", text: "[confirmed-data] never hit as an instruction stream" });
    setComment(store, { address: 0x2001, commentType: "line", text: "[probable-data] indexed-load target" });

    const toWord = setDataType(store, { start: 0x2000, endInclusive: 0x200f, dataType: "word" });
    assert.deepEqual(toWord.contradictedComments, [], "word is another way of saying data -- neither comment becomes false");

    const toCode = setDataType(store, { start: 0x2000, endInclusive: 0x200f, dataType: "code" });
    assert.deepEqual(
      toCode.contradictedComments.map((c) => c.grade),
      ["[confirmed-data]", "[probable-data]"],
      "both data grades are contradicted by code, and the report is in ascending address order",
    );
  });
});

test("an unknown-graded comment and an ungraded comment are never reported, under any retype", () => {
  inFreshStore((store) => {
    setComment(store, { address: 0x3000, commentType: "line", text: "[unknown] no reliable interpretation yet" });
    setComment(store, { address: 0x3001, commentType: "line", text: "plain prose with no bracket token at all" });

    for (const dataType of ["code", "byte", "word", "screencode", "lo_hi_address", "external_file"]) {
      const write = setDataType(store, { start: 0x3000, endInclusive: 0x300f, dataType });
      assert.deepEqual(write.contradictedComments, [], `neither an unknown grade nor an ungraded comment is contradicted by ${dataType}`);
    }
  });
});

test("a comment whose bracket token is not one of the five makes the retype throw AnnoCommentGradeError carrying the original message verbatim", () => {
  inFreshStore((store) => {
    // `setComment` accepts it -- the grade convention is not a comment-text
    // validity rule, and refusing it there would make an existing store
    // unreadable. The refusal belongs to the path that has to INTERPRET it.
    setComment(store, { address: 0x4000, commentType: "line", text: "[maybe-code] a near-miss token" });

    let thrown: unknown;
    try {
      setDataType(store, { start: 0x4000, endInclusive: 0x400f, dataType: "byte" });
    } catch (e) {
      thrown = e;
    }

    assert.ok(thrown instanceof AnnoCommentGradeError, `expected AnnoCommentGradeError, got ${String(thrown)}`);
    assert.ok(thrown instanceof ViceError, "everything the store throws must be a ViceError, which R2000ConfidenceGradeError is not");
    let originalMessage = "";
    try {
      parseConfidencePrefix("[maybe-code] a near-miss token");
    } catch (e) {
      originalMessage = (e as Error).message;
    }
    assert.ok(originalMessage.length > 0, "the original parser really does throw on a near-miss token");
    assert.ok(
      (thrown as Error).message.includes(originalMessage),
      "the original diagnostic is preserved VERBATIM inside the wrapper, so nothing is lost by the wrap",
    );
    assert.equal((thrown as AnnoCommentGradeError).comment, "[maybe-code] a near-miss token", "the offending comment text rides on the error");
  });
});

test("the contradicted-comment list is EMPTY rather than absent when no comment is in range, so a caller reads the field unconditionally", () => {
  inFreshStore((store) => {
    const write = setDataType(store, { start: 0x5000, endInclusive: 0x500f, dataType: "byte" });
    assert.ok(Array.isArray(write.contradictedComments), "the field is always an array");
    assert.equal(write.contradictedComments.length, 0);
  });
});

test("a comment OUTSIDE the retyped range is never reported, even when its grade would contradict", () => {
  inFreshStore((store) => {
    setComment(store, { address: 0x0fff, commentType: "line", text: "[confirmed-code] one byte below the range" });
    setComment(store, { address: 0x1010, commentType: "line", text: "[confirmed-code] one byte above the range" });
    setComment(store, { address: 0x1000, commentType: "line", text: "[confirmed-code] the low boundary, inclusive" });
    setComment(store, { address: 0x100f, commentType: "line", text: "[confirmed-code] the high boundary, inclusive" });

    const write = setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
    assert.deepEqual(
      write.contradictedComments.map((c) => c.address),
      [0x1000, 0x100f],
      "both ends are INCLUSIVE and nothing outside them is reported",
    );
  });
});

test("contradictedCommentsFor is the ONE definition of the rule, and it is derived from the five-grade vocabulary", () => {
  const codeGrades = CONFIDENCE_GRADES.filter((g) => g.token.endsWith("-code"));
  const dataGrades = CONFIDENCE_GRADES.filter((g) => g.token.endsWith("-data"));
  assert.equal(codeGrades.length, 2, "the vocabulary has exactly two code grades");
  assert.equal(dataGrades.length, 2, "the vocabulary has exactly two data grades");

  for (const grade of codeGrades) {
    assert.equal(contradictedCommentsFor(grade.bracket, "code"), false, `${grade.bracket} agrees with code`);
    for (const dataType of DATA_TYPES.filter((t) => t !== "code")) {
      assert.equal(contradictedCommentsFor(grade.bracket, dataType), true, `${grade.bracket} is contradicted by ${dataType}`);
    }
  }
  for (const grade of dataGrades) {
    assert.equal(contradictedCommentsFor(grade.bracket, "code"), true, `${grade.bracket} is contradicted by code`);
    for (const dataType of DATA_TYPES.filter((t) => t !== "code")) {
      assert.equal(contradictedCommentsFor(grade.bracket, dataType), false, `${grade.bracket} is not contradicted by ${dataType}`);
    }
  }
  for (const dataType of DATA_TYPES) {
    assert.equal(contradictedCommentsFor("[unknown]", dataType), false, `[unknown] is never contradicted, not even by ${dataType}`);
    assert.equal(contradictedCommentsFor(null, dataType), false, `an ungraded comment is never contradicted, not even by ${dataType}`);
  }
});

// ---------------------------------------------------------------------------
// THE BOUNDED SNAPSHOT RING (STORE-04, threat T-28-diskgrowth).
//
// An unbounded `snapshots/` directory is a monotonically growing disk consumer
// whose later fix has to reason about which snapshots a revert might still
// need. The bound has exactly ONE home -- `MAX_SNAPSHOT_REVISIONS` in
// `anno-types.ts` -- and is imported here rather than written as a literal, so
// this proof cannot agree with a stale copy of the number.
// ---------------------------------------------------------------------------

test("the snapshot ring is BOUNDED at MAX_SNAPSHOT_REVISIONS: after more writes than the bound, the files on disk, the pointer rows and the reported floor all agree", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const writes = MAX_SNAPSHOT_REVISIONS + 8;
      for (let i = 0; i < writes; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }
      assert.equal(currentRevision(store), writes, "every one of the writes was accepted and advanced the revision by exactly one");

      const files = readdirSync(join(dir, "proj.annostore.snapshots")).sort();
      assert.ok(
        files.length <= MAX_SNAPSHOT_REVISIONS,
        `the snapshots directory must hold at most ${MAX_SNAPSHOT_REVISIONS} files, found ${files.length}: ${files.join(", ")}`,
      );
      assert.equal(
        files.length,
        MAX_SNAPSHOT_REVISIONS,
        "and it must hold exactly the bound after more writes than the bound -- fewer would mean the prune is over-eager, more that it never ran",
      );

      const rows = (store.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[]).map(
        (row) => row.revision,
      );
      assert.equal(
        rows.length,
        files.length,
        "the pointer rows must be pruned to match the files -- a pointer row surviving its file is the one failure direction the ordering exists to prevent",
      );
      assert.deepEqual(
        files,
        rows.map((revision) => `r${revision}.db`).sort(),
        "and the surviving files must be exactly the surviving pointer rows, by revision number",
      );

      assert.equal(
        oldestRetainedRevision(store),
        writes - MAX_SNAPSHOT_REVISIONS,
        "the reported floor is the newest revision minus the bound, computed from the rows rather than from arithmetic on the revision",
      );
    } finally {
      closeStore(store);
    }
  });
});

test("a revert PAST the bound is REFUSED by name -- it names the requested and the oldest retained revision, and does NOT substitute the nearest retained snapshot", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const writes = MAX_SNAPSHOT_REVISIONS + 8;
      for (let i = 0; i < writes; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }
      const oldest = oldestRetainedRevision(store);
      assert.ok(oldest > 0, "the ring must genuinely have pruned something, or this refusal has nothing to refuse");

      assert.throws(
        () => revertTo(store, 0),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
          assert.match(e.message, /cannot revert to revision 0/, "the refusal must name the revision that was asked for");
          assert.match(
            e.message,
            new RegExp(`oldest retained revision is ${oldest}`),
            "and the oldest revision that IS still retained, so a caller can pick a reachable one",
          );
          assert.match(e.message, new RegExp(`at most ${MAX_SNAPSHOT_REVISIONS} revisions`), "and the bound itself");
          return true;
        },
      );

      // THE HALF THAT MATTERS MORE THAN THE MESSAGE: a best-effort revert that
      // returned the nearest retained revision instead would ALSO throw
      // nothing, and the caller could not tell it happened. So the store is
      // asserted UNCHANGED after the refusal -- no substitution, no partial
      // restore, and the handle still usable.
      assert.equal(currentRevision(store), writes, "the refused revert must not have moved the revision");
      assert.equal(listRanges(store).length, writes, "nor restored some other revision's rows");
    } finally {
      closeStore(store);
    }
  });
});

test("idempotency of revert: reverting to r yields the state at r, and a SECOND revert to the same r is refused and leaves that state byte-for-byte unchanged", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      for (let i = 0; i < 3; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }
      assert.equal(currentRevision(store), 3);

      store = revertTo(store, 1);
      const rangesAfterFirst = listRanges(store);
      const revisionAfterFirst = currentRevision(store);
      assert.equal(revisionAfterFirst, 1, "revertTo(1) puts the store back at revision 1");
      assert.equal(rangesAfterFirst.length, 1, "with exactly the one range that existed at revision 1");

      // MEASURED, AND THE PLAN'S SHAPE CORRECTED BY THE MEASUREMENT. A second
      // `revertTo(1)` does NOT succeed, and the reason is structural rather
      // than a bug: the snapshot of revision 1 is a whole-store image taken
      // BEFORE the write that produced revision 2, so it contains pointer rows
      // for revisions 0..0 only -- a snapshot cannot record a snapshot of
      // itself. The idempotency that actually holds, and the one worth
      // asserting, is that the OBSERVABLE STORE STATE after "revert to r" and
      // after "revert to r, then attempt it again" is identical: the second
      // attempt is refused by name and changes nothing.
      assert.throws(
        () => revertTo(store, 1),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
          assert.match(e.message, /cannot revert to revision 1/);
          return true;
        },
      );
      assert.deepEqual(listRanges(store), rangesAfterFirst, "the refused second revert left every row exactly as the first revert left it");
      assert.equal(currentRevision(store), revisionAfterFirst, "and left the revision alone");

      // And the revision BELOW it is still reachable, which is what makes the
      // refusal above a bound rather than a dead end.
      store = revertTo(store, 0);
      assert.deepEqual(listRanges(store), [], "revision 0 is still retained and still reverts to an empty store");
      assert.equal(currentRevision(store), 0);
    } finally {
      closeStore(store);
    }
  });
});

// ---------------------------------------------------------------------------
// WR-22: `revertTo`'s `revision` argument is VALIDATED AT THE ENTRY, so an
// argument error stops wearing a corruption message.
//
// THE FINDING, REPRODUCED ON THE PRE-TASK TREE (round 5, WR-22). `revision` was
// typed `number` and reached TWO places with no validator: a bound SQL parameter
// and a FILENAME. SQLite applies the pointer column's INTEGER affinity to a
// bound TEXT operand, so `"1"`, `"0001"`, `" 1 "` and `"1.0"` all MATCH revision
// 1's row -- while `snapshotPathFor` builds `r0001.db`, `r 1 .db`, `r1.0.db`
// from the raw argument. The two then disagree, and the refusal a caller saw was
// CR-08's corruption message: "a pointer row claims it, but its snapshot
// .../r0001.db is not a readable annotation store". Worse, `"1"` produced no
// refusal at all: it silently reverted the store and returned a handle at
// revision 1.
//
// That is the exact confusion `AnnoStoreCorruptError`'s own doc comment forbids
// -- "the annotations are gone" and "there are no annotations" must not read the
// same -- committed by an ARGUMENT error. Hence a dedicated class OUTSIDE the
// corruption family, and hence the `!(thrown instanceof AnnoStoreCorruptError)`
// assertion below on every spelling: a caller must be able to tell "you passed
// the wrong thing" from "your ring is damaged" BY THE CLASS, without
// substring-matching a message.
//
// Phase 29 puts this argument on an MCP tool path whose validator is
// `validate: (value) => ({ value })`, so a JSON `"1"` arrives verbatim.
// ---------------------------------------------------------------------------

/** The four spellings SQLite's INTEGER affinity converts, asserted SEPARATELY
 * rather than as a loop over one representative: each produced a DIFFERENT
 * pre-task outcome (`"1"` reverted silently; the other three produced three
 * different corruption-flavoured messages), so one representative would have
 * proved one of four. */
const AFFINITY_SPELLINGS = ["1", "0001", " 1 ", "1.0"] as const;

for (const spelling of AFFINITY_SPELLINGS) {
  test(`WR-22: revertTo(handle, ${JSON.stringify(spelling)}) is refused as an ARGUMENT error, by name, before any read or write -- and is NOT in the corruption family`, () => {
    inTempDir((dir) => {
      const path = join(dir, "proj.annostore");
      const store = openStore(path, { workspaceRoot: dir });
      try {
        setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
        setDataType(store, { start: 0x2000, endInclusive: 0x200f, dataType: "code" });
        const revisionBefore = currentRevision(store);
        const rowsBefore = listRanges(store);

        assert.throws(
          () => revertTo(store, spelling as unknown as number),
          (e: unknown) => {
            assert.ok(
              e instanceof AnnoRevisionArgumentError,
              `expected AnnoRevisionArgumentError, got ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`,
            );
            // THE WHOLE FINDING, ASSERTED RATHER THAN REASONED ABOUT: an
            // argument error must not be readable as a damaged ring.
            assert.ok(
              !(e instanceof AnnoStoreCorruptError),
              "an argument error must NOT be in the corruption family -- that is the confusion this class exists to remove",
            );
            assert.ok(e instanceof AnnoStoreError, "but it must still be in the store's own named family, so one catch takes all of it");
            assert.ok(
              e.message.includes(JSON.stringify(spelling)),
              `the refusal must name the offending value VERBATIM (${JSON.stringify(spelling)}), got: ${e.message}`,
            );
            assert.match(e.message, /non-negative integer/, "and say what was expected");
            assert.equal(e.value, spelling, "and carry the offending value as a field, so a caller need not parse the prose");
            assert.equal(e.parameter, "revision", "and name the parameter it was supplied for");
            return true;
          },
        );

        // BEFORE ANY READ OR WRITE, and this is the half that distinguishes a
        // guard at the ENTRY from one bolted on further down: no staging file
        // was created, because the refusal precedes step 3 entirely.
        const revertStaging = readdirSync(dir).filter((n) => n.includes(".revert-"));
        assert.deepEqual(revertStaging, [], `a refused call must leave no .revert- staging file behind, found ${JSON.stringify(revertStaging)}`);

        // And the store is untouched -- the pre-task tree's `"1"` spelling
        // silently REVERTED here.
        assert.equal(currentRevision(store), revisionBefore, "a refused revert must not move the revision");
        assert.deepEqual(listRanges(store), rowsBefore, "nor change a single row");
      } finally {
        closeStore(store);
      }
    });
  });
}

test("WR-22: the numeric shapes that are not revisions -- -1, 1.5 and NaN -- are refused by the same class, before any pointer-row query runs", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
      setDataType(store, { start: 0x2000, endInclusive: 0x200f, dataType: "code" });

      for (const bad of [-1, 1.5, Number.NaN]) {
        assert.throws(
          () => revertTo(store, bad),
          (e: unknown) => {
            assert.ok(
              e instanceof AnnoRevisionArgumentError,
              `${String(bad)}: expected AnnoRevisionArgumentError, got ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`,
            );
            assert.ok(!(e instanceof AnnoStoreCorruptError), `${String(bad)}: and NOT a corruption refusal`);
            return true;
          },
        );
      }

      const revertStaging = readdirSync(dir).filter((n) => n.includes(".revert-"));
      assert.deepEqual(revertStaging, [], `no refused call may leave a .revert- staging file behind, found ${JSON.stringify(revertStaging)}`);
    } finally {
      closeStore(store);
    }
  });
});

test("WR-22, THE POSITIVE COMPANION: revertTo(handle, 1) on a healthy store still SUCCEEDS and returns a handle at revision 1 -- the refusal was not bought by broadening", () => {
  // A refusal control with no positive companion cannot distinguish a correct
  // guard from one that refuses everything, and this phase has already recorded
  // a refusal bought by broadening. So the accepted case is asserted in the same
  // block a reader finds the refusals in.
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
      setDataType(store, { start: 0x2000, endInclusive: 0x200f, dataType: "code" });
      assert.equal(currentRevision(store), 2, "the store must genuinely be past revision 1, or reverting to it proves nothing");

      store = revertTo(store, 1);
      assert.equal(currentRevision(store), 1, "revertTo(handle, 1) must still put the store back at revision 1");
      assert.equal(listRanges(store).length, 1, "with exactly the one range that existed at revision 1");
    } finally {
      closeStore(store);
    }
  });
});


// ---------------------------------------------------------------------------
// WR-24: `revertTo` stages under a name unique PER ATTEMPT, and removes it
// through the ONE helper the module already has.
//
// The finding: `revertTo`'s staging name was `${storePath}.revert-<pid>-<rev>`
// -- unique per (pid, revision) -- where `stageSnapshot`'s is per ATTEMPT, and
// `stageSnapshot`'s own doc comment states in capitals WHY per-attempt is the
// rule: a revision number can recur after a revert, and two attempts at the same
// revision must not share a path. Two consequences followed. A second attempt's
// copy could overwrite the first's between its step-3b validation and its step-5
// rename, so the image judged was not the image installed; and each of three
// bare `rmSync(staging, { force: true })` cleanups could delete another
// attempt's in-flight file.
// ---------------------------------------------------------------------------

test("WR-24, BEHAVIOURAL: several sequential reverts to the SAME revision each succeed and leave ZERO revert-staging residue behind", () => {
  // THE HALF THAT IS GENUINELY CONSTRUCTIBLE. Two truly concurrent attempts
  // cannot be built in-process, so what is proved here is the sequential
  // property that actually has a reachable input: every exit `revertTo` takes
  // removes its own staging file, through all three of its cleanup sites and
  // through the successful path's rename. A file left behind by any one of them
  // is precisely what a later attempt would collide with.
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      for (let i = 0; i < 6; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }
      assert.equal(currentRevision(store), 6, "the store must be past the revision reverted to, or the reverts prove nothing");

      // FOUR sequential reverts to the SAME revision, each on the handle the
      // previous one returned. Each rebuilds the store from revision 2's image,
      // so revision 2 stays reachable and each attempt is a real revert rather
      // than a no-op.
      const REVERTS = 4;
      let accepted = 0;
      for (let attempt = 0; attempt < REVERTS; attempt += 1) {
        store = revertTo(store, 2);
        assert.equal(currentRevision(store), 2, `attempt ${attempt + 1}: revertTo(2) must return a handle at revision 2`);
        assert.equal(listRanges(store).length, 2, `attempt ${attempt + 1}: with exactly the two ranges revision 2 held`);
        accepted += 1;

        // And the store has to be moved forward again, or attempt N+1 would be
        // reverting to the revision it is already at.
        setDataType(store, { start: 0x3000, endInclusive: 0x300f, dataType: "code" });
      }
      assert.equal(accepted, REVERTS, `all ${REVERTS} attempts at the SAME revision must have been accepted`);

      const residue = readdirSync(dir).filter((n) => n.includes(".revert-"));
      assert.equal(
        residue.length,
        0,
        `no attempt may leave a revert-staging file behind for the next one to collide with, found ${JSON.stringify(residue)}`,
      );
    } finally {
      closeStore(store);
    }
  });
});

test("WR-24, STRUCTURAL: revertTo's staging name derives from randomUUID, and all three of its cleanups route through discardSnapshot rather than a bare rmSync", () => {
  // WHY THIS IS STRUCTURAL, AND WHAT ITS EVIDENCE IS WORTH -- stated in the
  // control itself, because this file's conventions forbid a structural
  // assertion that does not say why it is one, and because 28-17 P5 forbids a
  // uniqueness claim whose only evidence is that the code was written down.
  //
  // THE COLLISION-AVOIDANCE CLAIM IS NOT PROVED HERE. Two genuinely concurrent
  // `revertTo` attempts cannot be constructed in-process, so the in-process
  // evidence for "no two attempts can share a staging path" is that the name is
  // built from `randomUUID` -- PRESENCE, not behaviour. That claim is filed as a
  // `backstop` truth in this plan's summary with exactly that reason. What this
  // control DOES prove is that the derivation and the cleanup routing have not
  // silently regressed, which the behavioural control above cannot see: a bare
  // `rmSync` removes the file just as well on the sequential path.
  //
  // LITERAL BODIES KEPT (`codeOnly(src, true)`): the surrounding function is
  // identified by source text and strict mode would blank the literals that make
  // the body substantial.
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);

  const fnStart = stripped.indexOf("export function revertTo");
  assert.ok(fnStart >= 0, "revertTo must be findable in the stripped source");
  const fnEnd = stripped.indexOf("\n}", fnStart);
  assert.ok(fnEnd > fnStart, "and revertTo's body must terminate at a column-zero closing brace");
  const body = stripped.slice(fnStart, fnEnd);

  // NON-VACUITY FIRST: a failed extraction satisfies an absence assertion
  // trivially, which is how a control comes to pass for the wrong reason.
  assert.ok(body.length > 800, `the extracted revertTo body must be substantial, got ${body.length} characters`);

  // THE DERIVATION. Recorded as the matched source line so the summary can quote
  // what the control actually saw rather than what it hoped for.
  const stagingLine = body.split("\n").find((l) => l.includes("const staging = "));
  assert.ok(stagingLine !== undefined, "revertTo must still assign a staging path");
  assert.match(
    stagingLine,
    /randomUUID\(\)/,
    `revertTo's staging name must derive from randomUUID -- the same primitive stageSnapshot uses -- got: ${stagingLine.trim()}`,
  );
  assert.match(stagingLine, /\.revert-/, `and must keep the .revert- marker so a leaked file is attributable, got: ${stagingLine.trim()}`);

  // THE POSITIVE COUNT IS THE PRIMARY ASSERTION. Counting the thing that must be
  // PRESENT is what fails when a call site is quietly changed back; a count of
  // the removed spelling alone would also pass on a body that lost a cleanup
  // entirely.
  const discards = body.split("discardSnapshot(staging)").length - 1;
  assert.equal(
    discards,
    3,
    `revertTo must route all three of its staging cleanups through discardSnapshot -- the module's one place a staging file is ` +
      `removed -- found ${discards}`,
  );

  // AND THE SECONDARY ASSERTION, DELIBERATELY SCOPED TO THIS FUNCTION'S BODY
  // and never to the module: `rmSync` is legitimately used elsewhere in
  // `anno-store.ts` (the ring sweep, the prune loop, `discardSnapshot` itself),
  // so a module-wide count would be asserting something false.
  const bareRemovals = body.split("rmSync(staging").length - 1;
  assert.equal(bareRemovals, 0, `and must contain no bare rmSync on the staging path, found ${bareRemovals}`);
});

// ---------------------------------------------------------------------------
// THE SECOND REVERT, AND THE ONE OWNERSHIP INVARIANT BEHIND IT
// (gap 1 = CR-01 + WR-02).
//
// A revision is RETAINED only when BOTH halves of its record exist: its
// pointer ROW in `anno_snapshot` and its FILE in `snapshots/`.
// `retainedRevisions()` in `anno-store.ts` is the ONE definition of that, and
// the published floor, the revert refusal, the half-state resolver and -- via
// the resolver -- the prune bound all read it rather than each deciding for
// themselves. The proofs below are what stops them drifting apart again,
// because they exercise the one state in which the two halves can disagree: a
// store that has been REVERTED at least once.
//
// THE DEFECT THEY PIN, reproduced on the committed code before the fix: after
// 40 writes and `revertTo(8)` the restored `anno_snapshot` table held pointer
// rows 0..7 whose files the prune had already deleted, `oldestRetainedRevision()`
// published `0`, and following that published floor threw
// `Error: ENOENT ... copyfile '.../r0.db'` -- a bare Node error outside the
// `ViceError` family -- after `revertTo` had already closed the caller's
// handle, so there was nothing left to diagnose with.
// ---------------------------------------------------------------------------

/**
 * The two halves of the snapshot ring, read INDEPENDENTLY of the code under
 * test: the revisions the pointer rows name, and the revisions the FILES on
 * disk name. A consistent ring has them equal.
 *
 * Deliberately not routed through `retainedRevisions()`: a measurement taken
 * with the function under test would agree with it by construction, which is
 * the one thing a control must not do.
 *
 * AND THE SAME REASONING COVERS THE LAYOUT, AND COVERS THE SUFFIX CONSTANT
 * EXACTLY AS MUCH AS THE HELPER. The ring directory is spelled out HERE, in the
 * test -- never through `snapshotDirFor()`, and never through an imported
 * `SNAPSHOT_DIR_SUFFIX`. If a future edit moves the ring, this site must go RED;
 * a site that asks the code under test where the ring is, or that reuses the
 * constant the code decides it with, would silently follow it there instead.
 *
 * THE STORE FILENAME IS AN EXPLICIT PARAMETER, and it is the independent control
 * the CR-01 two-stores-in-one-directory test needs: that test's whole subject is
 * two rings in ONE directory, and a control hardcoded to `proj.annostore` cannot
 * be pointed at `game.annostore` to express it. Duplicating this helper to work
 * around that is how the two halves of one control drift apart. The default
 * keeps every other caller unchanged.
 */
function ringHalves(
  handle: ReturnType<typeof openStore>,
  dir: string,
  storeFile: string = "proj.annostore",
): { rowRevisions: number[]; fileRevisions: number[] } {
  const rowRevisions = (handle.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[]).map(
    (row) => row.revision,
  );
  const snapshotDir = join(dir, `${storeFile}.snapshots`);
  const fileRevisions = (existsSync(snapshotDir) ? readdirSync(snapshotDir) : [])
    .map((name) => /^r(\d+)\.db$/.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
  return { rowRevisions, fileRevisions };
}

/** The revisions whose pointer row survives WITHOUT its file -- the forbidden
 * direction, and the state the whole gap exists to close. Read straight off
 * the rows, again independently of the code under test.
 *
 * THE ROW NO LONGER CARRIES A PATH TO TEST. `anno_snapshot` has exactly one
 * column from `SCHEMA_VERSION` 2 on, so this is the difference of the two halves
 * `ringHalves` reads -- and it is expressed THROUGH `ringHalves` rather than by
 * spelling the ring directory a SECOND time in this file. One layout spelling in
 * the test tree is the point: two would be two halves of one control, free to
 * drift apart, which is the very failure mode the store side was just fixed for.
 * `ringHalves` is itself independent of the code under test, so the difference
 * is too. */
function orphanRowRevisions(handle: ReturnType<typeof openStore>, dir: string, storeFile: string = "proj.annostore"): number[] {
  const { rowRevisions, fileRevisions } = ringHalves(handle, dir, storeFile);
  const onDisk = new Set(fileRevisions);
  return rowRevisions.filter((revision) => !onDisk.has(revision));
}

// ---------------------------------------------------------------------------
// CR-01 -- WHICH STORE OWNS A SNAPSHOT.
//
// Reproduced against committed code by the phase-28 verifier: with two stores
// in ONE directory, both wrote into a single shared `<dir>/snapshots/` ring
// under the SAME `r<revision>.db` filenames, and `revertTo(game, 1)` restored
// `loader.annostore`'s whole database over `game.annostore` -- silently, with
// no error, returning the NEIGHBOUR's rows. The fix is a rename of the
// LOCATION (`snapshotDirFor` keys the ring on `basename(handle.path)`), not an
// ownership predicate over the shared location: revision numbers are not
// unique across stores, so every per-revision predicate answers "mine" to both
// stores. See `snapshotDirFor`'s doc comment.
//
// THE ASSERTION IS ON THE ROW SET, not on "it did not throw". The reproduced
// defect was a silent WRONG ANSWER, so an absence-of-error assertion is
// precisely the one that would have passed on the broken code.
// ---------------------------------------------------------------------------

test("CR-01: two stores in ONE directory keep separate snapshot rings -- reverting game.annostore to its own revision returns ITS rows, never the neighbour's", () => {
  inTempDir((dir) => {
    const gamePath = join(dir, "game.annostore");
    const loaderPath = join(dir, "loader.annostore");

    let game = openStore(gamePath, { workspaceRoot: dir });
    const loader = openStore(loaderPath, { workspaceRoot: dir });
    try {
      // Two writes each, so each store holds revisions 0 and 1 in its ring and
      // the two rings' FILENAMES collide exactly as they did on the broken
      // code. The data types are deliberately disjoint -- `code` for the game,
      // `petscii` for the loader, matching the verifier's own reproduction --
      // so a restored row set can never be mistaken for the other store's.
      setDataType(game, { start: 0x0810, endInclusive: 0x081f, dataType: "code" });
      setDataType(game, { start: 0x0820, endInclusive: 0x082f, dataType: "code" });
      setDataType(loader, { start: 0x0810, endInclusive: 0x081f, dataType: "petscii" });
      setDataType(loader, { start: 0x0820, endInclusive: 0x082f, dataType: "petscii" });

      // THE STRUCTURAL CLAIM: the two rings are different directories. This
      // goes red the instant a per-directory ring is reintroduced, because
      // both stores' rings would collide again.
      assert.notEqual(
        snapshotDirFor(game),
        snapshotDirFor(loader),
        "two stores in one directory must have two DIFFERENT snapshot rings -- a shared ring is CR-01 itself",
      );

      const gameRowsBefore = listRanges(game);
      const loaderRowsBefore = listRanges(loader);
      assert.equal(gameRowsBefore.length, 2, "the game store holds its own two rows before the revert");
      assert.equal(loaderRowsBefore.length, 2, "and the loader store holds its own two");

      // THE BEHAVIOURAL CLAIM, and the one that reproduces the defect: revision
      // 1 of the GAME store must restore the game's own single row.
      game = revertTo(game, 1);
      const restored = listRanges(game);

      assert.deepEqual(
        restored.map((row) => row.dataType),
        ["code"],
        `revertTo(game, 1) must restore the GAME's own pre-mutation state -- one \`code\` row. Got ` +
          `${JSON.stringify(restored)}. A \`petscii\` row here is the neighbour's database restored over this one, which is CR-01.`,
      );
      assert.equal(restored[0].start, 0x0810, "and it is the game's own first range");
      assert.equal(
        restored.filter((row) => row.dataType === "petscii").length,
        0,
        "no row from loader.annostore may appear in game.annostore's restored state",
      );

      // AND THE NEIGHBOUR IS UNTOUCHED IN THE OTHER DIRECTION TOO: reverting
      // one store must not consume, move or overwrite the other's ring.
      assert.deepEqual(listRanges(loader), loaderRowsBefore, "reverting the game store left the loader store's rows alone");
      assert.deepEqual(
        retainedRevisions(loader),
        [0, 1],
        "and left the loader's OWN snapshot ring intact -- the game's revert may not consume the neighbour's retained revisions",
      );
    } finally {
      closeStore(game);
      closeStore(loader);
    }
  });
});

// ---------------------------------------------------------------------------
// CR-03 -- WHICH REVISION, AND WHERE IT IS FOUND.
//
// Reproduced against committed code by the phase-28 verifier: version 1 stored
// the snapshot's ABSOLUTE path in `anno_snapshot.path` and tested THAT for
// existence. One `mv` of the containing directory invalidated every persisted
// path at once, after which `retainedRevisions()` reported `[]` and
// `oldestRetainedRevision()` reported `-1` -- while five snapshot files sat
// untouched on disk -- and the very next accepted write's prune deleted all five
// files and all five pointer rows.
//
// The fix is to remove the PRIMITIVE, not to repair the string: with nothing
// about a snapshot persisted except its revision number, there is no second
// absolute truth left for a renamed ancestor -- or a bind mount seen from two
// namespaces, or a symlinked parent, or a container/host path pair -- to
// disagree with.
// ---------------------------------------------------------------------------

test("CR-03: renaming the containing directory destroys nothing -- after the move and one accepted write the retained revisions and the snapshot files are the ones that were there before", () => {
  inTempDir((parent) => {
    // The store lives one level DOWN, so the directory that gets renamed is the
    // store's own containing directory and the temp root stays put for cleanup.
    const beforeDir = join(parent, "project");
    mkdirSync(beforeDir);
    const storeName = "proj.annostore";

    let retainedBefore: number[] = [];
    let oldestBefore = NO_RETAINED_REVISION;
    let filesBefore: string[] = [];

    const first = openStore(join(beforeDir, storeName), { workspaceRoot: parent });
    try {
      for (let i = 0; i < 5; i += 1) {
        setDataType(first, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }
      retainedBefore = retainedRevisions(first);
      oldestBefore = oldestRetainedRevision(first);
      // The ring is spelled out HERE rather than asked of `snapshotDirFor()`,
      // for the reason `ringHalves` states: a control that asks the code under
      // test where the ring is would follow it anywhere.
      filesBefore = readdirSync(join(beforeDir, "proj.annostore.snapshots")).sort();

      assert.deepEqual(retainedBefore, [0, 1, 2, 3, 4], "five writes retain five revisions before the move");
      assert.deepEqual(filesBefore, ["r0.db", "r1.db", "r2.db", "r3.db", "r4.db"], "and five snapshot files are on disk");
      assert.equal(oldestBefore, 0, "with revision 0 as the published floor");
    } finally {
      closeStore(first);
    }

    // THE MOVE. A plain rename of the containing directory, in the same parent --
    // the shape of a user renaming a project folder, and the shape that used to
    // destroy the whole revert history on the next write.
    const afterDir = join(parent, "project-renamed");
    renameSync(beforeDir, afterDir);

    let second = openStore(join(afterDir, storeName), { workspaceRoot: parent });
    try {
      // ONE ACCEPTED WRITE -- which is what runs the prune, and the prune is what
      // did the destroying. The claims below are made AFTER it, deliberately.
      setDataType(second, { start: 0x2000, endInclusive: 0x200f, dataType: "code" });

      const filesAfter = readdirSync(join(afterDir, "proj.annostore.snapshots")).sort();
      for (const name of filesBefore) {
        assert.ok(
          filesAfter.includes(name),
          `${name} was on disk before the move and must still be on disk after it and after one accepted write; found ${filesAfter.join(", ")}`,
        );
      }

      const retainedAfter = retainedRevisions(second);
      assert.deepEqual(
        retainedAfter,
        [...retainedBefore, 5],
        `the move destroyed no retained revision: the pre-move list ${retainedBefore.join(", ")} plus the revision the new write added. ` +
          `Got ${retainedAfter.join(", ") || "(none)"} -- an empty list here is CR-03 itself, and it is the state from which the prune ` +
          "deleted every file.",
      );
      assert.equal(
        oldestRetainedRevision(second),
        oldestBefore,
        "and the published floor is the same one it published before the move, not NO_RETAINED_REVISION",
      );
      assert.notEqual(oldestRetainedRevision(second), NO_RETAINED_REVISION, "explicitly: the ring is not reported empty");

      // AND THE FLOOR IS ONE `revertTo` CAN HONOUR, which is what makes the
      // claim above a capability rather than a bookkeeping figure. `revertTo`
      // closes the handle it was given and returns a new one, so the reassignment
      // is what keeps the `finally` below closing exactly one live handle.
      second = revertTo(second, oldestBefore);
      assert.deepEqual(listRanges(second), [], "revision 0 is still genuinely reachable across the move");
    } finally {
      closeStore(second);
    }
  });
});

test("a SECOND revert after a prune: the reconciled ring holds no half-state, the published floor is one revertTo can honour, and a refusal is an AnnoStoreError that leaves the caller's handle usable", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      const writes = MAX_SNAPSHOT_REVISIONS + 8;
      for (let i = 0; i < writes; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }
      const firstFloor = oldestRetainedRevision(store);
      assert.ok(firstFloor > 0, `the ring must genuinely have pruned before the first revert, floor was ${firstFloor}`);

      // NON-VACUITY OF THE READER, TAKEN BEFORE THE REVERT. After this
      // particular revert the reconciled ring is legitimately EMPTY, so a
      // length assertion on the post-revert sets alone would be satisfied by a
      // scan that read nothing at all. Measuring the SAME reader against a
      // populated ring first is what makes the post-revert agreement mean
      // something.
      const beforeRevert = ringHalves(store, dir);
      assert.equal(beforeRevert.rowRevisions.length, MAX_SNAPSHOT_REVISIONS, "the forward-only ring holds exactly the bound in pointer rows");
      assert.equal(beforeRevert.fileRevisions.length, MAX_SNAPSHOT_REVISIONS, "and exactly the bound in files -- the reader sees both halves");
      assert.deepEqual(beforeRevert.fileRevisions, beforeRevert.rowRevisions, "and they agree before any revert");

      store = revertTo(store, firstFloor);
      assert.equal(currentRevision(store), firstFloor, "the first revert lands on the revision it was asked for");

      // (a) NO REVISION THE STORE ADVERTISES MAY LACK EITHER HALF. This used
      // to demand `orphanRowRevisions == []`, i.e. that no pointer row survive
      // its file. CR-05 removed the statement that made that true: the sweep
      // deleted rows it could not establish ownership of, and under a second
      // spelling of the same store file that was every row the store had, so
      // the row direction was abandoned. Measured on this path, the restored
      // image reinstates rows 0..firstFloor-1 whose files an earlier prune
      // removed and they are now TOLERATED: rows [0..firstFloor-1], files [].
      //
      // The invariant that survives -- and the only one worth asserting -- is
      // that nothing the store ADVERTISES is half-present. `retainedRevisions`
      // may legitimately be empty here (see the comment above the pre-revert
      // block: after this revert the ring is empty), so the check is over its
      // elements, not its length.
      const advertised = retainedRevisions(store);
      const halvesAfterRevert = ringHalves(store, dir);
      for (const revision of advertised) {
        assert.ok(
          halvesAfterRevert.rowRevisions.includes(revision) && halvesAfterRevert.fileRevisions.includes(revision),
          `the store advertises r${revision} as retained, so BOTH halves of its record must exist -- rows ${JSON.stringify(halvesAfterRevert.rowRevisions)}, files ${JSON.stringify(halvesAfterRevert.fileRevisions)}`,
        );
      }

      // (b) AND NO FILE MAY SURVIVE UNCLAIMED. A revert orphans every snapshot
      // taken after the revision restored -- up to MAX_SNAPSHOT_REVISIONS of
      // them -- and the bound is computed over rows, so an unclaimed file is
      // invisible to it forever (CR-01 consequence 4). Since CR-05 the two
      // halves are no longer EQUAL -- the rows are a strict superset, measured
      // [0..firstFloor-1] against [] -- so the claim is SUBSET, not deep-equal:
      // the unclaimed-FILE direction is still swept and still asserted, while
      // the row direction is tolerated.
      const afterRevert = halvesAfterRevert;
      for (const revision of afterRevert.fileRevisions) {
        assert.ok(
          afterRevert.rowRevisions.includes(revision),
          `no snapshot FILE may survive unclaimed by a pointer row: r${revision} is on disk with no row, files ${JSON.stringify(afterRevert.fileRevisions)} vs rows ${JSON.stringify(afterRevert.rowRevisions)}`,
        );
      }
      assert.ok(
        afterRevert.fileRevisions.length <= MAX_SNAPSHOT_REVISIONS,
        `the directory bound must hold AFTER a revert as well as before it, found ${afterRevert.fileRevisions.length} files`,
      );

      // (c) THE PUBLISHED FLOOR IS HONOURABLE, whichever it is.
      const secondFloor = oldestRetainedRevision(store);
      if (secondFloor !== NO_RETAINED_REVISION) {
        assert.ok(
          existsSync(snapshotPathFor(store, secondFloor)),
          `the store published ${secondFloor} as its floor, so a snapshot file for it must exist -- a floor naming an unreachable revision is worse than no floor`,
        );
      }

      // (d) THE SECOND REVERT. BOTH ARMS ARE COVERED EXPLICITLY, and the
      // reason is not symmetry for its own sake: which arm this state takes
      // depends on what the reconciliation found, and a test that asserted
      // only the arm its author expected would silently stop testing anything
      // the day the state changed. The DETERMINISTIC succeeding case is driven
      // separately in the next test, because an arm that is never executed
      // proves nothing.
      if (secondFloor === NO_RETAINED_REVISION) {
        assert.throws(
          () => revertTo(store, 0),
          (e: unknown) => {
            assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
            assert.ok(
              e instanceof ViceError,
              "and it must stay inside the ViceError family -- a raw ENOENT out of copyFileSync is the exact failure this asserts against",
            );
            assert.match(e.message, /cannot revert to revision 0/, "the refusal must name the revision that was asked for");
            return true;
          },
        );
        // WR-02: THE REFUSAL LEFT THE CALLER A USABLE HANDLE. Asserted rather
        // than assumed -- before the fix every call after a failed revert
        // threw `database is not open`.
        assert.equal(currentRevision(store), firstFloor, "the refused second revert left the connection open and currentRevision answering");
        assert.equal(listRanges(store).length, firstFloor, "and listRanges still readable through the same handle");
      } else {
        store = revertTo(store, secondFloor);
        assert.equal(currentRevision(store), secondFloor, "the second revert lands on exactly the floor the store published");
        // CR-05, re-stated for consistency with the (a) block above: an orphan
        // ROW is tolerated, so the claim is the ADVERTISED-revision invariant
        // rather than an empty orphan set. MEASURED UNREACHED on this path --
        // `secondFloor` is NO_RETAINED_REVISION both before and after the
        // change, so this arm never executes -- and re-stated anyway so it does
        // not become a trap the day the state changes.
        const afterSecond = ringHalves(store, dir);
        for (const revision of retainedRevisions(store)) {
          assert.ok(
            afterSecond.rowRevisions.includes(revision) && afterSecond.fileRevisions.includes(revision),
            `the store advertises r${revision}, so both halves of its record must exist after the second revert`,
          );
        }
      }
    } finally {
      closeStore(store);
    }
  });
});

test("the DETERMINISTIC succeeding second revert: after a first revert, three republishing writes make the published floor a revision whose file exists, and reverting to it restores exactly the row set captured before those writes", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      // THE POSITIVE ARM OF GAP 1's "revertTo, then oldestRetainedRevision,
      // then revertTo" pin. The two-arm test above is a STATE-DEPENDENT proof
      // and on the reachable state it takes the REFUSAL arm; that arm closes
      // the real defect and stays. This test drives the SUCCEEDING case
      // deterministically instead, and contains NO branch on the floor's value
      // -- a branch here would reintroduce exactly the unreachability it
      // exists to remove.
      const writes = MAX_SNAPSHOT_REVISIONS + 8;
      for (let i = 0; i < writes; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }
      store = revertTo(store, oldestRetainedRevision(store));

      const revBefore = currentRevision(store);
      const rowsBefore = listRanges(store);
      assert.ok(rowsBefore.length > 0, "the state being captured must be a real one, or the deepEqual below is trivially satisfiable");

      // THREE REPUBLISHING WRITES, AND THIS IS WHAT MAKES THE CASE
      // DETERMINISTIC. Each accepted write takes a pre-mutation snapshot of
      // its OWN base revision and inserts that revision's pointer row inside
      // the same transaction, so afterwards the ring holds three rows whose
      // three files all exist -- no reconciliation can drop any of them, and
      // the floor is the first of the three by construction rather than by
      // luck.
      for (let i = 0; i < 3; i += 1) {
        setDataType(store, { start: 0x8000 + i * 0x10, endInclusive: 0x8000 + i * 0x10 + 0x0f, dataType: "code" });
      }

      const republished = ringHalves(store, dir);
      // CR-05 RE-BASED THIS PAIR ONTO THE HALF THE THREE WRITES ACTUALLY
      // PRODUCE. It used to assert `rowRevisions.length === 3` and that the two
      // halves deep-equal. Since the sweep abstains from the row direction, the
      // rows carried over from before the revert survive alongside the three
      // republished ones -- measured 11 rows ([0..10]) against 3 files
      // ([8,9,10]) -- so both old assertions are red for a state that is
      // correct. The three writes' own product is the FILE half: that is what
      // is asserted, plus the surviving no-unclaimed-FILE direction.
      assert.deepEqual(
        republished.fileRevisions,
        [revBefore, revBefore + 1, revBefore + 2],
        "the three writes republished exactly three snapshot FILES, at the three consecutive revisions starting where the first revert landed",
      );
      for (const revision of republished.fileRevisions) {
        assert.ok(
          republished.rowRevisions.includes(revision),
          `no snapshot FILE may survive unclaimed: r${revision} has no pointer row, rows ${JSON.stringify(republished.rowRevisions)}`,
        );
      }

      const floor = oldestRetainedRevision(store);
      assert.notEqual(floor, NO_RETAINED_REVISION, "the ring is not empty, so the store must publish a floor rather than the empty sentinel");
      assert.equal(floor, revBefore, "and the floor is the revision the first revert landed on -- the oldest of the three republished snapshots");
      assert.ok(existsSync(snapshotPathFor(store, revBefore)), "whose file exists, which is what makes the floor honourable");

      store = revertTo(store, revBefore);
      assert.equal(currentRevision(store), revBefore, "the SECOND revert succeeded and landed on the revision the store published as its floor");
      assert.deepEqual(
        listRanges(store),
        rowsBefore,
        "and restored EXACTLY the row set captured before the three republishing writes -- the array, not its length",
      );

      // CR-05: the same three sites as in the two-arm test above, re-stated the
      // same way. Measured after this second revert: rows [0..7], files [] --
      // so a length equality (0 vs 8), a deep-equal ([] vs [0..7]) and an empty
      // orphan set are all red for a state that is correct. What survives is
      // that no FILE is unclaimed and that nothing the store ADVERTISES is
      // half-present; the tolerated rows are inert because every consumer of
      // "retained" requires the file as well as the row.
      const after = ringHalves(store, dir);
      for (const revision of after.fileRevisions) {
        assert.ok(
          after.rowRevisions.includes(revision),
          `no snapshot FILE may survive unclaimed after the second revert: r${revision} has no pointer row, rows ${JSON.stringify(after.rowRevisions)}`,
        );
      }
      for (const revision of retainedRevisions(store)) {
        assert.ok(
          after.rowRevisions.includes(revision) && after.fileRevisions.includes(revision),
          `the store advertises r${revision} as retained, so BOTH halves of its record must exist -- rows ${JSON.stringify(after.rowRevisions)}, files ${JSON.stringify(after.fileRevisions)}`,
        );
      }
    } finally {
      closeStore(store);
    }
  });
});

test("STORE-03, post-revert EMPTY: reverting to a revision that held zero ranges leaves listRanges empty and the paint index resolving NO_ROW at every one of the 65,536 addresses", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      // One write from a fresh store, so revision 0's snapshot is an image of
      // a store with no ranges at all.
      setDataType(store, { start: 0x0400, endInclusive: 0x04ff, dataType: "byte" });
      assert.equal(listRanges(store).length, 1, "the write landed, so the revert below has something to undo");

      store = revertTo(store, 0);
      assert.equal(currentRevision(store), 0, "revision 0 is the state before the only write");
      assert.deepEqual(listRanges(store), [], "and it held zero ranges");

      const index = paintIndexOf(store);
      let comparisons = 0;
      let covered = 0;
      for (let address = 0x0000; address <= 0xffff; address += 1) {
        comparisons += 1;
        if (resolveAt(index, address) !== NO_ROW) covered += 1;
      }

      // THE NON-VACUITY HALF, ASSERTED FIRST: a loop that silently visited
      // zero addresses would satisfy the emptiness assertion below on its own.
      assert.equal(comparisons, 0x10000, `the sweep must be EXHAUSTIVE, not sampled -- expected 65536 comparisons, performed ${comparisons}`);
      assert.equal(covered, 0, `a restored empty store must resolve NO_ROW everywhere, ${covered} addresses resolved to a row`);
    } finally {
      closeStore(store);
    }
  });
});

test("STORE-03, post-revert ORDERING: after a revert listRanges is in ascending id order and the paint index is exactly buildPaintIndex(listRanges) -- nothing derived survived the restore", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      for (let i = 0; i < 4; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x100, endInclusive: 0x1000 + i * 0x100 + 0xff, dataType: "byte" });
      }
      // A partial overwrite, so the restored state has SPLIT rows whose ids are
      // not a contiguous run -- an ordering assertion over four untouched rows
      // would hold under almost any bug.
      setDataType(store, { start: 0x1140, endInclusive: 0x117f, dataType: "code" });
      assert.ok(listRanges(store).length > 4, "the partial overwrite really did split a row");

      store = revertTo(store, 2);
      const rows = listRanges(store);
      assert.equal(rows.length, 2, "revision 2 held exactly the first two ranges");
      for (let i = 1; i < rows.length; i += 1) {
        assert.ok(rows[i].id > rows[i - 1].id, `listRanges must be in ASCENDING id order, row ${i} has id ${rows[i].id} after ${rows[i - 1].id}`);
      }
      assert.deepEqual(
        paintIndexOf(store),
        buildPaintIndex(rows),
        "the restored store's narrowest-wins answer is exactly reconstructible from its rows -- nothing derived is cached on disk and nothing derived survived the restore",
      );
    } finally {
      closeStore(store);
    }
  });
});

test("STORE-02 non-vacuity: the code this gap closure adds is inside the source the no-splitter structural scan reads", () => {
  // `anno-overlap.test.ts:487` asserts that `coalesc`, `merg` and `splitter`
  // appear NOWHERE in `codeOnly(anno-store.ts)`. An ABSENCE assertion over
  // source that does not contain the new code proves nothing about the new
  // code, so the presence of the two new identifiers is pinned here. Together
  // the two make the adjacency guarantee non-vacuous over this plan's
  // additions.
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"));
  assert.ok(stripped.includes("retainedRevisions"), "the one ownership predicate must be in the source the absence scan reads");
  assert.ok(stripped.includes("reconcileSnapshotRing"), "and so must the one half-state resolver");
  const offenders = ["coalesc", "merg", "splitter"].filter((needle) => stripped.toLowerCase().includes(needle));
  assert.deepEqual(offenders, [], "and neither new identifier -- nor anything else in the file -- may name a merging or splitting primitive");
});

// ---------------------------------------------------------------------------
// THE TWO PRUNE HALF-STATES, AND THE SOURCE ORDER THAT DECIDES WHICH ONE A
// KILL CAN REACH (gap 2 = WR-01).
//
// `pruneSnapshots` deletes a doomed revision's POINTER ROW and then unlinks its
// FILE, outside any transaction. A kill landing between those two adjacent
// statements therefore produces one of exactly two states, and the ORDER is
// what chooses which:
//
//   * row-then-file (what the loop does now) can only leave an orphan FILE --
//     harmless, and reconcilable by revision number from the filename alone;
//   * file-then-row (what it used to do) can leave an orphan ROW -- a pointer
//     aimed at a file that is already gone, which is the one failure direction
//     the revert path cannot survive.
//
// WHY THE TWO STATES ARE CONSTRUCTED RATHER THAN TIMED. The real interleaving
// is a kill between two adjacent statements inside a loop, and reaching it
// from a test would require a hook planted inside `anno-store.ts` itself.
// Planting test scaffolding in a shipped module is REFUSED here: it converts
// the code under test into code that exists only for the test, so the control
// would no longer be measuring the shipped path. The guarantee is therefore
// proven as the two states the kill can produce, constructed directly, PLUS
// the source-order control below that pins which of the two a kill can
// actually reach. `28-REVIEW.md` and `28-VERIFICATION.md` both reproduced
// CR-02's interleaving the same way -- by performing the losing writer's
// statements directly.
// ---------------------------------------------------------------------------

test("prune half-state A, the orphan ROW (the inert direction): a pointer row whose file is gone is never retained, never published as the floor, refused BY NAME rather than crashed on, and TOLERATED by the next accepted write", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const writes = MAX_SNAPSHOT_REVISIONS + 8;
      for (let i = 0; i < writes; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }

      const retainedBefore = retainedRevisions(store);
      assert.equal(retainedBefore.length, MAX_SNAPSHOT_REVISIONS, "the ring is full before the half-state is constructed");
      // The state a kill between the two statements CANNOT produce under the
      // present order, constructed directly: the file removed, the row left.
      const victim = retainedBefore[retainedBefore.length - 1];
      rmSync(snapshotPathFor(store, victim), { force: true });
      const rowStillThere = store.db.prepare("select revision from anno_snapshot where revision = ?").get(victim) as
        | { revision: number }
        | undefined;
      assert.ok(rowStillThere, "the construction really did leave the pointer row behind -- that is the half-state under test");

      assert.ok(!retainedRevisions(store).includes(victim), "a row without its file is NOT retained -- both halves are required");
      assert.notEqual(oldestRetainedRevision(store), victim, "and it is never published as the floor");

      assert.throws(
        () => revertTo(store, victim),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
          assert.ok(e instanceof ViceError, "the refusal stays inside the ViceError family -- never a bare ENOENT out of copyFileSync");
          assert.match(e.message, new RegExp(`cannot revert to revision ${victim}`), "and it names the revision that was asked for");
          return true;
        },
      );
      assert.equal(currentRevision(store), writes, "the refused revert left the handle open and answering");
      assert.ok(listRanges(store).length > 0, "and the rows still readable through it");

      // One further accepted write, whose prune reconciles first.
      //
      // CR-05 INVERTED THESE TWO ASSERTIONS, AND THE INVERSION IS THE FINDING.
      // They used to demand that the orphan ROW be GONE after one accepted
      // write. The sweep that deleted it could not distinguish this row from a
      // row belonging to a ring reached under another spelling of the same
      // store file -- a symlink alias, or `mv proj.annostore other.annostore` --
      // and deleting rows under that ambiguity destroyed a reachable revert
      // history irreversibly (CR-05, reproduced twice). The sweep now abstains
      // from the row direction entirely, so with `writes` at
      // MAX_SNAPSHOT_REVISIONS + 8 the victim is the NEWEST retained revision:
      // it sits far above the prune's floor of
      // `currentRevision() - MAX_SNAPSHOT_REVISIONS`, so its row SURVIVES.
      //
      // What this test now demonstrates is that the surviving row is INERT --
      // tolerated, not resolved -- and the three properties that make it so are
      // the ones already asserted above against this very revision: it is not
      // retained, it is never published as the floor, and `revertTo` to it
      // refuses BY NAME inside the ViceError family. They are re-asserted here
      // AFTER the accepted write, because "still harmless once the sweep has
      // run over it" is the claim, not "harmless before it".
      setDataType(store, { start: 0x7000, endInclusive: 0x700f, dataType: "code" });
      const rowsAfter = (store.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[]).map(
        (row) => row.revision,
      );
      assert.ok(
        rowsAfter.includes(victim),
        `the orphan ROW must SURVIVE the accepted write -- the sweep no longer deletes a row it cannot establish ownership of (CR-05), rows are ${JSON.stringify(rowsAfter)}`,
      );
      assert.deepEqual(
        orphanRowRevisions(store, dir),
        [victim],
        "and the orphan row set is exactly the one this test constructed -- the sweep tolerated it and manufactured no other",
      );
      assert.ok(!retainedRevisions(store).includes(victim), "the surviving row is still NOT retained -- both halves are required, and its file is gone");
      assert.notEqual(oldestRetainedRevision(store), victim, "and it is still never published as the floor");
      assert.throws(
        () => revertTo(store, victim),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
          assert.ok(e instanceof ViceError, "the refusal stays inside the ViceError family even with the row present");
          assert.match(e.message, new RegExp(`cannot revert to revision ${victim}`), "and it names the revision that was asked for");
          return true;
        },
      );
    } finally {
      closeStore(store);
    }
  });
});

test("prune half-state B, the orphan FILE (the harmless direction): the store stays fully usable, a revert to a genuinely retained revision still succeeds, and the next accepted write sweeps the file so the directory bound still holds", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      const writes = MAX_SNAPSHOT_REVISIONS + 8;
      for (let i = 0; i < writes; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }

      const retainedBefore = retainedRevisions(store);
      assert.equal(retainedBefore.length, MAX_SNAPSHOT_REVISIONS, "the ring is full before the half-state is constructed");
      // The state a kill between the two statements CAN produce under the
      // present order, constructed directly: the row removed, the file left.
      const victim = retainedBefore[0];
      store.db.prepare("delete from anno_snapshot where revision = ?").run(victim);
      assert.ok(existsSync(snapshotPathFor(store, victim)), "the construction really did leave the file behind -- that is the half-state under test");

      // THE HARMLESS DIRECTION: nothing about the store stops working.
      assert.equal(currentRevision(store), writes, "currentRevision still answers");
      assert.equal(listRanges(store).length, writes, "and every row is still readable");

      // AND THE BOUND HOLDS THROUGH IT. The prune iterates ROWS, so without
      // the directory sweep at the top of `reconcileSnapshotRing` an unclaimed
      // file is invisible to the bound forever and `snapshots/` grows past it
      // -- which is exactly what a revert does thirty-two times over
      // (CR-01 consequence 4). The sweep is asserted here, on the ONE
      // orphan this construction plants, before anything re-adopts it.
      const constructed = ringHalves(store, dir);
      assert.equal(constructed.fileRevisions.length, MAX_SNAPSHOT_REVISIONS, "the file half of the ring is untouched by the construction");
      assert.equal(
        constructed.rowRevisions.length,
        MAX_SNAPSHOT_REVISIONS - 1,
        "and the row half is one short -- the two halves genuinely disagree, which is the state under test",
      );
      setDataType(store, { start: 0x7000, endInclusive: 0x700f, dataType: "code" });
      assert.ok(
        !existsSync(snapshotPathFor(store, victim)),
        `the orphan FILE for r${victim} must be swept by the next accepted write's prune`,
      );
      const files = readdirSync(join(dir, "proj.annostore.snapshots"));
      assert.ok(
        files.length <= MAX_SNAPSHOT_REVISIONS,
        `the directory bound must hold THROUGH the half-state, found ${files.length} files: ${files.sort().join(", ")}`,
      );
      const halves = ringHalves(store, dir);
      assert.ok(halves.rowRevisions.length > 0, "the ring is not empty, so the agreement below is not trivially satisfied");
      assert.deepEqual(halves.fileRevisions, halves.rowRevisions, "and the two halves of the ring agree again");

      // AND A REVERT TO A GENUINELY RETAINED REVISION STILL SUCCEEDS, which is
      // the other half of "harmless": the half-state cost the store nothing it
      // was still advertising.
      const survivor = oldestRetainedRevision(store);
      assert.notEqual(survivor, NO_RETAINED_REVISION, "a genuinely retained revision is still published");
      assert.notEqual(survivor, victim, "and it is not the one whose row was removed");
      store = revertTo(store, survivor);
      assert.equal(currentRevision(store), survivor, "a revert to a genuinely retained revision still succeeds through the half-state");
    } finally {
      closeStore(store);
    }
  });
});

test("the prune's SOURCE ORDER is the guarantee: inside pruneSnapshots the pointer-row delete precedes the unlink, asserted over the module's own stripped source", () => {
  // A BEHAVIOURAL assertion cannot see this. Both statements are present in
  // either arrangement and both leave the same end state when nothing kills
  // the process, so only the ORDER distinguishes the harmless half-state from
  // the forbidden one. This is the assertion a future reader who "tidies" the
  // loop back to file-then-row will trip.
  //
  // LITERAL BODIES KEPT (`codeOnly(src, true)`): the delete statement is SQL
  // text inside a string literal, which strict mode blanks.
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);
  const start = stripped.indexOf("export function pruneSnapshots");
  assert.ok(start >= 0, "pruneSnapshots must be findable in the stripped source");
  const end = stripped.indexOf("\n}", start);
  assert.ok(end > start, "and its body must terminate at a column-zero closing brace");
  const body = stripped.slice(start, end);

  // NON-VACUITY FIRST: a failed extraction, or a body missing either
  // statement, would satisfy an ordering comparison trivially.
  assert.ok(body.length > 200, `the extracted pruneSnapshots body must be substantial, got ${body.length} characters`);
  const rowDelete = body.indexOf("delete from anno_snapshot");
  const unlink = body.indexOf("rmSync");
  assert.ok(rowDelete >= 0, "the pointer-row delete must be present in the extracted body");
  assert.ok(unlink >= 0, "and so must the unlink");

  assert.ok(
    rowDelete < unlink,
    "the POINTER ROW must be deleted BEFORE the file is unlinked: a kill between the two then leaves an orphan FILE -- harmless and " +
      `reconcilable by revision number -- and never an orphan ROW (row delete at ${rowDelete}, unlink at ${unlink})`,
  );
});

test("STORE-04 idempotency across the half-states: a second pruneSnapshots reports nothing dropped in either direction and changes neither the files nor the rows, and a second revertTo(r) leaves the same rows and the same revision", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      const writes = MAX_SNAPSHOT_REVISIONS + 8;
      for (let i = 0; i < writes; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }

      // FIRST PRUNE, over a deliberately constructed half-state in BOTH
      // directions at once, so the "nothing dropped" claim below is about a
      // reconciled ring rather than one that never had anything to reconcile.
      const retained = retainedRevisions(store);
      assert.equal(retained.length, MAX_SNAPSHOT_REVISIONS, "the ring is full before the half-states are constructed");
      rmSync(snapshotPathFor(store, retained[retained.length - 1]), { force: true }); // an orphan ROW
      store.db.prepare("delete from anno_snapshot where revision = ?").run(retained[0]); // an orphan FILE
      pruneSnapshots(store);

      const filesAfterFirst = readdirSync(join(dir, "proj.annostore.snapshots")).sort();
      const rowsAfterFirst = ringHalves(store, dir).rowRevisions;
      assert.ok(rowsAfterFirst.length > 0, "the reconciled ring is not empty, so the second prune has something it could wrongly touch");

      // SECOND PRUNE, back to back. Nothing may move in either direction.
      const second = reconcileSnapshotRing(store);
      // CR-05: the sweep no longer has a ROW direction at all, so there is no
      // `droppedRows` to compare against `[]`. The assertion is the FIELD'S
      // ABSENCE rather than a deleted line, so a future re-introduction of
      // row-sweeping is caught here: a field that can only ever answer one
      // value is a claim the next reader has to falsify by experiment.
      assert.equal(
        Object.prototype.hasOwnProperty.call(second, "droppedRows"),
        false,
        "the sweep result must carry no droppedRows field -- the row direction was abandoned by CR-05, not left permanently empty",
      );
      assert.deepEqual(second.droppedFiles, [], "and no file left to sweep");
      pruneSnapshots(store);
      assert.deepEqual(readdirSync(join(dir, "proj.annostore.snapshots")).sort(), filesAfterFirst, "the second prune left the files exactly as the first did");
      assert.deepEqual(ringHalves(store, dir).rowRevisions, rowsAfterFirst, "and the pointer rows exactly as the first did");

      // DOUBLE REVERT. The observable store state after "revert to r" and
      // after "revert to r, then attempt it again" must be identical.
      const floor = oldestRetainedRevision(store);
      assert.notEqual(floor, NO_RETAINED_REVISION, "there is still a reachable revision to revert to");
      store = revertTo(store, floor);
      const rowsAfterRevert = listRanges(store);
      const revisionAfterRevert = currentRevision(store);
      assert.throws(
        () => revertTo(store, floor),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
          assert.match(e.message, new RegExp(`cannot revert to revision ${floor}`));
          return true;
        },
      );
      assert.deepEqual(listRanges(store), rowsAfterRevert, "the refused second revert left every row exactly as the first revert left it");
      assert.equal(currentRevision(store), revisionAfterRevert, "and left the revision alone");
    } finally {
      closeStore(store);
    }
  });
});

// ---------------------------------------------------------------------------
// CR-02 -- WHO MAY JUDGE AN UNCLAIMED SNAPSHOT FILE.
//
// Reproduced against committed code by the phase-28 verifier: a snapshot
// becomes a FILESYSTEM fact (the `renameSync` inside `publishSnapshot`) before
// it becomes a TRANSACTIONAL one (the pointer-row insert), and
// `reconcileSnapshotRing` decided ownership from its own connection's
// COMMITTED view only. For the width of that window a live writer's published
// file looks unowned, so the sweep unlinked it -- destroying a revision that
// the winning writer's committed pointer row then advertised and could never
// deliver, which is the orphan-ROW state trap 10 calls unsurvivable,
// manufactured by the reconciliation that exists to prevent it.
//
// THE REMEDY IS AN EXCLUSION, NOT A TIMING GUESS. Publication is reachable only
// from behind a won compare-and-swap, and the compare-and-swap runs inside
// `begin immediate` -- so a published-but-uncommitted writer HOLDS the store's
// write lock. A sweep that takes `begin immediate` before it reads anything
// therefore cannot run at all while any writer is inside that window. The
// publish-to-commit window and the write-lock hold are the same interval.
//
// BOTH TESTS BELOW BLOCK FOR ABOUT FIVE SECONDS BY DESIGN. That is the
// connection's `busy_timeout`, and waiting is the whole point: the sweep waits
// rather than guessing. Neither is a hang, and neither may be "fixed" by
// shortening the timeout -- that would turn an exact exclusion back into the
// tuned constant this defect was closed by refusing.
// ---------------------------------------------------------------------------

test("CR-02: a sweep cannot delete a snapshot a concurrent writer has published but not yet committed -- the sweep either holds the write lock or does nothing", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const a = openStore(path, { workspaceRoot: dir });
    let b: ReturnType<typeof openStore> | undefined = openStore(path, { workspaceRoot: dir });
    try {
      // Two accepted writes through A, so the ring holds revisions 0 and 1 and
      // the store is at revision 2. The file the sweep must NOT touch is the
      // one B is about to publish for revision 2.
      setDataType(a, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
      setDataType(a, { start: 0x1010, endInclusive: 0x101f, dataType: "byte" });
      assert.equal(currentRevision(a), 2, "two accepted writes put the store at revision 2");

      // B IS HELD DETERMINISTICALLY BETWEEN ITS RENAME AND ITS TRANSACTION'S
      // END. `applyWriteWithoutCommit` is the existing seam-private export
      // whose entire purpose is exactly this: it drives the IDENTICAL shipped
      // write sequence and stops one statement short of the end, so B sits with
      // its snapshot published, its pointer row inserted-but-unpublished and the
      // store's write lock held.
      const held = currentRevision(b);
      applyWriteWithoutCommit(b, (db) => {
        db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(0x3000, 0x300f, "byte", null);
      });

      // NON-VACUITY, BOTH HALVES, BEFORE THE SWEEP RUNS. The file has to be
      // genuinely on disk and genuinely unclaimed by anything A can see, or the
      // assertion below is about a state that never existed.
      const published = snapshotPathFor(b, held);
      assert.ok(existsSync(published), `B's published snapshot for r${held} must be on disk, that is the state under test`);
      const claimed = a.db.prepare("select revision from anno_snapshot where revision = ?").get(held) as { revision: number } | undefined;
      assert.equal(claimed, undefined, `no COMMITTED pointer row may claim r${held} yet -- the window is exactly this disagreement`);
      assert.ok(!retainedRevisions(a).includes(held), "and A's own retained set does not include it, so the sweep would judge it unowned");

      const started = Date.now();
      const swept = reconcileSnapshotRing(a);
      const elapsed = Date.now() - started;

      // THE ELAPSED TIME IS ITS OWN ASSERTION, and it is the half that reddens
      // if a future edit removes the `begin immediate` while keeping the
      // drop-set computation -- the most plausible way this repair gets undone.
      assert.ok(
        elapsed >= 1000,
        `the sweep must genuinely have BLOCKED on the write lock rather than completing for an unrelated reason, elapsed ${elapsed}ms`,
      );
      assert.equal(swept.deferred, true, "a sweep that cannot take the write lock DECLINES and says so rather than judging");
      // CR-05: the row direction is gone from the sweep entirely, so the
      // declining sweep's "drops no pointer row" claim is now carried by the
      // field's ABSENCE -- asserted rather than deleted, so re-introducing
      // row-sweeping reddens this control too.
      assert.equal(
        Object.prototype.hasOwnProperty.call(swept, "droppedRows"),
        false,
        "the sweep result must carry no droppedRows field -- no sweep, declining or not, can delete a pointer row since CR-05",
      );
      assert.deepEqual(swept.droppedFiles, [], "and unlinks no file");
      assert.ok(
        existsSync(published),
        `B's published snapshot for r${held} must STILL be on disk -- deleting it is CR-02, and it makes r${held} permanently unrevertible`,
      );
    } finally {
      // Closing a connection with an open transaction rolls it back, which is
      // what releases the write lock and discards B's uncommitted pointer row.
      if (b !== undefined) closeStore(b);
      b = undefined;
      closeStore(a);
    }
  });
});

test("a prune whose sweep DEFERRED returns early: one busy_timeout and not two, nothing dropped, and the deferred work done by the next uncontended prune", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const a = openStore(path, { workspaceRoot: dir });
    let b: ReturnType<typeof openStore> | undefined = openStore(path, { workspaceRoot: dir });
    try {
      // Its OWN fixture, deliberately not shared with the CR-02 test above:
      // that one holds two revisions on purpose, which would make every
      // assertion below vacuous.
      const writes = MAX_SNAPSHOT_REVISIONS + 2;
      for (let i = 0; i < writes; i += 1) {
        setDataType(a, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }
      const floor = currentRevision(a) - MAX_SNAPSHOT_REVISIONS;

      // THE DOOMED SET IS PLANTED, NOT ASSUMED. Step 9's own prune has already
      // trimmed the ring, so at this point the doomed set is EMPTY and a test
      // asserting "nothing was pruned" would pass against any implementation.
      // Each planted revision gets BOTH halves -- a pointer row AND a file --
      // so it is a genuine doomed-set member rather than an orphan row the
      // sweep would drop for a different reason.
      const planted = [floor - 2, floor - 1];
      for (const rev of planted) {
        a.db.prepare("insert into anno_snapshot(revision) values (?)").run(rev);
        writeFileSync(snapshotPathFor(a, rev), "");
      }
      const plantedRows = (): number[] =>
        (a.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[])
          .map((row) => row.revision)
          .filter((revision) => planted.includes(revision));
      // NON-VACUITY PIN, BEFORE ANY CONTENTION.
      assert.deepEqual(plantedRows(), planted, "both planted pointer rows must really be there, or the assertions below prove nothing");
      for (const rev of planted) {
        assert.ok(rev < floor, `planted revision ${rev} must be strictly below the floor ${floor} -- that is what makes it doomed`);
        assert.ok(existsSync(snapshotPathFor(a, rev)), `and its file must exist, or the sweep would drop the row as an orphan instead`);
      }

      // The same deterministic hold as the CR-02 test.
      applyWriteWithoutCommit(b, (db) => {
        db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)").run(0x4000, 0x400f, "byte", null);
      });

      const started = Date.now();
      pruneSnapshots(a); // must NOT throw
      const elapsed = Date.now() - started;

      assert.ok(elapsed >= 1000, `the prune's own sweep must genuinely have blocked on the write lock, elapsed ${elapsed}ms`);
      assert.ok(
        elapsed < 8000,
        `the added latency must be bounded at ONE busy_timeout and not two: a prune that pressed on into its own doomed-set deletes would ` +
          `block a second five seconds and then throw SQLITE_BUSY, elapsed ${elapsed}ms`,
      );
      assert.deepEqual(plantedRows(), planted, "a deferred sweep means deferred PRUNING: no pointer row may be deleted over a ring the sweep declined to reconcile");
      for (const rev of planted) {
        assert.ok(existsSync(snapshotPathFor(a, rev)), `and the planted file for r${rev} is still there`);
      }

      // THE HALF THAT PROVES THE WORK WAS DEFERRED RATHER THAN ABANDONED.
      // Without it this test would pass against an implementation that simply
      // never prunes.
      closeStore(b);
      b = undefined;
      pruneSnapshots(a);
      assert.deepEqual(plantedRows(), [], "the next UNCONTENDED prune does the work the contended one deferred");
      for (const rev of planted) {
        assert.ok(!existsSync(snapshotPathFor(a, rev)), `and unlinks the planted file for r${rev}`);
      }
    } finally {
      if (b !== undefined) closeStore(b);
      closeStore(a);
    }
  });
});

test("the sweep's SOURCE ORDER is the guarantee too: inside reconcileSnapshotRing there is NO pointer-row delete at all, and the commit precedes the unlink", () => {
  // A BEHAVIOURAL assertion cannot see either clause, for the same reason the
  // prune's own source-order control exists: the surviving statements are
  // present in every arrangement and leave the same end state when nothing
  // kills the process, so only the ORDER distinguishes the harmless half-state
  // from the forbidden one. The sweep's own transaction is the hazard the 28-11
  // repair introduced -- an interruption between the transaction and the
  // unlinks -- and closing the transaction first is what makes that
  // interruption leave extra FILES rather than a pointer row aimed at a deleted
  // file.
  //
  // WHY THE ROW-DELETE CLAUSE CHANGED FROM AN ORDERING TO AN ABSENCE (CR-05):
  // this control used to assert that the pointer-row delete PRECEDED the
  // commit. That statement was removed on purpose. The sweep could not
  // distinguish a row belonging to this ring from a row belonging to a ring
  // reached under a second spelling of the same store file -- a symlink alias,
  // or `mv proj.annostore other.annostore` -- and deleting rows under that
  // ambiguity destroyed a reachable revert history irreversibly, reproduced
  // twice through production entry points. The ABSENCE is now the guarantee,
  // and it is asserted here rather than left implicit so a future
  // re-introduction is caught at the statement rather than at the next
  // destroyed history.
  //
  // LITERAL BODIES KEPT (`codeOnly(src, true)`): the delete statement whose
  // absence is asserted would be SQL text inside a string literal, which strict
  // mode blanks -- and a blanked literal would make the absence assertion pass
  // vacuously.
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);
  const start = stripped.indexOf("export function reconcileSnapshotRing");
  assert.ok(start >= 0, "reconcileSnapshotRing must be findable in the stripped source");
  const end = stripped.indexOf("\n}", start);
  assert.ok(end > start, "and its body must terminate at a column-zero closing brace");
  const body = stripped.slice(start, end);

  // NON-VACUITY FIRST: a failed extraction, or a body missing either surviving
  // statement, would satisfy both the ordering comparison AND the absence
  // assertion trivially. The length bound and the two presence checks are
  // exactly what stops the absence clause from being satisfied by an empty
  // string.
  assert.ok(body.length > 400, `the extracted reconcileSnapshotRing body must be substantial, got ${body.length} characters`);
  const rowDelete = body.indexOf("delete from anno_snapshot");
  const commitCall = body.indexOf("commitTransaction");
  const unlink = body.indexOf("rmSync");
  assert.ok(commitCall >= 0, "the module's one commit site must be called from inside the sweep's own transaction");
  assert.ok(unlink >= 0, "and the unlink must be present in the extracted body");
  // AND THE POSITIVE CONTROL FOR THE ABSENCE CLAUSE, which is the assertion
  // that stops it passing for the wrong reason. If `codeOnly(src, true)` ever
  // stopped keeping literal bodies, the search string would be blanked
  // everywhere and "no pointer-row delete in the sweep" would be true of a
  // source that still had one. `pruneSnapshots` is REQUIRED to contain exactly
  // this statement (its own source-order control asserts the ordering), so
  // finding it there proves the needle is findable when it is present.
  assert.ok(
    stripped.indexOf("delete from anno_snapshot", stripped.indexOf("export function pruneSnapshots")) >= 0,
    "pruneSnapshots must still contain the pointer-row delete in the stripped source -- otherwise literal bodies are being blanked and the absence assertion below is vacuous",
  );

  assert.equal(
    rowDelete,
    -1,
    `the sweep must contain NO pointer-row delete at all (CR-05): it cannot establish ownership of the row direction under a second spelling of the store file, so it abstains from it entirely (found one at ${rowDelete})`,
  );
  assert.ok(
    commitCall < unlink,
    "the row deletes must be DURABLE BEFORE any file is unlinked: an interrupted sweep then leaves extra FILES -- harmless and reconcilable " +
      `by revision number -- and never a pointer row aimed at a deleted file (commitTransaction at ${commitCall}, unlink at ${unlink})`,
  );
});

test("the publish path's SOURCE ORDER is the durability guarantee (WR-13): stageSnapshot fsyncs after its vacuum, and publishSnapshot fsyncs the ring directory after its rename", () => {
  // WHY THIS CONTROL IS STRUCTURAL AND SAYS SO. An `fsync` has NO in-process
  // observable: it returns the same `undefined` whether the bytes reached the
  // platter or the page cache lied, and the only witness that distinguishes the
  // two is a host losing power. A behavioural assertion here would therefore be
  // measuring something else -- that a file exists, that a read-back matches --
  // and CALLING it durability, which is the 28-07 P3 shape ("a comment or a
  // message that asserts a guarantee the code does not provide") this phase keeps
  // re-encountering. So the claim is stated for what it is: the ORDER of two
  // calls in the source, asserted with a positive control for the needle. The
  // BEHAVIOURAL half of the durability story lives in `anno-durability.test.ts`,
  // which kills a real process; this control only pins that the publish path uses
  // the same helper in the same order the revert path already does.
  //
  // WHAT THE ORDER BUYS. The pointer row naming a published snapshot is inserted
  // inside the write transaction and committed by SQLite, WHICH DOES FSYNC.
  // Without these two calls the ROW is durable and the FILE it names is not, so a
  // host crash (not the `SIGKILL` the durability proof covers) can leave a
  // PRESENT, PARTIAL snapshot that `retainedRevisions()` would advertise -- the
  // exact input CR-08 was reproduced with.
  //
  // LITERAL BODIES KEPT (`codeOnly(src, true)`): the `vacuum into` needle is SQL
  // text inside a template literal, which strict mode blanks -- and a blanked
  // literal would make the `fsyncPath` AFTER `vacuum into` comparison pass
  // against a source that fsynced first.
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);

  const extract = (declaration: string): string => {
    const start = stripped.indexOf(declaration);
    assert.ok(start >= 0, `${declaration} must be findable in the stripped source`);
    const end = stripped.indexOf("\n}", start);
    assert.ok(end > start, `and ${declaration}'s body must terminate at a column-zero closing brace`);
    return stripped.slice(start, end);
  };

  const stage = extract("export function stageSnapshot");
  const publish = extract("function publishSnapshot");

  // NON-VACUITY FIRST: a failed extraction, or a body reduced to its signature,
  // would satisfy both ordering comparisons trivially by leaving both indexes at
  // -1. The length bounds and the four presence checks are what stop that.
  assert.ok(stage.length > 200, `the extracted stageSnapshot body must be substantial, got ${stage.length} characters`);
  assert.ok(publish.length > 40, `the extracted publishSnapshot body must be substantial, got ${publish.length} characters`);

  const vacuum = stage.indexOf("vacuum into");
  const stageFsync = stage.indexOf("fsyncPath(");
  assert.ok(vacuum >= 0, "stageSnapshot must still take its image with `vacuum into`");
  assert.ok(stageFsync >= 0, "and stageSnapshot must fsync the staged image before it returns");

  const rename = publish.indexOf("renameSync(");
  const publishFsync = publish.indexOf("fsyncPath(");
  assert.ok(rename >= 0, "publishSnapshot must still publish by rename");
  assert.ok(publishFsync >= 0, "and publishSnapshot must fsync the ring directory after that rename");

  // AND THE POSITIVE CONTROL FOR THE NEEDLE, in the same style the sweep's
  // source-order control uses for `delete from anno_snapshot`. If `fsyncPath(`
  // ever stopped being findable -- renamed, wrapped, blanked by a change in
  // `codeOnly` -- both `>= 0` checks above would fail loudly rather than the
  // orderings passing for the wrong reason, but the assertion is stated anyway
  // because `revertTo` is REQUIRED to contain this call (its steps 3 and 5 are
  // the idiom the publish path was made to match), so finding it there proves the
  // needle is findable when it is present.
  assert.ok(
    stripped.indexOf("fsyncPath(", stripped.indexOf("export function revertTo")) >= 0,
    "revertTo must still contain fsyncPath in the stripped source -- otherwise the needle is unfindable and the two orderings below are vacuous",
  );

  assert.ok(
    stageFsync > vacuum,
    "the staged image must be fsynced AFTER the vacuum that fills it and before stageSnapshot returns: the pointer row that will name it " +
      `is committed by SQLite, which fsyncs, so a row durable ahead of its file is a snapshot that is advertised and partial (vacuum into at ${vacuum}, fsyncPath at ${stageFsync})`,
  );
  assert.ok(
    publishFsync > rename,
    "the ring directory must be fsynced AFTER the rename that publishes into it: a rename is VISIBLE immediately and DURABLE only after the " +
      `directory fsync, which is the distinction fsyncPath's own doc sentence records (renameSync at ${rename}, fsyncPath at ${publishFsync})`,
  );
});

test("idempotency of open: opening and closing a store twice with no write between leaves the revision, the rows and the snapshot ring unchanged", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    const first = openStore(path, { workspaceRoot: dir });
    setDataType(first, { start: 0x0810, endInclusive: 0x084f, dataType: "lo_hi_address" });
    const revisionAfterWrite = currentRevision(first);
    const rowsAfterWrite = listRanges(first);
    const snapshotsAfterWrite = readdirSync(join(dir, "proj.annostore.snapshots")).sort();
    closeStore(first);

    // Opening is a READ, and it must stay one: an open that took a snapshot,
    // advanced the revision or ran a migration would make merely LOOKING at a
    // store change it -- and every one of those is a shape somebody could add
    // without noticing, because nothing else in the suite reopens twice.
    for (const pass of [1, 2]) {
      const handle = openStore(path, { workspaceRoot: dir });
      try {
        assert.equal(currentRevision(handle), revisionAfterWrite, `open pass ${pass} must not advance the revision`);
        assert.deepEqual(listRanges(handle), rowsAfterWrite, `open pass ${pass} must not change the rows`);
        assert.deepEqual(readdirSync(join(dir, "proj.annostore.snapshots")).sort(), snapshotsAfterWrite, `open pass ${pass} must not add a snapshot`);
      } finally {
        closeStore(handle);
      }
    }

    assert.equal(NO_RETAINED_REVISION, -1, "the empty-ring sentinel is a named constant, so no caller has to recognise a bare -1");
    inTempDir((freshDir) => {
      const fresh = openStore(join(freshDir, "proj.annostore"), { workspaceRoot: freshDir });
      try {
        assert.equal(
          oldestRetainedRevision(fresh),
          NO_RETAINED_REVISION,
          "a freshly created store retains NO snapshot, and says so rather than naming its current revision as revertable",
        );
      } finally {
        closeStore(fresh);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// THE OPTIMISTIC-CONCURRENCY REFUSAL, ACROSS TWO GENUINELY SEPARATE OS
// PROCESSES (STORE-01, threats T-28-lostwrite and T-28-lastwritewins).
//
// SQLite's locking arbitrates WRITES but not INTENT: two processes can both
// commit, and the later one can erase the earlier one's meaning without
// erasing its bytes. So the refusal is the store's own, and proving it needs a
// second process that really commits and really goes away -- an in-process
// second handle would prove only that one connection can see another's rows.
//
// The spawned child is `anno-durability-mutator.mjs` in its commit-and-exit
// mode: it writes a DIFFERENT range from the parent's, so the readback can say
// WHOSE row survived rather than having to infer it from a row either process
// could have written. That mode exits cleanly, so its status is CHECKED rather
// than ignored -- unlike the self-SIGKILLing modes, a non-zero status here
// would mean the other process never committed and the refusal being measured
// could be something else entirely.
// ---------------------------------------------------------------------------

const MUTATOR = join(HERE, "anno-durability-mutator.mjs");

/** The range the mutator's commit-and-exit mode writes. Restated here so the
 * "whose row survived" assertion is by value against numbers this file names. */
const OTHER_PROCESS_RANGE = { start: 0x2000, endInclusive: 0x201f, dataType: "word" } as const;

test("cross-process compare-and-swap: after a genuinely separate OS process commits, a write with the now-stale base revision is REFUSED with both revisions -- the other process's row survives and the refused write's row is absent", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
      const staleBase = currentRevision(store);
      assert.equal(staleBase, 1, "the parent's own write put the store at revision 1, which is the base it is about to be stale about");

      // The other process. `openStore`'s connection option `{ timeout: 5_000 }`
      // is what makes a genuinely concurrent writer WAIT for the write lock
      // rather than failing SQLITE_BUSY on contact -- and the refusal below
      // still happens afterwards, which is the point: waiting for the lock is
      // not the same as being allowed to overwrite.
      const status = execFileSync(process.execPath, [MUTATOR, path, "commit-and-exit"], { stdio: "pipe" });
      assert.ok(status !== undefined, "the commit-and-exit mode exits cleanly, so execFileSync returns rather than throwing");

      const afterChild = currentRevision(store);
      assert.equal(afterChild, staleBase + 1, "the other process's commit is visible on this connection and advanced the revision by exactly one");

      assert.throws(
        () => setDataType(store, { start: 0x3000, endInclusive: 0x300f, dataType: "byte", baseRevision: staleBase }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreStaleRevisionError, `expected AnnoStoreStaleRevisionError, got ${String(e)}`);
          // BOTH FIELDS, not merely that it threw: "conflict" is not an answer
          // a caller can act on, and the two numbers are what let it say WHICH
          // two revisions disagreed.
          assert.equal(e.baseRevision, staleBase, "the refusal carries the revision the caller based its edit on");
          assert.equal(e.currentRevision, afterChild, "and the revision the other process left on disk");
          return true;
        },
      );

      // WHOSE ROW SURVIVED, asserted in the same test as the refusal. A
      // last-write-wins implementation would ALSO leave two rows here -- the
      // parent's and one of the two writes -- so the assertion is on the exact
      // set, by value.
      const rows = listRanges(store);
      assert.deepEqual(
        rows.map((row) => [row.start, row.endInclusive, row.dataType]),
        [
          [0x1000, 0x100f, "byte"],
          [OTHER_PROCESS_RANGE.start, OTHER_PROCESS_RANGE.endInclusive, OTHER_PROCESS_RANGE.dataType],
        ],
        "the other process's committed row is INTACT and the refused write's row is ABSENT -- never merged, never last-write-wins",
      );
      assert.equal(
        rows.some((row) => row.start === 0x3000),
        false,
        "the refused write left no row behind at all",
      );
      assert.equal(currentRevision(store), afterChild, "and did not advance the revision");

      // THE REFUSAL IS NOT BUILT ON A DETECTOR, and this comment records the
      // measurement rather than the assertion, because the assertion is the
      // throw above. `pragma data_version` was measured moving from 1 to 2 on
      // the other process's commit, which makes it a useful cheap "did
      // anything change at all" probe -- but it is a DETECTOR, not an
      // enforcement point: it does not say WHAT changed, it cannot be made
      // atomic with a write, and a refusal built on it would be a race with a
      // nicer name. The refusal is built on
      // `update anno_meta set revision = revision + 1 where id = 1 and
      // revision = ?` with its `changes !== 1` rollback inside
      // `begin immediate`, plus the base-revision check that precedes the
      // transaction -- and `anno-seam.test.ts` pins all three structurally.
      const dataVersion = store.db.prepare("pragma data_version").get() as { data_version: number };
      assert.equal(typeof dataVersion.data_version, "number", "data_version is readable, and is deliberately NOT what the refusal is built on");

      // WHICH GUARD THIS TEST ACTUALLY EXERCISES, MEASURED RATHER THAN
      // ASSUMED -- because the two guards fail independently and only one of
      // them is reachable from a synchronous test.
      //
      //   * Making the step-5 compare-and-swap TAUTOLOGICAL (its `revision = ?`
      //     guard replaced by an always-true predicate, the bound parameter
      //     kept so the statement still runs) leaves THIS TEST GREEN and
      //     reddens only `anno-seam.test.ts`'s structural CAS assertion.
      //     Measured: 52 tests, 1 fail. The reason is not a weakness in this
      //     test: the CAS guards the window between step 1's revision read and
      //     step 5's update -- a writer committing INSIDE that window -- and a
      //     single-threaded test cannot open it. The CAS is pinned
      //     structurally for exactly that reason.
      //   * Removing the STEP-2 base-revision refusal reddens this test with
      //     `Missing expected exception`: the stale-base write is silently
      //     accepted and the other process's meaning is overwritten. Measured:
      //     36 tests, 2 fail. That is `T-28-lostwrite` happening, and it is the
      //     planting that falsifies what this test claims.
      //
      // Recorded so a later reader does not conclude from the first result
      // that the CAS is dead code, nor from this test's green that the CAS is
      // what it proves.

      // LAST-WRITE-WINS IS REFUSED, NOT RESOLVED. The store never recovers
      // from a stale base by silently re-reading the current revision and
      // proceeding -- that would be last-write-wins wearing a
      // compare-and-swap's clothes, and the caller could not tell it had
      // happened. A caller that genuinely wants to overwrite must say so by
      // supplying a FRESH base explicitly, which is exactly what this does.
      const retry = setDataType(store, { start: 0x3000, endInclusive: 0x300f, dataType: "byte", baseRevision: currentRevision(store) });
      assert.equal(retry.revision, afterChild + 1, "the same write with a FRESH base is accepted and advances the revision");
      assert.equal(listRanges(store).length, 3, "and its row lands this time -- the refusal was about the base, never about the write");
    } finally {
      closeStore(store);
    }
  });
});

// ---------------------------------------------------------------------------
// CR-02: one owner per published snapshot
// ---------------------------------------------------------------------------

test("snapshot OWNERSHIP: a losing writer that stages a snapshot for a revision another writer already committed cannot touch that winner's published bytes, and the revert to it still returns that revision with its exact row set", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    // WRITER A -- the winner. One accepted write publishes `r0.db` and commits
    // the pointer row (0, r0.db) in the same transaction as the mutation.
    const a = openStore(path, { workspaceRoot: dir });
    setDataType(a, { start: 0x1000, endInclusive: 0x10ff, dataType: "code" });
    assert.equal(currentRevision(a), 1, "the winner's write advanced the revision by exactly one");
    assert.equal(listRanges(a).length, 1, "and left exactly one row");

    const snap0 = snapshotPathFor(a, 0);
    assert.ok(existsSync(snap0), "the winner published revision 0's snapshot at its user-visible path");
    const winnerBytes = readFileSync(snap0);
    assert.ok(winnerBytes.length > 0, "and that snapshot is a real file, not an empty placeholder");

    // WRITER B -- the loser, driven through the PRODUCTION staging code rather
    // than a hand-copied variant of it. A copy inside a test can drift out of
    // agreement with the real one, and a proof that agrees with a copy proves
    // nothing about the original. This is the reason `stageSnapshot` is
    // exported at all.
    const b = openStore(path, { workspaceRoot: dir });
    const staging = stageSnapshot(b, 0);

    assert.notEqual(
      staging,
      snap0,
      "a losing writer must stage under a name of its own -- staging ON the published path IS the defect, because the published path is " +
        `already owned by a committed pointer row (staged at ${staging}, published at ${snap0})`,
    );
    assert.ok(existsSync(staging), "and the staged file must actually exist, or the assertion above is comparing two names and proving nothing");

    assert.deepEqual(
      readFileSync(snap0),
      winnerBytes,
      "a LOSER must not be able to touch a WINNER's published snapshot: revision 0's bytes must be byte-identical to what the winner wrote. " +
        "This is the assertion the pre-fix rmSync-then-vacuum-into-the-published-path pair fails -- it removed the winner's file and " +
        "re-created it from the CURRENT state, leaving the winner's committed pointer row describing a different revision",
    );

    rmSync(staging, { force: true });
    closeStore(b);

    // AND THE CONSEQUENCE THE REVIEWER ACTUALLY MEASURED. The damage CR-02 did
    // was never visible at the row level -- the loser's write is correctly
    // refused either way -- it was visible only here, on a revert that
    // succeeded with the wrong state.
    const reverted = revertTo(a, 0);
    try {
      const gotRevision = currentRevision(reverted);
      const gotRows = listRanges(reverted);
      assert.equal(
        gotRevision,
        0,
        `revertTo(0) gave revision ${gotRevision} with ${gotRows.length} row(s) -- expected revision 0 with 0 rows`,
      );
      assert.equal(
        gotRows.length,
        0,
        `revertTo(0) gave revision ${gotRevision} with ${gotRows.length} row(s) -- expected revision 0 with 0 rows`,
      );
    } finally {
      closeStore(reverted);
    }
  });
});

test("publishing by RENAME cannot destroy a claimed snapshot: on a store written past a revert and forward again, no surviving pointer row names the CURRENT revision", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      // The property is an argument about ordering -- pointer rows are inserted
      // for the PRE-mutation revision and the vacuum image is taken before that
      // insert, so no row can ever name the revision the store is currently at,
      // which is the only path the publishing rename targets. It is asserted
      // here rather than left as an argument, and asserted specifically on the
      // shape that makes revision numbers RECUR: a revert followed by more
      // writes.
      for (let i = 0; i < 4; i += 1) {
        setDataType(store, { start: 0x2000 + i * 0x10, endInclusive: 0x2000 + i * 0x10 + 1, dataType: "word" });
      }
      store = revertTo(store, 2);
      for (let i = 0; i < 3; i += 1) {
        setDataType(store, { start: 0x3000 + i * 0x10, endInclusive: 0x3000 + i * 0x10 + 1, dataType: "byte" });
      }

      const rows = store.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[];
      // NON-VACUITY FIRST: an empty pointer table satisfies "no row names the
      // current revision" without saying anything at all.
      assert.ok(rows.length > 0, `the pointer table must hold rows for this assertion to mean anything, got ${rows.length}`);

      const now = currentRevision(store);
      const colliding = rows.filter((row) => row.revision === now);
      assert.deepEqual(
        colliding,
        [],
        `no surviving pointer row may name the CURRENT revision ${now} -- that is the only path the publishing rename targets, and a row ` +
          "naming it would mean the rename could overwrite a snapshot some row still claims",
      );
    } finally {
      closeStore(store);
    }
  });
});

test("a refusal leaves NOTHING behind on disk: neither a stale-base refusal nor a write whose mutation throws leaves a .tmp staging file in the snapshots directory", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      setDataType(store, { start: 0x0400, endInclusive: 0x07e7, dataType: "screencode" });
      const snapshotDir = join(dir, "proj.annostore.snapshots");
      const tmpEntries = (): string[] => readdirSync(snapshotDir).filter((name) => name.endsWith(".tmp")).sort();

      // NON-VACUITY FIRST, and it has to be taken this way round: "no .tmp
      // entry" is trivially true of a directory in which a .tmp entry is
      // impossible. Staging one through the production code proves the reader
      // can see one when there is one.
      const planted = stageSnapshot(store, currentRevision(store));
      assert.deepEqual(tmpEntries().length, 1, "a staged snapshot IS visible to this reader, so its absence below is a measurement");
      rmSync(planted, { force: true });
      assert.deepEqual(tmpEntries(), [], "and the directory is clean again before the two refusals below");

      // REFUSAL 1 -- a stale base. This one is refused BEFORE any filesystem
      // work happens at all, which is itself the guarantee: a caller with a
      // stale base does no I/O.
      assert.throws(
        () => setDataType(store, { start: 0x5000, endInclusive: 0x5001, dataType: "word", baseRevision: 0 }),
        AnnoStoreStaleRevisionError,
      );
      assert.deepEqual(tmpEntries(), [], "a stale-base refusal leaves no staging file behind");

      // REFUSAL 2 -- a mutation that throws. THIS route is chosen over an
      // invalid argument on purpose: `applyWrite` with a throwing callback is
      // the ONLY deterministic way into the rollback path that runs AFTER the
      // snapshot has been staged, and it drives the shipped write sequence
      // rather than a variant of it. An invalid range would be refused by the
      // validators before the sequence ever starts, and would therefore test
      // nothing about staging.
      const boom = new Error("the mutation refuses, from inside the transaction");
      assert.throws(
        () =>
          applyWrite(store, () => {
            throw boom;
          }),
        (e: unknown) => e === boom,
      );
      assert.deepEqual(tmpEntries(), [], "a write whose mutation throws leaves no staging file behind either");
      assert.equal(currentRevision(store), 1, "and the rolled-back write did not advance the revision");
    } finally {
      closeStore(store);
    }
  });
});
// ---------------------------------------------------------------------------
// WR-04: no family escape from openStore -- WR-11: both numbers on the CAS
// refusal -- STORE-05: a refusal never reorders another process's rows
// ---------------------------------------------------------------------------

test("openStore family escape 1: a path that IS a directory is refused with AnnoStorePathError, inside the ViceError family, naming the path -- and the store is still usable afterwards", () => {
  inTempDir((dir) => {
    const notAStore = join(dir, "notastore");
    mkdirSync(notAStore);

    assert.throws(
      () => openStore(notAStore, { workspaceRoot: dir }),
      (e: unknown) => {
        // THE FAMILY MEMBERSHIP IS THE ASSERTION, not merely that something
        // threw. The finding this pins is that a BARE `Error` escaped -- so
        // `assert.throws(fn, SomeClass)` alone would have been satisfied
        // before the fix only by accident, and an `instanceof ViceError` is
        // what actually distinguishes the two worlds.
        assert.ok(e instanceof AnnoStorePathError, `expected AnnoStorePathError, got ${String(e)}`);
        assert.ok(e instanceof ViceError, "and it must be inside the ViceError family -- a bare Error here is the defect");
        assert.ok(e.message.includes(notAStore), `the refusal must name the path, got ${e.message}`);
        return true;
      },
    );

    // WHAT IS DELIBERATELY NOT ASSERTED, stated rather than left as a gap: a
    // LEAKED CONNECTION is not observable from outside the process -- there is
    // no handle to count and no fd the test can read. What IS observable is the
    // family contract above and RECOVERABILITY, so that is what is measured:
    // after the failure, opening a valid store in the SAME process still works
    // and still round-trips a write.
    const store = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    try {
      setDataType(store, { start: 0x0400, endInclusive: 0x0403, dataType: "byte" });
      assert.equal(listRanges(store).length, 1, "the process is still able to open a store and write to it after the refusal");
    } finally {
      closeStore(store);
    }
  });
});

test("openStore family escape 2: a path whose PARENT directory does not exist is refused with AnnoStorePathError, inside the ViceError family", () => {
  inTempDir((dir) => {
    const missingParent = join(dir, "no-such-dir", "proj.annostore");
    assert.ok(!existsSync(join(dir, "no-such-dir")), "the parent must genuinely not exist, or this test proves nothing");

    assert.throws(
      () => openStore(missingParent, { workspaceRoot: dir }),
      (e: unknown) => {
        assert.ok(e instanceof AnnoStorePathError, `expected AnnoStorePathError, got ${String(e)}`);
        assert.ok(e instanceof ViceError, "and it must be inside the ViceError family -- a bare Error here is the defect");
        assert.ok(e.message.includes(missingParent), `the refusal must name the path, got ${e.message}`);
        return true;
      },
    );

    const store = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    try {
      setDataType(store, { start: 0x0500, endInclusive: 0x0503, dataType: "byte" });
      assert.equal(listRanges(store).length, 1, "and the process recovers -- a valid path in the same process still opens and writes");
    } finally {
      closeStore(store);
    }
  });
});

test("WR-11, STRUCTURAL: the CAS-failure refusal carries BOTH revisions, and reads the second one BEFORE the rollback", () => {
  // WHY A STRUCTURAL PIN RATHER THAN A BEHAVIOURAL ONE, stated because a
  // structural assertion that does not say why it is structural reads as
  // laziness. The CAS-failure branch is reached only when the revision moves
  // BETWEEN the pre-transaction read and `begin immediate`. `runWriteSequence`
  // is fully synchronous, so no in-process interleave can land in that window,
  // and a spawned child racing it would be timing-dependent -- a flaky probe
  // is worse evidence than an honest structural one.
  //
  // THE REACHABLE ARM IS PINNED BEHAVIOURALLY ELSEWHERE. The pre-transaction
  // refusal's both-numbers contract is asserted by value in "every accepted
  // write advances the revision by exactly one, and a write based on a stale
  // revision is refused with both numbers" above. The two assertions together
  // cover both arms of AnnoStoreStaleRevisionError's documented contract.
  //
  // LITERAL BODIES KEPT (`codeOnly(src, true)`): the target includes SQL text
  // inside string literals, which strict mode blanks.
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);
  const fnStart = stripped.indexOf("function runWriteSequence");
  assert.ok(fnStart >= 0, "runWriteSequence must be findable in the stripped source");
  const fnEnd = stripped.indexOf("\n}", fnStart);
  assert.ok(fnEnd > fnStart, "and its body must terminate at a column-zero closing brace");
  const body = stripped.slice(fnStart, fnEnd);

  const branchStart = body.indexOf("cas.changes");
  assert.ok(branchStart >= 0, "the CAS changes check must be present in the extracted body");
  const branchEnd = body.indexOf("publishSnapshot", branchStart);
  assert.ok(branchEnd > branchStart, "and the branch must terminate before the publication that only the winner reaches");
  const branch = body.slice(branchStart, branchEnd);

  // NON-VACUITY FIRST: an extraction that returned an empty or wrong slice
  // would satisfy the ordering comparison below trivially.
  assert.ok(branch.length > 100, `the extracted CAS-failure branch must be substantial, got ${branch.length} characters`);
  assert.ok(branch.includes("AnnoStoreStaleRevisionError"), "the extracted branch must be the one that throws the stale-revision refusal");

  assert.ok(
    branch.includes("currentRevision:"),
    "the CAS-failure refusal must carry currentRevision -- this is the ONE path on which a concurrent writer moved the revision, so it is " +
      "the path on which the second number is most informative, and reporting a conflict with one number is the word 'conflict' with extra steps",
  );
  assert.ok(branch.includes("baseRevision:"), "and it must still carry baseRevision, so the caller can say WHICH two values disagreed");

  const read = branch.indexOf("select revision from anno_meta");
  const rollback = branch.indexOf("rollback");
  assert.ok(read >= 0, "the branch must read the moved-to revision");
  assert.ok(rollback >= 0, "and it must roll back");
  assert.ok(
    read < rollback,
    "the second number must be READ BEFORE THE ROLLBACK: it is only visible while this transaction still sees it, so a read placed after " +
      `the rollback reports the wrong value or none at all (read at ${read}, rollback at ${rollback})`,
  );
});

// ---------------------------------------------------------------------------
// WR-01, WR-02 and WR-04 -- the three regions the phase-28 verification listed
// under `## Anti-Patterns Found` as unguarded.
// ---------------------------------------------------------------------------

test("WR-01: a throw between the staged snapshot and the pointer-row insert leaves no open transaction, no staged .tmp, and an error inside the ViceError family", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      // One accepted write, so the ring directory exists and the revision the
      // collision below is planted against is a real one.
      setDataType(store, { start: 0x0400, endInclusive: 0x07e7, dataType: "screencode" });
      const snapshotDir = snapshotDirFor(store);
      const tmpEntries = (): string[] =>
        readdirSync(snapshotDir)
          .filter((name) => name.endsWith(".tmp"))
          .sort();

      // NON-VACUITY FIRST, the same way and for the same reason as
      // "a refusal leaves NOTHING behind on disk": "no .tmp entry" is trivially
      // true of a directory in which a .tmp entry is impossible, so staging one
      // through the production code proves the reader can see one when there is
      // one.
      const planted = stageSnapshot(store, currentRevision(store));
      assert.equal(tmpEntries().length, 1, "a staged snapshot IS visible to this reader, so its absence below is a measurement");
      rmSync(planted, { force: true });
      assert.deepEqual(tmpEntries(), [], "and the directory is clean again before the refusal below");

      // THE PLANTED COLLISION, AND IT IS DETERMINISTIC. `anno_snapshot`'s only
      // column is its primary key, and the next write's pointer-row insert
      // claims the CURRENT revision -- so a row already sitting at that
      // revision makes that insert fail with certainty, at the deepest point of
      // the staging -> publish -> insert window and with no race and no
      // privilege involved.
      const before = currentRevision(store);
      store.db.prepare("insert into anno_snapshot(revision) values (?)").run(before);

      assert.throws(
        () => setDataType(store, { start: 0x5000, endInclusive: 0x500f, dataType: "byte" }),
        (e: unknown) => {
          // HALF 1 -- FAMILY MEMBERSHIP. A bare SQLite `Error` is what the
          // pre-fix code produced here, so `instanceof ViceError` is the
          // assertion that distinguishes the two worlds.
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}: ${(e as Error).message}`);
          assert.ok(e instanceof ViceError, "and it must be inside the ViceError family -- a bare SQLite Error here is the defect");
          assert.ok(e.message.includes(path), `the refusal must name the store path, got ${e.message}`);
          return true;
        },
      );

      // HALF 2 -- THE COMPARE-AND-SWAP WAS ROLLED BACK. An open transaction
      // with the CAS applied reads as an advanced revision for a write that was
      // refused.
      assert.equal(before, 1, "the fixture is at the revision this test thinks it is at");
      assert.equal(currentRevision(store), before, "a refused write must leave the revision exactly where it was");

      // HALF 3 -- NOTHING STAGED SURVIVES.
      assert.deepEqual(tmpEntries(), [], "the refused write leaves no staging file behind");

      // HALF 4 -- AND THE HANDLE IS STILL USABLE, which is the half that proves
      // NO TRANSACTION WAS LEFT OPEN: a following write's `vacuum into` cannot
      // run inside one at all, and its own compare-and-swap would be reading a
      // revision nobody committed.
      store.db.prepare("delete from anno_snapshot where revision = ?").run(before);
      setDataType(store, { start: 0x6000, endInclusive: 0x600f, dataType: "byte" });
      assert.equal(currentRevision(store), before + 1, "an unobstructed write on the SAME handle advances the revision by exactly one");
      assert.equal(listRanges(store).filter((row) => row.start === 0x6000).length, 1, "and its row is really there");
      assert.equal(listRanges(store).filter((row) => row.start === 0x5000).length, 0, "while the refused write's row is absent");
    } finally {
      closeStore(store);
    }
  });

  // THE REACHABLE ARM OF THE PRE-LOCK HALF, in its own fixture because it needs
  // a store whose ring directory does not exist yet. A regular FILE sitting
  // where the ring directory should be makes `stageSnapshot`'s `mkdirSync`
  // throw, with no privilege and no race -- and that call sits BEFORE
  // `begin immediate`, so it is a different arm from the collision above.
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const ring = snapshotDirFor(store);
      assert.ok(!existsSync(ring), "the ring directory must genuinely not exist yet, or this arm proves nothing");
      writeFileSync(ring, "");
      assert.ok(statSync(ring).isFile(), "and what is planted there must be a regular FILE, not a directory");

      assert.throws(
        () => setDataType(store, { start: 0x0400, endInclusive: 0x0403, dataType: "byte" }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}: ${(e as Error).message}`);
          assert.ok(e instanceof ViceError, "the pre-lock arm must be inside the ViceError family too");
          assert.ok(e.message.includes(path), `and it must name the store path, got ${e.message}`);
          return true;
        },
      );
      assert.equal(currentRevision(store), 0, "nothing advanced -- the refusal happened before the transaction was even opened");

      rmSync(ring, { force: true });
      setDataType(store, { start: 0x0400, endInclusive: 0x0403, dataType: "byte" });
      assert.equal(currentRevision(store), 1, "and the store is usable again once the planted file is removed");
    } finally {
      closeStore(store);
    }
  });
});

test("WR-02 and WR-04, STRUCTURAL: the two remaining unguarded calls are inside handlers", () => {
  // WHY STRUCTURAL RATHER THAN BEHAVIOURAL, stated because a structural
  // assertion that does not say why it is structural reads as laziness. Neither
  // failure is deterministically constructible in-process:
  //
  //   * WR-02 -- a failure of the step-9 `pruneSnapshots` call AFTER a
  //     successful transaction -- needs a second connection to acquire the
  //     write lock in the instant between one connection's last statement and
  //     its next. `runWriteSequence` is fully synchronous, so no in-process
  //     interleave can land in that window, and a spawned child racing it would
  //     be timing-dependent: a flaky probe is worse evidence than an honest
  //     structural one.
  //   * WR-04 -- a failure of `pragma integrity_check` -- needs a genuinely
  //     corrupt SQLite page, which cannot be manufactured reliably from a test.
  //
  // THE REACHABLE ARMS ARE PINNED BEHAVIOURALLY ELSEWHERE, and are named here
  // so the pair is visible as a pair. WR-02's NON-throwing path is exercised by
  // every ordinary accepted-write test in this file -- most directly by "the
  // snapshot ring is BOUNDED at MAX_SNAPSHOT_REVISIONS", whose whole subject is
  // step 9 running to completion, and by "a prune whose sweep DEFERRED returns
  // early", which drives the contended path and asserts it does not throw.
  // WR-04's family membership is pinned by the four corrupt-file refusal tests
  // -- "a zero-length store file is REFUSED", "a file that is not a database at
  // all is refused", "a store whose schema_version is not this build's is
  // refused" and "a store truncated mid-file is refused" -- each of which
  // asserts an `AnnoStoreCorruptError` naming the path. This is the pattern
  // plan 28-08 established for exactly this situation.
  //
  // LITERAL BODIES KEPT (`codeOnly(src, true)`): both targets are identified by
  // SQL text inside string literals, which strict mode blanks.
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);

  /** The one instrument, applied to both sites: the call must sit inside a
   * `try` that is still OPEN at that point -- so the nearest preceding `try {`
   * must not have been closed by a `} catch` before the call is reached -- and a
   * matching `} catch` must follow it. A bare "there is a try somewhere above"
   * would be satisfied by an unrelated, already-closed handler. */
  const assertInsideHandler = (fnName: string, callNeedle: string, floor: number): void => {
    const fnStart = stripped.indexOf(fnName);
    assert.ok(fnStart >= 0, `${fnName} must be findable in the stripped source`);
    const fnEnd = stripped.indexOf("\n}", fnStart);
    assert.ok(fnEnd > fnStart, `and ${fnName}'s body must terminate at a column-zero closing brace`);
    const body = stripped.slice(fnStart, fnEnd);

    // NON-VACUITY FIRST: a failed extraction would satisfy every comparison
    // below trivially.
    assert.ok(body.length > floor, `the extracted ${fnName} body must be substantial, got ${body.length} characters`);
    const call = body.indexOf(callNeedle);
    assert.ok(call >= 0, `${callNeedle} must be present in the extracted ${fnName} body`);

    const openedTry = body.lastIndexOf("try {", call);
    assert.ok(openedTry >= 0, `${callNeedle} must have a try opening above it inside ${fnName}`);
    assert.equal(
      body.slice(openedTry, call).indexOf("} catch"),
      -1,
      `the try above ${callNeedle} must still be OPEN where the call is made -- an already-closed handler guards nothing`,
    );
    const closingCatch = body.indexOf("} catch", call);
    assert.ok(
      closingCatch > call,
      `and a matching catch must follow ${callNeedle}, so a failure there cannot escape (call at ${call}, catch at ${closingCatch})`,
    );
  };

  // WR-02: the post-commit prune. Its catch must NOT rethrow -- once the
  // transaction has returned the write HAPPENED, and a housekeeping failure
  // that throws makes the caller retry an additive verb and produce a second
  // row.
  assertInsideHandler("function runWriteSequence", "pruneSnapshots(handle)", 800);

  // WR-04: the last known `ViceError`-family escape in `openStore`.
  assertInsideHandler("export function openStore", "pragma integrity_check", 800);
});

test("STORE-05 ordering: a REFUSED stale write leaves the surviving rows in the identical ascending-id order they had before the attempt -- in the connection and on disk", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    let before: ReturnType<typeof listRanges>;
    try {
      setDataType(store, { start: 0x1000, endInclusive: 0x10ff, dataType: "code" });
      setDataType(store, { start: 0x2000, endInclusive: 0x20ff, dataType: "byte" });
      setDataType(store, { start: 0x3000, endInclusive: 0x30ff, dataType: "word" });

      before = listRanges(store);
      assert.deepEqual(
        before.map((row) => row.id),
        [1, 2, 3],
        "the three non-overlapping writes must leave ids 1, 2 and 3 -- the fixture this test measures against",
      );

      assert.throws(
        () => setDataType(store, { start: 0x4000, endInclusive: 0x40ff, dataType: "byte", baseRevision: 0 }),
        AnnoStoreStaleRevisionError,
        "the write based on a stale revision must be refused",
      );

      assert.deepEqual(
        listRanges(store),
        before,
        "a refusal must never reorder, renumber or reinsert another process's rows: ids, starts, ends, types and order must all be identical " +
          "to what they were before the attempt",
      );
    } finally {
      closeStore(store);
    }

    // AND ON DISK, not only in the connection that made the attempt. A refusal
    // that reordered rows in the file but not in the open connection's answer
    // would pass the assertion above and still be the defect.
    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      assert.deepEqual(listRanges(reopened), before, "and the identical array after a close and a reopen, so the property is proven on disk");
    } finally {
      closeStore(reopened);
    }
  });
});

// ---------------------------------------------------------------------------
// CR-05 -- A SECOND SPELLING OF THE SAME STORE FILE.
//
// Reproduced twice by the phase-28 round-3 verifier, through production entry
// points, against committed code: the snapshot ring is named from
// `basename(handle.path)`, so a SYMLINK ALIAS of the store file (or a rename of
// the store file) names a DIFFERENT ring. `retainedRevisions()` then reports
// every existing pointer row as unretained -- its file is not in THIS ring --
// and the sweep at the top of the next prune classified all of them as orphan
// ROWS and deleted them under its own committed transaction. The revert history
// was destroyed irreversibly and restoring the original name recovered nothing.
//
// The fix is not a better spelling: it is that the sweep ABSTAINS from the row
// direction entirely, because it cannot establish ownership of it in ANY
// spelling. The two tests below drive the two reproduced routes.
// ---------------------------------------------------------------------------

test("CR-05: a store reached through a SYMLINK ALIAS keeps every pointer row and every snapshot file -- the sweep can no longer delete a row it does not own", () => {
  inTempDir((dir) => {
    const realPath = join(dir, "real.annostore");
    let store = openStore(realPath, { workspaceRoot: dir });
    let aliasHandle: ReturnType<typeof openStore> | undefined;
    try {
      for (let i = 0; i < 3; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }
      const retainedBefore = retainedRevisions(store);
      const floorBefore = oldestRetainedRevision(store);
      const realRing = snapshotDirFor(store);
      const filesBefore = readdirSync(realRing).sort();
      assert.ok(retainedBefore.length > 0, "the pre-alias ring must genuinely hold retained revisions, or everything below is trivially satisfied");
      assert.notEqual(floorBefore, NO_RETAINED_REVISION, "and it must publish a floor");
      closeStore(store);

      // THE SECOND SPELLING. A RELATIVE symlink, because that is the ordinary
      // unprivileged way one inode acquires two names and it is what the
      // verifier reproduced.
      const aliasPath = join(dir, "alias.annostore");
      symlinkSync("real.annostore", aliasPath);

      // OPENED WITH NO `workspaceRoot`, WHICH IS LOAD-BEARING: that is the exact
      // shape `revertTo` itself uses (`openStore(storePath)`), and supplying a
      // root would realpath the alias back onto the real name and make this test
      // prove nothing.
      aliasHandle = openStore(aliasPath);
      const aliasRing = snapshotDirFor(aliasHandle);
      assert.notEqual(
        aliasRing,
        realRing,
        "NON-VACUITY: the alias handle must name a DIFFERENT ring directory -- a test that accidentally opened the same ring would prove nothing",
      );

      // ONE accepted write through the alias. Before this change, this single
      // write's prune swept every pointer row the store had.
      setDataType(aliasHandle, { start: 0x2000, endInclusive: 0x200f, dataType: "code" });
      closeStore(aliasHandle);
      aliasHandle = undefined;

      // REOPENED BY THE REAL PATH -- the direction that has to still work.
      store = openStore(realPath, { workspaceRoot: dir });
      const rowsAfter = (store.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[]).map(
        (row) => row.revision,
      );
      for (const revision of retainedBefore) {
        assert.ok(rowsAfter.includes(revision), `the pointer row for r${revision} must survive a write through the alias, rows are ${JSON.stringify(rowsAfter)}`);
        assert.ok(existsSync(snapshotPathFor(store, revision)), `and so must its snapshot file, r${revision}`);
      }
      assert.deepEqual(readdirSync(realRing).sort(), filesBefore, "the real ring's files are untouched by the alias write");
      assert.deepEqual(
        retainedRevisions(store),
        retainedBefore,
        "and the store reports exactly the retained list it reported before the alias write -- the revert history is still reachable",
      );
      assert.equal(oldestRetainedRevision(store), floorBefore, "the published floor is unchanged");

      store = revertTo(store, 1);
      assert.equal(currentRevision(store), 1, "and reverting to r1 SUCCEEDS -- before this change the same sequence refused, with every row deleted");
    } finally {
      if (aliasHandle !== undefined) closeStore(aliasHandle);
      closeStore(store);
    }
  });
});

test("CR-05 (b): renaming the store FILE, writing, and renaming back leaves the pre-rename floor intact", () => {
  inTempDir((dir) => {
    const originalPath = join(dir, "proj.annostore");
    let store = openStore(originalPath, { workspaceRoot: dir });
    let renamed: ReturnType<typeof openStore> | undefined;
    try {
      for (let i = 0; i < 3; i += 1) {
        setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
      }
      const floorBefore = oldestRetainedRevision(store);
      const filesBefore = readdirSync(join(dir, "proj.annostore.snapshots")).sort();
      assert.notEqual(floorBefore, NO_RETAINED_REVISION, "the store must publish a floor before the rename, or the recovery claim below is vacuous");
      closeStore(store);

      // THE SECOND REPRODUCED SPELLING: `mv proj.annostore other.annostore`.
      // The ring is named from the store FILE, so the renamed handle names a
      // ring that does not exist yet and creates its own.
      const otherPath = join(dir, "other.annostore");
      renameSync(originalPath, otherPath);
      renamed = openStore(otherPath);
      assert.notEqual(
        snapshotDirFor(renamed),
        join(dir, "proj.annostore.snapshots"),
        "NON-VACUITY: the renamed handle must name a DIFFERENT ring, or this reproduces nothing",
      );
      setDataType(renamed, { start: 0x2000, endInclusive: 0x200f, dataType: "code" });
      closeStore(renamed);
      renamed = undefined;

      // AND BACK. Before this change the one write above had already deleted
      // every pointer row, so this reopen published NO_RETAINED_REVISION and
      // every revertTo refused -- renaming back recovered nothing.
      //
      // THE CLAIM IS BOUNDED AT THIS ONE WRITE and is NOT a claim of
      // unconditional recovery: `pruneSnapshots`' doomed loop still deletes
      // every row below `currentRevision() - MAX_SNAPSHOT_REVISIONS`, so the
      // floor survives only while the wrong-spelling handle has not advanced
      // past that many further revisions. What the sweep can no longer do is
      // delete the rows immediately, at any revision, which is what made the
      // loss irreversible.
      renameSync(otherPath, originalPath);
      store = openStore(originalPath, { workspaceRoot: dir });
      assert.equal(
        oldestRetainedRevision(store),
        floorBefore,
        "the pre-rename floor is intact after the rename-back -- the sweep under the wrong spelling deleted no pointer row (CR-05)",
      );
      assert.deepEqual(readdirSync(join(dir, "proj.annostore.snapshots")).sort(), filesBefore, "and the original ring's files are untouched");
      store = revertTo(store, floorBefore);
      assert.equal(currentRevision(store), floorBefore, "and reverting to that floor SUCCEEDS rather than refusing");
    } finally {
      if (renamed !== undefined) closeStore(renamed);
      closeStore(store);
    }
  });
});

test(
  "CR-07: a sweep that throws inside its own transaction leaves the caller's connection with NO open transaction",
  {
    // ROOT IGNORES THE MODE BITS, so the construction below cannot be built as
    // root: `readdirSync` would succeed, the sweep would never throw, and every
    // assertion would pass for the wrong reason. THE RUNNER REPORTS THIS SKIP
    // (WR-14). This used to be an in-body vacuous truth assertion carrying its
    // reason as a message -- which node:test never surfaces and never counts as a
    // skip, so the suite read 159/159 with this file's only behavioural CR-07
    // control silently not executed. The precondition is therefore declared where
    // the runner can COUNT it, in the same form as `anno-confinement.test.ts`
    // case 14, and its marker string is gone from this file entirely so a
    // re-introduction is greppable.
    skip: process.getuid?.() === 0 ? "running as root: root ignores directory mode bits, so an unreadable ring directory is not constructible and this case would pass vacuously" : false,
  },
  () => {
    inTempDir((dir) => {
      const path = join(dir, "proj.annostore");
      const store = openStore(path, { workspaceRoot: dir });
      const ring = join(dir, "proj.annostore.snapshots");
      try {
        for (let i = 0; i < 3; i += 1) {
          setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
        }
        const rowsBefore = (store.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[]).map(
          (row) => row.revision,
        );
        assert.ok(rowsBefore.length > 0, "the ring must genuinely hold rows, or 'unchanged apart from the new one' is trivially satisfied");
        const revisionBefore = currentRevision(store);

        try {
          // WRITABLE BUT NOT READABLE. The sweep can still stage and publish into
          // this directory and can still `existsSync` a path inside it, so the
          // write itself is entirely ordinary; only the sweep's `readdirSync`
          // throws. That is the whole point -- the failure is reachable from an
          // ORDINARY setDataType, not from a test-only entry point.
          chmodSync(ring, 0o300);

          // PROHIBITION 28-11 P5: the committed write is NOT converted into a
          // caller-visible failure. Step 9's WR-02 wrap swallows the housekeeping
          // throw, which is correct -- and is also what made this defect silent.
          const result = setDataType(store, { start: 0x7000, endInclusive: 0x700f, dataType: "code" });
          assert.equal(result.revision, revisionBefore + 1, "the write is accepted and reports the advanced revision -- a committed write is never reported as a failure");

          // THE ASSERTION THIS TEST EXISTS FOR. Against the pre-task code the
          // sweep's `begin immediate` was still open on this very connection, so
          // this statement threw "cannot start a transaction within a
          // transaction" and the handle was permanently wedged.
          store.db.exec("begin immediate");
          store.db.exec("rollback");

          const rowsAfter = (store.db.prepare("select revision from anno_snapshot order by revision").all() as { revision: number }[]).map(
            (row) => row.revision,
          );
          assert.deepEqual(
            rowsAfter,
            [...rowsBefore, revisionBefore],
            "the rolled-back sweep changed no pointer row -- the rows are the pre-write set plus exactly the one this write inserted",
          );
        } finally {
          // Restored unconditionally so the temp directory can be removed.
          chmodSync(ring, 0o700);
        }
      } finally {
        closeStore(store);
      }
    });
  },
);

// ---------------------------------------------------------------------------
// 28-14 task 2 -- `revertTo` step 6: a housekeeping failure never costs the
// caller a handle for a revert that already succeeded on disk (CR-07's third
// property, gap-1 missing item 4). TWO controls, and their reach is DECLARED
// rather than left for a reader to assume from a green tick.
// ---------------------------------------------------------------------------

test(
  "revertTo returns a usable handle even when its step-6 sweep cannot read the ring (composite: 28-13's non-throwing sweep plus this handler)",
  {
    // ROOT CANNOT CONSTRUCT THIS FIXTURE, so the runner reports the skip rather
    // than this body reporting a pass (WR-14). Root ignores directory mode bits:
    // `readdirSync` would succeed and the unreadable-ring precondition would not
    // exist at all. The former in-body vacuous truth assertion did the exact
    // opposite of what its own message demanded -- it passed, invisibly, for a
    // precondition it could not build. Same declaration form as
    // `anno-confinement.test.ts` case 14; no third spelling.
    skip: process.getuid?.() === 0 ? "running as root: root ignores directory mode bits, so an unreadable ring directory is not constructible and this case would pass vacuously" : false,
  },
  () => {
      // WHAT THIS CONTROL DOES AND DOES NOT DISCRIMINATE, stated plainly because
    // round 3 found three live blockers sitting under green controls whose reach
    // was never declared.
    //
    // IT PINS: the end-to-end property -- `revertTo` never hands the caller an
    // exception, and never hands them nothing, for a revert that has already
    // succeeded on disk when the ring is unreadable at step 6.
    //
    // IT DOES NOT DISCRIMINATE plan 28-14 task 2's `try`/`catch` around the sweep.
    // It passes IDENTICALLY with and without that handler, because plan 28-13
    // bracketed `reconcileSnapshotRing`'s whole body in a handler that rolls back
    // and returns `deferred: true` without rethrowing -- so the sweep does not
    // throw here, and this test's `revertTo` call never enters task 2's `catch`.
    // The property is therefore COMPOSITE: 28-13 supplies the reason it passes
    // today, and 28-14 supplies the guarantee that it keeps passing if a future
    // edit ever reintroduces a throw. The control that actually bites on task 2's
    // edit is the structural backstop directly below this one.
    inTempDir((dir) => {
      const path = join(dir, "proj.annostore");
      const ring = join(dir, "proj.annostore.snapshots");
      let store = openStore(path, { workspaceRoot: dir });
      try {
        for (let i = 0; i < 3; i += 1) {
          setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
        }
        const retained = retainedRevisions(store);
        assert.ok(retained.length >= 2, `the fixture must retain at least two revisions or the target below is not a choice, got ${retained.join(", ")}`);
        const target = retained[1];
        assert.equal(currentRevision(store), 3, "the fixture is at the revision this test thinks it is at");

        try {
          // WRITABLE BUT NOT READABLE, the same construction the CR-07 sweep test
          // uses: `existsSync` and `copyFileSync` on a path INSIDE the ring still
          // work (search permission is present), so steps 1 through 5 of the
          // revert are entirely ordinary and the revert genuinely lands on disk.
          // Only step 6's `readdirSync` of the directory itself is refused.
          chmodSync(ring, 0o300);

          store = revertTo(store, target);

          assert.equal(currentRevision(store), target, "revertTo returned a handle at the revision asked for -- it did not throw for a revert that already landed");
          assert.ok(Array.isArray(listRanges(store)), "and the returned handle answers listRanges");
          // NO TRANSACTION IS OPEN on the handle handed back. A connection still
          // inside the sweep's transaction would report "cannot start a
          // transaction within a transaction" here.
          store.db.exec("begin immediate");
          store.db.exec("rollback");
        } finally {
          // Restored unconditionally so the temp directory can be removed.
          chmodSync(ring, 0o700);
        }

        // NON-VACUITY OF THE PRECONDITION, asserted only after the mode is
        // restored (the reader below needs the directory readable). Had step 6's
        // sweep actually run to completion it would have dropped the snapshot
        // FILES no restored pointer row claims. All three still being there is the
        // measurement that the sweep genuinely could not read the ring -- without
        // it, "revertTo returned a handle" would be equally true of a run in which
        // the chmod did nothing.
        assert.deepEqual(
          readdirSync(ring)
            .filter((name) => name.endsWith(".db"))
            .sort(),
          ["r0.db", "r1.db", "r2.db"],
          "the unreadable ring was genuinely not swept -- every snapshot file the sweep would have reclaimed is still there",
        );
      } finally {
        closeStore(store);
      }
    });
  },
);

test("revertTo step 6, STRUCTURAL BACKSTOP: the sweep call sits inside a handler, so a future edit that reintroduces a throw cannot cost the caller a handle", () => {
  // WHY THIS IS A BACKSTOP, AND WHY IT IS THE CONTROL THAT BITES -- both stated,
  // because a structural assertion that does not say why it is structural reads
  // as laziness and this file's own conventions forbid it.
  //
  // WHY STRUCTURAL: plan 28-13 made `reconcileSnapshotRing` non-throwing on
  // every reachable input -- its body is bracketed by a handler that rolls back
  // and returns `deferred: true` without rethrowing. There is therefore NO test
  // input that reaches `revertTo`'s step-6 `catch`, and a behavioural control
  // claiming to prove that handler would be claiming something it cannot.
  //
  // WHY IT BITES ANYWAY: the handler is defence in depth against a future edit
  // that reintroduces a throw inside the sweep -- precisely the edit rounds 1, 2
  // and 3 each made in this file. This assertion is what fails when someone
  // removes the handler, and it is the ONLY control in this file that does. The
  // composite control above pins the end-to-end property and passes with or
  // without the handler; it is not evidence for this edit.
  //
  // LITERAL BODIES KEPT (`codeOnly(src, true)`): the surrounding function is
  // identified by source text and strict mode would blank the SQL literals that
  // make the body substantial.
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);

  const fnStart = stripped.indexOf("export function revertTo");
  assert.ok(fnStart >= 0, "revertTo must be findable in the stripped source");
  const fnEnd = stripped.indexOf("\n}", fnStart);
  assert.ok(fnEnd > fnStart, "and revertTo's body must terminate at a column-zero closing brace");
  const body = stripped.slice(fnStart, fnEnd);

  // NON-VACUITY FIRST: a failed extraction would satisfy every comparison below
  // trivially.
  assert.ok(body.length > 800, `the extracted revertTo body must be substantial, got ${body.length} characters`);
  const call = body.indexOf("reconcileSnapshotRing(restored)");
  assert.ok(call >= 0, "the sweep call must be present in the extracted revertTo body");

  const openedTry = body.lastIndexOf("try {", call);
  assert.ok(openedTry >= 0, "the sweep call must have a try opening above it inside revertTo");
  assert.equal(
    body.slice(openedTry, call).indexOf("} catch"),
    -1,
    "the try above the sweep call must still be OPEN where the call is made -- an already-closed handler guards nothing",
  );
  const closingCatch = body.indexOf("} catch", call);
  assert.ok(
    closingCatch > call,
    `and a matching catch must follow the sweep call, so a throw there cannot escape (call at ${call}, catch at ${closingCatch})`,
  );

  // AND THE HANDLER MUST STILL HAND BACK A HANDLE. A `catch` that merely
  // swallowed would return `restored` -- a connection whose transaction state is
  // unknown -- which is the defect, not the repair.
  const handler = body.slice(closingCatch);
  assert.match(handler.slice(0, 400), /closeStore\(restored\)/, "the handler must close the connection whose transaction state is unknown");
  assert.match(handler.slice(0, 400), /return openStore\(storePath\)/, "and must hand back a freshly opened handle rather than the suspect one");
});

test("WR-17, STRUCTURAL: every openStore AFTER the rename in revertTo is inside a handler, and the reopen failure reports a revert that LANDED ON DISK", () => {
  // WHY THIS IS STRUCTURAL, stated because this file's own conventions forbid a
  // structural assertion that does not say why it is one. The failure being
  // guarded is a REOPEN OF A FILE THIS FUNCTION JUST WROTE: `openStore` runs the
  // `anno_meta` read, the `schema_version` comparison and `pragma
  // integrity_check` against the image step 5 renamed into place a statement
  // earlier. Constructing that failure in-process would need filesystem-level
  // fault injection between the rename and the reopen -- the same reason the
  // phase's `integrity_check`-throw arm is a standing human-verification item
  // rather than a test.
  //
  // AND STEP 3b IS WHY IT IS STRUCTURAL RATHER THAN BEHAVIOURAL *NOW*: task 1
  // removed the reopen's most likely failure by refusing a bad image before the
  // rename, so the remaining causes are all external to this process.
  //
  // LITERAL BODIES KEPT (`codeOnly(src, true)`): the surrounding function is
  // identified by source text and strict mode would blank the SQL literals that
  // make the body substantial.
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);
  const fnStart = stripped.indexOf("export function revertTo");
  assert.ok(fnStart >= 0, "revertTo must be findable in the stripped source");
  const fnEnd = stripped.indexOf("\n}", fnStart);
  assert.ok(fnEnd > fnStart, "and its body must terminate at a column-zero closing brace");
  const body = stripped.slice(fnStart, fnEnd);

  // NON-VACUITY FIRST, IN BOTH DIRECTIONS: a failed extraction makes the
  // "every occurrence is guarded" claim true of an empty set, and so does a body
  // in which the rename cannot be found.
  assert.ok(body.length > 400, `the extracted revertTo body must be substantial, got ${body.length} characters`);
  const rename = body.indexOf("renameSync(staging, storePath)");
  assert.ok(rename >= 0, "step 5's rename must be findable in the extracted body");

  const afterRename: number[] = [];
  for (let at = body.indexOf("openStore(", rename); at >= 0; at = body.indexOf("openStore(", at + 1)) {
    afterRename.push(at);
  }
  assert.equal(
    afterRename.length,
    2,
    `revertTo must reopen the store exactly twice after the rename -- once on the ordinary path and once on the sweep handler's recovery ` +
      `path -- and both must be counted here; found ${afterRename.length} at ${afterRename.join(", ")}`,
  );

  // AND EACH ONE IS BETWEEN A `try {` AND ITS HANDLER. A `try` that has already
  // closed above the call guards nothing, which is why the check is "no `} catch`
  // between the try and the call" rather than "a try exists above it".
  for (const at of afterRename) {
    const openedTry = body.lastIndexOf("try {", at);
    assert.ok(openedTry >= 0, `the openStore at ${at} must have a try opening above it inside revertTo`);
    assert.equal(
      body.slice(openedTry, at).indexOf("} catch"),
      -1,
      `the try above the openStore at ${at} must still be OPEN where the call is made -- an already-closed handler guards nothing`,
    );
    const closingCatch = body.indexOf("} catch", at);
    assert.ok(
      closingCatch > at,
      `and a matching catch must follow the openStore at ${at}, so a bare OS error cannot escape step 6 (catch at ${closingCatch})`,
    );
  }

  // THE MESSAGE MUST REPORT A LANDED REVERT, NOT A FAILED ONE (prohibition
  // 28-11 P5): by this point the rename and the directory fsync have returned,
  // so telling the caller the revert failed would send them looking for a revert
  // that already happened.
  const landed = body.indexOf("LANDED ON DISK");
  assert.ok(landed > rename, "the reopen failure's message must say the revert LANDED ON DISK, after the rename");
  const landedCount = body.split("LANDED ON DISK").length - 1;
  assert.equal(landedCount, 2, `both reopen handlers must say it, found ${landedCount}`);
  assert.match(
    body.slice(landed - 200, landed + 600),
    /\$\{storePath\}/,
    "and must interpolate the store path, so the caller knows WHICH file is the restored image",
  );
  assert.match(body.slice(landed - 200, landed + 600), /\$\{revision\}/, "and the revision the store landed on");
});

// ---------------------------------------------------------------------------
// CR-08 -- WHAT PROVES A SNAPSHOT IMAGE IS A STORE.
//
// Reproduced against committed code by the round-4 verifier, through production
// entry points only and with no hand edit of any source file: `revertTo` gated
// on `existsSync(snapPath)` and nothing more, then closed the caller's handle
// and renamed that unverified file over the live store. A retained snapshot
// truncated to zero bytes therefore took a 69,632-byte live store to 0 bytes,
// returned NO handle at all, and made every later `openStore` refuse -- and the
// bytes destroyed were the only copy, because the CURRENT revision has no
// snapshot of its own by design.
//
// This module's own FIRST MEASURED FACT is why presence could never have been
// the witness: a ZERO-LENGTH FILE OPENS as a SQLite database and reports
// `integrity_check ok`. The refusal is the store's own job -- reasoning the
// module applied to `openStore` and never applied to the image `revertTo`
// installs.
//
// THE FIX IS AN ORDERING, NOT A ZERO-LENGTH SPECIAL CASE. Step 3b opens the
// STAGED COPY -- the exact bytes step 5 renames -- before step 4 closes
// anything, so every destructive step is downstream of a successful open. The
// two tests below drive the two shapes that reach it (truncated, and foreign
// bytes); neither of them mentions a byte length to the code under test.
// ---------------------------------------------------------------------------

/** A store at revision 3 whose ring holds exactly `[r0.db, r1.db, r2.db]` --
 * the fixture the round-4 verifier's CR-08 reproduction used, built through
 * `setDataType` and nothing else. Returned OPEN; the caller closes it. */
function revisionThreeStore(dir: string): ReturnType<typeof openStore> {
  const store = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
  for (let i = 0; i < 3; i += 1) {
    setDataType(store, { start: 0x1000 + i * 0x10, endInclusive: 0x1000 + i * 0x10 + 0x0f, dataType: "byte" });
  }
  return store;
}

/** The four properties a refused revert must leave behind, asserted together
 * because each one alone would pass against a different broken implementation:
 * a refusal that destroyed the store would satisfy the throw assertion, and a
 * silent no-op would satisfy the store-unchanged one. */
function assertRefusedRevertLeftEverythingIntact(
  store: ReturnType<typeof openStore>,
  path: string,
  snapPath: string,
  revision: number,
  bytesBefore: Buffer,
  rowsBefore: ReturnType<typeof listRanges>,
): void {
  assert.equal(statSync(path).size, bytesBefore.length, "the live store's byte length must be exactly what it was before the refused revert");
  assert.ok(
    readFileSync(path).equals(bytesBefore),
    "and its CONTENT must be byte-identical -- a same-length replacement is the failure a length-only assertion would miss",
  );
  assert.equal(currentRevision(store), 3, "the SAME handle must still answer currentRevision() -- the refusal must not have closed it");
  assert.deepEqual(listRanges(store), rowsBefore, "and must still answer listRanges() with the rows it had before the attempt");
  assert.ok(existsSync(snapPath), `the refused snapshot for r${revision} is left on disk for inspection rather than unlinked`);
}

test("CR-08: a retained snapshot TRUNCATED to zero bytes is REFUSED by name -- the live store stays byte-identical, the caller's handle still answers, and a later openStore succeeds", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = revisionThreeStore(dir);
    try {
      assert.equal(currentRevision(store), 3, "the fixture must be at revision 3");
      assert.deepEqual(
        readdirSync(join(dir, "proj.annostore.snapshots")).sort(),
        ["r0.db", "r1.db", "r2.db"],
        "and its ring must hold exactly the three snapshot files the reproduction used -- spelled out here rather than asked of the code under test",
      );

      const bytesBefore = readFileSync(path);
      const rowsBefore = listRanges(store);
      // THE VERIFIER'S FIGURE, PINNED. This is an OBSERVATION of SQLite's
      // default page size on a three-write store, not a store invariant: if
      // this ever changes it is a SQLite default that moved and the number is
      // to be re-recorded, not a defect. It is pinned because the reproduction
      // this test closes is quoted in revision numbers AND in bytes -- "69632
      // -> 0" is the whole finding -- and a test that never names the number
      // cannot be matched against it.
      assert.equal(bytesBefore.length, 69632, "the live store measures the 69,632 bytes the CR-08 reproduction destroyed");
      assert.equal(rowsBefore.length, 3, "with the three rows the three writes added");

      const snapPath = snapshotPathFor(store, 1);
      truncateSync(snapPath, 0);
      assert.equal(statSync(snapPath).size, 0, "the planting must really have emptied r1.db, or this test proves nothing");

      assert.throws(
        () => revertTo(store, 1),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
          assert.ok(e instanceof ViceError, "and it must be inside the ViceError family -- the reproduction escaped it entirely");
          assert.ok(e.message.includes(path), `the refusal must name the store path; got ${e.message}`);
          assert.ok(e.message.includes(snapPath), `and the snapshot path; got ${e.message}`);
          assert.match(
            e.message,
            /NOTHING has been replaced/,
            "and must say so in as many words, because the reproduced failure differs from this one in exactly that fact",
          );
          return true;
        },
      );

      assertRefusedRevertLeftEverythingIntact(store, path, snapPath, 1, bytesBefore, rowsBefore);
    } finally {
      closeStore(store);
    }

    // AND THE STORE IS STILL OPENABLE FROM SCRATCH. In the reproduction this
    // threw `AnnoStoreCorruptError: not an annotation store (no such table:
    // anno_meta)` for the rest of the store's life.
    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      assert.equal(currentRevision(reopened), 3, "a FRESH handle over the same path reads the untouched revision");
      assert.equal(listRanges(reopened).length, 3, "and the untouched rows");
    } finally {
      closeStore(reopened);
    }

    // AND THE SOURCE ORDER, ASSERTED HERE RATHER THAN AS ITS OWN TEST, because
    // it is the SAME CLAIM as everything above seen from the other side: the
    // assertions above show the outcome, this one shows WHY the outcome is
    // structural rather than incidental. A behavioural assertion cannot see it.
    // Everything above passes against an implementation that validated the
    // SOURCE image instead of the staged copy, and against one that closed the
    // caller's handle first and reopened it on failure -- arrangements that
    // leave the same end state on every input a test can construct in-process,
    // and that differ only in WHICH FAILURES ARE SURVIVABLE.
    //
    // LITERAL BODIES KEPT (`codeOnly(src, true)`): the surrounding function is
    // identified by source text and strict mode would blank the SQL literals
    // that make the body substantial.
    const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);
    const fnStart = stripped.indexOf("export function revertTo");
    assert.ok(fnStart >= 0, "revertTo must be findable in the stripped source");
    const fnEnd = stripped.indexOf("\n}", fnStart);
    assert.ok(fnEnd > fnStart, "and its body must terminate at a column-zero closing brace");
    const body = stripped.slice(fnStart, fnEnd);

    // NON-VACUITY FIRST, and then a presence check per landmark: a failed
    // extraction returns -1 for all three landmarks, and -1 < -1 is false, so
    // the ordering comparisons alone would report the wrong reason for the
    // failure rather than passing -- the presence checks are what name it.
    assert.ok(body.length > 800, `the extracted revertTo body must be substantial, got ${body.length} characters`);

    const validate = body.indexOf('openStore(staging, { mustExist: true })');
    const closeCaller = body.indexOf("closeStore(handle)");
    const rename = body.indexOf("renameSync(staging, storePath)");
    assert.ok(validate >= 0, "step 3b's open of the STAGED copy must be present in revertTo's body");
    assert.ok(closeCaller >= 0, "step 4's close of the caller's handle must be present");
    assert.ok(rename >= 0, "and step 5's rename over the live store must be present");

    assert.ok(
      validate < closeCaller,
      `the staged image must be OPENED before the caller's handle is closed -- otherwise a bad image costs the caller its handle ` +
        `(open at ${validate}, close at ${closeCaller})`,
    );
    assert.ok(
      validate < rename,
      `and before the rename over the live store -- otherwise a bad image destroys the only copy of the current revision ` +
        `(open at ${validate}, rename at ${rename})`,
    );
  });
});

test("CR-08: a retained snapshot overwritten with FOREIGN BYTES is refused by the same gate -- the fix is an ordering, not a zero-length special case", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = revisionThreeStore(dir);
    try {
      const bytesBefore = readFileSync(path);
      const rowsBefore = listRanges(store);
      const snapPath = snapshotPathFor(store, 1);

      // NOT A DATABASE, AND NOT EMPTY EITHER -- long enough to survive SQLite's
      // 100-byte header read, so the refusal cannot come from a short-file
      // check. This is the shape a partial copy or another tool's file has, and
      // it needs no crash and no race to arrive.
      writeFileSync(snapPath, "this is not a database, it is ASCII text that another tool wrote into the ring directory. ".repeat(4));
      assert.ok(statSync(snapPath).size > 100, "the planted payload must exceed SQLite's header length");

      assert.throws(
        () => revertTo(store, 1),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
          assert.ok(e instanceof ViceError, "inside the ViceError family");
          assert.ok(e.message.includes(path), `naming the store path; got ${e.message}`);
          assert.ok(e.message.includes(snapPath), `and the snapshot path; got ${e.message}`);
          assert.match(e.message, /NOTHING has been replaced/);
          return true;
        },
      );

      assertRefusedRevertLeftEverythingIntact(store, path, snapPath, 1, bytesBefore, rowsBefore);
    } finally {
      closeStore(store);
    }

    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      assert.equal(currentRevision(reopened), 3, "and the store is still openable from scratch");
    } finally {
      closeStore(reopened);
    }
  });
});

// ---------------------------------------------------------------------------
// CR-08's SUPPORTING HALF -- WHAT "RETAINED" MEANS.
//
// `revertTo`'s gate was not the only witness built on presence: the PUBLISHED
// FLOOR was too. So the store advertised a revision whose image was not a
// database and then destroyed itself when a caller followed its own published
// floor. Presence and openability are promoted to ONE meaning here, read by the
// advertisement and by the gate from the same place, because "three independent
// decisions is precisely how the three answers came to disagree" is this
// module's own recorded finding.
//
// AND THE PROMOTION INTRODUCES ITS OWN HAZARD, which TEST C below is the control
// for: the ring's file sweep used `retainedRevisions` as its KEEP set, so
// promoting that function would have made the sweep unlink every image that
// failed to open -- a second destruction dressed as a repair, deleting exactly
// the evidence of the first. The sweep asks a DIFFERENT question (`is this file
// claimed by a pointer ROW`) and gets a differently named answer.
// ---------------------------------------------------------------------------

test("CR-08: retainedRevisions and oldestRetainedRevision never advertise a revision whose image cannot be OPENED -- with the healthy-ring control and the two distinct refusals", () => {
  inTempDir((dir) => {
    const store = revisionThreeStore(dir);
    try {
      // THE HEALTHY CONTROL FIRST, AND ON THE SAME FIXTURE. The promotion must
      // not narrow the healthy case, and a test that only ever looks at the
      // corrupted ring cannot see it if it does.
      assert.deepEqual(retainedRevisions(store), [0, 1, 2], "an intact ring of three images advertises all three revisions");
      assert.equal(oldestRetainedRevision(store), 0, "and publishes revision 0 as the floor");

      const snapPath = snapshotPathFor(store, 1);
      truncateSync(snapPath, 0);
      assert.equal(statSync(snapPath).size, 0, "the planting must really have emptied r1.db");

      // THE PROMOTION. Before it, both answers still named revision 1 -- and
      // following that floor into `revertTo` destroyed the live store.
      assert.deepEqual(
        retainedRevisions(store),
        [0, 2],
        "a revision whose image is present but does not OPEN as an annotation store is not retained: presence was never the witness, " +
          "because a ZERO-LENGTH FILE OPENS as a SQLite database and reports integrity_check ok",
      );
      assert.equal(oldestRetainedRevision(store), 0, "the floor is the first genuinely reachable revision");

      // THE TWO REFUSALS ARE DISTINCT, and the distinction is the caller's only
      // way to tell "there is nothing there" from "there is something there and
      // it is not a store" -- which is the difference between a bound they hit
      // and a file they should go and look at.
      let presentButUnopenable = "";
      assert.throws(
        () => revertTo(store, 1),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
          presentButUnopenable = e.message;
          assert.ok(e.message.includes(snapPath), `the refusal must name the snapshot path; got ${e.message}`);
          assert.match(
            e.message,
            /is not a readable annotation store/,
            "and must say the snapshot is present but unreadable rather than absent",
          );
          assert.match(e.message, /Available revisions: 0, 2/, "and its available-revisions list must be the promoted one");
          return true;
        },
      );

      let noRowAtAll = "";
      assert.throws(
        () => revertTo(store, 99),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
          noRowAtAll = e.message;
          assert.match(e.message, /no snapshot is retained for it/, "a revision with no pointer row at all keeps the pre-existing wording");
          assert.match(
            e.message,
            /Available revisions: 0, 2/,
            "and its available-revisions list is built from the promoted retainedRevisions, so a refusal cannot steer the caller at a " +
              "revision the very next call would also refuse",
          );
          return true;
        },
      );

      assert.notEqual(
        presentButUnopenable,
        noRowAtAll,
        "the two refusals must not be the same message: one says go and look at the file, the other says there is no file",
      );

      // AND NEITHER REFUSAL COST THE CALLER ANYTHING: both arms are before any
      // filesystem mutation.
      assert.equal(currentRevision(store), 3, "the handle still answers after both refusals");
      assert.equal(listRanges(store).length, 3, "with its rows intact");
    } finally {
      closeStore(store);
    }
  });
});

test("CR-08: every revision retainedRevisions() advertises can actually be reverted to -- the loop is over the ADVERTISED LIST, never over literals, and the fixture is rebuilt per iteration", () => {
  inTempDir((root) => {
    // ONE BUILDER, USED FOR THE PRISTINE READ AND FOR EVERY ITERATION, so the
    // loop's stores and the store the list was read from are the same shape by
    // construction rather than by two parallel fixtures agreeing.
    const buildAt = (sub: string): ReturnType<typeof openStore> => {
      const d = join(root, sub);
      mkdirSync(d);
      const s = revisionThreeStore(d);
      // THE CORRUPT IMAGE IS PART OF THE FIXTURE, not a separate test. An
      // all-healthy ring makes this invariant vacuous: it would pass against
      // the very implementation that advertised an unopenable revision, because
      // there would be none to advertise.
      truncateSync(snapshotPathFor(s, 1), 0);
      return s;
    };

    let advertised: number[] = [];
    const pristine = buildAt("pristine");
    try {
      advertised = retainedRevisions(pristine);
      assert.ok(advertised.length >= 2, `non-vacuity: the advertised list must have at least two members, got ${advertised.join(", ")}`);
    } finally {
      closeStore(pristine);
    }

    // THE PER-ITERATION REBUILD IS LOAD-BEARING, NOT HYGIENE. A second
    // `revertTo` on an ALREADY-REVERTED store is legitimately REFUSED -- the
    // restored image carries no pointer row for its own revision -- and that
    // refusal is itself a pinned guarantee of this phase (see the two
    // double-revert tests above). A loop that reverted ONE store repeatedly
    // would therefore assert the opposite of what this phase guarantees, and
    // would fail for a CORRECT reason from its second iteration onwards.
    //
    // NO REVISION LITERAL APPEARS BELOW, and that is the point: looping over
    // the advertised list rather than over hard-coded numbers is what makes the
    // INVARIANT the assertion. If the advertisement ever widens again, this
    // loop widens with it and fails on the new member.
    let iteration = 0;
    for (const revision of advertised) {
      iteration += 1;
      let fresh = buildAt(`iteration-${iteration}`);
      try {
        fresh = revertTo(fresh, revision);
        assert.equal(
          currentRevision(fresh),
          revision,
          `revision ${revision} is advertised as retained, so reverting to it must SUCCEED and land the store on it -- a published floor ` +
            "the store refuses on the very next call is worse than no floor at all",
        );
      } finally {
        closeStore(fresh);
      }
    }
  });
});

test("CR-08: the ring's file sweep does NOT unlink a corrupt image a pointer row still claims -- evidence survives, and unlinking it would be a second destruction dressed as a repair", () => {
  inTempDir((dir) => {
    const store = revisionThreeStore(dir);
    try {
      const snapPath = snapshotPathFor(store, 1);
      truncateSync(snapPath, 0);

      // A GENUINELY UNCLAIMED FILE, PLANTED ALONGSIDE IT as the positive
      // control: without it this test would pass against a sweep that never
      // runs at all, which is the arrangement that makes the claim below
      // meaningless.
      const unclaimed = snapshotPathFor(store, 99);
      writeFileSync(unclaimed, "");

      // ONE ORDINARY WRITE -- which is what runs the prune and the sweep.
      setDataType(store, { start: 0x3000, endInclusive: 0x300f, dataType: "code" });

      assert.ok(!existsSync(unclaimed), "the positive control: the sweep really did run, and unlinked the file no pointer row claims");
      assert.ok(
        existsSync(snapPath),
        "and it left the corrupt image alone: a file a pointer row still claims is EVIDENCE, and unlinking it would delete the evidence " +
          "of the very failure that has to be diagnosed",
      );
      assert.equal(statSync(snapPath).size, 0, "still at zero bytes -- not repaired, not rewritten, not touched");
      const claimed = store.db.prepare("select revision from anno_snapshot where revision = ?").all(1) as { revision: number }[];
      assert.equal(claimed.length, 1, "and its pointer row still exists: the sweep abstains from the row direction entirely (CR-05)");

      // AND THE DIVERGENCE IS REAL RATHER THAN NOTIONAL: the sweep's keep-set
      // and the store's advertisement now genuinely disagree about revision 1,
      // which is exactly why they are two differently named questions.
      assert.ok(
        !retainedRevisions(store).includes(1),
        "the advertisement excludes revision 1 while the sweep keeps its file -- the two answers diverge, in the safe direction",
      );
    } finally {
      closeStore(store);
    }
  });
});

// ---------------------------------------------------------------------------
// 28-17 task 2 -- WR-16: the three rollback handlers report the rollback that
// HAPPENED rather than the one that was intended. ONE test, both branches,
// because a single-branch assertion is exactly what let the asserted-but-
// unverified wording survive: the rolled-back message passes against code that
// never checked, so only the CONTRAST between the two messages discriminates.
// ---------------------------------------------------------------------------

test("WR-16: the commit-failure refusal reports the rollback it OBSERVED -- rolled back, or ALSO failed -- carries that fact in data, and the sweep reports the same fact without throwing", () => {
  inTempDir((dir) => {
    /** Replaces `db.exec` with one that throws for the named statements and
     * passes everything else through. Driven through PRODUCTION entry points:
     * `anno-store.ts` is not edited, and the failure enters where a real
     * `SQLITE_BUSY` on this connection would. */
    const plant = (store: { db: { exec: (sql: string) => void } }, matcher: RegExp): (() => void) => {
      const real = store.db.exec.bind(store.db);
      store.db.exec = (sql: string): void => {
        if (matcher.test(sql)) throw new Error(`planted failure for ${JSON.stringify(sql)}`);
        real(sql);
      };
      return () => {
        store.db.exec = real;
      };
    };

    // BRANCH A -- the ORDINARY path: the commit fails and the rollback works.
    // The wording here is the one that was already pinned before this task, and
    // it must survive verbatim: the change is additive, so a refusal a caller
    // already matches on does not move.
    {
      const store = openStore(join(dir, "a.annostore"), { workspaceRoot: dir });
      let restore = (): void => {};
      try {
        setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
        const rev = currentRevision(store);
        restore = plant(store, /^\s*commit/i);
        assert.throws(
          () => setDataType(store, { start: 0x2000, endInclusive: 0x200f, dataType: "code" }),
          (e: unknown) => {
            assert.ok(e instanceof AnnoStoreError, "the refusal is an AnnoStoreError");
            assert.ok(e instanceof ViceError, "and inside the ViceError family");
            assert.match(e.message, /transaction has been rolled back/, "the ordinary branch states the rollback as the fact it observed");
            assert.doesNotMatch(e.message, /rollback ALSO failed/, "and does not reach for the also-failed wording");
            assert.match(e.message, new RegExp(`still at revision ${rev}\\b`), "and it still names the revision the store is at (28-08 P2)");
            assert.equal(
              (e.data as { rolledBack?: boolean }).rolledBack,
              true,
              "and it carries the fact in data, so a caller branches on the fact rather than substring-matching the prose",
            );
            return true;
          },
        );
        restore();
        restore = () => {};
        assert.equal(currentRevision(store), rev, "the rollback returned, so this connection is back at the pre-write revision");
        store.db.exec("begin immediate");
        store.db.exec("rollback");
      } finally {
        restore();
        closeStore(store);
      }
    }

    // BRANCH B -- the branch the old wording asserted its way past: the commit
    // fails AND so does the rollback. Node 22's `DatabaseSync` exposes no
    // transaction-state accessor, so the recorded boolean is the only thing that
    // can keep the message honest.
    {
      const store = openStore(join(dir, "b.annostore"), { workspaceRoot: dir });
      let restore = (): void => {};
      try {
        setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
        const rev = currentRevision(store);
        restore = plant(store, /^\s*(commit|rollback)/i);
        assert.throws(
          () => setDataType(store, { start: 0x3000, endInclusive: 0x300f, dataType: "code" }),
          (e: unknown) => {
            assert.ok(e instanceof AnnoStoreError, "the refusal is still an AnnoStoreError");
            assert.ok(e instanceof ViceError, "and still inside the ViceError family");
            assert.match(e.message, /rollback ALSO failed/, "the also-failed branch says so");
            assert.doesNotMatch(
              e.message,
              /transaction has been rolled back/,
              "and it does NOT report the state it is refusing FROM as its own repair -- that is the whole of WR-16",
            );
            assert.match(e.message, /write lock/, "it names what the caller may still be holding");
            assert.match(e.message, new RegExp(`revision ${rev}\\b`), "and it still names the revision the store is at (28-08 P2)");
            assert.equal((e.data as { rolledBack?: boolean }).rolledBack, false, "and data.rolledBack is the observed false, not the intended true");
            return true;
          },
        );
      } finally {
        restore();
        try {
          store.db.exec("rollback");
        } catch {
          // The planted failure may have left this transaction open -- which is
          // exactly what the message now admits. Swallowed so the temp
          // directory can still be removed.
        }
        closeStore(store);
      }
    }

    // AND THE THIRD SITE, which must NOT throw (28-11 P5): the sweep reports the
    // same fact in its RESULT. An always-present boolean rather than an optional
    // one, so a reader does not have to falsify "can this ever be true" by
    // experiment.
    {
      const store = openStore(join(dir, "c.annostore"), { workspaceRoot: dir });
      try {
        setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
        const swept = reconcileSnapshotRing(store);
        assert.equal(swept.rollbackFailed, false, "an ordinary sweep reports rollbackFailed: false rather than omitting the field");
        assert.equal(swept.deferred, false, "and deferred keeps its pre-existing value on the ordinary path");
        assert.deepEqual(swept.droppedFiles, [], "and it dropped nothing on a healthy ring");
      } finally {
        closeStore(store);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// WR-18: `rollbackFailed` gets a PRODUCTION reader at both of its call sites,
// without converting a committed write into a caller-visible failure.
//
// 28-17 added `rollbackFailed` to `reconcileSnapshotRing`'s result to report the
// ONE state its own handler cannot fix: the sweep's `rollback` threw, so the
// connection may still hold an open transaction and the store's write lock.
// Nothing read it. `pruneSnapshots` discarded it and `revertTo`'s step-6 call
// discarded it too, so `revertTo` could hand back a connection still inside the
// sweep's transaction -- CR-07's exact reported symptom, re-created on the revert
// path. A field whose only reader asserts it is always `false` is what this
// module's own doc mocks: "a field that can only ever answer one value is a claim
// the next reader has to falsify by experiment".
// ---------------------------------------------------------------------------

test("WR-18, BEHAVIOURAL: a handle whose transaction state is UNKNOWN refuses the next write BY NAME with the close-and-reopen remedy, and reopening recovers", () => {
  // WHAT THIS CONTROL CONSTRUCTS, STATED PLAINLY: it sets the handle's field
  // DIRECTLY. That is the test building the STATE, not simulating the sweep --
  // reaching `rollbackFailed: true` naturally requires `db.exec("rollback")`
  // itself to throw on a connection whose `begin immediate` succeeded, which has
  // no reachable input without filesystem- or SQLite-level fault injection. That
  // end-to-end arm is filed as a `backstop` truth in this plan's summary with
  // exactly that reason, and NO test in this file claims to exercise it.
  //
  // What IS proved here is everything downstream of the state: the refusal's
  // class, its message, its position (before any transaction is begun), and that
  // the remedy the message names actually works.
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    let store = openStore(path, { workspaceRoot: dir });
    try {
      setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
      const revisionBefore = currentRevision(store);
      assert.equal(store.transactionStateUnknown, false, "a freshly opened handle must start clean, or the flip below proves nothing");

      store.transactionStateUnknown = true;

      let refusal: Error | undefined;
      assert.throws(
        () => setDataType(store, { start: 0x2000, endInclusive: 0x200f, dataType: "code" }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreError, `expected AnnoStoreError, got ${String(e)}`);
          assert.ok(e.message.includes(path), `the refusal must name the store path, got: ${e.message}`);
          assert.match(e.message, /CLOSE IT AND REOPEN/, "and give the close-and-reopen remedy in the same words the commit handler uses");
          assert.match(e.message, /housekeeping sweep/, "and say what put the connection in this state");
          refusal = e;
          return true;
        },
      );
      assert.ok(refusal !== undefined, "the refusal must have been captured");

      // THE REFUSAL IS BEFORE `begin immediate`, which is the whole point: it
      // replaces SQLite's bare "cannot start a transaction within a transaction"
      // rather than following it. Nothing was written.
      assert.equal(currentRevision(store), revisionBefore, "the refused write must not have moved the revision");

      // AND THE RECOVERY THE MESSAGE NAMES ACTUALLY WORKS. A remedy nothing
      // exercises is a claim, not a remedy.
      closeStore(store);
      store = openStore(path, { workspaceRoot: dir });
      assert.equal(store.transactionStateUnknown, false, "a freshly opened handle on the same path starts clean");
      const recovered = setDataType(store, { start: 0x2000, endInclusive: 0x200f, dataType: "code" });
      assert.equal(recovered.revision, revisionBefore + 1, `and writes normally, returning revision ${revisionBefore + 1}`);
    } finally {
      closeStore(store);
    }
  });
});

test("WR-18, THE 28-11 P5 DIRECTION: an ordinary accepted write still returns its revision and changed, and leaves the handle's transaction state KNOWN", () => {
  // THE PROHIBITION THIS PLAN IS MOST AT RISK OF BREAKING, asserted rather than
  // reasoned about: a fix that consumes a housekeeping fact must NOT convert a
  // committed write into a caller-visible failure. The accepted write returns
  // success with its revision; only the NEXT call on a marked handle refuses.
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const first = setDataType(store, { start: 0x1000, endInclusive: 0x100f, dataType: "byte" });
      assert.equal(first.revision, 1, "an accepted write returns its revision");
      assert.equal(first.changed, true, "and reports that it changed something");
      assert.equal(store.transactionStateUnknown, false, "and leaves the handle's transaction state KNOWN -- a healthy sweep marks nothing");

      // And again, past the point where a prune has real work to do, so the
      // sweep genuinely ran rather than returning early on an empty ring.
      for (let i = 1; i <= MAX_SNAPSHOT_REVISIONS + 2; i += 1) {
        const r = setDataType(store, { start: 0x2000 + i * 0x10, endInclusive: 0x2000 + i * 0x10 + 0x0f, dataType: "byte" });
        assert.equal(r.revision, i + 1, `write ${i + 1} returns its revision`);
      }
      assert.equal(store.transactionStateUnknown, false, "and a run long enough to prune still leaves the handle clean");
    } finally {
      closeStore(store);
    }
  });
});

test("WR-18, STRUCTURAL: pruneSnapshots' return value is BOUND at runWriteSequence's step-9 call site rather than discarded", () => {
  // WHY THIS IS STRUCTURAL, stated because this file's conventions forbid a
  // structural assertion that does not say why it is one. The behaviour it pins
  // -- that step 9 records a reported rollback failure on the handle -- can only
  // fire when `reconcileSnapshotRing`'s own `rollback` throws, which has no
  // reachable input without fault injection. The behavioural controls above
  // prove what happens once the state EXISTS; this one is the only thing in the
  // suite that fails when the wiring producing it is removed.
  //
  // LITERAL BODIES KEPT (`codeOnly(src, true)`): the surrounding function is
  // identified by source text and strict mode would blank the SQL literals that
  // make the body substantial.
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);

  const fnStart = stripped.indexOf("function runWriteSequence");
  assert.ok(fnStart >= 0, "runWriteSequence must be findable in the stripped source");
  const fnEnd = stripped.indexOf("\n}", fnStart);
  assert.ok(fnEnd > fnStart, "and its body must terminate at a column-zero closing brace");
  const body = stripped.slice(fnStart, fnEnd);
  assert.ok(body.length > 800, `the extracted runWriteSequence body must be substantial, got ${body.length} characters`);

  const call = body.indexOf("pruneSnapshots(handle)");
  assert.ok(call >= 0, "the step-9 prune call must be present in the extracted body");

  // THE BINDING ITSELF. A bare `pruneSnapshots(handle);` statement -- the shape
  // this task started from -- has nothing between the start of its line and the
  // call, which is precisely what this assertion rejects.
  const lineStart = body.lastIndexOf("\n", call) + 1;
  const callLine = body.slice(lineStart, body.indexOf("\n", call));
  assert.match(
    callLine,
    /(if|const|let|return)\b[^\n]*pruneSnapshots\(handle\)/,
    `step 9 must BIND or TEST pruneSnapshots' return rather than discarding it, got: ${callLine.trim()}`,
  );

  // AND THE FACT MUST LAND SOMEWHERE A LATER CALL CAN SEE IT. A binding that
  // goes nowhere is the same discard with an extra local.
  assert.match(
    body.slice(call, call + 200),
    /handle\.transactionStateUnknown = true/,
    "and must record the reported rollback failure on the handle, which is what carries it to the next call",
  );

  // THE 28-11 P5 HALF, STRUCTURALLY: the consumption must not be a throw. A
  // rethrow here would report a committed write as a failure.
  assert.equal(
    body.slice(call, call + 200).indexOf("throw"),
    -1,
    "and must NOT throw from step 9 -- the write is already committed (28-11 P5)",
  );
});

test("WR-18, STRUCTURAL: revertTo's step-6 sweep call BINDS its result and acts on it, so a reported rollback failure is not handed back as a clean handle", () => {
  // WHY THIS IS STRUCTURAL: same reason as the step-9 control above. The
  // `rollbackFailed: true` arm has no reachable input without fault injection,
  // so no behavioural control in this file can distinguish a bound result from a
  // discarded one. This assertion is the only thing that does.
  //
  // LITERAL BODIES KEPT (`codeOnly(src, true)`).
  const stripped = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"), true);

  const fnStart = stripped.indexOf("export function revertTo");
  assert.ok(fnStart >= 0, "revertTo must be findable in the stripped source");
  const fnEnd = stripped.indexOf("\n}", fnStart);
  assert.ok(fnEnd > fnStart, "and revertTo's body must terminate at a column-zero closing brace");
  const body = stripped.slice(fnStart, fnEnd);
  assert.ok(body.length > 800, `the extracted revertTo body must be substantial, got ${body.length} characters`);

  const call = body.indexOf("reconcileSnapshotRing(restored)");
  assert.ok(call >= 0, "the step-6 sweep call must be present in the extracted revertTo body");

  // THE BINDING. `reconcileSnapshotRing(restored);` on a line of its own -- the
  // shape this task started from -- fails here.
  const lineStart = body.lastIndexOf("\n", call) + 1;
  const callLine = body.slice(lineStart, body.indexOf("\n", call));
  assert.match(
    callLine,
    /(=|return)[^\n]*reconcileSnapshotRing\(restored\)/,
    `step 6 must BIND the sweep's result rather than discarding it, got: ${callLine.trim()}`,
  );

  // AND IT MUST READ THE FIELD THIS PLAN WIRED, not merely bind something.
  assert.match(
    callLine,
    /rollbackFailed/,
    `and must read rollbackFailed off it -- the one state the sweep reports without throwing, got: ${callLine.trim()}`,
  );

  // AND THE RESULT MUST BE REFERENCED AGAIN INSIDE THE FUNCTION: a bound value
  // nothing branches on is a discard with an extra local.
  const after = body.slice(call);
  assert.match(after, /if \(reopenNeeded\)/, "and must branch on it, so a connection whose transaction state is unknown is not returned");
  assert.match(after.slice(0, 400), /closeStore\(restored\)/, "closing the suspect connection");
  assert.match(after.slice(0, 400), /return openStore\(storePath\)/, "and handing back a freshly opened one");
});

// ---------------------------------------------------------------------------
// WR-21 -- `addScope`'s two missing rules: idempotence and the no-nesting claim
// its own doc comment (and `ScopeRow`'s) already made.
//
// MEASURED ON THE PRE-TASK TREE, through production entry points only:
// `addScope($1000..$2000)` -> `{revision: 5, changed: true}`; the SAME call
// again -> `{revision: 6, changed: true}`; `addScope($1400..$1500)` ->
// `{revision: 7, changed: true}`; and `listScopes()` held THREE rows -- two
// byte-identical and one nested. All three reported as changes.
// ---------------------------------------------------------------------------

test("WR-21: a byte-identical addScope repeat is an accepted NO-OP reporting changed:false, and the scope table still holds exactly one row", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      const first = addScope(handle, { start: 0x1000, endInclusive: 0x2000 });
      assert.equal(first.changed, true, "the first add is a real edit");
      assert.equal(listScopes(handle).length, 1, "and it stored exactly one row");

      const repeat = addScope(handle, { start: 0x1000, endInclusive: 0x2000 });

      // THE REPEAT SUCCEEDS -- it is not rejected. Phase 29's success criterion
      // 5 requires a repeated edit to succeed reporting no change, and
      // `AnnoWriteResult`'s own doc comment says `changed` is the ONLY signal
      // distinguishing a no-op from a real edit. Both are asserted here.
      assert.equal(repeat.changed, false, "a byte-identical repeat is an accepted NO-OP, not a second row and not a refusal");
      assert.equal(repeat.revision, first.revision + 1, "and the revision still advances by exactly one, like every other write entry point");
      assert.deepEqual(
        listScopes(handle),
        [{ id: 1, start: 0x1000, endInclusive: 0x2000 }],
        "the table still holds exactly ONE row -- on the pre-task tree this drive left two byte-identical rows",
      );
    } finally {
      closeStore(handle);
    }
  });
});

test("WR-21: a NESTED scope is refused BY NAME with both scopes' ends and the existing scope's id, and the table is unchanged", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addScope(handle, { start: 0x1000, endInclusive: 0x2000 });

      let caught: unknown;
      try {
        addScope(handle, { start: 0x1400, endInclusive: 0x1500 });
      } catch (e) {
        caught = e;
      }
      assert.ok(
        caught instanceof AnnoRangeShapeError,
        `a scope wholly inside an existing one is REFUSED -- \`ScopeRow\`'s doc comment says nested scopes are unsupported; got ${caught}`,
      );
      const thrown = caught as AnnoRangeShapeError;

      // BOTH NUMBERS THAT CONFLICTED (28-08 P2): the incoming scope's two ends,
      // the existing scope's two ends, AND the existing scope's id.
      assert.match(thrown.message, /5120/, "the incoming scope's start is in the message");
      assert.match(thrown.message, /5376/, "and its end");
      assert.match(thrown.message, /4096/, "the existing scope's start is in the message");
      assert.match(thrown.message, /8192/, "and its end");
      assert.match(thrown.message, /id=1/, "and the existing scope's id, so the caller can find the row that conflicted");
      assert.match(thrown.message, /REFUSED/, "and the message says the write was refused rather than trimmed or split");

      assert.equal(listScopes(handle).length, 1, "the refusal is raised BEFORE any write -- the table still holds exactly one row");
    } finally {
      closeStore(handle);
    }
  });
});

test("WR-21: a PARTIALLY overlapping scope is refused by the same rule and the same class", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addScope(handle, { start: 0x1000, endInclusive: 0x2000 });

      let caught: unknown;
      try {
        addScope(handle, { start: 0x1fff, endInclusive: 0x3000 });
      } catch (e) {
        caught = e;
      }
      assert.ok(caught instanceof AnnoRangeShapeError, `a scope overlapping an existing one by a single byte is refused by the same rule; got ${caught}`);
      const thrown = caught as AnnoRangeShapeError;
      assert.match(thrown.message, /id=1/, "and the same message shape names the existing row");

      assert.equal(listScopes(handle).length, 1, "and nothing was stored");
    } finally {
      closeStore(handle);
    }
  });
});

test("WR-21 discrimination: two DISJOINT scopes are both accepted -- the refusal was not bought by refusing everything", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      assert.equal(addScope(handle, { start: 0x1000, endInclusive: 0x2000 }).changed, true);
      assert.equal(addScope(handle, { start: 0x3000, endInclusive: 0x4000 }).changed, true);
      assert.equal(listScopes(handle).length, 2, "two disjoint scopes are two scopes");
    } finally {
      closeStore(handle);
    }
  });
});

test("WR-21 discrimination: two ADJACENT scopes are both accepted -- touching at a boundary is not overlapping, pinned with the exact addresses", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      // THE BOUNDARY IS PINNED RATHER THAN ASSUMED. The second scope starts at
      // EXACTLY one past the first's inclusive end. An off-by-one in the
      // overlap predicate would silently refuse legitimate work here, and a
      // control that used a gap of two would never see it.
      assert.equal(addScope(handle, { start: 0x1000, endInclusive: 0x2000 }).changed, true);
      assert.equal(addScope(handle, { start: 0x2001, endInclusive: 0x3000 }).changed, true);
      assert.deepEqual(
        listScopes(handle),
        [
          { id: 1, start: 0x1000, endInclusive: 0x2000 },
          { id: 2, start: 0x2001, endInclusive: 0x3000 },
        ],
        "0x2000 and 0x2001 touch and do not overlap -- both scopes are stored",
      );
    } finally {
      closeStore(handle);
    }
  });
});
