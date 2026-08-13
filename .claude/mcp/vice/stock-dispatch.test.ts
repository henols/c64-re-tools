// node:test coverage of stock-dispatch.ts. Task 1: the manifest selector
// (manifestPathForBackend()) and the two committed manifests it chooses
// between. Task 2 (added later in this same file): the lease-to-session
// seam (ensureStockSession()). Every test in this file is pure/offline --
// no broker process, no emulator, matching this plan's own environment
// constraint.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer, type Socket, type AddressInfo } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import {
  manifestPathForBackend,
  ensureStockSession,
  clearHeldStockSession,
  stockHandlerFor,
  dispatchStock,
  stockDisconnect,
  type StockDispatchDeps,
} from "./stock-dispatch.ts";
import { encodeResponseFrame } from "./binmon-fixtures.ts";
import { DENY_LIST, MachineRestartedError } from "./vice.ts";
import { MonitorOwnershipError } from "./vice-broker-client.ts";
import type { HeldLease, BrokerControlSession } from "./vice-broker-client.ts";
import type { StockConnectSession, StockConnectOptions } from "./stock-connect.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FORK_MANIFEST_PATH = join(HERE, "tools-manifest.json");
const STOCK_MANIFEST_PATH = join(HERE, "tools-manifest.stock.json");

interface ManifestToolEntry {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface Manifest {
  generated_at: string;
  endpoint: string;
  tools: ManifestToolEntry[];
}

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8"));
}

// --------------------------------------------------------- manifestPathForBackend

test("manifest/backend: fork with no override resolves to <hereDir>/tools-manifest.json", () => {
  assert.equal(manifestPathForBackend("fork", HERE, undefined), join(HERE, "tools-manifest.json"));
});

test("manifest/backend: stock with no override resolves to <hereDir>/tools-manifest.stock.json", () => {
  assert.equal(manifestPathForBackend("stock", HERE, undefined), join(HERE, "tools-manifest.stock.json"));
});

test("manifest/backend: VICE_TOOLS_MANIFEST override wins for the fork backend, resolved", () => {
  assert.equal(manifestPathForBackend("fork", HERE, "/tmp/custom.json"), join("/tmp/custom.json"));
});

test("manifest/backend: VICE_TOOLS_MANIFEST override wins for the stock backend too -- same override, same resolved path", () => {
  const forkOverride = manifestPathForBackend("fork", HERE, "/tmp/custom.json");
  const stockOverride = manifestPathForBackend("stock", HERE, "/tmp/custom.json");
  assert.equal(stockOverride, forkOverride);
});

// --------------------------------------------------------- tools-manifest.stock.json shape

test("manifest/backend: tools-manifest.stock.json parses and carries the same three top-level keys as the fork manifest", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const fork = readManifest(FORK_MANIFEST_PATH);
  for (const key of ["generated_at", "endpoint", "tools"] as const) {
    assert.ok(key in stock, `stock manifest missing top-level key "${key}"`);
    assert.ok(key in fork, `fork manifest missing top-level key "${key}"`);
  }
});

test("manifest/backend: tools-manifest.stock.json's tools array contains a vice_ping entry", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  assert.ok(stock.tools.some((t) => t.name === "vice_ping"), "expected a vice_ping entry in the stock manifest");
});

test("manifest/backend: every stock tool name also exists in the fork manifest with an identical inputSchema", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const fork = readManifest(FORK_MANIFEST_PATH);
  for (const tool of stock.tools) {
    const match = fork.tools.find((t) => t.name === tool.name);
    assert.ok(match, `stock tool "${tool.name}" has no counterpart in the fork manifest`);
    assert.deepEqual(tool.inputSchema, match!.inputSchema, `"${tool.name}" inputSchema differs between backends`);
  }
});

test("manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const name of DENY_LIST) {
    assert.ok(!stock.tools.some((t) => t.name === name), `DENY_LIST name "${name}" must never appear in the stock manifest`);
  }
});

