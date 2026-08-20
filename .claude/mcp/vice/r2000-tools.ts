#!/usr/bin/env node
// r2000-tools.ts -- the ONE authoritative place in this repo for the curated
// r2000_* tool surface: which 17 of regenerator2000's 28 MCP tools this
// project advertises, the allow-list gate (including its D-33 batch
// recursion), project-path validation, and the runner that drives one
// r2000-mcp-client.ts session per call.
//
// WHY THIS MODULE EXISTS (D-16/D-18): the annotation store is reachable only
// through a CURATED subset of regenerator2000's own tool surface, not a
// 28-tool passthrough -- every tool here earns its place by serving one of
// this phase's four named criteria (see 11-05-PLAN.md's objective table).
// Excluded, each for a recorded reason: the TUI-shaped tools
// (`jump_to_address`, `get_disassembly_cursor`, `read_selected`,
// `toggle_splitter`) have no criterion; `undo`/`redo` are useless under
// D-17's per-call lifecycle (history dies with the spawned process);
// `get_address_details` is excluded by D-32 (see below); and
// `unpack_binary`, `read_region`, `search_memory`, `set_immediate_format`
// have no criterion in this phase.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: the 17 curated
// `ToolDefinition`s (`R2000_TOOL_DEFINITIONS`), the allow-list
// (`CURATED_R2000_TOOLS`) and its enforcement (`assertCuratedTool()`,
// including the batch-recursion gate), the caller-supplied project-path
// validation (`resolveStorePath()`), and the runner (`runR2000Tool()`) that
// drives r2000-mcp-client.ts. No other module may hand-list a curated tool
// name, hand-validate an r2000 project path, or call
// `r2000-mcp-client.ts` directly -- `vice-proxy.ts` (plan 11-05 Task 2)
// imports `R2000_TOOL_DEFINITIONS`/`runR2000Tool` from here and nothing
// else.
//
// MEASURED: `r2000_batch_execute`'s partial-failure semantics
// (`handler.rs:506-542`, read at execution time against the installed
// regenerator2000-core-0.9.20 crate source). The batch does NOT abort on
// the first failing inner call -- `handle_tool_call_internal()` is called
// per entry inside a loop, and each outcome (`Ok`/`Err`) is pushed into a
// `results` array as `{"status":"success","result":...}` or
// `{"status":"error","error":...}`; the loop always runs to completion and
// the whole response is `{"content":[{"type":"text","text":<pretty-JSON
// results array>}]}`. This is PER-CALL status reporting inside r2000 itself
// -- orthogonal to (and irrelevant to) D-33's OWN refusal, which happens
// entirely on our side, before any request reaches the child at all: an
// uncurated inner name never gets the chance to report a per-call status
// because the whole batch is refused before the spawn.
//
// WHAT NOT TO DO, named concretely:
//   - Never widen CURATED_R2000_TOOLS without a criterion recorded in
//     11-05-PLAN.md's objective table. A tool earns its place; it is not
//     added because it happens to exist upstream.
//   - Never let runR2000Tool() (or anything it calls) reach the VICE
//     argument-rewriting/host-forwarding/session-establishment seams, or
//     `call()` (vice.ts's transport seam). The r2000_* family never touches
//     the emulator -- it is registered proxy-locally via `buildViceTool()`
//     (plan 11-05 Task 2), which is what makes CLAUDE.md's "derived tools
//     must be intercepted before the host-forwarding seam" constraint moot
//     BY CONSTRUCTION for this family, not by an interception.
//   - Never add a `tools_call`-shaped meta-tool to this surface -- that is
//     exactly the nested-argument smuggling shape `vice.ts`'s `DENY_LIST`
//     exists to close, and `r2000_batch_execute` is already this project's
//     one sanctioned exception, gated by `assertCuratedTool()`'s own batch
//     recursion below.
//   - Never import the VICE host-path/container-path translation modules
//     here. regenerator2000 runs container-side (D-R4, Rule A16); a project
//     path is resolved against `repoRoot()` only. Asserted structurally by
//     the closed host-path consumer-set test.
//   - Never report `r2000_save_project` as persisted on the strength of its
//     own text response -- always route it through
//     `r2000-mcp-client.ts`'s `saveAndVerify()`.
import { realpathSync } from "node:fs";
import { resolve, sep } from "node:path";

