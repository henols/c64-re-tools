// Milestone 1 acceptance (19 §3), against real VICE:
//   host → MCP → one VICE; read KERNAL bytes and registers; status is right;
//   terminating an MCP makes its VICE exit; two MCPs own two VICEs.
// Opt-in with C64RT_LIVE_VICE=/absolute/path/to/x64sc.

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { Command } from "../../../src/host/vice/binary-monitor.ts";
import { launchVice } from "../../../src/host/vice/process.ts";
import { ViceSession } from "../../../src/host/vice/session.ts";
import { liveEnv, liveLog, liveSkip, viceChildren } from "./live.ts";

const root = resolve(import.meta.dirname, "../../..");
const hosts: ChildProcess[] = [];
after(() => {
  for (const host of hosts) host.kill("SIGKILL");
});

/** Starts the built Host Runtime on a free port with VICE from C64RT_LIVE_VICE. */
async function startHost(): Promise<{ process: ChildProcess; port: number }> {
  const host = spawn(process.execPath, [resolve(root, "src/host/main.ts"), "--port", "0"], {
    env: liveEnv(),
    stdio: ["ignore", "pipe", "inherit"],
  });
  hosts.push(host);
  const [line] = (await once(createInterface({ input: host.stdout! }), "line")) as [string];
  const port = Number(/:(\d+)$/.exec(line)?.[1]);
  assert.ok(port > 0, line);
  return { process: host, port };
}

async function startMcp(port: number): Promise<{ client: Client; transport: StdioClientTransport }> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(root, "src/mcp/main.ts")],
    env: { ...env, C64RT_HOST: `127.0.0.1:${port}` },
    stderr: "inherit",
  });
  const client = new Client({ name: "acceptance", version: "0" });
  await client.connect(transport);
  return { client, transport };
}

async function tool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  assert.notEqual(result.isError, true, JSON.stringify(result.content));
  return result.structuredContent as Record<string, unknown>;
}

async function waitFor(condition: () => boolean, what: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`${what}: not reached in ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

test("host → MCP → one VICE: KERNAL bytes, registers and running state", { skip: liveSkip, timeout: 120_000 }, async () => {
  const host = await startHost();
  const { client } = await startMcp(host.port);
  try {
    // The KERNAL ROM starts at $e000 with the same bytes on every stock C64.
    const kernal = await tool(client, "c64_memory_read", { address: "$E000", size: 8 });
    assert.equal(kernal.address, "$e000");
    assert.equal(kernal.size, 8);
    assert.match(kernal.data as string, /^8556200f/);

    const registers = await tool(client, "c64_registers", { action: "get" });
    assert.match(registers.pc as string, /^\$[0-9a-f]{4}$/);
    for (const name of ["a", "x", "y", "sp"]) assert.ok(Number.isInteger(registers[name]));
    assert.equal(Object.keys(registers.flags as object).sort().join(""), "bcdinvz");

    // Reads keep the machine running, and a running machine reports no pc.
    assert.deepEqual(await tool(client, "c64_status"), { state: "running", videoStandard: "pal", warp: false, window: false });

    // A paused machine reports stopped with its pc, and reads keep it stopped.
    const paused = await tool(client, "c64_execution", { action: "pause" });
    assert.equal(paused.state, "stopped");
    assert.deepEqual(await tool(client, "c64_status"), { state: "stopped", videoStandard: "pal", warp: false, window: false, pc: paused.pc });
    await tool(client, "c64_memory_read", { address: "$e000", size: 1 });
    assert.equal((await tool(client, "c64_status")).state, "stopped");
    assert.deepEqual(await tool(client, "c64_execution", { action: "resume" }), { state: "running" });
    assert.equal(viceChildren(host.process.pid!).length, 1, "one MCP must own exactly one VICE");
  } finally {
    await client.close();
  }
  await waitFor(() => viceChildren(host.process.pid!).length === 0, "VICE exit after MCP close");
  host.process.kill("SIGTERM");
  const [code] = (await once(host.process, "exit")) as [number | null];
  // Windows has no SIGTERM: kill ends the runtime at once, and its watchdog cleans up (D7).
  if (process.platform !== "win32") assert.equal(code, 0);
});

test("a stopped machine reports stopped with its pc, and reads keep it stopped", { skip: liveSkip, timeout: 60_000 }, async () => {
  // Until c64_execution exists (M2) only the session can stop the machine;
  // a raw monitor command stops real VICE exactly as a breakpoint would.
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  const vice = await launchVice({ videoStandard: "pal", supervisor, env: liveEnv(), log: liveLog });
  const session = await ViceSession.start(vice, "pal");
  try {
    await vice.monitor.request(Command.ping);
    const stopped = await session.handle("status", {});
    assert.equal(stopped.state, "stopped");
    assert.ok(stopped.pc !== undefined);
    const registers = await session.handle("registersGet", { space: "c64" });
    assert.equal(registers.pc, stopped.pc);
    await session.handle("memoryRead", { address: 0xe000, size: 1, space: "c64", view: "cpu" });
    assert.equal((await session.handle("status", {})).state, "stopped", "a read must not resume a stopped machine");
  } finally {
    await session.close();
  }
});

test("terminating the MCP process, even with SIGKILL, makes its VICE exit", { skip: liveSkip, timeout: 120_000 }, async () => {
  const host = await startHost();
  const { client, transport } = await startMcp(host.port);
  await tool(client, "c64_status");
  await waitFor(() => viceChildren(host.process.pid!).length === 1, "VICE start");
  process.kill(transport.pid!, "SIGKILL");
  await waitFor(() => viceChildren(host.process.pid!).length === 0, "VICE exit after MCP SIGKILL");
  await client.close().catch(() => {});
  host.process.kill("SIGTERM");
  await once(host.process, "exit");
});

test("two MCP processes own two independent VICE processes", { skip: liveSkip, timeout: 120_000 }, async () => {
  const host = await startHost();
  const first = await startMcp(host.port);
  const second = await startMcp(host.port);
  try {
    await tool(first.client, "c64_status");
    await tool(second.client, "c64_status");
    await waitFor(() => viceChildren(host.process.pid!).length === 2, "two VICE processes");

    await first.client.close();
    await waitFor(() => viceChildren(host.process.pid!).length === 1, "first VICE exit");
    const kernal = await tool(second.client, "c64_memory_read", { address: "$e000", size: 2 });
    assert.equal(kernal.data, "8556", "the second session must survive the first one's end");
  } finally {
    await second.client.close();
  }
  await waitFor(() => viceChildren(host.process.pid!).length === 0, "second VICE exit");
  host.process.kill("SIGTERM");
  await once(host.process, "exit");
});

test("stopping the Host Runtime stops every VICE it started", { skip: liveSkip, timeout: 120_000 }, async () => {
  const host = await startHost();
  const mcps = [await startMcp(host.port), await startMcp(host.port)];
  for (const { client } of mcps) await tool(client, "c64_status");
  const vicePids = viceChildren(host.process.pid!);
  assert.equal(vicePids.length, 2);
  host.process.kill("SIGTERM");
  await once(host.process, "exit");
  await waitFor(() => vicePids.every((pid) => !isAlive(pid)), "every VICE gone after host stop");
  for (const { client } of mcps) await client.close();
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
