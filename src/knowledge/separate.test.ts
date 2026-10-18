import assert from "node:assert/strict";
import { test } from "node:test";

import { separate } from "./separate.ts";

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
