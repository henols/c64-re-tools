// Recordings: a session of a program in the replay core (c64run), kept as the
// values that its input reads got (the joystick ports, the keyboard matrix,
// the SID noise) and the state hash at its end. A replay gives the same values
// to the same reads, keyed by the site (the reading instruction) and the read
// index. On the original it must end with the same hash. On a rebuild it
// compares the state at each entry of one routine (the checkpoints) with the
// original's. Timing does not key anything, so a rebuild with other timing
// replays the same session. A recording needs no names: the checkpoint and the
// state can be chosen at replay time, with the names that the knowledge has then.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { isRefusal, Refusal } from "#src/errors.ts";
import { formatC64Address, parseC64Address } from "#src/c64.ts";
import { READY_FRAMES } from "#src/host-client/entry-state.ts";
import { ACTION_STEP_KINDS, checkActionStep, isInteger, isObject, keyboardBytes, renamedField, stepKind, type ActionStep, type Location } from "#src/host-client/steps.ts";
import { readProjectFile, type Written } from "#src/host-client/transfer.ts";
import { PAL_FRAME_CYCLES, type C64RunSession, type CoreStatus } from "#src/native/c64run.ts";
import type { Workspace } from "#src/native/staging.ts";
import { namesOf, type Outcome } from "./scenario.ts";

export const RECORDING_FORMAT = 1;
/**
 * CIA 1 ports A and B (joystick 2, joystick 1 and the keyboard matrix); the
 * four SID registers that a program can read: the paddles ($D419, $D41A) and
 * voice 3 (the noise output $D41B and its envelope $D41C), which programs use as
 * random seeds; and I/O 1 and I/O 2 ($DE00-$DFFF), where a C64 without a
 * cartridge gives the last byte on the bus.
 */
export const DEFAULT_INPUTS = ["$dc00", "$dc01", "$d419", "$d41a", "$d41b", "$d41c", "$de00-$dfff"];

/** The inputs argument of the replay core: hex addresses and ranges without $. */
export function inputsArgument(inputs: string[]): string {
  return inputs.map((input) => input.replace(/\$/g, "")).join(",");
}
/** Frames that a pressed key is held, and then released. */
const KEY_FRAMES = 3;
const MAX_STATE_ITEMS = 16;
const MAX_STATE_BYTES = 4096;
/** A replay of a rebuild may take this many times the cycles of the recording before it stops. */
const REBUILD_TIME_FACTOR = 2;

export interface StateItem {
  address: Location;
  size: number;
}

/** The input of record.ts. */
export interface RecordFile {
  name: string;
  program: string;
  /** "knowledge", "none", or a project JSON file (c64-assembler output or a name → "$xxxx" map). */
  symbols: string;
  /** true: load the program with the CPU at READY and no RUN; a registers step starts it. */
  load?: boolean;
  /** The comparison that a replay uses when it gets none: the checkpoint routine and the state. */
  compare?: Comparison;
  inputs: string[];
  steps: ActionStep[];
}

/**
 * What a replay compares: the state at each entry of a routine, for example the
 * main loop of a game. `pin` is random state in RAM (a seed, a pointer into a
 * random table): at each checkpoint the rebuild gets the original's values there.
 */
export interface Comparison {
  checkpoint: Location;
  state: StateItem[];
  pin?: StateItem[];
}

/** RESTORE: it starts an NMI and is no read, so the recording keeps it as an event. */
export interface RestoreAction {
  restore: true;
}

/** A step that is not input, or a RESTORE of the play: it runs at the same point of the program on each replay. */
export interface RecordedEvent {
  /** The step of the record file; none for a RESTORE of the play. */
  step?: number;
  action: ActionStep | RestoreAction;
  /**
   * The point: the n-th read at the busiest program site, or a tick when no
   * program site has read yet. An event that follows another event directly
   * has { previous: true }: it runs where that one ended.
   */
  key: { site: Location; addr: Location; count: number } | { tick: number } | { previous: true };
}

export interface RecordedSite {
  site: Location;
  addr: Location;
  reads: number;
  rom: boolean;
}

/** recording.json */
export interface Recording {
  format: typeof RECORDING_FORMAT;
  name: string;
  program: string;
  sha256: string;
  symbols: string;
  load: boolean;
  compare?: Comparison;
  inputs: string[];
  events: RecordedEvent[];
  sites: RecordedSite[];
  /** The cycles of the session, and the state hash at its end (RAM from $0002 and colour RAM). */
  ticks: number;
  hash: string;
}

