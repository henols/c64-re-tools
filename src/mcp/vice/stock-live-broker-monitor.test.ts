#!/usr/bin/env node
// stock-live-broker-monitor.test.ts
//
// OPT-IN, MANUAL-ONLY. Live-proves the ONE Phase 07 residual that three
// documents (07-VERIFICATION.md's human_verification item, 07-UAT.md test 9's
// scope note, 07-VALIDATION.md's last open Manual-Only row) name identically
// and that has never run end to end: vice_diagnose's BROKER-MEDIATED
// monitor_held_elsewhere verdict -- a real second claimMonitor() refusal
// produced by a genuine host broker control plane against a genuine stock
// x64sc, not the unit-injected MonitorOwnershipError (stock-diagnose.test.ts)
// and NOT stock-live.test.ts's Task 3 socket-level contention case (which
// correctly answers the honest non-verdict
// `diagnosis_unavailable (monitor_acquisition_timeout)` and is not duplicated
// here -- that is a bounded WAIT for a busy monitor, not a broker-refused
// second claim).
//
// WHY A NAIVE "TWO PLAIN ACQUIRES" HARNESS CANNOT WORK (read before touching
// this file -- quick task 260818-obc's own plan front-loads this analysis so
// it is not re-derived, wrongly, by a future "simplification"):
//
//   1. broker-control.mts's ownsTarget() (the CR-03 predicate gating the
//      monitor_claim branch) refuses any target_id that is not the grant THIS
//      connection itself holds. So session B can never even ATTEMPT to name
//      session A's grant id -- a monitor_owned refusal requires TWO LIVE
//      GRANTS THAT RESOLVE TO THE SAME PORT, not a cross-session name
//      collision.
//   2. Two plain acquire() calls can never produce that: handleAcquire()
//      only ever grants a "ready" warm instance or a freshly cold-launched
//      one, and a release tears the grant, the monitor client AND the
//      instance down together. Two ordinary acquires always land on two
//      DIFFERENT ports.
//   3. The ONE reachable route is a CRASH RESPAWN. handleExit()
//      (broker-launch.mts) on a NON-deliberate exit clears
//      record.monitorClient and relaunches a BRAND NEW InstanceRecord on the
//      SAME port via launchSupervised() -- but (unlike the deliberate-kill
//      recycle branch) it does NOT re-mark the respawn "granted" and does NOT
//      sync the original grant's pid. The original grant (session A's) stays
//      recorded in state.grants at that port, now pointing at an instance
//      that is merely "ready" and unclaimed. maintainWarmFloor()'s periodic
//      pass promotes that respawn "launching" -> "ready" (this runs
//      regardless of the configured warm floor -- promotion of an EXISTING
//      launching record is unconditional; only launching a NEW spare toward
//      the floor is warm-floor-gated), after which a SECOND connection's
//      acquire() is served from that SAME ready instance via
//      selectWarmInstance() -- producing grant B on the SAME port P. This is
//      not a contrived state: it is "the emulator crashed, another session
//      picked up the respawn, and the original session asks what happened" --
//      exactly what vice-wedge-triage exists for.
//   4. Consequence: the emulator pid must be killed EXTERNALLY (a raw
//      SIGKILL read from the grant's own epoch.json), never through the
//      broker's own `recycle` op -- the deliberate-kill branch keeps the
//      respawn "granted" and it never becomes warm-selectable, closing off
//      the only reachable route.
//
// A SECOND, EQUALLY LOAD-BEARING MECHANISM THIS FILE'S OWN HARNESS DEPENDS ON
// -- NOT STATED IN THE PLAN'S OWN REACHABILITY ANALYSIS, DISCOVERED WHILE
// WRITING THIS HARNESS, AND JUST AS EASY TO "SIMPLIFY" AWAY BY ACCIDENT:
//
//   stock-dispatch.ts's ensureStockSession() holds exactly ONE live session
//   in module-scope state (`heldSession`), for the whole process, regardless
//   of which `deps` object a caller passes to dispatchStock(). Whenever a
//   dispatch call's own lease names a DIFFERENT targetId than the currently
//   held session, ensureStockSession() TEARS DOWN the old one FIRST --
//   stockDisconnect(), which calls releaseMonitor() on the broker -- before
//   ever attempting the new targetId's claim. That means naively calling
//   dispatchStock(deps2) right after dispatchStock(deps1) succeeded would
//   RELEASE grant A's claim before grant B ever tried to claim anything --
//   there would be nothing left to refuse. The fix this harness uses (and
//   that a future reader must not "clean up" away) is clearHeldStockSession()
//   (already exported by stock-dispatch.ts for exactly this kind of
//   test-side session-boundary control -- see stock-live-triage.test.ts's own
//   use of it): calling it DETACHES the module's pointer to the currently
//   held session WITHOUT touching the broker at all, so the NEXT
//   dispatchStock() call for a different targetId takes the "no held
//   session" branch (skips stockDisconnect() entirely) and attempts a truly
//   FRESH claim against whatever the broker's own state says -- which, if
//   another grant already holds it, is refused for real. This file calls
//   clearHeldStockSession() between the second session's successful claim and
//   the first session's re-attempt for exactly this reason (see the inline
//   comment at that call site below).
//
// STOCK-DISPATCH.TS'S STATUS() CLIENT DROPS hasMonitorClient: the typed
// BrokerControlSession.status() (vice-broker-client.ts) narrows the wire's
// StatusInstanceEntry down to {port,url,state,reason,epoch} -- it does NOT
// expose hasMonitorClient, even though handleStatus() (vice-broker.mts) puts
// it on the wire. This file adds one small, test-local raw status helper
// (rawControlRequest()/rawStatus() below) to read that field directly off the
// wire, the same sanctioned pattern broker-e2e.test.ts's own rawAcquire()/
// makeRawSession() already use for fields the typed client does not carry --
// never a change to vice-broker-client.ts itself for a test's convenience.
//
// Registered as MANUAL_ONLY_TESTS' SIXTH entry in test-gate.mjs: spawns a
// real broker daemon AND a real emulator, default-SKIPs everywhere (never
// hangs CI), and is opted into exactly like this file's siblings.
//
// Opt in with:
//   VICE_LIVE_BROKER_BIN=/usr/bin/x64sc node --test stock-live-broker-monitor.test.ts
//   VICE_LIVE_BROKER_BIN=/usr/local/bin/x64sc node --test stock-live-broker-monitor.test.ts
//
// WHAT NOT TO DO:
//   - Never acquire a child process, socket or temp dir outside
//     withBrokerHarness()'s own try/finally -- teardown must run even when an
//     assertion throws.
//   - Never use the broker's own `recycle` op to kill the emulator -- see
//     point 4 above; it keeps the respawn "granted" and closes off the only
//     reachable route to this verdict.
//   - Never re-derive a stubbed BrokerControlSession here (the
//     CONFORMANCE_BROKER_CONTROL stub stock-live-triage.test.ts uses) --
//     using a real one, end to end, through a real spawned broker artifact,
//     is precisely the gap this file exists to close.
//   - Never widen the evidence assertion below to an exact key set -- that is
//     stock-diagnose.test.ts's job (the automated shape oracle this same
//     task adds), per test-gate.mjs's standing rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "node:net";

