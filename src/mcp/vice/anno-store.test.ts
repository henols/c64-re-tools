// anno-store.test.ts -- the end-to-end proof that the whole store vertical
// works on ONE range: validate, type, persist, close, reopen a FRESH handle,
// read the row back BY VALUE, and resolve it through the paint index.
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
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPaintIndex, NO_ROW, resolveAt } from "./anno-index.mts";
import {
  AnnoAddressError,
  AnnoCommentError,
  AnnoCommentGradeError,
  AnnoLabelError,
  AnnoRangeShapeError,
  AnnoStoreCorruptError,
  AnnoStoreError,
  AnnoStorePathError,
  AnnoStoreStaleRevisionError,
  AnnoTypeError,
  DATA_TYPES,
  SCHEMA_VERSION,
} from "./anno-types.mts";
import {
  addExcludedRange,
  addScope,
  applyEnumUsage,
  applyWrite,
  clearEnumUsage,
  closeStore,
  contradictedCommentsFor,
  createProjectEnum,
  currentRevision,
  deleteExecObservationsForRun,
  insertExecObservations,
  listComments,
  listEnumUsage,
  listExcludedRanges,
  listExecObservations,
  listLabels,
  listObservedRuns,
  listProjectEnums,
  listRanges,
  listScopes,
  listXrefs,
  openStore,
  paintIndexOf,
  putXref,
  removeExcludedRange,
  setComment,
  setDataType,
  setLabel,
  updateProjectEnum,
} from "./anno-store.mts";
import { CONFIDENCE_GRADES, parseConfidencePrefix } from "./anno-confidence.mts";
import { ViceError } from "./vice-errors.mts";

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

