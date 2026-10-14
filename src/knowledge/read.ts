// Current-state knowledge queries. A project without a database
// reads as empty knowledge. Each query reads one address space (D53); the
// default is the C64.

import type { DatabaseSync } from "node:sqlite";

import { DEFAULT_SPACE, type CommentPlacement, type Origin, type ReferenceKind, type RegionType, type Space, type SuppressionEntity, type SymbolKind } from "./schema.ts";

export interface SymbolRow {
  space: Space;
  address: number;
  name: string;
  kind: SymbolKind;
  origin: Origin;
  revision: number;
}

export interface RegionRow {
  space: Space;
  start: number;
  end: number;
  type: RegionType;
  /** Bytes per element of a table; the length is a multiple of it (D42). */
  element?: number;
  origin: Origin;
  revision: number;
}

export interface CommentRow {
  space: Space;
  address: number;
  placement: CommentPlacement;
  text: string;
  origin: Origin;
  revision: number;
}

export interface ReferenceRow {
  space: Space;
  from: number;
  to: number;
  kind: ReferenceKind;
  origin: Origin;
  revision: number;
}

/** A place that a user/LLM removal blocks for every analyzer (D36). `to` and `kind` are set for a reference only. */
export interface SuppressionRow {
  space: Space;
  entity: SuppressionEntity;
  start: number;
  end: number;
  to?: number;
  kind?: ReferenceKind;
  origin: Extract<Origin, "user" | "llm">;
  revision: number;
}

/** Where a file of the generated source starts (D48): it runs to the next module or the end of its segment. */
export interface ModuleRow {
  space: Space;
  start: number;
  file: string;
  title?: string;
  origin: Extract<Origin, "user" | "llm">;
  revision: number;
}

type Raw = Record<string, unknown>;

export const SYMBOL_COLUMNS = "space, address, name, kind, origin, valid_from_revision";
export const REGION_COLUMNS = "space, start_address, end_address, type, element, origin, valid_from_revision";
export const COMMENT_COLUMNS = "space, address, placement, text, origin, valid_from_revision";
export const REFERENCE_COLUMNS = "space, from_address, to_address, kind, origin, valid_from_revision";
export const SUPPRESSION_COLUMNS = "space, entity, start_address, end_address, to_address, kind, origin, valid_from_revision";
export const MODULE_COLUMNS = "space, start_address, file, title, origin, valid_from_revision";

export function toSymbol(row: Raw): SymbolRow {
  return { space: row.space as Space, address: row.address as number, name: row.name as string, kind: row.kind as SymbolKind, origin: row.origin as Origin, revision: row.valid_from_revision as number };
}

export function toRegion(row: Raw): RegionRow {
  const region: RegionRow = {
    space: row.space as Space,
    start: row.start_address as number,
    end: row.end_address as number,
    type: row.type as RegionType,
    origin: row.origin as Origin,
    revision: row.valid_from_revision as number,
  };
  if (row.element !== null && row.element !== undefined) region.element = row.element as number;
  return region;
}

export function toComment(row: Raw): CommentRow {
  return {
    space: row.space as Space,
    address: row.address as number,
    placement: row.placement as CommentPlacement,
    text: row.text as string,
    origin: row.origin as Origin,
    revision: row.valid_from_revision as number,
  };
}

export function toReference(row: Raw): ReferenceRow {
  return { space: row.space as Space, from: row.from_address as number, to: row.to_address as number, kind: row.kind as ReferenceKind, origin: row.origin as Origin, revision: row.valid_from_revision as number };
}

export function toSuppression(row: Raw): SuppressionRow {
  const suppression: SuppressionRow = {
    space: row.space as Space,
    entity: row.entity as SuppressionEntity,
    start: row.start_address as number,
    end: row.end_address as number,
    origin: row.origin as SuppressionRow["origin"],
    revision: row.valid_from_revision as number,
  };
  if (row.to_address !== null) suppression.to = row.to_address as number;
  if (row.kind !== null) suppression.kind = row.kind as ReferenceKind;
  return suppression;
}

export function toModule(row: Raw): ModuleRow {
  const module: ModuleRow = { space: row.space as Space, start: row.start_address as number, file: row.file as string, origin: row.origin as ModuleRow["origin"], revision: row.valid_from_revision as number };
  if (row.title !== null && row.title !== undefined) module.title = row.title as string;
  return module;
}

export function currentRevision(db: DatabaseSync | undefined): number {
  if (db === undefined) return 0;
  return Number((db.prepare("SELECT value FROM meta WHERE key = 'current_revision'").get() as { value: string }).value);
}

export function symbolAt(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): SymbolRow | undefined {
  const row = db?.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE space = ? AND address = ?`).get(space, address) as Raw | undefined;
  return row === undefined ? undefined : toSymbol(row);
}

export function symbolNamed(db: DatabaseSync | undefined, name: string, space: Space = DEFAULT_SPACE): SymbolRow | undefined {
  const row = db?.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE space = ? AND name = ?`).get(space, name) as Raw | undefined;
  return row === undefined ? undefined : toSymbol(row);
}

