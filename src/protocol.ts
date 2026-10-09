// The private Host Runtime wire contract, shared by src/host and src/host-client.
// Nothing here is LLM-facing: MCP and skill results never show these shapes.

import { textToPetsciiName, type BasicHandoff } from "./c64.ts";

/** Private Host Runtime protocol identifier. */
export const HOST_PROTOCOL_ID = "c64-re-tools-host" as const;
/** Bumped on any incompatible change; a mismatch fails the handshake. */
export const HOST_PROTOCOL_VERSION = 2;
/** After ready, the client pings this often, on every connection. */
export const HEARTBEAT_INTERVAL_MS = 10_000;
/** Either side closes a connection that has sent nothing for this long. */
export const HEARTBEAT_TIMEOUT_MS = 30_000;
/** The Host Runtime listens on 127.0.0.1 at this port by default. */
export const DEFAULT_HOST_PORT = 6464;
/** Largest frame body either side accepts. */
export const MAX_FRAME_BYTES = 1024 * 1024;

// ---------------------------------------------------------------------------
// Shared vocabulary

export const ERROR_CODES = [
  "invalid-input",
  "machine-running",
  "machine-unavailable",
  "machine-state-lost",
  "not-found",
  "media-error",
  "limit-exceeded",
  "unsupported-in-space",
  "installation-incomplete",
  "operation-failed",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** An actionable failure carried on the wire and shown to the LLM unchanged. */
export interface WireError {
  code: ErrorCode;
  message: string;
}

export const ROLES = ["vice-session", "tool"] as const;
export type Role = (typeof ROLES)[number];

export const VIDEO_STANDARDS = ["pal", "ntsc"] as const;
export type VideoStandard = (typeof VIDEO_STANDARDS)[number];

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
  | { action: "add"; address: number; space: Space; condition?: Condition }
  | { action: "remove" | "enable" | "disable"; id: number }
  | { action: "list" };

export type WatchpointParams =
  | { action: "add"; address: number; size: number; access: WatchAccess; space: Space; condition?: Condition }
  | { action: "remove" | "enable" | "disable"; id: number }
  | { action: "list" };

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
  controlA: number;
  controlB: number;
  interruptStatus: number;
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

export interface MemmapRange {
  start: number;
  end: number;
  execute: boolean;
  read: boolean;
  write: boolean;
}

// Screen baselines and snapshots

/** 1-64 letters, digits, dots, underscores or hyphens. */
export const TRANSIENT_NAME = /^[A-Za-z0-9._-]{1,64}$/;
export const MAX_BASELINES = 64;
export const MAX_SNAPSHOTS = 64;

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenComparison {
  match: boolean;
  mismatchingPixels: number;
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
}

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
}

export interface ExecutionResult {
  state: RunState;
  pc?: number;
  executed?: number;
  advancedFrames?: number;
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
  pc: number;
}

export interface ViceOperations {
  status: { params: Record<string, never>; result: MachineStatus };
  memoryRead: { params: MemoryReadParams; result: MemoryReadResult };
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
  /** Attachment: the program or image bytes; `type` is the file's extension. */
  autostart: { params: { type: string; index: number; run: boolean }; result: { state: RunState } };
  /** Attachment: the disk image bytes; `type` is the file's extension. */
  diskAttach: { params: { type: string }; result: { attached: boolean } };
  /** pc is the reset vector when run is false: the CPU stops there. */
  reset: { params: { mode: ResetMode; run: boolean }; result: { state: RunState; pc?: number } };
  /** `data`: PETSCII bytes as lowercase hex. */
  keyboard: { params: { data: string }; result: { queuedBytes: number } };
  joystick: { params: JoystickState; result: JoystickState };
  breakpoint: { params: BreakpointParams; result: Breakpoint | { breakpoints: Breakpoint[] } };
  watchpoint: { params: WatchpointParams; result: Watchpoint | { watchpoints: Watchpoint[] } };
  cpuHistory: { params: { limit: number; space: Space }; result: { entries: HistoryEntry[] } };
  backtrace: { params: { depth: number; space: Space }; result: { frames: BacktraceFrame[] } };
  /** `cycles` is a decimal string. */
  timing: { params: { action: (typeof TIMING_ACTIONS)[number] }; result: { started: boolean } | { cycles: string } };
  profile: { params: { limit: number }; result: { entries: ProfileEntry[] } };
  memmap: {
    params: { action: "read"; start: number; end: number; maxRanges: number } | { action: "clear" };
    result: { ranges: MemmapRange[] } | { cleared: boolean };
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
    params: { action: "save" | "restore" | "discard"; name: string } | { action: "list" };
    result: { saved: boolean; name: string } | { restored: boolean; state: RunState } | { snapshots: string[] } | { discarded: boolean };
  };
  screenDiscard: { params: { baseline: string }; result: { discarded: boolean } };
  warp: { params: { enabled: boolean }; result: { enabled: boolean } };
  window: { params: { action: (typeof WINDOW_ACTIONS)[number] }; result: WindowResult };
}
export type ViceOperation = keyof ViceOperations;
export const VICE_OPERATIONS = [
  "status",
  "memoryRead",
  "registersGet",
  "memoryWrite",
  "memorySearch",
  "memoryCompare",
  "disassemble",
  "registersSet",
  "execution",
  "runUntil",
  "programLoad",
  "autostart",
  "diskAttach",
  "reset",
  "keyboard",
  "joystick",
  "breakpoint",
  "watchpoint",
  "screenCapture",
  "screenCompare",
  "screenBaselines",
  "screenDiscard",
  "snapshot",
  "cpuHistory",
  "backtrace",
  "timing",
  "profile",
  "memmap",
  "vicii",
  "sprites",
  "cia",
  "sid",
  "observe",
  "warp",
  "window",
] as const satisfies readonly ViceOperation[];

