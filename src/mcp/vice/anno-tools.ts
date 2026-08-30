#!/usr/bin/env node
// anno-tools.ts
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: the curated `anno_*` tool
// surface. The `AnnoToolDefinition`s themselves (`ANNO_TOOL_DEFINITIONS`), the
// allow-list DERIVED from them (`CURATED_ANNO_TOOLS`), its enforcement
// (`assertAnnoTool()`) together with the per-verb argument validators that gate
// shares with the batch verb, the caller-supplied store-path validation, and
// the runner (`runAnnoTool()`) that opens the owned annotation store, answers
// exactly one call against it, and closes it again. No other module may
// hand-list a curated `anno_*` name, hand-validate an `anno_*` store path, or
// reach `anno-store.ts` on behalf of an MCP call -- `vice-proxy.ts` imports
// `ANNO_TOOL_DEFINITIONS` and `runAnnoTool` from here and nothing else.
//
// WHY THIS FILE EXISTS, in the words of the decisions that shaped it:
//
//   D-05 (ONE PREFIX). `anno_` names the tools, `anno-` names the modules.
//   There is no second annotation family advertised alongside this one: the
//   registration loop in `vice-proxy.ts` was SUBSTITUTED, not appended to, so
//   an agent never has to choose between two surfaces over the same subject.
//   `stock-dispatch.test.ts`'s ordered two-entry `BACKEND_SEAM_BYPASS_KEYS`
//   goes red the instant a second family is registered beside this one.
//
//   D-06 (OPEN/CLOSE PER CALL, EXPLICIT `store` ON EVERY VERB). This module
//   holds NO module-level store handle and no ambient "current store" -- every
//   verb takes `store` as an argument, `runAnnoTool()` opens it, and the
//   `finally` below closes it on every path including the throwing one. That
//   is why there is no session to crash, no revision to go stale between
//   calls, and nothing for a second concurrent caller to corrupt: the store is
//   open for the duration of one tool call and not one instruction longer.
//
//   D-07 (EVERY DERIVED READ NAMES ITS OWN IMAGE). The store holds
//   annotations, never program bytes. Every verb that derives an answer FROM
//   the bytes -- the disassembly, the region read, the binary info, the
//   cross-references, the search, the address details -- takes an explicit
//   `image` path. An optional-argument-with-fallback hybrid was rejected
//   outright: an omitted argument would read as a plausible-looking success
//   against whatever image happened to be recorded last.
//
//   D-09 (THERE IS NO CURSOR, ANYWHERE). Upstream's own procedure text says
//   never to rely on a current cursor address, and this project has no editor
//   to have one. The verb that would have exposed it is folded into
//   `anno_disassemble`'s explicit address argument. Nothing on this surface --
//   no identifier, no schema property, no dispatch branch -- names a cursor or
//   a current address, and `anno-tools.test.ts` asserts that over this file's
//   comment-and-string-stripped source so this paragraph cannot satisfy the
//   check by containing the word.
//
//   MCP-02 (THE HOST-PATH SEAM IS UNREACHABLE FROM HERE, BY CONSTRUCTION).
//   CLAUDE.md requires derived tools to be intercepted before
//   `forwardToVice()`, because `rewriteArguments()` runs inside it and would
//   hand a container-translated path to a runner acting proxy-locally. This
//   family needs no such interception: `runAnnoTool()` is registered through
//   `buildViceTool()` directly, so it can never reach `forwardToVice()`,
//   `call()` or `ensureViceSession()`, and this module must never import
//   `hostpath.ts` -- `hostpath-consumers.test.ts` names it as forbidden and
//   keeps that consumer set at exactly five modules. Both the store path and
//   the image path are PROXY-LOCAL filesystem paths and translating either
//   would point this code at a file on the wrong side of the container
//   boundary.
//
// TWO REFUSAL CHANNELS, AND THE DIFFERENCE IS DELIBERATE:
//
//   1. AN INVALID ARGUMENT resolves `{isError:true}` naming the
//      `AnnoStoreError` subclass that fired. The caller passed something this
//      surface cannot act on, and it should not send it again unchanged.
//   2. A WELL-FORMED REQUEST THIS SURFACE CANNOT ANSWER resolves
//      `{isError:false}` carrying `{available:false, reason}` in the body.
//      That is not a caller error -- the question was legal, the answer is
//      "no". Returning `isError:true` for it teaches an agent to retry
//      something that will never succeed; returning `[]` or `0` for it is the
//      plausible-looking zero MCP-04 exists against. Every reason names what
//      was asked for, why it cannot be answered, and where the nearest
//      answerable thing lives, in the shape `stock-cia.ts:116-124` established
//      and at the >= 40-character length `check-skill-tool-coverage.mjs:285`
//      already enforces in CI.
//
// `anno_batch_execute` IS THE ONE SANCTIONED NESTED-ARGUMENT VERB ON THIS
// SURFACE, AND NO SECOND MAY JOIN IT. A meta-tool that takes an arbitrary tool
// name inside its own arguments is precisely the smuggling shape `vice.ts`'s
// `DENY_LIST` exists to close: the outer name passes the gate while the inner
// name never sees it. This one verb earns the exception by being the only
// route to the multi-edit pass an annotation run actually performs, and it
// pays for it with `assertAnnoBatch()` below -- a recursive, DEPTH-CAPPED
// pre-validator that refuses the WHOLE batch, before any store is opened, if
// anything at any depth is wrong. Adding a second such verb would reopen the
// hole this one closes.
//
// WHAT NOT TO DO:
//   - Never hand-type a second list of curated names. `CURATED_ANNO_TOOLS` is
//     derived from `ANNO_TOOL_DEFINITIONS`'s own `name` values precisely so a
//     name cannot be curated in one place and absent from the other (T-29-02).
//   - Never widen `CURATED_ANNO_TOOLS` without adding the definition here with
//     a named criterion. The gate's FIRST statement is set membership; a name
//     that is not in the set is refused before any argument is looked at.
//   - Never re-implement an argument rule the store already owns. Addresses go
//     through `parseStoreAddress`, ranges through `assertRangeShape`, data
//     types through `assertDataType`, label names through `assertLegalLabel`,
//     comment text through `assertCommentText`, enum names through
//     `assertEnumName`. A second, divergent rule here would accept a value the
//     store then refuses, or the reverse, and the disagreement would be
//     invisible because both look authoritative.
//   - Never sanitize. An illegal label, enum name or comment is REJECTED by
//     name, never quoted, trimmed, coerced or normalized into a legal one:
//     the store's printed name must never diverge from the symbol an export
//     would emit (T-29-23).
//   - Never add a second comment-length check or a truncation. The byte bound
//     is `assertCommentText()`'s and it is measured in UTF-8 BYTES, not code
//     units; this layer adds nothing on top of it.
//   - Never map `changed: false` to an error. A repeated identical edit
//     SUCCEEDING while reporting no change is the store's own idempotency, and
//     an agent re-running an annotation pass must not have to diff first.
//   - Never drop `contradictedComments` or `reinterpretedSplitTables` from
//     `anno_set_data_type`'s body. 28-VERIFICATION.md hands this phase the
//     obligation in writing: the disclosure must be SURFACED where the human
//     sees it, or the human never sees it. A success that quietly drops it is
//     exactly the plausible-looking clean answer this surface forbids.
//   - Never move `assertAnnoTool()` out of `runAnnoTool()`'s `try`. That
//     asymmetry is WR-02, recorded as out of scope at `r2000-tools.ts:772-774`
//     and CLOSED here: inside the `try`, a refusal RESOLVES `{isError:true}`
//     like every other failure instead of REJECTING the returned promise, so
//     the caller has one shape to handle rather than two.
//   - Never resolve a store or image path with `resolve()` + `startsWith`.
//     Containment goes through `storePathWithinWorkspace()`, which resolves the
//     deepest EXISTING ancestor's realpath (WR-01) -- a not-yet-existing leaf
//     under a directory symlink escaped the naive form entirely.
//   - Never hold the handle beyond the call, and never open a store outside a
//     `try`/`finally` that closes it (T-29-03).
//   - Never collapse a failure into a bare string. The runner's catch names
//     the error CLASS, so a caller can tell an `AnnoStoreCorruptError` from an
//     `AnnoStorePathError` from the text alone (T-29-04, D18-12).
//
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

