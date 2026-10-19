// The Z80 proof of concept end to end, through poc/z80/zx.ts: the keyboard
// counter (test/fixtures/z80) in the replay core zxrun, in Ghidra with its Z80
// language, and in ZEsarUX over ZRCP. Each part needs its tool: zxrun
// (tools/install-zxrun.sh or C64RT_ZXRUN), Ghidra (C64RT_GHIDRA), ZEsarUX
// (C64RT_ZESARUX).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../../src/cpu/coverage.ts";
import { findTool, ZXRUN } from "../../../src/native/discover.ts";
import { COUNT, COUNTER_START, keyboardCounterSnapshot } from "../../fixtures/z80/keyboard-counter.ts";

function missing(find: () => unknown, text: string): string | false {
  try {
    find();
    return false;
  } catch {
    return text;
  }
}

const noZxrun = missing(() => findTool(ZXRUN), "zxrun is not installed: run tools/install-zxrun.sh or set C64RT_ZXRUN");
// Ghidra runs in process now; this proof of concept ran it headless.
const noGhidra = noZxrun || "the proof of concept ran Ghidra headless";
const noZesarux = noZxrun || (process.env.C64RT_ZESARUX === undefined ? "set C64RT_ZESARUX to run the live ZEsarUX checks" : false);

const root = resolve(import.meta.dirname, "../../..");
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-z80-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const snapshot = join(scratch, "counter.z80");
writeFileSync(snapshot, keyboardCounterSnapshot());

function zx(args: string[]): Record<string, unknown> {
  const run = spawnSync(process.execPath, [...process.execArgv, join(root, "poc/z80/zx.ts"), ...args], { cwd: scratch, encoding: "utf8", timeout: 600_000 });
  assert.ok(run.stdout !== "", run.stderr);
  const result = JSON.parse(run.stdout) as Record<string, unknown>;
  assert.equal(result.error, undefined, String(result.error));
  return result;
}

/** 50 frames: SPACE from frame 10 for 10 frames, Shift+Z (CAPS SHIFT) from frame 30 for 5. */
const KEYS = ["--frames", "50", "--key", "20@10+10", "--key", "5a@30+5"];

test("zxrun records the counter and replays it to the same tick and RAM, twice the same", { skip: noZxrun, timeout: 120_000 }, () => {
  const first = zx(["record", snapshot, "--out", join(scratch, "a"), ...KEYS]);
  assert.deepEqual([first.presses, first.pressesIx, first.framesSeen], [15, 15, 50]);
  zx(["record", snapshot, "--out", join(scratch, "b"), ...KEYS]);
  assert.deepEqual(readFileSync(join(scratch, "a", "reads.txt")), readFileSync(join(scratch, "b", "reads.txt")));
  assert.equal(zx(["replay", join(scratch, "a")]).result, "SAME");
  // The coverage marks the instruction starts, not the opcode after a prefix ($8005 after FD at $8004).
  const map = readFileSync(join(scratch, "a", "coverage.bin"));
  for (const address of [COUNTER_START, 0x8004, COUNT, 0x8040]) assert.ok((map[address]! & COVERAGE.ramExecute) !== 0, `$${address.toString(16)}`);
  for (const address of [0x8005, 0x8009, 0x8041]) assert.equal(map[address]! & COVERAGE.ramExecute, 0, `$${address.toString(16)}`);
});

test("Ghidra's Z80 language, seeded by the zxrun coverage, finds the two routines", { skip: noGhidra, timeout: 600_000 }, () => {
  zx(["record", snapshot, "--out", join(scratch, "g"), ...KEYS]);
  const result = zx(["analyze", join(scratch, "g")]) as { seeds: { routines: string[] }; functions: string[]; ramReferences: string[]; instructions: { ram: number; sameLength: number } };
  assert.deepEqual(result.seeds.routines, ["$8000", "$8030"]);
  assert.deepEqual(result.functions, ["$8000 FUN_ram_8000", "$8030 FUN_ram_8030"]);
  assert.ok(result.ramReferences.includes("$8012 call $8030"));
  assert.ok(result.ramReferences.includes("$803d write $9001"));
  // A port of the Z80 I/O space is no memory reference.
  assert.ok(!result.ramReferences.some((reference) => / \$00fe$/.test(reference)));
  assert.equal(result.instructions.sameLength, result.instructions.ram);
});

test("ZEsarUX does the live operations, and agrees with zxrun at each hit of COUNT", { skip: noZesarux, timeout: 300_000 }, () => {
  const live = zx(["live", snapshot, "--out", join(scratch, "live")]) as { steps: Array<{ operation: string; result: string }> };
  const failed = live.steps.filter((step) => step.result !== "ok").map((step) => step.operation);
  // Known ZEsarUX 13.0 faults: E is written wrong into a .z80 file, and hard-reset-cpu does not reset.
  assert.deepEqual(failed, ["save a .z80 snapshot and load it back", "hard reset (hard-reset-cpu)"]);
  const compared = zx(["compare", snapshot, "--hits", "5"]) as { hits: Array<{ sameRegisters: boolean; sameCounters: boolean }> };
  assert.ok(compared.hits.every((hit) => hit.sameRegisters && hit.sameCounters));
});
