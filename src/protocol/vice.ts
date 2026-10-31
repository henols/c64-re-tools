// The VICE-session operations of the Host Runtime wire: their vocabulary, shapes and validators.

import { MAX_PRESS_FRAMES, MAX_PRESS_TAPS, MAX_TAP_KEYS, type KeyTap } from "../c64-keys.ts";
import { type Fields, invalid, isInteger, isObject, isOneOf, onlyFields, ProtocolError, VIDEO_STANDARDS, type VideoStandard } from "./messages.ts";

export const SPACES = ["c64", "drive8"] as const;
export type Space = (typeof SPACES)[number];

export const MEMORY_VIEWS = ["cpu", "ram"] as const;
export type MemoryView = (typeof MEMORY_VIEWS)[number];

export const RUN_STATES = ["running", "stopped"] as const;
export type RunState = (typeof RUN_STATES)[number];

/** Bounds of c64_memory_search, c64_memory_compare and c64_disassemble. */
export const MAX_SEARCH_PATTERN = 256;
export const MAX_SEARCH_RESULTS = 1000;
export const MAX_COMPARE_SIZE = 4096;
export const MAX_COMPARE_DIFFERENCES = 32;
export const MAX_DISASSEMBLE = 256;

export interface MemoryLocation {
  address: number;
  space: Space;
  view: MemoryView;
}

export interface Instruction {
  address: number;
  /** The instruction's bytes, lowercase hex. */
  bytes: string;
  /** Mnemonic and operand, for example "LDA #$00". */
  text: string;
}

/** Bounds of c64_memory_read and c64_memory_write. */
export const MAX_MEMORY_READ = 4096;
export const MAX_MEMORY_WRITE = 4096;

export const EXECUTION_ACTIONS = ["pause", "resume", "step", "next", "until-return", "advance-frames"] as const;
export type ExecutionAction = (typeof EXECUTION_ACTIONS)[number];
/** Bounds of c64_execution counts. */
export const MAX_EXECUTION_COUNT = 10_000;

/** File types each media operation accepts, by lowercase extension. */
export const AUTOSTART_TYPES = ["prg", "p00", "t64", "tap", "d64", "d71", "d81", "g64", "x64", "crt"] as const;
export const DISK_TYPES = ["d64", "d71", "d81", "g64", "x64"] as const;

/** Most bytes c64_keyboard queues in one call. */
export const MAX_KEYBOARD_BYTES = 1024;

export const JOYSTICK_DIRECTIONS = [
  "center",
  "up",
  "down",
  "left",
  "right",
  "up-left",
  "up-right",
  "down-left",
  "down-right",
] as const;
export type JoystickDirection = (typeof JOYSTICK_DIRECTIONS)[number];

export interface JoystickState {
  port: 1 | 2;
  direction: JoystickDirection;
  fire: boolean;
}

// Typed conditions

export const COMPARISONS = ["eq", "ne", "lt", "lte", "gt", "gte"] as const;
export type Comparison = (typeof COMPARISONS)[number];
export const CONDITION_REGISTERS = ["a", "x", "y", "sp"] as const;

export type Condition =
  | { kind: "register"; register: (typeof CONDITION_REGISTERS)[number]; operator: Comparison; value: number }
  | { kind: "memory"; address: number; operator: Comparison; value: number; space: Space; view: MemoryView }
  | { kind: "raster"; line: number; cycle?: number };

/** Raster lines and cycles per line of each video standard. */
export const RASTER: Record<VideoStandard, { lines: number; cycles: number }> = {
  pal: { lines: 312, cycles: 63 },
  ntsc: { lines: 263, cycles: 65 },
};

// Breakpoints and watchpoints

export const CHECKPOINT_ACTIONS = ["add", "remove", "enable", "disable", "list"] as const;
export const WATCH_ACCESS = ["read", "write", "read-write"] as const;
export type WatchAccess = (typeof WATCH_ACCESS)[number];
export const MAX_WATCH_SIZE = 256;

export interface Breakpoint {
  id: number;
  address: number;
  /** A range from address: the CPU stops at the first instruction it executes in it. One address when not given. */
  size?: number;
  space: Space;
  enabled: boolean;
  /** The condition given at add, when there was one. */
  condition?: Condition;
}

export interface Watchpoint {
  id: number;
  address: number;
  size: number;
  access: WatchAccess;
  space: Space;
  enabled: boolean;
  /** The condition given at add, when there was one. */
  condition?: Condition;
}

export type BreakpointParams =
  | { action: "add"; address: number; size?: number; space: Space; condition?: Condition }
  | { action: "remove"; id: number }
  | { action: "enable" | "disable"; id: number }
  | { action: "list" };

export type WatchpointParams =
  | { action: "add"; address: number; size: number; access: WatchAccess; space: Space; condition?: Condition }
  | { action: "remove"; id: number }
  | { action: "enable" | "disable"; id: number }
  | { action: "list" };

/** The result of remove: the point is gone, so only its id comes back. */
export interface PointRemoved {
  removed: true;
  id: number;
}

// Chip state

export const VICII_MODES = ["text", "multicolor-text", "extended-color-text", "bitmap", "multicolor-bitmap", "invalid"] as const;
export type ViciiMode = (typeof VICII_MODES)[number];

export interface ViciiState {
  rasterLine: number;
  mode: ViciiMode;
  screenAddress: number;
  graphicsAddress: number;
  scrollX: number;
  scrollY: number;
  borderColor: number;
  backgroundColors: number[];
}

export interface SpriteState {
  index: number;
  x: number;
  y: number;
  enabled: boolean;
  color: number;
  multicolor: boolean;
  expandX: boolean;
  expandY: boolean;
  behindBackground: boolean;
  dataAddress: number;
}

export interface CiaState {
  id: 1 | 2;
  portA: number;
  portB: number;
  ddrA: number;
  ddrB: number;
  timerA: number;
  timerB: number;
  /** The values that a timer loads at an underflow: write-only on the chip, from VICE's dump. */
  latchA: number;
  latchB: number;
  controlA: number;
  controlB: number;
  interruptStatus: number;
  /** The interrupt sources that are on: bits 0-4 of a write to $xd0d with bit 7 set. */
  interruptMask: number;
  tod: { hours: number; minutes: number; seconds: number; tenths: number };
}

export interface SidState {
  voices: Array<{ index: number; frequency: number; pulseWidth: number; control: number; attackDecay: number; sustainRelease: number }>;
  filter: { cutoff: number; resonance: number; routing: number; mode: number };
  volume: number;
}

export const CIA_SELECTIONS = ["1", "2", "both"] as const;
export type CiaSelection = (typeof CIA_SELECTIONS)[number];

// History, backtrace and timing

export const MAX_HISTORY = 200;
export const MAX_BACKTRACE = 64;
export const TIMING_ACTIONS = ["start", "read"] as const;

/** c64_window: open moves the machine into a VICE with a window, close back into a headless one. */
export const WINDOW_ACTIONS = ["open", "close"] as const;

export interface WindowResult {
  window: boolean;
  state: RunState;
  /** Emulator state a move cannot carry; empty when nothing moved. */
  notCarried: string[];
}

export interface HistoryEntry {
  address: number;
  bytes: string;
  text: string;
  a: number;
  x: number;
  y: number;
  sp: number;
  /** C64 space only: the raster position when the instruction started. */
  rasterLine?: number;
  rasterCycle?: number;
}

// Traces: checkpoints that record each hit and let the program run on.

export const TRACE_KINDS = ["exec", "read", "write"] as const;
export type TraceKind = (typeof TRACE_KINDS)[number];
export const MAX_TRACE_POINTS = 8;
export const MAX_TRACE_FRAMES = 3000;
export const MAX_TRACE_HITS = 20_000;
export const TRACE_ENDS = ["frames", "hits", "breakpoint", "watchpoint", "jam"] as const;

export interface TracePoint {
  kind: TraceKind;
  start: number;
  end: number;
}