import { repoRoot } from "./repo-root.ts";

// ---------------------------------------------------------------------------
// The wire shapes this module produces/consumes. Deliberately NOT imported
// from vice-proxy.ts (that file has no exported ToolDefinition/ToolCallResult
// -- both are file-local types there); these are structurally identical so a
// value built here is interchangeable wherever vice-proxy.ts combines it with
// its own manifest-sourced tools.
// ---------------------------------------------------------------------------

export interface R2000ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  // Structural compatibility with vice.ts's own ToolInfo (vice-proxy.ts's
  // ToolDefinition alias), which carries this index signature -- lets
  // vice-proxy.ts's buildViceTool() accept an R2000ToolDefinition directly,
  // with no per-call cast at the plan 11-05 Task 2 registration site.
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

/** Converts regenerator2000's own `CallToolResult` (already the same
 * `{content:[{type,text}],isError?}` shape our own `ToolCallResult` uses,
 * since both follow the MCP spec) into a `ToolCallResult` directly, rather
 * than re-wrapping the whole object as a second layer of JSON text. Falls
 * back to `okText(JSON.stringify(...))` only for a result that does not
 * already carry a `content` array -- defensive, since every curated tool's
 * real response has one. */
function toToolCallResult(result: unknown): ToolCallResult {
  if (isPlainObject(result) && Array.isArray(result.content)) {
    return { content: result.content as ToolCallResult["content"], isError: false };
  }
  return okText(JSON.stringify(result ?? null));
}

// ---------------------------------------------------------------------------
// D-19's shared property: every curated tool's inputSchema starts with this
// exact `project` property. One constant, spread into every definition below,
// rather than seventeen hand-typed copies that could drift from each other.
// ---------------------------------------------------------------------------

const PROJECT_PROPERTY = {
  project: {
    type: "string",
    description:
      "Absolute or workspace-relative path to the .regen2000proj annotation store (D-19: every " +
      "r2000_* tool takes an explicit project path; there is no ambient session state naming the store).",
  },
} as const;

// ---------------------------------------------------------------------------
// The 64K OutOfRange defect this surface excludes (D-32) -- shared between
// the outer-name refusal and the batch-inner refusal so both read identically.
// ---------------------------------------------------------------------------

const ADDRESS_DETAILS_REFUSAL =
  "r2000_get_address_details is not on the curated r2000_* surface (D-32): on a full 64K project " +
  "(exactly what c64-ram-capture produces) it returns {\"type\":\"OutOfRange\"} for EVERY address, " +
  "because handler.rs:1894's `raw_data.len() as u16` wraps 65536 to 0. Filed upstream as " +
  "https://github.com/ricardoquesada/regenerator2000/issues/42. Its answer is a composite of " +
  "instruction semantics, cross-references, labels, comments and block type -- all independently " +
  "reachable through r2000_get_binary_info, r2000_get_cross_references, r2000_get_symbols, " +
  "r2000_get_comments, r2000_get_blocks and r2000_disassemble, every one of which was measured " +
  "working on a 64K project.";

// ---------------------------------------------------------------------------
// The 17 curated tool definitions (D-18's objective table). Each argument
// shape below was obtained by driving `tools/list` against a real
// `regenerator2000 --mcp-server-stdio 0.9.20` child and copying its own
// argument shapes verbatim (never transcribed from a document), with
// `project` (D-19) prepended to every one.
// ---------------------------------------------------------------------------

