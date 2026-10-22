// The c64-testing scenario parts that need no emulator: scenario checks,
// symbol resolution per side, comparison rules and the playtest checklist.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { openForWrite } from "../../src/knowledge/database.ts";
import { renameSymbol } from "../../src/knowledge/write.ts";
import type { ViceSessionClient } from "../../src/host-client/vice-session.ts";
import { changedRanges, diffStates } from "../../skills/c64-testing/scripts/lib/diff.ts";
import { isRefusal, Refusal } from "../../src/errors.ts";
import { compare, namesOf, readScenario, resolve, runScenario, scenarioNames } from "../../skills/c64-testing/scripts/lib/scenario.ts";
import { diffFiles, snapshotCpuPort, snapshotRam } from "../../skills/c64-testing/scripts/lib/diff-files.ts";
import { runFile } from "../../skills/c64-testing/scripts/lib/runs.ts";
import { readEnvelope } from "../kit.ts";

// No host listens at port 1: a run that got past its checks would fail to connect, not reach a real emulator.
process.env.C64RT_HOST = "127.0.0.1:1";
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-testing-"));
const home = process.cwd();
// Scenario paths are relative to the working directory: each test runs in the project.
beforeEach(() => process.chdir(project));
afterEach(() => process.chdir(home));
after(() => rmSync(project, { recursive: true, force: true }));

const valid = {
  name: "moves left",
  original: { program: "original.prg", symbols: "knowledge" },
  rebuild: { program: "build/clean.prg", symbols: "build/symbols/clean.json" },
  steps: [{ reset: "hard" }, { frames: 50 }, { observe: "moved", memory: ["player_x"], registers: ["a"] }],
};

function scenarioFile(name: string, value: unknown): string {
  writeFileSync(join(project, name), JSON.stringify(value));
  return name;
}

/** The code and the message of a call that must be refused before an emulator starts. */
async function refusal(call: () => unknown): Promise<{ code: string; message: string }> {
  try {
    await call();
  } catch (error) {
    if (isRefusal(error)) return { code: error.code, message: error.message };
    throw error;
  }
  return assert.fail("not refused");
}

/** The refusal of a run file with this value, as the run command gives it. */
const runRefusal = (name: string, value: unknown) => refusal(() => runFile(scenarioFile(name, value), "out"));

test("a scenario needs a name, both subjects, known steps and at least one checkpoint", () => {
  assert.equal(readScenario(scenarioFile("ok.json", valid)).steps.length, 3);
  for (const [name, bad] of Object.entries({
    noName: { ...valid, name: "" },
    noRebuild: { ...valid, rebuild: undefined },
    unknownStep: { ...valid, steps: [{ sleep: 100 }, valid.steps[2]] },
    twoKinds: { ...valid, steps: [{ reset: "hard", frames: 5 }, valid.steps[2]] },
    noObserve: { ...valid, steps: [{ reset: "hard" }] },
    sameCheckpoint: { ...valid, steps: [valid.steps[2], valid.steps[2]] },
    noTimeout: { ...valid, steps: [{ runUntil: { address: "done" } }, valid.steps[2]] },
  })) {
    assert.throws(() => readScenario(scenarioFile(`${name}.json`, bad)), Refusal, name);
  }
  assert.throws(() => readScenario("missing.json"), Refusal);
});

test("each side resolves names from its own symbols", () => {
  const db = openForWrite(project);
  renameSymbol(db, { origin: "llm" }, { address: 0xc100, name: "player_x", kind: "variable" });
  db.close();
  writeFileSync(
    join(project, "assembled.json"),
    JSON.stringify({ assembled: true, symbols: [{ name: "draw", kind: "address", address: "$0900" }, { name: "player_x", kind: "constant", value: "$c200" }, { name: "BIG", kind: "constant", value: "$11170" }] }),
  );
  writeFileSync(join(project, "map.json"), JSON.stringify({ player_x: "$c300" }));
  const original = namesOf("knowledge");
  const fromAssembler = namesOf("assembled.json");
  const fromMap = namesOf("map.json");
  assert.equal(resolve("player_x", original, "original"), 0xc100);
  assert.equal(resolve("player_x", fromAssembler, "rebuild"), 0xc200);
  assert.equal(resolve("draw", fromAssembler, "rebuild"), 0x0900);
  assert.equal(fromAssembler.has("BIG"), false, "a value outside $0000-$ffff is no address");
  assert.equal(resolve("player_x", fromMap, "rebuild"), 0xc300);
  assert.equal(resolve("$d020", fromMap, "rebuild"), 0xd020, "a $ address is the same on both sides");
  assert.throws(() => resolve("lives", fromMap, "rebuild"), /rebuild side has no symbol lives/);
  assert.equal(namesOf("none").size, 0);
});

test("only differences outside the explicit tolerance count", () => {
  const observation = (x: number, a: number, screen?: { match: boolean }) => ({
    memory: [{ label: "player_x", address: 0xc100, bytes: [x], tolerance: 1, excluded: [] }],
    registers: { a },
    ...(screen === undefined ? {} : { screen: { ...screen, mismatchingPixels: screen.match ? 0 : 12, comparedPixels: 12000, mismatchRatio: screen.match ? 0 : 0.001 } }),
  });
  assert.deepEqual(compare(new Map([["moved", observation(100, 1)]]), new Map([["moved", observation(101, 1, { match: true })]])), []);
  const differences = compare(new Map([["moved", observation(100, 1)]]), new Map([["moved", observation(102, 2, { match: false })]]));
  assert.deepEqual(
    differences.map((difference) => difference.what),
    ["memory player_x", "register a", "screen"],
  );
});

