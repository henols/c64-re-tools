import assert from "node:assert/strict";
import { test } from "node:test";

import { WireFailure } from "../../protocol.ts";
import { constantExpression, findHandoffs, parseListing, parseTokenized, type TokenizedLine } from "./petcat.ts";

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
  const unterminated = parseTokenized(program([[10, bytes(SYS, "2061")]]).subarray(0, -2));
  assert.ok(!("reason" in unterminated) && unterminated.lines.length === 1, "a file may end right after its last line");
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
    ),
  );
  assert.deepEqual(found, [
    { kind: "sys", line: 10, address: 2061 },
    { kind: "sys", line: 20, address: 8205 },
    { kind: "usr", line: 30, computed: true },
    { kind: "sys", line: 50, address: 49152 },
    { kind: "sys", line: 60, computed: true },
  ]);
});

test("petcat's listing lines become number and text", () => {
  assert.deepEqual(parseListing("   10 sys2061\n   20 print\"{clr}hi\"\n\n"), [
    { number: 10, text: "sys2061" },
    { number: 20, text: 'print"{clr}hi"' },
  ]);
  assert.throws(() => parseListing("-{$e9}{blu};_"), (error: unknown) => error instanceof WireFailure && error.code === "operation-failed");
});