export const R2000_TOOL_DEFINITIONS: readonly R2000ToolDefinition[] = [
  {
    name: "r2000_set_label_name",
    description:
      "Sets a user-defined label at a specific MOS 6502 memory address. Use this to name " +
      "functions, variables, or jump targets to make the disassembly more readable.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        address: {
          type: "integer",
          description: "The memory address where the label should be set (decimal, e.g. 4096 for $1000).",
        },
        name: {
          type: "string",
          description: "The label name (e.g. 'init_screen', 'loop_start').",
        },
      },
      required: ["project", "address", "name"],
    },
  },
  {
    name: "r2000_set_comment",
    description:
      "Adds a comment at a specific address. 'line' comments appear on their own line before the " +
      "instruction (supports multi-line). 'side' comments appear inline on the same line as the " +
      "instruction. Carrier for D-25's [confirmed-code]/[probable-code]/[confirmed-data]/" +
      "[probable-data]/[unknown] confidence-prefix convention.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        address: { type: "integer", description: "The memory address for the comment (decimal, e.g. 4096 for $1000)." },
        comment: { type: "string", description: "The comment text. Do not include the ';' prefix." },
        type: {
          type: "string",
          enum: ["line", "side"],
          description: "'line' = comment on its own line before the instruction. 'side' = inline comment on the same line.",
        },
      },
      required: ["project", "address", "comment", "type"],
    },
  },
  {
    name: "r2000_set_data_type",
    description:
      "Sets the data type for a memory region. Use this to mark regions as code, bytes, addresses, " +
      "text, split tables, etc.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        start_address: { type: "integer", description: "Start of the memory region (inclusive), decimal." },
        end_address: { type: "integer", description: "End of the memory region (inclusive), decimal." },
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
            "code=MOS 6502 instructions; byte=raw 8-bit data (sprites, charset, tables, unknowns); " +
            "word=16-bit LE values; address=16-bit LE pointers (creates X-Refs, use for jump " +
            "tables/vectors); petscii=PETSCII text; screencode=Screen code text (data written to " +
            "$0400); lo_hi_address=split address table, low bytes first then high bytes (even count " +
            "required); hi_lo_address=split address table, high bytes first (even count required); " +
            "lo_hi_word=split word table, low bytes first (e.g. SID freq tables); " +
            "hi_lo_word=split word table, high bytes first; external_file=large binary blob (SID, " +
            "bitmap, charset) to export as-is; undefined=reset region to unknown state.",
        },
      },
      required: ["project", "start_address", "end_address", "data_type"],
    },
  },
  {
    name: "r2000_add_scope",
    description:
      "Adds a scope covering the specified memory range. Useful for a piece of code that is a " +
      "routine. Starts a lexical level where all new symbols within this range are in the local " +
      "lexical level and are accessible from outside only via explicit scope specification. Nested " +
      "scopes are not supported.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        start_address: { type: "integer", description: "Start address of the scope (inclusive), decimal." },
        end_address: { type: "integer", description: "End address of the scope (inclusive), decimal." },
      },
      required: ["project", "start_address", "end_address"],
    },
  },
  {
    name: "r2000_get_symbols",
    description:
      "Returns defined labels (user and/or platform) and their addresses. With no arguments " +
      "(besides project) returns ALL symbols. Provide optional filters to narrow results: 'names' " +
      "resolves specific label names to addresses, 'start_address'/'end_address' limits to an " +
      "address range, 'kind' filters by label kind. Filters are combined (AND logic).",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        names: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of label names to look up. Only symbols whose name matches one of these strings are returned. Case-sensitive.",
        },
        start_address: { type: "integer", description: "Optional lower bound (inclusive) of the address range to filter by (decimal)." },
        end_address: { type: "integer", description: "Optional upper bound (inclusive) of the address range to filter by (decimal)." },
        kind: {
          type: "string",
          enum: ["user", "system", "auto"],
          description: "Optional filter to return only labels of a given kind. 'user' = user-defined labels, 'system' = predefined system labels (e.g. KERNAL, hardware registers), 'auto' = auto-generated labels (e.g. s_C000).",
        },
      },
      required: ["project"],
    },
  },
  {
    name: "r2000_get_comments",
    description:
      "Returns user-defined comments and their addresses. Each entry has 'address' (integer), " +
      "'type' ('line' or 'side'), and 'comment' (string). With no arguments (besides project) " +
      "returns ALL comments. Provide optional filters to narrow results: 'addresses' returns " +
      "comments at specific addresses, 'start_address'/'end_address' limits to an address range, " +
      "'type' filters by comment type. Filters are combined (AND logic). D-25's confidence-prefix " +
      "convention lives in the returned 'comment' text -- filter by prefix on the client side, or " +
      "combine with r2000_search_disassembly.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        addresses: {
          type: "array",
          items: { type: "integer" },
          description: "Optional list of specific addresses (decimal) to retrieve comments from. Only comments at these addresses are returned.",
        },
        start_address: { type: "integer", description: "Optional lower bound (inclusive) of the address range to filter by (decimal)." },
        end_address: { type: "integer", description: "Optional upper bound (inclusive) of the address range to filter by (decimal)." },
        type: { type: "string", enum: ["line", "side"], description: "Optional filter to return only 'line' comments or only 'side' comments." },
      },
      required: ["project"],
    },
  },
  {
    name: "r2000_get_blocks",
    description:
      "Returns all memory blocks with their address range and type (Code, Byte, Word, Address, " +
      "PETSCII, Screencode, Lo/Hi Address, Hi/Lo Address, Lo/Hi Word, Hi/Lo Word, External File, " +
      "Undefined). Respects splitters.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        block_type: { type: "string", description: "Optional filter to return only blocks of a specific type. Case-insensitive." },
      },
      required: ["project"],
    },
  },
  {
    name: "r2000_get_cross_references",
    description: "Get a list of addresses that reference the given address (e.g. JSRs, JMPs, loads).",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        address: { type: "integer", description: "The target address to find references to (decimal)." },
      },
      required: ["project", "address"],
    },
  },
  {
    name: "r2000_search_disassembly",
    description:
      "Search the disassembly text for a query string or regular expression. Returns a list of " +
      "matching addresses with context (label, mnemonic, operand, comment). Searches labels, " +
      "comments, and instructions by default; individual fields can be disabled. `max_results` is " +
      "REQUIRED on this surface (no default): regenerator2000's own default is 50, which would " +
      "silently truncate a full-program pass -- pass an explicit ceiling and compare the returned " +
      "count against it to detect truncation.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        query: { type: "string", description: "The search query. Interpreted as a plain case-insensitive substring by default, or as a regex when 'use_regex' is true." },
        max_results: { type: "integer", description: "Maximum number of matching addresses to return. No default on this surface -- always pass an explicit value." },
        use_regex: { type: "boolean", description: "When true the query is compiled as a case-insensitive regular expression ((?i) is prepended automatically). Defaults to false." },
        search_labels: { type: "boolean", description: "Include label names in the search. Defaults to true." },
        search_comments: { type: "boolean", description: "Include side and line comments in the search. Defaults to true." },
        search_instructions: { type: "boolean", description: "Include mnemonic and operand text in the search. Defaults to true." },
      },
      required: ["project", "query", "max_results"],
    },
  },
  {
    name: "r2000_disassemble",
    description:
      "Performs a control flow disassembly starting at a specific memory address, tracing " +
      "execution paths and automatically converting identified regions to Code blocks.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        address: { type: "integer", description: "The target start address for the disassembly flow analysis (decimal)." },
      },
      required: ["project", "address"],
    },
  },
  {
    name: "r2000_get_binary_info",
    description:
      "Returns the origin address, size in bytes, target platform (e.g. 'Commodore 64'), filename, " +
      "user-provided description, entropy of the binary (values higher than 7.5 suggest the binary " +
      "might be compressed), and whether the binary may contain undocumented opcodes (a hint, not " +
      "guaranteed).",
    inputSchema: {
      type: "object",
      properties: { ...PROJECT_PROPERTY },
      required: ["project"],
    },
  },
  {
    name: "r2000_create_project_enum",
    description: "Creates a new project-specific enum definition embedded in the project file (D-21: project-local, never machine-global).",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        name: { type: "string", description: "Unique alphanumeric identifier." },
        variants: { type: "object", description: "Variant mapping where keys are numeric strings (decimal, hex 0x/$, bin 0b/%) and values are variant names." },
        description: { type: "string", description: "Optional summary explaining the enum's purpose." },
      },
      required: ["project", "name", "variants"],
    },
  },
  {
    name: "r2000_update_project_enum",
    description: "Updates or renames an existing project-specific enum.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        name: { type: "string", description: "Existing name of the enum to update." },
        new_name: { type: "string", description: "Optional new name if renaming the enum." },
        variants: { type: "object", description: "Optional complete updated variants mapping." },
        description: { type: "string", description: "Optional updated summary explaining the enum's purpose." },
      },
      required: ["project", "name"],
    },
  },
  {
    name: "r2000_delete_project_enum",
    description:
      "Deletes a project-specific enum from the project. A regenerated enum set must be able to " +
      "replace an old one (R2000-13's re-runnable generation).",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        name: { type: "string", description: "The name of the enum to delete." },
        force: { type: "boolean", description: "If false, fails if the enum has active usages in the disassembly. Set to true to override." },
      },
      required: ["project", "name"],
    },
  },
  {
    name: "r2000_apply_enum_usage",
    description:
      "Applies an enum definition to format the immediate operand or constant reference at a " +
      "specific address. If name is omitted or empty, clears the enum usage.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        address: { type: "integer", description: "The target instruction address (decimal)." },
        name: { type: "string", description: "The unique name of the enum to apply (e.g., 'vic_registers'). Omit or send empty to clear." },
      },
      required: ["project", "address"],
    },
  },
  {
    name: "r2000_save_project",
    description:
      "Explicitly saves the current project state to the .regen2000proj file named by 'project'. " +
      "Every OTHER mutating tool on this surface already saves automatically at the end of its own " +
      "call (D-17's per-call lifecycle), so this tool is rarely required standalone -- it exists as " +
      "an explicit flush, and as the natural last entry inside an r2000_batch_execute call. This " +
      "surface takes ONLY 'project' -- the underlying regenerator2000 tool takes no arguments of its " +
      "own and errors when its project_path is unset (handler.rs:350-352,1264-1271), which is " +
      "exactly why the path comes from this session's own process launch. Persistence is verified " +
      "independently by re-reading the project file's content hash from disk (T-11-FALSESUCCESS) -- " +
      "never trusted on the strength of regenerator2000's own success text.",
    inputSchema: {
      type: "object",
      properties: { ...PROJECT_PROPERTY },
      required: ["project"],
    },
  },
  {
    name: "r2000_batch_execute",
    description:
      "Executes multiple tool calls sequentially in a single r2000 session. Use only when you have " +
      "5+ independent operations to perform at once (e.g. marking many regions, renaming many " +
      "labels). Do not use for operations that depend on each other's results. Every inner " +
      "calls[].name is validated against this surface's own curated set BEFORE any request reaches " +
      "regenerator2000 -- a batch containing even one uncurated inner name is refused WHOLE (D-33).",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        calls: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Name of the tool to execute -- must be one of this surface's curated r2000_* names." },
              arguments: { type: "object", description: "Arguments for the tool (same shape as that tool's own inputSchema, minus 'project')." },
            },
            required: ["name", "arguments"],
          },
          description: "List of tool calls to execute sequentially, inside one loaded r2000 session.",
        },
      },
      required: ["project", "calls"],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// The allow-list gate (D-18/D-33). Derived from R2000_TOOL_DEFINITIONS itself
