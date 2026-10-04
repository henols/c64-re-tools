// The built c64-re-tools-mcp over real stdio, against a real Host Runtime
// server with a stub session. Proves the MCP opens one session at start,
// passes the video standard, retries a host that was not up yet, and ends
// the session when the harness closes it.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { startHostServer, type HostServer, type ViceSessionFactory } from "../../../src/host/server.ts";
import { freePort } from "../../../src/host/vice/process.ts";

const root = resolve(import.meta.dirname, "../../..");

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
        if (op === "status") return { state: "running", videoStandard, warp: false } as never;
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

async function mcp(port: number, extraEnv: Record<string, string> = {}, cwd?: string): Promise<Client> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(root, "src/mcp/main.ts")],
    env: { ...env, C64RT_HOST: `127.0.0.1:${port}`, ...extraEnv },
    stderr: "ignore",
    ...(cwd === undefined ? {} : { cwd }),
  });
  const client = new Client({ name: "stdio-test", version: "0" });
  await client.connect(transport);
  return client;
}

async function status(client: Client): Promise<CallToolResult> {
  return (await client.callTool({ name: "c64_status", arguments: {} })) as CallToolResult;
}

test("the MCP opens one session at start and closes it when the harness disconnects", async () => {
  const state: StubState = { opened: [], closed: 0 };
  const server = await startHostServer({ port: 0, createViceSession: stub(state) });
  servers.push(server);
  const client = await mcp(server.port, { C64RT_VIDEO: "ntsc" });
  assert.equal((await client.listTools()).tools.length, 30, "the built server registers every 15 §37 tool");
  assert.deepEqual((await status(client)).structuredContent, { state: "running", videoStandard: "ntsc", warp: false });
  await status(client);
  assert.deepEqual(state.opened, ["ntsc"], "one MCP process must own exactly one session");
  await client.close();
  await waitFor(() => state.closed === 1);
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
  await waitFor(() => state.closed === 1);
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

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("condition not reached in time");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
