#!/usr/bin/env node
// r2000-tools.ts -- the ONE authoritative place in this repo for the curated
// r2000_* tool surface: which 19 curated regenerator2000 MCP tools (of the
// 28 upstream offers) this project advertises, the allow-list gate
// (including its D-33 batch recursion), project-path validation, and the
// runner that drives the SHARED, long-lived regenerator2000 session
// `r2000-session.ts`'s `runInR2000Session()` owns (Rule A21 -- the D-17/D-18
// per-call-lifecycle reversal, plan 18-03; no longer one
// `r2000-mcp-client.ts` session per call).
//
// WHY THIS MODULE EXISTS (D-16/D-18): the annotation store is reachable only
// through a CURATED subset of regenerator2000's own tool surface, not a
// 28-tool passthrough -- every tool here earns its place by serving a named
// criterion (11-05-PLAN.md's objective table for the original four; SURF-01/
// SURF-02, plan 18-05, for `r2000_read_region` and
// `r2000_get_address_details`). Excluded, each for a recorded reason: the
// TUI-shaped cursor trio (`get_disassembly_cursor`, `jump_to_address`,
// `read_selected`) is HELD, not merely unproven (D18-26) -- `r2000_read_region`
// now answers "read this routine" directly by range, making the trio largely
// redundant; a real caller appearing in Phase 19's absorption diff is what
// would justify adding one, additively. `toggle_splitter` has no criterion.
// `undo`/`redo` earn no place under this surface's own discipline -- a
// curated tool must serve a named criterion, and neither does; their
// original justification (useless under D-17's per-call lifecycle, since
// history died with the spawned process) no longer applies now that a
// session persists across calls (Rule A21), but persistence alone is not by
// itself a reason to curate them. `unpack_binary`, `search_memory`,
// `set_immediate_format` have no criterion in this phase.
// `r2000_read_region` IS curated (SURF-01, D18-24/D18-25): a routine read at
// an address range with a documented cap, instead of exporting the whole
// program. `r2000_get_address_details` IS curated (SURF-02, D-36
// superseding D-32) as a client-side composition -- see
// `composeAddressDetails()` below -- that never calls upstream's own
// same-named, defective tool.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: the 19 curated
// `ToolDefinition`s (`R2000_TOOL_DEFINITIONS`), the allow-list
// (`CURATED_R2000_TOOLS`) and its enforcement (`assertCuratedTool()`,
// including the batch-recursion gate), the caller-supplied project-path
// validation (`resolveStorePath()`), and the runner (`runR2000Tool()`) that
// drives `r2000-session.ts`'s shared session. No other module may hand-list
// a curated tool name, hand-validate an r2000 project path, or call
// `r2000-mcp-client.ts`/`r2000-session.ts` directly -- `vice-proxy.ts` (plan
// 11-05 Task 2) imports `R2000_TOOL_DEFINITIONS`/`runR2000Tool` from here and
// nothing else.
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
import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";

import { repoRoot } from "./repo-root.ts";
import { assertLegalAcmeIdentifier } from "./r2000-acme-ident.ts";
// Type-only -- costs no child process at import time (mirrors
// r2000-session.ts's own "class/type imports are free, the spawn primitive
// is reached only via dynamic import" convention).
import type { R2000Call } from "./r2000-mcp-client.ts";

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
// r2000_get_address_details (SURF-02, D-36 superseding D-32, plan 18-05).
// D-32 excluded this tool outright: on a full 64K project (exactly what
// c64-ram-capture produces) upstream's own r2000_get_address_details returns
// {"type":"OutOfRange"} for EVERY address, because handler.rs:1894's
// `raw_data.len() as u16` wraps 65536 to 0 (filed upstream as
// https://github.com/ricardoquesada/regenerator2000/issues/42). D-36
// (dated, recorded in .planning/PROJECT.md's Key Decisions table, pinned by
// docs-r2000-decisions.test.ts) supersedes that exclusion: the tool is now
// CURATED as a client-side composition (see composeAddressDetails() below)
// of the four already-curated reads its answer is built from
// (r2000_get_symbols, r2000_get_comments, r2000_get_blocks,
// r2000_get_cross_references) and NEVER calls upstream's own same-named
// tool -- the u16 cast is unreachable by construction, not merely detected
// and routed around (D18-27/D18-28).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// r2000_read_region's documented range cap (D18-25, SURF-01, plan 18-05). A
// full-64K disassembly view dumped into an LLM's context is the hazard this
// cap exists to prevent -- this tool's purpose is reading a routine, not
// exporting the whole program. 4096 is one sixteenth of the address space
// and far above any realistic single routine; the disassembly view at the
// cap is the worst case (the hexdump view at the same byte count renders far
// less text), and that is deliberate: ONE cap, both views, so there is no
// per-view rule to get subtly wrong.
// ---------------------------------------------------------------------------

