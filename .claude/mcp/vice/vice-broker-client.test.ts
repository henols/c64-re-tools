// node:test coverage of vice-broker-client.ts in ISOLATION -- no broker
// script and no proxy involved, matching vice-pool.test.mjs's own
// in-process, synthetic-temp-dir style (mkdtempSync fixtures, no subprocess
// needed for pure function coverage). Every exported function here reads
// its target directory from VICE_POOL_DIR (per the plan's own documented
// signatures, none of which take a `dir` parameter), so each test sets and
// restores that env var around its own temp directory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type Server, type Socket } from "node:net";

import {
  REQUEST_ID_PATTERN,
  newRequestId,
  isValidRequestId,
  brokerJsonPath,
  readBrokerLiveness,
  openBrokerControl,
  classifyConnectHost,
  resolveControlTarget,
  CONTROL_CONNECT_TIMEOUT_MS,
} from "./vice-broker-client.ts";
// The bridge alias itself (quick-260805-9ha) -- used only to assert
// resolveControlTarget()'s default answer against the SAME function it
// delegates to, never a second, hand-derived expectation of what that
// answer should be.
import { mcpHost } from "./vice.ts";
import { startControlListener, newControlToken, type AcquireOutcome, type RecycleOutcome, type StatusInstanceEntry, type HostStateFields } from "./broker-control.mts";
// Namespace import, read-only, for the export-list closure test below --
// the whole point is comparing the module's OWN live key set against an
// expected list, so this must be the real module object, not a destructured
// subset of it.
import * as viceBrokerClient from "./vice-broker-client.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// quick-260805-9ha: every listener THIS FILE starts (startFullBrokerListener()/
// startRawSocketServer() below) is bound on 127.0.0.1, inside this
// container. openBrokerControl()/acquireOverControlPlane() no longer dial
// broker.json's own `control_host` field (that is the broker's BIND
// address, never a dial target -- see vice-broker-client.ts's own "dial
// resolution" section header). Without this override, every one of this
// file's connect-driving tests would instead resolve the real bridge alias
// (mcpHost(), "host.docker.internal" by default) and either hang or fail
// against a host nothing here has ever bound -- which is also exactly the
// hard rule this project enforces: nothing under this module tree's tests
// may dial the real host. Setting it once, at module scope, is the seam
// that keeps this whole suite in-container.
process.env.VICE_BROKER_CONTROL_DIAL_HOST = "127.0.0.1";

const tmpPoolDir = (): string => mkdtempSync(join(tmpdir(), "vice-broker-client-test-"));

/** Runs `fn` with VICE_POOL_DIR pointed at a fresh temp directory, restoring
 * the prior value (or deleting the var entirely) afterwards regardless of
 * how `fn` exits -- every exported function under test reads this env var
 * at call time, so this is the isolation seam for in-process testing. */
async function withPoolDir(fn: (dir: string) => Promise<void> | void): Promise<void> {
  const dir = tmpPoolDir();
  const prev = process.env.VICE_POOL_DIR;
  process.env.VICE_POOL_DIR = dir;
  try {
    await fn(dir);
  } finally {
    if (prev === undefined) delete process.env.VICE_POOL_DIR;
    else process.env.VICE_POOL_DIR = prev;
    rmSync(dir, { recursive: true, force: true });
  }
}

const sleepMs = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Temporarily sets or deletes `process.env[key]` for the duration of `fn`,
 * restoring the prior value (or absence) afterwards regardless of how `fn`
 * exits -- the same finally-restore discipline withPoolDir() above uses,
 * scoped to a single env var. `value: undefined` deletes the key entirely
 * (needed by the tests below that must prove resolveControlTarget()'s
 * DEFAULT behaviour with the module-scope override above deliberately
 * absent). */
