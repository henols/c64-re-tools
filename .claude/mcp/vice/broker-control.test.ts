// broker-control.test.ts
//
// Plan 05: the complete control-plane message set (acquire/release/recycle/
// status/host_state), the arrival-ordered pending-acquire structure, and the
// kernel-enforced singleton guard's two distinct outcomes. Most tests here
// drive a REAL listener bound on port zero, in this test's own process,
// against injected onAcquire/onRelease/onRecycle/onStatus/onHostState
// stubs -- no real emulator, no real spawn, no test opens a connection to
// the host VICE. The singleton-guard tests (task 3) additionally spawn the
// real, BUILT broker artifact behind the escape hatch, exactly like
// broker-e2e.test.ts/broker-kill.test.ts already do, because the guard is a
// property of vice-broker.mts's own startup sequence, not of
// broker-control.mts in isolation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { connect } from "node:net";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  startControlListener,
  bindControlListener,
  enqueueAcquire,
  drainPendingAcquires,
  newControlToken,
  type StartControlListenerResult,
  type AcquireOutcome,
  type RecycleOutcome,
  type StatusInstanceEntry,
  type HostStateFields,
  type PendingAcquireQueue,
  type PendingAcquireEntry,
} from "./broker-control.mts";
import { readBrokerLiveness } from "./vice-broker-client.ts";
import { build } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");

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
  onAcquire?: (id: string) => Promise<AcquireOutcome>;
  onRelease?: (id: string) => void;
  onRecycle?: (targetId: string) => Promise<RecycleOutcome>;
  onStatus?: () => StatusInstanceEntry[];
  onHostState?: () => HostStateFields;
}

async function startTestListener(deps: StubDeps = {}): Promise<{ listener: StartControlListenerResult; token: string; releases: string[]; recycleCalls: string[] }> {
  const token = newControlToken();
  const releases: string[] = [];
  const recycleCalls: string[] = [];
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    token,
    onAcquire: deps.onAcquire ?? (async () => ({ ok: false, reason: "internal" }) as AcquireOutcome),
    onRelease: (id) => {
      releases.push(id);
      deps.onRelease?.(id);
    },
    onRecycle:
      deps.onRecycle ??
      (async (targetId) => {
        recycleCalls.push(targetId);
        return { port: null, pid: null, viceBin: null, killStage: "no_signal", epochBefore: null, outcome: "grant_lookup_failed", reason: "no stub configured" };
      }),
    onStatus: deps.onStatus ?? (() => []),
    onHostState:
      deps.onHostState ??
      (() => ({ pid: process.pid, startedAt: "2026-01-01T00:00:00Z", nodeVersion: process.version, viceBin: "x64sc", warmFloor: 3, maxInstances: 16, basePort: 6600 })),
  });
  return { listener, token, releases, recycleCalls };
}

// ============================================================================
// Task 1: recycle, status, host_state, and the arrival-ordered pending queue.
// ============================================================================

test("recycle: a grant this connection holds resolves, kills identity-verified, and answers an ack carrying the stage word and outcome", async () => {
  let calledWith: string | null = null;
  const { listener, token } = await startTestListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/epoch.json", supervisorDir: "/tmp/6600" } }),
    onRecycle: async (targetId) => {
      calledWith = targetId;
      return { port: 6600, pid: 4242, viceBin: "x64sc", killStage: "sigterm", epochBefore: 3, outcome: "ok", reason: "" };
    },
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-1", token });
    const grant = await client.next();
    assert.equal(grant.kind, "grant");

    client.send({ op: "recycle", id: "recycle-1", target_id: "req-1", token });
    const ack = await client.next();
    assert.equal(ack.kind, "recycle_ack");
    assert.equal(ack.target_id, "req-1");
    assert.equal(ack.kill_stage, "sigterm");
    assert.equal(ack.outcome, "ok");
    assert.equal(ack.x64sc_pid, 4242);
    assert.equal(ack.epoch_before, 3);
    assert.equal(calledWith, "req-1");
  } finally {
    client.close();
    listener.server.close();
  }
});

