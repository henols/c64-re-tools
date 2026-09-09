// vice-broker-acquire.test.ts
//
// 01.6.2.1-01-PLAN.md, Task 1 (P-01/P-02/P-03/P-04): unit-level proof that
// handleAcquire() consults the warm floor before ever cold-launching. Covers
// the EMITTED resources/vice-broker.mjs directly -- vice-broker.mts cannot be
// imported unbuilt (it value-imports its siblings by their ".mjs" specifier,
// which resolves only once tsc has compiled the whole tree into resources/,
// exactly like every other host-bound module's own header comment already
// explains for the opposite direction) -- so this file follows
// vice-broker-launch.test.ts's own established convention: a `.ts` file that
// tests emitted OUTPUT, never the unbuilt `.mts` source directly. Unlike that
// file, this one imports the built module (dynamic `import()`, after a fresh
// build()) to call handleAcquire()/handleRelease() as plain functions against
// a hand-built BrokerState -- there is no TCP control plane or real spawn
// anywhere in this file; every probe, kill and cold-launch spawn is injected
// through HandleAcquireDeps, the SAME dependency-seam shape
// broker-launch.mts's own BrokerDeps/TryLaunchDeps/MaintainWarmFloorDeps
// already establish. No test in this file opens a real connection to
// anything (`.claude/CLAUDE.md` § Emulator Access) and no `x64sc` runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
// `HERE` (below) is this directory, so the structural tests at the foot of
// this file read vice-broker.mts's own source from it -- the same idiom
// broker-control.test.ts uses for its own structural gates.
import { tmpdir } from "node:os";
import type { ChildProcess } from "node:child_process";

import { build } from "./build.ts";
import type { BrokerState, InstanceRecord } from "./broker-state.mts";
// Phase 33, plan 33-06 (D-15): imported from its one definition, exactly as
// the production modules import it -- never a second local shape.
import type { LaunchProfile } from "./broker-launch.mts";
import type { HandleAcquireDeps } from "./vice-broker.mts";
import type { AcquireOutcome } from "./broker-control.mts";
import type { KillStage } from "./broker-kill.mts";
import type { ViceBackend } from "./backend-detect.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT_URL = new URL("./resources/vice-broker.mjs", import.meta.url).href;

interface BrokerModule {
  handleAcquire: (requestId: string, stateDir: string, state: BrokerState, deps?: HandleAcquireDeps) => Promise<AcquireOutcome>;
  handleRelease: (requestId: string, state: BrokerState) => void;
  /** Test-only escape hatch (see vice-broker.mts's own doc comment on this
   * export) -- drives the warm-floor arm's REAL makeLoggingSpawn()+
   * stashingSpawn+withCrashSupervision() composition with no injected spawn
   * override, the only way Task 3's warm-floor case can prove that arm's
   * own independent dropper is fixed rather than merely typed. */
  _maintainWarmFloorForRealBroker: (stateDir: string, state: BrokerState, backend: ViceBackend) => Promise<void>;
}

/** Rebuilds resources/ from the current TypeScript source, then imports the
 * FRESH emitted vice-broker.mjs -- matching broker-e2e.test.ts's own
 * `build();` idiom at the top of every test. Node's ESM loader caches a
 * module by resolved URL for the lifetime of this process, so every test in
 * this file (and any OTHER file importing the same URL in the same `node
 * --test` run) shares one loaded instance -- harmless here, since this
 * module holds no test-visible mutable top-level state of its own (every
 * call site threads its own fresh BrokerState through). */
async function loadBrokerModule(): Promise<BrokerModule> {
  build();
  return (await import(BROKER_ARTIFACT_URL)) as unknown as BrokerModule;
}

function createState(): BrokerState {
  return { instances: new Map(), grants: new Map(), blockedPorts: new Set() };
}

function makeReadyInstance(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    port: 6600,
    url: "http://127.0.0.1:6600/mcp",
    state: "ready",
    reason: "spare",
    epochFile: join(HERE, "fixtures", "does-not-need-to-exist-epoch.json"),
    supervisorDir: join(HERE, "fixtures"),
    pid: 4242,
    expectedIdentity: "x64sc",
    launchedAt: 0,
    readyAt: 0,
    viceBin: "x64sc",
    viceArgs: [],
    dryRun: false,
    // Plan 41-03 (D-14): monitorClients is non-optional -- "no claim on any
    // channel" is an empty map, never an absent field.
    monitorClients: {},
    ...overrides,
  };
}

function stubColdSpawnFactory(spawnCalls: number[]): (port: number) => (command: string, args: string[]) => ChildProcess {
  return (port: number) => {
    return (): ChildProcess => {
      spawnCalls.push(port);
      return { pid: 9000 + spawnCalls.length } as unknown as ChildProcess;
    };
  };
}

function alwaysReadyProbe(): (port: number) => Promise<boolean> {
  return () => Promise.resolve(true);
}

/** Plan 41-05 (D-16): a stock cold launch's second (`-remotemonitor`) port
 * allocation is now MANDATORY -- acquirePortAndLaunch() fails the whole
 * acquire when `allocateRemoteMonitorPort` is omitted (undefined resolves)
 * or fails. Every test in this file that drives `handleAcquire()` with
 * `backend: "stock"` must supply a working allocator or its cold-launch arm
 * throws before ever reaching the spawn factory this file actually means to
 * exercise. Fixed at a high, never-colliding port (this file's own state
 * never touches 6900+) rather than derived from `exclude`, since none of
 * these tests care WHICH text port was allocated, only that one was. */
function stubAllocateRemoteMonitorPort(): (state: BrokerState, exclude: ReadonlySet<number>) => Promise<{ ok: true; port: number }> {
  return async (_state, exclude) => {
    let candidate = 6900;
    while (exclude.has(candidate)) candidate++;
    return { ok: true, port: candidate };
  };
}

// ---------------------------------------------------------------------------
// I-1 composition proof (08.2-06-PLAN.md, Task 3). The tests below are the
// non-bypassable proof this plan exists for: they call handleAcquire() /
// _maintainWarmFloorForRealBroker() with buildColdSpawnFactory (or any
// spawn override) OMITTED, so the REAL makeLoggingSpawn()+
// withCrashSupervision() composition in vice-broker.mts runs end to end,
// all the way down to a real nodeSpawn() call. A test that injects a spawn
// stub here proves nothing -- the defect this plan closes is precisely
// that the composition BETWEEN the stub seam and nodeSpawn silently drops
// its third argument, and every OTHER test in this file (correctly)
// injects a stub below that exact composition.
//
// Never fetched, never installed: the throwaway recorder script below is
// written by the test itself into its own mkdtempSync scratch dir and run
// via its own shebang -- no dependency is added (T-08.2-SC).
// ---------------------------------------------------------------------------

/** Writes a tiny throwaway Node script that records
 * `process.env.XDG_CONFIG_HOME ?? "<unset>"` to the path named by
 * `process.env.VICE_BROKER_TEST_RECORD_FILE`, then blocks forever (a real
 * timer keeps the event loop alive) rather than exiting on its own. This
 * is deliberate: withCrashSupervision()'s exit listener treats ANY exit
 * that isn't marked `deliberateKill` as a crash needing a real-backoff
 * respawn, and a script that exited naturally the instant it recorded its
 * env would trigger exactly that spiral mid-test. `killTestInstance()`
 * below marks the instance `deliberateKill` before ending it, so the real
 * composition's own exit handler takes the inert "deliberate teardown"
 * branch instead. */
