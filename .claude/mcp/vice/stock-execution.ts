#!/usr/bin/env node
// stock-execution.ts
//
// Family C (DIRECT-04/DIRECT-05): pause, resume, step, and the stock-only
// `vice_execution_until_return`. Ships `handleExecutionPause`,
// `handleExecutionRun`, `handleExecutionStep`, and
// `handleExecutionUntilReturn` as `StockSessionHandler`s -- dispatch-table
// and manifest wiring belong to plans 03-12/03-13, not here.
//
// WHY THIS FILE EXISTS: docs/phase0-binmon-findings.md §4 -- ANY inbound byte
// halts the emulated machine (`monitor_startup_trap()` runs every vsync), so
// a bare PING (0x81) is the documented, side-effect-minimal way to trigger a
// halt on demand, and EXIT (0xaa) is the ONLY thing that resumes it. D-05
// means this client never sends an unrequested EXIT, which in turn means an
// agent has no round trip that tells it what the machine is doing right now
// except the wire's own STOPPED/RESUMED events -- stock-runstate.ts's
// projection (D-06). D-08's idempotence is the load-bearing property this
// module exists to guarantee: a duplicate resume after an event race must
// never restart a machine the agent believes it already paused.
//
// WHAT NOT TO DO:
//   - Never send EXIT from any handler other than handleExecutionRun (D-05
//     -- the agent's explicit resume request is the only licence). Grep-gated
//     to exactly one `CommandType.Exit` occurrence in this file's code lines.
//   - Never infer the run state from the command this module just sent
//     (D-06) -- always read runStateFor(session.client), never assume.
//   - Never assert "stopped" after a handshake (D-07) -- stock-connect.ts's
//     own PING/EXIT pair is internal bookkeeping, not the user's run state.
//   - Never construct an ok-answer outside stockAnswer() -- that is exactly
//     how an answer ships without the `runState` D-06 requires on every
//     stock tool answer.
//   - The roadmap's "cool resumes down" note (a separate rate limiter on
//     resume frequency) is deliberately NOT implemented here -- D-08's
//     short-circuit is the whole answer (CONTEXT.md's "Not taken"). Revisit
//     only if a resume storm is observed against a real emulator.
import {
  CommandType,
  advanceInstructionsBody,
  type ParsedResponse,
  type ResolvedResponse,
  type StockFramingError,
  type StockProtocolError,
  type ViceMonitorClient,
} from "./stock-protocol.ts";
import { runStateFor, type RunState } from "./stock-runstate.ts";
import { parseByteCount, StockAddressError } from "./stock-address.ts";
import { convertWireError, isErrorText, stockAnswer, type StockErrorResult, type StockSessionHandler } from "./stock-handler.ts";

/**
 * Awaits exactly one macrotask so a STOPPED/RESUMED frame that arrived in
 * the same socket chunk as a command's reply has been demuxed and projected
 * into stock-runstate.ts's tracker before this module reads it. This is a
 * best-effort ordering nicety, NOT a guarantee: if the event genuinely has
 * not arrived yet, the answer reports whatever the projection honestly
 * holds -- including "unknown" -- and never asserts a state the wire did
 * not report.
 */
