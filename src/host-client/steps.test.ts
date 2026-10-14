import assert from "node:assert/strict";
import { test } from "node:test";

import { checkActionSteps } from "./steps.ts";

const refuse = (message: string): never => {
  throw new Error(message);
};

test("a steps file has action steps with $ addresses only (D43)", () => {
  const steps = [{ frames: 50 }, { type: " " }, { joystick: { port: 2, direction: "up" } }, { runUntil: { at: "$c000" }, timeoutFrames: 300 }, { write: { at: "$d020", bytes: [0] } }];
  assert.deepEqual(checkActionSteps(steps, refuse), steps);
  for (const [bad, why] of [
    [[], /at least one step/],
    [[{ observe: "x" }], /exactly one of write, registers/],
    [[{ runUntil: { at: "main_loop" }, timeoutFrames: 10 }], /must be \$ followed by four hex digits, not main_loop/],
    [[{ frames: 0 }], /frame count/],
    [[{ type: "x", frames: 2 }], /exactly one of/],
  ] as const) {
    assert.throws(() => checkActionSteps(bad, refuse), why, JSON.stringify(bad));
  }
});