export const RECORDING_FILES = { recording: "recording.json", reads: "reads.txt", coverage: "coverage.bin" } as const;

/** Steps that are input or time: the replay gives the program the reads that they caused, and does not do them again. */
const INPUT_KINDS = new Set(["joystick", "press", "frames"]);
/** The KERNAL keyboard queue: $0277, its length in $c6, at most 10 keys. */
const QUEUE = 0x0277;
const QUEUE_LENGTH = 0x00c6;
const QUEUE_SIZE = 10;

const hex = (address: number) => address.toString(16).padStart(4, "0");

/** The keys of the replay core for the characters that a press step can have. */
const KEY_CODES = new Map<string, number>([
  ...[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 +-.:@,*;=/!\"#$%&'()[]<>?"].map((character) => [character, character.charCodeAt(0)] as [string, number]),
  ["\n", 0x0d],
]);

/** The key codes of a text; a-z type as A-Z, as the C64 shows them after power-on. */
export function keyCodes(text: string): number[] {
  return [...text.replace(/\r\n?/g, "\n")].map((character) => {
    const code = KEY_CODES.get(character.toUpperCase());
    if (code === undefined) throw new Refusal("invalid-input", `press cannot press ${JSON.stringify(character)} on the keyboard of the replay core`);
    return code;
  });
}

/** The joystick mask of the replay core: 1 up, 2 down, 4 left, 8 right, $10 fire. */
export function joystickMask(direction: Extract<ActionStep, { joystick: unknown }>["joystick"]["direction"], fire: boolean): number {
  const bits: Record<string, number> = { up: 1, down: 2, left: 4, right: 8 };
  return direction.split("-").reduce((mask, part) => mask | (bits[part] ?? 0), fire ? 0x10 : 0);
}

/** A state item of the command line: a name or a $ address, with :size for more than one byte. */
export function parseStateItem(text: string): StateItem {
  const match = /^([^:]+)(?::(\d+))?$/.exec(text);
  const size = Number(match?.[2] ?? 1);
  if (match === null || !isInteger(size, 1, MAX_STATE_BYTES)) throw new Refusal("invalid-input", `--state ${text}: give a name or a $ address, with :size from 1 to ${MAX_STATE_BYTES}`);
  return { address: match[1]!, size };
}

/** Checks the memory items of state or pin (`what`): names, $ addresses, or { address, size }. */
export function checkState(value: unknown, fail: (message: string) => never, what = "state"): StateItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_STATE_ITEMS) fail(`${what} must be a list of 1 to ${MAX_STATE_ITEMS} memory items`);
  return (value as unknown[]).map((item, index) => {
    const spec = typeof item === "string" ? { address: item } : item;
    if (isObject(spec)) {
      for (const key of Object.keys(spec)) {
        const renamed = renamedField(key, ["address", "size"]);
        if (key !== "address" && key !== "size") fail(`${what} item ${index + 1} has the field ${key}. ${renamed ?? "A memory item has address and size, and nothing else"}`);
      }
    }
    if (!isObject(spec) || typeof spec.address !== "string") fail(`${what} item ${index + 1} must be a name, a $ address, or { address, size }`);
    const size = (spec as { size?: unknown }).size ?? 1;
    if (!isInteger(size, 1, MAX_STATE_BYTES)) fail(`${what} item ${index + 1}: size must be from 1 to ${MAX_STATE_BYTES}`);
    return { address: (spec as { address: string }).address, size: size as number };
  });
}

function checkInputs(value: unknown, fail: (message: string) => never): string[] {
  if (value === undefined) return DEFAULT_INPUTS;
  if (!Array.isArray(value) || value.length === 0) fail("inputs must be a list of I/O addresses");
  for (const input of value as unknown[]) {
    if (typeof input !== "string" || !/^\$d[0-9a-f]{3}(-\$d[0-9a-f]{3})?$/i.test(input)) fail(`inputs must be $ addresses or ranges ($de00-$dfff) in $D000-$DFFF, not ${String(input)}`);
  }
  return (value as string[]).map((input) => input.toLowerCase());
}

