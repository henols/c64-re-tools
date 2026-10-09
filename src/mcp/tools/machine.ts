// Machine tools: c64_status, c64_reset, c64_warp and c64_window.

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { VIDEO_STANDARDS } from "../../protocol/messages.ts";
import { RESET_MODES, RUN_STATES, WINDOW_ACTIONS } from "../../protocol/vice.ts";
import { AddressOutput, defineTool } from "../server.ts";

export const c64Status = defineTool({
  name: "c64_status",
  title: "C64 status",
  description:
    "Get the state of the C64. The result tells if the CPU runs or has stopped, the video standard (pal or ntsc), " +
    "and if warp mode is on. It also tells if the emulator window is open (window). " +
    "When the CPU has stopped, the result also gives the program counter (pc).",
  inputSchema: z.object({}).strict(),
  outputSchema: z.object({
    state: z.enum(RUN_STATES),
    videoStandard: z.enum(VIDEO_STANDARDS),
    warp: z.boolean(),
    window: z.boolean().describe("true when the emulator window is open (c64_window)"),
    pc: AddressOutput.optional().describe("program counter. Only when the CPU is stopped"),
  }),
  readOnly: true,
  async run(_input, session) {
    const status = await session.status();
    return {
      state: status.state,
      videoStandard: status.videoStandard,
      warp: status.warp,
      window: status.window,
      ...(status.pc === undefined ? {} : { pc: formatC64Address(status.pc) }),
    };
  },
});

export const c64Window = defineTool({
  name: "c64_window",
  title: "Emulator window",
  description:
    "Show the C64 in a window on the host, or hide it again. The emulator has no window until you open one. " +
    "Open the window when the user must type, play or look at the C64. Then tell the user. Wait until the user tells you that they finished. " +
    "Then close the window. The machine, the disk in drive 8, breakpoints, watchpoints, joysticks, warp mode and c64_timing go along. " +
    "The run state of the machine does not change. The result names the data that does not go along (notCarried). " +
    "If the user closes the window, the machine goes back to the state of when the window opened.",
  inputSchema: z.object({ action: z.enum(WINDOW_ACTIONS).describe("open shows the window. close hides it") }).strict(),
  outputSchema: z.object({
    window: z.boolean().describe("true when the window is open"),
    state: z.enum(RUN_STATES),
    notCarried: z.array(z.string()).describe("emulator data that the move cleared. Empty when nothing moved"),
  }),
  readOnly: false,
  async run(input, session) {
    return session.window(input.action);
  },
});

export const c64Reset = defineTool({
  name: "c64_reset",
  title: "Reset the C64",
  description:
    "Reset the C64. Mode soft is the reset button. Mode hard is a power cycle that also resets the disk drive. " +
    "With run false (the default), the CPU stops at the first instruction of the reset routine, and the result gives that program counter (pc). " +
    "With run true, the C64 starts normally. Breakpoints and watchpoints stay.",
  inputSchema: z
    .object({
      mode: z.enum(RESET_MODES).describe("soft is the reset button. hard is a power cycle"),
      run: z.boolean().default(false).describe("false stops at the reset routine. true lets the C64 start"),
    })
    .strict(),
  outputSchema: z.object({
    state: z.enum(RUN_STATES),
    pc: AddressOutput.optional().describe("program counter. Only when run is false"),
  }),
  readOnly: false,
  async run(input, session) {
    const result = await session.reset(input);
    return result.pc === undefined ? { state: result.state } : { state: result.state, pc: formatC64Address(result.pc) };
  },
});

export const c64Warp = defineTool({
  name: "c64_warp",
  title: "Warp mode",
  description:
    "Turn warp mode on or off. In warp mode the C64 runs as fast as the host can run it. " +
    "Warp mode does not change what the C64 does. This does not change the run state of the machine.",
  inputSchema: z.object({ enabled: z.boolean().describe("true turns warp mode on") }).strict(),
  outputSchema: z.object({ enabled: z.boolean() }),
  readOnly: false,
  async run(input, session) {
    return session.warp(input.enabled);
  },
});

export const machineTools = [c64Status, c64Reset, c64Warp, c64Window];
