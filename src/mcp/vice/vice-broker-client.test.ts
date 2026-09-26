// node:test coverage of vice-broker-client.ts in ISOLATION -- no broker
// script and no proxy involved. Every session is dialed over loopback at an
// in-process listener's kernel-chosen port.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type Server, type Socket } from "node:net";

import {
  REQUEST_ID_PATTERN,
  newRequestId,
  isValidRequestId,
  dialControlSession,
  MonitorOwnershipError,
  resolveSessionLabel,
  type BrokerControlSession,
} from "./vice-broker-client.ts";
import { BROKER_START_COMMAND, HELLO_PROTOCOL_MAGIC } from "./broker-endpoint.mts";
import { runtimeVersion } from "./version.mts";
import {
  startControlListener,
  type AcquireOutcome,
  type StatusInstanceEntry,
  type HostStateFields,
  type MonitorClaimOutcome,
  type MonitorReleaseOutcome,
  type OperationNoteOutcome,
  type StageFileOutcome as ServerStageFileOutcome,
} from "./broker-control.mts";
// Phase 33, plan 33-06 (D-15): the profile shape from its one definition.
import type { LaunchProfile } from "./broker-launch.mts";
// Plan 41-03 (D-14): the channel contract's one host-bound declaration.
import type { MonitorChannel } from "./broker-state.mts";
// Namespace import, read-only, for the export-list closure test below --
// the whole point is comparing the module's OWN live key set against an
// expected list, so this must be the real module object, not a destructured
// subset of it.
import * as viceBrokerClient from "./vice-broker-client.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Dials a session at a listener THIS file started on loopback. The only
 * candidate is 127.0.0.1, so no test here ever dials the bridge alias. */
const dialLoopback = (port: number) => dialControlSession({ port, candidates: ["127.0.0.1"] });

const sleepMs = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// -------------------------------------------------------------- request ids

test("newRequestId()/isValidRequestId(): accepts its own output and rejects a hostile corpus", () => {
  const id = newRequestId();
  assert.ok(REQUEST_ID_PATTERN.test(id), `newRequestId() output must match REQUEST_ID_PATTERN: ${id}`);
  assert.ok(isValidRequestId(id), `newRequestId() output must be accepted: ${id}`);

  const hostile = {
    "empty string": "",
    "path traversal with a separator": `req-1-2-${"a".repeat(8)}/../../etc/passwd`,
    "absolute path": "/etc/passwd",
    "trailing suffix beyond eight hex characters": `req-1-2-${"a".repeat(8)}xx`,
    "uppercase hex": `req-1-2-${"A".repeat(8)}`,
  };
  for (const [label, bad] of Object.entries(hostile)) {
    assert.equal(isValidRequestId(bad), false, `must reject (${label}): ${JSON.stringify(bad)}`);
  }
});

/** The version a raw stub reports in its hello reply: the same package.json
 * lookup the dialing client resolves its own version from, so the major
 * versions always agree. */
const STUB_HELLO_VERSION = runtimeVersion({ pkgJsonPath: join(HERE, "package.json") });

/** A bare TCP listener with NO protocol wired up beyond the hello -- just
 * enough to accept a connection, answer the dial's hello, and hand the test
 * its own raw socket to drive. Used for the scenarios broker-control.mts's
 * own real protocol can't produce on demand (a connection that never
 * answers, a malformed line, chunked framing, a server hanging up
 * mid-request). A socket joins `sockets` only once its hello is answered. */
function startRawSocketServer(): Promise<{ server: Server; port: number; sockets: Socket[] }> {
  return new Promise((resolvePromise) => {
    const sockets: Socket[] = [];
    const server = createServer((socket) => {
      let buf = "";
      const onData = (chunk: Buffer): void => {
        buf += chunk.toString("utf8");
        if (buf.indexOf("\n") === -1) return;
        socket.removeListener("data", onData);
        socket.write(`${JSON.stringify({ kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: STUB_HELLO_VERSION, tag: "control" })}\n`);
        sockets.push(socket);
      };
      socket.on("data", onData);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolvePromise({ server, port, sockets });
    });
  });
}

interface FullBrokerDeps {
  /** Phase 33, plan 33-06: widened with the same OPTIONAL second parameter
   * StartControlListenerOptions.onAcquire took, so a test can observe the
   * profile that ARRIVED on the host side as well as the bytes that left.
   * Widened AGAIN, Phase 63, plan 63-05 (SESS-06), with the same OPTIONAL
   * THIRD parameter carrying the already-sanitised session label. */
  onAcquire?: (id: string, profile?: LaunchProfile, label?: string | null) => Promise<AcquireOutcome>;
  onRelease?: (id: string) => void;
  onStatus?: () => StatusInstanceEntry[];
  onHostState?: () => HostStateFields;
  onMonitorClaim?: (requestId: string, targetId: string) => MonitorClaimOutcome;
  onMonitorRelease?: (requestId: string, targetId: string) => MonitorReleaseOutcome;
  /** Phase 63, plan 63-03 (SESS-05): observes the target id/channel/name a
   * noteOperation() call actually sent. */
  onOperation?: (targetId: string, channel: MonitorChannel, name: string | null) => OperationNoteOutcome;
  /** Phase 64, plan 64-02 (XFER-04): OPTIONAL on StartControlListenerOptions
   * itself (vice-broker.mts does not wire it until plan 64-03) -- omitted
   * here means the real "not wired" refusal broker-control.test.ts's own
   * dispatch-arm test already proves, never a fabricated default. */
  onStageFile?: (targetId: string, slot: string) => ServerStageFileOutcome;
}

/** A REAL, fully-protocol'd control listener (broker-control.mts's own
 * startControlListener(), the exact module this client speaks to) bound on
 * a kernel-chosen port with injected stub callbacks -- the same shape
 * broker-control.test.ts's own startTestListener() uses for the SERVER
 * side's own tests. `rawLines` taps the SAME "connection" event (Node
 * EventEmitters support multiple listeners) purely to observe the bytes
 * actually sent, without altering the real protocol's own behaviour. */
