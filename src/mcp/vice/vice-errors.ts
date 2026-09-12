#!/usr/bin/env node
// vice-errors.ts
//
// WHY THIS FILE EXISTS: the shared error hierarchy and lease-state
// accessors, used by BOTH the fork transport's former callers and the
// surviving stock lease-acquisition path. Split out of vice.ts (removing
// the forked VICE MCP backend) because buildHeldLease() in vice-proxy.ts
// reads activeInstance() on EVERY tool call, on BOTH backends, through
// ensureBrokerLease() -- deleting vice.ts wholesale would have broken stock
// lease acquisition, not just the fork's own transport. See
// docs/stock-hard-losses.md for the stock backend's own accepted hardware
// limitations, a related but separate concern.
//
// WHAT NOT TO DO:
//   - The fork transport (call(), rpc(), ensureInitialized(), withReconnect(),
//     the outer-name refusal array and its refusal-message builder, and the
//     session-identity apparatus: SessionInfo, beginSession(),
//     sessionReconnects(), lastToolCall(), assertSameMachine()) was deleted
//     along with vice.ts once it had no remaining stock-path consumer. Never
//     reintroduce any of it here -- this module is backend-agnostic by
//     design, and none of that apparatus has a place to come back to.
import { resolve, join } from "node:path";
import { readFileSync } from "node:fs";

import { supervisorDir } from "./repo-root.ts";
import { isInsideContainer, type ContainerGuardDeps } from "./container-guard.mts";

// The address of the host machine -- the ONE definition every consumer that
// needs to build a host-facing URL from a bare port reads, instead of each
// inlining its own `process.env.VICE_MCP_HOST || "host.docker.internal"`
// copy (there were three such copies before vice.ts's own predecessor
// consolidated them). A FUNCTION, not a module-level constant, so it stays
// sensitive to a runtime env override -- some tests mutate
// process.env.VICE_MCP_HOST across cases within the SAME process, which a
// constant captured once at import time would silently stop honouring.
//
// CONTAINER-AWARE (2026-08-05, developer instruction). The default was
// previously the bare literal "host.docker.internal", which is correct in
// exactly ONE of the two environments this code runs in: it is a
// Docker-provided alias, published into the container by
// .devcontainer/devcontainer.json's `--add-host=host.docker.internal:host-gateway`,
// and it does not resolve on the host at all. Host-bound modules genuinely
// do consume this tree (vice-broker.mts references vice-broker-client), so
// a single unconditional answer was wrong for one side by construction.
//
// Detection is delegated to container-guard.mts's isInsideContainer() rather
// than re-derived -- see that function's own comment for why a second
// detector is a bug waiting to happen here.
//
// Non-container branch is 127.0.0.1 rather than "localhost" DELIBERATELY:
// "localhost" may resolve to ::1 first, and the broker binds 0.0.0.0 --
// IPv4-only (broker-control.mts's documented bind), so an IPv6 loopback
// connect would be refused by a listener that is in fact running. An
// explicit IPv4 literal cannot pick the wrong family. It also classifies as
// `loopback` under vice-broker-client.ts's classifyConnectHost(), which
// that resolver deliberately does NOT refuse, and is not `wildcard_bind`,
// so it does not trip the pre-connect refusal.
export function mcpHost(deps?: ContainerGuardDeps): string {
  return process.env.VICE_MCP_HOST || (isInsideContainer(deps) ? "host.docker.internal" : "127.0.0.1");
}

// Where tools/vice-supervisor.sh (host-only) writes its restart epoch --
// resolved via repo-root.ts's supervisorDir() (never a fixed hop count off
// this file's own location), so the path is correct regardless of the
// caller's cwd AND regardless of how deep this file sits under the repo
// root. Overridable for tests and for anyone running the supervisor with a
// non-default VICE_SUPERVISOR_DIR. This remains the default that
// activeEpochFile below starts from.
export const EPOCH_FILE: string = process.env.VICE_EPOCH_FILE
  ? resolve(process.env.VICE_EPOCH_FILE)
  : join(supervisorDir(), "epoch.json");

export interface ActiveInstance {
  port: number;
  url: string;
  epochFile: string;
  pooled: boolean;
}

