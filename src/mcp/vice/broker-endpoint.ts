// broker-endpoint.ts
//
// THIS IS THE ONE AUTHORITATIVE PLACE for dialling the fixed machine-level
// broker endpoint (plan 62-01, ENDPOINT-01..05) and classifying what
// answers. Container-side, plain TypeScript, run as source under Node's own
// type-stripping -- there is no compiled counterpart of this file.
//
// WHAT NOT TO DO, and why:
//   - Never touch the filesystem from this module -- no readFileSync,
//     existsSync, readFile, or any other fs call. The whole point of the
//     fixed endpoint is that a client finds the broker with nothing on disk
//     telling it where to look (D-06/D-07); a disk read here would silently
//     reintroduce the discovery-record dependency this milestone retires.
//     (version.ts's own runtimeVersion() DOES read a package.json, but that
//     read lives in version.ts, not here -- this module only calls it, the
//     same way vice-proxy.ts's own PROXY_VERSION already does.)
//   - Never import vice-broker-client.ts (or anything reachable through its
//     own import graph, in particular openBrokerControl()/
//     resolveControlTarget(), the two functions that read broker.json).
//     That is the legacy, per-project-discovery-record dial path this
//     milestone runs in parallel with for the whole phase and eventually
//     deletes (RM-02, Phase 66); blending the two into one function with a
//     mode flag is the exact defect this module's own separation exists to
//     prevent -- see 62-01-PLAN.md's assumption_delta_decision for the
//     generalized-identity reasoning behind keeping this a NEW module
//     rather than a graft onto the existing resolver.
//   - Never call isInsideContainer() or any other container detector to
//     decide which candidate to try, or in which order. DIAL_CANDIDATES'
//     fixed order IS the host/container detection -- that is this phase's
//     whole premise (see the phase objective in 62-01-PLAN.md).
//   - Never throw out of dialBrokerEndpoint() or classifyHelloReply(). Every
//     byte a candidate sends back is untrusted input from an unknown TCP
//     listener; the JSON parse is always wrapped and every field is
//     type-checked before use, and no negative result is ever cached --
//     the same never-throw posture vice-broker-client.ts's own header
//     states for this exact kind of boundary.
import { connect, type Socket } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runtimeVersion } from "./version.ts";

/** Mirrors broker-control.mts's own HELLO_PROTOCOL_MAGIC literal, character
 * for character. broker-control.mts is the one authoritative definition
 * (see that module's own comment on this constant) -- it is host-bound and
 * compiled into resources/, so this container-side source file cannot
 * value-import it and instead carries its own copy. Update BOTH places in
 * the SAME change if this string ever changes; broker-endpoint.test.ts
 * reads both files' source and asserts the two literals are byte-identical,
 * so an edit to only one side goes red rather than silently drifting. */
export const HELLO_PROTOCOL_MAGIC = "vice-mcp-broker-hello-v1";

/** The fixed, ordered dial candidates: the IPv4 loopback literal first, the
 * Docker bridge alias hostname second. The ORDER is fixed and IS the
 * host/container detection this phase's whole premise rests on -- no code
 * in this module may call a container detector to decide what to dial
 * instead. Frozen so a caller cannot mutate the shared array in place. */
export const DIAL_CANDIDATES: readonly string[] = Object.freeze(["127.0.0.1", "host.docker.internal"]);

/** Mirrors broker-control.mts's own resolveControlPort() default -- the
 * fixed port this whole milestone makes a persistent, machine-wide fixture.
 * Never used directly by a test: every test binds port 0 and reads its own
 * assigned port back, per this phase's own ephemeral-port test convention. */
const DEFAULT_CONTROL_PORT = 19510;

const DEFAULT_CONNECT_TIMEOUT_MS = 2000;
const DEFAULT_REPLY_TIMEOUT_MS = 2000;

/** This module's own directory, computed once at module load -- the same
 * `dirname(fileURLToPath(import.meta.url))` idiom vice-proxy.ts's own
 * HERE_DIR already uses right before it calls runtimeVersion(). */
const HERE = dirname(fileURLToPath(import.meta.url));

