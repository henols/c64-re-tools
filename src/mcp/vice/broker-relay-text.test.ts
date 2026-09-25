// broker-relay-text.test.ts
//
// Phase 63 (SESS-02) plan 63-02: the text channel's own relay-lifecycle
// cases, mirroring broker-relay.test.ts's own harness exactly but for the
// text monitor -- a REAL loopback net server standing in for VICE's
// `-remotemonitor` text channel (never a real emulator), and a REAL
// broker-control.mts control listener bound on port zero. handleMonitorClaim()/
// handleRelayAttach() are imported straight from vice-broker.mts and wired
// into the listener's own callbacks, so this suite exercises the SAME
// production functions the real broker calls, not a re-implemented stand-in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, connect as netConnect, type Server, type Socket, type AddressInfo } from "node:net";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
import { createBrokerState, type BrokerState, type InstanceRecord, type MonitorChannel } from "./broker-state.mts";
import { dialMonitorRelay, HELLO_PROTOCOL_MAGIC, RELAY_TAG_TEXT, type DialMonitorRelayResult } from "./broker-endpoint.mts";
import { TextMonitorClient, withTextChannelLock } from "./text-protocol.ts";
import { resetChannelLockForTests } from "./channel-lock.ts";
import { build } from "./build.ts";
import type { Socket as NetSocket } from "node:net";
import type { BrokerIncidentInput } from "./broker-incident.mts";
import { relaySessionKey, type ArmIdleTimerFn } from "./broker-relay.mts";

// ---------------------------------------------------------------------------
// vice-broker.mts is host-bound: it VALUE-imports sibling ".mjs" artifacts,
// so this file -- like broker-relay.test.ts's own precedent -- builds FIRST
// and then imports the COMPILED resources/vice-broker.mjs, never the
// unbuilt ".mts" source directly.
// ---------------------------------------------------------------------------
build();

/** Mirrors vice-broker.mts's own HandleRelayDeathDeps -- imported by type
 * shape only (this test file loads the COMPILED artifact, never the .mts
 * source, per this file's own header comment above). */
interface TestHandleRelayDeathDeps {
  writeIncident?: (record: BrokerIncidentInput) => string;
  clearClaim?: (instance: InstanceRecord, channel: MonitorChannel) => void;
  idleMs?: number;
  armIdleTimer?: ArmIdleTimerFn;
  keepAliveMs?: number;
  /** G-64-4 (plan 64-12) additions -- see vice-broker.mts's own
   * HandleRelayDeathDeps for the full doc comment. */
  dialDeadlineMs?: number;
  dialRetryIntervalMs?: number;
}
const viceBrokerModule = (await import(new URL("./resources/vice-broker.mjs", import.meta.url).href)) as unknown as {
  handleMonitorClaim: (requestId: string, targetId: string, channel: MonitorChannel, state: BrokerState) => MonitorClaimOutcome;
  handleMonitorRelease: (requestId: string, targetId: string, channel: MonitorChannel, state: BrokerState) => MonitorReleaseOutcome;
  handleRelayAttach: (
    targetId: string,
    channel: MonitorChannel,
    presentedHandle: string,
    clientSocket: NetSocket,
    pending: Buffer,
    state: BrokerState,
    deps?: TestHandleRelayDeathDeps,
  ) => RelayAttachOutcome;
};
const { handleMonitorClaim, handleMonitorRelease, handleRelayAttach } = viceBrokerModule;

// broker-incident.mts is ALSO host-bound (it value-imports broker-home.mjs),
// so it is loaded the SAME way -- built first, then the compiled artifact,
// never the unbuilt .mts source directly (broker-relay.test.ts's own
// established convention, mirrored here).
const brokerIncidentModule = (await import(new URL("./resources/broker-incident.mjs", import.meta.url).href)) as unknown as {
  writeBrokerIncident: (record: BrokerIncidentInput, opts?: { dir?: string }) => string;
};
const { writeBrokerIncident } = brokerIncidentModule;

