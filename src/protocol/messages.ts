// The message layer of the Host Runtime wire: protocol identity, error codes, the message shapes and
// their parsers, and the field checks that every validator uses.

import type { ToolOperation, ToolOperations } from "./tools.ts";
import type { ViceOperation, ViceOperations } from "./vice.ts";

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

export function invalid(message: string): never {
  throw new WireFailure("invalid-input", message);
}

/** Refuses a field that is not in `allowed`, the same way for every operation. */
export function onlyFields(value: Fields, allowed: readonly string[], where?: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) invalid(where === undefined ? `unknown field: ${key}` : `unknown field in ${where}: ${key}`);
  }
}
