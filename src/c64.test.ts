import assert from "node:assert/strict";
import { test } from "node:test";

import { basicLineText, constantExpression, COVERAGE, executedRamCode, findHandoffs, formatC64Address, formatSprite, formatVicii, instructionLength, parseC64Address, parseTokenized, petsciiNameToText, textToPetscii, textToPetsciiName, type TokenizedLine, vicBankBase } from "./c64.ts";

test("C64 address primitives use canonical four-digit hexadecimal", () => {
  assert.equal(parseC64Address("$d020"), 0xd020);
  assert.equal(parseC64Address("$D020"), 0xd020);
  assert.equal(formatC64Address(0x2a), "$002a");
  assert.throws(() => parseC64Address("d020"));
  assert.throws(() => formatC64Address(0x10000));
});

test("text becomes the PETSCII the keyboard types", () => {
  assert.deepEqual([...textToPetscii("RUN\n")], [0x52, 0x55, 0x4e, 0x0d]);
  assert.deepEqual([...textToPetscii("run\r\n")], [0x52, 0x55, 0x4e, 0x0d]);
  assert.deepEqual([...textToPetscii('10 PRINT "HI";A$(1)')], [...Buffer.from('10 PRINT "HI";A$(1)', "latin1")]);
  assert.deepEqual([...textToPetscii("@[]£↑←")], [0x40, 0x5b, 0x5d, 0x5c, 0x5e, 0x5f]);
  assert.throws(() => textToPetscii("tab\there"), /\\t/);
  assert.throws(() => textToPetscii("{"), RangeError);
});

test("a PETSCII name shows as directory text and converts back to the same bytes", () => {
  const bytes = Uint8Array.from([0x47, 0x41, 0x4d, 0x45, 0x20, 0x31, 0x5c, 0x5e, 0x5f, 0xc1, 0x00, 0x7b]);
  const text = petsciiNameToText(bytes);
  assert.equal(text, "GAME 1£↑←{$c1}{$00}{$7b}");
  assert.deepEqual([...textToPetsciiName(text)], [...bytes]);
  assert.deepEqual([...textToPetsciiName("game")], [0x47, 0x41, 0x4d, 0x45], "either letter case is the unshifted letter");
  assert.deepEqual([...textToPetsciiName("{$A0}")], [0xa0]);
  assert.throws(() => textToPetsciiName("a{b"), RangeError);
  assert.throws(() => textToPetsciiName("é"), RangeError);
});

const SYS = 0x9e;
const USR = 0xb7;
const REM = 0x8f;
const DATA = 0x83;
const PRINT = 0x99;
const PEEK = 0xc2;
const PLUS = 0xaa;
const TIMES = 0xac;

/** Line bytes: strings are their ASCII (= PETSCII) codes, numbers are raw tokens. */
function bytes(...parts: Array<string | number>): Uint8Array {
  return Uint8Array.from(parts.flatMap((part) => (typeof part === "number" ? [part] : [...Buffer.from(part, "latin1")])));
}

/** A PRG at $0801 with correct links and an end marker, then `tail`. */
function program(lines: Array<[number, Uint8Array]>, tail: number[] = []): Uint8Array {
  const out: number[] = [0x01, 0x08];
  let address = 0x0801;
  for (const [number, tokens] of lines) {
    const next = address + 4 + tokens.length + 1;
    out.push(next & 0xff, next >> 8, number & 0xff, number >> 8, ...tokens, 0);
    address = next;
  }
  out.push(0, 0, ...tail);
  return Uint8Array.from(out);
}

const lines = (...entries: Array<[number, Uint8Array]>): TokenizedLine[] => entries.map(([number, tokens]) => ({ number, tokens }));

test("a tokenized program splits into lines and ends at the end marker", () => {
  const prg = program([[10, bytes(SYS, "2061")]], [0xee, 0x20, 0xd0]);
  const parsed = parseTokenized(prg);
  assert.ok(!("reason" in parsed));
  assert.equal(parsed.loadAddress, 0x0801);
  assert.equal(parsed.basicEnd, 0x080d, "the machine code after the marker starts here");
  assert.deepEqual(parsed.lines.map((line) => line.number), [10]);
});

test("bytes that are no BASIC program give a reason, not lines", () => {
  assert.match((parseTokenized(Uint8Array.from([1, 8])) as { reason: string }).reason, /too short/);
  assert.match((parseTokenized(Uint8Array.from([1, 8, 9, 8, 10, 0, 0x9e, 0x31])) as { reason: string }).reason, /no end/);
  assert.match((parseTokenized(Uint8Array.from([1, 8, 9, 8, 0xff, 0xff, 0x9e, 0])) as { reason: string }).reason, /above 63999/);
  const empty = parseTokenized(Uint8Array.from([1, 8, 0, 0]));
  assert.ok(!("reason" in empty) && empty.lines.length === 0, "an empty program is a program");
  // Machine code loaded at $c000 that starts LDA #$00 reads as an end marker before any line.
  const code = parseTokenized(Uint8Array.from([0x00, 0xc0, 0xa9, 0x00, 0x8d, 0x00, 0xc1]));
  assert.match((code as { reason: string }).reason, /no BASIC line/);
  const unterminated = parseTokenized(program([[10, bytes(SYS, "2061")]]).subarray(0, -2));
  assert.ok(!("reason" in unterminated) && unterminated.lines.length === 1, "a file may end right after its last line");
});

