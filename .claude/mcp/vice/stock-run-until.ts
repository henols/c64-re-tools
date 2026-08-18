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
import { readProgramCounter } from "./stock-timing.ts";
import { runStateFor } from "./stock-runstate.ts";

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

  // WR-18 (07-REVIEW.md), part 1: refuse unexpected keys BY NAME, exactly as
  // the sibling handler added in this same phase does (handleCyclesStopwatch,
  // stock-timing.ts). Accepting them silently means a typo -- `timeoutMs` for
  // `timeout_ms`, `addr` for `address` -- runs with the DEFAULT bound and
  // reports a confident answer, and the caller has no way to tell.
  const RUN_UNTIL_KEYS = ["address", "cycles", "timeout_ms"];
  const unexpectedKeys = Object.keys(args).filter((key) => !RUN_UNTIL_KEYS.includes(key));
  if (unexpectedKeys.length > 0) {
    return isErrorText(
      `vice_run_until: unexpected argument(s): ${unexpectedKeys.join(", ")} -- this tool takes only ${RUN_UNTIL_KEYS.join(", ")}`,
    );
  }

  // WR-18, part 2: `cycles` is refused WHENEVER it is present, not only when
  // `address` is absent.
  //
  // Before this, the "cycles-only mode not yet implemented" refusal was
  // reachable only on the no-address path, so `{ address: "$c000", cycles: 5000 }`
  // silently DROPPED the cycle bound and answered `reached: true` -- a caller
  // who asked for "run to this address but give up after 5000 cycles" got an
  // unbounded-by-cycles run reported as a success. Refusing is the honest
  // answer: this backend has no cycles-bounded execution at all (TIME-03), and
  // the fork never shipped one either.
  if (args.cycles !== undefined) {
    // The fork's own refusal wording (mcp_tools_debug.c:772), matched
    // verbatim rather than inventing a cycles-bounded execution the fork
    // never shipped -- TIME-03's own requirement. Extended with the
    // address-present case, which the fork's wording does not cover because
    // the fork never silently dropped the bound the way this handler did.
    return isErrorText(
      args.address === undefined
        ? "vice_run_until: cycles-only mode not yet implemented; provide an address"
        : "vice_run_until: cycles-only mode not yet implemented; \"cycles\" is not supported alongside \"address\" either -- it would be " +
          "silently ignored, so it is refused rather than dropped. Remove \"cycles\" and bound the wait with \"timeout_ms\" instead.",
    );
  }

  if (args.address === undefined) {
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
    //
    // machineHalted (07-14/WR-02): the checkpoint that just fired STOPPED
    // the machine (it was armed with stop:true) -- on stock, any inbound
    // byte halts the machine (CLAUDE.md, monitor_binary.c:281) and nothing
    // in this handler resumes it. Emitted unconditionally, never only when
    // true, so an absent field can never be read as "not halted" (the exact
    // ambiguity WR-02 is about).
    const payload: Record<string, unknown> = {
      requested: "run_until",
      reached: true,
      address,
      checkpointId,
      hitCount: outcome.hitCount,
      timeoutMs,
      machineHalted: true,
      machineHaltedNote:
        "the checkpoint at the requested address stopped the emulated machine when it fired, and nothing here resumed it -- " +
        "this is expected, not a wedge. Call vice_execution_run to resume.",
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

  // machineHalted (07-14/WR-02, corrected by 07-REVIEW.md WR-01).
  //
  // 07-14 hardcoded `true` here for all three cleanup branches, reasoning
  // that the CHECKPOINT_DELETE above is itself an inbound byte and so halted
  // the machine. That holds for "deleted" and "already_gone" -- both mean
  // the delete travelled over the wire and was answered -- but NOT for
  // "delete_failed", which is reachable precisely when the socket is already
  // gone: waitForCheckpointHit()'s own `close` handler settles the wait as
  // `{ status: "timeout" }`, the delete then rejects with
  // StockConnectionClosedError, and a hardcoded `true` claims a halted
  // machine over a dead connection while telling the caller to send
  // vice_execution_run down it. stockAnswer() stamps runState into this same
  // object, so that answer could read {"machineHalted": true, "runState":
  // "running"} -- self-contradictory in one JSON body.
  //
  // So derive it, from the same seam stock-diagnose.ts's deriveMachinePaused()
  // uses, and keep the note honest per branch. This is the rule
  // stock-diagnose.ts:642-656 states normatively: a hand-passed state flag
  // drifts from reality the moment a call site changes. Do not reintroduce a
  // literal here.
  const deleteWasAnswered = cleanup !== "delete_failed";
  const machineHalted = deleteWasAnswered && session.client.connected ? true : runStateFor(session.client) === "stopped";
  const machineHaltedNote = machineHalted
    ? "the cleanup CHECKPOINT_DELETE sent after the timeout halted the emulated machine (on stock, any inbound byte does), and " +
      "nothing here resumed it -- this is expected, not a wedge. Call vice_execution_run to resume."
    : "the machine's run state could NOT be established: the cleanup CHECKPOINT_DELETE did not complete (see cleanupError) " +
      "and/or the connection is gone, so nothing here can claim the machine is halted. Call vice_diagnose before acting -- " +
      "in particular do not assume vice_execution_run will reach this instance.";

  const payload: Record<string, unknown> = {
    requested: "run_until",
    timedOut: true,
    address,
    timeoutMs,
    cleanup,
    machineHalted,
    machineHaltedNote,
    explanation:
      "an address that never executes within the timeout window is, from the caller's side, indistinguishable from " +
      "a genuinely wedged emulator -- see vice-wedge-triage/SKILL.md. This bounded answer means the address itself " +
      "did not execute in time, not that the connection is unresponsive. Whether the machine is now stopped -- and " +
      "therefore whether vice_execution_run is the right next call -- is reported by machineHalted and " +
      "machineHaltedNote; read those rather than assuming either way.",
  };
  if (timeoutClamped) payload.timeoutClamped = true;
  if (cleanupError !== undefined) payload.cleanupError = cleanupError;

  if (cleanup === "already_gone") {
    // WR-01: an ObjectMissing on this delete means the temporary checkpoint
    // was already gone before the delete arrived -- VICE only does that the
    // instant the checkpoint fires (mon_breakpoint.c:605-607), so the
    // address almost certainly WAS reached, between the deadline expiring
    // and this cleanup delete being sent. Never assert reached:false on
    // this branch; resolve it from the program counter instead, or declare
    // it unresolved -- never fabricate a PC value.
    try {
      const pc = await readProgramCounter(session);
      if (pc === address) {
        payload.reached = true;
        payload.raceResolved = "pc_at_address";
        payload.pcAtCleanup = pc;
        payload.raceNote =
          "the temporary checkpoint fired between the deadline expiring and the cleanup delete being sent -- the program " +
          "counter still at the requested address confirms the address executed.";
      } else {
        payload.reached = false;
        payload.raceResolved = "pc_elsewhere";
        payload.pcAtCleanup = pc;
        payload.raceNote =
          `the temporary checkpoint was already gone before the cleanup delete arrived, but the program counter is at ` +
          `0x${pc.toString(16)}, not the requested 0x${address.toString(16)} -- the race is resolved against a hit.`;
      }
    } catch (err) {
      // The one path where this tool genuinely does not know: never emit
      // `reached` and `reachedUnknown` together, and never emit
      // `reached: false` here -- that would assert a falsehood exactly as
      // confidently as the defect this plan closes.
      payload.reachedUnknown = true;
      payload.raceResolved = "unresolved";
      payload.pcReadError = convertWireError("vice_run_until", err).content[0]!.text;
      payload.raceNote =
        "the temporary checkpoint was already gone before the cleanup delete arrived (it likely fired), but the program " +
        "counter could not be read to confirm it -- read the program counter yourself (vice_registers_get) to settle it.";
    }
  } else {
    // "deleted" and "delete_failed": the checkpoint provably still existed
    // at cleanup time (or its state is reported separately via
    // cleanupError), so no race resolution is warranted.
    payload.reached = false;
  }

  return stockAnswer(session.client, payload);
};