test("the store vertical: type $0810-$084F as lo_hi_address, close, reopen a FRESH handle, and read the row back BY VALUE", () => {
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
    closeStore(reopened);
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
      // derivable from the bytes -- `resolveSplitTargets()` in anno-types.mts
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

test("the reserved bank field is never INTERPRETED: every list function returns bank null for every row it lists", () => {
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
    assert.ok(thrown instanceof ViceError, "everything the store throws must be a ViceError, which AnnoConfidenceGradeError is not");
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
test("idempotency of open: opening and closing a store twice with no write between leaves the revision and the rows unchanged", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    const first = openStore(path, { workspaceRoot: dir });
    setDataType(first, { start: 0x0810, endInclusive: 0x084f, dataType: "lo_hi_address" });
    const revisionAfterWrite = currentRevision(first);
    const rowsAfterWrite = listRanges(first);
    closeStore(first);

    // Opening is a READ, and it must stay one: an open that
    // advanced the revision or ran a migration would make merely LOOKING at a
    // store change it -- and every one of those is a shape somebody could add
    // without noticing, because nothing else in the suite reopens twice.
    for (const pass of [1, 2]) {
      const handle = openStore(path, { workspaceRoot: dir });
      try {
        assert.equal(currentRevision(handle), revisionAfterWrite, `open pass ${pass} must not advance the revision`);
        assert.deepEqual(listRanges(handle), rowsAfterWrite, `open pass ${pass} must not change the rows`);
      } finally {
        closeStore(handle);
      }
    }
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
// The spawned child is `store-durability-mutator.ts` in its commit-and-exit
// mode: it writes a DIFFERENT range from the parent's, so the readback can say
// WHOSE row survived rather than having to infer it from a row either process
// could have written. That mode exits cleanly, so its status is CHECKED rather
// than ignored -- unlike the self-SIGKILLing modes, a non-zero status here
// would mean the other process never committed and the refusal being measured
// could be something else entirely.
// ---------------------------------------------------------------------------

const MUTATOR = join(HERE, "store-durability-mutator.ts");

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
      // transaction.
      const dataVersion = store.db.prepare("pragma data_version").get() as { data_version: number };
      assert.equal(typeof dataVersion.data_version, "number", "data_version is readable, and is deliberately NOT what the refusal is built on");

      // WHICH GUARD THIS TEST ACTUALLY EXERCISES, MEASURED RATHER THAN
      // ASSUMED -- because the two guards fail independently and only one of
      // them is reachable from a synchronous test.
      //
      //   * Making the step-5 compare-and-swap TAUTOLOGICAL (its `revision = ?`
      //     guard replaced by an always-true predicate, the bound parameter
      //     kept so the statement still runs) leaves THIS TEST GREEN. Phase 56
      //     removed `anno-seam.test.ts`'s structural CAS assertion, which used
      //     to be the only thing this mutation reddened (measured before
      //     removal: 52 tests, 1 fail). The reason THIS test stays green is not
      //     a weakness in it: the CAS guards the window between step 1's
      //     revision read and step 5's update -- a writer committing INSIDE
      //     that window -- and a single-threaded test cannot open it.
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
// 28-17 task 2 -- WR-16: the three rollback handlers report the rollback that
// HAPPENED rather than the one that was intended. ONE test, both branches,
// because a single-branch assertion is exactly what let the asserted-but-
// unverified wording survive: the rolled-back message passes against code that
// never checked, so only the CONTRAST between the two messages discriminates.
// ---------------------------------------------------------------------------

test("WR-16: the commit-failure refusal reports the rollback it OBSERVED -- rolled back, or ALSO failed -- and carries that fact in data", () => {
  inTempDir((dir) => {
    /** Replaces `db.exec` with one that throws for the named statements and
     * passes everything else through. Driven through PRODUCTION entry points:
     * `anno-store.mts` is not edited, and the failure enters where a real
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
  });
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

// ---------------------------------------------------------------------------
// BUILD-07 -- the exclusion verbs' full store-level coverage: every accept
// and refusal path from Task 2's <behavior> list, each refusal asserting its
// message content AND its unchanged post-state, the two adjacency
// directions, the empty case as a `deepEqual([])`, and a stale-`baseRevision`
// refusal per write verb. This supersedes the RED-phase draft that proved
// the verbs did not exist before Task 2 implemented them.
// ---------------------------------------------------------------------------

test("addExcludedRange with a fresh disjoint span inserts one row and reports changed:true", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      const result = addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "cracktro, not original game code" });
      assert.equal(result.changed, true);
      assert.deepEqual(listExcludedRanges(handle), [{ id: 1, start: 0x4000, endInclusive: 0x4fff, reason: "cracktro, not original game code" }]);
    } finally {
      closeStore(handle);
    }
  });
});

test("an identical repeat -- same extent, same reason -- reports changed:false and does not insert a second row", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" });
      const repeat = addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" });
      assert.equal(repeat.changed, false);
      assert.equal(listExcludedRanges(handle).length, 1, "no second row was inserted");
    } finally {
      closeStore(handle);
    }
  });
});

test("the same extent with a DIFFERENT reason is REFUSED by name, and the stored reason is unchanged afterwards", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" });
      assert.throws(
        () => addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "trainer" }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoRangeShapeError, `expected AnnoRangeShapeError, got ${String(e)}`);
          // THE DISTINGUISHING SUBSTRING, present here and ABSENT from the
          // overlap refusal's own message below -- the pair most likely to
          // be confused, per Task 3's own instruction.
          assert.match((e as Error).message, /DIFFERENT reason/, "names the conflict as a differing reason, not an overlap");
          assert.doesNotMatch(
            (e as Error).message,
            /overlaps the existing exclusion/,
            "a differing-reason refusal must not read like an overlap refusal",
          );
          return true;
        },
      );
      assert.deepEqual(
        listExcludedRanges(handle),
        [{ id: 1, start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" }],
        "the POST-STATE: the stored reason is left exactly as it was",
      );
    } finally {
      closeStore(handle);
    }
  });
});

test("a span overlapping an existing record by one byte is refused, naming both spans and the existing row's id; nothing is inserted or trimmed", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" });
      assert.throws(
        () => addExcludedRange(handle, { start: 0x4fff, endInclusive: 0x5fff, reason: "trainer" }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoRangeShapeError, `expected AnnoRangeShapeError, got ${String(e)}`);
          // BOTH SPANS, and the existing row's id -- named in the message.
          assert.match((e as Error).message, /16383\.\.20479|4fff.*5fff|0x4fff/i, "the incoming span is named");
          assert.match((e as Error).message, /id=1/, "the existing row's id is named");
          // THE DISTINGUISHING SUBSTRING, present here and ABSENT from the
          // differing-reason refusal's own message above.
          assert.match((e as Error).message, /overlaps the existing exclusion/, "names the conflict as an overlap, not a differing reason");
          assert.doesNotMatch((e as Error).message, /DIFFERENT reason/, "an overlap refusal must not read like a differing-reason refusal");
          return true;
        },
      );
      assert.deepEqual(
        listExcludedRanges(handle),
        [{ id: 1, start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" }],
        "the POST-STATE: nothing was inserted and the existing row is untouched",
      );
    } finally {
      closeStore(handle);
    }
  });
});

test("adjacency: two exclusion records that touch at a boundary stay TWO records", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addExcludedRange(handle, { start: 0x1000, endInclusive: 0x10ff, reason: "first exclusion" });
      addExcludedRange(handle, { start: 0x1100, endInclusive: 0x11ff, reason: "second exclusion" });
      const rows = listExcludedRanges(handle);
      const [first, second] = rows;
      // NON-VACUITY FIRST: the two spans really are adjacent. Otherwise this
      // test is about two ordinary disjoint records and measures nothing
      // about adjacency.
      assert.equal(first.endInclusive + 1, second.start, "the fixture must actually be adjacent, or this test proves nothing about adjacency");
      assert.equal(rows.length, 2, "a touching pair stays TWO records -- never merged into one");
      assert.equal(first.reason, "first exclusion");
      assert.equal(second.reason, "second exclusion");
      assert.notEqual(first.reason, second.reason, "both reasons are intact and distinct");
    } finally {
      closeStore(handle);
    }
  });
});

test("adjacency: a span starting exactly one above an existing record's end is likewise accepted, giving two records", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addExcludedRange(handle, { start: 0x2000, endInclusive: 0x20ff, reason: "later exclusion" });
      addExcludedRange(handle, { start: 0x1f00, endInclusive: 0x1fff, reason: "earlier exclusion" });
      assert.equal(listExcludedRanges(handle).length, 2, "touching from the other direction also stays two records");
    } finally {
      closeStore(handle);
    }
  });
});

test("adjacency: a one-byte overlap is refused, naming both spans", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addExcludedRange(handle, { start: 0x1000, endInclusive: 0x10ff, reason: "first exclusion" });
      assert.throws(
        () => addExcludedRange(handle, { start: 0x10ff, endInclusive: 0x11ff, reason: "second exclusion" }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoRangeShapeError, `expected AnnoRangeShapeError, got ${String(e)}`);
          assert.match((e as Error).message, /id=1/, "the existing row's id is named");
          assert.match((e as Error).message, /4096\.\.4351|1000\.\.10ff/i, "the existing span is named");
          return true;
        },
      );
      assert.equal(listExcludedRanges(handle).length, 1, "still exactly one record -- the overlapping write was refused");
    } finally {
      closeStore(handle);
    }
  });
});

test("a one-byte span (start === endInclusive) is accepted", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      const result = addExcludedRange(handle, { start: 0x8000, endInclusive: 0x8000, reason: "one poked byte" });
      assert.equal(result.changed, true);
      assert.deepEqual(listExcludedRanges(handle), [{ id: 1, start: 0x8000, endInclusive: 0x8000, reason: "one poked byte" }]);
    } finally {
      closeStore(handle);
    }
  });
});

test("a reason the comment-text vocabulary rejects (an embedded line break) is refused at write time and nothing is inserted", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      // THE CANONICAL REJECTED CASE, not an arbitrary one: this is the same
      // mechanism `assertExportableCommentText()`'s own doc-comment names --
      // everything after the break would land in the ACME source at column
      // zero as assembler INPUT, not as a comment. Validating at write time
      // is what stops that shape from being persisted now and discovered at
      // export later.
      assert.throws(() => addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "line one\nline two" }), AnnoCommentError);
      assert.deepEqual(listExcludedRanges(handle), [], "the POST-STATE: nothing was inserted");
    } finally {
      closeStore(handle);
    }
  });
});

test("an empty or whitespace-only reason is refused: a not-null column satisfied by an empty string is a hole with a row in front of it", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      assert.throws(() => addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "   " }), AnnoCommentError);
      assert.deepEqual(listExcludedRanges(handle), [], "the POST-STATE: nothing was inserted");
    } finally {
      closeStore(handle);
    }
  });
});

test("empty: a store with no exclusions lists as an empty array", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      // deepEqual against a LITERAL [], not a truthiness or length check --
      // undefined and [] must not be able to pass the same assertion.
      assert.deepEqual(listExcludedRanges(handle), []);
    } finally {
      closeStore(handle);
    }
  });
});

test("removeExcludedRange with an exact extent match deletes the row and reports changed:true", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" });
      const removed = removeExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff });
      assert.equal(removed.changed, true);
      assert.deepEqual(listExcludedRanges(handle), []);
    } finally {
      closeStore(handle);
    }
  });
});

test("removeExcludedRange with a partial or overlapping extent is refused by name; the row survives", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" });
      assert.throws(
        () => removeExcludedRange(handle, { start: 0x4000, endInclusive: 0x4ffe }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoRangeShapeError, `expected AnnoRangeShapeError, got ${String(e)}`);
          assert.match((e as Error).message, /id=1/, "names the existing row's id");
          assert.match((e as Error).message, /never trimmed, split, or partially removed/, "states the never-trimmed clause");
          return true;
        },
      );
      assert.deepEqual(
        listExcludedRanges(handle),
        [{ id: 1, start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" }],
        "the POST-STATE: the row survives, unchanged",
      );
    } finally {
      closeStore(handle);
    }
  });
});

test("removeExcludedRange for an extent that is not there reports changed:false", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      const removed = removeExcludedRange(handle, { start: 0x9000, endInclusive: 0x9fff });
      assert.equal(removed.changed, false);
      assert.deepEqual(listExcludedRanges(handle), []);
    } finally {
      closeStore(handle);
    }
  });
});

test("a stale baseRevision on addExcludedRange is refused by the same mechanism every other mutating verb uses", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addScope(handle, { start: 0x1000, endInclusive: 0x1000 });
      const staleBase = currentRevision(handle) - 1;
      assert.throws(
        () => addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "cracktro", baseRevision: staleBase }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreStaleRevisionError, `expected AnnoStoreStaleRevisionError, got ${String(e)}`);
          assert.equal((e as AnnoStoreStaleRevisionError).baseRevision, staleBase);
          assert.equal((e as AnnoStoreStaleRevisionError).currentRevision, currentRevision(handle));
          return true;
        },
      );
      assert.deepEqual(listExcludedRanges(handle), [], "the refused write inserted nothing");
    } finally {
      closeStore(handle);
    }
  });
});

test("a stale baseRevision on removeExcludedRange is refused by the same mechanism every other mutating verb uses", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      addExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" });
      const staleBase = currentRevision(handle) - 1;
      assert.throws(
        () => removeExcludedRange(handle, { start: 0x4000, endInclusive: 0x4fff, baseRevision: staleBase }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoStoreStaleRevisionError, `expected AnnoStoreStaleRevisionError, got ${String(e)}`);
          assert.equal((e as AnnoStoreStaleRevisionError).baseRevision, staleBase);
          assert.equal((e as AnnoStoreStaleRevisionError).currentRevision, currentRevision(handle));
          return true;
        },
      );
      assert.deepEqual(
        listExcludedRanges(handle),
        [{ id: 1, start: 0x4000, endInclusive: 0x4fff, reason: "cracktro" }],
        "the refused write removed nothing",
      );
    } finally {
      closeStore(handle);
    }
  });
});

// ---------------------------------------------------------------------------
// WR-25 -- workspace confinement is `openStore`'s DEFAULT, and the unconfined
// path is a word a grep can find.
//
// `anno-types.mts`'s header names three things nothing upstream validates: "an
// address of 65536, a misspelled data type, and a store path pointing outside
// the workspace all look identical to the transport". The store path was the
// only one of the three whose mitigation a caller could simply forget.
// ---------------------------------------------------------------------------

test("WR-25: openStore with NO options refuses by name -- and, the part that matters, creates NO file at the path it refused", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    let caught: unknown;
    try {
      openStore(path);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof AnnoStorePathError, `an open with neither a workspaceRoot nor the escape is REFUSED BY NAME; got ${caught}`);
    assert.match((caught as Error).message, /workspace root/, "and the message says what is missing");
    assert.ok((caught as Error).message.includes(path), "and names the path it refused");

    // THE ASSERTION A CLASS-ONLY CONTROL WOULD MISS. `openStore`'s default
    // behaviour is to CREATE and initialise an absent store, so a guard placed
    // after `new DatabaseSync` would throw the right class over a file it had
    // already made. The refusal has to be before the constructor, and this is
    // the assertion that proves it is.
    assert.equal(existsSync(path), false, "the refused open created NOTHING at the path");
  });
});

test("WR-25 companion: a CONFINED open of a legitimate in-workspace path still succeeds -- the default was not bought by refusing everything", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const handle = openStore(path, { workspaceRoot: dir });
    try {
      assert.equal(currentRevision(handle), 0, "a freshly created confined store starts at revision 0");
    } finally {
      closeStore(handle);
    }
  });
});

test("WR-25 companion: the escape option opens the same path successfully, so the hatch is real and the seam pin is pinning something that works", () => {
  inTempDir((dir) => {
    const path = join(dir, "derived.annostore");
    const handle = openStore(path, { unconfinedModuleDerivedPath: true });
    try {
      assert.equal(currentRevision(handle), 0, "the escape path creates and initialises exactly as the confined path does");
    } finally {
      closeStore(handle);
    }
  });
});

// ---------------------------------------------------------------------------
// D-15: `anno_enum_usage` -- one address, at most one enum, associated BY ENUM
// ID. Everything below is the behaviour the `anno_apply_enum_usage` verb
// dispatches to.
// ---------------------------------------------------------------------------

test("applying a project enum at an address is idempotent, is refused by name when the enum does not exist, and clears back to nothing", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      createProjectEnum(store, { name: "Colors", variants: { "0": "black", "1": "white" } });

      const first = applyEnumUsage(store, { address: 0xd020, name: "Colors" });
      assert.equal(first.changed, true, "the first apply at this address is a real edit");
      const rows = listEnumUsage(store);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].address, 0xd020);
      assert.equal(rows[0].enumName, "Colors");
      assert.equal(rows[0].bank, null, "bank is reserved and every row written today carries null");

      // THE IDEMPOTENCY CLAIM IS ABOUT `changed`, NOT ABOUT THE REVISION, and
      // the distinction is the module's own (see `AnnoWriteResult`): every
      // ACCEPTED write advances the revision by exactly one, including one that
      // turned out to be identical to what was already stored, because a
      // caller's base_revision must see every accepted write. `changed` is the
      // only signal that separates a no-op from a real edit, and this is
      // `putXref`'s shape copied rather than a second convention invented here.
      const before = currentRevision(store);
      const repeat = applyEnumUsage(store, { address: 0xd020, name: "Colors" });
      assert.equal(repeat.changed, false, "the same enum at the same address is an accepted NO-OP, not a second row and not a refusal");
      assert.equal(listEnumUsage(store).length, 1, "and it leaves exactly one row");
      assert.equal(currentRevision(store), before + 1, "an accepted write advances the revision by one even when it changed nothing -- AnnoWriteResult's stated invariant");

      assert.throws(
        () => applyEnumUsage(store, { address: 0xd021, name: "NoSuchEnum" }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoLabelError, `expected AnnoLabelError, got ${String(e)}`);
          assert.match(e.message, /NoSuchEnum/, "the refusal must name the enum it could not find");
          return true;
        },
      );
      assert.equal(listEnumUsage(store).length, 1, "a refused apply writes nothing");

      const cleared = clearEnumUsage(store, { address: 0xd020 });
      assert.equal(cleared.changed, true, "clearing an address that carried a usage is a real edit");
      assert.equal(listEnumUsage(store).length, 0);

      const clearAgain = clearEnumUsage(store, { address: 0xd020 });
      assert.equal(clearAgain.changed, false, "clearing an address with no usage is an accepted no-op, NOT an error -- clearing is idempotent in the same direction applying is");
    } finally {
      closeStore(store);
    }
  });
});

test("an enum usage is associated by enum ID, so renaming the enum through updateProjectEnum re-resolves the usage rather than orphaning or silently re-pointing it", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      createProjectEnum(store, { name: "Colors", variants: { "0": "black" } });
      const enumId = listProjectEnums(store)[0].id;
      applyEnumUsage(store, { address: 0xd020, name: "Colors" });

      updateProjectEnum(store, { name: "Colors", newName: "VicColors" });

      const rows = listEnumUsage(store);
      assert.equal(rows.length, 1, "the rename must not orphan the usage");
      assert.equal(rows[0].enumId, enumId, "the persisted association is the enum's ID, and the ID did not move");
      assert.equal(
        rows[0].enumName,
        "VicColors",
        "and the name is resolved through the join at read time, so it follows the rename instead of pointing at a name nothing holds",
      );
    } finally {
      closeStore(store);
    }
  });
});

test("applyEnumUsage validates its address through parseStoreAddress before any SQL runs -- an out-of-range address and an UNPREFIXED numeric string are both refused, and neither writes a row", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      createProjectEnum(store, { name: "Colors", variants: { "0": "black" } });

      assert.throws(
        () => applyEnumUsage(store, { address: 0x10000, name: "Colors" }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoAddressError, `expected AnnoAddressError, got ${String(e)}`);
          return true;
        },
      );

      // T-29-11, WR-22's recorded failure re-driven one table over: a JSON
      // `"53280"` arriving verbatim must be an ARGUMENT error, not a row at
      // some address SQLite's column affinity guessed at.
      assert.throws(
        () => applyEnumUsage(store, { address: "53280", name: "Colors" }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoAddressError, `expected AnnoAddressError, got ${String(e)}`);
          return true;
        },
      );

      assert.throws(
        () => clearEnumUsage(store, { address: "53280" }),
        (e: unknown) => {
          assert.ok(e instanceof AnnoAddressError, `expected AnnoAddressError, got ${String(e)}`);
          return true;
        },
      );

      assert.equal(listEnumUsage(store).length, 0, "no refused call may leave a row behind");
      assert.equal(currentRevision(store), 1, "and no refused call may advance the revision past the single createProjectEnum write");
    } finally {
      closeStore(store);
    }
  });
});

// ---------------------------------------------------------------------------
// D-15's CONSEQUENCE, which is the half of the decision that is easy to lose:
// the version refusal must stay a SINGLE-WITNESS refusal. The bump was taken
// deliberately and with the cost named; what must not happen afterwards is a
// migration arm arriving quietly, because that would silently re-interpret
// files this build declared unopenable.
//
// The two tests below exclude the two ways that goes wrong. The first is
// BEHAVIOURAL: an actual version 2 file on disk is refused by name and left
// byte-identical, which rules out both a silent open (it would not throw) and
// a silent upgrade (the file would change). The second is STRUCTURAL, and it
// is what makes the refusal a SINGLE witness rather than merely a working one.
// ---------------------------------------------------------------------------

/**
 * The `SCHEMA_VERSION` 2 DDL, spelled out as its own frozen literal.
 *
 * DELIBERATELY HAND-WRITTEN AND DELIBERATELY NOT DERIVED FROM `DDL`. The
 * fixture's whole value is that it is a GENUINE OLD-FORMAT FILE rather than a
 * current store with one integer changed: a fixture built by taking today's DDL
 * and subtracting today's additions would track every future change to the
 * shape it is supposed to have frozen, and would stop being version 2 the
 * moment version 4 arrived. This is the shape as it stood at version 2 --
 * `anno_enum_usage` and its index are absent because they did not exist -- and
 * it must never be edited to follow the live schema.
 */
const SCHEMA_VERSION_2_DDL = `
create table anno_meta (
  id integer primary key check(id = 1),
  schema_version integer not null,
  revision integer not null
);

create table anno_range (
  id integer primary key autoincrement,
  start integer not null,
  end_inclusive integer not null,
  data_type text not null,
  bank integer
);

create table anno_label (
  id integer primary key autoincrement,
  address integer not null,
  name text not null unique,
  kind text not null,
  bank integer
);

create table anno_comment (
  id integer primary key autoincrement,
  address integer not null,
  comment_type text not null,
  text text not null,
  bank integer,
  unique(address, comment_type)
);

create table anno_scope (
  id integer primary key autoincrement,
  start integer not null,
  end_inclusive integer not null
);

create table anno_enum (
  id integer primary key autoincrement,
  name text not null unique,
  variants text not null,
  description text
);

create table anno_xref (
  id integer primary key autoincrement,
  from_address integer not null,
  to_address integer not null,
  access_kind text not null,
  bank integer
);

create table anno_snapshot (
  revision integer primary key
);

create index anno_range_end_start on anno_range(end_inclusive, start);
create index anno_label_address on anno_label(address);
create index anno_comment_address on anno_comment(address);
create index anno_xref_to on anno_xref(to_address);
`;

/** The TEST-ONLY spawned helper that writes the fixture. Its own header records
 * why it is a separate process: `anno-seam.test.ts` used to bound the set of
 * TEST files naming the SQLite builtin to a declared list, and building this
 * fixture inline would have widened that list -- weakening a standing guard to
 * serve one fixture. Phase 56 removed that declared-list check; this fixture
 * still runs as a spawned child process rather than naming `node:sqlite`
 * inline in `anno-store.test.ts`. */
const V2_FIXTURE_WRITER = join(HERE, "store-schema-v2-fixture.ts");

/** Writes a genuine `SCHEMA_VERSION` 2 store file at `path`, in a child
 * process. The frozen DDL is passed IN, so the shape stays declared here beside
 * the claim it supports rather than in the writer. */
function writeSchemaVersion2Store(path: string): void {
  execFileSync(process.execPath, [V2_FIXTURE_WRITER, path, SCHEMA_VERSION_2_DDL], { stdio: "pipe" });
}

test("D-15: a genuine SCHEMA_VERSION 2 store file is REFUSED by name -- naming both the version found and the version expected -- and the file is left byte-identical, so neither a silent open nor a silent upgrade is possible", () => {
  inTempDir((dir) => {
    const path = join(dir, "legacy-v2.annostore");
    writeSchemaVersion2Store(path);

    // NON-VACUITY, TAKEN FIRST: the fixture must really be a version 2 store
    // before the refusal below means anything. A builder that silently wrote
    // nothing would make every assertion in this test pass for the wrong
    // reason.
    assert.ok(existsSync(path), "the fixture must exist on disk before it can be refused");
    const bytesBefore = readFileSync(path);
    assert.ok(bytesBefore.length > 0, "and it must be a real file, not an empty one -- an empty file takes a DIFFERENT refusal branch");
    assert.notEqual(SCHEMA_VERSION, 2, "and this test is only meaningful while the current version is not 2");

    assert.throws(
      () => openStore(path, { workspaceRoot: dir }),
      (e: unknown) => {
        assert.ok(e instanceof AnnoStoreCorruptError, `expected AnnoStoreCorruptError, got ${String(e)}`);
        assert.match(e.message, /schema_version 2/, "the refusal must name the version it FOUND -- 2 -- not merely that there was a mismatch");
        assert.match(e.message, new RegExp(`expected ${SCHEMA_VERSION}`), "and the version it WANTED, so the reader can tell which build is which");
        return true;
      },
    );

    // THE BYTE COMPARISON IS WHAT EXCLUDES A SILENT UPGRADE. Remove it and this
    // test still passes against an `openStore` that migrated the file and then
    // threw anyway; keep it and a migration arm cannot hide behind the refusal.
    const bytesAfter = readFileSync(path);
    assert.equal(bytesAfter.length, bytesBefore.length, "a refusal must not resize the file it refused");
    assert.ok(
      bytesAfter.equals(bytesBefore),
      "and it must not change a single byte: D-15 declared every version 2 store unopenable, so the bytes stay exactly as their owner " +
        "left them and remain recoverable by hand",
    );
  });
});

// ---------------------------------------------------------------------------
// EVID-01/EVID-02/EVID-05, `SCHEMA_VERSION` 4 (43-02, Task 3): idempotent
// re-ingest, bracket reset without cross-bracket leakage, the
// denominator-carrying run listing, and two hardening proofs -- a version-3
// store refused twice concurrently, and re-opening an already-version-4
// store touching neither the DDL nor `anno_meta`.
// ---------------------------------------------------------------------------

/** One run identity's fields, spread into every `insertExecObservations` /
 * `deleteExecObservationsForRun` call below -- named once so a typo in one
 * digest does not silently create a SECOND identity partway through a test. */
function evidIdentity(seed: string): { imageSha256: string; argvDigest: string; seed: string } {
  return { imageSha256: "1".repeat(64), argvDigest: "2".repeat(64), seed };
}

test("EVID-01: inserting the identical observation set twice for the same run identity reports changed:false on the second call and leaves the row count unchanged", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const identity = evidIdentity("idempotent-reingest");
      const observations = [
        { address: 0x1000, sourceBank: "ram" as const },
        { address: 0x1001, sourceBank: "rom" as const },
      ];

      const first = insertExecObservations(store, { ...identity, observations });
      assert.equal(first.changed, true, "the first insert is a real edit");
      assert.equal(listExecObservations(store).length, 2, "and it stored exactly the two rows requested");

      const repeat = insertExecObservations(store, { ...identity, observations });
      assert.equal(repeat.changed, false, "a byte-identical re-ingest is an accepted NO-OP, not two more rows and not a refusal");
      assert.equal(listExecObservations(store).length, 2, "the table still holds exactly the original two rows");
      assert.equal(repeat.revision, first.revision + 1, "the revision still advances by exactly one, like every other write entry point");
    } finally {
      closeStore(store);
    }
  });
});

test("EVID-01: an overlapping-but-larger observation set reports changed:true and adds only the NEW observations", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const identity = evidIdentity("overlapping-larger-set");
      insertExecObservations(store, { ...identity, observations: [{ address: 0x1000, sourceBank: "ram" }] });

      const second = insertExecObservations(store, {
        ...identity,
        observations: [
          { address: 0x1000, sourceBank: "ram" }, // already present -- must not duplicate
          { address: 0x2000, sourceBank: "io" }, // new
        ],
      });
      assert.equal(second.changed, true, "the call added at least one new observation");

      const rows = listExecObservations(store);
      assert.equal(rows.length, 2, "the overlap was skipped, not re-inserted -- exactly one new row, not two");
      assert.deepEqual(
        rows.map((r) => r.address).sort((a, b) => a - b),
        [0x1000, 0x2000],
      );
    } finally {
      closeStore(store);
    }
  });
});

test("EVID-05: deleteExecObservationsForRun for run identity A removes every row for A and leaves run identity B's rows readable and unchanged", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const A = evidIdentity("bracket-A");
      const B = evidIdentity("bracket-B");
      insertExecObservations(store, { ...A, observations: [{ address: 0x1000, sourceBank: "ram" }] });
      insertExecObservations(store, { ...B, observations: [{ address: 0x2000, sourceBank: "rom" }] });

      const deleted = deleteExecObservationsForRun(store, A);
      assert.equal(deleted.changed, true, "bracket A held a row, so the reset is a real edit");

      const remaining = listExecObservations(store);
      assert.equal(remaining.length, 1, "only bracket A's row is gone");
      assert.equal(remaining[0].seed, B.seed, "bracket B's row survives, untouched");
      assert.equal(remaining[0].address, 0x2000);
    } finally {
      closeStore(store);
    }
  });
});

