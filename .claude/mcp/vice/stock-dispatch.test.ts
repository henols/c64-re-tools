// node:test coverage of stock-dispatch.ts. Task 1: the manifest selector
// (manifestPathForBackend()) and the two committed manifests it chooses
// between. Task 2 (added later in this same file): the lease-to-session
// seam (ensureStockSession()). Every test in this file is pure/offline --
// no broker process, no emulator, matching this plan's own environment
// constraint.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { manifestPathForBackend, ensureStockSession, clearHeldStockSession, type StockDispatchDeps } from "./stock-dispatch.ts";
import { DENY_LIST, MachineRestartedError } from "./vice.ts";
import type { HeldLease, BrokerControlSession } from "./vice-broker-client.ts";
import type { StockConnectSession } from "./stock-connect.ts";

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

function fakeSession(opts: { targetId: string; host: string; port: number; brokerControl: BrokerControlSession; connected?: boolean }): StockConnectSession {
  return {
    client: { connected: opts.connected ?? true } as unknown as StockConnectSession["client"],
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
  const lease: HeldLease = { host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl: STUB_BROKER_CONTROL };
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
  const lease: HeldLease = { host: "10.0.0.5", port: 9002, targetId: "grant-42", brokerControl };
  let received: { host: string; port: number; targetId: string; brokerControl: BrokerControlSession } | null = null;
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => {
      received = opts;
      return fakeSession(opts);
    },
  };
  const outcome = await ensureStockSession(deps);
  assert.ok(outcome.ok);
  assert.ok(received !== null);
  assert.strictEqual(received!.host, lease.host);
  assert.strictEqual(received!.port, lease.port);
  assert.strictEqual(received!.targetId, lease.targetId);
  assert.strictEqual(received!.brokerControl, lease.brokerControl);
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
  const lease: HeldLease = { host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl: STUB_BROKER_CONTROL };
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
  const leaseA: HeldLease = { host: "127.0.0.1", port: 6502, targetId: "grant-1", brokerControl: STUB_BROKER_CONTROL };
  const leaseB: HeldLease = { host: "127.0.0.1", port: 6503, targetId: "grant-2", brokerControl: STUB_BROKER_CONTROL };
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

test("lease: a held session whose socket has closed is re-established via stockReconnect, not silently reused", async () => {
  let connectCalls = 0;
  let reconnectCalls = 0;
  const lease: HeldLease = { host: "127.0.0.1", port: 6502, targetId: "grant-9", brokerControl: STUB_BROKER_CONTROL };
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
  const lease: HeldLease = { host: "127.0.0.1", port: 6502, targetId: "grant-9", brokerControl: STUB_BROKER_CONTROL };
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
