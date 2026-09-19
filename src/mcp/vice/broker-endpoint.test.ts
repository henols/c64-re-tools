// broker-endpoint.test.ts
//
// Plan 62-01, task 1: the genuine end-to-end case (a real listener, a real
// dial, a completed handshake), plus the structural assertions that keep
// this module's own written-down contract honest -- no filesystem access,
// no import of the legacy discovery-record client, and the two mirrored
// magic-string literals in byte-identical agreement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, createServer, Socket, type Server } from "node:net";

import { startControlListener, bindControlListener, HELLO_PROTOCOL_MAGIC as SERVER_HELLO_PROTOCOL_MAGIC, newControlToken } from "./broker-control.mts";
import {
  dialBrokerEndpoint,
  classifyHelloReply,
  describeDialFailure,
  BROKER_START_COMMAND,
  DIAL_CANDIDATES,
  HELLO_PROTOCOL_MAGIC,
  type BrokerEndpointConnectFn,
  type DialFailure,
} from "./broker-endpoint.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ENDPOINT_TS = join(HERE, "broker-endpoint.ts");
const BROKER_CONTROL_MTS = join(HERE, "broker-control.mts");

/** Strips `//` line comments and `/* ... *\/` block comments -- the same
 * stripCommentLines() idiom hostpath-consumers.test.ts and
 * tool-location-consumers.test.ts already use for exactly this reason: this
 * module's own header comments NAME the forbidden fs calls and the legacy
 * client module (explaining what NOT to do), so a naive raw-source
 * substring check would trip on its own prose rather than on real code. */
function stripCommentLines(src: string): string {
  const out: string[] = [];
  let inBlock = false;

  function processSegment(text: string): void {
    if (inBlock) {
      const closeIdx = text.indexOf("*/");
      if (closeIdx === -1) return;
      inBlock = false;
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith("/*")) {
      const openIdx = text.indexOf("/*");
      const closeIdx = text.indexOf("*/", openIdx + 2);
      if (closeIdx === -1) {
        inBlock = true;
        return;
      }
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    if (/^\s*\/\//.test(text)) return;
    out.push(text);
  }

  for (const line of src.split("\n")) {
    processSegment(line);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// The genuine end-to-end case.
// ---------------------------------------------------------------------------

test("dialBrokerEndpoint completes a real handshake end to end against a real listener on an ephemeral port", async () => {
  const token = newControlToken();
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0, // ephemeral -- never the production port literal
    token,
    onAcquire: async () => ({ ok: false, reason: "internal" }),
    onRelease: () => {},
    onRecycle: async () => ({ port: null, pid: null, viceBin: null, killStage: "no_signal", epochBefore: null, outcome: "n/a", reason: "no stub configured" }),
    onStatus: () => [],
    onHostState: () => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      maxInstances: 16,
      basePort: 6600,
      backend: "stock" as const,
    }),
    onMonitorClaim: () => ({ ok: false, code: "internal" as const }),
    onMonitorRelease: () => ({ ok: false, code: "internal" as const }),
    onRelayAttach: () => ({ ok: false, code: "internal" as const }),
    onHostTool: async () => ({ ok: false, message: "no onHostTool stub configured" }),
  });
  try {
    const result = await dialBrokerEndpoint({ port: listener.port, candidates: ["127.0.0.1"] });
    assert.equal(result.ok, true, `expected a completed handshake, got ${JSON.stringify(result)}`);
    if (result.ok) {
      assert.equal(result.port, listener.port);
      assert.equal(result.host, "127.0.0.1");
      assert.equal(typeof result.version, "string");
      assert.equal(result.tag, "control");
    }
  } finally {
    listener.server.close();
  }
});

// ---------------------------------------------------------------------------
// The default candidate list.
// ---------------------------------------------------------------------------

test("DIAL_CANDIDATES is exactly the two fixed hosts, loopback first", () => {
  assert.deepEqual(DIAL_CANDIDATES, ["127.0.0.1", "host.docker.internal"]);
});

// ---------------------------------------------------------------------------
// Structural assertions: no filesystem access, no legacy-client import.
// ---------------------------------------------------------------------------

