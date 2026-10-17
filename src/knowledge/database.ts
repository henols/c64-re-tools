// The one place that opens the knowledge. The knowledge is text in
// .c64-re-tools/knowledge/; .c64-re-tools/local/knowledge.db is an index
// that is made again from the text when the text changed.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

import { ensureLocal, LOCAL_DIRECTORY, PROJECT_DIRECTORY, projectRoot } from "../project.ts";
import { ensureSchema } from "./schema.ts";
import { compareText, loadText, readText, REVISIONS_FILE, revisionsText, sha256, sqlName, TABLES, tableText, writeAtomic } from "./text.ts";

export const KNOWLEDGE_DIRECTORY = PROJECT_DIRECTORY;
/** The folder of the committed knowledge text. */
export const TEXT_DIRECTORY = "knowledge";
/** The index file in .c64-re-tools/local/. */
export const INDEX_FILE = "knowledge.db";
/** Git keeps the lines of both sides when two computers changed the same knowledge file. */
// eol=lf: with core.autocrlf (the Windows default) git would check the files out with CRLF, so two computers would hold other bytes.
export const GIT_ATTRIBUTES = "# The knowledge of c64-re-tools: git keeps the lines of both sides of a merge, with LF line ends on every system.\n*.jsonl merge=union text eol=lf\n.gitattributes text eol=lf\n";

export const KNOWLEDGE_ERROR_CODES = [
  "invalid-input",
  "not-found",
  "conflict",
  "stale-revision",
  "invalid-database",
  "unsupported-schema",
] as const;
export type KnowledgeErrorCode = (typeof KNOWLEDGE_ERROR_CODES)[number];

/** A refused knowledge operation, with a stable code and an actionable message. */
export class KnowledgeError extends Error {
  override name = "KnowledgeError";
  readonly code: KnowledgeErrorCode;