/** Reads and checks a record file. Refuses it with the first problem. */
export function readRecordFile(path: string): RecordFile {
  const fail = (message: string): never => {
    throw new Refusal("invalid-input", `record file ${path}: ${message}`);
  };
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(path).bytes.toString("utf8"));
  } catch (error) {
    if (isRefusal(error)) throw error;
    return fail((error as Error).message);
  }
  if (!isObject(value)) return fail("it must be a JSON object");
  const known = ["name", "program", "symbols", "load", "checkpoint", "state", "pin", "inputs", "steps"];
  for (const key of Object.keys(value)) if (!known.includes(key)) fail(`it has the key ${key}; a record file has ${known.join(", ")}`);
  if (typeof value.name !== "string" || value.name === "") fail("name must be a short text");
  if (typeof value.program !== "string" || value.program === "") fail("program must be a PRG file in the project");
  if (value.symbols !== undefined && typeof value.symbols !== "string") fail('symbols must be "knowledge", "none" or a JSON file');
  if (value.load !== undefined && typeof value.load !== "boolean") fail("load must be true or false");
  if ((value.checkpoint === undefined) !== (value.state === undefined)) fail("give checkpoint and state together, or neither: a replay can give them");
  if (value.checkpoint !== undefined && (typeof value.checkpoint !== "string" || value.checkpoint === "")) fail("checkpoint must be the name or $ address of a routine");
  if (value.pin !== undefined && value.checkpoint === undefined) fail("pin needs checkpoint and state");
  const pin = value.pin === undefined ? undefined : checkState(value.pin, fail, "pin");
  const compare = value.checkpoint === undefined ? undefined : { checkpoint: value.checkpoint as string, state: checkState(value.state, fail), ...(pin === undefined ? {} : { pin }) };
  const inputs = checkInputs(value.inputs, fail);
  if (!Array.isArray(value.steps) || value.steps.length === 0) fail("steps must be a list with at least one step");
  const steps = (value.steps as unknown[]).map((raw, index) => {
    const at = `step ${index + 1}`;
    const step = checkActionStep(stepKind(raw, ACTION_STEP_KINDS, at, fail), raw as Record<string, unknown>, at, fail, { press: true });
    checkCoreStep(step, at, fail);
    return step;
  });
  return {
    name: value.name as string,
    program: value.program as string,
    symbols: (value.symbols as string | undefined) ?? "knowledge",
    load: value.load === true,
    ...(compare === undefined ? {} : { compare }),
    inputs,
    steps,
  };
}

/** What the replay core cannot do of a step that is right for VICE: it has the C64 alone, no raster wait and no conditions. */
function checkCoreStep(step: ActionStep, at: string, fail: (message: string) => never): void {
  if ("write" in step && step.write.space !== "c64") fail(`${at}: the replay core has the C64 alone, not ${step.write.space}`);
  if ("press" in step) {
    try {
      keyCodes(step.press);
    } catch (error) {
      if (isRefusal(error)) fail(`${at}: ${error.message}`);
      throw error;
    }
  }
  if ("type" in step) {
    const keys = keyboardBytes(step.type);
    if (typeof keys !== "string" && keys.length > QUEUE_SIZE) fail(`${at}: the KERNAL keyboard queue holds ${QUEUE_SIZE} keys; give more type steps, or press for keys of the keyboard matrix`);
  }
  if ("runUntil" in step) {
    const { target } = step.runUntil;
    if (target.kind === "raster") fail(`${at}: the replay core has no raster target; use an address or a memory target`);
    else if (target.space !== "c64") fail(`${at}: the replay core has the C64 alone, not ${target.space}`);
    else if (target.kind === "address" && target.condition !== undefined) fail(`${at}: the replay core has no condition at an address target`);
  }
}