async function startFullBrokerListener(deps: FullBrokerDeps = {}): Promise<{
  server: Server;
  port: number;
  rawLines: Record<string, unknown>[];
}> {
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    onAcquire: deps.onAcquire ?? (async () => ({ ok: false, reason: "internal" }) as AcquireOutcome),
    onRelease: deps.onRelease ?? (() => {}),
    onStatus: deps.onStatus ?? (() => []),
    onHostState:
      deps.onHostState ??
      (() => ({ pid: process.pid, startedAt: "2026-01-01T00:00:00Z", nodeVersion: process.version, viceBin: "x64sc", warmFloor: 3, maxInstances: 16, basePort: 6600, backend: "stock" as const })),
    onMonitorClaim: deps.onMonitorClaim ?? (() => ({ ok: false, code: "internal" })),
    onMonitorRelease: deps.onMonitorRelease ?? (() => ({ ok: false, code: "internal" })),
    // Phase 63, plan 63-01: a required field on StartControlListenerOptions
    // as of this plan -- this client-focused fixture never exercises
    // `attach` itself (broker-relay.test.ts is the home for that coverage),
    // so this stub exists only to satisfy the type.
    onRelayAttach: () => ({ ok: false, code: "internal" as const }),
    onOperation: deps.onOperation ?? (() => ({ ok: true as const })),
    // Phase 34, plan 34-01: a required field on StartControlListenerOptions
    // as of this plan -- this client-focused fixture never exercises
    // host_tool itself, so this stub exists only to satisfy the type.
    // Phase 64, plan 64-02 (XFER-04): OPTIONAL on StartControlListenerOptions
    // -- conditionally wired, so a test that supplies no stub sees the real
    // "not wired" refusal the dispatch arm itself produces.
    onStageFile: deps.onStageFile,
  });

  const rawLines: Record<string, unknown>[] = [];
  listener.server.on("connection", (socket: Socket) => {
    let buf = "";
    socket.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.trim() === "") continue;
        try {
          rawLines.push(JSON.parse(line));
        } catch {
          // not this observer's job to validate framing -- the client's own
          // tests cover malformed lines from the OTHER direction
        }
      }
    });
  });

  return { server: listener.server, port: listener.port, rawLines };
}

// ------------------------------------------------- dialControlSession(): happy path

test("dialControlSession(): opens a session and drives all four request kinds, and no request line carries a token", async () => {
  const { server, port, rawLines } = await startFullBrokerListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp" } }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true, `dialControlSession must succeed against a real listener: ${JSON.stringify(opened)}`);
    if (!opened.ok) return;
    const session = opened.session;

    const acquired = await session.acquire();
    assert.equal(acquired.ok, true, `acquire must succeed: ${JSON.stringify(acquired)}`);
    if (!acquired.ok) return;
    assert.equal(acquired.grant.port, 6600);
    assert.equal(acquired.grant.url, "http://127.0.0.1:6600/mcp");

    const statusResult = await session.status();
    assert.equal(statusResult.ok, true, `status must succeed: ${JSON.stringify(statusResult)}`);

    const hostStateResult = await session.hostState();
    assert.equal(hostStateResult.ok, true, `hostState must succeed: ${JSON.stringify(hostStateResult)}`);
    if (!hostStateResult.ok) return;
    assert.equal(hostStateResult.hostState.vice_bin, "x64sc");
    assert.equal(hostStateResult.hostState.max_instances, 16);
    // WR-04: the broker's own backend verdict crosses the wire, narrowed at the
    // boundary to the one known value or null.
    assert.equal(hostStateResult.hostState.backend, "stock");

    const released = await session.release();
    assert.equal(released.ok, true);

    assert.ok(rawLines.length >= 3, `expected at least 3 request lines observed, saw ${rawLines.length}`);
    for (const line of rawLines) {
      assert.equal(Object.prototype.hasOwnProperty.call(line, "token"), false, `no request line may carry a token: ${JSON.stringify(line)}`);
    }
  } finally {
    server.close();
  }
});

// ------------------------------------------------- dialControlSession(): key sets

// The grant carries coordinates only -- never a broker-side path.
const CONTAINERIZE_GRANT_FIELDS = ["id", "port", "url"];

test("acquire result: the grant object has exactly the key set containerizeGrant() reads", async () => {
  const { server, port } = await startFullBrokerListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6601, url: "http://127.0.0.1:6601/mcp" } }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const acquired = await opened.session.acquire();
    assert.equal(acquired.ok, true);
    if (!acquired.ok) return;
    assert.deepEqual(Object.keys(acquired.grant).sort(), [...CONTAINERIZE_GRANT_FIELDS].sort());
    await opened.session.release();
  } finally {
    server.close();
  }
});

// This is the CLIENT's own responsibility (task 1's <behavior> list: "Acquire
// resolves with a typed failure carrying the broker's error code when the
// broker answers an error") -- distinct from the SERVER's own error-code
// semantics (which broker's own no_free_port/at_capacity/denied logic
// produces those codes correctly), already covered by
// broker-control.test.ts and deliberately not re-tested here. This is also
// the RE-OBSERVED replacement for the retiring
// "pollGrant(): resolves granted:false and surfaces the denial's reason
// verbatim" test (see this plan's SUMMARY disposition table, row 9).
test("acquire: resolves a typed failure carrying the broker's own error code and message when the broker answers an error", async () => {
  const { server, port } = await startFullBrokerListener({
    onAcquire: async () => ({ ok: false, reason: "at_capacity" }) as AcquireOutcome,
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const acquired = await opened.session.acquire();
    assert.equal(acquired.ok, false);
    if (acquired.ok) return;
    assert.equal(acquired.kind, "at_capacity");
    assert.match(acquired.message, /at_capacity/);
    await opened.session.release();
  } finally {
    server.close();
  }
});

// ------------------------------------------------- dialControlSession(): connection failures

test("dialControlSession(): a port nothing listens on returns a typed connect_refused failure naming the start command", async () => {
  // Bind a listener, read back its kernel-chosen port, then close it
  // immediately -- the port is now refusing connections on loopback,
  // deterministically (no reliance on a hardcoded port being free).
  const probe = await startRawSocketServer();
  const deadPort = probe.port;
  await new Promise<void>((r) => probe.server.close(() => r()));

  const result = await dialLoopback(deadPort);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.kind, "connect_refused");
  assert.ok(result.message.includes(BROKER_START_COMMAND), `the message must name the start command: ${result.message}`);
});
// ------------------------------------------------- session: deadlines, framing, broker-gone, malformed lines

