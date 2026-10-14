// The loads command of c64-unpacker (D53): the steps file with capture steps,
// and the blocks that a capture writes.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import { changedBlocks, readLoadSteps } from "../../skills/c64-unpacker/scripts/loads.ts";

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
  assert.equal(steps([{ runUntil: { at: "$c000" }, timeoutFrames: 100 }, { capture: "level1" }, { type: " " }, { capture: "level2" }])().length, 4);
  assert.throws(steps([{ frames: 10 }]), /no capture step/);
  assert.throws(steps([{ capture: "a" }, { capture: "a" }]), /used before/);
  assert.throws(steps([{ capture: "a/b" }]), /capture needs a name/);
  assert.throws(steps([{ capture: "a", frames: 1 }]), /only capture/);
  assert.throws(steps([{ runUntil: { at: "main" }, timeoutFrames: 1 }, { capture: "a" }]), /\$ followed by four hex digits/);
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
  assert.deepEqual(changedBlocks(before, after, map, 16), [
    { start: 0x2000, end: 0x2010, bytes: 3 },
    { start: 0x3000, end: 0x3000, bytes: 1 },
  ]);
});
