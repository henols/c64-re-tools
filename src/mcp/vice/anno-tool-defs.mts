#!/usr/bin/env node
// anno-tool-defs.mts
//
// WHY THIS FILE EXISTS: the curated `anno_*` tool surface without its
// engine -- the definitions, the allow-list derived from them, every per-verb
// argument validator, and the staged-file vocabulary. A client validates a
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

// ---------------------------------------------------------------------------
// The wire shapes this module produces/consumes. Deliberately NOT imported
// from vice-proxy.ts (that file has no exported ToolDefinition/ToolCallResult
// -- both are file-local types there); these are structurally identical so a
// value built here is interchangeable wherever vice-proxy.ts combines it with
// its own manifest-sourced tools.
// ---------------------------------------------------------------------------

export interface AnnoToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  // Structural compatibility with vice.ts's own ToolInfo (vice-proxy.ts's
  // ToolDefinition alias), which carries this index signature -- lets
  // vice-proxy.ts's buildViceTool() accept an AnnoToolDefinition directly,
  // with no per-call cast at the registration site.
  [key: string]: unknown;
}

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

function errText(text: string): ToolCallResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** The one spelling of a failed call, named by class (D18-12), so a caller can
 * tell an `AnnoStoreCorruptError` from an `AnnoToolArgumentError` from the
 * text alone. Shared with `anno-call-client.ts`, whose own refusals must read
 * the same. */
