#!/usr/bin/env node
// stock-session.ts
//
// WHY THIS FILE EXISTS: the one place a stock tool call turns a broker lease
// into a live monitor session, takes the binary channel lock around the
// handler, and converts every failure into a well-formed tool result. It
// imports no tool handlers, so no handler module can form an import cycle
// through it.
//
// WHAT NOT TO DO:
//   - Never acquire a broker lease anywhere but through deps.ensureLease().
//   - Never acquire channel-lock.ts's mutex anywhere but withChannelLockHeld(),
//     and never around the session preamble -- only around the handler.
//   - Never let a handler's exception escape runBinary()/runPure(): the stdio
//     server is not restarted for the rest of the session.
import { type BrokerControlSession, type HeldLease } from "./vice-broker-client.ts";
import type { TransferFileFn } from "./transfer-client.mts";
import { stockConnect, stockDisconnect, stockReconnect, type StockConnectSession, type StockConnectDeps, type DialMonitorSocketFn } from "./stock-connect.ts";
import {
  isErrorText,
  convertHandshakeError,
  convertWireError,
  prefixedWithTool,
  type StockToolResult,
  type StockSessionHandler,
  type DerivedPureHandler,
} from "./stock-handler.ts";
import { attachRunStateTracker } from "./stock-runstate.ts";
import { acquireChannelLock, ChannelLockTimeoutError } from "./channel-lock.ts";
import { syncCheckpointStateForSession } from "./stock-checkpoints.ts";
import { forgetTimingForOtherTargets } from "./stock-timing.ts";

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
 * Injected dependencies for ensureStockSession() and every stock tool
 * handler. `connect`/`reconnect` exist SOLELY so tests can stub the
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
 * call `resolvedBackend()` itself, per backend-detect.mts's own "do not
 * call this per tool or per call" prohibition. Omitted entirely
 * (never expected in production) falls back to an empty string rather than
 * throwing.
 */
