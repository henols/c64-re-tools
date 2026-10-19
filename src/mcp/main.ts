#!/usr/bin/env tsx

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { Family } from "../machine.ts";
import { SpectrumSessionClient } from "../host-client/spectrum-session.ts";
import { ViceSessionClient } from "../host-client/vice-session.ts";
import { startTrace, trace } from "../trace.ts";
import { VIDEO_STANDARDS, WireFailure, type VideoStandard } from "../protocol/messages.ts";
import { createMcpServer, MCP_FAMILIES } from "./server.ts";
import { sessionSource } from "./session-source.ts";
import { debugTools } from "./tools/debug.ts";
import { executionTools } from "./tools/execution.ts";
import { inputTools } from "./tools/input.ts";
import { machineTools } from "./tools/machine.ts";
import { mediaTools } from "./tools/media.ts";
import { memoryTools } from "./tools/memory.ts";
import { spectrumTools } from "./tools/spectrum.ts";
import { videoTools } from "./tools/video.ts";
import { oldNodeRefusal, PACKAGE } from "../package.ts";

const HELP = `c64-re-tools-mcp

Usage:
  npx -y --package=${PACKAGE.name}@${PACKAGE.tag} c64-re-tools-mcp [--machine <family>]
  c64-re-tools-mcp --help

Runs the stateful MCP server of one machine family on stdio: --machine c64
(the default). Each c64-re-tools-mcp process owns one emulator, started by the
Host Runtime (c64-re-tools-host) when this server starts and stopped when it
exits. c64-re-tools install declares one server for each machine family that
it installs, through npx with the newest version of its channel.

Environment:
  C64RT_VIDEO           c64: pal (default) or ntsc; fixed for the life of the process.
  C64RT_SPECTRUM_MODEL  spectrum: 48k (default) or 128k; fixed for the life of the process.
  C64RT_HOST   host:port of the Host Runtime when it is not on 127.0.0.1:6464,
               host.docker.internal:6464 or host.containers.internal:6464.`;

function log(line: string): void {
  process.stderr.write(`c64-re-tools-mcp: ${line}\n`);
  trace().log(line);
}

/** The family of --machine, the C64 without it; undefined after a refusal is printed. */
function machineFamily(argv: readonly string[]): Family | undefined {
  const at = argv.indexOf("--machine");
  const value = at < 0 ? "c64" : argv[at + 1];
  if (value !== undefined && (MCP_FAMILIES as readonly string[]).includes(value)) return value as Family;
  process.stderr.write(`--machine must be one of ${MCP_FAMILIES.join(", ")}, not ${JSON.stringify(value ?? "")}.\n\n${HELP}\n`);
  process.exitCode = 2;
  return undefined;
}

/** The Spectrum model of C64RT_SPECTRUM_MODEL: 48k (the default) or 128k. */
function spectrumModel(env: NodeJS.ProcessEnv): "spectrum48" | "spectrum128" {
  const value = env.C64RT_SPECTRUM_MODEL ?? "48k";
  if (value === "48k" || value === "128k") return value === "48k" ? "spectrum48" : "spectrum128";
  throw new WireFailure("installation-incomplete", "C64RT_SPECTRUM_MODEL must be 48k or 128k. Fix the MCP server configuration and restart it.");
}

/** Serves an MCP server on stdio until the harness ends it; the end closes the session and its emulator. */
async function serve(server: Server, closeSession: () => Promise<void>): Promise<void> {
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    trace().event("mcp.stop");
    await closeSession();
    process.exit(0);
  };
  // The harness ends the server by closing stdin or by a signal; both end the session and its emulator.
  // Only the client holds the writing end of stdin: its end, close or error means that the client is gone.
  server.onclose = () => void stop();
  for (const event of ["end", "close", "error"] as const) process.stdin.once(event, () => void stop());
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.once(signal, () => void stop());
  await server.connect(new StdioServerTransport());
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
  const family = machineFamily(process.argv.slice(2));
  if (family === undefined) return;
  startTrace("mcp", { warn: log });
  if (family === "spectrum") {
    const machine = spectrumModel(process.env);
    const spectrum = sessionSource((signal) => SpectrumSessionClient.open({ machine, signal }), log, "Spectrum");
    await serve(createMcpServer({ family, tools: spectrumTools, session: spectrum.get, log }), spectrum.close);
    return;
  }
  const session = sessionSource((signal) => ViceSessionClient.open({ videoStandard: videoStandard(process.env), signal }), log);
  await serve(createMcpServer({ family, tools: [...machineTools, ...executionTools, ...debugTools, ...memoryTools, ...videoTools, ...inputTools, ...mediaTools], session: session.get, log }), session.close);
}

const oldNode = oldNodeRefusal();
if (oldNode !== undefined) {
  log(oldNode);
  process.exit(1);
}

await main();
