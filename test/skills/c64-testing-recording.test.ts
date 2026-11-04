// The c64-testing recording parts that need no replay core: record file
// checks, keys and joystick masks, the site map, the checkpoint comparison,
// and the refusal when c64run is missing.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { ENTRY_DURING_INPUT, entryStateCheck, entryStateDiffers, firstDifference, joystickMask, mover, parseStateItem, pinLines, readRecordFile, readRecording, showRecording, loaderEntryState, record, siteMap, trackInput } from "../../skills/c64-testing/scripts/lib/recording.ts";
import { rebuildNames, replay, replayAll } from "../../skills/c64-testing/scripts/lib/replay.ts";
import { Refusal } from "../../src/errors.ts";
import { C64RUN_PROTOCOL, type C64RunSession } from "../../src/native/c64run.ts";
import { namesOf } from "../../skills/c64-testing/scripts/lib/scenario.ts";
import { withRead, withWrite } from "../../src/knowledge/database.ts";
import { renameSymbol } from "../../src/knowledge/write.ts";
import { importCoverage, importImage } from "../fixtures/program.ts";
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
    absoluteProgram: { ...valid, program: join(project, "game.prg") },
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
 * and answers coverage status with `from`. A mark comes at the second marked,
 * or with `marks` false never. At the mark, the stack pointer is $f6 and pages 0-3 are `pages`.
 */
