// vice-broker-launch.test.ts
//
// Covers the emitted resources/vice-broker.mjs directly, under bare `node`
// with no node_modules resolvable, plus the hand-authored launcher's flag
// surface. Phase 01.6.2: the broker stopped being a write-once tracer and
// became a LONG-LIVED process (a TCP control listener), so every
// success-path test below spawns it asynchronously, polls to a deadline for
// its `vice-broker: ready` stderr line, then kills it -- a bare
// synchronous spawnSync() would simply hang, since the process never exits
// on its own. Only the error paths (a malformed invocation, the container
// guard's own refusal) still exit quickly enough for spawnSync().
//
// This is a .ts file (not .mts): it tests emitted OUTPUT and authored
// TypeScript, never imports a .mjs module itself (the convention this group
// establishes, per 01.6-01-PLAN.md's planning_notes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, execFile, type ChildProcess } from "node:child_process";
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { HOST_BOUND_ARTIFACTS } from "./build.ts";

const execFileP = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");
const LAUNCHER = join(HERE, "resources", "vice-launcher.sh");
// Imported by a FRESH child process below, never by this test file itself
// (this file's own header says it never imports a .mjs module -- a child
// process importing the .mts source directly keeps that true).
const BROKER_HOME_MODULE_URL = new URL("./broker-home.mts", import.meta.url).href;

// The four container-guard tests below hand their spawned process ONE
// simulated container signal instead of inheriting one ambiently. The only
// thing that used to supply this signal was a CI job declaring itself a
// container on a machine that was a host -- that mislabelling routed every
// host-side invocation in that job to a control plane with no broker behind
// it, broke its first substantive step, and skipped every step behind it for
// months. An ambient source must not be reintroduced. Injecting one signal
// is all the guard needs to prove itself: containerGuardEnforce()/
// containerGuardReport() refuse on ANY signal firing. The injected value is
// this file's own directory precisely BECAUSE it contains
// resources/vice-launcher.sh, so the launcher's repo-root resolution takes
// its first branch and emits no fallback warning -- a synthetic path outside
// the tree would still produce the right exit code but would print a
// resolution note that means nothing to a reader of the log.
const SIMULATED_CONTAINER_ENV = { CONTAINER_WORKSPACE_PATH: HERE };

/** Copies EVERY emitted host-bound artifact (the broker plus its sibling
 * .mjs modules -- container-guard.mjs, broker-state.mjs, etc.) into a fresh
 * temp directory with nothing else in it -- in particular, no node_modules
 * anywhere on its ancestor chain up to /tmp, so Node's own module
 * resolution has nothing to find even if an emitted file accidentally
 * imported a bare specifier. The broker's own relative sibling imports
 * (./container-guard.mjs etc.) still resolve, since every sibling is
 * copied alongside it -- this is the SAME deploy shape
 * install-resources.ts produces on a real host.
 *
 * Also copies `prerequisites.json` (Plan 60-05 fix, found by this exact
 * test file's own real-process failures during the required full-suite
 * baseline diff): `resolveTool()`'s `readDeclaration()` locates the
 * declaration "beside `here`" or one directory up from wherever the
 * compiled module actually runs, and once `vice-broker.mts` started
 * resolving `x64sc` through the seam at startup (Plan 60-01), a
 * deployment with no copy of `prerequisites.json` anywhere near it makes
 * `readDeclaration()` throw before the broker ever binds its listener.
 * `install-resources.ts`'s own real deploy walks the WHOLE `resources/`
 * directory (not just `HOST_BOUND_ARTIFACTS`), so a committed
 * `resources/prerequisites.json` (build.ts now copies it there) already
 * reaches a real host; this helper must copy it too or its simulation
 * stops matching the real deploy shape it claims to be. */
function freshDeployDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "vice-broker-launch-"));
  for (const rel of HOST_BOUND_ARTIFACTS) {
    copyFileSync(join(HERE, "resources", rel), join(dir, rel));
  }
  copyFileSync(join(HERE, "resources", "prerequisites.json"), join(dir, "prerequisites.json"));
  return dir;
}

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

