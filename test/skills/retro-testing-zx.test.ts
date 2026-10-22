// Record and replay of a ZX Spectrum program in zxrun: the keyboard counter,
// its rebuild, and a changed rebuild. The refusals of a ZX Spectrum project
// (test, run, diff, record files, replay subjects and rebuilds) need no zxrun;
// the record and replay tests are skipped when zxrun is not installed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

import { findTool, ZXRUN } from "../../src/native/discover.ts";
import { zxRamDifferences, zxRamParts } from "../../skills/retro-testing/scripts/lib/zx-recording.ts";
import { COUNT, keyboardCounterCode, keyboardCounterSnapshot, PRESSES } from "../fixtures/z80/keyboard-counter.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

let skip: string | false = false;
try {
  findTool(ZXRUN);
} catch {
  skip = "zxrun is not installed: run tools/install-zxrun.sh or set C64RT_ZXRUN";
}
const skills = resolve(import.meta.dirname, "../../skills");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-zx-testing-"));
const c64Project = mkdtempSync(join(tmpdir(), "c64-re-tools-zx-testing-c64-"));
for (const folder of [project, c64Project]) mkdirSync(join(folder, ".c64-re-tools", "local"), { recursive: true });
after(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(c64Project, { recursive: true, force: true });
});

function runIn(cwd: string, skill: string, script: string, ...args: string[]): { status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope } {
  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", script), ...args], { cwd, encoding: "utf8", timeout: 300_000 });
  const { envelope, json } = readEnvelope(child.stdout, child.status);
  return { status: child.status, json: json as Record<string, unknown>, envelope };
}
const run = (skill: string, script: string, ...args: string[]) => runIn(project, skill, script, ...args);
const testing = (...args: string[]) => run("retro-testing", "testing.ts", ...args);
const local = (name: string) => join(project, ".c64-re-tools", "local", name);

/** The message of a refusal: error and hint. */
function refusal(result: ReturnType<typeof run>): string {
  assert.equal(result.status, 2, JSON.stringify(result.envelope));
  assert.equal(result.envelope.code, "invalid-input", JSON.stringify(result.envelope));
  return `${result.envelope.error ?? ""} ${result.envelope.hint ?? ""}`;
}

before(() => {
  writeFileSync(join(project, "counter.z80"), keyboardCounterSnapshot());
  assert.equal(run("retro-knowledge", "knowledge.ts", "image", "counter.z80").status, 0);
});

test("test and run in a ZX Spectrum project refuse first by the machine and tell to record and replay", () => {
  // A .z80 without an extension: the refusal comes before the file checks of a C64 program.
  writeFileSync(join(project, "counter"), keyboardCounterSnapshot());
  writeFileSync(join(project, "scenario.json"), JSON.stringify({ name: "zx", original: { program: "counter" }, rebuild: { program: "counter" }, steps: [{ frames: 5 }, { observe: "start", memory: ["$9000"] }] }));
  writeFileSync(join(project, "run.json"), JSON.stringify({ name: "zx", start: { program: "counter.z80" }, steps: [{ frames: 5 }] }));
  for (const [command, file] of [["test", "scenario.json"], ["run", "run.json"]] as const) {
    const message = refusal(testing(command, file, ...(command === "run" ? ["--out", ".c64-re-tools/local/run"] : [])));
    assert.match(message, new RegExp(`${command} is for a C64 program, and this project is a ZX Spectrum 48K project`));
    assert.match(message, /with record\. Then replay the recording/);
    assert.doesNotMatch(message, /\.prg/);
  }
});

test("diff in a ZX Spectrum project names the memory files that it compares", () => {
  const snapshot = refusal(testing("diff", "counter.z80", "counter.z80"));
  assert.match(snapshot, /counter\.z80 is a ZX Spectrum snapshot, and diff compares no ZX Spectrum snapshot\. Give two memory files \(\.bin\)/);
  writeFileSync(local("a.vsf"), "VICE Snapshot File\x1a");
  assert.match(refusal(testing("diff", ".c64-re-tools/local/a.vsf", ".c64-re-tools/local/a.vsf")), /is not a memory file\. In a ZX Spectrum 48K project, diff compares only memory files/);
  const changed = Uint8Array.from(keyboardCounterCode);
  changed[COUNT - 0x8000 + 3] = 0x00;
  writeFileSync(local("build-a.bin"), keyboardCounterCode);
  writeFileSync(local("build-b.bin"), changed);
  const builds = testing("diff", ".c64-re-tools/local/build-a.bin", ".c64-re-tools/local/build-b.bin", "--address", "$8000");
  assert.equal(builds.status, 0, JSON.stringify(builds.envelope));
  assert.deepEqual((builds.json.memory as { listed: unknown[] }).listed, [{ start: "$8033", end: "$8033", a: "34", b: "00" }]);
});