function recordingCore(name: string, from: string, marks = true, pages = new Uint8Array(0x400)): { path: string; log: string } {
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
      '    inputs|write) echo "ok" ;;',
      '    key|joy) echo "ok tick=982800" ;;',
      '    record) [ "$rest" = off ] || : > "$rest"; echo "ok" ;;',
      '    sites) echo "ok unknown=0" ;;',
      `    marked) if [ ${marks} = true ] && [ -e ${log}.marked ]; then echo "ok tick=990000 phase=00"; else : > ${log}.marked; echo "ok none"; fi ;;`,
      `    marked-ram) echo "ok s=f6 ram=${Buffer.from(pages).toString("hex")}" ;;`,
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

test("the rebuild of a replay has the symbol file of its build, else the names of the recording, and --symbols before both", () => {
  mkdirSync(join(project, "build/symbols"), { recursive: true });
  writeFileSync(join(project, "build/symbols/clean_loader.json"), "{}");
  assert.equal(rebuildNames("build/clean_loader.prg", undefined, "knowledge"), "build/symbols/clean_loader.json");
  assert.equal(rebuildNames("build/clean.prg", undefined, "knowledge"), "knowledge");
  assert.equal(rebuildNames("build/clean_loader.prg", "names.json", "knowledge"), "names.json");
});

test("replayAll replays the recordings in turn with the same options and an --out folder for each, a refused recording is INCONCLUSIVE, and a missing tool stops all", async () => {
  const calls: string[] = [];
  const one = async (values: { folder: string; checkpoint?: string; state: string[]; rebuild?: string; out?: string }) => {
    calls.push(`${values.folder} ${values.checkpoint} ${values.state.join(",")} ${values.rebuild} ${values.out}`);
    if (values.folder === "c") throw new Refusal("invalid-input", "c is no recording");
    return { result: values.folder === "b/" ? ("FAIL" as const) : ("PASS" as const), recording: values.folder, side: "rebuild" as const, checkpoints: 3, compared: values.folder === "b/" ? 1 : 3 };
  };
  const all = await replayAll(["tests/recordings/a", "b/", "c"], { checkpoint: "main_loop", state: ["room"], pin: [], rebuild: "build/clean.prg", out: "results" }, one);
  assert.deepEqual(calls, ["tests/recordings/a main_loop room build/clean.prg results/a", "b/ main_loop room build/clean.prg results/b", "c main_loop room build/clean.prg results/c"]);
  assert.deepEqual({ ...all, recordings: all.recordings.map((item) => `${item.recording} ${item.result}${item.reason === undefined ? "" : ` ${item.reason}`}`) }, { result: "FAIL", passed: 1, failed: 1, inconclusive: 1, recordings: ["tests/recordings/a PASS", "b/ FAIL", "c INCONCLUSIVE c is no recording"] });
  assert.equal((await replayAll(["a", "c"], { state: [], pin: [] }, one)).result, "INCONCLUSIVE");
  // The folder of an absolute path gets the name of the recording folder alone.
  calls.length = 0;
  await replayAll([join(project, "tests", "recordings", "d")], { state: [], pin: [], out: "results" }, one);
  assert.ok(calls[0]!.endsWith(" results/d"), calls[0]);
  await assert.rejects(
    replayAll(["a"], { state: [], pin: [] }, async () => {
      throw new Refusal("installation-incomplete", "c64run is missing");
    }),
    /c64run is missing/,
  );
});

test("a record file names itself and the step of a key that the replay core does not have", () => {
  const message = (name: string, value: unknown) => {
    try {
      readRecordFile(file(name, value));
    } catch (error) {
      return (error as Error).message;
    }
    return assert.fail(`${name} is not refused`);
  };
  assert.equal(message("umlaut.json", { ...valid, steps: [{ frames: 10 }, { press: { keys: "ä" } }] }), 'record file umlaut.json: step 2: press.keys: the C64 keyboard has no key "ä"');
});

test("record gives the hint of replay when an event ran before the program came to the entry of the knowledge, where the loader of a rebuild jumps, or when the program did not come to it", { skip: process.platform === "win32" ? "the stand-in replay core is a shell script" : false }, () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  writeFileSync(join(project, "build-names.json"), JSON.stringify({ start: "$0400" }));
  importImage(project, new Uint8Array(0x10000), { segments: [{ start: 0x0400, end: 0x04ff }], entry: 0x0400 });
  const record = (name: string, symbols: string, marks: boolean) => {
    const core = recordingCore(`c64run-${name}`, "ok from tick=982800 pc=1aed", marks);
    const run = spawnSync(process.execPath, [...process.execArgv, resolve(home, "skills/c64-testing/scripts/testing.ts"), "record", file(`${name}.json`, { name, program: "game.prg", symbols, steps: [{ write: { address: "$c000", data: "01" } }, { frames: 10 }] }), "--out", `tests/recordings/${name}`], {
      cwd: project,
      encoding: "utf8",
      env: { ...process.env, C64RT_C64RUN: core.path },
    });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const { envelope, json } = readEnvelope(run.stdout, run.status);
    assert.equal((json as { result: string }).result, "PASS", "the recording replays on the reference");
    return { hint: envelope.hint ?? "", marked: readFileSync(core.log, "utf8").split("\n").includes("mark 0400") };
  };
  // The crack screen of SAEGER waits for a key through the KERNAL: an event before the entry $0400.
  const early = record("early", "none", true);
  assert.ok(early.marked && early.hint.startsWith("step 1 ran before the program came to its entry $0400. A rebuild with a loader has no point for it."), early.hint);
  const never = record("never", "knowledge", false);
  assert.ok(never.marked && never.hint.startsWith("the program did not come to its entry $0400 in the session, where the loader of a rebuild jumps."), never.hint);
  // The names of a build: replay finds the entry of the loader in the reference by them, not by the names of the knowledge.
  const build = record("build", "build-names.json", true);
  assert.ok(!build.marked && !build.hint.includes("entry $0400"), build.hint);
});

