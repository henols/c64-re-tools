// Execution tools: c64_execution and c64_run_until.

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { isRefusal } from "../../errors.ts";
import { EXECUTION_ACTIONS, MAX_EXECUTION_COUNT, MAX_HISTORY, MAX_TIMEOUT_FRAMES, POINT_STOP_REASONS, RUN_STATES, SPACES, STOP_REASONS, type RunTarget } from "../../protocol/vice.ts";
import { Byte, SpaceInput, TOOL_INPUTS } from "../inputs.ts";
import { AddressOutput, defineTool, toCondition, ToolOutput, type ViceSessionApi } from "../server.ts";
import { c64Observe } from "./video.ts";

export const c64Execution = defineTool({
  name: "c64_execution",
  title: "Control C64 execution",
  description:
    "Control the CPU. pause stops the CPU and gives the program counter (pc). resume lets the CPU run. " +
    "step executes count instructions (default 1) and goes into subroutines. " +
    "next executes count instructions (default 1) and treats a JSR and its subroutine as one instruction. " +
    "until-return runs until the current subroutine returns (after the next RTS or RTI). " +
    "advance-frames runs exactly count video frames (count is necessary). It stops at the same raster position, count frames later. " +
    "A breakpoint, a watchpoint or a JAM opcode can stop it before that. advancedFrames tells how many frames ran. " +
    "stopReason tells why it stopped: frames (all frames ran), breakpoint, watchpoint or jam. pointId gives the id of the breakpoint or watchpoint. " +
    "space tells which CPU stopped: c64, or drive8 for a breakpoint or watchpoint in the disk drive. pc is the address in that space. " +
    "A CPU that a JAM stopped runs again only after c64_reset, a snapshot restore or c64_autostart. " +
    "To wait for a breakpoint or watchpoint after resume, use advance-frames with a large count. " +
    "step, next, until-return and advance-frames first stop a running CPU. Use count only with step, next and advance-frames. " +
    "step, next and until-return work only in space c64. For the drive, use c64_run_until with an address in space drive8.",
  inputSchema: z
    .object({
      action: z.enum(EXECUTION_ACTIONS),
      count: z
        .number()
        .int()
        .min(1)
        .max(MAX_EXECUTION_COUNT)
        .optional()
        .describe(`step and next: instructions (default 1). advance-frames: frames (necessary). 1 to ${MAX_EXECUTION_COUNT}`),
      space: SpaceInput,
    })
    .strict(),
  outputSchema: z.object({
    state: z.enum(RUN_STATES),
    pc: AddressOutput.optional(),
    executed: z.number().int().min(0).max(MAX_EXECUTION_COUNT).optional().describe("instructions executed by step or next"),
    advancedFrames: z.number().int().min(0).max(MAX_EXECUTION_COUNT).optional().describe("frames advance-frames ran"),
    stopReason: z.enum(["frames", ...POINT_STOP_REASONS]).optional().describe("advance-frames: why it stopped"),
    pointId: z.number().int().min(1).optional().describe("the id of the breakpoint or watchpoint that stopped advance-frames"),
    space: z.enum(SPACES).optional().describe("advance-frames: the CPU that stopped, c64 or drive8. pc is the address in that space"),
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
      ...(result.stopReason === undefined ? {} : { stopReason: result.stopReason }),
      ...(result.pointId === undefined ? {} : { pointId: result.pointId }),
      ...(result.space === undefined ? {} : { space: result.space }),
    };
  },
});

export const c64RunUntil = defineTool({
  name: "c64_run_until",
  title: "Run the C64 until a target",
  description:
    "Run the CPU until a target occurs, then stop. " +
    "Target kind address stops before the instruction at an address executes. An optional condition must also be true. " +
    "Kind memory compares the byte at address to value with operator. It stops after a write that makes this comparison true. " +
    "Kind raster stops at the first instruction at or after a raster line and cycle. If the machine is there now, it stops at the next frame's pass. " +
    `timeoutFrames (1 to ${MAX_TIMEOUT_FRAMES}, default 3000) limits the run in video frames. ` +
    "reached tells if the target occurred. stopReason tells why the CPU stopped: target, breakpoint, watchpoint, jam (a JAM opcode) or timeout. " +
    "pointId gives the id of the breakpoint or watchpoint that stopped the CPU. " +
    "space tells which CPU stopped: c64, or drive8 for a stop in the disk drive. pc is the address in that space. " +
    "The drive can execute a few more instructions before it stops. " +
    "With observe, the result also gives what c64_observe gives at the stop, in observed. " +
    `With history (1 to ${MAX_HISTORY}), it also gives the last instructions before the stop, as c64_cpu_history gives them. ` +
    "Thus one call runs to a place and reads the machine there. " +
    "The CPU is always stopped after this tool.",
  inputSchema: z
    .object({
      target: TOOL_INPUTS.runTarget,
      timeoutFrames: TOOL_INPUTS.timeoutFrames,
      observe: c64Observe.inputSchema.optional().describe("what to read at the stop, as for c64_observe"),
      history: z.number().int().min(1).max(MAX_HISTORY).optional().describe("the number of instructions before the stop to give"),
    })
    .strict(),
  outputSchema: z.object({
    reached: z.boolean(),
    stopReason: z.enum(STOP_REASONS),
    state: z.enum(RUN_STATES),
    pc: AddressOutput,
    space: z.enum(SPACES),
    pointId: z.number().int().min(1).optional().describe("the id of the breakpoint or watchpoint that stopped the CPU"),
    observed: c64Observe.outputSchema.optional(),
    history: z
      .array(z.object({ address: AddressOutput, bytes: z.string(), text: z.string(), a: Byte, x: Byte, y: Byte, sp: Byte, rasterLine: z.number().int().min(0).optional(), rasterCycle: z.number().int().min(0).optional() }))
      .optional(),
    historyMissing: z.string().optional().describe("why the result has no history, for example an old history after a JAM"),
  }),
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
    const answer = { ...result, pc: formatC64Address(result.pc) };
    const history = input.history === undefined ? {} : await runHistory(session, input.history, result.space);
    if (input.observe === undefined) return { ...answer, ...history };
    // The observation at the stop: an image of the screen comes with the result as c64_observe gives it.
    const observed = await c64Observe.run(input.observe, session);
    if (observed instanceof ToolOutput) return new ToolOutput({ ...answer, ...history, observed: observed.structured }, observed.content);
    return { ...answer, ...history, observed };
  },
});

/** The history at the stop; the run result stays when the session refuses the history. */
async function runHistory(session: ViceSessionApi, limit: number, space: "c64" | "drive8") {
  try {
    return { history: (await session.cpuHistory({ limit, space })).entries.map((entry) => ({ ...entry, address: formatC64Address(entry.address) })) };
  } catch (error) {
    if (isRefusal(error) && error.code === "operation-failed") return { historyMissing: error.message };
    throw error;
  }
}

export const executionTools = [c64Execution, c64RunUntil];
