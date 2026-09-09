#!/usr/bin/env node
// text-tools.ts
//
// THE ONE place a text-channel tool handler lives (plan 41-06, CHAN-03).
// Every handler here takes the text channel's own halt authority through
// withTextChannelLock() (text-protocol.ts, plan 41-02) around its whole
// logical operation and never issues a bare command() outside it --
// command() itself refuses when channel-lock.ts's mutex is not held by the
// text channel, so a handler that forgot to acquire would be refused, not
// silently allowed through.
//
// No handler here accepts a caller-supplied command string, now or later.
// The generic remote-execution seam this project rejected on the record for
// host_tool (a single per-binary run-arbitrary-command op) would be WORSE
// here, over a channel that is unauthenticated and can read and write host
// files -- broker-launch.mts's own bind-widening warning already states
// this for this same channel. Every outbound command below is a fixed
// literal drawn from TEXT_COMMAND_ALLOWLIST; text-protocol.ts's command()
// itself refuses anything else BY NAME (D-01), and neither handler below
// ever builds a command string from an argument.
//
// SESSION LIFECYCLE -- MEASURED, not this plan's assumed default (Rule 1
// deviation, see SUMMARY): StockConnectSession (stock-connect.ts) carries no
// text session at all, and ensureStockSession()/withStockSession() never
// call textConnect() -- as of this plan, textConnect()/textDisconnect() are
// invoked ONLY from test code. So there is no session-lifetime-held text
// session anywhere in production code to reuse. Each call below is its OWN
// textConnect()/textDisconnect() pair -- the ONLY acquisition path these two
// tools have, not a second one competing with a first.
//
// ADAPTER CHOICE -- MEASURED, deviates from this plan's literal instruction
// (Rule 1 deviation, see SUMMARY): withStockSession() and
// withDerivedTool(..., { needsSession: true }, ...) (stock-dispatch.ts) both
// wrap the ENTIRE delegated handler call in withChannelLockHeld(), which
// acquires channel-lock.ts's SINGLE, cross-channel mutex for `channel:
// "binary"` for the whole call. A handler reached through either adapter
// that then called withTextChannelLock() internally would be a SECOND
// acquireChannelLock() call while the first (binary) is still held by the
// very same call stack -- channel-lock.ts is not reentrant and does not
// distinguish "the same logical caller" from "a different one" -- so the
// inner acquire would queue behind itself and could only ever resolve by
// expiring CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS (630s by default) and erroring: a
// de facto deadlock, not a working call. Neither handler below needs a
// binary session or the binary channel's authority at all, so both are
// registered in stock-dispatch.ts with
// `withDerivedTool(toolName, { needsSession: false }, handler)` instead --
// the SAME existing adapter configuration `vice_diagnose`/
// `vice_symbols_load` already use, never a third adapter. Each handler
// resolves the lease through `deps.ensureLease()` itself (free to call
// repeatedly -- ensureStockSession()'s own header comment) and takes ONLY
// the text channel's own lock, via withTextChannelLock(), around its one
// command().
//
// WHAT NOT TO DO:
//   - Never accept a caller-supplied, free-text command string anywhere in
//     this module's public surface (D-01).
//   - Never call TextMonitorClient.command() outside withTextChannelLock().
//   - Never register either handler through withStockSession() or
//     withDerivedTool(..., { needsSession: true }, ...) -- see the ADAPTER
//     CHOICE comment above for the self-deadlock this would cause.
//   - Never dial a raw host/port or open a second broker lease -- both
//     handlers obtain lease coordinates through deps.ensureLease() (the SAME
//     provider ensureStockSession() itself calls) and dial only through
//     textConnect().
//   - Never write a third error converter -- reuse convertHandshakeError()
//     and convertWireError() (stock-handler.ts) exactly as every other stock
//     handler does; a ChannelLockTimeoutError is passed through verbatim
//     (its own `.message` IS channelLockRefusalMessage()'s output), matching
//     withChannelLockHeld()'s own discipline in stock-dispatch.ts.
//   - Never embed a phase number in any string or template literal here.
import { textConnect, textDisconnect } from "./text-connect.ts";
import { withTextChannelLock, type TextMonitorClient } from "./text-protocol.ts";
import { MonitorOwnershipError } from "./vice-broker-client.ts";
import { ChannelLockTimeoutError } from "./channel-lock.ts";
import { isErrorText, derivedAnswer, convertHandshakeError, convertWireError, type StockToolResult } from "./stock-handler.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