async function withEnv(key: string, value: string | undefined, fn: () => Promise<void> | void): Promise<void> {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

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

// writeRequest()/createLease()/touchLease()/releaseLease()/pollGrant() and
// their ten tests above (plan 06's disposition table rows 2-11) are DELETED
// in this plan (01.6.2-07, criterion F/D-12), in the SAME commit as their
// own subjects' deletion from vice-broker-client.ts: the file-messaging
// protocol they exercised retires wholesale, replaced by the TCP control
// plane below. Six of those ten rows (releaseLease() x2, pollGrant() x4)
// already have a named RE-OBSERVED replacement test in this file (added by
// plan 06, listed in that plan's own disposition table) -- nothing here is
// a silent drop.

// -------------------------------------------------------------- readBrokerLiveness

test("readBrokerLiveness(): classifies an absent broker.json as never_started", async () => {
  await withPoolDir(async (dir) => {
    const result = readBrokerLiveness(brokerJsonPath(dir));
    assert.equal(result.state, "never_started");
    assert.equal(result.pid, null);
  });
});

test("readBrokerLiveness(): classifies a fresh heartbeat as alive", async () => {
  await withPoolDir(async (dir) => {
    const path = brokerJsonPath(dir);
    writeFileSync(path, JSON.stringify({ version: 1, pid: 4242, heartbeat_at: new Date().toISOString() }));
    const result = readBrokerLiveness(path);
    assert.equal(result.state, "alive");
    assert.equal(result.pid, 4242);
  });
});

test("readBrokerLiveness(): classifies a stale heartbeat as stale", async () => {
  await withPoolDir(async (dir) => {
    const path = brokerJsonPath(dir);
    const longAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
    writeFileSync(path, JSON.stringify({ version: 1, pid: 4242, heartbeat_at: longAgo }));
    const result = readBrokerLiveness(path);
    assert.equal(result.state, "stale");
  });
});

// =============================================================================
// quick-260805-9ha: dial resolution -- classifyConnectHost()/
// resolveControlTarget(). `broker.json`'s own `control_host` field is the
// broker's BIND address (vice-broker.mts:782 writes `listener.host` into
// it, which is deliberately `0.0.0.0`); dialing it from inside THIS
// container reaches this container's own network stack, where nothing
// listens. These two functions are the fix -- see vice-broker-client.ts's
// own "dial resolution" section header for the full rationale.
// =============================================================================

test("resolveControlTarget(): a record carrying 0.0.0.0 never yields it as the dial target -- with no override set, resolves to the bridge alias", async () => {
  await withEnv("VICE_BROKER_CONTROL_DIAL_HOST", undefined, () => {
    const result = resolveControlTarget({ control_host: "0.0.0.0" }, 6600);
    assert.equal(result.ok, true, `must resolve ok against an alive-classified port: ${JSON.stringify(result)}`);
    if (!result.ok) return;
    assert.notEqual(result.target.host, "0.0.0.0");
    assert.equal(result.target.host, mcpHost(), "the resolved host must be exactly what mcpHost() answers");
    assert.equal(result.target.source, "bridge_alias");
    assert.equal(result.target.recorded, "0.0.0.0", "the record's own control_host is carried through for diagnostics only");
  });
});

test("resolveControlTarget(): neither 127.0.0.1 nor localhost in the record ever surfaces as the dial target, with no override set", async () => {
  await withEnv("VICE_BROKER_CONTROL_DIAL_HOST", undefined, () => {
    for (const recordedHost of ["127.0.0.1", "localhost"]) {
      const result = resolveControlTarget({ control_host: recordedHost }, 6600);
      assert.equal(result.ok, true, `must resolve ok for recorded host ${recordedHost}: ${JSON.stringify(result)}`);
      if (!result.ok) return;
      assert.notEqual(result.target.host, recordedHost, `the recorded value ${recordedHost} must never become the dial target`);
      assert.equal(result.target.host, mcpHost());
      assert.equal(result.target.recorded, recordedHost);
    }
  });
});

test("classifyConnectHost(): classifies a corpus of wildcard-bind, loopback and routable hosts structurally", () => {
  const wildcardBind = ["0.0.0.0", "::", "[::]"];
  const loopback = ["127.0.0.1", "127.1.2.3", "localhost", "[::1]"];
  const routable = ["host.docker.internal", "172.17.0.1", "203.0.113.1"];
  for (const host of wildcardBind) {
    assert.equal(classifyConnectHost(host), "wildcard_bind", `expected wildcard_bind for ${host}`);
  }
  for (const host of loopback) {
    assert.equal(classifyConnectHost(host), "loopback", `expected loopback for ${host}`);
  }
  for (const host of routable) {
    assert.equal(classifyConnectHost(host), "routable", `expected routable for ${host}`);
  }
});

test("resolveControlTarget(): the env override is honoured verbatim, regardless of what the record says", async () => {
  await withEnv("VICE_BROKER_CONTROL_DIAL_HOST", "127.0.0.1", () => {
    const result = resolveControlTarget({ control_host: "0.0.0.0" }, 6600);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.target.host, "127.0.0.1");
    assert.equal(result.target.source, "dial_override");
    assert.equal(result.target.recorded, "0.0.0.0");
  });
});

