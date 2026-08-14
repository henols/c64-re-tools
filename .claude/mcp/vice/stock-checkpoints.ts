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
// This file was built up task by task (three tasks in this plan): Task 1
// adds checkpoint add/delete/list/toggle plus the D-10 condition registry's
// read/write/delete plumbing those handlers call into; Task 2 adds
// condition-setting (set-condition, watch-add, the fail-closed cleanup, and
// condition immutability); Task 3 (this file's current state) adds the D-11
// trace guard's real rate limiting and deferred auto-disable, below.
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
//   - Never send from inside the trace guard's 'event' listener -- the
//     listener does pure arithmetic only (window counting, threshold check);
//     the disabling CHECKPOINT_TOGGLE is deferred out of that call stack (one
//     deferral site below) so a synchronous flood of hits can never itself
//     trigger a synchronous send back onto the same blocking socket.
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
  type ViceMonitorClient,
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
// D-11: the trace guard for `stop:false` checkpoints. Per-client state (a
// checkpoint id is only ever unique within one emulator instance), attached
// idempotently to the client's own 'event' stream -- exactly one listener per
// client, matching stock-runstate.ts's attachRunStateTracker() discipline.
//
// Planner decision (RESEARCH.md Focus Item 5 offered two designs): the
// disabling toggle send is deferred out of the event-listener's call stack
// via the platform's own next-turn scheduling primitive (the one call site
// below) rather than a next-dispatch check, because the flood this guards
// against is synchronous and blocking the emulator thread -- promptness is
// the point, and waiting for the agent's next unrelated tool call could be
// arbitrarily long. RESEARCH.md flags this as an assumption (A4); the probe
// debt is filed under .planning/todos/pending/.
// ---------------------------------------------------------------------------

/** Deliberately conservative first guess -- change this single constant if
 * empirical testing against real hardware shows a different threshold is
 * appropriate. */
export const TRACE_HITS_PER_SECOND_LIMIT = 20;

interface TraceWindow {
  windowStartMs: number;
  hits: number;
}

interface AutoDisabledEntry {
  reason: string;
  at: number;
  hitsPerSecond: number;
}

interface TraceGuardState {
  traceCheckpoints: Set<number>;
  window: Map<number, TraceWindow>;
  disableScheduled: Set<number>;
  autoDisabled: Map<number, AutoDisabledEntry>;
  now: () => number;
}

let traceGuards = new WeakMap<ViceMonitorClient, TraceGuardState>();

function isCheckpointInfoEvent(item: unknown): item is ParsedCheckpointInfoResponse {
  return isPlainObject(item) && item.type === "checkpoint_info" && isPlainObject(item.checkpoint);
}

function attachTraceGuardListener(client: ViceMonitorClient, state: TraceGuardState): void {
  client.on("event", (item: unknown) => {
    if (!isCheckpointInfoEvent(item)) return;
    const id = item.checkpoint.id;
    if (!state.traceCheckpoints.has(id)) return;

    // Pure arithmetic only, below this point until the deferred callback --
    // no I/O, no send(), no await. The window rolls forward when the last
    // window started 1000ms or more ago.
    const now = state.now();
    let w = state.window.get(id);
    if (!w || now - w.windowStartMs >= 1000) {
      w = { windowStartMs: now, hits: 0 };
      state.window.set(id, w);
    }
    w.hits += 1;

    if (w.hits > TRACE_HITS_PER_SECOND_LIMIT && !state.disableScheduled.has(id)) {
      state.disableScheduled.add(id);
      const observedHitsPerSecond = w.hits;
      // The ONE deferral site in this module: schedules the disabling
      // CHECKPOINT_TOGGLE for the NEXT turn of the event loop, out of this
      // listener's own call stack. See the header comment above this
      // section for why a deferred send, not a next-dispatch check.
      setImmediate(() => {
        void (async () => {
          try {
            await client.send(CommandType.CheckpointToggle, checkpointToggleBody({ checkpointNum: id, enabled: false }));
            state.autoDisabled.set(id, {
              reason:
                `auto-disabled: exceeded ${TRACE_HITS_PER_SECOND_LIMIT} hits/second on a stop:false trace ` +
                `checkpoint (observed ~${observedHitsPerSecond}/s) -- a non-stopping checkpoint emits ` +
                `CHECKPOINT_INFO synchronously from inside the emulator's CPU loop and can deadlock this client ` +
                `on a hot address`,
              at: state.now(),
              hitsPerSecond: observedHitsPerSecond,
            });
          } catch (err) {
            // Must never throw out of this callback -- there is no handler
            // above a bare callback queued this way, and doing so would
            // reach vice-proxy.ts's never-throw boundary with nothing to
            // catch it.
            state.autoDisabled.set(id, {
              reason: `auto-disable send failed: ${describeError(err)}`,
              at: state.now(),
              hitsPerSecond: observedHitsPerSecond,
            });
          } finally {
            state.disableScheduled.delete(id);
          }
        })();
      });
    }
  });
}