// -- one array, not two hand-typed lists that could drift apart (the
// set-equality test in r2000-tools.test.ts proves this holds, in both
// directions, rather than assuming it from this derivation alone).
// ---------------------------------------------------------------------------

export const CURATED_R2000_TOOLS: readonly string[] = R2000_TOOL_DEFINITIONS.map((def) => def.name);

export interface R2000UncuratedToolErrorOptions {
  toolName: string;
  batchIndex?: number;
}

/** Thrown by `assertCuratedTool()` when a name is outside the curated set --
 * whether at the outer dispatch or nested inside an `r2000_batch_execute`
 * payload. `toolName` names the offending tool (never this class's own
 * `.name`, which stays the class name per this repo's `R2000ViceFlagError`/
 * `StockSymbolsError` convention); `batchIndex` is set only for a refusal
 * discovered while walking a batch's `calls` array. */
export class R2000UncuratedToolError extends Error {
  toolName: string;
  batchIndex?: number;

  constructor(message: string, { toolName, batchIndex }: R2000UncuratedToolErrorOptions) {
    super(message);
    this.name = "R2000UncuratedToolError";
    this.toolName = toolName;
    this.batchIndex = batchIndex;
  }
}

/** Walks a `r2000_batch_execute` payload's `calls` array and refuses the
 * WHOLE batch if any inner call's name is outside `CURATED_R2000_TOOLS`, or
 * if a `calls` entry is malformed (not an object, or missing a string
 * `name`) -- a malformed payload is a REFUSAL, never treated as an empty
 * batch that passes through. Recurses into a nested `r2000_batch_execute`
 * (upstream permits arbitrary tool names inside a batch, including another
 * batch call) so a two-level smuggling attempt is caught the same way a
 * one-level one is. */
