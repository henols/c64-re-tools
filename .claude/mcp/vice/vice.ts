#!/usr/bin/env node
// Single MCP client seam for the host VICE MCP server.  Every emulator
// interaction in this project goes through `call()` -- no other file speaks
// MCP JSON-RPC or raw HTTP to the VICE endpoint directly.
//
// Why a seam at all: Phase 1 tooling and Phase 3's verify/runner.mjs both
// depend on this one transport.  If the handshake shape ever needs to change
// (session header, SSE framing, a curl fallback), it changes here once.
//
// The deny-list is the other reason this file exists: vice_disk_list crashes
// the shared host MCP server (see CLAUDE.md's hazard note and STATE.md's
// blocker entry).  The guard below runs *before* any request is serialised,
// so no caller -- however indirect -- can reach that tool by accident.
import { resolve, join } from "node:path";
import { readFileSync } from "node:fs";

import { supervisorDir } from "./repo-root.ts";
import { isInsideContainer, type ContainerGuardDeps } from "./container-guard.mts";

// Renamed from ENDPOINT to DEFAULT_ENDPOINT (D-5): a pool lease redirects
// the seam to a DIFFERENT endpoint at runtime via useInstance() below, so
// this is only the starting value, never assumed to be the active one.
//
// PORT TRIAGE (01.6.2-09, D-18): this 6510 is a KEPT, CORRECT value, not an
// oversight. 6510-6599 is the band reserved by convention for an x64sc a
// human launches on the host for their OWN work; when no broker grant
// exists and no explicit VICE_MCP_URL override is set, this fallback
// describes exactly that human-launched instance -- which is what the
// reserved band is now for. Do not "fix" this into the broker's own
// allocated band (6600+, DEFAULT_BASE_PORT in broker-state.mts) -- that
// would be the broker squatting a port a human wants, the exact defect
// D-18 exists to prevent.
// The host part is resolved through mcpHost() rather than baked in as a
// literal, for the same container-versus-host reason documented on mcpHost()
// below -- this URL was the LAST remaining unconditional
// "host.docker.internal" in the tree. Calling mcpHost() here is legal despite
// it being declared further down: it is a function DECLARATION, so it is
// hoisted, and its own import is initialised before this module body runs.
// Evaluated once at startup, which also warms isInsideContainer()'s cache
// before any tool call needs it.
const DEFAULT_ENDPOINT: string = process.env.VICE_MCP_URL || `http://${mcpHost()}:6510/mcp`;
const DEFAULT_TIMEOUT_MS: number = Number(process.env.VICE_MCP_TIMEOUT_MS || 30000);

// The address of the host machine -- the ONE definition every consumer that
// needs to build a host-facing URL from a bare port reads, instead of each
// inlining its own `process.env.VICE_MCP_HOST || "host.docker.internal"` copy
// (there were three such copies before this: vice-pool.mjs's instanceFor() and
// defaultInstance(), and vice-session.mjs's readSession()). A FUNCTION, not
// a module-level constant, so it stays sensitive to a runtime env override
// -- vice-pool.test.mjs's own withMcpHostEnv() helper mutated
// process.env.VICE_MCP_HOST across test cases within the SAME process
// (before that file's 2026-08-02 deletion), which a constant captured once
// at import time would have silently stopped honouring.
//
// CONTAINER-AWARE (2026-08-05, developer instruction). The default was
// previously the bare literal "host.docker.internal", which is correct in
// exactly ONE of the two environments this code runs in: it is a
// Docker-provided alias, published into the container by
// .devcontainer/devcontainer.json's `--add-host=host.docker.internal:host-gateway`,
// and it does not resolve on the host at all. Host-bound modules genuinely do
// consume this tree (vice-broker.mts references vice-broker-client), so a
// single unconditional answer was wrong for one side by construction.
//
// Detection is delegated to container-guard.mts's isInsideContainer() rather
// than re-derived -- see that function's own comment for why a second
// detector is a bug waiting to happen here.
//
// Non-container branch is 127.0.0.1 rather than "localhost" DELIBERATELY:
// "localhost" may resolve to ::1 first, and the broker binds 0.0.0.0 --
// IPv4-only (broker-control.mts's documented bind), so an IPv6 loopback
// connect would be refused by a listener that is in fact running. An explicit
// IPv4 literal cannot pick the wrong family. It also classifies as `loopback`
// under vice-broker-client.ts's classifyConnectHost(), which that resolver
// deliberately does NOT refuse, and is not `wildcard_bind`, so it does not
// trip the pre-connect refusal.
export function mcpHost(deps?: ContainerGuardDeps): string {
  return process.env.VICE_MCP_HOST || (isInsideContainer(deps) ? "host.docker.internal" : "127.0.0.1");
}

