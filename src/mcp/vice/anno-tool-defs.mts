#!/usr/bin/env node
// anno-tool-defs.mts
//
// WHY THIS FILE EXISTS: the curated `anno_*` tool surface without its
// engine -- the verb list and the file arguments each verb names, the
// allow-list derived from it, every per-verb argument validator, and the
// staged-file vocabulary. The verbs run through `anno call`; their
// arguments are documented in the c64-annotations skill. A client validates a
// call and finds its file arguments here without loading the store; the
// engine (`anno-tools.mts`) dispatches the same definitions against a handle.
//
// WHAT NOT TO DO:
//   - Never import the store, directly or through another module. A client
//     loads this file, and a client never opens the annotation database.
//   - Never hand-type a second list of curated names: `CURATED_ANNO_TOOLS` is
//     derived from `ANNO_TOOL_DEFINITIONS`.
import { AnnoRevisionArgumentError, AnnoStoreError, assertCommentText, assertCommentType, assertDataType, assertEnumName, assertLabelKind, assertLegalLabel, assertRangeShape, parseStoreAddress, type AnnoStoreErrorOptions } from "./anno-types.mts";
import type { ConstWriteFact } from "./anno-import.mts";

/** One curated verb: its name, and the argument keys that name a file the
 * CLIENT reads and stages. */
export interface AnnoToolDefinition {
  name: string;
  clientFiles: readonly string[];
}

/** One call's answer: its text, and whether it is a failure. */
export interface ToolCallResult {
  content: { type: "text"; text: string }[];
  isError: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function okText(text: string): ToolCallResult {
  return { content: [{ type: "text", text }], isError: false };
}

/** The one spelling of a failed call or batch entry, named by class so a
 * caller can tell an `AnnoStoreCorruptError` from an `AnnoToolArgumentError`
 * from the text alone. The verb is named once: a message that already starts
 * with it ("anno_x refused: ...") is used as it is. */
export function failureText(name: string, err: unknown): string {
  const errName = err instanceof Error ? err.name : "Error";
  const errMessage = err instanceof Error ? err.message : String(err);
  return errMessage.startsWith(`${name} `) ? `[${errName}] ${errMessage}` : `[${errName}] ${name} failed: ${errMessage}`;
}

/** `failureText` as a failed call's answer. Shared with `anno-call-client.ts`,
 * whose own refusals must read the same. */
export function toolFailure(name: string, err: unknown): ToolCallResult {
  return { content: [{ type: "text", text: failureText(name, err) }], isError: true };
}

// ---------------------------------------------------------------------------
// Refusals. Both are `AnnoStoreError` subclasses and therefore `ViceError`s --
// never a bare `Error` -- so one `catch` can take the whole family, and the
// runner's `[${errName}]` prefix below names which member fired.
// ---------------------------------------------------------------------------

export interface AnnoUncuratedToolErrorOptions extends AnnoStoreErrorOptions {
  toolName?: string;
  batchIndex?: number;
}

/** A tool name outside `CURATED_ANNO_TOOLS` was dispatched, directly or as an
 * inner call of a batch. The message names BOTH resolution routes, so the
 * refusal is actionable without reading this file. */
export class AnnoUncuratedToolError extends AnnoStoreError {
  toolName?: string;
  batchIndex?: number;

  constructor(message: string, { toolName, batchIndex, ...rest }: AnnoUncuratedToolErrorOptions = {}) {
    super(message, rest);
    this.name = "AnnoUncuratedToolError";
    this.toolName = toolName;
    this.batchIndex = batchIndex;
  }
}

export interface AnnoToolArgumentErrorOptions extends AnnoStoreErrorOptions {
  toolName?: string;
  argument?: string;
  batchIndex?: number;
}

/** A curated tool was called with an argument the transport cannot have
 * checked. `vice-proxy.ts:3230`'s `validate: (value) => ({ value })` means the
 * MCP transport validates NOTHING -- `required` in an `inputSchema` is
 * documentation for the model, not an enforced contract -- so every required
 * argument is re-checked here, at the only boundary that actually runs. */
export class AnnoToolArgumentError extends AnnoStoreError {
  toolName?: string;
  argument?: string;
  batchIndex?: number;

  constructor(message: string, { toolName, argument, batchIndex, ...rest }: AnnoToolArgumentErrorOptions = {}) {
    super(message, rest);
    this.name = "AnnoToolArgumentError";
    this.toolName = toolName;
    this.argument = argument;
    this.batchIndex = batchIndex;
  }
}

// ---------------------------------------------------------------------------
// Shared argument helpers. `batchIndex` is threaded through EVERY validator so
// one refusal message serves both call routes: `anno_set_label_name refused:`
// when the verb was called directly, `anno_set_label_name refused (calls[3]):`
// when it was smuggled inside a batch payload. That is the shared-validator
// discipline `anno-tools.mts:790-800` records -- one validator per verb, called
// from both sites, so a refusal fires identically either way.
// ---------------------------------------------------------------------------

export function argBag(args: unknown): Record<string, unknown> {
  return isPlainObject(args) ? args : {};
}

function whereOf(batchIndex?: number): string {
  return batchIndex !== undefined ? ` (calls[${batchIndex}])` : "";
}

function refuseArg(name: string, argument: string, detail: string, batchIndex?: number): never {
  throw new AnnoToolArgumentError(`${name} refused${whereOf(batchIndex)}: ${detail}`, { toolName: name, argument, batchIndex });
}

/** Narrows `max_results` to a positive integer. Required, with no default:
 * see the description on each list-returning definition for why a silent
 * default is worse than a refusal here. */
export function assertMaxResults(name: string, args: unknown, batchIndex?: number): number {
  const raw = argBag(args).max_results;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    refuseArg(
      name,
      "max_results",
      `"max_results" must be a positive integer, got ${JSON.stringify(raw)} -- it is REQUIRED and has no default on ` +
        "this surface, so a truncated answer is always an explicit ceiling.",
      batchIndex,
    );
  }
  return raw as number;
}

/** `anno_evid_disagreements`'s own OPTIONAL `max_results` (plan 43-06).
 * Unlike every other list-returning verb (`assertMaxResults` above, REQUIRED
 * with no default), an unbounded disagreement report is the ordinary case: a
 * sound store often disagrees nowhere at all, and forcing a ceiling on a
 * legitimately small or empty answer would buy nothing. When SUPPLIED, the
 * bound and refusal wording are the SAME as `assertMaxResults`'s -- this is
 * not a second, looser rule, only an optional one. */
export function assertOptionalMaxResults(name: string, args: unknown, batchIndex?: number): number | undefined {
  const raw = argBag(args).max_results;
  if (raw === undefined) return undefined;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    refuseArg(name, "max_results", `"max_results" must be a positive integer when supplied, got ${JSON.stringify(raw)}.`, batchIndex);
  }
  return raw as number;
}

