import assert from "node:assert/strict";
import { test } from "node:test";

import { operandIsAddress, Z80 } from "./z80.ts";

/** Decodes bytes placed at `at` (default $8000). */
function decode(bytes: number[], at = 0x8000) {
  return Z80.decode((address) => (address >= at && address < at + bytes.length ? bytes[address - at] : undefined), at);
}

test("the Z80 decoder gives the length and text of each prefix group", () => {
  const cases: Array<[number[], number, string]> = [
    [[0x00], 1, "nop"],
    [[0x3e, 0xfe], 2, "ld a,$fe"],
    [[0x21, 0x00, 0x90], 3, "ld hl,$9000"],
    [[0x32, 0x34, 0x12], 3, "ld ($1234),a"],
    [[0x2a, 0x34, 0x12], 3, "ld hl,($1234)"],
    [[0x34], 1, "inc (hl)"],
    [[0x36, 0x07], 2, "ld (hl),$07"],
    [[0x7e], 1, "ld a,(hl)"],
    [[0x76], 1, "halt"],
    [[0x86], 1, "add a,(hl)"],
    [[0x96], 1, "sub (hl)"],
    [[0xdb, 0xfe], 2, "in a,($fe)"],
    [[0xd3, 0xfe], 2, "out ($fe),a"],
    [[0xe3], 1, "ex (sp),hl"],
    [[0x08], 1, "ex af,af'"],
    [[0xf5], 1, "push af"],
    [[0xc5], 1, "push bc"],
    [[0xff], 1, "rst $38"],
    // CB
    [[0xcb, 0x07], 2, "rlc a"],
    [[0xcb, 0x36], 2, "sll (hl)"],
    [[0xcb, 0x46], 2, "bit 0,(hl)"],
    [[0xcb, 0xfe], 2, "set 7,(hl)"],
    // ED
    [[0xed, 0x78], 2, "in a,(c)"],
    [[0xed, 0x70], 2, "in (c)"],
    [[0xed, 0x71], 2, "out (c),0"],
    [[0xed, 0x56], 2, "im 1"],
    [[0xed, 0x5e], 2, "im 2"],
    [[0xed, 0x43, 0x00, 0x90], 4, "ld ($9000),bc"],
    [[0xed, 0x7b, 0x00, 0x90], 4, "ld sp,($9000)"],
    [[0xed, 0x42], 2, "sbc hl,bc"],
    [[0xed, 0x4a], 2, "adc hl,bc"],
    [[0xed, 0xb0], 2, "ldir"],
    [[0xed, 0xbb], 2, "otdr"],
    [[0xed, 0x00], 2, "nop"],
    [[0xed, 0x77], 2, "nop"],
    // DD / FD
    [[0xdd, 0x21, 0x00, 0x90], 4, "ld ix,$9000"],
    [[0xfd, 0x21, 0x3a, 0x5c], 4, "ld iy,$5c3a"],
    [[0xdd, 0x34, 0x01], 3, "inc (ix+$01)"],
    [[0xfd, 0x35, 0xff], 3, "dec (iy-$01)"],
    [[0xdd, 0x36, 0x02, 0x55], 4, "ld (ix+$02),$55"],
    [[0xdd, 0x66, 0x03], 3, "ld h,(ix+$03)"],
    [[0xdd, 0x74, 0x03], 3, "ld (ix+$03),h"],
    [[0xdd, 0x7c], 2, "ld a,ixh"],
    [[0xfd, 0x65], 2, "ld iyh,iyl"],
    [[0xdd, 0x09], 2, "add ix,bc"],
    [[0xdd, 0x29], 2, "add ix,ix"],
    [[0xdd, 0xe9], 2, "jp (ix)"],
    [[0xdd, 0xe3], 2, "ex (sp),ix"],
    [[0xdd, 0xe5], 2, "push ix"],
    [[0xdd, 0x86, 0x80], 3, "add a,(ix-$80)"],
    [[0xdd, 0xdd], 1, "nop"],
    // DD CB d op / FD CB d op
    [[0xdd, 0xcb, 0x01, 0x46], 4, "bit 0,(ix+$01)"],
    [[0xdd, 0xcb, 0x01, 0x06], 4, "rlc (ix+$01)"],
    [[0xdd, 0xcb, 0x01, 0x00], 4, "rlc (ix+$01),b"],
    [[0xfd, 0xcb, 0x02, 0xc6], 4, "set 0,(iy+$02)"],
    [[0xfd, 0xcb, 0x02, 0x87], 4, "res 0,(iy+$02),a"],
    [[0xfd, 0xcb, 0x02, 0x36], 4, "sll (iy+$02)"],
  ];
  for (const [bytes, length, text] of cases) {
    const instruction = decode(bytes)!;
    assert.deepEqual([instruction.length, instruction.text], [length, text], bytes.map((b) => b.toString(16)).join(" "));
  }
});