export const R2000_READ_REGION_MAX_BYTES = 4096;

/** Reads the `R2000_READ_REGION_MAX_BYTES` override AT CALL TIME (never
 * frozen at module load) -- the same read-at-call-time convention
 * `r2000-session.ts`'s `currentRestartBudget()` uses for
 * `R2000_RESTART_BUDGET`, so one `node --test` process can point several
 * different caps at the same code within a single run. Falls back to the
 * named default on an absent, non-finite, or non-positive override. */
function currentReadRegionMaxBytes(): number {
  const raw = process.env.R2000_READ_REGION_MAX_BYTES;
  if (raw === undefined) return R2000_READ_REGION_MAX_BYTES;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : R2000_READ_REGION_MAX_BYTES;
}

// ---------------------------------------------------------------------------
// The 19 curated tool definitions (D-18's objective table, extended by
// SURF-01/SURF-02, plan 18-05). Each argument shape below was obtained by
// driving `tools/list` against a real `regenerator2000 --mcp-server-stdio
// 0.9.20` child and copying its own argument shapes verbatim (never
// transcribed from a document), with `project` (D-19) prepended to every
// one.
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
          description:
            "The label name (e.g. 'init_screen', 'loop_start'). Must be a legal ACME identifier: starts " +
            "with a letter or underscore, followed by letters/digits/underscores only, and must not be a " +
            "6502/6510 mnemonic (e.g. 'LDA'). An illegal name is REJECTED, never sanitized or quoted.",
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
  {
    name: "r2000_read_region",
    description:
      "Reads a routine at an address range instead of exporting the whole program (SURF-01, plan " +
      "18-05): returns disassembly or hexdump text for start_address..end_address (inclusive on both " +
      "ends). Both views are one enum parameter: 'hexdump' is what data-table classification and " +
      "table extraction want; 'disasm' is what routine documentation wants. Observed live against " +
      "the real regenerator2000 0.9.20 binary: when 'view' is omitted, the response is IDENTICAL to " +
      `view: 'disasm' (upstream's own schema states its default is 'disasm', confirmed by direct ` +
      `call). The combined byte count (end_address - start_address + 1) is capped at ` +
      `${R2000_READ_REGION_MAX_BYTES} bytes by default (R2000_READ_REGION_MAX_BYTES, overridable via ` +
      "that environment variable) -- a request above the cap is refused by name " +
      "(R2000ReadRegionRangeError) rather than silently truncated, naming the requested size and the " +
      "valid range.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        start_address: { type: "integer", description: "Start of the memory range (inclusive), decimal." },
        end_address: { type: "integer", description: "End of the memory range (inclusive), decimal." },
        view: {
          type: "string",
          enum: ["disasm", "hexdump"],
          description:
            "'disasm' = control-flow disassembly text (routine documentation). 'hexdump' = raw hex " +
            "bytes (data-table classification/extraction). Omitted defaults to 'disasm' (regenerator2000's " +
            "own default, confirmed live).",
        },
      },
      required: ["project", "start_address", "end_address"],
    },
  },
  {
    name: "r2000_get_address_details",
    description:
      "Returns detailed information about a specific memory address: instruction semantics, " +
      "cross-references, labels, comments, and block type (SURF-02, plan 18-05). This answer is " +
      "composed client-side from four separate reads (r2000_get_symbols, r2000_get_comments, " +
      "r2000_get_blocks, r2000_get_cross_references) -- it never invokes regenerator2000's own " +
      "same-named tool. Why: upstream's own r2000_get_address_details returns {\"type\":\"OutOfRange\"} " +
      "for EVERY address on a full 64K project (handler.rs:1894's `raw_data.len() as u16` wraps 65536 " +
      "to 0), filed upstream as https://github.com/ricardoquesada/regenerator2000/issues/42 (D-36, " +
      "superseding D-32). The returned object carries a `composed_client_side: true` marker and a " +
      "`composed_from` list naming the four source tools, so this is never mistaken for upstream's " +
      "native answer.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_PROPERTY,
        address: { type: "integer", description: "The memory address to inspect (decimal)." },
      },
      required: ["project", "address"],
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

