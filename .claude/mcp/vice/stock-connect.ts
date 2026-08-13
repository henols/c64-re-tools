#!/usr/bin/env node
// stock-connect.ts
//
// The ONE place that performs the stock connect handshake: claim the
// monitor socket from the broker (BEFORE any TCP dial), open a
// ViceMonitorClient, assert the wire's api_version, read the connected
// build's identity via VICE_INFO, settle its version-gated capabilities
// exactly once per binary (BACK-04 -- at connect time, not at first use),
// and detect whether the machine underneath a reconnect is the SAME machine
// this client originally handshook with.
//
// WHY THIS FILE EXISTS: stock-protocol.ts's ViceMonitorClient deliberately
// answers only "this socket died" (see its own header comment on D-11) --
// it never decides whether a freshly reconnected socket belongs to the same
// emulator process. backend-detect.mts's capability cache is written once
// per binary by a --help probe that cannot observe a version quad at all
// (that file's own header comment says as much). Something has to sit
// between those two files and turn "a claimed, connected,
// api_version-checked socket" into "a named build with settled
// capabilities, whose continued identity across a reconnect is provable" --
// this file is that seam.
//
// WHAT NOT TO DO:
//   - Never re-derive an epoch or restart heuristic here. vice.ts's
//     MachineRestartedError is the ONE restart-error type this whole module
//     tree uses (D-11); reuse it, do not define a second one.
//   - Never dial the binmon port before claimMonitor() has succeeded --
//     stock VICE services exactly one client, and a refused claim must
//     arrive as a JSON response on a working control-plane socket, never as
//     a connect() that silently sits unserviced in the backlog (PROTO-08,
//     D-13, vice-broker-client.ts's own MonitorOwnershipError header
//     comment).
import { ViceMonitorClient, CommandType, ErrorCode, StockProtocolError } from "./stock-protocol.ts";
import { readCapabilityRecord, writeCapabilityRecord, type CapabilityDeps } from "./backend-detect.mts";
import { MachineRestartedError, ViceError, readEpoch, type EpochResult } from "./vice.ts";
import {
  MonitorOwnershipError,
  type ClaimMonitorOptions,
  type ClaimMonitorOutcome,
  type ReleaseMonitorOptions,
  type ReleaseMonitorOutcome,
} from "./vice-broker-client.ts";

// ---------------------------------------------------------------------------
// Broker control surface this handshake needs -- deliberately narrower than
// the full BrokerControlSession (acquire/release/recycle/status/hostState):
// this file only ever claims and releases a monitor socket, never opens or
// closes the acquire-level lease itself. Any real BrokerControlSession
// satisfies this structurally; tests inject a minimal stub instead of the
// whole session.
// ---------------------------------------------------------------------------

export interface StockConnectBrokerControl {
  claimMonitor(opts: ClaimMonitorOptions): Promise<ClaimMonitorOutcome>;
  releaseMonitor(opts: ReleaseMonitorOptions): Promise<ReleaseMonitorOutcome>;
}

// ---------------------------------------------------------------------------
// Capabilities -- BACK-04's version-gated answer set. Today this is just
// CPUHISTORY_GET's three-way outcome (docs/phase0-binmon-findings.md §5,
// D-10): 0x00 OK on the 3.10 fork, 0x83 INVALID_TYPE (opcode absent) on
// stock 3.9, 0x8f CMD_FAILURE (compiled without support) as the distinct
// third case. A later plan adding a second version-gated opcode extends this
// type, not a parallel mechanism.
// ---------------------------------------------------------------------------

export type CpuHistoryCapability = "available" | "absent" | "not_compiled_in";

export interface StockCapabilities {
  cpuHistory: CpuHistoryCapability;
}

/** CPUHISTORY_GET's count field is read as uint32 by this handshake's own
 * request body but VICE stores it internally in a uint16_t
 * (monitor_binary.c:1492) -- any count >= 65536 wraps silently server-side.
 * Clamp client-side rather than ever sending an unclamped value. This
 * handshake only ever probes with count 0 (it wants the capability answer,
 * not any history), but the clamp is a general guard for any future caller
 * of this same request shape. */