import { build } from "./build.ts";
import { openBrokerControl, type BrokerControlSession, type HeldLease, type AcquireGrant } from "./vice-broker-client.ts";
import { dispatchStock, clearHeldStockSession, type StockDispatchDeps } from "./stock-dispatch.ts";
import { stockConnect, stockReconnect, type StockConnectSession, type StockConnectOptions, type StockReconnectOptions } from "./stock-connect.ts";
import { diagnoseSessionTimeoutMs } from "./stock-diagnose.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");

// ---------------------------------------------------------------------------
// Opt-in gate -- mirrors stock-live-triage.test.ts's own gate exactly, with
// this file's own env var name.
// ---------------------------------------------------------------------------

const VICE_LIVE_BROKER_BIN_ENV = process.env.VICE_LIVE_BROKER_BIN;

/** Computed exactly once. Every test in this file passes this through
 * node:test's own `{ skip }` option -- never a hand-rolled early return, which
 * would report a false PASS rather than a SKIP. */
const SKIP_REASON: string | false = !VICE_LIVE_BROKER_BIN_ENV
  ? "stock-live-broker-monitor.test.ts is opt-in and default-skipped -- set VICE_LIVE_BROKER_BIN=/usr/bin/x64sc " +
    "(or another real, genuinely unpatched stock VICE binary's absolute path) to run it. A bare \"x64sc\" on PATH " +
    "resolves to the fork build (which has -mcpserver, not this stock binary-monitor path) -- always name the " +
    "stock binary by absolute path."
  : !existsSync(VICE_LIVE_BROKER_BIN_ENV)
    ? `VICE_LIVE_BROKER_BIN="${VICE_LIVE_BROKER_BIN_ENV}" does not exist on disk -- opt-in requires a real stock ` +
      "VICE binary at that absolute path (e.g. /usr/bin/x64sc). A bare \"x64sc\" on PATH would resolve to the fork " +
      "build instead of genuine stock."
    : false;

