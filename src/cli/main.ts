#!/usr/bin/env node
// The human CLI (08 §5, 18 §10): installs the skills and the VICE MCP
// declaration into agent harnesses through AP SDK, and reports status. It is
// thin: AP SDK does the harness-specific work.

import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { HostConnection } from "../host-client/connect.ts";

const HELP = `c64-re-tools: Commodore 64 reverse engineering and development

Usage:
  c64-re-tools install   [--target <harnesses>] [--global]   install the skills and the VICE MCP
  c64-re-tools update    [--target <harnesses>] [--global]   install this version over an earlier one
  c64-re-tools uninstall [--target <harnesses>] [--global]   remove them
  c64-re-tools status                                        version, programs and the Host Runtime
  c64-re-tools --help

Harnesses: claude, codex, pi, opencode, gemini, copilot, cursor, windsurf
(comma-separated; default: all). Without --global the files go into the
current project; with --global into your home directory.

The VICE MCP runs the c64-re-tools-mcp program of this package. The Host
Runtime runs on the machine with VICE and the native tools: start it there
with c64-re-tools-host.`;

const here = dirname(fileURLToPath(import.meta.url));

function packageVersion(): string {
  const path = join(here, "..", "..", "package.json");
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as { version: string }).version : "unknown";
}

function onPath(program: string): string | undefined {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir === "") continue;
    try {
      accessSync(join(dir, program), constants.X_OK);
      return join(dir, program);
    } catch {
      // not in this directory
    }
  }
  return undefined;
}

/** Runs the AP SDK CLI of this package's own dependency. */
function apSdk(args: string[]): number {
  const plugin = join(here, "..", "plugin.js");
  if (!existsSync(plugin)) {
    console.error("This copy of c64-re-tools has no built plugin (dist/plugin.js). Install the package from npm, or run pnpm build.");
    return 1;
  }
  const cli = join(dirname(fileURLToPath(import.meta.resolve("@jalco/ap-sdk"))), "cli.js");
  const command = args[0]!;
  const run = spawnSync(process.execPath, [cli, command, ...(command === "uninstall" ? ["c64-re-tools"] : [plugin]), ...args.slice(1)], { stdio: "inherit" });
  return run.status ?? 1;
}

async function status(): Promise<number> {
  console.log(`c64-re-tools ${packageVersion()}`);
  for (const program of ["c64-re-tools-mcp", "c64-re-tools-host"]) {
    const path = onPath(program);
    console.log(`${program}: ${path ?? "not on PATH (install the package with npm install -g @henols/c64-re-tools)"}`);
  }
  try {
    const connection = await HostConnection.open({ role: "tool" });
    await connection.close();
    console.log("Host Runtime: reachable");
  } catch (error) {
    console.log(`Host Runtime: not reachable. ${(error as Error).message}`);
  }
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
