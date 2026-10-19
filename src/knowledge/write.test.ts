import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { formatAddress } from "../address.ts";
import { Refusal } from "../errors.ts";
import { openForWrite, transaction } from "./database.ts";
import { memoryRows, releaseImage, setImage } from "./program.ts";
import { at, commentsAt, currentRevision, currentStartScreen, listMacroUses, listModules, listPatches, listSwitches, switchNamed, listSuppressions, listSymbols, macroNamed, moduleAt, operandAt, referencesFrom, referencesTo, regionsOverlapping, symbolAt } from "./read.ts";
import { historyAt, historyOfMacro, historyOfSwitch, revision as revisionChanges } from "./history.ts";
import {
  addReference,
  applyBatch,
  Change,
  classifyRegion,
  removeComment,
  removeMacro,
  removeMacroUse,
  removeModule,
  removeOperand,
  removePatch,
  removeReference,
  removeRelease,
  removeSwitch,
  removeSymbol,
  renameSymbol,
  revert,
  setComment,
  setMacro,
  setMacroUse,
  setModule,
  setOperand,
  setPatch,
  setRelease,
  setStartScreen,
  setSwitch,
  removeStartScreen,
  unclassifyRegion,
  type OperandImage,
  type WriteContext,
} from "./write.ts";
import { nth } from "./revisions.testkit.ts";

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
const failsWith = (code: string) => (error: unknown) => error instanceof Refusal && error.code === code;

function count(db: DatabaseSync, sql: string): number {
  return (db.prepare(sql).get() as { n: number }).n;
}

test("a rename creates one revision, and the old name stays in history", () => {
  const db = fresh();
  const first = renameSymbol(db, { origin: "llm", description: "entry point" }, { address: 0x2100, name: "FUN_2100", kind: "routine" });
  assert.equal(first.revision, nth(db, 1));
  assert.deepEqual(first.current, { space: "c64", address: 0x2100, name: "FUN_2100", kind: "routine", origin: "llm", revision: nth(db, 1) });
  const second = renameSymbol(db, { origin: "user", description: "reads joystick 2" }, { address: 0x2100, name: "update_player" });
  assert.equal(second.revision, nth(db, 2));
  assert.equal(second.current.kind, "routine", "the kind stays when not given");
  assert.equal(currentRevision(db), nth(db, 2));
  assert.equal(count(db, "SELECT count(*) AS n FROM symbols WHERE address = 8448"), 2);
  assert.equal(count(db, `SELECT count(*) AS n FROM symbols WHERE address = 8448 AND valid_to_revision = '${nth(db, 2)}'`), 1);
  const revision = db.prepare(`SELECT origin, operation, description FROM revisions WHERE id = '${nth(db, 2)}'`).get();
  assert.deepEqual({ ...revision }, { origin: "user", operation: "rename-symbol", description: "reads joystick 2" });
});

test("a revision records its time in ISO 8601 at the CET offset", () => {
  const db = fresh();
  const before = Date.now();
  renameSymbol(db, llm, { address: 0x1000, name: "start" });
  const { created_at } = db.prepare(`SELECT created_at FROM revisions WHERE id = '${nth(db, 1)}'`).get() as { created_at: string };
  assert.match(created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+01:00$/);
  const recorded = Date.parse(created_at);
  assert.ok(recorded >= before && recorded <= Date.now());
});

test("an unchanged write creates no revision", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x1000, name: "loop", kind: "label" });
  assert.equal(renameSymbol(db, llm, { address: 0x1000, name: "loop" }).revision, null);
  assert.equal(currentRevision(db), nth(db, 1));
});

test("a name used at another address is a conflict and changes nothing", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x1000, name: "loop" });
  assert.throws(() => renameSymbol(db, llm, { address: 0x2000, name: "loop" }), (error: unknown) => {
    assert.ok(failsWith("conflict")(error));
    assert.match((error as Error).message, /\$1000/);
    return true;
  });
  assert.equal(currentRevision(db), nth(db, 1));
  assert.equal(count(db, "SELECT count(*) AS n FROM revisions"), 1);
});

test("a stale expected revision is refused", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x1000, name: "a" });
  renameSymbol(db, llm, { address: 0x1001, name: "b" });
  assert.throws(() => renameSymbol(db, { origin: "llm", expectedRevision: nth(db, 1) }, { address: 0x1002, name: "c" }), failsWith("stale-revision"));
  assert.equal(renameSymbol(db, { origin: "llm", expectedRevision: nth(db, 2) }, { address: 0x1002, name: "c" }).revision, nth(db, 3));
});

test("only the user and the LLM write semantic knowledge", () => {
  const db = fresh();
  assert.throws(() => renameSymbol(db, { origin: "ghidra" } as unknown as WriteContext, { address: 1, name: "x" }), failsWith("invalid-input"));
  assert.throws(() => renameSymbol(db, llm, { address: 1, name: "bad name" }), failsWith("invalid-input"));
  assert.throws(() => renameSymbol(db, llm, { address: 0x10000, name: "x" }), failsWith("invalid-input"));
  assert.equal(currentRevision(db), "0");
});

test("removing a symbol closes it; removing a missing one is not-found", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x1000, name: "loop" });
  assert.equal(removeSymbol(db, llm, { address: 0x1000 }).revision, nth(db, 2));
  assert.equal(symbolAt(db, 0x1000), undefined);
  assert.throws(() => removeSymbol(db, llm, { address: 0x1000 }), failsWith("not-found"));
  // The freed name can be used again.
  renameSymbol(db, llm, { address: 0x3000, name: "loop" });
});

test("a classification inside a region splits it in one revision; current regions never overlap", () => {
  const db = fresh();
  classifyRegion(db, llm, { start: 0x1000, end: 0x1fff, type: "bytes" });
  const split = classifyRegion(db, llm, { start: 0x1400, end: 0x14ff, type: "sprite" });
  assert.equal(split.revision, nth(db, 2));
  assert.deepEqual(
    regionsOverlapping(db, 0, 0xffff).map((region) => [region.start, region.end, region.type, region.revision]),
    [
      [0x1000, 0x13ff, "bytes", nth(db, 2)],
      [0x1400, 0x14ff, "sprite", nth(db, 2)],
      [0x1500, 0x1fff, "bytes", nth(db, 2)],
    ],
  );
  assert.equal(count(db, `SELECT count(*) AS n FROM regions WHERE valid_to_revision = '${nth(db, 2)}'`), 1, "the old region is closed, not deleted");
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
  assert.equal(addReference(db, llm, { from: 0x2100, to: 0x2300, kind: "call" }).revision, nth(db, 1));
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
  const reverted = revert(db, { origin: "user", description: "back to the analyzer view" }, { revision: nth(db, 2) });
  assert.equal(reverted.revision, nth(db, 5));
  assert.equal(symbolAt(db, 0x2100)?.name, "FUN_2100");
  assert.equal(symbolAt(db, 0x2100)?.origin, "llm", "the restored row keeps its origin");
  assert.deepEqual(commentsAt(db, 0x2100), []);
  assert.equal(regionsOverlapping(db, 0x2100, 0x2100).length, 1);
  assert.equal(count(db, "SELECT count(*) AS n FROM revisions"), 5);
  assert.equal(count(db, "SELECT count(*) AS n FROM symbols"), 3, "FUN_2100, update_player, restored FUN_2100");
  // Revert to the empty start, then forward again to revision 4.
  revert(db, llm, { revision: "0" });
  assert.equal(symbolAt(db, 0x2100), undefined);
  revert(db, llm, { revision: nth(db, 4) });
  assert.equal(symbolAt(db, 0x2100)?.name, "update_player");
  assert.equal(commentsAt(db, 0x2100)[0]?.text, "Moves the player.");
  assert.throws(() => revert(db, llm, { revision: "20991231T235959.999-zzzzzz" }), failsWith("not-found"));
});

