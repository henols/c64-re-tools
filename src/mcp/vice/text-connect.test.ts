#!/usr/bin/env node
// text-connect.test.ts
//
// Claim/connect/release lifecycle unit tests for text-connect.ts, with an
// injected minimal StockConnectBrokerControl stub -- the SAME shape
// stock-connect.test.ts's own makeStubBrokerControl() uses, since
// text-connect.ts deliberately reuses that exact interface (D-14) rather
// than declaring a parallel one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:net";
import type { AddressInfo } from "node:net";

import { textConnect, textDisconnect } from "./text-connect.ts";
import type { StockConnectBrokerControl } from "./stock-connect.ts";
import { MonitorOwnershipError, type ClaimMonitorOutcome, type ReleaseMonitorOutcome } from "./vice-broker-client.ts";

// ---------------------------------------------------------------------------
// Stub broker control -- mirrors stock-connect.test.ts's makeStubBrokerControl().
// ---------------------------------------------------------------------------

interface StubBrokerControlOptions {
  claimOutcome?: ClaimMonitorOutcome;
  releaseOutcome?: ReleaseMonitorOutcome;
}

function makeStubBrokerControl(opts: StubBrokerControlOptions = {}): {
  brokerControl: StockConnectBrokerControl;
  state: { claimCalls: number; releaseCalls: number };
} {
  const state = { claimCalls: 0, releaseCalls: 0 };
  const brokerControl: StockConnectBrokerControl = {
    async claimMonitor() {
      state.claimCalls += 1;
      return opts.claimOutcome ?? { ok: true };
    },
    async releaseMonitor() {
      state.releaseCalls += 1;
      return opts.releaseOutcome ?? { ok: true };
    },
  };
  return { brokerControl, state };
}

// ---------------------------------------------------------------------------
// A minimal stub text-monitor server -- textConnect() only needs the socket
// to accept a connection; no framing exercised here (that is
// text-protocol.test.ts's job).
// ---------------------------------------------------------------------------

