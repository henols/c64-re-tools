// The c64-testing scenario parts that need no emulator: scenario checks,
// symbol resolution per side, comparison rules and the playtest checklist.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { openForWrite } from "../../src/knowledge/database.ts";
import { renameSymbol } from "../../src/knowledge/write.ts";
import type { ViceSessionClient } from "../../src/host-client/vice-session.ts";
import { changedRanges, diffStates } from "../../skills/c64-testing/scripts/lib/diff.ts";
import { compare, loadSymbols, readScenario, resolve, runScenario, ScenarioError } from "../../skills/c64-testing/scripts/lib/scenario.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-testing-"));
const home = process.cwd();
// Scenario paths are relative to the working directory: each test runs in the project.
beforeEach(() => process.chdir(project));
afterEach(() => process.chdir(home));
after(() => rmSync(project, { recursive: true, force: true }));

const valid = {
  name: "moves left",
  original: { program: "original.prg", symbols: "knowledge" },
  rebuild: { program: "build/game.prg", symbols: "build/game.json" },
  steps: [{ reset: "hard" }, { frames: 50 }, { observe: "moved", memory: ["player_x"], registers: ["a"] }],
};

function scenarioFile(name: string, value: unknown): string {
  writeFileSync(join(project, name), JSON.stringify(value));
  return name;
}

