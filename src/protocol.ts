// The private Host Runtime wire contract, shared by src/host and src/host-client.
// Nothing here is LLM-facing: MCP and skill results never show these shapes.

/** Private Host Runtime protocol identifier. */
export const HOST_PROTOCOL_ID = "c64-re-tools-host" as const;
/** Bumped on any incompatible change; a mismatch fails the handshake. */
export const HOST_PROTOCOL_VERSION = 1;
/** The Host Runtime listens on 127.0.0.1 at this port by default (D5). */
export const DEFAULT_HOST_PORT = 6464;
/** Largest frame body either side accepts (D1). */
export const MAX_FRAME_BYTES = 1024 * 1024;

// ---------------------------------------------------------------------------
// Shared vocabulary (15 §3, §5)

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

/** An actionable failure carried on the wire and shown to the LLM unchanged (D4). */
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

/** Bounds of c64_memory_search (15 §16), c64_memory_compare (15 §17) and c64_disassemble (15 §19). */
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

/** Bounds of c64_memory_read (15 §14) and c64_memory_write (15 §15). */
export const MAX_MEMORY_READ = 4096;
export const MAX_MEMORY_WRITE = 4096;

export const EXECUTION_ACTIONS = ["pause", "resume", "step", "next", "until-return", "advance-frames"] as const;
export type ExecutionAction = (typeof EXECUTION_ACTIONS)[number];
/** Bounds of c64_execution counts (15 §10). */
export const MAX_EXECUTION_COUNT = 10_000;

/** File types each media operation accepts, by lowercase extension. */
export const AUTOSTART_TYPES = ["prg", "p00", "t64", "tap", "d64", "d71", "d81", "g64", "x64", "crt"] as const;
export const DISK_TYPES = ["d64", "d71", "d81", "g64", "x64"] as const;

/** Most bytes c64_keyboard queues in one call (15 §31). */
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

// Typed conditions (15 §6)

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

// Breakpoints and watchpoints (15 §12, §13)

export const CHECKPOINT_ACTIONS = ["add", "remove", "enable", "disable", "list"] as const;
export const WATCH_ACCESS = ["read", "write", "read-write"] as const;
export type WatchAccess = (typeof WATCH_ACCESS)[number];
export const MAX_WATCH_SIZE = 256;

export interface Breakpoint {
  id: number;
  address: number;
  space: Space;
  enabled: boolean;
}

export interface Watchpoint {
  id: number;
  address: number;
  size: number;
  access: WatchAccess;
  space: Space;
  enabled: boolean;
}

export type BreakpointParams =
  | { action: "add"; address: number; space: Space; condition?: Condition }
  | { action: "remove" | "enable" | "disable"; id: number }
  | { action: "list" };

export type WatchpointParams =
  | { action: "add"; address: number; size: number; access: WatchAccess; space: Space; condition?: Condition }
  | { action: "remove" | "enable" | "disable"; id: number }
  | { action: "list" };

// Chip state (15 §25-§28)

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

export const RESET_MODES = ["soft", "hard"] as const;
export type ResetMode = (typeof RESET_MODES)[number];

// ---------------------------------------------------------------------------
// VICE-session operations. Addresses are integers 0..0xffff; bytes travel as
// lowercase hex. The MCP formats them into the public shapes.