// Where tools/vice-supervisor.sh (host-only) writes its restart epoch --
// resolved via repo-root.ts's supervisorDir() (never a fixed hop count off
// this file's own location), so the path is correct regardless of the
// caller's cwd AND regardless of how deep this file sits under the repo
// root. Overridable for tests and for anyone running the supervisor with a
// non-default VICE_SUPERVISOR_DIR. Kept exactly as-is (D-5: no behaviour
// change with no pool running) -- this remains the default that
// activeEpochFile below starts from.
export const EPOCH_FILE: string = process.env.VICE_EPOCH_FILE
  ? resolve(process.env.VICE_EPOCH_FILE)
  : join(supervisorDir(), "epoch.json");

export interface ActiveInstance {
  port: number;
  url: string;
  epochFile: string;
  pooled: boolean;
}

// -------------------------------------------------------- active instance
//
// Mutable module-level state, deliberately NOT frozen at module load (D-5):
// restart detection has to stay correct PER INSTANCE, which is impossible if
// the epoch path is fixed at import time. useInstance() below is the only
// writer; every other read goes through the functions in this file so a
// lease redirect takes effect everywhere at once (rpc()'s POST target,
// readEpoch()'s default path, beginSession()'s default path).
let activeUrl: string = DEFAULT_ENDPOINT;
let activeEpochFile: string = EPOCH_FILE;
// Derived from DEFAULT_ENDPOINT rather than hardcoded or left null: with no
// lease ever taken (no pool, or a programmatic caller that never calls
// acquire()/useInstance()), this is still a real port identity -- e.g. for
// tools/recover.mjs's snapshotName(), which namespaces by port
// UNCONDITIONALLY (D-4) and must never produce a "no port" name just because
// nothing redirected the seam. Falls back to 6510 only if the URL has no
// parseable port at all.
//
// PORT TRIAGE (01.6.2-09, D-18): kept, same reasoning as DEFAULT_ENDPOINT
// above -- this fallback describes the same human-launched, reserved-band
// (6510-6599) instance, never a broker-allocated one, so 6510 stays correct
// here too.
let activePort: number = (() => {
  try {
    const p = Number(new URL(DEFAULT_ENDPOINT).port);
    return Number.isInteger(p) && p > 0 ? p : 6510;
  } catch {
    return 6510;
  }
})();
// Not part of the seam redirect itself (rpc()/readEpoch() never consult
// this) -- carried purely as identity metadata so a caller like
// tools/recover.mjs's capture record can note whether a dump came from a
// pooled instance or the unpooled default, without needing its own separate
// channel back to whatever acquired the lease. Extra, optional field on
// useInstance()'s object arg -- a caller passing only {port,url,epochFile}
// (the documented minimum) still works exactly as before, defaulting to
// false.
let activePooled = false;

export interface UseInstanceOptions {
  port: number;
  url: string;
  epochFile: string;
  pooled?: boolean;
}

/**
 * Redirect the transport seam to a specific pooled (or fallback) instance.
 * MUST reset the MCP handshake (`initialized = false`): the handshake
 * belongs to the endpoint it was performed against, and continuing to use a
 * "logged in" flag from a DIFFERENT endpoint would silently talk to the new
 * instance without ever having initialized a session there. Warns on stderr
 * if called while a session is already open against the previous instance,
 * since that is a real behaviour change the caller should notice.
 */
export function useInstance({ port, url, epochFile, pooled = false }: UseInstanceOptions): void {
  if (initialized) {
    console.error(
      `warn: useInstance(port ${port}) called while a session was already open against ` +
        `${activeUrl} -- resetting the handshake. If this is mid-procedure, make sure that was intended.`
    );
  }
  activeUrl = url;
  activeEpochFile = epochFile;
  activePort = port;
  activePooled = pooled;
  initialized = false;
}

