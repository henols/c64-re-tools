// Functional-equivalence scenarios (13): a small JSON scenario of ordered
// steps runs on the original and then on the rebuild in one VICE session.
// Observations name semantic symbols that resolve per side, comparisons are
// explicit, and the result is PASS, FAIL or INCONCLUSIVE.

import { formatC64Address, parseC64Address, textToPetscii } from "#src/c64.ts";
import {
  JOYSTICK_DIRECTIONS,
  MAX_BASELINES,
  MAX_EXECUTION_COUNT,
  MAX_KEYBOARD_BYTES,
  MAX_MEMORY_READ,
  MAX_MEMORY_WRITE,
  MAX_TIMEOUT_FRAMES,
  WireFailure,
} from "#src/host-client/tools.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import type { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { listSymbols } from "#src/knowledge/read.ts";

export class ScenarioError extends Error {}

export type Side = "original" | "rebuild";
export const SIDES: Side[] = ["original", "rebuild"];

/** A "$xxxx" address or a symbol name that each side resolves on its own. */
export type Location = string;

export interface MemoryObservation {
  at: Location;
  /** Bytes from `at`; 1 when not given. */
  size?: number;
  /** The largest allowed difference per byte; 0 when not given. */
  tolerance?: number;
}

export interface ScreenPolicy {
  /** The largest allowed fraction of different pixels; 0 (exact) when not given. */
  maxMismatchRatio?: number;
  /** Rectangles that the comparison ignores, in screen pixels. */
  mask?: Array<{ x: number; y: number; width: number; height: number }>;
}

export type Step =
  | { reset: "hard" | "soft" }
  | { load: true }
  | { autostart: true }
  | { write: { at: Location; bytes: number[] } }
  | { registers: Partial<Record<"pc" | "a" | "x" | "y" | "sp", number | Location>> }
  | { joystick: { port: 1 | 2; direction: JoystickDirection; fire?: boolean } }
  | { type: string }
  | { frames: number }
  | { runUntil: { at: Location } | { memory: { at: Location; equals: number } }; timeoutFrames: number }
  | { observe: string; memory?: Array<Location | MemoryObservation>; registers?: ObservedRegister[]; screen?: ScreenPolicy; vicii?: boolean; sprites?: number[] };

export interface Subject {
  program: string;
  /** "knowledge" for knowledge.db, a project JSON file (c64-assembler output or a name → "$xxxx" map), or "none". */
  symbols: string;
}

export interface Scenario {
  name: string;
  videoStandard?: "pal" | "ntsc";
  original: Subject;
  rebuild: Subject;
  steps: Step[];
}

export type Outcome = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface Difference {
  checkpoint: string;
  what: string;
  original: unknown;
  rebuild: unknown;
}

export interface ScenarioResult {
  result: Outcome;
  scenario: string;
  /** Why the result is INCONCLUSIVE. */
  reason?: string;
  checkpoints: string[];
  differences: Difference[];
}

const STEP_KINDS = ["reset", "load", "autostart", "write", "registers", "joystick", "type", "frames", "runUntil", "observe"];

/** The keys each kind of step can have. */
const STEP_KEYS: Record<string, readonly string[]> = {
  runUntil: ["runUntil", "timeoutFrames"],
  observe: ["observe", "memory", "registers", "screen", "vicii", "sprites"],
};

/** The registers an observe step can compare. */
export const OBSERVED_REGISTERS = ["pc", "a", "x", "y", "sp", "flags"] as const;
type ObservedRegister = (typeof OBSERVED_REGISTERS)[number];
/** The registers a registers step can set. */
const SET_REGISTERS = ["pc", "a", "x", "y", "sp"];

type JoystickDirection = (typeof JOYSTICK_DIRECTIONS)[number];