test("broker-endpoint.ts never touches the filesystem and never imports the legacy discovery-record client", () => {
  // readFileSync, not a shell grep -- four source files in this tree carry
  // NUL bytes that a shell grep silently skips (see this repo's own
  // documented gotcha); readFileSync with "utf8" never truncates on one.
  // Comment-stripped, because this module's own header comments NAME the
  // forbidden calls and the legacy module while explaining why they are
  // forbidden -- a raw substring check would trip on that prose, not on
  // real code.
  const source = stripCommentLines(readFileSync(BROKER_ENDPOINT_TS, "utf8"));
  for (const forbidden of ["readFileSync(", "existsSync(", "readFile(", "broker.json", "vice-broker-client"]) {
    assert.ok(!source.includes(forbidden), `broker-endpoint.ts must not contain ${JSON.stringify(forbidden)} outside of comments`);
  }
});

test("the mirrored HELLO_PROTOCOL_MAGIC literal in broker-endpoint.ts is byte-identical to broker-control.mts's own definition", () => {
  assert.equal(HELLO_PROTOCOL_MAGIC, SERVER_HELLO_PROTOCOL_MAGIC);

  // Belt and braces: read both literals directly out of source, not just
  // out of the imported runtime values, so a copy-paste that diverges only
  // in a comment-adjacent duplicate would still be caught.
  const clientSource = readFileSync(BROKER_ENDPOINT_TS, "utf8");
  const serverSource = readFileSync(BROKER_CONTROL_MTS, "utf8");
  const clientMatch = clientSource.match(/export const HELLO_PROTOCOL_MAGIC = "([^"]+)"/);
  const serverMatch = serverSource.match(/export const HELLO_PROTOCOL_MAGIC = "([^"]+)"/);
  assert.ok(clientMatch, "broker-endpoint.ts must export HELLO_PROTOCOL_MAGIC as a string literal");
  assert.ok(serverMatch, "broker-control.mts must export HELLO_PROTOCOL_MAGIC as a string literal");
  assert.equal(clientMatch![1], serverMatch![1]);
});

// ============================================================================
// Plan 62-01, task 2: both candidates always dialled, each on its own
// timeout, ranked by informativeness (D-07). Fixtures are built from real
// sockets on ephemeral ports; candidate SELECTION is driven through the
// `candidates` option and an injected `connect` seam, never real DNS.
// ============================================================================

/** A stub StartControlListenerOptions set that answers `hello` only --
 * every acquire/release/etc callback is a harmless no-op refusal, since no
 * task-2 test exercises the lease-bearing ops. */
async function startHealthyListener(overrides: { helloVersion?: string } = {}) {
  const token = newControlToken();
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    token,
    onAcquire: async () => ({ ok: false, reason: "internal" }) as const,
    onRelease: () => {},
    onRecycle: async () => ({ port: null, pid: null, viceBin: null, killStage: "no_signal", epochBefore: null, outcome: "n/a", reason: "n/a" }),
    onStatus: () => [],
    onHostState: () => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      maxInstances: 16,
      basePort: 6600,
      backend: "stock" as const,
    }),
    onMonitorClaim: () => ({ ok: false, code: "internal" as const }),
    onMonitorRelease: () => ({ ok: false, code: "internal" as const }),
    onRelayAttach: () => ({ ok: false, code: "internal" as const }),
    onHostTool: async () => ({ ok: false, message: "no onHostTool stub configured" }),
    helloVersion: overrides.helloVersion,
  });
  return { listener, token };
}

/** Binds a real listener, reads back its kernel-chosen port, then closes it
 * immediately -- the port now refuses connections on loopback,
 * deterministically (the exact idiom vice-broker-client.test.ts's own
 * "a refused connection returns a typed connect_refused failure" case
 * already uses; no reliance on a hardcoded port being free). */
async function allocateDeadPort(): Promise<number> {
  const probe = await bindControlListener("127.0.0.1", 0);
  await new Promise<void>((r) => probe.server.close(() => r()));
  return probe.port;
}

/** A tiny hand-written server that writes ONE canned newline-delimited-JSON
 * line to every connection immediately (never reading the incoming hello
 * request first) -- the stale-broker and version-skew fixtures both need
 * exactly this shape, differing only in the line's own content. */
function startCannedLineServer(line: string): Promise<{ server: Server; port: number }> {
  return new Promise((resolvePromise) => {
    const server = createServer((socket) => {
      socket.write(`${line}\n`);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolvePromise({ server, port });
    });
  });
}

