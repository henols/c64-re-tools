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
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, connect as netConnect, type Server, type Socket, type AddressInfo } from "node:net";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
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
  type RelayDeathTrigger,
  type ArmIdleTimerFn,
  type ArmedIdleTimer,
} from "./broker-relay.mts";
import {
  startControlListener,
  newControlToken,
  type StartControlListenerResult,
  type AcquireOutcome,
  type RecycleOutcome,
  type StatusInstanceEntry,
  type HostStateFields,
  type MonitorClaimOutcome,
  type MonitorReleaseOutcome,
  type RelayAttachOutcome,
} from "./broker-control.mts";
import { createBrokerState, type BrokerState, type InstanceRecord, type MonitorChannel } from "./broker-state.mts";
import type { BrokerIncidentInput } from "./broker-incident.mts";
import { dialMonitorRelay, HELLO_PROTOCOL_MAGIC, RELAY_TAG_BINARY, type DialMonitorRelayResult, type DialMonitorRelaySuccess } from "./broker-endpoint.ts";
import { ViceMonitorClient, CommandType, ResponseType, ErrorCode, REQUEST_HEADER_LEN, VICE_BROADCAST_REQUEST_ID, encodeRequestHeader } from "./stock-protocol.ts";
import { encodeResponseFrame } from "./binmon-fixtures.ts";
import { build } from "./build.ts";
import type { Socket as NetSocket } from "node:net";
import { stockConnect, stockReconnect, stockDisconnect, type StockConnectBrokerControl, type DialMonitorSocketFn } from "./stock-connect.ts";
import { MachineRestartedError } from "./vice-errors.ts";

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
  ) => RelayAttachOutcome;
  handleRelayDeath: (targetId: string, channel: MonitorChannel, trigger: RelayDeathTrigger, state: BrokerState, deps?: TestHandleRelayDeathDeps) => void;
  handleRelease: (requestId: string, state: BrokerState, deps?: TestHandleReleaseDeps) => void;
};
const { handleMonitorClaim, handleMonitorRelease, handleRelayAttach, handleRelayDeath, handleOperationNote, handleRelease } = viceBrokerModule;

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
 * acquire/release/recycle/status/host_state/host_tool.
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
    onRecycle: async (): Promise<RecycleOutcome> => ({
      port: null,
      pid: null,
      viceBin: null,
      killStage: "no_signal",
      epochBefore: null,
      outcome: "grant_lookup_failed",
      reason: "not exercised by broker-relay.test.ts",
    }),
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