/** One hit of a trace: the instruction that executed or made the access, the registers before it, and where the raster was. */
export interface TraceHit {
  /** The index of the point in the request. */
  point: number;
  /** The address of the instruction. */
  pc: number;
  bytes: string;
  text: string;
  a: number;
  x: number;
  y: number;
  sp: number;
  /** The frame of the trace, from 0, and the raster position when the instruction started. */
  frame: number;
  rasterLine: number;
  rasterCycle: number;
  /** read and write: the address that the instruction used, when its mode tells it, and the byte there after the access. */
  address?: number;
  value?: number;
}

export interface TraceResult {
  hits: TraceHit[];
  frames: number;
  /** frames: the frame limit; hits: the hit limit; breakpoint, watchpoint or jam: the program stopped there. */
  end: (typeof TRACE_ENDS)[number];
  pc: number;
}

/**
 * A trace result on the wire: the hits are the count, and the hits themselves
 * come as the one attachment, a JSON list (traceHitsFromAttachment). Thousands
 * of hits do not fit in one message.
 */
export type TraceReply = Omit<TraceResult, "hits"> & { hits: number };

export interface BacktraceFrame {
  /** The routine's entry address. */
  address: number;
  /** Where the routine returns to; absent when it cannot be known (a reset or interrupt entry). */
  returnAddress?: number;
}

// Profile and memmap

export const MAX_PROFILE = 100;
export const MAX_MEMMAP_RANGES = 1000;

export interface ProfileEntry {
  address: number;
  /** Decimal strings: cycle counts can outgrow a JSON number. */
  totalCycles: string;
  selfCycles: string;
  /** Share of all profiled cycles spent in the routine itself. */
  percent: number;
}

/** Addresses with the same access flags: the coverage byte of src/c64.ts, RAM, ROM and I/O apart. */
export interface MemmapRange {
  start: number;
  end: number;
  flags: number;
}

// Screen baselines and snapshots

/** 1-64 letters, digits, dots, underscores or hyphens. */
export const TRANSIENT_NAME = /^[A-Za-z0-9._-]{1,64}$/;
export const MAX_BASELINES = 64;
export const MAX_SNAPSHOTS = 64;
/** Most rectangles one screen comparison mask holds. */
export const MAX_MASK_RECTANGLES = 64;

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The visible frame with normal borders that a screen capture holds, in pixels. */
export const FRAME_SIZE: Record<VideoStandard, { width: number; height: number }> = {
  pal: { width: 384, height: 272 },
  ntsc: { width: 384, height: 247 },
};

/** True when the mask rectangles leave no pixel of the frame to compare. */
export function maskCoversFrame(mask: readonly Rectangle[], standard: VideoStandard): boolean {
  const { width, height } = FRAME_SIZE[standard];
  const masked = new Uint8Array(width * height);
  for (const rectangle of mask) {
    for (let y = rectangle.y; y < Math.min(height, rectangle.y + rectangle.height); y++) {
      if (rectangle.x < width) masked.fill(1, y * width + rectangle.x, y * width + Math.min(width, rectangle.x + rectangle.width));
    }
  }
  return !masked.includes(0);
}

export interface ScreenComparison {
  match: boolean;
  mismatchingPixels: number;
  /** Pixels compared: the frame minus the masked ones; always at least 1. */
  comparedPixels: number;
  mismatchRatio: number;
  /** Absent when no pixel differs. */
  bounds?: Rectangle;
  /** Base64 PNG of the differences, when asked for. */
  diffPng?: string;
}

// c64_observe

export const MAX_OBSERVE_RANGES = 16;
export const MAX_OBSERVE_BYTES = 4096;

export interface ObserveParams {
  registers?: Space;
  memory?: Array<{ address: number; size: number; space: Space; view: MemoryView }>;
  vicii?: boolean;
  /** Empty means all eight sprites. */
  sprites?: number[];
  cia?: CiaSelection;
  sid?: boolean;
  screen?: boolean;
  timing?: boolean;
}

export interface ObserveResult {
  registers?: Registers;
  memory?: Array<{ address: number; data: string }>;
  vicii?: ViciiState;
  sprites?: SpriteState[];
  cia?: CiaState[];
  sid?: SidState;
  timing?: { rasterLine: number; rasterCycle: number };
  /** Base64 PNG of the last drawn frame. */
  screen?: { width: number; height: number; png: string };
}

export const RESET_MODES = ["soft", "hard"] as const;
export type ResetMode = (typeof RESET_MODES)[number];

// ---------------------------------------------------------------------------
// VICE-session operations. Addresses are integers 0..0xffff; bytes travel as
// lowercase hex. The MCP formats them into the public shapes.

export interface MachineStatus {
  state: RunState;
  videoStandard: VideoStandard;
  warp: boolean;
  /** True while the machine runs in a VICE with a window. */
  window: boolean;
  /** Present only while the C64 CPU is stopped. */
  pc?: number;
  /** True while a cartridge from an autostart is attached (D64). */
  cartridge: boolean;
  /** Present only while stopped by a user breakpoint or watchpoint, or by a JAM. */
  stopReason?: PointStopReason;
  /** The id of the breakpoint or watchpoint that stopped the machine. */
  pointId?: number;
  /** With pc: the CPU whose address pc is, drive8 when a point in the drive stopped the machine. */
  space?: "c64" | "drive8";
}

/** What stopped the machine outside a request that stops it. */
export const POINT_STOP_REASONS = ["breakpoint", "watchpoint", "jam"] as const;
export type PointStopReason = (typeof POINT_STOP_REASONS)[number];

export interface MemoryReadParams {
  address: number;
  size: number;
  space: Space;
  view: MemoryView;
}

export interface MemoryReadResult {
  address: number;
  data: string;
}

export interface CpuFlags {
  n: boolean;
  v: boolean;
  b: boolean;
  d: boolean;
  i: boolean;
  z: boolean;
  c: boolean;
}

/** The bit of each flag in the 6502 status register; bit 5 always reads as 1. */
export const FLAG_BITS: Record<keyof CpuFlags, number> = { n: 0x80, v: 0x40, b: 0x10, d: 0x08, i: 0x04, z: 0x02, c: 0x01 };

export interface Registers {
  pc: number;
  a: number;
  x: number;
  y: number;
  sp: number;
  flags: CpuFlags;
}

export interface MemoryWriteParams {
  address: number;
  /** Lowercase hex, 1 to MAX_MEMORY_WRITE bytes. */
  data: string;
  space: Space;
  view: MemoryView;
}

/** Any subset of the registers; flags may be a subset too. */
export interface RegisterValues {
  pc?: number;
  a?: number;
  x?: number;
  y?: number;
  sp?: number;
  flags?: Partial<CpuFlags>;
}

export interface ExecutionParams {
  action: ExecutionAction;
  /** step and next: defaults to 1; advance-frames: required. */
  count?: number;
  space: Space;
  /**
   * advance-frames only: the raster position that ends a frame, instead of the
   * position where this call starts. Runs that stop between frames then keep
   * the frames of one timeline.
   */
  anchor?: { line: number; cycle: number };
}

export interface ExecutionResult {
  state: RunState;
  pc?: number;
  executed?: number;
  advancedFrames?: number;
  /** advance-frames only: frames when all frames ran, else what stopped the run early. */
  stopReason?: "frames" | PointStopReason;
  /** The id of the breakpoint or watchpoint that stopped the run. */
  pointId?: number;
  /** advance-frames only: the CPU that stopped, and so the space of pc. */
  space?: "c64" | "drive8";
}

/**
 * The end of a press: `taps` taps were done. A breakpoint, watchpoint or JAM
 * can stop the taps early; then `stopReason` tells which, and the machine
 * stays stopped. All keys are up again in both cases.
 */
export interface PressResult {
  taps: number;
  state: RunState;
  stopReason?: PointStopReason;
  pc?: number;
  pointId?: number;
  space?: "c64" | "drive8";
}

/** c64_run_until targets. */
export type RunTarget =
  | { kind: "address"; address: number; space: Space; condition?: Condition }
  | { kind: "memory"; address: number; operator: Comparison; value: number; space: Space; view: MemoryView }
  | { kind: "raster"; line: number; cycle?: number };