export interface MachineStatus {
  state: RunState;
  videoStandard: VideoStandard;
  warp: boolean;
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

/** c64_run_until targets (15 §11). */
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
  reset: { params: { mode: ResetMode; run: boolean }; result: { state: RunState } };
  /** `data`: PETSCII bytes as lowercase hex. */
  keyboard: { params: { data: string }; result: { queuedBytes: number } };
  joystick: { params: JoystickState; result: JoystickState };
  breakpoint: { params: BreakpointParams; result: Breakpoint | { breakpoints: Breakpoint[] } };
  watchpoint: { params: WatchpointParams; result: Watchpoint | { watchpoints: Watchpoint[] } };
  vicii: { params: Record<string, never>; result: ViciiState };
  /** `indexes`: unique sprite numbers 0-7, in the order to report them. */
  sprites: { params: { indexes: number[] }; result: { sprites: SpriteState[] } };
  cia: { params: { which: CiaSelection }; result: { chips: CiaState[] } };
  sid: { params: Record<string, never>; result: SidState };
  /** The last frame the VIC-II drew, visible area with borders, as a base64 PNG. */
  screenCapture: { params: Record<string, never>; result: { width: number; height: number; png: string } };
  warp: { params: { enabled: boolean }; result: { enabled: boolean } };
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
  "vicii",
  "sprites",
  "cia",
  "sid",
  "warp",
] as const satisfies readonly ViceOperation[];

