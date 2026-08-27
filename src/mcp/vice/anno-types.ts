#!/usr/bin/env node
// anno-types.ts
//
// The ONE place that writes down the annotation store's data-type vocabulary,
// its range row shape, and every validator the store runs before a caller's
// argument is allowed anywhere near SQL (STORE-01).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// The MCP proxy validates NOTHING. `vice-proxy.ts:3224` declares
// `rawJsonSchemaAsStandardSchema()`, and its validator at `:3230` is literally
// `validate: (value: unknown) => ({ value })` -- by design, and documented as
// such right there, because that is what keeps `tools/list`'s wire output
// byte-identical to the manifest's own raw schema. The consequence is that
// every argument reaches the store UNVALIDATED: an address of 65536, a
// misspelled data type, and a store path pointing outside the workspace all
// look identical to the transport.
//
// So validation lives here, at the store's own entry, and throws named
// `ViceError` subclasses whose messages embed the offending value AND the
// valid range or form -- `stock-address.ts:132-134`'s convention. It does NOT
// use `zod`: zod exists in this tree only as an undeclared transitive of
// `@mastra`, so a shipped module importing it would depend on a package this
// repo never declared and could lose without notice.
//
// The vocabulary itself is the one irreversible decision in this area.
// Split-table ORIENTATION cannot be recovered from a store that never
// recorded it -- there is no field to migrate, so the recovery cost is a hand
// re-annotation of every split table in every project file. That is why all
// four split layouts are first-class members rather than one `table` member
// plus an orientation flag, and why the twelve strings are frozen and pinned
// by a hand-written test (`anno-types.test.ts`) rather than by a derived one.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each entry names a specific, measured trap
// ---------------------------------------------------------------------------
//   1. NEVER re-spell, re-order, add to or remove from the twelve members of
//      `DATA_TYPES`. They are the `r2000_set_data_type` schema's own strings in
//      the schema's own order (`r2000-tools.ts:291-304`), and
//      `src/skills/c64-memory-mapping/SKILL.md` already names all four split
//      variants verbatim -- a re-spelling breaks a shipped playbook and buys
//      nothing. Narrowing the vocabulary once a project file exists is not a
//      migration; it is data loss.
//   2. NEVER write a second literal list of the split layouts.
//      `SPLIT_DATA_TYPES` is DERIVED by filtering `DATA_TYPES`, the way
//      `r2000-confidence.ts:79` derives `VALID_BRACKETS` with a `.map()`. Two
//      literal lists are two homes for one fact, and they drift silently.
//   3. NEVER hold module-level mutable state here. Every export below is a
//      frozen constant or a pure function of its arguments, so two concurrent
//      callers cannot observe each other and there is nothing to reset.
//   4. NEVER accept an unprefixed numeric string as an address.
//      `parseStoreAddress()` takes an integer, a `$hex` string and a
//      `0x`/`0X` string, and refuses `"1024"`. This is a REAL, user-visible
//      divergence from `stock-address.ts:155-160`, which accepts the bare
//      decimal form AS DECIMAL under its own decision `D-04` and says so at
//      `:89-105`. The reason the store diverges: a mis-based address written
//      into the store is PERSISTENT and silently wrong -- every later reader
//      inherits it -- whereas a mis-based memory read is transient and the
//      caller sees the wrong bytes immediately. An agent WILL hit this: the
//      same string that reads memory at 1024 decimal is refused here.
//   5. NEVER reuse `stock-address.ts`'s `parseAddress()`. Trap 4 is the first
//      reason; the second is independent of it -- that module carries
//      module-level mutable resolver state at `:44-76`, so its parse result
//      depends on whether a symbol table happens to be installed. A store
//      write must not.
//   6. NEVER let a validator return a value instead of throwing. A refusal
//      that returns a default writes the default into the store.
//   7. NEVER sanitise, substitute, trim or quote a label name. An illegal name
//      is REFUSED outright. The hazard is concrete: a space-to-underscore
//      substitution turns `init screen` and `init_screen` -- two names a human
//      deliberately distinguished -- into ONE name, and the loss is silent and
//      permanent because nothing records that a substitution happened. A legal
//      name already bound to a different address is refused for the same
//      reason rather than rebound. The schema states the rule itself
//      (`r2000-tools.ts:246-251`): "An illegal name is REJECTED, never
//      sanitized or quoted."
//   8. NEVER restate the eleven auto-generated-name prefixes here. They live in
//      exactly one place, `r2000-coverage.ts`'s `AUTO_NAME_PREFIX_RE`, and
//      `EXPORT-02` names the exact failure a short reimplementation causes: a
//      five-prefix copy silently under-counts, which breaks the
//      `routine-queue-walker` skill's backlog construction while every test
//      keeps passing. The store separates the two namespaces with its label
//      `kind` field, not with a name pattern.
//   9. NEVER build a mnemonic-to-access-kind classifier here. Nothing derivable
//      is stored (see `anno-store.ts`'s `putXref`), `OpcodeEntry` carries no
//      access/reads/writes field at all, and `REQUIREMENTS.md` records the
//      analysis built on such a field as deferred with a named trigger. A
//      classifier written now would have no caller and no way to be wrong
//      observably.
//  10. NEVER measure comment length in code units. `String.length` counts UTF-16
//      code units, so a multi-byte comment passes a code-unit check and then
//      exceeds the byte bound on disk. `assertCommentText()` measures with a
//      `TextEncoder`.
import { resolve, sep } from "node:path";

