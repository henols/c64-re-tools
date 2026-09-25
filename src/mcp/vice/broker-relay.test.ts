// broker-relay.test.ts
//
// Phase 63 (SESS-02) task 1: the tracer -- one binary-monitor command
// travelling client -> relay -> stub emulator -> relay -> client,
// byte-identically. Every server here is a REAL loopback net server (a
// stub emulator, standing in for VICE's own binary monitor, and a REAL
// broker-control.mts control listener bound on port zero) -- never a real
// emulator, never a real broker process. `handleMonitorClaim()`/
// `handleRelayAttach()` are imported straight from vice-broker.mts and
// wired into the listener's own callbacks, so this suite exercises the
// SAME production functions the real broker calls, not a re-implemented
// stand-in.
//
// The JAM (0x61) wire shape is covered synthetically here -- a genuinely
// zero-length body, byte-transparent across a header split, and demuxed by
// request id under an adversarial interleave with a legitimate reply, all
// driven through the real spliceRelay()/dialMonitorRelay()/stock-protocol.ts
// parser over real loopback sockets. Whether genuine stock VICE ever emits a
// bare JAM at all under a given JamAction is a separate, live-emulator
// question this file cannot answer -- it is measured and ledgered
// elsewhere, not asserted here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, connect as netConnect, Socket as NodeNetSocket, type Server, type Socket, type AddressInfo } from "node:net";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  readAttachLine,
  MAX_ATTACH_LINE_BYTES,
  relaySessionKey,
  resolveRelayIdleMs,
  resolveRelayKeepAliveMs,
  DEFAULT_RELAY_IDLE_MS,
  DEFAULT_RELAY_KEEPALIVE_MS,
  DEFAULT_RELAY_DIAL_DEADLINE_MS,
  DEFAULT_RELAY_DIAL_RETRY_MS,
  type RelayDeathTrigger,
  type ArmIdleTimerFn,
  type ArmedIdleTimer,
  type RelaySession,
  type RelayConnectFn,
} from "./broker-relay.mts";
import {
  startControlListener,
  newControlToken,
  type StartControlListenerResult,
  type AcquireOutcome,
  type StatusInstanceEntry,
  type HostStateFields,
  type MonitorClaimOutcome,
  type MonitorReleaseOutcome,
  type RelayAttachOutcome,
} from "./broker-control.mts";
import { createBrokerState, MONITOR_CHANNELS, type BrokerState, type InstanceRecord, type MonitorChannel } from "./broker-state.mts";
import type { BrokerIncidentInput } from "./broker-incident.mts";
import {
  dialMonitorRelay,
  HELLO_PROTOCOL_MAGIC,
  RELAY_TAG_BINARY,
  DEFAULT_ATTACH_REPLY_TIMEOUT_MS,
  type DialMonitorRelayResult,
  type DialMonitorRelaySuccess,
} from "./broker-endpoint.mts";
import { ViceMonitorClient, CommandType, ResponseType, ErrorCode, REQUEST_HEADER_LEN, VICE_BROADCAST_REQUEST_ID, encodeRequestHeader } from "./stock-protocol.ts";
import { encodeResponseFrame, syntheticJamFrame } from "./binmon-fixtures.ts";
import { build } from "./build.ts";
import type { Socket as NetSocket } from "node:net";
import { stockConnect, stockReconnect, stockDisconnect, type StockConnectBrokerControl, type DialMonitorSocketFn } from "./stock-connect.ts";
import { MachineRestartedError } from "./vice-errors.ts";
import { convertHandshakeError } from "./stock-handler.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// vice-broker.mts is host-bound: it VALUE-imports sibling ".mjs" artifacts
// (e.g. "./container-guard.mjs") that exist only once built, so this file
// -- like host-tool-transport.test.ts's own `runHostTool` load -- builds
// FIRST and then imports the COMPILED resources/vice-broker.mjs, never the
// unbuilt ".mts" source directly (that import would throw
// ERR_MODULE_NOT_FOUND on the very first sibling it tries to resolve).
// ---------------------------------------------------------------------------
build();
/** Mirrors vice-broker.mts's own HandleRelayDeathDeps -- imported by type
 * shape only (this test file loads the COMPILED artifact, never the .mts
 * source, per this file's own header comment above). */
interface TestHandleRelayDeathDeps {
  writeIncident?: (record: BrokerIncidentInput) => string;
  clearClaim?: (instance: InstanceRecord, channel: MonitorChannel) => void;
  /** Plan 63-04 Task 2 (SESS-04) additions -- see vice-broker.mts's own
   * HandleRelayDeathDeps for the full doc comment. */
  idleMs?: number;
  armIdleTimer?: ArmIdleTimerFn;
  keepAliveMs?: number;
  /** G-64-4 (plan 64-12) additions -- see vice-broker.mts's own
   * HandleRelayDeathDeps for the full doc comment. */
  dialDeadlineMs?: number;
  dialRetryIntervalMs?: number;
  connect?: RelayConnectFn;
}

/** Mirrors vice-broker.mts's own HandleReleaseDeps (Plan 63-04 Task 3). */
interface TestHandleReleaseDeps {
  writeIncident?: (record: BrokerIncidentInput) => string;
  kill?: (opts: { pid: number | null; expectedIdentity: string }) => Promise<string>;
}
const viceBrokerModule = (await import(new URL("./resources/vice-broker.mjs", import.meta.url).href)) as unknown as {
  handleMonitorClaim: (requestId: string, targetId: string, channel: MonitorChannel, state: BrokerState) => MonitorClaimOutcome;
  handleMonitorRelease: (requestId: string, targetId: string, channel: MonitorChannel, state: BrokerState) => MonitorReleaseOutcome;
  handleOperationNote: (targetId: string, channel: MonitorChannel, name: string | null, state: BrokerState, opts?: { now?: () => number }) => { ok: boolean };
  handleRelayAttach: (
    targetId: string,
    channel: MonitorChannel,
    presentedHandle: string,
    clientSocket: NetSocket,
    pending: Buffer,
    state: BrokerState,
    deps?: TestHandleRelayDeathDeps,
  ) => Promise<RelayAttachOutcome>;
  handleRelayDeath: (targetId: string, channel: MonitorChannel, trigger: RelayDeathTrigger, state: BrokerState, deps?: TestHandleRelayDeathDeps) => void;
  handleRelease: (requestId: string, state: BrokerState, deps?: TestHandleReleaseDeps) => void;
  /** Plan 63-07 (SESS-05 gap closure) -- see vice-broker.mts's own header
   * comment for the full contract. */
  tearDownRelaySessionsForGrant: (targetId: string, state: BrokerState) => MonitorChannel[];
  /** Plan 63-11 (SESS-05 gap closure) -- the single delete-before-close
   * primitive tearDownRelaySessionsForGrant() above and
   * handleMonitorRelease() below now both delegate to. See
   * vice-broker.mts's own header comment for the full contract. */
  tearDownRelaySessionForChannel: (targetId: string, channel: MonitorChannel, state: BrokerState) => boolean;
};
const {
  handleMonitorClaim,
  handleMonitorRelease,
  handleRelayAttach,
  handleRelayDeath,
  handleOperationNote,
  handleRelease,
  tearDownRelaySessionsForGrant,
  tearDownRelaySessionForChannel,
} = viceBrokerModule;

// broker-incident.mts is ALSO host-bound (it value-imports broker-home.mjs),
// so it is loaded the SAME way -- built first, then the compiled artifact,
// never the unbuilt .mts source directly (broker-incident.test.ts's own
// established convention, mirrored here).
const brokerIncidentModule = (await import(new URL("./resources/broker-incident.mjs", import.meta.url).href)) as unknown as {
  writeBrokerIncident: (record: BrokerIncidentInput, opts?: { dir?: string }) => string;
};
const { writeBrokerIncident } = brokerIncidentModule;

// ---------------------------------------------------------------------------
// Stub emulator harness -- copies stock-protocol.test.ts's own
// withStubNetServer() shape verbatim (ephemeral port, tracked accepted
// sockets destroyed before server.close(), finally-guaranteed teardown),
// widened with a connectionCount() reader so a refused-attach case can
// assert the stub emulator never accepted anything.
// ---------------------------------------------------------------------------

async function withStubEmulatorServer<T>(handler: (socket: Socket) => void, fn: (port: number, connectionCount: () => number) => Promise<T>): Promise<T> {
  const sockets = new Set<Socket>();
  let connections = 0;
  const server: Server = createServer((socket) => {
    connections += 1;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    handler(socket);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port, () => connections);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** Reserves a free loopback port synchronously -- listens on port 0, reads
 * back the OS-assigned port, then closes immediately, so the caller gets an
 * ephemeral port number with NOTHING bound on it yet. */
async function reserveFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const probe: Server = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as AddressInfo).port;
      probe.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

/** G-64-4 (plan 64-12): a stub emulator that binds `bindDelayMs` AFTER this
 * function returns control to its caller -- deliberately NOT widening
 * withStubEmulatorServer() above, which every pre-existing test in this file
 * relies on binding SYNCHRONOUSLY before the attach is ever sent (the exact
 * condition that hid G-64-4's own race from every earlier test). The caller
 * gets the reserved port back immediately and can send its attach against it
 * right away; the server behind that port only starts accepting connections
 * once the timer fires. */
async function withLateBindingStubEmulatorServer<T>(
  bindDelayMs: number,
  handler: (socket: Socket) => void,
  fn: (port: number, connectionCount: () => number, liveConnectionCount: () => number) => Promise<T>,
): Promise<T> {
  const port = await reserveFreePort();
  const sockets = new Set<Socket>();
  let connections = 0;
  let server: Server | null = null;
  const bindTimer = setTimeout(() => {
    server = createServer((socket) => {
      connections += 1;
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      handler(socket);
    });
    server.listen(port, "127.0.0.1", () => {});
  }, bindDelayMs);
  try {
    return await fn(port, () => connections, () => sockets.size);
  } finally {
    clearTimeout(bindTimer);
    for (const socket of sockets) socket.destroy();
    if (server) await new Promise<void>((resolve) => (server as Server).close(() => resolve()));
  }
}

/** A responder that decodes one binmon request frame at a time (mirroring
 * stock-connect.test.ts's own decodeOneRequest()) and answers every
 * request with a PING-shaped OK reply -- enough for the tracer, which
 * sends exactly one command. Every decoded request frame is pushed to
 * `received`, verbatim, for the byte-identity assertion. */
function pingEchoHandler(received: Buffer[]): (socket: Socket) => void {
  return (socket) => {
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length < REQUEST_HEADER_LEN) break;
        const bodyLength = buf.readUInt32LE(2);
        const total = REQUEST_HEADER_LEN + bodyLength;
        if (buf.length < total) break;
        const frame = buf.subarray(0, total);
        received.push(Buffer.from(frame));
        const requestId = frame.readUInt32LE(6);
        buf = buf.subarray(total);
        socket.write(encodeResponseFrame({ responseType: ResponseType.Ping, errorCode: ErrorCode.Ok, requestId }));
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Broker-side fixture: one BrokerState carrying exactly one granted
// instance whose primary port is the stub emulator's own ephemeral port,
// and a REAL control listener wired to vice-broker.mts's own
// handleMonitorClaim()/handleMonitorRelease()/handleRelayAttach() against
// that state -- never a re-implemented stand-in.
// ---------------------------------------------------------------------------

function makeGrantedInstance(port: number, overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    port,
    url: `http://127.0.0.1:${port}/mcp`,
    state: "granted",
    reason: "acquire",
    epochFile: "/tmp/relay-test-epoch.json",
    supervisorDir: "/tmp/relay-test",
    pid: 4242,
    expectedIdentity: "x64sc",
    launchedAt: 0,
    readyAt: 0,
    viceBin: "x64sc",
    viceArgs: [],
    dryRun: false,
    monitorClients: {},
    ...overrides,
  };
}

/** Builds a BrokerState with one grant/instance pair -- `targetId` doubles
 * as the grant id, matching every other target-naming op's own convention
 * in this codebase (the claim IS the grant). */
function setupBrokerState(emulatorPort: number, targetId: string): BrokerState {
  const state = createBrokerState();
  state.instances.set(emulatorPort, makeGrantedInstance(emulatorPort));
  state.grants.set(targetId, { id: targetId, port: emulatorPort, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });
  return state;
}

/** A minimal stand-in satisfying broker-relay.mts's own RelaySession shape
 * (Plan 63-07, SESS-05 gap closure) -- these cases test ordering and map
 * bookkeeping, not the real socket splice (already proven byte-transparent
 * elsewhere in this file), so a real but never-connected node:net Socket
 * stands in for `emulatorSocket`, and close()/suspendIdle()/resumeIdle()
 * are simple recorders rather than the real production implementation. */
function makeStandInRelaySession(): { session: RelaySession; closeCalls: RelayDeathTrigger[] } {
  const closeCalls: RelayDeathTrigger[] = [];
  const session: RelaySession = {
    emulatorSocket: new NodeNetSocket(),
    close: (trigger: RelayDeathTrigger) => {
      closeCalls.push(trigger);
    },
    suspendIdle: () => {},
    resumeIdle: () => {},
    bytesClientToEmulator: () => 0,
    bytesEmulatorToClient: () => 0,
  };
  return { session, closeCalls };
}

/** Task 3 (SESS-02, concurrency edge): the same builder, generalised to N
 * grant/instance pairs -- one broker, multiple UNRELATED sessions. */
function setupMultiGrantBrokerState(grants: Array<{ port: number; targetId: string }>): BrokerState {
  const state = createBrokerState();
  for (const { port, targetId } of grants) {
    state.instances.set(port, makeGrantedInstance(port));
    state.grants.set(targetId, { id: targetId, port, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });
  }
  return state;
}

interface RelayTestBrokerContext {
  listener: StartControlListenerResult;
  listenerPort: number;
  token: string;
  state: BrokerState;
  /** The scratch directory THIS broker's own handleRelayDeath() writes
   * incidents into -- absent when the caller supplied its own `deps`
   * (Task 1's ordering/injected-writer cases build their own recorders and
   * never touch the filesystem at all). Mkdtemp'd under the OS temp dir
   * (Phase 63-04's own scratch discipline), never the repo tree, and reaped
   * in this helper's own `finally` block. */
  incidentsDir: string | null;
}

/** Stands up a REAL startControlListener() on port zero against an
 * ALREADY-BUILT BrokerState, wired to vice-broker.mts's own
 * handleMonitorClaim()/handleMonitorRelease()/handleRelayAttach() -- the
 * shared listener-standup both withRelayTestBroker() (one grant) and
 * withMultiRelayTestBroker() (N grants, Task 3's concurrency case) build
 * on. Every other callback is a no-op stub -- this suite never exercises
 * acquire/release/status/host_state/host_tool.
 *
 * `relayDeathDeps` (Plan 63-04): threaded straight into every
 * handleRelayAttach() call as its own `deps` argument. When the caller
 * omits it (the common case -- every PRE-EXISTING test in this file that
 * predates this plan and every new test that does not itself care about
 * incident content), this function builds a SAFE default that writes into
 * a freshly mkdtemp'd scratch directory rather than the real, machine-level
 * incidents directory brokerIncidentsDir() would otherwise resolve --
 * without this, every relay-death case in this whole file (old and new
 * alike) would leave a real file on the host running this suite. */
async function startRelayListenerForState(
  state: BrokerState,
  relayDeathDeps?: TestHandleRelayDeathDeps,
): Promise<{ listener: StartControlListenerResult; token: string; incidentsDir: string | null }> {
  let incidentsDir: string | null = null;
  let deps = relayDeathDeps;
  if (!deps) {
    incidentsDir = mkdtempSync(join(tmpdir(), "vice-relay-incidents-"));
    deps = { writeIncident: (record) => writeBrokerIncident(record, { dir: incidentsDir as string }) };
  }
  const token = newControlToken();
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    token,
    onAcquire: async (): Promise<AcquireOutcome> => ({ ok: false, reason: "internal" }),
    onRelease: () => {},
    onStatus: (): StatusInstanceEntry[] => [],
    onHostState: (): HostStateFields => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      maxInstances: 1,
      basePort: 6600,
      backend: "stock",
    }),
    onMonitorClaim: (requestId, tId, channel) => handleMonitorClaim(requestId, tId, channel, state),
    onMonitorRelease: (requestId, tId, channel) => handleMonitorRelease(requestId, tId, channel, state),
    onRelayAttach: (tId, channel, presentedHandle, socket, pending) => handleRelayAttach(tId, channel, presentedHandle, socket, pending, state, deps),
    // Phase 63, plan 63-03: a required field on StartControlListenerOptions
    // as of this plan -- not exercised by this suite (broker-control.test.ts
    // is the home for `operation` coverage).
    onOperation: () => ({ ok: true }),
    onHostTool: async () => ({ ok: false, message: "not exercised by broker-relay.test.ts" }),
  });
  return { listener, token, incidentsDir };
}

