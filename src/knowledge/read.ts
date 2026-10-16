// Current-state knowledge queries. A project without knowledge
// reads as empty knowledge. Each query reads one address space (D53); the
// default is the C64.

import type { DatabaseSync } from "node:sqlite";

import { KnowledgeError } from "./database.ts";
import { DEFAULT_SPACE, type CommentPlacement, type OperandSelect, type Origin, type ReferenceKind, type RegionType, type Space, type SuppressionEntity, type SymbolKind } from "./schema.ts";
import { NO_REVISION } from "./text.ts";

export interface SymbolRow {
  space: Space;
  address: number;
  name: string;
  kind: SymbolKind;
  origin: Origin;
  revision: string;
}

export interface RegionRow {
  space: Space;
  start: number;
  end: number;
  type: RegionType;
  /** Bytes per element of a table; the length is a multiple of it (D42). */
  element?: number;
  origin: Origin;
  revision: string;
}

export interface CommentRow {
  space: Space;
  address: number;
  placement: CommentPlacement;
  text: string;
  origin: Origin;
  revision: string;
}

export interface ReferenceRow {
  space: Space;
  from: number;
  to: number;
  kind: ReferenceKind;
  origin: Origin;
  revision: string;
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
  revision: string;
}

/** Where a file of the generated source starts (D48): it runs to the next module or the end of its segment. */
export interface ModuleRow {
  space: Space;
  start: number;
  file: string;
  title?: string;
  origin: Extract<Origin, "user" | "llm">;
  revision: string;
}

/**
 * How the operand of the instruction at `address` is written (D65): a byte
 * (lo, hi) or the value of a symbol plus an offset, or expression text (expr).
 */
export interface OperandRow {
  space: Space;
  address: number;
  select: OperandSelect;
  symbol?: string;
  /** Added to the symbol before lo or hi takes its byte; 0 for expr. */
  offset: number;
  expression?: string;
  origin: Extract<Origin, "user" | "llm">;
  revision: string;
}

/**
 * Code that replaces [start, end] when the build defines the switch as 1
 * (D72). The code fits the range; NOP fills the rest. Empty code is only NOP.
 */
export interface PatchRow {
  space: Space;
  start: number;
  end: number;
  switch: string;
  code: string;
  comment?: string;
  origin: Extract<Origin, "user" | "llm">;
  revision: string;
}

/** An ACME macro of the generated source (D73). The body names a parameter with a dot in front: .dst. */
export interface MacroRow {
  space: Space;
  name: string;
  params: string[];
  body: string;
  comment?: string;
  origin: Extract<Origin, "user" | "llm">;
  revision: string;
}

/** The instructions in [start, end] written as one use of a macro, with one expression for each parameter (D73). */
export interface MacroUseRow {
  space: Space;
  start: number;
  end: number;
  macro: string;
  args: string[];
  origin: Extract<Origin, "user" | "llm">;
  revision: string;
}

/** A list of params or args as the knowledge stores it: the items with ", " between them. */
export const listText = (items: readonly string[]) => items.join(", ");
const items = (text: string) => (text.trim() === "" ? [] : text.split(",").map((item) => item.trim()));

type Raw = Record<string, unknown>;

export const SYMBOL_COLUMNS = "space, address, name, kind, origin, valid_from_revision";
export const REGION_COLUMNS = "space, start_address, end_address, type, element, origin, valid_from_revision";
export const COMMENT_COLUMNS = "space, address, placement, text, origin, valid_from_revision";
export const REFERENCE_COLUMNS = "space, from_address, to_address, kind, origin, valid_from_revision";
export const SUPPRESSION_COLUMNS = "space, entity, start_address, end_address, to_address, kind, origin, valid_from_revision";
export const MODULE_COLUMNS = "space, start_address, file, title, origin, valid_from_revision";
export const OPERAND_COLUMNS = "space, address, selector, symbol, offset, expression, origin, valid_from_revision";
export const PATCH_COLUMNS = "space, start_address, end_address, switch_name, code, comment, origin, valid_from_revision";
export const MACRO_COLUMNS = "space, name, params, body, comment, origin, valid_from_revision";
export const MACRO_USE_COLUMNS = "space, start_address, end_address, macro, args, origin, valid_from_revision";

export function toSymbol(row: Raw): SymbolRow {
  return { space: row.space as Space, address: row.address as number, name: row.name as string, kind: row.kind as SymbolKind, origin: row.origin as Origin, revision: row.valid_from_revision as string };
}

export function toRegion(row: Raw): RegionRow {
  const region: RegionRow = {
    space: row.space as Space,
    start: row.start_address as number,
    end: row.end_address as number,
    type: row.type as RegionType,
    origin: row.origin as Origin,
    revision: row.valid_from_revision as string,
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
    revision: row.valid_from_revision as string,
  };
}