function traceGuardStateFor(client: ViceMonitorClient, now: () => number): TraceGuardState {
  let state = traceGuards.get(client);
  if (!state) {
    state = {
      traceCheckpoints: new Set(),
      window: new Map(),
      disableScheduled: new Set(),
      autoDisabled: new Map(),
      now,
    };
    traceGuards.set(client, state);
    attachTraceGuardListener(client, state);
  }
  return state;
}

/** Arms the trace guard for `checkpointId` on `session`'s client -- attaches
 * the guard's single 'event' listener idempotently (one listener per client,
 * exactly like attachRunStateTracker()), then adds the id to the watched
 * set. `opts.now` is a test-only clock override; production callers never
 * pass it (the default is the platform clock). */
export function registerTraceCheckpoint(session: StockConnectSession, checkpointId: number, opts: { now?: () => number } = {}): void {
  const nowFn = opts.now ?? Date.now;
  const state = traceGuardStateFor(session.client, nowFn);
  state.traceCheckpoints.add(checkpointId);
}

function forgetTraceState(session: StockConnectSession, checkpointNum: number): void {
  const state = traceGuards.get(session.client);
  if (!state) return;
  state.traceCheckpoints.delete(checkpointNum);
  state.window.delete(checkpointNum);
  state.disableScheduled.delete(checkpointNum);
  state.autoDisabled.delete(checkpointNum);
}

/** Read by every handler in this module just before answering, so an
 * auto-disable is surfaced in the very next answer as `autoDisables: [...]`
 * (the caller omits the key entirely when this returns an empty array). */
export function autoDisableReportFor(
  session: StockConnectSession,
): Array<{ checkpointNum: number; reason: string; at: number; hitsPerSecond: number }> {
  const state = traceGuards.get(session.client);
  if (!state) return [];
  return Array.from(state.autoDisabled.entries()).map(([checkpointNum, entry]) => ({ checkpointNum, ...entry }));
}

/** Test-only: resets the condition registry and every trace-guard table
 * together, matching resetRunStateTrackersForTest()'s role in
 * stock-runstate.ts. */
export function resetCheckpointStateForTest(): void {
  conditionRegistry = new Map();
  traceGuards = new WeakMap();
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

  // WR-01 (03-REVIEW.md): a STRICT type check, never Boolean() coercion.
  // vice-proxy.ts's rawJsonSchemaAsStandardSchema() wraps every manifest
  // inputSchema with a validate that performs no actual type checking, so a
  // type-mismatched argument reaches this handler untouched and these checks
  // are the ONLY enforcement there is. `Boolean("false")` is `true`, so the
  // old coercion silently turned a caller's `stop: "false"` -- a plausible
  // shape for an LLM-driven MCP client that formats values as strings -- into
  // the opposite of the non-stopping trace mode it asked for, with no error
  // and no warning. Every other boolean-shaped argument in this file and in
  // its sibling family modules already refuses a non-boolean outright; this
  // one was the sole exception.
  if (args.stop !== undefined && typeof args.stop !== "boolean") {
    return isErrorText(`vice_checkpoint_add: stop must be a boolean, got ${typeof args.stop}`);
  }
  const stop = args.stop === undefined ? true : args.stop;
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

  const traceState = traceGuards.get(session.client);

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
    const autoDisabled = traceState?.autoDisabled.get(cp.id);
    if (autoDisabled) {
      out.autoDisabled = { reason: autoDisabled.reason, at: autoDisabled.at, hitsPerSecond: autoDisabled.hitsPerSecond };
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

  let autoDisableCleared = false;
  if (enabled) {
    const state = traceGuards.get(session.client);
    if (state?.autoDisabled.has(checkpointNum)) {
      state.autoDisabled.delete(checkpointNum);
      autoDisableCleared = true;
    }
  }

  const payload: Record<string, unknown> = { checkpointNum, enabled };
  if (autoDisableCleared) payload.autoDisableCleared = true;
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

  // WR-01 (03-REVIEW.md): strict, for exactly the reason handleCheckpointAdd's
  // own identical check above spells out -- `Boolean("false")` is `true`, and
  // nothing upstream of this handler type-checks the argument.
  if (args.stop !== undefined && typeof args.stop !== "boolean") {
    return isErrorText(`vice_watch_add: stop must be a boolean, got ${typeof args.stop}`);
  }
  const stop = args.stop === undefined ? true : args.stop;
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