// ---------------------------------------------------------------------------
// Stub text-monitor harness -- copies broker-relay.test.ts's own
// withStubEmulatorServer() shape verbatim (ephemeral port, tracked accepted
// sockets destroyed before server.close(), finally-guaranteed teardown),
// widened with a connectionCount() reader so a refused-attach case can
// assert the stub text monitor never accepted anything.
// ---------------------------------------------------------------------------

async function withStubTextMonitorServer<T>(handler: (socket: Socket) => void, fn: (port: number, connectionCount: () => number) => Promise<T>): Promise<T> {
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
 * back the OS-assigned port, then closes immediately -- mirrors
 * broker-relay.test.ts's own reserveFreePort() verbatim (private to its own
 * file, so duplicated here rather than shared, matching this whole file's
 * own established "mirrors ... verbatim" precedent). */
async function reserveFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const probe: Server = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as AddressInfo).port;
      probe.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

/** G-64-4 (plan 64-12), Task 3: a stub text monitor that binds `bindDelayMs`
 * AFTER this function returns control to its caller -- mirrors
 * broker-relay.test.ts's own withLateBindingStubEmulatorServer() verbatim,
 * for the text channel. Every pre-existing stub in THIS file binds
 * synchronously before the attach is ever sent, which is exactly the
 * condition that hid G-64-4 from every earlier test on this channel too. */
async function withLateBindingStubTextMonitorServer<T>(
  bindDelayMs: number,
  handler: (socket: Socket) => void,
  fn: (port: number, connectionCount: () => number) => Promise<T>,
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
    return await fn(port, () => connections);
  } finally {
    clearTimeout(bindTimer);
    for (const socket of sockets) socket.destroy();
    if (server) await new Promise<void>((resolve) => (server as Server).close(() => resolve()));
  }
}

// ---------------------------------------------------------------------------
// Broker-side fixture: one BrokerState carrying exactly one granted
// instance whose `remoteMonitorPort` is the stub text monitor's own
// ephemeral port -- `port` (the BINARY port) is deliberately a different,
// closed port, so a resolver bug that dials the binary port instead of the
// text one fails loudly (ECONNREFUSED) rather than silently passing.
// ---------------------------------------------------------------------------

function makeGrantedTextInstance(binaryPort: number, remoteMonitorPort: number | undefined, overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    port: binaryPort,
    url: `http://127.0.0.1:${binaryPort}/mcp`,
    state: "granted",
    reason: "acquire",
    epochFile: "/tmp/relay-text-test-epoch.json",
    supervisorDir: "/tmp/relay-text-test",
    pid: 4242,
    expectedIdentity: "x64sc",
    launchedAt: 0,
    readyAt: 0,
    viceBin: "x64sc",
    viceArgs: [],
    dryRun: false,
    monitorClients: {},
    ...(remoteMonitorPort === undefined ? {} : { remoteMonitorPort }),
    ...overrides,
  };
}

/** A closed, unused low port -- standing in for "the binary port", which a
 * text attach must NEVER dial even as a fallback. Never bound by any
 * listener in this file. */
const UNUSED_BINARY_PORT = 1;

function setupTextBrokerState(remoteMonitorPort: number | undefined, targetId: string): BrokerState {
  const state = createBrokerState();
  state.instances.set(UNUSED_BINARY_PORT, makeGrantedTextInstance(UNUSED_BINARY_PORT, remoteMonitorPort));
  state.grants.set(targetId, { id: targetId, port: UNUSED_BINARY_PORT, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });
  return state;
}

interface RelayTestBrokerContext {
  listener: StartControlListenerResult;
  listenerPort: number;
  token: string;
  state: BrokerState;
  /** See broker-relay.test.ts's own identical field for why this exists --
   * absent when the caller supplied its own `deps`. */
  incidentsDir: string | null;
}

