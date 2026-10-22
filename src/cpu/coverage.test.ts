import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE, executedRamCode } from "./coverage.ts";
import { instructionLength } from "./mos6502.ts";

test("the instruction length of all 256 opcodes, as VICE's disassembler gives them", () => {
  // Row n is the opcodes $n0 to $nf. Checked against VICE 3.9 for every opcode.
  const table = [
    "1212222212123333",
    "2212222213133333",
    "3212222212123333",
    "2212222213133333",
    "1212222212123333",
    "2212222213133333",
    "1212222212123333",
    "2212222213133333",
    "2222222212123333",
    "2212222213133333",
    "2222222212123333",
    "2212222213133333",
    "2222222212123333",
    "2212222213133333",
    "2222222212123333",
    "2212222213133333",
  ].join("");
  for (let opcode = 0; opcode < 256; opcode++) assert.equal(instructionLength(opcode), Number(table[opcode]), `$${opcode.toString(16)}`);
});

test("executed code in RAM is each instruction start with its operand bytes, merged", () => {
  const memory = new Uint8Array(0x10000);
  // $c000 LDA #$01 ; $c002 STA $d020 ; $c005 JMP $c000, and an instruction start in ROM at $e000.
  memory.set([0xa9, 0x01, 0x8d, 0x20, 0xd0, 0x4c, 0x00, 0xc0], 0xc000);
  const map = new Uint8Array(0x10000);
  for (const start of [0xc000, 0xc002, 0xc005]) map[start] = COVERAGE.ramExecute | COVERAGE.ramRead;
  map[0xe000] = COVERAGE.romExecute;
  assert.deepEqual(executedRamCode(map, 0, memory), [{ start: 0xc000, end: 0xc007 }]);
  assert.deepEqual(executedRamCode(map.subarray(0xc002), 0xc002, memory), [{ start: 0xc002, end: 0xc007 }], "a map that starts later keeps its addresses");
});
