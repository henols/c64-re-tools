// The export of a rebuilt program as the start of a new program. The program
// starts with 10 SYS 2061. A TRAINER switch keeps the lives, a PROTECTION
// switch removes the call of a copy check, a routine is dead, and a table is
// unused. The coverage shows that the start, the loop and the check ran. The
// export puts the trainer in and the copy check call out. The dead routine and
// the table become free; the check ran, so it stays until --drop names it. The
// new project builds to its baseline with ACME, its knowledge is slim, its tests
// are changed or left out, and the zip holds the folder.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME, findTool } from "../../src/native/discover.ts";
import { findGhidra } from "../../src/native/ghidra/index.ts";
import { readZip } from "../../src/zip.testkit.ts";
import { readEnvelope } from "../kit.ts";

let skip: string | false = false;
try {
  findTool(ACME);
  findGhidra();
} catch {
  skip = "ACME or Ghidra is not installed";
}

const skills = resolve(import.meta.dirname, "../../skills");
const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "c64-re-tools-export-")));
const project = join(sandbox, "game");
mkdirSync(project);
after(() => rmSync(sandbox, { recursive: true, force: true }));

function script(skill: string, file: string, args: readonly string[], cwd = project): { status: number | null; json: Record<string, any> } {
  const run = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", file), ...args], { cwd, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  assert.equal(run.stderr, "", run.stderr);
  return { status: run.status, json: readEnvelope(run.stdout, run.status).json as Record<string, any> };
}

function ok(skill: string, file: string, args: readonly string[], cwd = project): Record<string, any> {
  const run = script(skill, file, args, cwd);
  assert.equal(run.status, 0, `${file} ${args.join(" ")}: ${JSON.stringify(run.json)}`);
  return run.json;
}

// prettier-ignore
const PROGRAM = [
  0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, // $0801 10 SYS 2061
  0xa9, 0x03, 0x8d, 0x00, 0x04, // $080d start: LDA #$03; STA $0400
  0xce, 0x00, 0x20,             // $0812 loop: DEC $2000, a life
  0x20, 0x1b, 0x08,             // $0815 JSR check
  0x4c, 0x12, 0x08,             // $0818 JMP loop
  0xad, 0x01, 0xdc, 0xc9, 0xef, // $081b check: LDA $dc01; CMP #$ef
  0xd0, 0x01, 0x60,             // $0820 BNE fail; RTS
  0x4c, 0x23, 0x08,             // $0823 fail: JMP fail
  0xa9, 0x01, 0x8d, 0x20, 0xd0, 0x60, // $0826 dead: LDA #$01; STA $d020; RTS
  0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, // $082c table
];

/** The opcode bytes that the run executed: the start, the loop and the check, but not fail and not dead. */
const EXECUTED = [0x080d, 0x080f, 0x0812, 0x0815, 0x0818, 0x081b, 0x081e, 0x0820, 0x0822];

const SCENARIO = {
  name: "to the check",
  original: { program: "game.prg", symbols: "knowledge" },
  rebuild: { program: "build/game.prg", symbols: "build/game.json" },
  steps: [{ frames: 150 }, { load: true }, { registers: { pc: "start" } }, { runUntil: { target: { kind: "address", address: "loop" }, timeoutFrames: 60 } }, { observe: "lives", memory: [{ address: "$0400", size: 1 }] }],
};
const RUN = { start: { program: "game.prg", load: true }, symbols: "knowledge", steps: [{ registers: { pc: "start" } }, { frames: 2 }, { expect: "lives", memory: [{ address: "$0400", data: "03" }] }] };
const CHECK = { ...SCENARIO, name: "at the check", steps: [{ frames: 150 }, { load: true }, { registers: { pc: "check" } }, { observe: "a", registers: ["a"] }] };
const SNAPSHOT = { ...SCENARIO, name: "from a snapshot", steps: [{ snapshot: "snapshots/room.vsf" }, { observe: "screen", screen: {} }] };

