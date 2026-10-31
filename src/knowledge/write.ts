// Semantic knowledge writes. Every accepted change is one
// revision in one transaction: superseded rows are closed, never deleted.

import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import { Refusal } from "../errors.ts";
import { type AddressRange, formatC64Address, formatC64Range, instructionLength, type ReferenceKind, REFERENCE_KINDS, SPACE_PATTERN, subtract, SYMBOL_NAME } from "../c64.ts";
import { isoCet } from "../time.ts";
import { CONFLICT_RULES, conflicts, conflictTable, type Conflict, type ConflictRow } from "./conflicts.ts";
import { prepare, transaction } from "./database.ts";
import { labelProblem, MNEMONICS } from "../opcodes.ts";
import { checkExpression, evaluate, identifiers, OPERAND_SELECTS, operandText, replaceIdentifiers, type OperandSelect } from "./expression.ts";
import {
  baseLabel,
  baseValue,
  commentsAt,
  coverageRuns,
  currentRevision,
  currentStartScreen,
  FACTS,
  listMacroUses,
  listPatches,
  listSwitches,
  listText,
  macroNamed,
  macroUsesOverlapping,
  moduleAt,
  moduleWithFile,
  operandAt,
  patchesOverlapping,
  referencesFrom,
  regionsOverlapping,
  releaseLabeled,
  resolveRevision,
  startScreenRanges,
  suppressionsOverlapping,
  switchNamed,
  symbolAt,
  symbolNamed,
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
import { CODE_REGION_TYPES, COMMENT_PLACEMENTS, EVIDENCE_KINDS, MAX_ELEMENT, MEMORY_ROW, MODULE_FILE, DEFAULT_SPACE, spaceOf, GENERATED_FILES, GENERATED_FOLDERS, isGeneratedFile, isSemantic, MACRO_NAME, MACRO_PARAM, OFF_KINDS, RELEASE_DEFINE, RELEASE_LABEL, LEFTOVERS_SWITCH, START_SCREEN_MODES, START_SCREEN_SWITCH, SWITCH_KINDS, SWITCH_NAME, NO_ELEMENT_TYPES, POINTER_KIND, REGION_TYPES, SYMBOL_KINDS, type CommentPlacement, type EvidenceKind, type Origin, type RegionType, type Space, type StartScreenMode, type SwitchKind, type SymbolKind } from "./schema.ts";
import { newRevisionId, rowId, sqlName, TABLES, tableSpec } from "./text.ts";

type Raw = Record<string, unknown>;

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
  /** The image of a space that an operand, patch or macro use write in that space is checked against. */
  image?: (space: Space) => OperandImage;
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
  /** A merge of the work of two computers: it writes while the knowledge has conflicts, to decide them. */
  allowConflicts?: boolean;
}

/** The value of a row field as its column holds it: a list is text, true is 1, false is 0, and a missing value is null. */
function columnValue(value: unknown): SQLInputValue {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return Array.isArray(value) ? listText(value as string[]) : (value as SQLInputValue);
}

/** The column values of a row of a table, in the order of its fields. `by` names a value of the row by the key of its field (a row as the reads give it) or by its column. */
function rowValues(table: string, row: object, by: "key" | "column" = "key"): SQLInputValue[] {
  return tableSpec(table).fields.map((field) => columnValue((row as Raw)[field[by]]));
}

/**
 * One write: refuses a stale expected revision, then creates the revision row
 * only when the first actual change happens, so a no-op leaves no revision.
 */
export class Change {
  revision: string | null = null;
  /** The rows this write inserted, for their ids. */
  #rows = 0;
  /** The tables that this write inserted rows into. */
  readonly #inserted = new Set<string>();
  /** The program bytes of each space: no step of a write changes the program, so a write reads them once. */
  readonly #programs = new Map<Space, (address: number) => number | undefined>();
  readonly #db: DatabaseSync;
  readonly #context: ChangeContext;
  readonly #operation: string;

