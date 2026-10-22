// The c64-testing recording parts that need no replay core: record file
// checks, keys and joystick masks, the site map, the checkpoint comparison,
// and the refusal when c64run is missing.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { STOP_AND_ASK } from "../../src/protocol/messages.ts";
import { firstDifference, joystickMask, mover, parseStateItem, pinLines, readRecordFile, siteMap } from "../../skills/c64-testing/scripts/lib/recording.ts";
import { Refusal } from "../../src/errors.ts";
import { namesOf } from "../../skills/c64-testing/scripts/lib/scenario.ts";
import { readEnvelope } from "../kit.ts";

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
  state: ["$c100", { address: "$c101", size: 2 }],
  steps: [{ frames: 10 }, { joystick: { port: 2, direction: "left" } }, { press: { keys: "RUN\n" } }, { runUntil: { target: { kind: "address", address: "$c015" }, timeoutFrames: 5 } }],
};

function file(name: string, value: unknown): string {
  writeFileSync(join(project, name), JSON.stringify(value));
  return name;
}

test("a record file needs a program and steps the replay core can do; a checkpoint and state are optional", () => {
  const read = readRecordFile(file("ok.json", valid));
  assert.deepEqual(read.compare, { checkpoint: "$c015", state: [{ address: "$c100", size: 1 }, { address: "$c101", size: 2 }] });
  assert.deepEqual(read.inputs, ["$dc00", "$dc01", "$d419", "$d41a", "$d41b", "$d41c", "$de00-$dfff"]);
  assert.deepEqual(readRecordFile(file("range.json", { ...valid, inputs: ["$dc00", "$d012-$d012"] })).inputs, ["$dc00", "$d012-$d012"]);
  assert.deepEqual(readRecordFile(file("pin.json", { ...valid, pin: [{ address: "$0016", size: 2 }] })).compare?.pin, [{ address: "$0016", size: 2 }]);
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
    badKey: { ...valid, steps: [{ press: { keys: "£" } }] },
    badInput: { ...valid, inputs: ["$c000"] },
    badRange: { ...valid, inputs: ["$de00-$e000"] },
    badCoverage: { ...valid, coverage: "game_start" },
    coverageNumber: { ...valid, coverage: 0x1aed },
  })) {
    assert.throws(() => readRecordFile(file(`${name}.json`, bad)), Refusal, name);
  }
});

test("the coverage of a record file starts at the first input read, at the program start, or at an address", () => {
  assert.equal(readRecordFile(file("input.json", valid)).coverage, "input");
  assert.equal(readRecordFile(file("start.json", { ...valid, coverage: "start" })).coverage, "start");
  assert.equal(readRecordFile(file("address.json", { ...valid, coverage: "$1AED" })).coverage, "$1AED");
  assert.throws(() => readRecordFile(file("named.json", { ...valid, coverage: "game_start" })), {
    code: "invalid-input",
    message: 'record file named.json: coverage must be "input" (default), "start" or a $ address such as "$1aed", not "game_start"',
  });
});

/**
 * A stand-in replay core for record: it answers each command with the machine
 * state, writes the files that record and coverage name, logs the commands,
 * and answers coverage status with `from`.
 */
function recordingCore(name: string, from: string): { path: string; log: string } {
  const path = join(project, name);
  const log = join(project, `${name}.log`);
  const state = "ok tick=982800 sync=1 pc=1aed a=00 x=00 y=00 s=fd p=16 line=0 cycle=7 hash=0123abcd";
  writeFileSync(
    path,
    [
      "#!/bin/sh",
      "while read cmd rest; do",
      `  echo "$cmd $rest" >> ${log}`,
      '  case "$cmd" in',
      '    version) echo "ok c64run protocol=4 chips=test" ;;',
      '    inputs|joy|key|write) echo "ok" ;;',
      '    record) [ "$rest" = off ] || : > "$rest"; echo "ok" ;;',
      '    sites) echo "ok unknown=0" ;;',
      '    coverage) case "$rest" in',
      `        status) echo "${from}" ;;`,
      '        on*|off) echo "ok" ;;',
      '        *) head -c 65536 /dev/zero > "$rest"; echo "ok" ;;',
      "      esac ;;",
      "    quit) exit 0 ;;",
      `    *) echo "${state}" ;;`,
      "  esac",
      "done",
      "",
    ].join("\n"),
  );
  chmodSync(path, 0o755);
  return { path, log };
}