test("openBrokerControl(): a wildcard-bind dial target is refused before any connect is attempted, naming the address and port", async () => {
  await withPoolDir(async (dir) => {
    await withEnv("VICE_BROKER_CONTROL_DIAL_HOST", "0.0.0.0", async () => {
      writeBrokerJson(dir, {
        version: 1,
        pid: process.pid,
        heartbeat_at: new Date().toISOString(),
        control_host: "0.0.0.0",
        control_port: 6600,
        control_token: "unused",
      });
      const startedAt = Date.now();
      const result = await openBrokerControl(dir);
      const elapsed = Date.now() - startedAt;
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.kind, "unreachable_control_plane");
      assert.match(result.message, /0\.0\.0\.0:6600/, `message must name the address and port: ${result.message}`);
      assert.equal(result.target, "0.0.0.0:6600");
      assert.ok(
        elapsed < CONTROL_CONNECT_TIMEOUT_MS,
        `must resolve well inside the connect timeout without ever attempting a connect, took ${elapsed}ms (bound ${CONTROL_CONNECT_TIMEOUT_MS}ms)`
      );
    });
  });
});

// =============================================================================
// Plan 06, Task 1: openBrokerControl() -- the session-based TCP control-plane
// client. RETIRING REGION NOTE: everything ABOVE this section tests the
// file-messaging protocol (writeRequest/createLease/touchLease/releaseLease/
// pollGrant/pollRecycleAck/startHeartbeat), which retires wholesale under
// D-12 when plan 07 swaps the proxy onto this session client and deletes the
// file half. readBrokerLiveness() (tested just above) is the one function
// from that region that SURVIVES unchanged. See this plan's own SUMMARY for
// the full per-test disposition table (plan 06, task 2, criterion A's
// second half).
// =============================================================================

function writeBrokerJson(dir: string, fields: Record<string, unknown>): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(brokerJsonPath(dir), JSON.stringify(fields));
}

/** A bare TCP listener with NO protocol wired up -- just enough to accept a
 * connection and hand the test its own raw socket to drive. Used for the
 * scenarios broker-control.mts's own real protocol can't produce on demand
 * (a connection that never answers, a malformed line, chunked framing, a
 * server hanging up mid-request) -- structurally the same "bind first,
 * attach behaviour after" split bindControlListener()/attachControlProtocol()
 * already use on the host side. */
function startRawSocketServer(): Promise<{ server: Server; port: number; sockets: Socket[] }> {
  return new Promise((resolvePromise) => {
    const sockets: Socket[] = [];
    const server = createServer((socket) => {
      sockets.push(socket);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolvePromise({ server, port, sockets });
    });
  });
}

interface FullBrokerDeps {
  onAcquire?: (id: string) => Promise<AcquireOutcome>;
  onRelease?: (id: string) => void;
  onRecycle?: (targetId: string) => Promise<RecycleOutcome>;
  onStatus?: () => StatusInstanceEntry[];
  onHostState?: () => HostStateFields;
}

/** A REAL, fully-protocol'd control listener (broker-control.mts's own
 * startControlListener(), the exact module this client speaks to) bound on
 * a kernel-chosen port with injected stub callbacks -- the same shape
 * broker-control.test.ts's own startTestListener() uses for the SERVER
 * side's own tests. `rawLines` taps the SAME "connection" event (Node
 * EventEmitters support multiple listeners) purely to observe the bytes
 * actually sent, without altering the real protocol's own behaviour --
 * this is what lets a test assert on `.token` without stubbing the socket. */
