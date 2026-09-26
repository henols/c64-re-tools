#!/usr/bin/env node
// stock-handler.ts
//
// WHY THIS FILE EXISTS: the handler contract every stock tool module
// imports -- the result types, the handler types, both error converters, and
// stockAnswer()/derivedAnswer(), the only places a successful answer is
// built. It is a leaf: it imports stock-session.ts for a type only, so no
// module can form a runtime cycle through it.
//
// WHAT NOT TO DO:
//   - Never build a `{ content: [...], isError: false }` literal outside
//     stockAnswer()/derivedAnswer() -- that is how an answer ships without
//     `runState`.
//   - Never write a third error converter. convertHandshakeError() is the
//     one conversion for a failed session handshake; convertWireError() is
//     the one conversion for a client.send() rejection.
//   - Never value-import stock-session.ts from this file; `import type` only.
import { MonitorOwnershipError } from "./vice-broker-client.ts";
import { MachineRestartedError } from "./vice-errors.mts";
import { ErrorCode, StockFramingError, StockProtocolError, StockResponseMismatchError, StockConnectionClosedError, type ViceMonitorClient } from "./stock-protocol.ts";
import { runStateFor } from "./stock-runstate.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockSessionDeps } from "./stock-session.ts";

// ---------------------------------------------------------------------------
// Result types. Structurally IDENTICAL to vice-proxy.ts's own private
// ToolCallResult (ErrorTextResult | OkTextResult) by field name and type, but
// declared here rather than imported -- vice-proxy.ts imports the tool list,
// which imports THIS file, so importing back from vice-proxy.ts would form a
// module cycle. TypeScript's structural typing makes the two
// interchangeable at every call site that matters.
// ---------------------------------------------------------------------------

export interface StockErrorResult {
  content: { type: "text"; text: string }[];
  isError: true;
}
export interface StockOkResult {
  content: { type: "text"; text: string }[];
  isError: false;
}
export type StockToolResult = StockErrorResult | StockOkResult;

export function isErrorText(text: string): StockErrorResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** The shape every Phase 3 family module exports one of per tool. `session`
 * is the SAME StockConnectSession ensureStockSession() itself resolves --
 * no handler resolves a lease or opens a socket of its own. `deps` is
 * threaded through for anything a handler needs beyond the session (e.g. a
 * path-translation root). */
export type StockSessionHandler = (args: Record<string, unknown>, session: StockConnectSession, deps: StockSessionDeps) => Promise<StockToolResult>;

/** The shape of a tool that must not take the binary session or lock -- a
 * pure client-side tool, or a text-channel tool that takes its own lock.
 * Run through stock-session.ts's runPure(). */
export type DerivedPureHandler = (args: Record<string, unknown>, deps: StockSessionDeps) => Promise<StockToolResult>;

// ---------------------------------------------------------------------------
// convertHandshakeError(). Converts
// the typed errors ensureStockSession()/stockConnect() can propagate into
// well-formed refusal text, naming the tool. Never mentions "wedge",
// "hung", or "unresponsive" -- a monitor-ownership conflict is the broker's
// own enforcement of a DIFFERENT grant already holding this instance, which
// an agent must never mistake for a wedged emulator.
// ---------------------------------------------------------------------------

