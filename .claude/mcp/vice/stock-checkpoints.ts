#!/usr/bin/env node
// stock-checkpoints.ts
//
// THE checkpoint/watchpoint handler family for the stock backend (DIRECT-03):
// add, delete, list, toggle, set-condition, and watch-add. Also the ONE place
// that holds the D-10 condition registry (with its fail-closed cleanup) and
// the D-11 trace guard for `stop:false` checkpoints -- both hazards exist the
// moment DIRECT-03 ships, so they ship with it rather than waiting for a
// later phase.
//
// WHY THIS FILE EXISTS: stock VICE's checkpoint conditions cannot be read
// back, cannot be cleared, and leak (the old text stays attached inside VICE)
// if re-set -- so an agent needs a client-side record of what it attached,
// and a re-set must be refused rather than silently doubling up. Separately,
// a `stop:false` checkpoint emits a CHECKPOINT_INFO frame per hit
// SYNCHRONOUSLY, from inside the emulator's CPU loop, over the blocking
// monitor socket (docs/phase0-binmon-findings.md §1; mon_breakpoint.c:557-562
// calls mon_breakpoint_event() before checking cp->stop) -- on a hot address
// this can stall the emulator thread and deadlock this client. Both guards
// are correctness-as-safety issues, not polish, so they belong in the same
// module as the tools that create the hazard.
//
// This file is built up task by task (three tasks in this plan): Task 1
// (this commit) adds checkpoint add/delete/list/toggle plus the minimal D-10/
// D-11 plumbing those handlers already call into (a plain registry read/
// write/delete, and a registration point for the trace guard); Task 2 adds
// condition-setting (set-condition, watch-add, the fail-closed cleanup, and
// condition immutability); Task 3 replaces the D-11 skeleton below with the
// real rate-limited, deferred-auto-disable trace guard.
//
// WHAT NOT TO DO:
//   - Never string-concatenate a condition. Both input paths funnel through
//     stock-condition.ts's emitCondition() -- the only function in this tree
//     that ever produces condition wire text (D-09).
//   - Never add an inline `condition` argument to vice_checkpoint_add. D-12
//     keeps the fork's add-then-condition split so Phase 8's parity harness
//     drives identical sequences through both backends. vice_watch_add is the
//     one exception -- it already takes `condition` on the FORK's own schema,
//     so it stays atomic here too.
//   - Never add vice_checkpoint_set_ignore_count (D-15). There is no native
//     ignore count; the only implementation would resume the machine on each
//     ignored hit, which is a carve-out in D-05's absolute halt policy this
//     module must not create.
//   - Never send from inside the trace guard's 'event' listener (Task 3).
//   - Never construct an ok-answer outside stockAnswer() -- that is exactly
//     how an answer ships without `runState` (D-06).
import {
  CommandType,
  CheckpointOperation,
  checkpointSetBody,
  checkpointToggleBody,
  cpNumBody,
  type ParsedCheckpoint,
  type ParsedCheckpointInfoResponse,
} from "./stock-protocol.ts";
import { parseAddress } from "./stock-address.ts";
import { stockAnswer, isErrorText, convertWireError, type StockSessionHandler } from "./stock-handler.ts";
import type { StockConnectSession } from "./stock-connect.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not an
 * array. Matches this module tree's own isPlainObject() convention
 * (vice.ts:310-316); redeclared privately here, not imported, per the
 * established per-module convention. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Decodes CHECKPOINT_SET/CHECKPOINT_INFO's operation bitmask into the
 * ["load","store","exec"]-style array a caller can read without knowing the
 * wire bit values. */
function decodeOperationFlags(operation: number): string[] {
  const flags: string[] = [];
  if (operation & CheckpointOperation.Load) flags.push("load");
  if (operation & CheckpointOperation.Store) flags.push("store");
  if (operation & CheckpointOperation.Exec) flags.push("exec");
  return flags;
}

/** Validates a `checkpoint_num` argument -- an integer in 0..0xffffffff,
 * matching cpNumBody()'s/checkpointToggleBody()'s own wire range. Throws a
 * plain Error; every call site catches it and prefixes the tool name. */
function parseCheckpointNum(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`checkpoint_num must be an integer in 0..0xffffffff, got ${JSON.stringify(value)}`);
  }
  return value;
}

const STOP_FALSE_HAZARD_TEXT =
  "stop:false requires acknowledgeTraceRisk:true -- a non-stopping checkpoint emits one CHECKPOINT_INFO frame per " +
  "hit synchronously, from inside the emulator's CPU loop, over the blocking monitor socket, so on a hot address " +
  "it can stall the emulator thread and deadlock this client; pass acknowledgeTraceRisk:true to opt in (the " +
  "client then rate-limits hits per second and auto-disables the checkpoint if the limit is exceeded).";

// ---------------------------------------------------------------------------
// D-10: the client-side condition registry.
//
// Keyed on session.targetId, NOT on the session object itself: a
// stockReconnect() builds a fresh session, but MachineRestartedError already
// guarantees it is the SAME machine, and the emulator's checkpoints (and
// their attached conditions) survive the reconnect on the wire side -- so
// keying on the session object would silently lose condition text that is
// still attached inside VICE. Keying on targetId keeps the registry aligned
// with the machine identity guarantee the rest of this module tree relies on.
// ---------------------------------------------------------------------------

