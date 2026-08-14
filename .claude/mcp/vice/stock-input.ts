#!/usr/bin/env node
// stock-input.ts
//
// THE keyboard and joystick handlers for Family D: vice_keyboard_type,
// vice_keyboard_petscii, and vice_joystick_set. Ships the input half of the
// tool families this milestone builds on stock VICE's binary monitor.
//
// WHY THIS FILE EXISTS: KEYBOARD_FEED (0x72) and JOYPORT_SET (0xa2) are
// thin wire opcodes -- the argument validation, ASCII->PETSCII conversion
// routing, and the composed-value bookkeeping that make them safe and
// legible to an agent all have to live somewhere. This is that somewhere:
// every handler here follows the shared StockSessionHandler contract
// (stock-handler.ts), builds its wire body through stock-protocol.ts's
// encoders only, and answers through stockAnswer() so D-06's runState stamp
// is never missed.
//
// WHAT NOT TO DO:
//   - Never convert text to PETSCII inline. stock-petscii.ts's
//     asciiToPetscii() is the ONE conversion path -- a second hand-rolled
//     version here is exactly the failure mode that module's own header
//     comment warns about.
//   - Never send an EXIT so the queued keyboard buffer gets consumed.
//     D-05 is absolute: this client never issues a resume the agent did not
//     explicitly ask for. The answer says the machine is halted; the agent
//     resumes explicitly, on its own schedule.
//   - Never add vice_joystick_tap. A tap needs the machine to RUN for a
//     measured interval -- an unrequested EXIT (forbidden by D-05) plus a
//     frame/cycle measurement that does not exist on stock until Phase 7's
//     timing route lands (docs/stock-vice-parity.md section A item 7).
//     vice_joystick_set (hold/release/centre) satisfies DIRECT-07's
//     joystick half in the meantime.
//   - Never construct an ok-answer outside stockAnswer(). Every successful
//     result below is built through it, never a bare
//     `{ content: [...], isError: false }` literal.
import { CommandType, keyboardFeedBody } from "./stock-protocol.ts";
import { asciiToPetscii, StockPetsciiError } from "./stock-petscii.ts";
import { convertWireError, isErrorText, stockAnswer, type StockSessionHandler } from "./stock-handler.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches vice.ts's own isPlainObject() predicate exactly -- the
 * same narrowing discipline this module tree uses everywhere a parsed JSON
 * value's fields are touched. Declared privately per this codebase's own
 * convention (re-declared per consuming module, never imported). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// vice_keyboard_type / vice_keyboard_petscii
// ---------------------------------------------------------------------------

/** Halted-machine note every keyboard answer carries -- docs/stock-vice-parity.md
 * section A item 7's recorded divergence: input lands in the buffer of a
 * machine now halted (D-05: any command halts it), and nothing consumes the
 * buffer until the agent explicitly resumes. */
const KEYBOARD_HALTED_NOTE =
  "Bytes are queued in the KERNAL keyboard buffer -- nothing consumes them until the machine runs. " +
  "This client never issues an unrequested resume (D-05); resume explicitly to have the buffer read.";

/**
 * vice_keyboard_type -- types `text` (converted to PETSCII via
 * stock-petscii.ts's asciiToPetscii()) into the keyboard buffer.
 * Arguments: `text` (required string), `petscii_upper` (optional boolean,
 * default true) -- the fork's exact argument names, including the
 * snake_case `petscii_upper`.
 */
export const handleKeyboardType: StockSessionHandler = async (args, session) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_keyboard_type: arguments must be an object");
  }

  const { text, petscii_upper: petsciiUpperArg } = args;
  if (typeof text !== "string") {
    return isErrorText("vice_keyboard_type: text is required and must be a string");
  }
  if (petsciiUpperArg !== undefined && typeof petsciiUpperArg !== "boolean") {
    return isErrorText("vice_keyboard_type: petscii_upper must be a boolean");
  }
  const petsciiUpper = petsciiUpperArg === undefined ? true : petsciiUpperArg;

  let petscii: Buffer;
  try {
    petscii = asciiToPetscii(text, { upper: petsciiUpper });
  } catch (err) {
    // A StockPetsciiError's own message is returned VERBATIM -- never
    // re-worded, and never a fallback to sending the raw, unconverted
    // bytes instead.
    if (err instanceof StockPetsciiError) {
      return isErrorText(err.message);
    }
    throw err;
  }

  const body = keyboardFeedBody({ petscii });
  try {
    await session.client.send(CommandType.KeyboardFeed, body);
  } catch (err) {
    return convertWireError("vice_keyboard_type", err);
  }

  return stockAnswer(session.client, {
    text,
    petsciiUpper,
    byteCount: petscii.length,
    petsciiHex: petscii.toString("hex"),
    note: KEYBOARD_HALTED_NOTE,
  });
};

/**
 * vice_keyboard_petscii -- feeds explicit, already-PETSCII bytes into the
 * keyboard buffer with no conversion. This is the deliberate escape hatch
 * handleKeyboardType()'s control-code refusal points callers at: a caller
 * that genuinely wants a PETSCII control code (e.g. 0x93, clear screen)
 * states it here, one byte at a time, rather than through an ASCII string.
 * Argument: `data` (required array of integers, 1-255 elements, each
 * 0x00-0xff).
 */
export const handleKeyboardPetscii: StockSessionHandler = async (args, session) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_keyboard_petscii: arguments must be an object");
  }

  const { data } = args;
  if (!Array.isArray(data)) {
    return isErrorText("vice_keyboard_petscii: data is required and must be an array");
  }
  if (data.length === 0) {
    return isErrorText("vice_keyboard_petscii: data must not be empty");
  }
  if (data.length > 255) {
    return isErrorText(`vice_keyboard_petscii: data exceeds 255 bytes (${data.length}) -- KEYBOARD_FEED's textLen field is a uint8`);
  }
  for (let index = 0; index < data.length; index++) {
    const value: unknown = data[index];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0x00 || value > 0xff) {
      return isErrorText(`vice_keyboard_petscii: data[${index}] must be an integer in 0..0xff, got ${JSON.stringify(value)}`);
    }
  }

  const petscii = Buffer.from(data as number[]);
  const body = keyboardFeedBody({ petscii });
  try {
    await session.client.send(CommandType.KeyboardFeed, body);
  } catch (err) {
    return convertWireError("vice_keyboard_petscii", err);
  }

  return stockAnswer(session.client, {
    byteCount: petscii.length,
    petsciiHex: petscii.toString("hex"),
    note: KEYBOARD_HALTED_NOTE,
  });
};
