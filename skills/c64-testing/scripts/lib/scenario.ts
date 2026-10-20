// Functional-equivalence scenarios: a small JSON scenario of ordered
// steps runs on the original and then on the rebuild in one VICE session.
// Observations name semantic symbols that resolve per side, comparisons are
// explicit, and the result is PASS, FAIL or INCONCLUSIVE.

import { isRefusal, Refusal } from "#src/errors.ts";
import { c64AddressOf, formatC64Address, formatSprite, formatVicii, parseC64Address } from "#src/c64.ts";
import { MAX_BASELINES, MAX_MASK_RECTANGLES, maskCoversFrame, WireFailure } from "#src/host-client/tools.ts";
import { LOAD_LIMIT_FRAMES, RUN_LIMIT_FRAMES, runProgram } from "#src/host-client/autostart.ts";
import { ACTION_STEP_KINDS, checkActionStep, checkLocation, isInteger, isObject, refuseOldStep, renamedField, runActionStep, VICE_STEP_KINDS, type ActionStep, type ActionStepKind, type Location } from "#src/host-client/steps.ts";
import { applyEntryState, parseEntryState } from "#src/host-client/entry-state.ts";
import { readPrg } from "#src/host-client/image.ts";
import { readProjectFile, writeReported, type Written } from "#src/host-client/transfer.ts";
import { readMemoryInParts, type ViceSessionClient } from "#src/host-client/vice-session.ts";
import { checkSnapshotFile } from "#src/media.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { nameTable } from "#src/knowledge/names.ts";
import { DEFAULT_SPACE } from "#src/knowledge/schema.ts";
import { programImage } from "#src/knowledge/program.ts";
import { listed } from "#src/script.ts";

export type Side = "original" | "rebuild";
export const SIDES: Side[] = ["original", "rebuild"];

/** A "$xxxx" address or a symbol name that each side resolves on its own. */
export type { Location };

export interface MemoryObservation {
  address: Location;
  /** Bytes from `address`; 1 when not given, at most 64 KiB. */
  size?: number;
  /** cpu (the default) reads as the CPU sees memory; ram reads the RAM under the ROMs and the I/O area. */
  view?: "cpu" | "ram";
  /** The largest allowed difference per byte; 0 when not given. */
  tolerance?: number;
  /** Bytes in the range that the comparison leaves out, each with the reason. */
  exclude?: Array<{ address: Location; reason: string }>;
}

export interface ScreenPolicy {
  /** The largest allowed fraction of different pixels; 0 (exact) when not given. */
  maxMismatchRatio?: number;
  /** Rectangles that the comparison ignores, in screen pixels. */
  mask?: Array<{ x: number; y: number; width: number; height: number }>;
}

type StepBody =
  | { reset: "hard" | "soft" }
  | { load: true }
  | { autostart: true }
  | { snapshot: string }
  | { normalize: true }
  | Exclude<ActionStep, { press: string }>
  | { observe: string; memory?: Array<Location | MemoryObservation>; registers?: ObservedRegister[]; screen?: ScreenPolicy; vicii?: boolean; sprites?: number[] };

/** A step; with side, only that side does it. An observe step has no side: it compares both. */
export type Step = StepBody & { side?: Side };

