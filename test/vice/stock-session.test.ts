// stock-session.test.ts
//
// stock-session.ts: lease-to-session acquisition (ensureStockSession()),
// reconnect and teardown, the run-state tracker attach points, and the two
// runners (runBinary()/runPure()) including the binary channel lock (CHAN-04).
// Every test here is offline -- no broker process, no emulator.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer, connect as netConnect, type Socket, type AddressInfo } from "node:net";
import { join } from "node:path";

import {
  ensureStockSession,
  clearHeldStockSession,
  stockDisconnect,
  runBinary,
  runPure,
  grantEpochReader,
  type StockSessionDeps,
} from "../../src/mcp/vice/stock-session.ts";
import { callStockTool } from "./stock-call.ts";
import { STUB_BROKER_CONTROL, makeLease, fakeSession } from "./stock-session-fixtures.ts";
import type { DerivedPureHandler } from "../../src/mcp/vice/stock-handler.ts";
import { encodeResponseFrame } from "./binmon-fixtures.ts";
import { MachineRestartedError } from "../../src/mcp/vice/vice-errors.mts";
import { MonitorOwnershipError } from "../../src/mcp/vice/vice-broker-client.ts";
import type { HeldLease, BrokerControlSession } from "../../src/mcp/vice/vice-broker-client.ts";
import { stockConnect, type StockConnectSession, type StockConnectOptions, type DialMonitorSocketFn } from "../../src/mcp/vice/stock-connect.ts";
import { resetRunStateTrackersForTest } from "../../src/mcp/vice/stock-runstate.ts";
import type { StockSessionHandler } from "../../src/mcp/vice/stock-handler.ts";
import { resetBankCatalogsForTest } from "../../src/mcp/vice/stock-memory.ts";
import { resetRegisterCatalogsForTest } from "../../src/mcp/vice/stock-registers.ts";
import { currentChannelLockHolder, resetChannelLockForTests } from "../../src/mcp/vice/channel-lock.ts";
import {
  resetCheckpointStateForTest,
  handleCheckpointSetCondition,
  conditionTextFor,
  _conditionRegistryTargetsForTest,
} from "../../src/mcp/vice/stock-checkpoints.ts";


beforeEach(() => {
  clearHeldStockSession();
  resetRunStateTrackersForTest();
  // Task 3 (plan 03-13): the conformance harness below dispatches through
  // the real path, which means the family modules' own per-session/
  // per-target caches (bank catalog, register catalog, the D-10 condition
  // registry) are genuinely populated -- reset them here too so no
  // conformance case can observe a stale catalog left by a prior test.
  resetBankCatalogsForTest();
  resetRegisterCatalogsForTest();
  resetCheckpointStateForTest();
  // Plan 41-02 (CHAN-04): channel-lock.ts's mutex is process-wide module
  // state, exactly like the resets above -- reset it here too so a lock
  // held (or a queued waiter) left by a prior test can never leak into the
  // next one.
  resetChannelLockForTests();
});

/** Adapters that turn a handler into a (args, deps) runner, for tests that
 * exercise the two runners through a handler of their own. */
function asBinary(toolName: string, handler: StockSessionHandler) {
  return (args: Record<string, unknown>, deps: StockSessionDeps) => runBinary(toolName, handler, args, deps);
}
function asPure(toolName: string, handler: DerivedPureHandler) {
  return (args: Record<string, unknown>, deps: StockSessionDeps) => runPure(toolName, handler, args, deps);
}

test("lease: ensureLease is awaited strictly before stockConnect is ever called (lease-before-connect ordering)", async () => {
  let counter = 0;
  let leaseCallIndex = -1;
  let connectCallIndex = -1;
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => {
      leaseCallIndex = counter++;
      return { ok: true, lease };
    },
    connect: async (opts) => {
      connectCallIndex = counter++;
      return fakeSession(opts);
    },
  };
  const outcome = await ensureStockSession(deps);
  assert.ok(outcome.ok);
  assert.ok(leaseCallIndex >= 0 && connectCallIndex >= 0);
  assert.ok(leaseCallIndex < connectCallIndex, "ensureLease must be awaited before stockConnect is called");
});