const CPU_HISTORY_MAX_COUNT = 65535;

/** WR-02/WR-12: bounded at BOTH ends, and against non-finite input. A bare
 * `Math.min(count, 65535)` clamped only the documented uint16 wrap and passed
 * negatives and NaN straight through to `body.writeUInt32LE(count, 1)`, which
 * THROWS for either. This function's own doc comment above advertises it as "a
 * general guard for any future caller of this same request shape" -- and that
 * caller is exactly the one who will hand it unvalidated input, so the guard
 * has to hold for the whole numeric domain, not just the upper bound. A
 * fractional count truncates rather than throwing: the wire field is an
 * integer, and 0 is the safe floor (this handshake's own probe uses it). */
export function clampCpuHistoryCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(Math.trunc(count), 0), CPU_HISTORY_MAX_COUNT);
}

/** Sends CPUHISTORY_GET (0x86) with memspace=main and a zero, clamped count,
 * and maps the wire outcome to CpuHistoryCapability's three-way answer --
 * 0x00 OK -> "available", 0x83 INVALID_TYPE -> "absent" (the pre-3.10 case),
 * 0x8f CMD_FAILURE -> "not_compiled_in" (the distinct compiled-without-
 * support case). Any other rejection (a timeout, a closed socket, an
 * unrecognized error code) is not this function's to interpret -- it
 * propagates unchanged. */
async function probeCpuHistory(client: ViceMonitorClient): Promise<CpuHistoryCapability> {
  const count = clampCpuHistoryCount(0);
  const body = Buffer.alloc(5);
  body[0] = 0x00; // memspace: main
  body.writeUInt32LE(count, 1);
  try {
    await client.send(CommandType.CpuHistoryGet, body);
    return "available";
  } catch (err) {
    if (err instanceof StockProtocolError) {
      if (err.errorCode === ErrorCode.InvalidType) return "absent"; // 0x83 -- opcode absent, pre-3.10
      if (err.errorCode === ErrorCode.CmdFailure) return "not_compiled_in"; // 0x8f -- compiled without support
    }
    throw err;
  }
}

/** Gates the CPUHISTORY_GET probe behind backend-detect.mts's own capability
 * cache (BACK-04): a record whose stored versionQuad matches the one this
 * handshake just observed short-circuits the probe entirely; a miss, a
 * stale record (different versionQuad -- the binary was swapped), or the
 * absence of a `binPath` to key on all fall through to a fresh probe, whose
 * answer is then written back exactly once. This function never invents a
 * backend verdict -- writeCapabilityRecord() itself is a no-op unless
 * backend-detect.mts's own resolvedBackend() has already written a matching
 * record for this binary (see that function's own header comment). */
async function resolveCapabilities(client: ViceMonitorClient, versionQuad: string, deps: StockConnectDeps): Promise<StockCapabilities> {
  const readCap = deps.readCapabilityRecordFn ?? readCapabilityRecord;
  const writeCap = deps.writeCapabilityRecordFn ?? writeCapabilityRecord;

  if (deps.binPath) {
    const capDeps: CapabilityDeps = { supervisorDir: deps.supervisorDir, observedVersionQuad: versionQuad };
    const existing = readCap(deps.binPath, capDeps);
    if (existing && !existing.stale && existing.cpuHistoryAvailable !== undefined) {
      // backend-detect.mts's own cache schema stores only a boolean --
      // "absent" and "not_compiled_in" both collapse to `false` there,
      // since both mean "never attempt CPUHISTORY_GET again"; they differ
      // only in WHY. A cache hit cannot recover which of the two it
      // originally was, so it reports the more common non-3.10 case
      // ("absent") rather than re-probing to find out -- re-probing on
      // every connect is exactly what BACK-04 exists to avoid.
      return { cpuHistory: existing.cpuHistoryAvailable ? "available" : "absent" };
    }
  }

  const cpuHistory = await probeCpuHistory(client);
  if (deps.binPath) {
    writeCap(deps.binPath, { versionQuad, cpuHistoryAvailable: cpuHistory === "available" }, { supervisorDir: deps.supervisorDir });
  }
  return { cpuHistory };
}