test("EVID-05: deleteExecObservationsForRun for a run identity that holds no rows reports changed:false and is NOT an error -- resetting an empty bracket is the ordinary thing", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const result = deleteExecObservationsForRun(store, evidIdentity("never-had-a-row"));
      assert.equal(result.changed, false);
    } finally {
      closeStore(store);
    }
  });
});

test("listObservedRuns returns one row per distinct run identity with the correct observationCount, and its summary carries a denominator naming the address-space size the counts are a fraction of", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    try {
      const A = evidIdentity("denominator-A");
      const B = evidIdentity("denominator-B");
      insertExecObservations(store, {
        ...A,
        observations: [
          { address: 0x1000, sourceBank: "ram" },
          { address: 0x1001, sourceBank: "ram" },
        ],
      });
      insertExecObservations(store, { ...B, observations: [{ address: 0x2000, sourceBank: "rom" }] });

      const { runs, denominator } = listObservedRuns(store);
      assert.equal(denominator, 65536, "the denominator is the full 6510 address space -- ADDRESS_MAX - ADDRESS_MIN + 1, never a literal");
      assert.equal(runs.length, 2);

      const runA = runs.find((r) => r.seed === A.seed);
      const runB = runs.find((r) => r.seed === B.seed);
      assert.ok(runA !== undefined && runB !== undefined, "both run identities are present");
      assert.equal(runA!.observationCount, 2);
      assert.equal(runB!.observationCount, 1);

      // THE RELATION IS ASSERTED, NEVER A PINNED COUNT (this test's own
      // acceptance criterion): a future fixture with more observations must
      // not need this test rewritten.
      for (const run of runs) {
        assert.ok(run.observationCount <= denominator, `observationCount ${run.observationCount} must never exceed the denominator ${denominator}`);
      }
    } finally {
      closeStore(store);
    }
  });
});