// quick-260818-obc: this file's own dial knob, set once at module scope so
// every openBrokerControl() call below resolves to the loopback control
// listener this test's OWN spawned broker binds, never the bridge alias
// resolveControlTarget() would otherwise fall back to. Matches broker-e2e.
// test.ts:47's precedent exactly. Deliberately NOT passed into the spawned
// broker's own env (see startBroker() below) -- that process's BIND address
// is governed by the separate VICE_BROKER_CONTROL_HOST/VICE_BROKER_CONTROL_PORT
// knobs, and broker.json's own control_host field is a bind address, never a
// dial target (see vice-broker-client.ts's own header comment).
process.env.VICE_BROKER_CONTROL_DIAL_HOST = "127.0.0.1";

// ---------------------------------------------------------------------------
// Small shared helpers.
// ---------------------------------------------------------------------------

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(predicate: () => boolean, deadlineMs: number, pollMs = 100): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return predicate();
}

async function waitForAsync(predicate: () => Promise<boolean>, deadlineMs: number, pollMs = 250): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

/** One-shot "is anything listening yet" probe -- a bare TCP connect with no
 * command sent, immediately closed. Used ONLY to bound-wait for a
 * cold-launched x64sc to finish booting and bind its binmon port before this
 * file's own FIRST claim attempt: handleAcquire()'s cold-launch arm marks a
 * fresh record "granted" the instant the process is SPAWNED (never waiting
 * for the readiness probe the warm arm already ran) -- discovered live while
 * writing this harness (a plain retry against status()'s own "state" field
 * can never observe "ready" for a cold-granted record; it goes straight
 * "launching" -> "granted"). Distinct from defaultBinmonProbe()
 * (broker-launch.mts) -- that one also sends a PING/EXIT pair to prove the
 * emulator ANSWERS, not merely that the port is bound; this file does not
 * need that distinction because the very next thing it does is run the real
 * stockConnect() handshake, which proves liveness itself. */
function waitForPortOpen(host: string, port: number, deadlineMs: number): Promise<boolean> {
  return waitForAsync(
    () =>
      new Promise<boolean>((resolvePromise) => {
        const socket = connect({ host, port });
        socket.once("connect", () => {
          socket.destroy();
          resolvePromise(true);
        });
        socket.once("error", () => {
          socket.destroy();
          resolvePromise(false);
        });
      }),
    deadlineMs,
    250,
  );
}

interface BrokerHandle {
  child: ChildProcessWithoutNullStreams;
  stateDir: string;
  stderr: string;
}

/** Spawns the EMITTED broker artifact (never the TypeScript source) under
 * bare node, wired for a genuine stock backend against a genuine stock
 * binary. Mirrors broker-e2e.test.ts's own startBroker() shape. */
