// The loads command of c64-unpacker: the steps file with capture steps,
// and the blocks that a capture writes.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import { captureBlocks, changedBlocks, readLoadSteps } from "../../skills/c64-unpacker/scripts/lib/loads.ts";
import { withWrite } from "../../src/knowledge/database.ts";
import { renameSymbol } from "../../src/knowledge/write.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-loads-"));
const home = process.cwd();
beforeEach(() => process.chdir(project));
afterEach(() => process.chdir(home));
after(() => rmSync(project, { recursive: true, force: true }));

const steps = (value: unknown) => {
  writeFileSync(join(project, "steps.json"), JSON.stringify(value));
  return () => readLoadSteps("steps.json");
};

test("a steps file of loads has action steps and capture steps with new names", () => {
  assert.equal(steps([{ runUntil: { target: { kind: "address", address: "$c000" }, timeoutFrames: 100 } }, { capture: "level1" }, { type: { mode: "text", text: " " } }, { capture: "level2" }])().length, 4);
  assert.throws(steps([{ frames: 10 }]), /no capture step/);
  assert.throws(steps([{ capture: "a" }, { capture: "a" }]), /used before/);
  assert.throws(steps([{ capture: "a/b" }]), /capture needs a name/);
  assert.throws(steps([{ capture: "a", frames: 1 }]), /only capture/);
  assert.throws(steps([{ runUntil: { target: { kind: "address", address: "12-3" }, timeoutFrames: 1 } }, { capture: "a" }]), /runUntil\.target\.address must be \$ and 1 to 4 hex digits/);
  // A name must be in the knowledge: an unknown name stops the call before the emulator starts, with the file and the step.
  assert.throws(steps([{ capture: "a" }, { runUntil: { target: { kind: "address", address: "main" }, timeoutFrames: 1 } }]), { code: "invalid-input", message: /^--steps steps\.json: step 2: main is not a name in the knowledge\. Give a \$ address/ });
  mkdirSync(join(project, ".c64-re-tools"), { recursive: true });
  withWrite((db) => renameSymbol(db, { origin: "user" }, { address: 0xc000, name: "main" }), project);
  assert.equal(steps([{ runUntil: { target: { kind: "address", address: "main" }, timeoutFrames: 1 } }, { capture: "a" }])().length, 2, "a name is an address of the knowledge");
  assert.throws(steps([{ press: "A" }, { capture: "a" }]), /step 1: press pushes keys of the keyboard matrix, and only the replay core of c64-testing has them\. Use type for the KERNAL keyboard queue, or put the press step in a record file and play it with testing\.ts record of c64-testing$/);
});

test("a capture block is RAM from $0400 that changed and that the CPU wrote, joined across small gaps", () => {
  const before = new Uint8Array(0x10000);
  const after = new Uint8Array(0x10000);
  const map = new Uint8Array(0x10000);
  const change = (address: number, written = true) => {
    after[address] = 1;
    if (written) map[address] = COVERAGE.ramWrite;
  };
  for (const address of [0x0300, 0x2000, 0x2001, 0x2010, 0x3000]) change(address);
  change(0x4000, false);
  map[0x5000] = COVERAGE.ramWrite; // written with the same value: no change
  assert.deepEqual(changedBlocks(before, after, map, 16, false), [
    { start: 0x2000, end: 0x2010, bytes: 3 },
    { start: 0x3000, end: 0x3000, bytes: 1 },
  ]);
});

test("with known writes, a capture block keeps the bytes written with the value that was there", () => {
  // A program at $2000-$20ff whose middle 64 bytes are zeros over a zero area of the start pattern.
  const before = new Uint8Array(0x10000);
  const after = new Uint8Array(0x10000);
  const map = new Uint8Array(0x10000);
  for (let address = 0x2000; address <= 0x20ff; address++) {
    map[address] = COVERAGE.ramWrite;
    if (address < 0x2080 || address > 0x20bf) after[address] = 0x11;
  }
  map[0x5000] = COVERAGE.ramWrite; // written with the same value only: no block
  assert.deepEqual(changedBlocks(before, after, map, 16, true), [{ start: 0x2000, end: 0x20ff, bytes: 256 }]);
  assert.deepEqual(changedBlocks(before, after, map, 16, false), [
    { start: 0x2000, end: 0x207f, bytes: 128 },
    { start: 0x20c0, end: 0x20ff, bytes: 64 },
  ]);
});

test("a capture block holds the changed RAM under the I/O area, which the map gives as I/O writes", () => {
  // A loader copies 4 KiB to $d000-$dfff with $01 = $00, and the game writes the VIC-II registers.
  const before = new Uint8Array(0x10000);
  const after = new Uint8Array(0x10000);
  const map = new Uint8Array(0x10000);
  map.fill(COVERAGE.ioWrite, 0xd000, 0xe000);
  after.fill(0x42, 0xd000, 0xe000);
  after[0xd020] = 0; // written with the value that was there: VICE start RAM, still in the block
  assert.deepEqual(captureBlocks(before, after, map, true, []), [{ start: 0xd000, end: 0xdfff, bytes: 4096 }]);
  // A register write that changed no RAM is no block.
  const registers = new Uint8Array(0x10000);
  registers.fill(COVERAGE.ioWrite, 0xd000, 0xd030);
  assert.deepEqual(captureBlocks(before, before, registers, true, []), []);
});

test("an excluded range cuts the capture blocks and counts in no small change", () => {
  const before = new Uint8Array(0x10000);
  const after = new Uint8Array(0x10000);
  const map = new Uint8Array(0x10000);
  map.fill(COVERAGE.ramWrite, 0xbf00, 0xc400);
  after.fill(0x11, 0xbf00, 0xc400);
  assert.deepEqual(captureBlocks(before, after, map, true, [{ start: 0xc000, end: 0xc3ff }]), [{ start: 0xbf00, end: 0xbfff, bytes: 256 }]);
});
