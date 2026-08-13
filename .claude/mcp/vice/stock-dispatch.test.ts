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

import {
  manifestPathForBackend,
  ensureStockSession,
  clearHeldStockSession,
  stockHandlerFor,
  dispatchStock,
  type StockDispatchDeps,
} from "./stock-dispatch.ts";
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

function fakeSession(opts: { targetId: string; host: string; port: number; brokerControl: FakeSessionBrokerControl; connected?: boolean }): StockConnectSession {
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
  const lease: HeldLease = { host: "10.1.2.3", port: 6510, targetId: "grant-ping-1", brokerControl: STUB_BROKER_CONTROL };
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
  const lease: HeldLease = { host: "127.0.0.1", port: 6502, targetId: "grant-ping-2", brokerControl: STUB_BROKER_CONTROL };
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
    resolvedBinaryPath: "/opt/vice/bin/x64sc",
  };
  const result = await dispatchStock("vice_ping", {}, deps);
  assert.equal(result.isError, false);
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.backend, "stock");
  assert.equal(typeof payload.viceVersion, "string");
  assert.match(payload.viceVersion, /3\.9\.0/);
  assert.equal(payload.resolvedBinaryPath, "/opt/vice/bin/x64sc");
});

test("ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language", async () => {
  const lease: HeldLease = { host: "127.0.0.1", port: 6502, targetId: "grant-ping-3", brokerControl: STUB_BROKER_CONTROL };
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
  const lease: HeldLease = { host: "127.0.0.1", port: 6502, targetId: "grant-ping-4", brokerControl: STUB_BROKER_CONTROL };
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