test("EVID-02 idempotency: opening an existing store does not re-run the DDL and does not rewrite anno_meta or the project row -- the schema_version and the revision are identical before and after", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");
    const first = openStore(path, { workspaceRoot: dir });
    setDataType(first, { start: 0x1000, endInclusive: 0x1000, dataType: "byte" });
    const metaBefore = first.db.prepare("select schema_version, revision from anno_meta, anno_project").get() as {
      schema_version: number;
      revision: number;
    };
    closeStore(first);

    const reopened = openStore(path, { workspaceRoot: dir });
    try {
      const metaAfter = reopened.db.prepare("select schema_version, revision from anno_meta, anno_project").get() as {
        schema_version: number;
        revision: number;
      };
      assert.deepEqual(
        metaAfter,
        metaBefore,
        "re-opening an existing store must not re-run the DDL and must not rewrite anno_meta -- schema_version and revision are " +
          "identical before and after",
      );
      assert.equal(currentRevision(reopened), metaBefore.revision, "and the handle's own currentRevision() agrees");
    } finally {
      closeStore(reopened);
    }
  });
});

test("EVID-02 concurrency: two parallel opens of a version-3 store both refuse by name, and neither writes anno_meta -- the file's sha256 is unchanged before and after both refusals", async () => {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");
    const store = openStore(path, { workspaceRoot: dir });
    // Forging the version-3 state directly, exactly as the schema-version
    // refusal tests above do -- the point is a file THIS BUILD must refuse,
    // not a write it would ever perform.
    store.db.prepare("update anno_meta set schema_version = 3 where id = 1").run();
    closeStore(store);

    const sha256Before = createHash("sha256").update(readFileSync(path)).digest("hex");

    // TWO CHILD PROCESSES, `spawn`ED (not `execFileSync`'d) so both attempt
    // the open genuinely concurrently -- reusing `anno-durability.test.ts`'s
    // own spawn shape rather than inventing a second harness. Any existing
    // mutator mode calls `openStore()` before doing anything else, so a
    // version-mismatched store makes it throw UNCAUGHT and exit non-zero,
    // before ever reaching a write.
    const children = [spawn(process.execPath, [MUTATOR, path, "commit"], { stdio: "pipe" }), spawn(process.execPath, [MUTATOR, path, "commit"], { stdio: "pipe" })];

    const outcomes = await Promise.all(
      children.map(async (child) => {
        let stderr = "";
        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });
        const [code] = (await once(child, "exit")) as [number | null, string | null];
        return { code, stderr };
      }),
    );

    for (const outcome of outcomes) {
      assert.notEqual(outcome.code, 0, `expected a non-zero exit from a child refusing a version-3 store, got ${JSON.stringify(outcome)}`);
      assert.match(outcome.stderr, /AnnoStoreCorruptError/, `expected the refusal's own class name in stderr, got: ${outcome.stderr}`);
      assert.match(outcome.stderr, /schema_version 3/, `expected the refusal to name the version found, got: ${outcome.stderr}`);
      assert.match(outcome.stderr, new RegExp(`expected ${SCHEMA_VERSION}`), `expected the refusal to name the version wanted, got: ${outcome.stderr}`);
    }

    const sha256After = createHash("sha256").update(readFileSync(path)).digest("hex");
    assert.equal(sha256After, sha256Before, "neither refusal may write anno_meta or anything else -- the file's sha256 is byte-identical");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
