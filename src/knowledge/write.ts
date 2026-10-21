// Semantic knowledge writes. Every accepted change is one
// revision in one transaction: superseded rows are closed, never deleted.

import type { DatabaseSync } from "node:sqlite";

import { Refusal } from "../errors.ts";
import { type AddressRange, formatC64Address, instructionLength, SPACE_PATTERN, SYMBOL_NAME } from "../c64.ts";
import { isoCet } from "../time.ts";
import { CONFLICT_RULES, conflicts, conflictTable, type Conflict, type ConflictRow } from "./conflicts.ts";
import { transaction } from "./database.ts";
import { labelProblem, MNEMONICS } from "../opcodes.ts";
import { checkExpression, evaluate, identifiers, operandText, replaceIdentifiers } from "./expression.ts";
import {
  baseValue,
  COMMENT_COLUMNS,
  commentsAt,
  currentRevision,
  listMacroUses,
  listOperands,
  listPatches,
  listReleases,
  listSwitches,
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
  RELEASE_COLUMNS,
  releaseLabeled,
  SWITCH_COLUMNS,
  START_SCREEN_COLUMNS,
  currentStartScreen,
  startScreenRanges,
  switchNamed,
  coverageRuns,
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
  toRelease,
  toSuppression,
  toSwitch,
  toStartScreen,
  toSymbol,
  type CommentRow,
  type CoverageRun,
  type MacroRow,
  type MacroUseRow,
  type ModuleRow,
  type OperandRow,
  type PatchRow,
  type ReferenceRow,
  type RegionRow,
  type ReleaseRow,
  type SuppressionRow,
  type StartScreenRow,
  type SwitchRow,
  type SymbolRow,
} from "./read.ts";
import { CODE_REGION_TYPES, COMMENT_PLACEMENTS, EVIDENCE_KINDS, MAX_ELEMENT, MODULE_FILE, DEFAULT_SPACE, GENERATED_FILES, isGeneratedFile, isSemantic, MACRO_NAME, MACRO_PARAM, OFF_KINDS, RELEASE_DEFINE, RELEASE_LABEL, START_SCREEN_MODES, START_SCREEN_SWITCH, SWITCH_KINDS, SWITCH_NAME, NO_ELEMENT_TYPES, OPERAND_SELECTS, POINTER_KIND, REFERENCE_KINDS, REGION_TYPES, SYMBOL_KINDS, type CommentPlacement, type EvidenceKind, type OperandSelect, type Origin, type ReferenceKind, type RegionType, type Space, type StartScreenMode, type SwitchKind, type SymbolKind } from "./schema.ts";
import { newRevisionId, rowId, sqlName } from "./text.ts";

/** What a change rests on: a coverage run, a test or another project file with its SHA-256, or a note. */
export interface Evidence {
  kind: EvidenceKind;
  ref: string;
  sha256?: string;
  /** The space that a coverage map was imported into; none is the C64, as for a row. */
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
  /** The image that an operand, patch or macro use write is checked against. */
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
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new Refusal("invalid-input", `${what} must be from $0000 to $ffff.`);
}

