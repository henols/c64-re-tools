import assert from "node:assert/strict";
import { test } from "node:test";

import { spectrumTools } from "./spectrum.ts";

const tool = (name: string) => spectrumTools.find((item) => item.name === name)!;

test("a register write takes some of the registers, and only those that a write takes", () => {
  const input = tool("registers").inputSchema;
  assert.deepEqual(input.parse({ action: "write", values: { bc: 0x1234, i: 0x3f } }), { action: "write", values: { bc: 0x1234, i: 0x3f } });
  assert.equal(input.safeParse({ action: "write", values: { a: 1 } }).success, false);
  assert.equal(input.safeParse({ action: "write", values: { hl: 0x10000 } }).success, false);
});

test("the spectrum server has no C64 chip tools", () => {
  const names = spectrumTools.map((item) => item.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of ["vicii", "sprite", "cia", "sid"]) assert.ok(!names.includes(name), name);
});

test("no spectrum tool names the emulator or the replay core that runs it", () => {
  for (const item of spectrumTools) assert.doesNotMatch(`${item.description} ${JSON.stringify(item.inputSchema)}`, /ZEsarUX|zxrun|\bZRCP\b|monitor|tcp|socket/i, item.name);
});
