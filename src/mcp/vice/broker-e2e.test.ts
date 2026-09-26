// broker-e2e.test.ts
//
// The tracer's own end-to-end verify -- the one test that proves the WHOLE
// path this plan wires, not one layer of it: build the real artifacts,
// spawn the emitted resources/vice-broker.mjs under bare `node`, connect
// with the real container-side TCP client (vice-broker-client.ts's
// dialControlSession()), send one `acquire`, and assert the grant, the
// spawn, the epoch write and the connection-close release all happen for
// real. No real emulator runs anywhere in this test and no test opens a
// connection to the host VICE -- VICE_BIN is stubbed to /bin/sleep.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, createServer, type Server } from "node:net";

import { build } from "./build.ts";
import { dialControlSession, type AcquireGrant, type BrokerControlSession } from "./vice-broker-client.ts";
import { verifiedKill } from "./broker-kill.mts";
import { epochPathFor } from "./broker-epoch.mts";
import { grantEpochReader } from "./stock-session.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");

// The container-guard refusal test below hands its spawned child ONE
// simulated container signal instead of inheriting one ambiently. The only
// thing that used to supply this signal was a CI job declaring itself a
// container on a machine that was a host -- that mislabelling routed every
// host-side invocation in that job to a control plane with no broker behind
// it, broke its first substantive step, and skipped every step behind it for
// months. An ambient source must not be reintroduced. Injecting one signal
// is all the guard needs to prove itself: containerGuardEnforce()/
// containerGuardReport() refuse on ANY signal firing, so this single key is
// as real a test of the wiring as a genuine multi-signal container would be.
const SIMULATED_CONTAINER_ENV = { CONTAINER_WORKSPACE_PATH: HERE };

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(predicate: () => boolean, deadlineMs: number, pollMs = 25): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return predicate();
}

interface BrokerHandle {
  child: ChildProcessWithoutNullStreams;
  stateDir: string;
  stderr: string;
}

/** Spawns the EMITTED broker artifact under bare node -- never the
 * TypeScript source -- with VICE_BIN/VICE_ARGS stubbed to a real,
 * harmless, long-lived process (/bin/sleep) so a spawned "instance" is a
 * real pid without ever touching x64sc. VICE_BROKER_CONTROL_PORT=0 lets
 * the kernel pick a free port so parallel test runs never collide.
 *
 * `extraEnv` accepts `undefined` for a key (not merely omitting the key)
 * to UNSET it rather than merely leave the default -- needed by the
 * probe-answering-stub tests below, which must leave VICE_ARGS unset (see
 * writeProbeAnsweringStub()'s own header comment for why) even though this
 * function's own base env always sets it. A plain omitted key keeps the
 * default; `SOME_VAR: undefined` removes it from the spawned child's
 * environment entirely. */
/** Shared env-merging/filtering discipline for every spawn helper in this
 * file: `extraEnv` accepts `undefined` for a key (not merely omitting the
 * key) to UNSET it rather than merely leave the default -- needed by the
 * probe-answering-stub tests below, which must leave VICE_ARGS unset (see
 * writeProbeAnsweringStub()'s own header comment for why) even though the
 * base env always sets it. A plain omitted key keeps the default;
 * `SOME_VAR: undefined` removes it from the spawned child's environment
 * entirely. */
function buildBrokerEnv(extraEnv: Record<string, string | undefined>): Record<string, string> {
  const merged: Record<string, string | undefined> = {
    ...process.env,
    VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
    VICE_BIN: "/bin/sleep",
    VICE_ARGS: "600",
    VICE_BROKER_CONTROL_PORT: "0",
    ...extraEnv,
  };
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) env[key] = value;
  }
  return env;
}

/** Spawns the EMITTED broker artifact under bare node -- never the
 * TypeScript source -- with VICE_BIN/VICE_ARGS stubbed to a real,
 * harmless, long-lived process (/bin/sleep) so a spawned "instance" is a
 * real pid without ever touching x64sc. VICE_BROKER_CONTROL_PORT=0 lets
 * the kernel pick a free port so parallel test runs never collide. */
function startBroker(stateDir: string, extraEnv: Record<string, string | undefined> = {}): BrokerHandle {
  const child = spawn(process.execPath, [BROKER_ARTIFACT, "--repo-root", "/tmp/fake-repo-root-e2e", "--state-dir", stateDir], {
    env: buildBrokerEnv(extraEnv),
  }) as ChildProcessWithoutNullStreams;

  const handle: BrokerHandle = { child, stateDir, stderr: "" };
  child.stderr.on("data", (chunk: Buffer) => {
    handle.stderr += chunk.toString("utf8");
  });
  return handle;
}

/** Spawns the emitted broker artifact with an EXPLICIT argv, for cases that
 * must omit --repo-root and/or --state-dir entirely (D-13: the no-project
 * fallback and the two-projects-one-broker case below). Shares the SAME
 * env-merging discipline as startBroker() via buildBrokerEnv() -- never a
 * second, drifting copy of it. `handle.stateDir` is left empty here
 * (unlike startBroker()'s own, which is never read either) since the whole
 * point of this helper is that the caller does not name one in argv. */
