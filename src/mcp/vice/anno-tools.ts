#!/usr/bin/env node
// anno-tools.ts
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: the curated `anno_*` tool
// surface. The `AnnoToolDefinition`s themselves (`ANNO_TOOL_DEFINITIONS`), the
// allow-list DERIVED from them (`CURATED_ANNO_TOOLS`), its enforcement
// (`assertAnnoTool()`) together with the per-argument validators that gate
// shares, the caller-supplied store-path validation, and the runner
// (`runAnnoTool()`) that opens the owned annotation store, answers exactly one
// call against it, and closes it again. No other module may hand-list a
// curated `anno_*` name, hand-validate an `anno_*` store path, or reach
// `anno-store.ts` on behalf of an MCP call -- `vice-proxy.ts` imports
// `ANNO_TOOL_DEFINITIONS` and `runAnnoTool` from here and nothing else.
//
// WHY THIS FILE EXISTS, in the words of the three decisions that shaped it:
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
//   MCP-02 (THE HOST-PATH SEAM IS UNREACHABLE FROM HERE, BY CONSTRUCTION).
//   CLAUDE.md requires derived tools to be intercepted before
//   `forwardToVice()`, because `rewriteArguments()` runs inside it and would
//   hand a container-translated path to a runner acting proxy-locally. This
//   family needs no such interception: `runAnnoTool()` is registered through
//   `buildViceTool()` directly, so it can never reach `forwardToVice()`,
//   `call()` or `ensureViceSession()`, and this module must never import
//   `hostpath.ts` -- `hostpath-consumers.test.ts` names it as forbidden and
//   keeps that consumer set at exactly five modules. The store path is a
//   PROXY-LOCAL filesystem path and translating it would point the store at a
//   file on the wrong side of the container boundary.
//
// WHAT NOT TO DO:
//   - Never hand-type a second list of curated names. `CURATED_ANNO_TOOLS` is
//     derived from `ANNO_TOOL_DEFINITIONS`'s own `name` values precisely so a
//     name cannot be curated in one place and absent from the other (T-29-02).
//   - Never widen `CURATED_ANNO_TOOLS` without adding the definition here with
//     a named criterion. The gate's FIRST statement is set membership; a name
//     that is not in the set is refused before any argument is looked at.
//   - Never move `assertAnnoTool()` out of `runAnnoTool()`'s `try`. That
//     asymmetry is WR-02, recorded as out of scope at `r2000-tools.ts:772-774`
//     and CLOSED here: inside the `try`, a refusal RESOLVES `{isError:true}`
//     like every other failure instead of REJECTING the returned promise, so
//     the caller has one shape to handle rather than two.
//   - Never let a batch verb pass an inner name through unchecked. When
//     `anno_batch_execute` lands it must refuse the WHOLE batch if any inner
//     name is outside the curated set, and treat a malformed payload as a
//     refusal rather than as an empty batch that passes through -- that is
//     D-33, and the shape to copy is `r2000-tools.ts`'s `assertCuratedBatch()`.
//   - Never resolve a store path with `resolve()` + `startsWith`. Containment
//     goes through `storePathWithinWorkspace()`, which resolves the deepest
//     EXISTING ancestor's realpath (WR-01) -- a not-yet-existing leaf under a
//     directory symlink escaped the naive form entirely.
//   - Never hold the handle beyond the call, and never open a store outside a
//     `try`/`finally` that closes it (T-29-03).
//   - Never collapse a failure into a bare string. The runner's catch names
//     the error CLASS, so a caller can tell an `AnnoStoreCorruptError` from an
//     `AnnoStorePathError` from the text alone (T-29-04, D18-12).
//
import { closeStore, listLabels, openStore } from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
import { AnnoStoreError, parseStoreAddress } from "./anno-types.ts";
import type { AnnoStoreErrorOptions, LabelRow } from "./anno-types.ts";
import { storePathWithinWorkspace } from "./anno-types.ts";
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
// The curated tool definitions. ONE entry in this slice, by design: plan 29-01
// is the phase's tracer, proving the whole registration seam end to end on a
// single verb so an architectural dead end costs one commit rather than ten.
// The remaining verbs expand out from here, each with its own named criterion.
//
// `store` is on EVERY definition and is always required (D-06). There is no
// "current store" for a verb to inherit, which is what makes a call's effect a
// function of its own arguments alone.
// ---------------------------------------------------------------------------

export const ANNO_TOOL_DEFINITIONS: readonly AnnoToolDefinition[] = [
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
        store: {
          type: "string",
          description:
            "Absolute or workspace-relative path to the .annostore annotation store. Refused if it " +
            "resolves outside the workspace root, including via a symlink.",
        },
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
];

/** The allow-list, DERIVED from the definitions above rather than hand-typed
 * (T-29-02): a name cannot be curated in one place and absent from the other,
 * because there is only one place. */
export const CURATED_ANNO_TOOLS: readonly string[] = ANNO_TOOL_DEFINITIONS.map((def) => def.name);