function startBroker(stateDir: string, viceBinPath: string, scratchDir: string): BrokerHandle {
  const merged: Record<string, string | undefined> = {
    ...process.env,
    // Deliberately OMITTED (never set) -- this genuinely runs on the host,
    // per this quick task's own live-testing note, and the container guard
    // must pass on its own.
    VICE_SUPERVISOR_ALLOW_CONTAINER: undefined,
    VICE_BACKEND: "stock",
    VICE_BIN: viceBinPath,
    // MUST be unset, not merely omitted -- a non-empty VICE_ARGS is a FULL
    // argv override in buildViceArgs() (broker-launch.mts) and would drop
    // -binarymonitoraddress entirely. process.env may already carry a value
    // from this shell; explicit `undefined` here removes it from the
    // spawned child's env below.
    VICE_ARGS: undefined,
    VICE_BROKER_CONTROL_PORT: "0",
    VICE_BROKER_WARM_FLOOR: "0",
    VICE_BROKER_MAX: "1",
    VICE_BROKER_POLL_MS: "250",
    VICE_RESTART_BACKOFF_S: "1",
    // No persisted vicerc exists in this mkdtemp scratch dir, so the
    // 3.9-vs-3.10 "Configuration file version mismatch" modal cannot appear
    // (stock-live-triage.test.ts's own header comment states the same
    // reasoning) -- safe here even though this broker's own stock argv
    // (buildViceArgs()) carries no -default flag itself.
    XDG_CONFIG_HOME: scratchDir,
    // This file's own CLIENT-side dial override (module scope, above) must
    // never leak into the spawned broker's own env -- its bind address is
    // governed by VICE_BROKER_CONTROL_HOST/VICE_BROKER_CONTROL_PORT alone.
    VICE_BROKER_CONTROL_DIAL_HOST: undefined,
  };
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) env[key] = value;
  }
  const child = spawn(process.execPath, [BROKER_ARTIFACT, "--repo-root", scratchDir, "--state-dir", stateDir], { env }) as ChildProcessWithoutNullStreams;

  const handle: BrokerHandle = { child, stateDir, stderr: "" };
  child.stderr.on("data", (chunk: Buffer) => {
    handle.stderr += chunk.toString("utf8");
  });
  return handle;
}

async function stopBroker(handle: BrokerHandle): Promise<void> {
  if (handle.child.exitCode !== null || handle.child.signalCode !== null) return;
  handle.child.kill("SIGTERM");
  const exited = await waitFor(() => handle.child.exitCode !== null || handle.child.signalCode !== null, 3000);
  if (!exited) {
    handle.child.kill("SIGKILL");
  }
}

async function waitForBrokerJson(stateDir: string, deadlineMs = 10000): Promise<Record<string, unknown>> {
  const path = join(stateDir, "broker.json");
  const appeared = await waitFor(() => existsSync(path) && typeof JSON.parse(readFileSync(path, "utf8")).control_port === "number", deadlineMs);
  assert.ok(appeared, "broker.json with a control_port did not appear within deadline");
  return JSON.parse(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------------
// Raw status helper -- see this file's own header comment on why the typed
// BrokerControlSession.status() cannot answer hasMonitorClient. Test-local
// infrastructure only, mirroring broker-e2e.test.ts's own rawAcquire()/
// makeRawSession() pattern; never touches vice-broker-client.ts.
// ---------------------------------------------------------------------------

function rawControlRequest(host: string, port: number, body: Record<string, unknown>, timeoutMs = 10000): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    const socket = connect({ host, port });
    let buffer = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`rawControlRequest: no response within ${timeoutMs}ms for op ${String(body.op)}`));
    }, timeoutMs);
    socket.on("connect", () => socket.write(`${JSON.stringify(body)}\n`));
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const idx = buffer.indexOf("\n");
      if (idx !== -1 && socket.writable) {
        clearTimeout(timer);
        const line = JSON.parse(buffer.slice(0, idx)) as Record<string, unknown>;
        socket.destroy();
        resolvePromise(line);
      }
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

interface RawStatusInstance {
  port: number;
  state: string;
  hasMonitorClient: boolean;
  epoch: number | null;
}

async function rawStatus(host: string, port: number, token: string): Promise<RawStatusInstance[]> {
  const line = await rawControlRequest(host, port, { op: "status", token });
  const instances = Array.isArray(line.instances) ? (line.instances as Array<Record<string, unknown>>) : [];
  return instances.map((e) => ({
    port: Number(e.port),
    state: typeof e.state === "string" ? e.state : "",
    hasMonitorClient: e.hasMonitorClient === true,
    epoch: typeof e.epoch === "number" ? e.epoch : null,
  }));
}

