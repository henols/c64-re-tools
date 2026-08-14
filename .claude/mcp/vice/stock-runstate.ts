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

  client.on("event", (item: ParsedResponse | StockProtocolError | StockFramingError) => {
    if (!hasParsedType(item)) {
      return;
    }
    if (item.type === "stopped" || item.type === "jam") {
      state = "stopped";
    } else if (item.type === "resumed") {
      state = "running";
    }
    // Every other event type (checkpoint_info, registers, unknown) leaves
    // state untouched.
  });

  const tracker: RunStateTracker = { get: () => state };
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

/** Test-only: replaces the module-level WeakMap with a fresh one, matching
 * clearHeldStockSession()'s role in stock-dispatch.test.ts's beforeEach()
 * convention. */
export function resetRunStateTrackersForTest(): void {
  trackers = new WeakMap<ViceMonitorClient, RunStateTracker>();
}
