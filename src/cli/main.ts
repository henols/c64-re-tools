#!/usr/bin/env tsx
// The human CLI: installs the skills and the VICE MCP
// declaration into agent harnesses through AP SDK. It is thin: AP SDK does
// the harness-specific work.

import { FAMILIES, type Family } from "../machine.ts";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { oldNodeRefusal, PACKAGE } from "../package.ts";
import { localToolContext } from "../native/local.ts";
import { isRefusal } from "../errors.ts";
import { startTrace } from "../trace.ts";
import { runApSdk } from "./ap-sdk.ts";
import { installedItems, parseTargets, removeDroppedItems, tidyAfterUninstall, type Scope, undoWindsurfProjectMcp, windsurfBefore, withoutWindsurfMcp } from "./cleanup.ts";

const HELP = `c64-re-tools: Commodore 64 reverse engineering and development

Usage:
  c64-re-tools install   [--target <harnesses>] [--global] [--machines <families>]   install the skills and the MCP servers
  c64-re-tools update    [--target <harnesses>] [--global] [--machines <families>]   install this version over an earlier one
  c64-re-tools uninstall [--target <harnesses>] [--global]   remove them
  c64-re-tools --help

Harnesses: claude, codex, pi, opencode, gemini, copilot, cursor, windsurf
(comma-separated; default: all). Machine families: one MCP server each, named
after the family (comma-separated; default: the families installed now, else
c64). Without --global the files go into the
current folder; with --global into your home directory.

The dev container Feature of c64-re-tools runs install at the root of the
repository when it creates the container, and update at each start. Each
project folder below the root uses that install; a project is a folder with
.c64-re-tools/. The VICE MCP declaration starts the latest c64-re-tools-mcp
through npx. The Host Runtime runs on the machine with VICE: start it there
with npx -y --package=${PACKAGE.name}@${PACKAGE.tag} c64-re-tools-host.
It runs VICE and the tools that come with it (c1541, petcat). The skill
scripts run ACME, DXA, Exomizer and c64run in the dev container.`;


/**
 * The machine families to install an MCP server for: --machines, else the
 * families installed in the scope now, else the C64. A message when
 * --machines names an unknown family.
 */
function installMachines(given: string | undefined, scope: Scope): Family[] | string {
  if (given === undefined) {
    const installed = [...new Set(installedItems(scope, undefined).filter((item) => item.kind === "mcp").map((item) => item.name))].filter((name): name is Family => (FAMILIES as readonly string[]).includes(name));
    return installed.length > 0 ? installed : ["c64"];
  }
  const families = given.split(",").map((family) => family.trim());
  const unknown = families.filter((family) => !(FAMILIES as readonly string[]).includes(family));
  if (unknown.length > 0 || families.length === 0) return `--machines takes ${FAMILIES.join(", ")}, comma-separated, not ${JSON.stringify(given)}.`;
  return families as Family[];
}

/** Runs the AP SDK CLI. Writes its error output to stderr and returns its exit status and its report. */
async function apSdk(command: "install" | "uninstall", flags: readonly string[], machines?: readonly string[]): Promise<{ code: number; output: string }> {
  // The report is printed after the CLI's own tidying, so the colours stay when this is a terminal.
  const env = { ...process.env, ...(process.stdout.isTTY ? { FORCE_COLOR: "1" } : {}), ...(machines === undefined ? {} : { C64RT_MACHINES: machines.join(",") }) };
  const run = await runApSdk(command, flags, localToolContext(), { env });
  process.stderr.write(run.stderr);
  return { code: run.code, output: run.stdout };
}

async function main(argv: string[]): Promise<number> {
  startTrace("cli", { warn: (line) => console.error(line) });
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: { target: { type: "string", short: "t" }, global: { type: "boolean", short: "g" }, machines: { type: "string", short: "m" }, help: { type: "boolean", short: "h" } },
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
      const machines = installMachines(values.machines, scope);
      if (typeof machines === "string") {
        console.error(`${machines}\n\n${HELP}`);
        return 2;
      }
      const before = windsurfBefore();
      const earlier = installedItems(scope, targets);
      const { code, output } = await apSdk("install", flags, machines);
      // A project install leaves the home directory as it was.
      const note = scope === "project" && (targets === undefined || targets.includes("windsurf")) ? undoWindsurfProjectMcp(before) : undefined;
      process.stdout.write(note === undefined ? output : withoutWindsurfMcp(output));
      if (note !== undefined) console.log(`  ${note}\n`);
      // A skill that this version renamed or dropped must not stay next to the new ones. AP SDK can write its
      // new manifest and still exit with an error: then the next install no longer knows the dropped items, so
      // the cleanup runs after each install. An install that wrote no manifest drops nothing.
      const removed = removeDroppedItems(earlier, scope);
      if (removed.length > 0) console.log(`  Removed, because this version no longer has them: ${removed.join(", ")}\n`);
      return code;
    }
    case "uninstall": {
      const items = installedItems(scope, targets);
      const { code, output } = await apSdk("uninstall", flags);
      process.stdout.write(output);
      if (code === 0) tidyAfterUninstall(items, scope);
      return code;
    }
    default:
      console.error(`Unknown command ${command}.\n\n${HELP}`);
      return 2;
  }
}

const oldNode = oldNodeRefusal();
if (oldNode !== undefined) {
  console.error(oldNode);
  process.exit(1);
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code?.startsWith("ERR_PARSE_ARGS")) {
    console.error(`${(error as Error).message}\n\n${HELP}`);
    process.exitCode = 2;
  } else if (isRefusal(error)) {
    // A refusal by name, for example AP SDK that did not finish in time.
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