function parseOkPayload(result: { content: { type: "text"; text: string }[]; isError: boolean }): Record<string, unknown> {
  assert.equal(result.isError, false, `expected an ok answer but got an error: ${result.content[0]?.text}`);
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

/** Builds a REAL, production-shaped StockDispatchDeps for one session --
 * `connect`/`reconnect` are thin pass-throughs to the real stockConnect()/
 * stockReconnect() that capture the session (same shape as stock-live-
 * triage.test.ts:316-337), and `brokerControl` is the REAL BrokerControlSession
 * this grant was acquired through -- never a stub. */
function depsFor(grant: AcquireGrant, controlSession: BrokerControlSession, stateDir: string): { deps: StockDispatchDeps; session: () => StockConnectSession | null } {
  let captured: StockConnectSession | null = null;
  const lease: HeldLease = {
    host: "127.0.0.1",
    port: grant.port,
    targetId: grant.id,
    brokerControl: controlSession,
    epochFile: grant.epoch_file,
    // CR-06's own rule: the TOP-LEVEL supervisor directory (the one
    // broker.json itself lives in), never the grant's own per-instance
    // supervisor_dir.
    supervisorDir: stateDir,
  };
  const deps: StockDispatchDeps = {
    ensureLease: async () => ({ ok: true as const, lease }),
    connect: async (opts: StockConnectOptions) => {
      const session = await stockConnect(opts);
      captured = session;
      return session;
    },
    reconnect: async (session: StockConnectSession, opts?: StockReconnectOptions) => {
      const next = await stockReconnect(session, opts);
      captured = next;
      return next;
    },
  };
  return { deps, session: () => captured };
}

// ---------------------------------------------------------------------------
// The harness -- everything acquired inside try, everything torn down in
// finally, per T-obc-05.
// ---------------------------------------------------------------------------

interface HarnessReport {
  recordedPids: number[];
  pidsAliveAfterTeardown: number[];
}

async function withBrokerHarness(viceBinPath: string, fn: (ctx: { stateDir: string; scratchDir: string; recordPid: (pid: number) => void; host: string; port: number; token: string }) => Promise<void>): Promise<HarnessReport> {
  build(); // ensure resources/ is a fresh build of the current TypeScript source
  const scratchDir = mkdtempSync(join(tmpdir(), "vice-broker-monitor-"));
  const stateDir = join(scratchDir, "state");
  const recordedPids = new Set<number>();
  const handle = startBroker(stateDir, viceBinPath, scratchDir);
  let pidsAliveAfterTeardown: number[] = [];
  try {
    const brokerJson = await waitForBrokerJson(stateDir);
    const host = "127.0.0.1";
    const port = Number(brokerJson.control_port);
    const token = String(brokerJson.control_token);
    await fn({ stateDir, scratchDir, recordPid: (pid: number) => recordedPids.add(pid), host, port, token });
  } finally {
    await stopBroker(handle);
    for (const pid of recordedPids) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // already gone -- best effort, matching the plan's own teardown
        // discipline (T-obc-02/T-obc-05).
      }
    }
    for (const pid of recordedPids) {
      const gone = await waitFor(() => !isAlive(pid), 3000);
      if (!gone) pidsAliveAfterTeardown.push(pid);
    }
    rmSync(scratchDir, { recursive: true, force: true });
    if (pidsAliveAfterTeardown.length > 0) {
      // Surfaced to the caller as a report, not swallowed -- the final test
      // below asserts on this so a leak fails AS A TEST, never merely as a
      // stray process (T-obc-05).
      console.error(`stock-live-broker-monitor: pids still alive after teardown: ${JSON.stringify(pidsAliveAfterTeardown)}`);
    }
  }
  return { recordedPids: [...recordedPids], pidsAliveAfterTeardown };
}

// ---------------------------------------------------------------------------
// The proof.
// ---------------------------------------------------------------------------

