// The c64-packer script with real Exomizer, which it runs itself: the pack,
// and the check in the emulator of Exomizer. Skipped (never passed) when
// Exomizer is not installed.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { EXOMIZER, findTool } from "../../src/native/discover.ts";
import { seededBytes } from "../kit.ts";

let skip: string | false = false;
try {
  findTool(EXOMIZER);
} catch {
  skip = "Exomizer is not installed: install exomizer or set C64RT_EXOMIZER to run these tests";
}

const script = resolve(import.meta.dirname, "../../skills/c64-packer/scripts/packer.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-packer-exomizer-"));
mkdirSync(join(project, ".c64-re-tools"));
after(() => rmSync(project, { recursive: true, force: true }));

const prg = (start: number, bytes: Uint8Array) => Buffer.concat([Buffer.from([start & 0xff, start >> 8]), bytes]);
/** 10 SYS2061, then code at $080d, then text that packs well. */
const BASIC = prg(0x0801, Buffer.concat([Buffer.from([0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, 0xee, 0x20, 0xd0, 0x4c, 0x0d, 0x08]), Buffer.alloc(4000, 0x41)]));

async function packer(...args: string[]): Promise<{ status: number | null; json: Record<string, unknown> }> {
  const child = spawn(process.execPath, [...process.execArgv, script, "pack", ...args], { cwd: project, env: { ...process.env, C64RT_HOST: "127.0.0.1:1" }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return { status, json: JSON.parse(stdout) as Record<string, unknown> };
}

test("a BASIC program is packed into a smaller PRG at $0801 that unpacks to the same bytes and jumps to its SYS address", { skip, timeout: 300_000 }, async () => {
  writeFileSync(join(project, "game.prg"), BASIC);
  const { status, json } = await packer("game.prg", "--out", "game-packed.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.equal((json.check as { entry: string }).entry, "$080d");
  assert.ok((json.packedBytes as number) < BASIC.length / 4, JSON.stringify(json));
  assert.equal(readFileSync(join(project, "game-packed.prg")).readUInt16LE(0), 0x0801);
});

test("a program that fills memory up to $ffff, under the I/O area and the ROMs, unpacks to the same bytes with all RAM at the start", { skip, timeout: 300_000 }, async () => {
  // Code at $0400 that the check never runs, then bytes that pack a little, to $ffff.
  const body = Buffer.concat([Buffer.from([0x78, 0x4c, 0x01, 0x04]), Buffer.alloc(0x6000, 0xea), seededBytes(7, 0x10000 - 0x0400 - 4 - 0x6000)]);
  writeFileSync(join(project, "full.prg"), prg(0x0400, body));
  const { status, json } = await packer("full.prg", "--entry", "$0400", "--exit-memory", "$34", "--out", "full-packed.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.deepEqual((json.check as { segments: unknown[] }).segments, [{ start: "$0400", end: "$ffff", result: "identical" }]);
});

test("a loader and a main part go into one program", { skip, timeout: 300_000 }, async () => {
  writeFileSync(join(project, "loader.prg"), BASIC);
  writeFileSync(join(project, "main.prg"), prg(0x0801 + BASIC.length - 2, Buffer.alloc(2000, 0x55)));
  const { status, json } = await packer("loader.prg", "main.prg", "--out", "release.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.equal((json.check as { segments: unknown[] }).segments.length, 1);
});
