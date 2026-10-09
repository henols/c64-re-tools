// Video and chip tools: c64_vicii, c64_sprite, c64_cia, c64_sid, c64_screen
// and c64_observe.

import { z } from "zod";

import { formatC64Address } from "../../c64.ts";
import { CIA_SELECTIONS, MAX_MEMORY_READ, MAX_OBSERVE_BYTES, MAX_OBSERVE_RANGES, SPACES, VICII_MODES, WireFailure, type ObserveParams } from "../../protocol.ts";
import { AddressInput, AddressOutput, Byte, defineTool, HexData, MemoryViewInput, requireFields, SpaceInput, ToolOutput, TransientName } from "../server.ts";

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

const Rectangle = z
  .object({ x: z.number().int().min(0), y: z.number().int().min(0), width: z.number().int().min(1), height: z.number().int().min(1) })
  .strict();

export const c64Screen = defineTool({
  name: "c64_screen",
  title: "Capture and compare the C64 screen",
  description:
    "Action capture returns the last frame the C64 drew, with its borders, as a PNG image, plus its width and height in pixels. " +
    "With baseline, the session also keeps that frame under the name. " +
    "Action compare compares the current frame with a baseline, pixel by pixel. mask lists rectangles to ignore. " +
    "match is true when the part of compared pixels that differ is at most maxMismatchRatio (default 0). bounds holds every different pixel. " +
    "With includeDiff, compare also returns an image with the different pixels in magenta. " +
    "Action list gives the baseline names. Action discard removes a baseline. Baselines stay until the session ends. " +
    "The emulator draws frames while the CPU runs. After the CPU stops, the frame stays the same. " +
    "This tool does not change if the machine is running or stopped.",
  inputSchema: z
    .object({
      action: z.enum(["capture", "compare", "list", "discard"]),
      baseline: TransientName.optional().describe("capture: keep the frame under this name; compare and discard: the baseline to use"),
      maxMismatchRatio: z.number().min(0).max(1).optional().describe("compare only: 0 to 1, default 0"),
      mask: z.array(Rectangle).max(64).optional().describe("compare only: rectangles to ignore, in frame pixels"),
      includeDiff: z.boolean().optional().describe("compare only: also return a difference image"),
    })
    .strict(),
  outputSchema: z.object({
    width: z.number().int().min(1).optional(),
    height: z.number().int().min(1).optional(),
    baseline: z.string().optional(),
    match: z.boolean().optional(),
    mismatchingPixels: z.number().int().min(0).optional(),
    mismatchRatio: z.number().min(0).max(1).optional(),
    bounds: Rectangle.optional(),
    baselines: z.array(z.string()).optional(),
    discarded: z.boolean().optional(),
  }),
  readOnly: false,
  async run(input, session) {
    const { action, ...fields } = input;
    if (action === "capture") {
      requireFields(action, fields, ["baseline"]);
      const shot = await session.screenCapture(fields.baseline);
      const result = { width: shot.width, height: shot.height, ...(shot.baseline === undefined ? {} : { baseline: shot.baseline }) };
      return new ToolOutput(result, [{ type: "image", data: shot.png, mimeType: "image/png" }]);
    }
    if (action === "compare") {
      requireFields(action, fields, ["baseline", "maxMismatchRatio", "mask", "includeDiff"], ["baseline"]);
      const { diffPng, ...result } = await session.screenCompare({
        baseline: fields.baseline!,
        maxMismatchRatio: fields.maxMismatchRatio ?? 0,
        mask: fields.mask ?? [],
        includeDiff: fields.includeDiff ?? false,
      });
      return diffPng === undefined ? result : new ToolOutput(result, [{ type: "image", data: diffPng, mimeType: "image/png" }]);
    }
    if (action === "list") {
      requireFields(action, fields, []);
      return session.screenBaselines();
    }
    requireFields(action, fields, ["baseline"], ["baseline"]);
    return session.screenDiscard(fields.baseline!);
  },
});

const FlagsOutput = z.object({ n: z.boolean(), v: z.boolean(), b: z.boolean(), d: z.boolean(), i: z.boolean(), z: z.boolean(), c: z.boolean() });

