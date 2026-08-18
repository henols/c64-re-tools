#!/usr/bin/env node
// stock-dispatch.ts
//
// THE ONE PLACE the stock tool surface is defined and dispatched (D-07,
// D-09). D-07 makes the two backends' advertised tool lists genuinely
// different, permanently -- not a runtime filter over one shared list, but
// a second committed manifest file (tools-manifest.stock.json) this module
// selects between. D-09 says the stock path must never fall through to the
// fork's HTTP forward: a tool this file does not dispatch is simply not on
// the stock manifest, so vice-proxy.ts's tools/list answer never advertises
// it and there is nothing for a fall-through to catch.
//
// This plan (02-09) lands the manifest selector (manifestPathForBackend())
// and (Task 2, added below) the lease-to-session seam (ensureStockSession(),
// HeldLease on vice-broker-client.ts). Plan 02-10 adds the dispatch table
// itself, vice_ping, and the vice-proxy.ts wiring on top of this file.
//
// WHAT NOT TO DO:
//   - Never fall through to forwardToVice() from this module or from
//     anything built on top of it -- a stock tool call that reaches here
//     with no dispatch entry must be refused, never silently forwarded to
//     the fork's HTTP transport (D-09).
//   - Never add a second dispatch site in vice-proxy.ts -- this file is the
//     one place a tools/call for the stock backend is routed from.
//   - Never acquire a broker lease here (Task 2's own ensureStockSession()
//     header comment explains this prohibition fully).
import { resolve, join } from "node:path";

import type { ViceBackend } from "./backend-detect.mts";
import { type HeldLease } from "./vice-broker-client.ts";
import { stockConnect, stockDisconnect, stockReconnect, type StockConnectSession, type StockConnectDeps } from "./stock-connect.ts";
import {
  isErrorText,
  convertHandshakeError,
  convertWireError,
  stockAnswer,
  type StockToolResult,
  type StockOkResult,
  type StockErrorResult,
  type StockSessionHandler,
} from "./stock-handler.ts";
import { attachRunStateTracker } from "./stock-runstate.ts";
import { STOCK_DERIVED_TOOLS, type DerivedPureHandler } from "./stock-derived.ts";

// The six family modules (plans 03-06 through 03-11) -- each exports its
// tools as StockSessionHandler-shaped values; this file (D-09) is the ONE
// place they are registered into STOCK_DISPATCH_TABLE, below. Import order
// mirrors the table's own family grouping (Task 2, plan 03-12).
import { handleMemoryRead, handleMemoryWrite, handleMemoryBanks } from "./stock-memory.ts";
import { handleRegistersGet, handleRegistersSet, handleRegistersAvailable } from "./stock-registers.ts";
import {
  handleCheckpointAdd,
  handleCheckpointDelete,
  handleCheckpointList,
  handleCheckpointToggle,
  handleCheckpointSetCondition,
  handleWatchAdd,
  forgetConditionsForOtherTargets,
} from "./stock-checkpoints.ts";
import { handleExecutionPause, handleExecutionRun, handleExecutionStep, handleExecutionUntilReturn } from "./stock-execution.ts";
import { handleMachineReset, handleAutostart, handleDiskAttach, handleSnapshotSave, handleSnapshotLoad } from "./stock-machine.ts";
import { handleKeyboardType, handleKeyboardPetscii, handleJoystickSet } from "./stock-input.ts";
import { handleDisassemble } from "./stock-disassemble.ts";
import { handleMemorySearch, handleMemoryCompare } from "./stock-memory-search.ts";
import { handleSymbolsLoad, handleSymbolsLookup } from "./stock-symbols.ts";
import { handleViciiGetState } from "./stock-vicii.ts";
import { handleCiaGetState } from "./stock-cia.ts";
import { handleSpriteGet, handleSpriteInspect } from "./stock-sprites.ts";
import { handleCyclesStopwatch } from "./stock-timing.ts";
import { handleRunUntil } from "./stock-run-until.ts";
import { handleDiagnoseStock } from "./stock-diagnose.ts";
import { handleRecycleStock } from "./stock-recycle.ts";

// Re-exported so Phase 2's existing import surface (and its 921-line test
// file) keeps working unchanged -- these four names used to be DEFINED
// here; stock-handler.ts (Task 3, this plan) is now their one true home,
// broken out so a family module can import them without importing this
// file back (see that file's own header comment on the cycle this avoids).
export { isErrorText, convertHandshakeError, convertWireError };
export type { StockToolResult, StockOkResult, StockErrorResult };