test("a failure in the middle of a write rolls all of it back", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x1000, name: "loop" });
  // Make the insert of the new row fail after the old row was closed.
  db.exec("CREATE TEMP TRIGGER fail_boom BEFORE INSERT ON symbols WHEN NEW.name = 'boom' BEGIN SELECT RAISE(ABORT, 'boom'); END");
  assert.throws(() => renameSymbol(db, llm, { address: 0x1000, name: "boom" }), /boom/);
  assert.equal(symbolAt(db, 0x1000)?.name, "loop");
  assert.equal(currentRevision(db), nth(db, 1));
  assert.equal(count(db, "SELECT count(*) AS n FROM revisions"), 1);
  db.exec("DROP TRIGGER fail_boom");
});

test("a write over a row of another origin returns the replaced row", () => {
  const db = fresh();
  const user: WriteContext = { origin: "user" };
  renameSymbol(db, user, { address: 0x2100, name: "update_player", kind: "routine" });
  const renamed = renameSymbol(db, llm, { address: 0x2100, name: "move_player" });
  assert.deepEqual(renamed.previous, { space: "c64", address: 0x2100, name: "update_player", kind: "routine", origin: "user", revision: nth(db, 1) });
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
      [0x1000, 0x103f, nth(db, 3)],
      [0x1040, 0x107f, nth(db, 2)],
      [0x1080, 0x10ff, nth(db, 3)],
    ],
  );
});

// Element sizes, batches, evidence and the origin filter.

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
  assert.equal(applied.revision, nth(db, 1));
  assert.equal(applied.steps.length, 4);
  assert.equal(count(db, "SELECT count(*) AS n FROM revisions"), 1);
  assert.equal(symbolAt(db, 0x2100)?.revision, nth(db, 1));

  assert.throws(
    () => applyBatch(db, llm, [{ op: "rename", address: 0x2200, name: "other" }, { op: "remove-symbol", address: 0x2300 }]),
    (error: unknown) => failsWith("not-found")(error) && /^Write 2: /.test((error as Error).message),
  );
  assert.equal(symbolAt(db, 0x2200), undefined, "the first write of the refused batch is gone too");
  assert.equal(currentRevision(db), nth(db, 1));
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
  assert.deepEqual(first.current, { space: "c64", start: 0x0801, file: "boot.asm", title: "BASIC start and setup", origin: "llm", revision: nth(db, 1) });
  assert.equal(setModule(db, llm, { start: 0x0801, file: "boot.asm", title: "BASIC start and setup" }).revision, null);
  setModule(db, { origin: "user" }, { start: 0x2000, file: "player.asm" });
  assert.throws(() => setModule(db, llm, { start: 0x3000, file: "player.asm" }), failsWith("conflict"));
  for (const file of ["../x.asm", "a/b/x.asm", "Music/x.asm", "/x.asm", "x.a", ".asm", "x y.asm", "leftovers/x.asm", "Segments/x.asm", "music/main.asm", "music/Config.asm"]) assert.throws(() => setModule(db, llm, { start: 0x3000, file }), failsWith("invalid-input"), file);
  // c64-source writes these files itself; macOS and Windows ignore the letter case.
  for (const file of ["main.asm", "loader.asm", "switches.asm", "config.asm", "constants.asm", "macros.asm", "start_screen.asm", "Main.asm", "CONSTANTS.asm", "Switches.asm"]) {
    assert.throws(() => setModule(db, llm, { start: 0x3000, file }), (error: unknown) => error instanceof Refusal && error.code === "invalid-input" && /writes main\.asm, loader\.asm, switches\.asm, config\.asm, constants\.asm, macros\.asm, start_screen\.asm in any folder, and the folders leftovers\/, segments\/ itself/.test(error.message), file);
  }
  setModule(db, llm, { start: 0x0801, file: "start.asm" });
  assert.deepEqual(moduleAt(db, 0x0801), { space: "c64", start: 0x0801, file: "start.asm", title: "BASIC start and setup", origin: "llm", revision: nth(db, 3) }, "a write without a title keeps it");
  assert.deepEqual(listModules(db, undefined, ["user"]).map((row) => row.file), ["player.asm"]);
  assert.equal(revisionChanges(db, nth(db, 3)).closed[0]?.entity, "module");

  removeModule(db, llm, { start: 0x2000 });
  assert.throws(() => removeModule(db, llm, { start: 0x2000 }), failsWith("not-found"));
  revert(db, llm, { revision: nth(db, 2) });
  assert.deepEqual(listModules(db).map((row) => [row.start, row.file]), [[0x0801, "boot.asm"], [0x2000, "player.asm"]]);
  applyBatch(db, llm, [{ op: "unmodule", start: 0x2000 }, { op: "module", start: 0x2100, file: "player.asm", title: "Player" }]);
  assert.deepEqual(listModules(db).map((row) => [row.start, row.file]), [[0x0801, "boot.asm"], [0x2100, "player.asm"]]);
  // A module file can be in one folder of the source; the letter case of a file does not make another file.
  setModule(db, llm, { start: 0x3000, file: "music/player.asm" });
  assert.throws(() => setModule(db, llm, { start: 0x3001, file: "music/Player.asm" }), failsWith("conflict"));
});

test("each space has its own rows and names", () => {
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
  assert.deepEqual(listSuppressions(db, undefined, "drive8"), [], "the removal of a name writes no suppression");
  classifyRegion(db, llm, { space: "bank3", start: 0x8000, end: 0x80ff, type: "bytes" });
  assert.deepEqual(regionsOverlapping(db, 0x8000, 0x8000), []);
  assert.throws(() => renameSymbol(db, llm, { space: "bank256", address: 0x8000, name: "x" }), failsWith("invalid-input"));
  assert.throws(() => applyBatch(db, llm, [{ op: "rename", space: "drive9", address: 0x0300, name: "x" }]), failsWith("invalid-input"));
  revert(db, llm, { revision: nth(db, 2) });
  assert.equal(symbolAt(db, 0x0500, "drive8")?.name, "loop", "a revert restores rows of every space");
  assert.equal(symbolAt(db, 0x8000, "bank3"), undefined);
});

test("a name that ACME cannot take as a label is refused at write time", () => {
  const db = fresh();
  for (const name of ["lda", "LDA", "Jmp", "1st", "a-b"]) {
    assert.throws(() => renameSymbol(db, llm, { address: 0x1bc2, name }), failsWith("invalid-input"), name);
  }
  assert.throws(() => renameSymbol(db, llm, { address: 0x1bc2, name: "lda" }), /lda is the name of a 6502 instruction, which ACME cannot read as a label/);
  assert.throws(() => applyBatch(db, llm, [{ op: "rename", address: 0x1bc2, name: "sta" }]), failsWith("invalid-input"));
  assert.equal(symbolAt(db, 0x1bc2), undefined);
  assert.equal(renameSymbol(db, llm, { address: 0x1bc2, name: "load_a" }).current.name, "load_a");
});