/** Requires a present argument and hands it to `parseStoreAddress` -- the ONE
 * address parser, which owns the `$`/`0x` forms and the deliberate refusal of
 * an unprefixed numeric string. Absence is a DIFFERENT fact from malformity,
 * so it gets its own refusal rather than being folded into the parser's. */
function assertAddressArg(name: string, args: unknown, key: string, batchIndex?: number): number {
  const raw = argBag(args)[key];
  if (raw === undefined) {
    refuseArg(name, key, `"${key}" is required and was not supplied.`, batchIndex);
  }
  return parseStoreAddress(raw, { what: key });
}

/** The inclusive span two verbs in three share. Both ends go through the one
 * address parser; the SHAPE (ends inside the address space, end not below
 * start, and -- for a split layout -- the even-byte-count rule) goes through
 * `assertRangeShape`, which owns all three. */
function assertSpanArgs(name: string, args: unknown, dataType: Parameters<typeof assertRangeShape>[2], batchIndex?: number): { start: number; end: number } {
  const start = assertAddressArg(name, args, "start_address", batchIndex);
  const end = assertAddressArg(name, args, "end_address", batchIndex);
  assertRangeShape(start, end, dataType);
  return { start, end };
}

/** Validates the optional `base_revision` compare-and-swap argument.
 *
 * `anno-store.mts`'s own `assertRevisionArgument` is module-private, so this
 * throws that module's OWN exported `AnnoRevisionArgumentError` rather than a
 * fourth class: WR-22's recorded failure was a revision-shaped argument
 * (`"0001"`) surviving as far as SQLite, whose INTEGER affinity turned an
 * argument error into a corruption refusal. A caller must be able to tell
 * "you passed the wrong thing" from "the annotations are gone" BY CLASS. */
export function assertBaseRevisionArg(name: string, args: unknown, batchIndex?: number): number | undefined {
  const raw = argBag(args).base_revision;
  if (raw === undefined) return undefined;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
    throw new AnnoRevisionArgumentError(
      `${name} refused${whereOf(batchIndex)}: "base_revision" must be a non-negative integer, got ${JSON.stringify(raw)} -- ` +
        "a numeric STRING in particular is refused here rather than left to SQLite's column affinity, which turns an argument " +
        "error into a corruption refusal.",
      { value: raw, parameter: "base_revision" },
    );
  }
  return raw;
}

/** Validates a label `name` argument through the ONE identifier rule
 * (`assertLegalLabel`) and re-throws as an `AnnoToolArgumentError` carrying the
 * offending name and, inside a batch, the offending index. REJECT, NEVER
 * SANITIZE (T-29-23): substituting a character would merge this name with
 * whatever the substitution produces, and nothing would record that it
 * happened -- the store's printed name must never diverge from the symbol an
 * export would emit. */