import {
  addScope,
  applyEnumUsage,
  clearEnumUsage,
  closeStore,
  createProjectEnum,
  currentRevision,
  listComments,
  listEnumUsage,
  listLabels,
  listProjectEnums,
  listRanges,
  listScopes,
  openStore,
  removeScope,
  setComment,
  setDataType,
  setLabel,
  updateProjectEnum,
} from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
import {
  AnnoRevisionArgumentError,
  AnnoStoreError,
  AnnoStorePathError,
  assertCommentText,
  assertCommentType,
  assertDataType,
  assertEnumName,
  assertLabelKind,
  assertLegalLabel,
  assertRangeShape,
  parseStoreAddress,
  storePathWithinWorkspace,
} from "./anno-types.ts";
import type { AnnoStoreErrorOptions, CommentRow, LabelRow } from "./anno-types.ts";
import { crossReferencesTo, searchAnnotations } from "./anno-derive.ts";
import { composeAddressDetails } from "./anno-details.ts";
import { decode } from "./disasm-decoder.ts";
import { render } from "./disasm-renderer.ts";
import { flatImageOrigin, parsePrg } from "./prg-image.ts";
import { repoRoot } from "./repo-root.ts";

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

interface ToolCallResult {
  content: { type: "text"; text: string }[];
  isError: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function okText(text: string): ToolCallResult {
  return { content: [{ type: "text", text }], isError: false };
}

function errText(text: string): ToolCallResult {
  return { content: [{ type: "text", text }], isError: true };
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
// discipline `r2000-tools.ts:790-800` records -- one validator per verb, called
// from both sites, so a refusal fires identically either way.
// ---------------------------------------------------------------------------

function argBag(args: unknown): Record<string, unknown> {
  return isPlainObject(args) ? args : {};
}

function whereOf(batchIndex?: number): string {
  return batchIndex !== undefined ? ` (calls[${batchIndex}])` : "";
}

function refuseArg(name: string, argument: string, detail: string, batchIndex?: number): never {
  throw new AnnoToolArgumentError(`${name} refused${whereOf(batchIndex)}: ${detail}`, { toolName: name, argument, batchIndex });
}

/** Narrows the universally-required `store` argument to a non-empty string.
 * Path CONTAINMENT is a separate concern and lives in `resolveWorkspacePath()`
 * below; this only establishes that there is a path to contain. */
function assertStoreArg(name: string, args: unknown, batchIndex?: number): string {
  const bag = argBag(args);
  if (typeof bag.store !== "string" || bag.store.trim() === "") {
    refuseArg(
      name,
      "store",
      '"store" must be a non-empty string naming an annotation store -- every anno_* verb names its own store (D-06), ' +
        "because there is no ambient current store to inherit.",
      batchIndex,
    );
  }
  return bag.store as string;
}

/** Narrows `max_results` to a positive integer. Required, with no default:
 * see the description on each list-returning definition for why a silent
 * default is worse than a refusal here. */
function assertMaxResults(name: string, args: unknown, batchIndex?: number): number {
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
 * `anno-store.ts`'s own `assertRevisionArgument` is module-private, so this
 * throws that module's OWN exported `AnnoRevisionArgumentError` rather than a
 * fourth class: WR-22's recorded failure was a revision-shaped argument
 * (`"0001"`) surviving as far as SQLite, whose INTEGER affinity turned an
 * argument error into a corruption refusal. A caller must be able to tell
 * "you passed the wrong thing" from "the annotations are gone" BY CLASS. */
function assertBaseRevisionArg(name: string, args: unknown, batchIndex?: number): number | undefined {
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
// `store` is on EVERY definition and is always required (D-06). There is no
// "current store" for a verb to inherit, which is what makes a call's effect a
// function of its own arguments alone. Each description is written for an
// AGENT: what the verb answers, what it costs, and what it will refuse.
// ---------------------------------------------------------------------------

/** How deep a nested `anno_batch_execute` may go before the payload is refused
 * by name rather than walked (T-29-24). Four levels is far past any legitimate
 * use -- a batch of batches of batches has no procedure behind it -- and is
 * chosen to be obviously sufficient rather than tuned. */
export const ANNO_MAX_BATCH_DEPTH = 4;

const STORE_PROPERTY = {
  store: {
    type: "string",
    description:
      "Absolute or workspace-relative path to the .annostore annotation store. Refused if it resolves outside the " +
      "workspace root, including via a symlink. REQUIRED on every verb: there is no ambient 'current store'.",
  },
} as const;

const IMAGE_PROPERTY = {
  image: {
    type: "string",
    description:
      "Absolute or workspace-relative path to the program image this answer is DERIVED from -- a .prg (2-byte " +
      "little-endian load address plus payload) or an exactly-65536-byte flat capture (.raw/.bin, dispatched by " +
      "extension before any length check). REQUIRED on every derived read (D-07): the store holds annotations and " +
      "never bytes, so an omitted image would read as a plausible success against whatever was recorded last. " +
      "Refused if it resolves outside the workspace root, including via a symlink.",
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
        ...STORE_PROPERTY,
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
      required: ["store", "address", "name"],
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
        ...STORE_PROPERTY,
        address: { description: "The address to comment. Integer, \"$hex\" or \"0x\" string; an unprefixed numeric string is refused." },
        comment: { type: "string", description: "The comment text, without the ';' prefix." },
        type: {
          type: "string",
          enum: ["line", "side"],
          description: "'line' = own line before the instruction. 'side' = inline on the same line.",
        },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["store", "address", "comment", "type"],
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
        ...STORE_PROPERTY,
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
      required: ["store", "start_address", "end_address", "data_type"],
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
      "start refuse -- use anno_remove_scope to undo it rather than burning revisions off the 32-deep snapshot ring.",
    inputSchema: {
      type: "object",
      properties: {
        ...STORE_PROPERTY,
        start_address: { description: "Start of the scope, INCLUSIVE. Integer, \"$hex\" or \"0x\" string." },
        end_address: { description: "End of the scope, INCLUSIVE." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["store", "start_address", "end_address"],
    },
  },
  {
    name: "anno_remove_scope",
    description:
      "Removes the scope whose span is EXACTLY start_address..end_address -- the inverse of anno_add_scope, and the " +
      "recovery route for a transposed span, which would otherwise be undoable only by reverting through the 32-deep " +
      "snapshot ring. The span must match both stored ends exactly: a scope is never trimmed, split or partially " +
      "removed, because a partial removal would leave a shape nothing downstream can express while reporting success. " +
      "Read the stored spans with anno_get_blocks (include: [\"scopes\"]) first if you are unsure. Removing a scope " +
      "that is not there SUCCEEDS and reports `changed: false`.",
    inputSchema: {
      type: "object",
      properties: {
        ...STORE_PROPERTY,
        start_address: { description: "Start of the scope to remove, INCLUSIVE. Must match the stored start exactly." },
        end_address: { description: "End of the scope to remove, INCLUSIVE. Must match the stored end exactly." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["store", "start_address", "end_address"],
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
        ...STORE_PROPERTY,
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
      required: ["store", "max_results"],
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
        ...STORE_PROPERTY,
        max_results: { type: "integer", description: "Maximum number of comments to return. REQUIRED -- no default on this surface." },
        addresses: {
          type: "array",
          description: "Optional list of specific addresses. Integers, \"$hex\" or \"0x\" strings; unprefixed numeric strings are refused.",
        },
        start_address: { description: "Optional lower bound (inclusive) of the address window." },
        end_address: { description: "Optional upper bound (inclusive) of the address window." },
        type: { type: "string", enum: ["line", "side"], description: "Optional placement filter." },
      },
      required: ["store", "max_results"],
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
        ...STORE_PROPERTY,
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
      required: ["store", "max_results"],
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
        ...STORE_PROPERTY,
        name: { type: "string", description: "Unique identifier: a letter or underscore, then letters/digits/underscores. Refused, never sanitized." },
        variants: {
          type: "object",
          description: "Variant mapping. Keys are numeric strings (decimal, 0x/$ hex, 0b/% binary); values are variant names.",
        },
        description: { type: "string", description: "Optional summary explaining the enum's purpose." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["store", "name", "variants"],
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
        ...STORE_PROPERTY,
        name: { type: "string", description: "Existing name of the enum to update." },
        new_name: { type: "string", description: "Optional new name. Same identifier rule; refused, never sanitized." },
        variants: { type: "object", description: "Optional COMPLETE replacement variants mapping. Omit to leave the mapping alone." },
        description: { type: "string", description: "Optional replacement description." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["store", "name"],
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
        ...STORE_PROPERTY,
        address: { description: "The instruction address. Integer, \"$hex\" or \"0x\" string; an unprefixed numeric string is refused." },
        name: { type: "string", description: "The enum to apply. OMIT, or pass an empty string, to CLEAR the association at this address." },
        ...BASE_REVISION_PROPERTY,
      },
      required: ["store", "address"],
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
      properties: { ...STORE_PROPERTY },
      required: ["store"],
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
      "silently truncated.",
    inputSchema: {
      type: "object",
      properties: {
        ...STORE_PROPERTY,
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
      required: ["store", "image", "address"],
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
        ...STORE_PROPERTY,
        ...IMAGE_PROPERTY,
        start_address: { description: "Start of the range, INCLUSIVE. Integer, \"$hex\" or \"0x\" string." },
        end_address: { description: "End of the range, INCLUSIVE." },
        view: {
          type: "string",
          enum: ["disasm", "hexdump"],
          description: "'disasm' = rendered 6510 source. 'hexdump' = raw hex bytes. Omitted defaults to 'disasm'.",
        },
      },
      required: ["store", "image", "start_address", "end_address"],
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
      properties: { ...STORE_PROPERTY, ...IMAGE_PROPERTY },
      required: ["store", "image"],
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
        ...STORE_PROPERTY,
        ...IMAGE_PROPERTY,
        address: { description: "The target address to find references TO. Integer, \"$hex\" or \"0x\" string." },
        max_results: { type: "integer", description: "Maximum number of referencing addresses to return. REQUIRED -- no default." },
      },
      required: ["store", "image", "address", "max_results"],
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
        ...STORE_PROPERTY,
        ...IMAGE_PROPERTY,
        query: { type: "string", description: "The substring to find. Case-sensitive and byte-exact. An empty query is refused -- that is a listing, not a search." },
        max_results: { type: "integer", description: "Maximum number of hits to return. REQUIRED -- no default on this surface." },
        search_labels: { type: "boolean", description: "Search the label-name corpus. Defaults to true." },
        search_comments: { type: "boolean", description: "Search the comment-text corpus. Defaults to true." },
        search_instructions: { type: "boolean", description: "Search the rendered instruction corpus. Defaults to true. This is the expensive one: it decodes every code range." },
      },
      required: ["store", "image", "query", "max_results"],
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
        ...STORE_PROPERTY,
        ...IMAGE_PROPERTY,
        address: { description: "The address to inspect. Integer, \"$hex\" or \"0x\" string." },
      },
      required: ["store", "image", "address"],
    },
  },
  {
    name: "anno_batch_execute",
    description:
      "Executes several curated anno_* calls against ONE store, in order, inside one open/close pair. Use it for a " +
      "multi-edit pass -- marking many regions, renaming many labels -- and not for calls that depend on each other's " +
      "results. The store (and the image, when the inner calls need one) is named ONCE at the top level and every " +
      "inner call inherits it, INCLUDING through nesting -- a batch inside a batch inherits it too, and so does that " +
      "batch's own inner calls; an inner `store` is overridden at every depth, never honoured. TWO PHASES, and the difference matters " +
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
        ...STORE_PROPERTY,
        image: {
          type: "string",
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
              arguments: { type: "object", description: "That verb's own arguments, minus store (and image), which the batch supplies." },
            },
            required: ["name", "arguments"],
          },
          description: "The calls to run, in order. Must be a NON-EMPTY array: an empty batch is refused, never run as a zero-length success.",
        },
      },
      required: ["store", "calls"],
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
  assertStoreArg("anno_get_symbols", args, batchIndex);
  assertMaxResults("anno_get_symbols", args, batchIndex);
  const bag = argBag(args);
  if (bag.start_address !== undefined) parseStoreAddress(bag.start_address, { what: "start_address" });
  if (bag.end_address !== undefined) parseStoreAddress(bag.end_address, { what: "end_address" });
}

function assertSetLabelArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_set_label_name", args, batchIndex);
  assertAddressArg("anno_set_label_name", args, "address", batchIndex);
  assertLegalLabelArg("anno_set_label_name", args, batchIndex);
  const bag = argBag(args);
  if (bag.kind !== undefined) assertLabelKind(bag.kind);
  assertBaseRevisionArg("anno_set_label_name", args, batchIndex);
}

function assertSetCommentArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_set_comment", args, batchIndex);
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
  assertStoreArg("anno_set_data_type", args, batchIndex);
  // ORDERING IS LOAD-BEARING, and it is the store's own: the data type is
  // narrowed FIRST because `assertRangeShape` needs it to decide whether the
  // even-byte-count rule applies at all.
  const dataType = assertDataType(argBag(args).data_type);
  assertSpanArgs("anno_set_data_type", args, dataType, batchIndex);
  assertBaseRevisionArg("anno_set_data_type", args, batchIndex);
}

function assertScopeArgs(name: string, args: unknown, batchIndex?: number): void {
  assertStoreArg(name, args, batchIndex);
  // "byte" selects the two shape rules that DO apply to a scope (both ends
  // inside the address space; the end not below the start) and none of the
  // ones that do not -- a scope is not a table, so a three-byte routine is a
  // perfectly good scope. This mirrors `addScope`'s own choice exactly.
  assertSpanArgs(name, args, "byte", batchIndex);
  assertBaseRevisionArg(name, args, batchIndex);
}

function assertGetCommentsArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_get_comments", args, batchIndex);
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
  assertStoreArg("anno_get_blocks", args, batchIndex);
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
  assertStoreArg("anno_create_project_enum", args, batchIndex);
  assertEnumNameArg("anno_create_project_enum", args, "name", batchIndex);
  const bag = argBag(args);
  if (!isPlainObject(bag.variants)) {
    refuseArg("anno_create_project_enum", "variants", '"variants" must be an object mapping numeric-string keys to variant names.', batchIndex);
  }
  if (bag.description !== undefined) assertCommentText(bag.description, { what: "description", allowLeadingSemicolon: true });
  assertBaseRevisionArg("anno_create_project_enum", args, batchIndex);
}

function assertUpdateEnumArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_update_project_enum", args, batchIndex);
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
function isEnumUsageClear(args: unknown): boolean {
  const raw = argBag(args).name;
  return raw === undefined || raw === "";
}

function assertApplyEnumUsageArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_apply_enum_usage", args, batchIndex);
  assertAddressArg("anno_apply_enum_usage", args, "address", batchIndex);
  if (!isEnumUsageClear(args)) assertEnumNameArg("anno_apply_enum_usage", args, "name", batchIndex);
  assertBaseRevisionArg("anno_apply_enum_usage", args, batchIndex);
}

function assertSaveProjectArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_save_project", args, batchIndex);
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
// THE CAP IS THE ONLY BOUND THERE IS FOR THIS FAMILY. `vice-proxy.ts`'s
// `wrapPossiblyChunked()` splits an oversized answer across a continuation
// sequence, but `buildViceTool()` calls `run` DIRECTLY, so nothing on this
// surface is chunked; and the client's own inline-response ceiling was measured
// at 40-60 KB, far below the proxy's 500,000-character output cap. That is why
// the second mitigation -- `max_results` REQUIRED with no default on every
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
function currentReadRegionMaxBytes(): number {
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
function assertWithinRegionCap(name: string, start: number, end: number, batchIndex?: number): void {
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
 * string. Containment is `resolveWorkspacePath()`'s concern, exactly as for the
 * store path. */
function assertImageArg(name: string, args: unknown, batchIndex?: number): string {
  const bag = argBag(args);
  if (typeof bag.image !== "string" || bag.image.trim() === "") {
    refuseArg(
      name,
      "image",
      '"image" must be a non-empty string naming the program image this answer is derived from -- the store holds ' +
        "annotations, never bytes, and an omitted image would read as a plausible success against whatever was recorded last (D-07).",
      batchIndex,
    );
  }
  return bag.image as string;
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
  assertStoreArg("anno_disassemble", args, batchIndex);
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
  assertStoreArg("anno_read_region", args, batchIndex);
  assertImageArg("anno_read_region", args, batchIndex);
  const { start, end } = assertSpanArgs("anno_read_region", args, "byte", batchIndex);
  assertWithinRegionCap("anno_read_region", start, end, batchIndex);
  const view = argBag(args).view;
  if (view !== undefined && view !== "disasm" && view !== "hexdump") {
    refuseArg("anno_read_region", "view", `${JSON.stringify(view)} is not a view -- expected "disasm" or "hexdump".`, batchIndex);
  }
}

function assertBinaryInfoArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_get_binary_info", args, batchIndex);
  assertImageArg("anno_get_binary_info", args, batchIndex);
}

function assertCrossReferencesArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_get_cross_references", args, batchIndex);
  assertImageArg("anno_get_cross_references", args, batchIndex);
  assertAddressArg("anno_get_cross_references", args, "address", batchIndex);
  assertMaxResults("anno_get_cross_references", args, batchIndex);
}

function assertSearchArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_search", args, batchIndex);
  assertImageArg("anno_search", args, batchIndex);
  assertQueryArg("anno_search", args, batchIndex);
  assertMaxResults("anno_search", args, batchIndex);
}

function assertAddressDetailsArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_get_address_details", args, batchIndex);
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
// not work". The measured upstream note at `r2000-tools.ts:63-75` establishes
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
      // store named ONCE at the top, every inner call inheriting it) was
      // refused whole at every depth -- with a message saying there is no
      // ambient store to inherit, the exact opposite of this verb's own
      // description. Read this line as a pair with the executor's recursion:
      // one function, `batchArgumentsFor()`, defines an inner call's effective
      // arguments, and both phases ask it.
      assertAnnoBatch(batchArgumentsFor(args, call), depth + 1);
      return;
    }
    assertVerbArgs(call.name, batchArgumentsFor(args, call), i);
  });
}

/** An inner call's effective arguments. The batch names the store ONCE, at the
 * top level, and every inner call inherits it -- an inner call that named its
 * own store would be a different store for one entry of a batch that reads as
 * one transaction's worth of work, which is a shape nothing here wants. An
 * inner `store` is therefore OVERRIDDEN by the batch's own, never merged with
 * it and never silently honoured. */
function batchArgumentsFor(batchArgs: Record<string, unknown>, call: Record<string, unknown>): Record<string, unknown> {
  return { ...argBag(call.arguments), store: batchArgs.store, ...(batchArgs.image !== undefined ? { image: batchArgs.image } : {}) };
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
  if (name === "anno_get_comments") return assertGetCommentsArgs(args, batchIndex);
  if (name === "anno_get_blocks") return assertGetBlocksArgs(args, batchIndex);
  if (name === "anno_create_project_enum") return assertCreateEnumArgs(args, batchIndex);
  if (name === "anno_update_project_enum") return assertUpdateEnumArgs(args, batchIndex);
  if (name === "anno_apply_enum_usage") return assertApplyEnumUsageArgs(args, batchIndex);
  if (name === "anno_save_project") return assertSaveProjectArgs(args, batchIndex);
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
    `"${name}" is curated but has no argument validator in anno-tools.ts. Resolution routes: add one to ` +
      "assertVerbArgs, or remove the definition.",
    { toolName: name, batchIndex },
  );
}