test("a memory mask compares only its bits: the colour RAM has 4 bits, and the upper bits are open bus", () => {
  const observation = (bytes: number[], mask?: number[]) => ({ memory: [{ label: "$d800 (2 bytes)", address: 0xd800, bytes, tolerance: 0, ...(mask === undefined ? {} : { mask }), excluded: [] }], registers: {} });
  assert.deepEqual(compare(new Map([["c", observation([0x01, 0x0e], [0x0f])]]), new Map([["c", observation([0x31, 0xfe], [0x0f])]])), [], "only the upper bits differ");
  assert.equal(compare(new Map([["c", observation([0x01, 0x0e], [0x0f])]]), new Map([["c", observation([0x02, 0x0e], [0x0f])]])).length, 1, "a low bit differs");
  assert.equal(compare(new Map([["c", observation([0x01, 0x0e], [0xff, 0x0f])]]), new Map([["c", observation([0x31, 0xfe], [0xff, 0x0f])]])).length, 1, "a mask per byte keeps all bits of the first byte");
});

test("an excluded byte does not count, and steps for one side and the new step kinds check", () => {
  const observation = (bytes: number[]) => ({ memory: [{ label: "$d01e (2 bytes)", address: 0xd01e, bytes, tolerance: 0, excluded: [{ offset: 0, address: "$d01e", reason: "latched collision, not writable" }] }], registers: {} });
  assert.deepEqual(compare(new Map([["c", observation([1, 5])]]), new Map([["c", observation([0, 5])]])), [], "the excluded first byte differs");
  assert.equal(compare(new Map([["c", observation([1, 5])]]), new Map([["c", observation([1, 6])]])).length, 1, "the second byte still counts");
  const scenario = (steps: unknown[]) => scenarioFile("d46.json", { ...valid, steps: [...steps, { observe: "x", memory: ["$c000"] }] });
  assert.equal(
    readScenario(scenario([{ type: { mode: "text", text: " " }, side: "original" }, { snapshot: "s.vsf", side: "rebuild" }, { normalize: true }, { runUntil: { target: { kind: "raster", line: 250 }, timeoutFrames: 2 } }, { runUntil: { target: { kind: "address", address: "$c000", condition: { kind: "raster", line: 100 } }, timeoutFrames: 2 } }])).steps.length,
    6,
  );
  for (const bad of [
    [{ type: { mode: "text", text: " " }, side: "both" }],
    [{ observe: "y", memory: ["$c000"], side: "original" }],
    [{ runUntil: { target: { kind: "raster", line: 400 }, timeoutFrames: 2 } }],
    [{ normalize: "entry_state.json" }],
    [{ observe: "y", memory: [{ address: "$d01e", exclude: [{ address: "$d01e" }] }] }],
  ]) {
    assert.throws(() => readScenario(scenario(bad)), Refusal, JSON.stringify(bad));
  }
});

