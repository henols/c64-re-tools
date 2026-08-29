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
//      frozen constant, so two concurrent callers cannot observe each other
//      and there is nothing to reset. That half of the rule is unchanged and
//      unconditional.
//      NARROWED 2026-08-28, and the reversal is the record rather than a
//      deletion. This paragraph used to end "...or a pure function of its
//      arguments", and that clause is now false for exactly ONE export:
//      `storePathWithinWorkspace()` is a function of its arguments AND THE
//      FILESYSTEM. It must be. Workspace confinement has to answer whether a
//      path lands outside the root once symbolic links are followed, and that
//      is a filesystem question that no string comparison can answer -- the
//      earlier pure-string version accepted a symlinked subdirectory and let a
//      store file be created outside the workspace root (`28-VERIFICATION.md`
//      gap 3 / `28-REVIEW.md` CR-03, reproduced). Every OTHER export is still
//      a pure function of its arguments and still unit-testable with no file
//      on disk. The exception is named here, in `storePathWithinWorkspace`'s
//      own doc comment, and in `anno-types.test.ts`'s mutable-state assertion
//      message, so no reader can find a place that still claims total purity.
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
import { existsSync, lstatSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";

import { OPCODES } from "./disasm-opcodes.ts";
import { ViceError, type ViceErrorOptions } from "./vice.ts";

/**
 * The on-disk schema version every store file carries in `anno_meta`. A
 * store whose `schema_version` is not this exact value is REFUSED, never
 * silently upgraded.
 *
 * VERSION 2, AND THE REVERSAL IS RECORDED RATHER THAN SILENTLY OVERWRITTEN,
 * because a rationale that became false is evidence (`anno-store.ts`'s header
 * discipline, 28-07 P3).
 *
 * The sentence still true: a store whose declared version is not this exact
 * value is refused by name, never upgraded in place.
 *
 * The sentence that became false: this constant was `1`, and the DDL beside it
 * claimed "`SCHEMA_VERSION` stays 1 and no later work alters an on-disk shape".
 * Version 1 named a snapshot through a PERSISTED ABSOLUTE STRING in
 * `anno_snapshot.path`, inside a ring directory whose name was the fixed
 * `<dir>/snapshots`. Two consequences were reproduced against committed code:
 *
 *   * TWO STORES IN ONE DIRECTORY SHARED ONE RING under the same
 *     `r<revision>.db` filenames, so `revertTo` on one store restored the
 *     OTHER store's whole database, silently and with no error (CR-01).
 *   * RENAMING THE CONTAINING DIRECTORY invalidated every persisted absolute
 *     path at once, after which `retainedRevisions()` reported none and the
 *     next accepted write's prune destroyed the entire revert history (CR-03).
 *
 * Version 2 drops `anno_snapshot.path` -- there is no persisted string left for
 * a second namespace to disagree with -- and derives the location from the
 * handle at every read and every delete via `snapshotDirFor()`.
 *
 * A VERSION-1 STORE IS REFUSED, NOT UPGRADED, and the reason is that the
 * version-1 ring's OWNERSHIP is not recoverable: CR-01 means two stores may
 * both have written into `<dir>/snapshots`, and nothing recorded which file
 * belonged to which store. Any migration would have to guess, attributing one
 * store's history to another -- CR-01 again with a new cause and no test
 * watching. The legacy directory is therefore left on disk untouched: never
 * adopted, never migrated, never deleted, so the bytes stay recoverable by
 * hand.
 *
 * ---------------------------------------------------------------------------
 * VERSION 3, 2026-08-29 (D-15) -- AND THE COST IS NAMED HERE RATHER THAN LEFT
 * IN A PLANNING DIRECTORY, because a version number whose rationale lives
 * somewhere else is a number the next reader has no way to weigh.
 *
 * WHAT THE BUMP BUYS: `anno_enum_usage`, the table that associates ONE address
 * with ONE `anno_enum` row, which is what `r2000_apply_enum_usage`'s route
 * needs and what version 2 had nowhere to put. The association is by enum
 * **id**, never by enum name, so `updateProjectEnum`'s rename can neither
 * orphan a usage nor silently re-point it at a different enum.
 *
 * NO MIGRATION ARM WAS WRITTEN, AND THAT IS THE ACCEPTED COST: every
 * version 2 store on disk is permanently unopenable. The refusal below stays a
 * SINGLE-WITNESS refusal -- one comparison site in `openStore`, no upgrade
 * path, no silent re-write of `anno_meta`. The basis measured on the day of the
 * decision: no store file is tracked in this repository and none exists in its
 * working tree, the store's own module landed 2026-08-27, the version 2 shape
 * landed 2026-08-28, and the last release tag (`v0.5.0`, 2026-08-25) PREDATES
 * the store entirely -- so no tagged release has ever shipped a store at all.
 * Any store that would be stranded is in a user's own project and outside this
 * repository's reach by construction; that is an assumption, flagged rather
 * than asserted.
 *
 * THE VERSION 1 PARAGRAPH ABOVE IS THE PRECEDENT THIS IS MEASURED AGAINST, and
 * the two refusals are NOT the same kind. Version 1 could not be migrated even
 * in principle -- the ring's ownership was unrecoverable, so a migration would
 * have had to guess. Version 3 COULD have been given a migration arm and
 * deliberately was not, because one bought now protects stores that may not
 * exist, and it would put new code into a module six hardening rounds went
 * into. Stating the difference is the point: this one is a choice, not an
 * impossibility.
 */
export const SCHEMA_VERSION = 3;

/** The 6510's address space, inclusive at both ends. */
export const ADDRESS_MIN = 0x0000;
export const ADDRESS_MAX = 0xffff;

/** How many pre-mutation snapshots the store's own snapshot ring directory
 * (`anno-store.ts`'s `snapshotDirFor()` -- a sibling named after the store
 * FILE, not the fixed `<dir>/snapshots` version 1 used) may hold before the
 * oldest is pruned. Declared here because the bound is a property of the
 * store's format; the pruning that enforces it belongs to the revert surface
 * (`STORE-04`). */
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

/**
 * One entry-address pairing of a split table (STORE-03, CR-10).
 *
 * `pairs[i]` is the two ADDRESSES whose bytes form entry `i`, in table order:
 * the first-half address and its second-half partner. `entryCount` is
 * `pairs.length`, restated as a field so a caller can assert the count without
 * reading the array -- the same shape convention `SplitTargets` uses.
 */
export interface SplitEntryPairs {
  entryCount: number;
  pairs: readonly (readonly [number, number])[];
}

/**
 * One surviving fragment of a split table that a partial overwrite left behind
 * (CR-10). `entryPairs` is what that fragment reads NOW -- not what the addresses
 * in it used to be paired with.
 */
export interface SplitTableSurvivor {
  start: number;
  endInclusive: number;
  entryCount: number;
  entryPairs: readonly (readonly [number, number])[];
}

/**
 * What one accepted partial overwrite of a split table COST, reported as data on
 * a successful `setDataType()` result (STORE-03, CR-10). Documented in the same
 * register as `ContradictedComment` above, and for the same reason: a caller
 * needs every fact it would otherwise have to re-query for.
 *
 * WHY THIS RECORD EXISTS AT ALL. A split table's layout is
 * first-half/second-half, so an entry's partner is a function of the row's START
 * and its LENGTH (see `resolveSplitTargets()` below). Changing either end
 * re-pairs EVERY entry: a surviving fragment of `m` entries pairs its own byte
 * `j` with its own byte `m + j`, which matches an original pair only when
 * `m == n` -- only when the fragment IS the whole row. **No proper fragment of a
 * split table preserves a single entry pair, at any boundary, the midpoint
 * included.** The surviving rows are still legal and still decode; they decode to
 * DIFFERENT 16-bit values than the ones a human recorded. Preservation is
 * therefore not recoverable by a cleverer boundary rule, and the only two honest
 * answers are to refuse the edit or to disclose its cost. This record is the
 * disclosure.
 *
 * BOTH OF THE NUMBERS THAT CONFLICTED are carried (28-08 P2): `entryPairsBefore`
 * is what the table read before the write, each survivor's `entryPairs` is what
 * that fragment reads after, and `preservedEntryPairs` is their intersection --
 * COMPUTED by comparing the two sets, never assumed. It is empty today as a
 * consequence of the layout; a computed field stays correct if a future layout
 * changes that.
 */
export interface SplitTableReinterpretation {
  rowId: number;
  rowStart: number;
  rowEndInclusive: number;
  dataType: SplitDataType;
  entryCountBefore: number;
  entryPairsBefore: readonly (readonly [number, number])[];
  survivors: readonly SplitTableSurvivor[];
  preservedEntryPairs: readonly (readonly [number, number])[];
  summary: string;
}

/** One scope as the store holds it. Both ends are INCLUSIVE, matching the
 * schema's own two sentences (`r2000-tools.ts:322-331`). There is no name field
 * and no nesting: the schema says nested scopes are unsupported, and the store
 * must not invent a capability the surface it mirrors does not have. That last
 * claim is ENFORCED rather than merely asserted -- `addScope()` in
 * `anno-store.ts` refuses a nested or overlapping range with an
 * `AnnoRangeShapeError` naming both scopes; see its doc comment for the rule. */
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

/**
 * One enum usage as the store holds it: the association between ONE address
 * and ONE project enum, added at `SCHEMA_VERSION` 3 (D-15).
 *
 * `enumId` IS WHAT THE STORE PERSISTS; `enumName` is resolved through the join
 * at read time and is never a second on-disk copy of the name. A row that
 * persisted the NAME would be re-pointed silently by `updateProjectEnum`'s
 * rename -- the usage would follow whatever enum next took the old name -- and
 * the disagreement would be invisible because both answers look authoritative.
 * `bank` is the same reserved, uninterpreted column every other row type
 * carries.
 */
export interface EnumUsageRow {
  id: number;
  address: number;
  enumId: number;
  enumName: string;
  bank: number | null;
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

export interface AnnoRevisionArgumentErrorOptions {
  /** The offending value, EXACTLY as it was supplied -- unconverted, so a
   * caller can see that what it passed was a string. */
  value?: unknown;
  /** The parameter it was supplied for, so one class can serve more than one
   * revision-shaped argument without the message having to say which. */
  parameter?: string;
}

/**
 * A REVISION-SHAPED ARGUMENT THAT IS NOT A REVISION: a numeric string, a
 * negative number, a fraction, `NaN`. Thrown before any SQL runs and before any
 * path is built, so nothing has been read and nothing has been written.
 *
 * WHY THIS IS NOT `AnnoStoreCorruptError`, WHICH IS THE WHOLE REASON THE CLASS
 * EXISTS (WR-22). Until this class existed, `revertTo(handle, "0001")` matched
 * revision 1's pointer row through SQLite's INTEGER affinity on a bound TEXT
 * operand, while `snapshotPathFor` built `r0001.db` from the raw string -- so
 * the two disagreed and the caller was told its snapshot was "not a readable
 * annotation store". That is a CORRUPTION refusal produced by an ARGUMENT
 * error, and `AnnoStoreCorruptError`'s own doc comment forbids exactly that
 * confusion in as many words: "the annotations are gone" and "there are no
 * annotations" must not read the same. Neither must "you passed the wrong
 * thing".
 *
 * WHY IT IS NOT `AnnoStoreStaleRevisionError` EITHER. That class carries the
 * TWO revisions that conflicted (28-08 P2's shape: never report a conflict
 * without both of the numbers). An argument error has no second revision --
 * nothing moved and nothing disagreed -- so reusing it would force the class to
 * carry a number the caller never supplied and this code never had.
 *
 * A caller therefore tells the three apart BY CLASS, never by substring-matching
 * a message.
 */
export class AnnoRevisionArgumentError extends AnnoStoreError {
  value?: unknown;
  parameter?: string;

  constructor(message: string, { value, parameter }: AnnoRevisionArgumentErrorOptions = {}) {
    super(message);
    this.name = "AnnoRevisionArgumentError";
    this.value = value;
    this.parameter = parameter;
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

export interface AnnoSplitRemainderErrorOptions extends AnnoRangeShapeErrorOptions {
  /** The overlapped row the split would fragment. */
  rowId?: number;
  rowStart?: number;
  rowEndInclusive?: number;
  /** The overlapped row's own type -- the type the remainder would inherit. */
  dataType?: DataType;
  /** The remainder the store refused to write. */
  remainderStart?: number;
  remainderEndInclusive?: number;
  /** Which end of the overlapped row the illegal remainder is. */
  side?: "head" | "tail";
}

/**
 * A split-and-preserve remainder is not a legal shape for the type it would
 * carry, so the whole retype is refused. Carries the overlapped row's identity
 * AND the illegal remainder's, because a conflict reported with only one of the
 * two numbers that conflicted is not a report.
 *
 * WHY IT EXTENDS `AnnoRangeShapeError` RATHER THAN `AnnoStoreError` DIRECTLY,
 * and this is deliberate, not incidental: it really IS a shape refusal -- the
 * SAME rule `assertRangeShape()` applies, asked about a range the store is about
 * to write on its own initiative rather than one the caller supplied. Sitting it
 * in the shape family means every existing `instanceof AnnoRangeShapeError`
 * caller keeps working when the store starts refusing on this new path, and a
 * caller that wants to distinguish the two asks for this class by name.
 */
export class AnnoSplitRemainderError extends AnnoRangeShapeError {
  rowId?: number;
  rowStart?: number;
  rowEndInclusive?: number;
  dataType?: DataType;
  remainderStart?: number;
  remainderEndInclusive?: number;
  side?: "head" | "tail";

  constructor(message: string, options: AnnoSplitRemainderErrorOptions = {}) {
    super(message, { start: options.start, endInclusive: options.endInclusive });
    this.name = "AnnoSplitRemainderError";
    this.rowId = options.rowId;
    this.rowStart = options.rowStart;
    this.rowEndInclusive = options.rowEndInclusive;
    this.dataType = options.dataType;
    this.remainderStart = options.remainderStart;
    this.remainderEndInclusive = options.remainderEndInclusive;
    this.side = options.side;
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
 * The maximum number of DANGLING-symlink hops `realpathOfNearestExisting` will
 * take before refusing. 40 is not an arbitrary comfort number: it is Linux's own
 * `MAXSYMLINKS`, so a chain this walk refuses is a chain the kernel would refuse
 * too, and the two disagree about no input.
 *
 * The bound exists because a CYCLE (`a -> b`, `b -> a`) is otherwise an infinite
 * loop inside a function whose input arrives UNVALIDATED from the transport (see
 * this module's header). `realpathSync` gets `ELOOP` from the kernel for free;
 * the manual hop below is ours, so the bound has to be ours too.
 */
const MAX_SYMLINK_HOPS = 40;

/**
 * Does the path ENTRY `p` exist -- that is, does this NAME exist in its
 * directory?
 *
 * THIS IS THE WHOLE OF `CR-04`, in two sentences. `existsSync` answers a
 * different question: "does this path RESOLVE to something?", which follows
 * symbolic links and therefore reports `false` for a dangling one. `lstat`
 * answers "does this NAME exist?", which does not follow the link. The two
 * answers differ for exactly one input class -- a symlink whose target is absent
 * -- and confinement has always needed the second question while asking the
 * first.
 *
 * `throwIfNoEntry: false` makes the ABSENT case a value rather than an
 * exception, so the caller has one branch instead of a `try` around a
 * predicate. That option suppresses `ENOENT` AND NOTHING ELSE, which is the
 * whole of `WR-12`.
 *
 * REVERSED 2026-08-28, and the reversal is the record rather than a deletion
 * (this module's header discipline, 28-07 P3). The premise that was RIGHT and
 * stays: the walk must stop at a path ENTRY, and only `lstat` can see one --
 * `existsSync` follows links and cannot. The sentence that became FALSE: that
 * swapping `existsSync` for `lstatSync` changed only which QUESTION was asked.
 * It also changed what happens when the question cannot be answered.
 * `existsSync` swallowed every error and returned `false`; `lstatSync` with
 * `throwIfNoEntry: false` swallows `ENOENT` only. So three ORDINARY caller
 * inputs regressed from a named `AnnoStorePathError` to a bare `Error`
 * escaping the `ViceError` family entirely -- measured on Node 22.22, at the
 * predicate AND through `openStore`, both:
 *
 *   * `ENOTDIR` -- an ancestor that is a regular file (`<ws>/notes.txt/p.annostore`),
 *     which needs no symlink, no privilege and nothing pre-existing;
 *   * `EACCES` -- an unreadable ancestor directory;
 *   * `ELOOP`  -- a symlink cycle in an ANCESTOR position, where the kernel
 *     refuses at `lstat` before the manual hop counter below ever runs.
 *
 * `28-REVIEW.md` WR-12 has the before/after transcript. The `try` restores the
 * family WITHOUT restoring the old blindness: the absent case is still a value
 * and still one branch, and everything else is a decision naming both the entry
 * the walk stopped on and the path being confined.
 */
function pathEntryExists(p: string, resolved: string): boolean {
  try {
    return lstatSync(p, { throwIfNoEntry: false }) !== undefined;
  } catch (e) {
    throw new AnnoStorePathError(
      `cannot stat ${JSON.stringify(p)} while confining ${JSON.stringify(resolved)} (${(e as Error).message})`,
      { path: resolved },
    );
  }
}

/**
 * Returns the REAL absolute path of `p`, resolved through the deepest ancestor
 * whose path ENTRY exists on disk, with the non-existent tail re-joined after
 * it.
 *
 * WHY THE WALK. The common case is a store file that does NOT exist yet -- the
 * store is created on first open -- so a bare `realpathSync(p)` would throw
 * `ENOENT` on exactly the path this module most needs to check. The walk stops
 * at the first existing ancestor, resolves THAT, and re-joins the remaining
 * segments afterwards, so the answer is the path the filesystem will actually
 * use once the tail is created.
 *
 * WHY THE TAIL IS RE-JOINED AFTER the real ancestor rather than before: the
 * symlinks that matter are the ones already on disk, and they are all in the
 * existing prefix. Re-joining after resolution is what makes the returned value
 * the location a write lands at, which is the only thing confinement can
 * honestly compare.
 *
 * REVERSED 2026-08-28, and the reversal is the record rather than a deletion
 * (this module's header discipline, 28-07 P3). The premise that was RIGHT and
 * stays: the deepest EXISTING ancestor is the correct stopping point, and the
 * tail belongs after it. The sentence that became FALSE: this walk used to stop
 * at "the first path that `existsSync` reports present". `existsSync` FOLLOWS
 * links, so it reports `false` for a dangling one, and the walk stepped straight
 * PAST the link instead of stopping at it -- after which the confinement
 * compared a path the filesystem would later resolve somewhere else entirely.
 * Reproduced against committed code at `a8187d2`: a dangling leaf link written
 * `../outside/p.annostore` was ACCEPTED (`A) confinement ACCEPTED, returned:
 * /tmp/annosym-XXXX/ws/p.annostore`) and `openStore` created the store file
 * OUTSIDE the workspace root (`A) file created OUTSIDE workspace: true`);
 * separately, a dangling DIRECTORY link was accepted at the predicate
 * (`B dangling dir -> ACCEPTED`). `28-VERIFICATION.md` gap 2 / `28-REVIEW.md`
 * CR-04. The walk now stops on `pathEntryExists`, which is `lstat` and does not
 * follow the link.
 *
 * THE DANGLING STOPPING ENTRY IS RESOLVED BY HAND, because nothing else will:
 * `realpathSync` cannot resolve a chain whose end does not exist. The hop reads
 * the link and resolves its target AGAINST THE LINK'S OWN DIRECTORY, never
 * against the process cwd -- a relative target (`../outside/x`) is the common
 * form, and resolving it against the cwd is the one way a naive `readlinkSync`
 * fix gets this wrong. `tail` is deliberately NOT touched by a hop: the link's
 * own name is CONSUMED by the hop, and the segments below it still hang below
 * whatever the link resolves to. After the hop the loop re-enters the same walk,
 * so a CHAIN of dangling links is this one case repeated rather than a new one,
 * and a hop that lands on a LIVE entry falls through to `realpathSync`, which
 * resolves the rest of the chain itself. There is no third state.
 *
 * Nothing exists anywhere on the path (the walk reached the filesystem root):
 * there is nothing to resolve, so the answer is built from `current` and `tail`.
 * Those two are equal to the pre-walk `resolved` when no hop has happened, and
 * AFTER a hop `resolved` describes a path the walk is no longer on -- returning
 * it there would be a stale answer about the wrong location.
 *
 * Every `realpathSync`, `lstatSync` and `readlinkSync` failure is rethrown as
 * `AnnoStorePathError` naming the path, so a permission error resolving an
 * ancestor stays inside the `ViceError` family instead of escaping as a bare
 * `Error`.
 */
function realpathOfNearestExisting(p: string): string {
  const resolved = resolve(p);
  const tail: string[] = [];
  let current = resolved;
  let hops = 0;

  for (;;) {
    let reachedFilesystemRoot = false;
    while (!pathEntryExists(current, resolved)) {
      const parent = dirname(current);
      if (parent === current) {
        reachedFilesystemRoot = true;
        break;
      }
      tail.unshift(basename(current));
      current = parent;
    }
    if (reachedFilesystemRoot) {
      return tail.length === 0 ? current : join(current, ...tail);
    }

    // The stopping ENTRY exists. Is it a symlink whose target does not? That is
    // the one class `existsSync` could not see, and the only one needing a hop.
    let stoppedAtDanglingLink: boolean;
    try {
      stoppedAtDanglingLink = lstatSync(current).isSymbolicLink() && !existsSync(current);
    } catch (e) {
      throw new AnnoStorePathError(
        `cannot stat ${JSON.stringify(current)} while confining ${JSON.stringify(resolved)} (${(e as Error).message})`,
        { path: resolved },
      );
    }

    if (stoppedAtDanglingLink) {
      hops += 1;
      if (hops > MAX_SYMLINK_HOPS) {
        throw new AnnoStorePathError(
          `cannot resolve ${JSON.stringify(resolved)}: more than ${MAX_SYMLINK_HOPS} symbolic-link hops while resolving ` +
            `${JSON.stringify(current)} -- a symlink cycle or an over-long chain, refused rather than followed`,
          { path: resolved },
        );
      }
      let link: string;
      try {
        link = readlinkSync(current);
      } catch (e) {
        throw new AnnoStorePathError(
          `cannot read the symbolic link ${JSON.stringify(current)} while confining ${JSON.stringify(resolved)} (${(e as Error).message})`,
          { path: resolved },
        );
      }
      // Against the LINK'S directory, never the process cwd.
      current = resolve(dirname(current), link);
      continue;
    }

    let real: string;
    try {
      real = realpathSync(current);
    } catch (e) {
      throw new AnnoStorePathError(
        `cannot resolve the real path of ${JSON.stringify(current)} while confining ${JSON.stringify(resolved)} (${(e as Error).message})`,
        { path: resolved },
      );
    }
    return tail.length === 0 ? real : join(real, ...tail);
  }
}

/**
 * Resolves `path` and `workspaceRoot` to REAL paths and returns the resolved
 * absolute store path, or throws `AnnoStorePathError` when the store path is
 * not the workspace root itself or something beneath it. Boundary-safe: the
 * comparison appends the platform separator rather than testing a bare string
 * prefix, so a sibling directory whose name merely STARTS with the root's name
 * is refused.
 *
 * BOTH SIDES GO THROUGH `realpathOfNearestExisting`, and that is the
 * load-bearing detail rather than a symmetry preference:
 *
 *   * The PATH must be a real path, because `resolve()` normalises `..` but
 *     does NOT follow symbolic links. The pure-string version accepted a
 *     symlinked subdirectory inside the workspace and the store file was
 *     created outside the root (`28-REVIEW.md` CR-03, reproduced by the phase
 *     verifier). A confinement check has to compare what the filesystem will
 *     actually do.
 *   * The ROOT must go through the SAME walk, for two independent reasons. A
 *     workspace root that does not exist is a legitimate input -- the pinned
 *     case in `anno-store.test.ts` passes `<dir>/nested`, which is never
 *     created -- and a bare `realpathSync` on it throws a raw `ENOENT`,
 *     replacing a clean named refusal with a non-family error. And resolving
 *     only ONE side makes every path look foreign whenever the root itself is
 *     reached through a symlink, which is the common case on hosts where the
 *     temp directory is a link.
 *
 * BEHAVIOURAL CONSEQUENCE, intended and tested: because this returns the real
 * path, a store reached through a symlink that points INSIDE the workspace is
 * FOLLOWED, and the file lands at the link's real location rather than through
 * the link. The alternative -- refusing every symlink -- would refuse
 * legitimate layouts, and is the over-broad fix that
 * `anno-confinement.test.ts` discriminates against: a control that only ever
 * refuses is indistinguishable from one that works.
 *
 * This is the ONE export in this module that is a function of its arguments AND
 * the filesystem; see the narrowed trap 3 in the header.
 *
 * The path is deliberately NOT routed through either host/container
 * path-translation seam -- see trap 7 in `anno-store.ts`'s header for what a
 * translated store path would do. `node:fs` is a Node builtin, not a seam, and
 * `hostpath-consumers.test.ts`'s closed consumer set still excludes this
 * module.
 */
export function storePathWithinWorkspace(path: string, workspaceRoot: string): string {
  const resolvedRoot = realpathOfNearestExisting(workspaceRoot);
  const resolvedPath = realpathOfNearestExisting(path);
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
  const layout = assertSplitLayout(dataType);
  const source = Array.from(bytes);
  const lowFirst = layout.startsWith("lo_hi_");
  const targets: number[] = [];
  // THE PARTNER RULE IS NOT RE-DERIVED HERE. The offset couples come from
  // `splitPartnerOffsets()`, which is the one place in the repo that knows an
  // entry's partner -- and which raises this function's own odd-byte-count
  // refusal, so the message and the rule stay together.
  for (const [firstOffset, secondOffset] of splitPartnerOffsets(source.length, layout)) {
    const first = source[firstOffset] & 0xff;
    const second = source[secondOffset] & 0xff;
    targets.push(lowFirst ? first | (second << 8) : (first << 8) | second);
  }
  return { entryCount: targets.length, targets, producesXrefs: producesXrefsFor(layout) };
}

/**
 * THE ONE PLACE IN THIS REPO WHERE AN ENTRY'S PARTNER IS COMPUTED.
 *
 * Returns the ordered offset couples `[i, n + i]` for `i` in `0..n-1`, with
 * `n = byteCount / 2` -- the first-half/second-half layout, expressed once.
 *
 * ITS TWO CONSUMERS, NAMED because a third would defeat the point:
 *   * `resolveSplitTargets()` above, which reads BYTES at those offsets;
 *   * `splitEntryAddressPairs()` below, which reads ADDRESSES at them, and is
 *     what `anno-store.ts`'s `retype()` gate consults before it fragments a
 *     split row.
 *
 * A resolver and a writer that each kept their own copy of this arithmetic could
 * disagree about what an entry IS, and the disagreement would be silent: both
 * copies produce legal, decodable rows. That is CR-10's whole class, so the rule
 * has one home. `anno-types.test.ts`'s worked-arithmetic pin is the control --
 * changing the couples here to an interleaved `[2i, 2i + 1]` reddens it.
 *
 * The odd-count refusal lives here for the same reason: it is the SAME rule
 * stated as a precondition, and `assertRangeShape()` asks it of an address span
 * while this asks it of a byte count.
 */
function splitPartnerOffsets(byteCount: number, layout: SplitDataType): readonly (readonly [number, number])[] {
  if (byteCount % 2 !== 0) {
    throw new AnnoRangeShapeError(
      `a ${layout} table needs an even byte count, but ${byteCount} byte(s) were supplied -- the low half and the high half must be ` +
        `the same length`,
      { start: 0, endInclusive: byteCount - 1 },
    );
  }
  const n = byteCount / 2;
  const offsets: (readonly [number, number])[] = [];
  for (let i = 0; i < n; i += 1) offsets.push([i, n + i] as const);
  return offsets;
}

/** Refuses anything that is not one of the four split layouts, with the full
 * list. Extracted so `resolveSplitTargets()` and `splitEntryAddressPairs()`
 * refuse a non-split type in exactly one way rather than two. */
function assertSplitLayout(dataType: unknown): SplitDataType {
  if (typeof dataType !== "string" || !(SPLIT_DATA_TYPES as readonly string[]).includes(dataType)) {
    throw new AnnoTypeError(
      `${JSON.stringify(dataType)} is not a split-table layout -- expected one of: ${SPLIT_DATA_TYPES.join(", ")}`,
      { dataType, validTypes: [...SPLIT_DATA_TYPES] },
    );
  }
  return dataType as SplitDataType;
}

/**
 * The two ADDRESSES whose bytes form each entry of the split table occupying
 * `start..endInclusive`, in table order. PURE: no I/O, no state, no bytes.
 *
 * WHY THE STORE NEEDS ADDRESSES RATHER THAN RESOLVED VALUES. The store holds no
 * bytes -- it holds spans and types, and the emulator or the image holds what is
 * in them. So the preservation question the store can answer FOR ITSELF is not
 * "did this entry's 16-bit value survive" (it cannot know the value) but "does
 * this entry still read the same two addresses". That is the question
 * `retype()`'s gate asks before it fragments a split row, and it is answerable
 * from the row's span alone.
 *
 * ORDERING IS LOAD-BEARING, the same split `setDataType()` makes: the TYPE gate
 * runs first (is this a split layout at all), then the RANGE gate
 * (`assertRangeShape`, which owns the even-byte-count rule for an address span).
 * Collapsing them would make a caller unable to tell "that is not a split
 * layout" from "those two ends do not make a split table".
 */
export function splitEntryAddressPairs(start: number, endInclusive: number, dataType: SplitDataType): SplitEntryPairs {
  const layout = assertSplitLayout(dataType);
  assertRangeShape(start, endInclusive, layout);
  const pairs = splitPartnerOffsets(endInclusive - start + 1, layout).map(
    ([first, second]) => [start + first, start + second] as const,
  );
  return { entryCount: pairs.length, pairs };
}
