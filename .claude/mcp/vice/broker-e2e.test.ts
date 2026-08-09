// broker-e2e.test.ts
//
// The tracer's own end-to-end verify -- the one test that proves the WHOLE
// path this plan wires, not one layer of it: build the real artifacts,
// spawn the emitted resources/vice-broker.mjs under bare `node`, connect
// with the real container-side TCP client (vice-broker-client.ts's
// acquireOverControlPlane()), send one `acquire`, and assert the grant, the
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
import { acquireOverControlPlane, openBrokerControl } from "./vice-broker-client.ts";
import { verifiedKill } from "./broker-kill.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");

// quick-260805-9ha: the broker this file spawns (startBroker() below) binds
// its control listener INSIDE this container -- nothing here may ever dial
// the real host. openBrokerControl()/acquireOverControlPlane() no longer
// dial broker.json's own control_host field (that field is the broker's
// BIND address, "0.0.0.0", never a dial target); this override is the
// CLIENT's (this test process's) own dial knob, set once at module scope so
// every acquireOverControlPlane()/openBrokerControl() call below resolves
// to the real in-container listener instead of the bridge alias. It is
// deliberately NOT passed into the spawned broker's own env (startBroker()
// below) -- that process's bind address is governed by the separate,
// existing VICE_BROKER_CONTROL_HOST/VICE_BROKER_CONTROL_PORT knobs.
process.env.VICE_BROKER_CONTROL_DIAL_HOST = "127.0.0.1";

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
function startBroker(stateDir: string, extraEnv: Record<string, string | undefined> = {}): BrokerHandle {
  const merged: Record<string, string | undefined> = {
    ...process.env,
    VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
    VICE_BIN: "/bin/sleep",
    VICE_ARGS: "600",
    VICE_BROKER_CONTROL_PORT: "0",
    // quick-260805-9ha: this file's own module-scope override is a CLIENT
    // (this test process's) dial knob -- unset it here so the SPAWNED
    // broker's env never carries it, even though process.env above would
    // otherwise leak it in. The broker's own bind address is governed by
    // the separate VICE_BROKER_CONTROL_HOST/VICE_BROKER_CONTROL_PORT knobs.
    VICE_BROKER_CONTROL_DIAL_HOST: undefined,
    ...extraEnv,
  };
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) env[key] = value;
  }
  const child = spawn(process.execPath, [BROKER_ARTIFACT, "--repo-root", "/tmp/fake-repo-root-e2e", "--state-dir", stateDir], {
    env,
  }) as ChildProcessWithoutNullStreams;

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