/** An injected `connect` seam redirecting each candidate NAME (arbitrary,
 * never touching real DNS) to a real fixture port on loopback, per this
 * phase's own "per-candidate port map or an injected connect seam" test
 * convention. A name absent from the map falls back to whatever port the
 * dial itself resolved (unused by any test here, but keeps the type total). */
function makeCandidateConnect(portByHost: Record<string, number>): BrokerEndpointConnectFn {
  const impl = (opts: { host?: string; port?: number }): Socket => {
    const host = opts.host ?? "";
    const port = portByHost[host] ?? opts.port ?? 0;
    return connect({ host: "127.0.0.1", port });
  };
  return impl as unknown as BrokerEndpointConnectFn;
}

/** Like makeCandidateConnect(), but `dnsFailHosts` synthesizes a genuine DNS
 * resolution failure (ENOTFOUND) for the named candidates instead of ever
 * attempting a real connection -- a real `net.Socket`, so it satisfies every
 * EventEmitter/`.destroy()`/`.destroyed` usage dialOneCandidate makes, but
 * its "connection" is entirely synthetic and touches no real network. */
function makeConnectWithDnsFailure(dnsFailHosts: Set<string>, portByHost: Record<string, number> = {}): BrokerEndpointConnectFn {
  const impl = (opts: { host?: string; port?: number }): Socket => {
    const host = opts.host ?? "";
    if (dnsFailHosts.has(host)) {
      const sock = new Socket();
      queueMicrotask(() => {
        const err = new Error(`getaddrinfo ENOTFOUND ${host}`) as NodeJS.ErrnoException;
        err.code = "ENOTFOUND";
        sock.emit("error", err);
      });
      return sock;
    }
    const port = portByHost[host] ?? opts.port ?? 0;
    return connect({ host: "127.0.0.1", port });
  };
  return impl as unknown as BrokerEndpointConnectFn;
}

/** Delays the ACTUAL connect attempt for exactly one named candidate by
 * `delayMs`, using node:net's own two-phase construct-then-connect --
 * `new Socket()` returns synchronously (as dialOneCandidate's `onSocket`
 * callback requires) and `.connect(...)` is invoked later on that SAME
 * object, firing the ordinary "connect"/"error" events whenever it runs.
 * This is what lets a test arrange for one specific candidate to settle
 * AFTER the other despite being listed first, so the tie-ordering
 * assertion is proven against candidate order, never settle order. */
function makeCandidateConnectWithDelay(delayedHost: string, delayMs: number, portByHost: Record<string, number>): BrokerEndpointConnectFn {
  const impl = (opts: { host?: string; port?: number }): Socket => {
    const host = opts.host ?? "";
    const port = portByHost[host] ?? opts.port ?? 0;
    const sock = new Socket();
    if (host === delayedHost) {
      setTimeout(() => sock.connect({ host: "127.0.0.1", port }), delayMs);
    } else {
      sock.connect({ host: "127.0.0.1", port });
    }
    return sock;
  };
  return impl as unknown as BrokerEndpointConnectFn;
}

// --------------------------------------------------------------- classifyHelloReply

test("classifyHelloReply: not connected -> rank 1 (nothing is listening)", () => {
  assert.deepEqual(classifyHelloReply({ connected: false, raw: null }, "5.0.0"), { completed: false, rank: 1 });
});

test("classifyHelloReply: connected but no valid reply (timeout or non-JSON) -> rank 2 (foreign listener)", () => {
  assert.deepEqual(classifyHelloReply({ connected: true, raw: null }, "5.0.0"), { completed: false, rank: 2 });
});

test("classifyHelloReply: connected, wrong protocol magic -> rank 2", () => {
  const raw = { kind: "hello", protocol: "not-the-real-magic", version: "5.0.0", tag: "x" };
  assert.deepEqual(classifyHelloReply({ connected: true, raw }, "5.0.0"), { completed: false, rank: 2 });
});

test("classifyHelloReply: connected, unauthorized error -> rank 3 (stale pre-v2.0.0 broker)", () => {
  const raw = { kind: "error", code: "unauthorized", message: "missing or invalid control token" };
  assert.deepEqual(classifyHelloReply({ connected: true, raw }, "5.0.0"), { completed: false, rank: 3 });
});

