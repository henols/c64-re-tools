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
// encoders only, and answers through stockAnswer() so the runState stamp
// is never missed.
//
// WHAT NOT TO DO:
//   - Never convert text to PETSCII inline. stock-petscii.ts's
//     asciiToPetscii() is the ONE conversion path -- a second hand-rolled
//     version here is exactly the failure mode that module's own header
//     comment warns about.
//   - Never send an EXIT so the queued keyboard buffer gets consumed.
//     This client never resumes the machine unasked. The answer says the
//     machine is halted; the agent resumes explicitly.
//   - Never add vice_joystick_tap. A tap needs the machine to run for a
//     measured interval, which needs an unasked resume.
//   - Never construct an ok-answer outside stockAnswer(). Every successful
//     result below is built through it, never a bare
//     `{ content: [...], isError: false }` literal.
import { CommandType, JOYPORT_DEVICE_IO_SIMULATION, joyportDeviceSetBody, joyportSetBody, keyboardFeedBody, memGetBody, resourceGetBody } from "./stock-protocol.ts";
import { asciiToPetscii, StockPetsciiError } from "./stock-petscii.ts";
import { convertWireError, isErrorText, stockAnswer, type StockSessionHandler, type StockToolResult } from "./stock-handler.ts";
import { resolveRequiredBank } from "./stock-memory.ts";
import type { StockConnectSession } from "./stock-connect.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's isPlainObject() predicate exactly -- the
 * same narrowing discipline this module tree uses everywhere a parsed JSON
 * value's fields are touched. Declared privately per this codebase's own
 * convention (re-declared per consuming module, never imported). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// vice_keyboard_type / vice_keyboard_petscii
// ---------------------------------------------------------------------------

/** Halted-machine note every keyboard answer carries: the bytes wait in the
 * keyboard buffer of a halted machine until the agent resumes it. */
const KEYBOARD_HALTED_NOTE =
  "Bytes are queued in the KERNAL keyboard buffer -- nothing consumes them until the machine runs. " +
  "This client never resumes the machine unasked; resume explicitly to have the buffer read.";

/**
 * vice_keyboard_type -- types `text` (converted to PETSCII via
 * stock-petscii.ts's asciiToPetscii()) into the keyboard buffer.
 * Arguments: `text` (required string), `petscii_upper` (optional boolean,
 * default true).
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
    // Refuse with the converter's own reason; never fall back to sending
    // the unconverted bytes.
    if (err instanceof StockPetsciiError) {
      return isErrorText(`vice_keyboard_type: ${err.message}`);
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

// ---------------------------------------------------------------------------
// vice_joystick_set -- and the deliberate absence of vice_joystick_tap
// ---------------------------------------------------------------------------

/**
 * The joystick switch bits, active high. The I/O simulation device reads
 * its lines active low (like the CIA port), so the handler sends
 * `~value & 0x1f` on the wire. Verified live against stock x64sc 3.8:
 * holding "up" on control port 2 clears bit 0 of $DC00.
 */
export const JOYPORT_BITS = { up: 0x01, down: 0x02, left: 0x04, right: 0x08, fire: 0x10 } as const;

const JOYPORT_LINES_IDLE = 0x1f;

/** The CIA1 data register each C64 control port reads through. */
const CIA_PORT_REGISTER = { 1: 0xdc01, 2: 0xdc00 } as const;

const VALID_DIRECTIONS = ["up", "down", "left", "right", "center"] as const;
type JoystickDirection = (typeof VALID_DIRECTIONS)[number];

function isValidDirection(value: string): value is JoystickDirection {
  return (VALID_DIRECTIONS as readonly string[]).includes(value);
}

/** The device each control port had before this tool attached the I/O
 * simulation device, keyed on `${targetId}:${port}`. A release puts it back. */
let savedJoyportDevices = new Map<string, number>();

/** Test-only: forgets every saved joyport device. */
export function resetJoyportDevicesForTest(): void {
  savedJoyportDevices = new Map();
}

async function readJoyportDevice(session: StockConnectSession, port: 1 | 2): Promise<number> {
  const response = await session.client.send(CommandType.ResourceGet, resourceGetBody({ name: `JoyPort${port}Device` }));
  if (response.type !== "resource_get" || response.valueType !== "integer") {
    throw new Error(`JoyPort${port}Device did not read back as an integer resource`);
  }
  return response.value;
}

type JoystickStep = { ok: true } | { ok: false; result: StockToolResult };

/** Attaches the I/O simulation device to `port` if it is not there yet, and
 * saves the device it replaced. Refuses when VICE does not keep it. */
async function attachIoSimulation(session: StockConnectSession, port: 1 | 2, current: number): Promise<JoystickStep> {
  if (current === JOYPORT_DEVICE_IO_SIMULATION) {
    return { ok: true };
  }
  try {
    await session.client.send(CommandType.ResourceSet, joyportDeviceSetBody({ controlPort: port, deviceId: JOYPORT_DEVICE_IO_SIMULATION }));
    const after = await readJoyportDevice(session, port);
    if (after !== JOYPORT_DEVICE_IO_SIMULATION) {
      return {
        ok: false,
        result: isErrorText(
          `vice_joystick_set: VICE did not attach the "Joyport I/O simulation" device to control port ${port} (JoyPort${port}Device reads ${after}), ` +
            `so the joystick lines cannot be driven -- use vice_keyboard_type or vice_keyboard_petscii for input instead`,
        ),
      };
    }
  } catch (err) {
    return { ok: false, result: convertWireError("vice_joystick_set", err) };
  }
  savedJoyportDevices.set(`${session.targetId}:${port}`, current);
  return { ok: true };
}

