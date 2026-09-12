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
//        (`stockDispatch.dispatchStock(def.name, args, ...)` as of the
//        fork-backend removal -- UNCHANGED by this rollback either way, it
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
// The lease-state accessors and shared error hierarchy (used by BOTH
// backends, since buildHeldLease() reads activeInstance() on every stock
// tool call too) live in vice-errors.ts. The fork's own HTTP/JSON-RPC
// transport module (its outer-name refusal array, the session-identity
// apparatus, `call()`/`callTool`, `serverInfo()`) is gone entirely: every
// remaining tool dispatch in this file goes through stockDispatch, never
// through a fork transport.
import { activeInstance, useInstance, mcpHost, type ActiveInstance, type ToolInfo } from "./vice-errors.ts";
import { repoRoot, toolsDir } from "./repo-root.ts";
// The single version-resolution seam (quick-260819-tsz, D-5) -- PROXY_VERSION
// below is the only consumer in this file; see version.ts's own header for
// why this file must never re-derive any part of the algorithm itself.
import { runtimeVersion } from "./version.ts";
import { hostPath, SET_ENV_HINT } from "./hostpath.ts";
// The INVERSE direction (host -> container), for inverting a broker grant's
// own host-local coordinates before useInstance() ever adopts them (this
// task, quick-260801-ccn). Consuming this from the proxy -- rather than
// hand-translating a host path here -- is what keeps the host-path consumer
// set closed to a fixed, traced list of exactly four production modules
// (containerpath.ts, install-resources.ts, stock-paths.ts, vice-proxy.ts),
// pinned by hostpath-consumers.test.ts.
import { containerizeRecord } from "./containerpath.ts";
// The container-side half of the on-demand broker protocol (Phase 01.2).
// This module deliberately does NOT import hostpath.mjs itself -- the
// host-path consumer set stays closed to exactly four production modules
// (containerpath.ts, install-resources.ts, stock-paths.ts, vice-proxy.ts),
// pinned by hostpath-consumers.test.ts, and this file is
// already on that list, so any broker-related host path text is built HERE.
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
// RECYCLE_TIMEOUT_MS is no longer imported here: the fork-only generic
// forwarding function and its own wedge-evidence gatherer that used it for
// their post-kill epoch/readiness poll are deleted -- vice_recycle's
// stock implementation (stock-recycle.ts, reached via stockDispatch) owns
// that timeout itself now. The incident-record import (writeIncidentRecord,
// finaliseIncidentRecord, incidentAssetPath, incidentAssetStem,
// IncidentEvidence, IncidentAssetStemOptions) is gone for the same reason:
// its only caller was the fork-only handleRecycle() body that wrote a
// pre-kill incident record over call() -- stock-recycle.ts's own
// handleRecycleStock() does this natively now, never through this file.
import {
  readBrokerLiveness,
  brokerRootDir,
  openBrokerControl,
  type BrokerLivenessResult,
  type BrokerControlSession,
  type ControlFailureKind,
  type HeldLease,
} from "./vice-broker-client.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
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
// Plan 02-10: this file's own backend-detection and stock-dispatch consumer
// edits. Both are namespace imports, deliberately -- keeps every reference to
// their exported members's names down to the ONE call site each below (this
// file's own grep-gated single-occurrence acceptance criteria), rather than a
// named import whose binding is textually repeated at both the import line
// and every call site.
import * as backendDetect from "./backend-detect.mts";
import * as stockDispatch from "./stock-dispatch.ts";
// The single per-backend capability lookup (BACK-05), consumed only inside
// the CallToolRequestSchema override's tools[name] miss branch below.
import { capabilityRefusalMessage } from "./capability-registry.ts";
// Plan 29-01: the curated anno_* tool surface's DEFINITIONS, imported
// STATICALLY -- registration below happens synchronously at module scope, so
// a dynamic import cannot serve it. This costs nothing at module load: no
// store file is opened here. The owned SQLite annotation store stays behind
// anno-tools.ts's own runAnnoTool(), which opens it, answers exactly one call
// against it and closes it again (D-06), reached only when a tool is called.
import { ANNO_TOOL_DEFINITIONS, runAnnoTool } from "./anno-tools.ts";