import { OPCODES } from "./disasm-opcodes.ts";
import { ViceError, type ViceErrorOptions } from "./vice.ts";

/** The on-disk schema version every store file carries in `anno_meta`. A
 * store whose `schema_version` is not this exact value is REFUSED, never
 * silently upgraded. */
export const SCHEMA_VERSION = 1;

/** The 6510's address space, inclusive at both ends. */
export const ADDRESS_MIN = 0x0000;
export const ADDRESS_MAX = 0xffff;

/** How many pre-mutation snapshots the `snapshots/` sibling directory may
 * hold before the oldest is pruned. Declared here because the bound is a
 * property of the store's format; the pruning that enforces it belongs to the
 * revert surface (`STORE-04`). */
export const MAX_SNAPSHOT_REVISIONS = 32;

/**
 * The twelve annotation data types, in the `r2000_set_data_type` schema's own
 * order and spelling (`r2000-tools.ts:291-304`). This is the ONE place the
 * vocabulary is written down -- see trap 1 in the module header.
 *
 * Both distinguishing axes are separately observable, which is what justifies
 * four split members rather than two. ORIENTATION: the bytes
 * `10 34 00 ff 08 12 c0 cf` resolve as `$0810 $1234 $c000 $cfff` under
 * `lo_hi_address` and as `$1008 $3412 $00c0 $ffcf` under `hi_lo_address` -- a
 * different resolved-target set. ADDRESS-VERSUS-WORD: the address forms
 * produce cross-references and the word forms do not
 * (`r2000-tools.ts:305-313`).
 */
export const DATA_TYPES = Object.freeze([
  "code",
  "byte",
  "word",
  "address",
  "petscii",
  "screencode",
  "lo_hi_address",
  "hi_lo_address",
  "lo_hi_word",
  "hi_lo_word",
  "external_file",
  "undefined",
] as const);

/** One member of the frozen twelve. */
export type DataType = (typeof DATA_TYPES)[number];

/** The two split-table byte-order prefixes the schema's own spellings use.
 * `SPLIT_DATA_TYPES` is derived through these -- never re-typed. */
const SPLIT_PREFIXES = Object.freeze(["lo_hi_", "hi_lo_"] as const);

/** A split-table layout: one of the four members whose spelling begins with a
 * byte-order prefix. Derived from `DataType` by template-literal `Extract`, so
 * this type cannot name a string the vocabulary does not contain. */
export type SplitDataType = Extract<DataType, `lo_hi_${string}` | `hi_lo_${string}`>;

/** True iff `value` is one of the four split-table layouts. The one predicate
 * both `SPLIT_DATA_TYPES` and `assertRangeShape()`'s even-count rule use, so
 * "counts as a split table" has exactly one definition. */