// -------------------------------------------------------- active instance
//
// Mutable module-level state, deliberately NOT frozen at module load:
// restart detection has to stay correct PER INSTANCE, which is impossible if
// the epoch path is fixed at import time. useInstance() below is the only
// writer; every other read goes through the functions in this file so a
// lease redirect takes effect everywhere at once -- vice.ts's rpc() reads
// its POST target through activeInstance().url, readEpoch()'s own default
// path reads activeEpochFile directly (same module), and vice.ts's
// beginSession() reads its default epoch path through
// activeInstance().epochFile. None of those three read this module's
// private state directly except readEpoch() itself, which lives here.

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

let activeUrl: string = `http://${mcpHost()}:${LEGACY_DEFAULT_PORT}/mcp`;
let activeEpochFile: string = EPOCH_FILE;
let activePort: number = LEGACY_DEFAULT_PORT;
// Not part of the seam redirect itself (nothing in this file reads this to
// decide behaviour) -- carried purely as identity metadata so a caller like
// an incident record can note whether an instance came from a pooled grant
// or the unpooled default, without needing its own separate channel back to
// whatever acquired the lease. Extra, optional field on useInstance()'s
// object arg -- a caller passing only {port,url,epochFile} (the documented
// minimum) still works exactly as before, defaulting to false.
let activePooled = false;

export interface UseInstanceOptions {
  port: number;
  url: string;
  epochFile: string;
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
export function useInstance({ port, url, epochFile, pooled = false }: UseInstanceOptions): void {
  activeUrl = url;
  activeEpochFile = epochFile;
  activePort = port;
  activePooled = pooled;
}

/** Read-only accessor: the instance the seam is currently pointed at. */
export function activeInstance(): ActiveInstance {
  return { port: activePort, url: activeUrl, epochFile: activeEpochFile, pooled: activePooled };
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
 * reconnect could not be proven -- either the epoch file shows it changed,
 * or nothing (no epoch file, no surviving armed checkpoint) could prove it
 * didn't. Carries the evidence a caller needs to write a void note: the
 * epochs compared, where in the pipeline the check ran, and the last tool
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

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches vice.ts's own (and vice-broker.mts's / vice-broker-
 * client.ts's) isPlainObject() predicate exactly -- the same narrowing
 * discipline this module tree uses everywhere a parsed JSON value's fields
 * are touched. Kept as a private, un-exported duplicate rather than an
 * import from vice.ts, per this file's own "never import from vice.ts"
 * rule above -- the same duplication-over-cross-import choice this tree
 * already makes for its other small, single-purpose narrowing helpers. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface EpochResult {
  present: boolean;
  epoch: number | null;
  spawned_at: string | null;
  pid: number | null;
  path: string;
  reason?: string;
}

/**
 * Read the supervisor's epoch file. Synchronous -- this is a plain, cheap
 * file read; the whole point of the epoch check is that it costs zero MCP
 * traffic, unlike the checkpoint-fallback probe. NEVER throws: absence is
 * normal (no supervisor running at all) and must not be an error -- the
 * harness has to keep working exactly as it does today with no supervisor.
 *
 * Treats the file's contents as untrusted, host-written input: JSON.parse
 * in try/catch, `epoch` must decode to a finite integer, unknown fields are
 * ignored, and no path derived from the file's contents is ever opened.
 */
export function readEpoch(path: string = activeEpochFile): EpochResult {
  const absent: EpochResult = { present: false, epoch: null, spawned_at: null, pid: null, path };
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { ...absent, reason: "epoch file absent" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...absent, reason: "epoch file present but not valid JSON" };
  }
  if (!isPlainObject(parsed) || !Number.isInteger(parsed.epoch)) {
    return { ...absent, reason: 'epoch file present but its "epoch" field is not a finite integer' };
  }
  return {
    present: true,
    epoch: parsed.epoch as number,
    spawned_at: typeof parsed.spawned_at === "string" ? parsed.spawned_at : null,
    pid: typeof parsed.pid === "number" && Number.isFinite(parsed.pid) ? parsed.pid : null,
    path,
  };
}

// A single tool's discovery metadata, as returned by the fork's tools/list
// RPC. Moved here (rather than left in vice.ts) because stock-dispatch.ts
// needs the TYPE ONLY, with no other dependency on the fork transport that
// declares it.
export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
  [key: string]: unknown;
}
