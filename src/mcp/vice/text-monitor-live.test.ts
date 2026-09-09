#!/usr/bin/env node
// text-monitor-live.test.ts
//
// OPT-IN, MANUAL-ONLY. Phase 41 plan 41-01's ONE live end-to-end proof:
// a stock grant carries its text-monitor port to the container, textConnect()
// dials it, and one real text-monitor command (`device c:`) returns its
// complete, prompt-framed response against genuine stock VICE 3.9.
//
// Mirrors stock-live-broker-monitor.test.ts's own harness shape (a real
// broker daemon, spawned from the emitted resources/vice-broker.mjs
// artifact, driving a real genuine-stock x64sc) -- see that file's own
// header comment for the full reachability analysis this harness reuses
// unchanged. This file adds nothing to that analysis: it needs only ONE
// grant, ONE claim, ONE command, never a second session or a crash respawn.
//
// Registered as MANUAL_ONLY_TESTS' THIRTEENTH entry in test-gate.mjs.
//
// Opt in with:
//   VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts
//
// WHAT NOT TO DO:
//   - Never acquire a child process, socket, or temp dir outside
//     withBrokerHarness()'s own try/finally -- teardown must run even when
//     an assertion throws.
//   - Never run this file (or any live suite) while a broker daemon or a
//     leftover x64sc process is already running -- D-16's own discipline
//     (39-CONTEXT.md): a live broker deterministically reddens the BACK-05
//     ordering assertion and voids any live capture in this same run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "node:net";

import { build } from "./build.ts";
import { openBrokerControl, type BrokerControlSession } from "./vice-broker-client.ts";
import { textConnect, textDisconnect } from "./text-connect.ts";
import { TEXT_COMMAND_ALLOWLIST } from "./text-protocol.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");

// ---------------------------------------------------------------------------
// Opt-in gate -- mirrors stock-live-broker-monitor.test.ts's own gate exactly.
// ---------------------------------------------------------------------------

const VICE_LIVE_STOCK_BIN_ENV = process.env.VICE_LIVE_STOCK_BIN;

const SKIP_REASON: string | false = !VICE_LIVE_STOCK_BIN_ENV
  ? "text-monitor-live.test.ts is opt-in and default-skipped -- set VICE_LIVE_STOCK_BIN=/usr/bin/x64sc " +
    "(or another real, genuinely unpatched stock VICE binary's absolute path) to run it. A bare \"x64sc\" on PATH " +
    "resolves to the fork build (which has no -remotemonitor text channel), always name the stock binary by " +
    "absolute path."
  : !existsSync(VICE_LIVE_STOCK_BIN_ENV)
    ? `VICE_LIVE_STOCK_BIN="${VICE_LIVE_STOCK_BIN_ENV}" does not exist on disk -- opt-in requires a real stock ` +
      "VICE binary at that absolute path (e.g. /usr/bin/x64sc). A bare \"x64sc\" on PATH would resolve to the " +
      "fork build instead of genuine stock."
    : false;

// This file's own dial knob -- every openBrokerControl() call below resolves
// to the loopback control listener this test's OWN spawned broker binds,
// never the bridge alias resolveControlTarget() would otherwise fall back
// to. Matches stock-live-broker-monitor.test.ts's own precedent exactly.
process.env.VICE_BROKER_CONTROL_DIAL_HOST = "127.0.0.1";

// ---------------------------------------------------------------------------
// Small shared helpers -- copied from stock-live-broker-monitor.test.ts's own
// (not imported: that file's helpers are module-local, not exported, and
// re-deriving a five-line polling helper here is cheaper than exporting a
// second file's test-only surface).
// ---------------------------------------------------------------------------

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
 * command sent, immediately closed. See
 * stock-live-broker-monitor.test.ts's own waitForPortOpen() for why this is
 * needed at all: a cold-launched instance is marked "granted" the instant
 * the process is SPAWNED, not once it has finished booting. */
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