async function withStubTextServer<T>(
  handler: (socket: import("node:net").Socket) => void,
  fn: (port: number) => Promise<T>,
): Promise<T> {
  const sockets = new Set<import("node:net").Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    handler(socket);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port);
  } finally {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// ---------------------------------------------------------------------------
// Successful claim/connect/release round trip.
// ---------------------------------------------------------------------------

test("textConnect: claims before dialling, connects, and textDisconnect() releases the claim", async () => {
  await withStubTextServer(
    () => {
      /* accept only -- D-13(a): no bytes expected from the client or server on connect */
    },
    async (port) => {
      const { brokerControl, state } = makeStubBrokerControl();
      const session = await textConnect({ host: "127.0.0.1", remoteMonitorPort: port, targetId: "grant-1", brokerControl });
      assert.equal(state.claimCalls, 1);
      assert.equal(session.targetId, "grant-1");
      assert.equal(session.port, port);
      assert.ok(session.client.connected);
      await textDisconnect(session);
      assert.equal(state.releaseCalls, 1);
      assert.ok(!session.client.connected);
    },
  );
});

// ---------------------------------------------------------------------------
// A claim refusal propagates without a dial being attempted.
// ---------------------------------------------------------------------------

test("textConnect: a monitor_owned claim refusal propagates as MonitorOwnershipError, and no dial is ever attempted", async () => {
  let connectionAttempted = false;
  await withStubTextServer(
    () => {
      connectionAttempted = true;
    },
    async (port) => {
      const { brokerControl, state } = makeStubBrokerControl({
        claimOutcome: { ok: false, reason: "monitor_owned", holder: { grantId: "other-grant", claimedAt: 12345, pid: 999 } },
      });
      await assert.rejects(
        () => textConnect({ host: "127.0.0.1", remoteMonitorPort: port, targetId: "grant-2", brokerControl }),
        (err: unknown) => {
          assert.ok(err instanceof MonitorOwnershipError, `expected MonitorOwnershipError, got ${String(err)}`);
          assert.match((err as Error).message, /already claimed by grant other-grant/);
          return true;
        },
      );
      assert.equal(state.claimCalls, 1);
      // Give any accidental async dial attempt time to land before asserting.
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(connectionAttempted, false, "a refused claim must never reach a socket dial (PROTO-08/D-13)");
    },
  );
});

test("textConnect: a timeout claim outcome is kept strictly distinct from monitor_owned", async () => {
  await withStubTextServer(
    () => {},
    async (port) => {
      const { brokerControl } = makeStubBrokerControl({ claimOutcome: { ok: false, reason: "timeout" } });
      await assert.rejects(
        () => textConnect({ host: "127.0.0.1", remoteMonitorPort: port, targetId: "grant-3", brokerControl }),
        (err: unknown) => {
          assert.ok(!(err instanceof MonitorOwnershipError), "a broker timeout must never be reported as an ownership conflict");
          assert.match((err as Error).message, /monitor claim for target grant-3 failed \(timeout\)/);
          return true;
        },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// A missing or invalid remoteMonitorPort is refused by name.
// ---------------------------------------------------------------------------

test("textConnect: refuses a missing remoteMonitorPort by name, naming targetId, never dialling a guessed port", async () => {
  const { brokerControl, state } = makeStubBrokerControl();
  await assert.rejects(
    () => textConnect({ host: "127.0.0.1", remoteMonitorPort: undefined, targetId: "grant-4", brokerControl }),
    /target grant-4 has no valid text-monitor port recorded/,
  );
  assert.equal(state.claimCalls, 0, "an invalid port must be refused BEFORE any claim is even attempted");
});

test("textConnect: refuses an out-of-range remoteMonitorPort by name", async () => {
  const { brokerControl, state } = makeStubBrokerControl();
  await assert.rejects(
    () => textConnect({ host: "127.0.0.1", remoteMonitorPort: 70000, targetId: "grant-5", brokerControl }),
    /target grant-5 has no valid text-monitor port recorded/,
  );
  assert.equal(state.claimCalls, 0);
});

test("textConnect: refuses a non-integer remoteMonitorPort by name", async () => {
  const { brokerControl } = makeStubBrokerControl();
  await assert.rejects(
    () => textConnect({ host: "127.0.0.1", remoteMonitorPort: 6600.5, targetId: "grant-6", brokerControl }),
    /target grant-6 has no valid text-monitor port recorded/,
  );
});

// ---------------------------------------------------------------------------
// A failure after the claim releases the claim before propagating, with the
// original failure preserved rather than replaced by the release's own.
// ---------------------------------------------------------------------------

test("textConnect: a dial failure after a successful claim releases the claim before propagating", async () => {
  const { brokerControl, state } = makeStubBrokerControl();
  // Port 1 (a real, unused low port that refuses connections outright, not
  // bound by this test) -- forces client.connect() to fail with ECONNREFUSED
  // rather than hang.
  await assert.rejects(
    () => textConnect({ host: "127.0.0.1", remoteMonitorPort: 1, targetId: "grant-7", brokerControl, connectTimeoutMs: 2000 }),
  );
  assert.equal(state.claimCalls, 1, "the claim must have been attempted");
  assert.equal(state.releaseCalls, 1, "a failed dial must release the claim it just took, before propagating");
});

test("textConnect: the ORIGINAL dial failure is preserved even when the release itself also fails", async () => {
  const { brokerControl, state } = makeStubBrokerControl({ releaseOutcome: { ok: false, reason: "internal" } });
  await assert.rejects(
    () => textConnect({ host: "127.0.0.1", remoteMonitorPort: 1, targetId: "grant-8", brokerControl, connectTimeoutMs: 2000 }),
    (err: unknown) => {
      // The original connect failure, never replaced by the release's own
      // { ok: false } outcome -- WR-07's own precedent from stock-connect.ts.
      assert.ok(!(err instanceof MonitorOwnershipError));
      assert.doesNotMatch((err as Error).message, /release/i, "the propagated error must be the dial failure, not a release-failure message");
      return true;
    },
  );
  assert.equal(state.releaseCalls, 1, "the release must still have been ATTEMPTED even though it failed");
});