test("the checklist lists each checkpoint and what only a person can judge", () => {
  const checklist = resolvePath(home, "skills/c64-testing/scripts/testing.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, checklist, "checklist", "ok.json", "--item", "FIRE starts the game."], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const { text } = readEnvelope(run.stdout, run.status).json as { text: string };
  assert.match(text, /^# Playtest checklist/);
  assert.match(text, /- \[ \] At "moved", the rebuild looks and behaves as the original\./);
  assert.match(text, /- \[ \] FIRE starts the game\./);
  assert.match(text, /music and the sound effects/);
});

test("each step is checked before the scenario runs", () => {
  const observe = valid.steps[2]!;
  const accepted = {
    ...valid,
    videoStandard: "ntsc",
    steps: [
      { reset: "soft" },
      { load: true },
      { write: { address: "$c000", data: "00ff" } },
      { registers: { pc: "start", a: 0, sp: 255 } },
      { joystick: { port: 2, direction: "up-left", fire: true } },
      { type: { mode: "text", text: "RUN\n" } },
      { frames: 10 },
      { runUntil: { target: { kind: "memory", address: "game_state", operator: "eq", value: 2 }, timeoutFrames: 600 } },
      { observe: "all", memory: ["player_x", { address: "$0400", size: 40, tolerance: 1 }, { address: "$d800", size: 2, mask: "0f" }, { address: "$d800", size: 2, mask: "0fff" }], registers: ["pc", "flags"], screen: { maxMismatchRatio: 0.01, mask: [{ x: 0, y: 0, width: 320, height: 8 }] }, vicii: true, sprites: [0, 7] },
    ],
  };
  assert.equal(readScenario(scenarioFile("accepted.json", accepted)).steps.length, 9);
  for (const [name, step] of Object.entries({
    notAnObject: "reset",
    nullStep: null,
    resetMode: { reset: "warm" },
    loadFalse: { load: false },
    writeNoAt: { write: { bytes: [1] } },
    writeBadAddress: { write: { address: "$c0000", data: "01" } },
    writeByte: { write: { address: "$c000", data: "100" } },
    writeNoBytes: { write: { address: "$c000", data: "" } },
    registerName: { registers: { q: 1 } },
    registerFlags: { registers: { flags: 1 } },
    registerRange: { registers: { a: 256 } },
    joystickPort: { joystick: { port: 3, direction: "left" } },
    joystickDirection: { joystick: { port: 2, direction: "sideways" } },
    joystickFire: { joystick: { port: 2, direction: "left", fire: "yes" } },
    typeEmpty: { type: { mode: "text", text: "" } },
    typeNoKey: { type: { mode: "text", text: "é" } },
    framesZero: { frames: 0 },
    runUntilText: { runUntil: "main", timeoutFrames: 10 },
    runUntilBoth: { runUntil: { address: "main", memory: { address: "x", equals: 1 } }, timeoutFrames: 10 },
    runUntilValue: { runUntil: { target: { kind: "memory", address: "x", operator: "eq", value: 256 }, timeoutFrames: 10 } },
    runUntilTimeout: { runUntil: { target: { kind: "address", address: "main" }, timeoutFrames: 0 } },
    unknownKey: { frames: 5, count: 5 },
    observeRegister: { observe: "x", registers: ["q"] },
    observeMemorySize: { observe: "x", memory: [{ address: "$0400", size: 0 }] },
    observeTolerance: { observe: "x", memory: [{ address: "$0400", tolerance: -1 }] },
    observeMemoryMask: { observe: "x", memory: [{ address: "$d800", size: 4, mask: "0f0f" }] },
    observeMemoryMaskHex: { observe: "x", memory: [{ address: "$d800", mask: "0x0f" }] },
    observeMask: { observe: "x", screen: { mask: [{ x: 0, y: 0, width: 0, height: 8 }] } },
    observeFullMask: { observe: "x", screen: { mask: [{ x: 0, y: 0, width: 384, height: 272 }] } },
    observeHalvesMask: { observe: "x", screen: { mask: [{ x: 0, y: 0, width: 384, height: 136 }, { x: 0, y: 136, width: 400, height: 200 }] } },
    observeRatio: { observe: "x", screen: { maxMismatchRatio: 2 } },
    observeSprite: { observe: "x", sprites: [8] },
    observeVicii: { observe: "x", vicii: "yes" },
    observeTypo: { observe: "x", sprite: [0] },
  })) {
    assert.throws(() => readScenario(scenarioFile(`${name}.json`, { ...valid, steps: [step, observe] })), Refusal, name);
  }
  assert.throws(() => readScenario(scenarioFile("standard.json", { ...valid, videoStandard: "secam" })), Refusal);
  // The NTSC frame is 247 lines high: a mask of 384x247 covers it, and on PAL it leaves 25 lines.
  const ntscMask = { observe: "x", screen: { mask: [{ x: 0, y: 0, width: 384, height: 247 }] } };
  assert.throws(() => readScenario(scenarioFile("ntsc-mask.json", { ...valid, videoStandard: "ntsc", steps: [ntscMask] })), /covers the whole screen/);
  assert.doesNotThrow(() => readScenario(scenarioFile("pal-mask.json", { ...valid, steps: [ntscMask] })));
});

test("each side starts from a hard reset, each checkpoint has its own baseline, and the raster line is not compared", async () => {
  const calls: Array<[string, unknown]> = [];
  const baselines = new Set<string>();
  let raster = 0;
  const fake = {
    reset: async (params: unknown) => (calls.push(["reset", params]), { state: "stopped" }),
    joystick: async (state: unknown) => (calls.push(["joystick", state]), state),
    status: async () => ({ state: "stopped" }),
    execution: async (params: unknown) => (calls.push(["execution", params]), {}),
    registersGet: async () => ({ pc: 0x0810, a: 1, x: 2, y: 3, sp: 0xf6, flags: { n: false, v: false, b: true, d: false, i: true, z: false, c: true } }),
    vicii: async () => ({ rasterLine: raster++, mode: "text", screenAddress: 0x0400, graphicsAddress: 0x1000, scrollX: 0, scrollY: 3, borderColor: 14, backgroundColors: [6, 0, 0, 0] }),
    screenCapture: async (name: string) => {
      calls.push(["screenCapture", name]);
      baselines.add(name);
      return {};
    },
    screenCompare: async (params: { baseline: string }) => {
      assert.ok(baselines.has(params.baseline), `no baseline ${params.baseline}`);
      return { match: true, mismatchingPixels: 0, comparedPixels: 104448, mismatchRatio: 0 };
    },
    screenDiscard: async (name: string) => (baselines.delete(name), {}),
  };
  const scenario = readScenario(
    scenarioFile("checkpoints.json", {
      name: "two checkpoints",
      original: { program: "original.prg", symbols: "none" },
      rebuild: { program: "rebuild.prg", symbols: "none" },
      steps: [{ frames: 10 }, { observe: "after move", screen: {}, vicii: true, registers: ["pc", "flags"] }, { observe: "after_move", screen: {} }],
    }),
  );
  const result = await runScenario(fake as unknown as ViceSessionClient, scenario);
  assert.deepEqual(result, { result: "PASS", scenario: "two checkpoints", checkpoints: ["after move", "after_move"], differences: [] });
  const resets = calls.flatMap(([name, params], index) => (name === "reset" ? [[index, params]] : []));
  assert.deepEqual(resets.map(([, params]) => params), [{ mode: "hard", run: false }, { mode: "hard", run: false }]);
  assert.equal(resets[0]![0], 0, "the original side starts with the reset");
  const captured = calls.filter(([name]) => name === "screenCapture").map(([, name]) => name);
  assert.equal(new Set(captured).size, 2, "two checkpoints, two baselines");
});

test("a run file and a scenario name a missing field with its form, and refuse a key that they do not have", async () => {
  const run = async (value: unknown) => (await runRefusal("fields.json", value)).message;
  const good = { name: "r", start: { program: "game.prg" }, steps: [{ frames: 1 }] };
  const fields = "A run file has name, start and steps, and optionally symbols and videoStandard";
  const forms = '{ "program": "<file.prg>" }, { "program": "<file.prg>", "load": true } or { "snapshot": "<file.vsf>" }';
  assert.equal(await run({ start: good.start, steps: good.steps }), 'run fields.json: name must be a non-empty string, for example "rooms"');
  assert.equal(await run({ ...good, start: {} }), `run fields.json: start must be ${forms}`);
  assert.equal(await run({ ...good, start: { snapshot: "s.vsf", load: true } }), `run fields.json: start has the key load. start must be ${forms}`);
  assert.equal(await run({ ...good, steps: [] }), "run fields.json: steps must be a list with at least one step");
  assert.equal(await run({ ...good, program: "game.prg" }), `run fields.json: has the key program. ${fields}`);
  assert.equal(await run([]), `run fields.json: is not a JSON object. ${fields}`);
  assert.match(await run({ ...good, start: { program: "game.prg", snapshot: "s.vsf" } }), /^run fields\.json: start/);
  assert.match(await run({ ...good, steps: [{ screen: "../escape" }] }), /^run fields\.json: step 1/);
  const message = (value: unknown) => {
    try {
      readScenario(scenarioFile("fields.json", value));
    } catch (error) {
      return (error as Error).message;
    }
    return assert.fail("not refused");
  };
  assert.equal(message({ ...valid, symbols: "knowledge" }), "scenario fields.json: has the key symbols. A scenario file has name, original, rebuild and steps, and optionally videoStandard");
  assert.equal(message({ ...valid, rebuild: { program: "build/game.prg" } }), 'scenario fields.json: rebuild must be { "program": "<file.prg>", "symbols": "knowledge" }. symbols can also be "none" or a JSON file');
  assert.equal(message({ ...valid, original: { ...valid.original, load: true } }), 'scenario fields.json: original has the key load. original must be { "program": "<file.prg>", "symbols": "knowledge" }. symbols can also be "none" or a JSON file');
  assert.equal(message({ ...valid, steps: [] }), "scenario fields.json: steps must be a list with at least one step");
});

test("diff gives the changed ranges of two memory files and the changed items of two observations of one run", async () => {
  // The Bruce Lee run: the agent wrote the same diff script about six times.
  const ranges = changedRanges(Uint8Array.from([1, 2, 3, 4, 5, 6]), Uint8Array.from([1, 9, 3, 4, 8, 8]), 0xc000);
  assert.deepEqual(ranges, { changedBytes: 3, ranges: [{ start: 0xc001, end: 0xc001, a: "02", b: "09" }, { start: 0xc004, end: 0xc005, a: "0506", b: "0808" }] });
  assert.deepEqual(changedRanges(Uint8Array.from([1, 2, 3, 4]), Uint8Array.from([0, 2, 3, 0]), 0, 2).ranges.map((range) => [range.start, range.end]), [[0, 3]], "--gap joins ranges across equal bytes");
  assert.deepEqual(diffStates({ values: { "cpu.a": 1, "vic.$d011": 0x1b } }, { values: { "cpu.a": 1, "vic.$d011": 0x9b } }).values, [{ name: "vic.$d011", a: 0x1b, b: 0x9b }]);

  const before = new Uint8Array(0x10000);
  const after = Uint8Array.from(before);
  after.set([7, 7], 0x2fa1);
  writeFileSync(join(project, "before.bin"), before);
  writeFileSync(join(project, "after.bin"), after);
  writeFileSync(
    join(project, "results.json"),
    JSON.stringify({ observations: { start: { memory: { room: "00", $0400: "2020" }, registers: { a: 1, pc: "$0400" } }, later: { memory: { room: "05", $0400: "2020" }, registers: { a: 1, pc: "$0410" } }, other: { memory: { $c000: "01" } } } }),
  );
  const differ = (a: string, b: string) => diffFiles(a, b, { gap: 0, max: 50, ntsc: false });
  assert.deepEqual((await differ("before.bin", "after.bin")).memory, { changedBytes: 2, count: 1, listed: [{ start: "$2fa1", end: "$2fa2", a: "0000", b: "0707" }] });
  assert.deepEqual(await differ("results.json:start", "results.json:later"), {
    a: "results.json:start",
    b: "results.json:later",
    registers: { compared: 2, count: 1, listed: [{ name: "cpu.pc", a: "$0400", b: "$0410" }] },
    observed: { compared: 2, count: 1, listed: [{ address: "room", a: "00", b: "05" }] },
  });
  // Nothing in common: the result says that nothing was compared, so a count of 0 does not read as equal.
  const apart = await differ("results.json:start", "results.json:other");
  assert.deepEqual(apart.observed, {
    compared: 0,
    reason: "No memory item was compared: the observations have none in common. results.json:start has room, $0400; results.json:other has $c000.",
    count: 0,
    listed: [],
  });
  assert.deepEqual(apart.registers, {
    compared: 0,
    reason: "No register was compared: the observations have none in common. results.json:start has cpu.a, cpu.pc; results.json:other has none.",
    count: 0,
    listed: [],
  });
  assert.equal((await refusal(() => differ("before.bin", "results.json:later"))).code, "invalid-input", "two states of one kind");
  await refusal(() => differ("results.json:start", "results.json:nothing"));
});

test("diff compares the CPU flags, shows the pc as $xxxx, and --out names the changed registers as the result does", () => {
  const flags = (c: boolean) => ({ n: false, v: false, b: true, d: false, i: true, z: false, c });
  writeFileSync(join(project, "flags.json"), JSON.stringify({ observations: { before: { registers: { pc: "$c000", a: 1, flags: flags(false) } }, after: { registers: { pc: "$c010", a: 1, flags: flags(true) } } } }));
  const script = resolvePath(import.meta.dirname, "../../skills/c64-testing/scripts/testing.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "diff", "flags.json:before", "flags.json:after", "--out", "flags-diff.json"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = readEnvelope(run.stdout, run.status).json as { registers: unknown; out: string };
  const changed = [
    { name: "cpu.pc", a: "$c000", b: "$c010" },
    { name: "cpu.flags.c", a: false, b: true },
  ];
  assert.deepEqual(result.registers, { compared: 9, count: 2, listed: changed });
  const file = JSON.parse(readFileSync(join(project, "flags-diff.json"), "utf8")) as Record<string, unknown>;
  assert.deepEqual(file.registers, changed, "the file names the list registers, as the result does");
  assert.equal(file.values, undefined);
});

test("a snapshot file gives its RAM from the C64MEM module, and a file without it gives none", () => {
  const header = Buffer.concat([Buffer.from("VICE Snapshot File\x1a", "latin1"), Buffer.from([2, 0]), Buffer.from("C64SC".padEnd(16, "\0"), "latin1"), Buffer.from("VICE Version\x1a", "latin1"), Buffer.alloc(8)]);
  const module = (name: string, data: Buffer) => {
    const head = Buffer.alloc(22);
    head.write(name, 0, "latin1");
    head.writeUInt32LE(22 + data.length, 18);
    return Buffer.concat([head, data]);
  };
  const ram = Buffer.alloc(0x10000, 0x55);
  ram.write("sei", 0x0400, "latin1");
  const file = Buffer.concat([header, module("MAINCPU", Buffer.alloc(103)), module("C64MEM", Buffer.concat([Buffer.from([0x35, 0x2f, 0, 0]), ram, Buffer.alloc(15)]))]);
  assert.deepEqual(Buffer.from(snapshotRam(file)!), ram);
  assert.deepEqual(snapshotCpuPort(file), { direction: 0x2f, data: 0x35 }, "the CPU port: the data register, then the direction register, before the RAM");
  assert.equal(snapshotRam(Buffer.concat([header, module("MAINCPU", Buffer.alloc(103))])), undefined);
  assert.equal(snapshotRam(Buffer.from("not a snapshot")), undefined);
});

test("a run refuses two steps that write one file, across step kinds, and names both steps", async () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  const refused = async (steps: unknown[]) => {
    const error = await runRefusal("collide.json", { name: "collide", start: { program: "game.prg" }, steps });
    assert.equal(error.code, "invalid-input");
    return error.message.split("\n")[0];
  };
  assert.equal(await refused([{ frames: 5 }, { coverage: "x" }, { observe: "x", memory: "all" }]), "run collide.json: step 3 (observe) writes x.bin, and step 2 (coverage) writes that file too. Give one of them another name");
  assert.equal(await refused([{ save: "x" }, { frames: 5 }, { save: "x" }]), "run collide.json: step 3 (save) writes x.vsf, and step 1 (save) writes that file too. Give one of them another name");
  assert.equal(await refused([{ coverage: "big-c000" }, { observe: "big", memory: [{ address: "$c000", size: 5000 }] }]), "run collide.json: step 2 (observe) writes big-c000.bin, and step 1 (coverage) writes that file too. Give one of them another name");
  assert.equal(await refused([{ trace: "results", points: [{ kind: "exec", start: "$c000" }], frames: 5 }]), "run collide.json: step 1 (trace) writes results.json, and the run itself (results.json) writes that file too. Give one of them another name");
  assert.equal(await refused([{ screen: "Room" }, { screen: "room" }]), "run collide.json: step 2 (screen) writes room.png, and step 1 (screen) writes that file too. Give one of them another name");
});

test("a run refuses a wrong expect step before it opens an emulator, and names the step", async () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  const refused = async (steps: unknown[]) => {
    const error = await runRefusal("expect.json", { name: "expect", start: { program: "game.prg" }, steps });
    assert.equal(error.code, "invalid-input");
    return error.message.split("\n")[0]!;
  };
  assert.equal(await refused([{ expect: "e" }]), "run expect.json: step 1: expect needs memory, registers or both");
  assert.equal(await refused([{ expect: "e", memory: [{ address: "$0400", data: "08", text: "H" }] }]), "run expect.json: step 1: an expected memory object needs data or text, not both");
  assert.match(await refused([{ expect: "e", memory: [{ address: "$0400", text: "hello" }] }]), /^run expect\.json: step 1: text has the characters of the upper-case set: .*Write letters in upper case$/);
  assert.equal(await refused([{ expect: "e", memory: [{ address: "$d020", data: "01", mask: "0f0f" }] }]), "run expect.json: step 1: mask needs data, and is hex bytes of the same length as data");
  assert.equal(await refused([{ expect: "e", memory: [{ address: "$0400", data: "01", size: 1 }] }]), "run expect.json: step 1: an expected memory object has the field size. It has address, data or text, mask and view, and nothing else");
  assert.equal(await refused([{ observe: "e", memory: ["$0400"] }, { expect: "e", memory: [{ address: "$0400", data: "01" }] }]), "run expect.json: step 2 needs a new name");
  assert.match(await refused([{ expect: "e", screen: {} }]), /^run expect\.json: step 1 has the key screen/);
  assert.match(await refused([{ expect: "e", registers: { a: 300 } }]), /^run expect\.json: step 1/);
  assert.match(await refused([{ expect: "e", memory: [{ address: "score", data: "00" }] }]), /^run expect\.json: step 1: score is a name, and the run file has no symbols/);
  assert.match(await refused([{ expect: "e", registers: { pc: "main_loop" } }]), /^run expect\.json: step 1: main_loop is a name, and the run file has no symbols/);
});

test("a run and a scenario refuse the 2.0 step and memory forms with the field and the 2.1 form", async () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  const run = async (steps: unknown[]) => (await runRefusal("old-run.json", { name: "old", start: { program: "game.prg" }, steps })).message.split("\n")[0]!;
  assert.equal(await run([{ observe: "x", memory: [{ at: "$0400", size: 2 }] }]), "run old-run.json: step 1: a memory object has the field at. at is a 2.0 field. Write address in place of at");
  assert.equal(await run([{ trace: "t", points: [{ kind: "exec", at: "$c000" }], frames: 5 }]), "run old-run.json: step 1: a point has the field at. at is a 2.0 field. Write start in place of at");
  assert.equal(await run([{ wait: 5 }]), "run old-run.json: step 1 must have exactly one of write, registers, joystick, type, press, frames, runUntil, snapshot, save, screen, coverage, observe, expect, trace");
  const scenario = (steps: unknown[]) => {
    try {
      readScenario(scenarioFile("old-scenario.json", { ...valid, steps }));
    } catch (error) {
      return (error as Error).message.split("\n")[0]!;
    }
    return assert.fail("not refused");
  };
  assert.equal(scenario([{ type: " ", side: "original" }, valid.steps[2]]), 'scenario old-scenario.json: step 1 has the 2.0 form (type as text). Write {"type": {"mode": "text", "text": " "}, "side": "original"}, or {"type": {"mode": "petscii", "bytes": [...]}} for PETSCII codes');
  assert.equal(scenario([{ observe: "x", memory: [{ at: "$0002", size: 254 }] }]), "scenario old-scenario.json: step 1: a memory object has the field at. at is a 2.0 field. Write address in place of at");
  assert.equal(scenario([{ observe: "x", memory: [{ address: "$d01e", exclude: [{ at: "$d01e", reason: "latched" }] }] }]), "scenario old-scenario.json: step 1: an exclude has the field at. at is a 2.0 field. Write address in place of at");
  assert.equal(scenario([{ frames: 5, type: { mode: "text", text: " " } }, valid.steps[2]]), "scenario old-scenario.json: step 1 has 2 step kinds: frames, type. Give each one its own step");
  assert.equal(scenario([{ sleep: 5 }, valid.steps[2]]), "scenario old-scenario.json: step 1 must have exactly one of reset, load, autostart, snapshot, normalize, write, registers, joystick, type, press, frames, runUntil, observe");
});