async function waitForBrokerJson(stateDir: string, deadlineMs = 5000): Promise<Record<string, unknown>> {
  const path = join(stateDir, "broker.json");
  const appeared = await waitFor(() => existsSync(path) && typeof JSON.parse(readFileSync(path, "utf8")).control_port === "number", deadlineMs);
  assert.ok(appeared, "broker.json with a control_port did not appear within deadline");
  return JSON.parse(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------------
// 01.6.2.1-02-PLAN.md, Task 2: D-05/P-05/P-06 (plan 02's own probe collapse)
// retire the external-command probe mechanism the two tests below used to
// reach `ready` through (the retired env var named an always-succeeding
// shell script). Both tests now reach `ready` through the surviving
// in-process HTTP mechanism instead, via the fixture below.
// ---------------------------------------------------------------------------

/** Writes a probe-answering stub emulator to `dir` -- a small executable
 * script standing in for x64sc in the two tests below that need an
 * instance to actually reach `ready` through the surviving probe mechanism,
 * rather than merely existing as a long-lived pid the way /bin/sleep does
 * for every other test in this file.
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
 * named `-mcpserverport <port>` flag buildViceArgs() (broker-launch.mts)
 * constructs. THE ONE NON-OBVIOUS COUPLING, stated here per this task's
 * own instruction: a test using this stub must leave VICE_ARGS UNSET in
 * its own startBroker() call. buildViceArgs() takes its AS-IS branch
 * (using VICE_ARGS verbatim, WITHOUT ever appending a port) whenever
 * VICE_ARGS is set in the environment, and only takes its CONSTRUCTING
 * branch (which builds the `-mcpserverport <port>` flag from the actually
 * allocated port) when VICE_ARGS is unset -- if VICE_ARGS stayed set (as
 * every other test in this file leaves it, at "600" for /bin/sleep), this
 * stub would receive "600" as its sole argument and have no port to read.
 *
 * It binds a LOOPBACK HTTP listener on that port and answers every request
 * with a JSON body carrying both substrings defaultHttpProbe()
 * (broker-launch.mts) requires ("version" and "machine"), then stays alive
 * indefinitely -- exactly like /bin/sleep did for the retiring
 * probe-command fixture this replaces. Rebinding after a kill relies on
 * the OS's own default listen-socket reuse behaviour for a fresh process;
 * the tests using this stub POLL for the respawned instance (this file's
 * own waitFor() idiom) rather than assuming an instant rebind, per the
 * project's no-wall-clock-sleep rule.
 *
 * Written as `.cjs` deliberately -- this package's nearest package.json
 * sets `"type": "module"`, which would force a same-named `.js` file into
 * ESM (breaking the plain `require("node:http")` below); `.cjs` is always
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
      'const http = require("node:http");',
      "const args = process.argv.slice(2);",
      'const idx = args.indexOf("-mcpserverport");',
      "const port = Number(args[idx + 1]);",
      "const server = http.createServer((_req, res) => {",
      '  res.setHeader("Content-Type", "application/json");',
      '  res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { version: "stub-emulator", machine: "stub-emulator" } }));',
      "});",
      'server.listen(port, "127.0.0.1");',
      "",
    ].join("\n"),
  );
  chmodSync(stubPath, 0o755);
  return stubPath;
}

/** Sends one raw acquire request, bypassing acquireOverControlPlane() --
 * used for the token-refusal cases, which need to control (or omit) the
 * token directly. Resolves with the first response line and whether the
 * connection was destroyed by the server. */
function rawAcquire(host: string, port: number, body: Record<string, unknown>): Promise<{ response: Record<string, unknown>; serverClosed: boolean }> {
  return new Promise((resolvePromise, reject) => {
    const socket = connect({ host, port });
    let buffer = "";
    let responded = false;
    socket.on("connect", () => {
      socket.write(`${JSON.stringify(body)}\n`);
    });
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const idx = buffer.indexOf("\n");
      if (idx !== -1 && !responded) {
        responded = true;
        const response = JSON.parse(buffer.slice(0, idx)) as Record<string, unknown>;
        // Give the server a moment to destroy the connection (it does so
        // synchronously right after writing, but the FIN/RST needs one
        // more tick to be observed on this side).
        setTimeout(() => {
          resolvePromise({ response, serverClosed: socket.destroyed || socket.readableEnded });
        }, 100);
      }
    });
    socket.on("error", reject);
  });
}