export const STOP_REASONS = ["target", "breakpoint", "watchpoint", "jam", "timeout"] as const;
export type StopReason = (typeof STOP_REASONS)[number];
export const MAX_TIMEOUT_FRAMES = 30_000;

export interface RunUntilResult {
  reached: boolean;
  stopReason: StopReason;
  state: RunState;
  /** The PC of the CPU in `space`: the CPU that stopped. */
  pc: number;
  space: Space;
  /** The id of the breakpoint or watchpoint that stopped the run. */
  pointId?: number;
}

export interface ViceOperations {
  status: { params: Record<string, never>; result: MachineStatus };
  memoryRead: { params: MemoryReadParams; result: MemoryReadResult };
  /** The I/O registers at $d000-$dfff as the chips hold them, whatever the CPU banks in, without side effects. */
  ioRead: { params: { address: number; size: number }; result: MemoryReadResult };
  registersGet: { params: { space: Space }; result: Registers };
  memoryWrite: { params: MemoryWriteParams; result: { address: number; bytesWritten: number } };
  /** `pattern`: bytes, with null as a wildcard. */
  memorySearch: {
    params: { start: number; end: number; pattern: Array<number | null>; space: Space; view: MemoryView; maxResults: number };
    result: { matches: number[] };
  };
  memoryCompare: {
    params: { left: MemoryLocation; right: MemoryLocation; size: number };
    result: { equal: boolean; differentBytes: number; firstDifferences: Array<{ offset: number; left: number; right: number }> };
  };
  disassemble: { params: { address: number; count: number; space: Space; view: MemoryView }; result: { instructions: Instruction[] } };
  registersSet: { params: { space: Space; values: RegisterValues }; result: Registers };
  execution: { params: ExecutionParams; result: ExecutionResult };
  runUntil: { params: { target: RunTarget; timeoutFrames: number }; result: RunUntilResult };
  /** Attachment: the PRG bytes, load address first. */
  programLoad: { params: { address?: number }; result: { state: RunState; loadAddress: number; size: number } };
  /** Attachment: the program or image bytes; `type` is the file's extension. `index` is VICE's file number: 0 loads "*", 1 is the first directory entry. */
  /** `joysticksCentred`: the control ports that held a direction or fire and were centred first. */
  autostart: { params: { type: string; index: number; run: boolean }; result: { state: RunState; joysticksCentred?: Array<1 | 2> } };
  /** Attachment: the disk image bytes; `type` is the file's extension. */
  diskAttach: { params: { type: string }; result: { attached: boolean } };
  /** pc is the reset vector when run is false: the CPU stops there. */
  reset: { params: { mode: ResetMode; run: boolean }; result: { state: RunState; pc?: number } };
  /** `data`: PETSCII bytes as lowercase hex. */
  keyboard: { params: { data: string }; result: { queuedBytes: number } };
  joystick: { params: JoystickState; result: JoystickState };
  /** Each tap holds its keys for `frames` frames, then waits `frames` frames with all keys up. */
  press: { params: { taps: KeyTap[]; frames: number }; result: PressResult };
  breakpoint: { params: BreakpointParams; result: Breakpoint | PointRemoved | { breakpoints: Breakpoint[] } };
  watchpoint: { params: WatchpointParams; result: Watchpoint | PointRemoved | { watchpoints: Watchpoint[] } };
  cpuHistory: { params: { limit: number; space: Space }; result: { entries: HistoryEntry[] } };
  trace: { params: { points: TracePoint[]; frames: number; maxHits: number }; result: TraceReply };
  backtrace: { params: { depth: number; space: Space }; result: { frames: BacktraceFrame[] } };
  /** `cycles` is a decimal string. */
  timing: { params: { action: (typeof TIMING_ACTIONS)[number] }; result: { started: boolean } | { cycles: string } };
  /** clear starts the profiler again from zero. */
  profile: { params: { action: "read"; limit: number } | { action: "clear" }; result: { entries: ProfileEntry[] } | { cleared: boolean } };
  memmap: {
    params: { action: "read"; start: number; end: number; maxRanges: number } | { action: "clear" };
    /** `next`: more ranges follow from this address; read again from there. */
    result: { ranges: MemmapRange[]; next?: number } | { cleared: boolean };
  };
  vicii: { params: Record<string, never>; result: ViciiState };
  /** `indexes`: unique sprite numbers 0-7, in the order to report them. */
  sprites: { params: { indexes: number[] }; result: { sprites: SpriteState[] } };
  cia: { params: { which: CiaSelection }; result: { chips: CiaState[] } };
  sid: { params: Record<string, never>; result: SidState };
  observe: { params: ObserveParams; result: ObserveResult };
  /** The last frame the VIC-II drew, visible area with borders, as a base64 PNG. */
  screenCapture: { params: { baseline?: string }; result: { width: number; height: number; png: string; baseline?: string } };
  screenCompare: {
    params: { baseline: string; maxMismatchRatio: number; mask: Rectangle[]; includeDiff: boolean };
    result: ScreenComparison;
  };
  screenBaselines: { params: Record<string, never>; result: { baselines: string[] } };
  snapshot: {
    params: { action: "save" | "restore" | "remove"; name: string } | { action: "list" };
    result: { saved: boolean; name: string } | { restored: boolean; state: RunState } | { snapshots: string[] } | { removed: boolean };
  };
  /**
   * Snapshot files: export sends the bytes of a named snapshot back as
   * one attachment; restore takes the bytes of a .vsf as one attachment.
   */
  snapshotFile: {
    params: { action: "export"; name: string } | { action: "restore" };
    result: { exported: boolean; bytes: number } | { restored: boolean; state: RunState };
  };
  screenDiscard: { params: { baseline: string }; result: { removed: boolean } };
  warp: { params: { enabled: boolean }; result: { enabled: boolean } };
  window: { params: { action: (typeof WINDOW_ACTIONS)[number] }; result: WindowResult };
}
export type ViceOperation = keyof ViceOperations;

/** How many attachments an operation takes; a snapshotFile restore takes the .vsf. */
export function attachmentCount(op: ViceOperation, params?: unknown): number {
  if (op === "snapshotFile") return isObject(params) && params.action === "restore" ? 1 : 0;
  return op === "programLoad" || op === "autostart" || op === "diskAttach" ? 1 : 0;
}

/** A space field. `what` names the field in the refusal. */
function validSpace(value: unknown, what = "space"): Space {
  if (!isOneOf(SPACES, value)) invalid(`${what} must be c64 or drive8`);
  return value;
}

/** A view field. `what` names the field in the refusal. */
function validView(value: unknown, what = "view"): MemoryView {
  if (!isOneOf(MEMORY_VIEWS, value)) invalid(`${what} must be cpu or ram`);
  return value;
}

/** An address field. `what` names the field in the refusal. */
function validAddress(value: unknown, what = "address"): number {
  if (!isInteger(value, 0, 0xffff)) invalid(`${what} must be an integer from 0 to 65535`);
  return value;
}

function noParams(params: Fields): Record<string, never> {
  onlyFields(params, []);
  return {};
}

/** The parameters of a breakpoint or watchpoint action other than add; undefined for add. */
function pointAction(params: Fields): { action: "list" } | { action: "remove" | "enable" | "disable"; id: number } | undefined {
  if (!isOneOf(CHECKPOINT_ACTIONS, params.action)) invalid(`action must be one of ${CHECKPOINT_ACTIONS.join(", ")}`);
  if (params.action === "list") {
    onlyFields(params, ["action"]);
    return { action: "list" };
  }
  if (params.action === "add") return undefined;
  onlyFields(params, ["action", "id"]);
  if (!isInteger(params.id, 1, 0xffff_ffff)) invalid("id must be a positive integer");
  return { action: params.action, id: params.id };
}

