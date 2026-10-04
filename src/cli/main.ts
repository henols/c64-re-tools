#!/usr/bin/env tsx
// The human CLI (08 §5, 18 §10): installs the skills and the VICE MCP
// declaration into agent harnesses through AP SDK, and reports status. It is
// thin: AP SDK does the harness-specific work.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { HostConnection } from "../host-client/connect.ts";
import { hostTools } from "../host-client/tools.ts";
import { localToolContext } from "../native/local.ts";
import { localToolStatus } from "../native/status.ts";
import type { ToolStatus } from "../protocol.ts";

const HELP = `c64-re-tools: Commodore 64 reverse engineering and development

Usage:
  c64-re-tools install   [--target <harnesses>] [--global]   install the skills and the VICE MCP
  c64-re-tools update    [--target <harnesses>] [--global]   install this version over an earlier one
  c64-re-tools uninstall [--target <harnesses>] [--global]   remove them
  c64-re-tools status                                        version, programs, tools and the Host Runtime
  c64-re-tools --help

Harnesses: claude, codex, pi, opencode, gemini, copilot, cursor, windsurf
(comma-separated; default: all). Without --global the files go into the
current project; with --global into your home directory.

Run it in the project: npx -y @henols/c64-re-tools@latest install. The VICE
MCP declaration starts the latest c64-re-tools-mcp through npx. The Host
Runtime runs on the machine with VICE: start it there with
npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host.
It runs VICE and the tools that come with it (c1541, petcat). The skill
scripts run ACME, DXA and Ghidra themselves, on the machine of the agent.`;

const here = dirname(fileURLToPath(import.meta.url));

function packageVersion(): string {
  const path = join(here, "..", "..", "package.json");
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as { version: string }).version : "unknown";
}

/** Runs the AP SDK CLI of this package's own dependency. */
function apSdk(args: string[]): number {
  const plugin = join(here, "..", "..", "distribution", "plugin.ts");
  const cli = join(dirname(fileURLToPath(import.meta.resolve("@jalco/ap-sdk"))), "cli.js");
  const command = args[0]!;
  // execArgv keeps the TypeScript loader (tsx) for the plugin module under node_modules.
  const run = spawnSync(process.execPath, [...process.execArgv, cli, command, ...(command === "uninstall" ? ["c64-re-tools"] : [plugin]), ...args.slice(1)], { stdio: "inherit" });
  return run.status ?? 1;
}

function printTools(heading: string, tools: ToolStatus[]): void {
  console.log(heading);
  for (const tool of tools) {
    if (tool.runs) console.log(`  ${tool.name}: ${tool.version} (${tool.path})`);
    else if (tool.found) console.log(`  ${tool.name}: found at ${tool.path} but it does not run. ${tool.problem}`);
    else console.log(`  ${tool.name}: missing. ${tool.problem}`);
  }
}

async function status(): Promise<number> {
  console.log(`c64-re-tools ${packageVersion()}`);
  console.log(`Package: ${join(here, "..", "..")}`);
  console.log(`Node: ${process.version} (${process.execPath})`);
  // The skill scripts run these tools here, on this machine.
  printTools("Tools here:", await localToolStatus(localToolContext()));
  try {
    const connection = await HostConnection.open({ role: "tool" });
    await connection.close();
    console.log("Host Runtime: reachable");
  } catch (error) {
    console.log(`Host Runtime: not reachable. ${(error as Error).message}`);
    return 0;
  }
  // VICE and its tools live on the host; it finds and runs each one.
  printTools("Tools on the host:", await hostTools());
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: { target: { type: "string", short: "t" }, global: { type: "boolean", short: "g" }, help: { type: "boolean", short: "h" } },
  });
  const [command, ...rest] = positionals;
  if (values.help || command === undefined) {
    console.log(HELP);
    return 0;
  }
  if (rest.length > 0) {
    console.error(`Too many arguments.\n\n${HELP}`);
    return 2;
  }
  const flags = [...(values.target === undefined ? [] : ["--target", values.target]), ...(values.global ? ["--global"] : [])];
  switch (command) {
    case "install":
    case "update":
      return apSdk(["install", ...flags]);
    case "uninstall":
      return apSdk(["uninstall", ...flags]);
    case "status":
      return status();
    default:
      console.error(`Unknown command ${command}.\n\n${HELP}`);
      return 2;
  }
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code?.startsWith("ERR_PARSE_ARGS")) {
    console.error(`${(error as Error).message}\n\n${HELP}`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