function assertCuratedBatch(args: unknown): void {
  if (!isPlainObject(args) || !Array.isArray(args.calls)) {
    throw new R2000UncuratedToolError(
      "r2000_batch_execute refused: \"calls\" must be an array of {name, arguments} objects -- a " +
        "malformed batch payload is treated as a refusal, never as an empty batch that passes through.",
      { toolName: "r2000_batch_execute" },
    );
  }
  const calls = args.calls as unknown[];
  calls.forEach((call, i) => {
    if (!isPlainObject(call) || typeof call.name !== "string") {
      throw new R2000UncuratedToolError(
        `r2000_batch_execute refused WHOLE: calls[${i}] is malformed (missing a string "name") -- ` +
          "treated as a refusal, never as an empty batch that passes through.",
        { toolName: "r2000_batch_execute", batchIndex: i },
      );
    }
    if (call.name === "r2000_get_address_details") {
      throw new R2000UncuratedToolError(
        `r2000_batch_execute refused WHOLE: calls[${i}].name is "r2000_get_address_details" -- ${ADDRESS_DETAILS_REFUSAL}`,
        { toolName: call.name, batchIndex: i },
      );
    }
    if (!CURATED_R2000_TOOLS.includes(call.name)) {
      throw new R2000UncuratedToolError(
        `r2000_batch_execute refused WHOLE: calls[${i}].name "${call.name}" is outside the curated ` +
          "r2000_* tool surface -- a batch is refused whole if any inner name is outside the curated set (D-33).",
        { toolName: call.name, batchIndex: i },
      );
    }
    if (call.name === "r2000_batch_execute") {
      assertCuratedBatch(call.arguments);
    }
  });
}

