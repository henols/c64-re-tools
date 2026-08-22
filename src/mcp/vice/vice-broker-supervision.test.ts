// vice-broker-supervision.test.ts
//
// 03-REVIEW.md CR-01: the regression gate over the ONE thing every other
// supervision test in this tree structurally cannot see -- the shape of the
// SuperviseChildDeps object the REAL broker actually builds.
//
// broker-launch.test.ts's own respawn/recycle tests each construct their deps
// inline, so they can (and do) set `backend: "stock"` by hand; vice-broker.mts
// builds its deps in exactly one place (superviseDepsFor()) and, until CR-01,
// never set that field at all. Both files were green while a stock instance's
// crash-respawn silently relaunched with the FORK's `-mcpserver` argv. This
// file closes that gap by driving a real crash-respawn through the PRODUCTION
// deps builder -- never a hand-built stand-in.
//
// Covers the EMITTED resources/*.mjs directly, following
// vice-broker-acquire.test.ts's own convention: vice-broker.mts cannot be
// imported unbuilt (it value-imports its siblings by their ".mjs" specifier),
// so this `.ts` file builds first and then dynamically imports the artifact.
//
// No real emulator, no real subprocess and no real socket anywhere in this
// file: the child is a bare EventEmitter with a fake pid (broker-launch.mts's
// own `child.once("exit", ...)` wiring works against it unchanged), and the
// only real I/O is the epoch/log bookkeeping launchSupervised() writes under a
// throwaway temp state directory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

import { build } from "./build.ts";
import type { BrokerState, InstanceRecord } from "./broker-state.mts";
import type { SuperviseChildDeps } from "./broker-launch.mts";
import type { ViceBackend } from "./backend-detect.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT_URL = new URL("./resources/vice-broker.mjs", import.meta.url).href;
const LAUNCH_ARTIFACT_URL = new URL("./resources/broker-launch.mjs", import.meta.url).href;

interface BrokerModule {
  _superviseDepsFor: (stateDir: string, state: BrokerState, backend: ViceBackend, binmonHost?: string) => SuperviseChildDeps;
}

interface LaunchModule {
  withCrashSupervision: (
    reason: string,
    port: number,
    baseSpawn: (command: string, args: string[]) => ChildProcess,
    deps: SuperviseChildDeps,
  ) => (command: string, args: string[]) => ChildProcess;
}

/** Rebuilds resources/ from the current TypeScript source, then imports the
 * FRESH emitted artifacts -- the same `build();`-then-`import()` idiom
 * vice-broker-acquire.test.ts and broker-e2e.test.ts already use. Both modules
 * come from the SAME build pass, so the wrapper under test is literally the
 * one vice-broker.mjs itself imports at runtime. */
async function loadModules(): Promise<{ broker: BrokerModule; launch: LaunchModule }> {
  build();
  const broker = (await import(BROKER_ARTIFACT_URL)) as unknown as BrokerModule;
  const launch = (await import(LAUNCH_ARTIFACT_URL)) as unknown as LaunchModule;
  return { broker, launch };
}

function createState(): BrokerState {
  return { instances: new Map(), grants: new Map(), blockedPorts: new Set() };
}

/** A fully-controlled stand-in ChildProcess -- a real EventEmitter (so the
 * supervision wrapper's own `child.once("exit", ...)` works exactly as it
 * would against a real ChildProcess) with a FAKE pid and no OS process behind
 * it. Copied in shape from broker-launch.test.ts's own fakeChild(); the test
 * itself decides when this "child" exits. */
let fakePidCounter = 91000;
function fakeChild(): ChildProcess {
  const emitter = new EventEmitter();
  (emitter as unknown as { pid: number }).pid = fakePidCounter++;
  return emitter as unknown as ChildProcess;
}

async function waitFor<T>(predicate: () => T | null | undefined, { timeoutMs = 8000, pollMs = 10 } = {}): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = predicate();
    if (result) return result;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return null;
}

/** Strips block comments and whole-line `//` comments before any count-based
 * structural assertion, exactly like broker-launch.test.ts's own helper of the
 * same name -- a doc comment mentioning a counted token must never inflate a
 * count. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/** The record a stock cold launch leaves behind, as spawnAndRecordInstance()
 * would have written it -- the object handleExit() reads when the child dies. */
function stockInstanceRecord(port: number, pid: number, supervisorDir: string): InstanceRecord {
  return {
    port,
    url: `http://127.0.0.1:${port}/mcp`,
    state: "ready",
    reason: "acquire",
    epochFile: join(supervisorDir, "epoch.json"),
    supervisorDir,
    pid,
    expectedIdentity: "x64sc",
    launchedAt: Date.now(),
    readyAt: Date.now(),
    viceBin: "x64sc",
    viceArgs: ["-binarymonitor", "-binarymonitoraddress", `ip4://127.0.0.1:${port}`],
    dryRun: false,
  };
}

// ===========================================================================
// CR-01 (03-REVIEW.md): a crash-respawn built from the PRODUCTION deps builder
// must still be a stock launch.
// ===========================================================================

