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
import { startHostServer, type HostServer, viceBackend } from "../../src/host/server.ts";
import { C1541, findTool } from "../../src/native/discover.ts";
import { createToolDispatcher } from "../../src/host/tools/index.ts";
import { WireFailure } from "../../src/protocol/messages.ts";
import { buildD64, offsetOf } from "../fixtures/d64.ts";
import { borderLoopPrg } from "../fixtures/prg/border-loop.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

let skip: string | false = false;
try {
  findTool(C1541);
} catch {
  skip = "c1541 is not installed: install VICE or set C64RT_C1541 to run these tests";
}

const script = resolve(import.meta.dirname, "../../skills/c64-disk/scripts/disk.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-disk-"));
mkdirSync(join(project, "original"));
const gameDisk = buildD64([{ name: "LOOP", bytes: borderLoopPrg }], "GAME DISK", [{ track: 20, sector: 5 }, { track: 1, sector: 0 }]);
// The sectors that no file holds have their own bytes, as a loader that reads them directly finds them.
gameDisk.fill(0xaa, offsetOf(1, 0), offsetOf(1, 0) + 256);
gameDisk.fill(0x55, offsetOf(20, 5), offsetOf(20, 5) + 256);
writeFileSync(join(project, "original", "game.d64"), gameDisk);
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
      backends: { c64: viceBackend(async () => {
        throw new WireFailure("machine-unavailable", "no emulators here");
      }) },
      tools: createToolDispatcher({ supervisor }),
    });
  }
  return `${server.host}:${server.port}`;
}

async function disk(...args: string[]): Promise<{ status: number | null; json: Record<string, any>; envelope: ScriptEnvelope }> {
  const child = spawn(process.execPath, [...process.execArgv, script, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: await hostEnv() }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return { status, ...readEnvelope(stdout, status) };
}

test("the directory lists the disk and its files", { skip }, async () => {
  const { status, json } = await disk("directory", "original/game.d64");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.diskName, "GAME DISK");
  assert.deepEqual(json.entries, [{ name: "LOOP", type: "prg", blocks: 1, closed: true, locked: false }]);
});

test("read writes the file into the project; a missing file is not-found", { skip }, async () => {
  const { status, json } = await disk("read", "original/game.d64", "loop", "--out", "extracted/loop.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual({ ...json, sha256: undefined }, { name: "LOOP", out: "extracted/loop.prg", bytes: borderLoopPrg.length, sha256: undefined });
  assert.deepEqual([...readFileSync(join(project, "extracted", "loop.prg"))], [...borderLoopPrg]);
  const missing = await disk("read", "original/game.d64", "OTHER", "--out", "extracted/other.prg");
  assert.equal(missing.status, 2);
  assert.deepEqual(missing.json.error, { code: "not-found", message: "original/game.d64 has no file OTHER. Give the name as directory shows it." });
  assert.equal(existsSync(join(project, "extracted", "other.prg")), false);
});

test("entry and chain give the file's blocks", { skip }, async () => {
  const entry = await disk("entry", "original/game.d64", "LOOP");
  assert.deepEqual(entry.json, { found: true, entry: { name: "LOOP", type: "prg", blocks: 1, closed: true, locked: false, startTrack: 17, startSector: 0 } });
  const chain = await disk("chain", "original/game.d64", "LOOP");
  assert.deepEqual(chain.json, { found: true, sectors: [{ track: 17, sector: 0 }] });
});

test("bam gives each track and the used sectors that no file holds", { skip }, async () => {
  const { status, json, envelope } = await disk("bam", "original/game.d64");
  assert.equal(status, 0, JSON.stringify(json));
  const tracks = json.tracks as Array<{ track: number; usedSectors: number[] }>;
  assert.equal(tracks.length, 35);
  assert.deepEqual(tracks[16]!.usedSectors, [0], "the file LOOP");
  assert.deepEqual(json.unreferenced, [
    { track: 1, sector: 0 },
    { track: 20, sector: 5 },
  ]);
  assert.match(envelope.nextAction ?? "", /disk\.ts sectors original\/game\.d64 --unreferenced --out \.c64-re-tools\/local\/game-unreferenced\.bin/);
});

test("sectors writes the blocks in the given order, then the used sectors that no file holds, and gives the index", { skip }, async () => {
  const { status, json } = await disk("sectors", "original/game.d64", "18/0", "--unreferenced", "--out", "extracted/hidden.bin");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.count, 3);
  assert.deepEqual(json.sectors, [
    { track: 18, sector: 0, offset: 0 },
    { track: 1, sector: 0, offset: 256 },
    { track: 20, sector: 5, offset: 512 },
  ]);
  assert.equal(json.out, "extracted/hidden.bin");
  assert.equal(json.bytes, 768);
  const written = readFileSync(join(project, "extracted", "hidden.bin"));
  assert.deepEqual(written.subarray(0, 256), gameDisk.subarray(offsetOf(18, 0), offsetOf(18, 0) + 256));
  assert.ok(written.subarray(256, 512).every((byte) => byte === 0xaa));
  assert.ok(written.subarray(512).every((byte) => byte === 0x55));
});

test("sectors needs a sector or --unreferenced, and a sector is <track>/<sector>", { skip }, async () => {
  for (const args of [
    ["sectors", "original/game.d64", "--out", "extracted/none.bin"],
    ["sectors", "original/game.d64", "18/x", "--out", "extracted/none.bin"],
  ]) {
    const { status, json } = await disk(...args);
    assert.equal(status, 2, args.join(" "));
    assert.equal((json.error as { code: string }).code, "invalid-input");
  }
});
