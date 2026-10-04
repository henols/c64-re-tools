import assert from "node:assert/strict";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  WireFailure,
  type ExecutionParams,
  type MemoryReadParams,
  type MemoryWriteParams,
  type RegisterValues,
  type Registers,
} from "../protocol.ts";
import { createMcpServer, type SessionSource, type ViceSessionApi } from "./server.ts";
import { debugTools } from "./tools/debug.ts";
import { executionTools } from "./tools/execution.ts";
import { inputTools } from "./tools/input.ts";
import { machineTools } from "./tools/machine.ts";
import { mediaTools } from "./tools/media.ts";
import { memoryTools } from "./tools/memory.ts";
import { videoTools } from "./tools/video.ts";

const ALL_TOOLS = [...machineTools, ...executionTools, ...debugTools, ...memoryTools, ...videoTools, ...inputTools, ...mediaTools];

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

  searches: unknown[] = [];
  async memorySearch(params: import("../protocol.ts").ViceOperations["memorySearch"]["params"]) {
    this.searches.push(params);
    return { matches: [0x2100, 0x37a0] };
  }
  async memoryCompare(params: import("../protocol.ts").ViceOperations["memoryCompare"]["params"]) {
    this.searches.push(params);
    return { equal: false, differentBytes: 3, firstDifferences: [{ offset: 12, left: 4, right: 5 }] };
  }
  async disassemble(params: import("../protocol.ts").ViceOperations["disassemble"]["params"]) {
    return { instructions: [{ address: params.address, bytes: "a900", text: "LDA #$00" }] };
  }

  writes: MemoryWriteParams[] = [];
  async memoryWrite(params: MemoryWriteParams) {
    this.writes.push(params);
    return { address: params.address, bytesWritten: params.data.length / 2 };
  }

  registerWrites: Array<{ space: string; values: RegisterValues }> = [];
  async registersSet(space: "c64" | "drive8", values: RegisterValues) {
    this.registerWrites.push({ space, values });
    return { ...REGISTERS, ...values, flags: { ...REGISTERS.flags, ...values.flags } } as Registers;
  }

  typed: number[][] = [];
  async keyboard(petscii: Uint8Array) {
    this.typed.push([...petscii]);
    return { queuedBytes: petscii.length };
  }
  async joystick(state: { port: 1 | 2; direction: (typeof import("../protocol.ts").JOYSTICK_DIRECTIONS)[number]; fire: boolean }) {
    return state;
  }

  points: unknown[] = [];
  async breakpoint(params: import("../protocol.ts").BreakpointParams) {
    this.points.push(params);
    if (params.action === "list") return { breakpoints: [{ id: 1, address: 0x2100, space: "c64" as const, enabled: true }] };
    if (params.action === "add") return { id: 1, address: params.address, space: params.space, enabled: true };
    return { id: params.id, address: 0x2100, space: "c64" as const, enabled: params.action !== "disable" };
  }
  async watchpoint(params: import("../protocol.ts").WatchpointParams) {
    this.points.push(params);
    if (params.action === "add") {
      return { id: 2, address: params.address, size: params.size, access: params.access, space: params.space, enabled: true };
    }
    return { watchpoints: [] };
  }

  runs: unknown[] = [];
  async runUntil(params: { target: import("../protocol.ts").RunTarget; timeoutFrames: number }) {
    this.runs.push(params);
    return { reached: true, stopReason: "target" as const, state: "stopped" as const, pc: 0xc00b };
  }

  async screenCapture() {
    return { width: 384, height: 272, png: Buffer.from("png-bytes").toString("base64") };
  }

  media: Array<[string, unknown]> = [];
  async programLoad(params: { path: string; address?: number }) {
    this.media.push(["programLoad", params]);
    return { state: "stopped" as const, loadAddress: params.address ?? 0x0801, size: 100 };
  }
  async autostart(params: { path: string; index: number; run: boolean }) {
    this.media.push(["autostart", params]);
    return { state: "running" as const };
  }
  async diskAttach(params: { path: string }) {
    this.media.push(["diskAttach", params]);
    return { attached: true };
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
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    "c64_autostart",
    "c64_breakpoint",
    "c64_disassemble",
    "c64_disk_attach",
    "c64_execution",
    "c64_joystick",
    "c64_keyboard",
    "c64_memory_compare",
    "c64_memory_read",
    "c64_memory_search",
    "c64_memory_write",
    "c64_program_load",
    "c64_registers",
    "c64_reset",
    "c64_run_until",
    "c64_screen",
    "c64_status",
    "c64_warp",
    "c64_watchpoint",
  ]);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.outputSchema?.type, "object");
    const readOnly = ["c64_status", "c64_memory_read", "c64_screen", "c64_memory_search", "c64_memory_compare", "c64_disassemble"];
    assert.equal(tool.annotations?.readOnlyHint, readOnly.includes(tool.name), tool.name);
    assert.doesNotMatch(`${tool.description} ${JSON.stringify(tool.inputSchema)}`, /\bVICE\b|monitor|tcp|socket|session id|request/i);
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