function writeRecorderScript(): { scriptPath: string; scriptDir: string } {
  const scriptDir = mkdtempSync(join(tmpdir(), "vice-broker-acquire-recorder-"));
  const scriptPath = join(scriptDir, "recorder.mjs");
  writeFileSync(
    scriptPath,
    [
      "#!/usr/bin/env node",
      'import { writeFileSync } from "node:fs";',
      'writeFileSync(process.env.VICE_BROKER_TEST_RECORD_FILE, process.env.XDG_CONFIG_HOME ?? "<unset>");',
      "setInterval(() => {}, 60000);",
      "",
    ].join("\n"),
  );
  chmodSync(scriptPath, 0o700);
  return { scriptPath, scriptDir };
}

async function waitForFile(path: string, timeoutMs = 5000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(path)) {
      return readFileSync(path, "utf8");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${path} to be written`);
}

/** Marks the instance `deliberateKill` (matching broker-kill.mts's own
 * teardown discipline) BEFORE signalling it, so the real
 * withCrashSupervision() exit listener this test's own composition
 * installs takes the inert "deliberate teardown" branch -- never the
 * crash-count/backoff/respawn path a plain, unmarked SIGKILL would
 * trigger. */
function killTestInstance(state: BrokerState, port: number): void {
  const record = state.instances.get(port);
  if (!record || record.pid == null) return;
  record.deliberateKill = true;
  try {
    process.kill(record.pid, "SIGKILL");
  } catch {
    // Already exited -- nothing left to signal.
  }
}

async function waitForProcessExit(pid: number, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test("handleAcquire cold acquire (real makeLoggingSpawn + withCrashSupervision composition, buildColdSpawnFactory OMITTED): a stock launch's real nodeSpawn call gets a fresh scratch XDG_CONFIG_HOME, and a fork launch gets none (BACK-02)", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const stateDir = mkdtempSync(join(tmpdir(), "vice-broker-acquire-i1-state-"));
  const savedViceBin = process.env.VICE_BIN;
  const savedRecordFile = process.env.VICE_BROKER_TEST_RECORD_FILE;
  const savedAmbientXdg = process.env.XDG_CONFIG_HOME;
  const scratchDirs: string[] = [stateDir];

  try {
    delete process.env.XDG_CONFIG_HOME;

    // --- stock case: the real composition must thread a scratch dir through ---
    const stockState = createState();
    const stockScript = writeRecorderScript();
    scratchDirs.push(stockScript.scriptDir);
    const stockOutDir = mkdtempSync(join(tmpdir(), "vice-broker-acquire-i1-out-"));
    scratchDirs.push(stockOutDir);
    const stockOutFile = join(stockOutDir, "stock.txt");
    process.env.VICE_BIN = stockScript.scriptPath;
    process.env.VICE_BROKER_TEST_RECORD_FILE = stockOutFile;

    const stockOutcome = await handleAcquire("i1-stock", stateDir, stockState, { backend: "stock", allocateRemoteMonitorPort: stubAllocateRemoteMonitorPort() });
    assert.equal(stockOutcome.ok, true, `expected a successful grant, got ${JSON.stringify(stockOutcome)}`);
    if (!stockOutcome.ok) return;
    const stockRecord = stockState.instances.get(stockOutcome.grant.port);
    assert.ok(stockRecord, "the cold-launched stock record must be present in state");
    assert.ok(stockRecord!.pid, "the real spawn must have produced a pid");

    const stockRecorded = await waitForFile(stockOutFile);
    assert.notEqual(stockRecorded, "<unset>", "a stock launch must set XDG_CONFIG_HOME, not leave it unset");
    assert.ok(stockRecorded.length > 0, "the recorded XDG_CONFIG_HOME must be a non-empty string");
    assert.notEqual(stockRecorded, savedAmbientXdg, "the scratch dir must not equal the ambient XDG_CONFIG_HOME");
    assert.ok(stockRecorded.startsWith(tmpdir()), `the scratch dir must live under os.tmpdir(), got ${stockRecorded}`);

    const stockLogsDir = join(stateDir, String(stockOutcome.grant.port), "logs");
    assert.ok(existsSync(stockLogsDir) && readdirSync(stockLogsDir).length > 0, "the per-instance log file must exist under logs/ -- proves the stdio-wins merge order");

    killTestInstance(stockState, stockOutcome.grant.port);
    await waitForProcessExit(stockRecord!.pid!);

    // --- fork case (BACK-02 standing gate): the fork path receives no
    // options object at all, so the recorded value must stay unset ---
    const forkState = createState();
    const forkScript = writeRecorderScript();
    scratchDirs.push(forkScript.scriptDir);
    const forkOutDir = mkdtempSync(join(tmpdir(), "vice-broker-acquire-i1-out-"));
    scratchDirs.push(forkOutDir);
    const forkOutFile = join(forkOutDir, "fork.txt");
    process.env.VICE_BIN = forkScript.scriptPath;
    process.env.VICE_BROKER_TEST_RECORD_FILE = forkOutFile;

    const forkOutcome = await handleAcquire("i1-fork", stateDir, forkState, { backend: "fork" });
    assert.equal(forkOutcome.ok, true, `expected a successful grant, got ${JSON.stringify(forkOutcome)}`);
    if (!forkOutcome.ok) return;
    const forkRecord = forkState.instances.get(forkOutcome.grant.port);
    assert.ok(forkRecord, "the cold-launched fork record must be present in state");

    const forkRecorded = await waitForFile(forkOutFile);
    assert.equal(forkRecorded, "<unset>", "the fork path must receive no options object -- XDG_CONFIG_HOME must stay unset");

    killTestInstance(forkState, forkOutcome.grant.port);
    if (forkRecord!.pid) await waitForProcessExit(forkRecord!.pid);
  } finally {
    if (savedViceBin === undefined) delete process.env.VICE_BIN;
    else process.env.VICE_BIN = savedViceBin;
    if (savedRecordFile === undefined) delete process.env.VICE_BROKER_TEST_RECORD_FILE;
    else process.env.VICE_BROKER_TEST_RECORD_FILE = savedRecordFile;
    if (savedAmbientXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = savedAmbientXdg;
    for (const dir of scratchDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("maintainWarmFloor spare launch (real makeLoggingSpawn + withCrashSupervision composition via _maintainWarmFloorForRealBroker, no injected spawn override): a warm-floor stock launch's real nodeSpawn call also gets a fresh scratch XDG_CONFIG_HOME", async () => {
  const { _maintainWarmFloorForRealBroker } = await loadBrokerModule();
  const stateDir = mkdtempSync(join(tmpdir(), "vice-broker-acquire-i1-warm-state-"));
  const savedViceBin = process.env.VICE_BIN;
  const savedRecordFile = process.env.VICE_BROKER_TEST_RECORD_FILE;
  const savedAmbientXdg = process.env.XDG_CONFIG_HOME;
  const scratchDirs: string[] = [stateDir];

  try {
    const script = writeRecorderScript();
    scratchDirs.push(script.scriptDir);
    const outDir = mkdtempSync(join(tmpdir(), "vice-broker-acquire-i1-warm-out-"));
    scratchDirs.push(outDir);
    const outFile = join(outDir, "warm.txt");
    process.env.VICE_BIN = script.scriptPath;
    process.env.VICE_BROKER_TEST_RECORD_FILE = outFile;

    const state = createState();
    await _maintainWarmFloorForRealBroker(stateDir, state, "stock");

    const records = Array.from(state.instances.values());
    assert.equal(records.length, 1, "exactly one warm-floor spare instance must have launched toward the warm floor");
    const record = records[0]!;
    assert.ok(record.pid, "the real spawn must have produced a pid");

    const recorded = await waitForFile(outFile);
    assert.notEqual(recorded, "<unset>", "a warm-floor stock launch must set XDG_CONFIG_HOME, not leave it unset");
    assert.ok(recorded.length > 0, "the recorded XDG_CONFIG_HOME must be a non-empty string");
    assert.notEqual(recorded, savedAmbientXdg, "the scratch dir must not equal the ambient XDG_CONFIG_HOME");
    assert.ok(recorded.startsWith(tmpdir()), `the scratch dir must live under os.tmpdir(), got ${recorded}`);

    const logsDir = join(stateDir, String(record.port), "logs");
    assert.ok(existsSync(logsDir) && readdirSync(logsDir).length > 0, "the warm-floor arm's per-instance log file must exist -- proves its own stdio-wins merge order, independent of the cold-acquire arm's");

    killTestInstance(state, record.port);
    await waitForProcessExit(record.pid!);
  } finally {
    if (savedViceBin === undefined) delete process.env.VICE_BIN;
    else process.env.VICE_BIN = savedViceBin;
    if (savedRecordFile === undefined) delete process.env.VICE_BROKER_TEST_RECORD_FILE;
    else process.env.VICE_BROKER_TEST_RECORD_FILE = savedRecordFile;
    if (savedAmbientXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = savedAmbientXdg;
    for (const dir of scratchDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

// ---------------------------------------------------------------------------
// RED-first (P-04): this test must fail against today's (pre-P-01)
// handleAcquire(), which never consults state.instances at all -- every
// acquire cold-launches regardless of how many "ready" records exist. The
// observed RED output, captured before this task's own implementation
// commit, is quoted verbatim in 01.6.2.1-01-SUMMARY.md.
// ---------------------------------------------------------------------------

test("handleAcquire: an acquire arriving with one probe-live ready instance available is served from it and spawns nothing (P-01, Defect 5)", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, url: "http://127.0.0.1:6600/mcp", epochFile: "/tmp/vice-broker-acquire-test/6600/epoch.json", supervisorDir: "/tmp/vice-broker-acquire-test/6600" }));

  const spawnCalls: number[] = [];
  const outcome = await handleAcquire("req-1", "/tmp/vice-broker-acquire-test", state, {
    probe: alwaysReadyProbe(),
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
  });

  assert.equal(spawnCalls.length, 0, "the stubbed cold-launch spawn must never be called when a probe-live ready instance is available");
  assert.equal(outcome.ok, true, `expected a successful grant, got ${JSON.stringify(outcome)}`);
  if (outcome.ok) {
    assert.equal(outcome.grant.port, 6600, "the grant must name the PRE-WARMED port, not a freshly allocated one");
    assert.equal(outcome.grant.url, "http://127.0.0.1:6600/mcp");
    assert.equal(outcome.grant.epochFile, "/tmp/vice-broker-acquire-test/6600/epoch.json");
    assert.equal(outcome.grant.supervisorDir, "/tmp/vice-broker-acquire-test/6600");
  }
  assert.equal(state.instances.get(6600)?.state, "granted", "the pre-warmed instance must be marked granted, not left ready");
});

// ---------------------------------------------------------------------------
// P-02/P-03: a failed grant-time probe drops and identity-verified-kills the
// candidate, then the walk continues to the next ready record.
// ---------------------------------------------------------------------------

test("handleAcquire: a failed grant-time probe on the first of two ready records drops+kills it, grants the second, and spawns nothing", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc" }));
  state.instances.set(6601, makeReadyInstance({ port: 6601, pid: 5002, expectedIdentity: "x64sc", url: "http://127.0.0.1:6601/mcp" }));

  const spawnCalls: number[] = [];
  const killCalls: Array<{ pid: number | null; expectedIdentity: string }> = [];
  const outcome = await handleAcquire("req-2", "/tmp/vice-broker-acquire-test", state, {
    probe: (port: number) => Promise.resolve(port !== 6600),
    kill: (opts) => {
      killCalls.push(opts);
      return Promise.resolve("sigterm" as KillStage);
    },
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
  });

  assert.equal(spawnCalls.length, 0, "no cold launch -- the second ready record must satisfy the acquire");
  assert.equal(outcome.ok, true, `expected a successful grant, got ${JSON.stringify(outcome)}`);
  if (outcome.ok) {
    assert.equal(outcome.grant.port, 6601, "the grant must name the SECOND (probe-live) port, not the failed first one");
  }
  assert.equal(state.instances.has(6600), false, "the failed candidate's record must be gone from state (and therefore from _snapshotState())");
  assert.equal(killCalls.length, 1, "the identity-verified kill must be invoked exactly once");
  assert.deepEqual(killCalls[0], { pid: 5001, expectedIdentity: "x64sc" }, "the kill must target the FAILED record's own recorded pid and identity");
});

test("handleAcquire: a failed grant-time probe with no other ready record drops+kills it and falls through to exactly one cold launch on a different port", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc" }));

  const spawnCalls: number[] = [];
  const killCalls: Array<{ pid: number | null; expectedIdentity: string }> = [];
  const outcome = await handleAcquire("req-3", "/tmp/vice-broker-acquire-test", state, {
    probe: () => Promise.resolve(false),
    kill: (opts) => {
      killCalls.push(opts);
      return Promise.resolve("sigterm" as KillStage);
    },
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
  });

  assert.equal(spawnCalls.length, 1, "exactly one cold launch must follow the exhausted walk");
  assert.equal(outcome.ok, true, `expected a successful grant, got ${JSON.stringify(outcome)}`);
  // NOT asserted: that the cold-launched port NUMBER differs from the
  // failed candidate's own port. Dropping the failed record frees its port
  // number legitimately -- nextFreePort() (broker-state.mts) scans only
  // state.instances and the blocked set, so reallocating the SAME port
  // number to a FRESH process (a NEW record, a NEW pid) is correct,
  // expected behaviour, not a bug. This task's own plan prose's "a
  // different port" means a different INSTANCE, which spawnCalls.length
  // and the fresh pid recorded below already prove.
  assert.equal(killCalls.length, 1, "the identity-verified kill must be invoked exactly once, for the FAILED candidate only");
  assert.deepEqual(killCalls[0], { pid: 5001, expectedIdentity: "x64sc" });
  if (outcome.ok) {
    const freshRecord = state.instances.get(outcome.grant.port);
    assert.ok(freshRecord, "the cold-launched record must be present in state");
    assert.notEqual(freshRecord!.pid, 5001, "the cold-launched instance must be a FRESH process, not the killed candidate's own pid");
  }
});

// ---------------------------------------------------------------------------
// Kill-never-recycle survives the new promotion path: a released instance's
// record is gone from state.instances (handleRelease() deletes it outright),
// so it is structurally unselectable by handleAcquire()'s warm-instance
// selection arm -- no separate guard is needed, and this test asserts the
// property rather than assuming it.
// ---------------------------------------------------------------------------

test("handleAcquire: an instance released through handleRelease() is never promoted on a later acquire -- kill-never-recycle", async () => {
  const { handleAcquire, handleRelease } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, state: "granted", pid: 5001, expectedIdentity: "x64sc" }));
  state.grants.set("req-4", { id: "req-4", port: 6600, grantedAt: Date.now(), pid: 5001 });

  // The real release path -- deletes the grant and the instance record
  // synchronously; the identity-verified kill it fires is a fire-and-forget
  // best-effort against the seeded pid, never awaited by this test (matching
  // handleRelease()'s own real call sites, which never await it either).
  handleRelease("req-4", state);
  assert.equal(state.instances.has(6600), false, "handleRelease() must delete the instance record outright");
  assert.equal(state.grants.has("req-4"), false, "handleRelease() must delete the grant outright");

  const spawnCalls: number[] = [];
  const outcome = await handleAcquire("req-5", "/tmp/vice-broker-acquire-test", state, {
    probe: alwaysReadyProbe(), // would succeed if (incorrectly) offered a candidate -- there must be none
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
  });

  assert.equal(spawnCalls.length, 1, "with no ready candidate left, the acquire must cold-launch exactly once");
  assert.equal(outcome.ok, true, `expected a successful grant, got ${JSON.stringify(outcome)}`);
});

// ---------------------------------------------------------------------------
// Task 2 (T-01.6.2.1-28): handleRelease()'s grant-pid identity check. A
// stale/orphaned grant -- one whose recorded pid does NOT match the port's
// CURRENT occupant -- must never delete or signal that mismatched occupant.
// This is CR-01's own cross-session-kill blast radius, closed independently
// of Task 1's race fix: an ordinary crash-and-respawn that frees a port for
// an unrelated cold launch (broker-launch.mts's handleExit(), give-up
// branch) leaves exactly this shape behind, with no concurrent acquire race
// required to produce it.
// ---------------------------------------------------------------------------

test("handleRelease: a grant whose recorded pid does not match the port's current occupant retires the grant's own bookkeeping but leaves the mismatched occupant untouched", async () => {
  const { handleRelease } = await loadBrokerModule();
  const state = createState();
  // An UNRELATED instance now occupies port 6600 -- e.g. because the
  // originally-granted process crashed, was given up on, and the port was
  // reallocated to a brand-new cold launch with a DIFFERENT pid.
  state.instances.set(6600, makeReadyInstance({ port: 6600, state: "granted", pid: 7777, expectedIdentity: "x64sc" }));
  // The stale grant still names port 6600 but recorded a DIFFERENT
  // (now-dead) pid at grant time.
  state.grants.set("req-stale", { id: "req-stale", port: 6600, grantedAt: Date.now(), pid: 5001 });

  handleRelease("req-stale", state);

  assert.equal(state.grants.has("req-stale"), false, "the stale grant's own bookkeeping must still be retired");
  assert.ok(state.instances.has(6600), "the unrelated (mismatched-pid) occupant must still be present -- it was NOT deleted");
  const stillThere = state.instances.get(6600)!;
  assert.equal(stillThere.pid, 7777, "the unrelated occupant's own record must be untouched");
  assert.equal(stillThere.deliberateKill, undefined, "the unrelated occupant must never have deliberateKill set -- no kill was attempted against it");
});

test("handleRelease: a grant naming a port with NO current occupant at all (an already-gone instance) retires the grant's own bookkeeping with no error", async () => {
  const { handleRelease } = await loadBrokerModule();
  const state = createState();
  // No instance at port 6600 at all -- e.g. the instance already exited and
  // its exit handler already deleted the record via a separate path.
  state.grants.set("req-gone", { id: "req-gone", port: 6600, grantedAt: Date.now(), pid: 5001 });

  handleRelease("req-gone", state);

  assert.equal(state.grants.has("req-gone"), false, "the grant's own bookkeeping must still be retired even when the port is already empty");
  assert.equal(state.instances.has(6600), false, "there was never an instance to touch");
});

// ---------------------------------------------------------------------------
// D-07's standing constraint: the grant-time-probe-failure log line must be
// distinguishable from the shutdown kill's own line.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CR-01 (01.6.2.1-REVIEW.md, filed BLOCKER; 01.6.2.1-VERIFICATION.md's sole
// gap): selectWarmInstance()'s post-probe recheck rejects a candidate a
// concurrent sibling has already GRANTED (record.state flips synchronously),
// but NOT one a sibling has already DROPPED (markDeliberateDeath() +
// state.instances.delete() never touches record.state). Two concurrent
// handleAcquire() calls sharing ONE ready candidate, where the first
// caller's probe resolves false (drop) and the second's resolves true
// STRICTLY AFTER the first has already deleted the record, must both fall
// through to a fresh cold launch -- neither may receive a grant naming the
// deleted record.
// ---------------------------------------------------------------------------

test("CR-01: two overlapping selectWarmInstance() walks over one shared ready candidate -- the first caller's failed probe drops+kills it before the second caller's probe resolves true, so both fall through to fresh cold launches instead of the second reusing the dropped record", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  const originalPid = 5001;
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: originalPid, expectedIdentity: "x64sc" }));
  const originalRecord = state.instances.get(6600);

  // A probe shared by both handleAcquire() calls -- selected strictly by
  // invocation ORDER via a call counter (the race is about invocation
  // order, not about which request id happens to run first).
  let probeCallCount = 0;
  let resolveFirst!: (value: boolean) => void;
  let resolveSecond!: (value: boolean) => void;
  const firstDeferred = new Promise<boolean>((resolve) => {
    resolveFirst = resolve;
  });
  const secondDeferred = new Promise<boolean>((resolve) => {
    resolveSecond = resolve;
  });
  const sharedProbe = (_port: number): Promise<boolean> => {
    probeCallCount += 1;
    return probeCallCount === 1 ? firstDeferred : secondDeferred;
  };

  // Only the two PROBE gates need controlled ordering -- the kill's own
  // timing is not part of the race, so it resolves immediately.
  const killCalls: Array<{ pid: number | null; expectedIdentity: string }> = [];
  const sharedKill = (opts: { pid: number | null; expectedIdentity: string }): Promise<KillStage> => {
    killCalls.push(opts);
    return Promise.resolve("sigterm" as KillStage);
  };

  // A variant of stubColdSpawnFactory that mints a distinct, incrementing
  // fake pid per call, keyed per caller, so each caller's own cold-launched
  // record is distinguishable from the original candidate's seeded pid and
  // from the OTHER caller's cold-launched record.
  let pidCounter = 9000;
  function keyedColdSpawnFactory(spawnCalls: number[]): (port: number) => (command: string, args: string[]) => ChildProcess {
    return (port: number) => {
      return (): ChildProcess => {
        pidCounter += 1;
        spawnCalls.push(port);
        return { pid: pidCounter } as unknown as ChildProcess;
      };
    };
  }

  const spawnCallsA: number[] = [];
  const spawnCallsB: number[] = [];

  // acquirePortAndLaunch()'s single in_flight owner is a REAL, pre-existing
  // guard that handleAcquire()'s cold-launch arm always goes through via the
  // PRODUCTION nextFreePort() (HandleAcquireDeps has no allocatePort override
  // -- only probe/kill/buildColdSpawnFactory are injectable), so it is not
  // stubbed away by this test. Once BOTH callers fall through to a cold
  // launch (the CR-01 fix's own correct outcome), whichever reaches
  // acquirePortAndLaunch() first legitimately holds the slot and the other
  // is refused `launch_in_flight` -- exactly the single-owner serialisation
  // criterion C already proves, unrelated to CR-01. handleAcquire()'s own
  // header comment documents that this is NOT a control-plane error: "the
  // control-plane's own attemptAcquire()/enqueueAcquire() queue the request
  // and retry it later rather than refusing it." This test calls
  // handleAcquire() directly, bypassing that control-plane retry layer, so
  // it performs the SAME retry itself -- this is the one deviation from the
  // plan's literal test mechanics (recorded in 01.6.2.1-07-SUMMARY.md): a
  // single handleAcquire() call per caller deterministically collides with
  // this unrelated, correct guard, given the exact probe-ordering this test
  // requires.
  async function acquireWithRetryOnLaunchInFlight(requestId: string, deps: HandleAcquireDeps): Promise<AcquireOutcome> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const outcome = await handleAcquire(requestId, "/tmp/vice-broker-acquire-test", state, deps);
      if (!(outcome.ok === false && outcome.reason === "launch_in_flight")) {
        return outcome;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(`handleAcquire(${requestId}) never cleared launch_in_flight after 50 retries`);
  }

  // Call handleAcquire("race-a", ...) and handleAcquire("race-b", ...) back
  // to back WITHOUT awaiting either call before starting the next -- both
  // run synchronously up to their own `await deps.probe(...)` suspension
  // point over the SAME snapshotted record before either yields, reproducing
  // two real concurrent connections racing the same candidate.
  const outcomeAPromise = acquireWithRetryOnLaunchInFlight("race-a", {
    probe: sharedProbe,
    kill: sharedKill,
    buildColdSpawnFactory: keyedColdSpawnFactory(spawnCallsA),
  });
  const outcomeBPromise = acquireWithRetryOnLaunchInFlight("race-b", {
    probe: sharedProbe,
    kill: sharedKill,
    buildColdSpawnFactory: keyedColdSpawnFactory(spawnCallsB),
  });

  // Resolve the FIRST invocation's deferred to `false` (the drop path).
  resolveFirst(false);

  // Poll in a small bounded loop (await Promise.resolve() repeated, not a
  // real timer) until the shared candidate's record is confirmed absent
  // from state.instances -- proving the first caller's drop path
  // (markDeliberateDeath + the delete) has already executed. This removes
  // any dependence on undocumented microtask-scheduling order.
  let ticks = 0;
  while (state.instances.get(6600) === originalRecord && ticks < 10000) {
    await Promise.resolve();
    ticks++;
  }
  assert.notEqual(
    state.instances.get(6600),
    originalRecord,
    "the first caller's drop path (markDeliberateDeath + delete) must have already removed the original record before the second caller's probe resolves",
  );

  // THEN resolve the SECOND invocation's deferred to `true`.
  resolveSecond(true);

  const [outcomeA, outcomeB] = await Promise.all([outcomeAPromise, outcomeBPromise]);

  // Both outcomes report ok: true.
  assert.equal(outcomeA.ok, true, `expected race-a to succeed, got ${JSON.stringify(outcomeA)}`);
  assert.equal(outcomeB.ok, true, `expected race-b to succeed, got ${JSON.stringify(outcomeB)}`);

  // EACH caller's own buildColdSpawnFactory stub is invoked exactly once --
  // both callers fall through to a fresh cold launch, since the one shared
  // candidate failed its probe for the first caller and was gone by the
  // time the second caller's probe resolved. This is the assertion that
  // fails pre-fix: race-b's own selectWarmInstance() walk (unfixed) returns
  // the stale, already-deleted record as a "winner" via the state-only
  // recheck, so race-b's cold-launch arm is never reached and spawnCallsB
  // reads 0 instead of 1.
  assert.equal(spawnCallsA.length, 1, "race-a's own cold-spawn factory must be invoked exactly once");
  assert.equal(spawnCallsB.length, 1, "race-b's own cold-spawn factory must be invoked exactly once");

  // The identity-verified kill stub is invoked exactly ONCE total, for the
  // ORIGINAL candidate's own seeded pid, never a second time.
  assert.equal(killCalls.length, 1, "the identity-verified kill must be invoked exactly once total");
  assert.deepEqual(killCalls[0], { pid: originalPid, expectedIdentity: "x64sc" }, "the kill must target the ORIGINAL candidate's own recorded pid, never a second time");

  // Neither outcome's granted port resolves (via state.instances.get(...))
  // to the ORIGINAL (now-dropped) record object or its original pid -- and
  // every granted port must actually correspond to a REAL instance record
  // (never an orphaned grant naming a deleted record, which is exactly
  // CR-01's own cross-session-kill blast radius).
  for (const [label, outcome] of [["race-a", outcomeA], ["race-b", outcomeB]] as const) {
    if (outcome.ok) {
      assert.ok(
        state.instances.has(outcome.grant.port),
        `${label}'s granted port ${outcome.grant.port} must correspond to an actual instance record in state.instances -- an orphaned grant naming a deleted record is CR-01's own failure shape`,
      );
      const grantedRecord = state.instances.get(outcome.grant.port);
      assert.notEqual(grantedRecord, originalRecord, `${label}'s granted record must not be the original (now-dropped) record`);
      assert.notEqual(grantedRecord?.pid, originalPid, `${label}'s granted record must not carry the original (now-killed) pid`);
    }
  }

  // state.instances no longer contains the original record at all, only
  // whichever fresh cold-launched record(s) ended up occupying ports
  // afterward.
  for (const record of state.instances.values()) {
    assert.notEqual(record, originalRecord, "state.instances must no longer contain the original record at all");
  }
});