// Never let a broker spawned by this file launch a REAL emulator. Inside the
// devcontainer the container guard refuses to launch at all, so this file's
// brokers never reached a spawn; on a bare host the guard correctly PERMITS
// launching and the broker's default VICE_BIN resolves to `x64sc`, so running
// this suite outside the container spawned actual VICE processes that blocked
// the run and outlived it.
//
// The stub is a UNIQUE per-run path, deliberately NOT the bare "/bin/sleep"
// broker-e2e.test.ts uses. HISTORICAL NOTE (closed by 02-03-PLAN.md/D-15):
// the startup reap used to select kill targets by scanning every host
// process's own argument string for a plain substring match on the
// configured emulator binary path, paired only with a port-band check --
// a short, ubiquitous identity like "/bin/sleep" could therefore let a
// broker started by this suite SIGTERM/SIGKILL an unrelated process on a
// developer's host.
// The reap is now driven entirely by this broker's own on-disk allocation
// record (broker-kill.mts's reapOrphanedInstances()), so that specific
// hazard no longer exists -- the unique stub path is kept anyway as
// standing hygiene: a unique path under this run's own temp dir still
// cannot collide with anything else on the host, by construction.
const STUB_DIR = mkdtempSync(join(tmpdir(), "vice-broker-launch-stubbin-"));
const STUB_VICE_BIN = join(STUB_DIR, "x64sc-test-stub");
writeFileSync(STUB_VICE_BIN, "#!/bin/sh\nexec sleep \"${1:-600}\"\n", { mode: 0o755 });
// Every deployDir in this file is rmSync'd in its own finally; STUB_DIR is
// created once at module load, so it needs a process-level cleanup or it leaves
// a vice-broker-launch-stubbin-* directory behind on every run.
//
// LIMITATION, deliberate: "exit" does not fire when this process is SIGTERM'd,
// which is how a stalled run of this file actually ends today. A SIGTERM handler
// would cover that, but registering one SUPPRESSES Node's default
// terminate-on-SIGTERM behaviour (see vice-proxy.test.ts's own header on this
// exact trap), so a stalled file would then only die to SIGKILL. Leaking a
// couple of empty temp dirs from killed runs is the better trade.
process.on("exit", () => {
  rmSync(STUB_DIR, { recursive: true, force: true });
});

const VICE_BIN_STUB: Record<string, string> = { VICE_BIN: STUB_VICE_BIN, VICE_ARGS: "600" };

/** Runs the deployed artifact SYNCHRONOUSLY under a bare `node` invocation --
 * only valid for a code path that exits promptly on its own (parseArgs
 * failure, or the container guard's refusal). Never use this for a code path that reaches the
 * control listener; it would hang. */