export function toolFailure(name: string, err: unknown): ToolCallResult {
  const errName = err instanceof Error ? err.name : "Error";
  const errMessage = err instanceof Error ? err.message : String(err);
  return errText(`${name} failed: [${errName}] ${errMessage}`);
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
        "error into a corruption refusal (WR-22).",
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
// The curated tool definitions.
//
// No definition carries a store: the handle is bound to one project before
// the call arrives. A property marked `clientFile: true` names a file the
// CLIENT reads; the engine receives it as a staged reference. Each description
// is written for an AGENT: what the verb answers, what it costs, and what it
// will refuse.
// ---------------------------------------------------------------------------

/** How deep a nested `anno_batch_execute` may go before the payload is refused
 * by name rather than walked (T-29-24). Four levels is far past any legitimate
 * use -- a batch of batches of batches has no procedure behind it -- and is
 * chosen to be obviously sufficient rather than tuned. */
export const ANNO_MAX_BATCH_DEPTH = 4;

const IMAGE_PROPERTY = {
  image: {
    type: "string",
    clientFile: true,
    description:
      "Absolute or workspace-relative path to the program image this answer is DERIVED from -- a .prg (2-byte " +
      "little-endian load address plus payload) or an exactly-65536-byte flat capture (.raw/.bin, dispatched by " +
      "extension before any length check). REQUIRED on every derived read (D-07): the store holds annotations and " +
      "never bytes, so an omitted image would read as a plausible success against whatever was recorded last. " +
      "The client reads the file and sends its bytes; refused if it resolves outside the workspace root, including " +
      "via a symlink.",
  },
} as const;

const BASE_REVISION_PROPERTY = {
  base_revision: {
    type: "integer",
    description:
      "Optional compare-and-swap guard: the revision this edit was computed against. The write is refused with a " +
      "named stale-revision error if the store has moved on. Omit it for an unconditional write. A numeric STRING " +
      "is refused rather than coerced.",
  },
} as const;

export const ANNO_TOOL_DEFINITIONS: readonly AnnoToolDefinition[] = [
  {
    name: "anno_set_label_name",
    description:
      "Binds a name to one address in the annotation store, so a disassembly reads as `jsr irq_handler` rather than " +
      "`jsr $c000`. Costs one store open, one write and one close. REFUSES, never rewrites: a name that is not a legal " +
      "ACME identifier (letter or underscore, then letters/digits/underscores) or that is a 6502/6510 mnemonic is " +
      "rejected with the offending name in the message, because the store's printed name must never diverge from the " +
      "symbol an export would emit. Also refuses a name already bound to a DIFFERENT address rather than rebinding it. " +
      "Setting the same name at the same address again SUCCEEDS and reports `changed: false` -- re-running an " +
      "annotation pass is not an error.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          description:
            "The address to name. An integer 0..65535, a \"$hex\" string, or a \"0x\" string; an unprefixed numeric " +
            "string is refused on purpose, because a mis-based address written into the store is persistent and silently wrong.",
        },
        name: {
          type: "string",
          description:
            "The label name. Must be a legal ACME identifier and must not be a 6502/6510 mnemonic. An illegal name is " +
            "REJECTED, never sanitized or quoted.",
        },
        kind: {
          type: "string",
          enum: ["User", "Auto", "System", "Platform"],
          description:
            "Provenance of the name. 'User' (the default when omitted) = a human chose it; 'Auto' = generated; " +
            "'System'/'Platform' = a known ROM or hardware name.",
        },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["address", "name"],
    },
  },
  {
    name: "anno_set_comment",
    description:
      "Stores a comment at one address, replacing whatever that placement held. 'line' comments sit on their own line " +
      "before the instruction; 'side' comments sit inline on the same line. The two placements coexist at one address. " +
      "Carrier for the [confirmed-code]/[probable-code]/[confirmed-data]/[probable-data]/[unknown] confidence-prefix " +
      "convention. Do NOT include a leading ';' -- the store holds the words and the exporter adds the prefix, so a " +
      "stored ';' would be emitted twice and is refused. Over-long text is REFUSED rather than truncated, and the bound " +
      "is measured in UTF-8 BYTES, so a multi-byte comment is bounded by what actually lands in the file. A " +
      "byte-identical repeat SUCCEEDS and reports `changed: false`.",
    inputSchema: {
      type: "object",
      properties: {
        address: { description: "The address to comment. Integer, \"$hex\" or \"0x\" string; an unprefixed numeric string is refused." },
        comment: { type: "string", description: "The comment text, without the ';' prefix." },
        type: {
          type: "string",
          enum: ["line", "side"],
          description: "'line' = own line before the instruction. 'side' = inline on the same line.",
        },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["address", "comment", "type"],
    },
  },
  {
    name: "anno_set_data_type",
    description:
      "Types an inclusive address range, preserving whatever the overlapping rows said about the addresses outside it. " +
      "A SUCCESSFUL result can carry two disclosures, and both are always present in the body: `contradictedComments` " +
      "names comments whose recorded confidence now contradicts the type just applied, and `reinterpretedSplitTables` " +
      "names every split table this write FRAGMENTED, with the entry-address pairs it read before, the pairs each " +
      "surviving remainder reads now, and the pairs preserved. Neither is an error and neither is dropped: a split " +
      "table's entries re-pair as a function of the row's start AND its length, so a fragment decodes to different " +
      "16-bit values than the ones a human recorded, and a success that hid that would be worse than a refusal. " +
      "A split layout REFUSES an odd byte count (the low half and the high half must be the same length). Retyping the " +
      "same range the same way SUCCEEDS and reports `changed: false`.",
    inputSchema: {
      type: "object",
      properties: {
        start_address: { description: "Start of the range, INCLUSIVE. Integer, \"$hex\" or \"0x\" string." },
        end_address: { description: "End of the range, INCLUSIVE. A one-byte range has end_address === start_address." },
        data_type: {
          type: "string",
          enum: [
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
          ],
          description:
            "code=6502/6510 instructions; byte=raw 8-bit data (sprites, charset, tables, unknowns); word=16-bit LE " +
            "values; address=16-bit LE pointers (produces cross-references, use for jump tables and vectors); " +
            "petscii=PETSCII text; screencode=screen-code text; lo_hi_address=split address table, low bytes first " +
            "then high bytes (even count required); hi_lo_address=split address table, high bytes first (even count " +
            "required); lo_hi_word=split word table, low bytes first (e.g. SID frequency tables); hi_lo_word=split " +
            "word table, high bytes first; external_file=large binary blob to export as-is; undefined=reset the range " +
            "to unknown.",
        },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["start_address", "end_address", "data_type"],
    },
  },
  {
    name: "anno_add_scope",
    description:
      "Adds a lexical scope over an inclusive range, so symbols inside it are local to it. Nested and overlapping " +
      "scopes are UNSUPPORTED by the schema this store mirrors and are REFUSED, naming both the incoming span and the " +
      "existing scope's id and span; the incoming scope is neither trimmed nor split. Two scopes that merely TOUCH at " +
      "a boundary are disjoint and both accepted. An identical repeat SUCCEEDS and reports `changed: false`. " +
      "MIND THE ENDS: one transposed end (say $1000..$ffff instead of $1000..$10ff) makes every later scope above that " +
      "start refuse -- use anno_remove_scope to undo it; the store keeps no revert history.",
    inputSchema: {
      type: "object",
      properties: {
        start_address: { description: "Start of the scope, INCLUSIVE. Integer, \"$hex\" or \"0x\" string." },
        end_address: { description: "End of the scope, INCLUSIVE." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["start_address", "end_address"],
    },
  },
  {
    name: "anno_remove_scope",
    description:
      "Removes the scope whose span is EXACTLY start_address..end_address -- the inverse of anno_add_scope, and the " +
      "recovery route for a transposed span, which nothing else can undo. The span must match both stored ends exactly: a scope is never trimmed, split or partially " +
      "removed, because a partial removal would leave a shape nothing downstream can express while reporting success. " +
      "Read the stored spans with anno_get_blocks (include: [\"scopes\"]) first if you are unsure. Removing a scope " +
      "that is not there SUCCEEDS and reports `changed: false`.",
    inputSchema: {
      type: "object",
      properties: {
        start_address: { description: "Start of the scope to remove, INCLUSIVE. Must match the stored start exactly." },
        end_address: { description: "End of the scope to remove, INCLUSIVE. Must match the stored end exactly." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["start_address", "end_address"],
    },
  },
  {
    name: "anno_exclude_range",
    description:
      "Records the user's request to leave an inclusive span out, WITH the reason, as a durable row (BUILD-05/BUILD-07). " +
      "RECORDING AN EXCLUSION DOES NOT REMOVE ANYTHING: the export still emits every byte of that span; the record is " +
      "what makes the request VISIBLE in the output instead of invisible as a gap. What gets reversed, kept or left out " +
      "is the end-user's decision, and this verb is how the user states it -- it is not the tool deciding. An " +
      "overlapping span is REFUSED naming both spans; two records that merely TOUCH at a boundary are disjoint and both " +
      "accepted; an identical repeat SUCCEEDS reporting `changed: false`; the same extent with a DIFFERENT reason is " +
      "REFUSED rather than overwriting the stored reason. MIND THE ENDS: one transposed end makes every later exclusion " +
      "overlapping that start refuse -- use anno_include_range to undo it; the store keeps no revert history.",
    inputSchema: {
      type: "object",
      properties: {
        start_address: { description: "Start of the excluded span, INCLUSIVE. Integer, \"$hex\" or \"0x\" string." },
        end_address: { description: "End of the excluded span, INCLUSIVE." },
        reason: {
          type: "string",
          description:
            "Why the user asked for this span to be left out. REQUIRED and must be non-empty: a reason column " +
            "satisfied by an empty string records that something was excluded and loses WHY.",
        },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["start_address", "end_address", "reason"],
    },
  },
  {
    name: "anno_include_range",
    description:
      "Removes the exclusion whose span is EXACTLY start_address..end_address -- the exact inverse of anno_exclude_range. " +
      "Both stored ends must match exactly, because a record is never trimmed, split or partially removed. Read the " +
      "stored spans with anno_exclude_range's sibling read (the excludedRanges list on either verb's own success body) " +
      "first if you are unsure. Removing an exclusion that is not there SUCCEEDS and reports `changed: false`.",
    inputSchema: {
      type: "object",
      properties: {
        start_address: { description: "Start of the exclusion to remove, INCLUSIVE. Must match the stored start exactly." },
        end_address: { description: "End of the exclusion to remove, INCLUSIVE. Must match the stored end exactly." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["start_address", "end_address"],
    },
  },
  {
    name: "anno_get_symbols",
    description:
      "Returns labels held in an annotation store, in ascending insertion order, optionally narrowed to " +
      "an address range. Every call names its own store (there is no ambient 'current store') and the " +
      "store is opened and closed within the call. `max_results` is REQUIRED and has no default on this " +
      "surface: pass an explicit ceiling and compare the returned count against it to detect truncation.",
    inputSchema: {
      type: "object",
      properties: {
        max_results: {
          type: "integer",
          description:
            "Maximum number of labels to return. REQUIRED -- no default on this surface, so a truncated " +
            "answer is always the caller's own explicit ceiling rather than a silent one.",
        },
        start_address: {
          description:
            "Optional lower bound (inclusive) of the address range to filter by. An integer 0..65535, a " +
            "\"$hex\" string, or a \"0x\" string; an unprefixed numeric string is refused.",
        },
        end_address: {
          description:
            "Optional upper bound (inclusive) of the address range to filter by. Same accepted forms as " +
            "start_address.",
        },
      },
      required: ["max_results"],
    },
  },
  {
    name: "anno_get_comments",
    description:
      "Returns stored comments, each with its address, its placement ('line' or 'side') and its text, in ascending " +
      "insertion order. Filters are combined with AND: specific `addresses`, an inclusive `start_address`/`end_address` " +
      "window, and a placement `type`. The confidence-prefix convention lives in the returned text -- filter by prefix " +
      "on your own side, or use anno_search. `max_results` is REQUIRED with no default; the true match count is " +
      "returned beside the truncated list, so truncation is a fact you are told rather than one you infer.",
    inputSchema: {
      type: "object",
      properties: {
        max_results: { type: "integer", description: "Maximum number of comments to return. REQUIRED -- no default on this surface." },
        addresses: {
          type: "array",
          description: "Optional list of specific addresses. Integers, \"$hex\" or \"0x\" strings; unprefixed numeric strings are refused.",
        },
        start_address: { description: "Optional lower bound (inclusive) of the address window." },
        end_address: { description: "Optional upper bound (inclusive) of the address window." },
        type: { type: "string", enum: ["line", "side"], description: "Optional placement filter." },
      },
      required: ["max_results"],
    },
  },
  {
    name: "anno_get_blocks",
    description:
      "Returns the typed ranges (blocks) this store holds -- each with its inclusive span and its data type -- " +
      "optionally narrowed by `block_type`. This is also the read route for the store's other structural annotations: " +
      "pass `include` to add `scopes` (every lexical scope's id and span, which anno_remove_scope needs to match " +
      "exactly), `enums` (every project enum with its variants mapping) and `enum_usage` (every address-to-enum " +
      "association, with the enum's name resolved through its id at read time). `max_results` is REQUIRED with no " +
      "default and bounds the RANGE list; the true match count is returned beside it.",
    inputSchema: {
      type: "object",
      properties: {
        max_results: { type: "integer", description: "Maximum number of ranges to return. REQUIRED -- no default on this surface." },
        block_type: {
          type: "string",
          description: "Optional exact data-type filter, e.g. 'code' or 'lo_hi_address'. Must be one of the twelve data types.",
        },
        include: {
          type: "array",
          items: { type: "string", enum: ["scopes", "enums", "enum_usage"] },
          description:
            "Optional extra structural annotations to return alongside the ranges. Each is returned whole (these " +
            "collections are small by construction), so they are not governed by max_results.",
        },
      },
      required: ["max_results"],
    },
  },
  {
    name: "anno_create_project_enum",
    description:
      "Creates a project-local enum -- a name, a variants mapping and an optional description -- embedded in the " +
      "annotation store rather than anywhere machine-global. Variant keys are numeric strings in decimal, 0x/$ hex or " +
      "0b/% binary; two keys naming the SAME number are refused, because that would mean two variant names for one " +
      "value and nothing downstream could say which. A name already held with DIFFERENT contents is refused rather " +
      "than overwritten -- use anno_update_project_enum, which replaces the variants mapping wholesale and says so. " +
      "An identical re-create SUCCEEDS and reports `changed: false`. The body returns every enum the store now holds.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Unique identifier: a letter or underscore, then letters/digits/underscores. Refused, never sanitized." },
        variants: {
          type: "object",
          description: "Variant mapping. Keys are numeric strings (decimal, 0x/$ hex, 0b/% binary); values are variant names.",
        },
        description: { type: "string", description: "Optional summary explaining the enum's purpose." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["name", "variants"],
    },
  },
  {
    name: "anno_update_project_enum",
    description:
      "Renames a project enum, replaces its variants mapping, replaces its description, or any combination. THE " +
      "VARIANTS MAPPING IS REPLACED WHOLESALE when supplied, never merged: a merge would make a variant impossible to " +
      "REMOVE, since there would be no way to express its absence. A rename onto a name another enum already holds is " +
      "refused rather than merging two enums into one. Renaming does NOT orphan an enum usage: usages are associated " +
      "by enum id, not by name. Updating an enum that does not exist is refused. A no-op update SUCCEEDS and reports " +
      "`changed: false`. The body returns every enum the store now holds.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Existing name of the enum to update." },
        new_name: { type: "string", description: "Optional new name. Same identifier rule; refused, never sanitized." },
        variants: { type: "object", description: "Optional COMPLETE replacement variants mapping. Omit to leave the mapping alone." },
        description: { type: "string", description: "Optional replacement description." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["name"],
    },
  },
  {
    name: "anno_apply_enum_usage",
    description:
      "Associates one address with one project enum, so an immediate operand or constant reference at that address " +
      "formats as a variant name. OMITTING `name`, or passing an empty string, CLEARS the association at that address " +
      "instead -- that is the schema's own contract for this verb, and clearing an address that carries none SUCCEEDS " +
      "reporting `changed: false`. One address carries at most one enum, so applying a different enum REPLACES rather " +
      "than refuses. Applying an enum that does not exist is refused rather than creating it implicitly, because a " +
      "mistyped name would otherwise become a real, empty enum that formats nothing and looks deliberate. The body " +
      "returns every address-to-enum association the store now holds.",
    inputSchema: {
      type: "object",
      properties: {
        address: { description: "The instruction address. Integer, \"$hex\" or \"0x\" string; an unprefixed numeric string is refused." },
        name: { type: "string", description: "The enum to apply. OMIT, or pass an empty string, to CLEAR the association at this address." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["address"],
    },
  },
  {
    name: "anno_save_project",
    description:
      "Reports the store's current revision. IT PERFORMS NO WRITE, and it exists to say so: every mutating verb on " +
      "this surface has ALREADY committed and fsynced its own write by the time it returns, so there is no unsaved " +
      "state for an explicit save to flush and no window in which a crash could lose an edit this verb would have " +
      "rescued. Durability belongs to the store, not to a verb an agent has to remember to call. Use this to read the " +
      "revision -- for a subsequent `base_revision` compare-and-swap, or to confirm that a pass advanced the store as " +
      "far as expected. The body states the no-write property alongside the revision, so a caller is never left " +
      "inferring it from an empty success.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "anno_disassemble",
    description:
      "Renders ACME-ready `!cpu 6510` source for the instructions starting AT AN EXPLICIT ADDRESS you supply. " +
      "There is no cursor and no 'current address' on this surface -- upstream's own procedure text says never to rely " +
      "on one and this project has no editor to have one, so the address is always yours and always in the call. " +
      "Decoded fresh from the image bytes on every call; nothing is cached and nothing is written. An opcode ACME " +
      "cannot express is emitted as `!byte` with the mnemonic moved into a comment, never as a mnemonic that would " +
      "fail to reassemble. The extent is bounded by the SAME byte cap that governs anno_read_region -- one cap, both " +
      "views, so there is no per-view rule to get subtly wrong -- and defaults to that cap when end_address is " +
      "omitted. A wider range is REFUSED by name with the cap and the requested width in the message, never " +
      "silently truncated. A register write bound to a project enum (via anno_apply_enum_usage) renders through " +
      "its named member instead of a hex literal -- a single-field register as `#<enum>_<VARIANT>`, or, for a " +
      "multi-field register, as its bits OR-ed together by name (`#D018_SELECT..0 | D018_CHARACTER..2 | " +
      "D018_VIDEO..0`) with a trailing comment naming every field and its decoded value, so a bound write reads " +
      "the same way here as it does in the exported ACME source.",
    inputSchema: {
      type: "object",
      properties: {
        ...IMAGE_PROPERTY,
        address: {
          description:
            "The address to start decoding at, EXPLICITLY. Integer 0..65535, \"$hex\" or \"0x\" string; an unprefixed " +
            "numeric string is refused.",
        },
        end_address: {
          description:
            "Optional last address to decode, INCLUSIVE. Omitted, the extent is the byte cap (or the end of the image, " +
            "whichever comes first).",
        },
      },
      required: ["image", "address"],
    },
  },
  {
    name: "anno_read_region",
    description:
      "Reads ONE routine or table at an explicit inclusive address range, instead of exporting the whole program. " +
      "`view: 'disasm'` is what routine documentation wants; `view: 'hexdump'` is what data-table classification and " +
      "table extraction want; omitted, the view is 'disasm'. The combined byte count (end_address - start_address + 1) " +
      "is capped, and the SAME cap governs anno_disassemble -- one cap, both views. A request above the cap is REFUSED " +
      "by name, naming the cap and the requested width, rather than silently truncated: a full-64K disassembly view " +
      "dumped into an agent's context is exactly the hazard the cap exists to prevent, and this family is not chunked, " +
      "so the cap is the only bound there is.",
    inputSchema: {
      type: "object",
      properties: {
        ...IMAGE_PROPERTY,
        start_address: { description: "Start of the range, INCLUSIVE. Integer, \"$hex\" or \"0x\" string." },
        end_address: { description: "End of the range, INCLUSIVE." },
        view: {
          type: "string",
          enum: ["disasm", "hexdump"],
          description: "'disasm' = rendered 6510 source. 'hexdump' = raw hex bytes. Omitted defaults to 'disasm'.",
        },
      },
      required: ["image", "start_address", "end_address"],
    },
  },
  {
    name: "anno_get_binary_info",
    description:
      "Reports what the named image FILE is: how it was dispatched (a .prg's 2-byte little-endian load address, or a " +
      "flat 64K capture's origin of 0), the origin, the total byte length, the payload byte length, and the Shannon " +
      "entropy of the payload -- a value above 7.5 suggests the image is compressed or packed and that a depack pass " +
      "is needed before any of it will decode sensibly. DISPATCH IS BY EXTENSION FIRST, never by byte length: a " +
      "truncated .raw capture that fell through to the .prg parser once produced an origin read backwards out of its " +
      "own payload bytes, exited zero, and made every downstream address silently wrong. A file too short to be a .prg " +
      "is REFUSED by name.",
    inputSchema: {
      type: "object",
      properties: { ...IMAGE_PROPERTY },
      required: ["image"],
    },
  },
  {
    name: "anno_get_cross_references",
    description:
      "Every address that references the address you name, unioned from three sources and returned ascending and " +
      "de-duplicated: the instructions decoded fresh out of every range typed `code`, the typed split ADDRESS tables " +
      "(the `_address` forms produce cross-references and the `_word` forms do not -- that is the schema's own " +
      "distinction, not a judgement made here), and the stored rows, which are the only half on disk and only because " +
      "a computed dispatch or a hand-asserted edge cannot be recovered from bytes at all. DERIVED ON EVERY CALL AND " +
      "NEVER CACHED: a cached derivation is a second on-disk truth that can disagree with the range table it came " +
      "from. `max_results` is REQUIRED with no default; the true total rides beside the truncated list.",
    inputSchema: {
      type: "object",
      properties: {
        ...IMAGE_PROPERTY,
        address: { description: "The target address to find references TO. Integer, \"$hex\" or \"0x\" string." },
        max_results: { type: "integer", description: "Maximum number of referencing addresses to return. REQUIRED -- no default." },
      },
      required: ["image", "address", "max_results"],
    },
  },
  {
    name: "anno_search",
    description:
      "Searches three corpora for a substring: label names, comment text, and the instruction text rendered from every " +
      "range typed `code`. MATCHING IS BYTE-EXACT AND CASE-SENSITIVE, applied identically to all three, and the rule " +
      "is restated in the body so an empty answer tells you which rule produced it. Every corpus is named in the body " +
      "with the number of entries it held, so a genuine zero over a real corpus is distinguishable from a corpus this " +
      "surface does not have. NAMING A CORPUS THIS SURFACE DOES NOT HAVE (any search_<name> other than the three) is " +
      "answered with `{available:false, reason}` in a SUCCESSFUL body -- not an error, because the request was " +
      "well-formed, and not an empty result set, because an empty result set for an unanswerable question is a lie " +
      "that reads like an answer. `max_results` is REQUIRED with no default: an implicit default would silently " +
      "truncate a full-program pass.",
    inputSchema: {
      type: "object",
      properties: {
        ...IMAGE_PROPERTY,
        query: { type: "string", description: "The substring to find. Case-sensitive and byte-exact. An empty query is refused -- that is a listing, not a search." },
        max_results: { type: "integer", description: "Maximum number of hits to return. REQUIRED -- no default on this surface." },
        search_labels: { type: "boolean", description: "Search the label-name corpus. Defaults to true." },
        search_comments: { type: "boolean", description: "Search the comment-text corpus. Defaults to true." },
        search_instructions: { type: "boolean", description: "Search the rendered instruction corpus. Defaults to true. This is the expensive one: it decodes every code range." },
      },
      required: ["image", "query", "max_results"],
    },
  },
  {
    name: "anno_get_address_details",
    description:
      "Everything this project knows about ONE address, composed from four reads: the labels bound there, the comments " +
      "there, the typed range that covers it (resolved narrowest-range-wins through the paint index, never by a " +
      "start/end bracket scan), and the cross-references that reach it. THE COMPOSITION IS DISCLOSED: the body carries " +
      "`composed_client_side` and a `composed_from` list naming all four sources, so a composition is never mistaken " +
      "for something the store held whole. A component with no answer comes back as `{available:false, reason}` rather " +
      "than as an empty list, so an address that genuinely has no comments stays distinguishable from a question this " +
      "composition could not put. Nothing is written on any path.",
    inputSchema: {
      type: "object",
      properties: {
        ...IMAGE_PROPERTY,
        address: { description: "The address to inspect. Integer, \"$hex\" or \"0x\" string." },
      },
      required: ["image", "address"],
    },
  },
  {
    name: "anno_batch_execute",
    description:
      "Executes several curated anno_* calls against ONE store, in order, inside one open/close pair. Use it for a " +
      "multi-edit pass -- marking many regions, renaming many labels -- and not for calls that depend on each other's " +
      "results. The image, when the inner calls need one, is named ONCE at the top level and every inner call " +
      "inherits it, INCLUDING through nesting -- a batch inside a batch inherits it too, and so do that batch's own " +
      "inner calls. TWO PHASES, and the difference matters " +
      "when you read the answer. FIRST, the whole payload is pre-validated before anything is opened: a malformed " +
      "payload, an EMPTY calls array, a malformed entry, an inner name outside the curated set at any depth, an " +
      "illegal label name, or an over-cap region range refuses the WHOLE batch by index, and nothing executes. " +
      "SECOND, execution runs to COMPLETION, pushing a success or error status for every entry and never aborting on " +
      "the first failure. So `isError:true` means this batch should never have been sent; an error ENTRY inside a " +
      "successful result means that one call did not work. Nesting deeper than " +
      String(ANNO_MAX_BATCH_DEPTH) +
      " levels is refused by name rather than walked.",
    inputSchema: {
      type: "object",
      properties: {
        image: {
          type: "string",
          clientFile: true,
          description:
            "Optional program image, inherited by every inner call that derives an answer from bytes. Required only " +
            "if the batch contains such a call.",
        },
        calls: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "The curated anno_* verb to run. An uncurated name refuses the WHOLE batch." },
              arguments: { type: "object", description: "That verb's own arguments, minus the image, which the batch supplies." },
            },
            required: ["name", "arguments"],
          },
          description: "The calls to run, in order. Must be a NON-EMPTY array: an empty batch is refused, never run as a zero-length success.",
        },
      },
      required: ["calls"],
    },
  },
  {
    name: "anno_import_ghidra_export",
    description:
      "Imports a host-written Ghidra export transfer file (GhidraStructExport.java's `## `-delimited format) into " +
      "the store, writing one anno_xref row per surviving `## REFERENCES` line and DELETING the transfer file once " +
      "every write has durably committed. Costs one store open and one close. REFUSES, writes nothing and deletes " +
      "nothing: on a malformed, truncated or digest-mismatched export (naming the section and the offending line), " +
      "on an export_path that resolves outside the workspace root, or on an absent transfer file. Reports " +
      "referencesSeen, xrefsWritten, xrefsAlreadyPresent (duplicate references are deduped, never double-counted), " +
      "and kindsSeenNotImported -- reference types this store's four-member vocabulary does not carry, dropped and " +
      "counted rather than refused, because a real corpus binary carries ordinary jump and call references " +
      "constantly. Every written row's bank column is null: this verb does not resolve bank state itself. Also " +
      "reports constWrites -- the export's `## CONST_WRITES` facts (recovered $01/$D011/$D018/$DD00 stores), always " +
      "present (possibly empty). The transfer file naming them is DELETED by this same call (IMP-02), so this " +
      "return value is the only place they survive: pass the SAME constWrites array, unchanged, to a following " +
      "anno_join_memmap call's own const_writes argument to activate bank-state resolution (AUTO-04/AUTO-05) and " +
      "VIC-register graphics-range derivation (AUTO-06/AUTO-07) for this image.",
    inputSchema: {
      type: "object",
      properties: {
        export_path: {
          type: "string",
          clientFile: true,
          description:
            "Absolute or workspace-relative path to the host-written transfer file. CONSUMED AND DELETED by a " +
            "successful call -- refused if it resolves outside the workspace root, including via a symlink.",
        },
        sha256: {
          type: "string",
          description:
            "Optional sha256 digest the producer reported for the transfer file's bytes. When supplied, a mismatch " +
            "against the file's own computed digest refuses the whole call before anything is read further -- a " +
            "corruption/drift detector, never a security boundary.",
        },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["export_path"],
    },
  },
  {
    name: "anno_join_memmap",
    description:
      "The mechanical join: reads every distinct cross-reference target the store already holds, skips addresses " +
      "inside the supplied image's own loaded range (those are program addresses, never looked up), and annotates " +
      "every remaining address with the narrowest c64-memory-mapping/memmap.json entry containing it. No agent " +
      "call, no queue walk and no skill invocation anywhere in this call. Reports addressesConsidered, annotated, " +
      "skippedInImage, skippedNoMapEntry, declined and commentsChanged, plus a per-address decisions array naming " +
      "the outcome and, for every skip, WHY. Running this twice over an unchanged store reports commentsChanged: 0 " +
      "on the second run -- re-running a join pass is not an error. Passing const_writes (typically the SAME " +
      "constWrites array anno_import_ghidra_export just returned for this image, unchanged) additionally activates " +
      "bank-state resolution: a $01-conditional address (AUTO-04) declines with a named reason rather than " +
      "guessing when the reaching processor-port value is absent or disagreeing (AUTO-05), and VIC-register " +
      "graphics ranges are derived and written back (AUTO-06/AUTO-07, graphics_map_index selects which of several " +
      "derived combinations when more than one exists, default 0). Omitting const_writes entirely is a complete " +
      "no-op for both of these -- every address resolves exactly as if this argument did not exist.",
    inputSchema: {
      type: "object",
      properties: {
        ...IMAGE_PROPERTY,
        ...BASE_REVISION_PROPERTY,
        const_writes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              store_address: { type: "integer", description: "The instruction's own address that performed the store." },
              target_address: { type: "integer", description: "The watched hardware address ($0001/$D011/$D018/$DD00) written to." },
              value: { type: "integer", description: "The compile-time constant value written." },
            },
            required: ["store_address", "target_address", "value"],
          },
          description:
            "Optional recovered const-write facts (AUTO-04/AUTO-05/AUTO-06/AUTO-07) -- pass back the constWrites " +
            "array anno_import_ghidra_export returned for the SAME image, unchanged. Supplying it (even []) " +
            "activates bank-state resolution and graphics-range derivation/write-back; omitting it entirely is a " +
            "complete no-op for both.",
        },
        graphics_map_index: {
          type: "integer",
          description:
            "Which of several derived VIC-register-value combinations to write back as graphics ranges, when " +
            "const_writes yields more than one distinct combination (D-37-27: several valid maps are never merged " +
            "into one). Defaults to 0. Consulted ONLY when const_writes is supplied at all. Out of range for the " +
            "derived map count REFUSES the whole call rather than silently clamping or picking a default.",
        },
      },
      required: ["image"],
    },
  },
  {
    name: "anno_evid_ingest",
    description:
      "Turns one raw memmapshow reply plus one run identity into durable runtime-execution evidence rows, so a later " +
      "session can query what the emulator actually executed instead of re-running the program. Writes a row ONLY for " +
      "an OBSERVED execute bit: an address memmapshow mentioned with read or write access but no execute gets NO row, " +
      "and an address the reply never mentioned at all gets NO row either -- an address with no row is the ABSENCE of " +
      "an assertion, never an assertion that the address is data. Requires the EXACT launch argv and digests it itself " +
      "(argv_digest is never accepted as an argument), so a caller cannot invent a run identity. A memmapshow reply " +
      "this surface cannot parse is REFUSED, naming its refusal code and offending line, rather than partially " +
      "absorbed -- nothing is written on a refusal. Re-ingesting the SAME reply for the SAME run identity succeeds " +
      "and reports changed:false with observationsWritten:0 -- re-running an ingest pass is not an error. Every count " +
      "in the answer carries a denominator (addressesQueried) beside it; no percentage is ever reported.",
    inputSchema: {
      type: "object",
      properties: {
        memmap_text: {
          type: "string",
          description:
            "The raw memmapshow reply exactly as the text monitor returned it -- never a pre-parsed object. A reply " +
            "this parser cannot decode is REFUSED, naming its refusal code and offending line; nothing is written.",
        },
        image_sha256: {
          type: "string",
          description:
            "The program image this run executed, named by the sha256 digest of its own bytes -- exactly 64 " +
            "lowercase hex characters. This verb does not read image bytes itself and accepts no path to one.",
        },
        argv: {
          type: "array",
          items: { type: "string" },
          description:
            "The EXACT emulator launch argument vector, including argv[0] -- a different binary is a different " +
            "launch. This verb digests it itself; a pre-computed digest is never accepted, so a caller cannot invent " +
            "a run identity.",
        },
        seed: {
          type: "string",
          description: "The determinism seed the launch pinned. A non-empty string; not a digest and carries no shape beyond that.",
        },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["memmap_text", "image_sha256", "argv", "seed"],
    },
  },
  {
    name: "anno_evid_disagreements",
    description:
      "Answers where the byte-derived block classification and the observed-execution evidence DISAGREE, with the " +
      "disagreements reported FIRST: an address the block table calls 'data' at which the emulator was observed " +
      "executing is proof a byte-derived guess was wrong, from a source (real execution) that never saw the guess. " +
      "Agreement (block table says 'code', evidence confirms it) is reported as agreementCount ONLY -- never as rows, " +
      "because a wall of agreeing rows would bury the one output this query exists to surface. An address the block " +
      "table covers with NO observation anywhere is blockCoveredNeverObservedCount, and is NOT evidence that the " +
      "address is data -- an address never observed executing proves nothing. Two further counts " +
      "(observedOutsideAnyBlockCount, observedAtUndefinedBlockCount) name evidence about addresses the block table " +
      "does not classify as code or data at all, so the denominator can never quietly drop real evidence. This verb " +
      "READS the block table and the runtime evidence table; it writes to NEITHER, and a repeated call never changes " +
      "either. Optional image_sha256/argv_digest/seed scope the question to ONE run identity's observations rather " +
      "than the union across every run that has ever contributed -- supply all three together or none; a partial " +
      "identity is refused. max_results bounds the returned disagreements array only, and is OPTIONAL (an empty or " +
      "small disagreement report is the ordinary, sound case, so no ceiling is forced); the true disagreement count " +
      "and whether truncation occurred are always reported beside it. Every count in the answer carries denominator " +
      "beside it; no percentage or rate is ever formed.",
    inputSchema: {
      type: "object",
      properties: {
        max_results: {
          type: "integer",
          description:
            "Optional bound on the returned disagreements array only. Unlike every other list-returning anno_* verb, " +
            "this is NOT required -- an empty or small disagreement report is the ordinary, sound case. When " +
            "supplied, must be a positive integer.",
        },
        image_sha256: {
          type: "string",
          description:
            "Optional run-identity filter: the program image this run executed, exactly 64 lowercase hex characters. " +
            "Supply image_sha256, argv_digest AND seed together to scope to one run, or omit all three to see the " +
            "union across every run this store holds.",
        },
        argv_digest: {
          type: "string",
          description:
            "Optional run-identity filter: the exact digest anno_evid_ingest/anno_evid_runs already computed for a " +
            "run's launch argv, exactly 64 lowercase hex characters. Never invented by a caller -- pass back what " +
            "anno_evid_runs reported. Required alongside image_sha256/seed when filtering by run identity.",
        },
        seed: {
          type: "string",
          description:
            "Optional run-identity filter: the determinism seed that run's launch pinned. A non-empty string. " +
            "Required alongside image_sha256/argv_digest when filtering by run identity.",
        },
      },
      required: [],
    },
  },
  {
    name: "anno_evid_runs",
    description:
      "Answers every run identity the store holds an observed-execution row for, with its accumulated observation " +
      "count and the denominator that count is a fraction of -- so a later session can see what evidence already " +
      "exists without re-running the program. However many runs contribute observations, their union is NEVER " +
      "exhaustive coverage of the image: observationCount is a count against denominator, never a rate, and this " +
      "verb forms no percentage from it.",
    inputSchema: {
      type: "object",
      properties: {
      },
      required: [],
    },
  },
  {
    name: "anno_evid_reset",
    description:
      "Clears every observed-execution row for ONE run identity, so that bracket can be re-measured from nothing. " +
      "Touches no other run identity's rows and no row of the byte-derived block table. Requires the EXACT launch " +
      "argv and digests it itself (a pre-computed digest is never accepted), so a caller cannot invent a run identity " +
      "-- the same discipline anno_evid_ingest uses. A run identity holding no observations SUCCEEDS and reports " +
      "changed:false and observationsRemoved:0 -- resetting an empty bracket is the ordinary thing, not a mistake. " +
      "Clearing the emulator's own accumulated access map is a DIFFERENT operation, reached through vice_memmap_zap " +
      "-- a caller re-measuring a bracket from nothing does BOTH: vice_memmap_zap on the emulator side, " +
      "anno_evid_reset on the store side.",
    inputSchema: {
      type: "object",
      properties: {
        image_sha256: {
          type: "string",
          description:
            "The program image this run executed, named by the sha256 digest of its own bytes -- exactly 64 " +
            "lowercase hex characters. This verb does not read image bytes itself and accepts no path to one.",
        },
        argv: {
          type: "array",
          items: { type: "string" },
          description:
            "The EXACT emulator launch argument vector, including argv[0] -- a different binary is a different " +
            "launch. This verb digests it itself; a pre-computed digest is never accepted, so a caller cannot invent " +
            "a run identity.",
        },
        seed: {
          type: "string",
          description: "The determinism seed the launch pinned. A non-empty string; not a digest and carries no shape beyond that.",
        },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["image_sha256", "argv", "seed"],
    },
  },
  {
    name: "anno_hazard_report",
    description:
      "Enumerates what blocks a program's code or data from being MOVED, relocated, rebased or stripped, across " +
      "the movement-hazard constructions this surface can detect from decoded bytes alone. It REPORTS " +
      "and changes NOTHING: it never removes, strips, relocates or rebases any part of the image, and it never " +
      "emits an instruction, flag or field a caller could act on as an automatic relocation -- the operator " +
      "decides what happens to the bytes it describes. Each finding carries its own detection mechanism and a " +
      "detection-strength token (observed-corroborated, static-shape-matched, static-signature-only) -- a " +
      "SEPARATE, smaller vocabulary from this store's own five-grade confidence grades, answering a different " +
      "question (how strong is this ONE static signal, never what does this address classify as). Every checked " +
      "region reports exactly one of three outcomes -- hazard-reported, no-signal, unclassified -- and NONE of " +
      "them is a safety claim: a region with no finding is explicitly NOT a claim that the region is safe to " +
      "move, clean, or hazard-free, only that nothing this report knows how to look for fired there. " +
      "Always-emitted named limits (for example, a self-modification through a runtime-computed pointer is " +
      "undetected by construction) accompany every answer. Opens the store READ-ONLY and reads no other table: " +
      "this verb creates nothing and writes nothing.",
    inputSchema: {
      type: "object",
      properties: {
        ...IMAGE_PROPERTY,
        max_results: {
          type: "integer",
          description:
            "Optional bound on the returned findings array only. Unlike most list-returning anno_* verbs, this is " +
            "NOT required -- an empty or small finding set is the ordinary, sound case. When supplied, must be a " +
            "positive integer.",
        },
      },
      required: ["image"],
    },
  },
];

/** The allow-list, DERIVED from the definitions above rather than hand-typed
 * (T-29-02): a name cannot be curated in one place and absent from the other,
 * because there is only one place. */
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

function assertSaveProjectArgs(args: unknown, batchIndex?: number): void {
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
function assertEvidRunsArgs(args: unknown, batchIndex?: number): void {
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
        "annotations, never bytes, and an omitted image would read as a plausible success against whatever was recorded last (D-07).",
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
    throw new AnnoUncuratedToolError(
      `anno_batch_execute refused: nesting deeper than ${ANNO_MAX_BATCH_DEPTH} levels -- refused BY NAME rather than walked, ` +
        "because an unbounded walk over an attacker-shaped payload is a stack-exhaustion route (T-29-24). Flatten the batch.",
      { toolName: "anno_batch_execute" },
    );
  }
  if (!isPlainObject(args) || !Array.isArray(args.calls)) {
    throw new AnnoUncuratedToolError(
      'anno_batch_execute refused: "calls" must be an array of {name, arguments} objects -- a malformed batch payload is ' +
        "treated as a REFUSAL, never as an empty batch that passes through.",
      { toolName: "anno_batch_execute" },
    );
  }
  const calls = args.calls as unknown[];
  if (calls.length === 0) {
    throw new AnnoUncuratedToolError(
      'anno_batch_execute refused: "calls" is an EMPTY array. A zero-length batch is an ambiguous request, and running it as a ' +
        "zero-length success would be a plausible-looking zero -- the caller would be told a pass completed when nothing was asked for.",
      { toolName: "anno_batch_execute" },
    );
  }
  calls.forEach((call, i) => {
    if (!isPlainObject(call) || typeof call.name !== "string") {
      throw new AnnoUncuratedToolError(
        `anno_batch_execute refused WHOLE: calls[${i}] is malformed (missing a string "name") -- treated as a refusal, never ` +
          "as an empty batch that passes through.",
        { toolName: "anno_batch_execute", batchIndex: i },
      );
    }
    if (!CURATED_ANNO_TOOLS.includes(call.name)) {
      throw new AnnoUncuratedToolError(
        `anno_batch_execute refused WHOLE: calls[${i}].name "${call.name}" is outside the curated anno_* tool surface -- a batch ` +
          "is refused whole if any inner name is outside the curated set (D-33).",
        { toolName: call.name, batchIndex: i },
      );
    }
    if (call.name === "anno_batch_execute") {
      // RECURSES ON THE EFFECTIVE ARGUMENTS, NOT THE RAW BAG, and that is the
      // whole of CR-06. Phase two -- `dispatchBatchExecute()` -- has always
      // recursed on `batchArgumentsFor(bag, call)`; phase one used to recurse
      // on `call.arguments`. The two phases therefore disagreed about what the
      // inner payload WAS, and a nested batch written the documented way (the
      // image named ONCE at the top, every inner call inheriting it) was
      // refused whole at every depth. Read this line as a pair with the executor's recursion:
      // one function, `batchArgumentsFor()`, defines an inner call's effective
      // arguments, and both phases ask it.
      assertAnnoBatch(batchArgumentsFor(args, call), depth + 1);
      return;
    }
    assertVerbArgs(call.name, batchArgumentsFor(args, call), i);
  });
}

/** An inner call's effective arguments: its own, plus the batch's image when
 * the batch names one, which overrides an inner image. */
export function batchArgumentsFor(batchArgs: Record<string, unknown>, call: Record<string, unknown>): Record<string, unknown> {
  return { ...argBag(call.arguments), ...(batchArgs.image !== undefined ? { image: batchArgs.image } : {}) };
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

/** The verbs that only READ. A caller may open a read-only connection for
 * them, which is strictly the safer open. Derived from nothing -- it is a
 * hand-listed property of each verb, and a verb missing from here is merely
 * opened writably, never wrongly refused. */
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
  const definition = ANNO_TOOL_DEFINITIONS.find((d) => d.name === name);
  if (definition === undefined) return [];
  return Object.entries(definition.inputSchema.properties)
    .filter(([, schema]) => isPlainObject(schema) && schema.clientFile === true)
    .map(([key]) => key);
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
