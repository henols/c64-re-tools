import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { KnowledgeError, openForWrite } from "./database.ts";
import { commentsAt, currentRevision, listModules, listSuppressions, listSymbols, moduleAt, referencesFrom, regionsOverlapping, symbolAt } from "./read.ts";
import { revision as revisionChanges } from "./history.ts";
import {
  addReference,
  applyBatch,
  classifyRegion,
  removeComment,
  removeModule,
  removeReference,
  removeSymbol,
  renameSymbol,
  revert,
  setComment,
  setModule,
  unclassifyRegion,
  type WriteContext,
} from "./write.ts";

const roots: string[] = [];
const databases: DatabaseSync[] = [];
after(() => {
  for (const db of databases) db.close();
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function fresh(): DatabaseSync {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-write-"));
  roots.push(root);
  const db = openForWrite(root);
  databases.push(db);
  return db;
}

const llm: WriteContext = { origin: "llm" };
const failsWith = (code: string) => (error: unknown) => error instanceof KnowledgeError && error.code === code;

function count(db: DatabaseSync, sql: string): number {
  return (db.prepare(sql).get() as { n: number }).n;
}

test("a rename creates one revision, and the old name stays in history", () => {
  const db = fresh();
  const first = renameSymbol(db, { origin: "llm", description: "entry point" }, { address: 0x2100, name: "FUN_2100", kind: "routine" });
  assert.equal(first.revision, 1);
  assert.deepEqual(first.current, { space: "c64", address: 0x2100, name: "FUN_2100", kind: "routine", origin: "llm", revision: 1 });
  const second = renameSymbol(db, { origin: "user", description: "reads joystick 2" }, { address: 0x2100, name: "update_player" });
  assert.equal(second.revision, 2);
  assert.equal(second.current.kind, "routine", "the kind stays when not given");
  assert.equal(currentRevision(db), 2);
  assert.equal(count(db, "SELECT count(*) AS n FROM symbols WHERE address = 8448"), 2);
  assert.equal(count(db, "SELECT count(*) AS n FROM symbols WHERE address = 8448 AND valid_to_revision = 2"), 1);
  const revision = db.prepare("SELECT origin, operation, description FROM revisions WHERE id = 2").get();
  assert.deepEqual({ ...revision }, { origin: "user", operation: "rename-symbol", description: "reads joystick 2" });
});

test("a revision records its time in ISO 8601 at the CET offset", () => {
  const db = fresh();
  const before = Date.now();
  renameSymbol(db, llm, { address: 0x1000, name: "start" });
  const { created_at } = db.prepare("SELECT created_at FROM revisions WHERE id = 1").get() as { created_at: string };
  assert.match(created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+01:00$/);
  const recorded = Date.parse(created_at);
  assert.ok(recorded >= before && recorded <= Date.now());
});

test("an unchanged write creates no revision", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x1000, name: "loop", kind: "label" });
  assert.equal(renameSymbol(db, llm, { address: 0x1000, name: "loop" }).revision, null);
  assert.equal(currentRevision(db), 1);
});

test("a name used at another address is a conflict and changes nothing", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x1000, name: "loop" });
  assert.throws(() => renameSymbol(db, llm, { address: 0x2000, name: "loop" }), (error: unknown) => {
    assert.ok(failsWith("conflict")(error));
    assert.match((error as Error).message, /\$1000/);
    return true;
  });
  assert.equal(currentRevision(db), 1);
  assert.equal(count(db, "SELECT count(*) AS n FROM revisions"), 1);
});

test("a stale expected revision is refused", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x1000, name: "a" });
  renameSymbol(db, llm, { address: 0x1001, name: "b" });
  assert.throws(() => renameSymbol(db, { origin: "llm", expectedRevision: 1 }, { address: 0x1002, name: "c" }), failsWith("stale-revision"));
  assert.equal(renameSymbol(db, { origin: "llm", expectedRevision: 2 }, { address: 0x1002, name: "c" }).revision, 3);
});

test("only the user and the LLM write semantic knowledge", () => {
  const db = fresh();
  assert.throws(() => renameSymbol(db, { origin: "ghidra" } as unknown as WriteContext, { address: 1, name: "x" }), failsWith("invalid-input"));
  assert.throws(() => renameSymbol(db, llm, { address: 1, name: "bad name" }), failsWith("invalid-input"));
  assert.throws(() => renameSymbol(db, llm, { address: 0x10000, name: "x" }), failsWith("invalid-input"));
  assert.equal(currentRevision(db), 0);
});