test("test and run check every file before the emulator: a missing file is not-found, a disk image is no PRG", async () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  writeFileSync(join(project, "game.d64"), Buffer.alloc(174848));
  // test reads the scenario and checks its files before it opens the emulator.
  const test = (name: string, sides: Record<string, unknown>, steps: unknown[] = [{ autostart: true }, { observe: "x", memory: ["$0400"] }]) => {
    scenarioFile(name, { name: "files", original: { program: "game.prg", symbols: "none" }, rebuild: { program: "game.prg", symbols: "none" }, ...sides, steps });
    return refusal(() => scenarioNames(readScenario(name), name));
  };
  assert.deepEqual(await test("no-rebuild.json", { rebuild: { program: "build/nope.prg", symbols: "none" } }), { code: "not-found", message: "scenario no-rebuild.json: rebuild.program: There is no file at build/nope.prg in the project folder." });
  assert.deepEqual(await test("no-symbols.json", { rebuild: { program: "game.prg", symbols: "build/nope.json" } }), { code: "not-found", message: "scenario no-symbols.json: rebuild.symbols: There is no file at build/nope.json in the project folder." });
  assert.deepEqual(await test("disk.json", { original: { program: "game.d64", symbols: "none" } }), {
    code: "invalid-input",
    message: "scenario disk.json: original.program: game.d64 is a disk image (.d64), not a PRG. A scenario program is a PRG. Extract the program file from the disk, tape or cartridge image, and give that PRG.",
  });
  assert.equal((await test("no-snapshot.json", {}, [{ snapshot: "nope.vsf" }, { observe: "x", memory: ["$0400"] }])).code, "not-found");
  assert.equal((await runRefusal("run-missing.json", { name: "r", start: { program: "nope.prg" }, steps: [{ frames: 1 }] })).code, "not-found");
  assert.match((await runRefusal("run-disk.json", { name: "r", start: { program: "game.d64" }, steps: [{ frames: 1 }] })).message, /^run run-disk\.json: start\.program: game\.d64 is a disk image \(\.d64\), not a PRG\. A run starts a PRG/);
  assert.deepEqual(await runRefusal("run-snapshot.json", { name: "r", start: { program: "game.prg" }, steps: [{ frames: 1 }, { snapshot: "nope.vsf" }] }), { code: "not-found", message: "run run-snapshot.json: step 2: snapshot: There is no file at nope.vsf in the project folder." });
  // A run observes all registers or none: a list of names is the form of a scenario.
  assert.match(
    (await runRefusal("run-registers.json", { name: "r", start: { program: "game.prg" }, steps: [{ frames: 1 }, { observe: "x", registers: ["a"] }] })).message,
    /^run run-registers\.json: step 2: registers must be true or false in a run\. true gives all registers\. A list of register names is for a scenario$/,
  );
  writeFileSync(join(project, "map.json"), JSON.stringify({ player_x: "$c300" }));
  assert.deepEqual(await runRefusal("run-name.json", { name: "r", start: { program: "game.prg" }, symbols: "map.json", steps: [{ frames: 1 }, { runUntil: { target: { kind: "address", address: "nonsense" } } }] }), { code: "invalid-input", message: "run run-name.json: step 2: the symbols map.json have no nonsense" });
});

