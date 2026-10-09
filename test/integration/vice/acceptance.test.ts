// Against real VICE: host → MCP → one VICE; read KERNAL bytes and
// registers; status is right; terminating an MCP makes its VICE exit; two
// MCPs own two VICEs.
// Opt-in with C64RT_LIVE_VICE=/absolute/path/to/x64sc.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { isAlive, ProcessSupervisor } from "../../../src/native/processes.ts";
import { Command } from "../../../src/host/vice/binary-monitor.ts";
import { launchVice } from "../../../src/host/vice/process.ts";
import { ViceSession } from "../../../src/host/vice/session.ts";
import { startMcp, waitFor } from "../../kit.ts";
import { liveEnv, liveLog, liveSkip, startHost, stopHosts, viceChildren } from "./live.ts";

after(stopHosts);

async function tool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  assert.notEqual(result.isError, true, JSON.stringify(result.content));
  return result.structuredContent as Record<string, unknown>;
}

test("host → MCP → one VICE: KERNAL bytes, registers and running state", { skip: liveSkip, timeout: 120_000 }, async () => {
  const host = await startHost();
  const { client } = await startMcp(host.address);
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
  await waitFor(() => viceChildren(host.process.pid!).length === 0, "VICE exit after MCP close", 20_000);
  const code = await host.stop();
  // Windows has no SIGTERM: the kill ends the runtime at once, and its watchdog stops VICE.
  if (process.platform !== "win32") assert.equal(code, 0);
});

test("a stopped machine reports stopped with its pc, and reads keep it stopped", { skip: liveSkip, timeout: 60_000 }, async () => {
  // A raw monitor command stops real VICE exactly as a breakpoint would.
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
  const { client, transport } = await startMcp(host.address);
  await tool(client, "c64_status");
  await waitFor(() => viceChildren(host.process.pid!).length === 1, "VICE start", 20_000);
  process.kill(transport.pid!, "SIGKILL");
  await waitFor(() => viceChildren(host.process.pid!).length === 0, "VICE exit after MCP SIGKILL", 20_000);
  await client.close().catch(() => {});
  await host.stop();
});

test("two MCP processes own two independent VICE processes", { skip: liveSkip, timeout: 120_000 }, async () => {
  const host = await startHost();
  const first = await startMcp(host.address);
  const second = await startMcp(host.address);
  try {
    await tool(first.client, "c64_status");
    await tool(second.client, "c64_status");
    await waitFor(() => viceChildren(host.process.pid!).length === 2, "two VICE processes", 20_000);

    await first.client.close();
    await waitFor(() => viceChildren(host.process.pid!).length === 1, "first VICE exit", 20_000);
    const kernal = await tool(second.client, "c64_memory_read", { address: "$e000", size: 2 });
    assert.equal(kernal.data, "8556", "the second session must survive the first one's end");
  } finally {
    await second.client.close();
  }
  await waitFor(() => viceChildren(host.process.pid!).length === 0, "second VICE exit", 20_000);
  await host.stop();
});

test("stopping the Host Runtime stops every VICE it started", { skip: liveSkip, timeout: 120_000 }, async () => {
  const host = await startHost();
  const mcps = [await startMcp(host.address), await startMcp(host.address)];
  for (const { client } of mcps) await tool(client, "c64_status");
  const vicePids = viceChildren(host.process.pid!);
  assert.equal(vicePids.length, 2);
  await host.stop();
  await waitFor(() => vicePids.every((pid) => !isAlive(pid)), "every VICE gone after host stop", 20_000);
  for (const { client } of mcps) await client.close();
});
