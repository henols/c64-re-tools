// The c64-testing recording parts that need no replay core: record file
// checks, keys and joystick masks, the site map, the checkpoint comparison,
// and the refusal when c64run is missing.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { STOP_AND_ASK } from "../../src/protocol/messages.ts";
import { firstDifference, joystickMask, keyCodes, mover, parseStateItem, pinLines, readRecordFile, siteMap } from "../../skills/c64-testing/scripts/lib/recording.ts";
import { namesOf, ScenarioError } from "../../skills/c64-testing/scripts/lib/scenario.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-recording-"));
mkdirSync(join(project, ".c64-re-tools"));
const home = process.cwd();
beforeEach(() => process.chdir(project));
afterEach(() => process.chdir(home));
after(() => rmSync(project, { recursive: true, force: true }));

const valid = {
  name: "walk",
  program: "game.prg",
  symbols: "none",
  checkpoint: "$c015",
  state: ["$c100", { at: "$c101", size: 2 }],
  steps: [{ frames: 10 }, { joystick: { port: 2, direction: "left" } }, { press: "RUN\n" }, { runUntil: { target: { kind: "address", address: "$c015" }, timeoutFrames: 5 } }],
};

function file(name: string, value: unknown): string {
  writeFileSync(join(project, name), JSON.stringify(value));
  return name;
}

test("a record file needs a program and steps the replay core can do; a checkpoint and state are optional", () => {
  const read = readRecordFile(file("ok.json", valid));
  assert.deepEqual(read.compare, { checkpoint: "$c015", state: [{ at: "$c100", size: 1 }, { at: "$c101", size: 2 }] });
  assert.deepEqual(read.inputs, ["$dc00", "$dc01", "$d419", "$d41a", "$d41b", "$d41c", "$de00-$dfff"]);
  assert.deepEqual(readRecordFile(file("range.json", { ...valid, inputs: ["$dc00", "$d012-$d012"] })).inputs, ["$dc00", "$d012-$d012"]);
  assert.deepEqual(readRecordFile(file("pin.json", { ...valid, pin: [{ at: "$0016", size: 2 }] })).compare?.pin, [{ at: "$0016", size: 2 }]);
  assert.equal(read.load, false);
  assert.equal(readRecordFile(file("bare.json", { ...valid, checkpoint: undefined, state: undefined })).compare, undefined);
  for (const [name, bad] of Object.entries({
    checkpointOnly: { ...valid, state: undefined },
    pinOnly: { ...valid, checkpoint: undefined, state: undefined, pin: ["$0016"] },
    stateOnly: { ...valid, checkpoint: undefined },
    noState: { ...valid, state: [] },
    tooMuchState: { ...valid, state: Array.from({ length: 17 }, () => "$c100") },
    unknownKey: { ...valid, observe: true },
    raster: { ...valid, steps: [{ runUntil: { target: { kind: "raster", line: 100 }, timeoutFrames: 5 } }] },
    observeStep: { ...valid, steps: [{ observe: "x" }] },
    badKey: { ...valid, steps: [{ press: "£" }] },
    badInput: { ...valid, inputs: ["$c000"] },
    badRange: { ...valid, inputs: ["$de00-$e000"] },
  })) {
    assert.throws(() => readRecordFile(file(`${name}.json`, bad)), ScenarioError, name);
  }
});

test("a state item of the command line is a name or an address with an optional size", () => {
  assert.deepEqual(parseStateItem("room"), { at: "room", size: 1 });
  assert.deepEqual(parseStateItem("$c100:2"), { at: "$c100", size: 2 });
  assert.throws(() => parseStateItem("room:0"), ScenarioError);
});

test("an address of the original moves with the name before it", () => {
  const move = mover(new Map([["frames", 0xc100], ["main", 0xc000]]), new Map([["frames", 0xc100], ["main", 0xc400]]));
  assert.equal(move(0xc015), 0xc415);
  assert.equal(move(0xc101), 0xc101);
  assert.equal(move(0x0400), 0x0400);
});