/** This package's own version, resolved ONCE at module load exactly the way
 * vice-proxy.ts's own PROXY_VERSION is -- reads `package.json` beside this
 * file (the published-tarball path) and degrades to the dev placeholder in
 * a git checkout. This is the "client's own version" D-05's major-version
 * compatibility rule compares the broker's reported version against. */
const CLIENT_VERSION = runtimeVersion({ pkgJsonPath: join(HERE, "package.json") });

/** The injectable connect seam's own type -- this project's standard
 * env/time/spawning/I-O injection register (a destructured options object,
 * never a positional boolean; the suite has no mocking library). A test
 * fixture supplies this to redirect a candidate host to a hand-written
 * server without ever touching real DNS. */
export type BrokerEndpointConnectFn = typeof connect;

export interface DialBrokerEndpointOptions {
  /** Defaults to the control plane's own default port. */
  port?: number;
  /** Defaults to DIAL_CANDIDATES. */
  candidates?: readonly string[];
  connectTimeoutMs?: number;
  replyTimeoutMs?: number;
  connect?: BrokerEndpointConnectFn;
  /** Injectable override for "the client's own version" D-05's
   * compatibility rule compares against -- defaults to this module's own
   * resolved CLIENT_VERSION. A test supplies this to exercise a chosen
   * major version without depending on this package's own package.json
   * contents. */
  clientVersion?: string;
}

/** The four ranks, ascending by informativeness (D-07). Rank 1: nothing is
 * listening (connect refused, or the hostname did not resolve). Rank 2: a
 * foreign listener is squatting the port (connected, but no valid/timely
 * reply). Rank 3: a stale pre-v2.0.0 broker (connected, replied
 * `unauthorized`/`bad_request` -- D-06's own stale-broker discriminator).
 * Rank 4: a genuine broker at an incompatible major version. */
export type DialRank = 1 | 2 | 3 | 4;

/** classifyHelloReply()'s own discriminated result: either a genuinely
 * completed handshake, or one of the four ranks above. Rank 4 alone also
 * carries the observed `version` string -- task 3's version-skew refusal
 * needs to NAME it, and nowhere else re-derives it from the raw reply. */
export type HelloClassification =
  | { completed: true; version: string; tag: string }
  | { completed: false; rank: 1 | 2 | 3 }
  | { completed: false; rank: 4; version: string };

export interface ClassifyHelloReplyInput {
  /** Whether the TCP connection itself succeeded. `false` collapses
   * straight to rank 1 regardless of `raw` -- there is nothing to classify
   * about a reply that was never received. */
  connected: boolean;
  /** Whatever `JSON.parse()` produced for this candidate's reply line, or
   * `null` on a parse failure, a reply timeout, or no connection at all. */
  raw: unknown;
}

/** Parses the leading integer of a version string ("2.1.0" -> 2), per D-05's
 * rule that compatibility is a MAJOR-version comparison. A non-numeric
 * leading segment (or an empty string) is unparseable, returning `null`
 * rather than `NaN` or `0`, so the caller classifies it as rank 2 (a
 * foreign listener) instead of silently comparing against a value that was
 * never a version. */
function parseLeadingMajor(version: string): number | null {
  const match = /^(\d+)/.exec(version);
  return match ? Number(match[1]) : null;
}

/** The one authoritative classifier for what a candidate's dial attempt
 * observed, mapping it onto EXACTLY one of the four D-07 ranks or a
 * completed handshake. Pure: given the same input twice, it returns the
 * same result twice -- no clock read, no state, no cached negative result.
 * Both dialBrokerEndpoint() and this file's own tests call this function;
 * neither re-implements the rank mapping. Never throws: every field is
 * type-checked before use, and an untrusted or malformed `raw` value
 * degrades to a rank rather than an exception. */