test("a revert with a space changes only the rows of that space", () => {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x0500, name: "loop" });
  renameSymbol(db, llm, { space: "bank3", address: 0x8000, name: "cold" });
  classifyRegion(db, llm, { space: "bank3", start: 0x8000, end: 0x80ff, type: "code" });
  renameSymbol(db, llm, { address: 0x0600, name: "later" });
  const reverted = revert(db, llm, { revision: "0", space: "bank3" });
  assert.notEqual(reverted.revision, null);
  assert.equal(symbolAt(db, 0x8000, "bank3"), undefined);
  assert.deepEqual(regionsOverlapping(db, 0x8000, 0x8000, "bank3"), []);
  assert.equal(symbolAt(db, 0x0500)?.name, "loop", "the C64 keeps its rows");
  assert.equal(symbolAt(db, 0x0600)?.name, "later", "also the rows after the restored revision");
  assert.equal(revisionChanges(db, reverted.revision!).revision.restoresSpace, "bank3");
  // A second revert of the same space changes nothing.
  assert.equal(revert(db, llm, { revision: "0", space: "bank3" }).revision, null);
  assert.throws(() => revert(db, llm, { revision: "0", space: "bank256" }), failsWith("invalid-input"));
});

/**
 * $8079 LDA #$c0, $807b STA $0314, $807e LDA #$80, $8a85 LDA $8a97,X,
 * $82aa LDA #$18, $8000 BNE, $8005 NOP, and $9100 LDA #$00 outside the code.
 * VICSCN is a platform name.
 */
function operandImage(): OperandImage {
  const bytes = new Map<number, number>();
  const put = (address: number, ...values: number[]) => values.forEach((value, index) => bytes.set(address + index, value));
  put(0x8079, 0xa9, 0xc0, 0x8d, 0x14, 0x03, 0xa9, 0x80);
  put(0x8a85, 0xbd, 0x97, 0x8a);
  put(0x82aa, 0xa9, 0x18);
  put(0x8000, 0xd0, 0x05);
  put(0x8005, 0xea);
  put(0x9100, 0xa9, 0x00);
  return { byteAt: (address) => bytes.get(address), platform: new Map([["VICSCN", 0x0400], ["CINV", 0x0314]]) };
}

/** The code regions of the operand image, as one revision: an operand expression is for an instruction of a code region. */
function classifyCode(db: DatabaseSync): void {
  const code = (start: number, end: number) => ({ op: "classify" as const, start, end, type: "code" as const });
  applyBatch(db, llm, [code(0x8000, 0x8001), code(0x8005, 0x8005), code(0x8079, 0x807f), code(0x82aa, 0x82ab), code(0x8a85, 0x8a87)]);
}

function operands(): { db: DatabaseSync; context: WriteContext } {
  const db = fresh();
  renameSymbol(db, llm, { address: 0x80c0, name: "irq_handler" });
  renameSymbol(db, llm, { address: 0x8a98, name: "bar_colours" });
  renameSymbol(db, llm, { address: 0x2000, name: "charset" });
  classifyCode(db);
  return { db, context: { origin: "llm", image: () => operandImage() } };
}

test("an operand expression is checked against the image and writes pointer references", () => {
  const { db, context } = operands();
  const lo = setOperand(db, context, { address: 0x8079, select: "lo", symbol: "irq_handler" });
  assert.deepEqual(lo.current, { space: "c64", address: 0x8079, select: "lo", symbol: "irq_handler", offset: 0, origin: "llm", revision: nth(db, 5) });
  setOperand(db, context, { address: 0x807e, select: "hi", symbol: "irq_handler" });
  setOperand(db, context, { address: 0x8a85, select: "value", symbol: "bar_colours", offset: -1 });
  setOperand(db, context, { address: 0x807b, select: "value", symbol: "CINV" });
  setOperand(db, context, { address: 0x82aa, select: "expr", expression: " ((VICSCN & $3c00) >> 6) | ((charset & $3800) >> 10) " });
  assert.equal(operandAt(db, 0x82aa)?.expression, "((VICSCN & $3c00) >> 6) | ((charset & $3800) >> 10)", "the text is trimmed");
  assert.deepEqual(referencesTo(db, 0x80c0).map((row) => [row.from, row.kind]), [[0x8079, "pointer"], [0x807e, "pointer"]]);
  assert.deepEqual(referencesFrom(db, 0x82aa).map((row) => [row.to, row.kind]), [[0x0400, "pointer"], [0x2000, "pointer"]]);
  assert.equal(at(db, 0x8a85).operand?.offset, -1);
  assert.equal(setOperand(db, context, { address: 0x8079, select: "lo", symbol: "irq_handler" }).revision, null, "no change, no revision");
  assert.deepEqual(historyAt(db, 0x8079).map((entry) => entry.entity), ["region", "reference", "operand"]);
});

test("an operand expression that does not give the operand in the image is refused with both values", () => {
  const { db, context } = operands();
  assert.throws(() => setOperand(db, context, { address: 0x8079, select: "hi", symbol: "irq_handler" }), /At \$8079, >irq_handler gives \$80, but the operand in the image is \$c0\./);
  assert.throws(() => setOperand(db, context, { address: 0x8a85, select: "value", symbol: "bar_colours" }), /gives \$8a98, but the operand in the image is \$8a97/);
  assert.throws(() => setOperand(db, context, { address: 0x8079, select: "lo", symbol: "nowhere" }), /nowhere is not a symbol of the knowledge or a platform name. Give a number, a symbol of the project knowledge, or a platform name of the C64 memory map\./);
  assert.throws(() => setOperand(db, context, { address: 0x8000, select: "expr", expression: "5" }), /is a branch/);
  assert.throws(() => setOperand(db, context, { address: 0x8005, select: "expr", expression: "5" }), /has no operand/);
  assert.throws(() => setOperand(db, context, { address: 0x8a85, select: "lo", symbol: "bar_colours" }), /lo and hi give one byte/);
  assert.throws(() => setOperand(db, context, { address: 0x9000, select: "lo", symbol: "bar_colours" }), /outside the image/);
  assert.throws(() => setOperand(db, llm, { address: 0x8079, select: "lo", symbol: "irq_handler" }), /no image was given/);
  assert.throws(() => setOperand(db, context, { address: 0x8079, select: "expr", expression: "<irq_handler", offset: 1 }), failsWith("invalid-input"));
  assert.throws(() => setOperand(db, context, { address: 0x8079, select: "expr", expression: "<irq_handler +" }), failsWith("invalid-input"));
  assert.throws(() => setOperand(db, context, { address: 0x8079, select: "lo" }), failsWith("invalid-input"));
  assert.throws(() => addReference(db, llm, { from: 0x8079, to: 0x80c0, kind: "pointer" }), /Only an operand expression writes a pointer reference/);
  assert.equal(currentRevision(db), nth(db, 4), "a refused write leaves no revision");
});

test("an operand expression is refused at an address that is not the start of an instruction of a code region", () => {
  const { db, context } = operands();
  // $807a is the operand byte of LDA #$c0 at $8079: its value is $c0 too.
  assert.throws(
    () => setOperand(db, context, { address: 0x807a, select: "expr", expression: "$c0" }),
    (error: unknown) => error instanceof Refusal && error.code === "invalid-input" && /^\$807a is not the start of an instruction. It is an operand byte of the instruction at \$8079, decoded from the start of the code region at \$8079\. Give \$8079\.$/.test(error.message),
  );
  assert.throws(() => setOperand(db, context, { address: 0x9100, select: "expr", expression: "0" }), /^Refusal: \$9100 is in no code region, so the knowledge does not know an instruction that starts there\. Classify the code/);
  assert.throws(() => applyBatch(db, context, [{ op: "operand", address: 0x807f, select: "expr", expression: "$80" }]), /\$807f is not the start of an instruction. It is an operand byte of the instruction at \$807e/);
  assert.equal(currentRevision(db), nth(db, 4), "a refused write leaves no revision");
});

