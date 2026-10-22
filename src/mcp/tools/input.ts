// Input tools: keyboard, press and joystick.

import { z } from "zod";

import { formatAddress } from "../../address.ts";
import { keyTaps, MAX_PRESS_TAPS, MAX_TAP_KEYS, PRESS_FRAMES, type KeyTap } from "../../c64-keys.ts";
import { JOYSTICK_DIRECTIONS, MAX_KEYBOARD_BYTES, POINT_STOP_REASONS, RUN_STATES, SPACES } from "../../protocol/vice.ts";
import { keyboardBytes } from "../../host-client/steps.ts";
import { TOOL_INPUTS } from "../inputs.ts";
import { AddressOutput, defineTool } from "../server.ts";


export const c64Keyboard = defineTool({
  name: "keyboard",
  title: "Type on the C64 keyboard",
  description:
    `Type up to ${MAX_KEYBOARD_BYTES} keys into the C64 keyboard queue. The C64 reads them while it runs. ` +
    "Only a program that reads keys through the KERNAL sees them. A program that reads the keyboard hardware directly does not see them. Many games do that. " +
    "For keys that a program reads from the keyboard hardware, use press. " +
    'Mode text types text, for example "RUN\\n". Letters of either case type the normal (unshifted) key. A line break types RETURN. ' +
    "Mode petscii types PETSCII codes 1 to 255 in bytes, for example [147] to clear the screen. " +
    "While autostart loads a program, this tool refuses keys: see autostart. " +
    "This does not change the run state of the machine.",
  inputSchema: TOOL_INPUTS.keyboard,
  outputSchema: z.object({ queuedBytes: z.number().int().min(1).max(MAX_KEYBOARD_BYTES) }),
  readOnly: false,
  async run(input, session) {
    // The schema checked the keys: keyboardBytes gives bytes here.
    const petscii = keyboardBytes(input) as Uint8Array;
    return session.keyboard(petscii);
  },
});

export const c64Press = defineTool({
  name: "press",
  title: "Press keys of the C64 keyboard",
  description:
    "Press keys of the C64 keyboard matrix, and RESTORE. A program that reads the keyboard hardware directly sees these keys. Many games do that. " +
    "Each character of keys is one tap: the key goes down, then up. Letters of either case press the same key. A line break presses RETURN. " +
    "A key without a character has its name in braces: {F1} to {F8}, {RETURN}, {SPACE}, {DEL}, {INST}, {HOME}, {CLR}, {STOP}, {RUN} and {RESTORE}. " +
    "The other names are {CTRL}, {CBM}, {LSHIFT}, {RSHIFT}, {UP}, {DOWN}, {LEFT}, {RIGHT}, {POUND}, {UPARROW} and {LEFTARROW}. " +
    "{F2}, {RUN}, {CLR}, {INST}, {UP} and {LEFT} also press the left SHIFT. " +
    `Join keys with + in braces to hold them together in one tap, for example {LSHIFT+CBM}, {CTRL+3} or {STOP+RESTORE}. One tap holds at most ${MAX_TAP_KEYS} keys, RESTORE included. One call has at most ${MAX_PRESS_TAPS} taps. ` +
    `Each tap holds its keys for frames frames (default ${PRESS_FRAMES}). Then all keys are up for frames frames. The machine runs during the taps, and it runs again after them when it ran before. ` +
    "A breakpoint, watchpoint or JAM stops the taps early. Then stopReason tells why, taps tells how many taps were complete, and the machine stays stopped. All keys are up at the end. " +
    "The CPU history starts again at each tap. " +
    "To type text through the KERNAL keyboard queue, use keyboard.",
  inputSchema: TOOL_INPUTS.press,
  outputSchema: z.object({
    taps: z.number().int().min(0).max(MAX_PRESS_TAPS).describe("the taps that were complete"),
    state: z.enum(RUN_STATES),
    stopReason: z.enum(POINT_STOP_REASONS).optional().describe("why the taps stopped early"),
    pc: AddressOutput.optional(),
    pointId: z.number().int().min(1).optional().describe("the id of the breakpoint or watchpoint that stopped the taps"),
    space: z.enum(SPACES).optional().describe("the CPU that stopped, c64 or drive8. pc is the address in that space"),
  }),
  readOnly: false,
  async run(input, session) {
    // The schema checked the keys: keyTaps gives taps here.
    const { pc, ...result } = await session.press(keyTaps(input.keys) as KeyTap[], input.frames);
    return { ...result, ...(pc === undefined ? {} : { pc: formatAddress(pc) }) };
  },
});

export const c64Joystick = defineTool({
  name: "joystick",
  title: "Move a joystick",
  description:
    "Set the joystick in control port 1 or 2: a direction (or center) and the fire button. " +
    "The C64 sees this state until you change it. To release the joystick, set direction center and fire false. " +
    "Most games read port 2. This does not change the run state of the machine.",
  inputSchema: TOOL_INPUTS.joystick,
  outputSchema: z.object({ port: z.union([z.literal(1), z.literal(2)]), direction: z.enum(JOYSTICK_DIRECTIONS), fire: z.boolean() }),
  readOnly: false,
  async run(input, session) {
    return session.joystick(input);
  },
});

export const inputTools = [c64Keyboard, c64Press, c64Joystick];