export function classifyHelloReply(input: ClassifyHelloReplyInput, clientVersion: string): HelloClassification {
  if (!input.connected) return { completed: false, rank: 1 };

  const raw = input.raw;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { completed: false, rank: 2 };
  const obj = raw as Record<string, unknown>;

  // A pre-v2.0.0 broker's token check runs ahead of dispatch, so a
  // credential-free `hello` gets exactly this error shape back -- D-06's
  // own stale-broker discriminator, checked BEFORE the hello-shape check
  // below so a stale broker is never miscategorised as a foreign listener.
  if (obj.kind === "error" && (obj.code === "unauthorized" || obj.code === "bad_request")) {
    return { completed: false, rank: 3 };
  }

  if (obj.kind !== "hello" || obj.protocol !== HELLO_PROTOCOL_MAGIC) return { completed: false, rank: 2 };
  // A missing, empty, or non-string version is a foreign listener, never a
  // version mismatch -- it was never a version to compare in the first
  // place (ENDPOINT-05, D-05).
  if (typeof obj.version !== "string" || obj.version.length === 0 || typeof obj.tag !== "string") {
    return { completed: false, rank: 2 };
  }

  const replyMajor = parseLeadingMajor(obj.version);
  const clientMajor = parseLeadingMajor(clientVersion);
  if (replyMajor === null || clientMajor === null) return { completed: false, rank: 2 };
  if (replyMajor !== clientMajor) return { completed: false, rank: 4, version: obj.version };

  return { completed: true, version: obj.version, tag: obj.tag };
}

interface CandidateOutcome {
  host: string;
  /** Whether the OS successfully resolved this candidate's hostname to an
   * address -- observable only here, at dial time, and independent of
   * whether the subsequent connection itself succeeded. This is the single
   * boolean D-08's rootless-container disclosure gates on. */
  resolved: boolean;
  classification: HelloClassification;
}

/** An error node:net can hand `error` listeners -- `code` is the piece this
 * module reads to tell a DNS failure (`ENOTFOUND`/`EAI_AGAIN`) apart from
 * every other connection failure (refused, reset, timed out at the OS
 * level), which is what makes the "resolved" boolean observable at all. */
interface NodeConnectError extends Error {
  code?: string;
}

/** Dials ONE candidate: opens a socket, sends the handshake line on
 * connect, reads one newline-delimited reply, and resolves with whatever it
 * observed. NEVER throws and NEVER rejects -- a DNS failure, a refused
 * connection, a reply timeout, and a malformed reply all resolve the same
 * promise shape with a rank, exactly the never-throw posture this boundary
 * requires. Gives this candidate its OWN connect timer and its OWN reply
 * timer, both `.unref()`d and cleared on settle, mirroring
 * vice-broker-client.ts's openBrokerControl() connect/timeout/settled
 * machinery -- this project's one existing primitive for this exact shape,
 * reused rather than reinvented, so a wedged candidate can never block its
 * sibling (ENDPOINT-02).
 *
 * `onSocket` fires SYNCHRONOUSLY, before this function returns, with the
 * live socket handle -- dialBrokerEndpoint() needs it immediately (not only
 * once this promise settles) so it can destroy a still-pending LOSING
 * candidate's socket the instant the other candidate completes, rather than
 * waiting out its own timers for no reason. */
function dialOneCandidate(
  host: string,
  port: number,
  connectTimeoutMs: number,
  replyTimeoutMs: number,
  connectFn: BrokerEndpointConnectFn,
  clientVersion: string,
  onSocket: (socket: Socket) => void,
): Promise<CandidateOutcome> {
  return new Promise((resolvePromise) => {
    let settled = false;
    let buffer = "";
    let replyTimer: ReturnType<typeof setTimeout> | null = null;

    const socket = connectFn({ host, port });
    onSocket(socket);

    const connectTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      if (!socket.destroyed) socket.destroy();
      resolvePromise({ host, resolved: false, classification: classifyHelloReply({ connected: false, raw: null }, clientVersion) });
    }, connectTimeoutMs);
    if (typeof connectTimer.unref === "function") connectTimer.unref();

    function finish(connected: boolean, raw: unknown, resolved: boolean): void {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      if (replyTimer) clearTimeout(replyTimer);
      socket.removeAllListeners();
      resolvePromise({ host, resolved, classification: classifyHelloReply({ connected, raw }, clientVersion) });
    }

    socket.once("connect", () => {
      if (settled) return;
      clearTimeout(connectTimer);
      socket.write(`${JSON.stringify({ op: "hello" })}\n`);

      // Bounds the wait for a reply SEPARATELY from the connect timeout --
      // a listener that accepts and never writes a byte (a "wedged"
      // candidate) is bounded here, not by the connect timer above, which
      // already cleared the instant TCP connect succeeded.
      replyTimer = setTimeout(() => finish(true, null, true), replyTimeoutMs);
      if (typeof replyTimer.unref === "function") replyTimer.unref();

      socket.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const idx = buffer.indexOf("\n");
        if (idx === -1) return;
        const line = buffer.slice(0, idx);
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(line);
        } catch {
          parsed = null;
        }
        // A connection that got this far genuinely connected -- resolved is
        // unconditionally true, DNS having plainly already succeeded.
        finish(true, parsed, true);
      });
    });

    socket.once("error", (err: NodeConnectError) => {
      const dnsFailure = err.code === "ENOTFOUND" || err.code === "EAI_AGAIN";
      if (!socket.destroyed) socket.destroy();
      finish(false, null, !dnsFailure);
    });
  });
}