test("a rename of a symbol follows into operand expressions, and a removal is refused while one uses it", () => {
  const { db, context } = operands();
  setOperand(db, context, { address: 0x8079, select: "lo", symbol: "irq_handler" });
  setOperand(db, { ...context, origin: "user" }, { address: 0x82aa, select: "expr", expression: "((VICSCN & $3c00) >> 6) | ((charset & $3800) >> 10)" });
  renameSymbol(db, llm, { address: 0x80c0, name: "irq" });
  renameSymbol(db, llm, { address: 0x2000, name: "font" });
  assert.equal(operandAt(db, 0x8079)?.symbol, "irq");
  assert.equal(operandAt(db, 0x82aa)?.expression, "((VICSCN & $3c00) >> 6) | ((font & $3800) >> 10)");
  assert.equal(operandAt(db, 0x82aa)?.origin, "user", "the row keeps its origin");
  assert.throws(() => removeSymbol(db, llm, { address: 0x80c0 }), /The operand expressions at \$8079 use irq\./);
  removeOperand(db, llm, { address: 0x8079 });
  assert.deepEqual(referencesFrom(db, 0x8079), [], "the pointer references go with the operand");
  removeSymbol(db, llm, { address: 0x80c0 });
  assert.throws(() => removeOperand(db, llm, { address: 0x8079 }), failsWith("not-found"));
});

test("a batch writes symbols and the operands that use them, and a revert restores operands", () => {
  const db = fresh();
  classifyCode(db);
  const context: WriteContext = { origin: "llm", image: () => operandImage() };
  const applied = applyBatch(db, context, [
    { op: "rename", address: 0x80c0, name: "irq_handler" },
    { op: "operand", address: 0x8079, select: "lo", symbol: "irq_handler" },
    { op: "operand", address: 0x807e, select: "hi", symbol: "irq_handler" },
  ]);
  assert.equal(applied.revision, nth(db, 2));
  assert.deepEqual(revisionChanges(db, nth(db, 2)).added.map((entry) => entry.entity), ["symbol", "reference", "reference", "operand", "operand"]);
  applyBatch(db, context, [{ op: "unoperand", address: 0x807e }]);
  assert.equal(operandAt(db, 0x807e), undefined);
  revert(db, llm, { revision: nth(db, 2) });
  assert.equal(operandAt(db, 0x807e)?.select, "hi");
  assert.deepEqual(referencesFrom(db, 0x807e).map((row) => row.kind), ["pointer"]);
  assert.throws(() => applyBatch(db, llm, [{ op: "operand", address: 0x8079, select: "hi", symbol: "irq_handler" }]), /Write 1: An operand expression is checked against the image/);
});

test("a write of a batch is checked against the image of its own space", () => {
  const db = fresh();
  const asked: string[] = [];
  const context: WriteContext = { origin: "llm", image: (space) => (asked.push(space), operandImage()) };
  applyBatch(db, context, [
    { op: "classify", start: 0x8079, end: 0x807f, type: "code", space: "bank1" },
    { op: "rename", address: 0x80c0, name: "irq_handler", space: "bank1" },
    { op: "operand", address: 0x8079, select: "lo", symbol: "irq_handler", space: "bank1" },
  ]);
  assert.deepEqual(asked, ["bank1"]);
  assert.equal(operandAt(db, 0x8079, "bank1")?.symbol, "irq_handler");
});

/**
 * The operand image, and $8100 INC $fb, BNE +2, INC $fc; $8106 INC $fd, BNE
 * +2, INC $fe; $8110 LDA $0400.
 */
function sourceImage(): OperandImage {
  const image = operandImage();
  const bytes = new Map<number, number>();
  const put = (address: number, ...values: number[]) => values.forEach((value, index) => bytes.set(address + index, value));
  put(0x8100, 0xe6, 0xfb, 0xd0, 0x02, 0xe6, 0xfc, 0xe6, 0xfd, 0xd0, 0x02, 0xe6, 0xfe);
  put(0x8110, 0xad, 0x00, 0x04);
  return { byteAt: (address) => bytes.get(address) ?? image.byteAt(address), platform: image.platform };
}

/** The base release ORIGINAL, and a change switch for each name, off by default and off in ORIGINAL. */
function withSwitches(db: DatabaseSync, image: (space: string) => OperandImage, ...names: string[]): void {
  setRelease(db, { origin: "user" }, { label: "ORIGINAL", base: true });
  for (const name of names) setSwitch(db, { origin: "user", image }, { name, kind: "change", default: 0 });
}

test("a patch puts code in a range of the image under a switch", () => {
  const db = fresh();
  const context: WriteContext = { origin: "llm", image: () => sourceImage() };
  withSwitches(db, context.image!, "CRACK", "TRAINER");
  assert.throws(() => setPatch(db, context, { start: 0x8079, end: 0x807d, switch: "CHEAT", code: "" }), /There is no switch CHEAT\. Write it first/);
  const first = setPatch(db, context, { start: 0x8079, end: 0x807d, switch: "CRACK", code: "  lda #0\n  rts  \n", comment: "Skips the check." });
  assert.deepEqual(first.current, { space: "c64", start: 0x8079, end: 0x807d, switch: "CRACK", code: "  lda #0\n  rts", comment: "Skips the check.", origin: "llm", revision: nth(db, 4) });
  assert.equal(setPatch(db, context, { start: 0x8079, end: 0x807d, switch: "CRACK", code: "  lda #0\n  rts" }).revision, null, "the same patch, no revision; the comment stays");
  setPatch(db, { ...context, origin: "user" }, { start: 0x807e, end: 0x807f, switch: "CRACK", code: "" });
  assert.deepEqual(listPatches(db, undefined, "CRACK").map((row) => [row.start, row.end, row.code]), [[0x8079, 0x807d, "  lda #0\n  rts"], [0x807e, 0x807f, ""]]);
  assert.equal(at(db, 0x807b).patch?.start, 0x8079, "at gives the patch that holds the address");
  assert.deepEqual(historyAt(db, 0x807c).map((entry) => entry.entity), ["patch"]);

  assert.throws(() => setPatch(db, llm, { start: 0x8079, end: 0x807d, switch: "CRACK", code: "" }), /no image was given/);
  assert.throws(() => setPatch(db, context, { start: 0x9000, end: 0x9001, switch: "CRACK", code: "" }), /\$9000 is outside the image/);
  assert.throws(() => setPatch(db, context, { start: 0x807c, end: 0x807e, switch: "TRAINER", code: "" }), /overlaps the patch of CRACK at \$8079-\$807d/);
  for (const name of ["crack", "C", "1UP", "CRACK-1"]) assert.throws(() => setPatch(db, context, { start: 0x8a85, end: 0x8a87, switch: name, code: "" }), failsWith("invalid-input"), name);
  assert.throws(() => renameSymbol(db, llm, { address: 0x2001, name: "CRACK" }), /CRACK is the name of a switch/);
  // c64-source writes the code inside { }: braces must pair, except in comments and strings.
  for (const code of ["!if X {", "}"]) assert.throws(() => setPatch(db, context, { start: 0x8a85, end: 0x8a87, switch: "TRAINER", code }), /The patch code has a/, code);
  for (const code of ["lda #0 ; }", 'lda #"{"', "!if X { nop }"]) setPatch(db, context, { start: 0x8a85, end: 0x8a87, switch: "TRAINER", code });
  // Code whose length the lines give is refused when it is longer than the range; other code is checked by the build of the switch.
  assert.throws(
    () => setPatch(db, context, { start: 0x8a85, end: 0x8a87, switch: "TRAINER", code: "lda #$01\nlda #$02\nlda #$03\nlda #$04" }),
    (error: unknown) => error instanceof Refusal && error.code === "invalid-input" && error.message === "The patch code is at least 8 bytes, and the range $8a85-$8a87 has 3. Make the code shorter, or make the range larger.",
  );
  assert.throws(() => setPatch(db, context, { start: 0x8a85, end: 0x8a87, switch: "TRAINER", code: "!byte $ea, $ea\n!word $1234" }), /at least 4 bytes/);
  for (const code of ["!fill 3, $ea", "nop\nasl a\nrts ; done", "jsr $1234", "+inc16 ptr\nlda #1\nlda #2", "loop lda #1\nlda #2"]) setPatch(db, context, { start: 0x8a85, end: 0x8a87, switch: "TRAINER", code });

  removePatch(db, llm, { start: 0x807e });
  assert.throws(() => removePatch(db, llm, { start: 0x807e }), failsWith("not-found"));
  revert(db, llm, { revision: nth(db, 5) });
  assert.deepEqual(listPatches(db).map((row) => row.start), [0x8079, 0x807e], "a revert restores patches");
});

