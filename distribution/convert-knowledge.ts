// Converts the knowledge of one project from the schema 7 .c64-re-tools/knowledge.db
// to the text in .c64-re-tools/knowledge/ (D69). A one-off tool, run by hand
// for each project from this repository; it is not in the package, and the
// code keeps no conversion (D28).
//
//   node distribution/convert-knowledge.ts <project folder>
//
// The ids come from the time of each revision and the old revision number,
// so a second conversion of the same file gives the same text. The old file
// stays: remove it from git after a check of the result.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join, resolve } from "node:path";

import { GIT_ATTRIBUTES, KNOWLEDGE_DIRECTORY, openForRead, textPath } from "../src/knowledge/database.ts";
import { ensureSchema } from "../src/knowledge/schema.ts";
import { newRevisionId, REVISIONS_FILE, revisionsText, rowId, sqlName, TABLES, tableText } from "../src/knowledge/text.ts";

const OLD_SCHEMA = 7;

type Raw = Record<string, unknown>;

function fail(message: string): never {
  console.error(`convert-knowledge: ${message}`);
  process.exit(1);
}

/** Six base-36 digits of the old revision number: the random part of its new id. */
function digits(old: number): Uint8Array {
  return Uint8Array.from(old.toString(36).padStart(6, "0").slice(-6), (digit) => Number.parseInt(digit, 36));
}

/** Copies every revision, evidence and row of the old file into an empty index, with text ids. */
function copy(old: DatabaseSync, index: DatabaseSync): Map<number, string> {
  const ids = new Map<number, string>([[0, "0"]]);
  let latest = "0";
  const insertRevision = index.prepare("INSERT INTO revisions (id, created_at, origin, operation, input_hash, tool_version, description) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const revision of old.prepare("SELECT * FROM revisions ORDER BY id").all() as Raw[]) {
    const time = Date.parse(revision.created_at as string);
    if (Number.isNaN(time)) fail(`revision ${String(revision.id)} has no time: ${JSON.stringify(revision.created_at)}.`);
    latest = newRevisionId(latest, new Date(time), digits(revision.id as number));
    ids.set(revision.id as number, latest);
    insertRevision.run(latest, revision.created_at as string, revision.origin as string, revision.operation as string, revision.input_hash as string | null, revision.tool_version as string | null, revision.description as string | null);
  }
  const insertEvidence = index.prepare("INSERT INTO evidence (revision, kind, ref, sha256) VALUES (?, ?, ?, ?)");
  for (const item of old.prepare("SELECT * FROM evidence ORDER BY id").all() as Raw[]) {
    insertEvidence.run(ids.get(item.revision as number)!, item.kind as string, item.ref as string, item.sha256 as string | null);
  }
  // The order of a row in its revision counts across every table, so each row id is unique.
  const order = new Map<string, number>();
  const has = old.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?");
  for (const spec of TABLES) {
    // A table that came after schema 7 (patches, macros, macro uses) is empty in the text.
    if (has.get(spec.table) === undefined) continue;
    const columns = spec.fields.map((field) => field.column);
    const insert = index.prepare(`INSERT INTO ${sqlName(spec.table)} (id, ${columns.join(", ")}, valid_from_revision, valid_to_revision) VALUES (${["?", ...columns.map(() => "?"), "?", "?"].join(", ")})`);
    for (const row of old.prepare(`SELECT * FROM ${sqlName(spec.table)} ORDER BY id`).all() as Raw[]) {
      const from = ids.get(row.valid_from_revision as number);
      if (from === undefined) fail(`a row of ${spec.table} names the revision ${String(row.valid_from_revision)}, which is not in the file.`);
      const next = (order.get(from) ?? 0) + 1;
      order.set(from, next);
      const to = row.valid_to_revision === null ? null : ids.get(row.valid_to_revision as number);
      if (to === undefined) fail(`a row of ${spec.table} names the revision ${String(row.valid_to_revision)}, which is not in the file.`);
      insert.run(rowId(from, next), ...(columns.map((column) => row[column]) as Array<string | number | null>), from, to);
    }
  }
  return ids;
}

const [folder] = process.argv.slice(2);
if (folder === undefined) fail("give the project folder: node distribution/convert-knowledge.ts <project folder>");
const root = resolve(folder);
const file = join(root, KNOWLEDGE_DIRECTORY, "knowledge.db");
if (!existsSync(file)) fail(`${file} does not exist.`);
if (existsSync(textPath(root))) fail(`${textPath(root)} exists already. Nothing was converted.`);

const old = new DatabaseSync(file, { readOnly: true });
const version = (old.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined)?.value;
if (version !== String(OLD_SCHEMA)) fail(`${file} has schema version ${String(version)}; this tool converts version ${OLD_SCHEMA} only.`);
const index = new DatabaseSync(":memory:");
index.exec("PRAGMA foreign_keys = ON");
ensureSchema(index);
const ids = copy(old, index);
old.close();

mkdirSync(textPath(root), { recursive: true });
writeFileSync(join(textPath(root), ".gitattributes"), GIT_ATTRIBUTES);
writeFileSync(join(textPath(root), REVISIONS_FILE), revisionsText(index));
const counts: Record<string, number> = { revisions: ids.size - 1 };
for (const spec of TABLES) {
  const text = tableText(index, spec);
  counts[spec.table] = text === "" ? 0 : text.split("\n").length - 1;
  if (text !== "") writeFileSync(join(textPath(root), spec.file), text);
}
index.close();
// The first read makes the index from the text, and checks every line.
openForRead(root)?.close();
console.log(JSON.stringify({ knowledge: textPath(root), counts, next: `Check the knowledge, then remove the old file: git rm ${join(KNOWLEDGE_DIRECTORY, "knowledge.db")}` }));
