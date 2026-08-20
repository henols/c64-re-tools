#!/usr/bin/env node
// Throwaway MCP Streamable-HTTP client for phase 9 criterion 2 -- evidence, not a
// deliverable. Connects to a live regenerator2000 --mcp-server instance, lists
// tools, and calls one tool argv-driven (never string-interpolated into a shell
// command, per T-09-03-D). A refusal is the finding, so every step is wrapped in
// try/catch and the full error object is printed rather than thrown away.
//
// Run with: node mcp-harness.mjs <toolName> '<jsonArguments>'
// Resolves the already-vendored SDK from the main checkout's
// .claude/mcp/vice/node_modules via a node_modules symlink placed alongside this
// script in $PROBE_DIR (see criterion2-pty-transcript.txt for the exact setup).

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const TIMEOUT_MS = 30000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function main() {
  const toolName = process.argv[2];
  const argsJson = process.argv[3] ?? "{}";
  let toolArguments;
  try {
    toolArguments = JSON.parse(argsJson);
  } catch (err) {
    console.error("Failed to parse tool arguments JSON:", err);
    process.exitCode = 1;
    return;
  }

  const transport = new StreamableHTTPClientTransport(new URL("http://127.0.0.1:3000/mcp"));
  const client = new Client({ name: "r2000-probe", version: "0.0.0" });

  try {
    await withTimeout(client.connect(transport), TIMEOUT_MS, "connect");
  } catch (err) {
    console.log("CONNECT_FAILED:");
    console.log(JSON.stringify({ message: err?.message, stack: err?.stack, cause: err?.cause }, null, 2));
    process.exitCode = 1;
    return;
  }

  try {
    const tools = await withTimeout(client.listTools(), TIMEOUT_MS, "listTools");
    console.log("LIST_TOOLS_RESULT:");
    console.log(JSON.stringify(tools, null, 2));
  } catch (err) {
    console.log("LIST_TOOLS_FAILED:");
    console.log(JSON.stringify({ message: err?.message, stack: err?.stack, cause: err?.cause }, null, 2));
  }

  if (toolName) {
    try {
      const result = await withTimeout(
        client.callTool({ name: toolName, arguments: toolArguments }),
        TIMEOUT_MS,
        "callTool",
      );
      console.log("CALL_TOOL_RESULT:");
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.log("CALL_TOOL_FAILED:");
      console.log(
        JSON.stringify(
          { message: err?.message, code: err?.code, data: err?.data, stack: err?.stack, cause: err?.cause },
          null,
          2,
        ),
      );
    }
  }

  try {
    await client.close();
  } catch {
    // best-effort close; not part of the finding
  }
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exitCode = 1;
});
