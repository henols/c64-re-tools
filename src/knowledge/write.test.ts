import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { KnowledgeError, openForWrite } from "./database.ts";
import { commentsAt, currentRevision, referencesFrom, regionsOverlapping, symbolAt } from "./read.ts";
import {
  addReference,
  classifyRegion,
  isoCet,
  removeComment,
  removeReference,
  removeSymbol,
  renameSymbol,
  revert,
  setComment,
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
  assert.deepEqual(first.current, { address: 0x2100, name: "FUN_2100", kind: "routine", origin: "llm", revision: 1 });
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

test("CET is +01:00 in winter and in summer, across the date line", () => {
  assert.equal(isoCet(new Date("2026-01-15T23:30:00.000Z")), "2026-01-16T00:30:00.000+01:00");
  assert.equal(isoCet(new Date("2026-07-01T12:00:00.250Z")), "2026-07-01T13:00:00.250+01:00");
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
  assert.deepEqual(renamed.previous, { address: 0x2100, name: "update_player", kind: "routine", origin: "user", revision: 1 });
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
