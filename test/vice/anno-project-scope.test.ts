// anno-project-scope.test.ts -- proof that one annotation database holds many
// projects and no call can reach another project's rows.
//
// Three kinds of proof:
//   * STRUCTURE, read off the live schema with pragmas: every project table
//     carries a NOT NULL project_id, and every index -- including the ones
//     SQLite builds for UNIQUE constraints -- leads with it. A planted schema
//     that breaks either rule must be reported, so the check cannot pass
//     vacuously.
//   * BEHAVIOUR: two projects in one database write the same label name,
//     comment key, enum name, scope and exclusion without colliding, each list
//     function returns only its own project's rows, and a write to one project
//     never makes the other's base_revision stale.
//   * ROUND TRIP: a project exported and imported into a second project holds
//     the same rows in EVERY table, compared generically over sqlite_schema, so
//     a table the export forgets is caught. A planted document that drops one
//     table must fail the same comparison.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  addExcludedRange,
  addScope,
  applyEnumUsage,
  applyWrite,
  closeAnnoDatabase,
  createProjectEnum,
  currentRevision,
  insertExecObservations,
  listComments,
  listExcludedRanges,
  listLabels,
  listProjectEnums,
  listRanges,
  listScopes,
  openAnnoDatabase,
  projectStore,
  putXref,
  setComment,
  setDataType,
  setLabel,
  type AnnoDatabase,
  type AnnoStoreHandle,
} from "../../src/mcp/vice/anno-store.mts";
import { exportStoreDocument, importStoreDocument } from "../../src/mcp/vice/anno-store-export.mts";
import { AnnoProjectError, AnnoStoreError, AnnoStoreStaleRevisionError } from "../../src/mcp/vice/anno-types.mts";

const PROJECT_A = "3f0c9a4e-1b2c-4d3e-8f40-5a6b7c8d9e0f";
const PROJECT_B = "7d1e2f30-4a5b-4c6d-9e7f-8091a2b3c4d5";

/** Tables that are not project tables: the schema row and the project list. */
const UNSCOPED_TABLES = new Set(["anno_meta", "anno_project"]);

/** Columns that are surrogate keys or the scope itself, so they differ between
 * two projects holding the same content. */
const IDENTITY_COLUMNS = new Set(["id", "project_id", "enum_id"]);

type Db = AnnoDatabase["db"];