test("tracer: a command sent through a relayed ViceMonitorClient arrives at the stub emulator byte-identical and its reply resolves the same send()", async () => {
  const receivedFrames: Buffer[] = [];
  await withStubEmulatorServer(pingEchoHandler(receivedFrames), async (emulatorPort) => {
    await withRelayTestBroker(emulatorPort, "grant-tracer", async ({ listenerPort, token, state }) => {
      const claimOutcome = handleMonitorClaim("claim-tracer", "grant-tracer", "binary", state);
      assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
      if (!claimOutcome.ok) return;

      const dialResult: DialMonitorRelayResult = await dialMonitorRelay({
        targetId: "grant-tracer",
        channel: "binary",
        handle: claimOutcome.handle,
        token,
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
      } finally {
        await client.disconnect();
      }
    });
  });
});

test("tracer: an attach presenting a handle that does not match the stored one is refused, and the stub emulator records zero accepted connections", async () => {
  await withStubEmulatorServer(
    () => {
      assert.fail("the stub emulator must never accept a connection for a mismatched-handle attach");
    },
    async (emulatorPort, connectionCount) => {
      await withRelayTestBroker(emulatorPort, "grant-mismatch", async ({ listenerPort, token, state }) => {
        const claimOutcome = handleMonitorClaim("claim-mismatch", "grant-mismatch", "binary", state);
        assert.ok(claimOutcome.ok);
        if (!claimOutcome.ok) return;

        const dialResult = await dialMonitorRelay({
          targetId: "grant-mismatch",
          channel: "binary",
          handle: "0000000000000000000000000000000",
          token,
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
      await withRelayTestBroker(emulatorPort, "grant-boundary-1", async ({ listenerPort, token, state }) => {
        const claimOutcome = handleMonitorClaim("claim-boundary-1", "grant-boundary-1", "binary", state);
        assert.ok(claimOutcome.ok);
        if (!claimOutcome.ok) return;

        const binmonBytes = encodeRequestHeader({ commandType: CommandType.Ping, requestId: 1, body: Buffer.alloc(0) });
        const attachLine = Buffer.from(
          `${JSON.stringify({ op: "attach", target_id: "grant-boundary-1", channel: "binary", handle: claimOutcome.handle, token })}\n`,
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
      token: "irrelevant-to-this-fake-broker",
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
      await withRelayTestBroker(emulatorPort, "grant-weird", async ({ listenerPort, token, state }) => {
        const claimOutcome = handleMonitorClaim("claim-weird", "grant-weird", "binary", state);
        assert.ok(claimOutcome.ok);
        if (!claimOutcome.ok) return;

        const dialResult = await dialMonitorRelay({
          targetId: "grant-weird",
          channel: "binary",
          handle: claimOutcome.handle,
          token,
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
      async ({ listenerPort, token, state }) => {
        const claimA = handleMonitorClaim("claim-multi-a", "grant-multi-a", "binary", state);
        const claimB = handleMonitorClaim("claim-multi-b", "grant-multi-b", "binary", state);
        assert.ok(claimA.ok && claimB.ok, `expected both claims to succeed: ${JSON.stringify(claimA)} ${JSON.stringify(claimB)}`);
        if (!claimA.ok || !claimB.ok) return;

        const dialA = await dialMonitorRelay({
          targetId: "grant-multi-a",
          channel: "binary",
          handle: claimA.handle,
          token,
          port: listenerPort,
          candidates: ["127.0.0.1"],
        });
        const dialB = await dialMonitorRelay({
          targetId: "grant-multi-b",
          channel: "binary",
          handle: claimB.handle,
          token,
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
  };
}

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
        await withRelayTestBroker(emulatorPort, "grant-reconnect-binary", async ({ listenerPort, token, state }) => {
          const brokerControl = makeRealBrokerControl(state, "grant-reconnect-binary");
          const dialMonitorSocket: DialMonitorSocketFn = async (opts) => {
            const result = await dialMonitorRelay({
              targetId: opts.targetId,
              channel: opts.channel,
              handle: opts.handle,
              token,
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
        await withRelayTestBroker(emulatorPort, "grant-reconnect-restarted", async ({ listenerPort, token, state }) => {
          const brokerControl = makeRealBrokerControl(state, "grant-reconnect-restarted");
          const dialMonitorSocket: DialMonitorSocketFn = async (opts) => {
            const result = await dialMonitorRelay({
              targetId: opts.targetId,
              channel: opts.channel,
              handle: opts.handle,
              token,
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
  token: string,
  targetId: string,
  channel: MonitorChannel = "binary",
): Promise<DialMonitorRelaySuccess> {
  const claim = handleMonitorClaim(`claim-${targetId}`, targetId, channel, state);
  assert.ok(claim.ok, `expected the claim to succeed: ${JSON.stringify(claim)}`);
  if (!claim.ok) throw new Error("unreachable");
  const dial = await dialMonitorRelay({ targetId, channel, handle: claim.handle, token, port: listenerPort, candidates: ["127.0.0.1"] });
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
        async ({ listenerPort, token, state }) => {
          const dial = await claimAndDialRelay(state, listenerPort, token, "grant-death-abrupt");
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
        async ({ listenerPort, token, state }) => {
          const dial = await claimAndDialRelay(state, listenerPort, token, "grant-death-graceful");
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
        async ({ listenerPort, token, state }) => {
          const dial = await claimAndDialRelay(state, listenerPort, token, "grant-death-double");
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
            async ({ listenerPort, token, state }) => {
              const dialA = await claimAndDialRelay(state, listenerPort, token, "grant-death-multi-a");
              const dialB = await claimAndDialRelay(state, listenerPort, token, "grant-death-multi-b");

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
      await withRelayTestBroker(emulatorPort, "grant-death-survives", async ({ listenerPort, token, state }) => {
        const dial = await claimAndDialRelay(state, listenerPort, token, "grant-death-survives");
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
            async ({ listenerPort, token, state }) => {
              if (declareOp) {
                const grant = state.grants.get(targetId);
                assert.ok(grant, "the fixture must have created a grant for this target id");
                if (grant) grant.operation = { name: "vice_memory_read", declaredAt: Date.now() };
              }
              const dial = await claimAndDialRelay(state, listenerPort, token, targetId);
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
        async ({ listenerPort, token, state }) => {
          await claimAndDialRelay(state, listenerPort, token, "grant-idle-boundary");

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
        async ({ listenerPort, token, state }) => {
          const dial = await claimAndDialRelay(state, listenerPort, token, "grant-idle-reset");

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
        async ({ listenerPort, token, state }) => {
          await claimAndDialRelay(state, listenerPort, token, "grant-suspend-resume");

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
        async ({ listenerPort, token, state }) => {
          await claimAndDialRelay(state, listenerPort, token, "grant-idle-fired");
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
      await withRelayTestBroker(emulatorPort, "grant-death-throws", async ({ listenerPort, token, state }) => {
        await claimAndDialRelay(state, listenerPort, token, "grant-death-throws");
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
          async ({ listenerPort, token, state }) => {
            const dial = await claimAndDialRelay(state, listenerPort, token, targetId);

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
          const { listener, token, incidentsDir } = await startRelayListenerForState(state, deps);
          try {
            const dialBinary = await claimAndDialRelay(state, listener.port, token, "grant-race-concurrency", "binary");
            const dialText = await claimAndDialRelay(state, listener.port, token, "grant-race-concurrency", "text");

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