test("lease: stockConnect receives the exact host/port/targetId/brokerControl the lease provider returned", async () => {
  const brokerControl = { ...STUB_BROKER_CONTROL };
  const lease: HeldLease = makeLease({ host: "10.0.0.5", port: 9002, targetId: "grant-42", brokerControl });
  const receivedCalls: StockConnectOptions[] = [];
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => {
      receivedCalls.push(opts);
      return fakeSession(opts);
    },
  };
  const outcome = await ensureStockSession(deps);
  assert.ok(outcome.ok);
  assert.equal(receivedCalls.length, 1, "stockConnect must be called exactly once");
  const received = receivedCalls[0]!;
  assert.strictEqual(received.host, lease.host);
  assert.strictEqual(received.port, lease.port);
  assert.strictEqual(received.targetId, lease.targetId);
  assert.strictEqual(received.brokerControl, lease.brokerControl);
});

test("lease: a provider failure never calls stockConnect and its message passes through verbatim", async () => {
  let connectCalls = 0;
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: false, message: "broker: dead_or_hung" }),
    connect: async (opts) => {
      connectCalls++;
      return fakeSession(opts);
    },
  };
  const outcome = await ensureStockSession(deps);
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { ok: false; message: string }).message, "broker: dead_or_hung");
  assert.equal(connectCalls, 0);
});

test("lease: a lease of null (the VICE_MCP_URL override) never calls stockConnect and names VICE_MCP_URL in the refusal", async () => {
  let connectCalls = 0;
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease: null }),
    connect: async (opts) => {
      connectCalls++;
      return fakeSession(opts);
    },
  };
  const outcome = await ensureStockSession(deps);
  assert.equal(outcome.ok, false);
  assert.match((outcome as { ok: false; message: string }).message, /VICE_MCP_URL/);
  assert.equal(connectCalls, 0);
});

test("lease: two overlapping first calls share one lease and one connect", async () => {
  let leaseCalls = 0;
  let connectCalls = 0;
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-overlap", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => {
      leaseCalls++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true, lease };
    },
    connect: async (opts) => {
      connectCalls++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return fakeSession(opts);
    },
  };
  const [first, second] = await Promise.all([ensureStockSession(deps), ensureStockSession(deps)]);
  assert.ok(first.ok && second.ok);
  assert.strictEqual(first.session, second.session);
  assert.equal(leaseCalls, 1);
  assert.equal(connectCalls, 1);
});

test("lease: a failed first attempt is not remembered, so the next call tries again", async () => {
  let leaseCalls = 0;
  const deps: StockSessionDeps = {
    ensureLease: async () => {
      leaseCalls++;
      return { ok: false, message: "broker: not running" };
    },
  };
  await ensureStockSession(deps);
  await ensureStockSession(deps);
  assert.equal(leaseCalls, 2);
});

test("lease: two successive calls with the same targetId call stockConnect exactly once -- the held session is reused", async () => {
  let connectCalls = 0;
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => {
      connectCalls++;
      return fakeSession(opts);
    },
  };
  const first = await ensureStockSession(deps);
  const second = await ensureStockSession(deps);
  assert.ok(first.ok && second.ok);
  assert.equal(connectCalls, 1);
});

test("lease: a replacement acquisition naming a different targetId calls stockConnect a second time", async () => {
  let connectCalls = 0;
  const leaseA: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl: STUB_BROKER_CONTROL });
  const leaseB: HeldLease = makeLease({ host: "127.0.0.1", port: 6503, targetId: "grant-2", brokerControl: STUB_BROKER_CONTROL });
  let currentLease: HeldLease = leaseA;
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease: currentLease }),
    connect: async (opts) => {
      connectCalls++;
      return fakeSession(opts);
    },
  };
  const first = await ensureStockSession(deps);
  currentLease = leaseB;
  const second = await ensureStockSession(deps);
  assert.ok(first.ok && second.ok);
  assert.equal(connectCalls, 2);
});

// ---------------------------------------------------------------------------
// CR-06 (code review 2026-08-13): production never passed StockConnectDeps, so
// `baselineEpoch` was always null (making stockReconnect() throw a FALSE
// MachineRestartedError on every transient drop) and the BACK-04 capability
// cache was never read or written. The existing tests above could not see it
// because they only assert on the four coordinates. These assert on `deps`.
// ---------------------------------------------------------------------------

/** A broker control whose `status` reply lists the given instances. */
function brokerControlWithStatus(
  instances: Array<{ port: number; epoch: number | null; grantId: string | null }> | "fail",
): BrokerControlSession {
  return {
    ...STUB_BROKER_CONTROL,
    status: async () =>
      instances === "fail"
        ? { ok: false as const, kind: "closed" as const, message: "control connection closed" }
        : { ok: true as const, instances: instances.map((i) => ({ url: "", state: "granted", reason: "", ...i })) },
  } as unknown as BrokerControlSession;
}

