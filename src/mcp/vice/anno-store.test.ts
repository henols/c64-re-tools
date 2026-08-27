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
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPaintIndex, NO_ROW, resolveAt } from "./anno-index.ts";
import {
  AnnoCommentGradeError,
  AnnoLabelError,
  AnnoRangeShapeError,
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
  putXref,
  revertTo,
  setComment,
  setDataType,
  setLabel,
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

test("the reserved bank field is never READ: every list function returns bank null, and no line of the seam's own code reads a bank value outside the row mappers", () => {
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
  const strict = codeOnly(readFileSync(join(HERE, "anno-store.ts"), "utf8"));
  const offenders = strict
    .split("\n")
    .filter((line) => /\bbank\b/.test(line))
    // The row mappers ARE the one permitted read, one line each.
    .filter((line) => !/^\s*bank: row\.bank,$/.test(line))
    // ...and the local row-shape casts that name the column's type.
    .filter((line) => !/^\s*bank: number \| null;$/.test(line));
  assert.deepEqual(offenders, [], "no code outside the row mappers may read a bank value -- nothing knows what one would mean");
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

      const files = readdirSync(join(dir, "snapshots")).sort();
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

test("idempotency of open: opening and closing a store twice with no write between leaves the revision, the rows and the snapshot ring unchanged", () => {
  inTempDir((dir) => {
    const path = join(dir, "proj.annostore");

    const first = openStore(path, { workspaceRoot: dir });
    setDataType(first, { start: 0x0810, endInclusive: 0x084f, dataType: "lo_hi_address" });
    const revisionAfterWrite = currentRevision(first);
    const rowsAfterWrite = listRanges(first);
    const snapshotsAfterWrite = readdirSync(join(dir, "snapshots")).sort();
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
        assert.deepEqual(readdirSync(join(dir, "snapshots")).sort(), snapshotsAfterWrite, `open pass ${pass} must not add a snapshot`);
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
