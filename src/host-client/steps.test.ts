import assert from "node:assert/strict";
import { test } from "node:test";

import { checkActionSteps, resolveTarget, runActionStep } from "./steps.ts";
import type { ViceSessionClient } from "./vice-session.ts";

const refuse = (message: string): never => {
  throw new Error(message);
};

test("a step has the input of its MCP tool, with names and the defaults of the tool", () => {
  const steps = [
    { frames: 50 },
    { type: { mode: "text", text: " " } },
    { joystick: { port: 2, direction: "up" } },
    { runUntil: { target: { kind: "address", address: "main_loop" } } },
    { runUntil: { target: { kind: "memory", address: "$fb", operator: "ne", value: 0 }, timeoutFrames: 300 } },
    { write: { address: "$d020", data: "0A" } },
    { registers: { pc: "start", a: 1, flags: { i: true } } },
  ];
  assert.deepEqual(checkActionSteps(steps, refuse), [
    { frames: 50 },
    { type: { mode: "text", text: " " } },
    { joystick: { port: 2, direction: "up", fire: false } },
    { runUntil: { target: { kind: "address", address: "main_loop", space: "c64" }, timeoutFrames: 3000 } },
    { runUntil: { target: { kind: "memory", address: "$fb", operator: "ne", value: 0, space: "c64", view: "cpu" }, timeoutFrames: 300 } },
    { write: { address: "$d020", data: "0a", space: "c64", view: "cpu" } },
    { registers: { pc: "start", a: 1, flags: { i: true } } },
  ]);
  for (const [bad, why] of [
    [[], /at least one step/],
    [[{ observe: "x" }], /exactly one of write, registers, joystick, type, press, frames, runUntil/],
    [[{ runUntil: { at: "$c000" }, timeoutFrames: 10 }], /step 1 has the key timeoutFrames, which a runUntil step does not have/],
    [[{ runUntil: { target: { kind: "address", address: "12-3" } } }], /step 1: runUntil\.target\.address must be \$ and 1 to 4 hex digits/],
    [[{ write: { at: "$c000", bytes: [1] } }], /step 1: write/],
    [[{ type: " " }], /step 1: type/],
    [[{ type: { mode: "text", text: "{" } }], /There is no C64 key for "\{"\. Use mode petscii/],
    [[{ registers: { x: "table" } }], /step 1: registers\.x/],
    [[{ registers: { flags: {} } }], /name at least one register/],
    [[{ frames: 0 }], /step 1: frames/],
    [[{ frames: 30_001 }], /step 1: frames/],
    [[{ press: "A" }], /press pushes keys of the keyboard matrix, and only the record and replay commands of c64-testing have them/],
  ] as const) {
    assert.throws(() => checkActionSteps(bad, refuse), why, JSON.stringify(bad));
  }
  assert.deepEqual(checkActionSteps([{ press: "A" }], refuse, { press: true }), [{ press: "A" }], "the replay core presses keys");
});

test("a run target of a step gets its addresses from the resolver", () => {
  const at = (location: string) => (location === "main_loop" ? 0x0810 : Number.parseInt(location.slice(1), 16));
  assert.deepEqual(resolveTarget({ kind: "address", address: "main_loop", space: "c64", condition: { kind: "memory", address: "$fb", operator: "eq", value: 1, space: "c64", view: "cpu" } }, at), {
    kind: "address",
    address: 0x0810,
    space: "c64",
    condition: { kind: "memory", address: 0xfb, operator: "eq", value: 1, space: "c64", view: "cpu" },
  });
  assert.deepEqual(resolveTarget({ kind: "raster", line: 100 }, at), { kind: "raster", line: 100 });
});

test("a frames step runs in parts of at most 10000 frames and ends at a breakpoint", async () => {
  const counts: number[] = [];
  let stopAfter = Infinity;
  const client = {
    status: async () => ({ state: "stopped" }),
    execution: async (params: { count: number }) => {
      counts.push(params.count);
      return counts.length >= stopAfter ? { state: "stopped", advancedFrames: 0, stopReason: "breakpoint" } : { state: "stopped", advancedFrames: params.count, stopReason: "frames" };
    },
  } as unknown as ViceSessionClient;
  const at = () => 0;
  await runActionStep(client, { frames: 25_000 }, at);
  assert.deepEqual(counts, [10_000, 10_000, 5_000]);
  counts.length = 0;
  stopAfter = 1;
  await runActionStep(client, { frames: 25_000 }, at);
  assert.deepEqual(counts, [10_000], "a breakpoint ends the step");
});
