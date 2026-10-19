// Record and replay of a ZX Spectrum program in zxrun: the keyboard counter,
// its rebuild, and a changed rebuild. Skipped when zxrun is not installed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { findTool, ZXRUN } from "../../src/native/discover.ts";
import { COUNT, keyboardCounterCode, keyboardCounterSnapshot } from "../fixtures/z80/keyboard-counter.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

let skip: string | false = false;
try {
  findTool(ZXRUN);
} catch {
  skip = "zxrun is not installed: run tools/install-zxrun.sh or set C64RT_ZXRUN";
}
const skills = resolve(import.meta.dirname, "../../skills");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-zx-testing-"));
mkdirSync(join(project, ".c64-re-tools", "local"), { recursive: true });
after(() => rmSync(project, { recursive: true, force: true }));

function run(skill: string, script: string, ...args: string[]): { status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope } {
  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", script), ...args], { cwd: project, encoding: "utf8", timeout: 300_000 });
  const { envelope, json } = readEnvelope(child.stdout, child.status);
  return { status: child.status, json: json as Record<string, unknown>, envelope };
}

test("a recording of key presses replays on the original and on a rebuild, and a changed rebuild fails", { skip, timeout: 300_000 }, () => {
  writeFileSync(join(project, "counter.z80"), keyboardCounterSnapshot());
  assert.equal(run("retro-knowledge", "knowledge.ts", "image", "counter.z80").status, 0);
  const steps = [{ frames: 10 }, { press: ["space"], frames: 5 }, { frames: 10 }, { press: ["caps"] }, { joystick: { fire: true } }, { frames: 10 }];
  writeFileSync(join(project, "record.json"), JSON.stringify({ name: "counter", program: "counter.z80", steps }));
  const recorded = run("retro-testing", "testing.ts", "record", "record.json", "--out", "tests/recordings/counter");
  assert.equal(recorded.status, 0, JSON.stringify(recorded.json));
  assert.deepEqual([recorded.json.result, recorded.json.frames], ["PASS", 38]);
  assert.ok((recorded.json.inputSites as number) >= 2, "the keyboard sites of the counter");
  assert.match(recorded.envelope.nextAction!, /testing\.ts replay tests\/recordings\/counter/);

  assert.deepEqual(run("retro-testing", "testing.ts", "replay", "tests/recordings/counter").json.result, "PASS");
  writeFileSync(join(project, ".c64-re-tools", "local", "rebuild.bin"), keyboardCounterCode);
  const rebuilt = run("retro-testing", "testing.ts", "replay", "tests/recordings/counter", "--rebuild", ".c64-re-tools/local/rebuild.bin", "--rebuild-at", "$8000");
  assert.deepEqual(rebuilt.json.result, "PASS", JSON.stringify(rebuilt.json));

  // A NOP in place of INC (HL) in COUNT: the presses are not counted, so the RAM at the end differs.
  const changed = Uint8Array.from(keyboardCounterCode);
  changed[COUNT - 0x8000 + 3] = 0x00;
  writeFileSync(join(project, ".c64-re-tools", "local", "changed.bin"), changed);
  const failed = run("retro-testing", "testing.ts", "replay", "tests/recordings/counter", "--rebuild", ".c64-re-tools/local/changed.bin", "--rebuild-at", "$8000");
  assert.equal(failed.json.result, "FAIL");
  assert.match(JSON.stringify(failed.json.sides), /the RAM at the end is not the RAM of the recording/);
  assert.match(failed.envelope.hint!, /does not end with the tick and the RAM of the original/);
  assert.equal(run("retro-testing", "testing.ts", "replay", "tests/recordings/counter", "--rebuild", ".c64-re-tools/local/changed.bin").status, 2);
});