// ---------------------------------------------------------------------------
// Task 2: ensureStockSession() -- the lease-to-session seam. Every
// brokerControl below is an injected two-method stub, never a real
// BrokerControlSession opened by this test file (D-13: this module must
// never open a control session of its own). Every "connect"/"reconnect" is
// a spy stub, never stock-connect.ts's real socket-touching implementation
// -- these tests assert WIRING (call order, call count, field identity),
// never protocol shape (stock-connect.test.ts already owns that).
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearHeldStockSession();
});

const STUB_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
} as unknown as BrokerControlSession;

// stockConnect()'s own StockConnectOptions.brokerControl (and
// StockConnectSession.brokerControl) is typed as the narrower
// StockConnectBrokerControl (claimMonitor/releaseMonitor only) -- alias it
// off StockConnectSession itself rather than importing a second name, so a
// value satisfying HeldLease.brokerControl (the wider BrokerControlSession)
// still structurally satisfies this narrower field when threaded through.
type FakeSessionBrokerControl = StockConnectSession["brokerControl"];

/** Builds a HeldLease from the four coordinates a test actually cares about,
 * defaulting the two CR-06 directory fields. They are REQUIRED on HeldLease
 * (not optional) precisely so vice-proxy.ts's buildHeldLease() -- the ONE
 * production construction site -- cannot silently omit them again; this helper
 * keeps that requirement from turning into noise at 16 test call sites. Tests
 * that care about the threading pass them explicitly. */
function makeLease(opts: Omit<HeldLease, "epochFile" | "supervisorDir"> & Partial<Pick<HeldLease, "epochFile" | "supervisorDir">>): HeldLease {
  return { epochFile: "", supervisorDir: "", ...opts };
}

/** The fake client carries a REAL disconnect() that flips `connected` to
 * false (CR-05): a session teardown that only drops the reference is exactly
 * the defect under test, so the stub has to be able to tell the two apart. */