  constructor(db: DatabaseSync, context: ChangeContext, operation: string) {
    this.#db = db;
    this.#context = context;
    this.#operation = operation;
    // A merge of two computers' work can leave conflicts: only a merge revision writes then.
    const found = context.allowConflicts === true ? [] : conflicts(db);
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
   * The knowledge had no conflict before the write, and a closed row makes
   * none, so only the rules of the tables that it inserted into can break; a
   * merge checks every rule.
   */
  check(): void {
    if (this.revision === null) return;
    const [found] = conflicts(this.#db, this.#context.allowConflicts === true ? undefined : this.#inserted);
    if (found !== undefined) throw new Refusal("conflict", `The write would leave ${describe(found)}. Nothing was written.`);
  }

  /**
   * The bytes of the program of a space in the knowledge, by address: undefined
   * outside it. A module and a comment are checked against them.
   */
  programBytes(space: Space): (address: number) => number | undefined {
    let byteAt = this.#programs.get(space);
    if (byteAt === undefined) {
      const memory = new Uint8Array(0x10000);
      const held = new Uint8Array(0x10000);
      for (const row of prepare(this.#db, "SELECT address, bytes FROM current_memory WHERE space = ?").all(space) as Array<{ address: number; bytes: string }>) {
        const bytes = Buffer.from(row.bytes, "hex");
        memory.set(bytes, row.address);
        held.fill(1, row.address, row.address + bytes.length);
      }
      this.#programs.set(space, (byteAt = (address) => (held[address] === 1 ? memory[address] : undefined)));
    }
    return byteAt;
  }

  /** The id of the next row this write inserts. */
  #rowId(): string {
    return rowId(this.id(), ++this.#rows);
  }

  /** Closes the current rows of `table` that `where` selects. */
  close(table: string, where: string, ...values: Array<number | string>): void {
    prepare(this.#db, `UPDATE ${sqlName(table)} SET valid_to_revision = ? WHERE valid_to_revision IS NULL AND ${where}`).run(this.id(), ...values);
  }

  /** Inserts a row of `table` with the values of its columns, in the order of its fields. */
  #insert(table: string, values: SQLInputValue[]): void {
    const columns = tableSpec(table).fields.map((field) => field.column);
    prepare(this.#db, `INSERT INTO ${sqlName(table)} (id, ${columns.join(", ")}, valid_from_revision) VALUES (?, ${columns.map(() => "?").join(", ")}, ?)`).run(this.#rowId(), ...values, this.id());
    this.#inserted.add(table);
  }

  /** Inserts a row of `table` with the values that `row` has by column name, as a query of the table gives them. */
  insertColumns(table: string, row: Raw): void {
    this.#insert(table, rowValues(table, row, "column"));
  }

  insertSymbol(row: Omit<SymbolRow, "revision">): void {
    this.#insert("symbols", rowValues("symbols", row));
  }

  /** A second name of an address from an analyzer. */
  insertAnalyzerName(row: Omit<SymbolRow, "revision">): void {
    this.#insert("analyzer_names", rowValues("analyzer_names", row));
  }

  insertRegion(row: Omit<RegionRow, "revision">): void {
    this.#insert("regions", rowValues("regions", row));
  }

  insertComment(row: Omit<CommentRow, "revision">): void {
    this.#insert("comments", rowValues("comments", row));
  }

  insertReference(row: Omit<ReferenceRow, "revision">): void {
    this.#insert("references", rowValues("references", row));
  }

  insertModule(row: Omit<ModuleRow, "revision">): void {
    this.#insert("modules", rowValues("modules", row));
  }

  insertOperand(row: Omit<OperandRow, "revision">): void {
    this.#insert("operands", rowValues("operands", row));
  }

  insertPatch(row: Omit<PatchRow, "revision">): void {
    this.#insert("patches", rowValues("patches", row));
  }

  insertSwitch(row: Omit<SwitchRow, "revision">): void {
    this.#insert("switches", rowValues("switches", row));
  }

  insertRelease(row: Omit<ReleaseRow, "revision">): void {
    this.#insert("releases", rowValues("releases", row));
  }

  /** Bytes of a release other than the base release, as a memory row of the program holds them. */
  insertReleaseMemory(row: { space: Space; label: string; address: number; bytes: string; origin: Origin }): void {
    this.insertColumns("release_memory", row);
  }

  insertStartScreen(row: Omit<StartScreenRow, "revision">): void {
    this.#insert("start_screens", rowValues("start_screens", row));
  }

  insertMacro(row: Omit<MacroRow, "revision">): void {
    this.#insert("macros", rowValues("macros", row));
  }

  insertMacroUse(row: Omit<MacroUseRow, "revision">): void {
    this.#insert("macro_uses", rowValues("macro_uses", row));
  }

  insertSuppression(row: Omit<SuppressionRow, "revision">): void {
    this.#insert("suppressions", rowValues("suppressions", row));
  }

  /** Bytes of the program, as hex digits. */
  insertMemory(row: { space: Space; address: number; bytes: string; origin: Origin }): void {
    this.insertColumns("memory", row);
  }

  /** The entry of the program, with the machine state and the unpacker stages as JSON text when it has them. */
  insertEntry(row: { space: Space; address: number; state: string | null; stages: string | null; origin: Origin }): void {
    this.insertColumns("entries", row);
  }

  /** The ranges of one kind of the coverage map at a project path, as text. */
  insertCoverage(row: { space: Space; map: string; kind: string; ranges: string; origin: Origin }): void {
    this.insertColumns("coverage", row);
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
    return row.end === undefined || row.end === row.start ? formatC64Address(row.start!) : formatC64Range({ start: row.start!, end: row.end });
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
export function write<T>(db: DatabaseSync, context: WriteContext & Pick<ChangeContext, "restores" | "allowConflicts">, operation: string, work: (change: Change) => T): { revision: string | null; current: T } {
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

/** What a step reads of its write: who writes, and the image that operand, patch and macro use writes are checked against. */
type StepContext = Pick<WriteContext, "origin" | "image">;

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

/** Every request names its space; without one it is the C64. */
type InSpace = { space?: Space };
type SymbolRequest = InSpace & { address: number; name: string; kind?: SymbolKind };
type RegionRequest = InSpace & { start: number; end: number; type: RegionType; element?: number };
type RangeRequest = InSpace & { start: number; end: number };
type CommentRequest = InSpace & { address: number; placement: CommentPlacement; text: string };
type PlacementRequest = InSpace & { address: number; placement: CommentPlacement };
type ReferenceRequest = InSpace & { from: number; to: number; kind: ReferenceKind };
type AddressRequest = InSpace & { address: number };

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

function renameStep(db: DatabaseSync, change: Change, request: SymbolRequest, { origin }: StepContext): Step<SymbolRow, SymbolRow> {
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
  if (request.name === LEFTOVERS_SWITCH) throw new Refusal("conflict", `${LEFTOVERS_SWITCH} is the switch of the leftovers in the generated source. Give the symbol another name.`);
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

function removeSymbolStep(db: DatabaseSync, change: Change, request: AddressRequest): Step<null> {
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
function clearRange(db: DatabaseSync, change: Change, start: number, end: number, space: Space = DEFAULT_SPACE): void {
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

function classifyStep(db: DatabaseSync, change: Change, request: RegionRequest, { origin }: StepContext): Step<RegionRow[], RegionRow[]> {
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
    change.close("references", "space = ? AND from_address BETWEEN ? AND ? AND origin NOT IN ('user', 'llm')", space, request.start, request.end);
  }
  const previous = overlapping.filter((row) => row.origin !== origin);
  const current = regionsOverlapping(db, request.start, request.end, space);
  return previous.length === 0 ? { current } : { current, previous };
}

function unclassifyStep(db: DatabaseSync, change: Change, request: RangeRequest, { origin }: StepContext): Step<null> {
  const space = spaceOf(request);
  if (regionsOverlapping(db, request.start, request.end, space).length === 0) {
    throw new Refusal("not-found", `No region covers ${formatC64Range(request)}.`);
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

function commentStep(db: DatabaseSync, change: Change, request: CommentRequest, { origin }: StepContext): Step<CommentRow, CommentRow> {
  const space = spaceOf(request);
  const text = request.text.trim();
  const existing = commentsAt(db, request.address, space).find((comment) => comment.placement === request.placement);
  if (existing?.text === text && !confirms(existing.origin, origin)) return { current: existing };
  // A comment belongs to an instruction: the listing and the source show it at the start of the instruction only.
  checkInstructionStart(db, space, change.programBytes(space), request.address, "comment");
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

function uncommentStep(db: DatabaseSync, change: Change, request: PlacementRequest): Step<null> {
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

function referenceStep(db: DatabaseSync, change: Change, request: ReferenceRequest, { origin }: StepContext): Step<ReferenceRow, ReferenceRow> {
  const space = spaceOf(request);
  const find = () => referencesFrom(db, request.from, space).find((reference) => reference.to === request.to && reference.kind === request.kind);
  const existing = find();
  if (existing !== undefined && !confirms(existing.origin, origin)) return { current: existing };
  // A confirmation of a reference of an analyzer makes it a reference of the writer: the next run of the analyzer keeps it.
  if (existing !== undefined) change.close("references", "space = ? AND from_address = ? AND to_address = ? AND kind = ?", space, request.from, request.to, request.kind);
  change.insertReference({ space, from: request.from, to: request.to, kind: request.kind, origin });
  change.close("suppressions", "space = ? AND entity = 'reference' AND start_address = ? AND to_address = ? AND kind = ?", space, request.from, request.to, request.kind);
  return existing !== undefined ? { current: find()!, previous: existing } : { current: find()! };
}

function unreferenceStep(db: DatabaseSync, change: Change, request: ReferenceRequest, { origin }: StepContext): Step<null> {
  const space = spaceOf(request);
  if (!referencesFrom(db, request.from, space).some((reference) => reference.to === request.to && reference.kind === request.kind)) {
    throw new Refusal("not-found", `There is no ${request.kind} reference from ${formatC64Address(request.from)} to ${formatC64Address(request.to)}.`);
  }
  change.close("references", "space = ? AND from_address = ? AND to_address = ? AND kind = ?", space, request.from, request.to, request.kind);
  change.insertSuppression({ space, entity: "reference", start: request.from, end: request.from, to: request.to, kind: request.kind, origin: origin as SuppressionRow["origin"] });
  return { current: null };
}

type OperandRequest = InSpace & { address: number; select: OperandSelect; symbol?: string; offset?: number; expression?: string };

/** Current operand expressions that use a name, as a symbol or inside expression text. The query keeps the expressions that hold the name as text. */
function operandsNaming(db: DatabaseSync, space: Space, name: string): OperandRow[] {
  return (prepare(db, `SELECT ${FACTS.operands.columns} FROM current_operands WHERE space = ? AND (symbol = ? OR instr(expression, ?) > 0) ORDER BY address`).all(space, name, name) as Raw[])
    .map(FACTS.operands.map)
    .filter((row) => row.symbol === name || (row.expression !== undefined && identifiers(row.expression).includes(name)));
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
      throw new Refusal("invalid-input", `The code region ${formatC64Range(code)} has no program byte at ${formatC64Address(next)}, so its instructions up to ${where} are not known. Correct the region (classify), then write the operand.`);
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

function operandStep(db: DatabaseSync, change: Change, request: OperandRequest, context: StepContext): Step<OperandRow, OperandRow> {
  const space = spaceOf(request);
  if (context.image === undefined) throw new Refusal("invalid-input", "An operand expression is checked against the image, and no image was given.");
  const wanted: Omit<OperandRow, "space" | "address" | "origin" | "revision"> = { select: request.select, offset: request.offset ?? 0 };
  if (request.symbol !== undefined) wanted.symbol = request.symbol;
  if (request.expression !== undefined) wanted.expression = request.expression.trim();
  const targets = new Set(checkOperandValue(db, space, context.image(space), request, operandText(wanted)));
  const existing = operandAt(db, request.address, space);
  const origin = context.origin as OperandRow["origin"];
  if (existing !== undefined && existing.select === wanted.select && existing.symbol === wanted.symbol && existing.offset === wanted.offset && existing.expression === wanted.expression && !confirms(existing.origin, origin)) {
    return { current: existing };
  }
  if (existing !== undefined) change.close("operands", "space = ? AND address = ?", space, request.address);
  change.insertOperand({ space, address: request.address, ...wanted, origin });
  const pointers = referencesFrom(db, request.address, space).filter((reference) => reference.kind === POINTER_KIND);
  for (const reference of pointers) {
    if (!targets.has(reference.to)) change.close("references", "space = ? AND from_address = ? AND to_address = ? AND kind = ?", space, request.address, reference.to, POINTER_KIND);
  }
  for (const to of targets) {
    if (!pointers.some((reference) => reference.to === to)) change.insertReference({ space, from: request.address, to, kind: POINTER_KIND, origin });
  }
  const current = operandAt(db, request.address, space)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unoperandStep(db: DatabaseSync, change: Change, request: AddressRequest): Step<null> {
  const space = spaceOf(request);
  if (operandAt(db, request.address, space) === undefined) throw new Refusal("not-found", `There is no operand expression at ${formatC64Address(request.address)}.`);
  change.close("operands", "space = ? AND address = ?", space, request.address);
  change.close("references", "space = ? AND from_address = ? AND kind = ?", space, request.address, POINTER_KIND);
  return { current: null };
}

type ModuleRequest = InSpace & { start: number; file: string; title?: string };

function checkModule(request: ModuleRequest): void {
  checkSpace(request);
  checkAddress(request.start, "start");
  if (!MODULE_FILE.test(request.file)) {
    throw new Refusal("invalid-input", "A module file is a name of letters, digits, underscores or hyphens (at most 60) that ends in .asm. It can have one folder of lower-case letters, digits, underscores or hyphens (at most 30), for example music/driver.asm.");
  }
  if (isGeneratedFile(request.file)) {
    throw new Refusal("invalid-input", `A module cannot have the file ${request.file}, because the generated source writes ${GENERATED_FILES.join(", ")} in any folder, and the folders ${GENERATED_FOLDERS.map((folder) => `${folder}/`).join(", ")} itself, in any letter case. Give the module another file.`);
  }
  if (request.title !== undefined && (request.title.trim().length === 0 || request.title.length > MAX_COMMENT)) throw new Refusal("invalid-input", `A module title has 1 to ${MAX_COMMENT} characters.`);
}

function moduleStep(db: DatabaseSync, change: Change, request: ModuleRequest, { origin }: StepContext): Step<ModuleRow, ModuleRow> {
  const space = spaceOf(request);
  const existing = moduleAt(db, request.start, space);
  // A module write without a title keeps the title it has.
  const title = request.title === undefined ? existing?.title : request.title.trim();
  if (existing !== undefined && existing.file === request.file && existing.title === title && !confirms(existing.origin, origin)) return { current: existing };
  // A file of the source starts at an instruction: a start inside one splits it into bytes.
  checkInstructionStart(db, space, change.programBytes(space), request.start, "module");
  const owner = moduleWithFile(db, request.file, space);
  if (owner !== undefined && owner.start !== request.start) {
    throw new Refusal("conflict", `The file ${request.file} already belongs to the module at ${formatC64Address(owner.start)}. Give this module another file, or remove that module first.`);
  }
  if (existing !== undefined) change.close("modules", "space = ? AND start_address = ?", space, request.start);
  change.insertModule({ space, start: request.start, file: request.file, ...(title === undefined ? {} : { title }), origin: origin as ModuleRow["origin"] });
  const current = moduleAt(db, request.start, space)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unmoduleStep(db: DatabaseSync, change: Change, request: InSpace & { start: number }): Step<null> {
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

function patchStep(db: DatabaseSync, change: Change, request: PatchRequest, context: StepContext): Step<PatchRow, PatchRow> {
  const space = spaceOf(request);
  const range = formatC64Range(request);
  if (context.image === undefined) throw new Refusal("invalid-input", "A patch is checked against the image, and no image was given.");
  const image = context.image(space);
  checkInImage(image, request.start, request.end, "a patch");
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
      `The patch ${range} of ${request.switch} overlaps the patch of ${other.switch} at ${formatC64Range(other)}. Patches of different switches can have the same range, as alternatives; no other overlap is allowed. Change or remove that patch first (unpatch).`,
    );
  }
  const [use] = macroUsesOverlapping(db, request.start, request.end, space);
  if (use !== undefined) {
    throw new Refusal("conflict", `The patch ${range} overlaps the use of the macro ${use.macro} at ${formatC64Range(use)}. Remove that use first (unuse).`);
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

function unpatchStep(db: DatabaseSync, change: Change, request: InSpace & { start: number; switch?: string }): Step<null> {
  const space = spaceOf(request);
  const found = patchesOverlapping(db, request.start, request.start, space).filter((row) => row.start === request.start && (request.switch === undefined || row.switch === request.switch));
  if (found.length === 0) throw new Refusal("not-found", `No patch${request.switch === undefined ? "" : ` of ${request.switch}`} starts at ${formatC64Address(request.start)}.`);
  if (found.length > 1) throw new Refusal("invalid-input", `The patches of ${found.map((row) => row.switch).join(", ")} start at ${formatC64Address(request.start)}. Give the switch of the patch to remove.`);
  change.close("patches", "space = ? AND start_address = ? AND switch_name = ?", space, request.start, found[0]!.switch);
  return { current: null };
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
    const range = formatC64Range(patches[0]!);
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
  if (request.name === LEFTOVERS_SWITCH) throw new Refusal("invalid-input", `${LEFTOVERS_SWITCH} is the switch of the leftovers in the generated source. Give the switch another name.`);
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

function switchStep(db: DatabaseSync, change: Change, request: SwitchRequest, context: StepContext): Step<SwitchRow, SwitchRow> {
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
  if (space === DEFAULT_SPACE && context.image?.(space).platform.has(request.name)) throw new Refusal("conflict", `The switch name ${request.name} is a C64 platform name. Give the switch another name.`);
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

function unswitchStep(db: DatabaseSync, change: Change, request: InSpace & { name: string }): Step<null> {
  const space = spaceOf(request);
  if (switchNamed(db, request.name, space) === undefined) throw new Refusal("not-found", `There is no switch ${request.name}.`);
  const patches = listPatches(db, undefined, request.name, undefined, space);
  if (patches.length > 0) throw new Refusal("conflict", `The switch ${request.name} has patches at ${patches.map((row) => formatC64Address(row.start)).join(", ")}. Remove them first (unpatch).`);
  change.close("switches", "space = ? AND name = ?", space, request.name);
  return { current: null };
}

/**
 * A release. `rows` are the bytes of a release other than the base release,
 * as memoryRows gives them: the address of each row and its bytes as hex. The
 * base release has no bytes of its own: its bytes are the program. `file` and
 * `sha256` are the project file that the bytes come from and its SHA-256.
 */
type ReleaseRequest = InSpace & { label: string; base?: boolean; file?: string; sha256?: string; comment?: string; rows?: ReadonlyMap<number, string> };

function checkRelease(request: ReleaseRequest): void {
  checkSpace(request);
  if (typeof request.label !== "string" || !RELEASE_LABEL.test(request.label)) {
    throw new Refusal("invalid-input", "A release label is an upper-case letter, then 1 to 31 upper-case letters, digits or underscores, for example FIRESTAR or V2.");
  }
  for (const [address, bytes] of request.rows ?? []) {
    if (!Number.isInteger(address) || address < 0 || address > 0xffff || !/^(?:[0-9a-f]{2})+$/.test(bytes) || bytes.length > MEMORY_ROW * 2 || address + bytes.length / 2 > 0x10000) {
      throw new Refusal("invalid-input", `The bytes of a release at ${formatC64Address(address & 0xffff)} are not a memory row.`);
    }
  }
  if (request.file !== undefined && (typeof request.file !== "string" || request.file.length === 0)) throw new Refusal("invalid-input", "The file of a release is a project path.");
  if (request.sha256 !== undefined && (typeof request.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(request.sha256))) throw new Refusal("invalid-input", "The SHA-256 of a release file is 64 lowercase hex digits.");
  checkCommentText(request.comment, "A release comment");
}

function releaseStep(db: DatabaseSync, change: Change, request: ReleaseRequest, { origin }: StepContext): Step<ReleaseRow, ReleaseRow> {
  const space = spaceOf(request);
  const existing = releaseLabeled(db, request.label, space);
  const base = request.base ?? existing?.base ?? false;
  const comment = request.comment === undefined ? existing?.comment : request.comment.trim();
  // A release that is recorded again without its file keeps the file that it has.
  const file = request.file ?? existing?.file;
  const sha256 = request.file === undefined ? existing?.sha256 : request.sha256;
  const sameFile = existing?.file === file && existing?.sha256 === sha256;
  const held = db.prepare("SELECT id, address, bytes FROM current_release_memory WHERE space = ? AND label = ?").all(space, request.label) as Array<{ id: string; address: number; bytes: string }>;
  // A release without new bytes keeps its bytes. The base release has none: its bytes are the program.
  const wanted = base ? new Map<number, string>() : (request.rows ?? new Map(held.map((row) => [row.address, row.bytes])));
  if (!base && wanted.size === 0) throw new Refusal("invalid-input", `The release ${request.label} has no bytes. Give the file of the release.`);
  const sameBytes = held.length === wanted.size && held.every((row) => wanted.get(row.address) === row.bytes);
  if (existing !== undefined && existing.base === base && existing.comment === comment && sameFile && sameBytes && !confirms(existing.origin, origin)) return { current: existing };
  const other = baseLabel(db, space);
  if (base && other !== undefined && other !== request.label) throw new Refusal("conflict", `The release ${other} is the base release. A space has one base release.`);
  // Every switch takes its base value from the base release: it cannot change under them.
  if ((existing?.base ?? false) !== base) {
    const switches = listSwitches(db, undefined, space);
    if (switches.length > 0) throw new Refusal("conflict", `The base release decides the state of the program for the switches ${switches.map((row) => row.name).join(", ")}. Remove them first (unswitch) to change the base release.`);
  }
  const symbol = symbolNamed(db, `${RELEASE_DEFINE}${request.label}`, space);
  if (symbol !== undefined) throw new Refusal("conflict", `The build of the release defines ${RELEASE_DEFINE}${request.label}, and that is the name of the symbol at ${formatC64Address(symbol.address)}. Give the release another label.`);
  if (existing === undefined || existing.base !== base || existing.comment !== comment || !sameFile || confirms(existing.origin, origin)) {
    if (existing !== undefined) change.close("releases", "space = ? AND label = ?", space, request.label);
    change.insertRelease({ space, label: request.label, base, ...(file === undefined ? {} : { file }), ...(sha256 === undefined ? {} : { sha256 }), ...(comment === undefined ? {} : { comment }), origin: origin as ReleaseRow["origin"] });
  }
  // Only the rows that changed: a changed byte changes one short line of the text.
  const kept = new Set<number>();
  for (const row of held) {
    if (wanted.get(row.address) === row.bytes) kept.add(row.address);
    else change.close("release_memory", "id = ?", row.id);
  }
  for (const [address, bytes] of [...wanted].sort(([a], [b]) => a - b)) if (!kept.has(address)) change.insertReleaseMemory({ space, label: request.label, address, bytes, origin });
  const current = releaseLabeled(db, request.label, space)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unreleaseStep(db: DatabaseSync, change: Change, request: InSpace & { label: string }): Step<null> {
  const space = spaceOf(request);
  const existing = releaseLabeled(db, request.label, space);
  if (existing === undefined) throw new Refusal("not-found", `There is no release ${request.label}.`);
  const switches = listSwitches(db, undefined, space).filter((row) => existing.base || row.releases.includes(request.label));
  if (switches.length > 0) {
    const why = existing.base ? "decides the state of the program for" : "is named by";
    throw new Refusal("conflict", `The release ${request.label} ${why} the switches ${switches.map((row) => row.name).join(", ")}. Change or remove them first (switch, unswitch).`);
  }
  change.close("releases", "space = ? AND label = ?", space, request.label);
  change.close("release_memory", "space = ? AND label = ?", space, request.label);
  return { current: null };
}

type StartScreenRequest = InSpace & { mode: StartScreenMode; screen: number; bitmap?: number; charset?: number; colours?: number; colour?: number; border: number; background: number; stage?: Space; call?: number; colourRam?: boolean; comment?: string };

/**
 * The rules of the VIC-II for a start screen: the screen at a 1K step, the
 * bitmap at an 8K step and the charset at a 2K step, all in one 16K VIC bank,
 * and no part where the VIC-II reads the character ROM. The colours are RAM
 * that the loader reads with the I/O area in, so not in $d000-$dfff. Nothing is
 * in pages 0-3, because the loader writes the entry state there.
 */
function checkStartScreen(request: StartScreenRequest): void {
  checkSpace(request);
  if (spaceOf(request) !== DEFAULT_SPACE) throw new Refusal("invalid-input", "A start screen is only in the space c64. Give the space of its bytes with --stage.");
  if (request.stage !== undefined) {
    checkSpace({ space: request.stage });
    if (request.stage === DEFAULT_SPACE) throw new Refusal("invalid-input", "--stage is another space than c64: the space of a captured stage that holds the bytes of the start screen. Without --stage, the bytes are in the program.");
  }
  if (request.call !== undefined) {
    if (request.stage === undefined) throw new Refusal("invalid-input", "--call is a routine of the stage: give --stage too.");
    checkAddress(request.call, "call");
  }
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
  if (request.colourRam === true) {
    if (request.stage === undefined) throw new Refusal("invalid-input", "The colour RAM of a capture is only for a start screen of a stage: give --stage.");
    if (request.colours !== undefined || request.colour !== undefined) throw new Refusal("invalid-input", "The colours come from the colour RAM of the capture: do not give --colours or --colour too.");
  }
  const colourRam = request.colours !== undefined || request.colour !== undefined || request.colourRam === true;
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

/** The bytes of a start screen of a stage, and its call, must be in the program of that space. */
function checkStage(db: DatabaseSync, change: Change, request: StartScreenRequest): void {
  if (request.stage === undefined) return;
  const byteAt = change.programBytes(request.stage);
  if (byteAt(request.screen) === undefined && db.prepare("SELECT 1 FROM current_memory WHERE space = ? LIMIT 1").get(request.stage) === undefined) {
    throw new Refusal("not-found", `The knowledge has no program in ${request.stage}. Capture the stage while it shows the start screen, and put the capture into the project knowledge with image --space ${request.stage}. Then record the start screen again.`);
  }
  const inStage = (range: AddressRange) => {
    for (let address = range.start; address <= range.end; address++) if (byteAt(address) === undefined) return false;
    return true;
  };
  for (const { what, range } of startScreenRanges(request)) {
    if (!inStage(range)) throw new Refusal("invalid-input", `The ${what} at ${formatC64Range(range)} is not in the program in ${request.stage}. Capture the stage again, and do not exclude the memory of the start screen.`);
  }
  if (request.call !== undefined && !inStage({ start: request.call, end: request.call })) throw new Refusal("invalid-input", `The call ${formatC64Address(request.call)} is not in the program in ${request.stage}.`);
}

function startScreenStep(db: DatabaseSync, change: Change, request: StartScreenRequest, { origin }: StepContext): Step<StartScreenRow, StartScreenRow> {
  const space = spaceOf(request);
  checkStage(db, change, request);
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
    ...(request.stage === undefined ? {} : { stage: request.stage }),
    ...(request.call === undefined ? {} : { call: request.call }),
    ...(request.colourRam === true ? { colourRam: true as const } : {}),
    ...(comment === undefined ? {} : { comment }),
    origin: origin as StartScreenRow["origin"],
  };
  const same = existing !== undefined && JSON.stringify(rowValues("start_screens", existing)) === JSON.stringify(rowValues("start_screens", { ...row, origin: existing.origin }));
  if (same && !confirms(existing.origin, origin)) return { current: existing };
  if (existing !== undefined) change.close("start_screens", "space = ?", space);
  change.insertStartScreen(row);
  const current = currentStartScreen(db, space)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unstartScreenStep(db: DatabaseSync, change: Change, request: InSpace): Step<null> {
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

function macroStep(db: DatabaseSync, change: Change, request: MacroRequest, { origin }: StepContext): Step<MacroRow, MacroRow> {
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

function unmacroStep(db: DatabaseSync, change: Change, request: InSpace & { name: string }): Step<null> {
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

/** Current macro uses that name a symbol in an arg. The query keeps the uses whose args hold the name as text. */
function usesNaming(db: DatabaseSync, space: Space, name: string): MacroUseRow[] {
  return (prepare(db, `SELECT ${FACTS.macro_uses.columns} FROM current_macro_uses WHERE space = ? AND instr(args, ?) > 0 ORDER BY start_address`).all(space, name) as Raw[])
    .map(FACTS.macro_uses.map)
    .filter((row) => row.args.some((arg) => identifiers(arg).includes(name)));
}

/** A rename of a symbol renames it in the args of every macro use; the rows keep their origin. */
function renameInUses(db: DatabaseSync, change: Change, space: Space, from: string, to: string): void {
  for (const row of usesNaming(db, space, from)) {
    change.close("macro_uses", "space = ? AND start_address = ?", space, row.start);
    change.insertMacroUse({ ...row, args: row.args.map((arg) => replaceIdentifiers(arg, (name) => (name === from ? to : name))) });
  }
}

function useStep(db: DatabaseSync, change: Change, request: MacroUseRequest, context: StepContext): Step<MacroUseRow, MacroUseRow> {
  const space = spaceOf(request);
  const range = formatC64Range(request);
  if (context.image === undefined) throw new Refusal("invalid-input", "A macro use is checked against the image, and no image was given.");
  const image = context.image(space);
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
    throw new Refusal("conflict", `The macro use ${range} overlaps the patch of ${patch.switch} at ${formatC64Range(patch)}. Change or remove that patch first (unpatch).`);
  }
  const other = macroUsesOverlapping(db, request.start, request.end, space).find((row) => row.start !== request.start);
  if (other !== undefined) {
    throw new Refusal("conflict", `The macro use ${range} overlaps the use of ${other.macro} at ${formatC64Range(other)}. Remove that use first (unuse).`);
  }
  const existing = macroUsesOverlapping(db, request.start, request.start, space).find((row) => row.start === request.start);
  const origin = context.origin as MacroUseRow["origin"];
  if (existing !== undefined && existing.end === request.end && existing.macro === request.macro && listText(existing.args) === listText(args) && !confirms(existing.origin, origin)) return { current: existing };
  if (existing !== undefined) change.close("macro_uses", "space = ? AND start_address = ?", space, request.start);
  change.insertMacroUse({ space, start: request.start, end: request.end, macro: request.macro, args, origin });
  const current = macroUsesOverlapping(db, request.start, request.start, space).find((row) => row.start === request.start)!;
  return existing !== undefined && existing.origin !== origin ? { current, previous: existing } : { current };
}

function unuseStep(db: DatabaseSync, change: Change, request: InSpace & { start: number }): Step<null> {
  const space = spaceOf(request);
  if (!macroUsesOverlapping(db, request.start, request.start, space).some((row) => row.start === request.start)) throw new Refusal("not-found", `No macro use starts at ${formatC64Address(request.start)}.`);
  change.close("macro_uses", "space = ? AND start_address = ?", space, request.start);
  return { current: null };
}

/** A write: the operation of its revision, the check that refuses bad input before anything opens, and the step that runs inside a change. */
interface WriteOp<R, T, P> {
  operation: string;
  check(request: NoInfer<R>): unknown;
  step(db: DatabaseSync, change: Change, request: R, context: StepContext): Step<T, P>;
}

/** The write of one request as one revision. */
const single =
  <R, T, P>({ operation, check, step }: WriteOp<R, T, P>) =>
  (db: DatabaseSync, context: WriteContext, request: R): WriteResult<T, P> => {
    check(request);
    return result(write(db, context, operation, (change) => step(db, change, request, context)));
  };

/** The check of a write at an address: its space and the address. */
function checkAt(request: AddressRequest): void {
  checkSpace(request);
  checkAddress(request.address);
}

/** The check of a write at a start: its space and the start. */
function checkStart(request: InSpace & { start: number }): void {
  checkSpace(request);
  checkAddress(request.start, "start");
}

function checkUnpatch(request: InSpace & { start: number; switch?: string }): void {
  checkStart(request);
  if (request.switch !== undefined) checkSwitchName(request.switch);
}

function checkUnmacro(request: InSpace & { name: string }): void {
  checkSpace(request);
  checkMacroName(request.name);
}

function checkUnswitch(request: InSpace & { name: string }): void {
  checkSpace(request);
  checkSwitchName(request.name);
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

/** The writes of a batch by their op. Each is also a write of its own. */
const OPS = {
  rename: { operation: "rename-symbol", check: checkSymbol, step: renameStep },
  "remove-symbol": { operation: "remove-symbol", check: checkAt, step: removeSymbolStep },
  classify: { operation: "classify-region", check: checkRegion, step: classifyStep },
  unclassify: { operation: "unclassify-region", check: checkRange, step: unclassifyStep },
  comment: { operation: "set-comment", check: checkComment, step: commentStep },
  uncomment: { operation: "remove-comment", check: checkPlacement, step: uncommentStep },
  reference: { operation: "add-reference", check: checkReference, step: referenceStep },
  unreference: { operation: "remove-reference", check: checkReference, step: unreferenceStep },
  module: { operation: "set-module", check: checkModule, step: moduleStep },
  unmodule: { operation: "remove-module", check: checkStart, step: unmoduleStep },
  operand: { operation: "set-operand", check: checkOperand, step: operandStep },
  unoperand: { operation: "remove-operand", check: checkAt, step: unoperandStep },
  patch: { operation: "set-patch", check: checkPatch, step: patchStep },
  unpatch: { operation: "remove-patch", check: checkUnpatch, step: unpatchStep },
  macro: { operation: "set-macro", check: checkMacro, step: macroStep },
  unmacro: { operation: "remove-macro", check: checkUnmacro, step: unmacroStep },
  use: { operation: "set-macro-use", check: checkMacroUse, step: useStep },
  unuse: { operation: "remove-macro-use", check: checkStart, step: unuseStep },
} satisfies { [K in BatchOperation["op"]]: WriteOp<Extract<BatchOperation, { op: K }>, unknown, unknown> };

/** Names the symbol at an address (one current symbol per address, unique names). */
export const renameSymbol = single(OPS.rename);

export const removeSymbol = single(OPS["remove-symbol"]);

/** Classifies [start, end]; overlapping regions are split so current regions never overlap. */
export const classifyRegion = single(OPS.classify);

/** Makes [start, end] unclassified again; parts of regions outside it stay. */
export const unclassifyRegion = single(OPS.unclassify);

export const setComment = single(OPS.comment);

export const removeComment = single(OPS.uncomment);

export const addReference = single(OPS.reference);

export const removeReference = single(OPS.unreference);

/** Starts a file of the generated source at an address; one module per address and per file. */
export const setModule = single(OPS.module);

export const removeModule = single(OPS.unmodule);

/**
 * Writes the operand expression of the instruction at an address, after
 * a check against the image, and a pointer reference to each name it uses.
 */
export const setOperand = single(OPS.operand);

export const removeOperand = single(OPS.unoperand);

/**
 * Writes code that replaces [start, end] when its switch does not have its
 * base value, after a check that the switch exists, the range is in the image,
 * and it overlaps no macro use and no patch other than an alternative.
 */
export const setPatch = single(OPS.patch);

export const removePatch = single(OPS.unpatch);

/** Writes a switch: its kind, its default and the releases that have it on. The knowledge needs a base release first. */
export const setSwitch = single({ operation: "set-switch", check: checkSwitch, step: switchStep });

export const removeSwitch = single({ operation: "remove-switch", check: checkUnswitch, step: unswitchStep });

/** Writes a release of the program and its bytes. The caller reads the bytes from the file of the release, and checks the file of the base release. */
export const setRelease = single({ operation: "set-release", check: checkRelease, step: releaseStep });

export const removeRelease = single({ operation: "remove-release", check: checkSpace, step: unreleaseStep });

/** Writes the start screen of the program: the loader of the generated source shows it before the entry. */
export const setStartScreen = single({ operation: "set-start-screen", check: checkStartScreen, step: startScreenStep });

export const removeStartScreen = single({ operation: "remove-start-screen", check: checkSpace, step: unstartScreenStep });

/** Writes a macro of the generated source. */
export const setMacro = single(OPS.macro);

export const removeMacro = single(OPS.unmacro);

/** Writes the instructions in [start, end] as one use of a macro, after a check against the image. */
export const setMacroUse = single(OPS.use);

export const removeMacroUse = single(OPS.unuse);

const MAX_BATCH = 10_000;

/** The result of each write of a batch, in order. */
export type BatchStep = Step<
  SymbolRow | RegionRow[] | CommentRow | ReferenceRow | ModuleRow | OperandRow | PatchRow | MacroRow | MacroUseRow | null,
  SymbolRow | RegionRow[] | CommentRow | ReferenceRow | ModuleRow | OperandRow | PatchRow | MacroRow | MacroUseRow
>;

/** A write of a batch. */
type BatchWrite = WriteOp<BatchOperation, BatchStep["current"], NonNullable<BatchStep["previous"]>>;

/**
 * Applies many writes as one revision in one transaction: all of them,
 * or none when one is refused. Every write is checked before anything opens.
 */
export function applyBatch(db: DatabaseSync, context: WriteContext, operations: BatchOperation[]): { revision: string | null; steps: BatchStep[] } {
  if (operations.length === 0 || operations.length > MAX_BATCH) throw new Refusal("invalid-input", `A batch has 1 to ${MAX_BATCH} writes.`);
  // Runs `work` on each write with its op; a refusal names the write.
  const eachWrite = <T>(work: (operation: BatchOperation, op: BatchWrite) => T): T[] =>
    operations.map((operation, index) => {
      try {
        if (!Object.hasOwn(OPS, operation.op)) throw new Refusal("invalid-input", `op must be one of ${Object.keys(OPS).join(", ")}.`);
        return work(operation, OPS[operation.op] as BatchWrite);
      } catch (error) {
        if (error instanceof Refusal) throw new Refusal(error.code, `Write ${index + 1}: ${error.message} Nothing was written.`);
        throw error;
      }
    });
  eachWrite((operation, op) => op.check(operation));
  const written = write(db, context, "apply", (change) => eachWrite((operation, op) => op.step(db, change, operation, context)));
  return { revision: written.revision, steps: written.current };
}

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
    // A row is the same when all its values are the same.
    for (const spec of TABLES) {
      const columns = spec.fields.map((field) => field.column);
      const select = `SELECT ${columns.join(", ")}, id FROM ${sqlName(spec.table)} WHERE `;
      const then = db.prepare(select + at).all(restored, restored, ...spaceArgs) as Raw[];
      const now = db.prepare(select + current).all(...spaceArgs) as Raw[];
      const key = (row: Raw) => JSON.stringify(columns.map((column) => row[column]));
      const thenKeys = new Set(then.map(key));
      const nowKeys = new Set(now.map(key));
      // Close first, so restored rows never collide with the current-row rules.
      for (const row of now) if (!thenKeys.has(key(row))) change.close(spec.table, "id = ?", row.id as string);
      for (const row of then) if (!nowKeys.has(key(row))) change.insertColumns(spec.table, row);
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
  return write(db, { ...context, allowConflicts: true }, "merge", (change) => {
    const choices: MergeChoice[] = [];
    for (let found = conflicts(db); found.length > 0; found = conflicts(db)) {
      if (choices.length >= MAX_CHOICES) throw new Refusal("invalid-database", `The merge made ${MAX_CHOICES} choices and still finds conflicts. Nothing was written.`);
      const conflict = found[0]!;
      const newest = conflict.rows.at(-1)!;
      const older = conflict.rows.slice(0, -1);
      const table = conflictTable(conflict.rule);
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
    if (!targets.has(reference.to)) change.close("references", "space = ? AND from_address = ? AND to_address = ? AND kind = ?", kept.space, kept.address, reference.to, POINTER_KIND);
  }
  for (const to of targets) {
    if (!pointers.some((reference) => reference.to === to)) change.insertReference({ space: kept.space, from: kept.address, to, kind: POINTER_KIND, origin: kept.origin });
  }
}
