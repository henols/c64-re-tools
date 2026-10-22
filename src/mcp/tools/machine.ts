// Machine tools: reset, warp and window.

import { z } from "zod";

import { formatAddress } from "../../address.ts";
import { RESET_MODES, RUN_STATES, WINDOW_ACTIONS } from "../../protocol/vice.ts";
import { AddressOutput, defineTool } from "../server.ts";

export const c64Window = defineTool({
  name: "window",
  title: "Emulator window",
  description:
    "Show the C64 in a window, or hide it again. The emulator has no window until you open one. " +
    "Open the window when the user must type, play or look at the C64. Then tell the user. Wait until the user tells you that they finished. " +
    "Then close the window. The machine, the disk in drive 8, breakpoints, watchpoints, joysticks, warp mode and timing go along. " +
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
  name: "reset",
  title: "Reset the C64",
  description:
    "Reset the C64. Mode soft is the reset button. Mode hard is a power cycle that also resets the disk drive. " +
    "With run false (the default), the CPU stops at the first instruction of the reset routine, and the result gives that program counter (pc). " +
    "With run true, the C64 starts normally. Breakpoints and watchpoints stay. The timing stopwatch starts again from zero.",
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
    return result.pc === undefined ? { state: result.state } : { state: result.state, pc: formatAddress(result.pc) };
  },
});

export const c64Warp = defineTool({
  name: "warp",
  title: "Warp mode",
  description:
    "Turn warp mode on or off. In warp mode the C64 runs as fast as possible. " +
    "Warp mode does not change what the C64 does. This does not change the run state of the machine.",
  inputSchema: z.object({ enabled: z.boolean().describe("true turns warp mode on") }).strict(),
  outputSchema: z.object({ enabled: z.boolean() }),
  readOnly: false,
  async run(input, session) {
    return session.warp(input.enabled);
  },
});

export const machineTools = [c64Reset, c64Warp, c64Window];
