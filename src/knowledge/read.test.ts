import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { openForRead, openForWrite } from "./database.ts";
import { historyAt, historyNamed, revision, revisions } from "./history.ts";
import { at, listComments, listReferences, listRegions, listSymbols, search, sourceRevision } from "./read.ts";
import { setImage } from "./program.ts";
import { addReference, classifyRegion, renameSymbol, setComment, setStartScreen } from "./write.ts";
import { nth } from "./revisions.testkit.ts";

let root: string;
let db: DatabaseSync;

before(() => {
  root = mkdtempSync(join(tmpdir(), "c64-re-tools-read-"));
  db = openForWrite(root);
  const llm = { origin: "llm" } as const;
  renameSymbol(db, llm, { address: 0x2100, name: "FUN_2100", kind: "routine" }); // 1
  classifyRegion(db, llm, { start: 0x2000, end: 0x2fff, type: "code" }); // 2
  renameSymbol(db, { origin: "user", description: "reads joystick 2" }, { address: 0x2100, name: "update_player" }); // 3
  setComment(db, llm, { address: 0x2100, placement: "line", text: "Reads joystick 2 and moves the player." }); // 4
  addReference(db, llm, { from: 0x2000, to: 0x2100, kind: "call" }); // 5
  addReference(db, llm, { from: 0x2100, to: 0xdc00, kind: "read" }); // 6
  classifyRegion(db, llm, { start: 0x3000, end: 0x303f, type: "sprite" }); // 7
  renameSymbol(db, llm, { address: 0x3000, name: "player_sprite", kind: "data" }); // 8
});
after(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

test("at() gives the symbol, containing region, comments and references of an address", () => {
  const known = at(db, 0x2100);
  assert.equal(known.symbol?.name, "update_player");
  assert.deepEqual([known.region?.start, known.region?.end, known.region?.type], [0x2000, 0x2fff, "code"]);
  assert.equal(known.comments[0]?.text, "Reads joystick 2 and moves the player.");
  assert.deepEqual(known.referencesTo.map((reference) => [reference.from, reference.kind]), [[0x2000, "call"]]);
  assert.deepEqual(known.referencesFrom.map((reference) => [reference.to, reference.kind]), [[0xdc00, "read"]]);
  assert.equal(known.revision, nth(db, 8));
  // Inside a region, without a symbol of its own.
  assert.deepEqual({ ...at(db, 0x2105), region: undefined }, { space: "c64", address: 0x2105, region: undefined, comments: [], referencesFrom: [], referencesTo: [], analyzerNames: [], suppressions: [], revision: nth(db, 8) });
});

test("a project without a database reads as empty knowledge", () => {
  const empty = mkdtempSync(join(tmpdir(), "c64-re-tools-empty-"));
  try {
    const none = openForRead(empty);
    assert.equal(none, undefined);
    assert.deepEqual(at(none, 0x2100), { space: "c64", address: 0x2100, comments: [], referencesFrom: [], referencesTo: [], analyzerNames: [], suppressions: [], revision: "0" });
    assert.deepEqual(search(none, "x"), { symbols: [], analyzerNames: [], comments: [] });
    assert.deepEqual(historyAt(none, 0x2100), []);
    assert.deepEqual(revisions(none), []);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("lists filter by range, kind and type", () => {
  assert.deepEqual(listSymbols(db).map((symbol) => symbol.name), ["update_player", "player_sprite"]);
  assert.deepEqual(listSymbols(db, { start: 0, end: 0xffff }, "data").map((symbol) => symbol.name), ["player_sprite"]);
  assert.deepEqual(listRegions(db, { start: 0x3000, end: 0x3000 }).map((region) => region.type), ["sprite"]);
  assert.deepEqual(listRegions(db, undefined, "code").map((region) => region.start), [0x2000]);
  assert.equal(listComments(db, { start: 0x2100, end: 0x2100 }).length, 1);
  assert.equal(listReferences(db, { start: 0xdc00, end: 0xdc0f }).length, 1);
  assert.equal(listReferences(db, undefined, "call").length, 1);
});

test("search finds symbol names and comment text, case-insensitive, with wildcards escaped", () => {
  const found = search(db, "PLAYER");
  assert.deepEqual(found.symbols.map((symbol) => symbol.name), ["update_player", "player_sprite"]);
  assert.equal(found.comments.length, 1);
  assert.deepEqual(search(db, "%"), { symbols: [], analyzerNames: [], comments: [] });
  assert.deepEqual(search(db, "_").symbols.length, 2, "an underscore matches only underscores");
});

test("history at an address shows every row with the revisions that opened and closed it", () => {
  const history = historyAt(db, 0x2100);
  const symbols = history.filter((entry) => entry.entity === "symbol");
  assert.deepEqual(
    symbols.map((entry) => [(entry.row as { name: string }).name, entry.from, entry.to]),
    [
      ["FUN_2100", nth(db, 1), nth(db, 3)],
      ["update_player", nth(db, 3), undefined],
    ],
  );
  assert.ok(history.some((entry) => entry.entity === "region"));
  assert.equal(history.filter((entry) => entry.entity === "reference").length, 2);
  assert.deepEqual(historyNamed(db, "FUN_2100").map((entry) => entry.to), [nth(db, 3)]);
});

test("revisions list newest first and one revision shows what it changed", () => {
  assert.deepEqual(revisions(db, { limit: 3 }).map((revision) => revision.id), [nth(db, 8), nth(db, 7), nth(db, 6)]);
  assert.deepEqual(revisions(db, { before: nth(db, 3) }).map((revision) => revision.id), [nth(db, 2), nth(db, 1)]);
  const third = revision(db, nth(db, 3));
  assert.equal(revision(db, nth(db, 3).slice(0, 24)).revision.id, nth(db, 3), "a start of the id that one revision has is enough");
  assert.deepEqual([third.revision.origin, third.revision.operation, third.revision.description], ["user", "rename-symbol", "reads joystick 2"]);
  assert.deepEqual(third.added.map((entry) => (entry.row as { name: string }).name), ["update_player"]);
  assert.deepEqual(third.closed.map((entry) => (entry.row as { name: string }).name), ["FUN_2100"]);
  assert.throws(() => revision(db, "20991231T235959.999-zzzzzz"), /no revision 20991231T235959.999-zzzzzz/);
  assert.throws(() => revision(db, "2"), /start of more than one revision/);
  assert.throws(() => revision(db, "99;"), /is not a revision id/);
});

test("revision 0 is the knowledge before every revision: it added and closed nothing", () => {
  const initial = revision(db, "0");
  assert.deepEqual([initial.revision.id, initial.revision.operation, initial.added, initial.closed], ["0", "none", [], []]);
  assert.equal(revision(undefined, "0").revision.id, "0", "also without a knowledge folder");
});

test("the source revision of a space is its newest revision and that of the stage of its start screen; a change in another space keeps it", () => {
  const folder = mkdtempSync(join(tmpdir(), "c64-re-tools-read-"));
  const own = openForWrite(folder);
  try {
    const llm = { origin: "llm" } as const;
    renameSymbol(own, llm, { address: 0x1000, name: "start" });
    const first = sourceRevision(own);
    renameSymbol(own, llm, { space: "drive8", address: 0x0500, name: "drive_loop" });
    assert.equal(sourceRevision(own), first, "a change in drive8");
    assert.notEqual(sourceRevision(own, "drive8"), first);
    // The stage of the start screen is part of the source of c64.
    setImage(own, llm, { space: "bank1", segments: [{ start: 0x5c00, end: 0x83ff }], byteAt: () => 0 });
    setStartScreen(own, llm, { mode: "multicolour", screen: 0x5c00, bitmap: 0x6000, colourRam: true, border: 0, background: 6, stage: "bank1" });
    const staged = sourceRevision(own);
    renameSymbol(own, llm, { space: "bank1", address: 0x6000, name: "picture" });
    assert.notEqual(sourceRevision(own), staged, "a change in the stage");
  } finally {
    own.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