async function startFullBrokerListener(deps: FullBrokerDeps = {}): Promise<{
  server: Server;
  port: number;
  token: string;
  rawLines: Record<string, unknown>[];
  dir: string;
}> {
  const token = newControlToken();
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    token,
    onAcquire: deps.onAcquire ?? (async () => ({ ok: false, reason: "internal" }) as AcquireOutcome),
    onRelease: deps.onRelease ?? (() => {}),
    onRecycle:
      deps.onRecycle ??
      (async () => ({ port: null, pid: null, viceBin: null, killStage: "no_signal", epochBefore: null, outcome: "grant_lookup_failed", reason: "no stub configured" })),
    onStatus: deps.onStatus ?? (() => []),
    onHostState:
      deps.onHostState ??
      (() => ({ pid: process.pid, startedAt: "2026-01-01T00:00:00Z", nodeVersion: process.version, viceBin: "x64sc", warmFloor: 3, maxInstances: 16, basePort: 6600 })),
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

  const dir = tmpPoolDir();
  writeBrokerJson(dir, {
    version: 1,
    pid: process.pid,
    heartbeat_at: new Date().toISOString(),
    control_host: "127.0.0.1",
    control_port: listener.port,
    control_token: token,
  });

  return { server: listener.server, port: listener.port, token, rawLines, dir };
}

// ------------------------------------------------- openBrokerControl(): happy path

