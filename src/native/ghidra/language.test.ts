// The c64-re-tools NMOS 6510 Ghidra language:
// it decodes all 105 undocumented opcodes with the right lengths, executes
// the deterministic ones correctly in p-code (decimal mode included), keeps
// the unstable ones opaque and stops flow at JAM.

import assert from "node:assert/strict";
import { test } from "node:test";

import { PcodeState } from "./pcode.ts";
import { walk } from "./walk.ts";
import { decode, loadImage, type Decoded } from "./wasm.ts";

interface Case {
  name: string;
  bytes: number[];
  registers?: Record<string, number>;
  memory?: Record<number, number>;
  expect: Record<string, number>;
  expectMemory?: Record<number, number>;
}

/** Instruction lengths of all 256 NMOS opcodes, one row of 16 per high nibble. */
const ROW_A = [1, 2, 1, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3];
const ROW_B = [2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3];
const ROW_C = [2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3];
const LENGTHS = [ROW_A, ROW_B, [3, ...ROW_A.slice(1)], ROW_B, ROW_A, ROW_B, ROW_A, ROW_B, ROW_C, ROW_B, ROW_C, ROW_B, ROW_C, ROW_B, ROW_C, ROW_B].flat();

const UNDOCUMENTED: Record<string, number[]> = {
  SLO: [0x03, 0x07, 0x0f, 0x13, 0x17, 0x1b, 0x1f],
  RLA: [0x23, 0x27, 0x2f, 0x33, 0x37, 0x3b, 0x3f],
  SRE: [0x43, 0x47, 0x4f, 0x53, 0x57, 0x5b, 0x5f],
  RRA: [0x63, 0x67, 0x6f, 0x73, 0x77, 0x7b, 0x7f],
  SAX: [0x83, 0x87, 0x8f, 0x97],
  LAX: [0xa3, 0xa7, 0xaf, 0xb3, 0xb7, 0xbf],
  DCP: [0xc3, 0xc7, 0xcf, 0xd3, 0xd7, 0xdb, 0xdf],
  ISC: [0xe3, 0xe7, 0xef, 0xf3, 0xf7, 0xfb, 0xff],
  ANC: [0x0b, 0x2b],
  ALR: [0x4b],
  ARR: [0x6b],
  ANE: [0x8b],
  LXA: [0xab],
  SBX: [0xcb],
  USBC: [0xeb],
  SHA: [0x93, 0x9f],
  TAS: [0x9b],
  SHY: [0x9c],
  SHX: [0x9e],
  LAS: [0xbb],
  NOP: [0x1a, 0x3a, 0x5a, 0x7a, 0xda, 0xfa, 0x80, 0x82, 0x89, 0xc2, 0xe2, 0x04, 0x44, 0x64, 0x14, 0x34, 0x54, 0x74, 0xd4, 0xf4, 0x0c, 0x1c, 0x3c, 0x5c, 0x7c, 0xdc, 0xfc],
  JAM: [0x02, 0x12, 0x22, 0x32, 0x42, 0x52, 0x62, 0x72, 0x92, 0xb2, 0xd2, 0xf2],
};

