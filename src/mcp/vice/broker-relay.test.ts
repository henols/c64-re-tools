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
import { createServer, type Server, type Socket, type AddressInfo } from "node:net";

import { readAttachLine, MAX_ATTACH_LINE_BYTES } from "./broker-relay.mts";
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
import { dialMonitorRelay, type DialMonitorRelayResult } from "./broker-endpoint.ts";
import { ViceMonitorClient, CommandType, ResponseType, ErrorCode, REQUEST_HEADER_LEN, encodeRequestHeader } from "./stock-protocol.ts";
import { encodeResponseFrame } from "./binmon-fixtures.ts";
import { build } from "./build.ts";
import type { Socket as NetSocket } from "node:net";

// ---------------------------------------------------------------------------
// vice-broker.mts is host-bound: it VALUE-imports sibling ".mjs" artifacts
// (e.g. "./container-guard.mjs") that exist only once built, so this file
// -- like host-tool-transport.test.ts's own `runHostTool` load -- builds
// FIRST and then imports the COMPILED resources/vice-broker.mjs, never the
// unbuilt ".mts" source directly (that import would throw
// ERR_MODULE_NOT_FOUND on the very first sibling it tries to resolve).
// ---------------------------------------------------------------------------
build();
const viceBrokerModule = (await import(new URL("./resources/vice-broker.mjs", import.meta.url).href)) as unknown as {
  handleMonitorClaim: (requestId: string, targetId: string, channel: MonitorChannel, state: BrokerState) => MonitorClaimOutcome;
  handleMonitorRelease: (requestId: string, targetId: string, channel: MonitorChannel, state: BrokerState) => MonitorReleaseOutcome;
  handleRelayAttach: (targetId: string, channel: MonitorChannel, presentedHandle: string, clientSocket: NetSocket, pending: Buffer, state: BrokerState) => RelayAttachOutcome;
};
const { handleMonitorClaim, handleMonitorRelease, handleRelayAttach } = viceBrokerModule;

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
  state.grants.set(targetId, { id: targetId, port: emulatorPort, grantedAt: Date.now(), pid: 4242 });
  return state;
}

interface RelayTestBrokerContext {
  listener: StartControlListenerResult;
  listenerPort: number;
  token: string;
  state: BrokerState;
}

/** Stands up a REAL startControlListener() on port zero, wired to
 * vice-broker.mts's own handleMonitorClaim()/handleMonitorRelease()/
 * handleRelayAttach() against a fresh BrokerState carrying one grant on
 * `emulatorPort`. Every other callback is a no-op stub -- this suite never
 * exercises acquire/release/recycle/status/host_state/host_tool. */
async function withRelayTestBroker<T>(emulatorPort: number, targetId: string, fn: (ctx: RelayTestBrokerContext) => Promise<T>): Promise<T> {
  const state = setupBrokerState(emulatorPort, targetId);
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
    onRelayAttach: (tId, channel, presentedHandle, socket, pending) => handleRelayAttach(tId, channel, presentedHandle, socket, pending, state),
    onHostTool: async () => ({ ok: false, message: "not exercised by broker-relay.test.ts" }),
  });
  try {
    return await fn({ listener, listenerPort: listener.port, token, state });
  } finally {
    listener.server.close();
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