test("removing a symbol closes it; removing a missing one is not-found", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x1000, name: "loop" });
  assert.equal(removeSymbol(db, llm, { address: 0x1000 }).revision, 2);
  assert.equal(symbolAt(db, 0x1000), undefined);
  assert.throws(() => removeSymbol(db, llm, { address: 0x1000 }), failsWith("not-found"));
  // The freed name can be used again.
  renameSymbol(db, llm, { address: 0x3000, name: "loop" });
});

test("a classification inside a region splits it in one revision; current regions never overlap", () => {
  const db = fresh();
  classifyRegion(db, llm, { start: 0x1000, end: 0x1fff, type: "bytes" });
  const split = classifyRegion(db, llm, { start: 0x1400, end: 0x14ff, type: "sprite" });
  assert.equal(split.revision, 2);
  assert.deepEqual(
    regionsOverlapping(db, 0, 0xffff).map((region) => [region.start, region.end, region.type, region.revision]),
    [
      [0x1000, 0x13ff, "bytes", 2],
      [0x1400, 0x14ff, "sprite", 2],
      [0x1500, 0x1fff, "bytes", 2],
    ],
  );
  assert.equal(count(db, "SELECT count(*) AS n FROM regions WHERE valid_to_revision = 2"), 1, "the old region is closed, not deleted");
  // Reclassifying across two regions replaces both parts it covers.
  classifyRegion(db, llm, { start: 0x1300, end: 0x15ff, type: "code" });
  assert.deepEqual(
    regionsOverlapping(db, 0, 0xffff).map((region) => [region.start, region.end, region.type]),
    [
      [0x1000, 0x12ff, "bytes"],
      [0x1300, 0x15ff, "code"],
      [0x1600, 0x1fff, "bytes"],
    ],
  );
  assert.equal(classifyRegion(db, llm, { start: 0x1300, end: 0x15ff, type: "code" }).revision, null);
});

test("unclassifying keeps the parts outside the range", () => {
  const db = fresh();
  classifyRegion(db, llm, { start: 0x1000, end: 0x1fff, type: "code" });
  unclassifyRegion(db, llm, { start: 0x1800, end: 0x18ff });
  assert.deepEqual(
    regionsOverlapping(db, 0, 0xffff).map((region) => [region.start, region.end]),
    [
      [0x1000, 0x17ff],
      [0x1900, 0x1fff],
    ],
  );
  assert.throws(() => unclassifyRegion(db, llm, { start: 0x1800, end: 0x18ff }), failsWith("not-found"));
  assert.throws(() => classifyRegion(db, llm, { start: 0x2000, end: 0x1000, type: "code" }), failsWith("invalid-input"));
  assert.throws(() => classifyRegion(db, llm, { start: 0, end: 1, type: "music" as never }), failsWith("invalid-input"));
});

test("a comment is set, replaced and removed per placement, with history", () => {
  const db = fresh();
  setComment(db, llm, { address: 0x2100, placement: "line", text: "  Reads joystick 2.  " });
  setComment(db, llm, { address: 0x2100, placement: "side", text: "port 2" });
  assert.equal(setComment(db, llm, { address: 0x2100, placement: "line", text: "Reads joystick 2." }).revision, null, "same text after trimming");
  setComment(db, llm, { address: 0x2100, placement: "line", text: "Reads joystick 2 and moves the player." });
  assert.deepEqual(
    commentsAt(db, 0x2100).map((comment) => [comment.placement, comment.text]),
    [
      ["line", "Reads joystick 2 and moves the player."],
      ["side", "port 2"],
    ],
  );
  removeComment(db, llm, { address: 0x2100, placement: "side" });
  assert.deepEqual(commentsAt(db, 0x2100).map((comment) => comment.placement), ["line"]);
  assert.equal(count(db, "SELECT count(*) AS n FROM comments WHERE address = 8448"), 3);
  assert.throws(() => removeComment(db, llm, { address: 0x2100, placement: "side" }), failsWith("not-found"));
  assert.throws(() => setComment(db, llm, { address: 0x2100, placement: "line", text: "   " }), failsWith("invalid-input"));
});

