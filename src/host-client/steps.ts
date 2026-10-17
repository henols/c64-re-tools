// The action steps of the step language: write, registers, joystick,
// type, frames and runUntil. c64-testing scenarios and the c64-unpacker
// steps file share them; each caller adds its own steps around them.

import { parseC64Address, textToPetscii } from "../c64.ts";
import { JOYSTICK_DIRECTIONS, MAX_EXECUTION_COUNT, MAX_KEYBOARD_BYTES, MAX_MEMORY_WRITE, MAX_TIMEOUT_FRAMES } from "../protocol/vice.ts";
import type { RunTarget, RunUntilResult } from "../protocol/vice.ts";
import type { ViceSessionClient } from "./vice-session.ts";

/** A "$xxxx" address, or a symbol name where the caller resolves names. */
export type Location = string;

type JoystickDirection = (typeof JOYSTICK_DIRECTIONS)[number];

export type ActionStep =
  | { write: { at: Location; bytes: number[] } }
  | { registers: Partial<Record<"pc" | "a" | "x" | "y" | "sp", number | Location>> }
  | { joystick: { port: 1 | 2; direction: JoystickDirection; fire?: boolean } }
  | { type: string }
  | { frames: number }
  | { runUntil: { at: Location; raster?: number } | { raster: number } | { memory: { at: Location; equals: number } }; timeoutFrames: number };

/** The highest raster line of a PAL frame; an NTSC frame has fewer, which the emulator checks. */
const MAX_RASTER_LINE = 311;

export const ACTION_STEP_KINDS = ["write", "registers", "joystick", "type", "frames", "runUntil"] as const;

/** The keys a step of each kind can have, when it is more than the kind itself. */
export const ACTION_STEP_KEYS: Record<string, readonly string[]> = { runUntil: ["runUntil", "timeoutFrames"] };

/** The registers a registers step can set. */
export const SET_REGISTERS = ["pc", "a", "x", "y", "sp"];

export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export const isInteger = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** Checks a "$xxxx" address, or also a symbol name when `names` allows it. */
export function checkLocation(value: unknown, what: string, fail: (message: string) => never, names = true): void {
  if (typeof value !== "string" || value === "") fail(`${what} must be a $ address${names ? " or a symbol name" : ""}`);
  if ((value as string).startsWith("$")) {
    try {
      parseC64Address(value as string);
    } catch {
      fail(`${what} must be $ followed by four hex digits, not ${value as string}`);
    }
  } else if (!names) {
    fail(`${what} must be $ followed by four hex digits, not ${value as string}`);
  }
}

/** Checks one action step of the given kind. `names` says whether symbol names may stand for addresses. */
export function checkActionStep(kind: string, step: Record<string, unknown>, at: string, fail: (message: string) => never, names = true): void {
  switch (kind) {
    case "write": {
      const write = step.write;
      if (!isObject(write) || Object.keys(write).some((key) => key !== "at" && key !== "bytes")) return fail(`${at}: write needs at and bytes, and nothing else`);
      checkLocation(write.at, `${at}: write.at`, fail, names);
      if (!Array.isArray(write.bytes) || write.bytes.length === 0 || write.bytes.length > MAX_MEMORY_WRITE || !write.bytes.every((byte) => isInteger(byte, 0, 0xff))) {
        fail(`${at}: write.bytes must be a list of 1 to ${MAX_MEMORY_WRITE} numbers from 0 to 255`);
      }
      return;
    }
    case "registers": {
      const registers = step.registers;
      if (!isObject(registers) || Object.keys(registers).length === 0) return fail(`${at}: registers must name at least one of ${SET_REGISTERS.join(", ")}`);
      for (const [name, value] of Object.entries(registers)) {
        if (!SET_REGISTERS.includes(name)) fail(`${at}: registers can set only ${SET_REGISTERS.join(", ")}, not ${name}`);
        if (typeof value === "string") checkLocation(value, `${at}: registers.${name}`, fail, names);
        else if (!isInteger(value, 0, name === "pc" ? 0xffff : 0xff)) fail(`${at}: registers.${name} must be ${names ? "a symbol name, " : ""}a $ address or a number from 0 to ${name === "pc" ? 65535 : 255}`);
      }
      return;
    }
    case "joystick": {
      const joystick = step.joystick;
      if (!isObject(joystick) || Object.keys(joystick).some((key) => !["port", "direction", "fire"].includes(key))) return fail(`${at}: joystick needs port and direction, and fire is optional`);
      if (joystick.port !== 1 && joystick.port !== 2) fail(`${at}: joystick.port must be 1 or 2`);
      if (!(JOYSTICK_DIRECTIONS as readonly unknown[]).includes(joystick.direction)) fail(`${at}: joystick.direction must be one of ${JOYSTICK_DIRECTIONS.join(", ")}`);
      if (joystick.fire !== undefined && typeof joystick.fire !== "boolean") fail(`${at}: joystick.fire must be true or false`);
      return;
    }
    case "type": {
      if (typeof step.type !== "string" || step.type === "") return fail(`${at}: type needs text`);
      let bytes: Uint8Array;
      try {
        bytes = textToPetscii(step.type);
      } catch (error) {
        return fail(`${at}: ${(error as Error).message}`);
      }
      if (bytes.length > MAX_KEYBOARD_BYTES) fail(`${at}: type can have at most ${MAX_KEYBOARD_BYTES} keys`);
      return;
    }
    case "frames":
      if (!isInteger(step.frames, 1, MAX_TIMEOUT_FRAMES)) fail(`${at} needs a frame count from 1 to ${MAX_TIMEOUT_FRAMES}`);
      return;
    case "runUntil": {
      const target = step.runUntil;
      const keys = isObject(target) ? Object.keys(target).sort().join(",") : "";
      // at, raster, at with raster (the address only on that line), or memory.
      if (!["at", "raster", "at,raster", "memory"].includes(keys)) return fail(`${at}: runUntil needs at, raster, at and raster, or memory`);
      const until = target as Record<string, unknown>;
      if ("raster" in until && !isInteger(until.raster, 0, MAX_RASTER_LINE)) fail(`${at}: runUntil.raster must be a raster line from 0 to ${MAX_RASTER_LINE}`);
      if ("at" in until) checkLocation(until.at, `${at}: runUntil.at`, fail, names);
      else if ("memory" in until) {
        const memory = until.memory;
        if (!isObject(memory) || Object.keys(memory).some((key) => key !== "at" && key !== "equals")) return fail(`${at}: runUntil.memory needs at and equals, and nothing else`);
        checkLocation(memory.at, `${at}: runUntil.memory.at`, fail, names);
        if (!isInteger(memory.equals, 0, 0xff)) fail(`${at}: runUntil.memory.equals must be a number from 0 to 255`);
      }
      if (!isInteger(step.timeoutFrames, 1, MAX_TIMEOUT_FRAMES)) fail(`${at} needs timeoutFrames from 1 to ${MAX_TIMEOUT_FRAMES}`);
      return;
    }
    default:
      fail(`${at}: ${kind} is not an action step`);
  }
}

