#!/usr/bin/env node
// A stdio MCP server that forwards to the host VICE MCP server over HTTP.
// Claude Code spawns exactly one copy of this per session (per its own
// `.mcp.json` `vice` entry) and speaks newline-delimited JSON-RPC 2.0 to it
// over stdin/stdout. This file owns ONLY that stdio-server-facing half --
// the HTTP-client half (retry ladder, SSE-body parsing, the vice_disk_list
// deny-list, epoch-based restart detection) is `call()` and its siblings,
// imported unchanged from the transport module, now a sibling in this
// skill's own `scripts/` directory (plan 01.1-04 relocated it from
// `vice-session`). Re-implementing that half here would duplicate code that
// has already survived six real host outages; see 01.1-RESEARCH.md's
// "Don't Hand-Roll" table.
//
// Sibling import, no longer cross-skill: `vice-session` has been retired
// (plan 01.1-04) and its transport module tree lives here now.
//
// D-01 / ROLLBACK PATH (Phase 01.6.3, plans 01.6.3-01..04): this file's
// stdio-server-facing wire layer is `@mastra/mcp`'s `MCPServer` +
// `startStdio()`, adopted per a developer decision AGAINST 01.6-RESEARCH.md
// §B6's HIGH-confidence recommendation to stay fully hand-rolled. The
// ROADMAP rates this adoption "reversible but costly -- not one-way": the
// ~88-94% of hand-rolled logic below (broker leasing, epoch/liveness,
// recycle/diagnose, deny-list enforcement, path rewriting, incident
// capture, the ten broker-state message builders -- enumerated exhaustively
// in 01.6-PATTERNS.md's "Pattern: The D-01 Seam") never moved and is not
// part of what a rollback touches.
//
// (a) What @mastra/mcp now owns, deleted from this file by the swap:
//     writeMessage() / respond() / errorResponse() / handleInitialize() /
//     handleToolsList() / handleMessage() / handleLine() / the stdin
//     read loop / ProtocolError -- the entire hand-rolled JSON-RPC 2.0
//     framing and protocol-version-negotiation layer (~140-300 lines,
//     6-12% of the pre-swap file, per RESEARCH.md §B4's structural
//     measurement). Superseded by `new MCPServer({name, version, tools})`
//     + `await server.startStdio()`, plus a `CallToolRequestSchema`
//     override installed via `server.getServer().setRequestHandler(...)`
//     immediately after `startStdio()` resolves (tools/call is NOT
//     answered by MCPServer's own dispatch -- see COVERAGE.md's
//     `tools/call routing skeleton` row for why: MCPServer's dispatch
//     forces `isError:false` on success and prepends "Error: " on
//     failure, neither of which matches this proxy's `{content,isError}`
//     contract or the deny-list's pinned refusal text).
// (b) Rollback steps, concretely, for a future session that needs to
//     execute this rather than re-derive it:
//     1. Re-author writeMessage()/respond()/errorResponse()/
//        handleInitialize()/handleToolsList()/handleMessage()/
//        handleLine()/the stdin loop/ProtocolError from
//        01.6-PATTERNS.md's "Pattern: The D-01 Seam" section, which
//        quotes their pre-swap bodies verbatim, cross-checked against
//        this file's own git history at commits a27628b (the swap that
//        deleted them) and its parent (the last commit where they still
//        existed).
//     2. Re-point every tool's dispatch: each tool's `execute` body
//        (`forwardToVice(name, args)`, UNCHANGED by the rollback -- it
//        predates and outlives the swap) currently runs inside the
//        `CallToolRequestSchema` override's per-tool lookup; re-wire that
//        same lookup into a single hand-rolled `handleToolsCall()`
//        dispatcher called from the resurrected `handleMessage()`.
//     3. Remove `@mastra/mcp`/`@mastra/core` from package.json's
//        `dependencies` (added Phase 01.6.3 plan 01) and revert
//        tsconfig.json's `skipLibCheck: true` (added plan 01.6.3-02 --
//        see note below; safe to revert once nothing imports either
//        package, since this project's own files typecheck clean with
//        or without the flag).
//     4. Re-run the full vice-proxy.test.ts suite; the ~5,300-line suite
//        exercises the wire layer directly (initialize/tools-list/
//        tools-call shapes, the deny-list, malformed-input handling) so
//        a clean rollback shows as 0 new failures against this same
//        suite, not merely "it builds".
// (c) Recorded, permanent cost of D-01 that a rollback would UNDO:
//     tsconfig.json's `skipLibCheck: true` (plan 01.6.3-02) is a genuine
//     reduction in this directory's own type-checking strictness --
//     @mastra/core@1.55.0 bundles internal ai-sdk-provider/zod-v4
//     declaration files with real cross-version inconsistencies, visible
//     to `tsc` only once anything imports from the package. This
//     project's own source typechecks clean with or without the flag,
//     but the flag means a future third-party dependency's OWN bundled
//     `.d.ts` errors would no longer surface here either -- a protection
//     every other file in this repo had by default before this phase.
//     A rollback restores that protection as a side effect of removing
//     the only import that ever needed the flag.
import {
  call,
  activeInstance,
  useInstance,
  DENY_LIST,
  denyListRefusalMessage,
  readEpoch,
  beginSession,
  MachineRestartedError,
  mcpHost,
  type ActiveInstance,
  type EpochResult,
  type SessionInfo,
  type ToolInfo,
} from "./vice.ts";
// Sibling import, same relocation as above. probeInstance() is the
// deliberately-fragile liveness check (see that file's own header): one
// 1500ms-budget round trip, no retry, no dependency on vice.ts's resilient
// reconnect ladder.
import { probeInstance, type ProbeResult } from "./vice-probe.ts";
import { repoRoot } from "./repo-root.ts";
import { hostPath, SET_ENV_HINT } from "./hostpath.ts";
// The INVERSE direction (host -> container), for inverting a broker grant's
// own host-local coordinates before useInstance() ever adopts them (this
// task, quick-260801-ccn). Consuming this from the proxy -- rather than
// hand-translating a host path here -- is what keeps the host-path consumer
// set closed to a fixed, traced list (vice-mcp-selector-docs.test.mjs's
// assertion 4, amended by this task to include containerpath.ts itself as
// a fifth, sibling consumer of hostpath.mjs's own knowledge).
import { containerizeRecord } from "./containerpath.ts";
// The container-side half of the on-demand broker protocol (Phase 01.2).
// This module deliberately does NOT import hostpath.mjs itself -- the
// host-path consumer set stays closed to four production modules
// (vice-mcp-selector-docs.test.mjs's assertion 4), and this file is already
// on that list, so any broker-related host path text is built HERE.
// Tasks 1+2 (this plan) swap acquisition, release AND recycle onto the TCP
// control session (openBrokerControl()/BrokerControlSession, plan 06's
// completed client) -- writeRequest/createLease/touchLease/releaseLease/
// pollGrant/startHeartbeat/requestsDir/newRequestId/writeRecycleRequest/
// pollRecycleAck are no longer imported: their whole job (write a request,
// create a lease file, heartbeat its mtime, poll for a grant or an
// acknowledgement, unlink on release) is now "send one request over the
// connection already held". RECYCLE_TIMEOUT_MS (the client's own recycle
// deadline, task 3's renamed successor to the now-deleted
// RECYCLE_ACK_TIMEOUT_MS) is reused below as the bound the post-kill
// epoch-and-readiness poll uses -- a concern this swap does not touch.
import {
  readBrokerLiveness,
  brokerRootDir,
  RECYCLE_TIMEOUT_MS,
  openBrokerControl,
  type BrokerLivenessResult,
  type BrokerControlSession,
  type ControlFailureKind,
} from "./vice-broker-client.ts";
// The recycle path's own incident record (plan 01.3-01) -- written BEFORE
// anything is killed (D-17), never through any network call of its own.
// incidentAssetPath()/incidentAssetStem() (plan 01.3-03) are the SAME stem-
// building logic incidentRecordPath() itself uses -- imported here so the
// evidence gatherer's screenshot and the pre-kill snapshot's name can never
// drift onto a second, independent naming rule.
import {
  writeIncidentRecord,
  finaliseIncidentRecord,
  incidentAssetPath,
  incidentAssetStem,
  type IncidentEvidence,
  type IncidentAssetStemOptions,
} from "./incident-record.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
// The wire-layer replacement (this plan, D-01): MCPServer owns tools/list's
// schema-conversion dispatch; the CallToolRequestSchema override installed
// below (immediately after startStdio(), see that call site's own comment)
// owns tools/call instead, so this file's own hand-rolled envelope survives
// unchanged even though the transport underneath it is now the SDK's own
// StdioServerTransport/Protocol. createTool()/noopObserve are the documented,
// public @mastra/core/tools API -- see this plan's "Ground truth" section for
// why a raw JSON Schema needs the rawJsonSchemaAsStandardSchema() adapter
// below rather than being passed to createTool() directly.
import { MCPServer } from "@mastra/mcp";
import { createTool, noopObserve } from "@mastra/core/tools";
import type { StandardSchemaWithJSON } from "@mastra/core/schema";
// A real, already-resolved transitive dependency of @mastra/mcp (Plan 01's
// Task 2 note) -- deliberately NOT added to package.json directly.
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const HERE_DIR = dirname(fileURLToPath(import.meta.url));

// -------------------------------------------------------------- JSON-RPC
//
// The boundary types every handler below reads or produces. `params` and
// `result` are typed `unknown` at this boundary deliberately -- MCP methods
// each carry their own shape, narrowed at the point each handler actually
// reads a field (never cast straight to an interface without a runtime
// check first, matching vice-broker.mts's own isPlainObject() discipline).
/** A single MCP tool descriptor, as this file's own three synthetic tools
 * and every manifest-sourced tool share the shape (name/description/
 * inputSchema, plus whatever `_meta` handleToolsList() stamps on afterward).
 * Deliberately the same shape as vice.ts's own `ToolInfo` (imported above for
 * `readManifestTools()`'s return), so a manifest tool and a synthetic tool
 * are interchangeable wherever this file combines them. */
type ToolDefinition = ToolInfo;

/** Narrows an `unknown` value to a plain, non-array, non-null object --
 * copied verbatim in shape from vice-broker.mts's own isPlainObject(), the
 * one narrowing idiom this whole conversion phase uses at every JSON
 * boundary rather than casting. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// -------------------------------------------------------------- never-throw
//
// Per RESEARCH.md Pitfall 3: a stdio MCP server is NEVER auto-reconnected by
// Claude Code once it dies (finding 7), so any uncaught throw here strands
// the session's emulator access for the rest of the session, silently. This
// is registered FIRST, before anything else in the module runs, so it is in
// effect for every line below it -- including the ES-module import above,
// which already executed by the time this file's own body starts, but every
// subsequent async operation this file performs is covered.
//
// There are TWO correct exit paths, not one (spike-findings-bruce-lee
// skill, shutdown-and-lease-release.md): a graceful client shutdown
// delivers SIGINT first (then SIGTERM ~100ms later, then SIGKILL at
// ~490ms) and never closes stdin; an abrupt client death closes stdin
// (`end` then `close`) and never signals. Both are handled separately
// below, by the teardown handler near the bottom of this file. Never
// `process.exit()` from any handler here or there -- see that handler's own
// comment for why nothing needs it.
process.on("uncaughtException", (err) => {
  console.error(`vice-proxy: uncaughtException (ignored, staying alive): ${err && err.stack ? err.stack : err}`);
});
process.on("unhandledRejection", (reason) => {
  const stack = reason && (reason as Error).stack ? (reason as Error).stack : reason;
  console.error(`vice-proxy: unhandledRejection (ignored, staying alive): ${stack}`);
});
// An EPIPE on `stdout.write()` (Claude Code closing the pipe abruptly) throws
// SYNCHRONOUSLY with no listener attached -- this is the exact class of the
// filed, confirmed defect in the official MCP TypeScript SDK,
// modelcontextprotocol/typescript-sdk#1564. Attaching a listener here turns
// that into a benign, logged event instead of a crash.
process.stdout.on("error", (err) => {
  console.error(`vice-proxy: stdout write error (ignored): ${err && err.message ? err.message : err}`);
});

// ------------------------------------------------------------- @mastra/mcp
//
// D-01 (this plan): the entire hand-rolled wire layer that used to live here
// (writeMessage/respond/errorResponse/ProtocolError/handleInitialize/
// handleToolsList/handleMessage/handleLine/the stdin loop) is gone, replaced
// by `@mastra/mcp`'s `MCPServer` + `startStdio()` -- see the construction
// site near the bottom of this file (right after the teardown region) for
// the tool registry, the MCPServer instance, and the CallToolRequestSchema
// override that preserves this file's own `{content, isError}` wire
// contract exactly (see this plan's "Ground truth" section for why
// MCPServer's OWN tools/call dispatch cannot be used as-is). PROXY_VERSION
// survives unchanged, reused as MCPServer's own `version` field.
const PROXY_VERSION = "0.1.0";

// --------------------------------------------------------------- tools/list
//
// A pure, offline read of the committed schema snapshot (decision D-C).
// `refresh-manifest.mjs` is the ONLY writer of that file -- this handler
// never fetches, never awaits a network call, and never throws. Any problem
// with the snapshot (absent, unparseable, wrong shape) degrades to a
// well-formed empty `tools` array plus one stderr line naming the path and
// the reason, never a fetch and never a hang.
//
// The output-size ceiling this proxy enforces (task 3's continuation logic)
// is declared here too, on every tool entry via `_meta`, so the ceiling a
// caller is TOLD about and the ceiling actually enforced are the same single
// number -- see OUTPUT_CHAR_CAP below, the one definition both sites read.
const OUTPUT_CHAR_CAP: number = (() => {
  const n = Number(process.env.VICE_MAX_RESULT_CHARS);
  return Number.isFinite(n) && n > 0 ? n : 500000;
})();

// -------------------------------------------------- output-limit warning
//
// D-1.2-H (plan 01.2-03 task 2). MAX_MCP_OUTPUT_TOKENS genuinely governs
// the CLIENT's own inline-response ceiling (measured at 40-60KB --
// spike-findings-bruce-lee skill, large-response-chunking.md -- about half
// the design's original ~100KB assumption; a 64K RAM read is ~192KB as
// hex, far above either figure). It is read from the client's own process
// environment, set via `.claude/settings.json`'s `env` block, which this
// repo's `.gitignore` makes untrackable (`.claude/*`, `.gitignore` lines
// 62-67) -- the same structural wall plan 01.1-04 hit with
// `.claude/CLAUDE.md`. It genuinely cannot be committed, so this proxy
// documents the required value in a tracked file (`tools/README.md`'s
// "Per-machine setup" section) and makes its OWN inherited environment's
// view of the setting OBSERVABLE on stderr, rather than silently assuming
// it is set. This is a WARNING, never a refusal: nothing throws, no call is
// rejected, and stdout carries only MCP messages (see the stdin-loop
// comment below) -- exactly one stderr line, at most once per process.
//
// Deliberately NOT resolved here, per this task's own instruction: the
// standing 32KB chunking non-negotiable and this proxy's own 500,000-char
// `_meta` ceiling (OUTPUT_CHAR_CAP above) are only compatible if a per-tool
// override is genuinely honoured, which was never measured -- the spike
// bracketed the inline ceiling at 40-60KB with no override set. Recorded as
// a deferred item in this plan's SUMMARY (both numbers, the one open
// question), not fixed by this warning or by changing OUTPUT_CHAR_CAP.
const REQUIRED_MAX_MCP_OUTPUT_TOKENS = 25000;
let outputLimitWarned = false;

function warnOnceAboutOutputLimit(): void {
  if (outputLimitWarned) return;
  outputLimitWarned = true;
  const raw = process.env.MAX_MCP_OUTPUT_TOKENS;
  const n = Number(raw);
  const sufficient = raw !== undefined && Number.isFinite(n) && n >= REQUIRED_MAX_MCP_OUTPUT_TOKENS;
  if (sufficient) return;
  console.error(
    `vice-proxy: MAX_MCP_OUTPUT_TOKENS is ${raw === undefined ? "not set" : `set to ${raw}`} in this ` +
      `process's environment -- this project requires at least ${REQUIRED_MAX_MCP_OUTPUT_TOKENS}. Set it in ` +
      `.claude/settings.json's "env" block (untracked -- see tools/README.md's "Per-machine setup" ` +
      `section for why and the exact value).`
  );
}

// Two client behaviours this proxy deliberately does NOT rely on, recorded
// here so a later reader does not reach for either as a solution:
//
// 1. MCP_TIMEOUT does NOT extend the startup handshake. The measurement
//    behind that claim tested only a 60s cap against a 10s delay, so it
//    cannot distinguish "honoured but never reached" from "does nothing",
//    and current official documentation describes it as a startup timeout
//    -- genuinely OPEN, not settled. Moot for this proxy either way:
//    handleInitialize() (above) answers with zero host I/O, so there is no
//    slow handshake here that would need extending.
// 2. Automatic backgrounding of long tool calls does NOT apply to this
//    project's dominant call pattern. It covers only main-conversation
//    calls and explicitly excludes calls originating from subagents, and
//    this project's emulator work runs overwhelmingly through executor
//    waves, which are subagent-driven and share their parent session's
//    single proxy connection. brokerWarmingMessage() (below) is therefore
//    the PRIMARY cold-path mechanism, not a fallback for something the
//    client will handle on this project's behalf.

// The synthetic continuation tool (task 3, decision D-E): served entirely
// inside this proxy, NEVER forwarded to the host, and advertised in every
// tools/list response exactly like a real tool so an agent can discover it
// the same way it discovers everything else.
const RESULT_CONTINUE_TOOL: ToolDefinition = {
  name: "vice_result_continue",
  description:
    "Retrieve the next chunk of an oversized tools/call result. Call with the token named in the " +
    "previous chunk's trailing marker.",
  inputSchema: {
    type: "object",
    properties: {
      token: {
        type: "string",
        description: "the continuation token named in the previous chunk's trailing marker",
      },
    },
    required: ["token"],
  },
};

// The recycle tool (plan 01.3-01, task 1): the only new HOST-SIDE ACTION
// this phase adds. Served entirely proxy-local -- like RESULT_CONTINUE_TOOL
// above, it is never in tools-manifest.json (RESEARCH Key Finding 3), so a
// manifest regenerate can never drop it. Deliberately split from
// vice_diagnose (D-03): this tool NEVER gates on a verdict, so there is no
// "confirm"/"mode" argument and no shared state between the two tools to
// keep in sync -- the separation itself is the safety.
const RECYCLE_TOOL: ToolDefinition = {
  name: "vice_recycle",
  description:
    "DESTRUCTIVE. Kills and respawns THIS session's own emulator in place, on the same port, via " +
    "the host supervisor's existing respawn loop -- the same instance, not a different one. The " +
    "restart epoch changes, so any run in flight is void and must be resumed from the last recorded " +
    'milestone snapshot. A self-inflicted checkpoint stop (the emulator merely paused at an armed ' +
    "checkpoint) is NOT a wedge and must not be recycled. Requires a non-empty \"reason\" naming why " +
    "this recycle is happening; that reason is written to a permanent, repo-tracked incident record " +
    "BEFORE anything is killed.",
  inputSchema: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "Why this recycle is happening -- written verbatim into the incident record.",
      },
    },
    required: ["reason"],
  },
};

// The diagnose tool (plan 01.3-02): the read-mostly companion to
// RECYCLE_TOOL above, served in the same proxy-local synthetic slot. D-03
// keeps the two structurally unlinked -- no shared verdict/confirm state,
// and recycle never reads a diagnose verdict.
const DIAGNOSE_TOOL: ToolDefinition = {
  name: "vice_diagnose",
  description:
    "Read-mostly. Answers which of five states this session's emulator is in -- restarted, " +
    "checkpoint_trap, wedged, stale_read_path, or live -- with the evidence that produced the " +
    "verdict. It may resume the machine once or twice to measure a cycle bracket, so it is never " +
    "something to call reflexively; when it runs a bracket it leaves the machine PAUSED afterward -- " +
    'resuming is your own next call. A "checkpoint_trap" verdict means the machine stopped ITSELF at ' +
    "an armed checkpoint and must NOT be recycled -- recycling a self-inflicted stop destroys a " +
    "healthy instance.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

function manifestPath(): string {
  return process.env.VICE_TOOLS_MANIFEST
    ? resolve(process.env.VICE_TOOLS_MANIFEST)
    : join(HERE_DIR, "tools-manifest.json");
}

function readManifestTools(): ToolInfo[] {
  const path = manifestPath();
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    console.error(
      `vice-proxy: tools-manifest not readable at ${path} (${(e as Error).message}) -- answering tools/list with an empty tools array`
    );
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(
      `vice-proxy: tools-manifest at ${path} is not valid JSON (${(e as Error).message}) -- answering tools/list with an empty tools array`
    );
    return [];
  }
  const shapeOk =
    isPlainObject(parsed) &&
    Array.isArray(parsed.tools) &&
    parsed.tools.every((t: unknown) => isPlainObject(t) && typeof t.name === "string");
  if (!shapeOk) {
    console.error(
      `vice-proxy: tools-manifest at ${path} has an unexpected shape ("tools" must be an array of objects ` +
        `each carrying a string "name") -- answering tools/list with an empty tools array`
    );
    return [];
  }
  return (parsed as { tools: ToolInfo[] }).tools;
}

// --------------------------------------------------------------- tools/call
//
// Delegates every real call to the reused `call()` -- the retry ladder
// already lives there (Pattern 1). Per Pattern 2, EVERY outcome of a tool
// invocation attempt -- success or failure -- becomes a well-formed
// `{content, isError}` result, never a JSON-RPC `error` object. Malformed
// `tools/call` params (a missing/non-string `name`) are now rejected one
// layer further out, by the SDK's own `CallToolRequestSchema` zod validation
// (installed at the construction site near the bottom of this file) --
// there is no `ProtocolError`/`handleMessage()` pair left in this file to
// catch that case.
//
// Two hazards are enforced HERE, at the proxy seam, as independent layers on
// top of what `call()` already does internally:
//
//   1. vice_disk_list refusal. `call()` already refuses it (throwing a
//      ViceError), but this proxy refuses it FIRST, before any forwarding
//      logic runs and before any network attempt, so the refusal is
//      observable with zero HTTP traffic and a well-formed MCP frame rather
//      than one more layer of catch between the hazard and the answer.
//
//   2. Per-call epoch re-check (decision D-D). The proxy does NOT call
//      assertSameMachine() and does NOT probe vice_checkpoint_list -- a
//      state-reading call that pauses the emulated CPU and never resumes it,
//      and the proxy arms no checkpoints of its own to probe with anyway.
//      The narrowed contract is a plain readEpoch() comparison, before AND
//      after every forwarded call: a changed epoch refuses the call (or
//      discards its result, if the change happened mid-call) with a loud,
//      evidence-carrying error naming both epoch values, then adopts the new
//      value as the baseline so the SESSION stays usable -- a restart report
//      is never cached, per criterion 6.
// NEVER-CACHE-A-NEGATIVE-RESULT INVARIANT (plan 01.1-03 task 1, criterion 6;
// extended to the broker path by plan 01.2-03 task 1, C11): nothing below
// this line may memoise "the host is down" -- or, as of this extension,
// "the broker is absent" -- as a fact that outlives a single tools/call.
// There is no cached probe verdict, no sticky "last known unreachable" flag,
// and no early-return short-circuit keyed off a PREVIOUS failure -- every
// forwarded tools/call re-evaluates reachability from scratch (the epoch
// check below reads the file fresh every time; the liveness probe added in
// task 2 does its own fresh network round trip every time; task 3's
// translation runs fresh every time; ensureBrokerLease()'s
// readBrokerLiveness() call reads broker.json fresh every time it is
// reached, never memoised at module scope). This is deliberate and easy to
// break by a later, performance-minded edit ("let's skip the probe if we
// just failed one 200ms ago", or "let's remember the broker was absent last
// call so we don't bother checking again") -- don't, for either path. A
// cached negative here is exactly the "quiet wrong answer" failure class
// this codebase rejects elsewhere (MachineRestartedError, the epoch
// re-check itself): the call after a human starts the broker must just
// work, with no session restart required.
let viceSession: SessionInfo | null = null; // beginSession()'s return value, set lazily on the first forwarded call
let epochBaseline: EpochResult | null = null; // the rolling comparison point; updated on every re-baseline

function ensureViceSession(): void {
  if (!viceSession) {
    viceSession = beginSession();
    epochBaseline = viceSession.baseline;
  }
}

function currentEpoch(): EpochResult {
  return readEpoch((viceSession as SessionInfo).epochPath);
}

function epochChanged(baseline: EpochResult | null, current: EpochResult | null): boolean {
  return Boolean(baseline?.present) && Boolean(current?.present) && baseline!.epoch !== current!.epoch;
}

function epochDriftMessage(when: string, baseline: EpochResult, current: EpochResult): string {
  const pidNote = current && current.pid != null ? `, pid ${current.pid}` : "";
  const spawnedNote = current && current.spawned_at ? `, spawned_at ${current.spawned_at}` : "";
  return (
    `vice: treat every result since the previous call as void and redo that work -- epoch drift was ` +
    `detected ${when} (epoch changed from ${baseline.epoch} to ${current.epoch}${pidNote}${spawnedNote}).`
  );
}

/**
 * Compare the rolling baseline against a fresh epoch read. Returns an error
 * MESSAGE string if the comparison proves a restart (and re-baselines to the
 * new value so the next call is not refused again), or `null` if the call
 * may proceed (including the "absent baseline, now present" case, which is
 * adopted silently -- a supervisor merely started, not a restart, mirroring
 * vice.ts's own "only compare when both are present" rule).
 */
