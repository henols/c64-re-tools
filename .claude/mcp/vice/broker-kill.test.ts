// broker-kill.test.ts
//
// Plan 04 (01.6.2): broker-kill.mts's own test file. Task 1 (above) proved
// the identity-verified kill discipline's corrected expected-identity
// parameterisation and its four-word stage contract. This section (Task 2)
// adds shutdown()/registerShutdownHandlers()/startupBanner() -- every
// catchable shutdown path converging on one re-entrant-safe teardown. Task 3
// (the startup reap) extends this file further below. Every kill and signal
// test here is driven against a real spawned stub child (/bin/sleep,
// /bin/cat) or a fully injected fake -- never a real emulator, and no test
// opens a connection to the host VICE.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn as realSpawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  verifiedKill,
  shutdown,
  registerShutdownHandlers,
  startupBanner,
  discoverBandProcesses,
  reapOrphanedInstances,
  _HANDLED_SIGNALS,
  type KillStage,
  type VerifiedKillDeps,
  type ShutdownDeps,
  type ProcessListEntry,
} from "./broker-kill.mts";
import { createBrokerState, _snapshotState, type BrokerState, type InstanceRecord } from "./broker-state.mts";
import { epochPathFor, nextEpochFor, writeEpochRecord, type EpochRecord } from "./broker-epoch.mts";
import { build } from "./build.ts";
import { acquireOverControlPlane } from "./vice-broker-client.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");

// quick-260805-9ha: the broker this file spawns binds its control listener
// INSIDE this container -- nothing here may ever dial the real host.
// acquireOverControlPlane() no longer dials broker.json's own control_host
// field (the broker's BIND address, never a dial target); this override is
// the CLIENT's (this test process's) own dial knob, set once at module
// scope. It is deliberately NOT passed into the spawned broker's own env --
// that process's bind address is governed by the separate, existing
// VICE_BROKER_CONTROL_HOST/VICE_BROKER_CONTROL_PORT knobs.
process.env.VICE_BROKER_CONTROL_DIAL_HOST = "127.0.0.1";

/** Poll `predicate` to a bounded deadline rather than sleeping a fixed
 * duration -- this project's own stack pattern (checkpoint/frame
 * synchronisation, never wall-clock delay), matching host-scripts.test.ts's
 * and broker-launch.test.ts's own waitFor() idiom exactly. */