test("CR-06: the lease's supervisorDir, an epoch reader and the settled binary path all reach stockConnect as deps", async () => {
  const received: StockConnectOptions[] = [];
  const lease = makeLease({
    host: "127.0.0.1",
    port: 6502,
    targetId: "grant-deps-1",
    brokerControl: brokerControlWithStatus([{ port: 6502, epoch: 3, grantId: "grant-deps-1" }]),
    supervisorDir: "/ws/.vice-supervisor",
  });
  const outcome = await ensureStockSession({
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => {
      received.push(opts);
      return fakeSession(opts);
    },
    resolvedBinaryPath: "/usr/bin/x64sc",
  });
  assert.ok(outcome.ok);
  assert.equal(received.length, 1);
  const { readCurrentEpoch, ...rest } = received[0]!.deps!;
  assert.deepEqual(rest, { supervisorDir: "/ws/.vice-supervisor", binPath: "/usr/bin/x64sc" });
  assert.equal(typeof readCurrentEpoch, "function");
  assert.equal(await readCurrentEpoch!(), 3);
});

test("grantEpochReader: reads the epoch of the instance THIS grant owns, over the broker's status reply", async () => {
  const control = brokerControlWithStatus([
    { port: 6600, epoch: 9, grantId: "someone-else" },
    { port: 6601, epoch: 2, grantId: "grant-mine" },
    { port: 6602, epoch: 5, grantId: null },
  ]);
  assert.equal(await grantEpochReader(control, "grant-mine")(), 2);
  assert.equal(await grantEpochReader(control, "grant-absent")(), null, "no owned entry is not a match");
  assert.equal(await grantEpochReader(control, "")(), null, "an empty grant id owns nothing");
  assert.equal(await grantEpochReader(brokerControlWithStatus([{ port: 6601, epoch: null, grantId: "grant-mine" }]), "grant-mine")(), null);
  assert.equal(await grantEpochReader(brokerControlWithStatus("fail"), "grant-mine")(), null, "a failed status call reads as no epoch");
});

test("CR-06: an empty lease field is threaded as ABSENT, never as an empty-string path", async () => {
  const received: StockConnectOptions[] = [];
  const lease = makeLease({ host: "127.0.0.1", port: 6504, targetId: "grant-deps-3", brokerControl: STUB_BROKER_CONTROL });
  await ensureStockSession({
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => {
      received.push(opts);
      return fakeSession(opts);
    },
  });
  assert.deepEqual(Object.keys(received[0]!.deps!), ["readCurrentEpoch"], "no supervisorDir, no binPath -- absent, not empty strings");
});

