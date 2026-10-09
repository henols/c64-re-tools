#!/usr/bin/env tsx
// The human CLI (08 §5, 18 §10): installs the skills and the VICE MCP
// declaration into agent harnesses through AP SDK, and reports status. It is
// thin: AP SDK does the harness-specific work.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { PACKAGE } from "../../distribution/package.ts";
import { localToolContext } from "../native/local.ts";
import { localToolStatus } from "../native/status.ts";
import { WireFailure } from "../protocol.ts";
import { runApSdk } from "./ap-sdk.ts";
import { installedItems, parseTargets, tidyAfterUninstall, undoWindsurfProjectMcp, windsurfBefore, withoutWindsurfMcp, type Scope } from "./cleanup.ts";
import { hostStatusLines, toolLines } from "./status.ts";

const HELP = `c64-re-tools: Commodore 64 reverse engineering and development

Usage:
  c64-re-tools install   [--target <harnesses>] [--global]   install the skills and the VICE MCP
  c64-re-tools update    [--target <harnesses>] [--global]   install this version over an earlier one
  c64-re-tools uninstall [--target <harnesses>] [--global]   remove them
  c64-re-tools status                                        version, package, tools and the Host Runtime
  c64-re-tools --help

Harnesses: claude, codex, pi, opencode, gemini, copilot, cursor, windsurf
(comma-separated; default: all). Without --global the files go into the
current project; with --global into your home directory.

Run it in the project: npx -y ${PACKAGE.name}@latest install. The VICE
MCP declaration starts the latest c64-re-tools-mcp through npx. The Host
Runtime runs on the machine with VICE: start it there with
npx -y --package=${PACKAGE.name}@latest c64-re-tools-host.
It runs VICE and the tools that come with it (c1541, petcat). The skill
scripts run ACME, DXA and Ghidra themselves, on the machine of the agent.`;

const here = dirname(fileURLToPath(import.meta.url));

/** Runs the AP SDK CLI. Writes its error output to stderr and returns its exit status and its report. */
async function apSdk(command: "install" | "uninstall", flags: readonly string[]): Promise<{ code: number; output: string }> {
  // The report is printed after the CLI's own tidying, so the colours stay when this is a terminal.
  const run = await runApSdk(command, flags, localToolContext(), process.stdout.isTTY ? { env: { ...process.env, FORCE_COLOR: "1" } } : {});
  process.stderr.write(run.stderr);
  return { code: run.code, output: run.stdout };
}

async function status(): Promise<number> {
  console.log(`c64-re-tools ${PACKAGE.version}`);
  console.log(`Package: ${join(here, "..", "..")}`);
  console.log(`Node: ${process.version} (${process.execPath})`);
  // The skill scripts run these tools here, on this machine.
  for (const line of toolLines("Tools here:", await localToolStatus(localToolContext()))) console.log(line);
  for (const line of await hostStatusLines()) console.log(line);
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
      if (flags.length > 0) {
        console.error(`status takes no --target or --global.\n\n${HELP}`);
        return 2;
      }
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