// ------------------------------------------------------------ anno subcommand
//
// D-06 / RESEARCH.md Open Question #1 (plan 10-04): `vice-mcp anno <verb>` is
// the ONLY surface that resolves identically across the Claude Code plugin
// route and both npm-installer routes -- `installer/bin/cli.mjs`'s
// `viceServerEntry()` always launches this server via `npx` in BOTH
// npm-installer modes (`--vendor` only pre-resolves the package; it never
// places `src/mcp/vice/*.ts` as plain files inside a consuming project),
// so any design resolving a filesystem path to the seam would silently fail
// to resolve for npm-installed users. This bin is the one surface proven to
// work in all three routes.
//
// This branch runs as the first executable statement of the module body,
// deliberately ABOVE `RESOLVED_BINARY`'s own path resolution (which stats the
// binary), above the manifest read, and above
// `new MCPServer(...)`/`server.startStdio()` far below -- a CLI invocation
// must never open a socket, never touch a binary's filesystem identity, and
// never write a byte of JSON-RPC to stdout. WHAT NOT TO DO: never let this branch fall through
// into the server path, and never print anything on stdout on the server
// path that a CLI caller could confuse for `anno` output.
//
// Ending the process here is deliberate and is NOT a violation of this
// file's standing "never end the process from a teardown handler" rule (see
// that handler's own comment further down): that rule protects the
// long-lived server's lease-release path, and this branch ends the process
// before any lease, socket or handler exists. A dynamic import is used
// (not a static one) so the CLI module is not part of the server's startup
// cost on the normal, non-`anno` path.
//
// IN-01 (10-REVIEW.md; 11.1-CONTEXT.md AUDIT-01, D-11.1-04): `console.log`/
// `console.error` writes to `process.stdout`/`process.stderr` are
// ASYNCHRONOUS on POSIX once the fd is a pipe (Node opens pipe/socket fds
// non-blocking, unlike a TTY or a regular file), so a bare `process.exit()`
// immediately after can discard whatever write has not yet drained --
// measured at a 128 KiB truncation point on this host's Node for a single
// write exceeding the OS pipe's capacity. The trigger this was FOUND
// through -- a CLI verb that echoed a spawned child's whole stderr -- was
// withdrawn with the analyser it spawned (plan 29-07, D-14), but the hazard
// is a property of the exit path rather than of that verb: any verb that
// prints a diagnostic larger than the pipe's capacity hits it, and the one
// case where the user most needs the diagnostic is exactly the case a piped
// invocation could silently lose it in. `drainStdio()` below explicitly
// awaits both streams' own pending writes (a `write("", cb)`-style
// zero-length write's callback fires only once every prior queued write has
// actually flushed) before the terminating `process.exit(code)`.
//
// T-11.1-EXITHANG: the drain is BOUNDED to `ANNO_CLI_DRAIN_TIMEOUT_MS`. An
// exit that hangs forever waiting on a pipe nobody reads is worse than a
// truncated diagnostic -- this project's standing rule is that a teardown
// path never becomes a hang (see the "never end the process from a teardown
// handler" comment above; a BOUNDED drain here does not violate that rule
// for the same reason the original unbounded `process.exit()` did not: this
// still runs before any lease, socket or handler exists, and now also can
// never block indefinitely).
const ANNO_CLI_DRAIN_TIMEOUT_MS = 300;

/** Resolves once `stream`'s own pending writes have flushed, or after
 * `timeoutMs`, whichever comes first. A zero-length `write("", cb)`'s
 * callback fires strictly after every write queued ahead of it on the same
 * stream has completed -- so this is a genuine drain barrier, not a fixed
 * sleep. Guarded so a stream that is not writable (already closed/ended,
 * e.g. under `> /dev/null` teardown races) resolves immediately rather than
 * calling `write()` on it. */
