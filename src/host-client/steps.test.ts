import assert from "node:assert/strict";
import { test } from "node:test";

import { checkActionSteps, runActionStep } from "./steps.ts";
import type { ViceSessionClient } from "./vice-session.ts";

const refuse = (message: string): never => {
  throw new Error(message);
};

test("a steps file has action steps with $ addresses only", () => {
  const steps = [{ frames: 50 }, { type: " " }, { joystick: { port: 2, direction: "up" } }, { runUntil: { at: "$c000" }, timeoutFrames: 300 }, { write: { at: "$d020", bytes: [0] } }];
  assert.deepEqual(checkActionSteps(steps, refuse), steps);
  for (const [bad, why] of [
    [[], /at least one step/],
    [[{ observe: "x" }], /exactly one of write, registers/],
    [[{ runUntil: { at: "main_loop" }, timeoutFrames: 10 }], /must be \$ followed by four hex digits, not main_loop/],
    [[{ frames: 0 }], /frame count/],
    [[{ frames: 30_001 }], /frame count from 1 to 30000/],
    [[{ type: "x", frames: 2 }], /exactly one of/],
  ] as const) {
    assert.throws(() => checkActionSteps(bad, refuse), why, JSON.stringify(bad));
  }
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
