// Input tools: c64_keyboard and c64_joystick.

import { z } from "zod";

import { JOYSTICK_DIRECTIONS, MAX_KEYBOARD_BYTES } from "../../protocol/vice.ts";
import { keyboardBytes } from "../../host-client/steps.ts";
import { TOOL_INPUTS } from "../inputs.ts";
import { defineTool } from "../server.ts";

const EMULATOR_FLAW = z.string().optional().describe("a known flaw of the emulator version that affects input, and the version that fixes it");

export const c64Keyboard = defineTool({
  name: "c64_keyboard",
  title: "Type on the C64 keyboard",
  description:
    `Type up to ${MAX_KEYBOARD_BYTES} keys into the C64 keyboard queue. The C64 reads them while it runs. ` +
    "Only a program that reads keys through the KERNAL sees them. A program that reads the keyboard hardware directly does not see them. Many games do that. " +
    "No command presses one key of the keyboard matrix: for one specific key, ask the user to press it in the window. " +
    'Mode text types text, for example "RUN\\n". Letters of either case type the normal (unshifted) key. A line break types RETURN. ' +
    "Mode petscii types PETSCII codes 1 to 255 in bytes, for example [147] to clear the screen. " +
    "This does not change the run state of the machine. emulatorFlaw in the result names a known flaw of the emulator version that affects input, and the version that fixes it.",
  inputSchema: TOOL_INPUTS.keyboard,
  outputSchema: z.object({ queuedBytes: z.number().int().min(1).max(MAX_KEYBOARD_BYTES), emulatorFlaw: EMULATOR_FLAW }),
  readOnly: false,
  async run(input, session) {
    // The schema checked the keys: keyboardBytes gives bytes here.
    const petscii = keyboardBytes(input) as Uint8Array;
    return session.keyboard(petscii);
  },
});

export const c64Joystick = defineTool({
  name: "c64_joystick",
  title: "Move a joystick",
  description:
    "Set the joystick in control port 1 or 2: a direction (or center) and the fire button. " +
    "The C64 sees this state until you change it. To release the joystick, set direction center and fire false. " +
    "Most games read port 2. This does not change the run state of the machine. emulatorFlaw in the result names a known flaw of the emulator version that affects input, and the version that fixes it.",
  inputSchema: TOOL_INPUTS.joystick,
  outputSchema: z.object({ port: z.union([z.literal(1), z.literal(2)]), direction: z.enum(JOYSTICK_DIRECTIONS), fire: z.boolean(), emulatorFlaw: EMULATOR_FLAW }),
  readOnly: false,
  async run(input, session) {
    return session.joystick(input);
  },
});

export const inputTools = [c64Keyboard, c64Joystick];
