#!/usr/bin/env node
// This is the ONE authoritative place that frames, parses, and (in plan
// 02-06's later addition to this same file) demultiplexes the stock binary
// VICE binary-monitor wire protocol -- nothing else in this tree decodes
// binmon bytes. Two seams live here: the pure byte-level framing/parsing
// functions (parseBuffer/parseResponse/encodeRequestHeader), and a raw-socket
// client (ViceMonitorClient) that drives them off a real net.Socket.
//
// Attribution: this module is derived from henrik/c64-debug-mcp's
// src/vice-protocol.ts (v1.0.14, MIT, Henrik Olsson 2025). Three defects in
// that source are fixed on the way in: (a) the zero-length JAM read --
// vendor lines 357-358 call body.readUInt16LE(0) on a JAM's body
// unconditionally, even though monitor_binary.c:384-394 sends no PC bytes at
// all for that event, which throws on a real JAM; (b) the throw-on-bad-STX
// that never advances the buffer -- vendor lines 228-231 throw out of the
// framing loop on a single unexpected byte instead of resyncing, which
// permanently wedges the connection on the very first stray byte; and (c) the
// api_version byte at header offset 1, which the vendor's parseBuffer()
// never reads at all, silently accepting a monitor speaking a different wire
// version. A fourth defect, not one of the three named above but found while
// porting: the vendor's DisplayGet case computes imageBytes starting at
// `infoLength + 4`, which is the same offset its own imageLength field
// occupies -- it should start after that 4-byte field, at
// `infoLength + 4 + 4`. This repo's own probe-binmon.mjs:parseDisplayGet()
// already derives this correctly (see its "never hardcoded to 17/21"
// comment); this module follows that already-tested reference instead of
// the vendor's off-by-four slice (Rule 1 auto-fix, not one of D-16's three
// named defects).
//
// What NOT to do: never demux on response type before request id -- plan
// 02-06 builds that correlation layer on top of the parser below, and a
// response type can be reused between a legitimate command reply and an
// unsolicited event (CHECKPOINT_INFO/REGISTER_INFO), so only request id can
// tell them apart. Never import the vendor's contracts.ts or errors.ts --
// contracts.ts pulls in a validation library this package's dependencies
// block does not carry and must not gain (D-16); only the pure wire
// constants below are hand-copied from it. No existing file in this repo
// vendors third-party source before this one; this header comment
// establishes the template other vendoring, if any, should follow.
import { EventEmitter } from "node:events";
import net from "node:net";

import { ViceError } from "./vice.ts";

// ---------------------------------------------------------------------------
// Wire constants (hand-copied, not imported -- see header comment above)
// ---------------------------------------------------------------------------

export const VICE_STX = 0x02;
export const VICE_API_VERSION = 0x02;
export const VICE_BROADCAST_REQUEST_ID = 0xffffffff;
export const RESPONSE_HEADER_LEN = 12;
export const REQUEST_HEADER_LEN = 11;

// Upper bound on a trusted declared body length. The largest legitimate
// frame is a DISPLAY_GET of the full debug screen (504*312 = 157,248 bytes
// at 8bpp plus its info block), so 4 MiB is far above anything real while
// still refusing an arbitrary 32-bit value read out of a desynced stream.
// Same rationale as probe-binmon.mjs:73-77's MAX_BODY_LEN.
export const MAX_BODY_LEN = 4 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Command / response / error "enums" -- one-for-one with
// docs/phase0-binmon-findings.md §5's normative set, which is a superset of
// the vendor's own CommandType (missing RESOURCE_GET/SET, CPUHISTORY_GET,
// and USERPORT_SET).
//
// Deviation from the plan's literal wording ("plain TypeScript enums, not
// `const enum`"): a real TypeScript `enum` -- plain or const -- emits
// runtime code, and this package has NO build step at all (see CLAUDE.md /
// this repo's README: Node's native type-stripping runs these .ts files
// directly). Node's strip-only mode explicitly rejects `enum` with
// ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX ("TypeScript enum is not supported in
// strip-only mode") -- confirmed by running this file. No other file in this
// package uses `enum` for exactly this reason. `as const` objects plus a
// derived type alias give the same `CommandType.Ping`-style access and the
// same numeric values with zero runtime codegen -- the standard idiom for
// this project's constraint (Rule 3 auto-fix; not an architectural change,
// same names/values as originally specified).
// ---------------------------------------------------------------------------

