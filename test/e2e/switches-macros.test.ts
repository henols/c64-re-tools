// Code switches and macros. The original release has a copy check: a
// PROTECTION switch of three patches holds the code without it, and a TRAINER
// switch of only NOP keeps the lives. A macro writes one of two 16-bit
// increments, and the other one, with a label inside it, stays instructions.
// The build of the original is identical to the program, each switch fits,
// the default build is the program without the copy check, and the macro
// candidates of the analyzer, applied, keep the source identical.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME, findTool } from "../../src/native/discover.ts";
import { findGhidra } from "../../src/native/ghidra/index.ts";
import { CATALOGUE } from "../../skills/c64-static-analysis/scripts/lib/macros.ts";

let skip: string | false = false;
try {
  findTool(ACME);
  findGhidra();
} catch {
  skip = "ACME or Ghidra is not installed";
}

const skills = resolve(import.meta.dirname, "../../skills");
const project = realpathSync(mkdtempSync(join(tmpdir(), "c64-re-tools-switches-")));
after(() => rmSync(project, { recursive: true, force: true }));

function script(skill: string, file: string, args: readonly string[]): { status: number | null; json: Record<string, any> } {
  const run = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", file), ...args], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  assert.equal(run.stderr, "", run.stderr);
  return { status: run.status, json: JSON.parse(run.stdout) as Record<string, any> };
}

function ok(skill: string, file: string, args: readonly string[]): Record<string, any> {
  const run = script(skill, file, args);
  assert.equal(run.status, 0, `${file} ${args.join(" ")}: ${JSON.stringify(run.json)}`);
  return run.json;
}

// prettier-ignore
const CODE = [
  0xa9, 0x03, 0x8d, 0x00, 0x04,       // $1000 start: LDA #$03; STA $0400
  0xe6, 0xfb, 0xd0, 0x02, 0xe6, 0xfc, // $1005 loop: INC $fb; BNE +2; INC $fc
  0xce, 0x00, 0x20,                   // $100b DEC $2000: lose a life
  0x20, 0x22, 0x10,                   // $100e JSR check
  0xe6, 0xfd, 0xd0, 0x02, 0xe6, 0xfe, // $1011 INC $fd; BNE +2; INC $fe
  0xa9, 0x00, 0x85, 0xfb, 0xa9, 0x10, 0x85, 0xfc, // $1017 the pointer at $fb gets $1000
  0x4c, 0x05, 0x10,                   // $101f JMP loop
  0xad, 0x01, 0xdc, 0xc9, 0xef,       // $1022 check: LDA $dc01; CMP #$ef
  0xd0, 0x01, 0x60,                   // $1027 BNE fail; RTS
  0x4c, 0x2a, 0x10,                   // $102a fail: JMP fail
];

const INC16 = CATALOGUE.find((idiom) => idiom.name === "inc16")!;