test("a switch has a kind, a default and the releases that have it on; the base release decides the state of the program", () => {
  const db = fresh();
  const image = sourceImage();
  const context: WriteContext = { origin: "llm", image: () => image };
  assert.throws(() => setSwitch(db, context, { name: "PROTECTION", kind: "protection" }), /no base release/);
  setRelease(db, llm, { label: "ORIGINAL", base: true, comment: "Uncracked." });
  setRelease(db, llm, { label: "V2", rows: new Map([[0x1000, "a9"]]) });
  assert.throws(() => setRelease(db, llm, { label: "V2", base: true }), /The release ORIGINAL is the base release/);
  for (const label of ["v2", "V", "2V"]) assert.throws(() => setRelease(db, llm, { label, rows: new Map([[0x1000, "a9"]]) }), failsWith("invalid-input"), label);

  // The kinds give the default: the default build is the clean program with every fix.
  const protection = setSwitch(db, context, { name: "PROTECTION", kind: "protection", releases: ["ORIGINAL"], comment: "The disk check." });
  assert.deepEqual(protection.current, { space: "c64", name: "PROTECTION", kind: "protection", default: 0, releases: ["ORIGINAL"], comment: "The disk check.", origin: "llm", revision: nth(db, 3) });
  assert.equal(setSwitch(db, context, { name: "FIX_LIVES", kind: "fix", releases: ["V2"] }).current.default, 1);
  assert.equal(setSwitch(db, context, { name: "FIX_LIVES", kind: "fix" }).revision, null, "a write without releases keeps them");
  for (const kind of ["protection", "trainer", "cheat", "crack"] as const) assert.throws(() => setSwitch(db, context, { name: "OTHER", kind, default: 1 }), /off in the default build/, kind);
  assert.throws(() => setSwitch(db, context, { name: "OTHER", kind: "change" }), /needs a default/);
  assert.throws(() => setSwitch(db, context, { name: "OTHER", kind: "fix", releases: ["V3"] }), /There is no release V3/);
  assert.throws(() => setSwitch(db, context, { name: "RELEASE_V2", kind: "fix" }), /does not start with RELEASE_/);
  assert.throws(() => setSwitch(db, context, { name: "VICSCN", kind: "fix" }), /is a C64 platform name/);
  renameSymbol(db, llm, { address: 0x2000, name: "LIVES" });
  assert.throws(() => setSwitch(db, context, { name: "LIVES", kind: "fix" }), /is the name of the symbol at \$2000/);
  assert.throws(() => renameSymbol(db, llm, { address: 0x2001, name: "RELEASE_V2" }), /RELEASE_V2 builds the release V2/);
  assert.deepEqual(listSwitches(db).map((row) => [row.name, row.default]), [["FIX_LIVES", 1], ["PROTECTION", 0]]);

  // A patch holds the state that the base release does not have: that state cannot change under it.
  setPatch(db, context, { start: 0x8079, end: 0x807b, switch: "PROTECTION", code: "!fill 3, $ea", comment: "No check." });
  assert.throws(() => setSwitch(db, context, { name: "PROTECTION", kind: "protection", releases: [] }), /changes whether the base release ORIGINAL has it on/);
  assert.equal(setSwitch(db, context, { name: "PROTECTION", kind: "protection", releases: ["ORIGINAL", "V2"] }).current.releases.join(), "ORIGINAL,V2", "V2 has it on too: the base value stays");
  assert.throws(() => removeSwitch(db, llm, { name: "PROTECTION" }), /has patches at \$8079/);
  assert.throws(() => removeRelease(db, llm, { label: "V2" }), /is named by the switches FIX_LIVES, PROTECTION/);
  assert.throws(() => removeRelease(db, llm, { label: "ORIGINAL" }), /decides the state of the program for the switches/);
  assert.throws(() => setRelease(db, llm, { label: "ORIGINAL", rows: new Map([[0x1000, "a9"]]), base: false }), /Remove them first \(unswitch\) to change the base release/);
  assert.equal(switchNamed(db, "PROTECTION")?.comment, "The disk check.", "a write without a comment keeps it");
  assert.deepEqual(historyOfSwitch(db, "PROTECTION").map((entry) => entry.entity), ["switch", "patch", "switch"]);

  removePatch(db, llm, { start: 0x8079 });
  removeSwitch(db, llm, { name: "PROTECTION" });
  assert.throws(() => removeSwitch(db, llm, { name: "PROTECTION" }), failsWith("not-found"));
  revert(db, llm, { revision: nth(db, 3) });
  assert.deepEqual(listSwitches(db).map((row) => row.name), ["PROTECTION"], "a revert restores switches");
});
test("a start screen is one per space, of the VIC-II rules, and it reserves START_SCREEN", () => {
  const db = fresh();
  const koala = { mode: "multicolour", screen: 0x5c00, bitmap: 0x6000, colours: 0x7f40, border: 0, background: 6 } as const;
  const first = setStartScreen(db, llm, { ...koala, comment: "The loading picture." });
  assert.deepEqual(first.current, { space: "c64", ...koala, comment: "The loading picture.", origin: "llm", revision: nth(db, 1) });
  assert.equal(setStartScreen(db, llm, koala).revision, null, "the same start screen writes nothing, and a write without a comment keeps it");
  const text = setStartScreen(db, { origin: "user" }, { mode: "text", screen: 0x0400, charset: 0x1000, colour: 14, border: 14, background: 6 });
  assert.equal(text.current.mode, "text", "a write replaces the start screen");
  assert.equal(text.previous?.mode, "multicolour");
  assert.equal(setStartScreen(db, { origin: "user" }, { mode: "hires", screen: 0xc000, bitmap: 0xe000, border: 0, background: 0 }).current.bitmap, 0xe000);

  const refused: Array<[string, Parameters<typeof setStartScreen>[2], RegExp]> = [
    ["a text screen needs a charset", { mode: "text", screen: 0x0400, colour: 1, border: 0, background: 0 }, /has a charset and no bitmap/],
    ["a bitmap needs a bitmap", { mode: "hires", screen: 0x4400, border: 0, background: 0 }, /has a bitmap and no charset/],
    ["hires has no colour RAM", { mode: "hires", screen: 0x4400, bitmap: 0x6000, colour: 1, border: 0, background: 0 }, /does not use the colour RAM/],
    ["multicolour needs the colour RAM", { mode: "multicolour", screen: 0x5c00, bitmap: 0x6000, border: 0, background: 0 }, /uses the colour RAM/],
    ["not both colour forms", { ...koala, colour: 1 }, /not both/],
    ["the screen at a 1K step", { ...koala, screen: 0x5c01 }, /only at a step of \$400/],
    ["the bitmap at an 8K step", { ...koala, bitmap: 0x5000 }, /only at a step of \$2000/],
    ["one VIC bank", { ...koala, bitmap: 0xa000 }, /not in the VIC bank of the screen/],
    ["a screen on the character ROM", { mode: "text", screen: 0x1400, charset: 0x1800, colour: 1, border: 0, background: 0 }, /reads the character ROM/],
    ["a bitmap on the character ROM", { mode: "hires", screen: 0x8400, bitmap: 0x8000, border: 0, background: 0 }, /reads the character ROM/],
    ["pages 0-3", { mode: "text", screen: 0x0000, charset: 0x1000, colour: 1, border: 0, background: 0 }, /in pages 0-3/],
    ["the colours under the I/O area", { ...koala, colours: 0xd800 }, /\$d000-\$dfff/],
    ["a colour from 0 to 15", { ...koala, border: 16 }, /from 0 to 15/],
    ["only the space c64", { ...koala, space: "drive8" }, /only in the space c64/],
  ];
  for (const [what, request, message] of refused) assert.throws(() => setStartScreen(db, llm, request), message, what);

  assert.throws(() => renameSymbol(db, llm, { address: 0x2000, name: "START_SCREEN" }), /switch of the start screen/);
  assert.throws(() => setSwitch(db, { origin: "llm", image: () => sourceImage() }, { name: "START_SCREEN", kind: "fix" }), /switch of the start screen/);
  assert.throws(() => renameSymbol(db, llm, { address: 0x2000, name: "LEFTOVERS" }), /switch of the leftovers/);
  assert.throws(() => setSwitch(db, { origin: "llm", image: () => sourceImage() }, { name: "LEFTOVERS", kind: "fix" }), /switch of the leftovers/);

  removeStartScreen(db, llm, {});
  assert.equal(currentStartScreen(db), undefined);
  assert.throws(() => removeStartScreen(db, llm, {}), failsWith("not-found"));
  revert(db, llm, { revision: nth(db, 1) });
  assert.equal(currentStartScreen(db)?.bitmap, 0x6000, "a revert restores the start screen");
  assert.deepEqual(revisionChanges(db, nth(db, 2)).added.map((entry) => entry.entity), ["start-screen"]);
});