/** Reads and checks recording.json of a recording folder. */
export function readRecording(folder: string): Recording {
  const path = `${folder}/${RECORDING_FILES.recording}`;
  let value: unknown;
  try {
    value = JSON.parse(readProjectFile(path).bytes.toString("utf8"));
  } catch (error) {
    if (isRefusal(error)) throw error;
    throw new Refusal("invalid-input", `recording ${path}: ${(error as Error).message}`);
  }
  const fail = (message: string): never => {
    throw new Refusal("invalid-input", `recording ${path}: ${message}`);
  };
  if (!isObject(value) || value.format !== RECORDING_FORMAT) return fail(`it is not a recording of format ${RECORDING_FORMAT}`);
  for (const key of ["name", "program", "sha256", "symbols", "hash"]) if (typeof value[key] !== "string") fail(`${key} is missing`);
  for (const key of ["inputs", "events", "sites"]) if (!Array.isArray(value[key])) fail(`${key} is missing`);
  if (!isInteger(value.ticks, 1, Number.MAX_SAFE_INTEGER)) fail("ticks is missing");
  // A recording of an older version can have the step forms of the 2.0 files: refused with the form to write, never replayed wrong.
  const remedy = "Record the session again with record, or write the 2.1 form in recording.json";
  if (value.compare !== undefined) {
    const compare = isObject(value.compare) ? value.compare : fail("compare must be an object with checkpoint, state and pin");
    const where = (message: string): never => fail(`compare: ${message}. ${remedy}`);
    if (typeof compare.checkpoint !== "string" || compare.checkpoint === "") where("checkpoint must be the name or $ address of a routine");
    checkState(compare.state, where);
    if (compare.pin !== undefined) checkState(compare.pin, where, "pin");
  }
  (value.events as unknown[]).forEach((event, index) => {
    const at = `event ${index + 1}`;
    const where = (message: string): never => fail(`${message}. ${remedy}`);
    if (!isObject(event) || !isObject(event.action) || !isObject(event.key)) return where(`${at} must be an object with action and key`);
    const named = typeof event.step === "number" ? `${at} (step ${event.step})` : at;
    if (event.action.restore === true && Object.keys(event.action).length === 1) return;
    // The action with the defaults filled in, as the record file gave it.
    event.action = checkActionStep(stepKind(event.action, ACTION_STEP_KINDS, named, where), event.action, named, where, { press: true });
  });
  return value as unknown as Recording;
}

/**
 * The addresses of one side. A name comes from the symbols of the side. A $
 * address is an address of the original: on the rebuild it moves with the
 * name before it (code with a code label, data with any symbol).
 */
export interface SideAddresses {
  code: (location: Location) => number;
  data: (location: Location) => number;
}

function sideAddresses(symbols: Map<string, number>, side: string, move: { code: (address: number) => number; data: (address: number) => number }): SideAddresses {
  const resolve = (location: Location, kind: "code" | "data") => {
    if (location.startsWith("$")) return move[kind](parseC64Address(location));
    const address = symbols.get(location);
    if (address === undefined) throw new Refusal("invalid-input", `the ${side} side has no symbol ${location}`);
    return address;
  };
  return { code: (location) => resolve(location, "code"), data: (location) => resolve(location, "data") };
}

/** The furthest a site can be from the label before it and still move with that label. */
const MAX_LABEL_DISTANCE = 4096;

/**
 * Moves an address of the original to the rebuild: the name before it in the
 * original, plus the same offset from that name in the rebuild. An address
 * without a name before it (within MAX_LABEL_DISTANCE) stays where it is.
 */
export function mover(from: Map<string, number>, to: Map<string, number>): (address: number) => number {
  const names = [...from].filter(([name]) => to.has(name)).sort((a, b) => a[1] - b[1]);
  return (address) => {
    let before: [string, number] | undefined;
    for (const entry of names) {
      if (entry[1] > address) break;
      before = entry;
    }
    if (before === undefined || address - before[1] > MAX_LABEL_DISTANCE) return address;
    return (to.get(before[0])! + (address - before[1])) & 0xffff;
  };
}

/** Where each recorded site is in a rebuild (see mover). ROM sites stay where they are. Gives only the sites that move. */
export function siteMap(sites: RecordedSite[], from: Map<string, number>, to: Map<string, number>): Array<[number, number]> {
  const move = mover(from, to);
  const moved: Array<[number, number]> = [];
  for (const pc of new Set(sites.filter((site) => !site.rom).map((site) => parseC64Address(site.site)))) {
    const target = move(pc);
    if (target !== pc) moved.push([pc, target]);
  }
  return moved;
}

/** Power-on and READY, then the program in memory as a LOAD leaves it, and RUN in the keyboard queue. */
async function startProgram(core: C64RunSession, prg: Uint8Array, load: boolean): Promise<CoreStatus> {
  if (prg.length < 3) throw new Refusal("invalid-input", "the program is not a PRG file");
  await core.status(`run ${READY_FRAMES * PAL_FRAME_CYCLES}`);
  const start = prg[0]! | (prg[1]! << 8);
  const end = start + prg.length - 2;
  if (!load && start !== 0x0801) throw new Refusal("invalid-input", `the program loads at ${formatC64Address(start)}, not at $0801 with a BASIC start line: give load true and a registers step that starts it`);
  await core.write(start, prg.subarray(2));
  // The pointers that LOAD sets: the end of the program and of the variables.
  for (const pointer of [0x2d, 0x2f, 0x31, 0xae]) await core.write(pointer, Uint8Array.of(end & 0xff, end >> 8));
  if (!load) {
    await core.write(0x0277, Uint8Array.from([0x52, 0x55, 0x4e, 0x0d]));
    await core.write(0x00c6, Uint8Array.of(4));
  }
  return core.status("status");
}