async function withRelayTestBroker<T>(
  emulatorPort: number,
  targetId: string,
  fn: (ctx: RelayTestBrokerContext) => Promise<T>,
  relayDeathDeps?: TestHandleRelayDeathDeps,
): Promise<T> {
  const state = setupBrokerState(emulatorPort, targetId);
  const { listener, token, incidentsDir } = await startRelayListenerForState(state, relayDeathDeps);
  try {
    return await fn({ listener, listenerPort: listener.port, token, state, incidentsDir });
  } finally {
    listener.server.close();
    if (incidentsDir) rmSync(incidentsDir, { recursive: true, force: true });
  }
}

/** Task 3 (SESS-02, concurrency edge): ONE control listener shared across
 * N grants -- the assertion that proves one broker serving two unrelated
 * sessions does not cross-wire them. */
async function withMultiRelayTestBroker<T>(
  grants: Array<{ port: number; targetId: string }>,
  fn: (ctx: RelayTestBrokerContext) => Promise<T>,
  relayDeathDeps?: TestHandleRelayDeathDeps,
): Promise<T> {
  const state = setupMultiGrantBrokerState(grants);
  const { listener, token, incidentsDir } = await startRelayListenerForState(state, relayDeathDeps);
  try {
    return await fn({ listener, listenerPort: listener.port, token, state, incidentsDir });
  } finally {
    listener.server.close();
    if (incidentsDir) rmSync(incidentsDir, { recursive: true, force: true });
  }
}

// ===========================================================================
// readAttachLine() -- pure byte-level line reader.
// ===========================================================================

test("readAttachLine: finds the terminator in one call and returns everything after it as a raw remainder", () => {
  const chunk = Buffer.concat([Buffer.from('{"op":"attach"}\n', "utf8"), Buffer.from([0x01, 0x02, 0x03])]);
  const result = readAttachLine(chunk);
  assert.equal(result.line, '{"op":"attach"}');
  assert.ok(result.remainder.equals(Buffer.from([0x01, 0x02, 0x03])));
  assert.equal(result.overflow, false);
});

test("readAttachLine: no terminator yet -- returns the accumulated carry for the next call", () => {
  const first = readAttachLine(Buffer.from('{"op":"at', "utf8"));
  assert.equal(first.line, undefined);
  assert.equal(first.overflow, false);
  const second = readAttachLine(Buffer.from('tach"}\n', "utf8"), first.remainder);
  assert.equal(second.line, '{"op":"attach"}');
});

test("readAttachLine: overflow flag trips once the unterminated carry exceeds MAX_ATTACH_LINE_BYTES", () => {
  const big = Buffer.alloc(MAX_ATTACH_LINE_BYTES + 1, 0x41);
  const result = readAttachLine(big);
  assert.equal(result.line, undefined);
  assert.equal(result.overflow, true);
});

// ===========================================================================
// handleMonitorClaim() -- the per-claim handle (T-63-01).
// ===========================================================================

test("handleMonitorClaim: an idempotent second claim from the SAME grant on the SAME channel returns the SAME handle, not a new one", () => {
  const state = setupBrokerState(6600, "grant-idempotent");
  const first = handleMonitorClaim("claim-a", "grant-idempotent", "binary", state);
  const second = handleMonitorClaim("claim-b", "grant-idempotent", "binary", state);
  assert.ok(first.ok, `expected the first claim to succeed: ${JSON.stringify(first)}`);
  assert.ok(second.ok, `expected the idempotent repeat to succeed: ${JSON.stringify(second)}`);
  if (!first.ok || !second.ok) return;
  assert.equal(typeof first.handle, "string");
  assert.ok(first.handle.length > 0);
  assert.equal(second.handle, first.handle, "an idempotent repeat claim must echo the SAME handle, never mint a second one");
});

// ===========================================================================
// Task 1 tracer: one binary-monitor command round-trips through the relay.
// ===========================================================================

// ===========================================================================
// Gap closure plan 63-11 (SESS-05): test-hygiene helper closing
// 63-VERIFICATION.md's Warning-severity anti-pattern for this file --
// incidentsDir is minted and cleaned up everywhere, but its CONTENTS were
// never read after an ordinary round trip. Guarded on a non-null
// directory: several deliberate relay-death cases in this file inject
// their own capturing writeIncident recorder and never mint a real
// incidentsDir at all (it stays `null`), and applying this assertion to
// them unguarded would either throw on a missing directory or -- worse --
// silently destroy the discrimination this whole assertion exists to
// provide, by making a real "the record legitimately exists" case
// indistinguishable from a spurious one.
// ===========================================================================
function assertIncidentsDirEmpty(incidentsDir: string | null, context: string): void {
  if (incidentsDir === null) return; // this case injects its own writer; nothing on disk to check
  assert.equal(readdirSync(incidentsDir).length, 0, `${context} -- a routine, successful round trip must not deposit an incident record`);
}

test("tracer: a command sent through a relayed ViceMonitorClient arrives at the stub emulator byte-identical and its reply resolves the same send()", async () => {
  const receivedFrames: Buffer[] = [];
  await withStubEmulatorServer(pingEchoHandler(receivedFrames), async (emulatorPort) => {
    await withRelayTestBroker(emulatorPort, "grant-tracer", async ({ listenerPort, state, incidentsDir }) => {
      const claimOutcome = handleMonitorClaim("claim-tracer", "grant-tracer", "binary", state);
      assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
      if (!claimOutcome.ok) return;

      const dialResult: DialMonitorRelayResult = await dialMonitorRelay({
        targetId: "grant-tracer",
        channel: "binary",
        handle: claimOutcome.handle,
        port: listenerPort,
        candidates: ["127.0.0.1"],
      });
      assert.ok(dialResult.ok, `expected a successful relay dial: ${JSON.stringify(dialResult)}`);
      if (!dialResult.ok) return;

      const client = new ViceMonitorClient();
      client.attach(dialResult.socket, { pending: dialResult.pending });
      try {
        const reply = await client.send(CommandType.Ping);
        assert.equal(reply.errorCode, ErrorCode.Ok);

        assert.equal(receivedFrames.length, 1, "the stub emulator must have received exactly one request frame");
        const frame = receivedFrames[0]!;
        const requestId = frame.readUInt32LE(6);
        const expected = encodeRequestHeader({ commandType: CommandType.Ping, requestId, body: Buffer.alloc(0) });
        assert.ok(
          frame.equals(expected),
          `the frame the stub emulator received must be byte-identical to an independently encoded Ping request -- got ${frame.toString("hex")}, expected ${expected.toString("hex")}`,
        );

        // Gap closure plan 63-11: release the per-channel claim BEFORE
        // disconnecting -- the real, ordinary shape every production
        // caller uses (textDisconnect()/stockDisconnect() always release
        // the claim alongside the socket close). Without this call the
        // disconnect below is an UNANNOUNCED death, not a routine release,
        // and would legitimately write its own incident record -- that is
        // not this hygiene gap, it is the separate, correctly-preserved
        // behaviour the "genuine drop" relay-death cases elsewhere in this
        // file already prove.
        const releaseOutcome = handleMonitorRelease("release-tracer", "grant-tracer", "binary", state);
        assert.ok(releaseOutcome.ok, `expected the release to succeed: ${JSON.stringify(releaseOutcome)}`);
      } finally {
        await client.disconnect();
      }

      // client.disconnect() awaits only the CLIENT's own local socket
      // "close" event, which can resolve before the broker's paired socket
      // has processed its side of the same TCP teardown -- settle one more
      // event-loop turn before reading the directory, or this assertion
      // could pass vacuously against a read that ran too early.
      await new Promise<void>((resolve) => setImmediate(resolve));
      assertIncidentsDirEmpty(incidentsDir, "the tracer's own ordinary claim/attach/command/release/disconnect round trip");
    });
  });
});

test("tracer: an attach presenting a handle that does not match the stored one is refused, and the stub emulator records zero accepted connections", async () => {
  await withStubEmulatorServer(
    () => {
      assert.fail("the stub emulator must never accept a connection for a mismatched-handle attach");
    },
    async (emulatorPort, connectionCount) => {
      await withRelayTestBroker(emulatorPort, "grant-mismatch", async ({ listenerPort, state }) => {
        const claimOutcome = handleMonitorClaim("claim-mismatch", "grant-mismatch", "binary", state);
        assert.ok(claimOutcome.ok);
        if (!claimOutcome.ok) return;

        const dialResult = await dialMonitorRelay({
          targetId: "grant-mismatch",
          channel: "binary",
          handle: "0000000000000000000000000000000",
          port: listenerPort,
          candidates: ["127.0.0.1"],
        });
        assert.equal(dialResult.ok, false, "an attach presenting the wrong handle must never succeed");
        if (dialResult.ok) return;
        assert.match(dialResult.reason, /denied/i, "the refusal must name the authorisation failure, never an emulator-fault wording");
        assert.equal(connectionCount(), 0, "the stub emulator must never accept a connection for a mismatched handle -- the socket is never spliced");
      });
    },
  );
});

// ===========================================================================
// Task 2: the two mode boundaries, both directions, in one TCP segment.
// Every case below is driven by a SINGLE socket write concatenating the
// JSON line, its terminator and non-JSON bytes -- never two writes, because
// TCP makes no such boundary guarantee and a two-write test would pass
// while the bytes were corrupted.
// ===========================================================================

test("boundary one (broker side): a single write carrying the attach line, its terminator and binmon bytes delivers the binmon bytes to the stub emulator unchanged", async () => {
  const receivedByEmulator: Buffer[] = [];
  let resolveGotData: () => void = () => {};
  const gotData = new Promise<void>((resolve) => {
    resolveGotData = resolve;
  });
  await withStubEmulatorServer(
    (socket) => {
      socket.on("data", (chunk: Buffer) => {
        receivedByEmulator.push(Buffer.from(chunk));
        resolveGotData();
      });
    },
    async (emulatorPort) => {
      await withRelayTestBroker(emulatorPort, "grant-boundary-1", async ({ listenerPort, state }) => {
        const claimOutcome = handleMonitorClaim("claim-boundary-1", "grant-boundary-1", "binary", state);
        assert.ok(claimOutcome.ok);
        if (!claimOutcome.ok) return;

        // G-64-1: no credential key at all -- proves a credential-free
        // attach is accepted, mirroring what production now writes.
        const binmonBytes = encodeRequestHeader({ commandType: CommandType.Ping, requestId: 1, body: Buffer.alloc(0) });
        const attachLine = Buffer.from(
          `${JSON.stringify({ op: "attach", target_id: "grant-boundary-1", channel: "binary", handle: claimOutcome.handle })}\n`,
          "utf8",
        );
        const combined = Buffer.concat([attachLine, binmonBytes]);

        const rawSocket = netConnect({ host: "127.0.0.1", port: listenerPort });
        await new Promise<void>((resolve, reject) => {
          rawSocket.once("connect", () => resolve());
          rawSocket.once("error", reject);
        });
        // ONE write -- the attach line, its terminator and the first bytes
        // of a binmon frame together. Never two writes.
        rawSocket.write(combined);

        await gotData;
        const receivedTotal = Buffer.concat(receivedByEmulator);
        assert.ok(receivedTotal.equals(binmonBytes), "the binmon bytes must arrive at the stub emulator byte-identical, asserted with Buffer.equals");
        rawSocket.destroy();
      });
    },
  );
});

