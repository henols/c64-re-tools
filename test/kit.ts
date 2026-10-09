// Helpers shared by the integration and end-to-end tests.

import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = resolve(import.meta.dirname, "..");

/** Polls `condition` until it holds; throws with `what` when it does not hold within `timeoutMs`. */
export async function waitFor(condition: () => boolean, what: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`${what}: not reached in ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

export interface McpOptions {
  /** The project directory of the agent. */
  cwd?: string;
  /** More environment variables for the MCP server. */
  env?: Record<string, string>;
  /** "ignore" for a test that provokes errors on purpose. */
  stderr?: "inherit" | "ignore";
}

/** Starts the MCP server from this checkout as an agent does, connected to the Host Runtime at `address` (host:port). */
export async function startMcp(address: string, options: McpOptions = {}): Promise<{ client: Client; transport: StdioClientTransport }> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [...process.execArgv, resolve(root, "src/mcp/main.ts")],
    env: { ...env, C64RT_HOST: address, ...options.env },
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    stderr: options.stderr ?? "inherit",
  });
  const client = new Client({ name: "c64-re-tools-test", version: "0" });
  await client.connect(transport);
  return { client, transport };
}