// ---------------------------------------------------------------------------
// stockConnect() -- the handshake itself.
// ---------------------------------------------------------------------------

export interface StockConnectDeps {
  /** The binary this handshake is connected to -- the SAME key
   * backend-detect.mts's cache is written under. Omitted entirely disables
   * the capability cache (every connect re-probes, never persisted). */
  binPath?: string;
  /** Same meaning as backend-detect.mts's own `supervisorDir` option: a
   * caller-supplied string, never re-derived here (this file must not
   * become a second, driftable copy of "where is .vice-supervisor"). */
  supervisorDir?: string;
  /** Path to this instance's own epoch.json (broker-epoch.mts's own writer),
   * used ONLY as the reconnect baseline/comparison (Task 2). Omitted
   * entirely means identity across a reconnect can never be proven -- see
   * stockReconnect()'s own header comment. */
  epochPath?: string;
  readCapabilityRecordFn?: typeof readCapabilityRecord;
  writeCapabilityRecordFn?: typeof writeCapabilityRecord;
  readEpochFn?: typeof readEpoch;
}

export interface StockConnectOptions {
  host: string;
  port: number;
  targetId: string;
  brokerControl: StockConnectBrokerControl;
  deps?: StockConnectDeps;
}

export interface StockConnectSession {
  client: ViceMonitorClient;
  versionQuad: string;
  capabilities: StockCapabilities;
  host: string;
  port: number;
  targetId: string;
  brokerControl: StockConnectBrokerControl;
  deps: StockConnectDeps;
  /** This instance's epoch, as read at connect time -- `null` when no
   * epoch evidence could be read at all (deps.epochPath omitted, absent, or
   * unreadable). Consumed only by stockReconnect() (Task 2). */
  baselineEpoch: number | null;
}

async function safeDisconnect(client: ViceMonitorClient): Promise<void> {
  try {
    await client.disconnect();
  } catch {
    // disconnect() itself never throws in stock-protocol.ts's own
    // implementation, but this handshake's own failure-cleanup path must
    // never itself fail on the way out.
  }
}

/**
 * CR-02 (code review 2026-08-13). THE load-bearing counterpart to every
 * command this handshake sends. docs/phase0-binmon-findings.md §4, read from
 * VICE's own source, is explicit: `monitor_check_binary()` calls
 * `monitor_startup_trap()` on ANY INBOUND BYTE (monitor_binary.c:281), and
 * that check runs every vsync -- so the bare `PING` (0x81) below halts the
 * emulated C64 within roughly one frame and emits `STOPPED` (0x62). `EXIT`
 * (0xaa) is the ONLY thing that resumes it.
 *
 * Before this function existed, nothing in this tree ever sent 0xaa: the
 * first `vice_ping` on the stock backend froze the machine and left it frozen
 * for the life of the held session, with a `STOPPED` event nobody consumed --
 * exactly the "stopped advancing / not wedged / merely paused" state
 * `vice-wedge-triage` exists to disambiguate, manufactured by the health
 * check itself.
 *
 * WHAT NOT TO DO: never add a command sequence to this file (or to any future
 * stock handler) that leaves the machine halted. The invariant is that a
 * handshake returns the machine to the run state it found it in. That is why
 * the success-path call below is INSIDE the try: a handshake that cannot
 * prove it resumed the machine is a FAILED handshake, routed through the same
 * disconnect-and-release cleanup as any other step, never a success that
 * silently leaves the C64 frozen.
 *
 * The `RESUMED` (0x63) event VICE emits alongside the EXIT reply arrives at
 * request id 0xffffffff and is routed to ViceMonitorClient's 'event' channel
 * by the request-id-first demux -- deliberately not awaited here: keying on
 * it would mean waiting on an unsolicited frame, which is precisely what that
 * demux forbids resolving a request with.
 */
async function resumeMachine(client: ViceMonitorClient): Promise<void> {
  await client.send(CommandType.Exit);
}

/** Best-effort resume for the FAILURE path only: the machine may already be
 * halted by whichever command got through before the failure, and this
 * handshake must not leave it that way if it can help it. Every error is
 * swallowed -- the original handshake failure is what the caller must see
 * (WR-07's own concern), never a cleanup error replacing it. Skipped entirely
 * when the socket is already gone, since there is nothing to send through. */