test("a start screen of a stage has its bytes and its call in the program of that space", () => {
  const db = fresh();
  const koala = { mode: "multicolour", screen: 0xcc00, bitmap: 0xe000, colours: 0x8328, border: 3, background: 1 } as const;
  assert.throws(() => setStartScreen(db, llm, { ...koala, stage: "bank1" }), /no program in bank1\. Capture the stage/);
  setImage(db, llm, { space: "bank1", segments: [{ start: 0x8328, end: 0x870f }, { start: 0x9000, end: 0x910f }, { start: 0xcc00, end: 0xcfe7 }, { start: 0xe000, end: 0xff3f }], byteAt: () => 0 });
  const recorded = setStartScreen(db, llm, { ...koala, stage: "bank1", call: 0x9000 });
  assert.deepEqual(recorded.current, { space: "c64", ...koala, stage: "bank1", call: 0x9000, origin: "llm", revision: nth(db, 2) });
  assert.equal(currentStartScreen(db)?.stage, "bank1");
  assert.throws(() => setStartScreen(db, llm, { ...koala, stage: "bank1", screen: 0xc800 }), /The screen at \$c800-\$cbe7 is not in the program in bank1/);
  assert.throws(() => setStartScreen(db, llm, { ...koala, stage: "bank1", call: 0x9200 }), /The call \$9200 is not in the program in bank1/);
  assert.throws(() => setStartScreen(db, llm, { ...koala, call: 0x9000 }), /give --stage too/);
  assert.throws(() => setStartScreen(db, llm, { ...koala, stage: "c64" }), /another space than c64/);
  // The colours from the colour RAM of the capture: only for a stage, and in place of --colours and --colour.
  const { colours: _colours, ...picture } = koala;
  assert.equal(setStartScreen(db, llm, { ...picture, stage: "bank1", colourRam: true }).current.colourRam, true);
  assert.equal(currentStartScreen(db)?.colours, undefined);
  assert.throws(() => setStartScreen(db, llm, { ...picture, colourRam: true }), /only for a start screen of a stage/);
  assert.throws(() => setStartScreen(db, llm, { ...koala, stage: "bank1", colourRam: true }), /do not give --colours or --colour too/);
  assert.throws(() => setStartScreen(db, llm, { ...picture, mode: "hires", stage: "bank1", colourRam: true }), /does not use the colour RAM/);
});

