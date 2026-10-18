import assert from "node:assert/strict";
import { test } from "node:test";

import { accessedValue, instructionText } from "./opcodes.ts";

test("the byte of an access: a store gives its register, a load the register after it, else the memory", () => {
  const before = { a: 0x1b, x: 0x02, y: 0x03 };
  const after = { a: 0x40, x: 0x41, y: 0x42 };
  assert.equal(accessedValue(0x8d, before, after, 0x9b), 0x1b, "STA abs gives A, not the byte read back");
  assert.equal(accessedValue(0x8e, before, after, undefined), 0x02, "STX");
  assert.equal(accessedValue(0x8c, before, after, undefined), 0x03, "STY");
  assert.equal(accessedValue(0xad, before, after, undefined), 0x40, "LDA abs gives A after it");
  assert.equal(accessedValue(0xee, before, after, 0x10), 0x10, "INC gives the memory now");
  assert.equal(accessedValue(0xee, before, after, undefined), undefined, "INC on I/O is not known");
});

test("instruction text has the monitor form: the mnemonic and the index register in capitals", () => {
  assert.equal(instructionText([0x8d, 0x11, 0xd0], 0xc000), "STA $d011");
  assert.equal(instructionText([0xb1, 0xc1], 0xc000), "LDA ($c1),Y");
  assert.equal(instructionText([0xbd, 0x00, 0xd0], 0xc000), "LDA $d000,X");
});