test("a ZX Spectrum record file refuses the keys and steps of the C64 form by name, and steps that run no frame", () => {
  const cases: Array<[string, unknown, RegExp]> = [
    ["c64 joystick", { steps: [{ frames: 5 }, { joystick: { port: 2, direction: "right" } }, { frames: 5 }] }, /step 2: joystick has no port: that is the C64 form\. The Kempston joystick is \{ "joystick": \{ "right": true, "fire": true \} \}/],
    ["joystick value", { steps: [{ joystick: { right: 1 } }, { frames: 5 }] }, /step 1: joystick right must be true or false/],
    ["checkpoint", { checkpoint: "$c7ab", state: ["$fe10"], steps: [{ frames: 5 }] }, /checkpoint is for a C64 program\. A ZX Spectrum record file has only name, program and steps/],
    ["unknown key", { comment: "x", steps: [{ frames: 5 }] }, /comment is not a key of a ZX Spectrum record file/],
    ["joystick only", { steps: [{ joystick: { right: true } }] }, /the steps run no frame\. Give a frames or a press step/],
    ["type step", { steps: [{ type: { mode: "text", text: "x" } }] }, /step 1: type is a step for a C64 program\. A ZX Spectrum step is/],
    ["extra step key", { steps: [{ frames: 5, press: ["space"], fire: true }] }, /step 1: fire is not a key of this step\. The step has only press and frames/],
  ];
  for (const [name, fields, message] of cases) {
    writeFileSync(join(project, "bad.json"), JSON.stringify({ name: "bad", program: "counter.z80", ...(fields as object) }));
    assert.match(refusal(testing("record", "bad.json", "--out", ".c64-re-tools/local/bad")), message, name);
  }
});

/** A recording folder of the counter that no core made: for the checks before a replay. */
function fakeRecording(folder: string, sha256: string): void {
  mkdirSync(join(project, folder), { recursive: true });
  writeFileSync(join(project, folder, "program.z80"), keyboardCounterSnapshot());
  writeFileSync(join(project, folder, "reads.txt"), "");
  writeFileSync(join(project, folder, "recording.json"), JSON.stringify({ format: 1, machine: "spectrum48", name: "fake", program: "counter.z80", sha256, inputs: "xxfe,xx1f", steps: [{ frames: 1 }], ticks: 69888, hash: "00000000", sites: [] }));
}

test("replay refuses a file in place of a recording folder, a tape or a snapshot as a rebuild, and a changed program", () => {
  writeFileSync(join(project, "record.json"), JSON.stringify({ name: "counter", program: "counter.z80", steps: [{ frames: 5 }] }));
  assert.match(refusal(testing("replay", "record.json")), /record\.json is a file, not a recording folder\. Give the --out folder that record wrote/);
  writeFileSync(join(c64Project, "record.json"), "{}");
  assert.match(refusal(runIn(c64Project, "retro-testing", "testing.ts", "replay", "record.json")), /record\.json is a file, not a recording folder/);

  fakeRecording(".c64-re-tools/local/fake", createHash("sha256").update(keyboardCounterSnapshot()).digest("hex"));
  writeFileSync(join(project, "game.tzx"), "ZXTape!\x1a\x01\x14");
  writeFileSync(local("tape.bin"), "ZXTape!\x1a\x01\x14");
  writeFileSync(local("build-a.bin"), keyboardCounterCode);
  for (const [file, kind] of [["game.tzx", "tzx"], ["counter.z80", "z80"], [".c64-re-tools/local/tape.bin", "tzx"]]) {
    assert.match(refusal(testing("replay", ".c64-re-tools/local/fake", "--rebuild", file!, "--rebuild-at", "$4000")), new RegExp(`is a ${kind} file, not the bytes of a build`), file);
  }
  assert.match(refusal(testing("replay", ".c64-re-tools/local/fake", "--rebuild", ".c64-re-tools/local/build-a.bin", "--rebuild-at", "$ffff")), /are not inside the RAM, \$4000-\$ffff/);
  assert.match(refusal(testing("replay", ".c64-re-tools/local/fake", "--out", ".c64-re-tools/local/out")), /--rebuild is missing/);

  fakeRecording(".c64-re-tools/local/changed", "0".repeat(64));
  const changed = testing("replay", ".c64-re-tools/local/changed");
  assert.equal(changed.status, 0);
  assert.equal(changed.json.result, "INCONCLUSIVE");
  assert.match(changed.json.reason as string, /program\.z80 is not the program of the recording \(its SHA-256 changed\)/);
});