export interface R2000LabelNameErrorOptions {
  labelName: string;
  batchIndex?: number;
}

/** Thrown by `assertLegalLabelArg()` (called from `assertCuratedTool()` and
 * `assertCuratedBatch()`) when an `r2000_set_label_name` call's `name`
 * argument is not a legal ACME identifier -- T-11-NAME-INJECT, closed. The
 * policy is REJECT, never sanitize or quote: a malformed name is a bug to
 * surface, so the store's printed name can never diverge from what actually
 * gets exported into ACME source. `labelName` names the offending value
 * (never this class's own `.name`, which stays the class name per this
 * module's `R2000UncuratedToolError` convention); `batchIndex` is set only
 * for a refusal discovered while walking a batch's `calls` array. */
export class R2000LabelNameError extends Error {
  labelName: string;
  batchIndex?: number;

  constructor(message: string, { labelName, batchIndex }: R2000LabelNameErrorOptions) {
    super(message);
    this.name = "R2000LabelNameError";
    this.labelName = labelName;
    this.batchIndex = batchIndex;
  }
}

export interface R2000ReadRegionRangeErrorOptions {
  start: number;
  end: number;
  requestedBytes: number;
  batchIndex?: number;
}

/** Thrown by the `assertReadRegionArgs` validator (called from
 * `assertCuratedTool()` and `assertCuratedBatch()`) when an
 * `r2000_read_region` call's range is
 * inverted, falls outside the 0..65535 address space, or exceeds
 * `R2000_READ_REGION_MAX_BYTES` (D18-25) -- never silently truncated: a
 * full-64K disassembly view dumped into an LLM's context is exactly the
 * hazard this cap exists to prevent. `start`/`end`/`requestedBytes` name the
 * offending values (never this class's own `.name`, matching this module's
 * `R2000LabelNameError` convention); `batchIndex` is set only for a refusal
 * discovered while walking a batch's `calls` array. */
export class R2000ReadRegionRangeError extends Error {
  start: number;
  end: number;
  requestedBytes: number;
  batchIndex?: number;

  constructor(message: string, { start, end, requestedBytes, batchIndex }: R2000ReadRegionRangeErrorOptions) {
    super(message);
    this.name = "R2000ReadRegionRangeError";
    this.start = start;
    this.end = end;
    this.requestedBytes = requestedBytes;
    this.batchIndex = batchIndex;
  }
}

/** Validates an `r2000_read_region` call's `start_address`/`end_address`
 * pair against the 0..65535 address space, inversion, and
 * `R2000_READ_REGION_MAX_BYTES`'s cap (D18-25) -- BEFORE any spawn, the same
 * pre-spawn posture `assertLegalLabelArg()` already takes. A no-op when
 * `args` is not a plain object carrying numeric `start_address`/
 * `end_address` -- that shape is a different concern (a missing/malformed
 * required argument), not this function's. Called from BOTH
 * `assertCuratedTool()` and `assertCuratedBatch()`, mirroring exactly how
 * `assertLegalLabelArg()` is already called from both, so the cap fires
 * identically whether `r2000_read_region` is called directly or smuggled
 * inside an `r2000_batch_execute` payload. */
