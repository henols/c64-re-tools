#!/usr/bin/env node
// stock-live-triage.test.ts
//
// OPT-IN, MANUAL-ONLY. Live-proves three of vice_diagnose's five stock
// verdicts that 07-VALIDATION.md's own Manual-Only table records as NEVER
// exercised against a real emulator: checkpoint_trap, wedged, restarted.
// 07-VERIFICATION.md's human_verification item 1 asks for exactly this --
// induce a real wedge and a real kill-and-respawn and confirm the verdicts
// -- and WR-03's fix (07-15) is a claim about what the machine's state
// REALLY is on the checkpoint_trap path, a claim only a real emulator can
// settle.
//
// UNLIKE stock-live.test.ts, this file owns its own emulator lifecycle PER
// TEST rather than one shared fixture for the whole file: the restarted
// proof (Task 3) kills and relaunches the instance it is testing, which
// would destroy a shared fixture for every test that ran after it.
// withTriageInstance() below is that per-test harness.
//
// Dispatches through the REAL dispatchStock() seam -- the same one
// vice-proxy.ts calls -- against a REAL stock VICE binary's binary monitor,
// over a REAL ViceMonitorClient socket, through the REAL stockConnect()/
// stockReconnect() handshakes (unlike stock-live.test.ts, whose deps.connect
// hands back a hand-built session -- this file's deps.connect/deps.reconnect
// are thin pass-throughs to the real functions that also capture the
// returned session, because capabilities must be genuinely resolved for
// Task 2's route reasoning to mean anything, and because Task 3's epoch
// evidence must flow through the SAME stockConnectDepsFor()-shaped path
// production uses). The only injected seam is deps.ensureLease, which hands
// back live coordinates instead of asking a broker for them (this file owns
// its own emulator process, not a broker-managed one).
//
// Two environment facts, established by 03-16's plan and not re-discovered
// here:
//   - /usr/local/bin/x64sc (the fork build, has -mcpserver) SHADOWS
//     /usr/bin/x64sc (genuinely unpatched stock) on PATH. A bare `x64sc`
//     would silently exercise the WRONG binary -- always name the stock
//     binary by absolute path (VICE_LIVE_TRIAGE_BIN, defaulting to
//     /usr/bin/x64sc).
//   - Both builds share $HOME/.config/vice/vicerc, and the 3.10 build has
//     written it, so spawning 3.9 raises a modal "Configuration file
//     version mismatch" dialog. XDG_CONFIG_HOME is pointed at a per-run
//     mkdtempSync() scratch dir to silence it, never the shared config.
//
// LAUNCH FLAG ORDER: "-default" must precede "-binarymonitor" -- -default
// resets every resource to its documented default BEFORE -binarymonitor
// turns the monitor on, so a persisted vicerc value (e.g. a jamaction from a
// PREVIOUS run of this very file) can never leak into the next one.
//
// 127.0.0.1-ONLY: the binary monitor is unauthenticated full machine
// control (T-07-17-01) -- every spawn binds ip4://127.0.0.1:<port> only.
//
// DEFAULT-SKIP IS MANDATORY: `npm test` globs this file via `*.test.*`, and
// CI has no VICE. SKIP_REASON is computed once, and EVERY test in this file
// passes it through node:test's own `{ skip }` option -- never a hand-rolled
// early return, which would report a false PASS rather than a SKIP. This
// file is registered in test-gate.mjs's MANUAL_ONLY_TESTS (the ONE list --
// see that file's own header) as the fifth manual-only file, alongside
// 07-13's own stock-live.test.ts sibling, so `npm run test:automated` never
// runs either.
//
// Opt in with:
//   VICE_LIVE_TRIAGE_BIN=/usr/bin/x64sc node --test stock-live-triage.test.ts
//
// WHAT NOT TO DO:
//   - Never acquire a child process or a socket outside withTriageInstance()'s
//     own try/finally -- teardown must run even when a test throws.
//   - Never bind -binarymonitoraddress to 0.0.0.0.
//   - Never use -jamaction with any value other than 2 (Monitor). 4 (Power
//     cycle) and 5 (Quit) are forbidden here (T-07-17-05): power-cycling
//     destroys all emulation state, and quitting would race this harness's
//     own teardown against the emulator's exit.
//   - Never write the test's forged epoch record anywhere but inside this
//     file's own mkdtempSync() scratch directory (T-07-17-03) -- the real
//     .vice-supervisor/ epoch file is never read or written here.
//   - Never stub, mock, or force a verdict when a mechanism does not
//     reproduce it (T-07-17-06) -- an honest dynamic skip naming both
//     attempted mechanisms is the only permitted fallback (Task 2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