/** The most mask rectangles the host accepts for one screen comparison. */
const MAX_MASK_RECTANGLES = 64;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isInteger = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** Reads and checks a scenario file. Throws ScenarioError naming the first problem. */
export function readScenario(path: string): Scenario {
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(path).bytes.toString("utf8"));
  } catch (error) {
    throw new ScenarioError(`cannot read the scenario ${path}: ${(error as Error).message}`);
  }
  const fail = (message: string): never => {
    throw new ScenarioError(`scenario ${path}: ${message}`);
  };
  if (!isObject(value)) return fail("is not a JSON object");
  const scenario = value as unknown as Scenario;
  if (typeof scenario.name !== "string" || scenario.name === "") fail("needs a name");
  if (scenario.videoStandard !== undefined && scenario.videoStandard !== "pal" && scenario.videoStandard !== "ntsc") fail("videoStandard must be pal or ntsc");
  for (const side of SIDES) {
    const subject = scenario[side];
    if (typeof subject?.program !== "string" || typeof subject.symbols !== "string") fail(`${side} needs a program and symbols`);
  }
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) fail("needs steps");
  const labels = new Set<string>();
  let screens = 0;
  scenario.steps.forEach((step: unknown, index) => {
    const at = `step ${index + 1}`;
    if (!isObject(step)) return fail(`${at} must be an object`);
    // An observe step names what it observes with "memory" and "registers" too.
    const kinds = "observe" in step ? ["observe"] : Object.keys(step).filter((key) => STEP_KINDS.includes(key));
    if (kinds.length !== 1) return fail(`${at} must have exactly one of ${STEP_KINDS.join(", ")}`);
    const kind = kinds[0]!;
    const allowed = STEP_KEYS[kind] ?? [kind];
    for (const key of Object.keys(step)) if (!allowed.includes(key)) fail(`${at} has the key ${key}, which a ${kind} step does not have`);
    checkStep(kind, step, at, fail);
    if (kind === "observe") {
      if (labels.has(step.observe as string)) fail(`${at} needs a new checkpoint name`);
      labels.add(step.observe as string);
      if (step.screen !== undefined) screens++;
    }
  });
  if (labels.size === 0) fail("observes nothing; add an observe step");
  if (screens > MAX_BASELINES) fail(`observes the screen at ${screens} checkpoints; the limit is ${MAX_BASELINES}`);
  return scenario;
}

/** Checks a "$xxxx" address or a symbol name. */
function checkLocation(value: unknown, what: string, fail: (message: string) => never): void {
  if (typeof value !== "string" || value === "") fail(`${what} must be a $ address or a symbol name`);
  if ((value as string).startsWith("$")) {
    try {
      parseC64Address(value as string);
    } catch {
      fail(`${what} must be $ followed by four hex digits, not ${value as string}`);
    }
  }
}