function assertLegalLabelArg(name: string, args: unknown, batchIndex?: number): void {
  const raw = argBag(args).name;
  try {
    assertLegalLabel(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    refuseArg(
      name,
      "name",
      `${JSON.stringify(raw)} is not a legal ACME identifier (${reason}) -- REJECTED, never sanitized or quoted.`,
      batchIndex,
    );
  }
}

// ---------------------------------------------------------------------------
// The curated verbs. No verb takes a store: the handle is bound to one
// project before the call arrives. `clientFiles` names the arguments that
// are files the CLIENT reads; the engine receives each as a staged reference.
// ---------------------------------------------------------------------------

/** How deep a nested `anno_batch_execute` may go before the payload is refused
 * by name rather than walked. Four levels is far past any legitimate use -- a
 * batch of batches of batches has no procedure behind it -- and is chosen to
 * be obviously sufficient rather than tuned. */
export const ANNO_MAX_BATCH_DEPTH = 4;

const verb = (name: string, clientFiles: readonly string[] = []): AnnoToolDefinition => Object.freeze({ name, clientFiles: Object.freeze([...clientFiles]) });

export const ANNO_TOOL_DEFINITIONS: readonly AnnoToolDefinition[] = Object.freeze([
  verb("anno_set_label_name"),
  verb("anno_set_comment"),
  verb("anno_set_data_type"),
  verb("anno_add_scope"),
  verb("anno_remove_scope"),
  verb("anno_exclude_range"),
  verb("anno_include_range"),
  verb("anno_get_symbols"),
  verb("anno_get_comments"),
  verb("anno_get_blocks"),
  verb("anno_create_project_enum"),
  verb("anno_update_project_enum"),
  verb("anno_apply_enum_usage"),
  verb("anno_save_project"),
  verb("anno_disassemble", ["image"]),
  verb("anno_read_region", ["image"]),
  verb("anno_get_binary_info", ["image"]),
  verb("anno_get_cross_references", ["image"]),
  verb("anno_search", ["image"]),
  verb("anno_get_address_details", ["image"]),
  verb("anno_batch_execute", ["image"]),
  verb("anno_import_ghidra_export", ["export_path"]),
  verb("anno_join_memmap", ["image"]),
  verb("anno_evid_ingest"),
  verb("anno_evid_disagreements"),
  verb("anno_evid_runs"),
  verb("anno_evid_reset"),
  verb("anno_hazard_report", ["image"]),
]);

/** The allow-list, DERIVED from the definitions above rather than hand-typed:
 * a name cannot be curated in one place and absent from the other, because
 * there is only one place. */
export const CURATED_ANNO_TOOLS: readonly string[] = ANNO_TOOL_DEFINITIONS.map((def) => def.name);

// ---------------------------------------------------------------------------
// Per-verb argument validators. Each is called from BOTH the outer gate
// (`assertAnnoTool`) and, when a call arrives inside `anno_batch_execute`, that
// verb's own inner loop -- through the ONE dispatch below, so there is no way
// to add a verb to one route and forget the other.
// ---------------------------------------------------------------------------

/** Validates `anno_get_symbols`'s own arguments. The optional range bounds go
 * through `parseStoreAddress()` -- the ONE address parser -- so `$d020`,
 * `0xd020` and `53280` are accepted or refused here exactly as the store
 * itself would accept or refuse them, never by a second, divergent rule. */
function assertGetSymbolsArgs(args: unknown, batchIndex?: number): void {
  assertMaxResults("anno_get_symbols", args, batchIndex);
  const bag = argBag(args);
  if (bag.start_address !== undefined) parseStoreAddress(bag.start_address, { what: "start_address" });
  if (bag.end_address !== undefined) parseStoreAddress(bag.end_address, { what: "end_address" });
}

function assertSetLabelArgs(args: unknown, batchIndex?: number): void {
  assertAddressArg("anno_set_label_name", args, "address", batchIndex);
  assertLegalLabelArg("anno_set_label_name", args, batchIndex);
  const bag = argBag(args);
  if (bag.kind !== undefined) assertLabelKind(bag.kind);
  assertBaseRevisionArg("anno_set_label_name", args, batchIndex);
}

function assertSetCommentArgs(args: unknown, batchIndex?: number): void {
  assertAddressArg("anno_set_comment", args, "address", batchIndex);
  const bag = argBag(args);
  if (bag.comment === undefined) refuseArg("anno_set_comment", "comment", '"comment" is required and was not supplied.', batchIndex);
  // The byte bound, the ';'-prefix rule and the refuse-never-truncate policy
  // are ALL `assertCommentText()`'s. This layer adds no second length check,
  // no truncation and no Unicode normalization -- the bound is measured in
  // UTF-8 BYTES there, and a second rule here would disagree with it silently.
  assertCommentText(bag.comment);
  assertCommentType(bag.type);
  assertBaseRevisionArg("anno_set_comment", args, batchIndex);
}

function assertSetDataTypeArgs(args: unknown, batchIndex?: number): void {
  // ORDERING IS LOAD-BEARING, and it is the store's own: the data type is
  // narrowed FIRST because `assertRangeShape` needs it to decide whether the
  // even-byte-count rule applies at all.
  const dataType = assertDataType(argBag(args).data_type);
  assertSpanArgs("anno_set_data_type", args, dataType, batchIndex);
  assertBaseRevisionArg("anno_set_data_type", args, batchIndex);
}

function assertScopeArgs(name: string, args: unknown, batchIndex?: number): void {
  // "byte" selects the two shape rules that DO apply to a scope (both ends
  // inside the address space; the end not below the start) and none of the
  // ones that do not -- a scope is not a table, so a three-byte routine is a
  // perfectly good scope. This mirrors `addScope`'s own choice exactly.
  assertSpanArgs(name, args, "byte", batchIndex);
  assertBaseRevisionArg(name, args, batchIndex);
}

/** Shared validator for `anno_exclude_range` / `anno_include_range`, called
 * from `assertVerbArgs()` by two arms so the direct route and
 * `anno_batch_execute`'s inner loop cannot diverge (mirrors `assertScopeArgs`
 * exactly). "byte" selects the same two span shape rules a scope uses --
 * an exclusion is not a table. `reason` is required ONLY for the setter: the
 * unsetter names an existing record by its span alone. This layer refuses an
 * absent, non-string or empty/whitespace-only reason at the surface; the
 * store's own `assertCommentText()` re-checks the full comment-text
 * vocabulary at write time (T-46-01) -- this is not a second, divergent rule,
 * only an earlier gate on the same three malformed shapes. */
function assertExcludedRangeArgs(name: string, args: unknown, batchIndex?: number): void {
  assertSpanArgs(name, args, "byte", batchIndex);
  if (name === "anno_exclude_range") {
    const reason = argBag(args).reason;
    if (typeof reason !== "string" || reason.trim() === "") {
      refuseArg(
        name,
        "reason",
        `"reason" must be a non-empty string stating why the user asked for this span to be left out, got ${JSON.stringify(reason)}.`,
        batchIndex,
      );
    }
  }
  assertBaseRevisionArg(name, args, batchIndex);
}

function assertGetCommentsArgs(args: unknown, batchIndex?: number): void {
  assertMaxResults("anno_get_comments", args, batchIndex);
  const bag = argBag(args);
  if (bag.addresses !== undefined) {
    if (!Array.isArray(bag.addresses)) {
      refuseArg("anno_get_comments", "addresses", '"addresses" must be an array of addresses when supplied.', batchIndex);
    }
    for (const entry of bag.addresses as unknown[]) parseStoreAddress(entry, { what: "addresses[]" });
  }
  if (bag.start_address !== undefined) parseStoreAddress(bag.start_address, { what: "start_address" });
  if (bag.end_address !== undefined) parseStoreAddress(bag.end_address, { what: "end_address" });
  if (bag.type !== undefined) assertCommentType(bag.type);
}

const BLOCK_INCLUDES: readonly string[] = Object.freeze(["scopes", "enums", "enum_usage"]);

function assertGetBlocksArgs(args: unknown, batchIndex?: number): void {
  assertMaxResults("anno_get_blocks", args, batchIndex);
  const bag = argBag(args);
  if (bag.block_type !== undefined) assertDataType(bag.block_type);
  if (bag.include !== undefined) {
    if (!Array.isArray(bag.include)) {
      refuseArg("anno_get_blocks", "include", '"include" must be an array when supplied.', batchIndex);
    }
    for (const entry of bag.include as unknown[]) {
      if (typeof entry !== "string" || !BLOCK_INCLUDES.includes(entry)) {
        refuseArg(
          "anno_get_blocks",
          "include",
          `${JSON.stringify(entry)} is not one of the ${BLOCK_INCLUDES.length} extra collections -- expected one of: ${BLOCK_INCLUDES.join(", ")}.`,
          batchIndex,
        );
      }
    }
  }
}

function assertEnumNameArg(name: string, args: unknown, key: string, batchIndex?: number): void {
  const raw = argBag(args)[key];
  try {
    assertEnumName(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    refuseArg(name, key, `${JSON.stringify(raw)} is not a legal enum name (${reason}) -- REJECTED, never sanitized.`, batchIndex);
  }
}

function assertCreateEnumArgs(args: unknown, batchIndex?: number): void {
  assertEnumNameArg("anno_create_project_enum", args, "name", batchIndex);
  const bag = argBag(args);
  if (!isPlainObject(bag.variants)) {
    refuseArg("anno_create_project_enum", "variants", '"variants" must be an object mapping numeric-string keys to variant names.', batchIndex);
  }
  if (bag.description !== undefined) assertCommentText(bag.description, { what: "description", allowLeadingSemicolon: true });
  assertBaseRevisionArg("anno_create_project_enum", args, batchIndex);
}

function assertUpdateEnumArgs(args: unknown, batchIndex?: number): void {
  assertEnumNameArg("anno_update_project_enum", args, "name", batchIndex);
  const bag = argBag(args);
  if (bag.new_name !== undefined) assertEnumNameArg("anno_update_project_enum", args, "new_name", batchIndex);
  if (bag.variants !== undefined && !isPlainObject(bag.variants)) {
    refuseArg("anno_update_project_enum", "variants", '"variants" must be an object when supplied -- it REPLACES the mapping wholesale.', batchIndex);
  }
  if (bag.description !== undefined) assertCommentText(bag.description, { what: "description", allowLeadingSemicolon: true });
  assertBaseRevisionArg("anno_update_project_enum", args, batchIndex);
}

/** True when this call is the CLEAR form -- `name` omitted, or an empty
 * string. The schema's own contract ("Omit or send empty to clear"), read in
 * ONE place so the validator and the dispatcher can never disagree about which
 * of the two store functions a given payload selects. */
export function isEnumUsageClear(args: unknown): boolean {
  const raw = argBag(args).name;
  return raw === undefined || raw === "";
}

function assertApplyEnumUsageArgs(args: unknown, batchIndex?: number): void {
  assertAddressArg("anno_apply_enum_usage", args, "address", batchIndex);
  if (!isEnumUsageClear(args)) assertEnumNameArg("anno_apply_enum_usage", args, "name", batchIndex);
  assertBaseRevisionArg("anno_apply_enum_usage", args, batchIndex);
}

function assertSaveProjectArgs(_args: unknown, _batchIndex?: number): void {
}

function assertImportGhidraExportArgs(args: unknown, batchIndex?: number): void {
  const bag = argBag(args);
  if (!isAnnoFileRef(bag.export_path) && (typeof bag.export_path !== "string" || bag.export_path.trim() === "")) {
    refuseArg("anno_import_ghidra_export", "export_path", '"export_path" is required and must be a non-empty string.', batchIndex);
  }
  if (bag.sha256 !== undefined && (typeof bag.sha256 !== "string" || bag.sha256.trim() === "")) {
    refuseArg("anno_import_ghidra_export", "sha256", '"sha256" must be a non-empty string when supplied.', batchIndex);
  }
  assertBaseRevisionArg("anno_import_ghidra_export", args, batchIndex);
}

/** Validates one `const_writes[i]` element against the wire shape declared on
 * `anno_join_memmap`'s own schema, and narrows it to a `ConstWriteFact`
 * (CR-01 fix). Each of the three fields is required and must be a
 * non-negative integer -- these are ALREADY-RESOLVED facts a caller is
 * round-tripping from a prior anno_import_ghidra_export call, never an
 * agent-typed address, so there is no `$`/`0x` ambiguity to route through
 * `parseStoreAddress()` here. */
function assertConstWriteFactArg(name: string, raw: unknown, index: number, batchIndex?: number): ConstWriteFact {
  if (!isPlainObject(raw)) {
    refuseArg(
      name,
      "const_writes",
      `"const_writes[${index}]" must be an object with store_address/target_address/value fields, got ${JSON.stringify(raw)}.`,
      batchIndex,
    );
  }
  const bag = raw as Record<string, unknown>;
  for (const key of ["store_address", "target_address", "value"] as const) {
    const value = bag[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      refuseArg(
        name,
        "const_writes",
        `"const_writes[${index}].${key}" must be a non-negative integer, got ${JSON.stringify(value)}.`,
        batchIndex,
      );
    }
  }
  return {
    storeAddress: bag.store_address as number,
    targetAddress: bag.target_address as number,
    value: bag.value as number,
  };
}

/** Validates the optional `const_writes` array, returning `undefined` when
 * omitted -- OMISSION, not emptiness, is what `runMemmapJoin()` treats as
 * "skip the bank-state/graphics machinery entirely" (D-37-24's own
 * documented activation switch), so this must not default an absent
 * argument to `[]`. */
export function assertConstWritesArg(name: string, args: unknown, batchIndex?: number): ConstWriteFact[] | undefined {
  const raw = argBag(args).const_writes;
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    refuseArg(name, "const_writes", `"const_writes" must be an array when supplied, got ${JSON.stringify(raw)}.`, batchIndex);
  }
  return raw.map((entry, i) => assertConstWriteFactArg(name, entry, i, batchIndex));
}

/** Validates the optional `graphics_map_index` argument. */
export function assertGraphicsMapIndexArg(name: string, args: unknown, batchIndex?: number): number | undefined {
  const raw = argBag(args).graphics_map_index;
  if (raw === undefined) return undefined;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
    refuseArg(
      name,
      "graphics_map_index",
      `"graphics_map_index" must be a non-negative integer when supplied, got ${JSON.stringify(raw)}.`,
      batchIndex,
    );
  }
  return raw;
}