test("a memory difference lists the differing bytes, at most --max-listed, and memory.json in --out keeps all bytes", () => {
  const observation = (bytes: number[]) => ({ memory: [{ label: "$0400 (3320 bytes)", address: 0x0400, bytes, tolerance: 0, excluded: [] }], registers: {} });
  const original = Array.from({ length: 3320 }, (_, index) => index & 0xff);
  const rebuild = [...original];
  rebuild[0x10] = 0xff;
  const [one] = compare(new Map([["title", observation(original)]]), new Map([["title", observation(rebuild)]]));
  assert.deepEqual(one, { checkpoint: "title", what: "memory $0400 (3320 bytes)", bytes: { count: 1, listed: [{ address: "$0410", original: "10", rebuild: "ff" }] } }, "one byte differs: the result gives that byte, not 2 x 6640 hex digits");
  rebuild[0x20] = 0xee;
  rebuild[0x30] = 0xdd;
  const [three] = compare(new Map([["title", observation(original)]]), new Map([["title", observation(rebuild)]]), { max: 2, rest: "out/memory.json" });
  assert.deepEqual(three!.bytes, { count: 3, listed: [{ address: "$0410", original: "10", rebuild: "ff" }, { address: "$0420", original: "20", rebuild: "ee" }], rest: "out/memory.json" });
});