// ---------------------------------------------------------------------------
// manifestPathForBackend() -- the manifest selector.
// ---------------------------------------------------------------------------

/**
 * Resolves which manifest file backs a given backend's advertised tool
 * surface, following the EXACT override precedence vice-proxy.ts's own
 * manifestPath() already establishes: an explicit VICE_TOOLS_MANIFEST value
 * (passed in as `envOverride`, never read from process.env directly here --
 * this function stays a pure, injectable seam) wins for either backend,
 * unchanged; otherwise the backend picks its own committed default file
 * beside `hereDir`. `envOverride` is deliberately a plain parameter, not a
 * process.env read, so this function has no hidden global dependency and a
 * test can drive every combination without mutating the real environment.
 */
export function manifestPathForBackend(backend: ViceBackend, hereDir: string, envOverride: string | undefined): string {
  if (envOverride) {
    return resolve(envOverride);
  }
  return backend === "stock" ? join(hereDir, "tools-manifest.stock.json") : join(hereDir, "tools-manifest.json");
}

// ---------------------------------------------------------------------------
// ensureStockSession() -- the lease-to-session seam (Task 2).
// ---------------------------------------------------------------------------

/**
 * Injection contract for ensureStockSession() below. Deliberately the exact
 * widened shape vice-proxy.ts's own ensureBrokerLease() returns after plan
 * 02-10 task 2, so ensureBrokerLease itself is structurally assignable to a
 * LeaseProvider with no adapter function wrapping it:
 *   - `{ ok: true; lease: HeldLease | null }` on success. `lease: null` is
 *     the VICE_MCP_URL override case, where no broker control session
 *     exists to claim through.
 *   - `{ ok: false; message: string }` on a broker liveness failure --
 *     never_started / dead_or_hung / control_unreachable / warming, in
 *     ensureBrokerLease()'s own wording, passed through verbatim.
 */
export type LeaseProvider = () => Promise<{ ok: true; lease: HeldLease | null } | { ok: false; message: string }>;

/**
 * Injected dependencies for ensureStockSession() and, below, every stock
 * dispatch handler. `connect`/`reconnect` exist SOLELY so tests can stub the
 * socket-touching half of this seam -- production code passes neither, and
 * stockConnect/stockReconnect (the real imports) are the defaults. Tests
 * must never stub ensureStockSession itself: that is the wiring under test.
 *
 * `resolvedBinaryPath` (Task 1, plan 02-10) is BACK-03's third field on
 * `vice_ping`'s answer -- `resolvedBackend().binPath`, which since WR-05 is a
 * genuinely resolved ABSOLUTE path whenever the binary could be resolved, and
 * the configured name (e.g. `"x64sc"`) only when it could not. Before WR-05
 * this field was always the raw configured name while both this comment and
 * BACK-03's own field name claimed resolution -- so `vice_ping` on stock
 * reported `"x64sc"`, which inside a container names nothing at all.
 * `binaryPathResolved` carries which of the two cases it is, so the answer
 * never implies resolution it did not achieve. It is a plain string handed down from vice-proxy.ts's
 * OWN single, module-scope call to `resolvedBackend()` (see that file's own
 * "resolve the active backend once" discipline) -- this module must never
 * call `resolvedBackend()`/`probeBackend()` itself, per backend-detect.mts's
 * own "do not call this per tool or per call" prohibition. Omitted entirely
 * (never expected in production) falls back to an empty string rather than
 * throwing.
 */
export interface StockDispatchDeps {
  ensureLease: LeaseProvider;
  connect?: typeof stockConnect;
  reconnect?: typeof stockReconnect;
  resolvedBinaryPath?: string;
  /** WR-05: whether `resolvedBinaryPath` above is a real resolved absolute path
   * (`true`) or the configured name resolution failed on (`false`). Threaded
   * down from the SAME single `resolvedBackend()` call, never recomputed.
   * Omitted defaults to `false` -- the honest answer when nothing said
   * otherwise. */
  resolvedBinaryPathIsResolved?: boolean;
}

export type EnsureStockSessionOutcome = { ok: true; session: StockConnectSession } | { ok: false; message: string };

// The ONE module-level holder for the live stock session, plus the ONE
// clearing function. Never a second holder, and never a holder of the
// lease itself (only of the CONNECTED session stockConnect() returned) --
// the lease is re-obtained from the provider on every call, per
// ensureStockSession()'s own header comment on why that re-consultation is
// free.
let heldSession: StockConnectSession | null = null;