test("a scenario needs a name, both subjects, known steps and at least one checkpoint", () => {
  assert.equal(readScenario(scenarioFile("ok.json", valid)).steps.length, 3);
  for (const [name, bad] of Object.entries({
    noName: { ...valid, name: "" },
    noRebuild: { ...valid, rebuild: undefined },
    unknownStep: { ...valid, steps: [{ sleep: 100 }, valid.steps[2]] },
    twoKinds: { ...valid, steps: [{ reset: "hard", frames: 5 }, valid.steps[2]] },
    noObserve: { ...valid, steps: [{ reset: "hard" }] },
    sameCheckpoint: { ...valid, steps: [valid.steps[2], valid.steps[2]] },
    noTimeout: { ...valid, steps: [{ runUntil: { at: "done" } }, valid.steps[2]] },
  })) {
    assert.throws(() => readScenario(scenarioFile(`${name}.json`, bad)), ScenarioError, name);
  }
  assert.throws(() => readScenario("missing.json"), ScenarioError);
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
  const original = loadSymbols({ program: "x", symbols: "knowledge" });
  const fromAssembler = loadSymbols({ program: "x", symbols: "assembled.json" });
  const fromMap = loadSymbols({ program: "x", symbols: "map.json" });
  assert.equal(resolve("player_x", original, "original"), 0xc100);
  assert.equal(resolve("player_x", fromAssembler, "rebuild"), 0xc200);
  assert.equal(resolve("draw", fromAssembler, "rebuild"), 0x0900);
  assert.equal(fromAssembler.has("BIG"), false, "a value outside $0000-$ffff is no address");
  assert.equal(resolve("player_x", fromMap, "rebuild"), 0xc300);
  assert.equal(resolve("$d020", fromMap, "rebuild"), 0xd020, "a $ address is the same on both sides");
  assert.throws(() => resolve("lives", fromMap, "rebuild"), /rebuild side has no symbol lives/);
  assert.equal(loadSymbols({ program: "x", symbols: "none" }).size, 0);
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

test("an excluded byte does not count, and steps for one side and the new step kinds check", () => {
  const observation = (bytes: number[]) => ({ memory: [{ label: "$d01e (2 bytes)", address: 0xd01e, bytes, tolerance: 0, excluded: [{ offset: 0, at: "$d01e", reason: "latched collision, not writable" }] }], registers: {} });
  assert.deepEqual(compare(new Map([["c", observation([1, 5])]]), new Map([["c", observation([0, 5])]])), [], "the excluded first byte differs");
  assert.equal(compare(new Map([["c", observation([1, 5])]]), new Map([["c", observation([1, 6])]])).length, 1, "the second byte still counts");
  const scenario = (steps: unknown[]) => scenarioFile("d46.json", { ...valid, steps: [...steps, { observe: "x", memory: ["$c000"] }] });
  assert.equal(
    readScenario(scenario([{ type: " ", side: "original" }, { snapshot: "s.vsf", side: "rebuild" }, { normalize: true }, { runUntil: { raster: 250 }, timeoutFrames: 2 }, { runUntil: { at: "$c000", raster: 100 }, timeoutFrames: 2 }])).steps.length,
    6,
  );
  for (const bad of [
    [{ type: " ", side: "both" }],
    [{ observe: "y", memory: ["$c000"], side: "original" }],
    [{ runUntil: { raster: 400 }, timeoutFrames: 2 }],
    [{ normalize: "entry_state.json" }],
    [{ observe: "y", memory: [{ at: "$d01e", exclude: [{ at: "$d01e" }] }] }],
  ]) {
    assert.throws(() => readScenario(scenario(bad)), ScenarioError, JSON.stringify(bad));
  }
});

test("the checklist lists each checkpoint and what only a person can judge", () => {
  const checklist = resolvePath(home, "skills/c64-testing/scripts/checklist.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, checklist, "ok.json", "--item", "FIRE starts the game."], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^# Playtest checklist/);
  assert.match(run.stdout, /- \[ \] At "moved", the rebuild looks and behaves as the original\./);
  assert.match(run.stdout, /- \[ \] FIRE starts the game\./);
  assert.match(run.stdout, /music and the sound effects/);
});

test("each step is checked before the scenario runs", () => {
  const observe = valid.steps[2]!;
  const accepted = {
    ...valid,
    videoStandard: "ntsc",
    steps: [
      { reset: "soft" },
      { load: true },
      { write: { at: "$c000", bytes: [0, 255] } },
      { registers: { pc: "start", a: 0, sp: 255 } },
      { joystick: { port: 2, direction: "up-left", fire: true } },
      { type: "RUN\n" },
      { frames: 10 },
      { runUntil: { memory: { at: "game_state", equals: 2 } }, timeoutFrames: 600 },
      { observe: "all", memory: ["player_x", { at: "$0400", size: 40, tolerance: 1 }], registers: ["pc", "flags"], screen: { maxMismatchRatio: 0.01, mask: [{ x: 0, y: 0, width: 320, height: 8 }] }, vicii: true, sprites: [0, 7] },
    ],
  };
  assert.equal(readScenario(scenarioFile("accepted.json", accepted)).steps.length, 9);
  for (const [name, step] of Object.entries({
    notAnObject: "reset",
    nullStep: null,
    resetMode: { reset: "warm" },
    loadFalse: { load: false },
    writeNoAt: { write: { bytes: [1] } },
    writeBadAddress: { write: { at: "$c00", bytes: [1] } },
    writeByte: { write: { at: "$c000", bytes: [256] } },
    writeNoBytes: { write: { at: "$c000", bytes: [] } },
    registerName: { registers: { q: 1 } },
    registerFlags: { registers: { flags: 1 } },
    registerRange: { registers: { a: 256 } },
    joystickPort: { joystick: { port: 3, direction: "left" } },
    joystickDirection: { joystick: { port: 2, direction: "sideways" } },
    joystickFire: { joystick: { port: 2, direction: "left", fire: "yes" } },
    typeEmpty: { type: "" },
    typeNoKey: { type: "é" },
    framesZero: { frames: 0 },
    runUntilText: { runUntil: "main", timeoutFrames: 10 },
    runUntilBoth: { runUntil: { at: "main", memory: { at: "x", equals: 1 } }, timeoutFrames: 10 },
    runUntilValue: { runUntil: { memory: { at: "x", equals: 256 } }, timeoutFrames: 10 },
    runUntilTimeout: { runUntil: { at: "main" }, timeoutFrames: 0 },
    unknownKey: { frames: 5, count: 5 },
    observeRegister: { observe: "x", registers: ["q"] },
    observeMemorySize: { observe: "x", memory: [{ at: "$0400", size: 0 }] },
    observeTolerance: { observe: "x", memory: [{ at: "$0400", tolerance: -1 }] },
    observeMask: { observe: "x", screen: { mask: [{ x: 0, y: 0, width: 0, height: 8 }] } },
    observeFullMask: { observe: "x", screen: { mask: [{ x: 0, y: 0, width: 384, height: 272 }] } },
    observeHalvesMask: { observe: "x", screen: { mask: [{ x: 0, y: 0, width: 384, height: 136 }, { x: 0, y: 136, width: 400, height: 200 }] } },
    observeRatio: { observe: "x", screen: { maxMismatchRatio: 2 } },
    observeSprite: { observe: "x", sprites: [8] },
    observeVicii: { observe: "x", vicii: "yes" },
    observeTypo: { observe: "x", sprite: [0] },
  })) {
    assert.throws(() => readScenario(scenarioFile(`${name}.json`, { ...valid, steps: [step, observe] })), ScenarioError, name);
  }
  assert.throws(() => readScenario(scenarioFile("standard.json", { ...valid, videoStandard: "secam" })), ScenarioError);
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

test("the checklist refuses a bad scenario or no scenario as invalid input, with the usage text", () => {
  const checklist = resolvePath(home, "skills/c64-testing/scripts/checklist.ts");
  writeFileSync(join(project, "bad.json"), JSON.stringify({ name: "" }));
  for (const args of [["bad.json"], []]) {
    const run = spawnSync(process.execPath, [...process.execArgv, checklist, ...args], { cwd: project, encoding: "utf8" });
    assert.equal(run.status, 2, args.join(" "));
    const error = (JSON.parse(run.stdout) as { error: { code: string; message: string } }).error;
    assert.equal(error.code, "invalid-input");
    assert.match(error.message, /\n\nchecklist\.ts <scenario\.json>/, args.join(" "));
  }
});

test("a run refuses a bad call before it opens an emulator", () => {
  const script = resolvePath(home, "skills/c64-testing/scripts/run.ts");
  const call = (...args: string[]) => spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  writeFileSync(join(project, "run.json"), JSON.stringify({ name: "r", start: { program: "game.prg" }, steps: [{ screen: "../escape" }] }));
  writeFileSync(join(project, "two.json"), JSON.stringify({ name: "r", start: { program: "game.prg", snapshot: "s.vsf" }, steps: [{ frames: 1 }] }));
  for (const args of [["run.json"], ["run.json", "--out", "../outside"], ["run.json", "--out", "out"], ["two.json", "--out", "out"]]) {
    const run = call(...args);
    assert.equal(run.status, 2, `${args.join(" ")}: ${run.stdout}`);
  }
});

test("diff gives the changed ranges of two memory files and the changed items of two observations of one run", () => {
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
  writeFileSync(join(project, "results.json"), JSON.stringify({ observations: { start: { memory: { room: "00", $0400: "2020" }, registers: { a: 1, pc: "$0400" } }, later: { memory: { room: "05", $0400: "2020" }, registers: { a: 1, pc: "$0410" } } } }));
  const script = resolvePath(import.meta.dirname, "../../skills/c64-testing/scripts/diff.ts");
  const differ = (...args: string[]) => spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: project, encoding: "utf8" });
  const memory = differ("before.bin", "after.bin");
  assert.equal(memory.status, 0, memory.stdout + memory.stderr);
  assert.deepEqual(JSON.parse(memory.stdout).memory, { changedBytes: 2, ranges: 1, listed: [{ start: "$2fa1", end: "$2fa2", a: "0000", b: "0707" }] });
  const observed = differ("results.json:start", "results.json:later");
  assert.equal(observed.status, 0, observed.stdout + observed.stderr);
  assert.deepEqual(JSON.parse(observed.stdout), { a: "results.json:start", b: "results.json:later", registers: [{ name: "cpu.pc", a: 0x0400, b: 0x0410 }], observed: [{ at: "room", a: "00", b: "05" }] });
  assert.equal(differ("before.bin", "results.json:later").status, 2, "two states of one kind");
  assert.equal(differ("results.json:start", "results.json:nothing").status, 2);
});
