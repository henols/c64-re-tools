// The action steps of the scripts. A step is { "<kind>": <input> }, and the
// input has the fields, ranges and defaults of the MCP tool that does the same:
//
//   write     c64_memory_write   { address, data, space?, view? }
//   registers c64_registers      the values of action write: { pc?, a?, x?, y?, sp?, flags? }
//   joystick  c64_joystick       { port, direction, fire? }
//   type      c64_keyboard       { mode: "text", text } or { mode: "petscii", bytes }: the KERNAL keyboard queue
//   frames    c64_execution      the count of advance-frames
//   runUntil  c64_run_until      { target, timeoutFrames? }
//   press     (no tool)          keys of the keyboard matrix; only the replay core of c64-testing record and replay has them
//
// An address in a step is $ and 1 to 4 hex digits, or a name that the script resolves.
// The scripts install without packages, so this checker has no zod: the MCP
// tools keep their zod schemas, and a test checks that both take the same inputs.

import { c64AddressOf, SYMBOL_NAME, textToPetscii } from "../c64.ts";
import { isRefusal, Refusal } from "../errors.ts";
import {
  COMPARISONS,
  CONDITION_REGISTERS,
  JOYSTICK_DIRECTIONS,
  MAX_EXECUTION_COUNT,
  MAX_KEYBOARD_BYTES,
  MAX_MEMORY_WRITE,
  MAX_TIMEOUT_FRAMES,
  MEMORY_VIEWS,
  SPACES,
  type Condition,
  type RunTarget,
  type RunUntilResult,
} from "../protocol/vice.ts";
import { readProjectFile } from "./transfer.ts";
import type { ViceSessionClient } from "./vice-session.ts";

/** A "$xxxx" address or a name, which the caller resolves. */
export type Location = string;

type Space = (typeof SPACES)[number];
type View = (typeof MEMORY_VIEWS)[number];
type Comparison = (typeof COMPARISONS)[number];
type Flags = Partial<Record<"n" | "v" | "b" | "d" | "i" | "z" | "c", boolean>>;

export type StepCondition =
  | { kind: "register"; register: (typeof CONDITION_REGISTERS)[number]; operator: Comparison; value: number }
  | { kind: "memory"; address: Location; operator: Comparison; value: number; space: Space; view: View }
  | { kind: "raster"; line: number; cycle?: number };

export type StepTarget =
  | { kind: "address"; address: Location; space: Space; condition?: StepCondition }
  | { kind: "memory"; address: Location; operator: Comparison; value: number; space: Space; view: View }
  | { kind: "raster"; line: number; cycle?: number };

export type KeyboardInput = { mode: "text"; text: string } | { mode: "petscii"; bytes: number[] };

export type ActionStep =
  | { write: { address: Location; data: string; space: Space; view: View } }
  | { registers: { pc?: Location; a?: number; x?: number; y?: number; sp?: number; flags?: Flags } }
  | { joystick: { port: 1 | 2; direction: (typeof JOYSTICK_DIRECTIONS)[number]; fire: boolean } }
  | { type: KeyboardInput }
  | { press: string }
  | { frames: number }
  | { runUntil: { target: StepTarget; timeoutFrames: number } };

export const ACTION_STEP_KINDS = ["write", "registers", "joystick", "type", "press", "frames", "runUntil"] as const;
export type ActionStepKind = (typeof ACTION_STEP_KINDS)[number];
/** The step kinds that VICE runs: all but press, which only the replay core has. */
export const VICE_STEP_KINDS = ACTION_STEP_KINDS.filter((kind) => kind !== "press");

/** The fields of each object of the steps: the same as the inputs of the MCP tools. */
export const STEP_FIELDS = {
  write: ["address", "data", "space", "view"],
  registers: ["pc", "a", "x", "y", "sp", "flags"],
  joystick: ["port", "direction", "fire"],
  type: ["mode", "text", "bytes"],
  runUntil: ["target", "timeoutFrames"],
  addressTarget: ["kind", "address", "space", "condition"],
  memoryTarget: ["kind", "address", "operator", "value", "space", "view"],
  rasterTarget: ["kind", "line", "cycle"],
  registerCondition: ["kind", "register", "operator", "value"],
  memoryCondition: ["kind", "address", "operator", "value", "space", "view"],
  rasterCondition: ["kind", "line", "cycle"],
  flags: ["n", "v", "b", "d", "i", "z", "c"],
} as const;

