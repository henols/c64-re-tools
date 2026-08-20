#!/usr/bin/env node
// Throwaway MCP stdio client for phase 9 criterion 3(3) task 3 -- evidence, not a
// deliverable. Speaks the IDENTICAL JSON-RPC tools/call protocol over the IDENTICAL
// stdio channel to the IDENTICAL vice-proxy.ts process that Claude Code itself
// launches per .mcp.json -- the dispatch layer and the real broker stay in the call
// path. It is NOT a bypass of the tool surface.
//
// It IS weaker evidence than an agent deciding each call adaptively: this script's
// call sequence is fixed at argv-parse time, with no ability to react to an
// intermediate result the way a live agent session would. Record that limitation
// verbatim in the transcript that uses this harness's output.
//
// Never spawns a nested headless Claude Code session -- in this project those stall
// indefinitely and falsely report success (see this plan's live_task_discipline).
//
// Run with: node vice-tool-harness.mjs <mainRepoRoot> <toolName1> <argsJson1>
//           [<toolName2> <argsJson2> ...]
// Each tool call is argv-driven; no path or argument is ever interpolated into a
// shell string. A single vice-proxy.ts process handles ALL calls in this invocation,
// so one emulator lease (once vice_ping forces the broker to launch) covers the
// whole sequence.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const HARD_TIMEOUT_MS = 180000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

async function main() {
  const mainRepoRoot = process.argv[2];
  if (!mainRepoRoot) {
    console.error("Usage: node vice-tool-harness.mjs <mainRepoRoot> <toolName1> <argsJson1> [...]");
    process.exitCode = 1;
    return;
  }

  const callSpecs = [];
  for (let i = 3; i < process.argv.length; i += 2) {
    const name = process.argv[i];
    const argsJson = process.argv[i + 1] ?? "{}";
    let toolArguments;
    try {
      toolArguments = JSON.parse(argsJson);
    } catch (err) {
      console.error(`Failed to parse arguments JSON for tool "${name}":`, err);
      process.exitCode = 1;
      return;
    }
    callSpecs.push({ name, toolArguments });
  }

  const viceProxyPath = `${mainRepoRoot}/.claude/mcp/vice/vice-proxy.ts`;

  const transport = new StdioClientTransport({
    command: "node",
    args: [viceProxyPath],
    env: {
      ...process.env,
      MASTRA_TELEMETRY_DISABLED: "1",
    },
    stderr: "pipe",
  });

  const client = new Client({ name: "phase9-criterion3-harness", version: "0.0.0" });

  const overallResult = { calls: [] };

  try {
    await withTimeout(client.connect(transport), HARD_TIMEOUT_MS, "connect+initialize");
    console.log("CONNECT_INITIALIZE: ok");
  } catch (err) {
    console.log("CONNECT_INITIALIZE_FAILED:");
    console.log(JSON.stringify({ message: err?.message, stack: err?.stack, cause: err?.cause }, null, 2));
    process.exitCode = 1;
    return;
  }

  for (const spec of callSpecs) {
    console.log("");
    console.log(`CALLING: ${spec.name} ${JSON.stringify(spec.toolArguments)}`);
    try {
      const result = await withTimeout(
        client.callTool({ name: spec.name, arguments: spec.toolArguments }),
        HARD_TIMEOUT_MS,
        `callTool(${spec.name})`,
      );
      console.log(`RESULT (${spec.name}):`);
      console.log(JSON.stringify(result, null, 2));
      overallResult.calls.push({ name: spec.name, arguments: spec.toolArguments, result });
    } catch (err) {
      console.log(`FAILED (${spec.name}):`);
      const errInfo = { message: err?.message, code: err?.code, data: err?.data, stack: err?.stack, cause: err?.cause };
      console.log(JSON.stringify(errInfo, null, 2));
      overallResult.calls.push({ name: spec.name, arguments: spec.toolArguments, error: errInfo });
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
