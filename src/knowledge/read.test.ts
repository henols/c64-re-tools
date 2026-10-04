import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { openForRead, openForWrite } from "./database.ts";
import { historyAt, historyNamed, revision, revisions } from "./history.ts";
import { at, listComments, listReferences, listRegions, listSymbols, search } from "./read.ts";
import { addReference, classifyRegion, renameSymbol, setComment } from "./write.ts";

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
  assert.equal(known.revision, 8);
  // Inside a region, without a symbol of its own.
  assert.deepEqual({ ...at(db, 0x2105), region: undefined }, { address: 0x2105, region: undefined, comments: [], referencesFrom: [], referencesTo: [], revision: 8 });
});

test("a project without a database reads as empty knowledge", () => {
  const empty = mkdtempSync(join(tmpdir(), "c64-re-tools-empty-"));
  try {
    const none = openForRead(empty);
    assert.equal(none, undefined);
    assert.deepEqual(at(none, 0x2100), { address: 0x2100, comments: [], referencesFrom: [], referencesTo: [], revision: 0 });
    assert.deepEqual(search(none, "x"), { symbols: [], comments: [] });
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
  assert.deepEqual(search(db, "%"), { symbols: [], comments: [] });
  assert.deepEqual(search(db, "_").symbols.length, 2, "an underscore matches only underscores");
});

test("history at an address shows every row with the revisions that opened and closed it", () => {
  const history = historyAt(db, 0x2100);
  const symbols = history.filter((entry) => entry.entity === "symbol");
  assert.deepEqual(
    symbols.map((entry) => [(entry.row as { name: string }).name, entry.from, entry.to]),
    [
      ["FUN_2100", 1, 3],
      ["update_player", 3, undefined],
    ],
  );
  assert.ok(history.some((entry) => entry.entity === "region"));
  assert.equal(history.filter((entry) => entry.entity === "reference").length, 2);
  assert.deepEqual(historyNamed(db, "FUN_2100").map((entry) => entry.to), [3]);
});

test("revisions list newest first and one revision shows what it changed", () => {
  assert.deepEqual(revisions(db, { limit: 3 }).map((revision) => revision.id), [8, 7, 6]);
  assert.deepEqual(revisions(db, { before: 3 }).map((revision) => revision.id), [2, 1]);
  const third = revision(db, 3);
  assert.deepEqual([third.revision.origin, third.revision.operation, third.revision.description], ["user", "rename-symbol", "reads joystick 2"]);
  assert.deepEqual(third.added.map((entry) => (entry.row as { name: string }).name), ["update_player"]);
  assert.deepEqual(third.closed.map((entry) => (entry.row as { name: string }).name), ["FUN_2100"]);
  assert.throws(() => revision(db, 99), /no revision 99/);
});