/** Stands up a REAL startControlListener() on port zero against an
 * ALREADY-BUILT BrokerState, wired to vice-broker.mts's own
 * handleMonitorClaim()/handleMonitorRelease()/handleRelayAttach() -- mirrors
 * broker-relay.test.ts's own startRelayListenerForState() verbatim,
 * including its `relayDeathDeps` seam (Plan 63-04): when the caller omits
 * it, this function writes any relay-death incident into a freshly
 * mkdtemp'd scratch directory rather than the real, machine-level incidents
 * directory -- without this, the "relay death (text)" case below (and any
 * new Task 2 case) would leave a real file on the host running this suite.
 * Every other callback is a no-op stub -- this suite never exercises
 * acquire/release/recycle/status/host_state/host_tool. */
async function startRelayListenerForState(
  state: BrokerState,
  relayDeathDeps?: TestHandleRelayDeathDeps,
): Promise<{ listener: StartControlListenerResult; token: string; incidentsDir: string | null }> {
  let incidentsDir: string | null = null;
  let deps = relayDeathDeps;
  if (!deps) {
    incidentsDir = mkdtempSync(join(tmpdir(), "vice-relay-text-incidents-"));
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
  });
  return { listener, token, incidentsDir };
}

async function withRelayTestBroker<T>(
  remoteMonitorPort: number | undefined,
  targetId: string,
  fn: (ctx: RelayTestBrokerContext) => Promise<T>,
  relayDeathDeps?: TestHandleRelayDeathDeps,
): Promise<T> {
  const state = setupTextBrokerState(remoteMonitorPort, targetId);
  const { listener, token, incidentsDir } = await startRelayListenerForState(state, relayDeathDeps);
  try {
    return await fn({ listener, listenerPort: listener.port, token, state, incidentsDir });
  } finally {
    listener.server.close();
    if (incidentsDir) rmSync(incidentsDir, { recursive: true, force: true });
  }
}

// ===========================================================================
// Tracer: an allowlisted text command round-trips through the relay,
// byte-identically, both directions.
// ===========================================================================

test("tracer: an allowlisted text command sent through a relayed TextMonitorClient arrives at the stub text monitor byte-identical and its prompt-framed reply returns unchanged", async () => {
  resetChannelLockForTests();
  const receivedBytes: Buffer[] = [];
  const commandReply = Buffer.from("Setting default device to `Computer'\n(C:$e5d1) ", "utf8");
  await withStubTextMonitorServer(
    (socket) => {
      socket.on("data", (chunk: Buffer) => {
        receivedBytes.push(Buffer.from(chunk));
        socket.write(commandReply);
      });
    },
    async (textPort) => {
      await withRelayTestBroker(textPort, "grant-tracer-text", async ({ listenerPort, state }) => {
        const claimOutcome = handleMonitorClaim("claim-tracer-text", "grant-tracer-text", "text", state);
        assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
        if (!claimOutcome.ok) return;

        const dialResult: DialMonitorRelayResult = await dialMonitorRelay({
          targetId: "grant-tracer-text",
          channel: "text",
          handle: claimOutcome.handle,
          port: listenerPort,
          candidates: ["127.0.0.1"],
        });
        assert.ok(dialResult.ok, `expected a successful relay dial: ${JSON.stringify(dialResult)}`);
        if (!dialResult.ok) return;

        const client = new TextMonitorClient();
        client.attach(dialResult.socket, { pending: dialResult.pending });
        try {
          const payload = await withTextChannelLock("device c:", () => client.command("device c:"));
          assert.equal(payload, "Setting default device to `Computer'\n");

          assert.equal(receivedBytes.length, 1, "the stub text monitor must have received exactly one write");
          assert.ok(
            Buffer.from(receivedBytes[0]!).equals(Buffer.from("device c:\n", "utf8")),
            "the command bytes the stub text monitor received must be byte-identical to the allowlisted command plus its terminator",
          );
        } finally {
          await client.disconnect();
        }
      });
    },
  );
});

// ===========================================================================
// Gap closure plan 63-11 (SESS-05): a per-channel monitor_release for a
// channel holding a live relay session must tear that session down too --
// a completely ordinary, successful text-channel round trip must never
// deposit an incident record. Mirrors the tracer case above but drives
// release-then-close (the target order plan 63-12 gives the real callers;
// see this plan's own <planner_findings> for why production still runs
// close-then-release until that plan lands).
// ===========================================================================

