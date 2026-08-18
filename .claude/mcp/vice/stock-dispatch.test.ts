// node:test coverage of stock-dispatch.ts. Task 1: the manifest selector
// (manifestPathForBackend()) and the two committed manifests it chooses
// between. Task 2 (added later in this same file): the lease-to-session
// seam (ensureStockSession()). Every test in this file is pure/offline --
// no broker process, no emulator, matching this plan's own environment
// constraint.
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer, type Socket, type AddressInfo } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { EventEmitter } from "node:events";

import {
  manifestPathForBackend,
  ensureStockSession,
  clearHeldStockSession,
  stockHandlerFor,
  dispatchStock,
  stockDisconnect,
  withStockSession,
  withDerivedTool,
  type StockDispatchDeps,
} from "./stock-dispatch.ts";
import type { DerivedPureHandler } from "./stock-derived.ts";
import { encodeResponseFrame } from "./binmon-fixtures.ts";
import { DENY_LIST, MachineRestartedError } from "./vice.ts";
import { MonitorOwnershipError } from "./vice-broker-client.ts";
import type { HeldLease, BrokerControlSession } from "./vice-broker-client.ts";
import type { StockConnectSession, StockConnectOptions } from "./stock-connect.ts";
import { resetRunStateTrackersForTest, attachRunStateTracker } from "./stock-runstate.ts";
import type { StockSessionHandler, StockToolResult } from "./stock-handler.ts";
import { checkAgainstSchema } from "./stock-schema-check.ts";
import { CommandType } from "./stock-protocol.ts";
import { setIsInsideContainerForTest } from "./stock-paths.ts";
import { resetBankCatalogsForTest } from "./stock-memory.ts";
import { resetRegisterCatalogsForTest } from "./stock-registers.ts";
import { resetSymbolStoreForTest } from "./stock-symbols.ts";
import {
  resetCheckpointStateForTest,
  handleCheckpointSetCondition,
  conditionTextFor,
  _conditionRegistryTargetsForTest,
} from "./stock-checkpoints.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FORK_MANIFEST_PATH = join(HERE, "tools-manifest.json");
const STOCK_MANIFEST_PATH = join(HERE, "tools-manifest.stock.json");

interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, { type?: string } & Record<string, unknown>>;
  required?: string[];
  additionalProperties?: boolean;
}

interface ManifestToolEntry {
  name: string;
  description?: string;
  inputSchema?: JsonSchemaObject;
  outputSchema?: JsonSchemaObject;
}

interface Manifest {
  generated_at: string;
  endpoint: string;
  tools: ManifestToolEntry[];
}

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8"));
}

// D-03/Task 3 (plan 03-12): the two backends' advertised tool lists are
// genuinely different, permanently (Phase 2 D-07) -- these are the ONLY
// names permitted to exist on the stock manifest with no fork counterpart.
// A future stock-only addition is a deliberate edit to this named list,
// never a silently loosened "every stock name needs a fork match" assertion.
const STOCK_ONLY_TOOLS = new Set(["vice_execution_until_return", "vice_registers_available"]);

// Phase 7, plan 07-09: a THIRD named category, distinct from STOCK_ONLY_TOOLS
// above. vice_diagnose/vice_recycle are served proxy-locally (RECYCLE_TOOL/
// DIAGNOSE_TOOL in vice-proxy.ts) on BOTH backends -- buildBackendAwareTool()
// routes them to dispatchStock() on stock and to their own fork handlers on
// the fork, but neither is ever in tools-manifest.json, which is regenerated
// from the host fork server's own tools/list and has no way to know about a
// tool the PROXY itself serves. They are therefore neither "has a fork
// manifest counterpart" (STOCK_ONLY_TOOLS's own test would wrongly demand
// one) NOR genuinely stock-only (the fork backend serves them too, just not
// via its manifest) -- a distinct category is the only correct label. The
// D-03 name-coverage test below skips PROXY_LOCAL_TOOLS members in its
// fork-counterpart branch and asserts each is present in the stock manifest,
// absent from the fork manifest, and NOT a member of STOCK_ONLY_TOOLS (never
// mislabelled stock-only).
const PROXY_LOCAL_TOOLS = new Set(["vice_diagnose", "vice_recycle"]);

// D-09/plan 03-13: the ONE inputSchema property permitted to omit "type"
// entirely rather than matching the fork's declared type. The fork types
// vice_checkpoint_set_condition's `condition` as a bare string; stock accepts
// EITHER a condition string OR a structured condition object (D-09), which
// checkAgainstSchema()'s supported subset cannot express as a union (no
// oneOf/anyOf) -- so this one property deliberately has no "type" keyword at
// all (see tools-manifest.stock.json's own entry and its description). A
// second entry here would need the same D-09-style justification, never a
// silent widening of the general type-equality rule below.
const TYPE_CHECK_EXEMPT_PROPERTIES = new Set(["vice_checkpoint_set_condition.condition"]);

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

// ---------------------------------------------------------------------------
// Task 3 (plan 03-12): the manifest contract, reworked. The old "every stock
// tool name also exists in the fork manifest with an IDENTICAL inputSchema"
// test failed by construction the moment stock adds a stock-only tool or a
// stock-only OPTIONAL argument (D-03) -- replaced by a compatibility test
// (fork-required arguments must still be satisfiable, extras must be
// optional) plus a named, explicit stock-only allow-list (STOCK_ONLY_TOOLS,
// above).
//
// NOTE (handoff to plan 03-13): tools-manifest.stock.json today carries only
// the vice_ping entry -- this plan (03-12) owns STOCK_DISPATCH_TABLE, never
// the manifest file. Every test below that iterates the STOCK MANIFEST'S OWN
// tools array is therefore only as complete as that file is; the 24 Phase 3
// entries plan 03-13 adds are what make these assertions exercise the full
// surface. Where a test below fails ONLY because a manifest entry does not
// exist yet (not because of a real defect in this plan's own dispatch-table
// wiring), the failure is recorded verbatim in this plan's SUMMARY as the
// handoff to 03-13, per this plan's own verification section.
// ---------------------------------------------------------------------------

test("manifest/backend (D-03 name coverage): every non-stock-only, non-proxy-local stock tool has a fork counterpart; every STOCK_ONLY_TOOLS name is stock-only", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const fork = readManifest(FORK_MANIFEST_PATH);
  const forkNames = new Set(fork.tools.map((t) => t.name));
  for (const tool of stock.tools) {
    if (PROXY_LOCAL_TOOLS.has(tool.name)) continue; // covered by the proxy-local assertions below
    if (STOCK_ONLY_TOOLS.has(tool.name)) {
      assert.ok(!forkNames.has(tool.name), `"${tool.name}" is in STOCK_ONLY_TOOLS but ALSO exists on the fork manifest -- it is not actually stock-only`);
    } else {
      assert.ok(forkNames.has(tool.name), `stock tool "${tool.name}" has no counterpart in the fork manifest, and is not in STOCK_ONLY_TOOLS`);
    }
  }
  for (const name of STOCK_ONLY_TOOLS) {
    assert.ok(stock.tools.some((t) => t.name === name), `STOCK_ONLY_TOOLS name "${name}" must be present in the stock manifest`);
  }
  // PROXY_LOCAL_TOOLS: present on stock, absent from the fork manifest (served
  // proxy-locally there too, never via tools-manifest.json), and explicitly
  // NOT mislabelled as STOCK_ONLY_TOOLS -- both backends serve these names.
  for (const name of PROXY_LOCAL_TOOLS) {
    assert.ok(stock.tools.some((t) => t.name === name), `PROXY_LOCAL_TOOLS name "${name}" must be present in the stock manifest`);
    assert.ok(!forkNames.has(name), `PROXY_LOCAL_TOOLS name "${name}" must be absent from the fork manifest (tools-manifest.json) -- it is served proxy-locally, never via that manifest`);
    assert.ok(!STOCK_ONLY_TOOLS.has(name), `PROXY_LOCAL_TOOLS name "${name}" must not also be in STOCK_ONLY_TOOLS -- both backends serve it, it is not stock-only`);
  }
});