import { dispatchStock, clearHeldStockSession, type StockDispatchDeps } from "./stock-dispatch.ts";
import { ViceMonitorClient } from "./stock-protocol.ts";
import { stockConnect, stockReconnect, type StockConnectSession, type StockConnectOptions, type StockReconnectOptions } from "./stock-connect.ts";
import type { HeldLease, BrokerControlSession } from "./vice-broker-client.ts";
import { runStateFor } from "./stock-runstate.ts";
import { writeEpochRecord } from "./broker-epoch.mts";

// ---------------------------------------------------------------------------
// Opt-in gate -- mirrors stock-live.test.ts's own gate exactly, with this
// file's own env var name.
// ---------------------------------------------------------------------------

const VICE_LIVE_TRIAGE_BIN_DEFAULT = "/usr/bin/x64sc";
const resolvedBinPath = process.env.VICE_LIVE_TRIAGE_BIN ?? VICE_LIVE_TRIAGE_BIN_DEFAULT;

/** Computed exactly once. Every test in this file passes this through
 * node:test's own `{ skip }` option -- never a hand-rolled early return,
 * which would report a false PASS rather than a SKIP. */
const SKIP_REASON: string | false = !process.env.VICE_LIVE_TRIAGE_BIN
  ? `stock-live-triage.test.ts is opt-in and default-skipped -- set VICE_LIVE_TRIAGE_BIN=/usr/bin/x64sc ` +
    `(or another real, genuinely unpatched stock VICE binary's absolute path) to run it. Defaults to ` +
    `${VICE_LIVE_TRIAGE_BIN_DEFAULT} when set to a truthy non-path value. A bare "x64sc" on PATH resolves ` +
    `to the fork build (which has -mcpserver, not this stock binary monitor path) -- always name the ` +
    `stock binary by absolute path.`
  : !existsSync(resolvedBinPath)
    ? `VICE_LIVE_TRIAGE_BIN="${resolvedBinPath}" does not exist on disk -- opt-in requires a real stock VICE ` +
      `binary at that absolute path (e.g. /usr/bin/x64sc). A bare "x64sc" on PATH would resolve to the fork ` +
      `build at /usr/local/bin/x64sc instead of genuine stock.`
    : false;

// ---------------------------------------------------------------------------
// Shared low-level helpers -- copied from stock-live.test.ts's own discipline
// (the freeEphemeralPort()/connectWithRetry() idiom), not re-derived.
// ---------------------------------------------------------------------------

/** Binds a throwaway server to 127.0.0.1:0, reads the OS-assigned port, and
 * closes it -- the standard "free ephemeral port" idiom. */
async function freeEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : null;
      srv.close(() => {
        if (port === null) reject(new Error("freeEphemeralPort: could not read an ephemeral port from address()"));
        else resolve(port);
      });
    });
  });
}

/** The emulator needs a moment to bind its listening socket after spawn.
 * Retries connect() in a bounded loop rather than a single attempt with a
 * long timeout. */
async function connectWithRetry(client: ViceMonitorClient, host: string, port: number, deadlineMs = 10000): Promise<void> {
  const start = Date.now();
  let lastErr: unknown = null;
  while (Date.now() - start < deadlineMs) {
    try {
      await client.connect(host, port, { timeoutMs: 1000 });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`connectWithRetry: could not connect to ${host}:${port} within ${deadlineMs}ms (last error: ${String(lastErr)})`);
}

function parseOkPayload(result: { content: { type: "text"; text: string }[]; isError: boolean }): Record<string, unknown> {
  assert.equal(result.isError, false, `expected an ok answer but got an error: ${result.content[0]?.text}`);
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

/** Waits (bounded) until `client`'s tracker reports "stopped" -- mirrors
 * stock-live.test.ts's own waitForStoppedRunState(), generalised to take an
 * explicit client since this file's fixture is per-test (and, for Task 3,
 * changes again across a relaunch within one test). Never polls the wire --
 * reads only the tracker's own event-driven projection (this file's own
 * WHAT NOT TO DO list). */
async function waitForStoppedRunState(client: ViceMonitorClient, deadlineMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    if (runStateFor(client) === "stopped") return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`waitForStoppedRunState: runState never reached "stopped" within ${deadlineMs}ms (last seen: ${runStateFor(client)})`);
}

const CONFORMANCE_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
} as unknown as BrokerControlSession;

