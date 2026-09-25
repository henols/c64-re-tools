// broker-control.test.ts
//
// Plan 05: the complete control-plane message set (acquire/release/
// status/host_state), the arrival-ordered pending-acquire structure, and the
// kernel-enforced singleton guard's two distinct outcomes. Most tests here
// drive a REAL listener bound on port zero, in this test's own process,
// against injected onAcquire/onRelease/onStatus/onHostState
// stubs -- no real emulator, no real spawn, no test opens a connection to
// the host VICE. The singleton-guard tests (task 3) additionally spawn the
// real, BUILT broker artifact behind the escape hatch, exactly like
// broker-e2e.test.ts/broker-kill.test.ts already do, because the guard is a
// property of vice-broker.mts's own startup sequence, not of
// broker-control.mts in isolation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { connect, createServer, type AddressInfo } from "node:net";
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import type { NetworkInterfaceInfo } from "node:os";

import {
  startControlListener,
  startControlListenerOnHosts,
  bindControlListener,
  enqueueAcquire,
  drainPendingAcquires,
  newControlToken,
  HELLO_PROTOCOL_MAGIC,
  resolveBrokerVersion,
  BRIDGE_INTERFACE_ALLOWLIST,
  enumerateBindHosts,
  type StartControlListenerResult,
  type AcquireOutcome,
  type StatusInstanceEntry,
  type HostStateFields,
  type PendingAcquireQueue,
  type PendingAcquireEntry,
  type MonitorClaimOutcome,
  type MonitorReleaseOutcome,
  type RelayAttachOutcome,
  type OperationNoteOutcome,
  type StageFileOutcome,
  type FileTransferRequest,
  type FileTransferOutcome,
  type HostToolStageFileSpec,
  type HostToolStageOutcome,
  sanitiseSessionLabel,
} from "./broker-control.mts";
import type { Socket } from "node:net";
// Plan 41-03 (D-14): the channel contract's one host-bound declaration.
import type { MonitorChannel } from "./broker-state.mts";
// Phase 33, plan 33-06 (D-15): the profile shape is imported from its one
// definition, exactly as the production modules import it -- a local shape
// here would let these assertions pass against a boundary that accepts
// something else.
import type { LaunchProfile } from "./broker-launch.mts";
import { readBrokerLiveness } from "./vice-broker-client.ts";
import { build } from "./build.ts";
import { createBrokerState, type BrokerState, type InstanceRecord } from "./broker-state.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");

// Plan 64-08 (G-64-1 gap closure, Task 2): the SAME "build first, import the
// compiled artifact" idiom broker-relay.test.ts already established -- this
// module is host-bound (it value-imports sibling .mjs artifacts), so an
// unbuilt-source import throws ERR_MODULE_NOT_FOUND. Used only by this
// plan's own second-attach case below, which needs the REAL
// handleMonitorClaim()/handleRelayAttach() rather than a stub, so the
// refusal it observes is the genuine broker-side one, not a fabricated
// test double.
build();
const g6408ViceBrokerModule = (await import(new URL("./resources/vice-broker.mjs", import.meta.url).href)) as unknown as {
  handleMonitorClaim: (requestId: string, targetId: string, channel: "binary" | "text", state: BrokerState) => { ok: true; handle: string } | { ok: false; code: string };
  handleRelayAttach: (
    targetId: string,
    channel: "binary" | "text",
    presentedHandle: string,
    clientSocket: Socket,
    pending: Buffer,
    state: BrokerState,
    deps?: { writeIncident?: (record: unknown) => string },
  ) => RelayAttachOutcome;
};
const { handleMonitorClaim: g6408HandleMonitorClaim, handleRelayAttach: g6408HandleRelayAttach } = g6408ViceBrokerModule;

// broker-incident.mts is ALSO host-bound (it value-imports broker-home.mjs),
// so it is loaded the SAME way -- built first, then the compiled artifact,
// never the unbuilt .mts source directly (broker-relay.test.ts's own
// established convention, mirrored here). Without this, the second-attach
// case below's own relay-death teardown (the first client's connection
// closing at the end of the test) would fall back to the REAL,
// machine-level brokerIncidentsDir() (~/.c64-re-tools/incidents/).
const g6408BrokerIncidentModule = (await import(new URL("./resources/broker-incident.mjs", import.meta.url).href)) as unknown as {
  writeBrokerIncident: (record: unknown, opts?: { dir?: string }) => string;
};
const { writeBrokerIncident: g6408WriteBrokerIncident } = g6408BrokerIncidentModule;

/** Mirrors broker-relay.test.ts's own makeGrantedInstance()/setupBrokerState()
 * -- a minimal BrokerState carrying one granted instance and one grant, just
 * enough for handleMonitorClaim()/handleRelayAttach() to mint and check a
 * real handle. `port` is a synthetic key, never dialled by this file. */
function g6408SetupBrokerState(port: number, targetId: string): BrokerState {
  const state = createBrokerState();
  const instance: InstanceRecord = {
    port,
    url: `http://127.0.0.1:${port}/mcp`,
    state: "granted",
    reason: "acquire",
    epochFile: "/tmp/g64-08-epoch.json",
    supervisorDir: "/tmp/g64-08",
    pid: 4242,
    expectedIdentity: "x64sc",
    launchedAt: 0,
    readyAt: 0,
    viceBin: "x64sc",
    viceArgs: [],
    dryRun: false,
    monitorClients: {},
  };
  state.instances.set(port, instance);
  state.grants.set(targetId, { id: targetId, port, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });
  return state;
}

// --------------------------------------------------------------- test helpers

async function waitFor(predicate: () => boolean, deadlineMs: number, pollMs = 15): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return predicate();
}

/** A minimal line-oriented test client: send() writes one JSON line; next()
 * resolves with the next parsed response line, in arrival order, however
 * long it takes (used for the queued-acquire tests, where a response can
 * arrive well after the request was sent). */
function makeClient(port: number, host = "127.0.0.1") {
  const socket = connect({ port, host });
  const responses: Record<string, unknown>[] = [];
  const waiters: Array<(v: Record<string, unknown>) => void> = [];
  let buffer = "";
  socket.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.trim() === "") continue;
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const waiter = waiters.shift();
      if (waiter) waiter(parsed);
      else responses.push(parsed);
    }
  });
  return {
    socket,
    send(obj: Record<string, unknown>): void {
      socket.write(`${JSON.stringify(obj)}\n`);
    },
    next(timeoutMs = 3000): Promise<Record<string, unknown>> {
      if (responses.length > 0) return Promise.resolve(responses.shift()!);
      return new Promise((resolvePromise, reject) => {
        const timer = setTimeout(() => reject(new Error(`no response within ${timeoutMs}ms`)), timeoutMs);
        waiters.push((v) => {
          clearTimeout(timer);
          resolvePromise(v);
        });
      });
    },
    close(): void {
      socket.destroy();
    },
  };
}

interface StubDeps {
  /** Phase 33, plan 33-06: widened with the same OPTIONAL second parameter
   * StartControlListenerOptions.onAcquire took -- every pre-33-06 stub in
   * this file is a one-argument function and keeps satisfying this. Widened
   * AGAIN, Phase 63, plan 63-05 (SESS-06), with the same OPTIONAL THIRD
   * parameter carrying the already-sanitised session label. */
  onAcquire?: (id: string, profile?: LaunchProfile, label?: string | null) => Promise<AcquireOutcome>;
  onRelease?: (id: string) => void;
  onStatus?: () => StatusInstanceEntry[];
  onHostState?: () => HostStateFields;
  onMonitorClaim?: (requestId: string, targetId: string, channel: MonitorChannel) => MonitorClaimOutcome;
  onMonitorRelease?: (requestId: string, targetId: string, channel: MonitorChannel) => MonitorReleaseOutcome;
  /** Phase 63, plan 63-01: a required field on StartControlListenerOptions
   * as of this plan -- no pre-63-01 test in this file exercises `attach`
   * (broker-relay.test.ts is the home for that coverage), so the default
   * below is a no-op refusal, never called by any pre-existing case here. */
  onRelayAttach?: (targetId: string, channel: MonitorChannel, presentedHandle: string, socket: Socket, pending: Buffer) => RelayAttachOutcome;
  /** Phase 63, plan 63-03 (SESS-05): a required field on
   * StartControlListenerOptions as of this plan. Default answers `ok`
   * unconditionally -- every pre-63-03 test in this file that never sends
   * `operation` is unaffected. */
  onOperation?: (targetId: string, channel: MonitorChannel, name: string | null) => OperationNoteOutcome;
  /** Phase 64, plan 64-02 (XFER-04): OPTIONAL on StartControlListenerOptions
   * itself (vice-broker.mts does not wire it until plan 64-03), and absent
   * by default here too -- a `stage_file` request against a listener started
   * with no stub is refused `internal` by the dispatch arm's own
   * not-wired check, never by calling an undefined function. */
  onStageFile?: (targetId: string, slot: string) => StageFileOutcome;
  /** Phase 64, plan 64-02 (XFER-04): same optionality as onStageFile above. */
  onFileTransfer?: (request: FileTransferRequest, socket: Socket, pending: Buffer) => FileTransferOutcome;
  onHostTool?: (raw: unknown) => Promise<unknown>;
  /** Phase 65, plan 65-01 (SEAM-01): OPTIONAL on StartControlListenerOptions
   * itself (vice-broker.mts wires all three), and absent by default here
   * too -- a `host_tool_stage`/`host_tool_run` request against a listener
   * started with no stub is refused `internal` by the dispatch arm's own
   * not-wired check, mirroring onStageFile/onFileTransfer above. */
  onHostToolStage?: (files: HostToolStageFileSpec[]) => HostToolStageOutcome;
  onHostToolRun?: (requestKey: string, raw: unknown) => Promise<unknown>;
  onHostToolEnd?: (requestKey: string) => void;
  /** Plan 62-01: the `hello` reply's injectable version override, passed
   * straight through to StartControlListenerOptions.helloVersion. Absent by
   * default -- pre-existing tests never exercise `hello` and are unaffected. */
  helloVersion?: string;
}

async function startTestListener(deps: StubDeps = {}): Promise<{
  listener: StartControlListenerResult;
  token: string;
  releases: string[];
  monitorClaimCalls: string[];
  monitorReleaseCalls: string[];
  // Plan 41-03 (D-14): the channel each monitor_claim/monitor_release call
  // actually resolved to, in call order -- alongside the pre-existing
  // targetId-only arrays above (kept for every pre-41-03 assertion).
  monitorClaimChannels: MonitorChannel[];
  monitorReleaseChannels: MonitorChannel[];
  // Phase 63, plan 63-03: every `operation` call this listener answered, in
  // arrival order -- `name` recorded AFTER this listener's own sanitiser has
  // already run, matching what onOperation itself is handed in production.
  operationCalls: Array<{ targetId: string; channel: MonitorChannel; name: string | null }>;
  // Phase 64, plan 64-02 (XFER-04): every `stage_file`/`transfer` call this
  // listener actually forwarded to a supplied stub, in arrival order. Empty
  // when the test supplies no `onStageFile`/`onFileTransfer` stub -- see
  // this function's own conditional wiring below, which mirrors
  // StartControlListenerOptions' own optionality for these two callbacks.
  stageFileCalls: Array<{ targetId: string; slot: string }>;
  fileTransferCalls: FileTransferRequest[];
  // Phase 65, plan 65-01 (SEAM-01): every host_tool_stage/host_tool_run/
  // connection-close call this listener actually forwarded to a supplied
  // stub, in arrival order. Empty when the test supplies no
  // onHostToolStage/onHostToolRun stub, mirroring stageFileCalls/
  // fileTransferCalls above.
  hostToolStageCalls: HostToolStageFileSpec[][];
  hostToolRunCalls: Array<{ requestKey: string; raw: unknown }>;
  hostToolEndCalls: string[];
}> {
  const token = newControlToken();
  const releases: string[] = [];
  const monitorClaimCalls: string[] = [];
  const monitorReleaseCalls: string[] = [];
  const monitorClaimChannels: MonitorChannel[] = [];
  const monitorReleaseChannels: MonitorChannel[] = [];
  const operationCalls: Array<{ targetId: string; channel: MonitorChannel; name: string | null }> = [];
  const stageFileCalls: Array<{ targetId: string; slot: string }> = [];
  const fileTransferCalls: FileTransferRequest[] = [];
  const hostToolStageCalls: HostToolStageFileSpec[][] = [];
  const hostToolRunCalls: Array<{ requestKey: string; raw: unknown }> = [];
  const hostToolEndCalls: string[] = [];
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    token,
    onAcquire: deps.onAcquire ?? (async () => ({ ok: false, reason: "internal" }) as AcquireOutcome),
    onRelease: (id) => {
      releases.push(id);
      deps.onRelease?.(id);
    },
    onStatus: deps.onStatus ?? (() => []),
    onHostState:
      deps.onHostState ??
      (() => ({ pid: process.pid, startedAt: "2026-01-01T00:00:00Z", nodeVersion: process.version, viceBin: "x64sc", maxInstances: 16, basePort: 6600, backend: "stock" as const })),
    onMonitorClaim: (requestId, targetId, channel) => {
      monitorClaimCalls.push(targetId);
      monitorClaimChannels.push(channel);
      return deps.onMonitorClaim?.(requestId, targetId, channel) ?? ({ ok: false, code: "internal" } as MonitorClaimOutcome);
    },
    onMonitorRelease: (requestId, targetId, channel) => {
      monitorReleaseCalls.push(targetId);
      monitorReleaseChannels.push(channel);
      return deps.onMonitorRelease?.(requestId, targetId, channel) ?? ({ ok: false, code: "internal" } as MonitorReleaseOutcome);
    },
    onRelayAttach:
      deps.onRelayAttach ?? ((): RelayAttachOutcome => ({ ok: false, code: "internal" })),
    onOperation: (targetId, channel, name) => {
      operationCalls.push({ targetId, channel, name });
      return deps.onOperation?.(targetId, channel, name) ?? ({ ok: true } as OperationNoteOutcome);
    },
    // Phase 34, plan 34-01: a required field on StartControlListenerOptions
    // as of this plan -- no existing test in this file exercises host_tool
    // yet (task 2 adds that coverage), so this default is a no-op refusal,
    // never called by any pre-existing case here.
    onHostTool: deps.onHostTool ?? (async () => ({ ok: false, message: "no onHostTool stub configured" })),
    helloVersion: deps.helloVersion,
    // Phase 64, plan 64-02 (XFER-04): CONDITIONALLY wired, unlike every
    // callback above -- StartControlListenerOptions' own `onStageFile`/
    // `onFileTransfer` are OPTIONAL (vice-broker.mts does not wire either
    // until plan 64-03), so a test that supplies no stub here must see the
    // real "not wired" refusal the dispatch arm itself produces, not a
    // fabricated default answer this test fixture invented.
    onStageFile: deps.onStageFile
      ? (targetId: string, slot: string) => {
          stageFileCalls.push({ targetId, slot });
          return deps.onStageFile!(targetId, slot);
        }
      : undefined,
    onFileTransfer: deps.onFileTransfer
      ? (request: FileTransferRequest, socket: Socket, pending: Buffer) => {
          fileTransferCalls.push(request);
          return deps.onFileTransfer!(request, socket, pending);
        }
      : undefined,
    onHostToolStage: deps.onHostToolStage
      ? (files: HostToolStageFileSpec[]) => {
          hostToolStageCalls.push(files);
          return deps.onHostToolStage!(files);
        }
      : undefined,
    onHostToolRun: deps.onHostToolRun
      ? (requestKey: string, raw: unknown) => {
          hostToolRunCalls.push({ requestKey, raw });
          return deps.onHostToolRun!(requestKey, raw);
        }
      : undefined,
    onHostToolEnd: deps.onHostToolEnd
      ? (requestKey: string) => {
          hostToolEndCalls.push(requestKey);
          deps.onHostToolEnd!(requestKey);
        }
      : undefined,
  });
  return {
    listener,
    token,
    releases,
    monitorClaimCalls,
    monitorReleaseCalls,
    monitorClaimChannels,
    monitorReleaseChannels,
    operationCalls,
    stageFileCalls,
    fileTransferCalls,
    hostToolStageCalls,
    hostToolRunCalls,
    hostToolEndCalls,
  };
}

// ============================================================================
// Task 1: status, host_state, and the arrival-ordered pending queue.
// ============================================================================