/** How many attachments each operation takes. */
export function attachmentCount(op: ViceOperation): number {
  return op === "programLoad" || op === "autostart" || op === "diskAttach" ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Messages (D2, D3)

export interface Hello {
  type: "hello";
  protocol: string;
  version: number;
  role: Role;
  /** vice-session only; fixed for the session (D10). */
  videoStandard?: VideoStandard;
}

export interface Ready {
  type: "ready";
}

/** Sent instead of `ready` when the handshake fails; the host then closes. */
export interface HandshakeError {
  type: "error";
  error: WireError;
}

export interface Request<O extends ViceOperation = ViceOperation> {
  type: "request";
  id: number;
  op: O;
  params: ViceOperations[O]["params"];
}

export type Reply =
  | { type: "reply"; id: number; result: unknown }
  | { type: "reply"; id: number; error: WireError };

export type ClientMessage = Hello | Request;
export type HostMessage = Ready | HandshakeError | Reply;

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

type Fields = Record<string, unknown>;

function isObject(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isRequestId(value: unknown): value is number {
  return isInteger(value, 0, 0xffff_ffff);
}

function isWireError(value: unknown): value is WireError {
  return isObject(value) && isOneOf(ERROR_CODES, value.code) && typeof value.message === "string";
}

/** Validates a message the host received. Throws ProtocolError on any contract break. */
export function parseClientMessage(value: unknown): ClientMessage {
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
    const hello: Hello = { type: "hello", protocol: value.protocol, version: value.version, role: value.role };
    if (value.videoStandard !== undefined) hello.videoStandard = value.videoStandard;
    return hello;
  }
  if (value.type === "request") {
    if (!isRequestId(value.id)) throw new ProtocolError("request id is not a 32-bit unsigned integer");
    if (typeof value.op !== "string") throw new ProtocolError("request op is not a string");
    if (!isObject(value.params)) throw new ProtocolError("request params is not an object");
    return { type: "request", id: value.id, op: value.op as ViceOperation, params: value.params as never };
  }
  throw new ProtocolError("unknown message type");
}

/** Validates a message the client received. Throws ProtocolError on any contract break. */
export function parseHostMessage(value: unknown): HostMessage {
  if (!isObject(value)) throw new ProtocolError("message is not an object");
  if (value.type === "ready") return { type: "ready" };
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

/** Validates request parameters on the host. Throws WireFailure(invalid-input). */
export function validateViceParams<O extends ViceOperation>(op: O, params: unknown): ViceOperations[O]["params"] {
  if (!isObject(params)) invalid("parameters must be an object");
  switch (op) {
    case "status":
    case "screenCapture":
    case "vicii":
    case "sid":
      return {} as ViceOperations[O]["params"];
    case "sprites": {
      const indexes = params.indexes;
      if (!Array.isArray(indexes) || !indexes.every((index) => isInteger(index, 0, 7))) invalid("sprites holds sprite numbers 0 to 7");
      if (new Set(indexes).size !== indexes.length) invalid("sprites holds each sprite number once");
      return { indexes: indexes as number[] } as ViceOperations[O]["params"];
    }
    case "cia": {
      if (!isOneOf(CIA_SELECTIONS, params.which)) invalid("cia must be 1, 2 or both");
      return { which: params.which } as ViceOperations[O]["params"];
    }
    case "memoryRead": {
      if (!isInteger(params.address, 0, 0xffff)) invalid("address must be an integer from 0 to 65535");
      if (!isInteger(params.size, 1, MAX_MEMORY_READ)) invalid(`size must be an integer from 1 to ${MAX_MEMORY_READ}`);
      if (params.address + params.size > 0x10000) invalid("the range runs past $ffff");
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      if (!isOneOf(MEMORY_VIEWS, params.view)) invalid("view must be cpu or ram");
      const result: MemoryReadParams = { address: params.address, size: params.size, space: params.space, view: params.view };
      return result as ViceOperations[O]["params"];
    }
    case "registersGet": {
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      return { space: params.space } as ViceOperations[O]["params"];
    }
    case "memoryWrite": {
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
      if (!isInteger(params.size, 1, MAX_COMPARE_SIZE)) invalid(`size must be an integer from 1 to ${MAX_COMPARE_SIZE}`);
      const location = (value: unknown, name: string): MemoryLocation => {
        if (!isObject(value)) invalid(`${name} must be an object`);
        if (!isInteger(value.address, 0, 0xffff)) invalid(`${name} address must be an integer from 0 to 65535`);
        if ((value.address as number) + (params.size as number) > 0x10000) invalid(`the ${name} range runs past $ffff`);
        if (!isOneOf(SPACES, value.space)) invalid(`${name} space must be c64 or drive8`);
        if (!isOneOf(MEMORY_VIEWS, value.view)) invalid(`${name} view must be cpu or ram`);
        return { address: value.address as number, space: value.space, view: value.view };
      };
      return { left: location(params.left, "left"), right: location(params.right, "right"), size: params.size } as ViceOperations[O]["params"];
    }
    case "disassemble": {
      if (!isInteger(params.address, 0, 0xffff)) invalid("address must be an integer from 0 to 65535");
      if (!isInteger(params.count, 1, MAX_DISASSEMBLE)) invalid(`count must be an integer from 1 to ${MAX_DISASSEMBLE}`);
      if (!isOneOf(SPACES, params.space)) invalid("space must be c64 or drive8");
      if (!isOneOf(MEMORY_VIEWS, params.view)) invalid("view must be cpu or ram");
      return { address: params.address, count: params.count, space: params.space, view: params.view } as ViceOperations[O]["params"];
    }
    case "registersSet": {
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
      if (!isInteger(params.timeoutFrames, 1, MAX_TIMEOUT_FRAMES)) invalid(`timeoutFrames must be an integer from 1 to ${MAX_TIMEOUT_FRAMES}`);
      return { target: validateRunTarget(params.target), timeoutFrames: params.timeoutFrames } as ViceOperations[O]["params"];
    }
    case "programLoad": {
      if (params.address !== undefined && !isInteger(params.address, 0, 0xffff)) invalid("address must be an integer from 0 to 65535");
      return (params.address === undefined ? {} : { address: params.address }) as ViceOperations[O]["params"];
    }
    case "autostart": {
      if (!isOneOf(AUTOSTART_TYPES, params.type)) invalid(`the file must be one of: ${AUTOSTART_TYPES.map((type) => `.${type}`).join(", ")}`);
      if (!isInteger(params.index, 0, 0xffff)) invalid("index must be an integer from 0 to 65535");
      if (typeof params.run !== "boolean") invalid("run must be true or false");
      return { type: params.type, index: params.index, run: params.run } as ViceOperations[O]["params"];
    }
    case "diskAttach": {
      if (!isOneOf(DISK_TYPES, params.type)) invalid(`the disk image must be one of: ${DISK_TYPES.map((type) => `.${type}`).join(", ")}`);
      return { type: params.type } as ViceOperations[O]["params"];
    }
    case "keyboard": {
      if (!isHexData(params.data) || params.data.length === 0) invalid("data must be PETSCII bytes as lowercase hex");
      if (params.data.length / 2 > MAX_KEYBOARD_BYTES) invalid(`at most ${MAX_KEYBOARD_BYTES} bytes can be queued at once`);
      // VICE feeds a C string, so a zero byte would end the text early.
      if (/^(?:..)*?00/.test(params.data)) invalid("PETSCII byte 0 cannot be typed");
      return { data: params.data } as ViceOperations[O]["params"];
    }
    case "joystick": {
      if (params.port !== 1 && params.port !== 2) invalid("port must be 1 or 2");
      if (!isOneOf(JOYSTICK_DIRECTIONS, params.direction)) invalid(`direction must be one of ${JOYSTICK_DIRECTIONS.join(", ")}`);
      if (typeof params.fire !== "boolean") invalid("fire must be true or false");
      return { port: params.port, direction: params.direction, fire: params.fire } as ViceOperations[O]["params"];
    }
    case "breakpoint":
    case "watchpoint": {
      if (!isOneOf(CHECKPOINT_ACTIONS, params.action)) invalid(`action must be one of ${CHECKPOINT_ACTIONS.join(", ")}`);
      if (params.action === "list") return { action: "list" } as ViceOperations[O]["params"];
      if (params.action !== "add") {
        if (!isInteger(params.id, 1, 0xffff_ffff)) invalid("id must be a positive integer");
        return { action: params.action, id: params.id } as ViceOperations[O]["params"];
      }
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
      if (!isOneOf(RESET_MODES, params.mode)) invalid("mode must be soft or hard");
      if (typeof params.run !== "boolean") invalid("run must be true or false");
      return { mode: params.mode, run: params.run } as ViceOperations[O]["params"];
    }
    case "warp": {
      if (typeof params.enabled !== "boolean") invalid("enabled must be true or false");
      return { enabled: params.enabled } as ViceOperations[O]["params"];
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
      if (!isOneOf(CONDITION_REGISTERS, value.register)) invalid("condition register must be a, x, y or sp");
      if (!isOneOf(COMPARISONS, value.operator)) invalid(`condition operator must be one of ${COMPARISONS.join(", ")}`);
      return { kind: "register", register: value.register, operator: value.operator, value: byte(value.value, "value") };
    }
    case "memory": {
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
      if (!isInteger(value.address, 0, 0xffff)) invalid("target address must be an integer from 0 to 65535");
      if (!isOneOf(SPACES, value.space)) invalid("target space must be c64 or drive8");
      const target: RunTarget = { kind: "address", address: value.address, space: value.space };
      if (value.condition !== undefined) target.condition = validateCondition(value.condition);
      return target;
    }
    case "memory": {
      const { kind: _kind, ...condition } = validateCondition({ ...value, kind: "memory" }) as Extract<Condition, { kind: "memory" }>;
      return { kind: "memory", ...condition };
    }
    case "raster": {
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
    typeof value.enabled === "boolean"
  );
}

function isWatchpoint(value: unknown): value is Watchpoint {
  return isBreakpoint(value) && isObject(value) && isInteger(value.size, 1, MAX_WATCH_SIZE) && isOneOf(WATCH_ACCESS, value.access);
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
        /^[A-Za-z0-9+/]+={0,2}$/.test(value.png);
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
    default:
      throw new ProtocolError(`unknown operation: ${String(op)}`);
  }
  return value as unknown as ViceOperations[O]["result"];
}

// ---------------------------------------------------------------------------
// Framing (D1): 4-byte big-endian body length, then the body. A message body
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

/** Reassembles attachment-free messages; kept for callers that never expect attachments. */
export class FrameDecoder {
  readonly #reader = new MessageReader();

  /** Returns every complete message body, parsed as JSON. Throws ProtocolError, also on attachments. */
  push(chunk: Buffer): unknown[] {
    return this.#reader.push(chunk).map(({ message, attachments }) => {
      if (attachments.length > 0) throw new ProtocolError("unexpected attachments");
      return message;
    });
  }
}
