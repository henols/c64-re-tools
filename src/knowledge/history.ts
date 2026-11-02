// Knowledge history: what used to be known, which revision changed
// it, who changed it and why. History rows are never deleted.

import type { DatabaseSync } from "node:sqlite";

import { Refusal } from "../errors.ts";
import {
  FACTS,
  resolveRevision,
  type CommentRow,
  type Fact,
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
import { DEFAULT_SPACE, type CoverageKind, type EvidenceKind, type Origin, type Space } from "./schema.ts";
import { compareText, NO_REVISION, sqlName } from "./text.ts";
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

/** The ranges of one kind of the coverage map at a project path: their number. */
export interface CoverageRow {
  space: Space;
  map: string;
  kind: CoverageKind;
  ranges: number;
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

/** The rows of each fact table that concern an address: each ? of the condition is the address. */
const AT_ADDRESS: ReadonlyArray<[Fact, string]> = [
  [FACTS.symbols, "address = ?"],
  [FACTS.analyzer_names, "address = ?"],
  [FACTS.regions, "start_address <= ? AND end_address >= ?"],
  [FACTS.comments, "address = ?"],
  [FACTS.references, "(from_address = ? OR to_address = ?)"],
  [FACTS.suppressions, "((start_address <= ? AND end_address >= ?) OR to_address = ?)"],
  [FACTS.modules, "start_address = ?"],
  [FACTS.operands, "address = ?"],
  [FACTS.patches, "start_address <= ? AND end_address >= ?"],
  [FACTS.macro_uses, "start_address <= ? AND end_address >= ?"],
];

/** Every row, current or closed, that concerns one address of a space, oldest first. */
export function historyAt(db: DatabaseSync | undefined, address: number, space: Space = DEFAULT_SPACE): HistoryEntry[] {
  if (db === undefined) return [];
  const entries: HistoryEntry[] = [];
  for (const [fact, where] of AT_ADDRESS) {
    const raws = db.prepare(`SELECT ${fact.columns}, valid_to_revision FROM ${sqlName(fact.table)} WHERE space = ? AND ${where}`).all(space, ...Array.from(where.matchAll(/\?/g), () => address)) as Raw[];
    for (const raw of raws) entries.push(entry(fact.entity, fact.map(raw), raw));
  }
  return entries.sort(bySequence);
}

/** Every row of a macro with this name, and every use of it, oldest first. */
export function historyOfMacro(db: DatabaseSync | undefined, name: string, space: Space = DEFAULT_SPACE): HistoryEntry[] {
  if (db === undefined) return [];
  const macros = (db.prepare(`SELECT ${FACTS.macros.columns}, valid_to_revision FROM macros WHERE space = ? AND name = ?`).all(space, name) as Raw[]).map((raw) => entry("macro", FACTS.macros.map(raw), raw));
  const uses = (db.prepare(`SELECT ${FACTS.macro_uses.columns}, valid_to_revision FROM macro_uses WHERE space = ? AND macro = ?`).all(space, name) as Raw[]).map((raw) => entry("macro-use", FACTS.macro_uses.map(raw), raw));
  return [...macros, ...uses].sort(bySequence);
}

/** Every row of a switch with this name and every patch of it, oldest first. */
export function historyOfSwitch(db: DatabaseSync | undefined, name: string, space: Space = DEFAULT_SPACE): HistoryEntry[] {
  if (db === undefined) return [];
  const switches = (db.prepare(`SELECT ${FACTS.switches.columns}, valid_to_revision FROM switches WHERE space = ? AND name = ?`).all(space, name) as Raw[]).map((raw) => entry("switch", FACTS.switches.map(raw), raw));
  const patches = (db.prepare(`SELECT ${FACTS.patches.columns}, valid_to_revision FROM patches WHERE space = ? AND switch_name = ?`).all(space, name) as Raw[]).map((raw) => entry("patch", FACTS.patches.map(raw), raw));
  return [...switches, ...patches].sort(bySequence);
}

/** Every symbol row of a space that ever had this name, oldest first: a name can move between addresses. */
export function historyNamed(db: DatabaseSync | undefined, name: string, space: Space = DEFAULT_SPACE): HistoryEntry[] {
  if (db === undefined) return [];
  return (db.prepare(`SELECT ${FACTS.symbols.columns}, valid_to_revision FROM symbols WHERE space = ? AND name = ?`).all(space, name) as Raw[])
    .map((raw) => entry("symbol", FACTS.symbols.map(raw), raw))
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

/** The rows that a revision added and closed, counted by kind of row: only the kinds that it changed. */
export function revisionCounts(changes: Pick<RevisionChanges, "added" | "closed">): Partial<Record<HistoryEntry["entity"], { added: number; closed: number }>> {
  const counts: Partial<Record<HistoryEntry["entity"], { added: number; closed: number }>> = {};
  for (const entry of changes.added) (counts[entry.entity] ??= { added: 0, closed: 0 }).added++;
  for (const entry of changes.closed) (counts[entry.entity] ??= { added: 0, closed: 0 }).closed++;
  return counts;
}

/** One revision and exactly what it changed. */
export function revision(db: DatabaseSync | undefined, text: string): RevisionChanges {
  const id = resolveRevision(db, text);
  if (id === NO_REVISION) return { revision: { id: NO_REVISION, operation: "none", description: "The knowledge before every revision. It is empty." }, added: [], closed: [] };
  const raw = db?.prepare("SELECT * FROM revisions WHERE id = ?").get(id) as Raw | undefined;
  if (db === undefined || raw === undefined) throw new Refusal("not-found", `There is no revision ${id}.`);
  // The facts, then the program: its memory, its entry and its coverage.
  const program: Fact[] = [
    {
      table: "memory",
      entity: "memory",
      columns: "space, address, length(bytes) / 2 AS bytes, origin, valid_from_revision",
      map: (row: Raw): MemoryRow => ({ space: row.space as Space, address: row.address as number, bytes: row.bytes as number, origin: row.origin as Origin, revision: row.valid_from_revision as string }),
    },
    {
      table: "entries",
      entity: "entry",
      columns: "space, address, state IS NOT NULL AS has_state, json_array_length(coalesce(stages, '[]')) AS stage_count, origin, valid_from_revision",
      map: (row: Raw): EntryRow => ({ space: row.space as Space, address: row.address as number, state: row.has_state === 1, stages: row.stage_count as number, origin: row.origin as Origin, revision: row.valid_from_revision as string }),
    },
    {
      table: "coverage",
      entity: "coverage",
      columns: "space, map, kind, length(ranges) - length(replace(ranges, ' ', '')) + 1 AS ranges, origin, valid_from_revision",
      map: (row: Raw): CoverageRow => ({ space: row.space as Space, map: row.map as string, kind: row.kind as CoverageKind, ranges: row.ranges as number, origin: row.origin as Origin, revision: row.valid_from_revision as string }),
    },
  ];
  const added: HistoryEntry[] = [];
  const closed: HistoryEntry[] = [];
  for (const { entity, table, columns, map } of [...Object.values(FACTS), ...program]) {
    for (const row of db.prepare(`SELECT ${columns}, valid_to_revision FROM ${sqlName(table)} WHERE valid_from_revision = ?`).all(id) as Raw[]) {
      added.push(entry(entity, map(row), row));
    }
    for (const row of db.prepare(`SELECT ${columns}, valid_to_revision FROM ${sqlName(table)} WHERE valid_to_revision = ?`).all(id) as Raw[]) {
      closed.push(entry(entity, map(row), row));
    }
  }
  return { revision: withEvidence(db, toRevision(raw)), added, closed };
}

