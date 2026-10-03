// Video tools: c64_screen (15 §29). Baselines, compare, list and discard
// arrive with milestone 3.

import { z } from "zod";

import { defineTool, ToolOutput } from "../server.ts";

export const c64Screen = defineTool({
  name: "c64_screen",
  title: "Capture the C64 screen",
  description:
    "Action capture returns the last frame the C64 drew, with its borders, as a PNG image, plus its width and height in pixels. " +
    "The emulator draws frames while the CPU runs. After the CPU stops, the frame stays the same. " +
    "This does not change if the machine is running or stopped.",
  inputSchema: z.object({ action: z.enum(["capture"]) }).strict(),
  outputSchema: z.object({ width: z.number().int().min(1), height: z.number().int().min(1) }),
  readOnly: true,
  async run(_input, session) {
    const shot = await session.screenCapture();
    return new ToolOutput({ width: shot.width, height: shot.height }, [{ type: "image", data: shot.png, mimeType: "image/png" }]);
  },
});

export const videoTools = [c64Screen];
