// With real fixture media: inspect a D64 directory, extract a PRG, decode its
// BASIC loader, find its machine-code handoff, then let VICE run the loader to
// that handoff. The disk and BASIC part needs c1541 and petcat; the VICE part
// is opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { C1541, findTool, PETCAT } from "../../../src/native/discover.ts";
import { BORDER_LOOP_START, borderLoopPrg } from "../../fixtures/prg/border-loop.ts";
import { startMcp } from "../../kit.ts";
import { liveSkip, startHost, stopHosts, type LiveHost } from "./live.ts";

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
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-loader-"));
after(async () => {
  try {
    await stopHosts();
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

/** The fixture disk, made by the real c1541: a BASIC loader with its machine code after it. */
function makeDisk(): void {
  mkdirSync(join(project, "original"));
  writeFileSync(join(project, "original", "loader.prg"), borderLoopPrg);
  const made = spawnSync(c1541, ["-format", "border demo,b1", "d64", "original/demo.d64", "-write", "original/loader.prg", "border loader"], { cwd: project, encoding: "utf8" });
  assert.equal(made.status, 0, made.stdout + made.stderr);
  rmSync(join(project, "original", "loader.prg"));
}

function script(skill: string, file: string, args: string[], address: string): { status: number | null; json: Record<string, unknown> } {
  const run = spawnSync(process.execPath, [...process.execArgv, resolve(root, "skills", skill, "scripts", file), ...args], { cwd: project, env: { ...process.env, C64RT_HOST: address }, encoding: "utf8" });
  assert.equal(run.stderr, "");
  return { status: run.status, json: JSON.parse(run.stdout) as Record<string, unknown> };
}

/** The Host Runtime runs c1541 and petcat for the disk and BASIC scripts. */
let host: LiveHost;
/** Where the before hook extracts the loader; the VICE test autostarts it from there. */
const extracted = "extracted/loader.prg";
/** The machine-code handoff of the BASIC loader, decoded by the c64-basic script. */
let handoff = "";

before(
  async () => {
    if (toolSkip !== false) return;
    makeDisk();
    host = await startHost();
    const read = script("c64-disk", "disk.ts", ["read", "original/demo.d64", "BORDER LOADER", "--out", extracted], host.address);
    assert.equal(read.status, 0, JSON.stringify(read.json));
    const decoded = script("c64-basic", "basic.ts", [extracted], host.address);
    assert.equal(decoded.status, 0, JSON.stringify(decoded.json));
    handoff = (decoded.json.handoffs as Array<{ address: string }>)[0]!.address;
  },
  { timeout: 120_000 },
);

test("a BASIC loader on a disk is found, extracted and decoded to its handoff", { skip: toolSkip, timeout: 60_000 }, async () => {
  const { address } = host;

  const directory = script("c64-disk", "disk.ts", ["directory", "original/demo.d64"], address);
  assert.equal(directory.status, 0, JSON.stringify(directory.json));
  assert.equal(directory.json.diskName, "BORDER DEMO");
  const entries = directory.json.entries as Array<{ name: string; type: string }>;
  assert.deepEqual(entries.map((entry) => [entry.name, entry.type]), [["BORDER LOADER", "prg"]]);

  const read = script("c64-disk", "disk.ts", ["read", "original/demo.d64", entries[0]!.name, "--out", "extracted/again.prg"], address);
  assert.equal(read.status, 0, JSON.stringify(read.json));

  const decoded = script("c64-basic", "basic.ts", ["extracted/again.prg"], address);
  assert.equal(decoded.status, 0, JSON.stringify(decoded.json));
  assert.equal(decoded.json.listing, "10 sys2061");
  assert.deepEqual(decoded.json.handoffs, [{ kind: "sys", line: 10, address: "$080d" }]);
  assert.equal(decoded.json.basicEnd, "$080d", "the handoff calls the code after BASIC");
});

test("VICE runs the extracted loader from BASIC to the decoded handoff", { skip: viceSkip, timeout: 180_000 }, async () => {
  const { client } = await startMcp(host.address, { cwd: project });
  try {
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
      assert.notEqual(result.isError, true, `${name}: ${JSON.stringify(result.content)}`);
      return result.structuredContent as Record<string, unknown>;
    };
    // Autostart types RUN, so BASIC itself executes the SYS.
    await call("c64_autostart", { path: extracted });
    const reached = await call("c64_run_until", { target: { kind: "address", address: handoff }, timeoutFrames: 1000 });
    assert.equal(reached.stopReason, "target");
    assert.equal(reached.pc, handoff);
    assert.equal(Number.parseInt(handoff.slice(1), 16), BORDER_LOOP_START);
  } finally {
    await client.close();
  }
});