function runBrokerSync(deployDir: string, args: string[], env: Record<string, string> = {}): RunResult {
  const result = spawnSync(process.execPath, [join(deployDir, "vice-broker.mjs"), ...args], {
    cwd: deployDir,
    encoding: "utf8",
    env: { ...process.env, ...VICE_BIN_STUB, ...env },
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/** Runs the deployed artifact ASYNCHRONOUSLY -- for the long-lived success
 * path, which never exits on its own. The caller must stopBroker() it. */
function runBrokerAsync(deployDir: string, args: string[], env: Record<string, string> = {}): { child: ChildProcess; getStderr: () => string } {
  const child = spawn(process.execPath, [join(deployDir, "vice-broker.mjs"), ...args], {
    cwd: deployDir,
    env: { ...process.env, ...VICE_BIN_STUB, ...env },
  });
  let stderr = "";
  child.stderr?.on("data", (d: Buffer) => {
    stderr += d.toString("utf8");
  });
  return { child, getStderr: () => stderr };
}

async function waitFor(predicate: () => boolean, deadlineMs: number, pollMs = 25): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return predicate();
}

async function stopBroker(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = await waitFor(() => child.exitCode !== null || child.signalCode !== null, 3000);
  if (!exited) child.kill("SIGKILL");
}

/** Waits for the broker's `vice-broker: ready` line, then returns the state
 * directory it reported on its `vice-broker: state directory:` line (printed
 * before the ready line). */
async function waitForReportedStateDir(getStderr: () => string, deadlineMs = 5000): Promise<string> {
  const ready = await waitFor(() => /vice-broker: ready \(/.test(getStderr()), deadlineMs);
  assert.ok(ready, `the broker's ready line did not appear within deadline; stderr so far: ${getStderr()}`);
  const match = /vice-broker: state directory: (.+)\n/.exec(getStderr());
  assert.ok(match, `the broker must report its state directory on stderr; stderr: ${getStderr()}`);
  return match[1];
}

/** Computes brokerStateDir() in a FRESH child `node` process that imports
 * broker-home.mts directly -- the SAME resolver a real client process uses
 * for its lease's supervisor directory, never this test file's own
 * already-imported modules (Phase 64, plan 64-10, G-64-1's route-agreement
 * proof). `env` should be the SAME env the sibling broker under test was
 * spawned with, so the two sides answer under identical configuration. */
async function clientBrokerStateDir(env: Record<string, string | undefined>): Promise<string> {
  const nodeSrc = `
    import { brokerStateDir } from ${JSON.stringify(BROKER_HOME_MODULE_URL)};
    console.log(brokerStateDir());
  `;
  const { stdout } = await execFileP(process.execPath, ["--input-type=module", "-e", nodeSrc], {
    env: { ...process.env, ...env },
  });
  const lines = stdout.trim().split("\n").filter(Boolean);
  return lines[lines.length - 1];
}

test("emitted artifact starts a LONG-LIVED broker: prints its ready line naming the host's node and the defaults, and binds a control listener on loopback (D-09)", async () => {
  const deployDir = freshDeployDir();
  const { child, getStderr } = runBrokerAsync(
    deployDir,
    ["--repo-root", "/tmp/fake-repo-root", "--state-dir", join(deployDir, "state")],
    { VICE_SUPERVISOR_ALLOW_CONTAINER: "1", VICE_BROKER_CONTROL_PORT: "0" },
  );
  try {
    const pattern = /vice-broker: ready \(node (\S+) at (.+), max (\d+) instances, base port (\d+), poll (\d+)ms\); control listener bound on (\S+):(\d+)\n/;
    const appeared = await waitFor(() => pattern.test(getStderr()), 5000);
    assert.ok(appeared, `the ready line did not appear within deadline; stderr so far: ${getStderr()}`);
    const [, nodeVersion, nodeExecPath, maxInstances, basePort, pollMs, host, port] = pattern.exec(getStderr())!;
    assert.equal(nodeVersion, process.version, "the ready line must carry the HOST's own process.version");
    assert.equal(
      nodeExecPath,
      process.execPath,
      "the ready line must carry the HOST's own process.execPath, so a triage session can tell which of several installed interpreters this broker ran under",
    );
    assert.equal(Number(maxInstances), 16, "default instance ceiling");
    assert.equal(Number(basePort), 6600, "default base port, D-18");
    assert.equal(Number(pollMs), 500, "default poll interval");
    assert.equal(host, "127.0.0.1", "the control listener must be bound on the loopback address (D-09), never the wildcard address");
    assert.ok(Number(port) > 0);
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
  }
});

// D-13/BROKER-01/BROKER-06: "missing --repo-root" used to be a malformed
// invocation on its own -- the per-project binding had no fallback, so
// parseArgs() refused with a usage line whenever no project was named. It
// has one now. The genuinely malformed cases (an unrecognised argument, or a
// flag missing its value) still refuse; "no project was named" no longer
// does.

test("an unrecognised flag still exits non-zero with a usage line -- the refusal was narrowed, not removed", () => {
  const deployDir = freshDeployDir();
  try {
    const result = runBrokerSync(deployDir, ["--not-a-real-flag"], { VICE_SUPERVISOR_ALLOW_CONTAINER: "1" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /usage:/);
  } finally {
    rmSync(deployDir, { recursive: true, force: true });
  }
});

test("a flag that takes a value but has none following it still exits non-zero with a usage line", () => {
  const deployDir = freshDeployDir();
  try {
    const result = runBrokerSync(deployDir, ["--state-dir"], { VICE_SUPERVISOR_ALLOW_CONTAINER: "1" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /usage:/);
  } finally {
    rmSync(deployDir, { recursive: true, force: true });
  }
});

// The four state-directory precedence steps (D-13's extension adds the
// fourth; the first three must resolve to the EXACT SAME directory they did
// before this plan). parseArgs() itself cannot be unit-tested by importing
// vice-broker.mts directly from a .test.ts -- its sibling ".mjs" imports
// (./container-guard.mjs etc.) only exist beside the COMPILED artifact under
// resources/, not beside the .mts source -- so each step is proven the same
// way every other real-behaviour test in this file is: spawn the emitted
// artifact and read the state directory it reports on stderr.

test("precedence 1: an explicit --state-dir wins even when VICE_POOL_DIR is ALSO set, exactly as today", async () => {
  const deployDir = freshDeployDir();
  const explicitStateDir = join(deployDir, "explicit-state-dir");
  const decoyPoolDir = join(deployDir, "decoy-pool-dir-must-not-be-used");
  const { child, getStderr } = runBrokerAsync(
    deployDir,
    ["--repo-root", "/tmp/fake-repo-root", "--state-dir", explicitStateDir],
    { VICE_SUPERVISOR_ALLOW_CONTAINER: "1", VICE_BROKER_CONTROL_PORT: "0", VICE_POOL_DIR: decoyPoolDir },
  );
  try {
    const stateDir = await waitForReportedStateDir(getStderr);
    assert.equal(stateDir, explicitStateDir, "the EXPLICIT --state-dir must be the state directory");
    assert.ok(!existsSync(decoyPoolDir), "VICE_POOL_DIR must be ignored when --state-dir is explicit");
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
  }
});

test("precedence 2: VICE_POOL_DIR wins when no --state-dir is given, exactly as today", async () => {
  const deployDir = freshDeployDir();
  const poolDir = join(deployDir, "pool-dir");
  const { child, getStderr } = runBrokerAsync(deployDir, ["--repo-root", "/tmp/fake-repo-root"], {
    VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
    VICE_BROKER_CONTROL_PORT: "0",
    VICE_POOL_DIR: poolDir,
  });
  try {
    const stateDir = await waitForReportedStateDir(getStderr);
    assert.equal(stateDir, poolDir, "VICE_POOL_DIR must be the state directory itself (no --state-dir given)");
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
  }
});

test("precedence 3 INVERTED (Phase 64, plan 64-10, G-64-1): --repo-root alone (no --state-dir, no VICE_POOL_DIR) no longer selects a project-relative directory -- the state directory is under the machine-level root instead, and nothing is created under the project", async () => {
  const deployDir = freshDeployDir();
  const projectRoot = mkdtempSync(join(tmpdir(), "vice-broker-launch-project-root-"));
  // A scratch HOME -- never this developer's real one, which the default
  // (no VICE_BROKER_HOME) would otherwise resolve to now that --repo-root no
  // longer pins the state directory into the project.
  const machineHome = mkdtempSync(join(tmpdir(), "vice-broker-launch-machine-home-"));
  const { child, getStderr } = runBrokerAsync(deployDir, ["--repo-root", projectRoot], {
    VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
    VICE_BROKER_CONTROL_PORT: "0",
    HOME: machineHome,
  });
  try {
    const expected = join(machineHome, ".c64-re-tools", "supervisor");
    const stateDir = await waitForReportedStateDir(getStderr);
    assert.equal(stateDir, expected, "the state directory must be under the machine-level root, not under --repo-root's project");
    assert.ok(
      !existsSync(join(projectRoot, ".c64-re-tools", "supervisor")),
      "no project's .c64-re-tools/supervisor/ may receive broker state from any start route (BROKER-06)",
    );
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(machineHome, { recursive: true, force: true });
  }
});

test("no project argument and no state-directory argument starts the broker under the machine-level root, rather than printing the usage refusal (D-13)", async () => {
  const deployDir = freshDeployDir();
  // VICE_BROKER_HOME points brokerStateDir()'s machine-level fallback at a
  // throwaway temp directory for this test run -- never at this
  // developer's REAL home directory, which the default (no override) would
  // otherwise resolve to.
  const machineHome = mkdtempSync(join(tmpdir(), "vice-broker-launch-machine-home-"));
  const { child, getStderr } = runBrokerAsync(deployDir, [], {
    VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
    VICE_BROKER_CONTROL_PORT: "0",
    VICE_BROKER_HOME: machineHome,
  });
  try {
    const stateDir = await waitForReportedStateDir(getStderr);
    assert.equal(stateDir, join(machineHome, "supervisor"), "the state directory must be under the machine-level root");
    assert.doesNotMatch(getStderr(), /usage:/, "starting with no project argument must never print the usage refusal");
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
    rmSync(machineHome, { recursive: true, force: true });
  }
});

// ------------------------------------------------ route agreement (G-64-1)
//
// Task 1 (Phase 64, plan 64-10): the whole reason this plan exists. Proves
// that for each documented start route, a REAL broker process and the
// client's OWN resolver (a fresh child process importing broker-home.mts)
// land on the exact same state directory, with nothing configured on either
// side beyond the route's own argv. Every
// spawned broker here runs under a scratch HOME -- never this developer's
// real one, which the default (no VICE_BROKER_HOME) would otherwise resolve
// to.

/** Spawns a real broker for one documented route (`argv`/`testEnv`),
 * compares the state directory it reports with the CLIENT's own computed
 * one, and optionally asserts a project-local path was never created.
 * `testEnv` is passed identically to both the broker (via runBrokerAsync)
 * and the client child process (via clientBrokerStateDir) so the two sides
 * answer under the SAME configuration -- the whole point of a
 * route-agreement proof. */
async function assertRouteAgreement(
  label: string,
  argv: string[],
  extraEnv: Record<string, string>,
  assertProjectUntouched?: string,
): Promise<void> {
  const deployDir = freshDeployDir();
  const homeDir = mkdtempSync(join(tmpdir(), "vice-broker-launch-route-home-"));
  const testEnv: Record<string, string> = {
    VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
    VICE_BROKER_CONTROL_PORT: "0",
    HOME: homeDir,
    ...extraEnv,
  };
  const { child, getStderr } = runBrokerAsync(deployDir, argv, testEnv);
  try {
    const clientDir = await clientBrokerStateDir(testEnv);
    const brokerDir = await waitForReportedStateDir(getStderr);
    assert.equal(brokerDir, clientDir, `${label}: the broker's state directory must be the client's own resolved one`);
    if (assertProjectUntouched) {
      assert.ok(
        !existsSync(assertProjectUntouched),
        `${label}: nothing may be created under the project's own tree (${assertProjectUntouched})`,
      );
    }
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
    rmSync(homeDir, { recursive: true, force: true });
  }
}

test("route agreement: no project argument (npx broker / systemd unit / launchd agent) -- broker and client resolve the SAME state directory under a scratch HOME, no override (G-64-1)", async () => {
  await assertRouteAgreement("no-argument route", [], {});
});

test("route agreement: --repo-root <project> (vice-launcher.sh) -- broker and client STILL resolve the SAME machine-level state directory, and nothing is created under the project (G-64-1)", async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "vice-broker-launch-project-root-"));
  try {
    await assertRouteAgreement("--repo-root route", ["--repo-root", projectRoot], {}, join(projectRoot, ".c64-re-tools", "supervisor"));
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("route agreement, VICE_BROKER_HOME variant: the no-argument route and the client agree on <VICE_BROKER_HOME>/supervisor (G-64-1)", async () => {
  const brokerHome = mkdtempSync(join(tmpdir(), "vice-broker-launch-broker-home-"));
  try {
    await assertRouteAgreement("no-argument route, VICE_BROKER_HOME set", [], { VICE_BROKER_HOME: brokerHome });
  } finally {
    rmSync(brokerHome, { recursive: true, force: true });
  }
});

test("route agreement, VICE_BROKER_HOME variant: the --repo-root route and the client STILL agree on <VICE_BROKER_HOME>/supervisor, and nothing is created under the project (G-64-1)", async () => {
  const brokerHome = mkdtempSync(join(tmpdir(), "vice-broker-launch-broker-home-"));
  const projectRoot = mkdtempSync(join(tmpdir(), "vice-broker-launch-project-root-"));
  try {
    await assertRouteAgreement(
      "--repo-root route, VICE_BROKER_HOME set",
      ["--repo-root", projectRoot],
      { VICE_BROKER_HOME: brokerHome },
      join(projectRoot, ".c64-re-tools", "supervisor"),
    );
  } finally {
    rmSync(brokerHome, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

// -------------------------------------------------------- container guard
//
// The guard runs at the BROKER PROCESS's own startup (not only inside the
// launcher's shell wrapper) -- these two exercise the emitted artifact
// DIRECTLY, bypassing vice-launcher.sh entirely, closing the
// invocation-scoped hole found on 2026-08-03. Each case
// hands its own process SIMULATED_CONTAINER_ENV rather than relying on an
// ambient signal, so it runs identically on a bare host and on a CI runner.

test("running the emitted broker artifact directly (no launcher) with the container signal injected and no escape hatch, exits 2 and names the fired signals", () => {
  const deployDir = freshDeployDir();
  try {
    const result = runBrokerSync(deployDir, ["--repo-root", "/tmp/fake-repo-root", "--state-dir", join(deployDir, "state")], SIMULATED_CONTAINER_ENV);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /FATAL: vice-broker refuses to run inside a container/);
    assert.match(result.stderr, /Signals that fired/);
  } finally {
    rmSync(deployDir, { recursive: true, force: true });
  }
});

test("running the emitted broker artifact directly (no launcher) with the container signal injected and --check-container exits 3 and prints one report line per signal", () => {
  const deployDir = freshDeployDir();
  try {
    const result = runBrokerSync(deployDir, ["--check-container"], SIMULATED_CONTAINER_ENV);
    assert.equal(result.status, 3);
    assert.match(result.stderr, /verdict: CONTAINER/);
  } finally {
    rmSync(deployDir, { recursive: true, force: true });
  }
});

// --------------------------------------------------------------- launcher

test("bash -n exits 0 for the launcher (syntax check only, no execution)", () => {
  const result = spawnSync("bash", ["-n", LAUNCHER], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("running the launcher with the container signal injected exits 2 (container guard refusal, now answered by the Node entry point)", () => {
  const result = spawnSync(LAUNCHER, [], { encoding: "utf8", env: { ...process.env, ...SIMULATED_CONTAINER_ENV } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /refuses to run inside a container/);
});

test("running the launcher with the container signal injected and --check-container exits 3 (container verdict, reporting only, now answered by the Node entry point)", () => {
  const result = spawnSync(LAUNCHER, ["--check-container"], { encoding: "utf8", env: { ...process.env, ...SIMULATED_CONTAINER_ENV } });
  assert.equal(result.status, 3);
});

test("running the launcher with --print-paths exits 0 and prints resolved paths without enforcing the guard", () => {
  const result = spawnSync(LAUNCHER, ["--print-paths"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^repo_root=/m);
  assert.match(result.stdout, /^self_dir=/m);
  assert.match(result.stdout, /^broker_artifact=/m);
});

test("the launcher no longer sources or references the bash container-guard module", () => {
  const text = readFileSync(LAUNCHER, "utf8");
  assert.equal((text.match(/container-guard\.sh/g) ?? []).length, 0);
});

// --------------------------------------------------------- structural scan
//
// Mirrors vice-proxy.test.ts's own structural network-call scan idiom:
// directory-enumerating, not scoped to a hand-maintained list, so a future
// addition to the host-bound source set is covered the moment it lands on
// disk.
//
// AMENDED, Phase 01.6.2 plan 01: this scan used to assert that NO host-bound
// source contains a network-call construct at all. That blanket rule breaks
// the moment this phase's control listener, its readiness probe and its
// port-in-use check exist -- all three are network-call constructs BY
// DESIGN, because the broker is the HOST-SIDE process that OWNS the
// emulator's lifecycle (the bash daemon it replaces already both listened
// for readiness and probed ports). The hard rule this scan protects is
// narrower than "no network calls anywhere": it is "no CONTAINER-SIDE code
// reaches the emulator outside mcp__vice__*". A host-bound broker module
// opening a TCP listener is not that violation; it is the module the whole
// module tree defers coordination TO.
//
// This is now a per-file JUSTIFIED ALLOWLIST: every host-bound source (the
// build's own HOST_BOUND_ARTIFACTS set, converted back to its .mts source,
// plus the launcher) is enumerated, and any file containing a network-call
// construct MUST have an explicit entry below naming why. A new host-bound
// file with no entry here, and no network-call construct, still passes
// silently -- only a network-call construct with NO justification fails.
const NETWORK_CALL_PATTERNS: RegExp[] = [
  /\bfetch\s*\(/,
  /\.request\s*\(/,
  /\bcreateConnection\s*\(/,
  /\bcreateServer\s*\(/,
  /new\s+WebSocket\s*\(/,
  /require\(\s*["']node:(?:http|https|net|dgram|tls)["']\s*\)/,
  /from\s+["']node:(?:http|https|net|dgram|tls)["']/,
];

/** relative-to-HERE source path -> why it is allowed to contain a
 * network-call construct. Every other host-bound source (and the launcher)
 * must remain network-free -- mcp__vice__* stays the only route to the
 * emulator FOR CONTAINER-SIDE CODE. */
const JUSTIFIED_NETWORK_CALLERS: Record<string, string> = {
  "broker-control.mts":
    "N/D-01: this IS the control listener (createServer) -- the host-side broker's own TCP acceptor. The broker owns the emulator's lifecycle; this is not container-side code reaching the emulator.",
  "broker-state.mts":
    "Plan 02, C4: defaultPortInUse() binds-and-releases a candidate port on 127.0.0.1 to answer 'is a TCP listener already bound here' for the broker's OWN port allocator (never a readiness check against the emulator itself). Host-side broker code inspecting its own host's ports; not container-side code reaching the emulator.",
  "broker-launch.mts":
    "D-05's permitted-route note, as amended by P-05 (Phase 01.6.2.1 plan 02): probeReady() is now a single in-process mechanism -- a POST against the instance's own /mcp endpoint using the global fetch, matching vice-broker.sh's own curl-based probe_ready(). This is host-side broker code owning the emulator's lifecycle (it already probes today, per RESEARCH.md D-05) -- not container-side code reaching the emulator outside mcp__vice__*.",
  "broker-relay.mts":
    "Phase 63, plan 63-01 (SESS-02): this IS the byte-transparent splice -- the one module whose entire purpose is dialling the emulator's binary/text monitor socket (net.connect) and joining it to a relay connection with Socket.prototype.pipe(). This is host-side broker code owning the emulator's lifecycle (the SAME role broker-control.mts's own justification above already covers for its acceptor half); not container-side code reaching the emulator outside mcp__vice__*.",
  "vice-broker.mts":
    "Phase 63, plan 63-01 (SESS-02): a type-only `import type { Socket } from \"node:net\"` for handleRelayAttach()'s own `clientSocket` parameter -- this pattern set matches on the import SPECIFIER textually, not on whether the import is type-only. handleRelayAttach() itself never dials anything (spliceRelay(), in the already-justified broker-relay.mts, is the one call site that does); this file only resolves the emulator host/port and hands the already-accepted socket onward.",
  "broker-endpoint.mts":
    "v2.0.0 step 1: the CLIENT side of the fixed broker endpoint (net.connect to 127.0.0.1, then host.docker.internal, on the broker's own control port) -- it dials the broker, never the emulator. It is compiled into resources/ only so skill scripts can load it from node_modules, where Node never strips types; it runs in the caller's process, not the broker's.",
  "broker-transfer.mts":
    "Phase 64, plan 64-01 (D-01/D-02/D-04): a type-only `import type { Socket } from \"node:net\"` for sendPayloadFromFile()'s and receivePayloadToFile()'s own `socket` parameter -- this module never dials a connection or opens a listener itself (no createConnection/createServer call site anywhere in it); it streams an already-established transfer connection's bytes through pipeline(), the same host-side-broker-owns-the-emulator's-lifecycle role broker-relay.mts's own justification above already covers for the relay splice.",
};

test("structural: every host-bound source containing a network-call construct carries an explicit justification; the launcher stays network-free", () => {
  const sourcePaths = [...HOST_BOUND_ARTIFACTS.map((rel) => join(HERE, rel.replace(/\.mjs$/, ".mts"))), LAUNCHER];
  assert.ok(sourcePaths.length >= 2, "host-bound source set enumerated as suspiciously small -- resolution is broken");

  const unjustifiedOffenders: string[] = [];
  for (const path of sourcePaths) {
    const text = readFileSync(path, "utf8");
    const rel = join(HERE, "").length && path.startsWith(HERE) ? path.slice(HERE.length + 1) : path;
    const hasNetworkCall = NETWORK_CALL_PATTERNS.some((p) => p.test(text));
    if (hasNetworkCall && !(rel in JUSTIFIED_NETWORK_CALLERS)) {
      unjustifiedOffenders.push(rel);
    }
  }
  assert.deepEqual(
    unjustifiedOffenders,
    [],
    `host-bound source contains an UNJUSTIFIED network-call construct: ${JSON.stringify(unjustifiedOffenders)} -- ` +
      "container-side code reaching the emulator outside mcp__vice__* is the violation this scan protects against; " +
      "a host-side broker module owning the emulator's lifecycle is not. Add a named justification to " +
      "JUSTIFIED_NETWORK_CALLERS if this addition is deliberate.",
  );

  // The launcher itself must NEVER be justified -- it stays network-free by
  // construction (it only execs node).
  assert.ok(!("resources/vice-launcher.sh" in JUSTIFIED_NETWORK_CALLERS));
  assert.equal(NETWORK_CALL_PATTERNS.some((p) => p.test(readFileSync(LAUNCHER, "utf8"))), false, "the launcher must remain network-free");
});
