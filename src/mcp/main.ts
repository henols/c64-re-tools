#!/usr/bin/env tsx

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ViceSessionClient } from "../host-client/vice-session.ts";
import { startTrace, trace } from "../trace.ts";
import { VIDEO_STANDARDS, WireFailure, type VideoStandard } from "../protocol/messages.ts";
import { createMcpServer } from "./server.ts";
import { sessionSource } from "./session-source.ts";
import { debugTools } from "./tools/debug.ts";
import { executionTools } from "./tools/execution.ts";
import { inputTools } from "./tools/input.ts";
import { machineTools } from "./tools/machine.ts";
import { mediaTools } from "./tools/media.ts";
import { memoryTools } from "./tools/memory.ts";
import { videoTools } from "./tools/video.ts";
import { oldNodeRefusal, PACKAGE } from "../package.ts";

const HELP = `c64-re-tools-mcp

Usage:
  npx -y --package=${PACKAGE.name}@${PACKAGE.tag} c64-re-tools-mcp
  c64-re-tools-mcp --help

Runs the stateful C64 MCP server on stdio. Each c64-re-tools-mcp process owns
one C64 emulator, started by the Host Runtime (c64-re-tools-host) when this
server starts and stopped when it exits. c64-re-tools install declares it for
the agent, through npx with the newest version of its channel.

Environment:
  C64RT_VIDEO  pal (default) or ntsc; fixed for the life of the process.
  C64RT_HOST   host:port of the Host Runtime when it is not on 127.0.0.1:6464,
               host.docker.internal:6464 or host.containers.internal:6464.`;

function log(line: string): void {
  process.stderr.write(`c64-re-tools-mcp: ${line}\n`);
  trace().log(line);
}

function videoStandard(env: NodeJS.ProcessEnv): VideoStandard {
  const value = env.C64RT_VIDEO ?? "pal";
  if ((VIDEO_STANDARDS as readonly string[]).includes(value)) return value as VideoStandard;
  throw new WireFailure("installation-incomplete", "C64RT_VIDEO must be pal or ntsc. Fix the MCP server configuration and restart it.");
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  startTrace("mcp", { warn: log });
  const session = sessionSource((signal) => ViceSessionClient.open({ videoStandard: videoStandard(process.env), signal }), log);
  const server = createMcpServer({ tools: [...machineTools, ...executionTools, ...debugTools, ...memoryTools, ...videoTools, ...inputTools, ...mediaTools], session: session.get, log });

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    trace().event("mcp.stop");
    await session.close();
    process.exit(0);
  };
  // The harness ends the server by closing stdin or by a signal; both end the session and its emulator.
  // Only the client holds the writing end of stdin: its end, close or error means that the client is gone.
  server.onclose = () => void stop();
  for (const event of ["end", "close", "error"] as const) process.stdin.once(event, () => void stop());
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.once(signal, () => void stop());

  await server.connect(new StdioServerTransport());
}

const oldNode = oldNodeRefusal();
if (oldNode !== undefined) {
  log(oldNode);
  process.exit(1);
}

await main();
