// Milestone 5 acceptance (19 §7): source → c64-assembler → Host Runtime → ACME
// → PRG → c64_program_load → VICE reaches a known state. Both execution
// surfaces share one Host Runtime; ACME never enters the MCP.
// Opt-in with C64RT_LIVE_VICE; also needs ACME on the host.

import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { ACME, findTool } from "../../../src/native/discover.ts";
import { liveEnv, liveSkip } from "./live.ts";

let skip: string | false = liveSkip;
if (skip === false) {
  try {
    findTool(ACME);
  } catch {
    skip = "ACME is not installed: install acme or set C64RT_ACME to run this test";
  }
}

const root = resolve(import.meta.dirname, "../../..");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-m5-"));
cpSync(resolve(import.meta.dirname, "../../fixtures/asm/counter"), join(project, "src"), { recursive: true });
const cleanups: Array<() => void> = [() => rmSync(project, { recursive: true, force: true })];
after(() => {
  for (const cleanup of cleanups) cleanup();
});

async function startHost(): Promise<{ process: ChildProcess; port: number }> {
  const host = spawn(process.execPath, [resolve(root, "dist/host/main.js"), "--port", "0"], { env: liveEnv(), stdio: ["ignore", "pipe", "inherit"] });
  cleanups.unshift(() => host.kill("SIGKILL"));
  const [line] = (await once(createInterface({ input: host.stdout! }), "line")) as [string];
  return { process: host, port: Number(/:(\d+)$/.exec(line)![1]) };
}

async function tool(client: Client, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  assert.notEqual(result.isError, true, `${name}: ${JSON.stringify(result.content)}`);
  return result.structuredContent as Record<string, unknown>;
}

test("assembled source loads into VICE and reaches its known end state", { skip, timeout: 180_000 }, async () => {
  const host = await startHost();
  const hostAddress = `127.0.0.1:${host.port}`;

  // 1. The skill script assembles through the Host Runtime and writes the PRG into the project.
  const assembled = spawnSync(
    process.execPath,
    [resolve(root, "skills/c64-assembler/scripts/assemble.ts"), "--source-root", "src", "--entry", "main.a", "--include", "lib", "--out", "build/counter.prg"],
    { cwd: project, env: { ...process.env, C64RT_HOST: hostAddress }, encoding: "utf8" },
  );
  assert.equal(assembled.status, 0, assembled.stdout + assembled.stderr);
  const build = JSON.parse(assembled.stdout) as { symbols: Array<{ name: string; address?: string; value?: number }> };
  const symbol = (name: string) => build.symbols.find((entry) => entry.name === name)!;

  // 2. The MCP loads it from the same project and runs it to the known state.
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(root, "dist/mcp/main.js")],
    env: { ...env, C64RT_HOST: hostAddress },
    cwd: project,
    stderr: "inherit",
  });
  const client = new Client({ name: "m5-acceptance", version: "0" });
  await client.connect(transport);
  try {
    const loaded = await tool(client, "c64_program_load", { path: "build/counter.prg" });
    assert.equal(loaded.loadAddress, "$0801");
    await tool(client, "c64_registers", { action: "set", values: { pc: symbol("start").address } });
    const reached = await tool(client, "c64_run_until", { target: { kind: "address", address: symbol("done").address }, timeoutFrames: 50 });
    assert.equal(reached.stopReason, "target");
    const result = await tool(client, "c64_memory_read", { address: `$${symbol("RESULT").value!.toString(16).padStart(4, "0")}`, size: 1 });
    assert.equal(Number.parseInt(result.data as string, 16), symbol("MAX").value, "the counter reached MAX");
    const border = await tool(client, "c64_memory_read", { address: "$d020", size: 1 });
    assert.equal(Number.parseInt(border.data as string, 16) & 0x0f, symbol("DONE_COLOR").value);
  } finally {
    await client.close();
    host.process.kill("SIGTERM");
    await once(host.process, "exit");
  }
});
