#!/usr/bin/env node
// stock-run-until.ts
//
// `vice_run_until` for the stock backend (TIME-02/TIME-03): arms a TEMPORARY,
// stopping exec checkpoint at the requested address, resumes the machine
// exactly once, waits event-driven for THAT checkpoint's own CHECKPOINT_INFO,
// and takes a different, correct cleanup action on each of three paths --
// hit, timeout, machine-restarted-mid-wait. Implements D-02: an optional,
// stock-only `timeout_ms` argument defaulting to 30000, the same default
// VICE_MCP_TIMEOUT_MS already uses, so one number governs both layers.
//
// WHY THIS FILE EXISTS: the wedge-triage skill documents `vice_run_until` as
// having NO working timeout on stock today -- a call against an address that
// never executes is indistinguishable from a genuine wedge. This module is
// what bounds that wait and tells the two apart, and is one of the last two
// skill-called tools missing on the stock backend.
//
// WHAT NOT TO DO:
//   - Never wrap the three cleanup paths (hit / timeout / restarted) in one
//     undifferentiated `finally { delete }` -- that is this design space's
//     documented first-draft mistake (Pitfall 4). Each path takes its OWN,
//     distinct action, and only the timeout path ever issues a delete.
//   - Never call registerTraceCheckpoint() here -- that guard exists for
//     `stop:false` trace checkpoints (stock-checkpoints.ts), and the
//     checkpoint this file arms always stops.
//   - Never send a second resume for one wait -- exactly one resume per
//     call, matching vice-sync.ts's own "exactly one resume per wait"
//     invariant, ported here in its stock-native (event-driven, not
//     polling) form.
//   - Never invent a second wire-error converter -- an arming failure goes
//     through convertWireError() directly (the established per-handler
//     convention every sibling family module already follows); a failure
//     surfacing from the resume/wait step is left to propagate uncaught, so
//     the ONE existing converter seam (withStockSession's own
//     convertHandshakeError/convertWireError) produces the answer, not a
//     second one written in this file.
import {
  CommandType,
  CheckpointOperation,
  checkpointSetBody,
  cpNumBody,
  ErrorCode,
  StockProtocolError,
  type ParsedCheckpointInfoResponse,
  type ResolvedResponse,
  type ViceMonitorClient,
} from "./stock-protocol.ts";
import { parseAddress } from "./stock-address.ts";
import { stockAnswer, isErrorText, convertWireError, type StockSessionHandler } from "./stock-handler.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (vice.ts:310-316); redeclared privately here, not imported, per the
 * established per-module convention (see stock-checkpoints.ts's own copy). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** D-02: the stock-only `timeout_ms` argument's default, in milliseconds.
 * Matches VICE_MCP_TIMEOUT_MS's own 30000 default (vice.ts) so one number
 * governs both the RPC transport layer and this tool's own wait. */
export const RUN_UNTIL_DEFAULT_TIMEOUT_MS = 30000;

/** A present `timeout_ms` above this ceiling is CLAMPED (not refused) to
 * this value, and the answer carries `timeoutClamped: true` -- the caller
 * asked for a deadline this module will not honour past 10 minutes, but the
 * request itself is not malformed the way a non-finite or non-positive
 * value is. */
export const RUN_UNTIL_MAX_TIMEOUT_MS = 600000;

/** Narrows an emitted `event` item to a CHECKPOINT_INFO event -- checked on
 * the parsed item's own `.type` discriminant, never on response type alone
 * (CHECKPOINT_INFO (0x11) shares a response type with a legitimate command
 * reply). The same predicate shape stock-checkpoints.ts's own
 * isCheckpointInfoEvent() uses, copied rather than imported -- each family
 * module keeps its own private copy, matching this tree's established
 * per-module convention. */
function isCheckpointInfoEvent(item: unknown): item is ParsedCheckpointInfoResponse {
  return isPlainObject(item) && item.type === "checkpoint_info" && isPlainObject(item.checkpoint);
}

type WaitOutcome = { status: "hit"; hitCount: number } | { status: "timeout" };

/**
 * Installs ONE `event` listener narrowed on the parsed event's own `.type`
 * discriminant, THEN the specific checkpoint id, sends the resume exactly
 * once, and races that against a single timeout deadline and the client's
 * own `close` signal. The listener is installed BEFORE the resume is sent,
 * so a checkpoint that fires immediately after cannot be missed in the gap
 * between "sent" and "listening".
 *
 * Removes every listener and clears the timer in a `finally` on EVERY path
 * -- resolve, timeout, and rejection -- so a long session never accumulates
 * listeners (T-07-09).
 *
 * A `close` event mid-wait settles the wait as a timeout rather than
 * sitting until the deadline: there is nothing left to wait ON once the
 * socket is gone, and the caller's own timeout-path cleanup attempt will
 * discover the dead connection on its own delete call rather than this
 * function guessing at it.
 *
 * Any rejection from the resume send itself (a MachineRestartedError, or
 * any other error) propagates OUT of this function uncaught -- see
 * handleRunUntil's own comment, below, on why no delete is attempted for
 * that path.
 */
async function waitForCheckpointHit(client: ViceMonitorClient, checkpointId: number, timeoutMs: number): Promise<WaitOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onEvent: ((item: unknown) => void) | undefined;
  let onClose: (() => void) | undefined;

  try {
    return await new Promise<WaitOutcome>((resolve, reject) => {
      onEvent = (item: unknown) => {
        if (!isCheckpointInfoEvent(item)) return;
        if (item.checkpoint.id !== checkpointId) return;
        resolve({ status: "hit", hitCount: item.checkpoint.hitCount });
      };
      onClose = () => {
        resolve({ status: "timeout" });
      };

      client.on("event", onEvent);
      client.on("close", onClose);
      timer = setTimeout(() => resolve({ status: "timeout" }), timeoutMs);

      // The one resume for this wait -- installed listener above fires
      // BEFORE this send() call so a checkpoint hit racing the reply cannot
      // slip through the gap.
      client.send(CommandType.Exit).catch(reject);
    });
  } finally {
    if (onEvent) client.off("event", onEvent);
    if (onClose) client.off("close", onClose);
    if (timer !== undefined) clearTimeout(timer);
  }
}

