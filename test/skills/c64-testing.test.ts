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
import { compare, loadSymbols, readScenario, resolve, ScenarioError } from "../../skills/c64-testing/scripts/scenario.ts";

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