/**
 * The allow-list gate. Its body's FIRST check is set membership (WHAT NOT TO
 * DO above, and the module header's own discipline mirroring `vice.ts`'s
 * `DENY_LIST` precedent inverted into an allow-list): refuses `name` outright
 * when it is not in `CURATED_R2000_TOOLS`, with a dedicated message for
 * `r2000_get_address_details` naming the 64K defect and the upstream issue
 * (D-32) rather than a generic "unknown tool" refusal. When `name` is
 * `r2000_batch_execute`, additionally walks `args.calls` via
 * `assertCuratedBatch()` -- refusing the WHOLE batch if any inner name is
 * outside the set, per D-33.
 */
export function assertCuratedTool(name: string, args?: unknown): void {
  if (name === "r2000_get_address_details") {
    throw new R2000UncuratedToolError(ADDRESS_DETAILS_REFUSAL, { toolName: name });
  }
  if (!CURATED_R2000_TOOLS.includes(name)) {
    throw new R2000UncuratedToolError(
      `"${name}" is not part of the curated r2000_* tool surface. Resolution routes: implement it and ` +
        "add it to R2000_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.",
      { toolName: name },
    );
  }
  if (name === "r2000_batch_execute") {
    assertCuratedBatch(args);
  }
}

// ---------------------------------------------------------------------------
// Project-path validation (T-11-PATH-ESCAPE) -- the same posture
// stock-symbols.ts takes for `.lbl` files: an LLM-supplied path reaching a
// spawned child process. Resolve against repoRoot(), refuse an extension
// other than .regen2000proj, and refuse anything that escapes the workspace
// root either directly or via a symlink.
// ---------------------------------------------------------------------------

