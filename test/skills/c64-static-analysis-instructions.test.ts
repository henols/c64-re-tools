// The structured instruction list (D44): Ghidra's decode with the mode, the
// operand in 6502 syntax, the target, and whether the coverage saw it run.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import { instructionList, modeOf } from "../../skills/c64-static-analysis/scripts/lib/instructions.ts";
import { vectoredPrg } from "../fixtures/prg/vectored.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-instructions-"));
after(() => rmSync(project, { recursive: true, force: true }));

test("the mode comes from Ghidra's operand text, the length, and the opcode where the text is the same", () => {
  // The operand texts as Ghidra 12.1.3 prints them with the c64-re-tools language.
  const cases: Array<[number, number, string, string]> = [
    [0xa9, 2, "#0x1", "immediate"],
    [0xa5, 2, "0x0010", "zeropage"],
    [0xb5, 2, "0x10,X", "zeropage,x"],
    [0xad, 3, "0xc000", "absolute"],
    [0xbd, 3, "0xc000,X", "absolute,x"],
    [0xb9, 3, "0xc000,Y", "absolute,y"],
    [0xa1, 2, "(0x10,X)", "(indirect,x)"],
    [0xb1, 2, "(0x10),Y", "(indirect),y"],
    [0x0a, 1, "A", "accumulator"],
    [0xd0, 2, "0x1018", "relative"],
    [0x20, 3, "0x1020", "absolute"],
    [0xb6, 2, "0x10,Y", "zeropage,y"],
    [0x6c, 3, "0x300", "(indirect)"],
    [0x60, 1, "", "implied"],
  ];
  for (const [opcode, length, operands, mode] of cases) assert.equal(modeOf(opcode, length, operands), mode, `${opcode.toString(16)} ${operands}`);
});

test("the list writes operands in 6502 syntax, the flow target, and executed from the coverage", () => {
  const coverage = new Uint8Array(0x10000);
  coverage[0x1000] = COVERAGE.ramExecute;
  const list = instructionList(
    [
      { address: 0x1000, bytes: "b110", mnemonic: "lda", operands: "(0x10),Y", flows: [] },
      { address: 0x1002, bytes: "d0fc", mnemonic: "bne", operands: "0x1000", flows: [0x1000] },
      { address: 0x1004, bytes: "6c0003", mnemonic: "jmp", operands: "0x300", flows: [] },
    ],
    coverage,
  );
  assert.deepEqual(list, [
    { address: "$1000", bytes: "b1 10", mnemonic: "lda", mode: "(indirect),y", operand: "($10),y", executed: true },
    { address: "$1002", bytes: "d0 fc", mnemonic: "bne", mode: "relative", operand: "$1000", target: "$1000", executed: false },
    { address: "$1004", bytes: "6c 00 03", mnemonic: "jmp", mode: "(indirect)", operand: "($0300)", executed: false },
  ]);
});

test("analyze --instructions writes Ghidra's instructions to a project file", { skip: process.env.C64RT_GHIDRA ? false : "set C64RT_GHIDRA to run Ghidra", timeout: 600_000 }, () => {
  writeFileSync(join(project, "vectored.prg"), vectoredPrg);
  const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/analyze.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "vectored.prg", "--entry", "$080d", "--instructions", "analysis/instructions.json"], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  const json = JSON.parse(run.stdout) as { instructions: { out: string; count: number } };
  assert.equal(json.instructions.out, "analysis/instructions.json", run.stdout);
  const list = JSON.parse(readFileSync(join(project, "analysis", "instructions.json"), "utf8")) as Array<{ address: string; mnemonic: string; mode: string; operand: string }>;
  assert.equal(list.length, json.instructions.count);
  // Ghidra follows LDA #$20 / STA $0300 / LDA #$08 / STA $0301 and finds the target of the indirect jump.
  assert.deepEqual(list.find((instruction) => instruction.address === "$0817"), { address: "$0817", bytes: "6c 00 03", mnemonic: "jmp", mode: "(indirect)", operand: "($0300)", target: "$0820" });
  assert.deepEqual(list.find((instruction) => instruction.address === "$080d"), { address: "$080d", bytes: "a9 20", mnemonic: "lda", mode: "immediate", operand: "#$20" });
});
