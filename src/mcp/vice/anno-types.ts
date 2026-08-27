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
import { resolve, sep } from "node:path";

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
