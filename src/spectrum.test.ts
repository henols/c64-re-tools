import assert from "node:assert/strict";
import { test } from "node:test";

import { Refusal } from "./errors.ts";
import { cpuRam, findSinclairHandoffs, parseSinclairBasic, readSna, readTap, readTzx, readZ80, sinclairLineText, sinclairNumber, writeSna, writeZ80, type SpectrumSnapshot } from "./spectrum.ts";

function snapshot(model: "48k" | "128k"): SpectrumSnapshot {
  const banks = Array.from({ length: 8 }, (_, bank) => Uint8Array.from({ length: 0x4000 }, (_, offset) => (offset * 7 + bank * 31) & 0xff));
  // Runs and $ed bytes test the compression.
  banks[0]!.fill(0, 0, 300);
  banks[2]!.set([0xed, 0xed, 0xed, 0x00, 0xed, 0x01, 0xed], 100);
  return {
    model,
    registers: { af: 0x1234, bc: 0x5678, de: 0x9abc, hl: 0xdef0, af2: 0x1111, bc2: 0x2222, de2: 0x3344, hl2: 0x5566, ix: 0x7788, iy: 0x5c3a, sp: 0xff00, pc: 0x8000, i: 0x3f, r: 0x85, iff1: true, iff2: true, im: 1 },
    border: 5,
    port7ffd: model === "128k" ? 0x13 : 0,
    banks,
    ...(model === "128k" ? { ay: { registers: Array.from({ length: 16 }, (_, index) => index * 3), selected: 7 } } : {}),
  };
}

const usedBanks = (value: SpectrumSnapshot) => (value.model === "48k" ? [5, 2, 0] : [0, 1, 2, 3, 4, 5, 6, 7]);

test("a version 3 .z80 keeps every register, the border, the paging and the RAM of the 48K and the 128K", () => {
  for (const model of ["48k", "128k"] as const) {
    const original = snapshot(model);
    const again = readZ80(writeZ80(original));
    assert.deepEqual(again.registers, original.registers, model);
    assert.deepEqual([again.model, again.border, again.port7ffd], [model, 5, original.port7ffd]);
    for (const bank of usedBanks(original)) assert.deepEqual(again.banks[bank], original.banks[bank], `${model} bank ${bank}`);
    if (model === "128k") assert.deepEqual(again.ay, original.ay);
  }
});

test("a version 1 .z80 without compression gives its PC, its stack and its code at $8000", () => {
  // The 30-byte header: PC $8000, SP $ff00, IY $5c3a, IM 1, border 7, then 48 KiB of RAM from $4000.
  const head = new Uint8Array(30);
  head.set([0x00, 0x80], 6);
  head.set([0x00, 0xff], 8);
  head[12] = 7 << 1;
  head.set([0x3a, 0x5c], 23);
  head[29] = 1;
  const ram = new Uint8Array(0xc000);
  ram.set([0xf3, 0x31, 0xf0, 0x8f], 0x4000);
  const read = readZ80(Uint8Array.from([...head, ...ram]));
  assert.deepEqual([read.model, read.registers.pc, read.registers.sp, read.registers.iy, read.registers.im, read.border], ["48k", 0x8000, 0xff00, 0x5c3a, 1, 7]);
  assert.deepEqual([...cpuRam(read).subarray(0x4000, 0x4004)], [0xf3, 0x31, 0xf0, 0x8f], "DI ; LD SP,$8FF0 at $8000");
});

test("a .sna keeps the registers and the RAM; the 48K form keeps the PC on the stack", () => {
  for (const model of ["48k", "128k"] as const) {
    const original = snapshot(model);
    const bytes = writeSna(original);
    assert.equal(bytes.length, model === "48k" ? 49179 : 131103);
    const again = readSna(bytes);
    assert.deepEqual([again.registers.pc, again.registers.sp, again.registers.ix, again.registers.im], [0x8000, 0xff00, 0x7788, 1], model);
    for (const bank of usedBanks(original)) {
      if (model === "48k" && bank === 0) continue;
      assert.deepEqual(again.banks[bank], original.banks[bank], `${model} bank ${bank}`);
    }
  }
  assert.throws(() => readSna(new Uint8Array(100)), Refusal);
});