test("CR-01: a crash-respawn installed through the REAL superviseDepsFor() relaunches a stock instance with stock's argv, not the fork's", async () => {
  const { broker, launch } = await loadModules();
  const stateDir = mkdtempSync(join(tmpdir(), "vice-broker-supervision-"));
  try {
    const state = createState();
    const port = 6789;
    const supervisorDir = join(stateDir, String(port));

    // THE point of this file: the deps object under test comes from the
    // production builder, called exactly as vice-broker.mts's own two launch
    // paths call it. Nothing below hand-writes a `backend` field.
    const realDeps = broker._superviseDepsFor(stateDir, state, "stock");
    assert.equal(realDeps.backend, "stock", "the production deps builder must carry the resolved backend -- CR-01's whole defect was this field being absent");

    // The builder deliberately supplies NEITHER spawn NOR spawnFactory (see
    // superviseDepsFor()'s own doc comment on why a competing spawn factory
    // would produce two log files per respawn). Asserting that here is what
    // makes the two test-only overrides below honest: they ADD a seam the real
    // object leaves open, they never mask a real value.
    assert.equal(realDeps.spawn, undefined, "superviseDepsFor() must not set spawn -- the override below would otherwise be masking production behaviour");
    assert.equal(realDeps.spawnFactory, undefined, "superviseDepsFor() must not set spawnFactory -- the override below would otherwise be masking production behaviour");

    const respawnSpawns: Array<{ command: string; args: string[] }> = [];
    const deps: SuperviseChildDeps = {
      ...realDeps,
      // Keeps the respawn off any real process and off wall-clock time; every
      // field CR-01 is actually about (backend, and the argv it produces)
      // still comes from realDeps above.
      spawn: (command: string, args: string[]): ChildProcess => {
        respawnSpawns.push({ command, args });
        return fakeChild();
      },
      sleepMs: async (): Promise<void> => {},
    };

    const baseSpawn = (): ChildProcess => fakeChild();
    const wrappedSpawn = launch.withCrashSupervision("acquire", port, baseSpawn, deps);

    // Spawn through the wrapper (installing the exit listener), then record the
    // instance exactly as spawnAndRecordInstance() does immediately after its
    // own spawn call.
    const child = wrappedSpawn("x64sc", ["-binarymonitor", "-binarymonitoraddress", `ip4://127.0.0.1:${port}`]);
    const originalPid = child.pid as number;
    state.instances.set(port, stockInstanceRecord(port, originalPid, supervisorDir));

    // An UNEXPLAINED exit -- no deliberateKill marker -- which is exactly the
    // crash-and-respawn path crash supervision exists for.
    child.emit("exit", 1, null);

    const respawned = await waitFor(() => {
      const record = state.instances.get(port);
      return record && record.pid !== originalPid ? record : null;
    });

    assert.ok(respawned, "the crashed stock instance must be respawned by the crash supervisor");
    assert.equal(respawnSpawns.length, 1, `expected exactly one respawn spawn, got ${respawnSpawns.length}`);

    const respawnArgs = respawnSpawns[0]!.args;
    assert.ok(
      respawnArgs.includes("-binarymonitor"),
      `CR-01 REGRESSION: the respawned argv must still be stock's, got ${JSON.stringify(respawnArgs)}`,
    );
    assert.ok(
      !respawnArgs.includes("-mcpserver"),
      `CR-01 REGRESSION: the respawned argv carries the FORK's -mcpserver flag, which stock upstream VICE does not understand: ${JSON.stringify(respawnArgs)}`,
    );
    assert.deepEqual(respawned.viceArgs, respawnArgs, "the respawned instance record must carry the argv the respawn was actually spawned with");
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

// ===========================================================================
// CR-01, structural half: the two production call sites must pass a resolved
// backend. The behavioural test above proves the BUILDER threads what it is
// given; this proves the CALLERS give it something, which is the half a
// signature change alone could still regress (e.g. a literal "fork" typed in
// at a stock call site).
// ===========================================================================

test("structural: every superviseDepsFor() call site in vice-broker.mts passes the resolved backend, never the two-argument form CR-01 shipped", () => {
  const brokerSource = stripComments(readFileSync(join(HERE, "vice-broker.mts"), "utf8"));

  const twoArgCallSites = (brokerSource.match(/superviseDepsFor\(\s*stateDir\s*,\s*state\s*\)/g) ?? []).length;
  assert.equal(
    twoArgCallSites,
    0,
    `CR-01 REGRESSION: found ${twoArgCallSites} superviseDepsFor(stateDir, state) call site(s) with no backend argument -- a respawn built from that deps object falls back to the fork's argv`,
  );

  const backendCallSites = (brokerSource.match(/superviseDepsFor\(\s*stateDir\s*,\s*state\s*,\s*backend\b/g) ?? []).length;
  assert.equal(
    backendCallSites,
    2,
    `expected exactly 2 superviseDepsFor(stateDir, state, backend...) call sites (handleAcquire's cold arm and maintainWarmFloorForRealBroker), found ${backendCallSites} -- a new supervised launch path must thread the resolved backend too`,
  );
});
