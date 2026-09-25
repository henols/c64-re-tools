#!/usr/bin/env node
// Container-side half of the on-demand broker protocol. This module used to
// write the request/lease files resources/vice-broker.sh read and read the
// grant/denial/broker files that script wrote, all on the SAME
// .vice-supervisor/ bind mount tools/vice-supervisor.sh's epoch.json already
// used. That whole file protocol is now deleted wholesale (six mechanisms
// retiring together -- startHeartbeat()/the mtime-as-heartbeat
// convention/touchLease()/pollGrant()/pollRecycleAck()/the request-grant-
// denial-lease-recycle-ack directory tree) now that vice-proxy.ts's
// acquisition and release run over the TCP control plane
// (openBrokerControl()/BrokerControlSession below) instead. What survives:
// the request-id primitives (the new client's own acquire() still
// mint ids with newRequestId()), brokerRootDir()/brokerJsonPath() (the
// discovery record's own location -- the machine-level root broker-home.mts
// resolves, not any project's tree; see brokerRootDir()'s own comment below,
// G-64-1), and readBrokerLiveness() (unchanged classification, still reading
// the SAME broker.json openBrokerControl() reads for its control_host/
// control_port/control_token).
//
// Every read of broker.json is still untrusted input: parse in try/catch, a
// malformed or half-written file is "not there yet" or "absent", never a
// thrown exception -- the never-throw, never-cache-a-negative-result
// posture this module holds throughout.
//
// MUST NOT import hostpath.ts: the host-path consumer set is closed to
// exactly four production modules (containerpath.ts, install-resources.ts,
// stock-paths.ts, vice-proxy.ts), pinned by hostpath-consumers.test.ts, and
// host-path message text stays in vice-proxy.ts, which is already on that
// list.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { connect, type Socket } from "node:net";

// A VALUE import of the machine-level state resolver (Phase 64, plan 64-10,
// G-64-1's secondary cause) -- broker-home.mts carries only `node:` imports,
// so it loads unbuilt from this container-side module exactly as
// stock-connect.ts's own value import of backend-detect.mts does. See
// brokerRootDir() below for why this replaced repo-root.ts's supervisorDir().
import { brokerStateDir } from "./broker-home.mts";
// TYPE-ONLY, and IMPORTED rather than
// redeclared. broker-launch.mts is the one definition of the profile shape and
// the module that turns a profile into argv; a second local shape here is how
// a client would start requesting a knob the host cannot honour. Type-only, so
// the container-side bundle never resolves the host-bound module at runtime.
import type { LaunchProfile } from "./broker-launch.mts";
// backend-detect.mts is ViceBackend's one home (narrowed to a single literal
// now that the fork backend has been removed entirely). Type-only, same
// discipline as the import above.
import type { ViceBackend } from "./backend-detect.mts";
// The module tree's ONE definition of the container-visible host alias
// (vice.ts:49), carrying its own VICE_MCP_HOST override -- consumed below by
// resolveControlTarget() rather than a fourth `host.docker.internal` literal
// (vice.ts:35-48 names the three duplicate copies that predated that
// function; this file must not become a fourth). Deliberately NOT
// `containerpath.ts`'s `containerHost()`: that function rewrites URL
// *strings*, not bare hostnames; its own loopback matcher structurally
// EXCLUDES `0.0.0.0` (a wildcard bind is not loopback, so the very address
// at fault here would pass through it untouched); `containerpath.ts:32-37`
// states outright that it does not know the container-visible host alias;
// and importing it would pull `hostpath.ts` into this module, which this
// file's own header (lines 23-26) forbids and which the host-path
// consumer-set assertion polices.
import { mcpHost, ViceError } from "./vice-errors.ts";

// -------------------------------------------------------------- request ids
//
// Primary noun of this protocol: a request/grant/lease is identified by
// this id, never by port -- ports are
// recycled across sessions under on-demand launch, so a port is an attribute
// OF a grant, not identity. Matched byte-for-byte against the same shape
// resources/vice-broker.sh's own request-id pattern validates (T-01.2-01);
// the request-id-pattern parity test in vice-broker.test.mjs drives one
// shared corpus through both validators so neither side can silently accept
// an id shape the other rejects.
//
// This is a real, typed, NAMED export whose VALUE is unchanged from
// the pre-conversion .mjs (verified live). The in-process broker imports
// this exact binding rather than re-stating the pattern a third time; the
// bash copy (resources/vice-broker.sh) does not retire until it is deleted.
export const REQUEST_ID_PATTERN: RegExp = /^req-[0-9]+-[0-9]+-[0-9a-f]{8}$/;

