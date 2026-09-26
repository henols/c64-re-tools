// stock-session-fixtures.ts
//
// WHY THIS FILE EXISTS: the lease and session stubs that stock-session.test.ts
// and stock-tools.test.ts share. Test-only; it is not shipped.
//
// WHAT NOT TO DO:
//   - Never import this module from production code.
import { EventEmitter } from "node:events";

import type { HeldLease, BrokerControlSession } from "./vice-broker-client.ts";
import type { StockConnectSession } from "./stock-connect.ts";

export const STUB_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
  noteOperation: async () => ({ ok: true as const }),
} as unknown as BrokerControlSession;

// stockConnect()'s own StockConnectOptions.brokerControl (and
// StockConnectSession.brokerControl) is typed as the narrower
// StockConnectBrokerControl (claimMonitor/releaseMonitor only) -- aliased off
// StockConnectSession itself, so a value satisfying HeldLease.brokerControl
// (the wider BrokerControlSession) still satisfies this narrower field.
type FakeSessionBrokerControl = StockConnectSession["brokerControl"];

/** Builds a HeldLease from the four coordinates a test actually cares about,
 * defaulting the capability-cache directory. Tests that care about it pass
 * it explicitly. */
export function makeLease(opts: Omit<HeldLease, "supervisorDir"> & Partial<Pick<HeldLease, "supervisorDir">>): HeldLease {
  return { supervisorDir: "", ...opts };
}

/** The fake client carries a REAL disconnect() that flips `connected` to
 * false (CR-05), and is a real EventEmitter because attachRunStateTracker()
 * calls `client.on("event", ...)` at every fresh connect/reconnect. */
export function fakeSession(opts: { targetId: string; host: string; port: number; brokerControl: FakeSessionBrokerControl; connected?: boolean }): StockConnectSession {
  const client = Object.assign(new EventEmitter(), {
    connected: opts.connected ?? true,
    disconnect: async (): Promise<void> => {
      client.connected = false;
    },
  });
  return {
    client: client as unknown as StockConnectSession["client"],
    versionQuad: "3.9.0",
    capabilities: { cpuHistory: "absent" },
    host: opts.host,
    port: opts.port,
    targetId: opts.targetId,
    brokerControl: opts.brokerControl,
    deps: {},
    baselineEpoch: null,
  };
}