test("record lists where the program at the entry of the knowledge differs from the entry state that the loader of a rebuild writes", { skip: process.platform === "win32" ? "the stand-in replay core is a shell script" : false }, () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  // The knowledge: a segment at $0300-$04ff, and an entry state with zero pages and the stack pointer $f6.
  const memory = new Uint8Array(0x10000).fill(0xee, 0x0300, 0x0500);
  const page = "00".repeat(0x100);
  const state = { registers: { pc: "$0400", a: 0, x: 0, y: 0, sp: 0xf6, flags: {} }, cpuPort: { $00: 0x2f, $01: 0x37 }, pages: { $0000: page, $0100: page, $0200: page, $0300: page } };
  importImage(project, memory, { segments: [{ start: 0x0300, end: 0x04ff }], entry: 0x0400, state });
  // The program at its entry: the keyboard table pointer and the repeat delay of a key press, the jiffy clock, the free stack, and the bytes of the segment.
  const pages = new Uint8Array(0x400).fill(0xee, 0x0300);
  pages.set([0x81, 0xeb], 0xf5);
  pages[0x028c] = 0x0e;
  pages.set([0x01, 0x02, 0x03], 0xa0);
  pages[0x01f6] = 0x55;
  // The mark of the stand-in comes after the first event.
  const core = recordingCore("c64run-entry-state", "ok from tick=982800 pc=1aed", true, pages);
  const run = spawnSync(process.execPath, [...process.execArgv, resolve(home, "skills/c64-testing/scripts/testing.ts"), "record", file("entry-state.json", { name: "entry state", program: "game.prg", symbols: "none", steps: [{ write: { address: "$c000", data: "01" } }, { frames: 10 }] }), "--out", "tests/recordings/entry-state"], {
    cwd: project,
    encoding: "utf8",
    env: { ...process.env, C64RT_C64RUN: core.path },
  });
  const { json } = readEnvelope(run.stdout, run.status);
  assert.deepEqual([json.result, json.entryStateDiffers], ["PASS", [{ start: "$00f5", end: "$00f6" }, { start: "$028c", end: "$028c" }]], JSON.stringify(json));
});

test("the entry state check leaves out $0000-$0001, the bytes that time or the start path sets and the free stack below the higher stack pointer", () => {
  const ram = new Uint8Array(0x400);
  // The jiffy clock and the cursor blink change by time, $ac/$ad by the start path; the keyboard scan ($91, $cb, $f5/$f6, $028c) changes with the input.
  for (const address of [0x0000, 0x0001, 0x0091, 0x00a1, 0x00ac, 0x00ad, 0x00cb, 0x00cd, 0x00ce, 0x00cf, 0x00f5, 0x00f6, 0x0150, 0x01f6, 0x01f7, 0x0287, 0x028c, 0x03ff]) ram[address] = 1;
  const loader = { sp: 0xf0, written: [{ start: 0x0002, end: 0x03ff }], byteAt: () => 0 };
  assert.deepEqual(entryStateDiffers({ sp: 0xf6, ram }, loader), [
    { start: 0x0091, end: 0x0091 },
    { start: 0x00cb, end: 0x00cb },
    { start: 0x00f5, end: 0x00f6 },
    { start: 0x01f7, end: 0x01f7 },
    { start: 0x028c, end: 0x028c },
    { start: 0x03ff, end: 0x03ff },
  ]);
});

test("the entry state is compared when the program came to its entry after a press step, and only noted as not compared when it came during one", () => {
  const ram = new Uint8Array(0x400);
  ram.set([0x81, 0xeb], 0xf5);
  const loader = { sp: 0xf6, written: [{ start: 0x0002, end: 0x03ff }], byteAt: () => 0 };
  const presses = [{ from: 1000, to: 2000 }];
  assert.deepEqual(entryStateCheck({ sp: 0xf6, ram, tick: 2000 }, presses, loader), { entryStateDiffers: [{ start: "$00f5", end: "$00f6" }] });
  assert.deepEqual(entryStateCheck({ sp: 0xf6, ram, tick: 1500 }, presses, loader), { entryState: ENTRY_DURING_INPUT });
  assert.deepEqual(entryStateCheck({ sp: 0xf6, ram: new Uint8Array(0x400), tick: 2000 }, presses, loader), {});
  // A typed span counts only while the KERNAL queue ($c6) at the entry holds keys.
  const typed = [{ from: 1000, to: 50_000, typed: true as const }];
  assert.deepEqual(entryStateCheck({ sp: 0xf6, ram, tick: 1500 }, typed, loader), { entryStateDiffers: [{ start: "$00f5", end: "$00f6" }] });
  const queued = Uint8Array.from(ram);
  queued[0xc6] = 1;
  assert.deepEqual(entryStateCheck({ sp: 0xf6, ram: queued, tick: 1500 }, typed, loader), { entryState: ENTRY_DURING_INPUT });
});