/** Discards the held session without touching anything broker-side --
 * stockDisconnect()/releaseMonitor() are a caller's concern (plan 02-10's
 * dispatch seam), not this function's. Exported so a later plan's dispatch
 * seam can force a fresh handshake on a typed error it decides to convert
 * rather than propagate, without reaching into this module's private state
 * any other way. */
export function clearHeldStockSession(): void {
  heldSession = null;
}

/**
 * The ONE place a stock handler turns a broker-granted lease into a live
 * stockConnect() session, in this load-bearing order:
 *
 *   1. Await deps.ensureLease() FIRST, always -- before anything else in
 *      this function runs, and before stockConnect() is ever reached. This
 *      is what makes D-13's "the claim precedes every dial" guarantee true
 *      for the stock path: ensureBrokerLease()'s own body performs the
 *      liveness classification, control-session open, and grant
 *      acquisition; nothing here re-derives any part of that.
 *   2. On `{ ok: false }`, return the provider's own `message` verbatim --
 *      never re-worded. ensureBrokerLease()'s never_started / dead_or_hung /
 *      control_unreachable / warming diagnostics are its own to phrase.
 *   3. On `{ ok: true, lease: null }` (the VICE_MCP_URL override, where no
 *      broker control session exists), refuse explicitly: the stock backend
 *      cannot claim a monitor socket it has no control session to claim
 *      through, so stockConnect() must never be attempted.
 *   4. Otherwise reuse the held session when its targetId matches the
 *      lease's -- and only otherwise (no held session, or a targetId
 *      mismatch, which means a REPLACEMENT acquisition granted a different
 *      instance) TEAR DOWN whatever was held via stockDisconnect() (CR-05:
 *      dropping the reference alone leaks a live socket into stock VICE's
 *      single client slot) and then call stockConnect() fresh and hold its
 *      result.
 *   5. A held session whose underlying socket has already died
 *      (`!session.client.connected`) is not silently reused: it is
 *      re-established via stockReconnect() (which itself re-proves machine
 *      identity via the epoch baseline before re-running the handshake) --
 *      a failure there (MachineRestartedError, or anything else) clears the
 *      holder before propagating, so a future call re-handshakes from
 *      scratch rather than ever retrying against a session known to be bad.
 *
 * The provider is called on EVERY invocation, never cached here:
 * ensureBrokerLease()'s own first line already returns immediately when a
 * control session is already held, so calling it per dispatch is free --
 * and it is the only thing that notices a replacement acquisition
 * happened. Caching the lease in this module instead would be a second,
 * staler copy of state vice-proxy.ts already owns (the "re-deriving a
 * cross-cutting seam locally" anti-pattern, aimed at the lease this time
 * rather than the acquisition itself).
 *
 * This function must NEVER call openBrokerControl(), session.acquire(), or
 * adoptGrant(); NEVER read broker.json; and NEVER construct a host or port
 * from anything but the lease deps.ensureLease() handed it. D-13's
 * guarantee -- nothing reaches a second connect() -- only holds if there is
 * exactly one acquisition, and the monitor_claim inside stockConnect() is
 * made on the control session THAT acquisition produced. A locally-derived
 * control session here would claim on one connection while a different one
 * held the grant -- the "re-deriving a cross-cutting seam locally"
 * anti-pattern with a wedge-shaped failure mode (a refused claim that never
 * arrives, because the connection expecting the refusal is not the one that
 * holds the grant).
 *
 * MonitorOwnershipError and every other typed error stockConnect()/
 * stockReconnect() can throw propagate unchanged out of this function --
 * the never-throw conversion into a well-formed tool result is the dispatch
 * seam's job (plan 02-10), not this function's.
 */