export const handleRunUntil: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_run_until: arguments must be an object");
  }

  if (args.address === undefined) {
    const cyclesIsPositiveNumber = typeof args.cycles === "number" && Number.isFinite(args.cycles) && args.cycles > 0;
    if (cyclesIsPositiveNumber) {
      // The fork's own refusal wording (mcp_tools_debug.c:772), matched
      // verbatim rather than inventing a cycles-bounded execution the fork
      // never shipped -- TIME-03's own requirement.
      return isErrorText("vice_run_until: cycles-only mode not yet implemented; provide an address");
    }
    return isErrorText("vice_run_until: address is required");
  }

  let address: number;
  try {
    address = parseAddress(args.address, { what: "vice_run_until address" });
  } catch (err) {
    return isErrorText(`vice_run_until: ${describeError(err)}`);
  }

  // D-02: timeout_ms validation. A non-finite, non-numeric, or non-positive
  // value is REFUSED naming the offending value and the valid range -- never
  // silently coerced to 0 (an instant spurious timeout) and never to the
  // default. Fractional values truncate with Math.trunc AFTER the finiteness
  // check, matching clampCpuHistoryCount()'s (stock-connect.ts) own
  // discipline. A value above the ceiling is CLAMPED, not refused, and the
  // answer says so via `timeoutClamped: true`.
  let timeoutMs = RUN_UNTIL_DEFAULT_TIMEOUT_MS;
  let timeoutClamped = false;
  if (args.timeout_ms !== undefined) {
    const raw = args.timeout_ms;
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return isErrorText(`vice_run_until: timeout_ms must be a finite number of milliseconds, got ${JSON.stringify(raw)}`);
    }
    const truncated = Math.trunc(raw);
    if (truncated <= 0) {
      return isErrorText(
        `vice_run_until: timeout_ms must be > 0, got ${JSON.stringify(raw)} -- expected an integer in 1..${RUN_UNTIL_MAX_TIMEOUT_MS}`,
      );
    }
    if (truncated > RUN_UNTIL_MAX_TIMEOUT_MS) {
      timeoutMs = RUN_UNTIL_MAX_TIMEOUT_MS;
      timeoutClamped = true;
    } else {
      timeoutMs = truncated;
    }
  }

  // Arm a temporary, stopping exec checkpoint at `address`. This is this
  // codebase's first caller in this tree to pass the temporary flag as
  // true: VICE itself auto-deletes a temporary checkpoint the instant it
  // fires (mon_breakpoint.c:605-607), unlike every other caller in this
  // tree (handleCheckpointAdd, stock-checkpoints.ts, always passes it
  // false) -- this divergence is deliberate, not an oversight.
  const body = checkpointSetBody({
    start: address,
    end: address,
    stop: true,
    enabled: true,
    operation: CheckpointOperation.Exec,
    temporary: true,
    memspace: 0x00,
  });

  let response: ResolvedResponse;
  try {
    response = await session.client.send(CommandType.CheckpointSet, body);
  } catch (err) {
    return convertWireError("vice_run_until", err);
  }
  if (response.type !== "checkpoint_info") {
    return isErrorText(`vice_run_until: unexpected reply type "${response.type}" from CHECKPOINT_SET`);
  }
  const checkpointId = response.checkpoint.id;

  // No try/catch around the wait itself: a MachineRestartedError (or any
  // other failure) surfacing from the resume/wait step propagates straight
  // out of this handler, uncaught. Attempting a delete here would be wrong
  // on every one of those failure causes -- when the machine has restarted,
  // the instance and every checkpoint on it are already gone, so there is
  // nothing to clean up, and the standard restarted wording is produced by
  // the one existing convertHandshakeError()/convertWireError() seam
  // (stock-handler.ts / withStockSession), not a second converter written
  // here.
  const outcome = await waitForCheckpointHit(session.client, checkpointId, timeoutMs);

  if (outcome.status === "hit") {
    // Hit: VICE already deleted the temporary checkpoint itself
    // (mon_breakpoint.c:605-607) -- issuing CHECKPOINT_DELETE here would
    // target an object that no longer exists.
    const payload: Record<string, unknown> = {
      requested: "run_until",
      reached: true,
      address,
      checkpointId,
      hitCount: outcome.hitCount,
      timeoutMs,
    };
    if (timeoutClamped) payload.timeoutClamped = true;
    return stockAnswer(session.client, payload);
  }

  // Timeout: the checkpoint never fired within timeoutMs. Delete it exactly
  // once -- ObjectMissing (the hit landed between the deadline firing and
  // this delete) is tolerated as benign; any other wire error is recorded on
  // the answer, never thrown, so the caller still gets a bounded result.
  let cleanup: "deleted" | "already_gone" | "delete_failed" = "deleted";
  let cleanupError: string | undefined;
  try {
    await session.client.send(CommandType.CheckpointDelete, cpNumBody(checkpointId));
  } catch (err) {
    if (err instanceof StockProtocolError && err.errorCode === ErrorCode.ObjectMissing) {
      cleanup = "already_gone";
    } else {
      cleanup = "delete_failed";
      cleanupError = convertWireError("vice_run_until", err).content[0]!.text;
    }
  }

  const payload: Record<string, unknown> = {
    requested: "run_until",
    reached: false,
    timedOut: true,
    address,
    timeoutMs,
    cleanup,
    explanation:
      "an address that never executes within the timeout window is, from the caller's side, indistinguishable from " +
      "a genuinely wedged emulator -- see vice-wedge-triage/SKILL.md. This bounded answer means the address itself " +
      "did not execute in time, not that the connection is unresponsive.",
  };
  if (timeoutClamped) payload.timeoutClamped = true;
  if (cleanupError !== undefined) payload.cleanupError = cleanupError;
  return stockAnswer(session.client, payload);
};