/** Current regions that share at least one address with [start, end], in address order. */
export function regionsOverlapping(db: DatabaseSync | undefined, start: number, end: number, space: Space = DEFAULT_SPACE): RegionRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${REGION_COLUMNS} FROM current_regions WHERE space = ? AND start_address <= ? AND end_address >= ? ORDER BY start_address`)
    .all(space, end, start)
    .map((row) => toRegion(row as Raw));
}

export function commentsAt(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): CommentRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM current_comments WHERE space = ? AND address = ? ORDER BY placement`)
    .all(space, address)
    .map((row) => toComment(row as Raw));
}

export function referencesFrom(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): ReferenceRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${REFERENCE_COLUMNS} FROM current_references WHERE space = ? AND from_address = ? ORDER BY to_address, kind`)
    .all(space, address)
    .map((row) => toReference(row as Raw));
}

export function referencesTo(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): ReferenceRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${REFERENCE_COLUMNS} FROM current_references WHERE space = ? AND to_address = ? ORDER BY from_address, kind`)
    .all(space, address)
    .map((row) => toReference(row as Raw));
}

/** Current suppressions of one entity that share at least one address with [start, end], in address order. */
export function suppressionsOverlapping(db: DatabaseSync | undefined, entity: SuppressionEntity, start: number, end: number, space: Space = DEFAULT_SPACE): SuppressionRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${SUPPRESSION_COLUMNS} FROM current_suppressions WHERE space = ? AND entity = ? AND start_address <= ? AND end_address >= ? ORDER BY start_address, to_address, kind`)
    .all(space, entity, end, start)
    .map((row) => toSuppression(row as Raw));
}

export function symbolSuppressed(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): boolean {
  return suppressionsOverlapping(db, "symbol", address, address, space).length > 0;
}

export function referenceSuppressed(db: DatabaseSync | undefined, reference: { from: number; to: number; kind: ReferenceKind }, space: Space = DEFAULT_SPACE): boolean {
  return suppressionsOverlapping(db, "reference", reference.from, reference.from, space).some((row) => row.to === reference.to && row.kind === reference.kind);
}

/** Current suppressions at an address: its symbol, the region range that holds it, references from or to it. */
export function suppressionsAt(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): SuppressionRow[] {
  if (db === undefined) return [];
  return db
    .prepare(
      `SELECT ${SUPPRESSION_COLUMNS} FROM current_suppressions WHERE space = ? AND ((start_address <= ? AND end_address >= ?) OR to_address = ?) ORDER BY entity, start_address, to_address, kind`,
    )
    .all(space, address, address, address)
    .map((row) => toSuppression(row as Raw));
}

export function moduleAt(db: DatabaseSync | undefined, start: number, space: Space = DEFAULT_SPACE): ModuleRow | undefined {
  const row = db?.prepare(`SELECT ${MODULE_COLUMNS} FROM current_modules WHERE space = ? AND start_address = ?`).get(space, start) as Raw | undefined;
  return row === undefined ? undefined : toModule(row);
}

export function moduleWithFile(db: DatabaseSync | undefined, file: string, space: Space = DEFAULT_SPACE): ModuleRow | undefined {
  const row = db?.prepare(`SELECT ${MODULE_COLUMNS} FROM current_modules WHERE space = ? AND file = ?`).get(space, file) as Raw | undefined;
  return row === undefined ? undefined : toModule(row);
}

/** Everything currently known at one address: the main lookup for skills. */
export interface AddressKnowledge {
  space: Space;
  address: number;
  symbol?: SymbolRow;
  /** The current region that contains the address. */
  region?: RegionRow;
  comments: CommentRow[];
  referencesFrom: ReferenceRow[];
  referencesTo: ReferenceRow[];
  /** What user/LLM removals block here for the analyzers. */
  suppressions: SuppressionRow[];
  revision: number;
}

export function at(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): AddressKnowledge {
  const result: AddressKnowledge = {
    space,
    address,
    comments: commentsAt(db, address, space),
    referencesFrom: referencesFrom(db, address, space),
    referencesTo: referencesTo(db, address, space),
    suppressions: suppressionsAt(db, address, space),
    revision: currentRevision(db),
  };
  const symbol = symbolAt(db, address, space);
  if (symbol !== undefined) result.symbol = symbol;
  const [region] = regionsOverlapping(db, address, address, space);
  if (region !== undefined) result.region = region;
  return result;
}

export interface Range {
  start: number;
  end: number;
}

const ALL: Range = { start: 0x0000, end: 0xffff };

/** Rows of these origins only; undefined keeps every origin (D42). */
export type OriginFilter = readonly Origin[] | undefined;
const kept = (origins: OriginFilter) => (row: { origin: Origin }) => origins === undefined || origins.includes(row.origin);


export function listSymbols(db: DatabaseSync | undefined, range: Range = ALL, kind?: SymbolKind, origins?: OriginFilter, space: Space = DEFAULT_SPACE): SymbolRow[] {
  if (db === undefined) return [];
  const rows =
    kind === undefined
      ? db.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE space = ? AND address BETWEEN ? AND ? ORDER BY address`).all(space, range.start, range.end)
      : db.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE space = ? AND address BETWEEN ? AND ? AND kind = ? ORDER BY address`).all(space, range.start, range.end, kind);
  return rows.map((row) => toSymbol(row as Raw)).filter(kept(origins));
}

export function listRegions(db: DatabaseSync | undefined, range: Range = ALL, type?: RegionType, origins?: OriginFilter, space: Space = DEFAULT_SPACE): RegionRow[] {
  return regionsOverlapping(db, range.start, range.end, space).filter((region) => (type === undefined || region.type === type) && kept(origins)(region));
}

export function listComments(db: DatabaseSync | undefined, range: Range = ALL, origins?: OriginFilter, space: Space = DEFAULT_SPACE): CommentRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM current_comments WHERE space = ? AND address BETWEEN ? AND ? ORDER BY address, placement`)
    .all(space, range.start, range.end)
    .map((row) => toComment(row as Raw))
    .filter(kept(origins));
}

