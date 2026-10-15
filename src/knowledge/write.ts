// Semantic knowledge writes. Every accepted change is one
// revision in one transaction: superseded rows are closed, never deleted.

import type { DatabaseSync } from "node:sqlite";

import { instructionLength, SYMBOL_NAME } from "../c64.ts";
import { isoCet } from "../time.ts";
import { KnowledgeError, transaction } from "./database.ts";
import { checkExpression, evaluate, ExpressionError, identifiers, operandText, replaceIdentifiers } from "./expression.ts";
import {
  COMMENT_COLUMNS,
  commentsAt,
  currentRevision,
  listOperands,
  MODULE_COLUMNS,
  moduleAt,
  moduleWithFile,
  OPERAND_COLUMNS,
  operandAt,
  REFERENCE_COLUMNS,
  referencesFrom,
  REGION_COLUMNS,
  regionsOverlapping,
  resolveRevision,
  SUPPRESSION_COLUMNS,
  suppressionsOverlapping,
  SYMBOL_COLUMNS,
  symbolAt,
  symbolNamed,
  toComment,
  toModule,
  toOperand,
  toReference,
  toRegion,
  toSuppression,
  toSymbol,
  type CommentRow,
  type ModuleRow,
  type OperandRow,
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
  DEFAULT_SPACE,
  GENERATED_FILES,
  isGeneratedFile,
  SPACE,
  NO_ELEMENT_TYPES,
  OPERAND_SELECTS,
  POINTER_KIND,
  REFERENCE_KINDS,
  REGION_TYPES,
  SYMBOL_KINDS,
  type CommentPlacement,
  type EvidenceKind,
  type OperandSelect,
  type Origin,
  type ReferenceKind,
  type RegionType,
  type Space,
  type SymbolKind,
} from "./schema.ts";
import { newRevisionId, rowId } from "./text.ts";

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
  expectedRevision?: string;
  /** Kept with the revision when the write changes something. */
  evidence?: Evidence[];
  /** The image that an operand write is checked against (D65). */
  image?: OperandImage;
}

/** The bytes of the image and the platform names (C64 space only) that operand expressions are checked against. */
export interface OperandImage {
  byteAt(address: number): number | undefined;
  platform: ReadonlyMap<string, number>;
}

/** The revision a write created, or null when nothing needed to change. */
export interface WriteResult<T, P = never> {
  revision: string | null;
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
  expectedRevision?: string;
  inputHash?: string;
  toolVersion?: string;
  evidence?: Evidence[];
}

/**
 * One write: refuses a stale expected revision, then creates the revision row
 * only when the first actual change happens, so a no-op leaves no revision.
 */
export class Change {
  revision: string | null = null;
  /** The rows this write inserted, for their ids. */
  #rows = 0;
  readonly #db: DatabaseSync;
  readonly #context: ChangeContext;
  readonly #operation: string;

  constructor(db: DatabaseSync, context: ChangeContext, operation: string) {
    this.#db = db;
    this.#context = context;
    this.#operation = operation;
    const current = currentRevision(db);
    if (context.expectedRevision !== undefined && resolveRevision(db, context.expectedRevision) !== current) {
      throw new KnowledgeError(
        "stale-revision",
        `Knowledge changed since revision ${context.expectedRevision}; it is now at revision ${current}. Read it again and decide again.`,
      );
    }
  }