test("CR-06: the real stockConnect, driven against a loopback binmon stub through ensureStockSession, records a non-null baselineEpoch", async () => {
  // The one test in this file that uses the REAL stockConnect -- because the
  // defect was precisely that the real function never received `deps`. The
  // emulator is a loopback stub answering the four handshake commands; no
  // broker process and no x64sc are involved.
  const dir = mkdtempSync(join(tmpdir(), "stock-session-cr06-"));

  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length < 11) break;
        const bodyLength = buf.readUInt32LE(2);
        const total = 11 + bodyLength;
        if (buf.length < total) break;
        const requestId = buf.readUInt32LE(6);
        const commandType = buf[10]!;
        buf = buf.subarray(total);
        if (commandType === 0x85) {
          // VICE_INFO: [len][3,9,0,0][svnLen]
          socket.write(encodeResponseFrame({ responseType: 0x85, errorCode: 0x00, requestId, body: Buffer.from([4, 3, 9, 0, 0, 0]) }));
        } else if (commandType === 0x86) {
          // CPUHISTORY_GET: plan 07-02 added a real body parser (need()-
          // guarded, requiring at least the 4-byte count field on an OK
          // reply) where this stub previously sent a zero-length body no
          // real stock build would ever produce -- an OK reply always
          // carries at least count(u32LE), even for zero entries
          // (monitor_binary.c:1563-1617). count(u32LE) = 0 here.
          socket.write(encodeResponseFrame({ responseType: 0x86, errorCode: 0x00, requestId, body: Buffer.alloc(4) }));
        } else {
          socket.write(encodeResponseFrame({ responseType: commandType, errorCode: 0x00, requestId }));
        }
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;

  try {
    const lease = makeLease({
      host: "127.0.0.1",
      port,
      targetId: "grant-real-1",
      brokerControl: brokerControlWithStatus([{ port, epoch: 7, grantId: "grant-real-1" }]),
      supervisorDir: dir,
    });
    // Phase 63 (SESS-02): stockConnect()'s default socket source is now a
    // relay dial against a broker that is not running in this test process.
    // This test is specifically about the REAL stockConnect handshake, not
    // about the socket source, so `connect` is wrapped with a
    // dialMonitorSocket that dials the loopback stub server above directly
    // -- byte-identical handshake behaviour to the pre-relay direct dial
    // this replaces.
    const directDialMonitorSocket: DialMonitorSocketFn = (opts) =>
      new Promise((resolve, reject) => {
        const socket = netConnect({ host: opts.host, port: opts.port });
        socket.once("connect", () => resolve({ socket, pending: Buffer.alloc(0) }));
        socket.once("error", reject);
      });
    const outcome = await ensureStockSession({
      ensureLease: async () => ({ ok: true, lease }),
      connect: (opts) => stockConnect({ ...opts, deps: { dialMonitorSocket: directDialMonitorSocket, ...opts.deps } }),
    });
    assert.ok(outcome.ok, `expected a live session: ${JSON.stringify(outcome)}`);
    assert.equal(outcome.session.baselineEpoch, 7, "the reconnect baseline must be the epoch the broker reports for this grant, not null");
    assert.equal(outcome.session.versionQuad, "3.9.0.0");
    await stockDisconnect(outcome.session);
    clearHeldStockSession();
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// CR-05 (code review 2026-08-13): a replaced lease must TEAR DOWN the outgoing
// session, not merely drop the reference. The holder is module-private, so the
// reference is the last handle anything has on that socket and its broker-side
// monitor claim; and stock VICE services exactly ONE binmon client, so a
// leaked socket keeps occupying the instance's single client slot.
// ---------------------------------------------------------------------------

test("CR-05: a replacement acquisition disconnects the replaced session and releases ITS monitor claim, naming the old targetId", async () => {
  const releasedTargets: string[] = [];
  const brokerControl = {
    claimMonitor: async () => ({ ok: true as const }),
    releaseMonitor: async (opts: { targetId: string }) => {
      releasedTargets.push(opts.targetId);
      return { ok: true as const };
    },
  } as unknown as BrokerControlSession;

  const leaseA: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl });
  const leaseB: HeldLease = makeLease({ host: "127.0.0.1", port: 6503, targetId: "grant-2", brokerControl });
  let currentLease: HeldLease = leaseA;
  const sessions: StockConnectSession[] = [];
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease: currentLease }),
    connect: async (opts) => {
      const session = fakeSession(opts);
      sessions.push(session);
      return session;
    },
  };

  const first = await ensureStockSession(deps);
  assert.ok(first.ok);
  const stale = sessions[0]!;
  assert.equal(stale.client.connected, true, "precondition: the first session is live");

  currentLease = leaseB;
  const second = await ensureStockSession(deps);
  assert.ok(second.ok);

  assert.equal(stale.client.connected, false, "the replaced session's socket must be disconnected, not merely dereferenced");
  assert.deepEqual(releasedTargets, ["grant-1"], "exactly one releaseMonitor, naming the OLD targetId -- never the replacement's");
  assert.equal(second.session.targetId, "grant-2");
  assert.equal(second.session.client.connected, true, "the replacement session must be live");
});

test("CR-05: a teardown failure on the replaced session does not stop the replacement handshake, and never leaves the dead session held", async () => {
  const brokerControl = {
    claimMonitor: async () => ({ ok: true as const }),
    releaseMonitor: async () => {
      throw new Error("test: broker refused the release");
    },
  } as unknown as BrokerControlSession;

  const leaseA: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl });
  const leaseB: HeldLease = makeLease({ host: "127.0.0.1", port: 6503, targetId: "grant-2", brokerControl });
  let currentLease: HeldLease = leaseA;
  let connectCalls = 0;
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease: currentLease }),
    connect: async (opts) => {
      connectCalls++;
      return fakeSession(opts);
    },
  };

  assert.ok((await ensureStockSession(deps)).ok);
  currentLease = leaseB;
  const second = await ensureStockSession(deps);
  assert.ok(second.ok, "a failed teardown of the OUTGOING session must not fail the replacement");
  assert.equal(second.session.targetId, "grant-2");
  assert.equal(connectCalls, 2);

  // And the holder now names the replacement -- a third call with lease B
  // reuses it rather than reconnecting.
  const third = await ensureStockSession(deps);
  assert.ok(third.ok);
  assert.equal(connectCalls, 2, "the replacement must be the held session, so a third call reuses it");
});

