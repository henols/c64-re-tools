// Knowledge history: what used to be known, which revision changed
// it, who changed it and why. History rows are never deleted.

import type { DatabaseSync } from "node:sqlite";

import { KnowledgeError } from "./database.ts";
import {
  COMMENT_COLUMNS,
  MACRO_COLUMNS,
  MACRO_USE_COLUMNS,
  MODULE_COLUMNS,
  OPERAND_COLUMNS,
  PATCH_COLUMNS,
  REFERENCE_COLUMNS,
  REGION_COLUMNS,
  resolveRevision,
  SUPPRESSION_COLUMNS,
  SYMBOL_COLUMNS,
  toComment,
  toMacro,
  toMacroUse,
  toModule,
  toOperand,
  toPatch,
  toReference,
  toRegion,
  toSuppression,
  toSymbol,
  type CommentRow,
  type MacroRow,
  type MacroUseRow,
  type ModuleRow,
  type OperandRow,
  type PatchRow,
  type ReferenceRow,
  type RegionRow,
  type SuppressionRow,
  type SymbolRow,
} from "./read.ts";
import { DEFAULT_SPACE, type EvidenceKind, type Origin, type Space } from "./schema.ts";
import { compareText } from "./text.ts";
import type { Evidence } from "./write.ts";

export interface Revision {
  id: string;
  createdAt: string;
  origin: Origin;
  operation: string;
  description?: string;
  inputHash?: string;
  toolVersion?: string;
  /** What the change rests on (D42). */
  evidence?: Evidence[];
}

/** One knowledge row with its validity: from its first revision until the revision that closed it. */
export type HistoryEntry =
  | { entity: "symbol"; row: SymbolRow; from: string; to?: string }
  | { entity: "analyzer-name"; row: SymbolRow; from: string; to?: string }
  | { entity: "region"; row: RegionRow; from: string; to?: string }
  | { entity: "comment"; row: CommentRow; from: string; to?: string }
  | { entity: "reference"; row: ReferenceRow; from: string; to?: string }
  | { entity: "suppression"; row: SuppressionRow; from: string; to?: string }
  | { entity: "module"; row: ModuleRow; from: string; to?: string }
  | { entity: "operand"; row: OperandRow; from: string; to?: string }
  | { entity: "patch"; row: PatchRow; from: string; to?: string }
  | { entity: "macro"; row: MacroRow; from: string; to?: string }
  | { entity: "macro-use"; row: MacroUseRow; from: string; to?: string };

type Raw = Record<string, unknown>;

function toRevision(row: Raw): Revision {
  const revision: Revision = {
    id: row.id as string,
    createdAt: row.created_at as string,
    origin: row.origin as Origin,
    operation: row.operation as string,
  };
  if (row.description !== null) revision.description = row.description as string;
  if (row.input_hash !== null) revision.inputHash = row.input_hash as string;
  if (row.tool_version !== null) revision.toolVersion = row.tool_version as string;
  return revision;
}

function entry<E extends HistoryEntry["entity"]>(entity: E, row: unknown, raw: Raw): HistoryEntry {
  const result = { entity, row, from: raw.valid_from_revision as string } as HistoryEntry;
  if (raw.valid_to_revision !== null) result.to = raw.valid_to_revision as string;
  return result;
}

/** Revision ids sort in time order as text (D69); a current row sorts after every closed one. */
function bySequence(a: HistoryEntry, b: HistoryEntry): number {
  return compareText(a.from, b.from) || compareText(a.to ?? "~", b.to ?? "~");
}