// ===========================================================================
// G-64-4 (plan 64-12), Task 3: the text channel is covered by the SAME
// attach seam as the binary channel -- no path-specific readiness code.
// ===========================================================================

test("emulator binds late (text channel): a text attach sent before the text monitor's port is bound is answered after the bind and one allowlisted command round-trips", async () => {
  resetChannelLockForTests();
  const receivedBytes: Buffer[] = [];
  const commandReply = Buffer.from("Setting default device to `Computer'\n(C:$e5d1) ", "utf8");
  let incidentWrites = 0;
  const deps: TestHandleRelayDeathDeps = {
    writeIncident: (record) => {
      incidentWrites += 1;
      return `/fake/incident/${incidentWrites}.md`;
    },
  };
  await withLateBindingStubTextMonitorServer(
    250,
    (socket) => {
      socket.on("data", (chunk: Buffer) => {
        receivedBytes.push(Buffer.from(chunk));
        socket.write(commandReply);
      });
    },
    async (textPort) => {
      const targetId = "grant-g64-4-text-late-bind";
      await withRelayTestBroker(
        textPort,
        targetId,
        async ({ listenerPort, state }) => {
          const claimOutcome = handleMonitorClaim("claim-text-late-bind", targetId, "text", state);
          assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
          if (!claimOutcome.ok) return;

          const dialResult: DialMonitorRelayResult = await dialMonitorRelay({
            targetId,
            channel: "text",
            handle: claimOutcome.handle,
            port: listenerPort,
            candidates: ["127.0.0.1"],
          });
          assert.ok(dialResult.ok, `expected a successful relay dial once the text monitor binds: ${JSON.stringify(dialResult)}`);
          if (!dialResult.ok) return;

          const client = new TextMonitorClient();
          client.attach(dialResult.socket, { pending: dialResult.pending });
          try {
            const payload = await withTextChannelLock("device c:", () => client.command("device c:"));
            assert.equal(payload, "Setting default device to `Computer'\n");
            assert.equal(receivedBytes.length, 1, "the stub text monitor must have received exactly one write");
            assert.equal(incidentWrites, 0, "a late-binding text monitor that eventually accepts the connection must never write an incident record");
          } finally {
            await client.disconnect();
          }
        },
        deps,
      );
    },
  );
});

