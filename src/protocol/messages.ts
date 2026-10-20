// The message layer of the Host Runtime wire: protocol identity, error codes, the message shapes and
// their parsers, and the field checks that every validator uses.

import { ERROR_CODES, Refusal, type ErrorCode } from "../errors.ts";
import type { ToolOperation, ToolOperations } from "./tools.ts";
import type { ViceOperation, ViceOperations } from "./vice.ts";

/** Private Host Runtime protocol identifier. */
export const HOST_PROTOCOL_ID = "c64-re-tools-host" as const;
/** Bumped on any incompatible change; a mismatch fails the handshake. */
export const HOST_PROTOCOL_VERSION = 5;
/** After ready, the client pings this often, on every connection. */
export const HEARTBEAT_INTERVAL_MS = 10_000;
/** Either side closes a connection that has sent nothing for this long. */
export const HEARTBEAT_TIMEOUT_MS = 30_000;
/** The Host Runtime listens on 127.0.0.1 at this port by default. */
export const DEFAULT_HOST_PORT = 6464;

// ---------------------------------------------------------------------------
// Shared vocabulary

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
  /** The package version of the client (see checkRelease). A client of an older protocol version sends none. */
  release?: string;
  role: Role;
  /** vice-session only; fixed for the session. */
  videoStandard?: VideoStandard;
}

export interface Ready {
  type: "ready";
  /** The package version of the host (see checkRelease). */
  release: string;
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
/**
 * The instruction at the end of a refusal that only the user can fix: a
 * missing or broken tool, or a Host Runtime that does not run.
 */
export const STOP_AND_ASK = "Stop the task. Give this message to the user and wait for the user. Do not make a replacement for the tool or the host runtime.";

/** The message with STOP_AND_ASK at its end, once. */
export function withStopAndAsk(message: string): string {
  return message.endsWith(STOP_AND_ASK) ? message : `${message} ${STOP_AND_ASK}`;
}

/** The message that the agent sees for a refusal: an installation-incomplete one ends with STOP_AND_ASK. */
export function shownMessage(error: { code: string; message: string }): string {
  return error.code === "installation-incomplete" ? withStopAndAsk(error.message) : error.message;
}

/** A refusal that crosses the Host Runtime wire. */
export class WireFailure extends Refusal implements WireError {
  override name = "WireFailure";

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
    if (value.release !== undefined && typeof value.release !== "string") throw new ProtocolError("hello has a release that is not a string");
    if (!isOneOf(ROLES, value.role)) throw new ProtocolError("hello has an unknown role");
    if (value.videoStandard !== undefined && !isOneOf(VIDEO_STANDARDS, value.videoStandard)) {
      throw new ProtocolError("hello has an unknown video standard");
    }
    const hello: Hello = { type: "hello", protocol: value.protocol, version: value.version, role: value.role };
    if (value.release !== undefined) hello.release = value.release;
    if (value.videoStandard !== undefined) hello.videoStandard = value.videoStandard;
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
  if (value.type === "ready") {
    if (typeof value.release !== "string") throw new ProtocolError("ready lacks the release");
    return { type: "ready", release: value.release };
  }
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

const OLDER_HOST: WireError = {
  code: "installation-incomplete",
  message:
    "The c64-re-tools host runtime is from an older release than this client. " +
    "Stop the host runtime and start it again with the same npx command. npx then starts the newest release.",
};
const OLDER_CLIENT: WireError = {
  code: "installation-incomplete",
  message:
    "This client is from an older release of c64-re-tools than the host runtime. " +
    "Restart the agent session, so that npx starts the newest MCP server. " +
    "For the skill scripts, run c64-re-tools update in the project.",
};

/** A development checkout (0.0.0-development) can run against any release; the protocol version still applies. */
function isDevelopment(release: string): boolean {
  return release.startsWith("0.0.0-");
}

/** The numbers and the prerelease of a version such as 2.1.4 or 2.2.0-rc.1, for the order of releases. */
function releaseOrder(release: string): { core: number[]; prerelease: string[] } {
  const [core = "", ...rest] = release.split("-");
  const prerelease = rest.join("-");
  return { core: core.split(".").map((part) => Number(part) || 0), prerelease: prerelease === "" ? [] : prerelease.split(".") };
}

/** Negative when release a is older than b, as semantic versioning orders them. */
function compareReleases(a: string, b: string): number {
  const left = releaseOrder(a);
  const right = releaseOrder(b);
  for (let index = 0; index < 3; index++) {
    const difference = (left.core[index] ?? 0) - (right.core[index] ?? 0);
    if (difference !== 0) return difference;
  }
  // A prerelease comes before its release.
  if (left.prerelease.length === 0 || right.prerelease.length === 0) return right.prerelease.length - left.prerelease.length;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index++) {
    const l = left.prerelease[index];
    const r = right.prerelease[index];
    if (l === undefined || r === undefined) return l === undefined ? -1 : 1;
    if (l === r) continue;
    const numeric = /^\d+$/.test(l) && /^\d+$/.test(r);
    return numeric ? Number(l) - Number(r) : l < r ? -1 : 1;
  }
  return 0;
}

/**
 * Refuses a client and a host of different releases, and names the older side
 * and how to update it. The protocol version is bumped by hand and a release
 * can change the wire without it, so both sides also compare their package
 * versions. A development checkout passes against any release.
 */
export function checkRelease(client: string, host: string): WireError | undefined {
  if (client === host || isDevelopment(client) || isDevelopment(host)) return undefined;
  return { ...(compareReleases(host, client) < 0 ? OLDER_HOST : OLDER_CLIENT) };
}

/**
 * Checks a hello against this build's protocol and the host's release
 * (`release`). Returns the failure to send, or undefined. Refuses a client of
 * another protocol version or release, and names the older side and how to
 * update it.
 */
export function checkHello(hello: Hello, release: string): WireError | undefined {
  if (hello.protocol !== HOST_PROTOCOL_ID) {
    return {
      code: "installation-incomplete",
      message:
        "The c64-re-tools host runtime and this client come from different installations. " +
        "Install the same c64-re-tools release for both and restart the host runtime.",
    };
  }
  if (hello.version > HOST_PROTOCOL_VERSION) return { ...OLDER_HOST };
  if (hello.version < HOST_PROTOCOL_VERSION || hello.release === undefined) return { ...OLDER_CLIENT };
  return checkRelease(hello.release, release);
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
