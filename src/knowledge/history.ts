// Knowledge history: what used to be known, which revision changed
// it, who changed it and why. History rows are never deleted.

import type { DatabaseSync } from "node:sqlite";

import { Refusal } from "../errors.ts";
import {
  COMMENT_COLUMNS,
  MACHINE_COLUMNS,
  MACRO_COLUMNS,
  MACRO_USE_COLUMNS,
  MODULE_COLUMNS,
  OPERAND_COLUMNS,
  PATCH_COLUMNS,
  REFERENCE_COLUMNS,
  RELEASE_COLUMNS,
  SWITCH_COLUMNS,
  REGION_COLUMNS,
  resolveRevision,
  SUPPRESSION_COLUMNS,
  SYMBOL_COLUMNS,
  toComment,
  toMachine,
  toMacro,
  toMacroUse,
  toModule,
  toOperand,
  toPatch,
  toReference,
  toRelease,
  toStartScreen,
  START_SCREEN_COLUMNS,
  toSwitch,
  toRegion,
  toSuppression,
  toSymbol,
  type CommentRow,
  type MachineRow,
  type MacroRow,
  type MacroUseRow,
  type ModuleRow,
  type OperandRow,
  type PatchRow,
  type ReferenceRow,
  type ReleaseRow,
  type StartScreenRow,
  type SwitchRow,
  type RegionRow,
  type SuppressionRow,
  type SymbolRow,
} from "./read.ts";
import { type CoverageKind, type EvidenceKind, type Origin, type Space } from "./schema.ts";
import { mainSpaceOf } from "./project-machine.ts";
import { compareText, NO_REVISION } from "./text.ts";
import type { Evidence } from "./write.ts";

export interface Revision {
  id: string;
  createdAt: string;
  origin: Origin;
  operation: string;
  description?: string;
  inputHash?: string;
  toolVersion?: string;
  /** A revert: the revision whose knowledge it restored. */
  restores?: string;
  /** A revert of one space: that space. A revert without it restored every space. */
  restoresSpace?: Space;
  /** What the change rests on. */
  evidence?: Evidence[];
}

/** A memory row of the program: the bytes from an address. */
export interface MemoryRow {
  space: Space;
  address: number;
  /** The count of bytes in the row. */
  bytes: number;
  origin: Origin;
  revision: string;
}

/** The entry of the program, and whether it has a machine state and stages. */
export interface EntryRow {
  space: Space;
  address: number;
  state: boolean;
  stages: number;
  origin: Origin;
  revision: string;
}

/** A coverage range of one kind. */
export interface CoverageRow {
  space: Space;
  kind: CoverageKind;
  start: number;
  end: number;
  origin: Origin;
  revision: string;
}

/** One knowledge row with its validity: from its first revision until the revision that closed it. */
export type HistoryEntry =
  | { entity: "memory"; row: MemoryRow; from: string; to?: string }
  | { entity: "entry"; row: EntryRow; from: string; to?: string }
  | { entity: "coverage"; row: CoverageRow; from: string; to?: string }
  | { entity: "symbol"; row: SymbolRow; from: string; to?: string }
  | { entity: "analyzer-name"; row: SymbolRow; from: string; to?: string }
  | { entity: "region"; row: RegionRow; from: string; to?: string }
  | { entity: "comment"; row: CommentRow; from: string; to?: string }
  | { entity: "reference"; row: ReferenceRow; from: string; to?: string }
  | { entity: "suppression"; row: SuppressionRow; from: string; to?: string }
  | { entity: "module"; row: ModuleRow; from: string; to?: string }
  | { entity: "operand"; row: OperandRow; from: string; to?: string }
  | { entity: "patch"; row: PatchRow; from: string; to?: string }
  | { entity: "switch"; row: SwitchRow; from: string; to?: string }
  | { entity: "release"; row: ReleaseRow; from: string; to?: string }
  | { entity: "start-screen"; row: StartScreenRow; from: string; to?: string }
  | { entity: "machine"; row: MachineRow; from: string; to?: string }
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
  if (row.restored_revision !== null) revision.restores = row.restored_revision as string;
  if (row.restored_space !== null && row.restored_space !== undefined) revision.restoresSpace = row.restored_space as Space;
  return revision;
}

function entry<E extends HistoryEntry["entity"]>(entity: E, row: unknown, raw: Raw): HistoryEntry {
  const result = { entity, row, from: raw.valid_from_revision as string } as HistoryEntry;
  if (raw.valid_to_revision !== null) result.to = raw.valid_to_revision as string;
  return result;
}

/** Revision ids sort in time order as text; a current row sorts after every closed one. */
function bySequence(a: HistoryEntry, b: HistoryEntry): number {
  return compareText(a.from, b.from) || compareText(a.to ?? "~", b.to ?? "~");
}