function assertJoinMemmapArgs(args: unknown, batchIndex?: number): void {
  assertImageArg("anno_join_memmap", args, batchIndex);
  assertBaseRevisionArg("anno_join_memmap", args, batchIndex);
  assertConstWritesArg("anno_join_memmap", args, batchIndex);
  assertGraphicsMapIndexArg("anno_join_memmap", args, batchIndex);
}

/** The run-identity digest shape: exactly 64 lowercase hex characters. This
 * module's own copy of the check (mirroring `evid-ingest.mts`'s identical,
 * deliberately un-imported copy): `image_sha256` never reaches a digest
 * function here, so there is nothing to route through a shared regex, and a
 * caller-visible refusal must fire BEFORE any store is opened -- before
 * `evid-ingest.mts`'s own `runIdentityFrom()` ever runs. */
const EVID_DIGEST_RE = /^[0-9a-f]{64}$/;

/** `anno_evid_ingest`'s own argument assertion, wired into `assertVerbArgs`
 * beside `anno_join_memmap`'s. Refuses BY NAME, before any store is opened: a
 * non-string/empty `memmap_text`, an `image_sha256` that is not exactly 64
 * lowercase hex characters, an `argv` that is not a non-empty array of
 * strings, and a `seed` that is not a non-empty string (T-43-21). */
function assertEvidIngestArgs(args: unknown, batchIndex?: number): void {
  assertBaseRevisionArg("anno_evid_ingest", args, batchIndex);
  const bag = argBag(args);
  if (typeof bag.memmap_text !== "string" || bag.memmap_text.trim() === "") {
    refuseArg(
      "anno_evid_ingest",
      "memmap_text",
      `"memmap_text" must be a non-empty string carrying the raw memmapshow reply, got ${JSON.stringify(bag.memmap_text)}.`,
      batchIndex,
    );
  }
  if (typeof bag.image_sha256 !== "string" || !EVID_DIGEST_RE.test(bag.image_sha256)) {
    refuseArg(
      "anno_evid_ingest",
      "image_sha256",
      `"image_sha256" must be exactly 64 lowercase hex characters, got ${JSON.stringify(bag.image_sha256)}.`,
      batchIndex,
    );
  }
  if (!Array.isArray(bag.argv) || bag.argv.length === 0 || bag.argv.some((entry) => typeof entry !== "string")) {
    refuseArg(
      "anno_evid_ingest",
      "argv",
      `"argv" must be a non-empty array of strings naming the exact emulator launch argument vector, got ${JSON.stringify(bag.argv)}.`,
      batchIndex,
    );
  }
  if (typeof bag.seed !== "string" || bag.seed.length === 0) {
    refuseArg("anno_evid_ingest", "seed", `"seed" must be a non-empty string, got ${JSON.stringify(bag.seed)}.`, batchIndex);
  }
}