async function safeResume(client: ViceMonitorClient): Promise<void> {
  if (!client.connected) return;
  try {
    await resumeMachine(client);
  } catch (err) {
    console.error(`stockConnect: best-effort resume (EXIT 0xaa) after a failed handshake did not complete: ${String(err)}`);
  }
}

/**
 * The one connect handshake for the stock path, in load-bearing order:
 *
 *   1. claimMonitor() -- BEFORE any socket is opened (PROTO-08, D-13). A
 *      `monitor_owned` refusal rejects with MonitorOwnershipError naming the
 *      holder; a `timeout` refusal rejects distinctly (the broker did not
 *      answer, which is not "someone else owns it").
 *   2. Open a ViceMonitorClient against host:port.
 *   3. Assert the protocol version by sending one PING (0x81).
 *      stock-protocol.ts's own parser validates api_version on every frame
 *      it decodes -- a mismatch surfaces as a StockFramingError straight out
 *      of `client.send()`, which this function propagates as a fatal
 *      handshake failure rather than re-deriving the check.
 *   4. Send VICE_INFO (0x85) and read the version quad.
 *   5. Gate capabilities via resolveCapabilities() above.
 *   6. Record this instance's epoch (deps.epochPath) as the reconnect
 *      baseline (Task 2) -- absence is normal here (D-3's own posture) and
 *      becomes significant only at stockReconnect() time.
 *   7. Send EXIT (0xaa) to RESUME the machine step 3's PING halted (CR-02).
 *      Non-optional: see resumeMachine()'s own header comment. This handshake
 *      returns the emulator to the run state it found it in, or fails.
 *
 * Every failure path releases the monitor claim before propagating -- a
 * handshake that fails at any step must never leave the instance claimed --
 * and best-effort resumes the machine first, so a failed handshake does not
 * leave a frozen C64 behind either.
 */
export async function stockConnect({ host, port, targetId, brokerControl, deps = {} }: StockConnectOptions): Promise<StockConnectSession> {
  const claimOutcome = await brokerControl.claimMonitor({ targetId });
  if (!claimOutcome.ok) {
    if (claimOutcome.reason === "monitor_owned") {
      throw new MonitorOwnershipError(
        `stockConnect: monitor for target ${targetId} on port ${port} is already claimed by grant ${claimOutcome.holder.grantId}`,
        { holderGrantId: claimOutcome.holder.grantId, holderClaimedAt: claimOutcome.holder.claimedAt, port },
      );
    }
    // "timeout" (the broker did not answer) is kept strictly distinct from
    // "monitor_owned" (someone else holds it) -- never conflated, matching
    // vice-broker-client.ts's own MonitorOwnershipError header comment.
    throw new ViceError(`stockConnect: monitor claim for target ${targetId} failed (${claimOutcome.reason})`, { code: claimOutcome.reason });
  }

  const client = new ViceMonitorClient();
  // CR-02: flipped immediately BEFORE step 7's resume is attempted, so the
  // failure path below never sends a SECOND EXIT for a resume that already
  // failed on its own (which would stack a second full timeout on top of the
  // first, and re-report the same problem twice).
  let resumeAttempted = false;

  try {
    await client.connect(host, port);

    // Step 3: api_version assertion. A non-0x02 api_version rejects this
    // send() call directly with a StockFramingError naming the observed
    // value -- see this function's own header comment. NOTE (CR-02): this
    // single byte HALTS the emulated machine (any inbound byte does --
    // docs/phase0-binmon-findings.md §4); step 7's EXIT is what undoes it.
    await client.send(CommandType.Ping);

    // Step 4: build identity.
    const infoResponse = await client.send(CommandType.ViceInfo);
    if (infoResponse.type !== "vice_info") {
      throw new ViceError(`stockConnect: VICE_INFO reply for target ${targetId} had unexpected shape "${infoResponse.type}"`);
    }
    const versionQuad = infoResponse.versionString;

    // Step 5: settle version-gated capabilities, once per binary.
    const capabilities = await resolveCapabilities(client, versionQuad, deps);

    // Step 6: record the reconnect baseline (Task 2). Absence is normal --
    // matches vice.ts's own readEpoch()/D-3 posture -- and is not an error
    // here; it becomes significant only inside stockReconnect().
    const readEpochFn = deps.readEpochFn ?? readEpoch;
    const baselineRecord: EpochResult | null = deps.epochPath ? readEpochFn(deps.epochPath) : null;
    const baselineEpoch = baselineRecord && baselineRecord.present ? baselineRecord.epoch : null;

    // Step 7 (CR-02): resume the machine the PING in step 3 halted. LAST, and
    // inside the try -- see resumeMachine()'s own header comment for why a
    // failure here must fail the whole handshake rather than return a session
    // whose emulator is frozen.
    resumeAttempted = true;
    await resumeMachine(client);

    return { client, versionQuad, capabilities, host, port, targetId, brokerControl, deps, baselineEpoch };
  } catch (err) {
    // Every failure path releases the claim before propagating -- a
    // handshake that fails at any step must not leave the instance locked --
    // and, CR-02, tries to leave the machine RUNNING on the way out too.
    if (!resumeAttempted) await safeResume(client);
    await safeDisconnect(client);
    await brokerControl.releaseMonitor({ targetId });
    throw err;
  }
}