/** How many attachments each operation takes. */
export function attachmentCount(op: ViceOperation): number {
  return op === "programLoad" || op === "autostart" || op === "diskAttach" ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Native-tool operations. Short-lived requests on "tool" connections; they
// never touch an emulator or knowledge.db.

/** A transferred source tree: relative POSIX paths, one attachment per file in this order. */
export type SourceTree = Array<{ path: string; size: number }>;
export const MAX_TREE_FILES = 4096;

export const DISK_IMAGE_TYPES = ["d64", "d71", "d81", "g64"] as const;
export type DiskImageType = (typeof DISK_IMAGE_TYPES)[number];
export const DISK_ACTIONS = ["directory", "bam", "entry", "chain", "read"] as const;
export type DiskAction = (typeof DISK_ACTIONS)[number];
export const CBM_FILE_TYPES = ["del", "seq", "prg", "usr", "rel", "unknown"] as const;
export type CbmFileType = (typeof CBM_FILE_TYPES)[number];

/** c1541.inspect. The image bytes are the request's one attachment. */
export interface C1541Params {
  action: DiskAction;
  imageType: DiskImageType;
  /** entry, chain and read only: the file name as petsciiNameToText shows it. */
  name?: string;
}

export interface DiskFile {
  name: string;
  type: CbmFileType;
  blocks: number;
  closed: boolean;
  locked: boolean;
}

export interface DiskSector {
  track: number;
  sector: number;
}

export type C1541Result =
  | { action: "directory"; diskName: string; diskId: string; dosType: string; freeBlocks: number; entries: DiskFile[] }
  | { action: "bam"; tracks: Array<{ track: number; freeSectors: number[]; usedSectors: number[] }> }
  | { action: "entry"; found: false }
  | { action: "entry"; found: true; entry: DiskFile & { startTrack: number; startSector: number } }
  | { action: "chain"; found: false }
  | { action: "chain"; found: true; sectors: DiskSector[] }
  | { action: "read"; found: false }
  /** The file's bytes are the reply's attachment. */
  | { action: "read"; found: true; name: string; bytes: number };

/** petcat.decode takes no fields: the program bytes are the request's one attachment. */
export type PetcatParams = Record<string, never>;

/** A machine-code handoff: SYS with a constant address, or SYS/USR whose target is computed at run time. */
export type { BasicHandoff };

export type PetcatResult =
  | { decoded: false; reason: string }
  | {
      decoded: true;
      loadAddress: number;
      /** The address after the BASIC end marker; any bytes from here on are no BASIC. */
      basicEnd: number;
      listing: string;
      lines: Array<{ number: number; text: string }>;
      handoffs: BasicHandoff[];
    };

/** One native tool on the host, as host.status found and ran it. */
export interface ToolStatus {
  name: string;
  found: boolean;
  /** Where it is, when found. */
  path?: string;
  /** Its version text, when it ran. */
  version?: string;
  runs: boolean;
  /** What is wrong and what to do, when it is missing or does not run. */
  problem?: string;
}

export interface ToolOperations {
  "host.status": { params: Record<string, never>; result: { tools: ToolStatus[] } };
  "c1541.inspect": { params: C1541Params; result: C1541Result };
  "petcat.decode": { params: PetcatParams; result: PetcatResult };
}
export type ToolOperation = keyof ToolOperations;
export const TOOL_OPERATIONS = ["host.status", "c1541.inspect", "petcat.decode"] as const satisfies readonly ToolOperation[];

// ---------------------------------------------------------------------------
// Messages

export interface Hello {
  type: "hello";
  protocol: string;
  version: number;
  role: Role;
  /** vice-session only; fixed for the session. */
  videoStandard?: VideoStandard;
  /** The shared secret (C64RT_HOST_TOKEN) for a host that listens beyond loopback. */
  token?: string;
}

/** Longest accepted shared token. */
const MAX_TOKEN_LENGTH = 256;

export interface Ready {
  type: "ready";
}

/** Sent instead of `ready` when the handshake fails; the host then closes. */
export interface HandshakeError {
  type: "error";
  error: WireError;
}

export interface Request<O extends ViceOperation | ToolOperation = ViceOperation | ToolOperation> {
  type: "request";
  id: number;
  op: O;
  params: O extends ViceOperation ? ViceOperations[O]["params"] : O extends ToolOperation ? ToolOperations[O]["params"] : never;
}

export type Reply =
  | { type: "reply"; id: number; result: unknown }
  | { type: "reply"; id: number; error: WireError };

/** Heartbeat: the client pings after ready, the host answers pong. Neither touches the session. */
export interface Ping {
  type: "ping";
}
export interface Pong {
  type: "pong";
}

export type ClientMessage = Hello | Request | Ping;

/** A request as the host receives it: the operation is not checked yet, so the host answers an unknown one with invalid-input. */
export interface ReceivedRequest {
  type: "request";
  id: number;
  op: string;
  params: Fields;
}
export type ReceivedClientMessage = Hello | ReceivedRequest | Ping;
export type HostMessage = Ready | HandshakeError | Reply | Pong;

// ---------------------------------------------------------------------------
// Validation. A ProtocolError means the peer broke the contract; the receiver
// closes the connection. Bad operation parameters are a WireError instead.

export class ProtocolError extends Error {
  override name = "ProtocolError";
}

/** Thrown by parameter/result validators; carries the wire code to answer with. */
export class WireFailure extends Error implements WireError {
  override name = "WireFailure";
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }

  toWire(): WireError {
    return { code: this.code, message: this.message };
  }
}

/** The message of a caught value, which may not be an Error. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type Fields = Record<string, unknown>;

export function isObject(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when `value` is one of `values`; narrows a string to the union. */
export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function isInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isRequestId(value: unknown): value is number {
  return isInteger(value, 0, 0xffff_ffff);
}

function isWireError(value: unknown): value is WireError {
  return isObject(value) && isOneOf(ERROR_CODES, value.code) && typeof value.message === "string";
}

/** Validates a message the host received. Throws ProtocolError on any contract break. */
export function parseClientMessage(value: unknown): ReceivedClientMessage {
  if (!isObject(value)) throw new ProtocolError("message is not an object");
  if (value.type === "hello") {
    // protocol/version are checked by the handshake, which answers a mismatch
    // with installation-incomplete; here they only need their JSON types.
    if (typeof value.protocol !== "string" || typeof value.version !== "number") {
      throw new ProtocolError("hello lacks protocol or version");
    }
    if (!isOneOf(ROLES, value.role)) throw new ProtocolError("hello has an unknown role");
    if (value.videoStandard !== undefined && !isOneOf(VIDEO_STANDARDS, value.videoStandard)) {
      throw new ProtocolError("hello has an unknown video standard");
    }
    if (value.token !== undefined && (typeof value.token !== "string" || value.token.length > MAX_TOKEN_LENGTH)) {
      throw new ProtocolError("hello has a malformed token");
    }
    const hello: Hello = { type: "hello", protocol: value.protocol, version: value.version, role: value.role };
    if (value.videoStandard !== undefined) hello.videoStandard = value.videoStandard;
    if (value.token !== undefined) hello.token = value.token;
    return hello;
  }
  if (value.type === "request") {
    if (!isRequestId(value.id)) throw new ProtocolError("request id is not a 32-bit unsigned integer");
    if (typeof value.op !== "string") throw new ProtocolError("request op is not a string");
    if (!isObject(value.params)) throw new ProtocolError("request params is not an object");
    return { type: "request", id: value.id, op: value.op, params: value.params };
  }
  if (value.type === "ping") return { type: "ping" };
  throw new ProtocolError("unknown message type");
}

/** Validates a message the client received. Throws ProtocolError on any contract break. */
export function parseHostMessage(value: unknown): HostMessage {
  if (!isObject(value)) throw new ProtocolError("message is not an object");
  if (value.type === "ready") return { type: "ready" };
  if (value.type === "pong") return { type: "pong" };
  if (value.type === "error") {
    if (!isWireError(value.error)) throw new ProtocolError("handshake error is malformed");
    return { type: "error", error: { code: value.error.code, message: value.error.message } };
  }
  if (value.type === "reply") {
    if (!isRequestId(value.id)) throw new ProtocolError("reply id is not a 32-bit unsigned integer");
    if ("error" in value) {
      if (!isWireError(value.error)) throw new ProtocolError("reply error is malformed");
      return { type: "reply", id: value.id, error: { code: value.error.code, message: value.error.message } };
    }
    if (!("result" in value)) throw new ProtocolError("reply has neither result nor error");
    return { type: "reply", id: value.id, result: value.result };
  }
  throw new ProtocolError("unknown message type");
}

/** Checks a hello against this build's protocol. Returns the failure to send, or undefined. */
export function checkHello(hello: Hello): WireError | undefined {
  if (hello.protocol !== HOST_PROTOCOL_ID || hello.version !== HOST_PROTOCOL_VERSION) {
    return {
      code: "installation-incomplete",
      message:
        "The c64-re-tools host runtime and this client come from different installations. " +
        "Install the same c64-re-tools release for both and restart the host runtime.",
    };
  }
  return undefined;
}

function invalid(message: string): never {
  throw new WireFailure("invalid-input", message);
}