test("gap closure 63-11: a real claim/attach/command/release/close round trip through the text relay leaves state.relaySessions empty and writes zero incident files", async () => {
  resetChannelLockForTests();
  const receivedBytes: Buffer[] = [];
  const commandReply = Buffer.from("Setting default device to `Computer'\n(C:$e5d1) ", "utf8");
  const targetId = "grant-63-11-text-hygiene";
  await withStubTextMonitorServer(
    (socket) => {
      socket.on("data", (chunk: Buffer) => {
        receivedBytes.push(Buffer.from(chunk));
        socket.write(commandReply);
      });
    },
    async (textPort) => {
      // No relayDeathDeps argument -- the harness mints its own scratch
      // incidentsDir and the REAL writeBrokerIncident() is the writer under
      // test, exactly as 63-VERIFICATION.md's own missing[1] asked for.
      await withRelayTestBroker(textPort, targetId, async ({ listenerPort, state, incidentsDir }) => {
        assert.ok(incidentsDir, "the harness must have minted its own scratch incidentsDir -- no relayDeathDeps was supplied");

        const claimOutcome = handleMonitorClaim("claim-63-11-text-hygiene", targetId, "text", state);
        assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
        if (!claimOutcome.ok) return;

        const dialResult: DialMonitorRelayResult = await dialMonitorRelay({
          targetId,
          channel: "text",
          handle: claimOutcome.handle,
          port: listenerPort,
          candidates: ["127.0.0.1"],
        });
        assert.ok(dialResult.ok, `expected a successful relay dial: ${JSON.stringify(dialResult)}`);
        if (!dialResult.ok) return;

        const client = new TextMonitorClient();
        client.attach(dialResult.socket, { pending: dialResult.pending });
        try {
          const payload = await withTextChannelLock("device c:", () => client.command("device c:"));
          assert.equal(payload, "Setting default device to `Computer'\n");
          assert.equal(receivedBytes.length, 1, "the stub text monitor must have received exactly one write");

          // The scenario must be proven real BEFORE the teardown is
          // exercised -- otherwise this case would pass vacuously against
          // an empty map.
          assert.ok(
            state.relaySessions.has(relaySessionKey(targetId, "text")),
            "the relay session must still be live immediately after the command round trip, before the release",
          );

          const releaseOutcome = handleMonitorRelease("release-63-11-text-hygiene", targetId, "text", state);
          assert.ok(releaseOutcome.ok, `expected the per-channel release to succeed: ${JSON.stringify(releaseOutcome)}`);
        } finally {
          // Mirrors textDisconnect()'s own real pairing, but release-then-
          // close (this plan's own target order) rather than production's
          // current close-then-release -- see the header comment above.
          await client.disconnect();
        }

        // client.disconnect() itself already awaits the socket's own
        // "close" event, but the broker's OWN sockets (destroyed
        // synchronously inside the release call above, whose "close"
        // events fire on a later tick) and any onDeath re-entry they could
        // still trigger need one more event-loop turn to settle before the
        // incidents directory is read -- a premature read here would make
        // this case pass vacuously even if the teardown were broken.
        await new Promise<void>((resolve) => setImmediate(resolve));

        assert.equal(state.relaySessions.size, 0, "the released channel's relay session must be gone from the map");
        assert.equal(
          state.instances.get(UNUSED_BINARY_PORT)?.monitorClients.text,
          undefined,
          "the per-channel holder record must be cleared by clearMonitorClient()",
        );
        assert.equal(
          readdirSync(incidentsDir as string).length,
          0,
          "a routine, successful text-channel round trip must not deposit an incident record",
        );
      });
    },
  );
});

// ===========================================================================
// Channel-target resolution: the broker dials the text channel's OWN port,
// and refuses by name when the instance record carries no text-monitor
// port -- never a fallback to the binary port or a guessed one (T-63-08).
// ===========================================================================

test("attach: a text attach against an instance record with no text-monitor port is refused, and the stub text monitor records zero accepted connections", async () => {
  await withStubTextMonitorServer(
    () => {
      assert.fail("the stub text monitor must never accept a connection when the instance record has no text-monitor port recorded");
    },
    async (_textPort, connectionCount) => {
      // remoteMonitorPort is deliberately omitted -- the instance record
      // carries NO text-monitor port at all.
      await withRelayTestBroker(undefined, "grant-no-text-port", async ({ listenerPort, state }) => {
        const claimOutcome = handleMonitorClaim("claim-no-text-port", "grant-no-text-port", "text", state);
        assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
        if (!claimOutcome.ok) return;

        const dialResult = await dialMonitorRelay({
          targetId: "grant-no-text-port",
          channel: "text",
          handle: claimOutcome.handle,
          port: listenerPort,
          candidates: ["127.0.0.1"],
        });
        assert.equal(dialResult.ok, false, "an attach against a target with no recorded text-monitor port must never succeed");
        if (dialResult.ok) return;
        assert.match(dialResult.reason, /bad_request/i, "the refusal must name the failure by code, never an emulator-fault wording");
        assert.equal(connectionCount(), 0, "the stub text monitor must never be dialled -- neither on its own port nor, silently, on the binary port");
      });
    },
  );
});

// ===========================================================================
// Handover: the attach reply and the first prompt bytes arrive in the SAME
// TCP segment -- proven with a minimal fake broker, mirroring
// broker-relay.test.ts's own "boundary two" test but tagged for the text
// channel.
// ===========================================================================