/** Every row, current or closed, that concerns one address of a space, oldest first. */
export function historyAt(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): HistoryEntry[] {
  if (db === undefined) return [];
  const validity = ", valid_to_revision";
  const entries: HistoryEntry[] = [];
  for (const raw of db.prepare(`SELECT ${SYMBOL_COLUMNS}${validity} FROM symbols WHERE space = ? AND address = ?`).all(space, address) as Raw[]) entries.push(entry("symbol", toSymbol(raw), raw));
  for (const raw of db.prepare(`SELECT ${SYMBOL_COLUMNS}${validity} FROM analyzer_names WHERE space = ? AND address = ?`).all(space, address) as Raw[]) entries.push(entry("analyzer-name", toSymbol(raw), raw));
  for (const raw of db.prepare(`SELECT ${REGION_COLUMNS}${validity} FROM regions WHERE space = ? AND start_address <= ? AND end_address >= ?`).all(space, address, address) as Raw[]) {
    entries.push(entry("region", toRegion(raw), raw));
  }
  for (const raw of db.prepare(`SELECT ${COMMENT_COLUMNS}${validity} FROM comments WHERE space = ? AND address = ?`).all(space, address) as Raw[]) entries.push(entry("comment", toComment(raw), raw));
  for (const raw of db.prepare(`SELECT ${REFERENCE_COLUMNS}${validity} FROM "references" WHERE space = ? AND (from_address = ? OR to_address = ?)`).all(space, address, address) as Raw[]) {
    entries.push(entry("reference", toReference(raw), raw));
  }
  for (const raw of db
    .prepare(`SELECT ${SUPPRESSION_COLUMNS}${validity} FROM suppressions WHERE space = ? AND ((start_address <= ? AND end_address >= ?) OR to_address = ?)`)
    .all(space, address, address, address) as Raw[]) {
    entries.push(entry("suppression", toSuppression(raw), raw));
  }
  for (const raw of db.prepare(`SELECT ${MODULE_COLUMNS}${validity} FROM modules WHERE space = ? AND start_address = ?`).all(space, address) as Raw[]) entries.push(entry("module", toModule(raw), raw));
  for (const raw of db.prepare(`SELECT ${OPERAND_COLUMNS}${validity} FROM operands WHERE space = ? AND address = ?`).all(space, address) as Raw[]) entries.push(entry("operand", toOperand(raw), raw));
  for (const raw of db.prepare(`SELECT ${PATCH_COLUMNS}${validity} FROM patches WHERE space = ? AND start_address <= ? AND end_address >= ?`).all(space, address, address) as Raw[]) {
    entries.push(entry("patch", toPatch(raw), raw));
  }
  for (const raw of db.prepare(`SELECT ${MACRO_USE_COLUMNS}${validity} FROM macro_uses WHERE space = ? AND start_address <= ? AND end_address >= ?`).all(space, address, address) as Raw[]) {
    entries.push(entry("macro-use", toMacroUse(raw), raw));
  }
  return entries.sort(bySequence);
}

/** Every row of a macro with this name, and every use of it, oldest first. */
export function historyOfMacro(db: DatabaseSync | undefined, name: string, space: Space = DEFAULT_SPACE): HistoryEntry[] {
  if (db === undefined) return [];
  const macros = (db.prepare(`SELECT ${MACRO_COLUMNS}, valid_to_revision FROM macros WHERE space = ? AND name = ?`).all(space, name) as Raw[]).map((raw) => entry("macro", toMacro(raw), raw));
  const uses = (db.prepare(`SELECT ${MACRO_USE_COLUMNS}, valid_to_revision FROM macro_uses WHERE space = ? AND macro = ?`).all(space, name) as Raw[]).map((raw) => entry("macro-use", toMacroUse(raw), raw));
  return [...macros, ...uses].sort(bySequence);
}

/** Every symbol row of a space that ever had this name, oldest first: a name can move between addresses. */
export function historyNamed(db: DatabaseSync | undefined, name: string, space: Space = DEFAULT_SPACE): HistoryEntry[] {
  if (db === undefined) return [];
  return (db.prepare(`SELECT ${SYMBOL_COLUMNS}, valid_to_revision FROM symbols WHERE space = ? AND name = ?`).all(space, name) as Raw[])
    .map((raw) => entry("symbol", toSymbol(raw), raw))
    .sort(bySequence);
}