test("acquire: resolves a typed deadline failure within its own bound and does not hang, using a short bound injected for the test", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    // The raw server accepts the connection but never writes a response --
    // acquire() must resolve its own typed deadline rather than hang.
    const startedAt = Date.now();
    const acquired = await opened.session.acquire({ timeoutMs: 150 });
    const elapsed = Date.now() - startedAt;
    assert.equal(acquired.ok, false);
    if (acquired.ok) return;
    assert.equal(acquired.kind, "deadline");
    assert.ok(elapsed < 2000, `must resolve promptly after its own deadline, took ${elapsed}ms`);
    await opened.session.release();
  } finally {
    for (const s of sockets) s.destroy();
    server.close();
  }
});

test("session: the broker closing the connection mid-request settles it with a distinct broker_gone outcome, never a request-level error", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const acquirePromise = opened.session.acquire({ timeoutMs: 5000 });
    // Wait for the raw server to actually see the connection, then hang up
    // on it mid-request -- never answering the acquire line at all.
    const sawConnection = await (async () => {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        if (sockets.length > 0) return true;
        await sleepMs(10);
      }
      return false;
    })();
    assert.ok(sawConnection, "raw server must observe the incoming connection");
    sockets[0].destroy();
    const acquired = await acquirePromise;
    assert.equal(acquired.ok, false);
    if (acquired.ok) return;
    assert.equal(acquired.kind, "broker_gone");
    assert.notEqual(acquired.kind, "internal", "broker_gone must be distinguishable from a request-level error outcome");
    assert.notEqual(acquired.kind, "denied", "broker_gone must be distinguishable from a request-level error outcome");
    await opened.session.release(); // the socket is already destroyed server-side; a client-side release must still be a safe no-op
  } finally {
    for (const s of sockets) s.destroy();
    server.close();
  }
});

test("session: two responses arriving in one chunk are both delivered", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;

    const deadline = Date.now() + 3000;
    while (sockets.length === 0 && Date.now() < deadline) await sleepMs(10);
    assert.ok(sockets.length > 0, "raw server must observe the incoming connection");
    const serverSocket = sockets[0];

    // Two acquire()s in flight without awaiting the first -- exercises the
    // FIFO pending-queue's own ordering. The status line for the SECOND
    // request is written first, both lines land in ONE write() call, and
    // both must still be delivered to their correct caller in order.
    const first = opened.session.acquire({ timeoutMs: 3000 });
    const second = opened.session.status({ timeoutMs: 3000 });
    await sleepMs(50); // let both request lines actually reach the server
    const grantLine = JSON.stringify({ kind: "grant", id: "req-x", port: 6604, url: "http://127.0.0.1:6604/mcp" });
    const statusLine = JSON.stringify({ kind: "status", instances: [] });
    serverSocket.write(`${grantLine}\n${statusLine}\n`); // BOTH responses in ONE chunk

    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.equal(firstResult.ok, true, `first (acquire) must be delivered: ${JSON.stringify(firstResult)}`);
    assert.equal(secondResult.ok, true, `second (status) must be delivered: ${JSON.stringify(secondResult)}`);
    await opened.session.release();
  } finally {
    for (const s of sockets) s.destroy();
    server.close();
  }
});

test("session: one response split across two chunks is delivered exactly once", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;

    const deadline = Date.now() + 3000;
    while (sockets.length === 0 && Date.now() < deadline) await sleepMs(10);
    assert.ok(sockets.length > 0, "raw server must observe the incoming connection");
    const serverSocket = sockets[0];

    const acquirePromise = opened.session.acquire({ timeoutMs: 3000 });
    await sleepMs(50);
    const line = `${JSON.stringify({ kind: "grant", id: "req-y", port: 6605, url: "http://127.0.0.1:6605/mcp" })}\n`;
    const splitAt = Math.floor(line.length / 2);
    serverSocket.write(line.slice(0, splitAt));
    await sleepMs(20);
    serverSocket.write(line.slice(splitAt));

    const result = await acquirePromise;
    assert.equal(result.ok, true, `split response must still be delivered: ${JSON.stringify(result)}`);
    if (!result.ok) return;
    assert.equal(result.grant.port, 6605);
    await opened.session.release();
  } finally {
    for (const s of sockets) s.destroy();
    server.close();
  }
});

test("session: a malformed response line settles the pending request as a protocol failure, and no unhandled rejection occurs", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  let unhandledRejectionFired = false;
  const onUnhandled = () => {
    unhandledRejectionFired = true;
  };
  process.on("unhandledRejection", onUnhandled);
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;

    const deadline = Date.now() + 3000;
    while (sockets.length === 0 && Date.now() < deadline) await sleepMs(10);
    assert.ok(sockets.length > 0, "raw server must observe the incoming connection");

    const acquirePromise = opened.session.acquire({ timeoutMs: 3000 });
    await sleepMs(50);
    sockets[0].write("this is not json\n");

    const result = await acquirePromise;
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.kind, "protocol");
    await sleepMs(20); // give a stray unhandledRejection a chance to surface, if there were one
    assert.equal(unhandledRejectionFired, false, "a malformed line must never produce an unhandled rejection");
    await opened.session.release();
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
    for (const s of sockets) s.destroy();
    server.close();
  }
});

test("session: a second release() resolves without throwing", async () => {
  const { server, port } = await startFullBrokerListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6606, url: "http://127.0.0.1:6606/mcp" } }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    await opened.session.acquire();
    const first = await opened.session.release();
    assert.equal(first.ok, true);
    await assert.doesNotReject(async () => {
      const second = await opened.session.release();
      assert.equal(second.ok, true);
    });
  } finally {
    server.close();
  }
});

// ============================================================================
// Plan 05, Task 2: claimMonitor()/releaseMonitor() -- the container-side
// claim BEFORE any binmon connect() (PROTO-08, D-13), against the SAME
// real-listener harness (startFullBrokerListener()) every other session
// method above already uses.
//
// CR-03 (code review 2026-08-13): every test below now ACQUIRES over the
// session before claiming or releasing, and names the grant id the broker
// actually issued -- because the control plane now refuses a target_id that is
// not the grant the asking connection itself holds. They previously claimed a
// hard-coded "req-a"/"req-b" over a connection that had never acquired
// anything, which is the spoofable shape the review found rather than the
// production sequence (stockConnect() always claims the grant its own session
// acquired). Two of them silently stopped testing what they claimed once the
// gate existed -- the monitor_owned and `denied` refusals they assert on must
// come from the BROKER's own holder comparison, not from the control-plane
// ownership gate, which is covered separately in broker-control.test.ts.
// ============================================================================