/** One candidate's ranked, unclassified-handshake observation -- what
 * describeDialFailure() (task 3) reads to build its refusal text. */
export interface DialCandidateObservation {
  host: string;
  rank: DialRank;
  resolved: boolean;
  /** The reply's own version string -- present ONLY for a rank-4
   * (version-skew) observation, since that is the one rank whose refusal
   * text needs to name an observed version at all. */
  version?: string;
}

export interface DialSuccess {
  ok: true;
  host: string;
  port: number;
  version: string;
  tag: string;
}

export interface DialFailure {
  ok: false;
  /** The port every candidate was dialled on -- describeDialFailure() (task
   * 3) needs this to name in its refusal text; it is not itself part of any
   * per-candidate observation because it is the SAME for every candidate. */
  port: number;
  /** "The client's own version" D-05's compatibility rule compared every
   * candidate's reply against -- carried here (rather than re-resolved by
   * describeDialFailure()) so that function stays pure: no env read, no
   * package.json read, just this already-resolved string. */
  clientVersion: string;
  /** The HIGHEST rank observed across every candidate -- D-07's own
   * "report the most informative failure seen across both" rule. */
  rank: DialRank;
  /** Always in FIXED candidate order (never settle order), so a tie
   * between two candidates on the same rank still names the loopback
   * candidate first, deterministically. */
  observations: DialCandidateObservation[];
}

export type DialResult = DialSuccess | DialFailure;

/** Dials the fixed endpoint. Every candidate is started IMMEDIATELY and
 * CONCURRENTLY -- never sequentially, never chained (ENDPOINT-02) -- so a
 * wedged first candidate can never delay, let alone block, the second.
 * Resolves as soon as ANY candidate produces a COMPLETED handshake (D-07);
 * a version-skew or stale-broker observation is not a completed handshake
 * and never short-circuits the other candidate, which may still complete.
 * Only once every candidate has settled with nothing completed does this
 * resolve `ok: false`, carrying the highest rank seen and the full,
 * stably-ordered per-candidate observation set.
 *
 * Destroys every socket this dial opened before resolving, on BOTH the
 * success and failure paths -- including a still-pending losing candidate's
 * socket the instant a winner is found, so a dial never leaks a handle and
 * never waits out a timer it no longer needs to. */
export async function dialBrokerEndpoint(options: DialBrokerEndpointOptions = {}): Promise<DialResult> {
  const port = options.port ?? DEFAULT_CONTROL_PORT;
  const candidates = options.candidates ?? DIAL_CANDIDATES;
  const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const replyTimeoutMs = options.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
  const connectFn = options.connect ?? connect;
  const clientVersion = options.clientVersion ?? CLIENT_VERSION;

  return new Promise<DialResult>((resolveOuter) => {
    const sockets: (Socket | null)[] = candidates.map(() => null);
    const observations: (DialCandidateObservation | undefined)[] = candidates.map(() => undefined);
    let settledCount = 0;
    let outerSettled = false;

    function destroyAllSockets(): void {
      for (const s of sockets) {
        if (s && !s.destroyed) s.destroy();
      }
    }

    function finishOuter(result: DialResult): void {
      if (outerSettled) return;
      outerSettled = true;
      destroyAllSockets();
      resolveOuter(result);
    }

    candidates.forEach((host, idx) => {
      dialOneCandidate(host, port, connectTimeoutMs, replyTimeoutMs, connectFn, clientVersion, (socket) => {
        sockets[idx] = socket;
      }).then((outcome) => {
        settledCount++;
        const classification = outcome.classification;
        if (classification.completed) {
          finishOuter({ ok: true, host: outcome.host, port, version: classification.version, tag: classification.tag });
          return;
        }
        observations[idx] = {
          host: outcome.host,
          resolved: outcome.resolved,
          rank: classification.rank,
          version: classification.rank === 4 ? classification.version : undefined,
        };
        if (settledCount === candidates.length && !outerSettled) {
          const finalObservations = observations as DialCandidateObservation[];
          const highestRank = finalObservations.reduce<DialRank>((max, o) => (o.rank > max ? o.rank : max), 1);
          finishOuter({ ok: false, port, clientVersion, rank: highestRank, observations: finalObservations });
        }
      });
    });
  });
}