test("boundary two (client side): a single write carrying the attach reply, its terminator and a REGISTER_INFO frame results in the client parsing that frame, with no bytes discarded", async () => {
  // A minimal fake broker: answers `hello` then, on the SAME connection,
  // answers `attach` with ONE write concatenating the attach reply, its
  // terminator, and a REGISTER_INFO frame -- stock VICE's own REGISTER_INFO
  // frame lands in exactly this position on a real broker, emitted on every
  // monitor open (CLAUDE.md).
  const registerInfoFrame = encodeResponseFrame({
    responseType: ResponseType.RegisterInfo,
    errorCode: ErrorCode.Ok,
    requestId: VICE_BROADCAST_REQUEST_ID,
    body: Buffer.from([0x00, 0x00]), // count = 0 registers -- a minimal, always-valid body
  });

  const server = createServer((socket) => {
    let carry = Buffer.alloc(0);
    let stage: "hello" | "attach" = "hello";
    socket.on("data", (chunk: Buffer) => {
      carry = Buffer.concat([carry, chunk]);
      const idx = carry.indexOf(0x0a);
      if (idx === -1) return;
      carry = carry.subarray(idx + 1);
      if (stage === "hello") {
        stage = "attach";
        socket.write(`${JSON.stringify({ kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: "1.0.0", tag: RELAY_TAG_BINARY })}\n`);
      } else {
        // ONE write -- the attach reply, its terminator and the
        // REGISTER_INFO frame together. Never two writes.
        socket.write(Buffer.concat([Buffer.from('{"kind":"attached"}\n', "utf8"), registerInfoFrame]));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const fakeBrokerPort = (server.address() as AddressInfo).port;

  try {
    const dialResult: DialMonitorRelayResult = await dialMonitorRelay({
      targetId: "grant-boundary-2",
      channel: "binary",
      handle: "irrelevant-to-this-fake-broker",
      port: fakeBrokerPort,
      candidates: ["127.0.0.1"],
      clientVersion: "1.0.0",
    });
    assert.ok(dialResult.ok, `expected a successful dial against the fake broker: ${JSON.stringify(dialResult)}`);
    if (!dialResult.ok) return;

    assert.ok(
      dialResult.pending.equals(registerInfoFrame),
      "the REGISTER_INFO frame bytes must be returned as `pending`, byte-identical, with no bytes discarded",
    );

    const client = new ViceMonitorClient();
    const events: unknown[] = [];
    client.on("event", (e) => events.push(e));
    client.attach(dialResult.socket, { pending: dialResult.pending });
    assert.equal(events.length, 1, "attach() must parse the seeded pending bytes through the SAME path a live 'data' event would use");
    await client.disconnect();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("byte-transparency: a payload with a lone 0x80-0xFF byte run and an embedded zero byte arrives byte-identical in both directions", async () => {
  const weirdPayload = Buffer.concat([Buffer.from([0x80, 0x81, 0x82, 0xfe, 0xff, 0x00, 0x41, 0x42])]);
  const receivedByEmulator: Buffer[] = [];
  let resolveGotEmulatorData: () => void = () => {};
  const gotEmulatorData = new Promise<void>((resolve) => {
    resolveGotEmulatorData = resolve;
  });

  await withStubEmulatorServer(
    (socket) => {
      socket.on("data", (chunk: Buffer) => {
        receivedByEmulator.push(Buffer.from(chunk));
        resolveGotEmulatorData();
        socket.write(chunk); // echo back unchanged
      });
    },
    async (emulatorPort) => {
      await withRelayTestBroker(emulatorPort, "grant-weird", async ({ listenerPort, state }) => {
        const claimOutcome = handleMonitorClaim("claim-weird", "grant-weird", "binary", state);
        assert.ok(claimOutcome.ok);
        if (!claimOutcome.ok) return;

        const dialResult = await dialMonitorRelay({
          targetId: "grant-weird",
          channel: "binary",
          handle: claimOutcome.handle,
          port: listenerPort,
          candidates: ["127.0.0.1"],
        });
        assert.ok(dialResult.ok, `expected a successful relay dial: ${JSON.stringify(dialResult)}`);
        if (!dialResult.ok) return;

        const clientSocket = dialResult.socket;
        const echoedPromise = new Promise<Buffer>((resolve) => {
          clientSocket.once("data", (chunk: Buffer) => resolve(Buffer.from(chunk)));
        });
        clientSocket.write(weirdPayload);

        await gotEmulatorData;
        assert.ok(Buffer.concat(receivedByEmulator).equals(weirdPayload), "client -> emulator bytes must be byte-identical, asserted with Buffer.equals");

        const echoed = await echoedPromise;
        assert.ok(echoed.equals(weirdPayload), "emulator -> client bytes must be byte-identical, asserted with Buffer.equals");
        clientSocket.destroy();
      });
    },
  );
});

test("boundary one overflow: a relay connection buffering past MAX_ATTACH_LINE_BYTES pre-splice bytes with no terminator has its socket destroyed and never reaches the splice", async () => {
  await withStubEmulatorServer(
    () => {
      assert.fail("the stub emulator must never accept a connection when the pre-splice cap is exceeded with no terminator");
    },
    async (emulatorPort, connectionCount) => {
      await withRelayTestBroker(emulatorPort, "grant-overflow", async ({ listenerPort }) => {
        const rawSocket = netConnect({ host: "127.0.0.1", port: listenerPort });
        await new Promise<void>((resolve, reject) => {
          rawSocket.once("connect", () => resolve());
          rawSocket.once("error", reject);
        });
        const closed = new Promise<void>((resolve) => rawSocket.once("close", () => resolve()));
        // 65537 bytes, no terminator anywhere -- one write past the cap.
        rawSocket.write(Buffer.alloc(MAX_ATTACH_LINE_BYTES + 1, 0x41));
        await closed;
        assert.equal(connectionCount(), 0, "the stub emulator must never be dialled for an overflowed pre-splice buffer");
      });
    },
  );
});

// ===========================================================================
// Task 3: two grants relay at once on one broker without cross-wiring.
// ===========================================================================

test("concurrency: two relay connections attached to two DIFFERENT grants on one broker run independently, and destroying one leaves the other carrying bytes", async () => {
  const receivedA: Buffer[] = [];
  const receivedB: Buffer[] = [];
  let resolveGotA: () => void = () => {};
  let resolveGotB: () => void = () => {};
  const gotA = new Promise<void>((resolve) => {
    resolveGotA = resolve;
  });
  const gotB = new Promise<void>((resolve) => {
    resolveGotB = resolve;
  });

  const socketsA = new Set<Socket>();
  const socketsB = new Set<Socket>();
  let emulatorASocket: Socket | null = null;

  const serverA: Server = createServer((socket) => {
    emulatorASocket = socket;
    socketsA.add(socket);
    socket.on("close", () => socketsA.delete(socket));
    socket.on("data", (chunk: Buffer) => {
      receivedA.push(Buffer.from(chunk));
      resolveGotA();
    });
  });
  const serverB: Server = createServer((socket) => {
    socketsB.add(socket);
    socket.on("close", () => socketsB.delete(socket));
    socket.on("data", (chunk: Buffer) => {
      receivedB.push(Buffer.from(chunk));
      resolveGotB();
    });
  });

  await Promise.all([
    new Promise<void>((resolve) => serverA.listen(0, "127.0.0.1", () => resolve())),
    new Promise<void>((resolve) => serverB.listen(0, "127.0.0.1", () => resolve())),
  ]);
  const portA = (serverA.address() as AddressInfo).port;
  const portB = (serverB.address() as AddressInfo).port;

  try {
    await withMultiRelayTestBroker(
      [
        { port: portA, targetId: "grant-multi-a" },
        { port: portB, targetId: "grant-multi-b" },
      ],
      async ({ listenerPort, state }) => {
        const claimA = handleMonitorClaim("claim-multi-a", "grant-multi-a", "binary", state);
        const claimB = handleMonitorClaim("claim-multi-b", "grant-multi-b", "binary", state);
        assert.ok(claimA.ok && claimB.ok, `expected both claims to succeed: ${JSON.stringify(claimA)} ${JSON.stringify(claimB)}`);
        if (!claimA.ok || !claimB.ok) return;

        const dialA = await dialMonitorRelay({
          targetId: "grant-multi-a",
          channel: "binary",
          handle: claimA.handle,
          port: listenerPort,
          candidates: ["127.0.0.1"],
        });
        const dialB = await dialMonitorRelay({
          targetId: "grant-multi-b",
          channel: "binary",
          handle: claimB.handle,
          port: listenerPort,
          candidates: ["127.0.0.1"],
        });
        assert.ok(dialA.ok && dialB.ok, `expected both relay dials to succeed: ${JSON.stringify(dialA)} ${JSON.stringify(dialB)}`);
        if (!dialA.ok || !dialB.ok) return;

        // Interleave: write on relay A, then relay B -- each payload must
        // arrive ONLY at its own emulator.
        const payloadA = Buffer.from("payload-for-A-only", "utf8");
        const payloadB = Buffer.from("payload-for-B-only", "utf8");
        dialA.socket.write(payloadA);
        await gotA;
        dialB.socket.write(payloadB);
        await gotB;

        assert.ok(Buffer.concat(receivedA).equals(payloadA), "relay A's payload must arrive at emulator A byte-identical, asserted with Buffer.equals");
        assert.ok(Buffer.concat(receivedB).equals(payloadB), "relay B's payload must arrive at emulator B byte-identical, asserted with Buffer.equals");
        assert.equal(receivedA.length, 1, "emulator A must never observe a second, cross-wired chunk");
        assert.equal(receivedB.length, 1, "emulator B must never observe a second, cross-wired chunk");

        // Destroy relay A -- emulator B's connection must survive and stay
        // able to carry bytes. Wait on the REAL close propagation through
        // the splice (never a timer) before asserting on B.
        const emulatorAClosed = new Promise<void>((resolve) => {
          if (!emulatorASocket || emulatorASocket.destroyed) {
            resolve();
            return;
          }
          emulatorASocket.once("close", () => resolve());
        });
        dialA.socket.destroy();
        await emulatorAClosed;

        let resolveGotBAgain: () => void = () => {};
        const gotBAgain = new Promise<void>((resolve) => {
          resolveGotBAgain = resolve;
        });
        for (const s of socketsB) {
          s.removeAllListeners("data");
          s.on("data", (chunk: Buffer) => {
            receivedB.push(Buffer.from(chunk));
            resolveGotBAgain();
          });
        }
        const payloadB2 = Buffer.from("still-alive-B", "utf8");
        assert.ok(!dialB.socket.destroyed, "relay B's own socket must still be open after relay A was destroyed");
        dialB.socket.write(payloadB2);
        await gotBAgain;
        assert.ok(
          Buffer.from(receivedB[receivedB.length - 1]!).equals(payloadB2),
          "emulator B's connection must still be open and able to carry bytes after relay A is destroyed",
        );

        dialB.socket.destroy();
      },
    );
  } finally {
    for (const s of socketsA) s.destroy();
    for (const s of socketsB) s.destroy();
    await new Promise<void>((resolve) => serverA.close(() => resolve()));
    await new Promise<void>((resolve) => serverB.close(() => resolve()));
  }
});

// ===========================================================================
// Task 2 (plan 63-02, SESS-02): the binary channel's relay-death policy --
// re-establishable, unlike the text channel's. Every server below is a
// full-handshake stub (PING/VICE_INFO/CPUHISTORY_GET/EXIT), mirroring
// stock-connect.test.ts's own happyPathResponder() shape, standing in for
// a well-behaved stock build -- never a real emulator.
// ===========================================================================

interface DecodedRequest {
  requestId: number;
  commandType: number;
  total: number;
}

function decodeOneRequest(buf: Buffer): DecodedRequest | null {
  if (buf.length < REQUEST_HEADER_LEN) return null;
  const bodyLength = buf.readUInt32LE(2);
  const total = REQUEST_HEADER_LEN + bodyLength;
  if (buf.length < total) return null;
  return { requestId: buf.readUInt32LE(6), commandType: buf[10]!, total };
}

/** A full-handshake responder for PING/VICE_INFO/CPUHISTORY_GET/EXIT --
 * mirrors stock-connect.test.ts's own happyPathResponder() (this file
 * cannot import that one; it is private to its own file), the minimum
 * stockConnect()'s own handshake needs to complete against a stub. */
function happyPathResponder(): (socket: Socket) => void {
  return (socket) => {
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        const decoded = decodeOneRequest(buf);
        if (!decoded) break;
        buf = buf.subarray(decoded.total);
        switch (decoded.commandType) {
          case CommandType.Ping:
            socket.write(encodeResponseFrame({ responseType: ResponseType.Ping, errorCode: ErrorCode.Ok, requestId: decoded.requestId }));
            break;
          case CommandType.ViceInfo:
            socket.write(
              encodeResponseFrame({
                responseType: ResponseType.ViceInfo,
                errorCode: ErrorCode.Ok,
                requestId: decoded.requestId,
                body: Buffer.concat([Buffer.from([4]), Buffer.from([3, 9, 0, 0]), Buffer.from([0])]),
              }),
            );
            break;
          case CommandType.CpuHistoryGet:
            socket.write(
              encodeResponseFrame({ responseType: ResponseType.CpuHistoryGet, errorCode: ErrorCode.Ok, requestId: decoded.requestId, body: Buffer.alloc(4) }),
            );
            break;
          case CommandType.Exit:
            socket.write(
              Buffer.concat([
                encodeResponseFrame({ responseType: ResponseType.Exit, errorCode: ErrorCode.Ok, requestId: decoded.requestId }),
                encodeResponseFrame({ responseType: ResponseType.Resumed, errorCode: ErrorCode.Ok, requestId: VICE_BROADCAST_REQUEST_ID, body: Buffer.from([0x31, 0xea]) }),
              ]),
            );
            break;
          default:
            break;
        }
      }
    });
  };
}

/** Mirrors stock-connect.test.ts's own withTempEpochFile() -- a real
 * temp-directory epoch.json, so stockReconnect()'s identity-proof path has
 * genuine evidence to read rather than an injected stub. */
function withTempEpochFile<T>(fn: (epochPath: string, writeEpoch: (epoch: number) => void) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "broker-relay-epoch-"));
  const epochPath = join(dir, "epoch.json");
  const writeEpoch = (epoch: number) => {
    writeFileSync(epochPath, JSON.stringify({ epoch, spawned_at: new Date().toISOString(), pid: 1234 }));
  };
  return fn(epochPath, writeEpoch).finally(() => rmSync(dir, { recursive: true, force: true }));
}

/** A StockConnectBrokerControl whose claimMonitor()/releaseMonitor() call
 * vice-broker.mts's own handleMonitorClaim()/handleMonitorRelease()
 * DIRECTLY, in-process, against the SAME BrokerState this test's relay
 * listener is wired to -- there is no real control-plane wire in this
 * suite (broker-relay.test.ts talks to the listener only for the relay's
 * own hello/attach handshake), so stockConnect()'s own claim step needs a
 * stand-in that reaches the SAME production functions the wire would. */
function makeRealBrokerControl(state: BrokerState, targetId: string): StockConnectBrokerControl {
  let claimSeq = 0;
  let releaseSeq = 0;
  return {
    async claimMonitor({ channel }) {
      claimSeq += 1;
      const outcome = handleMonitorClaim(`claim-${targetId}-${claimSeq}`, targetId, channel ?? "binary", state);
      // broker-control.mts's own MonitorClaimOutcome (`code`) is a
      // DIFFERENT shape from vice-broker-client.ts's wire-level
      // ClaimMonitorOutcome (`reason`) this interface expects -- this
      // stand-in reaches the server-side function directly, in-process,
      // so it must translate the outcome the same way the real control-
      // plane wire's own JSON encode/decode round trip would.
      if (outcome.ok) return outcome;
      if (outcome.code === "monitor_owned") return { ok: false, reason: "monitor_owned", holder: outcome.holder };
      return { ok: false, reason: outcome.code };
    },
    async releaseMonitor({ channel }) {
      releaseSeq += 1;
      const outcome = handleMonitorRelease(`release-${targetId}-${releaseSeq}`, targetId, channel ?? "binary", state);
      if (outcome.ok) return outcome;
      return { ok: false, reason: outcome.code };
    },
    async noteOperation() {
      throw new Error("noteOperation must not be called by this suite -- stockConnect()/stockReconnect() never call it");
    },
    async stageFile() {
      throw new Error("stageFile must not be called by this suite -- stockConnect()/stockReconnect() never call it");
    },
  };
}

// ===========================================================================
// G-64-4 (plan 64-12), Task 1: the cold-launch relay-attach race. Real
// x64sc's binary-monitor port binds 55-142ms after spawn while the client's
// own attach+first-PING lands 17-31ms after spawn (measured) -- every PRE-EXISTING
// stub emulator in this file binds its port SYNCHRONOUSLY, before the attach
// is ever sent, which is exactly what hid this race from every earlier test.
// withLateBindingStubEmulatorServer() reverses that: the attach is sent
// while nothing is bound, and the stub only starts accepting connections
// `bindDelayMs` later.
// ===========================================================================

test("emulator binds late: a binary attach sent before the emulator's port is bound is answered only after the bind, and the stock handshake's first PING is answered", async () => {
  await withTempEpochFile(async (epochPath, writeEpoch) => {
    writeEpoch(7);
    let incidentWrites = 0;
    const relayDeathDeps: TestHandleRelayDeathDeps = {
      writeIncident: (record) => {
        incidentWrites += 1;
        return `/fake/incident/path-${incidentWrites}.md`;
      },
    };
    let emulatorSocket: Socket | null = null;
    let resolveEmulatorAccepted: () => void = () => {};
    const emulatorAccepted = new Promise<void>((resolve) => {
      resolveEmulatorAccepted = resolve;
    });
    await withLateBindingStubEmulatorServer(
      250,
      (socket) => {
        emulatorSocket = socket;
        resolveEmulatorAccepted();
        happyPathResponder()(socket);
      },
      async (emulatorPort) => {
        const targetId = "grant-g64-4-late-bind";
        await withRelayTestBroker(
          emulatorPort,
          targetId,
          async ({ listenerPort, state }) => {
            const brokerControl = makeRealBrokerControl(state, targetId);
            const dialMonitorSocket: DialMonitorSocketFn = async (opts) => {
              const result = await dialMonitorRelay({
                targetId: opts.targetId,
                channel: opts.channel,
                handle: opts.handle,
                port: listenerPort,
                candidates: ["127.0.0.1"],
              });
              if (!result.ok) throw new Error(result.reason);
              return { socket: result.socket, pending: result.pending };
            };

            // The attach is sent (via stockConnect()'s own dial) IMMEDIATELY
            // -- the stub emulator's own port has nothing listening on it
            // yet at this instant; it binds 250ms from now.
            const session = await stockConnect({
              host: "127.0.0.1",
              port: emulatorPort,
              targetId,
              brokerControl,
              deps: { dialMonitorSocket, epochPath },
            });
            assert.ok(
              session.client.connected,
              "the handshake must complete once the emulator binds -- the attach must have waited for the bind rather than answering `attached` before it",
            );
            await emulatorAccepted;
            assert.equal(incidentWrites, 0, "a late-binding emulator that eventually accepts the connection must never write an incident record");
            await stockDisconnect(session);
          },
          relayDeathDeps,
        );
      },
    );
  });
});

// ===========================================================================
// G-64-4 (plan 64-12), Task 2: the dial that never connects, the dial that
// is abandoned (client gone, or the claim released mid-dial), the emulator
// that speaks first, and a non-retryable connect error. Every case below
// drives the real control listener and the compiled handleMonitorClaim()/
// handleRelayAttach(), with the injected incident writer as a recorder.
// ===========================================================================

test("emulator never binds: the attach is refused by name once the deadline passes", async () => {
  const port = await reserveFreePort(); // reserved, then released -- NOTHING is ever bound on it in this test
  const targetId = "grant-g64-4-never-binds";
  let incidentWrites = 0;
  const deps: TestHandleRelayDeathDeps = {
    dialDeadlineMs: 300,
    dialRetryIntervalMs: 25,
    writeIncident: (record) => {
      incidentWrites += 1;
      return `/fake/incident/${incidentWrites}.md`;
    },
  };
  await withRelayTestBroker(
    port,
    targetId,
    async ({ listenerPort, state }) => {
      const claimOutcome = handleMonitorClaim("claim-never-binds", targetId, "binary", state);
      assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
      if (!claimOutcome.ok) return;

      const startedAt = Date.now();
      const dialResult = await dialMonitorRelay({
        targetId,
        channel: "binary",
        handle: claimOutcome.handle,
        port: listenerPort,
        candidates: ["127.0.0.1"],
      });
      const elapsedMs = Date.now() - startedAt;
      assert.equal(dialResult.ok, false, "an attach against an emulator that never binds must never succeed");
      if (dialResult.ok) return;
      assert.ok(elapsedMs >= 300, `the refusal must arrive no sooner than the injected 300ms deadline (took ${elapsedMs}ms)`);
      assert.match(dialResult.reason, /did not accept a connection/i, "the refusal must name the cause");
      assert.match(dialResult.reason, /retry/i, "the refusal must say that retrying the same call is safe");
      assert.equal(incidentWrites, 0, "a dial that never connects must never write an incident record");
      assert.equal(state.relaySessions.size, 0, "no relay session may exist for a dial that never connected");
      const instance = state.instances.get(port);
      assert.ok(instance, "the instance record must still be present after the refusal");
      assert.equal(instance!.monitorClients.binary?.attached, false, "the attached marker must be cleared after the refusal");
      assert.ok(state.grants.has(targetId), "the grant must still be present after the refusal");

      // A later claim and attach on the SAME instance, once a stub emulator
      // is finally bound on that exact port, must succeed -- an in-session
      // retry converges rather than being permanently refused.
      const acceptedSockets = new Set<Socket>();
      const server: Server = createServer((socket) => {
        acceptedSockets.add(socket);
        socket.on("close", () => acceptedSockets.delete(socket));
        pingEchoHandler([])(socket);
      });
      await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve()));
      try {
        const claimOutcome2 = handleMonitorClaim("claim-never-binds-retry", targetId, "binary", state);
        assert.ok(claimOutcome2.ok, `expected the retried claim to succeed: ${JSON.stringify(claimOutcome2)}`);
        if (!claimOutcome2.ok) return;
        const dialResult2 = await dialMonitorRelay({
          targetId,
          channel: "binary",
          handle: claimOutcome2.handle,
          port: listenerPort,
          candidates: ["127.0.0.1"],
        });
        assert.ok(dialResult2.ok, `expected the retried attach to succeed once the emulator is bound: ${JSON.stringify(dialResult2)}`);
        if (dialResult2.ok) dialResult2.socket.destroy();
      } finally {
        // server.close()'s own callback fires only once every CURRENTLY OPEN
        // connection has closed -- it does not forcibly close them itself
        // (unlike this file's own withStubEmulatorServer()/
        // withLateBindingStubEmulatorServer() helpers, which track and
        // destroy accepted sockets explicitly for exactly this reason).
        // Destroying the client-side relay socket above starts that
        // teardown; destroying whatever the stub itself still holds open
        // here is the belt-and-braces half of the same discipline.
        for (const socket of acceptedSockets) socket.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
    deps,
  );
});

test("emulator binds late, client gives up first", async () => {
  let incidentWrites = 0;
  const deps: TestHandleRelayDeathDeps = {
    writeIncident: (record) => {
      incidentWrites += 1;
      return `/fake/incident/${incidentWrites}.md`;
    },
  };
  const targetId = "grant-g64-4-client-gives-up";
  await withLateBindingStubEmulatorServer(
    300,
    () => {
      assert.fail("the stub emulator must never accept a connection once the client gave up first");
    },
    async (emulatorPort, connectionCount) => {
      await withRelayTestBroker(
        emulatorPort,
        targetId,
        async ({ listenerPort, state }) => {
          const claimOutcome = handleMonitorClaim("claim-give-up", targetId, "binary", state);
          assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
          if (!claimOutcome.ok) return;

          const clientSocket = netConnect({ host: "127.0.0.1", port: listenerPort });
          await new Promise<void>((resolve) => clientSocket.once("connect", () => resolve()));
          clientSocket.write(`${JSON.stringify({ op: "attach", target_id: targetId, channel: "binary", handle: claimOutcome.handle })}\n`);

          await new Promise((resolve) => setTimeout(resolve, 100));
          clientSocket.destroy();

          // Past the 300ms bind, with margin for the dial's own retry cadence
          // to notice the abandonment and settle.
          await new Promise((resolve) => setTimeout(resolve, 400));

          assert.equal(connectionCount(), 0, "the stub emulator must never accept a connection once the client gave up");
          assert.equal(state.relaySessions.size, 0, "no relay session may be registered for an abandoned attach");
          const instance = state.instances.get(emulatorPort);
          assert.equal(instance?.monitorClients.binary?.attached, false, "the attached marker must be cleared after abandonment");
          assert.equal(incidentWrites, 0, "an abandoned dial must never write an incident record");
        },
        deps,
      );
    },
  );
});

test("emulator binds late, claim released meanwhile", async () => {
  let incidentWrites = 0;
  const deps: TestHandleRelayDeathDeps = {
    writeIncident: (record) => {
      incidentWrites += 1;
      return `/fake/incident/${incidentWrites}.md`;
    },
  };
  const targetId = "grant-g64-4-released-meanwhile";
  await withLateBindingStubEmulatorServer(
    300,
    () => {},
    async (emulatorPort, _connectionCount, liveConnectionCount) => {
      await withRelayTestBroker(
        emulatorPort,
        targetId,
        async ({ listenerPort, state }) => {
          const claimOutcome = handleMonitorClaim("claim-released", targetId, "binary", state);
          assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
          if (!claimOutcome.ok) return;

          const clientSocket = netConnect({ host: "127.0.0.1", port: listenerPort });
          await new Promise<void>((resolve) => clientSocket.once("connect", () => resolve()));
          let gotResponse = false;
          let gotClose = false;
          clientSocket.on("data", () => {
            gotResponse = true;
          });
          clientSocket.on("close", () => {
            gotClose = true;
          });
          clientSocket.write(`${JSON.stringify({ op: "attach", target_id: targetId, channel: "binary", handle: claimOutcome.handle })}\n`);

          await new Promise((resolve) => setTimeout(resolve, 100));
          const releaseOutcome = handleMonitorRelease("release-meanwhile", targetId, "binary", state);
          assert.ok(releaseOutcome.ok, `expected the release to succeed: ${JSON.stringify(releaseOutcome)}`);

          // Past the 300ms bind, with margin for the dial's own retry cadence
          // to notice the release and settle.
          await new Promise((resolve) => setTimeout(resolve, 400));

          assert.equal(state.relaySessions.size, 0, "no relay session may be registered for a claim released mid-dial");
          assert.equal(liveConnectionCount(), 0, "any connection the stub emulator accepted must have been closed by the broker");
          assert.ok(gotResponse || gotClose, "the client must have gotten a refusal or a close, not silence");
          assert.equal(incidentWrites, 0, "a release mid-dial must never write an incident record");

          clientSocket.destroy();
        },
        deps,
      );
    },
  );
});

test("emulator binds late and speaks first", async () => {
  let incidentWrites = 0;
  const deps: TestHandleRelayDeathDeps = {
    writeIncident: (record) => {
      incidentWrites += 1;
      return `/fake/incident/${incidentWrites}.md`;
    },
  };
  const targetId = "grant-g64-4-speaks-first";
  const registerInfoFrame = encodeResponseFrame({
    responseType: ResponseType.RegisterInfo,
    errorCode: ErrorCode.Ok,
    requestId: VICE_BROADCAST_REQUEST_ID,
    body: Buffer.from([0x00, 0x00]), // count = 0 registers -- a minimal, always-valid body
  });
  await withLateBindingStubEmulatorServer(
    250,
    (socket) => {
      // Written the INSTANT this stub accepts -- before the broker's own
      // splice has wired any "data" listener on this socket, so these bytes
      // must sit buffered until spliceRelay() pipes them through.
      socket.write(registerInfoFrame);
    },
    async (emulatorPort) => {
      await withRelayTestBroker(
        emulatorPort,
        targetId,
        async ({ listenerPort, state }) => {
          const claimOutcome = handleMonitorClaim("claim-speaks-first", targetId, "binary", state);
          assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
          if (!claimOutcome.ok) return;

          const dialResult = await dialMonitorRelay({
            targetId,
            channel: "binary",
            handle: claimOutcome.handle,
            port: listenerPort,
            candidates: ["127.0.0.1"],
          });
          assert.ok(dialResult.ok, `expected the attach to succeed once the emulator binds and speaks first: ${JSON.stringify(dialResult)}`);
          if (!dialResult.ok) return;

          // The frame may arrive entirely within `pending`, or split across
          // `pending` and a FOLLOWING "data" event -- accumulate both rather
          // than assuming either shape.
          let collected: Buffer = Buffer.from(dialResult.pending);
          if (collected.length < registerInfoFrame.length) {
            collected = await new Promise<Buffer>((resolve) => {
              const onData = (chunk: Buffer) => {
                collected = Buffer.concat([collected, chunk]);
                if (collected.length >= registerInfoFrame.length) {
                  dialResult.socket.removeListener("data", onData);
                  resolve(collected);
                }
              };
              dialResult.socket.on("data", onData);
            });
          }
          assert.ok(
            collected.subarray(0, registerInfoFrame.length).equals(registerInfoFrame),
            "the REGISTER_INFO frame bytes must arrive intact, byte-identical -- `attached` was the first line read, and the frame followed it whole",
          );
          assert.equal(incidentWrites, 0);
          dialResult.socket.destroy();
        },
        deps,
      );
    },
  );
});

test("emulator binds late, non-refusal error: a non-ECONNREFUSED connect error fails the attach at once, with no retry", async () => {
  let incidentWrites = 0;
  let connectAttempts = 0;
  const fakeConnect: RelayConnectFn = () => {
    connectAttempts += 1;
    const socket = new NodeNetSocket();
    // Deferred to the next tick so the dial's own "error" listener (added
    // immediately after this function returns) is already attached --
    // emitting synchronously here would be missed.
    process.nextTick(() => {
      const err = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      socket.emit("error", err);
    });
    return socket;
  };
  const targetId = "grant-g64-4-non-refusal-error";
  const deps: TestHandleRelayDeathDeps = {
    connect: fakeConnect,
    writeIncident: (record) => {
      incidentWrites += 1;
      return `/fake/incident/${incidentWrites}.md`;
    },
  };
  const state = setupBrokerState(19999, targetId); // the port is never really dialled -- connect is faked
  const { listener, incidentsDir } = await startRelayListenerForState(state, deps);
  try {
    const claimOutcome = handleMonitorClaim("claim-non-refusal-error", targetId, "binary", state);
    assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
    if (!claimOutcome.ok) return;

    const dialResult = await dialMonitorRelay({
      targetId,
      channel: "binary",
      handle: claimOutcome.handle,
      port: listener.port,
      candidates: ["127.0.0.1"],
    });
    assert.equal(dialResult.ok, false, "a non-ECONNREFUSED connect error must never succeed");
    if (dialResult.ok) return;
    assert.equal(connectAttempts, 1, "a non-ECONNREFUSED connect error must never be retried");
    assert.equal(incidentWrites, 0, "a non-retryable connect error must never write an incident record");
  } finally {
    listener.server.close();
    if (incidentsDir) rmSync(incidentsDir, { recursive: true, force: true });
  }
});

// ===========================================================================
// G-64-4 (plan 64-12), Task 3: the client must wait longer than the broker's
// own emulator-dial deadline, or it times out on an attach the broker is
// still correctly waiting on -- and the refusal it would have sent is never
// read.
// ===========================================================================

test("the client's attach-reply wait for a relay dial exceeds the broker's emulator-dial deadline by at least one retry interval", () => {
  assert.ok(
    DEFAULT_ATTACH_REPLY_TIMEOUT_MS >= DEFAULT_RELAY_DIAL_DEADLINE_MS + DEFAULT_RELAY_DIAL_RETRY_MS,
    `the client's attach-reply wait (${DEFAULT_ATTACH_REPLY_TIMEOUT_MS}ms) must exceed the broker's own emulator-dial ` +
      `deadline (${DEFAULT_RELAY_DIAL_DEADLINE_MS}ms) by at least one retry interval (${DEFAULT_RELAY_DIAL_RETRY_MS}ms), ` +
      "or the client gives up before the broker's own correctly-still-waiting refusal is ever read",
  );
});

test("stockConnect: a real never-binding attach's refusal, converted by convertHandshakeError(), names the cause and the retry, and never mentions VICE_BROKER_BINMON_HOST", async () => {
  await withTempEpochFile(async (epochPath, writeEpoch) => {
    writeEpoch(1);
    const port = await reserveFreePort(); // reserved, then released -- NOTHING is ever bound on it in this test
    const targetId = "grant-g64-4-e2e-never-binds";
    const deps: TestHandleRelayDeathDeps = { dialDeadlineMs: 300, dialRetryIntervalMs: 25 };
    await withRelayTestBroker(
      port,
      targetId,
      async ({ listenerPort, state }) => {
        const brokerControl = makeRealBrokerControl(state, targetId);
        const dialMonitorSocket: DialMonitorSocketFn = async (opts) => {
          const result = await dialMonitorRelay({
            targetId: opts.targetId,
            channel: opts.channel,
            handle: opts.handle,
            port: listenerPort,
            candidates: ["127.0.0.1"],
          });
          if (!result.ok) throw new Error(result.reason);
          return { socket: result.socket, pending: result.pending };
        };

        await assert.rejects(
          () =>
            stockConnect({
              host: "127.0.0.1",
              port,
              targetId,
              brokerControl,
              deps: { dialMonitorSocket, epochPath },
            }),
          (err: unknown) => {
            const result = convertHandshakeError("vice_ping", err);
            const text = result.content[0]!.text;
            assert.match(text, /did not accept a connection/i, "the tool-facing text must name the cause");
            assert.match(text, /retry/i, "the tool-facing text must say that retrying is safe");
            assert.doesNotMatch(text, /VICE_BROKER_BINMON_HOST/, "an emulator that is merely still starting must never be told to reconfigure the bind host");
            return true;
          },
        );
      },
      deps,
    );
  });
});

test("stockReconnect: after the binary relay is destroyed, a fresh session establishment dials the relay again and succeeds on a matching epoch", async () => {
  await withTempEpochFile(async (epochPath, writeEpoch) => {
    writeEpoch(42);
    let emulatorSocket: Socket | null = null;
    let resolveEmulatorAccepted: () => void = () => {};
    let emulatorAccepted = new Promise<void>((resolve) => {
      resolveEmulatorAccepted = resolve;
    });
    await withStubEmulatorServer(
      (socket) => {
        emulatorSocket = socket;
        resolveEmulatorAccepted();
        happyPathResponder()(socket);
      },
      async (emulatorPort) => {
        await withRelayTestBroker(emulatorPort, "grant-reconnect-binary", async ({ listenerPort, state }) => {
          const brokerControl = makeRealBrokerControl(state, "grant-reconnect-binary");
          const dialMonitorSocket: DialMonitorSocketFn = async (opts) => {
            const result = await dialMonitorRelay({
              targetId: opts.targetId,
              channel: opts.channel,
              handle: opts.handle,
              port: listenerPort,
              candidates: ["127.0.0.1"],
            });
            if (!result.ok) throw new Error(result.reason);
            return { socket: result.socket, pending: result.pending };
          };

          const session = await stockConnect({
            host: "127.0.0.1",
            port: emulatorPort,
            targetId: "grant-reconnect-binary",
            brokerControl,
            deps: { dialMonitorSocket, epochPath },
          });
          assert.ok(session.client.connected, "the first handshake must dial the relay and connect");

          // Destroy the EMULATOR side of the splice -- cascades through
          // spliceRelay()'s own close wiring to destroy the client's relay
          // socket too, exactly as an unexpected relay death would.
          const clientClosed = new Promise<void>((resolve) => session.client.once("close", () => resolve()));
          emulatorSocket!.destroy();
          await clientClosed;
          assert.equal(session.client.connected, false, "the relay death must be observable through connected, exactly as a direct-dial death would be");

          // The next connection this stub emulator accepts is stockReconnect()'s
          // own fresh dial -- reset the "accepted" promise to observe it.
          emulatorAccepted = new Promise<void>((resolve) => {
            resolveEmulatorAccepted = resolve;
          });

          const reconnected = await stockReconnect(session);
          assert.ok(reconnected.client.connected, "stockReconnect() must dial the relay again and complete a fresh handshake on a matching epoch");
          await emulatorAccepted; // the stub emulator must have accepted a SECOND connection -- the relay redialled it
          await stockDisconnect(reconnected);
        });
      },
    );
  });
});

test("stockReconnect: after the binary relay is destroyed, an advanced epoch rejects with MachineRestartedError rather than reusing the dead relay", async () => {
  await withTempEpochFile(async (epochPath, writeEpoch) => {
    writeEpoch(1);
    let emulatorSocket: Socket | null = null;
    let resolveEmulatorAccepted: () => void = () => {};
    const emulatorAccepted = new Promise<void>((resolve) => {
      resolveEmulatorAccepted = resolve;
    });
    await withStubEmulatorServer(
      (socket) => {
        emulatorSocket = socket;
        resolveEmulatorAccepted();
        happyPathResponder()(socket);
      },
      async (emulatorPort) => {
        await withRelayTestBroker(emulatorPort, "grant-reconnect-restarted", async ({ listenerPort, state }) => {
          const brokerControl = makeRealBrokerControl(state, "grant-reconnect-restarted");
          const dialMonitorSocket: DialMonitorSocketFn = async (opts) => {
            const result = await dialMonitorRelay({
              targetId: opts.targetId,
              channel: opts.channel,
              handle: opts.handle,
              port: listenerPort,
              candidates: ["127.0.0.1"],
            });
            if (!result.ok) throw new Error(result.reason);
            return { socket: result.socket, pending: result.pending };
          };

          const session = await stockConnect({
            host: "127.0.0.1",
            port: emulatorPort,
            targetId: "grant-reconnect-restarted",
            brokerControl,
            deps: { dialMonitorSocket, epochPath },
          });

          const clientClosed = new Promise<void>((resolve) => session.client.once("close", () => resolve()));
          emulatorSocket!.destroy();
          await clientClosed;

          // The epoch advances BETWEEN the original connect and the
          // reconnect attempt -- the machine underneath is not the one this
          // session originally handshook with, whether or not the relay
          // itself could be re-dialled.
          writeEpoch(2);

          await assert.rejects(stockReconnect(session), (err: unknown) => {
            assert.ok(err instanceof MachineRestartedError, `expected MachineRestartedError, got ${String(err)}`);
            return true;
          });
        });
      },
    );
  });
});

// ===========================================================================
// Structural (Task 2): the text path declares no reconnect entry point.
// ===========================================================================

test("structural: no exported identifier on the text path contains a reconnect entry point", () => {
  const files = ["text-connect.ts", "text-protocol.ts", "text-tools.ts"];
  const source = files.map((f) => readFileSync(join(HERE, f), "utf8")).join("\n");
  const stripped = source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
  const matches = stripped.match(/export (async )?function text[A-Za-z]*[Rr]econnect/g) ?? [];
  assert.deepEqual(matches, [], `the text path must declare no reconnect entry point: ${JSON.stringify(matches)}`);
});

test("structural: text-connect.ts's header still states, in place, that no reconnect is ever to be built there", () => {
  const source = readFileSync(join(HERE, "text-connect.ts"), "utf8");
  assert.ok(source.includes("Never build a textReconnect()"), "text-connect.ts's header must still carry this exact phrase");
});

test("structural: broker-relay-text.test.ts is present and is not on git's own untracked list -- both channels' proving suites exist as real files", () => {
  const output = execFileSync("git", ["ls-files"], { cwd: HERE, encoding: "utf8" });
  const files = output.split("\n").map((f) => f.trim());
  assert.ok(files.includes("broker-relay-text.test.ts"), "broker-relay-text.test.ts must be a tracked file");
  assert.ok(existsSync(join(HERE, "broker-relay-text.test.ts")), "broker-relay-text.test.ts must exist on disk");
});

// ===========================================================================
// Plan 63-04, Task 1 (SESS-03, SESS-05): a relay death leaves evidence, then
// lets go of exactly one channel.
//
// MEASURED this session, against real loopback sockets (see broker-relay.mts's
// own spliceRelay() header comment): a plain `.destroy()` with nothing left
// unread delivers a graceful FIN to the peer exactly like `.end()` does --
// `"close"` fires with `hadError: false` for BOTH. The only reliable way to
// produce a genuine "no FIN" abrupt death on real loopback sockets is
// `Socket.prototype.resetAndDestroy()` (a real TCP RST), which is what these
// tests use for every "abrupt" case below; `.end()` is used for every
// "graceful" case.
// ===========================================================================

/** Claims `channel` for `targetId` and dials the relay for it in one step --
 * the shared setup every death test below needs before it can kill anything. */
async function claimAndDialRelay(
  state: BrokerState,
  listenerPort: number,
  targetId: string,
  channel: MonitorChannel = "binary",
): Promise<DialMonitorRelaySuccess> {
  const claim = handleMonitorClaim(`claim-${targetId}`, targetId, channel, state);
  assert.ok(claim.ok, `expected the claim to succeed: ${JSON.stringify(claim)}`);
  if (!claim.ok) throw new Error("unreachable");
  const dial = await dialMonitorRelay({ targetId, channel, handle: claim.handle, port: listenerPort, candidates: ["127.0.0.1"] });
  assert.ok(dial.ok, `expected a successful relay dial: ${JSON.stringify(dial)}`);
  if (!dial.ok) throw new Error("unreachable");
  return dial;
}

test("handleRelayDeath: an abruptly destroyed relay (a real TCP RST) produces exactly one incident record and exactly one claim clear, in that order", async () => {
  const order: string[] = [];
  const deps: TestHandleRelayDeathDeps = {
    writeIncident: (record) => {
      order.push(`write:${String(record.trigger)}`);
      return "/fake/incident/path.md";
    },
    clearClaim: (_instance, channel) => {
      order.push(`clear:${channel}`);
    },
  };
  let resolveEmulatorClosed: () => void = () => {};
  const emulatorClosed = new Promise<void>((resolve) => {
    resolveEmulatorClosed = resolve;
  });
  await withStubEmulatorServer(
    (socket) => socket.once("close", () => resolveEmulatorClosed()),
    async (emulatorPort) => {
      await withRelayTestBroker(
        emulatorPort,
        "grant-death-abrupt",
        async ({ listenerPort, state }) => {
          const dial = await claimAndDialRelay(state, listenerPort, "grant-death-abrupt");
          assert.ok(state.relaySessions.has(relaySessionKey("grant-death-abrupt", "binary")), "the relay session must be recorded the instant the attach succeeds");

          dial.socket.resetAndDestroy();
          await emulatorClosed;

          assert.deepEqual(order, ["write:relay_error", "clear:binary"], "evidence must be written strictly before the claim is cleared, and the trigger must name the abrupt (RST) case");
          assert.ok(!state.relaySessions.has(relaySessionKey("grant-death-abrupt", "binary")), "the session must be removed from the map once its teardown has run");
        },
        deps,
      );
    },
  );
});

test("handleRelayDeath: a gracefully ended relay reports a trigger that distinguishes it from the abrupt case", async () => {
  const order: string[] = [];
  const deps: TestHandleRelayDeathDeps = {
    writeIncident: (record) => {
      order.push(`write:${String(record.trigger)}`);
      return "/fake/incident/path.md";
    },
  };
  let resolveEmulatorClosed: () => void = () => {};
  const emulatorClosed = new Promise<void>((resolve) => {
    resolveEmulatorClosed = resolve;
  });
  await withStubEmulatorServer(
    (socket) => socket.once("close", () => resolveEmulatorClosed()),
    async (emulatorPort) => {
      await withRelayTestBroker(
        emulatorPort,
        "grant-death-graceful",
        async ({ listenerPort, state }) => {
          const dial = await claimAndDialRelay(state, listenerPort, "grant-death-graceful");
          dial.socket.end();
          await emulatorClosed;
          assert.deepEqual(order, ["write:relay_close"], "a graceful end must report a DIFFERENT trigger than the abrupt (RST) case");
        },
        deps,
      );
    },
  );
});

test("handleRelayDeath: a second close for the same grant and channel after a teardown has started does nothing and writes no second record", async () => {
  let writeCount = 0;
  let clearCount = 0;
  const deps: TestHandleRelayDeathDeps = {
    writeIncident: (record) => {
      writeCount += 1;
      return `/fake/incident/${writeCount}.md`;
    },
    clearClaim: () => {
      clearCount += 1;
    },
  };
  let resolveEmulatorClosed: () => void = () => {};
  const emulatorClosed = new Promise<void>((resolve) => {
    resolveEmulatorClosed = resolve;
  });
  await withStubEmulatorServer(
    (socket) => socket.once("close", () => resolveEmulatorClosed()),
    async (emulatorPort) => {
      await withRelayTestBroker(
        emulatorPort,
        "grant-death-double",
        async ({ listenerPort, state }) => {
          const dial = await claimAndDialRelay(state, listenerPort, "grant-death-double");
          dial.socket.resetAndDestroy();
          await emulatorClosed;
          assert.equal(writeCount, 1);
          assert.equal(clearCount, 1);

          // Second observation for the SAME (already-torn-down) session:
          // call handleRelayDeath() directly (the session is already gone
          // from the map by this point) -- this is exactly what a second,
          // late-arriving "error"/"close" event on an already-destroyed
          // socket would drive in production. (The FIRST layer of this same
          // guard -- spliceRelay()'s own per-session `deathReported` latch,
          // which absorbs the emulator leg's own "close" once close() has
          // already destroyed it -- is already proven by every OTHER test
          // in this section: each asserts EXACTLY one write, even though
          // close() always destroys both legs and therefore always fires a
          // second "close" event internally.)
          handleRelayDeath("grant-death-double", "binary", "relay_error", state, deps);
          assert.equal(writeCount, 1, "a second death observation for an already-torn-down channel must write no second record");
          assert.equal(clearCount, 1, "a second death observation for an already-torn-down channel must clear no second claim");
        },
        deps,
      );
    },
  );
});

test("handleRelayDeath: a relay death on one grant leaves the other grant's relay open and still able to carry bytes", async () => {
  let emulatorASocket: Socket | null = null;
  let emulatorBSocket: Socket | null = null;
  let resolveAAccepted: () => void = () => {};
  let resolveBAccepted: () => void = () => {};
  const aAccepted = new Promise<void>((resolve) => {
    resolveAAccepted = resolve;
  });
  const bAccepted = new Promise<void>((resolve) => {
    resolveBAccepted = resolve;
  });
  await withStubEmulatorServer(
    (socket) => {
      emulatorASocket = socket;
      resolveAAccepted();
    },
    async (emulatorPortA) => {
      await withStubEmulatorServer(
        (socket) => {
          emulatorBSocket = socket;
          resolveBAccepted();
        },
        async (emulatorPortB) => {
          await withMultiRelayTestBroker(
            [
              { port: emulatorPortA, targetId: "grant-death-multi-a" },
              { port: emulatorPortB, targetId: "grant-death-multi-b" },
            ],
            async ({ listenerPort, state }) => {
              const dialA = await claimAndDialRelay(state, listenerPort, "grant-death-multi-a");
              const dialB = await claimAndDialRelay(state, listenerPort, "grant-death-multi-b");

              // The "attached" reply the client just received is written
              // BEFORE the broker's own dial to the (stub) emulator has
              // necessarily finished its TCP handshake -- awaiting
              // acceptance here, rather than asserting synchronously, is
              // what makes this deterministic instead of racy.
              await Promise.all([aAccepted, bAccepted]);

              let resolveBGot: () => void = () => {};
              const bGot = new Promise<void>((resolve) => {
                resolveBGot = resolve;
              });
              const receivedB: Buffer[] = [];
              emulatorBSocket!.on("data", (chunk: Buffer) => {
                receivedB.push(Buffer.from(chunk));
                resolveBGot();
              });

              // The test's own dial.socket closing merely confirms the LOCAL
              // (test-side) leg has torn down -- it says nothing about
              // whether the BROKER has finished its own teardown (evidence
              // write, claim clear, session.close()) yet. The broker's own
              // emulator-A leg closing is the reliable completion signal:
              // session.close() is what destroys it, and nothing else in
              // this test ever touches it.
              assert.ok(emulatorASocket, "the stub emulator A must have accepted a connection by now");
              const emulatorAClosed = new Promise<void>((resolve) => emulatorASocket!.once("close", () => resolve()));
              dialA.socket.resetAndDestroy();
              await emulatorAClosed;

              assert.ok(!state.relaySessions.has(relaySessionKey("grant-death-multi-a", "binary")), "grant A's session must be torn down");
              assert.ok(state.relaySessions.has(relaySessionKey("grant-death-multi-b", "binary")), "grant B's session must be UNTOUCHED by grant A's death");
              assert.ok(!dialB.socket.destroyed, "grant B's own relay socket must still be open");

              // Sent client -> emulator (the direction the relay actually
              // carries) -- asserted at the EMULATOR B side, mirroring
              // Plan 63-01's own concurrency test shape.
              const payload = Buffer.from("still-alive-B", "utf8");
              dialB.socket.write(payload);
              await bGot;
              assert.ok(Buffer.concat(receivedB).equals(payload), "grant B's relay must still carry bytes after grant A's own death");

              dialB.socket.end();
            },
          );
        },
      );
    },
  );
});

test("handleRelayDeath: the instance record is still present at its port and the grant is still in the grant map after a relay death", async () => {
  let resolveEmulatorClosed: () => void = () => {};
  const emulatorClosed = new Promise<void>((resolve) => {
    resolveEmulatorClosed = resolve;
  });
  await withStubEmulatorServer(
    (socket) => socket.once("close", () => resolveEmulatorClosed()),
    async (emulatorPort) => {
      await withRelayTestBroker(emulatorPort, "grant-death-survives", async ({ listenerPort, state }) => {
        const dial = await claimAndDialRelay(state, listenerPort, "grant-death-survives");
        dial.socket.resetAndDestroy();
        await emulatorClosed;

        assert.ok(state.instances.has(emulatorPort), "the instance record must survive a relay death (SESS-03: channel-scoped, never an instance kill)");
        assert.ok(state.grants.has("grant-death-survives"), "the grant must survive a relay death");
      });
    },
  );
});

test("handleRelayDeath: a death with a declared operation marks the run void; a death with none records the absence and does not mark it void", async () => {
  for (const [targetId, declareOp] of [
    ["grant-death-void", true],
    ["grant-death-not-void", false],
  ] as const) {
    const incidentsDir = mkdtempSync(join(tmpdir(), "vice-relay-death-void-"));
    let capturedPath = "";
    const deps: TestHandleRelayDeathDeps = {
      writeIncident: (record) => {
        capturedPath = writeBrokerIncident(record, { dir: incidentsDir });
        return capturedPath;
      },
    };
    let resolveEmulatorClosed: () => void = () => {};
    const emulatorClosed = new Promise<void>((resolve) => {
      resolveEmulatorClosed = resolve;
    });
    try {
      await withStubEmulatorServer(
        (socket) => socket.once("close", () => resolveEmulatorClosed()),
        async (emulatorPort) => {
          await withRelayTestBroker(
            emulatorPort,
            targetId,
            async ({ listenerPort, state }) => {
              if (declareOp) {
                const grant = state.grants.get(targetId);
                assert.ok(grant, "the fixture must have created a grant for this target id");
                if (grant) grant.operation = { name: "vice_memory_read", declaredAt: Date.now() };
              }
              const dial = await claimAndDialRelay(state, listenerPort, targetId);
              dial.socket.resetAndDestroy();
              await emulatorClosed;
            },
            deps,
          );
        },
      );
      assert.ok(capturedPath, "expected an incident record to have been written");
      const content = readFileSync(capturedPath, "utf8");
      if (declareOp) {
        assert.match(content, /^operation: 'vice_memory_read'$/m, "a declared operation must be named in the record");
        assert.match(content, /^void: true$/m, "a death with a declared operation must mark the run void");
      } else {
        assert.match(content, /^operation: null$/m, "an absent operation must be recorded explicitly, never fabricated");
        assert.match(content, /^void: false$/m, "a death with nothing declared must NOT be marked void");
      }
    } finally {
      rmSync(incidentsDir, { recursive: true, force: true });
    }
  }
});

// ===========================================================================
// Plan 63-04, Task 2 (SESS-04): a bound the broker owns, and a probe it
// honestly does not.
// ===========================================================================

/** A fully injected, no-wall-clock idle timer: `advance(deltaMs)` moves a
 * FAKE elapsed-idle clock forward and fires `onExpire()` the instant it
 * reaches (never merely exceeds) the armed bound -- proving the "at-or-past,
 * never strictly past" comparison this whole mechanism depends on with no
 * real timer at all. `activity()`/`onActivity()` both reset elapsed to zero,
 * mirroring ArmedIdleTimer's own contract; both are no-ops while suspended. */
interface FakeIdleTimer {
  armIdleTimer: ArmIdleTimerFn;
  advance(deltaMs: number): void;
  activity(): void;
  readonly suspendCount: number;
  readonly resumeCount: number;
}

function makeFakeIdleTimer(): FakeIdleTimer {
  let onExpire: (() => void) | null = null;
  let ms = 0;
  let elapsed = 0;
  let suspended = false;
  let suspendCount = 0;
  let resumeCount = 0;
  const armIdleTimer: ArmIdleTimerFn = (opts) => {
    onExpire = opts.onExpire;
    ms = opts.ms;
    elapsed = 0;
    suspended = false;
    const handle: ArmedIdleTimer = {
      suspend: () => {
        suspended = true;
        suspendCount += 1;
      },
      resume: () => {
        suspended = false;
        elapsed = 0;
        resumeCount += 1;
      },
      onActivity: () => {
        if (!suspended) elapsed = 0;
      },
    };
    return handle;
  };
  return {
    armIdleTimer,
    advance(deltaMs: number) {
      if (suspended) return;
      elapsed += deltaMs;
      if (elapsed >= ms) onExpire?.();
    },
    activity() {
      if (!suspended) elapsed = 0;
    },
    get suspendCount() {
      return suspendCount;
    },
    get resumeCount() {
      return resumeCount;
    },
  };
}

test("spliceRelay/handleRelayDeath: with an injected timer, an interval exactly equal to the bound fires and one tick short does not", async () => {
  let writeCount = 0;
  let lastTrigger: unknown = null;
  const fake = makeFakeIdleTimer();
  const deps: TestHandleRelayDeathDeps = {
    idleMs: 100,
    armIdleTimer: fake.armIdleTimer,
    writeIncident: (record) => {
      writeCount += 1;
      lastTrigger = record.trigger;
      return "/fake/incident/path.md";
    },
  };
  await withStubEmulatorServer(
    () => {},
    async (emulatorPort) => {
      await withRelayTestBroker(
        emulatorPort,
        "grant-idle-boundary",
        async ({ listenerPort, state }) => {
          await claimAndDialRelay(state, listenerPort, "grant-idle-boundary");

          fake.advance(99);
          assert.equal(writeCount, 0, "one tick short of the bound must NOT fire");

          fake.advance(1); // now exactly at the bound
          assert.equal(writeCount, 1, "reaching the bound EXACTLY must fire -- at-or-past, never strictly past");
          assert.equal(lastTrigger, "relay_idle_expiry");
          assert.ok(!state.relaySessions.has(relaySessionKey("grant-idle-boundary", "binary")), "the fired deadline must run the same single teardown as any other death");
        },
        deps,
      );
    },
  );
});

test("spliceRelay: a byte in either direction resets the measured idle interval to zero", async () => {
  let writeCount = 0;
  let resolveReceived: () => void = () => {};
  const received = new Promise<void>((resolve) => {
    resolveReceived = resolve;
  });
  const fake = makeFakeIdleTimer();
  const deps: TestHandleRelayDeathDeps = {
    idleMs: 100,
    armIdleTimer: fake.armIdleTimer,
    writeIncident: () => {
      writeCount += 1;
      return "/fake/incident/path.md";
    },
  };
  await withStubEmulatorServer(
    (socket) => socket.once("data", () => resolveReceived()),
    async (emulatorPort) => {
      await withRelayTestBroker(
        emulatorPort,
        "grant-idle-reset",
        async ({ listenerPort, state }) => {
          const dial = await claimAndDialRelay(state, listenerPort, "grant-idle-reset");

          fake.advance(60);
          assert.equal(writeCount, 0, "60ms of a 100ms bound must not fire yet");

          // A byte flowing client -> emulator resets the countdown --
          // production wires this through the SAME "data" listener that
          // already counts bytes: spliceRelay()'s own idleTimer?.onActivity()
          // call runs on the broker's OWN accepted clientSocket the instant
          // this write arrives there, calling straight into the fake's own
          // shared closure state (never a second, test-only reset call) --
          // awaiting the stub emulator's own receipt is what proves the
          // broker-side "data" listener already ran by the time this
          // assertion continues.
          dial.socket.write(Buffer.from("reset-me", "utf8"));
          await received;

          fake.advance(60);
          assert.equal(writeCount, 0, "after a reset, 60ms more (120ms total, but only 60ms since the reset) must still not fire");

          fake.advance(40);
          assert.equal(writeCount, 1, "100ms measured FROM THE RESET must fire");
          assert.ok(!state.relaySessions.has(relaySessionKey("grant-idle-reset", "binary")));
        },
        deps,
      );
    },
  );
});

test("resolveRelayIdleMs/resolveRelayKeepAliveMs: a raw bound of zero, of a negative number and of a non-numeric string each resolve to the default and each log the rejected raw value", () => {
  const prevIdle = process.env.VICE_BROKER_RELAY_IDLE_MS;
  const prevKeepalive = process.env.VICE_BROKER_RELAY_KEEPALIVE_MS;
  const originalError = console.error;
  const logged: string[] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  try {
    for (const bad of ["0", "-5", "not-a-number"]) {
      logged.length = 0;
      process.env.VICE_BROKER_RELAY_IDLE_MS = bad;
      assert.equal(resolveRelayIdleMs(), DEFAULT_RELAY_IDLE_MS, `a raw idle bound of ${JSON.stringify(bad)} must resolve to the default`);
      assert.ok(
        logged.some((line) => line.includes("VICE_BROKER_RELAY_IDLE_MS") && line.includes(bad)),
        `the rejected raw value ${JSON.stringify(bad)} must be logged by name -- got: ${JSON.stringify(logged)}`,
      );

      logged.length = 0;
      process.env.VICE_BROKER_RELAY_KEEPALIVE_MS = bad;
      assert.equal(resolveRelayKeepAliveMs(), DEFAULT_RELAY_KEEPALIVE_MS, `a raw keepalive bound of ${JSON.stringify(bad)} must resolve to the default`);
      assert.ok(
        logged.some((line) => line.includes("VICE_BROKER_RELAY_KEEPALIVE_MS") && line.includes(bad)),
        `the rejected raw value ${JSON.stringify(bad)} must be logged by name -- got: ${JSON.stringify(logged)}`,
      );
    }
    // Absent entirely must ALSO resolve to the default, with no log line.
    delete process.env.VICE_BROKER_RELAY_IDLE_MS;
    delete process.env.VICE_BROKER_RELAY_KEEPALIVE_MS;
    logged.length = 0;
    assert.equal(resolveRelayIdleMs(), DEFAULT_RELAY_IDLE_MS);
    assert.equal(resolveRelayKeepAliveMs(), DEFAULT_RELAY_KEEPALIVE_MS);
    assert.deepEqual(logged, [], "an ABSENT override is not a rejection and must not be logged");
  } finally {
    console.error = originalError;
    if (prevIdle === undefined) delete process.env.VICE_BROKER_RELAY_IDLE_MS;
    else process.env.VICE_BROKER_RELAY_IDLE_MS = prevIdle;
    if (prevKeepalive === undefined) delete process.env.VICE_BROKER_RELAY_KEEPALIVE_MS;
    else process.env.VICE_BROKER_RELAY_KEEPALIVE_MS = prevKeepalive;
  }
});

test("handleOperationNote: declaring an operation suspends the idle deadline on that grant's live sessions and clearing it resumes them", async () => {
  const fake = makeFakeIdleTimer();
  const deps: TestHandleRelayDeathDeps = { idleMs: 100, armIdleTimer: fake.armIdleTimer };
  await withStubEmulatorServer(
    () => {},
    async (emulatorPort) => {
      await withRelayTestBroker(
        emulatorPort,
        "grant-suspend-resume",
        async ({ listenerPort, state }) => {
          await claimAndDialRelay(state, listenerPort, "grant-suspend-resume");

          const declareOutcome = handleOperationNote("grant-suspend-resume", "binary", "vice_memory_read", state);
          assert.ok(declareOutcome.ok);
          assert.equal(fake.suspendCount, 1, "a declaration must suspend the deadline on the grant's live relay session");

          // While suspended, even a long idle interval must never fire.
          fake.advance(1000);

          const clearOutcome = handleOperationNote("grant-suspend-resume", "binary", null, state);
          assert.ok(clearOutcome.ok);
          assert.equal(fake.resumeCount, 1, "clearing the declaration must resume the deadline");
        },
        deps,
      );
    },
  );
});

test("handleOperationNote: a grant with no live relay session on a channel has nothing to suspend or resume there -- never an error", () => {
  const state = setupBrokerState(6600, "grant-no-session");
  const outcome = handleOperationNote("grant-no-session", "binary", "vice_memory_read", state);
  assert.ok(outcome.ok, "declaring an operation for a grant with no attached relay must still succeed");
});

test("handleRelayDeath: a fired deadline produces one incident record with the idle trigger, clears the claim, and leaves the instance record present", async () => {
  const fake = makeFakeIdleTimer();
  let capturedRecord: BrokerIncidentInput | null = null;
  const deps: TestHandleRelayDeathDeps = {
    idleMs: 50,
    armIdleTimer: fake.armIdleTimer,
    writeIncident: (record) => {
      capturedRecord = record;
      return "/fake/incident/path.md";
    },
  };
  await withStubEmulatorServer(
    () => {},
    async (emulatorPort) => {
      await withRelayTestBroker(
        emulatorPort,
        "grant-idle-fired",
        async ({ listenerPort, state }) => {
          await claimAndDialRelay(state, listenerPort, "grant-idle-fired");
          fake.advance(50);

          assert.ok(capturedRecord, "exactly one incident record must have been written");
          assert.equal(capturedRecord!.trigger, "relay_idle_expiry");
          assert.equal(state.instances.get(emulatorPort)?.monitorClients.binary, undefined, "the channel's own claim must be cleared");
          assert.ok(state.instances.has(emulatorPort), "the instance record must still be present -- an idle expiry tears down exactly one channel, never the instance");
          assert.ok(state.grants.has("grant-idle-fired"), "the grant must still be present");
        },
        deps,
      );
    },
  );
});

test("handleRelayDeath: a writer that throws stops the teardown before any claim is cleared", async () => {
  let clearCalled = false;
  const deps: TestHandleRelayDeathDeps = {
    writeIncident: () => {
      throw new Error("simulated disk failure");
    },
    clearClaim: () => {
      clearCalled = true;
    },
  };
  await withStubEmulatorServer(
    () => {},
    async (emulatorPort) => {
      await withRelayTestBroker(emulatorPort, "grant-death-throws", async ({ listenerPort, state }) => {
        await claimAndDialRelay(state, listenerPort, "grant-death-throws");
        assert.ok(state.relaySessions.has(relaySessionKey("grant-death-throws", "binary")));

        assert.throws(
          () => handleRelayDeath("grant-death-throws", "binary", "relay_error", state, deps),
          /simulated disk failure/,
          "a throwing writer must propagate, not be swallowed",
        );
        assert.equal(clearCalled, false, "the claim must NEVER be cleared when the incident write itself failed");
        assert.ok(
          state.relaySessions.has(relaySessionKey("grant-death-throws", "binary")),
          "the session must remain in the map -- nothing was released because evidence could not be written",
        );
      });
    },
  );
});

// ===========================================================================
// Plan 63-04, Task 3 (SESS-05): evidence before the instance kill, and one
// teardown when two triggers race.
// ===========================================================================

test("handleRelease: a control-connection close with a declared operation writes exactly one record with the control-close trigger before the kill recorder is called", () => {
  const order: string[] = [];
  const state = setupBrokerState(16601, "grant-release-void");
  const grant = state.grants.get("grant-release-void")!;
  grant.operation = { name: "vice_capture_run", declaredAt: Date.now() };
  const deps: TestHandleReleaseDeps = {
    writeIncident: (record) => {
      order.push(`write:${String(record.trigger)}`);
      return "/fake/incident/path.md";
    },
    kill: async () => {
      order.push("kill");
      return "sigterm";
    },
  };
  handleRelease("grant-release-void", state, deps);
  assert.deepEqual(order, ["write:control_close", "kill"], "the record must be written strictly BEFORE the kill is even invoked");
  assert.ok(!state.grants.has("grant-release-void"), "the grant must be removed");
  assert.ok(!state.instances.has(16601), "the instance record must be removed");
});

test("handleRelease: a control-connection close with nothing declared writes no record and still kills exactly as it did before", () => {
  let writeCount = 0;
  let killCalled = false;
  const state = setupBrokerState(16602, "grant-release-quiet");
  const deps: TestHandleReleaseDeps = {
    writeIncident: () => {
      writeCount += 1;
      return "/fake.md";
    },
    kill: async () => {
      killCalled = true;
      return "sigterm";
    },
  };
  handleRelease("grant-release-quiet", state, deps);
  assert.equal(writeCount, 0, "a release with nothing declared must write no incident record");
  assert.ok(killCalled, "the release must still kill exactly as before");
  assert.ok(!state.grants.has("grant-release-quiet"));
});

test("handleRelease: the mismatched-occupant branch writes no record, signals nothing and still logs distinctly", () => {
  let writeCount = 0;
  let killCalled = false;
  const state = createBrokerState();
  state.instances.set(16603, makeGrantedInstance(16603, { pid: 9999 }));
  state.grants.set("grant-release-mismatch", {
    id: "grant-release-mismatch",
    port: 16603,
    grantedAt: Date.now(),
    pid: 4242, // deliberately DIFFERENT from the instance's own recorded pid
    operation: { name: "vice_capture_run", declaredAt: Date.now() },
    sessionLabel: null,
  });
  const deps: TestHandleReleaseDeps = {
    writeIncident: () => {
      writeCount += 1;
      return "/fake.md";
    },
    kill: async () => {
      killCalled = true;
      return "sigterm";
    },
  };
  const originalWrite = process.stderr.write.bind(process.stderr);
  let loggedDistinctly = false;
  process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    if (typeof chunk === "string" && chunk.includes("found a different instance at port")) loggedDistinctly = true;
    return (originalWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stderr.write;
  try {
    handleRelease("grant-release-mismatch", state, deps);
  } finally {
    process.stderr.write = originalWrite;
  }
  assert.equal(writeCount, 0, "the mismatched-occupant branch must write no record even though this grant HAS a declared operation");
  assert.equal(killCalled, false, "the mismatched-occupant branch must signal nothing");
  assert.ok(loggedDistinctly, "the mismatched-occupant branch must still log distinctly");
  assert.ok(!state.grants.has("grant-release-mismatch"), "the grant's own bookkeeping must still be retired");
  assert.ok(state.instances.has(16603), "the mismatched occupant must be left running, untouched");
});

// ===========================================================================
// Plan 63-07 (gap closure, SESS-05): the two deliberate-teardown paths must
// clear state.relaySessions BEFORE the process is signalled, so the kill's
// own later asynchronous socket close finds nothing left to report.
// ===========================================================================

test("handleRelease: a release with a LIVE relay session attached tears it down, writes no record, and the async socket close that follows writes no second record", () => {
  const state = setupBrokerState(16610, "grant-release-live-relay");
  const { session, closeCalls } = makeStandInRelaySession();
  state.relaySessions.set(relaySessionKey("grant-release-live-relay", "binary"), session);

  let writeCount = 0;
  const writeIncident = () => {
    writeCount += 1;
    return "/fake.md";
  };
  let killCalled = false;
  handleRelease("grant-release-live-relay", state, {
    writeIncident,
    kill: async () => {
      killCalled = true;
      return "sigterm";
    },
  });

  assert.equal(writeCount, 0, "a release of a grant with a live relay session but no declared operation must write no record");
  assert.ok(killCalled, "the release must still kill exactly as before");
  assert.ok(
    !state.relaySessions.has(relaySessionKey("grant-release-live-relay", "binary")),
    "the relay session entry must be gone from state.relaySessions",
  );
  assert.deepEqual(closeCalls, ["relay_close"], "the stand-in's close() must be called exactly once");

  // Stands in for the emulator kill's own later, asynchronous socket close
  // re-entering handleRelayDeath() for the same grant and channel.
  handleRelayDeath("grant-release-live-relay", "binary", "relay_close", state, { writeIncident });
  assert.equal(writeCount, 0, "the async socket close that follows must find the map entry already gone and write no second record");
});

test("handleRelease: the mismatched-occupant branch also tears the grant's relay sessions down and still leaves the occupant's instance record in place", () => {
  const state = createBrokerState();
  state.instances.set(16611, makeGrantedInstance(16611, { pid: 9999 }));
  state.grants.set("grant-release-mismatch-relay", {
    id: "grant-release-mismatch-relay",
    port: 16611,
    grantedAt: Date.now(),
    pid: 4242, // deliberately DIFFERENT from the instance's own recorded pid
    operation: null,
    sessionLabel: null,
  });
  const { session, closeCalls } = makeStandInRelaySession();
  state.relaySessions.set(relaySessionKey("grant-release-mismatch-relay", "text"), session);

  let writeCount = 0;
  let killCalled = false;
  handleRelease("grant-release-mismatch-relay", state, {
    writeIncident: () => {
      writeCount += 1;
      return "/fake.md";
    },
    kill: async () => {
      killCalled = true;
      return "sigterm";
    },
  });

  assert.equal(writeCount, 0, "the mismatched-occupant branch must still write no record");
  assert.equal(killCalled, false, "the mismatched-occupant branch must still signal nothing");
  assert.ok(
    !state.relaySessions.has(relaySessionKey("grant-release-mismatch-relay", "text")),
    "the grant's own relay session must be torn down even on the mismatch branch",
  );
  assert.deepEqual(closeCalls, ["relay_close"], "the stand-in's close() must be called exactly once");
  assert.ok(!state.grants.has("grant-release-mismatch-relay"), "the grant's own bookkeeping must still be retired");
  assert.ok(state.instances.has(16611), "the mismatched occupant's instance record must be left running, untouched");
});

test("tearDownRelaySessionsForGrant enumerates every MONITOR_CHANNELS value, so a third channel could never be silently skipped", () => {
  const state = setupBrokerState(16614, "grant-enumerate-channels");
  const closeCallsByChannel = new Map<MonitorChannel, RelayDeathTrigger[]>();
  for (const ch of MONITOR_CHANNELS) {
    const { session, closeCalls } = makeStandInRelaySession();
    state.relaySessions.set(relaySessionKey("grant-enumerate-channels", ch), session);
    closeCallsByChannel.set(ch, closeCalls);
  }

  const torn = tearDownRelaySessionsForGrant("grant-enumerate-channels", state);

  assert.equal(torn.length, MONITOR_CHANNELS.length, "must tear down exactly one entry per MONITOR_CHANNELS value");
  assert.deepEqual(torn, [...MONITOR_CHANNELS], "the returned array must equal MONITOR_CHANNELS itself, in order");
  assert.equal(state.relaySessions.size, 0, "every channel's entry must be removed");
  for (const ch of MONITOR_CHANNELS) {
    assert.deepEqual(closeCallsByChannel.get(ch), ["relay_close"], `channel ${ch}'s stand-in close() must have been called exactly once`);
  }
});

// ===========================================================================
// Plan 63-11 (gap closure, SESS-05): handleMonitorRelease()'s per-channel
// teardown -- isolation, recorded order, the no-session and idempotent-
// repeat cases, and the two refused-release paths that must tear down
// nothing at all.
// ===========================================================================

test("handleMonitorRelease: releasing one channel leaves the grant's OTHER channel's live relay session untouched", () => {
  const targetId = "grant-63-11-isolation";
  const state = setupBrokerState(16620, targetId);
  const sessionsByChannel = new Map<MonitorChannel, { session: RelaySession; closeCalls: RelayDeathTrigger[] }>();
  for (const ch of MONITOR_CHANNELS) {
    const claimOutcome = handleMonitorClaim(`claim-63-11-isolation-${ch}`, targetId, ch, state);
    assert.ok(claimOutcome.ok, `expected the claim to succeed for channel ${ch}: ${JSON.stringify(claimOutcome)}`);
    const stand = makeStandInRelaySession();
    state.relaySessions.set(relaySessionKey(targetId, ch), stand.session);
    sessionsByChannel.set(ch, stand);
  }

  // Selected by iterating MONITOR_CHANNELS rather than naming either
  // channel as a bare literal, so a third channel value could never be
  // silently skipped by this assertion.
  const [releasedChannel, retainedChannel] = [...MONITOR_CHANNELS];
  assert.ok(releasedChannel && retainedChannel, "MONITOR_CHANNELS must carry at least two entries for this isolation case to mean anything");

  const releaseOutcome = handleMonitorRelease("release-63-11-isolation", targetId, releasedChannel, state);
  assert.ok(releaseOutcome.ok, `expected the release to succeed: ${JSON.stringify(releaseOutcome)}`);

  assert.ok(!state.relaySessions.has(relaySessionKey(targetId, releasedChannel)), `the released channel (${releasedChannel})'s own relay session must be gone`);
  assert.ok(
    state.relaySessions.has(relaySessionKey(targetId, retainedChannel)),
    `the grant's OTHER channel (${retainedChannel}) must keep its live relay session -- a per-channel release is never a grant-level teardown`,
  );
  assert.deepEqual(sessionsByChannel.get(releasedChannel)!.closeCalls, ["relay_close"], "the released channel's stand-in close() must be called exactly once");
  assert.deepEqual(sessionsByChannel.get(retainedChannel)!.closeCalls, [], "the retained channel's stand-in close() must never be called");
});

test("handleMonitorRelease: deletes the relay-session map entry BEFORE calling the session's own close() -- proven from inside close() itself", () => {
  const targetId = "grant-63-11-order";
  const state = setupBrokerState(16621, targetId);
  const channel: MonitorChannel = "text";
  const claimOutcome = handleMonitorClaim("claim-63-11-order", targetId, channel, state);
  assert.ok(claimOutcome.ok);

  const observedFromInsideClose: boolean[] = [];
  const session: RelaySession = {
    emulatorSocket: new NodeNetSocket(),
    close: () => {
      observedFromInsideClose.push(state.relaySessions.has(relaySessionKey(targetId, channel)));
    },
    suspendIdle: () => {},
    resumeIdle: () => {},
    bytesClientToEmulator: () => 0,
    bytesEmulatorToClient: () => 0,
  };
  state.relaySessions.set(relaySessionKey(targetId, channel), session);

  const releaseOutcome = handleMonitorRelease("release-63-11-order", targetId, channel, state);
  assert.ok(releaseOutcome.ok, `expected the release to succeed: ${JSON.stringify(releaseOutcome)}`);
  assert.deepEqual(
    observedFromInsideClose,
    [false],
    "the map entry must already be absent from INSIDE close() itself -- the delete precedes the close, proven by observation, not inferred from reading the source",
  );

  let writeCount = 0;
  handleRelayDeath(targetId, channel, "relay_close", state, {
    writeIncident: () => {
      writeCount += 1;
      return "/fake.md";
    },
  });
  assert.equal(writeCount, 0, "a re-entrant handleRelayDeath() call for the released channel immediately after the release must write nothing -- the entry is already gone");
});

test("handleMonitorRelease: a channel with no live relay session returns ok, closes nothing, and writes nothing", () => {
  const targetId = "grant-63-11-no-session";
  const state = setupBrokerState(16622, targetId);
  const channel: MonitorChannel = "binary";
  const claimOutcome = handleMonitorClaim("claim-63-11-no-session", targetId, channel, state);
  assert.ok(claimOutcome.ok);
  // Never attached -- state.relaySessions carries no entry for this pair.
  assert.equal(tearDownRelaySessionForChannel(targetId, channel, state), false, "the primitive itself must report no live session to tear down");

  const releaseOutcome = handleMonitorRelease("release-63-11-no-session", targetId, channel, state);
  assert.ok(releaseOutcome.ok, `expected ok: ${JSON.stringify(releaseOutcome)}`);
  assert.equal(state.relaySessions.size, 0, "there was nothing to remove, and there is still nothing");

  let writeCount = 0;
  handleRelayDeath(targetId, channel, "relay_close", state, {
    writeIncident: () => {
      writeCount += 1;
      return "/fake.md";
    },
  });
  assert.equal(writeCount, 0, "no live session ever existed, so a later relay death for the same pair has nothing to find and writes nothing");
});

test("handleMonitorRelease: a repeated release of an already-released channel returns ok and tears nothing down a second time", () => {
  const targetId = "grant-63-11-idempotent";
  const state = setupBrokerState(16623, targetId);
  const channel: MonitorChannel = "text";
  const claimOutcome = handleMonitorClaim("claim-63-11-idempotent", targetId, channel, state);
  assert.ok(claimOutcome.ok);
  const { session, closeCalls } = makeStandInRelaySession();
  state.relaySessions.set(relaySessionKey(targetId, channel), session);

  const first = handleMonitorRelease("release-63-11-idempotent-1", targetId, channel, state);
  assert.ok(first.ok, `expected the first release to succeed: ${JSON.stringify(first)}`);
  assert.deepEqual(closeCalls, ["relay_close"]);

  const second = handleMonitorRelease("release-63-11-idempotent-2", targetId, channel, state);
  assert.ok(second.ok, `expected the repeated release to still succeed: ${JSON.stringify(second)}`);
  assert.deepEqual(closeCalls, ["relay_close"], "a repeated release must not call close() a second time");
  assert.equal(state.relaySessions.size, 0);
});

test("handleMonitorRelease: a release from a grant that is NOT the channel's current holder is denied and leaves the holder's live session open", () => {
  const port = 16624;
  const state = createBrokerState();
  state.instances.set(port, makeGrantedInstance(port));
  const holderId = "grant-63-11-holder";
  const spooferId = "grant-63-11-spoofer";
  state.grants.set(holderId, { id: holderId, port, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });
  // A different grant that nonetheless resolves to the SAME instance --
  // resolveInstanceForMonitorTarget() looks the port up via state.grants,
  // so two grants can legitimately share one instance in this fixture.
  state.grants.set(spooferId, { id: spooferId, port, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });

  const channel: MonitorChannel = "text";
  const claimOutcome = handleMonitorClaim("claim-63-11-holder", holderId, channel, state);
  assert.ok(claimOutcome.ok, `expected the holder's claim to succeed: ${JSON.stringify(claimOutcome)}`);
  const { session, closeCalls } = makeStandInRelaySession();
  state.relaySessions.set(relaySessionKey(holderId, channel), session);

  const releaseOutcome = handleMonitorRelease("release-63-11-spoofed", spooferId, channel, state);
  assert.equal(releaseOutcome.ok, false, `a non-holder release must be denied: ${JSON.stringify(releaseOutcome)}`);
  if (!releaseOutcome.ok) assert.equal(releaseOutcome.code, "denied");

  assert.ok(
    state.relaySessions.has(relaySessionKey(holderId, channel)),
    "a spoofed release must not be able to destroy the holder's live connection -- the map entry must survive a denied release",
  );
  assert.deepEqual(closeCalls, [], "the holder's stand-in close() must never run on a refused release");
});

test("handleMonitorRelease: a release naming an unresolvable target is bad_request and leaves every live session open", () => {
  const targetId = "grant-63-11-real";
  const state = setupBrokerState(16625, targetId);
  const channel: MonitorChannel = "binary";
  const claimOutcome = handleMonitorClaim("claim-63-11-real", targetId, channel, state);
  assert.ok(claimOutcome.ok);
  const { session, closeCalls } = makeStandInRelaySession();
  state.relaySessions.set(relaySessionKey(targetId, channel), session);

  const releaseOutcome = handleMonitorRelease("release-63-11-unknown", "grant-63-11-does-not-exist", channel, state);
  assert.equal(releaseOutcome.ok, false, `an unresolvable target must be refused: ${JSON.stringify(releaseOutcome)}`);
  if (!releaseOutcome.ok) assert.equal(releaseOutcome.code, "bad_request");

  assert.equal(state.relaySessions.size, 1, "every live session must be left untouched by a bad_request release");
  assert.deepEqual(closeCalls, [], "no stand-in's close() may run on a bad_request release");
});

test("handleRelayDeath: an idle deadline and a socket close in the same turn produce exactly one record and one claim clear, with a deterministic trigger across repeated runs", async () => {
  for (let iteration = 0; iteration < 5; iteration++) {
    const order: string[] = [];
    const fake = makeFakeIdleTimer();
    const targetId = `grant-race-ordering-${iteration}`;
    const deps: TestHandleRelayDeathDeps = {
      idleMs: 100,
      armIdleTimer: fake.armIdleTimer,
      writeIncident: (record) => {
        order.push(`write:${String(record.trigger)}`);
        return "/fake/incident/path.md";
      },
      clearClaim: () => {
        order.push("clear");
      },
    };
    await withStubEmulatorServer(
      () => {},
      async (emulatorPort) => {
        await withRelayTestBroker(
          emulatorPort,
          targetId,
          async ({ listenerPort, state }) => {
            const dial = await claimAndDialRelay(state, listenerPort, targetId);

            // Both triggers land in the SAME synchronous turn: the idle
            // deadline fires FIRST (advance() runs the whole teardown
            // synchronously, including idleTimer.suspend() inside
            // session.close()), and the socket-close attempt that follows
            // immediately finds a socket ALREADY destroyed by that
            // teardown -- a safe no-op, never a second report. Node's own
            // single-threaded event loop is what makes this deterministic:
            // there is no interleaving possible between two synchronous
            // statements.
            fake.advance(100);
            dial.socket.resetAndDestroy();

            assert.deepEqual(order, ["write:relay_idle_expiry", "clear"], `iteration ${iteration}: exactly one record and one claim clear, deterministically the idle trigger`);
          },
          deps,
        );
      },
    );
  }
});

test("handleRelayDeath: two channels of one grant dropping together produce one record each; the same channel dropping twice produces one record total", async () => {
  const written: Array<{ channel: unknown; trigger: unknown }> = [];
  const deps: TestHandleRelayDeathDeps = {
    writeIncident: (record) => {
      written.push({ channel: record.channel, trigger: record.trigger });
      return `/fake/incident/${written.length}.md`;
    },
  };
  let resolveBinaryClosed: () => void = () => {};
  let resolveTextClosed: () => void = () => {};
  const binaryClosed = new Promise<void>((resolve) => {
    resolveBinaryClosed = resolve;
  });
  const textClosed = new Promise<void>((resolve) => {
    resolveTextClosed = resolve;
  });
  await withStubEmulatorServer(
    (socket) => socket.once("close", () => resolveBinaryClosed()),
    async (binaryPort) => {
      await withStubEmulatorServer(
        (socket) => socket.once("close", () => resolveTextClosed()),
        async (textPort) => {
          const state = createBrokerState();
          state.instances.set(binaryPort, makeGrantedInstance(binaryPort, { remoteMonitorPort: textPort }));
          state.grants.set("grant-race-concurrency", { id: "grant-race-concurrency", port: binaryPort, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });
          const { listener, incidentsDir } = await startRelayListenerForState(state, deps);
          try {
            const dialBinary = await claimAndDialRelay(state, listener.port, "grant-race-concurrency", "binary");
            const dialText = await claimAndDialRelay(state, listener.port, "grant-race-concurrency", "text");

            // Dropped together, in the same synchronous turn.
            dialBinary.socket.resetAndDestroy();
            dialText.socket.resetAndDestroy();
            await Promise.all([binaryClosed, textClosed]);

            assert.equal(written.length, 2, "one record per channel, never interleaved into a single record or lost entirely");
            const channels = written.map((w) => w.channel).sort();
            assert.deepEqual(channels, ["binary", "text"], "each record must name its OWN channel, never the other one's");
            assert.ok(!state.relaySessions.has(relaySessionKey("grant-race-concurrency", "binary")));
            assert.ok(!state.relaySessions.has(relaySessionKey("grant-race-concurrency", "text")));

            // The SAME channel, dropped twice: a genuinely second observation
            // (e.g. a late-arriving event on an already-torn-down channel) is
            // a no-op at the session-map layer (handleRelayDeath()'s own
            // absent-session guard) -- exactly the double-close discipline
            // Task 1 already proved, re-asserted here under Task 3's own
            // concurrency framing for the SAME channel used above.
            handleRelayDeath("grant-race-concurrency", "binary", "relay_error", state, deps);
            assert.equal(written.length, 2, "the same channel dropping a second time must add no third record");
          } finally {
            listener.server.close();
            if (incidentsDir) rmSync(incidentsDir, { recursive: true, force: true });
          }
        },
      );
    },
  );
});

// ===========================================================================
// Plan 63-09 (SESS-02, concurrency edge -- gap closure): the JAM (0x61) wire
// shape. Per CLAUDE.md, `monitor_binary.c:384-394` computes the PC then
// sends a ZERO-length body -- "every client surveyed assumes 2 bytes and
// breaks on it." These cases prove the relay never fabricates one: a client
// that assumes a two-byte JAM body breaks on the real, zero-length frame,
// and the relay must never be the thing that hides or reshapes that.
//
// Every case below is driven through withRelayTestBroker()/
// claimAndDialRelay() -- never a ViceMonitorClient attached to a socket that
// did not itself traverse the real, production spliceRelay().
// ===========================================================================

test("spliceRelay is byte-transparent for a JAM (0x61) with a zero-length body, which decodes to a jam event with a null program counter", async () => {
  const jamFrame = syntheticJamFrame();

  await withStubEmulatorServer(
    (socket) => {
      // Written exactly once, immediately after the relay's own emulator
      // leg completes its TCP accept -- which itself only ever happens
      // AFTER handleRelayAttach() has synchronously spliced this connection
      // and the broker has queued its "attached" reply on the client's
      // socket (both synchronous, one JS tick earlier). This frame can
      // therefore never race ahead of the attach reply on the wire.
      socket.write(jamFrame);
    },
    async (emulatorPort) => {
      await withRelayTestBroker(emulatorPort, "grant-jam-zero-length", async ({ listenerPort, state }) => {
        const dial = await claimAndDialRelay(state, listenerPort, "grant-jam-zero-length");

        // Raw byte capture, alongside (never instead of) the client's own
        // parser -- both are wired to the SAME socket, and Node fans the
        // same "data" chunk out to every listener without consuming it.
        const rawChunks: Buffer[] = [];
        dial.socket.on("data", (chunk: Buffer) => rawChunks.push(Buffer.from(chunk)));

        const client = new ViceMonitorClient();
        const events: unknown[] = [];
        const protocolErrors: unknown[] = [];
        let resolveEvent: () => void = () => {};
        const gotEvent = new Promise<void>((resolve) => {
          resolveEvent = resolve;
        });
        // The "event" listener is wired BEFORE attach() hands the socket
        // over, so it can never miss a synchronously-replayed `pending`
        // frame.
        client.on("event", (e) => {
          events.push(e);
          resolveEvent();
        });
        client.on("protocol-error", (e) => protocolErrors.push(e));
        client.attach(dial.socket, { pending: dial.pending });

        await gotEvent;

        assert.equal(events.length, 1, "exactly one parsed item must reach the client's event surface for this connection");
        assert.deepEqual(protocolErrors, [], "a genuine zero-length-body JAM must never be reported as a protocol/framing error");
        const jamEvent = events[0] as { type: string; requestId: number; programCounter: number | null };
        assert.equal(jamEvent.type, "jam", `expected a jam event, got ${JSON.stringify(jamEvent)}`);
        assert.equal(jamEvent.requestId, VICE_BROADCAST_REQUEST_ID, "a JAM is unsolicited and must carry the broadcast request id");
        assert.strictEqual(
          jamEvent.programCounter,
          null,
          "FABRICATED-PC CHECK: a real stock JAM carries NO program counter at all (monitor_binary.c:384-394 sends a zero-length body) -- a non-null value here means the parser (or the relay) fabricated a two-byte PC that was never on the wire",
        );

        const receivedRaw = Buffer.concat([dial.pending, ...rawChunks]);
        assert.deepEqual(
          receivedRaw,
          jamFrame,
          "the bytes the client socket received must be byte-identical, buffer-for-buffer, to what the stub emulator wrote -- proves spliceRelay() never reshapes them in transit",
        );

        await client.disconnect();
      });
    },
  );
});

test("a JAM frame split across two TCP segments inside its response header reassembles into exactly one jam event", async () => {
  const jamFrame = syntheticJamFrame();
  // Strictly inside the 12-byte response header (offsets: 0 STX, 1
  // apiVersion, 2-5 bodyLength LE, 6 responseType, 7 errorCode, 8-11
  // requestId LE) -- splitting after byte 5 cuts the little-endian
  // body-length field itself in half.
  const splitAt = 5;
  const part1 = jamFrame.subarray(0, splitAt);
  const part2 = jamFrame.subarray(splitAt);

  await withStubEmulatorServer(
    (socket) => {
      socket.write(part1);
      // A real event-loop turn between the two writes -- never combined
      // back into one, or this would test the same-segment shape instead.
      setImmediate(() => socket.write(part2));
    },
    async (emulatorPort) => {
      await withRelayTestBroker(emulatorPort, "grant-jam-header-split", async ({ listenerPort, state }) => {
        const dial = await claimAndDialRelay(state, listenerPort, "grant-jam-header-split");

        const client = new ViceMonitorClient();
        const events: unknown[] = [];
        const protocolErrors: unknown[] = [];
        let resolveEvent: () => void = () => {};
        const gotEvent = new Promise<void>((resolve) => {
          resolveEvent = resolve;
        });
        client.on("event", (e) => {
          events.push(e);
          resolveEvent();
        });
        client.on("protocol-error", (e) => protocolErrors.push(e));
        client.attach(dial.socket, { pending: dial.pending });

        await gotEvent;

        assert.equal(events.length, 1, "a header-split JAM must reassemble into exactly one event, never two and never zero");
        assert.deepEqual(protocolErrors, [], "no parse error may be emitted while reassembling a header split inside a genuine frame");
        const jamEvent = events[0] as { type: string; requestId: number; programCounter: number | null };
        assert.equal(jamEvent.type, "jam", `expected a jam event, got ${JSON.stringify(jamEvent)}`);
        assert.equal(jamEvent.requestId, VICE_BROADCAST_REQUEST_ID);
        assert.strictEqual(
          jamEvent.programCounter,
          null,
          "FABRICATED-PC CHECK: a real stock JAM carries NO program counter at all -- a non-null value here means the parser fabricated a two-byte PC out of a reassembled but still zero-length body",
        );

        await client.disconnect();
      });
    },
  );
});

// ===========================================================================
// Plan 63-09, Task 2 (SESS-02, concurrency edge): a JAM interleaved with a
// legitimate command reply. Five unsolicited message types arrive at
// request id 0xffffffff, and two of them share a response type with a
// legitimate command reply -- CLAUDE.md's own cross-cutting constraint. A
// FIFO shift ANYWHERE in the relayed path (a queue, an accidental
// arrival-order assumption) would reintroduce exactly the defect
// stock-protocol.ts's keyed demux already solves. Both the same-segment and
// the split-segment interleave are exercised, driven through the same
// withRelayTestBroker()/claimAndDialRelay() shape as every other case in
// this section.
// ===========================================================================

/** Shared body for both interleave shapes below: claims and dials a relay,
 * sends exactly one real command, and asserts that a JAM the stub emulator
 * wrote AHEAD OF the reply never resolves the pending request and never
 * goes missing from the event surface -- whichever `writeMode` delivered
 * it. */
async function runJamInterleaveCase(writeMode: "single-write" | "split-write", targetId: string): Promise<void> {
  const jamFrame = syntheticJamFrame();
  let capturedRequestId: number | null = null;

  await withStubEmulatorServer(
    (socket) => {
      let buf = Buffer.alloc(0);
      socket.on("data", (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk]);
        const decoded = decodeOneRequest(buf);
        if (!decoded) return;
        buf = buf.subarray(decoded.total);
        capturedRequestId = decoded.requestId;
        const reply = encodeResponseFrame({ responseType: ResponseType.Ping, errorCode: ErrorCode.Ok, requestId: decoded.requestId });
        if (writeMode === "single-write") {
          // ONE write -- the JAM and the legitimate reply concatenated in
          // the SAME TCP segment. A relay or client that ever resolved a
          // pending request from an arrival-ordered queue rather than its
          // own id would be exercised by exactly this shape.
          socket.write(Buffer.concat([jamFrame, reply]));
        } else {
          // Two separate writes, with a real event-loop turn between them
          // -- the split-segment interleave.
          socket.write(jamFrame);
          setImmediate(() => socket.write(reply));
        }
      });
    },
    async (emulatorPort) => {
      await withRelayTestBroker(emulatorPort, targetId, async ({ listenerPort, state }) => {
        const dial = await claimAndDialRelay(state, listenerPort, targetId);

        const client = new ViceMonitorClient();
        const events: unknown[] = [];
        client.on("event", (e) => events.push(e));
        client.attach(dial.socket, { pending: dial.pending });

        const reply = await client.send(CommandType.Ping);

        assert.equal(reply.errorCode, ErrorCode.Ok);
        assert.equal(capturedRequestId, reply.requestId, "the stub emulator must have decoded the SAME request id the client's send() promise resolved with");
        assert.notEqual(
          reply.requestId,
          VICE_BROADCAST_REQUEST_ID,
          "DEMUX CHECK: the awaited command promise must resolve with the reply carrying the client's OWN sent request id, never the broadcast id -- a FIFO shift anywhere in the relayed path would let the JAM impersonate the reply",
        );

        assert.equal(events.length, 1, `exactly one jam event must reach the event surface for the ${writeMode} interleave, never zero and never two`);
        const jamEvent = events[0] as { type: string; requestId: number };
        assert.equal(jamEvent.type, "jam", `expected a jam event, got ${JSON.stringify(jamEvent)}`);
        assert.equal(
          jamEvent.requestId,
          VICE_BROADCAST_REQUEST_ID,
          "the JAM must never resolve the pending request -- it must stay on the broadcast id, proving the keyed demux (not arrival order) decided which item resolved send()",
        );

        await client.disconnect();
      });
    },
  );
}

test("a JAM interleaved with a legitimate command reply leaves the reply resolving its OWN request -- the relayed path demuxes by request id, never by arrival order", async () => {
  await runJamInterleaveCase("single-write", "grant-jam-interleave-single");
  await runJamInterleaveCase("split-write", "grant-jam-interleave-split");
});
