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
// conditionSetBody() is imported through its own namespace binding, deliberately
// NOT alongside the encoders above: this keeps the literal identifier
// "conditionSetBody" appearing exactly once in this module's non-comment
// lines (the one call site inside setConditionFailClosed() below), matching
// this file's own "ONE call site" header comment mechanically, not just in
// prose.
import * as StockConditionEncoder from "./stock-protocol.ts";
import {
  emitCondition,
  parseConditionString,
  conditionFromJson,
  StockConditionError,
  type ConditionNode,
} from "./stock-condition.ts";
import { parseAddress, parseByteCount } from "./stock-address.ts";
import { stockAnswer, isErrorText, convertWireError, type StockSessionHandler, type StockToolResult } from "./stock-handler.ts";
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

function recordCondition(session: StockConnectSession, checkpointNum: number, text: string): void {
  conditionMapFor(session).set(checkpointNum, text);
}

function forgetCondition(session: StockConnectSession, checkpointNum: number): void {
  conditionRegistry.get(session.targetId)?.delete(checkpointNum);
}

/** D-09's shared discriminator: an object goes through conditionFromJson(),
 * a string through parseConditionString(). Any other type refuses naming
 * both accepted forms. Reused by handleCheckpointSetCondition and
 * handleWatchAdd so the discrimination logic lives in exactly one place. */
function nodeFromConditionArg(condition: unknown): ConditionNode {
  if (isPlainObject(condition)) {
    return conditionFromJson(condition);
  }
  if (typeof condition === "string") {
    return parseConditionString(condition);
  }
  throw new StockConditionError(
    `condition must be a string (e.g. "A == $42") or a structured condition object, got ${typeof condition}`,
  );
}

// ---------------------------------------------------------------------------
// D-10: fail-closed cleanup. The ONE call site for conditionSetBody() --
// every condition-setting path in this module goes through this helper, so a
// failed CONDITION_SET can never leave a full-range, UNCONDITIONED checkpoint
// armed while the caller believes it is conditioned.
// ---------------------------------------------------------------------------

/**
 * Sends CONDITION_SET for `expression` against `checkpointNum`. On success,
 * returns `null` (the caller records the condition text itself, since only
 * the caller knows whether this is a fresh checkpoint or a rename). On a
 * CONDITION_SET failure, issues CHECKPOINT_DELETE for the SAME checkpoint
 * number before returning -- otherwise a full-range unconditioned breakpoint
 * is left armed and the caller believes it is conditioned. If that
 * CHECKPOINT_DELETE also fails, BOTH failures are named in the one refusal
 * returned -- the second is never swallowed.
 */
async function setConditionFailClosed(
  session: StockConnectSession,
  checkpointNum: number,
  expression: string,
  toolName: string,
): Promise<StockToolResult | null> {
  try {
    await session.client.send(CommandType.ConditionSet, StockConditionEncoder.conditionSetBody({ checkpointNum, expression }));
    return null;
  } catch (setErr) {
    try {
      await session.client.send(CommandType.CheckpointDelete, cpNumBody(checkpointNum));
      return isErrorText(
        `${toolName}: setting the condition on checkpoint ${checkpointNum} failed (${describeError(setErr)}) -- ` +
          `the checkpoint was DELETED to avoid leaving a full-range, UNCONDITIONED breakpoint armed; re-add the ` +
          `checkpoint and try the condition again.`,
      );
    } catch (deleteErr) {
      return isErrorText(
        `${toolName}: setting the condition on checkpoint ${checkpointNum} failed (${describeError(setErr)}), and ` +
          `deleting that checkpoint to clean up ALSO failed (${describeError(deleteErr)}) -- checkpoint ` +
          `${checkpointNum} may still be armed WITHOUT its condition and must be deleted manually.`,
      );
    }
  }
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

// ---------------------------------------------------------------------------
// Task 2: set-condition and watch-add
// ---------------------------------------------------------------------------

export const handleCheckpointSetCondition: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_checkpoint_set_condition: arguments must be an object");
  }
  let checkpointNum: number;
  try {
    checkpointNum = parseCheckpointNum(args.checkpoint_num);
  } catch (err) {
    return isErrorText(`vice_checkpoint_set_condition: ${describeError(err)}`);
  }

  // D-10: conditions are immutable once set -- stock cannot clear or replace
  // one, and a re-set would leak the old text inside VICE.
  const existing = conditionTextFor(session, checkpointNum);
  if (existing !== undefined) {
    return isErrorText(
      `vice_checkpoint_set_condition: checkpoint ${checkpointNum} already has a condition set ("${existing}") -- ` +
        `stock VICE cannot clear or replace a condition once attached (re-setting it would leak the old condition ` +
        `inside VICE); delete this checkpoint and re-add it with the new condition instead.`,
    );
  }

  let node: ConditionNode;
  let expression: string;
  try {
    node = nodeFromConditionArg(args.condition);
    expression = emitCondition(node);
  } catch (err) {
    // A StockConditionError is returned as its own refusal text verbatim --
    // never re-worded, and never a fallback to sending the raw input.
    if (err instanceof StockConditionError) {
      return isErrorText(err.message);
    }
    return isErrorText(`vice_checkpoint_set_condition: ${describeError(err)}`);
  }

  const failure = await setConditionFailClosed(session, checkpointNum, expression, "vice_checkpoint_set_condition");
  if (failure) return failure;

  recordCondition(session, checkpointNum, expression);

  const payload: Record<string, unknown> = { checkpointNum, condition: expression, immutable: true };
  const autoDisables = autoDisableReportFor(session);
  if (autoDisables.length > 0) payload.autoDisables = autoDisables;
  return stockAnswer(session.client, payload);
};

