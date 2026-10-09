// The c64-testing scenario parts that need no emulator: scenario checks,
// symbol resolution per side, comparison rules and the playtest checklist.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { after, test } from "node:test";

import { openForWrite } from "../../src/knowledge/database.ts";
import { renameSymbol } from "../../src/knowledge/write.ts";
import type { ViceSessionClient } from "../../src/host-client/vice-session.ts";
import { compare, loadSymbols, readScenario, resolve, runScenario, ScenarioError } from "../../skills/c64-testing/scripts/scenario.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-testing-"));
const home = process.cwd();
process.chdir(project);
after(() => {
  process.chdir(home);
  rmSync(project, { recursive: true, force: true });
});

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
    JSON.stringify({ assembled: true, symbols: [{ name: "draw", kind: "address", address: "$0900" }, { name: "player_x", kind: "constant", value: 0xc200 }, { name: "BIG", kind: "constant", value: 70000 }] }),
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
    memory: [{ label: "player_x", bytes: [x], tolerance: 1 }],
    registers: { a },
    ...(screen === undefined ? {} : { screen: { ...screen, mismatchingPixels: screen.match ? 0 : 12, mismatchRatio: screen.match ? 0 : 0.001 } }),
  });
  assert.deepEqual(compare(new Map([["moved", observation(100, 1)]]), new Map([["moved", observation(101, 1, { match: true })]])), []);
  const differences = compare(new Map([["moved", observation(100, 1)]]), new Map([["moved", observation(102, 2, { match: false })]]));
  assert.deepEqual(
    differences.map((difference) => difference.what),
    ["memory player_x", "register a", "screen"],
  );
});

test("the checklist lists each checkpoint and what only a person can judge", () => {
  const checklist = resolvePath(home, "skills/c64-testing/scripts/checklist.ts");
  const run = spawnSync(process.execPath, [checklist, "ok.json", "--item", "FIRE starts the game."], { cwd: project, encoding: "utf8" });
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
    observeRatio: { observe: "x", screen: { maxMismatchRatio: 2 } },
    observeSprite: { observe: "x", sprites: [8] },
    observeVicii: { observe: "x", vicii: "yes" },
    observeTypo: { observe: "x", sprite: [0] },
  })) {
    assert.throws(() => readScenario(scenarioFile(`${name}.json`, { ...valid, steps: [step, observe] })), ScenarioError, name);
  }
  assert.throws(() => readScenario(scenarioFile("standard.json", { ...valid, videoStandard: "secam" })), ScenarioError);
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
      return { match: true, mismatchingPixels: 0, mismatchRatio: 0 };
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