export const CommandType = {
  MemoryGet: 0x01,
  MemorySet: 0x02,
  CheckpointGet: 0x11,
  CheckpointSet: 0x12,
  CheckpointDelete: 0x13,
  CheckpointList: 0x14,
  CheckpointToggle: 0x15,
  ConditionSet: 0x22,
  RegistersGet: 0x31,
  RegistersSet: 0x32,
  Dump: 0x41,
  Undump: 0x42,
  ResourceGet: 0x51,
  ResourceSet: 0x52,
  AdvanceInstructions: 0x71,
  KeyboardFeed: 0x72,
  ExecuteUntilReturn: 0x73,
  Ping: 0x81,
  BanksAvailable: 0x82,
  RegistersAvailable: 0x83,
  DisplayGet: 0x84,
  ViceInfo: 0x85,
  CpuHistoryGet: 0x86,
  PaletteGet: 0x91,
  JoyportSet: 0xa2,
  UserportSet: 0xb2,
  Exit: 0xaa,
  Quit: 0xbb,
  Reset: 0xcc,
  AutoStart: 0xdd,
} as const;
export type CommandType = (typeof CommandType)[keyof typeof CommandType];

export const ResponseType = {
  MemoryGet: 0x01,
  MemorySet: 0x02,
  CheckpointInfo: 0x11,
  CheckpointList: 0x14,
  CheckpointToggle: 0x15,
  ConditionSet: 0x22,
  RegisterInfo: 0x31,
  Dump: 0x41,
  Undump: 0x42,
  ResourceGet: 0x51,
  ResourceSet: 0x52,
  Jam: 0x61,
  Stopped: 0x62,
  Resumed: 0x63,
  AdvanceInstructions: 0x71,
  KeyboardFeed: 0x72,
  ExecuteUntilReturn: 0x73,
  Ping: 0x81,
  BanksAvailable: 0x82,
  RegistersAvailable: 0x83,
  DisplayGet: 0x84,
  ViceInfo: 0x85,
  CpuHistoryGet: 0x86,
  PaletteGet: 0x91,
  JoyportSet: 0xa2,
  UserportSet: 0xb2,
  Exit: 0xaa,
  Quit: 0xbb,
  Reset: 0xcc,
  AutoStart: 0xdd,
} as const;
export type ResponseType = (typeof ResponseType)[keyof typeof ResponseType];

