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
    [[{ observe: "x" }], /must have exactly one of write, registers, joystick, type, press, frames, runUntil$/],
    [[{ frames: 10, type: { mode: "text", text: "x" } }], /step 1 has 2 step kinds: frames, type\. Give each one its own step$/],
    [[{ runUntil: { target: { kind: "address", address: "12-3" } } }], /step 1: runUntil\.target\.address must be \$ and 1 to 4 hex digits/],
    [[{ write: { at: "$c000", bytes: [1] } }], /step 1 has the 2\.0 form \(write\.at, write\.bytes\)/],
    [[{ type: 7 }], /step 1: type must be an object/],
    [[{ type: { mode: "text", text: "{" } }], /There is no C64 key for "\{"\. Use mode petscii/],
    [[{ registers: { x: "table" } }], /step 1: registers\.x/],
    [[{ registers: { flags: {} } }], /name at least one register/],
    [[{ frames: 0 }], /step 1: frames/],
    [[{ frames: 30_001 }], /step 1: frames/],
    [[{ press: "A" }], /step 1: press must be an object with keys, frames$/],
    [[{ press: { keys: "{F9}" } }], /step 1: press\.keys: there is no key \{F9\}/],
    [[{ press: { keys: 7 } }], /step 1: press\.keys must be the keys as text/],
    [[{ press: { keys: "a", frames: 0 } }], /step 1: press\.frames must be a whole number from 1 to 3000/],
    [[{ press: { keys: "a", hold: 2 } }], /step 1: press has the field hold, which it does not take\. Its fields are keys, frames/],
  ] as const) {
    assert.throws(() => checkActionSteps(bad, refuse), why, JSON.stringify(bad));
  }
  assert.deepEqual(checkActionSteps([{ press: { keys: "{LSHIFT+CBM}" } }, { press: { keys: "{STOP+RESTORE}", frames: 10 } }], refuse), [{ press: { keys: "{LSHIFT+CBM}", frames: 3 } }, { press: { keys: "{STOP+RESTORE}", frames: 10 } }], "frames defaults to 3");
});

test("a step in a form of the 2.0 files is refused with the field and the 2.1 step to write", () => {
  const message = (steps: unknown[]) => {
    try {
      checkActionSteps(steps, refuse);
    } catch (error) {
      return (error as Error).message;
    }
    return assert.fail(`${JSON.stringify(steps)} is not refused`);
  };
  for (const [old, expected] of [
    [{ runUntil: { at: "cold_start" }, timeoutFrames: 900 }, 'step 1 has the 2.0 form (runUntil.at, timeoutFrames beside runUntil). Write {"runUntil": {"target": {"kind": "address", "address": "cold_start"}, "timeoutFrames": 900}}'],
    [{ runUntil: { at: "$0400", timeoutFrames: 100 } }, 'step 1 has the 2.0 form (runUntil.at). Write {"runUntil": {"target": {"kind": "address", "address": "$0400"}, "timeoutFrames": 100}}'],
    [{ runUntil: { target: { kind: "address", address: "$0400" } }, timeoutFrames: 100 }, 'step 1 has the 2.0 form (timeoutFrames beside runUntil). Write {"runUntil": {"target": {"kind": "address", "address": "$0400"}, "timeoutFrames": 100}}'],
    [{ runUntil: { at: "main", raster: 100 }, timeoutFrames: 5 }, 'step 1 has the 2.0 form (runUntil.at, runUntil.raster, timeoutFrames beside runUntil). Write {"runUntil": {"target": {"kind": "address", "address": "main", "condition": {"kind": "raster", "line": 100}}, "timeoutFrames": 5}}'],
    [{ runUntil: { raster: 100 }, timeoutFrames: 5 }, 'step 1 has the 2.0 form (runUntil.raster, timeoutFrames beside runUntil). Write {"runUntil": {"target": {"kind": "raster", "line": 100}, "timeoutFrames": 5}}'],
    [{ runUntil: { memory: { at: "room", equals: 0 }, timeoutFrames: 20 } }, 'step 1 has the 2.0 form (runUntil.memory). Write {"runUntil": {"target": {"kind": "memory", "address": "room", "operator": "eq", "value": 0}, "timeoutFrames": 20}}'],
    [{ type: " " }, 'step 1 has the 2.0 form (type as text). Write {"type": {"mode": "text", "text": " "}}, or {"type": {"mode": "petscii", "bytes": [...]}} for PETSCII codes'],
    [{ write: { at: "next_room", bytes: [1, 255] } }, 'step 1 has the 2.0 form (write.at, write.bytes). Write {"write": {"address": "next_room", "data": "01ff"}}'],
    [{ registers: { pc: 0x0400, a: 16 } }, 'step 1 has the 2.0 form (registers.pc as a number). Write {"registers": {"pc": "$0400", "a": 16}}'],
    [{ registers: { a: "$10" } }, 'step 1 has the 2.0 form (registers.a as text). Write {"registers": {"a": 16}}'],
    [{ runUntil: { target: { kind: "memory", at: "room", operator: "eq", value: 0 } } }, /runUntil\.target has the field at, which it does not take\. at is a 2\.0 field\. Write address in place of at\./],
    [{ runUntil: { target: { kind: "memory", address: "room", equals: 0 } } }, /has the field equals, which it does not take\. equals is a 2\.0 field\. Write "operator": "eq" and "value" in place of equals\./],
  ] as const) {
    if (typeof expected === "string") assert.equal(message([old]), expected);
    else assert.match(message([old]), expected);
  }
  // The 2.1 step that the refusal gives is a step that checks.
  assert.doesNotThrow(() => checkActionSteps([{ runUntil: { target: { kind: "address", address: "cold_start" }, timeoutFrames: 900 } }, { type: { mode: "text", text: " " } }, { write: { address: "next_room", data: "01ff" } }, { registers: { pc: "$0400", a: 16 } }], refuse));
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