function assertReadRegionArgs(args: unknown, batchIndex?: number): void {
  if (!isPlainObject(args)) return;
  const { start_address, end_address } = args;
  if (typeof start_address !== "number" || typeof end_address !== "number") return;

  const suffix = batchIndex !== undefined ? ` (calls[${batchIndex}])` : "";
  const requestedBytes = end_address - start_address + 1;

  if (start_address < 0 || start_address > 0xffff || end_address < 0 || end_address > 0xffff) {
    throw new R2000ReadRegionRangeError(
      `r2000_read_region refused${suffix}: start_address (${start_address}) and end_address ` +
        `(${end_address}) must both be within the valid address range 0..65535`,
      { start: start_address, end: end_address, requestedBytes, batchIndex },
    );
  }
  if (end_address < start_address) {
    throw new R2000ReadRegionRangeError(
      `r2000_read_region refused${suffix}: end_address (${end_address}) is less than start_address ` +
        `(${start_address}) -- the range is inclusive at both ends and must not be inverted`,
      { start: start_address, end: end_address, requestedBytes, batchIndex },
    );
  }
  const cap = currentReadRegionMaxBytes();
  if (requestedBytes > cap) {
    throw new R2000ReadRegionRangeError(
      `r2000_read_region refused${suffix}: requested ${requestedBytes} bytes ` +
        `(${start_address}..${end_address} inclusive), which exceeds the R2000_READ_REGION_MAX_BYTES ` +
        `cap of ${cap} -- valid range is 1..${cap} bytes. This tool reads a routine at a range, not the ` +
        "whole program; set R2000_READ_REGION_MAX_BYTES to override.",
      { start: start_address, end: end_address, requestedBytes, batchIndex },
    );
  }
}

/** Validates an `r2000_set_label_name` call's `name` argument against the
 * one ACME identifier seam (`r2000-acme-ident.ts`'s `assertLegalAcmeIdentifier()`),
 * re-throwing as `R2000LabelNameError` on failure. A no-op when `args` is
 * not a plain object carrying a string `name` -- that shape is a different
 * concern (a missing/malformed required argument), not this function's.
 * Called from BOTH `assertCuratedTool()` (the outer dispatch) and
 * `assertCuratedBatch()` (the batch-inner call), so the refusal fires
 * identically whether `r2000_set_label_name` is called directly or smuggled
 * inside an `r2000_batch_execute` payload -- before `runR2000Tool()`'s own
 * `try` block either way, which means a refusal REJECTS the returned
 * promise rather than resolving `{isError:true}`. That asymmetry is WR-02
 * (out of scope for this plan, 260821-a86) -- the same posture the existing
 * uncurated-name refusal above already takes, not a new oversight. */
function assertLegalLabelArg(args: unknown, batchIndex?: number): void {
  if (!isPlainObject(args) || typeof args.name !== "string") return;
  const name = args.name;
  try {
    assertLegalAcmeIdentifier(name, "r2000_set_label_name name");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new R2000LabelNameError(
      `r2000_set_label_name refused${batchIndex !== undefined ? ` (calls[${batchIndex}])` : ""}: "${name}" is not ` +
        `a legal ACME identifier (${reason}) -- REJECTED, never sanitized or quoted: the store's printed name must ` +
        "never diverge from the exported symbol.",
      { labelName: name, batchIndex },
    );
  }
}