/** The highest raster line of a PAL frame; an NTSC frame has fewer, which the emulator checks. */
export const MAX_RASTER_LINE = 311;
/** The wait of a runUntil step without timeoutFrames, as c64_run_until has it. */
export const DEFAULT_TIMEOUT_FRAMES = 3000;

export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export const isInteger = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T => (values as readonly unknown[]).includes(value);

/** True for an address of a step or a file: $ and 1 to 4 hex digits, or a name. */
export function isLocation(value: unknown): value is Location {
  return typeof value === "string" && (c64AddressOf(value) !== undefined || SYMBOL_NAME.test(value));
}

/** Checks an address in a file: $ and 1 to 4 hex digits, or a name. */
export function checkLocation(value: unknown, what: string, fail: (message: string) => never): void {
  if (!isLocation(value)) fail(`${what} must be $ and 1 to 4 hex digits, for example $c000 or $fb, or a name`);
}

/** The PETSCII bytes of a keyboard input, or why the text has no keys. */
export function keyboardBytes(input: { mode: "text" | "petscii"; text?: string | undefined; bytes?: number[] | undefined }): Uint8Array | string {
  if (input.mode === "petscii") return Uint8Array.from(input.bytes ?? []);
  try {
    return textToPetscii(input.text ?? "");
  } catch (error) {
    if (isRefusal(error)) return `${error.message}. Use mode petscii for other keys`;
    throw error;
  }
}

/**
 * One line of JSON with a space after each colon and comma: the form that a
 * refusal tells the caller to write.
 */
export function jsonLine(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(jsonLine).join(", ")}]`;
  if (isObject(value)) return `{${Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => `${JSON.stringify(key)}: ${jsonLine(item)}`).join(", ")}}`;
  return JSON.stringify(value) ?? "null";
}

/** Field names of the 2.0 files and what a 2.1 object has in their place, when it has that field. */
const RENAMED: Record<string, Array<{ field: string; write: string }>> = {
  at: [
    { field: "address", write: "address" },
    { field: "start", write: "start" },
  ],
  bytes: [{ field: "data", write: 'data, the bytes as hex text, for example "data": "a900",' }],
  equals: [{ field: "operator", write: '"operator": "eq" and "value"' }],
};

/** What to write in place of a field of the 2.0 files, for an object with these fields; undefined when the field has no 2.1 name there. */
export function renamedField(key: string, fields: readonly string[]): string | undefined {
  const renamed = RENAMED[key]?.find((item) => fields.includes(item.field));
  return renamed === undefined ? undefined : `${key} is a 2.0 field. Write ${renamed.write} in place of ${key}`;
}

/** The checks of one input: `fail` names the field of the problem. */
class Fields {
  readonly #value: Record<string, unknown>;
  readonly #where: string;
  readonly #fail: (message: string) => never;

  constructor(value: unknown, where: string, fields: readonly string[], fail: (message: string) => never) {
    this.#where = where;
    this.#fail = fail;
    if (!isObject(value)) fail(`${where} must be an object with ${fields.join(", ")}`);
    this.#value = value as Record<string, unknown>;
    for (const key of Object.keys(this.#value)) {
      if (fields.includes(key)) continue;
      const renamed = renamedField(key, fields);
      fail(`${where} has the field ${key}, which it does not take. ${renamed === undefined ? "" : `${renamed}. `}Its fields are ${fields.join(", ")}`);
    }
  }

  fail(field: string, message: string): never {
    return this.#fail(`${this.#where}.${field} ${message}`);
  }

  has(field: string): boolean {
    return this.#value[field] !== undefined;
  }

  get(field: string): unknown {
    return this.#value[field];
  }

  location(field: string): Location {
    const value = this.#value[field];
    if (!isLocation(value)) return this.fail(field, "must be $ and 1 to 4 hex digits, for example $c000 or $fb, or a name");
    return value;
  }

  integer(field: string, min: number, max: number, fallback?: number): number {
    const value = this.#value[field] ?? fallback;
    if (!isInteger(value, min, max)) return this.fail(field, `must be a whole number from ${min} to ${max}`);
    return value;
  }

  oneOf<T extends string>(field: string, values: readonly T[], fallback?: T): T {
    const value = this.#value[field] ?? fallback;
    if (!isOneOf(values, value)) return this.fail(field, `must be one of ${values.join(", ")}`);
    return value;
  }

  boolean(field: string, fallback?: boolean): boolean {
    const value = this.#value[field] ?? fallback;
    if (typeof value !== "boolean") return this.fail(field, "must be true or false");
    return value;
  }
}

