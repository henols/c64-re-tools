// The schema of the knowledge index, .c64-re-tools/local/knowledge.db.
// The index is made from the text in .c64-re-tools/knowledge/; an index with
// another version is emptied and made again.

import type { DatabaseSync } from "node:sqlite";

import { REFERENCE_KINDS, type ReferenceKind } from "../c64.ts";
import { OPERAND_SELECTS } from "./expression.ts";

/** heuristic: 6502 idioms that the static analysis finds by pattern; an analyzer origin. */
export const ORIGINS = ["user", "llm", "dxa", "ghidra", "heuristic"] as const;
export type Origin = (typeof ORIGINS)[number];
/** The origins of semantic knowledge: what the user or the LLM decided. It wins over analyzer facts. */
export const SEMANTIC_ORIGINS = ["user", "llm"] as const satisfies readonly Origin[];
/** The analyzers: their facts and names give way to semantic knowledge. */
export const ANALYZERS = ["dxa", "ghidra", "heuristic"] as const satisfies readonly Origin[];
export type Analyzer = (typeof ANALYZERS)[number];
export const isSemantic = (origin: string | undefined): boolean => (SEMANTIC_ORIGINS as readonly (string | undefined)[]).includes(origin);
export const isAnalyzer = (origin: string | undefined): boolean => (ANALYZERS as readonly (string | undefined)[]).includes(origin);
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
  "charset",
  "workspace",
  "unused",
  "dual-use",
] as const;
export type RegionType = (typeof REGION_TYPES)[number];
/** Region types that are code: a JMP table is code too. dual-use is neither code nor data. */
export const CODE_REGION_TYPES: readonly RegionType[] = ["code", "jumps"];
/** Region types that take no element size: their elements are instructions. */
export const NO_ELEMENT_TYPES: readonly RegionType[] = ["code", "jumps"];
export const MAX_ELEMENT = 256;
/** What a revision can name as its evidence: a coverage run, a test, any project file, or a note. */
export const EVIDENCE_KINDS = ["coverage", "test", "file", "note"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export const COMMENT_PLACEMENTS = ["line", "side"] as const;
export type CommentPlacement = (typeof COMMENT_PLACEMENTS)[number];
export { REFERENCE_KINDS, type ReferenceKind };
/** The reference kind that only operand expressions write: code that builds the address of a symbol. */
export const POINTER_KIND: ReferenceKind = "pointer";
export { OPERAND_SELECTS, type OperandSelect } from "./expression.ts";
/** What a suppression blocks: a symbol address, a region range or one reference. */
export const SUPPRESSION_ENTITIES = ["symbol", "region", "reference"] as const;
export type SuppressionEntity = (typeof SUPPRESSION_ENTITIES)[number];

/** A module file of the generated source: a plain name that ends in .asm, no directory. */
export const MODULE_FILE = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,59}\.asm$/;
/** A switch of the generated source: upper case, so it reads as a build option and not as a label. */
export const SWITCH_NAME = /^[A-Z][A-Z0-9_]{1,31}$/;
/** A release label: the switch-name form. The build of a release defines RELEASE_<label>. */
export const RELEASE_LABEL = SWITCH_NAME;
/** The define that builds a release with its switch values. */
export const RELEASE_DEFINE = "RELEASE_";
/**
 * What a switch changes. A copy protection, a trainer, a cheat and a change of
 * a cracker are off by default; a fix is on by default; a change has the
 * default that the writer gives.
 */
export const SWITCH_KINDS = ["protection", "trainer", "cheat", "crack", "fix", "change"] as const;
export type SwitchKind = (typeof SWITCH_KINDS)[number];
/** The kinds that are always off by default: the default build is the clean program. */
export const OFF_KINDS: readonly SwitchKind[] = ["protection", "trainer", "cheat", "crack"];
/**
 * The display mode of a start screen: a text screen, a hires bitmap or a
 * multicolour bitmap. The loader of the generated source shows it.
 */
