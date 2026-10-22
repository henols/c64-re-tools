// The inputs of the MCP tools that change or wait for the machine. The action
// steps of the scripts take the same fields, ranges and defaults (host-client/
// steps.ts, without zod, because the scripts install without packages);
// inputs.test.ts checks that both take the same inputs.

import { z } from "zod";

import { c64AddressOf } from "../c64.ts";
import { keyTaps, MAX_PRESS_FRAMES, PRESS_FRAMES } from "../c64-keys.ts";
import { DEFAULT_TIMEOUT_FRAMES, keyboardBytes, MAX_RASTER_LINE } from "../host-client/steps.ts";
import { COMPARISONS, CONDITION_REGISTERS, JOYSTICK_DIRECTIONS, MAX_KEYBOARD_BYTES, MAX_MEMORY_WRITE, MAX_TIMEOUT_FRAMES, MEMORY_VIEWS, SPACES } from "../protocol/vice.ts";

export const Byte = z.number().int().min(0).max(255);

/** Input bytes: hex in either case, two digits per byte, at least one byte. Parses to lowercase. */
export const HexDataInput = z
  .string()
  .regex(/^(?:[0-9a-fA-F]{2})+$/, "must be hex bytes, two digits per byte, no separators, for example a9008d20d0")
  .transform((value) => value.toLowerCase());

export const SpaceInput = z.enum(SPACES).default("c64").describe("c64 is the computer. drive8 is the 1541 disk drive CPU");

export const MemoryViewInput = z
  .enum(MEMORY_VIEWS)
  .default("cpu")
  .describe("cpu reads what the CPU sees now (ROM and I/O where banked in). ram reads the RAM underneath (c64 only)");

/** A tool address: $ and 1 to 4 hex digits, either case. Parses to a number. */
export const AddressInput = z
  .string()
  .refine((value) => c64AddressOf(value) !== undefined, {
    message: "must be $ and 1 to 4 hex digits, for example $c000 or $fb. A tool takes no names: get the address of the name from the project knowledge",
  })
  .transform((value) => c64AddressOf(value)!)
  .describe("C64 address: $ and 1 to 4 hex digits, $0000 to $ffff");

/** The space of a memory target or condition: the emulator tests only C64 memory. */
const MemorySpaceInput = SpaceInput.describe("c64 only: the emulator tests only C64 memory. For the drive, use a watchpoint or an address target in space drive8");

const rasterLine = z.number().int().min(0).max(MAX_RASTER_LINE).describe("raster line: PAL 0-311, NTSC 0-262");

const condition = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("register"), register: z.enum(CONDITION_REGISTERS), operator: z.enum(COMPARISONS), value: Byte }).strict(),
    z.object({ kind: z.literal("memory"), address: AddressInput, operator: z.enum(COMPARISONS), value: Byte, space: MemorySpaceInput, view: MemoryViewInput }).strict(),
    z.object({ kind: z.literal("raster"), line: rasterLine, cycle: z.number().int().min(0).max(64).optional().describe("cycle in the line: PAL 0-62, NTSC 0-64. True from this cycle on") }).strict(),
  ])
  .describe("register: a CPU register compared to a byte. memory: a byte in memory compared to a byte. raster: the raster position");

const flags = z.object({ n: z.boolean(), v: z.boolean(), b: z.boolean(), d: z.boolean(), i: z.boolean(), z: z.boolean(), c: z.boolean() });

export const TOOL_INPUTS = {
  condition,

  runTarget: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("address"), address: AddressInput, space: SpaceInput, condition: condition.optional().describe("stop at the address only when this is true") }).strict(),
    z.object({ kind: z.literal("memory"), address: AddressInput, operator: z.enum(COMPARISONS), value: Byte, space: MemorySpaceInput, view: MemoryViewInput }).strict(),
    z.object({ kind: z.literal("raster"), line: rasterLine, cycle: z.number().int().min(0).max(64).optional().describe("cycle in the line: PAL 0-62, NTSC 0-64. Default 0") }).strict(),
  ]),

  timeoutFrames: z.number().int().min(1).max(MAX_TIMEOUT_FRAMES).default(DEFAULT_TIMEOUT_FRAMES),

  memoryWrite: z
    .object({
      address: AddressInput,
      data: HexDataInput.describe("bytes as hex, two digits per byte, no separators, for example a9008d20d0"),
      space: SpaceInput,
      view: MemoryViewInput,
    })
    .strict()
    .refine((value) => value.data.length / 2 <= MAX_MEMORY_WRITE, { message: `data has at most ${MAX_MEMORY_WRITE} bytes`, path: ["data"] }),

  flags,

  registerValues: z
    .object({
      pc: AddressInput.optional(),
      a: Byte.optional(),
      x: Byte.optional(),
      y: Byte.optional(),
      sp: Byte.optional(),
      flags: flags.partial().strict().optional().describe("any of n, v, b, d, i, z and c. Flags that you do not name keep their value"),
    })
    .strict()
    .refine((value) => Object.entries(value).some(([name, item]) => item !== undefined && !(name === "flags" && Object.keys(item as object).length === 0)), { message: "name at least one register" }),

  joystick: z
    .object({
      port: z.union([z.literal(1), z.literal(2)], { error: "port must be the number 1 or 2" }).describe("control port 1 or 2"),
      direction: z.enum(JOYSTICK_DIRECTIONS),
      fire: z.boolean().default(false),
    })
    .strict(),

  press: z
    .object({
      keys: z.string().min(1).describe("the keys: each character is one tap, a name in braces is one key, for example {F1}, and + in braces holds keys together, for example {LSHIFT+CBM}"),
      frames: z.number().int().min(1).max(MAX_PRESS_FRAMES).default(PRESS_FRAMES).describe("the frames that each tap holds its keys, and then waits with all keys up"),
    })
    .strict()
    .superRefine((value, context) => {
      const taps = keyTaps(value.keys);
      if (typeof taps === "string") context.addIssue({ code: "custom", message: taps, path: ["keys"] });
    }),

  keyboard: z
    .object({
      mode: z.enum(["text", "petscii"]),
      text: z.string().min(1).optional().describe("mode text: the text to type"),
      bytes: z.array(z.number().int().min(1).max(255)).min(1).optional().describe("mode petscii: PETSCII codes to type"),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.mode === "text" && (value.text === undefined || value.bytes !== undefined)) return context.addIssue({ code: "custom", message: "mode text takes text and no bytes" });
      if (value.mode === "petscii" && (value.bytes === undefined || value.text !== undefined)) return context.addIssue({ code: "custom", message: "mode petscii takes bytes and no text" });
      const keys = keyboardBytes(value);
      if (typeof keys === "string") context.addIssue({ code: "custom", message: keys, path: ["text"] });
      else if (keys.length > MAX_KEYBOARD_BYTES) context.addIssue({ code: "custom", message: `the keyboard queue takes at most ${MAX_KEYBOARD_BYTES} keys at once. This input has ${keys.length} keys` });
    }),
};