/** Checks the value of one step against its kind. */
function checkStep(kind: string, step: Record<string, unknown>, at: string, fail: (message: string) => never): void {
  switch (kind) {
    case "reset":
      if (step.reset !== "hard" && step.reset !== "soft") fail(`${at}: reset must be hard or soft`);
      return;
    case "load":
    case "autostart":
      if (step[kind] !== true) fail(`${at}: ${kind} must be true`);
      return;
    case "write": {
      const write = step.write;
      if (!isObject(write) || Object.keys(write).some((key) => key !== "at" && key !== "bytes")) return fail(`${at}: write needs at and bytes, and nothing else`);
      checkLocation(write.at, `${at}: write.at`, fail);
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
        if (typeof value === "string") checkLocation(value, `${at}: registers.${name}`, fail);
        else if (!isInteger(value, 0, name === "pc" ? 0xffff : 0xff)) fail(`${at}: registers.${name} must be a symbol name, a $ address or a number from 0 to ${name === "pc" ? 65535 : 255}`);
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
      if (!isInteger(step.frames, 1, MAX_EXECUTION_COUNT)) fail(`${at} needs a frame count from 1 to ${MAX_EXECUTION_COUNT}`);
      return;
    case "runUntil": {
      const target = step.runUntil;
      if (!isObject(target) || Object.keys(target).length !== 1 || !("at" in target || "memory" in target)) return fail(`${at}: runUntil needs at or memory`);
      if ("at" in target) checkLocation(target.at, `${at}: runUntil.at`, fail);
      else {
        const memory = target.memory;
        if (!isObject(memory) || Object.keys(memory).some((key) => key !== "at" && key !== "equals")) return fail(`${at}: runUntil.memory needs at and equals, and nothing else`);
        checkLocation(memory.at, `${at}: runUntil.memory.at`, fail);
        if (!isInteger(memory.equals, 0, 0xff)) fail(`${at}: runUntil.memory.equals must be a number from 0 to 255`);
      }
      if (!isInteger(step.timeoutFrames, 1, MAX_TIMEOUT_FRAMES)) fail(`${at} needs timeoutFrames from 1 to ${MAX_TIMEOUT_FRAMES}`);
      return;
    }
    default:
      checkObserve(step, at, fail);
  }
}

function checkObserve(step: Record<string, unknown>, at: string, fail: (message: string) => never): void {
  if (typeof step.observe !== "string" || step.observe === "") fail(`${at} needs a new checkpoint name`);
  if (step.memory !== undefined) {
    if (!Array.isArray(step.memory) || step.memory.length === 0) fail(`${at}: memory must be a list of names, $ addresses or objects with at`);
    for (const item of step.memory as unknown[]) {
      if (typeof item === "string") {
        checkLocation(item, `${at}: memory`, fail);
        continue;
      }
      if (!isObject(item) || Object.keys(item).some((key) => !["at", "size", "tolerance"].includes(key))) return fail(`${at}: a memory object has at, size and tolerance, and nothing else`);
      checkLocation(item.at, `${at}: memory.at`, fail);
      if (item.size !== undefined && !isInteger(item.size, 1, MAX_MEMORY_READ)) fail(`${at}: memory.size must be a number from 1 to ${MAX_MEMORY_READ}`);
      if (item.tolerance !== undefined && !isInteger(item.tolerance, 0, 0xff)) fail(`${at}: memory.tolerance must be a number from 0 to 255`);
    }
  }
  if (step.registers !== undefined) {
    const names = step.registers;
    if (!Array.isArray(names) || names.length === 0) return fail(`${at}: registers must be a list of ${OBSERVED_REGISTERS.join(", ")}`);
    for (const name of names) if (!(OBSERVED_REGISTERS as readonly unknown[]).includes(name)) fail(`${at}: registers can have only ${OBSERVED_REGISTERS.join(", ")}, not ${JSON.stringify(name)}`);
    if (new Set(names).size !== names.length) fail(`${at}: registers names a register two times`);
  }
  if (step.screen !== undefined) {
    const screen = step.screen;
    if (!isObject(screen) || Object.keys(screen).some((key) => key !== "maxMismatchRatio" && key !== "mask")) return fail(`${at}: screen can have maxMismatchRatio and mask, and nothing else`);
    if (screen.maxMismatchRatio !== undefined && !(typeof screen.maxMismatchRatio === "number" && screen.maxMismatchRatio >= 0 && screen.maxMismatchRatio <= 1)) {
      fail(`${at}: screen.maxMismatchRatio must be a number from 0 to 1`);
    }
    if (screen.mask !== undefined) {
      if (!Array.isArray(screen.mask) || screen.mask.length > MAX_MASK_RECTANGLES) return fail(`${at}: screen.mask must be a list of at most ${MAX_MASK_RECTANGLES} rectangles`);
      for (const rectangle of screen.mask as unknown[]) {
        const ok =
          isObject(rectangle) &&
          Object.keys(rectangle).every((key) => ["x", "y", "width", "height"].includes(key)) &&
          isInteger(rectangle.x, 0, 4095) &&
          isInteger(rectangle.y, 0, 4095) &&
          isInteger(rectangle.width, 1, 4096) &&
          isInteger(rectangle.height, 1, 4096);
        if (!ok) fail(`${at}: a screen.mask rectangle needs whole numbers x and y from 0, and width and height from 1`);
      }
    }
  }
  if (step.vicii !== undefined && typeof step.vicii !== "boolean") fail(`${at}: vicii must be true or false`);
  if (step.sprites !== undefined) {
    const sprites = step.sprites;
    if (!Array.isArray(sprites) || sprites.length === 0 || !sprites.every((sprite) => isInteger(sprite, 0, 7)) || new Set(sprites).size !== sprites.length) {
      fail(`${at}: sprites must be a list of different sprite numbers from 0 to 7`);
    }
  }
}

/** Name → address for one side. */
export function loadSymbols(subject: Subject): Map<string, number> {
  const symbols = new Map<string, number>();
  if (subject.symbols === "none") return symbols;
  if (subject.symbols === "knowledge") {
    const db = openForRead();
    for (const symbol of listSymbols(db)) symbols.set(symbol.name, symbol.address);
    db?.close();
    return symbols;
  }
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(subject.symbols).bytes.toString("utf8"));
  } catch (error) {
    throw new ScenarioError(`cannot read the symbols ${subject.symbols}: ${(error as Error).message}`);
  }
  // c64-assembler output, or a plain name → "$xxxx" map. A constant in the
  // assembler output counts too: RAM variables such as "counter = $c100" lie
  // outside the program, so the assembler reports them as constants.
  const assembled = (value as { symbols?: Array<{ name: string; address?: string; value?: number }> }).symbols;
  const entries: Array<[string, unknown]> = Array.isArray(assembled)
    ? assembled.flatMap((symbol): Array<[string, unknown]> => {
        if (symbol.address !== undefined) return [[symbol.name, symbol.address]];
        if (Number.isInteger(symbol.value) && symbol.value! >= 0 && symbol.value! <= 0xffff) return [[symbol.name, formatC64Address(symbol.value!)]];
        return [];
      })
    : Object.entries(value as Record<string, unknown>);
  for (const [name, address] of entries) {
    try {
      symbols.set(name, parseC64Address(String(address)));
    } catch {
      throw new ScenarioError(`the symbol ${name} in ${subject.symbols} has no $xxxx address`);
    }
  }
  return symbols;
}

