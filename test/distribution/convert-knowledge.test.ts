// The one-off conversion of a schema 7 knowledge.db to the knowledge text.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { openForRead, textPath } from "../../src/knowledge/database.ts";
import { historyAt, revision, revisions } from "../../src/knowledge/history.ts";
import { listRegions, operandAt, referencesFrom, symbolAt } from "../../src/knowledge/read.ts";
import { REVISION_ID } from "../../src/knowledge/text.ts";

const script = resolve(import.meta.dirname, "../../distribution/convert-knowledge.ts");
const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** The tables of schema 7 with the columns that the conversion reads. */
const OLD_SCHEMA = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE revisions (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, origin TEXT NOT NULL, operation TEXT NOT NULL, input_hash TEXT, tool_version TEXT, description TEXT);
  CREATE TABLE evidence (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL, sha256 TEXT);
  CREATE TABLE symbols (id INTEGER PRIMARY KEY, space TEXT NOT NULL DEFAULT 'c64', address INTEGER NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, origin TEXT NOT NULL, valid_from_revision INTEGER NOT NULL, valid_to_revision INTEGER);
  CREATE TABLE regions (id INTEGER PRIMARY KEY, space TEXT NOT NULL DEFAULT 'c64', start_address INTEGER NOT NULL, end_address INTEGER NOT NULL, type TEXT NOT NULL, element INTEGER, origin TEXT NOT NULL, valid_from_revision INTEGER NOT NULL, valid_to_revision INTEGER);
  CREATE TABLE comments (id INTEGER PRIMARY KEY, space TEXT NOT NULL DEFAULT 'c64', address INTEGER NOT NULL, placement TEXT NOT NULL, text TEXT NOT NULL, origin TEXT NOT NULL, valid_from_revision INTEGER NOT NULL, valid_to_revision INTEGER);
  CREATE TABLE "references" (id INTEGER PRIMARY KEY, space TEXT NOT NULL DEFAULT 'c64', from_address INTEGER NOT NULL, to_address INTEGER NOT NULL, kind TEXT NOT NULL, origin TEXT NOT NULL, valid_from_revision INTEGER NOT NULL, valid_to_revision INTEGER);
  CREATE TABLE suppressions (id INTEGER PRIMARY KEY, space TEXT NOT NULL DEFAULT 'c64', entity TEXT NOT NULL, start_address INTEGER NOT NULL, end_address INTEGER NOT NULL, to_address INTEGER, kind TEXT, origin TEXT NOT NULL, valid_from_revision INTEGER NOT NULL, valid_to_revision INTEGER);
  CREATE TABLE modules (id INTEGER PRIMARY KEY, space TEXT NOT NULL DEFAULT 'c64', start_address INTEGER NOT NULL, file TEXT NOT NULL, title TEXT, origin TEXT NOT NULL, valid_from_revision INTEGER NOT NULL, valid_to_revision INTEGER);
  CREATE TABLE operands (id INTEGER PRIMARY KEY, space TEXT NOT NULL DEFAULT 'c64', address INTEGER NOT NULL, selector TEXT NOT NULL, symbol TEXT, offset INTEGER NOT NULL DEFAULT 0, expression TEXT, origin TEXT NOT NULL, valid_from_revision INTEGER NOT NULL, valid_to_revision INTEGER);
  INSERT INTO meta VALUES ('schema_version', '7'), ('current_revision', '4');