test(
  "stock-live-broker-monitor: a real crash respawn produces two live grants on the same port, and the broker refuses the second real claimMonitor() with monitor_held_elsewhere naming the real holder",
  { skip: SKIP_REASON, timeout: 60000 },
  async () => {
    const viceBinPath = VICE_LIVE_BROKER_BIN_ENV as string;
    clearHeldStockSession();

    // Deferred so a failure here does NOT mask the load-bearing step 6
    // assertion below (this task's own instruction: "do not let it mask
    // step 6").
    const deferredFailures: string[] = [];

    let report: HarnessReport | null = null;
    let primaryError: unknown = null;
    try {
      report = await withBrokerHarness(viceBinPath, async ({ stateDir, recordPid, host, port: controlPort, token }) => {
        const opened1 = await openBrokerControl(stateDir);
        assert.ok(opened1.ok, `openBrokerControl (session 1) failed: ${JSON.stringify(opened1)}`);
        const opened2 = await openBrokerControl(stateDir);
        assert.ok(opened2.ok, `openBrokerControl (session 2) failed: ${JSON.stringify(opened2)}`);
        if (!opened1.ok || !opened2.ok) return; // unreachable -- narrows for TS below
        const session1 = opened1.session;
        const session2 = opened2.session;

        // --- Step 1: session 1 acquires -> grant A on port P, and a REAL
        // claimMonitor() runs through the real dispatchStock()/stockConnect()
        // seam.
        const acquire1 = await session1.acquire();
        assert.ok(acquire1.ok, `session 1 acquire failed: ${JSON.stringify(acquire1)}`);
        if (!acquire1.ok) return;
        const grantA = acquire1.grant;
        const P = grantA.port;
        const { deps: deps1 } = depsFor(grantA, session1, stateDir);

        // A cold acquire's grant is handed back the instant the process is
        // SPAWNED (handleAcquire()'s cold-launch arm marks the record
        // "granted" without ever waiting for a readiness probe -- unlike the
        // warm arm, which selectWarmInstance() already probe-confirmed
        // before granting, and unlike status()'s own "state" field, which for
        // a cold-granted record goes straight "launching" -> "granted" and
        // never visits "ready" at all). Dialling the binmon port before
        // x64sc has finished booting genuinely races ECONNREFUSED, discovered
        // live while writing this harness -- bounded-wait for the port to
        // actually accept a connection here rather than either retrying
        // dispatchStock() (which would blur the load-bearing FIRST claim
        // with a retry loop) or loosening any assertion.
        const coldLaunchReady = await waitForPortOpen(host, P, 30000);
        assert.ok(coldLaunchReady, `the cold-launched instance's binmon port ${P} never accepted a connection within 30s`);

        const diag1 = await dispatchStock("vice_diagnose", {}, deps1);
        const diag1Payload = parseOkPayload(diag1 as { content: { type: "text"; text: string }[]; isError: boolean });
        console.log(`stock-live-broker-monitor: vice_diagnose (grant A's first claim) -> ${JSON.stringify(diag1Payload)}`);

        const statusAfterA = await rawStatus(host, controlPort, token);
        const entryAfterA = statusAfterA.find((i) => i.port === P);
        assert.ok(entryAfterA, `no status entry for port ${P} after grant A's claim, got: ${JSON.stringify(statusAfterA)}`);
        assert.equal(entryAfterA!.hasMonitorClient, true, `port ${P} must report hasMonitorClient:true after grant A's real claim, got: ${JSON.stringify(entryAfterA)}`);

        // --- Step 2: SIGKILL the emulator EXTERNALLY (never the broker's own
        // `recycle` op -- see this file's own header comment, point 4).
        const epochBefore = JSON.parse(readFileSync(grantA.epoch_file, "utf8")) as { pid: number; epoch: number };
        const originalPid = epochBefore.pid;
        assert.equal(typeof originalPid, "number");
        recordPid(originalPid);
        assert.ok(isAlive(originalPid), `original emulator pid ${originalPid} must be alive before the external kill`);
        process.kill(originalPid, "SIGKILL");
        const originalGone = await waitFor(() => !isAlive(originalPid), 10000);
        assert.ok(originalGone, `original emulator pid ${originalPid} must actually exit before a respawn can be observed`);

        // --- Step 3: poll status (bounded) until the crash respawn is
        // promoted "ready" with no monitor client -- i.e. the broker's own
        // crash supervision genuinely relaunched a fresh, unclaimed instance
        // on the SAME port.
        let statusAfterRespawn: RawStatusInstance[] = [];
        const respawnedReady = await waitForAsync(
          async () => {
            statusAfterRespawn = await rawStatus(host, controlPort, token);
            const entry = statusAfterRespawn.find((i) => i.port === P);
            return Boolean(entry && entry.state === "ready" && entry.hasMonitorClient === false);
          },
          30000,
          250,
        );
        assert.ok(
          respawnedReady,
          `the crash respawn at port ${P} did not reach state:"ready" with hasMonitorClient:false within 30s -- ` +
            `last status: ${JSON.stringify(statusAfterRespawn)}`,
        );
        // Record the respawned pid too, straight from the fresh epoch.json
        // the respawn's own launchSupervised() call wrote.
        const epochAfter = JSON.parse(readFileSync(grantA.epoch_file, "utf8")) as { pid: number; epoch: number };
        assert.ok(epochAfter.epoch > epochBefore.epoch, `epoch must have advanced across the respawn, got before=${epochBefore.epoch} after=${epochAfter.epoch}`);
        recordPid(epochAfter.pid);

        // --- Step 4 (bonus, TIME-04's second named residual): before
        // session 2 claims anything, ask session 1's own dispatchStock what
        // it makes of this -- the broker-SUPERVISED respawn (not one this
        // test performed itself), which is the one thing stock-live-
        // triage.test.ts's own "restarted" proof explicitly could NOT close
        // (its own header comment: "the respawn below is performed by THIS
        // TEST, not by the host broker's own supervision loop"). Recorded,
        // not required -- a failure here must not mask step 6.
        const diag4 = await dispatchStock("vice_diagnose", {}, deps1);
        const diag4Payload = parseOkPayload(diag4 as { content: { type: "text"; text: string }[]; isError: boolean });
        console.log(`stock-live-broker-monitor: vice_diagnose (post broker-supervised respawn, pre session-2 claim) -> ${JSON.stringify(diag4Payload)}`);
        if (diag4Payload.verdict === "restarted") {
          const evidence4 = diag4Payload.evidence as Record<string, unknown>;
          if (evidence4.baselineEpoch !== epochBefore.epoch) {
            deferredFailures.push(
              `step 4: verdict was "restarted" but baselineEpoch (${JSON.stringify(evidence4.baselineEpoch)}) did not match the pre-kill epoch (${epochBefore.epoch})`,
            );
          }
          if (evidence4.currentEpoch !== epochAfter.epoch) {
            deferredFailures.push(
              `step 4: verdict was "restarted" but currentEpoch (${JSON.stringify(evidence4.currentEpoch)}) did not match the post-respawn epoch (${epochAfter.epoch})`,
            );
          }
        } else {
          deferredFailures.push(
            `step 4: expected the broker-SUPERVISED respawn to answer verdict:"restarted" with baselineEpoch=${epochBefore.epoch}/currentEpoch=${epochAfter.epoch}, ` +
              `got verdict "${String(diag4Payload.verdict)}" instead -- full payload: ${JSON.stringify(diag4Payload)}. This is TIME-04's SECOND named residual ` +
              `(the broker-supervised, not test-performed, restarted path); recorded here rather than asserted, per this test's own instruction not to let it mask step 6.`,
          );
        }

        // --- Step 5: session 2 acquires. Per this file's own reachability
        // analysis, this MUST be served from the SAME respawned instance --
        // VICE_BROKER_MAX=1 forces it (a cold launch would be refused
        // at_capacity).
        const acquire2 = await session2.acquire();
        assert.ok(acquire2.ok, `session 2 acquire failed: ${JSON.stringify(acquire2)}`);
        if (!acquire2.ok) return;
        const grantB = acquire2.grant;
        assert.equal(
          grantB.port,
          P,
          `FAIL LOUDLY (per this task's own instruction): the reachability premise did not hold on this build -- ` +
            `grant A was on port ${P}, grant B landed on port ${grantB.port} instead. Status at the time: ${JSON.stringify(statusAfterRespawn)}`,
        );
        const { deps: deps2 } = depsFor(grantB, session2, stateDir);

        const diag5 = await dispatchStock("vice_diagnose", {}, deps2);
        const diag5Payload = parseOkPayload(diag5 as { content: { type: "text"; text: string }[]; isError: boolean });
        console.log(`stock-live-broker-monitor: vice_diagnose (grant B's real claim on the respawned instance) -> ${JSON.stringify(diag5Payload)}`);

        const statusAfterB = await rawStatus(host, controlPort, token);
        const entryAfterB = statusAfterB.find((i) => i.port === P);
        assert.ok(entryAfterB, `no status entry for port ${P} after grant B's claim, got: ${JSON.stringify(statusAfterB)}`);
        assert.equal(entryAfterB!.hasMonitorClient, true, `port ${P} must report hasMonitorClient:true after grant B's real claim, got: ${JSON.stringify(entryAfterB)}`);

        // --- Step 6: THE load-bearing assertion. Grant B currently holds
        // the ONLY monitor claim this instance has. clearHeldStockSession()
        // here is REQUIRED, not optional -- see this file's own header
        // comment's second mechanism note: without it, the next
        // dispatchStock(deps1) call would see stock-dispatch.ts's
        // module-level heldSession still pointing at session B's connected
        // client (a different targetId than deps1's grant A), take the
        // "replace" branch, and RELEASE grant B's claim via
        // stockDisconnect() BEFORE ever attempting grant A's claim -- which
        // would make grant A's re-attempt SUCCEED instead of being refused,
        // silently defeating the entire proof. clearHeldStockSession()
        // detaches the module's pointer WITHOUT touching the broker, so the
        // upcoming dispatchStock(deps1) call performs a truly fresh
        // claimMonitor() against whatever the broker's real state says --
        // which, with grant B's claim still live, is a genuine refusal.
        //
        // Direction is not hardcoded as prose (this task's own instruction):
        // the assertions below compare against grantB.id/grantA.port
        // (values this run actually captured), never a literal grant id.
        clearHeldStockSession();

        const start = Date.now();
        const diag6 = await dispatchStock("vice_diagnose", {}, deps1);
        const elapsedMs = Date.now() - start;
        const diag6Payload = parseOkPayload(diag6 as { content: { type: "text"; text: string }[]; isError: boolean });
        console.log(`stock-live-broker-monitor: vice_diagnose (grant A's SECOND claim attempt, refused) -> ${JSON.stringify(diag6Payload)} (${elapsedMs}ms)`);

        assert.notEqual(
          diag6Payload.verdict,
          "diagnosis_unavailable",
          `regression to the honest non-verdict would be silent otherwise -- full payload: ${JSON.stringify(diag6Payload)}`,
        );
        assert.equal(
          diag6Payload.verdict,
          "monitor_held_elsewhere",
          `expected the broker-mediated monitor_held_elsewhere verdict, got the full payload: ${JSON.stringify(diag6Payload)}`,
        );
        const evidence6 = diag6Payload.evidence as Record<string, unknown>;
        assert.equal(evidence6.holderGrantId, grantB.id, `evidence.holderGrantId must name the OTHER grant's real id (${grantB.id}), got: ${JSON.stringify(evidence6)}`);
        assert.ok(
          typeof evidence6.holderClaimedAt === "number" && Number.isFinite(evidence6.holderClaimedAt) && (evidence6.holderClaimedAt as number) > 0,
          `evidence.holderClaimedAt must be a finite number > 0, got: ${JSON.stringify(evidence6)}`,
        );
        assert.equal(evidence6.port, P, `evidence.port must be ${P}, got: ${JSON.stringify(evidence6)}`);
        const bound = diagnoseSessionTimeoutMs();
        assert.ok(elapsedMs < bound, `the refused claim must settle within ${bound}ms, took ${elapsedMs}ms`);

        console.log(
          `stock-live-broker-monitor: MEASURED elapsed for the refused claim on ${viceBinPath}: ${elapsedMs}ms (bound ${bound}ms); ` +
            `holderGrantId=${String(evidence6.holderGrantId)}; port=${String(evidence6.port)}`,
        );

        await session1.release();
        await session2.release();
      });
    } catch (err) {
      // Captured, not rethrown immediately -- so a genuine primary failure
      // (e.g. step 6's own assertion) is reported ALONGSIDE any deferred
      // step-4 failures rather than being masked by them, and so the final
      // pid-leak assertion below still runs even when the main proof itself
      // failed (teardown already ran inside withBrokerHarness()'s own
      // finally by the time we get here).
      primaryError = err;
    }

    if (primaryError !== null && deferredFailures.length > 0) {
      throw new Error(
        `primary failure: ${String(primaryError instanceof Error ? primaryError.stack ?? primaryError.message : primaryError)} | ` +
          `ALSO step 4 (deferred, non-masking) failures recorded: ${deferredFailures.join(" | ")}`,
      );
    }
    if (primaryError !== null) {
      throw primaryError;
    }
    if (deferredFailures.length > 0) {
      throw new Error(`step 4 (deferred, non-masking) failures recorded: ${deferredFailures.join(" | ")}`);
    }

    // Final assertion, per this task's own teardown discipline: a pid leak
    // fails as a TEST, never merely as a stray process left for a human to
    // notice later.
    assert.ok(report !== null, "withBrokerHarness must have returned a report when no primary error occurred");
    assert.deepEqual(
      report!.pidsAliveAfterTeardown,
      [],
      `pids still alive after teardown: ${JSON.stringify(report!.pidsAliveAfterTeardown)} (recorded: ${JSON.stringify(report!.recordedPids)})`,
    );
  },
);