export function convertHandshakeError(toolName: string, err: unknown): StockErrorResult {
  if (err instanceof MonitorOwnershipError) {
    return isErrorText(
      `${toolName}: this instance's monitor socket is already claimed by a different grant ` +
        `(grant ${err.holderGrantId ?? "unknown"}, claimed at ${err.holderClaimedAt ?? "unknown"}, port ${err.port ?? "unknown"}) -- ` +
        `only one client may hold the stock monitor socket at a time.`,
    );
  }
  if (err instanceof MachineRestartedError) {
    // A null current epoch means the broker reports no running instance
    // owned by this session: it was respawned (a new pid), killed, or the
    // broker could not be asked. Say that, rather than printing "null".
    const current =
      err.currentEpoch === null || err.currentEpoch === undefined
        ? "no current epoch: the broker reports no running instance owned by this session -- it was respawned, killed, or could not be asked"
        : `current epoch ${String(err.currentEpoch)}`;
    return isErrorText(
      `${toolName}: the emulator's identity could not be proven across a reconnect ` +
        `(baseline epoch ${String(err.baselineEpoch)}, ${current}) -- ` +
        `treat every result since the previous call as void and retry.`,
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  // WR-06: a connect REFUSAL on the stock path has exactly one common cause, and
  // a bare "connect ECONNREFUSED 172.17.0.1:6605" points at none of it. The
  // broker binds VICE's binary monitor to 127.0.0.1 by default -- a deliberate,
  // documented safety posture, since the binmon is unauthenticated and grants
  // full memory read/write -- while the proxy derives its dial host from the
  // CONTAINERIZED instance URL, i.e. host.docker.internal. In the default
  // containerized topology those two never meet, and nothing in the resulting
  // message named the one environment variable that reconciles them. Named
  // here, at the one seam that converts a handshake failure into agent-facing
  // text, rather than in a comment nobody reading the error will see.
  if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/.test(message)) {
    return isErrorText(
      `${toolName}: stock handshake failed -- nothing accepted a binary-monitor connection (${message}). ` +
        `The broker binds VICE's binary monitor to 127.0.0.1 by DEFAULT (the safe posture: the binary monitor is ` +
        `unauthenticated and grants full memory read/write plus process control to anything that can reach it), ` +
        `so a containerized MCP server dialling the host cannot reach it. Set VICE_BROKER_BINMON_HOST on the ` +
        `BROKER's own environment to an address the container can reach, then restart the broker so the emulator ` +
        `is relaunched with the new bind address.`,
    );
  }
  // G-64-4 (plan 64-12, Task 3): a relay that closed (or errored) DURING the
  // connect handshake, with commands still outstanding -- ahead of the
  // generic branch below, which stays the pre-existing catch-all for
  // everything else (including an attach REFUSAL, thrown as a plain
  // ViceError carrying broker-relay.mjs's own errno-free
  // buildEmulatorUnreachableMessage() text -- that message already says what
  // happened and that retrying is safe, so it rides the generic wording
  // unchanged, never this branch). Named separately from the generic wording
  // because a dropped relay is NOT the same event as "the handshake never
  // even connected": StockConnectionClosedError.abandoned is the count of
  // commands this exact channel lost, and the release this describes is
  // per-channel ONLY (handleRelayDeath()'s own contract, vice-broker.mts) --
  // never the instance or the grant, which is why this text says so
  // explicitly rather than leaving it to be assumed.
  if (err instanceof StockConnectionClosedError) {
    return isErrorText(
      `${toolName}: the relay closed during the connect handshake with ${err.abandoned ?? 0} request(s) unanswered -- ` +
        `a closed relay releases only this channel, never the instance or the grant; retrying the same call is safe.`,
    );
  }
  return isErrorText(`${toolName}: stock handshake failed (${message}).`);
}

// ---------------------------------------------------------------------------
// convertWireError() -- new here (Task 3). The second half of the "one
// error converter" rule, for the errors a client.send() REJECTION carries
// rather than a handshake failure. ViceMonitorClient's #dispatch() rejects
// a pending request with a StockProtocolError on any non-OK wire error
// code, a StockFramingError on a decode-level fault, or a
// StockResponseMismatchError when a reply's response type does not match
// what the command expects -- every family handler needs this and none of
// them may write its own. Never emits "wedge"/"hung"/"unresponsive": a wire
// error is not a liveness diagnosis.
// ---------------------------------------------------------------------------

/** Maps each wire ErrorCode to distinct, explanatory text -- a single table,
 * not a scattered set of ad-hoc strings.
 *
 * G-64-3 (plan 64-13, Task 3): the CmdFailure entry no longer attributes
 * every 0x8f to a checkpoint-condition parse failure -- that parenthetical
 * is what steered plan 64-11's diagnosis toward checkpoints when the real
 * cause was a missing/unpublished file. VICE sends no
 * further diagnostic with this code at all; the emulator's own log may
 * carry the reason. "no further diagnostic" itself is kept verbatim --
 * `stock-handler.test.ts` pins it. */
const WIRE_ERROR_TEXT: Partial<Record<number, string>> = {
  [ErrorCode.ObjectMissing]: "the object named does not exist (e.g. no checkpoint with that number)",
  [ErrorCode.InvalidMemspace]: "invalid memspace -- 0x00 is main, 0x01-0x04 are units 8-11",
  [ErrorCode.InvalidLength]: "the request body length disagreed with what the command expects -- this is a client bug, please report it",
  [ErrorCode.InvalidParameter]: "an argument in the request was invalid for this command",
  [ErrorCode.InvalidApiVersion]: "the binary monitor rejected this request's api_version",
  [ErrorCode.InvalidType]: "this command is not implemented by the connected VICE build",
  [ErrorCode.CmdFailure]: "the command failed inside the monitor with no further diagnostic -- the emulator's own log may carry the reason",
};

/** G-64-3 (plan 64-13, Task 3): a per-call override for `convertWireError()`,
 * applied ONLY when the error code is `CmdFailure` -- every other wire error
 * code's text is untouched, whether or not this options object is supplied.
 * Lets a file-carrying command (AUTOSTART/UNDUMP/DUMP) say what VICE could
 * not do with the file it was handed, instead of the generic gloss above.
 * The condition-setting path in `stock-checkpoints.ts` does not use
 * `convertWireError()` and is unaffected either way. */
export interface ConvertWireErrorOptions {
  cmdFailureText?: string;
}

export function convertWireError(toolName: string, err: unknown, options: ConvertWireErrorOptions = {}): StockErrorResult {
  if (err instanceof StockProtocolError) {
    const text =
      err.errorCode === ErrorCode.CmdFailure && options.cmdFailureText !== undefined
        ? options.cmdFailureText
        : err.errorCode !== undefined
          ? WIRE_ERROR_TEXT[err.errorCode]
          : undefined;
    const codeText = `0x${(err.errorCode ?? 0).toString(16).padStart(2, "0")}`;
    return isErrorText(`${toolName}: ${text ?? `the binary monitor returned error code ${codeText}`} (${err.message}).`);
  }
  if (err instanceof StockResponseMismatchError) {
    return isErrorText(`${toolName}: the binary monitor replied with an unexpected response type (${err.message}).`);
  }
  if (err instanceof StockFramingError) {
    return isErrorText(`${toolName}: the binary monitor's reply could not be decoded (${err.message}).`);
  }
  const message = err instanceof Error ? err.message : String(err);
  return isErrorText(`${toolName}: the command failed (${message}).`);
}

// ---------------------------------------------------------------------------
// stockAnswer() -- new here (Task 3). The ONE place a successful stock
// answer is constructed, so D-06's "runState on EVERY stock tool answer" is
// satisfied by construction rather than by every handler remembering to add
// it. Reads runStateFor(client) exactly once. A `runState` key already
// present in `payload` is overwritten by the projection's value -- a
// handler may never supply its own.
// ---------------------------------------------------------------------------

export function stockAnswer(client: ViceMonitorClient, payload: Record<string, unknown>): StockOkResult {
  const runState = runStateFor(client);
  return { content: [{ type: "text", text: JSON.stringify({ ...payload, runState }) }], isError: false };
}

// ---------------------------------------------------------------------------
// derivedAnswer() -- new here (Phase 5, 05-02, D-05-06). The ONE place a
// SESSION-FREE (`kind: "pure"`) tool's successful answer is constructed. `runState: "unknown"` is the
// honest value here, not a placeholder: a session-free handler never opens a
// monitor connection, so the emulator's run state was genuinely never
// observed -- "unknown" is the honest post-connect value and is not a
// failure. This
// function exists so the standing D-06 gate in stock-tools.test.ts
// ("every stock entry's outputSchema declares a required runState enum of
// [running, stopped, unknown]") needs no exemption list for the two DERIV-04
// symbol tools (`vice_symbols_load`/`vice_symbols_lookup`), this function's
// only consumer (stock-symbols.ts).
//
// Unlike stockAnswer(), this function takes NO client argument at all --
// there is no session to read a run state from, which is the whole point.
// `runState` is stamped LAST, so a `runState` key already present in
// `payload` is overwritten -- matching stockAnswer()'s own "a handler may
// never supply its own" rule.
// ---------------------------------------------------------------------------

export function derivedAnswer(payload: Record<string, unknown>): StockOkResult {
  return { content: [{ type: "text", text: JSON.stringify({ ...payload, runState: "unknown" }) }], isError: false };
}