export interface Subject {
  program: string;
  /** "knowledge" for the project knowledge, a project JSON file (the symbol file of a build or a name → "$xxxx" map), or "none". */
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

/** A byte of a memory item that differs: its address, and its value on each side as two hex digits. */
export interface DifferingByte {
  address: string;
  original: string;
  rebuild: string;
}

/**
 * A difference at a checkpoint. A memory item gives the bytes that differ
 * (at most --max-listed of them, and their count); every other item gives
 * its value on each side.
 */
export interface Difference {
  checkpoint: string;
  what: string;
  original?: unknown;
  rebuild?: unknown;
  bytes?: { count: number; listed: DifferingByte[]; rest?: string };
}

export interface ScenarioResult {
  result: Outcome;
  scenario: string;
  /** Why the result is INCONCLUSIVE. */
  reason?: string;
  checkpoints: string[];
  differences: Difference[];
  /** The bytes that the comparison left out, with their reasons. */
  excluded?: Array<{ checkpoint: string; address: Location; reason: string }>;
  /** The files that a FAIL wrote with --out. */
  files?: Written[];
}

const STEP_KINDS = ["reset", "load", "autostart", "snapshot", "normalize", ...ACTION_STEP_KINDS, "observe"];
/** The step kinds that a scenario runs: press is for the replay core only. */
const SHOWN_KINDS = ["reset", "load", "autostart", "snapshot", "normalize", ...VICE_STEP_KINDS, "observe"];

/** The keys each kind of step can have. */
const STEP_KEYS: Record<string, readonly string[]> = {
  observe: ["observe", "memory", "registers", "screen", "vicii", "sprites"],
};

/** The registers an observe step can compare. */
export const OBSERVED_REGISTERS = ["pc", "a", "x", "y", "sp", "flags"] as const;
type ObservedRegister = (typeof OBSERVED_REGISTERS)[number];

/** Reads and checks a scenario file. Refuses it with the first problem. */
export function readScenario(path: string): Scenario {
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(path).bytes.toString("utf8"));
  } catch (error) {
    if (isRefusal(error)) throw error;
    throw new Refusal("invalid-input", `cannot read the scenario ${path}: ${(error as Error).message}`);
  }
  const fail = (message: string): never => {
    throw new Refusal("invalid-input", `scenario ${path}: ${message}`);
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
    if (kinds.length > 1) return fail(`${at} has ${kinds.length} step kinds: ${kinds.join(", ")}. Give each one its own step`);
    if (kinds.length !== 1) return fail(`${at} must have exactly one of ${SHOWN_KINDS.join(", ")}`);
    const kind = kinds[0]!;
    refuseOldStep(kind, step, at, fail);
    const allowed = [...(STEP_KEYS[kind] ?? [kind]), ...(kind === "observe" ? [] : ["side"])];
    for (const key of Object.keys(step)) if (!allowed.includes(key)) fail(`${at} has the key ${key}, which a ${kind} step does not have`);
    if (step.side !== undefined && !(SIDES as unknown[]).includes(step.side)) fail(`${at}: side must be original or rebuild`);
    if ((ACTION_STEP_KINDS as readonly string[]).includes(kind)) {
      // The step with its defaults filled in, as the shared schema of the action steps gives it.
      scenario.steps[index] = { ...checkActionStep(kind as ActionStepKind, { [kind]: step[kind] }, at, fail), ...(step.side === undefined ? {} : { side: step.side as Side }) } as Step;
      return;
    }
    checkStep(kind, step, at, fail, scenario.videoStandard ?? "pal");
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

/** Checks the value of one step against its kind. */
function checkStep(kind: string, step: Record<string, unknown>, at: string, fail: (message: string) => never, videoStandard: "pal" | "ntsc"): void {
  switch (kind) {
    case "reset":
      if (step.reset !== "hard" && step.reset !== "soft") fail(`${at}: reset must be hard or soft`);
      return;
    case "load":
    case "autostart":
      if (step[kind] !== true) fail(`${at}: ${kind} must be true`);
      return;
    case "snapshot":
      if (typeof step.snapshot !== "string" || step.snapshot === "") fail(`${at}: snapshot needs a .vsf file in the project`);
      return;
    case "normalize":
      if (step.normalize !== true) fail(`${at}: normalize is true: it writes the entry state of the knowledge`);
      return;
    default:
      checkObserve(step, at, fail, videoStandard);
  }
}

function checkObserve(step: Record<string, unknown>, at: string, fail: (message: string) => never, videoStandard: "pal" | "ntsc"): void {
  if (typeof step.observe !== "string" || step.observe === "") fail(`${at} needs a new checkpoint name`);
  if (step.memory !== undefined) {
    if (!Array.isArray(step.memory) || step.memory.length === 0) fail(`${at}: memory must be a list of names, $ addresses or objects with address`);
    for (const item of step.memory as unknown[]) {
      if (typeof item === "string") {
        checkLocation(item, `${at}: memory`, fail);
        continue;
      }
      const itemFields = ["address", "size", "view", "tolerance", "exclude"];
      if (!isObject(item)) return fail(`${at}: memory must be a list of names, $ addresses or objects with address`);
      for (const key of Object.keys(item)) if (!itemFields.includes(key)) fail(`${at}: a memory object has the field ${key}. ${renamedField(key, itemFields) ?? `It has ${itemFields.join(", ")}, and nothing else`}`);
      if (item.view !== undefined && item.view !== "cpu" && item.view !== "ram") fail(`${at}: memory.view must be cpu or ram`);
      if (item.exclude !== undefined) {
        if (!Array.isArray(item.exclude) || item.exclude.length === 0) fail(`${at}: memory.exclude must be a list of objects with address and reason`);
        for (const excluded of item.exclude as unknown[]) {
          if (!isObject(excluded)) return fail(`${at}: memory.exclude must be a list of objects with address and reason`);
          for (const key of Object.keys(excluded)) if (key !== "address" && key !== "reason") fail(`${at}: an exclude has the field ${key}. ${renamedField(key, ["address", "reason"]) ?? "It has address and reason, and nothing else"}`);
          checkLocation(excluded.address, `${at}: memory.exclude.address`, fail);
          if (typeof excluded.reason !== "string" || excluded.reason.trim() === "") fail(`${at}: an exclude needs a reason: why this byte may differ`);
        }
      }
      checkLocation(item.address, `${at}: memory.address`, fail);
      if (item.size !== undefined && !isInteger(item.size, 1, 0x10000)) fail(`${at}: memory.size must be a number from 1 to 65536`);
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
      // The emulator refuses such a compare too, but only after the original side ran.
      if (maskCoversFrame(screen.mask as Array<{ x: number; y: number; width: number; height: number }>, videoStandard)) fail(`${at}: screen.mask covers the whole screen, so nothing is compared`);
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

/**
 * Name → address from a source of names: none; the knowledge (its symbols and
 * the analyzer names that only one address has); the symbol file of a build; or
 * a JSON map of name to $ address. With kinds "code", only the names that move
 * with the code: labels and routines of the knowledge, and the labels of the
 * assembler output. With "all", also the data names and the assembler
 * constants of four hex digits: RAM variables such as "counter = $c100" lie
 * outside the program, so the assembler reports them as constants.
 */
export function namesOf(source: string, kinds: "code" | "all" = "all"): Map<string, number> {
  if (source === "none") return new Map();
  if (source === "knowledge") {
    const db = openForRead();
    try {
      return nameTable(db, DEFAULT_SPACE, kinds === "code" ? ["label", "routine"] : undefined);
    } finally {
      db?.close();
    }
  }
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(source).bytes.toString("utf8"));
  } catch (error) {
    if (isRefusal(error)) throw error;
    throw new Refusal("invalid-input", `cannot read the symbols ${source}: ${(error as Error).message}`);
  }
  const assembled = (value as { symbols?: Array<{ name: string; address?: string; value?: string }> }).symbols;
  const entries: Array<[string, unknown]> = Array.isArray(assembled)
    ? assembled.flatMap((symbol): Array<[string, unknown]> => {
        if (symbol.address !== undefined) return [[symbol.name, symbol.address]];
        // A constant above $ffff has more digits and is no address.
        if (kinds === "all" && typeof symbol.value === "string" && /^\$[0-9a-f]{4}$/.test(symbol.value)) return [[symbol.name, symbol.value]];
        return [];
      })
    : Object.entries(value as Record<string, unknown>);
  const names = new Map<string, number>();
  for (const [name, address] of entries) {
    const at = typeof address === "string" ? c64AddressOf(address) : undefined;
    if (at === undefined) throw new Refusal("invalid-input", `the symbol ${name} in ${source} has no $ address`);
    names.set(name, at);
  }
  return names;
}

/** The remedy for a scenario program that is no PRG. */
const PROGRAM_REMEDY = "A scenario program is a PRG. Extract the program file from the disk, tape or cartridge image, and give that PRG";

/**
 * Checks each file that the scenario names before an emulator starts: the
 * program and the symbols of each side, and each snapshot file. A missing
 * file is not-found; a program that is no PRG, a symbols file with no names
 * and a snapshot step whose file is no VICE snapshot file are invalid-input.
 * A refusal starts with the scenario file, as the other scenario errors do,
 * and names the field or the step. Gives the names of each side.
 */
export function scenarioNames(scenario: Scenario, path: string): Map<Side, Map<string, number>> {
  const names = new Map<Side, Map<string, number>>();
  const named = <T>(field: string, read: () => T): T => {
    try {
      return read();
    } catch (error) {
      if (isRefusal(error)) throw new Refusal(error.code, `scenario ${path}: ${field}: ${error.message}`);
      throw error;
    }
  };
  for (const side of SIDES) {
    named(`${side}.program`, () => readPrg(scenario[side].program, PROGRAM_REMEDY));
    names.set(side, named(`${side}.symbols`, () => namesOf(scenario[side].symbols)));
  }
  scenario.steps.forEach((step, index) => {
    if ("snapshot" in step) named(`step ${index + 1}: snapshot`, () => checkSnapshotFile(step.snapshot, readProjectFile(step.snapshot).bytes));
  });
  return names;
}

/** A failure that makes the comparison impossible: the result is INCONCLUSIVE. */
class Inconclusive extends Error {}

export function resolve(location: Location, symbols: Map<string, number>, side: Side): number {
  if (location.startsWith("$")) {
    try {
      return parseC64Address(location);
    } catch {
      throw new Refusal("invalid-input", `${location} is not $ and 1 to 4 hex digits`);
    }
  }
  const address = symbols.get(location);
  if (address === undefined) throw new Inconclusive(`the ${side} side has no symbol ${location}`);
  return address;
}

interface Observation {
  memory: Array<{ label: string; address: number; bytes: number[]; tolerance: number; excluded: Array<{ offset: number; address: Location; reason: string }> }>;
  registers: Partial<Record<ObservedRegister, unknown>>;
  screen?: { match: boolean; mismatchingPixels: number; comparedPixels: number; mismatchRatio: number; bounds?: unknown };
  vicii?: unknown;
  sprites?: unknown;
  /** PNG images for the files of a FAIL: the side's screen, and on the rebuild the difference image. */
  png?: string;
  diffPng?: string;
}

/** Writes pages 0-3 and $00/$01 from the entry state of the knowledge: both sides then start from the same RAM. */
async function normalize(client: ViceSessionClient): Promise<void> {
  const db = openForRead();
  let state: unknown;
  try {
    state = programImage(db)?.state;
  } finally {
    db?.close();
  }
  if (state === undefined) throw new Refusal("invalid-input", "normalize needs the entry state of a capture in the project knowledge, and the knowledge has none. Capture the unpacked program at its entry point, and put the capture image into the project knowledge");
  await applyEntryState(client, parseEntryState(state, "the entry state of the knowledge"), { registers: false });
}

/**
 * A session baseline name for a checkpoint: letters, digits, dots, underscores
 * or hyphens. The checkpoint's number comes first, so two checkpoints never
 * get the same name.
 */
export function baselineName(checkpoint: number, label: string): string {
  return `test-${checkpoint}-${label}`.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);
}

/** Autostart that returns only when the program runs (runProgram), or INCONCLUSIVE with the reason. */
async function startProgram(client: ViceSessionClient, program: string, side: Side): Promise<void> {
  const failed = await runProgram(client, program, readProjectFile(program).bytes);
  if (failed === "not-loaded") throw new Inconclusive(`the ${side} program was not in memory after ${LOAD_LIMIT_FRAMES} frames of autostart`);
  if (failed === "not-started") throw new Inconclusive(`the ${side} program did not start within ${RUN_LIMIT_FRAMES} frames of RUN; autostart runs only a program with a BASIC start line`);
}

async function runSide(client: ViceSessionClient, scenario: Scenario, side: Side, symbols: Map<string, number>, files: boolean): Promise<Map<string, Observation>> {
  const observations = new Map<string, Observation>();
  const at = (location: Location) => resolve(location, symbols, side);
  // Each side starts from a hard reset, stopped at the reset vector, with the control ports released.
  await client.reset({ mode: "hard", run: false });
  await client.joystick({ port: 1, direction: "center", fire: false });
  await client.joystick({ port: 2, direction: "center", fire: false });
  let checkpoint = 0;
  for (const [index, step] of scenario.steps.entries()) {
    if (step.side !== undefined && step.side !== side) continue;
    try {
      checkpoint = await runStep(client, scenario, side, step, at, checkpoint, files, observations);
    } catch (error) {
      // The step in the reason or the message: the scenario file has many steps.
      const where = `step ${index + 1} (${stepKindOf(step)})`;
      if (error instanceof Inconclusive) throw new Inconclusive(`${where}: ${error.message}`);
      if (error instanceof WireFailure) throw new WireFailure(error.code, `${where}: ${error.message}`);
      if (error instanceof Refusal) throw new Refusal(error.code, `${where}: ${error.message}`);
      throw error;
    }
  }
  return observations;
}

/** The kind of a checked step: its one key from the step kinds. */
const stepKindOf = (step: Step) => Object.keys(step).find((key) => STEP_KINDS.includes(key)) ?? "step";

/** Runs one step of one side. Gives the number of the last checkpoint. */
async function runStep(client: ViceSessionClient, scenario: Scenario, side: Side, step: Step, at: (location: Location) => number, last: number, files: boolean, observations: Map<string, Observation>): Promise<number> {
  const subject = scenario[side];
  let checkpoint = last;
  // Observe first: an observe step may also carry "registers" or "memory".
  if ("observe" in step) {
    checkpoint++;
    const observation: Observation = { memory: [], registers: {} };
    for (const item of step.memory ?? []) {
      const spec: MemoryObservation = typeof item === "string" ? { address: item } : item;
      const address = at(spec.address);
      const size = spec.size ?? 1;
      const read = { data: (await readMemoryInParts(client, address, size, spec.view ?? "cpu")).toString("hex") };
      const excluded = (spec.exclude ?? []).map((exclude) => {
        const offset = at(exclude.address) - address;
        if (offset < 0 || offset >= size) throw new Refusal("invalid-input", `the exclude ${exclude.address} lies outside the observed ${spec.address} (${size} bytes)`);
        return { offset, address: exclude.address, reason: exclude.reason };
      });
      observation.memory.push({ label: size > 1 ? `${spec.address} (${size} bytes)` : spec.address, address, bytes: [...Buffer.from(read.data, "hex")], tolerance: spec.tolerance ?? 0, excluded });
    }
    if (step.registers !== undefined) {
      const registers = await client.registersGet("c64");
      for (const name of step.registers) observation.registers[name] = name === "pc" ? formatC64Address(registers.pc) : registers[name];
    }
    if (step.vicii) {
      // The raster line changes from one moment to the next; the comparison leaves it out.
      const { rasterLine: _rasterLine, ...state } = await client.vicii();
      observation.vicii = formatVicii(state);
    }
    if (step.sprites !== undefined) observation.sprites = (await client.sprites(step.sprites)).sprites.map(formatSprite);
    if (step.screen !== undefined) {
      const baseline = baselineName(checkpoint, step.observe);
      if (side === "original") {
        const shot = await client.screenCapture(baseline);
        if (files) observation.png = shot.png;
      } else {
        const compared = await client.screenCompare({ baseline, maxMismatchRatio: step.screen.maxMismatchRatio ?? 0, mask: step.screen.mask ?? [], includeDiff: files });
        observation.screen = { match: compared.match, mismatchingPixels: compared.mismatchingPixels, comparedPixels: compared.comparedPixels, mismatchRatio: compared.mismatchRatio, ...(compared.bounds === undefined ? {} : { bounds: compared.bounds }) };
        if (files) {
          observation.png = (await client.screenCapture()).png;
          if (compared.diffPng !== undefined) observation.diffPng = compared.diffPng;
        }
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
    await startProgram(client, subject.program, side);
  } else if ("snapshot" in step) {
    await client.snapshotRestore(readProjectFile(step.snapshot).bytes);
  } else if ("normalize" in step) {
    await normalize(client);
  } else {
    const { side: _side, ...action } = step;
    const notReached = await runActionStep(client, action as ActionStep, at);
    if (notReached !== undefined && "runUntil" in step) {
      throw new Inconclusive(`the ${side} side did not reach the checkpoint before ${step.runUntil.timeoutFrames} frames (it stopped by ${notReached.stopReason} at ${formatC64Address(notReached.pc)})`);
    }
  }
  return checkpoint;
}

type MemoryItem = Observation["memory"][number];

/** The bytes of a memory item that differ by more than its tolerance, without the excluded bytes. */
function differingBytes(item: MemoryItem, other: MemoryItem): DifferingByte[] {
  const hex = (byte: number) => byte.toString(16).padStart(2, "0");
  const skipped = new Set(item.excluded.map((excluded) => excluded.offset));
  return item.bytes.flatMap((byte, offset) => (!skipped.has(offset) && Math.abs(byte - other.bytes[offset]!) > item.tolerance ? [{ address: formatC64Address(item.address + offset), original: hex(byte), rebuild: hex(other.bytes[offset]!) }] : []));
}

/** The most differing bytes of one memory item that a result lists when no --max-listed is given. */
export const DEFAULT_LISTED_BYTES = 50;

/**
 * The differences between the two sides' observations at each checkpoint,
 * under the scenario's rules. A memory item lists at most `max` differing
 * bytes; `rest` tells where the others are.
 */
export function compare(original: Map<string, Observation>, rebuild: Map<string, Observation>, options: { max?: number; rest?: string } = {}): Difference[] {
  const differences: Difference[] = [];
  const max = options.max ?? DEFAULT_LISTED_BYTES;
  for (const [checkpoint, left] of original) {
    const right = rebuild.get(checkpoint)!;
    left.memory.forEach((item, index) => {
      const bytes = differingBytes(item, right.memory[index]!);
      if (bytes.length > 0) differences.push({ checkpoint, what: `memory ${item.label}`, bytes: listed(bytes, max, undefined, options.rest) });
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

/**
 * Writes the files of a FAIL into `out`: for a screen difference both
 * screens and the difference image, and memory.json with each differing
 * memory item: all its bytes on each side, and each byte that differs.
 */
function writeFailFiles(out: string, original: Map<string, Observation>, rebuild: Map<string, Observation>, differences: Difference[]): Written[] {
  const files: Written[] = [];
  const write = (name: string, bytes: Uint8Array) => {
    files.push(writeReported(`${out}/${name}`, bytes, { what: "--out" }));
  };
  const memory: Array<{ checkpoint: string; what: string; address: string; original: string; rebuild: string; bytes: DifferingByte[] }> = [];
  for (const difference of differences) {
    const left = original.get(difference.checkpoint)!;
    const right = rebuild.get(difference.checkpoint)!;
    const name = difference.checkpoint.replace(/[^A-Za-z0-9._-]/g, "_");
    if (difference.what === "screen") {
      if (left.png !== undefined) write(`${name}-original.png`, Buffer.from(left.png, "base64"));
      if (right.png !== undefined) write(`${name}-rebuild.png`, Buffer.from(right.png, "base64"));
      if (right.diffPng !== undefined) write(`${name}-diff.png`, Buffer.from(right.diffPng, "base64"));
    }
    if (difference.what.startsWith("memory ")) {
      const index = left.memory.findIndex((item) => `memory ${item.label}` === difference.what);
      const item = left.memory[index]!;
      const other = right.memory[index]!;
      const show = (bytes: number[]) => Buffer.from(bytes).toString("hex");
      memory.push({ checkpoint: difference.checkpoint, what: difference.what, address: formatC64Address(item.address), original: show(item.bytes), rebuild: show(other.bytes), bytes: differingBytes(item, other) });
    }
  }
  if (memory.length > 0) write("memory.json", Buffer.from(`${JSON.stringify(memory, null, 2)}\n`));
  return files;
}

/** Runs the scenario on the original, then on the rebuild, in one VICE session. With out, a FAIL leaves files there. */
export async function runScenario(client: ViceSessionClient, scenario: Scenario, options: { out?: string; names?: Map<Side, Map<string, number>>; max?: number } = {}): Promise<ScenarioResult> {
  const checkpoints = scenario.steps.flatMap((step) => ("observe" in step ? [step.observe] : []));
  const observed = new Map<Side, Map<string, Observation>>();
  // The names of both sides before either side runs: a bad symbols file is an error, not a result.
  const names = options.names ?? new Map(SIDES.map((side) => [side, namesOf(scenario[side].symbols)]));
  for (const side of SIDES) {
    try {
      observed.set(side, await runSide(client, scenario, side, names.get(side)!, options.out !== undefined));
    } catch (error) {
      if (error instanceof Inconclusive) return { result: "INCONCLUSIVE", scenario: scenario.name, reason: error.message, checkpoints, differences: [] };
      if (error instanceof WireFailure) {
        return { result: "INCONCLUSIVE", scenario: scenario.name, reason: `the ${side} side could not run: ${error.message}`, checkpoints, differences: [] };
      }
      throw error;
    }
  }
  const original = observed.get("original")!;
  const rebuild = observed.get("rebuild")!;
  const differences = compare(original, rebuild, { ...(options.max === undefined ? {} : { max: options.max }), rest: options.out === undefined ? "a larger --max-listed, or --out <dir> for memory.json with every byte" : `${options.out}/memory.json` });
  const excluded = [...original].flatMap(([checkpoint, observation]) => observation.memory.flatMap((item) => item.excluded.map((excluded) => ({ checkpoint, address: excluded.address, reason: excluded.reason }))));
  const files = differences.length > 0 && options.out !== undefined ? writeFailFiles(options.out, original, rebuild, differences) : [];
  return {
    result: differences.length === 0 ? "PASS" : "FAIL",
    scenario: scenario.name,
    checkpoints,
    differences,
    ...(excluded.length === 0 ? {} : { excluded }),
    ...(files.length === 0 ? {} : { files }),
  };
}