// ---------------------------------------------------------------------------
// withTriageInstance() -- the per-test harness (Task 1).
// ---------------------------------------------------------------------------

interface TriageInstance {
  /** The port THIS instance (and any relaunch on the same port, via
   * `relaunch()`) binds to. */
  port: number;
  /** The StockDispatchDeps every dispatchStock() call in a test uses.
   * `connect`/`reconnect` are thin pass-throughs to the REAL stockConnect()/
   * stockReconnect() -- captured here only so this harness can hand back the
   * client those functions themselves created (needed for
   * waitForStoppedRunState()'s tracker read, and so a test can assert
   * against the session's own resolved capabilities/evidence). */
  deps: StockDispatchDeps;
  /** The most recently captured live session, or null before the first
   * successful connect/reconnect in this test. A getter (not a snapshot):
   * a reconnect or relaunch inside the SAME test replaces it. */
  session: () => StockConnectSession | null;
  /** Points deps.ensureLease's lease at a caller-supplied epoch file path
   * (Task 3). Must be set BEFORE the dispatchStock() call that performs the
   * FIRST connect in a test that needs epoch tracking -- the session's own
   * baselineEpoch is fixed at that connect time, from stockConnectDepsFor()
   * reading lease.epochFile through the exact path production uses. */
  setEpochFile: (path: string) => void;
  /** SIGKILLs the current child, waits bounded for its exit, then spawns a
   * fresh one on the SAME port (Task 3's "same port" requirement) with
   * `extraArgs` (defaulting to the instance's original extraArgs), and
   * waits for the new instance's monitor to actually accept a probe
   * connection before returning -- proving the relaunch is real even though
   * production's OWN reconnect path (stockReconnect()) never dials this far
   * once an epoch mismatch is already provable (see Task 3's own test). */
  relaunch: (extraArgs?: string[]) => Promise<void>;
}