/** The parameter check of each operation: refuses with invalid-input, else returns the checked parameters. */
const PARAMS: { [O in ViceOperation]: (params: Fields) => ViceOperations[O]["params"] } = {
  status: noParams,
  vicii: noParams,
  sid: noParams,
  screenBaselines: noParams,
  screenCapture: (params) => {
    onlyFields(params, ["baseline"]);
    return params.baseline === undefined ? {} : { baseline: validName(params.baseline, "baseline") };
  },
  screenDiscard: (params) => {
    onlyFields(params, ["baseline"]);
    return { baseline: validName(params.baseline, "baseline") };
  },
  snapshot: (params) => {
    onlyFields(params, params.action === "list" ? ["action"] : ["action", "name"]);
    if (params.action === "list") return { action: "list" };
    if (params.action !== "save" && params.action !== "restore" && params.action !== "remove") {
      invalid("action must be save, restore, list or remove");
    }
    return { action: params.action, name: validName(params.name, "name") };
  },
  snapshotFile: (params) => {
    if (params.action === "restore") {
      onlyFields(params, ["action"]);
      return { action: "restore" };
    }
    if (params.action !== "export") invalid("action must be export or restore");
    onlyFields(params, ["action", "name"]);
    return { action: "export", name: validName(params.name, "name") };
  },
  screenCompare: (params) => {
    onlyFields(params, ["baseline", "maxMismatchRatio", "mask", "includeDiff"]);
    const ratio = params.maxMismatchRatio;
    if (typeof ratio !== "number" || !(ratio >= 0 && ratio <= 1)) invalid("maxMismatchRatio must be a number from 0 to 1");
    if (!Array.isArray(params.mask) || params.mask.length > MAX_MASK_RECTANGLES) invalid(`mask must be a list of at most ${MAX_MASK_RECTANGLES} rectangles`);
    const mask = params.mask.map((rectangle): Rectangle => {
      if (!isObject(rectangle)) invalid("each mask entry must be a rectangle");
      onlyFields(rectangle, ["x", "y", "width", "height"], "a mask rectangle");
      const ok = isInteger(rectangle.x, 0, 4095) && isInteger(rectangle.y, 0, 4095) && isInteger(rectangle.width, 1, 4096) && isInteger(rectangle.height, 1, 4096);
      if (!ok) invalid("a mask rectangle needs integer x, y, width and height, with width and height at least 1");
      return { x: rectangle.x as number, y: rectangle.y as number, width: rectangle.width as number, height: rectangle.height as number };
    });
    if (typeof params.includeDiff !== "boolean") invalid("includeDiff must be true or false");
    return { baseline: validName(params.baseline, "baseline"), maxMismatchRatio: ratio, mask, includeDiff: params.includeDiff };
  },
  cpuHistory: (params) => {
    onlyFields(params, ["limit", "space"]);
    if (!isInteger(params.limit, 1, MAX_HISTORY)) invalid(`limit must be an integer from 1 to ${MAX_HISTORY}`);
    return { limit: params.limit, space: validSpace(params.space) };
  },
  trace: (params) => {
    onlyFields(params, ["points", "frames", "maxHits"]);
    if (!Array.isArray(params.points) || params.points.length === 0 || params.points.length > MAX_TRACE_POINTS) invalid(`points must be a list of 1 to ${MAX_TRACE_POINTS} points`);
    const points = (params.points as unknown[]).map((point) => {
      if (!isObject(point)) return invalid("a point is an object with kind, start and end");
      onlyFields(point, ["kind", "start", "end"]);
      if (!isOneOf(TRACE_KINDS, point.kind)) invalid("a point kind must be exec, read or write");
      if (!isInteger(point.start, 0, 0xffff) || !isInteger(point.end, point.start as number, 0xffff)) invalid("a point needs start and end from $0000 to $ffff, the end not before the start");
      return { kind: point.kind, start: point.start, end: point.end } as TracePoint;
    });
    if (!isInteger(params.frames, 1, MAX_TRACE_FRAMES)) invalid(`frames must be an integer from 1 to ${MAX_TRACE_FRAMES}`);
    if (!isInteger(params.maxHits, 1, MAX_TRACE_HITS)) invalid(`maxHits must be an integer from 1 to ${MAX_TRACE_HITS}`);
    return { points, frames: params.frames, maxHits: params.maxHits };
  },
  backtrace: (params) => {
    onlyFields(params, ["depth", "space"]);
    if (!isInteger(params.depth, 1, MAX_BACKTRACE)) invalid(`depth must be an integer from 1 to ${MAX_BACKTRACE}`);
    return { depth: params.depth, space: validSpace(params.space) };
  },
  timing: (params) => {
    onlyFields(params, ["action"]);
    if (!isOneOf(TIMING_ACTIONS, params.action)) invalid("action must be start or read");
    return { action: params.action };
  },
  observe: (params) => {
    onlyFields(params, ["registers", "memory", "vicii", "sprites", "cia", "sid", "screen", "timing"]);
    const result: ObserveParams = {};
    if (params.registers !== undefined) result.registers = validSpace(params.registers, "registers");
    if (params.memory !== undefined) {
      const ranges = params.memory;
      if (!Array.isArray(ranges) || ranges.length === 0 || ranges.length > MAX_OBSERVE_RANGES) {
        invalid(`memory must hold 1 to ${MAX_OBSERVE_RANGES} ranges`);
      }
      result.memory = ranges.map((range) => validateViceParams("memoryRead", range));
      if (result.memory.reduce((sum, range) => sum + range.size, 0) > MAX_OBSERVE_BYTES) {
        invalid(`the memory ranges must hold at most ${MAX_OBSERVE_BYTES} bytes together`);
      }
    }
    for (const flag of ["vicii", "sid", "screen", "timing"] as const) {
      if (params[flag] === undefined) continue;
      if (typeof params[flag] !== "boolean") invalid(`${flag} must be true or false`);
      if (params[flag]) result[flag] = true;
    }
    if (params.sprites !== undefined) result.sprites = validateViceParams("sprites", { indexes: params.sprites }).indexes;
    if (params.cia !== undefined) result.cia = validateViceParams("cia", { which: params.cia }).which;
    if (Object.keys(result).length === 0) invalid("ask for at least one observation");
    return result;
  },
  profile: (params) => {
    onlyFields(params, params.action === "clear" ? ["action"] : ["action", "limit"]);
    if (params.action === "clear") return { action: "clear" };
    if (params.action !== "read") invalid("action must be read or clear");
    if (!isInteger(params.limit, 1, MAX_PROFILE)) invalid(`limit must be an integer from 1 to ${MAX_PROFILE}`);
    return { action: "read", limit: params.limit };
  },
  memmap: (params) => {
    onlyFields(params, params.action === "clear" ? ["action"] : ["action", "start", "end", "maxRanges"]);
    if (params.action === "clear") return { action: "clear" };
    if (params.action !== "read") invalid("action must be read or clear");
    if (!isInteger(params.start, 0, 0xffff) || !isInteger(params.end, 0, 0xffff)) invalid("start and end must be integers from 0 to 65535");
    if (params.end < params.start) invalid("end must not be before start");
    if (!isInteger(params.maxRanges, 1, MAX_MEMMAP_RANGES)) invalid(`maxRanges must be an integer from 1 to ${MAX_MEMMAP_RANGES}`);
    return { action: "read", start: params.start, end: params.end, maxRanges: params.maxRanges };
  },
  sprites: (params) => {
    onlyFields(params, ["indexes"]);
    const indexes = params.indexes;
    if (!Array.isArray(indexes) || !indexes.every((index) => isInteger(index, 0, 7))) invalid("sprites holds sprite numbers 0 to 7");
    if (new Set(indexes).size !== indexes.length) invalid("sprites holds each sprite number once");
    return { indexes: indexes as number[] };
  },
  cia: (params) => {
    onlyFields(params, ["which"]);
    if (!isOneOf(CIA_SELECTIONS, params.which)) invalid("cia must be 1, 2 or both");
    return { which: params.which };
  },
  memoryRead: (params) => {
    onlyFields(params, ["address", "size", "space", "view"]);
    const address = validAddress(params.address);
    if (!isInteger(params.size, 1, MAX_MEMORY_READ)) invalid(`size must be an integer from 1 to ${MAX_MEMORY_READ}`);
    if (address + params.size > 0x10000) invalid("the range runs past $ffff");
    return { address, size: params.size, space: validSpace(params.space), view: validView(params.view) };
  },
  ioRead: (params) => {
    onlyFields(params, ["address", "size"]);
    if (!isInteger(params.address, 0xd000, 0xdfff)) invalid("address must be in the I/O area $d000-$dfff");
    if (!isInteger(params.size, 1, 0x1000) || params.address + params.size > 0xe000) invalid("the range must stay inside $d000-$dfff");
    return { address: params.address, size: params.size };
  },
  registersGet: (params) => {
    onlyFields(params, ["space"]);
    return { space: validSpace(params.space) };
  },
  memoryWrite: (params) => {
    onlyFields(params, ["address", "data", "space", "view"]);
    const address = validAddress(params.address);
    if (!isHexData(params.data) || params.data.length === 0) invalid("data must be lowercase hex bytes");
    const size = params.data.length / 2;
    if (size > MAX_MEMORY_WRITE) invalid(`data must be at most ${MAX_MEMORY_WRITE} bytes`);
    if (address + size > 0x10000) invalid("the range runs past $ffff");
    return { address, data: params.data, space: validSpace(params.space), view: validView(params.view) };
  },
  memorySearch: (params) => {
    onlyFields(params, ["start", "end", "pattern", "space", "view", "maxResults"]);
    if (!isInteger(params.start, 0, 0xffff) || !isInteger(params.end, 0, 0xffff)) invalid("start and end must be integers from 0 to 65535");
    if (params.end < params.start) invalid("end must not be before start");
    const pattern = params.pattern;
    if (!Array.isArray(pattern) || pattern.length === 0 || pattern.length > MAX_SEARCH_PATTERN) {
      invalid(`pattern must have 1 to ${MAX_SEARCH_PATTERN} bytes`);
    }
    if (!pattern.every((token) => token === null || isInteger(token, 0, 0xff))) invalid("pattern holds bytes 0 to 255 or null wildcards");
    if (pattern.every((token) => token === null)) invalid("pattern needs at least one byte that is not a wildcard");
    const space = validSpace(params.space);
    const view = validView(params.view);
    if (!isInteger(params.maxResults, 1, MAX_SEARCH_RESULTS)) invalid(`maxResults must be an integer from 1 to ${MAX_SEARCH_RESULTS}`);
    return { start: params.start, end: params.end, pattern: pattern as Array<number | null>, space, view, maxResults: params.maxResults };
  },
  memoryCompare: (params) => {
    onlyFields(params, ["left", "right", "size"]);
    const size = params.size;
    if (!isInteger(size, 1, MAX_COMPARE_SIZE)) invalid(`size must be an integer from 1 to ${MAX_COMPARE_SIZE}`);
    const location = (value: unknown, name: string): MemoryLocation => {
      if (!isObject(value)) invalid(`${name} must be an object`);
      onlyFields(value, ["address", "space", "view"], name);
      const address = validAddress(value.address, `${name} address`);
      if (address + size > 0x10000) invalid(`the ${name} range runs past $ffff`);
      return { address, space: validSpace(value.space, `${name} space`), view: validView(value.view, `${name} view`) };
    };
    return { left: location(params.left, "left"), right: location(params.right, "right"), size };
  },
  disassemble: (params) => {
    onlyFields(params, ["address", "count", "space", "view"]);
    const address = validAddress(params.address);
    if (!isInteger(params.count, 1, MAX_DISASSEMBLE)) invalid(`count must be an integer from 1 to ${MAX_DISASSEMBLE}`);
    return { address, count: params.count, space: validSpace(params.space), view: validView(params.view) };
  },
  registersSet: (params) => {
    onlyFields(params, ["space", "values"]);
    const space = validSpace(params.space);
    const values = params.values;
    if (!isObject(values)) invalid("values must be an object");
    const known = ["pc", "a", "x", "y", "sp", "flags"];
    for (const key of Object.keys(values)) if (!known.includes(key)) invalid(`values has an unknown register: ${key}`);
    if (Object.keys(values).length === 0) invalid("values must name at least one register");
    const result: RegisterValues = {};
    if (values.pc !== undefined) result.pc = validAddress(values.pc, "pc");
    for (const name of ["a", "x", "y", "sp"] as const) {
      if (values[name] === undefined) continue;
      if (!isInteger(values[name], 0, 0xff)) invalid(`${name} must be an integer from 0 to 255`);
      result[name] = values[name];
    }
    if (values.flags !== undefined) {
      const flags = values.flags;
      if (!isObject(flags)) invalid("flags must be an object");
      const set: Partial<CpuFlags> = {};
      for (const [flag, value] of Object.entries(flags)) {
        if (!Object.hasOwn(FLAG_BITS, flag)) invalid(`flags has an unknown flag: ${flag}`);
        if (typeof value !== "boolean") invalid(`flag ${flag} must be true or false`);
        set[flag as keyof CpuFlags] = value;
      }
      result.flags = set;
    }
    return { space, values: result };
  },
  execution: (params) => {
    onlyFields(params, ["action", "space", "count", "anchor"]);
    if (!isOneOf(EXECUTION_ACTIONS, params.action)) invalid(`action must be one of ${EXECUTION_ACTIONS.join(", ")}`);
    const result: ExecutionParams = { action: params.action, space: validSpace(params.space) };
    const counted = params.action === "step" || params.action === "next" || params.action === "advance-frames";
    if (params.count !== undefined) {
      if (!counted) invalid(`count is not used with action ${params.action}`);
      if (!isInteger(params.count, 1, MAX_EXECUTION_COUNT)) invalid(`count must be an integer from 1 to ${MAX_EXECUTION_COUNT}`);
    } else if (params.action === "advance-frames") {
      invalid("advance-frames needs count, the number of frames");
    }
    if (counted) result.count = (params.count as number | undefined) ?? 1;
    if (params.anchor !== undefined) {
      if (params.action !== "advance-frames") invalid(`anchor is not used with action ${params.action}`);
      const anchor = params.anchor;
      if (!isObject(anchor) || !isInteger(anchor.line, 0, 511) || !isInteger(anchor.cycle, 0, 127)) invalid("anchor needs line from 0 to 511 and cycle from 0 to 127");
      onlyFields(anchor as Record<string, unknown>, ["line", "cycle"]);
      result.anchor = { line: anchor.line as number, cycle: anchor.cycle as number };
    }
    return result;
  },
  runUntil: (params) => {
    onlyFields(params, ["target", "timeoutFrames"]);
    if (!isInteger(params.timeoutFrames, 1, MAX_TIMEOUT_FRAMES)) invalid(`timeoutFrames must be an integer from 1 to ${MAX_TIMEOUT_FRAMES}`);
    return { target: validateRunTarget(params.target), timeoutFrames: params.timeoutFrames };
  },
  programLoad: (params) => {
    onlyFields(params, ["address"]);
    return params.address === undefined ? {} : { address: validAddress(params.address) };
  },
  autostart: (params) => {
    onlyFields(params, ["type", "index", "run"]);
    if (!isOneOf(AUTOSTART_TYPES, params.type)) invalid(`the file must be one of: ${AUTOSTART_TYPES.map((type) => `.${type}`).join(", ")}`);
    if (!isInteger(params.index, 0, 0xffff)) invalid("index must be an integer from 0 to 65535");
    if (typeof params.run !== "boolean") invalid("run must be true or false");
    return { type: params.type, index: params.index, run: params.run };
  },
  diskAttach: (params) => {
    onlyFields(params, ["type"]);
    if (!isOneOf(DISK_TYPES, params.type)) invalid(`the disk image must be one of: ${DISK_TYPES.map((type) => `.${type}`).join(", ")}`);
    return { type: params.type };
  },
  keyboard: (params) => {
    onlyFields(params, ["data"]);
    if (!isHexData(params.data) || params.data.length === 0) invalid("data must be PETSCII bytes as lowercase hex");
    if (params.data.length / 2 > MAX_KEYBOARD_BYTES) invalid(`at most ${MAX_KEYBOARD_BYTES} bytes can be queued at once`);
    // VICE feeds a C string, so a zero byte would end the text early.
    if (/^(?:..)*?00/.test(params.data)) invalid("PETSCII byte 0 cannot be typed");
    return { data: params.data };
  },
  press: (params) => {
    onlyFields(params, ["taps", "frames"]);
    if (!Array.isArray(params.taps) || params.taps.length === 0 || params.taps.length > MAX_PRESS_TAPS) invalid(`taps must be a list of 1 to ${MAX_PRESS_TAPS} taps`);
    const taps = (params.taps as unknown[]).map((tap): KeyTap => {
      if (!isObject(tap)) invalid("each tap must be an object with keys and restore");
      onlyFields(tap, ["keys", "restore"], "a tap");
      const { keys, restore } = tap;
      if (!Array.isArray(keys) || !keys.every((key, index) => isInteger(key, 0, 63) && (index === 0 || key > (keys[index - 1] as number)))) {
        invalid("keys of a tap must be matrix places from 0 to 63, each once, in rising order");
      }
      if (typeof restore !== "boolean") invalid("restore of a tap must be true or false");
      const count = keys.length + (restore ? 1 : 0);
      if (count === 0 || count > MAX_TAP_KEYS) invalid(`a tap holds 1 to ${MAX_TAP_KEYS} keys, RESTORE included`);
      return { keys: keys as number[], restore };
    });
    if (!isInteger(params.frames, 1, MAX_PRESS_FRAMES)) invalid(`frames must be a whole number from 1 to ${MAX_PRESS_FRAMES}`);
    return { taps, frames: params.frames };
  },
  joystick: (params) => {
    onlyFields(params, ["port", "direction", "fire"]);
    if (params.port !== 1 && params.port !== 2) invalid("port must be 1 or 2");
    if (!isOneOf(JOYSTICK_DIRECTIONS, params.direction)) invalid(`direction must be one of ${JOYSTICK_DIRECTIONS.join(", ")}`);
    if (typeof params.fire !== "boolean") invalid("fire must be true or false");
    return { port: params.port, direction: params.direction, fire: params.fire };
  },
  breakpoint: (params) => {
    const other = pointAction(params);
    if (other !== undefined) return other;
    onlyFields(params, ["action", "address", "space", "size", "condition"]);
    const added: Extract<BreakpointParams, { action: "add" }> = { action: "add", address: validAddress(params.address), space: validSpace(params.space) };
    if (params.size !== undefined) {
      if (!isInteger(params.size, 1, 0x10000) || added.address + params.size > 0x10000) invalid("size must keep the range inside $0000-$ffff");
      added.size = params.size;
    }
    if (params.condition !== undefined) added.condition = validateCondition(params.condition);
    return added;
  },
  watchpoint: (params) => {
    const other = pointAction(params);
    if (other !== undefined) return other;
    onlyFields(params, ["action", "address", "space", "size", "access", "condition"]);
    const address = validAddress(params.address);
    const space = validSpace(params.space);
    if (!isInteger(params.size, 1, MAX_WATCH_SIZE)) invalid(`size must be an integer from 1 to ${MAX_WATCH_SIZE}`);
    if (address + params.size > 0x10000) invalid("the range runs past $ffff");
    if (!isOneOf(WATCH_ACCESS, params.access)) invalid("access must be read, write or read-write");
    const added: Extract<WatchpointParams, { action: "add" }> = { action: "add", address, space, size: params.size, access: params.access };
    if (params.condition !== undefined) added.condition = validateCondition(params.condition);
    return added;
  },
  reset: (params) => {
    onlyFields(params, ["mode", "run"]);
    if (!isOneOf(RESET_MODES, params.mode)) invalid("mode must be soft or hard");
    if (typeof params.run !== "boolean") invalid("run must be true or false");
    return { mode: params.mode, run: params.run };
  },
  warp: (params) => {
    onlyFields(params, ["enabled"]);
    if (typeof params.enabled !== "boolean") invalid("enabled must be true or false");
    return { enabled: params.enabled };
  },
  window: (params) => {
    onlyFields(params, ["action"]);
    if (!isOneOf(WINDOW_ACTIONS, params.action)) invalid("action must be open or close");
    return { action: params.action };
  },
};