// ---------------------------------------------------------------------------
// WR-03 (03-REVIEW.md): the wiring half of the condition-registry eviction
// hook. stock-checkpoints.test.ts owns the hook's own semantics; these two
// assert that this seam CALLS it at the one right moment and at no other --
// the "correct module, never called" failure shape this module tree has been
// bitten by before.
// ---------------------------------------------------------------------------

/** fakeSession() plus the `send` a condition-setting handler needs -- the
 * dispatch harness's own client has no send() because nothing else in this
 * file's tests reaches a family handler. */
function conditionCapableSession(opts: Parameters<typeof fakeSession>[0]): StockConnectSession {
  const session = fakeSession(opts);
  (session.client as unknown as { send: unknown }).send = async () => ({ type: "condition_set" as const });
  return session;
}

test("WR-03: a fresh handshake for a NEW targetId evicts the abandoned target's condition-registry entry", async () => {
  const leaseA: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl: STUB_BROKER_CONTROL });
  const leaseB: HeldLease = makeLease({ host: "127.0.0.1", port: 6503, targetId: "grant-2", brokerControl: STUB_BROKER_CONTROL });
  let currentLease: HeldLease = leaseA;
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease: currentLease }),
    connect: async (opts) => conditionCapableSession(opts),
  };

  const first = await ensureStockSession(deps);
  assert.ok(first.ok);
  const recorded = await handleCheckpointSetCondition({ checkpoint_num: 1, condition: "A == $42" }, first.session, deps);
  assert.equal(recorded.isError, false, `setup: the condition must be recorded, got ${recorded.content[0]!.text}`);
  assert.deepEqual(_conditionRegistryTargetsForTest(), ["grant-1"], "setup: the first target's condition is registered");

  currentLease = leaseB;
  const second = await ensureStockSession(deps);
  assert.ok(second.ok);
  assert.equal(second.session.targetId, "grant-2");
  assert.deepEqual(
    _conditionRegistryTargetsForTest(),
    [],
    "WR-03 REGRESSION: the abandoned target's condition map is still held, so the registry grows one entry per instance the broker ever hands this process",
  );
});

test("WR-03: reusing the held session for the SAME targetId never evicts its conditions", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => conditionCapableSession(opts),
  };

  const first = await ensureStockSession(deps);
  assert.ok(first.ok);
  assert.equal((await handleCheckpointSetCondition({ checkpoint_num: 1, condition: "A == $42" }, first.session, deps)).isError, false);

  const second = await ensureStockSession(deps);
  assert.ok(second.ok);
  assert.equal(second.session, first.session, "precondition: this must be the reuse branch, not a fresh handshake");
  assert.deepEqual(_conditionRegistryTargetsForTest(), ["grant-1"], "the live target's registry entry must never be evicted underneath it");
  assert.equal(conditionTextFor(second.session, 1), "(A == $42)", "and its recorded condition text must still be readable");
});

test("CR-05: a FIRST acquisition with nothing held releases nothing -- no spurious releaseMonitor", async () => {
  const releasedTargets: string[] = [];
  const brokerControl = {
    claimMonitor: async () => ({ ok: true as const }),
    releaseMonitor: async (opts: { targetId: string }) => {
      releasedTargets.push(opts.targetId);
      return { ok: true as const };
    },
  } as unknown as BrokerControlSession;
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl });
  const outcome = await ensureStockSession({
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  });
  assert.ok(outcome.ok);
  assert.deepEqual(releasedTargets, []);
});

test("lease: a held session whose socket has closed is re-established via stockReconnect, not silently reused", async () => {
  let connectCalls = 0;
  let reconnectCalls = 0;
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-9", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => {
      connectCalls++;
      return fakeSession({ ...opts, connected: false });
    },
    reconnect: async (session) => {
      reconnectCalls++;
      return fakeSession({ targetId: session.targetId, host: session.host, port: session.port, brokerControl: session.brokerControl, connected: true });
    },
  };
  const first = await ensureStockSession(deps);
  assert.ok(first.ok);
  const second = await ensureStockSession(deps);
  assert.ok(second.ok);
  assert.equal(connectCalls, 1);
  assert.equal(reconnectCalls, 1);
});