test(
  "end-to-end: one acquire over the TCP control plane spawns exactly one stub child, writes its epoch, grants, and connection-close identity-verified-kills it",
  { timeout: 20000 },
  async () => {
    build(); // ensure resources/ is a fresh build of the current TypeScript source
    const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-"));
    const handle = startBroker(stateDir);
    try {
      const brokerJson = await waitForBrokerJson(stateDir);
      assert.equal(brokerJson.control_host, "0.0.0.0", `container.json contents: ${JSON.stringify(brokerJson)}`);
      // This assertion now documents the whole point of the fix (quick-260805-9ha):
      // the record says "0.0.0.0" -- the broker's own BIND address -- and the
      // client below dials elsewhere (this file's own VICE_BROKER_CONTROL_DIAL_HOST
      // override), never that recorded value.

      const acquired = await acquireOverControlPlane(stateDir);
      const grant = acquired.grant;

      assert.ok(Number.isInteger(grant.port) && grant.port >= 6600, `grant.port must be an integer >= 6600, got ${grant.port}`);
      assert.equal(typeof grant.url, "string");
      assert.equal(typeof grant.epoch_file, "string");
      assert.equal(typeof grant.supervisor_dir, "string");
      assert.equal(typeof grant.id, "string");

      // Exactly one child spawned: exactly one per-port directory under
      // stateDir carrying an epoch.json.
      const portDirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
      assert.equal(portDirs.length, 1, `expected exactly one instance directory, found ${JSON.stringify(portDirs.map((d) => d.name))}`);

      assert.ok(existsSync(grant.epoch_file), `epoch file must exist at ${grant.epoch_file}`);
      const epoch = JSON.parse(readFileSync(grant.epoch_file, "utf8"));
      assert.equal(typeof epoch.pid, "number");
      assert.ok(isAlive(epoch.pid), `spawned child pid ${epoch.pid} must be alive right after grant`);

      const childPid: number = epoch.pid;

      // Connection close IS the release -- assert the child is gone within
      // a deadline, never on a wall-clock sleep alone.
      acquired.release();
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
      await waitForBrokerJson(stateDir);
      const acquired = await acquireOverControlPlane(stateDir);
      const grant = acquired.grant;

      const epochBefore = JSON.parse(readFileSync(grant.epoch_file, "utf8"));
      const pidBefore: number = epochBefore.pid;
      assert.equal(typeof pidBefore, "number");
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
          epoch = JSON.parse(readFileSync(grant.epoch_file, "utf8"));
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

      const epochAfter = JSON.parse(readFileSync(grant.epoch_file, "utf8"));
      assert.equal(epochAfter.epoch, epochBefore.epoch + 1, "the epoch integer must advance by exactly one on respawn");
      assert.notEqual(epochAfter.pid, pidBefore, "the respawned child must be a DIFFERENT pid from the killed one");
      assert.ok(isAlive(epochAfter.pid), "the respawned child's pid must answer a zero-signal liveness check");

      const portDirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
      assert.equal(portDirs.length, 1, `exactly one instance directory must exist after the respawn, found ${JSON.stringify(portDirs.map((d) => d.name))}`);
      assert.equal(Number(portDirs[0].name), grant.port, "the respawned instance must occupy the SAME port the original grant named");

      assert.equal(handle.child.exitCode, null, "the broker process itself must still be running after the respawn");
      assert.equal(handle.child.signalCode, null, "the broker process itself must not have been signalled");

      acquired.release();
    } finally {
      await stopBroker(handle);
      rmSync(stateDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// 01.6.2-12-PLAN.md, Task 2: expands the proven slice to the warm-floor
// launch path. This test needs a real readiness mechanism to observe a
// spare at all, so it spawns the probe-answering stub emulator above in
// place of /bin/sleep (MIGRATED off the retiring external-command probe
// fixture by 01.6.2.1-02-PLAN.md, Task 2 -- see writeProbeAnsweringStub()'s
// own header comment). The warm floor is configured to 1 via
// VICE_BROKER_WARM_FLOOR so the instance-directory count assertions below are
// unambiguous (recorded here and in the plan's own SUMMARY for
// reproducibility).
// ---------------------------------------------------------------------------

test(
  "wired supervision: a warm-floor stub child killed out from under the real broker is respawned on the same port by the same wrapper",
  { timeout: 20000 },
  async () => {
    build();
    const WARM_FLOOR = 1;
    const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-supervise-warm-"));
    const probeDir = mkdtempSync(join(tmpdir(), "broker-e2e-probe-"));
    const stubPath = writeProbeAnsweringStub(probeDir);
    // VICE_ARGS deliberately UNSET (not merely omitted) -- see
    // writeProbeAnsweringStub()'s own header comment for why the stub
    // depends on buildViceArgs()'s CONSTRUCTING branch running.
    const handle = startBroker(stateDir, {
      VICE_RESTART_BACKOFF_S: "0",
      VICE_BIN: stubPath,
      VICE_ARGS: undefined,
      VICE_BROKER_WARM_FLOOR: String(WARM_FLOOR),
    });
    try {
      await waitForBrokerJson(stateDir);

      // The periodic evaluation pass, not this test, decides when the spare
      // actually launches -- poll for its instance directory to appear
      // rather than assuming a fixed number of poll intervals have elapsed.
      const warmInstanceAppeared = await waitFor(() => {
        const dirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
        return dirs.length >= 1;
      }, 10000);
      assert.ok(warmInstanceAppeared, "a warm spare must be launched by the periodic evaluation pass within the deadline");

      const portDirsBefore = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
      assert.equal(
        portDirsBefore.length,
        WARM_FLOOR,
        `exactly the configured warm floor (${WARM_FLOOR}) of instance directories must exist, found ${JSON.stringify(portDirsBefore.map((d) => d.name))}`,
      );
      const warmPort = Number(portDirsBefore[0].name);
      const epochPath = join(stateDir, portDirsBefore[0].name, "epoch.json");

      const epochAppeared = await waitFor(() => {
        try {
          const parsed = JSON.parse(readFileSync(epochPath, "utf8"));
          return typeof parsed.pid === "number";
        } catch {
          return false;
        }
      }, 5000);
      assert.ok(epochAppeared, "the warm spare's epoch.json must carry a pid within the deadline");

      const epochBefore = JSON.parse(readFileSync(epochPath, "utf8"));
      const pidBefore: number = epochBefore.pid;
      assert.ok(isAlive(pidBefore), `warm spare pid ${pidBefore} must be alive before the kill`);

      // Kill the warm spare from OUTSIDE the broker, exactly like the
      // cold-acquire proof above -- the SAME wrapper must observe this exit
      // regardless of which launch path produced the child.
      process.kill(pidBefore, "SIGKILL");
      const killedGone = await waitFor(() => !isAlive(pidBefore), 5000);
      assert.ok(killedGone, `killed warm spare pid ${pidBefore} must actually exit before a respawn can be observed`);

      const respawned = await waitFor(() => {
        let epoch: Record<string, unknown>;
        try {
          epoch = JSON.parse(readFileSync(epochPath, "utf8"));
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
      assert.ok(respawned, "the killed warm spare must be respawned on the same port with an advanced epoch and a new, live pid within the deadline");

      const epochAfter = JSON.parse(readFileSync(epochPath, "utf8"));
      assert.equal(epochAfter.epoch, epochBefore.epoch + 1, "the epoch integer must advance by exactly one on respawn");

      // The respawn must not be double-counted as an additional spare --
      // poll for the ABSENCE of a second instance directory within a
      // bounded deadline, using the SAME predicate-polling helper (inverted)
      // rather than sleeping a fixed duration and hoping nothing appeared.
      const extraSpareAppeared = await waitFor(() => {
        const dirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
        return dirs.length > WARM_FLOOR;
      }, 1500);
      assert.equal(extraSpareAppeared, false, "the respawn must not be read as an additional spare, warming a second one on top of it");

      const portDirsAfter = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
      assert.equal(
        portDirsAfter.length,
        WARM_FLOOR,
        `exactly the configured warm floor (${WARM_FLOOR}) of instance directories must remain after the respawn, found ${JSON.stringify(portDirsAfter.map((d) => d.name))}`,
      );
      assert.equal(Number(portDirsAfter[0].name), warmPort, "the respawned instance must occupy the SAME port the warm spare originally held");

      assert.equal(handle.child.exitCode, null, "the broker process itself must still be running after the respawn");
      assert.equal(handle.child.signalCode, null, "the broker process itself must not have been signalled");
    } finally {
      await stopBroker(handle);
      rmSync(stateDir, { recursive: true, force: true });
      rmSync(probeDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// 01.6.2.1-01-PLAN.md, Task 1 (P-01/P-04): the e2e half of Defect 5's close --
// an acquire over the REAL control plane, against the REAL spawned broker
// artifact, served from an already-warm instance rather than paying a cold
// launch. A unit test cannot see an orphaned module (handleAcquire() could
// be perfectly correct in isolation while the real entry point never reaches
// it -- exactly 01.6.2's own crash-supervisor gap, and this plan's own
// Defect 5); this is the proof a fully-controlled stub cannot give.
//
// This fixture's env var is migrated in THIS plan's own commit
// (01.6.2.1-05-PLAN.md, D-10/D-11): the retired predecessor variable's name
// is gone, and this fixture now sets VICE_BROKER_WARM_FLOOR, matching the
// landed warm-floor supervision test above. The OTHER retiring fixture
// this test used to depend on (the external-command probe env var) is
// MIGRATED as of 01.6.2.1-02-PLAN.md, Task 2 -- this test now reaches
// `ready` through the surviving in-process HTTP mechanism via the
// probe-answering stub emulator above, the same fixture the landed
// supervision test just above was migrated onto.
// ---------------------------------------------------------------------------

test(
  "wired warm floor: an acquire over the real control plane with one probe-live warm instance ready is served from it and spawns no second instance (Defect 5, P-01/P-04)",
  { timeout: 20000 },
  async () => {
    build();
    const WARM_FLOOR = 1;
    const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-warm-acquire-"));
    const probeDir = mkdtempSync(join(tmpdir(), "broker-e2e-warm-acquire-probe-"));
    const stubPath = writeProbeAnsweringStub(probeDir);
    // VICE_ARGS deliberately UNSET (not merely omitted) -- see
    // writeProbeAnsweringStub()'s own header comment for why the stub
    // depends on buildViceArgs()'s CONSTRUCTING branch running.
    const handle = startBroker(stateDir, {
      VICE_BIN: stubPath,
      VICE_ARGS: undefined,
      VICE_BROKER_WARM_FLOOR: String(WARM_FLOOR),
    });
    try {
      await waitForBrokerJson(stateDir);

      // The periodic evaluation pass, not this test, decides when the spare
      // actually launches -- poll for its instance directory to appear
      // rather than assuming a fixed number of poll intervals have elapsed.
      const warmInstanceAppeared = await waitFor(() => {
        const dirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
        return dirs.length >= 1;
      }, 10000);
      assert.ok(warmInstanceAppeared, "a warm spare must be launched by the periodic evaluation pass within the deadline");

      const portDirsBeforeAcquire = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
      assert.equal(portDirsBeforeAcquire.length, 1, `expected exactly one warm instance directory before the acquire, found ${JSON.stringify(portDirsBeforeAcquire.map((d) => d.name))}`);
      const warmPort = Number(portDirsBeforeAcquire[0].name);

      // Wait for the warm instance's OWN epoch.json to actually carry a pid
      // first (the instance directory can appear one launch step ahead of
      // this), then wait for the record's own STATE to reach "ready" --
      // maintainWarmFloor() only promotes "launching" -> "ready" via its own
      // probe pass on a LATER poll tick (VICE_BROKER_POLL_MS), and
      // handleAcquire()'s warm-instance selector only ever considers a
      // record whose recorded state is "ready" (never merely "launching").
      // Polled through a SEPARATE, never-acquiring control session (status
      // is read-only) rather than the instance directory's own existence,
      // which this test already confirmed above and which says nothing
      // about the record's in-memory state.
      const epochPath = join(stateDir, portDirsBeforeAcquire[0].name, "epoch.json");
      const epochAppeared = await waitFor(() => {
        try {
          const parsed = JSON.parse(readFileSync(epochPath, "utf8"));
          return typeof parsed.pid === "number";
        } catch {
          return false;
        }
      }, 5000);
      assert.ok(epochAppeared, "the warm spare's epoch.json must carry a pid within the deadline");

      const pollOutcome = await openBrokerControl(stateDir);
      assert.ok(pollOutcome.ok, `openBrokerControl (status poll) failed: ${JSON.stringify(pollOutcome)}`);
      let becameReady = false;
      if (pollOutcome.ok) {
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline && !becameReady) {
          const statusResult = await pollOutcome.session.status();
          if (statusResult.ok) {
            const entry = statusResult.instances.find((i) => i.port === warmPort);
            if (entry && entry.state === "ready") {
              becameReady = true;
              break;
            }
          }
          await new Promise((r) => setTimeout(r, 25));
        }
        await pollOutcome.session.release();
      }
      assert.ok(becameReady, "the warm instance must reach recorded state \"ready\" within the deadline before the acquire is sent");

      const acquired = await acquireOverControlPlane(stateDir);
      const grant = acquired.grant;

      assert.equal(grant.port, warmPort, "the grant must name the ALREADY-EXISTING warm instance's own port, not a freshly allocated one");

      // The load-bearing assertion: still exactly ONE instance directory --
      // no second instance was spawned to satisfy this acquire.
      const portDirsAfterAcquire = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
      assert.equal(
        portDirsAfterAcquire.length,
        1,
        `expected exactly one instance directory to still exist after the acquire (served from the warm floor, no cold launch), found ${JSON.stringify(portDirsAfterAcquire.map((d) => d.name))}`,
      );
      assert.equal(Number(portDirsAfterAcquire[0].name), warmPort, "the sole remaining instance directory must be the SAME warm instance the grant named");

      acquired.release();
    } finally {
      await stopBroker(handle);
      rmSync(stateDir, { recursive: true, force: true });
      rmSync(probeDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// 01.6.2-13-PLAN.md, Task 3: the wired proof that recycle respawns and
// release does not, both against the real spawned broker artifact -- the
// direction plan 12 wired but plan 13's marker split (Tasks 1-2, above) is
// what makes SAFE to reach through the real control plane rather than only
// through superviseChild() in isolation (broker-launch.test.ts already
// covers the recycle branch's own behavior against a fully controlled
// stub).
//
// A recycle's OWNERSHIP check (broker-control.mts) requires the recycle's
// target_id to be the SAME requestId the acquiring connection itself holds
// -- both tests below therefore hold ONE connection across both requests.
// openBrokerControl()'s own session.recycle() discards the ack's
// epoch_before field (it only returns outcome/kill_stage/reason), so proving
// "epoch-before carries the recorded integer, not an absent value" needs
// the raw wire-level ack -- per this task's own instruction, this is done
// with a raw-request helper local to THIS test file (generalising
// rawAcquire() above to hold one connection across several round trips),
// never by adding a field to vice-broker-client.ts for a test's
// convenience.
// ---------------------------------------------------------------------------

/** A held raw connection supporting several sequential request/response
 * round trips over ONE socket -- generalises rawAcquire() above (which
 * sends exactly one line and is done) for this task's own proof, which
 * needs ONE connection to both acquire AND recycle (broker-control.mts's
 * own ownership discipline: a connection may only recycle the grant it
 * itself holds). Test-local infrastructure only -- never touches
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
  "wired recycle: a recycle over the real control plane kills the granted child and the real broker brings a new one back on the SAME port with the epoch advanced",
  { timeout: 20000 },
  async () => {
    build();
    const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-recycle-"));
    // VICE_BROKER_WARM_FLOOR=0: this test's port-count and pid-stability
    // assertions are only meaningful if NOTHING besides this test's own
    // acquire/recycle sequence ever launches or frees a port. Node's global
    // fetch gives maintainWarmFloor() a real HTTP readiness mechanism by
    // default (never "no_mechanism"), so leaving the warm floor at its
    // default of 3 would auto-launch speculative spares on other free ports
    // during this test's own wait windows -- disabling it here isolates the
    // scenario this test is actually proving.
    const handle = startBroker(stateDir, { VICE_RESTART_BACKOFF_S: "0", VICE_BROKER_POLL_MS: "100", VICE_BROKER_WARM_FLOOR: "0" });
    try {
      const brokerJson = await waitForBrokerJson(stateDir);
      const host = String(brokerJson.control_host);
      const port = Number(brokerJson.control_port);
      const token = String(brokerJson.control_token);

      const client = makeRawSession(host, port);
      try {
        // Acquire and recycle over the SAME connection -- the ownership
        // check requires it (T-01.6.2-31).
        const grantId = "recycle-proof-acquire";
        client.send({ op: "acquire", id: grantId, token });
        const grantResp = await client.next();
        assert.equal(grantResp.kind, "grant", `expected a grant, got: ${JSON.stringify(grantResp)}`);
        const grantPort = Number(grantResp.port);
        const epochFile = String(grantResp.epoch_file);

        const epochBefore = JSON.parse(readFileSync(epochFile, "utf8"));
        const pidBefore: number = epochBefore.pid;
        const epochNumBefore: number = epochBefore.epoch;
        assert.equal(typeof pidBefore, "number");
        assert.ok(isAlive(pidBefore), `granted child pid ${pidBefore} must be alive before the recycle`);

        client.send({ op: "recycle", id: "recycle-proof-recycle", target_id: grantId, token });
        const ack = await client.next();
        assert.equal(ack.kind, "recycle_ack", `expected a recycle_ack, got: ${JSON.stringify(ack)}`);
        assert.equal(ack.outcome, "ok", `recycle ack outcome must be "ok": ${JSON.stringify(ack)}`);
        assert.notEqual(ack.epoch_before, null, "the epoch-before field must carry the recorded integer, not an absent value");
        assert.equal(ack.epoch_before, epochNumBefore, "the epoch-before field must carry the SAME integer the instance held before the kill");

        const respawned = await waitFor(() => {
          let epoch: Record<string, unknown>;
          try {
            epoch = JSON.parse(readFileSync(epochFile, "utf8"));
          } catch {
            return false;
          }
          return (
            typeof epoch.epoch === "number" &&
            epoch.epoch > epochNumBefore &&
            typeof epoch.pid === "number" &&
            epoch.pid !== pidBefore &&
            isAlive(epoch.pid as number)
          );
        }, 10000);
        assert.ok(respawned, "the recycled instance must be respawned on the same port with an advanced epoch and a new, live pid within the deadline");

        const epochAfter = JSON.parse(readFileSync(epochFile, "utf8"));
        assert.equal(epochAfter.epoch, epochNumBefore + 1, "the epoch integer must advance by exactly one on recycle");
        assert.notEqual(epochAfter.pid, pidBefore, "the respawned child must be a DIFFERENT pid from the killed one");

        const portDirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
        assert.equal(portDirs.length, 1, `exactly one instance directory must exist after the recycle, found ${JSON.stringify(portDirs.map((d) => d.name))}`);
        assert.equal(Number(portDirs[0].name), grantPort, "the recycled instance must occupy the SAME port the grant named");

        client.send({ op: "status", token });
        const status = await client.next();
        assert.equal(status.kind, "status");
        const instances = status.instances as Array<Record<string, unknown>>;
        const onRecycledPort = instances.filter((i) => Number(i.port) === grantPort);
        assert.equal(instances.length, 1, `exactly one instance must be reported after the recycle, got ${JSON.stringify(instances)}`);
        assert.equal(onRecycledPort.length, 1, `exactly one instance must be reported on the recycled port ${grantPort}, got ${JSON.stringify(instances)}`);

        client.send({ op: "release", token });
        await client.next();
      } finally {
        client.close();
      }
    } finally {
      await stopBroker(handle);
      rmSync(stateDir, { recursive: true, force: true });
    }
  },
);

test(
  "wired release: a release over the real control plane kills the granted child and no replacement appears -- kill-never-recycle holds with supervision wired",
  { timeout: 20000 },
  async () => {
    build();
    const POLL_MS = 100;
    const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-release-"));
    // VICE_BROKER_WARM_FLOOR=0: same isolation reasoning as the recycle test
    // above -- a release frees its port back to the allocator, and an
    // auto-warmed spare landing on that SAME now-free port would rewrite
    // this test's own epoch.json with an unrelated pid, corrupting the
    // exact "no replacement appears" assertion this test exists to make.
    const handle = startBroker(stateDir, { VICE_RESTART_BACKOFF_S: "0", VICE_BROKER_POLL_MS: String(POLL_MS), VICE_BROKER_WARM_FLOOR: "0" });
    try {
      const brokerJson = await waitForBrokerJson(stateDir);
      const host = String(brokerJson.control_host);
      const port = Number(brokerJson.control_port);
      const token = String(brokerJson.control_token);

      const client = makeRawSession(host, port);
      try {
        client.send({ op: "acquire", id: "release-proof-acquire", token });
        const grantResp = await client.next();
        assert.equal(grantResp.kind, "grant", `expected a grant, got: ${JSON.stringify(grantResp)}`);
        const grantPort = Number(grantResp.port);
        const epochFile = String(grantResp.epoch_file);

        const epochBefore = JSON.parse(readFileSync(epochFile, "utf8"));
        const pidBefore: number = epochBefore.pid;
        assert.ok(isAlive(pidBefore), `granted child pid ${pidBefore} must be alive before the release`);

        client.send({ op: "release", token });
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

        client.send({ op: "status", token });
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
// one. See the dated entry appended to RE-FINDINGS.md by this same task for
// the general technique.
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
    // VICE_BROKER_WARM_FLOOR=0: same isolation reasoning as the recycle/release
    // tests above -- an auto-warmed spare (Node's global fetch makes the
    // warm floor's readiness mechanism real by default) could land on some
    // OTHER free candidate in this same widened scan region and add a
    // second, unrelated instance, corrupting this test's own "exactly one
    // instance" assertions.
    const handle = startBroker(stateDir, {
      VICE_BROKER_POLL_MS: String(POLL_MS),
      VICE_BROKER_WARM_FLOOR: "0",
      VICE_BROKER_BASE_PORT: String(OCCUPIED_BASE_PORT),
    });
    try {
      const brokerJson = await waitForBrokerJson(stateDir);
      const host = String(brokerJson.control_host);
      const port = Number(brokerJson.control_port);
      const token = String(brokerJson.control_token);

      const a = makeRawSession(host, port);
      const b = makeRawSession(host, port);
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
        a.send({ op: "acquire", id: "disconnect-queued-a", token });
        b.send({ op: "acquire", id: "disconnect-queued-b", token });

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
        const epochFile = String(first.r.epoch_file);
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

        servedClient.send({ op: "status", token });
        const status = await servedClient.next();
        assert.equal(status.kind, "status");
        const instances = status.instances as Array<Record<string, unknown>>;
        assert.equal(instances.length, 1, `the status response must list exactly one instance, got ${JSON.stringify(instances)}`);
        assert.equal(Number(instances[0].port), grantPort);

        servedClient.send({ op: "release", token });
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

test("a control request with no token, and one with a wrong token, both return the unauthorized error code, are disconnected, and leave the spawn count unchanged", { timeout: 20000 }, async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-auth-"));
  const handle = startBroker(stateDir);
  try {
    const brokerJson = await waitForBrokerJson(stateDir);
    const host = String(brokerJson.control_host);
    const port = Number(brokerJson.control_port);

    const noToken = await rawAcquire(host, port, { op: "acquire", id: "req-no-token" });
    assert.equal(noToken.response.kind, "error");
    assert.equal(noToken.response.code, "unauthorized");

    const wrongToken = await rawAcquire(host, port, { op: "acquire", id: "req-wrong-token", token: "0".repeat(64) });
    assert.equal(wrongToken.response.kind, "error");
    assert.equal(wrongToken.response.code, "unauthorized");

    // Neither request allocated an instance directory.
    const portDirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
    assert.equal(portDirs.length, 0, `unauthorized requests must not spawn anything, found ${JSON.stringify(portDirs.map((d) => d.name))}`);
  } finally {
    await stopBroker(handle);
    rmSync(stateDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 01.6.2-10-PLAN.md ledger row 35 (RE-OBSERVED): the retiring bash suite's
// "bash -n exits 0; start still refuses in-container with exit 2;
// --check-container still exits 3" structural test asserted the container
// guard's exit-code contract directly against resources/vice-broker.sh. The
// new broker wires the SAME container-guard.mts functions
// (containerGuardEnforce()/containerGuardReport(), pre-existing and unchanged
// -- vice-broker.mts:650/654) but no test spawned the real emitted artifact
// to prove the wiring itself (as opposed to the guard functions in
// isolation, which container-guard.test.ts already covers). This container
// genuinely fires container signals (the retiring test's own comment already
// establishes that), so this is a real, not simulated, in-container run.
// ---------------------------------------------------------------------------

test("the emitted broker artifact refuses to start in-container without the escape hatch (exit 2), and --check-container reports the same verdict without refusing (exit 3)", { timeout: 20000 }, async () => {
  build();
  const stateDir = mkdtempSync(join(tmpdir(), "broker-e2e-guard-"));
  try {
    // No VICE_SUPERVISOR_ALLOW_CONTAINER escape hatch here -- deliberately
    // the opposite of every other test in this file, which sets it via
    // startBroker()'s own env block.
    const refused = spawn(process.execPath, [BROKER_ARTIFACT, "--repo-root", "/tmp/fake-repo-root-e2e", "--state-dir", stateDir], {
      env: { ...process.env, VICE_SUPERVISOR_ALLOW_CONTAINER: "", VICE_BIN: "/bin/sleep", VICE_ARGS: "600" },
    });
    const refusedCode = await new Promise<number | null>((resolvePromise) => {
      refused.once("exit", (code) => resolvePromise(code));
    });
    assert.equal(refusedCode, 2, "starting in-container with no escape hatch must exit 2");
    assert.equal(existsSync(join(stateDir, "broker.json")), false, "a refused start must never write broker.json");

    const reported = spawn(process.execPath, [BROKER_ARTIFACT, "--check-container"], {
      env: { ...process.env, VICE_SUPERVISOR_ALLOW_CONTAINER: "" },
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
