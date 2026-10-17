#!/usr/bin/env tsx

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ViceSessionClient } from "../host-client/vice-session.ts";
import { elapsedMs, startTrace, trace } from "../trace.ts";
import { VIDEO_STANDARDS, WireFailure, type VideoStandard } from "../protocol/messages.ts";
import { createMcpServer, type SessionSource } from "./server.ts";
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

/**
 * One session at a time (1 MCP = 1 session = 1 VICE). It opens at start; if
 * that fails (for example the host was not running yet), the next tool call
 * tries again. When the host connection is lost, the next call opens a new
 * session. A lost session that the emulator answered first gives its
 * machine-state-lost once, unless a pending call got it already. Close stops
 * an open that is still waiting for the host at once.
 */
function sessionSource(): { get: SessionSource; close(): Promise<void> } {
  let opening: Promise<ViceSessionClient> | undefined;
  let lostNotice: WireFailure | undefined;
  let closed = false;
  const stop = new AbortController();
  const open = () => {
    const started = performance.now();
    const current = (async () => ViceSessionClient.open({ videoStandard: videoStandard(process.env), signal: stop.signal }))();
    opening = current;
    void current.then(
      (client) => {
        trace().event("session.opened", { ms: elapsedMs(started) });
        void client.closed.then(() => drop(current, client));
      },
      () => {},
    );
    current.catch((error: unknown) => {
      log(`session not opened: ${error instanceof Error ? error.message : String(error)}`);
      if (opening === current) opening = undefined;
    });
    return current;
  };
  /** Forgets a lost session, once; the next call opens a new one. */
  const drop = (current: Promise<ViceSessionClient>, client: ViceSessionClient) => {
    if (closed || opening !== current) return;
    log("the connection to the host runtime was lost; the next call opens a new session");
    opening = undefined;
    if (client.answered) lostNotice = client.unreportedLoss;
  };
  open();
  const get = async (): Promise<ViceSessionClient> => {
    if (closed) throw new WireFailure("machine-unavailable", "The C64 session is shutting down.");
    if (lostNotice !== undefined) {
      const notice = lostNotice;
      lostNotice = undefined;
      throw notice;
    }
    const current = opening ?? open();
    const client = await current;
    if (!client.lost) return client;
    // The loss is known here before the close event reaches drop.
    drop(current, client);
    return get();
  };
  return {
    get,
    async close() {
      closed = true;
      stop.abort();
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
  startTrace("mcp", { warn: log });
  const session = sessionSource();
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
  server.onclose = () => void stop();
  process.stdin.once("end", () => void stop());
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());

  await server.connect(new StdioServerTransport());
}

const oldNode = oldNodeRefusal();
if (oldNode !== undefined) {
  log(oldNode);
  process.exit(1);
}

await main();