/** Refuses a field that is not in `allowed`, the same way for every operation. */
function onlyFields(value: Fields, allowed: readonly string[], where?: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) invalid(where === undefined ? `unknown field: ${key}` : `unknown field in ${where}: ${key}`);
  }
}

/** Validates request parameters on the host. Throws WireFailure(invalid-input). */
export function validateViceParams<O extends ViceOperation>(op: O, params: unknown): ViceOperations[O]["params"] {
  if (!isObject(params)) invalid("parameters must be an object");
  switch (op) {
    case "status":
    case "vicii":
    case "sid":
    case "screenBaselines":
      onlyFields(params, []);
      return {} as ViceOperations[O]["params"];
    case "screenCapture": {
      onlyFields(params, ["baseline"]);
      if (params.baseline === undefined) return {} as ViceOperations[O]["params"];
      return { baseline: validName(params.baseline, "baseline") } as ViceOperations[O]["params"];
    }
    case "screenDiscard":
      onlyFields(params, ["baseline"]);
      return { baseline: validName(params.baseline, "baseline") } as ViceOperations[O]["params"];
    case "snapshot": {
      onlyFields(params, params.action === "list" ? ["action"] : ["action", "name"]);
      if (params.action === "list") return { action: "list" } as ViceOperations[O]["params"];
      if (params.action !== "save" && params.action !== "restore" && params.action !== "discard") {
        invalid("action must be save, restore, list or discard");
      }
      return { action: params.action, name: validName(params.name, "name") } as ViceOperations[O]["params"];
    }
    case "screenCompare": {
      onlyFields(params, ["baseline", "maxMismatchRatio", "mask", "includeDiff"]);
      const ratio = params.maxMismatchRatio;
      if (typeof ratio !== "number" || !(ratio >= 0 && ratio <= 1)) invalid("maxMismatchRatio must be a number from 0 to 1");
      if (!Array.isArray(params.mask) || params.mask.length > 64) invalid("mask must be a list of at most 64 rectangles");
      const mask = params.mask.map((rectangle): Rectangle => {
        if (!isObject(rectangle)) invalid("each mask entry must be a rectangle");
        onlyFields(rectangle, ["x", "y", "width", "height"], "a mask rectangle");
        const ok = isInteger(rectangle.x, 0, 4095) && isInteger(rectangle.y, 0, 4095) && isInteger(rectangle.width, 1, 4096) && isInteger(rectangle.height, 1, 4096);
        if (!ok) invalid("a mask rectangle needs integer x, y, width and height, with width and height at least 1");
        return { x: rectangle.x as number, y: rectangle.y as number, width: rectangle.width as number, height: rectangle.height as number };
      });
      if (typeof params.includeDiff !== "boolean") invalid("includeDiff must be true or false");
      return { baseline: validName(params.baseline, "baseline"), maxMismatchRatio: ratio, mask, includeDiff: params.includeDiff } as ViceOperations[O]["params"];
    }
    case "cpuHistory": {
      onlyFields(params, ["limit", "space"]);
      if (!isInteger(params.limit, 1, MAX_HISTORY)) invalid(`limit must be an integer from 1 to ${MAX_HISTORY}`);
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      return { limit: params.limit, space: params.space } as ViceOperations[O]["params"];
    }
    case "backtrace": {
      onlyFields(params, ["depth", "space"]);
      if (!isInteger(params.depth, 1, MAX_BACKTRACE)) invalid(`depth must be an integer from 1 to ${MAX_BACKTRACE}`);
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      return { depth: params.depth, space: params.space } as ViceOperations[O]["params"];
    }
    case "timing": {
      onlyFields(params, ["action"]);
      if (!isOneOf(TIMING_ACTIONS, params.action)) invalid("action must be start or read");
      return { action: params.action } as ViceOperations[O]["params"];
    }
    case "observe": {
      onlyFields(params, ["registers", "memory", "vicii", "sprites", "cia", "sid", "screen", "timing"]);
      const result: ObserveParams = {};
      if (params.registers !== undefined) {
        if (!isOneOf(SPACES, params.registers)) invalid("registers must be c64 or drive8");
        result.registers = params.registers;
      }
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
      return result as ViceOperations[O]["params"];
    }
    case "profile": {
      onlyFields(params, ["limit"]);
      if (!isInteger(params.limit, 1, MAX_PROFILE)) invalid(`limit must be an integer from 1 to ${MAX_PROFILE}`);
      return { limit: params.limit } as ViceOperations[O]["params"];
    }
    case "memmap": {
      onlyFields(params, params.action === "clear" ? ["action"] : ["action", "start", "end", "maxRanges"]);
      if (params.action === "clear") return { action: "clear" } as ViceOperations[O]["params"];
      if (params.action !== "read") invalid("action must be read or clear");
      if (!isInteger(params.start, 0, 0xffff) || !isInteger(params.end, 0, 0xffff)) invalid("start and end must be integers from 0 to 65535");
      if (params.end < params.start) invalid("end must not be before start");
      if (!isInteger(params.maxRanges, 1, MAX_MEMMAP_RANGES)) invalid(`maxRanges must be an integer from 1 to ${MAX_MEMMAP_RANGES}`);
      return { action: "read", start: params.start, end: params.end, maxRanges: params.maxRanges } as ViceOperations[O]["params"];
    }
    case "sprites": {
      onlyFields(params, ["indexes"]);
      const indexes = params.indexes;
      if (!Array.isArray(indexes) || !indexes.every((index) => isInteger(index, 0, 7))) invalid("sprites holds sprite numbers 0 to 7");
      if (new Set(indexes).size !== indexes.length) invalid("sprites holds each sprite number once");
      return { indexes: indexes as number[] } as ViceOperations[O]["params"];
    }
    case "cia": {
      onlyFields(params, ["which"]);
      if (!isOneOf(CIA_SELECTIONS, params.which)) invalid("cia must be 1, 2 or both");
      return { which: params.which } as ViceOperations[O]["params"];
    }
    case "memoryRead": {
      onlyFields(params, ["address", "size", "space", "view"]);
      if (!isInteger(params.address, 0, 0xffff)) invalid("address must be an integer from 0 to 65535");
      if (!isInteger(params.size, 1, MAX_MEMORY_READ)) invalid(`size must be an integer from 1 to ${MAX_MEMORY_READ}`);
      if (params.address + params.size > 0x10000) invalid("the range runs past $ffff");
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      if (!isOneOf(MEMORY_VIEWS, params.view)) invalid("view must be cpu or ram");
      const result: MemoryReadParams = { address: params.address, size: params.size, space: params.space, view: params.view };
      return result as ViceOperations[O]["params"];
    }
    case "registersGet": {
      onlyFields(params, ["space"]);
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      return { space: params.space } as ViceOperations[O]["params"];
    }
    case "memoryWrite": {
      onlyFields(params, ["address", "data", "space", "view"]);
      if (!isInteger(params.address, 0, 0xffff)) invalid("address must be an integer from 0 to 65535");
      if (!isHexData(params.data) || params.data.length === 0) invalid("data must be lowercase hex bytes");
      const size = params.data.length / 2;
      if (size > MAX_MEMORY_WRITE) invalid(`data must be at most ${MAX_MEMORY_WRITE} bytes`);
      if (params.address + size > 0x10000) invalid("the range runs past $ffff");
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      if (!isOneOf(MEMORY_VIEWS, params.view)) invalid("view must be cpu or ram");
      const result: MemoryWriteParams = { address: params.address, data: params.data, space: params.space, view: params.view };
      return result as ViceOperations[O]["params"];
    }
    case "memorySearch": {
      onlyFields(params, ["start", "end", "pattern", "space", "view", "maxResults"]);
      if (!isInteger(params.start, 0, 0xffff) || !isInteger(params.end, 0, 0xffff)) invalid("start and end must be integers from 0 to 65535");
      if (params.end < params.start) invalid("end must not be before start");
      const pattern = params.pattern;
      if (!Array.isArray(pattern) || pattern.length === 0 || pattern.length > MAX_SEARCH_PATTERN) {
        invalid(`pattern must have 1 to ${MAX_SEARCH_PATTERN} bytes`);
      }
      if (!pattern.every((token) => token === null || isInteger(token, 0, 0xff))) invalid("pattern holds bytes 0 to 255 or null wildcards");
      if (pattern.every((token) => token === null)) invalid("pattern needs at least one byte that is not a wildcard");
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      if (!isOneOf(MEMORY_VIEWS, params.view)) invalid("view must be cpu or ram");
      if (!isInteger(params.maxResults, 1, MAX_SEARCH_RESULTS)) invalid(`maxResults must be an integer from 1 to ${MAX_SEARCH_RESULTS}`);
      return {
        start: params.start,
        end: params.end,
        pattern: pattern as Array<number | null>,
        space: params.space,
        view: params.view,
        maxResults: params.maxResults,
      } as ViceOperations[O]["params"];
    }
    case "memoryCompare": {
      onlyFields(params, ["left", "right", "size"]);
      if (!isInteger(params.size, 1, MAX_COMPARE_SIZE)) invalid(`size must be an integer from 1 to ${MAX_COMPARE_SIZE}`);
      const location = (value: unknown, name: string): MemoryLocation => {
        if (!isObject(value)) invalid(`${name} must be an object`);
        onlyFields(value, ["address", "space", "view"], name);
        if (!isInteger(value.address, 0, 0xffff)) invalid(`${name} address must be an integer from 0 to 65535`);
        if ((value.address as number) + (params.size as number) > 0x10000) invalid(`the ${name} range runs past $ffff`);
        if (!isOneOf(SPACES, value.space)) invalid(`${name} space must be c64 or drive8`);
        if (!isOneOf(MEMORY_VIEWS, value.view)) invalid(`${name} view must be cpu or ram`);
        return { address: value.address as number, space: value.space, view: value.view };
      };
      return { left: location(params.left, "left"), right: location(params.right, "right"), size: params.size } as ViceOperations[O]["params"];
    }
    case "disassemble": {
      onlyFields(params, ["address", "count", "space", "view"]);
      if (!isInteger(params.address, 0, 0xffff)) invalid("address must be an integer from 0 to 65535");
      if (!isInteger(params.count, 1, MAX_DISASSEMBLE)) invalid(`count must be an integer from 1 to ${MAX_DISASSEMBLE}`);
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      if (!isOneOf(MEMORY_VIEWS, params.view)) invalid("view must be cpu or ram");
      return { address: params.address, count: params.count, space: params.space, view: params.view } as ViceOperations[O]["params"];
    }
    case "registersSet": {
      onlyFields(params, ["space", "values"]);
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      const values = params.values;
      if (!isObject(values)) invalid("values must be an object");
      const known = ["pc", "a", "x", "y", "sp", "flags"];
      for (const key of Object.keys(values)) if (!known.includes(key)) invalid(`values has an unknown register: ${key}`);
      if (Object.keys(values).length === 0) invalid("values must name at least one register");
      const result: RegisterValues = {};
      if (values.pc !== undefined) {
        if (!isInteger(values.pc, 0, 0xffff)) invalid("pc must be an integer from 0 to 65535");
        result.pc = values.pc;
      }
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
          if (!["n", "v", "b", "d", "i", "z", "c"].includes(flag)) invalid(`flags has an unknown flag: ${flag}`);
          if (typeof value !== "boolean") invalid(`flag ${flag} must be true or false`);
          set[flag as keyof CpuFlags] = value;
        }
        result.flags = set;
      }
      return { space: params.space, values: result } as ViceOperations[O]["params"];
    }
    case "execution": {
      onlyFields(params, ["action", "space", "count"]);
      if (!isOneOf(EXECUTION_ACTIONS, params.action)) invalid(`action must be one of ${EXECUTION_ACTIONS.join(", ")}`);
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      const counted = params.action === "step" || params.action === "next" || params.action === "advance-frames";
      if (params.count !== undefined) {
        if (!counted) invalid(`count is not used with action ${params.action}`);
        if (!isInteger(params.count, 1, MAX_EXECUTION_COUNT)) invalid(`count must be an integer from 1 to ${MAX_EXECUTION_COUNT}`);
      } else if (params.action === "advance-frames") {
        invalid("advance-frames needs count, the number of frames");
      }
      const result: ExecutionParams = { action: params.action, space: params.space };
      if (counted) result.count = (params.count as number | undefined) ?? 1;
      return result as ViceOperations[O]["params"];
    }
    case "runUntil": {
      onlyFields(params, ["target", "timeoutFrames"]);
      if (!isInteger(params.timeoutFrames, 1, MAX_TIMEOUT_FRAMES)) invalid(`timeoutFrames must be an integer from 1 to ${MAX_TIMEOUT_FRAMES}`);
      return { target: validateRunTarget(params.target), timeoutFrames: params.timeoutFrames } as ViceOperations[O]["params"];
    }
    case "programLoad": {
      onlyFields(params, ["address"]);
      if (params.address !== undefined && !isInteger(params.address, 0, 0xffff)) invalid("address must be an integer from 0 to 65535");
      return (params.address === undefined ? {} : { address: params.address }) as ViceOperations[O]["params"];
    }
    case "autostart": {
      onlyFields(params, ["type", "index", "run"]);
      if (!isOneOf(AUTOSTART_TYPES, params.type)) invalid(`the file must be one of: ${AUTOSTART_TYPES.map((type) => `.${type}`).join(", ")}`);
      if (!isInteger(params.index, 0, 0xffff)) invalid("index must be an integer from 0 to 65535");
      if (typeof params.run !== "boolean") invalid("run must be true or false");
      return { type: params.type, index: params.index, run: params.run } as ViceOperations[O]["params"];
    }
    case "diskAttach": {
      onlyFields(params, ["type"]);
      if (!isOneOf(DISK_TYPES, params.type)) invalid(`the disk image must be one of: ${DISK_TYPES.map((type) => `.${type}`).join(", ")}`);
      return { type: params.type } as ViceOperations[O]["params"];
    }
    case "keyboard": {
      onlyFields(params, ["data"]);
      if (!isHexData(params.data) || params.data.length === 0) invalid("data must be PETSCII bytes as lowercase hex");
      if (params.data.length / 2 > MAX_KEYBOARD_BYTES) invalid(`at most ${MAX_KEYBOARD_BYTES} bytes can be queued at once`);
      // VICE feeds a C string, so a zero byte would end the text early.
      if (/^(?:..)*?00/.test(params.data)) invalid("PETSCII byte 0 cannot be typed");
      return { data: params.data } as ViceOperations[O]["params"];
    }
    case "joystick": {
      onlyFields(params, ["port", "direction", "fire"]);
      if (params.port !== 1 && params.port !== 2) invalid("port must be 1 or 2");
      if (!isOneOf(JOYSTICK_DIRECTIONS, params.direction)) invalid(`direction must be one of ${JOYSTICK_DIRECTIONS.join(", ")}`);
      if (typeof params.fire !== "boolean") invalid("fire must be true or false");
      return { port: params.port, direction: params.direction, fire: params.fire } as ViceOperations[O]["params"];
    }
    case "breakpoint":
    case "watchpoint": {
      if (!isOneOf(CHECKPOINT_ACTIONS, params.action)) invalid(`action must be one of ${CHECKPOINT_ACTIONS.join(", ")}`);
      if (params.action === "list") {
        onlyFields(params, ["action"]);
        return { action: "list" } as ViceOperations[O]["params"];
      }
      if (params.action !== "add") {
        onlyFields(params, ["action", "id"]);
        if (!isInteger(params.id, 1, 0xffff_ffff)) invalid("id must be a positive integer");
        return { action: params.action, id: params.id } as ViceOperations[O]["params"];
      }
      onlyFields(params, op === "watchpoint" ? ["action", "address", "space", "size", "access", "condition"] : ["action", "address", "space", "condition"]);
      if (!isInteger(params.address, 0, 0xffff)) invalid("address must be an integer from 0 to 65535");
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      const added: Record<string, unknown> = { action: "add", address: params.address, space: params.space };
      if (op === "watchpoint") {
        if (!isInteger(params.size, 1, MAX_WATCH_SIZE)) invalid(`size must be an integer from 1 to ${MAX_WATCH_SIZE}`);
        if (params.address + params.size > 0x10000) invalid("the range runs past $ffff");
        if (!isOneOf(WATCH_ACCESS, params.access)) invalid("access must be read, write or read-write");
        added.size = params.size;
        added.access = params.access;
      }
      if (params.condition !== undefined) added.condition = validateCondition(params.condition);
      return added as ViceOperations[O]["params"];
    }
    case "reset": {
      onlyFields(params, ["mode", "run"]);
      if (!isOneOf(RESET_MODES, params.mode)) invalid("mode must be soft or hard");
      if (typeof params.run !== "boolean") invalid("run must be true or false");
      return { mode: params.mode, run: params.run } as ViceOperations[O]["params"];
    }
    case "warp": {
      onlyFields(params, ["enabled"]);
      if (typeof params.enabled !== "boolean") invalid("enabled must be true or false");
      return { enabled: params.enabled } as ViceOperations[O]["params"];
    }
    case "window": {
      onlyFields(params, ["action"]);
      if (!isOneOf(WINDOW_ACTIONS, params.action)) invalid("action must be open or close");
      return { action: params.action } as ViceOperations[O]["params"];
    }
  }
  return invalid(`unknown operation: ${String(op)}`);
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
      if (!isInteger(value.address, 0, 0xffff)) invalid("condition address must be an integer from 0 to 65535");
      if (!isOneOf(COMPARISONS, value.operator)) invalid(`condition operator must be one of ${COMPARISONS.join(", ")}`);
      if (!isOneOf(SPACES, value.space)) invalid("condition space must be c64 or drive8");
      if (!isOneOf(MEMORY_VIEWS, value.view)) invalid("condition view must be cpu or ram");
      return {
        kind: "memory",
        address: value.address,
        operator: value.operator,
        value: byte(value.value, "value"),
        space: value.space,
        view: value.view,
      };
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
      if (!isInteger(value.address, 0, 0xffff)) invalid("target address must be an integer from 0 to 65535");
      if (!isOneOf(SPACES, value.space)) invalid("target space must be c64 or drive8");
      const target: RunTarget = { kind: "address", address: value.address, space: value.space };
      if (value.condition !== undefined) target.condition = validateCondition(value.condition);
      return target;
    }
    case "memory": {
      onlyFields(value, ["kind", "address", "operator", "value", "space", "view"], "the target");
      const { kind: _kind, ...condition } = validateCondition({ ...value, kind: "memory" }) as Extract<Condition, { kind: "memory" }>;
      return { kind: "memory", ...condition };
    }
    case "raster": {
      onlyFields(value, ["kind", "line", "cycle"], "the target");
      const raster = validateCondition(value) as Extract<Condition, { kind: "raster" }>;
      return raster;
    }
  }
  return invalid("target kind must be address, memory or raster");
}