/**
 * The allow-list gate. Its body's FIRST check is set membership (see WHAT NOT
 * TO DO above, and `vice.ts`'s `DENY_LIST` precedent inverted into an
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

// ---------------------------------------------------------------------------
// Workspace path validation (T-29-01). The same posture `r2000-tools.ts` took
// for a caller-supplied project path and `stock-symbols.ts` takes for a `.lbl`
// file: an LLM-supplied path reaching the filesystem. Resolved against
// `repoRoot()` through `storePathWithinWorkspace()`, which carries WR-01's
// finding -- containment is enforced against the deepest EXISTING ancestor's
// realpath, so a not-yet-existing leaf under a directory symlink cannot slip
// past by way of an ENOENT fallback to the literal path.
//
// The STORE path and the IMAGE path go through the SAME helper. They are two
// LLM-supplied paths with one containment rule, and giving the image its own
// rule would be a second answer to the one question this function answers once.
//
// `repoRoot()` is called at DISPATCH time, never frozen at module load, for
// the same reason the region cap's override is read at call time: one
// `node --test` process can then point several different workspace roots at
// this code within a single run.
// ---------------------------------------------------------------------------

function resolveWorkspacePath(raw: string): string {
  return storePathWithinWorkspace(raw, repoRoot());
}

function resolveStoreArg(name: string, args: unknown): string {
  return resolveWorkspacePath(assertStoreArg(name, args));
}

// ---------------------------------------------------------------------------
// "GONE" AND "EMPTY" MUST NOT READ THE SAME, ON THE WRITE PATH TOO.
//
// `openStore`'s `mustExist` option bundles two inseparable halves -- refuse an
// absent path, AND open the connection `readOnly` -- because it exists to judge
// a file the caller is about to install, and a judge that can modify what it
// judges is not a judge. That bundling is right for its purpose and wrong for
// this one: a write verb needs the refusal WITHOUT the read-only open, and
// there is no third state to ask `openStore` for.
//
// So the refusal is made HERE, by name, before the connection is constructed,
// and the residual window that `mustExist`'s read-only open would otherwise
// have closed is closed by INODE IDENTITY instead. The window is real: between
// the existence check and the constructor the file can be unlinked, after
// which a writable open CREATES it and the verb writes into a store it
// invented, reporting success. Comparing the inode across the open detects
// exactly that -- an unlinked-and-recreated file is a different inode -- and
// turns an invented store into a named refusal.
// ---------------------------------------------------------------------------

/** The verbs that only READ. They get `openStore`'s `mustExist` (and therefore
 * its read-only connection), which is strictly the safer open; every other verb
 * takes the existence-check-plus-inode-guard route below. Derived from nothing
 * -- it is a hand-listed property of each verb, and a verb missing from here is
 * merely opened writably, never wrongly refused. */
const READ_ONLY_ANNO_VERBS: readonly string[] = Object.freeze([
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
]);

/** Refuses an absent store BY NAME, returning the inode the later guard
 * compares against. A write verb must never CREATE the file it was asked to
 * annotate: "the annotations are gone" and "there are no annotations" are
 * different facts and must not read the same. */
function assertStorePresent(name: string, storePath: string): number {
  if (!existsSync(storePath)) {
    throw new AnnoStorePathError(
      `${name} refused: no annotation store exists at ${JSON.stringify(storePath)} -- refusing to CREATE one, because "the ` +
        'annotations are gone" and "there are no annotations" must not read the same. Create the store deliberately first.',
      { path: storePath },
    );
  }
  return statSync(storePath).ino;
}

/** Closes the window between the existence check and the open. */
function assertSameFile(name: string, storePath: string, inodeBefore: number): void {
  if (statSync(storePath).ino !== inodeBefore) {
    throw new AnnoStorePathError(
      `${name} refused: the file at ${JSON.stringify(storePath)} was replaced between the existence check and the open, so this ` +
        "call would have written into a store it created itself rather than the one it was asked to annotate. Nothing was written.",
      { path: storePath },
    );
  }
}

// ---------------------------------------------------------------------------
// The dispatch table. Each dispatcher receives an ALREADY-OPEN handle it does
// not own: opening and closing are `runAnnoTool`'s job and only
// `runAnnoTool`'s, so there is exactly one `finally` in this module to get
// right rather than one per verb.
//
// Every dispatcher surfaces `changed` from its `AnnoWriteResult` and NEVER maps
// `changed: false` to an error.
// ---------------------------------------------------------------------------

function dispatchGetSymbols(handle: AnnoStoreHandle, args: unknown): unknown {
  const maxResults = assertMaxResults("anno_get_symbols", args);
  const bag = argBag(args);
  const start = bag.start_address !== undefined ? parseStoreAddress(bag.start_address, { what: "start_address" }) : undefined;
  const end = bag.end_address !== undefined ? parseStoreAddress(bag.end_address, { what: "end_address" }) : undefined;

  const all: LabelRow[] = listLabels(handle);
  const matched = all.filter((row) => {
    if (start !== undefined && row.address < start) return false;
    if (end !== undefined && row.address > end) return false;
    return true;
  });
  const symbols = matched.slice(0, maxResults);
  // `truncated` is reported rather than left for the caller to infer from a
  // count that happens to equal its own ceiling -- the ceiling being hit and
  // the answer being complete-at-exactly-the-ceiling are different facts.
  return { store: handle.path, symbols, returned: symbols.length, matched: matched.length, truncated: matched.length > symbols.length };
}

function dispatchSetLabelName(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const written = setLabel(handle, {
    address: bag.address as number | string,
    name: bag.name,
    // 'User' is the default because a name arriving through this surface was
    // chosen by whoever made the call; an unstated provenance is a human's.
    kind: bag.kind === undefined ? "User" : bag.kind,
    baseRevision: assertBaseRevisionArg("anno_set_label_name", args),
  });
  return { store: handle.path, address: parseStoreAddress(bag.address, { what: "address" }), name: bag.name, kind: bag.kind ?? "User", ...written };
}

function dispatchSetComment(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const written = setComment(handle, {
    address: bag.address as number | string,
    commentType: bag.type,
    text: bag.comment,
    baseRevision: assertBaseRevisionArg("anno_set_comment", args),
  });
  return { store: handle.path, address: parseStoreAddress(bag.address, { what: "address" }), type: bag.type, ...written };
}

function dispatchSetDataType(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const written = setDataType(handle, {
    start: bag.start_address as number | string,
    endInclusive: bag.end_address as number | string,
    dataType: bag.data_type,
    baseRevision: assertBaseRevisionArg("anno_set_data_type", args),
  });
  // BOTH disclosures ride out on the SUCCESSFUL body, as named top-level
  // fields, every time -- including when they are empty, so "this write
  // contradicted nothing" is a fact the caller is told rather than the absence
  // of a field it has to know to look for. This is 28-VERIFICATION.md's F-4
  // obligation, discharged at the layer the human actually reads.
  return {
    store: handle.path,
    start_address: parseStoreAddress(bag.start_address, { what: "start_address" }),
    end_address: parseStoreAddress(bag.end_address, { what: "end_address" }),
    data_type: bag.data_type,
    revision: written.revision,
    changed: written.changed,
    contradictedComments: written.contradictedComments,
    reinterpretedSplitTables: written.reinterpretedSplitTables,
  };
}

function dispatchScope(name: string, handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const span = {
    start: bag.start_address as number | string,
    endInclusive: bag.end_address as number | string,
    baseRevision: assertBaseRevisionArg(name, args),
  };
  const written = name === "anno_add_scope" ? addScope(handle, span) : removeScope(handle, span);
  return {
    store: handle.path,
    start_address: parseStoreAddress(bag.start_address, { what: "start_address" }),
    end_address: parseStoreAddress(bag.end_address, { what: "end_address" }),
    ...written,
    scopes: listScopes(handle),
  };
}