  constructor(code: KnowledgeErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** The folder of the knowledge text: .c64-re-tools/knowledge/. */
export function textPath(root: string = projectRoot()): string {
  return join(root, KNOWLEDGE_DIRECTORY, TEXT_DIRECTORY);
}

/** The index: .c64-re-tools/local/knowledge.db. */
export function indexPath(root: string = projectRoot()): string {
  return join(root, KNOWLEDGE_DIRECTORY, LOCAL_DIRECTORY, INDEX_FILE);
}

/** Refuses a project that has only the knowledge.db of an older c64-re-tools. */
function refuseOldLayout(root: string): void {
  if (!existsSync(textPath(root)) && existsSync(join(root, KNOWLEDGE_DIRECTORY, INDEX_FILE))) {
    throw new KnowledgeError(
      "unsupported-schema",
      `${KNOWLEDGE_DIRECTORY}/${INDEX_FILE} is the knowledge of an older c64-re-tools. This c64-re-tools keeps the knowledge as text in ${KNOWLEDGE_DIRECTORY}/${TEXT_DIRECTORY}/. Convert it one time with distribution/convert-knowledge.ts of the c64-re-tools source repository.`,
    );
  }
}

function configure(db: DatabaseSync): void {
  db.exec("PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
}

function open(path: string, readOnly: boolean): DatabaseSync {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(path, { readOnly });
    configure(db);
    db.prepare("SELECT count(*) FROM sqlite_master").get();
  } catch (error) {
    throw new KnowledgeError("invalid-database", `${KNOWLEDGE_DIRECTORY}/${LOCAL_DIRECTORY}/${INDEX_FILE} is not a readable SQLite database: ${(error as Error).message} Delete it: it is made again from the knowledge text.`);
  }
  return db;
}

/** Opens the index for a write and gives it the schema of this build. A file that is no database is made again. */
function openIndex(root: string): DatabaseSync {
  ensureLocal(root);
  let db: DatabaseSync;
  try {
    db = open(indexPath(root), false);
  } catch {
    writeFileSync(indexPath(root), "");
    db = open(indexPath(root), false);
  }
  try {
    ensureSchema(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

function storedHashes(db: DatabaseSync): Record<string, string> {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'text_hashes'").get() as { value: string } | undefined;
  return row === undefined ? {} : (JSON.parse(row.value) as Record<string, string>);
}

function storeHashes(db: DatabaseSync, hashes: Record<string, string>): void {
  const sorted = Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => compareText(a, b)));
  db.prepare("INSERT INTO meta (key, value) VALUES ('text_hashes', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(JSON.stringify(sorted));
}

/** The SHA-256 of each knowledge file, by file name, in name order. */
function textHashes(files: ReadonlyMap<string, { sha256: string }>): Record<string, string> {
  return Object.fromEntries([...files].map(([name, file]): [string, string] => [name, file.sha256]).sort(([a], [b]) => compareText(a, b)));
}

const sameHashes = (a: Record<string, string>, b: Record<string, string>) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/**
 * Makes the index equal to the text when a knowledge file has another
 * SHA-256 than the index holds, or a file came or went. Runs inside a write
 * transaction, so two processes never make the index at the same time.
 */
function freshen(db: DatabaseSync, root: string): void {
  const files = readText(textPath(root));
  const hashes = textHashes(files);
  if (sameHashes(hashes, storedHashes(db))) return;
  db.exec("DELETE FROM evidence");
  for (const spec of TABLES) db.exec(`DELETE FROM ${sqlName(spec.table)}`);
  db.exec("DELETE FROM revisions");
  loadText(db, files);
  storeHashes(db, hashes);
}

/** The project of each index opened for a write: its writes go to the text too. */
const projects = new WeakMap<DatabaseSync, string>();

/**
 * Opens the project's knowledge read-only, made fresh from the text first. A
 * read never changes the knowledge. Returns undefined when the project has no
 * knowledge text: that reads as empty knowledge, and a read creates nothing.
 */
export function openForRead(root: string = projectRoot()): DatabaseSync | undefined {
  refuseOldLayout(root);
  if (!existsSync(textPath(root))) return undefined;
  const index = openIndex(root);
  try {
    // The lock is taken only when the text changed: a read does not wait for a long write that keeps the index fresh.
    if (!sameHashes(textHashes(readText(textPath(root))), storedHashes(index))) transaction(index, () => freshen(index, root));
  } finally {
    index.close();
  }
  return open(indexPath(root), true);
}

/**
 * Opens the project's knowledge for a write: it creates
 * .c64-re-tools/knowledge/ with its .gitattributes when needed, and the index.
 * Every committed transaction on the database writes the changed knowledge
 * files.
 */
export function openForWrite(root: string = projectRoot()): DatabaseSync {
  refuseOldLayout(root);
  mkdirSync(textPath(root), { recursive: true });
  const attributes = join(textPath(root), ".gitattributes");
  if (!existsSync(attributes)) writeFileSync(attributes, GIT_ATTRIBUTES);
  const db = openIndex(root);
  projects.set(db, root);
  try {
    transaction(db, () => undefined);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

/**
 * Runs one write on the project's knowledge and closes it. When the project
 * has no knowledge yet, `work` first runs on an empty database in memory: a
 * write that is refused there creates no .c64-re-tools/. `work` must change
 * nothing outside the database it gets.
 */
export function withWrite<T>(work: (db: DatabaseSync) => T, root: string = projectRoot()): T {
  refuseOldLayout(root);
  if (!existsSync(textPath(root))) {
    const trial = new DatabaseSync(":memory:");
    try {
      configure(trial);
      ensureSchema(trial);
      work(trial);
    } finally {
      trial.close();
    }
  }
  const db = openForWrite(root);
  try {
    return work(db);
  } finally {
    db.close();
  }
}

/** The newest revision id, or "0" when there is none. */
function newest(db: DatabaseSync): string {
  return (db.prepare("SELECT max(id) AS id FROM revisions").get() as { id: string | null }).id ?? "0";
}

/**
 * Writes the knowledge files that the revisions after `before` changed, then
 * keeps their SHA-256 in the index. The text is written before the index
 * commits: when the commit fails, the next open makes the index from the text.
 */
function writeText(db: DatabaseSync, root: string, before: string): void {
  const directory = textPath(root);
  const hashes = storedHashes(db);
  const write = (file: string, text: string) => {
    writeAtomic(join(directory, file), text);
    hashes[file] = sha256(text);
  };
  write(REVISIONS_FILE, revisionsText(db));
  for (const spec of TABLES) {
    const changed = db.prepare(`SELECT 1 FROM ${sqlName(spec.table)} WHERE valid_from_revision > ? OR valid_to_revision > ? LIMIT 1`).get(before, before);
    if (changed !== undefined) write(spec.file, tableText(db, spec));
  }
  storeHashes(db, hashes);
}

/**
 * Runs `work` in one immediate transaction: all of it commits, or none of it
 * does. On the knowledge of a project, the index is made fresh from the text
 * first, and a work that adds a revision writes the changed knowledge files.
 */
export function transaction<T>(db: DatabaseSync, work: () => T): T {
  const root = projects.get(db);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (root !== undefined) freshen(db, root);
    const before = root === undefined ? "0" : newest(db);
    const result = work();
    if (root !== undefined && newest(db) !== before) writeText(db, root, before);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