// ---------------------------------------------------------------------------
// Per-argument validators. Each is written to be callable from BOTH the outer
// gate and, when `anno_batch_execute` lands, that verb's own inner loop -- the
// shared-validator discipline `r2000-tools.ts:790-800` records, so a refusal
// fires identically whether a call arrives directly or smuggled inside a batch
// payload. `batchIndex` is threaded for that future caller and named in the
// message when present.
// ---------------------------------------------------------------------------

/** Narrows the universally-required `store` argument to a non-empty string.
 * Path CONTAINMENT is a separate concern and lives in `resolveStoreArg()`
 * below; this only establishes that there is a path to contain. */
function assertStoreArg(name: string, args: unknown, batchIndex?: number): string {
  const where = batchIndex !== undefined ? ` (calls[${batchIndex}])` : "";
  if (!isPlainObject(args) || typeof args.store !== "string" || args.store.trim() === "") {
    throw new AnnoToolArgumentError(
      `${name} refused${where}: "store" must be a non-empty string naming an annotation store -- every ` +
        "anno_* verb names its own store (D-06), because there is no ambient current store to inherit.",
      { toolName: name, argument: "store", batchIndex },
    );
  }
  return args.store;
}

/** Narrows `max_results` to a positive integer. Required, with no default:
 * see the description on the definition above for why a silent default is
 * worse than a refusal here. */
function assertMaxResults(name: string, args: unknown, batchIndex?: number): number {
  const where = batchIndex !== undefined ? ` (calls[${batchIndex}])` : "";
  const raw = isPlainObject(args) ? args.max_results : undefined;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    throw new AnnoToolArgumentError(
      `${name} refused${where}: "max_results" must be a positive integer, got ${JSON.stringify(raw)} -- it ` +
        "is REQUIRED and has no default on this surface, so a truncated answer is always an explicit ceiling.",
      { toolName: name, argument: "max_results", batchIndex },
    );
  }
  return raw;
}

/** Validates `anno_get_symbols`'s own arguments. The optional range bounds go
 * through `parseStoreAddress()` -- the ONE address parser -- so `$d020`,
 * `0xd020` and `53280` are accepted or refused here exactly as the store
 * itself would accept or refuse them, never by a second, divergent rule. */
function assertGetSymbolsArgs(args: unknown, batchIndex?: number): void {
  assertStoreArg("anno_get_symbols", args, batchIndex);
  assertMaxResults("anno_get_symbols", args, batchIndex);
  if (!isPlainObject(args)) return;
  if (args.start_address !== undefined) parseStoreAddress(args.start_address, { what: "start_address" });
  if (args.end_address !== undefined) parseStoreAddress(args.end_address, { what: "end_address" });
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
  if (name === "anno_get_symbols") {
    assertGetSymbolsArgs(args);
  }
}

// ---------------------------------------------------------------------------
// Store-path validation (T-29-01). The same posture `r2000-tools.ts` takes for
// a caller-supplied project path and `stock-symbols.ts` takes for a `.lbl`
// file: an LLM-supplied path reaching the filesystem. Resolved against
// `repoRoot()` through `storePathWithinWorkspace()`, which carries WR-01's
// finding -- containment is enforced against the deepest EXISTING ancestor's
// realpath, so a not-yet-existing leaf under a directory symlink cannot slip
// past by way of an ENOENT fallback to the literal path.
//
// `repoRoot()` is called at DISPATCH time, never frozen at module load, for
// the same reason `r2000-tools.ts`'s cap override is read at call time: one
// `node --test` process can then point several different workspace roots at
// this code within a single run.
// ---------------------------------------------------------------------------

function resolveStoreArg(name: string, args: unknown): string {
  const raw = assertStoreArg(name, args);
  return storePathWithinWorkspace(raw, repoRoot());
}

// ---------------------------------------------------------------------------
// The dispatch table. One verb in this slice. Each dispatcher receives an
// ALREADY-OPEN handle it does not own: opening and closing are `runAnnoTool`'s
// job and only `runAnnoTool`'s, so there is exactly one `finally` in this
// module to get right rather than one per verb.
// ---------------------------------------------------------------------------

function dispatchGetSymbols(handle: AnnoStoreHandle, args: unknown): unknown {
  const maxResults = assertMaxResults("anno_get_symbols", args);
  const bag = isPlainObject(args) ? args : {};
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

async function dispatch(name: string, args: unknown, handle: AnnoStoreHandle): Promise<unknown> {
  if (name === "anno_get_symbols") {
    return dispatchGetSymbols(handle, args);
  }
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
 * The store is opened with `mustExist: true` (D-06): a verb that reads
 * annotations must never CREATE the file it was asked to read, because "the
 * annotations are gone" and "there are no annotations" must not read the same.
 * `closeStore` runs in a `finally`, so the handle is released on the throwing
 * path exactly as on the succeeding one (T-29-03).
 */
export async function runAnnoTool(name: string, args: unknown): Promise<ToolCallResult> {
  try {
    assertAnnoTool(name, args);
    const storePath = resolveStoreArg(name, args);
    const handle = openStore(storePath, { workspaceRoot: repoRoot(), mustExist: true });
    try {
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