test("handleAcquire: the grant-time-probe-failure log line is distinct from broker-kill.mts's shutdown wording", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc" }));

  const logs: string[] = [];
  const outcome = await handleAcquire("req-6", "/tmp/vice-broker-acquire-test", state, {
    probe: () => Promise.resolve(false),
    kill: () => Promise.resolve("sigterm" as KillStage),
    buildColdSpawnFactory: stubColdSpawnFactory([]),
    log: (line: string) => logs.push(line),
  });
  assert.equal(outcome.ok, true);

  const failureLine = logs.find((l) => /grant-time probe failed/.test(l));
  assert.ok(failureLine, `expected a grant-time-probe-failure log line, got: ${JSON.stringify(logs)}`);
  assert.match(failureLine!, /port 6600/);
  assert.match(failureLine!, /pid 5001/);
  // WR-02: the kill is fire-and-forget, so this immediate line can no
  // longer name a resolved kill stage synchronously -- it only reports that
  // a kill was kicked off, not awaited by the walk.
  assert.match(failureLine!, /kicked off an identity-verified kill of the pid/);
  assert.doesNotMatch(
    failureLine!,
    /kill stage/,
    "the immediate drop line must not name a kill stage -- nothing here waits for deps.kill(...) to resolve (WR-02)",
  );
  for (const line of logs) {
    assert.doesNotMatch(line, /shutdown complete/, "the grant-time-probe-failure line must never read like the shutdown kill's own line");
  }
});