/** `anno_evid_disagreements`'s own argument assertion (plan 43-06). The
 * three run-identity filters are ALL-OR-NONE, mirroring
 * `listExecObservations()`'s own rule in `anno-store.mts` exactly: a partial
 * identity would silently widen the match to every run sharing the supplied
 * field, which is not what "filter by run identity" means. */
function assertEvidDisagreementsArgs(args: unknown, batchIndex?: number): void {
  assertOptionalMaxResults("anno_evid_disagreements", args, batchIndex);
  const bag = argBag(args);
  const filterFieldsGiven = [bag.image_sha256, bag.argv_digest, bag.seed].filter((v) => v !== undefined).length;
  if (filterFieldsGiven > 0 && filterFieldsGiven < 3) {
    refuseArg(
      "anno_evid_disagreements",
      "image_sha256",
      "a run-identity filter requires image_sha256, argv_digest AND seed together -- a partial identity would " +
        "silently widen the match to every run sharing the supplied field(s).",
      batchIndex,
    );
  }
  if (filterFieldsGiven === 3) {
    if (typeof bag.image_sha256 !== "string" || !EVID_DIGEST_RE.test(bag.image_sha256)) {
      refuseArg(
        "anno_evid_disagreements",
        "image_sha256",
        `"image_sha256" must be exactly 64 lowercase hex characters, got ${JSON.stringify(bag.image_sha256)}.`,
        batchIndex,
      );
    }
    if (typeof bag.argv_digest !== "string" || !EVID_DIGEST_RE.test(bag.argv_digest)) {
      refuseArg(
        "anno_evid_disagreements",
        "argv_digest",
        `"argv_digest" must be exactly 64 lowercase hex characters, got ${JSON.stringify(bag.argv_digest)}.`,
        batchIndex,
      );
    }
    if (typeof bag.seed !== "string" || bag.seed.length === 0) {
      refuseArg("anno_evid_disagreements", "seed", `"seed" must be a non-empty string, got ${JSON.stringify(bag.seed)}.`, batchIndex);
    }
  }
}

/** `anno_evid_runs`'s own argument assertion (plan 43-06): just the
 * universal `store` argument, since this verb takes no other input. */
function assertEvidRunsArgs(_args: unknown, _batchIndex?: number): void {
}

/** `anno_evid_reset`'s own argument assertion (plan 43-06), the SAME shape
 * as `assertEvidIngestArgs` minus `memmap_text` -- refuses BY NAME, before
 * any store is opened: an `image_sha256` that is not exactly 64 lowercase
 * hex characters, an `argv` that is not a non-empty array of strings, and a
 * `seed` that is not a non-empty string. */
function assertEvidResetArgs(args: unknown, batchIndex?: number): void {
  assertBaseRevisionArg("anno_evid_reset", args, batchIndex);
  const bag = argBag(args);
  if (typeof bag.image_sha256 !== "string" || !EVID_DIGEST_RE.test(bag.image_sha256)) {
    refuseArg(
      "anno_evid_reset",
      "image_sha256",
      `"image_sha256" must be exactly 64 lowercase hex characters, got ${JSON.stringify(bag.image_sha256)}.`,
      batchIndex,
    );
  }
  if (!Array.isArray(bag.argv) || bag.argv.length === 0 || bag.argv.some((entry) => typeof entry !== "string")) {
    refuseArg(
      "anno_evid_reset",
      "argv",
      `"argv" must be a non-empty array of strings naming the exact emulator launch argument vector, got ${JSON.stringify(bag.argv)}.`,
      batchIndex,
    );
  }
  if (typeof bag.seed !== "string" || bag.seed.length === 0) {
    refuseArg("anno_evid_reset", "seed", `"seed" must be a non-empty string, got ${JSON.stringify(bag.seed)}.`, batchIndex);
  }
}

/** `anno_hazard_report`'s own argument assertion. Reuses the shared store,
 * image and optional-max-results assertions rather than inlining a fourth
 * check -- this verb has no argument shape of its own beyond those three. */
function assertHazardReportArgs(args: unknown, batchIndex?: number): void {
  assertImageArg("anno_hazard_report", args, batchIndex);
  assertOptionalMaxResults("anno_hazard_report", args, batchIndex);
}

// ---------------------------------------------------------------------------
// THE ONE SIZE CAP, GOVERNING BOTH VIEWS (T-29-25).
//
// A full-64K disassembly view dumped into an agent's context is the hazard this
// cap exists to prevent; these verbs read a ROUTINE at a range, not the whole
// program. 4096 is one sixteenth of the address space and far above any
// realistic single routine. ONE cap covers the region read AND the disassemble
// view, deliberately, so there is no per-view rule to get subtly wrong -- and
// the disassembly view at the cap is the worst case, since the hexdump view of
// the same byte count renders far less text.
//
// THIS CAP IS NOT THE ONLY BOUND FOR THIS FAMILY, BUT IT REMAINS THE
// LOAD-BEARING ONE. `vice-proxy.ts`'s `wrapPossiblyChunked()` runs at the
// proxy's single tools/call choke point -- the one place every registered
// tool's result is checked before it reaches the wire -- so an over-cap
// answer from this family crosses that same override exactly like any
// other tool's, and is split across a continuation sequence rather than
// delivered whole. That does not make this cap redundant: the client's own
// inline-response ceiling was measured at 40-60 KB, far below the proxy's
// 500,000-character output cap, so a result that never trips the proxy's
// split can still be far too large to be useful. That is why the second
// mitigation -- `max_results` REQUIRED with no default on every
// list-returning verb, with the true total returned beside the truncated list
// -- is not optional either.
// ---------------------------------------------------------------------------

export const ANNO_READ_REGION_MAX_BYTES = 4096;

/** The environment variable that overrides the cap. Exported so a caller and a
 * test name it in one place rather than two. */
export const ANNO_READ_REGION_MAX_BYTES_ENV = "ANNO_READ_REGION_MAX_BYTES";

/** Reads the cap override AT CALL TIME, never frozen at module load -- the same
 * read-at-call-time convention `repoRoot()` is called under above, so one
 * `node --test` process can point several different caps at this code within a
 * single run. Falls back to the named default on an absent, non-finite or
 * non-positive override. */