/** The grant-issuing onAcquire stub the monitor-op tests below acquire
 * through. The listener echoes the CLIENT's own request id back as the
 * grant id, so `grant.id` is exactly the grant that connection holds. */
const GRANTING_ACQUIRE = async (): Promise<AcquireOutcome> => ({
  ok: true,
  grant: { port: 6600, url: "http://127.0.0.1:6600/mcp" },
});

/** Acquires over `session` and returns the grant id, so a following
 * claimMonitor()/releaseMonitor() names a target this connection owns. */
async function heldGrantId(session: BrokerControlSession): Promise<string> {
  const acquired = await session.acquire();
  assert.equal(acquired.ok, true, "precondition: the session must hold a grant before claiming a monitor socket");
  if (!acquired.ok) throw new Error("unreachable");
  return acquired.grant.id;
}

test("monitor_claim: claimMonitor() against a stub answering ok resolves a success outcome, and never dials a second socket", async () => {
  const { server, port, rawLines } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorClaim: () => ({ ok: true, handle: "test-handle" }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.claimMonitor({ targetId });
    assert.deepEqual(result, { ok: true, handle: "test-handle" });
    assert.ok(
      rawLines.some((l) => l.op === "monitor_claim" && l.target_id === targetId),
      `expected a monitor_claim line naming target_id ${targetId}: ${JSON.stringify(rawLines)}`,
    );
    await opened.session.release();
  } finally {
    server.close();
  }
});

// ---------------------------------------------------------------------------
// Plan 41-03 (D-14): the `channel` field on claimMonitor()/releaseMonitor().
// ---------------------------------------------------------------------------