function startBroker(stateDir: string, viceBinPath: string, scratchDir: string): BrokerHandle {
  const merged: Record<string, string | undefined> = {
    ...process.env,
    VICE_SUPERVISOR_ALLOW_CONTAINER: undefined,
    VICE_BACKEND: "stock",
    VICE_BIN: viceBinPath,
    VICE_ARGS: undefined,
    VICE_BROKER_CONTROL_PORT: "0",
    VICE_BROKER_WARM_FLOOR: "0",
    VICE_BROKER_MAX: "1",
    VICE_BROKER_POLL_MS: "250",
    VICE_RESTART_BACKOFF_S: "1",
    XDG_CONFIG_HOME: scratchDir,
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

interface HarnessReport {
  recordedPids: number[];
  pidsAliveAfterTeardown: number[];
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function withBrokerHarness(viceBinPath: string, fn: (ctx: { stateDir: string; recordPid: (pid: number) => void; host: string }) => Promise<void>): Promise<HarnessReport> {
  build(); // ensure resources/ is a fresh build of the current TypeScript source
  const scratchDir = mkdtempSync(join(tmpdir(), "text-monitor-live-"));
  const stateDir = join(scratchDir, "state");
  const recordedPids = new Set<number>();
  const handle = startBroker(stateDir, viceBinPath, scratchDir);
  let pidsAliveAfterTeardown: number[] = [];
  try {
    await waitForBrokerJson(stateDir);
    await fn({ stateDir, recordPid: (pid: number) => recordedPids.add(pid), host: "127.0.0.1" });
  } finally {
    await stopBroker(handle);
    for (const pid of recordedPids) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // already gone -- best effort.
      }
    }
    for (const pid of recordedPids) {
      const gone = await waitFor(() => !isAlive(pid), 3000);
      if (!gone) pidsAliveAfterTeardown.push(pid);
    }
    rmSync(scratchDir, { recursive: true, force: true });
    if (pidsAliveAfterTeardown.length > 0) {
      console.error(`text-monitor-live: pids still alive after teardown: ${JSON.stringify(pidsAliveAfterTeardown)}`);
    }
  }
  return { recordedPids: [...recordedPids], pidsAliveAfterTeardown };
}

// ---------------------------------------------------------------------------
// The proof.
// ---------------------------------------------------------------------------

test(
  "text-monitor-live: a stock grant carries remote_monitor_port, textConnect() dials it, and one real device c: command returns its complete prompt-framed response",
  { skip: SKIP_REASON, timeout: 60000 },
  async () => {
    const viceBinPath = VICE_LIVE_STOCK_BIN_ENV as string;

    const report = await withBrokerHarness(viceBinPath, async ({ stateDir, recordPid, host }) => {
      const opened = await openBrokerControl(stateDir);
      assert.ok(opened.ok, `openBrokerControl failed: ${JSON.stringify(opened)}`);
      if (!opened.ok) return;
      const session: BrokerControlSession = opened.session;

      const acquired = await session.acquire();
      assert.ok(acquired.ok, `acquire failed: ${JSON.stringify(acquired)}`);
      if (!acquired.ok) return;
      const grant = acquired.grant;

      assert.equal(
        typeof grant.remote_monitor_port,
        "number",
        `CHAN-02: grant.remote_monitor_port must be a number on a stock grant, got: ${JSON.stringify(grant)}`,
      );
      const remoteMonitorPort = grant.remote_monitor_port as number;
      assert.ok(
        Number.isInteger(remoteMonitorPort) && remoteMonitorPort >= 1 && remoteMonitorPort <= 65535,
        `grant.remote_monitor_port must be an integer in 1..65535, got: ${remoteMonitorPort}`,
      );

      const epochBefore = JSON.parse(readFileSync(grant.epoch_file, "utf8")) as { pid: number };
      recordPid(epochBefore.pid);

      // A cold acquire's grant is handed back the instant the process is
      // SPAWNED -- bounded-wait for the binmon port to accept a connection
      // before dialling anything (stock-live-broker-monitor.test.ts's own
      // waitForPortOpen() precedent). D-13's own MEASURED fact
      // (TEXT_BIND_BUDGET_MS_MAX: 0) is that the text port binds FASTER than
      // the binary one, so waiting on the binary port bounds the text port
      // too.
      const binmonReady = await waitForPortOpen(host, grant.port, 30000);
      assert.ok(binmonReady, `the cold-launched instance's binmon port ${grant.port} never accepted a connection within 30s`);

      const textSession = await textConnect({
        host,
        remoteMonitorPort,
        targetId: grant.id,
        brokerControl: session,
      });

      try {
        assert.ok(
          TEXT_COMMAND_ALLOWLIST.includes("device c:"),
          "device c: must be in TEXT_COMMAND_ALLOWLIST for this proof to issue it",
        );
        const response = await textSession.client.command("device c:");
        assert.ok(response.length > 0, `device c: response must be non-empty, got: ${JSON.stringify(response)}`);
        assert.doesNotMatch(
          response,
          /\(C:\$[0-9A-Fa-f]{4}\)\s*$/,
          `the framed payload must not itself end in a prompt (the prompt is consumed by framing), got: ${JSON.stringify(response)}`,
        );
        console.log(`text-monitor-live: MEASURED device c: response on ${viceBinPath}: ${JSON.stringify(response)}`);
      } finally {
        await textDisconnect(textSession);
      }

      await session.release();
    });

    assert.deepEqual(
      report.pidsAliveAfterTeardown,
      [],
      `pids still alive after teardown: ${JSON.stringify(report.pidsAliveAfterTeardown)} (recorded: ${JSON.stringify(report.recordedPids)})`,
    );
  },
);