export const VICE_OPERATIONS = Object.keys(PARAMS) as readonly ViceOperation[];

/** Validates request parameters on the host. Throws WireFailure(invalid-input). */
export function validateViceParams<O extends ViceOperation>(op: O, params: unknown): ViceOperations[O]["params"] {
  if (!isObject(params)) invalid("parameters must be an object");
  if (!Object.hasOwn(PARAMS, op)) invalid(`unknown operation: ${String(op)}`);
  return PARAMS[op](params);
}

/**
 * Validates a typed condition. Raster bounds here cover both video
 * standards; the session checks them against its own standard.
 */
export function validateCondition(value: unknown): Condition {
  if (!isObject(value)) invalid("condition must be an object");
  const byte = (field: unknown, name: string) => {
    if (!isInteger(field, 0, 0xff)) invalid(`condition ${name} must be an integer from 0 to 255`);
    return field;
  };
  switch (value.kind) {
    case "register": {
      onlyFields(value, ["kind", "register", "operator", "value"], "the condition");
      if (!isOneOf(CONDITION_REGISTERS, value.register)) invalid("condition register must be a, x, y or sp");
      if (!isOneOf(COMPARISONS, value.operator)) invalid(`condition operator must be one of ${COMPARISONS.join(", ")}`);
      return { kind: "register", register: value.register, operator: value.operator, value: byte(value.value, "value") };
    }
    case "memory": {
      onlyFields(value, ["kind", "address", "operator", "value", "space", "view"], "the condition");
      const address = validAddress(value.address, "condition address");
      if (!isOneOf(COMPARISONS, value.operator)) invalid(`condition operator must be one of ${COMPARISONS.join(", ")}`);
      const space = validSpace(value.space, "condition space");
      const view = validView(value.view, "condition view");
      return { kind: "memory", address, operator: value.operator, value: byte(value.value, "value"), space, view };
    }
    case "raster": {
      onlyFields(value, ["kind", "line", "cycle"], "the condition");
      if (!isInteger(value.line, 0, RASTER.pal.lines - 1)) invalid("condition line must be a raster line number");
      if (value.cycle !== undefined && !isInteger(value.cycle, 0, RASTER.ntsc.cycles - 1)) {
        invalid("condition cycle must be a cycle number in the raster line");
      }
      return value.cycle === undefined ? { kind: "raster", line: value.line } : { kind: "raster", line: value.line, cycle: value.cycle };
    }
  }
  return invalid("condition kind must be register, memory or raster");
}

