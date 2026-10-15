// M22.8: code switches and macros (D72, D73). A program with a copy check
// gets a CRACK switch of three patches and a TRAINER switch of only NOP; a
// macro writes one of two 16-bit increments, and the other one, with a label
// inside it, stays instructions. The source is identical to the program, each
// switch fits, a build with CRACK on differs only in its ranges, and the
// macro candidates of the analyzer, applied, keep the source identical.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME, findTool } from "../../src/native/discover.ts";
import { findGhidra } from "../../src/native/ghidra/index.ts";
import { CATALOGUE } from "../../skills/c64-static-analysis/scripts/macros.ts";

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

test("switches and macros: the source stays identical, each switch fits, and CRACK on changes only its ranges", { skip, timeout: 900_000 }, () => {
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
      { op: "patch", start: "$100e", end: "$1010", switch: "CRACK", code: "", comment: "No copy check." },
      { op: "patch", start: "$1027", end: "$1028", switch: "CRACK", code: "" },
      { op: "patch", start: "$102a", end: "$102c", switch: "CRACK", code: "        rts" },
    ]),
  );
  ok("c64-knowledge", "knowledge.ts", ["apply", "knowledge.json", "--image", "game.prg", "--reason", "the crack and the counters"]);
  ok("c64-knowledge", "knowledge.ts", ["patch", "$100b", "$100d", "TRAINER", "--nop", "--comment", "Lives stay.", "--image", "game.prg"]);
  assert.deepEqual(ok("c64-knowledge", "knowledge.ts", ["switches"]).switches.map((item: { name: string; patches: unknown[] }) => [item.name, item.patches.length]), [["CRACK", 3], ["TRAINER", 1]]);

  const generated = ok("c64-source", "generate.ts", ["game.prg", "--out", "src"]);
  assert.equal(generated.check.identical, true);
  assert.deepEqual(generated.files, ["segment_1000.asm", "constants.asm", "macros.asm", "main.asm"]);
  assert.deepEqual(generated.switches.map((item: { name: string; result: string; changedBytes: number }) => [item.name, item.result, item.changedBytes]), [["CRACK", "fits", 8], ["TRAINER", "fits", 3]]);
  assert.equal(generated.macroUses, 1);
  assert.deepEqual(generated.macrosAsInstructions.listed, [{ start: "$1011", end: "$1016", macro: "inc16", reason: "The source has a label at $1013, inside the use." }]);
  const text = readFileSync(join(project, "src", "segment_1000.asm"), "utf8");
  assert.match(text, /^loop\n {8}\+inc16 ptr\n/m);
  assert.match(text, /^!zone patch_TRAINER_100b \{\n\.patch_start\n!if TRAINER \{\n/m);
  assert.match(readFileSync(join(project, "src", "constants.asm"), "utf8"), /^!ifndef CRACK \{ CRACK = 0 \} {3}; 3 patches: \$100e-\$1010, \$1027-\$1028, \$102a-\$102c$/m);

  // The agent builds the cracked program with c64-assembler: only the bytes of the CRACK ranges differ.
  const cracked = script("c64-assembler", "assemble.ts", ["--source-root", "src", "--entry", "main.asm", "--out", "build/cracked.prg", "--define", "CRACK=1", "--compare", "game.prg"]);
  assert.equal(cracked.status, 1, JSON.stringify(cracked.json));
  const [segment] = cracked.json.compare.segments as Array<{ differences: number; firstDifference: { address: string } }>;
  assert.deepEqual([segment!.differences, segment!.firstDifference.address], [8, "$100e"]);
  const built = readFileSync(join(project, "build", "cracked.prg"));
  assert.deepEqual([...built.subarray(2 + 0x0e, 2 + 0x11)], [0xea, 0xea, 0xea], "no JSR check");
  assert.deepEqual([...built.subarray(2 + 0x2a, 2 + 0x2d)], [0x60, 0xea, 0xea], "fail returns");
  const off = script("c64-assembler", "assemble.ts", ["--source-root", "src", "--entry", "main.asm", "--out", "build/game.prg", "--compare", "game.prg"]);
  assert.equal(off.json.compare.identical, true, "without a define, every switch is off");

  // The analyzer finds the set16 at $1017 and knows the two uses of inc16 in the knowledge.
  const analyzed = ok("c64-static-analysis", "analyze.ts", ["game.prg", "--entry", "$1000", "--macro-batch", ".c64-re-tools/local/macros.json"]);
  const macros = analyzed.idioms.candidates.macros;
  assert.deepEqual(macros.listed, [{ macro: "set16", start: "$1017", end: "$101e", args: ["ptr", "start"], text: "+set16 ptr, start" }]);
  assert.deepEqual([macros.known, macros.leftOut, macros.batch.writes], [2, undefined, 2], "the set16 macro and its use");
  ok("c64-knowledge", "knowledge.ts", ["apply", ".c64-re-tools/local/macros.json", "--image", "game.prg"]);
  const again = ok("c64-source", "generate.ts", ["game.prg", "--out", "src"]);
  assert.equal(again.check.identical, true);
  assert.equal(again.macroUses, 2);
  assert.match(readFileSync(join(project, "src", "segment_1000.asm"), "utf8"), /^ {8}\+set16 ptr, start$/m);
});