/** Read-only accessor: the instance the seam is currently pointed at. */
export function activeInstance(): ActiveInstance {
  return { port: activePort, url: activeUrl, epochFile: activeEpochFile, pooled: activePooled };
}

// Forbidden tool names.  Checked by exact string match before any network
// call is made -- see call() below.  Never remove vice_disk_list from this
// list; see the project's own hazard note (CLAUDE.md, STATE.md blockers).
//
// "tools_list" added (01.4-01 task 1, the phase's tracer slice): the host's
// own generic-surface meta-tool, which the manifest lists as an ordinary
// forwardable tool. Reuses this exact same array and the exact same two
// enforcement seams (this guard, and vice-proxy.ts's registration-loop skip
// + CallToolRequestSchema override) -- no new mechanism, per 01.4-RESEARCH.md
// Pattern 1 ("one array, no new mechanism"). See denyListRefusalMessage()
// below for why this entry's hazard shape differs from vice_disk_list's own.
//
// "tools_call", "initialize", "notifications_initialized" added (01.4-01
// task 2): closes the fix in full rather than partially, per
// 01.4-RESEARCH.md's own primary recommendation. A repo-wide grep (.claude/,
// .planning/, and this package's own test file) for any SANCTIONED caller of
// any of these four names AS A TOOL -- i.e. dispatched through tools/call,
// not the unrelated MCP-protocol "initialize" JSON-RPC method vice.ts's own
// ensureInitialized() sends, which is the transport handshake, never a tool
// lookup through this DENY_LIST -- found none. Every recorded hit is either
// this phase's own research/todo documents and incident records (excluded by
// the plan's own instruction), or the pre-existing stand-in-host test
// fixture proving the nested-argument bypass this task closes (repointed
// below to assert closure, not deleted). 01.4-RESEARCH.md's Open Question 1
// and Assumption A2 both predicted this: every recorded use on file is an ad
// hoc fallback probe performed because a named tool went missing, not a
// designed dependency -- confirmed still true by this grep.
export const DENY_LIST: readonly string[] = [
  "vice_disk_list",
  "tools_list",
  "tools_call",
  "initialize",
  "notifications_initialized",
];

/**
 * Renders an accurate refusal message for a DENY_LIST entry, keyed by hazard
 * shape rather than one wording reused verbatim for every entry (01.4-01
 * task 1, T-01.4-02): vice_disk_list crashes the shared host VICE MCP server
 * directly -- a CRASH hazard, the project's original hazard note. Every
 * other DENY_LIST entry is a generic-surface meta-tool (tools_list,
 * tools_call, and -- if 01.4-01 task 2's own grep clears them -- initialize
 * and notifications_initialized) whose hazard is a different shape: it is a
 * confused-deputy BYPASS, because it can carry a forbidden tool name as a
 * NESTED argument, sidestepping this exact outer-name-only guard (see
 * .planning/todos/pending/2026-08-05-generic-surface-deny-list-gap-tools-call-nested-vice-disk-list.md).
 * It does not itself crash anything. Telling an agent the wrong hazard shape
 * for what is otherwise the same permanent refusal invites a pointless
 * retry -- so this is one array (DENY_LIST) and one message-rendering
 * function, reused at every call site, rather than duplicated refusal text
 * per site (currently vice.ts's call() guard below and vice-proxy.ts's
 * CallToolRequestSchema override; task 2 adds the retooled bypass test as a
 * third consumer of this same function's output shape, not a fourth
 * inline copy).
 */
export function denyListRefusalMessage(toolName: string): string {
  if (toolName === "vice_disk_list") {
    return (
      `${toolName} is permanently forbidden -- it is known to crash the shared host VICE MCP server ` +
      `(see CLAUDE.md's hazard note). Recovery requires a manual, host-side restart. Refusing to ` +
      `serialise this request; retrying will not help.`
    );
  }
  return (
    `${toolName} is permanently forbidden -- it is a generic-surface meta-tool that can carry a ` +
    `forbidden tool name as a nested argument, bypassing this exact outer-name-only guard (see ` +
    `.planning/todos/pending/2026-08-05-generic-surface-deny-list-gap-tools-call-nested-vice-disk-list.md). ` +
    `It does not itself crash the host. Refusing to serialise this request; retrying will not help.`
  );
}