/** The busiest site that is not ROM code: the point at which an event happens again on a replay. */
function busiestSite(answer: string): { site: number; addr: number; count: number } | undefined {
  let best: { site: number; addr: number; count: number } | undefined;
  for (const entry of answer.split(" ").slice(2)) {
    const match = /^([0-9a-f]{4})\/([0-9a-f]{4}):(\d+):(ram|rom)/.exec(entry);
    if (match === null || match[4] === "rom") continue;
    const count = Number(match[3]);
    if (count > 0 && (best === undefined || count > best.count)) best = { site: Number.parseInt(match[1]!, 16), addr: Number.parseInt(match[2]!, 16), count };
  }
  return best;
}

/**
 * Runs to the point of an event. `map` moves a site to the rebuild. "halted"
 * when a sample stop came first, "not-reached" when the point did not come before `until`.
 */
async function runToKey(core: C64RunSession, key: RecordedEvent["key"], until: number, map: Map<number, number>): Promise<"reached" | "not-reached" | "halted"> {
  if ("previous" in key) return (await core.status("status")).word === "halted" ? "halted" : "reached";
  if ("tick" in key) {
    const status = await core.status(`run ${key.tick}`);
    return status.word === "halted" ? "halted" : "reached";
  }
  const site = parseC64Address(key.site);
  const status = await core.status(`run-reads ${hex(map.get(site) ?? site)} ${hex(parseC64Address(key.addr))} ${key.count} ${until}`);
  return status.word === "halted" ? "halted" : status.word === "reached" ? "reached" : "not-reached";
}

/** Does a step that is not input. Gives a reason when a runUntil does not reach its target. */
/** The status flags in the order of the P register, bit 7 to bit 0; bit 5 is always 1. */
const FLAG_BITS: Record<string, number> = { n: 0x80, v: 0x40, b: 0x10, d: 0x08, i: 0x04, z: 0x02, c: 0x01 };

/** A memory comparison of a memory target. */
const COMPARE: Record<string, (value: number, wanted: number) => boolean> = {
  eq: (value, wanted) => value === wanted,
  ne: (value, wanted) => value !== wanted,
  lt: (value, wanted) => value < wanted,
  lte: (value, wanted) => value <= wanted,
  gt: (value, wanted) => value > wanted,
  gte: (value, wanted) => value >= wanted,
};

async function doAction(core: C64RunSession, step: ActionStep | RestoreAction, at: SideAddresses): Promise<string | undefined> {
  if ("restore" in step) {
    // The NMI line is low while RESTORE is down: hold it as a press step holds a key.
    const tick = (await core.status("status")).tick;
    await core.command("key ff down");
    await core.status("run " + (tick + KEY_FRAMES * PAL_FRAME_CYCLES));
    await core.command("key ff up");
  } else if ("write" in step) {
    await core.write(at.data(step.write.address), Buffer.from(step.write.data, "hex"));
  } else if ("type" in step) {
    // The KERNAL keyboard queue: the keys after the keys that wait there now.
    const keys = keyboardBytes(step.type) as Uint8Array;
    const waiting = (await core.peek(QUEUE_LENGTH, 1))[0]!;
    if (waiting + keys.length > QUEUE_SIZE) return `the KERNAL keyboard queue holds ${waiting} keys, and ${keys.length} more do not fit in its ${QUEUE_SIZE}`;
    await core.write(QUEUE + waiting, keys);
    await core.write(QUEUE_LENGTH, Uint8Array.of(waiting + keys.length));
  } else if ("registers" in step) {
    const now = await core.status("run-sync");
    const { pc, flags } = step.registers;
    let p = now.p;
    for (const [name, set] of Object.entries(flags ?? {})) if (set !== undefined) p = set ? p | FLAG_BITS[name]! : p & ~FLAG_BITS[name]!;
    const values = [step.registers.a ?? now.a, step.registers.x ?? now.x, step.registers.y ?? now.y, step.registers.sp ?? now.s, p].map((n) => n.toString(16));
    await core.status(`regs ${values.join(" ")}`);
    if (pc !== undefined) await core.status(`goto ${hex(at.code(pc))}`);
  } else if ("runUntil" in step) {
    const { target, timeoutFrames } = step.runUntil;
    const start = (await core.status("status")).tick;
    const until = start + timeoutFrames * PAL_FRAME_CYCLES;
    if (target.kind === "memory") {
      for (let tick = start; ; tick += PAL_FRAME_CYCLES) {
        if (COMPARE[target.operator]!((await core.peek(at.data(target.address), 1))[0]!, target.value)) return undefined;
        if (tick >= until) return `${target.address} did not become ${target.operator} ${target.value} within ${timeoutFrames} frames`;
        await core.status(`run ${tick + PAL_FRAME_CYCLES}`);
      }
    }
    if (target.kind !== "address") return "the replay core has no raster target";
    const reached = await core.status(`run-pc ${hex(at.code(target.address))} ${until}`);
    if (reached.word !== "reached") return `the program did not reach ${target.address} within ${timeoutFrames} frames`;
  }
  return undefined;
}