export async function ensureStockSession(deps: StockDispatchDeps): Promise<EnsureStockSessionOutcome> {
  const connectFn = deps.connect ?? stockConnect;
  const reconnectFn = deps.reconnect ?? stockReconnect;

  const leaseOutcome = await deps.ensureLease();
  if (!leaseOutcome.ok) {
    return { ok: false, message: leaseOutcome.message };
  }

  const lease = leaseOutcome.lease;
  if (lease === null) {
    return {
      ok: false,
      message:
        "ensureStockSession: VICE_MCP_URL is set, so there is no broker-managed instance and no broker control " +
        "session to claim a monitor socket through -- the stock backend needs a broker-managed instance in order " +
        "to claim the monitor socket before dialling. Unset VICE_MCP_URL to use the on-demand broker, or connect " +
        "to a broker-managed instance directly.",
    };
  }

  if (heldSession !== null && heldSession.targetId === lease.targetId) {
    if (heldSession.client.connected) {
      return { ok: true, session: heldSession };
    }
    try {
      heldSession = await reconnectFn(heldSession);
      // D-06/RESEARCH.md Pitfall 4: attach HERE, at the fresh client a
      // reconnect just produced -- never in the `heldSession.client.connected`
      // reuse branch above. The tracker attach is idempotent (a stray extra
      // call on the SAME client is harmless), but a reconnect always hands
      // back a NEW ViceMonitorClient, so this is a genuinely fresh client
      // that has never had one attached. Getting this placement wrong would
      // mean the D-11 trace guard's rate-limiter listener could attach a
      // second time on a client already tracked elsewhere and fire its side
      // effect (a CHECKPOINT_TOGGLE) more than once per real event.
      attachRunStateTracker(heldSession.client);
      return { ok: true, session: heldSession };
    } catch (err) {
      clearHeldStockSession();
      throw err;
    }
  }

  // No held session, or the lease now names a different targetId -- a
  // replacement acquisition means a different instance underneath, so
  // whatever was held is discarded rather than reused.
  //
  // CR-05 (code review 2026-08-13): DISCARDED, not merely DEREFERENCED. The
  // previous session's ViceMonitorClient is still connected at this point --
  // its socket, its data/close/error listeners, its pending map and its
  // broker-side monitorClient claim all outlive the reference, and the holder
  // is module-private, so nulling it was the last chance anything had to
  // release them. Because stock VICE services exactly ONE binmon client, that
  // leaked socket keeps occupying the instance's single client slot: if the
  // broker later hands the same port out again (a recycle/respawn builds a
  // fresh InstanceRecord, so monitorClient is cleared and a new claim
  // succeeds), the new client's connect() sits unserviced in the backlog with
  // no reply and no EOF -- the state CLAUDE.md says must never be reachable
  // and must never be diagnosed as a hang.
  //
  // stockDisconnect() is the ONE teardown that disconnects the socket AND
  // releases the monitor claim together (its own header comment: a caller must
  // never end up holding one without the other). Best-effort: a teardown
  // failure on the OUTGOING session must not stop the replacement handshake,
  // and the holder is cleared FIRST so a throw can never leave a dead session
  // installed.
  const stale = heldSession;
  heldSession = null;
  if (stale !== null) {
    try {
      await stockDisconnect(stale);
    } catch (err) {
      console.error(`ensureStockSession: tearing down the replaced stock session for target ${stale.targetId} did not complete: ${String(err)}`);
    }
  }

  const session = await connectFn({
    host: lease.host,
    port: lease.port,
    targetId: lease.targetId,
    brokerControl: lease.brokerControl,
    deps: stockConnectDepsFor(lease, deps),
  });
  // D-06/RESEARCH.md Pitfall 4 (same placement rule as the reconnect branch
  // above): attach the tracker to this BRAND NEW client, immediately after
  // stockConnect() returns it -- never inside stockConnect() itself. The
  // handshake stockConnect() just ran sends its own PING and a CR-02 EXIT;
  // projecting that internal pair as the user's own run state would
  // contradict D-07's honest "unknown" (the agent has not resumed anything
  // yet, and a stale connect-time assumption is exactly what D-07 forbids).
  attachRunStateTracker(session.client);
  heldSession = session;
  // WR-03 (03-REVIEW.md): THE eviction point for stock-checkpoints.ts's
  // targetId-keyed condition registry. Reaching this line means a fresh
  // handshake just installed a new held session, so every OTHER target this
  // process has ever seen is an instance that has already been torn down and
  // can never be consulted again -- without this, that registry (a strong Map,
  // deliberately, so it survives a stockReconnect() to the same machine) would
  // grow one entry per distinct instance for the life of the process, which a
  // broker that recycles/respawns/re-warms routinely makes unbounded.
  //
  // Placed here rather than beside the stockDisconnect() teardown above so it
  // also covers the path where the holder was cleared by a FAILED
  // stockReconnect() and its stale targetId was never handed to a teardown at
  // all. The reuse and reconnect branches return before this line, so a
  // reconnect to the SAME machine never evicts anything.
  forgetConditionsForOtherTargets(session.targetId);
  return { ok: true, session };
}

