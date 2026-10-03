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

/** Bounds of c64_memory_read (15 §14) and c64_memory_write (15 §15). */
export const MAX_MEMORY_READ = 4096;
export const MAX_MEMORY_WRITE = 4096;

export const EXECUTION_ACTIONS = ["pause", "resume", "step", "next", "until-return"] as const;
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
  /** step and next only; defaults to 1. */
  count?: number;
  space: Space;
}

export interface ExecutionResult {
  state: RunState;
  pc?: number;
  executed?: number;
}

export interface ViceOperations {
  status: { params: Record<string, never>; result: MachineStatus };
  memoryRead: { params: MemoryReadParams; result: MemoryReadResult };
  registersGet: { params: { space: Space }; result: Registers };
  memoryWrite: { params: MemoryWriteParams; result: { address: number; bytesWritten: number } };
  registersSet: { params: { space: Space; values: RegisterValues }; result: Registers };
  execution: { params: ExecutionParams; result: ExecutionResult };
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
  warp: { params: { enabled: boolean }; result: { enabled: boolean } };
}
export type ViceOperation = keyof ViceOperations;
export const VICE_OPERATIONS = [
  "status",
  "memoryRead",
  "registersGet",
  "memoryWrite",
  "registersSet",
  "execution",
  "programLoad",
  "autostart",
  "diskAttach",
  "reset",
  "keyboard",
  "joystick",
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
      return {} as ViceOperations[O]["params"];
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
      const counted = params.action === "step" || params.action === "next";
      if (params.count !== undefined) {
        if (!counted) invalid(`count is not used with action ${params.action}`);
        if (!isInteger(params.count, 1, MAX_EXECUTION_COUNT)) invalid(`count must be an integer from 1 to ${MAX_EXECUTION_COUNT}`);
      }
      const result: ExecutionParams = { action: params.action, space: params.space };
      if (counted) result.count = (params.count as number | undefined) ?? 1;
      return result as ViceOperations[O]["params"];
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
    case "execution": {
      const ok =
        isOneOf(RUN_STATES, value.state) &&
        (value.pc === undefined || isInteger(value.pc, 0, 0xffff)) &&
        (value.executed === undefined || isInteger(value.executed, 0, MAX_EXECUTION_COUNT));
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
