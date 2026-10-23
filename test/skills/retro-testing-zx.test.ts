// Record and replay of a ZX Spectrum program in zxrun: the keyboard counter,
// its rebuild, and a changed rebuild. The refusals of a ZX Spectrum project
// (test, run, diff, record files, replay subjects and rebuilds) are calls of
// the lib functions and need no zxrun; the record and replay test is skipped
// when zxrun is not installed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { MACHINES } from "../../src/machine.ts";
import { findTool, ZXRUN } from "../../src/native/discover.ts";
import { diffFiles } from "../../skills/retro-testing/scripts/lib/diff-files.ts";
import { recordingFolder } from "../../skills/retro-testing/scripts/lib/recording.ts";
import { checkZxSteps } from "../../src/host-client/zx-steps.ts";
import { checkZxReplayOptions, checkZxReplayOut, readZxRebuild, readZxRecordFile, readZxRecording, refuseOtherMachine, zxProgramProblem, zxRamDifferences, zxRamParts, type ZxRecording } from "../../skills/retro-testing/scripts/lib/zx-recording.ts";
import { importSnapshot } from "../fixtures/program.ts";
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
mkdirSync(join(project, ".c64-re-tools", "local"), { recursive: true });
writeFileSync(join(project, "counter.z80"), keyboardCounterSnapshot());
const home = process.cwd();
// The lib functions read paths relative to the project: each test runs in it.
beforeEach(() => process.chdir(project));
afterEach(() => process.chdir(home));
after(() => rmSync(project, { recursive: true, force: true }));

function testing(...args: string[]): { status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope } {
  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, "retro-testing", "scripts", "testing.ts"), ...args], { cwd: project, encoding: "utf8", timeout: 300_000 });
  const { envelope, json } = readEnvelope(child.stdout, child.status);
  return { status: child.status, json: json as Record<string, unknown>, envelope };
}
const local = (name: string) => join(project, ".c64-re-tools", "local", name);

test("test and run in a ZX Spectrum project refuse by the machine and tell to record and replay", () => {
  for (const command of ["test", "run"]) {
    assert.throws(() => refuseOtherMachine(command, MACHINES.spectrum48), { code: "invalid-input", message: new RegExp(`^${command} is for a C64 program, and this project is a ZX Spectrum 48K project`), hint: /with record\. Then replay the recording/ });
    refuseOtherMachine(command, MACHINES.c64);
  }
});

test("diff in a ZX Spectrum project compares only memory files", async () => {
  const options = { gap: 0, max: 50, ntsc: false, memoryOnly: MACHINES.spectrum48.name };
  await assert.rejects(diffFiles("counter.z80", "counter.z80", options), { code: "invalid-input", message: /counter\.z80 is a ZX Spectrum snapshot, and diff compares no ZX Spectrum snapshot/ });
  writeFileSync(local("a.vsf"), "VICE Snapshot File\x1a");
  await assert.rejects(diffFiles(".c64-re-tools/local/a.vsf", ".c64-re-tools/local/a.vsf", options), { code: "invalid-input", message: /is not a memory file\. In a ZX Spectrum 48K project, diff compares only memory files/ });
});

test("a ZX Spectrum record file refuses the keys and steps of the C64 form by name, and steps that run no frame", () => {
  const cases: Array<[string, unknown, RegExp]> = [
    ["c64 joystick", { steps: [{ frames: 5 }, { joystick: { port: 2, direction: "right" } }, { frames: 5 }] }, /step 2: joystick has no port: that is the C64 form/],
    ["joystick value", { steps: [{ joystick: { right: 1 } }, { frames: 5 }] }, /step 1: joystick right must be true or false/],
    ["checkpoint", { checkpoint: "$c7ab", state: ["$fe10"], steps: [{ frames: 5 }] }, /checkpoint is for a C64 program/],
    ["unknown key", { comment: "x", steps: [{ frames: 5 }] }, /comment is not a key of a ZX Spectrum record file/],
    ["joystick only", { steps: [{ joystick: { right: true } }] }, /the steps run no frame\. Give a frames or a press step/],
    ["type step", { steps: [{ type: { mode: "text", text: "x" } }] }, /step 1: type is a step for a C64 program/],
    ["extra step key", { steps: [{ frames: 5, press: ["space"], fire: true }] }, /step 1: fire is not a key of this step/],
    ["screen path", { steps: [{ frames: 5 }, { screen: "../title" }] }, /step 2: screen must be a file name without \.png/],
    ["screen twice", { steps: [{ screen: "a" }, { frames: 5 }, { screen: "a" }] }, /step 3: the screen a comes two times/],
    ["screen only", { steps: [{ screen: "a" }] }, /the steps run no frame/],
    ["program", { program: "game.tzx", steps: [{ frames: 5 }] }, /program must be "knowledge" \(the snapshot of the program in the project knowledge\), or a \.z80 or \.sna snapshot/],
  ];
  for (const [name, fields, message] of cases) {
    writeFileSync("bad.json", JSON.stringify({ name: "bad", program: "counter.z80", ...(fields as object) }));
    assert.throws(() => readZxRecordFile("bad.json"), { code: "invalid-input", message }, name);
  }
  writeFileSync("good.json", JSON.stringify({ name: "good", program: "knowledge", steps: [{ frames: 5 }, { screen: "title" }] }));
  assert.deepEqual(readZxRecordFile("good.json"), { name: "good", program: "knowledge", steps: [{ frames: 5 }, { screen: "title" }] });
  // The steps of a release compare have no screen step.
  assert.throws(() => checkZxSteps([{ screen: "title" }], (what) => assert.fail(what)), /step 1: the step is not frames, press or joystick/);
});

