// stock-tools.test.ts
//
// The tool list and its pairing with tools-manifest.stock.json, the manifest's
// own structural checks, vice_ping, and the D-02 answer-conformance harness:
// every manifest tool is called through callStockTool() against a stubbed
// session and its answer is checked against its own declared outputSchema.
// Every test here is offline -- no broker process, no emulator.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer, connect as netConnect, type Socket, type AddressInfo } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { EventEmitter } from "node:events";

import {
  ensureStockSession,
  clearHeldStockSession,
  stockDisconnect,
  runBinary,
  runPure,
  type StockSessionDeps,
} from "./stock-session.ts";
import { STOCK_TOOLS, callStockTool, stockToolDefinitions, StockToolManifestMismatchError } from "./stock-tools.ts";
import { STUB_BROKER_CONTROL, makeLease, fakeSession } from "./stock-session-fixtures.ts";
import type { ToolInfo } from "./vice-errors.ts";
import type { DerivedPureHandler } from "./stock-handler.ts";
import { encodeResponseFrame } from "./binmon-fixtures.ts";
import { MachineRestartedError } from "./vice-errors.ts";
import { MonitorOwnershipError } from "./vice-broker-client.ts";
import type { HeldLease, BrokerControlSession } from "./vice-broker-client.ts";
import { stockConnect, type StockConnectSession, type StockConnectOptions, type DialMonitorSocketFn } from "./stock-connect.ts";
import { resetRunStateTrackersForTest, attachRunStateTracker } from "./stock-runstate.ts";
import type { StockSessionHandler, StockToolResult } from "./stock-handler.ts";
import { checkAgainstSchema } from "./stock-schema-check.ts";
import { CommandType } from "./stock-protocol.ts";
import { resetBankCatalogsForTest } from "./stock-memory.ts";
import { resetRegisterCatalogsForTest } from "./stock-registers.ts";
import { resetSymbolStoreForTest } from "./stock-symbols.ts";
import { CURATED_ANNO_TOOLS } from "./anno-tools.ts";
import { currentChannelLockHolder, channelLockRefusalMessage, resetChannelLockForTests } from "./channel-lock.ts";
import { TEXT_COMMAND_ALLOWLIST } from "./text-protocol.ts";
import {
  resetCheckpointStateForTest,
  handleCheckpointSetCondition,
  conditionTextFor,
  _conditionRegistryTargetsForTest,
} from "./stock-checkpoints.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
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
const STOCK_ONLY_TOOLS = new Set([
  "vice_execution_until_return",
  "vice_registers_available",
  // Plan 41-06, CHAN-03: the two text-channel remedy tools -- the fork's
  // custom HTTP API has no equivalent, and the fork never dials the text
  // monitor (D-07's frozen v0.1.x fork list).
  "vice_device_console",
  "vice_warp_set",
  // Plan 42-01, PARSE-01: the memmapshow access-map tool -- same reasoning
  // as the pair above, reached over the same text-monitor channel.
  "vice_memmap_show",
  // Plan 43-03, EVID-05: the memmapzap bracket-reset tool -- same reasoning,
  // reached over the same text-monitor channel.
  "vice_memmap_zap",
  // Plan 42-07, PARSE-02: the three remaining stock-only text-channel
  // parsers, same reasoning -- reached over the same text-monitor channel,
  // no fork HTTP-API equivalent. vice_backtrace is deliberately NOT here:
  // it shares the fork's own existing tool name (D-42-4), so it has a real
  // fork-manifest counterpart and is not stock-only.
  "vice_cpu_history",
  "vice_profile_flat",
  "vice_io_registers",
  // Plan 50-04 (route-d): the program-load tool for the committed
  // hazard-subject fixture -- same reasoning, reached over the same
  // text-monitor channel, no fork HTTP-API equivalent.
  "vice_program_load",
]);

// --------------------------------------------------------- tools-manifest.stock.json shape

test("manifest/backend: tools-manifest.stock.json parses and carries the expected three top-level keys", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const key of ["generated_at", "endpoint", "tools"] as const) {
    assert.ok(key in stock, `stock manifest missing top-level key "${key}"`);
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

test("manifest/backend (D-03 name coverage): every STOCK_ONLY_TOOLS name is present in the stock manifest", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const name of STOCK_ONLY_TOOLS) {
    assert.ok(stock.tools.some((t) => t.name === name), `STOCK_ONLY_TOOLS name "${name}" must be present in the stock manifest`);
  }
});

// The D-03 input-compatibility test that used to live here (every stock/fork
// pair has equal required-argument sets, stock's extras all optional on the
// fork side) is deleted along with the fork manifest and transport: its
// entire premise was a two-manifest comparison, and with one manifest there
// is nothing left to compare. `manifest-arg-compat.test.ts` was the other,
// more thorough guard over the same premise and is deleted whole for the
// same reason.

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