test("lease: MachineRestartedError out of a held session's reconnect clears the holder so the next call re-handshakes", async () => {
  let connectCalls = 0;
  let reconnectCalls = 0;
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-9", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => {
      connectCalls++;
      return fakeSession({ ...opts, connected: false });
    },
    reconnect: async () => {
      reconnectCalls++;
      throw new MachineRestartedError("test: machine restarted across reconnect", { baselineEpoch: 1, currentEpoch: 2 });
    },
  };
  await ensureStockSession(deps); // connects, holds a session whose client reports not connected
  await assert.rejects(() => ensureStockSession(deps), MachineRestartedError);
  const third = await ensureStockSession(deps); // holder was cleared on the rejection -- re-handshakes from scratch
  assert.ok(third.ok);
  assert.equal(connectCalls, 2);
  assert.equal(reconnectCalls, 1);
});

// ---------------------------------------------------------------------------
// Task 1 (plan 03-12): the runState tracker attach points (RESEARCH.md
// Pitfall 4) -- attached at exactly the two branches that produce a FRESH
// ViceMonitorClient, never in the `heldSession.client.connected` reuse
// branch. Every client below is the same real-EventEmitter fakeSession()
// stub every other test in this file uses; `listenerCount("event")` is the
// literal proof a second attach never registers a second listener.
// ---------------------------------------------------------------------------

test("runState/Pitfall4: a fresh connect attaches exactly one 'event' listener to the new client", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-tracker-1", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  };
  const outcome = await ensureStockSession(deps);
  assert.ok(outcome.ok);
  assert.equal(outcome.session.client.listenerCount("event"), 1);
});

test("runState/Pitfall4: a session-reuse call (same targetId, still connected) does NOT add a second listener", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-tracker-2", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  };
  const first = await ensureStockSession(deps);
  const second = await ensureStockSession(deps);
  assert.ok(first.ok && second.ok);
  assert.equal(first.session.client, second.session.client, "precondition: the reuse branch returns the SAME client");
  assert.equal(second.session.client.listenerCount("event"), 1, "the reuse branch must never call attachRunStateTracker a second time");
});

test("runState/Pitfall4: a reconnect (socket dead) attaches exactly one listener to the NEW client from stockReconnect", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-tracker-3", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession({ ...opts, connected: false }),
    reconnect: async (session) => fakeSession({ targetId: session.targetId, host: session.host, port: session.port, brokerControl: session.brokerControl, connected: true }),
  };
  await ensureStockSession(deps); // connects, holds a not-connected session (no tracker assertion here -- see the fresh-connect test above)
  const second = await ensureStockSession(deps); // triggers the reconnect branch
  assert.ok(second.ok);
  assert.equal(second.session.client.listenerCount("event"), 1);
});

// ---------------------------------------------------------------------------
// runBinary() -- the runner for every tool that needs the binary session.
// ---------------------------------------------------------------------------

test("runBinary: returns convertHandshakeError's text when ensureStockSession throws MonitorOwnershipError", async () => {
  const handler: StockSessionHandler = async () => {
    throw new Error("must not be called -- the handshake itself failed");
  };
  const wrapped = asBinary("vice_test_tool", handler);
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease: makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-wss-1", brokerControl: STUB_BROKER_CONTROL }) }),
    connect: async () => {
      throw new MonitorOwnershipError("stockConnect: monitor for target grant-wss-1 on port 6502 is already claimed by grant grant-other", {
        holderGrantId: "grant-other",
        holderClaimedAt: 1700000000000,
        port: 6502,
      });
    },
  };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /grant-other/);
});

test("runBinary: returns outcome.message verbatim on an { ok: false } refusal, without touching the handler", async () => {
  let handlerCalled = false;
  const handler: StockSessionHandler = async () => {
    handlerCalled = true;
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  const wrapped = asBinary("vice_test_tool", handler);
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: false, message: "broker: dead_or_hung (verbatim message)" }),
  };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /broker: dead_or_hung \(verbatim message\)/);
  assert.equal(handlerCalled, false, "a refusal must never reach the delegated handler");
});

test("runBinary: a family handler that throws yields isError:true rather than propagating", async () => {
  const handler: StockSessionHandler = async () => {
    throw new Error("boom: something the family handler let escape");
  };
  const wrapped = asBinary("vice_test_tool", handler);
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-wss-3", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /vice_test_tool/);
  assert.match(JSON.stringify(result.content), /boom: something the family handler let escape/);
});

// ---------------------------------------------------------------------------
// runPure() -- the runner for a tool that takes no binary session or lock.
// Every deps.ensureLease
// below that must never be called is a THROWING stub, never a spy that
// merely records -- an unreachable stub proves the pure branch never
// touches the wire far more strongly than a call counter would.
// ---------------------------------------------------------------------------