export function currentReadRegionMaxBytes(): number {
  const raw = process.env[ANNO_READ_REGION_MAX_BYTES_ENV];
  if (raw === undefined) return ANNO_READ_REGION_MAX_BYTES;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : ANNO_READ_REGION_MAX_BYTES;
}

export interface AnnoRegionRangeErrorOptions extends AnnoStoreErrorOptions {
  toolName?: string;
  start?: number;
  end?: number;
  requestedBytes?: number;
  cap?: number;
  batchIndex?: number;
}

/** A region or disassembly extent wider than the cap. Its own class, because a
 * caller must be able to tell "your range is too wide" from every other
 * argument refusal without substring-matching a message. */
export class AnnoRegionRangeError extends AnnoStoreError {
  toolName?: string;
  start?: number;
  end?: number;
  requestedBytes?: number;
  cap?: number;
  batchIndex?: number;

  constructor(message: string, { toolName, start, end, requestedBytes, cap, batchIndex, ...rest }: AnnoRegionRangeErrorOptions = {}) {
    super(message, rest);
    this.name = "AnnoRegionRangeError";
    this.toolName = toolName;
    this.start = start;
    this.end = end;
    this.requestedBytes = requestedBytes;
    this.cap = cap;
    this.batchIndex = batchIndex;
  }
}

/** Enforces the ONE cap over an inclusive span, naming BOTH the cap and the
 * requested width so the message is actionable without reading this file.
 * Called from `anno_read_region` and `anno_disassemble` alike. */
export function assertWithinRegionCap(name: string, start: number, end: number, batchIndex?: number): void {
  const requestedBytes = end - start + 1;
  const cap = currentReadRegionMaxBytes();
  if (requestedBytes > cap) {
    throw new AnnoRegionRangeError(
      `${name} refused${whereOf(batchIndex)}: requested ${requestedBytes} bytes ($${start.toString(16).padStart(4, "0")}..` +
        `$${end.toString(16).padStart(4, "0")} inclusive), which exceeds the ${ANNO_READ_REGION_MAX_BYTES_ENV} cap of ${cap} -- ` +
        `valid range is 1..${cap} bytes. This verb reads a routine at a range, not the whole program, and this family is NOT ` +
        `chunked, so the cap is the only bound there is. Narrow the range, or set ${ANNO_READ_REGION_MAX_BYTES_ENV} to override.`,
      { toolName: name, start, end, requestedBytes, cap, batchIndex },
    );
  }
}

/** Narrows the universally-required `image` argument (D-07) to a non-empty
 * path (as the client sees it) or a staged reference (as this engine does).
 * Containment and reading are the client's. */
function assertImageArg(name: string, args: unknown, batchIndex?: number): void {
  const bag = argBag(args);
  if (isAnnoFileRef(bag.image)) return;
  if (typeof bag.image !== "string" || bag.image.trim() === "") {
    refuseArg(
      name,
      "image",
      '"image" must be a non-empty string naming the program image this answer is derived from -- the store holds ' +
        "annotations, never bytes, and an omitted image would read as a plausible success against whatever was recorded last.",
      batchIndex,
    );
  }
}

function assertQueryArg(name: string, args: unknown, batchIndex?: number): void {
  const raw = argBag(args).query;
  if (typeof raw !== "string" || raw === "") {
    refuseArg(
      name,
      "query",
      `"query" must be a non-empty string, got ${JSON.stringify(raw)} -- an empty query matches every entry of every corpus, ` +
        "which is a listing rather than a search, and the list verbs are what listing is for.",
      batchIndex,
    );
  }
}

function assertDisassembleArgs(args: unknown, batchIndex?: number): void {
  assertImageArg("anno_disassemble", args, batchIndex);
  const start = assertAddressArg("anno_disassemble", args, "address", batchIndex);
  const bag = argBag(args);
  if (bag.end_address !== undefined) {
    const end = parseStoreAddress(bag.end_address, { what: "end_address" });
    assertRangeShape(start, end, "byte");
    assertWithinRegionCap("anno_disassemble", start, end, batchIndex);
  }
}

function assertReadRegionArgs(args: unknown, batchIndex?: number): void {
  assertImageArg("anno_read_region", args, batchIndex);
  const { start, end } = assertSpanArgs("anno_read_region", args, "byte", batchIndex);
  assertWithinRegionCap("anno_read_region", start, end, batchIndex);
  const view = argBag(args).view;
  if (view !== undefined && view !== "disasm" && view !== "hexdump") {
    refuseArg("anno_read_region", "view", `${JSON.stringify(view)} is not a view -- expected "disasm" or "hexdump".`, batchIndex);
  }
}

function assertBinaryInfoArgs(args: unknown, batchIndex?: number): void {
  assertImageArg("anno_get_binary_info", args, batchIndex);
}

function assertCrossReferencesArgs(args: unknown, batchIndex?: number): void {
  assertImageArg("anno_get_cross_references", args, batchIndex);
  assertAddressArg("anno_get_cross_references", args, "address", batchIndex);
  assertMaxResults("anno_get_cross_references", args, batchIndex);
}

function assertSearchArgs(args: unknown, batchIndex?: number): void {
  assertImageArg("anno_search", args, batchIndex);
  assertQueryArg("anno_search", args, batchIndex);
  assertMaxResults("anno_search", args, batchIndex);
}

function assertAddressDetailsArgs(args: unknown, batchIndex?: number): void {
  assertImageArg("anno_get_address_details", args, batchIndex);
  assertAddressArg("anno_get_address_details", args, "address", batchIndex);
}


// ---------------------------------------------------------------------------
// `anno_batch_execute` -- TWO EXPLICITLY SEPARATE PHASES, documented as two.
//
// PHASE ONE, PRE-VALIDATION (`assertAnnoBatch`), runs before any store is
// opened. It refuses the WHOLE batch on: a malformed payload, an empty `calls`
// array, a malformed entry, an uncurated inner name at ANY depth, or an inner
// call whose own per-verb validator refuses -- each naming the offending index.
// Nothing has executed when it fires, so there is no partial write to explain.
//
// PHASE TWO, EXECUTION, runs inside ONE `openStore`/`closeStore` pair for the
// whole batch. It loops to COMPLETION, pushing a per-entry `{status:"success"}`
// or `{status:"error"}` for every entry, and never aborts on the first failure.
//
// THE TWO ARE NOT IN CONFLICT, and this is the reconciliation the plan records:
// per-item status reporting and whole-batch refusal are two PHASES of one call,
// not two answers to one question. A refusal in phase one becomes
// `isError: true` through the runner's own catch and means "this batch should
// never have been sent". An inner call failing in phase two becomes an error
// ENTRY inside a successful outer result and means "this call in the batch did
// not work". The measured upstream note at `anno-tools.mts:63-75` establishes
// the second half: the loop always runs to completion and each outcome is
// pushed with its own status.
//
// TWO THINGS THIS VALIDATOR HAS THAT ITS ANALOG DID NOT:
//
//   1. AN EXPLICIT DEPTH CAP. The original recursion was unbounded and was safe
//      only because a child-process spawn cost dominated any nesting an
//      attacker could send. That cost is gone -- this runs in-process -- so a
//      deeply nested payload is a stack-exhaustion route (T-29-24). Past the
//      cap the batch is REFUSED BY NAME, naming the cap, rather than walked.
//   2. AN EXPLICIT REFUSAL FOR AN EMPTY `calls` ARRAY. A zero-length batch is
//      an ambiguous request, and executing it as a zero-length SUCCESS is
//      exactly the plausible-looking zero this surface forbids. A malformed
//      payload is a refusal; so is an empty one.
// ---------------------------------------------------------------------------