// ---------------------------------------------------------------------------
// WR-02 (.planning/todos/pending/2026-08-05-wr-02-*, decision: fix now): the
// grant-time probe failure's kill must be fire-and-forget, matching
// handleRelease()'s own posture, so the acquiring request never waits up to
// VICE_BROKER_KILL_WAIT_S per dead candidate before the walk can move on.
// These two tests prove the timing property directly, with a deferred kill
// promise this test controls -- not merely that the OUTCOME is still
// correct (the tests above already prove that), but that handleAcquire()
// genuinely never awaited deps.kill(...)'s own resolution.
// ---------------------------------------------------------------------------

test("handleAcquire: WR-02 -- falls through to a cold launch without ever awaiting the dropped candidate's kill", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc" }));

  const order: string[] = [];
  let resolveKill!: (stage: KillStage) => void;
  const killDeferred = new Promise<KillStage>((resolve) => {
    resolveKill = resolve;
  });

  const outcome = await handleAcquire("req-wr02a", "/tmp/vice-broker-acquire-test", state, {
    probe: () => Promise.resolve(false),
    kill: () => {
      order.push("kill-called");
      return killDeferred;
    },
    buildColdSpawnFactory: stubColdSpawnFactory([]),
  });
  order.push("acquire-settled");

  assert.equal(outcome.ok, true, `expected a successful cold-launch grant, got ${JSON.stringify(outcome)}`);
  // If selectWarmInstance() still awaited deps.kill(...) (the pre-fix
  // shape), handleAcquire()'s own await chain could not possibly settle
  // before killDeferred does -- killDeferred is still PENDING at this
  // point, proven by "acquire-settled" landing in `order` while the kill's
  // own promise remains unresolved.
  assert.deepEqual(
    order,
    ["kill-called", "acquire-settled"],
    "the acquire must settle while the kill promise is still pending, proving the walk never awaited it",
  );

  // Resolve it now, purely so this test leaves no dangling unhandled
  // rejection warning behind for the next test in the file.
  resolveKill("sigterm");
  await Promise.resolve();
  await Promise.resolve();
});