function checkEpochAndRebaseline(when: string): string | null {
  const current = currentEpoch();
  if (epochChanged(epochBaseline, current)) {
    const msg = epochDriftMessage(when, epochBaseline as EpochResult, current);
    epochBaseline = current; // never cache a negative result (criterion 6)
    return msg;
  }
  if (!(epochBaseline as EpochResult).present && current.present) {
    epochBaseline = current;
  }
  return null;
}

interface ErrorTextResult {
  content: { type: "text"; text: string }[];
  isError: true;
}

function isErrorText(text: string): ErrorTextResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** The shape every tools/call outcome takes (Pattern 2): success or failure,
 * never a JSON-RPC `error` object. Shared by handleRecycle(), handleDiagnose(),
 * handleResultContinue(), wrapPossiblyChunked() and handleToolsCall() itself. */
interface OkTextResult {
  content: { type: "text"; text: string }[];
  isError: false;
}
type ToolCallResult = ErrorTextResult | OkTextResult;

// ------------------------------------------------------------ vice_recycle
//
// Re-baselines the proxy's own epoch tracking after a CONFIRMED recycle.
// Mirrors ensureBrokerLease()'s own `viceSession = null` re-baseline
// (further down this file) for the identical reason: a recycle is a
// DELIBERATE identity change, and without this the very next forwarded
// call would fail its own epoch drift guard against a baseline that is now
// stale by construction. Clearing epochBaseline too (not just viceSession)
// means nothing in between reads the stale value before the next
// ensureViceSession() call re-populates both from a fresh read.
function rebaselineEpochAfterRecycle(): void {
  viceSession = null;
  epochBaseline = null;
}

/** Renders a human-facing message for a recycle ack whose kill stage was
 * NOT a successful kill -- named per outcome so an operator reading the
 * result can tell "no grant record" from "unreadable epoch file" from "no
 * pid recorded" from "identity mismatch" without opening the broker log
 * (matches resources/vice-broker.sh's own per-outcome ack strings). */
function recycleAckOutcomeMessage(ack: Record<string, unknown>): string {
  const outcome = ack && typeof ack.outcome === "string" ? ack.outcome : "unknown";
  const stage = ack && typeof ack.kill_stage === "string" ? ack.kill_stage : "unknown";
  const reason = ack && typeof ack.reason === "string" && ack.reason ? ` (${ack.reason})` : "";
  switch (outcome) {
    case "identity_refused":
      return (
        `vice_recycle: the host refused to signal the target -- its process identity did not match ` +
        `the binary recorded in its own epoch file (kill stage: ${stage}). The instance was NOT ` +
        `killed and is still running.`
      );
    case "target_lookup_failed":
      return `vice_recycle: the host could not resolve this session's own recycle target (kill stage: ${stage})${reason}.`;
    case "grant_lookup_failed":
      return `vice_recycle: the host found no grant record for this session's target (kill stage: ${stage})${reason}.`;
    case "epoch_lookup_failed":
      return `vice_recycle: the host could not read the target's epoch file (kill stage: ${stage})${reason}.`;
    case "pid_lookup_failed":
      return `vice_recycle: the target's own epoch file carries no pid to signal (kill stage: ${stage})${reason}.`;
    default:
      return `vice_recycle: the host reported outcome "${outcome}" (kill stage: ${stage})${reason}.`;
  }
}

/**
 * Handles the destructive vice_recycle tool. Fixed order, and the order is
 * the point (plan 01.3-01 task 1): read the current epoch first; refuse
 * (no incident record, no request) when no broker lease is held yet or an
 * explicit VICE_MCP_URL override is in effect -- there is no broker to ask
 * and no supervisor to respawn either way; write the incident record BEFORE
 * anything else touches the host (D-17); only then write the recycle
 * request; await the ack; on anything other than a successful kill,
 * finalise the record with that outcome and return a well-formed error
 * naming the stage verbatim; on a successful kill, poll for the epoch to
 * move and probe readiness as two SEPARATE facts (T-01.3-03), finalise the
 * record, re-baseline, and return success. Never throws past this point --
 * every branch is a well-formed isError result (a dead stdio proxy is
 * unrecoverable for the session).
 */
// Declared as `const ... = async function handleRecycle(args) { ... }` (a
// contextually-typed function EXPRESSION), not `async function
// handleRecycle(args: ...) { ... }` (a typed declaration): the latter's
// exact param-list text would drift from vice-proxy.test.mjs's own
// structural oracle (`indexOf("async function handleRecycle(args)")`),
// which is off-limits to edit in this plan. The variable's own type
// annotation gives `args` a real, checked type via TS's ordinary contextual
// typing for a function expression assigned to a typed const -- verified
// live this session against a scratch file (see RE-FINDINGS.md) -- so this
// is real typing, not a suppression: every field read below still narrows
// `args` the same way every other handler in this file does.
const handleRecycle: (args: Record<string, unknown>) => Promise<ToolCallResult> = async function handleRecycle(args) {
  const rawReason = args && typeof args.reason === "string" ? args.reason : "";
  const reason = rawReason.trim();
  if (!reason) {
    return isErrorText(
      'vice_recycle requires a non-empty "reason" string naming why this recycle is happening -- it ' +
        "becomes the incident record's own explanation, written before anything is killed. No record " +
        "and no request were written."
    );
  }

  const preKillEpoch = readEpoch();

  if (process.env.VICE_MCP_URL) {
    return isErrorText(
      "vice_recycle: VICE_MCP_URL is set, so this session talks to an explicitly overridden endpoint " +
        "with no broker to ask and no supervisor to respawn it. Recycle only applies to a broker-" +
        "granted instance. No record and no request were written."
    );
  }
  if (!controlSession) {
    return isErrorText(
      "vice_recycle: no broker lease is held yet for this session -- recycle only applies to an " +
        "instance already granted to this session. Make at least one other forwarded call first. " +
        "No record and no request were written."
    );
  }

  const sessionId = process.env.CLAUDE_CODE_SESSION_ID || null;
  const { port } = activeInstance();
  const epochBefore = preKillEpoch.present ? preKillEpoch.epoch : null;
  const at = new Date().toISOString();

  // Plan 01.3-03 (D-17, extended): gather the FULL criterion-4 evidence set
  // -- including the best-effort pre-kill snapshot -- BEFORE the record is
  // written. There is no argument, environment variable or branch between
  // here and the record write that can reach the request write with any of
  // this still ungathered; every step above degrades to unavailable rather
  // than aborting, so this line always completes.
  const evidence = await gatherWedgeEvidence({ at, port, epoch: epochBefore });
  evidence.snapshot = await captureSnapshotAttempt({ at, port, epoch: epochBefore });

  // D-17: the record is written BEFORE the request -- capturing is
  // structurally impossible to skip, not a discipline to remember.
  const recordPath = writeIncidentRecord({
    at,
    port,
    epoch_before: epochBefore,
    reason,
    session_id: sessionId,
    evidence,
  });

  // Plan 01.6.2-07 task 2: the request write + ack poll are replaced by one
  // recycle request over the connection this session already holds -- the
  // client_pid this session used to send with a recycle request has no
  // successor field on the wire, since the connection itself already
  // identifies which grant this is (broker-control.mts's own T-01.6.2-31
  // discipline: a connection may only recycle the grant it itself holds).
  const recycled = await controlSession.recycle(grantId as string);
  if (!recycled.ok) {
    if (recycled.kind === "broker_gone") {
      // D-14 (plan 08): distinct from an acknowledgement carrying a refusal
      // (T-01.6.2-46) -- the instance's state is unknown in both cases, but
      // the operator's next action differs, a refusal means the target is
      // alive and uncooperative, broker_gone means there is no longer
      // anyone to ask. Reuses sessionMustRestartMessage() -- the SAME
      // fresh-machine vocabulary a forwarded call's own broker-gone path
      // (handleGrantedInstanceUnreachable() above) produces -- rather than
      // a bare transport error string. Deliberately does NOT attempt to
      // open a fresh session and acquire a replacement the way a forwarded
      // call does: the instance THIS recycle was trying to kill is now of
      // genuinely unknown state (the kill request may or may not have
      // reached the broker before the connection dropped), and silently
      // handing back a different "replacement" instance under the name of
      // a recycle result would claim more certainty about that kill than
      // this proxy actually has.
      finaliseIncidentRecord(recordPath, { outcome: "broker_gone" });
      return isErrorText(
        `${sessionMustRestartMessage(recycled)} Incident record: ${recordPath}. This recycle's own kill ` +
          `request may or may not have reached the broker before the connection dropped -- the instance's ` +
          `state is now unknown.`
      );
    }
    if (recycled.kind === "deadline") {
      finaliseIncidentRecord(recordPath, { outcome: "timeout" });
      return isErrorText(
        `vice_recycle: no ack arrived from the host within the timeout (${recycled.message}). Incident ` +
          `record: ${recordPath}. The instance's state is now unknown -- treat it as neither confirmed ` +
          `killed nor confirmed alive.`
      );
    }
    // Any other control-plane failure (protocol/unauthorized/bad_request/
    // denied/internal) -- an unexpected shape from the broker's own
    // response, not exhaustively enumerated here (D-14's full vocabulary is
    // plan 08's); still a well-formed, non-throwing result either way.
    finaliseIncidentRecord(recordPath, { outcome: "internal" });
    return isErrorText(
      `vice_recycle: the recycle request failed (${recycled.kind}: ${recycled.message}). Incident record: ${recordPath}.`
    );
  }

  const ack = recycled.ack;
  const killStage: string | null = ack.kill_stage;
  const successfulKill = killStage === "already_exited" || killStage === "sigterm" || killStage === "sigkill";

  if (!successfulKill) {
    finaliseIncidentRecord(recordPath, { outcome: ack.outcome || "refused", kill_stage: killStage });
    return isErrorText(`${recycleAckOutcomeMessage({ ...ack })} Incident record: ${recordPath}.`);
  }

  // The kill succeeded -- confirm the machine actually came back. The epoch
  // bump and the readiness probe are reported as two SEPARATE facts
  // (T-01.3-03): "the epoch moved" is bookkeeping, "the instance answers"
  // is evidence, and neither substitutes for the other.
  const epochDeadline = Date.now() + RECYCLE_TIMEOUT_MS;
  let afterEpoch = readEpoch();
  const epochMoved = () =>
    afterEpoch.present && (!preKillEpoch.present || (afterEpoch.epoch as number) > (preKillEpoch.epoch as number));
  while (Date.now() < epochDeadline && !epochMoved()) {
    await new Promise((r) => setTimeout(r, 250));
    afterEpoch = readEpoch();
  }

  const { url, port: instancePort } = activeInstance();
  const probe = await probeInstance({ url, port: instancePort });

  // 2026-08-05 defect fix: the persisted record's own epoch_after must never
  // carry a stale value equal to epoch_before -- that pair reads as
  // "confirmed unchanged" to a future reader, which is a false claim for a
  // kill that just genuinely succeeded (killStage is one of the three
  // successful-kill stages here, by construction of the guard above). Only
  // the poll loop's own epochMoved() -- not merely afterEpoch.present -- may
  // promote the read into the record; anything else stays the honest `null`
  // ("not yet known", per renderIncidentRecord()'s existing rendering) so a
  // future investigation is never handed a pair that looks complete but
  // isn't.
  finaliseIncidentRecord(recordPath, {
    outcome: "ok",
    kill_stage: killStage,
    epoch_after: epochMoved() ? afterEpoch.epoch : null,
  });

  // Immediately before returning success -- the deliberate identity change
  // this tool exists to cause would otherwise make every subsequent
  // forwarded call fail the drift guard.
  rebaselineEpochAfterRecycle();

  const snapshotNote =
    evidence.snapshot && evidence.snapshot.available
      ? `accepted (name: ${(evidence.snapshot.value as { name: string }).name})`
      : `unavailable (${evidence.snapshot && evidence.snapshot.reason ? evidence.snapshot.reason : "no reason recorded"})`;

  return {
    content: [
      {
        type: "text",
        text:
          `vice_recycle: kill stage "${killStage}". Epoch before: ${preKillEpoch.present ? preKillEpoch.epoch : "unknown"}, ` +
          `epoch after: ${afterEpoch.present ? afterEpoch.epoch : "unknown"} (${epochMoved() ? "moved" : "did not move within the timeout"}). ` +
          `Readiness probe: ${probe.alive ? "the respawned instance answered" : `not yet answering (${probe.reason})`}. ` +
          `Snapshot: ${snapshotNote}. ` +
          `Incident record: ${recordPath}. This run is VOID -- resume from the last recorded milestone snapshot.`,
      },
    ],
    isError: false,
  };
}