export const START_SCREEN_MODES = ["text", "hires", "multicolour"] as const;
export type StartScreenMode = (typeof START_SCREEN_MODES)[number];
/** The switch of the start screen in the generated source: no symbol, switch or release can have this name. */
export const START_SCREEN_SWITCH = "START_SCREEN";
/** A macro name and a macro parameter. The body names a parameter with a dot in front: .dst. */
export const MACRO_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
export const MACRO_PARAM = /^[a-z_][a-z0-9_]{0,31}$/;

/**
 * The kinds of a coverage range, one for each flag of a coverage map
 * (COVERAGE in c64.ts), and wx: written and executed in the same run, so
 * self-modified code still shows after the runs are joined.
 */
export const COVERAGE_KINDS = ["r", "w", "x", "rom-r", "rom-x", "io-r", "io-w", "io-x", "wx"] as const;
export type CoverageKind = (typeof COVERAGE_KINDS)[number];
/** The most bytes of one memory row: a changed byte changes one short line of memory.jsonl. */
export const MEMORY_ROW = 64;

/** Files that c64-source writes itself: no module can have these names. */
export const GENERATED_FILES = ["main.asm", "loader.asm", "switches.asm", "config.asm", "constants.asm", "macros.asm", "start_screen.asm"] as const;

/** True for a generated file name in any letter case: the file systems of macOS and Windows ignore case. */
export function isGeneratedFile(file: string): boolean {
  return (GENERATED_FILES as readonly string[]).includes(file.toLowerCase());
}

/**
 * The address space of a knowledge row: a name that SPACE_PATTERN of c64.ts
 * accepts. Drive code and banks reuse C64 addresses.
 */
export type Space = string;
export const DEFAULT_SPACE: Space = "c64";
const SPACE_CHECK = "space IN ('c64', 'drive8') OR space GLOB 'bank[0-9]' OR space GLOB 'bank[1-9][0-9]' OR space GLOB 'bank[12][0-9][0-9]'";

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(", ");

/**
 * Creates the schema in an empty database. Knowledge rows are temporal: a
 * change closes the current row (valid_to_revision) and inserts a new one in
 * the same revision. Revision and row ids are the text ids of the knowledge
 * files; they sort in time order. The rules for current rows (one symbol at
 * an address, ...) are not unique indexes, because a merged text can break
 * them: the conflict check finds those rows (conflicts.ts).
 */