function isBreakpoint(value: unknown): value is Breakpoint {
  return (
    isObject(value) &&
    isInteger(value.id, 1, 0xffff_ffff) &&
    isInteger(value.address, 0, 0xffff) &&
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

const RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[^\0\\]+$/;

/** A relative POSIX path with no empty, "." or ".." segment and no backslash. */
export function isRelativePath(value: unknown): value is string {
  return typeof value === "string" && value.length <= 1024 && RELATIVE_PATH.test(value) && !value.includes("//") && !value.endsWith("/");
}

/** Validates a transferred source tree against its attachments. Throws WireFailure(invalid-input). */
export function validateSourceTree(value: unknown, attachments: readonly Uint8Array[]): SourceTree {
  if (!Array.isArray(value) || value.length > MAX_TREE_FILES) invalid(`files must list at most ${MAX_TREE_FILES} files`);
  if (value.length !== attachments.length) invalid("each listed file needs exactly one attachment");
  const seen = new Set<string>();
  return value.map((entry, index) => {
    if (!isObject(entry) || !isRelativePath(entry.path)) invalid("each file needs a relative path inside the source root");
    if (seen.has(entry.path)) invalid(`the file ${entry.path} is listed twice`);
    seen.add(entry.path);
    if (entry.size !== attachments[index]!.length) invalid(`the size of ${entry.path} does not match its bytes`);
    return { path: entry.path, size: entry.size as number };
  });
}

/** Refuses anything but exactly one attachment with at least one byte, named by what it must hold. */
function oneFile(attachments: readonly Uint8Array[], what: string): void {
  if (attachments.length !== 1 || attachments[0]!.length === 0) invalid(`${what} must be the one attachment, and it must not be empty`);
}

/** Validates tool request parameters on the host. Throws WireFailure(invalid-input). */
export function validateToolParams<O extends ToolOperation>(op: O, params: unknown, attachments: readonly Uint8Array[]): ToolOperations[O]["params"] {
  if (!isObject(params)) invalid("parameters must be an object");
  switch (op) {
    case "c1541.inspect": {
      onlyFields(params, ["action", "imageType", "name"]);
      if (!isOneOf(DISK_ACTIONS, params.action)) invalid(`action must be one of ${DISK_ACTIONS.join(", ")}`);
      if (!isOneOf(DISK_IMAGE_TYPES, params.imageType)) invalid(`imageType must be one of ${DISK_IMAGE_TYPES.join(", ")}`);
      oneFile(attachments, "the disk image");
      const result: C1541Params = { action: params.action, imageType: params.imageType };
      const named = params.action === "entry" || params.action === "chain" || params.action === "read";
      if (!named) {
        if (params.name !== undefined) invalid(`action ${params.action} takes no name`);
      } else {
        if (typeof params.name !== "string" || params.name.length === 0) invalid(`action ${params.action} needs a file name`);
        let bytes: Uint8Array;
        try {
          bytes = textToPetsciiName(params.name);
        } catch (error) {
          return invalid(`name: ${(error as Error).message}`);
        }
        if (bytes.length > 16) invalid("a CBM file name has at most 16 characters");
        result.name = params.name;
      }
      return result as ToolOperations[O]["params"];
    }
    case "petcat.decode": {
      onlyFields(params, []);
      oneFile(attachments, "the program");
      return {} as ToolOperations[O]["params"];
    }
    case "host.status":
      onlyFields(params, []);
      if (attachments.length !== 0) invalid("host.status takes no attachment");
      return {} as ToolOperations[O]["params"];
  }
  return invalid(`unknown tool operation: ${String(op)}`);
}

/** Validates a tool result on the client. Throws ProtocolError. */
export function validateToolResult<O extends ToolOperation>(op: O, value: unknown, attachments: readonly Uint8Array[]): ToolOperations[O]["result"] {
  if (!isObject(value)) throw new ProtocolError(`${op} result is not an object`);
  switch (op) {
    case "c1541.inspect": {
      if (!isC1541Result(value, attachments)) throw new ProtocolError("c1541.inspect result is malformed");
      return value as unknown as ToolOperations[O]["result"];
    }
    case "petcat.decode": {
      if (!isPetcatResult(value) || attachments.length !== 0) throw new ProtocolError("petcat.decode result is malformed");
      return value as unknown as ToolOperations[O]["result"];
    }
    case "host.status": {
      const tools = value.tools;
      const isStatus = (tool: unknown) =>
        isObject(tool) &&
        typeof tool.name === "string" &&
        typeof tool.found === "boolean" &&
        typeof tool.runs === "boolean" &&
        [tool.path, tool.version, tool.problem].every((field) => field === undefined || typeof field === "string");
      if (!Array.isArray(tools) || !tools.every(isStatus) || attachments.length !== 0) throw new ProtocolError("host.status result is malformed");
      return value as unknown as ToolOperations[O]["result"];
    }
  }
  throw new ProtocolError(`unknown tool operation: ${String(op)}`);
}

const isTrackSector = (value: unknown): boolean => isObject(value) && isInteger(value.track, 0, 255) && isInteger(value.sector, 0, 255);
const isSectorList = (value: unknown): boolean => Array.isArray(value) && value.every((item) => isInteger(item, 0, 255));

function isDiskFile(value: unknown): value is DiskFile {
  return (
    isObject(value) &&
    typeof value.name === "string" &&
    isOneOf(CBM_FILE_TYPES, value.type) &&
    isInteger(value.blocks, 0, 0xffff) &&
    typeof value.closed === "boolean" &&
    typeof value.locked === "boolean"
  );
}

function isC1541Result(value: Fields, attachments: readonly Uint8Array[]): boolean {
  const carries = value.action === "read" && value.found === true ? 1 : 0;
  if (attachments.length !== carries) return false;
  switch (value.action) {
    case "directory":
      return (
        typeof value.diskName === "string" &&
        typeof value.diskId === "string" &&
        typeof value.dosType === "string" &&
        isInteger(value.freeBlocks, 0, 0xffff) &&
        Array.isArray(value.entries) &&
        value.entries.every(isDiskFile)
      );
    case "bam":
      return (
        Array.isArray(value.tracks) &&
        value.tracks.every((track) => isObject(track) && isInteger(track.track, 1, 255) && isSectorList(track.freeSectors) && isSectorList(track.usedSectors))
      );
    case "entry":
      return (
        value.found === false ||
        (value.found === true && isObject(value.entry) && isDiskFile(value.entry) && isTrackSector({ track: value.entry.startTrack, sector: value.entry.startSector }))
      );
    case "chain":
      return value.found === false || (value.found === true && Array.isArray(value.sectors) && value.sectors.every(isTrackSector));
    case "read":
      return value.found === false || (value.found === true && typeof value.name === "string" && value.bytes === attachments[0]!.length);
  }
  return false;
}

function isPetcatResult(value: Fields): boolean {
  if (value.decoded === false) return typeof value.reason === "string";
  const isLine = (line: unknown) => isObject(line) && isInteger(line.number, 0, 0xffff) && typeof line.text === "string";
  const isHandoff = (handoff: unknown) =>
    isObject(handoff) &&
    isInteger(handoff.line, 0, 0xffff) &&
    ((handoff.kind === "sys" && isInteger(handoff.address, 0, 0xffff) && handoff.computed === undefined) ||
      ((handoff.kind === "sys" || handoff.kind === "usr") && handoff.computed === true && handoff.address === undefined));
  return (
    value.decoded === true &&
    isInteger(value.loadAddress, 0, 0xffff) &&
    isInteger(value.basicEnd, 0, 0x10000) &&
    typeof value.listing === "string" &&
    Array.isArray(value.lines) &&
    value.lines.every(isLine) &&
    Array.isArray(value.handoffs) &&
    value.handoffs.every(isHandoff)
  );
}

function isHexData(value: unknown): value is string {
  return typeof value === "string" && /^(?:[0-9a-f]{2})*$/.test(value);
}

function isFlags(value: unknown): value is CpuFlags {
  return isObject(value) && (["n", "v", "b", "d", "i", "z", "c"] as const).every((flag) => typeof value[flag] === "boolean");
}

/** Validates a reply result on the client. Throws ProtocolError on a malformed result. */
export function validateViceResult<O extends ViceOperation>(op: O, value: unknown): ViceOperations[O]["result"] {
  if (!isObject(value)) throw new ProtocolError(`${op} result is not an object`);
  switch (op) {
    case "status": {
      const ok =
        isOneOf(RUN_STATES, value.state) &&
        isOneOf(VIDEO_STANDARDS, value.videoStandard) &&
        typeof value.warp === "boolean" &&
        typeof value.window === "boolean" &&
        (value.pc === undefined || isInteger(value.pc, 0, 0xffff));
      if (!ok) throw new ProtocolError("status result is malformed");
      break;
    }
    case "memoryRead": {
      if (!isInteger(value.address, 0, 0xffff) || !isHexData(value.data)) {
        throw new ProtocolError("memoryRead result is malformed");
      }
      break;
    }
    case "registersGet": {
      const ok =
        isInteger(value.pc, 0, 0xffff) &&
        (["a", "x", "y", "sp"] as const).every((name) => isInteger(value[name], 0, 0xff)) &&
        isFlags(value.flags);
      if (!ok) throw new ProtocolError("registersGet result is malformed");
      break;
    }
    case "memoryWrite": {
      if (!isInteger(value.address, 0, 0xffff) || !isInteger(value.bytesWritten, 1, MAX_MEMORY_WRITE)) {
        throw new ProtocolError("memoryWrite result is malformed");
      }
      break;
    }
    case "registersSet": {
      return validateViceResult("registersGet", value) as unknown as ViceOperations[O]["result"];
    }
    case "memorySearch": {
      if (!Array.isArray(value.matches) || !value.matches.every((match) => isInteger(match, 0, 0xffff))) {
        throw new ProtocolError("memorySearch result is malformed");
      }
      break;
    }
    case "memoryCompare": {
      const ok =
        typeof value.equal === "boolean" &&
        isInteger(value.differentBytes, 0, MAX_COMPARE_SIZE) &&
        Array.isArray(value.firstDifferences) &&
        value.firstDifferences.length <= MAX_COMPARE_DIFFERENCES &&
        value.firstDifferences.every(
          (difference) =>
            isObject(difference) &&
            isInteger(difference.offset, 0, MAX_COMPARE_SIZE - 1) &&
            isInteger(difference.left, 0, 0xff) &&
            isInteger(difference.right, 0, 0xff),
        );
      if (!ok) throw new ProtocolError("memoryCompare result is malformed");
      break;
    }
    case "disassemble": {
      const ok =
        Array.isArray(value.instructions) &&
        value.instructions.every(
          (instruction) =>
            isObject(instruction) &&
            isInteger(instruction.address, 0, 0xffff) &&
            isHexData(instruction.bytes) &&
            typeof instruction.text === "string",
        );
      if (!ok) throw new ProtocolError("disassemble result is malformed");
      break;
    }
    case "runUntil": {
      const ok =
        typeof value.reached === "boolean" &&
        isOneOf(STOP_REASONS, value.stopReason) &&
        isOneOf(RUN_STATES, value.state) &&
        isInteger(value.pc, 0, 0xffff);
      if (!ok) throw new ProtocolError("runUntil result is malformed");
      break;
    }
    case "execution": {
      const ok =
        isOneOf(RUN_STATES, value.state) &&
        (value.pc === undefined || isInteger(value.pc, 0, 0xffff)) &&
        (value.executed === undefined || isInteger(value.executed, 0, MAX_EXECUTION_COUNT)) &&
        (value.advancedFrames === undefined || isInteger(value.advancedFrames, 0, MAX_EXECUTION_COUNT));
      if (!ok) throw new ProtocolError("execution result is malformed");
      break;
    }
    case "reset":
    case "autostart": {
      if (!isOneOf(RUN_STATES, value.state)) throw new ProtocolError(`${op} result is malformed`);
      if (op === "reset" && value.pc !== undefined && !isInteger(value.pc, 0, 0xffff)) throw new ProtocolError("reset result is malformed");
      break;
    }
    case "programLoad": {
      const ok = isOneOf(RUN_STATES, value.state) && isInteger(value.loadAddress, 0, 0xffff) && isInteger(value.size, 1, 0x10000);
      if (!ok) throw new ProtocolError("programLoad result is malformed");
      break;
    }
    case "diskAttach": {
      if (typeof value.attached !== "boolean") throw new ProtocolError("diskAttach result is malformed");
      break;
    }
    case "keyboard": {
      if (!isInteger(value.queuedBytes, 1, MAX_KEYBOARD_BYTES)) throw new ProtocolError("keyboard result is malformed");
      break;
    }
    case "breakpoint": {
      const ok = Array.isArray(value.breakpoints) ? value.breakpoints.every(isBreakpoint) : isBreakpoint(value);
      if (!ok) throw new ProtocolError("breakpoint result is malformed");
      break;
    }
    case "watchpoint": {
      const ok = Array.isArray(value.watchpoints) ? value.watchpoints.every(isWatchpoint) : isWatchpoint(value);
      if (!ok) throw new ProtocolError("watchpoint result is malformed");
      break;
    }
    case "screenCompare": {
      const bounds = value.bounds;
      const ok =
        typeof value.match === "boolean" &&
        isInteger(value.mismatchingPixels, 0, 1 << 20) &&
        typeof value.mismatchRatio === "number" &&
        value.mismatchRatio >= 0 &&
        value.mismatchRatio <= 1 &&
        (bounds === undefined ||
          (isObject(bounds) && (["x", "y", "width", "height"] as const).every((field) => isInteger(bounds[field], 0, 4096)))) &&
        (value.diffPng === undefined || (typeof value.diffPng === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(value.diffPng)));
      if (!ok) throw new ProtocolError("screenCompare result is malformed");
      break;
    }
    case "screenBaselines": {
      if (!Array.isArray(value.baselines) || !value.baselines.every((name) => typeof name === "string")) {
        throw new ProtocolError("screenBaselines result is malformed");
      }
      break;
    }
    case "screenDiscard": {
      if (value.discarded !== true) throw new ProtocolError("screenDiscard result is malformed");
      break;
    }
    case "snapshot": {
      const ok =
        (value.saved === true && typeof value.name === "string") ||
        (value.restored === true && isOneOf(RUN_STATES, value.state)) ||
        (Array.isArray(value.snapshots) && value.snapshots.every((name) => typeof name === "string")) ||
        value.discarded === true;
      if (!ok) throw new ProtocolError("snapshot result is malformed");
      break;
    }
    case "cpuHistory": {
      const ok =
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
        );
      if (!ok) throw new ProtocolError("cpuHistory result is malformed");
      break;
    }
    case "backtrace": {
      const ok =
        Array.isArray(value.frames) &&
        value.frames.every(
          (frame) =>
            isObject(frame) && isInteger(frame.address, 0, 0xffff) && (frame.returnAddress === undefined || isInteger(frame.returnAddress, 0, 0xffff)),
        );
      if (!ok) throw new ProtocolError("backtrace result is malformed");
      break;
    }
    case "timing": {
      const ok = "cycles" in value ? typeof value.cycles === "string" && /^\d+$/.test(value.cycles) : value.started === true;
      if (!ok) throw new ProtocolError("timing result is malformed");
      break;
    }
    case "profile": {
      const ok =
        Array.isArray(value.entries) &&
        value.entries.every(
          (entry) =>
            isObject(entry) &&
            isInteger(entry.address, 0, 0xffff) &&
            typeof entry.totalCycles === "string" &&
            /^\d+$/.test(entry.totalCycles) &&
            typeof entry.selfCycles === "string" &&
            /^\d+$/.test(entry.selfCycles) &&
            typeof entry.percent === "number",
        );
      if (!ok) throw new ProtocolError("profile result is malformed");
      break;
    }
    case "memmap": {
      const isRange = (range: unknown) =>
        isObject(range) &&
        isInteger(range.start, 0, 0xffff) &&
        isInteger(range.end, 0, 0xffff) &&
        (["execute", "read", "write"] as const).every((flag) => typeof range[flag] === "boolean");
      const ok = Array.isArray(value.ranges) ? value.ranges.every(isRange) : value.cleared === true;
      if (!ok) throw new ProtocolError("memmap result is malformed");
      break;
    }
    case "observe": {
      // Each present section must have the shape of the single-purpose result.
      if (value.registers !== undefined) validateViceResult("registersGet", value.registers);
      if (value.memory !== undefined) {
        const ok = Array.isArray(value.memory) && value.memory.every((range) => isObject(range) && isInteger(range.address, 0, 0xffff) && isHexData(range.data));
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
      break;
    }
    case "vicii": {
      const ok =
        isInteger(value.rasterLine, 0, 511) &&
        isOneOf(VICII_MODES, value.mode) &&
        isInteger(value.screenAddress, 0, 0xffff) &&
        isInteger(value.graphicsAddress, 0, 0xffff) &&
        isInteger(value.scrollX, 0, 7) &&
        isInteger(value.scrollY, 0, 7) &&
        isInteger(value.borderColor, 0, 15) &&
        Array.isArray(value.backgroundColors) &&
        value.backgroundColors.length === 4 &&
        value.backgroundColors.every((color) => isInteger(color, 0, 15));
      if (!ok) throw new ProtocolError("vicii result is malformed");
      break;
    }
    case "sprites": {
      const isSprite = (sprite: unknown) =>
        isObject(sprite) &&
        isInteger(sprite.index, 0, 7) &&
        isInteger(sprite.x, 0, 511) &&
        isInteger(sprite.y, 0, 255) &&
        isInteger(sprite.color, 0, 15) &&
        isInteger(sprite.dataAddress, 0, 0xffff) &&
        (["enabled", "multicolor", "expandX", "expandY", "behindBackground"] as const).every((flag) => typeof sprite[flag] === "boolean");
      if (!Array.isArray(value.sprites) || !value.sprites.every(isSprite)) throw new ProtocolError("sprites result is malformed");
      break;
    }
    case "cia": {
      const isCia = (chip: unknown) =>
        isObject(chip) &&
        (chip.id === 1 || chip.id === 2) &&
        (["portA", "portB", "ddrA", "ddrB", "controlA", "controlB", "interruptStatus"] as const).every((name) => isInteger(chip[name], 0, 0xff)) &&
        isInteger(chip.timerA, 0, 0xffff) &&
        isInteger(chip.timerB, 0, 0xffff) &&
        isObject(chip.tod) &&
        isInteger(chip.tod.hours, 0, 23) &&
        isInteger(chip.tod.minutes, 0, 99) &&
        isInteger(chip.tod.seconds, 0, 99) &&
        isInteger(chip.tod.tenths, 0, 15);
      if (!Array.isArray(value.chips) || !value.chips.every(isCia)) throw new ProtocolError("cia result is malformed");
      break;
    }
    case "sid": {
      const voices = value.voices;
      const ok =
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
        isInteger(value.volume, 0, 15);
      if (!ok) throw new ProtocolError("sid result is malformed");
      break;
    }
    case "screenCapture": {
      const ok =
        isInteger(value.width, 1, 1024) &&
        isInteger(value.height, 1, 1024) &&
        typeof value.png === "string" &&
        /^[A-Za-z0-9+/]+={0,2}$/.test(value.png) &&
        (value.baseline === undefined || (typeof value.baseline === "string" && TRANSIENT_NAME.test(value.baseline)));
      if (!ok) throw new ProtocolError("screenCapture result is malformed");
      break;
    }
    case "joystick": {
      const ok = (value.port === 1 || value.port === 2) && isOneOf(JOYSTICK_DIRECTIONS, value.direction) && typeof value.fire === "boolean";
      if (!ok) throw new ProtocolError("joystick result is malformed");
      break;
    }
    case "warp": {
      if (typeof value.enabled !== "boolean") throw new ProtocolError("warp result is malformed");
      break;
    }
    case "window": {
      const ok =
        typeof value.window === "boolean" &&
        isOneOf(RUN_STATES, value.state) &&
        Array.isArray(value.notCarried) &&
        value.notCarried.every((entry) => typeof entry === "string");
      if (!ok) throw new ProtocolError("window result is malformed");
      break;
    }
    default:
      throw new ProtocolError(`unknown operation: ${String(op)}`);
  }
  return value as unknown as ViceOperations[O]["result"];
}

// ---------------------------------------------------------------------------
// Framing: 4-byte big-endian body length, then the body. A message body
// is UTF-8 JSON. A message may announce binary attachments with an
// `attachments` array of byte sizes; each attachment then follows as raw
// frames of at most MAX_FRAME_BYTES each, in order.

const HEADER_BYTES = 4;
/** Total attachment bytes one message may carry. */
export const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;

function frame(body: Uint8Array): Buffer {
  const header = Buffer.allocUnsafe(HEADER_BYTES);
  header.writeUInt32BE(body.length, 0);
  return Buffer.concat([header, body]);
}

/** Encodes one message and its attachments as one buffer, so writes never interleave. */
export function encodeFrame(message: ClientMessage | HostMessage, attachments: readonly Uint8Array[] = []): Buffer {
  const total = attachments.reduce((sum, attachment) => sum + attachment.length, 0);
  if (total > MAX_ATTACHMENT_BYTES) throw new ProtocolError(`attachments of ${total} bytes exceed ${MAX_ATTACHMENT_BYTES}`);
  const announced = attachments.length === 0 ? message : { ...message, attachments: attachments.map((attachment) => attachment.length) };
  const body = Buffer.from(JSON.stringify(announced), "utf8");
  if (body.length > MAX_FRAME_BYTES) throw new ProtocolError(`frame of ${body.length} bytes exceeds ${MAX_FRAME_BYTES}`);
  const frames = [frame(body)];
  for (const attachment of attachments) {
    for (let offset = 0; offset < attachment.length; offset += MAX_FRAME_BYTES) {
      frames.push(frame(attachment.subarray(offset, offset + MAX_FRAME_BYTES)));
    }
  }
  return Buffer.concat(frames);
}

/** Splits a stream into frame bodies. After a ProtocolError the decoder is unusable. */
class RawFrameDecoder {
  #pending: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): Buffer[] {
    this.#pending = this.#pending.length === 0 ? chunk : Buffer.concat([this.#pending, chunk]);
    const bodies: Buffer[] = [];
    while (this.#pending.length >= HEADER_BYTES) {
      const length = this.#pending.readUInt32BE(0);
      if (length > MAX_FRAME_BYTES) throw new ProtocolError(`frame of ${length} bytes exceeds ${MAX_FRAME_BYTES}`);
      if (this.#pending.length < HEADER_BYTES + length) break;
      bodies.push(Buffer.from(this.#pending.subarray(HEADER_BYTES, HEADER_BYTES + length)));
      this.#pending = this.#pending.subarray(HEADER_BYTES + length);
    }
    return bodies;
  }
}

export interface ReceivedMessage {
  /** The parsed JSON body, with any `attachments` announcement removed. */
  message: unknown;
  attachments: Buffer[];
}

/** Reassembles messages and their attachments from stream chunks. Throws ProtocolError. */
export class MessageReader {
  readonly #frames = new RawFrameDecoder();
  readonly #textDecoder = new TextDecoder("utf-8", { fatal: true });
  #current: { message: unknown; sizes: number[]; done: Buffer[]; parts: Buffer[]; received: number } | undefined;

  push(chunk: Buffer): ReceivedMessage[] {
    const complete: ReceivedMessage[] = [];
    for (const body of this.#frames.push(chunk)) {
      if (this.#current === undefined) this.#start(body);
      else this.#collect(body);
      const finished = this.#finish();
      if (finished !== undefined) complete.push(finished);
    }
    return complete;
  }

  #start(body: Buffer): void {
    let text: string;
    try {
      text = this.#textDecoder.decode(body);
    } catch {
      throw new ProtocolError("frame body is not valid UTF-8");
    }
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      throw new ProtocolError("frame body is not valid JSON");
    }
    let sizes: number[] = [];
    if (isObject(message) && "attachments" in message) {
      const announced = message.attachments;
      if (!Array.isArray(announced) || !announced.every((size) => isInteger(size, 0, MAX_ATTACHMENT_BYTES))) {
        throw new ProtocolError("attachments must be a list of byte sizes");
      }
      if (announced.reduce((sum: number, size: number) => sum + size, 0) > MAX_ATTACHMENT_BYTES) {
        throw new ProtocolError(`attachments exceed ${MAX_ATTACHMENT_BYTES} bytes`);
      }
      sizes = announced as number[];
      const { attachments: _announced, ...rest } = message;
      message = rest;
    }
    this.#current = { message, sizes, done: [], parts: [], received: 0 };
  }

  #collect(body: Buffer): void {
    const current = this.#current!;
    const expected = current.sizes[current.done.length]!;
    // An attachment of size 0 is complete without a frame, so the pending one needs bytes; an empty frame would only add an empty part.
    if (body.length === 0) throw new ProtocolError("attachment frame is empty");
    if (current.received + body.length > expected) throw new ProtocolError("attachment frame runs past its announced size");
    current.parts.push(body);
    current.received += body.length;
  }

  /** Completes attachments whose bytes are all here; returns the message once nothing is missing. */
  #finish(): ReceivedMessage | undefined {
    const current = this.#current!;
    while (current.done.length < current.sizes.length && current.received === current.sizes[current.done.length]) {
      current.done.push(Buffer.concat(current.parts));
      current.parts = [];
      current.received = 0;
    }
    if (current.done.length < current.sizes.length) return undefined;
    this.#current = undefined;
    return { message: current.message, attachments: current.done };
  }
}