// ----------------------------------------------------------- vice_diagnose
//
// Plan 01.3-02 task 1: the read-mostly half of this phase, up to but not
// including the cycle bracket (task 2 wires that in). Every read below goes
// through the proxy's existing forwarded call() path -- no new host
// capability, no new protocol, no second route.

// The closed, five-member verdict vocabulary, in the order the checks run.
// Frozen so a future edit cannot quietly widen it -- must_have C1's whole
// point.
const DIAGNOSE_VERDICTS = Object.freeze(["restarted", "checkpoint_trap", "wedged", "stale_read_path", "live"]);

/** Normalise a checkpoint/register address to a plain number, accepting
 * either a JS number or a hex string ("$1103"/"1103"/"0x1103"). An unprefixed
 * digit string is read as HEX, matching this project's own address
 * convention (every C64 address in this project's docs and RE-FINDINGS.md is
 * hex), never decimal. Returns null, never throws, on anything unresolvable
 * (T-01.3-06: an untrusted payload degrades to "unknown", never a thrown
 * exception). */
function toAddressNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const s = value.trim().replace(/^\$/, "").replace(/^0x/i, "");
    const n = parseInt(s, 16);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function formatAddress(n: number | null | undefined): string {
  return n === null || n === undefined ? "unknown" : `$${n.toString(16).toUpperCase().padStart(4, "0")}`;
}

function formatByte(n: number | null | undefined): string {
  return n === null || n === undefined ? "unknown" : `$${n.toString(16).toUpperCase().padStart(2, "0")}`;
}

/** Decode a vice_memory_read result into a plain byte array, accepting
 * either the compact "hex" string encoding (requested below) or the legacy
 * per-byte "bytes" array shape -- an untrusted payload degrades to an empty
 * array, never a thrown exception (T-01.3-06). */