test("a macro and its uses: the use is whole instructions, its args are known names, and a rename follows", () => {
  const db = fresh();
  const context: WriteContext = { origin: "llm", image: () => sourceImage() };
  renameSymbol(db, llm, { address: 0x00fb, name: "ptr" });
  const macro = setMacro(db, llm, { name: "inc16", params: ["dst"], body: "inc .dst\nbne +\ninc .dst+1\n+\n", comment: "Adds 1 to a 16-bit value." });
  assert.deepEqual(macro.current, { space: "c64", name: "inc16", params: ["dst"], body: "inc .dst\nbne +\ninc .dst+1\n+", comment: "Adds 1 to a 16-bit value.", origin: "llm", revision: nth(db, 2) });
  const use = setMacroUse(db, context, { start: 0x8100, end: 0x8105, macro: "inc16", args: [" ptr "] });
  assert.deepEqual(use.current, { space: "c64", start: 0x8100, end: 0x8105, macro: "inc16", args: ["ptr"], origin: "llm", revision: nth(db, 3) });
  setMacroUse(db, context, { start: 0x8106, end: 0x810b, macro: "inc16", args: ["ptr+2"] });
  assert.equal(at(db, 0x8102).macroUse?.start, 0x8100);

  assert.throws(() => setMacroUse(db, context, { start: 0x8100, end: 0x8104, macro: "inc16", args: ["ptr"] }), /end at \$8105, not at \$8104/);
  assert.throws(() => setMacroUse(db, context, { start: 0x8110, end: 0x8112, macro: "inc16", args: [] }), /has 1 params \(dst\), and the use gives 0 args/);
  assert.throws(() => setMacroUse(db, context, { start: 0x8110, end: 0x8112, macro: "inc16", args: ["nowhere"] }), /nowhere is not a symbol of the knowledge or a platform name/);
  assert.throws(() => setMacroUse(db, context, { start: 0x8110, end: 0x8112, macro: "add16", args: [] }), failsWith("not-found"));
  assert.throws(() => setMacroUse(db, context, { start: 0x8104, end: 0x8109, macro: "inc16", args: ["ptr"] }), /overlaps the use of inc16 at \$8100-\$8105/);
  withSwitches(db, context.image!, "DEBUG");
  setPatch(db, context, { start: 0x8110, end: 0x8112, switch: "DEBUG", code: "" });
  assert.throws(() => setMacroUse(db, context, { start: 0x8110, end: 0x8112, macro: "inc16", args: ["VICSCN"] }), /overlaps the patch of DEBUG/);
  assert.throws(() => setPatch(db, context, { start: 0x8104, end: 0x8105, switch: "DEBUG", code: "" }), /overlaps the use of the macro inc16 at \$8100-\$8105/);

  for (const request of [{ name: "1x", body: "nop" }, { name: "m", params: [".dst"], body: "nop" }, { name: "m", params: ["a", "a"], body: "nop" }, { name: "m", body: " " }, { name: "m", body: "nop }" }]) {
    assert.throws(() => setMacro(db, llm, request), failsWith("invalid-input"), JSON.stringify(request));
  }
  assert.throws(() => setMacro(db, llm, { name: "inc16", params: ["dst", "by"], body: "nop" }), /its uses at \$8100, \$8106 give that many args/);
  setMacro(db, { origin: "user" }, { name: "inc16", params: ["target"], body: "inc .target\nbne +\ninc .target+1\n+" });
  assert.equal(macroNamed(db, "inc16")?.comment, "Adds 1 to a 16-bit value.", "a write without a comment keeps it");
  assert.throws(() => removeMacro(db, llm, { name: "inc16" }), /has uses at \$8100, \$8106/);

  renameSymbol(db, llm, { address: 0x00fb, name: "zp_pointer" });
  assert.deepEqual(listMacroUses(db).map((row) => row.args), [["zp_pointer"], ["zp_pointer+2"]], "a rename follows into the args");
  assert.throws(() => removeSymbol(db, llm, { address: 0x00fb }), /The macro uses at \$8100, \$8106 use zp_pointer/);
  removeMacroUse(db, llm, { start: 0x8100 });
  removeMacroUse(db, llm, { start: 0x8106 });
  assert.throws(() => removeMacroUse(db, llm, { start: 0x8106 }), failsWith("not-found"));
  removeMacro(db, llm, { name: "inc16" });
  // Two macro rows (the rewrite closed the first) and four use rows (the rename closed the first two), all closed now.
  const history = historyOfMacro(db, "inc16");
  assert.deepEqual([history.filter((entry) => entry.entity === "macro").length, history.filter((entry) => entry.entity === "macro-use").length], [2, 4]);
  assert.ok(history.every((entry) => entry.to !== undefined));
});

test("a batch writes a macro and its uses in one revision, and a revert restores them", () => {
  const db = fresh();
  const context: WriteContext = { origin: "llm", image: () => sourceImage() };
  withSwitches(db, context.image!, "DEBUG");
  const applied = applyBatch(db, context, [
    { op: "macro", name: "inc16", params: ["dst"], body: "inc .dst\nbne +\ninc .dst+1\n+" },
    { op: "use", start: 0x8100, end: 0x8105, macro: "inc16", args: ["$fb"] },
    { op: "patch", start: 0x8110, end: 0x8112, switch: "DEBUG", code: "jsr $ffd2" },
  ]);
  assert.deepEqual(revisionChanges(db, applied.revision!).added.map((entry) => entry.entity), ["patch", "macro", "macro-use"]);
  applyBatch(db, context, [{ op: "unuse", start: 0x8100 }, { op: "unmacro", name: "inc16" }, { op: "unpatch", start: 0x8110 }]);
  assert.equal(macroNamed(db, "inc16"), undefined);
  revert(db, llm, { revision: applied.revision! });
  assert.deepEqual(listMacroUses(db).map((row) => [row.start, row.macro, row.args]), [[0x8100, "inc16", ["$fb"]]]);
  assert.equal(listPatches(db)[0]?.code, "jsr $ffd2");
  assert.throws(() => applyBatch(db, llm, [{ op: "use", start: 0x8106, end: 0x810b, macro: "inc16", args: ["$fd"] }]), /Write 1: A macro use is checked against the image/);
});

/** Rows of an analyzer, as an import of it writes them: one revision of `origin`. */
function analyzerRows(db: DatabaseSync, origin: "dxa" | "ghidra", work: (change: Change) => void): void {
  transaction(db, () => work(new Change(db, { origin }, "import")));
}

test("a user or LLM write that confirms a row of an analyzer makes it a row of the writer, with the analyzer row as previous", () => {
  const db = fresh();
  const user: WriteContext = { origin: "user" };
  analyzerRows(db, "ghidra", (change) => {
    change.insertReference({ space: "c64", from: 0x1bc9, to: 0x0104, kind: "read", origin: "ghidra" });
    change.insertSymbol({ space: "c64", address: 0x1bc2, name: "main_loop", kind: "label", origin: "ghidra" });
    change.insertComment({ space: "c64", address: 0x1bc2, placement: "side", text: "the loop", origin: "ghidra" });
  });
  analyzerRows(db, "dxa", (change) => change.insertRegion({ space: "c64", start: 0x1bc2, end: 0x1bff, type: "code", origin: "dxa" }));
  const before = currentRevision(db);

  const reference = addReference(db, user, { from: 0x1bc9, to: 0x0104, kind: "read" });
  assert.notEqual(reference.revision, null);
  assert.equal(reference.current.origin, "user");
  assert.equal(reference.previous?.origin, "ghidra");
  assert.deepEqual(referencesFrom(db, 0x1bc9).map((row) => row.origin), ["user"], "one reference, of the user");

  const named = renameSymbol(db, llm, { address: 0x1bc2, name: "main_loop", kind: "label" });
  assert.deepEqual([named.current.origin, named.previous?.origin], ["llm", "ghidra"]);
  const commented = setComment(db, llm, { address: 0x1bc2, placement: "side", text: "the loop" });
  assert.deepEqual([commented.current.origin, commented.previous?.origin], ["llm", "ghidra"]);
  const classified = classifyRegion(db, llm, { start: 0x1bc2, end: 0x1bff, type: "code" });
  assert.deepEqual([classified.current.map((row) => row.origin), classified.previous?.map((row) => row.origin)], [["llm"], ["dxa"]]);
  assert.notEqual(currentRevision(db), before);

  // The LLM over the user is no decision: nothing changes. The user over the LLM is one.
  assert.equal(addReference(db, llm, { from: 0x1bc9, to: 0x0104, kind: "read" }).revision, null);
  assert.equal(addReference(db, user, { from: 0x1bc9, to: 0x0104, kind: "read" }).revision, null, "the same origin changes nothing");
  const confirmed = renameSymbol(db, user, { address: 0x1bc2, name: "main_loop" });
  assert.deepEqual([confirmed.current.origin, confirmed.previous?.origin], ["user", "llm"]);
  assert.equal(renameSymbol(db, llm, { address: 0x1bc2, name: "main_loop" }).revision, null);
  // In a batch too, and the batch gives the replaced rows.
  const batch = applyBatch(db, user, [{ op: "comment", address: 0x1bc2, placement: "side", text: "the loop" }, { op: "classify", start: 0x1bc2, end: 0x1bff, type: "code" }]);
  assert.deepEqual(batch.steps.map((step) => (Array.isArray(step.previous) ? step.previous.map((row) => row.origin) : (step.previous as { origin: string } | undefined)?.origin)), ["llm", ["llm"]]);
});