export interface ViceErrorOptions {
  code?: number | string;
  data?: unknown;
}

export class ViceError extends Error {
  code?: number | string;
  data?: unknown;

  constructor(message: string, { code, data }: ViceErrorOptions = {}) {
    super(message);
    this.name = "ViceError";
    this.code = code;
    this.data = data;
  }
}

export interface MachineRestartedErrorOptions {
  baselineEpoch?: number | null;
  currentEpoch?: number | null;
  where?: string;
  lastToolCall?: string | null;
}

/**
 * Thrown when a reconnect happened and the emulator's identity across that
 * reconnect could not be proven -- either the epoch file shows it changed,
 * or nothing (no epoch file, no surviving armed checkpoint) could prove it
 * didn't (D-3, D-4). Carries the evidence a caller needs to write a void
 * note: the epochs compared, where in the pipeline the check ran, and the
 * last tool call attempted before detection (see lastToolCall() below).
 */
export class MachineRestartedError extends ViceError {
  baselineEpoch?: number | null;
  currentEpoch?: number | null;
  where?: string;
  lastToolCall?: string | null;

  constructor(message: string, { baselineEpoch, currentEpoch, where, lastToolCall }: MachineRestartedErrorOptions = {}) {
    super(message);
    this.name = "MachineRestartedError";
    this.baselineEpoch = baselineEpoch;
    this.currentEpoch = currentEpoch;
    this.where = where;
    this.lastToolCall = lastToolCall;
  }
}

let reqId = 0;

export interface RpcOptions {
  timeoutMs?: number;
}

interface JsonRpcErrorPayload {
  code?: number;
  message?: string;
  data?: unknown;
}

interface JsonRpcResponsePayload {
  error?: JsonRpcErrorPayload;
  result?: unknown;
}

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches vice-broker.mts's / vice-broker-client.ts's own
 * isPlainObject() predicate exactly -- the same narrowing discipline this
 * module tree uses everywhere a parsed JSON value's fields are touched. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Raw JSON-RPC round trip. Wraps every call in a client-side abort timeout --
 * vice_run_until's own `cycles` timeout is documented as "not yet
 * implemented", so nothing upstream protects us from a hung request; this is
 * that protection, at the transport layer, for every call this seam makes.
 */
async function rpc(method: string, params: unknown, { timeoutMs = DEFAULT_TIMEOUT_MS }: RpcOptions = {}): Promise<unknown> {
  const id = ++reqId;
  const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  let res: Response;
  try {
    res = await fetch(activeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const err = e as Error;
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new ViceError(
        `${method} timed out after ${timeoutMs}ms -- the host VICE MCP server may be hung or unreachable. ` +
          `Recovery is a HOST-SIDE restart, which this container cannot perform. Run ` +
          `tools/vice-launcher.sh on the HOST -- its broker launches a boot-fresh instance on demand, ` +
          `supervises it, and respawns a crashed one with backoff, logging the crash ` +
          `for the still-open root-cause investigation (see .planning/STATE.md).`
      );
    }
    throw new ViceError(`transport error calling ${method}: ${err.message}`);
  }
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  let payload: JsonRpcResponsePayload;
  if (contentType.includes("text/event-stream")) {
    // SSE-framed body: parse `data:` lines, take the last JSON payload.
    const dataLines = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    if (!dataLines.length) {
      throw new ViceError(`no data: lines in SSE response for ${method}`);
    }
    const parsed: unknown = JSON.parse(dataLines[dataLines.length - 1]);
    payload = isPlainObject(parsed) ? (parsed as JsonRpcResponsePayload) : {};
  } else {
    try {
      const parsed: unknown = JSON.parse(text);
      payload = isPlainObject(parsed) ? (parsed as JsonRpcResponsePayload) : {};
    } catch {
      throw new ViceError(`non-JSON response for ${method}: ${text.slice(0, 200)}`);
    }
  }
  if (payload.error) {
    throw new ViceError(payload.error.message || `RPC error calling ${method}`, {
      code: payload.error.code,
      data: payload.error.data,
    });
  }
  return payload.result;
}

