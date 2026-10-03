// Machine tools: c64_status (15 §7).

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { RUN_STATES, VIDEO_STANDARDS } from "../../protocol.ts";
import { AddressOutput, defineTool } from "../server.ts";

export const c64Status = defineTool({
  name: "c64_status",
  title: "C64 status",
  description:
    "Get the state of the C64. The result tells if the CPU is running or stopped, the video standard (pal or ntsc), " +
    "and if warp mode is on. When the CPU is stopped, the result also gives the program counter (pc).",
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

export const machineTools = [c64Status];