/** A program in the knowledge: $1bc2 LDA #$03, $1bc4 STA $0104, $1bc7 RTS, then data $1bc8-$1bcf; $1bc2-$1bc7 is code. */
function programWithCode(): DatabaseSync {
  const db = fresh();
  const bytes = [0xa9, 0x03, 0x8d, 0x04, 0x01, 0x60, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07];
  setImage(db, llm, { segments: [{ start: 0x1bc2, end: 0x1bc2 + bytes.length - 1 }], byteAt: (address) => bytes[address - 0x1bc2]! });
  classifyRegion(db, llm, { start: 0x1bc2, end: 0x1bc7, type: "code" });
  classifyRegion(db, llm, { start: 0x1bc8, end: 0x1bcf, type: "bytes" });
  return db;
}

test("a module and a comment start at an instruction: an operand byte of a code region is refused, as for an operand", () => {
  const db = programWithCode();
  const before = currentRevision(db);
  const inside = (error: unknown) => error instanceof Refusal && error.code === "invalid-input" && /^\$1bc3 is not the start of an instruction\. It is an operand byte of the instruction at \$1bc2, decoded from the start of the code region at \$1bc2\. A (module|comment) is at the start of an instruction, as the listing and the source show it\. Give \$1bc2\.$/.test(error.message);
  assert.throws(() => setModule(db, llm, { start: 0x1bc3, file: "mid_module.asm" }), inside);
  assert.throws(() => setComment(db, llm, { address: 0x1bc3, placement: "side", text: "inside" }), inside);
  assert.throws(() => setComment(db, llm, { address: 0x1bc6 - 1, placement: "line", text: "inside" }), /\$1bc5 is not the start of an instruction\. It is an operand byte of the instruction at \$1bc4/);
  assert.throws(() => applyBatch(db, llm, [{ op: "module", start: 0x1bc3, file: "mid_module.asm" }]), /^Refusal: Write 1: \$1bc3 is not the start of an instruction/);
  assert.equal(currentRevision(db), before, "a refused write leaves no revision");
  // At an instruction, in data, and where the knowledge has no program, they are written.
  for (const address of [0x1bc2, 0x1bc4, 0x1bc9, 0x2000]) assert.notEqual(setComment(db, llm, { address, placement: "side", text: "here" }).revision, null, formatAddress(address));
  assert.notEqual(setModule(db, llm, { start: 0x1bc4, file: "store.asm" }).revision, null);
  assert.notEqual(setModule(db, llm, { start: 0x1bca, file: "table.asm" }).revision, null);
});

test("the knowledge keeps the bytes of each release other than the base release; a revert and an unrelease follow them", () => {
  const db = fresh();
  setImage(db, llm, { segments: [{ start: 0x1000, end: 0x1003 }], byteAt: () => 0xea });
  const bytes = (values: number[]) => memoryRows([{ start: 0x1000, end: 0x1000 + values.length - 1 }], (address) => values[address - 0x1000]!);
  // The base release has no bytes of its own: its bytes are the program.
  setRelease(db, llm, { label: "ORIGINAL", base: true });
  assert.deepEqual(releaseImage(db, "ORIGINAL")?.segments, [{ start: 0x1000, end: 0x1003 }]);
  assert.throws(() => setRelease(db, llm, { label: "V2" }), /The release V2 has no bytes/);
  const first = setRelease(db, llm, { label: "V2", rows: bytes([0xa9, 0x00, 0x60]) });
  const v2 = releaseImage(db, "V2")!;
  assert.deepEqual([v2.segments, v2.byteAt(0x1001)], [[{ start: 0x1000, end: 0x1002 }], 0x00]);
  assert.equal(setRelease(db, llm, { label: "V2", rows: bytes([0xa9, 0x00, 0x60]) }).revision, null, "the same bytes write nothing");
  assert.equal(setRelease(db, llm, { label: "V2", comment: "The second release." }).current.comment, "The second release.", "a write without bytes keeps them");
  assert.equal(releaseImage(db, "V2")!.byteAt(0x1002), 0x60);
  setRelease(db, llm, { label: "V2", rows: bytes([0xa9, 0x01, 0x60]) });
  assert.equal(releaseImage(db, "V2")!.byteAt(0x1001), 0x01);
  revert(db, llm, { revision: first.revision! });
  assert.equal(releaseImage(db, "V2")!.byteAt(0x1001), 0x00, "a revert restores the bytes");
  removeRelease(db, llm, { label: "V2" });
  assert.equal(releaseImage(db, "V2"), undefined);
  assert.equal((db.prepare("SELECT count(*) AS n FROM current_release_memory").get() as { n: number }).n, 0, "an unrelease closes the bytes");
  assert.throws(() => setRelease(db, llm, { label: "V3", rows: new Map([[0x1000, "a9z0"]]) }), failsWith("invalid-input"));
});


test("patches of two switches can have the same range as alternatives; any other overlap is a conflict", () => {
  const db = fresh();
  const context: WriteContext = { origin: "llm", image: () => sourceImage() };
  setRelease(db, llm, { label: "V1", base: true });
  setRelease(db, llm, { label: "V2", rows: new Map([[0x1000, "a9"]]) });
  setRelease(db, llm, { label: "V3", rows: new Map([[0x1000, "a9"]]) });
  setSwitch(db, context, { name: "FIX_V2", kind: "fix", releases: ["V2"] });
  setSwitch(db, context, { name: "FIX_V3", kind: "fix", default: 0, releases: ["V3"] });
  setPatch(db, context, { start: 0x8079, end: 0x807b, switch: "FIX_V2", code: "", comment: "Check 2." });
  assert.throws(
    () => setPatch(db, context, { start: 0x8079, end: 0x807a, switch: "FIX_V3", code: "" }),
    (error: unknown) => error instanceof Refusal && error.code === "conflict" && /^The patch \$8079-\$807a of FIX_V3 overlaps the patch of FIX_V2 at \$8079-\$807b\. Patches of different switches can have the same range/.test(error.message),
  );
  setPatch(db, context, { start: 0x8079, end: 0x807b, switch: "FIX_V3", code: "nop" });
  assert.deepEqual(listPatches(db).map((row) => [row.start, row.end, row.switch]), [[0x8079, 0x807b, "FIX_V2"], [0x8079, 0x807b, "FIX_V3"]]);
  // The default build can put in one alternative only.
  assert.throws(() => setSwitch(db, context, { name: "FIX_V3", kind: "fix", default: 1 }), /FIX_V2 and FIX_V3 have alternative patches at \$8079-\$807b/);
  assert.throws(() => setPatch(db, context, { start: 0x8079, end: 0x807a, switch: "FIX_V2", code: "nop" }), /overlaps the patch of FIX_V3/, "a patch of the same switch at the same start replaces it, but not across an alternative");
  assert.throws(() => removePatch(db, llm, { start: 0x8079 }), /The patches of FIX_V2, FIX_V3 start at \$8079\. Give the switch/);
  removePatch(db, llm, { start: 0x8079, switch: "FIX_V3" });
  const replaced = setPatch(db, context, { start: 0x8079, end: 0x807a, switch: "FIX_V2", code: "nop" });
  assert.deepEqual([replaced.current.end, replaced.current.comment], [0x807a, "Check 2."]);
});