/**
 * vice_joystick_set -- composes the joystick switches from `direction`
 * (string or array of strings) and `fire`, and drives them onto C64
 * control port `port` (1 or 2, default 1).
 *
 * Stock VICE's JOYPORT_SET only reaches the CIA through the "Joyport I/O
 * simulation" device, so a hold first sets `JoyPort<port>Device` to that
 * device. A release (direction "center", fire false) puts back the device
 * the port had before. While the simulation device is attached, bits 5-7 of
 * the port's CIA register read 0. The answer reports the CIA register as
 * read back after the change.
 *
 * There is no vice_joystick_tap: a tap needs the machine to run for a
 * measured interval, and this client never resumes the machine unasked.
 */
export const handleJoystickSet: StockSessionHandler = async (args, session) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_joystick_set: arguments must be an object");
  }

  const portArg = args.port === undefined ? 1 : args.port;
  if (portArg !== 1 && portArg !== 2) {
    return isErrorText(`vice_joystick_set: port must be 1 or 2, got ${JSON.stringify(args.port)}`);
  }
  const port: 1 | 2 = portArg;

  const fireArg = args.fire === undefined ? false : args.fire;
  if (typeof fireArg !== "boolean") {
    return isErrorText("vice_joystick_set: fire must be a boolean");
  }
  const fire = fireArg;

  const rawDirection = args.direction === undefined ? "center" : args.direction;
  const directionInputs: unknown[] = Array.isArray(rawDirection) ? rawDirection : [rawDirection];

  const directions: JoystickDirection[] = [];
  for (let index = 0; index < directionInputs.length; index++) {
    const rawValue = directionInputs[index];
    const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : undefined;
    if (normalized === undefined || !isValidDirection(normalized)) {
      return isErrorText(
        `vice_joystick_set: direction[${index}] must be one of up, down, left, right, center -- got ${JSON.stringify(rawValue)}`,
      );
    }
    directions.push(normalized);
  }

  const hasUp = directions.includes("up");
  const hasDown = directions.includes("down");
  const hasLeft = directions.includes("left");
  const hasRight = directions.includes("right");
  const hasCenter = directions.includes("center");

  // No real joystick can close two opposite switches at once.
  if (hasUp && hasDown) {
    return isErrorText("vice_joystick_set: direction cannot contain both 'up' and 'down' -- no real joystick can assert two opposite switches at once");
  }
  if (hasLeft && hasRight) {
    return isErrorText("vice_joystick_set: direction cannot contain both 'left' and 'right' -- no real joystick can assert two opposite switches at once");
  }
  if (hasCenter && directions.length > 1) {
    return isErrorText("vice_joystick_set: 'center' cannot be combined with any other direction");
  }

  let value = 0;
  const valueBits: string[] = [];
  for (const direction of ["up", "down", "left", "right"] as const) {
    if (directions.includes(direction)) {
      value |= JOYPORT_BITS[direction];
      valueBits.push(direction);
    }
  }
  if (fire) {
    value |= JOYPORT_BITS.fire;
    valueBits.push("fire");
  }
  const lines = JOYPORT_LINES_IDLE & ~value;
  const release = value === 0;

  const bankResolution = await resolveRequiredBank("vice_joystick_set", "io", session);
  if (!bankResolution.ok) {
    return bankResolution.result;
  }

  let current: number;
  try {
    current = await readJoyportDevice(session, port);
  } catch (err) {
    return convertWireError("vice_joystick_set", err);
  }

  let device: "io-simulation" | "restored" | "unchanged";
  const key = `${session.targetId}:${port}`;
  if (!release) {
    const attached = await attachIoSimulation(session, port, current);
    if (!attached.ok) {
      return attached.result;
    }
    try {
      await session.client.send(CommandType.JoyportSet, joyportSetBody({ port: port - 1, value: lines }));
    } catch (err) {
      return convertWireError("vice_joystick_set", err);
    }
    device = "io-simulation";
  } else if (current === JOYPORT_DEVICE_IO_SIMULATION) {
    try {
      await session.client.send(CommandType.JoyportSet, joyportSetBody({ port: port - 1, value: lines }));
      const saved = savedJoyportDevices.get(key);
      if (saved !== undefined) {
        await session.client.send(CommandType.ResourceSet, joyportDeviceSetBody({ controlPort: port, deviceId: saved }));
        savedJoyportDevices.delete(key);
      }
      device = saved === undefined ? "io-simulation" : "restored";
    } catch (err) {
      return convertWireError("vice_joystick_set", err);
    }
  } else {
    // Nothing is held: the port's own device already reads idle.
    device = "unchanged";
  }

  const register = CIA_PORT_REGISTER[port];
  let response;
  try {
    response = await session.client.send(
      CommandType.MemoryGet,
      memGetBody({ sidefx: false, start: register, end: register, memspace: 0x00, bank: bankResolution.id }),
    );
  } catch (err) {
    return convertWireError("vice_joystick_set", err);
  }
  if (response.type !== "memory_get" || response.bytes.length !== 1) {
    return isErrorText(`vice_joystick_set: reading back $${register.toString(16).toUpperCase()} gave no byte -- the joystick state is not confirmed`);
  }

  return stockAnswer(session.client, {
    port,
    directions,
    fire,
    value,
    valueBits,
    lines,
    device,
    ciaRegister: `$${register.toString(16).toUpperCase()}`,
    ciaValue: response.bytes[0],
  });
};