test("record starts the coverage as the record file tells, and the summary gives where it started", { skip: process.platform === "win32" ? "the stand-in replay core is a shell script" : false }, () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  const record = (name: string, coverage: string | undefined, from: string) => {
    const core = recordingCore(`c64run-${name}`, from);
    const run = spawnSync(process.execPath, [...process.execArgv, resolve(home, "skills/c64-testing/scripts/testing.ts"), "record", file(`${name}.json`, { name, program: "game.prg", symbols: "none", ...(coverage === undefined ? {} : { coverage }), steps: [{ frames: 10 }] }), "--out", `tests/recordings/${name}`], {
      cwd: project,
      encoding: "utf8",
      env: { ...process.env, C64RT_C64RUN: core.path },
    });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const commands = readFileSync(core.log, "utf8").split("\n");
    // The coverage starts after the program is in memory: the start of the C64 itself is never in the map.
    assert.ok(commands.findIndex((line) => line.startsWith("coverage on")) > commands.map((line) => line.startsWith("write ")).lastIndexOf(true), commands.join(", "));
    return { body: readEnvelope(run.stdout, run.status).json, commands };
  };
  const input = record("by-input", undefined, "ok from tick=982800 pc=1aed");
  assert.ok(input.commands.includes("coverage on-input"));
  assert.deepEqual(input.body.coverageFrom, { frame: 50, pc: "$1aed" });
  assert.ok(record("by-start", "start", "ok from tick=982800 pc=e5d4").commands.includes("coverage on"));
  const address = record("by-address", "$1aed", "ok not-started");
  assert.ok(address.commands.includes("coverage on-pc 1aed"));
  assert.deepEqual([address.body.recorded, address.body.coverageFrom, address.body.executed], [true, null, 0]);
});

test("a state item of the command line is a name or an address with an optional size", () => {
  assert.deepEqual(parseStateItem("room"), { address: "room", size: 1 });
  assert.deepEqual(parseStateItem("$c100:2"), { address: "$c100", size: 2 });
  assert.throws(() => parseStateItem("room:0"), { code: "invalid-input", message: /^--state room:0: give a name or a \$ address, with :size from 1 to / });
  assert.throws(() => parseStateItem("seed:0", "--pin"), { code: "invalid-input", message: /^--pin seed:0: give a name or a \$ address/ });
});

test("an address of the original moves with the name before it", () => {
  const move = mover(new Map([["frames", 0xc100], ["main", 0xc000]]), new Map([["frames", 0xc100], ["main", 0xc400]]));
  assert.equal(move(0xc015), 0xc415);
  assert.equal(move(0xc101), 0xc101);
  assert.equal(move(0x0400), 0x0400);
});

test("directions give joystick masks", () => {
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
  const state = [{ address: "room", size: 1 }];
  assert.deepEqual(pinLines(["100 00 1a02", "200 01 1b02"], state), ["1a02", "1b02"]);
  assert.equal(firstDifference(["100 00 1a02"], ["90 00 9902"], state), undefined);
});

test("the first different checkpoint names the state items that differ", () => {
  const state = [{ address: "room", size: 1 }, { address: "$c100", size: 2 }];
  const expected = ["100 00 0102", "200 01 0103", "300 01 0104"];
  assert.equal(firstDifference(expected, ["90 00 0102", "180 01 0103", "290 01 0104"], state), undefined);
  assert.deepEqual(firstDifference(expected, ["90 00 0102", "180 02 0103"], state), { checkpoint: 2, tick: { original: 200, rebuild: 180 }, items: [{ address: "room", original: "01", rebuild: "02" }] });
});

test("record and replay refuse by name when c64run is missing", () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  for (const [script, args] of [
    ["record", ["ok.json", "--out", "tests/recordings/walk"]],
    ["replay", ["tests/recordings/walk"]],
  ] as const) {
    if (script === "replay") {
      mkdirSync(join(project, "tests/recordings/walk"), { recursive: true });
      writeFileSync(
        join(project, "tests/recordings/walk/recording.json"),
        JSON.stringify({ format: 1, name: "walk", program: "game.prg", sha256: "a3", symbols: "none", inputs: [], events: [], sites: [], ticks: 1, hash: "00000000" }),
      );
    }
    const run = spawnSync(process.execPath, [...process.execArgv, resolve(home, "skills/c64-testing/scripts/testing.ts"), script, ...args], {
      cwd: project,
      encoding: "utf8",
      env: { ...process.env, C64RT_C64RUN: join(project, "no-c64run") },
    });
    if (script === "replay") {
      // The program changed since the recording: that is found before the core starts.
      assert.equal(run.status, 0, run.stderr);
      const { envelope, json } = readEnvelope(run.stdout, run.status);
      assert.equal(json.result, "INCONCLUSIVE");
      assert.match(envelope.hint ?? "", /^reason tells why the script could not compare\./);
      assert.match(json.reason, /is not the program of the recording/);
      continue;
    }
    assert.equal(run.status, 2, run.stderr);
    const error = readEnvelope(run.stdout, run.status).json.error;
    assert.equal(error.code, "installation-incomplete");
    assert.match(error.message, /C64RT_C64RUN/);
    assert.ok(error.message.endsWith(STOP_AND_ASK));
  }
});

