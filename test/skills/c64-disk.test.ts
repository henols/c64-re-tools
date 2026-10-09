// The c64-disk script against a real Host Runtime server with real c1541.
// Skipped (never passed) when c1541 is not installed.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../src/native/processes.ts";
import { startHostServer, type HostServer } from "../../src/host/server.ts";
import { C1541, findTool } from "../../src/native/discover.ts";
import { createToolDispatcher } from "../../src/host/tools/index.ts";
import { WireFailure } from "../../src/protocol.ts";
import { buildD64 } from "../fixtures/d64.ts";
import { borderLoopPrg } from "../fixtures/prg/border-loop.ts";

let skip: string | false = false;
try {
  findTool(C1541);
} catch {
  skip = "c1541 is not installed: install VICE or set C64RT_C1541 to run these tests";
}

const script = resolve(import.meta.dirname, "../../skills/c64-disk/scripts/disk.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-disk-"));
mkdirSync(join(project, "original"));
writeFileSync(join(project, "original", "game.d64"), buildD64([{ name: "LOOP", bytes: borderLoopPrg }], "GAME DISK"));
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

async function hostEnv(): Promise<string> {
  if (server === undefined) {
    const supervisor = new ProcessSupervisor();
    supervisor.installExitGuard();
    server = await startHostServer({
      port: 0,
      createViceSession: async () => {
        throw new WireFailure("machine-unavailable", "no emulators here");
      },
      tools: createToolDispatcher({ supervisor }),
    });
  }
  return `${server.host}:${server.port}`;
}

async function disk(...args: string[]): Promise<{ status: number | null; json: Record<string, unknown> }> {
  const child = spawn(process.execPath, [...process.execArgv, script, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: await hostEnv() }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return { status, json: JSON.parse(stdout) as Record<string, unknown> };
}

test("the directory lists the disk and its files", { skip }, async () => {
  const { status, json } = await disk("directory", "original/game.d64");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.diskName, "GAME DISK");
  assert.deepEqual(json.entries, [{ name: "LOOP", type: "prg", blocks: 1, closed: true, locked: false }]);
});

test("read writes the file into the project; a missing file exits 1 with found false", { skip }, async () => {
  const { status, json } = await disk("read", "original/game.d64", "loop", "--out", "extracted/loop.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual(json, { found: true, name: "LOOP", bytes: borderLoopPrg.length, output: "extracted/loop.prg" });
  assert.deepEqual([...readFileSync(join(project, "extracted", "loop.prg"))], [...borderLoopPrg]);
  const missing = await disk("read", "original/game.d64", "OTHER", "--out", "extracted/other.prg");
  assert.equal(missing.status, 1);
  assert.deepEqual(missing.json, { found: false });
  assert.equal(existsSync(join(project, "extracted", "other.prg")), false);
});

test("entry and chain give the file's blocks", { skip }, async () => {
  const entry = await disk("entry", "original/game.d64", "LOOP");
  assert.deepEqual(entry.json, { found: true, entry: { name: "LOOP", type: "prg", blocks: 1, closed: true, locked: false, startTrack: 17, startSector: 0 } });
  const chain = await disk("chain", "original/game.d64", "LOOP");
  assert.deepEqual(chain.json, { found: true, sectors: [{ track: 17, sector: 0 }] });
});

test("bad calls are refused before anything is sent", { skip }, async () => {
  for (const args of [
    ["format", "original/game.d64"],
    ["read", "original/game.d64", "LOOP"],
    ["directory", "original/game.d64", "LOOP"],
    ["read", "original/game.d64", "LOOP", "--out", "../escape.prg"],
    ["entry", "original/game.d64"],
  ]) {
    const { status, json } = await disk(...args);
    assert.equal(status, 2, args.join(" "));
    assert.equal((json.error as { code: string }).code, "invalid-input");
  }
  const notImage = await disk("directory", "extracted/loop.prg");
  assert.equal((notImage.json.error as { code: string }).code, "invalid-input");
});
