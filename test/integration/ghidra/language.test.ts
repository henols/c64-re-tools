// Acceptance of the c64-re-tools NMOS 6510 Ghidra language (19 §10, 16 §9):
// it compiles, decodes all 105 undocumented opcodes with the right lengths,
// executes the deterministic ones correctly (decimal mode included), keeps the
// unstable ones opaque and stops flow at JAM. Skipped (never passed) without Ghidra.

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { Workspace } from "../../../src/native/staging.ts";
import { findGhidra, runHeadless, type GhidraInstallation } from "../../../src/native/ghidra/index.ts";

let ghidra: GhidraInstallation | undefined;
let skip: string | false = false;
try {
  ghidra = findGhidra();
} catch {
  skip = "Ghidra is not installed: set C64RT_GHIDRA to the Ghidra installation directory to run these tests";
}

interface Opcode {
  op: number;
  mnemonic?: string;
  length?: number;
  fallthrough?: boolean;
  flows?: number[];
  flowType?: string;
  pcode?: string[];
}

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
  { name: "JSR pushes the return address minus one", bytes: [0x20, 0x00, 0x40], registers: { SP: 0x01ff }, expect: { PC: 0x4000, SP: 0x01fd }, expectMemory: { 0x1ff: 0xc0, 0x1fe: 0x02 } },
  { name: "RTS adds one", bytes: [0x60], registers: { SP: 0x01fd }, memory: { 0x1fe: 0x02, 0x1ff: 0xc0 }, expect: { PC: 0xc003, SP: 0x01ff } },
];

let opcodes: Opcode[] = [];
let results: Array<Record<string, number> & { name: string; memory: Record<string, number> }> = [];
const supervisor = new ProcessSupervisor();
const workspace = Workspace.create();
after(() => workspace.remove());

before(async () => {
  if (ghidra === undefined) return;
  const image = Buffer.alloc(1024);
  for (let op = 0; op < 256; op++) image.set([op, 0x10, 0x20, 0x30], op * 4);
  workspace.materialize("input", [{ path: "opcodes.bin", size: image.length }], [image]);
  const cases = CASES.map((spec) => ({
    name: spec.name,
    bytes: spec.bytes,
    registers: spec.registers ?? {},
    memory: Object.fromEntries(Object.entries(spec.memory ?? {}).map(([address, value]) => [String(address), value])),
    read: Object.keys(spec.expectMemory ?? {}).map(Number),
  }));
  writeFileSync(workspace.path("cases.json"), JSON.stringify({ cases }));
  await runHeadless({
    ghidra,
    workspace,
    file: "input/opcodes.bin",
    baseAddress: 0x1000,
    scriptDirectories: [resolve(import.meta.dirname, "scripts")],
    postScripts: [{ name: "LanguageCheck.java", args: [workspace.path("cases.json"), workspace.path("out.json")] }],
    analyze: false,
    timeoutMs: 180_000,
    supervisor,
    signal: new AbortController().signal,
  });
  const output = JSON.parse(readFileSync(join(workspace.root, "out.json"), "utf8")) as { opcodes: Opcode[]; cases: typeof results };
  opcodes = output.opcodes;
  results = output.cases;
});

test("every opcode decodes with its NMOS length", { skip }, () => {
  assert.equal(opcodes.length, 256);
  const wrong = opcodes.filter((opcode) => opcode.length !== LENGTHS[opcode.op]).map((opcode) => `$${opcode.op.toString(16)}: ${opcode.mnemonic ?? "none"} ${opcode.length}`);
  assert.deepEqual(wrong, []);
});

test("the 105 undocumented opcodes decode as their instructions", { skip }, () => {
  const all = Object.values(UNDOCUMENTED).flat();
  assert.equal(all.length, 105);
  assert.equal(new Set(all).size, 105);
  const wrong = Object.entries(UNDOCUMENTED).flatMap(([mnemonic, ops]) =>
    ops.filter((op) => opcodes[op]?.mnemonic !== mnemonic).map((op) => `$${op.toString(16)}: ${opcodes[op]?.mnemonic} instead of ${mnemonic}`),
  );
  assert.deepEqual(wrong, []);
});

test("JAM stops flow: Ghidra sees a terminator with no fall-through", { skip }, () => {
  for (const op of UNDOCUMENTED.JAM!) {
    const opcode = opcodes[op]!;
    assert.equal(opcode.fallthrough, false, `$${op.toString(16)}`);
    assert.equal(opcode.flowType, "TERMINATOR", `$${op.toString(16)}`);
    assert.deepEqual(opcode.flows, [], `$${op.toString(16)}`);
  }
  assert.equal(opcodes[0xea]!.fallthrough, true);
  assert.equal(opcodes[0x60]!.flowType, "TERMINATOR", "RTS ends a routine the same way");
});

test("unstable instructions use opaque operations; deterministic ones do not", { skip }, () => {
  const opaque: Record<number, string> = { 0x8b: "ane", 0xab: "lxa", 0x93: "sha", 0x9f: "sha", 0x9e: "shx", 0x9c: "shy", 0x9b: "tas" };
  for (const [op, name] of Object.entries(opaque)) {
    assert.ok(opcodes[Number(op)]!.pcode!.includes(`CALLOTHER:${name}`), `$${Number(op).toString(16)} uses ${name}`);
  }
  for (const op of [...UNDOCUMENTED.SLO!, ...UNDOCUMENTED.RRA!, ...UNDOCUMENTED.ISC!, 0x6b, 0xcb, 0xbb]) {
    assert.ok(!opcodes[op]!.pcode!.some((name) => name.startsWith("CALLOTHER")), `$${op.toString(16)} has real p-code`);
  }
  // TAS also sets S = A AND X deterministically.
  assert.ok(opcodes[0x9b]!.pcode!.includes("INT_AND"));
});

for (const spec of CASES) {
  test(`p-code: ${spec.name}`, { skip }, () => {
    const result = results.find((candidate) => candidate.name === spec.name);
    assert.ok(result !== undefined, "the case ran");
    for (const [register, value] of Object.entries(spec.expect)) assert.equal(result[register], value, `${register} after ${spec.name}`);
    for (const [address, value] of Object.entries(spec.expectMemory ?? {})) assert.equal(result.memory[address], value, `memory ${address} after ${spec.name}`);
  });
}
