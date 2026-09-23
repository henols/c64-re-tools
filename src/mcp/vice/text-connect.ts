#!/usr/bin/env node
// text-connect.ts
//
// THE ONE place the text channel's session lifecycle lives: claim the text
// socket from the broker BEFORE any TCP dial (mirroring stock-connect.ts's
// stockConnect() discipline exactly), open a TextMonitorClient, and hand back
// a connected session. Never dials a raw host/port outside the claim/grant
// flow -- textConnect() always claims through the SAME broker control
// surface a caller already holds a HeldLease over.
//
// WHY THIS FILE EXISTS: text-protocol.ts's TextMonitorClient deliberately
// answers only "how are these bytes framed" (see its own header comment) --
// it has no notion of a broker, a grant, or a claim. Something has to sit
// between "a HeldLease carrying a validated remoteMonitorPort" and "a
// connected, claimed TextMonitorClient" -- this file is that seam, the exact
// role stock-connect.ts already plays for the binary monitor.
//
// WHAT NOT TO DO:
//   - Never dial the text-monitor port before claimMonitor() has succeeded --
//     the SAME PROTO-08/D-13 discipline stock-connect.ts's own header
//     comment states: a refused claim must arrive as a JSON response on a
//     working control-plane socket, never as a connect() that silently sits
//     unserviced (stock's text monitor also services exactly one client).
//   - Never build a textReconnect(). Per RESEARCH.md's Open Question 2, an
//     unexpected text-socket close is treated as FATAL for the session, not
//     something to silently reconnect -- this matches D-13's own "held for
//     the session's lifetime" framing: a session whose text socket died
//     underneath it has lost a fact (what happened on that channel while it
//     was down) that a silent reconnect would paper over.
//   - Never re-derive a parallel claim interface. StockConnectBrokerControl
//     (stock-connect.ts) is reused here as-is -- the SAME narrow structural
//     interface, extended (plan 41-03, D-14) with an optional `channel`
//     field on the options object claimMonitor()/releaseMonitor() already
//     take, never a second interface.
//   - Phase 63 (SESS-02): never dial the emulator's own text-monitor port
//     from this process again, full stop -- the ONE `client.connect(host,
//     remoteMonitorPort, ...)` call this handshake used to make is now
//     `dialMonitorSocket` (default: dialMonitorRelay() against the broker's
//     fixed endpoint, tagged for the text channel, never the emulator
//     directly). The socket now comes from the broker, already spliced
//     through to the real text-monitor port on the broker's own side. A
//     future edit that reintroduces a direct `net.createConnection`/
//     `client.connect(host, port)` call in this file is reopening the exact
//     single-client-services-exactly-one hazard the relay exists to close.
//   - Never build a textReconnect() here EITHER, on the relay socket -- see
//     the bullet above this one. The relay changes WHERE the socket comes
//     from, never WHETHER a dead one may be silently re-established.
import { TextMonitorClient } from "./text-protocol.ts";
import { ViceError } from "./vice-errors.ts";
import type { StockConnectBrokerControl, DialMonitorSocketFn } from "./stock-connect.ts";
import { MonitorOwnershipError, type MonitorClaimChannel } from "./vice-broker-client.ts";
import { dialMonitorRelay } from "./broker-endpoint.ts";
import type { Socket } from "node:net";

// ---------------------------------------------------------------------------
// Session shape.
// ---------------------------------------------------------------------------

export interface TextConnectSession {
  client: TextMonitorClient;
  host: string;
  port: number;
  targetId: string;
  brokerControl: StockConnectBrokerControl;
}