test("a memory dump is no BASIC program: a load address below $0400 or bytes past $ffff; odd links are BASIC still (F-12)", () => {
  // 64 KiB of RAM from $0000: the "load address" is the bytes at $0000-$0001.
  const dump = new Uint8Array(0x10000);
  dump.set([0x00, 0x00, 0x09, 0x00, 0xb1, 0x91, 0x3c, 0x22, 0x22, 0x00, 0x0e, 0x00]);
  assert.match((parseTokenized(dump) as { reason: string }).reason, /load address \$0000 is below \$0400/);
  assert.match((parseTokenized(Uint8Array.from([0xff, 0x03, 0, 0])) as { reason: string }).reason, /below \$0400/);
  // A dump in the CPU view starts with the processor port ($2f $37), a "load address" above $0400;
  // a started C64 holds the vectors $b1aa and $b391 at $0003, which read as line 37297 (b2/01, R3-02).
  for (const start of [[0x2f, 0x37], [0x00, 0x0b]]) {
    const started = new Uint8Array(0x10000);
    started.set([...start, 0xaa, 0xb1, 0x91, 0xb3, 0x3c, 0x22, 0x00, 0x00, 0x00]);
    assert.match((parseTokenized(started) as { reason: string }).reason, /runs past \$ffff/);
  }
  // A program that fills memory up to $ffff still fits.
  const full = new Uint8Array(2 + 0x10000 - 0xc000);
  full.set([0x00, 0xc0, 0x09, 0xc0, 0x0a, 0x00, 0x9e, 0x00, 0x00, 0x00]);
  assert.ok(!("reason" in parseTokenized(full)));
  // A crack can store an odd link to hide lines from LIST; BASIC relinks the program when it loads.
  const twoLines = program([[10, bytes(SYS, "2061")], [20, bytes(SYS, "2062")]]);
  twoLines[12]! ^= 0x01;
  assert.deepEqual((parseTokenized(twoLines) as { lines: Array<{ number: number }> }).lines.map((line) => line.number), [10, 20]);
  // A relocated program: every link points 0x0400 bytes higher, and the lines still split.
  const relocated = program([[10, bytes(SYS, "2061")], [20, bytes(SYS, "2062")], [30, bytes(SYS, "2063")]]);
  for (const at of [2, 2 + 10, 2 + 20]) relocated[at + 1]! += 0x04;
  const parsed = parseTokenized(relocated);
  assert.ok(!("reason" in parsed), JSON.stringify(parsed));
  assert.deepEqual(parsed.lines.map((line) => line.number), [10, 20, 30]);
});

test("a file that ends right after its last line has the same basicEnd as one with the end marker", () => {
  const marked = parseTokenized(program([[10, bytes(SYS, "2061")]]));
  const unmarked = parseTokenized(program([[10, bytes(SYS, "2061")]]).subarray(0, -2));
  assert.ok(!("reason" in marked) && !("reason" in unmarked));
  assert.equal(marked.basicEnd, 0x080d);
  assert.equal(unmarked.basicEnd, 0x080d);
});

test("a constant SYS expression is evaluated; anything else is not", () => {
  assert.equal(constantExpression(bytes(" 2061")), 2061);
  assert.equal(constantExpression(bytes("4096", TIMES, "2", PLUS, "13")), 8205);
  assert.equal(constantExpression(bytes("(", "2061", ")")), 2061);
  assert.equal(constantExpression(bytes("20 61")), 2061, "BASIC ignores spaces in numbers");
  assert.equal(constantExpression(bytes(0xab, "1")), -1);
  assert.equal(constantExpression(bytes(PEEK, "(43)")), undefined);
  assert.equal(constantExpression(bytes("A")), undefined);
  assert.equal(constantExpression(bytes("")), undefined);
  assert.equal(constantExpression(bytes("(2061")), undefined);
  // BASIC stops at the first byte that is no operator (real releases: "SYS2073 TCS-CRUNCH!", "SYS 2161  SSG").
  assert.equal(constantExpression(bytes("2073 TCS", 0xab, "CRUNCH!")), 2073);
  assert.equal(constantExpression(bytes(" 2161  SSG")), 2161);
  // A number with an exponent is read as BASIC reads it.
  assert.equal(constantExpression(bytes("2E3")), 2000);
  assert.equal(constantExpression(bytes("2 E 3")), 2000);
  assert.equal(constantExpression(bytes("49E", PLUS, "3")), 49000);
  assert.equal(constantExpression(bytes("2E", 0xab, "1", PLUS, "1")), 1.2);
  assert.equal(constantExpression(bytes("2E-1")), 0.2);
  assert.equal(constantExpression(bytes("2061E")), 2061);
  assert.equal(constantExpression(bytes("2E3", TIMES, "2")), 4000);
  // An operator that the evaluator does not handle makes the value depend on run time.
  assert.equal(constantExpression(bytes("2061", 0xaf, "255")), undefined, "AND");
  assert.equal(constantExpression(bytes("2061", 0xb2, "X")), undefined, "a comparison");
  assert.equal(constantExpression(bytes("2061", PLUS, "X")), undefined);
});