/** A ROM tape block: flag, data, and the checksum that makes the XOR of all of them 0. */
function block(flag: number, data: number[]): number[] {
  const checksum = data.reduce((xor, byte) => xor ^ byte, flag);
  return [flag, ...data, checksum];
}

const name = (text: string) => [...text.padEnd(10, " ")].map((char) => char.charCodeAt(0));
const header = block(0x00, [3, ...name("game"), 6, 0, 0x00, 0x80, 0x00, 0x80]);
const data = block(0xff, [1, 2, 3, 4, 5, 6]);

test("a TAP file gives its blocks with the header of each ROM header block and the checksum", () => {
  const tap = Uint8Array.from([header.length, 0, ...header, data.length, 0, ...data]);
  const [first, second] = readTap(tap);
  assert.deepEqual(first!.header, { type: "code", name: "game", length: 6, param1: 0x8000, param2: 0x8000 });
  assert.deepEqual([second!.flag, second!.checksumOk, second!.bytes!.length], [0xff, true, 8]);
  const broken = Uint8Array.from(tap);
  broken[broken.length - 1]! ^= 1;
  assert.equal(readTap(broken)[1]!.checksumOk, false);
  assert.throws(() => readTap(tap.subarray(0, tap.length - 1)), Refusal);
});

test("a TZX file gives its data blocks, turbo and pure data too, and the text of a description", () => {
  const text = [...("A loader").split("").map((char) => char.charCodeAt(0))];
  const turbo = block(0xff, [9, 9, 9]);
  const tzx = Uint8Array.from([
    ...[..."ZXTape!"].map((char) => char.charCodeAt(0)), 0x1a, 1, 20,
    0x30, text.length, ...text,
    0x10, 0xe8, 0x03, header.length, 0, ...header,
    0x11, ...new Array(15).fill(0), turbo.length, 0, 0, ...turbo,
    0x20, 0xe8, 0x03,
    0x14, ...new Array(7).fill(0), data.length, 0, 0, ...data,
  ]);
  const blocks = readTzx(tzx);
  assert.deepEqual(blocks.map((item) => [item.kind, item.id]), [["other", 0x30], ["standard", 0x10], ["turbo", 0x11], ["other", 0x20], ["pure-data", 0x14]]);
  assert.equal(blocks[0]!.text, "A loader");
  assert.equal(blocks[1]!.header?.name, "game");
  assert.deepEqual([...blocks[2]!.bytes!], turbo);
  assert.throws(() => readTzx(tzx.subarray(0, tzx.length - 2)), Refusal);
  assert.throws(() => readTzx(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), Refusal);
});

/** A program line as the ROM keeps it: number (high byte first), length, bytes, ENTER. */
function basicLine(number: number, bytes: number[]): number[] {
  const size = bytes.length + 1;
  return [number >> 8, number & 0xff, size & 0xff, size >> 8, ...bytes, 0x0d];
}
const text = (value: string) => [...value].map((char) => char.charCodeAt(0));
/** A number in the text: its digits and the hidden 5-byte small integer form of `hidden`. */
const literal = (digits: string, hidden = Number(digits)) => [...text(digits), 0x0e, 0, 0, hidden & 0xff, hidden >> 8, 0];