function startBrokerWithArgv(argv: string[], extraEnv: Record<string, string | undefined> = {}): BrokerHandle {
  const child = spawn(process.execPath, [BROKER_ARTIFACT, ...argv], {
    env: buildBrokerEnv(extraEnv),
  }) as ChildProcessWithoutNullStreams;

  const handle: BrokerHandle = { child, stateDir: "", stderr: "" };
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

/** Waits for the broker's `vice-broker: ready` stderr line and returns the
 * control port it names -- the kernel-chosen one, since every broker here is
 * spawned with VICE_BROKER_CONTROL_PORT=0. */
async function waitForReady(handle: BrokerHandle, deadlineMs = 5000): Promise<number> {
  const pattern = /vice-broker: ready \(.*\); control listener bound on \S+:(\d+)/;
  const appeared = await waitFor(() => pattern.test(handle.stderr), deadlineMs);
  assert.ok(appeared, `the broker's ready line did not appear within deadline; stderr so far: ${handle.stderr}`);
  return Number(pattern.exec(handle.stderr)![1]);
}

/** Dials a control session at the broker on `port` over loopback. */
async function dialBroker(port: number): Promise<BrokerControlSession> {
  const dialed = await dialControlSession({ port, candidates: ["127.0.0.1"] });
  assert.ok(dialed.ok, `dialControlSession failed: ${JSON.stringify(dialed)}`);
  return dialed.session;
}

/** Dials a session and acquires over it. The session IS the lease: its
 * release() is the connection close that releases the grant. */
async function acquireGrant(port: number): Promise<{ grant: AcquireGrant; session: BrokerControlSession }> {
  const session = await dialBroker(port);
  const acquired = await session.acquire();
  if (!acquired.ok) {
    await session.release();
    assert.fail(`acquire failed: ${JSON.stringify(acquired)}`);
  }
  return { grant: acquired.grant, session };
}

// ---------------------------------------------------------------------------
// 01.6.2.1-02-PLAN.md, Task 2: D-05/P-05/P-06 (plan 02's own probe collapse)
// retire the external-command probe mechanism the two tests below used to
// reach `ready` through (the retired env var named an always-succeeding
// shell script). Both tests now reach `ready` through the surviving
// in-process HTTP mechanism instead, via the fixture below.
// ---------------------------------------------------------------------------

/** Writes a probe-answering stub emulator to `dir` -- a small executable
 * script standing in for x64sc in the one test below that needs an
 * instance to actually reach `ready` through the surviving probe mechanism,
 * rather than merely existing as a long-lived pid the way /bin/sleep does
 * for every other test in this file. (quick task 260913-o78: this used to
 * say "the two tests below" -- the warm-floor test that made that true was
 * removed along with the warm floor itself, per this file's own comment
 * above the "wired supervision" test; grep confirms exactly one caller of
 * this function remains, in the "wired warm-hit (plan 41-05)" test below.
 * A second, planted-violation test below also calls this function, but
 * only to spawn the emitted stub directly and assert its refusal -- it
 * never drives it through a real broker.)
 *
 * It is a Node-shebang script (mode 0755) so the broker's own
 * `spawn(viceBin, viceArgs)` runs it directly, and verifiedKill()'s
 * (broker-kill.mts) identity check sees its own path in the target
 * process's own argument list -- the recorded expectedIdentity need only
 * appear SOMEWHERE in the running process's argv, which it does here as
 * this script's own absolute path (the node interpreter's second argv
 * element).
 *
 * It reads its own allocated port out of its OWN argument vector -- the
 * `-binarymonitoraddress ip4://<host>:<port>` flag buildViceArgs()'s stock
 * branch (broker-launch.mts) constructs, resolved BY NAME (never by a
 * positional scan for the first `ip4://` argument: the same branch can
 * append a SECOND `ip4://` URL for `-remotemonitoraddress`, and a
 * positional scan would bind that port instead). THE ONE NON-OBVIOUS
 * COUPLING, stated here per this task's own instruction: a test using this
 * stub must leave VICE_ARGS UNSET in its own startBroker() call.
 * buildViceArgs() takes its AS-IS branch (using VICE_ARGS verbatim,
 * WITHOUT ever appending a monitor flag) whenever VICE_ARGS is set in the
 * environment, and only takes its CONSTRUCTING branch (which builds the
 * `-binarymonitoraddress` flag from the actually allocated port) when
 * VICE_ARGS is unset -- if VICE_ARGS stayed set (as every other test in
 * this file leaves it, at "600" for /bin/sleep), this stub would receive
 * "600" as its sole argument and have no port to read. If the flag is
 * missing, malformed, or its port does not parse into 1..65535, the stub
 * refuses loudly (non-zero exit, stderr naming the flag and the argv it
 * received) rather than falling back to a default, a random OS-assigned
 * port, or NaN -- exactly that silent fallback is what let a broken probe
 * coupling masquerade as a broker regression for an unknown number of
 * commits (quick task 260913-o78).
 *
 * It binds a `node:net` listener on that port and answers a binary-monitor
 * PING (0x81) with a well-formed reply -- STX, api version, zero body
 * length, response type, error code, and the request id echoed from the
 * request just received -- satisfying `defaultBinmonProbe()`'s frame
 * walker (broker-launch.mts), which is the readiness route the stock
 * backend actually uses; the retired JSON/HTTP substring contract this
 * stub used to answer no longer applies anywhere on this route. It ignores
 * any other command (the probe's own follow-up EXIT among them) without
 * replying or closing, and stays alive indefinitely after answering --
 * exactly like /bin/sleep did for the retiring probe-command fixture this
 * replaces.
 * Rebinding after a kill relies on the OS's own default listen-socket
 * reuse behaviour for a fresh process; the test using this stub POLLS for
 * the respawned instance (this file's own waitFor() idiom) rather than
 * assuming an instant rebind, per the project's no-wall-clock-sleep rule.
 *
 * Written as `.cjs` deliberately -- this package's nearest package.json
 * sets `"type": "module"`, which would force a same-named `.js` file into
 * ESM (breaking the plain `require("node:net")` below); `.cjs` is always
 * CommonJS regardless of the nearest package.json.
 *
 * NOT a rule violation, stated explicitly per this task's own instruction:
 * the project rule is that nothing may open its own connection to THE HOST
 * VICE. This stub is not VICE -- it is a fake local responder this test
 * itself creates, on a port the broker allocated in its own band, inside
 * this container. No `x64sc` runs anywhere. The connection the broker's
 * probe makes to it is host-side broker code probing its own child,
 * exactly D-05's permitted-route note -- the same posture every OTHER test
 * in this file already takes binding real TCP ports for the control
 * plane. */
function writeProbeAnsweringStub(dir: string): string {
  const stubPath = join(dir, "probe-answering-stub.cjs");
  writeFileSync(
    stubPath,
    [
      "#!/usr/bin/env node",
      'const net = require("node:net");',
      "const args = process.argv.slice(2);",
      'const FLAG = "-binarymonitoraddress";',
      "const idx = args.indexOf(FLAG);",
      "function refuse(reason) {",
      "  process.stderr.write(",
      '    "probe-answering-stub: " + reason + " (looked for " + FLAG + ", argv: " + JSON.stringify(args) + ")\\n",',
      "  );",
      "  process.exit(1);",
      "}",
      "if (idx === -1 || idx === args.length - 1) {",
      '  refuse("missing " + FLAG + " flag or its value");',
      "}",
      "const url = args[idx + 1];",
      "const match = /^ip4:\\/\\/(.+):(\\d+)$/.exec(url);",
      "if (!match) {",
      '  refuse("could not parse an ip4:// URL after " + FLAG + ": " + JSON.stringify(url));',
      "}",
      "const host = match[1];",
      "const port = Number(match[2]);",
      "if (!Number.isInteger(port) || port < 1 || port > 65535) {",
      '  refuse("parsed port out of range 1..65535: " + match[2]);',
      "}",
      "",
      "const BINMON_STX = 0x02;",
      "const BINMON_API_VERSION = 0x02;",
      "const BINMON_REQUEST_HEADER_LEN = 11;",
      "const BINMON_RESPONSE_HEADER_LEN = 12;",
      "const BINMON_CMD_PING = 0x81;",
      "",
      "const server = net.createServer((socket) => {",
      "  let buffer = Buffer.alloc(0);",
      '  socket.on("data", (chunk) => {',
      "    buffer = Buffer.concat([buffer, chunk]);",
      "    for (;;) {",
      "      if (buffer.length < BINMON_REQUEST_HEADER_LEN) return;",
      "      const bodyLen = buffer.readUInt32LE(2);",
      "      const frameLen = BINMON_REQUEST_HEADER_LEN + bodyLen;",
      "      if (buffer.length < frameLen) return;",
      "      const requestId = buffer.readUInt32LE(6);",
      "      const commandType = buffer[10];",
      "      buffer = buffer.subarray(frameLen);",
      "      if (commandType === BINMON_CMD_PING) {",
      "        const response = Buffer.alloc(BINMON_RESPONSE_HEADER_LEN);",
      "        response[0] = BINMON_STX;",
      "        response[1] = BINMON_API_VERSION;",
      "        response.writeUInt32LE(0, 2);",
      "        response[6] = BINMON_CMD_PING;",
      "        response[7] = 0x00;",
      "        response.writeUInt32LE(requestId >>> 0, 8);",
      "        socket.write(response);",
      "      }",
      "      // Any other command type (e.g. the probe's own post-ping EXIT) is",
      "      // consumed off the buffer and ignored -- no reply, no close. The",
      "      // probe half-closes after EXIT; the listener itself must keep",
      "      // running so a later grant-time re-probe can still connect.",
      "    }",
      "  });",
      '  socket.on("error", () => {});',
      "});",
      "server.listen(port, host);",
      "",
    ].join("\n"),
  );
  chmodSync(stubPath, 0o755);
  return stubPath;
}

// Quick task 260913-o78: the planted-violation gate for the stub's loud
// refusal. Without this, "refuses loudly instead of falling back" is prose
// nobody runs -- a control nothing exercises is exactly the class of defect
// this whole quick task exists to close. Spawns the emitted stub directly
// (never through startBroker()/the real broker) with an argv that
// deliberately carries no binary-monitor endpoint flag -- mirroring the
// VICE_ARGS="600" shape every other test in this file leaves set, which is
// the real-world argv that would reach this path if VICE_ARGS were ever
// left set for a test using this stub.
test(
  "probe-answering stub refuses loudly (non-zero exit, stderr names the flag) when its argv carries no binary-monitor endpoint flag",
  { timeout: 5000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "broker-e2e-stub-refusal-"));
    try {
      const stubPath = writeProbeAnsweringStub(dir);
      const child = spawn(process.execPath, [stubPath, "600"]);
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      const exitCode = await new Promise<number | null>((resolvePromise) => {
        child.on("exit", (code) => resolvePromise(code));
      });
      assert.notEqual(exitCode, 0, `stub must exit non-zero when it cannot resolve a binary-monitor port, got ${exitCode}`);
      assert.ok(
        stderr.includes("-binarymonitoraddress"),
        `stderr must name the flag the stub looked for, got: ${JSON.stringify(stderr)}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test(
  "end-to-end: one acquire over the TCP control plane spawns exactly one stub child, writes its epoch, grants, and connection-close identity-verified-kills it",
  { timeout: 20000 },
  async () => {
    build(); // ensure resources/ is a fresh build of the current TypeScript source
    const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-"));
    const handle = startBroker(stateDir);
    try {
      const port = await waitForReady(handle);
      const acquired = await acquireGrant(port);
      const grant = acquired.grant;

      assert.ok(Number.isInteger(grant.port) && grant.port >= 6600, `grant.port must be an integer >= 6600, got ${grant.port}`);
      assert.equal(typeof grant.url, "string");
      assert.equal(typeof grant.id, "string");
      const rawGrant = grant as unknown as Record<string, unknown>;
      assert.ok(!("epoch_file" in rawGrant) && !("supervisor_dir" in rawGrant), "the grant must name no broker-side path");
      const epochFile = epochPathFor(stateDir, grant.port);

      // Exactly one child spawned: exactly one per-port directory under
      // stateDir carrying an epoch.json.
      const portDirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
      assert.equal(portDirs.length, 1, `expected exactly one instance directory, found ${JSON.stringify(portDirs.map((d) => d.name))}`);

      assert.ok(existsSync(epochFile), `epoch file must exist at ${epochFile}`);
      const epoch = JSON.parse(readFileSync(epochFile, "utf8"));
      assert.equal(typeof epoch.pid, "number");
      assert.ok(isAlive(epoch.pid), `spawned child pid ${epoch.pid} must be alive right after grant`);

      const childPid: number = epoch.pid;

      // Connection close IS the release -- assert the child is gone within
      // a deadline, never on a wall-clock sleep alone.
      await acquired.session.release();
      const gone = await waitFor(() => !isAlive(childPid), 5000);
      assert.ok(gone, `spawned child pid ${childPid} must be gone within deadline after connection close`);
    } finally {
      await stopBroker(handle);
      rmSync(stateDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// 01.6.2-12-PLAN.md, Task 1 (gap closure -- CR-01, criterion C2, D-04): the
// end-to-end proof that per-instance crash supervision is a real, wired
// property of the RUNNING broker -- not merely of superviseChild() in
// isolation (broker-launch.test.ts already covers that function's own
// backoff/give-up/deliberate-kill behavior against a fully controlled stub;
// this test instead kills a REAL granted child out from under the REAL
// spawned broker artifact and watches the respawn happen through the whole
// stack: withCrashSupervision() -> handleExit() -> launchSupervised() ->
// tryLaunchOne() -> a fresh epoch.json on disk). VICE_RESTART_BACKOFF_S=0
// keeps the test fast without touching the respawn logic itself -- the
// backoff duration is not what this test is proving.
// ---------------------------------------------------------------------------

test(
  "wired supervision: a granted stub child killed out from under the real broker is respawned on the SAME port, its epoch advances, and exactly one instance directory remains",
  { timeout: 20000 },
  async () => {
    build();
    const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-supervise-cold-"));
    const handle = startBroker(stateDir, { VICE_RESTART_BACKOFF_S: "0" });
    try {
      const port = await waitForReady(handle);
      const acquired = await acquireGrant(port);
      const grant = acquired.grant;

      const epochFile = epochPathFor(stateDir, grant.port);
      const readGrantEpoch = grantEpochReader(acquired.session, grant.id);
      const epochBefore = JSON.parse(readFileSync(epochFile, "utf8"));
      const pidBefore: number = epochBefore.pid;
      assert.equal(typeof pidBefore, "number");
      assert.equal(await readGrantEpoch(), epochBefore.epoch, "the epoch the broker reports over the socket must be the one it wrote");
      assert.ok(isAlive(pidBefore), `granted child pid ${pidBefore} must be alive before the kill`);

      // Kill the granted child from OUTSIDE the broker with an uncatchable
      // signal -- the broker sees an unexplained exit, exactly the crash
      // shape withCrashSupervision()'s exit listener exists to observe.
      process.kill(pidBefore, "SIGKILL");
      const killedChildGone = await waitFor(() => !isAlive(pidBefore), 5000);
      assert.ok(killedChildGone, `killed child pid ${pidBefore} must actually exit before a respawn can be observed`);

      const respawned = await waitFor(() => {
        let epoch: Record<string, unknown>;
        try {
          epoch = JSON.parse(readFileSync(epochFile, "utf8"));
        } catch {
          return false;
        }
        return (
          typeof epoch.epoch === "number" &&
          epoch.epoch > epochBefore.epoch &&
          typeof epoch.pid === "number" &&
          epoch.pid !== pidBefore &&
          isAlive(epoch.pid as number)
        );
      }, 10000);
      assert.ok(respawned, "the killed instance must be respawned on the same port with an advanced epoch and a new, live pid within the deadline");

      const epochAfter = JSON.parse(readFileSync(epochFile, "utf8"));
      assert.equal(epochAfter.epoch, epochBefore.epoch + 1, "the epoch integer must advance by exactly one on respawn");
      // A respawn is a new pid, so the grant no longer owns the instance and
      // its epoch is never read as this grant's. The reader reports none,
      // which stockReconnect() refuses. Matching by port instead would be
      // unsafe: a cold launch on a reused port starts again at epoch 1.
      assert.equal(await readGrantEpoch(), null, "after a respawn the grant owns no instance, so no epoch is read as its own");
      assert.notEqual(epochAfter.pid, pidBefore, "the respawned child must be a DIFFERENT pid from the killed one");
      assert.ok(isAlive(epochAfter.pid), "the respawned child's pid must answer a zero-signal liveness check");

      const portDirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
      assert.equal(portDirs.length, 1, `exactly one instance directory must exist after the respawn, found ${JSON.stringify(portDirs.map((d) => d.name))}`);
      assert.equal(Number(portDirs[0].name), grant.port, "the respawned instance must occupy the SAME port the original grant named");

      assert.equal(handle.child.exitCode, null, "the broker process itself must still be running after the respawn");
      assert.equal(handle.child.signalCode, null, "the broker process itself must not have been signalled");

      await acquired.session.release();
    } finally {
      await stopBroker(handle);
      rmSync(stateDir, { recursive: true, force: true });
    }
  },
);

// Plan 41-05 (folded todo): "wired supervision: a warm-floor stub child
// killed out from under the real broker is respawned on the same port by
// the same wrapper" used to sit here. REMOVED along with the warm floor --
// there is no longer a warm-spare launch path to distinguish it from the
// "wired supervision: a granted stub child killed..." test directly above,
// which already drives the identical crash-supervision wiring (kill a real
// granted child, observe the respawn on the same port with an advanced
// epoch, exactly one instance directory remains) through the ONLY launch
// path left. Two tests asserting the same wiring through two call sites
// that now share one path would be redundant, not additional coverage.

// ---------------------------------------------------------------------------
// 01.6.2.1-01-PLAN.md, Task 1 (P-01/P-04): the e2e half of Defect 5's close --
// an acquire over the REAL control plane, against the REAL spawned broker
// artifact, served from an already-ready instance rather than paying a cold
// launch. A unit test cannot see an orphaned module (handleAcquire() could
// be perfectly correct in isolation while the real entry point never reaches
// it -- exactly 01.6.2's own crash-supervisor gap, and this plan's own
// Defect 5); this is the proof a fully-controlled stub cannot give.
//
// Plan 41-05 (folded todo): RE-POINTED off the retired warm floor. This
// fixture used to configure the (now-retired) warm-floor knob to 1 and wait
// for the periodic pass to speculatively pre-launch a spare; that mechanism
// is gone. The candidate this test needs -- a `ready`, UNGRANTED instance
// for a later acquire to be served from -- is instead produced the way this
// plan's own SUMMARY argues it now arises in production: an ORDINARY
// (non-deliberate) crash of a GRANTED instance. broker-launch.mts's
// handleExit() respawns it into `launching` with NO restoration of
// `granted`, and the
// periodic pass's promoteLaunchingInstances() promotes it to `ready` once
// its probe succeeds -- at which point it is exactly the kind of candidate
// selectWarmInstance() (vice-broker.mts) walks. The isolation the removed
// warm-floor env assignment used to provide is now the default (nothing
// warms speculatively at all); this test's own sequencing -- wait for the
// respawn, wait for it to reach "ready", THEN send the second acquire -- is
// what replaces it.
// ---------------------------------------------------------------------------

test(
  "wired warm-hit (plan 41-05): an acquire over the real control plane is served from a ready, ungranted instance an ordinary crash-respawn left behind, spawning no second instance (Defect 5, P-01/P-04)",
  { timeout: 20000 },
  async () => {
    build();
    const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-warm-hit-"));
    const probeDir = mkdtempSync(join(tmpdir(), "broker-e2e-warm-hit-probe-"));
    const stubPath = writeProbeAnsweringStub(probeDir);
    // VICE_ARGS deliberately UNSET (not merely omitted) -- see
    // writeProbeAnsweringStub()'s own header comment for why the stub
    // depends on buildViceArgs()'s CONSTRUCTING branch running.
    const handle = startBroker(stateDir, {
      VICE_RESTART_BACKOFF_S: "0",
      VICE_BIN: stubPath,
      VICE_ARGS: undefined,
    });
    try {
      const port = await waitForReady(handle);

      // First acquire: a real cold launch, granted.
      const firstAcquired = await acquireGrant(port);
      const firstGrant = firstAcquired.grant;
      const firstEpochFile = epochPathFor(stateDir, firstGrant.port);
      const epochBefore = JSON.parse(readFileSync(firstEpochFile, "utf8"));
      const pidBefore: number = epochBefore.pid;
      assert.ok(isAlive(pidBefore), `granted child pid ${pidBefore} must be alive before the kill`);

      // An ORDINARY (non-deliberate) crash of the GRANTED instance -- see
      // this test's own header comment above for why this is the surviving
      // path that leaves a ready-but-ungranted candidate behind.
      process.kill(pidBefore, "SIGKILL");
      const killedGone = await waitFor(() => !isAlive(pidBefore), 5000);
      assert.ok(killedGone, `killed child pid ${pidBefore} must actually exit before a respawn can be observed`);

      const respawned = await waitFor(() => {
        let epoch: Record<string, unknown>;
        try {
          epoch = JSON.parse(readFileSync(firstEpochFile, "utf8"));
        } catch {
          return false;
        }
        return typeof epoch.pid === "number" && epoch.pid !== pidBefore && isAlive(epoch.pid as number);
      }, 10000);
      assert.ok(respawned, "the crashed instance must be respawned within the deadline");

      // Release the first (now-stale) grant -- the respawned instance's own
      // pid no longer matches it, so handleRelease() retires only the
      // grant's bookkeeping and leaves the respawned instance untouched
      // (broker-state.mts's own pid-identity check), exactly the state this
      // test needs to exist for the second, unrelated acquire below.
      await firstAcquired.session.release();

      // Wait for the RESPAWNED record's own recorded state to reach
      // "ready" -- promoteLaunchingInstances() only promotes on a LATER
      // poll tick (VICE_BROKER_POLL_MS), and handleAcquire()'s
      // warm-instance selector only ever considers a record whose recorded
      // state is "ready" (never merely "launching"). Polled through a
      // SEPARATE, never-acquiring control session (status is read-only).
      const pollSession = await dialBroker(port);
      let becameReady = false;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline && !becameReady) {
        const statusResult = await pollSession.status();
        if (statusResult.ok) {
          const entry = statusResult.instances.find((i) => i.port === firstGrant.port);
          if (entry && entry.state === "ready") {
            becameReady = true;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      await pollSession.release();
      assert.ok(becameReady, "the respawned instance must reach recorded state \"ready\" within the deadline before the second acquire is sent");

      // The second, UNRELATED acquire: served from the ready, ungranted
      // instance the crash-respawn left behind -- no second spawn.
      const secondAcquired = await acquireGrant(port);
      const secondGrant = secondAcquired.grant;
      assert.equal(secondGrant.port, firstGrant.port, "the second acquire must be served from the SAME respawned instance, not a freshly launched one");

      // The load-bearing assertion: still exactly ONE instance directory --
      // no second instance was spawned to satisfy this acquire.
      const portDirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
      assert.equal(
        portDirs.length,
        1,
        `expected exactly one instance directory to still exist after the second acquire (served from the ready, ungranted respawn, no cold launch), found ${JSON.stringify(portDirs.map((d) => d.name))}`,
      );
      assert.equal(Number(portDirs[0].name), firstGrant.port, "the sole remaining instance directory must be the SAME respawned instance the second grant named");

      await secondAcquired.session.release();
    } finally {
      await stopBroker(handle);
      rmSync(stateDir, { recursive: true, force: true });
      rmSync(probeDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// The wired proof that a release does not respawn, against the real spawned
// broker artifact. The ownership check requires the release to come from
// the SAME connection that acquired, so the test holds ONE raw connection
// across both requests (a raw-request helper local to this file, never a
// field added to vice-broker-client.ts for a test's convenience).
// ---------------------------------------------------------------------------

/** A held raw connection supporting several sequential request/response
 * round trips over ONE socket, for proofs that need ONE connection across
 * several requests (broker-control.mts's own
 * ownership discipline: a connection may only act on the grant it itself
 * holds). Test-local infrastructure only -- never touches
 * vice-broker-client.ts. */
function makeRawSession(host: string, port: number) {
  const socket = connect({ host, port });
  // Nagle's algorithm, left enabled by default, can hold a small outgoing
  // write back for tens of milliseconds waiting to coalesce -- invisible to
  // every OTHER test in this file (each holds exactly one connection, so
  // there is nothing to race against), but directly corrupts
  // 01.6.2-14-PLAN.md's Task 2, which sends two acquire requests over TWO
  // connections and depends on both reaching the broker with negligible,
  // symmetric latency. Disabled unconditionally rather than only for that
  // one test, since it can only ever make every OTHER caller's own request
  // arrive sooner, never later.
  socket.setNoDelay(true);
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
    // Resolves once the TCP handshake itself completes -- exposed so a test
    // sending on TWO connections "back to back" (01.6.2-14-PLAN.md's Task 2)
    // can await BOTH connections' own handshakes first, so the ORDER their
    // acquire lines are actually WRITTEN matches the order .send() was
    // called in, uncontaminated by connection-setup jitter between the two
    // sockets themselves.
    ready: new Promise<void>((resolvePromise) => {
      socket.once("connect", () => resolvePromise());
    }),
    send(obj: Record<string, unknown>): void {
      socket.write(`${JSON.stringify(obj)}\n`);
    },
    next(timeoutMs = 5000): Promise<Record<string, unknown>> {
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

test(
  "wired release: a release over the real control plane kills the granted child and no replacement appears -- kill-never-recycle holds with supervision wired",
  { timeout: 20000 },
  async () => {
    build();
    const POLL_MS = 100;
    const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-release-"));
    // Plan 41-05 (folded todo): same isolation reasoning as the supervision test
    // above -- a release frees its port back to the allocator, and a
    // speculatively pre-warmed spare landing on that SAME now-free port
    // would rewrite this test's own epoch.json with an unrelated pid,
    // corrupting the exact "no replacement appears" assertion this test
    // exists to make. That isolation is now the DEFAULT (VICE launches
    // strictly on demand), so no override is needed here to get it.
    const handle = startBroker(stateDir, { VICE_RESTART_BACKOFF_S: "0", VICE_BROKER_POLL_MS: String(POLL_MS) });
    try {
      const port = await waitForReady(handle);

      const client = makeRawSession("127.0.0.1", port);
      try {
        client.send({ op: "acquire", id: "release-proof-acquire" });
        const grantResp = await client.next();
        assert.equal(grantResp.kind, "grant", `expected a grant, got: ${JSON.stringify(grantResp)}`);
        const grantPort = Number(grantResp.port);
        const epochFile = epochPathFor(stateDir, grantPort);

        const epochBefore = JSON.parse(readFileSync(epochFile, "utf8"));
        const pidBefore: number = epochBefore.pid;
        assert.ok(isAlive(pidBefore), `granted child pid ${pidBefore} must be alive before the release`);

        client.send({ op: "release" });
        const released = await client.next();
        assert.equal(released.kind, "released");

        const gone = await waitFor(() => !isAlive(pidBefore), 5000);
        assert.ok(gone, `released child pid ${pidBefore} must be gone within deadline`);

        // Past AT LEAST two evaluation passes -- the poll interval is
        // configured explicitly above (100ms) so this is a known quantity:
        // waiting 2 * POLL_MS plus margin guarantees at least two passes
        // have run since the release completed.
        await new Promise((r) => setTimeout(r, POLL_MS * 2 + 250));

        const epochAfter = JSON.parse(readFileSync(epochFile, "utf8"));
        assert.equal(epochAfter.epoch, epochBefore.epoch, "no new epoch generation may appear at this port after a release");
        assert.equal(epochAfter.pid, pidBefore, "the epoch record's own pid must not change after a release -- nothing may have respawned it");
        assert.ok(!isAlive(epochAfter.pid), "no live pid may answer at this port after a release");

        client.send({ op: "status" });
        const status = await client.next();
        assert.equal(status.kind, "status");
        const instances = status.instances as Array<Record<string, unknown>>;
        const onReleasedPort = instances.filter((i) => Number(i.port) === grantPort);
        assert.equal(onReleasedPort.length, 0, `the status response must list no instance on the released port ${grantPort}, got ${JSON.stringify(instances)}`);
      } finally {
        client.close();
      }
    } finally {
      await stopBroker(handle);
      rmSync(stateDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// 01.6.2-14-PLAN.md, Task 2: the wired proof that a genuinely queued
// acquirer's disconnect leaves exactly one instance behind, not two, against
// the REAL spawned broker artifact -- Task 1's unit tests (broker-control.
// test.ts) prove the guard in isolation with an injected callback; this
// proves it at the real entry point, with a real (widened) port scan and a
// real spawned child.
//
// The queueing window is made wide BY CONSTRUCTION, never hoped for: the
// real port allocator (broker-state.mts's nextFreePort()) probes each
// candidate with a real bind-and-release round trip before it can succeed,
// so pre-occupying a contiguous run of candidates at the allocator's own
// configured band base makes the first allocation cost one full round trip
// PER occupied candidate -- a wide, deterministic window rather than a raced
// one. The technique generalises: pre-occupy a contiguous run at the
// allocator's own band base, and the cost becomes deterministic.
// ---------------------------------------------------------------------------

/** How many contiguous loopback candidates to pre-occupy, starting at
 * OCCUPIED_BASE_PORT below. Each candidate costs nextFreePort() one real
 * bind-and-release probe round trip, so this count times that per-candidate
 * cost is the queueing window's width -- chosen generously (well under the
 * allocator's own 100-candidate scan ceiling, leaving room for the eventual
 * free port to land inside it), not tuned to the minimum that happens to
 * work today. */
const OCCUPIED_PORT_COUNT = 60;
/** A private base clear of BOTH the human-reserved 6510-6599 band and the
 * broker's own default 6600-6699 scan band (D-18) -- this test's own
 * occupied candidates must never collide with a port a human, or the
 * broker's own default configuration, might actually be using. */
const OCCUPIED_BASE_PORT = 7400;

/** Binds `count` contiguous, plain TCP listeners on 127.0.0.1 starting at
 * `basePort` -- ordinary loopback listeners, never emulator connections,
 * standing in as pre-occupied candidates for defaultPortInUse() (broker-
 * state.mts) to fail against. Does not close them -- the caller's own
 * cleanup releases every one, per this task's own instruction. */
function bindOccupyingListeners(basePort: number, count: number): Promise<Server[]> {
  const servers: Server[] = [];
  const listens: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    const server = createServer();
    servers.push(server);
    listens.push(
      new Promise<void>((resolvePromise, reject) => {
        server.once("error", reject);
        server.listen(basePort + i, "127.0.0.1", () => resolvePromise());
      }),
    );
  }
  return Promise.all(listens).then(() => servers);
}

function closeAllServers(servers: Server[]): Promise<void[]> {
  return Promise.all(servers.map((s) => new Promise<void>((resolvePromise) => s.close(() => resolvePromise()))));
}

test(
  "wired disconnect-while-queued: a genuinely queued acquire whose client disconnects leaves exactly one instance behind, not two",
  { timeout: 30000 },
  async () => {
    build();
    // Larger than the 100ms this file's other tests use, so this test's own
    // reaction (observe the served grant, confirm the queued connection
    // answered nothing, then close it) has a comfortable margin ahead of
    // the next periodic evaluation pass.
    const POLL_MS = 500;
    const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-disconnect-queued-"));
    const occupied = await bindOccupyingListeners(OCCUPIED_BASE_PORT, OCCUPIED_PORT_COUNT);
    // Plan 41-05 (folded todo): same isolation reasoning as the
    // release test above -- a speculatively pre-warmed spare could
    // land on some OTHER free candidate in this same widened scan region
    // and add a second, unrelated instance, corrupting this test's own
    // "exactly one instance" assertions. That isolation is now the DEFAULT
    // (VICE launches strictly on demand), so no override is needed here.
    const handle = startBroker(stateDir, {
      VICE_BROKER_POLL_MS: String(POLL_MS),
      VICE_BROKER_BASE_PORT: String(OCCUPIED_BASE_PORT),
    });
    try {
      const port = await waitForReady(handle);

      const a = makeRawSession("127.0.0.1", port);
      const b = makeRawSession("127.0.0.1", port);
      let servedClient: ReturnType<typeof makeRawSession> | null = null;
      let queuedClient: ReturnType<typeof makeRawSession> | null = null;
      try {
        // Both connections' own TCP handshakes complete FIRST, awaited
        // together, before either sends anything -- otherwise connection-
        // setup jitter between the two sockets can reorder which acquire
        // line the broker actually processes first, independent of which
        // .send() call this test made first.
        await Promise.all([a.ready, b.ready]);

        // Sent back to back, over two SEPARATE connections -- the first to
        // reach handleAcquire() wins the single in_flight owner and performs
        // the whole (widened) port scan itself; the second finds a launch
        // already in flight and is queued with NO response at all (per
        // broker-control.mts's own attemptAcquire()/enqueueAcquire()).
        a.send({ op: "acquire", id: "disconnect-queued-a" });
        b.send({ op: "acquire", id: "disconnect-queued-b" });

        // Both `.next()` calls are issued ONCE, up front, against the SAME
        // two promises used below -- calling `.next()` a SECOND time on the
        // "losing" connection would silently consume a response that
        // already arrived (this session's `next()` shifts its own response
        // queue), turning a genuinely-answered connection into a false
        // "nothing yet" reading. The precondition check below awaits the
        // very same loser promise instead of issuing a fresh `.next()`.
        const aPromise = a.next(15000).then((r) => ({ which: "a" as const, r }));
        const bPromise = b.next(15000).then((r) => ({ which: "b" as const, r }));
        // Neither promise's eventual rejection (the LOSER's own `.next()`
        // deadline, whichever way this resolves) is awaited a second time
        // below -- silence it here so a timeout firing long after this test
        // has moved on never surfaces as an unhandled rejection.
        aPromise.catch(() => {});
        bPromise.catch(() => {});
        const first = await Promise.race([aPromise, bPromise]);
        assert.equal(first.r.kind, "grant", `the first of the two connections to answer must be a grant -- got ${JSON.stringify(first.r)}`);
        servedClient = first.which === "a" ? a : b;
        queuedClient = first.which === "a" ? b : a;
        const queuedPromise = first.which === "a" ? bPromise : aPromise;

        // Assert the precondition explicitly, per this task's own
        // instruction: the OTHER connection must have received NOTHING at
        // all yet. Races the SAME queuedPromise (never a fresh `.next()`
        // call) against a short timer -- if the queued connection also
        // answers within this window, the queueing window did not
        // reproduce -- fail loudly with a diagnostic naming that, rather
        // than silently passing on an unreproduced precondition.
        const NOTHING = Symbol("nothing-yet");
        const raced = await Promise.race([queuedPromise, new Promise((resolvePromise) => setTimeout(() => resolvePromise(NOTHING), 300))]);
        assert.equal(
          raced,
          NOTHING,
          `PRECONDITION NOT REPRODUCED: the queued connection answered (${JSON.stringify(raced)}) instead of remaining queued -- ` +
            `widen OCCUPIED_PORT_COUNT (currently ${OCCUPIED_PORT_COUNT}) and retry`,
        );

        const grantPort = Number(first.r.port);
        const epochFile = epochPathFor(stateDir, grantPort);
        const epochBefore = JSON.parse(readFileSync(epochFile, "utf8"));
        assert.ok(isAlive(epochBefore.pid), `served instance's pid ${epochBefore.pid} must be alive right after the grant`);

        // Disconnect the QUEUED connection while it is still genuinely
        // queued -- reproducing the always-reachable leak's own precondition
        // (T-01.6.2-87): an owner-less entry a later drain pass would
        // otherwise retry.
        queuedClient.close();

        // Wait past AT LEAST two evaluation passes -- the poll interval is
        // configured explicitly above, so this is a known quantity. Goes
        // through this file's own predicate-polling helper (waitFor) rather
        // than a bare setTimeout, even though the predicate itself is a
        // plain deadline check -- a single pass is not enough to prove the
        // guard held across a RETRY, only that it held once.
        const disconnectedAt = Date.now();
        await waitFor(() => Date.now() - disconnectedAt >= POLL_MS * 2 + 250, POLL_MS * 2 + 1000);

        const portDirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
        assert.equal(
          portDirs.length,
          1,
          `exactly one instance directory must exist after the queued acquirer disconnects, found ${JSON.stringify(portDirs.map((d) => d.name))}`,
        );
        assert.equal(Number(portDirs[0].name), grantPort, "the one instance directory must be the SERVED grant's own port");

        const epochAfter = JSON.parse(readFileSync(epochFile, "utf8"));
        assert.equal(epochAfter.pid, epochBefore.pid, "the served instance's pid must be unchanged -- nothing extra may have launched or replaced it");
        assert.ok(isAlive(epochAfter.pid), "exactly one live child pid must be attributable to the broker after the wait");

        servedClient.send({ op: "status" });
        const status = await servedClient.next();
        assert.equal(status.kind, "status");
        const instances = status.instances as Array<Record<string, unknown>>;
        assert.equal(instances.length, 1, `the status response must list exactly one instance, got ${JSON.stringify(instances)}`);
        assert.equal(Number(instances[0].port), grantPort);

        servedClient.send({ op: "release" });
        await servedClient.next();
      } finally {
        a.close();
        b.close();
      }
    } finally {
      await stopBroker(handle);
      await closeAllServers(occupied);
      rmSync(stateDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// Plan 62-04, Task 2 (D-13/BROKER-01/BROKER-06): a broker started with NO
// project argument resolves its state under the machine-level root
// (broker-home.mts's brokerStateDir(), fed from VICE_BROKER_HOME here so
// this test never touches a real developer's home directory), and one such
// broker serves independent sessions from unrelated project directories
// with its own state inside neither. "Two clients configured against two
// project directories" is proven as two INDEPENDENT control-plane sessions
// dialed at the one fixed control port, and the state directory is the one
// the broker itself reports on stderr.
// ---------------------------------------------------------------------------

test(
  "D-13: one broker started with no project argument serves independent handshakes from two unrelated project directories, with its own state inside neither",
  { timeout: 20000 },
  async () => {
    build();
    const machineHome = mkdtempSync(join(tmpdir(), "broker-e2e-machine-home-"));
    const projectA = mkdtempSync(join(tmpdir(), "broker-e2e-project-a-"));
    const projectB = mkdtempSync(join(tmpdir(), "broker-e2e-project-b-"));
    const expectedStateDir = join(machineHome, "supervisor");
    // Exactly ONE broker process, spawned with no --repo-root and no
    // --state-dir at all -- the D-13 fallback is what resolves its state
    // directory, not an argument this test supplies.
    const handle = startBrokerWithArgv([], { VICE_BROKER_HOME: machineHome });
    try {
      const port = await waitForReady(handle);
      const reported = /vice-broker: state directory: (.+)\n/.exec(handle.stderr);
      assert.ok(reported, `the broker must report its state directory on stderr; stderr: ${handle.stderr}`);
      const stateDir = reported[1];
      assert.equal(stateDir, expectedStateDir, "the no-argument broker must resolve its state under VICE_BROKER_HOME's machine-level root");

      // Two independent control-plane sessions, standing in for two clients
      // launched from two unrelated project checkouts -- both complete a
      // real handshake against the SAME single broker process.
      const sessionA = await dialBroker(port);
      const sessionB = await dialBroker(port);
      try {
        const statusA = await sessionA.status();
        assert.ok(statusA.ok, `client A's post-handshake status call failed: ${JSON.stringify(statusA)}`);
        const statusB = await sessionB.status();
        assert.ok(statusB.ok, `client B's post-handshake status call failed: ${JSON.stringify(statusB)}`);
      } finally {
        await sessionA.release();
        await sessionB.release();
      }

      // The load-bearing containment assertion (BROKER-01/BROKER-06):
      // nothing the broker resolved for itself falls inside EITHER project
      // directory.
      assert.ok(!stateDir.startsWith(projectA), `state directory ${stateDir} must not be inside project A (${projectA})`);
      assert.ok(!stateDir.startsWith(projectB), `state directory ${stateDir} must not be inside project B (${projectB})`);
    } finally {
      await stopBroker(handle);
      rmSync(machineHome, { recursive: true, force: true });
      rmSync(projectA, { recursive: true, force: true });
      rmSync(projectB, { recursive: true, force: true });
    }
  },
);

test("with zero live sessions, the handshake still answers and the broker reports itself healthy (BROKER-01)", { timeout: 20000 }, async () => {
  build();
  const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-zero-session-"));
  const handle = startBroker(stateDir);
  try {
    const port = await waitForReady(handle);
    const session = await dialBroker(port);
    try {
      const status = await session.status();
      assert.ok(status.ok, `status call failed: ${JSON.stringify(status)}`);
      if (status.ok) {
        assert.equal(status.instances.length, 0, "no acquire was ever performed against this broker -- its instance list must be empty");
      }
    } finally {
      await session.release();
    }
  } finally {
    await stopBroker(handle);
    rmSync(stateDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// The retiring bash suite's "bash -n exits 0; start still refuses in-container
// with exit 2; --check-container still exits 3" structural test asserted the
// container guard's exit-code contract directly against
// resources/vice-broker.sh. The new broker wires the SAME container-guard.mts
// functions (containerGuardEnforce()/containerGuardReport(), pre-existing and
// unchanged -- vice-broker.mts:650/654) but no test spawned the real emitted
// artifact to prove the wiring itself (as opposed to the guard functions in
// isolation, which container-guard.test.ts already covers). This run now
// simulates a container by handing the child ONE real signal
// (SIMULATED_CONTAINER_ENV) rather than inheriting one ambiently -- that is
// the right shape here because the assertion under test is the emitted
// artifact's exit-code contract, which fires identically on any single
// signal. Simulating it is what lets this check run on a bare host and on a
// CI runner instead of only inside a devcontainer.
// ---------------------------------------------------------------------------

test("the emitted broker artifact refuses to start with the container signal injected and no escape hatch (exit 2), and --check-container reports the same verdict without refusing (exit 3)", { timeout: 20000 }, async () => {
  build();
  const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-guard-"));
  try {
    // No VICE_SUPERVISOR_ALLOW_CONTAINER escape hatch here -- deliberately
    // the opposite of every other test in this file, which sets it via
    // startBroker()'s own env block.
    const refused = spawn(process.execPath, [BROKER_ARTIFACT, "--repo-root", "/tmp/fake-repo-root-e2e", "--state-dir", stateDir], {
      env: { ...process.env, ...SIMULATED_CONTAINER_ENV, VICE_SUPERVISOR_ALLOW_CONTAINER: "", VICE_BIN: "/bin/sleep", VICE_ARGS: "600" },
    });
    const refusedCode = await new Promise<number | null>((resolvePromise) => {
      refused.once("exit", (code) => resolvePromise(code));
    });
    assert.equal(refusedCode, 2, "starting in-container with no escape hatch must exit 2");
    assert.deepEqual(readdirSync(stateDir), [], "a refused start must leave its state directory untouched");

    const reported = spawn(process.execPath, [BROKER_ARTIFACT, "--check-container"], {
      env: { ...process.env, ...SIMULATED_CONTAINER_ENV, VICE_SUPERVISOR_ALLOW_CONTAINER: "" },
    });
    const reportedCode = await new Promise<number | null>((resolvePromise) => {
      reported.once("exit", (code) => resolvePromise(code));
    });
    assert.equal(reportedCode, 3, "--check-container must report the container verdict (exit 3) without refusing outright");
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// verifiedKill() (broker-kill.mts): the identity-verified kill discipline,
// exercised directly (in-process) against a real stub child -- this is the
// one test in this task's scope asserting it refuses to signal a mismatched
// identity, per this task's own acceptance criteria.
// ---------------------------------------------------------------------------

test("verifiedKill: refuses to signal when the recorded identity does not appear in the target process's own argument string", async () => {
  const child = spawn("/bin/sleep", ["30"]);
  const pid = child.pid;
  assert.ok(typeof pid === "number");
  try {
    await waitFor(() => isAlive(pid), 2000);

    const stage = await verifiedKill({ pid, expectedIdentity: "/definitely/not/the/real/binary" });
    assert.equal(stage, "identity_refused");
    assert.ok(isAlive(pid), "a pid failing the identity check must be left alive, never signalled");
  } finally {
    child.kill("SIGKILL");
  }
});

test("verifiedKill: a genuine identity match proceeds to SIGTERM and returns 'sigterm' once the process exits", async () => {
  const child = spawn("/bin/sleep", ["30"]);
  const pid = child.pid;
  assert.ok(typeof pid === "number");
  try {
    await waitFor(() => isAlive(pid), 2000);

    const stage = await verifiedKill({ pid, expectedIdentity: "/bin/sleep" });
    assert.equal(stage, "sigterm");
    const gone = await waitFor(() => !isAlive(pid), 2000);
    assert.ok(gone);
  } finally {
    if (isAlive(pid)) child.kill("SIGKILL");
  }
});

test("verifiedKill: an already-exited pid returns 'already_exited' without ever signalling", async () => {
  const child = spawn("/bin/true", []);
  const pid = child.pid;
  assert.ok(typeof pid === "number");
  await waitFor(() => !isAlive(pid), 2000);

  const stage = await verifiedKill({ pid, expectedIdentity: "/bin/true" });
  assert.equal(stage, "already_exited");
});