function createSchema(db: DatabaseSync): void {
    db.exec(`
      CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE revisions (
        id           TEXT PRIMARY KEY,
        created_at   TEXT NOT NULL,
        origin       TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        operation    TEXT NOT NULL,
        input_hash   TEXT,
        tool_version TEXT,
        description  TEXT,
        restored_revision TEXT,
        restored_space TEXT
      );
      CREATE TABLE symbols (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        name                TEXT NOT NULL CHECK (length(name) > 0),
        kind                TEXT NOT NULL CHECK (kind IN (${list(SYMBOL_KINDS)})),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX symbols_current_address ON symbols (space, address) WHERE valid_to_revision IS NULL;
      CREATE INDEX symbols_current_name ON symbols (space, name) WHERE valid_to_revision IS NULL;
      CREATE INDEX symbols_address ON symbols (space, address);
      CREATE TABLE analyzer_names (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        name                TEXT NOT NULL CHECK (length(name) > 0),
        kind                TEXT NOT NULL CHECK (kind IN (${list(SYMBOL_KINDS)})),
        origin              TEXT NOT NULL CHECK (origin IN ('dxa', 'ghidra', 'heuristic')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX analyzer_names_address ON analyzer_names (space, address);
      CREATE INDEX analyzer_names_name ON analyzer_names (space, name);
      CREATE TABLE regions (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        start_address       INTEGER NOT NULL CHECK (start_address BETWEEN 0 AND 65535),
        end_address         INTEGER NOT NULL CHECK (end_address BETWEEN start_address AND 65535),
        type                TEXT NOT NULL CHECK (type IN (${list(REGION_TYPES)})),
        element             INTEGER CHECK (element BETWEEN 1 AND ${MAX_ELEMENT}),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX regions_start ON regions (space, start_address);
      CREATE TABLE evidence (
        id       INTEGER PRIMARY KEY,
        revision TEXT NOT NULL REFERENCES revisions (id),
        kind     TEXT NOT NULL CHECK (kind IN (${list(EVIDENCE_KINDS)})),
        ref      TEXT NOT NULL CHECK (length(ref) > 0),
        sha256   TEXT CHECK (sha256 IS NULL OR length(sha256) = 64),
        space    TEXT CHECK (space IS NULL OR ${SPACE_CHECK})
      );
      CREATE INDEX evidence_revision ON evidence (revision);
      CREATE TABLE comments (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        placement           TEXT NOT NULL CHECK (placement IN (${list(COMMENT_PLACEMENTS)})),
        text                TEXT NOT NULL CHECK (length(text) > 0),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX comments_current ON comments (space, address, placement) WHERE valid_to_revision IS NULL;
      CREATE INDEX comments_address ON comments (space, address);
      CREATE TABLE "references" (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        from_address        INTEGER NOT NULL CHECK (from_address BETWEEN 0 AND 65535),
        to_address          INTEGER NOT NULL CHECK (to_address BETWEEN 0 AND 65535),
        kind                TEXT NOT NULL CHECK (kind IN (${list(REFERENCE_KINDS)})),
        origin              TEXT NOT NULL CHECK (origin IN (${list(ORIGINS)})),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX references_current ON "references" (space, from_address, to_address, kind) WHERE valid_to_revision IS NULL;
      CREATE INDEX references_from ON "references" (space, from_address);
      CREATE INDEX references_to ON "references" (space, to_address);
      CREATE TABLE suppressions (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        entity              TEXT NOT NULL CHECK (entity IN (${list(SUPPRESSION_ENTITIES)})),
        start_address       INTEGER NOT NULL CHECK (start_address BETWEEN 0 AND 65535),
        end_address         INTEGER NOT NULL CHECK (end_address BETWEEN start_address AND 65535),
        to_address          INTEGER CHECK (to_address BETWEEN 0 AND 65535),
        kind                TEXT CHECK (kind IN (${list(REFERENCE_KINDS)})),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id),
        CHECK ((entity = 'reference') = (to_address IS NOT NULL AND kind IS NOT NULL)),
        CHECK (entity = 'region' OR start_address = end_address)
      );
      CREATE INDEX suppressions_start ON suppressions (space, start_address);
      CREATE TABLE modules (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        start_address       INTEGER NOT NULL CHECK (start_address BETWEEN 0 AND 65535),
        file                TEXT NOT NULL CHECK (length(file) > 0),
        title               TEXT CHECK (title IS NULL OR length(title) > 0),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX modules_current_start ON modules (space, start_address) WHERE valid_to_revision IS NULL;
      CREATE INDEX modules_current_file ON modules (space, file) WHERE valid_to_revision IS NULL;
      CREATE TABLE operands (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        selector            TEXT NOT NULL CHECK (selector IN (${list(OPERAND_SELECTS)})),
        symbol              TEXT CHECK (symbol IS NULL OR length(symbol) > 0),
        offset              INTEGER NOT NULL DEFAULT 0,
        expression          TEXT CHECK (expression IS NULL OR length(expression) > 0),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id),
        CHECK ((selector = 'expr') = (expression IS NOT NULL AND symbol IS NULL AND offset = 0)),
        CHECK (selector = 'expr' OR symbol IS NOT NULL)
      );
      CREATE INDEX operands_current ON operands (space, address) WHERE valid_to_revision IS NULL;
      CREATE INDEX operands_address ON operands (space, address);
      CREATE TABLE patches (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        start_address       INTEGER NOT NULL CHECK (start_address BETWEEN 0 AND 65535),
        end_address         INTEGER NOT NULL CHECK (end_address BETWEEN start_address AND 65535),
        switch_name         TEXT NOT NULL CHECK (length(switch_name) > 0),
        code                TEXT NOT NULL,
        comment             TEXT CHECK (comment IS NULL OR length(comment) > 0),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX patches_start ON patches (space, start_address);
      CREATE TABLE switches (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        name                TEXT NOT NULL CHECK (length(name) > 0),
        kind                TEXT NOT NULL CHECK (kind IN (${list(SWITCH_KINDS)})),
        default_value       INTEGER NOT NULL CHECK (default_value IN (0, 1)),
        releases            TEXT NOT NULL,
        comment             TEXT CHECK (comment IS NULL OR length(comment) > 0),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX switches_name ON switches (space, name);
      CREATE TABLE releases (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        label               TEXT NOT NULL CHECK (length(label) > 0),
        file                TEXT NOT NULL CHECK (length(file) > 0),
        sha256              TEXT NOT NULL CHECK (length(sha256) = 64),
        base                INTEGER NOT NULL CHECK (base IN (0, 1)),
        comment             TEXT CHECK (comment IS NULL OR length(comment) > 0),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX releases_label ON releases (space, label);
      CREATE TABLE macros (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        name                TEXT NOT NULL CHECK (length(name) > 0),
        params              TEXT NOT NULL,
        body                TEXT NOT NULL CHECK (length(body) > 0),
        comment             TEXT CHECK (comment IS NULL OR length(comment) > 0),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX macros_name ON macros (space, name);
      CREATE TABLE start_screens (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (space = 'c64'),
        mode                TEXT NOT NULL CHECK (mode IN (${list(START_SCREEN_MODES)})),
        screen              INTEGER NOT NULL CHECK (screen BETWEEN 0 AND 65535),
        bitmap              INTEGER CHECK (bitmap BETWEEN 0 AND 65535),
        charset             INTEGER CHECK (charset BETWEEN 0 AND 65535),
        colours             INTEGER CHECK (colours BETWEEN 0 AND 65535),
        colour              INTEGER CHECK (colour BETWEEN 0 AND 15),
        border              INTEGER NOT NULL CHECK (border BETWEEN 0 AND 15),
        background          INTEGER NOT NULL CHECK (background BETWEEN 0 AND 15),
        comment             TEXT CHECK (comment IS NULL OR length(comment) > 0),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id),
        CHECK ((mode = 'text') = (charset IS NOT NULL)),
        CHECK ((mode = 'text') = (bitmap IS NULL)),
        CHECK (colours IS NULL OR colour IS NULL),
        CHECK ((mode = 'hires') = (colours IS NULL AND colour IS NULL))
      );
      CREATE INDEX start_screens_space ON start_screens (space);
      CREATE TABLE macro_uses (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        start_address       INTEGER NOT NULL CHECK (start_address BETWEEN 0 AND 65535),
        end_address         INTEGER NOT NULL CHECK (end_address BETWEEN start_address AND 65535),
        macro               TEXT NOT NULL CHECK (length(macro) > 0),
        args                TEXT NOT NULL,
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX macro_uses_start ON macro_uses (space, start_address);
      CREATE TABLE memory (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        bytes               TEXT NOT NULL CHECK (length(bytes) BETWEEN 2 AND ${MEMORY_ROW * 2} AND length(bytes) % 2 = 0 AND address + length(bytes) / 2 <= 65536),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX memory_current ON memory (space, address) WHERE valid_to_revision IS NULL;
      CREATE TABLE entries (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        address             INTEGER NOT NULL CHECK (address BETWEEN 0 AND 65535),
        state               TEXT,
        stages              TEXT,
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX entries_current ON entries (space) WHERE valid_to_revision IS NULL;
      CREATE TABLE coverage (
        id                  TEXT PRIMARY KEY,
        space               TEXT NOT NULL DEFAULT 'c64' CHECK (${SPACE_CHECK}),
        kind                TEXT NOT NULL CHECK (kind IN (${list(COVERAGE_KINDS)})),
        start_address       INTEGER NOT NULL CHECK (start_address BETWEEN 0 AND 65535),
        end_address         INTEGER NOT NULL CHECK (end_address BETWEEN start_address AND 65535),
        origin              TEXT NOT NULL CHECK (origin IN ('user', 'llm')),
        valid_from_revision TEXT NOT NULL REFERENCES revisions (id),
        valid_to_revision   TEXT REFERENCES revisions (id)
      );
      CREATE INDEX coverage_current ON coverage (space, kind) WHERE valid_to_revision IS NULL;
      CREATE VIEW current_memory AS SELECT * FROM memory WHERE valid_to_revision IS NULL;
      CREATE VIEW current_entries AS SELECT * FROM entries WHERE valid_to_revision IS NULL;
      CREATE VIEW current_coverage AS SELECT * FROM coverage WHERE valid_to_revision IS NULL;
      CREATE VIEW current_symbols AS SELECT * FROM symbols WHERE valid_to_revision IS NULL;
      CREATE VIEW current_analyzer_names AS SELECT * FROM analyzer_names WHERE valid_to_revision IS NULL;
      CREATE VIEW current_regions AS SELECT * FROM regions WHERE valid_to_revision IS NULL;
      CREATE VIEW current_comments AS SELECT * FROM comments WHERE valid_to_revision IS NULL;
      CREATE VIEW current_references AS SELECT * FROM "references" WHERE valid_to_revision IS NULL;
      CREATE VIEW current_suppressions AS SELECT * FROM suppressions WHERE valid_to_revision IS NULL;
      CREATE VIEW current_modules AS SELECT * FROM modules WHERE valid_to_revision IS NULL;
      CREATE VIEW current_operands AS SELECT * FROM operands WHERE valid_to_revision IS NULL;
      CREATE VIEW current_patches AS SELECT * FROM patches WHERE valid_to_revision IS NULL;
      CREATE VIEW current_switches AS SELECT * FROM switches WHERE valid_to_revision IS NULL;
      CREATE VIEW current_releases AS SELECT * FROM releases WHERE valid_to_revision IS NULL;
      CREATE VIEW current_macros AS SELECT * FROM macros WHERE valid_to_revision IS NULL;
      CREATE VIEW current_macro_uses AS SELECT * FROM macro_uses WHERE valid_to_revision IS NULL;
      CREATE VIEW current_start_screens AS SELECT * FROM start_screens WHERE valid_to_revision IS NULL;
    `);
}

