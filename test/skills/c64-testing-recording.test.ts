// The c64-testing recording parts that need no replay core: record file
// checks, keys and joystick masks, the site map, the checkpoint comparison,
// and the refusal when c64run is missing.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { firstDifference, joystickMask, mover, parseStateItem, pinLines, readRecordFile, readRecording, showRecording, siteMap } from "../../skills/c64-testing/scripts/lib/recording.ts";
import { replay } from "../../skills/c64-testing/scripts/lib/replay.ts";
import { Refusal } from "../../src/errors.ts";
import { C64RUN_PROTOCOL } from "../../src/native/c64run.ts";
import { namesOf } from "../../skills/c64-testing/scripts/lib/scenario.ts";
import { withWrite } from "../../src/knowledge/database.ts";
import { renameSymbol } from "../../src/knowledge/write.ts";
import { importCoverage } from "../fixtures/program.ts";
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
  // 64 addresses, one of them also by its name: the replay core counts 64.
  const targets = [...Array.from({ length: 64 }, (_, index) => `$${(0x1000 + index).toString(16)}`), "main_loop"];
  const steps = targets.map((address) => ({ runUntil: { target: { kind: "address", address }, timeoutFrames: 5 } }));
  assert.equal(readRecordFile(file("names.json", { ...valid, symbols: file("names-symbols.json", { main_loop: "$1000" }), steps })).steps.length, 65);
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
      `    version) echo "ok c64run protocol=${C64RUN_PROTOCOL} chips=test" ;;`,
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
  const address = record("by-address", "$1aed", "ok not-started");
  assert.ok(address.commands.includes("coverage on-pc 1aed"));
  assert.deepEqual([address.body.recorded, address.body.coverageFrom, address.body.executed], [true, null, 0]);
});

test("a record into the folder of an earlier recording names each file that the knowledge gives as evidence and that the record changed", { skip: process.platform === "win32" ? "the stand-in replay core is a shell script" : false }, () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  const earlier = new Uint8Array(0x10000);
  earlier[0x0801] = 4;
  importCoverage(project, { "tests/recordings/cited/coverage.bin": earlier });
  withWrite((db) => renameSymbol(db, { origin: "llm", evidence: [{ kind: "test", ref: "tests/recordings/cited/recording.json", sha256: "0".repeat(64) }] }, { address: 0x0801, name: "start" }), project);
  const core = recordingCore("c64run-cited", "ok from tick=982800 pc=1aed");
  const run = spawnSync(process.execPath, [...process.execArgv, resolve(home, "skills/c64-testing/scripts/testing.ts"), "record", file("cited.json", { name: "cited", program: "game.prg", symbols: "none", steps: [{ frames: 10 }] }), "--out", "tests/recordings/cited"], {
    cwd: project,
    encoding: "utf8",
    env: { ...process.env, C64RT_C64RUN: core.path },
  });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const evidence = (readEnvelope(run.stdout, run.status).json.evidence as Array<{ file: string; state: string }>).map((change) => [change.file, change.state]);
  assert.deepEqual(evidence, [["tests/recordings/cited/coverage.bin", "changed"], ["tests/recordings/cited/recording.json", "changed"]]);
});

test("show gives the input sites of a recording with their reads and value changes, and the counts of its coverage map", () => {
  const folder = "tests/recordings/shown";
  mkdirSync(join(project, folder), { recursive: true });
  const sites = [
    { site: "$c123", addr: "$dc00", reads: 100, rom: false },
    { site: "$0437", addr: "$d41b", reads: 3, rom: false },
    { site: "$ea87", addr: "$dc01", reads: 50, rom: true },
  ];
  const runUntil = { runUntil: { target: { kind: "address", address: "$c015" }, timeoutFrames: 5 } };
  const compare = { checkpoint: "$c015", state: [{ address: "$c100", size: 1 }] };
  writeFileSync(
    join(project, folder, "recording.json"),
    JSON.stringify({ format: 1, name: "shown", program: "game.prg", sha256: "0".repeat(64), symbols: "none", load: false, compare, inputs: ["$dc00", "$dc01", "$d41b"], events: [{ step: 2, action: runUntil, key: { pc: "$c015", count: 1 } }], sites, ticks: 100 * 19_656, hash: "0123abcd" }),
  );
  // The first line of a site gives its first value; each later line is a change.
  writeFileSync(join(project, folder, "reads.txt"), ["c123 dc00 0 ff", "c123 dc00 40 fb", "c123 dc00 60 ff", "0437 d41b 0 12", "0437 d41b 1 34", "ea87 dc01 0 ff", "end c123 dc00 100", "end 0437 d41b 3", "end ea87 dc01 50", ""].join("\n"));
  const map = new Uint8Array(0x10000);
  map[0x0801] = 0x04 | 0x01;
  map[0x0802] = 0x04;
  map[0xc000] = 0x02 | 0x01;
  map[0xe000] = 0x10;
  writeFileSync(join(project, folder, "coverage.bin"), map);
  assert.deepEqual(showRecording(folder, 2), {
    recording: folder,
    name: "shown",
    program: "game.prg",
    symbols: "none",
    load: false,
    ...compare,
    inputs: ["$dc00", "$dc01", "$d41b"],
    frames: 100,
    events: 1,
    inputSites: {
      count: 3,
      listed: [
        { site: "$0437", address: "$d41b", reads: 3, changes: 1 },
        { site: "$c123", address: "$dc00", reads: 100, changes: 2 },
      ],
      rest: "a larger --max-listed",
    },
    coverage: { executed: 2, read: 2, written: 1 },
    evidence: `test:${folder}/recording.json`,
  });
});

