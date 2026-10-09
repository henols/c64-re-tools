// Semantic knowledge writes. Every accepted change is one
// revision in one transaction: superseded rows are closed, never deleted.

import type { DatabaseSync } from "node:sqlite";

import { SYMBOL_NAME } from "../c64.ts";
import { KnowledgeError, transaction } from "./database.ts";
import {
  COMMENT_COLUMNS,
  commentsAt,
  currentRevision,
  REFERENCE_COLUMNS,
  referencesFrom,
  REGION_COLUMNS,
  regionsOverlapping,
  SYMBOL_COLUMNS,
  symbolAt,
  symbolNamed,
  toComment,
  toReference,
  toRegion,
  toSymbol,
  type CommentRow,
  type ReferenceRow,
  type RegionRow,
  type SymbolRow,
} from "./read.ts";
import {
  COMMENT_PLACEMENTS,
  REFERENCE_KINDS,
  REGION_TYPES,
  SYMBOL_KINDS,
  type CommentPlacement,
  type Origin,
  type ReferenceKind,
  type RegionType,
  type SymbolKind,
} from "./schema.ts";

/** Who writes and why. Semantic writes come from the user or the LLM, never as an analyzer. */
export interface WriteContext {
  origin: Extract<Origin, "user" | "llm">;
  /** A short reason, kept with the revision for later review. */
  description?: string;
  /** The revision the caller read; the write is refused if knowledge changed since. */
  expectedRevision?: number;
}

/** The revision a write created, or null when nothing needed to change. */
export interface WriteResult<T, P = never> {
  revision: number | null;
  current: T;
  /** The current rows of another origin that this write replaced, as they were before it. */
  previous?: P;
}

export { SYMBOL_NAME };
const MAX_COMMENT = 4000;

export function checkAddress(value: number, what = "address"): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new KnowledgeError("invalid-input", `${what} must be from $0000 to $ffff.`);
}

function checkOneOf<T extends string>(values: readonly T[], value: string, what: string): asserts value is T {
  if (!(values as readonly string[]).includes(value)) throw new KnowledgeError("invalid-input", `${what} must be one of: ${values.join(", ")}.`);
}

export function hex(value: number): string {
  return `$${value.toString(16).padStart(4, "0")}`;
}

/** What a revision records about its writer. Analyzer imports may add tool details. */
export interface ChangeContext {
  origin: Origin;
  description?: string;
  expectedRevision?: number;
  inputHash?: string;
  toolVersion?: string;
}

/**
 * One write: refuses a stale expected revision, then creates the revision row
 * only when the first actual change happens, so a no-op leaves no revision.
 */
export class Change {
  revision: number | null = null;
  readonly #db: DatabaseSync;
  readonly #context: ChangeContext;
  readonly #operation: string;

  constructor(db: DatabaseSync, context: ChangeContext, operation: string) {
    this.#db = db;
    this.#context = context;
    this.#operation = operation;
    const current = currentRevision(db);
    if (context.expectedRevision !== undefined && context.expectedRevision !== current) {
      throw new KnowledgeError(
        "stale-revision",
        `Knowledge changed since revision ${context.expectedRevision}; it is now at revision ${current}. Read it again and decide again.`,
      );
    }
  }