test("recycle is not an op: a recycle request is answered bad_request as an unknown op", async () => {
  const { listener, token } = await startTestListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "recycle", id: "recycle-1", target_id: "anything", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.match(String(resp.message), /unknown op: recycle/);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("status: one entry per instance, carrying port, url, state, reason, epoch and hasMonitorClient", async () => {
  const entries: StatusInstanceEntry[] = [
    { port: 6600, url: "http://127.0.0.1:6600/mcp", state: "ready", reason: "spare", epoch: 1, hasMonitorClient: false, sessionLabel: null, grantId: null, operation: null },
    { port: 6601, url: "http://127.0.0.1:6601/mcp", state: "granted", reason: "acquire", epoch: 2, hasMonitorClient: true, sessionLabel: "my-session-1234", grantId: "req-1", operation: null },
  ];
  const { listener, token } = await startTestListener({ onStatus: () => entries });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "status", token });
    const resp = await client.next();
    assert.equal(resp.kind, "status");
    assert.deepEqual(resp.instances, entries);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("host_state: carries the broker pid, node version, resolved emulator binary, instance ceiling and band base", async () => {
  const { listener, token } = await startTestListener({
    onHostState: () => ({ pid: 12345, startedAt: "2026-08-04T00:00:00Z", nodeVersion: "v24.0.0", viceBin: "/usr/bin/x64sc", maxInstances: 16, basePort: 6600, backend: "stock" as const }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "host_state", token });
    const resp = await client.next();
    assert.equal(resp.kind, "host_state");
    assert.equal(resp.pid, 12345);
    assert.equal(resp.node_version, "v24.0.0");
    assert.equal(resp.vice_bin, "/usr/bin/x64sc");
    // Plan 41-05 (folded todo): warm_floor is DELETED, not merely renamed --
    // the warm floor itself is retired, and a published field whose knob no
    // longer exists is false documentation. Asserted absent rather than
    // simply un-asserted, so a regression that reintroduces the field is
    // caught here.
    assert.equal(Object.prototype.hasOwnProperty.call(resp, "warm_floor"), false, "the host_state wire response must not carry a warm_floor field");
    assert.equal(resp.max_instances, 16);
    assert.equal(resp.base_port, 6600);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("WR-04 host_state: carries the broker's OWN backend verdict on the wire", async () => {
  const backend = "stock" as const;
  const { listener, token } = await startTestListener({
    onHostState: () => ({
      pid: 12345,
      startedAt: "2026-08-13T00:00:00Z",
      nodeVersion: "v24.0.0",
      viceBin: "/usr/bin/x64sc",
      maxInstances: 16,
      basePort: 6600,
      backend,
    }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "host_state", token });
    const resp = await client.next();
    assert.equal(resp.kind, "host_state");
    assert.equal(resp.backend, backend, "the wire must carry the verdict that actually decided the emulator's launch argv");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("neither the status nor the host_state response ever carries the token value", async () => {
  const { listener, token } = await startTestListener({
    onStatus: () => [{ port: 6600, url: "http://127.0.0.1:6600/mcp", state: "ready", reason: "spare", epoch: 1, hasMonitorClient: false, sessionLabel: null, grantId: null, operation: null }],
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "status", token });
    const statusResp = await client.next();
    assert.ok(!JSON.stringify(statusResp).includes(token), "status response must never contain the token string");

    client.send({ op: "host_state", token });
    const hostResp = await client.next();
    assert.ok(!JSON.stringify(hostResp).includes(token), "host_state response must never contain the token string");
  } finally {
    client.close();
    listener.server.close();
  }
});

// ============================================================================
// Plan 05, Task 1: monitor_claim/monitor_release -- wire-level dispatch
// against injected onMonitorClaim/onMonitorRelease stubs (the real ownership
// logic -- comparing grantId, idempotency, clearing -- is vice-broker.mts's
// own handleMonitorClaim()/handleMonitorRelease(), unit-tested directly
// there; this section proves only the framing, the token gate, the
// PER-CONNECTION ownership gate (CR-03) and the response envelope this
// listener owns).
//
// CR-03 (code review 2026-08-13): every test below now ACQUIRES first, so the
// connection genuinely holds the grant it names. They previously sent a
// target_id on a connection that had never acquired anything and were served
// -- which encoded the very gap the review found rather than catching it. A
// grant a connection does not hold is now `denied`, and that denial is
// asserted separately below.
// ============================================================================

/** The grant-issuing stub every monitor-op test below acquires through, so
 * `target_id: "req-a"` is a grant THIS connection actually holds. */
function grantingAcquire(): (id: string) => Promise<AcquireOutcome> {
  return async () => ({ ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/epoch.json", supervisorDir: "/tmp/6600" } });
}

/** Acquires grant `id` over `client` and asserts the grant arrived, so every
 * monitor-op test starts from a connection that owns what it names. */
async function acquireGrant(client: ReturnType<typeof makeClient>, token: string, id: string): Promise<void> {
  client.send({ op: "acquire", id, token });
  const grant = await client.next();
  assert.equal(grant.kind, "grant", `precondition: the connection must hold grant ${id}`);
}

test("monitor_claim: an ok stub answers the monitor_claimed response kind", async () => {
  const { listener, token, monitorClaimCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorClaim: () => ({ ok: true, handle: "test-handle" }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "monitor_claim", id: "claim-1", target_id: "req-a", token });
    const resp = await client.next();
    assert.equal(resp.kind, "monitor_claimed");
    assert.deepEqual(monitorClaimCalls, ["req-a"]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_claim: a monitor_owned stub answers an error carrying code monitor_owned and the holder's own grantId/claimedAt/pid/channel, worded as an ownership conflict", async () => {
  const { listener, token } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorClaim: () => ({ ok: false, code: "monitor_owned", holder: { grantId: "req-a", claimedAt: 111, pid: 4242, channel: "binary" } }),
  });
  const client = makeClient(listener.port);
  try {
    // This connection legitimately holds req-b; the instance behind it is
    // already claimed by a DIFFERENT grant (req-a). That is the genuine
    // ownership conflict, distinct from CR-03's spoofing case below.
    await acquireGrant(client, token, "req-b");
    client.send({ op: "monitor_claim", id: "claim-1", target_id: "req-b", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "monitor_owned");
    assert.deepEqual(resp.holder, { grantId: "req-a", claimedAt: 111, pid: 4242, channel: "binary" });
    assert.match(String(resp.message), /ownership conflict/i);
    assert.doesNotMatch(String(resp.message), /wedge|hung|unresponsive/i, "a monitor_owned refusal must never read as a wedge or a hang");
  } finally {
    client.close();
    listener.server.close();
  }
});

// ============================================================================
// Plan 41-03 (D-14): the `channel` axis -- items 4-9 of the plan's own list.
// ============================================================================

test("monitor_claim (D-14): claiming 'text' on an instance whose 'binary' channel is held by a DIFFERENT grant succeeds -- the two channels are independent", async () => {
  const { listener, token, monitorClaimChannels } = await startTestListener({
    onAcquire: grantingAcquire(),
    // The stub models a real per-channel map: "binary" is already held by
    // "req-a", "text" has no holder at all yet.
    onMonitorClaim: (_requestId, targetId, channel) => {
      if (channel === "binary" && targetId !== "req-a") {
        return { ok: false, code: "monitor_owned", holder: { grantId: "req-a", claimedAt: 111, pid: 4242, channel: "binary" } };
      }
      return { ok: true, handle: "test-handle" };
    },
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-b");
    client.send({ op: "monitor_claim", id: "claim-1", target_id: "req-b", channel: "text", token });
    const resp = await client.next();
    assert.equal(resp.kind, "monitor_claimed");
    assert.deepEqual(monitorClaimChannels, ["text"]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_claim (D-14): a 'text' claim from a second grant while a first grant holds 'text' is refused monitor_owned, naming the first grant's id and the text channel, with no wedge/hang/frozen/stuck/unresponsive vocabulary", async () => {
  const { listener, token } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorClaim: () => ({ ok: false, code: "monitor_owned", holder: { grantId: "req-first", claimedAt: 222, pid: 4242, channel: "text" } }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-second");
    client.send({ op: "monitor_claim", id: "claim-1", target_id: "req-second", channel: "text", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "monitor_owned");
    assert.deepEqual(resp.holder, { grantId: "req-first", claimedAt: 222, pid: 4242, channel: "text" });
    assert.match(String(resp.message), /req-first/);
    assert.match(String(resp.message), /text/);
    assert.doesNotMatch(String(resp.message), /wedge|hang|frozen|stuck|unresponsive/i);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_claim (D-14): an unrecognised non-empty channel value is bad_request, naming both accepted values", async () => {
  const { listener, token, monitorClaimCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorClaim: () => ({ ok: true, handle: "test-handle" }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "monitor_claim", id: "claim-1", target_id: "req-a", channel: "drive", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.match(String(resp.message), /"binary"/);
    assert.match(String(resp.message), /"text"/);
    assert.deepEqual(monitorClaimCalls, [], "an invalid channel must be refused BEFORE onMonitorClaim ever runs");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_claim (D-14): no channel field at all behaves exactly as channel: 'binary' -- the backward-compatibility case", async () => {
  const { listener, token, monitorClaimChannels } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorClaim: () => ({ ok: true, handle: "test-handle" }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "monitor_claim", id: "claim-1", target_id: "req-a", token });
    const resp = await client.next();
    assert.equal(resp.kind, "monitor_claimed");
    assert.deepEqual(monitorClaimChannels, ["binary"]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_release (D-14): no channel field at all behaves exactly as channel: 'binary'", async () => {
  const { listener, token, monitorReleaseChannels } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorRelease: () => ({ ok: true }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "monitor_release", id: "release-1", target_id: "req-a", token });
    const resp = await client.next();
    assert.equal(resp.kind, "monitor_released");
    assert.deepEqual(monitorReleaseChannels, ["binary"]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_release (D-14): an unrecognised non-empty channel value is bad_request, naming both accepted values", async () => {
  const { listener, token, monitorReleaseCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorRelease: () => ({ ok: true }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "monitor_release", id: "release-1", target_id: "req-a", channel: "drive", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.match(String(resp.message), /"binary"/);
    assert.match(String(resp.message), /"text"/);
    assert.deepEqual(monitorReleaseCalls, [], "an invalid channel must be refused BEFORE onMonitorRelease ever runs");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("status (D-14): hasMonitorClient is true when only the text channel is claimed", async () => {
  const entries: StatusInstanceEntry[] = [{ port: 6600, url: "http://127.0.0.1:6600/mcp", state: "granted", reason: "acquire", epoch: 1, hasMonitorClient: true, sessionLabel: null, grantId: null, operation: null }];
  const { listener, token } = await startTestListener({ onStatus: () => entries });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "status", token });
    const resp = await client.next();
    assert.equal(resp.kind, "status");
    assert.deepEqual((resp.instances as StatusInstanceEntry[])[0]?.hasMonitorClient, true);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_claim: a repeated claim from the same grant id is idempotent -- the stub answers ok both times, no conflict", async () => {
  const { listener, token, monitorClaimCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorClaim: (_requestId, targetId) => (targetId === "req-a" ? { ok: true, handle: "test-handle" } : { ok: false, code: "internal" }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "monitor_claim", id: "claim-1", target_id: "req-a", token });
    const first = await client.next();
    assert.equal(first.kind, "monitor_claimed");

    client.send({ op: "monitor_claim", id: "claim-2", target_id: "req-a", token });
    const second = await client.next();
    assert.equal(second.kind, "monitor_claimed");

    assert.deepEqual(monitorClaimCalls, ["req-a", "req-a"]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_claim: a target_id this connection holds but the broker cannot resolve answers bad_request via the stub's own outcome, not internal", async () => {
  const { listener, token } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorClaim: () => ({ ok: false, code: "bad_request" }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "no-such-grant");
    client.send({ op: "monitor_claim", id: "claim-1", target_id: "no-such-grant", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
  } finally {
    client.close();
    listener.server.close();
  }
});

// --------------------------------------------------------------------------
// CR-03: the per-connection ownership gate itself.
// --------------------------------------------------------------------------

test("CR-03 monitor_claim: a connection holding grant A is DENIED when it names grant B, and the callback never runs", async () => {
  const { listener, token, monitorClaimCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorClaim: () => ({ ok: true, handle: "test-handle" }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "grant-a");
    client.send({ op: "monitor_claim", id: "claim-1", target_id: "grant-b", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "denied");
    assert.match(String(resp.message), /only target the grant this connection itself holds/i);
    assert.doesNotMatch(String(resp.message), /wedge|hung|unresponsive/i);
    assert.deepEqual(monitorClaimCalls, [], "the denial must land BEFORE onMonitorClaim, so instance.monitorClient is never mutated");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("CR-03 monitor_release: a connection holding grant A is DENIED when it tries to release grant B -- releasing another session's live claim is not possible", async () => {
  const { listener, token, monitorReleaseCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorRelease: () => ({ ok: true }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "grant-a");
    client.send({ op: "monitor_release", id: "release-1", target_id: "grant-b", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "denied");
    assert.deepEqual(monitorReleaseCalls, [], "the denial must land BEFORE onMonitorRelease, so no claim is cleared");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("CR-03: a connection that never acquired anything is DENIED both monitor ops, whatever target_id it names", async () => {
  const { listener, token, monitorClaimCalls, monitorReleaseCalls } = await startTestListener({
    onMonitorClaim: () => ({ ok: true, handle: "test-handle" }),
    onMonitorRelease: () => ({ ok: true }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "monitor_claim", id: "claim-1", target_id: "req-b", token });
    const claimResp = await client.next();
    assert.equal(claimResp.kind, "error");
    assert.equal(claimResp.code, "denied");

    client.send({ op: "monitor_release", id: "release-1", target_id: "req-b", token });
    const releaseResp = await client.next();
    assert.equal(releaseResp.kind, "error");
    assert.equal(releaseResp.code, "denied");

    assert.deepEqual(monitorClaimCalls, []);
    assert.deepEqual(monitorReleaseCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("CR-03: an explicit `release` drops the connection's grant, after which its own monitor ops are denied too", async () => {
  const { listener, token, monitorClaimCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorClaim: () => ({ ok: true, handle: "test-handle" }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "grant-a");
    client.send({ op: "release", token });
    const released = await client.next();
    assert.equal(released.kind, "released");

    client.send({ op: "monitor_claim", id: "claim-1", target_id: "grant-a", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "denied");
    assert.deepEqual(monitorClaimCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_claim: a missing target_id is refused bad_request before the callback is ever invoked", async () => {
  const { listener, token, monitorClaimCalls } = await startTestListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "monitor_claim", id: "claim-1", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.deepEqual(monitorClaimCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_claim/monitor_release: both ops are refused unauthorized when the token is wrong, before the callback is ever invoked", async () => {
  const { listener, monitorClaimCalls, monitorReleaseCalls } = await startTestListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "monitor_claim", id: "c-1", target_id: "req-a", token: "wrong" });
    const claimResp = await client.next();
    assert.equal(claimResp.kind, "error");
    assert.equal(claimResp.code, "unauthorized");

    client.send({ op: "monitor_release", id: "r-1", target_id: "req-a", token: "wrong" });
    // The connection was already destroyed by the first unauthorized
    // request (matching every other op's own token-gate behaviour) -- no
    // second response is expected; assert only that neither callback ran.
    assert.deepEqual(monitorClaimCalls, []);
    assert.deepEqual(monitorReleaseCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_release: an ok stub answers the monitor_released response kind", async () => {
  const { listener, token, monitorReleaseCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorRelease: () => ({ ok: true }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "monitor_release", id: "release-1", target_id: "req-a", token });
    const resp = await client.next();
    assert.equal(resp.kind, "monitor_released");
    assert.deepEqual(monitorReleaseCalls, ["req-a"]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("monitor_release: a broker-side non-holder outcome answers a refusal, not silent success", async () => {
  const { listener, token } = await startTestListener({
    onAcquire: grantingAcquire(),
    onMonitorRelease: () => ({ ok: false, code: "denied" }),
  });
  const client = makeClient(listener.port);
  try {
    // The connection legitimately holds req-b -- the refusal here comes from
    // the BROKER's own holder comparison, not from the control-plane
    // ownership gate CR-03 added (which is covered separately above).
    await acquireGrant(client, token, "req-b");
    client.send({ op: "monitor_release", id: "release-1", target_id: "req-b", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "denied");
  } finally {
    client.close();
    listener.server.close();
  }
});

// ============================================================================
// Phase 63, plan 63-03 (SESS-05): the `operation` op -- wire-level dispatch
// (token gate, the SAME ownsTarget() predicate as monitor_claim/
// monitor_release, the channel resolver, the sanitiser) against the
// injected onOperation stub. The actual grant-storage behaviour (what
// handleOperationNote() does once called) is unit-tested directly in
// vice-broker-acquire.test.ts, mirroring this file's own header comment
// about handleMonitorClaim()/handleMonitorRelease().
// ============================================================================

test("operation: a declaration from a connection that owns the named grant is accepted, and the callback observes the ALREADY-SANITISED name", async () => {
  const { listener, token, operationCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "operation", id: "op-1", target_id: "req-a", name: "vice_run_until", token });
    const resp = await client.next();
    assert.equal(resp.kind, "operation_noted");
    assert.deepEqual(operationCalls, [{ targetId: "req-a", channel: "binary", name: "vice_run_until" }]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("operation: a declaration naming a grant this connection does NOT hold is refused denied, with the SAME ownership wording monitor_claim/monitor_release share, and the callback never runs", async () => {
  const { listener, token, operationCalls } = await startTestListener({ onAcquire: grantingAcquire() });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-b");
    client.send({ op: "operation", id: "op-1", target_id: "someone-elses-grant", name: "vice_ping", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "denied");
    assert.match(String(resp.message), /may only target the grant this connection itself holds/);
    assert.deepEqual(operationCalls, [], "a denied declaration must never reach the broker's own callback");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("operation: a missing target_id is refused bad_request before the callback is ever invoked", async () => {
  const { listener, token, operationCalls } = await startTestListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "operation", id: "op-1", name: "vice_ping", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.deepEqual(operationCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("operation: an unrecognised non-empty channel value is bad_request, naming both accepted values, and the callback never runs", async () => {
  const { listener, token, operationCalls } = await startTestListener({ onAcquire: grantingAcquire() });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "operation", id: "op-1", target_id: "req-a", channel: "video", name: "vice_ping", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.match(String(resp.message), /"binary"/);
    assert.match(String(resp.message), /"text"/);
    assert.deepEqual(operationCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("operation: no channel field at all behaves exactly as channel: 'binary'", async () => {
  const { listener, token, operationCalls } = await startTestListener({ onAcquire: grantingAcquire() });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "operation", id: "op-1", target_id: "req-a", name: "vice_ping", token });
    await client.next();
    assert.deepEqual(operationCalls, [{ targetId: "req-a", channel: "binary", name: "vice_ping" }]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("operation: name null clears -- the callback observes null verbatim, never an empty string", async () => {
  const { listener, token, operationCalls } = await startTestListener({ onAcquire: grantingAcquire() });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "operation", id: "op-1", target_id: "req-a", name: null, token });
    const resp = await client.next();
    assert.equal(resp.kind, "operation_noted");
    assert.deepEqual(operationCalls, [{ targetId: "req-a", channel: "binary", name: null }]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("operation: a name that is neither a string nor null is refused bad_request, naming the offending value, before the callback runs", async () => {
  const { listener, token, operationCalls } = await startTestListener({ onAcquire: grantingAcquire() });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "operation", id: "op-1", target_id: "req-a", name: 42, token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.match(String(resp.message), /42/);
    assert.deepEqual(operationCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("operation: a broker-side bad_request outcome (the should-be-unreachable missing-grant race) is forwarded verbatim, not internal", async () => {
  const { listener, token } = await startTestListener({
    onAcquire: grantingAcquire(),
    onOperation: () => ({ ok: false, code: "bad_request" }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "operation", id: "op-1", target_id: "req-a", name: "vice_ping", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("operation: unauthorized when the token is wrong, before the callback is ever invoked", async () => {
  const { listener, operationCalls } = await startTestListener({ onAcquire: grantingAcquire() });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "operation", id: "op-1", target_id: "req-a", name: "vice_ping", token: "wrong" });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "unauthorized");
    assert.deepEqual(operationCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

// ---------------------------------------------------------------------------
// sanitiseSessionLabel() -- the T-63-10 mitigation, exported so Plan 63-05
// can reuse it verbatim for the session label. Tested here directly
// (a pure function), and again indirectly above (the `operation` dispatch
// arm runs every string `name` through it before the callback ever sees it).
// ---------------------------------------------------------------------------

test("operation: Task 3 ordering proof -- a declare, the wrapped work, then a clear are all issued without ever awaiting either reply, and the broker still observes them in order", async () => {
  const { listener, token, operationCalls } = await startTestListener({ onAcquire: grantingAcquire() });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");

    let wrappedWorkDone = false;
    // Fire the declare WITHOUT awaiting its reply -- mirrors
    // stock-session.ts's declareOperation()/text-tools.ts's own
    // fire-and-forget discipline exactly: neither reads a response before
    // moving on.
    client.send({ op: "operation", id: "op-declare", target_id: "req-a", name: "vice_run_until", token });
    // The "wrapped work" a real tool call performs happens HERE,
    // synchronously, before this test ever reads a response line --
    // proving the calling code is never blocked on the declaration's own
    // reply (T-63-13).
    wrappedWorkDone = true;
    // Clear, also without awaiting.
    client.send({ op: "operation", id: "op-clear", target_id: "req-a", name: null, token });

    assert.equal(wrappedWorkDone, true, "the wrapped work must complete without ever waiting for the declaration's reply");

    // NOW read both replies (arrival order) and separately the broker's own
    // recorded call order, proving both requests actually reached the
    // broker and were answered/observed in the order they were sent.
    const declareResp = await client.next();
    const clearResp = await client.next();
    assert.equal(declareResp.kind, "operation_noted");
    assert.equal(clearResp.kind, "operation_noted");
    assert.deepEqual(
      operationCalls,
      [
        { targetId: "req-a", channel: "binary", name: "vice_run_until" },
        { targetId: "req-a", channel: "binary", name: null },
      ],
      "the broker must observe the declare THEN the clear, in that order, for one logical operation",
    );
  } finally {
    client.close();
    listener.server.close();
  }
});

// ============================================================================
// Phase 64, plan 64-02 (XFER-04, D-01): `stage_file` and `transfer` -- the two
// new file-transfer ops. `stage_file` mints a handle over the GRANT-HOLDING
// connection, gated by the SAME ownsTarget() predicate every other
// target-naming op shares. `transfer` presents that handle over a BRAND-NEW
// connection and is deliberately NOT gated by ownsTarget() -- the T-63-01
// precedent `attach` already established.
// ============================================================================

test("stage_file: a request from a non-owning connection is refused denied, and the onStageFile callback is never invoked", async () => {
  const { listener, token, stageFileCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onStageFile: () => ({ ok: true, handle: "should-never-be-minted", emulatorFilename: "/never/reached" }),
  });
  const client = makeClient(listener.port);
  try {
    // This connection holds NO grant at all -- req-a belongs to nobody it owns.
    client.send({ op: "stage_file", id: "stage-1", target_id: "req-a", slot: "autostart", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "denied");
    assert.deepEqual(stageFileCalls, [], "onStageFile must never be invoked for a connection that does not own the target");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("stage_file: a request missing target_id or slot is refused bad_request, and the callback is never invoked", async () => {
  const { listener, token, stageFileCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onStageFile: () => ({ ok: true, handle: "unused", emulatorFilename: "/unused" }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");

    client.send({ op: "stage_file", id: "stage-missing-slot", target_id: "req-a", token });
    const missingSlot = await client.next();
    assert.equal(missingSlot.kind, "error");
    assert.equal(missingSlot.code, "bad_request");

    client.send({ op: "stage_file", id: "stage-missing-target", slot: "autostart", token });
    const missingTarget = await client.next();
    assert.equal(missingTarget.kind, "error");
    assert.equal(missingTarget.code, "bad_request");

    assert.deepEqual(stageFileCalls, [], "onStageFile must never be invoked for a malformed request");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("stage_file: a request from the owning connection is answered file_staged, with a handle and emulator_filename the request did not supply", async () => {
  const { listener, token, stageFileCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onStageFile: (targetId, slot) => ({ ok: true, handle: `handle-for-${targetId}-${slot}`, emulatorFilename: `/staging/${targetId}/${slot}.bin` }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "stage_file", id: "stage-1", target_id: "req-a", slot: "autostart", token });
    const resp = await client.next();
    assert.equal(resp.kind, "file_staged");
    assert.equal(resp.handle, "handle-for-req-a-autostart");
    assert.equal(resp.emulator_filename, "/staging/req-a/autostart.bin");
    assert.deepEqual(stageFileCalls, [{ targetId: "req-a", slot: "autostart" }]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("stage_file: a callback refusal is forwarded verbatim as an error naming the callback's own code", async () => {
  const { listener, token } = await startTestListener({
    onAcquire: grantingAcquire(),
    onStageFile: () => ({ ok: false, code: "internal" }),
  });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "stage_file", id: "stage-1", target_id: "req-a", slot: "autostart", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "internal");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("stage_file: against a listener with NO onStageFile stub configured, the request is refused internal rather than crashing the connection", async () => {
  const { listener, token } = await startTestListener({ onAcquire: grantingAcquire() });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    client.send({ op: "stage_file", id: "stage-1", target_id: "req-a", slot: "autostart", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "internal");
    // Prove the connection is still alive and answering ordinary requests --
    // a crash would have destroyed the socket rather than merely refusing.
    client.send({ op: "status", token });
    const statusResp = await client.next();
    assert.equal(statusResp.kind, "status");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("transfer: a request with an empty or missing handle is refused bad_request, and the connection's own line reader is left running", async () => {
  const { listener, token } = await startTestListener({
    onFileTransfer: (): FileTransferOutcome => ({ ok: true }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "transfer", id: "t-1", direction: "download", handle: "", token });
    const missingHandle = await client.next();
    assert.equal(missingHandle.kind, "error");
    assert.equal(missingHandle.code, "bad_request");

    // The line reader must still be running -- a well-formed request
    // afterwards is dispatched normally.
    client.send({ op: "status", token });
    const statusResp = await client.next();
    assert.equal(statusResp.kind, "status");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("transfer: a request naming a direction other than upload or download is refused bad_request by name", async () => {
  const { listener, token } = await startTestListener({
    onFileTransfer: (): FileTransferOutcome => ({ ok: true }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "transfer", id: "t-1", direction: "sideways", handle: "some-handle", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.match(String(resp.message), /direction/i);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("transfer: an upload missing byteLength or sha256 is refused bad_request before the callback runs", async () => {
  const { listener, token, fileTransferCalls } = await startTestListener({
    onFileTransfer: (): FileTransferOutcome => ({ ok: true }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "transfer", id: "t-1", direction: "upload", handle: "some-handle", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.deepEqual(fileTransferCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("transfer: a valid handle flips this connection out of line-reading mode BEFORE the callback runs -- a well-formed second JSON line afterwards is NOT dispatched", async () => {
  const { listener, token, fileTransferCalls } = await startTestListener({
    onFileTransfer: (): FileTransferOutcome => ({ ok: true }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "transfer", id: "t-1", direction: "download", handle: "a-valid-handle", token });
    // No reply is written on success (the callback owns every further reply
    // line) -- prove the second line is never dispatched by sending an
    // ordinary op that WOULD answer if the reader were still running, then
    // racing it against a short timer.
    client.send({ op: "status", token });
    let sawStatus = false;
    const raced = await Promise.race([
      client.next(1000).then((resp) => {
        sawStatus = resp.kind === "status";
        return "responded";
      }),
      new Promise((resolve) => setTimeout(() => resolve("timed-out"), 300)),
    ]);
    assert.equal(raced, "timed-out", "the second line must never be dispatched -- this connection's line reader stopped");
    assert.equal(sawStatus, false);
    assert.equal(fileTransferCalls.length, 1, "the callback must have been invoked exactly once, for the transfer request itself");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("transfer: a callback refusal restores the connection's line reader -- a well-formed second request line afterwards IS dispatched", async () => {
  const { listener, token } = await startTestListener({
    onFileTransfer: (): FileTransferOutcome => ({ ok: false, code: "denied", message: "vice: no staged file for this handle" }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "transfer", id: "t-1", direction: "download", handle: "an-unknown-handle", token });
    const refusal = await client.next();
    assert.equal(refusal.kind, "error");
    assert.equal(refusal.code, "denied");
    assert.match(String(refusal.message), /no staged file/);

    // The line reader must have resumed -- a well-formed request afterwards
    // is dispatched normally, on the SAME connection.
    client.send({ op: "status", token });
    const statusResp = await client.next();
    assert.equal(statusResp.kind, "status");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("transfer: ownsTarget() is never consulted -- a valid handle succeeds over a connection that holds no grant at all", async () => {
  const { listener, token, fileTransferCalls } = await startTestListener({
    onFileTransfer: (): FileTransferOutcome => ({ ok: true }),
  });
  const client = makeClient(listener.port);
  try {
    // This connection never sent `acquire` at all -- it holds no grant.
    client.send({ op: "transfer", id: "t-1", direction: "upload", handle: "a-valid-handle", byteLength: 1024, sha256: "a".repeat(64), token });

    // No reply on success; prove the callback ran with the correctly
    // narrowed upload request rather than being refused for lack of a grant.
    await waitFor(() => fileTransferCalls.length === 1, 1000);
    assert.deepEqual(fileTransferCalls, [{ direction: "upload", handle: "a-valid-handle", byteLength: 1024, sha256: "a".repeat(64) }]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("transfer: against a listener with NO onFileTransfer stub configured, the request is refused internal rather than crashing the connection, and the line reader is left running", async () => {
  const { listener, token } = await startTestListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "transfer", id: "t-1", direction: "download", handle: "some-handle", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "internal");

    client.send({ op: "status", token });
    const statusResp = await client.next();
    assert.equal(statusResp.kind, "status");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("stage_file: unauthorized when the token is wrong, before the callback is ever invoked", async () => {
  const { listener, stageFileCalls } = await startTestListener({
    onAcquire: grantingAcquire(),
    onStageFile: () => ({ ok: true, handle: "x", emulatorFilename: "/x" }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "stage_file", id: "stage-1", target_id: "req-a", slot: "autostart", token: "wrong-token" });
    const stageResp = await client.next();
    assert.equal(stageResp.kind, "error");
    assert.equal(stageResp.code, "unauthorized");
    assert.deepEqual(stageFileCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

// Plan 64-08 (G-64-1 gap closure, Task 2): SPLIT off the `transfer` half of
// the test above -- `transfer` no longer sits after the token gate (route
// (b), owner decision 5), so a wrong token, or no token at all, must reach
// onFileTransfer exactly as a correct one would; the token is neither
// required nor read for this op any more.
test("transfer: a wrong token, and a request with no token field at all, both still reach onFileTransfer -- G-64-1 route (b), the token is neither required nor read for this op", async () => {
  const { listener, fileTransferCalls } = await startTestListener({
    onFileTransfer: (): FileTransferOutcome => ({ ok: true }),
  });

  const wrongTokenClient = makeClient(listener.port);
  try {
    wrongTokenClient.send({ op: "transfer", id: "t-wrong-token", direction: "download", handle: "handle-wrong-token", token: "wrong-token" });
    const sawWrongToken = await waitFor(() => fileTransferCalls.some((c) => "handle" in c && c.handle === "handle-wrong-token"), 1000);
    assert.ok(sawWrongToken, "a transfer line carrying a wrong token must still reach onFileTransfer -- the token is not read for this op");
  } finally {
    wrongTokenClient.close();
  }

  const noTokenClient = makeClient(listener.port);
  try {
    noTokenClient.send({ op: "transfer", id: "t-no-token", direction: "download", handle: "handle-no-token" });
    const sawNoToken = await waitFor(() => fileTransferCalls.some((c) => "handle" in c && c.handle === "handle-no-token"), 1000);
    assert.ok(sawNoToken, "a transfer line with no token field at all must still reach onFileTransfer");
  } finally {
    noTokenClient.close();
    listener.server.close();
  }
});

// ============================================================================
// Phase 65, plan 65-01 (SEAM-01): host_tool_stage/host_tool_run coexist with
// the legacy token-gated host_tool op, bind to their own connection, and
// clean up on close (Task 2, behaviours 1-5). Behaviours 6-10 live in
// host-tool-endpoint.test.ts, against the real, compiled broker (a harness
// broker), because they need a real transfer connection.
// ============================================================================

test("Test 1: a host_tool line with no token answers unauthorized and destroys the connection; the same line with the real token reaches onHostTool -- the legacy op is unchanged", async () => {
  const hostToolCalls: unknown[] = [];
  const { listener, token } = await startTestListener({
    onHostTool: async (raw) => {
      hostToolCalls.push(raw);
      return { ok: false, message: "no real tool run in this test" };
    },
  });

  const noTokenClient = makeClient(listener.port);
  try {
    noTokenClient.send({ op: "host_tool", id: "ht-1", tool: "acme.build", args: {} });
    const resp = await noTokenClient.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "unauthorized");
    const destroyed = await waitFor(() => noTokenClient.socket.destroyed, 1000);
    assert.ok(destroyed, "a token-less host_tool line must destroy the connection, exactly like any other post-gate op");
    assert.deepEqual(hostToolCalls, [], "onHostTool must never be invoked for a token-less request");
  } finally {
    noTokenClient.close();
  }

  const realTokenClient = makeClient(listener.port);
  try {
    realTokenClient.send({ op: "host_tool", id: "ht-2", tool: "acme.build", args: {}, token });
    const resp = await realTokenClient.next();
    assert.equal(resp.ok, false);
    assert.equal(hostToolCalls.length, 1, "onHostTool must be invoked exactly once for the real-token request");
  } finally {
    realTokenClient.close();
    listener.server.close();
  }
});

test("Test 2: host_tool_stage and host_tool_run sent with no token are answered (not unauthorized), proving they sit ahead of the gate", async () => {
  const { listener, hostToolStageCalls, hostToolRunCalls } = await startTestListener({
    onHostToolStage: (files) => ({ ok: true, requestKey: "ht-test-2", treeHandles: files.map((_, i) => `tree-${i}`), fileHandles: files.map((_, i) => `file-${i}`) }),
    onHostToolRun: async () => ({ ok: false, message: "no real tool run in this test" }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "host_tool_stage", files: [{ tree: 0, rel: "a.a", byteLength: 4 }] });
    const stageResp = await client.next();
    assert.notEqual(stageResp.kind, "error", `host_tool_stage with no token must not be refused, got ${JSON.stringify(stageResp)}`);
    assert.equal(stageResp.kind, "host_tool_staged");
    assert.equal(stageResp.request, "ht-test-2");
    assert.deepEqual(hostToolStageCalls, [[{ tree: 0, rel: "a.a", byteLength: 4 }]]);

    client.send({ op: "host_tool_run", tool: "acme.build", args: {}, request: "ht-test-2" });
    const runResp = await client.next();
    assert.notEqual((runResp as { kind?: unknown }).kind, "error", `host_tool_run with no token must not be refused, got ${JSON.stringify(runResp)}`);
    assert.equal(runResp.ok, false);
    assert.equal(hostToolRunCalls.length, 1);
    assert.equal(hostToolRunCalls[0]!.requestKey, "ht-test-2");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("Test 3: host_tool_run on a fresh connection with no prior stage answers denied; a request minted on connection A is refused denied when presented on connection B", async () => {
  let stageCounter = 0;
  const { listener, hostToolRunCalls } = await startTestListener({
    onHostToolStage: () => ({ ok: true, requestKey: `ht-test-3-${stageCounter++}`, treeHandles: [], fileHandles: [] }),
    onHostToolRun: async () => ({ ok: false, message: "must never be reached" }),
  });

  const freshClient = makeClient(listener.port);
  try {
    freshClient.send({ op: "host_tool_run", tool: "acme.build", args: {}, request: "whatever" });
    const resp = await freshClient.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "denied");
  } finally {
    freshClient.close();
  }

  const connectionA = makeClient(listener.port);
  const connectionB = makeClient(listener.port);
  try {
    connectionA.send({ op: "host_tool_stage", files: [] });
    const stageRespA = await connectionA.next();
    assert.equal(stageRespA.kind, "host_tool_staged");
    const mintedKeyA = stageRespA.request as string;

    // B has NO stage of its own -- presenting A's key must still be denied.
    connectionB.send({ op: "host_tool_run", tool: "acme.build", args: {}, request: mintedKeyA });
    const crossRespNoStage = await connectionB.next();
    assert.equal(crossRespNoStage.kind, "error");
    assert.equal(crossRespNoStage.code, "denied", "a request key minted on connection A must be refused denied on connection B, which never staged");

    // B now stages its OWN request -- presenting A's key must STILL be
    // denied, proving the check is against B's own bound key, not merely
    // "did B ever stage anything".
    connectionB.send({ op: "host_tool_stage", files: [] });
    const stageRespB = await connectionB.next();
    assert.equal(stageRespB.kind, "host_tool_staged");
    const mintedKeyB = stageRespB.request as string;
    assert.notEqual(mintedKeyB, mintedKeyA, "the two connections must mint distinct request keys");

    connectionB.send({ op: "host_tool_run", tool: "acme.build", args: {}, request: mintedKeyA });
    const crossRespOwnStage = await connectionB.next();
    assert.equal(crossRespOwnStage.kind, "error");
    assert.equal(crossRespOwnStage.code, "denied", "connection B's own bound key must not accept connection A's key");

    assert.deepEqual(hostToolRunCalls, [], "onHostToolRun must never be invoked for any denied case in this test");
  } finally {
    connectionA.close();
    connectionB.close();
    listener.server.close();
  }
});

test("Test 4: a second host_tool_stage on the same connection is refused by name", async () => {
  const { listener, hostToolStageCalls } = await startTestListener({
    onHostToolStage: () => ({ ok: true, requestKey: "ht-test-4", treeHandles: [], fileHandles: [] }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "host_tool_stage", files: [] });
    const first = await client.next();
    assert.equal(first.kind, "host_tool_staged");

    client.send({ op: "host_tool_stage", files: [] });
    const second = await client.next();
    assert.equal(second.kind, "error");
    assert.equal(second.code, "bad_request");
    assert.match(String(second.message), /already bound/i);

    assert.equal(hostToolStageCalls.length, 1, "onHostToolStage must be invoked only once -- the second stage is refused before the callback runs");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("Test 5: a stage entry whose rel is unsafe is refused bad_request, and onHostToolStage sees it (the validator itself lives in broker-transfer.mts, exercised end to end in host-tool-endpoint.test.ts)", async () => {
  // This connection's own onHostToolStage stub simulates the SAME refusal
  // stageHostToolRequest() (broker-transfer.mts) produces for an unsafe
  // rel -- broker-control.mts's own dispatch arm narrows shape only
  // (tree/rel/byteLength types), never path safety; see this file's own
  // "Where the cap is enforced" constraint. The real validator's own
  // per-case refusals (../x, /abs, a\\b, a/../b, "", NUL) are proven end to
  // end against the real broker in host-tool-endpoint.test.ts's Test 5
  // case, because the validator itself lives in a host-bound module this
  // file cannot import unbuilt.
  const seen: HostToolStageFileSpec[][] = [];
  const { listener } = await startTestListener({
    onHostToolStage: (files) => {
      seen.push(files);
      return { ok: false, code: "bad_request", message: "vice: rel segment is '..'" };
    },
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "host_tool_stage", files: [{ tree: 0, rel: "../x", byteLength: 1 }] });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.deepEqual(seen, [[{ tree: 0, rel: "../x", byteLength: 1 }]]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("after a refused attach and a refused transfer on one connection, a token-less status line on that SAME connection is still answered unauthorized -- a pre-gate refusal never unlocks a gated op", async () => {
  const { listener } = await startTestListener({
    onRelayAttach: (): RelayAttachOutcome => ({ ok: false, code: "denied" }),
    onFileTransfer: (): FileTransferOutcome => ({ ok: false, code: "denied", message: "vice: no staged file for this handle" }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "attach", target_id: "req-a", channel: "binary", handle: "wrong-handle" });
    const attachResp = await client.next();
    assert.equal(attachResp.kind, "error");
    assert.equal(attachResp.code, "denied");

    client.send({ op: "transfer", id: "t-1", direction: "download", handle: "wrong-handle" });
    const transferResp = await client.next();
    assert.equal(transferResp.kind, "error");
    assert.equal(transferResp.code, "denied");

    client.send({ op: "status" });
    const statusResp = await client.next();
    assert.equal(statusResp.kind, "error");
    assert.equal(
      statusResp.code,
      "unauthorized",
      "a pre-gate refusal on this connection must never unlock a gated op -- the token gate still runs per line, for every op except attach/transfer",
    );
  } finally {
    client.close();
    listener.server.close();
  }
});

// Plan 64-08 (G-64-1 gap closure, Task 2): wires onRelayAttach to the REAL
// handleRelayAttach() (the compiled artifact, per this file's own header
// comment above g6408SetupBrokerState()) so the second-attach refusal
// observed here is the genuine broker-side one, not a fabricated test
// double -- and reached with NO token presented at all, proving the
// pre-existing second-attach refusal (T-63-01, now handle-only per G-64-1)
// is untouched by moving the dispatch arm ahead of the gate.
test("attach: a channel already attached is refused by the REAL handleRelayAttach(), reached with no token at all", async () => {
  const stubEmulator = createServer((socket) => {
    socket.on("data", () => {});
  });
  await new Promise<void>((resolvePromise) => stubEmulator.listen(0, "127.0.0.1", () => resolvePromise()));
  const emulatorPort = (stubEmulator.address() as AddressInfo).port;
  const targetId = "req-g6408-second-attach";
  const state = g6408SetupBrokerState(emulatorPort, targetId);
  const claim = g6408HandleMonitorClaim("claim-g6408-second-attach", targetId, "binary", state);
  assert.ok(claim.ok, `expected the claim to succeed: ${JSON.stringify(claim)}`);
  if (!claim.ok) return;

  // Relay-death incident records (fired when the first client's connection
  // closes below, tearing down the real relay session) must land here,
  // never the real, machine-level brokerIncidentsDir() -- mirrors
  // broker-relay.test.ts's own startRelayListenerForState() default.
  const incidentsDir = mkdtempSync(join(tmpdir(), "broker-control-g6408-incidents-"));
  const { listener } = await startTestListener({
    onRelayAttach: (tId, channel, presentedHandle, socket, pending) =>
      g6408HandleRelayAttach(tId, channel, presentedHandle, socket, pending, state, {
        writeIncident: (record) => g6408WriteBrokerIncident(record, { dir: incidentsDir }),
      }),
  });

  const firstClient = makeClient(listener.port);
  try {
    firstClient.send({ op: "attach", target_id: targetId, channel: "binary", handle: claim.handle });
    const firstResp = await firstClient.next();
    assert.equal(firstResp.kind, "attached", `expected the first attach to succeed: ${JSON.stringify(firstResp)}`);

    const secondClient = makeClient(listener.port);
    try {
      secondClient.send({ op: "attach", target_id: targetId, channel: "binary", handle: claim.handle });
      const secondResp = await secondClient.next();
      assert.equal(secondResp.kind, "error", "a second attach on an already-attached channel must be refused, even with no token presented");
      assert.notEqual(
        secondResp.code,
        "unauthorized",
        "the refusal observed must be the real handler's own second-attach refusal, never the token gate -- this line carried no token field at all",
      );
    } finally {
      secondClient.close();
    }
  } finally {
    firstClient.close();
    listener.server.close();
    await new Promise<void>((resolvePromise) => stubEmulator.close(() => resolvePromise()));
    rmSync(incidentsDir, { recursive: true, force: true });
  }
});

test("sanitiseSessionLabel: strips every C0 control character (including both line terminators), trims, and caps at 64 characters", () => {
  assert.equal(sanitiseSessionLabel("  hello\tworld  "), "helloworld");
  assert.equal(sanitiseSessionLabel("line1\nline2\r\n"), "line1line2");
  assert.equal(sanitiseSessionLabel("a".repeat(200)), "a".repeat(64));
  assert.equal(sanitiseSessionLabel("\u0000\u0001\u001f"), null, "an empty-after-stripping string must answer null, never an empty string");
  assert.equal(sanitiseSessionLabel(""), null);
  assert.equal(sanitiseSessionLabel(null), null);
  assert.equal(sanitiseSessionLabel(undefined), null);
  assert.equal(sanitiseSessionLabel(42), null, "a non-string input must never be coerced");
});

test("operation: a name carrying a line terminator and 200 characters is recorded stripped and truncated to at most 64 characters, never rejected outright", async () => {
  const { listener, token, operationCalls } = await startTestListener({ onAcquire: grantingAcquire() });
  const client = makeClient(listener.port);
  try {
    await acquireGrant(client, token, "req-a");
    const hostile = `${"x".repeat(199)}\n`; // 200 chars total, trailing line terminator
    client.send({ op: "operation", id: "op-1", target_id: "req-a", name: hostile, token });
    const resp = await client.next();
    assert.equal(resp.kind, "operation_noted");
    assert.equal(operationCalls.length, 1);
    const recorded = operationCalls[0]!.name;
    assert.ok(recorded !== null);
    assert.equal(recorded!.length, 64);
    assert.doesNotMatch(recorded!, /[\r\n]/);
    assert.equal(recorded, "x".repeat(64));
  } finally {
    client.close();
    listener.server.close();
  }
});

test("structural (D-14): no halting-path module reads monitorClients -- the only files containing that identifier are the four broker-side modules, their compiled resources/*.mjs artifacts, and the InstanceRecord test fixtures that must satisfy its non-optional field", () => {
  const output = execFileSync("git", ["ls-files"], { cwd: HERE, encoding: "utf8" });
  const files = output
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f !== "");
  // The broker-side modules THIS plan (and Phase 63, SESS-02) promote/read
  // monitorClients in, plus their compiled/committed resources/*.mjs
  // siblings (expected to carry the identifier verbatim) and every test
  // file that constructs a raw InstanceRecord literal and must therefore
  // satisfy its non-optional field -- none of these is a halting-path
  // consumer.
  const ALLOWED = new Set([
    "broker-state.mts",
    "broker-control.mts",
    "broker-launch.mts",
    "vice-broker.mts",
    "resources/broker-state.mjs",
    "resources/broker-control.mjs",
    "resources/broker-launch.mjs",
    "resources/vice-broker.mjs",
    "broker-state.test.ts",
    "broker-control.test.ts",
    "broker-launch.test.ts",
    "broker-kill.test.ts",
    "vice-broker-acquire.test.ts",
    "vice-broker-supervision.test.ts",
    // Plan 41-03, Task 2: text-connect.test.ts carries its OWN, near-identical
    // structural test (the identifier it searches for is necessarily present
    // in its own source) -- not a halting-path reference to the field.
    "text-connect.test.ts",
    // Phase 63, plan 63-01 (SESS-02): broker-relay.mts's own module header
    // comment NAMES the field (documenting where the per-claim handle it
    // checks is minted) without ever reading it -- handleRelayAttach()'s
    // own read lives in vice-broker.mts, already allowed above. Its test
    // file constructs the same raw InstanceRecord literals every other
    // allowed *.test.ts file above does.
    "broker-relay.mts",
    "broker-relay.test.ts",
    // Phase 63, plan 63-02 (SESS-02): the text channel's own relay-lifecycle
    // test file, constructing the SAME raw InstanceRecord literals every
    // other allowed *.test.ts file above does. Kept in sync with
    // text-connect.test.ts's own copy of this same guard.
    "broker-relay-text.test.ts",
    // Phase 64, plan 64-03 (XFER-04/XFER-07): the staging/transfer wiring
    // test file, constructing the SAME raw InstanceRecord literals every
    // other allowed *.test.ts file above does. Kept in sync with
    // text-connect.test.ts's own copy of this same guard.
    "vice-broker-staging.test.ts",
    // Phase 64, plan 64-04 (XFER-01/XFER-02): stock-machine.ts's own
    // handler test file, whose round-trip case drives a REAL control
    // listener and constructs the SAME raw InstanceRecord literal every
    // other allowed *.test.ts file above does. Kept in sync with
    // text-connect.test.ts's own copy of this same guard.
    "stock-machine.test.ts",
    // Phase 64, plan 64-07 (XFER-01/XFER-05/XFER-08): the disjoint-roots
    // proof, driving all four migrated handlers against a REAL control
    // listener and constructing the SAME raw InstanceRecord literal every
    // other allowed *.test.ts file above does. Kept in sync with
    // text-connect.test.ts's own copy of this same guard.
    "transfer-disjoint-roots.test.ts",
    // Plan 64-08 (G-64-1 gap closure): the G-64-1 tracer/transfer/text
    // fixture (g6408StartFixture()) drives a REAL control listener against
    // a REAL vice-proxy.ts child and constructs the SAME raw InstanceRecord
    // literal every other allowed *.test.ts file above does. Kept in sync
    // with text-connect.test.ts's own copy of this same guard.
    "vice-proxy.test.ts",
    // Phase 64 gap closure G-64-3 (plan 64-13, Task 1): stock-connect.ts's
    // own handshake test file, whose "publish lands late" case drives a
    // REAL control listener and constructs the SAME raw InstanceRecord
    // literal every other allowed *.test.ts file above does. Kept in sync
    // with text-connect.test.ts's own copy of this same guard.
    "stock-connect.test.ts",
  ]);
  const offenders: string[] = [];
  for (const rel of files) {
    if (ALLOWED.has(rel)) continue;
    if (!/\.(ts|mts|mjs)$/.test(rel)) continue;
    const full = join(HERE, rel);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, "utf8");
    if (text.includes("monitorClients")) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `no halting-path module may read monitorClients: ${JSON.stringify(offenders)}`);
});

test("an unknown request kind answers the bad_request error code, and no callback is invoked", async () => {
  let acquireCalled = false;
  const { listener, token } = await startTestListener({
    onAcquire: async () => {
      acquireCalled = true;
      return { ok: false, reason: "internal" };
    },
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "no_such_op", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "bad_request");
    assert.equal(acquireCalled, false);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("an acquire at the instance ceiling answers the at_capacity error code", async () => {
  const { listener, token } = await startTestListener({
    onAcquire: async () => ({ ok: false, reason: "at_capacity" }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-1", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "at_capacity");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("an acquire with no free port answers the no_free_port error code", async () => {
  const { listener, token } = await startTestListener({
    onAcquire: async () => ({ ok: false, reason: "no_free_port" }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-1", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "no_free_port");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("three acquires arriving while a launch is in flight are all present in the pending structure and all eventually answered", async () => {
  let inFlight = true;
  let calls = 0;
  const { listener, token } = await startTestListener({
    onAcquire: async (id) => {
      calls++;
      if (inFlight) return { ok: false, reason: "launch_in_flight" };
      return { ok: true, grant: { port: 6600, url: `http://127.0.0.1:6600/mcp`, epochFile: "/tmp/e.json", supervisorDir: "/tmp/6600" } };
    },
  });
  const clients = [makeClient(listener.port), makeClient(listener.port), makeClient(listener.port)];
  try {
    clients[0].send({ op: "acquire", id: "req-a", token });
    clients[1].send({ op: "acquire", id: "req-b", token });
    clients[2].send({ op: "acquire", id: "req-c", token });

    // Give the event loop a turn so every "acquire" line above is parsed
    // and its first (blocked) attempt has run.
    await waitFor(() => listener.pendingAcquires.length === 3, 2000);
    assert.equal(listener.pendingAcquires.length, 3, "all three must be present in the pending structure while blocked");

    inFlight = false;
    await drainPendingAcquires(listener.pendingAcquires);

    const [a, b, c] = await Promise.all([clients[0].next(), clients[1].next(), clients[2].next()]);
    assert.equal(a.kind, "grant");
    assert.equal(b.kind, "grant");
    assert.equal(c.kind, "grant");
    assert.equal(listener.pendingAcquires.length, 0, "the queue must be empty once every entry is served");
  } finally {
    for (const c of clients) c.close();
    listener.server.close();
  }
});

// ============================================================================
// 01.6.2-14-PLAN.md, Task 1: a queued acquire whose owning connection is
// already gone must never reach the launch callback at all (the
// always-reachable leak), and a launch that settles after its own socket is
// gone must be released through the existing release path rather than
// dropped (the narrow, bounded race). Both drive a REAL listener over a REAL
// TCP connection, per this file's own established idiom -- no test opens a
// connection to the host VICE, and neither closure below is a hand-rolled
// stand-in for attemptAcquire() itself, which stays private to
// broker-control.mts and is exercised only through the wire.
// ============================================================================

test("attemptAcquire: a queued entry whose socket is already destroyed never calls the launch callback at all", async () => {
  let calls = 0;
  const { listener, token } = await startTestListener({
    onAcquire: async () => {
      calls++;
      return { ok: false, reason: "launch_in_flight" };
    },
  });
  // Observes the SERVER-SIDE socket directly -- attachControlProtocol()'s
  // own "connection" listener (registered first, inside startControlListener())
  // still runs unaffected; EventEmitter supports multiple listeners, and this
  // one only reads .destroyed, never mutates anything.
  let serverSocket: import("node:net").Socket | null = null;
  listener.server.on("connection", (socket) => {
    serverSocket = socket;
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-1", token });
    await waitFor(() => listener.pendingAcquires.length === 1, 2000);
    assert.equal(calls, 1, "the first (blocked) attempt must have called the launch callback once");

    client.close();
    await waitFor(() => serverSocket !== null && serverSocket.destroyed, 2000);

    await drainPendingAcquires(listener.pendingAcquires);
    assert.equal(calls, 1, "a drain pass over an entry whose socket is already destroyed must not call the launch callback again");
  } finally {
    listener.server.close();
  }
});

test("attemptAcquire: a grant that settles after its own socket was destroyed is released through the release callback, not silently dropped", async () => {
  let resolveLaunch: ((outcome: AcquireOutcome) => void) | null = null;
  const { listener, token, releases } = await startTestListener({
    onAcquire: () =>
      new Promise<AcquireOutcome>((resolvePromise) => {
        resolveLaunch = resolvePromise;
      }),
  });
  let serverSocket: import("node:net").Socket | null = null;
  const written: string[] = [];
  listener.server.on("connection", (socket) => {
    serverSocket = socket;
    const originalWrite = socket.write.bind(socket);
    socket.write = ((chunk: unknown, ...rest: unknown[]) => {
      written.push(String(chunk));
      return (originalWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof socket.write;
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-1", token });
    await waitFor(() => resolveLaunch !== null, 2000);

    client.close();
    await waitFor(() => serverSocket !== null && serverSocket.destroyed, 2000);

    resolveLaunch!({ ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/e.json", supervisorDir: "/tmp/6600" } });
    await waitFor(() => releases.includes("req-1"), 2000);

    assert.deepEqual(releases, ["req-1"], "the release callback must be invoked with the same request id as the late grant");
    assert.ok(!written.some((line) => line.includes('"kind":"grant"')), "no grant response line may be written once the owning socket is destroyed");
  } finally {
    listener.server.close();
  }
});

test("attemptAcquire: a queued entry whose socket is still connected behaves exactly as today -- the launch callback is invoked, the grant is written, and the entry settles", async () => {
  let inFlight = true;
  let calls = 0;
  const { listener, token } = await startTestListener({
    onAcquire: async () => {
      calls++;
      if (inFlight) return { ok: false, reason: "launch_in_flight" };
      return { ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/e.json", supervisorDir: "/tmp/6600" } };
    },
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-1", token });
    await waitFor(() => listener.pendingAcquires.length === 1, 2000);
    assert.equal(calls, 1);

    inFlight = false;
    await drainPendingAcquires(listener.pendingAcquires);
    assert.equal(calls, 2, "the still-connected retry must call the launch callback again");

    const grant = await client.next();
    assert.equal(grant.kind, "grant");
    assert.equal(listener.pendingAcquires.length, 0);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("structural: the destroyed-socket pre-check appears before the launch callback call, and a second destroyed-socket check appears on the success path, inside attemptAcquire()", () => {
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const startIdx = source.indexOf("function attemptAcquire(requestId: string, profile?: LaunchProfile, label?: string | null): Promise<boolean> {");
  assert.ok(startIdx !== -1, "attemptAcquire()'s own definition must be found in the source");
  const endIdx = source.indexOf("\n    }\n", startIdx);
  assert.ok(endIdx > startIdx, "could not isolate attemptAcquire()'s own closing brace");
  const body = source.slice(startIdx, endIdx);

  const preCheckIdx = body.indexOf("if (socket.destroyed) return Promise.resolve(true);");
  // Phase 33, plan 33-06 widened this call to `.onAcquire(requestId,
  // profile)` -- matched on the invocation PREFIX rather than the full
  // argument list, so this ordering assertion survives a further widening of
  // the callback rather than failing for a reason it does not police.
  const callbackCallIdx = body.indexOf(".onAcquire(requestId");
  assert.ok(preCheckIdx !== -1, "the pre-check must be present, matched verbatim");
  assert.ok(callbackCallIdx !== -1, "the onAcquire() call must be present");
  assert.ok(preCheckIdx < callbackCallIdx, "the pre-check must run BEFORE onAcquire() is ever called");

  const successPathDestroyedCheck = body.indexOf("if (socket.destroyed) {", callbackCallIdx);
  assert.ok(successPathDestroyedCheck !== -1 && successPathDestroyedCheck > callbackCallIdx, "a second destroyed-socket check must appear on the success path, after onAcquire() is called");

  const releaseCallIdx = body.indexOf("opts.onRelease(requestId);", successPathDestroyedCheck);
  assert.ok(releaseCallIdx !== -1 && releaseCallIdx > successPathDestroyedCheck, "the success-path destroyed-socket branch must call onRelease() with the same request id");
});

test("structural: attemptAcquire()'s own comment names which half bounds which failure, and does not claim the race is eliminated", () => {
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const startIdx = source.indexOf("Two destroyed-socket checks guard a grant against outliving the");
  const endIdx = source.indexOf("function attemptAcquire(requestId: string, profile?: LaunchProfile, label?: string | null): Promise<boolean> {");
  assert.ok(startIdx !== -1 && endIdx !== -1 && startIdx < endIdx, "the gap-closure comment must precede attemptAcquire()'s own definition");
  const comment = source.slice(startIdx, endIdx);
  assert.match(comment, /always-reachable/i);
  assert.match(comment, /bounded race/i);
  assert.match(comment, /does NOT eliminate that race/i);
});

test("ControlRequestKind (34-01/62-01/63-01/63-03/64-02/65-01, A-01/D-06/D-01/SEAM-01): now exactly fifteen members -- host_tool is the whole host-tool subsystem (never widened again per-tool), hello is plan 62-01's pre-token-gate handshake op, attach is plan 63-01's post-token-gate relay handshake op, operation is plan 63-03's post-token-gate declaration op, stage_file/transfer are plan 64-02's file-transfer ops (XFER-04), host_tool_stage/host_tool_run are plan 65-01's pre-token-gate host-tool ops (SEAM-01)", () => {
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const match = source.match(/export type ControlRequestKind = ([^;]+);/);
  assert.ok(match, "ControlRequestKind's own type declaration must be found");
  // Plan 34-01 (A-01) is the ONE deliberate per-tool-adjacent widening --
  // the eighth member, "host_tool", is the WHOLE host-tool subsystem: a
  // second tool (dxa, Ghidra, c1541, petcat, cartconv, ...) is a new entry
  // in host-tool.mts's own HOST_TOOL_IDS allowlist, never a further
  // ControlRequestKind member -- this union is not widened again per-tool.
  // Plan 62-01 (D-06/ENDPOINT-03) adds the ninth member: "hello", the
  // pre-token-gate handshake op -- see handleLine()'s own dispatch-order
  // comment for why it is answered BEFORE tokensMatch(). Plan 63-01
  // (SESS-02) adds the tenth member: "attach", UNLIKE hello dispatched
  // AFTER the token gate, in the same post-gate chain as every other
  // target-naming op. Plan 63-03 (SESS-05) adds the eleventh member:
  // "operation", gated on the SAME ownsTarget() predicate as
  // monitor_claim/monitor_release. Plan 64-02 (XFER-04, D-01) adds
  // the twelfth and thirteenth members: "stage_file" (gated by ownsTarget(),
  // like operation) and "transfer" (deliberately NOT gated, like attach).
  // Plan 65-01 (SEAM-01) adds the fourteenth and fifteenth members:
  // "host_tool_stage"/"host_tool_run", dispatched ahead of the token gate
  // beside attach/transfer, never gated by ownsTarget() -- a skill call
  // holds no acquire-level grant to gate on.
  assert.equal(match![1].trim(),
    '"acquire" | "release" | "status" | "host_state" | "monitor_claim" | "monitor_release" | "host_tool" | "hello" | "attach" | "operation" | "stage_file" | "transfer" | "host_tool_stage" | "host_tool_run"',
    "the union must be exactly these fourteen members (recycle was removed with vice_recycle)",
  );
});

test("structural: broker-control.mts's pending-acquire region contains no re-ordering (sort) call anywhere in the file", () => {
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const count = (source.match(/\bsort\(/g) ?? []).length;
  assert.equal(count, 0, "no sort() call may appear anywhere in broker-control.mts -- arrival order must fall out of append/drain alone");
});

test("enqueueAcquire appends to the back; drainPendingAcquires processes strictly front-to-back for a single pass", async () => {
  const order: string[] = [];
  const queue: PendingAcquireQueue = [];
  enqueueAcquire(queue, {
    requestId: "a",
    attempt: async () => {
      order.push("a");
      return true;
    },
  });
  enqueueAcquire(queue, {
    requestId: "b",
    attempt: async () => {
      order.push("b");
      return true;
    },
  });
  enqueueAcquire(queue, {
    requestId: "c",
    attempt: async () => {
      order.push("c");
      return true;
    },
  });
  await drainPendingAcquires(queue);
  assert.deepEqual(order, ["a", "b", "c"]);
  assert.equal(queue.length, 0);
});

// ============================================================================
// 01.6.2.1-03-PLAN.md, Task 3: D-08/D-20's direct FIFO proof. The queue
// itself is NOT modified by this task -- drainPendingAcquires()'s own header
// comment already claims "no re-ordering call of any kind anywhere in this
// region" and explicitly defers this direct fairness proof to this phase;
// these two tests prove that claim, they do not implement it.
//
// Deliberately no end-to-end FIFO test here, and the reason is recorded
// rather than left implicit: arrival order at the broker is not controllable
// from a test that uses separate TCP connections -- broker-e2e.test.ts's own
// landed "disconnect while queued" test's own comment already establishes
// this (connection-setup jitter can reorder which acquire line the broker
// actually processes first, independent of which send call a test made
// first). An end-to-end test asserting grant order would therefore be
// asserting connection-setup jitter, and would be flaky by construction.
// D-20's specified proof is an INJECTION-level assertion -- exactly what the
// two tests below author -- with the arrival-to-queue link covered instead by
// the structural gate below plus enqueueAcquire()'s own single
// append-to-back implementation.
// ============================================================================

test("drainPendingAcquires: injecting 5 entries in a known order returns them in that same order (D-08/D-20 direct FIFO proof)", async () => {
  const queue: PendingAcquireQueue = [];
  const observedOrder: string[] = [];
  const ids = ["req-1", "req-2", "req-3", "req-4", "req-5"];
  for (const id of ids) {
    enqueueAcquire(queue, {
      requestId: id,
      attempt: () => {
        observedOrder.push(id);
        return Promise.resolve(true); // settled immediately
      },
    });
  }
  await drainPendingAcquires(queue);
  assert.deepEqual(observedOrder, ids, "the observed attempt order must equal the injection order exactly");
  assert.equal(queue.length, 0, "every entry settled and none remains queued");
});

test("drainPendingAcquires: a requeued entry is not overtaken by an entry that arrives during the SAME drain that requeued it", async () => {
  const queue: PendingAcquireQueue = [];
  let currentLog: string[] = [];
  let newcomerInjected = false;

  function makeEntry(id: string, opts: { unsettleOnce?: boolean; injectNewcomerAfter?: boolean } = {}): PendingAcquireEntry {
    let unsettled = !!opts.unsettleOnce;
    return {
      requestId: id,
      attempt: (): Promise<boolean> => {
        currentLog.push(id);
        // Simulates a genuinely later-arriving acquire landing DURING this
        // same drain pass -- injected from a LATER entry's own attempt
        // (req-4, which the snapshot only reaches AFTER req-B has already
        // been requeued by the loop), so the newcomer's own arrival is
        // chronologically after req-B's requeue, exactly the scenario
        // drainPendingAcquires()'s own comment describes.
        if (opts.injectNewcomerAfter && !newcomerInjected) {
          newcomerInjected = true;
          enqueueAcquire(queue, makeEntry("req-newcomer"));
        }
        if (unsettled) {
          unsettled = false; // unsettled only on its OWN first attempt
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      },
    };
  }

  const ids = ["req-1", "req-2", "req-B", "req-4", "req-5"];
  for (const id of ids) {
    enqueueAcquire(queue, makeEntry(id, { unsettleOnce: id === "req-B", injectNewcomerAfter: id === "req-4" }));
  }

  const pass1Log: string[] = [];
  currentLog = pass1Log;
  await drainPendingAcquires(queue); // pass 1
  assert.deepEqual(pass1Log, ids, "pass 1 must attempt every original entry once, in injection order");
  assert.deepEqual(
    queue.map((e) => e.requestId),
    ["req-B", "req-newcomer"],
    "after pass 1, the requeued entry (req-B) must precede the newcomer that arrived later in the same pass",
  );

  const pass2Log: string[] = [];
  currentLog = pass2Log;
  await drainPendingAcquires(queue); // pass 2
  assert.deepEqual(
    pass2Log,
    ["req-B", "req-newcomer"],
    "on the following drain, the requeued entry is attempted BEFORE the newcomer -- it was not overtaken",
  );
  assert.equal(queue.length, 0);
});

test("structural: broker-control.mts's pending-acquire queue region contains no order-mutating construct (sort/reverse/mid-array splice), comment-stripped and scoped to the region itself (D-08)", () => {
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const region = stripCommentsForStructuralGate(
    extractSourceRegion(source, "Arrival-ordered pending-acquire structure", "export interface BoundListener"),
  );

  const sortCount = (region.match(/\.sort\(/g) ?? []).length;
  assert.equal(sortCount, 0, `expected zero comment-stripped .sort( calls in the pending-acquire queue region, found ${sortCount}`);

  const reverseCount = (region.match(/\.reverse\(/g) ?? []).length;
  assert.equal(reverseCount, 0, `expected zero comment-stripped .reverse( calls in the pending-acquire queue region, found ${reverseCount}`);

  // The ONLY splice call this region may contain is the documented
  // front-drain snapshot -- queue.splice(0, queue.length) -- which takes
  // EVERYTHING from the front in one call and performs no re-ordering. Any
  // splice call with different arguments (an index-shuffling splice) would
  // be exactly the re-ordering construct this gate exists to catch.
  const spliceCalls = region.match(/\w+\.splice\([^)]*\)/g) ?? [];
  assert.equal(
    spliceCalls.length,
    1,
    `expected exactly one splice( call (the documented front-drain snapshot) in the queue region, found ${spliceCalls.length}: ${JSON.stringify(spliceCalls)}`,
  );
  assert.match(
    spliceCalls[0],
    /\.splice\(0,\s*queue\.length\)/,
    `the one permitted splice call must be the front-drain snapshot (queue.splice(0, queue.length)), got: ${spliceCalls[0]}`,
  );
});

// ============================================================================
// Task 2: broker.json's liveness classification round trip -- proving the
// field THIS broker writes is the field the UNCHANGED container-side
// classifier reads.
// ============================================================================

test("liveness round trip: the existing container-side classifier reads a running broker's record as alive, and a stale-heartbeat record as stale", async () => {
  build();
  const stateDir = mkdtempSync(join(tmpdir(), "broker-control-liveness-"));
  const child = spawn(process.execPath, [BROKER_ARTIFACT, "--repo-root", "/tmp/fake-repo-root-liveness", "--state-dir", stateDir], {
    // G-64-6: confined to this test's own mkdtempSync stateDir -- with no
    // VICE_BROKER_HOME this spawned broker would resolve the machine-level
    // ~/.c64-re-tools and its own startup staging sweep would run against
    // real, possibly-live staging on this host.
    env: { ...process.env, VICE_SUPERVISOR_ALLOW_CONTAINER: "1", VICE_BIN: "/bin/sleep", VICE_ARGS: "600", VICE_BROKER_CONTROL_PORT: "0", VICE_BROKER_HOME: stateDir },
  }) as ChildProcessWithoutNullStreams;
  try {
    const recordPath = join(stateDir, "broker.json");
    const appeared = await waitFor(() => existsSync(recordPath), 5000);
    assert.ok(appeared, "broker.json did not appear within deadline");

    const alive = readBrokerLiveness(recordPath);
    assert.equal(alive.state, "alive", "a freshly-started, running broker's own record must classify as alive");

    // Hand-build a record with a stale heartbeat, sharing the SAME live pid
    // (liveness of the pid itself is not what distinguishes alive/stale --
    // only heartbeat_at's age does).
    const record = JSON.parse(readFileSync(recordPath, "utf8"));
    const stalePath = join(stateDir, "broker-stale.json");
    writeFileSync(stalePath, JSON.stringify({ ...record, heartbeat_at: "2020-01-01T00:00:00Z" }));
    const stale = readBrokerLiveness(stalePath);
    assert.equal(stale.state, "stale", "a record whose heartbeat is far older than the stale threshold must classify as stale");
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    rmSync(stateDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Task 3: the kernel-enforced singleton guard and its two distinct outcomes
// (criterion K, D-17, D-18).
// ============================================================================

function startRealBroker(stateDir: string, env: Record<string, string> = {}): ChildProcessWithoutNullStreams {
  const child = spawn(process.execPath, [BROKER_ARTIFACT, "--repo-root", "/tmp/fake-repo-root-singleton", "--state-dir", stateDir], {
    // G-64-6: VICE_BROKER_HOME defaults to this test's own stateDir --
    // placed BEFORE the caller's own `env` spread so a caller can still
    // override it -- confining every spawned broker's staging sweep to a
    // temporary home rather than the machine-level ~/.c64-re-tools a real
    // developer or CI host may hold live staging under.
    env: { ...process.env, VICE_SUPERVISOR_ALLOW_CONTAINER: "1", VICE_BIN: "/bin/sleep", VICE_ARGS: "600", VICE_BROKER_HOME: stateDir, ...env },
  }) as ChildProcessWithoutNullStreams;
  return child;
}

async function stopRealBroker(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = await waitFor(() => child.exitCode !== null || child.signalCode !== null, 3000);
  if (!exited) child.kill("SIGKILL");
}

test("singleton: a second broker started against a live first broker's control port exits quietly (status 0), naming itself a second instance", { timeout: 20000 }, async () => {
  build();
  const stateDir = mkdtempSync(join(tmpdir(), "broker-control-singleton-live-"));
  const first = startRealBroker(stateDir, { VICE_BROKER_CONTROL_PORT: "0" });
  let firstStderr = "";
  first.stderr.on("data", (d: Buffer) => (firstStderr += d.toString("utf8")));
  try {
    const recordPath = join(stateDir, "broker.json");
    await waitFor(() => existsSync(recordPath), 5000);
    const before = readFileSync(recordPath, "utf8");
    const bound = JSON.parse(before).control_port as number;
    assert.ok(Number.isInteger(bound) && bound > 0);

    const second = startRealBroker(stateDir, { VICE_BROKER_CONTROL_PORT: String(bound) });
    let secondStderr = "";
    second.stderr.on("data", (d: Buffer) => (secondStderr += d.toString("utf8")));
    const exited = await waitFor(() => second.exitCode !== null, 5000);
    assert.ok(exited, `second broker never exited; stderr so far:\n${secondStderr}`);
    assert.equal(second.exitCode, 0, `second broker must exit quietly (status 0); stderr:\n${secondStderr}`);
    assert.match(secondStderr, /second instance/i);

    const after = readFileSync(recordPath, "utf8");
    assert.equal(after, before, "the discovery record must be byte-identical before and after the losing second broker's attempt");
  } finally {
    await stopRealBroker(first);
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("singleton: a broker started against a port held by a plain non-broker listener, with a stale discovery record present, exits loudly (non-zero) naming the port and what to check", { timeout: 20000 }, async () => {
  build();
  const stateDir = mkdtempSync(join(tmpdir(), "broker-control-singleton-stale-"));
  const recordPath = join(stateDir, "broker.json");
  // A stale discovery record: a plausible-looking pid, but a heartbeat far
  // older than the stale threshold.
  writeFileSync(
    recordPath,
    JSON.stringify({
      version: 1,
      written_by: "vice-broker.mjs",
      pid: 999999999,
      started_at: "2020-01-01T00:00:00Z",
      heartbeat_at: "2020-01-01T00:00:00Z",
      node_version: process.version,
      control_host: "0.0.0.0",
      control_port: 0,
      control_token: "0".repeat(64),
      max_instances: 16,
      base_port: 6600,
      poll_ms: 500,
      dry_run: false,
    }),
  );
  const before = readFileSync(recordPath, "utf8");

  // A plain, non-broker listener holding a real port -- bindControlListener()
  // itself is a bare TCP bind with no protocol wired up, standing in exactly
  // for "something that is not a broker" (it never speaks this module's own
  // wire format).
  const squatter = await bindControlListener("127.0.0.1", 0);
  try {
    const child = startRealBroker(stateDir, { VICE_BROKER_CONTROL_PORT: String(squatter.port) });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    const exited = await waitFor(() => child.exitCode !== null, 5000);
    assert.ok(exited, `broker never exited; stderr so far:\n${stderr}`);
    assert.notEqual(child.exitCode, 0, `must exit non-zero when the port is squatted; stderr:\n${stderr}`);
    assert.match(stderr, new RegExp(String(squatter.port)));
    assert.match(stderr, /check/i);

    const after = readFileSync(recordPath, "utf8");
    assert.equal(after, before, "the stale record must be byte-identical before and after the loud-failure attempt");
  } finally {
    squatter.server.close();
    rmSync(stateDir, { recursive: true, force: true });
  }
});

// ============================================================================
// G-64-6 (XFER-07, gap-closure round 4): the startup staging sweep must
// never remove a live broker's active staging, whether a second, losing
// broker process exits quietly or loudly -- and the sweep that DOES run, in
// the process that actually wins the control-port bind, must still remove
// genuine crash residue before that broker's discovery record exists. Uses
// the SAME startRealBroker()/stopRealBroker() helpers as the `singleton:`
// tests directly above, so every spawned broker here is confined to a
// temporary VICE_BROKER_HOME the same way.
// ============================================================================

/** G-64-6: writes one staged file of random bytes under
 * `<home>/staging/<sessionName>/`, the same shape stageFileSlot() itself
 * creates (a session directory holding one handle-named file) -- named here
 * only so the drift pass does not flag it. Returns the directory, the
 * file's path and its sha256, so a test can assert the file survives (or is
 * removed) byte-for-byte, never merely by existence. */
function seedStagingSession(home: string, sessionName: string): { dir: string; filePath: string; sha256: string } {
  const dir = join(home, "staging", sessionName);
  mkdirSync(dir, { recursive: true });
  const fileName = randomBytes(16).toString("hex"); // 32 hex characters, the shape stageFileSlot()'s own handle takes
  const filePath = join(dir, fileName);
  const payload = randomBytes(4096);
  writeFileSync(filePath, payload);
  const sha256 = createHash("sha256").update(payload).digest("hex");
  return { dir, filePath, sha256 };
}

test("singleton staging (G-64-6): a losing second broker leaves a live first broker's staging session directory and its staged file in place", { timeout: 20000 }, async () => {
  build();
  const home = mkdtempSync(join(tmpdir(), "broker-control-g646-live-"));
  const first = startRealBroker(home, { VICE_BROKER_CONTROL_PORT: "0", VICE_BROKER_CONTROL_HOST: "127.0.0.1" });
  try {
    const recordPath = join(home, "broker.json");
    const appeared = await waitFor(() => existsSync(recordPath), 5000);
    assert.ok(appeared, "the first broker's broker.json did not appear within deadline");
    const bound = JSON.parse(readFileSync(recordPath, "utf8")).control_port as number;
    assert.ok(Number.isInteger(bound) && bound > 0);

    // Only NOW, after the live first broker has already bound and published
    // its record, does this test create the session directory its own sweep
    // must never reach.
    const { dir: sessionDir, filePath, sha256: sha256Before } = seedStagingSession(home, "req-live-1-aaaaaaaa");

    const second = startRealBroker(home, { VICE_BROKER_CONTROL_PORT: String(bound), VICE_BROKER_CONTROL_HOST: "127.0.0.1" });
    let secondStderr = "";
    second.stderr.on("data", (d: Buffer) => (secondStderr += d.toString("utf8")));
    const exited = await waitFor(() => second.exitCode !== null, 5000);
    assert.ok(exited, `second broker never exited; stderr so far:\n${secondStderr}`);
    assert.equal(second.exitCode, 0, `a losing second broker must exit quietly (status 0); stderr:\n${secondStderr}`);
    assert.match(secondStderr, /second instance/i, `expected the losing branch's own message, proving this test is non-vacuous; stderr:\n${secondStderr}`);
    assert.doesNotMatch(secondStderr, /staging sweep found/, `a losing second broker must never run the staging sweep at all; stderr:\n${secondStderr}`);

    assert.ok(existsSync(sessionDir), "the live first broker's staging session directory must still exist");
    const sha256After = createHash("sha256").update(readFileSync(filePath)).digest("hex");
    assert.equal(sha256After, sha256Before, "the staged file's bytes must be unchanged");
    assert.equal(first.exitCode, null, "the first, live broker must still be running");
  } finally {
    await stopRealBroker(first);
    rmSync(home, { recursive: true, force: true });
  }
});

test("singleton staging (G-64-6): a broker that fails loudly on a squatted control port leaves the staging root untouched", { timeout: 20000 }, async () => {
  build();
  const stateDir = mkdtempSync(join(tmpdir(), "broker-control-g646-squat-"));
  const recordPath = join(stateDir, "broker.json");
  // A stale discovery record, copied from the squatted-port test directly
  // above -- a plausible-looking pid, but a heartbeat far older than the
  // stale threshold.
  writeFileSync(
    recordPath,
    JSON.stringify({
      version: 1,
      written_by: "vice-broker.mjs",
      pid: 999999998,
      started_at: "2020-01-01T00:00:00Z",
      heartbeat_at: "2020-01-01T00:00:00Z",
      node_version: process.version,
      control_host: "0.0.0.0",
      control_port: 0,
      control_token: "0".repeat(64),
      max_instances: 16,
      base_port: 6600,
      poll_ms: 500,
      dry_run: false,
    }),
  );

  const { dir: sessionDir, filePath, sha256: sha256Before } = seedStagingSession(stateDir, "req-squat-1-dddddddd");

  // A plain, non-broker listener holding a real port -- stands in for
  // "something that is not a broker", exactly as the squatted-port test
  // directly above uses it.
  const squatter = await bindControlListener("127.0.0.1", 0);
  try {
    const child = startRealBroker(stateDir, { VICE_BROKER_CONTROL_PORT: String(squatter.port), VICE_BROKER_CONTROL_HOST: "127.0.0.1" });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    const exited = await waitFor(() => child.exitCode !== null, 5000);
    assert.ok(exited, `broker never exited; stderr so far:\n${stderr}`);
    assert.notEqual(child.exitCode, 0, `must exit non-zero when the port is squatted; stderr:\n${stderr}`);
    assert.match(stderr, new RegExp(String(squatter.port)));

    assert.ok(existsSync(sessionDir), "the seeded staging session directory must still exist");
    const sha256After = createHash("sha256").update(readFileSync(filePath)).digest("hex");
    assert.equal(sha256After, sha256Before, "the seeded staged file's bytes must be unchanged");
  } finally {
    squatter.server.close();
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("startup staging sweep (G-64-6): a broker that wins the control-port bind has removed a crashed broker's staging residue by the time its discovery record exists", { timeout: 20000 }, async () => {
  build();
  const home = mkdtempSync(join(tmpdir(), "broker-control-g646-crash-"));
  try {
    // Seeded BEFORE this broker starts -- the shape a genuinely crashed
    // broker's own staging leaves: one session directory holding a staged
    // file, and one EMPTY session directory, the shape an interrupted
    // recursive removal leaves.
    const { dir: crashedWithFile } = seedStagingSession(home, "req-crashed-1-bbbbbbbb");
    const crashedEmpty = join(home, "staging", "req-crashed-2-cccccccc");
    mkdirSync(crashedEmpty, { recursive: true });

    const child = startRealBroker(home, { VICE_BROKER_CONTROL_PORT: "0", VICE_BROKER_CONTROL_HOST: "127.0.0.1" });
    try {
      const recordPath = join(home, "broker.json");
      const appeared = await waitFor(() => existsSync(recordPath), 5000);
      assert.ok(appeared, "broker.json did not appear within deadline");
      // No `await` between the existsSync() above and these two assertions:
      // the sweep and the record write are both synchronous within run(),
      // so nothing else can interleave once the record is known to exist.
      assert.equal(existsSync(crashedWithFile), false, "the crashed session directory holding a staged file must be gone");
      assert.equal(existsSync(crashedEmpty), false, "the empty, interrupted-removal-shaped crashed session directory must be gone");
    } finally {
      await stopRealBroker(child);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("the two singleton messages are textually distinct, and neither is a substring of the other", () => {
  const quiet = "vice-broker: another broker is already running and holds this control port -- exiting quietly as a second instance";
  const loud = 'vice-broker: FATAL -- control port is held by something that does not answer as a broker (discovery record classified "stale")';
  assert.notEqual(quiet, loud);
  assert.ok(!quiet.includes(loud) && !loud.includes(quiet));
});

test("structural: the bind call precedes the record write in vice-broker.mts's own startup sequence", () => {
  const source = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  // 62-03: the single-host startControlListener() call was replaced by the
  // multi-address startControlListenerOnHosts() (BROKER-03) -- this
  // structural check follows that rename rather than the old literal.
  const bindIdx = source.indexOf("await startControlListenerOnHosts(bindHosts, {");
  const writeIdx = source.indexOf("writeBrokerRecordFile(args.stateDir, record);");
  assert.ok(bindIdx !== -1 && writeIdx !== -1);
  assert.ok(bindIdx < writeIdx, "the control listener must bind BEFORE the discovery record is written");
});

test("structural: vice-broker.mts or broker-control.mts states in a comment that the singleton guarantee holds only while the control port keeps its default", () => {
  const broker = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  const control = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const combined = `${broker}\n${control}`;
  assert.match(combined, /holds only while the control port keeps its default/i);
  assert.match(combined, /two brokers/i);
});

// ============================================================================
// Source-region helpers for the structural gates in this file.
// ============================================================================

/** Strips both `/* ... *\/` (including JSDoc) block comments and whole `//`
 * comment lines before any assertion below runs, so a sentence in a comment
 * can never satisfy or break this gate -- the same block-comment-aware
 * technique broker-launch.test.ts's own structural gate already
 * established, reused here rather than the whole-line-`//`-only idiom
 * alone. */
function stripCommentsForStructuralGate(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Extracts the substring between two marker strings (the first occurrence
 * of `startMarker`, up to the first occurrence of `endMarker` that follows
 * it) -- used to region-scope the assertions below to each handler's OWN
 * body, so a call site in a DIFFERENT function can never satisfy this
 * gate. */
function extractSourceRegion(source: string, startMarker: string, endMarker: string): string {
  const startIdx = source.indexOf(startMarker);
  assert.ok(startIdx !== -1, `extractSourceRegion: start marker not found: ${startMarker}`);
  const endIdx = source.indexOf(endMarker, startIdx + startMarker.length);
  assert.ok(endIdx !== -1 && endIdx > startIdx, `extractSourceRegion: end marker not found after start: ${endMarker}`);
  return source.slice(startIdx, endIdx);
}

test("a bind failure whose cause is NOT address-in-use produces its own loud failure, distinct from either singleton path", async () => {
  build();
  const stateDir = mkdtempSync(join(tmpdir(), "broker-control-bind-other-failure-"));
  try {
    // An invalid host string (not a bindable address, and not "in use"
    // either) reliably produces a non-EADDRINUSE bind error from Node's own
    // net module.
    const child = startRealBroker(stateDir, { VICE_BROKER_CONTROL_PORT: "0", VICE_BROKER_CONTROL_HOST: "256.256.256.256" });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    const exited = await waitFor(() => child.exitCode !== null, 5000);
    assert.ok(exited, `broker never exited; stderr so far:\n${stderr}`);
    assert.notEqual(child.exitCode, 0);
    assert.doesNotMatch(stderr, /second instance/i);
    assert.doesNotMatch(stderr, /does not answer as a broker/i);
    assert.match(stderr, /failed to start control listener/i);
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Phase 33, plan 33-06 (REPRO-05, D-15, T-33-03): the launch profile on the
// EXISTING acquire op. `ControlRequestKind` is unchanged at seven members --
// this is a field, not an eighth op -- and `normaliseLaunchProfile()` is the
// one narrowing site every case below drives, either directly or through a
// real control-plane round trip.
//
// Task 1 contributes the round-trip tracer; task 2 contributes the boundary
// refusals. They are grouped together here because they assert two halves of
// one boundary and a reader needs both to see what it accepts.
// ============================================================================

/** Starts a listener whose onAcquire records the profile it was handed, and
 * always grants, so a test can assert on what ARRIVED rather than on what a
 * launch did with it. `received` collects one entry per onAcquire call --
 * `undefined` is a real, distinguishable entry (profile-less), which is why
 * this is an array of the optional type and not a single nullable value.
 *
 * FORKRM-01 (plan 52-06): the 33-review WR-03 profile-is-stock-only refusal
 * this fixture used to also drive (on the fork backend) is deleted -- there
 * is only one backend now, and it always has the `-warp`/`-console` route,
 * so the condition that refusal existed for can no longer occur. The
 * `backend` parameter is dropped along with it -- a fixed "stock" fixture is
 * hardcoded below rather than left as a parameter with one legal value. */
async function startProfileRecordingListener(): Promise<{
  listener: StartControlListenerResult;
  token: string;
  received: Array<LaunchProfile | undefined>;
}> {
  const received: Array<LaunchProfile | undefined> = [];
  const { listener, token } = await startTestListener({
    onAcquire: async (id: string, profile?: LaunchProfile) => {
      received.push(profile);
      return { ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/epoch.json", supervisorDir: "/tmp/6600" } } as AcquireOutcome;
    },
    onHostState: () => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      maxInstances: 16,
      basePort: 6600,
      backend: "stock",
    }),
  });
  return { listener, token, received };
}

test("ControlRequestKind (34-01/62-01/63-01/63-03/64-02/65-01, A-01/D-06/D-01/SEAM-01): now exactly fifteen members -- host_tool is a reviewed eighth op, hello is plan 62-01's reviewed ninth op, attach is plan 63-01's reviewed tenth op, operation is plan 63-03's reviewed eleventh op, stage_file/transfer are plan 64-02's twelfth/thirteenth ops (XFER-04), host_tool_stage/host_tool_run are plan 65-01's fourteenth/fifteenth ops (SEAM-01), and this union is never widened again PER-TOOL", () => {
  // Read off the type's own declaration in the source rather than a
  // hand-maintained list here: a second list would be the very drift this
  // asserts against. The union is a single line by convention in this file.
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const match = /export type ControlRequestKind =([^;]*);/.exec(source);
  assert.ok(match, "ControlRequestKind's declaration must be findable in broker-control.mts");
  const members = match![1]
    .split("|")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter((s) => s !== "");
  assert.deepEqual(members,
    ["acquire", "release", "status", "host_state", "monitor_claim", "monitor_release", "host_tool", "hello", "attach", "operation", "stage_file", "transfer", "host_tool_stage", "host_tool_run"],
    "the message set must be exactly these fourteen members " +
      "(SEAM-01) -- a genuinely reviewed widening, not a per-tool one: a second host tool is still a new " +
      "HOST_TOOL_IDS entry in host-tool.mts, never a further ControlRequestKind member",
  );
});

test("structural (34-01, SEAM-01): StartControlListenerOptions declares onHostTool, and the host_tool dispatch branch in handleLine() appears BEFORE the acquire branch -- routed before any lease-bearing path", () => {
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  assert.match(source, /onHostTool:\s*\(raw: unknown\) => Promise<unknown>/, "StartControlListenerOptions must declare onHostTool");
  const hostToolDispatchIdx = source.indexOf('req.op === "host_tool"');
  const acquireDispatchIdx = source.indexOf('req.op === "acquire"');
  assert.ok(hostToolDispatchIdx !== -1, "the host_tool dispatch branch must exist in handleLine()");
  assert.ok(acquireDispatchIdx !== -1, "the acquire dispatch branch must exist in handleLine()");
  assert.ok(
    hostToolDispatchIdx < acquireDispatchIdx,
    "the host_tool dispatch branch must appear at a LOWER character index than the acquire comparison -- routed " +
      "before any lease-bearing path",
  );
});

test("acquire profile (33-06, D-15, tracer): {op:'acquire', profile:{warp:true}} arrives at onAcquire as {warp:true}, over a REAL control-plane round trip", async () => {
  const { listener, token, received } = await startProfileRecordingListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-profile-1", token, profile: { warp: true } });
    const grant = await client.next();
    assert.equal(grant.kind, "grant", `expected a grant, got ${JSON.stringify(grant)}`);
    assert.equal(received.length, 1, "onAcquire must have been called exactly once");
    assert.deepEqual(received[0], { warp: true }, "the narrowed profile must arrive at onAcquire unchanged");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("acquire profile (33-06, D-15): both knobs together arrive as {warp:true, headless:true}, and a both-false profile arrives as {warp:false, headless:false} -- never coerced away", async () => {
  const { listener, token, received } = await startProfileRecordingListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-profile-both", token, profile: { warp: true, headless: true } });
    assert.equal((await client.next()).kind, "grant");
    assert.deepEqual(received[0], { warp: true, headless: true });
  } finally {
    client.close();
    listener.server.close();
  }

  const second = await startProfileRecordingListener();
  const client2 = makeClient(second.listener.port);
  try {
    client2.send({ op: "acquire", id: "req-profile-false", token: second.token, profile: { warp: false, headless: false } });
    assert.equal((await client2.next()).kind, "grant");
    assert.deepEqual(second.received[0], { warp: false, headless: false }, "explicit false must survive narrowing as false -- the eligibility rule, not this boundary, is what makes false and absent equivalent");
  } finally {
    client2.close();
    second.listener.server.close();
  }
});

test("acquire profile (33-06, edge: empty): an acquire with NO profile key reaches onAcquire with `undefined`, and its wire line is byte-identical to the pre-33-06 line", async () => {
  const { listener, token, received } = await startProfileRecordingListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-no-profile", token });
    assert.equal((await client.next()).kind, "grant");
    assert.equal(received.length, 1);
    assert.equal(received[0], undefined, "an absent profile must arrive as undefined -- never as {} and never as a default");
  } finally {
    client.close();
    listener.server.close();
  }
});

// ---------------------------------------------------------------------------
// Phase 63, plan 63-05 (SESS-06): the acquire dispatch arm reads `label` off
// the wire, runs it through sanitiseSessionLabel() (the SAME sanitiser
// Plan 63-03's `operation` op already reuses), and passes the sanitised
// result as onAcquire's third parameter -- mirroring the profile's own
// second-parameter widening exactly.
// ---------------------------------------------------------------------------

async function startLabelRecordingListener(): Promise<{
  listener: StartControlListenerResult;
  token: string;
  received: Array<string | null | undefined>;
}> {
  const received: Array<string | null | undefined> = [];
  const { listener, token } = await startTestListener({
    onAcquire: async (_id: string, _profile?: LaunchProfile, label?: string | null) => {
      received.push(label);
      return { ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/epoch.json", supervisorDir: "/tmp/6600" } } as AcquireOutcome;
    },
  });
  return { listener, token, received };
}

test("acquire session label (63-05, SESS-06): {op:'acquire', label:'my-session'} arrives at onAcquire's third argument as 'my-session'", async () => {
  const { listener, token, received } = await startLabelRecordingListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-label-1", token, label: "my-session" });
    assert.equal((await client.next()).kind, "grant");
    assert.equal(received.length, 1);
    assert.equal(received[0], "my-session");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("acquire session label (63-05, edge: empty): an acquire with NO label key reaches onAcquire's third argument as null, never fabricated", async () => {
  const { listener, token, received } = await startLabelRecordingListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-label-none", token });
    assert.equal((await client.next()).kind, "grant");
    assert.equal(received.length, 1);
    assert.equal(received[0], null, "an absent label must arrive as null, never as an empty string or undefined-turned-truthy value");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("acquire session label (63-05, SESS-06): a label carrying a line terminator and 200 characters arrives stripped and truncated to at most 64 characters", async () => {
  const { listener, token, received } = await startLabelRecordingListener();
  const client = makeClient(listener.port);
  const hostile = `evil\nlabel${"x".repeat(195)}`;
  try {
    client.send({ op: "acquire", id: "req-label-hostile", token, label: hostile });
    assert.equal((await client.next()).kind, "grant");
    assert.equal(received.length, 1);
    const got = received[0];
    assert.equal(typeof got, "string");
    assert.ok(got!.length <= 64, `expected at most 64 characters, got ${got!.length}`);
    assert.ok(!got!.includes("\n"), "the line terminator must be stripped");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("acquire session label (63-05): a non-string label (a number) is refused the same way a hostile string is -- collapsed to null, never coerced to a string", async () => {
  const { listener, token, received } = await startLabelRecordingListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-label-number", token, label: 12345 });
    assert.equal((await client.next()).kind, "grant");
    assert.equal(received[0], null);
  } finally {
    client.close();
    listener.server.close();
  }
});

// ---------------------------------------------------------------------------
// FORKRM-01 (plan 52-06): the 33-review WR-03 profile-is-stock-only refusal
// used to live here -- a `profile.warp`/`profile.headless` request was
// refused `bad_request` when the broker's OWN resolved backend had no
// `-warp`/`-console` route at all. There is only one backend now and it
// always has that route, so the condition this refused can no longer occur;
// the three tests that drove the refusal on the (now-deleted) fork backend
// are removed, not merely skipped. What survives: profile.warp/headless
// must still arrive at onAcquire unchanged.
// ---------------------------------------------------------------------------

test("acquire profile: profile.warp/profile.headless are accepted and arrive at onAcquire unchanged", async () => {
  const { listener, token, received } = await startProfileRecordingListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-warp", token, profile: { warp: true, headless: true } });
    assert.equal((await client.next()).kind, "grant");
    assert.deepEqual(received[0], { warp: true, headless: true }, "the profile arrives unchanged");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("acquire profile (33-06, T-33-03): `profile: null` is accepted as profile-less rather than refused", async () => {
  const { listener, token, received } = await startProfileRecordingListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-null-profile", token, profile: null });
    assert.equal((await client.next()).kind, "grant", "null must be tolerated as 'no profile', matching an absent key");
    assert.equal(received[0], undefined);
  } finally {
    client.close();
    listener.server.close();
  }
});

// ---------------------------------------------------------------------------
// Task 2, boundary refusals (T-33-03). Each malformed shape must be refused
// with the EXISTING `bad_request` code, with the offending value (or key)
// NAMED in the message, and -- separately asserted -- without the request
// ever being enqueued or reaching onAcquire at all.
// ---------------------------------------------------------------------------

/** Every malformed `profile` shape the boundary must refuse, paired with a
 * substring the refusal message has to contain. The substring is what makes
 * "names the offending value" a real assertion rather than a check that some
 * message exists. */
const MALFORMED_PROFILES: Array<{ label: string; profile: unknown; names: string }> = [
  { label: "a string", profile: "warp", names: '"warp"' },
  { label: "a number", profile: 7, names: "7" },
  { label: "a bare boolean", profile: true, names: "true" },
  { label: "an array (typeof 'object', but not a plain object)", profile: [], names: "[]" },
  { label: "a non-boolean warp value", profile: { warp: "yes" }, names: "profile.warp" },
  { label: "a non-boolean headless value", profile: { headless: 1 }, names: "profile.headless" },
  { label: "an unknown key alongside a valid one", profile: { warp: true, turbo: true }, names: "turbo" },
];

for (const { label, profile, names } of MALFORMED_PROFILES) {
  test(`acquire profile (33-06, T-33-03): ${label} is refused bad_request naming the offending value, and onAcquire is never called`, async () => {
    const { listener, token, received } = await startProfileRecordingListener();
    const client = makeClient(listener.port);
    try {
      client.send({ op: "acquire", id: "req-malformed", token, profile } as Record<string, unknown>);
      const resp = await client.next();
      assert.equal(resp.kind, "error", `expected an error line, got ${JSON.stringify(resp)}`);
      assert.equal(resp.code, "bad_request", "malformed profiles reuse the EXISTING bad_request code -- no new error code was added");
      assert.ok(
        typeof resp.message === "string" && resp.message.includes(names),
        `the refusal must name the offending value (${names}); got ${JSON.stringify(resp.message)}`,
      );
      assert.equal(received.length, 0, "a refused profile must never reach onAcquire -- no port allocation, no spawn, no argv construction");
    } finally {
      client.close();
      listener.server.close();
    }
  });
}

test("acquire profile (33-06, T-33-03): a bad_request refusal does not enqueue the request -- the pending-acquire queue length is unchanged", async () => {
  const { listener, token, received } = await startProfileRecordingListener();
  const client = makeClient(listener.port);
  try {
    const before = listener.pendingAcquires.length;
    assert.equal(before, 0, "this test's own precondition: the queue starts empty");
    client.send({ op: "acquire", id: "req-no-enqueue", token, profile: { turbo: true } } as Record<string, unknown>);
    const resp = await client.next();
    assert.equal(resp.code, "bad_request");
    // The enqueue decision is made synchronously in the same tick the
    // refusal is written, so one turn of the event loop is enough to observe
    // its absence -- a queued entry would already be present here.
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(listener.pendingAcquires.length, before, "a refused acquire must not be queued for a later drain pass -- it is answered and dropped");
    assert.equal(received.length, 0);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("acquire profile (33-06): the profile survives being QUEUED behind an in-flight launch -- a retried acquire carries the profile it was made with, not a profile-less one", async () => {
  // First attempt answers launch_in_flight (which queues rather than
  // refuses); the second attempt, driven by drainPendingAcquires(), must
  // present the SAME profile.
  const received: Array<LaunchProfile | undefined> = [];
  let attempts = 0;
  const { listener, token } = await startTestListener({
    onAcquire: async (_id: string, profile?: LaunchProfile) => {
      attempts++;
      received.push(profile);
      if (attempts === 1) return { ok: false, reason: "launch_in_flight" } as AcquireOutcome;
      return { ok: true, grant: { port: 6601, url: "http://127.0.0.1:6601/mcp", epochFile: "/tmp/epoch.json", supervisorDir: "/tmp/6601" } } as AcquireOutcome;
    },
    // Stock, because a `{warp:true}` acquire is only coherent there (33
    // review WR-03): on fork the boundary now refuses it rather than
    // accepting a knob the argv cannot carry. The property under test is
    // profile SURVIVAL across the queue, which is backend-independent.
    onHostState: () => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      maxInstances: 16,
      basePort: 6600,
      backend: "stock" as const,
    }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-queued-profile", token, profile: { warp: true } });
    const queued = await waitFor(() => listener.pendingAcquires.length === 1, 2000);
    assert.ok(queued, "the launch_in_flight outcome must have queued the request");
    await drainPendingAcquires(listener.pendingAcquires);
    const grant = await client.next();
    assert.equal(grant.kind, "grant", `expected the retry to be granted, got ${JSON.stringify(grant)}`);
    assert.equal(received.length, 2, "onAcquire must have been called twice -- the first attempt and the drained retry");
    assert.deepEqual(received[1], { warp: true }, "the RETRY must carry the profile the request was made with -- a profile-less retry would silently serve an unwarped instance");
  } finally {
    client.close();
    listener.server.close();
  }
});

// ============================================================================
// Plan 62-01, task 1: the `hello` handshake op and its pre-token-gate
// dispatch. See this module's own handleLine() comment for why the arm's
// PLACEMENT (before tokensMatch(), not one more arm of the existing chain)
// is load-bearing, not incidental.
// ============================================================================

const BROKER_CONTROL_MTS = join(HERE, "broker-control.mts");

test("the ControlRequestKind union has exactly fourteen members including hello, attach, operation, stage_file, transfer, host_tool_stage and host_tool_run, and the hello arm's dispatch sits before the tokensMatch() call", () => {
  const source = readFileSync(BROKER_CONTROL_MTS, "utf8");

  const unionMatch = source.match(/export type ControlRequestKind = ([^;]+);/);
  assert.ok(unionMatch, "ControlRequestKind union declaration not found");
  const members = unionMatch![1]
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  assert.equal(members.length, 14, `expected 14 ControlRequestKind members, got ${members.length}: ${JSON.stringify(members)}`);
  assert.ok(members.includes('"hello"'), `hello must be a member of ControlRequestKind, got ${JSON.stringify(members)}`);
  assert.ok(members.includes('"attach"'), `attach must be a member of ControlRequestKind, got ${JSON.stringify(members)}`);
  assert.ok(members.includes('"operation"'), `operation must be a member of ControlRequestKind, got ${JSON.stringify(members)}`);
  assert.ok(members.includes('"stage_file"'), `stage_file must be a member of ControlRequestKind, got ${JSON.stringify(members)}`);
  assert.ok(members.includes('"transfer"'), `transfer must be a member of ControlRequestKind, got ${JSON.stringify(members)}`);
  assert.ok(members.includes('"host_tool_stage"'), `host_tool_stage must be a member of ControlRequestKind, got ${JSON.stringify(members)}`);
  assert.ok(members.includes('"host_tool_run"'), `host_tool_run must be a member of ControlRequestKind, got ${JSON.stringify(members)}`);

  const helloArmOffset = source.indexOf('req.op === "hello"');
  const tokensMatchCallOffset = source.indexOf("tokensMatch(token, opts.token)");
  assert.ok(helloArmOffset >= 0, "hello dispatch (req.op === \"hello\") not found in source");
  assert.ok(tokensMatchCallOffset >= 0, "tokensMatch(token, opts.token) call not found in source");
  assert.ok(
    helloArmOffset < tokensMatchCallOffset,
    `hello arm (offset ${helloArmOffset}) must be dispatched BEFORE tokensMatch() (offset ${tokensMatchCallOffset}) -- a future refactor moved the arm below the gate`,
  );
});

test("a raw hello line with NO token field returns a handshake reply, never unauthorized", async () => {
  const { listener } = await startTestListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "hello" });
    const reply = await client.next();
    assert.equal(reply.kind, "hello");
    assert.equal(reply.protocol, HELLO_PROTOCOL_MAGIC);
    assert.notEqual(reply.kind, "error");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("a raw status line with NO token field still returns the unauthorized error code, proving the eight existing ops' gate is unchanged", async () => {
  const { listener } = await startTestListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "status" });
    const reply = await client.next();
    assert.equal(reply.kind, "error");
    assert.equal(reply.code, "unauthorized");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("the hello reply's key set is exactly kind/protocol/version/tag -- no token, path, hostname or instance detail may be added without this test going red", async () => {
  const { listener } = await startTestListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "hello" });
    const reply = await client.next();
    assert.deepEqual(Object.keys(reply).sort(), ["kind", "protocol", "tag", "version"]);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("hello's tag defaults to \"control\" when the request supplies none, and echoes an arbitrary caller-supplied string unchanged", async () => {
  const { listener } = await startTestListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "hello" });
    const defaulted = await client.next();
    assert.equal(defaulted.tag, "control");

    client.send({ op: "hello", tag: "monitor-relay-42" });
    const tagged = await client.next();
    assert.equal(tagged.tag, "monitor-relay-42");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("hello's version uses the injected helloVersion override when supplied, and resolveBrokerVersion() otherwise", async () => {
  const overridden = await startTestListener({ helloVersion: "9.9.9-test-override" });
  const overrideClient = makeClient(overridden.listener.port);
  try {
    overrideClient.send({ op: "hello" });
    const reply = await overrideClient.next();
    assert.equal(reply.version, "9.9.9-test-override");
  } finally {
    overrideClient.close();
    overridden.listener.server.close();
  }

  const defaulted = await startTestListener();
  const defaultClient = makeClient(defaulted.listener.port);
  try {
    defaultClient.send({ op: "hello" });
    const reply = await defaultClient.next();
    assert.equal(reply.version, resolveBrokerVersion());
  } finally {
    defaultClient.close();
    defaulted.listener.server.close();
  }
});

test("resolveBrokerVersion() degrades to the dev placeholder when no package.json is found at either candidate", () => {
  const version = resolveBrokerVersion("/tmp/nonexistent-dir-for-resolveBrokerVersion-test");
  assert.equal(version, "0.0.0-dev");
});

// ============================================================================
// 62-03-PLAN.md, Task 1: interface enumeration (BROKER-03/D-09/D-10) and a
// multi-address listener sharing exactly one pending-acquire queue
// (BROKER-01/BROKER-03). Every synthetic interface map below is shaped
// exactly like the live os.networkInterfaces() output captured in
// 62-RESEARCH.md: a top-level key per interface name, an ARRAY of address
// records per interface, `internal: true` marking loopback (never the name
// "lo", which is "lo0" on macOS/BSD).
// ============================================================================

function ipv4Record(address: string, overrides: Partial<NetworkInterfaceInfo> = {}): NetworkInterfaceInfo {
  return {
    address,
    netmask: "255.255.255.0",
    family: "IPv4",
    mac: "00:00:00:00:00:00",
    internal: false,
    cidr: `${address}/24`,
    ...overrides,
  } as NetworkInterfaceInfo;
}

function ipv6Record(address: string, overrides: Partial<NetworkInterfaceInfo> = {}): NetworkInterfaceInfo {
  return {
    address,
    netmask: "ffff:ffff:ffff:ffff::",
    family: "IPv6",
    mac: "00:00:00:00:00:00",
    internal: false,
    cidr: `${address}/64`,
    scopeid: 0,
    ...overrides,
  } as NetworkInterfaceInfo;
}

test("BRIDGE_INTERFACE_ALLOWLIST has exactly four entries, each of the four D-09 names matches exactly one", () => {
  assert.equal(BRIDGE_INTERFACE_ALLOWLIST.length, 4);
  for (const name of ["docker0", "br-1234567890ab", "podman0", "cni-abcdef01"]) {
    const matches = BRIDGE_INTERFACE_ALLOWLIST.filter((pattern) => pattern.test(name));
    assert.equal(matches.length, 1, `expected exactly one allowlist pattern to match "${name}", got ${matches.length}`);
  }
});

test("enumerateBindHosts: loopback plus one allowlisted bridge -- both addresses, loopback first", () => {
  const hosts = enumerateBindHosts({
    networkInterfaces: () => ({
      lo: [ipv4Record("127.0.0.1", { internal: true }), ipv6Record("::1", { internal: true })],
      docker0: [ipv4Record("172.17.0.1"), ipv6Record("fe80::1")],
    }),
  });
  assert.deepEqual(hosts, ["127.0.0.1", "172.17.0.1"]);
});

test("enumerateBindHosts: loopback with no allowlisted bridge returns loopback alone and does not signal an error", () => {
  const hosts = enumerateBindHosts({
    networkInterfaces: () => ({
      lo: [ipv4Record("127.0.0.1", { internal: true })],
      wlp0s20f3: [ipv4Record("192.168.1.50")],
    }),
  });
  assert.deepEqual(hosts, ["127.0.0.1"]);
});

test("enumerateBindHosts: per-container virtual interfaces and the host's own wireless interface are never returned", () => {
  const hosts = enumerateBindHosts({
    networkInterfaces: () => ({
      lo: [ipv4Record("127.0.0.1", { internal: true })],
      vethb98b6d9: [ipv6Record("fe80::c440:f4ff:feab:ff65")],
      wlp0s20f3: [ipv4Record("192.168.1.50")],
    }),
  });
  assert.deepEqual(hosts, ["127.0.0.1"]);
});

test("enumerateBindHosts: an allowlisted interface carrying both IPv4 and IPv6 -- only the IPv4 address is returned", () => {
  const hosts = enumerateBindHosts({
    networkInterfaces: () => ({
      lo: [ipv4Record("127.0.0.1", { internal: true })],
      docker0: [ipv4Record("172.17.0.1"), ipv6Record("fe80::c440:f4ff:feab:ff65")],
    }),
  });
  assert.deepEqual(hosts, ["127.0.0.1", "172.17.0.1"]);
  assert.equal(hosts.length, 2);
  assert.ok(!hosts.some((h) => h.includes(":")), "no returned address may contain a colon (IPv6 marker)");
});

test("enumerateBindHosts: each allowlist pattern is recognised by interface name", () => {
  const hosts = enumerateBindHosts({
    networkInterfaces: () => ({
      lo: [ipv4Record("127.0.0.1", { internal: true })],
      docker0: [ipv4Record("172.17.0.1")],
      "br-abcdef012345": [ipv4Record("172.18.0.1")],
      podman0: [ipv4Record("10.88.0.1")],
      "cni-podman0": [ipv4Record("10.89.0.1")],
    }),
  });
  assert.deepEqual(hosts, ["127.0.0.1", "172.17.0.1", "172.18.0.1", "10.88.0.1", "10.89.0.1"]);
});

test("enumerateBindHosts: no loopback entry at all returns an empty set, never throws and never signals an error", () => {
  const hosts = enumerateBindHosts({
    networkInterfaces: () => ({
      wlp0s20f3: [ipv4Record("192.168.1.50")],
    }),
  });
  assert.deepEqual(hosts, []);
});

test("enumerateBindHosts: calls the injected networkInterfaces() exactly once per invocation -- no internal re-enumeration", () => {
  let calls = 0;
  const hosts = enumerateBindHosts({
    networkInterfaces: () => {
      calls++;
      return { lo: [ipv4Record("127.0.0.1", { internal: true })] };
    },
  });
  assert.deepEqual(hosts, ["127.0.0.1"]);
  assert.equal(calls, 1, "enumerateBindHosts must read the interface list exactly once per call -- a second call is never made from a timer or an interval");
});

test("startControlListenerOnHosts: two listeners on two different bound addresses share exactly one pending-acquire queue, serving two acquires in arrival order", async () => {
  let inFlight = true;
  const token = newControlToken();
  const listenerOpts = {
    port: 0,
    token,
    onAcquire: async (): Promise<AcquireOutcome> => {
      if (inFlight) return { ok: false, reason: "launch_in_flight" };
      return { ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/e.json", supervisorDir: "/tmp/6600" } };
    },
    onRelease: () => {},
    onStatus: (): StatusInstanceEntry[] => [],
    onHostState: (): HostStateFields => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      maxInstances: 16,
      basePort: 6600,
      backend: "stock" as const,
    }),
    onMonitorClaim: (): MonitorClaimOutcome => ({ ok: true, handle: "test-handle" }),
    onMonitorRelease: (): MonitorReleaseOutcome => ({ ok: true }),
    onRelayAttach: (): RelayAttachOutcome => ({ ok: false, code: "internal" }),
    onOperation: (): OperationNoteOutcome => ({ ok: true }),
    onHostTool: async () => ({ ok: false, message: "not exercised by this test" }),
  };

  // Two distinct loopback addresses -- both bindable without extra
  // configuration on this project's CI platform (ubuntu-latest); the whole
  // 127.0.0.0/8 range routes to loopback on Linux.
  const { listeners, failures, pendingAcquires } = await startControlListenerOnHosts(["127.0.0.1", "127.0.0.2"], listenerOpts);
  try {
    assert.deepEqual(failures, []);
    assert.equal(listeners.length, 2);
    assert.ok(listeners[0].pendingAcquires === listeners[1].pendingAcquires, "both listeners must share the exact same queue reference, not per-listener copies");
    assert.ok(pendingAcquires === listeners[0].pendingAcquires);

    const clientA = makeClient(listeners[0].port, listeners[0].host);
    const clientB = makeClient(listeners[1].port, listeners[1].host);
    try {
      clientA.send({ op: "acquire", id: "req-A", token });
      await waitFor(() => pendingAcquires.length === 1, 2000);
      clientB.send({ op: "acquire", id: "req-B", token });
      await waitFor(() => pendingAcquires.length === 2, 2000);

      assert.deepEqual(
        pendingAcquires.map((e) => e.requestId),
        ["req-A", "req-B"],
        "arrival order must be preserved regardless of which bound address each request arrived on",
      );

      inFlight = false;
      await drainPendingAcquires(pendingAcquires);
      const [a, b] = await Promise.all([clientA.next(), clientB.next()]);
      assert.equal(a.kind, "grant");
      assert.equal(b.kind, "grant");
      assert.equal(pendingAcquires.length, 0);
    } finally {
      clientA.close();
      clientB.close();
    }
  } finally {
    for (const l of listeners) l.server.close();
  }
});

test("structural: no `sort()` call appears anywhere in the enumeration/multi-host bind region -- order falls out of append order alone", () => {
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const start = source.indexOf("Interface enumeration and the bridge allowlist");
  assert.ok(start !== -1, "could not locate the enumeration region marker");
  const region = source.slice(start);
  const count = (region.match(/\.sort\(/g) ?? []).length;
  assert.equal(count, 0, "no sort() call may appear from the enumeration region to the end of the file");
});

// ============================================================================
// Plan 63-04, Task 2 (SESS-04): the keepalive delay is set on every accepted
// connection.
// ============================================================================

test("attachControlProtocol: every accepted connection gets a keepalive delay -- a plain control connection included, not only a relay one", async () => {
  const calls: Array<{ enable: boolean | undefined; ms: number | undefined }> = [];
  const NetSocketModule = await import("node:net");
  const original = NetSocketModule.Socket.prototype.setKeepAlive;
  NetSocketModule.Socket.prototype.setKeepAlive = function (this: import("node:net").Socket, enable?: boolean, ms?: number) {
    calls.push({ enable, ms });
    return original.call(this, enable, ms);
  } as typeof original;
  try {
    const { listener, token } = await startTestListener();
    try {
      const client = makeClient(listener.port);
      client.send({ op: "status", token });
      await client.next();
      client.close();
      await waitFor(() => calls.length > 0, 2000);
      assert.ok(calls.length > 0, "setKeepAlive() must be called on the accepted connection");
      const call = calls[calls.length - 1]!;
      assert.equal(call.enable, true);
      assert.equal(typeof call.ms, "number");
      assert.ok((call.ms as number) > 0, "the keepalive delay must be a positive number of milliseconds, never zero");
    } finally {
      listener.server.close();
    }
  } finally {
    NetSocketModule.Socket.prototype.setKeepAlive = original;
  }
});

test("structural: the DEFAULT_RELAY_KEEPALIVE_MS literal mirrored in broker-control.mts agrees with broker-relay.mts's own value", () => {
  const relaySource = readFileSync(join(HERE, "broker-relay.mts"), "utf8");
  const controlSource = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const relayMatch = relaySource.match(/export const DEFAULT_RELAY_KEEPALIVE_MS = (\d+);/);
  const controlMatch = controlSource.match(/const DEFAULT_RELAY_KEEPALIVE_MS_LOCAL = (\d+);/);
  assert.ok(relayMatch, "broker-relay.mts must export DEFAULT_RELAY_KEEPALIVE_MS as a numeric literal");
  assert.ok(controlMatch, "broker-control.mts must declare DEFAULT_RELAY_KEEPALIVE_MS_LOCAL as a numeric literal");
  assert.equal(controlMatch![1], relayMatch![1], "the two mirrored default literals must never drift apart");
});

// ============================================================================
// Plan 63-05, Task 2 (SESS-06): the concurrency edge SESS-02 raises, at the
// level a user actually observes it -- two unrelated sessions on one broker,
// each separately named and separately reclaimed -- plus the invariant test
// the phase's own assumption-delta decision promised (63-01-PLAN.md): the
// session became the primary user-facing IDENTITY, but authorisation was
// deliberately NOT generalised.
// ============================================================================

test("two sessions, one broker: two connections declaring two labels each acquire their own grant against distinct ports, status names both separately, and closing one releases only that one", async () => {
  // The identity RESOLUTION itself (matching an instance to its owning
  // grant by port+pid) is vice-broker.mts's own job, proven directly against
  // handleAcquire()/handleStatus() in vice-broker-acquire.test.ts (Task 1).
  // This test proves broker-control.mts's OWN dispatch plumbing: a declared
  // label reaches onAcquire's third argument, and whatever onStatus reports
  // for the resulting grants is delivered to the wire unchanged.
  const grants = new Map<string, { port: number; label: string | null }>();
  let nextPort = 16700;
  const { listener, token, releases } = await startTestListener({
    onAcquire: async (id: string, _profile?: LaunchProfile, label?: string | null) => {
      const port = nextPort++;
      grants.set(id, { port, label: label ?? null });
      return { ok: true, grant: { port, url: `http://127.0.0.1:${port}/mcp`, epochFile: `/tmp/${port}/epoch.json`, supervisorDir: `/tmp/${port}` } };
    },
    onStatus: (): StatusInstanceEntry[] =>
      Array.from(grants.entries()).map(([grantId, g]) => ({
        port: g.port,
        url: `http://127.0.0.1:${g.port}/mcp`,
        state: "granted",
        reason: "acquire",
        epoch: null,
        hasMonitorClient: false,
        sessionLabel: g.label,
        grantId,
        operation: null,
      })),
  });
  const clientA = makeClient(listener.port);
  const clientB = makeClient(listener.port);
  try {
    clientA.send({ op: "acquire", id: "grant-a", token, label: "session-a" });
    const grantA = await clientA.next();
    assert.equal(grantA.kind, "grant", `expected a grant for A, got ${JSON.stringify(grantA)}`);

    clientB.send({ op: "acquire", id: "grant-b", token, label: "session-b" });
    const grantB = await clientB.next();
    assert.equal(grantB.kind, "grant", `expected a grant for B, got ${JSON.stringify(grantB)}`);

    clientA.send({ op: "status", token });
    const status1 = await clientA.next();
    const entries1 = status1.instances as StatusInstanceEntry[];
    assert.equal(entries1.length, 2, "both live grants must be named");
    assert.equal(entries1.filter((e) => e.sessionLabel === "session-a").length, 1, "session-a's label must appear exactly once");
    assert.equal(entries1.filter((e) => e.sessionLabel === "session-b").length, 1, "session-b's label must appear exactly once");
    const byLabel1 = new Map(entries1.map((e) => [e.sessionLabel, e]));
    assert.equal(byLabel1.get("session-a")?.port, grantA.port, "session-a's entry must be against ITS OWN port");
    assert.equal(byLabel1.get("session-b")?.port, grantB.port, "session-b's entry must be against ITS OWN port");

    // Close connection A -- its own release must fire, for its own grant id
    // only. This simulates what the REAL onRelease callback would do to
    // broker state (deleting the grant) so the subsequent status reply
    // reflects a real release's effect.
    clientA.close();
    await waitFor(() => releases.includes("grant-a"), 2000);
    assert.deepEqual(releases, ["grant-a"], "closing A must release only A's own grant id -- B's is untouched");
    grants.delete("grant-a");

    clientB.send({ op: "status", token });
    const status2 = await clientB.next();
    const entries2 = status2.instances as StatusInstanceEntry[];
    assert.equal(entries2.length, 1, "only B's grant remains");
    assert.equal(entries2[0]?.sessionLabel, "session-b", "a fresh status must still name B with B's own label");
    assert.equal(entries2[0]?.grantId, "grant-b");
  } finally {
    clientA.close();
    clientB.close();
    listener.server.close();
  }
});

// The set of ControlRequestKind members this invariant test classifies as
// NOT taking a caller-supplied target id at all -- `acquire`/`release` name
// no target (the connection's own held grant IS the target for `release`);
// `status`/`host_state`/`host_tool`/`hello` never resolve against a grant.
// `transfer` (Phase 64, XFER-04) joins this set: its request carries a
// `handle`, never a `target_id` (see this plan's wire_vocabulary block) --
// the SAME T-63-01 reasoning that already puts `attach`'s handle authority
// on a DIFFERENT connection than the one that named a target_id, except
// `transfer` never reads target_id at all, so it cannot be exercised by
// this test's target_id-substitution shape.
// `host_tool_stage`/`host_tool_run` (Phase 65, SEAM-01) join this set too:
// neither reads `target_id` at all -- `host_tool_stage` carries only
// `files`, `host_tool_run` carries `tool`/`args`/`request` (a request KEY,
// never a target id), and both are gated on a per-connection BOUND request
// key, never on `ownsTarget()`.
const KNOWN_NON_TARGET_NAMING_OPS = new Set(["acquire", "release", "status", "host_state", "host_tool", "hello", "transfer", "host_tool_stage", "host_tool_run"]);
// The set this invariant test actually EXERCISES below -- every op whose
// dispatch arm reads `req.target_id` and resolves it against a grant.
// `stage_file` (Phase 64, XFER-04) joins this set: gated by the SAME
// ownsTarget() predicate as monitor_claim/monitor_release/operation.
const TARGET_NAMING_OPS_UNDER_TEST = ["monitor_claim", "monitor_release", "attach", "operation", "stage_file"];

test("invariant (63-05, T-63-17): every target-naming op refuses ANOTHER session's declared label used as a target id, byte-identically to a bare unrelated garbage target id, and the refusal never quotes the label back; the covered op set is asserted against ControlRequestKind so a future target-naming op reds this test until it is listed", async () => {
  // Structural half FIRST: read ControlRequestKind's own live declaration
  // (the same idiom the eleven-members test above already uses) and require
  // EVERY member to be classified into exactly one of the two lists above --
  // a future op that is neither breaks this assertion before any behaviour
  // is even exercised, so it cannot be added silently.
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const match = /export type ControlRequestKind =([^;]*);/.exec(source);
  assert.ok(match, "ControlRequestKind's declaration must be findable in broker-control.mts");
  const members = match![1]
    .split("|")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter((s) => s !== "");
  for (const member of members) {
    assert.ok(
      KNOWN_NON_TARGET_NAMING_OPS.has(member) || TARGET_NAMING_OPS_UNDER_TEST.includes(member),
      `ControlRequestKind member "${member}" is neither a known non-target-naming op nor covered by this invariant test -- classify it (add it to one of the two lists above this test) before this test can pass`,
    );
  }
  assert.equal(
    members.length,
    KNOWN_NON_TARGET_NAMING_OPS.size + TARGET_NAMING_OPS_UNDER_TEST.length,
    "every ControlRequestKind member must be classified exactly once, into exactly one of the two lists",
  );

  // Behavioural half: from connection B (which never held A's grant and
  // never saw A's label as anything but an opaque string), send every
  // target-naming op with `target_id` set to A's OWN DECLARED label, and
  // compare the refusal against the SAME op sent with an unrelated garbage
  // target id. The two responses must be byte-identical -- proving the
  // label is never resolved to anything, treated exactly like any other
  // unrecognised string.
  const { listener, token } = await startTestListener({
    onAcquire: grantingAcquire(),
    onRelayAttach: (): RelayAttachOutcome => ({ ok: false, code: "denied" }),
  });
  const clientA = makeClient(listener.port);
  const clientB = makeClient(listener.port);
  const aLabel = "agent-session-a-declared-label";
  try {
    clientA.send({ op: "acquire", id: "grant-a", token, label: aLabel });
    const grantA = await clientA.next();
    assert.equal(grantA.kind, "grant", `precondition: A must hold a grant; got ${JSON.stringify(grantA)}`);

    await acquireGrant(clientB, token, "grant-b");

    const garbageId = "totally-unrelated-garbage-id-12345";

    for (const op of TARGET_NAMING_OPS_UNDER_TEST) {
      const baseRequest: Record<string, unknown> = { op, token, channel: "binary" };
      if (op === "attach") baseRequest.handle = "bogus-handle-b-does-not-hold";
      if (op === "operation") baseRequest.name = "vice_ping";
      if (op === "stage_file") baseRequest.slot = "autostart";

      clientB.send({ ...baseRequest, id: `${op}-garbage`, target_id: garbageId });
      const garbageResp = await clientB.next();

      clientB.send({ ...baseRequest, id: `${op}-label`, target_id: aLabel });
      const labelResp = await clientB.next();

      assert.deepEqual(
        labelResp,
        garbageResp,
        `op "${op}": sending A's declared label as target_id must produce a BYTE-IDENTICAL refusal to an unrelated garbage target id -- garbage=${JSON.stringify(garbageResp)} label=${JSON.stringify(labelResp)}`,
      );
      assert.ok(
        !JSON.stringify(labelResp).includes(aLabel),
        `op "${op}": the refusal must never quote the label back: ${JSON.stringify(labelResp)}`,
      );
      assert.notEqual(labelResp.kind, "grant", `op "${op}" must never SUCCEED against another session's label`);
    }

    // A's own grant must be entirely untouched by every attempt above --
    // prove it can still declare an operation on it through its own connection.
    clientA.send({ op: "operation", id: "op-a-still-alive", target_id: "grant-a", name: "vice_ping", token });
    const ownResp = await clientA.next();
    assert.equal(ownResp.kind, "operation_noted", "A's own grant must be unaffected by every refused attempt against its label");
  } finally {
    clientA.close();
    clientB.close();
    listener.server.close();
  }
});

// ============================================================================
// Plan 63-05, Task 3 (SESS-01): the behavioural half of "a stateless call
// binds no lease". The stateless call shape already ships (host-tool-
// client.ts's hostToolOverControlPlane()) and its own callback (onHostTool)
// is declared separately from every lease callback, so the dispatch branch
// structurally cannot reach lease state -- see StartControlListenerOptions'
// own onHostTool comment. What this proves is the OBSERVATION a reader of
// status would actually rely on: the broker's state is unchanged across
// such a call, not merely "the callback is declared separately" as a claim
// read out of a comment.
// ============================================================================

test("stateless call (63-05, SESS-01): a host_tool request never fires an acquire, release, monitor-claim, monitor-release, attach or operation callback, the closed connection's own close triggers no release, and status is unchanged across ten sequential calls", async () => {
  const calls = { acquire: 0, release: 0, monitorClaim: 0, monitorRelease: 0, attach: 0, operation: 0 };
  const fixedStatus: StatusInstanceEntry[] = [
    { port: 6600, url: "http://127.0.0.1:6600/mcp", state: "ready", reason: "spare", epoch: null, hasMonitorClient: false, sessionLabel: null, grantId: null, operation: null },
  ];
  const { listener, token } = await startTestListener({
    onAcquire: async () => {
      calls.acquire++;
      return { ok: false, reason: "internal" } as AcquireOutcome;
    },
    onRelease: () => {
      calls.release++;
    },
    onStatus: () => fixedStatus,
    onMonitorClaim: () => {
      calls.monitorClaim++;
      return { ok: false, code: "internal" } as MonitorClaimOutcome;
    },
    onMonitorRelease: () => {
      calls.monitorRelease++;
      return { ok: false, code: "internal" } as MonitorReleaseOutcome;
    },
    onRelayAttach: (): RelayAttachOutcome => {
      calls.attach++;
      return { ok: false, code: "internal" };
    },
    onOperation: (): OperationNoteOutcome => {
      calls.operation++;
      return { ok: true };
    },
    onHostTool: async () => ({ ok: true, tool: "acme.build", exitStatus: 0, results: [], stderrTail: "" }),
  });

  const observer = makeClient(listener.port);
  try {
    observer.send({ op: "status", token });
    const snapshotBefore = await observer.next();

    for (let i = 0; i < 10; i++) {
      const stateless = makeClient(listener.port);
      stateless.send({ op: "host_tool", id: `stateless-${i}`, token, tool: "acme.build", args: {} });
      const reply = (await stateless.next()) as { ok: boolean };
      assert.equal(reply.ok, true, `stateless call ${i} must succeed against the stubbed onHostTool`);
      stateless.close();
      // Let the "close" event on THIS connection actually fire and run
      // through attachControlProtocol()'s own close handler before moving
      // on -- a per-call leak of any kind (an accidental release, a
      // fabricated grant) would show up here, not merely at the very end.
      await waitFor(() => true, 10);
    }

    observer.send({ op: "status", token });
    const snapshotAfter = await observer.next();

    assert.deepEqual(snapshotAfter, snapshotBefore, "status must be byte-identical before and after ten stateless calls");
    assert.deepEqual(
      calls,
      { acquire: 0, release: 0, monitorClaim: 0, monitorRelease: 0, attach: 0, operation: 0 },
      "no lease-bearing callback may ever fire for a stateless host_tool call, across any of the ten repetitions",
    );
  } finally {
    observer.close();
    listener.server.close();
  }
});
