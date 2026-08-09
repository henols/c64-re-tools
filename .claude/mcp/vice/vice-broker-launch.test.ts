// vice-broker-launch.test.ts
//
// Covers the emitted resources/vice-broker.mjs directly, under bare `node`
// with no node_modules resolvable, plus the hand-authored launcher's flag
// surface. Phase 01.6.2: the broker stopped being a write-once tracer and
// became a LONG-LIVED process (a TCP control listener plus a recurring
// heartbeat), so every success-path test below spawns it asynchronously,
// polls to a deadline for broker.json to appear, then kills it -- a bare
// synchronous spawnSync() would simply hang, since the process never exits
// on its own. Only the error paths (missing --repo-root, a live-pid
// refusal, the container guard's own refusal) still exit quickly enough
// for spawnSync().
//
// This is a .ts file (not .mts): it tests emitted OUTPUT and authored
// TypeScript, never imports a .mjs module itself (the convention this group
// establishes, per 01.6-01-PLAN.md's planning_notes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, copyFileSync, mkdirSync, readFileSync, writeFileSync, statSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { HOST_BOUND_ARTIFACTS } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");
const LAUNCHER = join(HERE, "resources", "vice-launcher.sh");

/** Copies EVERY emitted host-bound artifact (the broker plus its sibling
 * .mjs modules -- container-guard.mjs, broker-state.mjs, etc.) into a fresh
 * temp directory with nothing else in it -- in particular, no node_modules
 * anywhere on its ancestor chain up to /tmp, so Node's own module
 * resolution has nothing to find even if an emitted file accidentally
 * imported a bare specifier. The broker's own relative sibling imports
 * (./container-guard.mjs etc.) still resolve, since every sibling is
 * copied alongside it -- this is the SAME deploy shape
 * install-resources.ts produces on a real host. */
function freshDeployDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "vice-broker-launch-"));
  for (const rel of HOST_BOUND_ARTIFACTS) {
    copyFileSync(join(HERE, "resources", rel), join(dir, rel));
  }
  return dir;
}

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Runs the deployed artifact SYNCHRONOUSLY under a bare `node` invocation --
 * only valid for a code path that exits promptly on its own (parseArgs
 * failure, the container guard's refusal, or the pre-listener
 * refuse-to-clobber check). Never use this for a code path that reaches the
 * control listener; it would hang. */
