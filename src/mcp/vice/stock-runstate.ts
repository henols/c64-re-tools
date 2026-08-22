#!/usr/bin/env node
// stock-runstate.ts
//
// THE ONE projection of the binary-monitor event stream into a derived run
// state (D-06). Nothing else in this tree decides whether the emulator is
// running or stopped -- every stock tool answer reports this exact value,
// stamped by stock-handler.ts's stockAnswer().
//
// WHY THIS FILE EXISTS: D-05 means the client never issues an EXIT the
// agent did not ask for, so an agent has no round trip that would otherwise
// tell it what the machine is doing right now. The ONLY honest source for
// that is the event stream itself -- STOPPED (0x62) / RESUMED (0x63) / JAM
// (0x61), all arriving at request id 0xffffffff -- never the command the
// client just sent, and never an assumption made at connect time (D-07).
// stock-connect.ts's resolveCapabilities() is the closest structural
// precedent (settle-once, cache-on-session), but that is a one-shot probe;
// this is a continuously-updated event projection, and the two must not be
// confused or share a mechanism.
//
// WHAT NOT TO DO:
//   - Never infer run state from a command this client just sent. D-06
//     requires the projection come ONLY from the wire's own
//     stopped/resumed/jam events -- never "we just sent EXIT so it must be
//     running now".
//   - Never assert "stopped" at connect. stock-connect.ts's own handshake
//     halts the machine with a bare PING and resumes it with its own EXIT
//     (CR-02) -- projecting THAT internal pair as the user's own run state
//     is exactly the dishonesty D-07 forbids. attachRunStateTracker() is
//     called by a later plan's dispatch seam, never from inside
//     stockConnect() itself.
//   - Never attach a second 'event' listener to the same client
//     (RESEARCH.md Pitfall 4). attachRunStateTracker() is idempotent via a
//     module-level WeakMap, closing this structurally rather than by
//     call-site discipline.
//   - Never call client.send() from inside the listener -- the standing
//     "never send from inside the event handler" rule. A read-only
//     projection can never itself cause a state change.
import type { ParsedResponse, StockFramingError, StockProtocolError, ViceMonitorClient } from "./stock-protocol.ts";

export type RunState = "running" | "stopped" | "unknown";

export interface RunStateTracker {
  get(): RunState;
  /** WR-04: true once a JAM (0x61) event has been seen on this client's wire,
   * and never reset -- a jam is a latching fact about this instance, not a
   * transient state. Kept SEPARATE from `get()` on purpose: a jam and a
   * plain STOPPED both leave the run state "stopped", but only one of them
   * means the CPU will never execute another instruction, and only one of
   * them is recovered by a reset rather than a recycle. Collapsing the two
   * (which this file used to do) threw the distinction away at its only
   * consumer, after stock-protocol.ts went to the trouble of parsing JAM's
   * zero-length body without fabricating a PC. */
  jamObserved(): boolean;
}

let trackers = new WeakMap<ViceMonitorClient, RunStateTracker>();

/** True iff `item` is a parsed response/event shape carrying a `.type`
 * discriminant -- narrows out the two wire-error classes ViceMonitorClient's
 * 'event' channel can also carry (a wire error at a broadcast request id),
 * which have no `.type` field at all. */
function hasParsedType(item: ParsedResponse | StockProtocolError | StockFramingError): item is ParsedResponse {
  return "type" in item;
}

/**
 * Attaches a run-state tracker to `client`, or returns the existing one if
 * one is already attached -- idempotent, registers no second listener. The
 * returned tracker's `get()` starts at "unknown" (D-07) and moves only on
 * the wire's own stopped/resumed/jam events; there is no setter and no
 * exported mutator, so the listener is the sole writer (D-06's "projection,
 * never derived from the commands sent").
 */
export function attachRunStateTracker(client: ViceMonitorClient): RunStateTracker {
  const existing = trackers.get(client);
  if (existing) {
    return existing;
  }

  let state: RunState = "unknown";
  // WR-04: latched, never cleared -- not even by a subsequent RESUMED. A CPU
  // that has jammed stays a machine whose evidence must mention the jam; the
  // recovery is vice_machine_reset, and nothing on this wire can undo the
  // fact that a jam happened on this instance.
  let jamSeen = false;

  client.on("event", (item: ParsedResponse | StockProtocolError | StockFramingError) => {
    if (!hasParsedType(item)) {
      return;
    }
    if (item.type === "jam") {
      // A jam halts the CPU, so the run state is "stopped" as before -- but
      // the jam itself is recorded separately rather than being collapsed
      // into it and lost.
      jamSeen = true;
      state = "stopped";
    } else if (item.type === "stopped") {
      state = "stopped";
    } else if (item.type === "resumed") {
      state = "running";
    }
    // Every other event type (checkpoint_info, registers, unknown) leaves
    // state untouched.
  });

  const tracker: RunStateTracker = { get: () => state, jamObserved: () => jamSeen };
  trackers.set(client, tracker);
  return tracker;
}

/** Reads the run state for `client` -- "unknown" when nothing is attached,
 * never a throw: a handler must be able to answer even on a client nothing
 * has attached a tracker to. Reading is free and side-effect-free (D-08),
 * so pause/resume can short-circuit on it without sending anything. */
export function runStateFor(client: ViceMonitorClient): RunState {
  const tracker = trackers.get(client);
  return tracker ? tracker.get() : "unknown";
}

/** WR-04: whether a JAM (0x61) has been observed on `client`'s wire -- `false`
 * when nothing is attached, never a throw, same contract as runStateFor().
 *
 * WHY THIS IS SEPARATE FROM runStateFor(): the two jamaction settings produce
 * opposite-looking symptoms from the same underlying dead CPU, and neither is
 * distinguishable from the run state alone.
 *   - `-jamaction 2` (Monitor): the machine stops, both liveness brackets
 *     read zero advance, and vice_diagnose answers `wedged` -- whose
 *     documented response is `vice_recycle`, i.e. destroy the instance, when
 *     a vice_machine_reset recovers a jam. Same shape as the
 *     `checkpoint_trap` hazard the wedge-triage SKILL already warns about.
 *   - default jamaction (continue): the emulator keeps burning cycles
 *     refetching the same opcode, so BOTH brackets advance and vice_diagnose
 *     answers `live` -- for a machine that will never execute another
 *     instruction.
 * The JAM frame that settles it arrived on the wire in both cases. This is
 * how it stops being discarded. It is reported as EVIDENCE on the existing
 * verdicts, never as a sixth verdict (D-03). */
export function jamObservedFor(client: ViceMonitorClient): boolean {
  const tracker = trackers.get(client);
  return tracker ? tracker.jamObserved() : false;
}

/** Test-only: replaces the module-level WeakMap with a fresh one, matching
 * clearHeldStockSession()'s role in stock-dispatch.test.ts's beforeEach()
 * convention. */
export function resetRunStateTrackersForTest(): void {
  trackers = new WeakMap<ViceMonitorClient, RunStateTracker>();
}