export function toReference(row: Raw): ReferenceRow {
  return { space: row.space as Space, from: row.from_address as number, to: row.to_address as number, kind: row.kind as ReferenceKind, origin: row.origin as Origin, revision: row.valid_from_revision as string };
}

export function toSuppression(row: Raw): SuppressionRow {
  const suppression: SuppressionRow = {
    space: row.space as Space,
    entity: row.entity as SuppressionEntity,
    start: row.start_address as number,
    end: row.end_address as number,
    origin: row.origin as SuppressionRow["origin"],
    revision: row.valid_from_revision as string,
  };
  if (row.to_address !== null) suppression.to = row.to_address as number;
  if (row.kind !== null) suppression.kind = row.kind as ReferenceKind;
  return suppression;
}

export function toModule(row: Raw): ModuleRow {
  const module: ModuleRow = { space: row.space as Space, start: row.start_address as number, file: row.file as string, origin: row.origin as ModuleRow["origin"], revision: row.valid_from_revision as string };
  if (row.title !== null && row.title !== undefined) module.title = row.title as string;
  return module;
}

export function toOperand(row: Raw): OperandRow {
  const operand: OperandRow = {
    space: row.space as Space,
    address: row.address as number,
    select: row.selector as OperandSelect,
    offset: row.offset as number,
    origin: row.origin as OperandRow["origin"],
    revision: row.valid_from_revision as string,
  };
  if (row.symbol !== null && row.symbol !== undefined) operand.symbol = row.symbol as string;
  if (row.expression !== null && row.expression !== undefined) operand.expression = row.expression as string;
  return operand;
}

export function toPatch(row: Raw): PatchRow {
  const patch: PatchRow = {
    space: row.space as Space,
    start: row.start_address as number,
    end: row.end_address as number,
    switch: row.switch_name as string,
    code: row.code as string,
    origin: row.origin as PatchRow["origin"],
    revision: row.valid_from_revision as string,
  };
  if (row.comment !== null && row.comment !== undefined) patch.comment = row.comment as string;
  return patch;
}

export function toMacro(row: Raw): MacroRow {
  const macro: MacroRow = { space: row.space as Space, name: row.name as string, params: items(row.params as string), body: row.body as string, origin: row.origin as MacroRow["origin"], revision: row.valid_from_revision as string };
  if (row.comment !== null && row.comment !== undefined) macro.comment = row.comment as string;
  return macro;
}

export function toMacroUse(row: Raw): MacroUseRow {
  return {
    space: row.space as Space,
    start: row.start_address as number,
    end: row.end_address as number,
    macro: row.macro as string,
    args: items(row.args as string),
    origin: row.origin as MacroUseRow["origin"],
    revision: row.valid_from_revision as string,
  };
}

/** The id of the newest revision, or "0" when the knowledge has none (D69). */
export function currentRevision(db: DatabaseSync | undefined): string {
  if (db === undefined) return "0";
  return (db.prepare("SELECT max(id) AS id FROM revisions").get() as { id: string | null }).id ?? "0";
}

/** At most this many ids are named when a start of an id fits several revisions. */
const NAMED_REVISIONS = 5;

/**
 * The revision that `text` names (D69): "0" (no revision), a full revision id,
 * or a start of an id that only one revision has.
 */
export function resolveRevision(db: DatabaseSync | undefined, text: string): string {
  if (text === NO_REVISION) return NO_REVISION;
  if (!/^[0-9a-zT.-]+$/.test(text)) throw new KnowledgeError("invalid-input", `${JSON.stringify(text)} is not a revision id. A revision id looks like 20261015T214501.123-k3f9qz; its start is enough when only one revision has it.`);
  const found = (db?.prepare("SELECT id FROM revisions WHERE substr(id, 1, ?) = ? ORDER BY id LIMIT ?").all(text.length, text, NAMED_REVISIONS + 1) ?? []) as Array<{ id: string }>;
  if (found.length === 0) throw new KnowledgeError("not-found", `There is no revision ${text}.`);
  if (found.length > 1) {
    const named = found.slice(0, NAMED_REVISIONS).map((row) => row.id).join(", ");
    throw new KnowledgeError("invalid-input", `${text} is the start of more than one revision: ${named}${found.length > NAMED_REVISIONS ? ", ..." : ""}. Give more of the id.`);
  }
  return found[0]!.id;
}

export function symbolAt(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): SymbolRow | undefined {
  const row = db?.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE space = ? AND address = ?`).get(space, address) as Raw | undefined;
  return row === undefined ? undefined : toSymbol(row);
}

export function symbolNamed(db: DatabaseSync | undefined, name: string, space: Space = DEFAULT_SPACE): SymbolRow | undefined {
  const row = db?.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE space = ? AND name = ?`).get(space, name) as Raw | undefined;
  return row === undefined ? undefined : toSymbol(row);
}