test("handleAcquire: WR-02 -- once the fire-and-forget kill settles, a separate log line names the resolved kill stage", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc" }));

  const logs: string[] = [];
  let resolveKill!: (stage: KillStage) => void;
  const killDeferred = new Promise<KillStage>((resolve) => {
    resolveKill = resolve;
  });

  const outcome = await handleAcquire("req-wr02b", "/tmp/vice-broker-acquire-test", state, {
    probe: () => Promise.resolve(false),
    kill: () => killDeferred,
    buildColdSpawnFactory: stubColdSpawnFactory([]),
    log: (line: string) => logs.push(line),
  });
  assert.equal(outcome.ok, true);

  assert.ok(
    !logs.some((l) => /kill stage/.test(l)),
    "no settled-kill line must exist yet -- the kill's own promise has not resolved",
  );

  resolveKill("sigkill");
  // Flush the microtask queue so the fire-and-forget .then() callback runs.
  await Promise.resolve();
  await Promise.resolve();

  const settledLine = logs.find((l) => /kill stage/.test(l));
  assert.ok(settledLine, `expected a settled-kill log line once the kill resolved, got: ${JSON.stringify(logs)}`);
  assert.match(settledLine!, /port 6600/);
  assert.match(settledLine!, /pid 5001/);
  assert.match(settledLine!, /kill stage: sigkill/);
});