/** The version of the index this build makes. An index with another version is emptied and made again. */
export const INDEX_VERSION = 10;

function indexVersion(db: DatabaseSync): number | undefined {
  const hasMeta = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get();
  if (hasMeta === undefined) return undefined;
  const row = db.prepare("SELECT value FROM meta WHERE key = 'index_version'").get() as { value: unknown } | undefined;
  return row === undefined ? undefined : Number(row.value);
}

/** Drops every table and view of the database; the indexes go with their tables. */
function dropAll(db: DatabaseSync): void {
  const objects = db.prepare("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('view', 'table')").all() as Array<{ type: string; name: string }>;
  for (const { name } of objects.filter((object) => object.type === "view")) db.exec(`DROP VIEW "${name}"`);
  for (const { name } of objects.filter((object) => object.type === "table")) db.exec(`DROP TABLE "${name}"`);
}

/**
 * Makes the index schema of this build. An empty database gets it; a database
 * with another index version, or one that is not an index, is emptied first.
 * The version is read again under the write lock, so two processes that open
 * a new index at the same time make the schema once.
 */
export function ensureSchema(db: DatabaseSync): void {
  if (indexVersion(db) === INDEX_VERSION) return;
  // PRAGMA foreign_keys has no effect inside a transaction: switch it before.
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN IMMEDIATE");
  try {
    if (indexVersion(db) !== INDEX_VERSION) {
      dropAll(db);
      createSchema(db);
      db.prepare("INSERT INTO meta (key, value) VALUES ('index_version', ?)").run(String(INDEX_VERSION));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}