/** Walks a `r2000_batch_execute` payload's `calls` array and refuses the
 * WHOLE batch if any inner call's name is outside `CURATED_R2000_TOOLS`, or
 * if a `calls` entry is malformed (not an object, or missing a string
 * `name`) -- a malformed payload is a REFUSAL, never treated as an empty
 * batch that passes through. Recurses into a nested `r2000_batch_execute`
 * (upstream permits arbitrary tool names inside a batch, including another
 * batch call) so a two-level smuggling attempt is caught the same way a
 * one-level one is. Also refuses WHOLE on an illegal `r2000_set_label_name`
 * name (T-11-NAME-INJECT), naming the offending `calls[i]`. */
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
    if (!CURATED_R2000_TOOLS.includes(call.name)) {
      throw new R2000UncuratedToolError(
        `r2000_batch_execute refused WHOLE: calls[${i}].name "${call.name}" is outside the curated ` +
          "r2000_* tool surface -- a batch is refused whole if any inner name is outside the curated set (D-33).",
        { toolName: call.name, batchIndex: i },
      );
    }
    if (call.name === "r2000_set_label_name") {
      assertLegalLabelArg(call.arguments, i);
    }
    if (call.name === "r2000_read_region") {
      assertReadRegionArgs(call.arguments, i);
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
 * when it is not in `CURATED_R2000_TOOLS`. `r2000_get_address_details` IS a
 * member of that set (D-36, superseding D-32's former exclusion) -- its
 * dispatch is a client-side composition, never a passthrough to upstream's
 * own same-named tool; see `composeAddressDetails()` and its
 * `runR2000Tool()` special case. When `name` is `r2000_set_label_name`,
 * additionally validates `args.name` via `assertLegalLabelArg()`
 * (T-11-NAME-INJECT, closed). When `name` is `r2000_read_region`,
 * additionally validates the range against the documented cap (D18-25).
 * When `name` is `r2000_batch_execute`, additionally walks `args.calls` via
 * `assertCuratedBatch()` -- refusing the WHOLE batch if any inner name is
 * outside the set, per D-33, or carries an illegal label name or an
 * out-of-cap read-region range.
 */
export function assertCuratedTool(name: string, args?: unknown): void {
  if (!CURATED_R2000_TOOLS.includes(name)) {
    throw new R2000UncuratedToolError(
      `"${name}" is not part of the curated r2000_* tool surface. Resolution routes: implement it and ` +
        "add it to R2000_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.",
      { toolName: name },
    );
  }
  if (name === "r2000_set_label_name") {
    assertLegalLabelArg(args);
  }
  if (name === "r2000_read_region") {
    assertReadRegionArgs(args);
  }
  if (name === "r2000_batch_execute") {
    assertCuratedBatch(args);
  }
}

// ---------------------------------------------------------------------------
// Project-path validation (T-11-PATH-ESCAPE, WR-01 -- closed). Same posture
// stock-symbols.ts takes for `.lbl` files: an LLM-supplied path reaching a
// spawned child process. Resolve against repoRoot(), refuse an extension
// other than .regen2000proj, and refuse anything that escapes the workspace
// root either directly or via a symlink. WR-01's finding was that a
// not-yet-existing leaf under a directory symlink bypassed containment
// entirely (the ENOENT catch fell back to the literal, unresolved path).
// Containment is now enforced against the DEEPEST EXISTING ancestor's
// realpath, plus the literal remaining path segments rebuilt on top of it
// (`resolveViaDeepestExistingAncestor()` below) -- and every one of those
// remaining segments is itself lstat-guarded against being an unresolved
// (e.g. dangling) symlink, which would otherwise slip through the
// ancestor-realpath check the same way the original leaf did.
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

/** Walks up from `dirname(resolved)` toward the filesystem root, collecting
 * the literal path segments skipped along the way, until it finds the
 * DEEPEST ancestor for which `realpathSync` succeeds. Rebuilds the
 * candidate as `join(ancestorReal, ...remainingSegments)` -- but first
 * lstat-guards every remaining segment: a symlink whose own target does not
 * exist yet (or otherwise fails to resolve) still redirects a later create
 * outside the workspace, and `realpathSync` on the full path reports plain
 * ENOENT for it, so it would otherwise slip through the ancestor-realpath
 * check entirely. `lstatSync`'s own ENOENT (a genuinely absent component,
 * the tolerated case) is swallowed; any OTHER lstat error propagates as a
 * refusal. Called only from `resolveStorePath()`'s ENOENT branch below. */
function resolveViaDeepestExistingAncestor(resolved: string, root: string): string {
  const remaining: string[] = [basename(resolved)];
  let current = dirname(resolved);
  let ancestorReal: string;
  for (;;) {
    try {
      ancestorReal = realpathSync(current);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new R2000StorePathError(
          `could not resolve ancestor "${current}" while resolving "${resolved}" (${err instanceof Error ? err.message : String(err)})`,
        );
      }
      const parent = dirname(current);
      if (parent === current) {
        throw new R2000StorePathError(
          `could not find any existing ancestor while resolving "${resolved}" under workspace root "${root}"`,
        );
      }
      remaining.unshift(basename(current));
      current = parent;
    }
  }

  let accumulated = ancestorReal;
  for (const segment of remaining) {
    accumulated = join(accumulated, segment);
    let st;
    try {
      st = lstatSync(accumulated);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue; // genuinely absent -- tolerated
      throw new R2000StorePathError(
        `could not stat "${accumulated}" while resolving "${resolved}" (${err instanceof Error ? err.message : String(err)})`,
      );
    }
    if (st.isSymbolicLink()) {
      throw new R2000StorePathError(
        `"${resolved}" contains a symlink component at "${accumulated}" that does not itself resolve (dangling, or ` +
          "otherwise unreadable via realpathSync) -- refusing rather than risk a later create redirecting outside " +
          `the workspace root (${root})`,
      );
    }
  }

  return accumulated;
}

/** Resolves `project` against `repoRoot()`, refusing anything that does not
 * end in `.regen2000proj`, or that escapes the workspace either directly or
 * via a symlink. Tolerant of the path not existing yet (ENOENT during the
 * symlink-resolution step) since `r2000_save_project` can create a fresh
 * store -- unlike stock-symbols.ts's `.lbl` reader, this module never reads
 * the file itself, so a missing project is regenerator2000's own concern to
 * report, not this function's. On ENOENT, containment is enforced against
 * the deepest EXISTING ancestor's realpath plus the literal remaining
 * segments (`resolveViaDeepestExistingAncestor()`), closing WR-01 /
 * T-11-PATH-ESCAPE: the previous ENOENT fallback (`real = resolved`, the
 * literal, unresolved path) let a directory symlink one or more levels up
 * from a not-yet-existing leaf bypass containment entirely. */
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

  let real: string;
  try {
    real = realpathSync(resolved);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new R2000StorePathError(`could not resolve "${resolved}" (${err instanceof Error ? err.message : String(err)})`);
    }
    // ENOENT is fine here -- r2000_save_project may create the file fresh.
    // Walk up to the deepest EXISTING ancestor's realpath and rebuild the
    // candidate from it, rather than falling back to the literal
    // (unresolved) `resolved` path -- see resolveViaDeepestExistingAncestor().
    real = resolveViaDeepestExistingAncestor(resolved, root);
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

// Exported (not merely module-local) so r2000-tools.test.ts can assert its
// exact membership directly, rather than only inferring it from behaviour.
export const READ_ONLY_R2000_TOOLS: ReadonlySet<string> = new Set([
  "r2000_get_symbols",
  "r2000_get_comments",
  "r2000_get_blocks",
  "r2000_get_cross_references",
  "r2000_search_disassembly",
  "r2000_get_binary_info",
  "r2000_read_region", // SURF-01, plan 18-05: a plain read at a range, never a save target.
]);

// ---------------------------------------------------------------------------
// TEST-ONLY (D18-09 scenario 2's non-vacuity control). Exists SOLELY so
// r2000-session.test.ts can prove its save-discipline planted-violation
// assertion actually distinguishes "the internal save ran" from "it didn't"
// -- suppressing the internal auto-save below for exactly the calls a test
// chooses to make, then observing the SAME kill-and-reread sequence that
// passes in scenario 1 now correctly fail. MUST NEVER be set by production
// code -- there is no code path in this file that ever mutates `.active`;
// only a test file imports this binding and flips it directly. Defaults to
// `false` (asserted at module load by a companion test), and this
// identifier appears in this file ONLY here and at its one read site inside
// runR2000Tool()'s mutating branch below -- a source assertion in
// r2000-session.test.ts pins that count at exactly two.
// ---------------------------------------------------------------------------

export const __R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE: { active: boolean } = { active: false };

// ---------------------------------------------------------------------------
// composeAddressDetails() -- SURF-02's client-side composition (D-36,
// superseding D-32). Takes the SESSION'S OWN `call` function, never a
// project path and never opening its own session: this is what guarantees
// all four reads happen inside ONE session, sharing one connection, rather
// than the several-independent-connections shape Phase 9's incident
// generalises. The narrowing (matching each read's result to the requested
// address) is deliberately client-side -- upstream has no "narrow to one
// address" parameter for r2000_get_blocks, so containment is computed here.
//
// MUST NEVER be given a fifth source without updating BOTH `composed_from`
// below AND the `r2000_get_address_details` tool description above -- the
// description's own claim ("composed... from four named read tools") is a
// promise made to an LLM caller, not merely an implementation detail.
// ---------------------------------------------------------------------------

interface R2000ReadRegionCallResultShape {
  content: { type: string; text: string }[];
}

/** Calls `name` through the session's own `call`, then parses its
 * `content[0].text` as JSON -- every one of the four composing reads
 * returns its answer as a JSON-encoded text block (the same MCP
 * `{content:[{type,text}]}` shape `call()` itself returns, unparsed). */
async function callJson(call: R2000Call, name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = (await call(name, args)) as R2000ReadRegionCallResultShape;
  return JSON.parse(result.content[0]!.text);
}

interface R2000Block {
  start_address: number;
  end_address: number;
  type: string;
}

/**
 * Composes `r2000_get_address_details`'s answer entirely client-side from
 * four already-curated reads, sequentially, inside the caller's OWN session
 * (`call` is bound to that session -- this function never opens one of its
 * own). Never calls upstream's own `r2000_get_address_details` tool -- the
 * defect that tool carries on a full 64K project (`handler.rs:1894`) is
 * unreachable by construction, not merely avoided by a heuristic.
 */
export async function composeAddressDetails(call: R2000Call, address: number): Promise<unknown> {
  const symbols = await callJson(call, "r2000_get_symbols", { start_address: address, end_address: address });
  const comments = await callJson(call, "r2000_get_comments", { addresses: [address] });
  const allBlocks = (await callJson(call, "r2000_get_blocks", {})) as R2000Block[];
  const block = allBlocks.find((b) => address >= b.start_address && address <= b.end_address) ?? null;
  const crossReferences = await callJson(call, "r2000_get_cross_references", { address });

  return {
    address,
    symbols,
    comments,
    block,
    cross_references: crossReferences,
    composed_client_side: true,
    composed_from: ["r2000_get_symbols", "r2000_get_comments", "r2000_get_blocks", "r2000_get_cross_references"],
  };
}

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

  const { saveAndVerify } = await import("./r2000-mcp-client.ts");
  const { runInR2000Session } = await import("./r2000-session.ts");

  const rest: Record<string, unknown> = isPlainObject(args) ? { ...args } : {};
  delete rest.project;

  try {
    if (name === "r2000_save_project") {
      const result = await runInR2000Session(projectPath, (call) => saveAndVerify(projectPath, call));
      return okText(JSON.stringify(result));
    }

    // r2000_get_address_details (SURF-02, D-36): a special case placed
    // alongside r2000_save_project's, BEFORE the generic READ_ONLY_R2000_TOOLS
    // check -- one code path, no wrap-detection heuristic, no divergence
    // between what a small project and a 64K project get back (D18-28).
    // Composed entirely from the four already-curated reads, inside this
    // SAME session; never reaches upstream's own same-named tool.
    if (name === "r2000_get_address_details") {
      const address = isPlainObject(args) ? (args.address as number) : (undefined as unknown as number);
      const result = await runInR2000Session(projectPath, (call) => composeAddressDetails(call, address));
      return okText(JSON.stringify(result));
    }

    if (READ_ONLY_R2000_TOOLS.has(name)) {
      const result = await runInR2000Session(projectPath, (call) => call(name, rest));
      return toToolCallResult(result);
    }

    // A mutating tool (including r2000_batch_execute, whose own inner calls
    // all run inside this SAME session per regenerator2000's own
    // batch_execute implementation): call, then save PLAINLY (no hash
    // verification -- see the block comment above), before the tool call
    // resolves to its caller.
    const result = await runInR2000Session(projectPath, async (call) => {
      const callResult = await call(name, rest);
      if (!__R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE.active) {
        await call("r2000_save_project", {});
      }
      return callResult;
    });
    return toToolCallResult(result);
  } catch (err) {
    // Named by class (D18-12: a mid-window crash must surface a named,
    // distinguishable error, never a silent success) -- a caller can tell
    // R2000ChildExitError apart from R2000SessionFailedError etc. from this
    // text alone, without re-parsing loose message wording.
    const errName = err instanceof Error ? err.name : "Error";
    const errMessage = err instanceof Error ? err.message : String(err);
    return errText(`${name} failed: [${errName}] ${errMessage}`);
  }
}