function drainStdio(stream: NodeJS.WriteStream): Promise<void> {
  return new Promise((resolve) => {
    if (!stream.writable) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ANNO_CLI_DRAIN_TIMEOUT_MS);
    stream.write("", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

if (process.argv[2] === "anno") {
  // A broken pipe (the reader closing early, e.g. `| head`) makes
  // `stream.write()` fail with EPIPE. Awaiting `drainStdio()` below gives
  // that failure the chance to actually surface as Node's stream 'error'
  // event -- which throws UNCAUGHT and crashes the process if nothing is
  // listening, converting what used to be a silent (bare `process.exit()`
  // outran the async error) success into a stack-trace crash. This
  // mirrors the SAME EPIPE class this file already guards against for the
  // server path further down (see that handler's own
  // modelcontextprotocol/typescript-sdk#1564 citation) -- registered here
  // too because this branch exits long before reaching that one.
  process.stdout.on("error", () => {});
  process.stderr.on("error", () => {});

  // Test-only escape hatch, never documented to end users and inert unless
  // this exact env var is set: writes a deterministic filler payload
  // through this SAME drained-exit path, so vice-proxy.test.ts can measure
  // an exact byte count well above any OS pipe capacity without needing any
  // real project file at all. That independence is the point: measured at
  // the time, neither `--help`'s ~5.6 KB USAGE text nor a synthesized or
  // garbage project file fed to a verb's error path scaled anywhere near
  // 128 KiB on this host, so no real invocation could reach the truncation
  // point on demand (see 11.1-05-SUMMARY.md for those measurements). The
  // hatch outlives the routes it was measured against, because it depends on
  // none of them. Never reachable
  // from a real `anno <verb>` invocation: the check is against a specific,
  // unambiguous env var name no real caller would ever set.
  const testFillBytes = process.env.VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES;
  if (testFillBytes) {
    process.stdout.write("x".repeat(Number(testFillBytes)));
    await Promise.all([drainStdio(process.stdout), drainStdio(process.stderr)]);
    process.exit(0);
  }

  const { runAnnoCli } = await import("./anno-cli.ts");
  const code = await runAnnoCli(process.argv.slice(3));
  await Promise.all([drainStdio(process.stdout), drainStdio(process.stderr)]);
  process.exit(code);
}

const HERE_DIR = dirname(fileURLToPath(import.meta.url));

// FORKRM-01 (plan 52-06): there is one backend now, so there is nothing left
// to select between here -- this used to settle a backend verdict constant
// once, at module scope, for the manifest selection, the tools construction
// loop's dispatch choice, the final ready log line, and a cross-check
// against the broker's own verdict. All four backend-conditional call sites
// now pass the literal `"stock"` directly; the only thing still resolved
// here is the binary's own PATH, kept under a narrowly-named constant
// instead of a backend-shaped object.
//
// `RESOLVED_BINARY.binPath` is what `vice_ping`'s `resolvedBinaryPath` field
// reports (see stock-dispatch.ts's `handlePing()`). It is resolved exactly
// ONCE here, at MCP-server process startup, by a bare `x64sc` `$PATH` probe
// run in THIS process's own environment -- it is NOT re-probed per request
// and has no connection to the broker, a separate, already-running process
// that leases whichever instance it chose to whatever request comes in. On a
// host where bare `x64sc` resolves to one build, `resolvedBinaryPath` reports
// that build's path on every ping, even when the broker actually launched
// (or later recycled to) a different one. The authoritative per-instance
// answer lives in the broker's own launch record (`epoch.json`'s `vice_bin`
// field, written by `broker-epoch.mts`) -- Phase 8.2 plan 04's own
// walkthrough had to route around this field entirely and prove backend
// identity from that launch record plus a live `ps -o args=` read instead
// (2026-08-19 finding, closed as a documentation fix by Phase 15 plan 15-09
// rather than a per-request requery, which would be a behavioural change out
// of a disposition phase's remit).
const RESOLVED_BINARY = backendDetect.resolvedBackend();

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
// There are TWO correct exit paths, not one (spike-findings
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
// no longer survives as a hand-edited literal (quick-260819-tsz, D-4/D-5):
// it used to say "0.1.0" while npm's actual `latest` was twelve patches
// ahead, because nothing updated it. It is now derived through
// `runtimeVersion()` (the ONE seam, `./version.ts`), which reads this
// package's own `package.json` first (the published-tarball path, where
// `npm version` already stamped a real number) and falls back to the
// repo-root `VERSION` template -- rendered as `<resolved>-dev` -- only in a
// git checkout, degrading to `0.0.0-dev` if neither is available. Reused,
// unchanged, as MCPServer's own `version` field below.
const PROXY_VERSION = runtimeVersion({
  pkgJsonPath: join(HERE_DIR, "package.json"),
  repoRoot: () => repoRoot(),
});

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
// spike-findings skill, large-response-chunking.md -- about half
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

// Edit 1 (plan 02-10): delegates to stock-dispatch.ts's own selector function
// -- the ONE manifest site this file keeps. FORKRM-01: always resolves the
// stock manifest now, since there is nothing else to select between; the
// existing malformed-manifest fallbacks in readManifestTools() below are
// untouched: a missing or unreadable stock manifest still answers tools/list
// with an empty array rather than crashing the server.
function manifestPath(): string {
  return stockDispatch.manifestPathForBackend("stock", HERE_DIR, process.env.VICE_TOOLS_MANIFEST);
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
// Every advertised tool dispatches through stockDispatch.dispatchStock(),
// which owns its own reconnect and epoch-drift handling (stock-connect.ts).
// This proxy layer performs no per-call epoch re-check of its own -- the
// generic forwarding function that once needed one here is gone. Malformed
// `tools/call` params (a missing/non-string `name`) are rejected one layer
// further out, by the SDK's own `CallToolRequestSchema` zod validation
// (installed at the construction site near the bottom of this file).
//
// NEVER-CACHE-A-NEGATIVE-RESULT INVARIANT (plan 01.1-03 task 1, criterion 6;
// extended to the broker path by plan 01.2-03 task 1, C11): nothing below
// this line may memoise "the broker is absent" as a fact that outlives a
// single tools/call. There is no cached probe verdict, no sticky "last known
// unreachable" flag, and no early-return short-circuit keyed off a PREVIOUS
// failure -- ensureBrokerLease()'s readBrokerLiveness() call reads
// broker.json fresh every time it is reached, never memoised at module
// scope. This is deliberate and easy to break by a later, performance-minded
// edit ("let's remember the broker was absent last call so we don't bother
// checking again") -- don't. A cached negative here is exactly the "quiet
// wrong answer" failure class this codebase rejects elsewhere
// (MachineRestartedError): the call after a human starts the broker must
// just work, with no session restart required.

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

// -------------------------------------------------------- dispatchStockFor
//
// The one place every stock tool call's shared deps object is built -- used
// by the manifest loop below and by handleRecycle()/handleDiagnose() alike,
// so there is exactly one definition of "what dispatchStock needs" rather
// than three copies that could drift apart. Kept as a single-line-callable
// helper (not inlined at each call site) so every registration reads as one
// source line -- vice-proxy.test.ts's own registration scanner keys each
// `tools[...] = ...;` line by its raw captured text and expects one
// registration per line.
function dispatchStockFor(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  return stockDispatch.dispatchStock(name, args, {
    ensureLease: ensureBrokerLease,
    resolvedBinaryPath: RESOLVED_BINARY.binPath,
    resolvedBinaryPathIsResolved: RESOLVED_BINARY.binPathResolved,
  });
}

// ------------------------------------------------------------ vice_recycle
//
// vice_recycle and vice_diagnose (below) are registered as this file's own
// proxy-local synthetic tools (RECYCLE_TOOL/DIAGNOSE_TOOL above). Before
// plan 52-04, each ALSO carried its own fork-only implementation here --
// evidence gathered over call()'s HTTP transport, its own incident-record
// writes -- reachable only on the (now-deleted) fork backend. The
// (already-active) stock arm never ran that body at all: it dispatched
// straight through stockDispatch.dispatchStock() to handleRecycleStock()/
// handleDiagnoseStock() (stock-recycle.ts/stock-diagnose.ts), which own a
// complete stock-native evidence gatherer and incident-record write of
// their own (built for exactly this reason -- see stock-recycle.ts's own
// header). That fork-only body is deleted, not merely emptied:
// handleRecycle()/handleDiagnose() SURVIVE as named functions --
// RECYCLE_TOOL/DIAGNOSE_TOOL's own registration still wires them in by name
// (a structural oracle in vice-proxy.test.ts asserts handleRecycle's own
// declaration form) -- but their bodies now do exactly what the stock arm
// already did, unconditionally, rather than re-deriving a second copy of
// stock-recycle.ts/stock-diagnose.ts's own logic here.
const handleRecycle: (args: Record<string, unknown>) => Promise<ToolCallResult> = async function handleRecycle(args) {
  return dispatchStockFor(RECYCLE_TOOL.name, args);
}

// ----------------------------------------------------------- vice_diagnose
//
// See vice_recycle's own header comment immediately above: handleDiagnose()
// SURVIVES as a named function (DIAGNOSE_TOOL's own registration still wires
// it in by name) but its fork-only evidence-gathering body (the epoch/
// checkpoint-trap/cycle-bracket walk, all reached over call()'s HTTP
// transport) is deleted. The stock arm never ran that body -- it already
// dispatched straight through stockDispatch.dispatchStock() to
// handleDiagnoseStock() (stock-diagnose.ts), which owns a complete
// stock-native five-verdict diagnosis of its own. This is that delegation
// made unconditional, rather than a second copy of stock-diagnose.ts's own
// logic living here.
async function handleDiagnose(args: Record<string, unknown>): Promise<ToolCallResult> {
  return dispatchStockFor(DIAGNOSE_TOOL.name, args);
}

// --------------------------------------------------- unreachable diagnostics
//
// ONLY_ROUTE_NOTE and brokerHostPath() below are the shared vocabulary the
// broker-absent diagnostics family (immediately below) uses to name the one
// route back to a working emulator. The host-unreachable triple that used
// to live in this section (never-started/dead-or-hung/alive-but-failed,
// classifying a failed pre-flight liveness check over the fork's own HTTP
// transport) is deleted along with the fork-only generic forwarding
// function and its liveness-probe module: stock has no equivalent
// probe-then-classify step of its own, and stockDispatch's own
// session/lease handling reports unreachability through its own vocabulary
// instead.
//
// This MCP tool surface is the only route to the emulator -- never named
// together with a CLI verb here, since plan 01.1-04 installs a durable gate
// matching exactly that pattern in documentation.
const ONLY_ROUTE_NOTE =
  "This MCP tool surface is the only route to the emulator. The correct action is to stop and ask " +
  "the human to start it on the host -- falling back to a direct shell invocation of the underlying " +
  "transport is not an available workaround.";

/** The absolute path of the command a human should run on the HOST to
 * start/restart access to the emulator -- computed via hostPath() over the
 * deployed launcher's container path, degrading to the container path plus
 * SET_ENV_HINT exactly as install-resources.ts's hostLaunchInstructions()
 * does, so a translation failure still yields something to act on rather
 * than an empty message. Recomputed fresh every call -- never cached (see
 * the never-cache-a-negative-result invariant above, near tools/call).
 * Points at resources/vice-launcher.sh's deployed copy -- the one surviving
 * host script (01.6.2-09). Every message in this file that used to name
 * either the retiring per-instance supervisor (vice-supervisor.sh) or the
 * retiring bash broker (vice-broker.sh) now names THIS launcher instead: its
 * own broker performs both the acquire-on-demand job the bash broker did and
 * the launch/supervise/respawn-with-backoff job the bash supervisor did. */
function brokerHostPath(): string {
  const root = repoRoot();
  // Moved 2026-09-08 (D-33): was join(root, "tools", "vice-launcher.sh"),
  // matching installTargetDir()'s pre-consolidation value. Now derived from
  // repo-root.ts's own toolsDir() -- this module is container-side, unlike
  // install-resources.ts, so it CAN import that resolver directly rather
  // than joining the literal a second time -- matching installTargetDir()'s
  // new `<root>/.c64-re-tools/bin` value exactly.
  const target = join(toolsDir(), "bin", "vice-launcher.sh");
  try {
    return hostPath(target, { workspaceRoot: root });
  } catch {
    return `${target}\n  (host path could not be determined -- ${SET_ENV_HINT})`;
  }
}

// ------------------------------------------------- broker-absent diagnostics
//
// Plan 01.2-03 task 1 / must_have C10. A missing broker answers exactly one
// generic message two times out of three sends the reader to the wrong fix.
// Every message here quotes brokerHostPath() (an absolute HOST path,
// recomputed fresh -- see that function's own comment) and the single
// shared ONLY_ROUTE_NOTE definition; no message below writes its own second
// only-route sentence.

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
 * thing a human does on the host. */
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
 * instruction: restarting something that is answering correctly is the
 * wrong fix. Still names an absolute path (the running broker's own
 * launcher, purely as a reference) and the only-route sentence, both
 * required of every broker-absent-adjacent message this proxy emits. */
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
 * launch plus boot plus readiness is seconds (spike-findings
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

// broker-granted unreachable diagnostics: GONE, not merely unused.
// handleGrantedInstanceUnreachable() and its three message builders
// (machineReplacedMessage()/replacementFailedMessage()/
// sessionMustRestartMessage()) existed to replace-and-report when a granted
// instance stopped answering the fork-only generic forwarding function's own
// pre-flight liveness check -- their only caller. Deleted along with that
// forwarding function; stock has no equivalent probe-then-replace step at
// this proxy layer, and a dead lease surfaces through stockDispatch's own
// error handling instead.

// ------------------------------------------------------------ path rewriting
//
// isInsideWorkspace() below is the ONE survivor of what used to be a larger
// container->host path-translation seam here (decision D-G, plan 01.1-03
// task 3): the per-call argument path-rewriter and its recursive value
// walker, along with their own refusal classes
// (PathOutOfWorkspaceError/PathTranslationError), were the fork-only
// per-forwarded-call rewriter the fork-only generic forwarding function ran
// before delegating to the fork transport's own dispatch call -- deleted
// along with it. isInsideWorkspace() itself SURVIVES
// because it has a second, backend-agnostic consumer: containerizeGrant()
// (further down this file) re-checks a broker grant's translated
// epoch_file/supervisor_dir fields against the workspace boundary before
// trusting them. Stock's OWN emulator-side path translation
// (stock-paths.ts's withEmulatorSidePath()/STOCK_EMULATOR_SIDE_PATH_TOOLS)
// is a separate, still-untouched mechanism -- see that file's own header.
//
// STATED RESIDUAL, unchanged from before this deletion: this check is
// lexical, not physical -- a symlink inside the workspace whose target lives
// outside it still translates. realpathSync() would catch that but requires
// the file to already exist, which is wrong for the write-side tools
// (snapshot_save and friends name a path that does not exist yet). Lexical
// normalization is the part that can be enforced for both directions
// without breaking writes.
function isInsideWorkspace(absPath: string, root: string): boolean {
  return absPath === root || absPath.startsWith(root.endsWith("/") ? root : root + "/");
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
// is eager, acquisition must not be" finding (spike-findings
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
// Plan 41-01 (D-15): THIS session's own text-monitor port, stashed by
// adoptGrant() beside grantId -- never memoised anywhere else. `null` means
// either no grant has been adopted yet, this is a fork instance (which never
// carries one), or the observed wire value failed validation (see
// adoptGrant()'s own stderr warning for that last case). Read fresh by
// buildHeldLease() on every call, exactly like activeInstance() and grantId
// above it -- never cached past a replacement acquisition.
let grantRemoteMonitorPort: number | null = null;

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
// Edit 2 (plan 02-10, D-13/PROTO-08): `ok: true` now carries a `lease:
// HeldLease | null` -- `null` only for the VICE_MCP_URL override branch
// below, where there is no broker control session to claim a monitor socket
// through. Every failure branch is untouched.
type BrokerLeaseResult = { ok: true; lease: HeldLease | null } | { ok: false; message: string };

/**
 * Builds the HeldLease a stock handler needs from state read FRESH on every
 * call -- activeInstance() and grantId -- never memoised here:
 * handleGrantedInstanceUnreachable() overwrites both on a replacement
 * acquisition, and a cached lease would keep pointing at the retired
 * instance. `host` is the hostname of the active instance's ALREADY
 * containerized `url` (containerizeGrant()'s own loopback rewrite already
 * owns host/container translation -- reading its result here is reuse, not
 * re-derivation). `port` is activeInstance().port (the broker allocates one
 * port per instance and passes it to -binarymonitoraddress on the stock
 * backend, per plan 02-03). `targetId` is grantId -- the same value
 * controlSession.recycle(grantId) already sends on the wire. Called only
 * from the two success returns below that hold a control session.
 */
function buildHeldLease(session: BrokerControlSession): HeldLease {
  const { url, port, epochFile } = activeInstance();
  // WR-06: `new URL(url).hostname` returns a BRACKETED literal for IPv6
  // ("[::1]"), which net.connect() will not accept -- so the brackets are
  // stripped here, at the one place the dial host is derived, rather than by
  // every eventual consumer. Deliberately not a general URL-parsing helper: the
  // bracket form is the single documented WHATWG-URL quirk this seam meets.
  const host = new URL(url).hostname.replace(/^\[(.+)\]$/, "$1");
  // CR-06: `epochFile` and `supervisorDir` are what make the stock handshake's
  // two BACK-04/reconnect mechanisms actually live on the real path -- before
  // this, no production call ever passed StockConnectDeps, so `baselineEpoch`
  // was always null (making stockReconnect() throw a FALSE
  // MachineRestartedError on every transient drop) and the capability cache
  // was never read or written.
  //
  // Two DIFFERENT directories, deliberately, and not interchangeable:
  //   - epochFile is THIS instance's own `<stateDir>/<port>/epoch.json`, read
  //     fresh from activeInstance() like every other field here (adoptGrant()
  //     put the CONTAINERIZED path there, so it is already in this process's
  //     view of the filesystem -- no second translation here).
  //   - supervisorDir is the TOP-LEVEL `.c64-re-tools/supervisor`, where backend.json
  //     lives, resolved through brokerRootDir() -- the SAME resolver
  //     broker.json is read from, never a locally re-derived path (the
  //     "re-deriving a cross-cutting seam locally" anti-pattern).
  return {
    host,
    port,
    targetId: grantId ?? "",
    brokerControl: session,
    epochFile,
    supervisorDir: brokerRootDir(),
    // Plan 41-01 (D-15): read fresh off the module-level variable
    // adoptGrant() stashed, exactly like every other field here -- `null`
    // becomes `undefined` on the lease (HeldLease.remoteMonitorPort is
    // optional; `null` is not a value that type carries).
    ...(grantRemoteMonitorPort === null ? {} : { remoteMonitorPort: grantRemoteMonitorPort }),
  };
}

async function ensureBrokerLease(): Promise<BrokerLeaseResult> {
  if (controlSession) return { ok: true, lease: buildHeldLease(controlSession) };
  if (process.env.VICE_MCP_URL) return { ok: true, lease: null }; // explicit override -- broker never contacted, nothing to claim a monitor socket through

  // Classify liveness FIRST, before ever opening a connection (C10).
  // never_started and stale both return their message immediately, with no
  // connection attempted -- there is nothing on the other side to answer
  // one, so attempting it would only delay the diagnosis. readBrokerLiveness()
  // re-reads broker.json fresh on every call (see its own implementation in
  // vice-broker-client.ts); nothing here memoises the verdict, so this is the
  // broker-path instance of the same never-cache-a-negative-result invariant
  // stated near tools/call above -- the call after a human starts the
  // broker just works, with no session restart required. openBrokerControl()
  // performs this SAME classification
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

  // FORKRM-01 (plan 52-06): the broker/proxy backend cross-check that used to
  // sit here is deleted outright, by recorded decision, with no lighter
  // replacement. It existed because two processes could resolve `ViceBackend`
  // differently -- this process's own resolution (against the CONTAINER's
  // filesystem, which usually has no x64sc at all) and the broker's own
  // independent resolution (against the HOST's) -- and a disagreement would
  // otherwise surface only as an inexplicable transport failure on the first
  // real tool call. With one backend the comparison is a tautology: both
  // sides can only ever resolve "stock". The residual signal the check also
  // caught -- one side finding no x64sc binary at all -- still reaches the
  // operator independently, unaffected by this deletion: `vice_ping`'s
  // `resolvedBinaryPath` field reports this process's own resolution (via
  // `RESOLVED_BINARY.binPath`/`binPathResolved` above), and the broker
  // reports a launch failure by name when it cannot find its own binary.
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
  controlSession = session;
  return { ok: true, lease: buildHeldLease(session) };
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

  // Plan 41-01 (D-15): validate before stashing. `containerizeGrant()` never
  // translates this field (a port number needs no host<->container path or
  // URL rewrite), so `containerized.remote_monitor_port` is exactly the raw
  // wire value. A value that is not an integer in 1..65535 is rejected,
  // grantRemoteMonitorPort is left null, and a one-line stderr warning names
  // the observed value -- never a silent coercion, matching
  // containerizeGrant()'s own posture for an invalid grant.port.
  const rawRemoteMonitorPort = containerized.remote_monitor_port;
  if (rawRemoteMonitorPort === undefined) {
    grantRemoteMonitorPort = null;
  } else {
    const n = Number(rawRemoteMonitorPort);
    if (Number.isInteger(n) && n >= 1 && n <= 65535) {
      grantRemoteMonitorPort = n;
    } else {
      grantRemoteMonitorPort = null;
      console.error(
        `vice-proxy: adoptGrant ${grantId ?? "(no id)"}: remote_monitor_port (${JSON.stringify(rawRemoteMonitorPort)}) is not a valid integer port in 1..65535 -- the text channel will not be dialed for this instance`,
      );
    }
  }

  useInstance({
    port: containerized.port as number,
    url: containerized.url as string,
    epochFile: containerized.epoch_file as string,
    pooled: true,
  });
}

// --------------------------------------- D-13/D-14: replace-and-report
//
// machineReplacedMessage()/replacementFailedMessage()/sessionMustRestartMessage()
// and their entry point handleGrantedInstanceUnreachable() are deleted along
// with the fork-only generic forwarding function that used to sit here (a
// broker lease, an epoch drift check, a pre-flight liveness probe, a
// per-call argument path translation, the fork transport's own HTTP
// dispatch call, a D-16 seam-hazard annotation walk over the
// checkpoint-arming detector, and result chunking): this whole
// replace-and-report mechanism existed to handle a granted instance failing
// that forwarding function's own pre-flight liveness check (a fork-only
// HTTP round trip) -- its only caller. The D-16 mechanism has no other
// caller either, and stock-dispatch.ts's own per-tool handlers have no
// equivalent hook today. Every advertised tool now registers straight
// through buildViceTool() to stockDispatch.dispatchStock() (see the
// registration loop below) -- there is no surviving generic-dispatch
// surface for a derived tool to slip behind, matching this plan's own
// prohibition against re-opening the nested-argument hazard an outer-name
// refusal array used to close. Stock has no equivalent probe-then-replace
// step at this proxy layer; a dead lease surfaces through stockDispatch's
// own error handling instead.

// -------------------------------------------------------------- teardown
//
// TWO ladders, not one, firing DIFFERENT handlers (spike-findings
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
//
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
// D-01: the wire layer is MCPServer + startStdio(), with each registered
// tool's own runner (stockDispatch.dispatchStock(), or a proxy-local
// handler for the synthetic/anno_* tools, above) doing the actual dispatch
// work -- only the top-level caller changed from the original hand-rolled
// framing. See this plan's PLAN.md "Ground truth" section (read directly
// from @mastra/mcp's compiled source, not its docs) for why tools/call is
// answered by the CallToolRequestSchema override below rather
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

// This loop registers every tool the active manifest advertises. It used
// to skip a fixed outer-name refusal array covering the fork HTTP server's
// own generic-surface meta-tools (`tools_call`/`tools_list`/`initialize`/
// `notifications_initialized`, all of which the fork's manifest advertised
// as ordinary forwardable tools) plus `vice_disk_list` (a tool known to
// crash that same server). Both the fork manifest and the refusal array are
// gone: the manifest this loop reads never advertised any of those names,
// so there is nothing left to skip -- every entry registers unconditionally.
// tools/list is served entirely by MCPServer's own ListToolsRequestSchema
// handler (unmodified, not overridden), reading from this SAME `tools`
// object. A manifest hot-reload mid-session is not picked up until the
// proxy restarts; the manifest is regenerated by a manual, rare build step,
// never mid-session in practice.
//
// The per-backend registration seam this section used to describe
// (D-09, CR-07) is deleted: every tool this file
// registers now dispatches through stockDispatch.dispatchStock()
// unconditionally, which either has a table entry for the name or REFUSES
// BY NAME. There is no third path and no fall-through -- D-09's whole
// point, true by construction now rather than by a runtime backend check.
const tools: Record<string, ReturnType<typeof buildViceTool>> = {};
// Read ONCE and reused below for both the manifest loop and the two
// synthetic registrations' own resolveAdvertisedToolDefinition() calls --
// never re-read per registration (WR-07, plan 07-16).
const manifestTools = readManifestTools();
for (const def of manifestTools) {
  tools[def.name] = buildViceTool(def, (args) => dispatchStockFor(def.name, args));
}
// Backend-INDEPENDENT by construction: handleResultContinue() is served
// entirely from this proxy's own CONTINUATION_STORE and opens no socket of any
// kind, so it is correct on either backend and is deliberately NOT routed
// through dispatchStock (which would refuse the continuation mechanism itself).
tools[RESULT_CONTINUE_TOOL.name] = buildViceTool(RESULT_CONTINUE_TOOL, (args) => Promise.resolve(handleResultContinue(args)));
// vice_recycle/vice_diagnose keep their own dedicated handlers
// (handleRecycle()/handleDiagnose(), declared above) rather than going
// through the manifest loop's own inline dispatchStock() call -- both
// handlers delegate to dispatchStock() themselves now, so the observable
// behaviour is identical either way, but the named handlers stay the
// registration point so they remain independently locatable and testable.
// WR-07 (plan 07-16): resolveAdvertisedToolDefinition() picks the corrected
// stock manifest entry when one exists, falling back to the synthetic
// RECYCLE_TOOL/DIAGNOSE_TOOL definition otherwise, so the advertised
// tools/list entry stays correct regardless of which manifest currently
// ships one.
tools[RECYCLE_TOOL.name] = buildViceTool(stockDispatch.resolveAdvertisedToolDefinition(RECYCLE_TOOL, "stock", manifestTools), (args) => handleRecycle(args));
tools[DIAGNOSE_TOOL.name] = buildViceTool(stockDispatch.resolveAdvertisedToolDefinition(DIAGNOSE_TOOL, "stock", manifestTools), (args) => handleDiagnose(args));
// Backend-INDEPENDENT by construction (plan 29-01): the anno_* family never
// touches VICE at all -- it reaches a PROXY-LOCAL SQLite annotation store
// this repo owns, opened and closed inside the runner itself, so there is no
// fork/stock distinction to make. The family is in NEITHER
// tools-manifest.json NOR tools-manifest.stock.json: both are regenerated by
// refresh-manifest.ts from a live HOST VICE server's own tools/list, and a
// local store file is never that host -- a hand-added entry in either
// manifest would be silently wiped on the next refresh.
// Registered here via buildViceTool() directly (the SAME pattern
// RESULT_CONTINUE_TOOL above uses), so no anno_* runner ever reaches
// stockDispatch: there is no generic-dispatch surface left anywhere in this
// file for a derived tool's runner to slip behind, so this exemption cannot
// be violated by omission the way it could when a fork-only forwarding path
// still existed.
// Deliberately NOT named `def` (the manifest loop's own loop variable,
// above): `stock-dispatch.test.ts`'s `proxyToolRegistrations()` regex-scans
// this file's own `tools[...] = ...;` lines and keys each one by its raw
// captured text, so an identically-named loop variable here would make this
// registration textually indistinguishable from the manifest loop's -- a
// distinct name (`annoDef`) keeps the anno_* family's own registration from
// ever being confused with, or accidentally merged into, the manifest
// loop's.
for (const annoDef of ANNO_TOOL_DEFINITIONS) {
  tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));
}

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
// {content, isError} contract nor a capability refusal's exact wording a
// pre-existing test pins verbatim -- so tools/call is answered entirely by
// this override, never by MCPServer's own handler. tools/list is NOT
// overridden -- MCPServer's own ListToolsRequestSchema handler answers it,
// the one piece of genuine library value this swap adopts.
server.getServer().setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const tool = tools[name];
  if (!tool || !tool.execute) {
    // Fires ONLY when the ACTIVE backend's trimmed manifest (D-07) never
    // registered this name -- i.e. `tools` has no key for it. This lookup
    // renders undefined for a genuinely unknown name (or a same-backend
    // miss), so a real typo still falls through to the generic message
    // below unchanged. capability-registry.ts is the ONE place to
    // edit this data -- never hand-add a per-tool special case here.
    const capabilityRefusal = capabilityRefusalMessage(name, "stock");
    if (capabilityRefusal !== undefined) {
      return { content: [{ type: "text", text: capabilityRefusal }], isError: true };
    }
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
    // comment) -- every registered tool's own runner should never actually
    // throw in normal operation, but this override must not depend on that
    // being true.
    return { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true };
  }
});

// Log-line (plan 02-10, collapsed to the stock-only message once the fork
// arm was deleted): the stock arm cannot yet name a real instance/port -- no
// acquisition has happened at process startup, only lazily on the first
// tools/call -- so it names the backend and the binary-monitor target
// instead of a coordinate pair that does not exist yet.
console.error(
  `vice-proxy: ready, stock backend active -- dispatching to a broker-claimed binary-monitor instance (resolved binary: ${RESOLVED_BINARY.binPath})`,
);