/** Every row, current or closed, that concerns one address of a space, oldest first. */
export function historyAt(db: DatabaseSync | undefined, address: number, space: Space = mainSpaceOf(db)): HistoryEntry[] {
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
export function historyOfMacro(db: DatabaseSync | undefined, name: string, space: Space = mainSpaceOf(db)): HistoryEntry[] {
  if (db === undefined) return [];
  const macros = (db.prepare(`SELECT ${MACRO_COLUMNS}, valid_to_revision FROM macros WHERE space = ? AND name = ?`).all(space, name) as Raw[]).map((raw) => entry("macro", toMacro(raw), raw));
  const uses = (db.prepare(`SELECT ${MACRO_USE_COLUMNS}, valid_to_revision FROM macro_uses WHERE space = ? AND macro = ?`).all(space, name) as Raw[]).map((raw) => entry("macro-use", toMacroUse(raw), raw));
  return [...macros, ...uses].sort(bySequence);
}

/** Every row of a switch with this name and every patch of it, oldest first. */
export function historyOfSwitch(db: DatabaseSync | undefined, name: string, space: Space = mainSpaceOf(db)): HistoryEntry[] {
  if (db === undefined) return [];
  const switches = (db.prepare(`SELECT ${SWITCH_COLUMNS}, valid_to_revision FROM switches WHERE space = ? AND name = ?`).all(space, name) as Raw[]).map((raw) => entry("switch", toSwitch(raw), raw));
  const patches = (db.prepare(`SELECT ${PATCH_COLUMNS}, valid_to_revision FROM patches WHERE space = ? AND switch_name = ?`).all(space, name) as Raw[]).map((raw) => entry("patch", toPatch(raw), raw));
  return [...switches, ...patches].sort(bySequence);
}

/** Every symbol row of a space that ever had this name, oldest first: a name can move between addresses. */
export function historyNamed(db: DatabaseSync | undefined, name: string, space: Space = mainSpaceOf(db)): HistoryEntry[] {
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

/** Revision 0: the knowledge before every revision. It is empty, and no write made it, so it has no time, origin or evidence. */
export interface InitialRevision {
  id: typeof NO_REVISION;
  operation: "none";
  description: string;
  createdAt?: undefined;
  origin?: undefined;
  inputHash?: undefined;
  toolVersion?: undefined;
  restores?: undefined;
  restoresSpace?: undefined;
  evidence?: undefined;
}

export interface RevisionChanges {
  revision: Revision | InitialRevision;
  /** Rows this revision made current. */
  added: HistoryEntry[];
  /** Rows this revision closed. */
  closed: HistoryEntry[];
}

/** One revision and exactly what it changed. */
export function revision(db: DatabaseSync | undefined, text: string): RevisionChanges {
  const id = resolveRevision(db, text);
  if (id === NO_REVISION) return { revision: { id: NO_REVISION, operation: "none", description: "The knowledge before every revision. It is empty." }, added: [], closed: [] };
  const raw = db?.prepare("SELECT * FROM revisions WHERE id = ?").get(id) as Raw | undefined;
  if (db === undefined || raw === undefined) throw new Refusal("not-found", `There is no revision ${id}.`);
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
    ["switch", "switches", SWITCH_COLUMNS, toSwitch],
    ["release", "releases", RELEASE_COLUMNS, toRelease],
    ["start-screen", "start_screens", START_SCREEN_COLUMNS, toStartScreen],
    ["machine", "machine", MACHINE_COLUMNS, toMachine],
    ["macro", "macros", MACRO_COLUMNS, toMacro],
    ["macro-use", "macro_uses", MACRO_USE_COLUMNS, toMacroUse],
  ] as const;
  // The program: its memory, its entry and its coverage.
  const program = [
    ["memory", "memory", "space, address, length(bytes) / 2 AS bytes, origin, valid_from_revision", (row: Raw): MemoryRow => ({ space: row.space as Space, address: row.address as number, bytes: row.bytes as number, origin: row.origin as Origin, revision: row.valid_from_revision as string })],
    [
      "entry",
      "entries",
      "space, address, state IS NOT NULL AS has_state, json_array_length(coalesce(stages, '[]')) AS stage_count, origin, valid_from_revision",
      (row: Raw): EntryRow => ({ space: row.space as Space, address: row.address as number, state: row.has_state === 1, stages: row.stage_count as number, origin: row.origin as Origin, revision: row.valid_from_revision as string }),
    ],
    [
      "coverage",
      "coverage",
      "space, kind, start_address, end_address, origin, valid_from_revision",
      (row: Raw): CoverageRow => ({ space: row.space as Space, kind: row.kind as CoverageKind, start: row.start_address as number, end: row.end_address as number, origin: row.origin as Origin, revision: row.valid_from_revision as string }),
    ],
  ] as const;
  const added: HistoryEntry[] = [];
  const closed: HistoryEntry[] = [];
  for (const [entity, table, columns, map] of [...tables, ...program]) {
    for (const row of db.prepare(`SELECT ${columns}, valid_to_revision FROM ${table} WHERE valid_from_revision = ?`).all(id) as Raw[]) {
      added.push(entry(entity, map(row), row));
    }
    for (const row of db.prepare(`SELECT ${columns}, valid_to_revision FROM ${table} WHERE valid_to_revision = ?`).all(id) as Raw[]) {
      closed.push(entry(entity, map(row), row));
    }
  }
  return { revision: withEvidence(db, toRevision(raw)), added, closed };
}