test("a recording of key presses replays on the original and on a rebuild, and a changed rebuild fails with the changed RAM", { skip, timeout: 300_000 }, () => {
  const steps = [{ frames: 10 }, { press: ["space"], frames: 5 }, { frames: 10 }, { press: ["caps"] }, { joystick: { fire: true } }, { frames: 10 }];
  writeFileSync(join(project, "record.json"), JSON.stringify({ name: "counter", program: "counter.z80", steps }));
  const recorded = testing("record", "record.json", "--out", "tests/recordings/counter");
  assert.equal(recorded.status, 0, JSON.stringify(recorded.json));
  assert.deepEqual([recorded.json.result, recorded.json.frames], ["PASS", 38]);
  assert.ok((recorded.json.inputSites as number) >= 2, "the keyboard sites of the counter");
  assert.match(recorded.envelope.hint!, /Add tests\/recordings\/counter\/coverage\.bin to the project knowledge as coverage/);
  assert.match(recorded.envelope.nextAction!, /testing\.ts replay tests\/recordings\/counter/);
  const program = readFileSync(join(project, "tests/recordings/counter/program.z80"));
  const recording = JSON.parse(readFileSync(join(project, "tests/recordings/counter/recording.json"), "utf8")) as { sha256: string };
  assert.equal(recording.sha256, createHash("sha256").update(program).digest("hex"));

  assert.deepEqual(testing("replay", "tests/recordings/counter").json.result, "PASS");
  writeFileSync(local("rebuild.bin"), keyboardCounterCode);
  const rebuilt = testing("replay", "tests/recordings/counter", "--rebuild", ".c64-re-tools/local/rebuild.bin", "--rebuild-at", "$8000");
  assert.deepEqual(rebuilt.json.result, "PASS", JSON.stringify(rebuilt.json));

  // A NOP in place of INC (HL) in COUNT: the presses are not counted, so the RAM at the end differs.
  const changed = Uint8Array.from(keyboardCounterCode);
  changed[COUNT - 0x8000 + 3] = 0x00;
  writeFileSync(local("changed.bin"), changed);
  const failed = testing("replay", "tests/recordings/counter", "--rebuild", ".c64-re-tools/local/changed.bin", "--rebuild-at", "$8000");
  assert.equal(failed.json.result, "FAIL");
  assert.match(failed.json.reason as string, /the rebuild does not end as the original: the RAM at the end is not the RAM of the recording/);
  const memory = failed.json.memory as { changedBytes: number; count: number; listed: Array<{ start: string; end: string; original?: string; rebuild?: string }> };
  // The changed code byte first, then the count of presses at $9000.
  assert.deepEqual(memory.listed[0], { start: "$8033", end: "$8033", original: "34", rebuild: "00" });
  assert.equal(memory.listed[1]!.start, `$${PRESSES.toString(16)}`);
  assert.equal(memory.listed[1]!.rebuild?.slice(0, 2), "00");
  assert.match(failed.envelope.hint!, /memory lists the changed ranges of the RAM at the end.*Give --out/);
  assert.equal(testing("replay", "tests/recordings/counter", "--rebuild", ".c64-re-tools/local/changed.bin").status, 2);

  const withFiles = testing("replay", "tests/recordings/counter", "--rebuild", ".c64-re-tools/local/changed.bin", "--rebuild-at", "$8000", "--out", ".c64-re-tools/local/fail");
  assert.deepEqual((withFiles.json.files as Array<{ out: string; bytes: number }>).map((file) => [file.out, file.bytes]), [
    [".c64-re-tools/local/fail/original.bin", 0xc000],
    [".c64-re-tools/local/fail/rebuild.bin", 0xc000],
  ]);
  assert.match(withFiles.envelope.nextAction!, /testing\.ts diff \.c64-re-tools\/local\/fail\/original\.bin \.c64-re-tools\/local\/fail\/rebuild\.bin --address '?\$4000'?/);
  const diff = testing("diff", ".c64-re-tools/local/fail/original.bin", ".c64-re-tools/local/fail/rebuild.bin", "--address", "$4000");
  assert.equal(diff.status, 0, JSON.stringify(diff.envelope));
  assert.deepEqual((diff.json.memory as { listed: unknown[] }).listed[0], { start: "$8033", end: "$8033", a: "34", b: "00" });

  // One flipped byte in program.z80 of the recording: no longer the program of the recording.
  const flipped = Buffer.from(program);
  flipped[flipped.length - 5]! ^= 0xff;
  writeFileSync(join(project, "tests/recordings/counter/program.z80"), flipped);
  const tampered = testing("replay", "tests/recordings/counter");
  assert.deepEqual([tampered.json.result, tampered.json.sides], ["INCONCLUSIVE", []]);
  assert.match(tampered.json.reason as string, /is not the program of the recording/);
});

test("the changed RAM of a 128K names each bank at $c000, and the 48K RAM starts at $4000", () => {
  const banks = (count: number) => Array.from({ length: count }, () => new Uint8Array(0x4000));
  const [original48, rebuild48] = [banks(3), banks(3)];
  rebuild48[1]![0x10] = 1;
  assert.deepEqual(zxRamDifferences(zxRamParts(original48, rebuild48)), { changedBytes: 1, ranges: [{ start: 0x8010, end: 0x8010, a: "00", b: "01" }] });
  const [original128, rebuild128] = [banks(8), banks(8)];
  rebuild128[5]![0] = 2;
  rebuild128[7]![0x3fff] = 3;
  assert.deepEqual(zxRamDifferences(zxRamParts(original128, rebuild128)).ranges, [
    { bank: 5, start: 0xc000, end: 0xc000, a: "00", b: "02" },
    { bank: 7, start: 0xffff, end: 0xffff, a: "00", b: "03" },
  ]);
});