function rangesArgument(state: StateItem[], at: SideAddresses): string {
  return state.map((item) => `${hex(at.data(item.address))}:${item.size}`).join(",");
}

export interface RecordOutcome {
  recording: Recording;
  reads: Uint8Array;
  coverage: Uint8Array;
  /** Why the session did not complete (a runUntil that did not reach its target). */
  reason?: string;
}

/**
 * Plays the steps of a record file in the replay core and records the session.
 * `input` runs after the steps, with `restore` for a RESTORE press of the play;
 * a reason that it gives means no recording.
 */
export async function record(
  core: C64RunSession,
  file: RecordFile,
  workspace: Workspace,
  input?: (core: C64RunSession, restore: () => Promise<string | undefined>) => Promise<string | undefined>,
): Promise<RecordOutcome> {
  const prg = readProjectFile(file.program).bytes;
  const same = (address: number) => address;
  const at = sideAddresses(namesOf(file.symbols), "original", { code: same, data: same });
  // A checkpoint and state of the record file must resolve now, so that a replay can use them.
  if (file.compare !== undefined) {
    at.code(file.compare.checkpoint);
    for (const item of file.compare.state) at.data(item.address);
  }
  const reads = workspace.path(RECORDING_FILES.reads);
  const coverage = workspace.path(RECORDING_FILES.coverage);
  await core.init();
  await core.command(`inputs ${inputsArgument(file.inputs)}`);
  // The coverage starts at the first input read of code in RAM: then the program has done its
  // own start (a loader, a relocation), so the map holds the work of the program.
  await core.command("coverage on-input");
  await core.command(`record ${reads}`);
  await startProgram(core, prg, file.load ?? false);
  const events: RecordedEvent[] = [];
  const masks = [0, 0];
  let reason: string | undefined;
  let afterEvent = false;
  // An event runs after the next read at the busiest program site, here and on each
  // replay. An event right after another event runs where that one ended.
  const runEvent = async (action: ActionStep | RestoreAction, step?: number): Promise<string | undefined> => {
    const tick = (await core.status("status")).tick;
    const busiest = afterEvent ? undefined : busiestSite(await core.command("sites"));
    const key: RecordedEvent["key"] = afterEvent
      ? { previous: true }
      : busiest === undefined
        ? { tick: tick + 1 }
        : { site: formatC64Address(busiest.site), addr: formatC64Address(busiest.addr), count: busiest.count + 1 };
    if ((await runToKey(core, key, tick + 600 * PAL_FRAME_CYCLES, new Map())) !== "reached") return "the program did not read its input again within 600 frames";
    events.push({ ...(step === undefined ? {} : { step }), action, key });
    return doAction(core, action, at);
  };
  for (const [index, step] of file.steps.entries()) {
    let tick = (await core.status("status")).tick;
    const event = !INPUT_KINDS.has(Object.keys(step)[0]!);
    if ("frames" in step) {
      await core.status(`run ${tick + step.frames * PAL_FRAME_CYCLES}`);
    } else if ("joystick" in step) {
      masks[step.joystick.port - 1] = joystickMask(step.joystick.direction, step.joystick.fire ?? false);
      await core.command(`joy ${masks[0]!.toString(16)} ${masks[1]!.toString(16)}`);
    } else if ("press" in step) {
      for (const code of keyCodes(step.press)) {
        await core.command(`key ${code.toString(16)} down`);
        await core.status(`run ${(tick += KEY_FRAMES * PAL_FRAME_CYCLES)}`);
        await core.command(`key ${code.toString(16)} up`);
        await core.status(`run ${(tick += KEY_FRAMES * PAL_FRAME_CYCLES)}`);
      }
    } else {
      reason = await runEvent(step, index + 1);
      if (reason !== undefined) {
        reason = `step ${index + 1}: ${reason}`;
        break;
      }
    }
    afterEvent = event;
  }
  // The play runs frames before each RESTORE: a RESTORE never runs where an event of the steps ended.
  const restore = async () => {
    afterEvent = false;
    const failed = await runEvent({ restore: true });
    return failed === undefined ? undefined : "RESTORE: " + failed;
  };
  if (input !== undefined && reason === undefined) reason = await input(core, restore);
  const end = await core.status("status");
  const sites = (await core.command("sites")).split(" ").slice(2).map((entry): RecordedSite => {
    const [where, reads, kind] = entry.split(":");
    const [site, addr] = where!.split("/");
    return { site: `$${site}`, addr: `$${addr}`, reads: Number(reads), rom: kind === "rom" };
  });
  await core.command("record off");
  await core.command(`coverage ${coverage}`);
  const recording: Recording = {
    format: RECORDING_FORMAT,
    name: file.name,
    program: file.program,
    sha256: createHash("sha256").update(prg).digest("hex"),
    symbols: file.symbols,
    load: file.load ?? false,
    ...(file.compare === undefined ? {} : { compare: file.compare }),
    inputs: file.inputs,
    events,
    sites,
    ticks: end.tick,
    hash: end.hash,
  };
  return { recording, reads: readFileSync(reads), coverage: readFileSync(coverage), ...(reason === undefined ? {} : { reason }) };
}