function fakeSession(opts: { targetId: string; host: string; port: number; brokerControl: FakeSessionBrokerControl; connected?: boolean }): StockConnectSession {
  const client = {
    connected: opts.connected ?? true,
    disconnect: async (): Promise<void> => {
      client.connected = false;
    },
  };
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

test("lease: ensureLease is awaited strictly before stockConnect is ever called (lease-before-connect ordering)", async () => {
  let counter = 0;
  let leaseCallIndex = -1;
  let connectCallIndex = -1;
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockDispatchDeps = {
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
  const deps: StockDispatchDeps = {
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
  const deps: StockDispatchDeps = {
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
  const deps: StockDispatchDeps = {
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

test("lease: two successive calls with the same targetId call stockConnect exactly once -- the held session is reused", async () => {
  let connectCalls = 0;
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockDispatchDeps = {
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
  const deps: StockDispatchDeps = {
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

test("CR-06: the lease's epochFile/supervisorDir and the settled binary path all reach stockConnect as deps", async () => {
  const received: StockConnectOptions[] = [];
  const lease = makeLease({
    host: "127.0.0.1",
    port: 6502,
    targetId: "grant-deps-1",
    brokerControl: STUB_BROKER_CONTROL,
    epochFile: "/ws/.vice-supervisor/6502/epoch.json",
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
  assert.deepEqual(received[0]!.deps, {
    epochPath: "/ws/.vice-supervisor/6502/epoch.json",
    supervisorDir: "/ws/.vice-supervisor",
    binPath: "/usr/bin/x64sc",
  });
});

test("CR-06: the epoch path is the per-instance epoch.json, NOT the top-level supervisor dir -- the two are threaded independently", async () => {
  const received: StockConnectOptions[] = [];
  const lease = makeLease({
    host: "127.0.0.1",
    port: 6503,
    targetId: "grant-deps-2",
    brokerControl: STUB_BROKER_CONTROL,
    epochFile: "/ws/.vice-supervisor/6503/epoch.json",
    supervisorDir: "/ws/.vice-supervisor",
  });
  await ensureStockSession({
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => {
      received.push(opts);
      return fakeSession(opts);
    },
  });
  const deps = received[0]!.deps!;
  assert.notEqual(deps.epochPath, deps.supervisorDir, "backend.json and epoch.json live in DIFFERENT directories");
  assert.match(String(deps.epochPath), /\/6503\/epoch\.json$/);
  assert.doesNotMatch(String(deps.supervisorDir), /\/6503$/, "the capability cache must not be pointed at the per-instance directory");
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
  assert.deepEqual(received[0]!.deps, {}, "no epochPath, no supervisorDir, no binPath -- absent, not empty strings");
});

test("CR-06: the real stockConnect, driven against a loopback binmon stub through ensureStockSession, records a non-null baselineEpoch", async () => {
  // The one test in this file that uses the REAL stockConnect -- because the
  // defect was precisely that the real function never received `deps`. The
  // emulator is a loopback stub answering the four handshake commands; no
  // broker process and no x64sc are involved.
  const dir = mkdtempSync(join(tmpdir(), "stock-dispatch-cr06-"));
  const epochPath = join(dir, "epoch.json");
  writeFileSync(epochPath, JSON.stringify({ epoch: 7, spawned_at: new Date().toISOString(), pid: 4242 }));

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
        } else {
          socket.write(encodeResponseFrame({ responseType: commandType, errorCode: 0x00, requestId }));
        }
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;

  try {
    const lease = makeLease({ host: "127.0.0.1", port, targetId: "grant-real-1", brokerControl: STUB_BROKER_CONTROL, epochFile: epochPath, supervisorDir: dir });
    const outcome = await ensureStockSession({ ensureLease: async () => ({ ok: true, lease }) });
    assert.ok(outcome.ok, `expected a live session: ${JSON.stringify(outcome)}`);
    assert.equal(outcome.session.baselineEpoch, 7, "the reconnect baseline must be the epoch the lease's own epoch.json carries, not null");
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
  const deps: StockDispatchDeps = {
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
  const deps: StockDispatchDeps = {
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
  const deps: StockDispatchDeps = {
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
  const deps: StockDispatchDeps = {
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
// Task 1 (plan 02-10): the dispatch table, the hard refusal, and vice_ping.
// Every deps.connect/deps.reconnect below is a spy stub, never
// stock-connect.ts's real socket-touching implementation -- these tests
// assert dispatch WIRING and refusal TEXT, never protocol shape. Every
// ping test drives dispatchStock() through a REAL ensureStockSession(), per
// this plan's own test-stubbing-boundary decision -- never a stubbed
// ensureStockSession.
// ---------------------------------------------------------------------------

test("dispatch: stockHandlerFor(\"vice_ping\") returns a handler; stockHandlerFor(\"vice_mem_read\") returns undefined", () => {
  assert.equal(typeof stockHandlerFor("vice_ping"), "function");
  assert.equal(stockHandlerFor("vice_mem_read"), undefined);
});

test("refus: dispatchStock on a name with no handler refuses by name, names the fork, never calls forwardToVice, and never touches deps", async () => {
  let depsTouched = false;
  const emptyDeps = new Proxy({} as StockDispatchDeps, {
    get(target, prop) {
      depsTouched = true;
      return (target as unknown as Record<string | symbol, unknown>)[prop];
    },
  });
  const result = await dispatchStock("vice_mem_read", {}, emptyDeps);
  assert.equal(result.isError, true);
  const text = JSON.stringify(result.content);
  assert.match(text, /vice_mem_read/);
  assert.match(text, /fork/i);
  assert.equal(depsTouched, false, "a miss must never read any field off deps");
});

test("refus: dispatchStock never returns a success shape for an unknown tool name", async () => {
  const result = await dispatchStock("vice_totally_unknown_tool", {}, { ensureLease: async () => ({ ok: true, lease: null }) });
  assert.equal(result.isError, true);
});

test("ping: dispatchStock(\"vice_ping\", ...) calls deps.ensureLease exactly once and deps.connect receives the exact lease fields", async () => {
  let ensureLeaseCalls = 0;
  const lease: HeldLease = makeLease({ host: "10.1.2.3", port: 6510, targetId: "grant-ping-1", brokerControl: STUB_BROKER_CONTROL });
  const receivedCalls: StockConnectOptions[] = [];
  const deps: StockDispatchDeps = {
    ensureLease: async () => {
      ensureLeaseCalls++;
      return { ok: true, lease };
    },
    connect: async (opts) => {
      receivedCalls.push(opts);
      return fakeSession(opts);
    },
    resolvedBinaryPath: "/usr/local/bin/x64sc",
  };
  const result = await dispatchStock("vice_ping", {}, deps);
  assert.equal(result.isError, false);
  assert.equal(ensureLeaseCalls, 1);
  assert.equal(receivedCalls.length, 1);
  const received = receivedCalls[0]!;
  assert.strictEqual(received.host, lease.host);
  assert.strictEqual(received.port, lease.port);
  assert.strictEqual(received.targetId, lease.targetId);
  assert.strictEqual(received.brokerControl, lease.brokerControl);
});

test("ping: a failing ensureLease yields isError:true carrying the provider's message and never calls connect", async () => {
  let connectCalls = 0;
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: false, message: "broker: dead_or_hung (pid 1234)" }),
    connect: async (opts) => {
      connectCalls++;
      return fakeSession(opts);
    },
  };
  const result = await dispatchStock("vice_ping", {}, deps);
  assert.equal(result.isError, true);
  const text = JSON.stringify(result.content);
  assert.match(text, /dead_or_hung/);
  assert.equal(connectCalls, 0);
});

test("ping: the success payload carries backend, viceVersion, and resolvedBinaryPath", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-ping-2", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
    resolvedBinaryPath: "/opt/vice/bin/x64sc",
    resolvedBinaryPathIsResolved: true,
  };
  const result = await dispatchStock("vice_ping", {}, deps);
  assert.equal(result.isError, false);
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.backend, "stock");
  assert.equal(typeof payload.viceVersion, "string");
  assert.match(payload.viceVersion, /3\.9\.0/);
  assert.equal(payload.resolvedBinaryPath, "/opt/vice/bin/x64sc");
  assert.equal(payload.resolvedBinaryPathIsResolved, true);
});

test("WR-05 ping: an UNRESOLVED binary path is reported as such, so a bare name is never presented as a resolved path", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-ping-wr05", brokerControl: STUB_BROKER_CONTROL });
  const result = await dispatchStock("vice_ping", {}, {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
    // The pre-WR-05 production value: the raw configured name, which inside a
    // container resolves to nothing at all.
    resolvedBinaryPath: "x64sc",
    resolvedBinaryPathIsResolved: false,
  });
  const payload = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
  assert.equal(payload.resolvedBinaryPath, "x64sc");
  assert.equal(payload.resolvedBinaryPathIsResolved, false, "the answer must not imply a resolution it did not achieve");
});

test("WR-05 ping: the resolution flag defaults to false when nothing said otherwise", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-ping-wr05b", brokerControl: STUB_BROKER_CONTROL });
  const result = await dispatchStock("vice_ping", {}, {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  });
  const payload = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
  assert.equal(payload.resolvedBinaryPathIsResolved, false);
});

test("WR-06: a connect REFUSAL on the stock path names VICE_BROKER_BINMON_HOST and the loopback default", async () => {
  const lease: HeldLease = makeLease({ host: "host.docker.internal", port: 6605, targetId: "grant-wr06", brokerControl: STUB_BROKER_CONTROL });
  const result = await dispatchStock("vice_ping", {}, {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async () => {
      throw new Error("connect ECONNREFUSED 172.17.0.1:6605");
    },
  });
  assert.equal(result.isError, true);
  const text = result.content[0]!.text;
  assert.match(text, /VICE_BROKER_BINMON_HOST/, "the one variable that reconciles the bind and the dial must be named");
  assert.match(text, /127\.0\.0\.1/, "the loopback default must be named, since that is what the operator has to change");
  assert.match(text, /ECONNREFUSED 172\.17\.0\.1:6605/, "the underlying error must still be quoted verbatim");
  assert.doesNotMatch(text, /wedge|hung|unresponsive/i, "an unreachable bind address is not an emulator fault");
});

test("WR-06: a non-connect handshake failure keeps the plain wording -- the binmon-host advice is not sprayed over unrelated causes", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6605, targetId: "grant-wr06b", brokerControl: STUB_BROKER_CONTROL });
  const result = await dispatchStock("vice_ping", {}, {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async () => {
      throw new Error("observed api_version 0x03, expected 0x02");
    },
  });
  const text = result.content[0]!.text;
  assert.match(text, /stock handshake failed \(observed api_version 0x03/);
  assert.doesNotMatch(text, /VICE_BROKER_BINMON_HOST/);
});

test("WR-06: vice-proxy.ts strips the WHATWG bracket form when deriving the dial host, so an IPv6 URL is usable by net.connect()", () => {
  // The behaviour under test lives in buildHeldLease(), in the file the
  // automated gate cannot execute -- so the transform is asserted structurally
  // AND the underlying quirk it exists for is asserted for real, here, against
  // the same URL parser.
  assert.equal(new URL("http://[::1]:6605/mcp").hostname, "[::1]", "WHATWG URL keeps the brackets -- this is the quirk");
  assert.equal(new URL("http://[::1]:6605/mcp").hostname.replace(/^\[(.+)\]$/, "$1"), "::1");
  assert.equal(new URL("http://127.0.0.1:6605/mcp").hostname.replace(/^\[(.+)\]$/, "$1"), "127.0.0.1", "an IPv4 host is unaffected");

  const start = VICE_PROXY_SOURCE.indexOf("function buildHeldLease(");
  const body = VICE_PROXY_SOURCE.slice(start, VICE_PROXY_SOURCE.indexOf("\n}", start));
  assert.match(body, /hostname\.replace\(/, "buildHeldLease() must strip the bracket form where the dial host is derived");
});

test("ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-ping-3", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async () => {
      throw new MonitorOwnershipError("stockConnect: monitor for target grant-ping-3 on port 6502 is already claimed by grant grant-other", {
        holderGrantId: "grant-other",
        holderClaimedAt: 1700000000000,
        port: 6502,
      });
    },
  };
  const result = await dispatchStock("vice_ping", {}, deps);
  assert.equal(result.isError, true);
  const text = JSON.stringify(result.content).toLowerCase();
  assert.match(text, /grant-other/);
  assert.doesNotMatch(text, /wedge|hung|unresponsive/);
});

test("ping: a MachineRestartedError from the handshake becomes isError:true distinguishable from a provider-timeout message", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-ping-4", brokerControl: STUB_BROKER_CONTROL });
  let connectCalls = 0;
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => {
      connectCalls++;
      if (connectCalls === 1) return fakeSession({ ...opts, connected: false });
      throw new Error("connect should not be called a second time in this scenario");
    },
    reconnect: async () => {
      throw new MachineRestartedError("test: machine restarted across reconnect", { baselineEpoch: 5, currentEpoch: 9 });
    },
  };
  await dispatchStock("vice_ping", {}, deps); // first call connects and holds a not-connected session
  const result = await dispatchStock("vice_ping", {}, deps); // second call triggers the reconnect path
  assert.equal(result.isError, true);
  const text = JSON.stringify(result.content);
  assert.match(text, /epoch/i);
  assert.match(text, /baseline epoch 5/);
  assert.match(text, /current epoch 9/);
  assert.doesNotMatch(text.toLowerCase(), /timeout/);
});

test("dispatch: no handler in the table ever throws -- dispatchStock always resolves to a well-formed {content,isError} result", async () => {
  const names = ["vice_ping", "vice_totally_unknown_tool", "vice_mem_read"];
  for (const name of names) {
    const result = await dispatchStock(name, {}, { ensureLease: async () => ({ ok: false, message: "unreachable in this test" }) });
    assert.equal(typeof result.isError, "boolean");
    assert.ok(Array.isArray(result.content));
  }
});

// ---------------------------------------------------------------------------
// Task 2 (plan 02-10): source-structure assertions on vice-proxy.ts itself --
// the structural stand-in for the fall-through and lease-wiring guarantees in
// a file vice-proxy.test.ts (excluded from the automated gate) cannot prove
// by running it. Every assertion here reads vice-proxy.ts as plain text; none
// of them import or execute it (that file's own top-level `await
// server.startStdio()` makes importing it unsafe outside a real stdio
// harness).
// ---------------------------------------------------------------------------

const VICE_PROXY_SOURCE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "vice-proxy.ts"), "utf8");
const VICE_PROXY_CODE_LINES = VICE_PROXY_SOURCE.split("\n").filter((line) => !/^\s*\*/.test(line) && !/^\s*\/\//.test(line));

test("structure/proxy: vice-proxy.ts has exactly one dispatchStock CALL SITE", () => {
  // Counts call sites in CODE lines only. The original oracle counted every
  // textual occurrence anywhere in the file, prose included, which made the
  // "one dispatch site" guarantee it exists to protect indistinguishable from
  // "nobody may explain the guarantee in a comment" (CR-07's fix has to
  // document why the registration seam is backend-aware). The invariant is
  // unchanged and still enforced: ONE place a stock tools/call is routed from.
  const matches = VICE_PROXY_CODE_LINES.filter((line) => line.includes("dispatchStock("));
  assert.equal(matches.length, 1, `expected exactly one dispatchStock( call site, found ${matches.length}: ${JSON.stringify(matches)}`);
});

test("structure/proxy: vice-proxy.ts's dispatchStock call site passes ensureBrokerLease as its LeaseProvider", () => {
  assert.match(VICE_PROXY_SOURCE, /dispatchStock\([^)]*ensureLease:\s*ensureBrokerLease/);
});

test("structure/proxy: vice-proxy.ts references manifestPathForBackend exactly once", () => {
  const matches = VICE_PROXY_SOURCE.split("\n").filter((line) => line.includes("manifestPathForBackend"));
  assert.equal(matches.length, 1, `expected exactly one manifestPathForBackend reference, found ${matches.length}`);
});

test("structure/proxy: vice-proxy.ts's ensureBrokerLease has at least two lease-bearing success returns", () => {
  const matches = VICE_PROXY_SOURCE.match(/ok:\s*true,\s*lease/g) ?? [];
  assert.ok(matches.length >= 2, `expected >= 2 lease-bearing success returns, found ${matches.length}`);
});

test("structure/proxy: no code line in vice-proxy.ts pairs \"stock\" with \"forwardToVice\"", () => {
  const offenders = VICE_PROXY_CODE_LINES.filter((line) => /stock/i.test(line) && line.includes("forwardToVice"));
  assert.equal(offenders.length, 0, `found a line pairing stock with forwardToVice: ${JSON.stringify(offenders)}`);
});

// ---------------------------------------------------------------------------
// CR-07: the assertion above was satisfied by an arrangement that still
// reached the fork's HTTP transport on stock -- the three synthetic tools were
// registered unconditionally after the (backend-aware) manifest loop, and
// tools/list is served from that same object, so vice_diagnose and
// vice_recycle were advertised on stock and ran call()/forwardToVice() against
// a binary-monitor port. Checking that no LINE pairs the two strings is not the
// same as checking that no registered RUNNER can reach that transport. These
// assert the registration seam itself.
// ---------------------------------------------------------------------------

/** Every `tools[<name>] = <expr>;` registration in vice-proxy.ts, as
 * `[registrationKey, righthandSide]`. */
function proxyToolRegistrations(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const line of VICE_PROXY_CODE_LINES) {
    const match = /^\s*tools\[([^\]]+)\]\s*=\s*(.+)$/.exec(line);
    if (match) out.push([match[1]!.trim(), match[2]!.trim()]);
  }
  return out;
}

/** The three tools with no manifest entry at all -- served proxy-local, so the
 * manifest loop's own backend-aware runner choice never covers them. */
const SYNTHETIC_TOOL_KEYS = ["RESULT_CONTINUE_TOOL.name", "RECYCLE_TOOL.name", "DIAGNOSE_TOOL.name"];

test("structure/proxy (CR-07): every registered tool whose runner can touch a transport goes through buildBackendAwareTool", () => {
  const registrations = proxyToolRegistrations();
  assert.ok(registrations.length >= 4, `expected the manifest-loop registration plus three synthetic ones, found ${registrations.length}`);
  for (const [key, rhs] of registrations) {
    if (key === "RESULT_CONTINUE_TOOL.name") continue; // the one asserted exception, covered below
    assert.match(
      rhs,
      /buildBackendAwareTool\(/,
      `tools[${key}] must be registered through buildBackendAwareTool so the stock backend answers or refuses BY NAME, never falls through to the fork's HTTP transport: ${rhs}`,
    );
  }
});

test("structure/proxy (CR-07): the synthetic tools are all registered, and the only one bypassing the backend-aware seam is vice_result_continue", () => {
  const registrations = proxyToolRegistrations();
  const keys = registrations.map(([key]) => key);
  for (const synthetic of SYNTHETIC_TOOL_KEYS) {
    assert.ok(keys.includes(synthetic), `expected a registration for ${synthetic}`);
  }
  const bypassing = registrations.filter(([, rhs]) => !rhs.includes("buildBackendAwareTool(")).map(([key]) => key);
  assert.deepEqual(bypassing, ["RESULT_CONTINUE_TOOL.name"], "exactly one registration may bypass the backend-aware seam");
});

test("structure/proxy (CR-07): vice_result_continue's runner is handleResultContinue, whose body touches no transport at all", () => {
  const registrations = proxyToolRegistrations();
  const entry = registrations.find(([key]) => key === "RESULT_CONTINUE_TOOL.name");
  assert.ok(entry, "vice_result_continue must still be registered");
  assert.match(entry![1], /handleResultContinue\(/, "its runner must be handleResultContinue, the proxy-local continuation reader");

  const start = VICE_PROXY_SOURCE.indexOf("function handleResultContinue(");
  assert.ok(start > 0, "handleResultContinue() must still exist");
  const body = VICE_PROXY_SOURCE.slice(start, VICE_PROXY_SOURCE.indexOf("\n}", start));
  for (const forbidden of ["forwardToVice", "ensureViceSession", "rewriteArguments"]) {
    assert.ok(!body.includes(forbidden), `handleResultContinue() must not reach ${forbidden} -- that is what makes its backend-independence sound`);
  }
});

test("structure/proxy (CR-07): buildBackendAwareTool routes the non-fork backend to dispatchStock, and that is the only dispatch site", () => {
  const start = VICE_PROXY_SOURCE.indexOf("function buildBackendAwareTool(");
  assert.ok(start > 0, "buildBackendAwareTool() must exist -- it is the one backend-aware registration seam");
  const body = VICE_PROXY_SOURCE.slice(start, VICE_PROXY_SOURCE.indexOf("\n}", start));
  assert.match(body, /ACTIVE_BACKEND\.backend === "fork"/, "the branch must read the ONCE-settled ACTIVE_BACKEND, never re-detect");
  assert.match(body, /dispatchStock\(/, "the non-fork arm must answer through dispatchStock");
});

test("structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware", () => {
  const registrations = proxyToolRegistrations();
  for (const handler of ["handleDiagnose(", "handleRecycle("]) {
    const hits = registrations.filter(([, rhs]) => rhs.includes(handler));
    assert.equal(hits.length, 1, `expected exactly one registration referencing ${handler}, found ${hits.length}`);
    assert.match(hits[0]![1], /buildBackendAwareTool\(/, `${handler} reaches the fork's HTTP transport, so its registration must be backend-aware`);
  }
});

test("structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once", () => {
  // Same correction as the dispatchStock oracle above: CODE lines only. The
  // invariant is "the backend is settled exactly once, at module scope" -- a
  // comment explaining that invariant (WR-04's mismatch check has to explain why
  // the broker's verdict is authoritative) is not a second call.
  const matches = VICE_PROXY_CODE_LINES.filter((line) => line.includes("resolvedBackend("));
  assert.equal(matches.length, 1, `expected exactly one resolvedBackend( call, found ${matches.length}: ${JSON.stringify(matches)}`);
});

test("structure/proxy (WR-04): ensureBrokerLease() compares the broker's own backend verdict against ACTIVE_BACKEND and refuses a definite mismatch", () => {
  const start = VICE_PROXY_SOURCE.indexOf("async function ensureBrokerLease(");
  assert.ok(start > 0, "ensureBrokerLease() must still exist in vice-proxy.ts");
  const body = VICE_PROXY_SOURCE.slice(start, VICE_PROXY_SOURCE.indexOf("\n}", start));

  assert.match(body, /session\.hostState\(\)/, "the proxy must ask the broker which backend IT resolved");
  assert.match(body, /hostState\.backend !== null/, "a broker that does not report a backend is absent evidence, not agreement");
  assert.match(body, /hostState\.backend !== ACTIVE_BACKEND\.backend/, "the comparison must be against the ONCE-settled ACTIVE_BACKEND");
  assert.match(body, /VICE_BACKEND=/, "the refusal must name the explicit override that fixes it");

  // The check must precede the acquire, so a mismatch never allocates an
  // emulator, and must release the control session it opened.
  const checkAt = body.indexOf("session.hostState()");
  const acquireAt = body.indexOf("session.acquire()");
  assert.ok(checkAt > 0 && acquireAt > 0 && checkAt < acquireAt, "the backend check must run BEFORE the acquire");
  const refusalBlock = body.slice(checkAt, acquireAt);
  assert.match(refusalBlock, /session\.release\(\)/, "a refused mismatch must release the control session rather than leaking it");
});

// CR-06: buildHeldLease() is the ONE production construction site for
// HeldLease, and it lives in the one file the automated gate cannot execute
// (vice-proxy.ts's own top-level `await server.startStdio()`). HeldLease's two
// new fields being REQUIRED already makes an omission a typecheck failure;
// these assert the VALUES it threads, which typing alone cannot.

test("structure/proxy (CR-06): buildHeldLease() threads epochFile and supervisorDir, from activeInstance() and brokerRootDir() respectively", () => {
  const start = VICE_PROXY_SOURCE.indexOf("function buildHeldLease(");
  assert.ok(start > 0, "buildHeldLease() must still exist in vice-proxy.ts");
  const body = VICE_PROXY_SOURCE.slice(start, VICE_PROXY_SOURCE.indexOf("\n}", start));
  assert.match(body, /epochFile/, "the lease must carry the instance's epoch file -- without it stockReconnect() always reports a false machine restart");
  assert.match(body, /supervisorDir:\s*brokerRootDir\(\)/, "the capability cache directory must come from brokerRootDir(), the same resolver broker.json is read from");
  assert.match(body, /activeInstance\(\)/, "epochFile must be read fresh from activeInstance(), never memoised");
  // The per-instance supervisor_dir would point backend.json at
  // <stateDir>/<port>, where no record is ever written -- a silent permanent
  // capability-cache miss.
  assert.doesNotMatch(body, /supervisor_dir/, "the grant's per-instance supervisor_dir is NOT the capability-cache directory");
});
