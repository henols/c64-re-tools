// The c64-packer script with real Exomizer, which it runs itself: the pack,
// and the check in the emulator of Exomizer. Skipped (never passed) when
// Exomizer is not installed.

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { prg, SYS_2061 } from "../../src/c64.testkit.ts";
import { EXOMIZER } from "../../src/native/discover.ts";
import { runScript, scratchDir, seededBytes, skillScript, toolSkip } from "../kit.ts";

const skip = toolSkip(EXOMIZER);

const script = skillScript("c64-packer", "packer.ts");
const project = scratchDir("packer-exomizer");
mkdirSync(join(project, ".c64-re-tools"));

/** 10 SYS2061, then code at $080d, then text that packs well. */
const BASIC = prg(0x0801, SYS_2061, [0xee, 0x20, 0xd0, 0x4c, 0x0d, 0x08], Buffer.alloc(4000, 0x41));

function packer(...args: string[]) {
  return runScript(script, ["pack", ...args], { cwd: project });
}

test("a BASIC program is packed into a smaller PRG at $0801 that unpacks to the same bytes and jumps to its SYS address", { skip, timeout: 300_000 }, async () => {
  writeFileSync(join(project, "game.prg"), BASIC);
  const { status, json } = await packer("game.prg", "--out", "game-packed.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.equal(json.check.entry, "$080d");
  assert.ok(json.packedBytes < BASIC.length / 4, JSON.stringify(json));
  assert.equal(readFileSync(join(project, "game-packed.prg")).readUInt16LE(0), 0x0801);
});

test("a program that fills memory up to $ffff, under the I/O area and the ROMs, unpacks to the same bytes with all RAM at the start", { skip, timeout: 300_000 }, async () => {
  // Code at $0400 that the check never runs, then bytes that pack a little, to $ffff.
  const body = Buffer.concat([Buffer.from([0x78, 0x4c, 0x01, 0x04]), Buffer.alloc(0x6000, 0xea), seededBytes(7, 0x10000 - 0x0400 - 4 - 0x6000)]);
  writeFileSync(join(project, "full.prg"), prg(0x0400, body));
  const { status, json } = await packer("full.prg", "--entry", "$0400", "--exit-memory", "$34", "--out", "full-packed.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.deepEqual(json.check.segments, [{ start: "$0400", end: "$ffff", result: "identical" }]);
});

test("a loader and a main part go into one program", { skip, timeout: 300_000 }, async () => {
  writeFileSync(join(project, "loader.prg"), BASIC);
  writeFileSync(join(project, "main.prg"), prg(0x0801 + BASIC.length - 2, Buffer.alloc(2000, 0x55)));
  const { status, json } = await packer("loader.prg", "main.prg", "--out", "release.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.equal(json.check.segments.length, 1);
});