function dispatchGetComments(handle: AnnoStoreHandle, args: unknown): unknown {
  const maxResults = assertMaxResults("anno_get_comments", args);
  const bag = argBag(args);
  const wanted =
    bag.addresses === undefined ? undefined : new Set((bag.addresses as unknown[]).map((entry) => parseStoreAddress(entry, { what: "addresses[]" })));
  const start = bag.start_address !== undefined ? parseStoreAddress(bag.start_address, { what: "start_address" }) : undefined;
  const end = bag.end_address !== undefined ? parseStoreAddress(bag.end_address, { what: "end_address" }) : undefined;
  const type = bag.type !== undefined ? assertCommentType(bag.type) : undefined;

  const all: CommentRow[] = listComments(handle);
  const matched = all.filter((row) => {
    if (wanted !== undefined && !wanted.has(row.address)) return false;
    if (start !== undefined && row.address < start) return false;
    if (end !== undefined && row.address > end) return false;
    if (type !== undefined && row.commentType !== type) return false;
    return true;
  });
  const comments = matched.slice(0, maxResults);
  return { store: handle.path, comments, returned: comments.length, matched: matched.length, truncated: matched.length > comments.length };
}

function dispatchGetBlocks(handle: AnnoStoreHandle, args: unknown): unknown {
  const maxResults = assertMaxResults("anno_get_blocks", args);
  const bag = argBag(args);
  const blockType = bag.block_type !== undefined ? assertDataType(bag.block_type) : undefined;
  const include = new Set((Array.isArray(bag.include) ? bag.include : []) as string[]);

  const matched = listRanges(handle).filter((row) => blockType === undefined || row.dataType === blockType);
  const blocks = matched.slice(0, maxResults);
  return {
    store: handle.path,
    blocks,
    returned: blocks.length,
    matched: matched.length,
    truncated: matched.length > blocks.length,
    ...(include.has("scopes") ? { scopes: listScopes(handle) } : {}),
    ...(include.has("enums") ? { enums: listProjectEnums(handle) } : {}),
    ...(include.has("enum_usage") ? { enum_usage: listEnumUsage(handle) } : {}),
  };
}

function dispatchCreateProjectEnum(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const written = createProjectEnum(handle, {
    name: bag.name,
    variants: bag.variants,
    description: bag.description,
    baseRevision: assertBaseRevisionArg("anno_create_project_enum", args),
  });
  return { store: handle.path, name: bag.name, ...written, enums: listProjectEnums(handle) };
}

function dispatchUpdateProjectEnum(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const written = updateProjectEnum(handle, {
    name: bag.name,
    newName: bag.new_name,
    variants: bag.variants,
    description: bag.description,
    baseRevision: assertBaseRevisionArg("anno_update_project_enum", args),
  });
  return { store: handle.path, name: bag.new_name ?? bag.name, ...written, enums: listProjectEnums(handle) };
}

function dispatchApplyEnumUsage(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const baseRevision = assertBaseRevisionArg("anno_apply_enum_usage", args);
  const cleared = isEnumUsageClear(args);
  const written = cleared
    ? clearEnumUsage(handle, { address: bag.address as number | string, baseRevision })
    : applyEnumUsage(handle, { address: bag.address as number | string, name: bag.name, baseRevision });
  return {
    store: handle.path,
    address: parseStoreAddress(bag.address, { what: "address" }),
    name: cleared ? null : bag.name,
    cleared,
    ...written,
    enum_usage: listEnumUsage(handle),
  };
}

/** THE HONEST SAVE. It opens (through the runner), reads the revision, and
 * closes. It writes NOTHING, and the body says so in its own words rather than
 * leaving the caller to infer durability from an empty success. `curated` in
 * the manifest means a route is required; returning `{available:false}` was
 * rejected, because a permanent refusal for a curated disposition is what the
 * `omit` disposition is for and the manifest does not say `omit`.
 *
 * THE REVISION IS READ EXACTLY ONCE, into a `const`, and that single value
 * feeds both the returned field and the note's prose. This is the one verb
 * whose output a caller is TOLD to use as a `base_revision` compare-and-swap
 * guard, so a field and a prose that could name different revisions is a guard
 * built on a number its own note contradicts -- and a guard nobody can trust is
 * worse than no guard, because it is acted on (WR-10). Two reads agreeing is an
 * accident of when they ran; one read agreeing with itself is a property. */
function dispatchSaveProject(handle: AnnoStoreHandle): unknown {
  const revision = currentRevision(handle);
  return {
    store: handle.path,
    revision,
    wrote: false,
    note:
      "This verb performed NO write. Every mutating verb on this surface commits and fsyncs its own write before it " +
      "returns, so the store was already durable at revision " +
      String(revision) +
      " when this call arrived and there was nothing for an explicit save to flush. The revision is reported so it can " +
      "be used as a base_revision compare-and-swap guard on a later write.",
  };
}


// ---------------------------------------------------------------------------
// The image loader (D-07). The store holds annotations and never bytes, so
// every derived read names its own image and this function is the ONE place
// that turns that name into bytes plus an origin.
//
// DISPATCH IS BY EXTENSION FIRST, NEVER BY BYTE LENGTH. The branch order below
// was copied from the CLI's own bootstrap dispatch rather than re-derived; that
// verb was removed on 2026-08-29 when the CLI narrowed to two (D-14), so THIS
// is now the only implementation of the order and the citation that named the
// CLI's line range is deliberately gone rather than left dangling. The
// incident it encodes (WR-07): a 4096-byte flat `.raw` capture fell through to
// the `.prg` parser, whose first two bytes become the load address, so a
// truncated capture silently "bootstrapped" with an origin read backwards out
// of its own payload bytes and exited zero -- every downstream address wrong,
// no diagnostic. The extension check runs BEFORE any length check so
// `flatImageOrigin()`'s own named refusal stays reachable for those two
// extensions.
// ---------------------------------------------------------------------------

interface LoadedImage {
  path: string;
  kind: "prg" | "flat";
  origin: number;
  body: Uint8Array;
  totalBytes: number;
}

function loadImage(name: string, args: unknown): LoadedImage {
  const raw = assertImageArg(name, args);
  const path = resolveWorkspacePath(raw);
  if (!existsSync(path)) {
    throw new AnnoStorePathError(
      `${name} refused: no image exists at ${JSON.stringify(path)} -- a derived read names the bytes it derives from (D-07), ` +
        "and an image that is not there is a different fact from an image with nothing in it.",
      { path },
    );
  }
  const bytes = new Uint8Array(readFileSync(path));
  const ext = extname(path).toLowerCase();
  try {
    if (ext === ".raw" || ext === ".bin") {
      return { path, kind: "flat", origin: flatImageOrigin(bytes), body: bytes, totalBytes: bytes.length };
    }
    if (ext !== ".prg" && bytes.length === 65536) {
      return { path, kind: "flat", origin: flatImageOrigin(bytes), body: bytes, totalBytes: bytes.length };
    }
    const { origin, body } = parsePrg(bytes);
    return { path, kind: "prg", origin, body, totalBytes: bytes.length };
  } catch (err) {
    // `prg-image.ts` throws a bare `Error` by design -- it is a pure
    // byte-layout module with no error family of its own. Wrapped here so the
    // never-throw boundary can still name a class, and so the message carries
    // the caller's own vocabulary (the image path) rather than only the
    // internal function name.
    const reason = err instanceof Error ? err.message : String(err);
    throw new AnnoToolArgumentError(
      `${name} refused: ${JSON.stringify(path)} is not an image this surface can read (${reason}). Supply a .prg (a 2-byte ` +
        "little-endian load address plus a payload) or an exactly-65536-byte flat capture.",
      { toolName: name, argument: "image" },
    );
  }
}