/** The analyzer names at an address (D74): one for each analyzer, in the order heuristic, Ghidra, DXA. */
export function analyzerNamesAt(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): SymbolRow[] {
  if (db === undefined) return [];
  return (db.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_analyzer_names WHERE space = ? AND address = ?`).all(space, address) as Raw[]).map(toSymbol).sort(byAnalyzer);
}

/** The analyzer names with this name: more than one when two analyzers gave it to different addresses. */
export function analyzerNamed(db: DatabaseSync | undefined, name: string, space: Space = DEFAULT_SPACE): SymbolRow[] {
  if (db === undefined) return [];
  return (db.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_analyzer_names WHERE space = ? AND name = ?`).all(space, name) as Raw[]).map(toSymbol).sort(byAnalyzer);
}

/** The analyzers in the order that their names are used when no other name exists (D74). */
export const ANALYZER_NAME_ORDER: readonly Origin[] = ["heuristic", "ghidra", "dxa"];
const byAnalyzer = (a: SymbolRow, b: SymbolRow) => a.address - b.address || ANALYZER_NAME_ORDER.indexOf(a.origin) - ANALYZER_NAME_ORDER.indexOf(b.origin);

/** Current analyzer names in a range, in address order and then heuristic, Ghidra, DXA. */
export function listAnalyzerNames(db: DatabaseSync | undefined, range: Range = ALL, kind?: SymbolKind, origins?: OriginFilter, space: Space = DEFAULT_SPACE): SymbolRow[] {
  if (db === undefined) return [];
  return (db.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_analyzer_names WHERE space = ? AND address BETWEEN ? AND ?`).all(space, range.start, range.end) as Raw[])
    .map(toSymbol)
    .filter((row) => (kind === undefined || row.kind === kind) && kept(origins)(row))
    .sort(byAnalyzer);
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

export function operandAt(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): OperandRow | undefined {
  const row = db?.prepare(`SELECT ${OPERAND_COLUMNS} FROM current_operands WHERE space = ? AND address = ?`).get(space, address) as Raw | undefined;
  return row === undefined ? undefined : toOperand(row);
}

/** Current patches that share at least one address with [start, end], in address order. */
export function patchesOverlapping(db: DatabaseSync | undefined, start: number, end: number, space: Space = DEFAULT_SPACE): PatchRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${PATCH_COLUMNS} FROM current_patches WHERE space = ? AND start_address <= ? AND end_address >= ? ORDER BY start_address`)
    .all(space, end, start)
    .map((row) => toPatch(row as Raw));
}

/** Current macro uses that share at least one address with [start, end], in address order. */
export function macroUsesOverlapping(db: DatabaseSync | undefined, start: number, end: number, space: Space = DEFAULT_SPACE): MacroUseRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${MACRO_USE_COLUMNS} FROM current_macro_uses WHERE space = ? AND start_address <= ? AND end_address >= ? ORDER BY start_address`)
    .all(space, end, start)
    .map((row) => toMacroUse(row as Raw));
}

export function macroNamed(db: DatabaseSync | undefined, name: string, space: Space = DEFAULT_SPACE): MacroRow | undefined {
  const row = db?.prepare(`SELECT ${MACRO_COLUMNS} FROM current_macros WHERE space = ? AND name = ?`).get(space, name) as Raw | undefined;
  return row === undefined ? undefined : toMacro(row);
}

/** Everything currently known at one address: the main lookup for skills. */
export interface AddressKnowledge {
  space: Space;
  address: number;
  symbol?: SymbolRow;
  /** The second names that analyzers gave the address (D74). */
  analyzerNames: SymbolRow[];
  /** The current region that contains the address. */
  region?: RegionRow;
  comments: CommentRow[];
  referencesFrom: ReferenceRow[];
  referencesTo: ReferenceRow[];
  /** How the operand of the instruction here is written (D65). */
  operand?: OperandRow;
  /** The patch whose range holds the address (D72). */
  patch?: PatchRow;
  /** The macro use whose range holds the address (D73). */
  macroUse?: MacroUseRow;
  /** What user/LLM removals block here for the analyzers. */
  suppressions: SuppressionRow[];
  revision: string;
}

export function at(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): AddressKnowledge {
  const result: AddressKnowledge = {
    space,
    address,
    comments: commentsAt(db, address, space),
    referencesFrom: referencesFrom(db, address, space),
    referencesTo: referencesTo(db, address, space),
    analyzerNames: analyzerNamesAt(db, address, space),
    suppressions: suppressionsAt(db, address, space),
    revision: currentRevision(db),
  };
  const symbol = symbolAt(db, address, space);
  if (symbol !== undefined) result.symbol = symbol;
  const [region] = regionsOverlapping(db, address, address, space);
  if (region !== undefined) result.region = region;
  const operand = operandAt(db, address, space);
  if (operand !== undefined) result.operand = operand;
  const [patch] = patchesOverlapping(db, address, address, space);
  if (patch !== undefined) result.patch = patch;
  const [macroUse] = macroUsesOverlapping(db, address, address, space);
  if (macroUse !== undefined) result.macroUse = macroUse;
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

/** Current operand expressions of instructions in the range, in address order. */
export function listOperands(db: DatabaseSync | undefined, range: Range = ALL, origins?: OriginFilter, space: Space = DEFAULT_SPACE): OperandRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${OPERAND_COLUMNS} FROM current_operands WHERE space = ? AND address BETWEEN ? AND ? ORDER BY address`)
    .all(space, range.start, range.end)
    .map((row) => toOperand(row as Raw))
    .filter(kept(origins));
}

