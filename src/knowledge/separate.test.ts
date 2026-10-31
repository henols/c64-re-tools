import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "../c64.ts";
import { computedFlows, separate } from "./separate.ts";

/** A chain of `count` routines of JSR next / RTS from $1000: each one calls the next. */
function chain(count: number) {
  const memory = new Uint8Array(0x10000);
  const codeRegions: Array<{ start: number; end: number; type: string }> = [];
  const references: Array<{ from: number; to: number; kind: string }> = [];
  for (let index = 0; index < count; index++) {
    const at = 0x1000 + index * 4;
    memory.set([0x20, (at + 4) & 0xff, (at + 4) >> 8, 0x60], at);
    codeRegions.push({ start: at, end: at + 3, type: "code" });
    if (index + 1 < count) references.push({ from: at, to: at + 4, kind: "call" });
  }
  return { memory, codeRegions, references, segments: [{ start: 0x1000, end: 0x1000 + count * 4 - 1 }] };
}

test("a root of the input reaches code that the entry does not reach", () => {
  const input = chain(3);
  input.references = [];
  const plain = separate({ ...input, entry: 0x1000 });
  assert.deepEqual(plain.codeRegions.map((region) => region.reachable), [true, false, false]);
  const rooted = separate({ ...input, entry: 0x1000, roots: [{ address: 0x1008, from: "executed code" }] });
  assert.deepEqual(rooted.codeRegions.map((region) => region.reachable), [true, false, true]);
  assert.deepEqual(rooted.roots.at(-1), { address: 0x1008, from: "executed code" });
});

test("5000 regions in a call chain are all reached in less than a second", () => {
  const input = chain(5000);
  const started = performance.now();
  const found = separate({ ...input, entry: 0x1000 });
  assert.ok(performance.now() - started < 1000, `it took ${performance.now() - started} ms`);
  assert.ok(found.codeRegions.every((region) => region.reachable === true));
});

test("a computed flow is unresolved when a run wrote its vector or its address; a jump or call reference of the LLM resolves it, a read reference does not", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([0x6c, 0x10, 0x20, 0x4c, 0x00, 0x30], 0x2000); // JMP ($2010) / JMP $3000
  memory.set([0x00, 0x30], 0x2010);
  const inImage = (address: number) => address >= 0x2000 && address <= 0x2011;
  const flows = (more: Partial<Parameters<typeof computedFlows>[0]> = {}) => computedFlows({ starts: [0x2000, 0x2003], memory, inImage, references: [], ...more });
  assert.deepEqual(flows(), { targets: [{ from: 0x2000, to: 0x3000 }], unresolved: [] }, "without coverage, a vector in the image holds its target");
  const coverage = new Uint8Array(0x10000);
  coverage[0x2010] = COVERAGE.ramWrite;
  coverage[0x2004] = COVERAGE.ramWrite;
  assert.deepEqual(flows({ coverage }).unresolved, [
    { at: 0x2000, kind: "indirect-jump" },
    { at: 0x2003, kind: "written-operand" },
  ]);
  assert.deepEqual(flows({ coverage, references: [{ from: 0x2000, kind: "jump", origin: "llm" }, { from: 0x2003, kind: "call", origin: "user" }] }).unresolved, []);
  const noTargets = [{ from: 0x2000, kind: "read", origin: "llm" }, { from: 0x2003, kind: "jump", origin: "decompiler" }];
  assert.deepEqual(flows({ coverage, references: noTargets }).unresolved.map((flow) => flow.at), [0x2000, 0x2003], "a read reference and an analyzer reference give no targets");
  assert.deepEqual(flows({ starts: [0x2000], inImage: () => false }).unresolved, [{ at: 0x2000, kind: "indirect-jump" }], "a vector outside the image");
});