async function settleEvents(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/** True iff `item` is a parsed response/event shape carrying a `.type`
 * discriminant -- the same narrowing stock-runstate.ts uses to filter out
 * the two wire-error classes ViceMonitorClient's 'event' channel can also
 * carry. */
function hasParsedType(item: ParsedResponse | StockProtocolError | StockFramingError): item is ParsedResponse {
  return "type" in item;
}

/**
 * A scoped, single-call capture of the last STOPPED/RESUMED event's program
 * counter observed while awaiting a step/until-return round trip. This is
 * NOT a second persistent tracker -- RESEARCH.md Pitfall 4 is about
 * attachRunStateTracker()'s own idempotent-attach guarantee, a different
 * concern from a listener that is attached immediately before send() and
 * ALWAYS removed via `finish()` right after settleEvents() resolves, so it
 * never outlives a single handler invocation and never accumulates
 * listeners across calls.
 *
 * REGISTER_INFO-based program-counter extraction is deliberately NOT
 * implemented here: mapping a register id to "this is the PC" requires the
 * register name/id catalog Family A (plans 03-06/03-07) owns, which is not
 * a dependency of this plan. Only a STOPPED/RESUMED event's own
 * `programCounter` field is used.
 */
function beginProgramCounterCapture(client: ViceMonitorClient): { finish(): number | undefined } {
  let programCounter: number | undefined;
  const listener = (item: ParsedResponse | StockProtocolError | StockFramingError) => {
    if (hasParsedType(item) && (item.type === "stopped" || item.type === "resumed")) {
      programCounter = item.programCounter;
    }
  };
  client.on("event", listener);
  return {
    finish: () => {
      client.off("event", listener);
      return programCounter;
    },
  };
}

/** Reads a program counter off a resolved reply itself, when the parsed
 * shape happens to carry one (it does not, today, for AdvanceInstructions/
 * ExecuteUntilReturn -- both fall through to the "unknown" shape in
 * stock-protocol.ts's parser -- but this stays a narrow, defensive check
 * rather than a hardcoded "never" so a future parser extension is picked up
 * for free). */
function programCounterFromReply(response: ResolvedResponse): number | undefined {
  return "programCounter" in response && typeof response.programCounter === "number" ? response.programCounter : undefined;
}

/** Refuses an argument object carrying any key outside `allowed`, naming the
 * offending key -- the one place every handler in this file checks its own
 * argument surface, rather than each handler re-deriving the check. */
function refuseUnexpectedArgs(args: Record<string, unknown>, allowed: string[], toolName: string): StockErrorResult | null {
  const allowedSet = new Set(allowed);
  const extra = Object.keys(args).find((key) => !allowedSet.has(key));
  if (extra === undefined) {
    return null;
  }
  const accepts = allowed.length === 0 ? "no arguments" : `only: ${allowed.join(", ")}`;
  return isErrorText(`${toolName}: unexpected argument "${extra}" -- this tool accepts ${accepts}.`);
}

/**
 * D-07's gate, implemented once for both stepping tools: when `state` is
 * "unknown" nothing on the wire has yet reported a STOPPED or RESUMED
 * transition on this connection, so stepping could either step a halted CPU
 * or race a running one, producing a program counter the agent would
 * otherwise have no reason to distrust. Names the exact next action
 * (`vice_execution_pause`/`vice_execution_run`) and states explicitly that
 * this gate applies ONLY to the execution-control tools -- memory, register
 * and checkpoint tools run freely while the state is unknown -- so an agent
 * reading the refusal does not conclude the whole backend is unusable.
 * Returns `null` (no refusal) for both "running" and "stopped".
 */
function refuseIfUnknown(state: RunState, toolName: string): StockErrorResult | null {
  if (state !== "unknown") {
    return null;
  }
  return isErrorText(
    `${toolName}: the derived run state is "unknown" -- nothing on the wire has reported a STOPPED or RESUMED ` +
      `transition on this connection yet. Stepping a machine whose state is unknown could either step an already-` +
      `halted CPU or race a still-running one, producing a program counter that should not be trusted. Call ` +
      `vice_execution_pause or vice_execution_run first to establish a known state. This gate applies ONLY to the ` +
      `execution-control tools (pause/run/step/until-return) -- memory, register and checkpoint tools run freely ` +
      `while the state is unknown.`,
  );
}

/**
 * `vice_execution_pause` -- bare PING (0x81), no body. D-08: when the
 * derived state is already "stopped", sends NOTHING and answers with an
 * explicit already-in-that-state marker -- an agent retry after an event
 * race must never issue a second halt. While the state is "running" OR
 * "unknown" the command IS sent: "unknown" has nothing to short-circuit
 * against, so it is deliberately NOT treated as "do nothing".
 */
export const handleExecutionPause: StockSessionHandler = async (args, session) => {
  const unexpected = refuseUnexpectedArgs(args, [], "vice_execution_pause");
  if (unexpected) {
    return unexpected;
  }

  const stateBefore = runStateFor(session.client);

  if (stateBefore === "stopped") {
    return stockAnswer(session.client, {
      requested: "pause",
      sent: false,
      alreadyStopped: true,
      note: "the machine was already halted (derived run state \"stopped\") -- no command was issued",
      stateBefore,
    });
  }

  try {
    await session.client.send(CommandType.Ping);
  } catch (err) {
    return convertWireError("vice_execution_pause", err);
  }
  await settleEvents();
  return stockAnswer(session.client, { requested: "pause", sent: true, alreadyStopped: false, stateBefore });
};

/**
 * `vice_execution_run` -- EXIT (0xaa), no body. This is the ONE handler in
 * the whole phase permitted to send EXIT, and it does so only because the
 * agent explicitly asked to resume (D-05). D-08: when the derived state is
 * already "running", sends NOTHING and answers with an explicit
 * already-in-that-state marker. While "stopped" or "unknown" the command IS
 * sent.
 */
export const handleExecutionRun: StockSessionHandler = async (args, session) => {
  const unexpected = refuseUnexpectedArgs(args, [], "vice_execution_run");
  if (unexpected) {
    return unexpected;
  }

  const stateBefore = runStateFor(session.client);

  if (stateBefore === "running") {
    return stockAnswer(session.client, {
      requested: "run",
      sent: false,
      alreadyRunning: true,
      note: "the machine was already running (derived run state \"running\") -- no command was issued",
      stateBefore,
    });
  }

  try {
    await session.client.send(CommandType.Exit);
  } catch (err) {
    return convertWireError("vice_execution_run", err);
  }
  await settleEvents();
  return stockAnswer(session.client, { requested: "run", sent: true, alreadyRunning: false, stateBefore });
};

/**
 * `vice_execution_step` -- ADVANCE_INSTRUCTIONS (0x71), body
 * `stepOver(1) count(u16LE)` via advanceInstructionsBody(). Refuses while
 * the derived run state is "unknown" (D-07, via refuseIfUnknown()).
 *
 * `stepOver: true`'s runtime semantic (skip a JSR's subroutine as one step)
 * is [ASSUMED] -- RESEARCH.md Assumptions Log row A2 -- never probed against
 * a real JSR. See `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md`
 * for the outstanding probe debt. This is NOT claimed as verified here.
 */
export const handleExecutionStep: StockSessionHandler = async (args, session) => {
  const unexpected = refuseUnexpectedArgs(args, ["count", "stepOver"], "vice_execution_step");
  if (unexpected) {
    return unexpected;
  }

  const stateBefore = runStateFor(session.client);
  const refusal = refuseIfUnknown(stateBefore, "vice_execution_step");
  if (refusal) {
    return refusal;
  }

  let count: number;
  try {
    count = args.count === undefined ? 1 : parseByteCount(args.count, { max: 0xffff, what: "vice_execution_step: count" });
  } catch (err) {
    return isErrorText(err instanceof StockAddressError ? err.message : `vice_execution_step: ${String(err)}`);
  }

  if (args.stepOver !== undefined && typeof args.stepOver !== "boolean") {
    return isErrorText(`vice_execution_step: stepOver must be a boolean, got ${typeof args.stepOver}`);
  }
  const stepOver = args.stepOver === true;

  const body = advanceInstructionsBody({ stepOver, count });

  const capture = beginProgramCounterCapture(session.client);
  let response: ResolvedResponse;
  try {
    response = await session.client.send(CommandType.AdvanceInstructions, body);
  } catch (err) {
    capture.finish();
    return convertWireError("vice_execution_step", err);
  }
  await settleEvents();
  const programCounter = programCounterFromReply(response) ?? capture.finish();

  const payload: Record<string, unknown> = { requested: "step", count, stepOver, stateBefore };
  if (programCounter !== undefined) {
    payload.programCounter = programCounter;
  }
  return stockAnswer(session.client, payload);
};

/**
 * `vice_execution_until_return` -- EXECUTE_UNTIL_RETURN (0x73), EMPTY body
 * (never invent an encoder for this opcode). This tool has NO fork
 * counterpart: the planner's stock-only naming choice, recorded in the
 * plan's own objective under Phase 2's D-07 ("stock advertises tools the
 * fork doesn't"), following the existing `vice_execution_*` convention and
 * reading as the operation rather than as a value. `vice_execution_step`'s
 * `stepOver` is a DIFFERENT operation (step over a call vs. run out of the
 * current one) -- do not later "unify" the two. Refuses while the derived
 * run state is "unknown" (D-07, via refuseIfUnknown()), identically to
 * `vice_execution_step`.
 */
export const handleExecutionUntilReturn: StockSessionHandler = async (args, session) => {
  const unexpected = refuseUnexpectedArgs(args, [], "vice_execution_until_return");
  if (unexpected) {
    return unexpected;
  }

  const stateBefore = runStateFor(session.client);
  const refusal = refuseIfUnknown(stateBefore, "vice_execution_until_return");
  if (refusal) {
    return refusal;
  }

  const capture = beginProgramCounterCapture(session.client);
  let response: ResolvedResponse;
  try {
    response = await session.client.send(CommandType.ExecuteUntilReturn);
  } catch (err) {
    capture.finish();
    return convertWireError("vice_execution_until_return", err);
  }
  await settleEvents();
  const programCounter = programCounterFromReply(response) ?? capture.finish();

  const payload: Record<string, unknown> = { requested: "untilReturn", stateBefore };
  if (programCounter !== undefined) {
    payload.programCounter = programCounter;
  }
  return stockAnswer(session.client, payload);
};