/**
 * PHASE ONE. Walks an `anno_batch_execute` payload and refuses the WHOLE batch
 * if anything, at any depth, is wrong.
 *
 * The per-verb argument validators fire through `assertVerbArgs()` -- the SAME
 * function the outer gate calls -- with the entry's index interpolated into the
 * message, so an illegal label name or an over-cap region range is refused
 * identically whether the verb was called directly or smuggled inside a batch.
 * That is the shared-validator discipline, and it is what makes the outer
 * allow-list gate mean anything for a nested-argument verb.
 *
 * THE SAME DISCIPLINE APPLIES TO THE ARGUMENTS THEMSELVES. Every inner
 * payload this function walks -- a leaf verb's or a nested batch's -- is
 * obtained from `batchArgumentsFor()`, the one function phase two also asks.
 * A phase that computed an inner call's arguments its own way would be
 * validating a payload the executor never runs, which is what CR-06 was.
 */
export function assertAnnoBatch(args: unknown, depth = 0): void {
  if (depth > ANNO_MAX_BATCH_DEPTH) {
    throw new AnnoToolArgumentError(
      `anno_batch_execute refused: nesting deeper than ${ANNO_MAX_BATCH_DEPTH} levels -- refused BY NAME rather than walked, ` +
        "because an unbounded walk over an attacker-shaped payload is a stack-exhaustion route. Flatten the batch.",
      { toolName: "anno_batch_execute", argument: "calls" },
    );
  }
  if (!isPlainObject(args) || !Array.isArray(args.calls)) {
    throw new AnnoToolArgumentError(
      'anno_batch_execute refused: "calls" must be an array of {name, arguments} objects -- a malformed batch payload is ' +
        "treated as a REFUSAL, never as an empty batch that passes through.",
      { toolName: "anno_batch_execute", argument: "calls" },
    );
  }
  const calls = args.calls as unknown[];
  if (calls.length === 0) {
    throw new AnnoToolArgumentError(
      'anno_batch_execute refused: "calls" is an EMPTY array. A zero-length batch is an ambiguous request, and running it as a ' +
        "zero-length success would be a plausible-looking zero -- the caller would be told a pass completed when nothing was asked for.",
      { toolName: "anno_batch_execute", argument: "calls" },
    );
  }
  calls.forEach((call, i) => {
    if (!isPlainObject(call) || typeof call.name !== "string") {
      throw new AnnoToolArgumentError(
        `anno_batch_execute refused WHOLE: calls[${i}] is malformed (missing a string "name") -- treated as a refusal, never ` +
          "as an empty batch that passes through.",
        { toolName: "anno_batch_execute", argument: "calls", batchIndex: i },
      );
    }
    if (!CURATED_ANNO_TOOLS.includes(call.name)) {
      throw new AnnoUncuratedToolError(
        `anno_batch_execute refused WHOLE: calls[${i}].name "${call.name}" is outside the curated anno_* tool surface -- a batch ` +
          "is refused whole if any inner name is outside the curated set.",
        { toolName: call.name, batchIndex: i },
      );
    }
    // Recurses on the EFFECTIVE arguments, the ones the executor runs:
    // `batchArgumentsFor()` defines them for both phases. A refusal from a
    // shared validator is re-thrown with this entry's index, so the caller can
    // find the offending call at any depth.
    try {
      const effective = batchArgumentsFor(args, call, i);
      if (call.name === "anno_batch_execute") assertAnnoBatch(effective, depth + 1);
      else assertVerbArgs(call.name, effective, i);
    } catch (err) {
      throw withBatchIndex(err, i, call.name);
    }
  });
}

/** `err` with `calls[i]` named in its message, when it does not name it
 * already. The class and every field stay as they were. */
function withBatchIndex(err: unknown, index: number, name: string): unknown {
  if (!(err instanceof Error) || err.message.includes(`calls[${index}]`)) return err;
  err.message = `anno_batch_execute refused WHOLE (calls[${index}], ${name}): ${err.message}`;
  return err;
}

/** An inner call's effective arguments: its own, plus the batch's image when
 * the batch names one. An inner call that names a DIFFERENT image is refused:
 * the batch never silently replaces what a call asked for. */
export function batchArgumentsFor(batchArgs: Record<string, unknown>, call: Record<string, unknown>, index?: number): Record<string, unknown> {
  const own = argBag(call.arguments);
  if (batchArgs.image === undefined) return { ...own };
  if (own.image !== undefined && JSON.stringify(own.image) !== JSON.stringify(batchArgs.image)) {
    throw new AnnoToolArgumentError(
      `anno_batch_execute refused${whereOf(index)}: the inner call names image ${JSON.stringify(own.image)}, but the batch names ` +
        `${JSON.stringify(batchArgs.image)}. Name the image once, on the batch or on the call, or split the batch.`,
      { toolName: "anno_batch_execute", argument: "image", batchIndex: index },
    );
  }
  return { ...own, image: batchArgs.image };
}

/**
 * THE ONE PER-VERB VALIDATOR DISPATCH. Both the outer gate and (once it lands)
 * the batch pre-validator call THIS function, never the individual validators
 * directly, so a verb cannot be validated on one route and waved through on the
 * other. `batchIndex` is `undefined` for a direct call and the offending index
 * for a batch entry; every refusal message interpolates it.
 */