test("references are added once and removed with history", () => {
  const db = fresh();
  assert.equal(addReference(db, llm, { from: 0x2100, to: 0x2300, kind: "call" }).revision, 1);
  assert.equal(addReference(db, llm, { from: 0x2100, to: 0x2300, kind: "call" }).revision, null);
  addReference(db, llm, { from: 0x2100, to: 0xd020, kind: "write" });
  assert.deepEqual(referencesFrom(db, 0x2100).map((reference) => [reference.to, reference.kind]), [
    [0x2300, "call"],
    [0xd020, "write"],
  ]);
  removeReference(db, llm, { from: 0x2100, to: 0x2300, kind: "call" });
  assert.equal(referencesFrom(db, 0x2100).length, 1);
  assert.equal(count(db, 'SELECT count(*) AS n FROM "references"'), 2);
  assert.throws(() => removeReference(db, llm, { from: 0x2100, to: 0x2300, kind: "call" }), failsWith("not-found"));
});

test("a revert restores an earlier state as a new revision and erases nothing", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x2100, name: "FUN_2100", kind: "routine" }); // 1
  classifyRegion(db, llm, { start: 0x2100, end: 0x21ff, type: "code" }); // 2
  renameSymbol(db, { origin: "user" }, { address: 0x2100, name: "update_player" }); // 3
  setComment(db, llm, { address: 0x2100, placement: "line", text: "Moves the player." }); // 4
  const reverted = revert(db, { origin: "user", description: "back to the analyzer view" }, { revision: 2 });
  assert.equal(reverted.revision, 5);
  assert.equal(symbolAt(db, 0x2100)?.name, "FUN_2100");
  assert.equal(symbolAt(db, 0x2100)?.origin, "llm", "the restored row keeps its origin");
  assert.deepEqual(commentsAt(db, 0x2100), []);
  assert.equal(regionsOverlapping(db, 0x2100, 0x2100).length, 1);
  assert.equal(count(db, "SELECT count(*) AS n FROM revisions"), 5);
  assert.equal(count(db, "SELECT count(*) AS n FROM symbols"), 3, "FUN_2100, update_player, restored FUN_2100");
  // Revert to the empty start, then forward again to revision 4.
  revert(db, llm, { revision: 0 });
  assert.equal(symbolAt(db, 0x2100), undefined);
  revert(db, llm, { revision: 4 });
  assert.equal(symbolAt(db, 0x2100)?.name, "update_player");
  assert.equal(commentsAt(db, 0x2100)[0]?.text, "Moves the player.");
  assert.throws(() => revert(db, llm, { revision: 99 }), failsWith("not-found"));
});

test("a failure in the middle of a write rolls all of it back", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x1000, name: "loop" });
  // Make the insert of the new row fail after the old row was closed.
  db.exec("CREATE TEMP TRIGGER fail_boom BEFORE INSERT ON symbols WHEN NEW.name = 'boom' BEGIN SELECT RAISE(ABORT, 'boom'); END");
  assert.throws(() => renameSymbol(db, llm, { address: 0x1000, name: "boom" }), /boom/);
  assert.equal(symbolAt(db, 0x1000)?.name, "loop");
  assert.equal(currentRevision(db), 1);
  assert.equal(count(db, "SELECT count(*) AS n FROM revisions"), 1);
  db.exec("DROP TRIGGER fail_boom");
});

test("a write over a row of another origin returns the replaced row", () => {
  const db = fresh();
  const user: WriteContext = { origin: "user" };
  renameSymbol(db, user, { address: 0x2100, name: "update_player", kind: "routine" });
  const renamed = renameSymbol(db, llm, { address: 0x2100, name: "move_player" });
  assert.deepEqual(renamed.previous, { space: "c64", address: 0x2100, name: "update_player", kind: "routine", origin: "user", revision: 1 });
  assert.equal(renameSymbol(db, llm, { address: 0x2100, name: "step_player" }).previous, undefined, "a row of the same origin is no surprise");

  classifyRegion(db, user, { start: 0x3000, end: 0x30ff, type: "sprite" });
  classifyRegion(db, llm, { start: 0x3100, end: 0x31ff, type: "bytes" });
  const classified = classifyRegion(db, llm, { start: 0x3080, end: 0x317f, type: "bitmap" });
  assert.deepEqual(
    classified.previous?.map((region) => [region.start, region.end, region.type, region.origin]),
    [[0x3000, 0x30ff, "sprite", "user"]],
  );
  assert.equal(classifyRegion(db, llm, { start: 0x3080, end: 0x317f, type: "bitmap" }).previous, undefined, "an unchanged write replaces nothing");
});