  /** The id of this write's revision, created on first use with its evidence (D69: an id that sorts after every revision). */
  id(): string {
    if (this.revision !== null) return this.revision;
    const now = new Date();
    const id = newRevisionId(currentRevision(this.#db), now);
    this.#db
      .prepare("INSERT INTO revisions (id, created_at, origin, operation, input_hash, tool_version, description) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, isoCet(now), this.#context.origin, this.#operation, this.#context.inputHash ?? null, this.#context.toolVersion ?? null, this.#context.description ?? null);
    this.revision = id;
    const evidence = this.#db.prepare("INSERT INTO evidence (revision, kind, ref, sha256) VALUES (?, ?, ?, ?)");
    for (const item of this.#context.evidence ?? []) evidence.run(id, item.kind, item.ref, item.sha256 ?? null);
    return id;
  }

  /** The id of the next row this write inserts. */
  #rowId(): string {
    return rowId(this.id(), ++this.#rows);
  }

  /** Closes the current rows of `table` that `where` selects. */
  close(table: string, where: string, ...values: Array<number | string>): void {
    this.#db.prepare(`UPDATE ${table} SET valid_to_revision = ? WHERE valid_to_revision IS NULL AND ${where}`).run(this.id(), ...values);
  }

  insertSymbol(row: Omit<SymbolRow, "revision">): void {
    this.#db.prepare("INSERT INTO symbols (id, space, address, name, kind, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?)").run(this.#rowId(), row.space, row.address, row.name, row.kind, row.origin, this.id());
  }

  insertRegion(row: Omit<RegionRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO regions (id, space, start_address, end_address, type, element, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.start, row.end, row.type, row.element ?? null, row.origin, this.id());
  }

  insertComment(row: Omit<CommentRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO comments (id, space, address, placement, text, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.address, row.placement, row.text, row.origin, this.id());
  }

  insertReference(row: Omit<ReferenceRow, "revision">): void {
    this.#db
      .prepare('INSERT INTO "references" (id, space, from_address, to_address, kind, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(this.#rowId(), row.space, row.from, row.to, row.kind, row.origin, this.id());
  }

  insertModule(row: Omit<ModuleRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO modules (id, space, start_address, file, title, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.start, row.file, row.title ?? null, row.origin, this.id());
  }

  insertOperand(row: Omit<OperandRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO operands (id, space, address, selector, symbol, offset, expression, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.address, row.select, row.symbol ?? null, row.offset, row.expression ?? null, row.origin, this.id());
  }

  insertSuppression(row: Omit<SuppressionRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO suppressions (id, space, entity, start_address, end_address, to_address, kind, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.entity, row.start, row.end, row.to ?? null, row.kind ?? null, row.origin, this.id());
  }
}

/** Closes the current region suppressions over [start, end] and keeps their parts outside it: a user/LLM region there decides now. */
function liftRegionSuppressions(db: DatabaseSync, change: Change, start: number, end: number, space: Space): void {
  const overlapping = suppressionsOverlapping(db, "region", start, end, space);
  if (overlapping.length === 0) return;
  change.close("suppressions", "space = ? AND entity = 'region' AND start_address <= ? AND end_address >= ?", space, end, start);
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
function write<T>(db: DatabaseSync, context: WriteContext, operation: string, work: (change: Change) => T): { revision: string | null; current: T } {
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

const result = <T, P>(written: { revision: string | null; current: Step<T, P> }): WriteResult<T, P> =>
  written.current.previous === undefined ? { revision: written.revision, current: written.current.current } : { revision: written.revision, current: written.current.current, previous: written.current.previous };

// Each write has a check, which refuses bad input before anything opens, and a
// step, which runs inside a change. A single write and a batch share both (D42).

/** Every request names its space (D53); without one it is the C64. */
type InSpace = { space?: Space };
type SymbolRequest = InSpace & { address: number; name: string; kind?: SymbolKind };
type RegionRequest = InSpace & { start: number; end: number; type: RegionType; element?: number };
type RangeRequest = InSpace & { start: number; end: number };
type CommentRequest = InSpace & { address: number; placement: CommentPlacement; text: string };
type PlacementRequest = InSpace & { address: number; placement: CommentPlacement };
type ReferenceRequest = InSpace & { from: number; to: number; kind: ReferenceKind };
type AddressRequest = InSpace & { address: number };

const spaceOf = (request: InSpace): Space => request.space ?? DEFAULT_SPACE;

export function checkSpace(request: InSpace): void {
  if (request.space !== undefined && !SPACE.test(request.space)) throw new KnowledgeError("invalid-input", "space must be c64, drive8, or bank0 to bank255.");
}

function checkSymbol(request: SymbolRequest): void {
  checkSpace(request);
  checkAddress(request.address);
  if (!SYMBOL_NAME.test(request.name)) {
    throw new KnowledgeError("invalid-input", "A symbol name is a letter or underscore, then letters, digits or underscores (at most 64), with an optional leading dot.");
  }
  if (request.kind !== undefined) checkOneOf(SYMBOL_KINDS, request.kind, "kind");
}

function renameStep(db: DatabaseSync, change: Change, origin: Origin, request: SymbolRequest): Step<SymbolRow, SymbolRow> {
  const space = spaceOf(request);
  const existing = symbolAt(db, request.address, space);
  const kind = request.kind ?? existing?.kind ?? "label";
  if (existing !== undefined && existing.name === request.name && existing.kind === kind) return { current: existing };
  const owner = symbolNamed(db, request.name, space);
  if (owner !== undefined && owner.address !== request.address) {
    throw new KnowledgeError("conflict", `The name ${request.name} already belongs to ${hex(owner.address)}. Rename or remove that symbol first.`);
  }
  if (existing !== undefined) change.close("symbols", "space = ? AND address = ?", space, request.address);
  change.insertSymbol({ space, address: request.address, name: request.name, kind, origin });
  if (existing !== undefined && existing.name !== request.name) renameInOperands(db, change, space, existing.name, request.name);
  change.close("suppressions", "space = ? AND entity = 'symbol' AND start_address = ?", space, request.address);
  const current = symbolAt(db, request.address, space)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function removeSymbolStep(db: DatabaseSync, change: Change, origin: Origin, request: AddressRequest): Step<null> {
  const space = spaceOf(request);
  const existing = symbolAt(db, request.address, space);
  if (existing === undefined) throw new KnowledgeError("not-found", `There is no symbol at ${hex(request.address)}.`);
  const users = operandsNaming(db, space, existing.name);
  if (users.length > 0) {
    throw new KnowledgeError(
      "conflict",
      `The operand expressions at ${users.map((row) => hex(row.address)).join(", ")} use ${existing.name}. Change or remove them first (unoperand), or rename the symbol.`,
    );
  }
  change.close("symbols", "space = ? AND address = ?", space, request.address);
  change.insertSuppression({ space, entity: "symbol", start: request.address, end: request.address, origin: origin as SuppressionRow["origin"] });
  return { current: null };
}

function checkRange(request: RangeRequest): void {
  checkSpace(request);
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
export function clearRange(db: DatabaseSync, change: Change, start: number, end: number, space: Space = DEFAULT_SPACE): void {
  const overlapping = regionsOverlapping(db, start, end, space);
  if (overlapping.length === 0) return;
  change.close("regions", "space = ? AND start_address <= ? AND end_address >= ?", space, end, start);
  for (const region of overlapping) {
    const left = { start: region.start, end: start - 1 };
    const right = { start: end + 1, end: region.end };
    if (region.start < start) change.insertRegion({ space, ...left, type: region.type, ...elementOf(left, region.element), origin: region.origin });
    if (region.end > end) change.insertRegion({ space, ...right, type: region.type, ...elementOf(right, region.element), origin: region.origin });
  }
}

function classifyStep(db: DatabaseSync, change: Change, origin: Origin, request: RegionRequest): Step<RegionRow[], RegionRow[]> {
  const space = spaceOf(request);
  const overlapping = regionsOverlapping(db, request.start, request.end, space);
  const [only] = overlapping;
  const same = overlapping.length === 1 && only!.start === request.start && only!.end === request.end && only!.type === request.type && only!.element === request.element;
  if (same) return { current: overlapping };
  clearRange(db, change, request.start, request.end, space);
  change.insertRegion({ space, start: request.start, end: request.end, type: request.type, ...(request.element === undefined ? {} : { element: request.element }), origin });
  liftRegionSuppressions(db, change, request.start, request.end, space);
  const previous = overlapping.filter((row) => row.origin !== origin);
  const current = regionsOverlapping(db, request.start, request.end, space);
  return previous.length === 0 ? { current } : { current, previous };
}

function unclassifyStep(db: DatabaseSync, change: Change, origin: Origin, request: RangeRequest): Step<null> {
  const space = spaceOf(request);
  if (regionsOverlapping(db, request.start, request.end, space).length === 0) {
    throw new KnowledgeError("not-found", `No region covers ${hex(request.start)}-${hex(request.end)}.`);
  }
  clearRange(db, change, request.start, request.end, space);
  // Suppress only the parts that no region suppression holds yet, so suppressions never overlap.
  for (const piece of subtract({ start: request.start, end: request.end }, suppressionsOverlapping(db, "region", request.start, request.end, space))) {
    change.insertSuppression({ space, entity: "region", ...piece, origin: origin as SuppressionRow["origin"] });
  }
  return { current: null };
}

function checkComment(request: CommentRequest): string {
  checkSpace(request);
  checkAddress(request.address);
  checkOneOf(COMMENT_PLACEMENTS, request.placement, "placement");
  const text = request.text.trim();
  if (text.length === 0 || text.length > MAX_COMMENT) throw new KnowledgeError("invalid-input", `A comment has 1 to ${MAX_COMMENT} characters.`);
  return text;
}

function commentStep(db: DatabaseSync, change: Change, origin: Origin, request: CommentRequest): Step<CommentRow> {
  const space = spaceOf(request);
  const text = request.text.trim();
  const existing = commentsAt(db, request.address, space).find((comment) => comment.placement === request.placement);
  if (existing?.text === text) return { current: existing };
  if (existing !== undefined) change.close("comments", "space = ? AND address = ? AND placement = ?", space, request.address, request.placement);
  change.insertComment({ space, address: request.address, placement: request.placement, text, origin });
  return { current: commentsAt(db, request.address, space).find((comment) => comment.placement === request.placement)! };
}

function checkPlacement(request: PlacementRequest): void {
  checkSpace(request);
  checkAddress(request.address);
  checkOneOf(COMMENT_PLACEMENTS, request.placement, "placement");
}

function uncommentStep(db: DatabaseSync, change: Change, _origin: Origin, request: PlacementRequest): Step<null> {
  const space = spaceOf(request);
  if (!commentsAt(db, request.address, space).some((comment) => comment.placement === request.placement)) {
    throw new KnowledgeError("not-found", `There is no ${request.placement} comment at ${hex(request.address)}.`);
  }
  change.close("comments", "space = ? AND address = ? AND placement = ?", space, request.address, request.placement);
  return { current: null };
}

function checkReference(request: ReferenceRequest): void {
  checkSpace(request);
  checkAddress(request.from, "from");
  checkAddress(request.to, "to");
  checkOneOf(REFERENCE_KINDS, request.kind, "kind");
  if (request.kind === POINTER_KIND) throw new KnowledgeError("invalid-input", "Only an operand expression writes a pointer reference (D65): use operand and unoperand.");
}

function referenceStep(db: DatabaseSync, change: Change, origin: Origin, request: ReferenceRequest): Step<ReferenceRow> {
  const space = spaceOf(request);
  const find = () => referencesFrom(db, request.from, space).find((reference) => reference.to === request.to && reference.kind === request.kind);
  const existing = find();
  if (existing !== undefined) return { current: existing };
  change.insertReference({ space, from: request.from, to: request.to, kind: request.kind, origin });
  change.close("suppressions", "space = ? AND entity = 'reference' AND start_address = ? AND to_address = ? AND kind = ?", space, request.from, request.to, request.kind);
  return { current: find()! };
}

function unreferenceStep(db: DatabaseSync, change: Change, origin: Origin, request: ReferenceRequest): Step<null> {
  const space = spaceOf(request);
  if (!referencesFrom(db, request.from, space).some((reference) => reference.to === request.to && reference.kind === request.kind)) {
    throw new KnowledgeError("not-found", `There is no ${request.kind} reference from ${hex(request.from)} to ${hex(request.to)}.`);
  }
  change.close('"references"', "space = ? AND from_address = ? AND to_address = ? AND kind = ?", space, request.from, request.to, request.kind);
  change.insertSuppression({ space, entity: "reference", start: request.from, end: request.from, to: request.to, kind: request.kind, origin: origin as SuppressionRow["origin"] });
  return { current: null };
}

type OperandRequest = InSpace & { address: number; select: OperandSelect; symbol?: string; offset?: number; expression?: string };

/** Current operand expressions that use a name, as a symbol or inside expression text. */
function operandsNaming(db: DatabaseSync, space: Space, name: string): OperandRow[] {
  return listOperands(db, undefined, undefined, space).filter((row) => row.symbol === name || (row.expression !== undefined && identifiers(row.expression).includes(name)));
}

/** A rename of a symbol renames it in every operand expression that uses it; the rows keep their origin. */
function renameInOperands(db: DatabaseSync, change: Change, space: Space, from: string, to: string): void {
  for (const row of operandsNaming(db, space, from)) {
    change.close("operands", "space = ? AND address = ?", space, row.address);
    const renamed: Omit<OperandRow, "revision"> = { ...row };
    if (row.symbol === from) renamed.symbol = to;
    if (row.expression !== undefined) renamed.expression = replaceIdentifiers(row.expression, (name) => (name === from ? to : name));
    change.insertOperand(renamed);
  }
}

function checkOperand(request: OperandRequest): void {
  checkSpace(request);
  checkAddress(request.address);
  checkOneOf(OPERAND_SELECTS, request.select, "select");
  if (request.select === "expr") {
    if (request.symbol !== undefined || request.offset !== undefined) throw new KnowledgeError("invalid-input", "An expr operand has expression text, and no symbol or offset.");
    if (typeof request.expression !== "string") throw new KnowledgeError("invalid-input", "An expr operand has expression text.");
    try {
      checkExpression(request.expression);
    } catch (error) {
      if (error instanceof ExpressionError) throw new KnowledgeError("invalid-input", error.message);
      throw error;
    }
    return;
  }
  if (request.expression !== undefined) throw new KnowledgeError("invalid-input", `A ${request.select} operand has a symbol and an optional offset, and no expression text.`);
  if (request.symbol === undefined || !SYMBOL_NAME.test(request.symbol)) throw new KnowledgeError("invalid-input", `A ${request.select} operand names a symbol: a letter or underscore, then letters, digits or underscores.`);
  if (request.offset !== undefined && (!Number.isInteger(request.offset) || Math.abs(request.offset) > 0xffff)) throw new KnowledgeError("invalid-input", "offset must be a whole number from -$ffff to $ffff.");
}

const shown = (value: number, size: number) => (value < 0 ? String(value) : `$${value.toString(16).padStart(size === 0x100 ? 2 : 4, "0")}`);

/**
 * Refuses an expression whose value is not the operand in the image (D65), and
 * returns the addresses of its names. Symbols of the knowledge come first, then
 * the platform names of the C64 space.
 */
function checkOperandValue(db: DatabaseSync, space: Space, image: OperandImage, request: OperandRequest, text: string): number[] {
  const where = hex(request.address);
  const opcode = image.byteAt(request.address);
  if (opcode === undefined) throw new KnowledgeError("invalid-input", `${where} is outside the image.`);
  const length = instructionLength(opcode);
  if (length === 1) throw new KnowledgeError("invalid-input", `The instruction at ${where} (opcode ${shown(opcode, 0x100)}) has no operand.`);
  if ((opcode & 0x1f) === 0x10) throw new KnowledgeError("invalid-input", `The instruction at ${where} is a branch: its operand is a distance, not a value.`);
  if ((request.select === "lo" || request.select === "hi") && length === 3) {
    throw new KnowledgeError("invalid-input", `lo and hi give one byte, but the instruction at ${where} has a 2-byte operand. Use value.`);
  }
  const bytes = [image.byteAt(request.address + 1), length === 3 ? image.byteAt(request.address + 2) : 0];
  if (bytes.some((byte) => byte === undefined)) throw new KnowledgeError("invalid-input", `The instruction at ${where} runs past the end of the image.`);
  const operand = bytes[0]! | (bytes[1]! << 8);
  const resolve = (name: string) => symbolNamed(db, name, space)?.address ?? (space === DEFAULT_SPACE ? image.platform.get(name) : undefined);
  let value: number;
  try {
    value = evaluate(text, resolve);
  } catch (error) {
    if (error instanceof ExpressionError) throw new KnowledgeError("invalid-input", `${where}: ${error.message}`);
    throw error;
  }
  const size = length === 2 ? 0x100 : 0x10000;
  if (value < -size / 2 || value >= size || ((value % size) + size) % size !== operand) {
    throw new KnowledgeError("invalid-input", `At ${where}, ${text} gives ${shown(value, size)}, but the operand in the image is ${shown(operand, size)}.`);
  }
  return identifiers(text).map((name) => resolve(name)!);
}

function operandStep(db: DatabaseSync, change: Change, context: ChangeContext & { image?: OperandImage }, request: OperandRequest): Step<OperandRow, OperandRow> {
  const space = spaceOf(request);
  if (context.image === undefined) throw new KnowledgeError("invalid-input", "An operand expression is checked against the image, and no image was given.");
  const wanted: Omit<OperandRow, "space" | "address" | "origin" | "revision"> = { select: request.select, offset: request.offset ?? 0 };
  if (request.symbol !== undefined) wanted.symbol = request.symbol;
  if (request.expression !== undefined) wanted.expression = request.expression.trim();
  const targets = new Set(checkOperandValue(db, space, context.image, request, operandText(wanted)));
  const existing = operandAt(db, request.address, space);
  if (existing !== undefined && existing.select === wanted.select && existing.symbol === wanted.symbol && existing.offset === wanted.offset && existing.expression === wanted.expression) {
    return { current: existing };
  }
  const origin = context.origin as OperandRow["origin"];
  if (existing !== undefined) change.close("operands", "space = ? AND address = ?", space, request.address);
  change.insertOperand({ space, address: request.address, ...wanted, origin });
  const pointers = referencesFrom(db, request.address, space).filter((reference) => reference.kind === POINTER_KIND);
  for (const reference of pointers) {
    if (!targets.has(reference.to)) change.close('"references"', "space = ? AND from_address = ? AND to_address = ? AND kind = ?", space, request.address, reference.to, POINTER_KIND);
  }
  for (const to of targets) {
    if (!pointers.some((reference) => reference.to === to)) change.insertReference({ space, from: request.address, to, kind: POINTER_KIND, origin });
  }
  const current = operandAt(db, request.address, space)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unoperandStep(db: DatabaseSync, change: Change, _origin: Origin, request: AddressRequest): Step<null> {
  const space = spaceOf(request);
  if (operandAt(db, request.address, space) === undefined) throw new KnowledgeError("not-found", `There is no operand expression at ${hex(request.address)}.`);
  change.close("operands", "space = ? AND address = ?", space, request.address);
  change.close('"references"', "space = ? AND from_address = ? AND kind = ?", space, request.address, POINTER_KIND);
  return { current: null };
}

type ModuleRequest = InSpace & { start: number; file: string; title?: string };

function checkModule(request: ModuleRequest): void {
  checkSpace(request);
  checkAddress(request.start, "start");
  if (!MODULE_FILE.test(request.file)) throw new KnowledgeError("invalid-input", "A module file is a name of letters, digits, underscores or hyphens (at most 60) that ends in .asm, without a directory.");
  if (isGeneratedFile(request.file)) {
    throw new KnowledgeError("invalid-input", `c64-source writes ${GENERATED_FILES.join(", ")} itself, in any letter case, so a module cannot have the file ${request.file}. Give the module another file.`);
  }
  if (request.title !== undefined && (request.title.trim().length === 0 || request.title.length > MAX_COMMENT)) throw new KnowledgeError("invalid-input", `A module title has 1 to ${MAX_COMMENT} characters.`);
}

function moduleStep(db: DatabaseSync, change: Change, origin: Origin, request: ModuleRequest): Step<ModuleRow> {
  const space = spaceOf(request);
  const existing = moduleAt(db, request.start, space);
  // A module write without a title keeps the title it has (F-26).
  const title = request.title === undefined ? existing?.title : request.title.trim();
  if (existing !== undefined && existing.file === request.file && existing.title === title) return { current: existing };
  const owner = moduleWithFile(db, request.file, space);
  if (owner !== undefined && owner.start !== request.start) {
    throw new KnowledgeError("conflict", `The file ${request.file} already belongs to the module at ${hex(owner.start)}. Give this module another file, or remove that module first.`);
  }
  if (existing !== undefined) change.close("modules", "space = ? AND start_address = ?", space, request.start);
  change.insertModule({ space, start: request.start, file: request.file, ...(title === undefined ? {} : { title }), origin: origin as ModuleRow["origin"] });
  return { current: moduleAt(db, request.start, space)! };
}

function unmoduleStep(db: DatabaseSync, change: Change, _origin: Origin, request: InSpace & { start: number }): Step<null> {
  const space = spaceOf(request);
  if (moduleAt(db, request.start, space) === undefined) throw new KnowledgeError("not-found", `No module starts at ${hex(request.start)}.`);
  change.close("modules", "space = ? AND start_address = ?", space, request.start);
  return { current: null };
}

/** Names the symbol at an address (one current symbol per address, unique names). */
export function renameSymbol(db: DatabaseSync, context: WriteContext, request: SymbolRequest): WriteResult<SymbolRow, SymbolRow> {
  checkSymbol(request);
  return result(write(db, context, "rename-symbol", (change) => renameStep(db, change, context.origin, request)));
}

export function removeSymbol(db: DatabaseSync, context: WriteContext, request: AddressRequest): WriteResult<null> {
  checkSpace(request);
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

export function removeModule(db: DatabaseSync, context: WriteContext, request: InSpace & { start: number }): WriteResult<null> {
  checkSpace(request);
  checkAddress(request.start, "start");
  return result(write(db, context, "remove-module", (change) => unmoduleStep(db, change, context.origin, request)));
}

/**
 * Writes the operand expression of the instruction at an address (D65), after
 * a check against the image, and a pointer reference to each name it uses.
 */
export function setOperand(db: DatabaseSync, context: WriteContext, request: OperandRequest): WriteResult<OperandRow, OperandRow> {
  checkOperand(request);
  return result(write(db, context, "set-operand", (change) => operandStep(db, change, context, request)));
}

export function removeOperand(db: DatabaseSync, context: WriteContext, request: AddressRequest): WriteResult<null> {
  checkSpace(request);
  checkAddress(request.address);
  return result(write(db, context, "remove-operand", (change) => unoperandStep(db, change, context.origin, request)));
}

/** One write of a batch (D42), named as the command that does it alone. */
export type BatchOperation =
  | ({ op: "rename" } & SymbolRequest)
  | ({ op: "remove-symbol" } & AddressRequest)
  | ({ op: "classify" } & RegionRequest)
  | ({ op: "unclassify" } & RangeRequest)
  | ({ op: "comment" } & CommentRequest)
  | ({ op: "uncomment" } & PlacementRequest)
  | ({ op: "reference" } & ReferenceRequest)
  | ({ op: "unreference" } & ReferenceRequest)
  | ({ op: "module" } & ModuleRequest)
  | ({ op: "unmodule" } & InSpace & { start: number })
  | ({ op: "operand" } & OperandRequest)
  | ({ op: "unoperand" } & AddressRequest);

export const MAX_BATCH = 10_000;

/** The result of each write of a batch, in order. */
export type BatchStep = Step<SymbolRow | RegionRow[] | CommentRow | ReferenceRow | ModuleRow | OperandRow | null, SymbolRow | RegionRow[] | OperandRow>;

/**
 * Applies many writes as one revision in one transaction (D42): all of them,
 * or none when one is refused. Every write is checked before anything opens.
 */
export function applyBatch(db: DatabaseSync, context: WriteContext, operations: BatchOperation[]): { revision: string | null; steps: BatchStep[] } {
  if (operations.length === 0 || operations.length > MAX_BATCH) throw new KnowledgeError("invalid-input", `A batch has 1 to ${MAX_BATCH} writes.`);
  operations.forEach((operation, index) => {
    try {
      switch (operation.op) {
        case "rename":
          return checkSymbol(operation);
        case "remove-symbol":
          checkSpace(operation);
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
          checkSpace(operation);
          return checkAddress(operation.start, "start");
        case "operand":
          return checkOperand(operation);
        case "unoperand":
          checkSpace(operation);
          return checkAddress(operation.address);
        default:
          throw new KnowledgeError("invalid-input", `op must be one of rename, remove-symbol, classify, unclassify, comment, uncomment, reference, unreference, module, unmodule, operand, unoperand.`);
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
          case "operand":
            return operandStep(db, change, context, operation);
          case "unoperand":
            return unoperandStep(db, change, context.origin, operation);
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
  symbols: { columns: SYMBOL_COLUMNS, map: toSymbol, key: (row: SymbolRow) => `${row.space}|${row.address}|${row.name}|${row.kind}|${row.origin}` },
  regions: { columns: REGION_COLUMNS, map: toRegion, key: (row: RegionRow) => `${row.space}|${row.start}|${row.end}|${row.type}|${row.element ?? ""}|${row.origin}` },
  comments: { columns: COMMENT_COLUMNS, map: toComment, key: (row: CommentRow) => `${row.space}|${row.address}|${row.placement}|${row.text}|${row.origin}` },
  references: { columns: REFERENCE_COLUMNS, map: toReference, key: (row: ReferenceRow) => `${row.space}|${row.from}|${row.to}|${row.kind}|${row.origin}` },
  modules: { columns: MODULE_COLUMNS, map: toModule, key: (row: ModuleRow) => `${row.space}|${row.start}|${row.file}|${row.title ?? ""}|${row.origin}` },
  operands: {
    columns: OPERAND_COLUMNS,
    map: toOperand,
    key: (row: OperandRow) => `${row.space}|${row.address}|${row.select}|${row.symbol ?? ""}|${row.offset}|${row.expression ?? ""}|${row.origin}`,
  },
  suppressions: {
    columns: SUPPRESSION_COLUMNS,
    map: toSuppression,
    key: (row: SuppressionRow) => `${row.space}|${row.entity}|${row.start}|${row.end}|${row.to ?? ""}|${row.kind ?? ""}|${row.origin}`,
  },
} as const;

/**
 * Makes the current knowledge equal to what it was at `revision`, as a new
 * revision. History is never erased; restored rows keep their origin.
 */
export function revert(db: DatabaseSync, context: WriteContext, request: { revision: string }): WriteResult<{ restoredRevision: string }> {
  return write(db, context, "revert", (change) => {
    const restored = resolveRevision(db, request.revision);
    const at = "valid_from_revision <= ? AND (valid_to_revision IS NULL OR valid_to_revision > ?)";
    for (const [table, spec] of Object.entries(KEYS)) {
      const name = table === "references" ? '"references"' : table;
      const then = db.prepare(`SELECT ${spec.columns}, id FROM ${name} WHERE ${at}`).all(restored, restored) as Array<Record<string, unknown>>;
      const now = db.prepare(`SELECT ${spec.columns}, id FROM ${name} WHERE valid_to_revision IS NULL`).all() as Array<Record<string, unknown>>;
      const key = (row: Record<string, unknown>) => (spec.key as (row: unknown) => string)(spec.map(row as never));
      const thenKeys = new Set(then.map(key));
      const nowKeys = new Set(now.map(key));
      // Close first, so restored rows never collide with the current-row rules.
      for (const row of now) if (!thenKeys.has(key(row))) change.close(name, "id = ?", row.id as string);
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
        if (table === "operands") {
          change.insertOperand(spec.map(row as never) as OperandRow);
          continue;
        }
        const mapped = spec.map(row as never) as SymbolRow & RegionRow & CommentRow & ReferenceRow;
        if (table === "symbols") change.insertSymbol(mapped);
        else if (table === "regions") change.insertRegion(mapped);
        else if (table === "comments") change.insertComment(mapped);
        else change.insertReference(mapped);
      }
    }
    return { restoredRevision: restored };
  });
}