const CASES: Case[] = [
  { name: "SLO zp: ASL memory, ORA", bytes: [0x07, 0x80], registers: { A: 0x01 }, memory: { 0x80: 0x81 }, expect: { A: 0x03, C: 1, N: 0, Z: 0 }, expectMemory: { 0x80: 0x02 } },
  { name: "RLA zp: ROL memory, AND", bytes: [0x27, 0x80], registers: { A: 0xff, C: 1 }, memory: { 0x80: 0x40 }, expect: { A: 0x81, C: 0, N: 1 }, expectMemory: { 0x80: 0x81 } },
  { name: "SRE zp: LSR memory, EOR", bytes: [0x47, 0x80], registers: { A: 0xff }, memory: { 0x80: 0x03 }, expect: { A: 0xfe, C: 1, N: 1 }, expectMemory: { 0x80: 0x01 } },
  { name: "RRA zp binary: ROR memory, ADC", bytes: [0x67, 0x80], registers: { A: 0x10 }, memory: { 0x80: 0x03 }, expect: { A: 0x12, C: 0, V: 0 }, expectMemory: { 0x80: 0x01 } },
  { name: "RRA zp decimal", bytes: [0x67, 0x80], registers: { A: 0x19, D: 1 }, memory: { 0x80: 0x02 }, expect: { A: 0x20, C: 0 }, expectMemory: { 0x80: 0x01 } },
  { name: "SAX zp: store A AND X, flags kept", bytes: [0x87, 0x80], registers: { A: 0xf0, X: 0x3c, Z: 1 }, expect: { Z: 1, N: 0 }, expectMemory: { 0x80: 0x30 } },
  { name: "LAX zp: load A and X", bytes: [0xa7, 0x80], memory: { 0x80: 0x80 }, expect: { A: 0x80, X: 0x80, N: 1, Z: 0 } },
  { name: "LAX zp,Y", bytes: [0xb7, 0x80], registers: { Y: 2 }, memory: { 0x82: 0x05 }, expect: { A: 0x05, X: 0x05 } },
  { name: "DCP zp: DEC memory, CMP", bytes: [0xc7, 0x80], registers: { A: 0x10 }, memory: { 0x80: 0x11 }, expect: { Z: 1, C: 1, N: 0, A: 0x10 }, expectMemory: { 0x80: 0x10 } },
  { name: "ISC zp binary: INC memory, SBC", bytes: [0xe7, 0x80], registers: { A: 0x10, C: 1 }, memory: { 0x80: 0x04 }, expect: { A: 0x0b, C: 1 }, expectMemory: { 0x80: 0x05 } },
  { name: "ISC zp decimal", bytes: [0xe7, 0x80], registers: { A: 0x10, C: 1, D: 1 }, memory: { 0x80: 0x04 }, expect: { A: 0x05, C: 1 }, expectMemory: { 0x80: 0x05 } },
  { name: "ANC #: AND, C = N", bytes: [0x0b, 0x81], registers: { A: 0xff }, expect: { A: 0x81, N: 1, C: 1 } },
  { name: "ALR #: AND, LSR", bytes: [0x4b, 0x03], registers: { A: 0xff }, expect: { A: 0x01, C: 1, N: 0 } },
  { name: "ARR # binary", bytes: [0x6b, 0xff], registers: { A: 0xc0, C: 1 }, expect: { A: 0xe0, N: 1, C: 1, V: 0 } },
  { name: "ARR # decimal", bytes: [0x6b, 0xff], registers: { A: 0xff, D: 1 }, expect: { A: 0xd5, N: 0, Z: 0, V: 0, C: 1 } },
  { name: "SBX #: X = (A AND X) - operand", bytes: [0xcb, 0x01], registers: { A: 0xf0, X: 0x3c }, expect: { X: 0x2f, C: 1, A: 0xf0 } },
  { name: "USBC # is SBC #", bytes: [0xeb, 0x01], registers: { A: 0x10, C: 1 }, expect: { A: 0x0f, C: 1 } },
  { name: "LAS abs,Y", bytes: [0xbb, 0x00, 0x30], registers: { Y: 1, SP: 0x01f0 }, memory: { 0x3001: 0x3f }, expect: { A: 0x30, X: 0x30, SP: 0x0130 } },
  { name: "ADC binary overflow", bytes: [0x69, 0x01], registers: { A: 0x7f }, expect: { A: 0x80, V: 1, N: 1, C: 0 } },
  { name: "ADC decimal 58+46+1", bytes: [0x69, 0x46], registers: { A: 0x58, C: 1, D: 1 }, expect: { A: 0x05, C: 1 } },
  { name: "ADC decimal 99+01: NMOS flags", bytes: [0x69, 0x01], registers: { A: 0x99, D: 1 }, expect: { A: 0x00, C: 1, N: 1, Z: 0, V: 0 } },
  { name: "SBC decimal 40-13", bytes: [0xe9, 0x13], registers: { A: 0x40, C: 1, D: 1 }, expect: { A: 0x27, C: 1 } },
  { name: "SBC binary borrow", bytes: [0xe9, 0x01], registers: { A: 0x00, C: 1 }, expect: { A: 0xff, C: 0, N: 1 } },
  { name: "JMP ($30ff) wraps in its page", bytes: [0x6c, 0xff, 0x30], memory: { 0x30ff: 0x00, 0x3000: 0x40, 0x3100: 0x50 }, expect: { PC: 0x4000 } },
  { name: "LDA ($ff),Y takes the high byte from $00", bytes: [0xb1, 0xff], registers: { Y: 1 }, memory: { 0xff: 0x00, 0x00: 0x30, 0x100: 0x99, 0x3001: 0x42 }, expect: { A: 0x42 } },
  { name: "LDA ($fe,X) with X=1 takes the pointer from $ff and $00", bytes: [0xa1, 0xfe], registers: { X: 1 }, memory: { 0xff: 0x00, 0x00: 0x30, 0x100: 0x99, 0x3000: 0x42 }, expect: { A: 0x42 } },
  { name: "JSR pushes the return address minus one", bytes: [0x20, 0x00, 0x40], registers: { SP: 0x01ff }, expect: { PC: 0x4000, SP: 0x01fd }, expectMemory: { 0x1ff: 0xc0, 0x1fe: 0x02 } },
  { name: "RTS adds one", bytes: [0x60], registers: { SP: 0x01fd }, memory: { 0x1fe: 0x02, 0x1ff: 0xc0 }, expect: { PC: 0xc003, SP: 0x01ff } },
];