const THROWING_ENSURE_LEASE: StockSessionDeps["ensureLease"] = async () => {
  throw new Error("ensureLease must never be called for this test");
};

test("runPure: invokes the handler with (args, deps) and never calls ensureLease", async () => {
  let receivedArgs: Record<string, unknown> | undefined;
  const handler: DerivedPureHandler = async (args) => {
    receivedArgs = args;
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  const wrapped = asPure("vice_disassemble", handler);
  const deps: StockSessionDeps = { ensureLease: THROWING_ENSURE_LEASE };
  const result = await wrapped({ address: "$c000" }, deps);
  assert.equal(result.isError, false);
  assert.deepEqual(receivedArgs, { address: "$c000" });
});

test("runBinary: delegates to ensureStockSession and hands the handler the resolved session", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-derived-1", brokerControl: STUB_BROKER_CONTROL });
  let receivedSession: StockConnectSession | undefined;
  const handler: StockSessionHandler = async (_args, session) => {
    receivedSession = session;
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  const wrapped = asBinary("vice_disassemble", handler);
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, false);
  assert.ok(receivedSession);
  assert.equal(receivedSession!.targetId, "grant-derived-1");
});

test("runPure: a handler that throws is converted via convertWireError, not propagated", async () => {
  const handler: DerivedPureHandler = async () => {
    throw new Error("boom: something the derived handler let escape");
  };
  const wrapped = asPure("vice_disassemble", handler);
  const deps: StockSessionDeps = { ensureLease: THROWING_ENSURE_LEASE };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /vice_disassemble/);
  assert.match(JSON.stringify(result.content), /boom: something the derived handler let escape/);
});

test("runBinary: converts a handshake failure via convertHandshakeError, naming the tool", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-derived-2", brokerControl: STUB_BROKER_CONTROL });
  const handler: StockSessionHandler = async () => {
    throw new Error("must not be called -- the handshake itself failed");
  };
  const wrapped = asBinary("vice_disassemble", handler);
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async () => {
      throw new MonitorOwnershipError("stockConnect: monitor for target grant-derived-2 on port 6502 is already claimed by grant grant-other", {
        holderGrantId: "grant-other",
        holderClaimedAt: 1700000000000,
        port: 6502,
      });
    },
  };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /vice_disassemble/);
  assert.match(JSON.stringify(result.content), /grant-other/);
});

test("runBinary: returns an { ok: false } lease refusal verbatim, without touching the handler", async () => {
  let handlerCalled = false;
  const handler: StockSessionHandler = async () => {
    handlerCalled = true;
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  const wrapped = asBinary("vice_disassemble", handler);
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: false, message: "broker: dead_or_hung (verbatim message)" }),
  };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /broker: dead_or_hung \(verbatim message\)/);
  assert.equal(handlerCalled, false, "a refusal must never reach the delegated handler");
});

// ---------------------------------------------------------------------------
// Plan 41-02 (CHAN-04): runBinary routes through channel-lock.ts's mutex via
// withChannelLockHeld(), and runPure does not.
// ---------------------------------------------------------------------------

