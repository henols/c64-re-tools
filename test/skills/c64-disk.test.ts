// The c64-disk script against a real Host Runtime server with real c1541.
// Skipped (never passed) when c1541 is not installed.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { C1541 } from "../../src/native/discover.ts";
import { buildD64, offsetOf } from "../fixtures/d64.ts";
import { borderLoopPrg } from "../fixtures/prg/border-loop.ts";
import { runScript, scratchDir, skillScript, toolSkip } from "../kit.ts";
import { toolsHost } from "./tools-host.ts";

const skip = toolSkip(C1541);

const script = skillScript("c64-disk", "disk.ts");
const project = scratchDir("disk");
mkdirSync(join(project, "releases"));
const gameDisk = buildD64([{ name: "LOOP", bytes: borderLoopPrg }], "GAME DISK", [{ track: 20, sector: 5 }, { track: 1, sector: 0 }]);
// The sectors that no file holds have their own bytes, as a loader that reads them directly finds them.
gameDisk.fill(0xaa, offsetOf(1, 0), offsetOf(1, 0) + 256);
gameDisk.fill(0x55, offsetOf(20, 5), offsetOf(20, 5) + 256);
writeFileSync(join(project, "releases", "game.d64"), gameDisk);
const host = toolsHost();

async function disk(...args: string[]) {
  return runScript(script, args, { cwd: project, host: await host() });
}

test("the directory lists the disk and its files", { skip }, async () => {
  const { status, json } = await disk("directory", "releases/game.d64");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.diskName, "GAME DISK");
  assert.deepEqual(json.entries, [{ name: "LOOP", type: "prg", blocks: 1, closed: true, locked: false }]);
});

test("read writes the file into the project; a missing file is not-found", { skip }, async () => {
  const { status, json } = await disk("read", "releases/game.d64", "loop", "--out", "extracted/loop.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual({ ...json, sha256: undefined }, { name: "LOOP", out: "extracted/loop.prg", bytes: borderLoopPrg.length, sha256: undefined });
  assert.deepEqual([...readFileSync(join(project, "extracted", "loop.prg"))], [...borderLoopPrg]);
  const missing = await disk("read", "releases/game.d64", "OTHER", "--out", "extracted/other.prg");
  assert.equal(missing.status, 2);
  assert.deepEqual(missing.json.error, { code: "not-found", message: "releases/game.d64 has no file OTHER. Give the name as directory shows it." });
  assert.equal(existsSync(join(project, "extracted", "other.prg")), false);
});

test("entry and chain give the file's blocks", { skip }, async () => {
  const entry = await disk("entry", "releases/game.d64", "LOOP");
  assert.deepEqual(entry.json, { found: true, entry: { name: "LOOP", type: "prg", blocks: 1, closed: true, locked: false, startTrack: 17, startSector: 0 } });
  const chain = await disk("chain", "releases/game.d64", "LOOP");
  assert.deepEqual(chain.json, { found: true, sectors: [{ track: 17, sector: 0 }] });
});

test("bam gives each track and the used sectors that no file holds", { skip }, async () => {
  const { status, json, envelope } = await disk("bam", "releases/game.d64");
  assert.equal(status, 0, JSON.stringify(json));
  const tracks: Array<{ track: number; usedSectors: number[] }> = json.tracks;
  assert.equal(tracks.length, 35);
  assert.deepEqual(tracks[16]!.usedSectors, [0], "the file LOOP");
  assert.deepEqual(json.unreferenced, [
    { track: 1, sector: 0 },
    { track: 20, sector: 5 },
  ]);
  assert.match(envelope.nextAction ?? "", /disk\.ts sectors releases\/game\.d64 --unreferenced --out \.c64-re-tools\/local\/game-unreferenced\.bin/);
});

test("sectors writes the blocks in the given order, then the used sectors that no file holds, and gives the index", { skip }, async () => {
  const { status, json } = await disk("sectors", "releases/game.d64", "18/0", "--unreferenced", "--out", "extracted/hidden.bin");
  assert.equal(status, 0, JSON.stringify(json));
  assert.partialDeepStrictEqual(json, { count: 3, out: "extracted/hidden.bin", bytes: 768 });
  assert.deepEqual(json.sectors, [
    { track: 18, sector: 0, offset: 0 },
    { track: 1, sector: 0, offset: 256 },
    { track: 20, sector: 5, offset: 512 },
  ]);
  const written = readFileSync(join(project, "extracted", "hidden.bin"));
  assert.deepEqual(written.subarray(0, 256), gameDisk.subarray(offsetOf(18, 0), offsetOf(18, 0) + 256));
  assert.ok(written.subarray(256, 512).every((byte) => byte === 0xaa));
  assert.ok(written.subarray(512).every((byte) => byte === 0x55));
});

test("sectors needs a sector or --unreferenced, and a sector is <track>/<sector>", { skip }, async () => {
  for (const args of [
    ["sectors", "releases/game.d64", "--out", "extracted/none.bin"],
    ["sectors", "releases/game.d64", "18/x", "--out", "extracted/none.bin"],
  ]) {
    const { status, json } = await disk(...args);
    assert.equal(status, 2, args.join(" "));
    assert.equal(json.error.code, "invalid-input");
  }
});