function bytesFromMemoryReadResult(result: unknown): number[] {
  if (isPlainObject(result) && typeof result.hex === "string") {
    const clean = result.hex.replace(/[^0-9a-fA-F]/g, "");
    const bytes: number[] = [];
    for (let i = 0; i + 1 < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
    return bytes;
  }
  if (isPlainObject(result) && Array.isArray(result.bytes)) {
    return (result.bytes as unknown[])
      .map((b) => (typeof b === "string" ? parseInt(b.replace(/^\$/, ""), 16) : Number(b)))
      .filter((n) => Number.isFinite(n));
  }
  return [];
}

function wordFromBytes(bytes: number[]): number | null {
  return bytes.length >= 2 ? bytes[0] | (bytes[1] << 8) : null;
}

// Bit 1 (HIRAM) of the 6510 processor port at $01. SET -- the KERNAL ROM is
// banked in, and the RAM IRQ vector pair ($0314/$0315) is what the KERNAL's
// own dispatch actually reads (RE-FINDINGS.md's own vector-table entry).
// CLEAR -- the KERNAL is replaced by RAM and the CPU reads the hardware
// IRQ/BRK vector pair ($FFFE/$FFFF) directly, with no ROM indirection.
const HIRAM_MASK = 0x02;

/** The live-IRQ-handler lookup's own return shape -- shared by
 * gatherCheckpointTrapEvidence() below and by plan 01.3-03's evidence
 * gatherer (gatherWedgeEvidence()). */
interface IrqHandlerResolution {
  target: number | null;
  pairLabel: string;
  explanation: string;
}

/**
 * The single definition of the live-IRQ-handler lookup (Key Finding 6):
 * three forwarded reads through the normal call() path -- $01, the RAM
 * vector pair, and (only when $01 says the ROMs are banked out) the hardware
 * vector pair. Consumed by the checkpoint-trap check below and, per this
 * plan's own key_links, by plan 01.3-03's evidence gatherer. Memoises
 * NOTHING: a disk swap, a reset or a different game retargets the handler,
 * so a cached address would silently resolve the wrong pair.
 */
async function resolveLiveIrqHandler(): Promise<IrqHandlerResolution> {
  const portResult = await call("vice_memory_read", { address: "$01", size: 1, encoding: "hex" });
  const portBytes = bytesFromMemoryReadResult(portResult);
  const port01 = portBytes.length > 0 ? portBytes[0] : null;
  const bankedOut = port01 !== null && (port01 & HIRAM_MASK) === 0;

  const ramResult = await call("vice_memory_read", { address: "$0314", size: 2, encoding: "hex" });
  const ramTarget = wordFromBytes(bytesFromMemoryReadResult(ramResult));

  if (!bankedOut) {
    return {
      target: ramTarget,
      pairLabel: "the RAM KERNAL IRQ vector pair ($0314/$0315)",
      explanation:
        `$01 read as ${formatByte(port01)} -- the KERNAL ROM is banked in, so the RAM IRQ vector pair ` +
        `($0314/$0315) is the pair this session's IRQ dispatch actually reads; it resolves to ${formatAddress(ramTarget)}.`,
    };
  }

  const hwResult = await call("vice_memory_read", { address: "$FFFE", size: 2, encoding: "hex" });
  const hwTarget = wordFromBytes(bytesFromMemoryReadResult(hwResult));
  return {
    target: hwTarget,
    pairLabel: "the hardware IRQ/BRK vector pair ($FFFE/$FFFF)",
    explanation:
      `$01 read as ${formatByte(port01)} -- the KERNAL ROM is banked OUT, so the CPU dispatches ` +
      `directly through the hardware IRQ/BRK vector pair ($FFFE/$FFFF) with no ROM indirection; it ` +
      `resolves to ${formatAddress(hwTarget)}.`,
  };
}

/**
 * Enumerate armed checkpoints, read the current PC, resolve the live IRQ
 * handler, and decide the checkpoint-trap verdict on two named shapes
 * (D-14): an enabled, stopping, exec checkpoint sitting exactly at the
 * current PC; or one sitting at the resolved handler entry with a hit count
 * of exactly zero (the corroborating tell that it has never actually
 * fired). Makes NO resume and NO stopwatch call -- the whole point of
 * checking this before any cycle bracket (D-14, T-01.3-08).
 */
/** A single vice_checkpoint_list entry, typed loosely (matching this
 * codebase's own precedent for a host-written record this proxy never
 * asserts a closed shape on) -- every field is read defensively below,
 * never assumed present. */
interface CheckpointInfo {
  checkpoint_num?: unknown;
  start?: unknown;
  stop?: unknown;
  exec?: unknown;
  enabled?: unknown;
  hit_count?: unknown;
  [key: string]: unknown;
}

interface CheckpointTrapEvidence {
  isTrap: boolean;
  checkpoints: CheckpointInfo[];
  pc: number | null;
  handler: IrqHandlerResolution;
  trapCheckpoint: CheckpointInfo | null;
  trapReason: "pc" | "handler" | null;
}

async function gatherCheckpointTrapEvidence(): Promise<CheckpointTrapEvidence> {
  const checkpointsResult = await call("vice_checkpoint_list", {});
  const checkpoints: CheckpointInfo[] =
    isPlainObject(checkpointsResult) && Array.isArray(checkpointsResult.checkpoints)
      ? (checkpointsResult.checkpoints as CheckpointInfo[])
      : [];

  const regs = await call("vice_registers_get", {});
  const pc = isPlainObject(regs) && typeof regs.PC === "number" ? regs.PC : null;

  const handler = await resolveLiveIrqHandler();

  const armedStopping = checkpoints.filter((c) => c && c.enabled !== false && c.stop === true && c.exec === true);

  const atPc = pc !== null ? armedStopping.find((c) => toAddressNumber(c.start) === pc) : undefined;
  const atHandler =
    !atPc && handler.target !== null && handler.target !== undefined
      ? armedStopping.find((c) => toAddressNumber(c.start) === handler.target && c.hit_count === 0)
      : undefined;

  const trapCheckpoint = atPc || atHandler || null;
  return {
    isTrap: Boolean(trapCheckpoint),
    checkpoints,
    pc,
    handler,
    trapCheckpoint,
    trapReason: atPc ? "pc" : atHandler ? "handler" : null,
  };
}

// The recorded incident this report's own "not guaranteed" paragraph cites --
// D-15's own caveat, load-bearing per this plan's planning notes: delete,
// soft reset, hard reset and an explicit single step ALL left the machine
// frozen in this recorded case.
const CHECKPOINT_TRAP_INCIDENT_REF =
  ".planning/todos/pending/2026-08-01-vice-registers-frozen-after-reset-during-01-04-task2.md";

/** Renders the checkpoint_trap verdict's report -- an explanation, never a
 * remedy (D-15): it names the armed checkpoints, the resolved handler, the
 * PC's relation to the trap, states plainly this is self-inflicted and not a
 * wedge, names the agent's own next moves without performing any of them,
 * and closes with the not-guaranteed paragraph. */
function renderCheckpointTrapReport(evidence: CheckpointTrapEvidence): string {
  const { checkpoints, pc, handler, trapCheckpoint, trapReason } = evidence;
  const checkpointList =
    checkpoints.length === 0
      ? "none armed"
      : checkpoints
          .map((c) => {
            const addr = formatAddress(toAddressNumber(c && c.start));
            const flag = c && c.stop ? "stop" : "continue";
            const enabled = c && c.enabled === false ? "disabled" : "enabled";
            const hitCount = c && typeof c.hit_count === "number" ? c.hit_count : "unknown";
            return `#${c && c.checkpoint_num} ${addr} (${flag}, ${enabled}, hit_count ${hitCount})`;
          })
          .join("; ");

  const pcRelation =
    trapReason === "pc"
      ? `exactly at armed checkpoint #${trapCheckpoint!.checkpoint_num} -- that is why the machine is stopped here`
      : trapReason === "handler"
        ? `not at the armed checkpoint's own address, but checkpoint #${trapCheckpoint!.checkpoint_num} sits at ` +
          "the resolved live IRQ handler entry with hit_count 0 -- the corroborating tell that this checkpoint " +
          "has never actually fired, not merely that it fired between reads"
        : "no relation established";

  return [
    "vice_diagnose verdict: checkpoint_trap",
    "",
    `Armed checkpoints: ${checkpointList}.`,
    `Resolved live IRQ handler: ${handler.explanation}`,
    `Current PC: ${formatAddress(pc)} -- ${pcRelation}.`,
    "",
    "This is a self-inflicted stop, not a wedge: the machine paused because an armed checkpoint " +
      "fired or sits exactly here, not because it stopped retiring cycles on its own. Recycling now " +
      "would destroy a healthy instance -- no cycle bracket was run to reach this verdict.",
    "",
    "Next moves available to you (this report does not perform any of them): vice_checkpoint_delete " +
      "the offending checkpoint, or vice_checkpoint_toggle it disabled; vice_execution_step past it; " +
      "then re-run vice_diagnose.",
    "",
    "Not guaranteed: deleting the checkpoint is not guaranteed to unfreeze the machine. The recorded " +
      `incident (${CHECKPOINT_TRAP_INCIDENT_REF}) shows checkpoint delete, then a soft reset, then a hard ` +
      "reset, then an explicit single step ALL leaving the machine frozen in sequence -- a checkpoint " +
      "trap may be the onset without being the whole story. If a cycle bracket still measures zero " +
      "after the checkpoint is gone, the verdict becomes wedged and recycle is the fallback after all.",
  ].join("\n");
}

/** Renders the restarted verdict's report -- reached from a plain epoch-file
 * comparison alone, at zero emulator calls (D-14's ordering: this check
 * costs nothing and runs first). */
function renderRestartedReport(beforeEpoch: number | null | undefined, afterEpoch: number | null | undefined): string {
  return (
    "vice_diagnose verdict: restarted\n\n" +
    `The host VICE MCP server's epoch changed from ${beforeEpoch} to ${afterEpoch} -- the emulator ` +
    "behind this session restarted. This is answered from a plain epoch comparison alone, at zero " +
    "emulator calls; no checkpoint enumeration was attempted, because a restart is this project's own " +
    "already-handled case (criterion 1) and re-deriving it here would be a second mechanism. Any run " +
    "in flight before this point is void."
  );
}

// Plan 01.3-02 task 2: the cycle bracket, the definitive liveness test, and
// the three verdicts that depend on it (wedged, stale_read_path, live).

// Three polls: the bracket needs the machine to be given real forwarded
// round trips to retire cycles across, and three is enough for the counter
// to move at any rate worth calling alive.
const CYCLE_BRACKET_PINGS = 3;
// Two brackets: criterion 2's minimum for a wedged verdict is two
// consecutive zeros, and D-04 makes every additional bracket another call to
// the tool most correlated with host death. Two is the minimum and the
// maximum.
const CYCLE_BRACKET_MAX = 2;

// ~991,000 cycles/s is the measured PAL C64 full-speed rate (RE-FINDINGS.md,
// "the only trustworthy VICE liveness test is a cycle bracket"). Printed
// only, as an observation beside a measured rate -- D-08 refuses a
// degradation threshold, and a constant that is only ever printed cannot
// become one by accident.
const BASELINE_CYCLES_PER_SECOND = 991000;

function cyclesFromStopwatchResult(result: unknown): number {
  if (isPlainObject(result) && typeof result.cycles === "number") return result.cycles;
  if (isPlainObject(result) && typeof result.previous_cycles === "number") return result.previous_cycles;
  return 0;
}

interface CycleBracketResult {
  cycles: number;
  elapsedMs: number;
}

/**
 * The single definition of the cycle bracket criterion 2 requires: reset the
 * stopwatch, resume execution exactly once, poll with ping
 * CYCLE_BRACKET_PINGS times, pause, read the stopwatch back. Pacing comes
 * from the forwarded round trips alone -- there is no timer, no delay and no
 * wall-clock quantity anywhere in it (the standing project rule). Every
 * stopwatch call in this file lives inside this function's body; the
 * structural test enforces it. `elapsedMs` is measured only to print an
 * observational rate afterward -- it decides nothing and paces nothing.
 */
async function runCycleBracket() {
  await call("vice_cycles_stopwatch", { action: "reset" });
  const startedAt = Date.now();
  await call("vice_execution_run", {});
  for (let i = 0; i < CYCLE_BRACKET_PINGS; i += 1) {
    await call("vice_ping", {}); // the ping EXECUTION field is never inspected here -- it decides nothing (C1, D-07)
  }
  await call("vice_execution_pause", {});
  const elapsedMs = Date.now() - startedAt;
  const readResult = await call("vice_cycles_stopwatch", { action: "read" });
  const cycles = cyclesFromStopwatchResult(readResult);
  return { cycles, elapsedMs };
}

function registersByteIdentical(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

interface BracketEvidence {
  regsBefore: unknown;
  regsAfter: unknown;
  bracket1: CycleBracketResult;
  bracket2: CycleBracketResult | null;
  finalBracket: CycleBracketResult;
}

/**
 * Gathers the bracket evidence: a register snapshot at each end, bracket
 * one, and -- only when bracket one retired exactly zero cycles -- bracket
 * two. A non-zero first bracket short-circuits (D-04): the answer is already
 * not wedged, and a second resume buys nothing.
 */
async function gatherBracketEvidence(): Promise<BracketEvidence> {
  const regsBefore = await call("vice_registers_get", {});
  const bracket1 = await runCycleBracket();
  let bracket2: CycleBracketResult | null = null;
  let finalBracket = bracket1;
  if (bracket1.cycles === 0) {
    bracket2 = await runCycleBracket();
    finalBracket = bracket2;
  }
  const regsAfter = await call("vice_registers_get", {});
  return { regsBefore, regsAfter, bracket1, bracket2, finalBracket };
}

type LivenessVerdict = "wedged" | "stale_read_path" | "live";

/**
 * Produces the post-bracket verdict (criterion 2/3). Two consecutive zeros
 * is wedged and nothing else is. On any non-zero result (whichever bracket
 * produced it), a byte-identical register snapshot across an advancing
 * bracket is stale_read_path -- one read path is stale while the machine is
 * demonstrably not frozen; anything else is live.
 */
function classifyLiveness(evidence: BracketEvidence): LivenessVerdict {
  const { bracket1, bracket2, regsBefore, regsAfter } = evidence;
  if (bracket1.cycles === 0 && (!bracket2 || bracket2.cycles === 0)) {
    return "wedged";
  }
  return registersByteIdentical(regsBefore, regsAfter) ? "stale_read_path" : "live";
}

/**
 * Renders the post-bracket report (wedged/stale_read_path/live). Separates
 * load-bearing evidence (the restart epoch, already checked; the stopwatch
 * delta across the bracket) from corroborating evidence (the program
 * counter, VIC-II state, checkpoint hit counts, a screenshot) explicitly --
 * criterion 3's own requirement. A status of ok with an execution state of
 * running is compatible with every one of these verdicts and is therefore
 * evidence for none of them.
 */
function renderDiagnoseReport(evidence: BracketEvidence, verdict: LivenessVerdict): string {
  const { bracket1, bracket2, finalBracket } = evidence;
  const bracketsRun = bracket2 ? 2 : 1;
  const ratePerSecond =
    finalBracket.cycles > 0 ? Math.round((finalBracket.cycles / Math.max(finalBracket.elapsedMs, 1)) * 1000) : 0;

  const lines = [
    `vice_diagnose verdict: ${verdict}`,
    "",
    "Load-bearing evidence: the restart epoch (already checked, at zero emulator cost) and the " +
      `stopwatch cycle delta across the bracket -- bracket 1 retired ${bracket1.cycles} cycles` +
      (bracket2 ? `, bracket 2 retired ${bracket2.cycles} cycles` : "") +
      ` (${bracketsRun} bracket${bracketsRun > 1 ? "s" : ""} run, ${bracketsRun} resume call${bracketsRun > 1 ? "s" : ""}).`,
    "Corroborating evidence only, never load-bearing on its own: the program counter, VIC-II state, " +
      "checkpoint hit counts, and a screenshot. A status of ok with an execution state of running is " +
      "compatible with every one of these verdicts and is therefore evidence for none of them.",
  ];

  if (verdict !== "wedged") {
    lines.push(
      `Measured rate this call: ~${finalBracket.cycles} cycles in ~${finalBracket.elapsedMs}ms ` +
        `(~${ratePerSecond} cycles/s), beside the baseline ~${BASELINE_CYCLES_PER_SECOND} cycles/s ` +
        "(PAL C64 full speed) -- an observation, never a threshold, and never a verdict of its own."
    );
  }

  if (verdict === "stale_read_path") {
    lines.push(
      "The register-read path returned a byte-identical snapshot across both ends of an advancing " +
        "bracket -- that read path is stale, but the machine is demonstrably not frozen."
    );
  }

  lines.push(
    verdict === "wedged"
      ? "Machine state left: paused, after two zero-cycle brackets. Resuming is your own deliberate next call."
      : "Machine state left: paused, after the bracket that reached this verdict. Resuming is your own deliberate next call."
  );

  return lines.join("\n");
}

/**
 * Handles vice_diagnose. Fixed check order, and the order is the point
 * (D-14): first the epoch comparison (zero emulator calls), then the
 * checkpoint-trap check (no resume at all). Never throws past this point --
 * every branch is a well-formed isError:false or isError:true result.
 */
async function handleDiagnose(_args: Record<string, unknown>): Promise<ToolCallResult> {
  try {
    const leaseResult = await ensureBrokerLease();
    if (!leaseResult.ok) {
      return isErrorText(leaseResult.message);
    }
    ensureViceSession();

    const epochNow = currentEpoch();
    if (epochChanged(epochBaseline, epochNow)) {
      const before = (epochBaseline as EpochResult).epoch;
      epochBaseline = epochNow; // never cache a negative result (criterion 6)
      return { content: [{ type: "text", text: renderRestartedReport(before, epochNow.epoch) }], isError: false };
    }
    if (!(epochBaseline as EpochResult).present && epochNow.present) {
      epochBaseline = epochNow;
    }

    const trapEvidence = await gatherCheckpointTrapEvidence();
    if (trapEvidence.isTrap) {
      return { content: [{ type: "text", text: renderCheckpointTrapReport(trapEvidence) }], isError: false };
    }

    // Third and last: the cycle bracket, the definitive liveness test, drives
    // the three remaining verdicts (D-14's full order: epoch, trap, bracket).
    const bracketEvidence = await gatherBracketEvidence();
    const verdict = classifyLiveness(bracketEvidence);
    return { content: [{ type: "text", text: renderDiagnoseReport(bracketEvidence, verdict) }], isError: false };
  } catch (e) {
    if (e instanceof MachineRestartedError) {
      const current = currentEpoch();
      epochBaseline = current;
      return { content: [{ type: "text", text: renderRestartedReport(e.baselineEpoch, e.currentEpoch) }], isError: false };
    }
    return isErrorText(
      `vice_diagnose: an unexpected error occurred while gathering evidence: ${e && (e as Error).message ? (e as Error).message : e}`
    );
  }
}

// -------------------------------------------- vice_recycle: evidence gather
//
// Plan 01.3-03 (criterion 4): the destructive path's own evidence set,
// composed ENTIRELY from reads already forwardable through call() -- no new
// host capability, no second route. runCycleBracket() and
// resolveLiveIrqHandler() are plan 01.3-02's own single definitions, reused
// here rather than re-derived (this plan's own key_links) -- criterion 2's
// single-bracket-definition guard is a PHASE property, not a plan one.

/**
 * Capture-step deadline (T-01.3-10): a TRANSPORT deadline bounding how long
 * ANY single evidence-gathering step (including the pre-kill snapshot
 * attempt, task 2) may wait for its own forwarded call(s) before this
 * wrapper gives up and records an explicit unavailable-with-reason entry.
 *
 * This is deliberately DIFFERENT from the project's standing prohibition on
 * WALL-CLOCK PACING (never sleep to wait for the emulated machine to reach
 * some state -- synchronise on checkpoint hits and cycle counts instead):
 * that rule governs synchronising INPUT/WAITS against the emulated game's
 * own state. This deadline governs a capture step's patience with the
 * TRANSPORT alone -- exactly the kind of deadline call()'s own
 * AbortSignal.timeout already applies per forwarded call, just bounding the
 * WHOLE step (which may issue several forwarded calls, e.g. the bracket) so
 * one non-answering read can never stall the whole gather, and the
 * snapshot attempt can never stall the recycle itself (D-19). Overridable
 * purely so this file's own test suite can exercise a "never answers"
 * fixture in milliseconds rather than minutes -- production always uses the
 * generous default.
 */
const CAPTURE_STEP_TIMEOUT_MS = Number(process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS || 8000);

/** captureStep()'s own result shape -- structurally an EvidenceItem
 * (incident-record.ts), just narrowed to a discriminated union here so a
 * caller can branch on `available` without an optional-field guess. */
type CaptureStepResult<T> = { available: true; value: T } | { available: false; reason: string };

/**
 * Runs one evidence-gathering step, turning any rejection, transport
 * failure or capture-step deadline into an explicit `{ available: false,
 * reason }` entry rather than letting it abort the whole gather -- the
 * whole point (D-17, D-19) is that a wedged machine will fail SOME of these
 * and the record must still exist. Never throws.
 */
async function captureStep<T>(fn: () => Promise<T>): Promise<CaptureStepResult<T>> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`capture step deadline of ${CAPTURE_STEP_TIMEOUT_MS}ms exceeded`)),
          CAPTURE_STEP_TIMEOUT_MS
        );
      }),
    ]);
    return { available: true, value };
  } catch (e) {
    return { available: false, reason: e && (e as Error).message ? (e as Error).message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Assembles criterion-4's evidence set for an incident record: one cycle
 * bracket (runCycleBracket(), plan 01.3-02 -- NEVER a second bracket
 * definition), the program counter and full register snapshot, the full
 * checkpoint enumeration (address, enabled flag, stop-or-continue), the
 * resolved live IRQ handler (resolveLiveIrqHandler(), plan 01.3-02), and a
 * screenshot written to a path in the incidents directory sharing the
 * record's own stem. Every step goes through captureStep() above, so no
 * step can abort the gather.
 *
 * `at`/`port`/`epoch` name the SAME triple the caller passes to
 * writeIncidentRecord(), so the screenshot's path shares that record's stem
 * (best-effort: the very rare case of a same-millisecond/port/epoch
 * collision forcing writeIncidentRecord() to append a numeric suffix onto
 * the actual .md file is not reflected here, since this path is computed
 * BEFORE that write happens).
 */
async function gatherWedgeEvidence({ at, port, epoch }: IncidentAssetStemOptions): Promise<IncidentEvidence> {
  const bracket = await captureStep(() => runCycleBracket());
  const registers = await captureStep(() => call("vice_registers_get", {}));
  const checkpoints = await captureStep(async () => {
    const result = await call("vice_checkpoint_list", {});
    const list: CheckpointInfo[] =
      isPlainObject(result) && Array.isArray(result.checkpoints) ? (result.checkpoints as CheckpointInfo[]) : [];
    return list.map((c) => ({
      checkpoint_num: c && c.checkpoint_num,
      address: formatAddress(toAddressNumber(c && c.start)),
      enabled: Boolean(c && c.enabled !== false),
      flag: c && c.stop ? "stop" : "continue",
    }));
  });
  const irqHandler = await captureStep(() => resolveLiveIrqHandler());

  // The screenshot's path argument must be translated (T-01.3-11's sibling
  // concern): handleToolsCall() applies rewriteArguments() before
  // forwarding, and this proxy-local caller does NOT pass through that seam
  // -- so it is called explicitly here. Skipping this would write the file
  // to a host path that does not exist and return a success the record
  // would then be lying about.
  const screenshotContainerPath = incidentAssetPath({ at, port, epoch, ext: "png" });
  const screenshot = await captureStep(async () => {
    const { args: translated } = rewriteArguments({ path: screenshotContainerPath }, "vice_display_screenshot");
    await call("vice_display_screenshot", translated);
    return relative(repoRoot(), screenshotContainerPath);
  });

  return { bracket, registers, checkpoints, irqHandler, screenshot };
}

/**
 * The best-effort pre-kill snapshot (plan 01.3-03 task 2, D-19): the LAST
 * capture step, run immediately before the incident record is written. It
 * takes a NAME, not a path -- vice_snapshot_save's own contract -- so the
 * file lands in the host emulator's own snapshot directory and nothing
 * container-side can confirm it landed there. The record therefore says
 * the ATTEMPT was accepted, never that a file was verified (T-01.3-11): the
 * wording must not overstate what was established. A rejection, a
 * transport failure or a capture-step deadline records unavailable with
 * the reason verbatim and moves on -- it cannot fail or stall the recycle.
 * The name is built from the SAME timestamp/port/epoch triple the incident
 * record's own stem uses, so the two artifacts are trivially correlated
 * later.
 */
async function captureSnapshotAttempt({
  at,
  port,
  epoch,
}: IncidentAssetStemOptions): Promise<CaptureStepResult<{ name: string }>> {
  const name = incidentAssetStem({ at, port, epoch });
  return captureStep(async () => {
    await call("vice_snapshot_save", { name, description: "vice_recycle pre-kill evidence capture" });
    return { name };
  });
}

// --------------------------------------------------- unreachable diagnostics
//
// Plan 01.1-03 task 2 / ROADMAP criterion 7. Blocking on withReconnect()'s
// ~50s ladder turns a clear diagnosis into an opaque tool timeout, so every
// forwarded tools/call gets a pre-flight `probeInstance()` check FIRST (one
// 1500ms-budget round trip, no retry -- see vice-probe.ts's own header for
// why reusing the resilient ladder here would be wrong). When the probe
// reports the emulator unreachable, this classifies the failure into exactly
// one of three states, each with its own message and its own fix, each
// quoting an absolute host path, each closing off the "just run the
// transport module from a shell instead" workaround explicitly.
//
// This MCP tool surface is the only route to the emulator -- never named
// together with a CLI verb here, since plan 01.1-04 installs a durable gate
// matching exactly that pattern in documentation.
const ONLY_ROUTE_NOTE =
  "This MCP tool surface is the only route to the emulator. The correct action is to stop and ask " +
  "the human to start it on the host -- falling back to a direct shell invocation of the underlying " +
  "transport is not an available workaround.";

// supervisorHostPath() (the per-instance-supervisor host-path helper) is
// GONE, not merely unused (01.6.2-09, T-01.6.2-54/T-01.6.2-59): its three
// former consumers below -- neverStartedMessage(), deadOrHungMessage() and
// aliveButFailedMessage() -- now resolve brokerHostPath() instead, the SAME
// single helper the broker-absent triple already used. There is exactly one
// host-path helper left in this file (a structural test in
// vice-proxy.test.ts asserts that directly: the resolved path's basename
// equals the surviving launcher's filename).

/** The absolute path of the command a human should run on the HOST to
 * start/restart access to the emulator -- computed via hostPath() over the
 * deployed launcher's container path, degrading to the container path plus
 * SET_ENV_HINT exactly as install-resources.ts's hostLaunchInstructions()
 * does, so a translation failure still yields something to act on rather
 * than an empty message. Recomputed fresh every call -- never cached (see
 * the never-cache-a-negative-result invariant above ensureViceSession()).
 * Points at resources/vice-launcher.sh's deployed copy -- the one surviving
 * host script (01.6.2-09). Every message in this file that used to name
 * either the retiring per-instance supervisor (vice-supervisor.sh) or the
 * retiring bash broker (vice-broker.sh) now names THIS launcher instead: its
 * own broker performs both the acquire-on-demand job the bash broker did and
 * the launch/supervise/respawn-with-backoff job the bash supervisor did. */
function brokerHostPath(): string {
  const root = repoRoot();
  const target = join(root, "tools", "vice-launcher.sh");
  try {
    return hostPath(target, { workspaceRoot: root });
  } catch {
    return `${target}\n  (host path could not be determined -- ${SET_ENV_HINT})`;
  }
}

// ------------------------------------------------- broker-absent diagnostics
//
// Plan 01.2-03 task 1 / must_have C10. A missing broker answers exactly one
// generic message two times out of three sends the reader to the wrong fix
// -- mirrors the host-unreachable triple above (never-started /
// dead-or-hung / alive-but-failed), but answers a DIFFERENT question ("is
// the on-demand broker itself reachable" vs "is the host VICE MCP server
// reachable"), so both triples stay in place side by side, not one
// replacing the other. Every message here quotes brokerHostPath() (an
// absolute HOST path, recomputed fresh -- see that function's own comment)
// and the single shared ONLY_ROUTE_NOTE definition; no message below writes
// its own second only-route sentence. As of 01.6.2-09, the host-unreachable
// triple below quotes the exact same brokerHostPath() helper -- there is
// only one surviving launcher left to name, so both triples now resolve
// identically rather than two different paths.

/** State: readBrokerLiveness() found no broker.json at all -- the broker has
 * never been started on this host. Nothing on the other side would ever
 * read a request, so ensureBrokerLease() returns this BEFORE writing one. */
function brokerNeverStartedMessage(): string {
  return (
    `vice: the on-demand VICE broker has never been started on this host -- no broker.json ` +
    `record exists at all. Start it on the host with:\n` +
    `  ${brokerHostPath()}\n` +
    ONLY_ROUTE_NOTE
  );
}

/** State: broker.json exists but its heartbeat is older than the stale
 * threshold -- the broker process is dead or hung. Quotes the recorded pid
 * (readBrokerLiveness()'s own field), since checking that pid is the first
 * thing a human does on the host, mirroring deadOrHungMessage() above. */
function brokerDeadOrHungMessage(liveness: BrokerLivenessResult): string {
  const pidNote = liveness && liveness.pid != null ? ` (pid ${liveness.pid})` : "";
  return (
    `vice: the on-demand VICE broker appears to be dead or hung${pidNote} -- its last recorded ` +
    `heartbeat is older than the stale threshold. Restart it on the host with:\n` +
    `  ${brokerHostPath()}\n` +
    ONLY_ROUTE_NOTE
  );
}

/** State: the broker is alive and a request was polled, but it wrote a
 * denial rather than a grant. Relays the denial's own `reason` field
 * VERBATIM -- never paraphrased -- and deliberately carries no RESTART
 * instruction, for the same reason aliveButFailedMessage() above carries
 * none: restarting something that is answering correctly is the wrong fix.
 * Still names an absolute path (the running broker's own launcher, purely
 * as a reference, mirroring aliveButFailedMessage()'s `hostRef` note) and
 * the only-route sentence, both required of every broker-absent-adjacent
 * message this proxy emits. */
function brokerLaunchFailedMessage(reason: string): string {
  const hostRef = brokerHostPath().split("\n")[0];
  return (
    `vice: the on-demand VICE broker (running via the host-side launcher at ${hostRef}) declined ` +
    `to grant an instance for this session: ${reason} ${ONLY_ROUTE_NOTE}`
  );
}

/** State: the broker is alive and a request was written, but neither a
 * grant nor a denial appeared before pollGrant()'s own deadline -- an
 * explicit warming-and-retry result, never a silent hang. A cold x64sc
 * launch plus boot plus readiness is seconds (spike-findings-bruce-lee
 * skill), well inside the client's own per-server timeout (.mcp.json's
 * `timeout` field, task 2), so the correct next action is simply to retry
 * the SAME call, not to treat this as a failure requiring a different fix. */
function brokerWarmingMessage(elapsedMs: number): string {
  return (
    `vice: the on-demand VICE broker is still warming up an instance for this session -- no ` +
    `grant or denial appeared within ${elapsedMs}ms. This is expected for a cold start; retry the same ` +
    `call now, it should succeed once the instance finishes booting.`
  );
}

/** State: readBrokerLiveness() just classified broker.json as `alive` (a
 * FRESH heartbeat), yet openBrokerControl() still failed -- a control-plane
 * CONNECTIVITY failure, never a dead or hung broker. This is the fix for
 * the exact incident recorded in
 * .planning/todos/pending/2026-08-04-proxy-reports-a-live-broker-as-stale-blocking-all-emulator-access.md:
 * `broker.json` is read from the shared filesystem, not over the control
 * connection, so the freshness computation had a perfectly good timestamp
 * and would have returned `alive` -- the failure was one layer later, at
 * the connect (dialing `0.0.0.0`, the broker's own BIND address, from
 * inside this container). Reporting that connect failure with the
 * heartbeat/stale-threshold wording sent the reader chasing a threshold
 * that was never exceeded, costing that session roughly a dozen tool
 * calls. This message names the address and port instead: from
 * `opened.target` when the outcome resolved one (every connect-adjacent
 * failure kind sets it), degrading to the outcome's own `message` for a
 * kind that never got that far (missing broker.json fields). States
 * plainly that `broker.json`'s own `control_host` field is the broker's
 * BIND address -- valid on the host where the broker wrote it, structurally
 * undialable from inside this container -- so a reader is pointed at the
 * connectivity problem, never at broker health. Carries NO secret: not
 * `control_token`, not any other field of the record, only the resolved
 * target and the fixed prose below. Follows the broker-absent family's own
 * stated conventions (quotes `brokerHostPath()` purely as a reference, the
 * shared `ONLY_ROUTE_NOTE`, never a second only-route sentence) -- mirroring
 * brokerLaunchFailedMessage() above rather than the never-started/
 * dead-or-hung pair, since (like a launch denial) the broker here is
 * alive and answering correctly; restarting it would be the wrong fix. */
function brokerControlUnreachableMessage(opened: { kind: ControlFailureKind; message: string; target?: string }, liveness: BrokerLivenessResult): string {
  const pidNote = liveness && liveness.pid != null ? ` (pid ${liveness.pid})` : "";
  const hostRef = brokerHostPath().split("\n")[0];
  const targetNote = opened.target ?? opened.message;
  return (
    `vice: the on-demand VICE broker${pidNote} (running via the host-side launcher at ${hostRef}) has ` +
    `a fresh, healthy heartbeat -- this is NOT a dead or hung broker. This MCP tool surface could not ` +
    `reach the control plane at ${targetNote}. broker.json's own control_host field records the broker's BIND ` +
    `address, valid on the host where the broker wrote it and structurally undialable from inside this ` +
    `container -- a control-plane connectivity failure, not a broker health problem. ${ONLY_ROUTE_NOTE}`
  );
}

// removeRequestFile() (requests/<id>.json cleanup on a denial or a warming
// timeout) is GONE, not merely unused -- its subject directory ceases to
// exist under the control-plane acquisition below. There is nothing left to
// clean up on a denial or a timeout because nothing was ever written: a
// failed acquire() over the control connection leaves no file anywhere, so
// the "orphan request the sweeper must reap" problem this helper solved
// does not exist in this design.

// A causeCode-shaped reason string (e.g. "ECONNREFUSED", "ECONNRESET") is
// exactly what probeInstance() returns for a connection actively refused --
// see its own fallback `causeCode || e.message`. A timeout, an HTTP error
// status, or "didn't decode to a recognisable ping" all produce prose
// instead, never a bare all-caps E-code, which is what keeps this predicate
// precise rather than a loose substring guess.
function isConnectionRefusedReason(reason: unknown): boolean {
  return typeof reason === "string" && /^E[A-Z]+$/.test(reason);
}

function neverStartedMessage(probe: ProbeResult): string {
  return (
    `vice: the host VICE MCP server has never been started at this configured path -- no ` +
    `restart-epoch record exists, and the connection was refused (${probe.reason}). Start it on the host with:\n` +
    `  ${brokerHostPath()}\n` +
    ONLY_ROUTE_NOTE
  );
}

function deadOrHungMessage(probe: ProbeResult, epoch: EpochResult): string {
  const pidNote =
    epoch && epoch.present && epoch.pid != null
      ? ` (pid ${epoch.pid}${epoch.spawned_at ? `, spawned_at ${epoch.spawned_at}` : ""})`
      : "";
  return (
    `vice: the host VICE MCP server appears to be dead or hung${pidNote} -- ${probe.reason}. ` +
    `Restart it on the host with:\n` +
    `  ${brokerHostPath()}\n` +
    ONLY_ROUTE_NOTE
  );
}

/** Reached only when the pre-flight probe found the host alive but the
 * forwarded call itself failed (a transport error the retry ladder gave up
 * on, or a genuine RPC error). Relays the host's own message VERBATIM --
 * never paraphrased -- and deliberately carries no restart instruction,
 * since restarting a live, correctly-answering host is the wrong fix for a
 * rejected tool call. Still names an absolute path and the only-route note
 * (both required of every unreachable-adjacent message this proxy emits),
 * worded so as never to suggest the action a restart message would. */
function aliveButFailedMessage(errMessage: string): string {
  const hostRef = brokerHostPath().split("\n")[0];
  return (
    `vice: the host VICE MCP server (reachable via the host-side launcher at ${hostRef}) rejected ` +
    `this call: ${errMessage} ${ONLY_ROUTE_NOTE}`
  );
}

// RESOLVED RESIDUAL (originally quick-260801-ccn task 3; re-examined by
// 01.6.2-09, T-01.6.2-54/T-01.6.2-59): this comment used to record that
// aliveButFailedMessage() above still named a SEPARATE per-instance
// supervisor path even under a broker-granted session -- a genuine
// mismatch, because two different launchers existed. That mismatch is
// dissolved, not merely reworded: supervisorHostPath() is deleted, and
// aliveButFailedMessage() now resolves the exact same brokerHostPath()
// helper every other message in this file uses, so there is only ever one
// launcher path to name, regardless of session type. What still holds,
// unchanged, is the REASON this message carries no restart instruction: it
// answers a different question from both the host-unreachable triple and
// the broker-granted message below -- an instance that IS reachable and
// answering rejected ONE call -- where no launcher is the fix and a
// restart would be the wrong advice on either route (broker-granted or
// fixed-port).

// ------------------------------------------- broker-granted unreachable diagnostics
//
// Quick task 260801-ccn task 3 (D-5) introduced ONE message here, distinct
// from both the host-unreachable triple above and the broker-ABSENT triple
// below, for a granted instance that stopped answering: report the fact and
// tell a human to go investigate on the host.
//
// Plan 01.6.2-08 (D-13) turns that report-and-instruct message into a
// replace-and-report: a granted instance not answering no longer waits for
// a human -- it costs this session exactly one replacement acquisition,
// made automatically, and the triggering call still fails LOUDLY (never a
// silently substituted result) naming the replacement. See
// handleGrantedInstanceUnreachable() and its own three message builders
// (machineReplacedMessage()/replacementFailedMessage()/
// sessionMustRestartMessage()) further down this file, right after
// ensureBrokerLease() -- the function this diagnostic superseded is gone,
// not merely unused: brokerHostPath()'s "go investigate on the host"
// framing no longer applies once the proxy investigates (replaces) on its
// own first.

// ------------------------------------------------------------ path rewriting
//
// Decision D-G (plan 01.1-03 task 3 / criterion 9): container->host path
// translation moves from every caller's own discipline into this one seam,
// which sees every forwarded call. The structural rule: any string argument
// value beginning with "/" is an absolute filesystem path. One that resolves
// inside the mounted workspace is rewritten to its host form via
// hostPath() -- the host emulator can only ever be handed a HOST path,
// since it runs on the host, not in this container. One that resolves
// outside the workspace is refused outright, before any forwarding, because
// a container path is never correct on the host: forwarding it untouched
// can only produce a wrong answer with no error, which is exactly the
// silent-failure class this criterion exists to eliminate.
//
// RELATIVE paths: resolved against the workspace root, but ONLY for the
// arguments the tools manifest declares to BE paths.
//
// The original rule left every relative string byte-identical, on the
// reasoning that "a relative-looking string is indistinguishable from a
// non-path argument (a tool name, a hex address like "$0400", an arbitrary
// label) without guessing". That reasoning was sound for a walker with no
// schema, and it pointed callers at a SKILL.md "Paths" section for the
// absolute-path requirement -- but that SKILL.md was deleted in db9eed3,
// leaving the requirement stated nowhere. CLAUDE.md's surviving wording
// ("pass container paths and let the tools handle the boundary") promises
// the opposite, so callers reasonably passed "disks/foo.d64" and got a bare
// "Failed to attach disk image" from the host, with nothing anywhere
// indicating the path was the problem. That cost real session time.
//
// The premise is also no longer true. tools-manifest.json -- the same file
// tools/list is served from -- types every argument, and exactly four
// declare a path: vice_disk_attach.path, vice_autostart.path,
// vice_display_screenshot.path and vice_symbols_load.path. Consulting it
// removes the guessing the residual was protecting against: a relative
// string in a DECLARED path argument is a path, full stop, and everything
// else keeps the byte-identical pass-through unchanged.
//
// Resolution is against the workspace root, never process.cwd() -- the
// proxy is one long-lived process serving the whole session, so its cwd is
// meaningless to the caller. (hostpath.mjs:106 resolves against cwd for its
// CLI's benefit; that branch is unreachable from here, and deliberately so.)
//
// STATED RESIDUAL, narrower than before: a relative string in an argument
// the manifest does NOT declare as a path is still left byte-identical, and
// so is a relative string nested inside an object or array. Both remain
// indistinguishable from non-path data. A worktree caller also resolves
// against the MAIN workspace root, not its worktree -- correct for the
// read-only disk images this serves, and an absolute path still overrides.
const PATH_REWRITE_MAX_DEPTH = 10; // bounded so pathological nesting is left alone rather than looping forever

class PathOutOfWorkspaceError extends Error {}
class PathTranslationError extends Error {}

// The boundary check MUST run against a normalized path, never the raw
// string. `startsWith(root)` on an unnormalized value is satisfied by any
// string that merely begins with the root's characters, so a lexical `..`
// sequence -- "/workspaces/bruce_lee/../../../etc/passwd" -- passes a raw
// prefix test and is then handed to hostPath(), which does NOT refuse it:
// when relative() normalizes to a leading "..", hostpath.mjs deliberately
// falls through to generic mount-based translation instead of throwing (its
// own comment says so, for the CLI's benefit). That makes THIS check the only
// workspace boundary on the forwarding path, so it has to be the strict one.
//
// resolve() collapses "." and ".." segments; callers only reach here after
// value.startsWith("/") is confirmed, so it is pure normalization and never
// pulls in process.cwd().
//
// STATED RESIDUAL: this is lexical, not physical -- a symlink inside the
// workspace whose target lives outside it still translates. realpathSync()
// would catch that but requires the file to already exist, which is wrong for
// the write-side tools (snapshot_save and friends name a path that does not
// exist yet). Lexical normalization is the part that can be enforced for both
// directions without breaking writes.
function isInsideWorkspace(absPath: string, root: string): boolean {
  return absPath === root || absPath.startsWith(root.endsWith("/") ? root : root + "/");
}

/**
 * Recursively walk `value`, applying decision D-G's structural rule to
 * every string found. Objects and arrays are walked (bounded by
 * PATH_REWRITE_MAX_DEPTH); numbers, booleans, null, and non-absolute
 * strings are returned byte-identical. `argPath` accumulates a
 * human-readable position (e.g. "arguments.path" or "arguments.files[2]")
 * used in a refusal message so the caller can find exactly which argument
 * was the problem.
 */
function rewritePathsIn(value: unknown, argPath: string, root: string, depth: number, asWritten?: string): unknown {
  if (depth > PATH_REWRITE_MAX_DEPTH) return value;
  if (typeof value === "string") {
    if (!value.startsWith("/")) return value; // the stated residual: undeclared relative strings untouched
    // Normalize FIRST, then check, then translate the normalized form -- so a
    // path that only looks like it is inside the workspace cannot slip through,
    // and the host is never handed a path still carrying ".." segments.
    const normalized = resolve(value);
    // `asWritten` is set only when rewriteArguments() already resolved a
    // declared-path argument from a relative string. Quoting the resolved
    // form alone would show the caller a path they never typed, so BOTH
    // failure branches below name what they wrote and what it became.
    const escapedRelative = asWritten !== undefined && asWritten !== value;
    if (!isInsideWorkspace(normalized, root)) {
      throw new PathOutOfWorkspaceError(
        (escapedRelative
          ? `vice: ${argPath} is the relative path "${asWritten}", which resolves to ${normalized} -- ` +
            `outside the mounted workspace (${root})`
          : `vice: ${argPath} is an absolute path (${value}) outside the mounted workspace (${root})` +
            (normalized === value ? "" : `; it resolves to ${normalized}`)) +
          `. The host emulator can only be handed paths that live inside the mounted workspace -- move the ` +
          `artifact inside the workspace and call again.`
      );
    }
    try {
      return hostPath(normalized, { workspaceRoot: root });
    } catch (e) {
      // Name what the CALLER wrote first, and the container path it became --
      // never lead with the host path. The caller reasons in container terms
      // and cannot act on a host-side location, so quoting only the resolved
      // form makes a fixable mistake look like an emulator fault.
      throw new PathTranslationError(
        `vice: ${argPath} ` +
          (escapedRelative ? `("${asWritten}", which resolves to ${normalized})` : `(${value})`) +
          ` could not be translated to a host path: ${(e as Error).message}\n  ${SET_ENV_HINT}`
      );
    }
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => rewritePathsIn(v, `${argPath}[${i}]`, root, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = rewritePathsIn(v, `${argPath}.${k}`, root, depth + 1);
    }
    return out;
  }
  return value; // numbers, booleans, null -- byte-identical, never touched
}

const NO_PATH_ARGS: Set<string> = new Set();
let PATH_ARGS_BY_TOOL: Map<string, Set<string>> | null = null; // built once per process, from the manifest

/**
 * The set of argument names `toolName` declares to be filesystem paths,
 * read off tools-manifest.json -- the SAME file tools/list is served from,
 * so this can never become a second, drifting copy of "which arguments are
 * paths". An argument qualifies when it is declared `type: "string"` and
 * either is named exactly `path` or opens its description with "Path to" /
 * "File path" (both tests agree on all four current cases; either alone
 * would also suffice, and keeping both means a future manifest entry that
 * satisfies only one is still caught).
 *
 * Deliberately name/description-driven rather than a hardcoded tool list:
 * a manifest refresh that adds a path-taking tool gets the behaviour for
 * free, which a literal list here would silently miss.
 */
function pathArgsFor(toolName: string): Set<string> {
  if (!PATH_ARGS_BY_TOOL) {
    PATH_ARGS_BY_TOOL = new Map();
    for (const t of readManifestTools()) {
      const props = isPlainObject(t.inputSchema) ? (t.inputSchema.properties as unknown) : undefined;
      if (!props || typeof props !== "object") continue;
      const names = new Set<string>();
      for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
        if (!isPlainObject(v) || v.type !== "string") continue;
        if (k === "path" || /^(path|file path)\b/i.test((v.description as string) || "")) names.add(k);
      }
      if (names.size) PATH_ARGS_BY_TOOL.set(t.name, names);
    }
  }
  return PATH_ARGS_BY_TOOL.get(toolName) || NO_PATH_ARGS;
}

/** One `arguments.<key>` resolved from a relative, manifest-declared path
 * argument to its absolute container form, before hostPath() translation --
 * the record resolutionNote() below renders for the agent. */
interface PathResolution {
  arg: string;
  asWritten: string;
  container: string;
}

/** Rewrite every in-workspace path inside `args` to its host form. A relative
 * string in a manifest-declared path argument is resolved against the
 * workspace root first; everything else keeps the byte-identical
 * pass-through. Throws PathOutOfWorkspaceError / PathTranslationError on the
 * two refusal cases above; the caller (handleToolsCall) converts either into
 * an isError:true result rather than letting it escape. */
function rewriteArguments(
  args: Record<string, unknown> | undefined,
  toolName: string
): { args: Record<string, unknown>; resolutions: PathResolution[] } {
  const root = repoRoot();
  const pathArgs = pathArgsFor(toolName);
  const out: Record<string, unknown> = {};
  const resolutions: PathResolution[] = [];
  for (const [k, v] of Object.entries(args || {})) {
    // Only a top-level, declared-path, non-empty relative string is resolved.
    // Empty stays empty (resolve() would silently turn "" into the workspace
    // root, i.e. a directory, which is never what a caller meant).
    if (pathArgs.has(k) && typeof v === "string" && v !== "" && !v.startsWith("/")) {
      const container = resolve(root, v);
      out[k] = rewritePathsIn(container, `arguments.${k}`, root, 1, v);
      resolutions.push({ arg: k, asWritten: v, container });
    } else {
      out[k] = rewritePathsIn(v, `arguments.${k}`, root, 1);
    }
  }
  return { args: out, resolutions };
}

/**
 * One line naming, in full, every relative path this call resolved -- so the
 * absolute path actually handed to the emulator is never something the caller
 * has to infer. Returned to the AGENT, not just stderr: the failure this
 * prevents ("Failed to attach disk image", with no indication which file was
 * even attempted) is one the agent has to diagnose, and it cost a real session
 * before the resolution existed at all. Empty string when nothing was resolved,
 * so a call that passed absolute paths reads exactly as it always did.
 */
function resolutionNote(resolutions: PathResolution[] | undefined): string {
  if (!resolutions || !resolutions.length) return "";
  const parts = resolutions.map((r) => `${r.arg}: "${r.asWritten}" -> ${r.container}`);
  return `vice: resolved relative path${resolutions.length > 1 ? "s" : ""} against the workspace root -- ${parts.join("; ")}`;
}

// ------------------------------------------------------- oversized results
//
// Decision D-E: the `_meta["anthropic/maxResultSizeChars"]` declaration
// above raises the real limit far past the 25,000-token default, but a
// second, proxy-side cap catches whatever still overruns it (a 64K RAM read
// in any plausible encoding, per ROADMAP criterion 5). Nothing on this path
// may silently shorten a payload -- there is no truncation branch. An
// oversized result is split and served in full across an explicit
// continuation sequence via one synthetic tool (`vice_result_continue`,
// declared above), so the caller can always reassemble the whole payload.
//
// The store is bounded so a long session cannot grow it without limit: at
// most MAX_CONTINUATIONS outstanding sequences, oldest evicted first (a
// `Map` preserves insertion order, so its first key is always the oldest).
// An evicted or exhausted token fails loudly with advice to narrow the
// original call rather than resume it -- there is nothing left to resume.
interface ContinuationEntry {
  chunks: string[];
  nextIndex: number;
  totalChunks: number;
  totalChars: number;
}

const CONTINUATION_STORE: Map<string, ContinuationEntry> = new Map(); // token -> { chunks: string[], nextIndex: number, totalChunks: number, totalChars: number }
const MAX_CONTINUATIONS = 5;
let continuationCounter = 0;

function nextContinuationToken(): string {
  continuationCounter += 1;
  return `cont-${process.pid}-${Date.now()}-${continuationCounter}`;
}

interface ChunkMarkerArgs {
  chunkIndex: number;
  totalChunks: number;
  totalChars: number;
  token: string;
}

function chunkMarkerText({ chunkIndex, totalChunks, totalChars, token }: ChunkMarkerArgs): string {
  if (chunkIndex >= totalChunks) {
    return (
      `vice: chunk ${chunkIndex} of ${totalChunks} (last chunk) -- ${totalChars} total characters ` +
      `served across this continuation sequence.`
    );
  }
  return (
    `vice: chunk ${chunkIndex} of ${totalChunks} -- ${totalChars} total characters. Call ` +
    `vice_result_continue with arguments {"token":"${token}"} to retrieve the next chunk.`
  );
}

/**
 * Wrap a successful call's serialised text, splitting it across a
 * continuation sequence if (and only if) it exceeds OUTPUT_CHAR_CAP. Under
 * the cap, behaves exactly as an unchunked result always has: a single
 * `content` item, nothing else appended. Over the cap, the FIRST content
 * item is the pure payload chunk -- byte-for-byte, no marker text mixed in,
 * so reassembly is a plain concatenation -- and a SECOND content item
 * carries the marker, naming the exact next call to make.
 */
function wrapPossiblyChunked(text: string): OkTextResult {
  if (text.length <= OUTPUT_CHAR_CAP) {
    return { content: [{ type: "text", text }], isError: false };
  }

  const totalChars = text.length;
  const pieces: string[] = [];
  for (let i = 0; i < text.length; i += OUTPUT_CHAR_CAP) {
    pieces.push(text.slice(i, i + OUTPUT_CHAR_CAP));
  }
  const totalChunks = pieces.length;
  const [first, ...remaining] = pieces;

  const token = nextContinuationToken();
  while (CONTINUATION_STORE.size >= MAX_CONTINUATIONS) {
    const oldestToken = CONTINUATION_STORE.keys().next().value as string;
    CONTINUATION_STORE.delete(oldestToken);
  }
  CONTINUATION_STORE.set(token, { chunks: remaining, nextIndex: 2, totalChunks, totalChars });

  return {
    content: [
      { type: "text", text: first },
      { type: "text", text: chunkMarkerText({ chunkIndex: 1, totalChunks, totalChars, token }) },
    ],
    isError: false,
  };
}

/** Handles `vice_result_continue` -- served entirely inside this proxy;
 * NEVER reaches `call()` or the network. */
function handleResultContinue(args: Record<string, unknown>): ToolCallResult {
  const token = args && typeof args.token === "string" ? args.token : null;
  if (!token || !CONTINUATION_STORE.has(token)) {
    return isErrorText(
      `vice: continuation token "${token}" is unknown or has already expired. Re-issue the ` +
        `original tools/call with a narrower range instead of resuming.`
    );
  }
  const entry = CONTINUATION_STORE.get(token) as ContinuationEntry;
  const chunk = entry.chunks.shift() as string;
  const chunkIndex = entry.nextIndex;
  entry.nextIndex += 1;
  const isLast = entry.chunks.length === 0;
  if (isLast) {
    CONTINUATION_STORE.delete(token);
  }
  return {
    content: [
      { type: "text", text: chunk },
      {
        type: "text",
        text: chunkMarkerText({ chunkIndex, totalChunks: entry.totalChunks, totalChars: entry.totalChars, token }),
      },
    ],
    isError: false,
  };
}

// -------------------------------------------------------------- broker lease
//
// On-demand acquisition (Phase 01.2): deferred to the FIRST forwarded
// tools/call, never to initialize/tools/list, matching the measured "spawn
// is eager, acquisition must not be" finding (spike-findings-bruce-lee
// skill, proxy-lifecycle-and-process-identity.md) -- a session that never
// forwards a call never asks the broker for anything (C3).
//
// Plan 01.6.2-07: the lease is now the CONTROL CONNECTION itself, not a
// file. controlSession holds the open BrokerControlSession (plan 06's
// completed client) for this session's lifetime; grantId is the acquired
// grant's own id -- the PRIMARY noun of the protocol carries over unchanged
// (still promoted from port to request id, since ports are recycled across
// sessions under on-demand launch), it is just no longer a filename. Both
// null means either no session has been opened yet, or VICE_MCP_URL
// overrides the broker entirely. There is no heartbeat timer any more --
// nothing needs touching to prove a TCP connection is still alive; it
// either is, or the broker's own "close" handler has already torn the
// instance down.
let controlSession: BrokerControlSession | null = null;
let grantId: string | null = null;

// ----------------------------------------------------- grant containerization
//
// Quick task 260801-ccn (the inverse of Phase 01.1 criterion 9). The broker
// runs on the HOST, legitimately resolves its own repo root, and writes a
// grant carrying host-local coordinates: a loopback `url`, and
// `epoch_file`/`supervisor_dir` paths rooted at the host's own checkout --
// entirely correct from where the broker stands. Nothing inverted them
// before this task: loopback meant the CONTAINER's own loopback
// (ECONNREFUSED, since nothing listens there) and the host-rooted epoch
// path simply never resolved, so every broker-granted instance was silently
// unreachable. containerizeGrant() is the seam that fixes this -- called in
// ensureBrokerLease() below between session.acquire() returning a grant and
// useInstance() adopting it, since that is the LAST point before the
// coordinates become the session's identity (D-1).
function containerizeGrant(grant: Record<string, unknown>): Record<string, unknown> {
  const grantId = grant && typeof grant.id === "string" ? grant.id : "(no id)";
  const port = Number(grant && grant.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    // T-mef-01's rule, reused here: nothing downstream can be trusted
    // without a validated port, so no translation is even attempted --
    // useInstance() fails on its own terms, exactly as it would have before
    // this function existed.
    console.error(
      `vice-proxy: containerizeGrant ${grantId}: grant.port (${grant && grant.port}) is not a valid integer ` +
        `port -- skipping translation entirely.`
    );
    return grant;
  }

  const alias = mcpHost();
  // containerizeRecord() (containerpath.ts) does the translation itself:
  // `url` through the loopback-rewrite (D-4), `epoch_file`/`supervisor_dir`
  // through the host->container path inverse (D-2 -- all three fields). An
  // already container-shaped record (every pre-existing broker test's
  // tmpdir-rooted VICE_POOL_DIR) matches no known host root and comes back
  // byte-identical -- D-7's whole point.
  const { record, changes } = containerizeRecord(grant, {
    pathFields: ["epoch_file", "supervisor_dir"],
    urlFields: ["url"],
    alias,
  });

  // Safety net (T-ccn-01, T-ccn-02), mirroring the outbound seam's own
  // posture: never open/connect to an unvalidated string read out of a
  // grant file. On either failure below, substitute the coordinate DERIVED
  // FROM THE VALIDATED PORT instead (instanceFor()'s own T-mef-01 rule,
  // reused here) and report the substitution -- never silently.
  const root = repoRoot();
  const fallbackDir = join(brokerRootDir(), String(port));
  const fallbackEpochFile = join(fallbackDir, "epoch.json");
  const fallbackUrl = `http://${alias}:${port}/mcp`;
  const changedFields = new Set(changes.map((c) => c.field));
  const substituted: Record<string, boolean> = { url: false, epoch_file: false, supervisor_dir: false };

  // T-ccn-01: only a field that was ACTUALLY TRANSLATED (its host root
  // matched) is re-checked for workspace containment -- an already
  // container-shaped path was never translated at all (D-7's passthrough)
  // and is trusted exactly as every pre-existing broker test already relies
  // on. A translated path escaping the workspace (a lexical ".." sequence
  // in the grant's own host-rooted field) is exactly what this check
  // catches.
  if (changedFields.has("epoch_file") && !isInsideWorkspace(resolve(record.epoch_file as string), root)) {
    record.epoch_file = fallbackEpochFile;
    substituted.epoch_file = true;
  }
  if (changedFields.has("supervisor_dir") && !isInsideWorkspace(resolve(record.supervisor_dir as string), root)) {
    record.supervisor_dir = fallbackDir;
    substituted.supervisor_dir = true;
  }

  // T-ccn-02: the FINAL url's port must equal the validated grant port,
  // checked UNCONDITIONALLY (translated or not) -- a grant could simply
  // declare a mismatched port from the start, translation aside, and that
  // is exactly the spoofing shape this check exists to catch.
  let urlPortOk = false;
  if (typeof record.url === "string") {
    try {
      urlPortOk = Number(new URL(record.url).port) === port;
    } catch {
      urlPortOk = false;
    }
  }
  if (!urlPortOk) {
    record.url = fallbackUrl;
    substituted.url = true;
  }

  // Exactly ONE stderr line, naming every field's before/after (or
  // "unchanged") -- this is the signal whose absence made the original bug
  // invisible; it must never become a line per field (D-2's own reporting
  // requirement).
  const parts = ["url", "epoch_file", "supervisor_dir"].map((field) => {
    const original = grant ? grant[field] : undefined;
    const final = record[field];
    if (substituted[field]) {
      return `${field}: SUBSTITUTED ${JSON.stringify(original)} -> ${JSON.stringify(final)} (port-derived fallback)`;
    }
    if (final === original) {
      return `${field}: unchanged (${JSON.stringify(final)})`;
    }
    return `${field}: ${JSON.stringify(original)} -> ${JSON.stringify(final)}`;
  });
  console.error(`vice-proxy: containerized grant ${grantId} -- ${parts.join("; ")}`);

  return record;
}

/**
 * Acquire a broker-granted instance for this session, once. Returns
 * immediately (no broker traffic at all) when a session is already held,
 * and immediately when VICE_MCP_URL is set -- an explicit endpoint override
 * means the caller already chose an instance, which is both the principled
 * rule and what keeps every pre-existing proxy test passing with no edit.
 *
 * Plan 01.6.2-07: the lease is now the CONTROL CONNECTION itself. The prior
 * ordering constraint here -- create a lease file BEFORE awaiting the grant,
 * because the host's own sweep tore a grant down whenever its lease file was
 * absent -- DISSOLVES entirely under this design: the connection is open,
 * and is therefore already the proof this session holds a claim, before the
 * acquire request is even sent. There is no window between "a grant exists"
 * and "a lease exists" for a sweep to land in, because there is no longer a
 * second artifact for the two to disagree about. D-09's shutdown-deletion
 * question dissolves the same way, for the same reason: under D-01 the
 * request/lease/grant/denial directories never exist at all, so there is
 * nothing to delete on shutdown and nothing to reconcile -- a reader meeting
 * that earlier decision needs to know it no longer applies, not that it was
 * quietly dropped.
 */
type BrokerLeaseResult = { ok: true } | { ok: false; message: string };

async function ensureBrokerLease(): Promise<BrokerLeaseResult> {
  if (controlSession) return { ok: true };
  if (process.env.VICE_MCP_URL) return { ok: true }; // explicit override -- broker never contacted

  // Classify liveness FIRST, before ever opening a connection (C10).
  // never_started and stale both return their message immediately, with no
  // connection attempted -- there is nothing on the other side to answer
  // one, so attempting it would only delay the diagnosis. readBrokerLiveness()
  // re-reads broker.json fresh on every call (see its own implementation in
  // vice-broker-client.ts); nothing here memoises the verdict, so this is the
  // broker-path instance of the same never-cache-a-negative-result invariant
  // the comment above ensureViceSession() already states for the host path --
  // the call after a human starts the broker just works, with no session
  // restart required. openBrokerControl() performs this SAME classification
  // again internally (over its own read of broker.json) before it ever
  // connects -- a second, independent read, not a second answer to trust
  // instead of this one; fetching liveness here first is what gives the
  // diagnoses below (dead-or-hung's own pid) something to quote.
  const liveness = readBrokerLiveness();
  if (liveness.state === "never_started") {
    return { ok: false, message: brokerNeverStartedMessage() };
  }
  if (liveness.state === "stale") {
    return { ok: false, message: brokerDeadOrHungMessage(liveness) };
  }

  const acquireStartedAt = Date.now();
  const opened = await openBrokerControl();
  if (!opened.ok) {
    // openBrokerControl() re-classifies liveness from its OWN read of
    // broker.json before ever connecting -- never_started/stale here means
    // that SECOND read found a genuine race (the broker died between the
    // classification above and this one), so both route to their usual two
    // messages, unchanged. EVERY other kind (unreachable_control_plane,
    // connect_refused, protocol, broker_gone, ...) is reached only when that
    // second read agreed the broker is alive -- reading those as
    // dead-or-hung was the exact mis-attribution this plan closes (see
    // brokerControlUnreachableMessage()'s own header comment for the full
    // incident record): a connect failure against a healthy heartbeat is a
    // control-plane CONNECTIVITY problem, not a broker liveness one, so it
    // gets its own message naming the address and port instead.
    if (opened.kind === "never_started") {
      return { ok: false, message: brokerNeverStartedMessage() };
    }
    if (opened.kind === "stale") {
      return { ok: false, message: brokerDeadOrHungMessage(liveness) };
    }
    return { ok: false, message: brokerControlUnreachableMessage(opened, liveness) };
  }
  const session = opened.session;

  const result = await session.acquire();
  if (!result.ok) {
    // No grant is coming for this session -- nothing to hold the connection
    // open for. Closing it here is the control-plane's entire equivalent of
    // the old cleanup (releaseLease(id) + removeRequestFile(id)): there was
    // never a file to remove in the first place.
    await session.release();
    if (result.kind === "deadline") {
      return { ok: false, message: brokerWarmingMessage(Date.now() - acquireStartedAt) };
    }
    return { ok: false, message: brokerLaunchFailedMessage(result.message) };
  }

  // adoptGrant() is the ONE seam that inverts the grant's host-local
  // coordinates (D-1, quick task 260801-ccn) and adopts them as this
  // session's active instance -- the LAST point before the coordinates
  // become the session's identity: the endpoint every later tool call is
  // sent to, and the path the epoch guard opens. Plan 08 (D-13) reuses this
  // EXACT function for a replacement acquisition too (see
  // handleGrantedInstanceUnreachable() below) -- one code path for adopting
  // an instance, never a second one for a replacement.
  adoptGrant({ ...result.grant });
  viceSession = null; // re-baseline: the next ensureViceSession() reads the GRANTED instance's own epoch file
  controlSession = session;
  return { ok: true };
}

/**
 * The ONE adoption seam (D-13): containerize a grant's host-local
 * coordinates and adopt them as this session's active instance, recording
 * the grant id. Called by ensureBrokerLease() above for an ORDINARY
 * acquisition and by handleGrantedInstanceUnreachable() below for BOTH of
 * its replacement acquisitions (the same-session retry and the
 * fresh-session retry) -- never a second, parallel adoption path for a
 * replacement.
 */
function adoptGrant(grant: Record<string, unknown>): void {
  grantId = typeof grant.id === "string" ? grant.id : null;
  const containerized = containerizeGrant({ ...grant });
  useInstance({
    port: containerized.port as number,
    url: containerized.url as string,
    epochFile: containerized.epoch_file as string,
    pooled: true,
  });
}

// --------------------------------------- D-13/D-14: replace-and-report
//
// Plan 01.6.2-08. A granted instance's pre-flight probe failing used to
// produce ONE report-and-instruct message (the retired
// brokerGrantedUnreachableMessage(), see this file's earlier comment naming
// where it lived) and stop there, leaving a human to go investigate on the
// host. D-13 changes that into a replace-and-report: the proxy acquires a
// replacement itself, immediately, over the SAME control session (only the
// emulator instance is suspected dead here, not necessarily the connection
// to the broker) -- but still fails the TRIGGERING call LOUDLY, naming the
// replacement, rather than silently substituting a result read from a
// machine the caller never asked for. A memory read served quietly against
// a blank replacement returns zeroed RAM indistinguishable from real data,
// which is exactly the hazard the epoch guard elsewhere in this file exists
// to catch -- a notice buried inside an otherwise-successful payload is
// easy to skim past, so this never returns one.
//
// D-14 is what happens when that SAME-session replacement attempt itself
// discovers the connection is gone (kind "broker_gone"): an ACCEPTED,
// KNOWING regression, recorded here rather than left to be rediscovered as
// a defect. Before plan 07's transport swap, the only broker dependency
// surviving past a grant was a file write (the retiring lease heartbeat)
// whose failure was a silent no-op -- broker death was survivable by
// construction, because nothing after the grant still needed the broker at
// all. Under one held TCP connection, that is no longer true: recycle and
// (as of this plan) replacement both need a live connection. That safety
// margin is given up DELIBERATELY, per the tolerance decision recorded in
// broker-control-plane-over-tcp.md -- the compensation is that a session is
// told LOUDLY rather than left to quietly keep working against whatever a
// still-reachable granted instance happens to answer, for as long as it
// happens to stay reachable.
//
// Both D-13 and D-14 reuse the SAME machineReplacedMessage() builder (which
// itself reuses epochDriftMessage(), the existing voided-run vocabulary the
// fixed-port epoch-drift guard already carries) -- one vocabulary for a
// voided run, never a second one paralleling it. Neither outcome is ever
// cached: controlSession is deliberately left pointing at a known-dead
// session on every failure branch below, so the NEXT call's own probe
// failure repeats this exact same from-scratch attempt (a fresh
// openBrokerControl() reads broker.json fresh every time, never memoised),
// rather than short-circuiting on a remembered verdict -- see the
// NEVER-CACHE-A-NEGATIVE-RESULT invariant above ensureViceSession().

/**
 * D-13/D-14's shared report text: a call was refused because the machine
 * behind it was REPLACED out from under it. Reuses epochDriftMessage() --
 * the SAME builder the fixed-port epoch-drift guard already uses -- for the
 * epoch-comparison sentence, rather than inventing a second wording for
 * "this is not the machine you had a moment ago" (D-13's own instruction:
 * no second notion of a voided run). States the three facts an agent needs,
 * literally: the machine was REPLACED, the replacement is FRESH, and prior
 * state on the old instance is GONE.
 *
 * 2026-08-05 defect fix, two parts, both kept INLINE here (not extracted to
 * a helper) so this function's own body still literally contains the
 * `epochDriftMessage(` call the structural test
 * ("the replaced-machine report is built from the existing voided-run
 * vocabulary") pins:
 *
 *   1. Epoch sentence -- three cases, not two. The old code called
 *      epochDriftMessage() whenever BOTH epochs were merely present,
 *      with no inequality check -- so an unmoved-but-both-present pair
 *      (oldEpoch.epoch === newEpoch.epoch) rendered the literally false
 *      "epoch changed from 1 to 1" (the exact sighting on file). Now:
 *      both present AND different -> epochDriftMessage(), unchanged; both
 *      present but EQUAL -> an honest "did not change" sentence (each
 *      port's epoch file is an independent counter, so a coincidental
 *      match is expected, not evidence of anything -- and a genuinely
 *      reused port can still read stale-equal if the host had not yet
 *      written its post-respawn bump at the moment this was sampled); not
 *      both present -> unchanged from before, "could not both be
 *      compared".
 *   2. Port sentence -- when oldPort === newPort (a real, legitimate
 *      outcome in this broker's fixed-slot design: a "replacement" can
 *      land back on the exact port it replaced), the OLD wording named
 *      that single port number as both "the old instance (port X)" and
 *      "the replacement instance (port X)" -- two different entities
 *      sharing one label, which a reader cannot reconcile ("one port
 *      cannot be both"). Now branches on whether the port actually
 *      changed: same port says so plainly ("replaced in place"), rather
 *      than implying two distinct ports that happen to print the same
 *      digits.
 */
function machineReplacedMessage(opts: {
  where: string;
  reason: string;
  oldPort: number;
  oldEpoch: EpochResult;
  newPort: number;
  newEpoch: EpochResult;
}): string {
  const { where, reason, oldPort, oldEpoch, newPort, newEpoch } = opts;
  let driftSentence: string;
  if (oldEpoch.present && newEpoch.present) {
    driftSentence =
      oldEpoch.epoch !== newEpoch.epoch
        ? epochDriftMessage(where, oldEpoch, newEpoch)
        : `vice: the epoch recorded ${where} did not change (still ${oldEpoch.epoch}) -- this is NOT evidence ` +
          `the machine stayed the same: each port's epoch counter is independent, so a coincidental match is ` +
          `expected between two unrelated files, and a genuinely reused port can still read stale-equal if the ` +
          `host had not yet recorded its post-respawn bump at the moment this was sampled. Treat every result ` +
          `since the previous call as void and redo that work regardless -- the replacement itself (below) is ` +
          `the operative fact here, not this epoch read.`;
  } else {
    driftSentence =
      `vice: treat every result since the previous call as void and redo that work -- the old instance's ` +
      `epoch and the new instance's epoch could not both be compared ` +
      `(old epoch present: ${oldEpoch.present}, new epoch present: ${newEpoch.present}).`;
  }
  const portSentence =
    oldPort === newPort
      ? `The instance behind port ${oldPort} was REPLACED IN PLACE -- the process is a FRESH emulator (this ` +
        `broker's fixed-slot design can hand the replacement the SAME port back), and all prior state from ` +
        `before the replacement is GONE (${reason}).`
      : `The machine was REPLACED, the replacement is a FRESH emulator, and all prior state on the old ` +
        `instance (port ${oldPort}) is GONE (${reason}).`;
  return (
    `${driftSentence} ${portSentence} Make this call again -- it will run on the replacement instance ` +
    `(port ${newPort}), already acquired and adopted for this session.`
  );
}

/** D-13: the replacement acquisition itself failed for a reason OTHER than
 * the broker connection being gone (denied, no_free_port, at_capacity, its
 * own deadline, ...). Names both failures -- the original unreachability
 * and the failed replacement -- and does not retry: a retry loop against a
 * broker that cannot currently grant is how one failure becomes a hang. */
function replacementFailedMessage(probe: ProbeResult, failure: { kind: string; message: string }): string {
  return (
    `vice: retry this call yourself once the underlying problem is fixed -- no further replacement will ` +
    `be attempted automatically. The granted instance stopped answering (${probe.reason}), and a ` +
    `same-session replacement attempt also failed (${failure.kind}: ${failure.message}).`
  );
}

/** D-14: the broker connection is gone and a fresh one could not be opened
 * either (or could be opened but could not itself acquire) -- there is
 * nothing left this proxy can do on its own. Names the broker, not this
 * proxy, as the cause, and states plainly that no further call in THIS
 * session can succeed until it is running again. */
function sessionMustRestartMessage(failure: { kind: string; message: string }): string {
  return (
    `vice: this session must be restarted -- no further call in this session can succeed until the ` +
    `broker is running again. The on-demand VICE broker connection is gone and a fresh session could ` +
    `not be opened (${failure.kind}: ${failure.message}). The broker itself is the cause.`
  );
}

/**
 * D-13/D-14's entry point, reached only when the pre-flight probe found the
 * session's granted instance unreachable AND a control session is held.
 * Exactly one same-session replacement attempt, then (only if THAT attempt
 * discovers the connection itself is gone) exactly one fresh-session
 * attempt -- never a loop, never more than these two acquisitions for one
 * triggering call. Always returns a report string; never a result, even on
 * the success paths -- see this section's own header comment for why.
 */
async function handleGrantedInstanceUnreachable(probe: ProbeResult, oldEpoch: EpochResult): Promise<string> {
  const { port: oldPort } = activeInstance();
  const session = controlSession as BrokerControlSession;

  // Attempt 1: a replacement over the SAME session (D-13). Only the granted
  // EMULATOR is suspected dead here -- the connection to the broker may
  // still be perfectly good, and reusing it is the whole point of "costs
  // one acquisition, not the session."
  //
  // Gap closure (plan 14, WR-03 / T-01.6.2-90): release the grant this
  // session currently holds BEFORE acquiring its replacement -- two
  // independent reasons, both load-bearing, and order matters for both.
  //
  // Reason one: releasing frees the OLD instance's port and capacity slot
  // FIRST, before the acquire below ever asks for one -- a broker already
  // sitting at its instance ceiling can still serve this replacement, where
  // acquiring first could not.
  //
  // Reason two, the actual leak this closes: grantId (this proxy's own
  // module-level grant slot, declared above) is a SINGLE value --
  // adoptGrant() below simply overwrites it. Acquiring a replacement
  // without first releasing what is about to be overwritten is what
  // abandons the prior grant: the broker goes on holding an instance this
  // proxy no longer remembers asking to release, and every further
  // lost-machine event on this same session leaks one more, compounding
  // toward the instance ceiling. No new control-plane message is needed to
  // close this -- the existing release request already releases exactly
  // the grant THIS connection currently holds (no target id on the wire at
  // all), which is precisely the right one, provided it lands before the
  // slot below is overwritten.
  //
  // session.release() performs that release by closing the underlying
  // connection (a synchronous socket.destroy() under the hood -- D-12: the
  // connection IS the lease). The acquire immediately below therefore
  // finds THIS session already gone and answers "broker_gone" -- which is
  // NOT a new failure mode invented for this fix: it is handled by the
  // SAME broker-gone branch a few lines down this function already had,
  // exactly as it already handles any other dead-connection discovery. A
  // failed release introduces no new branch of its own: release() never
  // rejects (closing an already-closed socket is an idempotent no-op), and
  // even if it somehow did, the acquire that follows would classify and
  // report it exactly the same way.
  await session.release();
  grantId = null;
  const result = await session.acquire();
  if (result.ok) {
    adoptGrant({ ...result.grant });
    viceSession = null;
    ensureViceSession(); // re-baseline BEFORE returning -- see the never-cache invariant
    const newInstance = activeInstance();
    return machineReplacedMessage({
      where: "at the pre-flight liveness probe",
      reason: `the granted instance (port ${oldPort}) stopped answering -- ${probe.reason}`,
      oldPort,
      oldEpoch,
      newPort: newInstance.port,
      newEpoch: currentEpoch(),
    });
  }

  if (result.kind !== "broker_gone") {
    // Bounded: exactly one replacement attempt, and it failed for a reason
    // that has nothing to do with the connection itself -- report both
    // failures and stop.
    return replacementFailedMessage(probe, result);
  }

  // D-14: attempt 1 itself discovered the control connection is gone --
  // now the ORDINARY way this branch is reached, since the release just
  // above always closes it (T-01.6.2-90's own fix, not a regression: the
  // grant that release protects against leaking is already gone by
  // construction before this line ever runs). No release is sent over
  // `session` here, and none is needed: a release cannot be sent over a
  // connection that is already gone, and connection close IS the release
  // in this design, kernel-enforced -- the broker's own close handler has
  // already released the prior grant and killed its instance the moment
  // that close event fired, whichever branch triggered it. If the broker
  // itself died instead, there is nothing left to leak into either.
  // Attempt 2: open a GENUINELY FRESH session -- a brand-new broker.json
  // read (never the stale record the dead session above was opened
  // against), never reusing `session`. controlSession is deliberately left
  // pointing at the dead session on every failure branch below, so a LATER
  // call's own probe failure repeats this exact same from-scratch sequence.
  const opened = await openBrokerControl();
  if (!opened.ok) {
    return sessionMustRestartMessage(opened);
  }
  const freshResult = await opened.session.acquire();
  if (!freshResult.ok) {
    await opened.session.release(); // nothing to hold this connection open for
    return sessionMustRestartMessage(freshResult);
  }
  adoptGrant({ ...freshResult.grant });
  controlSession = opened.session; // the fresh session replaces the dead one, held for the rest of this proxy's life
  viceSession = null;
  ensureViceSession();
  const newInstance = activeInstance();
  return machineReplacedMessage({
    where: "after the broker connection itself was found gone and a fresh session was opened",
    reason: `the broker connection was gone (${result.message})`,
    oldPort,
    oldEpoch,
    newPort: newInstance.port,
    newEpoch: currentEpoch(),
  });
}

// ------------------------------------------------ D-16 seam hazard annotation
//
// Plan 01.3-04. Structurally the OPPOSITE of the deny-list refusal below (the
// DENY_LIST.includes(name) branch a little further into this same function):
// the refusal fires BEFORE forwarding and the call never reaches the host;
// this fires AFTER call() returns a real payload and appends to a
// SUCCESSFUL result. The call is never refused and the error flag is never
// set (D-16) -- a stopping checkpoint on an IRQ handler is core reverse-
// engineering technique that Phase 2's exhaustive trace depends on, so this
// warns instead of blocking it, the way the deny list blocks vice_disk_list
// (which has no legitimate use at all).

// The set of capability names whose OWN arguments can express an armed,
// stopping, exec checkpoint. Today that is vice_checkpoint_add alone.
// Re-enabling an already-armed stopping checkpoint via vice_checkpoint_toggle
// or a checkpoint group (vice_checkpoint_group_toggle/_add) can ALSO re-arm
// one, but neither call's own arguments carry the stop flag -- only the
// id/group being toggled -- so that re-enable path is NOT detectable from
// the call alone and is deliberately excluded from this set. That gap is
// covered by both tools' own descriptions and by vice_diagnose's checkpoint-
// trap check, and it is stated in the annotation text below rather than left
// for a reader to discover.
const CHECKPOINT_ARMING_TOOLS = new Set(["vice_checkpoint_add"]);

// Per-session suppression: an address (as rendered by formatAddress(), or an
// "unparseable:<raw>" key for an address that could not be parsed) already
// warned about this session maps to true. Cleared whenever the observed
// epoch changes -- a new machine has seen none of these. currentEpoch() is a
// synchronous LOCAL file read (see its own definition above), never a
// forwarded call, so consulting it here does not violate the "makes no
// forwarded call of its own" requirement below.
let seamHazardSeen: Set<string> = new Set();
let seamHazardEpochKey: number | null = null;

function seamHazardObserveEpoch(): void {
  const epoch = currentEpoch();
  const key = epoch && epoch.present ? epoch.epoch : null;
  if (seamHazardEpochKey !== null && key !== seamHazardEpochKey) {
    seamHazardSeen = new Set(); // a new machine has seen none of these
  }
  seamHazardEpochKey = key;
}

/** detectCheckpointArmingHazard()'s own return shape -- consumed only by
 * renderCheckpointArmingHazard() below. */
interface CheckpointArmingHazardDetection {
  addrLabel: string;
  repeat: boolean;
}

/**
 * D-16's hazard annotation. Returns the annotation text for a successful
 * checkpoint-arming call, or nothing. Returns nothing unless the capability
 * is in CHECKPOINT_ARMING_TOOLS and the arguments express an exec operation
 * with the stop flag set -- callers only reach this after a successful
 * call(), so a rejected arm never reaches here at all (a failed arm has no
 * hazard to warn about). Makes NO forwarded call of its own (T-01.3-13) --
 * the detection is entirely over the arguments the agent already supplied.
 * An unparseable address is still annotated, naming the address as unread
 * rather than silently skipping: an unparseable address is not evidence of
 * safety.
 */
function detectCheckpointArmingHazard(
  name: string,
  args: Record<string, unknown>
): CheckpointArmingHazardDetection | undefined {
  if (!CHECKPOINT_ARMING_TOOLS.has(name)) return undefined;
  // vice_checkpoint_add's own schema: `stop` defaults true, `exec` defaults
  // true -- an ABSENT field is armed, not merely "true when written out".
  const stopArmed = !(args && args.stop === false);
  const execArmed = !(args && args.exec === false);
  if (!stopArmed || !execArmed) return undefined;

  seamHazardObserveEpoch();

  const addrNum = toAddressNumber(args && args.start);
  const addrLabel =
    addrNum === null ? `an unparseable address (raw value: ${JSON.stringify(args && args.start)})` : formatAddress(addrNum);
  const suppressionKey = addrNum === null ? `unparseable:${JSON.stringify(args && args.start)}` : addrLabel;

  const repeat = seamHazardSeen.has(suppressionKey);
  if (!repeat) seamHazardSeen.add(suppressionKey);
  return { addrLabel, repeat };
}

function renderCheckpointArmingHazard(detection: CheckpointArmingHazardDetection): string {
  const { addrLabel, repeat } = detection;
  if (repeat) {
    return (
      `vice hazard (repeat): a stopping exec checkpoint was armed again at ${addrLabel} -- the full ` +
      "hazard note for this address was already issued earlier this session; see that note."
    );
  }
  return [
    `vice hazard: a stopping exec checkpoint was just armed at ${addrLabel}, and the call was NOT ` +
      "blocked -- it will not be, because this is core reverse-engineering technique.",
    "",
    "This shape -- a stopping exec checkpoint armed, then execution resumed -- is common to every recorded " +
      "freeze on this project. Two variants are on record: a mid-routine stop that froze two independent " +
      "sessions at an identical program counter, and an IRQ-handler-entry stop whose tell was a hit count " +
      "of zero on a screen the machine must have been executing.",
    "",
    "Whether THIS address is the live IRQ handler is a question vice_diagnose answers, by resolving the " +
      "vector pair live -- this warning deliberately does not resolve it here, because doing so on every " +
      "arm would disturb the machine it is protecting.",
    "",
    "Recovery, in order: run vice_diagnose first; reach for vice_recycle only when the bracket says wedge " +
      "with no checkpoint explanation.",
    "",
    "Stated residual: re-enabling this checkpoint later via vice_checkpoint_toggle or a checkpoint group " +
      "carries no stop flag in its own arguments and is therefore NOT annotated by this mechanism -- covered " +
      "by both tools' own descriptions and by vice_diagnose's checkpoint-trap check instead.",
  ].join("\n");
}

/**
 * Plan 01.3-04 task 2: turns task 1's single hazard into the general
 * mechanism D-06 needs -- a table, so the next confirmed trigger (plan
 * 01.3-05's bounded hunt) is a single entry rather than new plumbing at this
 * seam. Each entry:
 *   - id: a short identifier that MUST be named by at least one test in
 *     vice-proxy.test.mjs (this file's own structural completeness test
 *     enforces it) -- an entry that ships without a matching test fails the
 *     suite rather than shipping unproven.
 *   - capabilities: the Set of tool names this entry's own detect() can ever
 *     match against. Used ONLY by the disjointness structural test below
 *     (never for dispatch -- the walk tries every entry against every
 *     call). Every capability named here must be ABSENT from DENY_LIST: a
 *     capability with no legitimate use is refused before forwarding, and
 *     one with a legitimate use is annotated after it, and none is both
 *     (D-16).
 *   - detect(name, args, payload): returns a truthy detection payload, or
 *     nothing. MUST make no forwarded call of its own (T-01.3-13).
 *   - render(detection): returns the annotation text for a truthy
 *     detection.
 *
 * Plan 01.3-05 is this table's expected next writer, adding the bounded
 * hunt's own confirmed trigger as one more entry here -- not new plumbing.
 */
// Method-shorthand syntax deliberately (not `detect: (...) => ...`): TS's
// bivariant method-parameter check is what lets each entry's own narrower
// detect()/render() pair (e.g. CheckpointArmingHazardDetection, not
// `unknown`) slot into this shared, heterogeneous table -- exactly the
// polymorphism the table's own doc comment above describes ("the next
// confirmed trigger is a single entry"). The production entry below is cast
// `as SeamHazardEntry` (not the whole SEAM_HAZARDS declaration -- that
// exact line is vice-proxy.test.mjs's own oracle anchor, `indexOf("const
// SEAM_HAZARDS = [")`, and must stay byte-identical) so the array's own
// inferred element type is this interface, which is what lets the
// TEST-ONLY .push() below (a structurally different detect/render pair)
// type-check without a second cast at that call site.
interface SeamHazardEntry {
  id: string;
  capabilities: Set<string>;
  detect(name: string, args: Record<string, unknown>, payload?: unknown): unknown;
  render(detection: unknown): string;
}

const SEAM_HAZARDS = [
  {
    id: "checkpoint-arming",
    capabilities: CHECKPOINT_ARMING_TOOLS,
    detect: detectCheckpointArmingHazard,
    render: renderCheckpointArmingHazard,
  } as SeamHazardEntry,
];

// TEST-ONLY escape hatch (plan 01.3-04 task 2's data-driven proof): proves
// the walk below is genuinely data-driven, not hand-wired to the one
// production entry above, by injecting a SECOND entry the same way a real
// plan 01.3-05 entry would arrive. Matches against vice_ping -- an existing,
// universally-forwardable tool -- rather than inventing a synthetic
// capability name that would need its own manifest/deny-list bookkeeping.
// Never set outside this file's own test suite.
if (process.env.VICE_SEAM_HAZARDS_TEST_FIXTURE === "1") {
  SEAM_HAZARDS.push({
    id: "test-fixture-synthetic-entry",
    capabilities: new Set(["vice_ping"]),
    detect: (name: string) => (name === "vice_ping" ? { fixture: true } : undefined),
    render: () => "vice-proxy hazard (TEST FIXTURE): synthetic second SEAM_HAZARDS entry, detected and annotated through the same walk.",
  });
}

/**
 * Walks SEAM_HAZARDS, concatenating every annotation a successful call
 * attracts. Short-circuits per entry on a falsy detection -- a call matching
 * no entry costs one array pass and returns undefined, leaving the payload
 * untouched.
 */
function renderSeamHazardAnnotations(name: string, args: Record<string, unknown>, payload: unknown): string | undefined {
  const notes: string[] = [];
  for (const entry of SEAM_HAZARDS) {
    const detection = entry.detect(name, args, payload);
    if (detection) {
      notes.push(entry.render(detection));
    }
  }
  return notes.length ? notes.join("\n\n") : undefined;
}

// forwardToVice() is the retained BODY of what used to be handleToolsCall()
// -- renamed and trimmed of the name/args extraction, the three synthetic-
// tool short-circuits, and the deny-list check, all now handled one layer
// out by the CallToolRequestSchema override and the tool registry
// construction (both near the bottom of this file, right after the
// teardown region): each real manifest tool's own buildViceTool() entry
// wraps this function as its `execute`, so this is reached only for a name
// already known to be a real, non-deny-listed manifest tool with an
// already-parsed `args` object. Every function called below is reused
// completely unchanged from its pre-swap form.
async function forwardToVice(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  const leaseResult = await ensureBrokerLease();
  if (!leaseResult.ok) {
    return isErrorText(leaseResult.message);
  }
  // No touch-on-every-forwarded-call any more (C6's old mechanism, alongside
  // the heartbeat timer, both retired under D-12): the connection itself is
  // the claim, kernel-enforced, with nothing to refresh. Either the socket is
  // still open, or the broker's own "close" handler has already reclaimed
  // the instance -- there is no third, ambiguous state a touch could rescue.

  ensureViceSession();

  const beforeDrift = checkEpochAndRebaseline("before forwarding");
  if (beforeDrift) {
    // Refused BEFORE any request is serialised -- the whole point of the
    // pre-forward check.
    return isErrorText(beforeDrift);
  }

  // Pre-flight liveness probe (task 2 / criterion 7), ordered AFTER the
  // deny-list refusal and the epoch comparison above (a refused tool and a
  // restarted machine both need answering without any network activity at
  // all) and BEFORE delegating to call() -- see vice-probe.ts's header for
  // why this is a single 1500ms-budget round trip with no retry, never
  // wrapped in withReconnect()'s ladder. One call site, not inside a loop.
  const { url, port } = activeInstance();
  const probe = await probeInstance({ url, port });
  if (!probe.alive) {
    const epoch = currentEpoch();
    // D-5 (quick-260801-ccn task 3): the lease check runs FIRST, before the
    // refused-and-no-epoch test below -- under the bug this fixes, BOTH of
    // that test's arms hold true for a fresh broker grant (a just-granted
    // instance's own epoch_file rarely has a baseline recorded yet), so a
    // broker-granted instance was being answered by the RETIRED fixed-port
    // triple instead of naming the broker. That ordering was the whole
    // defect.
    if (controlSession) {
      // D-13/D-14 (plan 08): a granted instance not answering no longer
      // gets a report-and-instruct message -- it gets a replace-and-report.
      // handleGrantedInstanceUnreachable() acquires a replacement over this
      // same session (or, if the session itself turns out to be gone, a
      // genuinely fresh one) and returns an ERROR naming the replacement --
      // never a silently substituted result, even though a working
      // instance is now held for the NEXT call.
      return isErrorText(await handleGrantedInstanceUnreachable(probe, epoch));
    }
    if (isConnectionRefusedReason(probe.reason) && !epoch.present) {
      return isErrorText(neverStartedMessage(probe));
    }
    // Every other unreachable shape -- refused-with-an-epoch-on-record,
    // timed out, or something answered but didn't look like VICE -- is
    // "dead or hung"; probe.reason itself says which, verbatim.
    return isErrorText(deadOrHungMessage(probe, epoch));
  }

  // Path translation at the seam (task 3 / decision D-G / criterion 9),
  // ordered after the deny-list refusal, the epoch comparison and the
  // liveness probe above, and before delegating to call(). A refusal here
  // (out-of-workspace absolute path, or a translation failure) is returned
  // exactly like every other tools/call outcome: a well-formed isError:true
  // result, never a throw.
  let translatedArgs: Record<string, unknown>;
  let pathNote = "";
  try {
    const rewritten = rewriteArguments(args, name);
    translatedArgs = rewritten.args;
    pathNote = resolutionNote(rewritten.resolutions);
  } catch (e) {
    if (e instanceof PathOutOfWorkspaceError || e instanceof PathTranslationError) {
      return isErrorText(e.message);
    }
    throw e; // unexpected -- let the never-throw dispatch one layer up handle it
  }

  let payload: unknown;
  try {
    payload = await call(name, translatedArgs);
  } catch (e) {
    if (e instanceof MachineRestartedError) {
      // call()'s own post-reconnect fast path detected this first -- convert
      // to the same isError frame shape and re-baseline identically. Two
      // layers, one observable behaviour.
      const current = currentEpoch();
      epochBaseline = current;
      return isErrorText(
        `vice: treat every result since the previous call as void and redo that work -- the emulator was ` +
          `replaced mid-call (epoch changed from ${e.baselineEpoch} to ${e.currentEpoch}). (${e.message})`
      );
    }
    // NEVER rethrow past this point -- a tool-execution failure (transport
    // error, a rejected RPC) is a normal, expected outcome for this method
    // and must come back as a well-formed result, not crash the read loop.
    // The probe above already proved the host alive, so this is the "alive
    // but the operation failed" state -- relay verbatim, no restart advice.
    // The path note rides along on the FAILURE too, and this is the case it
    // was written for: a host-side "Failed to attach disk image" says nothing
    // about which file was attempted, so naming the resolved absolute path
    // here is the difference between a one-line fix and an hour spent
    // suspecting the emulator.
    const failure = aliveButFailedMessage(e && (e as Error).message ? (e as Error).message : String(e));
    return isErrorText(pathNote ? `${failure}\n${pathNote}` : failure);
  }

  const afterDrift = checkEpochAndRebaseline("after the call returned");
  if (afterDrift) {
    // A payload read from a machine whose identity changed mid-call is not
    // trustworthy -- return the restart frame INSTEAD OF the call's result.
    return isErrorText(afterDrift);
  }

  const rawText = typeof payload === "string" ? payload : JSON.stringify(payload);
  // D-16 seam hazard annotation (plan 01.3-04): computed by walking
  // SEAM_HAZARDS and merged into the TEXT itself, BEFORE wrapPossiblyChunked()
  // runs, so an oversized annotated result still carries the note inside its
  // own chunking (T-01.3-15) -- a warning appended AFTER chunking would be
  // lost off the end. Never routes through isErrorText and never touches the
  // error flag (D-16, T-01.3-12).
  const hazardNote = renderSeamHazardAnnotations(name, args, payload);
  const text = hazardNote ? `${rawText}\n\n${hazardNote}` : rawText;
  const wrapped = wrapPossiblyChunked(text);
  // Append the path note as a trailing content item, never mixed into the
  // payload: wrapPossiblyChunked()'s contract is that the FIRST item is the
  // payload byte-for-byte, so reassembly stays a plain concatenation. Only
  // the unchunked shape is annotated -- a chunked result is already carrying
  // a continuation marker as its second item, and the four tools that can
  // resolve a path (disk_attach, autostart, display_screenshot, symbols_load)
  // never produce output anywhere near the cap.
  if (pathNote && wrapped.content.length === 1) {
    wrapped.content.push({ type: "text", text: pathNote });
  }
  return wrapped;
}

// -------------------------------------------------------------- teardown
//
// TWO ladders, not one, firing DIFFERENT handlers (spike-findings-bruce-lee
// skill, shutdown-and-lease-release.md -- measured, not assumed): a
// graceful client ending delivers SIGINT first, then SIGTERM ~100ms later,
// then SIGKILL at ~490ms total, and NEVER closes stdin. Abrupt client death
// closes stdin (`end` then `close`) and NEVER signals. Each family covers
// exactly the ending the other misses, so both are wired below; SIGINT is a
// teardown trigger here, not a user Ctrl-C to ignore -- it is the FIRST
// signal of every graceful ending.
//
// The measured numbers this depends on: ~490ms from the first signal to
// SIGKILL, on the order of microseconds for closing a socket handle --
// roughly as many orders of magnitude of headroom as the retiring lease
// file's own unlinkSync had. The entire handler body below calls exactly
// one release and AWAITS NOTHING (C5): introducing anything that blocks on
// a response here (an await, a fetch, a child process, a round trip to the
// broker) reintroduces leaked leases silently, since there would be no time
// left for it to complete before SIGKILL cuts the process off. Plan
// 01.6.2-07: the lease is now the control connection itself, so "release"
// is `socket.destroy()` -- a synchronous, in-process handle close, not a
// network round trip; nothing here waits for the broker to acknowledge
// anything, matching the retiring unlinkSync's own fire-and-forget shape.
// BrokerControlSession.release() is declared `async` (vice-broker-client.ts),
// so a synchronous throw inside it becomes a REJECTED PROMISE, not a thrown
// exception -- a plain try/catch around a bare, unawaited call would never
// see it. `.catch(...)` (not `await`, not `.then(`) is the correct way to
// observe that failure without awaiting or chaining a success handler,
// and is not itself a promise-awaiting construct: nothing in this region
// blocks on the release settling before returning.
//
// This removes the file's only explicit process.exit( call: nothing needs
// it any more. The graceful path is killed by SIGKILL ~490ms after the
// first signal regardless of anything this process does, and the abrupt
// path exits naturally once stdin is gone and nothing else is listening.
//
// TEARDOWN-REGION-BEGIN -- vice-proxy.test.mjs's source assertion slices
// the file between this marker and its closing counterpart further below,
// and asserts that slice contains no promise-awaiting construct and calls
// the control session's release function exactly once. Do not move either
// marker away from the code each one bounds.
let teardownRan = false;

function releaseLeaseNow(trigger: string): void {
  if (!controlSession) return;
  controlSession.release().catch((err: unknown) => {
    console.error(`vice-proxy: lease_release_failed trigger=${trigger}: ${err && (err as Error).message ? (err as Error).message : err}`);
  });
}

function onTeardown(trigger: string): void {
  if (teardownRan) return; // idempotent -- SIGINT then SIGTERM ~100ms later both call in
  teardownRan = true;
  releaseLeaseNow(trigger);
}

process.stdin.on("end", () => onTeardown("stdin_end"));
process.stdin.on("close", () => onTeardown("stdin_close"));
// Registered as three explicit calls, not a loop over an array, so a
// durable source-grep for "is SIGINT/SIGTERM/SIGHUP each really wired"
// (this task's own acceptance criteria) has a literal string to find for
// each one -- SIGINT first, since it is the first signal of every graceful
// ending and must never be mistaken for a plain user Ctrl-C to ignore.
process.on("SIGINT", () => onTeardown("SIGINT"));
process.on("SIGTERM", () => onTeardown("SIGTERM"));
process.on("SIGHUP", () => onTeardown("SIGHUP"));
// TEARDOWN-REGION-END

warnOnceAboutOutputLimit(); // D-1.2-H -- one stderr line, at most once per process, never a refusal

// ------------------------------------------------------- @mastra/mcp seam
//
// D-01 (this plan): the wire layer is now MCPServer + startStdio(), with
// broker leasing, epoch, probe, path rewriting, call() and chunking all
// reused completely unchanged inside forwardToVice() above -- only the
// top-level caller changed. See this plan's PLAN.md "Ground truth" section
// (read directly from @mastra/mcp's compiled source, not its docs) for why
// tools/call is answered by the CallToolRequestSchema override below rather
// than by MCPServer's own dispatch.

/**
 * Adapts a manifest tool's raw JSON Schema into the minimal
 * StandardSchemaWithJSON shape createTool() requires, matching TODAY's
 * zero-validation-at-the-proxy behaviour exactly: `~standard.validate`
 * always succeeds (this proxy has never validated argument shape itself --
 * the host does), and `~standard.jsonSchema.input()`/`.output()` both
 * return the SAME schema object verbatim regardless of `target`/`io`, so
 * tools/list's wire output stays byte-identical to the manifest's own raw
 * schema (proven by a deep-equal assertion in vice-proxy.test.ts, not
 * assumed from either library's documentation).
 */
function rawJsonSchemaAsStandardSchema(schema: unknown): StandardSchemaWithJSON {
  const jsonSchema = isPlainObject(schema) ? schema : { type: "object", properties: {} };
  return {
    "~standard": {
      version: 1,
      vendor: "vice-proxy",
      validate: (value: unknown) => ({ value }),
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
    },
  };
}

/** Turns a `ToolCallResult` (this file's own internal `{content, isError}`
 * shape) into the SDK's `CallToolResult` wire shape -- a direct, lossless
 * pass-through, since the two shapes are structurally identical. The whole
 * point of the CallToolRequestSchema override below building the response
 * itself is that no translation or mangling happens here. */
function toolCallResultToWire(result: ToolCallResult): { content: ToolCallResult["content"]; isError: boolean } {
  return { content: result.content, isError: result.isError };
}

/** Narrows an `unknown` execute() return value to this file's own
 * ToolCallResult shape before trusting it. Every tool this file registers
 * is one this file itself wrote (buildViceTool()'s own `run` callbacks
 * always return this shape), but the override still checks rather than
 * casting blind, matching this file's own isPlainObject() discipline. */
function isToolCallResult(value: unknown): value is ToolCallResult {
  return isPlainObject(value) && Array.isArray(value.content) && typeof value.isError === "boolean";
}

/**
 * Wraps a ToolDefinition (a manifest tool, or one of this file's own three
 * proxy-local synthetic tools) plus its own runner into a Mastra Tool via
 * createTool(), reproducing exactly the `_meta` merge handleToolsList() used
 * to perform at read time (now construction-time, see the registry below).
 */
function buildViceTool(def: ToolDefinition, run: (args: Record<string, unknown>) => Promise<ToolCallResult>) {
  return createTool({
    id: def.name,
    description: def.description ?? "",
    inputSchema: rawJsonSchemaAsStandardSchema(def.inputSchema),
    mcp: {
      _meta: {
        ...((def._meta as Record<string, unknown> | undefined) || {}),
        "anthropic/maxResultSizeChars": OUTPUT_CHAR_CAP,
      },
    },
    execute: async (inputData) => run(isPlainObject(inputData) ? inputData : {}),
  });
}

// Plan 01.6.3-02's tracer proved this mechanism on `vice_ping` alone
// (TRACER_MANIFEST_TOOL_NAMES, since removed). Plan 01.6.3-03 widens the
// input set to the FULL manifest -- the loop body itself is unchanged from
// the tracer: no per-tool special case, only the same DENY_LIST filter
// already proven in Plan 02. The manifest also lists the host's own
// generic-surface meta-tools (`tools_call`/`tools_list`/`initialize`/
// `notifications_initialized`) as ordinary tools; 01.6.3-03 registered them
// like any other manifest entry (a real, disclosed generic-dispatch risk it
// did not itself widen -- see the CallToolRequestSchema override below for
// the historical shape of that risk), and 01.4-01 (tasks 1+2) closed it by
// adding all four to DENY_LIST itself, so this SAME skip now filters them
// out of `tools` at construction time exactly like vice_disk_list always
// was.
//
// Construction-time, not read-time -- a deliberate, disclosed narrowing this
// plan records explicitly: tools/list is now served entirely by MCPServer's
// own ListToolsRequestSchema handler (unmodified, not overridden), reading
// from this SAME `tools` object, so vice_disk_list's absence from it is the
// ONLY enforcement discovery-time needs any more -- no separate filter
// function runs at read time. A manifest hot-reload mid-session is
// therefore no longer picked up until the proxy restarts; the manifest is
// regenerated by a manual, rare build step, never mid-session in practice.
const tools: Record<string, ReturnType<typeof buildViceTool>> = {};
for (const def of readManifestTools()) {
  if (DENY_LIST.includes(def.name)) continue;
  tools[def.name] = buildViceTool(def, (args) => forwardToVice(def.name, args));
}
tools[RESULT_CONTINUE_TOOL.name] = buildViceTool(RESULT_CONTINUE_TOOL, (args) => Promise.resolve(handleResultContinue(args)));
tools[RECYCLE_TOOL.name] = buildViceTool(RECYCLE_TOOL, (args) => handleRecycle(args));
tools[DIAGNOSE_TOOL.name] = buildViceTool(DIAGNOSE_TOOL, (args) => handleDiagnose(args));

const server = new MCPServer({ name: "vice", version: PROXY_VERSION, tools });
await server.startStdio();
// Installed with ZERO await between this line and the one above (see this
// plan's "Ground truth" section for why that ordering is load-bearing --
// StdioServerTransport.start() has already wired its 'data' listener by the
// time startStdio()'s promise resolves, but Node does not deliver a queued
// 'data' event until the next event-loop turn): MCPServer's own tools/call
// dispatch always forces isError:false on success and prepends "Error: " on
// a thrown failure (read directly from @mastra/mcp's compiled source this
// session, not its docs), which matches neither this file's own
// {content, isError} contract nor the deny-list's exact refusal wording a
// pre-existing test pins verbatim -- so tools/call is answered entirely by
// this override, never by MCPServer's own handler. tools/list is NOT
// overridden -- MCPServer's own ListToolsRequestSchema handler answers it,
// the one piece of genuine library value this swap adopts.
server.getServer().setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  // Layer 1 (unchanged mechanism, now here instead of the retired
  // handleToolsCall()): call-time deny-list refusal, before any tool lookup
  // and before any network attempt -- independent from `tools`'s own
  // construction-time absence of vice_disk_list (layer 2, the
  // discovery-time enforcement tools/list reads from). Removing either
  // layer leaves the other standing.
  if (DENY_LIST.includes(name)) {
    return {
      content: [{ type: "text", text: denyListRefusalMessage(name) }],
      isError: true,
    };
  }
  // CLOSED BY 01.4-01 (tasks 1+2), closing Phase 01.4 criterion 3's
  // already-recorded open breach concern. This check inspects only the
  // OUTER `name` -- the literal MCP tool being called -- and always has;
  // that outer-name-only shape is unchanged by this fix and is NOT itself
  // the hazard. The hazard was that the manifest also lists the host's own
  // generic-surface meta-tools (`tools_call`/`tools_list`/`initialize`/
  // `notifications_initialized`) as ordinary forwardable tools, and
  // `tools_call` specifically could carry a forbidden name (e.g.
  // `vice_disk_list`) as a NESTED `arguments.name`, bypassing this exact
  // guard by never presenting the forbidden name as the OUTER one. All four
  // meta-tool names are now themselves on DENY_LIST (task 1 added
  // `tools_list`; task 2 added `tools_call`, `initialize` and
  // `notifications_initialized` after confirming, via a repo-wide grep, that
  // none has a sanctioned caller): `tools_call` itself is refused before its
  // own nested argument is ever read, closing the bypass without teaching
  // this guard to parse nested argument shapes -- one array, no new
  // mechanism, exactly 01.4-RESEARCH.md's own Pattern 1 and primary
  // recommendation. The historical bypass-proving test in
  // vice-proxy.test.ts is repointed (not deleted) to assert this closure.
  // Full history in 01.6.3-03-SUMMARY.md and
  // .planning/todos/pending/2026-08-05-generic-surface-deny-list-gap-tools-call-nested-vice-disk-list.md.
  const tool = tools[name];
  if (!tool || !tool.execute) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
  try {
    const raw = await tool.execute(request.params.arguments ?? {}, { observe: noopObserve });
    if (!isToolCallResult(raw)) {
      return {
        content: [
          { type: "text", text: `vice: internal error -- tool "${name}"'s execute() returned an unexpected shape` },
        ],
        isError: true,
      };
    }
    return toolCallResultToWire(raw);
  } catch (e) {
    // The never-throw discipline this file already lives by (matching the
    // retired handleToolsCall()'s own "NEVER rethrow past this point"
    // comment) -- forwardToVice() and the synthetic-tool handlers should
    // never actually throw in normal operation, but this override must not
    // depend on that being true.
    return { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true };
  }
});

console.error(`vice-proxy: ready, forwarding to ${activeInstance().url} (port ${activeInstance().port})`);
