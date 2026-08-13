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
import type { HeldLease } from "./vice-broker-client.ts";
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
 * Injected dependencies for ensureStockSession(). `connect`/`reconnect`
 * exist SOLELY so tests can stub the socket-touching half of this seam --
 * production code passes neither, and stockConnect/stockReconnect (the real
 * imports) are the defaults. Tests must never stub ensureStockSession
 * itself: that is the wiring under test.
 */
export interface StockDispatchDeps {
  ensureLease: LeaseProvider;
  connect?: typeof stockConnect;
  reconnect?: typeof stockReconnect;
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
 *      instance) call stockConnect() fresh and hold its result.
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
  clearHeldStockSession();
  const session = await connectFn({ host: lease.host, port: lease.port, targetId: lease.targetId, brokerControl: lease.brokerControl });
  heldSession = session;
  return { ok: true, session };
}

// Re-exported so a caller of this seam never needs a second import site for
// the connect-handshake types it already threads through -- avoids a
// consumer accidentally importing stock-connect.ts's stockDisconnect
// directly from two different specifiers.
export { stockDisconnect };