export const c64Observe = defineTool({
  name: "c64_observe",
  title: "Observe several things at one moment",
  description:
    "Get several observations from one moment: the CPU stops once, all of them are read, and then the CPU continues if it was running. " +
    "Ask for any of registers (a space), memory ranges, vicii, sprites, cia, sid, screen and timing (the raster position). " +
    `Ask for at least one. Use at most ${MAX_OBSERVE_RANGES} memory ranges with at most ${MAX_OBSERVE_BYTES} bytes together. ` +
    "The result has only the parts you asked for. With screen, an image comes with the result.",
  inputSchema: z
    .object({
      registers: z.enum(SPACES).optional().describe("the space whose CPU registers to read"),
      memory: z
        .array(
          z
            .object({ address: AddressInput, size: z.number().int().min(1).max(MAX_MEMORY_READ), space: SpaceInput, view: MemoryViewInput })
            .strict(),
        )
        .min(1)
        .max(MAX_OBSERVE_RANGES)
        .optional(),
      vicii: z.boolean().optional(),
      sprites: z.array(z.number().int().min(0).max(7)).min(1).max(8).optional().describe("sprite numbers 0 to 7, each once"),
      cia: z.enum(CIA_SELECTIONS).optional(),
      sid: z.boolean().optional(),
      screen: z.boolean().optional(),
      timing: z.boolean().optional(),
    })
    .strict(),
  outputSchema: z.object({
    registers: z.object({ pc: AddressOutput, a: Byte, x: Byte, y: Byte, sp: Byte, flags: FlagsOutput }).optional(),
    memory: z.array(z.object({ address: AddressOutput, data: HexData })).optional(),
    vicii: c64Vicii.outputSchema.optional(),
    sprites: z.array(SpriteOutput).optional(),
    cia: z.array(CiaOutput).optional(),
    sid: c64Sid.outputSchema.optional(),
    screen: z.object({ width: z.number().int(), height: z.number().int() }).optional(),
    timing: z.object({ rasterLine: z.number().int(), rasterCycle: z.number().int() }).optional(),
  }),
  readOnly: true,
  async run(input, session) {
    const params: ObserveParams = {};
    if (input.registers !== undefined) params.registers = input.registers;
    if (input.memory !== undefined) params.memory = input.memory;
    if (input.vicii === true) params.vicii = true;
    if (input.sprites !== undefined) params.sprites = input.sprites;
    if (input.cia !== undefined) params.cia = input.cia;
    if (input.sid === true) params.sid = true;
    if (input.screen === true) params.screen = true;
    if (input.timing === true) params.timing = true;
    if (Object.keys(params).length === 0) throw new WireFailure("invalid-input", "Ask for at least one observation.");
    const observed = await session.observe(params);
    const result: Record<string, unknown> = {};
    if (observed.registers !== undefined) result.registers = { ...observed.registers, pc: formatC64Address(observed.registers.pc) };
    if (observed.memory !== undefined) result.memory = observed.memory.map((range) => ({ ...range, address: formatC64Address(range.address) }));
    if (observed.vicii !== undefined) {
      result.vicii = {
        ...observed.vicii,
        screenAddress: formatC64Address(observed.vicii.screenAddress),
        graphicsAddress: formatC64Address(observed.vicii.graphicsAddress),
      };
    }
    if (observed.sprites !== undefined) result.sprites = observed.sprites.map((sprite) => ({ ...sprite, dataAddress: formatC64Address(sprite.dataAddress) }));
    if (observed.cia !== undefined) result.cia = observed.cia;
    if (observed.sid !== undefined) result.sid = observed.sid;
    if (observed.timing !== undefined) result.timing = observed.timing;
    if (observed.screen === undefined) return result;
    result.screen = { width: observed.screen.width, height: observed.screen.height };
    return new ToolOutput(result, [{ type: "image", data: observed.screen.png, mimeType: "image/png" }]);
  },
});

export const videoTools = [c64Vicii, c64Sprite, c64Cia, c64Sid, c64Screen, c64Observe];