function checkCondition(value: unknown, where: string, fail: (message: string) => never): StepCondition {
  const kind = isObject(value) ? value.kind : undefined;
  if (kind === "register") {
    const fields = new Fields(value, where, STEP_FIELDS.registerCondition, fail);
    return { kind, register: fields.oneOf("register", CONDITION_REGISTERS), operator: fields.oneOf("operator", COMPARISONS), value: fields.integer("value", 0, 0xff) };
  }
  if (kind === "memory") {
    const fields = new Fields(value, where, STEP_FIELDS.memoryCondition, fail);
    return { kind, address: fields.location("address"), operator: fields.oneOf("operator", COMPARISONS), value: fields.integer("value", 0, 0xff), space: fields.oneOf("space", SPACES, "c64"), view: fields.oneOf("view", MEMORY_VIEWS, "cpu") };
  }
  if (kind === "raster") return raster(new Fields(value, where, STEP_FIELDS.rasterCondition, fail));
  return fail(`${where}.kind must be one of register, memory, raster`);
}

function raster(fields: Fields): { kind: "raster"; line: number; cycle?: number } {
  const line = fields.integer("line", 0, MAX_RASTER_LINE);
  return fields.has("cycle") ? { kind: "raster", line, cycle: fields.integer("cycle", 0, 64) } : { kind: "raster", line };
}

function checkTarget(value: unknown, where: string, fail: (message: string) => never): StepTarget {
  const kind = isObject(value) ? value.kind : undefined;
  if (kind === "address") {
    const fields = new Fields(value, where, STEP_FIELDS.addressTarget, fail);
    const target: StepTarget = { kind, address: fields.location("address"), space: fields.oneOf("space", SPACES, "c64") };
    if (fields.has("condition")) target.condition = checkCondition(fields.get("condition"), `${where}.condition`, fail);
    return target;
  }
  if (kind === "memory") {
    const fields = new Fields(value, where, STEP_FIELDS.memoryTarget, fail);
    return { kind, address: fields.location("address"), operator: fields.oneOf("operator", COMPARISONS), value: fields.integer("value", 0, 0xff), space: fields.oneOf("space", SPACES, "c64"), view: fields.oneOf("view", MEMORY_VIEWS, "cpu") };
  }
  if (kind === "raster") return raster(new Fields(value, where, STEP_FIELDS.rasterTarget, fail));
  return fail(`${where}.kind must be one of address, memory, raster`);
}

/** What a step of a script without the replay core gets for press: the scripts that read these steps run without a window. */
const PRESS_REMEDY = "press pushes keys of the keyboard matrix, and only the replay core of c64-testing has them. Use type for the KERNAL keyboard queue, or put the press step in a record file and play it with testing.ts record of c64-testing";