test("manifest/backend (D-01 structural): no tool entry in tools-manifest.stock.json has a string-typed input property passed to the text monitor as a command; vice_warp_set's only property is a boolean", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const COMMAND_NAME_HINTS = /\bcommand\b|\bcmd\b|\bverb\b/i;
  for (const tool of stock.tools) {
    const props = tool.inputSchema?.properties ?? {};
    for (const [propName, propSchema] of Object.entries(props)) {
      if (propSchema?.type === "string") {
        assert.doesNotMatch(
          propName,
          COMMAND_NAME_HINTS,
          `"${tool.name}"'s string property "${propName}" looks like a free-text monitor-command field -- D-01 forbids one`,
        );
        const description = String((propSchema as { description?: string }).description ?? "");
        assert.doesNotMatch(
          description,
          COMMAND_NAME_HINTS,
          `"${tool.name}"'s string property "${propName}" is described as a monitor command -- D-01 forbids a free-text command field`,
        );
      }
    }
  }
  const warpSet = stock.tools.find((t) => t.name === "vice_warp_set");
  assert.ok(warpSet, "vice_warp_set must exist on the stock manifest");
  const warpProps = Object.keys(warpSet!.inputSchema?.properties ?? {});
  assert.deepEqual(warpProps, ["enabled"], "vice_warp_set's inputSchema must declare exactly one property, \"enabled\"");
  assert.equal(warpSet!.inputSchema?.properties?.enabled?.type, "boolean", "vice_warp_set's \"enabled\" must be type \"boolean\"");
  const deviceConsole = stock.tools.find((t) => t.name === "vice_device_console");
  assert.ok(deviceConsole, "vice_device_console must exist on the stock manifest");
  assert.deepEqual(
    Object.keys(deviceConsole!.inputSchema?.properties ?? {}),
    [],
    "vice_device_console's inputSchema must declare no properties at all",
  );
  assert.equal(deviceConsole!.inputSchema?.additionalProperties, false);
  assert.equal(warpSet!.inputSchema?.additionalProperties, false);
});

test("manifest/backend (D-02 structural): the five parse-target verbs are present in TEXT_COMMAND_ALLOWLIST and are never themselves a tool name in tools-manifest.stock.json", () => {
  // Plan 42-07 (the four remaining PARSE-02 parsers, plus the Task 3 retrofit
  // of memmapshow's own capability check) made every one of these five verbs
  // reachable through a NAMED TOOL whose name differs from the raw verb
  // string ("chis" -> vice_cpu_history, "prof flat" -> vice_profile_flat,
  // "bt" -> vice_backtrace, "io" -> vice_io_registers, "memmapshow" ->
  // vice_memmap_show, already landed in plan 42-01). What was stale here was
  // never the two facts this test asserts -- both remain TRUE and must keep
  // passing -- only the RATIONALE: earlier plans stated the verbs were
  // reachable in-process but not yet advertised because their owning parsers
  // had not landed. They have landed now, and the distinction this test
  // protects -- a verb string is never itself a tool name, no matter how
  // reachable the verb becomes -- is MORE load-bearing after this plan than
  // before it: every one of the five names below is now a live derived-tool
  // registration (STOCK_TOOLS in stock-tools.ts), so a future change
  // that accidentally advertised a bare verb as a tool name would collide
  // with this exact assertion, not merely with an unreached one.
  const PARSE_TARGET_VERBS = ["memmapshow", "prof flat", "chis", "bt", "io"];
  for (const verb of PARSE_TARGET_VERBS) {
    assert.ok(
      (TEXT_COMMAND_ALLOWLIST as readonly string[]).includes(verb),
      `"${verb}" must remain in TEXT_COMMAND_ALLOWLIST -- every one of the five verbs is reachable in-process ` +
        `through its own named tool`,
    );
  }
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const toolNames = new Set(stock.tools.map((t) => t.name));
  for (const verb of PARSE_TARGET_VERBS) {
    assert.ok(
      !toolNames.has(verb),
      `"${verb}" must NOT appear as a tool name in tools-manifest.stock.json -- it is reachable through its own ` +
        `distinctly-named tool (D-02), never advertised under the raw verb string itself`,
    );
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
  ["vice_machine_config_get", "CUT from scope 2026-08-17 -- docs/stock-vice-parity.md's dated record"],
  ["vice_machine_config_set", "CUT from scope 2026-08-17 -- docs/stock-vice-parity.md's dated record"],
];

test("manifest/backend (trimmed tools absent): none of the twelve decision-trimmed tools appears in tools-manifest.stock.json", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const [name, decisionId] of TRIMMED_TOOL_DECISIONS) {
    assert.ok(!stock.tools.some((t) => t.name === name), `"${name}" must not appear in the stock manifest (${decisionId})`);
  }
});

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

const THROWING_ENSURE_LEASE: StockSessionDeps["ensureLease"] = async () => {
  throw new Error("ensureLease must never be called for this test");
};

/** Adapters that turn a handler into a (args, deps) runner, for tests that
 * exercise the two runners through a handler of their own. */
