// Machine tools: c64_status (15 §7), c64_reset (15 §8) and c64_warp (15 §9).

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { RESET_MODES, RUN_STATES, VIDEO_STANDARDS } from "../../protocol.ts";
import { AddressOutput, defineTool } from "../server.ts";

export const c64Status = defineTool({
  name: "c64_status",
  title: "C64 status",
  description:
    "Get the state of the C64. The result tells if the CPU runs or has stopped, the video standard (pal or ntsc), " +
    "and if warp mode is on. When the CPU has stopped, the result also gives the program counter (pc).",
  inputSchema: z.object({}).strict(),
  outputSchema: z.object({
    state: z.enum(RUN_STATES),
    videoStandard: z.enum(VIDEO_STANDARDS),
    warp: z.boolean(),
    pc: AddressOutput.optional().describe("program counter; present only when the CPU is stopped"),
  }),
  readOnly: true,
  async run(_input, session) {
    const status = await session.status();
    return {
      state: status.state,
      videoStandard: status.videoStandard,
      warp: status.warp,
      ...(status.pc === undefined ? {} : { pc: formatC64Address(status.pc) }),
    };
  },
});

export const c64Reset = defineTool({
  name: "c64_reset",
  title: "Reset the C64",
  description:
    "Reset the C64. Mode soft is the reset button. Mode hard is a power cycle that also resets the disk drive. " +
    "With run false (the default), the CPU stops at the first instruction of the reset routine. " +
    "With run true, the C64 starts normally. Breakpoints and watchpoints stay.",
  inputSchema: z
    .object({
      mode: z.enum(RESET_MODES).describe("soft is the reset button; hard is a power cycle"),
      run: z.boolean().default(false).describe("false stops at the reset routine; true lets the C64 start"),
    })
    .strict(),
  outputSchema: z.object({ state: z.enum(RUN_STATES) }),
  readOnly: false,
  async run(input, session) {
    return session.reset(input);
  },
});

export const c64Warp = defineTool({
  name: "c64_warp",
  title: "Warp mode",
  description:
    "Turn warp mode on or off. In warp mode the C64 runs as fast as the host can run it. " +
    "Warp mode does not change what the C64 does. It does not change if the machine is running or stopped.",
  inputSchema: z.object({ enabled: z.boolean().describe("true turns warp mode on") }).strict(),
  outputSchema: z.object({ enabled: z.boolean() }),
  readOnly: false,
  async run(input, session) {
    return session.warp(input.enabled);
  },
});

export const machineTools = [c64Status, c64Reset, c64Warp];
