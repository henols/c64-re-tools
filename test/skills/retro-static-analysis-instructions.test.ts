// The structured instruction list: Ghidra's decode with the mode, the
// operand in 6502 syntax, the target, and whether the coverage saw it run.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/cpu/coverage.ts";
import { instructionList, modeOf } from "../../skills/retro-static-analysis/scripts/lib/instructions.ts";
import { vectoredPrg } from "../fixtures/prg/vectored.ts";
import { importPrg } from "../fixtures/program.ts";
import { readEnvelope } from "../kit.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-instructions-"));
after(() => rmSync(project, { recursive: true, force: true }));

test("the mode comes from the opcode", () => {
  const cases: Array<[number, string]> = [
    [0xa9, "immediate"],
    [0xa5, "zeropage"],
    [0xb5, "zeropage,x"],
    [0xad, "absolute"],
    [0xbd, "absolute,x"],
    [0xb9, "absolute,y"],
    [0xa1, "(indirect,x)"],
    [0xb1, "(indirect),y"],
    [0x0a, "accumulator"],
    [0xd0, "relative"],
    [0x20, "absolute"],
    [0xb6, "zeropage,y"],
    [0x6c, "(indirect)"],
    [0x60, "implied"],
    [0xb3, "(indirect),y"],
  ];
  for (const [opcode, mode] of cases) assert.equal(modeOf(opcode), mode, opcode.toString(16));
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

test("analyze --out-instructions writes Ghidra's instructions to a project file", { timeout: 120_000 }, () => {
  importPrg(project, vectoredPrg);
  const script = resolve(import.meta.dirname, "../../skills/retro-static-analysis/scripts/static-analysis.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "analyze", "--entry", "$080d", "--out-instructions", "analysis/instructions.json"], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  const json = readEnvelope(run.stdout, run.status).json as { instructions: { out: string; count: number } };
  assert.equal(json.instructions.out, "analysis/instructions.json", run.stdout);
  const list = JSON.parse(readFileSync(join(project, "analysis", "instructions.json"), "utf8")) as Array<{ address: string; mnemonic: string; mode: string; operand: string }>;
  assert.equal(list.length, json.instructions.count);
  // Ghidra follows LDA #$20 / STA $0300 / LDA #$08 / STA $0301 and finds the target of the indirect jump.
  assert.deepEqual(list.find((instruction) => instruction.address === "$0817"), { address: "$0817", bytes: "6c 00 03", mnemonic: "jmp", mode: "(indirect)", operand: "($0300)", target: "$0820" });
  assert.deepEqual(list.find((instruction) => instruction.address === "$080d"), { address: "$080d", bytes: "a9 20", mnemonic: "lda", mode: "immediate", operand: "#$20" });
});
