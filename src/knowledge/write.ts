// Semantic knowledge writes. Every accepted change is one
// revision in one transaction: superseded rows are closed, never deleted.

import type { DatabaseSync } from "node:sqlite";

import { SYMBOL_NAME } from "../c64.ts";
import { isoCet } from "../time.ts";
import { KnowledgeError, transaction } from "./database.ts";
import {
  COMMENT_COLUMNS,
  commentsAt,
  currentRevision,
  MODULE_COLUMNS,
  moduleAt,
  moduleWithFile,
  REFERENCE_COLUMNS,
  referencesFrom,
  REGION_COLUMNS,
  regionsOverlapping,
  SUPPRESSION_COLUMNS,
  suppressionsOverlapping,
  SYMBOL_COLUMNS,
  symbolAt,
  symbolNamed,
  toComment,
  toModule,
  toReference,
  toRegion,
  toSuppression,
  toSymbol,
  type CommentRow,
  type ModuleRow,
  type ReferenceRow,
  type RegionRow,
  type SuppressionRow,
  type SymbolRow,
} from "./read.ts";
import {
  COMMENT_PLACEMENTS,
  EVIDENCE_KINDS,
  MAX_ELEMENT,
  MODULE_FILE,
  NO_ELEMENT_TYPES,
  REFERENCE_KINDS,
  REGION_TYPES,
  SYMBOL_KINDS,
  type CommentPlacement,
  type EvidenceKind,
  type Origin,
  type ReferenceKind,
  type RegionType,
  type SymbolKind,
} from "./schema.ts";

/** What a change rests on (D42): a coverage run, a test or another project file with its SHA-256, or a note. */
export interface Evidence {
  kind: EvidenceKind;
  ref: string;
  sha256?: string;
}

/** Who writes and why. Semantic writes come from the user or the LLM, never as an analyzer. */
export interface WriteContext {
  origin: Extract<Origin, "user" | "llm">;
  /** A short reason, kept with the revision for later review. */
  description?: string;
  /** The revision the caller read; the write is refused if knowledge changed since. */
  expectedRevision?: number;
  /** Kept with the revision when the write changes something. */
  evidence?: Evidence[];
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
const MAX_EVIDENCE_REF = 1000;

export function checkAddress(value: number, what = "address"): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new KnowledgeError("invalid-input", `${what} must be from $0000 to $ffff.`);
}

function checkOneOf<T extends string>(values: readonly T[], value: string, what: string): asserts value is T {
  if (!(values as readonly string[]).includes(value)) throw new KnowledgeError("invalid-input", `${what} must be one of: ${values.join(", ")}.`);
}

export function hex(value: number): string {
  return `$${value.toString(16).padStart(4, "0")}`;
}

export interface AddressRange {
  start: number;
  end: number;
}

/** Parts of `range` that no range in `holes` covers. */
export function subtract(range: AddressRange, holes: AddressRange[]): AddressRange[] {
  let pieces = [range];
  for (const hole of holes) {
    pieces = pieces.flatMap((piece) => {
      if (hole.end < piece.start || hole.start > piece.end) return [piece];
      const left = hole.start > piece.start ? [{ start: piece.start, end: hole.start - 1 }] : [];
      const right = hole.end < piece.end ? [{ start: hole.end + 1, end: piece.end }] : [];
      return [...left, ...right];
    });
  }
  return pieces;
}

/** What a revision records about its writer. Analyzer imports may add tool details. */
export interface ChangeContext {
  origin: Origin;
  description?: string;
  expectedRevision?: number;
  inputHash?: string;
  toolVersion?: string;
  evidence?: Evidence[];
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

