#!/usr/bin/env node
// stock-handler.ts
//
// THE shared, cycle-free handler contract every Phase 3+ family module
// (stock-memory.ts, stock-checkpoints.ts, stock-execution.ts, ...) imports:
// the result types, both error converters, and stockAnswer() -- the ONE
// place a successful stock answer is constructed.
//
// WHY THIS FILE EXISTS: stock-dispatch.ts is THE dispatch table (D-07/D-09)
// and, starting with a later plan, imports every family module so it can
// register their handlers. A family module that needs stockAnswer() or
// convertHandshakeError() cannot import stock-dispatch.ts for them without
// creating exactly that import cycle (stock-dispatch.ts -> stock-memory.ts
// -> stock-dispatch.ts). This file is the leaf both sides import instead:
// stock-dispatch.ts re-exports these names (so Phase 2's existing import
// surface and its 921-line test file keep working unchanged), and every
// family module imports them straight from here, never from
// stock-dispatch.ts.
//
// WHAT NOT TO DO:
//   - Never build a `{ content: [...], isError: false }` literal outside
//     stockAnswer() -- that is exactly how an answer ships without
//     `runState`, which D-06 requires on EVERY stock tool answer.
//   - Never construct a session-free derived answer as a bare literal
//     either -- a `needsSession: false` handler calls derivedAnswer(), a
//     sessioned handler calls stockAnswer(), and there is no third shape.
//   - Never write a third error converter. convertHandshakeError() (moved
//     here, unchanged, from stock-dispatch.ts) is the ONE conversion for a
//     failed ensureStockSession()/stockConnect(); convertWireError() (new
//     here) is the ONE conversion for a client.send() rejection. A family
//     module that finds itself writing prose for a wire ErrorCode or a
//     handshake error is re-deriving one of these two -- import instead.
//   - Never import stock-dispatch.ts at RUNTIME from this file -- only a
//     type-only import of StockDispatchDeps is permitted. Under
//     verbatimModuleSyntax an `import type` erases completely at compile
//     time, so it creates no runtime cycle even though stock-dispatch.ts
//     imports this file at runtime.
import { MonitorOwnershipError } from "./vice-broker-client.ts";
import { MachineRestartedError } from "./vice.ts";
import { ErrorCode, StockFramingError, StockProtocolError, StockResponseMismatchError, type ViceMonitorClient } from "./stock-protocol.ts";
import { runStateFor } from "./stock-runstate.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

// ---------------------------------------------------------------------------
// Result types -- moved verbatim from stock-dispatch.ts. Structurally
// IDENTICAL to vice-proxy.ts's own private ToolCallResult (ErrorTextResult |
// OkTextResult) by field name and type, but declared here rather than
// imported -- vice-proxy.ts imports stock-dispatch.ts, which imports THIS
// file, so importing back from vice-proxy.ts would be the exact
// module-cycle this codebase's own "module-cycle avoidance is deliberate"
// constraint forbids. TypeScript's structural typing makes the two
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
export type StockSessionHandler = (args: Record<string, unknown>, session: StockConnectSession, deps: StockDispatchDeps) => Promise<StockToolResult>;

// ---------------------------------------------------------------------------
// convertHandshakeError() -- moved verbatim from stock-dispatch.ts. Converts
// the typed errors ensureStockSession()/stockConnect() can propagate into
// well-formed refusal text, naming the tool. Never mentions "wedge",
// "hung", or "unresponsive" -- a monitor-ownership conflict is the broker's
// own enforcement of a DIFFERENT grant already holding this instance, a
// state vice-wedge-triage's opening move must not be misdirected by into
// treating as a wedged emulator.
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
    return isErrorText(
      `${toolName}: the emulator's identity could not be proven across a reconnect ` +
        `(baseline epoch ${String(err.baselineEpoch)}, current epoch ${String(err.currentEpoch)}) -- ` +
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
 * not a scattered set of ad-hoc strings. */
const WIRE_ERROR_TEXT: Partial<Record<number, string>> = {
  [ErrorCode.ObjectMissing]: "the object named does not exist (e.g. no checkpoint with that number)",
  [ErrorCode.InvalidMemspace]: "invalid memspace -- 0x00 is main, 0x01-0x04 are units 8-11",
  [ErrorCode.InvalidLength]: "the request body length disagreed with what the command expects -- this is a client bug, please report it",
  [ErrorCode.InvalidParameter]: "an argument in the request was invalid for this command",
  [ErrorCode.InvalidApiVersion]: "the binary monitor rejected this request's api_version",
  [ErrorCode.InvalidType]: "this command is not implemented by the connected VICE build",
  [ErrorCode.CmdFailure]: "the command failed inside the monitor with no further diagnostic (a condition syntax error reports exactly this and nothing more)",
};

export function convertWireError(toolName: string, err: unknown): StockErrorResult {
  if (err instanceof StockProtocolError) {
    const text = err.errorCode !== undefined ? WIRE_ERROR_TEXT[err.errorCode] : undefined;
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
// SESSION-FREE (`withDerivedTool(..., { needsSession: false }, ...)`) derived
// tool's successful answer is constructed. `runState: "unknown"` is the
// honest value here, not a placeholder: a session-free handler never opens a
// monitor connection, so the emulator's run state was genuinely never
// observed -- "unknown" is already documented (docs/stock-vice-parity.md
// §A.7) as "the honest post-connect value and is not a failure". This
// function exists so the standing D-06 gate in stock-dispatch.test.ts
// ("every stock entry's outputSchema declares a required runState enum of
// [running, stopped, unknown]") needs no exemption list for the two DERIV-04
// symbol tools (`vice_symbols_load`/`vice_symbols_lookup`) -- currently the
// only `needsSession: false` tools in the milestone, and this function's
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