/** Checks the input of one step kind and returns it with the defaults of its MCP tool. */
function checkInput(kind: ActionStepKind, value: unknown, at: string, fail: (message: string) => never): ActionStep {
  const where = `${at}: ${kind}`;
  switch (kind) {
    case "write": {
      const fields = new Fields(value, where, STEP_FIELDS.write, fail);
      const data = fields.get("data");
      if (typeof data !== "string" || !/^(?:[0-9a-fA-F]{2})+$/.test(data)) fields.fail("data", "must be hex bytes, two digits per byte, no separators, for example a9008d20d0");
      if ((data as string).length / 2 > MAX_MEMORY_WRITE) fields.fail("data", `has at most ${MAX_MEMORY_WRITE} bytes`);
      return { write: { address: fields.location("address"), data: (data as string).toLowerCase(), space: fields.oneOf("space", SPACES, "c64"), view: fields.oneOf("view", MEMORY_VIEWS, "cpu") } };
    }
    case "registers": {
      const fields = new Fields(value, where, STEP_FIELDS.registers, fail);
      const registers: Extract<ActionStep, { registers: unknown }>["registers"] = {};
      if (fields.has("pc")) registers.pc = fields.location("pc");
      for (const name of ["a", "x", "y", "sp"] as const) if (fields.has(name)) registers[name] = fields.integer(name, 0, 0xff);
      if (fields.has("flags")) {
        const flags = new Fields(fields.get("flags"), `${where}.flags`, STEP_FIELDS.flags, fail);
        registers.flags = Object.fromEntries(STEP_FIELDS.flags.filter((name) => flags.has(name)).map((name) => [name, flags.boolean(name)]));
      }
      if (Object.entries(registers).every(([name, item]) => name === "flags" && Object.keys(item as object).length === 0)) fail(`${where} must name at least one register`);
      return { registers };
    }
    case "joystick": {
      const fields = new Fields(value, where, STEP_FIELDS.joystick, fail);
      return { joystick: { port: fields.integer("port", 1, 2) as 1 | 2, direction: fields.oneOf("direction", JOYSTICK_DIRECTIONS), fire: fields.boolean("fire", false) } };
    }
    case "type": {
      const fields = new Fields(value, where, STEP_FIELDS.type, fail);
      const mode = fields.oneOf("mode", ["text", "petscii"] as const);
      let input: KeyboardInput;
      if (mode === "text") {
        if (typeof fields.get("text") !== "string" || fields.get("text") === "" || fields.has("bytes")) fail(`${where}: mode text takes text and no bytes`);
        input = { mode, text: fields.get("text") as string };
      } else {
        const bytes = fields.get("bytes");
        if (!Array.isArray(bytes) || bytes.length === 0 || !bytes.every((byte) => isInteger(byte, 1, 255)) || fields.has("text")) fail(`${where}: mode petscii takes bytes, a list of PETSCII codes from 1 to 255, and no text`);
        input = { mode, bytes: bytes as number[] };
      }
      const keys = keyboardBytes(input);
      if (typeof keys === "string") fail(`${where}.text: ${keys}`);
      else if (keys.length > MAX_KEYBOARD_BYTES) fail(`${where}: the keyboard queue takes at most ${MAX_KEYBOARD_BYTES} keys at once. This input has ${keys.length} keys`);
      return { type: input };
    }
    case "press":
      if (typeof value !== "string" || value === "") fail(`${where} needs the keys to press as text`);
      return { press: value as string };
    case "frames":
      if (!isInteger(value, 1, MAX_TIMEOUT_FRAMES)) fail(`${where} must be a frame count from 1 to ${MAX_TIMEOUT_FRAMES}`);
      return { frames: value as number };
    case "runUntil": {
      const fields = new Fields(value, where, STEP_FIELDS.runUntil, fail);
      return { runUntil: { target: checkTarget(fields.get("target"), `${where}.target`, fail), timeoutFrames: fields.integer("timeoutFrames", 1, MAX_TIMEOUT_FRAMES, DEFAULT_TIMEOUT_FRAMES) } };
    }
  }
}

/** A "$xxxx" text of a number, or the value as it is. */
const asAddress = (value: unknown) => (isInteger(value, 0, 0xffff) ? `$${value.toString(16).padStart(4, "0")}` : value);

/** The hex text of a list of bytes, or the value as it is. */
const asHex = (value: unknown) => (Array.isArray(value) && value.every((byte) => isInteger(byte, 0, 0xff)) ? Buffer.from(value as number[]).toString("hex") : value);

/** A runUntil target from the 2.0 input: at (with raster), raster, or memory with at and equals. */
function targetOf(input: Record<string, unknown>): unknown {
  if ("target" in input) return input.target;
  if (isObject(input.memory)) return { kind: "memory", address: input.memory.at ?? input.memory.address, operator: "eq", value: input.memory.equals };
  if ("at" in input) return { kind: "address", address: input.at, ...(input.raster === undefined ? {} : { condition: { kind: "raster", line: input.raster } }) };
  return { kind: "raster", line: input.raster };
}

/**
 * The 2.1 form of a step that has a form of the 2.0 files: the 2.0 fields
 * that it has and the step to write. Undefined when the step has no 2.0 form.
 * Keys of the step other than its kind (for example side) stay.
 */