test("c64_memory_write takes hex in either case and reports bytes written", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  assert.deepEqual((await call(client, "c64_memory_write", { address: "$2000", data: "A9008D20D0" })).structuredContent, {
    address: "$2000",
    bytesWritten: 5,
  });
  assert.deepEqual(session.writes, [{ address: 0x2000, data: "a9008d20d0", space: "c64", view: "cpu" }]);
  for (const data of ["", "a", "zz", "a9 00"]) {
    assert.equal(errorOf(await call(client, "c64_memory_write", { address: "$2000", data })).code, "invalid-input", data);
  }
  await client.close();
});

test("c64_registers set writes only the named registers; get refuses values", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  const result = await call(client, "c64_registers", { action: "set", values: { pc: "$2100", a: 1, flags: { c: false } } });
  assert.equal((result.structuredContent as { pc: string }).pc, "$2100");
  assert.deepEqual(session.registerWrites, [{ space: "c64", values: { pc: 0x2100, a: 1, flags: { c: false } } }]);
  assert.equal(errorOf(await call(client, "c64_registers", { action: "set" })).code, "invalid-input");
  assert.equal(errorOf(await call(client, "c64_registers", { action: "set", values: {} })).code, "invalid-input");
  assert.equal(errorOf(await call(client, "c64_registers", { action: "set", values: { q: 1 } })).code, "invalid-input");
  assert.equal(errorOf(await call(client, "c64_registers", { action: "set", values: { a: 256 } })).code, "invalid-input");
  assert.equal(errorOf(await call(client, "c64_registers", { action: "get", values: { a: 1 } })).code, "invalid-input");
  await client.close();
});

test("media tools pass the project path and fill defaults", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  assert.deepEqual((await call(client, "c64_autostart", { path: "original/game.d64" })).structuredContent, { state: "running" });
  assert.deepEqual((await call(client, "c64_program_load", { path: "build/game.prg", address: "$C000" })).structuredContent, {
    state: "stopped",
    loadAddress: "$c000",
    size: 100,
  });
  assert.deepEqual((await call(client, "c64_disk_attach", { path: "original/game.d64" })).structuredContent, { attached: true });
  assert.deepEqual(session.media, [
    ["autostart", { path: "original/game.d64", index: 0, run: true }],
    ["programLoad", { path: "build/game.prg", address: 0xc000 }],
    ["diskAttach", { path: "original/game.d64" }],
  ]);
  assert.equal(errorOf(await call(client, "c64_disk_attach", { path: "" })).code, "invalid-input");
  await client.close();
});

test("c64_keyboard converts text, passes PETSCII through and refuses mixed or untypable input", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  assert.deepEqual((await call(client, "c64_keyboard", { mode: "text", text: "run\n" })).structuredContent, { queuedBytes: 4 });
  assert.deepEqual((await call(client, "c64_keyboard", { mode: "petscii", bytes: [147, 13] })).structuredContent, { queuedBytes: 2 });
  assert.deepEqual(session.typed, [
    [0x52, 0x55, 0x4e, 0x0d],
    [147, 13],
  ]);
  for (const args of [
    { mode: "text" },
    { mode: "text", text: "a", bytes: [1] },
    { mode: "petscii", bytes: [0] },
    { mode: "petscii", text: "a" },
    { mode: "text", text: "tab\t" },
    { mode: "text", text: "x".repeat(1025) },
  ]) {
    assert.equal(errorOf(await call(client, "c64_keyboard", args)).code, "invalid-input", JSON.stringify(args));
  }
  await client.close();
});

test("c64_joystick echoes the held state and defaults fire to false", async () => {
  const client = await connect(async () => new FakeSession());
  assert.deepEqual((await call(client, "c64_joystick", { port: 2, direction: "left" })).structuredContent, { port: 2, direction: "left", fire: false });
  assert.equal(errorOf(await call(client, "c64_joystick", { port: 3, direction: "left" })).code, "invalid-input");
  assert.equal(errorOf(await call(client, "c64_joystick", { port: 1, direction: "north" })).code, "invalid-input");
  await client.close();
});

test("c64_screen capture returns the size and an image block", async () => {
  const client = await connect(async () => new FakeSession());
  const result = await call(client, "c64_screen", { action: "capture" });
  assert.deepEqual(result.structuredContent, { width: 384, height: 272 });
  assert.deepEqual(result.content[1], { type: "image", data: Buffer.from("png-bytes").toString("base64"), mimeType: "image/png" });
  await client.close();
});

