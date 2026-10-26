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
    const written = writeZ80(original);
    const again = readZ80(written);
    assert.deepEqual(again.registers, original.registers, model);
    // Byte 37 bit 2 tells a reader that the AY is in use: always on a 128K.
    assert.equal(written[37]! & 4, model === "128k" ? 4 : 0, model);
    assert.deepEqual([again.model, again.border, again.port7ffd], [model, 5, original.port7ffd]);
    for (const bank of usedBanks(original)) assert.deepEqual(again.banks[bank], original.banks[bank], `${model} bank ${bank}`);
    if (model === "128k") assert.deepEqual(again.ay, original.ay);
  }
});

test("a .z80 gives the model of its hardware mode in each version, and refuses a machine that is no 48K or 128K", () => {
  const v3 = writeZ80(snapshot("128k"));
  // The same snapshot as a version 2 file: 23 bytes of extra header, and the +2 (12), a mode of other emulators.
  const v2 = Uint8Array.from([...v3.subarray(0, 30), 23, 0, ...v3.subarray(32, 55), ...v3.subarray(86)]);
  v2[34] = 12;
  const plus2 = readZ80(v2);
  assert.deepEqual([plus2.model, plus2.port7ffd, plus2.registers.pc], ["128k", 0x13, 0x8000]);
  for (const bank of usedBanks(plus2)) assert.deepEqual(plus2.banks[bank], snapshot("128k").banks[bank], `bank ${bank}`);
  // Mode 3: a 128K in version 2, a 48K with an MGT interface in version 3.
  v2[34] = 3;
  assert.equal(readZ80(v2).model, "128k");
  const pentagon = Uint8Array.from(v3);
  pentagon[34] = 9;
  assert.throws(() => readZ80(pentagon), (error: Refusal) => error instanceof Refusal && /for a Pentagon 128K, not for a ZX Spectrum 48K or 128K/.test(error.message));
  pentagon[34] = 200;
  assert.throws(() => readZ80(pentagon), /hardware mode 200/);
});

test("version 2/3 .z80 files reject missing, duplicated and truncated RAM pages", () => {
  for (const model of ["48k", "128k"] as const) {
    const full = writeZ80(snapshot(model));
    const header = full.subarray(0, 86);
    assert.throws(() => readZ80(header), /missing RAM banks/, model);
    const firstLength = full[86]! | (full[87]! << 8);
    const firstPageEnd = 86 + 3 + (firstLength === 0xffff ? 0x4000 : firstLength);
    assert.throws(() => readZ80(full.subarray(0, firstPageEnd)), /missing RAM banks/, model);
    assert.throws(() => readZ80(Uint8Array.from([...full, ...full.subarray(86, firstPageEnd)])), /occurs more than once/, model);
    assert.throws(() => readZ80(full.subarray(0, full.length - 1)), /truncated|gives [0-9]+ bytes/, model);
    assert.throws(() => readZ80(Uint8Array.from([...full, 0xff])), /incomplete header/, model);
  }
});