test("switches and macros: the original stays identical, each switch fits, and the default build has no copy check", { skip, timeout: 900_000 }, () => {
  writeFileSync(join(project, "game.prg"), Uint8Array.from([0x00, 0x10, ...CODE]));
  writeFileSync(
    join(project, "knowledge.json"),
    JSON.stringify([
      { op: "classify", start: "$1000", end: "$1021", type: "code" },
      { op: "classify", start: "$1022", end: "$102c", type: "code" },
      { op: "rename", address: "$1000", name: "start", kind: "routine" },
      { op: "rename", address: "$1005", name: "loop" },
      { op: "rename", address: "$1013", name: "high_byte" },
      { op: "rename", address: "$1022", name: "check", kind: "routine" },
      { op: "rename", address: "$102a", name: "fail" },
      { op: "rename", address: "$00fb", name: "ptr", kind: "variable" },
      { op: "macro", name: "inc16", params: INC16.params, body: INC16.body, comment: INC16.comment },
      { op: "use", start: "$1005", end: "$100a", macro: "inc16", args: ["ptr"] },
      { op: "use", start: "$1011", end: "$1016", macro: "inc16", args: ["$fd"] },
      { op: "patch", start: "$100e", end: "$1010", switch: "PROTECTION", code: "", comment: "No copy check." },
      { op: "patch", start: "$1027", end: "$1028", switch: "PROTECTION", code: "" },
      { op: "patch", start: "$102a", end: "$102c", switch: "PROTECTION", code: "        rts" },
    ]),
  );
  ok("c64-knowledge", "knowledge.ts", ["image", "game.prg"]);
  ok("c64-knowledge", "knowledge.ts", ["release", "ORIGINAL", "--file", "game.prg", "--base", "--comment", "With the copy check."]);
  ok("c64-knowledge", "knowledge.ts", ["switch", "PROTECTION", "--kind", "protection", "--releases", "ORIGINAL", "--comment", "The copy check reads the keyboard."]);
  ok("c64-knowledge", "knowledge.ts", ["switch", "TRAINER", "--kind", "trainer", "--comment", "Infinite lives."]);
  ok("c64-knowledge", "knowledge.ts", ["apply", "knowledge.json", "--reason", "the copy check and the counters"]);
  ok("c64-knowledge", "knowledge.ts", ["patch", "$100b-$100d", "TRAINER", "--nop", "--comment", "Lives stay."]);
  assert.deepEqual(
    ok("c64-knowledge", "knowledge.ts", ["switches"]).switches.listed.map((item: { name: string; default: number; base: number; patches: unknown[] }) => [item.name, item.default, item.base, item.patches.length]),
    [["PROTECTION", 0, 1, 3], ["TRAINER", 0, 0, 1]],
  );

  const generated = ok("c64-source", "source.ts", ["generate", "--out", "src"]);
  assert.equal(generated.check.identical, true);
  assert.deepEqual(generated.files.map((file: { out: string }) => file.out).filter((path: string) => path.endsWith(".asm")), ["src/segment_1000.asm", "src/switches.asm", "src/config.asm", "src/constants.asm", "src/macros.asm", "src/main.asm"]);
  assert.deepEqual(generated.switches.map((item: { name: string; result: string; changedBytes: number }) => [item.name, item.result, item.changedBytes]), [["PROTECTION", "fits", 8], ["TRAINER", "fits", 3]]);
  assert.deepEqual(generated.default, { in: ["PROTECTION"], result: "fits", changedBytes: 8 });
  assert.deepEqual(generated.releases.map((item: { label: string; result: string }) => [item.label, item.result]), [["ORIGINAL", "identical"]]);
  assert.equal(generated.macroUses, 1);
  assert.deepEqual(generated.macrosAsInstructions.listed, [{ start: "$1011", end: "$1016", macro: "inc16", reason: "The source has a label at $1013, inside the use." }]);
  const text = readFileSync(join(project, "src", "segment_1000.asm"), "utf8");
  assert.match(text, /^loop\n {8}\+inc16 ptr\n/m);
  assert.match(text, /^!zone patch_TRAINER_100b \{\n\.patch_start\n!if TRAINER \{\n/m);
  assert.match(text, /^!zone patch_PROTECTION_100e \{\n\.patch_start\n!if PROTECTION = 0 \{\n {8}; PROTECTION off: /m);
  const configPath = join(project, "src", "config.asm");
  const config = readFileSync(configPath, "utf8");
  assert.match(config, /^; Copy protection: off by default\nPROTECTION = 0 ; on in ORIGINAL\. \$100e-\$1010, \$1027-\$1028, \$102a-\$102c\. The copy check reads the keyboard\.$/m);
  assert.match(config, /^; Trainers: off by default\nTRAINER {4}= 0 ; on in no release\. \$100b-\$100d\. Infinite lives\.$/m);

  // The agent builds the default program with c64-assembler: only the bytes of the PROTECTION ranges differ from the original.
  const clean = script("c64-assembler", "assembler.ts", ["build", "src", "main.asm", "--out", "build/clean.prg", "--compare"]);
  assert.equal(clean.status, 1, JSON.stringify(clean.json));
  const [segment] = clean.json.compare.segments as Array<{ differences: number; firstDifference: { address: string } }>;
  assert.deepEqual([segment!.differences, segment!.firstDifference.address], [8, "$100e"]);
  const built = readFileSync(join(project, "build", "clean.prg"));
  assert.deepEqual([...built.subarray(2 + 0x0e, 2 + 0x11)], [0xea, 0xea, 0xea], "no JSR check");
  assert.deepEqual([...built.subarray(2 + 0x2a, 2 + 0x2d)], [0x60, 0xea, 0xea], "fail returns");
  assert.deepEqual([...built.subarray(2 + 0x0b, 2 + 0x0e)], [0xce, 0x00, 0x20], "the trainer is off");
  const original = script("c64-assembler", "assembler.ts", ["build", "src", "main.asm", "--out", "build/game.prg", "--release", "ORIGINAL", "--compare"]);
  assert.equal(original.json.compare.identical, true, "the build of the original release is the program");
  // The user turns the trainer on in config.asm.
  writeFileSync(configPath, config.replace(/^TRAINER {4}= 0/m, "TRAINER    = 1"));
  const trained = ok("c64-assembler", "assembler.ts", ["build", "src", "main.asm", "--out", "build/trained.prg"]);
  assert.equal(trained.assembled, true);
  assert.deepEqual([...readFileSync(join(project, "build", "trained.prg")).subarray(2 + 0x0b, 2 + 0x0e)], [0xea, 0xea, 0xea], "lives stay");

  // The analyzer finds the set16 at $1017 and knows the two uses of inc16 in the knowledge.
  const analyzed = ok("c64-static-analysis", "static-analysis.ts", ["analyze", "--entry", "$1000", "--out-macro-batch", ".c64-re-tools/local/macros.json"]);
  const macros = analyzed.idioms.candidates.macros;
  assert.deepEqual(macros.listed, [{ macro: "set16", start: "$1017", end: "$101e", args: ["ptr", "start"], text: "+set16 ptr, start" }]);
  assert.deepEqual([macros.known, macros.leftOut, macros.batch.writes], [2, undefined, 2], "the set16 macro and its use");
  ok("c64-knowledge", "knowledge.ts", ["apply", ".c64-re-tools/local/macros.json"]);
  const again = ok("c64-source", "source.ts", ["generate", "--out", "src"]);
  assert.equal(again.check.identical, true);
  assert.equal(again.macroUses, 2);
  assert.match(readFileSync(join(project, "src", "segment_1000.asm"), "utf8"), /^ {8}\+set16 ptr, start$/m);
});