/**
 * Shared preamble every handler below runs: resolve the lease
 * (`deps.ensureLease()` -- the SAME provider ensureStockSession() itself
 * calls, never a second acquisition), open a fresh text-monitor session
 * through textConnect(), hold channel-lock.ts's mutex for `channel: "text"`
 * around exactly one command via withTextChannelLock(), and always tear the
 * session down again (textDisconnect()) whether `fn` succeeded or threw.
 */
async function withTextTool(
  toolName: string,
  deps: StockDispatchDeps,
  fn: (client: TextMonitorClient) => Promise<StockToolResult>,
): Promise<StockToolResult> {
  const leaseOutcome = await deps.ensureLease();
  if (!leaseOutcome.ok) {
    return isErrorText(leaseOutcome.message);
  }
  const lease = leaseOutcome.lease;
  if (lease === null) {
    return isErrorText(
      `${toolName}: VICE_MCP_URL is set, so there is no broker-managed instance and no broker control session to ` +
        `claim the text-monitor socket through -- unset VICE_MCP_URL to use the on-demand broker, or connect to a ` +
        `broker-managed instance directly.`,
    );
  }

  let session;
  try {
    session = await textConnect({
      host: lease.host,
      remoteMonitorPort: lease.remoteMonitorPort,
      targetId: lease.targetId,
      brokerControl: lease.brokerControl,
    });
  } catch (err) {
    if (err instanceof MonitorOwnershipError) {
      return convertHandshakeError(toolName, err);
    }
    return convertWireError(toolName, err);
  }

  try {
    return await withTextChannelLock(toolName, () => fn(session.client), { timeoutMs: deps.channelLockTimeoutMs });
  } catch (err) {
    // ChannelLockTimeoutError's own `.message` IS
    // channelLockRefusalMessage()'s output -- passed through verbatim below,
    // never routed through convertWireError(), matching
    // withChannelLockHeld()'s (stock-dispatch.ts) own discipline for the
    // binary side.
    if (err instanceof ChannelLockTimeoutError) {
      return isErrorText(err.message);
    }
    return convertWireError(toolName, err);
  } finally {
    try {
      await textDisconnect(session);
    } catch (releaseErr) {
      console.error(`${toolName}: textDisconnect after use did not complete: ${String(releaseErr)}`);
    }
  }
}

/**
 * `vice_device_console` -- takes NO arguments at all. Issues the single
 * allowlisted verb `device c:` (the colon is required; the spelling without
 * it is a syntax error the monitor rejects) inside withTextChannelLock(),
 * and answers with the framed response plus a statement that the default
 * device (memspace) was reset to the main CPU. This is an explicit tool, not
 * auto-healing on the stepping path (D-03) -- nothing here is called from
 * `ADVANCE_INSTRUCTIONS` or `EXECUTE_UNTIL_RETURN`; no shipped tool can
 * contaminate `default_memspace` today (drive checkpoints are deferred past
 * this milestone), so auto-healing would add a text round trip and a mutex
 * acquisition to the hottest binary-side path to defend a route nothing
 * currently opens.
 */
export async function handleDeviceConsole(_args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  return withTextTool("vice_device_console", deps, async (client) => {
    const response = await client.command("device c:");
    return derivedAnswer({
      response,
      note: "default device (memspace) reset to the main CPU",
    });
  });
}

/**
 * `vice_warp_set` -- takes exactly one parameter, `enabled: boolean`,
 * refused BY NAME (no byte written to the socket, no lease resolved, no
 * connection attempted) whenever it is not a boolean. Selects `warp on` or
 * `warp off` by branch -- never a caller-supplied string concatenated into
 * the command line -- and answers with the framed response, which per the
 * existing measurement reports warp's own state, so the answer carries the
 * OBSERVED state rather than an assumption that the write took. There is no
 * runtime `WarpMode` *resource* on stock; this is a monitor *command*, and
 * warp requested at launch time is a separate mechanism -- this tool changes
 * neither of those facts.
 */
export async function handleWarpSet(args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const enabled = args.enabled;
  if (typeof enabled !== "boolean") {
    return isErrorText(
      `vice_warp_set: "enabled" must be a boolean (got ${JSON.stringify(enabled)}) -- refusing before any ` +
        `text-monitor byte is written`,
    );
  }
  const command = enabled ? "warp on" : "warp off";
  return withTextTool("vice_warp_set", deps, async (client) => {
    const response = await client.command(command);
    return derivedAnswer({
      requested: enabled,
      response,
      note:
        "there is no runtime WarpMode resource on stock -- this is a monitor command, and warp requested at " +
        "launch time is a separate mechanism; the response above carries warp's OWN observed state, not an " +
        "assumption that this write took",
    });
  });
}
