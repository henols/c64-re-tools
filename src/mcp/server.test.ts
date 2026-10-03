import assert from "node:assert/strict";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { WireFailure, type ExecutionParams, type MemoryReadParams, type Registers } from "../protocol.ts";
import { createMcpServer, type SessionSource, type ViceSessionApi } from "./server.ts";
import { executionTools } from "./tools/execution.ts";
import { machineTools } from "./tools/machine.ts";
import { memoryTools } from "./tools/memory.ts";

const ALL_TOOLS = [...machineTools, ...executionTools, ...memoryTools];

const REGISTERS: Registers = { pc: 0xe5cf, a: 0x42, x: 3, y: 0, sp: 0xf9, flags: { n: false, v: false, b: true, d: false, i: true, z: false, c: true } };

class FakeSession implements ViceSessionApi {
  stopped = false;
  reads: MemoryReadParams[] = [];
  spaces: string[] = [];
  failure: WireFailure | Error | undefined;

  async status() {
    if (this.failure) throw this.failure;
    return this.stopped
      ? { state: "stopped" as const, videoStandard: "pal" as const, warp: false, pc: 0x2a }
      : { state: "running" as const, videoStandard: "pal" as const, warp: false };
  }

  async memoryRead(params: MemoryReadParams) {
    if (this.failure) throw this.failure;
    this.reads.push(params);
    return { address: params.address, data: "a9".repeat(params.size) };
  }

  async registersGet(space: "c64" | "drive8") {
    if (this.failure) throw this.failure;
    this.spaces.push(space);
    return REGISTERS;
  }

  executions: ExecutionParams[] = [];
  async execution(params: ExecutionParams) {
    if (this.failure) throw this.failure;
    this.executions.push(params);
    if (params.action === "resume") return { state: "running" as const };
    if (params.action === "step" || params.action === "next") return { state: "stopped" as const, pc: 0x2102, executed: params.count ?? 1 };
    return { state: "stopped" as const, pc: 0x2100 };
  }

  resets: Array<{ mode: string; run: boolean }> = [];
  async reset(params: { mode: "soft" | "hard"; run: boolean }) {
    this.resets.push(params);
    return { state: params.run ? ("running" as const) : ("stopped" as const) };
  }

  warpState = false;
  async warp(enabled: boolean) {
    this.warpState = enabled;
    return { enabled };
  }
}

async function connect(source: SessionSource): Promise<Client> {
  const server = createMcpServer({ tools: ALL_TOOLS, session: source });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientTransport);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

function errorOf(result: CallToolResult): { code: string; message: string } {
  assert.equal(result.isError, true, JSON.stringify(result));
  const first = result.content[0];
  assert.equal(first?.type, "text");
  return JSON.parse((first as { text: string }).text) as { code: string; message: string };
}

test("the server lists exactly the implemented tools with object input and output schemas", async () => {
  const client = await connect(async () => new FakeSession());
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ["c64_execution", "c64_memory_read", "c64_registers", "c64_reset", "c64_status", "c64_warp"]);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.outputSchema?.type, "object");
    assert.equal(tool.annotations?.readOnlyHint, ["c64_status", "c64_memory_read", "c64_registers"].includes(tool.name));
    assert.doesNotMatch(`${tool.description} ${JSON.stringify(tool.inputSchema)}`, /\bVICE\b|monitor|port|session id|request/i);
  }
  const read = tools.find((tool) => tool.name === "c64_memory_read")!;
  assert.deepEqual((read.inputSchema.required as string[]).sort(), ["address", "size"]);
  await client.close();
});

test("c64_status returns the domain result directly, with pc only when stopped", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  const running = await call(client, "c64_status");
  assert.deepEqual(running.structuredContent, { state: "running", videoStandard: "pal", warp: false });
  assert.deepEqual(JSON.parse((running.content[0] as { text: string }).text), running.structuredContent);
  session.stopped = true;
  assert.deepEqual((await call(client, "c64_status")).structuredContent, { state: "stopped", videoStandard: "pal", warp: false, pc: "$002a" });
  await client.close();
});