/**
 * CR-06 (code review 2026-08-13). The ONE place production builds
 * StockConnectDeps. Before this existed, the only production call was
 * `connectFn({ host, port, targetId, brokerControl })` -- no `deps` at all --
 * so two mechanisms this phase built were inert on the real path:
 *
 *   - `deps.epochPath` was undefined, so `baselineEpoch` was always null and
 *     stockReconnect()'s first branch ALWAYS threw MachineRestartedError.
 *     Every transient socket drop told the agent "the emulator's identity
 *     could not be proven across a reconnect ... treat every result since the
 *     previous call as void", even when the machine never restarted.
 *   - `deps.binPath`/`deps.supervisorDir` were undefined, so
 *     resolveCapabilities() skipped the cache, re-probed CPUHISTORY_GET on
 *     every handshake, and never called writeCapabilityRecord() -- BACK-04's
 *     "settle once per binary, at connect time" was not achieved.
 *
 * Neither was visible to the existing tests, because both stub `connect`.
 *
 * Every value here is HANDED DOWN, never resolved locally: the two directories
 * come from the lease vice-proxy.ts built (see HeldLease's own field comments
 * for why they are two DIFFERENT directories), and `binPath` is the same
 * already-settled `resolvedBinaryPath` vice_ping reports -- this module must
 * never call resolvedBackend()/probeBackend() itself.
 *
 * An empty string is treated as ABSENT rather than passed through: the two
 * consumers both branch on truthiness, and passing "" would key a capability
 * cache read on an empty binary path.
 */
function stockConnectDepsFor(lease: HeldLease, deps: StockDispatchDeps): StockConnectDeps {
  const connectDeps: StockConnectDeps = {};
  if (lease.epochFile) connectDeps.epochPath = lease.epochFile;
  if (lease.supervisorDir) connectDeps.supervisorDir = lease.supervisorDir;
  if (deps.resolvedBinaryPath) connectDeps.binPath = deps.resolvedBinaryPath;
  return connectDeps;
}

// Re-exported so a caller of this seam never needs a second import site for
// the connect-handshake types it already threads through -- avoids a
// consumer accidentally importing stock-connect.ts's stockDisconnect
// directly from two different specifiers.
export { stockDisconnect };

// ---------------------------------------------------------------------------
// dispatchStock() -- the dispatch table and hard refusal (Task 1, plan 02-10).
// ---------------------------------------------------------------------------
//
// D-09's whole point, restated at the point it is enforced: a tool call that
// reaches dispatchStock() below either matches a table entry and is answered
// by name, or matches nothing and is refused by name -- there is no third
// path, and in particular no fall-through to forwardToVice() (vice-proxy.ts's
// fork-transport function). This file has no code reference to that name at
// all; a source-structure test in stock-dispatch.test.ts and a grep gate in
// this plan's own acceptance criteria both confirm it stays that way.

/** One stock dispatch table entry. `deps` is the SAME StockDispatchDeps
 * ensureStockSession() itself takes -- a handler that needs a live session
 * reaches it only through ensureStockSession(deps), never by resolving a
 * lease or opening a socket of its own (that would be a second acquisition
 * path, the exact thing ensureStockSession()'s own header comment
 * prohibits). */
export type StockHandler = (args: Record<string, unknown>, deps: StockDispatchDeps) => Promise<StockToolResult>;

/**
 * withStockSession -- THE ONE adapter every STOCK_DISPATCH_TABLE entry goes
 * through (Task 1, plan 03-12). Before this existed, `viceHandlerPing` was
 * the only table entry and re-implemented, inline, the exact three-step
 * preamble every one of the 24 Phase 3 family handlers also needs: acquire a
 * session through ensureStockSession(deps), convert a thrown handshake error
 * or a `{ ok: false }` refusal into well-formed refusal text, and only THEN
 * hand off to the tool's own logic. This function performs that preamble
 * exactly once, for every tool, so 24 handlers do not each re-implement
 * session-acquisition and error conversion themselves -- a table entry that
 * bypasses this adapter (calling ensureStockSession() or a family handler
 * directly) is a bug, not a variant.
 *
 * Order, exactly as `viceHandlerPing` established:
 *   1. `ensureStockSession(deps)`, wrapped in its own try/catch --
 *      `convertHandshakeError(toolName, err)` on a thrown handshake error
 *      (MonitorOwnershipError, MachineRestartedError, or anything else
 *      stockConnect()/stockReconnect() can propagate).
 *   2. `{ ok: false }` -- returns `outcome.message` verbatim, never re-worded
 *      (the provider's own diagnostic, e.g. a broker liveness classification).
 *   3. Otherwise delegates to `handler(args, outcome.session, deps)`, itself
 *      wrapped in a SECOND try/catch: anything a family handler lets escape
 *      becomes `convertWireError(toolName, err)` rather than an uncaught
 *      rejection. vice-proxy.ts's stdio server is never restarted by Claude
 *      Code for the rest of the session (T-3-04) -- a single escaped
 *      exception here would silently end the session's entire tool surface,
 *      not just this one call.
 */
