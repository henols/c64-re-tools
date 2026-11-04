// Recordings: a session of a program in the replay core (c64run), kept as the
// values that its input reads got (the joystick ports, the keyboard matrix,
// the SID noise) and the state hash at its end. A replay gives the same values
// to the same reads, keyed by the site (the reading instruction) and the read
// index. On the reference it must end with the same hash. On a rebuild it
// compares the state at each entry of one routine (the checkpoints) with the
// reference's. Timing does not key anything, so a rebuild with other timing
// replays the same session. A recording needs no names: the checkpoint and the
// state can be chosen at replay time, with the names that the knowledge has then.

import { readFileSync, writeFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

import { Refusal } from "#src/errors.ts";
import { type AddressRange, c64AddressOf, COVERAGE, formatC64Address, formatC64RangeFields, hexWord, inRanges, parseC64Address, rangesWhere } from "#src/c64.ts";
import { keyTaps, type KeyTap } from "#src/c64-keys.ts";
import { READY_FRAMES } from "#src/host-client/entry-state.ts";
import { ACTION_STEP_KINDS, checkActionStep, keyboardBytes, stepKind, type ActionStep, type Location } from "#src/host-client/steps.ts";
import { isInteger, isObject } from "#src/host-client/tools.ts";
import { readProjectFile, readProjectJson, type Written } from "#src/host-client/transfer.ts";
import { entryMemory, programImage } from "#src/knowledge/program.ts";
import { RECORDING_FILES } from "#src/knowledge/recording-files.ts";
import { LOADER_JUMP, startScreenLabels } from "#src/knowledge/start-screen.ts";
import { sha256 } from "#src/knowledge/text.ts";
import { PAL_FRAME_CYCLES, type C64RunSession, type CoreStatus } from "#src/native/c64run.ts";
import type { Workspace } from "#src/native/staging.ts";
import { listed } from "#src/script.ts";
import { namesOf, type Outcome } from "./scenario.ts";

const RECORDING_FORMAT = 1;
/**
 * CIA 1 ports A and B (joystick 2, joystick 1 and the keyboard matrix); the
 * four SID registers that a program can read: the paddles ($D419, $D41A) and
 * voice 3 (the noise output $D41B and its envelope $D41C), which programs use as
 * random seeds; and I/O 1 and I/O 2 ($DE00-$DFFF), where a C64 without a
 * cartridge gives the last byte on the bus.
 */
const DEFAULT_INPUTS = ["$dc00", "$dc01", "$d419", "$d41a", "$d41b", "$d41c", "$de00-$dfff"];

/** The inputs argument of the replay core: hex addresses and ranges without $. */
function inputsArgument(inputs: string[]): string {
  return inputs.map((input) => input.replace(/\$/g, "")).join(",");
}
/** Frames that a pressed key is held, and then released. */
const KEY_FRAMES = 3;
const MAX_STATE_ITEMS = 16;
/** The replay core counts the opcode fetches at this many addresses at most: the targets of the runUntil steps to an address. */
const MAX_COUNTED_TARGETS = 64;
/** An event other than a runUntil to an address waits this long for the next input read. */
const READ_WAIT_FRAMES = 600;
const MAX_STATE_BYTES = 4096;
/** A replay of a rebuild may take this many times the cycles of the recording before it stops. */
const REBUILD_TIME_FACTOR = 2;

export interface StateItem {
  address: Location;
  size: number;
}

/** The input of testing.ts record. */
export interface RecordFile {
  name: string;
  program: string;
  /** "knowledge", "none", or a project JSON file (the symbol file of a build or a name → "$xxxx" map). */
  symbols: string;
  /** true: load the program with the CPU at READY and no RUN; a registers step starts it. */
  load: boolean;
  /** The comparison that a replay uses when it gets none: the checkpoint routine and the state. */
  compare?: Comparison;
  inputs: string[];
  /** Where the coverage map starts: "input", "start", or a "$xxxx" address (see COVERAGE_COMMANDS). */
  coverage: string;
  steps: ActionStep[];
}

/**
 * The commands of the replay core that start the coverage map. "input": at the
 * first input read of code in RAM, after a loader or a relocation. "start":
 * when the program starts, with RUN (or the registers step of load true). An
 * address: at the first execution of that address.
 */
const COVERAGE_COMMANDS = new Map([
  ["input", "coverage on-input"],
  ["start", "coverage on"],
]);

/**
 * What a replay compares: the state at each entry of a routine, for example the
 * main loop of a game. `pin` is random state in RAM (a seed, a pointer into a
 * random table): at each checkpoint the rebuild gets the reference's values there.
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
   * has { previous: true }: it runs where that one ended. A runUntil to an
   * address has { pc, count }: the count-th opcode fetch at its target from the
   * start, which needs no read; the event is done when the point is reached.
   */
  key: { site: Location; addr: Location; count: number } | { tick: number } | { previous: true } | { pc: Location; count: number };
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
  /**
   * The cycles of the input (see trackInput): keys down, a joystick that is not centered, typed keys in the queue,
   * and each press step to the end of its frames. None without input.
   */
  input?: TickSpan[];
}

/** The cycles from `from` up to `to`. `typed`: the keys of a type step, which are input only while the KERNAL queue holds keys. */
export interface TickSpan {
  from: number;
  to: number;
  typed?: true;
}

/** Steps that are input or time: the replay gives the program the reads that they caused, and does not do them again. */
const INPUT_KINDS = new Set(["joystick", "press", "frames"]);
/** The KERNAL keyboard queue: $0277, its length in $c6, at most 10 keys. */
const QUEUE = 0x0277;
const QUEUE_LENGTH = 0x00c6;
const QUEUE_SIZE = 10;

/** The key code of the replay core for a matrix place: 80 + the place. */
const coreKey = (place: number) => 0x80 + place;
/** The key code of RESTORE in the replay core. */
const RESTORE_KEY = 0xff;