test("replay refuses a file in place of a recording folder, C64 options, a missing --rebuild, a tape or a snapshot as a rebuild, and finds a changed program", () => {
  writeFileSync("record.json", "{}");
  assert.throws(() => recordingFolder("record.json"), { code: "invalid-input", message: /record\.json is a file, not a recording folder\. Give the --out folder that record wrote/ });
  const options = { c64Options: [], rebuild: undefined, at: undefined };
  assert.throws(() => checkZxReplayOptions({ ...options, c64Options: ["checkpoint"] }), { code: "invalid-input", message: /^--checkpoint is for a C64 program/ });
  assert.throws(() => checkZxReplayOptions({ ...options, rebuild: "build.bin" }), { code: "invalid-input", message: /give --rebuild and --rebuild-at together/ });

  writeFileSync("game.tzx", "ZXTape!\x1a\x01\x14");
  writeFileSync(local("tape.bin"), "ZXTape!\x1a\x01\x14");
  writeFileSync(local("build-a.bin"), keyboardCounterCode);
  for (const [file, kind] of [["game.tzx", "tzx"], ["counter.z80", "z80"], [".c64-re-tools/local/tape.bin", "tzx"]]) {
    assert.throws(() => readZxRebuild(file!, 0x4000), { code: "invalid-input", message: new RegExp(`is a ${kind} file, not the bytes of a build`) }, file);
  }
  assert.throws(() => readZxRebuild(".c64-re-tools/local/build-a.bin", 0xffff), { code: "invalid-input", message: /are not inside the RAM, \$4000-\$ffff/ });

  // A recording folder that no core made, with a SHA-256 that is not the one of its program.z80.
  const folder = ".c64-re-tools/local/changed";
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "program.z80"), keyboardCounterSnapshot());
  writeFileSync(join(folder, "recording.json"), JSON.stringify({ format: 1, machine: "spectrum48", name: "fake", program: "counter.z80", sha256: "0".repeat(64), inputs: "xxfe,xx1f", steps: [{ frames: 1 }], ticks: 69888, hash: "00000000", sites: [] }));
  assert.throws(() => readZxRecording(folder), { code: "invalid-input", message: /is a recording of an older version of the toolkit, with another timing of the ZX Spectrum\. Record the session again/ });
  const recording = { format: 2, machine: "spectrum48", name: "fake", program: "counter.z80", sha256: "0".repeat(64), inputs: "xxfe,xx1f", steps: [{ frames: 1 }], ticks: 69888, hash: "00000000", sites: [], screens: [] };
  writeFileSync(join(folder, "recording.json"), JSON.stringify(recording));
  assert.match(zxProgramProblem(folder, readZxRecording(folder))!, /program\.z80 is not the program of the recording \(its SHA-256 changed\)/);
  // --out writes the screens, and the RAM of a rebuild: a recording without screens needs --rebuild for it.
  assert.throws(() => checkZxReplayOut(".c64-re-tools/local/out", undefined, recording as ZxRecording), { code: "invalid-input", message: /This recording has no screen step, and --rebuild is missing/ });
  checkZxReplayOut(".c64-re-tools/local/out", undefined, { ...recording, screens: [{ name: "a", tick: 1, sha256: "0" }] } as ZxRecording);
  checkZxReplayOut(".c64-re-tools/local/out", "build.bin", recording as ZxRecording);
});