// ---------------------------------------------------------------------------
// Task 3 (01.6.2.1-07-PLAN.md): WR-01 -- atCapacity() gates ONLY the
// cold-launch arm, not the warm-instance arm. At the instance ceiling with a
// probe-live ready candidate present, handleAcquire() must still grant it
// (granting an existing warm candidate creates no NEW instance and does not
// raise countTotal()); with the ceiling reached and NO ready candidate, the
// refusal is unchanged.
// ---------------------------------------------------------------------------

// The DEFAULT instance ceiling this test seeds -- read directly from
// broker-state.mts's own ceiling resolver (VICE_BROKER_MAX's default, 16,
// resolveCeiling()). If this default ever changes, this test's own seeding
// must change with it -- noted here so a silent default change makes this
// test visibly wrong rather than silently so.
const DEFAULT_INSTANCE_CEILING = 16;

test("handleAcquire: at the instance ceiling with one probe-live ready candidate present, the acquire is granted rather than refused (WR-01)", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  // Seed exactly the default ceiling's worth of records: one ready and
  // probe-live, the rest in a non-selectable ("granted") state.
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc" }));
  for (let i = 1; i < DEFAULT_INSTANCE_CEILING; i++) {
    const port = 6600 + i;
    state.instances.set(port, makeReadyInstance({ port, state: "granted", pid: 6000 + i, expectedIdentity: "x64sc" }));
  }
  assert.equal(state.instances.size, DEFAULT_INSTANCE_CEILING, "this test's own seeding must match the ceiling it exercises");

  const spawnCalls: number[] = [];
  const outcome = await handleAcquire("req-wr01-a", "/tmp/vice-broker-acquire-test", state, {
    probe: alwaysReadyProbe(),
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
  });

  assert.equal(spawnCalls.length, 0, "the ready candidate must satisfy the acquire -- no cold launch, even at the ceiling");
  assert.equal(outcome.ok, true, `expected the ready candidate to be granted despite the ceiling, got ${JSON.stringify(outcome)}`);
  if (outcome.ok) {
    assert.equal(outcome.grant.port, 6600, "the grant must name the ready candidate's own port");
  }
});

test("handleAcquire: at the instance ceiling with NO ready candidate, the acquire is still refused with at_capacity (WR-01 regression guard)", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  // Same ceiling, but every seeded record is non-selectable ("granted") --
  // no ready candidate anywhere.
  for (let i = 0; i < DEFAULT_INSTANCE_CEILING; i++) {
    const port = 6600 + i;
    state.instances.set(port, makeReadyInstance({ port, state: "granted", pid: 6000 + i, expectedIdentity: "x64sc" }));
  }
  assert.equal(state.instances.size, DEFAULT_INSTANCE_CEILING, "this test's own seeding must match the ceiling it exercises");

  const spawnCalls: number[] = [];
  const outcome = await handleAcquire("req-wr01-b", "/tmp/vice-broker-acquire-test", state, {
    probe: alwaysReadyProbe(), // would succeed if (incorrectly) offered a candidate -- there must be none
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
  });

  assert.equal(spawnCalls.length, 0, "at_capacity must refuse before ever touching the port allocator");
  assert.equal(outcome.ok, false, `expected a refusal at the ceiling with no ready candidate, got ${JSON.stringify(outcome)}`);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "at_capacity", "the refusal reason must be at_capacity, unchanged from before this task");
  }
});

// ---------------------------------------------------------------------------
// WR-03: a cold launch whose spawned child never gets a pid must leave NO
// broken record in state.instances, cleaned up at the point the failure is
// detected rather than deferred to crash supervision's own delayed
// respawn/give-up machinery.
// ---------------------------------------------------------------------------

test("handleAcquire: a cold-launched child that never receives a pid reports internal and leaves no broken record in state.instances (WR-03)", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();

  const outcome = await handleAcquire("req-wr03", "/tmp/vice-broker-acquire-test", state, {
    probe: alwaysReadyProbe(), // irrelevant -- no ready candidate exists at all, so this always falls to cold-launch
    buildColdSpawnFactory: (_port: number) => {
      return (): ChildProcess => {
        return { pid: undefined } as unknown as ChildProcess; // spawn() failed to fork -- no real pid
      };
    },
  });

  assert.equal(outcome.ok, false, `expected an internal failure, got ${JSON.stringify(outcome)}`);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "internal", "a pid-null cold launch must report internal");
  }
  assert.equal(
    state.instances.size,
    0,
    "state.instances must have NO entry at all for the port that was attempted -- the broken record must be deleted immediately, not left for crash supervision to find later",
  );
});

// ===========================================================================
// Phase 33, plan 33-06 (REPRO-05, D-16, T-33-23/T-33-24): warm-instance
// PROFILE ELIGIBILITY.
//
// The rule under test, restated because two of its three failure modes are
// invisible from the caller's side: a pre-warmed instance whose launch
// profile does not match the request is INELIGIBLE. It is not adjusted (warp
// is fixed at spawn -- there is no runtime `WarpMode` resource on stock at
// all), it is not killed or relaunched to re-warp it (a named anti-pattern in
// this project, and it would make an interactive session's emulator vanish),
// and it is NOT quietly handed over anyway (that would make the knob a lie
// the caller could never detect). The acquire falls through to the cold arm
// and gets a dedicated instance.
//
// Every test below drives the real, built handleAcquire()/profileEligible()
// through injected probe/kill/spawn seams. No emulator runs and no real
// connection is opened, exactly as the rest of this file.
// ===========================================================================

/** The eligibility predicate, read off the SAME built artifact
 * handleAcquire() is read off -- never a second local reimplementation of
 * the rule, which would let this file agree with itself while disagreeing
 * with production. */
async function loadProfileEligible(): Promise<(record: InstanceRecord, requested?: LaunchProfile) => boolean> {
  build();
  const mod = (await import(BROKER_ARTIFACT_URL)) as unknown as {
    profileEligible: (record: InstanceRecord, requested?: LaunchProfile) => boolean;
  };
  return mod.profileEligible;
}

/** Records every kill the acquire path invokes, so "no preemptive kill" can
 * be asserted as an observation rather than assumed. */
function recordingKill(calls: Array<{ pid: number | null; expectedIdentity: string }>): (opts: { pid: number | null; expectedIdentity: string }) => Promise<KillStage> {
  return (opts) => {
    calls.push(opts);
    return Promise.resolve("sigterm" as KillStage);
  };
}

