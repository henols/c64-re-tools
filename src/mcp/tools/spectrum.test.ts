import assert from "node:assert/strict";
import { test } from "node:test";

import { spectrumTools } from "./spectrum.ts";

const tool = (name: string) => spectrumTools.find((item) => item.name === name)!;

test("a register write takes some of the registers, and only those that a write takes", () => {
  const input = tool("registers").inputSchema;
  assert.deepEqual(input.parse({ action: "write", values: { bc: 0x1234, i: 0x3f } }), { action: "write", values: { bc: 0x1234, i: 0x3f } });
  assert.deepEqual(input.parse({ action: "write", values: { hl: "$c000", im: 1, iff1: true, iff2: false } }), { action: "write", values: { hl: 0xc000, im: 1, iff1: true, iff2: false } });
  assert.equal(input.safeParse({ action: "write", values: { a: 1 } }).success, false);
  assert.equal(input.safeParse({ action: "write", values: { hl: 0x10000 } }).success, false);
  assert.equal(input.safeParse({ action: "write", values: { im: 3 } }).success, false);
});

/** A session that gives the values of a stopped 48K and records the calls. */
function fakeSession(calls: Array<[string, unknown]> = []) {
  const registers = { pc: 0xe200, sp: 0x62d2, af: 0x0054, bc: 0x7d02, de: 0xa86c, hl: 0xed5c, ix: 0x4000, iy: 0xee1a, af2: 0xcb09, bc2: 0x421a, de2: 0xd844, hl2: 0xffd8, i: 0x3f, r: 0x12, im: 1, iff1: true, iff2: true };
  return new Proxy(
    {},
    {
      get: (_target, name: string) => async (params: unknown) => {
        calls.push([name, params]);
        if (name === "registersGet" || name === "registersSet") return registers;
        if (name === "keyboard") return { state: "stopped", pc: 0x8023, stopReason: "frames", typed: 2 };
        if (name === "keys") return { state: "stopped", pc: 0x8023, stopReason: "frames" };
        if (name === "memoryRead") return { address: 0, data: "00".repeat((params as { size: number }).size) };
        return {};
      },
    },
  ) as never;
}

test("the registers result gives every 16-bit register as four hex digits", async () => {
  const result = (await tool("registers").run({ action: "read" }, fakeSession())) as Record<string, unknown>;
  for (const pair of ["pc", "sp", "af", "bc", "de", "hl", "ix", "iy", "af2", "bc2", "de2", "hl2"]) assert.match(String(result[pair]), /^\$[0-9a-f]{4}$/, pair);
  assert.deepEqual([result.af, result.hl2, result.i, result.im, result.iff1], ["$0054", "$ffd8", 0x3f, 1, true]);
  assert.equal(tool("registers").outputSchema.safeParse(result).success, true);
});

test("a register write sends the flip-flops as 0 or 1 and a hex value as a number", async () => {
  const calls: Array<[string, unknown]> = [];
  await tool("registers").run(tool("registers").inputSchema.parse({ action: "write", values: { hl: "$c000", im: 2, iff1: false } }), fakeSession(calls));
  assert.deepEqual(calls, [["registersSet", { values: { hl: 0xc000, im: 2, iff1: 0 } }]]);
});

test("keyboard refuses text and keys together, and both forms give the stop of the CPU", async () => {
  const keyboard = tool("keyboard");
  await assert.rejects(keyboard.run({ text: "a", keys: ["a"], frames: 3 }, fakeSession()), /Give text or keys, not both/);
  await assert.rejects(keyboard.run({ frames: 3 }, fakeSession()), /Give text or keys:/);
  assert.deepEqual(await keyboard.run({ text: "ab", frames: 3 }, fakeSession()), { state: "stopped", pc: "$8023", stopReason: "frames", typed: 2 });
  assert.deepEqual(await keyboard.run({ keys: ["a"], frames: 3 }, fakeSession()), { state: "stopped", pc: "$8023", stopReason: "frames" });
});

test("snapshot export writes only a .z80 file", async () => {
  await assert.rejects(tool("snapshot").run({ action: "export", out: ".c64-re-tools/local/x.sna" }, fakeSession()), /extension \.z80/);
});

test("memory_search takes a pattern in capitals", async () => {
  const input = tool("memory_search").inputSchema.parse({ start: "$8000", end: "$8003", pattern: "DBFE??" });
  assert.equal((input as { pattern: string }).pattern, "dbfe??");
  assert.match(String(tool("memory_search").inputSchema.safeParse({ start: "$8000", end: "$8003", pattern: "db fe" }).error), /two hex digits or \?\? for each byte/);
});

test("the spectrum server has no C64 chip tools", () => {
  const names = spectrumTools.map((item) => item.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of ["vicii", "sprite", "cia", "sid"]) assert.ok(!names.includes(name), name);
});

test("no spectrum tool names the emulator or the replay core that runs it", () => {
  for (const item of spectrumTools) assert.doesNotMatch(`${item.description} ${JSON.stringify(item.inputSchema)}`, /ZEsarUX|zxrun|\bZRCP\b|monitor|tcp|socket/i, item.name);
});
