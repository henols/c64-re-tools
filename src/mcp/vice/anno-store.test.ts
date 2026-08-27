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
import { mkdtempSync, rmSync, statSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPaintIndex, NO_ROW, resolveAt } from "./anno-index.ts";
import { AnnoRangeShapeError, AnnoStoreCorruptError, AnnoStorePathError, AnnoStoreStaleRevisionError, SCHEMA_VERSION } from "./anno-types.ts";
import { closeStore, currentRevision, listRanges, openStore, revertTo, setDataType } from "./anno-store.ts";

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

test("a file that is not a database at all is refused", () => {
  inTempDir((dir) => {
    const foreign = join(dir, "foreign.annostore");
    writeFileSync(foreign, "this is not a database, it is a text file\n");
    assert.throws(() => openStore(foreign, { workspaceRoot: dir }), AnnoStoreCorruptError);
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
      AnnoStoreCorruptError,
      "a store truncated mid-file must be refused, not read as a shorter store",
    );
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