test("export: switches fixed, dead code and unused data free, a slim knowledge, tests changed, and a zip of the folder", { skip, timeout: 900_000 }, () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.from([0x01, 0x08, ...PROGRAM]));
  const coverage = new Uint8Array(0x10000);
  for (const address of EXECUTED) coverage[address] = 1 << 2;
  coverage[0x0400] = 1 << 1;
  mkdirSync(join(project, "runs"));
  writeFileSync(join(project, "runs", "play.bin"), coverage);
  mkdirSync(join(project, "tests"));
  writeFileSync(join(project, "tests", "lives.json"), JSON.stringify(SCENARIO));
  writeFileSync(join(project, "tests", "run-lives.json"), JSON.stringify(RUN));
  writeFileSync(join(project, "tests", "check.json"), JSON.stringify(CHECK));
  writeFileSync(join(project, "tests", "snapshot.json"), JSON.stringify(SNAPSHOT));
  writeFileSync(
    join(project, "knowledge.json"),
    JSON.stringify([
      { op: "classify", start: "$080d", end: "$0825", type: "code" },
      { op: "classify", start: "$0826", end: "$082b", type: "code" },
      { op: "classify", start: "$082c", end: "$0833", type: "bytes" },
      { op: "rename", address: "$080d", name: "start", kind: "routine" },
      { op: "rename", address: "$0812", name: "loop" },
      { op: "rename", address: "$081b", name: "check", kind: "routine" },
      { op: "rename", address: "$0823", name: "fail" },
      { op: "rename", address: "$0826", name: "dead", kind: "routine" },
      { op: "rename", address: "$082c", name: "old_table", kind: "data" },
      { op: "comment", address: "$080d", placement: "line", text: "Set the lives." },
      { op: "comment", address: "$0826", placement: "line", text: "Never called." },
      { op: "patch", start: "$0815", end: "$0817", switch: "PROTECTION", code: "", comment: "No copy check." },
    ]),
  );
  ok("c64-knowledge", "knowledge.ts", ["image", "game.prg"]);
  ok("c64-knowledge", "knowledge.ts", ["coverage", "runs/play.bin"]);
  ok("c64-knowledge", "knowledge.ts", ["release", "ORIGINAL", "--file", "game.prg", "--base"]);
  ok("c64-knowledge", "knowledge.ts", ["switch", "PROTECTION", "--kind", "protection", "--releases", "ORIGINAL", "--comment", "The copy check reads the keyboard."]);
  ok("c64-knowledge", "knowledge.ts", ["switch", "TRAINER", "--kind", "trainer", "--comment", "Infinite lives."]);
  ok("c64-knowledge", "knowledge.ts", ["apply", "knowledge.json", "--reason", "the program"]);
  ok("c64-knowledge", "knowledge.ts", ["patch", "$0812-$0814", "TRAINER", "--nop", "--comment", "Lives stay."]);
  const generated = ok("c64-source", "source.ts", ["generate", "--out", "src"]);
  assert.equal(generated.result, "PASS");
  // The dead routine and the table are leftovers: the release has them, the default build does not.
  assert.deepEqual(generated.leftovers, { bytes: 14, count: 1, listed: [{ start: "$0826", end: "$0833", bytes: 14, file: "leftover_0826.asm" }] });
  assert.deepEqual(generated.releases.map((release: { label: string; result: string }) => [release.label, release.result]), [["ORIGINAL", "identical"]]);
  assert.equal(generated.default.result, "fits");
  assert.match(readFileSync(join(project, "src", "main.asm"), "utf8"), /!if LEFTOVERS \{ !source "leftover_0826\.asm" \} else \{ !skip 14 \}/);
  assert.match(readFileSync(join(project, "src", "config.asm"), "utf8"), /\nLEFTOVERS = 0 ; /);

  // A folder inside the project, a --drop over a changed patch and a --drop of code that kept code goes to are refused before anything is written.
  assert.match(script("c64-source", "source.ts", ["export", "--to", "out"]).json.error.message, /inside the project/);
  assert.match(script("c64-source", "source.ts", ["export", "--to", "../refused", "--drop", "$080d-$081a"]).json.error.message, /overlaps the patch \$0815-\$0817, which the export changed/);
  assert.match(script("c64-source", "source.ts", ["export", "--to", "../refused", "--drop", "$0823-$0825"]).json.error.message, /the code at \$0820 stays and goes to \$0823/);
  assert.equal(existsSync(join(sandbox, "refused")), false);

  const exported = ok("c64-source", "source.ts", ["export", "--to", "../new-game", "--name", "game"]);
  assert.equal(exported.result, "PASS");
  assert.equal(exported.to, "../new-game");
  assert.deepEqual(exported.switches, [
    { name: "PROTECTION", kind: "protection", base: 1, value: 0 },
    { name: "TRAINER", kind: "trainer", base: 0, value: 1 },
  ]);
  assert.deepEqual(exported.free.listed, [{ start: "$0826", end: "$0833", bytes: 14, what: "code and data", label: "free_0826" }]);
  assert.deepEqual(exported.unreachableExecuted.listed, [{ start: "$081b", end: "$0822", routine: "check", drop: "--drop '$081b-$0822'" }]);
  assert.deepEqual(exported.tests.written, ["tests/check.json", "tests/lives.json", "tests/run-lives.json"]);
  assert.deepEqual(exported.tests.leftOut.listed, [{ file: "tests/snapshot.json", reason: "it restores a snapshot, which is a state of the old program" }]);
  assert.equal(exported.zip.out, "../new-game.zip");

  const to = join(sandbox, "new-game");
  const asm = readdirSync(join(to, "src")).sort();
  assert.deepEqual(asm, ["constants.asm", "main.asm", "segment_0801.asm"]);
  const text = asm.map((file) => readFileSync(join(to, "src", file), "utf8")).join("\n");
  assert.doesNotMatch(text, /Generated by c64-source|!if|!zone patch|not executed|switches\.asm/);
  assert.match(text, /^free_0826$/m);
  assert.match(text, /TRAINER \(trainer\) is 1 in the export\. Infinite lives\. Lives stay\./);
  assert.match(text, /PROTECTION \(protection\) is 0 in the export\. The copy check reads the keyboard\. No copy check\./);

  // The new project builds to its baseline, and the build is the program of its knowledge.
  const built = ok("c64-assembler", "assembler.ts", ["build", "src", "main.asm", "--out", "build/game.prg", "--out-symbols", "build/game.json", "--compare"], to);
  assert.equal(built.compare.identical, true);
  const program = readFileSync(join(to, "build", "game.prg"));
  assert.deepEqual(program, readFileSync(join(to, "baseline", "game.prg")));
  assert.deepEqual([...program.subarray(2 + 0x11, 2 + 0x17)], [0xea, 0xea, 0xea, 0xea, 0xea, 0xea], "lives stay, and no copy check");
  assert.deepEqual([...program.subarray(2 + 0x25, 2 + 0x33)], Array(14).fill(0), "the free range is $00");

  // The knowledge keeps the program, the entry, the names, the comments, the regions and one revision.
  const knowledge = readdirSync(join(to, ".c64-re-tools", "knowledge")).filter((file) => file.endsWith(".jsonl")).sort();
  assert.deepEqual(knowledge, ["comments.jsonl", "memory.jsonl", "regions.jsonl", "revisions.jsonl", "symbols.jsonl"]);
  const revisions = readFileSync(join(to, ".c64-re-tools", "knowledge", "revisions.jsonl"), "utf8").trim().split("\n");
  assert.equal(revisions.length, 1);
  assert.equal(JSON.parse(revisions[0]!).operation, "export");
  const symbols = readFileSync(join(to, ".c64-re-tools", "knowledge", "symbols.jsonl"), "utf8");
  assert.doesNotMatch(symbols, /"dead"|"old_table"/);
  assert.match(symbols, /"free_0826"/);

  // The tests name the baseline and the build of the new project.
  const scenario = JSON.parse(readFileSync(join(to, "tests", "lives.json"), "utf8"));
  assert.deepEqual([scenario.original, scenario.rebuild], [{ program: "baseline/game.prg", symbols: "baseline/game.json" }, { program: "build/game.prg", symbols: "build/game.json" }]);
  const run = JSON.parse(readFileSync(join(to, "tests", "run-lives.json"), "utf8"));
  assert.deepEqual([run.start, run.symbols], [{ program: "build/game.prg", load: true }, "build/game.json"]);
  assert.match(readFileSync(join(to, "README.md"), "utf8"), /acme -f cbm -o \.\.\/build\/game\.prg main\.asm/);

  // The zip holds every file of the folder except .c64-re-tools/local/.
  const entries = readZip(readFileSync(join(sandbox, "new-game.zip")));
  assert.ok(entries.every((entry) => entry.path.startsWith("new-game/") && !entry.path.includes(".c64-re-tools/local/")));
  assert.deepEqual(entries.find((entry) => entry.path === "new-game/baseline/game.prg")!.bytes, readFileSync(join(to, "baseline", "game.prg")));
  assert.ok(entries.some((entry) => entry.path === "new-game/.c64-re-tools/knowledge/memory.jsonl"));

  // A second export into a full folder is refused; with --drop the check becomes free too, and the test that names it is left out.
  assert.match(script("c64-source", "source.ts", ["export", "--to", "../new-game"]).json.error.message, /is not empty/);
  const dropped = ok("c64-source", "source.ts", ["export", "--to", "../lean-game", "--name", "game", "--drop", "$081b-$0822"]);
  assert.deepEqual(dropped.free.listed, [{ start: "$081b", end: "$0833", bytes: 25, what: "code and data", label: "free_081b" }]);
  assert.deepEqual(dropped.unreachableExecuted.listed, []);
  assert.deepEqual(dropped.tests.leftOut.listed.map((item: { file: string }) => item.file), ["tests/check.json", "tests/snapshot.json"]);
});
