// The knowledge.db schema and its deterministic forward migrations.

import type { DatabaseSync } from "node:sqlite";

import { REFERENCE_KINDS, type ReferenceKind } from "../c64.ts";
import { KnowledgeError } from "./database.ts";

export const ORIGINS = ["user", "llm", "dxa", "ghidra"] as const;
export type Origin = (typeof ORIGINS)[number];
export const SYMBOL_KINDS = ["label", "routine", "variable", "data", "vector"] as const;
export type SymbolKind = (typeof SYMBOL_KINDS)[number];
export const REGION_TYPES = ["code", "bytes", "words", "addresses", "addresses-split", "petscii", "screen", "bitmap", "sprite"] as const;
export type RegionType = (typeof REGION_TYPES)[number];
export const COMMENT_PLACEMENTS = ["line", "side"] as const;
export type CommentPlacement = (typeof COMMENT_PLACEMENTS)[number];
export { REFERENCE_KINDS, type ReferenceKind };

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(", ");

/** Each entry migrates from version (index) to version (index + 1). */
const MIGRATIONS: ReadonlyArray<(db: DatabaseSync) => void> = [
  // 0 -> 1: the v1 schema. Knowledge rows are temporal: a change closes the
  // current row (valid_to_revision) and inserts a new one in the same revision.
  (db) => {
    db.exec(`
      CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE revisions (
        id           INTEGER PRIMARY KEY,
        created_at   TEXT NOT NULL,
        origin       TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        operation    TEXT NOT NULL,
        input_hash   TEXT,
        tool_version TEXT,
        description  TEXT
      );
      CREATE TABLE symbols (
        id                  INTEGER PRIMARY KEY,
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        name                TEXT NOT NULL CHECK (length(name) > 0),
        kind                TEXT NOT NULL CHECK (kind IN (${list(SYMBOL_KINDS)})),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id)
      );
      CREATE UNIQUE INDEX symbols_current_address ON symbols (address) WHERE valid_to_revision IS NULL;
      CREATE UNIQUE INDEX symbols_current_name ON symbols (name) WHERE valid_to_revision IS NULL;
      CREATE INDEX symbols_address ON symbols (address);
      CREATE TABLE regions (
        id                  INTEGER PRIMARY KEY,
        start_address       INTEGER NOT NULL CHECK (start_address BETWEEN 0 AND 65535),
        end_address         INTEGER NOT NULL CHECK (end_address BETWEEN start_address AND 65535),
        type                TEXT NOT NULL CHECK (type IN (${list(REGION_TYPES)})),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id)
      );
      CREATE INDEX regions_start ON regions (start_address);
      CREATE TABLE comments (
        id                  INTEGER PRIMARY KEY,
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        placement           TEXT NOT NULL CHECK (placement IN (${list(COMMENT_PLACEMENTS)})),
        text                TEXT NOT NULL CHECK (length(text) > 0),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id)
      );
      CREATE UNIQUE INDEX comments_current ON comments (address, placement) WHERE valid_to_revision IS NULL;
      CREATE INDEX comments_address ON comments (address);
      CREATE TABLE "references" (
        id                  INTEGER PRIMARY KEY,
        from_address        INTEGER NOT NULL CHECK (from_address BETWEEN 0 AND 65535),
        to_address          INTEGER NOT NULL CHECK (to_address BETWEEN 0 AND 65535),
        kind                TEXT NOT NULL CHECK (kind IN (${list(REFERENCE_KINDS)})),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id)
      );
      CREATE UNIQUE INDEX references_current ON "references" (from_address, to_address, kind) WHERE valid_to_revision IS NULL;
      CREATE INDEX references_from ON "references" (from_address);
      CREATE INDEX references_to ON "references" (to_address);
      CREATE VIEW current_symbols AS SELECT * FROM symbols WHERE valid_to_revision IS NULL;
      CREATE VIEW current_regions AS SELECT * FROM regions WHERE valid_to_revision IS NULL;
      CREATE VIEW current_comments AS SELECT * FROM comments WHERE valid_to_revision IS NULL;
      CREATE VIEW current_references AS SELECT * FROM "references" WHERE valid_to_revision IS NULL;
      INSERT INTO meta (key, value) VALUES ('current_revision', '0');
    `);
  },
];

/** The schema version this build writes. */
export const SCHEMA_VERSION = MIGRATIONS.length;

export function schemaVersion(db: DatabaseSync): number {
  const hasMeta = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get();
  if (hasMeta === undefined) {
    const tables = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number };
    if (tables.n > 0) throw new KnowledgeError("invalid-database", "The knowledge database has tables but no meta table; it is not a c64-re-tools database.");
    return 0;
  }
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: unknown } | undefined;
  if (row === undefined) throw new KnowledgeError("invalid-database", "The knowledge database has no schema version.");
  const value = String(row.value);
  if (!/^(0|[1-9][0-9]{0,8})$/.test(value)) throw new KnowledgeError("invalid-database", `The schema version of the knowledge database is not a whole number: ${JSON.stringify(value)}.`);
  return Number(value);
}

function checkSupported(version: number): void {
  if (version > SCHEMA_VERSION) {
    throw new KnowledgeError(
      "unsupported-migration",
      `The knowledge database has schema version ${version}; this c64-re-tools understands up to ${SCHEMA_VERSION}. Install a newer c64-re-tools.`,
    );
  }
}

/**
 * Brings the schema to SCHEMA_VERSION, each step in its own transaction.
 * Refuses a database written by a newer c64-re-tools. Each step reads the
 * version again under the write lock, so two processes that open a new
 * database at the same time do not both run the same step.
 */
export function migrate(db: DatabaseSync): void {
  for (;;) {
    const version = schemaVersion(db);
    checkSupported(version);
    if (version === SCHEMA_VERSION) return;
    db.exec("BEGIN IMMEDIATE");
    try {
      const locked = schemaVersion(db);
      checkSupported(locked);
      if (locked < SCHEMA_VERSION) {
        MIGRATIONS[locked]!(db);
        db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(String(locked + 1));
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