test("an unclassify over a range that is partly suppressed adds only the free parts, so suppressions never overlap", () => {
  const db = fresh();
  classifyRegion(db, llm, { start: 0x1000, end: 0x10ff, type: "bytes" });
  unclassifyRegion(db, llm, { start: 0x1040, end: 0x107f });
  unclassifyRegion(db, llm, { start: 0x1000, end: 0x10ff });
  assert.deepEqual(
    listSuppressions(db).map((row) => [row.start, row.end, row.revision]),
    [
      [0x1000, 0x103f, 3],
      [0x1040, 0x107f, 2],
      [0x1080, 0x10ff, 3],
    ],
  );
});

// D42: element sizes, batches, evidence and the origin filter.

test("a data region takes an element size that divides its length, and a split keeps it where it still fits", () => {
  const db = fresh();
  const table = classifyRegion(db, llm, { start: 0x3000, end: 0x303b, type: "bytes", element: 6 });
  assert.equal(table.current[0]!.element, 6);
  assert.throws(() => classifyRegion(db, llm, { start: 0x3000, end: 0x3009, type: "bytes", element: 6 }), failsWith("invalid-input"), "10 bytes are not whole elements of 6");
  assert.throws(() => classifyRegion(db, llm, { start: 0x4000, end: 0x4005, type: "jumps", element: 3 }), failsWith("invalid-input"), "a JMP table has no element size");
  classifyRegion(db, llm, { start: 0x3000, end: 0x3005, type: "petscii" });
  assert.deepEqual(
    regionsOverlapping(db, 0x3000, 0x303b).map((region) => [region.start, region.end, region.type, region.element]),
    [
      [0x3000, 0x3005, "petscii", undefined],
      [0x3006, 0x303b, "bytes", 6],
    ],
  );
  classifyRegion(db, llm, { start: 0x3006, end: 0x3007, type: "words" });
  assert.equal(regionsOverlapping(db, 0x3008, 0x3008)[0]!.element, undefined, "52 bytes are no whole elements of 6: the size goes");
});

test("a batch is one revision, and a refused write leaves nothing written", () => {
  const db = fresh();
  const applied = applyBatch(db, { origin: "llm", description: "names from the coverage run" }, [
    { op: "rename", address: 0x2100, name: "update_player", kind: "routine" },
    { op: "classify", start: 0x3000, end: 0x303f, type: "sprite" },
    { op: "comment", address: 0x2100, placement: "line", text: "Reads joystick 2." },
    { op: "reference", from: 0x2000, to: 0x2100, kind: "call" },
  ]);
  assert.equal(applied.revision, 1);
  assert.equal(applied.steps.length, 4);
  assert.equal(count(db, "SELECT count(*) AS n FROM revisions"), 1);
  assert.equal(symbolAt(db, 0x2100)?.revision, 1);

  assert.throws(
    () => applyBatch(db, llm, [{ op: "rename", address: 0x2200, name: "other" }, { op: "remove-symbol", address: 0x2300 }]),
    (error: unknown) => failsWith("not-found")(error) && /^Write 2: /.test((error as Error).message),
  );
  assert.equal(symbolAt(db, 0x2200), undefined, "the first write of the refused batch is gone too");
  assert.equal(currentRevision(db), 1);
  assert.throws(() => applyBatch(db, llm, [{ op: "classify", start: 0x10, end: 0x0f, type: "bytes" }]), (error: unknown) => failsWith("invalid-input")(error) && /^Write 1: /.test((error as Error).message));
});

test("evidence is kept with the revision that a write makes, and a write that changes nothing keeps none", () => {
  const db = fresh();
  const evidence = [{ kind: "coverage" as const, ref: "coverage/attract.bin", sha256: "a".repeat(64) }, { kind: "note" as const, ref: "watchpoint shows a write before the read" }];
  const named = renameSymbol(db, { origin: "llm", evidence }, { address: 0x2100, name: "update_player" });
  assert.deepEqual(revisionChanges(db, named.revision!).revision.evidence, evidence);
  assert.equal(renameSymbol(db, { origin: "llm", evidence }, { address: 0x2100, name: "update_player" }).revision, null);
  assert.equal(count(db, "SELECT count(*) AS n FROM evidence"), 2);
  assert.throws(() => renameSymbol(db, { origin: "llm", evidence: [{ kind: "rumour" as never, ref: "x" }] }, { address: 0x2200, name: "x" }), failsWith("invalid-input"));
});

test("lists keep only the origins asked for", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x2100, name: "update_player" });
  renameSymbol(db, { origin: "user" }, { address: 0x2200, name: "draw_room" });
  assert.deepEqual(listSymbols(db, undefined, undefined, ["user"]).map((row) => row.name), ["draw_room"]);
  assert.deepEqual(listSymbols(db, undefined, undefined, ["dxa", "ghidra"]), []);
  assert.equal(listSymbols(db).length, 2);
});