/** The joystick mask of the replay core: 1 up, 2 down, 4 left, 8 right, $10 fire. */
export function joystickMask(direction: Extract<ActionStep, { joystick: unknown }>["joystick"]["direction"], fire: boolean): number {
  const bits: Record<string, number> = { up: 1, down: 2, left: 4, right: 8 };
  return direction.split("-").reduce((mask, part) => mask | (bits[part] ?? 0), fire ? 0x10 : 0);
}

/** A state item of the command line: a name or a $ address, with :size for more than one byte. `option` names the option of the item in a refusal. */
export function parseStateItem(text: string, option = "--state"): StateItem {
  const match = /^([^:]+)(?::(\d+))?$/.exec(text);
  const size = Number(match?.[2] ?? 1);
  if (match === null || !isInteger(size, 1, MAX_STATE_BYTES)) throw new Refusal("invalid-input", `${option} ${text}: give a name or a $ address, with :size from 1 to ${MAX_STATE_BYTES}`);
  return { address: match[1]!, size };
}

/** Checks the memory items of state or pin (`what`): names, $ addresses, or { address, size }. */
function checkState(value: unknown, fail: (message: string) => never, what = "state"): StateItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_STATE_ITEMS) fail(`${what} must be a list of 1 to ${MAX_STATE_ITEMS} memory items`);
  return (value as unknown[]).map((item, index) => {
    const spec = typeof item === "string" ? { address: item } : item;
    if (isObject(spec)) {
      for (const key of Object.keys(spec)) if (key !== "address" && key !== "size") fail(`${what} item ${index + 1} has the field ${key}. A memory item has address and size, and nothing else`);
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
  const value = readProjectJson(path, (message) => `record file ${path}: ${message}`);
  if (!isObject(value)) return fail("it must be a JSON object");
  const known = ["name", "program", "symbols", "load", "checkpoint", "state", "pin", "inputs", "coverage", "steps"];
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
  const coverage = value.coverage ?? "input";
  if (typeof coverage !== "string" || (!COVERAGE_COMMANDS.has(coverage) && c64AddressOf(coverage) === undefined)) {
    fail(`coverage must be "input" (default), "start" or a $ address such as "$1aed", not ${JSON.stringify(coverage)}`);
  }
  if (!Array.isArray(value.steps) || value.steps.length === 0) fail("steps must be a list with at least one step");
  const steps = (value.steps as unknown[]).map((raw, index) => {
    const at = `step ${index + 1}`;
    const step = checkActionStep(stepKind(raw, ACTION_STEP_KINDS, at, fail), raw as Record<string, unknown>, at, fail);
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
    coverage: coverage as string,
    steps,
  };
}

/** The target of a runUntil step to an address, as a list of none or one. */
function addressTarget(step: ActionStep | RestoreAction): Location[] {
  return "runUntil" in step && step.runUntil.target.kind === "address" ? [step.runUntil.target.address] : [];
}

/** Starts the counts of the replay core at the addresses. */
async function countAt(core: C64RunSession, addresses: number[]): Promise<void> {
  const unique = [...new Set(addresses)];
  if (unique.length > 0) await core.command(`count-pc ${unique.map(hexWord).join(",")}`);
}

/** What the replay core cannot do of a step that is right for VICE: it has the C64 alone, no raster wait and no conditions. */
function checkCoreStep(step: ActionStep, at: string, fail: (message: string) => never): void {
  if ("write" in step && step.write.space !== "c64") fail(`${at}: a recording has the C64 alone, not ${step.write.space}`);
  if ("type" in step) {
    const keys = keyboardBytes(step.type);
    if (typeof keys !== "string" && keys.length > QUEUE_SIZE) fail(`${at}: the KERNAL keyboard queue holds ${QUEUE_SIZE} keys; give more type steps, or press for keys of the keyboard matrix`);
  }
  if ("runUntil" in step) {
    const { target } = step.runUntil;
    if (target.kind === "raster") fail(`${at}: a recording has no raster target. Use an address or a memory target`);
    else if (target.space !== "c64") fail(`${at}: a recording has the C64 alone, not ${target.space}`);
    else if (target.kind === "address" && target.condition !== undefined) fail(`${at}: a recording has no condition at an address target`);
  }
}

/** Reads and checks recording.json of a recording folder. */
export function readRecording(folder: string): Recording {
  const path = `${folder}/${RECORDING_FILES.recording}`;
  const value = readProjectJson(path, (message) => `recording ${path}: ${message}`);
  const fail = (message: string): never => {
    throw new Refusal("invalid-input", `recording ${path}: ${message}`);
  };
  if (!isObject(value) || value.format !== RECORDING_FORMAT) return fail(`it is not a recording of format ${RECORDING_FORMAT}`);
  for (const key of ["name", "program", "sha256", "symbols", "hash"]) if (typeof value[key] !== "string") fail(`${key} is missing`);
  for (const key of ["inputs", "events", "sites"]) if (!Array.isArray(value[key])) fail(`${key} is missing`);
  if (!isInteger(value.ticks, 1, Number.MAX_SAFE_INTEGER)) fail("ticks is missing");
  // A recording that does not check is refused, never replayed wrong.
  const remedy = "Record the session again with record";
  if (value.compare !== undefined) {
    const compare = isObject(value.compare) ? value.compare : fail("compare must be an object with checkpoint, state and pin");
    const where = (message: string): never => fail(`compare: ${message}. ${remedy}`);
    if (typeof compare.checkpoint !== "string" || compare.checkpoint === "") where("checkpoint must be the name or $ address of a routine");
    checkState(compare.state, where);
    if (compare.pin !== undefined) checkState(compare.pin, where, "pin");
  }
  if (value.input !== undefined && (!Array.isArray(value.input) || !value.input.every((span) => isObject(span) && isInteger(span.from, 0, Number.MAX_SAFE_INTEGER) && isInteger(span.to, 0, Number.MAX_SAFE_INTEGER) && (span.typed === undefined || span.typed === true)))) {
    fail(`input must be a list of { from, to } cycles. ${remedy}`);
  }
  (value.events as unknown[]).forEach((event, index) => {
    const at = `event ${index + 1}`;
    const where = (message: string): never => fail(`${message}. ${remedy}`);
    if (!isObject(event) || !isObject(event.action) || !isObject(event.key)) return where(`${at} must be an object with action and key`);
    const named = typeof event.step === "number" ? `${at} (step ${event.step})` : at;
    if (event.action.restore === true && Object.keys(event.action).length === 1) return;
    // The action with the defaults filled in, as the record file gave it.
    const action = checkActionStep(stepKind(event.action, ACTION_STEP_KINDS, named, where), event.action, named, where);
    event.action = action;
  });
  return value as unknown as Recording;
}

/**
 * The addresses of one side. A name comes from the symbols of the side. A $
 * address is an address of the reference: on the rebuild it moves with the
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
 * Moves an address of the reference to the rebuild: the name before it in the
 * reference, plus the same offset from that name in the rebuild. An address
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

/** Pages 0-3 of RAM and the stack pointer of a program at its entry. */
export interface EntryRam {
  sp: number;
  /** $0000-$03ff. */
  ram: Uint8Array;
}

/** Where the reference came to the entry that the loader of a rebuild jumps to. */
export interface EntryPoint extends EntryRam {
  /** The tick of the first opcode fetch at the entry. */
  tick: number;
  /**
   * The phase of the machine at that fetch, as the replay core gives it: the beam position, the CIA timers and
   * the interrupt state. It depends on how the program started, so the rebuild gets it at its own entry.
   */
  phase: string;
  /** The count of each pc key, by its target, before that fetch. */
  counts: Map<string, number>;
  /** The number of events of the recording before the entry: always the first ones. */
  eventsBefore: number;
  /** The number of checkpoints before the entry, which the samples of the reference leave out. */
  samplesBefore: number;
}

/**
 * The mark of the replay core at the first opcode fetch at an entry. Give it after count-pc, which clears it. `after`
 * comes after the point of each event, before its action: the events before the mark came are the first ones.
 */
async function markEntry(core: C64RunSession, entry: number) {
  await core.command(`mark ${hexWord(entry)}`);
  const marked = async () => {
    const answer = /tick=(\d+) phase=([0-9a-f]+)/.exec(await core.command("marked"));
    return answer === null ? undefined : { tick: Number(answer[1]), phase: answer[2]! };
  };
  /** Pages 0-3 and the stack pointer at the mark, which came. */
  const memory = async (): Promise<EntryRam> => {
    const answer = /s=([0-9a-f]{2}) ram=([0-9a-f]{2048})/.exec(await core.command("marked-ram"));
    if (answer === null) throw new Refusal("operation-failed", "c64run marked-ram gave no memory at the mark");
    return { sp: Number.parseInt(answer[1]!, 16), ram: Uint8Array.from(Buffer.from(answer[2]!, "hex")) };
  };
  let came: { tick: number; phase: string } | undefined;
  let eventsBefore = 0;
  return {
    /** After the point of event `index` (0 is the first). */
    async after(index: number): Promise<void> {
      if (came !== undefined) return;
      came = await marked();
      if (came === undefined) eventsBefore = index + 1;
    },
    /** Where the program came to the entry, with its memory there, or undefined when it did not come to it. */
    async end(): Promise<({ tick: number; phase: string; eventsBefore: number } & EntryRam) | undefined> {
      came ??= await marked();
      return came === undefined ? undefined : { ...came, eventsBefore, ...(await memory()) };
    },
  };
}

/**
 * Why a rebuild with a loader cannot replay the events: the first of the events before the entry that is no runUntil
 * to an address. A rebuild with a loader runs its loader there, so the event has no point in it.
 */
export function eventBeforeEntry(events: readonly RecordedEvent[], eventsBefore: number, entry: number): string | undefined {
  const early = events.slice(0, eventsBefore).find((event) => !("pc" in event.key));
  if (early === undefined) return undefined;
  const what = early.step === undefined ? "the RESTORE of the play" : `step ${early.step}`;
  return `${what} ran before the program came to its entry ${formatC64Address(entry)}. A rebuild with a loader has no point for it. Make the steps of the record file start after the entry`;
}

/** The memory that the loader of a rebuild writes at an entry: $0002-$03ff of the program of the knowledge at its entry, and its stack pointer. */
export interface LoaderEntryState {
  sp: number;
  /** The parts of $0002-$03ff that the loader writes. */
  written: AddressRange[];
  byteAt: (address: number) => number;
}

/** Pages 0-3 without the CPU port: the memory of the entry state check. */
const LOW_PAGES: AddressRange = { start: 0x0002, end: 0x03ff };

/**
 * The entry state of the knowledge at `entry`, as the loader of a rebuild writes it ($0002-$03ff: the segments there,
 * and the pages that the entry state has). Undefined when the knowledge has no entry state, one at another entry, one
 * without a stack pointer, or when the loader writes nothing of $0002-$03ff.
 */
export function loaderEntryState(db: DatabaseSync | undefined, entry: number): LoaderEntryState | undefined {
  const image = programImage(db);
  if (image?.state === undefined || image.entry !== entry) return undefined;
  const sp = isObject(image.state.registers) ? image.state.registers.sp : undefined;
  if (!isInteger(sp, 0, 0xff)) return undefined;
  const memory = entryMemory(image);
  const written = memory.segments.flatMap((segment) => (segment.end < LOW_PAGES.start || segment.start > LOW_PAGES.end ? [] : [{ start: Math.max(segment.start, LOW_PAGES.start), end: Math.min(segment.end, LOW_PAGES.end) }]));
  return written.length === 0 ? undefined : { sp, written, byteAt: memory.byteAt };
}

/**
 * The bytes that the entry state check does not compare: the bytes of the KERNAL that its interrupt and its screen
 * editor change by time alone, and the bytes that the start of the program sets in another way in the emulator of a
 * capture than in the replay core. These bytes differ also with the same input, and no new capture makes them the
 * same. The bytes of the keyboard scan ($91, $c5, $cb, $f5/$f6, $028b/$028c) change with the input, and the check
 * compares them.
 */
const UNCOMPARED_BYTES: readonly AddressRange[] = [
  // The jiffy clock: each interrupt counts it up.
  { start: 0x00a0, end: 0x00a2 },
  // The load of the emulator sets them to the start of the BASIC text; the start of the replay core puts the program into RAM without them.
  { start: 0x00ac, end: 0x00ad },
  // $cd: the interrupts to the next blink of the cursor. $ce: the character under the cursor at the last blink.
  // $cf: the blink phase. A key that the editor takes ends the blink at the phase that the time gave.
  { start: 0x00cd, end: 0x00cf },
  // The colour under the cursor at the last blink.
  { start: 0x0287, end: 0x0287 },
];

/**
 * Where a program at its entry differs from the entry state that the loader of a rebuild writes: the ranges of $0002-$03ff
 * with other bytes. The free part of the stack page, from $0100 up to the stack pointer of either state, holds no state,
 * and the bytes of UNCOMPARED_BYTES are not compared.
 */
export function entryStateDiffers(program: EntryRam, loader: LoaderEntryState): AddressRange[] {
  const free = 0x0100 + Math.max(program.sp, loader.sp);
  const compared = (address: number) => inRanges(loader.written, address) && (address < 0x0100 || address > free) && !inRanges(UNCOMPARED_BYTES, address);
  return rangesWhere((address) => compared(address) && program.ram[address] !== loader.byteAt(address));
}

/**
 * The spans of the input of a session: from the input that starts while no input is held to the end of the last one.
 * Input is a key down (a press step, the play, RESTORE) and a joystick that is not centered (a joystick step, the
 * play): the key() and joy() of the core report each one with its tick. `typed` starts a typed span for the keys of a
 * type step, and `settle` ends it when the KERNAL queue is empty; it can end late, so the queue at the entry decides
 * (entryStateCheck). `cover` makes the key spans from `from` on one span up to `to`, for the frames of a step. `spans`
 * closes a span that is still open at `end`, and ends the tracking.
 */
export function trackInput(core: Pick<C64RunSession, "onInput" | "peek" | "status">): {
  typed: (tick: number) => void;
  settle: () => Promise<void>;
  cover: (from: number, to: number) => void;
  spans: (end: number) => TickSpan[];
} {
  const down = new Set<number>();
  let joystick = false;
  const spans: TickSpan[] = [];
  const typedSpans: TickSpan[] = [];
  let typedFrom: number | undefined;
  let since: number | undefined;
  const held = () => down.size > 0 || joystick;
  const change = (tick: number, update: () => void) => {
    const before = held();
    update();
    if (!before && held()) since = tick;
    else if (before && !held()) {
      spans.push({ from: since!, to: tick });
      since = undefined;
    }
  };
  core.onInput((input, tick) =>
    change(tick, () => {
      if (input.kind === "joy") joystick = input.masks.some((mask) => mask !== 0);
      else if (input.down) down.add(input.code);
      else down.delete(input.code);
    }),
  );
  const settle = async () => {
    if (typedFrom === undefined || (await core.peek(QUEUE_LENGTH, 1))[0] !== 0) return;
    typedSpans.push({ from: typedFrom, to: (await core.status("status")).tick, typed: true });
    typedFrom = undefined;
  };
  const cover = (from: number, to: number) => {
    const first = spans.findIndex((span) => span.from >= from);
    if (since === undefined && first >= 0) spans.splice(first, spans.length - first, { from, to: Math.max(to, spans.at(-1)!.to) });
  };
  const end = (at: number) => {
    core.onInput(undefined);
    const open = [...(since === undefined ? [] : [{ from: since, to: at }]), ...(typedFrom === undefined ? [] : [{ from: typedFrom, to: at, typed: true as const }])];
    return [...spans, ...typedSpans, ...open].sort((a, b) => a.from - b.from);
  };
  return { typed: (tick) => (typedFrom ??= tick), settle, cover, spans: end };
}

/** The note in place of the entry state check when the program came to its entry during the input. */
export const ENTRY_DURING_INPUT = "not compared: the program came to its entry during the input of the session";

/**
 * The entry state check of a program at its entry (`tick`) against the entry state that the loader writes: the
 * differing ranges, or nothing when all bytes are the same. A capture stops at the first arrival after its steps, so
 * at an entry during the input (`input`) it holds a later state, which no new capture changes: then only the note.
 * A typed span counts only when the KERNAL queue at the entry still holds keys.
 */
export function entryStateCheck(program: EntryRam & { tick: number }, input: readonly TickSpan[], loader: LoaderEntryState): { entryStateDiffers?: Array<{ start: string; end: string }>; entryState?: string } {
  const during = (span: TickSpan) => program.tick >= span.from && program.tick < span.to && (span.typed !== true || program.ram[QUEUE_LENGTH] !== 0);
  if (input.some(during)) return { entryState: ENTRY_DURING_INPUT };
  const differs = entryStateDiffers(program, loader);
  return differs.length === 0 ? {} : { entryStateDiffers: differs.map(formatC64RangeFields) };
}

/**
 * A loader with a start screen that RUN starts waits for a key or a fire button that the recording does not have:
 * the rebuild goes on after the wait, as the check of the loader does. Gives the tick of the wait, a problem, or
 * undefined when the rebuild has no start screen.
 */
async function passStartScreen(core: C64RunSession, own: Map<string, number>, limit: number): Promise<number | string | undefined> {
  const labels = startScreenLabels(own);
  if (labels === undefined) return undefined;
  const reached = await core.status(`run-pc ${hexWord(labels.wait)} ${limit}`);
  if (reached.word !== "reached") return `the rebuild did not come to the wait of its start screen at ${formatC64Address(labels.wait)}`;
  await core.status(`goto ${hexWord(labels.continue)}`);
  return reached.tick;
}

/**
 * The entry that the generated loader of a rebuild jumps to: the operand of its jump, from a short run of the
 * rebuild. Gives a problem when the rebuild does not come to the jump.
 */
export async function loaderEntry(core: C64RunSession, recording: Recording, subject: ReplaySubject, names: typeof namesOf): Promise<number | string> {
  const own = names(subject.symbols);
  const jump = own.get(LOADER_JUMP)!;
  const limit = recording.ticks * REBUILD_TIME_FACTOR;
  await core.init();
  await startProgram(core, readProjectFile(subject.program).bytes, false);
  const screen = await passStartScreen(core, own, limit);
  if (typeof screen === "string") return screen;
  if ((await core.status(`run-pc ${hexWord(jump)} ${limit}`)).word !== "reached") return `the rebuild did not come to the jump of its loader at ${formatC64Address(jump)}`;
  const operand = await core.peek((jump + 1) & 0xffff, 2);
  return operand[0]! | (operand[1]! << 8);
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
async function runToKey(core: C64RunSession, key: RecordedEvent["key"], until: number, map: Map<number, number>, skipped: number, at: SideAddresses): Promise<"reached" | "not-reached" | "halted"> {
  if ("previous" in key) return (await core.status("status")).word === "halted" ? "halted" : "reached";
  if ("pc" in key) {
    const status = await core.status(`run-pc ${hexWord(at.code(key.pc))} ${until} ${key.count}`);
    return status.word === "halted" ? "halted" : status.word === "reached" ? "reached" : "not-reached";
  }
  if ("tick" in key) {
    const status = await core.status(`run ${key.tick + skipped}`);
    return status.word === "halted" ? "halted" : "reached";
  }
  const site = parseC64Address(key.site);
  const status = await core.status(`run-reads ${hexWord(map.get(site) ?? site)} ${hexWord(parseC64Address(key.addr))} ${key.count} ${until}`);
  return status.word === "halted" ? "halted" : status.word === "reached" ? "reached" : "not-reached";
}

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

/** Does a step that is not input. Gives a reason when a runUntil does not reach its target. */
async function doAction(core: C64RunSession, step: ActionStep | RestoreAction, at: SideAddresses): Promise<string | undefined> {
  if ("restore" in step) {
    // The NMI line is low while RESTORE is down: hold it as a press step holds a key.
    const tick = (await core.status("status")).tick;
    await core.key(RESTORE_KEY, true);
    await core.status("run " + (tick + KEY_FRAMES * PAL_FRAME_CYCLES));
    await core.key(RESTORE_KEY, false);
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
    if (pc !== undefined) await core.status(`goto ${hexWord(at.code(pc))}`);
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
    if (target.kind !== "address") return "a recording has no raster target";
    const reached = await core.status(`run-pc ${hexWord(at.code(target.address))} ${until}`);
    if (reached.word !== "reached") return `the program did not reach ${target.address} within ${timeoutFrames} frames`;
  }
  return undefined;
}

function rangesArgument(state: StateItem[], at: SideAddresses): string {
  return state.map((item) => `${hexWord(at.data(item.address))}:${item.size}`).join(",");
}

export interface RecordOutcome {
  recording: Recording;
  reads: Uint8Array;
  coverage: Uint8Array;
  /** The cycle and the instruction at which the coverage map started; none when it never started. */
  coverageFrom?: { tick: number; pc: number };
  /** Why the session did not complete (a runUntil that did not reach its target). */
  reason?: string;
  /** With an entry: why a rebuild with a loader cannot replay the recording, as replay finds it on the reference. */
  loaderProblem?: string;
  /** With an entry that the program came to: its pages 0-3 and its stack pointer there, and the cycle of its arrival. */
  entryRam?: EntryRam & { tick: number };
}

/**
 * Plays the steps of a record file in the replay core and records the session.
 * `input` runs after the steps, with `restore` for a RESTORE press of the play;
 * a reason that it gives means no recording. With `entry`, the entry of the
 * program where the loader of a rebuild jumps to, the outcome tells when the
 * program did not come to it, or which event ran before it came to it, as
 * replay finds it on the reference.
 */
export async function record(
  core: C64RunSession,
  file: RecordFile,
  workspace: Workspace,
  input?: (core: C64RunSession, restore: () => Promise<string | undefined>) => Promise<string | undefined>,
  entry?: number,
): Promise<RecordOutcome> {
  try {
    return await recordSession(core, file, workspace, input, entry);
  } finally {
    // The input listener of the session ends with the record, also when the record fails.
    core.onInput(undefined);
  }
}

async function recordSession(
  core: C64RunSession,
  file: RecordFile,
  workspace: Workspace,
  input: Parameters<typeof record>[3],
  entry: number | undefined,
): Promise<RecordOutcome> {
  // Every key and joystick goes through key() and joy() of the core: the steps, the play and a RESTORE.
  const tracked = trackInput(core);
  const prg = readProjectFile(file.program).bytes;
  const same = (address: number) => address;
  const at = sideAddresses(namesOf(file.symbols), "reference", { code: same, data: same });
  // A checkpoint and state of the record file must resolve now, so that a replay can use them.
  if (file.compare !== undefined) {
    at.code(file.compare.checkpoint);
    for (const item of file.compare.state) at.data(item.address);
  }
  // Two names can give one address: the replay core counts each address once.
  const targets = [...new Set(file.steps.flatMap(addressTarget).map(at.code))];
  if (targets.length > MAX_COUNTED_TARGETS) throw new Refusal("invalid-input", `record file of ${file.name}: the runUntil steps go to more than ${MAX_COUNTED_TARGETS} addresses`);
  const reads = workspace.path(RECORDING_FILES.reads);
  const coverage = workspace.path(RECORDING_FILES.coverage);
  await core.init();
  await core.command(`inputs ${inputsArgument(file.inputs)}`);
  await core.command(`record ${reads}`);
  await countAt(core, targets);
  const mark = entry === undefined ? undefined : await markEntry(core, entry);
  await startProgram(core, prg, file.load);
  // From READY on: the start of the C64 itself is never in the map.
  await core.command(COVERAGE_COMMANDS.get(file.coverage) ?? `coverage on-pc ${hexWord(parseC64Address(file.coverage))}`);
  const events: RecordedEvent[] = [];
  const masks = [0, 0];
  let reason: string | undefined;
  let afterEvent = false;
  // An event runs after the next read at the busiest program site, here and on each
  // replay. An event right after another event runs where that one ended.
  const runEvent = async (action: ActionStep | RestoreAction, step?: number): Promise<string | undefined> => {
    const tick = (await core.status("status")).tick;
    if ("runUntil" in action && action.runUntil.target.kind === "address") {
      // The next opcode fetch at the target: its count from the start is the point, on each replay.
      const { address } = action.runUntil.target;
      const pc = hexWord(at.code(address));
      const count = Number(/count=(\d+)/.exec(await core.command(`hits ${pc}`))![1]) + 1;
      const reached = await core.status(`run-pc ${pc} ${tick + action.runUntil.timeoutFrames * PAL_FRAME_CYCLES} ${count}`);
      if (reached.word !== "reached") return `the program did not reach ${address} within ${action.runUntil.timeoutFrames} frames`;
      events.push({ ...(step === undefined ? {} : { step }), action, key: { pc: address, count } });
      await mark?.after(events.length - 1);
      return undefined;
    }
    const busiest = afterEvent ? undefined : busiestSite(await core.command("sites"));
    const key: RecordedEvent["key"] = afterEvent
      ? { previous: true }
      : busiest === undefined
        ? { tick: tick + 1 }
        : { site: formatC64Address(busiest.site), addr: formatC64Address(busiest.addr), count: busiest.count + 1 };
    if ((await runToKey(core, key, tick + READ_WAIT_FRAMES * PAL_FRAME_CYCLES, new Map(), 0, at)) !== "reached") {
      return `the program did not read its input again within ${READ_WAIT_FRAMES} frames. This step runs at the next input read. Put a runUntil step to an address before it: that step needs no input read`;
    }
    events.push({ ...(step === undefined ? {} : { step }), action, key });
    await mark?.after(events.length - 1);
    return doAction(core, action, at);
  };
  for (const [index, step] of file.steps.entries()) {
    let tick = (await core.status("status")).tick;
    const event = !INPUT_KINDS.has(Object.keys(step)[0]!);
    if ("frames" in step) {
      await core.status(`run ${tick + step.frames * PAL_FRAME_CYCLES}`);
    } else if ("joystick" in step) {
      masks[step.joystick.port - 1] = joystickMask(step.joystick.direction, step.joystick.fire ?? false);
      await core.joy(masks[0]!, masks[1]!);
    } else if ("press" in step) {
      const hold = step.press.frames * PAL_FRAME_CYCLES;
      const start = tick;
      for (const tap of keyTaps(step.press.keys) as KeyTap[]) {
        for (const place of tap.keys) await core.key(coreKey(place), true);
        // RESTORE is no read: an event at the next read of the program, with the keys of the tap down.
        if (tap.restore) reason = await runEvent({ restore: true }, index + 1);
        if (reason !== undefined) break;
        tick = (await core.status("status")).tick;
        await core.status(`run ${(tick += hold)}`);
        for (const place of tap.keys) await core.key(coreKey(place), false);
        await core.status(`run ${(tick += hold)}`);
        // Frames ran: the next RESTORE is no event right after an event.
        afterEvent = false;
      }
      // A press step is key input to the end of its frames, as the steps of a capture end there.
      tracked.cover(start, (await core.status("status")).tick);
      if (reason !== undefined) {
        reason = `step ${index + 1}: RESTORE: ${reason}`;
        break;
      }
    } else {
      reason = await runEvent(step, index + 1);
      // The keys of a type step are input from the start of the step until the KERNAL took them from its queue.
      if ("type" in step && reason === undefined) tracked.typed(tick);
      if (reason !== undefined) {
        reason = `step ${index + 1}: ${reason}`;
        break;
      }
    }
    await tracked.settle();
    afterEvent = event;
  }
  // The play runs frames before each RESTORE: a RESTORE never runs where an event of the steps ended.
  const restore = async () => {
    afterEvent = false;
    const failed = await runEvent({ restore: true });
    return failed === undefined ? undefined : "RESTORE: " + failed;
  };
  if (input !== undefined && reason === undefined) reason = await input(core, restore);
  const came = await mark?.end();
  const loaderProblem =
    entry === undefined
      ? undefined
      : came === undefined
        ? `the program did not come to its entry ${formatC64Address(entry)} in the session, where the loader of a rebuild jumps. Make the session go on until the program runs from its entry`
        : eventBeforeEntry(events, came.eventsBefore, entry);
  const end = await core.status("status");
  await tracked.settle();
  const spans = tracked.spans(end.tick);
  const sites = (await core.command("sites")).split(" ").slice(2).map((entry): RecordedSite => {
    const [where, reads, kind] = entry.split(":");
    const [site, addr] = where!.split("/");
    return { site: `$${site}`, addr: `$${addr}`, reads: Number(reads), rom: kind === "rom" };
  });
  await core.command("record off");
  const from = /from tick=(\d+) pc=([0-9a-f]{4})/.exec(await core.command("coverage status"));
  await core.command(`coverage ${coverage}`);
  const recording: Recording = {
    format: RECORDING_FORMAT,
    name: file.name,
    program: file.program,
    sha256: sha256(prg),
    symbols: file.symbols,
    load: file.load,
    ...(file.compare === undefined ? {} : { compare: file.compare }),
    inputs: file.inputs,
    events,
    sites,
    ticks: end.tick,
    hash: end.hash,
    ...(spans.length === 0 ? {} : { input: spans }),
  };
  return {
    recording,
    reads: readFileSync(reads),
    coverage: readFileSync(coverage),
    ...(from === null ? {} : { coverageFrom: { tick: Number(from[1]), pc: Number.parseInt(from[2]!, 16) } }),
    ...(reason === undefined ? {} : { reason }),
    ...(loaderProblem === undefined ? {} : { loaderProblem }),
    ...(came === undefined ? {} : { entryRam: { sp: came.sp, ram: came.ram, tick: came.tick } }),
  };
}

/** One side of a replay. */
export interface ReplaySubject {
  side: "reference" | "rebuild";
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
  /** True when the rebuild went on after the wait of its start screen. */
  startScreenSkipped?: boolean;
  /** The rebuild with a `handover`: its pages 0-3 and its stack pointer at its entry, as its loader left them. */
  entryRam?: EntryRam;
  /** The reference with an `entry`: where it came to that entry, when it came to it. */
  entryPoint?: EntryPoint;
  /**
   * Input reads that the recording has no value for, which got the fixed idle value:
   * at sites that it does not have, and after its end at a site.
   */
  unknown: number;
  misses: number;
}

/**
 * Replays a recording on one side. The reference runs to the end of the
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
  names: typeof namesOf,
  options: { compare?: Comparison; stop?: number; dump?: number; pins?: string[]; entry?: number; handover?: { entry: number; reference: EntryPoint } } = {},
): Promise<SideRun & { ram?: Uint8Array }> {
  const prg = readProjectFile(subject.program).bytes;
  const reference = subject.side === "reference";
  // The names of the reference: a recording without names takes those of the knowledge.
  const referenceSymbols = recording.symbols === "none" ? "knowledge" : recording.symbols;
  const same = (address: number) => address;
  const move = reference
    ? { code: same, data: same }
    : { code: mover(names(referenceSymbols, "code"), names(subject.symbols, "code")), data: mover(names(referenceSymbols), names(subject.symbols)) };
  const own = names(subject.symbols);
  const at = sideAddresses(own, subject.side, move);
  const moved = reference ? [] : siteMap(recording.sites, names(referenceSymbols, "code"), names(subject.symbols, "code"));
  const map = new Map(moved);
  const reads = workspace.path(`${subject.side}-${RECORDING_FILES.reads}`);
  writeFileSync(reads, readProjectFile(`${folder}/${RECORDING_FILES.reads}`).bytes);
  const samples = workspace.path(`${subject.side}-checkpoints.txt`);
  const mapFile = workspace.path(`${subject.side}-sites.map`);
  writeFileSync(mapFile, moved.map(([from, to]) => `${hexWord(from)} ${hexWord(to)}\n`).join(""));
  await core.init();
  await core.command(`inputs ${inputsArgument(recording.inputs)}`);
  await core.command(`site-map ${mapFile}`);
  await core.command(`replay ${reads}`);
  let sampling = false;
  const startSampling = async (compare: Comparison) => {
    const stop = options.dump ?? options.stop ?? 0;
    const pinned = compare.pin ?? [];
    if (options.pins !== undefined && pinned.length > 0) {
      // The rebuild: each checkpoint first gets the reference's values of the random state.
      const pinFile = workspace.path(`${subject.side}-pins.txt`);
      writeFileSync(pinFile, options.pins.map((line) => `${line}\n`).join(""));
      await core.command(`pin ${pinFile} ${rangesArgument(pinned, at)}`);
    }
    // The samples hold the state, then the pinned items.
    await core.command(`sample ${hexWord(at.code(compare.checkpoint))} ${samples} ${rangesArgument([...compare.state, ...pinned], at)}${stop > 0 ? ` ${stop}` : ""}`);
    sampling = true;
  };
  // A rebuild with a loader takes its checkpoints from its entry on, as the reference leaves out those before its own.
  if (options.compare !== undefined && options.handover === undefined) await startSampling(options.compare);
  const targets = recording.events.flatMap((event) => ("pc" in event.key ? [at.code(event.key.pc)] : []));
  await countAt(core, targets);
  const mark = options.entry === undefined ? undefined : await markEntry(core, options.entry);
  await startProgram(core, prg, recording.load);
  const base = reference ? recording.ticks : recording.ticks * REBUILD_TIME_FACTOR;
  let limit = base;
  let problem: string | undefined;
  // A tick key of the rebuild comes this many cycles later than in the reference.
  let skipped = 0;
  let screenSkipped = false;
  if (!reference && !recording.load) {
    // The cycles to the wait of a start screen do not count.
    const screen = await passStartScreen(core, own, limit);
    if (typeof screen === "string") problem = screen;
    else if (screen !== undefined) {
      skipped = screen;
      limit = base + skipped;
      screenSkipped = true;
    }
  }
  // A pc key counts the opcode fetches from the start, also those of the code before the entry: the unpacker of
  // the reference, or the loader of the rebuild. The rebuild counts again from the jump of its loader, without those of the reference.
  const { handover } = options;
  let entryRam: EntryRam | undefined;
  if (problem === undefined && handover !== undefined) {
    const jump = own.get(LOADER_JUMP)!;
    if ((await core.status(`run-pc ${hexWord(jump)} ${limit}`)).word !== "reached") problem = `the rebuild did not come to the jump of its loader at ${formatC64Address(jump)}`;
    else {
      await countAt(core, targets);
      const reached = await core.status(`run-pc ${hexWord(handover.entry)} ${limit}`);
      if (reached.word !== "reached") problem = `the rebuild did not come to its entry at ${formatC64Address(handover.entry)}`;
      else {
        entryRam = { sp: reached.s, ram: await core.peek(0, 0x400) };
        // The loader sets the entry state of the capture, but the phase of the frame and of the CIA timers at the entry
        // depends on how the reference started: the rebuild waits at its entry for the beam position of the reference, and
        // gets its CIA timers and interrupt state there. A program that starts its timers without a load keeps that phase.
        const entered = await core.status(`align ${handover.reference.phase}`);
        // After the entry, a tick key is as far from the entry as in the reference.
        skipped = entered.tick - handover.reference.tick;
        limit = base + Math.max(0, skipped);
        if (options.compare !== undefined) await startSampling(options.compare);
      }
    }
  }
  for (const [index, event] of (problem === undefined ? recording.events : []).entries()) {
    const what = event.step === undefined ? "the RESTORE of the play" : "step " + event.step;
    let key = event.key;
    if (handover !== undefined) {
      // The reference came to this point before its entry, where the rebuild runs its loader. Each such event is a pc key: replay checks it.
      if (index < handover.reference.eventsBefore) continue;
      if ("pc" in key) key = { ...key, count: key.count - (handover.reference.counts.get(key.pc) ?? 0) };
    }
    const point = await runToKey(core, key, limit, map, skipped, at);
    if (point === "halted") break;
    if (point === "not-reached") {
      problem = "the program did not come to the point of " + what;
      break;
    }
    // The reference with an entry: the events before the mark at the entry came.
    await mark?.after(index);
    // At the point of a runUntil to an address, its target is reached.
    if (!("pc" in event.key)) problem = await doAction(core, event.action, at);
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
  if (sampling) {
    await core.command("pin off");
    await core.command("sample off");
    lines = readFileSync(samples, "utf8").split("\n").filter((line) => line !== "");
  }
  let entryPoint: EntryPoint | undefined;
  const came = await mark?.end();
  if (came !== undefined) {
    const counts = new Map<string, number>();
    for (const event of recording.events) {
      if (!("pc" in event.key) || counts.has(event.key.pc)) continue;
      const before = /marked=(\d+)/.exec(await core.command(`hits ${hexWord(at.code(event.key.pc))}`));
      if (before !== null) counts.set(event.key.pc, Number(before[1]));
    }
    // A checkpoint at the first fetch at the entry has the tick of the mark. The rebuild starts its checkpoints after that fetch.
    const after = lines.filter((line) => Number(line.split(" ")[0]) > came.tick);
    entryPoint = { ...came, counts, samplesBefore: lines.length - after.length };
    lines = after;
  }
  return {
    samples: lines,
    end,
    unknown,
    misses,
    ...(problem === undefined ? {} : { problem }),
    ...(screenSkipped ? { startScreenSkipped: true } : {}),
    ...(entryPoint === undefined ? {} : { entryPoint }),
    ...(entryRam === undefined ? {} : { entryRam }),
    ...(ram === undefined ? {} : { ram }),
  };
}

export interface CheckpointDifference {
  /** 1 = the first checkpoint. */
  checkpoint: number;
  tick: { reference: number; rebuild: number };
  items: Array<{ address: Location; reference: string; rebuild: string }>;
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
    const items = state.flatMap((item, at) => (a[at] === b[at] ? [] : [{ address: item.address, reference: a[at] ?? "", rebuild: b[at] ?? "" }]));
    return { checkpoint: index + 1, tick: { reference: Number(tickA), rebuild: Number(tickB) }, items };
  }
  return undefined;
}

export interface ReplayResult {
  result: Outcome;
  recording: string;
  /** The side that the result is about: the reference (the self-check) or the rebuild. */
  side: "reference" | "rebuild";
  /** The routine of the checkpoints, and the checkpoints of the reference. */
  checkpoint?: Location;
  checkpoints: number;
  /** The checkpoints of the rebuild that were equal. */
  compared: number;
  reason?: string;
  firstDifference?: CheckpointDifference;
  /** The names of the rebuild: a symbol file, or knowledge. */
  symbols?: string;
  movedSites?: number;
  /** Input reads of the rebuild that the recording had no value for: they got the idle value. */
  idleReads?: number;
  /** A rebuild with a loader: where the reference at its entry differs from the entry state that the loader writes. */
  entryStateDiffers?: Array<{ start: string; end: string }>;
  /** A rebuild with a loader: why the entry state is not compared. */
  entryState?: string;
  files?: Written[];
  /** The screen of the reference at the end of the session (--screen). */
  screen?: Written;
}

/** An input site of a recording: the instruction that reads, the address that it reads, its reads, and how often the value changed. */
export interface InputSite {
  site: Location;
  address: Location;
  reads: number;
  changes: number;
}

/** What `show` gives of a recording folder: the program, the session, the input sites and the coverage counts. */
export interface RecordingSummary {
  recording: string;
  name: string;
  program: string;
  symbols: string;
  load: boolean;
  checkpoint?: Location;
  state?: StateItem[];
  pin?: StateItem[];
  inputs: string[];
  frames: number;
  events: number;
  inputSites: { count: number; listed: InputSite[]; rest?: string };
  /** The RAM addresses that the session executed, read and wrote, from the start of the coverage map. */
  coverage: { executed: number; read: number; written: number };
  /** The test evidence of a finding that the recording shows: the --evidence value of a knowledge write. */
  evidence: string;
}

/**
 * What a recording folder holds, without a replay: recording.json, the value
 * changes of each site in reads.txt (each line `<site> <addr> <from> <value>`
 * after the first read is a change), and the counts of coverage.bin.
 */
export function showRecording(folder: string, max: number): RecordingSummary {
  const recording = readRecording(folder);
  const changes = new Map<string, number>();
  for (const line of readProjectFile(`${folder}/${RECORDING_FILES.reads}`).bytes.toString("utf8").split("\n")) {
    const [site, addr, from] = line.split(" ");
    if (site === undefined || site === "end" || addr === undefined || from === undefined || Number(from) === 0) continue;
    const key = `${site} ${addr}`;
    changes.set(key, (changes.get(key) ?? 0) + 1);
  }
  const sites = recording.sites
    .map((site): InputSite => ({ site: site.site, address: site.addr, reads: site.reads, changes: changes.get(`${hexWord(parseC64Address(site.site))} ${hexWord(parseC64Address(site.addr))}`) ?? 0 }))
    .sort((a, b) => parseC64Address(a.site) - parseC64Address(b.site) || parseC64Address(a.address) - parseC64Address(b.address));
  const map = readProjectFile(`${folder}/${RECORDING_FILES.coverage}`).bytes;
  const count = (bit: number) => map.reduce((total, byte) => total + ((byte & bit) === 0 ? 0 : 1), 0);
  const compare = recording.compare;
  return {
    recording: folder,
    name: recording.name,
    program: recording.program,
    symbols: recording.symbols,
    load: recording.load,
    ...(compare === undefined ? {} : { checkpoint: compare.checkpoint, state: compare.state, ...(compare.pin === undefined ? {} : { pin: compare.pin }) }),
    inputs: recording.inputs,
    frames: Math.round(recording.ticks / PAL_FRAME_CYCLES),
    events: recording.events.length,
    inputSites: listed(sites, max),
    coverage: { executed: count(COVERAGE.ramExecute), read: count(COVERAGE.ramRead), written: count(COVERAGE.ramWrite) },
    evidence: `test:${folder}/${RECORDING_FILES.recording}`,
  };
}
