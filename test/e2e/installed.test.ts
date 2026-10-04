// Milestone 11 acceptance (19 §13): everything runs from the packed npm
// artifact installed in a fresh directory, never from this repository:
//   npm pack → npm install → skills installed by the installed CLI →
//   the installed MCP and Host Runtime with real VICE → a host-tool skill
//   script from its installed location.
// Opt-in with C64RT_LIVE_VICE; needs npm registry access for the package's
// dependencies, and ACME for the host-tool part.

import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { ACME, findTool } from "../../src/host/tools/discover.ts";
import { liveEnv, liveSkip } from "../integration/vice/live.ts";

let acme: string | false = false;
try {
  findTool(ACME);
} catch {
  acme = "ACME is not installed";
}

const root = resolve(import.meta.dirname, "../..");
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-installed-"));
let host: ChildProcess | undefined;
after(async () => {
  if (host !== undefined && host.exitCode === null) {
    const exited = once(host, "exit");
    host.kill("SIGTERM");
    await exited;
  }
  rmSync(scratch, { recursive: true, force: true });
});

const sh = (command: string, args: string[], cwd: string) => {
  const run = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" } });
  assert.equal(run.status, 0, `${command} ${args.join(" ")}\n${run.stdout}\n${run.stderr}`);
  return run.stdout;
};

test("the packed package installs and works from its installed location", { skip: liveSkip, timeout: 600_000 }, async () => {
  // 1. Pack the built package and install it into a fresh directory.
  sh("npm", ["pack", "--pack-destination", scratch], root);
  const tarball = readdirSync(scratch).find((name) => name.endsWith(".tgz"))!;
  const prefix = join(scratch, "installed");
  mkdirSync(prefix);
  sh("npm", ["install", "--no-save", join(scratch, tarball)], prefix);
  const bin = (name: string) => join(prefix, "node_modules", ".bin", name);
  for (const name of ["c64-re-tools", "c64-re-tools-mcp", "c64-re-tools-host"]) assert.ok(existsSync(bin(name)), name);

  // 2. The installed CLI installs the skills and the MCP declaration into a project.
  const project = join(scratch, "project");
  mkdirSync(project);
  sh(bin("c64-re-tools"), ["install", "--target", "claude"], project);
  const skills = join(project, ".claude", "skills");
  assert.deepEqual(readdirSync(skills).sort(), readdirSync(join(root, "skills")).sort());

  // 3. The installed Host Runtime and MCP drive a real VICE.
  host = spawn(bin("c64-re-tools-host"), ["--port", "0"], { env: liveEnv(), stdio: ["ignore", "pipe", "inherit"] });
  const [line] = (await once(createInterface({ input: host.stdout! }), "line")) as [string];
  const address = `127.0.0.1:${/:(\d+)$/.exec(line)![1]}`;
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  const client = new Client({ name: "installed-acceptance", version: "0" });
  await client.connect(new StdioClientTransport({ command: bin("c64-re-tools-mcp"), env: { ...env, C64RT_HOST: address }, cwd: project, stderr: "inherit" }));
  try {
    const status = (await client.callTool({ name: "c64_status", arguments: {} })) as CallToolResult;
    assert.notEqual(status.isError, true, JSON.stringify(status.content));
    const kernal = (await client.callTool({ name: "c64_memory_read", arguments: { address: "$fffc", size: 2 } })) as CallToolResult;
    assert.equal((kernal.structuredContent as { data: string }).data, "e2fc", "the reset vector of the real KERNAL");
  } finally {
    await client.close();
  }

  // 4. Skill scripts run from their installed location: a local one, and one through the host and ACME.
  const memmap = JSON.parse(sh(process.execPath, [join(skills, "c64-memory-map", "scripts", "memmap.js"), "at", "$d020"], project)) as { addresses: Array<{ name: string }> };
  assert.equal(memmap.addresses[0]?.name, "EXTCOL");
  if (acme === false) {
    cpSync(join(root, "test", "fixtures", "asm", "reconstructed"), join(project, "src"), { recursive: true });
    const assemble = spawnSync(process.execPath, [join(skills, "c64-assembler", "scripts", "assemble.js"), "--source-root", "src", "--entry", "game.a", "--out", "build/game.prg"], {
      cwd: project,
      encoding: "utf8",
      env: { ...process.env, C64RT_HOST: address },
    });
    assert.equal(assemble.status, 0, assemble.stdout + assemble.stderr);
    assert.equal(readFileSync(join(project, "build", "game.prg")).readUInt16LE(0), 0x0801);
  }
});