/** Why a revision was written and what it rests on: its description and its evidence, when it has them. */
export function revisionNote(db: DatabaseSync | undefined, id: string): { reason?: string; evidence?: Evidence[] } {
  const raw = db?.prepare("SELECT * FROM revisions WHERE id = ?").get(id) as Raw | undefined;
  if (db === undefined || raw === undefined) return {};
  const { description, evidence } = withEvidence(db, toRevision(raw));
  return { ...(description === undefined ? {} : { reason: description }), ...(evidence === undefined ? {} : { evidence }) };
}

/** The revision with its evidence, when it has any. */
function withEvidence(db: DatabaseSync, revision: Revision): Revision {
  const rows = db.prepare("SELECT kind, ref, sha256, space FROM evidence WHERE revision = ? ORDER BY id").all(revision.id) as Raw[];
  if (rows.length === 0) return revision;
  const evidence = rows.map((row): Evidence => ({
    kind: row.kind as EvidenceKind,
    ref: row.ref as string,
    ...(row.sha256 === null ? {} : { sha256: row.sha256 as string }),
    ...(row.space === null ? {} : { space: row.space as Space }),
  }));
  return { ...revision, evidence };
}

/** Revisions, newest first; with `before`, only revisions older than it. */
export function revisions(db: DatabaseSync | undefined, options: { limit?: number; before?: string } = {}): Revision[] {
  if (db === undefined) return [];
  const rows =
    options.before === undefined
      ? db.prepare("SELECT * FROM revisions ORDER BY id DESC LIMIT ?").all(options.limit ?? 50)
      : db.prepare("SELECT * FROM revisions WHERE id < ? ORDER BY id DESC LIMIT ?").all(resolveRevision(db, options.before), options.limit ?? 50);
  return (rows as Raw[]).map((row) => withEvidence(db, toRevision(row)));
}

export interface RevisionChanges {
  revision: Revision;
  /** Rows this revision made current. */
  added: HistoryEntry[];
  /** Rows this revision closed. */
  closed: HistoryEntry[];
}

/** One revision and exactly what it changed. */
export function revision(db: DatabaseSync | undefined, text: string): RevisionChanges {
  const id = resolveRevision(db, text);
  const raw = db?.prepare("SELECT * FROM revisions WHERE id = ?").get(id) as Raw | undefined;
  if (db === undefined || raw === undefined) throw new KnowledgeError("not-found", `There is no revision ${id}.`);
  const tables = [
    ["symbol", "symbols", SYMBOL_COLUMNS, toSymbol],
    ["analyzer-name", "analyzer_names", SYMBOL_COLUMNS, toSymbol],
    ["region", "regions", REGION_COLUMNS, toRegion],
    ["comment", "comments", COMMENT_COLUMNS, toComment],
    ["reference", '"references"', REFERENCE_COLUMNS, toReference],
    ["suppression", "suppressions", SUPPRESSION_COLUMNS, toSuppression],
    ["module", "modules", MODULE_COLUMNS, toModule],
    ["operand", "operands", OPERAND_COLUMNS, toOperand],
    ["patch", "patches", PATCH_COLUMNS, toPatch],
    ["macro", "macros", MACRO_COLUMNS, toMacro],
    ["macro-use", "macro_uses", MACRO_USE_COLUMNS, toMacroUse],
  ] as const;
  const added: HistoryEntry[] = [];
  const closed: HistoryEntry[] = [];
  for (const [entity, table, columns, map] of tables) {
    for (const row of db.prepare(`SELECT ${columns}, valid_to_revision FROM ${table} WHERE valid_from_revision = ?`).all(id) as Raw[]) {
      added.push(entry(entity, map(row), row));
    }
    for (const row of db.prepare(`SELECT ${columns}, valid_to_revision FROM ${table} WHERE valid_to_revision = ?`).all(id) as Raw[]) {
      closed.push(entry(entity, map(row), row));
    }
  }
  return { revision: withEvidence(db, toRevision(raw)), added, closed };
}

