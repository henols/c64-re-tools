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
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { textConnect, textDisconnect } from "./text-connect.ts";
import type { StockConnectBrokerControl } from "./stock-connect.ts";
import {
  MonitorOwnershipError,
  type ClaimMonitorOutcome,
  type ClaimMonitorOptions,
  type ReleaseMonitorOptions,
  type ReleaseMonitorOutcome,
} from "./vice-broker-client.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Stub broker control -- mirrors stock-connect.test.ts's makeStubBrokerControl().
// ---------------------------------------------------------------------------

interface StubBrokerControlOptions {
  claimOutcome?: ClaimMonitorOutcome;
  releaseOutcome?: ReleaseMonitorOutcome;
}

function makeStubBrokerControl(opts: StubBrokerControlOptions = {}): {
  brokerControl: StockConnectBrokerControl;
  state: { claimCalls: number; releaseCalls: number; claimedWith: ClaimMonitorOptions[]; releasedWith: ReleaseMonitorOptions[] };
} {
  const state = { claimCalls: 0, releaseCalls: 0, claimedWith: [] as ClaimMonitorOptions[], releasedWith: [] as ReleaseMonitorOptions[] };
  const brokerControl: StockConnectBrokerControl = {
    async claimMonitor(claimOpts) {
      state.claimCalls += 1;
      state.claimedWith.push(claimOpts);
      return opts.claimOutcome ?? { ok: true };
    },
    async releaseMonitor(releaseOpts) {
      state.releaseCalls += 1;
      state.releasedWith.push(releaseOpts);
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
      // Plan 41-03 (D-14): textConnect() claims "text" explicitly.
      assert.equal(state.claimedWith[0]?.channel, "text");
      await textDisconnect(session);
      assert.equal(state.releaseCalls, 1);
      assert.equal(state.releasedWith[0]?.channel, "text", "textDisconnect() releases 'text' explicitly");
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
        claimOutcome: { ok: false, reason: "monitor_owned", holder: { grantId: "other-grant", claimedAt: 12345, pid: 999, channel: "text" } },
      });
      await assert.rejects(
        () => textConnect({ host: "127.0.0.1", remoteMonitorPort: port, targetId: "grant-2", brokerControl }),
        (err: unknown) => {
          assert.ok(err instanceof MonitorOwnershipError, `expected MonitorOwnershipError, got ${String(err)}`);
          assert.match((err as Error).message, /already claimed by grant other-grant/);
          assert.equal((err as MonitorOwnershipError).channel, "text", "plan 41-03 (D-14): channel === 'text' on the propagated error");
          assert.doesNotMatch((err as Error).message, /wedge|hang|frozen|stuck|unresponsive/i);
          return true;
        },
      );
      assert.equal(state.claimCalls, 1);
      assert.equal(state.claimedWith[0]?.channel, "text");
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
  assert.equal(state.releasedWith[0]?.channel, "text", "a textConnect() failure releases the text channel, never a binary claim (D-14)");
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

// ---------------------------------------------------------------------------
// Plan 41-03 (D-14): the structural prohibition this plan carries -- no
// module on any halting path reads the broker's per-channel ownership map.
// ---------------------------------------------------------------------------

test("structural (D-14): no module in package.json's files[] other than the four broker-side ones reads the monitorClients identifier", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  // The four broker-side modules named in Task 1 -- promoted there, not
  // read on any halting path. None of these actually appears in files[]
  // today (they are host-bound, compiled to resources/*.mjs, and never
  // published in the shipped tarball), but the exclusion is named
  // explicitly anyway, per the plan's own wording, rather than assumed.
  const BROKER_SIDE = new Set(["broker-state.mts", "broker-control.mts", "broker-launch.mts", "vice-broker.mts"]);
  const offenders: string[] = [];
  for (const rel of pkg.files) {
    if (BROKER_SIDE.has(rel)) continue;
    if (!rel.endsWith(".ts") && !rel.endsWith(".mts")) continue;
    const full = join(HERE, rel);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, "utf8");
    if (text.includes("monitorClients")) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `no halting-path module may read monitorClients: ${JSON.stringify(offenders)}`);
});

test("structural (D-14): git ls-files agrees -- the identifier appears only in the four broker-side modules, their resources/*.mjs artifacts, and InstanceRecord test fixtures", () => {
  const output = execFileSync("git", ["ls-files"], { cwd: HERE, encoding: "utf8" });
  const files = output
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f !== "");
  const ALLOWED = new Set([
    "broker-state.mts",
    "broker-control.mts",
    "broker-launch.mts",
    "vice-broker.mts",
    "resources/broker-state.mjs",
    "resources/broker-control.mjs",
    "resources/broker-launch.mjs",
    "resources/vice-broker.mjs",
    "broker-state.test.ts",
    "broker-control.test.ts",
    "broker-launch.test.ts",
    "broker-kill.test.ts",
    "vice-broker-acquire.test.ts",
    "vice-broker-supervision.test.ts",
    // This structural test's OWN source file, which necessarily contains the
    // literal string "monitorClients" as the identifier it searches for --
    // not a halting-path reference to the field.
    "text-connect.test.ts",
  ]);
  const offenders: string[] = [];
  for (const rel of files) {
    if (ALLOWED.has(rel)) continue;
    if (!/\.(ts|mts|mjs)$/.test(rel)) continue;
    const full = join(HERE, rel);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, "utf8");
    if (text.includes("monitorClients")) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `no halting-path module may read monitorClients: ${JSON.stringify(offenders)}`);
});