test("classifyHelloReply: connected, bad_request error -> rank 3", () => {
  const raw = { kind: "error", code: "bad_request", message: "unknown op" };
  assert.deepEqual(classifyHelloReply({ connected: true, raw }, "5.0.0"), { completed: false, rank: 3 });
});

test("classifyHelloReply: connected, valid magic, incompatible major -> rank 4 (version skew), carrying the observed version", () => {
  const raw = { kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: "6.0.0", tag: "x" };
  assert.deepEqual(classifyHelloReply({ connected: true, raw }, "5.0.0"), { completed: false, rank: 4, version: "6.0.0" });
});

test("classifyHelloReply: connected, valid magic, compatible major -> a completed handshake", () => {
  const raw = { kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: "5.9.9", tag: "x" };
  assert.deepEqual(classifyHelloReply({ connected: true, raw }, "5.0.0"), { completed: true, version: "5.9.9", tag: "x" });
});

test("classifyHelloReply: a missing, empty, or non-string version classifies as rank 2, never as a version mismatch", () => {
  for (const badVersion of [undefined, "", 42, null]) {
    const raw = { kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: badVersion, tag: "x" };
    assert.deepEqual(classifyHelloReply({ connected: true, raw }, "5.0.0"), { completed: false, rank: 2 }, `version ${JSON.stringify(badVersion)} must classify as rank 2, not a skew`);
  }
});

test("classifyHelloReply: a non-numeric leading version segment is unparseable and classifies as rank 2, not compared", () => {
  const raw = { kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: "vNext", tag: "x" };
  assert.deepEqual(classifyHelloReply({ connected: true, raw }, "5.0.0"), { completed: false, rank: 2 });
});

test("classifyHelloReply holds no state: classifying the same reply twice yields the same outcome", () => {
  const raw = { kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: "6.0.0", tag: "x" };
  const first = classifyHelloReply({ connected: true, raw }, "5.0.0");
  const second = classifyHelloReply({ connected: true, raw }, "5.0.0");
  assert.deepEqual(first, second);
});

// --------------------------------------------------------------- the nine <behavior> cases

test("behavior 1: candidate 1 wedged (accepts, never writes a byte), candidate 2 healthy -- resolves ok from candidate 2, well within twice the reply timeout", async () => {
  const wedged = await bindControlListener("127.0.0.1", 0);
  const { listener: healthy } = await startHealthyListener();
  try {
    const replyTimeoutMs = 300;
    const connectFn = makeCandidateConnect({ "cand-wedged": wedged.port, "cand-healthy": healthy.port });
    const start = Date.now();
    const result = await dialBrokerEndpoint({
      candidates: ["cand-wedged", "cand-healthy"],
      connect: connectFn,
      connectTimeoutMs: 500,
      replyTimeoutMs,
    });
    const elapsed = Date.now() - start;
    assert.equal(result.ok, true, `expected a completed handshake, got ${JSON.stringify(result)}`);
    if (result.ok) assert.equal(result.host, "cand-healthy");
    assert.ok(elapsed < replyTimeoutMs * 2, `expected under twice the reply timeout (${replyTimeoutMs * 2}ms), took ${elapsed}ms -- candidates must run concurrently, not chained`);
  } finally {
    wedged.server.close();
    healthy.server.close();
  }
});

test("behavior 2: candidate 1 healthy, candidate 2 unresolvable -- the dial resolves ok from candidate 1", async () => {
  const { listener: healthy } = await startHealthyListener();
  try {
    const connectFn = makeConnectWithDnsFailure(new Set(["cand-dns-fail"]), { "cand-healthy": healthy.port });
    const result = await dialBrokerEndpoint({
      candidates: ["cand-healthy", "cand-dns-fail"],
      connect: connectFn,
      connectTimeoutMs: 500,
      replyTimeoutMs: 500,
    });
    assert.equal(result.ok, true, `expected a completed handshake, got ${JSON.stringify(result)}`);
    if (result.ok) assert.equal(result.host, "cand-healthy");
  } finally {
    healthy.server.close();
  }
});