/** Current patches that share an address with the range, of one switch or of all, in address order. */
export function listPatches(db: DatabaseSync | undefined, range: Range = ALL, switchName?: string, origins?: OriginFilter, space: Space = DEFAULT_SPACE): PatchRow[] {
  return patchesOverlapping(db, range.start, range.end, space).filter((patch) => (switchName === undefined || patch.switch === switchName) && kept(origins)(patch));
}

/** Current macros, by name. */
export function listMacros(db: DatabaseSync | undefined, origins?: OriginFilter, space: Space = DEFAULT_SPACE): MacroRow[] {
  if (db === undefined) return [];
  return db
    .prepare(`SELECT ${MACRO_COLUMNS} FROM current_macros WHERE space = ? ORDER BY name`)
    .all(space)
    .map((row) => toMacro(row as Raw))
    .filter(kept(origins));
}

/** Current macro uses that share an address with the range, of one macro or of all, in address order. */
export function listMacroUses(db: DatabaseSync | undefined, range: Range = ALL, macro?: string, origins?: OriginFilter, space: Space = DEFAULT_SPACE): MacroUseRow[] {
  return macroUsesOverlapping(db, range.start, range.end, space).filter((use) => (macro === undefined || use.macro === macro) && kept(origins)(use));
}

/** The spaces that hold current knowledge, the C64 first. */
export function listSpaces(db: DatabaseSync | undefined): Space[] {
  if (db === undefined) return [];
  const rows = db
    .prepare(
      `SELECT space FROM current_symbols UNION SELECT space FROM current_analyzer_names UNION SELECT space FROM current_regions UNION SELECT space FROM current_comments UNION SELECT space FROM current_references UNION SELECT space FROM current_suppressions UNION SELECT space FROM current_modules UNION SELECT space FROM current_operands UNION SELECT space FROM current_patches UNION SELECT space FROM current_macros UNION SELECT space FROM current_macro_uses UNION SELECT space FROM current_memory UNION SELECT space FROM current_entries UNION SELECT space FROM current_coverage`,
    )
    .all() as Array<{ space: Space }>;
  const order = (space: Space) => (space === "c64" ? -2 : space === "drive8" ? -1 : Number(space.slice(4)));
  return rows.map((row) => row.space).sort((a, b) => order(a) - order(b));
}

/** Case-insensitive text search in current symbol names and comment texts of one space. */
export function search(db: DatabaseSync | undefined, text: string, limit = 50, origins?: OriginFilter, space: Space = DEFAULT_SPACE): { symbols: SymbolRow[]; analyzerNames: SymbolRow[]; comments: CommentRow[] } {
  if (db === undefined || text.length === 0) return { symbols: [], analyzerNames: [], comments: [] };
  const pattern = `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  const only = origins === undefined ? "" : ` AND origin IN (${origins.map(() => "?").join(", ")})`;
  const values = origins ?? [];
  const symbols = db
    .prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE space = ? AND name LIKE ? ESCAPE '\\'${only} ORDER BY address LIMIT ?`)
    .all(space, pattern, ...values, limit)
    .map((row) => toSymbol(row as Raw));
  const analyzerNames = db
    .prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_analyzer_names WHERE space = ? AND name LIKE ? ESCAPE '\\'${only} ORDER BY address LIMIT ?`)
    .all(space, pattern, ...values, limit)
    .map((row) => toSymbol(row as Raw));
  const comments = db
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM current_comments WHERE space = ? AND text LIKE ? ESCAPE '\\'${only} ORDER BY address, placement LIMIT ?`)
    .all(space, pattern, ...values, limit)
    .map((row) => toComment(row as Raw));
  return { symbols, analyzerNames, comments };
}
