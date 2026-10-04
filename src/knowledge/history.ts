// Knowledge history (06 §8): what used to be known, which revision changed
// it, who changed it and why. History rows are never deleted.

import type { DatabaseSync } from "node:sqlite";

import { KnowledgeError } from "./database.ts";
import {
  COMMENT_COLUMNS,
  REFERENCE_COLUMNS,
  REGION_COLUMNS,
  SYMBOL_COLUMNS,
  toComment,
  toReference,
  toRegion,
  toSymbol,
  type CommentRow,
  type ReferenceRow,
  type RegionRow,
  type SymbolRow,
} from "./read.ts";
import type { Origin } from "./schema.ts";

export interface Revision {
  id: number;
  createdAt: string;
  origin: Origin;
  operation: string;
  description?: string;
  inputHash?: string;
  toolVersion?: string;
}

/** One knowledge row with its validity: from its first revision until the revision that closed it. */
export type HistoryEntry =
  | { entity: "symbol"; row: SymbolRow; from: number; to?: number }
  | { entity: "region"; row: RegionRow; from: number; to?: number }
  | { entity: "comment"; row: CommentRow; from: number; to?: number }
  | { entity: "reference"; row: ReferenceRow; from: number; to?: number };

type Raw = Record<string, unknown>;

function toRevision(row: Raw): Revision {
  const revision: Revision = {
    id: row.id as number,
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
  const result = { entity, row, from: raw.valid_from_revision as number } as HistoryEntry;
  if (raw.valid_to_revision !== null) result.to = raw.valid_to_revision as number;
  return result;
}

function bySequence(a: HistoryEntry, b: HistoryEntry): number {
  return a.from - b.from || (a.to ?? Infinity) - (b.to ?? Infinity);
}

/** Every row, current or closed, that concerns one address, oldest first. */
export function historyAt(db: DatabaseSync | undefined, address: number): HistoryEntry[] {
  if (db === undefined) return [];
  const validity = ", valid_to_revision";
  const entries: HistoryEntry[] = [];
  for (const raw of db.prepare(`SELECT ${SYMBOL_COLUMNS}${validity} FROM symbols WHERE address = ?`).all(address) as Raw[]) entries.push(entry("symbol", toSymbol(raw), raw));
  for (const raw of db.prepare(`SELECT ${REGION_COLUMNS}${validity} FROM regions WHERE start_address <= ? AND end_address >= ?`).all(address, address) as Raw[]) {
    entries.push(entry("region", toRegion(raw), raw));
  }
  for (const raw of db.prepare(`SELECT ${COMMENT_COLUMNS}${validity} FROM comments WHERE address = ?`).all(address) as Raw[]) entries.push(entry("comment", toComment(raw), raw));
  for (const raw of db.prepare(`SELECT ${REFERENCE_COLUMNS}${validity} FROM "references" WHERE from_address = ? OR to_address = ?`).all(address, address) as Raw[]) {
    entries.push(entry("reference", toReference(raw), raw));
  }
  return entries.sort(bySequence);
}

/** Every symbol row that ever had this name, oldest first: a name can move between addresses. */
export function historyNamed(db: DatabaseSync | undefined, name: string): HistoryEntry[] {
  if (db === undefined) return [];
  return (db.prepare(`SELECT ${SYMBOL_COLUMNS}, valid_to_revision FROM symbols WHERE name = ?`).all(name) as Raw[])
    .map((raw) => entry("symbol", toSymbol(raw), raw))
    .sort(bySequence);
}

/** Revisions, newest first; with `before`, only revisions older than it. */
export function revisions(db: DatabaseSync | undefined, options: { limit?: number; before?: number } = {}): Revision[] {
  if (db === undefined) return [];
  return (
    db
      .prepare("SELECT * FROM revisions WHERE id < ? ORDER BY id DESC LIMIT ?")
      .all(options.before ?? Number.MAX_SAFE_INTEGER, options.limit ?? 50) as Raw[]
  ).map(toRevision);
}

export interface RevisionChanges {
  revision: Revision;
  /** Rows this revision made current. */
  added: HistoryEntry[];
  /** Rows this revision closed. */
  closed: HistoryEntry[];
}

/** One revision and exactly what it changed. */
export function revision(db: DatabaseSync | undefined, id: number): RevisionChanges {
  const raw = db?.prepare("SELECT * FROM revisions WHERE id = ?").get(id) as Raw | undefined;
  if (db === undefined || raw === undefined) throw new KnowledgeError("not-found", `There is no revision ${id}.`);
  const tables = [
    ["symbol", "symbols", SYMBOL_COLUMNS, toSymbol],
    ["region", "regions", REGION_COLUMNS, toRegion],
    ["comment", "comments", COMMENT_COLUMNS, toComment],
    ["reference", '"references"', REFERENCE_COLUMNS, toReference],
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
  return { revision: toRevision(raw), added, closed };
}