  /** The id of this write's revision, created on first use. */
  id(): number {
    if (this.revision !== null) return this.revision;
    const created = this.#db
      .prepare("INSERT INTO revisions (created_at, origin, operation, input_hash, tool_version, description) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
      .get(
        new Date().toISOString(),
        this.#context.origin,
        this.#operation,
        this.#context.inputHash ?? null,
        this.#context.toolVersion ?? null,
        this.#context.description ?? null,
      ) as { id: number };
    this.revision = created.id;
    this.#db.prepare("UPDATE meta SET value = ? WHERE key = 'current_revision'").run(String(created.id));
    return created.id;
  }

  /** Closes the current rows of `table` that `where` selects. */
  close(table: string, where: string, ...values: Array<number | string>): void {
    this.#db.prepare(`UPDATE ${table} SET valid_to_revision = ? WHERE valid_to_revision IS NULL AND ${where}`).run(this.id(), ...values);
  }

  insertSymbol(row: Omit<SymbolRow, "revision">): void {
    this.#db.prepare("INSERT INTO symbols (address, name, kind, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?)").run(row.address, row.name, row.kind, row.origin, this.id());
  }

  insertRegion(row: Omit<RegionRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO regions (start_address, end_address, type, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?)")
      .run(row.start, row.end, row.type, row.origin, this.id());
  }

  insertComment(row: Omit<CommentRow, "revision">): void {
    this.#db.prepare("INSERT INTO comments (address, placement, text, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?)").run(row.address, row.placement, row.text, row.origin, this.id());
  }

  insertReference(row: Omit<ReferenceRow, "revision">): void {
    this.#db
      .prepare('INSERT INTO "references" (from_address, to_address, kind, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?)')
      .run(row.from, row.to, row.kind, row.origin, this.id());
  }
}

/** Runs one semantic write in a transaction. */
function write<T>(db: DatabaseSync, context: WriteContext, operation: string, work: (change: Change) => T): WriteResult<T> {
  if (context.origin !== "user" && context.origin !== "llm") {
    throw new KnowledgeError("invalid-input", "A semantic write comes from the user or the LLM.");
  }
  return transaction(db, () => {
    const change = new Change(db, context, operation);
    const current = work(change);
    return { revision: change.revision, current };
  });
}

/** Names the symbol at an address (one current symbol per address, unique names). */
export function renameSymbol(
  db: DatabaseSync,
  context: WriteContext,
  request: { address: number; name: string; kind?: SymbolKind },
): WriteResult<SymbolRow, SymbolRow> {
  checkAddress(request.address);
  if (!SYMBOL_NAME.test(request.name)) {
    throw new KnowledgeError("invalid-input", "A symbol name is a letter or underscore, then letters, digits or underscores (at most 64), with an optional leading dot.");
  }
  if (request.kind !== undefined) checkOneOf(SYMBOL_KINDS, request.kind, "kind");
  let previous: SymbolRow | undefined;
  const result = write(db, context, "rename-symbol", (change) => {
    const existing = symbolAt(db, request.address);
    const kind = request.kind ?? existing?.kind ?? "label";
    if (existing !== undefined && existing.name === request.name && existing.kind === kind) return existing;
    const owner = symbolNamed(db, request.name);
    if (owner !== undefined && owner.address !== request.address) {
      throw new KnowledgeError("conflict", `The name ${request.name} already belongs to ${hex(owner.address)}. Rename or remove that symbol first.`);
    }
    if (existing !== undefined) {
      change.close("symbols", "address = ?", request.address);
      if (existing.origin !== context.origin) previous = existing;
    }
    change.insertSymbol({ address: request.address, name: request.name, kind, origin: context.origin });
    return symbolAt(db, request.address)!;
  });
  return previous === undefined ? result : { ...result, previous };
}

export function removeSymbol(db: DatabaseSync, context: WriteContext, request: { address: number }): WriteResult<null> {
  checkAddress(request.address);
  return write(db, context, "remove-symbol", (change) => {
    if (symbolAt(db, request.address) === undefined) throw new KnowledgeError("not-found", `There is no symbol at ${hex(request.address)}.`);
    change.close("symbols", "address = ?", request.address);
    return null;
  });
}

/** Closes the current regions over [start, end] and keeps their parts outside it. */
export function clearRange(db: DatabaseSync, change: Change, start: number, end: number): void {
  const overlapping = regionsOverlapping(db, start, end);
  if (overlapping.length === 0) return;
  change.close("regions", "start_address <= ? AND end_address >= ?", end, start);
  for (const region of overlapping) {
    if (region.start < start) change.insertRegion({ start: region.start, end: start - 1, type: region.type, origin: region.origin });
    if (region.end > end) change.insertRegion({ start: end + 1, end: region.end, type: region.type, origin: region.origin });
  }
}

/** Classifies [start, end]; overlapping regions are split so current regions never overlap. */
export function classifyRegion(
  db: DatabaseSync,
  context: WriteContext,
  request: { start: number; end: number; type: RegionType },
): WriteResult<RegionRow[], RegionRow[]> {
  checkAddress(request.start, "start");
  checkAddress(request.end, "end");
  if (request.end < request.start) throw new KnowledgeError("invalid-input", "end must not be before start.");
  checkOneOf(REGION_TYPES, request.type, "type");
  let previous: RegionRow[] = [];
  const result = write(db, context, "classify-region", (change) => {
    const overlapping = regionsOverlapping(db, request.start, request.end);
    const same = overlapping.length === 1 && overlapping[0]!.start === request.start && overlapping[0]!.end === request.end && overlapping[0]!.type === request.type;
    if (!same) {
      clearRange(db, change, request.start, request.end);
      change.insertRegion({ start: request.start, end: request.end, type: request.type, origin: context.origin });
      previous = overlapping.filter((row) => row.origin !== context.origin);
    }
    return regionsOverlapping(db, request.start, request.end);
  });
  return previous.length === 0 ? result : { ...result, previous };
}

/** Makes [start, end] unclassified again; parts of regions outside it stay. */
export function unclassifyRegion(db: DatabaseSync, context: WriteContext, request: { start: number; end: number }): WriteResult<null> {
  checkAddress(request.start, "start");
  checkAddress(request.end, "end");
  if (request.end < request.start) throw new KnowledgeError("invalid-input", "end must not be before start.");
  return write(db, context, "unclassify-region", (change) => {
    if (regionsOverlapping(db, request.start, request.end).length === 0) {
      throw new KnowledgeError("not-found", `No region covers ${hex(request.start)}-${hex(request.end)}.`);
    }
    clearRange(db, change, request.start, request.end);
    return null;
  });
}

export function setComment(
  db: DatabaseSync,
  context: WriteContext,
  request: { address: number; placement: CommentPlacement; text: string },
): WriteResult<CommentRow> {
  checkAddress(request.address);
  checkOneOf(COMMENT_PLACEMENTS, request.placement, "placement");
  const text = request.text.trim();
  if (text.length === 0 || text.length > MAX_COMMENT) throw new KnowledgeError("invalid-input", `A comment has 1 to ${MAX_COMMENT} characters.`);
  return write(db, context, "set-comment", (change) => {
    const existing = commentsAt(db, request.address).find((comment) => comment.placement === request.placement);
    if (existing?.text === text) return existing;
    if (existing !== undefined) change.close("comments", "address = ? AND placement = ?", request.address, request.placement);
    change.insertComment({ address: request.address, placement: request.placement, text, origin: context.origin });
    return commentsAt(db, request.address).find((comment) => comment.placement === request.placement)!;
  });
}

export function removeComment(db: DatabaseSync, context: WriteContext, request: { address: number; placement: CommentPlacement }): WriteResult<null> {
  checkAddress(request.address);
  checkOneOf(COMMENT_PLACEMENTS, request.placement, "placement");
  return write(db, context, "remove-comment", (change) => {
    if (!commentsAt(db, request.address).some((comment) => comment.placement === request.placement)) {
      throw new KnowledgeError("not-found", `There is no ${request.placement} comment at ${hex(request.address)}.`);
    }
    change.close("comments", "address = ? AND placement = ?", request.address, request.placement);
    return null;
  });
}

export function addReference(
  db: DatabaseSync,
  context: WriteContext,
  request: { from: number; to: number; kind: ReferenceKind },
): WriteResult<ReferenceRow> {
  checkAddress(request.from, "from");
  checkAddress(request.to, "to");
  checkOneOf(REFERENCE_KINDS, request.kind, "kind");
  return write(db, context, "add-reference", (change) => {
    const find = () => referencesFrom(db, request.from).find((reference) => reference.to === request.to && reference.kind === request.kind);
    const existing = find();
    if (existing !== undefined) return existing;
    change.insertReference({ ...request, origin: context.origin });
    return find()!;
  });
}

export function removeReference(db: DatabaseSync, context: WriteContext, request: { from: number; to: number; kind: ReferenceKind }): WriteResult<null> {
  checkAddress(request.from, "from");
  checkAddress(request.to, "to");
  checkOneOf(REFERENCE_KINDS, request.kind, "kind");
  return write(db, context, "remove-reference", (change) => {
    if (!referencesFrom(db, request.from).some((reference) => reference.to === request.to && reference.kind === request.kind)) {
      throw new KnowledgeError("not-found", `There is no ${request.kind} reference from ${hex(request.from)} to ${hex(request.to)}.`);
    }
    change.close('"references"', "from_address = ? AND to_address = ? AND kind = ?", request.from, request.to, request.kind);
    return null;
  });
}

/** Row content without its revision, as a comparable key. */
const KEYS = {
  symbols: { columns: SYMBOL_COLUMNS, map: toSymbol, key: (row: SymbolRow) => `${row.address}|${row.name}|${row.kind}|${row.origin}` },
  regions: { columns: REGION_COLUMNS, map: toRegion, key: (row: RegionRow) => `${row.start}|${row.end}|${row.type}|${row.origin}` },
  comments: { columns: COMMENT_COLUMNS, map: toComment, key: (row: CommentRow) => `${row.address}|${row.placement}|${row.text}|${row.origin}` },
  references: { columns: REFERENCE_COLUMNS, map: toReference, key: (row: ReferenceRow) => `${row.from}|${row.to}|${row.kind}|${row.origin}` },
} as const;

/**
 * Makes the current knowledge equal to what it was at `revision`, as a new
 * revision. History is never erased; restored rows keep their origin.
 */
export function revert(db: DatabaseSync, context: WriteContext, request: { revision: number }): WriteResult<{ restoredRevision: number }> {
  return write(db, context, "revert", (change) => {
    const current = currentRevision(db);
    if (!Number.isInteger(request.revision) || request.revision < 0 || request.revision > current) {
      throw new KnowledgeError("not-found", `There is no revision ${request.revision}; knowledge is at revision ${current}.`);
    }
    const at = "valid_from_revision <= ? AND (valid_to_revision IS NULL OR valid_to_revision > ?)";
    for (const [table, spec] of Object.entries(KEYS)) {
      const name = table === "references" ? '"references"' : table;
      const then = db.prepare(`SELECT ${spec.columns}, id FROM ${name} WHERE ${at}`).all(request.revision, request.revision) as Array<Record<string, unknown>>;
      const now = db.prepare(`SELECT ${spec.columns}, id FROM ${name} WHERE valid_to_revision IS NULL`).all() as Array<Record<string, unknown>>;
      const key = (row: Record<string, unknown>) => (spec.key as (row: unknown) => string)(spec.map(row as never));
      const thenKeys = new Set(then.map(key));
      const nowKeys = new Set(now.map(key));
      // Close first, so restored rows never collide with the current-row rules.
      for (const row of now) if (!thenKeys.has(key(row))) change.close(name, "id = ?", row.id as number);
      for (const row of then) {
        if (nowKeys.has(key(row))) continue;
        const mapped = spec.map(row as never) as SymbolRow & RegionRow & CommentRow & ReferenceRow;
        if (table === "symbols") change.insertSymbol(mapped);
        else if (table === "regions") change.insertRegion(mapped);
        else if (table === "comments") change.insertComment(mapped);
        else change.insertReference(mapped);
      }
    }
    return { restoredRevision: request.revision };
  });
}