function validateRunTarget(value: unknown): RunTarget {
  if (!isObject(value)) invalid("target must be an object");
  switch (value.kind) {
    case "address": {
      onlyFields(value, ["kind", "address", "space", "condition"], "the target");
      const target: Extract<RunTarget, { kind: "address" }> = { kind: "address", address: validAddress(value.address, "target address"), space: validSpace(value.space, "target space") };
      if (value.condition !== undefined) target.condition = validateCondition(value.condition);
      return target;
    }
    case "memory":
      onlyFields(value, ["kind", "address", "operator", "value", "space", "view"], "the target");
      return validateCondition(value) as Extract<Condition, { kind: "memory" }>;
    case "raster":
      onlyFields(value, ["kind", "line", "cycle"], "the target");
      return validateCondition(value) as Extract<Condition, { kind: "raster" }>;
  }
  return invalid("target kind must be address, memory or raster");
}

function isRemoved(value: unknown): value is PointRemoved {
  return isObject(value) && value.removed === true && isInteger(value.id, 1, 0xffff_ffff) && Object.keys(value).length === 2;
}

function isBreakpoint(value: unknown): value is Breakpoint {
  return (
    isObject(value) &&
    isInteger(value.id, 1, 0xffff_ffff) &&
    isInteger(value.address, 0, 0xffff) &&
    (value.size === undefined || isInteger(value.size, 1, 0x10000)) &&
    isOneOf(SPACES, value.space) &&
    typeof value.enabled === "boolean" &&
    (value.condition === undefined || isCondition(value.condition))
  );
}