test("handleAcquire (33-06, D-15/D-16, tracer): a {warp:true} acquire against a pool holding ONE profile-less warm ready instance cold-launches an instance whose viceArgs carry -warp, and leaves the warm instance ready and un-killed", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  // A profile-less warm instance: exactly what the warm floor maintains
  // today, and exactly what a broker restarted mid-phase reads from a state
  // directory written before InstanceRecord.profile existed.
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc" }));

  const spawnCalls: number[] = [];
  const killCalls: Array<{ pid: number | null; expectedIdentity: string }> = [];
  const outcome = await handleAcquire("req-33-06-tracer", "/tmp/vice-broker-acquire-test", state, {
    // Would happily answer for the warm candidate if it were ever offered --
    // so a warm hit here would be a real failure of the eligibility filter,
    // not an artefact of a stubbed-out probe.
    probe: alwaysReadyProbe(),
    kill: recordingKill(killCalls),
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
    backend: "stock",
    allocateRemoteMonitorPort: stubAllocateRemoteMonitorPort(),
    profile: { warp: true },
  });

  assert.equal(outcome.ok, true, `expected a grant from a dedicated cold launch, got ${JSON.stringify(outcome)}`);
  assert.equal(spawnCalls.length, 1, "the mismatched warm instance must NOT satisfy this acquire -- exactly one cold launch must follow");
  assert.notEqual(outcome.ok && outcome.grant.port, 6600, "the grant must name the freshly launched instance, not the profile-less warm one");

  if (outcome.ok) {
    const fresh = state.instances.get(outcome.grant.port);
    assert.ok(fresh, "the cold-launched record must be present in state");
    assert.ok(fresh!.viceArgs.includes("-warp"), `the cold launch's argv must carry -warp; got ${JSON.stringify(fresh!.viceArgs)}`);
    assert.deepEqual(fresh!.profile, { warp: true }, "the granted instance's record must carry the profile it was actually launched with -- this is what the eligibility rule reads on a LATER acquire");
  }

  // D-16's two prohibitions, asserted rather than assumed.
  const warm = state.instances.get(6600);
  assert.ok(warm, "the mismatched warm instance must still be in state.instances -- it is ineligible, not condemned");
  assert.equal(warm!.state, "ready", "the mismatched warm instance must still be READY -- never marked, never granted, never torn down");
  assert.equal(killCalls.length, 0, "NO kill may be invoked for a profile mismatch -- killing a warm instance to re-warp it is the named anti-pattern this rule exists to exclude");
  assert.equal(state.grants.size, 1, "exactly ONE grant -- an eligibility miss must not open a second state.grants.set() call");
});

test("handleAcquire (33-06, edge: empty): a profile-less acquire against a profile-less warm ready instance is served from the warm floor exactly as it is today -- no launch, and no profile key written", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc" }));

  const spawnCalls: number[] = [];
  const outcome = await handleAcquire("req-33-06-empty", "/tmp/vice-broker-acquire-test", state, {
    probe: alwaysReadyProbe(),
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
    // `profile` deliberately OMITTED -- this is the pre-33-06 call shape.
  });

  assert.equal(spawnCalls.length, 0, "an absent profile must behave exactly as it did before this plan -- the warm floor serves it");
  assert.equal(outcome.ok, true);
  assert.equal(outcome.ok && outcome.grant.port, 6600);
  assert.equal(state.instances.get(6600)?.state, "granted");
  assert.equal(
    Object.prototype.hasOwnProperty.call(state.instances.get(6600)!, "profile"),
    false,
    "no `profile` key may be written onto a record for a profile-less acquire -- absent means profile-less, and inventing the key would make an old record and a new one differ for one intent",
  );
  assert.equal(state.grants.size, 1, "exactly one grant on the warm-hit arm too");
});

test("profileEligible (33-06, D-16, absent-equals-false): an absent profile, an explicit {} and {warp:false,headless:false} are all mutually eligible", async () => {
  const profileEligible = await loadProfileEligible();
  const profileLess = makeReadyInstance();
  const empty = makeReadyInstance({ profile: {} });
  const bothFalse = makeReadyInstance({ profile: { warp: false, headless: false } });

  const requests: Array<LaunchProfile | undefined> = [undefined, {}, { warp: false, headless: false }];
  for (const record of [profileLess, empty, bothFalse]) {
    for (const requested of requests) {
      assert.equal(
        profileEligible(record, requested),
        true,
        `record ${JSON.stringify(record.profile)} must be eligible for request ${JSON.stringify(requested)} -- undefined and false are the SAME request`,
      );
    }
  }
});

test("profileEligible (33-06, D-16): {warp:true} is ineligible against a profile-less, empty or both-false record and vice versa, and {warp:true} differs from {warp:true,headless:true}", async () => {
  const profileEligible = await loadProfileEligible();
  const warped = makeReadyInstance({ profile: { warp: true } });
  const bothTrue = makeReadyInstance({ profile: { warp: true, headless: true } });

  for (const record of [makeReadyInstance(), makeReadyInstance({ profile: {} }), makeReadyInstance({ profile: { warp: false, headless: false } })]) {
    assert.equal(profileEligible(record, { warp: true }), false, `record ${JSON.stringify(record.profile)} must be INELIGIBLE for a {warp:true} request`);
  }
  for (const requested of [undefined, {}, { warp: false, headless: false }] as Array<LaunchProfile | undefined>) {
    assert.equal(profileEligible(warped, requested), false, `a {warp:true} record must be INELIGIBLE for request ${JSON.stringify(requested)} -- serving it would silently warp a run that did not ask for it`);
  }
  assert.equal(profileEligible(warped, { warp: true }), true, "identical profiles must match");
  assert.equal(profileEligible(warped, { warp: true, headless: true }), false, "{warp:true} and {warp:true,headless:true} are DIFFERENT profiles");
  assert.equal(profileEligible(bothTrue, { warp: true }), false, "and the comparison is symmetric");
  assert.equal(profileEligible(bothTrue, { warp: true, headless: true }), true);
});

test("handleAcquire (33-06, D-16): a warm instance recorded {warp:true} IS granted to a {warp:true} acquire, with no launch at all", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc", profile: { warp: true }, viceArgs: ["-default", "-warp", "-binarymonitor"] }));

  const spawnCalls: number[] = [];
  const killCalls: Array<{ pid: number | null; expectedIdentity: string }> = [];
  const outcome = await handleAcquire("req-33-06-match", "/tmp/vice-broker-acquire-test", state, {
    probe: alwaysReadyProbe(),
    kill: recordingKill(killCalls),
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
    backend: "stock",
    allocateRemoteMonitorPort: stubAllocateRemoteMonitorPort(),
    profile: { warp: true },
  });

  assert.equal(spawnCalls.length, 0, "a MATCHING warm instance must be served from the warm floor -- the eligibility rule must not refuse everything");
  assert.equal(outcome.ok, true);
  assert.equal(outcome.ok && outcome.grant.port, 6600, "the grant must name the pre-warmed, already-warped instance");
  assert.equal(killCalls.length, 0);
  assert.equal(state.grants.size, 1, "exactly one grant on the matching-warm-hit path");
});

test("handleAcquire (33-06, D-16): a profile-less acquire is INELIGIBLE for a {warp:true} warm instance -- the mismatch is refused in BOTH directions, and falls through to a cold launch", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc", profile: { warp: true } }));

  const spawnCalls: number[] = [];
  const killCalls: Array<{ pid: number | null; expectedIdentity: string }> = [];
  const outcome = await handleAcquire("req-33-06-reverse", "/tmp/vice-broker-acquire-test", state, {
    probe: alwaysReadyProbe(),
    kill: recordingKill(killCalls),
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
    backend: "stock",
    allocateRemoteMonitorPort: stubAllocateRemoteMonitorPort(),
    // No profile -- an ordinary interactive acquire must NOT be silently
    // handed a warped machine, which would change what its own run measures.
  });

  assert.equal(spawnCalls.length, 1, "a warped warm instance must not serve a profile-less acquire");
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    const fresh = state.instances.get(outcome.grant.port);
    assert.ok(fresh);
    assert.equal(fresh!.viceArgs.includes("-warp"), false, `the profile-less cold launch's argv must carry NO -warp; got ${JSON.stringify(fresh!.viceArgs)}`);
    assert.equal(Object.prototype.hasOwnProperty.call(fresh!, "profile"), false, "and its record must carry no profile key");
  }
  assert.equal(state.instances.get(6600)?.state, "ready", "the warped warm instance stays ready");
  assert.equal(killCalls.length, 0, "and is never killed");
  assert.equal(state.grants.size, 1, "exactly one grant on the ineligible-miss-then-cold path");
});