export function withStockSession(toolName: string, handler: StockSessionHandler): StockHandler {
  return async (args, deps) => {
    let outcome: EnsureStockSessionOutcome;
    try {
      outcome = await ensureStockSession(deps);
    } catch (err) {
      return convertHandshakeError(toolName, err);
    }

    if (!outcome.ok) {
      return isErrorText(outcome.message);
    }

    try {
      return await handler(args, outcome.session, deps);
    } catch (err) {
      return convertWireError(toolName, err);
    }
  };
}

/**
 * withDerivedTool -- THE ONE adapter for a tool whose answer is computed
 * CLIENT-SIDE (DERIV-07), sitting immediately beside withStockSession()
 * above. Derived-ness is a property of WHICH ADAPTER wraps a handler, NEVER
 * a routing decision (D-03) -- there is still exactly one
 * STOCK_DISPATCH_TABLE and exactly one dispatchStock( call site in
 * vice-proxy.ts. A derived tool registers into the SAME table a direct tool
 * does, through this adapter instead of withStockSession().
 *
 * Refuses any `toolName` not declared in STOCK_DERIVED_TOOLS -- at CALL
 * TIME, inside the returned handler, never as a module-scope throw (the
 * table literal below is evaluated at import time, and a throw there would
 * kill the whole stdio server before it starts).
 *
 * `needsSession: false` exists because D-05 of Phase 3 makes every touch of
 * the wire a machine halt, so an emulator-free derived tool must not stop
 * the user's running program for nothing (D-04). Its returned handler NEVER
 * calls ensureStockSession() at all -- not a lighter-weight variant of it
 * (04-RESEARCH.md Pitfall 3) -- and invokes `handler(args, deps)` inside a
 * single try/catch converting through convertWireError(), so the
 * never-throw boundary still holds.
 *
 * `needsSession: true` runs the EXACT same three-step preamble
 * withStockSession() runs, reusing the same imported converters -- never a
 * third error converter (stock-handler.ts's standing rule): ensureStockSession(deps)
 * inside its own try/catch -> convertHandshakeError(toolName, err); a
 * `{ ok: false }` outcome returns outcome.message verbatim through
 * isErrorText(), never re-worded; otherwise handler(args, outcome.session, deps)
 * inside a SECOND try/catch -> convertWireError(toolName, err).
 */
export function withDerivedTool(toolName: string, opts: { needsSession: true }, handler: StockSessionHandler): StockHandler;
export function withDerivedTool(toolName: string, opts: { needsSession: false }, handler: DerivedPureHandler): StockHandler;
export function withDerivedTool(
  toolName: string,
  opts: { needsSession: boolean },
  handler: StockSessionHandler | DerivedPureHandler,
): StockHandler {
  return async (args, deps) => {
    if (!STOCK_DERIVED_TOOLS.has(toolName)) {
      return isErrorText(`${toolName} is not declared in STOCK_DERIVED_TOOLS -- withDerivedTool refuses any undeclared tool.`);
    }

    if (!opts.needsSession) {
      try {
        return await (handler as DerivedPureHandler)(args, deps);
      } catch (err) {
        return convertWireError(toolName, err);
      }
    }

    let outcome: EnsureStockSessionOutcome;
    try {
      outcome = await ensureStockSession(deps);
    } catch (err) {
      return convertHandshakeError(toolName, err);
    }

    if (!outcome.ok) {
      return isErrorText(outcome.message);
    }

    try {
      return await (handler as StockSessionHandler)(args, outcome.session, deps);
    } catch (err) {
      return convertWireError(toolName, err);
    }
  };
}

/**
 * The `vice_ping` handler -- BACK-03's answer, on the tool an agent already
 * reaches for first. A plain StockSessionHandler now that withStockSession
 * owns the session-acquisition/error-conversion preamble; this function's
 * only job is to build the answer once a live session already exists.
 * Enriches the ordinary ping answer with the three BACK-03 fields: `backend`
 * (always `"stock"` on this path), `viceVersion` (rendered from the
 * handshake's own version quad), and `resolvedBinaryPath` (threaded down
 * from deps, never resolved here -- see StockDispatchDeps's own header
 * comment on why). Built through stockAnswer() so the answer now also
 * carries `runState` (D-06: every stock answer, and `vice_ping` is a stock
 * answer) alongside every field that was already there.
 */