let initialized = false;
async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "bruce-lee-recover", version: "1.0" },
  });
  initialized = true;
}

// The host server has been observed to drop connections and recover on its own,
// but the outage outlasts a short backoff -- a 6s total budget was measured as
// too short. These values give it ~50s to come back before we declare it dead
// and point the operator at tools/vice-launcher.sh (host-only; this
// container cannot restart it itself) -- its on-demand broker launches a
// fresh instance and respawns a crashed one with backoff automatically
// (01.6.2-09: the retiring per-instance supervisor, vice-supervisor.sh, is
// superseded by this same launcher/broker).
//
// IMPORTANT: under that broker, this retry can now SUCCEED -- against a
// brand-new, blank machine with no disk attached and no checkpoints armed,
// not the one this session started with. That is exactly why
// beginSession()/assertSameMachine() exist below: a retry that starts
// working again is no longer proof that nothing happened. Do not remove the
// identity check while this broker (or any future host-side recovery)
// exists, and do not remove it without also removing the retry -- they are
// one mitigation in two halves, not two independent features.
const RECONNECT_ATTEMPTS = 5;
const RECONNECT_BACKOFF_MS = [2000, 5000, 12000, 30000, 0];
const nap = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * A single dropped connection used to be fatal: the error propagated straight
 * out and, worse, `initialized` stayed true, so every later call spoke into a
 * dead session. The host server has been observed both to drop a connection
 * mid-request and to come back moments later, so transport failures are
 * retried with backoff and the session handshake is redone.
 *
 * Only TRANSPORT failures are retried. An RPC-level error (the server answered
 * and said no) is a real answer and is never retried -- retrying a rejected
 * tool call would just repeat a mistake, and for a tool with side effects could
 * repeat it destructively.
 *
 * Under host-side recovery (tools/vice-launcher.sh's on-demand broker), this
 * retry can now SUCCEED -- against a brand-new, blank machine with no disk
 * attached, no checkpoints armed and the CPU halted at the BASIC prompt. A
 * success here is therefore no longer proof that nothing happened; it is
 * exactly the signal the session-identity section below
 * (readEpoch/assertSameMachine) exists to catch. Do not remove one half of
 * this pairing without the other.
 */
async function withReconnect(toolName: string, args: Record<string, unknown>, opts: RpcOptions): Promise<unknown> {
  lastCallSummary = summarizeCall(toolName, args);
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < RECONNECT_ATTEMPTS; attempt++) {
    try {
      await ensureInitialized();
      return await rpc("tools/call", { name: toolName, arguments: args }, opts);
    } catch (e) {
      const err = e as Error;
      const transport = /transport error|timed out|no data: lines|non-JSON response/i.test(err.message);
      if (!transport) throw err;
      lastErr = err;
      initialized = false; // force a fresh handshake -- the old session is gone
      // Session-identity signal (D-3): this is the ONLY place that knows a
      // reconnect was forced. Bump the counter every attempt, not just on
      // eventual success -- call()'s cheap epoch check and
      // assertSameMachine()'s checkpoint-fallback probe both key off this.
      reconnectCount++;
      if (attempt < RECONNECT_ATTEMPTS - 1) {
        console.error(
          `warn: ${toolName} transport failure (attempt ${attempt + 1}/${RECONNECT_ATTEMPTS}), ` +
            `reconnecting in ${RECONNECT_BACKOFF_MS[attempt]}ms: ${err.message}`
        );
        await nap(RECONNECT_BACKOFF_MS[attempt]);
      }
    }
  }
  throw new ViceError(
    `${toolName} failed after ${RECONNECT_ATTEMPTS} transport attempts against ${activeUrl} ` +
      `(port ${activePort}): ${lastErr?.message} -- recovery is a HOST-SIDE restart, which this ` +
      `container cannot perform. Run tools/vice-launcher.sh on the HOST (see its header comment) -- ` +
      `its broker launches a boot-fresh instance on demand, supervises it, and respawns a crashed one ` +
      `with backoff, logging the crash for the still-open root-cause investigation.`
  );
}