test("handleAcquire (33-06, D-16, headless): a {headless:true} acquire against a profile-less warm instance cold-launches with -console at argv index 1, and never retro-fits the warm one", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc" }));

  const spawnCalls: number[] = [];
  const killCalls: Array<{ pid: number | null; expectedIdentity: string }> = [];
  const outcome = await handleAcquire("req-33-06-headless", "/tmp/vice-broker-acquire-test", state, {
    probe: alwaysReadyProbe(),
    kill: recordingKill(killCalls),
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
    backend: "stock",
    allocateRemoteMonitorPort: stubAllocateRemoteMonitorPort(),
    profile: { headless: true },
  });

  assert.equal(spawnCalls.length, 1);
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    const fresh = state.instances.get(outcome.grant.port)!;
    // -console's POSITION is load-bearing (33-05: measured -- a -console
    // seen only by the late parser arrives after GTK has already failed, and
    // the process dies). Asserted here as well as in broker-launch.test.ts
    // because this is the first path that produces it from a wire request.
    assert.equal(fresh.viceArgs[0], "-default", "-default must stay at index 0");
    assert.equal(fresh.viceArgs[1], "-console", `-console must sit at index 1; got ${JSON.stringify(fresh.viceArgs)}`);
    assert.deepEqual(fresh.profile, { headless: true });
  }
  assert.equal(state.instances.get(6600)?.state, "ready");
  assert.equal(killCalls.length, 0);
  assert.equal(state.grants.size, 1);
});

test("handleAcquire (33-06, D-16, capacity interaction): an ineligible miss AT CAPACITY is refused with the existing at_capacity outcome rather than granted the mismatched warm instance", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();
  // The ceiling's worth of records, one of them a probe-live READY instance
  // whose profile does not match. `atCapacity()` gates only the COLD arm
  // (WR-01), so an eligibility miss now reaches it -- and the honest answer
  // is the existing refusal, never a silent downgrade to the mismatched
  // instance.
  state.instances.set(6600, makeReadyInstance({ port: 6600, pid: 5001, expectedIdentity: "x64sc" }));
  for (let i = 1; i < DEFAULT_INSTANCE_CEILING; i++) {
    const port = 6600 + i;
    state.instances.set(port, makeReadyInstance({ port, state: "granted", pid: 6000 + i, expectedIdentity: "x64sc" }));
  }
  assert.equal(state.instances.size, DEFAULT_INSTANCE_CEILING, "this test's own seeding must match the ceiling it exercises");

  const spawnCalls: number[] = [];
  const killCalls: Array<{ pid: number | null; expectedIdentity: string }> = [];
  const outcome = await handleAcquire("req-33-06-capacity", "/tmp/vice-broker-acquire-test", state, {
    probe: alwaysReadyProbe(),
    kill: recordingKill(killCalls),
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
    backend: "stock",
    allocateRemoteMonitorPort: stubAllocateRemoteMonitorPort(),
    profile: { warp: true },
  });

  assert.equal(outcome.ok, false, `expected the existing at_capacity refusal, got ${JSON.stringify(outcome)}`);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "at_capacity", "the refusal must reuse the EXISTING at_capacity reason -- no new outcome was invented for a profile miss");
  }
  assert.equal(spawnCalls.length, 0, "at_capacity refuses before ever touching the port allocator");
  assert.equal(state.instances.get(6600)?.state, "ready", "and the mismatched warm instance is left exactly as it was");
  assert.equal(killCalls.length, 0);
  assert.equal(state.grants.size, 0, "a refusal records no grant at all");
});

test("handleAcquire (D-16, plan 41-05, checkpoint option B): a stock cold launch whose text-port allocation fails returns no_free_text_port -- distinct from the generic no_free_port -- and no grant is recorded", async () => {
  const { handleAcquire } = await loadBrokerModule();
  const state = createState();

  const spawnCalls: number[] = [];
  const outcome = await handleAcquire("req-41-05-text-port-fail", "/tmp/vice-broker-acquire-test", state, {
    buildColdSpawnFactory: stubColdSpawnFactory(spawnCalls),
    backend: "stock",
    allocateRemoteMonitorPort: async () => ({ ok: false, reason: "no_free_port" }),
  });

  assert.equal(outcome.ok, false, `expected the acquire to fail when the text-port allocation fails, got ${JSON.stringify(outcome)}`);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "no_free_text_port", "the failure reason must be the DISTINCT no_free_text_port code, not the generic no_free_port and not internal");
  }
  assert.equal(spawnCalls.length, 0, "no process may be spawned when the text-port allocation fails");
  assert.equal(state.instances.size, 0, "no InstanceRecord may exist");
  assert.equal(state.grants.size, 0, "no grant may be recorded");
});

test("structural (33-06, T-33-23): the profile-eligibility filter is a synchronous `continue` placed BEFORE the readiness-probe await inside selectWarmInstance() -- the single-owner launch guard gains no new await", () => {
  const source = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  const startIdx = source.indexOf("\nasync function selectWarmInstance(");
  assert.ok(startIdx !== -1, "selectWarmInstance()'s own definition must be found in the source");
  const endIdx = source.indexOf("\n}\n", startIdx);
  assert.ok(endIdx > startIdx, "could not isolate selectWarmInstance()'s own closing brace");
  const body = source.slice(startIdx, endIdx);

  const filterIdx = body.indexOf("if (!profileEligible(record, deps.requestedProfile)) continue;");
  const probeIdx = body.indexOf("await deps.probe(record.port)");
  assert.ok(filterIdx !== -1, "the eligibility filter must be present in selectWarmInstance(), matched verbatim as a synchronous `continue`");
  assert.ok(probeIdx !== -1, "the readiness-probe await must be present");
  assert.ok(
    filterIdx < probeIdx,
    "the eligibility filter must precede the readiness-probe `await` -- placing it after would add a fresh suspension point inside the region the single-owner inFlight launch guard protects, the guard that exists because of the 2026-08-01 triple-launch outage",
  );

  // And it must not have been implemented by killing or relaunching the
  // mismatched candidate (D-16). The drop-and-kill machinery in this
  // function belongs to the FAILED-PROBE path only, which is reached after
  // the probe -- so nothing may appear between the filter and the probe.
  const between = body.slice(filterIdx, probeIdx);
  assert.doesNotMatch(between, /deps\.kill\(/, "no kill may sit between the eligibility filter and the probe");
  assert.doesNotMatch(between, /markDeliberateDeath\(/, "no deliberate-death marker may sit between the eligibility filter and the probe");
  assert.doesNotMatch(between, /\bawait\b/, "and no `await` at all may sit between them");
});

test("structural (33-06, T-33-24): the eligibility miss opens no second grant -- state.grants.set() still appears exactly once in vice-broker.mts's handleAcquire()", () => {
  const source = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  const startIdx = source.indexOf("export async function handleAcquire(");
  assert.ok(startIdx !== -1, "handleAcquire()'s own definition must be found");
  const endIdx = source.indexOf("\n}\n", startIdx);
  assert.ok(endIdx > startIdx, "could not isolate handleAcquire()'s own closing brace");
  const body = source.slice(startIdx, endIdx);
  const matches = body.match(/state\.grants\.set\(/g) ?? [];
  assert.equal(
    matches.length,
    1,
    `both arms must converge on exactly ONE state.grants.set() call; found ${matches.length}. An eligibility miss must fall through to the cold arm, not open a parallel grant path.`,
  );
});