/** One side of a replay. */
export interface ReplaySubject {
  side: "original" | "rebuild";
  program: string;
  symbols: string;
}

export interface SideRun {
  /** The checkpoint lines: the tick, then the hex of each state item. */
  samples: string[];
  /** The machine at the end of the run. */
  end: CoreStatus;
  /** Why the side stopped before its last checkpoint, if it did. */
  problem?: string;
  /**
   * Input reads that the recording has no value for, which got the fixed idle value:
   * at sites that it does not have, and after its end at a site.
   */
  unknown: number;
  misses: number;
}

/**
 * Replays a recording on one side. The original runs to the end of the
 * session; a rebuild runs until `stop` checkpoints (or REBUILD_TIME_FACTOR
 * times the cycles). With `dump`, it stops at that checkpoint (1 = the first)
 * and gives the RAM there.
 */
export async function replaySide(
  core: C64RunSession,
  recording: Recording,
  folder: string,
  subject: ReplaySubject,
  workspace: Workspace,
  options: { compare?: Comparison; stop?: number; dump?: number; pins?: string[] } = {},
): Promise<SideRun & { ram?: Uint8Array }> {
  const prg = readProjectFile(subject.program).bytes;
  const original = subject.side === "original";
  // The names of the original: a recording without names takes those of the knowledge.
  const names = recording.symbols === "none" ? "knowledge" : recording.symbols;
  const same = (address: number) => address;
  const move = original
    ? { code: same, data: same }
    : { code: mover(namesOf(names, "code"), namesOf(subject.symbols, "code")), data: mover(namesOf(names), namesOf(subject.symbols)) };
  const at = sideAddresses(namesOf(subject.symbols), subject.side, move);
  const moved = original ? [] : siteMap(recording.sites, namesOf(names, "code"), namesOf(subject.symbols, "code"));
  const map = new Map(moved);
  const reads = workspace.path(`${subject.side}-${RECORDING_FILES.reads}`);
  writeFileSync(reads, readProjectFile(`${folder}/${RECORDING_FILES.reads}`).bytes);
  const samples = workspace.path(`${subject.side}-checkpoints.txt`);
  const mapFile = workspace.path(`${subject.side}-sites.map`);
  writeFileSync(mapFile, moved.map(([from, to]) => `${hex(from)} ${hex(to)}\n`).join(""));
  await core.init();
  await core.command(`inputs ${inputsArgument(recording.inputs)}`);
  await core.command(`site-map ${mapFile}`);
  await core.command(`replay ${reads}`);
  if (options.compare !== undefined) {
    const stop = options.dump ?? options.stop ?? 0;
    const pinned = options.compare.pin ?? [];
    if (options.pins !== undefined && pinned.length > 0) {
      // The rebuild: each checkpoint first gets the original's values of the random state.
      const pinFile = workspace.path(`${subject.side}-pins.txt`);
      writeFileSync(pinFile, options.pins.map((line) => `${line}\n`).join(""));
      await core.command(`pin ${pinFile} ${rangesArgument(pinned, at)}`);
    }
    // The samples hold the state, then the pinned items.
    await core.command(`sample ${hex(at.code(options.compare.checkpoint))} ${samples} ${rangesArgument([...options.compare.state, ...pinned], at)}${stop > 0 ? ` ${stop}` : ""}`);
  }
  await startProgram(core, prg, recording.load);
  const limit = original ? recording.ticks : recording.ticks * REBUILD_TIME_FACTOR;
  let problem: string | undefined;
  for (const event of recording.events) {
    const what = event.step === undefined ? "the RESTORE of the play" : "step " + event.step;
    const point = await runToKey(core, event.key, limit, map);
    if (point === "halted") break;
    if (point === "not-reached") {
      problem = "the program did not come to the point of " + what;
      break;
    }
    problem = await doAction(core, event.action, at);
    if (problem !== undefined) {
      problem = what + ": " + problem;
      break;
    }
  }
  const end = problem === undefined ? await core.status(`run ${limit}`) : await core.status("status");
  const sites = await core.command("sites");
  const unknown = Number(/unknown=(\d+)/.exec(sites)?.[1] ?? 0);
  const misses = sites.split(" ").slice(2).reduce((sum, entry) => sum + Number(entry.split(":")[4] ?? 0), 0);
  const ram = options.dump === undefined ? undefined : await core.peek(0, 0x10000);
  let lines: string[] = [];
  if (options.compare !== undefined) {
    await core.command("pin off");
    await core.command("sample off");
    lines = readFileSync(samples, "utf8").split("\n").filter((line) => line !== "");
  }
  return { samples: lines, end, unknown, misses, ...(problem === undefined ? {} : { problem }), ...(ram === undefined ? {} : { ram }) };
}