export interface TextConnectOptions {
  host: string;
  /** THIS instance's own text-monitor port, read by the caller off
   * `HeldLease.remoteMonitorPort` (D-15) -- never a guessed or re-derived
   * value. Validated by this function: an absent or non-integer value is
   * refused by name, naming `targetId`, rather than dialling a guessed port. */
  remoteMonitorPort: number | null | undefined;
  targetId: string;
  brokerControl: StockConnectBrokerControl;
  /** Injectable socket source (Phase 63, SESS-02) -- the SAME seam
   * stock-connect.ts's StockConnectDeps.dialMonitorSocket exposes, reused
   * as-is (the type Plan 63-01 exported, never a second declaration).
   * Omitted means the module's OWN default: dialMonitorRelay() against the
   * broker's fixed endpoint, tagged for the text channel, presenting the
   * per-claim handle as its only authority (G-64-1, owner decision 5) -- no
   * credential of any kind. */
  dialMonitorSocket?: DialMonitorSocketFn;
}

/** The default DialMonitorSocketFn for the text channel: dials the
 * broker's fixed endpoint via dialMonitorRelay(), presenting the per-claim
 * handle as its only authority (G-64-1, owner decision 5) -- no credential
 * of any kind -- and unwraps its discriminated result into either a
 * resolved socket/pending pair or a thrown ViceError naming the broker's
 * own refusal text. Mirrors stock-connect.ts's own defaultDialMonitorSocket
 * exactly (that function is not exported, so this is a small, deliberate
 * duplicate rather than a shared import -- the two channels' defaults
 * differ only in which channel they always pass, and stock-connect.ts's
 * own header comment forbids this file from reaching into it). */
async function defaultDialMonitorSocket(opts: {
  host: string;
  port: number;
  targetId: string;
  channel: MonitorClaimChannel;
  handle: string;
}): Promise<{ socket: Socket; pending: Buffer }> {
  const result = await dialMonitorRelay({
    targetId: opts.targetId,
    channel: opts.channel,
    handle: opts.handle,
  });
  if (!result.ok) {
    throw new ViceError(result.reason);
  }
  return { socket: result.socket, pending: result.pending };
}

function isValidPort(port: unknown): port is number {
  return typeof port === "number" && Number.isInteger(port) && port >= 1 && port <= 65535;
}

async function safeDisconnect(client: TextMonitorClient): Promise<void> {
  try {
    await client.disconnect();
  } catch {
    // disconnect() itself never throws in text-protocol.ts's own
    // implementation, but this handshake's own failure-cleanup path must
    // never itself fail on the way out (mirrors stock-connect.ts's
    // safeDisconnect() exactly).
  }
}

/**
 * The one connect handshake for the text channel, in load-bearing order:
 *
 *   1. Validate remoteMonitorPort -- a missing or invalid value is refused
 *      by name, naming targetId, and says the instance has no text-monitor
 *      port recorded. Never a dial against a guessed port.
 *   2. claimMonitor() -- BEFORE any socket is opened, exactly like
 *      stockConnect()'s own step 1, claiming `channel: "text"` explicitly
 *      (plan 41-03, D-14). A `monitor_owned` refusal rejects with
 *      MonitorOwnershipError naming the holder AND the text channel; a
 *      `timeout` refusal rejects distinctly (the broker did not answer,
 *      which is not "someone else owns it").
 *   3. Open a TextMonitorClient against host:remoteMonitorPort.
 *
 * Every failure path releases the monitor claim before propagating -- a
 * handshake that fails at any step must never leave the instance claimed.
 */