export class R2000StorePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2000StorePathError";
  }
}

function isContained(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + sep);
}

/** Resolves `project` against `repoRoot()`, refusing anything that does not
 * end in `.regen2000proj`, or that escapes the workspace either directly or
 * via a symlink. Tolerant of the path not existing yet (ENOENT during the
 * symlink-resolution step) since `r2000_save_project` can create a fresh
 * store -- unlike stock-symbols.ts's `.lbl` reader, this module never reads
 * the file itself, so a missing project is regenerator2000's own concern to
 * report, not this function's. */
export function resolveStorePath(project: unknown): string {
  if (typeof project !== "string" || project.trim() === "") {
    throw new R2000StorePathError(
      `project must be a non-empty string, got ${typeof project === "string" ? "an empty/whitespace-only string" : typeof project}`,
    );
  }
  const trimmed = project.trim();
  if (!trimmed.toLowerCase().endsWith(".regen2000proj")) {
    throw new R2000StorePathError(
      `"${trimmed}" must end in .regen2000proj -- refusing to hand a non-project path to a spawned regenerator2000 child`,
    );
  }

  const root = repoRoot();
  const resolved = resolve(root, trimmed);

  if (!isContained(resolved, root)) {
    throw new R2000StorePathError(`"${resolved}" is outside the workspace root (${root}) -- an r2000 project path must live inside the workspace`);
  }

  let realRoot: string;
  try {
    realRoot = realpathSync(root);
  } catch {
    realRoot = root;
  }

  let real = resolved;
  try {
    real = realpathSync(resolved);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new R2000StorePathError(`could not resolve "${resolved}" (${err instanceof Error ? err.message : String(err)})`);
    }
    // ENOENT is fine here -- r2000_save_project may create the file fresh.
  }

  if (!isContained(real, realRoot)) {
    throw new R2000StorePathError(
      `"${resolved}" resolves (via symlink) to "${real}", which is outside the workspace root ` +
        `(${realRoot === root ? realRoot : `${root}, canonically ${realRoot}`}) -- an r2000 project path must live inside the workspace`,
    );
  }

  return real;
}