test("the input of a record spans from an input while none is held to the end of the last one: keys, a joystick and typed keys", async () => {
  // A stand-in core: it keeps the input listener; each status is 100 cycles later, and the KERNAL queue is empty at the second peek.
  let listener: Parameters<C64RunSession["onInput"]>[0];
  let tick = 0;
  let peeks = 0;
  const core = {
    onInput: (given: typeof listener) => (listener = given),
    status: async () => ({ tick: (tick += 100) }),
    peek: async () => Uint8Array.of(++peeks < 2 ? 1 : 0),
  } as unknown as Parameters<typeof trackInput>[0];
  const key = (code: number, down: boolean) => listener!({ kind: "key", code, down }, (tick += 100));
  const joy = (port2: number) => listener!({ kind: "joy", masks: [0, port2] }, (tick += 100));
  const tracked = trackInput(core);
  // A key of the play, RESTORE (ff) while it is down: one span.
  key(0x81, true);
  key(0xff, true);
  key(0x81, false);
  key(0xff, false);
  // A joystick that leaves the center and comes back: one span.
  joy(0x10);
  joy(0);
  // A type step at 650: its keys are input until the queue is empty.
  tracked.typed(650);
  await tracked.settle();
  await tracked.settle();
  // A key held at the end.
  key(0x82, true);
  assert.deepEqual(tracked.spans(9000), [
    { from: 100, to: 400 },
    { from: 500, to: 600 },
    { from: 650, to: 700, typed: true },
    { from: 800, to: 9000 },
  ]);
  assert.equal(listener, undefined, "the tracking ends with spans");
  // A press step of two taps from 0 to 5000: its spans become the one span of the step.
  const step = trackInput(core);
  key(0x81, true);
  key(0x81, false);
  key(0x82, true);
  key(0x82, false);
  step.cover(0, 5000);
  assert.deepEqual(step.spans(9000), [{ from: 0, to: 5000 }]);
  // A press step while the joystick is held: the open span of the joystick starts at the step.
  const held = trackInput(core);
  joy(0x10);
  key(0x81, true);
  key(0x81, false);
  held.cover(50, (tick += 100));
  joy(0);
  assert.deepEqual(held.spans(99_000), [{ from: 50, to: tick }]);
});

test("the entry state check compares only what the loader writes: the segments in pages 0-3 and the pages that the entry state has", () => {
  const own = join(project, "loader-state");
  mkdirSync(join(own, ".c64-re-tools"), { recursive: true });
  const memory = new Uint8Array(0x10000).fill(0xee, 0x0300, 0x0310);
  const registers = { pc: "$0400", a: 0, x: 0, y: 0, sp: 0xf6, flags: {} };
  const written = (pages: Record<string, string>, segments = [{ start: 0x0400, end: 0x04ff }]) => {
    importImage(own, memory, { segments, entry: 0x0400, state: { registers, cpuPort: { $00: 0x2f, $01: 0x37 }, pages } });
    return withRead((db) => loaderEntryState(db, 0x0400), own)?.written;
  };
  // No pages and no segment there: nothing to compare, so no field.
  assert.equal(written({}), undefined);
  // One page: only that page.
  assert.deepEqual(written({ $0200: "00".repeat(0x100) }), [{ start: 0x0200, end: 0x02ff }]);
  // A segment in pages 0-3 too, and the program bytes at the entry that are outside them are left out.
  assert.deepEqual(written({ $0200: "00".repeat(0x100) }, [{ start: 0x0300, end: 0x030f }, { start: 0x0400, end: 0x04ff }]), [{ start: 0x0200, end: 0x030f }]);
});

test("a record that fails ends the input listener of the session", async () => {
  let listener: unknown = "none yet";
  const core = { onInput: (given: unknown) => (listener = given) } as unknown as C64RunSession;
  const recordFile = readRecordFile(file("missing-program.json", { ...valid, program: "missing.prg" }));
  await assert.rejects(record(core, recordFile, {} as Parameters<typeof record>[2]), /missing\.prg/);
  assert.equal(listener, undefined);
});