async function waitFor<T>(
  predicate: () => T | null | undefined,
  { timeoutMs = 8000, pollMs = 20 }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = predicate();
    if (result) return result;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return null;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killIfAlive(pid: number | undefined): void {
  if (typeof pid !== "number") return;
  if (isAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

function makeInstance(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    port: 6600,
    url: "http://127.0.0.1:6600/mcp",
    state: "granted",
    reason: "acquire",
    epochFile: "/tmp/epoch.json",
    supervisorDir: "/tmp/6600",
    pid: null,
    expectedIdentity: "x64sc",
    launchedAt: 0,
    readyAt: null,
    viceBin: "x64sc",
    viceArgs: [],
    dryRun: false,
    ...overrides,
  };
}

// ============================================================================
// Task 1: verifiedKill() -- the corrected, parameterised identity check and
// the four-word stage contract.
// ============================================================================

test("verifiedKill: an already-exited pid returns 'already_exited' without ever signalling", async () => {
  const killCalls: Array<[number, NodeJS.Signals]> = [];
  const deps: VerifiedKillDeps = {
    isAlive: () => false,
    kill: (pid, signal) => killCalls.push([pid, signal]),
  };
  const stage = await verifiedKill({ pid: 999999, expectedIdentity: "x64sc", deps });
  assert.equal(stage, "already_exited");
  assert.deepEqual(killCalls, [], "no signal must ever be sent to a pid already reported dead");
});

test("verifiedKill: a null pid returns 'already_exited' without ever signalling", async () => {
  const killCalls: unknown[] = [];
  const stage = await verifiedKill({ pid: null, expectedIdentity: "x64sc", deps: { kill: () => killCalls.push(1) } });
  assert.equal(stage, "already_exited");
  assert.deepEqual(killCalls, []);
});

test("verifiedKill: a live pid whose own argument string does not contain the recorded expected identity is refused, never signalled, and remains alive", async () => {
  const child = realSpawn("/bin/sleep", ["300"]);
  const pid = child.pid;
  assert.ok(typeof pid === "number");
  try {
    await waitFor(() => isAlive(pid));
    const stage = await verifiedKill({ pid, expectedIdentity: "/definitely/not/the/real/binary" });
    assert.equal(stage, "identity_refused");
    assert.ok(isAlive(pid), "a pid failing the identity check must be left alive -- a test only checking the stage word is not enough");
  } finally {
    killIfAlive(pid);
  }
});

test("verifiedKill: a live pid whose own argument string contains the recorded expected identity is terminated and returns 'sigterm', gone within the poll deadline", async () => {
  const child = realSpawn("/bin/sleep", ["300"]);
  const pid = child.pid;
  assert.ok(typeof pid === "number");
  try {
    await waitFor(() => isAlive(pid));
    const stage = await verifiedKill({ pid, expectedIdentity: "/bin/sleep" });
    assert.equal(stage, "sigterm");
    const gone = await waitFor(() => !isAlive(pid));
    assert.ok(gone, "a genuine identity match must actually terminate the process");
  } finally {
    killIfAlive(pid);
  }
});

test("verifiedKill: the expected identity is a parameter, not a module constant -- two different real binaries each match only their own recorded identity", async () => {
  const sleepChild = realSpawn("/bin/sleep", ["300"]);
  const catChild = realSpawn("/bin/cat", []); // stdin is an unconnected pipe by default -- never sees EOF, so cat blocks indefinitely
  const sleepPid = sleepChild.pid;
  const catPid = catChild.pid;
  assert.ok(typeof sleepPid === "number");
  assert.ok(typeof catPid === "number");
  try {
    await waitFor(() => isAlive(sleepPid));
    await waitFor(() => isAlive(catPid));

    const sleepStage = await verifiedKill({ pid: sleepPid, expectedIdentity: "/bin/sleep" });
    const catStage = await verifiedKill({ pid: catPid, expectedIdentity: "/bin/cat" });

    assert.equal(sleepStage, "sigterm", "the sleep pid must match its OWN recorded identity");
    assert.equal(catStage, "sigterm", "the cat pid must match its OWN, DIFFERENT recorded identity -- proving the check is parameterised per call, never a shared constant");
  } finally {
    killIfAlive(sleepPid);
    killIfAlive(catPid);
  }
});

test("structural: broker-kill.mts assigns no module-scope identity-expectation constant -- expectedIdentity always arrives as a parameter", () => {
  const source = readFileSync(join(HERE, "broker-kill.mts"), "utf8");
  // Matches a TOP-LEVEL (not indented, i.e. not inside a function body)
  // `const`/`export const` whose name mentions identity/expectation and
  // whose initialiser is a string literal -- exactly the shape the bash
  // original's $SUPERVISOR_SCRIPT constant would take if it were carried
  // forward uncorrected into this module.
  const offendingConstant = /^(?:export\s+)?const\s+\w*(?:[Ii]dentity|[Ee]xpectation)\w*\s*=\s*["'`]/m;
  assert.equal(offendingConstant.test(source), false, "no top-level string-literal identity/expectation constant may exist -- the expected identity must always be a caller-supplied parameter");
});

test("verifiedKill: the escalation poll interval is 200ms and the wait bound is read from the injected kill-wait override, asserted against an injected clock", async () => {
  const killCalls: NodeJS.Signals[] = [];
  const sleepCalls: number[] = [];
  const deps: VerifiedKillDeps = {
    isAlive: () => true, // never exits on its own -- forces the full escalation
    readProcessArgs: () => "x64sc", // must pass the identity check to reach the escalation logic at all
    kill: (_pid, signal) => killCalls.push(signal),
    sleepMs: (ms) => {
      sleepCalls.push(ms);
      return Promise.resolve();
    },
    killWaitS: 0.5, // limitMs = 500 -> 3 polls of 200ms (0, 200, 400) then escalate at 600
  };
  const stage = await verifiedKill({ pid: 4242, expectedIdentity: "x64sc", deps });
  assert.equal(stage, "sigkill");
  assert.deepEqual(killCalls, ["SIGTERM", "SIGKILL"]);
  assert.deepEqual(sleepCalls, [200, 200, 200], "every poll interval must be exactly 200ms");
});

test("verifiedKill: killWaitS defaults to 5 seconds when neither the deps override nor VICE_BROKER_KILL_WAIT_S is set", async () => {
  const originalEnv = process.env.VICE_BROKER_KILL_WAIT_S;
  delete process.env.VICE_BROKER_KILL_WAIT_S;
  try {
    const sleepCalls: number[] = [];
    const stage = await verifiedKill({
      pid: 4242,
      expectedIdentity: "x64sc",
      deps: {
        isAlive: () => true,
        readProcessArgs: () => "x64sc",
        kill: () => {},
        sleepMs: (ms) => {
          sleepCalls.push(ms);
          return Promise.resolve();
        },
      },
    });
    assert.equal(stage, "sigkill");
    // 5000ms / 200ms = 25 polls before the 25th check (waitedMs=5000) escalates.
    assert.equal(sleepCalls.length, 25);
  } finally {
    if (originalEnv === undefined) delete process.env.VICE_BROKER_KILL_WAIT_S;
    else process.env.VICE_BROKER_KILL_WAIT_S = originalEnv;
  }
});

test("structural: the module's KillStage vocabulary is exactly the four words vice-proxy.ts's recycle-ack consumer switches on", () => {
  const killMts = readFileSync(join(HERE, "broker-kill.mts"), "utf8");
  const killStageMatch = /export type KillStage = ([^;]+);/.exec(killMts);
  assert.ok(killStageMatch, "broker-kill.mts must export a KillStage type alias");
  const stageWords = killStageMatch![1]
    .split("|")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .sort();
  assert.equal(stageWords.length, 4);
  assert.deepEqual(stageWords, ["already_exited", "identity_refused", "sigkill", "sigterm"]);

  const proxyTs = readFileSync(join(HERE, "vice-proxy.ts"), "utf8");
  for (const word of stageWords) {
    assert.ok(proxyTs.includes(`"${word}"`), `vice-proxy.ts must still reference stage word "${word}" -- a renamed/added stage word silently breaks its outcome renderer`);
  }
  assert.ok(proxyTs.includes('case "identity_refused":'), 'vice-proxy.ts must still switch on the literal "identity_refused" case');

  const successfulKillLine = proxyTs.split("\n").find((l) => l.includes("const successfulKill"));
  assert.ok(successfulKillLine, "vice-proxy.ts must still define successfulKill from kill_stage");
  const successfulWords = [...successfulKillLine!.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    successfulWords,
    stageWords.filter((w) => w !== "identity_refused").sort(),
    "the 'successful kill' subset the consumer checks must be exactly the three non-refusal stage words",
  );
});

// ============================================================================
// Task 2: shutdown()/registerShutdownHandlers() -- every catchable path
// converges on one re-entrant-safe teardown; startupBanner(); and the
// structural guarantees (no uncatchable-signal handler, no background flag,
// no self-re-exec).
// ============================================================================

test("shutdown: sets the deliberate-kill marker on every instance BEFORE any signal reaches it, and removes every instance unconditionally -- including one whose kill returns identity_refused", async () => {
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, pid: 111 }));
  state.instances.set(6601, makeInstance({ port: 6601, pid: 222 }));

  const markerAtCallTime = new Map<number, boolean | undefined>();
  const deps: ShutdownDeps = {
    state,
    kill: async ({ pid }) => {
      const instance = Array.from(state.instances.values()).find((i) => i.pid === pid)!;
      markerAtCallTime.set(pid!, instance.deliberateKill);
      return pid === 111 ? "sigterm" : "identity_refused";
    },
  };

  await shutdown(deps);

  assert.equal(markerAtCallTime.get(111), true, "the deliberate-kill marker must already be true by the time the kill for THIS instance runs");
  assert.equal(markerAtCallTime.get(222), true, "the deliberate-kill marker must already be true for EVERY instance, not just the first killed");
  assert.equal(_snapshotState(state).instances.length, 0, "every instance must be removed unconditionally, whatever stage word its kill returned -- this IS kill-never-recycle");
});