test("openBrokerControl(): opens a session and drives all five request kinds, every one carrying the discovery record's token", async () => {
  let recycleCalledWith: string | null = null;
  const { server, dir, rawLines } = await startFullBrokerListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/epoch.json", supervisorDir: "/tmp/6600" } }),
    onRecycle: async (targetId) => {
      recycleCalledWith = targetId;
      return { port: 6600, pid: 4242, viceBin: "x64sc", killStage: "sigterm", epochBefore: 3, outcome: "ok", reason: "" };
    },
  });
  try {
    const opened = await openBrokerControl(dir);
    assert.equal(opened.ok, true, `openBrokerControl must succeed against a real listener: ${JSON.stringify(opened)}`);
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

    const recycled = await session.recycle(acquired.grant.id);
    assert.equal(recycled.ok, true, `recycle must succeed: ${JSON.stringify(recycled)}`);
    if (!recycled.ok) return;
    assert.equal(recycled.ack.outcome, "ok");
    assert.equal(recycled.ack.kill_stage, "sigterm");
    assert.equal(recycleCalledWith, acquired.grant.id);

    const released = await session.release();
    assert.equal(released.ok, true);

    assert.ok(rawLines.length >= 4, `expected at least 4 request lines observed, saw ${rawLines.length}`);
    // Every observed request line carries a `token` field equal to the
    // discovery record's own control_token -- asserted against the SAME
    // token startFullBrokerListener() minted and wrote into broker.json.
    const brokerRecord = JSON.parse(readFileSync(brokerJsonPath(dir), "utf8"));
    for (const line of rawLines) {
      assert.equal(line.token, brokerRecord.control_token, `every request line must carry the discovery record's token: ${JSON.stringify(line)}`);
    }
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------- openBrokerControl(): key sets

// containerizeGrant() (vice-proxy.ts lines 1963-2054, read directly from
// source at the time this test was written) reads exactly these fields off
// a raw grant record before translating url/epoch_file/supervisor_dir.
const CONTAINERIZE_GRANT_FIELDS = ["id", "port", "url", "epoch_file", "supervisor_dir"];

test("acquire result: the grant object has exactly the key set containerizeGrant() reads", async () => {
  const { server, dir } = await startFullBrokerListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6601, url: "http://127.0.0.1:6601/mcp", epochFile: "/tmp/epoch.json", supervisorDir: "/tmp/6601" } }),
  });
  try {
    const opened = await openBrokerControl(dir);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const acquired = await opened.session.acquire();
    assert.equal(acquired.ok, true);
    if (!acquired.ok) return;
    assert.deepEqual(Object.keys(acquired.grant).sort(), [...CONTAINERIZE_GRANT_FIELDS].sort());
    await opened.session.release();
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// vice-proxy.ts's recycleAckOutcomeMessage() (lines 584-611) plus its caller
// (lines 707-713, `ack.kill_stage`/`ack.outcome`) -- the ONLY fields the
// proxy ever reads off a recycle ack, read directly from source at the time
// this test was written. This is deliberately narrower than the wire's full
// nine-field recycle_ack response (broker-control.mts's own RecycleOutcome);
// `port`/`x64sc_pid`/`vice_bin`/`epoch_before`/`id`/`target_id` have no
// reader on the proxy side and are dropped here, matching plan 05's own
// "documented SUBSET, never a bijection" precedent for this same ack.
const OUTCOME_RENDERER_FIELDS = ["outcome", "kill_stage", "reason"];

test("recycle result: the ack object has exactly the key set the proxy's outcome renderer reads", async () => {
  const { server, dir } = await startFullBrokerListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6602, url: "http://127.0.0.1:6602/mcp", epochFile: "/tmp/e.json", supervisorDir: "/tmp/6602" } }),
    onRecycle: async () => ({ port: 6602, pid: 1, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" }),
  });
  try {
    const opened = await openBrokerControl(dir);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const acquired = await opened.session.acquire();
    assert.equal(acquired.ok, true);
    if (!acquired.ok) return;
    const recycled = await opened.session.recycle(acquired.grant.id);
    assert.equal(recycled.ok, true);
    if (!recycled.ok) return;
    assert.deepEqual(Object.keys(recycled.ack).sort(), [...OUTCOME_RENDERER_FIELDS].sort());
    await opened.session.release();
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
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
  const { server, dir } = await startFullBrokerListener({
    onAcquire: async () => ({ ok: false, reason: "at_capacity" }) as AcquireOutcome,
  });
  try {
    const opened = await openBrokerControl(dir);
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
    rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------- openBrokerControl(): liveness precheck

test("openBrokerControl(): a never-started record (missing heartbeat_at) returns a typed failure fast, without attempting a connection", async () => {
  await withPoolDir(async (dir) => {
    // control_host/control_port point at a TEST-NET-1 address (RFC 5737,
    // guaranteed unallocated/unroutable) -- if the implementation attempted
    // a connection despite the never_started classification, the promise
    // would hang for the OS's own SYN-retransmit timeout (tens of seconds at
    // minimum) rather than resolve promptly. Resolving well under that gives
    // real evidence "the instrumented connect function is never called",
    // not just an assertion on the returned `kind`.
    writeBrokerJson(dir, { version: 1, pid: 4242, control_host: "203.0.113.1", control_port: 1, control_token: "unused" });
    const startedAt = Date.now();
    const result = await openBrokerControl(dir);
    const elapsed = Date.now() - startedAt;
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.kind, "never_started");
    assert.ok(elapsed < 500, `must resolve without attempting a connection, took ${elapsed}ms`);
  });
});

test("openBrokerControl(): a stale record returns a typed failure fast, without attempting a connection", async () => {
  await withPoolDir(async (dir) => {
    const longAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    writeBrokerJson(dir, { version: 1, pid: 4242, heartbeat_at: longAgo, control_host: "203.0.113.1", control_port: 1, control_token: "unused" });
    const startedAt = Date.now();
    const result = await openBrokerControl(dir);
    const elapsed = Date.now() - startedAt;
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.kind, "stale");
    assert.ok(elapsed < 500, `must resolve without attempting a connection, took ${elapsed}ms`);
  });
});

