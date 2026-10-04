// Current-state knowledge queries (06 §8). A project without a database
// reads as empty knowledge.

import type { DatabaseSync } from "node:sqlite";

import type { CommentPlacement, Origin, ReferenceKind, RegionType, SymbolKind } from "./schema.ts";

export interface SymbolRow {
  address: number;
  name: string;
  kind: SymbolKind;
  origin: Origin;
  revision: number;
}

export interface RegionRow {
  start: number;
  end: number;
  type: RegionType;
  origin: Origin;
  revision: number;
}

export interface CommentRow {
  address: number;
  placement: CommentPlacement;
  text: string;
  origin: Origin;
  revision: number;
}

export interface ReferenceRow {
  from: number;
  to: number;
  kind: ReferenceKind;
  origin: Origin;
  revision: number;
}

type Raw = Record<string, unknown>;

export const SYMBOL_COLUMNS = "address, name, kind, origin, valid_from_revision";
export const REGION_COLUMNS = "start_address, end_address, type, origin, valid_from_revision";
export const COMMENT_COLUMNS = "address, placement, text, origin, valid_from_revision";
export const REFERENCE_COLUMNS = "from_address, to_address, kind, origin, valid_from_revision";

export function toSymbol(row: Raw): SymbolRow {
  return { address: row.address as number, name: row.name as string, kind: row.kind as SymbolKind, origin: row.origin as Origin, revision: row.valid_from_revision as number };
}

export function toRegion(row: Raw): RegionRow {
  return { start: row.start_address as number, end: row.end_address as number, type: row.type as RegionType, origin: row.origin as Origin, revision: row.valid_from_revision as number };
}

export function toComment(row: Raw): CommentRow {
  return { address: row.address as number, placement: row.placement as CommentPlacement, text: row.text as string, origin: row.origin as Origin, revision: row.valid_from_revision as number };
}

export function toReference(row: Raw): ReferenceRow {
  return { from: row.from_address as number, to: row.to_address as number, kind: row.kind as ReferenceKind, origin: row.origin as Origin, revision: row.valid_from_revision as number };
}

export function currentRevision(db: DatabaseSync | undefined): number {
  if (db === undefined) return 0;
  return Number((db.prepare("SELECT value FROM meta WHERE key = 'current_revision'").get() as { value: string }).value);
}

export function symbolAt(db: DatabaseSync | undefined, address: number): SymbolRow | undefined {
  const row = db?.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE address = ?`).get(address) as Raw | undefined;
  return row === undefined ? undefined : toSymbol(row);
}

export function symbolNamed(db: DatabaseSync | undefined, name: string): SymbolRow | undefined {
  const row = db?.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE name = ?`).get(name) as Raw | undefined;
  return row === undefined ? undefined : toSymbol(row);
}

/** Current regions that share at least one address with [start, end], in address order. */
export function regionsOverlapping(db: DatabaseSync | undefined, start: number, end: number): RegionRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${REGION_COLUMNS} FROM current_regions WHERE start_address <= ? AND end_address >= ? ORDER BY start_address`)
    .all(end, start)
    .map((row) => toRegion(row as Raw));
}

export function commentsAt(db: DatabaseSync | undefined, address: number): CommentRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM current_comments WHERE address = ? ORDER BY placement`)
    .all(address)
    .map((row) => toComment(row as Raw));
}

export function referencesFrom(db: DatabaseSync | undefined, address: number): ReferenceRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${REFERENCE_COLUMNS} FROM current_references WHERE from_address = ? ORDER BY to_address, kind`)
    .all(address)
    .map((row) => toReference(row as Raw));
}

export function referencesTo(db: DatabaseSync | undefined, address: number): ReferenceRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${REFERENCE_COLUMNS} FROM current_references WHERE to_address = ? ORDER BY from_address, kind`)
    .all(address)
    .map((row) => toReference(row as Raw));
}

/** Everything currently known at one address (06 §8): the main lookup for skills. */
export interface AddressKnowledge {
  address: number;
  symbol?: SymbolRow;
  /** The current region that contains the address. */
  region?: RegionRow;
  comments: CommentRow[];
  referencesFrom: ReferenceRow[];
  referencesTo: ReferenceRow[];
  revision: number;
}

export function at(db: DatabaseSync | undefined, address: number): AddressKnowledge {
  const result: AddressKnowledge = {
    address,
    comments: commentsAt(db, address),
    referencesFrom: referencesFrom(db, address),
    referencesTo: referencesTo(db, address),
    revision: currentRevision(db),
  };
  const symbol = symbolAt(db, address);
  if (symbol !== undefined) result.symbol = symbol;
  const [region] = regionsOverlapping(db, address, address);
  if (region !== undefined) result.region = region;
  return result;
}

export interface Range {
  start: number;
  end: number;
}

const ALL: Range = { start: 0x0000, end: 0xffff };

export function listSymbols(db: DatabaseSync | undefined, range: Range = ALL, kind?: SymbolKind): SymbolRow[] {
  if (db === undefined) return [];
  const rows =
    kind === undefined
      ? db.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE address BETWEEN ? AND ? ORDER BY address`).all(range.start, range.end)
      : db.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE address BETWEEN ? AND ? AND kind = ? ORDER BY address`).all(range.start, range.end, kind);
  return rows.map((row) => toSymbol(row as Raw));
}

export function listRegions(db: DatabaseSync | undefined, range: Range = ALL, type?: RegionType): RegionRow[] {
  return regionsOverlapping(db, range.start, range.end).filter((region) => type === undefined || region.type === type);
}

export function listComments(db: DatabaseSync | undefined, range: Range = ALL): CommentRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM current_comments WHERE address BETWEEN ? AND ? ORDER BY address, placement`)
    .all(range.start, range.end)
    .map((row) => toComment(row as Raw));
}

/** Current references whose source or target lies in the range. */
export function listReferences(db: DatabaseSync | undefined, range: Range = ALL, kind?: ReferenceKind): ReferenceRow[] {
  if (db === undefined) return [];
  return db
    .prepare(
      `SELECT ${REFERENCE_COLUMNS} FROM current_references WHERE (from_address BETWEEN ? AND ? OR to_address BETWEEN ? AND ?) ORDER BY from_address, to_address, kind`,
    )
    .all(range.start, range.end, range.start, range.end)
    .map((row) => toReference(row as Raw))
    .filter((reference) => kind === undefined || reference.kind === kind);
}

/** Case-insensitive text search in current symbol names and comment texts. */
export function search(db: DatabaseSync | undefined, text: string, limit = 50): { symbols: SymbolRow[]; comments: CommentRow[] } {
  if (db === undefined || text.length === 0) return { symbols: [], comments: [] };
  const pattern = `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  const symbols = db
    .prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE name LIKE ? ESCAPE '\\' ORDER BY address LIMIT ?`)
    .all(pattern, limit)
    .map((row) => toSymbol(row as Raw));
  const comments = db
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM current_comments WHERE text LIKE ? ESCAPE '\\' ORDER BY address, placement LIMIT ?`)
    .all(pattern, limit)
    .map((row) => toComment(row as Raw));
  return { symbols, comments };
}