/** A failure that makes the comparison impossible: the result is INCONCLUSIVE. */
class Inconclusive extends Error {}

export function resolve(location: Location, symbols: Map<string, number>, side: Side): number {
  if (location.startsWith("$")) {
    try {
      return parseC64Address(location);
    } catch {
      throw new ScenarioError(`${location} is not $ followed by four hex digits`);
    }
  }
  const address = symbols.get(location);
  if (address === undefined) throw new Inconclusive(`the ${side} side has no symbol ${location}`);
  return address;
}

interface Observation {
  memory: Array<{ label: string; bytes: number[]; tolerance: number }>;
  registers: Partial<Record<ObservedRegister, unknown>>;
  screen?: { match: boolean; mismatchingPixels: number; mismatchRatio: number; bounds?: unknown };
  vicii?: unknown;
  sprites?: unknown;
}

/**
 * A session baseline name for a checkpoint: letters, digits, dots, underscores
 * or hyphens. The checkpoint's number comes first, so two checkpoints never
 * get the same name.
 */
export function baselineName(checkpoint: number, label: string): string {
  return `test-${checkpoint}-${label}`.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);
}

async function runSide(client: ViceSessionClient, scenario: Scenario, side: Side, symbols: Map<string, number>): Promise<Map<string, Observation>> {
  const subject = scenario[side];
  const observations = new Map<string, Observation>();
  const at = (location: Location) => resolve(location, symbols, side);
  const stop = async () => {
    if ((await client.status()).state === "running") await client.execution({ action: "pause", space: "c64" });
  };
  // Each side starts from a hard reset, stopped at the reset vector, with the control ports released.
  await client.reset({ mode: "hard", run: false });
  await client.joystick({ port: 1, direction: "center", fire: false });
  await client.joystick({ port: 2, direction: "center", fire: false });
  let checkpoint = 0;
  for (const step of scenario.steps) {
    // Observe first: an observe step may also carry "registers" or "memory".
    if ("observe" in step) {
      checkpoint++;
      const observation: Observation = { memory: [], registers: {} };
      for (const item of step.memory ?? []) {
        const spec = typeof item === "string" ? { at: item } : item;
        const read = await client.memoryRead({ address: at(spec.at), size: spec.size ?? 1, space: "c64", view: "cpu" });
        observation.memory.push({ label: spec.size !== undefined && spec.size > 1 ? `${spec.at} (${spec.size} bytes)` : spec.at, bytes: [...Buffer.from(read.data, "hex")], tolerance: spec.tolerance ?? 0 });
      }
      if (step.registers !== undefined) {
        const registers = await client.registersGet("c64");
        for (const name of step.registers) observation.registers[name] = registers[name];
      }
      if (step.vicii) {
        // The raster line changes from one moment to the next; the comparison leaves it out.
        const { rasterLine: _rasterLine, ...state } = await client.vicii();
        observation.vicii = state;
      }
      if (step.sprites !== undefined) observation.sprites = (await client.sprites(step.sprites)).sprites;
      if (step.screen !== undefined) {
        const baseline = baselineName(checkpoint, step.observe);
        if (side === "original") {
          await client.screenCapture(baseline);
        } else {
          const compared = await client.screenCompare({ baseline, maxMismatchRatio: step.screen.maxMismatchRatio ?? 0, mask: step.screen.mask ?? [], includeDiff: false });
          observation.screen = { match: compared.match, mismatchingPixels: compared.mismatchingPixels, mismatchRatio: compared.mismatchRatio, ...(compared.bounds === undefined ? {} : { bounds: compared.bounds }) };
          await client.screenDiscard(baseline);
        }
      }
      observations.set(step.observe, observation);
    } else if ("reset" in step) {
      // Stopped at the reset vector, so frame counts from here are exact.
      await client.reset({ mode: step.reset, run: false });
    } else if ("load" in step) {
      await client.programLoad({ path: subject.program });
    } else if ("autostart" in step) {
      await client.autostart({ path: subject.program, index: 0, run: true });
    } else if ("write" in step) {
      await stop();
      await client.memoryWrite({ address: at(step.write.at), data: Buffer.from(step.write.bytes).toString("hex"), space: "c64", view: "cpu" });
    } else if ("registers" in step) {
      await stop();
      const values: Record<string, number> = {};
      for (const [name, value] of Object.entries(step.registers)) values[name] = typeof value === "number" ? value : at(value as Location);
      await client.registersSet("c64", values);
    } else if ("joystick" in step) {
      await client.joystick({ port: step.joystick.port, direction: step.joystick.direction, fire: step.joystick.fire ?? false });
    } else if ("type" in step) {
      await client.keyboard(textToPetscii(step.type));
    } else if ("frames" in step) {
      await stop();
      await client.execution({ action: "advance-frames", count: step.frames, space: "c64" });
    } else if ("runUntil" in step) {
      const target =
        "at" in step.runUntil
          ? { kind: "address" as const, address: at(step.runUntil.at), space: "c64" as const }
          : { kind: "memory" as const, address: at(step.runUntil.memory.at), operator: "eq" as const, value: step.runUntil.memory.equals, space: "c64" as const, view: "cpu" as const };
      const reached = await client.runUntil({ target, timeoutFrames: step.timeoutFrames });
      if (!reached.reached) {
        throw new Inconclusive(`the ${side} side did not reach the checkpoint before ${step.timeoutFrames} frames (it stopped by ${reached.stopReason} at ${formatC64Address(reached.pc)})`);
      }
    }
  }
  return observations;
}

