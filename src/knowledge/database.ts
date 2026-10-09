// The one place that opens .c64-re-tools/knowledge.db.

import { existsSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

import { projectRoot } from "../project.ts";
import { migrate } from "./schema.ts";

export const KNOWLEDGE_DIRECTORY = ".c64-re-tools";
export const KNOWLEDGE_FILE = "knowledge.db";

export const KNOWLEDGE_ERROR_CODES = [
  "invalid-input",
  "not-found",
  "conflict",
  "stale-revision",
  "invalid-database",
  "unsupported-migration",
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

export function knowledgePath(root: string = projectRoot()): string {
  return join(root, KNOWLEDGE_DIRECTORY, KNOWLEDGE_FILE);
}

function configure(db: DatabaseSync): void {
  // A committed write must be complete in knowledge.db itself: rollback journal, never WAL.
  db.exec("PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
}

function open(path: string): DatabaseSync {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(path);
    configure(db);
    db.prepare("SELECT count(*) FROM sqlite_master").get();
  } catch (error) {
    throw new KnowledgeError("invalid-database", `${KNOWLEDGE_DIRECTORY}/${KNOWLEDGE_FILE} is not a readable SQLite database: ${(error as Error).message}`);
  }
  return db;
}

/**
 * Opens the project's knowledge database, migrating it to this build's schema.
 * Returns undefined when it does not exist: a missing database reads as empty
 * knowledge and is not created by a read.
 */
export function openForRead(root: string = projectRoot()): DatabaseSync | undefined {
  const path = knowledgePath(root);
  if (!existsSync(path)) return undefined;
  const db = open(path);
  try {
    migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

/** Opens the project's knowledge database for a write, creating .c64-re-tools/knowledge.db when needed. */
export function openForWrite(root: string = projectRoot()): DatabaseSync {
  const path = knowledgePath(root);
  mkdirSync(join(root, KNOWLEDGE_DIRECTORY), { recursive: true });
  const db = open(path);
  try {
    migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

/**
 * Runs one write on the project's knowledge database and closes it. When the
 * project has no knowledge.db yet, `work` first runs on an empty database in
 * memory: a write that is refused there creates no .c64-re-tools/. `work`
 * must change nothing outside the database it gets.
 */
export function withWrite<T>(work: (db: DatabaseSync) => T, root: string = projectRoot()): T {
  if (!existsSync(knowledgePath(root))) {
    const trial = new DatabaseSync(":memory:");
    try {
      configure(trial);
      migrate(trial);
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

/** Runs `work` in one immediate transaction: all of it commits, or none of it does. */
export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