test("a FAIL with --out writes memory.json with all bytes of the item and each differing byte", async () => {
  // The rebuild side writes $01 to the observed bytes; the original side reads zeros.
  let writes = 0;
  const fake = {
    reset: async () => ({ state: "stopped" }),
    joystick: async (state: unknown) => state,
    status: async () => ({ state: "stopped" }),
    execution: async () => ({}),
    memoryRead: async (params: { address: number; size: number }) => ({ data: Buffer.alloc(params.size, writes > 0 ? 1 : 0).toString("hex") }),
    memoryWrite: async () => (writes++, {}),
  };
  const scenario = readScenario(
    scenarioFile("fail.json", {
      name: "fail",
      original: { program: "original.prg", symbols: "none" },
      rebuild: { program: "rebuild.prg", symbols: "none" },
      steps: [{ write: { address: "$c000", data: "01" }, side: "rebuild" }, { observe: "x", memory: [{ address: "$c000", size: 3 }] }],
    }),
  );
  const result = await runScenario(fake as unknown as ViceSessionClient, scenario, { out: "fail-out", max: 1 });
  assert.equal(result.result, "FAIL");
  assert.deepEqual(result.differences, [{ checkpoint: "x", what: "memory $c000 (3 bytes)", bytes: { count: 3, listed: [{ address: "$c000", original: "00", rebuild: "01" }], rest: "fail-out/memory.json" } }]);
  const memory = JSON.parse(readFileSync(join(project, "fail-out", "memory.json"), "utf8")) as unknown;
  assert.deepEqual(memory, [
    {
      checkpoint: "x",
      what: "memory $c000 (3 bytes)",
      address: "$c000",
      original: "000000",
      rebuild: "010101",
      bytes: [
        { address: "$c000", original: "00", rebuild: "01" },
        { address: "$c001", original: "00", rebuild: "01" },
        { address: "$c002", original: "00", rebuild: "01" },
      ],
    },
  ]);
});