// ---------------------------------------------------------------------------
// The four ranked refusals (task 3, ENDPOINT-04) and the one shared start
// command they all quote.
// ---------------------------------------------------------------------------

/** D-01's fixed invocation -- the ONE command that starts a broker, correct
 * and identical whether the caller is on the host or inside a container.
 * Under this milestone a containerized client has no bind mount and
 * therefore no way to compute a HOST PATH at all, so this is deliberately a
 * fixed string with no path in it -- the two path-bearing alternatives
 * (running the host launcher script in place, or deploying one to a
 * machine-level bin) both produce a path the refusing client has no way to
 * compute.
 *
 * This is an INVOCATION, not an install -- the same carve-out CLAUDE.md
 * already grants this project's documented `npx -y @henols/vice-mcp anno
 * <verb>` route out of the never-auto-install rule.
 *
 * FOUR other sites quote this exact string; change it here and update all
 * four in the SAME change: README.md's install section, the systemd unit,
 * the launchd plist, and the documented universal fallback.
 *
 * Deliberately does NOT join `prerequisites.json`: that file's `kind` field
 * is a closed two-member union (`"executable"` | `"directory"`) enforced by
 * a named test, and a live TCP listener is neither -- widening that schema
 * for a refusal that already fires correctly at its own point of use (a
 * real failed dial) would add pre-flight-flavoured indirection for no
 * benefit (RESEARCH.md's own Deferred Question, answered "no, inline the
 * constant instead"). */
export const BROKER_START_COMMAND = "npx -y @henols/vice-mcp broker";

/** D-05's supporting fact: CI derives both packages' versions from the same
 * `v*` tag and publishes them together, so a major-version skew is only
 * possible when a user updates one side (the broker, or this client's own
 * installed copy) and not the other. Both names are surfaced in the rank-4
 * message so the reader knows both packages move in lockstep. */
const SERVER_PACKAGE_NAME = "@henols/vice-mcp";
const INSTALLER_PACKAGE_NAME = "@henols/c64-re-tools";

/** D-08: appended to a refusal ONLY when some candidate's hostname RESOLVED
 * -- since every observation in a DialFailure already represents a FAILED
 * connection by construction, "resolved but failed" collapses to simply
 * "any observation has resolved:true". Gated on this dial-observed
 * condition alone, NEVER on a container-detection call -- that would
 * reintroduce in this client exactly the isInsideContainer() call RM-03
 * deletes, and would contradict this phase's own premise that the dial
 * order IS the detection.
 *
 * Community-sourced, MEDIUM confidence: worded as a possibility to check,
 * with that provenance disclosed in the sentence itself, and never stated
 * as the diagnosis (this plan's transparency prohibition). Does not
 * mention Podman's `pasta` default at all -- that is DEFER-01, a deferred
 * verification item, not something to state here. */
function rootlessDisclosure(failure: DialFailure): string {
  const anyResolvedButFailed = failure.observations.some((o) => o.resolved);
  if (!anyResolvedButFailed) return "";
  return (
    "\nIf this is a rootless container runtime, this MAY (unconfirmed by any vendor -- community-sourced " +
    'only) be a host-loopback restriction on the bridge gateway, the signature some rootless Docker/' +
    'RootlessKit configurations report under "slirp4netns --disable-host-loopback" -- worth checking if ' +
    "the above does not resolve it."
  );
}

