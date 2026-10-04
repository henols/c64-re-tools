// Milestone 6 acceptance (19 §8): with real fixture media, inspect a D64
// directory, extract a PRG, decode its BASIC loader, find its machine-code
// handoff, then let VICE run the loader to that handoff. The disk and BASIC
// part needs c1541 and petcat; the VICE part is opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { C1541, findTool, PETCAT } from "../../../src/native/discover.ts";
import { BORDER_LOOP_START, borderLoopPrg } from "../../fixtures/prg/border-loop.ts";
import { liveEnv, liveSkip } from "./live.ts";

let c1541 = "";
let toolSkip: string | false = false;
try {
  c1541 = findTool(C1541);
  findTool(PETCAT);
} catch {
  toolSkip = "c1541 and petcat are not both installed: install VICE to run this test";
}
const viceSkip = toolSkip !== false ? toolSkip : liveSkip;

const root = resolve(import.meta.dirname, "../../..");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-m6-"));
const cleanups: Array<() => void | Promise<unknown>> = [() => rmSync(project, { recursive: true, force: true })];
after(async () => {
  for (const cleanup of cleanups) await cleanup();
});

/** The fixture disk, made by the real c1541: a BASIC loader with its machine code after it. */
function makeDisk(): void {
  mkdirSync(join(project, "original"));
  writeFileSync(join(project, "original", "loader.prg"), borderLoopPrg);
  const made = spawnSync(c1541, ["-format", "border demo,b1", "d64", "original/demo.d64", "-write", "original/loader.prg", "border loader"], { cwd: project, encoding: "utf8" });
  assert.equal(made.status, 0, made.stdout + made.stderr);
  rmSync(join(project, "original", "loader.prg"));
}

let host: Promise<{ process: ChildProcess; address: string }> | undefined;
function startHost(): Promise<{ process: ChildProcess; address: string }> {
  host ??= (async () => {
    const child = spawn(process.execPath, [resolve(root, "dist/host/main.js"), "--port", "0"], { env: liveEnv(), stdio: ["ignore", "pipe", "inherit"] });
    // SIGTERM lets the host stop every emulator it started.
    const exited = once(child, "exit");
    cleanups.unshift(() => (child.kill("SIGTERM"), exited));
    const [line] = (await once(createInterface({ input: child.stdout! }), "line")) as [string];
    return { process: child, address: `127.0.0.1:${/:(\d+)$/.exec(line)![1]}` };
  })();
  return host;
}

function script(skill: string, file: string, args: string[], address: string): { status: number | null; json: Record<string, unknown> } {
  const run = spawnSync(process.execPath, [resolve(root, "skills", skill, "scripts", file), ...args], { cwd: project, env: { ...process.env, C64RT_HOST: address }, encoding: "utf8" });
  assert.equal(run.stderr, "");
  return { status: run.status, json: JSON.parse(run.stdout) as Record<string, unknown> };
}

let handoff: string | undefined;

test("a BASIC loader on a disk is found, extracted and decoded to its handoff", { skip: toolSkip, timeout: 60_000 }, async () => {
  makeDisk();
  const { address } = await startHost();

  const directory = script("c64-disk", "disk.ts", ["directory", "original/demo.d64"], address);
  assert.equal(directory.status, 0, JSON.stringify(directory.json));
  assert.equal(directory.json.diskName, "BORDER DEMO");
  const entries = directory.json.entries as Array<{ name: string; type: string }>;
  assert.deepEqual(entries.map((entry) => [entry.name, entry.type]), [["BORDER LOADER", "prg"]]);

  const read = script("c64-disk", "disk.ts", ["read", "original/demo.d64", entries[0]!.name, "--out", "extracted/loader.prg"], address);
  assert.equal(read.status, 0, JSON.stringify(read.json));

  const decoded = script("c64-basic", "basic.ts", ["extracted/loader.prg"], address);
  assert.equal(decoded.status, 0, JSON.stringify(decoded.json));
  assert.equal(decoded.json.listing, "10 sys2061");
  assert.deepEqual(decoded.json.handoffs, [{ kind: "sys", line: 10, address: "$080d" }]);
  assert.equal(decoded.json.basicEnd, "$080d", "the handoff calls the code after BASIC");
  handoff = "$080d";
});

test("VICE runs the extracted loader from BASIC to the decoded handoff", { skip: viceSkip, timeout: 180_000 }, async () => {
  assert.ok(handoff !== undefined, "the disk and BASIC part ran first");
  const { address } = await startHost();
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve(root, "dist/mcp/main.js")], env: { ...env, C64RT_HOST: address }, cwd: project, stderr: "inherit" });
  const client = new Client({ name: "m6-acceptance", version: "0" });
  await client.connect(transport);
  try {
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
      assert.notEqual(result.isError, true, `${name}: ${JSON.stringify(result.content)}`);
      return result.structuredContent as Record<string, unknown>;
    };
    // Autostart types RUN, so BASIC itself executes the SYS.
    await call("c64_autostart", { path: "extracted/loader.prg" });
    const reached = await call("c64_run_until", { target: { kind: "address", address: handoff }, timeoutFrames: 1000 });
    assert.equal(reached.stopReason, "target");
    assert.equal(reached.pc, handoff);
    assert.equal(Number.parseInt(handoff!.slice(1), 16), BORDER_LOOP_START);
  } finally {
    await client.close();
  }
});
