import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { test } from "node:test";

import { failsWith } from "../errors.testkit.ts";
import { indexPath, openForRead, openForWrite, textPath, transaction, withWrite } from "./database.ts";
import { currentRevision, symbolAt } from "./read.ts";
import { ensureSchema, INDEX_VERSION } from "./schema.ts";
import { REVISION_ID } from "./text.ts";
import { removeSymbol, renameSymbol } from "./write.ts";
import { scratchProject, withRead } from "./project.testkit.ts";

const text = (root: string, file: string) => readFileSync(join(textPath(root), file), "utf8");

test("a read of a project without knowledge creates nothing", () => {
  const root = scratchProject();
  assert.equal(openForRead(root), undefined);
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
});

test("a write creates the knowledge text with its .gitattributes, and the index in local/", () => {
  const root = scratchProject();
  const db = openForWrite(root);
  assert.equal(currentRevision(db), "0");
  db.close();
  assert.equal(textPath(root), join(root, ".c64-re-tools", "knowledge"));
  assert.equal(indexPath(root), join(root, ".c64-re-tools", "local", "knowledge.db"));
  assert.deepEqual(readdirSync(join(root, ".c64-re-tools")).sort(), ["knowledge", "local"]);
  assert.match(readFileSync(join(textPath(root), ".gitattributes"), "utf8"), /^\*\.jsonl merge=union text eol=lf$/m);
  assert.deepEqual(readdirSync(join(root, ".c64-re-tools", "local")).sort(), [".gitignore", "knowledge.db"]);
});

test("a write gives one revision line and one row line", () => {
  const root = scratchProject();
  const renamed = withWrite((db) => renameSymbol(db, { origin: "user", description: "the entry" }, { address: 0xc000, name: "start" }), root);
  assert.match(renamed.revision!, REVISION_ID);
  const [revision] = text(root, "revisions.jsonl").trimEnd().split("\n");
  assert.deepEqual(Object.keys(JSON.parse(revision!)), ["id", "time", "origin", "operation", "reason"]);
  assert.equal(
    text(root, "symbols.jsonl"),
    `{"id":"${renamed.revision}/1","space":"c64","address":"$c000","name":"start","kind":"label","origin":"user","added":"${renamed.revision}","closed":null}\n`,
  );
  const again = withWrite((db) => renameSymbol(db, { origin: "user" }, { address: 0xc000, name: "main" }), root);
  assert.equal(
    text(root, "symbols.jsonl"),
    [
      `{"id":"${renamed.revision}/1","space":"c64","address":"$c000","name":"start","kind":"label","origin":"user","added":"${renamed.revision}","closed":"${again.revision}"}`,
      `{"id":"${again.revision}/1","space":"c64","address":"$c000","name":"main","kind":"label","origin":"user","added":"${again.revision}","closed":null}`,
      "",
    ].join("\n"),
  );
  assert.ok(renamed.revision! < again.revision!);
});

test("a committed transaction writes the text and the index, and a failed one writes neither", () => {
  const root = scratchProject();
  withWrite((db) => renameSymbol(db, { origin: "llm" }, { address: 0x2100, name: "main" }), root);
  const before = text(root, "symbols.jsonl");
  const db = openForWrite(root);
  assert.throws(() =>
    transaction(db, () => {
      renameSymbol(db, { origin: "llm" }, { address: 0x2200, name: "other" });
      throw new Error("abort");
    }),
  );
  db.close();
  assert.equal(text(root, "symbols.jsonl"), before);
  // Rollback journal, not WAL: no side files after the writes.
  assert.deepEqual(readdirSync(join(root, ".c64-re-tools", "local")).sort(), [".gitignore", "knowledge.db"]);
  assert.deepEqual(readdirSync(textPath(root)).sort(), [".gitattributes", "revisions.jsonl", "symbols.jsonl"]);
});

test("the index keeps the field rules of the knowledge", () => {
  const root = scratchProject();
  const db = openForWrite(root);
  db.prepare("INSERT INTO revisions (id, created_at, origin, operation) VALUES ('r', 't', 'llm', 'test')").run();
  const symbol = db.prepare("INSERT INTO symbols (id, address, name, kind, origin, valid_from_revision) VALUES (?, ?, ?, 'label', 'llm', 'r')");
  assert.throws(() => symbol.run("a", 0x10000, "too_high"), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO regions (id, start_address, end_address, type, origin, valid_from_revision) VALUES ('b', 5, 4, 'code', 'llm', 'r')").run(), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO revisions (id, created_at, origin, operation) VALUES ('s', 't', 'hacker', 'x')").run(), /CHECK/);
  db.close();
});

test("the index is made again when it is missing, of another version, or not a database", () => {
  const root = scratchProject();
  withWrite((db) => renameSymbol(db, { origin: "llm" }, { address: 0x2100, name: "main" }), root);
  const read = () => withRead(root, (db) => symbolAt(db, 0x2100)?.name);
  rmSync(indexPath(root));
  assert.equal(read(), "main");
  const raw = new DatabaseSync(indexPath(root));
  raw.prepare("UPDATE meta SET value = ? WHERE key = 'index_version'").run(String(INDEX_VERSION + 1));
  raw.close();
  assert.equal(read(), "main");
  writeFileSync(indexPath(root), "this is not sqlite at all, not even close......................................");
  assert.equal(read(), "main");
  const foreign = new DatabaseSync(indexPath(root));
  foreign.exec("DROP TABLE meta; CREATE TABLE something (x)");
  foreign.close();
  assert.equal(read(), "main");
});