test("openBrokerControl(): reads broker.json exactly once -- deleting it after the session opens does not affect five subsequent requests", async () => {
  const { server, dir } = await startFullBrokerListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6603, url: "http://127.0.0.1:6603/mcp", epochFile: "/tmp/e.json", supervisorDir: "/tmp/6603" } }),
    onRecycle: async () => ({ port: 6603, pid: 1, viceBin: "x64sc", killStage: "sigterm", epochBefore: 1, outcome: "ok", reason: "" }),
  });
  try {
    const opened = await openBrokerControl(dir);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;

    // The ONE read already happened inside openBrokerControl() above --
    // deleting the record now proves nothing downstream re-reads it: if a
    // future regression added a per-request re-read, every call below would
    // start failing the moment the file disappears.
    rmSync(brokerJsonPath(dir));

    const acquired = await opened.session.acquire();
    assert.equal(acquired.ok, true, `acquire after deletion must still succeed: ${JSON.stringify(acquired)}`);
    if (!acquired.ok) return;
    const statusResult = await opened.session.status();
    assert.equal(statusResult.ok, true, `status after deletion must still succeed: ${JSON.stringify(statusResult)}`);
    const hostStateResult = await opened.session.hostState();
    assert.equal(hostStateResult.ok, true, `hostState after deletion must still succeed: ${JSON.stringify(hostStateResult)}`);
    const recycled = await opened.session.recycle(acquired.grant.id);
    assert.equal(recycled.ok, true, `recycle after deletion must still succeed: ${JSON.stringify(recycled)}`);
    const released = await opened.session.release();
    assert.equal(released.ok, true, `release after deletion must still succeed`);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------- openBrokerControl(): connection failures

test("openBrokerControl(): a refused connection returns a typed connect_refused failure naming the refusal", async () => {
  await withPoolDir(async (dir) => {
    // Bind a listener, read back its kernel-chosen port, then close it
    // immediately -- the port is now refusing connections on loopback,
    // deterministically (no reliance on a hardcoded port being free).
    const probe = await startRawSocketServer();
    const deadPort = probe.port;
    await new Promise<void>((r) => probe.server.close(() => r()));

    writeBrokerJson(dir, {
      version: 1,
      pid: process.pid,
      heartbeat_at: new Date().toISOString(),
      control_host: "127.0.0.1",
      control_port: deadPort,
      control_token: "unused",
    });
    const result = await openBrokerControl(dir);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.kind, "connect_refused");
    assert.match(result.message, /connect_refused|connection failed|ECONNREFUSED/i);
  });
});

// ------------------------------------------------- session: deadlines, framing, broker-gone, malformed lines

test("acquire: resolves a typed deadline failure within its own bound and does not hang, using a short bound injected for the test", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  const dir = tmpPoolDir();
  writeBrokerJson(dir, {
    version: 1,
    pid: process.pid,
    heartbeat_at: new Date().toISOString(),
    control_host: "127.0.0.1",
    control_port: port,
    control_token: "tok-deadline",
  });
  try {
    const opened = await openBrokerControl(dir);
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
    rmSync(dir, { recursive: true, force: true });
  }
});

test("session: the broker closing the connection mid-request settles it with a distinct broker_gone outcome, never a request-level error", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  const dir = tmpPoolDir();
  writeBrokerJson(dir, {
    version: 1,
    pid: process.pid,
    heartbeat_at: new Date().toISOString(),
    control_host: "127.0.0.1",
    control_port: port,
    control_token: "tok-gone",
  });
  try {
    const opened = await openBrokerControl(dir);
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
    rmSync(dir, { recursive: true, force: true });
  }
});