let conditionRegistry = new Map<string, Map<number, string>>();

function conditionMapFor(session: StockConnectSession): Map<number, string> {
  let m = conditionRegistry.get(session.targetId);
  if (!m) {
    m = new Map();
    conditionRegistry.set(session.targetId, m);
  }
  return m;
}

/** Reads the recorded condition text for `checkpointNum` on `session`'s
 * target -- `undefined` when this session has no record of one (either
 * never set, or set outside this session; stock cannot read condition text
 * back off the wire either way). */
export function conditionTextFor(session: StockConnectSession, checkpointNum: number): string | undefined {
  return conditionRegistry.get(session.targetId)?.get(checkpointNum);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed starting Task 2 (handleCheckpointSetCondition/handleWatchAdd)
function recordCondition(session: StockConnectSession, checkpointNum: number, text: string): void {
  conditionMapFor(session).set(checkpointNum, text);
}

function forgetCondition(session: StockConnectSession, checkpointNum: number): void {
  conditionRegistry.get(session.targetId)?.delete(checkpointNum);
}

// ---------------------------------------------------------------------------
// D-11 trace guard -- Task 1 skeleton. Just enough state for
// handleCheckpointAdd/List/Delete to call into: registration and a
// (currently always-empty) auto-disable report. Task 3 replaces this with
// the real per-client, rate-limited, deferred-auto-disable guard -- the
// exported names below stay the same so Task 1's call sites need no changes.
// ---------------------------------------------------------------------------

let traceCheckpointsByTarget = new Map<string, Set<number>>();

/** Arms the trace guard for `checkpointId` on `session`'s target. Task 3
 * upgrades this to attach a real rate-limiting 'event' listener; for Task 1
 * this only records that the id is a `stop:false` checkpoint. */
export function registerTraceCheckpoint(session: StockConnectSession, checkpointId: number): void {
  let set = traceCheckpointsByTarget.get(session.targetId);
  if (!set) {
    set = new Set();
    traceCheckpointsByTarget.set(session.targetId, set);
  }
  set.add(checkpointId);
}

function forgetTraceState(session: StockConnectSession, checkpointNum: number): void {
  traceCheckpointsByTarget.get(session.targetId)?.delete(checkpointNum);
}

/** Read by every handler in this module just before answering, so an
 * auto-disable is surfaced in the very next answer as `autoDisables: [...]`.
 * Always empty until Task 3 adds the mechanism that populates it. */
export function autoDisableReportFor(
  _session: StockConnectSession,
): Array<{ checkpointNum: number; reason: string; at: number; hitsPerSecond: number }> {
  return [];
}

/** Test-only: resets the condition registry and the trace-guard's tables
 * together. */
export function resetCheckpointStateForTest(): void {
  conditionRegistry = new Map();
  traceCheckpointsByTarget = new Map();
}

// ---------------------------------------------------------------------------
// Task 1: checkpoint add / delete / list / toggle
// ---------------------------------------------------------------------------

export const handleCheckpointAdd: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_checkpoint_add: arguments must be an object");
  }

  let start: number;
  try {
    start = parseAddress(args.start, { what: "start" });
  } catch (err) {
    return isErrorText(`vice_checkpoint_add: ${describeError(err)}`);
  }

  let end = start;
  if (args.end !== undefined) {
    try {
      end = parseAddress(args.end, { what: "end" });
    } catch (err) {
      return isErrorText(`vice_checkpoint_add: ${describeError(err)}`);
    }
  }
  if (end < start) {
    return isErrorText(`vice_checkpoint_add: end (${end}) must be >= start (${start})`);
  }

  const stop = args.stop === undefined ? true : Boolean(args.stop);
  const acknowledgeTraceRisk = args.acknowledgeTraceRisk === true;
  if (!stop && !acknowledgeTraceRisk) {
    return isErrorText(`vice_checkpoint_add: ${STOP_FALSE_HAZARD_TEXT}`);
  }

  let operation = 0;
  if (args.load === true) operation |= CheckpointOperation.Load;
  if (args.store === true) operation |= CheckpointOperation.Store;
  if (args.exec === true) operation |= CheckpointOperation.Exec;
  let operationDefaulted = false;
  if (operation === 0) {
    operation = CheckpointOperation.Exec;
    operationDefaulted = true;
  }

  // temporary is ALWAYS false in Phase 3 -- the fork exposes no such
  // argument, and vice-sync.ts's "never delete a VICE-marked temporary
  // checkpoint" invariant is a fork-side concern this module never touches.
  const body = checkpointSetBody({ start, end, stop, enabled: true, operation, temporary: false });

  let response;
  try {
    response = await session.client.send(CommandType.CheckpointSet, body);
  } catch (err) {
    return convertWireError("vice_checkpoint_add", err);
  }
  if (response.type !== "checkpoint_info") {
    return isErrorText(`vice_checkpoint_add: unexpected reply type "${response.type}" from CHECKPOINT_SET`);
  }
  const checkpoint: ParsedCheckpoint = response.checkpoint;

  if (!stop) {
    registerTraceCheckpoint(session, checkpoint.id);
  }

  const payload: Record<string, unknown> = {
    id: checkpoint.id,
    start: checkpoint.start,
    end: checkpoint.end,
    stop: checkpoint.stopWhenHit,
    enabled: checkpoint.enabled,
    operation: { value: checkpoint.operation, flags: decodeOperationFlags(checkpoint.operation), defaulted: operationDefaulted },
    temporary: checkpoint.temporary,
    hitCount: checkpoint.hitCount,
    ignoreCount: checkpoint.ignoreCount,
    hasCondition: checkpoint.hasCondition,
    traceMode: !checkpoint.stopWhenHit,
  };
  const autoDisables = autoDisableReportFor(session);
  if (autoDisables.length > 0) payload.autoDisables = autoDisables;
  return stockAnswer(session.client, payload);
};

