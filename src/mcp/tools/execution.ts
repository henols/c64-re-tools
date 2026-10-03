// Execution tools: c64_execution (15 §10) and c64_run_until (15 §11).

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import {
  COMPARISONS,
  EXECUTION_ACTIONS,
  MAX_EXECUTION_COUNT,
  MAX_TIMEOUT_FRAMES,
  RUN_STATES,
  STOP_REASONS,
  type RunTarget,
} from "../../protocol.ts";
import { AddressInput, AddressOutput, Byte, ConditionInput, defineTool, MemoryViewInput, SpaceInput, toCondition } from "../server.ts";

export const c64Execution = defineTool({
  name: "c64_execution",
  title: "Control C64 execution",
  description:
    "Control the CPU. pause stops the CPU and gives the program counter (pc). resume lets the CPU run. " +
    "step executes count instructions (default 1) and goes into subroutines. " +
    "next executes count instructions (default 1) and treats a JSR and its subroutine as one instruction. " +
    "until-return runs until the current subroutine returns (after the next RTS or RTI). " +
    "advance-frames runs exactly count video frames (count is necessary). It stops at the same raster position, count frames later. " +
    "A breakpoint or watchpoint can stop it before that. advancedFrames tells how many frames ran. " +
    "step, next, until-return and advance-frames first stop a running CPU. Use count only with step, next and advance-frames.",
  inputSchema: z
    .object({
      action: z.enum(EXECUTION_ACTIONS),
      count: z
        .number()
        .int()
        .min(1)
        .max(MAX_EXECUTION_COUNT)
        .optional()
        .describe(`step and next: instructions (default 1); advance-frames: frames (required); 1 to ${MAX_EXECUTION_COUNT}`),
      space: SpaceInput,
    })
    .strict(),
  outputSchema: z.object({
    state: z.enum(RUN_STATES),
    pc: AddressOutput.optional(),
    executed: z.number().int().min(0).max(MAX_EXECUTION_COUNT).optional().describe("instructions executed by step or next"),
    advancedFrames: z.number().int().min(0).max(MAX_EXECUTION_COUNT).optional().describe("frames advance-frames ran"),
  }),
  readOnly: false,
  async run(input, session) {
    const params = { action: input.action, space: input.space, ...(input.count === undefined ? {} : { count: input.count }) };
    const result = await session.execution(params);
    return {
      state: result.state,
      ...(result.pc === undefined ? {} : { pc: formatC64Address(result.pc) }),
      ...(result.executed === undefined ? {} : { executed: result.executed }),
      ...(result.advancedFrames === undefined ? {} : { advancedFrames: result.advancedFrames }),
    };
  },
});

const RunTargetInput = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("address"),
      address: AddressInput,
      space: SpaceInput,
      condition: ConditionInput.optional().describe("stop at the address only when this is true"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("memory"),
      address: AddressInput,
      operator: z.enum(COMPARISONS),
      value: Byte,
      space: SpaceInput,
      view: MemoryViewInput,
    })
    .strict(),
  z
    .object({
      kind: z.literal("raster"),
      line: z.number().int().min(0).describe("raster line: PAL 0-311, NTSC 0-262"),
      cycle: z.number().int().min(0).optional().describe("cycle in the line: PAL 0-62, NTSC 0-64; default 0"),
    })
    .strict(),
]);

export const c64RunUntil = defineTool({
  name: "c64_run_until",
  title: "Run the C64 until a target",
  description:
    "Run the CPU until a target occurs, then stop. " +
    "Target kind address stops before the instruction at an address executes. An optional condition must also be true. " +
    "Kind memory stops after a write makes a byte in memory compare true to a value. " +
    "Kind raster stops at the first instruction at or after a raster line and cycle. If the machine is there now, it stops at the next frame's pass. " +
    `timeoutFrames (1 to ${MAX_TIMEOUT_FRAMES}, default 3000) limits the run in video frames. ` +
    "reached tells if the target occurred. stopReason tells why the CPU stopped: target, breakpoint, watchpoint, jam (a JAM opcode) or timeout. " +
    "The CPU is always stopped after this tool.",
  inputSchema: z
    .object({
      target: RunTargetInput,
      timeoutFrames: z.number().int().min(1).max(MAX_TIMEOUT_FRAMES).default(3000),
    })
    .strict(),
  outputSchema: z.object({ reached: z.boolean(), stopReason: z.enum(STOP_REASONS), state: z.enum(RUN_STATES), pc: AddressOutput }),
  readOnly: false,
  async run(input, session) {
    const { target: given } = input;
    let target: RunTarget;
    if (given.kind === "address") {
      target = { kind: "address", address: given.address, space: given.space };
      if (given.condition !== undefined) target.condition = toCondition(given.condition);
    } else if (given.kind === "memory") {
      target = given;
    } else {
      target = given.cycle === undefined ? { kind: "raster", line: given.line } : { kind: "raster", line: given.line, cycle: given.cycle };
    }
    const result = await session.runUntil({ target, timeoutFrames: input.timeoutFrames });
    return { ...result, pc: formatC64Address(result.pc) };
  },
});

export const executionTools = [c64Execution, c64RunUntil];