`;

/** A project with a schema 7 knowledge.db: four revisions, a renamed symbol and a row in every table. Two revisions have the same time. */
function oldProject(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-convert-"));
  roots.push(root);
  mkdirSync(join(root, ".c64-re-tools"));
  const db = new DatabaseSync(join(root, ".c64-re-tools", "knowledge.db"));
  db.exec(OLD_SCHEMA);
  db.exec(`
    INSERT INTO revisions VALUES (1, '2026-09-27T10:00:00.000+01:00', 'dxa', 'import-dxa', '${"a".repeat(64)}', 'dxa 0.9', 'DXA analysis');
    INSERT INTO revisions VALUES (2, '2026-09-27T10:00:00.000+01:00', 'llm', 'apply', NULL, NULL, 'first names');
    INSERT INTO revisions VALUES (3, '2026-09-28T09:30:00.500+01:00', 'user', 'rename-symbol', NULL, NULL, 'reads joystick 2');
    INSERT INTO revisions VALUES (4, '2026-09-28T09:31:00.000+01:00', 'llm', 'remove-symbol', NULL, NULL, NULL);
    INSERT INTO evidence VALUES (1, 3, 'note', 'seen in the attract mode', NULL);
    INSERT INTO symbols VALUES (1, 'c64', 8448, 'l2100', 'label', 'dxa', 1, 2);
    INSERT INTO symbols VALUES (2, 'c64', 8448, 'move_player', 'routine', 'llm', 2, 3);
    INSERT INTO symbols VALUES (3, 'c64', 8448, 'update_player', 'routine', 'user', 3, NULL);
    INSERT INTO symbols VALUES (4, 'c64', 8704, 'l2200', 'label', 'dxa', 1, 4);
    INSERT INTO regions VALUES (1, 'c64', 12288, 12347, 'bytes', 6, 'llm', 2, NULL);
    INSERT INTO comments VALUES (1, 'c64', 8448, 'line', 'Reads joystick 2.', 'llm', 2, NULL);
    INSERT INTO "references" VALUES (1, 'c64', 8192, 8448, 'call', 'dxa', 1, NULL);
    INSERT INTO "references" VALUES (2, 'c64', 32889, 8448, 'pointer', 'llm', 3, NULL);
    INSERT INTO suppressions VALUES (1, 'c64', 'symbol', 8704, 8704, NULL, NULL, 'llm', 4, NULL);
    INSERT INTO modules VALUES (1, 'c64', 8192, 'player.asm', 'Player movement', 'llm', 2, NULL);
    INSERT INTO operands VALUES (1, 'c64', 32889, 'lo', 'update_player', 0, NULL, 'llm', 3, NULL);
  `);
  db.close();
  return root;
}

const convert = (root: string) => spawnSync(process.execPath, [...process.execArgv, script, root], { encoding: "utf8" });

test("a schema 7 knowledge.db becomes knowledge text with the same history", () => {
  const root = oldProject();
  const run = convert(root);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual((JSON.parse(run.stdout) as { counts: unknown }).counts, { revisions: 4, symbols: 4, analyzer_names: 0, regions: 1, comments: 1, references: 2, suppressions: 1, modules: 1, operands: 1, patches: 0, macros: 0, macro_uses: 0, memory: 0, entries: 0, coverage: 0 });
  assert.deepEqual(readdirSync(textPath(root)).sort(), [".gitattributes", "comments.jsonl", "modules.jsonl", "operands.jsonl", "references.jsonl", "regions.jsonl", "revisions.jsonl", "suppressions.jsonl", "symbols.jsonl"]);

  const db = openForRead(root)!;
  try {
    const ids = revisions(db).map((row) => row.id).reverse();
    assert.equal(ids.length, 4);
    for (const id of ids) assert.match(id, REVISION_ID);
    assert.deepEqual(ids.map((id) => id.slice(0, 19)), ["20260927T100000.000", "20260927T100000.001", "20260928T093000.500", "20260928T093100.000"], "the same time gets one millisecond more");
    assert.deepEqual(ids.map((id) => id.slice(-6)), ["000001", "000002", "000003", "000004"]);
    assert.equal(symbolAt(db, 0x2100)?.name, "update_player");
    assert.equal(symbolAt(db, 0x2200), undefined);
    assert.deepEqual(
      historyAt(db, 0x2100).flatMap((entry) => (entry.entity === "symbol" ? [[entry.row.name, entry.from, entry.to]] : [])),
      [
        ["l2100", ids[0], ids[1]],
        ["move_player", ids[1], ids[2]],
        ["update_player", ids[2], undefined],
      ],
    );
    const third = revision(db, ids[2]!);
    assert.deepEqual([third.revision.origin, third.revision.description, third.revision.evidence], ["user", "reads joystick 2", [{ kind: "note", ref: "seen in the attract mode" }]]);
    assert.equal(revision(db, ids[0]!).revision.toolVersion, "dxa 0.9");
    assert.deepEqual(listRegions(db).map((region) => [region.start, region.end, region.element]), [[0x3000, 0x303b, 6]]);
    assert.equal(operandAt(db, 0x8079)?.symbol, "update_player");
    assert.deepEqual(referencesFrom(db, 0x8079).map((reference) => reference.kind), ["pointer"]);
  } finally {
    db.close();
  }
});

test("a second conversion is refused, and the conversion of the same file gives the same text", () => {
  const root = oldProject();
  assert.equal(convert(root).status, 0);
  const again = convert(root);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /exists already/);
  const other = oldProject();
  assert.equal(convert(other).status, 0);
  for (const file of ["revisions.jsonl", "symbols.jsonl", "operands.jsonl"]) {
    assert.equal(readFileSync(join(textPath(other), file), "utf8"), readFileSync(join(textPath(root), file), "utf8"), file);
  }
});
