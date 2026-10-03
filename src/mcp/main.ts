#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ViceSessionClient } from "../host-client/vice-session.ts";
import { VIDEO_STANDARDS, WireFailure, type VideoStandard } from "../protocol.ts";
import { createMcpServer, type SessionSource } from "./server.ts";
import { machineTools } from "./tools/machine.ts";
import { memoryTools } from "./tools/memory.ts";

const HELP = `c64-re-tools-mcp

Usage:
  c64-re-tools-mcp
  c64-re-tools-mcp --help

Runs the stateful C64 MCP server on stdio. Each c64-re-tools-mcp process owns
one C64 emulator, started by the c64-re-tools-host Host Runtime when this
server starts and stopped when it exits.

Environment:
  C64RT_VIDEO  pal (default) or ntsc; fixed for the life of the process.
  C64RT_HOST   host:port of the Host Runtime when it is not on 127.0.0.1:6464,
               host.docker.internal:6464 or host.containers.internal:6464.`;

function log(line: string): void {
  process.stderr.write(`c64-re-tools-mcp: ${line}\n`);
}

function videoStandard(env: NodeJS.ProcessEnv): VideoStandard {
  const value = env.C64RT_VIDEO ?? "pal";
  if ((VIDEO_STANDARDS as readonly string[]).includes(value)) return value as VideoStandard;
  throw new WireFailure("installation-incomplete", "C64RT_VIDEO must be pal or ntsc. Fix the MCP server configuration and restart it.");
}

/**
 * One session for the life of the process (1 MCP = 1 session = 1 VICE).
 * It opens at start; if that fails before a session existed (for example the
 * host was not running yet), the next tool call tries again. Once a session
 * existed, its loss is final and reported by the session itself.
 */
function sessionSource(): { get: SessionSource; close(): Promise<void> } {
  let opening: Promise<ViceSessionClient> | undefined;
  let closed = false;
  const open = () => {
    opening = (async () => ViceSessionClient.open({ videoStandard: videoStandard(process.env) }))();
    opening.catch((error: unknown) => {
      log(`session not opened: ${error instanceof Error ? error.message : String(error)}`);
      opening = undefined;
    });
    return opening;
  };
  open();
  return {
    get: () => {
      if (closed) return Promise.reject(new WireFailure("machine-unavailable", "The C64 session is shutting down."));
      return opening ?? open();
    },
    async close() {
      closed = true;
      const session = await opening?.catch(() => undefined);
      await session?.close();
    },
  };
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  const session = sessionSource();
  const server = createMcpServer({ tools: [...machineTools, ...memoryTools], session: session.get, log });

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await session.close();
    process.exit(0);
  };
  // The harness ends the server by closing stdin or by a signal; both end the session and its emulator.
  server.onclose = () => void stop();
  process.stdin.once("end", () => void stop());
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());

  await server.connect(new StdioServerTransport());
}

await main();
