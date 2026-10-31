// The facts of a range where code and data disagree: the access of the runs,
// the references into it, and the static flow from executed code.

import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import { flowFromExecuted, rangeFacts } from "../../skills/c64-static-analysis/scripts/lib/triage.ts";

/** 64 KiB with code placed at addresses, the program from $1000 to $10ff and $1100-$1101. */
function program(parts: Record<number, number[]>) {
  const memory = new Uint8Array(0x10000);
  for (const [address, bytes] of Object.entries(parts)) memory.set(bytes, Number(address));
  return { memory, inImage: (address: number) => address >= 0x1000 && address <= 0x1101 };
}

const { memory, inImage } = program({
  // $1000 LDA $02 / BEQ $1008 (not taken) / JMP ($1100), all executed; the vector bytes give $1020.
  0x1000: [0xa5, 0x02, 0xf0, 0x04, 0x6c, 0x00, 0x11],
  // $1008 INC $d020 / JMP $1050: only the branch that no run took goes here.
  0x1008: [0xee, 0x20, 0xd0, 0x4c, 0x50, 0x10],
  0x1020: [0x4c, 0x70, 0x10],
  0x1030: [0x60],
  // $1050 JMP $1060 in data of the LLM.
  0x1050: [0x4c, 0x60, 0x10],
  0x1060: [0x60],
  0x1070: [0x60],
  0x1100: [0x20, 0x10],
});
const coverage = new Uint8Array(0x10000);
coverage[0x1000] = coverage[0x1002] = coverage[0x1004] = COVERAGE.ramExecute;
const isData = (address: number) => address >= 0x1050 && address <= 0x1052;

test("static flow from executed code takes the branches that no run took and ends in data of the user or the LLM", () => {
  // The LLM resolved the JMP ($1100) to $1030; the decompiler reference to $1020 from the vector bytes is no flow.
  const resolved = flowFromExecuted({
    memory,
    inImage,
    coverage,
    isData,
    removedReference: () => false,
    references: [
      { from: 0x1004, to: 0x1030, kind: "jump", origin: "llm" },
      { from: 0x1004, to: 0x1020, kind: "jump", origin: "decompiler" },
    ],
  });
  assert.deepEqual([0x1008, 0x100b, 0x1030, 0x1050, 0x1060, 0x1020, 0x1070].map((address) => resolved.has(address)), [true, true, true, true, false, false, false]);
  // Without a reference of the LLM, the vector bytes give $1020; a reference that the LLM removed is no flow.
  const fromBytes = flowFromExecuted({ memory, inImage, coverage, isData, removedReference: () => false, references: [] });
  assert.deepEqual([fromBytes.has(0x1020), fromBytes.has(0x1070)], [true, true]);
  const removed = flowFromExecuted({ memory, inImage, coverage, isData, references: [], removedReference: (reference) => reference.from === 0x1004 && reference.to === 0x1020 });
  assert.deepEqual([removed.has(0x1020), removed.has(0x1070)], [false, false]);
});

test("the facts of a range count the access of the runs and give each reference into it from outside once", () => {
  const map = new Uint8Array(0x10000);
  map[0x2000] = COVERAGE.ramExecute;
  map[0x2001] = map[0x2002] = COVERAGE.ramRead | COVERAGE.ramWrite;
  map[0x2003] = COVERAGE.ramRead;
  const references = [
    { from: 0x3000, to: 0x2001, kind: "read" as const },
    { from: 0x3000, to: 0x2002, kind: "read" as const },
    { from: 0x2000, to: 0x2003, kind: "jump" as const },
    { from: 0x1000, to: 0x2000, kind: "call" as const },
  ];
  const facts = rangeFacts(map, references, new Set([0x2000]))({ start: 0x2000, end: 0x2003 });
  assert.deepEqual(facts, {
    references: [{ from: 0x1000, kind: "call" }, { from: 0x3000, kind: "read" }],
    access: { executed: 1, read: 3, written: 2 },
    reachable: true,
  });
  // Without coverage, only the references.
  assert.deepEqual(rangeFacts(undefined, references, undefined)({ start: 0x2004, end: 0x2005 }), { references: [] });
});