test("handover: prompt bytes delivered in the same write as the attach reply are parsed by the client, not dropped", async () => {
  resetChannelLockForTests();
  const promptBytes = Buffer.from("(C:$e5d1) ", "utf8");

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
        socket.write(`${JSON.stringify({ kind: "hello", protocol: HELLO_PROTOCOL_MAGIC, version: "1.0.0", tag: RELAY_TAG_TEXT })}\n`);
      } else {
        // ONE write -- the attach reply, its terminator and the prompt
        // bytes together. Never two writes.
        socket.write(Buffer.concat([Buffer.from('{"kind":"attached"}\n', "utf8"), promptBytes]));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const fakeBrokerPort = (server.address() as AddressInfo).port;

  try {
    const dialResult: DialMonitorRelayResult = await dialMonitorRelay({
      targetId: "grant-handover-text",
      channel: "text",
      handle: "irrelevant-to-this-fake-broker",
      port: fakeBrokerPort,
      candidates: ["127.0.0.1"],
      clientVersion: "1.0.0",
    });
    assert.ok(dialResult.ok, `expected a successful dial against the fake broker: ${JSON.stringify(dialResult)}`);
    if (!dialResult.ok) return;

    assert.ok(
      dialResult.pending.equals(promptBytes),
      "the prompt bytes must be returned as `pending`, byte-identical, with no bytes discarded",
    );

    const client = new TextMonitorClient();
    const banners: string[] = [];
    client.on("banner", (text: string) => banners.push(text));
    client.attach(dialResult.socket, { pending: dialResult.pending });
    // No command was ever issued on this client -- the seeded pending bytes
    // are a passively-arriving banner (D-13(b)'s own path), drained once
    // the quiescence window elapses.
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(banners.length, 1, "attach() must parse the seeded pending bytes through the SAME path a live 'data' event would use");
    assert.equal(banners[0], "(C:$e5d1) ");
    await client.disconnect();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ===========================================================================
// Task 2 (SESS-02): the text channel's relay-death policy -- FATAL, never a
// reconnect. Mirrors broker-relay.test.ts's own binary-side proving case
// but asserts the OPPOSITE outcome: no second connection, ever.
// ===========================================================================

test("relay death (text): after the text relay is destroyed, the next text command rejects with a refusal naming the text channel, no second connection ever reaches the stub text monitor, and the claim can still be released", async () => {
  resetChannelLockForTests();
  let emulatorSocket: Socket | null = null;
  let resolveEmulatorAccepted: () => void = () => {};
  const emulatorAccepted = new Promise<void>((resolve) => {
    resolveEmulatorAccepted = resolve;
  });
  await withStubTextMonitorServer(
    (socket) => {
      emulatorSocket = socket;
      resolveEmulatorAccepted();
      // Never replies -- this test never completes a successful command;
      // the relay dies while the connection is idle.
    },
    async (textPort, connectionCount) => {
      await withRelayTestBroker(textPort, "grant-relay-death-text", async ({ listenerPort, state }) => {
        const claimOutcome = handleMonitorClaim("claim-relay-death-text", "grant-relay-death-text", "text", state);
        assert.ok(claimOutcome.ok, `expected the claim to succeed: ${JSON.stringify(claimOutcome)}`);
        if (!claimOutcome.ok) return;

        const dialResult = await dialMonitorRelay({
          targetId: "grant-relay-death-text",
          channel: "text",
          handle: claimOutcome.handle,
          port: listenerPort,
          candidates: ["127.0.0.1"],
        });
        assert.ok(dialResult.ok, `expected a successful relay dial: ${JSON.stringify(dialResult)}`);
        if (!dialResult.ok) return;

        const client = new TextMonitorClient();
        client.attach(dialResult.socket, { pending: dialResult.pending });
        assert.ok(client.connected);

        // The broker dials the emulator ASYNCHRONOUSLY inside
        // spliceRelay() -- the attach reply (and this dial's own
        // resolution) can arrive before the emulator-side TCP handshake
        // completes, so wait for the stub text monitor to actually accept
        // the connection before destroying it.
        await emulatorAccepted;

        // Destroy the EMULATOR side of the splice -- this cascades through
        // spliceRelay()'s own "close" wiring to destroy the client's relay
        // socket too, exactly as an unexpected mid-session relay death
        // would (never a controlled disconnect()).
        const clientClosed = new Promise<void>((resolve) => client.once("close", () => resolve()));
        emulatorSocket!.destroy();
        await clientClosed;
        assert.equal(client.connected, false, "the relay death must be observable through the SAME connected getter a direct-dial death would flip");

        await assert.rejects(
          () => withTextChannelLock("device c:", () => client.command("device c:")),
          (err: unknown) => {
            assert.ok(err instanceof Error);
            assert.match((err as Error).message, /text channel/i, "the refusal must name the text channel");
            assert.match((err as Error).message, /lost account/i, "the refusal must state the session lost account of what happened on it");
            return true;
          },
        );

        assert.equal(connectionCount(), 1, "the text channel must never reconnect -- exactly one lifetime connection to the stub text monitor");

        // Even after a fatal relay death, the claim itself must still be
        // releasable -- disconnect() on an already-dead socket, followed
        // by releaseMonitor(), must not be blocked by the dead connection.
        await client.disconnect();
        const releaseOutcome = handleMonitorRelease("release-relay-death-text", "grant-relay-death-text", "text", state);
        assert.ok(releaseOutcome.ok, `expected the text claim to still be releasable after a fatal relay death: ${JSON.stringify(releaseOutcome)}`);
      });
    },
  );
});

// ===========================================================================
// Plan 63-04, Task 2 (SESS-04): the broker-owned idle deadline applies to
// the text channel exactly as it does to the binary channel -- mirrors
// broker-relay.test.ts's own makeFakeIdleTimer() verbatim (a test-file-local
// no-wall-clock harness, duplicated rather than shared across the two
// files, matching this whole file's own established "mirrors ... verbatim"
// precedent throughout).
// ===========================================================================

interface FakeIdleTimer {
  armIdleTimer: ArmIdleTimerFn;
  advance(deltaMs: number): void;
}

function makeFakeIdleTimer(): FakeIdleTimer {
  let onExpire: (() => void) | null = null;
  let ms = 0;
  let elapsed = 0;
  const armIdleTimer: ArmIdleTimerFn = (opts) => {
    onExpire = opts.onExpire;
    ms = opts.ms;
    elapsed = 0;
    return {
      suspend: () => {},
      resume: () => {
        elapsed = 0;
      },
      onActivity: () => {
        elapsed = 0;
      },
    };
  };
  return {
    armIdleTimer,
    advance(deltaMs: number) {
      elapsed += deltaMs;
      if (elapsed >= ms) onExpire?.();
    },
  };
}

test("handleRelayDeath (text): with an injected timer, an interval exactly equal to the bound fires and one tick short does not", async () => {
  resetChannelLockForTests();
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
  await withStubTextMonitorServer(
    () => {},
    async (textPort) => {
      await withRelayTestBroker(
        textPort,
        "grant-idle-boundary-text",
        async ({ listenerPort, state }) => {
          const claimOutcome = handleMonitorClaim("claim-idle-boundary-text", "grant-idle-boundary-text", "text", state);
          assert.ok(claimOutcome.ok);
          if (!claimOutcome.ok) return;
          const dial = await dialMonitorRelay({
            targetId: "grant-idle-boundary-text",
            channel: "text",
            handle: claimOutcome.handle,
            port: listenerPort,
            candidates: ["127.0.0.1"],
          });
          assert.ok(dial.ok);
          if (!dial.ok) return;

          fake.advance(99);
          assert.equal(writeCount, 0, "one tick short of the bound must NOT fire");

          fake.advance(1);
          assert.equal(writeCount, 1, "reaching the bound EXACTLY must fire -- at-or-past, never strictly past");
          assert.equal(lastTrigger, "relay_idle_expiry");
          assert.ok(!state.relaySessions.has(relaySessionKey("grant-idle-boundary-text", "text")), "the fired deadline must run the same single teardown as any other death");
        },
        deps,
      );
    },
  );
});