test("behavior 3: both candidates healthy -- the dial resolves ok once, and every socket (winner and loser) is destroyed before it resolves", async () => {
  const { listener: a } = await startHealthyListener();
  const { listener: b } = await startHealthyListener();
  try {
    const connectFn = makeCandidateConnect({ "cand-a": a.port, "cand-b": b.port });
    const result = await dialBrokerEndpoint({
      candidates: ["cand-a", "cand-b"],
      connect: connectFn,
      connectTimeoutMs: 500,
      replyTimeoutMs: 500,
    });
    assert.equal(result.ok, true, `expected a completed handshake, got ${JSON.stringify(result)}`);

    // Give the destroyed sockets' "close" events a tick to propagate
    // server-side before asking each server how many connections remain.
    await new Promise((r) => setTimeout(r, 100));
    const aConns = await new Promise<number>((resolvePromise) => a.server.getConnections((_err, count) => resolvePromise(count)));
    const bConns = await new Promise<number>((resolvePromise) => b.server.getConnections((_err, count) => resolvePromise(count)));
    assert.equal(aConns, 0, "candidate a's server must show zero live connections once the dial has resolved");
    assert.equal(bConns, 0, "candidate b's server must show zero live connections once the dial has resolved");
  } finally {
    a.server.close();
    b.server.close();
  }
});

test("behavior 4: neither candidate connects -- not-ok with rank 1, and each candidate's resolved boolean is observed correctly", async () => {
  const deadPort = await allocateDeadPort();
  const connectFn = makeConnectWithDnsFailure(new Set(["cand-dns-fail"]), { "cand-refused": deadPort });
  const result = await dialBrokerEndpoint({
    candidates: ["cand-dns-fail", "cand-refused"],
    connect: connectFn,
    connectTimeoutMs: 500,
    replyTimeoutMs: 500,
  });
  assert.equal(result.ok, false, `expected not-ok, got ${JSON.stringify(result)}`);
  if (result.ok) return;
  assert.equal(result.rank, 1);
  assert.equal(result.observations.length, 2);
  const dnsObs = result.observations.find((o) => o.host === "cand-dns-fail");
  const refusedObs = result.observations.find((o) => o.host === "cand-refused");
  assert.ok(dnsObs && refusedObs, "both candidate observations must be present");
  assert.equal(dnsObs!.resolved, false, "a DNS failure must record resolved:false");
  assert.equal(refusedObs!.resolved, true, "a connect-refused failure must record resolved:true -- DNS succeeded, nothing is listening");
});

test("behavior 5: candidate 1 a bare accepting listener (foreign listener), candidate 2 refused -- not-ok with rank 2", async () => {
  const bare = await bindControlListener("127.0.0.1", 0);
  const deadPort = await allocateDeadPort();
  try {
    const connectFn = makeCandidateConnect({ "cand-bare": bare.port, "cand-refused": deadPort });
    const result = await dialBrokerEndpoint({
      candidates: ["cand-bare", "cand-refused"],
      connect: connectFn,
      connectTimeoutMs: 500,
      replyTimeoutMs: 500,
    });
    assert.equal(result.ok, false, `expected not-ok, got ${JSON.stringify(result)}`);
    if (result.ok) return;
    assert.equal(result.rank, 2);
  } finally {
    bare.server.close();
  }
});

test("behavior 6: candidate 1 answers an authorization error (stale broker), candidate 2 refused -- not-ok with rank 3", async () => {
  const stale = await startCannedLineServer(JSON.stringify({ kind: "error", code: "unauthorized", message: "missing or invalid control token" }));
  const deadPort = await allocateDeadPort();
  try {
    const connectFn = makeCandidateConnect({ "cand-stale": stale.port, "cand-refused": deadPort });
    const result = await dialBrokerEndpoint({
      candidates: ["cand-stale", "cand-refused"],
      connect: connectFn,
      connectTimeoutMs: 500,
      replyTimeoutMs: 500,
    });
    assert.equal(result.ok, false, `expected not-ok, got ${JSON.stringify(result)}`);
    if (result.ok) return;
    assert.equal(result.rank, 3);
  } finally {
    stale.server.close();
  }
});

test("behavior 7: candidate 1 answers a valid handshake with an incompatible major, candidate 2 refused -- not-ok with rank 4 (version skew)", async () => {
  const skewed = await startCannedLineServer(JSON.stringify({ kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: "6.0.0", tag: "control" }));
  const deadPort = await allocateDeadPort();
  try {
    const connectFn = makeCandidateConnect({ "cand-skew": skewed.port, "cand-refused": deadPort });
    const result = await dialBrokerEndpoint({
      candidates: ["cand-skew", "cand-refused"],
      connect: connectFn,
      connectTimeoutMs: 500,
      replyTimeoutMs: 500,
      clientVersion: "5.0.0",
    });
    assert.equal(result.ok, false, `expected not-ok, got ${JSON.stringify(result)}`);
    if (result.ok) return;
    assert.equal(result.rank, 4);
  } finally {
    skewed.server.close();
  }
});

