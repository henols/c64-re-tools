import assert from "node:assert/strict";
import { test } from "node:test";

import { COVERAGE } from "../c64.ts";
import { immediateVectors, separate, unresolvedFlows } from "./separate.ts";

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

test("a jump is unresolved when a run wrote its vector or its address, and resolved by a reference of the LLM or by the program's own immediates", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([0x6c, 0x10, 0x20, 0x4c, 0x00, 0x30], 0x2000); // JMP ($2010) / JMP $3000
  const inImage = (address: number) => address >= 0x2000 && address <= 0x2011;
  const starts = [0x2000, 0x2003];
  assert.deepEqual(unresolvedFlows({ starts, memory, inImage }), [], "without coverage, a vector in the image holds its target");
  const coverage = new Uint8Array(0x10000);
  coverage[0x2010] = COVERAGE.ramWrite;
  coverage[0x2004] = COVERAGE.ramWrite;
  assert.deepEqual(unresolvedFlows({ starts, memory, inImage, coverage }), [
    { at: 0x2000, kind: "indirect-jump" },
    { at: 0x2003, kind: "written-operand" },
  ]);
  assert.deepEqual(unresolvedFlows({ starts, memory, inImage, coverage, resolvedSites: new Set([0x2000, 0x2003]) }), []);
  assert.deepEqual(unresolvedFlows({ starts: [0x2000], memory, inImage: () => false }), [{ at: 0x2000, kind: "indirect-jump" }], "a vector outside the image");
  // LDA #$34 / STA $2010 / LDA #$12 / STA $2011: the program sets the vector itself.
  memory.set([0xa9, 0x34, 0x8d, 0x10, 0x20, 0xa9, 0x12, 0x8d, 0x11, 0x20], 0x2006);
  const withStores = [...starts, 0x2006, 0x2008, 0x200b, 0x200d];
  assert.deepEqual([...immediateVectors(withStores, memory)], [0x2010]);
  assert.deepEqual(unresolvedFlows({ starts: withStores, memory, inImage, coverage, resolvedSites: new Set([0x2003]) }), []);
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
