// Semantic knowledge writes. Every accepted change is one
// revision in one transaction: superseded rows are closed, never deleted.

import type { DatabaseSync } from "node:sqlite";

import { instructionLength, SYMBOL_NAME } from "../c64.ts";
import { isoCet } from "../time.ts";
import { CONFLICT_RULES, conflicts, conflictTable, type Conflict, type ConflictRow } from "./conflicts.ts";
import { KnowledgeError, transaction } from "./database.ts";
import { checkExpression, evaluate, ExpressionError, identifiers, operandText, replaceIdentifiers } from "./expression.ts";
import {
  COMMENT_COLUMNS,
  commentsAt,
  currentRevision,
  listMacroUses,
  listOperands,
  listPatches,
  listText,
  MACRO_COLUMNS,
  MACRO_USE_COLUMNS,
  macroNamed,
  macroUsesOverlapping,
  MODULE_COLUMNS,
  moduleAt,
  moduleWithFile,
  OPERAND_COLUMNS,
  operandAt,
  PATCH_COLUMNS,
  patchesOverlapping,
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
import {
  COMMENT_PLACEMENTS,
  EVIDENCE_KINDS,
  MAX_ELEMENT,
  MODULE_FILE,
  DEFAULT_SPACE,
  GENERATED_FILES,
  isGeneratedFile,
  MACRO_NAME,
  MACRO_PARAM,
  SPACE,
  SWITCH_NAME,
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
import { newRevisionId, rowId, sqlName } from "./text.ts";

/** What a change rests on (D42): a coverage run, a test or another project file with its SHA-256, or a note. */
export interface Evidence {
  kind: EvidenceKind;
  ref: string;
  sha256?: string;
  /** The space that a coverage map was imported into (D86). */
  space?: Space;
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
  /** The image that an operand, patch or macro use write is checked against (D65, D72, D73). */
  image?: OperandImage;
}

/** The bytes of the image and the platform names (C64 space only) that operand expressions, patches and macro uses are checked against. */
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
/** The most characters of patch code and of a macro body. */
const MAX_CODE = 8000;
/** The most parameters of a macro. */
const MAX_PARAMS = 16;
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
    // A merge of two computers' work can leave conflicts: only a merge revision writes then (D69).
    const found = operation === "merge" ? [] : conflicts(db);
    if (found.length > 0) {
      throw new KnowledgeError(
        "conflict",
        `The knowledge has ${found.length} conflict${found.length === 1 ? "" : "s"} from a git merge, for example ${describe(found[0]!)}. Nothing was written. Run knowledge.ts merge to decide them, then write again.`,
      );
    }
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
    const evidence = this.#db.prepare("INSERT INTO evidence (revision, kind, ref, sha256, space) VALUES (?, ?, ?, ?, ?)");
    for (const item of this.#context.evidence ?? []) evidence.run(id, item.kind, item.ref, item.sha256 ?? null, item.space ?? null);
    return id;
  }

  /**
   * Refuses a write that leaves two current rows where one is allowed: the
   * index has no unique indexes, because a merged text can hold such rows.
   */
  check(): void {
    if (this.revision === null) return;
    const [found] = conflicts(this.#db);
    if (found !== undefined) throw new KnowledgeError("conflict", `The write would leave ${describe(found)}. Nothing was written.`);
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

  /** A second name of an address from an analyzer (D74). */
  insertAnalyzerName(row: Omit<SymbolRow, "revision">): void {
    this.#db.prepare("INSERT INTO analyzer_names (id, space, address, name, kind, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?)").run(this.#rowId(), row.space, row.address, row.name, row.kind, row.origin, this.id());
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

  insertPatch(row: Omit<PatchRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO patches (id, space, start_address, end_address, switch_name, code, comment, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.start, row.end, row.switch, row.code, row.comment ?? null, row.origin, this.id());
  }

  insertMacro(row: Omit<MacroRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO macros (id, space, name, params, body, comment, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.name, listText(row.params), row.body, row.comment ?? null, row.origin, this.id());
  }

  insertMacroUse(row: Omit<MacroUseRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO macro_uses (id, space, start_address, end_address, macro, args, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.start, row.end, row.macro, listText(row.args), row.origin, this.id());
  }

  insertSuppression(row: Omit<SuppressionRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO suppressions (id, space, entity, start_address, end_address, to_address, kind, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.entity, row.start, row.end, row.to ?? null, row.kind ?? null, row.origin, this.id());
  }

  /** Bytes of the program (D83), as hex digits. */
  insertMemory(row: { space: Space; address: number; bytes: string; origin: Origin }): void {
    this.#db.prepare("INSERT INTO memory (id, space, address, bytes, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?)").run(this.#rowId(), row.space, row.address, row.bytes, row.origin, this.id());
  }

  /** The entry of the program, with the machine state and the unpacker stages as JSON text when it has them (D83). */
  insertEntry(row: { space: Space; address: number; state: string | null; stages: string | null; origin: Origin }): void {
    this.#db
      .prepare("INSERT INTO entries (id, space, address, state, stages, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.address, row.state, row.stages, row.origin, this.id());
  }

  /** One coverage range of one kind (D83). */
  insertCoverage(row: { space: Space; kind: string; start: number; end: number; origin: Origin }): void {
    this.#db
      .prepare("INSERT INTO coverage (id, space, kind, start_address, end_address, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.kind, row.start, row.end, row.origin, this.id());
  }
}

/** A conflict in words: its rule, its space and the addresses of its rows. */
function describe(conflict: Conflict): string {
  const place = (entry: ConflictRow) => {
    if (entry.entity === "macro") return entry.row.name;
    const row = entry.row as { address?: number; start?: number; end?: number; from?: number };
    if (row.address !== undefined) return hex(row.address);
    if (row.from !== undefined && entry.entity === "reference") return hex(row.from);
    return row.end === undefined || row.end === row.start ? hex(row.start!) : `${hex(row.start!)}-${hex(row.end)}`;
  };
  return `${CONFLICT_RULES[conflict.rule]} in ${conflict.space} (${[...new Set(conflict.rows.map(place))].join(", ")})`;
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
    checkSpace(item);
  }
}

/** Runs semantic writes in one transaction, as one revision. */
export function write<T>(db: DatabaseSync, context: WriteContext, operation: string, work: (change: Change) => T): { revision: string | null; current: T } {
  if (context.origin !== "user" && context.origin !== "llm") {
    throw new KnowledgeError("invalid-input", "A semantic write comes from the user or the LLM.");
  }
  checkEvidence(context.evidence);
  return transaction(db, () => {
    const change = new Change(db, context, operation);
    const current = work(change);
    change.check();
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
  const [patch] = listPatches(db, undefined, request.name, undefined, space);
  if (patch !== undefined) throw new KnowledgeError("conflict", `${request.name} is the switch of the patch at ${hex(patch.start)}-${hex(patch.end)}. Give the symbol another name.`);
  if (existing !== undefined) change.close("symbols", "space = ? AND address = ?", space, request.address);
  change.insertSymbol({ space, address: request.address, name: request.name, kind, origin });
  if (existing !== undefined && existing.name !== request.name) {
    renameInOperands(db, change, space, existing.name, request.name);
    renameInUses(db, change, space, existing.name, request.name);
  }
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
  const uses = usesNaming(db, space, existing.name);
  if (uses.length > 0) {
    throw new KnowledgeError("conflict", `The macro uses at ${uses.map((row) => hex(row.start)).join(", ")} use ${existing.name}. Change or remove them first (unuse), or rename the symbol.`);
  }
  // No suppression: an analyzer name is a second name and never comes back as the name (D74).
  change.close("symbols", "space = ? AND address = ?", space, request.address);
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

/**
 * Refuses ACME text whose braces do not pair outside comments and strings:
 * c64-source writes patch code and a macro body inside { }.
 */
function checkBraces(text: string, what: string): void {
  let depth = 0;
  for (const line of text.split("\n")) {
    let quote: string | undefined;
    for (let index = 0; index < line.length; index++) {
      const character = line[index]!;
      if (quote !== undefined) {
        if (character === "\\") index++;
        else if (character === quote) quote = undefined;
        continue;
      }
      if (character === ";") break;
      if (character === '"' || character === "'") quote = character;
      else if (character === "{") depth++;
      else if (character === "}" && --depth < 0) throw new KnowledgeError("invalid-input", `${what} has a } with no { before it.`);
    }
  }
  if (depth !== 0) throw new KnowledgeError("invalid-input", `${what} has a { with no }.`);
}

function checkCommentText(comment: string | undefined, what: string): void {
  if (comment !== undefined && (comment.trim().length === 0 || comment.length > MAX_COMMENT)) throw new KnowledgeError("invalid-input", `${what} has 1 to ${MAX_COMMENT} characters.`);
}

/** Refuses a range with a byte outside the image. */
function checkInImage(image: OperandImage, start: number, end: number, what: string): void {
  for (let address = start; address <= end; address++) {
    if (image.byteAt(address) === undefined) throw new KnowledgeError("invalid-input", `${hex(address)} is outside the image: ${what} is a range of the image.`);
  }
}

type PatchRequest = InSpace & { start: number; end: number; switch: string; code: string; comment?: string };

function checkPatch(request: PatchRequest): void {
  checkRange(request);
  if (typeof request.switch !== "string" || !SWITCH_NAME.test(request.switch)) {
    throw new KnowledgeError("invalid-input", "A switch name is an upper-case letter, then 1 to 31 upper-case letters, digits or underscores, for example CRACK.");
  }
  if (typeof request.code !== "string" || request.code.length > MAX_CODE) throw new KnowledgeError("invalid-input", `Patch code has at most ${MAX_CODE} characters; empty code fills the range with NOP.`);
  checkBraces(request.code, "The patch code");
  checkCommentText(request.comment, "A patch comment");
}

function patchStep(db: DatabaseSync, change: Change, context: ChangeContext & { image?: OperandImage }, request: PatchRequest): Step<PatchRow, PatchRow> {
  const space = spaceOf(request);
  const range = `${hex(request.start)}-${hex(request.end)}`;
  if (context.image === undefined) throw new KnowledgeError("invalid-input", "A patch is checked against the image, and no image was given.");
  checkInImage(context.image, request.start, request.end, "a patch");
  const symbol = symbolNamed(db, request.switch, space);
  if (symbol !== undefined) throw new KnowledgeError("conflict", `The switch name ${request.switch} is the name of the symbol at ${hex(symbol.address)}. Give the switch another name.`);
  if (space === DEFAULT_SPACE && context.image.platform.has(request.switch)) throw new KnowledgeError("conflict", `The switch name ${request.switch} is a C64 platform name. Give the switch another name.`);
  const other = patchesOverlapping(db, request.start, request.end, space).find((row) => row.start !== request.start);
  if (other !== undefined) {
    throw new KnowledgeError("conflict", `The patch ${range} overlaps the patch of ${other.switch} at ${hex(other.start)}-${hex(other.end)}. Change or remove that patch first (unpatch).`);
  }
  const [use] = macroUsesOverlapping(db, request.start, request.end, space);
  if (use !== undefined) {
    throw new KnowledgeError("conflict", `The patch ${range} overlaps the use of the macro ${use.macro} at ${hex(use.start)}-${hex(use.end)}. Remove that use first (unuse).`);
  }
  const existing = patchesOverlapping(db, request.start, request.start, space).find((row) => row.start === request.start);
  const code = request.code.trimEnd();
  // A patch write without a comment keeps the comment it has, as a module keeps its title.
  const comment = request.comment === undefined ? existing?.comment : request.comment.trim();
  if (existing !== undefined && existing.end === request.end && existing.switch === request.switch && existing.code === code && existing.comment === comment) return { current: existing };
  const origin = context.origin as PatchRow["origin"];
  if (existing !== undefined) change.close("patches", "space = ? AND start_address = ?", space, request.start);
  change.insertPatch({ space, start: request.start, end: request.end, switch: request.switch, code, ...(comment === undefined ? {} : { comment }), origin });
  const current = patchesOverlapping(db, request.start, request.start, space).find((row) => row.start === request.start)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unpatchStep(db: DatabaseSync, change: Change, _origin: Origin, request: InSpace & { start: number }): Step<null> {
  const space = spaceOf(request);
  if (!patchesOverlapping(db, request.start, request.start, space).some((row) => row.start === request.start)) throw new KnowledgeError("not-found", `No patch starts at ${hex(request.start)}.`);
  change.close("patches", "space = ? AND start_address = ?", space, request.start);
  return { current: null };
}

type MacroRequest = InSpace & { name: string; params?: string[]; body: string; comment?: string };

function checkMacroName(name: unknown, what = "A macro name"): void {
  if (typeof name !== "string" || !MACRO_NAME.test(name)) throw new KnowledgeError("invalid-input", `${what} is a letter or underscore, then at most 31 letters, digits or underscores.`);
}

function checkMacro(request: MacroRequest): void {
  checkSpace(request);
  checkMacroName(request.name);
  const params = request.params ?? [];
  if (!Array.isArray(params) || params.length > MAX_PARAMS) throw new KnowledgeError("invalid-input", `A macro has 0 to ${MAX_PARAMS} params.`);
  for (const param of params) {
    if (typeof param !== "string" || !MACRO_PARAM.test(param)) {
      throw new KnowledgeError("invalid-input", "A macro param is a lower-case letter or underscore, then lower-case letters, digits or underscores, without a dot. The body names it with a dot: .dst.");
    }
  }
  if (new Set(params).size !== params.length) throw new KnowledgeError("invalid-input", "The params of a macro have different names.");
  if (typeof request.body !== "string" || request.body.trim().length === 0 || request.body.length > MAX_CODE) throw new KnowledgeError("invalid-input", `A macro body has 1 to ${MAX_CODE} characters.`);
  checkBraces(request.body, "The macro body");
  checkCommentText(request.comment, "A macro comment");
}

function macroStep(db: DatabaseSync, change: Change, origin: Origin, request: MacroRequest): Step<MacroRow, MacroRow> {
  const space = spaceOf(request);
  const existing = macroNamed(db, request.name, space);
  const params = request.params ?? [];
  const body = request.body.trimEnd();
  const comment = request.comment === undefined ? existing?.comment : request.comment.trim();
  if (existing !== undefined && listText(existing.params) === listText(params) && existing.body === body && existing.comment === comment) return { current: existing };
  if (existing !== undefined && existing.params.length !== params.length) {
    const uses = listMacroUses(db, undefined, request.name, undefined, space);
    if (uses.length > 0) {
      throw new KnowledgeError(
        "conflict",
        `The macro ${request.name} has ${existing.params.length} params, and its uses at ${uses.map((row) => hex(row.start)).join(", ")} give that many args. Remove the uses first (unuse), or keep the number of params.`,
      );
    }
  }
  if (existing !== undefined) change.close("macros", "space = ? AND name = ?", space, request.name);
  change.insertMacro({ space, name: request.name, params, body, ...(comment === undefined ? {} : { comment }), origin: origin as MacroRow["origin"] });
  const current = macroNamed(db, request.name, space)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unmacroStep(db: DatabaseSync, change: Change, _origin: Origin, request: InSpace & { name: string }): Step<null> {
  const space = spaceOf(request);
  if (macroNamed(db, request.name, space) === undefined) throw new KnowledgeError("not-found", `There is no macro ${request.name}.`);
  const uses = listMacroUses(db, undefined, request.name, undefined, space);
  if (uses.length > 0) throw new KnowledgeError("conflict", `The macro ${request.name} has uses at ${uses.map((row) => hex(row.start)).join(", ")}. Remove them first (unuse).`);
  change.close("macros", "space = ? AND name = ?", space, request.name);
  return { current: null };
}

type MacroUseRequest = InSpace & { start: number; end: number; macro: string; args?: string[] };

function checkMacroUse(request: MacroUseRequest): void {
  checkRange(request);
  checkMacroName(request.macro, "The macro of a use");
  const args = request.args ?? [];
  if (!Array.isArray(args) || args.length > MAX_PARAMS) throw new KnowledgeError("invalid-input", `A macro use has 0 to ${MAX_PARAMS} args.`);
  for (const arg of args) {
    if (typeof arg !== "string") throw new KnowledgeError("invalid-input", "Each arg of a macro use is expression text.");
    try {
      checkExpression(arg);
    } catch (error) {
      if (error instanceof ExpressionError) throw new KnowledgeError("invalid-input", error.message);
      throw error;
    }
  }
}

/** Current macro uses that name a symbol in an arg. */
function usesNaming(db: DatabaseSync, space: Space, name: string): MacroUseRow[] {
  return listMacroUses(db, undefined, undefined, undefined, space).filter((row) => row.args.some((arg) => identifiers(arg).includes(name)));
}

/** A rename of a symbol renames it in the args of every macro use; the rows keep their origin. */
function renameInUses(db: DatabaseSync, change: Change, space: Space, from: string, to: string): void {
  for (const row of usesNaming(db, space, from)) {
    change.close("macro_uses", "space = ? AND start_address = ?", space, row.start);
    change.insertMacroUse({ ...row, args: row.args.map((arg) => replaceIdentifiers(arg, (name) => (name === from ? to : name))) });
  }
}

function useStep(db: DatabaseSync, change: Change, context: ChangeContext & { image?: OperandImage }, request: MacroUseRequest): Step<MacroUseRow, MacroUseRow> {
  const space = spaceOf(request);
  const image = context.image;
  const range = `${hex(request.start)}-${hex(request.end)}`;
  if (image === undefined) throw new KnowledgeError("invalid-input", "A macro use is checked against the image, and no image was given.");
  const macro = macroNamed(db, request.macro, space);
  if (macro === undefined) throw new KnowledgeError("not-found", `There is no macro ${request.macro}. Write it first (macro).`);
  const args = (request.args ?? []).map((arg) => arg.trim());
  if (args.length !== macro.params.length) {
    throw new KnowledgeError("invalid-input", `The macro ${macro.name} has ${macro.params.length} params (${listText(macro.params)}), and the use gives ${args.length} args.`);
  }
  const resolve = (name: string) => symbolNamed(db, name, space)?.address ?? (space === DEFAULT_SPACE ? image.platform.get(name) : undefined);
  for (const arg of args) {
    try {
      evaluate(arg, resolve);
    } catch (error) {
      if (error instanceof ExpressionError) throw new KnowledgeError("invalid-input", `${range}: ${error.message}`);
      throw error;
    }
  }
  checkInImage(image, request.start, request.end, "a macro use");
  let next = request.start;
  while (next <= request.end) next += instructionLength(image.byteAt(next)!);
  if (next !== request.end + 1) {
    throw new KnowledgeError("invalid-input", `A macro use is a run of whole instructions, but the instructions from ${hex(request.start)} end at ${hex(next - 1)}, not at ${hex(request.end)}.`);
  }
  const [patch] = patchesOverlapping(db, request.start, request.end, space);
  if (patch !== undefined) {
    throw new KnowledgeError("conflict", `The macro use ${range} overlaps the patch of ${patch.switch} at ${hex(patch.start)}-${hex(patch.end)}. Change or remove that patch first (unpatch).`);
  }
  const other = macroUsesOverlapping(db, request.start, request.end, space).find((row) => row.start !== request.start);
  if (other !== undefined) {
    throw new KnowledgeError("conflict", `The macro use ${range} overlaps the use of ${other.macro} at ${hex(other.start)}-${hex(other.end)}. Remove that use first (unuse).`);
  }
  const existing = macroUsesOverlapping(db, request.start, request.start, space).find((row) => row.start === request.start);
  if (existing !== undefined && existing.end === request.end && existing.macro === request.macro && listText(existing.args) === listText(args)) return { current: existing };
  const origin = context.origin as MacroUseRow["origin"];
  if (existing !== undefined) change.close("macro_uses", "space = ? AND start_address = ?", space, request.start);
  change.insertMacroUse({ space, start: request.start, end: request.end, macro: request.macro, args, origin });
  const current = macroUsesOverlapping(db, request.start, request.start, space).find((row) => row.start === request.start)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unuseStep(db: DatabaseSync, change: Change, _origin: Origin, request: InSpace & { start: number }): Step<null> {
  const space = spaceOf(request);
  if (!macroUsesOverlapping(db, request.start, request.start, space).some((row) => row.start === request.start)) throw new KnowledgeError("not-found", `No macro use starts at ${hex(request.start)}.`);
  change.close("macro_uses", "space = ? AND start_address = ?", space, request.start);
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

/**
 * Writes code that replaces [start, end] when the build defines the switch
 * (D72), after a check that the range is in the image and overlaps no other
 * patch or macro use.
 */
export function setPatch(db: DatabaseSync, context: WriteContext, request: PatchRequest): WriteResult<PatchRow, PatchRow> {
  checkPatch(request);
  return result(write(db, context, "set-patch", (change) => patchStep(db, change, context, request)));
}

export function removePatch(db: DatabaseSync, context: WriteContext, request: InSpace & { start: number }): WriteResult<null> {
  checkSpace(request);
  checkAddress(request.start, "start");
  return result(write(db, context, "remove-patch", (change) => unpatchStep(db, change, context.origin, request)));
}

/** Writes a macro of the generated source (D73). */
export function setMacro(db: DatabaseSync, context: WriteContext, request: MacroRequest): WriteResult<MacroRow, MacroRow> {
  checkMacro(request);
  return result(write(db, context, "set-macro", (change) => macroStep(db, change, context.origin, request)));
}

export function removeMacro(db: DatabaseSync, context: WriteContext, request: InSpace & { name: string }): WriteResult<null> {
  checkSpace(request);
  checkMacroName(request.name);
  return result(write(db, context, "remove-macro", (change) => unmacroStep(db, change, context.origin, request)));
}

/** Writes the instructions in [start, end] as one use of a macro (D73), after a check against the image. */
export function setMacroUse(db: DatabaseSync, context: WriteContext, request: MacroUseRequest): WriteResult<MacroUseRow, MacroUseRow> {
  checkMacroUse(request);
  return result(write(db, context, "set-macro-use", (change) => useStep(db, change, context, request)));
}

export function removeMacroUse(db: DatabaseSync, context: WriteContext, request: InSpace & { start: number }): WriteResult<null> {
  checkSpace(request);
  checkAddress(request.start, "start");
  return result(write(db, context, "remove-macro-use", (change) => unuseStep(db, change, context.origin, request)));
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
  | ({ op: "unoperand" } & AddressRequest)
  | ({ op: "patch" } & PatchRequest)
  | ({ op: "unpatch" } & InSpace & { start: number })
  | ({ op: "macro" } & MacroRequest)
  | ({ op: "unmacro" } & InSpace & { name: string })
  | ({ op: "use" } & MacroUseRequest)
  | ({ op: "unuse" } & InSpace & { start: number });

export const MAX_BATCH = 10_000;

/** The result of each write of a batch, in order. */
export type BatchStep = Step<
  SymbolRow | RegionRow[] | CommentRow | ReferenceRow | ModuleRow | OperandRow | PatchRow | MacroRow | MacroUseRow | null,
  SymbolRow | RegionRow[] | OperandRow | PatchRow | MacroRow | MacroUseRow
>;

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
        case "patch":
          return checkPatch(operation);
        case "unpatch":
        case "unuse":
          checkSpace(operation);
          return checkAddress(operation.start, "start");
        case "macro":
          return checkMacro(operation);
        case "unmacro":
          checkSpace(operation);
          return checkMacroName(operation.name);
        case "use":
          return checkMacroUse(operation);
        default:
          throw new KnowledgeError(
            "invalid-input",
            `op must be one of rename, remove-symbol, classify, unclassify, comment, uncomment, reference, unreference, module, unmodule, operand, unoperand, patch, unpatch, macro, unmacro, use, unuse.`,
          );
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
          case "patch":
            return patchStep(db, change, context, operation);
          case "unpatch":
            return unpatchStep(db, change, context.origin, operation);
          case "macro":
            return macroStep(db, change, context.origin, operation);
          case "unmacro":
            return unmacroStep(db, change, context.origin, operation);
          case "use":
            return useStep(db, change, context, operation);
          case "unuse":
            return unuseStep(db, change, context.origin, operation);
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
/** The tables of the program (D83) and the columns that make a row. */
const PROGRAM_TABLES = [
  ["memory", "space, address, bytes, origin"],
  ["entries", "space, address, state, stages, origin"],
  ["coverage", "space, kind, start_address, end_address, origin"],
] as const;

const KEYS = {
  symbols: { columns: SYMBOL_COLUMNS, map: toSymbol, key: (row: SymbolRow) => `${row.space}|${row.address}|${row.name}|${row.kind}|${row.origin}` },
  analyzer_names: { columns: SYMBOL_COLUMNS, map: toSymbol, key: (row: SymbolRow) => `${row.space}|${row.address}|${row.name}|${row.kind}|${row.origin}` },
  regions: { columns: REGION_COLUMNS, map: toRegion, key: (row: RegionRow) => `${row.space}|${row.start}|${row.end}|${row.type}|${row.element ?? ""}|${row.origin}` },
  comments: { columns: COMMENT_COLUMNS, map: toComment, key: (row: CommentRow) => `${row.space}|${row.address}|${row.placement}|${row.text}|${row.origin}` },
  references: { columns: REFERENCE_COLUMNS, map: toReference, key: (row: ReferenceRow) => `${row.space}|${row.from}|${row.to}|${row.kind}|${row.origin}` },
  modules: { columns: MODULE_COLUMNS, map: toModule, key: (row: ModuleRow) => `${row.space}|${row.start}|${row.file}|${row.title ?? ""}|${row.origin}` },
  operands: {
    columns: OPERAND_COLUMNS,
    map: toOperand,
    key: (row: OperandRow) => `${row.space}|${row.address}|${row.select}|${row.symbol ?? ""}|${row.offset}|${row.expression ?? ""}|${row.origin}`,
  },
  patches: {
    columns: PATCH_COLUMNS,
    map: toPatch,
    key: (row: PatchRow) => `${row.space}|${row.start}|${row.end}|${row.switch}|${row.code}|${row.comment ?? ""}|${row.origin}`,
  },
  macros: { columns: MACRO_COLUMNS, map: toMacro, key: (row: MacroRow) => `${row.space}|${row.name}|${listText(row.params)}|${row.body}|${row.comment ?? ""}|${row.origin}` },
  macro_uses: { columns: MACRO_USE_COLUMNS, map: toMacroUse, key: (row: MacroUseRow) => `${row.space}|${row.start}|${row.end}|${row.macro}|${listText(row.args)}|${row.origin}` },
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
        if (table === "patches") {
          change.insertPatch(spec.map(row as never) as PatchRow);
          continue;
        }
        if (table === "macros") {
          change.insertMacro(spec.map(row as never) as MacroRow);
          continue;
        }
        if (table === "macro_uses") {
          change.insertMacroUse(spec.map(row as never) as MacroUseRow);
          continue;
        }
        const mapped = spec.map(row as never) as SymbolRow & RegionRow & CommentRow & ReferenceRow;
        if (table === "symbols") change.insertSymbol(mapped);
        else if (table === "analyzer_names") change.insertAnalyzerName(mapped);
        else if (table === "regions") change.insertRegion(mapped);
        else if (table === "comments") change.insertComment(mapped);
        else change.insertReference(mapped);
      }
    }
    // The program (D83): a row is the same when all its values are the same.
    for (const [table, columns] of PROGRAM_TABLES) {
      const then = db.prepare(`SELECT ${columns}, id FROM ${table} WHERE ${at}`).all(restored, restored) as Array<Record<string, unknown>>;
      const now = db.prepare(`SELECT ${columns}, id FROM ${table} WHERE valid_to_revision IS NULL`).all() as Array<Record<string, unknown>>;
      const key = (row: Record<string, unknown>) => JSON.stringify(columns.split(", ").map((column) => row[column]));
      const thenKeys = new Set(then.map(key));
      const nowKeys = new Set(now.map(key));
      for (const row of now) if (!thenKeys.has(key(row))) change.close(table, "id = ?", row.id as string);
      for (const row of then) {
        if (nowKeys.has(key(row))) continue;
        const values = row as never;
        if (table === "memory") change.insertMemory(values);
        else if (table === "entries") change.insertEntry(values);
        else change.insertCoverage({ ...(values as { space: Space; kind: string; origin: Origin }), start: row.start_address as number, end: row.end_address as number });
      }
    }
    return { restoredRevision: restored };
  });
}

/** What a merge decided for one conflict: the newest row stays and the older rows close. */
export interface MergeChoice {
  rule: Conflict["rule"];
  space: Space;
  kept: ConflictRow;
  closed: ConflictRow[];
}

/** The most choices one merge makes; more means the knowledge text is broken. */
const MAX_CHOICES = 100_000;

/**
 * Decides every conflict of a git merge in one merge revision (D69). Of the
 * rows of one conflict, the row of the newest revision stays and the others
 * close; an older region keeps its parts outside the newer regions. Where an
 * operand expression closes, the pointer references of its address follow the
 * expression that stays. `platform` gives the C64 platform names.
 */
export function mergeConflicts(db: DatabaseSync, context: WriteContext, platform: ReadonlyMap<string, number>): WriteResult<MergeChoice[]> {
  return write(db, context, "merge", (change) => {
    const choices: MergeChoice[] = [];
    for (let found = conflicts(db); found.length > 0; found = conflicts(db)) {
      if (choices.length >= MAX_CHOICES) throw new KnowledgeError("invalid-database", `The merge made ${MAX_CHOICES} choices and still finds conflicts. Nothing was written.`);
      const conflict = found[0]!;
      const newest = conflict.rows.at(-1)!;
      const older = conflict.rows.slice(0, -1);
      const table = sqlName(conflictTable(conflict.rule));
      for (const entry of older) change.close(table, "id = ?", entry.id);
      if (conflict.rule === "region" || conflict.rule === "suppression-region") keepOutside(change, conflict, conflict.rule === "region");
      if (conflict.rule === "operand") followOperand(db, change, newest.row as OperandRow, platform);
      choices.push({ rule: conflict.rule, space: conflict.space, kept: newest, closed: older });
    }
    return choices;
  });
}

/** Puts back the parts of the older ranges of a conflict that no newer range covers. */
function keepOutside(change: Change, conflict: Conflict, regions: boolean): void {
  const newer: AddressRange[] = [];
  for (const entry of [...conflict.rows].reverse()) {
    const row = entry.row as RegionRow & SuppressionRow;
    if (newer.length > 0) {
      for (const piece of subtract({ start: row.start, end: row.end }, newer)) {
        if (regions) change.insertRegion({ space: row.space, ...piece, type: row.type, ...elementOf(piece, row.element), origin: row.origin });
        else change.insertSuppression({ space: row.space, entity: "region", ...piece, origin: row.origin });
      }
    }
    newer.push({ start: row.start, end: row.end });
  }
}

/** Makes the pointer references of an address the ones of the operand expression that stays there. */
function followOperand(db: DatabaseSync, change: Change, kept: OperandRow, platform: ReadonlyMap<string, number>): void {
  const resolve = (name: string) => symbolNamed(db, name, kept.space)?.address ?? (kept.space === DEFAULT_SPACE ? platform.get(name) : undefined);
  const targets = new Set(identifiers(operandText(kept)).flatMap((name) => resolve(name) ?? []));
  const pointers = referencesFrom(db, kept.address, kept.space).filter((reference) => reference.kind === POINTER_KIND);
  for (const reference of pointers) {
    if (!targets.has(reference.to)) change.close('"references"', "space = ? AND from_address = ? AND to_address = ? AND kind = ?", kept.space, kept.address, reference.to, POINTER_KIND);
  }
  for (const to of targets) {
    if (!pointers.some((reference) => reference.to === to)) change.insertReference({ space: kept.space, from: kept.address, to, kind: POINTER_KIND, origin: kept.origin });
  }
}