function isCondition(value: unknown): value is Condition {
  try {
    validateCondition(value);
    return true;
  } catch {
    return false;
  }
}

function isWatchpoint(value: unknown): value is Watchpoint {
  return isBreakpoint(value) && isObject(value) && isInteger(value.size, 1, MAX_WATCH_SIZE) && isOneOf(WATCH_ACCESS, value.access);
}

function validName(value: unknown, what: string): string {
  if (typeof value !== "string" || !TRANSIENT_NAME.test(value)) {
    invalid(`${what} must be 1 to 64 letters, digits, dots, underscores or hyphens`);
  }
  return value;
}

function isHexData(value: unknown): value is string {
  return typeof value === "string" && /^(?:[0-9a-f]{2})*$/.test(value);
}

function isRegisters(value: Fields): boolean {
  return (
    isInteger(value.pc, 0, 0xffff) &&
    (["a", "x", "y", "sp"] as const).every((name) => isInteger(value[name], 0, 0xff)) &&
    isObject(value.flags) &&
    Object.keys(FLAG_BITS).every((flag) => typeof (value.flags as Fields)[flag] === "boolean")
  );
}

/** The fields that a stop can add to a result: the pc, the point that stopped the machine, and the CPU that stopped. */
function hasStopFields(value: Fields): boolean {
  return (
    (value.pc === undefined || isInteger(value.pc, 0, 0xffff)) &&
    (value.pointId === undefined || isInteger(value.pointId, 1, Number.MAX_SAFE_INTEGER)) &&
    (value.space === undefined || isOneOf(SPACES, value.space))
  );
}

function isMemoryRead(value: Fields): boolean {
  return isInteger(value.address, 0, 0xffff) && isHexData(value.data);
}