// ------------------------------------------------------- session identity
//
// WHY this lives in the transport seam, not in tools/recover.mjs: this file
// is the only place that knows a reconnect happened at all. Once
// tools/vice-launcher.sh's on-demand broker is respawning x64sc on the host,
// withReconnect()'s retry-with-backoff above starts SUCCEEDING again -- but
// potentially against a completely different, freshly-booted machine.
// Turning that "quiet success" back into a loud, checkable signal is the
// whole point of this section (D-3, D-4).
//
// Module-level state, deliberately NOT per-call-argument: there is one
// active recovery session per process (recover.mjs's CLI runs one verb at a
// time), so beginSession()/assertSameMachine() read and reset this state
// directly rather than threading it through every call() site.
export interface SessionInfo {
  baseline: EpochResult;
  epochPath: string;
  startedAt: string;
}

let currentSession: SessionInfo | null = null; // set by beginSession(): { baseline, epochPath, startedAt }
let reconnectCount = 0; // reset by beginSession(); incremented by withReconnect(); "consumed" (reset) by assertSameMachine()
let lastCallSummary: string | null = null; // last tool call attempted, for D-4 evidence in a void note

/** `${toolName} ${args}`, truncated to ~120 chars -- D-4 wants the last call before a
 * detected restart, not a full transcript. */
function summarizeCall(toolName: string, args: unknown): string {
  let argsStr: string;
  try {
    argsStr = JSON.stringify(args);
  } catch {
    argsStr = String(args);
  }
  const full = `${toolName} ${argsStr}`;
  return full.length > 120 ? `${full.slice(0, 117)}...` : full;
}

export interface EpochResult {
  present: boolean;
  epoch: number | null;
  spawned_at: string | null;
  pid: number | null;
  path: string;
  reason?: string;
}

/**
 * Read the supervisor's epoch file. Synchronous -- this is a plain, cheap
 * file read; the whole point of the epoch check is that it costs zero MCP
 * traffic, unlike the checkpoint-fallback probe. NEVER throws: absence is
 * normal (no supervisor running at all) and must not be an error (D-3) --
 * the harness has to keep working exactly as it does today with no
 * supervisor.
 *
 * Treats the file's contents as untrusted, host-written input (T-jty-01):
 * JSON.parse in try/catch, `epoch` must decode to a finite integer, unknown
 * fields are ignored, and no path derived from the file's contents is ever
 * opened.
 */
export function readEpoch(path: string = activeEpochFile): EpochResult {
  const absent: EpochResult = { present: false, epoch: null, spawned_at: null, pid: null, path };
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { ...absent, reason: "epoch file absent" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...absent, reason: "epoch file present but not valid JSON" };
  }
  if (!isPlainObject(parsed) || !Number.isInteger(parsed.epoch)) {
    return { ...absent, reason: 'epoch file present but its "epoch" field is not a finite integer' };
  }
  return {
    present: true,
    epoch: parsed.epoch as number,
    spawned_at: typeof parsed.spawned_at === "string" ? parsed.spawned_at : null,
    pid: typeof parsed.pid === "number" && Number.isFinite(parsed.pid) ? parsed.pid : null,
    path,
  };
}

export interface BeginSessionOptions {
  epochPath?: string;
}

/**
 * Start a new identity-tracking session: capture the current epoch as the
 * baseline every later check compares against, and zero the reconnect
 * counter so a PRIOR session's reconnects (e.g. from a previous `recover()`
 * run inside the same `reproduce()` process) don't leak into this one.
 */
export function beginSession({ epochPath = activeEpochFile }: BeginSessionOptions = {}): SessionInfo {
  const baseline = readEpoch(epochPath);
  reconnectCount = 0;
  currentSession = { baseline, epochPath, startedAt: new Date().toISOString() };
  return currentSession;
}

/** Read-only accessor: how many transport-forced reconnects since the last
 * beginSession() (or the last assertSameMachine() consumption -- see there). */
export function sessionReconnects(): number {
  return reconnectCount;
}

/** Read-only accessor: the last tool call attempted (name + truncated args),
 * for D-4 evidence -- populated even for calls that ultimately failed. */
export function lastToolCall(): string | null {
  return lastCallSummary;
}

export type CallFn = (toolName: string, args?: Record<string, unknown>, opts?: RpcOptions) => Promise<unknown>;