test("c64_memory_read takes canonical addresses and fills defaults", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  const result = await call(client, "c64_memory_read", { address: "$E000", size: 3 });
  assert.deepEqual(result.structuredContent, { address: "$e000", size: 3, data: "a9a9a9" });
  assert.deepEqual(session.reads, [{ address: 0xe000, size: 3, space: "c64", view: "cpu" }]);
  await call(client, "c64_memory_read", { address: "$c000", size: 1, space: "drive8", view: "cpu" });
  assert.deepEqual(session.reads[1], { address: 0xc000, size: 1, space: "drive8", view: "cpu" });
  await client.close();
});

test("invalid input is an invalid-input error result that names the field", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  for (const [args, field] of [
    [{ address: "e000", size: 1 }, "address"],
    [{ address: "$e0000", size: 1 }, "address"],
    [{ address: "$e000", size: 0 }, "size"],
    [{ address: "$e000", size: 4097 }, "size"],
    [{ address: "$e000", size: 1, space: "drive9" }, "space"],
    [{ address: "$e000", size: 1, encoding: "ascii" }, "encoding"],
  ] as const) {
    const error = errorOf(await call(client, "c64_memory_read", args));
    assert.equal(error.code, "invalid-input");
    assert.match(error.message, new RegExp(field));
  }
  assert.equal(errorOf(await call(client, "c64_registers", { action: "set" })).code, "invalid-input");
  assert.equal(errorOf(await call(client, "c64_reboot")).code, "invalid-input");
  assert.deepEqual(session.reads, []);
  await client.close();
});

test("c64_registers get returns the frozen register shape", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  const result = await call(client, "c64_registers", { action: "get" });
  assert.deepEqual(result.structuredContent, { ...REGISTERS, pc: "$e5cf" });
  await call(client, "c64_registers", { action: "get", space: "drive8" });
  assert.deepEqual(session.spaces, ["c64", "drive8"]);
  await client.close();
});

test("host and session failures keep their code and message", async () => {
  const session = new FakeSession();
  session.failure = new WireFailure("machine-state-lost", "The emulator stopped unexpectedly.");
  const client = await connect(async () => session);
  assert.deepEqual(errorOf(await call(client, "c64_status")), { code: "machine-state-lost", message: "The emulator stopped unexpectedly." });

  const unavailable = await connect(async () => {
    throw new WireFailure("machine-unavailable", "The c64-re-tools host runtime is not running.");
  });
  assert.equal(errorOf(await call(unavailable, "c64_registers", { action: "get" })).code, "machine-unavailable");
  await client.close();
  await unavailable.close();
});

test("an unexpected exception becomes operation-failed without internals", async () => {
  const session = new FakeSession();
  session.failure = new Error("ECONNRESET at /tmp/c64-re-tools-vice-x port 51234");
  const client = await connect(async () => session);
  const error = errorOf(await call(client, "c64_status"));
  assert.equal(error.code, "operation-failed");
  assert.doesNotMatch(error.message, /ECONNRESET|tmp|51234/);
  await client.close();
});

test("c64_execution passes the action through and formats the pc", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  assert.deepEqual((await call(client, "c64_execution", { action: "pause" })).structuredContent, { state: "stopped", pc: "$2100" });
  assert.deepEqual((await call(client, "c64_execution", { action: "step", count: 2 })).structuredContent, {
    state: "stopped",
    pc: "$2102",
    executed: 2,
  });
  assert.deepEqual((await call(client, "c64_execution", { action: "resume" })).structuredContent, { state: "running" });
  assert.deepEqual(session.executions, [
    { action: "pause", space: "c64" },
    { action: "step", space: "c64", count: 2 },
    { action: "resume", space: "c64" },
  ]);
  assert.equal(errorOf(await call(client, "c64_execution", { action: "step", count: 0 })).code, "invalid-input");
  assert.equal(errorOf(await call(client, "c64_execution", { action: "jump" })).code, "invalid-input");
  await client.close();
});

test("c64_reset defaults run to false and c64_warp echoes the mode", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  assert.deepEqual((await call(client, "c64_reset", { mode: "hard" })).structuredContent, { state: "stopped" });
  assert.deepEqual((await call(client, "c64_reset", { mode: "soft", run: true })).structuredContent, { state: "running" });
  assert.deepEqual(session.resets, [
    { mode: "hard", run: false },
    { mode: "soft", run: true },
  ]);
  assert.equal(errorOf(await call(client, "c64_reset", {})).code, "invalid-input");
  assert.deepEqual((await call(client, "c64_warp", { enabled: true })).structuredContent, { enabled: true });
  assert.equal(session.warpState, true);
  await client.close();
});