const handlePing: StockSessionHandler = async (_args, session, deps) => {
  return stockAnswer(session.client, {
    status: "ok",
    backend: "stock" as const,
    viceVersion: `VICE ${session.versionQuad}`,
    resolvedBinaryPath: deps.resolvedBinaryPath ?? "",
    // WR-05: says outright whether the field above IS a resolved path. Without
    // it, an agent reading `"x64sc"` cannot tell "this is where the binary is"
    // from "this is what we were told to look for, and we could not find it".
    resolvedBinaryPathIsResolved: deps.resolvedBinaryPathIsResolved ?? false,
    capabilities: session.capabilities,
  });
};

/**
 * Deliberately NOT registered below -- each omission is a planner decision,
 * not an oversight (Task 2, plan 03-12):
 *   - `vice_checkpoint_set_ignore_count` (D-15)
 *   - `vice_snapshot_list` (D-16 -- deleted from both manifests)
 *   - `vice_disk_detach` (D-13 -- Phase 7, via the text monitor)
 *   - `vice_joystick_tap` (needs a resume plus Phase 7's timing route)
 *   - `vice_disk_read_sector` (CUT from scope 2026-08-17 -- no skill calls it; see ROADMAP.md "Cut from scope (v0.2.0, 2026-08-17)" and docs/stock-vice-parity.md item 6)
 *   - `vice_sid_get_state` and the low-level keyboard family (hard losses)
 *   - `vice_machine_config_get` / `vice_machine_config_set` (Phase 6)
 * `dispatchStock()`'s miss branch already refuses any of these by name,
 * without reading `deps` -- there is nothing else to add for them here.
 */

/** The ONE dispatch table this whole module tree ever defines (D-09) --
 * keyed on manifest tool name. All 24 Phase 3 family tools plus vice_ping
 * are registered here, each through withStockSession (never called
 * directly, never a parallel table, never a second dispatch site in
 * vice-proxy.ts -- grep-gated to exactly one `dispatchStock(` call there,
 * plan 02-10 task 2's own acceptance criteria). A later plan (phases 4-7)
 * adds its own stock entries here as those phases' tools land. */