export interface AssertSameMachineOptions {
  where: string;
  armedCheckpoints?: number[];
  reconnected?: boolean;
  call?: CallFn;
}

/**
 * Prove (or fail to prove) that the machine behind `session` is still the
 * one that was running at `beginSession()` time. See the plan's `<behavior>`
 * block for the six rules this implements; in short:
 *
 *   - If the epoch file proves a change (baseline and current both present,
 *     different values) -> MachineRestartedError, always, reconnect or not.
 *   - If the epoch file proves NO change (both present, same value) -> pass,
 *     no further (MCP) check needed.
 *   - Otherwise (no epoch evidence either way) and no reconnect happened ->
 *     pass, and no MCP call is made at all -- the whole point of gating the
 *     checkpoint probe behind `reconnected`.
 *   - Otherwise (no epoch evidence, but a reconnect DID happen): fall back to
 *     asking whether a checkpoint the harness itself already armed (never a
 *     new sentinel -- checkpoint work is itself a crash suspect) is still
 *     listed. Present -> pass. Absent, or nothing to probe with -> void.
 *
 * `reconnected` defaults to whether ANY transport-forced reconnect has
 * happened since the last beginSession()/assertSameMachine() call --
 * calling this function CONSUMES that count (resets it to 0) so a later,
 * unrelated assertSameMachine() call (e.g. after this stage's own armed
 * checkpoint has since been deleted) doesn't re-trigger a probe against
 * checkpoints that are supposed to be gone by then.
 */
export async function assertSameMachine(
  session: SessionInfo,
  {
    where,
    armedCheckpoints = [],
    reconnected = sessionReconnects() > 0,
    call: callFn = call,
  }: AssertSameMachineOptions
): Promise<void> {
  // Consume the module-level reconnect signal now -- see the doc comment
  // above for why this matters for later, unrelated checks in the same
  // session.
  reconnectCount = 0;

  const currentEpoch = readEpoch(session.epochPath);

  if (session.baseline.present && currentEpoch.present) {
    if (currentEpoch.epoch !== session.baseline.epoch) {
      throw new MachineRestartedError(
        `${where}: the emulator restarted -- epoch changed from ${session.baseline.epoch} to ` +
          `${currentEpoch.epoch}. This run is void; re-run it.`,
        { baselineEpoch: session.baseline.epoch, currentEpoch: currentEpoch.epoch, where, lastToolCall: lastCallSummary }
      );
    }
    return; // epoch proves this is still the same machine -- no MCP call needed
  }

  if (!reconnected) {
    return; // nothing to check, and nothing checked -- no MCP call made
  }

  // A reconnect happened and the epoch file could not confirm sameness
  // (either no broker is running at all, or its epoch file just isn't
  // there to compare against). The checkpoint-fallback probe is the only
  // identity signal left -- and it deliberately reuses checkpoints the
  // harness already armed for its own reasons; arming a new sentinel
  // checkpoint was rejected because checkpoint work is itself one of the two
  // leading crash suspects (see STATE.md's HAZARD CANDIDATE entry).
  if (armedCheckpoints.length === 0) {
    throw new MachineRestartedError(
      `${where}: a reconnect happened and identity could not be proven -- no epoch file to compare ` +
        `and no armed checkpoint to probe. Unproven is not the same as fine; re-run the capture. If ` +
        `this recurs, run tools/vice-launcher.sh on the HOST so future runs have an epoch file to check.`,
      { baselineEpoch: session.baseline.epoch, currentEpoch: currentEpoch.epoch, where, lastToolCall: lastCallSummary }
    );
  }

  let listed: unknown;
  try {
    listed = await callFn("vice_checkpoint_list", {});
  } catch (e) {
    const err = e as Error;
    throw new MachineRestartedError(
      `${where}: a reconnect happened and the checkpoint-fallback probe itself failed (${err.message}) -- ` +
        `identity could not be proven. Re-run the capture.`,
      { baselineEpoch: session.baseline.epoch, currentEpoch: currentEpoch.epoch, where, lastToolCall: lastCallSummary }
    );
  }
  const checkpoints = isPlainObject(listed) && Array.isArray(listed.checkpoints) ? listed.checkpoints : [];
  const liveIds = new Set((checkpoints as Array<Record<string, unknown>>).map((c) => c.checkpoint_num as number));
  const stillPresent = armedCheckpoints.some((id) => liveIds.has(id));
  if (!stillPresent) {
    throw new MachineRestartedError(
      `${where}: a reconnect happened and none of the harness's own armed checkpoints ` +
        `(${armedCheckpoints.join(", ")}) are listed by vice_checkpoint_list -- the emulator restarted. ` +
        `This run is void; re-run it.`,
      { baselineEpoch: session.baseline.epoch, currentEpoch: currentEpoch.epoch, where, lastToolCall: lastCallSummary }
    );
  }
  // The armed checkpoint survived the reconnect -- demonstrably the same machine.
}