test("the code's own immediates set a vector and give its targets, unless another write of the code changes it", () => {
  const memory = new Uint8Array(0x10000);
  // $2000 LDA #$34 / STA $fb / LDA #$12 / STA $fc / JMP ($00fb)
  memory.set([0xa9, 0x34, 0x85, 0xfb, 0xa9, 0x12, 0x85, 0xfc, 0x6c, 0xfb, 0x00], 0x2000);
  const starts = [0x2000, 0x2002, 0x2004, 0x2006, 0x2008];
  const inImage = (address: number) => address >= 0x2000 && address <= 0x203f;
  const coverage = new Uint8Array(0x10000);
  coverage[0xfb] = COVERAGE.ramWrite;
  coverage[0xfc] = COVERAGE.ramWrite;
  assert.deepEqual(computedFlows({ starts, memory, inImage, coverage, references: [] }), { targets: [{ from: 0x2008, to: 0x1234 }], unresolved: [] });
  // $2010 LDA $2020,X / STA $fb / RTS: a dispatch from a table writes the same vector.
  memory.set([0xbd, 0x20, 0x20, 0x85, 0xfb, 0x60], 0x2010);
  assert.deepEqual(computedFlows({ starts: [...starts, 0x2010, 0x2013, 0x2015], memory, inImage, coverage, references: [] }).unresolved, [{ at: 0x2008, kind: "indirect-jump" }]);
});

test("JMP ($10ff) reads its high byte from $1000, in the same page", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([0x6c, 0xff, 0x10], 0x2000);
  memory[0x10ff] = 0x00;
  memory[0x1000] = 0x30;
  memory[0x1100] = 0x40;
  const inImage = (address: number) => address >= 0x1000 && address <= 0x2002;
  assert.deepEqual(computedFlows({ starts: [0x2000], memory, inImage, references: [] }).targets, [{ from: 0x2000, to: 0x3000 }]);
  const coverage = new Uint8Array(0x10000);
  coverage[0x1000] = COVERAGE.ramWrite;
  assert.deepEqual(computedFlows({ starts: [0x2000], memory, inImage, coverage, references: [] }).unresolved, [{ at: 0x2000, kind: "indirect-jump" }]);
});

test("an RTS after two pushes goes to the pushed address + 1: immediates give it, a table needs a jump reference of the idiom pass or the LLM", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([0xa9, 0x12, 0x48, 0xa9, 0x33, 0x48, 0x60], 0x2000); // LDA #$12 / PHA / LDA #$33 / PHA / RTS: to $1234
  memory.set([0xbd, 0x30, 0x20, 0x48, 0xbd, 0x20, 0x20, 0x48, 0x60], 0x2010); // LDA $2030,X / PHA / LDA $2020,X / PHA / RTS
  memory.set([0x48, 0x68, 0x60], 0x2040); // PHA / PLA / RTS: a saved register is no return address
  const starts = [0x2000, 0x2002, 0x2003, 0x2005, 0x2006, 0x2010, 0x2013, 0x2014, 0x2017, 0x2018, 0x2040, 0x2041, 0x2042];
  const inImage = (address: number) => address >= 0x2000 && address <= 0x204f;
  assert.deepEqual(computedFlows({ starts, memory, inImage, references: [] }), { targets: [{ from: 0x2006, to: 0x1234 }], unresolved: [{ at: 0x2018, kind: "pushed-return" }] });
  assert.deepEqual(computedFlows({ starts, memory, inImage, references: [{ from: 0x2018, kind: "jump", origin: "heuristic" }] }).unresolved, []);
});

test("the targets of computed flows are reachable, and a flow in dead code leaves the other unreached code dead", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([0xa9, 0x10, 0x48, 0xa9, 0x07, 0x48, 0x60], 0x1000); // LDA #$10 / PHA / LDA #$07 / PHA / RTS: to $1008
  memory[0x1008] = 0x60;
  memory.set([0x6c, 0x00, 0x11], 0x1010); // JMP ($1100): a vector outside the image
  memory[0x1020] = 0x60;
  const segments = [{ start: 0x1000, end: 0x10ff }];
  const codeRegions = [{ start: 0x1000, end: 0x1006, type: "code" }, { start: 0x1008, end: 0x1008, type: "code" }, { start: 0x1010, end: 0x1012, type: "code" }, { start: 0x1020, end: 0x1020, type: "code" }];
  const coverage = new Uint8Array(0x10000);
  coverage[0x1000] = COVERAGE.ramExecute;
  const dead = separate({ segments, memory, entry: 0x1000, coverage, codeRegions, references: [] });
  assert.deepEqual(dead.codeRegions.map((region) => region.reachable), [true, true, false, false]);
  assert.deepEqual(dead.unresolved, []);
  assert.deepEqual(dead.codeRegions.map((region) => region.unknown), [undefined, undefined, undefined, undefined]);
  coverage[0x1010] = COVERAGE.ramExecute;
  const ran = separate({ segments, memory, entry: 0x1000, coverage, codeRegions, references: [] });
  assert.deepEqual(ran.unresolved, [{ at: 0x1010, kind: "indirect-jump" }]);
  assert.deepEqual(ran.codeRegions.map((region) => region.unknown), [undefined, undefined, undefined, true]);
});