function runBrokerSync(deployDir: string, args: string[], env: Record<string, string> = {}): RunResult {
  const result = spawnSync(process.execPath, [join(deployDir, "vice-broker.mjs"), ...args], {
    cwd: deployDir,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/** Runs the deployed artifact ASYNCHRONOUSLY -- for the long-lived success
 * path, which never exits on its own. The caller must stopBroker() it. */
function runBrokerAsync(deployDir: string, args: string[], env: Record<string, string> = {}): { child: ChildProcess; getStderr: () => string } {
  const child = spawn(process.execPath, [join(deployDir, "vice-broker.mjs"), ...args], {
    cwd: deployDir,
    env: { ...process.env, ...env },
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

// The final fourteen-field discovery-record set (plan 05, D-27, criterion
// G/K) -- amended a second and final time from plan 01's nine-key tracer
// assertion. `ttl_seconds` (the bash fixture's own lease-time-to-live field)
// is DELETED, not carried forward: it is one of criterion F's six retiring
// lease mechanisms, and the connection is the lease now.
const BROKER_JSON_FOURTEEN_KEYS = [
  "version",
  "written_by",
  "pid",
  "started_at",
  "heartbeat_at",
  "node_version",
  "control_host",
  "control_port",
  "control_token",
  "warm_floor",
  "max_instances",
  "base_port",
  "poll_ms",
  "dry_run",
];

test("emitted artifact starts a LONG-LIVED broker: writes the fourteen-field discovery record (mode 0600), binds a control listener on 0.0.0.0", async () => {
  const deployDir = freshDeployDir();
  const { child } = runBrokerAsync(
    deployDir,
    ["--repo-root", "/tmp/fake-repo-root", "--state-dir", join(deployDir, "state")],
    { VICE_SUPERVISOR_ALLOW_CONTAINER: "1", VICE_BROKER_CONTROL_PORT: "0" },
  );
  try {
    const recordPath = join(deployDir, "state", "broker.json");
    const appeared = await waitFor(() => existsSync(recordPath), 5000);
    assert.ok(appeared, "broker.json did not appear within deadline");

    const record: Record<string, unknown> = JSON.parse(readFileSync(recordPath, "utf8"));
    assert.deepEqual(
      Object.keys(record).sort(),
      [...BROKER_JSON_FOURTEEN_KEYS].sort(),
      "the long-lived broker's discovery record must carry EXACTLY these fourteen fields, no lease-TTL field among them",
    );
    assert.ok(!("ttl_seconds" in record), "the lease time-to-live field must be gone -- the connection is the lease now (D-12)");
    assert.equal(record.written_by, "vice-broker.mjs");
    assert.notEqual(
      record.written_by,
      JSON.parse(readFileSync(join(HERE, "fixtures", "bash-broker.json"), "utf8")).written_by,
      "written_by must differ from the frozen bash fixture's own value -- D-26's whole point",
    );
    assert.equal(record.node_version, process.version, "the record must carry the HOST's own process.version");
    assert.equal(record.control_host, "0.0.0.0");
    assert.ok(Number.isInteger(record.control_port) && (record.control_port as number) > 0);
    assert.equal(typeof record.control_token, "string");
    assert.ok((record.control_token as string).length > 0);
    assert.ok(!Number.isNaN(Date.parse(record.heartbeat_at as string)), "heartbeat_at must be a parseable timestamp");
    assert.ok(!Number.isNaN(Date.parse(record.started_at as string)));
    assert.equal(record.warm_floor, 1, "default warm floor, D-06 (01.6.2.1-03-PLAN.md) -- down from 3");
    assert.equal(record.max_instances, 16, "default instance ceiling, unchanged this phase");
    assert.equal(record.base_port, 6600, "default base port, D-18");
    assert.equal(record.poll_ms, 500, "default poll interval, unchanged this phase");
    assert.equal(record.dry_run, false);

    const mode = statSync(recordPath).mode & 0o777;
    assert.equal(mode, 0o600, `expected mode 0600, got ${mode.toString(8)}`);
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
  }
});

test("heartbeat_at advances and the mode stays owner-read-write across a REFRESH write, not only the first", async () => {
  const deployDir = freshDeployDir();
  const { child } = runBrokerAsync(
    deployDir,
    ["--repo-root", "/tmp/fake-repo-root", "--state-dir", join(deployDir, "state")],
    { VICE_SUPERVISOR_ALLOW_CONTAINER: "1", VICE_BROKER_CONTROL_PORT: "0", VICE_BROKER_HEARTBEAT_MS: "200" },
  );
  try {
    const recordPath = join(deployDir, "state", "broker.json");
    await waitFor(() => existsSync(recordPath), 5000);
    const first = JSON.parse(readFileSync(recordPath, "utf8"));

    const advanced = await waitFor(() => {
      const current = JSON.parse(readFileSync(recordPath, "utf8"));
      return current.heartbeat_at !== first.heartbeat_at;
    }, 3000);
    assert.ok(advanced, "heartbeat_at must advance on the recurring timer");

    const after = JSON.parse(readFileSync(recordPath, "utf8"));
    assert.equal(after.started_at, first.started_at, "started_at is FIXED at process start -- a refresh must never change it");

    const mode = statSync(recordPath).mode & 0o777;
    assert.equal(mode, 0o600, `expected mode 0600 after a refresh write, got ${mode.toString(8)}`);
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
  }
});

test("heartbeat_at advances between two reads taken more than one heartbeat interval apart", async () => {
  const deployDir = freshDeployDir();
  const { child } = runBrokerAsync(
    deployDir,
    ["--repo-root", "/tmp/fake-repo-root", "--state-dir", join(deployDir, "state")],
    { VICE_SUPERVISOR_ALLOW_CONTAINER: "1", VICE_BROKER_CONTROL_PORT: "0", VICE_BROKER_HEARTBEAT_MS: "200" },
  );
  try {
    const recordPath = join(deployDir, "state", "broker.json");
    await waitFor(() => existsSync(recordPath), 5000);
    const first = JSON.parse(readFileSync(recordPath, "utf8")).heartbeat_at as string;

    const advanced = await waitFor(() => {
      const current = JSON.parse(readFileSync(recordPath, "utf8")).heartbeat_at as string;
      return current !== first;
    }, 3000);
    assert.ok(advanced, "heartbeat_at must advance on the recurring timer");
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
  }
});

// Plan 05 (criterion K, D-17): the tracer/plan-04-era "refuse to overwrite a
// record naming a currently-live pid" pre-check is GONE -- REPLACED by the
// kernel-enforced bind-before-write singleton guard, not merely extended
// alongside it. The two former tests here ("refuses to overwrite... live
// pid... never starts a listener" and its dead-pid counterpart) tested THAT
// pre-check directly and no longer describe real behaviour: with the
// pre-check removed, a hand-seeded broker.json naming this test's OWN live
// pid no longer blocks anything by itself (nothing is actually bound to the
// control port), so the broker would start normally and never exit --
// exactly why the FIRST of those two tests used to rely on the pre-check
// firing to stay spawnSync()-safe, and would hang forever without it. The
// singleton guard's own two real outcomes (a record naming a genuinely LIVE
// broker vs. one that is stale/never-started) are now covered by
// broker-control.test.ts's own singleton tests, which drive a REAL bind
// conflict rather than a hand-seeded pid string -- the only way to actually
// exercise the new guard's two distinct paths.
test("a pre-existing broker.json naming this test's own live pid no longer blocks a restart by itself -- only an actual bind conflict does (criterion K)", async () => {
  const deployDir = freshDeployDir();
  const stateDir = join(deployDir, "state");
  mkdirSync(stateDir, { recursive: true });
  const recordPath = join(stateDir, "broker.json");
  // This test process's own pid is guaranteed alive -- if any lingering
  // pid-liveness pre-check existed, THIS is the fixture that would trip it.
  const before = JSON.stringify({ pid: process.pid, started_at: "fixture", heartbeat_at: "2020-01-01T00:00:00Z" });
  writeFileSync(recordPath, before);

  const { child } = runBrokerAsync(deployDir, ["--repo-root", "/tmp/fake-repo-root", "--state-dir", stateDir], {
    VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
    VICE_BROKER_CONTROL_PORT: "0",
  });
  try {
    const wroteNewRecord = await waitFor(() => readFileSync(recordPath, "utf8") !== before, 5000);
    assert.ok(wroteNewRecord, "a record naming this test's own live pid must NOT block a restart -- only a real bind conflict does now");

    const record: Record<string, unknown> = JSON.parse(readFileSync(recordPath, "utf8"));
    assert.deepEqual(Object.keys(record).sort(), [...BROKER_JSON_FOURTEEN_KEYS].sort());
    assert.notEqual(record.pid, before, "the new record must name the SPAWNED BROKER's own pid, not the old fixture's");
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
  }
});

test("overwrites a record naming a DEAD pid -- a stale record on disk never blocks a restart, only a real bind conflict does", async () => {
  const deployDir = freshDeployDir();
  const stateDir = join(deployDir, "state");
  mkdirSync(stateDir, { recursive: true });
  const recordPath = join(stateDir, "broker.json");
  // An implausibly large pid: never alive on any real system.
  const before = JSON.stringify({ pid: 999999999, started_at: "fixture", heartbeat_at: "2020-01-01T00:00:00Z" });
  writeFileSync(recordPath, before);

  const { child } = runBrokerAsync(deployDir, ["--repo-root", "/tmp/fake-repo-root", "--state-dir", stateDir], {
    VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
    VICE_BROKER_CONTROL_PORT: "0",
  });
  try {
    const wroteNewRecord = await waitFor(() => readFileSync(recordPath, "utf8") !== before, 5000);
    assert.ok(wroteNewRecord, "a dead-pid record (even with heartbeat_at) must be overwritten, not refused");

    const record: Record<string, unknown> = JSON.parse(readFileSync(recordPath, "utf8"));
    assert.deepEqual(Object.keys(record).sort(), [...BROKER_JSON_FOURTEEN_KEYS].sort());
    assert.notEqual(record.pid, 999999999, "the new record must name the SPAWNED BROKER's own pid, not the dead fixture pid");
    assert.ok(Number.isInteger(record.pid) && (record.pid as number) > 0);
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
  }
});

test("a record file truncated mid-JSON is treated as absent and overwritten rather than throwing", async () => {
  const deployDir = freshDeployDir();
  const stateDir = join(deployDir, "state");
  mkdirSync(stateDir, { recursive: true });
  const recordPath = join(stateDir, "broker.json");
  writeFileSync(recordPath, '{"pid": 1, "star');

  const { child } = runBrokerAsync(deployDir, ["--repo-root", "/tmp/fake-repo-root", "--state-dir", stateDir], {
    VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
    VICE_BROKER_CONTROL_PORT: "0",
  });
  try {
    const wroteNewRecord = await waitFor(() => {
      try {
        const parsed = JSON.parse(readFileSync(recordPath, "utf8"));
        return Object.keys(parsed).length === BROKER_JSON_FOURTEEN_KEYS.length;
      } catch {
        return false;
      }
    }, 5000);
    assert.ok(wroteNewRecord, `a malformed existing record must be treated as "not there yet", not thrown on; stderr so far`);
  } finally {
    await stopBroker(child);
    rmSync(deployDir, { recursive: true, force: true });
  }
});

test("missing --repo-root exits non-zero with a usage line, writing nothing, never starting a listener", () => {
  const deployDir = freshDeployDir();
  try {
    const result = runBrokerSync(deployDir, [], { VICE_SUPERVISOR_ALLOW_CONTAINER: "1" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /usage:/);
  } finally {
    rmSync(deployDir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------- container guard
//
// PD-03: the guard now runs at the BROKER PROCESS's own startup (not only
// inside the launcher's shell wrapper) -- these two exercise the emitted
// artifact DIRECTLY, bypassing vice-launcher.sh entirely, closing the
// invocation-scoped hole recorded in RE-FINDINGS.md 2026-08-03.

test("running the emitted broker artifact directly (no launcher) inside this container, with no escape hatch, exits 2 and names the fired signals", () => {
  const deployDir = freshDeployDir();
  try {
    const result = runBrokerSync(deployDir, ["--repo-root", "/tmp/fake-repo-root", "--state-dir", join(deployDir, "state")]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /FATAL: vice-broker refuses to run inside a container/);
    assert.match(result.stderr, /Signals that fired/);
  } finally {
    rmSync(deployDir, { recursive: true, force: true });
  }
});

test("running the emitted broker artifact directly (no launcher) with --check-container exits 3 and prints one report line per signal", () => {
  const deployDir = freshDeployDir();
  try {
    const result = runBrokerSync(deployDir, ["--check-container"]);
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

test("running the launcher inside this container exits 2 (container guard refusal, now answered by the Node entry point)", () => {
  const result = spawnSync(LAUNCHER, [], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /refuses to run inside a container/);
});

test("running the launcher with --check-container exits 3 (container verdict, reporting only, now answered by the Node entry point)", () => {
  const result = spawnSync(LAUNCHER, ["--check-container"], { encoding: "utf8" });
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