test("monitor_claim (D-14): claimMonitor() with no channel puts 'binary' on the wire", async () => {
  const { server, port, rawLines } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorClaim: () => ({ ok: true, handle: "test-handle" }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.claimMonitor({ targetId });
    assert.deepEqual(result, { ok: true, handle: "test-handle" });
    const claimLine = rawLines.find((l) => l.op === "monitor_claim" && l.target_id === targetId);
    assert.equal(claimLine?.channel, "binary", `expected channel 'binary' on the wire: ${JSON.stringify(rawLines)}`);
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("monitor_claim (D-14): claimMonitor({ channel: 'text' }) puts 'text' on the wire", async () => {
  const { server, port, rawLines } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorClaim: () => ({ ok: true, handle: "test-handle" }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.claimMonitor({ targetId, channel: "text" });
    assert.deepEqual(result, { ok: true, handle: "test-handle" });
    const claimLine = rawLines.find((l) => l.op === "monitor_claim" && l.target_id === targetId);
    assert.equal(claimLine?.channel, "text", `expected channel 'text' on the wire: ${JSON.stringify(rawLines)}`);
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("monitor_release (D-14): releaseMonitor() with no channel puts 'binary' on the wire; releaseMonitor({channel:'text'}) puts 'text'", async () => {
  const { server, port, rawLines } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorRelease: () => ({ ok: true }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    await opened.session.releaseMonitor({ targetId });
    await opened.session.releaseMonitor({ targetId, channel: "text" });
    const releaseLines = rawLines.filter((l) => l.op === "monitor_release" && l.target_id === targetId);
    assert.equal(releaseLines[0]?.channel, "binary");
    assert.equal(releaseLines[1]?.channel, "text");
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("monitor_claim: claimMonitor() against a stub answering monitor_owned resolves a discriminated ownership-conflict outcome carrying the holder's grantId/claimedAt -- never throws, never retries", async () => {
  const { server, port } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorClaim: () => ({ ok: false, code: "monitor_owned", holder: { grantId: "req-holder", claimedAt: 12345, pid: 4242, channel: "binary" } }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.claimMonitor({ targetId });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "monitor_owned", "the refusal must come from the broker's holder comparison, not the control-plane ownership gate");
    if (result.reason !== "monitor_owned") return;
    assert.deepEqual(result.holder, { grantId: "req-holder", claimedAt: 12345, pid: 4242, channel: "binary" });
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("monitor_claim ownership conflict: the failure outcome's own message, and MonitorOwnershipError's message, name the holding grant and never use the words wedged, hung or unresponsive", async () => {
  const { server, port } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorClaim: () => ({ ok: false, code: "monitor_owned", holder: { grantId: "req-holder", claimedAt: 12345, pid: 4242, channel: "binary" } }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.claimMonitor({ targetId });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "monitor_owned");
    if (result.reason !== "monitor_owned") return;

    const err = new MonitorOwnershipError(`instance already has a monitor client held by grant ${result.holder.grantId} -- this is an ownership conflict, on port 6600`, {
      holderGrantId: result.holder.grantId,
      holderClaimedAt: result.holder.claimedAt,
      port: 6600,
      channel: result.holder.channel,
    });
    assert.ok(err instanceof Error);
    assert.equal(err.holderGrantId, "req-holder");
    assert.equal(err.port, 6600);
    assert.equal(err.channel, "binary", "plan 41-03 (D-14): the channel rides on the constructed error");
    assert.doesNotMatch(err.message, /wedged|hung|unresponsive/i);
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("WR-04: a broker that reports no backend, or an unrecognised one, is parsed as null -- absent evidence, never silent agreement", async () => {
  for (const wireValue of [undefined, "banana", 42, null]) {
    const { server, port } = await startFullBrokerListener({
      onHostState: () =>
        ({
          pid: 1,
          startedAt: "2026-08-13T00:00:00Z",
          nodeVersion: "v24.0.0",
          viceBin: "x64sc",
          warmFloor: 1,
          maxInstances: 1,
          basePort: 6600,
          backend: wireValue,
        }) as unknown as HostStateFields,
    });
    try {
      const opened = await dialLoopback(port);
      assert.equal(opened.ok, true);
      if (!opened.ok) return;
      const result = await opened.session.hostState();
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.hostState.backend, null, `wire value ${JSON.stringify(wireValue)} must read as null, not as a verdict`);
      await opened.session.release();
    } finally {
      server.close();
    }
  }
});

test("WR-08: a monitor_owned refusal whose holder payload is malformed keeps the ownership-conflict REASON, with the holder fields defaulted", async () => {
  const { server, port } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    // A holder shape extractHolder() rejects outright (claimedAt is not a
    // number), so the wire carries `kind: "monitor_owned"` with no usable
    // holder -- the exact partially-malformed refusal that used to collapse to
    // reason "internal" and lose the ownership framing entirely.
    onMonitorClaim: () => ({ ok: false, code: "monitor_owned", holder: { grantId: "req-holder", claimedAt: "not-a-number", pid: null } } as unknown as MonitorClaimOutcome),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.claimMonitor({ targetId });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "monitor_owned", "an unnameable holder does not make this a different state");
    if (result.reason !== "monitor_owned") return;
    assert.equal(result.holder.grantId, "unknown", "the holder is admitted as unknown, never fabricated as a plausible grant id");
    assert.equal(result.holder.pid, null);
    assert.equal(result.holder.channel, "binary", "plan 41-03 (D-14): a wire holder that omits channel defaults to the channel THIS request asked for");
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("WR-08: a monitor_owned refusal with NO holder field at all still reports reason monitor_owned, not internal", async () => {
  const { server, port } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorClaim: () => ({ ok: false, code: "monitor_owned" } as unknown as MonitorClaimOutcome),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.claimMonitor({ targetId });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "monitor_owned");
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("monitor_claim: claimMonitor() never dials the binmon port itself, on success or on failure -- only the control-plane socket is ever touched", async () => {
  let acceptedConnections = 0;
  const { server, port } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorClaim: () => ({ ok: false, code: "monitor_owned", holder: { grantId: "req-holder", claimedAt: 1, pid: null, channel: "binary" } }),
  });
  server.on("connection", () => {
    acceptedConnections++;
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    await opened.session.claimMonitor({ targetId });
    // Exactly one connection: the control-plane session dialControlSession()
    // itself opened. claimMonitor() must never open a second one, on
    // success or on failure.
    assert.equal(acceptedConnections, 1);
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("monitor_release: releaseMonitor() sends monitor_release and tolerates a broker that has already cleared the record", async () => {
  const { server, port, rawLines } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorRelease: () => ({ ok: true }), // the broker's own tolerance for an already-cleared target
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.releaseMonitor({ targetId });
    assert.deepEqual(result, { ok: true });
    assert.ok(rawLines.some((l) => l.op === "monitor_release" && l.target_id === targetId));
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("monitor_release: releaseMonitor() against a non-holder refusal from the broker resolves a distinct failure outcome, not a silent success", async () => {
  const { server, port } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorRelease: () => ({ ok: false, code: "denied" }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    // The session genuinely holds this grant, so the `denied` below is the
    // BROKER's own non-holder refusal -- not the control-plane ownership gate.
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.releaseMonitor({ targetId });
    assert.deepEqual(result, { ok: false, reason: "denied" });
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("CR-03: claimMonitor()/releaseMonitor() naming a grant this connection does NOT hold are refused `denied` by the control plane, before the broker callback runs", async () => {
  const claimCalls: string[] = [];
  const releaseCalls: string[] = [];
  const { server, port } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onMonitorClaim: (_requestId, targetId) => {
      claimCalls.push(targetId);
      return { ok: true, handle: "test-handle" };
    },
    onMonitorRelease: (_requestId, targetId) => {
      releaseCalls.push(targetId);
      return { ok: true };
    },
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    await heldGrantId(opened.session); // this connection holds its OWN grant

    const claimed = await opened.session.claimMonitor({ targetId: "someone-elses-grant" });
    assert.deepEqual(claimed, { ok: false, reason: "denied" });

    const released = await opened.session.releaseMonitor({ targetId: "someone-elses-grant" });
    assert.deepEqual(released, { ok: false, reason: "denied" });

    assert.deepEqual(claimCalls, [], "a denied claim must never reach the broker's own claim handler");
    assert.deepEqual(releaseCalls, [], "a denied release must never reach the broker's own release handler");
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("monitor_claim: claimMonitor() a control-plane timeout during claim is reported as reason timeout, strictly distinct from monitor_owned ownership conflicts", async () => {
  // A raw socket server that accepts but never answers -- forcing
  // claimMonitor()'s own deadline to elapse, exactly like the existing
  // "acquire: resolves a typed deadline failure" test above does for
  // acquire().
  const { server, port, sockets } = await startRawSocketServer();
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const result = await opened.session.claimMonitor({ targetId: "req-a", timeoutMs: 150 });
    assert.deepEqual(result, { ok: false, reason: "timeout" });
  } finally {
    for (const s of sockets) s.destroy();
    server.close();
  }
});

// ============================================================================
// Phase 64, plan 64-02 (XFER-04): stageFile() -- sends through the SAME
// sendAndAwaitLine() path and the same session every other op uses; no second control connection is ever opened.
// ============================================================================

test("stage_file: stageFile() against a stub answering ok resolves a success outcome carrying the broker-minted handle and emulator_filename, and never opens a second socket", async () => {
  const { server, port } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onStageFile: (targetId, slot) => ({ ok: true, handle: `handle-${targetId}-${slot}`, emulatorFilename: `/staging/${targetId}/${slot}.bin` }),
  });
  let connectionCount = 0;
  server.on("connection", () => {
    connectionCount += 1;
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    // A prior claimMonitor() call over the SAME session, to prove
    // stageFile() opens no ADDITIONAL connection beyond whatever acquire()
    // itself already opened -- exactly the assertion the pre-existing
    // claimMonitor() test above makes for that op.
    await opened.session.claimMonitor({ targetId });
    const connectionsBeforeStage = connectionCount;
    const result = await opened.session.stageFile({ targetId, slot: "autostart" });
    assert.deepEqual(result, { ok: true, handle: `handle-${targetId}-autostart`, emulatorFilename: `/staging/${targetId}/autostart.bin` });
    assert.equal(connectionCount, connectionsBeforeStage, "stageFile() must open no second TCP connection");
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("stage_file: a success reply missing handle or emulator_filename is reported as a protocol failure, never a fabricated value", async () => {
  for (const badReply of [
    { ok: true, handle: "", emulatorFilename: "/staging/x/autostart.bin" },
    { ok: true, handle: "real-handle", emulatorFilename: "" },
  ] as const) {
    const { server, port } = await startFullBrokerListener({
      onAcquire: GRANTING_ACQUIRE,
      onStageFile: () => badReply as unknown as ServerStageFileOutcome,
    });
    try {
      const opened = await dialLoopback(port);
      assert.equal(opened.ok, true);
      if (!opened.ok) return;
      const targetId = await heldGrantId(opened.session);
      const result = await opened.session.stageFile({ targetId, slot: "autostart" });
      assert.deepEqual(result, { ok: false, reason: "internal" }, `expected a protocol failure for reply ${JSON.stringify(badReply)}, got ${JSON.stringify(result)}`);
      await opened.session.release();
    } finally {
      server.close();
    }
  }
});

test("stage_file: a deadline is reported as reason timeout, distinctly from a refusal", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const result = await opened.session.stageFile({ targetId: "req-a", slot: "autostart", timeoutMs: 150 });
    assert.deepEqual(result, { ok: false, reason: "timeout" });
  } finally {
    for (const s of sockets) s.destroy();
    server.close();
  }
});

test("stage_file: bad_request and denied are each reported under their own reason", async () => {
  for (const code of ["bad_request", "denied"] as const) {
    const { server, port } = await startFullBrokerListener({
      onAcquire: GRANTING_ACQUIRE,
      onStageFile: () => ({ ok: false, code }),
    });
    try {
      const opened = await dialLoopback(port);
      assert.equal(opened.ok, true);
      if (!opened.ok) return;
      const targetId = await heldGrantId(opened.session);
      const result = await opened.session.stageFile({ targetId, slot: "autostart" });
      assert.deepEqual(result, { ok: false, reason: code }, `expected reason ${code}, got ${JSON.stringify(result)}`);
      await opened.session.release();
    } finally {
      server.close();
    }
  }
});

test("stage_file: against a REAL broker (no onStageFile stub configured), the not-wired refusal is reported as reason internal", async () => {
  const { server, port } = await startFullBrokerListener({ onAcquire: GRANTING_ACQUIRE });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.stageFile({ targetId, slot: "autostart" });
    assert.deepEqual(result, { ok: false, reason: "internal" });
    await opened.session.release();
  } finally {
    server.close();
  }
});

// ============================================================================
// Plan 63-03 (SESS-05): noteOperation() -- the client half of the in-flight
// operation declaration. Built on the SAME sendAndAwaitLine() every other
// method above uses, over the SAME session/socket a grant was acquired
// through -- these tests assert the outcome mapping (the caller-visible
// contract), never that a caller must await it; that "never await" contract
// is stock-session.ts's/text-tools.ts's own, proven in Task 3's own
// broker-control.test.ts case.
// ============================================================================

test("operation: noteOperation() against a stub answering ok resolves { ok: true }, naming target_id/channel/name on the wire", async () => {
  const observed: Array<{ targetId: string; channel: MonitorChannel; name: string | null }> = [];
  const { server, port, rawLines } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onOperation: (targetId, channel, name) => {
      observed.push({ targetId, channel, name });
      return { ok: true };
    },
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.noteOperation({ targetId, name: "vice_run_until" });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(observed, [{ targetId, channel: "binary", name: "vice_run_until" }]);
    const line = rawLines.find((l) => l.op === "operation" && l.target_id === targetId);
    assert.ok(line, `expected an operation line naming target_id ${targetId}: ${JSON.stringify(rawLines)}`);
    assert.equal(line?.channel, "binary", "channel omitted must default to binary on the wire, matching claimMonitor()'s own convention");
    assert.equal(line?.name, "vice_run_until");
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("operation: noteOperation({ channel: 'text' }) puts 'text' on the wire", async () => {
  const { server, port, rawLines } = await startFullBrokerListener({ onAcquire: GRANTING_ACQUIRE, onOperation: () => ({ ok: true }) });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.noteOperation({ targetId, channel: "text", name: "vice_device_console" });
    assert.deepEqual(result, { ok: true });
    const line = rawLines.find((l) => l.op === "operation" && l.target_id === targetId);
    assert.equal(line?.channel, "text");
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("operation: noteOperation({ name: null }) sends a literal null on the wire -- a clear, not an empty string", async () => {
  const { server, port, rawLines } = await startFullBrokerListener({ onAcquire: GRANTING_ACQUIRE, onOperation: () => ({ ok: true }) });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.noteOperation({ targetId, name: null });
    assert.deepEqual(result, { ok: true });
    const line = rawLines.find((l) => l.op === "operation" && l.target_id === targetId);
    assert.equal(line?.name, null, `expected a literal null, not a missing field or empty string: ${JSON.stringify(line)}`);
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("operation: noteOperation() against a bad_request refusal resolves that SAME reason verbatim, never collapsed to internal", async () => {
  const { server, port } = await startFullBrokerListener({
    onAcquire: GRANTING_ACQUIRE,
    onOperation: () => ({ ok: false, code: "bad_request" }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const targetId = await heldGrantId(opened.session);
    const result = await opened.session.noteOperation({ targetId, name: "vice_ping" });
    assert.deepEqual(result, { ok: false, reason: "bad_request" });
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("operation: noteOperation() resolves a typed { ok: false, reason: 'internal' } outcome for a broker that closes mid-request, and never rejects", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const notePromise = opened.session.noteOperation({ targetId: "req-a", name: "vice_ping", timeoutMs: 5000 });
    const sawConnection = await (async () => {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        if (sockets.length > 0) return true;
        await sleepMs(10);
      }
      return false;
    })();
    assert.ok(sawConnection, "raw server must observe the incoming connection");
    sockets[0].destroy();
    // never throws, never rejects -- resolves a typed failure outcome
    const result = await notePromise;
    assert.deepEqual(result, { ok: false, reason: "internal" });
  } finally {
    for (const s of sockets) s.destroy();
    server.close();
  }
});

test("operation: noteOperation() a control-plane timeout is reported as reason timeout", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const result = await opened.session.noteOperation({ targetId: "req-a", name: "vice_ping", timeoutMs: 150 });
    assert.deepEqual(result, { ok: false, reason: "timeout" });
  } finally {
    for (const s of sockets) s.destroy();
    server.close();
  }
});

// ------------------------------------------------- structural: no filesystem write in the new region

test("structural: the new control-client region (between the plan-06 marker pair) contains no filesystem-write construct", () => {
  const source = readFileSync(join(HERE, "vice-broker-client.ts"), "utf8");
  const startMarker = "BROKER-CONTROL-CLIENT REGION START";
  const endMarker = "BROKER-CONTROL-CLIENT REGION END";
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  assert.ok(startIdx !== -1, "the region START marker must be present in vice-broker-client.ts");
  assert.ok(endIdx !== -1 && endIdx > startIdx, "the region END marker must be present, after START");
  const region = source.slice(startIdx, endIdx);
  const writeConstructPattern = /\b(writeFileSync|renameSync|mkdirSync|unlinkSync|writeJsonAtomic)\s*\(/;
  const match = region.match(writeConstructPattern);
  assert.equal(match, null, `filesystem-write construct found in the new control-client region: ${match ? match[0] : ""}`);
});

// ------------------------------------------------- structural: the surviving export surface
//
// Comparing the module's own live `Object.keys()` (a namespace import, not
// a destructured subset) against this expected list means a stray export
// left behind, OR a surviving export silently dropped, both fail this test.

test("the client module's export list is exactly the surviving surface", () => {
  const actualKeys = Object.keys(viceBrokerClient).sort();
  const expectedKeys = [
    "REQUEST_ID_PATTERN",
    "newRequestId",
    "isValidRequestId",
    "CONTROL_ACQUIRE_TIMEOUT_MS",
    "ACQUIRE_TIMEOUT_MS",
    "CONTROL_CONNECT_TIMEOUT_MS",
    "dialControlSession",
    // Plan 05 (BROK-02/PROTO-08): a caller that prefers to raise on a
    // monitor-ownership conflict rather than branch on ClaimMonitorOutcome
    // constructs this directly.
    "MonitorOwnershipError",
    // Phase 63, plan 63-05 (SESS-06): the session-label resolver, exported
    // so a test (or a future non-agent caller wanting the SAME resolution
    // rule) can call it directly rather than re-deriving the env/cwd/pid
    // fallback chain.
    "resolveSessionLabel",
  ].sort();
  assert.deepEqual(
    actualKeys,
    expectedKeys,
    `the module's live export set drifted from the surviving surface: actual=${JSON.stringify(actualKeys)} expected=${JSON.stringify(expectedKeys)}`
  );
});

// ------------------------------------------------- structural: closure gate over the six retiring mechanisms
//
// Plan 01.6.2-07, task 3 (criterion F): a structural gate proving none of
// the retiring file protocol's mechanisms exists ANYWHERE under the module
// directory's non-test source -- not merely that this one module's export
// list is clean. Enumerated from the directory itself (matching
// vice-proxy.test.ts's own "structural: the set of source files..."
// idiom and vice-broker-launch.test.ts's JUSTIFIED_NETWORK_CALLERS idiom),
// so a future file reintroducing one of these identifiers is caught the
// moment it lands, with no test file to remember to update. Comment lines
// are filtered out before matching, so a header sentence NAMING a retired
// identifier (as this very file's own comments do, deliberately, to explain
// what was deleted and why) cannot make the gate self-invalidating.
const RETIRING_MECHANISM_IDENTIFIERS: string[] = [
  // The eight retiring functions (01.6.2-07-PLAN.md's own artifact list,
  // cross-checked against vice-broker-client.ts's pre-this-plan export list):
  "writeRequest",
  "createLease",
  "touchLease",
  "releaseLease",
  "pollGrant",
  "writeRecycleRequest",
  "pollRecycleAck",
  "startHeartbeat",
  // Their timeout/interval constants:
  "GRANT_POLL_TIMEOUT_MS",
  "GRANT_POLL_INTERVAL_MS",
  "RECYCLE_ACK_TIMEOUT_MS",
  "RECYCLE_ACK_POLL_INTERVAL_MS",
  "HEARTBEAT_MS",
  // The five protocol directory helpers, plus the lease path helper:
  "requestsDir",
  "grantsDir",
  "denialsDir",
  "brokerLeasesDir",
  "recycleAcksDir",
  "leasePathFor",
];

/** Strips `//` line comments and `/* ... *\/` block comments before matching
 * -- a header sentence describing the history ("touchLease() is gone")
 * must never make this gate self-invalidating by matching its OWN
 * explanatory prose. Deliberately simple (no string-literal awareness): the
 * retiring identifiers are all camelCase/UPPER_SNAKE code names that never
 * legitimately appear inside a runtime string literal in this module set,
 * so this is not a general-purpose comment stripper, just enough to serve
 * this one gate. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("structural: none of the six retiring D-12 mechanisms exists anywhere in the module's non-test source", () => {
  const files = readdirSync(HERE)
    .filter((f) => /\.[cm]?[jt]s$/.test(f) && !/\.test\.[cm]?[jt]s$/.test(f))
    .sort();
  assert.ok(files.length > 0, "module directory enumerated as empty -- glob or path resolution is broken");

  const offenders: { file: string; identifier: string }[] = [];
  for (const file of files) {
    const stripped = stripComments(readFileSync(join(HERE, file), "utf8"));
    for (const identifier of RETIRING_MECHANISM_IDENTIFIERS) {
      const pattern = new RegExp(`\\b${identifier}\\b`);
      if (pattern.test(stripped)) {
        offenders.push({ file, identifier });
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a retiring D-12 mechanism identifier reappeared in non-test source: ${JSON.stringify(offenders)} -- ` +
      "keeping any one of the six retiring mechanisms means two competing authorities on whether a lease is alive."
  );
});

// =============================================================================
// Phase 33, plan 33-06 (REPRO-05, D-15): the profile reaches the broker from
// the session's acquire write site, asserted on the BYTES that actually left
// the client (`rawLines`) and on the value that arrived at the host's own
// onAcquire.
//
// The second property: a profile-less acquire's wire line carries NO
// `profile` key at all. That is what makes an absent profile byte-identical
// to the pre-33-06 line rather than merely equivalent in meaning.
// =============================================================================

const ALWAYS_GRANT = async (): Promise<AcquireOutcome> => ({
  ok: true,
  grant: { port: 6600, url: "http://127.0.0.1:6600/mcp" },
});

test("acquire profile (33-06): session.acquire({profile}) puts {warp:true, headless:true} on the wire and it arrives at the broker's onAcquire", async () => {
  const received: Array<LaunchProfile | undefined> = [];
  const { server, port, rawLines } = await startFullBrokerListener({
    onAcquire: async (_id: string, profile?: LaunchProfile) => {
      received.push(profile);
      return ALWAYS_GRANT();
    },
    // Stock, because the profile maps to stock-only launch flags: on fork the
    // control plane REFUSES a warp/headless profile rather than accepting a
    // knob the argv cannot carry (33 review WR-03).
    onHostState: () => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      warmFloor: 3,
      maxInstances: 16,
      basePort: 6600,
      backend: "stock" as const,
    }),
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true, `dialControlSession must succeed: ${JSON.stringify(opened)}`);
    if (!opened.ok) return;
    const acquired = await opened.session.acquire({ profile: { warp: true, headless: true } });
    assert.equal(acquired.ok, true, `acquire must succeed: ${JSON.stringify(acquired)}`);
    const acquireLine = rawLines.find((l) => l.op === "acquire");
    assert.ok(acquireLine, `an acquire line must have been written; saw ${JSON.stringify(rawLines)}`);
    assert.deepEqual(acquireLine!.profile, { warp: true, headless: true }, "the raw BYTES leaving the client must carry the profile");
    assert.deepEqual(received[0], { warp: true, headless: true }, "and it must arrive at the broker's own onAcquire");
    await opened.session.release();
  } finally {
    server.close();
  }
});

test("acquire profile (33-06, edge: empty): session.acquire() with no profile writes a line with NO profile key, and a timeout-only options object does not introduce one", async () => {
  const received: Array<LaunchProfile | undefined> = [];
  const { server, port, rawLines } = await startFullBrokerListener({
    onAcquire: async (_id: string, profile?: LaunchProfile) => {
      received.push(profile);
      return ALWAYS_GRANT();
    },
  });
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    // A deadline-only options object is the shape every pre-33-06 caller
    // passes -- it must not start writing a profile key.
    const acquired = await opened.session.acquire({ timeoutMs: 3000 });
    assert.equal(acquired.ok, true, `acquire must succeed: ${JSON.stringify(acquired)}`);
    const acquireLine = rawLines.find((l) => l.op === "acquire");
    assert.ok(acquireLine);
    assert.equal(
      Object.prototype.hasOwnProperty.call(acquireLine!, "profile"),
      false,
      "the key must be OMITTED, not written as null or {} -- this is what keeps a profile-less acquire's wire line byte-identical",
    );
    // Phase 63 (SESS-06): a `label` key ALWAYS joins the wire line
    // (resolveSessionLabel() always produces a non-empty string against the
    // real process).
    assert.deepEqual(Object.keys(acquireLine!).sort(), ["id", "label", "op"], "the profile-less line's key set must be exactly id/label/op");
    assert.equal(typeof acquireLine!.label, "string");
    assert.notEqual(acquireLine!.label, "", "the label must never be sent as an empty string");
    assert.equal(received[0], undefined);
    await opened.session.release();
  } finally {
    server.close();
  }
});

// ------------------------------------------------- resolveSessionLabel() (Phase 63, SESS-06)

test("resolveSessionLabel(): returns the agent-session environment value verbatim when it is a non-empty string", () => {
  const label = resolveSessionLabel({ env: { CLAUDE_CODE_SESSION_ID: "session-abc-123" }, cwd: () => "/home/henrik/dev/some-repo", pid: 999 });
  assert.equal(label, "session-abc-123");
});

test("resolveSessionLabel(): falls back to the working directory's base name joined to the process id when the env var is unset", () => {
  const label = resolveSessionLabel({ env: {}, cwd: () => "/home/henrik/dev/c64-re-tools", pid: 4242 });
  assert.equal(label, "c64-re-tools-4242");
});

test("resolveSessionLabel(): falls back the same way when the env var is present but empty", () => {
  const label = resolveSessionLabel({ env: { CLAUDE_CODE_SESSION_ID: "" }, cwd: () => "/tmp/some-project", pid: 1 });
  assert.equal(label, "some-project-1");
});

test("resolveSessionLabel(): with no overrides at all, returns a non-empty string derived from the REAL process", () => {
  const label = resolveSessionLabel();
  assert.equal(typeof label, "string");
  assert.notEqual(label, "");
});

test("acquire label (63-05): session.acquire() puts a resolved session label on the wire and it arrives at the broker's onAcquire's third argument", async () => {
  const receivedLabels: Array<string | null | undefined> = [];
  const { server, port, rawLines } = await startFullBrokerListener({
    onAcquire: async (_id: string, _profile?: LaunchProfile, label?: string | null) => {
      receivedLabels.push(label);
      return ALWAYS_GRANT();
    },
  });
  const savedEnv = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CLAUDE_CODE_SESSION_ID = "test-session-write-site";
  try {
    const opened = await dialLoopback(port);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const acquired = await opened.session.acquire();
    assert.equal(acquired.ok, true);
    const acquireLine = rawLines.find((l) => l.op === "acquire");
    assert.ok(acquireLine);
    assert.equal(acquireLine!.label, "test-session-write-site", "the raw BYTES leaving the client must carry the resolved label");
    assert.equal(receivedLabels[0], "test-session-write-site", "and it must arrive at the broker's own onAcquire, sanitised but unchanged");
    await opened.session.release();
  } finally {
    if (savedEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = savedEnv;
    server.close();
  }
});

test("structural (33-06, 63-05): the one acquire write site in vice-broker-client.ts spreads both the profile and the label fragment, each declared exactly once", () => {
  const source = readFileSync(join(HERE, "vice-broker-client.ts"), "utf8");
  const acquireWriteSites = [...source.matchAll(/op: "acquire"[^\n]*/g)].map((m) => m[0]);
  assert.equal(acquireWriteSites.length, 1, `expected exactly one acquire write site; found ${acquireWriteSites.length}: ${JSON.stringify(acquireWriteSites)}`);
  assert.match(acquireWriteSites[0], /acquireProfileFragment\(/, `the acquire write site must spread the shared profile fragment: ${acquireWriteSites[0]}`);
  assert.match(acquireWriteSites[0], /acquireLabelFragment\(/, `the acquire write site must spread the shared label fragment: ${acquireWriteSites[0]}`);
  // Each fragment is the one place its omit-when-absent decision is made.
  for (const fn of ["acquireProfileFragment", "acquireLabelFragment"]) {
    assert.equal(
      [...source.matchAll(new RegExp(`function ${fn}\\(`, "g"))].length,
      1,
      `${fn}() must be declared exactly once -- it is the single decision site for whether its key appears at all`,
    );
  }
});
