#!/usr/bin/env tsx
// The human CLI (08 §5, 18 §10): installs the skills and the VICE MCP
// declaration into agent harnesses through AP SDK, and reports status. It is
// thin: AP SDK does the harness-specific work.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { hostTools } from "../host-client/tools.ts";
import { localToolContext } from "../native/local.ts";
import { localToolStatus } from "../native/status.ts";
import { WireFailure, type ToolStatus } from "../protocol.ts";
import { runApSdk } from "./ap-sdk.ts";
import { installedItems, parseTargets, tidyAfterUninstall, undoWindsurfProjectMcp, windsurfBefore, withoutWindsurfMcp, type Scope } from "./cleanup.ts";

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

/** Runs the AP SDK CLI. Writes its error output to stderr and returns its exit status and its report. */
async function apSdk(command: "install" | "uninstall", flags: readonly string[]): Promise<{ code: number; output: string }> {
  // The report is printed after the CLI's own tidying, so the colours stay when this is a terminal.
  const run = await runApSdk(command, flags, localToolContext(), process.stdout.isTTY ? { env: { ...process.env, FORCE_COLOR: "1" } } : {});
  process.stderr.write(run.stderr);
  return { code: run.code, output: run.stdout };
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
  // VICE and its tools live on the host; it finds and runs each one. One
  // request shows both that the host answers and what it has.
  let hostToolStatus: ToolStatus[];
  try {
    hostToolStatus = await hostTools();
  } catch (error) {
    console.log(`Host Runtime: not reachable. ${(error as Error).message}`);
    return 0;
  }
  console.log("Host Runtime: reachable");
  printTools("Tools on the host:", hostToolStatus);
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
  const scope: Scope = values.global ? "global" : "project";
  const targets = parseTargets(values.target);
  switch (command) {
    case "install":
    case "update": {
      const before = windsurfBefore();
      const { code, output } = await apSdk("install", flags);
      // A project install leaves the home directory as it was (D21).
      const note = scope === "project" && (targets === undefined || targets.includes("windsurf")) ? undoWindsurfProjectMcp(before) : undefined;
      process.stdout.write(note === undefined ? output : withoutWindsurfMcp(output));
      if (note !== undefined) console.log(`  ${note}\n`);
      return code;
    }
    case "uninstall": {
      const items = installedItems(scope, targets);
      const { code, output } = await apSdk("uninstall", flags);
      process.stdout.write(output);
      if (code === 0) tidyAfterUninstall(items, scope);
      return code;
    }
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
  } else if (error instanceof WireFailure) {
    // A refusal by name, for example AP SDK that did not finish in time.
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
