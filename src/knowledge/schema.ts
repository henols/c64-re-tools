// The knowledge.db schema: one version, created in an empty database.

import type { DatabaseSync } from "node:sqlite";

import { REFERENCE_KINDS, type ReferenceKind } from "../c64.ts";
import { KnowledgeError } from "./database.ts";
import { OPERAND_SELECTS } from "./expression.ts";

/** heuristic: 6502 idioms that the static analysis finds by pattern (D44); an analyzer origin. */
export const ORIGINS = ["user", "llm", "dxa", "ghidra", "heuristic"] as const;
export type Origin = (typeof ORIGINS)[number];
export const SYMBOL_KINDS = ["label", "routine", "variable", "data", "vector"] as const;
export type SymbolKind = (typeof SYMBOL_KINDS)[number];
export const REGION_TYPES = [
  "code",
  "bytes",
  "words",
  "addresses",
  "addresses-split",
  "rts-addresses",
  "rts-addresses-split",
  "jumps",
  "petscii",
  "screen",
  "bitmap",
  "sprite",
  "workspace",
  "unused",
  "dual-use",
] as const;
export type RegionType = (typeof REGION_TYPES)[number];
/** Region types that are code: a JMP table is code too. dual-use is neither code nor data (D42). */
export const CODE_REGION_TYPES: readonly RegionType[] = ["code", "jumps"];
/** Region types that take no element size: their elements are instructions. */
export const NO_ELEMENT_TYPES: readonly RegionType[] = ["code", "jumps"];
export const MAX_ELEMENT = 256;
/** What a revision can name as its evidence (D42): a coverage run, a test, any project file, or a note. */
export const EVIDENCE_KINDS = ["coverage", "test", "file", "note"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export const COMMENT_PLACEMENTS = ["line", "side"] as const;
export type CommentPlacement = (typeof COMMENT_PLACEMENTS)[number];
export { REFERENCE_KINDS, type ReferenceKind };
/** The reference kind that only operand expressions write (D65): code that builds the address of a symbol. */
export const POINTER_KIND: ReferenceKind = "pointer";
export { OPERAND_SELECTS, type OperandSelect } from "./expression.ts";
/** What a suppression blocks: a symbol address, a region range or one reference (D36). */
export const SUPPRESSION_ENTITIES = ["symbol", "region", "reference"] as const;
export type SuppressionEntity = (typeof SUPPRESSION_ENTITIES)[number];

/** A module file of the generated source (D48): a plain name that ends in .asm, no directory. */
export const MODULE_FILE = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,59}\.asm$/;
/** Files that c64-source writes itself: no module can have these names. */
export const GENERATED_FILES = ["main.asm", "loader.asm", "constants.asm"] as const;

/** True for a generated file name in any letter case: the file systems of macOS and Windows ignore case. */
export function isGeneratedFile(file: string): boolean {
  return (GENERATED_FILES as readonly string[]).includes(file.toLowerCase());
}

/**
 * The address space of a knowledge row (D53): the C64, the 1541 drive, or a
 * cartridge bank. Drive code and banks reuse C64 addresses.
 */
export const SPACE = /^(c64|drive8|bank(0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5]))$/;
export type Space = string;
export const DEFAULT_SPACE: Space = "c64";
const SPACE_CHECK = "space IN ('c64', 'drive8') OR space GLOB 'bank[0-9]' OR space GLOB 'bank[1-9][0-9]' OR space GLOB 'bank[12][0-9][0-9]'";

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(", ");

/** The schema version this build reads and writes. */
export const SCHEMA_VERSION = 7;

/**
 * Creates the schema in an empty database. Knowledge rows are temporal: a
 * change closes the current row (valid_to_revision) and inserts a new one in
 * the same revision.
 */