export function newRequestId(): string {
  return `req-${process.pid}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export function isValidRequestId(id: unknown): id is string {
  return typeof id === "string" && REQUEST_ID_PATTERN.test(id);
}

// -------------------------------------------------------------- directories
//
// G-64-1's secondary cause: this function used to resolve repo-root.ts's
// supervisorDir() -- a directory INSIDE whichever project checkout happens
// to be current. That is wrong for a machine-level broker: none of the
// documented start routes (`npx -y @henols/vice-mcp broker`, the committed
// systemd unit, the committed launchd agent) run with a project argument at
// all, so the broker itself never wrote anything there -- only
// vice-launcher.sh's `--repo-root` pin (the one route that DOES have a
// project) ever made the two agree, and that agreement came at the cost of
// putting broker state inside one project's tree, which BROKER-06 forbids.
// This function now delegates to broker-home.mts's brokerStateDir(), the
// SAME resolver the broker itself calls (vice-broker.mts's parseArgs()),
// so client and broker can no longer drift apart on where broker.json
// lives -- one resolver, imported on both sides, never recomputed here.
// brokerStateDir() already honours VICE_POOL_DIR first, so that override's
// meaning is unchanged. The five sibling directory helpers this function
// used to anchor (requestsDir/grantsDir/denialsDir/brokerLeasesDir/
// recycleAcksDir) and the lease path helper (leasePathFor) are GONE, not
// merely unused -- their directories cease to exist now that the file
// protocol is retired; only brokerJsonPath() below survives, since
// broker.json itself is not part of the retiring protocol.
export function brokerRootDir(): string {
  return brokerStateDir();
}

export function brokerJsonPath(dir: string = brokerRootDir()): string {
  return join(dir, "broker.json");
}

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Shared by readJsonMaybe()'s parse step, matching
 * vice-broker.mts's readBrokerRecordMaybe()'s own isPlainObject() predicate
 * exactly (that file's own doc comment states it matches this module's
 * posture). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read and JSON.parse `path`, treating any failure (missing file, partial
 * write, malformed JSON, non-object shape) as "not there yet" rather than
 * throwing -- matches the posture vice-pool.mjs's readRegistry() used
 * before its 2026-08-02 deletion. Two nested try/catch layers, one for the
 * read and one for the parse -- never collapsed into one, never replaced by
 * a thrown error (T-01.6.1-01). */
function readJsonMaybe(path: string): Record<string, unknown> | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// writeRequest/createLease/touchLease/releaseLease/pollGrant/pollRecycleAck
// and their record interfaces (RequestRecord, RecycleRequestRecord,
// LeaseRecord, PollOptions, PollGrantResult, PollRecycleAckResult) are GONE:
// the whole file-messaging protocol they implemented is replaced
// wholesale by the TCP control plane below. GRANT_POLL_TIMEOUT_MS/
// GRANT_POLL_INTERVAL_MS/RECYCLE_ACK_TIMEOUT_MS/RECYCLE_ACK_POLL_INTERVAL_MS
// (the retiring polls' own timeout/interval constants) and sleepMs() (their
// shared poll-delay helper) are gone with them -- nothing here polls a
// filesystem for a deadline any more.

export interface BrokerLivenessResult {
  state: "never_started" | "stale" | "alive";
  pid: number | null;
  heartbeatAt: string | null;
  path: string;
}

// --------------------------------------------------------- readBrokerLiveness
//
// Classifies broker.json as never_started / stale / alive against
// BROKER_STALE_MS. Plan 04 consumes the three states for its diagnostics;
// this task only needs the classification to exist and be correct.
export const BROKER_STALE_MS: number = Number(process.env.VICE_BROKER_STALE_MS || 180000);

/** Pure classification over an ALREADY-PARSED record (or null for "no file
 * read anything back") -- factored out of readBrokerLiveness() below so
 * openBrokerControl() (plan 06) can classify liveness against the SAME
 * broker.json read it already performed for control_host/control_port/
 * control_token, rather than re-reading the file a second time via a second
 * readBrokerLiveness() call. readBrokerLiveness()'s own exported behaviour is
 * unchanged by this split -- it still takes a path and returns the same
 * shape; this is purely an internal refactor. */
function classifyLivenessFromRecord(parsed: Record<string, unknown> | null, path: string): BrokerLivenessResult {
  if (parsed === null) {
    return { state: "never_started", pid: null, heartbeatAt: null, path };
  }
  const pid = typeof parsed.pid === "number" && Number.isFinite(parsed.pid) ? parsed.pid : null;
  const heartbeatAt = typeof parsed.heartbeat_at === "string" ? parsed.heartbeat_at : null;
  const heartbeatMs = heartbeatAt ? Date.parse(heartbeatAt) : NaN;
  if (!Number.isFinite(heartbeatMs)) {
    return { state: "never_started", pid, heartbeatAt, path };
  }
  const state: BrokerLivenessResult["state"] = Date.now() - heartbeatMs > BROKER_STALE_MS ? "stale" : "alive";
  return { state, pid, heartbeatAt, path };
}

export function readBrokerLiveness(path: string = brokerJsonPath()): BrokerLivenessResult {
  const parsed = readJsonMaybe(path);
  return classifyLivenessFromRecord(parsed, path);
}

// StartHeartbeatOptions/HEARTBEAT_MS/startHeartbeat() are GONE -- the
// lease-heartbeat interval (one of the six retiring mechanisms named above)
// has no successor. Nothing needs touching to prove a TCP connection is alive; it
// either is, or the broker's own "close" handler has already reclaimed the
// instance.

// -------------------------------------------------------- dial resolution
//
// `broker.json`'s `control_host` field is the broker's BIND address
// (vice-broker.mts:782 writes `listener.host` into it). The rule as settled
// for v2.0.0 (D-09, D-11): the broker binds IPv4 loopback plus the
// enumerated bridge-gateway addresses it finds at startup from an
// interface-name allowlist (`docker0`, `br-*`, `podman*`, `cni-*`), and
// never the wildcard address. A bind address is still not a dial address:
// `control_host` is one member of that enumerated set, and the recorded
// value flows through below as diagnostic text only, never as a candidate
// dial target. Both connect sites below (the tracer's own
// acquireOverControlPlane() and openBrokerControl() further down) resolve
// their target through resolveControlTarget() and never read `control_host`
// as anything but diagnostic text. This narrowing IS the broker's access
// control now, not a convenience -- the per-boot capability token is
// dropped under the new dial model (the `hello` handshake, plan 62-01), so a
// bind address only the intended network can reach is the mechanism
// standing in its place.
//
// `VICE_BROKER_CONTROL_DIAL_HOST` is a NEW variable, deliberately not a
// homonym of the EXISTING `VICE_BROKER_CONTROL_HOST` (the broker's own BIND
// host, set on the HOST side -- vice-broker.mts:671, broker-control.mts:507,
// driven in broker-control.test.ts:949). Collapsing the two into one
// variable would reproduce this exact defect in env-var form: one name
// cannot correctly answer both "what should I bind" and "what should I
// dial", for the same reason `control_host` itself cannot -- those are two
// different consumers wanting two different addresses.
export interface ResolvedControlTarget {
  host: string;
  port: number;
  source: "dial_override" | "bridge_alias";
  /** The record's OWN `control_host` value -- carried through for the
   * diagnostic only. Never a candidate dial target. */
  recorded: string;
}

export type ResolveControlTargetResult =
  | { ok: true; target: ResolvedControlTarget }
  | { ok: false; kind: "unreachable_control_plane"; message: string; target: string };

const IPV4_LOOPBACK_RE = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
// Fully-expanded IPv6 "::" (all eight groups zero) and "::1" (seven zero
// groups then 1) -- the WHATWG URL parser's own bracketed short forms are
// matched as literals below; this regex pair only needs to catch the
// long-hand spellings a bare hostname string might still carry.
const IPV6_ALL_ZEROS_RE = /^(0{1,4}:){7}0{1,4}$/;
const IPV6_LOOPBACK_FULL_RE = /^(0{1,4}:){7}0{0,3}1$/;

function stripBrackets(host: string): string {
  return host.replace(/^\[/, "").replace(/\]$/, "");
}

function isWildcardBindHost(host: string): boolean {
  const bare = stripBrackets(host);
  return bare === "0.0.0.0" || bare === "::" || IPV6_ALL_ZEROS_RE.test(bare);
}

function isLoopbackConnectHost(host: string): boolean {
  const bare = stripBrackets(host);
  return bare === "localhost" || bare === "::1" || IPV4_LOOPBACK_RE.test(bare) || IPV6_LOOPBACK_FULL_RE.test(bare);
}

/** Classifies a bare hostname (never a full URL) the same way
 * `containerpath.ts`'s `isLoopbackHostname()` classifies loopback --
 * matched STRUCTURALLY, whole address classes rather than single literals,
 * deliberately RE-STATED here rather than imported (see this section's own
 * header comment for why `containerpath.ts` is off-limits to this module).
 * `wildcard_bind` covers the IPv4/IPv6 "listen on everything" addresses in
 * their bracketed, unbracketed and fully-expanded spellings; `loopback`
 * covers the whole 127.0.0.0/8 block, `localhost`, and IPv6 loopback in the
 * same three spellings; everything else is `routable`. */
export function classifyConnectHost(host: string): "wildcard_bind" | "loopback" | "routable" {
  if (isWildcardBindHost(host)) return "wildcard_bind";
  if (isLoopbackConnectHost(host)) return "loopback";
  return "routable";
}

/** Resolves the address this process will actually DIAL for the control
 * plane -- never the record's own `control_host`, which flows through only
 * as `recorded`, never as a candidate target. Precedence:
 * `VICE_BROKER_CONTROL_DIAL_HOST` when set and non-empty (`source:
 * "dial_override"`), otherwise `mcpHost()` (`source: "bridge_alias"`) --
 * the SAME default source `vice-proxy.test.ts` already configures via
 * `VICE_MCP_HOST` at ~30 call sites, which is exactly why that source was
 * chosen: every one of those fixtures stays green with zero edits.
 *
 * Refuses -- before any connect is attempted -- when the resolved host
 * classifies as `wildcard_bind`: that class is an address to listen on,
 * never one to dial. Does NOT refuse `loopback`: an explicitly configured
 * loopback host is a statement that the listener lives inside THIS
 * container, which is the only topology the project's hard rule (nothing
 * may dial the real host directly) permits a test to exercise -- and a
 * loopback value can now only ever arrive from explicit configuration,
 * never from the record, since the record's own value is never treated as
 * a candidate. */
export function resolveControlTarget(record: Record<string, unknown>, port: number): ResolveControlTargetResult {
  const recorded = typeof record.control_host === "string" ? record.control_host : "";
  const override = process.env.VICE_BROKER_CONTROL_DIAL_HOST;
  const useOverride = typeof override === "string" && override.length > 0;
  const host = useOverride ? override : mcpHost();
  const source: "dial_override" | "bridge_alias" = useOverride ? "dial_override" : "bridge_alias";

  if (classifyConnectHost(host) === "wildcard_bind") {
    return {
      ok: false,
      kind: "unreachable_control_plane",
      message:
        `openBrokerControl: the resolved dial target ${host}:${port} is a wildcard-bind address -- ` +
        `it is valid to listen on but structurally impossible to dial. Refusing to attempt a connection.`,
      target: `${host}:${port}`,
    };
  }
  return { ok: true, target: { host, port, source, recorded } };
}

// ---------------------------------------------------- TCP control plane
//
// The container-side half of the TCP control plane (broker-control.mts is
// the host-side half). Wire format confirmed at an early blocking
// decision checkpoint (2026-08-03, `as-specified`): newline-delimited JSON,
// per-boot capability token, connection open = claim / close = release.
export interface AcquireGrant {
  id: string;
  port: number;
  url: string;
  epoch_file: string;
  supervisor_dir: string;
  /** The broker-allocated port stock's `-remotemonitor` text monitor binds,
   * mandatory in fact once a stock acquire without one was made to fail
   * outright rather than degrade.
   * Absent on a fork grant only -- a stock grant that could not bind a
   * text-monitor port no longer reaches the wire at all: the acquire fails
   * outright (`no_free_text_port`) before any grant is produced. */
  remote_monitor_port?: number;
}

/** Parses the wire's `remote_monitor_port` into a validated
 * integer in 1..65535, or `undefined` when the key is absent OR the observed
 * value is not a valid port -- never a fabricated 0/null standing in for
 * "no port", and never an unvalidated number handed downstream to a dial.
 * Shared by both AcquireGrant construction sites below so the same
 * validation cannot drift between them. */
function parseOptionalRemoteMonitorPort(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : undefined;
}

export interface AcquireOverControlPlaneHandle {
  grant: AcquireGrant;
  /** Closes the connection -- the connection IS the lease, so this alone
   * is the release; the broker's own "close" handler tears the instance
   * down (broker-control.mts). */
  release: () => void;
}

/** Default raised from 25000 to 120000. The
 * knob (VICE_BROKER_ACQUIRE_TIMEOUT_MS) is unchanged -- an explicitly
 * configured value keeps working exactly as before.
 *
 * Counter-evidence, recorded here rather than only in the plan: at the
 * measured sub-second cold-launch boot (spike-003), the OLD 25000 ms value
 * already implied a cliff far past what the instance ceiling would ever
 * force -- so this raise is robustness headroom for a slow or contended
 * host, not an unblocking of any wave-width constraint. .mcp.json's own
 * `timeout` field is raised to 150000 in the same commit (see the ordering-
 * invariant test in vice-proxy.test.ts), keeping this deadline strictly
 * less than the MCP client's own configured timeout -- so a waiting caller
 * always sees this module's warming-and-retry diagnostic rather than the
 * client's generic timeout. */
export const CONTROL_ACQUIRE_TIMEOUT_MS: number = Number(process.env.VICE_BROKER_ACQUIRE_TIMEOUT_MS || 120000);

/** The request-side launch profile.
 * Optional and absent by default at BOTH acquire write sites in this file.
 *
 * ONE RULE, and it is the whole reason this shape is named rather than
 * inlined: the `profile` key must be OMITTED ENTIRELY when no profile was
 * requested, not written as `profile: undefined`. `JSON.stringify` drops an
 * `undefined` value, so both spellings happen to produce the same bytes today
 * -- but an explicit `null` or `{}` would not, and the property this phase
 * needs is that a profile-less acquire's wire line is BYTE-IDENTICAL to the
 * one this client has always written. The spread idiom below is what makes
 * that structural rather than incidental.
 *
 * The SECOND rule, which cost this plan its own dedicated must-have: the
 * profile has to be written at BOTH sites. This file has two independent
 * acquire writers -- acquireOverControlPlane()'s raw `socket.write` below and
 * openBrokerControl()'s `sendAndAwaitLine` further down. A field added to only
 * one of them silently never arrives for callers on the other path, which is
 * the same defect class as a tool argument that is accepted and dropped.
 *
 * CONSUMER STATUS: SUBSTRATE, NOT YET WIRED. The profile
 * threads client -> wire -> narrowing -> eligibility -> argv -> record with
 * tests at every hop, but NO production call site passes one yet:
 * `acquireOverControlPlane()` and `BrokerControlSession.acquire()` are only
 * ever invoked without `opts.profile`, so `-warp` and `-console` are
 * unreachable in production. That is deliberate -- the chain was built
 * ahead of the callers that will use it -- and is recorded here rather than
 * left for a reader to discover, because a fully-tested chain reads as a
 * live one.
 *
 * Do NOT close this by inventing a call site. Note also that the profile is
 * refused outright on the fork backend (broker-control.mts):
 * it maps to stock-only launch flags, so the first real consumer has to be on
 * stock. */
export interface AcquireProfileOptions {
  profile?: LaunchProfile;
}

/** Builds the `profile` fragment of an acquire request line -- the ONE place
 * this client decides whether the key appears at all, so the two write sites
 * cannot drift apart on that decision. Returns an empty object (no key) when
 * no profile was requested. */
function acquireProfileFragment(profile?: LaunchProfile): { profile?: LaunchProfile } {
  return profile === undefined ? {} : { profile };
}

/** The agent-session identity environment variable this resolver treats as
 * authoritative when set (`process.env.CLAUDE_CODE_SESSION_ID`). Named as its
 * own constant so a reader does not have to hunt resolveSessionLabel()'s
 * body for the literal string. */
const SESSION_LABEL_ENV_VAR = "CLAUDE_CODE_SESSION_ID";

/** Injectable overrides for resolveSessionLabel(), in this project's
 * standard env/time/spawning/I-O injection register -- a test never depends
 * on the real process's environment, working directory or pid. Production
 * callers (both acquire write sites below) omit every field and let each
 * default to the real process. */
export interface ResolveSessionLabelOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: () => string;
  pid?: number;
}

/** Resolves the display label a session declares once, at acquire time
 * (Phase 63, SESS-06) -- WHICH AGENT SESSION THIS IS, so a human reading
 * broker status can tell one live session on a machine-wide broker apart
 * from another unrelated one.
 *
 * THIS IS A DISPLAY VALUE WITH NO AUTHORITY. Nothing anywhere may ever
 * branch on its content, compare it for equality against anything, or treat
 * it as identifying which grant a request is allowed to act on -- the grant
 * a connection itself holds is the ONE authority this protocol has (see
 * broker-control.mts's own ownsTarget() and its standing warning against
 * ever trusting a caller-supplied `target_id`). This value's only job is to
 * be read by a human.
 *
 * Prefers CLAUDE_CODE_SESSION_ID (SESSION_LABEL_ENV_VAR above) when it is a
 * non-empty string. Falls back to the current working directory's base name
 * joined to the process id with a hyphen when that variable is absent or
 * empty -- universally available, and it still distinguishes two processes
 * running in the same repository. Both branches always produce a non-empty
 * string against the real process, which is why a label is "optional on the
 * wire but always present in practice" (this plan's own decision): a
 * production acquire always has one to attach. */
export function resolveSessionLabel(opts: ResolveSessionLabelOptions = {}): string {
  const env = opts.env ?? process.env;
  const sessionId = env[SESSION_LABEL_ENV_VAR];
  if (typeof sessionId === "string" && sessionId !== "") return sessionId;
  const cwd = opts.cwd ?? (() => process.cwd());
  const pid = opts.pid ?? process.pid;
  return `${basename(cwd())}-${pid}`;
}

/** Builds the `label` fragment of an acquire request line -- the SAME
 * key-omitted-when-absent idiom acquireProfileFragment() above already
 * establishes, so the two write sites' decision of whether the key appears
 * at all never has to be made twice. resolveSessionLabel() never returns an
 * empty string against the real process, so this branch exists for
 * structural completeness (an injected override CAN produce one) rather
 * than for a case production ever reaches -- broker-control.mts's own
 * sanitiseSessionLabel() would collapse an empty string to `null` anyway,
 * but omitting the key here keeps this client's own byte-identity
 * discipline in one place. */
function acquireLabelFragment(label: string): { label?: string } {
  return label === "" ? {} : { label };
}

/** Reads broker.json ONCE for control_host/control_port/control_token,
 * opens ONE TCP connection, sends a single `acquire` request framed as one
 * JSON line, and awaits the grant line against
 * CONTROL_ACQUIRE_TIMEOUT_MS. Rejects (never throws synchronously) on any
 * failure: broker.json absent/unreadable/missing the control fields, a
 * connection error, an `error` response, or a timeout.
 *
 * Additionally takes an optional `profile` (see
 * AcquireProfileOptions above). Omitting it writes the exact wire line this
 * function has always written. */
export function acquireOverControlPlane(dir: string = brokerRootDir(), opts: AcquireProfileOptions = {}): Promise<AcquireOverControlPlaneHandle> {
  return new Promise((resolvePromise, reject) => {
    const broker = readJsonMaybe(brokerJsonPath(dir));
    if (broker === null) {
      reject(new Error("acquireOverControlPlane: broker.json not present or unreadable"));
      return;
    }
    const controlHost = typeof broker.control_host === "string" ? broker.control_host : null;
    const port = typeof broker.control_port === "number" ? broker.control_port : null;
    const token = typeof broker.control_token === "string" ? broker.control_token : null;
    if (controlHost === null || port === null || token === null) {
      reject(new Error("acquireOverControlPlane: broker.json missing control_host/control_port/control_token"));
      return;
    }

    const targetResult = resolveControlTarget(broker, port);
    if (!targetResult.ok) {
      reject(new Error(targetResult.message));
      return;
    }
    const { host } = targetResult.target;

    const socket = connect({ host, port });
    let buffer = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(`acquireOverControlPlane: no grant within ${CONTROL_ACQUIRE_TIMEOUT_MS}ms`));
    }, CONTROL_ACQUIRE_TIMEOUT_MS);
    if (typeof timer.unref === "function") timer.unref();

    socket.on("connect", () => {
      const requestId = newRequestId();
      // Write site ONE of two (see
      // acquireProfileFragment()'s own comment) -- the key is absent entirely
      // when no profile was requested, so this line stays byte-identical to
      // what it always was for a profile-less acquire.
      //
      // The session label (Phase 63, SESS-06) is resolved with NO overrides
      // here -- production always attaches the real process's own label;
      // only a direct call to resolveSessionLabel() itself (unit-tested
      // separately) ever supplies injected overrides.
      socket.write(
        `${JSON.stringify({ op: "acquire", id: requestId, token, ...acquireProfileFragment(opts.profile), ...acquireLabelFragment(resolveSessionLabel()) })}\n`,
      );
    });

    socket.on("data", (chunk: Buffer) => {
      if (settled) return;
      buffer += chunk.toString("utf8");
      const newlineIdx = buffer.indexOf("\n");
      if (newlineIdx === -1) return;
      const line = buffer.slice(0, newlineIdx);

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(new Error("acquireOverControlPlane: malformed response line"));
        return;
      }
      if (typeof parsed !== "object" || parsed === null) {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(new Error("acquireOverControlPlane: response line is not a JSON object"));
        return;
      }
      const resp = parsed as Record<string, unknown>;
      if (resp.kind === "grant") {
        settled = true;
        clearTimeout(timer);
        const remoteMonitorPort = parseOptionalRemoteMonitorPort(resp.remote_monitor_port);
        const grant: AcquireGrant = {
          id: String(resp.id),
          port: Number(resp.port),
          url: String(resp.url),
          epoch_file: String(resp.epoch_file),
          supervisor_dir: String(resp.supervisor_dir),
          ...(remoteMonitorPort === undefined ? {} : { remote_monitor_port: remoteMonitorPort }),
        };
        resolvePromise({
          grant,
          release: () => {
            socket.destroy();
          },
        });
      } else if (resp.kind === "error") {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(new Error(`acquireOverControlPlane: ${String(resp.code)}: ${String(resp.message)}`));
      }
      // any other kind: not a terminal response to THIS request -- ignored,
      // matching pollGrant()'s own "keep waiting" posture above.
    });

    socket.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// BROKER-CONTROL-CLIENT REGION START
//
// The file protocol beside it is now gone.
// openBrokerControl() is the container-side half of the TCP control plane:
// session shape, all five request kinds, one discovery-record read, real
// per-request deadlines, and a distinct broker-gone outcome. Lives alongside
// acquireOverControlPlane() above (an early tracer, kept unchanged and
// still used by broker-e2e.test.ts/broker-kill.test.ts as their own one-shot
// acquire helper for exercising the SERVER side) -- the file protocol this
// region's own predecessor sat beside is gone entirely.
//
// Deliberately never REJECTS a promise: every failure -- deadline, a
// refused connection, a malformed line, the broker going away mid-request --
// resolves an `{ ok: false, kind, message }` value instead, matching this
// module's established never-throw posture toward untrusted input (the
// broker's response lines) and network conditions, and sidestepping any
// possibility of an unhandled rejection escaping this client.
//
// A structural test in vice-broker-client.test.ts extracts exactly the
// region between this marker and REGION END below (by these marker strings,
// not a whole-file scan) and asserts it contains no filesystem-write
// construct -- nothing in this region may reintroduce a second on-disk
// authority for "is this lease alive."
// ---------------------------------------------------------------------------

/** Same value as the tracer's own CONTROL_ACQUIRE_TIMEOUT_MS above --
 * referenced directly (not re-computed from the env var a second time) so
 * the two can never drift apart. This is the relocated value of the
 * retiring grant-poll timeout (VICE_BROKER_ACQUIRE_TIMEOUT_MS, default now
 * 120000, raised from 25000 against the measured tool-call
 * budget spike-003 established -- see the counter-evidence comment at
 * CONTROL_ACQUIRE_TIMEOUT_MS's own declaration above). */
export const ACQUIRE_TIMEOUT_MS: number = CONTROL_ACQUIRE_TIMEOUT_MS;

/** Genuinely NEW: the file protocol never "connected" anywhere, so there is
 * no retiring value to carry forward for this one. A conservative bound for
 * a TCP connect over the docker bridge to a broker broker.json has already
 * classified alive (never_started/stale are refused before a connection is
 * ever attempted) -- deliberately not read from an environment variable,
 * since no new environment variable was wanted beyond the two deadline
 * variables named above. Final tuning remains a future item, same as the
 * other two. */
export const CONTROL_CONNECT_TIMEOUT_MS = 5000;

/** Every way a session-level request can fail to produce its expected
 * success line: the two pre-connect liveness refusals, a refused TCP
 * connection, a per-request deadline, the broker dropping the connection
 * mid-request, a malformed/non-object response line, and the broker's own
 * ControlErrorCode vocabulary (broker-control.mts's own type, duplicated
 * here as a plain string-literal union rather than imported -- this client
 * and that host-side listener run in separate processes; the shared surface
 * between them is the wire format, not a TypeScript type, exactly like
 * AcquireGrant below already duplicates the wire's own field names rather
 * than importing a shared interface). */
export type ControlFailureKind =
  | "never_started"
  | "stale"
  | "unreachable_control_plane"
  | "connect_refused"
  | "deadline"
  | "broker_gone"
  | "protocol"
  | "unauthorized"
  | "bad_request"
  | "denied"
  | "no_free_port"
  | "at_capacity"
  | "internal"
  // The broker's own ControlErrorCode gained
  // this member for the ownership-conflict outcome; duplicated here for the
  // same reason every other member already is (this client and the broker
  // run in separate processes -- the shared surface is the wire format, not
  // a TypeScript type).
  | "monitor_owned";

export type ControlAcquireResult = { ok: true; grant: AcquireGrant } | { ok: false; kind: ControlFailureKind; message: string };

export type ControlReleaseResult = { ok: true };

interface ControlStatusInstanceEntry {
  port: number;
  url: string;
  state: string;
  reason: string;
  epoch: number | null;
}

export type ControlStatusResult =
  | { ok: true; instances: ControlStatusInstanceEntry[] }
  | { ok: false; kind: ControlFailureKind; message: string };

interface ControlHostStateFields {
  pid: number;
  started_at: string;
  node_version: string;
  vice_bin: string;
  warm_floor: number;
  max_instances: number;
  base_port: number;
  /** Narrowed from `"fork" | "stock" | null` to
   * `ViceBackend | null` -- `null` when the broker predates this field or
   * sent something unrecognised: absent evidence, kept distinct from a
   * definite value. text-tools.ts's own broker-identity cross-check (out of
   * this plan's scope) still reads this field. */
  backend: ViceBackend | null;
}

export type ControlHostStateResult =
  | { ok: true; hostState: ControlHostStateFields }
  | { ok: false; kind: ControlFailureKind; message: string };

// ---------------------------------------------------------------------------
// MonitorClaimChannel: the two-value channel contract,
// declared HERE as a local literal union rather than imported from
// broker-state.mts -- that module is host-bound and compiled into
// resources/*.mjs, and this file is the container-side half. The shared
// thing between the declarations is the CONTRACT ("binary" | "text"), not
// the declaration itself -- channel-lock.ts's own MonitorChannel and
// broker-state.mts's own MonitorChannel each declare it separately for the
// same reason.
// ---------------------------------------------------------------------------
export type MonitorClaimChannel = "binary" | "text";

/** The current monitor-socket holder's own identity, named in a
 * `monitor_owned` refusal -- field-for-field the same shape the broker's own MonitorHolder
 * carries (broker-control.mts), minus nothing (pid included, matching
 * GrantRecord's own convention this whole mechanism mirrors). */
export interface MonitorClaimHolder {
  grantId: string;
  claimedAt: number;
  pid: number | null;
  channel: MonitorClaimChannel;
}

export interface ClaimMonitorOptions {
  targetId: string;
  timeoutMs?: number;
  /** Which monitor socket to claim. Omitted is
   * byte-identical to `"binary"` -- every pre-existing call site (and every
   * broker that predates this field) keeps working unchanged. */
  channel?: MonitorClaimChannel;
}

export interface ReleaseMonitorOptions {
  targetId: string;
  timeoutMs?: number;
  /** Same default-to-binary posture as ClaimMonitorOptions.channel. */
  channel?: MonitorClaimChannel;
}

/** Discriminated claim outcome: `monitor_owned` is kept STRICTLY
 * separate from `timeout` -- conflating "someone else holds it" with "the
 * broker did not answer" would reintroduce exactly the ambiguity this
 * distinction exists to remove. Never thrown; a caller that wants to raise instead
 * should construct a MonitorOwnershipError from this outcome's own fields
 * (see that class's own header comment). */
export type ClaimMonitorOutcome =
  // Widened (Phase 63, SESS-02): `handle` is the per-claim handle
  // broker-control.mts's own `monitor_claimed` reply now always carries --
  // the ONLY authority a later `attach` on a SEPARATE relay connection can
  // present (see broker-control.mts's RelayAttachOutcome header comment).
  // A missing or non-string value on the wire is a protocol failure,
  // refused by name below, never defaulted to an empty string.
  | { ok: true; handle: string }
  | { ok: false; reason: "monitor_owned"; holder: MonitorClaimHolder }
  // "denied": the broker's control plane refused because the grant
  // named is not the one THIS connection holds. In a correct client that is
  // unreachable -- stockConnect() always claims the grant its own session
  // acquired -- so it is carried as its own reason rather than collapsed into
  // "internal", where a wiring bug would be indistinguishable from a broker
  // fault. Kept strictly distinct from "monitor_owned", which is a conflict
  // between two LEGITIMATE holders.
  | { ok: false; reason: "timeout" | "unauthorized" | "bad_request" | "denied" | "internal" };

export type ReleaseMonitorOutcome = { ok: true } | { ok: false; reason: "timeout" | "unauthorized" | "bad_request" | "denied" | "internal" };

/** Phase 64 (XFER-04, D-01). `slot` is an open-ended string, not a closed
 * union -- `"autostart"`, `"disk8"` and `"snapshot"` are what this phase
 * sends (see broker-control.mts's own wire_vocabulary comment on the
 * `stage_file` op). */
export interface StageFileOptions {
  targetId: string;
  timeoutMs?: number;
  slot: string;
}

/** Discriminated outcome for `stageFile()`. A missing or non-string
 * `handle`/`emulator_filename` in a success reply is a protocol failure --
 * the broker always sends both on success (broker-control.mts's own
 * `stage_file` arm), so their absence means the two sides disagree about
 * the wire shape, never a legitimate state to fabricate around. Mirrors
 * ClaimMonitorOutcome's own posture on a missing `handle`. */
export type StageFileOutcome =
  | { ok: true; handle: string; emulatorFilename: string }
  | { ok: false; reason: "timeout" | "unauthorized" | "bad_request" | "denied" | "internal" };

/** Phase 63 (SESS-05). `name: null` clears; anything else is the raw name to
 * declare -- sent to the broker VERBATIM, never sanitised on this side. The
 * broker is the ONE place a caller-supplied display string is rendered into
 * a record or a log line (broker-control.mts's sanitiseSessionLabel()), so
 * it is also the one place that has to run it through that sanitiser;
 * sanitising twice would risk the two copies drifting on what "sanitised"
 * means. */
export interface NoteOperationOptions {
  targetId: string;
  timeoutMs?: number;
  /** Same default-to-binary posture as ClaimMonitorOptions.channel. */
  channel?: MonitorClaimChannel;
  name: string | null;
}

/** Discriminated outcome for `noteOperation()`. Never carries a `holder` --
 * unlike `monitor_claim`, an `operation` refusal is never an ownership
 * CONFLICT between two legitimate holders (T-63-11's gate is "is this
 * connection's own grant", not "who else holds this"), so there is nothing
 * to name beyond the refusal `reason` itself. */
export type NoteOperationOutcome = { ok: true } | { ok: false; reason: "timeout" | "unauthorized" | "bad_request" | "denied" | "internal" };

export interface MonitorOwnershipErrorOptions {
  holderGrantId?: string;
  holderClaimedAt?: number;
  port?: number;
  /** Which socket is contended -- so a handshake failure
   * can say which channel was refused without re-parsing the message. */
  channel?: MonitorClaimChannel;
}

/** Thrown (by a caller that prefers to raise rather than branch on
 * ClaimMonitorOutcome) when `monitor_claim` is refused because a DIFFERENT
 * grant already holds this instance's monitor socket. Names the holding
 * grant and the port plainly, as an ownership
 * conflict -- a state the broker itself enforced, distinct from an emulator
 * that has stopped answering.
 *
 * The claim this error reports on a refusal is made BEFORE any binmon
 * connect() is ever attempted: stock VICE services exactly one binmon
 * client, and a second connect() produces no reply and no EOF, so a refusal
 * arriving only after dialling would be byte-for-byte indistinguishable
 * from a wedge. Claiming first means this refusal is a JSON
 * response on a control-plane socket that already works, and the second
 * client never dials the binmon port at all. */
export class MonitorOwnershipError extends ViceError {
  holderGrantId?: string;
  holderClaimedAt?: number;
  port?: number;
  channel?: MonitorClaimChannel;

  constructor(message: string, { holderGrantId, holderClaimedAt, port, channel }: MonitorOwnershipErrorOptions = {}) {
    super(message);
    this.name = "MonitorOwnershipError";
    this.holderGrantId = holderGrantId;
    this.holderClaimedAt = holderClaimedAt;
    this.port = port;
    this.channel = channel;
  }
}

/** Per-call deadline override -- matches PollOptions's own established shape
 * above (pollGrant()/pollRecycleAck() already take an optional `timeoutMs`
 * this same way). The MODULE-LEVEL constant (ACQUIRE_TIMEOUT_MS etc.) is the
 * real, unchanged-from-the-retiring-poll default; a caller (chiefly this
 * file's own tests, injecting a short bound to prove the deadline actually
 * elapses without waiting out the real one) may override it per call. */
export interface ControlDeadlineOptions {
  timeoutMs?: number;
}

/** The session opened by openBrokerControl(): one TCP connection, held for
 * the session's lifetime -- the connection IS the lease (the tolerance
 * decision recorded in broker-control-plane-over-tcp.md). Each method sends
 * exactly one request line and resolves against its own deadline; none of
 * them ever reject. */
export interface BrokerControlSession {
  /** Additionally takes an optional
   * `profile` -- see AcquireProfileOptions. Omitting it is byte-identical to
   * every pre-existing call. */
  acquire(opts?: ControlDeadlineOptions & AcquireProfileOptions): Promise<ControlAcquireResult>;
  release(): Promise<ControlReleaseResult>;
  status(opts?: ControlDeadlineOptions): Promise<ControlStatusResult>;
  hostState(opts?: ControlDeadlineOptions): Promise<ControlHostStateResult>;
  /** Claims exclusive ownership of an instance's monitor socket BEFORE any
   * binmon connect() is attempted -- see
   * MonitorOwnershipError's own header comment for why claiming first is
   * the only way this refusal can ever be distinguishable from a wedge. */
  claimMonitor(opts: ClaimMonitorOptions): Promise<ClaimMonitorOutcome>;
  /** Releases a previously claimed monitor socket. Tolerates a broker that
   * has already cleared the record (release/process-exit both clear
   * it broker-side) -- a second release is `ok: true`, not an error. */
  releaseMonitor(opts: ReleaseMonitorOptions): Promise<ReleaseMonitorOutcome>;
  /** Declares (or, with `opts.name: null`, clears) the operation THIS
   * grant's own connection currently has in flight (Phase 63, SESS-05),
   * sent as `{ op: "operation", ... }` over this SAME session -- never a
   * second connection. Built on the same `sendAndAwaitLine()` every other
   * method uses, so it registers its own pending-response entry and never
   * throws; callers are expected to call this WITHOUT awaiting the returned
   * promise (stock-dispatch.ts's and text-tools.ts's own channel-lock
   * wrappers do exactly that) -- a declaration must never add latency to,
   * or fail, the tool call that triggered it (T-63-13). The un-awaited
   * pending entry this method registers is exactly what makes that safe:
   * the response, whenever it arrives (or never, if the broker is gone),
   * settles a promise nothing is blocking on. */
  noteOperation(opts: NoteOperationOptions): Promise<NoteOperationOutcome>;
  /** Stages a file slot on the broker's own disk (Phase 64, XFER-04, D-01),
   * sent as `{ op: "stage_file", id, target_id, slot, token }` over this
   * SAME session -- never a second connection. Mints no path or filename
   * itself: the broker chooses both and returns them (`handle`,
   * `emulatorFilename`) in the reply. Gated broker-side by the SAME
   * ownsTarget() predicate `claimMonitor`/`releaseMonitor` are, so
   * this connection can only stage against the grant it itself holds. */
  stageFile(opts: StageFileOptions): Promise<StageFileOutcome>;
}

export interface OpenBrokerControlOptions {
  connectTimeoutMs?: number;
}

export type OpenBrokerControlOutcome =
  | { ok: true; session: BrokerControlSession }
  | { ok: false; kind: ControlFailureKind; message: string; target?: string };

/** The backend-agnostic coordinate set a session which ALREADY holds a
 * broker grant hands to anything that needs to dial the instance that grant
 * names. Declared here, beside
 * BrokerControlSession and openBrokerControl(), because it is
 * backend-agnostic -- the fork path does not consume it only because
 * forwardToVice() reads activeInstance() from the same module (vice.ts)
 * that owns the state, not because this shape is stock-specific.
 *
 * `targetId` is the GRANT ID, not the port.
 * `brokerControl` is the SAME control session the grant was acquired
 * through; a stock handler must claim its monitor socket on this session,
 * never on one it opened itself (see stock-dispatch.ts's own
 * ensureStockSession() header comment for why a second acquisition would
 * break the claim-before-dial guarantee this type exists to preserve). */
export interface HeldLease {
  host: string;
  port: number;
  targetId: string;
  brokerControl: BrokerControlSession;
  /** THIS instance's own epoch.json, in the CONSUMER's view of the
   * filesystem (i.e. already containerized -- vice-proxy.ts fills it from
   * activeInstance().epochFile, which adoptGrant() set from the containerized
   * grant). This is the reconnect-identity baseline stock-connect.ts's
   * stockReconnect() proves machine identity against. NOT optional: with it
   * absent, stockReconnect() reports a FALSE MachineRestartedError on every
   * transient socket drop ("treat every result since the previous call as
   * void"), because identity that cannot be proven is treated as not proven.
   * Empty string means genuinely no epoch evidence exists, which is that same
   * unprovable case stated explicitly rather than by omission. */
  epochFile: string;
  /** The TOP-LEVEL supervisor directory -- the one holding
   * `backend.json`, i.e. the same directory `broker.json` is read from
   * (brokerRootDir()). Deliberately NOT the grant's own per-instance
   * `supervisor_dir` (`<stateDir>/<port>`), which holds epoch.json and would
   * make backend-detect.mts's capability cache look in a directory that never
   * has a record in it -- a silent permanent miss. Empty string disables the
   * capability cache (every connect re-probes), matching
   * backend-detect.mts's own documented degradation for an omitted
   * supervisorDir. */
  supervisorDir: string;
  /** THIS
   * instance's own text-monitor port, read by text-connect.ts's
   * textConnect() to dial the `-remotemonitor` channel. MANDATORY on a
   * stock grant, ABSENT on a fork grant -- the fork never launches with
   * `-remotemonitor` and advertises no text tools. Its absence on a stock
   * lease is a real defect, not a tolerated state (mirrors epochFile's own
   * "NOT optional" discipline above): the mechanism that makes this true is
   * broker-launch.mts's acquirePortAndLaunch(), which now FAILS THE WHOLE
   * ACQUIRE when the text-port allocation fails (`no_free_text_port`)
   * rather than degrading to a portless launch -- there is no longer a code
   * path that produces a stock grant, and therefore a HeldLease, without
   * this field. Its optionality here is a transitional TypeScript
   * convenience only (the fork case is real), never a semantic "sometimes
   * missing on stock". */
  remoteMonitorPort?: number;
}

/** One in-flight request's settlement callback -- pushed onto the session's
 * FIFO pending queue in sendAndAwaitLine() below, and shifted off it by
 * EXACTLY ONE of: a response line arriving (createSession()'s own "data"
 * handler), the per-request deadline elapsing, or the broker closing/erroring
 * the connection (which drains and settles every entry still in the queue).
 * FIFO order is sound here because every session method awaits its own
 * sendAndAwaitLine() call to settle before this client ever writes a second
 * request line -- responses can therefore never arrive out of the order
 * their requests were sent in, so matching purely by arrival order (rather
 * than by echoing the request id back, which several response kinds do not
 * even carry) is correct. */
interface PendingLineEntry {
  handle(line: Record<string, unknown> | null, brokerGone: boolean): void;
}

// `holder` is optional and populated ONLY when `kind` is "monitor_owned" --
// every other failure kind leaves it undefined, matching broker-control.mts's
// own error variant this outcome mirrors (plan 05: extends the existing
// generic failure shape rather than a parallel channel for the one kind
// that needs an extra field).
type RawLineOutcome = { ok: true; line: Record<string, unknown> } | { ok: false; kind: ControlFailureKind; message: string; holder?: MonitorClaimHolder };

/** Never-throw extraction of a `holder` payload from untrusted wire input --
 * absent or malformed input answers `undefined`, never a partially-filled
 * object (this module's own never-throw-on-untrusted-input posture, matching
 * this file's own header comment on broker.json reads). `channel`
 * defaults to `requestedChannel` -- THE channel this request
 * itself named -- when the wire omits it or sends something unrecognised;
 * never fabricated as a plausible value, in the same register the
 * `grantId: "unknown"` fallback one layer up (claimMonitor()'s own) uses. */
function extractHolder(raw: unknown, requestedChannel: MonitorClaimChannel): MonitorClaimHolder | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const h = raw as Record<string, unknown>;
  if (typeof h.grantId !== "string" || typeof h.claimedAt !== "number") return undefined;
  const channel = h.channel === "text" || h.channel === "binary" ? h.channel : requestedChannel;
  return { grantId: h.grantId, claimedAt: h.claimedAt, pid: typeof h.pid === "number" ? h.pid : null, channel };
}

/** Builds the session object wrapping an already-CONNECTED socket. Wires the
 * newline framing (buffer, split on "\n", one entry-per-response FIFO
 * dispatch -- structurally the same shape broker-control.mts's own
 * attachControlProtocol() uses on the host side) and the broker-gone
 * settlement on "close"/"error", then exposes the five typed request
 * methods over it. */
function createSession(socket: Socket, token: string): BrokerControlSession {
  let buffer = "";
  let closed = false;
  const pending: PendingLineEntry[] = [];

  socket.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      if (line.trim() === "") continue;
      const entry = pending.shift();
      if (!entry) continue; // unsolicited line -- this protocol never pushes one; ignored defensively

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        entry.handle(null, false);
        continue;
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        entry.handle(null, false);
        continue;
      }
      entry.handle(parsed as Record<string, unknown>, false);
    }
  });

  function settleAllBrokerGone(): void {
    closed = true;
    const all = pending.splice(0, pending.length);
    for (const entry of all) entry.handle(null, true);
  }
  socket.on("close", settleAllBrokerGone);
  socket.on("error", settleAllBrokerGone);

  /** Sends one JSON line carrying `token` and awaits the matching response,
   * settling a typed failure rather than throwing on every failure mode:
   * deadline, broker-gone, a malformed line, or the broker's own `error`
   * response (whose `code` is forwarded verbatim as this outcome's `kind`).
   * A success line is handed back UNINTERPRETED as `line` -- each public
   * method below checks its own expected `kind` and extracts its own
   * fields, so this shared helper carries none of that per-request-kind
   * knowledge. */
  function sendAndAwaitLine(payload: Record<string, unknown>, timeoutMs: number): Promise<RawLineOutcome> {
    return new Promise((resolvePromise) => {
      if (closed) {
        resolvePromise({ ok: false, kind: "broker_gone", message: "openBrokerControl: session already closed" });
        return;
      }
      let settled = false;
      const entry: PendingLineEntry = {
        handle(line, brokerGone) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (brokerGone) {
            resolvePromise({
              ok: false,
              kind: "broker_gone",
              message: "openBrokerControl: the broker closed the connection while this request was in flight",
            });
            return;
          }
          if (line === null) {
            resolvePromise({ ok: false, kind: "protocol", message: "openBrokerControl: malformed or non-object response line" });
            return;
          }
          if (line.kind === "error") {
            const code = typeof line.code === "string" ? (line.code as ControlFailureKind) : "internal";
            // Forward `holder` verbatim ONLY for monitor_owned --
            // every other error code carries no such field on the wire, and
            // extractHolder() itself never invents one from absent/malformed
            // input. The requested channel comes from
            // THIS payload (the request this response answers), read from
            // the same closure `payload` sendAndAwaitLine() was called
            // with -- an absent/malformed wire `channel` is never fabricated,
            // it defaults to the channel this specific request itself named.
            const requestedChannel: MonitorClaimChannel = payload.channel === "text" ? "text" : "binary";
            const holder = code === "monitor_owned" ? extractHolder(line.holder, requestedChannel) : undefined;
            resolvePromise({
              ok: false,
              kind: code,
              message: typeof line.message === "string" ? line.message : "openBrokerControl: broker reported an error",
              holder,
            });
            return;
          }
          resolvePromise({ ok: true, line });
        },
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const idx = pending.indexOf(entry);
        if (idx !== -1) pending.splice(idx, 1);
        resolvePromise({ ok: false, kind: "deadline", message: `openBrokerControl: no response within ${timeoutMs}ms` });
      }, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();

      pending.push(entry);
      socket.write(`${JSON.stringify(payload)}\n`);
    });
  }

  async function acquire(opts: ControlDeadlineOptions & AcquireProfileOptions = {}): Promise<ControlAcquireResult> {
    const requestId = newRequestId();
    // Write site TWO of two (see
    // acquireProfileFragment()'s own comment for why both matter) -- same
    // key-omitted-when-absent discipline as acquireOverControlPlane()'s raw
    // socket.write above. Same no-overrides resolveSessionLabel() call as
    // write site one.
    const raw = await sendAndAwaitLine(
      { op: "acquire", id: requestId, token, ...acquireProfileFragment(opts.profile), ...acquireLabelFragment(resolveSessionLabel()) },
      opts.timeoutMs ?? ACQUIRE_TIMEOUT_MS,
    );
    if (!raw.ok) return raw;
    const line = raw.line;
    if (line.kind !== "grant") {
      return { ok: false, kind: "protocol", message: `openBrokerControl: acquire got unexpected response kind ${String(line.kind)}` };
    }
    const remoteMonitorPort = parseOptionalRemoteMonitorPort(line.remote_monitor_port);
    const grant: AcquireGrant = {
      id: String(line.id),
      port: Number(line.port),
      url: String(line.url),
      epoch_file: String(line.epoch_file),
      supervisor_dir: String(line.supervisor_dir),
      ...(remoteMonitorPort === undefined ? {} : { remote_monitor_port: remoteMonitorPort }),
    };
    return { ok: true, grant };
  }

  /** The connection IS the lease -- closing it is the ENTIRE release, no
   * wire round trip needed (matches acquireOverControlPlane()'s own
   * release() above). socket.destroy() is itself idempotent, so a second
   * release() call is a silent no-op, matching the idempotent posture the
   * retiring file-based releaseLease() already had. */
  async function release(): Promise<ControlReleaseResult> {
    if (!socket.destroyed) socket.destroy();
    closed = true;
    return { ok: true };
  }

  async function status(opts: ControlDeadlineOptions = {}): Promise<ControlStatusResult> {
    // Reuses ACQUIRE_TIMEOUT_MS as a shared bound -- status is a synchronous,
    // in-memory read on the broker side (no launch, no kill involved), so it
    // needs no timeout of its own scale; introducing a distinct constant (or
    // environment variable) for it would be exactly the kind of new knob
    // this module deliberately declines to add.
    const raw = await sendAndAwaitLine({ op: "status", token }, opts.timeoutMs ?? ACQUIRE_TIMEOUT_MS);
    if (!raw.ok) return raw;
    const line = raw.line;
    if (line.kind !== "status") {
      return { ok: false, kind: "protocol", message: `openBrokerControl: status got unexpected response kind ${String(line.kind)}` };
    }
    const rawInstances = Array.isArray(line.instances) ? line.instances : [];
    const instances: ControlStatusInstanceEntry[] = rawInstances.map((rawEntry) => {
      const e = rawEntry && typeof rawEntry === "object" ? (rawEntry as Record<string, unknown>) : {};
      return {
        port: Number(e.port),
        url: typeof e.url === "string" ? e.url : "",
        state: typeof e.state === "string" ? e.state : "",
        reason: typeof e.reason === "string" ? e.reason : "",
        epoch: typeof e.epoch === "number" ? e.epoch : null,
      };
    });
    return { ok: true, instances };
  }

  async function hostState(opts: ControlDeadlineOptions = {}): Promise<ControlHostStateResult> {
    // Same shared-bound reasoning as status() above.
    const raw = await sendAndAwaitLine({ op: "host_state", token }, opts.timeoutMs ?? ACQUIRE_TIMEOUT_MS);
    if (!raw.ok) return raw;
    const line = raw.line;
    if (line.kind !== "host_state") {
      return { ok: false, kind: "protocol", message: `openBrokerControl: host_state got unexpected response kind ${String(line.kind)}` };
    }
    return {
      ok: true,
      hostState: {
        pid: Number(line.pid),
        started_at: String(line.started_at),
        node_version: String(line.node_version),
        vice_bin: String(line.vice_bin),
        warm_floor: Number(line.warm_floor),
        max_instances: Number(line.max_instances),
        base_port: Number(line.base_port),
        // Narrowed at the boundary, never cast --
        // anything other than the one known verdict reads as `null` ("this
        // broker did not tell us"), which callers must treat as absent
        // evidence rather than agreement.
        backend: line.backend === "stock" ? line.backend : null,
      },
    };
  }

  /** Claims exclusive ownership of `opts.targetId`'s monitor socket, sending
   * `{ op: "monitor_claim", id, target_id, channel, token }` through the SAME
   * `sendAndAwaitLine()` path -- the same session, the same token, the same
   * newline-delimited JSON discipline every other op uses; no second
   * control connection is ever opened, and this function never dials the
   * binmon port itself, on success OR on failure -- see
   * MonitorOwnershipError's own header comment for why the claim is
   * made BEFORE any binmon connect(). `timeout` is reported distinctly
   * from `monitor_owned`: a timeout means the broker did not answer, never
   * that someone else owns the socket. `channel` defaults
   * to `"binary"` when omitted -- byte-identical to every pre-existing call. */
  async function claimMonitor(opts: ClaimMonitorOptions): Promise<ClaimMonitorOutcome> {
    const requestId = newRequestId();
    const channel: MonitorClaimChannel = opts.channel ?? "binary";
    const raw = await sendAndAwaitLine({ op: "monitor_claim", id: requestId, target_id: opts.targetId, channel, token }, opts.timeoutMs ?? ACQUIRE_TIMEOUT_MS);
    if (!raw.ok) {
      if (raw.kind === "deadline") return { ok: false, reason: "timeout" };
      // The `monitor_owned` REASON survives even when the wire's own
      // `holder` payload is absent or malformed. This used to be
      // `raw.kind === "monitor_owned" && raw.holder`, so a partially-malformed
      // refusal collapsed to `{ ok: false, reason: "internal" }` -- stockConnect()
      // then threw a generic ViceError, convertHandshakeError() produced "stock
      // handshake failed (...)", and the ownership-conflict framing T-02-14
      // requires (and MonitorOwnershipError exists to preserve) was lost. The
      // broker has told us WHICH state this is; not being able to name the
      // holder does not make it a different state. Holder fields default to
      // "unknown"/0/null/`channel` so the wording still reads as an ownership
      // conflict rather than an emulator fault -- never fabricated as a
      // plausible grant id, which would be worse than admitting it is unknown.
      if (raw.kind === "monitor_owned") {
        return { ok: false, reason: "monitor_owned", holder: raw.holder ?? { grantId: "unknown", claimedAt: 0, pid: null, channel } };
      }
      if (raw.kind === "unauthorized" || raw.kind === "bad_request" || raw.kind === "denied") return { ok: false, reason: raw.kind };
      return { ok: false, reason: "internal" };
    }
    if (raw.line.kind !== "monitor_claimed") {
      return { ok: false, reason: "internal" };
    }
    // Phase 63 (SESS-02): a missing or non-string `handle` is a protocol
    // failure -- this broker's own writeLine() always includes it on a
    // successful reply now, so its absence means something between this
    // client and the broker disagrees about the wire shape, never a
    // legitimate "no handle" state to paper over with a fabricated value.
    const handle = raw.line.handle;
    if (typeof handle !== "string" || handle === "") {
      return { ok: false, reason: "internal" };
    }
    return { ok: true, handle };
  }

  /** Releases a previously claimed monitor socket, sending
   * `{ op: "monitor_release", id, target_id, channel, token }` over the SAME
   * session. Tolerates a broker that has already cleared the record (the
   * broker's own onMonitorRelease answers `ok: true` for an already-cleared
   * target) -- this function never retries and never opens a second
   * connection. `channel` defaults to `"binary"` when
   * omitted. */
  async function releaseMonitor(opts: ReleaseMonitorOptions): Promise<ReleaseMonitorOutcome> {
    const requestId = newRequestId();
    const channel: MonitorClaimChannel = opts.channel ?? "binary";
    const raw = await sendAndAwaitLine({ op: "monitor_release", id: requestId, target_id: opts.targetId, channel, token }, opts.timeoutMs ?? ACQUIRE_TIMEOUT_MS);
    if (!raw.ok) {
      if (raw.kind === "deadline") return { ok: false, reason: "timeout" };
      if (raw.kind === "unauthorized" || raw.kind === "bad_request" || raw.kind === "denied") return { ok: false, reason: raw.kind };
      return { ok: false, reason: "internal" };
    }
    if (raw.line.kind !== "monitor_released") {
      return { ok: false, reason: "internal" };
    }
    return { ok: true };
  }

  /** Declares/clears the in-flight operation, sending
   * `{ op: "operation", id, target_id, channel, name, token }` over the SAME
   * session. See NoteOperationOptions'/BrokerControlSession.noteOperation's
   * own header comments for why callers are expected NOT to await this. */
  async function noteOperation(opts: NoteOperationOptions): Promise<NoteOperationOutcome> {
    const requestId = newRequestId();
    const channel: MonitorClaimChannel = opts.channel ?? "binary";
    const raw = await sendAndAwaitLine(
      { op: "operation", id: requestId, target_id: opts.targetId, channel, name: opts.name, token },
      opts.timeoutMs ?? ACQUIRE_TIMEOUT_MS,
    );
    if (!raw.ok) {
      if (raw.kind === "deadline") return { ok: false, reason: "timeout" };
      if (raw.kind === "unauthorized" || raw.kind === "bad_request" || raw.kind === "denied") return { ok: false, reason: raw.kind };
      return { ok: false, reason: "internal" };
    }
    if (raw.line.kind !== "operation_noted") {
      return { ok: false, reason: "internal" };
    }
    return { ok: true };
  }

  /** Stages a file slot on the broker's own disk, sending
   * `{ op: "stage_file", id, target_id, slot, token }` through the SAME
   * `sendAndAwaitLine()` path every other op uses -- the same session, the
   * same token, no second control connection is ever opened. Mirrors
   * claimMonitor()'s own shape: a deadline maps to `timeout`, distinctly
   * from a refusal; `unauthorized`/`bad_request`/`denied` are each reported
   * under their own reason; a missing or non-string `handle`/
   * `emulator_filename` on a success reply is a protocol failure, never
   * fabricated -- the broker always sends both on success, so their
   * absence means the two sides disagree about the wire shape.
   *
   * Does NOT touch this module's two legacy UTF-8 string framers
   * (see this file's own header comment on that legacy discovery-record
   * dial path). D-03 declined converting them deliberately: that path is
   * legacy, broker-endpoint.ts's header forbids importing it, and RM-02
   * deletes it in Phase 66 -- and the transfer this op sets up rides
   * broker-endpoint.ts, which accumulates as a Buffer, so no payload byte
   * can reach a string framer by construction. A later reader must not
   * "fix" them on this function's account. */
  async function stageFile(opts: StageFileOptions): Promise<StageFileOutcome> {
    const requestId = newRequestId();
    const raw = await sendAndAwaitLine({ op: "stage_file", id: requestId, target_id: opts.targetId, slot: opts.slot, token }, opts.timeoutMs ?? ACQUIRE_TIMEOUT_MS);
    if (!raw.ok) {
      if (raw.kind === "deadline") return { ok: false, reason: "timeout" };
      if (raw.kind === "unauthorized" || raw.kind === "bad_request" || raw.kind === "denied") return { ok: false, reason: raw.kind };
      return { ok: false, reason: "internal" };
    }
    if (raw.line.kind !== "file_staged") {
      return { ok: false, reason: "internal" };
    }
    const handle = raw.line.handle;
    const emulatorFilename = raw.line.emulator_filename;
    if (typeof handle !== "string" || handle === "" || typeof emulatorFilename !== "string" || emulatorFilename === "") {
      return { ok: false, reason: "internal" };
    }
    return { ok: true, handle, emulatorFilename };
  }

  return { acquire, release, status, hostState, claimMonitor, releaseMonitor, noteOperation, stageFile };
}

/** Opens ONE session against the control plane: reads broker.json ONCE for
 * control_host/control_port/control_token (and, from that SAME read,
 * classifies liveness -- never a second file read for the same record),
 * refuses to even attempt a connection when that classification is
 * never_started or stale, then opens ONE TCP connection and holds it for
 * the caller. Every failure mode resolves a typed `{ ok: false, kind,
 * message }` outcome rather than rejecting -- see this region's own header
 * comment for why. */
export function openBrokerControl(dir: string = brokerRootDir(), opts: OpenBrokerControlOptions = {}): Promise<OpenBrokerControlOutcome> {
  const connectTimeoutMs = opts.connectTimeoutMs ?? CONTROL_CONNECT_TIMEOUT_MS;
  return new Promise((resolvePromise) => {
    const path = brokerJsonPath(dir);
    const parsed = readJsonMaybe(path); // the ONE read of the discovery record for this whole session
    const liveness = classifyLivenessFromRecord(parsed, path);
    if (liveness.state === "never_started" || liveness.state === "stale") {
      resolvePromise({
        ok: false,
        kind: liveness.state,
        message: `openBrokerControl: broker.json classifies ${liveness.state} (${path}) -- refusing to attempt a connection`,
      });
      return;
    }
    if (parsed === null) {
      // Unreachable in practice -- classifyLivenessFromRecord() only ever
      // answers "alive" when it was handed a non-null record -- but keeps
      // the branch below soundly typed rather than asserting past the
      // compiler.
      resolvePromise({ ok: false, kind: "never_started", message: "openBrokerControl: broker.json unexpectedly absent" });
      return;
    }
    const controlHost = typeof parsed.control_host === "string" ? parsed.control_host : null;
    const port = typeof parsed.control_port === "number" ? parsed.control_port : null;
    const token = typeof parsed.control_token === "string" ? parsed.control_token : null;
    if (controlHost === null || port === null || token === null) {
      resolvePromise({
        ok: false,
        kind: "protocol",
        message: "openBrokerControl: broker.json missing control_host/control_port/control_token",
      });
      return;
    }

    const targetResult = resolveControlTarget(parsed, port);
    if (!targetResult.ok) {
      resolvePromise({ ok: false, kind: targetResult.kind, message: targetResult.message, target: targetResult.target });
      return;
    }
    const { host } = targetResult.target;

    let settled = false;
    const socket = connect({ host, port });

    const connectTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.removeListener("connect", onConnect);
      socket.removeListener("error", onError);
      socket.destroy();
      resolvePromise({
        ok: false,
        kind: "connect_refused",
        message: `openBrokerControl: no connection to ${host}:${port} within ${connectTimeoutMs}ms`,
        target: `${host}:${port}`,
      });
    }, connectTimeoutMs);
    if (typeof connectTimer.unref === "function") connectTimer.unref();

    function onConnect(): void {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      socket.removeListener("error", onError);
      resolvePromise({ ok: true, session: createSession(socket, token as string) });
    }

    function onError(err: Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      socket.removeListener("connect", onConnect);
      resolvePromise({
        ok: false,
        kind: "connect_refused",
        message: `openBrokerControl: connection to ${host}:${port} failed -- ${err.message}`,
        target: `${host}:${port}`,
      });
    }

    socket.once("connect", onConnect);
    socket.once("error", onError);
  });
}

// ---------------------------------------------------------------------------
// BROKER-CONTROL-CLIENT REGION END
// ---------------------------------------------------------------------------
