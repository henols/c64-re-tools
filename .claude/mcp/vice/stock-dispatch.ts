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
import { MonitorOwnershipError, type HeldLease } from "./vice-broker-client.ts";
import { MachineRestartedError } from "./vice.ts";
import { stockConnect, stockDisconnect, stockReconnect, type StockConnectSession } from "./stock-connect.ts";

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
 * `vice_ping`'s answer -- the resolved binary path `resolvedBackend()`
 * already determined. It is a plain string handed down from vice-proxy.ts's
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

  const session = await connectFn({ host: lease.host, port: lease.port, targetId: lease.targetId, brokerControl: lease.brokerControl });
  heldSession = session;
  return { ok: true, session };
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

/** The shape every stock dispatch handler returns -- structurally IDENTICAL
 * to vice-proxy.ts's own private ToolCallResult (ErrorTextResult |
 * OkTextResult), by field name and type, but declared here rather than
 * imported: vice-proxy.ts imports THIS file (Task 2), so importing back from
 * it would be the exact module-cycle this codebase's own "module-cycle
 * avoidance is deliberate" constraint forbids. TypeScript's structural
 * typing makes the two interchangeable at every call site that matters --
 * see vice-proxy.ts's own tools-construction loop, where a value of this
 * type flows into a parameter typed as vice-proxy.ts's ToolCallResult with
 * no adapter needed. */
export interface StockErrorResult {
  content: { type: "text"; text: string }[];
  isError: true;
}
export interface StockOkResult {
  content: { type: "text"; text: string }[];
  isError: false;
}
export type StockToolResult = StockErrorResult | StockOkResult;

function isErrorText(text: string): StockErrorResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** One stock dispatch table entry. `deps` is the SAME StockDispatchDeps
 * ensureStockSession() itself takes -- a handler that needs a live session
 * reaches it only through ensureStockSession(deps), never by resolving a
 * lease or opening a socket of its own (that would be a second acquisition
 * path, the exact thing ensureStockSession()'s own header comment
 * prohibits). */
export type StockHandler = (args: Record<string, unknown>, deps: StockDispatchDeps) => Promise<StockToolResult>;

/** Converts the two typed errors ensureStockSession()/stockConnect() can
 * propagate into well-formed refusal text, naming the tool. Never mentions
 * "wedge", "hung", or "unresponsive" -- a monitor-ownership conflict is the
 * broker's own enforcement of a DIFFERENT grant already holding this
 * instance, a state vice-wedge-triage's opening move must not be misdirected
 * by into treating as a wedged emulator (T-02-14, this file's own
 * prohibition list). Anything else escaping a handler is converted too,
 * generically, so no handler can ever let an exception reach the never-throw
 * boundary one layer up in vice-proxy.ts. */
function convertHandshakeError(toolName: string, err: unknown): StockErrorResult {
  if (err instanceof MonitorOwnershipError) {
    return isErrorText(
      `${toolName}: this instance's monitor socket is already claimed by a different grant ` +
        `(grant ${err.holderGrantId ?? "unknown"}, claimed at ${err.holderClaimedAt ?? "unknown"}, port ${err.port ?? "unknown"}) -- ` +
        `only one client may hold the stock monitor socket at a time.`,
    );
  }
  if (err instanceof MachineRestartedError) {
    return isErrorText(
      `${toolName}: the emulator's identity could not be proven across a reconnect ` +
        `(baseline epoch ${String(err.baselineEpoch)}, current epoch ${String(err.currentEpoch)}) -- ` +
        `treat every result since the previous call as void and retry.`,
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return isErrorText(`${toolName}: stock handshake failed (${message}).`);
}

/**
 * The `vice_ping` table entry -- BACK-03's answer, on the tool an agent
 * already reaches for first. Obtains a live session SOLELY through
 * ensureStockSession(deps): no broker coordinates resolved, no socket
 * opened, and no stockConnect() call, here. On a refusal (`{ ok: false }`)
 * returns that refusal's own message verbatim -- never re-worded. On success
 * enriches the ordinary ping answer with the three BACK-03 fields: `backend`
 * (always `"stock"` on this path), `viceVersion` (rendered from the
 * handshake's own version quad), and `resolvedBinaryPath` (threaded down
 * from deps, never resolved here -- see StockDispatchDeps's own header
 * comment on why).
 */
async function viceHandlerPing(_args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  let outcome: EnsureStockSessionOutcome;
  try {
    outcome = await ensureStockSession(deps);
  } catch (err) {
    return convertHandshakeError("vice_ping", err);
  }

  if (!outcome.ok) {
    return isErrorText(outcome.message);
  }

  const session = outcome.session;
  const payload = {
    status: "ok",
    backend: "stock" as const,
    viceVersion: `VICE ${session.versionQuad}`,
    resolvedBinaryPath: deps.resolvedBinaryPath ?? "",
    capabilities: session.capabilities,
  };
  return { content: [{ type: "text", text: JSON.stringify(payload) }], isError: false };
}

/** The ONE dispatch table this whole module tree ever defines (D-09) --
 * keyed on manifest tool name. A later plan (phases 3-7) adds its own stock
 * entries here, never a parallel table or a second dispatch site in
 * vice-proxy.ts (grep-gated to exactly one `dispatchStock(` call there,
 * plan 02-10 task 2's own acceptance criteria). */
const STOCK_DISPATCH_TABLE: Record<string, StockHandler> = {
  vice_ping: viceHandlerPing,
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
 * forwardToVice() anywhere in this file or anything it calls -- that is
 * D-09's whole point, grep-gated to zero occurrences of that name in this
 * file's own code lines.
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