test("a record file names itself and the step of a key that the replay core does not have, and refuses the 2.0 forms", () => {
  const message = (name: string, value: unknown) => {
    try {
      readRecordFile(file(name, value));
    } catch (error) {
      return (error as Error).message;
    }
    return assert.fail(`${name} is not refused`);
  };
  assert.equal(message("umlaut.json", { ...valid, steps: [{ frames: 10 }, { press: { keys: "ä" } }] }), 'record file umlaut.json: step 2: press.keys: the C64 keyboard has no key "ä"');
  assert.equal(message("old-state.json", { ...valid, state: [{ at: "falls_left", size: 3 }] }), "record file old-state.json: state item 1 has the field at. at is a 2.0 field. Write address in place of at");
  assert.equal(message("old-pin.json", { ...valid, pin: [{ at: "random_ptr", size: 2 }] }), "record file old-pin.json: pin item 1 has the field at. at is a 2.0 field. Write address in place of at");
  assert.equal(message("old-type.json", { ...valid, steps: [{ type: " " }] }), 'record file old-type.json: step 1 has the 2.0 form (type as text). Write {"type": {"mode": "text", "text": " "}}, or {"type": {"mode": "petscii", "bytes": [...]}} for PETSCII codes');
});

test("a recording of 2.0 is refused with the field and the 2.1 form before the replay core starts, never replayed", () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  const replay = (name: string, recording: Record<string, unknown>) => {
    mkdirSync(join(project, "tests/recordings", name), { recursive: true });
    writeFileSync(join(project, "tests/recordings", name, "recording.json"), JSON.stringify({ format: 1, name, program: "game.prg", sha256: "a3", symbols: "knowledge", load: false, inputs: [], events: [], sites: [], ticks: 1, hash: "00000000", ...recording }));
    const run = spawnSync(process.execPath, [...process.execArgv, resolve(home, "skills/c64-testing/scripts/testing.ts"), "replay", `tests/recordings/${name}`], {
      cwd: project,
      encoding: "utf8",
      env: { ...process.env, C64RT_C64RUN: join(project, "no-c64run") },
    });
    assert.equal(run.status, 2, run.stdout + run.stderr);
    const { error } = readEnvelope(run.stdout, run.status).json as { error: { code: string; message: string } };
    assert.equal(error.code, "invalid-input");
    return error.message;
  };
  // The events of the Bruce Lee recording of 2.0.
  const remedy = "Record the session again with record, or write the 2.1 form in recording.json";
  assert.equal(
    replay("run-until", { events: [{ step: 10, action: { runUntil: { at: "main_loop" }, timeoutFrames: 300 }, key: { site: "$13a3", addr: "$dc00", count: 68892 } }] }),
    `recording tests/recordings/run-until/recording.json: event 1 (step 10) has the 2.0 form (runUntil.at, timeoutFrames beside runUntil). Write {"runUntil": {"target": {"kind": "address", "address": "main_loop"}, "timeoutFrames": 300}}. ${remedy}`,
  );
  assert.equal(
    replay("write", { events: [{ step: 11, action: { write: { at: "next_room", bytes: [1] } }, key: { previous: true } }] }),
    `recording tests/recordings/write/recording.json: event 1 (step 11) has the 2.0 form (write.at, write.bytes). Write {"write": {"address": "next_room", "data": "01"}}. ${remedy}`,
  );
  assert.equal(
    replay("type", { events: [{ step: 2, action: { type: " " }, key: { tick: 5 } }] }),
    `recording tests/recordings/type/recording.json: event 1 (step 2) has the 2.0 form (type as text). Write {"type": {"mode": "text", "text": " "}}, or {"type": {"mode": "petscii", "bytes": [...]}} for PETSCII codes. ${remedy}`,
  );
  assert.equal(
    replay("compare", { compare: { checkpoint: "main_loop", state: [{ at: "falls_left", size: 3 }], pin: [{ at: "random_ptr", size: 2 }] } }),
    `recording tests/recordings/compare/recording.json: compare: state item 1 has the field at. at is a 2.0 field. Write address in place of at. ${remedy}`,
  );
});