test("shutdown: an instance with a null pid is still removed from the map (nothing to kill, but the record must not linger)", async () => {
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, pid: null }));
  await shutdown({ state, kill: async () => "already_exited" });
  assert.equal(_snapshotState(state).instances.length, 0);
});

test("registerShutdownHandlers: SIGTERM/SIGINT/SIGHUP each converge on shutdown() and are registered -- exactly the three OS signals, never the uncatchable kill/stop signals", () => {
  assert.deepEqual([..._HANDLED_SIGNALS].sort(), ["SIGHUP", "SIGINT", "SIGTERM"]);
  assert.ok(!_HANDLED_SIGNALS.includes("SIGKILL" as NodeJS.Signals), "SIGKILL is uncatchable -- registering a handler for it would be a no-op that misleadingly implies otherwise");
  assert.ok(!_HANDLED_SIGNALS.includes("SIGSTOP" as NodeJS.Signals), "SIGSTOP is uncatchable for the identical reason");
});

test("registerShutdownHandlers: an injected uncaught exception reaches the shutdown path and kills every child, asserted by a real zero-signal liveness check", async () => {
  const proc = new EventEmitter() as unknown as { once: EventEmitter["once"]; removeListener: EventEmitter["removeListener"]; exitCode?: number | null; emit: EventEmitter["emit"] };
  const child = realSpawn("/bin/sleep", ["300"]);
  const pid = child.pid!;
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, pid, expectedIdentity: "/bin/sleep" }));

  const cleanup = registerShutdownHandlers({ state, proc });
  try {
    await waitFor(() => isAlive(pid));
    (proc as unknown as EventEmitter).emit("uncaughtException", new Error("injected for this test"));
    const gone = await waitFor(() => !isAlive(pid));
    assert.ok(gone, "an uncaught exception must reach the same shutdown path and kill every child");
    // shutdown()'s own kill() (verifiedKill) polls at a real 200ms interval
    // before confirming death and settling its promise -- the child can be
    // observed dead (above) slightly before that promise resolves and
    // exit() runs, so poll for the exit code too rather than reading it
    // immediately.
    const exited = await waitFor(() => (proc.exitCode !== undefined && proc.exitCode !== null ? true : null));
    assert.ok(exited, "shutdown must settle and record an exit code");
    assert.equal(proc.exitCode, 1, "an exception path must exit non-zero");
  } finally {
    cleanup();
    killIfAlive(pid);
  }
});