test("text types as keys of the matrix, and directions give joystick masks", () => {
  assert.deepEqual(keyCodes("run\n"), [0x52, 0x55, 0x4e, 0x0d]);
  assert.throws(() => keyCodes("~"), /cannot press/);
  assert.equal(joystickMask("center", false), 0);
  assert.equal(joystickMask("up-left", true), 0x15);
  assert.equal(joystickMask("right", false), 0x08);
});

test("a site moves with the code label before it; ROM sites, constants and far labels do not", () => {
  writeFileSync(
    join(project, "old.json"),
    JSON.stringify({ symbols: [{ name: "scan", kind: "address", address: "$13a0" }, { name: "sound", kind: "address", address: "$2560" }, { name: "PORT", kind: "constant", value: "$13a2" }] }),
  );
  writeFileSync(
    join(project, "new.json"),
    JSON.stringify({ symbols: [{ name: "scan", kind: "address", address: "$13a0" }, { name: "sound", kind: "address", address: "$2564" }, { name: "PORT", kind: "constant", value: "$13a2" }] }),
  );
  const sites = [
    { site: "$13a3", addr: "$dc00", reads: 10, rom: false },
    { site: "$256b", addr: "$d41b", reads: 10, rom: false },
    { site: "$ea93", addr: "$dc01", reads: 10, rom: true },
    { site: "$9000", addr: "$dc00", reads: 1, rom: false },
  ];
  const from = namesOf("old.json", "code");
  assert.equal(from.has("PORT"), false);
  assert.deepEqual(siteMap(sites, from, namesOf("new.json", "code")), [[0x256b, 0x256f]]);
});

test("the pinned fields of a checkpoint follow the state, and do not count as a difference", () => {
  const state = [{ at: "room", size: 1 }];
  assert.deepEqual(pinLines(["100 00 1a02", "200 01 1b02"], state), ["1a02", "1b02"]);
  assert.equal(firstDifference(["100 00 1a02"], ["90 00 9902"], state), undefined);
});

test("the first different checkpoint names the state items that differ", () => {
  const state = [{ at: "room", size: 1 }, { at: "$c100", size: 2 }];
  const expected = ["100 00 0102", "200 01 0103", "300 01 0104"];
  assert.equal(firstDifference(expected, ["90 00 0102", "180 01 0103", "290 01 0104"], state), undefined);
  assert.deepEqual(firstDifference(expected, ["90 00 0102", "180 02 0103"], state), { checkpoint: 2, tick: { original: 200, rebuild: 180 }, items: [{ at: "room", original: "01", rebuild: "02" }] });
});

test("record and replay refuse by name when c64run is missing", () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  for (const [script, args] of [
    ["record.ts", ["ok.json", "--out", "tests/recordings/walk"]],
    ["replay.ts", ["tests/recordings/walk"]],
  ] as const) {
    if (script === "replay.ts") {
      mkdirSync(join(project, "tests/recordings/walk"), { recursive: true });
      writeFileSync(
        join(project, "tests/recordings/walk/recording.json"),
        JSON.stringify({ format: 1, name: "walk", program: "game.prg", sha256: "a3", symbols: "none", inputs: [], events: [], sites: [], ticks: 1, hash: "00000000" }),
      );
    }
    const run = spawnSync(process.execPath, [...process.execArgv, resolve(home, "skills/c64-testing/scripts", script), ...args], {
      cwd: project,
      encoding: "utf8",
      env: { ...process.env, C64RT_C64RUN: join(project, "no-c64run") },
    });
    if (script === "replay.ts") {
      // The program changed since the recording: that is found before the core starts.
      assert.equal(run.status, 3, run.stderr);
      assert.match(JSON.parse(run.stdout).reason, /is not the program of the recording/);
      continue;
    }
    assert.equal(run.status, 2, run.stderr);
    const error = JSON.parse(run.stdout).error;
    assert.equal(error.code, "installation-incomplete");
    assert.match(error.message, /C64RT_C64RUN/);
    assert.ok(error.message.endsWith(STOP_AND_ASK));
  }
});
