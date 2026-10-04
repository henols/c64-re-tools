// Milestone 2 acceptance (19 §4), against real VICE through the built host
// and MCP: load a fixture PRG, run, send input, run until a known address,
// advance an exact frame count, read memory and registers, capture the
// screen. The scenario runs twice and gives identical results, with no
// wall-clock waits anywhere in it.

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { readPng } from "../../../src/host/vice/png.testkit.ts";
import { FRAMES_SEEN, joystickCounterPrg, LEFT_SEEN } from "../../fixtures/prg/joystick-counter.ts";
import { liveEnv, liveSkip } from "./live.ts";

const root = resolve(import.meta.dirname, "../../..");
const cleanups: Array<() => void> = [];
after(() => {
  for (const cleanup of cleanups) cleanup();
});

async function startHost(): Promise<{ process: ChildProcess; port: number }> {
  const host = spawn(process.execPath, [resolve(root, "src/host/main.ts"), "--port", "0"], { env: liveEnv(), stdio: ["ignore", "pipe", "inherit"] });
  cleanups.push(() => host.kill("SIGKILL"));
  const [line] = (await once(createInterface({ input: host.stdout! }), "line")) as [string];
  return { process: host, port: Number(/:(\d+)$/.exec(line)![1]) };
}

async function startMcp(port: number, project: string): Promise<Client> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(root, "src/mcp/main.ts")],
    env: { ...env, C64RT_HOST: `127.0.0.1:${port}` },
    cwd: project,
    stderr: "inherit",
  });
  const client = new Client({ name: "m2-acceptance", version: "0" });
  await client.connect(transport);
  return client;
}

async function tool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<{ result: Record<string, unknown>; raw: CallToolResult }> {
  const raw = (await client.callTool({ name, arguments: args })) as CallToolResult;
  assert.notEqual(raw.isError, true, `${name}: ${JSON.stringify(raw.content)}`);
  return { result: raw.structuredContent as Record<string, unknown>, raw };
}

const hex = (value: number) => `$${value.toString(16).padStart(4, "0")}`;

/** The scenario. Every step is driven by emulated time, so two runs must agree exactly. */
async function scenario(client: Client) {
  // D21: the reset stops at the reset vector and says where.
  assert.deepEqual((await tool(client, "c64_reset", { mode: "hard" })).result, { state: "stopped", pc: "$fce2" });
  const loaded = (await tool(client, "c64_program_load", { path: "build/counter.prg" })).result;
  assert.deepEqual(loaded, { state: "stopped", loadAddress: "$c000", size: joystickCounterPrg.length - 2 });
  await tool(client, "c64_registers", { action: "set", values: { pc: "$c000" } });
  await tool(client, "c64_joystick", { port: 2, direction: "left" });

  const reached = (await tool(client, "c64_run_until", { target: { kind: "address", address: hex(LEFT_SEEN) }, timeoutFrames: 10 })).result;
  assert.deepEqual(reached, { reached: true, stopReason: "target", state: "stopped", pc: hex(LEFT_SEEN) });

  const advanced = (await tool(client, "c64_execution", { action: "advance-frames", count: 20 })).result;
  assert.deepEqual(advanced, { state: "stopped", pc: hex(LEFT_SEEN), advancedFrames: 20 });

  const counters = (await tool(client, "c64_memory_read", { address: hex(FRAMES_SEEN), size: 2 })).result;
  // One frame to reach the target, then 20 more; left was held for the 20.
  assert.deepEqual(counters, { address: "$c100", size: 2, data: "1514" });
  const registers = (await tool(client, "c64_registers", { action: "get" })).result;

  const screen = await tool(client, "c64_screen", { action: "capture" });
  const image = (screen.raw.content as Array<{ type: string; data?: string }>).find((block) => block.type === "image")!;
  const png = Buffer.from(image.data!, "base64");
  assert.equal(readPng(png).pixels[0], 2, "the border is red while left is held");

  await tool(client, "c64_joystick", { port: 2, direction: "center" });
  await tool(client, "c64_execution", { action: "advance-frames", count: 5 });
  const after = (await tool(client, "c64_memory_read", { address: hex(FRAMES_SEEN), size: 2 })).result;
  // Five more frames. The INC at LEFT_SEEN that the stop interrupted still runs once; then left is no longer seen.
  assert.equal(after.data, "1a15");
  return { loaded, reached, advanced, counters, registers, png: png.toString("base64"), after };
}

test("the M2 scenario is deterministic against real VICE", { skip: liveSkip, timeout: 180_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-m2-"));
  cleanups.push(() => rmSync(project, { recursive: true, force: true }));
  mkdirSync(join(project, "build"));
  writeFileSync(join(project, "build", "counter.prg"), joystickCounterPrg);

  const host = await startHost();
  const client = await startMcp(host.port, project);
  try {
    const first = await scenario(client);
    const second = await scenario(client);
    assert.deepEqual(second, first);
  } finally {
    await client.close();
    host.process.kill("SIGTERM");
    await once(host.process, "exit");
  }
});
