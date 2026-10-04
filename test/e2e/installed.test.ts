// Milestone 11 acceptance (19 §13), on the install route of D17: the packed
// package run through npx, as the published one is (npx installs it under
// node_modules, and tsx runs its TypeScript there). No build, no links:
//   npm pack → npx … c64-re-tools install in a fresh project → the Host
//   Runtime and the MCP through npx, the MCP as .mcp.json declares it except
//   for the package (the tarball, not @latest from the registry), with real
//   VICE → skill scripts, a local one and one that runs ACME, from their
//   installed location.
// Opt-in with C64RT_LIVE_VICE; needs npm registry access for the
// dependencies, and ACME for the ACME part. A private npm cache keeps
// ~/.npm untouched.

import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { ACME, findTool } from "../../src/native/discover.ts";
import { liveEnv, liveSkip } from "../integration/vice/live.ts";

let acme: string | false = false;
try {
  findTool(ACME);
} catch {
  acme = "ACME is not installed";
}

const root = resolve(import.meta.dirname, "../..");
// npx bins are .cmd shims on Windows, which spawn cannot run without a shell.
const posixOnly = process.platform === "win32" ? "npx is a .cmd shim on Windows" : false;
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-installed-"));
let host: ChildProcess | undefined;
after(async () => {
  if (host !== undefined && host.stdout !== null && !host.stdout.closed) {
    // npx exits on SIGTERM without passing it on, so signal its whole process
    // group, as Ctrl+C in a terminal does. The host holds stdout until it stops.
    const stopped = once(host.stdout, "close");
    process.kill(-host.pid!, "SIGTERM");
    await stopped;
  }
  rmSync(scratch, { recursive: true, force: true });
});

// npx and npm with a cache of their own, in the scratch directory.
const npmEnv = () => ({ ...process.env, npm_config_cache: join(scratch, "npm-cache"), npm_config_audit: "false", npm_config_fund: "false", npm_config_update_notifier: "false" });
const sh = (command: string, args: string[], cwd: string) => {
  const run = spawnSync(command, args, { cwd, encoding: "utf8", env: npmEnv() });
  assert.equal(run.status, 0, `${command} ${args.join(" ")}\n${run.stdout}\n${run.stderr}`);
  return run.stdout;
};

test("the packed package works through npx", { skip: liveSkip || posixOnly, timeout: 600_000 }, async () => {
  // 1. Pack; the CLI through npx installs the skills and the MCP declaration into a fresh project: plain files, no links.
  sh("npm", ["pack", "--pack-destination", scratch], root);
  const tarball = join(scratch, readdirSync(scratch).find((name) => name.endsWith(".tgz"))!);
  const npx = (program: string) => ["-y", `--package=${tarball}`, program];
  const project = join(scratch, "project");
  mkdirSync(project);
  sh("npx", [...npx("c64-re-tools"), "install", "--target", "claude"], project);
  const skills = join(project, ".claude", "skills");
  assert.deepEqual(readdirSync(skills).sort(), readdirSync(join(root, "skills")).sort());
  for (const path of readdirSync(project, { recursive: true, encoding: "utf8" })) assert.equal(lstatSync(join(project, path)).isSymbolicLink(), false, `${path} is no link`);
  const declared = (JSON.parse(readFileSync(join(project, ".mcp.json"), "utf8")) as { mcpServers: Record<string, { command: string; args: string[] }> }).mcpServers["c64-re-tools"]!;
  assert.deepEqual(declared, { command: "npx", args: ["-y", "--package=@henols/c64-re-tools@latest", "c64-re-tools-mcp"] });

  // 2. The Host Runtime and the MCP through npx drive a real VICE.
  host = spawn("npx", [...npx("c64-re-tools-host"), "--port", "0"], { cwd: scratch, env: { ...npmEnv(), ...liveEnv() }, stdio: ["ignore", "pipe", "inherit"], detached: true });
  const [line] = (await once(createInterface({ input: host.stdout! }), "line")) as [string];
  const address = `127.0.0.1:${/:(\d+)$/.exec(line)![1]}`;
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  const client = new Client({ name: "installed-acceptance", version: "0" });
  await client.connect(new StdioClientTransport({ command: declared.command, args: npx("c64-re-tools-mcp"), env: { ...env, ...npmEnv(), C64RT_HOST: address } as Record<string, string>, cwd: project, stderr: "inherit" }));
  try {
    const status = (await client.callTool({ name: "c64_status", arguments: {} })) as CallToolResult;
    assert.notEqual(status.isError, true, JSON.stringify(status.content));
    const kernal = (await client.callTool({ name: "c64_memory_read", arguments: { address: "$fffc", size: 2 } })) as CallToolResult;
    assert.equal((kernal.structuredContent as { data: string }).data, "e2fc", "the reset vector of the real KERNAL");
  } finally {
    await client.close();
  }

  // 3. Skill scripts run from their installed location: a local one, and one through the host and ACME.
  const memmap = JSON.parse(sh(process.execPath, [join(skills, "c64-memory-map", "scripts", "memmap.ts"), "at", "$d020"], project)) as { addresses: Array<{ name: string }> };
  assert.equal(memmap.addresses[0]?.name, "EXTCOL");
  if (acme === false) {
    cpSync(join(root, "test", "fixtures", "asm", "reconstructed"), join(project, "src"), { recursive: true });
    const assemble = spawnSync(process.execPath, [join(skills, "c64-assembler", "scripts", "assemble.ts"), "--source-root", "src", "--entry", "game.a", "--out", "build/game.prg"], {
      cwd: project,
      encoding: "utf8",
      env: { ...process.env, C64RT_HOST: address },
    });
    assert.equal(assemble.status, 0, assemble.stdout + assemble.stderr);
    assert.equal(readFileSync(join(project, "build", "game.prg")).readUInt16LE(0), 0x0801);
  }
});
