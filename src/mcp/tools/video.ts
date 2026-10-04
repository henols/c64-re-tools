// Video and chip tools: c64_vicii (15 §25), c64_sprite (15 §26), c64_cia
// (15 §27), c64_sid (15 §28) and c64_screen (15 §29).

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { CIA_SELECTIONS, VICII_MODES } from "../../protocol.ts";
import { AddressOutput, Byte, defineTool, ToolOutput } from "../server.ts";

const Color = z.number().int().min(0).max(15);
const NO_CHANGE = "This does not change if the machine is running or stopped.";

export const c64Vicii = defineTool({
  name: "c64_vicii",
  title: "VIC-II state",
  description:
    "Get the state of the VIC-II video chip: the raster line, the display mode, the screen and graphics addresses, " +
    `the scroll values and the colours. The addresses include the 16 KB video bank that CIA 2 selects. ${NO_CHANGE}`,
  inputSchema: z.object({}).strict(),
  outputSchema: z.object({
    rasterLine: z.number().int().min(0),
    mode: z.enum(VICII_MODES),
    screenAddress: AddressOutput,
    graphicsAddress: AddressOutput.describe("character set in text modes, bitmap in bitmap modes"),
    scrollX: z.number().int().min(0).max(7),
    scrollY: z.number().int().min(0).max(7),
    borderColor: Color,
    backgroundColors: z.array(Color).length(4),
  }),
  readOnly: true,
  async run(_input, session) {
    const state = await session.vicii();
    return { ...state, screenAddress: formatC64Address(state.screenAddress), graphicsAddress: formatC64Address(state.graphicsAddress) };
  },
});

const SpriteOutput = z.object({
  index: z.number().int().min(0).max(7),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  enabled: z.boolean(),
  color: Color,
  multicolor: z.boolean(),
  expandX: z.boolean(),
  expandY: z.boolean(),
  behindBackground: z.boolean(),
  dataAddress: AddressOutput,
});

export const c64Sprite = defineTool({
  name: "c64_sprite",
  title: "Sprite state",
  description:
    "Get the state of sprites 0 to 7: position, enabled, colour, multicolour, expansion, priority and the address of the sprite data. " +
    `sprites selects which sprites to give. Without it, you get all eight. ${NO_CHANGE}`,
  inputSchema: z
    .object({ sprites: z.array(z.number().int().min(0).max(7)).min(1).max(8).optional().describe("sprite numbers 0 to 7, each once") })
    .strict(),
  outputSchema: z.object({ sprites: z.array(SpriteOutput) }),
  readOnly: true,
  async run(input, session) {
    const result = await session.sprites(input.sprites ?? []);
    return { sprites: result.sprites.map((sprite) => ({ ...sprite, dataAddress: formatC64Address(sprite.dataAddress) })) };
  },
});

const CiaOutput = z.object({
  id: z.union([z.literal(1), z.literal(2)]),
  portA: Byte,
  portB: Byte,
  ddrA: Byte,
  ddrB: Byte,
  timerA: z.number().int().min(0).max(0xffff),
  timerB: z.number().int().min(0).max(0xffff),
  controlA: Byte,
  controlB: Byte,
  interruptStatus: Byte,
  tod: z.object({ hours: z.number().int(), minutes: z.number().int(), seconds: z.number().int(), tenths: z.number().int() }),
});

export const c64Cia = defineTool({
  name: "c64_cia",
  title: "CIA state",
  description:
    "Get the state of CIA 1, CIA 2 or both. The state has the ports, the data direction registers and the current timer values. " +
    `It also has the control registers, the interrupt flags and the time of day (hours 0 to 23). ${NO_CHANGE}`,
  inputSchema: z.object({ cia: z.enum(CIA_SELECTIONS).default("both") }).strict(),
  outputSchema: z.object({ chips: z.array(CiaOutput) }),
  readOnly: true,
  async run(input, session) {
    return session.cia(input.cia);
  },
});

export const c64Sid = defineTool({
  name: "c64_sid",
  title: "SID state",
  description:
    "Get the SID sound chip registers as the program last wrote them: the three voices, the filter and the volume. " +
    `This is register state, not an analysis of the sound. ${NO_CHANGE}`,
  inputSchema: z.object({}).strict(),
  outputSchema: z.object({
    voices: z.array(
      z.object({
        index: z.number().int().min(1).max(3),
        frequency: z.number().int(),
        pulseWidth: z.number().int(),
        control: Byte,
        attackDecay: Byte,
        sustainRelease: Byte,
      }),
    ),
    filter: z.object({ cutoff: z.number().int(), resonance: z.number().int(), routing: z.number().int(), mode: z.number().int() }),
    volume: z.number().int().min(0).max(15),
  }),
  readOnly: true,
  async run(_input, session) {
    return session.sid();
  },
});

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

export const videoTools = [c64Vicii, c64Sprite, c64Cia, c64Sid, c64Screen];
