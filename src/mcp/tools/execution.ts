// Execution tools: c64_execution (15 §10).

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { EXECUTION_ACTIONS, MAX_EXECUTION_COUNT, RUN_STATES } from "../../protocol.ts";
import { AddressOutput, defineTool, SpaceInput } from "../server.ts";

export const c64Execution = defineTool({
  name: "c64_execution",
  title: "Control C64 execution",
  description:
    "Control the CPU. pause stops the CPU and gives the program counter (pc). resume lets the CPU run. " +
    "step executes count instructions (default 1) and goes into subroutines. " +
    "next executes count instructions (default 1) and treats a JSR and its subroutine as one instruction. " +
    "until-return runs until the current subroutine returns (after the next RTS or RTI). " +
    "step, next and until-return first stop a running CPU. Use count only with step and next.",
  inputSchema: z
    .object({
      action: z.enum(EXECUTION_ACTIONS),
      count: z.number().int().min(1).max(MAX_EXECUTION_COUNT).optional().describe(`instructions for step and next, 1 to ${MAX_EXECUTION_COUNT}`),
      space: SpaceInput,
    })
    .strict(),
  outputSchema: z.object({
    state: z.enum(RUN_STATES),
    pc: AddressOutput.optional(),
    executed: z.number().int().min(0).max(MAX_EXECUTION_COUNT).optional().describe("instructions executed by step or next"),
  }),
  readOnly: false,
  async run(input, session) {
    const params = { action: input.action, space: input.space, ...(input.count === undefined ? {} : { count: input.count }) };
    const result = await session.execution(params);
    return {
      state: result.state,
      ...(result.pc === undefined ? {} : { pc: formatC64Address(result.pc) }),
      ...(result.executed === undefined ? {} : { executed: result.executed }),
    };
  },
});

export const executionTools = [c64Execution];