test("a written .z80 marks $0000-$3fff as ROM and gives the T-state counter of the first t-state of the frame", () => {
  for (const [model, low] of [["48k", 17_471], ["128k", 17_726]] as const) {
    const written = writeZ80(snapshot(model));
    assert.deepEqual([written[61], written[62]], [0xff, 0xff], model);
    // The high counter is 3 just after the interrupt; the low counter counts down from a quarter frame less 1.
    assert.deepEqual([written[55]! | (written[56]! << 8), written[57]], [low, 3], model);
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

test("a 48K .sna refuses a stack pointer outside RAM, and a 128K .sna a length that does not match its paged bank", () => {
  const sna48 = writeSna(snapshot("48k"));
  for (const sp of [0x0000, 0x3fff, 0xffff]) {
    const bytes = Uint8Array.from(sna48);
    bytes[23] = sp & 0xff;
    bytes[24] = sp >> 8;
    assert.throws(() => readSna(bytes), /stack pointer \$[0-9a-f]+ is not in RAM/, `sp $${sp.toString(16)}`);
  }
  const sna128 = writeSna(snapshot("128k"));
  const paged = sna128[27 + 0xc000 + 2]! & 7;
  assert.ok(paged !== 2 && paged !== 5, "the fixture pages a bank other than 2 or 5");
  assert.throws(() => readSna(Uint8Array.from([...sna128, ...new Uint8Array(0x4000)])), /has 131103 bytes, not 147487/);
  const pagedFive = Uint8Array.from([...sna128, ...new Uint8Array(0x4000)]);
  pagedFive[27 + 0xc000 + 2] = (pagedFive[27 + 0xc000 + 2]! & ~7) | 5;
  assert.equal(readSna(pagedFive).port7ffd & 7, 5);
  assert.throws(() => readSna(Uint8Array.from(sna128).map((byte, at) => (at === 27 + 0xc000 + 2 ? (byte & ~7) | 2 : byte))), /has 147487 bytes, not 131103/);
});

test("a .z80 of a 16K is refused by name, and a block that ends inside a run says so", () => {
  const v3 = writeZ80(snapshot("48k"));
  const sixteen = Uint8Array.from(v3);
  sixteen[37] = 0x80;
  assert.throws(() => readZ80(sixteen), /ZX Spectrum 16K/);
  // A version 1 file whose compressed body ends after "ed ed".
  const v1 = Uint8Array.from(v3.subarray(0, 30));
  v1[6] = 0x00;
  v1[7] = 0x80;
  v1[12] = 0x20;
  assert.throws(() => readZ80(Uint8Array.from([...v1, 0xed, 0xed])), /ends inside a run of equal bytes/);
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
  // A pure-data block has no ROM framing that the tape tells: all its bytes, and no flag and no checksum.
  assert.deepEqual([[...blocks[4]!.bytes!], blocks[4]!.flag, blocks[4]!.checksumOk], [data, undefined, undefined]);
  assert.throws(() => readTzx(tzx.subarray(0, tzx.length - 2)), Refusal);
  assert.throws(() => readTzx(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), Refusal);
});

test("a TZX file steps over a custom info block, an emulation info block and a snapshot block by their own layouts", () => {
  const signature = [...[..."ZXTape!"].map((char) => char.charCodeAt(0)), 0x1a, 1, 20];
  const customInfo = [0x35, ...[..."POKEs".padEnd(16, " ")].map((char) => char.charCodeAt(0)), 3, 0, 0, 0, 1, 2, 3];
  const emulationInfo = [0x34, 0, 0, 0, 0, 0, 0, 0, 0];
  const snapshotBlock = [0x40, 0, 2, 0, 0, 9, 9];
  const description = [0x30, 2, 0x68, 0x69];
  const tzx = Uint8Array.from([...signature, ...customInfo, ...emulationInfo, ...snapshotBlock, ...description]);
  const blocks = readTzx(tzx);
  assert.deepEqual(blocks.map((item) => item.id), [0x35, 0x34, 0x40, 0x30]);
  assert.equal(blocks[3]!.text, "hi");
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

test("a POKE of the error return that ERR_SP points to is a handoff with the word that the program copies there", () => {
  const float = (value: number) => {
    const exponent = Math.floor(Math.log2(value)) + 1;
    const mantissa = Math.round((value / 2 ** exponent) * 2 ** 32);
    return [exponent + 128, (mantissa >>> 24) & 0x7f, (mantissa >>> 16) & 0xff, (mantissa >>> 8) & 0xff, mantissa & 0xff];
  };
  // A number in the text with another hidden value, after {INK 7}, as the loader of Bruce Lee keeps it.
  const hiddenBehind = (digits: string, value: number) => [0x10, 7, ...text(digits), 0x0e, ...float(value)];
  // ( PEEK 23633{=23613.1}+256* PEEK 23634{=23614.2})
  const errorReturn = [0x28, 0xbe, ...hiddenBehind("23633", 23613.1), 0x2b, ...literal("256"), 0x2a, 0xbe, ...hiddenBehind("23634", 23614.2), 0x29];
  const program = Uint8Array.from([
    // 10 POKE (PEEK 23613+256*PEEK 23614), PEEK 23627: POKE (PEEK 23613+256*PEEK 23614)+1, PEEK 23628
    ...basicLine(10, [0xf4, ...errorReturn, 0x2c, 0xbe, ...hiddenBehind("23647", 23627.3), 0x3a, 0xf4, ...errorReturn, 0x2b, ...literal("1"), 0x2c, 0xbe, ...hiddenBehind("23648", 23628.3)]),
  ]);
  const parsed = parseSinclairBasic(program);
  assert.ok("lines" in parsed, JSON.stringify(parsed));
  // The program copies VARS ($5c4b) into the error return.
  assert.deepEqual(findSinclairHandoffs(parsed.lines), [{ kind: "err-sp", line: 10, from: 0x5c4b }]);
  // Two numbers give the address itself, over two lines: 20 POKE (...), 0 / 30 POKE (...)+1, 96.
  const constant = parseSinclairBasic(Uint8Array.from([
    ...basicLine(20, [0xf4, ...errorReturn, 0x2c, ...literal("0")]),
    ...basicLine(30, [0xf4, ...errorReturn, 0x2b, ...literal("1"), 0x2c, ...literal("96")]),
  ]));
  assert.ok("lines" in constant);
  assert.deepEqual(findSinclairHandoffs(constant.lines), [{ kind: "err-sp", line: 20, address: 0x6000 }]);
  // A value that the BASIC calculates from a variable gives only the line.
  const variable = parseSinclairBasic(Uint8Array.from(basicLine(40, [0xf4, ...errorReturn, 0x2c, 0x61])));
  assert.ok("lines" in variable);
  assert.deepEqual(findSinclairHandoffs(variable.lines), [{ kind: "err-sp", line: 40 }]);
  // A POKE of another address that the program reads with PEEK is no handoff: PEEK 23641+256*PEEK 23642 is E_LINE.
  const other = parseSinclairBasic(Uint8Array.from(basicLine(50, [0xf4, 0x28, 0xbe, ...literal("23641"), 0x2b, ...literal("256"), 0x2a, 0xbe, ...literal("23642"), 0x29, 0x2c, ...literal("0")])));
  assert.ok("lines" in other);
  assert.deepEqual(findSinclairHandoffs(other.lines), []);
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