/** Checks a list of action steps only, with $ addresses only: the steps file of c64-unpacker. */
export function checkActionSteps(value: unknown, fail: (message: string) => never): ActionStep[] {
  if (!Array.isArray(value) || value.length === 0) return fail("the steps are a JSON list with at least one step");
  value.forEach((step: unknown, index) => {
    const at = `step ${index + 1}`;
    if (!isObject(step)) return fail(`${at} must be an object`);
    const kinds = Object.keys(step).filter((key) => (ACTION_STEP_KINDS as readonly string[]).includes(key));
    if (kinds.length !== 1) return fail(`${at} must have exactly one of ${ACTION_STEP_KINDS.join(", ")}`);
    const kind = kinds[0]!;
    const allowed = ACTION_STEP_KEYS[kind] ?? [kind];
    for (const key of Object.keys(step)) if (!allowed.includes(key)) fail(`${at} has the key ${key}, which a ${kind} step does not have`);
    checkActionStep(kind, step, at, fail, false);
  });
  return value as ActionStep[];
}

/** Stops the CPU when it runs: a write, a register change or an exact frame count needs it stopped. */
async function stop(client: ViceSessionClient): Promise<void> {
  if ((await client.status()).state === "running") await client.execution({ action: "pause", space: "c64" });
}

/**
 * Runs one action step. `at` turns a location into an address. A runUntil
 * step that does not reach its target returns the stop, for the caller to judge.
 */
export async function runActionStep(client: ViceSessionClient, step: ActionStep, at: (location: Location) => number): Promise<RunUntilResult | undefined> {
  if ("write" in step) {
    await stop(client);
    await client.memoryWrite({ address: at(step.write.at), data: Buffer.from(step.write.bytes).toString("hex"), space: "c64", view: "cpu" });
  } else if ("registers" in step) {
    await stop(client);
    const values: Record<string, number> = {};
    for (const [name, value] of Object.entries(step.registers)) values[name] = typeof value === "number" ? value : at(value as Location);
    await client.registersSet("c64", values);
  } else if ("joystick" in step) {
    await client.joystick({ port: step.joystick.port, direction: step.joystick.direction, fire: step.joystick.fire ?? false });
  } else if ("type" in step) {
    await client.keyboard(textToPetscii(step.type));
  } else if ("frames" in step) {
    await stop(client);
    // One advance-frames runs at most MAX_EXECUTION_COUNT frames. Each part ends at the raster position
    // where it started, so the parts give the same frames as one run; a breakpoint ends them all.
    for (let left = step.frames; left > 0; left -= MAX_EXECUTION_COUNT) {
      const part = await client.execution({ action: "advance-frames", count: Math.min(left, MAX_EXECUTION_COUNT), space: "c64" });
      if (part.stopReason !== "frames") break;
    }
  } else {
    const until = step.runUntil;
    const target: RunTarget =
      "at" in until
        ? { kind: "address", address: at(until.at), space: "c64", ...(until.raster === undefined ? {} : { condition: { kind: "raster" as const, line: until.raster } }) }
        : "raster" in until
          ? { kind: "raster", line: until.raster }
          : { kind: "memory", address: at(until.memory.at), operator: "eq", value: until.memory.equals, space: "c64", view: "cpu" };
    const reached = await client.runUntil({ target, timeoutFrames: step.timeoutFrames });
    if (!reached.reached) return reached;
  }
  return undefined;
}