function withDatabase(body: (adb: AnnoDatabase, dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const adb = openAnnoDatabase(join(dir, "machine.annodb"), { workspaceRoot: dir });
    try {
      body(adb, dir);
    } finally {
      closeAnnoDatabase(adb);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function projectTables(db: Db): string[] {
  return (db.prepare("select name from sqlite_schema where type = 'table' and name like 'anno_%' order by name").all() as { name: string }[])
    .map((row) => row.name)
    .filter((name) => !UNSCOPED_TABLES.has(name));
}

/** Every rule violation in the live schema, by name. Empty means scoped. */
function scopeViolations(db: Db): string[] {
  const violations: string[] = [];
  for (const table of projectTables(db)) {
    const columns = db.prepare(`pragma table_info(${table})`).all() as { name: string; notnull: number }[];
    const projectColumn = columns.find((column) => column.name === "project_id");
    if (projectColumn === undefined) violations.push(`${table}: no project_id column`);
    else if (projectColumn.notnull !== 1) violations.push(`${table}: project_id is nullable`);

    const indexes = db.prepare(`pragma index_list(${table})`).all() as { name: string }[];
    if (indexes.length === 0) violations.push(`${table}: no index at all, so no index leads with project_id`);
    for (const index of indexes) {
      const first = (db.prepare(`pragma index_info(${index.name})`).all() as { seqno: number; name: string }[]).find((column) => column.seqno === 0);
      if (first?.name !== "project_id") violations.push(`${table}: index ${index.name} leads with ${first?.name ?? "nothing"}, not project_id`);
    }
  }
  return violations;
}

/** Every project table's rows for one project, with the identity columns
 * dropped and the rows sorted, so two projects holding the same content
 * compare equal. */
function projectContent(db: Db, projectId: string): Record<string, string[]> {
  const content: Record<string, string[]> = {};
  for (const table of projectTables(db)) {
    const columns = (db.prepare(`pragma table_info(${table})`).all() as { name: string }[])
      .map((column) => column.name)
      .filter((name) => !IDENTITY_COLUMNS.has(name));
    const rows = db.prepare(`select ${columns.join(", ")} from ${table} where project_id = ?`).all(projectId);
    content[table] = rows.map((row) => JSON.stringify(row)).sort();
  }
  return content;
}

/** One row in every project table. */
function populateEveryTable(handle: AnnoStoreHandle): void {
  setDataType(handle, { start: 0x0801, endInclusive: 0x080c, dataType: "code" });
  setLabel(handle, { address: 0x0801, name: "start", kind: "User" });
  setComment(handle, { address: 0x0801, commentType: "line", text: "entry point" });
  addScope(handle, { start: 0x0801, endInclusive: 0x080c });
  createProjectEnum(handle, { name: "Colors", variants: { "0": "BLACK", "1": "WHITE" } });
  applyEnumUsage(handle, { address: 0xd020, name: "Colors" });
  putXref(handle, { fromAddress: 0x0801, toAddress: 0x080c, accessKind: "READ" });
  insertExecObservations(handle, {
    imageSha256: "a".repeat(64),
    argvDigest: "b".repeat(64),
    seed: "seed",
    observations: [{ address: 0x0801, sourceBank: "ram" }],
  });
  addExcludedRange(handle, { start: 0x0900, endInclusive: 0x090f, reason: "loader scratch, rebuilt at runtime" });
}

test("structure: every project table has a NOT NULL project_id and every index, UNIQUE ones included, leads with it", () => {
  withDatabase((adb) => {
    const tables = projectTables(adb.db);
    assert.ok(tables.length >= 9, `the check must see the project tables, saw ${JSON.stringify(tables)}`);
    assert.deepEqual(scopeViolations(adb.db), []);
  });
});

test("structure, planted: a table whose UNIQUE constraint omits project_id and a table with a nullable project_id are both reported by name", () => {
  withDatabase((adb) => {
    adb.db.exec("drop table anno_label");
    adb.db.exec("create table anno_label (id integer primary key autoincrement, project_id text not null, address integer not null, name text not null unique, kind text not null, bank integer)");
    adb.db.exec("drop table anno_scope");
    adb.db.exec("create table anno_scope (id integer primary key autoincrement, project_id text, start integer not null, end_inclusive integer not null)");
    const violations = scopeViolations(adb.db);
    assert.ok(violations.some((v) => v.startsWith("anno_label: index")), `the global UNIQUE(name) must be reported, got ${JSON.stringify(violations)}`);
    assert.ok(violations.includes("anno_scope: project_id is nullable"), `the nullable project_id must be reported, got ${JSON.stringify(violations)}`);
    assert.ok(violations.includes("anno_scope: no index at all, so no index leads with project_id"), `the unindexed table must be reported, got ${JSON.stringify(violations)}`);
  });
});

test("isolation: two projects bind the same label name, comment key, enum name, scope and exclusion without colliding, and each list returns only its own rows", () => {
  withDatabase((adb) => {
    const a = projectStore(adb, PROJECT_A, { create: true });
    const b = projectStore(adb, PROJECT_B, { create: true });
    setLabel(a, { address: 0x1000, name: "init", kind: "User" });
    setLabel(b, { address: 0x2000, name: "init", kind: "User" });
    setComment(a, { address: 0x1000, commentType: "line", text: "A's comment" });
    setComment(b, { address: 0x1000, commentType: "line", text: "B's comment" });
    createProjectEnum(a, { name: "Colors", variants: { "0": "BLACK" } });
    createProjectEnum(b, { name: "Colors", variants: { "0": "WHITE" } });
    addScope(a, { start: 0x1000, endInclusive: 0x10ff });
    addScope(b, { start: 0x1000, endInclusive: 0x10ff });
    addExcludedRange(a, { start: 0x3000, endInclusive: 0x30ff, reason: "A's reason" });
    addExcludedRange(b, { start: 0x3000, endInclusive: 0x30ff, reason: "B's reason" });
    setDataType(a, { start: 0x1000, endInclusive: 0x10ff, dataType: "code" });

    assert.deepEqual(listLabels(a).map((row) => [row.name, row.address]), [["init", 0x1000]]);
    assert.deepEqual(listLabels(b).map((row) => [row.name, row.address]), [["init", 0x2000]]);
    assert.deepEqual(listComments(a).map((row) => row.text), ["A's comment"]);
    assert.deepEqual(listComments(b).map((row) => row.text), ["B's comment"]);
    assert.deepEqual(listProjectEnums(a).map((row) => row.variants), [{ "0": "BLACK" }]);
    assert.deepEqual(listProjectEnums(b).map((row) => row.variants), [{ "0": "WHITE" }]);
    assert.equal(listScopes(a).length, 1);
    assert.equal(listScopes(b).length, 1);
    assert.deepEqual(listExcludedRanges(b).map((row) => row.reason), ["B's reason"]);
    assert.equal(listRanges(a).length, 1, "A typed one range");
    assert.deepEqual(listRanges(b), [], "B sees none of A's ranges");
  });
});

test("isolation: each project has its own revision, so a write to one never makes the other's base_revision stale", () => {
  withDatabase((adb) => {
    const a = projectStore(adb, PROJECT_A, { create: true });
    const b = projectStore(adb, PROJECT_B, { create: true });
    setLabel(a, { address: 0x1000, name: "one", kind: "User" });
    setLabel(a, { address: 0x1001, name: "two", kind: "User" });
    assert.equal(currentRevision(a), 2);
    assert.equal(currentRevision(b), 0, "B's revision did not move when A wrote");

    const accepted = setLabel(b, { address: 0x2000, name: "one", kind: "User", baseRevision: 0 });
    assert.equal(accepted.revision, 1, "B's write based on B's own revision is accepted");
    assert.throws(
      () => setLabel(a, { address: 0x1002, name: "three", kind: "User", baseRevision: 1 }),
      AnnoStoreStaleRevisionError,
      "a stale base on A is still refused against A's own revision",
    );
  });
});

test("an unknown project id is refused rather than read as empty, a malformed id is refused, and create registers a new project at revision 0", () => {
  withDatabase((adb) => {
    assert.throws(() => projectStore(adb, PROJECT_A), AnnoProjectError, "an id the database does not hold is refused without create");
    assert.throws(() => projectStore(adb, "not-a-uuid", { create: true }), AnnoProjectError, "a malformed id is refused even with create");
    assert.throws(() => projectStore(adb, PROJECT_A.toUpperCase(), { create: true }), AnnoProjectError, "an uppercase id is not normalised");
    const created = projectStore(adb, PROJECT_A, { create: true });
    assert.equal(currentRevision(created), 0);
    assert.equal(currentRevision(projectStore(adb, PROJECT_A)), 0, "once registered, the id opens without create");
  });
});

test("a statement that does not bind $pid is refused before it runs, so no store code can read or write every project's rows", () => {
  withDatabase((adb) => {
    const a = projectStore(adb, PROJECT_A, { create: true });
    setLabel(a, { address: 0x1000, name: "init", kind: "User" });
    assert.throws(
      () => applyWrite(a, (db) => db.prepare("delete from anno_label").run()),
      (e: unknown) => e instanceof AnnoStoreError && /unscoped statement/.test(e.message),
    );
    assert.equal(listLabels(a).length, 1, "the refused statement deleted nothing");
    assert.equal(currentRevision(a), 1, "and the refused write did not advance the revision");
  });
});

test("round trip: exporting project A and importing it into project B reproduces every project table's rows, compared generically over sqlite_schema", () => {
  withDatabase((adb) => {
    const a = projectStore(adb, PROJECT_A, { create: true });
    populateEveryTable(a);
    const contentA = projectContent(adb.db, PROJECT_A);
    const emptyTables = Object.entries(contentA)
      .filter(([, rows]) => rows.length === 0)
      .map(([table]) => table);
    assert.deepEqual(emptyTables, [], "the fixture must put a row in EVERY project table, or the comparison proves nothing about that table");

    const b = projectStore(adb, PROJECT_B, { create: true });
    importStoreDocument(b, exportStoreDocument(a));
    assert.deepEqual(projectContent(adb.db, PROJECT_B), contentA);
  });
});

test("round trip, planted: a document that drops one table's rows fails the same generic comparison, naming that table", () => {
  withDatabase((adb) => {
    const a = projectStore(adb, PROJECT_A, { create: true });
    populateEveryTable(a);
    const b = projectStore(adb, PROJECT_B, { create: true });
    importStoreDocument(b, { ...exportStoreDocument(a), excludedRanges: [] });
    const contentA = projectContent(adb.db, PROJECT_A);
    const contentB = projectContent(adb.db, PROJECT_B);
    const differing = Object.keys(contentA).filter((table) => JSON.stringify(contentA[table]) !== JSON.stringify(contentB[table]));
    assert.deepEqual(differing, ["anno_excluded_range"]);
  });
});