test("a recording of key presses replays on the original and on a rebuild, and a changed rebuild fails with the changed RAM", { skip, timeout: 300_000 }, () => {
  importSnapshot(project, keyboardCounterSnapshot());
  const steps = [{ frames: 10 }, { press: ["space"], frames: 5 }, { frames: 10 }, { press: ["caps"] }, { joystick: { fire: true } }, { frames: 10 }];
  writeFileSync(join(project, "record.json"), JSON.stringify({ name: "counter", program: "counter.z80", steps }));
  const recorded = testing("record", "record.json", "--out", "tests/recordings/counter");
  assert.equal(recorded.status, 0, JSON.stringify(recorded.json));
  assert.deepEqual([recorded.json.result, recorded.json.frames], ["PASS", 38]);
  assert.ok((recorded.json.inputSites as number) >= 2, "the keyboard sites of the counter");
  assert.match(recorded.envelope.hint!, /tests\/recordings\/counter\/coverage\.bin/);
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
  const failed = testing("replay", "tests/recordings/counter", "--rebuild", ".c64-re-tools/local/changed.bin", "--rebuild-at", "$8000", "--out", ".c64-re-tools/local/fail");
  assert.equal(failed.json.result, "FAIL");
  assert.match(failed.json.reason as string, /the RAM at the end is not the RAM of the recording/);
  const memory = failed.json.memory as { changedBytes: number; count: number; listed: Array<{ start: string; end: string; original?: string; rebuild?: string }> };
  // The changed code byte first, then the count of presses at $9000.
  assert.deepEqual(memory.listed[0], { start: "$8033", end: "$8033", original: "34", rebuild: "00" });
  assert.equal(memory.listed[1]!.start, `$${PRESSES.toString(16)}`);
  assert.equal(memory.listed[1]!.rebuild?.slice(0, 2), "00");
  assert.deepEqual((failed.json.files as Array<{ out: string; bytes: number }>).map((file) => [file.out, file.bytes]), [
    [".c64-re-tools/local/fail/original.bin", 0xc000],
    [".c64-re-tools/local/fail/rebuild.bin", 0xc000],
  ]);
  assert.match(failed.envelope.nextAction!, /testing\.ts diff \.c64-re-tools\/local\/fail\/original\.bin \.c64-re-tools\/local\/fail\/rebuild\.bin --address '?\$4000'?/);
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

test("a record file of the snapshot in the knowledge writes a picture of each screen step, and a replay makes each picture again and compares it", { skip, timeout: 300_000 }, () => {
  importSnapshot(project, keyboardCounterSnapshot());
  const steps = [{ frames: 10 }, { screen: "start" }, { press: ["space"], frames: 5 }, { frames: 10 }, { screen: "counted" }, { frames: 10 }];
  writeFileSync(join(project, "screens.json"), JSON.stringify({ name: "screens", program: "knowledge", steps }));
  const recorded = testing("record", "screens.json", "--out", "tests/recordings/screens");
  assert.equal(recorded.status, 0, JSON.stringify(recorded.json));
  assert.deepEqual([recorded.json.result, recorded.json.screens], ["PASS", [{ name: "start", frame: 10 }, { name: "counted", frame: 25 }]]);
  assert.match(recorded.envelope.hint!, /^Look at the screens/);
  const png = (name: string) => readFileSync(join(project, "tests/recordings/screens", `${name}.png`));
  // A PNG of 320 x 256 pixels: the 256 x 192 picture in a border of 32 pixels.
  assert.deepEqual([png("start").readUInt32BE(16), png("start").readUInt32BE(20)], [320, 256]);
  // The count of the presses shows in the border, so the two pictures are different.
  assert.notDeepEqual(png("start"), png("counted"));
  const recording = JSON.parse(readFileSync(join(project, "tests/recordings/screens/recording.json"), "utf8")) as ZxRecording;
  assert.deepEqual(recording.screens.map((screen) => [screen.name, screen.tick, screen.sha256]), [
    ["start", 10 * 69_888, createHash("sha256").update(png("start")).digest("hex")],
    ["counted", 25 * 69_888, createHash("sha256").update(png("counted")).digest("hex")],
  ]);

  const replayed = testing("replay", "tests/recordings/screens", "--out", ".c64-re-tools/local/screens");
  assert.equal(replayed.json.result, "PASS", JSON.stringify(replayed.json));
  assert.deepEqual((replayed.json.sides as Array<{ screens: unknown }>)[0]!.screens, [{ name: "start", same: true }, { name: "counted", same: true }]);
  assert.deepEqual(readFileSync(local("screens/original-counted.png")), png("counted"));

  // A rebuild that counts no press: the border of the second picture is different.
  const changed = Uint8Array.from(keyboardCounterCode);
  changed[COUNT - 0x8000 + 3] = 0x00;
  writeFileSync(local("changed.bin"), changed);
  const failed = testing("replay", "tests/recordings/screens", "--rebuild", ".c64-re-tools/local/changed.bin", "--rebuild-at", "$8000", "--out", ".c64-re-tools/local/screens-fail");
  assert.equal(failed.json.result, "FAIL");
  assert.match(failed.json.reason as string, /the screen counted at tick 1747200 is not the screen of the recording/);
  assert.deepEqual((failed.json.sides as Array<{ screens: unknown }>)[1]!.screens, [{ name: "start", same: true }, { name: "counted", same: false }]);
  assert.deepEqual(
    (failed.json.files as Array<{ out: string }>).map((file) => file.out).filter((out) => out.endsWith(".png")),
    ["original-start.png", "original-counted.png", "rebuild-start.png", "rebuild-counted.png"].map((name) => `.c64-re-tools/local/screens-fail/${name}`),
  );
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