test("session: two responses arriving in one chunk are both delivered", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  const dir = tmpPoolDir();
  writeBrokerJson(dir, {
    version: 1,
    pid: process.pid,
    heartbeat_at: new Date().toISOString(),
    control_host: "127.0.0.1",
    control_port: port,
    control_token: "tok-chunk",
  });
  try {
    const opened = await openBrokerControl(dir);
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
    const grantLine = JSON.stringify({ kind: "grant", id: "req-x", port: 6604, url: "http://127.0.0.1:6604/mcp", epoch_file: "/tmp/e.json", supervisor_dir: "/tmp/6604" });
    const statusLine = JSON.stringify({ kind: "status", instances: [] });
    serverSocket.write(`${grantLine}\n${statusLine}\n`); // BOTH responses in ONE chunk

    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.equal(firstResult.ok, true, `first (acquire) must be delivered: ${JSON.stringify(firstResult)}`);
    assert.equal(secondResult.ok, true, `second (status) must be delivered: ${JSON.stringify(secondResult)}`);
    await opened.session.release();
  } finally {
    for (const s of sockets) s.destroy();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("session: one response split across two chunks is delivered exactly once", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  const dir = tmpPoolDir();
  writeBrokerJson(dir, {
    version: 1,
    pid: process.pid,
    heartbeat_at: new Date().toISOString(),
    control_host: "127.0.0.1",
    control_port: port,
    control_token: "tok-split",
  });
  try {
    const opened = await openBrokerControl(dir);
    assert.equal(opened.ok, true);
    if (!opened.ok) return;

    const deadline = Date.now() + 3000;
    while (sockets.length === 0 && Date.now() < deadline) await sleepMs(10);
    assert.ok(sockets.length > 0, "raw server must observe the incoming connection");
    const serverSocket = sockets[0];

    const acquirePromise = opened.session.acquire({ timeoutMs: 3000 });
    await sleepMs(50);
    const line = `${JSON.stringify({ kind: "grant", id: "req-y", port: 6605, url: "http://127.0.0.1:6605/mcp", epoch_file: "/tmp/e.json", supervisor_dir: "/tmp/6605" })}\n`;
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
    rmSync(dir, { recursive: true, force: true });
  }
});

test("session: a malformed response line settles the pending request as a protocol failure, and no unhandled rejection occurs", async () => {
  const { server, port, sockets } = await startRawSocketServer();
  const dir = tmpPoolDir();
  writeBrokerJson(dir, {
    version: 1,
    pid: process.pid,
    heartbeat_at: new Date().toISOString(),
    control_host: "127.0.0.1",
    control_port: port,
    control_token: "tok-malformed",
  });
  let unhandledRejectionFired = false;
  const onUnhandled = () => {
    unhandledRejectionFired = true;
  };
  process.on("unhandledRejection", onUnhandled);
  try {
    const opened = await openBrokerControl(dir);
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
    rmSync(dir, { recursive: true, force: true });
  }
});

test("session: a second release() resolves without throwing", async () => {
  const { server, dir } = await startFullBrokerListener({
    onAcquire: async () => ({ ok: true, grant: { port: 6606, url: "http://127.0.0.1:6606/mcp", epochFile: "/tmp/e.json", supervisorDir: "/tmp/6606" } }),
  });
  try {
    const opened = await openBrokerControl(dir);
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
    rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------- structural: no filesystem write in the new region

test("structural: the new control-client region (between the plan-06 marker pair) contains no filesystem-write construct", () => {
  const source = readFileSync(join(HERE, "vice-broker-client.ts"), "utf8");
  const startMarker = "BROKER-CONTROL-CLIENT REGION START (plan 06, task 1)";
  const endMarker = "BROKER-CONTROL-CLIENT REGION END (plan 06, task 1)";
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
// Plan 01.6.2-07, task 3: the client module's export list is exactly the
// surviving surface named in this plan's own action text -- the request-id
// pattern, its validator, the id generator, the state-directory resolver,
// the discovery-record path helper, the liveness classifier and its
// staleness threshold, plus the control session surface plan 06 added.
// Comparing the module's own live `Object.keys()` (a namespace import, not
// a destructured subset) against this expected list means a retiring export
// left behind by accident, OR a surviving export silently dropped, both
// fail this test -- not just the retiring set task 3 is scoped to remove.

test("the client module's export list is exactly the surviving surface", () => {
  const actualKeys = Object.keys(viceBrokerClient).sort();
  const expectedKeys = [
    "REQUEST_ID_PATTERN",
    "newRequestId",
    "isValidRequestId",
    "brokerRootDir",
    "brokerJsonPath",
    "BROKER_STALE_MS",
    "readBrokerLiveness",
    "CONTROL_ACQUIRE_TIMEOUT_MS",
    "acquireOverControlPlane",
    "ACQUIRE_TIMEOUT_MS",
    "RECYCLE_TIMEOUT_MS",
    "CONTROL_CONNECT_TIMEOUT_MS",
    "openBrokerControl",
    // quick-260805-9ha: the dial-resolution layer's own two runtime exports.
    "classifyConnectHost",
    "resolveControlTarget",
  ].sort();
  assert.deepEqual(
    actualKeys,
    expectedKeys,
    `the module's live export set drifted from the surviving surface this plan defines: actual=${JSON.stringify(actualKeys)} expected=${JSON.stringify(expectedKeys)}`
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