function createSchema(db: DatabaseSync): void {
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
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        name                TEXT NOT NULL CHECK (length(name) > 0),
        kind                TEXT NOT NULL CHECK (kind IN (${list(SYMBOL_KINDS)})),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id)
      );
      CREATE UNIQUE INDEX symbols_current_address ON symbols (space, address) WHERE valid_to_revision IS NULL;
      CREATE UNIQUE INDEX symbols_current_name ON symbols (space, name) WHERE valid_to_revision IS NULL;
      CREATE INDEX symbols_address ON symbols (space, address);
      CREATE TABLE regions (
        id                  INTEGER PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        start_address       INTEGER NOT NULL CHECK (start_address BETWEEN 0 AND 65535),
        end_address         INTEGER NOT NULL CHECK (end_address BETWEEN start_address AND 65535),
        type                TEXT NOT NULL CHECK (type IN (${list(REGION_TYPES)})),
        element             INTEGER CHECK (element BETWEEN 1 AND ${MAX_ELEMENT}),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id)
      );
      CREATE INDEX regions_start ON regions (space, start_address);
      CREATE TABLE evidence (
        id       INTEGER PRIMARY KEY,
        revision INTEGER NOT NULL REFERENCES revisions (id),
        kind     TEXT NOT NULL CHECK (kind IN (${list(EVIDENCE_KINDS)})),
        ref      TEXT NOT NULL CHECK (length(ref) > 0),
        sha256   TEXT CHECK (sha256 IS NULL OR length(sha256) = 64)
      );
      CREATE INDEX evidence_revision ON evidence (revision);
      CREATE TABLE comments (
        id                  INTEGER PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        placement           TEXT NOT NULL CHECK (placement IN (${list(COMMENT_PLACEMENTS)})),
        text                TEXT NOT NULL CHECK (length(text) > 0),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id)
      );
      CREATE UNIQUE INDEX comments_current ON comments (space, address, placement) WHERE valid_to_revision IS NULL;
      CREATE INDEX comments_address ON comments (space, address);
      CREATE TABLE "references" (
        id                  INTEGER PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        from_address        INTEGER NOT NULL CHECK (from_address BETWEEN 0 AND 65535),
        to_address          INTEGER NOT NULL CHECK (to_address BETWEEN 0 AND 65535),
        kind                TEXT NOT NULL CHECK (kind IN (${list(REFERENCE_KINDS)})),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id)
      );
      CREATE UNIQUE INDEX references_current ON "references" (space, from_address, to_address, kind) WHERE valid_to_revision IS NULL;
      CREATE INDEX references_from ON "references" (space, from_address);
      CREATE INDEX references_to ON "references" (space, to_address);
      CREATE TABLE suppressions (
        id                  INTEGER PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        entity              TEXT NOT NULL CHECK (entity IN (${list(SUPPRESSION_ENTITIES)})),
        start_address       INTEGER NOT NULL CHECK (start_address BETWEEN 0 AND 65535),
        end_address         INTEGER NOT NULL CHECK (end_address BETWEEN start_address AND 65535),
        to_address          INTEGER CHECK (to_address BETWEEN 0 AND 65535),
        kind                TEXT CHECK (kind IN (${list(REFERENCE_KINDS)})),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id),
        CHECK ((entity = 'reference') = (to_address IS NOT NULL AND kind IS NOT NULL)),
        CHECK (entity = 'region' OR start_address = end_address)
      );
      CREATE INDEX suppressions_start ON suppressions (space, start_address);
      CREATE TABLE modules (
        id                  INTEGER PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        start_address       INTEGER NOT NULL CHECK (start_address BETWEEN 0 AND 65535),
        file                TEXT NOT NULL CHECK (length(file) > 0),
        title               TEXT CHECK (title IS NULL OR length(title) > 0),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id)
      );
      CREATE UNIQUE INDEX modules_current_start ON modules (space, start_address) WHERE valid_to_revision IS NULL;
      CREATE UNIQUE INDEX modules_current_file ON modules (space, file) WHERE valid_to_revision IS NULL;
      CREATE TABLE operands (
        id                  INTEGER PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        selector            TEXT NOT NULL CHECK (selector IN (${list(OPERAND_SELECTS)})),
        symbol              TEXT CHECK (symbol IS NULL OR length(symbol) > 0),
        offset              INTEGER NOT NULL DEFAULT 0,
        expression          TEXT CHECK (expression IS NULL OR length(expression) > 0),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision INTEGER NOT NULL REFERENCES revisions (id),
        valid_to_revision   INTEGER REFERENCES revisions (id),
        CHECK ((selector = 'expr') = (expression IS NOT NULL AND symbol IS NULL AND offset = 0)),
        CHECK (selector = 'expr' OR symbol IS NOT NULL)
      );
      CREATE UNIQUE INDEX operands_current ON operands (space, address) WHERE valid_to_revision IS NULL;
      CREATE INDEX operands_address ON operands (space, address);
      CREATE VIEW current_symbols AS SELECT * FROM symbols WHERE valid_to_revision IS NULL;
      CREATE VIEW current_regions AS SELECT * FROM regions WHERE valid_to_revision IS NULL;
      CREATE VIEW current_comments AS SELECT * FROM comments WHERE valid_to_revision IS NULL;
      CREATE VIEW current_references AS SELECT * FROM "references" WHERE valid_to_revision IS NULL;
      CREATE VIEW current_suppressions AS SELECT * FROM suppressions WHERE valid_to_revision IS NULL;
      CREATE VIEW current_modules AS SELECT * FROM modules WHERE valid_to_revision IS NULL;
      CREATE VIEW current_operands AS SELECT * FROM operands WHERE valid_to_revision IS NULL;
      INSERT INTO meta (key, value) VALUES ('current_revision', '0');
    `);
}

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

/** Refuses a database with any schema version other than the one this build reads and writes. */
export function checkVersion(version: number): void {
  if (version !== SCHEMA_VERSION) {
    throw new KnowledgeError(
      "unsupported-schema",
      `The knowledge database has schema version ${version}. This c64-re-tools reads and writes only version ${SCHEMA_VERSION}. Use the c64-re-tools release that wrote it.`,
    );
  }
}

/**
 * Creates the schema in an empty database and refuses any other version. The
 * version is read again under the write lock, so two processes that open a
 * new database at the same time create the schema once.
 */
export function ensureSchema(db: DatabaseSync): void {
  if (schemaVersion(db) === 0) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (schemaVersion(db) === 0) {
        createSchema(db);
        db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  checkVersion(schemaVersion(db));
}
