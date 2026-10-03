// VICE binary remote monitor client (VICE manual, chapter "Binary monitor",
// API version 2). Owns framing, request/response correlation and body
// decoding. Nothing outside src/host/vice sees these bytes.

import { connect, type Socket } from "node:net";

export const STX = 0x02;
export const API_VERSION = 0x02;
/** Request id VICE uses for responses it sends unprompted (events). */
export const EVENT_REQUEST_ID = 0xffff_ffff;

const COMMAND_HEADER_BYTES = 11;
const RESPONSE_HEADER_BYTES = 12;

/** Command type bytes. */
export const Command = {
  memoryGet: 0x01,
  memorySet: 0x02,
  checkpointGet: 0x11,
  checkpointSet: 0x12,
  checkpointDelete: 0x13,
  checkpointList: 0x14,
  checkpointToggle: 0x15,
  conditionSet: 0x22,
  registersGet: 0x31,
  registersSet: 0x32,
  dump: 0x41,
  undump: 0x42,
  resourceGet: 0x51,
  resourceSet: 0x52,
  advanceInstructions: 0x71,
  keyboardFeed: 0x72,
  executeUntilReturn: 0x73,
  ping: 0x81,
  banksAvailable: 0x82,
  registersAvailable: 0x83,
  displayGet: 0x84,
  viceInfo: 0x85,
  paletteGet: 0x91,
  joyportSet: 0xa2,
  userportSet: 0xb2,
  exit: 0xaa,
  quit: 0xbb,
  reset: 0xcc,
  autostart: 0xdd,
} as const;

/** Response types that are not simply the command byte. */
const TERMINAL_RESPONSE: Partial<Record<number, number>> = {
  [Command.checkpointGet]: 0x11,
  [Command.checkpointSet]: 0x11,
  [Command.registersSet]: 0x31,
};

/** Response types VICE sends as events (request id EVENT_REQUEST_ID). */
export const ResponseType = {
  invalid: 0x00,
  checkpointInfo: 0x11,
  registerInfo: 0x31,
  jam: 0x61,
  stopped: 0x62,
  resumed: 0x63,
} as const;

/** The memspace byte. */
export const Memspace = {
  main: 0x00,
  drive8: 0x01,
} as const;

export interface MonitorResponse {
  type: number;
  error: number;
  requestId: number;
  body: Buffer;
}

/** VICE answered a command with a non-zero error code. */
export class MonitorError extends Error {
  override name = "MonitorError";
  readonly command: number;
  readonly errorCode: number;

  constructor(command: number, errorCode: number) {
    super(`VICE refused monitor command 0x${command.toString(16)} with error 0x${errorCode.toString(16)}`);
    this.command = command;
    this.errorCode = errorCode;
  }
}

/** The monitor connection broke, timed out or sent bytes that are not the protocol. */
export class MonitorConnectionError extends Error {
  override name = "MonitorConnectionError";
}

export function encodeCommand(requestId: number, command: number, body: Uint8Array = new Uint8Array(0)): Buffer {
  const frame = Buffer.alloc(COMMAND_HEADER_BYTES + body.length);
  frame[0] = STX;
  frame[1] = API_VERSION;
  frame.writeUInt32LE(body.length, 2);
  frame.writeUInt32LE(requestId, 6);
  frame[10] = command;
  frame.set(body, COMMAND_HEADER_BYTES);
  return frame;
}