function asBinary(toolName: string, handler: StockSessionHandler) {
  return (args: Record<string, unknown>, deps: StockSessionDeps) => runBinary(toolName, handler, args, deps);
}
function asPure(toolName: string, handler: DerivedPureHandler) {
  return (args: Record<string, unknown>, deps: StockSessionDeps) => runPure(toolName, handler, args, deps);
}

// ---------------------------------------------------------------------------
// Task 1 (plan 02-10): vice_ping and the handshake-error wording.
// Every deps.connect/deps.reconnect below is a spy stub, never
// stock-connect.ts's real socket-touching implementation -- these tests
// assert dispatch WIRING and refusal TEXT, never protocol shape. Every
// ping test drives callStockTool() through a REAL ensureStockSession(), per
// this plan's own test-stubbing-boundary decision -- never a stubbed
// ensureStockSession.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The one tool list and its pairing with the manifest.
// ---------------------------------------------------------------------------

test("STOCK_TOOLS: every name matches /^vice_[a-z0-9_]+$/ and appears once", () => {
  const names = STOCK_TOOLS.map((t) => t.name);
  for (const name of names) {
    assert.match(name, /^vice_[a-z0-9_]+$/, `${name} does not match the expected tool-name shape`);
  }
  assert.equal(new Set(names).size, names.length, "a tool name appears twice in STOCK_TOOLS");
});

test("stockToolDefinitions: the real manifest pairs with STOCK_TOOLS one to one, in manifest order", () => {
  const manifestTools = readManifest(STOCK_MANIFEST_PATH).tools as unknown as ToolInfo[];
  const paired = stockToolDefinitions(manifestTools);
  assert.deepEqual(paired.map((p) => p.def.name), manifestTools.map((t) => t.name));
  for (const { def, tool } of paired) {
    assert.equal(tool.name, def.name);
  }
});

test("stockToolDefinitions: a manifest entry with no tool is refused by name", () => {
  const manifestTools = readManifest(STOCK_MANIFEST_PATH).tools as unknown as ToolInfo[];
  const extra = [...manifestTools, { name: "vice_not_a_tool", inputSchema: { type: "object" } }];
  assert.throws(() => stockToolDefinitions(extra), (err: unknown) => err instanceof StockToolManifestMismatchError && /vice_not_a_tool/.test(err.message));
});

test("stockToolDefinitions: a tool with no manifest entry is refused by name", () => {
  const manifestTools = (readManifest(STOCK_MANIFEST_PATH).tools as unknown as ToolInfo[]).filter((t) => t.name !== "vice_ping");
  assert.throws(() => stockToolDefinitions(manifestTools), (err: unknown) => err instanceof StockToolManifestMismatchError && /vice_ping/.test(err.message));
});

test("callStockTool: an unknown name is refused by name, without reading deps", async () => {
  let depsTouched = false;
  const emptyDeps = new Proxy({} as StockSessionDeps, {
    get(target, prop) {
      depsTouched = true;
      return (target as unknown as Record<string | symbol, unknown>)[prop];
    },
  });
  for (const name of ["vice_sid_get_state", "vice_snapshot_list", "vice_totally_unknown_tool"]) {
    const result = await callStockTool(name, {}, emptyDeps);
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), new RegExp(`${name}: no stock tool has this name`));
  }
  assert.equal(depsTouched, false, "a miss must never read any field off deps");
});

test("ping: callStockTool(\"vice_ping\", ...) calls deps.ensureLease exactly once and deps.connect receives the exact lease fields", async () => {
  let ensureLeaseCalls = 0;
  const lease: HeldLease = makeLease({ host: "10.1.2.3", port: 6510, targetId: "grant-ping-1", brokerControl: STUB_BROKER_CONTROL });
  const receivedCalls: StockConnectOptions[] = [];
  const deps: StockSessionDeps = {
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
  const result = await callStockTool("vice_ping", {}, deps);
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
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: false, message: "broker: dead_or_hung (pid 1234)" }),
    connect: async (opts) => {
      connectCalls++;
      return fakeSession(opts);
    },
  };
  const result = await callStockTool("vice_ping", {}, deps);
  assert.equal(result.isError, true);
  const text = JSON.stringify(result.content);
  assert.match(text, /dead_or_hung/);
  assert.equal(connectCalls, 0);
});

test("ping: the success payload carries backend, viceVersion, resolvedBinaryPath, and runState (D-06)", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-ping-2", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
    resolvedBinaryPath: "/opt/vice/bin/x64sc",
    resolvedBinaryPathIsResolved: true,
  };
  const result = await callStockTool("vice_ping", {}, deps);
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
  const result = await callStockTool("vice_ping", {}, {
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
  const result = await callStockTool("vice_ping", {}, {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async (opts) => fakeSession(opts),
  });
  const payload = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
  assert.equal(payload.resolvedBinaryPathIsResolved, false);
});

