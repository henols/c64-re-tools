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
//   - Never throw out of dialBrokerEndpoint() or anything it calls. Every
//     byte a candidate sends back is untrusted input from an unknown TCP
//     listener; the JSON parse is always wrapped and every field is
//     type-checked before use, and no negative result is ever cached --
//     the same never-throw posture vice-broker-client.ts's own header
//     states for this exact kind of boundary.
import { connect, type Socket } from "node:net";

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
}

/** One candidate's raw observation. Task 1's own shape -- no ranking is
 * applied yet; task 2 widens this with the classified rank and the
 * hostname-resolved boolean D-08's disclosure gate needs. */
export interface DialCandidateObservation {
  host: string;
  ok: boolean;
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
  observations: DialCandidateObservation[];
}

export type DialResult = DialSuccess | DialFailure;

/** A completed handshake's own shape, narrowed off the wire. `raw` is
 * whatever `JSON.parse()` produced (or `null` on a parse failure) -- every
 * field is type-checked before use, and this function never throws. */
function isCompletedHello(raw: unknown): raw is { kind: string; protocol: string; version: string; tag: string } {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return obj.kind === "hello" && obj.protocol === HELLO_PROTOCOL_MAGIC && typeof obj.version === "string" && typeof obj.tag === "string";
}

interface CandidateOutcome {
  host: string;
  ok: boolean;
  socket: Socket | null;
  reply: unknown;
}

/** Dials ONE candidate: opens a socket, sends the handshake line on
 * connect, reads one newline-delimited reply, and resolves with whatever it
 * observed. NEVER throws and NEVER rejects -- a DNS failure, a refused
 * connection, a reply timeout, and a malformed reply all resolve the same
 * promise shape with `ok: false`, exactly the never-throw posture this
 * boundary requires. Gives this candidate its OWN connect timer and its OWN
 * reply timer, both `.unref()`d and cleared on settle, mirroring
 * vice-broker-client.ts's openBrokerControl() connect/timeout/settled
 * machinery -- this project's one existing primitive for this exact shape,
 * reused rather than reinvented. */
function dialOneCandidate(
  host: string,
  port: number,
  connectTimeoutMs: number,
  replyTimeoutMs: number,
  connectFn: BrokerEndpointConnectFn,
): Promise<CandidateOutcome> {
  return new Promise((resolvePromise) => {
    let settled = false;
    let buffer = "";
    let replyTimer: ReturnType<typeof setTimeout> | null = null;

    const socket = connectFn({ host, port });

    const connectTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolvePromise({ host, ok: false, socket: null, reply: null });
    }, connectTimeoutMs);
    if (typeof connectTimer.unref === "function") connectTimer.unref();

    function finish(ok: boolean, reply: unknown): void {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      if (replyTimer) clearTimeout(replyTimer);
      socket.removeAllListeners();
      resolvePromise({ host, ok, socket, reply });
    }

    socket.once("connect", () => {
      if (settled) return;
      clearTimeout(connectTimer);
      socket.write(`${JSON.stringify({ op: "hello" })}\n`);

      replyTimer = setTimeout(() => finish(false, null), replyTimeoutMs);
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
        finish(isCompletedHello(parsed), parsed);
      });
    });

    socket.once("error", () => {
      finish(false, null);
    });
  });
}

/** Dials the fixed endpoint: opens one socket per candidate (both started
 * immediately -- see dialOneCandidate()'s own comment for why neither
 * candidate is ever chained after the other), sends the handshake, and
 * resolves with the first candidate whose reply carries the expected
 * protocol magic. Destroys every socket the dial opened before resolving,
 * including the losing candidate's.
 *
 * Task 1's own shape: the happy path only. A failure here may carry raw,
 * unranked per-candidate observations -- the four-outcome ranking
 * (classifyHelloReply) and the act-on-able refusal text
 * (describeDialFailure) are task 2 and task 3. */
export async function dialBrokerEndpoint(options: DialBrokerEndpointOptions = {}): Promise<DialResult> {
  const port = options.port ?? DEFAULT_CONTROL_PORT;
  const candidates = options.candidates ?? DIAL_CANDIDATES;
  const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const replyTimeoutMs = options.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
  const connectFn = options.connect ?? connect;

  const outcomes = await Promise.all(candidates.map((host) => dialOneCandidate(host, port, connectTimeoutMs, replyTimeoutMs, connectFn)));

  const winner = outcomes.find((o) => o.ok);

  for (const outcome of outcomes) {
    if (outcome.socket && !outcome.socket.destroyed) outcome.socket.destroy();
  }

  if (winner) {
    const reply = winner.reply as { version: string; tag: string };
    return { ok: true, host: winner.host, port, version: reply.version, tag: reply.tag };
  }

  return { ok: false, observations: outcomes.map((o) => ({ host: o.host, ok: o.ok })) };
}
