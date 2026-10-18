import assert from "node:assert/strict";
import { test } from "node:test";

import { instructionLength } from "../c64.ts";
import { instructionText } from "../opcodes.ts";
import { MOS6502 } from "./mos6502.ts";

test("the 6502 Cpu gives the length and text of src/c64.ts and src/opcodes.ts for all 256 opcodes", () => {
  for (let opcode = 0; opcode < 0x100; opcode++) {
    const bytes = [opcode, 0x34, 0x12];
    const instruction = MOS6502.decode((address) => bytes[address - 0xc000], 0xc000)!;
    assert.equal(instruction.length, instructionLength(opcode));
    assert.equal(instruction.text, instructionText(bytes.slice(0, instructionLength(opcode)), 0xc000));
  }
});

test("the 6502 Cpu gives the flow of BRK, RTI, RTS, JMP, JSR and the branches", () => {
  const at = (bytes: number[]) => MOS6502.decode((address) => bytes[address - 0xc000], 0xc000)!;
  for (const opcode of [0x00, 0x40, 0x4c, 0x60, 0x6c]) assert.equal(at([opcode, 0, 0]).fallsThrough, false);
  assert.deepEqual([at([0x20, 0x00, 0xd0]).call, at([0x20, 0x00, 0xd0]).callTarget], [true, 0xd000]);
  assert.equal(at([0x4c, 0x00, 0xc1]).jump, 0xc100);
  assert.equal(at([0xd0, 0xfe]).branch, 0xc000);
  assert.equal(at([0xd0]).branch, undefined);
});