/** The shape check of each operation's result. A check can also throw its own ProtocolError. */
const RESULTS: Record<ViceOperation, (value: Fields) => boolean> = {
  status: (value) =>
    isOneOf(RUN_STATES, value.state) &&
    isOneOf(VIDEO_STANDARDS, value.videoStandard) &&
    typeof value.warp === "boolean" &&
    typeof value.window === "boolean" &&
    typeof value.cartridge === "boolean" &&
    (value.stopReason === undefined || isOneOf(POINT_STOP_REASONS, value.stopReason)) &&
    hasStopFields(value),
  memoryRead: isMemoryRead,
  ioRead: isMemoryRead,
  registersGet: isRegisters,
  // A registersSet result is the full register set, and is refused as one.
  registersSet: (value) => (validateViceResult("registersGet", value), true),
  memoryWrite: (value) => isInteger(value.address, 0, 0xffff) && isInteger(value.bytesWritten, 1, MAX_MEMORY_WRITE),
  memorySearch: (value) => Array.isArray(value.matches) && value.matches.every((match) => isInteger(match, 0, 0xffff)),
  memoryCompare: (value) =>
    typeof value.equal === "boolean" &&
    isInteger(value.differentBytes, 0, MAX_COMPARE_SIZE) &&
    Array.isArray(value.firstDifferences) &&
    value.firstDifferences.length <= MAX_COMPARE_DIFFERENCES &&
    value.firstDifferences.every(
      (difference) =>
        isObject(difference) && isInteger(difference.offset, 0, MAX_COMPARE_SIZE - 1) && isInteger(difference.left, 0, 0xff) && isInteger(difference.right, 0, 0xff),
    ),
  disassemble: (value) =>
    Array.isArray(value.instructions) &&
    value.instructions.every((instruction) => isObject(instruction) && isInteger(instruction.address, 0, 0xffff) && isHexData(instruction.bytes) && typeof instruction.text === "string"),
  runUntil: (value) =>
    typeof value.reached === "boolean" &&
    isOneOf(STOP_REASONS, value.stopReason) &&
    isOneOf(RUN_STATES, value.state) &&
    isInteger(value.pc, 0, 0xffff) &&
    isOneOf(SPACES, value.space) &&
    hasStopFields(value),
  execution: (value) =>
    isOneOf(RUN_STATES, value.state) &&
    (value.executed === undefined || isInteger(value.executed, 0, MAX_EXECUTION_COUNT)) &&
    (value.advancedFrames === undefined || isInteger(value.advancedFrames, 0, MAX_EXECUTION_COUNT)) &&
    (value.stopReason === undefined || value.stopReason === "frames" || isOneOf(POINT_STOP_REASONS, value.stopReason)) &&
    hasStopFields(value),
  reset: (value) => isOneOf(RUN_STATES, value.state) && (value.pc === undefined || isInteger(value.pc, 0, 0xffff)),
  autostart: (value) =>
    isOneOf(RUN_STATES, value.state) &&
    (value.joysticksCentred === undefined || (Array.isArray(value.joysticksCentred) && value.joysticksCentred.every((port) => port === 1 || port === 2))),
  programLoad: (value) => isOneOf(RUN_STATES, value.state) && isInteger(value.loadAddress, 0, 0xffff) && isInteger(value.size, 1, 0x10000),
  diskAttach: (value) => typeof value.attached === "boolean",
  keyboard: (value) => isInteger(value.queuedBytes, 1, MAX_KEYBOARD_BYTES),
  press: (value) =>
    isInteger(value.taps, 0, MAX_PRESS_TAPS) &&
    isOneOf(RUN_STATES, value.state) &&
    (value.stopReason === undefined || isOneOf(POINT_STOP_REASONS, value.stopReason)) &&
    hasStopFields(value),
  breakpoint: (value) => (Array.isArray(value.breakpoints) ? value.breakpoints.every(isBreakpoint) : isRemoved(value) || isBreakpoint(value)),
  watchpoint: (value) => (Array.isArray(value.watchpoints) ? value.watchpoints.every(isWatchpoint) : isRemoved(value) || isWatchpoint(value)),
  screenCompare: (value) => {
    const bounds = value.bounds;
    return (
      typeof value.match === "boolean" &&
      isInteger(value.mismatchingPixels, 0, 1 << 20) &&
      isInteger(value.comparedPixels, 1, 1 << 20) &&
      (value.mismatchingPixels as number) <= (value.comparedPixels as number) &&
      typeof value.mismatchRatio === "number" &&
      value.mismatchRatio >= 0 &&
      value.mismatchRatio <= 1 &&
      (bounds === undefined || (isObject(bounds) && (["x", "y", "width", "height"] as const).every((field) => isInteger(bounds[field], 0, 4096)))) &&
      (value.diffPng === undefined || (typeof value.diffPng === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(value.diffPng)))
    );
  },
  screenBaselines: (value) => Array.isArray(value.baselines) && value.baselines.every((name) => typeof name === "string"),
  screenDiscard: (value) => value.removed === true,
  snapshot: (value) =>
    (value.saved === true && typeof value.name === "string") ||
    (value.restored === true && isOneOf(RUN_STATES, value.state)) ||
    (Array.isArray(value.snapshots) && value.snapshots.every((name) => typeof name === "string")) ||
    value.removed === true,
  snapshotFile: (value) => (value.exported === true && isInteger(value.bytes, 1, 0xffff_ffff)) || (value.restored === true && isOneOf(RUN_STATES, value.state)),
  cpuHistory: (value) =>
    Array.isArray(value.entries) &&
    value.entries.every(
      (entry) =>
        isObject(entry) &&
        isInteger(entry.address, 0, 0xffff) &&
        isHexData(entry.bytes) &&
        typeof entry.text === "string" &&
        (["a", "x", "y", "sp"] as const).every((name) => isInteger(entry[name], 0, 0xff)) &&
        (entry.rasterLine === undefined || isInteger(entry.rasterLine, 0, 511)) &&
        (entry.rasterCycle === undefined || isInteger(entry.rasterCycle, 0, 127)),
    ),
  trace: (value) => isInteger(value.hits, 0, MAX_TRACE_HITS) && isInteger(value.frames, 0, MAX_TRACE_FRAMES) && isOneOf(TRACE_ENDS, value.end) && isInteger(value.pc, 0, 0xffff),
  backtrace: (value) =>
    Array.isArray(value.frames) &&
    value.frames.every((frame) => isObject(frame) && isInteger(frame.address, 0, 0xffff) && (frame.returnAddress === undefined || isInteger(frame.returnAddress, 0, 0xffff))),
  timing: (value) => ("cycles" in value ? typeof value.cycles === "string" && /^\d+$/.test(value.cycles) : value.started === true),
  profile: (value) =>
    "cleared" in value
      ? value.cleared === true
      : Array.isArray(value.entries) &&
        value.entries.every(
          (entry) =>
            isObject(entry) &&
            isInteger(entry.address, 0, 0xffff) &&
            typeof entry.totalCycles === "string" &&
            /^\d+$/.test(entry.totalCycles) &&
            typeof entry.selfCycles === "string" &&
            /^\d+$/.test(entry.selfCycles) &&
            typeof entry.percent === "number",
        ),
  memmap: (value) =>
    Array.isArray(value.ranges)
      ? value.ranges.every((range) => isObject(range) && isInteger(range.start, 0, 0xffff) && isInteger(range.end, 0, 0xffff) && isInteger(range.flags, 1, 0xff)) &&
        (value.next === undefined || isInteger(value.next, 0, 0xffff))
      : value.cleared === true,
  observe: (value) => {
    // Each present section must have the shape of the single-purpose result.
    if (value.registers !== undefined) validateViceResult("registersGet", value.registers);
    if (value.memory !== undefined) {
      const ok = Array.isArray(value.memory) && value.memory.every((range) => isObject(range) && isMemoryRead(range));
      if (!ok) throw new ProtocolError("observe memory is malformed");
    }
    if (value.vicii !== undefined) validateViceResult("vicii", value.vicii);
    if (value.sprites !== undefined) validateViceResult("sprites", { sprites: value.sprites });
    if (value.cia !== undefined) validateViceResult("cia", { chips: value.cia });
    if (value.sid !== undefined) validateViceResult("sid", value.sid);
    if (value.timing !== undefined) {
      const timing = value.timing;
      if (!isObject(timing) || !isInteger(timing.rasterLine, 0, 511) || !isInteger(timing.rasterCycle, 0, 127)) {
        throw new ProtocolError("observe timing is malformed");
      }
    }
    if (value.screen !== undefined) validateViceResult("screenCapture", value.screen);
    return true;
  },
  vicii: (value) =>
    isInteger(value.rasterLine, 0, 511) &&
    isOneOf(VICII_MODES, value.mode) &&
    isInteger(value.screenAddress, 0, 0xffff) &&
    isInteger(value.graphicsAddress, 0, 0xffff) &&
    isInteger(value.scrollX, 0, 7) &&
    isInteger(value.scrollY, 0, 7) &&
    isInteger(value.borderColor, 0, 15) &&
    Array.isArray(value.backgroundColors) &&
    value.backgroundColors.length === 4 &&
    value.backgroundColors.every((color) => isInteger(color, 0, 15)),
  sprites: (value) =>
    Array.isArray(value.sprites) &&
    value.sprites.every(
      (sprite) =>
        isObject(sprite) &&
        isInteger(sprite.index, 0, 7) &&
        isInteger(sprite.x, 0, 511) &&
        isInteger(sprite.y, 0, 255) &&
        isInteger(sprite.color, 0, 15) &&
        isInteger(sprite.dataAddress, 0, 0xffff) &&
        (["enabled", "multicolor", "expandX", "expandY", "behindBackground"] as const).every((flag) => typeof sprite[flag] === "boolean"),
    ),
  cia: (value) =>
    Array.isArray(value.chips) &&
    value.chips.every(
      (chip) =>
        isObject(chip) &&
        (chip.id === 1 || chip.id === 2) &&
        (["portA", "portB", "ddrA", "ddrB", "controlA", "controlB", "interruptStatus"] as const).every((name) => isInteger(chip[name], 0, 0xff)) &&
        isInteger(chip.interruptMask, 0, 0x1f) &&
        (["timerA", "timerB", "latchA", "latchB"] as const).every((name) => isInteger(chip[name], 0, 0xffff)) &&
        isObject(chip.tod) &&
        isInteger(chip.tod.hours, 0, 23) &&
        isInteger(chip.tod.minutes, 0, 99) &&
        isInteger(chip.tod.seconds, 0, 99) &&
        isInteger(chip.tod.tenths, 0, 15),
    ),
  sid: (value) => {
    const voices = value.voices;
    return (
      Array.isArray(voices) &&
      voices.length === 3 &&
      voices.every(
        (voice) =>
          isObject(voice) &&
          isInteger(voice.index, 1, 3) &&
          isInteger(voice.frequency, 0, 0xffff) &&
          isInteger(voice.pulseWidth, 0, 0x0fff) &&
          (["control", "attackDecay", "sustainRelease"] as const).every((name) => isInteger(voice[name], 0, 0xff)),
      ) &&
      isObject(value.filter) &&
      isInteger(value.filter.cutoff, 0, 0x7ff) &&
      isInteger(value.filter.resonance, 0, 15) &&
      isInteger(value.filter.routing, 0, 15) &&
      isInteger(value.filter.mode, 0, 15) &&
      isInteger(value.volume, 0, 15)
    );
  },
  screenCapture: (value) =>
    isInteger(value.width, 1, 1024) &&
    isInteger(value.height, 1, 1024) &&
    typeof value.png === "string" &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value.png) &&
    (value.baseline === undefined || (typeof value.baseline === "string" && TRANSIENT_NAME.test(value.baseline))),
  joystick: (value) => (value.port === 1 || value.port === 2) && isOneOf(JOYSTICK_DIRECTIONS, value.direction) && typeof value.fire === "boolean",
  warp: (value) => typeof value.enabled === "boolean",
  window: (value) => typeof value.window === "boolean" && isOneOf(RUN_STATES, value.state) && Array.isArray(value.notCarried) && value.notCarried.every((entry) => typeof entry === "string"),
};

/** Validates a reply result on the client. Throws ProtocolError on a malformed result. */
export function validateViceResult<O extends ViceOperation>(op: O, value: unknown): ViceOperations[O]["result"] {
  if (!isObject(value)) throw new ProtocolError(`${op} result is not an object`);
  if (!RESULTS[op](value)) throw new ProtocolError(`${op} result is malformed`);
  return value as unknown as ViceOperations[O]["result"];
}

/** The hits of a trace reply from its attachment: a JSON list of `count` hits. Throws ProtocolError. */
export function traceHitsFromAttachment(attachments: readonly Buffer[], count: number): TraceHit[] {
  const [bytes] = attachments;
  if (bytes === undefined || attachments.length !== 1) throw new ProtocolError("trace reply has no hits attachment");
  let hits: unknown;
  try {
    hits = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ProtocolError("trace hits are not valid JSON");
  }
  const ok =
    Array.isArray(hits) &&
    hits.length === count &&
    hits.every(
      (hit) =>
        isObject(hit) &&
        isInteger(hit.point, 0, MAX_TRACE_POINTS - 1) &&
        isInteger(hit.pc, 0, 0xffff) &&
        isHexData(hit.bytes) &&
        typeof hit.text === "string" &&
        (["a", "x", "y", "sp"] as const).every((name) => isInteger(hit[name], 0, 0xff)) &&
        isInteger(hit.frame, 0, MAX_TRACE_FRAMES) &&
        isInteger(hit.rasterLine, 0, 511) &&
        isInteger(hit.rasterCycle, 0, 127) &&
        (hit.address === undefined || isInteger(hit.address, 0, 0xffff)) &&
        (hit.value === undefined || isInteger(hit.value, 0, 0xff)),
    );
  if (!ok) throw new ProtocolError("trace hits are malformed");
  return hits as TraceHit[];
}
