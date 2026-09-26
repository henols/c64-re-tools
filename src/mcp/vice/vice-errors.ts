#!/usr/bin/env node
// vice-errors.ts
//
// WHY THIS FILE EXISTS: the shared error hierarchy and lease-state
// accessors, used by BOTH the fork transport's former callers and the
// surviving stock lease-acquisition path. Split out of vice.ts (removing
// the forked VICE MCP backend) because buildHeldLease() in vice-proxy.ts
// reads activeInstance() on EVERY tool call, on BOTH backends, through
// ensureBrokerLease() -- deleting vice.ts wholesale would have broken stock
// lease acquisition, not just the fork's own transport.
//
// WHAT NOT TO DO:
//   - The fork transport (call(), rpc(), ensureInitialized(), withReconnect(),
//     the outer-name refusal array and its refusal-message builder, and the
//     session-identity apparatus: SessionInfo, beginSession(),
//     sessionReconnects(), lastToolCall(), assertSameMachine()) was deleted
//     along with vice.ts once it had no remaining stock-path consumer. Never
//     reintroduce any of it here -- this module is backend-agnostic by
//     design, and none of that apparatus has a place to come back to.

export interface ActiveInstance {
  port: number;
  url: string;
  pooled: boolean;
}

// -------------------------------------------------------- active instance
//
// Mutable module-level state: useInstance() below is the only writer, and
// every read goes through activeInstance(), so a lease redirect takes
// effect everywhere at once.

// LEGACY PORT DEFAULT: the pre-split fallback derived its default port by
// parsing vice.ts's DEFAULT_ENDPOINT, an HTTP-URL-shaped constant that only
// ever made sense for the fork's HTTP transport. That derivation is NOT
// carried across this split: every stock caller of activeInstance() --
// starting with buildHeldLease() in vice-proxy.ts, reached through
// ensureBrokerLease() on EVERY tool call, on every backend -- runs strictly
// AFTER a useInstance() write has already replaced this fallback (traced
// during the split: ensureBrokerLease()'s only path to buildHeldLease()
// without a prior write returns early via the VICE_MCP_URL override branch,
// which never calls activeInstance() at all). LEGACY_DEFAULT_PORT is
// therefore a plain, self-contained numeric default, kept only so this
// module never hands back an ill-typed ActiveInstance before any lease
// exists: the 6510-6599 band reserved by convention for an x64sc a human
// launches on the host for their OWN work, never the broker's own
// allocated band (6600+, DEFAULT_BASE_PORT in broker-state.mts).
const LEGACY_DEFAULT_PORT = 6510;

let activeUrl: string = `http://127.0.0.1:${LEGACY_DEFAULT_PORT}/mcp`;
let activePort: number = LEGACY_DEFAULT_PORT;
// Not part of the seam redirect itself (nothing in this file reads this to
// decide behaviour) -- carried purely as identity metadata so a caller like
// an incident record can note whether an instance came from a pooled grant
// or the unpooled default, without needing its own separate channel back to
// whatever acquired the lease. Extra, optional field on useInstance()'s
// object arg -- a caller passing only {port,url} (the documented
// minimum) still works exactly as before, defaulting to false.
let activePooled = false;

export interface UseInstanceOptions {
  port: number;
  url: string;
  pooled?: boolean;
}

/**
 * Redirect the lease seam to a specific pooled (or fallback) instance.
 *
 * This function is deliberately backend-agnostic: it only updates the
 * lease-state accessors above. It does NOT reset the fork transport's own
 * MCP handshake flag (vice.ts's `initialized`) -- that variable is owned by
 * vice.ts, not this module, and the fork transport now derives its own
 * "is this handshake still valid" answer by comparing
 * its last-initialized URL against activeInstance().url on every call (see
 * vice.ts's ensureInitialized()), rather than this function reaching across
 * a module boundary to flip a flag it does not own.
 */
export function useInstance({ port, url, pooled = false }: UseInstanceOptions): void {
  activeUrl = url;
  activePort = port;
  activePooled = pooled;
}

/** Read-only accessor: the instance the seam is currently pointed at. */
export function activeInstance(): ActiveInstance {
  return { port: activePort, url: activeUrl, pooled: activePooled };
}

export interface ViceErrorOptions {
  code?: number | string;
  data?: unknown;
}

export class ViceError extends Error {
  code?: number | string;
  data?: unknown;

  constructor(message: string, { code, data }: ViceErrorOptions = {}) {
    super(message);
    this.name = "ViceError";
    this.code = code;
    this.data = data;
  }
}

export interface MachineRestartedErrorOptions {
  baselineEpoch?: number | null;
  currentEpoch?: number | null;
  where?: string;
  lastToolCall?: string | null;
}

/**
 * Thrown when a reconnect happened and the emulator's identity across that
 * reconnect could not be proven -- either the broker reports a different
 * epoch for the grant, or no epoch could be read to prove it didn't.
 * Carries the evidence a caller needs to write a void note: the epochs
 * compared, where in the pipeline the check ran, and the last tool
 * call attempted before detection.
 */
export class MachineRestartedError extends ViceError {
  baselineEpoch?: number | null;
  currentEpoch?: number | null;
  where?: string;
  lastToolCall?: string | null;

  constructor(message: string, { baselineEpoch, currentEpoch, where, lastToolCall }: MachineRestartedErrorOptions = {}) {
    super(message);
    this.name = "MachineRestartedError";
    this.baselineEpoch = baselineEpoch;
    this.currentEpoch = currentEpoch;
    this.where = where;
    this.lastToolCall = lastToolCall;
  }
}

// A single tool's discovery metadata, as returned by the fork's tools/list
// RPC. Moved here (rather than left in vice.ts) because stock-tools.ts
// needs the TYPE ONLY, with no other dependency on the fork transport that
// declares it.
export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
  [key: string]: unknown;
}