export interface StockSessionDeps {
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
  /** Test-only override of channel-lock.ts's acquire bound for THIS call's
   * withChannelLockHeld() wrapping. Production call sites never set this --
   * they always take channel-lock.ts's own CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS
   * default. Exists so a test can observe a ChannelLockTimeoutError (and its
   * refusal text) without waiting out the real ~630-second default. */
  channelLockTimeoutMs?: number;
  /** Test-only override of the relay socket source (Phase 63, plan 63-02)
   * -- threaded into stockConnectDepsFor() below for the binary channel
   * AND passed directly to text-tools.ts's own withTextTool() -> textConnect()
   * call for the text channel, so ONE field lets a test dial a stub server
   * directly for EITHER channel without reaching for the heavier
   * `connect`/`reconnect` full-function overrides above. Production passes
   * none of this; both channels' own module-level defaults (dialMonitorRelay()
   * against the broker's fixed endpoint) apply. */
  dialMonitorSocket?: DialMonitorSocketFn;
  /** How a text-channel tool uploads a staged file. Omitted means
   * transfer-client.mts's transferFileOverEndpoint(); tests inject a fake. */
  transferFile?: TransferFileFn;
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
 * stockDisconnect()/releaseMonitor() are a caller's concern, not this
 * function's. Exported so a caller can force a fresh handshake without
 * reaching into this module's private state any other way. */
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
 * control session is already held, so calling it per tool call is free --
 * and it is the only thing that notices a replacement acquisition
 * happened. Caching the lease in this module instead would be a second,
 * staler copy of state vice-proxy.ts already owns (the "re-deriving a
 * cross-cutting seam locally" anti-pattern, aimed at the lease this time
 * rather than the acquisition itself).
 *
 * This function must NEVER call dialControlSession(), session.acquire(), or
 * adoptGrant(); and NEVER construct a host or port
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
 * the never-throw conversion into a well-formed tool result is runBinary()'s
 * job, not this function's.
 */
export async function ensureStockSession(deps: StockSessionDeps): Promise<EnsureStockSessionOutcome> {
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
      syncCheckpointStateForSession(heldSession);
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
  syncCheckpointStateForSession(session);
  // WR-14 (07-REVIEW.md): stock-timing.ts's two targetId-keyed caches (the
  // video-standard cache and the stopwatch baseline store) are evicted from the
  // SAME line, for the same reasons, so the registries can never drift apart on
  // when they forget. Both are strong Maps deliberately -- they must survive a
  // stockReconnect() to the same machine -- so without this they grow one entry
  // per distinct instance for the life of the process.
  forgetTimingForOtherTargets(session.targetId);
  return { ok: true, session };
}

/**
 * CR-06 (code review 2026-08-13). The ONE place production builds
 * StockConnectDeps. Before this existed, the only production call was
 * `connectFn({ host, port, targetId, brokerControl })` -- no `deps` at all --
 * so two mechanisms this phase built were inert on the real path:
 *
 *   - no epoch source was wired, so `baselineEpoch` was always null and
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
 * Every value here is HANDED DOWN, never resolved locally: `supervisorDir`
 * comes from the lease vice-proxy.ts built, the epoch is asked of the broker
 * over the lease's own control session (grantEpochReader() below), and
 * `binPath` is the same already-settled `resolvedBinaryPath` vice_ping
 * reports -- this module must never call resolvedBackend() itself.
 *
 * An empty string is treated as ABSENT rather than passed through: the two
 * consumers both branch on truthiness, and passing "" would key a capability
 * cache read on an empty binary path.
 */
function stockConnectDepsFor(lease: HeldLease, deps: StockSessionDeps): StockConnectDeps {
  const connectDeps: StockConnectDeps = {};
  connectDeps.readCurrentEpoch = grantEpochReader(lease.brokerControl, lease.targetId);
  if (lease.supervisorDir) connectDeps.supervisorDir = lease.supervisorDir;
  if (deps.resolvedBinaryPath) connectDeps.binPath = deps.resolvedBinaryPath;
  if (deps.dialMonitorSocket) connectDeps.dialMonitorSocket = deps.dialMonitorSocket;
  return connectDeps;
}

/**
 * Reads the broker's current emulator epoch for ONE grant, over that grant's
 * own control session. The broker's `status` reply lists every instance with
 * its owning grant id; only the entry this grant owns counts. `null` when
 * the status call fails or no entry is owned by this grant -- the caller
 * treats that as identity not proven, never as a match.
 */
export function grantEpochReader(control: Pick<BrokerControlSession, "status">, grantId: string): () => Promise<number | null> {
  return async () => {
    if (grantId === "") return null;
    const result = await control.status();
    if (!result.ok) return null;
    const owned = result.instances.find((entry) => entry.grantId === grantId);
    return owned ? owned.epoch : null;
  };
}

/**
 * withChannelLockHeld -- acquires channel-lock.ts's mutex for
 * `channel: "binary"` around `fn`, releasing in a `finally` so a throwing
 * `fn` still releases (D-05). This is the ONE acquire site on the binary
 * side; runBinary() calls it, and nothing may acquire the lock any other way.
 *
 * This is what makes the lock's critical section span a whole LOGICAL
 * operation, not a single wire command: `vice_run_until`'s wait
 * (stock-run-until.ts's `waitForStop()`) runs inside the wrapped `fn`, so
 * the lock stays held across resume -> wait -> observe.
 *
 * FORBIDDEN ALTERNATIVE, named here because it is the obvious-looking wrong
 * design: acquiring and releasing this lock around each individual wire
 * command instead of around the whole handler call. A per-wire-command lock
 * preserves the resume count while destroying what the count protects -- a
 * foreign command (e.g. a text-channel command) can land in the gap between
 * "resume sent" and "checkpoint observed", halting a machine that was
 * supposed to be running toward the checkpoint, so the checkpoint never
 * fires even though no protocol invariant was technically violated per
 * command (41-RESEARCH.md Pitfall 6).
 *
 * A `ChannelLockTimeoutError` is converted into refusal text using the
 * error's OWN message verbatim -- it is already `channelLockRefusalMessage()`'s
 * output -- and NEVER routed through `convertWireError()`, which would
 * re-frame a legitimate ownership statement as a wire fault.
 */
/**
 * Phase 63 (SESS-05): declares (before `fn` runs) and clears (in the same
 * `finally` that releases the lock) the operation this session's OWN grant
 * has in flight, over `session.brokerControl` -- the LEASE'S OWN control
 * session (the same one `ensureStockSession()`'s `stockConnect()` call
 * claimed the monitor socket through), never a locally-derived one. A
 * second, independently-opened control session would claim on one
 * connection while another held the grant -- exactly the "re-deriving a
 * cross-cutting seam locally" anti-pattern `ensureStockSession()`'s own
 * header comment already forbids for the session itself, extended here to
 * the declaration that names what that session is doing.
 *
 * Both calls are written WITHOUT being awaited: a declaration must never
 * add latency to a tool call and must never fail one (T-63-13).
 * `noteOperation()` never throws by its own contract
 * (BrokerControlSession.noteOperation's own header comment) -- the
 * `.catch(() => {})` below is a defensive guard against an unexpected throw
 * escaping into the tool path anyway, not a documented failure mode this
 * function relies on.
 */
function declareOperation(session: StockConnectSession, name: string | null): void {
  void session.brokerControl.noteOperation({ targetId: session.targetId, channel: "binary", name }).catch(() => {});
}

async function withChannelLockHeld(
  toolName: string,
  timeoutMs: number | undefined,
  session: StockConnectSession,
  fn: () => Promise<StockToolResult>,
): Promise<StockToolResult> {
  let handle;
  try {
    handle = await acquireChannelLock({ channel: "binary", operation: toolName, timeoutMs });
  } catch (err) {
    if (err instanceof ChannelLockTimeoutError) {
      return isErrorText(err.message);
    }
    throw err;
  }
  declareOperation(session, toolName);
  try {
    return await fn();
  } finally {
    declareOperation(session, null);
    handle.release();
  }
}

/**
 * Runs a handler that needs the binary monitor session:
 *   1. ensureStockSession(deps); a thrown handshake error becomes
 *      convertHandshakeError(), an `{ ok: false }` outcome returns its
 *      message verbatim.
 *   2. The handler, inside withChannelLockHeld(); anything it throws becomes
 *      convertWireError().
 * The lock covers only step 2, so a broker liveness failure or a handshake
 * failure never queues behind the other channel.
 */
export async function runBinary(
  toolName: string,
  handler: StockSessionHandler,
  args: Record<string, unknown>,
  deps: StockSessionDeps,
): Promise<StockToolResult> {
  let outcome: EnsureStockSessionOutcome;
  try {
    outcome = await ensureStockSession(deps);
  } catch (err) {
    return convertHandshakeError(toolName, err);
  }
  if (!outcome.ok) {
    return isErrorText(prefixedWithTool(toolName, outcome.message));
  }
  const session = outcome.session;
  return withChannelLockHeld(toolName, deps.channelLockTimeoutMs, session, async () => {
    try {
      return await handler(args, session, deps);
    } catch (err) {
      return convertWireError(toolName, err);
    }
  });
}

/**
 * Runs a handler that must not take the binary session or the binary lock:
 * pure client-side tools (they must not halt the machine for nothing) and
 * text-channel tools (they take the text lock themselves, and channel-lock.ts
 * is one non-reentrant mutex, so taking the binary lock too would
 * self-deadlock). Anything the handler throws becomes convertWireError().
 */
export async function runPure(
  toolName: string,
  handler: DerivedPureHandler,
  args: Record<string, unknown>,
  deps: StockSessionDeps,
): Promise<StockToolResult> {
  try {
    return await handler(args, deps);
  } catch (err) {
    return convertWireError(toolName, err);
  }
}

export { stockDisconnect };
