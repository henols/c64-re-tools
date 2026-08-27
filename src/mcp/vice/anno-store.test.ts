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
import { mkdtempSync, readFileSync, rmSync, statSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPaintIndex, NO_ROW, resolveAt } from "./anno-index.ts";
import {
  AnnoLabelError,
  AnnoRangeShapeError,
  AnnoStoreCorruptError,
  AnnoStorePathError,
  AnnoStoreStaleRevisionError,
  AnnoTypeError,
  SCHEMA_VERSION,
} from "./anno-types.ts";
import {
  addScope,
  closeStore,
  createProjectEnum,
  currentRevision,
  listComments,
  listLabels,
  listProjectEnums,
  listRanges,
  listScopes,
  listXrefs,
  openStore,
  putXref,
  revertTo,
  setComment,
  setDataType,
  setLabel,
  updateProjectEnum,
} from "./anno-store.ts";
import { codeOnly } from "./shipped-modules.ts";

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