const STOCK_DISPATCH_TABLE: Record<string, StockHandler> = {
  vice_ping: withStockSession("vice_ping", handlePing),

  // memory (DIRECT-01, DIRECT-09)
  vice_memory_read: withStockSession("vice_memory_read", handleMemoryRead),
  vice_memory_write: withStockSession("vice_memory_write", handleMemoryWrite),
  vice_memory_banks: withStockSession("vice_memory_banks", handleMemoryBanks),

  // registers (DIRECT-02, DIRECT-09)
  vice_registers_get: withStockSession("vice_registers_get", handleRegistersGet),
  vice_registers_set: withStockSession("vice_registers_set", handleRegistersSet),
  // stock-only, no fork counterpart (Phase 2 D-07)
  vice_registers_available: withStockSession("vice_registers_available", handleRegistersAvailable),

  // checkpoints and watchpoints (DIRECT-03)
  vice_checkpoint_add: withStockSession("vice_checkpoint_add", handleCheckpointAdd),
  vice_checkpoint_delete: withStockSession("vice_checkpoint_delete", handleCheckpointDelete),
  vice_checkpoint_list: withStockSession("vice_checkpoint_list", handleCheckpointList),
  vice_checkpoint_toggle: withStockSession("vice_checkpoint_toggle", handleCheckpointToggle),
  vice_checkpoint_set_condition: withStockSession("vice_checkpoint_set_condition", handleCheckpointSetCondition),
  vice_watch_add: withStockSession("vice_watch_add", handleWatchAdd),

  // execution (DIRECT-04, DIRECT-05)
  vice_execution_pause: withStockSession("vice_execution_pause", handleExecutionPause),
  vice_execution_run: withStockSession("vice_execution_run", handleExecutionRun),
  vice_execution_step: withStockSession("vice_execution_step", handleExecutionStep),
  // stock-only, no fork counterpart
  vice_execution_until_return: withStockSession("vice_execution_until_return", handleExecutionUntilReturn),

  // machine and snapshots (DIRECT-06, DIRECT-08)
  vice_machine_reset: withStockSession("vice_machine_reset", handleMachineReset),
  vice_autostart: withStockSession("vice_autostart", handleAutostart),
  vice_disk_attach: withStockSession("vice_disk_attach", handleDiskAttach),
  vice_snapshot_save: withStockSession("vice_snapshot_save", handleSnapshotSave),
  vice_snapshot_load: withStockSession("vice_snapshot_load", handleSnapshotLoad),

  // input (DIRECT-07)
  vice_keyboard_type: withStockSession("vice_keyboard_type", handleKeyboardType),
  vice_keyboard_petscii: withStockSession("vice_keyboard_petscii", handleKeyboardPetscii),
  vice_joystick_set: withStockSession("vice_joystick_set", handleJoystickSet),

  // derived (DERIV-07, DISASM-01)
  vice_disassemble: withDerivedTool("vice_disassemble", { needsSession: true }, handleDisassemble),

  // derived (DERIV-01)
  vice_memory_search: withDerivedTool("vice_memory_search", { needsSession: true }, handleMemorySearch),
  vice_memory_compare: withDerivedTool("vice_memory_compare", { needsSession: true }, handleMemoryCompare),

  // derived (DERIV-04) -- needsSession:false: pure client-side state, never touches the wire
  vice_symbols_load: withDerivedTool("vice_symbols_load", { needsSession: false }, handleSymbolsLoad),
  vice_symbols_lookup: withDerivedTool("vice_symbols_lookup", { needsSession: false }, handleSymbolsLookup),

  // derived (DERIV-05)
  vice_vicii_get_state: withDerivedTool("vice_vicii_get_state", { needsSession: true }, handleViciiGetState),
  vice_cia_get_state: withDerivedTool("vice_cia_get_state", { needsSession: true }, handleCiaGetState),

  // derived (DERIV-06)
  vice_sprite_get: withDerivedTool("vice_sprite_get", { needsSession: true }, handleSpriteGet),
  vice_sprite_inspect: withDerivedTool("vice_sprite_inspect", { needsSession: true }, handleSpriteInspect),

  // derived (TIME-01)
  vice_cycles_stopwatch: withDerivedTool("vice_cycles_stopwatch", { needsSession: true }, handleCyclesStopwatch),

  // derived (TIME-02)
  vice_run_until: withDerivedTool("vice_run_until", { needsSession: true }, handleRunUntil),

  // derived (TIME-04) -- the two proxy-local synthetic tools (RECYCLE_TOOL/
  // DIAGNOSE_TOOL in vice-proxy.ts), backend-routed to dispatchStock() by
  // buildBackendAwareTool() rather than served from the fork's HTTP
  // transport. Deliberate asymmetry, documented at this call site (see also
  // DerivedPureHandler's amended doc comment in stock-derived.ts):
  // vice_diagnose uses needsSession:false because its own handler acquires
  // the session itself (inside its own try/catch) so it can convert a
  // thrown MonitorOwnershipError into the monitor_held_elsewhere VERDICT
  // rather than let withDerivedTool()'s preamble turn it into refusal text
  // -- the exact generic error string that verdict exists to replace.
  // vice_recycle keeps needsSession:true: it needs a live session to gather
  // evidence and has no verdict vocabulary of its own to preserve.
  vice_diagnose: withDerivedTool("vice_diagnose", { needsSession: false }, handleDiagnoseStock),
  vice_recycle: withDerivedTool("vice_recycle", { needsSession: true }, handleRecycleStock),
};

/** Looks up the table entry for `name` -- `undefined` on a miss, never a
 * refusal object itself (that is dispatchStock()'s job, below): this
 * function is the pure lookup half, kept separate so a caller (or a test)
 * can ask "does the stock backend implement this tool" without triggering
 * any dispatch. */
export function stockHandlerFor(name: string): StockHandler | undefined {
  return STOCK_DISPATCH_TABLE[name];
}

/**
 * The ONE dispatch entry point for the stock backend (D-09). On a hit,
 * delegates to the table entry, unchanged. On a miss, refuses EXPLICITLY --
 * naming the tool, stating the stock backend does not implement it, and
 * naming the fork as the backend that does -- WITHOUT reading `deps` at all
 * (no lease is ever requested for a tool that does not exist on this
 * backend). There is no third branch, and in particular NO fall-through to
 * the fork's HTTP-forwarding path anywhere in this file or anything it calls
 * -- that is D-09's whole point, grep-gated to zero occurrences of that
 * function's name in this file's own code lines.
 */
export async function dispatchStock(name: string, args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const handler = stockHandlerFor(name);
  if (!handler) {
    return isErrorText(
      `${name} is not implemented by the stock backend -- the fork backend provides this tool. ` +
        `Set VICE_BACKEND=fork to use it there, or wait for a later phase to extend the stock dispatch table.`,
    );
  }
  return handler(args, deps);
}