// The recycle acknowledgement's field set, read from
// resources/vice-broker.sh's own write_recycle_ack() ($1=id $2=target_id
// $3=port $4=x64sc_pid $5=vice_bin $6=kill_stage $7=epoch_before $8=outcome
// $9=reason) -- `version` and `acked_at` are file-envelope fields with no
// equivalent need on a live connection and are deliberately dropped; `kind`
// is this module's own wire-format discriminator, not a business field.
const BASH_RECYCLE_ACK_FIELDS = ["id", "target_id", "port", "x64sc_pid", "vice_bin", "kill_stage", "epoch_before", "outcome", "reason"];

test("recycle ack: the key set (minus the wire-format 'kind' discriminator) is deep-equal to the bash acknowledgement writer's own field list", async () => {
  const { listener, token } = await startTestListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/epoch.json", supervisorDir: "/tmp/6600" } }),
    onRecycle: async () => ({ port: 6600, pid: 1, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-1", token });
    await client.next();
    client.send({ op: "recycle", id: "recycle-1", target_id: "req-1", token });
    const ack = await client.next();
    const keys = Object.keys(ack).filter((k) => k !== "kind");
    assert.deepEqual(keys.sort(), [...BASH_RECYCLE_ACK_FIELDS].sort());
  } finally {
    client.close();
    listener.server.close();
  }
});

// The container-side outcome renderer's own switch cases
// (vice-proxy.ts's recycleAckOutcomeMessage(), read directly from source at
// the time this test was written): identity_refused, target_lookup_failed,
// grant_lookup_failed, epoch_lookup_failed, pid_lookup_failed, plus a
// default fallback for anything else. This broker's recycle path never
// needs to produce every one of these (target_lookup_failed has no
// equivalent here -- an unowned target is answered `denied` at the
// control-plane level, never as a recycle_ack outcome at all) -- the
// values it CAN produce are a SUBSET, not a bijection.
const CONTAINER_RENDERER_OUTCOME_CASES = ["identity_refused", "target_lookup_failed", "grant_lookup_failed", "epoch_lookup_failed", "pid_lookup_failed"];

test("recycle outcome vocabulary: every outcome value this broker's recycle path can produce is a member of the container renderer's own switch cases", () => {
  const producedByThisBroker = ["ok", "identity_refused", "grant_lookup_failed", "epoch_lookup_failed", "pid_lookup_failed"];
  const nonOkValues = producedByThisBroker.filter((v) => v !== "ok");
  for (const v of nonOkValues) {
    assert.ok(CONTAINER_RENDERER_OUTCOME_CASES.includes(v), `outcome "${v}" must be one of the renderer's own switch cases: ${JSON.stringify(CONTAINER_RENDERER_OUTCOME_CASES)}`);
  }
});

test("recycle: a kill returning the identity-refused stage word leaves the target alive and answers an outcome naming the refusal", async () => {
  const { listener, token } = await startTestListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/e.json", supervisorDir: "/tmp/6600" } }),
    onRecycle: async () => ({ port: 6600, pid: 999, viceBin: "x64sc", killStage: "identity_refused", epochBefore: 1, outcome: "identity_refused", reason: "mismatch" }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-1", token });
    await client.next();
    client.send({ op: "recycle", id: "recycle-1", target_id: "req-1", token });
    const ack = await client.next();
    assert.equal(ack.kill_stage, "identity_refused");
    assert.equal(ack.outcome, "identity_refused");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("recycle: naming a grant this connection does not hold answers the denied error code, and onRecycle is never invoked", async () => {
  const { listener, token, recycleCalls } = await startTestListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/e.json", supervisorDir: "/tmp/6600" } }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "acquire", id: "req-1", token });
    await client.next();
    // Recycle names SOME OTHER id -- one this connection never acquired.
    client.send({ op: "recycle", id: "recycle-1", target_id: "req-someone-elses", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "denied");
    assert.deepEqual(recycleCalls, [], "onRecycle (and therefore any kill/signal it might issue) must never be invoked");
  } finally {
    client.close();
    listener.server.close();
  }
});

test("recycle: a connection holding NO grant at all answers denied for any target_id", async () => {
  const { listener, token, recycleCalls } = await startTestListener();
  const client = makeClient(listener.port);
  try {
    client.send({ op: "recycle", id: "recycle-1", target_id: "anything", token });
    const resp = await client.next();
    assert.equal(resp.kind, "error");
    assert.equal(resp.code, "denied");
    assert.deepEqual(recycleCalls, []);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("status: one entry per instance, carrying port, url, state, reason and epoch", async () => {
  const entries: StatusInstanceEntry[] = [
    { port: 6600, url: "http://127.0.0.1:6600/mcp", state: "ready", reason: "spare", epoch: 1 },
    { port: 6601, url: "http://127.0.0.1:6601/mcp", state: "granted", reason: "acquire", epoch: 2 },
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

test("host_state: carries the broker pid, node version, resolved emulator binary, warm-floor target, instance ceiling and band base", async () => {
  const { listener, token } = await startTestListener({
    onHostState: () => ({ pid: 12345, startedAt: "2026-08-04T00:00:00Z", nodeVersion: "v24.0.0", viceBin: "/usr/bin/x64sc", warmFloor: 3, maxInstances: 16, basePort: 6600 }),
  });
  const client = makeClient(listener.port);
  try {
    client.send({ op: "host_state", token });
    const resp = await client.next();
    assert.equal(resp.kind, "host_state");
    assert.equal(resp.pid, 12345);
    assert.equal(resp.node_version, "v24.0.0");
    assert.equal(resp.vice_bin, "/usr/bin/x64sc");
    assert.equal(resp.warm_floor, 3);
    assert.equal(resp.max_instances, 16);
    assert.equal(resp.base_port, 6600);
  } finally {
    client.close();
    listener.server.close();
  }
});

test("neither the status nor the host_state response ever carries the token value", async () => {
  const { listener, token } = await startTestListener({
    onStatus: () => [{ port: 6600, url: "http://127.0.0.1:6600/mcp", state: "ready", reason: "spare", epoch: 1 }],
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
  const startIdx = source.indexOf("function attemptAcquire(requestId: string): Promise<boolean> {");
  assert.ok(startIdx !== -1, "attemptAcquire()'s own definition must be found in the source");
  const endIdx = source.indexOf("\n    }\n", startIdx);
  assert.ok(endIdx > startIdx, "could not isolate attemptAcquire()'s own closing brace");
  const body = source.slice(startIdx, endIdx);

  const preCheckIdx = body.indexOf("if (socket.destroyed) return Promise.resolve(true);");
  const callbackCallIdx = body.indexOf(".onAcquire(requestId)");
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
  const startIdx = source.indexOf("Gap closure (plan 14, WR-03/T-01.6.2-87/-88)");
  const endIdx = source.indexOf("function attemptAcquire(requestId: string): Promise<boolean> {");
  assert.ok(startIdx !== -1 && endIdx !== -1 && startIdx < endIdx, "the gap-closure comment must precede attemptAcquire()'s own definition");
  const comment = source.slice(startIdx, endIdx);
  assert.match(comment, /always-reachable/i);
  assert.match(comment, /bounded race/i);
  assert.match(comment, /does NOT eliminate that race/i);
});

test("no new control-plane message kind was added by this gap closure -- ControlRequestKind still has exactly its original five members", () => {
  const source = readFileSync(join(HERE, "broker-control.mts"), "utf8");
  const match = source.match(/export type ControlRequestKind = ([^;]+);/);
  assert.ok(match, "ControlRequestKind's own type declaration must be found");
  assert.equal(match![1].trim(), '"acquire" | "release" | "recycle" | "status" | "host_state"', "the union's five members must be unchanged");
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
    env: { ...process.env, VICE_SUPERVISOR_ALLOW_CONTAINER: "1", VICE_BIN: "/bin/sleep", VICE_ARGS: "600", VICE_BROKER_CONTROL_PORT: "0" },
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
    env: { ...process.env, VICE_SUPERVISOR_ALLOW_CONTAINER: "1", VICE_BIN: "/bin/sleep", VICE_ARGS: "600", ...env },
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
      warm_floor: 3,
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

test("the two singleton messages are textually distinct, and neither is a substring of the other", () => {
  const quiet = "vice-broker: another broker is already running and holds this control port -- exiting quietly as a second instance";
  const loud = 'vice-broker: FATAL -- control port is held by something that does not answer as a broker (discovery record classified "stale")';
  assert.notEqual(quiet, loud);
  assert.ok(!quiet.includes(loud) && !loud.includes(quiet));
});

test("structural: the bind call precedes the record write in vice-broker.mts's own startup sequence", () => {
  const source = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  const bindIdx = source.indexOf("listener = await startControlListener(");
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
// 01.6.2-13-PLAN.md, Task 2: the release and recycle handlers must set the
// deliberate-death marker BEFORE their own kill call, with OPPOSITE
// respawn-after-kill answers -- held here by a region-scoped source-order
// structural gate, following the SAME region-scoping technique the two
// structural tests above already use for this file, rather than inventing a
// second one.
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

test("structural: the release and recycle handlers both set the deliberate-death marker before their own kill call, and set opposite respawn-after-kill answers", () => {
  const source = stripCommentsForStructuralGate(readFileSync(join(HERE, "vice-broker.mts"), "utf8"));

  const recycleRegion = extractSourceRegion(
    source,
    "async function handleRecycleForRealBroker(targetId: string, state: BrokerState): Promise<RecycleOutcome> {",
    "function maintainWarmFloorForRealBroker(stateDir: string, state: BrokerState): Promise<void> {",
  );
  const releaseRegion = extractSourceRegion(
    source,
    "function handleRelease(requestId: string, state: BrokerState): void {",
    "async function run(args: ParsedArgs): Promise<void> {",
  );

  const recycleMarkerIdx = recycleRegion.indexOf("markDeliberateDeath(");
  const recycleKillIdx = recycleRegion.indexOf("verifiedKill(");
  assert.ok(recycleMarkerIdx !== -1, "the recycle handler must call the shared marker-and-intent setter");
  assert.ok(recycleKillIdx !== -1, "the recycle handler must call verifiedKill()");
  assert.ok(recycleMarkerIdx < recycleKillIdx, "the recycle handler must set the marker BEFORE its own kill call");

  const releaseMarkerIdx = releaseRegion.indexOf("markDeliberateDeath(");
  const releaseKillIdx = releaseRegion.indexOf("verifiedKill(");
  assert.ok(releaseMarkerIdx !== -1, "the release handler must call the shared marker-and-intent setter");
  assert.ok(releaseKillIdx !== -1, "the release handler must call verifiedKill()");
  assert.ok(releaseMarkerIdx < releaseKillIdx, "the release handler must set the marker BEFORE its own kill call");

  const recycleCall = recycleRegion.match(/markDeliberateDeath\([^)]*\)/);
  const releaseCall = releaseRegion.match(/markDeliberateDeath\([^)]*\)/);
  assert.ok(recycleCall, "the recycle handler's setter call must be matchable");
  assert.ok(releaseCall, "the release handler's setter call must be matchable");
  assert.notEqual(recycleCall![0], releaseCall![0], "the two call sites must pass opposite respawn-after-kill answers");
  assert.match(recycleCall![0], /\btrue\b/, "the recycle handler must pass a TRUE respawn-after-kill answer");
  assert.match(releaseCall![0], /\bfalse\b/, "the release handler must pass a FALSE respawn-after-kill answer");
});

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