test("c64_breakpoint passes typed conditions through and checks fields per action", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  const added = await call(client, "c64_breakpoint", {
    action: "add",
    address: "$2100",
    condition: { kind: "register", register: "a", operator: "eq", value: 66 },
  });
  assert.deepEqual(added.structuredContent, { id: 1, address: "$2100", space: "c64", enabled: true });
  assert.deepEqual(session.points[0], {
    action: "add",
    address: 0x2100,
    space: "c64",
    condition: { kind: "register", register: "a", operator: "eq", value: 66 },
  });
  assert.deepEqual((await call(client, "c64_breakpoint", { action: "list" })).structuredContent, {
    breakpoints: [{ id: 1, address: "$2100", space: "c64", enabled: true }],
  });
  assert.deepEqual((await call(client, "c64_breakpoint", { action: "disable", id: 1 })).structuredContent, {
    id: 1,
    address: "$2100",
    space: "c64",
    enabled: false,
  });
  for (const args of [
    { action: "add" },
    { action: "remove" },
    { action: "list", id: 1 },
    { action: "remove", id: 1, address: "$1000" },
    { action: "add", address: "$1000", condition: { kind: "register", register: "a", operator: "eq", value: 1, extra: 1 } },
    { action: "add", address: "$1000", condition: "A == 1" },
  ]) {
    assert.equal(errorOf(await call(client, "c64_breakpoint", args)).code, "invalid-input", JSON.stringify(args));
  }
  await client.close();
});

test("c64_watchpoint fills size and space and needs access", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  const added = await call(client, "c64_watchpoint", {
    action: "add",
    address: "$c020",
    access: "write",
    condition: { kind: "memory", address: "$c020", operator: "eq", value: 3 },
  });
  assert.deepEqual(added.structuredContent, { id: 2, address: "$c020", size: 1, access: "write", space: "c64", enabled: true });
  assert.deepEqual(session.points[0], {
    action: "add",
    address: 0xc020,
    size: 1,
    access: "write",
    space: "c64",
    condition: { kind: "memory", address: 0xc020, operator: "eq", value: 3, space: "c64", view: "cpu" },
  });
  assert.equal(errorOf(await call(client, "c64_watchpoint", { action: "add", address: "$c020" })).code, "invalid-input");
  await client.close();
});

test("c64_run_until fills the timeout and passes typed targets", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  const result = await call(client, "c64_run_until", { target: { kind: "address", address: "$c00b" } });
  assert.deepEqual(result.structuredContent, { reached: true, stopReason: "target", state: "stopped", pc: "$c00b" });
  await call(client, "c64_run_until", { target: { kind: "memory", address: "$c020", operator: "eq", value: 3 }, timeoutFrames: 10 });
  await call(client, "c64_run_until", { target: { kind: "raster", line: 100, cycle: 20 } });
  assert.deepEqual(session.runs, [
    { target: { kind: "address", address: 0xc00b, space: "c64" }, timeoutFrames: 3000 },
    { target: { kind: "memory", address: 0xc020, operator: "eq", value: 3, space: "c64", view: "cpu" }, timeoutFrames: 10 },
    { target: { kind: "raster", line: 100, cycle: 20 }, timeoutFrames: 3000 },
  ]);
  for (const args of [
    { target: { kind: "address" } },
    { target: { kind: "pc", address: "$c000" } },
    { target: { kind: "raster", line: 1 }, timeoutFrames: 30001 },
  ]) {
    assert.equal(errorOf(await call(client, "c64_run_until", args)).code, "invalid-input", JSON.stringify(args));
  }
  await client.close();
});

test("tool descriptions keep to the STE length and punctuation rules", () => {
  for (const tool of ALL_TOOLS) {
    assert.doesNotMatch(tool.description, /;/, `${tool.name}: STE bans the semicolon`);
    // Split at a full stop that ends a sentence (not one inside "$c000" or a file extension).
    for (const sentence of tool.description.split(/\.\s+/)) {
      const words = sentence.split(/\s+/).filter((word) => word !== "");
      assert.ok(words.length <= 25, `${tool.name}: a sentence has ${words.length} words: ${sentence}`);
    }
  }
});

test("memory search parses the pattern and fills end and maxResults", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  const result = await call(client, "c64_memory_search", { start: "$0800", pattern: "A9 ?? 8d 20 d0" });
  assert.deepEqual(result.structuredContent, { matches: ["$2100", "$37a0"] });
  assert.deepEqual(session.searches[0], { start: 0x0800, end: 0xffff, pattern: [0xa9, null, 0x8d, 0x20, 0xd0], space: "c64", view: "cpu", maxResults: 100 });
  for (const pattern of ["", "a9 ?", "a9,8d", "?? ??", "a9  8d x"]) {
    assert.equal(errorOf(await call(client, "c64_memory_search", { start: "$0800", pattern })).code, "invalid-input", pattern);
  }
  await client.close();
});

test("memory compare and disassemble shape their results", async () => {
  const session = new FakeSession();
  const client = await connect(async () => session);
  const compared = await call(client, "c64_memory_compare", { left: { address: "$2000" }, right: { address: "$3000", view: "ram" }, size: 256 });
  assert.deepEqual(compared.structuredContent, { equal: false, differentBytes: 3, firstDifferences: [{ offset: 12, left: 4, right: 5 }] });
  assert.deepEqual(session.searches[0], {
    left: { address: 0x2000, space: "c64", view: "cpu" },
    right: { address: 0x3000, space: "c64", view: "ram" },
    size: 256,
  });
  const listing = await call(client, "c64_disassemble", { address: "$2100", count: 1 });
  assert.deepEqual(listing.structuredContent, { instructions: [{ address: "$2100", bytes: "a900", text: "LDA #$00" }] });
  await client.close();
});