test("WR-06: a connect REFUSAL on the stock path names VICE_BROKER_BINMON_HOST and the loopback default", async () => {
  const lease: HeldLease = makeLease({ host: "host.docker.internal", port: 6605, targetId: "grant-wr06", brokerControl: STUB_BROKER_CONTROL });
  const result = await callStockTool("vice_ping", {}, {
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
  const result = await callStockTool("vice_ping", {}, {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async () => {
      throw new Error("observed api_version 0x03, expected 0x02");
    },
  });
  const text = result.content[0]!.text;
  assert.match(text, /stock handshake failed \(observed api_version 0x03/);
  assert.doesNotMatch(text, /VICE_BROKER_BINMON_HOST/);
});

test("WR-06: the WHATWG URL parser keeps IPv6 brackets in .hostname, and the same strip expression removes them while leaving an IPv4 host unaffected", () => {
  // The behaviour under test lives in buildHeldLease(), in the file the
  // automated gate cannot execute -- so the transform is asserted structurally
  // AND the underlying quirk it exists for is asserted for real, here, against
  // the same URL parser.
  assert.equal(new URL("http://[::1]:6605/mcp").hostname, "[::1]", "WHATWG URL keeps the brackets -- this is the quirk");
  assert.equal(new URL("http://[::1]:6605/mcp").hostname.replace(/^\[(.+)\]$/, "$1"), "::1");
  assert.equal(new URL("http://127.0.0.1:6605/mcp").hostname.replace(/^\[(.+)\]$/, "$1"), "127.0.0.1", "an IPv4 host is unaffected");
});

test("ping: a MonitorOwnershipError from the handshake becomes isError:true naming the holder, without wedge/hung/unresponsive language", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-ping-3", brokerControl: STUB_BROKER_CONTROL });
  const deps: StockSessionDeps = {
    ensureLease: async () => ({ ok: true, lease }),
    connect: async () => {
      throw new MonitorOwnershipError("stockConnect: monitor for target grant-ping-3 on port 6502 is already claimed by grant grant-other", {
        holderGrantId: "grant-other",
        holderClaimedAt: 1700000000000,
        port: 6502,
      });
    },
  };
  const result = await callStockTool("vice_ping", {}, deps);
  assert.equal(result.isError, true);
  const text = JSON.stringify(result.content).toLowerCase();
  assert.match(text, /grant-other/);
  assert.doesNotMatch(text, /wedge|hung|unresponsive/);
});

test("ping: a MachineRestartedError from the handshake becomes isError:true distinguishable from a provider-timeout message", async () => {
  const lease: HeldLease = makeLease({ host: "127.0.0.1", port: 6502, targetId: "grant-ping-4", brokerControl: STUB_BROKER_CONTROL });
  let connectCalls = 0;
  const deps: StockSessionDeps = {
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
  await callStockTool("vice_ping", {}, deps); // first call connects and holds a not-connected session
  const result = await callStockTool("vice_ping", {}, deps); // second call triggers the reconnect path
  assert.equal(result.isError, true);
  const text = JSON.stringify(result.content);
  assert.match(text, /epoch/i);
  assert.match(text, /baseline epoch 5/);
  assert.match(text, /current epoch 9/);
  assert.doesNotMatch(text.toLowerCase(), /timeout/);
});

test("anno_* curation (plan 29-01): every curated anno_* name is absent from tools-manifest.stock.json", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const stockNames = new Set(stock.tools.map((t) => t.name));
  assert.ok(CURATED_ANNO_TOOLS.length > 0, "the curated set must be non-empty for this assertion to mean anything");
  for (const name of CURATED_ANNO_TOOLS) {
    assert.ok(!stockNames.has(name), `${name} is curated but present in the STOCK manifest -- the anno_* family is served proxy-locally, in neither manifest, by design`);
  }
});

// FORKRM-01 (plan 52-06): the sibling test that used to sit here --
// "ensureBrokerLease() compares the broker's own backend verdict against
// ACTIVE_BACKEND and refuses a definite mismatch" -- is deleted whole. The
// broker/proxy backend cross-check it asserted is deleted outright from
// vice-proxy.ts, by recorded decision, with no lighter replacement (see
// 52-06-SUMMARY.md): with one backend the comparison was a tautology. This
// deletion reverses a regression Task 1 of that plan introduced into this
// file (a structural assertion pointing at now-deleted source), not a
// registry-content decision -- the file's own registry-shaped fork
// references remain plan 52-07's scope.

// ---------------------------------------------------------------------------
// Task 3 (plan 03-13): the D-02 answer-conformance harness. Every one of the
// 25 stock tools is dispatched through callStockTool() -- the REAL path,
// exercising runBinary() and stockAnswer()'s runState stamp
// -- against a stubbed session, never a family handler called directly. Each
// case's actual answer is validated against ITS OWN declared outputSchema in
// tools-manifest.stock.json. A completeness guard ties the case list to the
// manifest's own name list; a negative control proves checkAgainstSchema()
// is not vacuously passing.
// ---------------------------------------------------------------------------

const CONFORMANCE_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
  // Phase 63, plan 63-03 (SESS-05): every conformance case runs through the
  // REAL runBinary()/withChannelLockHeld() path, which now declares
  // and clears an in-flight operation for every call -- a stub without this
  // method would throw "noteOperation is not a function" on the very first
  // conformance case, not merely fail a type check the `as unknown as` cast
  // below already bypasses.
  noteOperation: async () => ({ ok: true as const }),
  // Phase 64, plan 64-04 (XFER-01/XFER-02): vice_snapshot_save/
  // vice_snapshot_load's conformance cases now stage a slot before every
  // DUMP/UNDUMP -- a stub without this method would throw "stageFile is not
  // a function" on the first snapshot conformance case, not merely fail a
  // type check the `as unknown as` cast below already bypasses.
  stageFile: async () => ({ ok: true as const, handle: "conformance-handle", emulatorFilename: "/conformance-staged/snapshot.bin" }),
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
    // Phase 64, plan 64-04 (XFER-01/XFER-02): vice_snapshot_save/
    // vice_snapshot_load's conformance cases now call
    // session.deps.transferFile after staging -- a stub without this
    // returns undefined, and the handler reports "no transferFile
    // implementation is available" rather than throwing, but conformance
    // still needs the download/upload to report success so DUMP/UNDUMP is
    // reached and the answer conforms to its schema.
    deps: { transferFile: async () => ({ ok: true as const, byteLength: 0, sha256: "" }) },
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

/** Builds the StockSessionDeps for one conformance case: a fresh lease
 * (the session's own unique targetId, so ensureStockSession() never reuses
 * a DIFFERENT case's held session) and a `connect` stub that ignores the
 * lease's coordinates and hands back the pre-built session. */
function buildConformanceDeps(session: StockConnectSession): StockSessionDeps {
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

// Phase 64 (XFER-01/XFER-02/XFER-08, plan 64-06): vice_autostart/
// vice_disk_attach/vice_snapshot_save/vice_snapshot_load all migrated off
// withEmulatorSidePath() (stock-paths.ts) onto the broker's own file-transfer
// protocol -- none of the four reaches isInsideContainer() any more, so this
// file's own former setIsInsideContainerForTest() stub is gone too (D-18:
// stock-machine.ts no longer imports stock-paths.ts at all). Every
// conformance case for these four tools now runs through
// CONFORMANCE_BROKER_CONTROL's stageFile stub and buildConformanceSession()'s
// deps.transferFile stub instead (both added in plan 64-04, above).

/** Shared post-dispatch assertions every conformance case makes: the real
 * callStockTool() answer must be a success, must validate against the
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
  test(`conformance (D-02): callStockTool("${toolName}", ...) answers, validating against its own declared outputSchema`, run);
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
  const result = await callStockTool("vice_memory_read", { address: "$1000", size: 2 }, deps);
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
  const result = await callStockTool("vice_memory_write", { address: "$1000", data: [0x01, 0x02] }, deps);
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
  const result = await callStockTool("vice_memory_banks", {}, deps);
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
  const result = await callStockTool("vice_memory_search", { start: "$1000", end: "$100f", pattern: [0x4c] }, deps);
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
  const result = await callStockTool("vice_memory_compare", { mode: "ranges", range1_start: "$1000", range1_end: "$1007", range2_start: "$2000" }, deps);
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
  const result = await callStockTool("vice_registers_get", {}, deps);
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
  const result = await callStockTool("vice_registers_set", { register: "PC", value: 0x0801 }, deps);
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
  const result = await callStockTool("vice_registers_available", {}, deps);
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
  const result = await callStockTool("vice_checkpoint_add", { start: "$c000" }, deps);
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
  const result = await callStockTool("vice_checkpoint_delete", { checkpoint_num: 1 }, deps);
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
  const result = await callStockTool("vice_checkpoint_list", {}, deps);
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
  const result = await callStockTool("vice_checkpoint_toggle", { checkpoint_num: 1, enabled: true }, deps);
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
  const result = await callStockTool("vice_checkpoint_set_condition", { checkpoint_num: 1, condition: "A == $42" }, deps);
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
  const result = await callStockTool("vice_watch_add", { address: "$c000" }, deps);
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
  const result = await callStockTool("vice_execution_pause", {}, deps);
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
  const result = await callStockTool("vice_execution_run", {}, deps);
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
  const result = await callStockTool("vice_execution_step", {}, deps);
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
  const result = await callStockTool("vice_execution_until_return", {}, deps);
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
  const result = await callStockTool("vice_machine_reset", {}, deps);
  assertAnswerConforms("vice_machine_reset", result);
});

// Phase 64 (XFER-02/XFER-08, plan 64-06): handleAutostart/handleDiskAttach
// genuinely check the local path's readability before staging (real
// accessSync, never delegated to a stub) -- so, unlike before this
// migration, these two conformance cases need a REAL fixture file on disk,
// not a synthetic "/workspace/..." path. Neither handler depends on
// CLAUDE_PROJECT_DIR/repoRoot() at all any more (D-14: the path argument is
// unrestricted and never confined to a workspace), so a plain mkdtempSync()
// fixture is enough -- withTempRepoRootForConformance() is not needed here.
async function withConformanceFixtureFile<T>(basename: string, fn: (fixturePath: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "vice-conformance-fixture-"));
  const fixturePath = join(dir, basename);
  writeFileSync(fixturePath, "conformance fixture bytes");
  try {
    return await fn(fixturePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

conformanceTest("vice_autostart", async () => {
  await withConformanceFixtureFile("game.prg", async (fixturePath) => {
    const session = buildConformanceSession("conformance-vice_autostart", (commandType) => {
      if (commandType === CommandType.AutoStart) {
        return conformanceAckReply(CommandType.AutoStart);
      }
      throw new Error(`vice_autostart: unexpected commandType ${commandType}`);
    });
    const deps = buildConformanceDeps(session);
    const result = await callStockTool("vice_autostart", { path: fixturePath }, deps);
    assertAnswerConforms("vice_autostart", result);
  });
});

conformanceTest("vice_disk_attach", async () => {
  await withConformanceFixtureFile("disk.d64", async (fixturePath) => {
    const session = buildConformanceSession("conformance-vice_disk_attach", (commandType) => {
      if (commandType === CommandType.AutoStart) {
        return conformanceAckReply(CommandType.AutoStart);
      }
      throw new Error(`vice_disk_attach: unexpected commandType ${commandType}`);
    });
    const deps = buildConformanceDeps(session);
    const result = await callStockTool("vice_disk_attach", { unit: 8, path: fixturePath }, deps);
    assertAnswerConforms("vice_disk_attach", result);
  });
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
    const result = await callStockTool("vice_snapshot_save", { name: "conformance_snapshot" }, deps);
    assertAnswerConforms("vice_snapshot_save", result);
  });
});

conformanceTest("vice_snapshot_load", async () => {
  await withTempRepoRootForConformance(async (dir) => {
    mkdirSync(join(dir, ".c64-re-tools", "snapshots"), { recursive: true });
    writeFileSync(join(dir, ".c64-re-tools", "snapshots", "conformance_snapshot.vsf"), "");
    const session = buildConformanceSession("conformance-vice_snapshot_load", (commandType) => {
      if (commandType === CommandType.Undump) {
        return { type: "undump" as const, requestId: 1, errorCode: 0, programCounter: 0x0801, related: [] };
      }
      throw new Error(`vice_snapshot_load: unexpected commandType ${commandType}`);
    });
    const deps = buildConformanceDeps(session);
    const result = await callStockTool("vice_snapshot_load", { name: "conformance_snapshot" }, deps);
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
  const result = await callStockTool("vice_keyboard_type", { text: "RUN" }, deps);
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
  const result = await callStockTool("vice_keyboard_petscii", { data: [0x52, 0x55, 0x4e, 0x0d] }, deps);
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
  const result = await callStockTool("vice_joystick_set", { port: 1, direction: "up", fire: true }, deps);
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
  const result = await callStockTool("vice_disassemble", { address: "$1000" }, deps);
  assertAnswerConforms("vice_disassemble", result);
});

test("end-to-end (criterion 1, D-02): vice_disassemble succeeds through the REAL callStockTool() path under a translating environment -- the derived path never reaches host-path translation", async () => {
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
    const result = await callStockTool("vice_disassemble", { address: "$1000" }, deps);
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
    const deps: StockSessionDeps = { ensureLease: THROWING_ENSURE_LEASE };
    const result = await callStockTool("vice_symbols_load", { path: "labels.lbl" }, deps);
    assertAnswerConforms("vice_symbols_load", result);
    resetSymbolStoreForTest();
  });
});

conformanceTest("vice_symbols_lookup", async () => {
  await withTempRepoRootForConformance(async (repoRootDir) => {
    writeFileSync(join(repoRootDir, "labels.lbl"), SYMBOLS_FIXTURE);
    const loadDeps: StockSessionDeps = { ensureLease: THROWING_ENSURE_LEASE };
    const loadResult = await callStockTool("vice_symbols_load", { path: "labels.lbl" }, loadDeps);
    assert.equal(loadResult.isError, false, "the fixture load must succeed before this case looks anything up");

    const deps: StockSessionDeps = { ensureLease: THROWING_ENSURE_LEASE };
    const result = await callStockTool("vice_symbols_lookup", { name: "main" }, deps);
    assertAnswerConforms("vice_symbols_lookup", result);
    resetSymbolStoreForTest();
  });
});

test("end-to-end (criterion 1, D-02): vice_symbols_load succeeds through the REAL callStockTool() path under a translating environment -- resolvedPath stays container-side", async () => {
  const prevHostWs = process.env.HOST_WORKSPACE_PATH;
  process.env.HOST_WORKSPACE_PATH = "/home/user/project";
  try {
    await withTempRepoRootForConformance(async (repoRootDir) => {
      // withTempRepoRootForConformance already sets CLAUDE_PROJECT_DIR to
      // repoRootDir (a DIFFERENT absolute path than HOST_WORKSPACE_PATH
      // above) and restores it in its own finally block -- this test only
      // needs to manage HOST_WORKSPACE_PATH around the call.
      writeFileSync(join(repoRootDir, "labels.lbl"), SYMBOLS_FIXTURE);
      const deps: StockSessionDeps = { ensureLease: THROWING_ENSURE_LEASE };
      const result = await callStockTool("vice_symbols_load", { path: "labels.lbl" }, deps);
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
  const result = await callStockTool("vice_vicii_get_state", {}, deps);
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
  const result = await callStockTool("vice_cia_get_state", {}, deps);
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
  const result = await callStockTool("vice_sprite_get", {}, deps);
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
  const result = await callStockTool("vice_sprite_inspect", { sprite_number: 0 }, deps);
  assertAnswerConforms("vice_sprite_inspect", result);
  const parsed: Record<string, unknown> = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
  assert.equal(parsed.dataAddress, 40960, "sprite 0's resolved dataAddress must match the fixture's pointer byte");
});

// --------------------------------------------------------- vice_ping

conformanceTest("vice_ping", async () => {
  const session = buildConformanceSession("conformance-vice_ping", () => {
    throw new Error("vice_ping's handler must never call client.send()");
  });
  const deps: StockSessionDeps = {
    ...buildConformanceDeps(session),
    resolvedBinaryPath: "/usr/local/bin/x64sc",
    resolvedBinaryPathIsResolved: true,
  };
  const result = await callStockTool("vice_ping", {}, deps);
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
  const result = await callStockTool("vice_cycles_stopwatch", { action: "reset" }, deps);
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
  const result = await callStockTool("vice_run_until", { address: "$c000", timeout_ms: 25 }, deps);
  assertAnswerConforms("vice_run_until", result);
});

// --------------------------------------------------------- text-channel remedy tools (plan 41-06, CHAN-03)
//
// Neither tool is "binary", so buildConformanceSession()/
// buildConformanceDeps() (the BINARY-protocol stub above) do not apply --
// each handler resolves its OWN lease via deps.ensureLease() and dials a
// TEXT-monitor session through textConnect(), so the stub server here speaks
// the text protocol's own line-in/prompt-out shape, matching
// text-tools.test.ts's own withStubTextServer() convention.

async function withConformanceTextServer<T>(onLine: (line: string, socket: Socket) => void, fn: (port: number) => Promise<T>): Promise<T> {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buf = "";
    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        onLine(line, socket);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// Phase 63 (SESS-02): textConnect()'s default socket source is now a relay
// dial against a broker that is not running in this test process -- mirrors
// text-connect.test.ts's/text-tools.test.ts's own directDialMonitorSocket
// exactly: dials the stub text-monitor server DIRECTLY and resolves an
// empty pending Buffer, byte-identical handshake behaviour to the pre-relay
// direct dial this replaces.
const directTextDialMonitorSocket: DialMonitorSocketFn = (opts) =>
  new Promise((resolve, reject) => {
    const socket = netConnect({ host: opts.host, port: opts.port });
    socket.once("connect", () => resolve({ socket, pending: Buffer.alloc(0) }));
    socket.once("error", reject);
  });

function buildTextConformanceDeps(port: number, overrides: Partial<StockSessionDeps> = {}): StockSessionDeps {
  const lease: HeldLease = {
    host: "127.0.0.1",
    port: 6502,
    targetId: "conformance-text",
    brokerControl: CONFORMANCE_BROKER_CONTROL,
    epochFile: "",
    supervisorDir: "",
    remoteMonitorPort: port,
  };
  return {
    ensureLease: async () => ({ ok: true as const, lease }),
    dialMonitorSocket: directTextDialMonitorSocket,
    ...overrides,
  };
}

conformanceTest("vice_device_console", async () => {
  await withConformanceTextServer(
    (_line, socket) => socket.write("(C:$0000) "),
    async (port) => {
      const deps = buildTextConformanceDeps(port);
      const result = await callStockTool("vice_device_console", {}, deps);
      assertAnswerConforms("vice_device_console", result);
    },
  );
});

conformanceTest("vice_warp_set", async () => {
  await withConformanceTextServer(
    (_line, socket) => socket.write("warp: on(C:$0000) "),
    async (port) => {
      const deps = buildTextConformanceDeps(port);
      const result = await callStockTool("vice_warp_set", { enabled: true }, deps);
      assertAnswerConforms("vice_warp_set", result);
    },
  );
});

conformanceTest("vice_memmap_show", async () => {
  await withConformanceTextServer(
    (_line, socket) => socket.write("addr: IO  ROM RAM\n0000: --- --- rw-\n(C:$0000) "),
    async (port) => {
      const deps = buildTextConformanceDeps(port);
      const result = await callStockTool("vice_memmap_show", {}, deps);
      assertAnswerConforms("vice_memmap_show", result);
    },
  );
});

// plan 43-03 (EVID-05): two dials in one session -- "memmapzap" first
// (acknowledged), then "memmapshow" (the answer's own observable
// post-condition).
conformanceTest("vice_memmap_zap", async () => {
  await withConformanceTextServer(
    (line, socket) => {
      if (line === "memmapzap") {
        socket.write("(C:$0000) ");
      } else {
        socket.write("addr: IO  ROM RAM\n0000: --- --- rw-\n(C:$0000) ");
      }
    },
    async (port) => {
      const deps = buildTextConformanceDeps(port);
      const result = await callStockTool("vice_memmap_zap", {}, deps);
      assertAnswerConforms("vice_memmap_zap", result);
    },
  );
});

// --------------------------------------------------------- plan 42-07: the four remaining text formats

conformanceTest("vice_cpu_history", async () => {
  await withConformanceTextServer(
    (_line, socket) =>
      socket.write(".C:e5d1  8D 92 02    STA $0292      A:00 X:00 Y:0a SP:f3 ..-...Z.     11302187\n(C:$e5d1) "),
    async (port) => {
      const deps = buildTextConformanceDeps(port);
      const result = await callStockTool("vice_cpu_history", {}, deps);
      assertAnswerConforms("vice_cpu_history", result);
    },
  );
});

conformanceTest("vice_profile_flat", async () => {
  await withConformanceTextServer(
    (_line, socket) =>
      socket.write(
        "        Total      %          Self      %\n------------- ------ ------------- ------\n" +
          "2 326 151  98,5% 2 326 151  98,5% ffcf\n(C:$e5d1) ",
      ),
    async (port) => {
      const deps = buildTextConformanceDeps(port);
      const result = await callStockTool("vice_profile_flat", {}, deps);
      assertAnswerConforms("vice_profile_flat", result);
    },
  );
});

conformanceTest("vice_backtrace", async () => {
  await withConformanceTextServer(
    (_line, socket) => socket.write("             PC        .C:e5d1   8D 92 02    STA $0292\n(C:$e5d1) "),
    async (port) => {
      const deps = buildTextConformanceDeps(port);
      const result = await callStockTool("vice_backtrace", {}, deps);
      assertAnswerConforms("vice_backtrace", result);
    },
  );
});

conformanceTest("vice_io_registers", async () => {
  await withConformanceTextServer(
    (_line, socket) =>
      socket.write(
        "VIC-II:\n" +
          ">C:d000  00 00 00 00  00 00 00 00  00 00 00 00  00 00 00 00   @@@@@@@@@@@@@@@@\n" +
          "\n" +
          "Raster cycle/line: 0/311 IRQ: 311\n" +
          "Mode: Standard Text (ECM/BMM/MCM=0/0/0)\n" +
          "Colors: Border: e BG: 6 \n" +
          "Scroll X/Y: 0/3, RC 7, Idle: 1, 40x25\n" +
          "VC $3e8, VCBASE $3e8, VMLI  0, Phi1 $ff\n" +
          "Video $0400, Charset $1000 (CharROM)\n" +
          "\n" +
          "Sprites: S.0 S.1 S.2 S.3 S.4 S.5 S.6 S.7\n" +
          "Enabled:  no  no  no  no  no  no  no  no\n" +
          "DMA/dis:  /   /   /   /   /   /   /   / \n" +
          "Pointer: $00 $00 $ff $ff $ff $ff $00 $00\n" +
          "MC:      $00 $00 $00 $00 $00 $00 $00 $00\n" +
          "MCBASE:  $00 $00 $00 $00 $00 $00 $00 $00\n" +
          "X-Pos:  $000$000$000$000$000$000$000$000\n" +
          "Y-Pos:     0   0   0   0   0   0   0   0\n" +
          "X/Y-Exp:  /   /   /   /   /   /   /   / \n" +
          "Pri./MC: s/  s/  s/  s/  s/  s/  s/  s/ \n" +
          "Color:     1   2   3   4   5   6   7   c\n" +
          "(C:$d040) ",
      ),
    async (port) => {
      const deps = buildTextConformanceDeps(port);
      const result = await callStockTool("vice_io_registers", { address: 0xd020 }, deps);
      assertAnswerConforms("vice_io_registers", result);
    },
  );
});

conformanceTest("vice_program_load", async () => {
  await withConformanceTextServer(
    (_line, socket) => socket.write("(C:$0801) "),
    async (port) => {
      const deps = buildTextConformanceDeps(port);
      const result = await callStockTool("vice_program_load", {}, deps);
      assertAnswerConforms("vice_program_load", result);
    },
  );
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