/** Rank 1: nothing answered on either candidate. States plainly that no
 * client starts one automatically -- the user does (BROKER-02) -- and
 * gives the start command as the remedy. */
function rank1Message(failure: DialFailure): string {
  const hosts = failure.observations.map((o) => o.host).join(" and ");
  return (
    `vice: no broker answered on either candidate (${hosts}, port ${failure.port}). No client starts one ` +
    `automatically -- start it yourself, on the machine you want the broker running on:\n` +
    `  ${BROKER_START_COMMAND}` +
    rootlessDisclosure(failure)
  );
}

/** Rank 2: something else is squatting the port. Names the candidate host
 * and the port, and suggests checking what holds it before restarting
 * anything -- restarting is NOT the remedy here, since nothing broker-owned
 * is even listening yet. */
function rank2Message(failure: DialFailure): string {
  const squatters = failure.observations.filter((o) => o.rank === 2);
  const hosts = (squatters.length > 0 ? squatters : failure.observations).map((o) => o.host).join(" and ");
  return (
    `vice: something else is already listening on ${hosts} (port ${failure.port}) -- it accepted the ` +
    `connection but did not answer as this broker. Check what holds that port before restarting anything.` +
    rootlessDisclosure(failure)
  );
}

/** Rank 3: a stale pre-v2.0.0 broker. D-06's own stale-broker signature --
 * a broker whose credential check runs ahead of dispatch refuses a
 * credential-free `hello` with exactly this error shape. The remedy is to
 * stop it and start one from the current package. */
function rank3Message(failure: DialFailure): string {
  return (
    `vice: the listener on port ${failure.port} speaks this protocol but refused the handshake -- that is ` +
    `what a broker older than v2.0.0 does, because its credential check runs ahead of dispatch. Stop it and ` +
    `start one from the current package:\n` +
    `  ${BROKER_START_COMMAND}` +
    rootlessDisclosure(failure)
  );
}

/** Rank 4: a genuine broker at an incompatible major version. Names BOTH
 * package names and BOTH observed versions, and says which side is behind,
 * because the reader's next action differs depending on which one it is
 * (D-05, ENDPOINT-05). */
function rank4Message(failure: DialFailure): string {
  const skewed = failure.observations.find((o) => o.rank === 4 && o.version !== undefined);
  const brokerVersion = skewed?.version ?? "unknown";
  const clientMajor = parseLeadingMajor(failure.clientVersion);
  const brokerMajor = skewed?.version !== undefined ? parseLeadingMajor(skewed.version) : null;
  let whichSide: string;
  if (clientMajor !== null && brokerMajor !== null && clientMajor < brokerMajor) {
    whichSide = `this client is behind -- update ${SERVER_PACKAGE_NAME} (and ${INSTALLER_PACKAGE_NAME}, published together)`;
  } else if (clientMajor !== null && brokerMajor !== null && clientMajor > brokerMajor) {
    whichSide = `the broker is behind -- stop it and start one from the current package`;
  } else {
    whichSide = "one side is behind the other";
  }
  return (
    `vice: this client (${SERVER_PACKAGE_NAME} v${failure.clientVersion}) and the broker (v${brokerVersion}) ` +
    `are on incompatible major versions -- ${whichSide}. ${SERVER_PACKAGE_NAME} and ${INSTALLER_PACKAGE_NAME} ` +
    `are always published together at the same version, so bringing one up to date means bringing both:\n` +
    `  ${BROKER_START_COMMAND}` +
    rootlessDisclosure(failure)
  );
}

/** Builds the act-on-able refusal text for a failed dial, reading Task 2's
 * already-ranked failure result -- it does not re-derive the rank or
 * re-classify anything. Pure: no clock read, no environment read beyond
 * the already-resolved `failure.clientVersion`, no caching. Two calls on
 * the same input return the same bytes. */
export function describeDialFailure(failure: DialFailure): string {
  switch (failure.rank) {
    case 1:
      return rank1Message(failure);
    case 2:
      return rank2Message(failure);
    case 3:
      return rank3Message(failure);
    case 4:
      return rank4Message(failure);
  }
}