test("an unknown name in a scenario step gives INCONCLUSIVE with the step", async () => {
  const fake = {
    reset: async () => ({ state: "stopped" }),
    joystick: async (state: unknown) => state,
    status: async () => ({ state: "stopped" }),
    execution: async () => ({}),
  };
  const scenario = readScenario(
    scenarioFile("unknown-name.json", {
      name: "unknown name",
      original: { program: "original.prg", symbols: "none" },
      rebuild: { program: "rebuild.prg", symbols: "none" },
      steps: [{ frames: 10 }, { runUntil: { target: { kind: "address", address: "no_such_name" }, timeoutFrames: 30 } }, { observe: "x", memory: ["$c000"] }],
    }),
  );
  const result = await runScenario(fake as unknown as ViceSessionClient, scenario);
  assert.equal(result.result, "INCONCLUSIVE");
  assert.equal(result.reason, "step 2 (runUntil): the original side has no symbol no_such_name");
});

test("test, run and diff refuse a snapshot file that is no VICE snapshot file before the emulator, with the file and the step", async () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  writeFileSync(join(project, "notes.txt"), "not a snapshot\n");
  writeFileSync(join(project, "notes.vsf"), "not a snapshot\n");
  const why = 'is not a VICE snapshot file (.vsf): it does not start with "VICE Snapshot File". Give a file that c64_snapshot save or a save step of a run wrote.';
  assert.deepEqual(await runRefusal("snap-step.json", { name: "x", start: { program: "game.prg" }, steps: [{ frames: 5 }, { snapshot: "notes.txt" }] }), { code: "invalid-input", message: `run snap-step.json: step 2: snapshot: notes.txt ${why}` });
  assert.deepEqual(await runRefusal("snap-start.json", { name: "x", start: { snapshot: "notes.vsf" }, steps: [{ frames: 5 }] }), { code: "invalid-input", message: `run snap-start.json: start.snapshot: notes.vsf ${why}` });
  scenarioFile("snap-scenario.json", { ...valid, original: { program: "game.prg", symbols: "none" }, rebuild: { program: "game.prg", symbols: "none" }, steps: [{ frames: 5 }, { snapshot: "notes.txt" }, { observe: "x", memory: ["$0400"] }] });
  assert.deepEqual(await refusal(() => scenarioNames(readScenario("snap-scenario.json"), "snap-scenario.json")), { code: "invalid-input", message: `scenario snap-scenario.json: step 2: snapshot: notes.txt ${why}` });
  assert.deepEqual(await refusal(() => diffFiles("notes.vsf", "notes.vsf", { gap: 0, max: 50, ntsc: false })), { code: "invalid-input", message: `notes.vsf ${why}` });
});

