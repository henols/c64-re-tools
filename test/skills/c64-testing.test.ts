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
import { Refusal } from "../../src/errors.ts";
import { compare, namesOf, readScenario, resolve, runScenario } from "../../skills/c64-testing/scripts/lib/scenario.ts";
import { snapshotRam } from "../../skills/c64-testing/scripts/lib/diff-files.ts";

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
  const { text } = JSON.parse(run.stdout) as { text: string };
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
      { observe: "all", memory: ["player_x", { address: "$0400", size: 40, tolerance: 1 }], registers: ["pc", "flags"], screen: { maxMismatchRatio: 0.01, mask: [{ x: 0, y: 0, width: 320, height: 8 }] }, vicii: true, sprites: [0, 7] },
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

test("the checklist refuses a bad scenario and, with the usage text, no scenario as invalid input", () => {
  const checklist = resolvePath(home, "skills/c64-testing/scripts/testing.ts");
  writeFileSync(join(project, "bad.json"), JSON.stringify({ name: "" }));
  const call = (...args: string[]) => {
    const run = spawnSync(process.execPath, [...process.execArgv, checklist, "checklist", ...args], { cwd: project, encoding: "utf8" });
    assert.equal(run.status, 2, args.join(" "));
    return (JSON.parse(run.stdout) as { error: { code: string; message: string } }).error;
  };
  assert.deepEqual(call("bad.json"), { code: "invalid-input", message: "scenario bad.json: needs a name" });
  const none = call();
  assert.equal(none.code, "invalid-input");
  assert.match(none.message, /^checklist needs <scenario\.json>\.\.\.\n\ntesting\.ts checklist <scenario\.json>/);
});