test("registerShutdownHandlers: an injected unhandled rejection reaches the shutdown path and kills every child", async () => {
  const proc = new EventEmitter() as unknown as { once: EventEmitter["once"]; removeListener: EventEmitter["removeListener"]; exitCode?: number | null; emit: EventEmitter["emit"] };
  const child = realSpawn("/bin/sleep", ["300"]);
  const pid = child.pid!;
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, pid, expectedIdentity: "/bin/sleep" }));

  const cleanup = registerShutdownHandlers({ state, proc });
  try {
    await waitFor(() => isAlive(pid));
    (proc as unknown as EventEmitter).emit("unhandledRejection", new Error("injected for this test"));
    const gone = await waitFor(() => !isAlive(pid));
    assert.ok(gone, "an unhandled rejection must reach the same shutdown path and kill every child");
    const exited = await waitFor(() => (proc.exitCode !== undefined && proc.exitCode !== null ? true : null));
    assert.ok(exited, "shutdown must settle and record an exit code");
    assert.equal(proc.exitCode, 1);
  } finally {
    cleanup();
    killIfAlive(pid);
  }
});

test("registerShutdownHandlers: normal exit (the injected process-like 'exit' event) reaches the shutdown path", async () => {
  const proc = new EventEmitter() as unknown as { once: EventEmitter["once"]; removeListener: EventEmitter["removeListener"]; exitCode?: number | null; emit: EventEmitter["emit"] };
  const child = realSpawn("/bin/sleep", ["300"]);
  const pid = child.pid!;
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, pid, expectedIdentity: "/bin/sleep" }));

  const cleanup = registerShutdownHandlers({ state, proc });
  try {
    await waitFor(() => isAlive(pid));
    (proc as unknown as EventEmitter).emit("exit");
    const gone = await waitFor(() => !isAlive(pid));
    assert.ok(gone, "a normal exit must reach the same shutdown path");
  } finally {
    cleanup();
    killIfAlive(pid);
  }
});

test("registerShutdownHandlers: two signals delivered in quick succession produce exactly one shutdown run", async () => {
  const proc = new EventEmitter() as unknown as { once: EventEmitter["once"]; removeListener: EventEmitter["removeListener"]; exitCode?: number | null; emit: EventEmitter["emit"] };
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, pid: 111 }));

  let killAttempts = 0;
  const cleanup = registerShutdownHandlers({
    state,
    proc,
    kill: async () => {
      killAttempts++;
      return "sigterm";
    },
  });
  try {
    (proc as unknown as EventEmitter).emit("SIGTERM");
    (proc as unknown as EventEmitter).emit("SIGINT");
    await waitFor(() => killAttempts > 0);
    // Give any accidental second run a moment to have started, if the guard
    // were broken.
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(killAttempts, 1, "a second signal arriving while shutdown is already running must not start a second shutdown");
  } finally {
    cleanup();
  }
});

test("startupBanner: names the foreground lifetime, that every emulator launched is destroyed, and that a session whose broker dies is void", () => {
  const banner = startupBanner();
  assert.match(banner, /foreground/i);
  assert.match(banner, /terminate every emulator/i);
  assert.match(banner, /voids? every session|no.*reconnect/i);
});

test("startupBanner: names the retired VICE_BROKER_SPARES variable as set-and-ignored, naming VICE_BROKER_WARM_FLOOR as its replacement, only when the retired variable is set (D-25/P-13)", () => { // banner
  const saved = process.env.VICE_BROKER_SPARES; // banner
  try {
    delete process.env.VICE_BROKER_SPARES; // banner
    const withoutVar = startupBanner();
    assert.doesNotMatch(withoutVar, /VICE_BROKER_SPARES/, "the retired-variable line must not appear when the variable is unset"); // banner

    process.env.VICE_BROKER_SPARES = "3"; // banner
    const withVar = startupBanner();
    assert.match(withVar, /VICE_BROKER_SPARES/, "the retired variable must be named when it is set"); // banner
    assert.match(withVar, /ignored/i, "the line must say the retired variable is ignored");
    assert.match(withVar, /VICE_BROKER_WARM_FLOOR/, "the line must name the replacement variable");
  } finally {
    if (saved === undefined) delete process.env.VICE_BROKER_SPARES; // banner
    else process.env.VICE_BROKER_SPARES = saved; // banner
  }
});

test("structural: the real broker prints the banner before the control listener starts, and registers shutdown handling after the listener is up", () => {
  const source = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  const bannerIdx = source.indexOf("startupBanner()");
  const listenerIdx = source.indexOf("await startControlListener(");
  const registerIdx = source.indexOf("registerShutdownHandlers(");
  assert.ok(bannerIdx !== -1 && listenerIdx !== -1 && registerIdx !== -1);
  assert.ok(bannerIdx < listenerIdx, "the banner must print before the control listener starts");
  assert.ok(registerIdx > listenerIdx, "shutdown handling is registered once the listener is up");
});