async function withTriageInstance(opts: { extraArgs?: string[] }, fn: (instance: TriageInstance) => Promise<void>): Promise<void> {
  clearHeldStockSession();
  const extraArgs = opts.extraArgs ?? [];
  const scratchDir = mkdtempSync(join(tmpdir(), "gsd-0317-triage-"));
  let child: ChildProcess | null = null;

  async function spawnOnPort(port: number, args: string[]): Promise<ChildProcess> {
    const c = spawn(
      resolvedBinPath,
      ["-default", "-binarymonitor", "-binarymonitoraddress", `ip4://127.0.0.1:${port}`, ...args],
      { stdio: "ignore", env: { ...process.env, XDG_CONFIG_HOME: scratchDir } },
    );
    c.once("error", (err) => {
      console.error(`stock-live-triage.test.ts: spawned emulator process error: ${String(err)}`);
    });
    return c;
  }

  async function killAndWaitExit(c: ChildProcess): Promise<void> {
    try {
      c.kill("SIGKILL");
    } catch {
      // already dead -- best effort.
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 3000);
      c.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  try {
    const port = await freeEphemeralPort();
    child = await spawnOnPort(port, extraArgs);

    // A throwaway probe proves the monitor is actually up before any
    // dispatchStock() call is attempted -- stockConnect()/stockReconnect()
    // each dial exactly once with no retry of their own. Pure TCP connect,
    // no command sent, so this never perturbs the emulator's run state.
    const probe = new ViceMonitorClient();
    await connectWithRetry(probe, "127.0.0.1", port);
    await probe.disconnect();

    const targetId = `stock-live-triage-${port}`;
    let epochFile = "";
    let capturedSession: StockConnectSession | null = null;

    const deps: StockDispatchDeps = {
      ensureLease: async () => ({
        ok: true as const,
        lease: {
          host: "127.0.0.1",
          port,
          targetId,
          brokerControl: CONFORMANCE_BROKER_CONTROL,
          epochFile,
          supervisorDir: "",
        } as HeldLease,
      }),
      connect: async (connectOpts: StockConnectOptions) => {
        const session = await stockConnect(connectOpts);
        capturedSession = session;
        return session;
      },
      reconnect: async (session: StockConnectSession, reconnectOpts?: StockReconnectOptions) => {
        const next = await stockReconnect(session, reconnectOpts);
        capturedSession = next;
        return next;
      },
    };

    const instance: TriageInstance = {
      port,
      deps,
      session: () => capturedSession,
      setEpochFile: (path: string) => {
        epochFile = path;
      },
      relaunch: async (relaunchArgs?: string[]) => {
        if (child) {
          await killAndWaitExit(child);
        }
        child = await spawnOnPort(port, relaunchArgs ?? extraArgs);
        const relaunchProbe = new ViceMonitorClient();
        await connectWithRetry(relaunchProbe, "127.0.0.1", port);
        await relaunchProbe.disconnect();
      },
    };

    await fn(instance);
  } finally {
    clearHeldStockSession();
    if (child) {
      await killAndWaitExit(child);
    }
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Task 1: checkpoint_trap, live.
// ---------------------------------------------------------------------------

test(
  "stock-live-triage: checkpoint_trap is live-proven -- an armed stopping exec checkpoint at $EA31 halts the machine and vice_diagnose reports it with machinePaused observed, no bracket run",
  { skip: SKIP_REASON },
  async () => {
    await withTriageInstance({}, async (instance) => {
      // 1. Let the machine reach the KERNAL idle loop -- a short bounded
      //    wait after launch. $EA31 is the KERNAL's own IRQ entry (the same
      //    address 07-VALIDATION.md's vice_run_until live pass used), hit on
      //    every vsync IRQ once the KERNAL is running, which happens within
      //    the first fraction of a second of boot.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 2. Arm a real STOPPING exec checkpoint through the real
      //    vice_checkpoint_add tool -- never a hand-built wire frame. This
      //    dispatch is also this test's first, so it performs the real
      //    stockConnect() handshake (which itself halts-then-resumes the
      //    machine, per stock-connect.ts's own CR-02 comment) before
      //    CHECKPOINT_SET halts it again to arm the checkpoint.
      const addResult = await dispatchStock("vice_checkpoint_add", { start: "$ea31", stop: true, exec: true }, instance.deps);
      const addPayload = parseOkPayload(addResult as { content: { type: "text"; text: string }[]; isError: boolean });
      console.log(`stock-live-triage: armed checkpoint -> ${JSON.stringify(addPayload)}`);
      assert.equal(addPayload.stop, true, `the armed checkpoint must be a STOPPING checkpoint, got: ${JSON.stringify(addPayload)}`);

      // 3. Resume -- CHECKPOINT_SET itself halted the machine (any inbound
      //    byte does, stock's own standing rule), so nothing will hit the
      //    checkpoint until execution actually continues.
      const runResult = await dispatchStock("vice_execution_run", {}, instance.deps);
      assert.equal(runResult.isError, false, `vice_execution_run() must succeed, got: ${JSON.stringify(runResult)}`);

      // 4. Wait, bounded, until the tracker itself reports "stopped" -- the
      //    checkpoint really fired. Never poll with a wire read while
      //    waiting (this file's own WHAT NOT TO DO list) -- read the
      //    tracker's own event-driven projection instead.
      const session = instance.session();
      assert.ok(session, "instance.session() must be populated after the vice_checkpoint_add dispatch above");
      await waitForStoppedRunState(session!.client);

      // 5. vice_diagnose must answer checkpoint_trap, with WR-03's derived
      //    machinePaused/machinePausedSource, and no liveness bracket run --
      //    the trap check precedes the bracket in handleDiagnoseStock()'s
      //    own order.
      const diagResult = await dispatchStock("vice_diagnose", {}, instance.deps);
      const diagPayload = parseOkPayload(diagResult as { content: { type: "text"; text: string }[]; isError: boolean });
      console.log(`stock-live-triage: vice_diagnose (checkpoint_trap) -> ${JSON.stringify(diagPayload)}`);
      assert.equal(diagPayload.verdict, "checkpoint_trap", `expected verdict "checkpoint_trap", got the full payload: ${JSON.stringify(diagPayload)}`);
      assert.equal(diagPayload.machinePaused, true, `checkpoint_trap must report machinePaused:true, got: ${JSON.stringify(diagPayload)}`);
      assert.equal(
        diagPayload.machinePausedSource,
        "observed",
        `checkpoint_trap's machinePausedSource must be "observed" (a real wire stopped event), got: ${JSON.stringify(diagPayload)}`,
      );
      assert.ok(typeof diagPayload.report === "string" && (diagPayload.report as string).length > 0, "report must be a non-empty string");
      const evidence = diagPayload.evidence as Record<string, unknown>;
      assert.ok(
        !("bracket" in evidence),
        `checkpoint_trap must be reached WITHOUT the liveness bracket ever running -- evidence must carry no "bracket" key, got: ${JSON.stringify(evidence)}`,
      );
      assert.equal(evidence.isTrap, true);
      assert.equal(evidence.trapReason, "pc", `expected the machine to have stopped exactly AT the armed checkpoint's own address, got trapReason: ${String(evidence.trapReason)}`);
    });
  },
);