test("behavior 8: candidate 1 incompatible major, candidate 2 compatible -- ok is true and the winning host is candidate 2 (a skew never short-circuits)", async () => {
  const skewed = await startCannedLineServer(JSON.stringify({ kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: "6.0.0", tag: "control" }));
  const compatible = await startCannedLineServer(JSON.stringify({ kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: "5.2.0", tag: "control" }));
  try {
    const connectFn = makeCandidateConnect({ "cand-skew": skewed.port, "cand-compat": compatible.port });
    const result = await dialBrokerEndpoint({
      candidates: ["cand-skew", "cand-compat"],
      connect: connectFn,
      connectTimeoutMs: 500,
      replyTimeoutMs: 500,
      clientVersion: "5.0.0",
    });
    assert.equal(result.ok, true, `expected ok, got ${JSON.stringify(result)}`);
    if (result.ok) assert.equal(result.host, "cand-compat");
  } finally {
    skewed.server.close();
    compatible.server.close();
  }
});

test("behavior 9: both candidates produce rank 1 (a tie) -- the reported observation order is the fixed candidate order (loopback first), regardless of which one settled first", async () => {
  const loopbackDeadPort = await allocateDeadPort();
  const bridgeDeadPort = await allocateDeadPort();
  // The loopback candidate's own connect attempt is delayed, so the bridge
  // candidate settles FIRST in real time despite being listed second --
  // proving the final observation order is candidate order, not settle order.
  const connectFn = makeCandidateConnectWithDelay(DIAL_CANDIDATES[0], 150, {
    [DIAL_CANDIDATES[0]]: loopbackDeadPort,
    [DIAL_CANDIDATES[1]]: bridgeDeadPort,
  });
  const result = await dialBrokerEndpoint({
    candidates: DIAL_CANDIDATES,
    connect: connectFn,
    connectTimeoutMs: 1000,
    replyTimeoutMs: 500,
  });
  assert.equal(result.ok, false, `expected not-ok, got ${JSON.stringify(result)}`);
  if (result.ok) return;
  assert.equal(result.rank, 1);
  assert.equal(result.observations.length, 2);
  assert.equal(result.observations[0].host, DIAL_CANDIDATES[0], "the loopback candidate must be reported first regardless of settle order");
  assert.equal(result.observations[1].host, DIAL_CANDIDATES[1]);
});

// ============================================================================
// Plan 62-01, task 3: four refusals a person can act on, and the start
// command they all quote.
// ============================================================================

function makeFailure(overrides: Partial<DialFailure> & { rank: DialFailure["rank"] }): DialFailure {
  return {
    ok: false,
    port: 19510,
    clientVersion: "5.0.0",
    observations: [
      { host: "127.0.0.1", rank: overrides.rank, resolved: false },
      { host: "host.docker.internal", rank: 1, resolved: false },
    ],
    ...overrides,
  };
}

test("BROKER_START_COMMAND is the D-01 npx invocation, one literal with no interpolation", () => {
  assert.equal(BROKER_START_COMMAND, "npx -y @henols/vice-mcp broker");
});

test("the start-command literal appears in broker-endpoint.ts between 1 and 3 times -- one definition, never a hand-copied second string", () => {
  const source = readFileSync(BROKER_ENDPOINT_TS, "utf8");
  const count = (source.match(/npx -y @henols\/vice-mcp broker/g) ?? []).length;
  assert.ok(count >= 1 && count <= 3, `expected the literal to appear 1-3 times, found ${count}`);
});

test("rank 1: names the start command verbatim and states nothing answered on either candidate", () => {
  const failure = makeFailure({ rank: 1, observations: [{ host: "127.0.0.1", rank: 1, resolved: false }, { host: "host.docker.internal", rank: 1, resolved: false }] });
  const message = describeDialFailure(failure);
  assert.ok(message.includes(BROKER_START_COMMAND), "rank 1 must quote the start command verbatim");
  assert.match(message, /no broker answered/i);
  assert.ok(message.includes("127.0.0.1"));
  assert.ok(message.includes("host.docker.internal"));
  assert.ok(message.includes("19510"));
});

