#!/usr/bin/env node
// stock-run-until.ts
//
// `vice_run_until` for the stock backend: arms a temporary, stopping exec
// checkpoint at the requested address, resumes the machine exactly once, and
// waits event-driven for the machine to stop -- at that checkpoint, at
// another checkpoint or watch, on a CPU JAM, or for any other reason -- and
// reports what stopped it. `timeout_ms` bounds the wait (default 30000).
//
// WHY THIS FILE EXISTS: without a bound, a call against an address that
// never executes is indistinguishable from a wedged emulator; and a wait
// that only listens for its own checkpoint sits out the whole timeout after
// something else has already stopped the machine.
//
// WHAT NOT TO DO:
//   - Never wrap the cleanup paths in one undifferentiated
//     `finally { delete }`. On a hit VICE has already deleted the temporary
//     checkpoint; on a timeout or a foreign stop it is still armed and is
//     deleted once; on a restart there is nothing left to delete.
//   - Never call registerTraceCheckpoint() here -- that guard exists for
//     `stop:false` trace checkpoints (stock-checkpoints.ts), and the
//     checkpoint this file arms always stops.
//   - Never send a second resume for one wait.
//   - Never invent a second wire-error converter -- an arming failure goes
//     through convertWireError(); a failure from the resume/wait step
//     propagates to runBinary()'s own converter.
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
 * an array. Matches this module tree's own isPlainObject() convention;
 * redeclared privately here, not imported, per the
 * established per-module convention (see stock-checkpoints.ts's own copy). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The `timeout_ms` argument's default, in milliseconds. */
export const RUN_UNTIL_DEFAULT_TIMEOUT_MS = 30000;

/** A present `timeout_ms` above this ceiling is CLAMPED (not refused) to
 * this value, and the answer carries `timeoutClamped: true` -- the caller
 * asked for a deadline this module will not honour past 10 minutes, but the
 * request itself is not malformed the way a non-finite or non-positive
 * value is. */
export const RUN_UNTIL_MAX_TIMEOUT_MS = 600000;

/** Every argument name `vice_run_until` accepts. Anything else is refused
 * by name. */
export const RUN_UNTIL_KEYS: readonly string[] = ["address", "cycles", "timeout_ms"];

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

/** The checkpoint operation bits, by name, for reporting a foreign stop. */
function operationNames(operation: number): string[] {
  const names: string[] = [];
  if (operation & CheckpointOperation.Load) names.push("load");
  if (operation & CheckpointOperation.Store) names.push("store");
  if (operation & CheckpointOperation.Exec) names.push("exec");
  return names;
}

/** How long a STOPPED event must stand without a RESUMED before the wait
 * treats it as a real stop. */
const STOP_SETTLE_MS = 100;

/** What stopped the machine during the wait. `target` is this call's own
 * checkpoint; `checkpoint` is any other checkpoint or watch; `jam` is a CPU
 * JAM event; `other` is a stop with no checkpoint report (for example a JAM
 * with VICE's JAM action set to enter the monitor). */
export type StopCause =
  | { kind: "target"; checkpointId: number; hitCount: number; pc: number }
  | { kind: "checkpoint"; checkpointId: number; start: number; end: number; operations: string[]; hitCount: number; pc: number }
  | { kind: "jam"; pc: number | null }
  | { kind: "other"; pc: number };

type WaitOutcome = { status: "stopped"; cause: StopCause; resumedAfterStop: boolean } | { status: "timeout" };

function isStopEvent(item: unknown): item is { type: "stopped"; programCounter: number } | { type: "jam"; programCounter: number | null } {
  return isPlainObject(item) && (item.type === "stopped" || item.type === "jam");
}

/**
 * Watches the client's events for the next stop. Install it BEFORE arming the
 * checkpoint: a machine that is already running can hit the temporary
 * checkpoint before the arming reply is even processed, so a listener
 * attached afterwards would miss the stop.
 *
 * CHECKPOINT_INFO events are collected (a `stop:false` trace checkpoint
 * reports one without stopping the machine). The wait settles on a STOPPED
 * or JAM event and attributes it to the checkpoints reported since the
 * watcher was installed, preferring this call's own checkpoint.
 *
 * Stock VICE 3.8 wraps every command sent to a running machine in a STOPPED
 * / RESUMED pair. So a STOPPED settles the wait only when no RESUMED follows
 * within STOP_SETTLE_MS, unless a checkpoint was reported: a checkpoint stop
 * that VICE leaves again at once still counts, and the answer says the
 * machine is running (resumedAfterStop).
 *
 * `dispose()` removes every listener and timer; the caller calls it on every
 * path.
 */
interface StopWatcher {
  outcome: Promise<WaitOutcome>;
  /** Tells the watcher which checkpoint id is this call's own. */
  setCheckpointId(id: number): void;
  /** True while a STOPPED is waiting to settle, i.e. the machine is halted. */
  isHalted(): boolean;
  fail(err: unknown): void;
  dispose(): void;
}

function watchForStop(client: ViceMonitorClient, timeoutMs: number): StopWatcher {
  let ownId: number | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let resumedAfterStop = false;
  const reported: ParsedCheckpointInfoResponse["checkpoint"][] = [];
  let resolveOutcome!: (outcome: WaitOutcome) => void;
  let rejectOutcome!: (err: unknown) => void;
  const outcome = new Promise<WaitOutcome>((resolve, reject) => {
    resolveOutcome = resolve;
    rejectOutcome = reject;
  });

  const decide = (pc: number): void => {
    const own = ownId === undefined ? undefined : reported.find((checkpoint) => checkpoint.id === ownId);
    if (own !== undefined) {
      resolveOutcome({ status: "stopped", cause: { kind: "target", checkpointId: own.id, hitCount: own.hitCount, pc }, resumedAfterStop });
      return;
    }
    const foreign = reported.filter((checkpoint) => checkpoint.stopWhenHit).at(-1) ?? reported.at(-1);
    if (foreign !== undefined) {
      resolveOutcome({
        status: "stopped",
        cause: {
          kind: "checkpoint",
          checkpointId: foreign.id,
          start: foreign.start,
          end: foreign.end,
          operations: operationNames(foreign.operation),
          hitCount: foreign.hitCount,
          pc,
        },
        resumedAfterStop,
      });
      return;
    }
    resolveOutcome({ status: "stopped", cause: { kind: "other", pc }, resumedAfterStop });
  };

  const onEvent = (item: unknown): void => {
    if (isPlainObject(item) && item.type === "resumed") {
      if (reported.length === 0) {
        clearTimeout(settleTimer);
        settleTimer = undefined;
      } else if (settleTimer !== undefined) {
        resumedAfterStop = true;
      }
      return;
    }
    if (isCheckpointInfoEvent(item)) {
      reported.push(item.checkpoint);
      return;
    }
    if (!isStopEvent(item)) return;
    if (item.type === "jam") {
      resolveOutcome({ status: "stopped", cause: { kind: "jam", pc: item.programCounter }, resumedAfterStop: false });
      return;
    }
    const pc = item.programCounter;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => decide(pc), STOP_SETTLE_MS);
  };
  // A close mid-wait settles the wait as a timeout: the cleanup delete then
  // finds the dead connection itself.
  const onClose = (): void => resolveOutcome({ status: "timeout" });
  const timer = setTimeout(() => resolveOutcome({ status: "timeout" }), timeoutMs);

  client.on("event", onEvent);
  client.on("close", onClose);

  return {
    outcome,
    setCheckpointId(id) {
      ownId = id;
    },
    isHalted: () => settleTimer !== undefined,
    fail: rejectOutcome,
    dispose() {
      client.off("event", onEvent);
      client.off("close", onClose);
      clearTimeout(settleTimer);
      clearTimeout(timer);
    },
  };
}