function assertVerbArgs(name: string, args: unknown, batchIndex?: number): void {
  if (name === "anno_get_symbols") return assertGetSymbolsArgs(args, batchIndex);
  if (name === "anno_set_label_name") return assertSetLabelArgs(args, batchIndex);
  if (name === "anno_set_comment") return assertSetCommentArgs(args, batchIndex);
  if (name === "anno_set_data_type") return assertSetDataTypeArgs(args, batchIndex);
  if (name === "anno_add_scope") return assertScopeArgs("anno_add_scope", args, batchIndex);
  if (name === "anno_remove_scope") return assertScopeArgs("anno_remove_scope", args, batchIndex);
  if (name === "anno_exclude_range") return assertExcludedRangeArgs("anno_exclude_range", args, batchIndex);
  if (name === "anno_include_range") return assertExcludedRangeArgs("anno_include_range", args, batchIndex);
  if (name === "anno_get_comments") return assertGetCommentsArgs(args, batchIndex);
  if (name === "anno_get_blocks") return assertGetBlocksArgs(args, batchIndex);
  if (name === "anno_create_project_enum") return assertCreateEnumArgs(args, batchIndex);
  if (name === "anno_update_project_enum") return assertUpdateEnumArgs(args, batchIndex);
  if (name === "anno_apply_enum_usage") return assertApplyEnumUsageArgs(args, batchIndex);
  if (name === "anno_save_project") return assertSaveProjectArgs(args, batchIndex);
  if (name === "anno_import_ghidra_export") return assertImportGhidraExportArgs(args, batchIndex);
  if (name === "anno_join_memmap") return assertJoinMemmapArgs(args, batchIndex);
  if (name === "anno_evid_ingest") return assertEvidIngestArgs(args, batchIndex);
  if (name === "anno_evid_disagreements") return assertEvidDisagreementsArgs(args, batchIndex);
  if (name === "anno_evid_runs") return assertEvidRunsArgs(args, batchIndex);
  if (name === "anno_evid_reset") return assertEvidResetArgs(args, batchIndex);
  if (name === "anno_hazard_report") return assertHazardReportArgs(args, batchIndex);
  if (name === "anno_disassemble") return assertDisassembleArgs(args, batchIndex);
  if (name === "anno_read_region") return assertReadRegionArgs(args, batchIndex);
  if (name === "anno_get_binary_info") return assertBinaryInfoArgs(args, batchIndex);
  if (name === "anno_get_cross_references") return assertCrossReferencesArgs(args, batchIndex);
  if (name === "anno_search") return assertSearchArgs(args, batchIndex);
  if (name === "anno_get_address_details") return assertAddressDetailsArgs(args, batchIndex);
  if (name === "anno_batch_execute") return assertAnnoBatch(args);
  // Every curated verb has an arm above. A curated name reaching here is a bug
  // in THIS file, and saying so by name is cheaper than a validator silently
  // accepting a payload nobody checked.
  throw new AnnoUncuratedToolError(
    `"${name}" is curated but has no argument validator in anno-tools.mts. Resolution routes: add one to ` +
      "assertVerbArgs, or remove the definition.",
    { toolName: name, batchIndex },
  );
}

/**
 * The allow-list gate. Its body's FIRST check is set membership (see WHAT NOT
 * TO DO above, and the same confused-deputy precedent inverted into an
 * allow-list): a `name` outside `CURATED_ANNO_TOOLS` is refused outright,
 * before any argument is inspected, so an unknown verb can never reach a
 * validator that might coincidentally accept its payload. Only then are the
 * named verb's own arguments checked.
 */
export function assertAnnoTool(name: string, args?: unknown): void {
  if (!CURATED_ANNO_TOOLS.includes(name)) {
    throw new AnnoUncuratedToolError(
      `"${name}" is not part of the curated anno_* tool surface. Resolution routes: implement it and ` +
        "add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.",
      { toolName: name },
    );
  }
  assertVerbArgs(name, args);
}

/** The verbs that only READ. A call to one never creates the annotation
 * database or its project. It is a hand-listed property of each verb, and a
 * verb missing from here is merely opened writably, never wrongly refused.
 * `anno_batch_execute` is read-only when every inner call is: see
 * `isReadOnlyCall`. */
export const READ_ONLY_ANNO_VERBS: readonly string[] = Object.freeze([
  "anno_get_symbols",
  "anno_get_comments",
  "anno_get_blocks",
  "anno_save_project",
  "anno_disassemble",
  "anno_read_region",
  "anno_get_binary_info",
  "anno_get_cross_references",
  "anno_search",
  "anno_get_address_details",
  "anno_evid_disagreements",
  "anno_evid_runs",
  "anno_hazard_report",
]);

/** True when the call only reads: a read-only verb, or a batch whose every
 * inner call, at any depth, is one. A malformed or over-deep batch is not
 * read-only; its validator refuses it anyway. */
export function isReadOnlyCall(name: string, args: unknown, depth = 0): boolean {
  if (name !== "anno_batch_execute") return READ_ONLY_ANNO_VERBS.includes(name);
  if (depth > ANNO_MAX_BATCH_DEPTH) return false;
  const calls = argBag(args).calls;
  if (!Array.isArray(calls) || calls.length === 0) return false;
  return calls.every((call: unknown) => isPlainObject(call) && typeof call.name === "string" && isReadOnlyCall(call.name, call.arguments, depth + 1));
}

/** A file argument as the engine receives it: a reference to bytes the client
 * staged beside the call, never a path. */
export interface AnnoFileRef {
  $file: string;
}

/** One staged file: the name the client gave it (echoed in answers, and the
 * source of the extension an image is dispatched on) and its bytes. */
export interface AnnoInputFile {
  name: string;
  bytes: Uint8Array;
}

/** The staged files of one call, by slot. */
export type AnnoInputs = ReadonlyMap<string, AnnoInputFile>;

export function isAnnoFileRef(value: unknown): value is AnnoFileRef {
  return isPlainObject(value) && typeof value.$file === "string" && value.$file !== "" && Object.keys(value).length === 1;
}

/** The argument keys of `name`'s definition that name a client file. The batch
 * verb's `calls` carry their own verbs' keys; see `anno-call-client.ts`. */
export function clientFileKeys(name: string): readonly string[] {
  return ANNO_TOOL_DEFINITIONS.find((d) => d.name === name)?.clientFiles ?? [];
}

/** Resolves a file argument to its staged bytes. A plain string is refused: it
 * is a path, and a path never reaches this module. */
export function stagedInputFile(name: string, key: string, value: unknown, inputs: AnnoInputs): AnnoInputFile {
  if (!isAnnoFileRef(value)) {
    throw new AnnoToolArgumentError(
      `${name} refused: "${key}" did not arrive as a staged file -- this engine reads only bytes the client staged beside the ` +
        "call, never a path, so the client must read the file and send it.",
      { toolName: name, argument: key },
    );
  }
  const file = inputs.get(value.$file);
  if (file === undefined) {
    throw new AnnoToolArgumentError(`${name} refused: "${key}" names staged file ${JSON.stringify(value.$file)}, which was not sent with the call.`, {
      toolName: name,
      argument: key,
    });
  }
  return file;
}
