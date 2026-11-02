// With real fixture media: inspect a D64 directory, extract a PRG, decode its
// BASIC loader, find its machine-code handoff, then let VICE run the loader to
// that handoff. The disk and BASIC part needs c1541 and petcat; the VICE part
// is opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { C1541, findTool, PETCAT } from "../../../src/native/discover.ts";
import { BORDER_LOOP_START, borderLoopPrg } from "../../fixtures/prg/border-loop.ts";
import { runScriptSync, scratchDir, skillScript, startMcp, toolSkip } from "../../kit.ts";
import { callTool, liveSkip, startHost, stopHosts, toolResult, type LiveHost } from "./live.ts";

const diskSkip = toolSkip(C1541, PETCAT);
const viceSkip = diskSkip || liveSkip;

after(stopHosts);
const project = scratchDir("loader");

/** The fixture disk, made by the real c1541: a BASIC loader with its machine code after it. */
function makeDisk(): void {
  mkdirSync(join(project, "releases"));
  writeFileSync(join(project, "releases", "loader.prg"), borderLoopPrg);
  const made = spawnSync(findTool(C1541), ["-format", "border demo,b1", "d64", "releases/demo.d64", "-write", "releases/loader.prg", "border loader"], { cwd: project, encoding: "utf8" });
  assert.equal(made.status, 0, made.stdout + made.stderr);
  rmSync(join(project, "releases", "loader.prg"));
}

/** The Host Runtime runs c1541 and petcat for the disk and BASIC scripts. */
let host: LiveHost;
/** Where the before hook extracts the loader; the VICE test autostarts it from there. */
const extracted = "extracted/loader.prg";
/** The machine-code handoff of the BASIC loader, decoded by the c64-basic script. */
let handoff = "";

before(
  async () => {
    if (diskSkip !== false) return;
    makeDisk();
    host = await startHost();
    const read = runScriptSync(skillScript("c64-disk", "disk.ts"), ["read", "releases/demo.d64", "BORDER LOADER", "--out", extracted], { cwd: project, host: host.address });
    assert.equal(read.status, 0, JSON.stringify(read.json));
    const decoded = runScriptSync(skillScript("c64-basic", "basic.ts"), ["list", extracted], { cwd: project, host: host.address });
    assert.equal(decoded.status, 0, JSON.stringify(decoded.json));
    handoff = (decoded.json.handoffs as Array<{ address: string }>)[0]!.address;
  },
  { timeout: 120_000 },
);

test("a BASIC loader on a disk is found, extracted and decoded to its handoff", { skip: diskSkip, timeout: 60_000 }, async () => {
  const { address } = host;

  const directory = runScriptSync(skillScript("c64-disk", "disk.ts"), ["directory", "releases/demo.d64"], { cwd: project, host: address });
  assert.equal(directory.status, 0, JSON.stringify(directory.json));
  assert.equal(directory.json.diskName, "BORDER DEMO");
  const entries = directory.json.entries as Array<{ name: string; type: string }>;
  assert.deepEqual(entries.map((entry) => [entry.name, entry.type]), [["BORDER LOADER", "prg"]]);

  const read = runScriptSync(skillScript("c64-disk", "disk.ts"), ["read", "releases/demo.d64", entries[0]!.name, "--out", "extracted/again.prg"], { cwd: project, host: address });
  assert.equal(read.status, 0, JSON.stringify(read.json));

  const decoded = runScriptSync(skillScript("c64-basic", "basic.ts"), ["list", "extracted/again.prg"], { cwd: project, host: address });
  assert.equal(decoded.status, 0, JSON.stringify(decoded.json));
  assert.equal(decoded.json.listing, "10 sys2061");
  assert.deepEqual(decoded.json.handoffs, [{ kind: "sys", line: 10, address: "$080d" }]);
  assert.equal(decoded.json.basicEnd, "$080d", "the handoff calls the code after BASIC");
});

test("VICE runs the extracted loader from BASIC to the decoded handoff", { skip: viceSkip, timeout: 180_000 }, async () => {
  const { client } = await startMcp(host.address, { cwd: project });
  try {
    // Autostart types RUN, so BASIC itself executes the SYS.
    await callTool(client, "c64_autostart", { path: extracted });
    const reached = await toolResult(client, "c64_run_until", { target: { kind: "address", address: handoff }, timeoutFrames: 1000 });
    assert.equal(reached.stopReason, "target");
    assert.equal(reached.pc, handoff);
    assert.equal(Number.parseInt(handoff.slice(1), 16), BORDER_LOOP_START);
  } finally {
    await client.close();
  }
});