/**
 * Call a vice_* tool by name and return its parsed JSON result.
 *
 * Refuses any tool on DENY_LIST before any network request is made -- this
 * check is the first line of the function body, deliberately, so the deny
 * list is enforced even if a future edit reorders the rest of the function.
 */
export async function call(toolName: string, args: Record<string, unknown> = {}, opts: RpcOptions = {}): Promise<unknown> {
  if (DENY_LIST.includes(toolName)) {
    throw new ViceError(denyListRefusalMessage(toolName));
  }
  const reconnectsBefore = reconnectCount;
  const result = await withReconnect(toolName, args, opts);
  // Session-identity fast path (D-3, D-4): if THIS call needed a reconnect,
  // do the cheap epoch check (a synchronous file read, zero extra MCP
  // traffic) right here -- the earliest and loudest possible detection
  // point. A changed epoch throws immediately. We deliberately do NOT run
  // the checkpoint-fallback probe here: that would be a re-entrant call(),
  // and reconnectCount staying > 0 is exactly the module flag
  // assertSameMachine() consumes at its next checkpoint instead.
  if (reconnectCount > reconnectsBefore && currentSession) {
    const nowEpoch = readEpoch(currentSession.epochPath);
    if (currentSession.baseline.present && nowEpoch.present && nowEpoch.epoch !== currentSession.baseline.epoch) {
      throw new MachineRestartedError(
        `${toolName}: the emulator restarted mid-call -- epoch changed from ` +
          `${currentSession.baseline.epoch} to ${nowEpoch.epoch} after a reconnect. This run is void; re-run it.`,
        {
          baselineEpoch: currentSession.baseline.epoch,
          currentEpoch: nowEpoch.epoch,
          where: `call(${toolName})`,
          lastToolCall: lastCallSummary,
        }
      );
    }
  }
  const content = (result as { content?: Array<{ type?: string; text?: string }> } | undefined)?.content?.[0];
  if (!content || content.type !== "text") {
    throw new ViceError(`unexpected tool result shape from ${toolName}: ${JSON.stringify(result)}`);
  }
  try {
    return JSON.parse(content.text ?? "");
  } catch {
    return content.text; // a few tools may return plain text; hand it back verbatim
  }
}

// Alias -- some call sites read more naturally as callTool(...).
export const callTool: typeof call = call;

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
  [key: string]: unknown;
}

export interface ServerInfoPayload {
  tools?: ToolInfo[];
  [key: string]: unknown;
}

/**
 * The server's tools/list result (name, description, inputSchema per tool),
 * with every DENY_LIST tool STRIPPED OUT.
 *
 * Filtering here rather than at each render site is deliberate: this is the
 * single choke point every consumer goes through -- the `tools` CLI verb, its
 * `--json` dump, and recover.mjs -- so a forbidden tool is not merely marked
 * as forbidden, it never appears at all. An agent cannot be tempted by a tool
 * it never learns exists, and a discovery listing that shows a tool the seam
 * would refuse anyway is just an invitation to try it.
 *
 * This does NOT replace the DENY_LIST guard in call(). Discovery filtering
 * and call-time refusal are independent layers: one hides the tool, the other
 * refuses it even when the name was obtained some other way.
 */
export async function serverInfo(): Promise<unknown> {
  await ensureInitialized();
  const payload = await rpc("tools/list", {});
  if (!isPlainObject(payload) || !Array.isArray(payload.tools)) return payload;
  const tools = payload.tools as ToolInfo[];
  return { ...payload, tools: tools.filter((t) => !DENY_LIST.includes(t?.name)) };
}