test("a state item of the command line is a name or an address with an optional size", () => {
  assert.deepEqual(parseStateItem("room"), { address: "room", size: 1 });
  assert.deepEqual(parseStateItem("$c100:2"), { address: "$c100", size: 2 });
  assert.throws(() => parseStateItem("room:0"), { code: "invalid-input", message: /^--state room:0: give a name or a \$ address, with :size from 1 to / });
  assert.throws(() => parseStateItem("seed:0", "--pin"), { code: "invalid-input", message: /^--pin seed:0: give a name or a \$ address/ });
});

test("an address of the reference moves with the name before it", () => {
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
  assert.deepEqual(firstDifference(expected, ["90 00 0102", "180 02 0103"], state), { checkpoint: 2, tick: { reference: 200, rebuild: 180 }, items: [{ address: "room", reference: "01", rebuild: "02" }] });
});

test("replay gives INCONCLUSIVE before the replay core starts when the program changed since the recording", async () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  mkdirSync(join(project, "tests/recordings/walk"), { recursive: true });
  writeFileSync(
    join(project, "tests/recordings/walk/recording.json"),
    JSON.stringify({ format: 1, name: "walk", program: "game.prg", sha256: "a3", symbols: "none", inputs: [], events: [], sites: [], ticks: 1, hash: "00000000" }),
  );
  const result = await replay({ folder: "tests/recordings/walk", state: [], pin: [] });
  assert.equal(result.result, "INCONCLUSIVE");
  assert.match(result.reason ?? "", /is not the program of the recording/);
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
  const read = (name: string, recording: Record<string, unknown>) => {
    mkdirSync(join(project, "tests/recordings", name), { recursive: true });
    writeFileSync(join(project, "tests/recordings", name, "recording.json"), JSON.stringify({ format: 1, name, program: "game.prg", sha256: "a3", symbols: "knowledge", load: false, inputs: [], events: [], sites: [], ticks: 1, hash: "00000000", ...recording }));
    try {
      readRecording(`tests/recordings/${name}`);
    } catch (error) {
      assert.equal((error as Refusal).code, "invalid-input");
      return (error as Error).message;
    }
    return assert.fail(`${name} is not refused`);
  };
  // The events of the Bruce Lee recording of 2.0.
  const remedy = "Record the session again with record, or write the 2.1 form in recording.json";
  assert.equal(
    read("run-until", { events: [{ step: 10, action: { runUntil: { at: "main_loop" }, timeoutFrames: 300 }, key: { site: "$13a3", addr: "$dc00", count: 68892 } }] }),
    `recording tests/recordings/run-until/recording.json: event 1 (step 10) has the 2.0 form (runUntil.at, timeoutFrames beside runUntil). Write {"runUntil": {"target": {"kind": "address", "address": "main_loop"}, "timeoutFrames": 300}}. ${remedy}`,
  );
  assert.equal(
    read("compare", { compare: { checkpoint: "main_loop", state: [{ at: "falls_left", size: 3 }], pin: [{ at: "random_ptr", size: 2 }] } }),
    `recording tests/recordings/compare/recording.json: compare: state item 1 has the field at. at is a 2.0 field. Write address in place of at. ${remedy}`,
  );
});

test("a runUntil to an address of a recording before 2.6.0-rc.16 has no count at its target and is refused before the replay core starts; record again", () => {
  const folder = (name: string, key: Record<string, unknown>) => {
    // The step 2 of the Exploding Fist recordings of rc.3 to rc.11.
    const event = { step: 2, action: { runUntil: { target: { kind: "address", address: "$1948", space: "c64" }, timeoutFrames: 3000 } }, key };
    mkdirSync(join(project, "tests/recordings", name), { recursive: true });
    writeFileSync(join(project, "tests/recordings", name, "recording.json"), JSON.stringify({ format: 1, name, program: "game.prg", sha256: "a3", symbols: "none", load: false, inputs: [], events: [event], sites: [], ticks: 1, hash: "00000000" }));
    return `tests/recordings/${name}`;
  };
  for (const [name, key] of [["old-tick", { tick: 5896801 }], ["old-read", { site: "$1957", addr: "$dc01", count: 52 }]] as const) {
    assert.throws(() => readRecording(folder(name, key)), (error: unknown) => error instanceof Refusal && error.code === "invalid-input" && /event 1 \(step 2\).*Record the session again/.test(error.message));
  }
  assert.equal(readRecording(folder("counted", { pc: "$1948", count: 1 })).events.length, 1);
});