test("manifest/backend (D-03 input compatibility): every stock/fork pair has equal required-argument SETS, and stock's extra properties are all optional on the fork side", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const fork = readManifest(FORK_MANIFEST_PATH);
  for (const tool of stock.tools) {
    if (STOCK_ONLY_TOOLS.has(tool.name)) continue;
    const match = fork.tools.find((t) => t.name === tool.name);
    if (!match) continue; // covered by the name-coverage test above
    const stockRequired = new Set(tool.inputSchema?.required ?? []);
    const forkRequired = new Set(match.inputSchema?.required ?? []);
    assert.deepEqual(stockRequired, forkRequired, `"${tool.name}": required-argument sets differ between backends`);

    const forkProperties = match.inputSchema?.properties ?? {};
    const stockProperties = tool.inputSchema?.properties ?? {};
    for (const [propName, forkProp] of Object.entries(forkProperties)) {
      const stockProp = stockProperties[propName];
      assert.ok(stockProp, `"${tool.name}.${propName}": the fork declares this property, but stock does not`);
      if (TYPE_CHECK_EXEMPT_PROPERTIES.has(`${tool.name}.${propName}`)) {
        continue; // D-09: this property deliberately omits "type" -- see the named exemption set above
      }
      assert.equal(stockProp!.type, forkProp.type, `"${tool.name}.${propName}": type differs between backends`);
    }
    // Any property stock declares that the fork does not is an EXTRA -- D-03
    // permits this only when the extra is genuinely optional on stock's own
    // side (never in stock's own required list, checked above already since
    // the required SETS are asserted equal).
    for (const propName of Object.keys(stockProperties)) {
      if (!(propName in forkProperties)) {
        assert.ok(!stockRequired.has(propName), `"${tool.name}.${propName}": a stock-only extra property must not be required`);
      }
    }
  }
});

test("manifest/backend (bidirectional table/manifest agreement): every stock manifest entry has a dispatch handler, and every dispatch entry has a manifest entry", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const tool of stock.tools) {
    assert.equal(typeof stockHandlerFor(tool.name), "function", `stock manifest advertises "${tool.name}" but STOCK_DISPATCH_TABLE has no handler for it`);
  }
  const stockNames = new Set(stock.tools.map((t) => t.name));
  for (const name of REGISTERED_TOOL_NAMES) {
    assert.ok(stockNames.has(name), `STOCK_DISPATCH_TABLE registers "${name}" but the stock manifest has no entry for it`);
  }
});

test("manifest/backend (D-02 outputSchema presence): every stock manifest entry declares an outputSchema whose type is \"object\"", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const tool of stock.tools) {
    assert.ok(tool.outputSchema, `"${tool.name}" has no outputSchema at all`);
    assert.equal(tool.outputSchema!.type, "object", `"${tool.name}"'s outputSchema.type must be "object"`);
  }
});

test("manifest/backend (D-06 runState enum): every stock entry's outputSchema declares a required runState enum of [\"running\",\"stopped\",\"unknown\"]", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const tool of stock.tools) {
    const runState = tool.outputSchema?.properties?.runState as { type?: string; enum?: unknown[] } | undefined;
    assert.ok(runState, `"${tool.name}"'s outputSchema has no properties.runState`);
    assert.equal(runState!.type, "string", `"${tool.name}"'s runState property must be type "string"`);
    assert.deepEqual(runState!.enum, ["running", "stopped", "unknown"], `"${tool.name}"'s runState enum must be exactly ["running","stopped","unknown"]`);
    assert.ok(tool.outputSchema?.required?.includes("runState"), `"${tool.name}"'s outputSchema.required must include "runState"`);
  }
});

test("manifest/backend: every outputSchema itself uses only checkAgainstSchema's supported keyword subset", () => {
  // Verified by running checkAgainstSchema() over a small synthetic instance
  // built from each entry's OWN declared shape (a runState of "unknown" plus
  // a placeholder for every other declared property), rather than asserting
  // on the schema's raw keys a second time -- this also doubles as a
  // structural smoke test that checkAgainstSchema() itself does not choke on
  // any real manifest entry.
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const tool of stock.tools) {
    if (!tool.outputSchema) continue; // covered by the presence test above
    const instance = buildSyntheticInstance(tool.outputSchema);
    const violations = checkAgainstSchema(instance, tool.outputSchema);
    assert.deepEqual(violations, [], `"${tool.name}"'s outputSchema rejects its own synthetic instance: ${JSON.stringify(violations)}`);
  }
});

/**
 * Recursively builds a placeholder instance satisfying `schema`'s own
 * declared shape -- object properties are populated one level (or more)
 * deep by recursing into each property's OWN sub-schema, rather than a
 * single flat `placeholderFor(type)` pass. A shallow, single-level
 * placeholder (this test's original 03-12 shape) is not enough once an
 * outputSchema entry nests a `required` object inside a `properties` object
 * (e.g. vice_checkpoint_add's `operation` field) -- an empty `{}` placeholder
 * for that nested object trips its own `required` check. Arrays are left
 * empty deliberately: checkAgainstSchema()'s `items` check iterates the
 * array's own elements, so an empty array can never violate an `items`
 * sub-schema.
 */
function buildSyntheticInstance(schema: { type?: string; properties?: Record<string, { type?: string; properties?: Record<string, unknown>; enum?: unknown[] }>; enum?: unknown[] } | undefined): unknown {
  if (!schema || typeof schema !== "object") return null;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.type === "object") {
    const properties = schema.properties ?? {};
    const instance: Record<string, unknown> = {};
    for (const [propName, propSchema] of Object.entries(properties)) {
      instance[propName] = buildSyntheticInstance(propSchema as typeof schema);
    }
    return instance;
  }
  if (schema.type === "array") return [];
  return placeholderFor(schema.type);
}

function placeholderFor(type: string | undefined): unknown {
  switch (type) {
    case "string":
      return "placeholder";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return null;
  }
}

// The twelve tool names this phase's own planner decisions trim -- each
// entry names the decision id responsible, so a future re-addition is a
// deliberate edit rather than a silent regression.
const TRIMMED_TOOL_DECISIONS: Array<[string, string]> = [
  ["vice_checkpoint_set_ignore_count", "D-15"],
  ["vice_snapshot_list", "D-16"],
  ["vice_disk_detach", "D-13"],
  ["vice_joystick_tap", "cut from scope -- no skill calls it and no requirement names it"],
  ["vice_disk_read_sector", "CUT from scope 2026-08-17 -- no skill calls it"],
  ["vice_sid_get_state", "hard loss -- SID is write-only in hardware"],
  ["vice_key_press", "hard loss -- low-level keyboard family"],
  ["vice_key_release", "hard loss -- low-level keyboard family"],
  ["vice_keyboard_matrix", "hard loss -- low-level keyboard family"],
  ["vice_keyboard_chord", "hard loss -- low-level keyboard family"],
  ["vice_machine_config_get", "Phase 6"],
  ["vice_machine_config_set", "Phase 6"],
];

test("manifest/backend (trimmed tools absent): none of the twelve decision-trimmed tools appears in tools-manifest.stock.json", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const [name, decisionId] of TRIMMED_TOOL_DECISIONS) {
    assert.ok(!stock.tools.some((t) => t.name === name), `"${name}" must not appear in the stock manifest (${decisionId})`);
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
  resetRunStateTrackersForTest();
  // Task 3 (plan 03-13): the conformance harness below dispatches through
  // the real path, which means the family modules' own per-session/
  // per-target caches (bank catalog, register catalog, the D-10 condition
  // registry) are genuinely populated -- reset them here too so no
  // conformance case can observe a stale catalog left by a prior test.
  resetBankCatalogsForTest();
  resetRegisterCatalogsForTest();
  resetCheckpointStateForTest();
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
 * the defect under test, so the stub has to be able to tell the two apart.
 *
 * The client is a real `EventEmitter` (Task 1, plan 03-12), matching this
 * codebase's own DI-stub convention (stock-memory.test.ts's makeSession() et
 * al.) -- `attachRunStateTracker()` now calls `client.on("event", ...)` at
 * every fresh connect/reconnect this seam produces, so a plain object
 * literal with no `.on()` throws the moment ensureStockSession() attaches a
 * tracker to it. */