test("a name in a run file without symbols says how to give symbols, and a name in an observe or trace step is checked before the run", async () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  const run = async (value: unknown) => (await runRefusal("names.json", value)).message.split("\n")[0];
  const noSymbols = 'cold_start is a name, and the run file has no symbols. A run file has no symbols unless it gives "symbols": "knowledge" for the names of the knowledge, or "symbols": "<file>" for a JSON file of names. Give one of them, or a $ address';
  assert.equal(await run({ name: "x", start: { program: "game.prg" }, steps: [{ frames: 5 }, { runUntil: { target: { kind: "address", address: "cold_start" }, timeoutFrames: 10 } }] }), `run names.json: step 2: ${noSymbols}`);
  assert.equal(await run({ name: "x", start: { program: "game.prg" }, steps: [{ frames: 5 }, { observe: "o", memory: ["cold_start"] }] }), `run names.json: step 2: ${noSymbols}`);
  assert.equal(await run({ name: "x", start: { program: "game.prg" }, steps: [{ trace: "t", points: [{ kind: "exec", start: "$c000", end: "cold_start" }], frames: 5 }] }), `run names.json: step 1: ${noSymbols}`);
});

test("diff refuses --address for snapshots and observations, and --ntsc for memory files and observations", async () => {
  writeFileSync(join(project, "part1.bin"), Buffer.alloc(16));
  writeFileSync(join(project, "part2.bin"), Buffer.alloc(16, 1));
  writeFileSync(join(project, "obs.json"), JSON.stringify({ observations: { a: { memory: { $c000: "00" } }, b: { memory: { $c000: "01" } } } }));
  const differ = async (a: string, b: string, options: { at?: number; ntsc?: boolean }) => (await refusal(() => diffFiles(a, b, { gap: 0, max: 50, ntsc: false, ...options }))).message;
  assert.equal(await differ("obs.json:a", "obs.json:b", { at: 0x0400 }), "--address is only for two memory files (.bin). An observation gives the address of each item: leave out --address.");
  assert.equal(await differ("a.vsf", "b.vsf", { at: 0x0400 }), "--address is only for two memory files (.bin). A snapshot file holds all 64 KiB: leave out --address.");
  assert.equal(await differ("part1.bin", "part2.bin", { ntsc: true }), "--ntsc is only for two snapshot files (.vsf), which restore in an emulator. Memory files compare as they are: leave out --ntsc.");
  assert.equal(await differ("obs.json:a", "obs.json:b", { ntsc: true }), "--ntsc is only for two snapshot files (.vsf), which restore in an emulator. Observations compare as they are: leave out --ntsc.");
});