/** Normal counterpart to stockConnect()'s claim: disconnects the socket and
 * releases the monitor claim together, so a caller never ends up holding
 * one without the other. This is the "success path" release alongside
 * stockConnect()'s own failure-path release above. */
export async function stockDisconnect(session: StockConnectSession): Promise<void> {
  await safeDisconnect(session.client);
  await session.brokerControl.releaseMonitor({ targetId: session.targetId });
}

// ---------------------------------------------------------------------------
// stockReconnect() -- Task 2: reconnect-with-identity-check.
// ---------------------------------------------------------------------------

export interface StockReconnectOptions {
  lastToolCall?: string | null;
}

/**
 * Reconnects against the SAME target this session originally handshook
 * with, proving identity via the per-instance epoch file (deps.epochPath)
 * BEFORE running the handshake again. Three failure meanings, three
 * distinct types -- conflating any two of them is the regression this
 * comment exists to prevent:
 *
 *   - StockRequestTimeoutError (stock-protocol.ts): "connected but silent."
 *   - StockConnectionClosedError (stock-protocol.ts): "this socket died."
 *   - MachineRestartedError (vice.ts, reused -- never redefined here):
 *     "the machine under you is not the machine you handshook with," or its
 *     identity across the reconnect could not be proven at all (no epoch
 *     evidence either way is treated the same as proven-different -- D-3's
 *     own "identity that cannot be proven is treated as not proven").
 *
 * On a proven match, this function re-runs the FULL handshake (stockConnect
 * again) rather than merely re-dialling: re-reading VICE_INFO and
 * re-validating the capability record against the freshly observed version
 * quad means a restart that swapped the underlying binary never inherits
 * the old build's capability answers (resolveCapabilities()'s own staleness
 * check above).
 */
export async function stockReconnect(session: StockConnectSession, { lastToolCall = null }: StockReconnectOptions = {}): Promise<StockConnectSession> {
  const readEpochFn = session.deps.readEpochFn ?? readEpoch;
  const current: EpochResult | null = session.deps.epochPath ? readEpochFn(session.deps.epochPath) : null;
  const currentEpoch = current && current.present ? current.epoch : null;
  const baselineEpoch = session.baselineEpoch;

  if (baselineEpoch === null || currentEpoch === null || currentEpoch !== baselineEpoch) {
    throw new MachineRestartedError(
      `stockConnect: reconnect to target ${session.targetId} could not prove machine identity across the reconnect ` +
        `(baseline epoch ${String(baselineEpoch)}, current epoch ${String(currentEpoch)})`,
      { baselineEpoch, currentEpoch, where: "stock-connect.ts:stockReconnect", lastToolCall },
    );
  }

  return stockConnect({ host: session.host, port: session.port, targetId: session.targetId, brokerControl: session.brokerControl, deps: session.deps });
}