export function isSplitDataType(value: DataType): value is SplitDataType {
  return SPLIT_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** The four split-table layouts, DERIVED from `DATA_TYPES` (trap 2). */
export const SPLIT_DATA_TYPES: readonly SplitDataType[] = Object.freeze(DATA_TYPES.filter(isSplitDataType));

/**
 * One typed range as the store holds it. `endInclusive` is INCLUSIVE, matching
 * the schema's own `end_address` sentence (`r2000-tools.ts:288`), so a range's
 * length is `endInclusive - start + 1` and a one-byte range has
 * `start === endInclusive`. `bank` is reserved and interpreted by nothing:
 * every row this store writes today has `bank` null.
 */
export interface RangeRow {
  id: number;
  start: number;
  endInclusive: number;
  dataType: DataType;
  bank: number | null;
}

/**
 * The two comment placements, in the `r2000_set_comment` schema's own order and
 * spelling (`r2000-tools.ts:270-274`). This is the ONE place this vocabulary is
 * written down: `'line'` is a comment on its own line before the instruction,
 * `'side'` is inline on the same line as the instruction.
 */
export const COMMENT_TYPES = Object.freeze(["line", "side"] as const);

/** One of the two comment placements. */
export type CommentType = (typeof COMMENT_TYPES)[number];

/**
 * The four label kinds. This is the ONE place this vocabulary is written down.
 *
 * THE CAPITALISATION IS A DECIDED ASYMMETRY, not an oversight. `DATA_TYPES` is
 * lowercase because it is read off `r2000_set_data_type`'s own schema and is
 * named verbatim in `src/skills/c64-memory-mapping/SKILL.md`, so a re-spelling
 * would break a shipped playbook. `LABEL_KINDS` is capitalised because its only
 * mechanical consumer is the coverage census, which already spells it
 * `"User"`/`"Auto"`/`"System"` at four sites (`r2000-coverage.ts:206` for the
 * doc form, `:1425-1435` for the acceptance, where `"Platform"` is taken as a
 * synonym of `"System"`). Matching the consumer costs nothing; changing the
 * consumer costs four edits inside a 2,292-line module and buys no criterion.
 *
 * `"Platform"` is a first-class member here rather than normalised away,
 * because the census accepts both spellings and the store must be able to
 * record which one a caller supplied.
 */
export const LABEL_KINDS = Object.freeze(["User", "Auto", "System", "Platform"] as const);

/** One of the four label kinds. `"User"` and `"Auto"` are the two namespaces
 * the store keeps apart -- with this field, never with a name pattern (trap 8). */
export type LabelKind = (typeof LABEL_KINDS)[number];

/**
 * The four cross-reference access kinds. This is the ONE place this vocabulary
 * is written down, and its provenance needs stating precisely so a later reader
 * does not over-trust it: these four spellings are CITED from an external
 * analyser's reference documentation, flowed through this project's own research
 * notes, and fixed by `STORE-05`'s requirement text. They are NOT read from any
 * code in this repository, and no comment may present them as verified project
 * vocabulary.
 *
 * `COMPUTED_JUMP` is the member that motivates the whole table: a computed
 * dispatch produces NO reference derivable from the bytes, so it is precisely
 * the case that needs a hand-asserted row somewhere. See `anno-store.ts`'s
 * `putXref`.
 */
export const XREF_ACCESS_KINDS = Object.freeze(["READ", "WRITE", "READ_WRITE", "COMPUTED_JUMP"] as const);

/** One of the four cross-reference access kinds. */
export type XrefAccessKind = (typeof XREF_ACCESS_KINDS)[number];

/**
 * The upper bound on one comment's text, in UTF-8 BYTES.
 *
 * Why a bound exists at all: the 64K address space caps a range naturally --
 * there is no way to ask for a range longer than the machine -- but comment text
 * caps nothing. Between an unvalidated caller argument (the transport validates
 * nothing) and unbounded blob growth in the store file, this number is the only
 * thing standing. 4096 bytes is roughly a screenful of prose per address, which
 * is more than any annotation in the corpus this store was designed against.
 */
export const MAX_COMMENT_BYTES = 4096;

/**
 * Every 6502/6510 mnemonic, lowercase, DERIVED from the real 256-entry opcode
 * table -- never hand-typed.
 *
 * Why derived matters here specifically: a hand-typed list is the documented
 * 56-name legal set, and it MISSES every illegal-opcode mnemonic the decoder
 * actually emits -- `jam`, `slo` and `lax` among them. A label named `slo`
 * would then be accepted here and rejected by the assembler at export time,
 * which is a failure a long way from its cause.
 *
 * A derivation function rather than an inline container, for two reasons. The
 * module's own purity rule (trap 3) forbids a module-level mutable container,
 * and `Object.freeze` on a `Set` is a NO-OP for its contents -- there is no
 * "frozen Set" to declare. So the `ReadonlySet` type plus a single derivation
 * site IS the contract: nothing in this module or the store writes to it.
 */
function deriveMnemonicDenylist(): ReadonlySet<string> {
  return new Set(OPCODES.map((entry) => entry.mnemonic.toLowerCase()));
}

export const MNEMONIC_DENYLIST: ReadonlySet<string> = deriveMnemonicDenylist();

/** One label as the store holds it. `bank` is reserved and interpreted by
 * nothing; every row this store writes today has it null. */
export interface LabelRow {
  id: number;
  address: number;
  name: string;
  kind: LabelKind;
  bank: number | null;
}

/** One comment as the store holds it. `text` never carries the `';'` prefix --
 * the schema instructs callers to omit it and `assertCommentText()` refuses it. */
export interface CommentRow {
  id: number;
  address: number;
  commentType: CommentType;
  text: string;
  bank: number | null;
}

/**
 * One stored comment that a retype has just made FALSE (STORE-03).
 *
 * The caller needs all four facts to act on the report without a second query:
 * WHERE the comment is, WHAT it says, WHICH grade fired, and WHICH data type
 * contradicted it. A bare address list would send every recipient straight back
 * to `listComments()`.
 *
 * `grade` is the bracket token verbatim, as `r2000-confidence.ts` spells it --
 * this store never writes a second spelling of one.
 */
export interface ContradictedComment {
  address: number;
  commentType: CommentType;
  text: string;
  grade: string;
  contradictedBy: DataType;
}

/** One scope as the store holds it. Both ends are INCLUSIVE, matching the
 * schema's own two sentences (`r2000-tools.ts:322-331`). There is no name field
 * and no nesting: the schema says nested scopes are unsupported, and the store
 * must not invent a capability the surface it mirrors does not have. */
export interface ScopeRow {
  id: number;
  start: number;
  endInclusive: number;
}

/** One project-local enum as the store holds it. `variants` is keyed by the
 * numeric-string forms the schema names -- decimal, `0x`/`$` hex, `0b`/`%`
 * binary -- and its values are variant names. */
export interface ProjectEnumRow {
  id: number;
  name: string;
  variants: Readonly<Record<string, string>>;
  description: string | null;
}

/** One cross-reference as the store holds it. Only NON-DERIVABLE references
 * live here -- see `anno-store.ts`'s `putXref` for why, and for the two
 * requirement texts that look like they conflict and do not. */
export interface XrefRow {
  id: number;
  fromAddress: number;
  toAddress: number;
  accessKind: XrefAccessKind;
  bank: number | null;
}

/** What `resolveSplitTargets()` returns: the entry count, the resolved 16-bit
 * targets in table order, and whether this layout produces cross-references at
 * all. Nothing here is ever written to disk. */
export interface SplitTargets {
  entryCount: number;
  targets: readonly number[];
  producesXrefs: boolean;
}

// ---------------------------------------------------------------------------
// The named error family. Follows `vice.ts`'s own constructor pattern: an
// `interface XErrorOptions`, plain public fields, `super(message, options)` for
// the field-free base and `super(message)` for the field-carrying subclasses
// (`vice.ts:245-292`, with `MachineRestartedError` as the field-carrying
// shape). Every subclass is an `AnnoStoreError` and therefore a `ViceError`, so
// one `catch` can take the whole family or any single member of it.
// ---------------------------------------------------------------------------

export interface AnnoStoreErrorOptions extends ViceErrorOptions {}

/** The family base: every refusal below is an instance of this. */
export class AnnoStoreError extends ViceError {
  constructor(message: string, options: AnnoStoreErrorOptions = {}) {
    super(message, options);
    this.name = "AnnoStoreError";
  }
}

export interface AnnoStoreCorruptErrorOptions {
  path?: string;
}

/** The store file is not a store: no meta row, an unreadable meta row, a
 * schema version this build does not speak, or a failed integrity check. Never
 * thrown for a store that is merely EMPTY -- that distinction is the whole
 * reason this error exists. */
export class AnnoStoreCorruptError extends AnnoStoreError {
  path?: string;

  constructor(message: string, { path }: AnnoStoreCorruptErrorOptions = {}) {
    super(message);
    this.name = "AnnoStoreCorruptError";
    this.path = path;
  }
}

export interface AnnoStoreStaleRevisionErrorOptions {
  baseRevision?: number;
  currentRevision?: number;
}

/** The write was refused because the on-disk revision is not the revision the
 * caller based its edit on. Carries both numbers so the caller can say which
 * two disagreed rather than "conflict". */
export class AnnoStoreStaleRevisionError extends AnnoStoreError {
  baseRevision?: number;
  currentRevision?: number;

  constructor(message: string, { baseRevision, currentRevision }: AnnoStoreStaleRevisionErrorOptions = {}) {
    super(message);
    this.name = "AnnoStoreStaleRevisionError";
    this.baseRevision = baseRevision;
    this.currentRevision = currentRevision;
  }
}

export interface AnnoTypeErrorOptions {
  dataType?: unknown;
  validTypes?: readonly string[];
}

/** The `dataType` argument is not one of the frozen twelve. Carries the
 * offending value AND the full valid list, so the caller never has to go
 * looking for the vocabulary. */
export class AnnoTypeError extends AnnoStoreError {
  dataType?: unknown;
  validTypes?: readonly string[];

  constructor(message: string, { dataType, validTypes }: AnnoTypeErrorOptions = {}) {
    super(message);
    this.name = "AnnoTypeError";
    this.dataType = dataType;
    this.validTypes = validTypes;
  }
}

export interface AnnoRangeShapeErrorOptions {
  start?: unknown;
  endInclusive?: unknown;
}

/** The range's shape is impossible: an end outside the address space, an end
 * below its start, or an odd byte count on a split-table layout. */
export class AnnoRangeShapeError extends AnnoStoreError {
  start?: unknown;
  endInclusive?: unknown;

  constructor(message: string, { start, endInclusive }: AnnoRangeShapeErrorOptions = {}) {
    super(message);
    this.name = "AnnoRangeShapeError";
    this.start = start;
    this.endInclusive = endInclusive;
  }
}

export interface AnnoAddressErrorOptions {
  input?: unknown;
  what?: string;
}

/** The value is not an address this store will accept. Carries the offending
 * input and the name of the field it was supplied for. */
export class AnnoAddressError extends AnnoStoreError {
  input?: unknown;
  what?: string;

  constructor(message: string, { input, what }: AnnoAddressErrorOptions = {}) {
    super(message);
    this.name = "AnnoAddressError";
    this.input = input;
    this.what = what;
  }
}

export interface AnnoStorePathErrorOptions {
  path?: string;
  workspaceRoot?: string;
}

/** The store path resolves outside the workspace root it was confined to. */
export class AnnoStorePathError extends AnnoStoreError {
  path?: string;
  workspaceRoot?: string;

  constructor(message: string, { path, workspaceRoot }: AnnoStorePathErrorOptions = {}) {
    super(message);
    this.name = "AnnoStorePathError";
    this.path = path;
    this.workspaceRoot = workspaceRoot;
  }
}

export interface AnnoLabelErrorOptions {
  /** The offending identifier, verbatim -- never a sanitised form of it.
   *
   * THE FIELD IS `identifier`, NOT `name`, and that is load-bearing rather than
   * a naming preference: `name` is `Error.prototype.name`, which every
   * constructor in this family assigns the class name to. A public `name` field
   * would overwrite `"AnnoLabelError"` with the offending label, so a `catch`
   * block asking which error it caught would be told the answer to a different
   * question. */
  identifier?: string;
  /** Which rule fired, in words -- the illegal-character rule, the mnemonic
   * denylist, or the collision. */
  reason?: string;
  /** For a collision: the address the name is already bound to. */
  existingAddress?: number;
  /** For a collision: the address the caller asked to bind it to. */
  requestedAddress?: number;
}

/**
 * An identifier -- a label name or a project-enum name -- is refused. Never
 * sanitised, never substituted, never rebound: see trap 7 for the concrete
 * silent-merge hazard that makes refusal the only safe answer.
 */
export class AnnoLabelError extends AnnoStoreError {
  identifier?: string;
  reason?: string;
  existingAddress?: number;
  requestedAddress?: number;

  constructor(message: string, { identifier, reason, existingAddress, requestedAddress }: AnnoLabelErrorOptions = {}) {
    super(message);
    this.name = "AnnoLabelError";
    this.identifier = identifier;
    this.reason = reason;
    this.existingAddress = existingAddress;
    this.requestedAddress = requestedAddress;
  }
}

export interface AnnoCommentErrorOptions {
  /** Which rule fired: the byte bound, or the semicolon prefix. */
  reason?: string;
  /** The text's UTF-8 byte length, so a caller can see how far over it was
   * rather than only that it was over. */
  byteLength?: number;
}

/**
 * Comment (or description) text is refused: over `MAX_COMMENT_BYTES` in UTF-8
 * bytes, or carrying the `';'` prefix the schema instructs callers to omit.
 * A separate class from `AnnoLabelError` because neither of its fields fits --
 * comment text is not an identifier and has no address to collide at.
 */
export class AnnoCommentError extends AnnoStoreError {
  reason?: string;
  byteLength?: number;

  constructor(message: string, { reason, byteLength }: AnnoCommentErrorOptions = {}) {
    super(message);
    this.name = "AnnoCommentError";
    this.reason = reason;
    this.byteLength = byteLength;
  }
}

export interface AnnoCommentGradeErrorOptions {
  /** The offending comment text, verbatim. */
  comment?: string;
  /** The original refusal this one wraps, kept so the diagnostic chain is not
   * broken by the wrap. */
  cause?: unknown;
}

/**
 * A stored comment carries a leading bracket token that is not one of the five
 * confidence grades, so the store cannot say whether a retype contradicts it.
 *
 * THIS CLASS EXISTS TO WRAP, AND THE WRAP IS THE DECISION. The parser that
 * detects the malformed token throws a class extending `Error` DIRECTLY, not
 * `ViceError` -- so a caller writing a single
 * `catch (e) { if (e instanceof ViceError) ... }` at the store boundary would
 * miss it, and a real refusal would escape as an unhandled rejection. The store
 * catches it and rethrows this instead, so everything the store throws is a
 * `ViceError`.
 *
 * THE COST, STATED RATHER THAN LEFT TO BE DISCOVERED: the original class is no
 * longer visible to `instanceof` at the store boundary. That is why the original
 * message is preserved VERBATIM inside this one and the original error rides on
 * `cause` -- nothing is lost from the diagnostic, only from the type. The
 * alternative -- rethrow unchanged and document the asymmetry -- was rejected
 * because it puts the burden on every future caller instead of on this one site.
 *
 * It is NEVER correct to swallow the original and treat the comment as ungraded:
 * that would quietly exempt a malformed comment from contradiction reporting,
 * which is the same silent un-documenting `STORE-03` exists to prevent.
 */
export class AnnoCommentGradeError extends AnnoStoreError {
  comment?: string;
  cause?: unknown;

  constructor(message: string, { comment, cause }: AnnoCommentGradeErrorOptions = {}) {
    super(message);
    this.name = "AnnoCommentGradeError";
    this.comment = comment;
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Validators. Each one THROWS on refusal (trap 6) and returns the narrowed
// value on acceptance.
// ---------------------------------------------------------------------------

/** Narrows an unvalidated argument to a `DataType`, or throws `AnnoTypeError`
 * carrying the offending value and the full valid list. */
export function assertDataType(value: unknown): DataType {
  if (typeof value === "string" && (DATA_TYPES as readonly string[]).includes(value)) {
    return value as DataType;
  }
  throw new AnnoTypeError(
    `data type ${JSON.stringify(value)} is not one of the ${DATA_TYPES.length} annotation data types -- expected one of: ${DATA_TYPES.join(", ")}`,
    { dataType: value, validTypes: [...DATA_TYPES] },
  );
}

/**
 * Refuses an impossible range shape. Three separate refusals, each with its
 * own message: an end outside `ADDRESS_MIN..ADDRESS_MAX`, an `endInclusive`
 * below `start`, and an ODD byte count on a split-table layout -- the schema's
 * own "even count required" rule (`r2000-tools.ts:305-313`), which is a
 * validation rule about the DATA rather than a property of the type, which is
 * why it is checked here and not encoded in `DataType`.
 */
export function assertRangeShape(start: number, endInclusive: number, dataType: DataType): void {
  const ends: readonly (readonly [string, number])[] = [
    ["start", start],
    ["endInclusive", endInclusive],
  ];
  for (const [what, value] of ends) {
    if (!Number.isInteger(value) || value < ADDRESS_MIN || value > ADDRESS_MAX) {
      throw new AnnoRangeShapeError(
        `${what} ${String(value)} is outside the address space -- expected an integer ${ADDRESS_MIN}..${ADDRESS_MAX} ($0000-$ffff)`,
        { start, endInclusive },
      );
    }
  }
  if (endInclusive < start) {
    throw new AnnoRangeShapeError(
      `endInclusive ${endInclusive} is below start ${start} -- both ends are INCLUSIVE, so a one-byte range has start === endInclusive`,
      { start, endInclusive },
    );
  }
  if (isSplitDataType(dataType) && (endInclusive - start + 1) % 2 !== 0) {
    throw new AnnoRangeShapeError(
      `a ${dataType} table needs an even byte count, but ${start}..${endInclusive} is ${endInclusive - start + 1} byte(s) -- the low half and the high half must be the same length`,
      { start, endInclusive },
    );
  }
}

/**
 * Parses `input` into a `ADDRESS_MIN..ADDRESS_MAX` address. Accepted forms: a
 * JS integer in range, a `"$hex"` string, and a `"0x"`/`"0X"` string.
 * Surrounding whitespace is trimmed.
 *
 * An UNPREFIXED numeric string such as `"1024"` is REFUSED -- see trap 4 in
 * the module header for the divergence from `stock-address.ts` and the reason
 * for it.
 */
export function parseStoreAddress(input: unknown, opts: { what?: string } = {}): number {
  const what = opts.what ?? "address";

  if (typeof input === "number") {
    if (!Number.isInteger(input) || input < ADDRESS_MIN || input > ADDRESS_MAX) {
      throw new AnnoAddressError(
        `${what}: ${String(input)} is out of range -- expected an integer ${ADDRESS_MIN}..${ADDRESS_MAX} ($0000-$ffff)`,
        { input, what },
      );
    }
    return input;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    const hexPart = trimmed.startsWith("$") ? trimmed.slice(1) : /^0[xX]/.test(trimmed) ? trimmed.slice(2) : null;
    if (hexPart !== null) {
      if (hexPart === "" || !/^[0-9a-fA-F]+$/.test(hexPart)) {
        throw new AnnoAddressError(
          `${what}: "${trimmed}" is not a valid hex address -- expected "$" or "0x" followed by hex digits, e.g. "$0810" or "0x0810"`,
          { input, what },
        );
      }
      const value = parseInt(hexPart, 16);
      if (value < ADDRESS_MIN || value > ADDRESS_MAX) {
        throw new AnnoAddressError(
          `${what}: "${trimmed}" (${value}) is out of range -- expected ${ADDRESS_MIN}..${ADDRESS_MAX} ($0000-$ffff)`,
          { input, what },
        );
      }
      return value;
    }
  }

  throw new AnnoAddressError(
    `${what}: ${JSON.stringify(input)} is not an address this store accepts -- expected an integer, a "$hex" string or a "0x" string. ` +
      `An unprefixed numeric string is refused on purpose: a mis-based address written into the store is persistent and silently wrong, ` +
      `so the base is required rather than assumed.`,
    { input, what },
  );
}

/**
 * Resolves `path` and `workspaceRoot` and returns the resolved absolute store
 * path, or throws `AnnoStorePathError` when the store path is not the
 * workspace root itself or something beneath it. Boundary-safe: the comparison
 * appends the platform separator rather than testing a bare string prefix, so
 * a sibling directory whose name merely STARTS with the root's name is refused.
 *
 * The path is deliberately NOT routed through either host/container
 * path-translation seam -- see trap 7 in `anno-store.ts`'s header for what a
 * translated store path would do.
 */
export function storePathWithinWorkspace(path: string, workspaceRoot: string): string {
  const resolvedRoot = resolve(workspaceRoot);
  const resolvedPath = resolve(path);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + sep)) {
    throw new AnnoStorePathError(
      `store path ${JSON.stringify(resolvedPath)} is outside the workspace root ${JSON.stringify(resolvedRoot)} -- refusing to open a store there`,
      { path: resolvedPath, workspaceRoot: resolvedRoot },
    );
  }
  return resolvedPath;
}

/**
 * The ONE vocabulary-membership check. Every `assert*` over a frozen string
 * vocabulary routes through here, so "is a member" has one definition and the
 * refusal message has one shape: the offending value, then the full valid list.
 *
 * `AnnoTypeError`'s `dataType` field carries the offending value whatever the
 * vocabulary was -- the field was named for the first vocabulary that needed it
 * and is deliberately not renamed, because renaming it would be a breaking
 * change to an error field for a cosmetic gain.
 */
function assertMember<T extends string>(value: unknown, members: readonly T[], what: string): T {
  if (typeof value === "string" && (members as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new AnnoTypeError(
    `${what} ${JSON.stringify(value)} is not one of the ${members.length} valid values -- expected one of: ${members.join(", ")}`,
    { dataType: value, validTypes: [...members] },
  );
}

/** Narrows an unvalidated argument to a `CommentType`, or throws
 * `AnnoTypeError` carrying the offending value and both valid members. */
export function assertCommentType(value: unknown): CommentType {
  return assertMember(value, COMMENT_TYPES, "comment type");
}

/** Narrows an unvalidated argument to a `LabelKind`, or throws `AnnoTypeError`
 * carrying the offending value and all four valid members. */
export function assertLabelKind(value: unknown): LabelKind {
  return assertMember(value, LABEL_KINDS, "label kind");
}

/** Narrows an unvalidated argument to an `XrefAccessKind`, or throws
 * `AnnoTypeError` carrying the offending value and all four valid members. A
 * fifth access kind is refused here rather than stored and puzzled over later. */
export function assertAccessKind(value: unknown): XrefAccessKind {
  return assertMember(value, XREF_ACCESS_KINDS, "access kind");
}

/** The legal-identifier shape, quoted from the schema's own sentence
 * (`r2000-tools.ts:246-251`): "starts with a letter or underscore, followed by
 * letters/digits/underscores only". Used for label names and for project-enum
 * names, which the schema calls a "unique alphanumeric identifier" and whose own
 * documented example (`vic_registers`) carries an underscore. */
const LEGAL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Refuses a label name that is not a legal ACME identifier, or that is a
 * 6502/6510 mnemonic. Returns the name UNCHANGED on acceptance.
 *
 * THREE REFUSALS AND NO NORMALISATION. There is no sanitisation, substitution,
 * trimming or quoting step in this function or anywhere on the store's write
 * path, and trap 7 states the reason as the concrete hazard: a
 * space-to-underscore substitution turns two names a human deliberately
 * distinguished into one, and the loss is silent and permanent.
 *
 * TWO DIFFERENT COMPARISONS, stated here so the store's collision check has one
 * definition to follow. The denylist comparison is CASE-INSENSITIVE -- `LDA`,
 * `lda` and `Lda` are all illegal, because all three assemble to the same
 * instruction. The comparison of one label name against another (the collision
 * check, which lives in `anno-store.ts` because it needs the rows) is EXACT BYTE
 * EQUALITY: no case folding, no Unicode normalisation, no whitespace trimming.
 * Any of those would be a normalisation, and a normalisation is what merges two
 * names.
 */
export function assertLegalLabel(name: unknown): string {
  if (typeof name !== "string" || name.length === 0) {
    throw new AnnoLabelError(
      `label name ${JSON.stringify(name)} is not a legal identifier -- expected a non-empty string starting with a letter or underscore, ` +
        `then letters, digits and underscores only. An illegal name is REFUSED, never sanitised or quoted.`,
      { identifier: typeof name === "string" ? name : undefined, reason: "not a non-empty string" },
    );
  }
  if (!LEGAL_IDENTIFIER_RE.test(name)) {
    throw new AnnoLabelError(
      `label name ${JSON.stringify(name)} is not a legal identifier -- it must start with a letter or underscore and then contain ` +
        `letters, digits and underscores only. It is REFUSED rather than rewritten: substituting a character would merge this name with ` +
        `whatever name the substitution produces, and nothing would record that it happened.`,
      { identifier: name, reason: "illegal character" },
    );
  }
  if (MNEMONIC_DENYLIST.has(name.toLowerCase())) {
    throw new AnnoLabelError(
      `label name ${JSON.stringify(name)} is a 6502/6510 mnemonic and cannot be a label -- the denylist is derived from the full ` +
        `256-entry opcode table, so it covers the illegal-opcode mnemonics too, and it is compared case-insensitively.`,
      { identifier: name, reason: "6502/6510 mnemonic" },
    );
  }
  return name;
}

/**
 * Refuses a project-enum name that is not the schema's "unique alphanumeric
 * identifier". Returns it unchanged.
 *
 * The mnemonic denylist is deliberately NOT applied: the schema's mnemonic rule
 * is scoped to LABEL names, which are the symbols an assembler sees, and
 * widening it here would refuse an enum name on a rule the surface this store
 * mirrors does not have.
 */
export function assertEnumName(name: unknown): string {
  if (typeof name !== "string" || !LEGAL_IDENTIFIER_RE.test(name)) {
    throw new AnnoLabelError(
      `project enum name ${JSON.stringify(name)} is not a legal identifier -- expected a non-empty string starting with a letter or ` +
        `underscore, then letters, digits and underscores only`,
      { identifier: typeof name === "string" ? name : undefined, reason: "illegal enum name" },
    );
  }
  return name;
}

/** The UTF-8 byte length of `text`. A `TextEncoder` and not `String.length`:
 * see trap 10 -- code units are not bytes, and the bound is a bound on the
 * bytes that land in the store file. */
function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Refuses comment text that is over `MAX_COMMENT_BYTES` UTF-8 bytes, or that
 * carries the `';'` prefix the schema tells callers to omit ("Do not include
 * the ';' prefix", `r2000-tools.ts:269`). Returns the text UNCHANGED -- an
 * over-long comment is REFUSED, never truncated, because a truncation drops
 * the end of a human's sentence and reports success.
 *
 * `allowLeadingSemicolon` exists for the one neighbouring text field with the
 * same byte bound and no semicolon rule: a project enum's free-text
 * description, which the schema does not describe as assembler comment text.
 */
export function assertCommentText(text: unknown, opts: { what?: string; allowLeadingSemicolon?: boolean } = {}): string {
  const what = opts.what ?? "comment";
  if (typeof text !== "string") {
    throw new AnnoCommentError(`${what} text ${JSON.stringify(text)} is not a string`, { reason: "not a string" });
  }
  if (opts.allowLeadingSemicolon !== true && /^\s*;/.test(text)) {
    throw new AnnoCommentError(
      `${what} text must not begin with the ';' prefix -- the store holds the comment's words and the exporter adds the prefix, ` +
        `so a stored ';' would be emitted twice`,
      { reason: "semicolon prefix" },
    );
  }
  const bytes = utf8ByteLength(text);
  if (bytes > MAX_COMMENT_BYTES) {
    throw new AnnoCommentError(
      `${what} text is ${bytes} UTF-8 bytes, over the ${MAX_COMMENT_BYTES}-byte bound -- it is REFUSED rather than truncated, ` +
        `because a truncation drops the end of a sentence somebody wrote and reports success`,
      { reason: "over MAX_COMMENT_BYTES", byteLength: bytes },
    );
  }
  return text;
}

/** The largest value a project-enum variant key may name. Bounded so a variants
 * object cannot carry an arbitrary-length key, and NOT bounded to the address
 * space, because a variant key is a VALUE -- a register bitmask or a mode
 * number -- rather than an address. */
export const MAX_VARIANT_KEY = 0xffffffff;

/**
 * Parses one project-enum variant key into its numeric value. Accepts exactly
 * the forms the schema names (`r2000-tools.ts:474`): "keys are numeric strings
 * (decimal, hex 0x/$, bin 0b/%)".
 *
 * Decimal IS accepted here, and that is not an inconsistency with
 * `parseStoreAddress()`'s refusal of `"1024"` (trap 4). The two answer different
 * questions: an ADDRESS in the wrong base points at the wrong memory and the
 * error is silent and persistent, whereas a variant key's base is stated by the
 * schema itself, so an unprefixed key has one documented reading and no
 * ambiguity to resolve.
 */
export function parseVariantKey(key: unknown): number {
  if (typeof key !== "string" || key.trim() === "") {
    throw new AnnoTypeError(
      `enum variant key ${JSON.stringify(key)} is not a numeric string -- expected decimal, "0x"/"$" hex or "0b"/"%" binary`,
      { dataType: key },
    );
  }
  const raw = key.trim();
  const forms: readonly (readonly [RegExp, number, number])[] = [
    [/^\$([0-9a-fA-F]+)$/, 16, 1],
    [/^0[xX]([0-9a-fA-F]+)$/, 16, 2],
    [/^%([01]+)$/, 2, 1],
    [/^0[bB]([01]+)$/, 2, 2],
    [/^([0-9]+)$/, 10, 0],
  ];
  for (const [pattern, radix, skip] of forms) {
    const match = pattern.exec(raw);
    if (match) {
      const value = parseInt(raw.slice(skip), radix);
      if (!Number.isInteger(value) || value < 0 || value > MAX_VARIANT_KEY) {
        throw new AnnoTypeError(
          `enum variant key ${JSON.stringify(raw)} is ${value}, outside 0..${MAX_VARIANT_KEY}`,
          { dataType: key },
        );
      }
      return value;
    }
  }
  throw new AnnoTypeError(
    `enum variant key ${JSON.stringify(raw)} is not one of the numeric-string forms the schema names -- expected decimal ("64"), ` +
      `hex ("$40" or "0x40") or binary ("%01000000" or "0b01000000")`,
    { dataType: key },
  );
}

/** True for the two `_address` split layouts, false for the two `_word` ones.
 * The schema's own distinction (`r2000-tools.ts:305-313`):
 * `address=16-bit LE pointers (creates X-Refs, ...)` versus
 * `word=16-bit LE values`. Exported separately from `resolveSplitTargets()` so
 * the store can ask the question without resolving anything. */
export function producesXrefsFor(dataType: SplitDataType): boolean {
  return dataType.endsWith("_address");
}

/**
 * Resolves a split table's bytes into its 16-bit targets. PURE: no I/O, no
 * state, and nothing it computes is ever written to disk.
 *
 * THE LAYOUT. `bytes` is the table's raw bytes; the first half is one byte of
 * each entry and the second half is the other. For the low-high orientation the
 * first half holds the LOW bytes, so target `i` is
 * `bytes[i] | (bytes[n + i] << 8)`; for the high-low orientation the first half
 * holds the HIGH bytes, so target `i` is `(bytes[i] << 8) | bytes[n + i]`.
 *
 * THE WORKED ARITHMETIC, verified during research and pinned by
 * `anno-types.test.ts`: the bytes `10 34 00 ff 08 12 c0 cf` resolve to
 * `$0810 $1234 $c000 $cfff` under `lo_hi_address` and to
 * `$1008 $3412 $00c0 $ffcf` under `hi_lo_address`. THAT DIFFERING TARGET SET IS
 * THE CONTROL for the decision to keep all four split layouts as first-class
 * members: it is the one observable consequence of recording orientation.
 *
 * WHY A BYTE-IDENTICAL REASSEMBLY ASSERTION CANNOT BE THAT CONTROL: a retype
 * changes no bytes. A reassembly comparison is therefore green under BOTH
 * orientations and can never go red on a collapsed vocabulary. It is worth
 * having separately -- it catches an exporter that mangles bytes -- but it is
 * not this claim's evidence and must not be presented as such.
 *
 * THIS FUNCTION DERIVES AND RETURNS. It never stores. See `anno-store.ts`'s
 * `putXref` for the reason a derived cross-reference must not reach the disk.
 */
export function resolveSplitTargets(bytes: Uint8Array | readonly number[], dataType: unknown): SplitTargets {
  if (typeof dataType !== "string" || !(SPLIT_DATA_TYPES as readonly string[]).includes(dataType)) {
    throw new AnnoTypeError(
      `${JSON.stringify(dataType)} is not a split-table layout -- expected one of: ${SPLIT_DATA_TYPES.join(", ")}`,
      { dataType, validTypes: [...SPLIT_DATA_TYPES] },
    );
  }
  const layout = dataType as SplitDataType;
  const source = Array.from(bytes);
  if (source.length % 2 !== 0) {
    throw new AnnoRangeShapeError(
      `a ${layout} table needs an even byte count, but ${source.length} byte(s) were supplied -- the low half and the high half must be ` +
        `the same length`,
      { start: 0, endInclusive: source.length - 1 },
    );
  }
  const n = source.length / 2;
  const lowFirst = layout.startsWith("lo_hi_");
  const targets: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const first = source[i] & 0xff;
    const second = source[n + i] & 0xff;
    targets.push(lowFirst ? first | (second << 8) : (first << 8) | second);
  }
  return { entryCount: n, targets, producesXrefs: producesXrefsFor(layout) };
}