test("rank 2: states something else holds the port, naming the port and the candidate host it was observed on", () => {
  const failure = makeFailure({ rank: 2, observations: [{ host: "127.0.0.1", rank: 2, resolved: true }, { host: "host.docker.internal", rank: 1, resolved: false }] });
  const message = describeDialFailure(failure);
  assert.ok(message.includes("127.0.0.1"));
  assert.ok(message.includes("19510"));
  assert.match(message, /already listening|something else/i);
});

test("rank 3: states the listener is an older broker that must be restarted from the new package, naming the start command", () => {
  const failure = makeFailure({ rank: 3, observations: [{ host: "127.0.0.1", rank: 3, resolved: true }, { host: "host.docker.internal", rank: 1, resolved: false }] });
  const message = describeDialFailure(failure);
  assert.ok(message.includes(BROKER_START_COMMAND), "rank 3 must quote the start command verbatim");
  assert.match(message, /older than v2\.0\.0|older broker|stale/i);
});

test("rank 4: names both package names, both observed versions, and which side is behind", () => {
  const failure = makeFailure({
    rank: 4,
    clientVersion: "5.0.0",
    observations: [
      { host: "127.0.0.1", rank: 4, resolved: true, version: "6.0.0" },
      { host: "host.docker.internal", rank: 1, resolved: false },
    ],
  });
  const message = describeDialFailure(failure);
  assert.ok(message.includes("@henols/vice-mcp"), "must name the server package");
  assert.ok(message.includes("@henols/c64-re-tools"), "must name the skills/installer package");
  assert.ok(message.includes("5.0.0"), "must name the client's own observed version");
  assert.ok(message.includes("6.0.0"), "must name the broker's observed version");
});

test("rank 4: a missing/empty/numeric/non-numeric-leading version classifies as rank 2 (not skew) upstream, so describeDialFailure never has to render an unparseable version as a skew", () => {
  for (const badVersion of [undefined, "", 42, "vNext"]) {
    const raw = { kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: badVersion, tag: "x" };
    const classification = classifyHelloReply({ connected: true, raw }, "5.0.0");
    assert.equal(classification.completed, false);
    if (!classification.completed) assert.equal(classification.rank, 2, `version ${JSON.stringify(badVersion)} must classify as rank 2, not rank 4`);
  }
});

test("rootless disclosure: absent when every candidate's resolved flag is false", () => {
  const failure = makeFailure({ rank: 1, observations: [{ host: "127.0.0.1", rank: 1, resolved: false }, { host: "host.docker.internal", rank: 1, resolved: false }] });
  const message = describeDialFailure(failure);
  assert.ok(!/rootless/i.test(message));
});

test("rootless disclosure: present when any candidate's resolved flag is true with a failed connection, and carries a provenance disclaimer without naming the alternative container runtime", () => {
  const failure = makeFailure({ rank: 1, observations: [{ host: "127.0.0.1", rank: 1, resolved: true }, { host: "host.docker.internal", rank: 1, resolved: false }] });
  const message = describeDialFailure(failure);
  assert.match(message, /rootless/i);
  assert.match(message, /unconfirmed|community-sourced/i, "must disclose the claim's provenance");
  assert.ok(!/podman/i.test(message), "must not mention the alternative container runtime whose default is deferred (DEFER-01)");
});

test("describeDialFailure is pure: called twice on the same observations, it returns byte-identical text", () => {
  const failure = makeFailure({ rank: 4, observations: [{ host: "127.0.0.1", rank: 4, resolved: true, version: "6.0.0" }, { host: "host.docker.internal", rank: 1, resolved: false }] });
  const first = describeDialFailure(failure);
  const second = describeDialFailure(failure);
  assert.equal(first, second);
});

test("all four ranks produce distinct message text", () => {
  const base = { host: "127.0.0.1", resolved: true };
  const messages = ([1, 2, 3, 4] as const).map((rank) =>
    describeDialFailure(
      makeFailure({
        rank,
        observations: [{ ...base, rank, version: rank === 4 ? "6.0.0" : undefined }, { host: "host.docker.internal", rank: 1, resolved: false }],
      }),
    ),
  );
  const uniqueMessages = new Set(messages);
  assert.equal(uniqueMessages.size, 4, "each of the four ranks must produce its own distinct message");
});
