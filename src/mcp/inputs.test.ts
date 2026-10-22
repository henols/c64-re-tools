// The MCP tools and the action steps take the same inputs: the same fields,
// the same ranges and the same defaults. The steps have their own checker
// (the scripts install without zod), so this test holds the two together.

import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import { c64AddressOf } from "../c64.ts";
import { checkActionSteps, STEP_FIELDS, type ActionStepKind } from "../host-client/steps.ts";
import { TOOL_INPUTS } from "./inputs.ts";
import { c64RunUntil } from "./tools/execution.ts";

const fieldsOf = (schema: z.ZodType) => Object.keys((schema as unknown as z.ZodObject).shape).sort();
const optionsOf = (schema: z.ZodType) => (schema as unknown as z.ZodDiscriminatedUnion<z.ZodObject[]>).options;
const sorted = (fields: readonly string[]) => [...fields].sort();

test("each step input has the fields of its tool input", () => {
  assert.deepEqual(fieldsOf(TOOL_INPUTS.memoryWrite), sorted(STEP_FIELDS.write));
  assert.deepEqual(fieldsOf(TOOL_INPUTS.registerValues), sorted(STEP_FIELDS.registers));
  assert.deepEqual(fieldsOf(TOOL_INPUTS.flags), sorted(STEP_FIELDS.flags));
  assert.deepEqual(fieldsOf(TOOL_INPUTS.joystick), sorted(STEP_FIELDS.joystick));
  assert.deepEqual(fieldsOf(TOOL_INPUTS.keyboard), sorted(STEP_FIELDS.type));
  assert.deepEqual(fieldsOf(TOOL_INPUTS.press), sorted(STEP_FIELDS.press));
  const [address, memory, raster] = optionsOf(TOOL_INPUTS.runTarget);
  assert.deepEqual([fieldsOf(address!), fieldsOf(memory!), fieldsOf(raster!)], [sorted(STEP_FIELDS.addressTarget), sorted(STEP_FIELDS.memoryTarget), sorted(STEP_FIELDS.rasterTarget)]);
  const [register, memoryCondition, rasterCondition] = optionsOf(TOOL_INPUTS.condition);
  assert.deepEqual([fieldsOf(register!), fieldsOf(memoryCondition!), fieldsOf(rasterCondition!)], [sorted(STEP_FIELDS.registerCondition), sorted(STEP_FIELDS.memoryCondition), sorted(STEP_FIELDS.rasterCondition)]);
  // A runUntil step has the target and the wait of c64_run_until; observe and history are for a tool call alone.
  for (const field of STEP_FIELDS.runUntil) assert.ok(fieldsOf(c64RunUntil.inputSchema).includes(field), field);
});

/** A step output with its $ addresses as numbers, as the tool output has them. */
function asTool(value: unknown, key?: string): unknown {
  if (typeof value === "string" && (key === "address" || key === "pc")) return c64AddressOf(value);
  if (Array.isArray(value)) return value.map((item) => asTool(item));
  if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, asTool(item, name)]));
  return value;
}

const runUntilTool = z.object({ target: TOOL_INPUTS.runTarget, timeoutFrames: TOOL_INPUTS.timeoutFrames }).strict();

const SCHEMAS: Partial<Record<ActionStepKind, z.ZodType>> = {
  write: TOOL_INPUTS.memoryWrite,
  registers: TOOL_INPUTS.registerValues,
  joystick: TOOL_INPUTS.joystick,
  type: TOOL_INPUTS.keyboard,
  press: TOOL_INPUTS.press,
  runUntil: runUntilTool,
};

/** Inputs with $ addresses: both take them, or both refuse them, with the same defaults. */
const SAMPLES: Array<[ActionStepKind, unknown]> = [
  ["write", { address: "$d020", data: "0A" }],
  ["write", { address: "$fb", data: "00", space: "drive8", view: "ram" }],
  ["write", { address: "$d020", data: "0" }],
  ["write", { address: "$d020", data: "00".repeat(4097) }],
  ["write", { address: "$12345", data: "00" }],
  ["write", { address: "$d020", data: "00", view: "io" }],
  ["write", { at: "$d020", data: "00" }],
  ["registers", { pc: "$0810", a: 1, flags: { i: true } }],
  ["registers", { sp: 0xff }],
  ["registers", {}],
  ["registers", { flags: {} }],
  ["registers", { a: 256 }],
  ["registers", { flags: { q: true } }],
  ["joystick", { port: 2, direction: "up" }],
  ["joystick", { port: 1, direction: "down-left", fire: true }],
  ["joystick", { port: 3, direction: "up" }],
  ["joystick", { port: 2, direction: "north" }],
  ["type", { mode: "text", text: "RUN\n" }],
  ["type", { mode: "petscii", bytes: [147] }],
  ["type", { mode: "text", text: "{" }],
  ["type", { mode: "text", bytes: [1] }],
  ["type", { mode: "petscii", bytes: [0] }],
  ["type", { mode: "text", text: "x".repeat(1025) }],
  ["press", { keys: "{LSHIFT+CBM}a\n" }],
  ["press", { keys: "{STOP+RESTORE}", frames: 50 }],
  ["press", { keys: "" }],
  ["press", { keys: "{F9}" }],
  ["press", { keys: "{A+B+C+D+E}" }],
  ["press", { keys: "a", frames: 3001 }],
  ["press", { keys: 7 }],
  ["runUntil", { target: { kind: "address", address: "$0810" } }],
  ["runUntil", { target: { kind: "address", address: "$0810", condition: { kind: "raster", line: 100 } }, timeoutFrames: 50 }],
  ["runUntil", { target: { kind: "address", address: "$0810", condition: { kind: "register", register: "a", operator: "eq", value: 1 } } }],
  ["runUntil", { target: { kind: "address", address: "$0810", condition: { kind: "memory", address: "$fb", operator: "gte", value: 3 } } }],
  ["runUntil", { target: { kind: "memory", address: "$fb", operator: "ne", value: 0 } }],
  ["runUntil", { target: { kind: "raster", line: 311, cycle: 64 } }],
  ["runUntil", { target: { kind: "raster", line: 312 } }],
  ["runUntil", { target: { kind: "address", address: "$0810" }, timeoutFrames: 0 }],
  ["runUntil", { target: { kind: "memory", address: "$fb", operator: "is", value: 0 } }],
  ["runUntil", { target: { kind: "pc", address: "$0810" } }],
];

test("a step and its tool take and refuse the same inputs, with the same defaults", () => {
  for (const [kind, input] of SAMPLES) {
    const tool = SCHEMAS[kind]!.safeParse(input);
    let step: unknown;
    try {
      step = checkActionSteps([{ [kind]: input }], (message) => {
        throw new Error(message);
      })[0];
    } catch {
      step = undefined;
    }
    const label = `${kind} ${JSON.stringify(input)}`;
    assert.equal(step !== undefined, tool.success, label);
    if (tool.success) assert.deepEqual(asTool((step as Record<string, unknown>)[kind]), tool.data, label);
  }
});