/** Shannon entropy of `bytes`, in bits per byte. Above roughly 7.5 the image is
 * very likely compressed or packed, and nothing in it will decode sensibly
 * until it is depacked -- which is why this is REPORTED rather than left for a
 * caller to wonder about after a disassembly comes back as noise. */
function shannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const histogram = new Uint32Array(256);
  for (const byte of bytes) histogram[byte] += 1;
  let entropy = 0;
  for (const count of histogram) {
    if (count === 0) continue;
    const p = count / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return Math.round(entropy * 1000) / 1000;
}

/** The slice of `image` covering the inclusive span, or `null` when the span
 * falls outside the bytes the image actually holds. `null` rather than a short
 * slice: a partial answer to a range question reads as a complete answer to a
 * smaller one.
 *
 * TOTAL OVER EVERY (start, end) PAIR, and that is three cases, not two. Below
 * the origin and past the last byte are the obvious two. The third is an
 * INVERTED span -- a resolved `from` past its own `to` -- which passes both
 * bound checks while covering no bytes at all, and which `subarray()` would
 * hand back as a zero-length success. That is the same failure as a short
 * slice wearing a smaller hat: answering a question about no bytes with an
 * empty result reads as a complete answer to a smaller question, which is the
 * very thing this `null` return exists against (CR-01). */
function sliceSpan(image: LoadedImage, start: number, end: number): Uint8Array | null {
  const from = start - image.origin;
  const to = end - image.origin;
  if (from < 0 || to >= image.body.length || from > to) return null;
  return image.body.subarray(from, to + 1);
}

/** The ONE refusal builder both read verbs report through. `anno_disassemble`
 * and `anno_read_region` each call `sliceSpan()` exactly once, over the span
 * their own answer would have reported -- the span the CALLER can see -- and
 * each reaches this builder from that one verdict. Their AGREEMENT is the
 * property CR-01 was reported against: the defect was `anno_disassemble`
 * narrowing the requested end down to the image's last address BEFORE slicing,
 * so an out-of-image start produced an empty slice instead of the `null` that
 * reaches here, and the caller got `instructions:0` with an `end_address`
 * numerically below the `address` asked about. Do not reintroduce a per-verb
 * narrowing: it makes the two verbs disagree about the same bytes. */
function outsideImage(name: string, image: LoadedImage, start: number, end: number): Record<string, unknown> {
  const last = image.origin + image.body.length - 1;
  return {
    available: false,
    reason:
      `${name} was asked for $${start.toString(16).padStart(4, "0")}..$${end.toString(16).padStart(4, "0")}, which is not ` +
      `entirely inside the image: ${JSON.stringify(image.path)} loads at $${image.origin.toString(16).padStart(4, "0")} and ` +
      `ends at $${last.toString(16).padStart(4, "0")}. Reported as unanswerable rather than served as a short slice, because a ` +
      "partial answer to a range question reads as a complete answer to a smaller one. Narrow the range, or name the image that " +
      "actually covers those addresses.",
  };
}

function hexdump(bytes: Uint8Array, start: number): string[] {
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.subarray(offset, offset + 16);
    const hex = [...chunk].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    lines.push(`$${(start + offset).toString(16).padStart(4, "0")}  ${hex}`);
  }
  return lines;
}

function dispatchDisassemble(args: unknown): unknown {
  const image = loadImage("anno_disassemble", args);
  const bag = argBag(args);
  const start = parseStoreAddress(bag.address, { what: "address" });
  const cap = currentReadRegionMaxBytes();
  const last = image.origin + image.body.length - 1;
  // An omitted end is the CAP, not the whole image: the default has to be the
  // bound, or the default is the hazard.
  const requestedEnd = bag.end_address !== undefined ? parseStoreAddress(bag.end_address, { what: "end_address" }) : Math.min(start + cap - 1, last);
  if (bag.end_address !== undefined) assertWithinRegionCap("anno_disassemble", start, requestedEnd, undefined);
  // Sliced on the span the CALLER named, never on one narrowed down to the
  // image's last address first. The narrowing used to happen here, and it is
  // what made this verb disagree with `anno_read_region` (CR-01) -- see
  // `outsideImage()`. Note what is NOT lost: an omitted `end_address` derives
  // `requestedEnd` from the image's own last address above, so it is inside
  // the image by construction and nothing a caller named is narrowed away.
  const slice = sliceSpan(image, start, requestedEnd);
  if (slice === null) return outsideImage("anno_disassemble", image, start, requestedEnd);

  const instructions = decode(slice, start, { end: requestedEnd });
  return {
    image: image.path,
    origin: image.origin,
    address: start,
    end_address: requestedEnd,
    instructions: instructions.length,
    listing: render(instructions, { origin: start }),
  };
}

function dispatchReadRegion(args: unknown): unknown {
  const image = loadImage("anno_read_region", args);
  const bag = argBag(args);
  const start = parseStoreAddress(bag.start_address, { what: "start_address" });
  const end = parseStoreAddress(bag.end_address, { what: "end_address" });
  const view = bag.view === "hexdump" ? "hexdump" : "disasm";
  const slice = sliceSpan(image, start, end);
  if (slice === null) return outsideImage("anno_read_region", image, start, end);

  if (view === "hexdump") {
    return { image: image.path, origin: image.origin, start_address: start, end_address: end, view, bytes: slice.length, hexdump: hexdump(slice, start).join("\n") };
  }
  const instructions = decode(slice, start, { end });
  return {
    image: image.path,
    origin: image.origin,
    start_address: start,
    end_address: end,
    view,
    bytes: slice.length,
    instructions: instructions.length,
    listing: render(instructions, { origin: start }),
  };
}

function dispatchBinaryInfo(args: unknown): unknown {
  const image = loadImage("anno_get_binary_info", args);
  const entropy = shannonEntropy(image.body);
  return {
    image: image.path,
    kind: image.kind,
    origin: image.origin,
    total_bytes: image.totalBytes,
    body_bytes: image.body.length,
    last_address: image.origin + image.body.length - 1,
    entropy,
    likely_packed: entropy > 7.5,
  };
}

function dispatchCrossReferences(handle: AnnoStoreHandle, args: unknown): unknown {
  const image = loadImage("anno_get_cross_references", args);
  const maxResults = assertMaxResults("anno_get_cross_references", args);
  const bag = argBag(args);
  const union = crossReferencesTo(handle, image.body, image.origin, bag.address as number | string);
  const callers = union.callers.slice(0, maxResults);
  return {
    store: handle.path,
    image: image.path,
    to: union.to,
    callers,
    returned: callers.length,
    total: union.count,
    truncated: union.count > callers.length,
  };
}