export const handleWatchAdd: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_watch_add: arguments must be an object");
  }

  let address: number;
  try {
    address = parseAddress(args.address, { what: "address" });
  } catch (err) {
    return isErrorText(`vice_watch_add: ${describeError(err)}`);
  }

  let size = 1;
  if (args.size !== undefined) {
    try {
      size = parseByteCount(args.size, { max: 0x100, what: "size" });
    } catch (err) {
      return isErrorText(`vice_watch_add: ${describeError(err)}`);
    }
  }

  const watchType = args.type === undefined ? "write" : args.type;
  let operation: number;
  if (watchType === "read") operation = CheckpointOperation.Load;
  else if (watchType === "write") operation = CheckpointOperation.Store;
  else if (watchType === "both") operation = CheckpointOperation.Load | CheckpointOperation.Store;
  else {
    return isErrorText(`vice_watch_add: type must be one of "read", "write", "both", got ${JSON.stringify(watchType)}`);
  }

  const end = address + size - 1;
  if (end > 0xffff) {
    return isErrorText(`vice_watch_add: address (${address}) + size (${size}) - 1 = ${end} exceeds 0xffff`);
  }

  const stop = args.stop === undefined ? true : Boolean(args.stop);
  const acknowledgeTraceRisk = args.acknowledgeTraceRisk === true;
  if (!stop && !acknowledgeTraceRisk) {
    return isErrorText(`vice_watch_add: ${STOP_FALSE_HAZARD_TEXT}`);
  }

  // Validate/emit the condition BEFORE arming anything -- a condition that
  // fails to emit must never result in a CHECKPOINT_SET being sent at all.
  let expression: string | undefined;
  if (args.condition !== undefined) {
    try {
      const node = nodeFromConditionArg(args.condition);
      expression = emitCondition(node);
    } catch (err) {
      if (err instanceof StockConditionError) {
        return isErrorText(err.message);
      }
      return isErrorText(`vice_watch_add: ${describeError(err)}`);
    }
  }

  const body = checkpointSetBody({ start: address, end, stop, enabled: true, operation, temporary: false });
  let response;
  try {
    response = await session.client.send(CommandType.CheckpointSet, body);
  } catch (err) {
    return convertWireError("vice_watch_add", err);
  }
  if (response.type !== "checkpoint_info") {
    return isErrorText(`vice_watch_add: unexpected reply type "${response.type}" from CHECKPOINT_SET`);
  }
  const checkpoint: ParsedCheckpoint = response.checkpoint;

  if (expression !== undefined) {
    const failure = await setConditionFailClosed(session, checkpoint.id, expression, "vice_watch_add");
    if (failure) return failure;
    recordCondition(session, checkpoint.id, expression);
  }

  if (!stop) {
    registerTraceCheckpoint(session, checkpoint.id);
  }

  const payload: Record<string, unknown> = {
    id: checkpoint.id,
    start: checkpoint.start,
    end: checkpoint.end,
    watchType,
    size,
    operation: { value: checkpoint.operation, flags: decodeOperationFlags(checkpoint.operation) },
    stop: checkpoint.stopWhenHit,
    enabled: checkpoint.enabled,
    condition: expression ?? null,
    hitCount: checkpoint.hitCount,
    hasCondition: checkpoint.hasCondition,
    traceMode: !checkpoint.stopWhenHit,
  };
  const autoDisables = autoDisableReportFor(session);
  if (autoDisables.length > 0) payload.autoDisables = autoDisables;
  return stockAnswer(session.client, payload);
};