/** Current references whose source or target lies in the range. */
export function listReferences(db: DatabaseSync | undefined, range: Range = ALL, kind?: ReferenceKind, origins?: OriginFilter, space: Space = DEFAULT_SPACE): ReferenceRow[] {
  if (db === undefined) return [];
  return db
    .prepare(
      `SELECT ${REFERENCE_COLUMNS} FROM current_references WHERE space = ? AND (from_address BETWEEN ? AND ? OR to_address BETWEEN ? AND ?) ORDER BY from_address, to_address, kind`,
    )
    .all(space, range.start, range.end, range.start, range.end)
    .map((row) => toReference(row as Raw))
    .filter((reference) => (kind === undefined || reference.kind === kind) && kept(origins)(reference));
}

/** Current suppressions whose place lies in the range: a reference by its source or target. */
export function listSuppressions(db: DatabaseSync | undefined, range: Range = ALL, space: Space = DEFAULT_SPACE): SuppressionRow[] {
  if (db === undefined) return [];
  return db
    .prepare(
      `SELECT ${SUPPRESSION_COLUMNS} FROM current_suppressions WHERE space = ? AND ((start_address <= ? AND end_address >= ?) OR to_address BETWEEN ? AND ?) ORDER BY start_address, entity, to_address, kind`,
    )
    .all(space, range.end, range.start, range.start, range.end)
    .map((row) => toSuppression(row as Raw));
}

/** Current modules that start in the range, in address order. */
export function listModules(db: DatabaseSync | undefined, range: Range = ALL, origins?: OriginFilter, space: Space = DEFAULT_SPACE): ModuleRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${MODULE_COLUMNS} FROM current_modules WHERE space = ? AND start_address BETWEEN ? AND ? ORDER BY start_address`)
    .all(space, range.start, range.end)
    .map((row) => toModule(row as Raw))
    .filter(kept(origins));
}

/** The spaces that hold current knowledge, the C64 first. */
export function listSpaces(db: DatabaseSync | undefined): Space[] {
  if (db === undefined) return [];
  const rows = db
    .prepare(
      `SELECT space FROM current_symbols UNION SELECT space FROM current_regions UNION SELECT space FROM current_comments UNION SELECT space FROM current_references UNION SELECT space FROM current_suppressions UNION SELECT space FROM current_modules`,
    )
    .all() as Array<{ space: Space }>;
  const order = (space: Space) => (space === "c64" ? -2 : space === "drive8" ? -1 : Number(space.slice(4)));
  return rows.map((row) => row.space).sort((a, b) => order(a) - order(b));
}

/** Case-insensitive text search in current symbol names and comment texts of one space. */
export function search(db: DatabaseSync | undefined, text: string, limit = 50, origins?: OriginFilter, space: Space = DEFAULT_SPACE): { symbols: SymbolRow[]; comments: CommentRow[] } {
  if (db === undefined || text.length === 0) return { symbols: [], comments: [] };
  const pattern = `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  const only = origins === undefined ? "" : ` AND origin IN (${origins.map(() => "?").join(", ")})`;
  const values = origins ?? [];
  const symbols = db
    .prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE space = ? AND name LIKE ? ESCAPE '\\'${only} ORDER BY address LIMIT ?`)
    .all(space, pattern, ...values, limit)
    .map((row) => toSymbol(row as Raw));
  const comments = db
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM current_comments WHERE space = ? AND text LIKE ? ESCAPE '\\'${only} ORDER BY address, placement LIMIT ?`)
    .all(space, pattern, ...values, limit)
    .map((row) => toComment(row as Raw));
  return { symbols, comments };
}
