// c64-re-tools-mcp from this checkout over real stdio, against a real Host Runtime
// server with a stub session. Proves the MCP opens one session at start,
// passes the video standard, retries a host that was not up yet, and ends
// the session when the harness closes it.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { startHostServer, type HostServer, type ViceSessionFactory } from "../../../src/host/server.ts";
import { freePort } from "../../../src/host/vice/process.ts";
import { startMcp, waitFor } from "../../kit.ts";

/** Every tool that the MCP server registers. */
const TOOLS = [
  "c64_autostart", "c64_backtrace", "c64_breakpoint", "c64_cia", "c64_cpu_history", "c64_disassemble", "c64_disk_attach", "c64_execution",
  "c64_joystick", "c64_keyboard", "c64_memmap", "c64_memory_compare", "c64_memory_read", "c64_memory_search", "c64_memory_write", "c64_observe",
  "c64_profile", "c64_program_load", "c64_registers", "c64_reset", "c64_run_until", "c64_screen", "c64_sid", "c64_snapshot",
  "c64_sprite", "c64_status", "c64_timing", "c64_vicii", "c64_warp", "c64_watchpoint", "c64_window",
];

interface StubState {
  opened: string[];
  closed: number;
  received?: Buffer[];
}

function stub(state: StubState): ViceSessionFactory {
  return async ({ videoStandard }) => {
    state.opened.push(videoStandard);
    return {
      async handle(op, _params, attachments) {
        if (op === "status") return { state: "running", videoStandard, warp: false, window: false } as never;
        if (op === "programLoad") {
          state.received = attachments ?? [];
          return { state: "stopped", loadAddress: 0x0801, size: (attachments?.[0]?.length ?? 2) - 2 } as never;
        }
        throw new Error("not in this stub");
      },
      async close() {
        state.closed++;
      },
    };
  };
}

const servers: HostServer[] = [];
after(async () => {
  await Promise.all(servers.map((server) => server.close()));
});

async function mcp(port: number, env: Record<string, string> = {}, cwd?: string): Promise<Client> {
  return (await startMcp(`127.0.0.1:${port}`, { env, stderr: "ignore", ...(cwd === undefined ? {} : { cwd }) })).client;
}

async function status(client: Client): Promise<CallToolResult> {
  return (await client.callTool({ name: "c64_status", arguments: {} })) as CallToolResult;
}

test("the MCP opens one session at start and closes it when the harness disconnects", async () => {
  const state: StubState = { opened: [], closed: 0 };
  const server = await startHostServer({ port: 0, createViceSession: stub(state) });
  servers.push(server);
  const client = await mcp(server.port, { C64RT_VIDEO: "ntsc" });
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(), TOOLS);
  assert.deepEqual((await status(client)).structuredContent, { state: "running", videoStandard: "ntsc", warp: false, window: false });
  await status(client);
  assert.deepEqual(state.opened, ["ntsc"], "one MCP process must own exactly one session");
  await client.close();
  await waitFor(() => state.closed === 1, "the session closed");
});

test("a host that starts after the MCP is used on the next tool call", async () => {
  const port = await freePort();
  const client = await mcp(port);
  const first = await status(client);
  assert.equal(first.isError, true);
  assert.equal(JSON.parse((first.content[0] as { text: string }).text).code, "machine-unavailable");

  const state: StubState = { opened: [], closed: 0 };
  servers.push(await startHostServer({ port, createViceSession: stub(state) }));
  assert.equal((await status(client)).isError, undefined);
  assert.equal(state.opened.length, 1);
  await client.close();
  await waitFor(() => state.closed === 1, "the session closed");
});

test("a bad C64RT_VIDEO is reported to the caller", async () => {
  const state: StubState = { opened: [], closed: 0 };
  const server = await startHostServer({ port: 0, createViceSession: stub(state) });
  servers.push(server);
  const client = await mcp(server.port, { C64RT_VIDEO: "secam" });
  const result = await status(client);
  assert.equal(JSON.parse((result.content[0] as { text: string }).text).code, "installation-incomplete");
  assert.equal(state.opened.length, 0);
  await client.close();
});

test("a project path is read in the MCP's working directory and only its bytes reach the host", async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-project-"));
  try {
    mkdirSync(join(project, "build"));
    const prg = Buffer.from([0x01, 0x08, 0xa9, 0x00, 0x60]);
    writeFileSync(join(project, "build", "game.prg"), prg);
    const state: StubState = { opened: [], closed: 0 };
    const server = await startHostServer({ port: 0, createViceSession: stub(state) });
    servers.push(server);
    const client = await mcp(server.port, {}, project);
    const result = (await client.callTool({ name: "c64_program_load", arguments: { path: "build/game.prg" } })) as CallToolResult;
    assert.deepEqual(result.structuredContent, { state: "stopped", loadAddress: "$0801", size: 3 });
    assert.deepEqual(state.received, [prg]);
    const missing = (await client.callTool({ name: "c64_program_load", arguments: { path: "build/none.prg" } })) as CallToolResult;
    assert.equal(JSON.parse((missing.content[0] as { text: string }).text).code, "not-found");
    await client.close();
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