type Cleanup = { cleanup: "deleted" | "already_gone" | "delete_failed"; cleanupError?: string };

/** Deletes this call's temporary checkpoint once. ObjectMissing means VICE
 * already deleted it (it fired); any other error is recorded, never thrown. */
async function deleteTemporaryCheckpoint(session: Parameters<StockSessionHandler>[1], checkpointId: number): Promise<Cleanup> {
  try {
    await session.client.send(CommandType.CheckpointDelete, cpNumBody(checkpointId));
    return { cleanup: "deleted" };
  } catch (err) {
    if (err instanceof StockProtocolError && err.errorCode === ErrorCode.ObjectMissing) {
      return { cleanup: "already_gone" };
    }
    return { cleanup: "delete_failed", cleanupError: convertWireError("vice_run_until", err).content[0]!.text };
  }
}

const RESUMED_AFTER_STOP_NOTE =
  "the machine stopped at pc, then VICE resumed it at once (it does this when the stop lands right after the resume). " +
  "The machine is running; pc is where it stopped. Call vice_execution_pause to halt it.";

const HALTED_BY_STOP_NOTE =
  "the machine stopped and nothing here resumed it -- this is expected, not a wedge. Call vice_execution_run to resume.";

export const handleRunUntil: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_run_until: arguments must be an object");
  }

  // Refuse unexpected keys by name: a typo (`timeoutMs`, `addr`) would
  // otherwise run with the default bound and report a confident answer.
  const unexpectedKeys = Object.keys(args).filter((key) => !RUN_UNTIL_KEYS.includes(key));
  if (unexpectedKeys.length > 0) {
    return isErrorText(
      `vice_run_until: unexpected argument(s): ${unexpectedKeys.join(", ")} -- this tool takes only ${RUN_UNTIL_KEYS.join(", ")}`,
    );
  }

  // `cycles` is refused whenever it is present: this backend has no
  // cycle-bounded execution, and dropping it would report an unbounded run
  // as a success.
  if (args.cycles !== undefined) {
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

  // A non-finite, non-numeric or non-positive timeout_ms is refused; a
  // fraction truncates; a value above the ceiling is clamped and the answer
  // says so via `timeoutClamped: true`.
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

  // Arm a temporary, stopping exec checkpoint at `address`. VICE deletes a
  // temporary checkpoint itself the instant it fires.
  let checkpointId = 0;
  let outcome: WaitOutcome;
  const body = checkpointSetBody({
    start: address,
    end: address,
    stop: true,
    enabled: true,
    operation: CheckpointOperation.Exec,
    temporary: true,
    memspace: 0x00,
  });

  const watcher = watchForStop(session.client, timeoutMs);
  try {
    let response: ResolvedResponse;
    try {
      response = await session.client.send(CommandType.CheckpointSet, body);
    } catch (err) {
      return convertWireError("vice_run_until", err);
    }
    if (response.type !== "checkpoint_info") {
      return isErrorText(`vice_run_until: unexpected reply type "${response.type}" from CHECKPOINT_SET`);
    }
    checkpointId = response.checkpoint.id;
    watcher.setCheckpointId(checkpointId);

    // The one resume for this wait. It is skipped when the checkpoint has
    // already stopped a machine that is still halted. A failure of the resume
    // (a MachineRestartedError, say) propagates to runBinary()'s converter;
    // on a restarted machine every checkpoint is gone, so nothing needs
    // deleting.
    if (!watcher.isHalted()) {
      session.client.send(CommandType.Exit).catch(watcher.fail);
    }
    outcome = await watcher.outcome;
  } finally {
    watcher.dispose();
  }

  if (outcome.status === "stopped") {
    const { cause } = outcome;
    const payload: Record<string, unknown> = {
      requested: "run_until",
      reached: cause.kind === "target",
      address,
      checkpointId,
      timeoutMs,
      stoppedBy: cause,
      machineHalted: !outcome.resumedAfterStop,
      machineHaltedNote: outcome.resumedAfterStop ? RESUMED_AFTER_STOP_NOTE : HALTED_BY_STOP_NOTE,
    };
    if (cause.pc !== null) payload.pc = cause.pc;
    if (cause.kind === "target") {
      // VICE already deleted the temporary checkpoint when it fired.
      payload.hitCount = cause.hitCount;
    } else {
      // Something else stopped the machine first; this call's checkpoint is
      // still armed.
      const cleanup = await deleteTemporaryCheckpoint(session, checkpointId);
      payload.cleanup = cleanup.cleanup;
      if (cleanup.cleanupError !== undefined) payload.cleanupError = cleanup.cleanupError;
    }
    if (timeoutClamped) payload.timeoutClamped = true;
    return stockAnswer(session.client, payload);
  }

  // Timeout: the machine did not stop within timeoutMs. Delete the
  // checkpoint exactly once.
  const { cleanup, cleanupError } = await deleteTemporaryCheckpoint(session, checkpointId);

  // A delete that was answered halted the machine (on stock any inbound
  // byte does). A failed delete -- typically a socket that is already gone
  // -- establishes nothing, so fall back to the run-state projection.
  const deleteWasAnswered = cleanup !== "delete_failed";
  const machineHalted = deleteWasAnswered && session.client.connected ? true : runStateFor(session.client) === "stopped";
  const machineHaltedNote = machineHalted
    ? "the cleanup CHECKPOINT_DELETE sent after the timeout halted the emulated machine (on stock, any inbound byte does), and " +
      "nothing here resumed it -- this is expected, not a wedge. Call vice_execution_run to resume."
    : "the machine's run state could NOT be established: the cleanup CHECKPOINT_DELETE did not complete (see cleanupError) " +
      "and/or the connection is gone, so nothing here can claim the machine is halted. Call vice_execution_pause, then " +
      "vice_registers_get, before acting -- in particular do not assume vice_execution_run will reach this instance. If " +
      "neither answers, ask the user to restart the broker.";

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
      "a genuinely wedged emulator. This bounded answer means the address itself " +
      "did not execute in time, not that the connection is unresponsive. Whether the machine is now stopped -- and " +
      "therefore whether vice_execution_run is the right next call -- is reported by machineHalted and " +
      "machineHaltedNote; read those rather than assuming either way.",
  };
  if (timeoutClamped) payload.timeoutClamped = true;
  if (cleanupError !== undefined) payload.cleanupError = cleanupError;

  if (cleanup === "already_gone") {
    // ObjectMissing on the delete means the temporary checkpoint fired
    // between the deadline and the delete. Resolve that race from the
    // program counter, or declare it unresolved -- never guess.
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
      payload.reachedUnknown = true;
      payload.raceResolved = "unresolved";
      payload.pcReadError = convertWireError("vice_run_until", err).content[0]!.text;
      payload.raceNote =
        "the temporary checkpoint was already gone before the cleanup delete arrived (it likely fired), but the program " +
        "counter could not be read to confirm it -- read the program counter yourself (vice_registers_get) to settle it.";
    }
  } else {
    payload.reached = false;
  }

  return stockAnswer(session.client, payload);
};