/** The register varnodes of the language (c64rt_6510.slaspec). */
const REGISTERS: Record<string, { offset: number; size: number }> = {
  A: { offset: 0x00, size: 1 },
  X: { offset: 0x01, size: 1 },
  Y: { offset: 0x02, size: 1 },
  SP: { offset: 0x22, size: 2 },
  N: { offset: 0x30, size: 1 },
  V: { offset: 0x31, size: 1 },
  D: { offset: 0x33, size: 1 },
  I: { offset: 0x34, size: 1 },
  Z: { offset: 0x35, size: 1 },
  C: { offset: 0x36, size: 1 },
};

const image = new Uint8Array(1024);
for (let op = 0; op < 256; op++) image.set([op, 0x10, 0x20, 0x30], op * 4);
loadImage(image, 0x1000);
const opcodes: Decoded[] = Array.from({ length: 256 }, (_, op) => decode(0x1000 + op * 4));

test("every opcode decodes with its NMOS length", () => {
  const wrong = opcodes.flatMap((opcode, op) => (opcode.length === LENGTHS[op] ? [] : [`$${op.toString(16)}: ${opcode.mnemonic} ${opcode.length}`]));
  assert.deepEqual(wrong, []);
});

test("the 105 undocumented opcodes decode as their instructions", () => {
  const all = Object.values(UNDOCUMENTED).flat();
  assert.equal(all.length, 105);
  assert.equal(new Set(all).size, 105);
  const wrong = Object.entries(UNDOCUMENTED).flatMap(([mnemonic, ops]) =>
    ops.filter((op) => opcodes[op]?.mnemonic !== mnemonic).map((op) => `$${op.toString(16)}: ${opcodes[op]?.mnemonic} instead of ${mnemonic}`),
  );
  assert.deepEqual(wrong, []);
});

/** The instructions that the analysis decodes from one entry: the instruction there, then four NOPs. */
function flowFrom(op: number): Array<{ address: number; flows: number[] }> {
  const code = Uint8Array.from([op, 0xea, 0xea, 0xea, 0xea]);
  loadImage(code, 0x2000);
  return walk(code, 0x2000, 0x2004, { entryPoints: [0x2000], codeStarts: [], dataRanges: [], labels: [] }).instructions;
}

test("JAM stops flow: the analysis decodes nothing after it", () => {
  for (const op of UNDOCUMENTED.JAM!) {
    assert.deepEqual(flowFrom(op).map((instruction) => [instruction.address, instruction.flows]), [[0x2000, []]], `$${op.toString(16)}`);
  }
  assert.equal(flowFrom(0xea).length, 5, "NOP falls through");
  assert.equal(flowFrom(0x60).length, 1, "RTS ends a routine the same way");
});

test("unstable instructions use opaque operations; deterministic ones do not", () => {
  const userops = (op: number) => opcodes[op]!.pcode.filter((operation) => operation.op === "CALLOTHER").map((operation) => operation.userop);
  const opaque: Record<number, string> = { 0x8b: "ane", 0xab: "lxa", 0x93: "sha", 0x9f: "sha", 0x9e: "shx", 0x9c: "shy", 0x9b: "tas" };
  for (const [op, name] of Object.entries(opaque)) {
    assert.ok(userops(Number(op)).includes(name), `$${Number(op).toString(16)} uses ${name}`);
  }
  for (const op of [...UNDOCUMENTED.SLO!, ...UNDOCUMENTED.RRA!, ...UNDOCUMENTED.ISC!, 0x6b, 0xcb, 0xbb]) {
    assert.deepEqual(userops(op), [], `$${op.toString(16)} has real p-code`);
  }
  // TAS also sets S = A AND X deterministically.
  assert.ok(opcodes[0x9b]!.pcode.some((operation) => operation.op === "INT_AND"));
});

for (const spec of CASES) {
  test(`p-code: ${spec.name}`, () => {
    const pc = 0xc000;
    loadImage(Uint8Array.from(spec.bytes), pc);
    const instruction = decode(pc);
    const memory = new Map(Object.entries(spec.memory ?? {}).map(([address, value]) => [Number(address), value]));
    spec.bytes.forEach((byte, index) => memory.set(pc + index, byte));
    // Memory that the case does not set reads as 0.
    const state = new PcodeState((address) => memory.get(address) ?? 0);
    for (const [name, register] of Object.entries(REGISTERS)) {
      state.set({ space: "register", ...register }, spec.registers?.[name] ?? (name === "SP" ? 0x01ff : 0));
    }
    const exit = state.run(instruction.pcode);
    const next = exit.kind === "fall" ? pc + instruction.length : exit.kind === "stop" ? undefined : exit.next;
    for (const [name, value] of Object.entries(spec.expect)) {
      const actual = name === "PC" ? next : state.get({ space: "register", ...REGISTERS[name]! });
      assert.equal(actual, value, `${name} after ${spec.name}`);
    }
    for (const [address, value] of Object.entries(spec.expectMemory ?? {})) {
      assert.equal(state.get({ space: "ram", offset: Number(address), size: 1 }), value, `memory ${address} after ${spec.name}`);
    }
  });
}
