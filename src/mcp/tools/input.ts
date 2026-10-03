// Input tools: c64_keyboard (15 §31) and c64_joystick (15 §32).

import { z } from "zod";

import { textToPetscii } from "../../c64.ts";
import { JOYSTICK_DIRECTIONS, MAX_KEYBOARD_BYTES, WireFailure } from "../../protocol.ts";
import { defineTool } from "../server.ts";

export const c64Keyboard = defineTool({
  name: "c64_keyboard",
  title: "Type on the C64 keyboard",
  description:
    `Type up to ${MAX_KEYBOARD_BYTES} keys into the C64 keyboard queue; the C64 reads them while it runs. ` +
    'Mode text types text, for example "RUN\\n": letters of either case type the normal (unshifted) key, and a line break types RETURN. ' +
    "Mode petscii types PETSCII codes 1 to 255 in bytes, for example [147] to clear the screen. " +
    "This does not change if the machine is running or stopped.",
  inputSchema: z
    .object({
      mode: z.enum(["text", "petscii"]),
      text: z.string().min(1).optional().describe("mode text: the text to type"),
      bytes: z.array(z.number().int().min(1).max(255)).min(1).optional().describe("mode petscii: PETSCII codes to type"),
    })
    .strict(),
  outputSchema: z.object({ queuedBytes: z.number().int().min(1).max(MAX_KEYBOARD_BYTES) }),
  readOnly: false,
  async run(input, session) {
    let petscii: Uint8Array;
    if (input.mode === "text") {
      if (input.text === undefined || input.bytes !== undefined) throw new WireFailure("invalid-input", "Mode text takes text and no bytes.");
      try {
        petscii = textToPetscii(input.text);
      } catch (error) {
        throw new WireFailure("invalid-input", `${(error as Error).message}. Use mode petscii for other keys.`);
      }
    } else {
      if (input.bytes === undefined || input.text !== undefined) throw new WireFailure("invalid-input", "Mode petscii takes bytes and no text.");
      petscii = Uint8Array.from(input.bytes);
    }
    if (petscii.length > MAX_KEYBOARD_BYTES) {
      throw new WireFailure("invalid-input", `At most ${MAX_KEYBOARD_BYTES} keys can be queued at once; this is ${petscii.length}.`);
    }
    return session.keyboard(petscii);
  },
});

export const c64Joystick = defineTool({
  name: "c64_joystick",
  title: "Move a joystick",
  description:
    "Set the joystick in control port 1 or 2: a direction (or center) and the fire button. " +
    "The C64 sees this state until you change it; set direction center and fire false to release. " +
    "Most games read port 2. This does not change if the machine is running or stopped.",
  inputSchema: z
    .object({
      port: z.union([z.literal(1), z.literal(2)]).describe("control port 1 or 2"),
      direction: z.enum(JOYSTICK_DIRECTIONS),
      fire: z.boolean().default(false),
    })
    .strict(),
  outputSchema: z.object({ port: z.union([z.literal(1), z.literal(2)]), direction: z.enum(JOYSTICK_DIRECTIONS), fire: z.boolean() }),
  readOnly: false,
  async run(input, session) {
    return session.joystick(input);
  },
});

export const inputTools = [c64Keyboard, c64Joystick];