test("a run refuses a bad call before it opens an emulator", () => {
  const script = resolvePath(home, "skills/c64-testing/scripts/testing.ts");
  const call = (...args: string[]) => spawnSync(process.execPath, [...process.execArgv, script, "run", ...args], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
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
  writeFileSync(
    join(project, "results.json"),
    JSON.stringify({ observations: { start: { memory: { room: "00", $0400: "2020" }, registers: { a: 1, pc: "$0400" } }, later: { memory: { room: "05", $0400: "2020" }, registers: { a: 1, pc: "$0410" } }, other: { memory: { $c000: "01" } } } }),
  );
  const script = resolvePath(import.meta.dirname, "../../skills/c64-testing/scripts/testing.ts");
  const differ = (...args: string[]) => spawnSync(process.execPath, [...process.execArgv, script, "diff", ...args], { cwd: project, encoding: "utf8" });
  const memory = differ("before.bin", "after.bin");
  assert.equal(memory.status, 0, memory.stdout + memory.stderr);
  assert.deepEqual(JSON.parse(memory.stdout).memory, { changedBytes: 2, count: 1, listed: [{ start: "$2fa1", end: "$2fa2", a: "0000", b: "0707" }] });
  const observed = differ("results.json:start", "results.json:later");
  assert.equal(observed.status, 0, observed.stdout + observed.stderr);
  assert.deepEqual(JSON.parse(observed.stdout), {
    a: "results.json:start",
    b: "results.json:later",
    registers: { compared: 2, count: 1, listed: [{ name: "cpu.pc", a: "$0400", b: "$0410" }] },
    observed: { compared: 2, count: 1, listed: [{ address: "room", a: "00", b: "05" }] },
  });
  // Nothing in common: the result says that nothing was compared, so a count of 0 does not read as equal.
  const apart = differ("results.json:start", "results.json:other");
  assert.equal(apart.status, 0, apart.stdout + apart.stderr);
  assert.deepEqual(JSON.parse(apart.stdout).observed, {
    compared: 0,
    reason: "No memory item was compared: the observations have none in common. results.json:start has room, $0400; results.json:other has $c000.",
    count: 0,
    listed: [],
  });
  assert.deepEqual(JSON.parse(apart.stdout).registers, {
    compared: 0,
    reason: "No register was compared: the observations have none in common. results.json:start has cpu.a, cpu.pc; results.json:other has none.",
    count: 0,
    listed: [],
  });
  assert.equal(differ("before.bin", "results.json:later").status, 2, "two states of one kind");
  assert.equal(differ("results.json:start", "results.json:nothing").status, 2);
});

test("diff compares the CPU flags, shows the pc as $xxxx, and --out names the changed registers as the result does", () => {
  const flags = (c: boolean) => ({ n: false, v: false, b: true, d: false, i: true, z: false, c });
  writeFileSync(join(project, "flags.json"), JSON.stringify({ observations: { before: { registers: { pc: "$c000", a: 1, flags: flags(false) } }, after: { registers: { pc: "$c010", a: 1, flags: flags(true) } } } }));
  const script = resolvePath(import.meta.dirname, "../../skills/c64-testing/scripts/testing.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "diff", "flags.json:before", "flags.json:after", "--out", "flags-diff.json"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(run.stdout) as { registers: unknown; out: string };
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
  assert.equal(snapshotRam(Buffer.concat([header, module("MAINCPU", Buffer.alloc(103))])), undefined);
  assert.equal(snapshotRam(Buffer.from("not a snapshot")), undefined);
});

test("a run refuses two steps that write one file, across step kinds, and names both steps", () => {
  const script = resolvePath(home, "skills/c64-testing/scripts/testing.ts");
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  const refused = (steps: unknown[]) => {
    writeFileSync(join(project, "collide.json"), JSON.stringify({ name: "collide", start: { program: "game.prg" }, steps }));
    const run = spawnSync(process.execPath, [...process.execArgv, script, "run", "collide.json", "--out", "out"], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
    assert.equal(run.status, 2, run.stdout);
    const { error } = JSON.parse(run.stdout) as { error: { code: string; message: string } };
    assert.equal(error.code, "invalid-input");
    return error.message.split("\n")[0];
  };
  assert.equal(refused([{ frames: 5 }, { coverage: "x" }, { observe: "x", memory: "all" }]), "run collide.json: step 3 (observe) writes x.bin, and step 2 (coverage) writes that file too. Give one of them another name");
  assert.equal(refused([{ save: "x" }, { frames: 5 }, { save: "x" }]), "run collide.json: step 3 (save) writes x.vsf, and step 1 (save) writes that file too. Give one of them another name");
  assert.equal(refused([{ coverage: "big-c000" }, { observe: "big", memory: [{ address: "$c000", size: 5000 }] }]), "run collide.json: step 2 (observe) writes big-c000.bin, and step 1 (coverage) writes that file too. Give one of them another name");
  assert.equal(refused([{ trace: "results", points: [{ kind: "exec", start: "$c000" }], frames: 5 }]), "run collide.json: step 1 (trace) writes results.json, and the run itself (results.json) writes that file too. Give one of them another name");
  assert.equal(refused([{ screen: "Room" }, { screen: "room" }]), "run collide.json: step 2 (screen) writes room.png, and step 1 (screen) writes that file too. Give one of them another name");
});

test("a run and a scenario refuse the 2.0 step and memory forms with the field and the 2.1 form", () => {
  const script = resolvePath(home, "skills/c64-testing/scripts/testing.ts");
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  const message = (command: string, file: string, value: unknown) => {
    writeFileSync(join(project, file), JSON.stringify(value));
    const run = spawnSync(process.execPath, [...process.execArgv, script, command, file, ...(command === "run" ? ["--out", "out"] : [])], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
    assert.equal(run.status, 2, run.stdout);
    return (JSON.parse(run.stdout) as { error: { message: string } }).error.message.split("\n")[0]!;
  };
  const run = (steps: unknown[]) => message("run", "old-run.json", { name: "old", start: { program: "game.prg" }, steps });
  assert.equal(run([{ runUntil: { at: "cold_start" }, timeoutFrames: 900 }]), 'run old-run.json: step 1 has the 2.0 form (runUntil.at, timeoutFrames beside runUntil). Write {"runUntil": {"target": {"kind": "address", "address": "cold_start"}, "timeoutFrames": 900}}');
  assert.equal(run([{ observe: "x", memory: [{ at: "$0400", size: 2 }] }]), "run old-run.json: step 1: a memory object has the field at. at is a 2.0 field. Write address in place of at");
  assert.equal(run([{ trace: "t", points: [{ kind: "exec", at: "$c000" }], frames: 5 }]), "run old-run.json: step 1: a point has the field at. at is a 2.0 field. Write start in place of at");
  assert.equal(run([{ press: " " }]).startsWith("run old-run.json: step 1: press pushes keys of the keyboard matrix"), true);
  assert.equal(run([{ wait: 5 }]), "run old-run.json: step 1 must have exactly one of write, registers, joystick, type, frames, runUntil, snapshot, save, screen, coverage, observe, trace");
  const scenario = (steps: unknown[]) => message("checklist", "old-scenario.json", { ...valid, steps });
  assert.equal(scenario([{ type: " ", side: "original" }, valid.steps[2]]), 'scenario old-scenario.json: step 1 has the 2.0 form (type as text). Write {"type": {"mode": "text", "text": " "}, "side": "original"}, or {"type": {"mode": "petscii", "bytes": [...]}} for PETSCII codes');
  assert.equal(scenario([{ runUntil: { at: "title_menu_loop" }, timeoutFrames: 600 }, valid.steps[2]]), 'scenario old-scenario.json: step 1 has the 2.0 form (runUntil.at, timeoutFrames beside runUntil). Write {"runUntil": {"target": {"kind": "address", "address": "title_menu_loop"}, "timeoutFrames": 600}}');
  assert.equal(scenario([{ observe: "x", memory: [{ at: "$0002", size: 254 }] }]), "scenario old-scenario.json: step 1: a memory object has the field at. at is a 2.0 field. Write address in place of at");
  assert.equal(scenario([{ observe: "x", memory: [{ address: "$d01e", exclude: [{ at: "$d01e", reason: "latched" }] }] }]), "scenario old-scenario.json: step 1: an exclude has the field at. at is a 2.0 field. Write address in place of at");
  assert.equal(scenario([{ frames: 5, type: { mode: "text", text: " " } }, valid.steps[2]]), "scenario old-scenario.json: step 1 has 2 step kinds: frames, type. Give each one its own step");
  assert.equal(scenario([{ sleep: 5 }, valid.steps[2]]), "scenario old-scenario.json: step 1 must have exactly one of reset, load, autostart, snapshot, normalize, write, registers, joystick, type, frames, runUntil, observe");
});

test("test and run check every file before the emulator: a missing file is not-found, a disk image is no PRG", () => {
  const script = resolvePath(home, "skills/c64-testing/scripts/testing.ts");
  writeFileSync(join(project, "game.prg"), Uint8Array.of(0x01, 0x08, 0x00));
  writeFileSync(join(project, "game.d64"), Buffer.alloc(174848));
  // No host listens at port 1: a call that got to the emulator would be INCONCLUSIVE (exit 3) or an error about the host.
  const call = (...args: string[]) => {
    const run = spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
    assert.equal(run.status, 2, `${args.join(" ")}: ${run.stdout}`);
    return (JSON.parse(run.stdout) as { error: { code: string; message: string } }).error;
  };
  const scenario = (name: string, sides: Record<string, unknown>, steps: unknown[] = [{ autostart: true }, { observe: "x", memory: ["$0400"] }]) => {
    writeFileSync(join(project, name), JSON.stringify({ name: "files", original: { program: "game.prg", symbols: "none" }, rebuild: { program: "game.prg", symbols: "none" }, ...sides, steps }));
    return name;
  };
  assert.deepEqual(call("test", scenario("no-rebuild.json", { rebuild: { program: "build/nope.prg", symbols: "none" } })), { code: "not-found", message: "rebuild.program: There is no file at build/nope.prg in the project folder." });
  assert.deepEqual(call("test", scenario("no-symbols.json", { rebuild: { program: "game.prg", symbols: "build/nope.json" } })), { code: "not-found", message: "rebuild.symbols: There is no file at build/nope.json in the project folder." });
  const disk = call("test", scenario("disk.json", { original: { program: "game.d64", symbols: "none" } }));
  assert.equal(disk.code, "invalid-input");
  assert.equal(disk.message, "original.program: game.d64 is a disk image (.d64), not a PRG. A scenario program is a PRG. Get the PRG out of the disk, tape or cartridge with disk.ts read (or disk.ts crt) of the c64-disk skill.");
  assert.equal(call("test", scenario("no-snapshot.json", {}, [{ snapshot: "nope.vsf" }, { observe: "x", memory: ["$0400"] }])).code, "not-found");
  const run = (name: string, value: unknown) => {
    writeFileSync(join(project, name), JSON.stringify(value));
    return call("run", name, "--out", "out");
  };
  assert.equal(run("run-missing.json", { name: "r", start: { program: "nope.prg" }, steps: [{ frames: 1 }] }).code, "not-found");
  assert.match(run("run-disk.json", { name: "r", start: { program: "game.d64" }, steps: [{ frames: 1 }] }).message, /^run run-disk\.json: start\.program: game\.d64 is a disk image \(\.d64\), not a PRG\. A run starts a PRG/);
  assert.deepEqual(run("run-snapshot.json", { name: "r", start: { program: "game.prg" }, steps: [{ frames: 1 }, { snapshot: "nope.vsf" }] }), { code: "not-found", message: "run run-snapshot.json: step 2: snapshot: There is no file at nope.vsf in the project folder." });
  assert.deepEqual(run("run-name.json", { name: "r", start: { program: "game.prg" }, steps: [{ frames: 1 }, { runUntil: { target: { kind: "address", address: "nonsense" } } }] }), { code: "invalid-input", message: "run run-name.json: step 2: the symbols have no nonsense" });
});