export function newStepForm(kind: string, step: Record<string, unknown>): { fields: string[]; step: Record<string, unknown> } | undefined {
  const input = step[kind];
  const { [kind]: _input, ...rest } = step;
  const form = (fields: string[], value: unknown, others = rest) => ({ fields, step: { [kind]: value, ...others } });
  switch (kind) {
    case "runUntil": {
      const { timeoutFrames: beside, ...others } = rest;
      const old = isObject(input) && !("target" in input) && ("at" in input || "raster" in input || "memory" in input);
      if (!isObject(input) || (!old && beside === undefined)) return undefined;
      const fields = [...(old ? ["at", "raster", "memory"].filter((key) => key in input).map((key) => `runUntil.${key}`) : []), ...(beside === undefined ? [] : ["timeoutFrames beside runUntil"])];
      const timeoutFrames = beside ?? input.timeoutFrames;
      return form(fields, { target: targetOf(input), ...(timeoutFrames === undefined ? {} : { timeoutFrames }) }, others);
    }
    case "type":
      return typeof input === "string" ? form(["type as text"], { mode: "text", text: input }) : undefined;
    case "write": {
      if (!isObject(input) || !("at" in input || "bytes" in input || Array.isArray(input.data))) return undefined;
      const { at: old, bytes, address, data, ...others } = input;
      return form(
        ["at", "bytes"].filter((key) => key in input).map((key) => `write.${key}`).concat(Array.isArray(data) ? ["write.data as a list"] : []),
        { address: address ?? old, data: asHex(data ?? bytes), ...others },
      );
    }
    case "registers": {
      if (!isObject(input)) return undefined;
      const fields = Object.entries(input).flatMap(([name, value]) => ((name === "pc" && typeof value === "number") || (name !== "pc" && name !== "flags" && typeof value === "string" && c64AddressOf(value) !== undefined) ? [`registers.${name} as ${typeof value === "number" ? "a number" : "text"}`] : []));
      if (fields.length === 0) return undefined;
      const values = Object.fromEntries(Object.entries(input).map(([name, value]) => [name, name === "pc" ? asAddress(value) : typeof value === "string" ? (c64AddressOf(value) ?? value) : value]));
      return form(fields, values);
    }
    default:
      return undefined;
  }
}

/** Refuses a step in a form of the 2.0 files: the message names its 2.0 fields and gives the step to write. */
export function refuseOldStep(kind: string, step: Record<string, unknown>, at: string, fail: (message: string) => never): void {
  const found = newStepForm(kind, step);
  if (found === undefined) return;
  const petscii = kind === "type" ? ', or {"type": {"mode": "petscii", "bytes": [...]}} for PETSCII codes' : "";
  fail(`${at} has the 2.0 form (${found.fields.join(", ")}). Write ${jsonLine(found.step)}${petscii}`);
}

/**
 * Checks one action step of the given kind and returns it with the defaults
 * filled in. The step has no other key. `press` is refused unless the caller
 * runs the steps on the replay core. A step in a form of the 2.0 files is
 * refused with the step to write.
 */
export function checkActionStep(kind: ActionStepKind, step: Record<string, unknown>, at: string, fail: (message: string) => never, options: { press?: boolean } = {}): ActionStep {
  refuseOldStep(kind, step, at, fail);
  for (const key of Object.keys(step)) if (key !== kind) fail(`${at} has the key ${key}, which a ${kind} step does not have`);
  if (kind === "press" && options.press !== true) fail(`${at}: ${PRESS_REMEDY}`);
  return checkInput(kind, step[kind], at, fail);
}

/**
 * The kind of a step: its one key from `kinds`. A refusal lists `shown`: the
 * kinds that the caller runs.
 */
export function stepKind<K extends string>(step: unknown, kinds: readonly K[], at: string, fail: (message: string) => never, shown: readonly string[] = kinds): K {
  if (!isObject(step)) return fail(`${at} must be an object`);
  const found = Object.keys(step).filter((key) => (kinds as readonly string[]).includes(key));
  if (found.length > 1) return fail(`${at} has ${found.length} step kinds: ${found.join(", ")}. Give each one its own step`);
  if (found.length !== 1) return fail(`${at} must have exactly one of ${shown.join(", ")}`);
  return found[0] as K;
}

/** Checks a list of action steps and returns them with the defaults filled in. */
export function checkActionSteps(value: unknown, fail: (message: string) => never, options: { press?: boolean } = {}): ActionStep[] {
  if (!Array.isArray(value) || value.length === 0) return fail("the steps are a JSON list with at least one step");
  return value.map((step: unknown, index) => {
    const at = `step ${index + 1}`;
    return checkActionStep(stepKind(step, ACTION_STEP_KINDS, at, fail, options.press === true ? ACTION_STEP_KINDS : VICE_STEP_KINDS), step as Record<string, unknown>, at, fail, options);
  });
}