  /** The id of this write's revision, created on first use with its evidence. */
  id(): number {
    if (this.revision !== null) return this.revision;
    const created = this.#db
      .prepare("INSERT INTO revisions (created_at, origin, operation, input_hash, tool_version, description) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
      .get(
        isoCet(new Date()),
        this.#context.origin,
        this.#operation,
        this.#context.inputHash ?? null,
        this.#context.toolVersion ?? null,
        this.#context.description ?? null,
      ) as { id: number };
    this.revision = created.id;
    this.#db.prepare("UPDATE meta SET value = ? WHERE key = 'current_revision'").run(String(created.id));
    const evidence = this.#db.prepare("INSERT INTO evidence (revision, kind, ref, sha256) VALUES (?, ?, ?, ?)");
    for (const item of this.#context.evidence ?? []) evidence.run(created.id, item.kind, item.ref, item.sha256 ?? null);
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
      .prepare("INSERT INTO regions (start_address, end_address, type, element, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?)")
      .run(row.start, row.end, row.type, row.element ?? null, row.origin, this.id());
  }

  insertComment(row: Omit<CommentRow, "revision">): void {
    this.#db.prepare("INSERT INTO comments (address, placement, text, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?)").run(row.address, row.placement, row.text, row.origin, this.id());
  }

  insertReference(row: Omit<ReferenceRow, "revision">): void {
    this.#db
      .prepare('INSERT INTO "references" (from_address, to_address, kind, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?)')
      .run(row.from, row.to, row.kind, row.origin, this.id());
  }

  insertModule(row: Omit<ModuleRow, "revision">): void {
    this.#db.prepare("INSERT INTO modules (start_address, file, title, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?)").run(row.start, row.file, row.title ?? null, row.origin, this.id());
  }

  insertSuppression(row: Omit<SuppressionRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO suppressions (entity, start_address, end_address, to_address, kind, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(row.entity, row.start, row.end, row.to ?? null, row.kind ?? null, row.origin, this.id());
  }
}

/** Closes the current region suppressions over [start, end] and keeps their parts outside it: a user/LLM region there decides now. */
function liftRegionSuppressions(db: DatabaseSync, change: Change, start: number, end: number): void {
  const overlapping = suppressionsOverlapping(db, "region", start, end);
  if (overlapping.length === 0) return;
  change.close("suppressions", "entity = 'region' AND start_address <= ? AND end_address >= ?", end, start);
  for (const row of overlapping) {
    if (row.start < start) change.insertSuppression({ ...row, end: start - 1 });
    if (row.end > end) change.insertSuppression({ ...row, start: end + 1 });
  }
}

function checkEvidence(evidence: Evidence[] | undefined): void {
  for (const item of evidence ?? []) {
    checkOneOf(EVIDENCE_KINDS, item.kind, "evidence kind");
    if (item.ref.trim().length === 0 || item.ref.length > MAX_EVIDENCE_REF) throw new KnowledgeError("invalid-input", `evidence has 1 to ${MAX_EVIDENCE_REF} characters after its kind.`);
    if (item.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(item.sha256)) throw new KnowledgeError("invalid-input", "evidence sha256 must be 64 lowercase hex digits.");
  }
}

/** Runs semantic writes in one transaction, as one revision. */
function write<T>(db: DatabaseSync, context: WriteContext, operation: string, work: (change: Change) => T): { revision: number | null; current: T } {
  if (context.origin !== "user" && context.origin !== "llm") {
    throw new KnowledgeError("invalid-input", "A semantic write comes from the user or the LLM.");
  }
  checkEvidence(context.evidence);
  return transaction(db, () => {
    const change = new Change(db, context, operation);
    const current = work(change);
    return { revision: change.revision, current };
  });
}

/** One step of a write inside a change: its current value, and the rows of another origin it replaced. */
interface Step<T, P = never> {
  current: T;
  previous?: P;
}

const result = <T, P>(written: { revision: number | null; current: Step<T, P> }): WriteResult<T, P> =>
  written.current.previous === undefined ? { revision: written.revision, current: written.current.current } : { revision: written.revision, current: written.current.current, previous: written.current.previous };

// Each write has a check, which refuses bad input before anything opens, and a
// step, which runs inside a change. A single write and a batch share both (D42).

type SymbolRequest = { address: number; name: string; kind?: SymbolKind };
type RegionRequest = { start: number; end: number; type: RegionType; element?: number };
type RangeRequest = { start: number; end: number };
type CommentRequest = { address: number; placement: CommentPlacement; text: string };
type PlacementRequest = { address: number; placement: CommentPlacement };
type ReferenceRequest = { from: number; to: number; kind: ReferenceKind };

function checkSymbol(request: SymbolRequest): void {
  checkAddress(request.address);
  if (!SYMBOL_NAME.test(request.name)) {
    throw new KnowledgeError("invalid-input", "A symbol name is a letter or underscore, then letters, digits or underscores (at most 64), with an optional leading dot.");
  }
  if (request.kind !== undefined) checkOneOf(SYMBOL_KINDS, request.kind, "kind");
}

function renameStep(db: DatabaseSync, change: Change, origin: Origin, request: SymbolRequest): Step<SymbolRow, SymbolRow> {
  const existing = symbolAt(db, request.address);
  const kind = request.kind ?? existing?.kind ?? "label";
  if (existing !== undefined && existing.name === request.name && existing.kind === kind) return { current: existing };
  const owner = symbolNamed(db, request.name);
  if (owner !== undefined && owner.address !== request.address) {
    throw new KnowledgeError("conflict", `The name ${request.name} already belongs to ${hex(owner.address)}. Rename or remove that symbol first.`);
  }
  if (existing !== undefined) change.close("symbols", "address = ?", request.address);
  change.insertSymbol({ address: request.address, name: request.name, kind, origin });
  change.close("suppressions", "entity = 'symbol' AND start_address = ?", request.address);
  const current = symbolAt(db, request.address)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function removeSymbolStep(db: DatabaseSync, change: Change, origin: Origin, request: { address: number }): Step<null> {
  if (symbolAt(db, request.address) === undefined) throw new KnowledgeError("not-found", `There is no symbol at ${hex(request.address)}.`);
  change.close("symbols", "address = ?", request.address);
  change.insertSuppression({ entity: "symbol", start: request.address, end: request.address, origin: origin as SuppressionRow["origin"] });
  return { current: null };
}

function checkRange(request: RangeRequest): void {
  checkAddress(request.start, "start");
  checkAddress(request.end, "end");
  if (request.end < request.start) throw new KnowledgeError("invalid-input", "end must not be before start.");
}

function checkRegion(request: RegionRequest): void {
  checkRange(request);
  checkOneOf(REGION_TYPES, request.type, "type");
  if (request.element === undefined) return;
  if (NO_ELEMENT_TYPES.includes(request.type)) throw new KnowledgeError("invalid-input", `A ${request.type} region has no element size.`);
  if (!Number.isInteger(request.element) || request.element < 1 || request.element > MAX_ELEMENT) throw new KnowledgeError("invalid-input", `element must be from 1 to ${MAX_ELEMENT}.`);
  const length = request.end - request.start + 1;
  if (length % request.element !== 0) throw new KnowledgeError("invalid-input", `The region has ${length} bytes, which is not a multiple of the element size ${request.element}.`);
}

/** The element size of a piece of a region: kept when the piece still holds whole elements. */
function elementOf(piece: AddressRange, element: number | undefined): { element?: number } {
  return element !== undefined && (piece.end - piece.start + 1) % element === 0 ? { element } : {};
}

/** Closes the current regions over [start, end] and keeps their parts outside it. */
export function clearRange(db: DatabaseSync, change: Change, start: number, end: number): void {
  const overlapping = regionsOverlapping(db, start, end);
  if (overlapping.length === 0) return;
  change.close("regions", "start_address <= ? AND end_address >= ?", end, start);
  for (const region of overlapping) {
    const left = { start: region.start, end: start - 1 };
    const right = { start: end + 1, end: region.end };
    if (region.start < start) change.insertRegion({ ...left, type: region.type, ...elementOf(left, region.element), origin: region.origin });
    if (region.end > end) change.insertRegion({ ...right, type: region.type, ...elementOf(right, region.element), origin: region.origin });
  }
}

function classifyStep(db: DatabaseSync, change: Change, origin: Origin, request: RegionRequest): Step<RegionRow[], RegionRow[]> {
  const overlapping = regionsOverlapping(db, request.start, request.end);
  const [only] = overlapping;
  const same = overlapping.length === 1 && only!.start === request.start && only!.end === request.end && only!.type === request.type && only!.element === request.element;
  if (same) return { current: overlapping };
  clearRange(db, change, request.start, request.end);
  change.insertRegion({ start: request.start, end: request.end, type: request.type, ...(request.element === undefined ? {} : { element: request.element }), origin });
  liftRegionSuppressions(db, change, request.start, request.end);
  const previous = overlapping.filter((row) => row.origin !== origin);
  const current = regionsOverlapping(db, request.start, request.end);
  return previous.length === 0 ? { current } : { current, previous };
}

function unclassifyStep(db: DatabaseSync, change: Change, origin: Origin, request: RangeRequest): Step<null> {
  if (regionsOverlapping(db, request.start, request.end).length === 0) {
    throw new KnowledgeError("not-found", `No region covers ${hex(request.start)}-${hex(request.end)}.`);
  }
  clearRange(db, change, request.start, request.end);
  // Suppress only the parts that no region suppression holds yet, so suppressions never overlap.
  for (const piece of subtract(request, suppressionsOverlapping(db, "region", request.start, request.end))) {
    change.insertSuppression({ entity: "region", ...piece, origin: origin as SuppressionRow["origin"] });
  }
  return { current: null };
}

function checkComment(request: CommentRequest): string {
  checkAddress(request.address);
  checkOneOf(COMMENT_PLACEMENTS, request.placement, "placement");
  const text = request.text.trim();
  if (text.length === 0 || text.length > MAX_COMMENT) throw new KnowledgeError("invalid-input", `A comment has 1 to ${MAX_COMMENT} characters.`);
  return text;
}

function commentStep(db: DatabaseSync, change: Change, origin: Origin, request: CommentRequest): Step<CommentRow> {
  const text = request.text.trim();
  const existing = commentsAt(db, request.address).find((comment) => comment.placement === request.placement);
  if (existing?.text === text) return { current: existing };
  if (existing !== undefined) change.close("comments", "address = ? AND placement = ?", request.address, request.placement);
  change.insertComment({ address: request.address, placement: request.placement, text, origin });
  return { current: commentsAt(db, request.address).find((comment) => comment.placement === request.placement)! };
}

function checkPlacement(request: PlacementRequest): void {
  checkAddress(request.address);
  checkOneOf(COMMENT_PLACEMENTS, request.placement, "placement");
}

function uncommentStep(db: DatabaseSync, change: Change, _origin: Origin, request: PlacementRequest): Step<null> {
  if (!commentsAt(db, request.address).some((comment) => comment.placement === request.placement)) {
    throw new KnowledgeError("not-found", `There is no ${request.placement} comment at ${hex(request.address)}.`);
  }
  change.close("comments", "address = ? AND placement = ?", request.address, request.placement);
  return { current: null };
}

function checkReference(request: ReferenceRequest): void {
  checkAddress(request.from, "from");
  checkAddress(request.to, "to");
  checkOneOf(REFERENCE_KINDS, request.kind, "kind");
}

function referenceStep(db: DatabaseSync, change: Change, origin: Origin, request: ReferenceRequest): Step<ReferenceRow> {
  const find = () => referencesFrom(db, request.from).find((reference) => reference.to === request.to && reference.kind === request.kind);
  const existing = find();
  if (existing !== undefined) return { current: existing };
  change.insertReference({ ...request, origin });
  change.close("suppressions", "entity = 'reference' AND start_address = ? AND to_address = ? AND kind = ?", request.from, request.to, request.kind);
  return { current: find()! };
}

function unreferenceStep(db: DatabaseSync, change: Change, origin: Origin, request: ReferenceRequest): Step<null> {
  if (!referencesFrom(db, request.from).some((reference) => reference.to === request.to && reference.kind === request.kind)) {
    throw new KnowledgeError("not-found", `There is no ${request.kind} reference from ${hex(request.from)} to ${hex(request.to)}.`);
  }
  change.close('"references"', "from_address = ? AND to_address = ? AND kind = ?", request.from, request.to, request.kind);
  change.insertSuppression({ entity: "reference", start: request.from, end: request.from, to: request.to, kind: request.kind, origin: origin as SuppressionRow["origin"] });
  return { current: null };
}

type ModuleRequest = { start: number; file: string; title?: string };

function checkModule(request: ModuleRequest): void {
  checkAddress(request.start, "start");
  if (!MODULE_FILE.test(request.file)) throw new KnowledgeError("invalid-input", "A module file is a name of letters, digits, underscores or hyphens (at most 60) that ends in .asm, without a directory.");
  if (request.title !== undefined && (request.title.trim().length === 0 || request.title.length > MAX_COMMENT)) throw new KnowledgeError("invalid-input", `A module title has 1 to ${MAX_COMMENT} characters.`);
}

function moduleStep(db: DatabaseSync, change: Change, origin: Origin, request: ModuleRequest): Step<ModuleRow> {
  const title = request.title?.trim();
  const existing = moduleAt(db, request.start);
  if (existing !== undefined && existing.file === request.file && existing.title === title) return { current: existing };
  const owner = moduleWithFile(db, request.file);
  if (owner !== undefined && owner.start !== request.start) {
    throw new KnowledgeError("conflict", `The file ${request.file} already belongs to the module at ${hex(owner.start)}. Give this module another file, or remove that module first.`);
  }
  if (existing !== undefined) change.close("modules", "start_address = ?", request.start);
  change.insertModule({ start: request.start, file: request.file, ...(title === undefined ? {} : { title }), origin: origin as ModuleRow["origin"] });
  return { current: moduleAt(db, request.start)! };
}

function unmoduleStep(db: DatabaseSync, change: Change, _origin: Origin, request: { start: number }): Step<null> {
  if (moduleAt(db, request.start) === undefined) throw new KnowledgeError("not-found", `No module starts at ${hex(request.start)}.`);
  change.close("modules", "start_address = ?", request.start);
  return { current: null };
}

/** Names the symbol at an address (one current symbol per address, unique names). */
export function renameSymbol(db: DatabaseSync, context: WriteContext, request: SymbolRequest): WriteResult<SymbolRow, SymbolRow> {
  checkSymbol(request);
  return result(write(db, context, "rename-symbol", (change) => renameStep(db, change, context.origin, request)));
}

export function removeSymbol(db: DatabaseSync, context: WriteContext, request: { address: number }): WriteResult<null> {
  checkAddress(request.address);
  return result(write(db, context, "remove-symbol", (change) => removeSymbolStep(db, change, context.origin, request)));
}

/** Classifies [start, end]; overlapping regions are split so current regions never overlap. */
export function classifyRegion(db: DatabaseSync, context: WriteContext, request: RegionRequest): WriteResult<RegionRow[], RegionRow[]> {
  checkRegion(request);
  return result(write(db, context, "classify-region", (change) => classifyStep(db, change, context.origin, request)));
}

/** Makes [start, end] unclassified again; parts of regions outside it stay. */
export function unclassifyRegion(db: DatabaseSync, context: WriteContext, request: RangeRequest): WriteResult<null> {
  checkRange(request);
  return result(write(db, context, "unclassify-region", (change) => unclassifyStep(db, change, context.origin, request)));
}

export function setComment(db: DatabaseSync, context: WriteContext, request: CommentRequest): WriteResult<CommentRow> {
  checkComment(request);
  return result(write(db, context, "set-comment", (change) => commentStep(db, change, context.origin, request)));
}

export function removeComment(db: DatabaseSync, context: WriteContext, request: PlacementRequest): WriteResult<null> {
  checkPlacement(request);
  return result(write(db, context, "remove-comment", (change) => uncommentStep(db, change, context.origin, request)));
}

export function addReference(db: DatabaseSync, context: WriteContext, request: ReferenceRequest): WriteResult<ReferenceRow> {
  checkReference(request);
  return result(write(db, context, "add-reference", (change) => referenceStep(db, change, context.origin, request)));
}

export function removeReference(db: DatabaseSync, context: WriteContext, request: ReferenceRequest): WriteResult<null> {
  checkReference(request);
  return result(write(db, context, "remove-reference", (change) => unreferenceStep(db, change, context.origin, request)));
}

/** Starts a file of the generated source at an address (D48); one module per address and per file. */
export function setModule(db: DatabaseSync, context: WriteContext, request: ModuleRequest): WriteResult<ModuleRow> {
  checkModule(request);
  return result(write(db, context, "set-module", (change) => moduleStep(db, change, context.origin, request)));
}

export function removeModule(db: DatabaseSync, context: WriteContext, request: { start: number }): WriteResult<null> {
  checkAddress(request.start, "start");
  return result(write(db, context, "remove-module", (change) => unmoduleStep(db, change, context.origin, request)));
}

/** One write of a batch (D42), named as the command that does it alone. */
export type BatchOperation =
  | ({ op: "rename" } & SymbolRequest)
  | { op: "remove-symbol"; address: number }
  | ({ op: "classify" } & RegionRequest)
  | ({ op: "unclassify" } & RangeRequest)
  | ({ op: "comment" } & CommentRequest)
  | ({ op: "uncomment" } & PlacementRequest)
  | ({ op: "reference" } & ReferenceRequest)
  | ({ op: "unreference" } & ReferenceRequest)
  | ({ op: "module" } & ModuleRequest)
  | { op: "unmodule"; start: number };

export const MAX_BATCH = 10_000;

/** The result of each write of a batch, in order. */
export type BatchStep = Step<SymbolRow | RegionRow[] | CommentRow | ReferenceRow | ModuleRow | null, SymbolRow | RegionRow[]>;

/**
 * Applies many writes as one revision in one transaction (D42): all of them,
 * or none when one is refused. Every write is checked before anything opens.
 */
export function applyBatch(db: DatabaseSync, context: WriteContext, operations: BatchOperation[]): { revision: number | null; steps: BatchStep[] } {
  if (operations.length === 0 || operations.length > MAX_BATCH) throw new KnowledgeError("invalid-input", `A batch has 1 to ${MAX_BATCH} writes.`);
  operations.forEach((operation, index) => {
    try {
      switch (operation.op) {
        case "rename":
          return checkSymbol(operation);
        case "remove-symbol":
          return checkAddress(operation.address);
        case "classify":
          return checkRegion(operation);
        case "unclassify":
          return checkRange(operation);
        case "comment":
          return void checkComment(operation);
        case "uncomment":
          return checkPlacement(operation);
        case "reference":
        case "unreference":
          return checkReference(operation);
        case "module":
          return checkModule(operation);
        case "unmodule":
          return checkAddress(operation.start, "start");
        default:
          throw new KnowledgeError("invalid-input", `op must be one of rename, remove-symbol, classify, unclassify, comment, uncomment, reference, unreference, module, unmodule.`);
      }
    } catch (error) {
      if (error instanceof KnowledgeError) throw new KnowledgeError(error.code, `Write ${index + 1}: ${error.message} Nothing was written.`);
      throw error;
    }
  });
  const written = write(db, context, "apply", (change) =>
    operations.map((operation, index): BatchStep => {
      try {
        switch (operation.op) {
          case "rename":
            return renameStep(db, change, context.origin, operation);
          case "remove-symbol":
            return removeSymbolStep(db, change, context.origin, operation);
          case "classify":
            return classifyStep(db, change, context.origin, operation);
          case "unclassify":
            return unclassifyStep(db, change, context.origin, operation);
          case "comment":
            return commentStep(db, change, context.origin, operation);
          case "uncomment":
            return uncommentStep(db, change, context.origin, operation);
          case "reference":
            return referenceStep(db, change, context.origin, operation);
          case "unreference":
            return unreferenceStep(db, change, context.origin, operation);
          case "module":
            return moduleStep(db, change, context.origin, operation);
          case "unmodule":
            return unmoduleStep(db, change, context.origin, operation);
        }
      } catch (error) {
        if (error instanceof KnowledgeError) throw new KnowledgeError(error.code, `Write ${index + 1}: ${error.message} Nothing was written.`);
        throw error;
      }
    }),
  );
  return { revision: written.revision, steps: written.current };
}

/** Row content without its revision, as a comparable key. */
const KEYS = {
  symbols: { columns: SYMBOL_COLUMNS, map: toSymbol, key: (row: SymbolRow) => `${row.address}|${row.name}|${row.kind}|${row.origin}` },
  regions: { columns: REGION_COLUMNS, map: toRegion, key: (row: RegionRow) => `${row.start}|${row.end}|${row.type}|${row.element ?? ""}|${row.origin}` },
  comments: { columns: COMMENT_COLUMNS, map: toComment, key: (row: CommentRow) => `${row.address}|${row.placement}|${row.text}|${row.origin}` },
  references: { columns: REFERENCE_COLUMNS, map: toReference, key: (row: ReferenceRow) => `${row.from}|${row.to}|${row.kind}|${row.origin}` },
  modules: { columns: MODULE_COLUMNS, map: toModule, key: (row: ModuleRow) => `${row.start}|${row.file}|${row.title ?? ""}|${row.origin}` },
  suppressions: {
    columns: SUPPRESSION_COLUMNS,
    map: toSuppression,
    key: (row: SuppressionRow) => `${row.entity}|${row.start}|${row.end}|${row.to ?? ""}|${row.kind ?? ""}|${row.origin}`,
  },
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
        if (table === "suppressions") {
          change.insertSuppression(spec.map(row as never) as SuppressionRow);
          continue;
        }
        if (table === "modules") {
          change.insertModule(spec.map(row as never) as ModuleRow);
          continue;
        }
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