// ---------------------------------------------------------------------------
// Read-only tools never need a save -- calling one leaves project state
// unchanged. Every OTHER curated tool (besides r2000_save_project itself)
// mutates state (a label, a comment, a block classification, a scope, an
// enum, or -- for r2000_disassemble -- the blocks a control-flow trace
// converts to Code) and MUST be saved before its session exits, or D-17's
// own per-call lifecycle ("spawn, load, mutate, r2000_save_project, exit")
// silently loses the mutation: a spawned child that exits without saving
// discards every in-memory change, so a caller who wrote a label in one
// runR2000Tool() call and expected a LATER call to see it would be exactly
// as vulnerable to a lost-write bug as r2000_save_project's own
// T-11-FALSESUCCESS trap -- just with no error at all. This is why every
// mutating tool call below saves internally, inside the SAME session, rather
// than requiring a caller to remember a separate r2000_save_project call.
//
// That internal auto-save deliberately calls the PLAIN underlying
// `r2000_save_project` (no hash verification), never `saveAndVerify()`: an
// idempotent mutation (e.g. setting a label to the value it already has) is
// a legitimate no-op whose save correctly produces an UNCHANGED file hash,
// and `saveAndVerify()`'s whole contract is "throw when the hash does not
// change" -- applying it to every internal auto-save would misreport that
// legitimate no-op as T-11-FALSESUCCESS. `saveAndVerify()` is reserved for
// the ONE case the plan names explicitly: when `r2000_save_project` is the
// OUTER tool a caller invoked by name.
// ---------------------------------------------------------------------------

const READ_ONLY_R2000_TOOLS: ReadonlySet<string> = new Set([
  "r2000_get_symbols",
  "r2000_get_comments",
  "r2000_get_blocks",
  "r2000_get_cross_references",
  "r2000_search_disassembly",
  "r2000_get_binary_info",
]);

// ---------------------------------------------------------------------------
// The runner. Drives r2000-mcp-client.ts via a DYNAMIC import so importing
// R2000_TOOL_DEFINITIONS (registration, at vice-proxy.ts module scope) costs
// no child process and no socket -- only calling a tool actually spawns one.
// ---------------------------------------------------------------------------

/**
 * Runs one curated `r2000_*` tool call. First statement: `assertCuratedTool`.
 * Second: `resolveStorePath`. Only after both pass does this function reach
 * for `r2000-mcp-client.ts` (dynamically imported, so registering the tool
 * definitions above never pays for it).
 *
 * `r2000_save_project` (called directly by name) is routed through
 * `saveAndVerify()` so a save is never reported on the child's own text
 * response alone (T-11-FALSESUCCESS). Every OTHER mutating tool (everything
 * outside `READ_ONLY_R2000_TOOLS` and not `r2000_save_project` itself) saves
 * internally, inside the same session, immediately after its own call, using
 * a PLAIN save (see the comment above `READ_ONLY_R2000_TOOLS` for why that
 * internal save must not be hash-verified).
 */
export async function runR2000Tool(name: string, args: unknown): Promise<ToolCallResult> {
  assertCuratedTool(name, args);
  const projectPath = resolveStorePath(isPlainObject(args) ? args.project : undefined);

  const { withR2000Session, saveAndVerify } = await import("./r2000-mcp-client.ts");

  const rest: Record<string, unknown> = isPlainObject(args) ? { ...args } : {};
  delete rest.project;

  try {
    if (name === "r2000_save_project") {
      const result = await withR2000Session(projectPath, (call) => saveAndVerify(projectPath, call));
      return okText(JSON.stringify(result));
    }

    if (READ_ONLY_R2000_TOOLS.has(name)) {
      const result = await withR2000Session(projectPath, (call) => call(name, rest));
      return toToolCallResult(result);
    }

    // A mutating tool (including r2000_batch_execute, whose own inner calls
    // all run inside this SAME session per regenerator2000's own
    // batch_execute implementation): call, then save PLAINLY (no hash
    // verification -- see the block comment above), before the session
    // exits.
    const result = await withR2000Session(projectPath, async (call) => {
      const callResult = await call(name, rest);
      await call("r2000_save_project", {});
      return callResult;
    });
    return toToolCallResult(result);
  } catch (err) {
    return errText(`${name} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