/** Splits the response stream into responses. Throws MonitorConnectionError on a bad header. */
export class ResponseDecoder {
  #pending: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): MonitorResponse[] {
    this.#pending = this.#pending.length === 0 ? chunk : Buffer.concat([this.#pending, chunk]);
    const responses: MonitorResponse[] = [];
    while (this.#pending.length >= RESPONSE_HEADER_BYTES) {
      if (this.#pending[0] !== STX) throw new MonitorConnectionError("response does not start with STX");
      if (this.#pending[1] !== API_VERSION) {
        throw new MonitorConnectionError(`response has API version ${this.#pending[1]}, expected ${API_VERSION}`);
      }
      const length = this.#pending.readUInt32LE(2);
      if (this.#pending.length < RESPONSE_HEADER_BYTES + length) break;
      responses.push({
        type: this.#pending[6]!,
        error: this.#pending[7]!,
        requestId: this.#pending.readUInt32LE(8),
        // Copy so a retained body never pins the whole receive buffer.
        body: Buffer.from(this.#pending.subarray(RESPONSE_HEADER_BYTES, RESPONSE_HEADER_BYTES + length)),
      });
      this.#pending = this.#pending.subarray(RESPONSE_HEADER_BYTES + length);
    }
    return responses;
  }
}

// ---------------------------------------------------------------------------
// Body codecs

export function memoryGetBody(options: { start: number; end: number; memspace: number; bank: number; sideEffects?: boolean }): Buffer {
  const body = Buffer.alloc(8);
  body[0] = options.sideEffects ? 1 : 0;
  body.writeUInt16LE(options.start, 1);
  body.writeUInt16LE(options.end, 3);
  body[5] = options.memspace;
  body.writeUInt16LE(options.bank, 6);
  return body;
}

/** The bytes of a memory-get response. The length field is 0 for a full 64 KiB read, so trust the body. */
export function decodeMemory(body: Buffer): Buffer {
  if (body.length < 2) throw new MonitorConnectionError("memory response is too short");
  return body.subarray(2);
}

export interface RegisterValue {
  id: number;
  value: number;
}

export function decodeRegisters(body: Buffer): RegisterValue[] {
  const count = body.readUInt16LE(0);
  const registers: RegisterValue[] = [];
  let offset = 2;
  for (let index = 0; index < count; index++) {
    const size = body[offset]!;
    registers.push({ id: body[offset + 1]!, value: body.readUInt16LE(offset + 2) });
    offset += size + 1;
  }
  return registers;
}

export interface RegisterInfo {
  id: number;
  bits: number;
  name: string;
}

export function decodeRegistersAvailable(body: Buffer): RegisterInfo[] {
  const count = body.readUInt16LE(0);
  const registers: RegisterInfo[] = [];
  let offset = 2;
  for (let index = 0; index < count; index++) {
    const size = body[offset]!;
    const nameLength = body[offset + 3]!;
    registers.push({
      id: body[offset + 1]!,
      bits: body[offset + 2]!,
      name: body.toString("latin1", offset + 4, offset + 4 + nameLength),
    });
    offset += size + 1;
  }
  return registers;
}

export interface BankInfo {
  id: number;
  name: string;
}

export function decodeBanks(body: Buffer): BankInfo[] {
  const count = body.readUInt16LE(0);
  const banks: BankInfo[] = [];
  let offset = 2;
  for (let index = 0; index < count; index++) {
    const size = body[offset]!;
    const nameLength = body[offset + 3]!;
    banks.push({ id: body.readUInt16LE(offset + 1), name: body.toString("latin1", offset + 4, offset + 4 + nameLength) });
    offset += size + 1;
  }
  return banks;
}

export function resourceGetBody(name: string): Buffer {
  const encoded = Buffer.from(name, "latin1");
  return Buffer.concat([Buffer.from([encoded.length]), encoded]);
}

export function decodeResource(body: Buffer): string | number {
  const type = body[0];
  const length = body[1]!;
  const value = body.subarray(2, 2 + length);
  if (type === 0x00) return value.toString("latin1");
  if (type === 0x01) {
    let result = 0;
    for (let index = length - 1; index >= 0; index--) result = result * 256 + value[index]!;
    return result;
  }
  throw new MonitorConnectionError(`resource response has unknown type ${type}`);
}

/** The program counter carried by stopped, resumed and JAM events. */
export function decodeProgramCounter(body: Buffer): number {
  return body.readUInt16LE(0);
}

// ---------------------------------------------------------------------------
// Connection

interface Pending {
  command: number;
  terminalType: number;
  extras: MonitorResponse[];
  resolve: (response: MonitorResponse & { extras: MonitorResponse[] }) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/** One binary-monitor connection with request correlation and an event stream. */
export class BinaryMonitor {
  /** Settles once the connection is gone, with the reason when it was not closed by us. */
  readonly closed: Promise<Error | undefined>;
  readonly #socket: Socket;
  readonly #decoder = new ResponseDecoder();
  readonly #pending = new Map<number, Pending>();
  readonly #eventListeners = new Set<(event: MonitorResponse) => void>();
  #nextId = 1;
  #failure: Error | undefined;
  #closedByUs = false;

  private constructor(socket: Socket) {
    this.#socket = socket;
    socket.setNoDelay(true);
    this.closed = new Promise((resolve) => {
      socket.on("close", () => {
        const reason = this.#closedByUs ? undefined : (this.#failure ?? new MonitorConnectionError("VICE closed the monitor connection"));
        this.#rejectAll(reason ?? new MonitorConnectionError("monitor connection closed"));
        resolve(reason);
      });
    });
    socket.on("error", (error) => {
      this.#failure ??= new MonitorConnectionError(`monitor connection failed: ${error.message}`);
    });
    socket.on("data", (chunk) => this.#receive(chunk));
  }

  /** Opens a connection. Rejects with MonitorConnectionError when nothing listens. */
  static connect(port: number, host = "127.0.0.1", timeoutMs = 2_000): Promise<BinaryMonitor> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host, port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new MonitorConnectionError(`monitor connect to port ${port} timed out`));
      }, timeoutMs);
      socket.once("connect", () => {
        clearTimeout(timer);
        socket.removeAllListeners("error");
        resolve(new BinaryMonitor(socket));
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(new MonitorConnectionError(`monitor connect to port ${port} failed: ${error.message}`));
      });
    });
  }

  /** Subscribes to events (responses with request id EVENT_REQUEST_ID). Returns an unsubscribe function. */
  onEvent(listener: (event: MonitorResponse) => void): () => void {
    this.#eventListeners.add(listener);
    return () => this.#eventListeners.delete(listener);
  }

  /**
   * Sends one command and resolves with its terminal response. Responses
   * carrying the same request id before the terminal one (checkpoint list)
   * are returned in `extras`. Rejects with MonitorError on a VICE error code.
   */
  request(
    command: number,
    body: Uint8Array = new Uint8Array(0),
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<MonitorResponse & { extras: MonitorResponse[] }> {
    if (this.#socket.destroyed) return Promise.reject(new MonitorConnectionError("monitor connection is closed"));
    const requestId = this.#nextId;
    this.#nextId = this.#nextId >= EVENT_REQUEST_ID - 1 ? 1 : this.#nextId + 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new MonitorConnectionError(`monitor command 0x${command.toString(16)} got no response in ${timeoutMs} ms`));
      }, timeoutMs);
      this.#pending.set(requestId, {
        command,
        terminalType: TERMINAL_RESPONSE[command] ?? command,
        extras: [],
        resolve,
        reject,
        timer,
      });
      this.#socket.write(encodeCommand(requestId, command, body));
    });
  }

  /** Closes the connection. Pending requests reject. */
  close(): Promise<void> {
    this.#closedByUs = true;
    this.#socket.destroy();
    return this.closed.then(() => {});
  }

  #receive(chunk: Buffer): void {
    let responses: MonitorResponse[];
    try {
      responses = this.#decoder.push(chunk);
    } catch (error) {
      this.#failure = error as Error;
      this.#socket.destroy();
      return;
    }
    for (const response of responses) {
      if (response.requestId === EVENT_REQUEST_ID) {
        for (const listener of this.#eventListeners) listener(response);
        continue;
      }
      const pending = this.#pending.get(response.requestId);
      if (pending === undefined) continue; // a late answer to a timed-out request
      if (response.error !== 0) {
        this.#settle(response.requestId, pending);
        pending.reject(new MonitorError(pending.command, response.error));
      } else if (response.type === pending.terminalType) {
        this.#settle(response.requestId, pending);
        pending.resolve({ ...response, extras: pending.extras });
      } else {
        pending.extras.push(response);
      }
    }
  }

  #settle(requestId: number, pending: Pending): void {
    clearTimeout(pending.timer);
    this.#pending.delete(requestId);
  }

  #rejectAll(error: Error): void {
    for (const [requestId, pending] of this.#pending) {
      this.#settle(requestId, pending);
      pending.reject(error);
    }
  }
}