function checkOneOf<T extends string>(values: readonly T[], value: string, what: string): asserts value is T {
  if (!(values as readonly string[]).includes(value)) throw new Refusal("invalid-input", `${what} must be one of: ${values.join(", ")}.`);
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
  /** A revert: the revision whose knowledge it restores. */
  restores?: string;
  /** A revert of one space: the space whose knowledge it restores. Without it, a revert restores every space. */
  restoresSpace?: Space;
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
    // A merge of two computers' work can leave conflicts: only a merge revision writes then.
    const found = operation === "merge" ? [] : conflicts(db);
    if (found.length > 0) {
      throw new Refusal(
        "conflict",
        `The knowledge has ${found.length} conflict${found.length === 1 ? "" : "s"} from a git merge, for example ${describe(found[0]!)}. Nothing was written. Decide the conflicts of the git merge in the project knowledge. Then write again.`,
      );
    }
    const current = currentRevision(db);
    if (context.expectedRevision !== undefined && resolveRevision(db, context.expectedRevision) !== current) {
      throw new Refusal(
        "stale-revision",
        `Knowledge changed since revision ${context.expectedRevision}; it is now at revision ${current}. Read it again and decide again.`,
      );
    }
  }

  /** The id of this write's revision, created on first use with its evidence (an id that sorts after every revision). */
  id(): string {
    if (this.revision !== null) return this.revision;
    const now = new Date();
    const id = newRevisionId(currentRevision(this.#db), now);
    this.#db
      .prepare("INSERT INTO revisions (id, created_at, origin, operation, input_hash, tool_version, description, restored_revision, restored_space) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, isoCet(now), this.#context.origin, this.#operation, this.#context.inputHash ?? null, this.#context.toolVersion ?? null, this.#context.description ?? null, this.#context.restores ?? null, this.#context.restoresSpace ?? null);
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
    if (found !== undefined) throw new Refusal("conflict", `The write would leave ${describe(found)}. Nothing was written.`);
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

  /** A second name of an address from an analyzer. */
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

  insertSwitch(row: Omit<SwitchRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO switches (id, space, name, kind, default_value, releases, comment, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.name, row.kind, row.default, listText(row.releases), row.comment ?? null, row.origin, this.id());
  }

  insertRelease(row: Omit<ReleaseRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO releases (id, space, label, file, sha256, base, comment, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.label, row.file, row.sha256, row.base ? 1 : 0, row.comment ?? null, row.origin, this.id());
  }

  insertStartScreen(row: Omit<StartScreenRow, "revision">): void {
    this.#db
      .prepare("INSERT INTO start_screens (id, space, mode, screen, bitmap, charset, colours, colour, border, background, comment, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.mode, row.screen, row.bitmap ?? null, row.charset ?? null, row.colours ?? null, row.colour ?? null, row.border, row.background, row.comment ?? null, row.origin, this.id());
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

  /** Bytes of the program, as hex digits. */
  insertMemory(row: { space: Space; address: number; bytes: string; origin: Origin }): void {
    this.#db.prepare("INSERT INTO memory (id, space, address, bytes, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?)").run(this.#rowId(), row.space, row.address, row.bytes, row.origin, this.id());
  }

  /** The entry of the program, with the machine state and the unpacker stages as JSON text when it has them. */
  insertEntry(row: { space: Space; address: number; state: string | null; stages: string | null; origin: Origin }): void {
    this.#db
      .prepare("INSERT INTO entries (id, space, address, state, stages, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.address, row.state, row.stages, row.origin, this.id());
  }

  /** One coverage range of one kind. */
  insertCoverage(row: { space: Space; kind: string; start: number; end: number; origin: Origin }): void {
    this.#db
      .prepare("INSERT INTO coverage (id, space, kind, start_address, end_address, origin, valid_from_revision) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(this.#rowId(), row.space, row.kind, row.start, row.end, row.origin, this.id());
  }
}

/** A conflict in words: its rule, its space and the addresses of its rows. */
function describe(conflict: Conflict): string {
  const place = (entry: ConflictRow) => {
    if (entry.entity === "macro" || entry.entity === "switch") return entry.row.name;
    if (entry.entity === "release") return entry.row.label;
    if (entry.entity === "start-screen") return formatC64Address(entry.row.screen);
    const row = entry.row as { address?: number; start?: number; end?: number; from?: number };
    if (row.address !== undefined) return formatC64Address(row.address);
    if (row.from !== undefined && entry.entity === "reference") return formatC64Address(row.from);
    return row.end === undefined || row.end === row.start ? formatC64Address(row.start!) : `${formatC64Address(row.start!)}-${formatC64Address(row.end)}`;
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
    if (item.ref.trim().length === 0 || item.ref.length > MAX_EVIDENCE_REF) throw new Refusal("invalid-input", `evidence has 1 to ${MAX_EVIDENCE_REF} characters after its kind.`);
    if (item.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(item.sha256)) throw new Refusal("invalid-input", "evidence sha256 must be 64 lowercase hex digits.");
    checkSpace(item);
  }
}

/** Runs semantic writes in one transaction, as one revision. */
export function write<T>(db: DatabaseSync, context: WriteContext & Pick<ChangeContext, "restores">, operation: string, work: (change: Change) => T): { revision: string | null; current: T } {
  if (context.origin !== "user" && context.origin !== "llm") {
    throw new Refusal("invalid-input", "A semantic write comes from the user or the LLM.");
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
// step, which runs inside a change. A single write and a batch share both.

/**
 * True when a write of `origin` over a current row with the same content
 * records a decision, so it replaces the row: over a row of an analyzer (the
 * next run of the analyzer can retire its own rows, never a decision), and the
 * user over the LLM. The LLM over the user changes nothing.
 */
function confirms(existing: Origin, origin: Origin): boolean {
  return existing !== origin && (!isSemantic(existing) || origin === "user");
}

/**
 * The bytes of the program of a space in the knowledge, by address: undefined
 * outside it. A module and a comment are checked against them.
 */
function programBytes(db: DatabaseSync, space: Space): (address: number) => number | undefined {
  const rows = db.prepare("SELECT address, bytes FROM current_memory WHERE space = ?").all(space) as Array<{ address: number; bytes: string }>;
  const memory = new Map<number, number>();
  for (const row of rows) Buffer.from(row.bytes, "hex").forEach((byte, offset) => memory.set(row.address + offset, byte));
  return (address) => memory.get(address);
}

/** Every request names its space; without one it is the C64. */
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
  if (request.space !== undefined && !SPACE_PATTERN.test(request.space)) throw new Refusal("invalid-input", "space must be c64, drive8, or bank0 to bank255.");
}

function checkSymbol(request: SymbolRequest): void {
  checkSpace(request);
  checkAddress(request.address);
  const problem = labelProblem(request.name);
  if (problem !== undefined) throw new Refusal("invalid-input", problem);
  if (request.kind !== undefined) checkOneOf(SYMBOL_KINDS, request.kind, "kind");
}

function renameStep(db: DatabaseSync, change: Change, origin: Origin, request: SymbolRequest): Step<SymbolRow, SymbolRow> {
  const space = spaceOf(request);
  const existing = symbolAt(db, request.address, space);
  const kind = request.kind ?? existing?.kind ?? "label";
  if (existing !== undefined && existing.name === request.name && existing.kind === kind && !confirms(existing.origin, origin)) return { current: existing };
  const owner = symbolNamed(db, request.name, space);
  if (owner !== undefined && owner.address !== request.address) {
    throw new Refusal("conflict", `The name ${request.name} already belongs to ${formatC64Address(owner.address)}. Rename or remove that symbol first.`);
  }
  if (switchNamed(db, request.name, space) !== undefined) throw new Refusal("conflict", `${request.name} is the name of a switch. Give the symbol another name.`);
  if (request.name === START_SCREEN_SWITCH) throw new Refusal("conflict", `${START_SCREEN_SWITCH} is the switch of the start screen in the generated source. Give the symbol another name.`);
  const release = request.name.startsWith(RELEASE_DEFINE) ? releaseLabeled(db, request.name.slice(RELEASE_DEFINE.length), space) : undefined;
  if (release !== undefined) throw new Refusal("conflict", `${request.name} builds the release ${release.label}. Give the symbol another name.`);
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
  if (existing === undefined) throw new Refusal("not-found", `There is no symbol at ${formatC64Address(request.address)}.`);
  const users = operandsNaming(db, space, existing.name);
  if (users.length > 0) {
    throw new Refusal(
      "conflict",
      `The operand expressions at ${users.map((row) => formatC64Address(row.address)).join(", ")} use ${existing.name}. Change or remove them first (unoperand), or rename the symbol.`,
    );
  }
  const uses = usesNaming(db, space, existing.name);
  if (uses.length > 0) {
    throw new Refusal("conflict", `The macro uses at ${uses.map((row) => formatC64Address(row.start)).join(", ")} use ${existing.name}. Change or remove them first (unuse), or rename the symbol.`);
  }
  // No suppression: an analyzer name is a second name and never comes back as the name.
  change.close("symbols", "space = ? AND address = ?", space, request.address);
  return { current: null };
}

function checkRange(request: RangeRequest): void {
  checkSpace(request);
  checkAddress(request.start, "start");
  checkAddress(request.end, "end");
  if (request.end < request.start) throw new Refusal("invalid-input", "end must not be before start.");
}

function checkRegion(request: RegionRequest): void {
  checkRange(request);
  checkOneOf(REGION_TYPES, request.type, "type");
  if (request.element === undefined) return;
  if (NO_ELEMENT_TYPES.includes(request.type)) throw new Refusal("invalid-input", `A ${request.type} region has no element size.`);
  if (!Number.isInteger(request.element) || request.element < 1 || request.element > MAX_ELEMENT) throw new Refusal("invalid-input", `element must be from 1 to ${MAX_ELEMENT}.`);
  const length = request.end - request.start + 1;
  if (length % request.element !== 0) throw new Refusal("invalid-input", `The region has ${length} bytes, which is not a multiple of the element size ${request.element}.`);
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
  if (same && !confirms(only!.origin, origin)) return { current: overlapping };
  clearRange(db, change, request.start, request.end, space);
  change.insertRegion({ space, start: request.start, end: request.end, type: request.type, ...(request.element === undefined ? {} : { element: request.element }), origin });
  liftRegionSuppressions(db, change, request.start, request.end, space);
  // Data is not code: an analyzer reference from there is false code. dual-use bytes are also code.
  if (!CODE_REGION_TYPES.includes(request.type) && request.type !== "dual-use") {
    change.close('"references"', "space = ? AND from_address BETWEEN ? AND ? AND origin NOT IN ('user', 'llm')", space, request.start, request.end);
  }
  const previous = overlapping.filter((row) => row.origin !== origin);
  const current = regionsOverlapping(db, request.start, request.end, space);
  return previous.length === 0 ? { current } : { current, previous };
}

function unclassifyStep(db: DatabaseSync, change: Change, origin: Origin, request: RangeRequest): Step<null> {
  const space = spaceOf(request);
  if (regionsOverlapping(db, request.start, request.end, space).length === 0) {
    throw new Refusal("not-found", `No region covers ${formatC64Address(request.start)}-${formatC64Address(request.end)}.`);
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
  if (text.length === 0 || text.length > MAX_COMMENT) throw new Refusal("invalid-input", `A comment has 1 to ${MAX_COMMENT} characters.`);
  return text;
}

function commentStep(db: DatabaseSync, change: Change, origin: Origin, request: CommentRequest): Step<CommentRow, CommentRow> {
  const space = spaceOf(request);
  const text = request.text.trim();
  const existing = commentsAt(db, request.address, space).find((comment) => comment.placement === request.placement);
  if (existing?.text === text && !confirms(existing.origin, origin)) return { current: existing };
  // A comment belongs to an instruction: the listing and the source show it at the start of the instruction only.
  checkInstructionStart(db, space, programBytes(db, space), request.address, "comment");
  if (existing !== undefined) change.close("comments", "space = ? AND address = ? AND placement = ?", space, request.address, request.placement);
  change.insertComment({ space, address: request.address, placement: request.placement, text, origin });
  const current = commentsAt(db, request.address, space).find((comment) => comment.placement === request.placement)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function checkPlacement(request: PlacementRequest): void {
  checkSpace(request);
  checkAddress(request.address);
  checkOneOf(COMMENT_PLACEMENTS, request.placement, "placement");
}

function uncommentStep(db: DatabaseSync, change: Change, _origin: Origin, request: PlacementRequest): Step<null> {
  const space = spaceOf(request);
  if (!commentsAt(db, request.address, space).some((comment) => comment.placement === request.placement)) {
    throw new Refusal("not-found", `There is no ${request.placement} comment at ${formatC64Address(request.address)}.`);
  }
  change.close("comments", "space = ? AND address = ? AND placement = ?", space, request.address, request.placement);
  return { current: null };
}

function checkReference(request: ReferenceRequest): void {
  checkSpace(request);
  checkAddress(request.from, "from");
  checkAddress(request.to, "to");
  checkOneOf(REFERENCE_KINDS, request.kind, "kind");
  if (request.kind === POINTER_KIND) throw new Refusal("invalid-input", "Only an operand expression writes a pointer reference: use operand and unoperand.");
}

function referenceStep(db: DatabaseSync, change: Change, origin: Origin, request: ReferenceRequest): Step<ReferenceRow, ReferenceRow> {
  const space = spaceOf(request);
  const find = () => referencesFrom(db, request.from, space).find((reference) => reference.to === request.to && reference.kind === request.kind);
  const existing = find();
  if (existing !== undefined && !confirms(existing.origin, origin)) return { current: existing };
  // A confirmation of a reference of an analyzer makes it a reference of the writer: the next run of the analyzer keeps it.
  if (existing !== undefined) change.close('"references"', "space = ? AND from_address = ? AND to_address = ? AND kind = ?", space, request.from, request.to, request.kind);
  change.insertReference({ space, from: request.from, to: request.to, kind: request.kind, origin });
  change.close("suppressions", "space = ? AND entity = 'reference' AND start_address = ? AND to_address = ? AND kind = ?", space, request.from, request.to, request.kind);
  return existing !== undefined ? { current: find()!, previous: existing } : { current: find()! };
}

function unreferenceStep(db: DatabaseSync, change: Change, origin: Origin, request: ReferenceRequest): Step<null> {
  const space = spaceOf(request);
  if (!referencesFrom(db, request.from, space).some((reference) => reference.to === request.to && reference.kind === request.kind)) {
    throw new Refusal("not-found", `There is no ${request.kind} reference from ${formatC64Address(request.from)} to ${formatC64Address(request.to)}.`);
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
    if (request.symbol !== undefined || request.offset !== undefined) throw new Refusal("invalid-input", "An expr operand has expression text, and no symbol or offset.");
    if (typeof request.expression !== "string") throw new Refusal("invalid-input", "An expr operand has expression text.");
    checkExpression(request.expression);
    return;
  }
  if (request.expression !== undefined) throw new Refusal("invalid-input", `A ${request.select} operand has a symbol and an optional offset, and no expression text.`);
  if (request.symbol === undefined || !SYMBOL_NAME.test(request.symbol)) throw new Refusal("invalid-input", `A ${request.select} operand names a symbol: a letter or underscore, then letters, digits or underscores.`);
  if (request.offset !== undefined && (!Number.isInteger(request.offset) || Math.abs(request.offset) > 0xffff)) throw new Refusal("invalid-input", "offset must be a whole number from -$ffff to $ffff.");
}

const shown = (value: number, size: number) => (value < 0 ? String(value) : `$${value.toString(16).padStart(size === 0x100 ? 2 : 4, "0")}`);

/**
 * Refuses an address that is not the start of an instruction. The code
 * regions of the knowledge give the instructions: they are decoded from the
 * start of the region, as the listing and the source decode them. An operand
 * expression needs an instruction, so it is refused also outside the code
 * regions and where the program has no byte. A module and a comment are
 * refused only at an operand byte of a known instruction: they can start data.
 */
function checkInstructionStart(db: DatabaseSync, space: Space, byteAt: (address: number) => number | undefined, address: number, write: "operand" | "module" | "comment"): void {
  const where = formatC64Address(address);
  const code = regionsOverlapping(db, address, address, space).find((region) => CODE_REGION_TYPES.includes(region.type));
  if (code === undefined) {
    if (write !== "operand") return;
    throw new Refusal("invalid-input", `${where} is in no code region, so the knowledge does not know an instruction that starts there. Classify the code that holds the instruction first (classify <range> code), then write the operand.`);
  }
  let start = code.start;
  let next = code.start;
  while (next < address) {
    const opcode = byteAt(next);
    if (opcode === undefined) {
      if (write !== "operand") return;
      throw new Refusal("invalid-input", `The code region ${formatC64Address(code.start)}-${formatC64Address(code.end)} has no program byte at ${formatC64Address(next)}, so its instructions up to ${where} are not known. Correct the region (classify), then write the operand.`);
    }
    start = next;
    next += instructionLength(opcode);
  }
  if (next !== address) {
    const what = write === "operand" ? "" : ` A ${write} is at the start of an instruction, as the listing and the source show it.`;
    throw new Refusal("invalid-input", `${where} is not the start of an instruction. It is an operand byte of the instruction at ${formatC64Address(start)}, decoded from the start of the code region at ${formatC64Address(code.start)}.${what} Give ${formatC64Address(start)}.`);
  }
}

/**
 * Refuses an expression whose value is not the operand in the image, and
 * returns the addresses of its names. Symbols of the knowledge come first, then
 * the platform names of the C64 space.
 */
function checkOperandValue(db: DatabaseSync, space: Space, image: OperandImage, request: OperandRequest, text: string): number[] {
  const where = formatC64Address(request.address);
  const opcode = image.byteAt(request.address);
  if (opcode === undefined) throw new Refusal("invalid-input", `${where} is outside the image.`);
  checkInstructionStart(db, space, (at) => image.byteAt(at), request.address, "operand");
  const length = instructionLength(opcode);
  if (length === 1) throw new Refusal("invalid-input", `The instruction at ${where} (opcode ${shown(opcode, 0x100)}) has no operand.`);
  if ((opcode & 0x1f) === 0x10) throw new Refusal("invalid-input", `The instruction at ${where} is a branch: its operand is a distance, not a value.`);
  if ((request.select === "lo" || request.select === "hi") && length === 3) {
    throw new Refusal("invalid-input", `lo and hi give one byte, but the instruction at ${where} has a 2-byte operand. Use value.`);
  }
  const bytes = [image.byteAt(request.address + 1), length === 3 ? image.byteAt(request.address + 2) : 0];
  if (bytes.some((byte) => byte === undefined)) throw new Refusal("invalid-input", `The instruction at ${where} runs past the end of the image.`);
  const operand = bytes[0]! | (bytes[1]! << 8);
  const resolve = (name: string) => symbolNamed(db, name, space)?.address ?? (space === DEFAULT_SPACE ? image.platform.get(name) : undefined);
  let value: number;
  try {
    value = evaluate(text, resolve);
  } catch (error) {
    if (error instanceof Refusal) throw new Refusal(error.code, `${where}: ${error.message}`);
    throw error;
  }
  const size = length === 2 ? 0x100 : 0x10000;
  if (value < -size / 2 || value >= size || ((value % size) + size) % size !== operand) {
    throw new Refusal("invalid-input", `At ${where}, ${text} gives ${shown(value, size)}, but the operand in the image is ${shown(operand, size)}.`);
  }
  return identifiers(text).map((name) => resolve(name)!);
}

function operandStep(db: DatabaseSync, change: Change, context: ChangeContext & { image?: OperandImage }, request: OperandRequest): Step<OperandRow, OperandRow> {
  const space = spaceOf(request);
  if (context.image === undefined) throw new Refusal("invalid-input", "An operand expression is checked against the image, and no image was given.");
  const wanted: Omit<OperandRow, "space" | "address" | "origin" | "revision"> = { select: request.select, offset: request.offset ?? 0 };
  if (request.symbol !== undefined) wanted.symbol = request.symbol;
  if (request.expression !== undefined) wanted.expression = request.expression.trim();
  const targets = new Set(checkOperandValue(db, space, context.image, request, operandText(wanted)));
  const existing = operandAt(db, request.address, space);
  const origin = context.origin as OperandRow["origin"];
  if (existing !== undefined && existing.select === wanted.select && existing.symbol === wanted.symbol && existing.offset === wanted.offset && existing.expression === wanted.expression && !confirms(existing.origin, origin)) {
    return { current: existing };
  }
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
  if (operandAt(db, request.address, space) === undefined) throw new Refusal("not-found", `There is no operand expression at ${formatC64Address(request.address)}.`);
  change.close("operands", "space = ? AND address = ?", space, request.address);
  change.close('"references"', "space = ? AND from_address = ? AND kind = ?", space, request.address, POINTER_KIND);
  return { current: null };
}

type ModuleRequest = InSpace & { start: number; file: string; title?: string };

function checkModule(request: ModuleRequest): void {
  checkSpace(request);
  checkAddress(request.start, "start");
  if (!MODULE_FILE.test(request.file)) throw new Refusal("invalid-input", "A module file is a name of letters, digits, underscores or hyphens (at most 60) that ends in .asm, without a directory.");
  if (isGeneratedFile(request.file)) {
    throw new Refusal("invalid-input", `A module cannot have the file ${request.file}, because the generated source writes ${GENERATED_FILES.join(", ")} itself, in any letter case. Give the module another file.`);
  }
  if (request.title !== undefined && (request.title.trim().length === 0 || request.title.length > MAX_COMMENT)) throw new Refusal("invalid-input", `A module title has 1 to ${MAX_COMMENT} characters.`);
}

function moduleStep(db: DatabaseSync, change: Change, origin: Origin, request: ModuleRequest): Step<ModuleRow, ModuleRow> {
  const space = spaceOf(request);
  const existing = moduleAt(db, request.start, space);
  // A module write without a title keeps the title it has.
  const title = request.title === undefined ? existing?.title : request.title.trim();
  if (existing !== undefined && existing.file === request.file && existing.title === title && !confirms(existing.origin, origin)) return { current: existing };
  // A file of the source starts at an instruction: a start inside one splits it into bytes.
  checkInstructionStart(db, space, programBytes(db, space), request.start, "module");
  const owner = moduleWithFile(db, request.file, space);
  if (owner !== undefined && owner.start !== request.start) {
    throw new Refusal("conflict", `The file ${request.file} already belongs to the module at ${formatC64Address(owner.start)}. Give this module another file, or remove that module first.`);
  }
  if (existing !== undefined) change.close("modules", "space = ? AND start_address = ?", space, request.start);
  change.insertModule({ space, start: request.start, file: request.file, ...(title === undefined ? {} : { title }), origin: origin as ModuleRow["origin"] });
  const current = moduleAt(db, request.start, space)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unmoduleStep(db: DatabaseSync, change: Change, _origin: Origin, request: InSpace & { start: number }): Step<null> {
  const space = spaceOf(request);
  if (moduleAt(db, request.start, space) === undefined) throw new Refusal("not-found", `No module starts at ${formatC64Address(request.start)}.`);
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
      else if (character === "}" && --depth < 0) throw new Refusal("invalid-input", `${what} has a } with no { before it.`);
    }
  }
  if (depth !== 0) throw new Refusal("invalid-input", `${what} has a { with no }.`);
}

function checkCommentText(comment: string | undefined, what: string): void {
  if (comment !== undefined && (comment.trim().length === 0 || comment.length > MAX_COMMENT)) throw new Refusal("invalid-input", `${what} has 1 to ${MAX_COMMENT} characters.`);
}

/** Refuses a range with a byte outside the image. */
function checkInImage(image: OperandImage, start: number, end: number, what: string): void {
  for (let address = start; address <= end; address++) {
    if (image.byteAt(address) === undefined) throw new Refusal("invalid-input", `${formatC64Address(address)} is outside the image: ${what} is a range of the image.`);
  }
}

type PatchRequest = InSpace & { start: number; end: number; switch: string; code: string; comment?: string };

function checkSwitchName(name: unknown, what = "A switch name"): void {
  if (typeof name !== "string" || !SWITCH_NAME.test(name)) {
    throw new Refusal("invalid-input", `${what} is an upper-case letter, then 1 to 31 upper-case letters, digits or underscores, for example PROTECTION.`);
  }
}

function checkPatch(request: PatchRequest): void {
  checkRange(request);
  checkSwitchName(request.switch, "The switch of a patch");
  if (typeof request.code !== "string" || request.code.length > MAX_CODE) throw new Refusal("invalid-input", `Patch code has at most ${MAX_CODE} characters; empty code fills the range with NOP.`);
  checkBraces(request.code, "The patch code");
  checkCommentText(request.comment, "A patch comment");
}

/** The data directives whose length the items give: the bytes of each item. */
const DATA_ITEM_BYTES: Record<string, number> = { "!byte": 1, "!by": 1, "!8": 1, "!08": 1, "!word": 2, "!wo": 2, "!16": 2 };

/**
 * The least count of bytes that ACME patch code assembles to, when each line
 * is empty, a comment, a data directive (!byte, !word, !fill with a number) or
 * a 6510 instruction without a label. An instruction is 1 byte without an
 * operand (or with A), else at least 2. Undefined for code with another line,
 * for example a label, a macro use or a condition: then only the build of the
 * switch (c64-source generate) gives the length.
 */
export function leastPatchBytes(code: string): number | undefined {
  let bytes = 0;
  for (const raw of code.split("\n")) {
    if (/["']/.test(raw)) return undefined;
    const line = raw.replace(/;.*$/, "").trim();
    if (line === "") continue;
    const [word, ...rest] = line.split(/\s+/);
    const lower = word!.toLowerCase();
    const operand = rest.join(" ");
    const itemBytes = DATA_ITEM_BYTES[lower];
    if (itemBytes !== undefined) {
      if (operand === "") return undefined;
      bytes += itemBytes * operand.split(",").length;
      continue;
    }
    if (lower === "!fill" || lower === "!fi") {
      const count = /^(?:\$([0-9a-f]+)|([0-9]+))\s*(?:,|$)/i.exec(operand);
      if (count === null) return undefined;
      bytes += count[1] === undefined ? Number.parseInt(count[2]!, 10) : Number.parseInt(count[1], 16);
      continue;
    }
    const instruction = /^([a-z]{3})(?:\+([123]))?$/.exec(lower);
    if (instruction === null || !MNEMONICS.has(instruction[1]!)) return undefined;
    if (instruction[2] !== undefined) bytes += 1 + Number(instruction[2]);
    else bytes += operand === "" || operand.toLowerCase() === "a" ? 1 : 2;
  }
  return bytes;
}

function patchStep(db: DatabaseSync, change: Change, context: ChangeContext & { image?: OperandImage }, request: PatchRequest): Step<PatchRow, PatchRow> {
  const space = spaceOf(request);
  const range = `${formatC64Address(request.start)}-${formatC64Address(request.end)}`;
  if (context.image === undefined) throw new Refusal("invalid-input", "A patch is checked against the image, and no image was given.");
  checkInImage(context.image, request.start, request.end, "a patch");
  const least = leastPatchBytes(request.code);
  const length = request.end - request.start + 1;
  if (least !== undefined && least > length) {
    throw new Refusal("invalid-input", `The patch code is at least ${least} bytes, and the range ${range} has ${length}. Make the code shorter, or make the range larger.`);
  }
  const owner = switchNamed(db, request.switch, space);
  if (owner === undefined) throw new Refusal("not-found", `There is no switch ${request.switch}. Write it first (switch ${request.switch} --kind <kind> --releases <labels>).`);
  // A write at the start of a patch of the same switch changes that patch. Another switch can have the same range: an alternative.
  const mine = (row: PatchRow) => row.start === request.start && row.switch === request.switch;
  const other = patchesOverlapping(db, request.start, request.end, space).find((row) => !mine(row) && (row.start !== request.start || row.end !== request.end || row.switch === request.switch));
  if (other !== undefined) {
    throw new Refusal(
      "conflict",
      `The patch ${range} of ${request.switch} overlaps the patch of ${other.switch} at ${formatC64Address(other.start)}-${formatC64Address(other.end)}. Patches of different switches can have the same range, as alternatives; no other overlap is allowed. Change or remove that patch first (unpatch).`,
    );
  }
  const [use] = macroUsesOverlapping(db, request.start, request.end, space);
  if (use !== undefined) {
    throw new Refusal("conflict", `The patch ${range} overlaps the use of the macro ${use.macro} at ${formatC64Address(use.start)}-${formatC64Address(use.end)}. Remove that use first (unuse).`);
  }
  const find = () => patchesOverlapping(db, request.start, request.start, space).find(mine);
  const existing = find();
  const code = request.code.trimEnd();
  // A patch write without a comment keeps the comment it has, as a module keeps its title.
  const comment = request.comment === undefined ? existing?.comment : request.comment.trim();
  const origin = context.origin as PatchRow["origin"];
  if (existing !== undefined && existing.end === request.end && existing.code === code && existing.comment === comment && !confirms(existing.origin, origin)) return { current: existing };
  if (existing !== undefined) change.close("patches", "space = ? AND start_address = ? AND switch_name = ?", space, request.start, request.switch);
  change.insertPatch({ space, start: request.start, end: request.end, switch: request.switch, code, ...(comment === undefined ? {} : { comment }), origin });
  checkAlternatives(db, space, [owner]);
  const current = find()!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unpatchStep(db: DatabaseSync, change: Change, _origin: Origin, request: InSpace & { start: number; switch?: string }): Step<null> {
  const space = spaceOf(request);
  const found = patchesOverlapping(db, request.start, request.start, space).filter((row) => row.start === request.start && (request.switch === undefined || row.switch === request.switch));
  if (found.length === 0) throw new Refusal("not-found", `No patch${request.switch === undefined ? "" : ` of ${request.switch}`} starts at ${formatC64Address(request.start)}.`);
  if (found.length > 1) throw new Refusal("invalid-input", `The patches of ${found.map((row) => row.switch).join(", ")} start at ${formatC64Address(request.start)}. Give the switch of the patch to remove.`);
  change.close("patches", "space = ? AND start_address = ? AND switch_name = ?", space, request.start, found[0]!.switch);
  return { current: null };
}

/** The label of the base release of a space: its bytes are the program of the knowledge. */
function baseLabel(db: DatabaseSync, space: Space): string | undefined {
  return listReleases(db, undefined, space).find((release) => release.base)?.label;
}

/**
 * Refuses alternatives that are both on in the default build: a patch is on
 * when its switch does not have its base value. Two patches of one range can
 * not both be on, so the default build must choose one.
 */
function checkAlternatives(db: DatabaseSync, space: Space, changed: readonly SwitchRow[]): void {
  const base = baseLabel(db, space);
  const switches = new Map(listSwitches(db, undefined, space).map((row) => [row.name, row]));
  const names = new Set(changed.map((row) => row.name));
  const ranges = new Map<string, PatchRow[]>();
  for (const patch of listPatches(db, undefined, undefined, undefined, space)) ranges.set(`${patch.start}-${patch.end}`, [...(ranges.get(`${patch.start}-${patch.end}`) ?? []), patch]);
  for (const patches of ranges.values()) {
    if (patches.length < 2 || !patches.some((patch) => names.has(patch.switch))) continue;
    const on = patches.filter((patch) => {
      const owner = switches.get(patch.switch)!;
      return owner.default !== baseValue(owner, base);
    });
    if (on.length < 2) continue;
    const range = `${formatC64Address(patches[0]!.start)}-${formatC64Address(patches[0]!.end)}`;
    throw new Refusal(
      "conflict",
      `The switches ${on.map((patch) => patch.switch).join(" and ")} have alternative patches at ${range}, and the default build puts in both of them. Give one of the switches the default of the base release (switch <name> --default).`,
    );
  }
}

type SwitchRequest = InSpace & { name: string; kind: SwitchKind; default?: 0 | 1; releases?: string[]; comment?: string };

function checkSwitch(request: SwitchRequest): void {
  checkSpace(request);
  checkSwitchName(request.name);
  if (request.name.startsWith(RELEASE_DEFINE)) throw new Refusal("invalid-input", `A switch name does not start with ${RELEASE_DEFINE}: the build of a release defines ${RELEASE_DEFINE}<label>.`);
  if (request.name === START_SCREEN_SWITCH) throw new Refusal("invalid-input", `${START_SCREEN_SWITCH} is the switch of the start screen in the generated source. Give the switch another name.`);
  checkOneOf(SWITCH_KINDS, request.kind, "kind");
  if (request.default !== undefined && request.default !== 0 && request.default !== 1) throw new Refusal("invalid-input", "default must be 0 or 1.");
  if (OFF_KINDS.includes(request.kind) && request.default === 1) {
    throw new Refusal("invalid-input", `A ${request.kind} switch is off in the default build: the default build is the clean program. Build a release, or define the switch, to put it in.`);
  }
  for (const label of request.releases ?? []) if (typeof label !== "string" || !RELEASE_LABEL.test(label)) throw new Refusal("invalid-input", `${JSON.stringify(label)} is not a release label.`);
  checkCommentText(request.comment, "A switch comment");
}

/** The default of a switch: a fix is on, the kinds of OFF_KINDS are off, and a change needs one. */
function defaultOf(request: SwitchRequest, existing: SwitchRow | undefined): 0 | 1 {
  if (request.default !== undefined) return request.default;
  if (existing !== undefined && existing.kind === request.kind) return existing.default;
  if (request.kind === "fix") return 1;
  if (OFF_KINDS.includes(request.kind)) return 0;
  throw new Refusal("invalid-input", `A ${request.kind} switch needs a default: give --default 0 or --default 1.`);
}

function switchStep(db: DatabaseSync, change: Change, context: ChangeContext & { image?: OperandImage }, request: SwitchRequest): Step<SwitchRow, SwitchRow> {
  const space = spaceOf(request);
  const base = baseLabel(db, space);
  if (base === undefined) throw new Refusal("not-found", "The knowledge has no base release. Record the release whose bytes are the program first (release <label> --file <file> --base).");
  const existing = switchNamed(db, request.name, space);
  const releases = [...new Set(request.releases ?? existing?.releases ?? [])].sort();
  for (const label of releases) if (releaseLabeled(db, label, space) === undefined) throw new Refusal("not-found", `There is no release ${label}. Record it first (release ${label} --file <file>).`);
  const value = defaultOf(request, existing);
  const comment = request.comment === undefined ? existing?.comment : request.comment.trim();
  const origin = context.origin as SwitchRow["origin"];
  if (existing !== undefined && existing.kind === request.kind && existing.default === value && listText(existing.releases) === listText(releases) && existing.comment === comment && !confirms(existing.origin, origin)) return { current: existing };
  const symbol = symbolNamed(db, request.name, space);
  if (symbol !== undefined) throw new Refusal("conflict", `The switch name ${request.name} is the name of the symbol at ${formatC64Address(symbol.address)}. Give the switch another name.`);
  if (space === DEFAULT_SPACE && context.image?.platform.has(request.name)) throw new Refusal("conflict", `The switch name ${request.name} is a C64 platform name. Give the switch another name.`);
  // The patches hold the code of the value that the base release does not have: that value cannot change under them.
  if (existing !== undefined && baseValue(existing, base) !== baseValue({ releases }, base)) {
    const patches = listPatches(db, undefined, request.name, undefined, space);
    if (patches.length > 0) {
      throw new Refusal(
        "conflict",
        `The switch ${request.name} has patches at ${patches.map((row) => formatC64Address(row.start)).join(", ")}, and this write changes whether the base release ${base} has it on. The patches would then hold the wrong state. Remove them first (unpatch), then write them again.`,
      );
    }
  }
  if (existing !== undefined) change.close("switches", "space = ? AND name = ?", space, request.name);
  change.insertSwitch({ space, name: request.name, kind: request.kind, default: value, releases, ...(comment === undefined ? {} : { comment }), origin });
  const current = switchNamed(db, request.name, space)!;
  checkAlternatives(db, space, [current]);
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unswitchStep(db: DatabaseSync, change: Change, _origin: Origin, request: InSpace & { name: string }): Step<null> {
  const space = spaceOf(request);
  if (switchNamed(db, request.name, space) === undefined) throw new Refusal("not-found", `There is no switch ${request.name}.`);
  const patches = listPatches(db, undefined, request.name, undefined, space);
  if (patches.length > 0) throw new Refusal("conflict", `The switch ${request.name} has patches at ${patches.map((row) => formatC64Address(row.start)).join(", ")}. Remove them first (unpatch).`);
  change.close("switches", "space = ? AND name = ?", space, request.name);
  return { current: null };
}

/** A release: `file` is a project path and `sha256` the hash of its bytes, both from the caller. */
type ReleaseRequest = InSpace & { label: string; file: string; sha256: string; base?: boolean; comment?: string };

function checkRelease(request: ReleaseRequest): void {
  checkSpace(request);
  if (typeof request.label !== "string" || !RELEASE_LABEL.test(request.label)) {
    throw new Refusal("invalid-input", "A release label is an upper-case letter, then 1 to 31 upper-case letters, digits or underscores, for example ORIGINAL or FIRESTAR.");
  }
  if (typeof request.file !== "string" || request.file.trim().length === 0 || request.file.length > MAX_EVIDENCE_REF) throw new Refusal("invalid-input", `The file of a release has 1 to ${MAX_EVIDENCE_REF} characters.`);
  if (!/^[0-9a-f]{64}$/.test(request.sha256)) throw new Refusal("invalid-input", "The sha256 of a release is 64 lowercase hex digits.");
  checkCommentText(request.comment, "A release comment");
}

function releaseStep(db: DatabaseSync, change: Change, origin: Origin, request: ReleaseRequest): Step<ReleaseRow, ReleaseRow> {
  const space = spaceOf(request);
  const existing = releaseLabeled(db, request.label, space);
  const base = request.base ?? existing?.base ?? false;
  const comment = request.comment === undefined ? existing?.comment : request.comment.trim();
  if (existing !== undefined && existing.file === request.file && existing.sha256 === request.sha256 && existing.base === base && existing.comment === comment && !confirms(existing.origin, origin)) return { current: existing };
  const other = baseLabel(db, space);
  if (base && other !== undefined && other !== request.label) throw new Refusal("conflict", `The release ${other} is the base release. A space has one base release.`);
  // Every switch takes its base value from the base release: it cannot change under them.
  if ((existing?.base ?? false) !== base) {
    const switches = listSwitches(db, undefined, space);
    if (switches.length > 0) throw new Refusal("conflict", `The base release decides the state of the program for the switches ${switches.map((row) => row.name).join(", ")}. Remove them first (unswitch) to change the base release.`);
  }
  const symbol = symbolNamed(db, `${RELEASE_DEFINE}${request.label}`, space);
  if (symbol !== undefined) throw new Refusal("conflict", `The build of the release defines ${RELEASE_DEFINE}${request.label}, and that is the name of the symbol at ${formatC64Address(symbol.address)}. Give the release another label.`);
  if (existing !== undefined) change.close("releases", "space = ? AND label = ?", space, request.label);
  change.insertRelease({ space, label: request.label, file: request.file, sha256: request.sha256, base, ...(comment === undefined ? {} : { comment }), origin: origin as ReleaseRow["origin"] });
  const current = releaseLabeled(db, request.label, space)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unreleaseStep(db: DatabaseSync, change: Change, _origin: Origin, request: InSpace & { label: string }): Step<null> {
  const space = spaceOf(request);
  const existing = releaseLabeled(db, request.label, space);
  if (existing === undefined) throw new Refusal("not-found", `There is no release ${request.label}.`);
  const switches = listSwitches(db, undefined, space).filter((row) => existing.base || row.releases.includes(request.label));
  if (switches.length > 0) {
    const why = existing.base ? "decides the state of the program for" : "is named by";
    throw new Refusal("conflict", `The release ${request.label} ${why} the switches ${switches.map((row) => row.name).join(", ")}. Change or remove them first (switch, unswitch).`);
  }
  change.close("releases", "space = ? AND label = ?", space, request.label);
  return { current: null };
}

type StartScreenRequest = InSpace & { mode: StartScreenMode; screen: number; bitmap?: number; charset?: number; colours?: number; colour?: number; border: number; background: number; comment?: string };

/**
 * The rules of the VIC-II for a start screen: the screen at a 1K step, the
 * bitmap at an 8K step and the charset at a 2K step, all in one 16K VIC bank,
 * and no part where the VIC-II reads the character ROM. The colours are RAM
 * that the loader reads with the I/O area in, so not in $d000-$dfff. Nothing is
 * in pages 0-3, because the loader writes the entry state there.
 */
function checkStartScreen(request: StartScreenRequest): void {
  checkSpace(request);
  if (spaceOf(request) !== DEFAULT_SPACE) throw new Refusal("invalid-input", "A start screen is only in the space c64.");
  checkOneOf(START_SCREEN_MODES, request.mode, "mode");
  checkAddress(request.screen, "screen");
  for (const key of ["bitmap", "charset", "colours"] as const) if (request[key] !== undefined) checkAddress(request[key], key);
  for (const key of ["border", "background", "colour"] as const) {
    const value = request[key];
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 15)) throw new Refusal("invalid-input", `${key} must be a colour from 0 to 15.`);
  }
  if (request.mode === "text") {
    if (request.charset === undefined || request.bitmap !== undefined) throw new Refusal("invalid-input", "A text start screen has a charset and no bitmap. Give --charset, for example '$1000' for the character ROM in VIC bank 0.");
  } else if (request.bitmap === undefined || request.charset !== undefined) {
    throw new Refusal("invalid-input", `A ${request.mode} start screen has a bitmap and no charset. Give --bitmap.`);
  }
  if (request.colours !== undefined && request.colour !== undefined) throw new Refusal("invalid-input", "Give the colour RAM as --colours or as --colour, not both.");
  const colourRam = request.colours !== undefined || request.colour !== undefined;
  if (request.mode === "hires" && colourRam) throw new Refusal("invalid-input", "A hires bitmap does not use the colour RAM. Remove --colours and --colour.");
  if (request.mode !== "hires" && !colourRam) throw new Refusal("invalid-input", `A ${request.mode} start screen uses the colour RAM. Give --colours with the address of its 1000 bytes, or --colour with one colour.`);
  const step = (value: number, size: number, what: string) => {
    if (value % size !== 0) throw new Refusal("invalid-input", `The VIC-II reads the ${what} only at a step of $${size.toString(16)}: ${formatC64Address(value)} is not at one.`);
  };
  step(request.screen, 0x400, "screen");
  if (request.bitmap !== undefined) step(request.bitmap, 0x2000, "bitmap");
  if (request.charset !== undefined) step(request.charset, 0x800, "charset");
  const bank = request.screen >> 14;
  for (const [what, value] of [["bitmap", request.bitmap], ["charset", request.charset]] as const) {
    if (value !== undefined && value >> 14 !== bank) throw new Refusal("invalid-input", `The ${what} at ${formatC64Address(value)} is not in the VIC bank of the screen (${formatC64Address(bank << 14)}-${formatC64Address((bank << 14) + 0x3fff)}).`);
  }
  for (const { what, range } of startScreenRanges(request)) {
    if (range.end > 0xffff) throw new Refusal("invalid-input", `The ${what} at ${formatC64Address(range.start)} goes past $ffff.`);
    if (range.start < 0x0400) throw new Refusal("invalid-input", `The ${what} at ${formatC64Address(range.start)} is in pages 0-3, where the loader writes the entry state.`);
    if (what === "colours") {
      if (range.start <= 0xdfff && range.end >= 0xd000) throw new Refusal("invalid-input", `The colours at ${formatC64Address(range.start)} are in $d000-$dfff, where the loader sees the I/O area. Give the RAM address of the 1000 colour bytes.`);
      continue;
    }
    // In VIC banks 0 and 2 the VIC-II reads the character ROM at $1000-$1fff of the bank.
    const relative = range.start & 0x3fff;
    if ((bank & 1) === 0 && relative <= 0x1fff && relative + (range.end - range.start) >= 0x1000) {
      throw new Refusal("invalid-input", `The ${what} at ${formatC64Address(range.start)} is where the VIC-II reads the character ROM ($1000-$1fff of VIC bank ${bank}). Only a text charset at $1000 or $1800 of the bank uses the ROM font.`);
    }
  }
  checkCommentText(request.comment, "A start screen comment");
}

function startScreenStep(db: DatabaseSync, change: Change, origin: Origin, request: StartScreenRequest): Step<StartScreenRow, StartScreenRow> {
  const space = spaceOf(request);
  const existing = currentStartScreen(db, space);
  const comment = request.comment === undefined ? existing?.comment : request.comment.trim();
  const row: Omit<StartScreenRow, "revision"> = {
    space,
    mode: request.mode,
    screen: request.screen,
    ...(request.bitmap === undefined ? {} : { bitmap: request.bitmap }),
    ...(request.charset === undefined ? {} : { charset: request.charset }),
    ...(request.colours === undefined ? {} : { colours: request.colours }),
    ...(request.colour === undefined ? {} : { colour: request.colour }),
    border: request.border,
    background: request.background,
    ...(comment === undefined ? {} : { comment }),
    origin: origin as StartScreenRow["origin"],
  };
  const same = existing !== undefined && KEYS.start_screens.key(existing) === KEYS.start_screens.key({ ...row, origin: existing.origin, revision: "" });
  if (same && !confirms(existing.origin, origin)) return { current: existing };
  if (existing !== undefined) change.close("start_screens", "space = ?", space);
  change.insertStartScreen(row);
  const current = currentStartScreen(db, space)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unstartScreenStep(db: DatabaseSync, change: Change, _origin: Origin, request: InSpace): Step<null> {
  const space = spaceOf(request);
  if (currentStartScreen(db, space) === undefined) throw new Refusal("not-found", "The knowledge has no start screen.");
  change.close("start_screens", "space = ?", space);
  return { current: null };
}

type MacroRequest = InSpace & { name: string; params?: string[]; body: string; comment?: string };

function checkMacroName(name: unknown, what = "A macro name"): void {
  if (typeof name !== "string" || !MACRO_NAME.test(name)) throw new Refusal("invalid-input", `${what} is a letter or underscore, then at most 31 letters, digits or underscores.`);
}

function checkMacro(request: MacroRequest): void {
  checkSpace(request);
  checkMacroName(request.name);
  const params = request.params ?? [];
  if (!Array.isArray(params) || params.length > MAX_PARAMS) throw new Refusal("invalid-input", `A macro has 0 to ${MAX_PARAMS} params.`);
  for (const param of params) {
    if (typeof param !== "string" || !MACRO_PARAM.test(param)) {
      throw new Refusal("invalid-input", "A macro param is a lower-case letter or underscore, then lower-case letters, digits or underscores, without a dot. The body names it with a dot: .dst.");
    }
  }
  if (new Set(params).size !== params.length) throw new Refusal("invalid-input", "The params of a macro have different names.");
  if (typeof request.body !== "string" || request.body.trim().length === 0 || request.body.length > MAX_CODE) throw new Refusal("invalid-input", `A macro body has 1 to ${MAX_CODE} characters.`);
  checkBraces(request.body, "The macro body");
  checkCommentText(request.comment, "A macro comment");
}

function macroStep(db: DatabaseSync, change: Change, origin: Origin, request: MacroRequest): Step<MacroRow, MacroRow> {
  const space = spaceOf(request);
  const existing = macroNamed(db, request.name, space);
  const params = request.params ?? [];
  const body = request.body.trimEnd();
  const comment = request.comment === undefined ? existing?.comment : request.comment.trim();
  if (existing !== undefined && listText(existing.params) === listText(params) && existing.body === body && existing.comment === comment && !confirms(existing.origin, origin)) return { current: existing };
  if (existing !== undefined && existing.params.length !== params.length) {
    const uses = listMacroUses(db, undefined, request.name, undefined, space);
    if (uses.length > 0) {
      throw new Refusal(
        "conflict",
        `The macro ${request.name} has ${existing.params.length} params, and its uses at ${uses.map((row) => formatC64Address(row.start)).join(", ")} give that many args. Remove the uses first (unuse), or keep the number of params.`,
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
  if (macroNamed(db, request.name, space) === undefined) throw new Refusal("not-found", `There is no macro ${request.name}.`);
  const uses = listMacroUses(db, undefined, request.name, undefined, space);
  if (uses.length > 0) throw new Refusal("conflict", `The macro ${request.name} has uses at ${uses.map((row) => formatC64Address(row.start)).join(", ")}. Remove them first (unuse).`);
  change.close("macros", "space = ? AND name = ?", space, request.name);
  return { current: null };
}

type MacroUseRequest = InSpace & { start: number; end: number; macro: string; args?: string[] };

function checkMacroUse(request: MacroUseRequest): void {
  checkRange(request);
  checkMacroName(request.macro, "The macro of a use");
  const args = request.args ?? [];
  if (!Array.isArray(args) || args.length > MAX_PARAMS) throw new Refusal("invalid-input", `A macro use has 0 to ${MAX_PARAMS} args.`);
  for (const arg of args) {
    if (typeof arg !== "string") throw new Refusal("invalid-input", "Each arg of a macro use is expression text.");
    checkExpression(arg);
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
  const range = `${formatC64Address(request.start)}-${formatC64Address(request.end)}`;
  if (image === undefined) throw new Refusal("invalid-input", "A macro use is checked against the image, and no image was given.");
  const macro = macroNamed(db, request.macro, space);
  if (macro === undefined) throw new Refusal("not-found", `There is no macro ${request.macro}. Write it first (macro).`);
  const args = (request.args ?? []).map((arg) => arg.trim());
  if (args.length !== macro.params.length) {
    throw new Refusal("invalid-input", `The macro ${macro.name} has ${macro.params.length} params (${listText(macro.params)}), and the use gives ${args.length} args.`);
  }
  const resolve = (name: string) => symbolNamed(db, name, space)?.address ?? (space === DEFAULT_SPACE ? image.platform.get(name) : undefined);
  for (const arg of args) {
    try {
      evaluate(arg, resolve);
    } catch (error) {
      if (error instanceof Refusal) throw new Refusal(error.code, `${range}: ${error.message}`);
      throw error;
    }
  }
  checkInImage(image, request.start, request.end, "a macro use");
  let next = request.start;
  while (next <= request.end) next += instructionLength(image.byteAt(next)!);
  if (next !== request.end + 1) {
    throw new Refusal("invalid-input", `A macro use is a run of whole instructions, but the instructions from ${formatC64Address(request.start)} end at ${formatC64Address(next - 1)}, not at ${formatC64Address(request.end)}.`);
  }
  const [patch] = patchesOverlapping(db, request.start, request.end, space);
  if (patch !== undefined) {
    throw new Refusal("conflict", `The macro use ${range} overlaps the patch of ${patch.switch} at ${formatC64Address(patch.start)}-${formatC64Address(patch.end)}. Change or remove that patch first (unpatch).`);
  }
  const other = macroUsesOverlapping(db, request.start, request.end, space).find((row) => row.start !== request.start);
  if (other !== undefined) {
    throw new Refusal("conflict", `The macro use ${range} overlaps the use of ${other.macro} at ${formatC64Address(other.start)}-${formatC64Address(other.end)}. Remove that use first (unuse).`);
  }
  const existing = macroUsesOverlapping(db, request.start, request.start, space).find((row) => row.start === request.start);
  const origin = context.origin as MacroUseRow["origin"];
  if (existing !== undefined && existing.end === request.end && existing.macro === request.macro && listText(existing.args) === listText(args) && !confirms(existing.origin, origin)) return { current: existing };
  if (existing !== undefined) change.close("macro_uses", "space = ? AND start_address = ?", space, request.start);
  change.insertMacroUse({ space, start: request.start, end: request.end, macro: request.macro, args, origin });
  const current = macroUsesOverlapping(db, request.start, request.start, space).find((row) => row.start === request.start)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unuseStep(db: DatabaseSync, change: Change, _origin: Origin, request: InSpace & { start: number }): Step<null> {
  const space = spaceOf(request);
  if (!macroUsesOverlapping(db, request.start, request.start, space).some((row) => row.start === request.start)) throw new Refusal("not-found", `No macro use starts at ${formatC64Address(request.start)}.`);
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

export function setComment(db: DatabaseSync, context: WriteContext, request: CommentRequest): WriteResult<CommentRow, CommentRow> {
  checkComment(request);
  return result(write(db, context, "set-comment", (change) => commentStep(db, change, context.origin, request)));
}

export function removeComment(db: DatabaseSync, context: WriteContext, request: PlacementRequest): WriteResult<null> {
  checkPlacement(request);
  return result(write(db, context, "remove-comment", (change) => uncommentStep(db, change, context.origin, request)));
}

export function addReference(db: DatabaseSync, context: WriteContext, request: ReferenceRequest): WriteResult<ReferenceRow, ReferenceRow> {
  checkReference(request);
  return result(write(db, context, "add-reference", (change) => referenceStep(db, change, context.origin, request)));
}

export function removeReference(db: DatabaseSync, context: WriteContext, request: ReferenceRequest): WriteResult<null> {
  checkReference(request);
  return result(write(db, context, "remove-reference", (change) => unreferenceStep(db, change, context.origin, request)));
}

/** Starts a file of the generated source at an address; one module per address and per file. */
export function setModule(db: DatabaseSync, context: WriteContext, request: ModuleRequest): WriteResult<ModuleRow, ModuleRow> {
  checkModule(request);
  return result(write(db, context, "set-module", (change) => moduleStep(db, change, context.origin, request)));
}

export function removeModule(db: DatabaseSync, context: WriteContext, request: InSpace & { start: number }): WriteResult<null> {
  checkSpace(request);
  checkAddress(request.start, "start");
  return result(write(db, context, "remove-module", (change) => unmoduleStep(db, change, context.origin, request)));
}

/**
 * Writes the operand expression of the instruction at an address, after
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
 * Writes code that replaces [start, end] when its switch does not have its
 * base value, after a check that the switch exists, the range is in the image,
 * and it overlaps no macro use and no patch other than an alternative.
 */
export function setPatch(db: DatabaseSync, context: WriteContext, request: PatchRequest): WriteResult<PatchRow, PatchRow> {
  checkPatch(request);
  return result(write(db, context, "set-patch", (change) => patchStep(db, change, context, request)));
}

export function removePatch(db: DatabaseSync, context: WriteContext, request: InSpace & { start: number; switch?: string }): WriteResult<null> {
  checkSpace(request);
  checkAddress(request.start, "start");
  if (request.switch !== undefined) checkSwitchName(request.switch);
  return result(write(db, context, "remove-patch", (change) => unpatchStep(db, change, context.origin, request)));
}

/** Writes a switch: its kind, its default and the releases that have it on. The knowledge needs a base release first. */
export function setSwitch(db: DatabaseSync, context: WriteContext, request: SwitchRequest): WriteResult<SwitchRow, SwitchRow> {
  checkSwitch(request);
  return result(write(db, context, "set-switch", (change) => switchStep(db, change, context, request)));
}

export function removeSwitch(db: DatabaseSync, context: WriteContext, request: InSpace & { name: string }): WriteResult<null> {
  checkSpace(request);
  checkSwitchName(request.name);
  return result(write(db, context, "remove-switch", (change) => unswitchStep(db, change, context.origin, request)));
}

/** Writes a release of the program: its project file and the SHA-256 of it. The caller checks the file. */
export function setRelease(db: DatabaseSync, context: WriteContext, request: ReleaseRequest): WriteResult<ReleaseRow, ReleaseRow> {
  checkRelease(request);
  return result(write(db, context, "set-release", (change) => releaseStep(db, change, context.origin, request)));
}

export function removeRelease(db: DatabaseSync, context: WriteContext, request: InSpace & { label: string }): WriteResult<null> {
  checkSpace(request);
  return result(write(db, context, "remove-release", (change) => unreleaseStep(db, change, context.origin, request)));
}

/** Writes the start screen of the program: the loader of the generated source shows it before the entry. */
export function setStartScreen(db: DatabaseSync, context: WriteContext, request: StartScreenRequest): WriteResult<StartScreenRow, StartScreenRow> {
  checkStartScreen(request);
  return result(write(db, context, "set-start-screen", (change) => startScreenStep(db, change, context.origin, request)));
}

export function removeStartScreen(db: DatabaseSync, context: WriteContext, request: InSpace): WriteResult<null> {
  checkSpace(request);
  return result(write(db, context, "remove-start-screen", (change) => unstartScreenStep(db, change, context.origin, request)));
}

/** Writes a macro of the generated source. */
export function setMacro(db: DatabaseSync, context: WriteContext, request: MacroRequest): WriteResult<MacroRow, MacroRow> {
  checkMacro(request);
  return result(write(db, context, "set-macro", (change) => macroStep(db, change, context.origin, request)));
}

export function removeMacro(db: DatabaseSync, context: WriteContext, request: InSpace & { name: string }): WriteResult<null> {
  checkSpace(request);
  checkMacroName(request.name);
  return result(write(db, context, "remove-macro", (change) => unmacroStep(db, change, context.origin, request)));
}

/** Writes the instructions in [start, end] as one use of a macro, after a check against the image. */
export function setMacroUse(db: DatabaseSync, context: WriteContext, request: MacroUseRequest): WriteResult<MacroUseRow, MacroUseRow> {
  checkMacroUse(request);
  return result(write(db, context, "set-macro-use", (change) => useStep(db, change, context, request)));
}

export function removeMacroUse(db: DatabaseSync, context: WriteContext, request: InSpace & { start: number }): WriteResult<null> {
  checkSpace(request);
  checkAddress(request.start, "start");
  return result(write(db, context, "remove-macro-use", (change) => unuseStep(db, change, context.origin, request)));
}

/** One write of a batch, named as the command that does it alone. */
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
  | ({ op: "unpatch" } & InSpace & { start: number; switch?: string })
  | ({ op: "macro" } & MacroRequest)
  | ({ op: "unmacro" } & InSpace & { name: string })
  | ({ op: "use" } & MacroUseRequest)
  | ({ op: "unuse" } & InSpace & { start: number });

export const MAX_BATCH = 10_000;

/** The result of each write of a batch, in order. */
export type BatchStep = Step<
  SymbolRow | RegionRow[] | CommentRow | ReferenceRow | ModuleRow | OperandRow | PatchRow | MacroRow | MacroUseRow | null,
  SymbolRow | RegionRow[] | CommentRow | ReferenceRow | ModuleRow | OperandRow | PatchRow | MacroRow | MacroUseRow
>;

/**
 * Applies many writes as one revision in one transaction: all of them,
 * or none when one is refused. Every write is checked before anything opens.
 */
export function applyBatch(db: DatabaseSync, context: WriteContext, operations: BatchOperation[]): { revision: string | null; steps: BatchStep[] } {
  if (operations.length === 0 || operations.length > MAX_BATCH) throw new Refusal("invalid-input", `A batch has 1 to ${MAX_BATCH} writes.`);
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
          if (operation.switch !== undefined) checkSwitchName(operation.switch);
          checkSpace(operation);
          return checkAddress(operation.start, "start");
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
          throw new Refusal(
            "invalid-input",
            `op must be one of rename, remove-symbol, classify, unclassify, comment, uncomment, reference, unreference, module, unmodule, operand, unoperand, patch, unpatch, macro, unmacro, use, unuse.`,
          );
      }
    } catch (error) {
      if (error instanceof Refusal) throw new Refusal(error.code, `Write ${index + 1}: ${error.message} Nothing was written.`);
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
        if (error instanceof Refusal) throw new Refusal(error.code, `Write ${index + 1}: ${error.message} Nothing was written.`);
        throw error;
      }
    }),
  );
  return { revision: written.revision, steps: written.current };
}

/** Row content without its revision, as a comparable key. */
/** The tables of the program and the columns that make a row. */
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
  switches: {
    columns: SWITCH_COLUMNS,
    map: toSwitch,
    key: (row: SwitchRow) => `${row.space}|${row.name}|${row.kind}|${row.default}|${listText(row.releases)}|${row.comment ?? ""}|${row.origin}`,
  },
  releases: {
    columns: RELEASE_COLUMNS,
    map: toRelease,
    key: (row: ReleaseRow) => `${row.space}|${row.label}|${row.file}|${row.sha256}|${row.base}|${row.comment ?? ""}|${row.origin}`,
  },
  start_screens: {
    columns: START_SCREEN_COLUMNS,
    map: toStartScreen,
    key: (row: StartScreenRow) =>
      `${row.space}|${row.mode}|${row.screen}|${row.bitmap ?? ""}|${row.charset ?? ""}|${row.colours ?? ""}|${row.colour ?? ""}|${row.border}|${row.background}|${row.comment ?? ""}|${row.origin}`,
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
 * revision. With `space`, only the rows of that space change; without it,
 * every space changes. History is never erased; restored rows keep their origin.
 */
export function revert(db: DatabaseSync, context: WriteContext, request: { revision: string; space?: Space }): WriteResult<{ restoredRevision: string }> {
  checkSpace(request);
  const restored = resolveRevision(db, request.revision);
  const only = request.space;
  return write(db, { ...context, restores: restored, ...(only === undefined ? {} : { restoresSpace: only }) }, "revert", (change) => {
    // The coverage maps that the knowledge has follow the revert, also when no coverage range changes.
    const maps = (runs: CoverageRun[]) => JSON.stringify(runs.filter((run) => only === undefined || run.space === only).map((run) => [run.name, run.sha256, run.space, run.revision]));
    if (maps(coverageRuns(db, restored)) !== maps(coverageRuns(db))) change.id();
    const inSpace = only === undefined ? "" : " AND space = ?";
    const spaceArgs = only === undefined ? [] : [only];
    const at = `valid_from_revision <= ? AND (valid_to_revision IS NULL OR valid_to_revision > ?)${inSpace}`;
    const current = `valid_to_revision IS NULL${inSpace}`;
    for (const [table, spec] of Object.entries(KEYS)) {
      const name = table === "references" ? '"references"' : table;
      const then = db.prepare(`SELECT ${spec.columns}, id FROM ${name} WHERE ${at}`).all(restored, restored, ...spaceArgs) as Array<Record<string, unknown>>;
      const now = db.prepare(`SELECT ${spec.columns}, id FROM ${name} WHERE ${current}`).all(...spaceArgs) as Array<Record<string, unknown>>;
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
        if (table === "switches") {
          change.insertSwitch(spec.map(row as never) as SwitchRow);
          continue;
        }
        if (table === "releases") {
          change.insertRelease(spec.map(row as never) as ReleaseRow);
          continue;
        }
        if (table === "start_screens") {
          change.insertStartScreen(spec.map(row as never) as StartScreenRow);
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
    // The program: a row is the same when all its values are the same.
    for (const [table, columns] of PROGRAM_TABLES) {
      const then = db.prepare(`SELECT ${columns}, id FROM ${table} WHERE ${at}`).all(restored, restored, ...spaceArgs) as Array<Record<string, unknown>>;
      const now = db.prepare(`SELECT ${columns}, id FROM ${table} WHERE ${current}`).all(...spaceArgs) as Array<Record<string, unknown>>;
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
 * Decides every conflict of a git merge in one merge revision. Of the
 * rows of one conflict, the row of the newest revision stays and the others
 * close; an older region keeps its parts outside the newer regions. Where an
 * operand expression closes, the pointer references of its address follow the
 * expression that stays. `platform` gives the C64 platform names.
 */
export function mergeConflicts(db: DatabaseSync, context: WriteContext, platform: ReadonlyMap<string, number>): WriteResult<MergeChoice[]> {
  return write(db, context, "merge", (change) => {
    const choices: MergeChoice[] = [];
    for (let found = conflicts(db); found.length > 0; found = conflicts(db)) {
      if (choices.length >= MAX_CHOICES) throw new Refusal("invalid-database", `The merge made ${MAX_CHOICES} choices and still finds conflicts. Nothing was written.`);
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