function fakeSession(opts: { targetId: string; host: string; port: number; brokerControl: FakeSessionBrokerControl; connected?: boolean }): StockConnectSession {
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
  const deps: StockDispatchDeps = {
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
  const deps: StockDispatchDeps = {
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
// Task 1 (plan 03-12): the runState tracker attach points (RESEARCH.md
// Pitfall 4) -- attached at exactly the two branches that produce a FRESH
// ViceMonitorClient, never in the `heldSession.client.connected` reuse
// branch. Every client below is the same real-EventEmitter fakeSession()
// stub every other test in this file uses; `listenerCount("event")` is the
// literal proof a second attach never registers a second listener.
// ---------------------------------------------------------------------------

test("runState/Pitfall4: a fresh connect attaches exactly one 'event' listener to the new client", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-tracker-1", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  };
  const outcome = await ensureStockSession(deps);
  assert.ok(outcome.ok);
  assert.equal(outcome.session.client.listenerCount("event"), 1);
});

test("runState/Pitfall4: a session-reuse call (same targetId, still connected) does NOT add a second listener", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-tracker-2", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockDispatchDeps = {
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
  const deps: StockDispatchDeps = {
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
// Task 1 (plan 03-12): withStockSession() -- the one adapter every table
// entry goes through.
// ---------------------------------------------------------------------------

test("withStockSession: returns convertHandshakeError's text when ensureStockSession throws MonitorOwnershipError", async () => {
  const handler: StockSessionHandler = async () => {
    throw new Error("must not be called -- the handshake itself failed");
  };
  const wrapped = withStockSession("vice_test_tool", handler);
  const deps: StockDispatchDeps = {
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

test("withStockSession: returns outcome.message verbatim on an { ok: false } refusal, without touching the handler", async () => {
  let handlerCalled = false;
  const handler: StockSessionHandler = async () => {
    handlerCalled = true;
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  const wrapped = withStockSession("vice_test_tool", handler);
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: false, message: "broker: dead_or_hung (verbatim message)" }),
  };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /broker: dead_or_hung \(verbatim message\)/);
  assert.equal(handlerCalled, false, "a refusal must never reach the delegated handler");
});

test("withStockSession: a family handler that throws yields isError:true rather than propagating", async () => {
  const handler: StockSessionHandler = async () => {
    throw new Error("boom: something the family handler let escape");
  };
  const wrapped = withStockSession("vice_test_tool", handler);
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-wss-3", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /vice_test_tool/);
  assert.match(JSON.stringify(result.content), /boom: something the family handler let escape/);
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

// ---------------------------------------------------------------------------
// Task 2 (plan 03-12): all 24 Phase 3 family tools plus vice_ping are
// registered in the ONE dispatch table, and the eight deliberately-absent
// tools are refused without ever touching `deps`.
// ---------------------------------------------------------------------------

/** The 38 tool names registered in STOCK_DISPATCH_TABLE (25 Phase 3 direct
 * tools, 04-05's vice_disassemble, Phase 5's eight DERIV-01/DERIV-04/
 * DERIV-05/DERIV-06 derived tools, and Phase 7's four TIME-01/TIME-02/TIME-04
 * derived tools -- vice_cycles_stopwatch, vice_run_until, vice_diagnose and
 * vice_recycle), driven from an explicit array literal (per this plan's own
 * acceptance criteria) so a missing entry fails as a NAMED assertion rather
 * than a generic count mismatch. */
const REGISTERED_TOOL_NAMES = [
  "vice_ping",
  "vice_memory_read",
  "vice_memory_write",
  "vice_memory_banks",
  "vice_registers_get",
  "vice_registers_set",
  "vice_registers_available",
  "vice_checkpoint_add",
  "vice_checkpoint_delete",
  "vice_checkpoint_list",
  "vice_checkpoint_toggle",
  "vice_checkpoint_set_condition",
  "vice_watch_add",
  "vice_execution_pause",
  "vice_execution_run",
  "vice_execution_step",
  "vice_execution_until_return",
  "vice_machine_reset",
  "vice_autostart",
  "vice_disk_attach",
  "vice_snapshot_save",
  "vice_snapshot_load",
  "vice_keyboard_type",
  "vice_keyboard_petscii",
  "vice_joystick_set",
  "vice_disassemble",
  "vice_memory_search",
  "vice_memory_compare",
  "vice_symbols_load",
  "vice_symbols_lookup",
  "vice_vicii_get_state",
  "vice_cia_get_state",
  "vice_sprite_get",
  "vice_sprite_inspect",
  "vice_cycles_stopwatch",
  "vice_run_until",
  "vice_diagnose",
  "vice_recycle",
];

/** The eight tools this plan deliberately does NOT register -- each name's
 * absence is a planner decision (see the block comment above
 * STOCK_DISPATCH_TABLE in stock-dispatch.ts), never an oversight. */
const DELIBERATELY_ABSENT_TOOL_NAMES = [
  "vice_checkpoint_set_ignore_count",
  "vice_snapshot_list",
  "vice_disk_detach",
  "vice_joystick_tap",
  "vice_disk_read_sector",
  "vice_sid_get_state",
  "vice_machine_config_get",
  "vice_machine_config_set",
];

test("dispatch: stockHandlerFor returns a function for every one of the 38 registered tool names", () => {
  for (const name of REGISTERED_TOOL_NAMES) {
    assert.equal(typeof stockHandlerFor(name), "function", `expected a handler for ${name}`);
  }
});

test("dispatch: the table's key count is exactly 38", () => {
  // STOCK_DISPATCH_TABLE itself is not exported -- stockHandlerFor() over
  // every name this plan knows about is the table's own public surface, so
  // this test drives the same 38-name list rather than reaching into the
  // module's private object.
  const hits = REGISTERED_TOOL_NAMES.filter((name) => typeof stockHandlerFor(name) === "function");
  assert.equal(hits.length, 38);
  assert.equal(REGISTERED_TOOL_NAMES.length, 38);
});

test("dispatch: every registered tool name matches /^vice_[a-z0-9_]+$/", () => {
  for (const name of REGISTERED_TOOL_NAMES) {
    assert.match(name, /^vice_[a-z0-9_]+$/, `${name} does not match the expected tool-name shape`);
  }
});

test("dispatch: stockHandlerFor returns undefined for every deliberately-absent tool name", () => {
  for (const name of DELIBERATELY_ABSENT_TOOL_NAMES) {
    assert.equal(stockHandlerFor(name), undefined, `expected NO handler for ${name}`);
  }
});

test("dispatch: dispatchStock refuses every deliberately-absent tool naming the tool and the fork backend, without reading deps", async () => {
  for (const name of DELIBERATELY_ABSENT_TOOL_NAMES) {
    const deps = {
      ensureLease: () => {
        throw new Error(`ensureLease must never be called for ${name} -- it has no dispatch entry`);
      },
    } as unknown as StockDispatchDeps;
    const result = await dispatchStock(name, {}, deps);
    assert.equal(result.isError, true);
    const text = JSON.stringify(result.content);
    assert.match(text, new RegExp(name));
    assert.match(text, /fork/i);
  }
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

test("ping: the success payload carries backend, viceVersion, resolvedBinaryPath, and runState (D-06)", async () => {
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
  // D-06/Task 1 (plan 03-12): vice_ping now answers through stockAnswer(), so
  // its answer carries runState alongside every field that was already
  // there. A fresh connect's tracker starts at "unknown" (D-07) -- no
  // stopped/resumed/jam event has arrived yet.
  assert.equal(payload.runState, "unknown");
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

// ---------------------------------------------------------------------------
// Task 3 (plan 03-13): the D-02 answer-conformance harness. Every one of the
// 25 stock tools is dispatched through dispatchStock() -- the REAL path,
// exercising withStockSession()'s adapter and stockAnswer()'s runState stamp
// -- against a stubbed session, never a family handler called directly. Each
// case's actual answer is validated against ITS OWN declared outputSchema in
// tools-manifest.stock.json. A completeness guard ties the case list to the
// manifest's own name list; a negative control proves checkAgainstSchema()
// is not vacuously passing.
// ---------------------------------------------------------------------------

const CONFORMANCE_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
} as unknown as BrokerControlSession;

type ConformanceSendImpl = (commandType: number, body: Buffer) => unknown;

/**
 * Builds a full StockConnectSession for the conformance harness: a real
 * EventEmitter client (so attachRunStateTracker()'s client.on("event", ...)
 * works unmodified) with a `send` stub driven by `sendImpl`, plus every
 * other StockConnectSession field ensureStockSession()/the family handlers
 * read. `preEmit`, when given, attaches the run-state tracker to THIS client
 * immediately (idempotent -- ensureStockSession()'s own later
 * attachRunStateTracker() call on the same client is then a no-op) and
 * emits one stopped/resumed event synchronously, so a handler's
 * runStateFor() read is never "unknown" for the execution-control cases
 * that refuse on it (D-07).
 */
function buildConformanceSession(targetId: string, sendImpl: ConformanceSendImpl, preEmit?: "stopped" | "resumed"): StockConnectSession {
  const client = Object.assign(new EventEmitter(), {
    connected: true,
    disconnect: async (): Promise<void> => {
      client.connected = false;
    },
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)) => sendImpl(commandType, body),
  });
  const session = {
    client: client as unknown as StockConnectSession["client"],
    versionQuad: "3.9.0",
    capabilities: { cpuHistory: "absent" as const },
    host: "127.0.0.1",
    port: 6502,
    targetId,
    brokerControl: CONFORMANCE_BROKER_CONTROL,
    deps: {},
    baselineEpoch: null,
  } as unknown as StockConnectSession;

  if (preEmit) {
    attachRunStateTracker(session.client);
    (session.client as unknown as EventEmitter).emit("event", {
      type: preEmit,
      requestId: 0xffffffff,
      errorCode: 0,
      programCounter: 0x0801,
    });
  }
  return session;
}

/** Builds the StockDispatchDeps for one conformance case: a fresh lease
 * (the session's own unique targetId, so ensureStockSession() never reuses
 * a DIFFERENT case's held session) and a `connect` stub that ignores the
 * lease's coordinates and hands back the pre-built session. */
function buildConformanceDeps(session: StockConnectSession): StockDispatchDeps {
  return {
    ensureLease: async () => ({
      ok: true as const,
      lease: {
        host: session.host,
        port: session.port,
        targetId: session.targetId,
        brokerControl: session.brokerControl,
        epochFile: "",
        supervisorDir: "",
      } as HeldLease,
    }),
    connect: async () => session,
  };
}

/** A generic acknowledgement reply -- the "unknown" parsed shape several
 * commands in this phase fall through to (stock-protocol.ts has no named
 * parsed shape for a bare ack), matching stock-memory.test.ts's own
 * ackReply() convention. */
function conformanceAckReply(responseType: number) {
  return { type: "unknown" as const, requestId: 1, errorCode: 0, responseType, related: [] };
}

interface FakeCheckpointFields {
  id: number;
  currentlyHit: boolean;
  start: number;
  end: number;
  stopWhenHit: boolean;
  enabled: boolean;
  operation: number;
  temporary: boolean;
  hitCount: number;
  ignoreCount: number;
  hasCondition: boolean;
}

/** A minimal, schema-valid ParsedCheckpoint -- reused by both
 * vice_checkpoint_add and vice_watch_add's CHECKPOINT_SET replies, and by
 * vice_checkpoint_list's N+1 `related` frame. */
function fakeConformanceCheckpoint(overrides: Partial<FakeCheckpointFields> = {}): FakeCheckpointFields {
  return {
    id: 1,
    currentlyHit: false,
    start: 0xc000,
    end: 0xc000,
    stopWhenHit: true,
    enabled: true,
    operation: 0x04, // CheckpointOperation.Exec
    temporary: false,
    hitCount: 0,
    ignoreCount: 0,
    hasCondition: false,
    ...overrides,
  };
}

function checkpointInfoReply(checkpoint: FakeCheckpointFields = fakeConformanceCheckpoint()) {
  return { type: "checkpoint_info" as const, requestId: 1, errorCode: 0, checkpoint, related: [] };
}

/** Stands in for stock-machine.test.ts's own withTempRepoRoot(): a fresh
 * mkdtempSync() directory stands in for the repo root (CLAUDE_PROJECT_DIR
 * unconditionally wins repoRoot()'s precedence ladder), so
 * vice_snapshot_save/vice_snapshot_load's real filesystem reads/writes never
 * touch this worktree's own tree. */
async function withTempRepoRootForConformance<T>(fn: (repoRootDir: string) => Promise<T>): Promise<T> {
  // realpathSync is load-bearing, not tidiness (05-SECURITY.md W-03, 2026-08-17):
  // `vice_symbols_load` now reports the fully-canonical path it containment-checked
  // (WR-08), so the `resolvedPath.startsWith(repoRootDir)` assertion below only holds
  // if this stand-in root is canonical too. `tmpdir()` is itself a symlink on macOS
  // (`/var/folders/...` -> `/private/var/folders/...`), where the un-canonicalised
  // spelling would make that assertion fail on a correct implementation. Linux-only
  // CI hides this today; do not "simplify" it away.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "vice-conformance-test-")));
  const prev = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = dir;
  try {
    return await fn(dir);
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prev;
    rmSync(dir, { recursive: true, force: true });
  }
}

// vice_autostart/vice_disk_attach/vice_snapshot_save/vice_snapshot_load all
// route their filename through withEmulatorSidePath() (stock-paths.ts),
// which branches on isInsideContainer() -- forced false here (matching
// stock-machine.test.ts's own precedent) so every one of these four cases
// takes the deterministic bare-host "send(containerPath) directly" branch,
// never the mountinfo-guessing container branch a real container would
// need. Restored after this whole file's tests finish.
setIsInsideContainerForTest(() => false);
after(() => setIsInsideContainerForTest(null));

/** Shared post-dispatch assertions every conformance case makes: the real
 * dispatchStock() answer must be a success, must validate against the
 * manifest's own declared outputSchema for that tool, and its runState must
 * be one of the three allowed values -- checked independently of the schema
 * (a broken schema could otherwise mask a broken runState). */
function assertAnswerConforms(toolName: string, result: StockToolResult): void {
  assert.equal(result.isError, false, `"${toolName}" must answer isError:false against its conformance stub -- got: ${JSON.stringify(result.content)}`);
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const entry = stock.tools.find((t) => t.name === toolName);
  assert.ok(entry?.outputSchema, `"${toolName}" must have a manifest entry with an outputSchema`);
  const parsed: Record<string, unknown> = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
  const violations = checkAgainstSchema(parsed, entry!.outputSchema);
  assert.deepEqual(violations, [], `"${toolName}"'s real answer violates its own declared outputSchema: ${JSON.stringify(violations)}`);
  assert.ok(
    parsed.runState === "running" || parsed.runState === "stopped" || parsed.runState === "unknown",
    `"${toolName}"'s runState must be one of running/stopped/unknown (independent check of D-06), got ${JSON.stringify(parsed.runState)}`,
  );
}

// The completeness guard's own registry -- populated synchronously as each
// conformanceTest() call below registers, so the guard test (which runs
// later, at actual test-execution time) sees the complete list regardless
// of test execution order.
const CONFORMANCE_TOOL_NAMES: string[] = [];

/** Registers one conformance test AND records its tool name in
 * CONFORMANCE_TOOL_NAMES -- the one place both happen together, so the
 * completeness guard below can never drift from the actual set of
 * registered cases. */
function conformanceTest(toolName: string, run: () => Promise<void>): void {
  CONFORMANCE_TOOL_NAMES.push(toolName);
  test(`conformance (D-02): dispatchStock("${toolName}", ...) answers, validating against its own declared outputSchema`, run);
}

// --------------------------------------------------------- memory

conformanceTest("vice_memory_read", async () => {
  const session = buildConformanceSession("conformance-vice_memory_read", (commandType) => {
    if (commandType === CommandType.MemoryGet) {
      return { type: "memory_get" as const, requestId: 1, errorCode: 0, bytes: Uint8Array.from([0x4c, 0x00]), related: [] };
    }
    throw new Error(`vice_memory_read: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_memory_read", { address: "$1000", size: 2 }, deps);
  assertAnswerConforms("vice_memory_read", result);
});

conformanceTest("vice_memory_write", async () => {
  const session = buildConformanceSession("conformance-vice_memory_write", (commandType) => {
    if (commandType === CommandType.MemorySet) {
      return conformanceAckReply(CommandType.MemorySet);
    }
    throw new Error(`vice_memory_write: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_memory_write", { address: "$1000", data: [0x01, 0x02] }, deps);
  assertAnswerConforms("vice_memory_write", result);
});

conformanceTest("vice_memory_banks", async () => {
  const session = buildConformanceSession("conformance-vice_memory_banks", (commandType) => {
    if (commandType === CommandType.BanksAvailable) {
      return { type: "banks_available" as const, requestId: 1, errorCode: 0, banks: [{ id: 0, name: "default" }], related: [] };
    }
    throw new Error(`vice_memory_banks: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_memory_banks", {}, deps);
  assertAnswerConforms("vice_memory_banks", result);
});

// --------------------------------------------------------- vice_memory_search / vice_memory_compare (05-01, DERIV-01)

conformanceTest("vice_memory_search", async () => {
  const session = buildConformanceSession("conformance-vice_memory_search", (commandType) => {
    if (commandType === CommandType.MemoryGet) {
      // $1000-$100f inclusive is 16 bytes -- a short read is refused as a
      // wrong answer (never a partial success), so the fixture must match
      // the requested range's length exactly.
      return { type: "memory_get" as const, requestId: 1, errorCode: 0, bytes: Uint8Array.from([0x4c, 0x00, 0xa0, 0xea, 0xea, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), related: [] };
    }
    throw new Error(`vice_memory_search: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_memory_search", { start: "$1000", end: "$100f", pattern: [0x4c] }, deps);
  assertAnswerConforms("vice_memory_search", result);
});

conformanceTest("vice_memory_compare", async () => {
  let calls = 0;
  const session = buildConformanceSession("conformance-vice_memory_compare", (commandType) => {
    if (commandType === CommandType.MemoryGet) {
      calls += 1;
      const bytes = calls === 1 ? Uint8Array.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]) : Uint8Array.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x09]);
      return { type: "memory_get" as const, requestId: 1, errorCode: 0, bytes, related: [] };
    }
    throw new Error(`vice_memory_compare: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_memory_compare", { mode: "ranges", range1_start: "$1000", range1_end: "$1007", range2_start: "$2000" }, deps);
  assertAnswerConforms("vice_memory_compare", result);
  assert.equal(calls, 2, "vice_memory_compare must answer exactly two MemoryGet calls, one per range");
});

// --------------------------------------------------------- registers

conformanceTest("vice_registers_get", async () => {
  const session = buildConformanceSession("conformance-vice_registers_get", (commandType) => {
    if (commandType === CommandType.RegistersAvailable) {
      return { type: "registers_available" as const, requestId: 1, errorCode: 0, registers: [{ id: 0, size: 16, name: "PC" }], related: [] };
    }
    if (commandType === CommandType.RegistersGet) {
      return { type: "registers" as const, requestId: 2, errorCode: 0, registers: [{ id: 0, value: 0x0801 }], related: [] };
    }
    throw new Error(`vice_registers_get: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_registers_get", {}, deps);
  assertAnswerConforms("vice_registers_get", result);
});

conformanceTest("vice_registers_set", async () => {
  const session = buildConformanceSession("conformance-vice_registers_set", (commandType) => {
    if (commandType === CommandType.RegistersAvailable) {
      return { type: "registers_available" as const, requestId: 1, errorCode: 0, registers: [{ id: 0, size: 16, name: "PC" }], related: [] };
    }
    if (commandType === CommandType.RegistersSet) {
      return { type: "registers" as const, requestId: 2, errorCode: 0, registers: [{ id: 0, value: 0x0801 }], related: [] };
    }
    throw new Error(`vice_registers_set: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_registers_set", { register: "PC", value: 0x0801 }, deps);
  assertAnswerConforms("vice_registers_set", result);
});

conformanceTest("vice_registers_available", async () => {
  const session = buildConformanceSession("conformance-vice_registers_available", (commandType) => {
    if (commandType === CommandType.RegistersAvailable) {
      return { type: "registers_available" as const, requestId: 1, errorCode: 0, registers: [{ id: 0, size: 16, name: "PC" }], related: [] };
    }
    throw new Error(`vice_registers_available: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_registers_available", {}, deps);
  assertAnswerConforms("vice_registers_available", result);
});

// --------------------------------------------------------- checkpoints and watchpoints

conformanceTest("vice_checkpoint_add", async () => {
  const session = buildConformanceSession("conformance-vice_checkpoint_add", (commandType) => {
    if (commandType === CommandType.CheckpointSet) {
      return checkpointInfoReply();
    }
    throw new Error(`vice_checkpoint_add: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_checkpoint_add", { start: "$c000" }, deps);
  assertAnswerConforms("vice_checkpoint_add", result);
});

conformanceTest("vice_checkpoint_delete", async () => {
  const session = buildConformanceSession("conformance-vice_checkpoint_delete", (commandType) => {
    if (commandType === CommandType.CheckpointDelete) {
      return conformanceAckReply(CommandType.CheckpointDelete);
    }
    throw new Error(`vice_checkpoint_delete: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_checkpoint_delete", { checkpoint_num: 1 }, deps);
  assertAnswerConforms("vice_checkpoint_delete", result);
});

conformanceTest("vice_checkpoint_list", async () => {
  const session = buildConformanceSession("conformance-vice_checkpoint_list", (commandType) => {
    if (commandType === CommandType.CheckpointList) {
      // A non-empty `related` array -- the N+1 accumulation path this plan's
      // own Task 3 action explicitly calls out to exercise.
      return { type: "checkpoint_list" as const, requestId: 1, errorCode: 0, total: 1, checkpoints: [], related: [checkpointInfoReply()] };
    }
    throw new Error(`vice_checkpoint_list: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_checkpoint_list", {}, deps);
  assertAnswerConforms("vice_checkpoint_list", result);
});

conformanceTest("vice_checkpoint_toggle", async () => {
  const session = buildConformanceSession("conformance-vice_checkpoint_toggle", (commandType) => {
    if (commandType === CommandType.CheckpointToggle) {
      return conformanceAckReply(CommandType.CheckpointToggle);
    }
    throw new Error(`vice_checkpoint_toggle: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_checkpoint_toggle", { checkpoint_num: 1, enabled: true }, deps);
  assertAnswerConforms("vice_checkpoint_toggle", result);
});

conformanceTest("vice_checkpoint_set_condition", async () => {
  const session = buildConformanceSession("conformance-vice_checkpoint_set_condition", (commandType) => {
    if (commandType === CommandType.ConditionSet) {
      return conformanceAckReply(CommandType.ConditionSet);
    }
    throw new Error(`vice_checkpoint_set_condition: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_checkpoint_set_condition", { checkpoint_num: 1, condition: "A == $42" }, deps);
  assertAnswerConforms("vice_checkpoint_set_condition", result);
});

conformanceTest("vice_watch_add", async () => {
  const session = buildConformanceSession("conformance-vice_watch_add", (commandType) => {
    if (commandType === CommandType.CheckpointSet) {
      return checkpointInfoReply(fakeConformanceCheckpoint({ operation: 0x02 })); // CheckpointOperation.Store (default watchType "write")
    }
    throw new Error(`vice_watch_add: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_watch_add", { address: "$c000" }, deps);
  assertAnswerConforms("vice_watch_add", result);
});

// --------------------------------------------------------- execution

conformanceTest("vice_execution_pause", async () => {
  const session = buildConformanceSession(
    "conformance-vice_execution_pause",
    (commandType) => {
      if (commandType === CommandType.Ping) {
        return conformanceAckReply(CommandType.Ping);
      }
      throw new Error(`vice_execution_pause: unexpected commandType ${commandType}`);
    },
    "resumed", // known "running" pre-state, so this exercises the sent:true path
  );
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_execution_pause", {}, deps);
  assertAnswerConforms("vice_execution_pause", result);
});

conformanceTest("vice_execution_run", async () => {
  const session = buildConformanceSession(
    "conformance-vice_execution_run",
    (commandType) => {
      if (commandType === CommandType.Exit) {
        return conformanceAckReply(CommandType.Exit);
      }
      throw new Error(`vice_execution_run: unexpected commandType ${commandType}`);
    },
    "stopped", // known "stopped" pre-state, so this exercises the sent:true path
  );
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_execution_run", {}, deps);
  assertAnswerConforms("vice_execution_run", result);
});

conformanceTest("vice_execution_step", async () => {
  const session = buildConformanceSession(
    "conformance-vice_execution_step",
    (commandType) => {
      if (commandType === CommandType.AdvanceInstructions) {
        return conformanceAckReply(CommandType.AdvanceInstructions);
      }
      throw new Error(`vice_execution_step: unexpected commandType ${commandType}`);
    },
    "stopped", // D-07: a known state is required, or the handler refuses
  );
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_execution_step", {}, deps);
  assertAnswerConforms("vice_execution_step", result);
});

conformanceTest("vice_execution_until_return", async () => {
  const session = buildConformanceSession(
    "conformance-vice_execution_until_return",
    (commandType) => {
      if (commandType === CommandType.ExecuteUntilReturn) {
        return conformanceAckReply(CommandType.ExecuteUntilReturn);
      }
      throw new Error(`vice_execution_until_return: unexpected commandType ${commandType}`);
    },
    "stopped", // D-07: a known state is required, or the handler refuses
  );
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_execution_until_return", {}, deps);
  assertAnswerConforms("vice_execution_until_return", result);
});

// --------------------------------------------------------- machine

conformanceTest("vice_machine_reset", async () => {
  const session = buildConformanceSession("conformance-vice_machine_reset", (commandType) => {
    if (commandType === CommandType.Reset) {
      return conformanceAckReply(CommandType.Reset);
    }
    throw new Error(`vice_machine_reset: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_machine_reset", {}, deps);
  assertAnswerConforms("vice_machine_reset", result);
});

conformanceTest("vice_autostart", async () => {
  const session = buildConformanceSession("conformance-vice_autostart", (commandType) => {
    if (commandType === CommandType.AutoStart) {
      return conformanceAckReply(CommandType.AutoStart);
    }
    throw new Error(`vice_autostart: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_autostart", { path: "/workspace/game.prg" }, deps);
  assertAnswerConforms("vice_autostart", result);
});

conformanceTest("vice_disk_attach", async () => {
  const session = buildConformanceSession("conformance-vice_disk_attach", (commandType) => {
    if (commandType === CommandType.AutoStart) {
      return conformanceAckReply(CommandType.AutoStart);
    }
    throw new Error(`vice_disk_attach: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_disk_attach", { unit: 8, path: "/workspace/disk.d64" }, deps);
  assertAnswerConforms("vice_disk_attach", result);
});

conformanceTest("vice_snapshot_save", async () => {
  await withTempRepoRootForConformance(async () => {
    const session = buildConformanceSession("conformance-vice_snapshot_save", (commandType) => {
      if (commandType === CommandType.Dump) {
        return conformanceAckReply(CommandType.Dump);
      }
      throw new Error(`vice_snapshot_save: unexpected commandType ${commandType}`);
    });
    const deps = buildConformanceDeps(session);
    const result = await dispatchStock("vice_snapshot_save", { name: "conformance_snapshot" }, deps);
    assertAnswerConforms("vice_snapshot_save", result);
  });
});

conformanceTest("vice_snapshot_load", async () => {
  await withTempRepoRootForConformance(async (dir) => {
    mkdirSync(join(dir, ".vice-snapshots"), { recursive: true });
    writeFileSync(join(dir, ".vice-snapshots", "conformance_snapshot.vsf"), "");
    const session = buildConformanceSession("conformance-vice_snapshot_load", (commandType) => {
      if (commandType === CommandType.Undump) {
        return { type: "undump" as const, requestId: 1, errorCode: 0, programCounter: 0x0801, related: [] };
      }
      throw new Error(`vice_snapshot_load: unexpected commandType ${commandType}`);
    });
    const deps = buildConformanceDeps(session);
    const result = await dispatchStock("vice_snapshot_load", { name: "conformance_snapshot" }, deps);
    assertAnswerConforms("vice_snapshot_load", result);
  });
});

// --------------------------------------------------------- input (keyboard, joystick)

conformanceTest("vice_keyboard_type", async () => {
  const session = buildConformanceSession("conformance-vice_keyboard_type", (commandType) => {
    if (commandType === CommandType.KeyboardFeed) {
      return conformanceAckReply(CommandType.KeyboardFeed);
    }
    throw new Error(`vice_keyboard_type: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_keyboard_type", { text: "RUN" }, deps);
  assertAnswerConforms("vice_keyboard_type", result);
});

conformanceTest("vice_keyboard_petscii", async () => {
  const session = buildConformanceSession("conformance-vice_keyboard_petscii", (commandType) => {
    if (commandType === CommandType.KeyboardFeed) {
      return conformanceAckReply(CommandType.KeyboardFeed);
    }
    throw new Error(`vice_keyboard_petscii: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_keyboard_petscii", { data: [0x52, 0x55, 0x4e, 0x0d] }, deps);
  assertAnswerConforms("vice_keyboard_petscii", result);
});

conformanceTest("vice_joystick_set", async () => {
  const session = buildConformanceSession("conformance-vice_joystick_set", (commandType) => {
    if (commandType === CommandType.JoyportSet) {
      return conformanceAckReply(CommandType.JoyportSet);
    }
    throw new Error(`vice_joystick_set: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_joystick_set", { port: 1, direction: "up", fire: true }, deps);
  assertAnswerConforms("vice_joystick_set", result);
});

// --------------------------------------------------------- vice_disassemble (04-05, DERIV-07/DISASM-01)

/** 30 NOP ($ea) bytes -- enough to decode into 10 one-byte instructions
 * (the default count), never truncated, so the conformance case exercises
 * the ordinary success path through decode()/render() rather than a
 * boundary case (those live in stock-disassemble.test.ts). */
function conformanceDisassembleBytes(): Uint8Array {
  return Uint8Array.from(new Array(30).fill(0xea));
}

conformanceTest("vice_disassemble", async () => {
  const session = buildConformanceSession("conformance-vice_disassemble", (commandType) => {
    if (commandType === CommandType.MemoryGet) {
      return { type: "memory_get" as const, requestId: 1, errorCode: 0, bytes: conformanceDisassembleBytes(), related: [] };
    }
    throw new Error(`vice_disassemble: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_disassemble", { address: "$1000" }, deps);
  assertAnswerConforms("vice_disassemble", result);
});

test("end-to-end (criterion 1, D-02): vice_disassemble succeeds through the REAL dispatchStock() path under a translating environment -- the derived path never reaches host-path translation", async () => {
  const prevHostWs = process.env.HOST_WORKSPACE_PATH;
  const prevProjectDir = process.env.CLAUDE_PROJECT_DIR;
  process.env.HOST_WORKSPACE_PATH = "/home/user/project";
  process.env.CLAUDE_PROJECT_DIR = "/workspace";
  try {
    const session = buildConformanceSession("conformance-vice_disassemble-e2e", (commandType) => {
      if (commandType === CommandType.MemoryGet) {
        return { type: "memory_get" as const, requestId: 1, errorCode: 0, bytes: conformanceDisassembleBytes(), related: [] };
      }
      throw new Error(`vice_disassemble: unexpected commandType ${commandType}`);
    });
    const deps = buildConformanceDeps(session);
    const result = await dispatchStock("vice_disassemble", { address: "$1000" }, deps);
    assert.equal(
      result.isError,
      false,
      "vice_disassemble must answer a normal success under a translating environment -- a derived tool never reaches hostpath.ts's translation at all",
    );
  } finally {
    if (prevHostWs === undefined) delete process.env.HOST_WORKSPACE_PATH;
    else process.env.HOST_WORKSPACE_PATH = prevHostWs;
    if (prevProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prevProjectDir;
  }
});

// --------------------------------------------------------- vice_symbols_load / vice_symbols_lookup (05-02, DERIV-04)

/** The exact ACME-`--vicelabels`-shaped fixture recorded in 05-02-SUMMARY.md
 * -- reused verbatim so this conformance case's answer counts match that
 * plan's own documented answer key (symbolCount: 4, duplicateNames: 1,
 * skippedLines: 3, lineCount: 8). */
const SYMBOLS_FIXTURE = `al C:0810 .main
al C:d020 .vic_cborder
al C:FFD2 .chrout

; this is not a label
break $0810
al C:0900 .main
al C:0810 .entry
`;

conformanceTest("vice_symbols_load", async () => {
  await withTempRepoRootForConformance(async (repoRootDir) => {
    writeFileSync(join(repoRootDir, "labels.lbl"), SYMBOLS_FIXTURE);
    const deps: StockDispatchDeps = { ensureLease: THROWING_ENSURE_LEASE };
    const result = await dispatchStock("vice_symbols_load", { path: "labels.lbl" }, deps);
    assertAnswerConforms("vice_symbols_load", result);
    resetSymbolStoreForTest();
  });
});

conformanceTest("vice_symbols_lookup", async () => {
  await withTempRepoRootForConformance(async (repoRootDir) => {
    writeFileSync(join(repoRootDir, "labels.lbl"), SYMBOLS_FIXTURE);
    const loadDeps: StockDispatchDeps = { ensureLease: THROWING_ENSURE_LEASE };
    const loadResult = await dispatchStock("vice_symbols_load", { path: "labels.lbl" }, loadDeps);
    assert.equal(loadResult.isError, false, "the fixture load must succeed before this case looks anything up");

    const deps: StockDispatchDeps = { ensureLease: THROWING_ENSURE_LEASE };
    const result = await dispatchStock("vice_symbols_lookup", { name: "main" }, deps);
    assertAnswerConforms("vice_symbols_lookup", result);
    resetSymbolStoreForTest();
  });
});

test("end-to-end (criterion 1, D-02): vice_symbols_load succeeds through the REAL dispatchStock() path under a translating environment -- resolvedPath stays container-side", async () => {
  const prevHostWs = process.env.HOST_WORKSPACE_PATH;
  process.env.HOST_WORKSPACE_PATH = "/home/user/project";
  try {
    await withTempRepoRootForConformance(async (repoRootDir) => {
      // withTempRepoRootForConformance already sets CLAUDE_PROJECT_DIR to
      // repoRootDir (a DIFFERENT absolute path than HOST_WORKSPACE_PATH
      // above) and restores it in its own finally block -- this test only
      // needs to manage HOST_WORKSPACE_PATH around the call.
      writeFileSync(join(repoRootDir, "labels.lbl"), SYMBOLS_FIXTURE);
      const deps: StockDispatchDeps = { ensureLease: THROWING_ENSURE_LEASE };
      const result = await dispatchStock("vice_symbols_load", { path: "labels.lbl" }, deps);
      assert.equal(
        result.isError,
        false,
        "vice_symbols_load must answer a normal success under a translating environment -- the derived path never reaches host-path translation",
      );
      const parsed: Record<string, unknown> = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
      const resolvedPath = parsed.resolvedPath as string;
      assert.ok(
        resolvedPath.startsWith(repoRootDir),
        `resolvedPath must resolve inside CLAUDE_PROJECT_DIR (${repoRootDir}), got ${resolvedPath}`,
      );
      assert.ok(
        !resolvedPath.includes("/home/user/project"),
        `resolvedPath must never contain the HOST_WORKSPACE_PATH value, got ${resolvedPath}`,
      );
      resetSymbolStoreForTest();
    });
  } finally {
    if (prevHostWs === undefined) delete process.env.HOST_WORKSPACE_PATH;
    else process.env.HOST_WORKSPACE_PATH = prevHostWs;
  }
});

// --------------------------------------------------------- vice_vicii_get_state / vice_cia_get_state / vice_sprite_get / vice_sprite_inspect (05-03/05-04/05-05, DERIV-05/DERIV-06)

/** Dispatches a MEM_GET reply by the request's own `start` address
 * (`body.readUInt16LE(1)`, matching memGetBody()'s own encoding at
 * stock-protocol.ts:494) rather than one fixed reply for every call -- all
 * four of these handlers issue MULTIPLE reads of different ranges, so a
 * single fixed reply would let a wrong-address bug pass silently. Also
 * answers CommandType.BanksAvailable (05-09, CR-01) -- vice_vicii_get_state
 * and vice_cia_get_state now resolve the `io` bank through
 * resolveRequiredBank() before every MEM_GET, so this stub must answer that
 * lookup too. The catalog observed live on VICE 3.9 -- with `io`
 * deliberately a NON-ZERO id (3) so a regression back to bank 0x0000 cannot
 * pass. Throws on an unmapped start address or an unexpected commandType so
 * an unexpected read is a loud test failure, never a silent empty buffer. */
function chipStateSendImpl(map: Map<number, number[]>): ConformanceSendImpl {
  return (commandType, body) => {
    if (commandType === CommandType.BanksAvailable) {
      return {
        type: "banks_available" as const,
        requestId: 1,
        errorCode: 0,
        banks: [
          { id: 0, name: "default" },
          { id: 0, name: "cpu" },
          { id: 1, name: "ram" },
          { id: 2, name: "rom" },
          { id: 3, name: "io" },
          { id: 4, name: "cart" },
        ],
        related: [],
      };
    }
    if (commandType !== CommandType.MemoryGet) {
      throw new Error(`chipStateSendImpl: unexpected commandType ${commandType}`);
    }
    const start = body.readUInt16LE(1);
    const bytes = map.get(start);
    if (bytes === undefined) {
      throw new Error(`chipStateSendImpl: unmapped start address 0x${start.toString(16)} -- a read at an unexpected address must fail loudly`);
    }
    return { type: "memory_get" as const, requestId: 1, errorCode: 0, bytes: Uint8Array.from(bytes), related: [] };
  };
}

conformanceTest("vice_vicii_get_state", async () => {
  const viciiBytes = new Array(47).fill(0);
  viciiBytes[0x18] = 0x31; // $D018 -- arbitrary but non-zero, exercising memorySetup's decode
  const session = buildConformanceSession("conformance-vice_vicii_get_state", chipStateSendImpl(new Map([[0xd000, viciiBytes]])));
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_vicii_get_state", {}, deps);
  assertAnswerConforms("vice_vicii_get_state", result);

  // Belt-and-braces (T-05-07-02): the schema pin and the REAL answer must
  // agree through the real dispatch path, not only in stock-vicii.test.ts.
  const parsed: Record<string, unknown> = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
  const unavailable = parsed.unavailable as Record<string, { available: boolean; reason: string }>;
  for (const name of ["rasterIrqLine", "videoCounter", "rowCounter", "badLineCondition", "borderFlipFlops", "spriteDmaState"]) {
    assert.equal(unavailable[name]?.available, false, `vice_vicii_get_state's unavailable.${name}.available must be false`);
    assert.ok(
      typeof unavailable[name]?.reason === "string" && unavailable[name]!.reason.length > 0,
      `vice_vicii_get_state's unavailable.${name}.reason must be a non-empty string`,
    );
  }

  // CR-01 (05-09): the answer must state which bank it read, resolved
  // through the emulator's own catalog -- never a hardcoded 0x0000.
  const bank = parsed.bank as { id: number; name: string };
  assert.equal(bank.name, "io", "vice_vicii_get_state's bank.name must be \"io\"");
  assert.equal(bank.id, 3, "vice_vicii_get_state's bank.id must be the stub catalog's io id (3)");
});

conformanceTest("vice_cia_get_state", async () => {
  const cia1Bytes = new Array(16).fill(0);
  const cia2Bytes = new Array(16).fill(0);
  const session = buildConformanceSession(
    "conformance-vice_cia_get_state",
    chipStateSendImpl(
      new Map([
        [0xdc00, cia1Bytes],
        [0xdd00, cia2Bytes],
      ]),
    ),
  );
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_cia_get_state", {}, deps);
  assertAnswerConforms("vice_cia_get_state", result);

  // Belt-and-braces (T-05-07-02): both chips' unavailable pins must agree
  // with the real answer through the real dispatch path.
  const parsed: Record<string, unknown> = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
  const cias = parsed.cias as Record<string, unknown>[];
  assert.equal(cias.length, 2, "vice_cia_get_state with {} (both chips) must return a two-element cias array");
  for (const chipEntry of cias) {
    const unavailable = chipEntry.unavailable as Record<string, { available: boolean; reason: string }>;
    for (const name of ["timerALatch", "timerBLatch", "interruptEnableMask", "todAlarmTime", "todLatchState"]) {
      assert.equal(unavailable[name]?.available, false, `vice_cia_get_state's cias[].unavailable.${name}.available must be false`);
      assert.ok(
        typeof unavailable[name]?.reason === "string" && unavailable[name]!.reason.length > 0,
        `vice_cia_get_state's cias[].unavailable.${name}.reason must be a non-empty string`,
      );
    }
  }

  // CR-01 (05-09): the answer must state which bank it read, resolved
  // through the emulator's own catalog -- never a hardcoded 0x0000.
  const bank = parsed.bank as { id: number; name: string };
  assert.equal(bank.name, "io", "vice_cia_get_state's bank.name must be \"io\"");
  assert.equal(bank.id, 3, "vice_cia_get_state's bank.id must be the stub catalog's io id (3)");
});

/** The same $DD00=193 (0xC1) / $D018=0x31 pair 05-05's own stock-sprites.test.ts
 * verifies against dump-artifacts.mjs's committed fixture, so the pointer
 * table (36856) and sprite 0's data address (40960) are the SAME constants in
 * two independent test files -- a drift in the arithmetic fails both. */
function spriteConformanceFixtures(): { vicii: number[]; dd00: number[]; pointers: number[]; data: number[] } {
  const vicii = new Array(47).fill(0);
  vicii[0x18] = 0x31; // $D018
  return {
    vicii,
    dd00: [0xc1], // $DD00 = 193
    pointers: [0x80, 0, 0, 0, 0, 0, 0, 0], // sprite 0's pointer byte -> dataAddress 40960
    data: new Array(63).fill(0),
  };
}

conformanceTest("vice_sprite_get", async () => {
  const { vicii, dd00, pointers } = spriteConformanceFixtures();
  const session = buildConformanceSession(
    "conformance-vice_sprite_get",
    chipStateSendImpl(
      new Map([
        [0xd000, vicii],
        [0xdd00, dd00],
        [36856, pointers],
      ]),
    ),
  );
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_sprite_get", {}, deps);
  assertAnswerConforms("vice_sprite_get", result);
  const parsed: Record<string, unknown> = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
  assert.equal(parsed.pointerTableAddress, 36856, "the resolved pointer table address must match the $DD00/$D018 fixture pair");
  const sprites = parsed.sprites as Record<string, unknown>[];
  assert.equal(sprites[0]!.dataAddress, 40960, "sprite 0's resolved dataAddress must match the fixture's pointer byte");
});

conformanceTest("vice_sprite_inspect", async () => {
  const { vicii, dd00, pointers, data } = spriteConformanceFixtures();
  const session = buildConformanceSession(
    "conformance-vice_sprite_inspect",
    chipStateSendImpl(
      new Map([
        [0xd000, vicii],
        [0xdd00, dd00],
        [36856, pointers],
        [40960, data],
      ]),
    ),
  );
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_sprite_inspect", { sprite_number: 0 }, deps);
  assertAnswerConforms("vice_sprite_inspect", result);
  const parsed: Record<string, unknown> = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
  assert.equal(parsed.dataAddress, 40960, "sprite 0's resolved dataAddress must match the fixture's pointer byte");
});

test("structure: stock-dispatch.ts contains zero CODE references to the fork-forwarding function's name, pairing the vice-proxy.ts structural assertion above with this module's own", () => {
  // Same filtering VICE_PROXY_CODE_LINES uses above -- strips both `//` line
  // comments and `*` block-comment continuation lines, since stock-dispatch.ts's
  // own withDerivedTool() docblock names the function IN PROSE (explaining
  // the hazard it exists to prevent), which is not a code reference.
  const src = readFileSync(join(HERE, "stock-dispatch.ts"), "utf8");
  const codeLines = src.split("\n").filter((line) => !/^\s*\*/.test(line) && !/^\s*\/\//.test(line));
  const offenders = codeLines.filter((line) => line.includes("forwardToVice"));
  assert.equal(offenders.length, 0, `found a forwardToVice reference in stock-dispatch.ts: ${JSON.stringify(offenders)}`);
});

// --------------------------------------------------------- vice_ping

conformanceTest("vice_ping", async () => {
  const session = buildConformanceSession("conformance-vice_ping", () => {
    throw new Error("vice_ping's handler must never call client.send()");
  });
  const deps: StockDispatchDeps = {
    ...buildConformanceDeps(session),
    resolvedBinaryPath: "/usr/local/bin/x64sc",
    resolvedBinaryPathIsResolved: true,
  };
  const result = await dispatchStock("vice_ping", {}, deps);
  assertAnswerConforms("vice_ping", result);
});

// --------------------------------------------------------- timing (Phase 7, TIME-01/TIME-02)

conformanceTest("vice_cycles_stopwatch", async () => {
  // buildConformanceSession()'s capabilities.cpuHistory is always "absent",
  // so this case exercises Route B (frame-position reconstruction via
  // REGISTERS_AVAILABLE/REGISTERS_GET), not Route A (CPUHISTORY_GET) --
  // dispatched with action:"reset", the action that produces an ok answer
  // with no prior baseline needed.
  const session = buildConformanceSession("conformance-vice_cycles_stopwatch", (commandType) => {
    if (commandType === CommandType.RegistersAvailable) {
      return {
        type: "registers_available" as const,
        requestId: 1,
        errorCode: 0,
        registers: [
          { id: 0, size: 16, name: "PC" },
          { id: 1, size: 16, name: "LIN" },
          { id: 2, size: 8, name: "CYC" },
        ],
        related: [],
      };
    }
    if (commandType === CommandType.RegistersGet) {
      return {
        type: "registers" as const,
        requestId: 2,
        errorCode: 0,
        registers: [
          { id: 0, value: 0x0801 },
          { id: 1, value: 100 },
          { id: 2, value: 20 },
        ],
        related: [],
      };
    }
    if (commandType === CommandType.ResourceGet) {
      return { type: "resource_get" as const, requestId: 3, errorCode: 0, valueType: "integer" as const, value: 1 };
    }
    throw new Error(`vice_cycles_stopwatch: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_cycles_stopwatch", { action: "reset" }, deps);
  assertAnswerConforms("vice_cycles_stopwatch", result);
});

conformanceTest("vice_run_until", async () => {
  // The conformance harness's client never synthesises a checkpoint_info
  // event, so this case exercises the TIMEOUT answer shape -- the shape a
  // caller sees on an address that never executes. An explicit small
  // timeout_ms (25ms) keeps this case fast; it must never wait out the
  // production 30000ms default.
  const session = buildConformanceSession("conformance-vice_run_until", (commandType) => {
    if (commandType === CommandType.CheckpointSet) {
      return checkpointInfoReply();
    }
    if (commandType === CommandType.Exit) {
      return conformanceAckReply(CommandType.Exit);
    }
    if (commandType === CommandType.CheckpointDelete) {
      return conformanceAckReply(CommandType.CheckpointDelete);
    }
    throw new Error(`vice_run_until: unexpected commandType ${commandType}`);
  });
  const deps = buildConformanceDeps(session);
  const result = await dispatchStock("vice_run_until", { address: "$c000", timeout_ms: 25 }, deps);
  assertAnswerConforms("vice_run_until", result);
});

// --------------------------------------------------------- completeness guard and negative control

test("conformance (D-02) completeness guard: CONFORMANCE_TOOL_NAMES covers exactly the stock manifest's tool names", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const manifestNames = stock.tools.map((t) => t.name).sort();
  const caseNames = [...CONFORMANCE_TOOL_NAMES].sort();
  assert.deepEqual(
    caseNames,
    manifestNames,
    "every tool in tools-manifest.stock.json must have exactly one conformanceTest() case, and vice versa -- " +
      "a tool added to the manifest with no matching conformance case must fail this guard rather than ship unvalidated",
  );
});

test("conformance (D-02) negative control: checkAgainstSchema rejects a deliberately wrong answer, proving the checker is not vacuous", () => {
  // This control exists precisely because a conformance harness whose
  // checker always returns [] would still pass every test above -- proving
  // nothing. An empty instance against vice_ping's own outputSchema (which
  // requires status/backend/viceVersion/resolvedBinaryPath/
  // resolvedBinaryPathIsResolved/capabilities/runState) must produce a
  // NON-EMPTY violation list.
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const pingEntry = stock.tools.find((t) => t.name === "vice_ping")!;
  const violations = checkAgainstSchema({}, pingEntry.outputSchema);
  assert.ok(
    violations.length > 0,
    "checkAgainstSchema() must reject an empty instance against vice_ping's outputSchema -- an empty violation list " +
      "here would mean the checker itself has regressed to a no-op, and every conformance case above would be " +
      "vacuously passing",
  );
});

// ---------------------------------------------------------------------------
// Task 2 (plan 04-02): withDerivedTool() -- the adapter for a client-side
// derived tool, sitting beside withStockSession(). Every deps.ensureLease
// below that must never be called is a THROWING stub, never a spy that
// merely records -- an unreachable stub proves the pure branch never
// touches the wire far more strongly than a call counter would.
// ---------------------------------------------------------------------------

const THROWING_ENSURE_LEASE: StockDispatchDeps["ensureLease"] = async () => {
  throw new Error("ensureLease must never be called for this test");
};

test("withDerivedTool: an undeclared tool name is refused by name, without ever reaching ensureLease", async () => {
  const handler: DerivedPureHandler = async () => {
    throw new Error("must not be called -- the tool is not declared in STOCK_DERIVED_TOOLS");
  };
  const wrapped = withDerivedTool("vice_not_a_derived_tool", { needsSession: false }, handler);
  const deps: StockDispatchDeps = { ensureLease: THROWING_ENSURE_LEASE };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /vice_not_a_derived_tool/);
  assert.match(JSON.stringify(result.content), /STOCK_DERIVED_TOOLS/);
});

test("withDerivedTool: needsSession:false invokes the handler with (args, deps) and never calls ensureLease", async () => {
  let receivedArgs: Record<string, unknown> | undefined;
  const handler: DerivedPureHandler = async (args) => {
    receivedArgs = args;
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  const wrapped = withDerivedTool("vice_disassemble", { needsSession: false }, handler);
  const deps: StockDispatchDeps = { ensureLease: THROWING_ENSURE_LEASE };
  const result = await wrapped({ address: "$c000" }, deps);
  assert.equal(result.isError, false);
  assert.deepEqual(receivedArgs, { address: "$c000" });
});

test("withDerivedTool: needsSession:true delegates to ensureStockSession and hands the handler the resolved session", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-derived-1", brokerControl: STUB_BROKER_CONTROL });
  let receivedSession: StockConnectSession | undefined;
  const handler: StockSessionHandler = async (_args, session) => {
    receivedSession = session;
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  const wrapped = withDerivedTool("vice_disassemble", { needsSession: true }, handler);
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, false);
  assert.ok(receivedSession);
  assert.equal(receivedSession!.targetId, "grant-derived-1");
});

test("withDerivedTool: a handler that throws is converted via convertWireError, not propagated", async () => {
  const handler: DerivedPureHandler = async () => {
    throw new Error("boom: something the derived handler let escape");
  };
  const wrapped = withDerivedTool("vice_disassemble", { needsSession: false }, handler);
  const deps: StockDispatchDeps = { ensureLease: THROWING_ENSURE_LEASE };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /vice_disassemble/);
  assert.match(JSON.stringify(result.content), /boom: something the derived handler let escape/);
});

test("withDerivedTool: needsSession:true converts a handshake failure via convertHandshakeError, naming the tool", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-derived-2", brokerControl: STUB_BROKER_CONTROL });
  const handler: StockSessionHandler = async () => {
    throw new Error("must not be called -- the handshake itself failed");
  };
  const wrapped = withDerivedTool("vice_disassemble", { needsSession: true }, handler);
  const deps: StockDispatchDeps = {
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

test("withDerivedTool: needsSession:true returns an { ok: false } lease refusal verbatim, without touching the handler", async () => {
  let handlerCalled = false;
  const handler: StockSessionHandler = async () => {
    handlerCalled = true;
    return { content: [{ type: "text", text: "{}" }], isError: false };
  };
  const wrapped = withDerivedTool("vice_disassemble", { needsSession: true }, handler);
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: false, message: "broker: dead_or_hung (verbatim message)" }),
  };
  const result = await wrapped({}, deps);
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /broker: dead_or_hung \(verbatim message\)/);
  assert.equal(handlerCalled, false, "a refusal must never reach the delegated handler");
});