test("a Sinclair BASIC program lists with its keywords, and the handoffs come from the hidden numbers", () => {
  const program = Uint8Array.from([
    // 10 CLEAR 24999: LOAD "" CODE : RANDOMIZE USR 25000
    ...basicLine(10, [0xfd, ...literal("24999"), 0x3a, 0xef, 0x22, 0x22, 0xaf, 0x3a, 0xf9, 0xc0, ...literal("25000")]),
    // 20 RANDOMIZE USR 0, with 32768 hidden behind the 0
    ...basicLine(20, [0xf9, 0xc0, ...literal("0", 32768)]),
    // 30 RANDOMIZE USR VAL "23760": LOAD "" SCREEN$
    ...basicLine(30, [0xf9, 0xc0, 0xb0, ...text('"23760"'), 0x3a, 0xef, 0x22, 0x22, 0xaa]),
    // 40 PRINT {INK 2}{AT 3,4}"£{UDG A}": REM, then machine code: $0e and 5 bytes, and $c9
    ...basicLine(40, [0xf5, 0x10, 2, 0x16, 3, 4, 0x22, 0x60, 0x90, 0x22, 0x3a, 0xea, 0x0e, 1, 2, 3, 4, 5, 0xc9]),
    // the variables: A = 1
    0x61, 0, 0, 1, 0, 0, 0x80,
  ]);
  const parsed = parseSinclairBasic(program);
  assert.ok("lines" in parsed, JSON.stringify(parsed));
  assert.equal(parsed.variablesAt, program.length - 7);
  assert.deepEqual(
    parsed.lines.map((line) => sinclairLineText(line)),
    [
      '10 CLEAR 24999: LOAD "" CODE : RANDOMIZE USR 25000',
      "20 RANDOMIZE USR 0{=32768}",
      '30 RANDOMIZE USR VAL "23760": LOAD "" SCREEN$',
      // LIST prints tokens in REM too: $c9 is <>.
      '40 PRINT {INK 2}{AT 3,4}"£{UDG A}": REM <>',
    ],
  );
  assert.deepEqual(findSinclairHandoffs(parsed.lines), [
    { kind: "clear", line: 10, address: 24999 },
    { kind: "load-code", line: 10 },
    { kind: "usr", line: 10, address: 25000 },
    { kind: "usr", line: 20, address: 32768 },
    { kind: "usr", line: 30, address: 23760 },
    { kind: "load-screen", line: 30 },
  ]);
});

test("the tokens $a3 and $a4 are SPECTRUM and PLAY on the 128K and the graphics T and U on the 48K", () => {
  const parsed = parseSinclairBasic(Uint8Array.from(basicLine(1, [0xa4, 0x22, 0x22])));
  assert.ok("lines" in parsed);
  assert.equal(sinclairLineText(parsed.lines[0]!, "128k"), '1 PLAY ""');
  assert.equal(sinclairLineText(parsed.lines[0]!, "48k"), '1 {UDG U}""');
});

test("a hidden number shows as PRINT shows it, and a POKE of ERR_SP is a handoff", () => {
  // 10 POKE 23633{=23613.1},PEEK 23641{=23641.1}: the loader of Bruce Lee puts the address of its code into the error return.
  const float = (value: number) => {
    const exponent = Math.floor(Math.log2(value)) + 1;
    const mantissa = Math.round((value / 2 ** exponent) * 2 ** 32);
    return [exponent + 128, (mantissa >>> 24) & 0x7f, (mantissa >>> 16) & 0xff, (mantissa >>> 8) & 0xff, mantissa & 0xff];
  };
  const program = Uint8Array.from(basicLine(10, [0xf4, ...text("23633"), 0x0e, ...float(23613.1), 0x2c, 0xbe, ...text("23641"), 0x0e, ...float(23641.1)]));
  const parsed = parseSinclairBasic(program);
  assert.ok("lines" in parsed, JSON.stringify(parsed));
  assert.equal(sinclairLineText(parsed.lines[0]!), "10 POKE 23633{=23613.1}, PEEK 23641{=23641.1}");
  assert.deepEqual(findSinclairHandoffs(parsed.lines), [{ kind: "err-sp", line: 10 }]);
});

test("the 5-byte numbers: the small integer form and the floating point form", () => {
  assert.equal(sinclairNumber(Uint8Array.of(0, 0, 0x39, 0x30, 0)), 12345);
  assert.equal(sinclairNumber(Uint8Array.of(0, 0xff, 0xff, 0xff, 0)), -1);
  assert.equal(sinclairNumber(Uint8Array.of(0x80, 0, 0, 0, 0)), 0.5);
  assert.equal(sinclairNumber(Uint8Array.of(0x81, 0x80, 0, 0, 0)), -1);
  assert.equal(sinclairNumber(Uint8Array.of(0x91, 0, 0, 0, 0)), 65536);
});

test("bytes that are no program are refused with the reason", () => {
  assert.match((parseSinclairBasic(Uint8Array.of(0x27, 0x10, 2, 0, 0xf5, 0x0d)) as { reason: string }).reason, /Line number 10000 is above 9999/);
  assert.match((parseSinclairBasic(Uint8Array.of(0, 10, 9, 0, 0xf5, 0x0d)) as { reason: string }).reason, /Line 10 has 9 bytes/);
  assert.match((parseSinclairBasic(Uint8Array.of(0x61, 0, 0)) as { reason: string }).reason, /no BASIC line/);
});