test("CHAN-04: runBinary reaches acquireChannelLock and runPure does not", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-chan04-1", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  };

  // A single mutable holder object, rather than separate `let` bindings, so
  // TypeScript's control-flow narrowing does not collapse each observation
  // to its initial value -- it only tracks a plain `let`'s last
  // DIRECTLY-VISIBLE assignment in its own declaring scope, ignoring
  // assignments made inside a nested closure (see
  // stock-a4-checkpoint-flood.test.ts's own identical note).
  const observed: {
    duringStockSession: ReturnType<typeof currentChannelLockHolder>;
    duringDerivedTrue: ReturnType<typeof currentChannelLockHolder>;
    duringDerivedFalse: ReturnType<typeof currentChannelLockHolder> | "unset";
  } = { duringStockSession: null, duringDerivedTrue: null, duringDerivedFalse: "unset" };

  const stockSessionHandler: StockSessionHandler = async () => {
    observed.duringStockSession = currentChannelLockHolder();
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  await asBinary("vice_probe_stock_session", stockSessionHandler)({}, deps);
  assert.ok(observed.duringStockSession, "runBinary must hold the lock while the handler runs");
  assert.equal(observed.duringStockSession!.channel, "binary");
  assert.equal(observed.duringStockSession!.operation, "vice_probe_stock_session");
  assert.equal(currentChannelLockHolder(), null, "the lock must be released once runBinary's handler returns");

  const derivedTrueHandler: StockSessionHandler = async () => {
    observed.duringDerivedTrue = currentChannelLockHolder();
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  await asBinary("vice_disassemble", derivedTrueHandler)({}, deps);
  assert.ok(observed.duringDerivedTrue, "runBinary must hold the lock while the handler runs");
  assert.equal(observed.duringDerivedTrue!.channel, "binary");
  assert.equal(observed.duringDerivedTrue!.operation, "vice_disassemble");
  assert.equal(currentChannelLockHolder(), null);

  const derivedFalseHandler: DerivedPureHandler = async () => {
    observed.duringDerivedFalse = currentChannelLockHolder();
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  await asPure("vice_symbols_lookup", derivedFalseHandler)({}, deps);
  assert.equal(observed.duringDerivedFalse, null, "runPure must NEVER acquire the lock -- it never touches the wire");
  assert.equal(currentChannelLockHolder(), null);
});

test("CHAN-04: calling vice_symbols_lookup (pure) through the REAL tool list leaves currentChannelLockHolder() null throughout", async () => {
  const deps: StockSessionDeps = { ensureLease: THROWING_ENSURE_LEASE };
  assert.equal(currentChannelLockHolder(), null);
  const result = await callStockTool("vice_symbols_lookup", { name: "main" }, deps);
  assert.equal(result.isError, false);
  assert.equal(currentChannelLockHolder(), null, "vice_symbols_lookup is pure client-side -- it must never acquire halt authority");
});

test("CHAN-04: a handler that throws leaves currentChannelLockHolder() null after dispatch returns", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-chan04-2", brokerControl: STUB_BROKER_CONTROL });
  const handler: StockSessionHandler = async () => {
    throw new Error("boom: the handler let this escape");
  };
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  };
  const result = await asBinary("vice_probe_throwing", handler)({}, deps);
  assert.equal(result.isError, true);
  assert.equal(currentChannelLockHolder(), null, "the lock must be released even when the delegated handler throws (release-on-throw, D-05)");
});

test("CHAN-04: a second concurrent dispatch of a session-taking tool with a 1ms channelLockTimeoutMs override is refused with channelLockRefusalMessage()'s own wording, byte-identical, with none of the forbidden words", async () => {
  let releaseFirstHandler: (() => void) | null = null;
  const firstHandlerGate = new Promise<void>((resolve) => {
    releaseFirstHandler = resolve;
  });
  const firstHandler: StockSessionHandler = async () => {
    await firstHandlerGate;
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  const secondHandler: StockSessionHandler = async () => {
    throw new Error("must not be called -- the second dispatch must be refused before reaching this handler");
  };

  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-chan04-3", brokerControl: STUB_BROKER_CONTROL });
  const firstDeps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  };
  const secondDeps: StockSessionDeps = { ...firstDeps, channelLockTimeoutMs: 1 };

  const firstPromise = asBinary("vice_probe_first_holder", firstHandler)({}, firstDeps);
  // Give the first dispatch a turn to acquire the lock and enter its
  // (still-gated) handler before the second dispatch attempts to acquire.
  await new Promise((resolve) => setTimeout(resolve, 5));
  const holderDuringSecond = currentChannelLockHolder();
  assert.ok(holderDuringSecond, "the first dispatch must be holding the lock by the time the second one is attempted");
  assert.equal(holderDuringSecond!.channel, "binary");
  assert.equal(holderDuringSecond!.operation, "vice_probe_first_holder");

  const secondResult = await asBinary("vice_probe_second_tool", secondHandler)({}, secondDeps);
  assert.equal(secondResult.isError, true);
  const refusalText = JSON.parse(JSON.stringify(secondResult.content))[0].text as string;
  const expectedShape = /^channel-lock: the binary channel currently holds halt authority \(operation "vice_probe_first_holder", grant unknown, held for \d+ms\) -- this call must wait for that channel to release before it can proceed$/;
  assert.match(refusalText, expectedShape, `expected byte-identical channelLockRefusalMessage() wording, got: ${JSON.stringify(refusalText)}`);
  const lower = refusalText.toLowerCase();
  for (const forbidden of ["wedge", "wedged", "hang", "hung", "frozen", "stuck", "unresponsive"]) {
    assert.ok(!lower.includes(forbidden), `refusal text must not contain "${forbidden}": ${refusalText}`);
  }

  releaseFirstHandler!();
  const firstResult = await firstPromise;
  assert.equal(firstResult.isError, false);
  assert.equal(currentChannelLockHolder(), null);
});