function dispatchSearch(handle: AnnoStoreHandle, args: unknown): unknown {
  const image = loadImage("anno_search", args);
  const bag = argBag(args);
  // THE CALLER'S OWN BAG IS PASSED THROUGH, not reconstructed from the three
  // keys this layer knows about. `searchAnnotations` detects a corpus this
  // surface does not have by scanning for `search_<name>` keys it does not
  // recognise, so rebuilding the request here would silently DROP exactly the
  // signal the unanswerable-corpus report depends on -- and the caller would
  // get a clean, plausible, wrong hit list for a corpus that was never
  // searched. `query` and `max_results` are re-stated last so the validated
  // values win over whatever shape arrived.
  const result = searchAnnotations(handle, image.body, image.origin, {
    ...bag,
    query: bag.query as string,
    max_results: assertMaxResults("anno_search", args),
  });

  const unanswerable = Object.keys(result.unavailable);
  if (unanswerable.length > 0) {
    // THE WHOLE CALL IS ANSWERED AS UNANSWERABLE, not served as a partial
    // result set with a footnote. The request named a corpus this surface does
    // not have, so any hit list returned beside that would look like the
    // complete answer to the question actually asked -- which is the
    // plausible-looking zero this shape exists against. `isError` stays FALSE:
    // the request was well-formed and the answer is "no".
    return {
      available: false,
      reason: unanswerable.map((corpus) => result.unavailable[corpus]!.reason).join(" "),
      unanswerable_corpora: unanswerable,
      corpora: result.corpora,
    };
  }
  return { store: handle.path, image: image.path, ...result };
}

function dispatchAddressDetails(handle: AnnoStoreHandle, args: unknown): unknown {
  const image = loadImage("anno_get_address_details", args);
  const bag = argBag(args);
  return { store: handle.path, image: image.path, ...composeAddressDetails(handle, image.body, image.origin, bag.address as number | string) };
}


/** PHASE TWO. Runs every entry against the ONE already-open handle, to
 * COMPLETION, pushing a per-entry status and never aborting on the first
 * failure. Pre-validation has already refused every batch that should not have
 * been sent, so a failure here is genuinely about one call rather than about
 * the payload. */
async function dispatchBatchExecute(handle: AnnoStoreHandle, args: unknown): Promise<unknown> {
  const bag = argBag(args);
  const calls = bag.calls as Record<string, unknown>[];
  const results: Record<string, unknown>[] = [];
  for (const [index, call] of calls.entries()) {
    const name = call.name as string;
    const innerArgs = batchArgumentsFor(bag, call);
    try {
      const value = name === "anno_batch_execute" ? await dispatchBatchExecute(handle, innerArgs) : await dispatch(name, innerArgs, handle);
      results.push({ index, name, status: "success", result: value });
    } catch (err) {
      // NAMED BY CLASS, exactly as the outer boundary names it, so a per-item
      // failure is as diagnosable as a whole-call one.
      const errName = err instanceof Error ? err.name : "Error";
      const errMessage = err instanceof Error ? err.message : String(err);
      results.push({ index, name, status: "error", error: `[${errName}] ${errMessage}` });
    }
  }
  const failed = results.filter((entry) => entry.status === "error").length;
  return {
    store: handle.path,
    results,
    executed: results.length,
    succeeded: results.length - failed,
    failed,
    note:
      "Every entry ran: this loop does not abort on the first failure, so an error entry here means THAT CALL did not work, " +
      "not that the batch should not have been sent. A batch that should not have been sent is refused WHOLE before anything " +
      "is opened, and arrives as isError:true instead of as a per-item status.",
  };
}

async function dispatch(name: string, args: unknown, handle: AnnoStoreHandle): Promise<unknown> {
  if (name === "anno_get_symbols") return dispatchGetSymbols(handle, args);
  if (name === "anno_set_label_name") return dispatchSetLabelName(handle, args);
  if (name === "anno_set_comment") return dispatchSetComment(handle, args);
  if (name === "anno_set_data_type") return dispatchSetDataType(handle, args);
  if (name === "anno_add_scope" || name === "anno_remove_scope") return dispatchScope(name, handle, args);
  if (name === "anno_get_comments") return dispatchGetComments(handle, args);
  if (name === "anno_get_blocks") return dispatchGetBlocks(handle, args);
  if (name === "anno_create_project_enum") return dispatchCreateProjectEnum(handle, args);
  if (name === "anno_update_project_enum") return dispatchUpdateProjectEnum(handle, args);
  if (name === "anno_apply_enum_usage") return dispatchApplyEnumUsage(handle, args);
  if (name === "anno_save_project") return dispatchSaveProject(handle);
  if (name === "anno_disassemble") return dispatchDisassemble(args);
  if (name === "anno_read_region") return dispatchReadRegion(args);
  if (name === "anno_get_binary_info") return dispatchBinaryInfo(args);
  if (name === "anno_get_cross_references") return dispatchCrossReferences(handle, args);
  if (name === "anno_search") return dispatchSearch(handle, args);
  if (name === "anno_get_address_details") return dispatchAddressDetails(handle, args);
  if (name === "anno_batch_execute") return dispatchBatchExecute(handle, args);
  // Unreachable: `assertAnnoTool()` above has already refused every name
  // outside `CURATED_ANNO_TOOLS`, and every curated name has an arm here. It
  // refuses BY NAME anyway rather than returning a plausible-looking empty
  // answer -- a curated name with no dispatch arm is a bug in this file, and
  // saying so is cheaper than a silent `{}` somebody has to trace back.
  throw new AnnoUncuratedToolError(
    `"${name}" is curated but has no dispatch arm in anno-tools.ts. Resolution routes: implement it and ` +
      "add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.",
    { toolName: name },
  );
}

/**
 * Runs one curated `anno_*` tool call. THE NEVER-THROW BOUNDARY: every failure
 * -- an uncurated name, a malformed argument, a path outside the workspace, a
 * corrupt store, a bug in a dispatcher -- resolves as `{isError:true}` text
 * naming the error CLASS. Nothing rejects the returned promise.
 *
 * `assertAnnoTool` is INSIDE the `try`, deliberately and unlike
 * `r2000-tools.ts`'s `runR2000Tool`, whose gate sits outside it so a refusal
 * REJECTS instead of resolving. That asymmetry is WR-02, recorded as out of
 * scope at `r2000-tools.ts:772-774`; it is closed here.
 *
 * NO VERB EVER CREATES THE STORE IT WAS ASKED TO USE (D-06): "the annotations
 * are gone" and "there are no annotations" must not read the same. A read-only
 * verb gets that through `openStore`'s own `mustExist`; a writing verb gets it
 * through `assertStorePresent()` plus the inode guard above, because
 * `mustExist` also forces a read-only connection and there is no third state to
 * ask for. `closeStore` runs in a `finally`, so the handle is released on the
 * throwing path exactly as on the succeeding one (T-29-03).
 */
export async function runAnnoTool(name: string, args: unknown): Promise<ToolCallResult> {
  try {
    assertAnnoTool(name, args);
    const storePath = resolveStoreArg(name, args);
    const inodeBefore = assertStorePresent(name, storePath);
    const handle = openStore(storePath, { workspaceRoot: repoRoot(), mustExist: READ_ONLY_ANNO_VERBS.includes(name) });
    try {
      assertSameFile(name, storePath, inodeBefore);
      return okText(JSON.stringify(await dispatch(name, args, handle)));
    } finally {
      closeStore(handle);
    }
  } catch (err) {
    // Named by class (D18-12: a mid-window failure must surface a named,
    // distinguishable error, never a silent success) -- a caller can tell
    // AnnoStoreCorruptError apart from AnnoStorePathError etc. from this text
    // alone, without re-parsing loose message wording.
    const errName = err instanceof Error ? err.name : "Error";
    const errMessage = err instanceof Error ? err.message : String(err);
    return errText(`${name} failed: [${errName}] ${errMessage}`);
  }
}