test("a module starts a file of generated source: one per address and per file, with history and revert", () => {
  const db = fresh();
  const first = setModule(db, llm, { start: 0x0801, file: "boot.asm", title: "BASIC start and setup" });
  assert.deepEqual(first.current, { space: "c64", start: 0x0801, file: "boot.asm", title: "BASIC start and setup", origin: "llm", revision: 1 });
  assert.equal(setModule(db, llm, { start: 0x0801, file: "boot.asm", title: "BASIC start and setup" }).revision, null);
  setModule(db, { origin: "user" }, { start: 0x2000, file: "player.asm" });
  assert.throws(() => setModule(db, llm, { start: 0x3000, file: "player.asm" }), failsWith("conflict"));
  for (const file of ["../x.asm", "sub/x.asm", "x.a", ".asm", "x y.asm"]) assert.throws(() => setModule(db, llm, { start: 0x3000, file }), failsWith("invalid-input"), file);
  // c64-source writes these files itself; macOS and Windows ignore the letter case (F-31).
  for (const file of ["main.asm", "loader.asm", "constants.asm", "Main.asm", "CONSTANTS.asm"]) {
    assert.throws(() => setModule(db, llm, { start: 0x3000, file }), (error: unknown) => error instanceof KnowledgeError && error.code === "invalid-input" && /writes main\.asm, loader\.asm, constants\.asm itself/.test(error.message), file);
  }
  setModule(db, llm, { start: 0x0801, file: "start.asm" });
  assert.deepEqual(moduleAt(db, 0x0801), { space: "c64", start: 0x0801, file: "start.asm", title: "BASIC start and setup", origin: "llm", revision: 3 }, "a write without a title keeps it (F-26)");
  assert.deepEqual(listModules(db, undefined, ["user"]).map((row) => row.file), ["player.asm"]);
  assert.equal(revisionChanges(db, 3).closed[0]?.entity, "module");

  removeModule(db, llm, { start: 0x2000 });
  assert.throws(() => removeModule(db, llm, { start: 0x2000 }), failsWith("not-found"));
  revert(db, llm, { revision: 2 });
  assert.deepEqual(listModules(db).map((row) => [row.start, row.file]), [[0x0801, "boot.asm"], [0x2000, "player.asm"]]);
  applyBatch(db, llm, [{ op: "unmodule", start: 0x2000 }, { op: "module", start: 0x2100, file: "player.asm", title: "Player" }]);
  assert.deepEqual(listModules(db).map((row) => [row.start, row.file]), [[0x0801, "boot.asm"], [0x2100, "player.asm"]]);
});

test("each space has its own rows and names (D53)", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x0500, name: "loop" });
  renameSymbol(db, llm, { space: "drive8", address: 0x0500, name: "loop" });
  renameSymbol(db, llm, { space: "bank3", address: 0x8000, name: "loop" });
  assert.equal(symbolAt(db, 0x0500)?.space, "c64");
  assert.equal(symbolAt(db, 0x0500, "drive8")?.space, "drive8");
  assert.equal(symbolAt(db, 0x8000), undefined);
  removeSymbol(db, llm, { space: "drive8", address: 0x0500 });
  assert.equal(symbolAt(db, 0x0500, "drive8"), undefined);
  assert.equal(symbolAt(db, 0x0500)?.name, "loop", "the C64 row stays");
  assert.deepEqual(listSuppressions(db, undefined, "drive8").map((row) => [row.space, row.entity, row.start]), [["drive8", "symbol", 0x0500]]);
  assert.deepEqual(listSuppressions(db), []);
  classifyRegion(db, llm, { space: "bank3", start: 0x8000, end: 0x80ff, type: "bytes" });
  assert.deepEqual(regionsOverlapping(db, 0x8000, 0x8000), []);
  assert.throws(() => renameSymbol(db, llm, { space: "bank256", address: 0x8000, name: "x" }), failsWith("invalid-input"));
  assert.throws(() => applyBatch(db, llm, [{ op: "rename", space: "drive9", address: 0x0300, name: "x" }]), failsWith("invalid-input"));
  revert(db, llm, { revision: 2 });
  assert.equal(symbolAt(db, 0x0500, "drive8")?.name, "loop", "a revert restores rows of every space");
  assert.equal(symbolAt(db, 0x8000, "bank3"), undefined);
});