test("structural: the broker's argument parser recognises exactly --repo-root, --state-dir, --check-container and --dry-run -- no flag for running in the background", () => {
  const source = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  const parseArgsMatch = /export function parseArgs\(argv: string\[\]\): ParsedArgs \{([\s\S]*?)\n\}/.exec(source);
  assert.ok(parseArgsMatch, "vice-broker.mts must export parseArgs()");
  const body = parseArgsMatch![1];
  const flags = [...body.matchAll(/argv\[i\] === "(--[a-z-]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(flags, ["--check-container", "--dry-run", "--repo-root", "--state-dir"]);
});

test("structural: the broker never re-executes itself -- no reference to its own executable path anywhere in vice-broker.mts", () => {
  const source = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  assert.ok(!source.includes("execPath"), "no self-spawn/re-exec construct (process.execPath or similar) may appear -- detaching stays the operator's own choice (D-25)");
});

test("structural: no clean-shutdown marker file is ever referenced in broker-kill.mts or vice-broker.mts", () => {
  const killMts = readFileSync(join(HERE, "broker-kill.mts"), "utf8");
  const brokerMts = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  const forbidden = /clean.shutdown.marker|was_clean|shutdown_marker/i;
  assert.equal(forbidden.test(killMts), false, "broker-kill.mts must not reference a clean-shutdown marker file");
  assert.equal(forbidden.test(brokerMts), false, "vice-broker.mts must not reference a clean-shutdown marker file");
});

// ---------------------------------------------------------------------------
// Real end-to-end shutdown: spawn the built broker artifact with a stub
// emulator binary, grant two instances over the real TCP control plane, then
// signal the broker itself (never a real emulator) and prove BOTH stub
// children are gone and the broker exits 0. Mirrors broker-e2e.test.ts's own
// startBroker()/waitForBrokerJson() idiom.
// ---------------------------------------------------------------------------

interface BrokerHandle {
  child: ReturnType<typeof realSpawn>;
  stateDir: string;
  stderr: string;
}

function startBroker(stateDir: string): BrokerHandle {
  const child = realSpawn(process.execPath, [BROKER_ARTIFACT, "--repo-root", "/tmp/fake-repo-root-kill", "--state-dir", stateDir], {
    env: {
      ...process.env,
      VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
      VICE_BIN: "/bin/sleep",
      VICE_ARGS: "600",
      VICE_BROKER_CONTROL_PORT: "0",
      // quick-260805-9ha: this file's own module-scope override is a CLIENT
      // (this test process's) dial knob -- unset it here so the SPAWNED
      // broker's env never carries it, even though process.env above would
      // otherwise leak it in. child_process.spawn() drops an undefined-
      // valued key rather than passing it through as the literal string
      // "undefined" (verified: Node strips it before execve).
      VICE_BROKER_CONTROL_DIAL_HOST: undefined,
    },
  });
  const handle: BrokerHandle = { child, stateDir, stderr: "" };
  child.stderr?.on("data", (chunk: Buffer) => {
    handle.stderr += chunk.toString("utf8");
  });
  return handle;
}

async function waitForBrokerJson(stateDir: string, deadlineMs = 5000): Promise<Record<string, unknown>> {
  const path = join(stateDir, "broker.json");
  const appeared = await waitFor(() => (existsSync(path) && typeof JSON.parse(readFileSync(path, "utf8")).control_port === "number" ? true : null), { timeoutMs: deadlineMs });
  assert.ok(appeared, "broker.json with a control_port did not appear within deadline");
  return JSON.parse(readFileSync(path, "utf8"));
}

function instancePidsUnder(stateDir: string): number[] {
  const portDirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
  const pids: number[] = [];
  for (const d of portDirs) {
    const epochPath = join(stateDir, d.name, "epoch.json");
    if (!existsSync(epochPath)) continue;
    const rec = JSON.parse(readFileSync(epochPath, "utf8"));
    if (typeof rec.pid === "number") pids.push(rec.pid);
  }
  return pids;
}

for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
  test(`end-to-end: a real ${sig} to the broker kills every stub child it launched and the broker exits 0`, { timeout: 20000 }, async () => {
    build();
    const stateDir = mkdtempSync(join(tmpdir(), `broker-kill-${sig}-`));
    const handle = startBroker(stateDir);
    try {
      await waitForBrokerJson(stateDir);
      const first = await acquireOverControlPlane(stateDir);
      const second = await acquireOverControlPlane(stateDir);

      const pids = await waitFor(() => {
        const found = instancePidsUnder(stateDir);
        return found.length === 2 ? found : null;
      });
      assert.ok(pids, `expected exactly two instance directories with recorded pids, stderr:\n${handle.stderr}`);
      assert.ok(pids!.every(isAlive), "both stub children must be alive before the signal");

      handle.child.kill(sig);

      const allGone = await waitFor(() => pids!.every((p) => !isAlive(p)));
      assert.ok(allGone, `both stub children must be gone after ${sig}, stderr:\n${handle.stderr}`);

      const exited = await waitFor(() => handle.child.exitCode !== null || handle.child.signalCode !== null);
      assert.ok(exited, "the broker itself must exit after handling the signal");
      assert.equal(handle.child.exitCode, 0, `a signal-triggered shutdown must be a clean exit, stderr:\n${handle.stderr}`);

      // Leave `first`/`second` unreleased deliberately -- shutdown() must
      // kill every instance regardless of grant state, not only released
      // ones. Referencing them keeps the linter/typechecker happy about
      // "declared but never read" without performing a release.
      void first;
      void second;
    } finally {
      if (handle.child.exitCode === null && handle.child.signalCode === null) {
        handle.child.kill("SIGKILL");
      }
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
}

test("end-to-end: the broker prints its start-time banner on stderr before the control listener accepts a connection", { timeout: 20000 }, async () => {
  // quick-260805 (todo: 2026-08-05-broker-kill-banner-ordering-test-is-
  // flaky-under-full-suite-load.md): the RETIRED version of this test
  // compared `bannerIdx < listenerBoundIdx`, both read from the SAME
  // `handle.stderr` buffer -- textually deterministic once both lines have
  // arrived, but nothing forced the SECOND line ("control listener bound")
  // to have arrived across the child's stdout/stderr PIPE by the moment the
  // assertion ran. That line is written (vice-broker.mts) only AFTER
  // broker.json is already on disk, so under full-suite CPU load the
  // cross-process pipe delivery of that one stderr line could still be in
  // flight at the exact instant `waitForBrokerJson()` resolved from a plain,
  // fast filesystem poll -- producing `listenerBoundIdx === -1` and a false
  // red on an otherwise-healthy broker. The banner line itself was never the
  // flaky half (it is written far earlier, before startControlListener() is
  // even called, so it has a large head start) -- it was comparing against a
  // second, later stderr line's ARRIVAL TIME that raced the file poll.
  //
  // Fix (option 1, the filed preference order's first choice): assert the
  // CAUSAL property the test's own name promises -- the listener actually
  // ACCEPTS a connection -- by performing a real acquire over the control
  // plane (acquireOverControlPlane(), the same call the SIGTERM/SIGINT/
  // SIGHUP tests above already use against this same startBroker() harness)
  // rather than grepping stderr for a second log line. A successful acquire
  // can only happen if the listener genuinely accepted and answered, so this
  // is deterministic under any load: it is not racing a pipe against a
  // filesystem poll, it is the accept itself.
  build();
  const stateDir = mkdtempSync(join(tmpdir(), "broker-kill-banner-"));
  const handle = startBroker(stateDir);
  try {
    await waitForBrokerJson(stateDir);

    // The causal fact: the control listener accepts a connection and
    // completes a real acquire handshake over it.
    const acquired = await acquireOverControlPlane(stateDir);
    void acquired; // deliberately left unreleased -- the broker's own SIGKILL teardown below cleans it up, same as the SIGTERM/SIGINT/SIGHUP tests above

    // Only now check the banner -- by this point a full request/response
    // round trip has already crossed the control socket, which gives the
    // (much earlier-written) banner line every opportunity to have arrived
    // too. This assertion no longer needs any second line's arrival time:
    // it only needs THIS ONE line, which is written long before the listener
    // is even created (see the structural source-order test below).
    assert.match(handle.stderr, /foreground/i, `banner missing from stderr, stderr:\n${handle.stderr}`);
    assert.match(handle.stderr, /terminate every emulator/i);
  } finally {
    if (handle.child.exitCode === null && handle.child.signalCode === null) {
      handle.child.kill("SIGKILL");
    }
    rmSync(stateDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Task 3: discoverBandProcesses()/reapOrphanedInstances() -- the
// unconditional startup reap, derived from the port band plus process
// identity, never from a registry or a marker file.
// ============================================================================

test("discoverBandProcesses: against a four-entry injected listing (in-band emulator, out-of-band emulator, in-band other binary, unrelated process), exactly one is selected", async () => {
  const entries: ProcessListEntry[] = [
    { pid: 100, args: "/usr/bin/x64sc -mcpserver -mcpserverport 6605" }, // in-band emulator: MATCH
    { pid: 101, args: "/usr/bin/x64sc -remotemonitoraddress 127.0.0.1:6520" }, // out-of-band emulator (below base): no match
    { pid: 102, args: "/usr/bin/some-other-binary --port 6650" }, // in-band port, wrong binary: no match
    { pid: 103, args: "/usr/bin/unrelated --flag" }, // unrelated: no match
  ];
  const matched = await discoverBandProcesses({ listProcesses: () => entries, viceBin: "x64sc", basePort: 6600 });
  assert.deepEqual(
    matched.map((e) => e.pid),
    [100],
  );
});

test("discoverBandProcesses: a process naming the emulator binary but a port below the band's base is left alone", async () => {
  const entries: ProcessListEntry[] = [{ pid: 200, args: "/usr/bin/x64sc -mcpserverport 6550" }];
  const matched = await discoverBandProcesses({ listProcesses: () => entries, viceBin: "x64sc", basePort: 6600 });
  assert.deepEqual(matched, []);
});

test("discoverBandProcesses: a process naming an in-band port but a different binary is left alone", async () => {
  const entries: ProcessListEntry[] = [{ pid: 201, args: "/usr/bin/notepad --port 6650" }];
  const matched = await discoverBandProcesses({ listProcesses: () => entries, viceBin: "x64sc", basePort: 6600 });
  assert.deepEqual(matched, []);
});

test("reapOrphanedInstances: two real stub children, one imitating an in-band emulator and one out-of-band -- the in-band one ends up dead, the out-of-band one alive", async () => {
  const inBand = realSpawn("/bin/sleep", ["300", "6605"]);
  const outOfBand = realSpawn("/bin/sleep", ["300", "6520"]);
  const inBandPid = inBand.pid!;
  const outOfBandPid = outOfBand.pid!;
  const stateDir = mkdtempSync(join(tmpdir(), "broker-kill-reap-"));
  try {
    await waitFor(() => isAlive(inBandPid) && isAlive(outOfBandPid));

    const result = await reapOrphanedInstances({
      stateDir,
      viceBin: "/bin/sleep",
      basePort: 6600,
      listProcesses: () => [
        { pid: inBandPid, args: `/bin/sleep 300 6605` },
        { pid: outOfBandPid, args: `/bin/sleep 300 6520` },
      ],
      epochPathFor,
      nextEpochFor,
      writeEpochRecord,
    });

    assert.equal(result.found, 1);
    assert.equal(result.killed, 1);

    const inBandGone = await waitFor(() => !isAlive(inBandPid));
    assert.ok(inBandGone, "the in-band stub child must be reaped");
    assert.ok(isAlive(outOfBandPid), "the out-of-band stub child (the human's reserved band) must be left alone");
  } finally {
    killIfAlive(inBandPid);
    killIfAlive(outOfBandPid);
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("reapOrphanedInstances: every in-band instance directory on disk has its epoch bumped by exactly one, including one with no in-memory record; an out-of-band directory is untouched", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "broker-kill-reap-epoch-"));
  try {
    const inBandDir = join(stateDir, "6605");
    const outOfBandDir = join(stateDir, "6550");
    mkdirSync(inBandDir, { recursive: true });
    mkdirSync(outOfBandDir, { recursive: true });
    const inBandRecord: EpochRecord = { epoch: 3, spawned_at: "2026-01-01T00:00:00Z", pid: 12345, supervisor_pid: process.pid, vice_bin: "/bin/sleep", vice_args: [], log: "logs/x.log", dry_run: false };
    const outOfBandRecord: EpochRecord = { ...inBandRecord, epoch: 5, pid: 54321 };
    writeEpochRecord({ supervisorDir: inBandDir, record: inBandRecord });
    writeEpochRecord({ supervisorDir: outOfBandDir, record: outOfBandRecord });

    const result = await reapOrphanedInstances({
      stateDir,
      viceBin: "/bin/sleep",
      basePort: 6600,
      listProcesses: () => [],
      epochPathFor,
      nextEpochFor,
      writeEpochRecord,
    });

    assert.equal(result.found, 0);
    assert.equal(result.killed, 0);

    const inBandAfter = JSON.parse(readFileSync(join(inBandDir, "epoch.json"), "utf8"));
    const outOfBandAfter = JSON.parse(readFileSync(join(outOfBandDir, "epoch.json"), "utf8"));
    assert.equal(inBandAfter.epoch, 4, "the in-band directory's epoch must advance by exactly one, even with no in-memory record of it");
    assert.equal(outOfBandAfter.epoch, 5, "the out-of-band directory (below the band's base) must be left completely untouched");
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("reapOrphanedInstances: a reap that selects nothing still logs one line reporting zero found and zero killed", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "broker-kill-reap-zero-"));
  try {
    const lines: string[] = [];
    const result = await reapOrphanedInstances({
      stateDir,
      viceBin: "x64sc",
      basePort: 6600,
      listProcesses: () => [],
      epochPathFor,
      nextEpochFor,
      writeEpochRecord,
      log: (line) => lines.push(line),
    });
    assert.deepEqual(result, { found: 0, killed: 0 });
    assert.equal(lines.length, 1, "exactly one summary log line must be emitted, even when nothing was found");
    assert.match(lines[0], /found 0/);
    assert.match(lines[0], /terminated 0/);
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("structural: the real broker's startup reap runs before its control listener accepts (source-order check, complementing the live end-to-end shutdown tests above)", () => {
  const source = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  const reapIdx = source.indexOf("await reapOrphanedInstances(");
  const listenerIdx = source.indexOf("listener = await startControlListener(");
  assert.ok(reapIdx !== -1 && listenerIdx !== -1);
  assert.ok(reapIdx < listenerIdx);
});

// ----------------------------------------------------------------------------
// Structural gate (D-10/D-11, 01.6.2.1-05-PLAN.md), companion to the banner
// test above -- neither retired environment-variable name (banner: VICE_BROKER_SPARES) nor the other retired name (the discovery record's
// old floor-field name, one word run together with an underscore) may
// survive anywhere in tracked, NON-TEST TypeScript under .claude/mcp/vice/,
// except startupBanner()'s own function body (checked immediately below),
// so the clean break cannot be silently re-softened by a stray fallback
// read or a half-done field rename landing later. Comment-stripped (the
// same block-comment-aware technique broker-control.test.ts's own
// structural gates already established, reused here rather than
// re-derived) and scoped to source files only -- resources/ is generated
// output, never hand-edited, and is excluded by construction.
//
// The retired FIELD name is deliberately never spelled as one contiguous
// token anywhere in this gate's own source (built via string
// concatenation below) -- unlike the retired ENV VAR name, it has no
// banner exception at all, so this gate's own source must not be a hit
// against itself.
//
// Deliberately excludes *.test.ts: a test file legitimately names the
// retired variable as a STRING to exercise it (this gate's own source must
// be able to search for it; the banner test above sets and deletes it to
// prove the banner's two branches) -- neither is a "consumer reads the
// retired variable" risk, which is what this gate exists to catch. The
// non-test acceptance criteria (grep for a comment-stripped read of the
// value in broker-launch.mts/vice-broker.mts) already cover the production
// read sites directly; this gate is the broader, regression-proof net over
// every OTHER non-test module.
// ----------------------------------------------------------------------------

function stripCommentsForRetiredNameGate(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function walkTrackedNonTestSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (dirent.name === "resources" || dirent.name === "node_modules") continue;
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...walkTrackedNonTestSourceFiles(abs));
    } else if ((dirent.name.endsWith(".mts") || dirent.name.endsWith(".ts")) && !dirent.name.endsWith(".test.ts")) {
      out.push(abs);
    }
  }
  return out;
}

const RETIRED_ENV_VAR_NAME = "VICE_BROKER_SPARES"; // banner: this gate's own reference to the retired variable's name
const RETIRED_RECORD_FIELD_NAME = "spares" + "_target"; // constructed, not literal -- see header comment above

test("structural: neither the retired env var name nor the retired discovery-record field name survives anywhere in tracked, non-test TypeScript under .claude/mcp/vice/, except inside startupBanner()'s own function body (D-10/D-11)", () => { // banner
  const files = walkTrackedNonTestSourceFiles(HERE);
  const retiredNames = [RETIRED_ENV_VAR_NAME, RETIRED_RECORD_FIELD_NAME];
  const violations: string[] = [];
  let sawBannerException = false;

  for (const file of files) {
    const rel = file.slice(HERE.length + 1);
    const raw = readFileSync(file, "utf8");
    const stripped = stripCommentsForRetiredNameGate(raw);

    // The ONE explicitly-allowed exception is named by REGION, not by a
    // loose per-file or magic-count exemption: startupBanner()'s own
    // function body (broker-kill.mts only) may reference the retired
    // variable's NAME -- it reports presence, never reads the value -- but
    // nothing OUTSIDE that region may, in this file or any other.
    let bannerRegionStripped = "";
    if (rel === "broker-kill.mts") {
      const startMarker = "export function startupBanner(): string {";
      const endMarker = "export interface ProcessListEntry";
      const startIdx = raw.indexOf(startMarker);
      const endIdx = raw.indexOf(endMarker, startIdx + startMarker.length);
      assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx, "startupBanner()'s own region markers must both be found, in order");
      bannerRegionStripped = stripCommentsForRetiredNameGate(raw.slice(startIdx, endIdx));
    }

    for (const name of retiredNames) {
      const totalCount = stripped.split(name).length - 1;
      if (totalCount === 0) continue;
      const inBannerRegionCount = bannerRegionStripped ? bannerRegionStripped.split(name).length - 1 : 0;
      if (inBannerRegionCount > 0) sawBannerException = true;
      const outsideBannerCount = totalCount - inBannerRegionCount;
      if (outsideBannerCount > 0) {
        violations.push(`${rel}: ${name} (${outsideBannerCount}x outside startupBanner()'s own region)`);
      }
    }
  }

  assert.ok(sawBannerException, "startupBanner()'s own region must actually contain the retired variable's name -- if this is false, the banner itself regressed");
  assert.deepEqual(violations, [], `no retired name may survive outside startupBanner()'s own region, found: ${JSON.stringify(violations)}`);
});