export async function textConnect({
  host,
  remoteMonitorPort,
  targetId,
  brokerControl,
  dialMonitorSocket,
}: TextConnectOptions): Promise<TextConnectSession> {
  if (!isValidPort(remoteMonitorPort)) {
    throw new ViceError(
      `textConnect: target ${targetId} has no valid text-monitor port recorded (remoteMonitorPort=${JSON.stringify(remoteMonitorPort)}) -- refusing to dial a guessed port`,
    );
  }

  // Plan 41-03 (D-14): explicit "text" -- never relies on claimMonitor()'s
  // own binary default.
  const claimOutcome = await brokerControl.claimMonitor({ targetId, channel: "text" });
  if (!claimOutcome.ok) {
    if (claimOutcome.reason === "monitor_owned") {
      throw new MonitorOwnershipError(
        `textConnect: text monitor for target ${targetId} on port ${remoteMonitorPort} is already claimed by grant ${claimOutcome.holder.grantId} -- another client holds this instance's single text-monitor socket`,
        { holderGrantId: claimOutcome.holder.grantId, holderClaimedAt: claimOutcome.holder.claimedAt, port: remoteMonitorPort, channel: claimOutcome.holder.channel },
      );
    }
    // "timeout" (the broker did not answer) is kept strictly distinct from
    // "monitor_owned" (someone else holds it) -- never conflated, matching
    // vice-broker-client.ts's own MonitorOwnershipError header comment and
    // stock-connect.ts's identical posture.
    throw new ViceError(`textConnect: monitor claim for target ${targetId} failed (${claimOutcome.reason})`, { code: claimOutcome.reason });
  }

  const client = new TextMonitorClient();
  try {
    // Phase 63 (SESS-02): the ONE dial this handshake now makes is a relay
    // connection -- never a direct dial to the emulator's own text-monitor
    // port. The resolved socket has ALREADY completed the broker's own
    // attach handshake by the time it is handed to attach(); `pending` is
    // whatever arrived, in the same chunk, past that handshake's own
    // terminator, seeded straight into the client's own parse buffer
    // rather than being stranded.
    const dial = dialMonitorSocket ?? defaultDialMonitorSocket;
    const { socket, pending } = await dial({ host, port: remoteMonitorPort, targetId, channel: "text", handle: claimOutcome.handle });
    client.attach(socket, { pending });
    return { client, host, port: remoteMonitorPort, targetId, brokerControl };
  } catch (err) {
    // Deliberately NOT reordered like textDisconnect() below (Phase 63,
    // SESS-05): a handshake that fails after the relay has attached is a
    // genuine abnormal event, and the incident record produced by this
    // close-then-release order is real evidence, not the noise the
    // success-path reorder exists to prevent.
    await safeDisconnect(client);
    // WR-07 (stock-connect.ts's own precedent): the release must never
    // REPLACE the original failure. Both outcomes are reported on stderr;
    // neither can displace `err`.
    try {
      // Plan 41-03 (D-14): explicit "text" -- a failure here must release
      // only the text claim this call itself took, never a binary claim.
      const released = await brokerControl.releaseMonitor({ targetId, channel: "text" });
      if (!released.ok) {
        console.error(
          `textConnect: text-monitor release for target ${targetId} after a failed handshake was refused (${released.reason}) -- the instance may still be claimed`,
        );
      }
    } catch (releaseErr) {
      console.error(`textConnect: text-monitor release for target ${targetId} after a failed handshake threw: ${String(releaseErr)}`);
    }
    throw err;
  }
}

/** Normal counterpart to textConnect()'s claim: releases the monitor claim
 * and disconnects the socket together, so a caller never ends up holding one
 * without the other. Mirrors stockDisconnect() exactly.
 *
 * The ORDER below is load-bearing, not a style choice: the release is what
 * tells the broker this teardown is deliberate, and it must arrive while
 * the relay socket is still up, because the broker's own per-channel
 * release is what removes the live relay session from its map. With the
 * OLD order --
 * close first, release second -- every ordinary, successful text-tool call
 * (every call `withTextTool()` makes) deposited one spurious incident record
 * into the machine-wide incidents directory: the broker saw only a socket
 * dying with a live session still registered against it, indistinguishable
 * from an unannounced relay death. The `finally` below exists so a refused
 * or throwing release can never leave the caller holding an open relay
 * socket with no claim behind it -- the disconnect always runs, whatever
 * the release returned. */
export async function textDisconnect(session: TextConnectSession): Promise<void> {
  try {
    const released = await session.brokerControl.releaseMonitor({ targetId: session.targetId, channel: "text" });
    if (!released.ok) {
      console.error(
        `textDisconnect: text-monitor release for target ${session.targetId} (channel: text) was refused (${released.reason}) -- ` +
          `the broker may not have torn this channel's relay session down, so the socket close that follows can still be recorded as a relay death`,
      );
    }
  } finally {
    await safeDisconnect(session.client);
  }
}