export interface CheckpointDifference {
  /** 1 = the first checkpoint. */
  checkpoint: number;
  tick: { original: number; rebuild: number };
  items: Array<{ address: Location; original: string; rebuild: string }>;
}

/** The pinned values of each sample line: the fields after the state items. */
export function pinLines(samples: string[], state: StateItem[]): string[] {
  return samples.map((line) => line.split(" ").slice(1 + state.length).join(" "));
}

/**
 * The first checkpoint where two runs differ in the state, or undefined when
 * the first `count` are the same. Fields after the state items (pins) do not count.
 */
export function firstDifference(expected: string[], got: string[], state: StateItem[], count = expected.length): CheckpointDifference | undefined {
  for (let index = 0; index < Math.min(count, expected.length, got.length); index++) {
    const [tickA, ...allA] = expected[index]!.split(" ");
    const [tickB, ...allB] = got[index]!.split(" ");
    const a = allA.slice(0, state.length);
    const b = allB.slice(0, state.length);
    if (a.join(" ") === b.join(" ")) continue;
    const items = state.flatMap((item, at) => (a[at] === b[at] ? [] : [{ address: item.address, original: a[at] ?? "", rebuild: b[at] ?? "" }]));
    return { checkpoint: index + 1, tick: { original: Number(tickA), rebuild: Number(tickB) }, items };
  }
  return undefined;
}

export interface ReplayResult {
  result: Outcome;
  recording: string;
  /** The side that the result is about: the original (the self-check) or the rebuild. */
  side: "original" | "rebuild";
  /** The routine of the checkpoints, and the checkpoints of the original. */
  checkpoint?: Location;
  checkpoints: number;
  /** The checkpoints of the rebuild that were equal. */
  compared: number;
  reason?: string;
  firstDifference?: CheckpointDifference;
  movedSites?: number;
  /** Input reads of the rebuild that the recording had no value for: they got the idle value. */
  idleReads?: number;
  files?: Written[];
}