/** The names and addresses of an action step: each location that the step resolves when it runs. */
export function stepLocations(step: ActionStep): Location[] {
  if ("write" in step) return [step.write.address];
  if ("registers" in step) return step.registers.pc === undefined ? [] : [step.registers.pc];
  if (!("runUntil" in step)) return [];
  const { target } = step.runUntil;
  if (target.kind === "raster") return [];
  if (target.kind === "memory") return [target.address];
  return [target.address, ...(target.condition?.kind === "memory" ? [target.condition.address] : [])];
}

/**
 * Resolves every name of the steps with `at` before the steps run, so that an
 * unknown name stops the call before the emulator starts. A refusal of `at` becomes
 * invalid-input that names `where` (for example the option and the file) and the step.
 * `first` is the number of the first of the steps in the file.
 */
export function checkStepNames(steps: readonly ActionStep[], at: (location: Location) => number, where: string, first = 1): void {
  steps.forEach((step, index) => {
    for (const location of stepLocations(step)) {
      try {
        at(location);
      } catch (error) {
        if (isRefusal(error)) throw new Refusal("invalid-input", `${where}: step ${index + first}: ${error.message}`);
        throw error;
      }
    }
  });
}

/**
 * Reads a steps file of the project: a JSON list of action steps. `option`
 * names the option of the file in a refusal. With `at`, every name of the
 * steps must resolve (checkStepNames).
 */
export function readActionSteps(path: string, option: string, at?: (location: Location) => number): ActionStep[] {
  const fail = (message: string): never => {
    throw new Refusal("invalid-input", `${option} ${path}: ${message}`);
  };
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(path).bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) return fail(`it is not JSON: ${error.message}`);
    throw error;
  }
  const steps = checkActionSteps(value, fail);
  if (at !== undefined) checkStepNames(steps, at, `${option} ${path}`);
  return steps;
}

/** Stops the CPU when it runs: a write, a register change or an exact frame count needs it stopped. */
async function stop(client: ViceSessionClient): Promise<void> {
  if ((await client.status()).state === "running") await client.execution({ action: "pause", space: "c64" });
}

/** A run target of a step with its addresses resolved. */
export function resolveTarget(target: StepTarget, at: (location: Location) => number): RunTarget {
  if (target.kind === "raster") return target.cycle === undefined ? { kind: "raster", line: target.line } : { kind: "raster", line: target.line, cycle: target.cycle };
  if (target.kind === "memory") return { ...target, address: at(target.address) };
  const { condition } = target;
  return {
    kind: "address",
    address: at(target.address),
    space: target.space,
    ...(condition === undefined ? {} : { condition: (condition.kind === "memory" ? { ...condition, address: at(condition.address) } : condition) as Condition }),
  };
}

/**
 * Runs one action step in VICE. `at` turns a location into an address. A
 * runUntil step that does not reach its target returns the stop, for the
 * caller to judge.
 */
export async function runActionStep(client: ViceSessionClient, step: ActionStep, at: (location: Location) => number): Promise<RunUntilResult | undefined> {
  if ("write" in step) {
    await stop(client);
    await client.memoryWrite({ ...step.write, address: at(step.write.address) });
  } else if ("registers" in step) {
    await stop(client);
    const { pc, flags, ...bytes } = step.registers;
    await client.registersSet("c64", { ...bytes, ...(pc === undefined ? {} : { pc: at(pc) }), ...(flags === undefined || Object.keys(flags).length === 0 ? {} : { flags }) });
  } else if ("joystick" in step) {
    await client.joystick(step.joystick);
  } else if ("type" in step) {
    await client.keyboard(keyboardBytes(step.type) as Uint8Array);
  } else if ("press" in step) {
    throw new Refusal("invalid-input", PRESS_REMEDY);
  } else if ("frames" in step) {
    await stop(client);
    // One advance-frames runs at most MAX_EXECUTION_COUNT frames. Each part ends at the raster position
    // where it started, so the parts give the same frames as one run; a breakpoint ends them all.
    for (let left = step.frames; left > 0; left -= MAX_EXECUTION_COUNT) {
      const part = await client.execution({ action: "advance-frames", count: Math.min(left, MAX_EXECUTION_COUNT), space: "c64" });
      if (part.stopReason !== "frames") break;
    }
  } else {
    const reached = await client.runUntil({ target: resolveTarget(step.runUntil.target, at), timeoutFrames: step.runUntil.timeoutFrames });
    if (!reached.reached) return reached;
  }
  return undefined;
}