export const handleCheckpointDelete: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_checkpoint_delete: arguments must be an object");
  }
  let checkpointNum: number;
  try {
    checkpointNum = parseCheckpointNum(args.checkpoint_num);
  } catch (err) {
    return isErrorText(`vice_checkpoint_delete: ${describeError(err)}`);
  }

  try {
    await session.client.send(CommandType.CheckpointDelete, cpNumBody(checkpointNum));
  } catch (err) {
    return convertWireError("vice_checkpoint_delete", err);
  }

  // Remove the checkpoint's entry from the D-10 registry and the trace
  // guard's tables so a re-used id cannot inherit stale state.
  forgetCondition(session, checkpointNum);
  forgetTraceState(session, checkpointNum);

  const payload: Record<string, unknown> = { checkpointNum, deleted: true };
  const autoDisables = autoDisableReportFor(session);
  if (autoDisables.length > 0) payload.autoDisables = autoDisables;
  return stockAnswer(session.client, payload);
};

export const handleCheckpointList: StockSessionHandler = async (_args, session, _deps) => {
  let response;
  try {
    response = await session.client.send(CommandType.CheckpointList);
  } catch (err) {
    return convertWireError("vice_checkpoint_list", err);
  }
  if (response.type !== "checkpoint_list") {
    return isErrorText(`vice_checkpoint_list: unexpected reply type "${response.type}" from CHECKPOINT_LIST`);
  }

  const relatedCheckpoints = response.related.filter(
    (r): r is ParsedCheckpointInfoResponse => r.type === "checkpoint_info",
  );
  const totalReported = response.total;
  const entriesReceived = relatedCheckpoints.length;

  const checkpoints = relatedCheckpoints.map((entry) => {
    const cp = entry.checkpoint;
    const recordedText = conditionTextFor(session, cp.id);
    const out: Record<string, unknown> = {
      id: cp.id,
      start: cp.start,
      end: cp.end,
      stop: cp.stopWhenHit,
      enabled: cp.enabled,
      operation: { value: cp.operation, flags: decodeOperationFlags(cp.operation) },
      temporary: cp.temporary,
      hitCount: cp.hitCount,
      ignoreCount: cp.ignoreCount,
      hasCondition: cp.hasCondition,
      traceMode: !cp.stopWhenHit,
    };
    if (cp.hasCondition) {
      if (recordedText !== undefined) {
        out.condition = recordedText;
        out.conditionTextKnown = true;
      } else {
        out.condition = null;
        out.conditionTextKnown = false;
        out.conditionNote =
          "a condition is attached on the wire but was set outside this session -- stock VICE cannot read " +
          "condition text back";
      }
    } else {
      out.condition = recordedText ?? null;
      out.conditionTextKnown = recordedText !== undefined;
    }
    return out;
  });

  const payload: Record<string, unknown> = { checkpoints, totalReported, entriesReceived };
  const autoDisables = autoDisableReportFor(session);
  if (autoDisables.length > 0) payload.autoDisables = autoDisables;
  return stockAnswer(session.client, payload);
};

export const handleCheckpointToggle: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_checkpoint_toggle: arguments must be an object");
  }
  let checkpointNum: number;
  try {
    checkpointNum = parseCheckpointNum(args.checkpoint_num);
  } catch (err) {
    return isErrorText(`vice_checkpoint_toggle: ${describeError(err)}`);
  }
  if (typeof args.enabled !== "boolean") {
    return isErrorText("vice_checkpoint_toggle: enabled must be a boolean");
  }
  const enabled = args.enabled;

  try {
    await session.client.send(CommandType.CheckpointToggle, checkpointToggleBody({ checkpointNum, enabled }));
  } catch (err) {
    return convertWireError("vice_checkpoint_toggle", err);
  }

  const payload: Record<string, unknown> = { checkpointNum, enabled };
  const autoDisables = autoDisableReportFor(session);
  if (autoDisables.length > 0) payload.autoDisables = autoDisables;
  return stockAnswer(session.client, payload);
};