test("handoffs come from SYS and USR in program text only", () => {
  const found = findHandoffs(
    lines(
      [10, bytes(PRINT, '"', SYS, '"', ":", SYS, "2061")],
      [20, bytes(SYS, "4096", TIMES, "2", PLUS, "13", ",1,2")],
      [30, bytes("X", 0xb2, USR, "(5)")],
      [40, bytes(REM, " ", SYS, "1234")],
      [50, bytes(DATA, " ", SYS, ",1:", SYS, "49152")],
      [60, bytes(SYS, PEEK, "(43)", PLUS, "256", TIMES, PEEK, "(44)")],
      [70, bytes(SYS, "70000")],
      [80, bytes(SYS, "4.9152E4")],
    ),
  );
  assert.deepEqual(found, [
    { kind: "sys", line: 10, address: 2061 },
    { kind: "sys", line: 20, address: 8205 },
    { kind: "usr", line: 30, computed: true },
    { kind: "sys", line: 50, address: 49152 },
    { kind: "sys", line: 60, computed: true, expression: "PEEK(43)+256*PEEK(44)" },
    { kind: "sys", line: 80, address: 49152 },
  ]);
});

// A cracked game's start line: 1993 SYS π*656, then machine code right after
// the line's zero byte, with no 00 00 end marker (the "link" is LDY #$00).
const PI_START = Uint8Array.from([0x01, 0x08, 0x0c, 0x08, 0xc9, 0x07, 0x9e, 0xff, 0xac, 0x36, 0x35, 0x36, 0x00, 0xa0, 0x00, 0x78, 0x60]);

test("a SYS with π hands over to its truncated value, and BASIC ends where the code after the line starts", () => {
  const parsed = parseTokenized(PI_START);
  assert.ok(!("reason" in parsed));
  assert.equal(parsed.basicEnd, 0x080c, "BASIC ends at the link whose high byte is zero, where LDY #$00 starts");
  assert.equal(parsed.textBytes, 13);
  assert.equal(basicLineText(parsed.lines[0]!), "1993 SYSπ*656");
  assert.deepEqual(findHandoffs(parsed.lines), [{ kind: "sys", line: 1993, address: 0x080c }]);
});

test("the VIC-II bank comes from CIA 2 port A, inverted, with undriven lines high", () => {
  assert.equal(vicBankBase(0x97, 0x3f), 0x0000); // KERNAL default: lines %11 -> bank 0
  assert.equal(vicBankBase(0x96, 0x3f), 0x4000);
  assert.equal(vicBankBase(0x94, 0x3f), 0xc000);
  assert.equal(vicBankBase(0x00, 0x00), 0x0000, "no driven lines read high");
});

test("the instruction length of all 256 opcodes, as VICE's disassembler gives them", () => {
  // Row n is the opcodes $n0 to $nf. Checked against VICE 3.9 for every opcode (D40).
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

test("a BASIC line reads as text: keywords for tokens, quotes and REM as they are", () => {
  const line = (bytes: number[]) => basicLineText({ number: 10, tokens: Uint8Array.from(bytes) });
  assert.equal(line([0x9e, 0x32, 0x30, 0x36, 0x31]), "10 SYS2061");
  // PRINT "GOTO" with the GOTO bytes inside quotes stays text.
  assert.equal(line([0x99, 0x22, 0x47, 0x4f, 0x54, 0x4f, 0x22]), '10 PRINT"GOTO"');
  assert.equal(line([0x8f, 0x20, 0x89, 0x41]), "10 REM {$89}A", "after REM a token byte is no keyword");
  assert.equal(line([0x97, 0x35, 0x33, 0x32, 0x38, 0x30, 0x2c, 0x30]), "10 POKE53280,0");
});

test("VIC-II and sprite state give addresses as $xxxx and keep the chip values as numbers", () => {
  assert.deepEqual(formatVicii({ rasterLine: 100, screenAddress: 0x0400, graphicsAddress: 0x1000, borderColor: 14 }), {
    rasterLine: 100,
    screenAddress: "$0400",
    graphicsAddress: "$1000",
    borderColor: 14,
  });
  assert.deepEqual(formatSprite({ index: 2, x: 24, dataAddress: 0x2000 }), { index: 2, x: 24, dataAddress: "$2000" });
});
