import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { KnowledgeError, knowledgePath, openForRead, openForWrite, transaction, withWrite } from "./database.ts";
import { currentRevision } from "./read.ts";
import { migrate, SCHEMA_VERSION, schemaVersion } from "./schema.ts";
import { removeSymbol, renameSymbol } from "./write.ts";

const projects: string[] = [];
after(() => {
  for (const project of projects) {
    try {
      rmSync(project, { recursive: true, force: true });
    } catch (error) {
      // Windows keeps a file that a test left open locked until the process ends.
      if (process.platform !== "win32") throw error;
    }
  }
});

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-knowledge-"));
  projects.push(root);
  return root;
}

const failsWith = (code: string) => (error: unknown) => error instanceof KnowledgeError && error.code === code;

test("a read of a project without knowledge creates nothing", () => {
  const root = project();
  assert.equal(openForRead(root), undefined);
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
});

test("a write creates .c64-re-tools/knowledge.db with the current schema", () => {
  const root = project();
  const db = openForWrite(root);
  assert.equal(schemaVersion(db), SCHEMA_VERSION);
  assert.equal((db.prepare("SELECT value FROM meta WHERE key = 'current_revision'").get() as { value: string }).value, "0");
  db.close();
  assert.equal(knowledgePath(root), join(root, ".c64-re-tools", "knowledge.db"));
  assert.deepEqual(readdirSync(join(root, ".c64-re-tools")), ["knowledge.db"]);
  const again = openForRead(root);
  assert.ok(again !== undefined);
  assert.equal(schemaVersion(again), SCHEMA_VERSION);
  again.close();
});

test("a committed transaction leaves one self-contained file and a failed one leaves nothing", () => {
  const root = project();
  const db = openForWrite(root);
  transaction(db, () => {
    db.prepare("INSERT INTO revisions (created_at, origin, operation) VALUES ('t', 'llm', 'test')").run();
  });
  assert.throws(() =>
    transaction(db, () => {
      db.prepare("INSERT INTO revisions (created_at, origin, operation) VALUES ('t', 'llm', 'test')").run();
      throw new Error("abort");
    }),
  );
  assert.equal((db.prepare("SELECT count(*) AS n FROM revisions").get() as { n: number }).n, 1);
  db.close();
  // Rollback journal, not WAL: no side files after the writes.
  assert.deepEqual(readdirSync(join(root, ".c64-re-tools")), ["knowledge.db"]);
});

test("the schema enforces the current-row rules", () => {
  const root = project();
  const db = openForWrite(root);
  db.prepare("INSERT INTO revisions (id, created_at, origin, operation) VALUES (1, 't', 'llm', 'test')").run();
  const symbol = db.prepare("INSERT INTO symbols (address, name, kind, origin, valid_from_revision) VALUES (?, ?, 'label', 'llm', 1)");
  symbol.run(0x2100, "update_player");
  assert.throws(() => symbol.run(0x2100, "other"), /UNIQUE/, "one current symbol per address");
  assert.throws(() => symbol.run(0x2200, "update_player"), /UNIQUE/, "current names are unique");
  assert.throws(() => symbol.run(0x10000, "too_high"), /CHECK/);
  db.prepare("UPDATE symbols SET valid_to_revision = 1 WHERE address = ?").run(0x2100);
  symbol.run(0x2100, "update_player"); // a closed row does not block a new current one
  assert.throws(() => db.prepare("INSERT INTO regions (start_address, end_address, type, origin, valid_from_revision) VALUES (5, 4, 'code', 'llm', 1)").run(), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO revisions (created_at, origin, operation) VALUES ('t', 'hacker', 'x')").run(), /CHECK/);
  db.close();
});

test("a database from a newer c64-re-tools is refused, and garbage is invalid", () => {
  const newer = project();
  openForWrite(newer).close();
  const raw = new DatabaseSync(knowledgePath(newer));
  raw.prepare("UPDATE meta SET value = ? WHERE key = 'schema_version'").run(String(SCHEMA_VERSION + 1));
  raw.close();
  assert.throws(() => openForRead(newer), failsWith("unsupported-migration"));

  const garbage = project();
  mkdirSync(join(garbage, ".c64-re-tools"));
  writeFileSync(knowledgePath(garbage), "this is not sqlite at all, not even close......................................");
  assert.throws(() => openForRead(garbage), failsWith("invalid-database"));

  const foreign = project();
  mkdirSync(join(foreign, ".c64-re-tools"));
  const other = new DatabaseSync(knowledgePath(foreign));
  other.exec("CREATE TABLE something (x)");
  other.close();
  assert.throws(() => openForWrite(foreign), failsWith("invalid-database"));
});

test("a schema version that is not a whole number is invalid", () => {
  const root = project();
  openForWrite(root).close();
  const raw = new DatabaseSync(knowledgePath(root));
  raw.prepare("UPDATE meta SET value = 'one' WHERE key = 'schema_version'").run();
  raw.close();
  assert.throws(() => openForRead(root), failsWith("invalid-database"));
  assert.throws(() => openForWrite(root), failsWith("invalid-database"));
});

test("two writers that create the database at the same time both get the current schema", () => {
  const root = project();
  mkdirSync(join(root, ".c64-re-tools"));
  const first = new DatabaseSync(knowledgePath(root));
  const second = new DatabaseSync(knowledgePath(root));
  let raced = false;
  // The second writer migrates after the first one read the version and before it takes the write lock.
  const racing = new Proxy(first, {
    get(target, property) {
      if (property === "exec") {
        return (sql: string) => {
          if (!raced && sql === "BEGIN IMMEDIATE") {
            raced = true;
            migrate(second);
          }
          target.exec(sql);
        };
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  migrate(racing);
  assert.equal(raced, true);
  assert.equal(schemaVersion(first), SCHEMA_VERSION);
  assert.equal((first.prepare("SELECT count(*) AS n FROM meta WHERE key = 'current_revision'").get() as { n: number }).n, 1);
  first.close();
  second.close();
});

test("a refused write in a project without knowledge creates nothing, and an accepted one creates the database", () => {
  const root = project();
  const context = { origin: "llm" as const };
  assert.throws(() => withWrite((db) => removeSymbol(db, context, { address: 0x2100 }), root), failsWith("not-found"));
  assert.throws(() => withWrite((db) => renameSymbol(db, { ...context, expectedRevision: 3 }, { address: 0x2100, name: "main" }), root), failsWith("stale-revision"));
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
  const renamed = withWrite((db) => renameSymbol(db, context, { address: 0x2100, name: "main" }), root);
  assert.equal(renamed.revision, 1);
  const db = openForRead(root)!;
  assert.equal(currentRevision(db), 1);
  db.close();
  assert.throws(() => withWrite((db) => removeSymbol(db, context, { address: 0x2200 }), root), failsWith("not-found"));
});