test("an unreached code region is unknown, not dead, without coverage or while a flow is unresolved", () => {
  const input = chain(3);
  input.references = [];
  assert.deepEqual(separate({ ...input, entry: 0x1000 }).codeRegions.map((region) => region.unknown), [undefined, true, true]);
  const ran = new Uint8Array(0x10000);
  ran[0x1000] = COVERAGE.ramExecute;
  assert.deepEqual(separate({ ...input, entry: 0x1000, coverage: ran }).codeRegions.map((region) => region.unknown), [undefined, undefined, undefined], "dead code: the runs show that it did not run");
  input.memory.set([0x6c, 0x00, 0x11], 0x1000); // JMP ($1100): a vector outside the image
  const found = separate({ ...input, entry: 0x1000, coverage: ran });
  assert.deepEqual(found.unresolved, [{ at: 0x1000, kind: "indirect-jump" }]);
  assert.deepEqual(found.codeRegions.map((region) => region.unknown), [undefined, true, true]);
});

test("an immediate that the code stores in an interrupt vector goes from each store to the handler; a restore of the vector does not remove it", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([0xa9, 0x00, 0x8d, 0x14, 0x03, 0xa9, 0x30, 0x8d, 0x15, 0x03, 0x60], 0x2000); // LDA #$00 / STA $0314 / LDA #$30 / STA $0315 / RTS
  memory.set([0xad, 0x80, 0x20, 0x8d, 0x14, 0x03, 0xad, 0x81, 0x20, 0x8d, 0x15, 0x03, 0x60], 0x2010); // LDA $2080 / STA $0314 / LDA $2081 / STA $0315 / RTS
  memory.set([0xa9, 0x31, 0x8d, 0xff, 0xff, 0x60], 0x2020); // LDA #$31 / STA $ffff / RTS: the low byte is the one in the image
  memory[0xfffe] = 0x40;
  const starts = [0x2000, 0x2002, 0x2005, 0x2007, 0x200a, 0x2010, 0x2013, 0x2016, 0x2019, 0x201c, 0x2020, 0x2022, 0x2025];
  const inImage = (address: number) => (address >= 0x2000 && address <= 0x20ff) || address >= 0xfffa;
  assert.deepEqual(computedFlows({ starts, memory, inImage, references: [] }), {
    targets: [
      { from: 0x2002, to: 0x3000 },
      { from: 0x2007, to: 0x3000 },
      { from: 0x2022, to: 0x3140 },
    ],
    unresolved: [],
  });
});

test("a handler in an interrupt vector is reachable when the code that stores it is, and not when only dead code stores it", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([0xa9, 0x00, 0x8d, 0x18, 0x03, 0xa9, 0x11, 0x8d, 0x19, 0x03, 0x60], 0x1000); // NMI vector $0318 to $1100
  memory.set([0xa9, 0x00, 0x8d, 0xfe, 0xff, 0xa9, 0x12, 0x8d, 0xff, 0xff, 0x60], 0x1020); // IRQ vector $fffe to $1200, in code that nothing reaches
  memory[0x1100] = 0x40;
  memory[0x1200] = 0x40;
  const codeRegions = [{ start: 0x1000, end: 0x100a, type: "code" }, { start: 0x1020, end: 0x102a, type: "code" }, { start: 0x1100, end: 0x1100, type: "code" }, { start: 0x1200, end: 0x1200, type: "code" }];
  const found = separate({ segments: [{ start: 0x1000, end: 0x12ff }], memory, entry: 0x1000, codeRegions, references: [] });
  assert.deepEqual(found.codeRegions.map((region) => region.reachable), [true, false, true, false]);
  assert.deepEqual(found.roots, [{ address: 0x1000, from: "entry" }]);
});