test("the Z80 decoder gives the flow: jumps, branches, calls and returns", () => {
  assert.deepEqual(decode([0xc3, 0x0b, 0x80]), { length: 3, fallsThrough: false, call: false, jump: 0x800b, operand: { offset: 1, size: 2 }, text: "jp $800b" });
  assert.deepEqual(decode([0x18, 0xfe]), { length: 2, fallsThrough: false, call: false, jump: 0x8000, operand: { offset: 1, size: 1, relative: true }, text: "jr $8000" });
  assert.deepEqual(decode([0x38, 0x03], 0x8010), { length: 2, fallsThrough: true, call: false, branch: 0x8015, operand: { offset: 1, size: 1, relative: true }, text: "jr c,$8015" });
  assert.deepEqual(decode([0x10, 0xfe]), { length: 2, fallsThrough: true, call: false, branch: 0x8000, operand: { offset: 1, size: 1, relative: true }, text: "djnz $8000" });
  assert.deepEqual(decode([0xca, 0x00, 0x90]), { length: 3, fallsThrough: true, call: false, branch: 0x9000, operand: { offset: 1, size: 2 }, text: "jp z,$9000" });
  assert.deepEqual(decode([0xcd, 0x30, 0x80]), { length: 3, fallsThrough: true, call: true, callTarget: 0x8030, operand: { offset: 1, size: 2 }, text: "call $8030" });
  assert.deepEqual(decode([0xcc, 0x30, 0x80]), { length: 3, fallsThrough: true, call: true, callTarget: 0x8030, operand: { offset: 1, size: 2 }, text: "call z,$8030" });
  assert.deepEqual(decode([0xd7]), { length: 1, fallsThrough: true, call: true, callTarget: 0x10, text: "rst $10" });
  assert.equal(decode([0xc9])!.fallsThrough, false);
  assert.equal(decode([0xc8])!.fallsThrough, true);
  assert.equal(decode([0xe9])!.fallsThrough, false);
  assert.equal(decode([0xed, 0x4d])!.fallsThrough, false);
  assert.equal(decode([0xed, 0x45])!.text, "retn");
});

test("an operand outside the image keeps the length and drops the text and the targets", () => {
  assert.deepEqual(decode([0xc3, 0x00]), { length: 3, fallsThrough: false, call: false, operand: { offset: 1, size: 2 } });
  assert.equal(Z80.decode(() => undefined, 0), undefined);
});

test("every opcode of every prefix decodes to 1 to 4 bytes with text", () => {
  for (const prefix of [[], [0xcb], [0xed], [0xdd], [0xfd], [0xdd, 0xcb, 0x05], [0xfd, 0xcb, 0x05]]) {
    for (let opcode = 0; opcode < 0x100; opcode++) {
      const instruction = decode([...prefix, opcode, 0x12, 0x34, 0x56])!;
      assert.ok(instruction.length >= 1 && instruction.length <= Z80.maxInstructionLength);
      assert.ok(instruction.text !== undefined && instruction.text !== "" && !instruction.text.includes("undefined"), `${prefix} ${opcode}: ${instruction.text}`);
    }
  }
});

test("the operand of an instruction is after its opcode, its DD or FD prefix and its displacement", () => {
  const operand = (bytes: number[]) => decode(bytes)!.operand;
  assert.deepEqual(operand([0x3e, 0x05]), { offset: 1, size: 1 });
  assert.deepEqual(operand([0x21, 0x00, 0x90]), { offset: 1, size: 2 });
  assert.deepEqual(operand([0x32, 0x00, 0x90]), { offset: 1, size: 2 });
  assert.deepEqual(operand([0xdd, 0x21, 0x00, 0x90]), { offset: 2, size: 2 });
  assert.deepEqual(operand([0xdd, 0x36, 0x02, 0x55]), { offset: 3, size: 1 });
  assert.deepEqual(operand([0xed, 0x43, 0x00, 0x90]), { offset: 2, size: 2 });
  assert.equal(operand([0x7e]), undefined);
  assert.equal(operand([0xdd, 0x34, 0x01]), undefined, "a displacement alone is no operand value");
  assert.equal(operand([0xcd, 0x30, 0x80]) !== undefined && operand([0xff]) === undefined, true, "RST has no operand byte");
});

test("Z80 mnemonics, registers and conditions are no labels", () => {
  assert.ok(["ld", "jp", "hl", "ix", "a", "nz", "pe"].every((word) => Z80.reserved.has(word)));
  assert.ok(!Z80.reserved.has("main") && !Z80.reserved.has("lda"));
});

test("a 16-bit operand is an address for a jump, a branch, a call or a memory access, and an immediate value is not", () => {
  const at = (bytes: number[]) => Z80.decode((address) => bytes[address - 0x8000], 0x8000)!;
  // jp $028e ; call nz,$028e ; ld hl,($5c3d) ; ld ($5c3d),hl ; ld hl,$0000 ; ld de,$0020
  const cases: Array<[number[], boolean]> = [
    [[0xc3, 0x8e, 0x02], true],
    [[0xc4, 0x8e, 0x02], true],
    [[0x2a, 0x3d, 0x5c], true],
    [[0x22, 0x3d, 0x5c], true],
    [[0x21, 0x00, 0x00], false],
    [[0x11, 0x20, 0x00], false],
  ];
  for (const [bytes, address] of cases) assert.equal(operandIsAddress(at(bytes)), address, at(bytes).text);
});