/** The differences between the two sides' observations at each checkpoint, under the scenario's rules. */
export function compare(original: Map<string, Observation>, rebuild: Map<string, Observation>): Difference[] {
  const differences: Difference[] = [];
  for (const [checkpoint, left] of original) {
    const right = rebuild.get(checkpoint)!;
    left.memory.forEach((item, index) => {
      const other = right.memory[index]!;
      if (item.bytes.some((byte, at) => Math.abs(byte - other.bytes[at]!) > item.tolerance)) {
        const show = (bytes: number[]) => (bytes.length === 1 ? bytes[0] : Buffer.from(bytes).toString("hex"));
        differences.push({ checkpoint, what: `memory ${item.label}`, original: show(item.bytes), rebuild: show(other.bytes) });
      }
    });
    for (const [name, value] of Object.entries(left.registers)) {
      const other = right.registers[name as ObservedRegister];
      if (JSON.stringify(other) !== JSON.stringify(value)) differences.push({ checkpoint, what: `register ${name}`, original: value, rebuild: other });
    }
    const screenDiffers = right.screen !== undefined && !right.screen.match;
    if (screenDiffers) differences.push({ checkpoint, what: "screen", original: "baseline", rebuild: right.screen });
    if (left.vicii !== undefined && JSON.stringify(left.vicii) !== JSON.stringify(right.vicii)) differences.push({ checkpoint, what: "VIC-II state", original: left.vicii, rebuild: right.vicii });
    if (left.sprites !== undefined && JSON.stringify(left.sprites) !== JSON.stringify(right.sprites)) differences.push({ checkpoint, what: "sprites", original: left.sprites, rebuild: right.sprites });
  }
  return differences;
}

/** Runs the scenario on the original, then on the rebuild, in one VICE session. */
export async function runScenario(client: ViceSessionClient, scenario: Scenario): Promise<ScenarioResult> {
  const checkpoints = scenario.steps.flatMap((step) => ("observe" in step ? [step.observe] : []));
  const observed = new Map<Side, Map<string, Observation>>();
  for (const side of SIDES) {
    try {
      observed.set(side, await runSide(client, scenario, side, loadSymbols(scenario[side])));
    } catch (error) {
      if (error instanceof Inconclusive) return { result: "INCONCLUSIVE", scenario: scenario.name, reason: error.message, checkpoints, differences: [] };
      if (error instanceof WireFailure) {
        return { result: "INCONCLUSIVE", scenario: scenario.name, reason: `the ${side} side could not run: ${error.message}`, checkpoints, differences: [] };
      }
      throw error;
    }
  }
  const differences = compare(observed.get("original")!, observed.get("rebuild")!);
  return { result: differences.length === 0 ? "PASS" : "FAIL", scenario: scenario.name, checkpoints, differences };
}
