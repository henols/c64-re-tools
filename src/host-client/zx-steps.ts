// The steps of a ZX Spectrum run: frames, keys of the keyboard that stay down
// for some frames, and the Kempston joystick. A record file of a replay and the
// --steps file of a release compare give them in this form; a step of the C64
// form is refused by name.

import { Refusal } from "../errors.ts";
import { readProjectFile } from "./transfer.ts";

export type ZxStep = { frames: number } | { press: string[]; frames: number } | { joystick: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean } };

/** The keys of the keyboard, by the names that a press step gives. */
export const ZX_KEYS: readonly string[] = [..."abcdefghijklmnopqrstuvwxyz0123456789", "space", "enter", "caps", "symbol"];

/** The frames that a press step holds its keys down when it gives no frames. */
export const ZX_KEY_FRAMES = 3;
export const ZX_MAX_STEP_FRAMES = 1_000_000;

const DIRECTIONS = ["up", "down", "left", "right", "fire"] as const;

/** The steps of the C64 form that the ZX Spectrum form does not have. */
const C64_STEPS = ["type", "write", "registers", "runUntil"];

export const ZX_STEP_FORMS = '{ "frames": 50 }, { "press": ["space"], "frames": 5 } or { "joystick": { "right": true, "fire": true } }';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Checks a list of ZX Spectrum steps. `fail` refuses with the place in its message. */
export function checkZxSteps(value: unknown, fail: (what: string) => never): ZxStep[] {
  if (!Array.isArray(value) || value.length === 0) return fail("steps must be a list of at least one step");
  return value.map((item, index): ZxStep => {
    const at = `step ${index + 1}`;
    const step = isObject(item) ? item : fail(`${at} is not an object`);
    const only = (...keys: string[]) => {
      for (const key of Object.keys(step)) if (!keys.includes(key)) fail(`${at}: ${key} is not a key of this step. The step has only ${keys.join(" and ")}`);
    };
    const frames = (given: unknown, fallback?: number) => {
      const count = given ?? fallback;
      if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > ZX_MAX_STEP_FRAMES) fail(`${at}: frames must be 1 to ${ZX_MAX_STEP_FRAMES}`);
      return count as number;
    };
    if ("press" in step) {
      only("press", "frames");
      const keys = Array.isArray(step.press) ? step.press : fail(`${at}: press must be a list of keys, for example ["space"]. ${step.press !== null && typeof step.press === "object" ? "That is the C64 form. " : ""}A ZX Spectrum step is ${ZX_STEP_FORMS}`);
      if (keys.length === 0 || keys.length > 8 || !keys.every((key) => typeof key === "string" && ZX_KEYS.includes(key))) fail(`${at}: press takes 1 to 8 keys: a-z, 0-9, space, enter, caps or symbol`);
      return { press: keys as string[], frames: frames(step.frames, ZX_KEY_FRAMES) };
    }
    if ("joystick" in step) {
      only("joystick");
      const form = 'The Kempston joystick is { "joystick": { "right": true, "fire": true } } with up, down, left, right and fire, or { "joystick": null }';
      const stick = step.joystick === null ? {} : isObject(step.joystick) ? step.joystick : fail(`${at}: joystick must be an object or null. ${form}`);
      for (const [key, set] of Object.entries(stick)) {
        if (!(DIRECTIONS as readonly string[]).includes(key)) fail(`${at}: joystick has no ${key}${key === "port" || key === "direction" ? ": that is the C64 form" : ""}. ${form}`);
        if (typeof set !== "boolean") fail(`${at}: joystick ${key} must be true or false. ${form}`);
      }
      const bit = (name: string) => stick[name] === true;
      return { joystick: { up: bit("up"), down: bit("down"), left: bit("left"), right: bit("right"), fire: bit("fire") } };
    }
    if ("frames" in step) {
      only("frames");
      return { frames: frames(step.frames) };
    }
    const c64 = Object.keys(step).find((key) => C64_STEPS.includes(key));
    return fail(`${at}: ${c64 === undefined ? "the step is not frames, press or joystick" : `${c64} is a step for a C64 program`}. A ZX Spectrum step is ${ZX_STEP_FORMS}`);
  });
}

/** Reads a JSON list of ZX Spectrum steps from a project file. `option` names the file in a refusal, for example "--steps". */
export function readZxSteps(path: string, option: string): ZxStep[] {
  const fail = (what: string): never => {
    throw new Refusal("invalid-input", `${option} ${path}: ${what}`);
  };
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(path, { what: option }).bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) return fail(`it is not JSON: ${error.message}`);
    throw error;
  }
  return checkZxSteps(value, fail);
}
