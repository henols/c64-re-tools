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
import { CommandType } from "./stock-protocol.ts";
import { runStateFor } from "./stock-runstate.ts";
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