export const ErrorCode = {
  Ok: 0x00,
  ObjectMissing: 0x01,
  InvalidMemspace: 0x02,
  InvalidLength: 0x80,
  InvalidParameter: 0x81,
  InvalidApiVersion: 0x82,
  InvalidType: 0x83,
  CmdFailure: 0x8f,
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ---------------------------------------------------------------------------
// Error hierarchy -- ViceError subclasses, following vice.ts's exact
// constructor(message, { ...fields }: XOptions = {}) shape. Never the
// vendor's own error class.
// ---------------------------------------------------------------------------

export interface StockProtocolErrorOptions {
  errorCode?: number;
  responseType?: number;
  requestId?: number;
}

/** Raised (returned inside parseBuffer()'s responses array, never thrown out
 * of it) for any non-OK wire error code -- PROTO-05's distinguishable
 * failure. Carries the wire errorCode and the responseType it arrived on so
 * a caller never mistakes this for an empty success. */
export class StockProtocolError extends ViceError {
  errorCode?: number;
  responseType?: number;
  requestId?: number;

  constructor(message: string, { errorCode, responseType, requestId }: StockProtocolErrorOptions = {}) {
    super(message, { code: errorCode });
    this.name = "StockProtocolError";
    this.errorCode = errorCode;
    this.responseType = responseType;
    this.requestId = requestId;
  }
}

export interface StockFramingErrorOptions {
  observed?: number;
  expected?: number;
  responseType?: number;
  requestId?: number;
}

/** api_version mismatch and other decode-level faults, carrying the observed
 * bytes. Like StockProtocolError, this is returned inside parseBuffer()'s
 * responses array rather than thrown out of the parse loop. */
export class StockFramingError extends ViceError {
  observed?: number;
  expected?: number;
  responseType?: number;
  requestId?: number;

  constructor(message: string, { observed, expected, responseType, requestId }: StockFramingErrorOptions = {}) {
    super(message);
    this.name = "StockFramingError";
    this.observed = observed;
    this.expected = expected;
    this.responseType = responseType;
    this.requestId = requestId;
  }
}

export interface StockDesyncErrorOptions {
  bytesSkipped?: number;
}

/** Carries bytesSkipped, for a caller that wants to escalate a persistent
 * desync. Emitted by ViceMonitorClient (below) when the accumulated,
 * unparsed buffer grows past MAX_BODY_LEN without a complete frame, or when
 * an unexpected throw would otherwise poison the connection. */
export class StockDesyncError extends ViceError {
  bytesSkipped?: number;

  constructor(message: string, { bytesSkipped }: StockDesyncErrorOptions = {}) {
    super(message);
    this.name = "StockDesyncError";
    this.bytesSkipped = bytesSkipped;
  }
}

// ---------------------------------------------------------------------------
// Request encoding
// ---------------------------------------------------------------------------

export interface EncodeRequestHeaderOptions {
  commandType: number;
  requestId: number;
  body?: Buffer;
}

/** Build the normative 11-byte binary-monitor request header
 * (docs/phase0-binmon-findings.md §5) plus body: STX, api_version, uint32 LE
 * body length, uint32 LE request id, command type byte. */
export function encodeRequestHeader({ commandType, requestId, body = Buffer.alloc(0) }: EncodeRequestHeaderOptions): Buffer {
  const header = Buffer.alloc(REQUEST_HEADER_LEN);
  header[0] = VICE_STX;
  header[1] = VICE_API_VERSION;
  header.writeUInt32LE(body.length >>> 0, 2);
  header.writeUInt32LE(requestId >>> 0, 6);
  header[10] = commandType;
  return Buffer.concat([header, body]);
}

// ---------------------------------------------------------------------------
// Parsed response shapes
// ---------------------------------------------------------------------------

export interface ParsedBaseResponse {
  requestId: number;
  errorCode: number;
}

export interface ParsedMemoryGetResponse extends ParsedBaseResponse {
  type: "memory_get";
  bytes: Uint8Array;
}

export interface ParsedRegistersResponse extends ParsedBaseResponse {
  type: "registers";
  registers: Array<{ id: number; value: number }>;
}

export interface ParsedRegistersAvailableResponse extends ParsedBaseResponse {
  type: "registers_available";
  registers: Array<{ id: number; size: number; name: string }>;
}

export interface ParsedViceInfoResponse extends ParsedBaseResponse {
  type: "vice_info";
  version: number[];
  versionString: string;
  svnVersion: number;
}

/** Checkpoint field layout per the vendor's byte offsets, with `kind`
 * deliberately NOT mapped to a named BreakpointKind -- that mapping lives in
 * the vendor's contracts.ts, which this module must not import (D-16). The
 * raw wire operation byte is carried instead; a later plan that needs the
 * named mapping owns re-deriving it without pulling in that dependency. */
export interface ParsedCheckpoint {
  id: number;
  currentlyHit: boolean;
  start: number;
  end: number;
  stopWhenHit: boolean;
  enabled: boolean;
  operation: number;
  temporary: boolean;
  hitCount: number;
  ignoreCount: number;
  hasCondition: boolean;
}

export interface ParsedCheckpointInfoResponse extends ParsedBaseResponse {
  type: "checkpoint_info";
  checkpoint: ParsedCheckpoint;
}

export interface ParsedCheckpointListResponse extends ParsedBaseResponse {
  type: "checkpoint_list";
  total: number;
  checkpoints: ParsedCheckpoint[];
}

export interface ParsedDisplayResponse extends ParsedBaseResponse {
  type: "display";
  debugWidth: number;
  debugHeight: number;
  debugOffsetX: number;
  debugOffsetY: number;
  innerWidth: number;
  innerHeight: number;
  bitsPerPixel: number;
  imageBytes: Uint8Array;
}

export interface ParsedPaletteItem {
  index: number;
  red: number;
  green: number;
  blue: number;
}

export interface ParsedPaletteResponse extends ParsedBaseResponse {
  type: "palette";
  items: ParsedPaletteItem[];
}

export interface ParsedStoppedEvent extends ParsedBaseResponse {
  type: "stopped";
  programCounter: number;
}

export interface ParsedResumedEvent extends ParsedBaseResponse {
  type: "resumed";
  programCounter: number;
}

/** JAM (0x61): defect (a) fix. per monitor_binary.c:384-394, the PC is
 * computed then a zero-length body is sent -- programCounter is `null` when
 * the body is short, never fabricated as 0 (which is indistinguishable from
 * a real PC of $0000). */
export interface ParsedJamEvent extends ParsedBaseResponse {
  type: "jam";
  programCounter: number | null;
}

export interface ParsedUndumpResponse extends ParsedBaseResponse {
  type: "undump";
  programCounter: number;
}

/** Fallback shape for any responseType this module has no specific case for
 * (including VERIF-02 case 6's response type byte 0x00, which is never a
 * real response/event type on the wire) -- the parser must produce this
 * shape rather than throw. */
export interface ParsedUnknownResponse extends ParsedBaseResponse {
  type: "unknown";
  responseType: number;
}

export type ParsedResponse =
  | ParsedMemoryGetResponse
  | ParsedRegistersResponse
  | ParsedRegistersAvailableResponse
  | ParsedViceInfoResponse
  | ParsedCheckpointInfoResponse
  | ParsedCheckpointListResponse
  | ParsedDisplayResponse
  | ParsedPaletteResponse
  | ParsedStoppedEvent
  | ParsedResumedEvent
  | ParsedJamEvent
  | ParsedUndumpResponse
  | ParsedUnknownResponse;

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

export interface ParseResponseOptions {
  apiVersion: number;
  responseType: number;
  errorCode: number;
  requestId: number;
  body: Buffer;
}

/**
 * Decode one already-framed response. May THROW StockFramingError (api
 * version mismatch) or StockProtocolError (non-OK wire error code) --
 * parseBuffer() below is the seam that catches both and packages them into
 * its responses array instead of letting them escape. Never throws for an
 * unrecognized responseType; that falls through to the "unknown" shape.
 */
export function parseResponse({ apiVersion, responseType, errorCode, requestId, body }: ParseResponseOptions): ParsedResponse {
  if (apiVersion !== VICE_API_VERSION) {
    throw new StockFramingError(
      `observed api_version 0x${apiVersion.toString(16).padStart(2, "0")}, expected 0x${VICE_API_VERSION.toString(16).padStart(2, "0")}`,
      { observed: apiVersion, expected: VICE_API_VERSION, responseType, requestId },
    );
  }

  if (errorCode !== ErrorCode.Ok) {
    throw new StockProtocolError(
      `binary monitor returned error code 0x${errorCode.toString(16).padStart(2, "0")} for response type 0x${responseType.toString(16).padStart(2, "0")}`,
      { errorCode, responseType, requestId },
    );
  }

  switch (responseType) {
    case ResponseType.MemoryGet: {
      const length = body.readUInt16LE(0);
      return { type: "memory_get", requestId, errorCode, bytes: body.subarray(2, 2 + length) };
    }
    case ResponseType.RegisterInfo: {
      const count = body.readUInt16LE(0);
      const registers = Array.from({ length: count }, (_, index) => {
        const start = 2 + index * 4;
        return { id: body[start + 1]!, value: body.readUInt16LE(start + 2) };
      });
      return { type: "registers", requestId, errorCode, registers };
    }
    case ResponseType.RegistersAvailable: {
      const count = body.readUInt16LE(0);
      let offset = 2;
      const registers: Array<{ id: number; size: number; name: string }> = [];
      for (let index = 0; index < count; index += 1) {
        const itemSize = body[offset]!;
        const id = body[offset + 1]!;
        const size = body[offset + 2]!;
        const nameLength = body[offset + 3]!;
        const name = body.subarray(offset + 4, offset + 4 + nameLength).toString("ascii");
        registers.push({ id, size, name });
        offset += itemSize + 1;
      }
      return { type: "registers_available", requestId, errorCode, registers };
    }
    case ResponseType.ViceInfo: {
      const mainVersionLength = body[0] ?? 0;
      const version = Array.from(body.subarray(1, 1 + mainVersionLength));
      const svnLengthOffset = 1 + mainVersionLength;
      const svnLength = body[svnLengthOffset] ?? 0;
      const svnBytes = body.subarray(svnLengthOffset + 1, svnLengthOffset + 1 + svnLength);
      let svnVersion = 0;
      for (let index = 0; index < svnBytes.length; index += 1) {
        svnVersion += (svnBytes[index] ?? 0) * 2 ** (index * 8);
      }
      return {
        type: "vice_info",
        requestId,
        errorCode,
        version,
        versionString: version.join("."),
        svnVersion,
      };
    }
    case ResponseType.CheckpointInfo: {
      const operation = body[11] ?? 0x04;
      const checkpoint: ParsedCheckpoint = {
        id: body.readUInt32LE(0),
        currentlyHit: body[4] === 1,
        start: body.readUInt16LE(5),
        end: body.readUInt16LE(7),
        stopWhenHit: body[9] === 1,
        enabled: body[10] === 1,
        operation,
        temporary: body[12] === 1,
        hitCount: body.readUInt32LE(13),
        ignoreCount: body.readUInt32LE(17),
        hasCondition: body[21] === 1,
      };
      return { type: "checkpoint_info", requestId, errorCode, checkpoint };
    }
    case ResponseType.CheckpointList: {
      // total's checkpoints are filled by request-id correlation across the
      // preceding CHECKPOINT_INFO events sharing this request id -- that
      // demux is plan 02-06's, not this parser's; always empty here, same as
      // the vendor.
      return { type: "checkpoint_list", requestId, errorCode, total: body.readUInt32LE(0), checkpoints: [] };
    }
    case ResponseType.DisplayGet: {
      // Layout: [info_len:u32LE][dw,dh,xo,yo,iw,ih:u16LE each][bpp:1]
      // [buflen:u32LE][buffer...]. buflenOff and the pixel-buffer start are
      // DERIVED from infoLength, never hardcoded to 17/21 -- see this file's
      // header comment on the vendor's off-by-four defect, and
      // probe-binmon.mjs:parseDisplayGet()'s matching, already-tested
      // derivation.
      const infoLength = body.readUInt32LE(0);
      const buflenOffset = 4 + infoLength;
      const imageLength = body.readUInt32LE(buflenOffset);
      const bufStart = buflenOffset + 4;
      return {
        type: "display",
        requestId,
        errorCode,
        debugWidth: body.readUInt16LE(4),
        debugHeight: body.readUInt16LE(6),
        debugOffsetX: body.readUInt16LE(8),
        debugOffsetY: body.readUInt16LE(10),
        innerWidth: body.readUInt16LE(12),
        innerHeight: body.readUInt16LE(14),
        bitsPerPixel: body[16] ?? 0,
        imageBytes: body.subarray(bufStart, bufStart + imageLength),
      };
    }
    case ResponseType.PaletteGet: {
      const count = body.readUInt16LE(0);
      let offset = 2;
      const items: ParsedPaletteItem[] = [];
      for (let index = 0; index < count; index += 1) {
        const itemSize = body[offset] ?? 0;
        items.push({
          index,
          red: body[offset + 1] ?? 0,
          green: body[offset + 2] ?? 0,
          blue: body[offset + 3] ?? 0,
        });
        offset += itemSize + 1;
      }
      return { type: "palette", requestId, errorCode, items };
    }
    case ResponseType.Stopped:
      return { type: "stopped", requestId, errorCode, programCounter: body.readUInt16LE(0) };
    case ResponseType.Resumed:
      return { type: "resumed", requestId, errorCode, programCounter: body.readUInt16LE(0) };
    case ResponseType.Jam:
      // Defect (a) fix: never call readUInt16LE on a body that might be
      // zero-length. programCounter is null, not a fabricated 0.
      return { type: "jam", requestId, errorCode, programCounter: body.length >= 2 ? body.readUInt16LE(0) : null };
    case ResponseType.Undump:
      return { type: "undump", requestId, errorCode, programCounter: body.readUInt16LE(0) };
    default:
      return { type: "unknown", requestId, errorCode, responseType };
  }
}

// ---------------------------------------------------------------------------
// Buffer framing
// ---------------------------------------------------------------------------

export interface ParseCounters {
  desyncBytes: number;
}

export interface ParseBufferResult {
  responses: Array<ParsedResponse | StockProtocolError | StockFramingError>;
  remainder: Buffer;
  desyncBytes: number;
}

/**
 * Frame and parse every complete response in `buffer`, returning the
 * unconsumed tail as `remainder` for the next chunk. Defect (b) fix: an STX
 * mismatch or an implausible declared body length never throws -- the parser
 * advances exactly one byte, counts it in `counters.desyncBytes` (mutated in
 * place, so a caller can track a running total across many calls), and keeps
 * scanning within this same call. A declared body length above MAX_BODY_LEN
 * is treated identically -- skipped one byte at a time, never allocated
 * against. This function never throws; StockFramingError/StockProtocolError
 * raised by parseResponse() below are caught here and returned inside
 * `responses` rather than escaping the loop.
 */
export function parseBuffer(buffer: Buffer, counters: ParseCounters = { desyncBytes: 0 }): ParseBufferResult {
  const responses: Array<ParsedResponse | StockProtocolError | StockFramingError> = [];
  let offset = 0;
  let desyncEpisodeActive = false;

  while (offset + RESPONSE_HEADER_LEN <= buffer.length) {
    if (buffer[offset] !== VICE_STX) {
      if (!desyncEpisodeActive) {
        console.error(
          `[framing] desync at offset ${offset} (byte 0x${buffer[offset]!.toString(16).padStart(2, "0")} is not STX) -- resyncing one byte at a time`,
        );
        desyncEpisodeActive = true;
      }
      offset += 1;
      counters.desyncBytes += 1;
      continue;
    }

    const bodyLength = buffer.readUInt32LE(offset + 2);
    if (bodyLength > MAX_BODY_LEN) {
      if (!desyncEpisodeActive) {
        console.error(
          `[framing] implausible body length ${bodyLength} at offset ${offset} -- treating as desync, resyncing one byte`,
        );
        desyncEpisodeActive = true;
      }
      offset += 1;
      counters.desyncBytes += 1;
      continue;
    }

    const frameLength = RESPONSE_HEADER_LEN + bodyLength;
    if (offset + frameLength > buffer.length) {
      break; // frame incomplete -- wait for more bytes, buffer left intact from here
    }

    desyncEpisodeActive = false;

    const apiVersion = buffer[offset + 1]!;
    const responseType = buffer[offset + 6]!;
    const errorCode = buffer[offset + 7]!;
    const requestId = buffer.readUInt32LE(offset + 8);
    const body = buffer.subarray(offset + RESPONSE_HEADER_LEN, offset + frameLength);

    try {
      responses.push(parseResponse({ apiVersion, responseType, errorCode, requestId, body }));
    } catch (err) {
      if (err instanceof StockFramingError || err instanceof StockProtocolError) {
        responses.push(err);
      } else {
        // Not one of parseResponse()'s two documented throw types -- a
        // genuinely unexpected bug, not a wire-format event this seam is
        // designed to absorb. Let it surface rather than silently swallowing
        // a real defect.
        throw err;
      }
    }

    offset += frameLength;
  }

  return { responses, remainder: buffer.subarray(offset), desyncBytes: counters.desyncBytes };
}

// ---------------------------------------------------------------------------
// Socket layer (Task 2) -- drives parseBuffer() off a real net.Socket. Does
// NOT add correlation, a pending map, request minting, or event demux --
// plan 02-06 builds that layer on top of this one, in this same file.
// ---------------------------------------------------------------------------

export interface ConnectOptions {
  timeoutMs?: number;
}

export interface ViceMonitorClientCounters {
  desyncBytes: number;
  /** Reserved for plan 02-06's request-id correlation layer to increment on
   * a duplicate reply for an already-resolved request id. Always 0 here --
   * detecting a duplicate needs the pending-request map this plan
   * deliberately does not build. */
  duplicateReplies: number;
}

/**
 * Raw binary-monitor socket client: connect/disconnect plus a 'response'
 * event per parsed frame. Wraps parseBuffer() in a try/catch that, on any
 * unexpected throw, drops the buffer to empty and emits 'desync' rather than
 * leaving a concatenated-but-unadvanced buffer that would repeat the same
 * throw on every subsequent chunk -- the structural, call-site-level fix for
 * the vendor's defect (b) failure mode, on top of parseBuffer()'s own
 * parser-level fix above. Also caps accumulated buffering: unparsed bytes
 * above MAX_BODY_LEN without a complete frame are a desync (reset + emit),
 * never an unbounded Buffer.concat growth path.
 */
export class ViceMonitorClient extends EventEmitter {
  #socket: net.Socket | null = null;
  #buffer: Buffer = Buffer.alloc(0);
  #desyncBytes = 0;
  #duplicateReplies = 0;
  #onDataBound = (chunk: Buffer) => this.#onData(chunk);
  #onCloseBound = () => this.#onClose();
  #onErrorBound = (err: Error) => this.#onError(err);

  get connected(): boolean {
    return this.#socket != null && !this.#socket.destroyed;
  }

  get counters(): ViceMonitorClientCounters {
    return { desyncBytes: this.#desyncBytes, duplicateReplies: this.#duplicateReplies };
  }

  connect(host: string, port: number, { timeoutMs = 5000 }: ConnectOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });

      const onConnect = () => {
        clearTimeout(timer);
        socket.removeListener("error", onConnectError);
        this.#socket = socket;
        this.#buffer = Buffer.alloc(0);
        socket.on("data", this.#onDataBound);
        socket.on("close", this.#onCloseBound);
        socket.on("error", this.#onErrorBound);
        resolve();
      };
      const onConnectError = (err: Error) => {
        clearTimeout(timer);
        reject(err);
      };
      const timer = setTimeout(() => {
        socket.removeListener("connect", onConnect);
        socket.removeListener("error", onConnectError);
        socket.destroy();
        reject(new ViceError(`connect to ${host}:${port} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      socket.once("connect", onConnect);
      socket.once("error", onConnectError);
    });
  }

  disconnect(): Promise<void> {
    const socket = this.#socket;
    this.#socket = null;
    this.#buffer = Buffer.alloc(0);
    if (!socket) {
      return Promise.resolve();
    }
    socket.removeListener("data", this.#onDataBound);
    socket.removeListener("close", this.#onCloseBound);
    socket.removeListener("error", this.#onErrorBound);
    return new Promise((resolve) => {
      socket.once("close", () => resolve());
      socket.destroy();
    });
  }

  #onData(chunk: Buffer): void {
    let combined: Buffer;
    try {
      combined = Buffer.concat([this.#buffer, chunk]);
      const counters: ParseCounters = { desyncBytes: this.#desyncBytes };
      const { responses, remainder, desyncBytes } = parseBuffer(combined, counters);
      this.#desyncBytes = desyncBytes;

      if (remainder.length > MAX_BODY_LEN) {
        // Accumulated unparsed bytes without a complete frame, past the cap
        // -- this is the DoS shape RESEARCH.md flags in the vendor client's
        // unbounded Buffer.concat growth path. Reset rather than keep
        // growing.
        const skipped = remainder.length;
        this.#buffer = Buffer.alloc(0);
        this.#desyncBytes += skipped;
        this.emit(
          "desync",
          new StockDesyncError(
            `accumulated buffer exceeded MAX_BODY_LEN (${MAX_BODY_LEN}) without a complete frame -- buffer reset`,
            { bytesSkipped: skipped },
          ),
        );
      } else {
        this.#buffer = remainder;
      }

      for (const item of responses) {
        if (item instanceof StockProtocolError || item instanceof StockFramingError) {
          this.emit("protocol-error", item);
        } else {
          this.emit("response", item);
        }
      }
    } catch (err) {
      // Defensive backstop: parseBuffer() is designed to never throw, but if
      // it somehow does, drop the buffer rather than poisoning the
      // connection with a concatenated-but-unadvanced buffer that would
      // repeat the same throw on every subsequent chunk.
      this.#buffer = Buffer.alloc(0);
      const message = err instanceof Error ? err.message : String(err);
      this.emit("desync", new StockDesyncError(`unexpected throw while parsing binmon stream: ${message}`));
    }
  }

  #onClose(): void {
    this.#socket = null;
    this.#buffer = Buffer.alloc(0);
    this.emit("close");
  }

  #onError(err: Error): void {
    this.emit("transport-error", err);
  }
}