test("a change of the text shows in the next read and write", () => {
  const root = scratchProject();
  const first = withWrite((db) => renameSymbol(db, { origin: "llm" }, { address: 0x2100, name: "main" }), root);
  writeFileSync(join(textPath(root), "symbols.jsonl"), text(root, "symbols.jsonl").replace('"main"', '"edited"'));
  assert.equal(withRead(root, (db) => symbolAt(db, 0x2100)?.name), "edited");
  const second = withWrite((db) => renameSymbol(db, { origin: "llm" }, { address: 0x2200, name: "other" }), root);
  assert.match(text(root, "symbols.jsonl"), /"edited"/);
  assert.ok(second.revision! > first.revision!);
});

test("text that is written but not in the index, as after a crash, is read from the text", () => {
  const root = scratchProject();
  withWrite((db) => renameSymbol(db, { origin: "llm" }, { address: 0x2100, name: "main" }), root);
  const index = readFileSync(indexPath(root));
  withWrite((db) => renameSymbol(db, { origin: "llm" }, { address: 0x2200, name: "other" }), root);
  // The index of before the second write: the text has a revision that the index does not.
  writeFileSync(indexPath(root), index);
  assert.equal(withRead(root, (db) => symbolAt(db, 0x2200)?.name), "other");
});

test("a bad line in the text is refused with its file and line", () => {
  const root = scratchProject();
  withWrite((db) => renameSymbol(db, { origin: "llm" }, { address: 0x2100, name: "main" }), root);
  const symbols = join(textPath(root), "symbols.jsonl");
  const good = readFileSync(symbols, "utf8");
  writeFileSync(symbols, `${good}{not json\n`);
  assert.throws(() => openForRead(root), failsWith("invalid-database", /symbols\.jsonl:2: the line is not JSON/));
  writeFileSync(symbols, good.replace('"$2100"', '"2100"'));
  assert.throws(() => openForRead(root), /symbols\.jsonl:1: address must be an address/);
  writeFileSync(symbols, good.replace('"kind"', '"color":"red","kind"'));
  assert.throws(() => openForRead(root), /symbols\.jsonl:1: the key "color" is not known/);
  writeFileSync(symbols, good.replace('"origin":"llm"', '"origin":"hacker"'));
  assert.throws(() => openForRead(root), failsWith("invalid-database", /CHECK/));
  writeFileSync(join(textPath(root), "symbols.jsonl"), good);
  writeFileSync(join(textPath(root), "notes.jsonl"), "");
  assert.throws(() => openForRead(root), /notes\.jsonl is not a knowledge file/);
});

test("two writers that create the index at the same time both get the current schema", () => {
  const root = scratchProject();
  mkdirSync(join(root, ".c64-re-tools", "local"), { recursive: true });
  const first = new DatabaseSync(indexPath(root));
  const second = new DatabaseSync(indexPath(root));
  let raced = false;
  // The second writer creates the schema after the first one read the version and before it takes the write lock.
  const racing = new Proxy(first, {
    get(target, property) {
      if (property === "exec") {
        return (sql: string) => {
          if (!raced && sql === "BEGIN IMMEDIATE") {
            raced = true;
            ensureSchema(second);
          }
          target.exec(sql);
        };
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  ensureSchema(racing);
  assert.equal(raced, true);
  assert.equal((first.prepare("SELECT value FROM meta WHERE key = 'index_version'").get() as { value: string }).value, String(INDEX_VERSION));
  first.close();
  second.close();
});

test("a refused write in a project without knowledge creates nothing, and an accepted one creates the knowledge", () => {
  const root = scratchProject();
  const context = { origin: "llm" as const };
  assert.throws(() => withWrite((db) => removeSymbol(db, context, { address: 0x2100 }), root), failsWith("not-found"));
  assert.throws(() => withWrite((db) => renameSymbol(db, { ...context, expectedRevision: "20261015T214501.123-k3f9qz" }, { address: 0x2100, name: "main" }), root), failsWith("not-found"));
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
  const renamed = withWrite((db) => renameSymbol(db, { ...context, expectedRevision: "0" }, { address: 0x2100, name: "main" }), root);
  assert.equal(withRead(root, currentRevision), renamed.revision);
  assert.throws(() => withWrite((db) => renameSymbol(db, { ...context, expectedRevision: "0" }, { address: 0x2200, name: "late" }), root), failsWith("stale-revision"));
  assert.throws(() => withWrite((db) => removeSymbol(db, context, { address: 0x2200 }), root), failsWith("not-found"));
});

test("a read opens the index read-only and never changes the text", () => {
  const root = scratchProject();
  withWrite((db) => renameSymbol(db, { origin: "user" }, { address: 0x2100, name: "main" }), root);
  const before = text(root, "symbols.jsonl");
  withRead(root, (db) => assert.throws(() => db.exec("INSERT INTO revisions (id, created_at, origin, operation) VALUES ('r', 't', 'llm', 'test')"), /readonly/));
  assert.equal(text(root, "symbols.jsonl"), before);
});

test("a knowledge folder without files reads as no knowledge", () => {
  const root = scratchProject();
  mkdirSync(textPath(root), { recursive: true });
  assert.equal(withRead(root, currentRevision), "0");
});
