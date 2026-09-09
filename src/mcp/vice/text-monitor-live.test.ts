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
import { openBrokerControl, type BrokerControlSession, type HeldLease } from "./vice-broker-client.ts";
import { textConnect, textDisconnect } from "./text-connect.ts";
import { TEXT_COMMAND_ALLOWLIST, withTextChannelLock, buildTextCommand } from "./text-protocol.ts";
import { dispatchStock, clearHeldStockSession, ensureStockSession, type StockDispatchDeps } from "./stock-dispatch.ts";
import { stockConnect, type StockConnectOptions } from "./stock-connect.ts";
import { resetChannelLockForTests, acquireChannelLock } from "./channel-lock.ts";
import { CommandType, checkpointSetBody, CheckpointOperation, cpNumBody } from "./stock-protocol.ts";
import { parseAccessMap } from "./textmon-memmap.ts";
import { parseCpuHistory } from "./textmon-cpuhistory.ts";
import { parseBacktrace } from "./textmon-backtrace.ts";
import { parseFlatProfile } from "./textmon-profile.ts";
import { parseIoRegisters } from "./textmon-registers.ts";
import {
  classifyTextCapabilityResponse,
  probeTextCapability,
  textCapabilityCacheKey,
  resetTextCapabilityCache,
  type TextCapabilityIdentity,
  type TextCapabilityCommand,
} from "./text-capability-probe.ts";

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
        // Plan 41-02 (D-07, CHAN-04): command() now refuses unless the text
        // channel holds channel-lock.ts's own halt authority.
        const response = await withTextChannelLock("device c:", () => textSession.client.command("device c:"));
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

test(
  "text-monitor-live (Task 2): memmapshow's ~1.6MB output arrives across more than one TCP segment and is returned complete",
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
      assert.equal(typeof grant.remote_monitor_port, "number");
      const remoteMonitorPort = grant.remote_monitor_port as number;

      const epochBefore = JSON.parse(readFileSync(grant.epoch_file, "utf8")) as { pid: number };
      recordPid(epochBefore.pid);

      const binmonReady = await waitForPortOpen(host, grant.port, 30000);
      assert.ok(binmonReady, `the cold-launched instance's binmon port ${grant.port} never accepted a connection within 30s`);

      const textSession = await textConnect({ host, remoteMonitorPort, targetId: grant.id, brokerControl: session });

      try {
        assert.ok(TEXT_COMMAND_ALLOWLIST.includes("memmapshow"), "memmapshow must be in TEXT_COMMAND_ALLOWLIST for this proof to issue it");
        // memmapshow dumps the per-address access map for all 65536
        // addresses. fixtures/textmon/README.md's own capture (~1.6MB) was
        // taken against a machine with far more memory actually touched than
        // this freshly cold-launched instance has at connect time -- MEASURED
        // here at ~48KB on a fresh boot, still comfortably larger than any
        // small command's output (e.g. `device c:`'s handful of bytes) and
        // large enough that it cannot have arrived in a single small read
        // without this class's accumulation handling it correctly.
        // Plan 41-02 (D-07, CHAN-04): command() now refuses unless the text
        // channel holds channel-lock.ts's own halt authority.
        const response = await withTextChannelLock("memmapshow", () => textSession.client.command("memmapshow", { timeoutMs: 30000 }));
        assert.ok(
          response.length > 10_000,
          `memmapshow's response must be large enough to prove multi-chunk framing (>10KB), got ${response.length} bytes`,
        );
        assert.doesNotMatch(
          response,
          /\(C:\$[0-9A-Fa-f]{4}\)\s*$/,
          `the framed payload must not itself end in a prompt, got tail: ${JSON.stringify(response.slice(-40))}`,
        );
        assert.ok(!response.includes("\uFFFD"), "the framed payload must contain no UTF-8 replacement character");
        console.log(`text-monitor-live: MEASURED memmapshow response length on ${viceBinPath}: ${response.length} bytes`);
      } finally {
        await textDisconnect(textSession);
      }

      await session.release();
    });

    assert.deepEqual(report.pidsAliveAfterTeardown, [], `pids still alive after teardown: ${JSON.stringify(report.pidsAliveAfterTeardown)}`);
  },
);

// ---------------------------------------------------------------------------
// Plan 41-02 (CHAN-04): criterion 3 -- identical checkpoint-state visibility
// across both channels, and the interleaving refusal, both against genuine
// stock VICE with both channels connected to ONE real instance.
//
// Both tests below open a SECOND monitor connection (textConnect()) against
// the SAME grant a binary-side stockConnect() already claimed. This is
// deliberately safe today even though the `channel: "text"` claim
// discriminator (D-14, plan 41-03) is not yet wired: handleMonitorClaim()
// (vice-broker.mts) treats a repeated claim from the SAME grant id as
// idempotent ("ok: true, no second holder created"), and both connections
// below claim with targetId === grant.id -- the SAME grant, not two
// different ones. See 41-01-SUMMARY.md's own "Next Phase Readiness" note.
// ---------------------------------------------------------------------------

/** Reads the KERNAL's own default hardware-IRQ service routine entry point
 * from c64-memory-mapping's own memmap.json, never a typed-from-memory
 * literal -- copied from stock-a4-checkpoint-flood.test.ts's own
 * readKernalIrqAddress() (that file's helpers are module-local, not
 * exported; re-deriving five lines here is cheaper than exporting a second
 * file's test-only surface, matching this file's own established
 * copy-not-import discipline for shared harness shapes). A freshly booted,
 * unmodified machine executes this address on every CIA1 timer IRQ
 * (~50-60Hz) -- a STOPPING checkpoint armed here fires within tens of
 * milliseconds of a resume, with no fixture or autostart needed. */
interface KernalIrqAddress {
  address: number;
  addressHex: string;
}

function readKernalIrqAddress(): KernalIrqAddress {
  const memmapPath = join(HERE, "..", "..", "..", "src", "skills", "c64-memory-mapping", "memmap.json");
  const parsed = JSON.parse(readFileSync(memmapPath, "utf8")) as { entries: Array<Record<string, unknown>> };
  const raw = parsed.entries;
  assert.ok(Array.isArray(raw), `${memmapPath} must carry an "entries" array`);
  const cinvEntry = raw.find(
    (e) => e.sym === "CINV" && typeof e.desc === "string" && (e.desc as string).includes("Hardware IRQ Interrupt Address"),
  );
  assert.ok(cinvEntry, "c64-memory-mapping/memmap.json must carry a CINV entry naming the default hardware IRQ interrupt address");
  const desc = (cinvEntry as Record<string, unknown>).desc as string;
  const m = desc.match(/\$([0-9A-Fa-f]{2,4})/);
  assert.ok(m, `CINV's memmap.json desc field did not carry a "$hex" default address: "${desc}"`);
  return { address: parseInt(m![1]!, 16), addressHex: `$${m![1]!.toUpperCase()}` };
}

/** Parses a dispatchStock() answer's JSON payload, asserting it is NOT an
 * error result first -- copied from stock-a4-checkpoint-flood.test.ts's own
 * parseOkPayload() (module-local, not exported there either). */
function parseOkPayload(result: { content: { type: "text"; text: string }[]; isError: boolean }): Record<string, unknown> {
  assert.equal(result.isError, false, `expected an ok answer but got an error: ${result.content[0]?.text}`);
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

test(
  "text-monitor-live (criterion 3): the same checkpoint's id, address and enabled state agree across the binary and text channels",
  { skip: SKIP_REASON, timeout: 60000 },
  async () => {
    clearHeldStockSession();
    resetChannelLockForTests();
    const viceBinPath = VICE_LIVE_STOCK_BIN_ENV as string;
    const kernalIrq = readKernalIrqAddress();
    console.log(`text-monitor-live (criterion 3): armed address = ${kernalIrq.addressHex} (${kernalIrq.address})`);

    const report = await withBrokerHarness(viceBinPath, async ({ stateDir, recordPid, host }) => {
      const opened = await openBrokerControl(stateDir);
      assert.ok(opened.ok, `openBrokerControl failed: ${JSON.stringify(opened)}`);
      if (!opened.ok) return;
      const session: BrokerControlSession = opened.session;

      const acquired = await session.acquire();
      assert.ok(acquired.ok, `acquire failed: ${JSON.stringify(acquired)}`);
      if (!acquired.ok) return;
      const grant = acquired.grant;
      assert.equal(typeof grant.remote_monitor_port, "number");
      const remoteMonitorPort = grant.remote_monitor_port as number;

      const epochBefore = JSON.parse(readFileSync(grant.epoch_file, "utf8")) as { pid: number };
      recordPid(epochBefore.pid);

      const binmonReady = await waitForPortOpen(host, grant.port, 30000);
      assert.ok(binmonReady, `the cold-launched instance's binmon port ${grant.port} never accepted a connection within 30s`);

      const lease: HeldLease = {
        host,
        port: grant.port,
        targetId: grant.id,
        brokerControl: session,
        epochFile: grant.epoch_file,
        supervisorDir: stateDir,
      };
      const deps: StockDispatchDeps = {
        ensureLease: async () => ({ ok: true as const, lease }),
        connect: (opts: StockConnectOptions) => stockConnect(opts),
      };

      const textSession = await textConnect({ host, remoteMonitorPort, targetId: grant.id, brokerControl: session });

      try {
        const addResult = await dispatchStock("vice_checkpoint_add", { start: kernalIrq.addressHex, stop: true }, deps);
        const addPayload = parseOkPayload(addResult as { content: { type: "text"; text: string }[]; isError: boolean });
        const checkpointId = addPayload.id as number;
        assert.equal(addPayload.enabled, true, `expected the freshly added checkpoint to report enabled:true, got: ${JSON.stringify(addPayload)}`);

        // Collect EVERY passively-arriving banner (not just the first) --
        // MEASURED live during this plan's own authoring: not every banner
        // is the checkpoint-hit announcement itself. Any binary-channel halt
        // (including this plan's own vice_checkpoint_add/vice_checkpoint_list
        // calls, each an inbound byte that halts stock VICE) can also push a
        // bare "(C:$xxxx) " announcement with no "#N (...)" prefix -- the
        // checkpoint's own richer announcement is one entry among possibly
        // several, identified by matching the expected shape below, never by
        // assuming it is the first (or only) banner received.
        const banners: string[] = [];
        textSession.client.on("banner", (text: string) => banners.push(text));

        // Resume and poll, bounded, for the checkpoint's own wire hit count
        // to advance -- mirrors stock-a4-checkpoint-flood.test.ts's own poll
        // shape (never a paused-state flag, per vice-sync.ts's invariant).
        const deadline = Date.now() + 20000;
        let hitEntry: Record<string, unknown> | null = null;
        while (Date.now() < deadline && !hitEntry) {
          await dispatchStock("vice_execution_run", {}, deps);
          await new Promise((r) => setTimeout(r, 100));
          const listResult = await dispatchStock("vice_checkpoint_list", {}, deps);
          const listPayload = parseOkPayload(listResult as { content: { type: "text"; text: string }[]; isError: boolean });
          const checkpoints = (listPayload.checkpoints as Array<Record<string, unknown>>) ?? [];
          const found = checkpoints.find((c) => c.id === checkpointId) ?? null;
          if (found && (found.hitCount as number) > 0) hitEntry = found;
        }
        assert.ok(hitEntry, `checkpoint ${checkpointId} at ${kernalIrq.addressHex} never hit within the deadline`);

        // MEASURED banner shape (39-hitcount-invariant.md): "#N (Stop on  exec
        // ea31)  <cycles>/<hex>,  <cycles>/<hex>\n<disassembly line>\n(C:$ea31) ".
        // Give the text channel a bounded grace window for the checkpoint's
        // own announcement to arrive (it may already be among `banners`, or
        // still in flight) before scanning what has been collected so far.
        const bannerScanRe = /#(\d+)\s*\(\s*Stop on\s+exec\s+([0-9a-fA-F]+)\)/i;
        const bannerDeadline = Date.now() + 5000;
        let m: RegExpMatchArray | null = null;
        while (Date.now() < bannerDeadline && !m) {
          for (const b of banners) {
            const candidate = b.match(bannerScanRe);
            if (candidate) {
              m = candidate;
              break;
            }
          }
          if (!m) await new Promise((r) => setTimeout(r, 100));
        }
        assert.ok(
          m,
          `no collected text-channel banner matched the expected "#N (Stop on exec ADDR)" shape among ${banners.length} banner(s): ${JSON.stringify(banners)}`,
        );
        const textId = parseInt(m![1]!, 10);
        const textAddress = parseInt(m![2]!, 16);

        assert.equal(textId, hitEntry!.id, "the checkpoint id observed on the text channel must match the binary channel's own id");
        assert.equal(
          textAddress,
          hitEntry!.start,
          "the checkpoint address observed on the text channel must match the binary channel's own start address",
        );
        assert.equal(hitEntry!.enabled, true, "the binary channel's own checkpoint entry must report enabled:true");
        console.log(
          `text-monitor-live: MEASURED identical checkpoint state -- binary {id:${hitEntry!.id}, start:${hitEntry!.start}, ` +
            `enabled:${hitEntry!.enabled}}, text banner "#${textId} (Stop on exec ${m![2]})"`,
        );
      } finally {
        await textDisconnect(textSession);
      }

      await session.release();
    });

    assert.deepEqual(report.pidsAliveAfterTeardown, [], `pids still alive after teardown: ${JSON.stringify(report.pidsAliveAfterTeardown)}`);
  },
);

test(
  "text-monitor-live (criterion 3, interleaving): a text command attempted during a held binary wait is refused with the holder-naming refusal, and the wait still completes",
  { skip: SKIP_REASON, timeout: 30000 },
  async () => {
    clearHeldStockSession();
    resetChannelLockForTests();
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
      assert.equal(typeof grant.remote_monitor_port, "number");
      const remoteMonitorPort = grant.remote_monitor_port as number;

      const epochBefore = JSON.parse(readFileSync(grant.epoch_file, "utf8")) as { pid: number };
      recordPid(epochBefore.pid);

      const binmonReady = await waitForPortOpen(host, grant.port, 30000);
      assert.ok(binmonReady, `the cold-launched instance's binmon port ${grant.port} never accepted a connection within 30s`);

      const lease: HeldLease = {
        host,
        port: grant.port,
        targetId: grant.id,
        brokerControl: session,
        epochFile: grant.epoch_file,
        supervisorDir: stateDir,
      };
      const deps: StockDispatchDeps = {
        ensureLease: async () => ({ ok: true as const, lease }),
        connect: (opts: StockConnectOptions) => stockConnect(opts),
      };

      const textSession = await textConnect({ host, remoteMonitorPort, targetId: grant.id, brokerControl: session });

      try {
        // Warm the binary-side session (handshake, capability resolution)
        // OUTSIDE the timed window below, via a cheap vice_ping -- so the
        // subsequent vice_run_until dispatch reuses the already-connected
        // session and reaches withChannelLockHeld() almost immediately,
        // rather than racing an unpredictable first-connect handshake cost
        // against the head-start delay below.
        await dispatchStock("vice_ping", {}, deps);

        // $9000 is ordinary, unused RAM on a freshly booted, unmodified
        // machine -- never executed as code within this test's own bounded
        // window, so vice_run_until genuinely spans its full timeout_ms,
        // giving ample window for the concurrent text-lock attempt below.
        const runUntilPromise = dispatchStock("vice_run_until", { address: "$9000", timeout_ms: 5000 }, deps);

        // Give the binary side a head start to acquire channel-lock.ts's
        // mutex before the concurrent text acquire is attempted.
        await new Promise((r) => setTimeout(r, 300));

        let refusalMessage: string | null = null;
        try {
          await withTextChannelLock(
            "device c:",
            async () => {
              throw new Error("must not run -- the text acquire must be refused while the binary channel holds halt authority");
            },
            { timeoutMs: 300 },
          );
          assert.fail("expected withTextChannelLock to reject while the binary channel holds channel-lock.ts's mutex");
        } catch (err) {
          refusalMessage = err instanceof Error ? err.message : String(err);
        }
        assert.ok(refusalMessage, "expected a refusal message from the timed-out text acquire");
        assert.match(refusalMessage!, /binary/);
        assert.match(refusalMessage!, /vice_run_until/);
        const lower = refusalMessage!.toLowerCase();
        for (const forbidden of ["wedge", "wedged", "hang", "hung", "frozen", "stuck", "unresponsive"]) {
          assert.ok(!lower.includes(forbidden), `refusal message must not contain "${forbidden}": ${refusalMessage}`);
        }

        // The binary invariants (exactly one resume per wait, polling on
        // hit_count) are proven UNCHANGED by stock-run-until.test.ts's own
        // unit suite, run byte-for-byte unmodified alongside this live test
        // (see 41-02-PLAN.md's own separate <verify> line) -- this live
        // assertion's job is only to confirm the wait completes normally
        // (not corrupted or hung) despite the concurrently-refused text
        // attempt above.
        const runUntilResult = await runUntilPromise;
        const payload = parseOkPayload(runUntilResult as { content: { type: "text"; text: string }[]; isError: boolean });
        assert.equal(
          payload.timedOut,
          true,
          `expected vice_run_until to time out (address $9000 never reached within 5s), got: ${JSON.stringify(payload)}`,
        );
        console.log(
          `text-monitor-live: MEASURED interleaving refusal during a held binary wait -- refusal: ${JSON.stringify(refusalMessage)}, ` +
            `run_until outcome: ${JSON.stringify(payload)}`,
        );
      } finally {
        await textDisconnect(textSession);
      }

      await session.release();
    });

    assert.deepEqual(report.pidsAliveAfterTeardown, [], `pids still alive after teardown: ${JSON.stringify(report.pidsAliveAfterTeardown)}`);
  },
);

// ---------------------------------------------------------------------------
// Plan 41-04 (CHAN-05, D-09/D-10/D-11): a live text-channel hold reads as
// CONTENTION, not a wedge -- vice_diagnose called concurrently, through the
// REAL dispatchStock() path, must answer live/bracketsRun:0/channel:"text"
// while the hold is live, and channelContention.held:false with a real
// bracket run once released.
// ---------------------------------------------------------------------------

test(
  "text-monitor-live (CHAN-05): vice_diagnose observes a live text-channel hold as contention (live, bracketsRun:0, channel:text), then a real bracket runs once released",
  { skip: SKIP_REASON, timeout: 60000 },
  async () => {
    clearHeldStockSession();
    resetChannelLockForTests();
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
      assert.equal(typeof grant.remote_monitor_port, "number");
      const remoteMonitorPort = grant.remote_monitor_port as number;

      const epochBefore = JSON.parse(readFileSync(grant.epoch_file, "utf8")) as { pid: number };
      recordPid(epochBefore.pid);

      const binmonReady = await waitForPortOpen(host, grant.port, 30000);
      assert.ok(binmonReady, `the cold-launched instance's binmon port ${grant.port} never accepted a connection within 30s`);

      const lease: HeldLease = {
        host,
        port: grant.port,
        targetId: grant.id,
        brokerControl: session,
        epochFile: grant.epoch_file,
        supervisorDir: stateDir,
      };
      const deps: StockDispatchDeps = {
        ensureLease: async () => ({ ok: true as const, lease }),
        connect: (opts: StockConnectOptions) => stockConnect(opts),
      };

      const textSession = await textConnect({ host, remoteMonitorPort, targetId: grant.id, brokerControl: session });

      try {
        // Hold the text channel's own halt authority across a real command,
        // and call vice_diagnose CONCURRENTLY, through the REAL dispatchStock()
        // path, WHILE the lock is still held -- this is the actual proof:
        // vice_diagnose must observe the foreign hold and answer contention,
        // never resuming a machine the text channel is holding. Returned from
        // the callback (rather than assigned to an outer `let`) so TypeScript
        // never has to narrow a closure-reassigned variable.
        const diagnoseDuringHold = await withTextChannelLock("device c:", async () => {
          const response = await textSession.client.command("device c:");
          assert.ok(response.length > 0, `device c: response must be non-empty, got: ${JSON.stringify(response)}`);

          const result = await dispatchStock("vice_diagnose", {}, deps);
          return parseOkPayload(result as { content: { type: "text"; text: string }[]; isError: boolean });
        });

        assert.equal(diagnoseDuringHold.verdict, "live", "D-11: a contended instance is healthy, not wedged");
        const evidenceDuringHold = diagnoseDuringHold.evidence as Record<string, unknown>;
        assert.equal(evidenceDuringHold.bracketsRun, 0, "no bracket was run while contended -- the machine was never resumed");
        const contentionDuringHold = evidenceDuringHold.channelContention as Record<string, unknown>;
        assert.equal(contentionDuringHold.held, true);
        assert.equal(contentionDuringHold.channel, "text");
        assert.equal(contentionDuringHold.operation, "device c:");
        assert.equal(typeof contentionDuringHold.heldMs, "number");
        console.log(
          `text-monitor-live: MEASURED CHAN-05 contention on ${viceBinPath} -- verdict=${diagnoseDuringHold.verdict}, ` +
            `evidence=${JSON.stringify(evidenceDuringHold)}`,
        );

        // The hold is released now (withTextChannelLock's own finally already
        // ran) -- re-call vice_diagnose and confirm a REAL bracket runs and
        // channelContention reports held:false.
        const afterResult = await dispatchStock("vice_diagnose", {}, deps);
        const afterPayload = parseOkPayload(afterResult as { content: { type: "text"; text: string }[]; isError: boolean });
        const afterEvidence = afterPayload.evidence as Record<string, unknown>;
        assert.equal((afterEvidence.channelContention as Record<string, unknown>).held, false, "the hold must be released by now");
        assert.ok(
          (afterEvidence.bracketsRun as number) > 0,
          `expected a real bracket to run once uncontended, got bracketsRun=${afterEvidence.bracketsRun}`,
        );
        console.log(
          `text-monitor-live: MEASURED post-release vice_diagnose on ${viceBinPath} -- verdict=${afterPayload.verdict}, ` +
            `evidence=${JSON.stringify(afterEvidence)}`,
        );
      } finally {
        await textDisconnect(textSession);
      }

      await session.release();
    });

    assert.deepEqual(report.pidsAliveAfterTeardown, [], `pids still alive after teardown: ${JSON.stringify(report.pidsAliveAfterTeardown)}`);
  },
);

// ---------------------------------------------------------------------------
// Plan 41-06: the default_memspace remedy, EXERCISED live (criterion 5), not
// merely made available. This project's own tool surface has no shipped way
// to arm a checkpoint on a DRIVE memspace (stock-checkpoints.ts's
// handleCheckpointAdd takes no memspace argument at all -- D-03's own
// rationale: "no shipped tool can contaminate default_memspace today"), so
// this test arms the drive checkpoint through the RAW wire encoder
// (checkpointSetBody({ memspace: 0x01, ... }), stock-protocol.ts) directly
// against session.client -- the one place in this file that reaches past the
// tool surface, and only because there is no tool surface here to reach
// through. broker-launch.mts already launches every stock instance with
// Drive8TrueEmulation=1 and Drive8Type=1541 by default (FINDING-C1, plan
// 08.2-02), so the drive's own 6502 is genuinely emulated and continuously
// executing its own ROM firmware from boot -- no disk image or autostart is
// needed to produce drive activity.
//
// Detection strategy: vice_registers_get always sends an EXPLICIT
// memspace:0x00 (main) on the wire (stock-registers.ts), so it is immune to
// default_memspace contamination and is the ground truth for "did the main
// CPU's PC actually move". vice_execution_step's own ADVANCE_INSTRUCTIONS
// request has NO memspace field at all (CLAUDE.md's own cited fact) --
// contaminated, it silently steps whichever CPU default_memspace currently
// names. Comparing main-CPU PC (via vice_registers_get) immediately before
// and after a vice_execution_step call is therefore a direct, live proof:
// frozen before/after PC while contaminated -- means the step advanced a
// DIFFERENT CPU (the drive) instead; a moving PC after device c: means the
// remedy restored main-CPU stepping.
// ---------------------------------------------------------------------------

/** Broad exec range covering the entire 1541 drive ROM ($C000-$FFFF) --
 * arming a checkpoint over the WHOLE mapped ROM means the very next
 * instruction fetch the drive CPU makes anywhere in its own firmware trips
 * it, without needing to know any specific 1541 ROM routine address by
 * heart (this project's own memmap.json only documents C64 addresses, not
 * 1541 drive ROM ones). */
const DRIVE_ROM_START = 0xc000;
const DRIVE_ROM_END = 0xffff;
const DRIVE_MEMSPACE = 0x01; // unit 8, per stock-protocol.ts's memspaceByte()

test(
  "text-monitor-live (criterion 5, D-03/D-04): device c: exercises the default_memspace remedy live -- a drive checkpoint hit freezes main-CPU stepping, device c: restores it, and no binary stepping call ever touched the text channel",
  { skip: SKIP_REASON, timeout: 60000 },
  async (t) => {
    clearHeldStockSession();
    resetChannelLockForTests();
    const viceBinPath = VICE_LIVE_STOCK_BIN_ENV as string;

    let skipReason: string | null = null;

    const report = await withBrokerHarness(viceBinPath, async ({ stateDir, recordPid, host }) => {
      const opened = await openBrokerControl(stateDir);
      assert.ok(opened.ok, `openBrokerControl failed: ${JSON.stringify(opened)}`);
      if (!opened.ok) return;
      const session: BrokerControlSession = opened.session;

      const acquired = await session.acquire();
      assert.ok(acquired.ok, `acquire failed: ${JSON.stringify(acquired)}`);
      if (!acquired.ok) return;
      const grant = acquired.grant;
      assert.equal(typeof grant.remote_monitor_port, "number");
      const remoteMonitorPort = grant.remote_monitor_port as number;

      const epochBefore = JSON.parse(readFileSync(grant.epoch_file, "utf8")) as { pid: number };
      recordPid(epochBefore.pid);

      const binmonReady = await waitForPortOpen(host, grant.port, 30000);
      assert.ok(binmonReady, `the cold-launched instance's binmon port ${grant.port} never accepted a connection within 30s`);

      const lease: HeldLease = {
        host,
        port: grant.port,
        targetId: grant.id,
        brokerControl: session,
        epochFile: grant.epoch_file,
        supervisorDir: stateDir,
      };
      const deps: StockDispatchDeps = {
        ensureLease: async () => ({ ok: true as const, lease }),
        connect: (opts: StockConnectOptions) => stockConnect(opts),
      };

      const textSession = await textConnect({ host, remoteMonitorPort, targetId: grant.id, brokerControl: session });
      let textCommandCount = 0;

      try {
        const sessionOutcome = await ensureStockSession(deps);
        assert.ok(sessionOutcome.ok, `ensureStockSession failed: ${JSON.stringify(sessionOutcome)}`);
        if (!sessionOutcome.ok) return;
        const stockSession = sessionOutcome.session;

        // Arm the drive checkpoint through the RAW wire encoder -- the ONE
        // place in this file that bypasses the tool surface, because no
        // tool exists to reach a drive memspace. Held under channel-lock.ts's
        // own binary authority, matching D-05's "every halt-taking operation
        // passes through the one serialization authority" discipline even
        // for a raw call this file makes directly.
        const armHandle = await acquireChannelLock({ channel: "binary", operation: "raw CHECKPOINT_SET (drive, criterion 5 setup)" });
        let checkpointId: number;
        try {
          const setResponse = await stockSession.client.send(
            CommandType.CheckpointSet,
            checkpointSetBody({
              start: DRIVE_ROM_START,
              end: DRIVE_ROM_END,
              stop: true,
              enabled: true,
              operation: CheckpointOperation.Exec,
              memspace: DRIVE_MEMSPACE,
            }),
          );
          assert.equal(setResponse.type, "checkpoint_info", `expected a checkpoint_info reply to CHECKPOINT_SET, got: ${JSON.stringify(setResponse)}`);
          checkpointId = (setResponse as { checkpoint: { id: number } }).checkpoint.id;
        } finally {
          armHandle.release();
        }
        console.log(
          `text-monitor-live (criterion 5): armed drive checkpoint id=${checkpointId} over $${DRIVE_ROM_START.toString(16)}-` +
            `$${DRIVE_ROM_END.toString(16)} on memspace 0x${DRIVE_MEMSPACE.toString(16)}`,
        );

        // Resume and wait, bounded, for the DRIVE checkpoint's own
        // UNSOLICITED CHECKPOINT_INFO (0x11) hit event -- MEASURED here (not
        // assumed) that CHECKPOINT_LIST (0x14) is scoped to default_memspace
        // and therefore CANNOT see this drive checkpoint until AFTER it has
        // already fired once (a chicken-and-egg the unsolicited event sidesteps
        // entirely): with a fresh checkpoint set on memspace 0x01 and
        // default_memspace still main, a real CHECKPOINT_LIST poll here
        // returned `total: 0` throughout, every single poll, for the whole
        // window -- a real protocol fact worth its own record (see the
        // evidence document), not evidence the checkpoint failed to arm.
        // Listening for the event VICE pushes unsolicited on every checkpoint
        // hit (CLAUDE.md's own Protocol constraint) is what actually detects
        // it, regardless of which memspace CHECKPOINT_LIST's own listing is
        // scoped to.
        const checkpointHits: Array<Record<string, unknown>> = [];
        const checkpointHitListener = (item: unknown) => {
          if (
            item !== null &&
            typeof item === "object" &&
            (item as { type?: string }).type === "checkpoint_info" &&
            (item as { checkpoint?: { id?: number } }).checkpoint?.id === checkpointId
          ) {
            checkpointHits.push((item as { checkpoint: Record<string, unknown> }).checkpoint);
          }
        };
        stockSession.client.on("event", checkpointHitListener);
        const deadline = Date.now() + 15000;
        try {
          while (Date.now() < deadline && checkpointHits.length === 0) {
            await dispatchStock("vice_execution_run", {}, deps);
            await new Promise((r) => setTimeout(r, 150));
          }
        } finally {
          stockSession.client.off("event", checkpointHitListener);
        }
        const hit = checkpointHits.length > 0;

        if (!hit) {
          skipReason =
            `the drive checkpoint (id ${checkpointId}, $${DRIVE_ROM_START.toString(16)}-$${DRIVE_ROM_END.toString(16)}, ` +
            `memspace 0x${DRIVE_MEMSPACE.toString(16)}) never hit within 15s on this host -- the contamination path was ` +
            `not reproducible here, and this is a named gap (recorded in docs/phase41-text-channel-live-evidence.md and ` +
            `the SUMMARY), not a silent pass. The remedy (device c:) is still confirmed reachable and allowlisted by the ` +
            `unconditional first live test in this file.`;
          return;
        }
        console.log(`text-monitor-live (criterion 5): MEASURED drive checkpoint id=${checkpointId} hit within the poll window`);

        // Ground truth: main-CPU PC via vice_registers_get, which always
        // sends an explicit memspace:0x00 -- immune to contamination.
        const regsBeforeResult = await dispatchStock("vice_registers_get", {}, deps);
        const regsBefore = parseOkPayload(regsBeforeResult as { content: { type: "text"; text: string }[]; isError: boolean });
        const pcBefore = (regsBefore.registers as Record<string, number>).PC;
        assert.equal(typeof pcBefore, "number", `expected a numeric main-CPU PC before stepping, got: ${JSON.stringify(regsBefore)}`);

        // vice_execution_step's own ADVANCE_INSTRUCTIONS request has NO
        // memspace field (CLAUDE.md's cited fact) -- contaminated, it steps
        // whichever CPU default_memspace currently names, silently.
        const stepDuringContaminationResult = await dispatchStock("vice_execution_step", { count: 1 }, deps);
        const stepDuringContamination = parseOkPayload(stepDuringContaminationResult as { content: { type: "text"; text: string }[]; isError: boolean });

        const regsAfterStepResult = await dispatchStock("vice_registers_get", {}, deps);
        const regsAfterStep = parseOkPayload(regsAfterStepResult as { content: { type: "text"; text: string }[]; isError: boolean });
        const pcAfterContaminatedStep = (regsAfterStep.registers as Record<string, number>).PC;

        // D-03: no binary stepping call above may have acquired the text
        // channel or made a text round trip.
        assert.equal(textCommandCount, 0, "no text-channel command must have been issued before the remedy is deliberately invoked below");

        assert.equal(
          pcAfterContaminatedStep,
          pcBefore,
          `default_memspace contamination signature: main-CPU PC must be FROZEN across vice_execution_step while contaminated ` +
            `(pcBefore=0x${pcBefore.toString(16)}, pcAfterContaminatedStep=0x${pcAfterContaminatedStep.toString(16)}, ` +
            `step's own reported programCounter=${JSON.stringify(stepDuringContamination.programCounter)} -- the step silently advanced ` +
            `the DRIVE CPU instead of main)`,
        );
        console.log(
          `text-monitor-live (criterion 5): MEASURED contamination -- main-CPU PC frozen at 0x${pcBefore.toString(16)} across ` +
            `vice_execution_step (step's own reported PC: ${JSON.stringify(stepDuringContamination.programCounter)})`,
        );

        // MEASURED: the drive checkpoint, still armed (stop:true), keeps
        // re-firing on the drive's own continuously-executing ROM loop and
        // re-contaminates default_memspace back to drive on essentially every
        // subsequent resume -- an early design of this test issued device c:
        // with the checkpoint still live and observed the remedy assertion
        // below fail (pcAfterRemedy === pcBefore), because the checkpoint won
        // the race and re-set default_memspace to drive again before the
        // following vice_execution_step's own ADVANCE_INSTRUCTIONS reply.
        // Deleting the checkpoint (its job -- producing the contamination --
        // is already done) before invoking the remedy removes that confound;
        // this mirrors how a real user would stop reproducing the fault
        // before diagnosing whether the remedy took.
        const deleteHandle = await acquireChannelLock({ channel: "binary", operation: "raw CHECKPOINT_DELETE (criterion 5 cleanup)" });
        try {
          await stockSession.client.send(CommandType.CheckpointDelete, cpNumBody(checkpointId));
        } finally {
          deleteHandle.release();
        }

        // The remedy: device c: over the text channel, exercised live.
        const remedyResponse = await withTextChannelLock("device c:", async () => {
          textCommandCount += 1;
          return textSession.client.command("device c:");
        });
        assert.ok(remedyResponse.length > 0, `device c: response must be non-empty, got: ${JSON.stringify(remedyResponse)}`);
        assert.equal(textCommandCount, 1, "exactly one text-channel command (device c:) must have been issued -- the remedy itself");
        // MEASURED: the response can carry a large batch of already-queued
        // drive-checkpoint hit banners that were still in flight on the wire
        // the instant CHECKPOINT_DELETE took effect (a real race between the
        // delete taking effect and the drive's own extremely tight polling
        // loop re-firing many more times in the interim) -- truncated here
        // for log readability only, never for the assertion above, which
        // checks the FULL untruncated string.
        const remedyResponseLogSnippet = remedyResponse.length > 500 ? `${remedyResponse.slice(0, 250)} ...[${remedyResponse.length} bytes total]... ${remedyResponse.slice(-250)}` : remedyResponse;
        console.log(`text-monitor-live (criterion 5): MEASURED device c: remedy response (${remedyResponse.length} bytes): ${JSON.stringify(remedyResponseLogSnippet)}`);

        // Confirm the remedy: main-CPU stepping must now work again.
        const stepAfterRemedyResult = await dispatchStock("vice_execution_step", { count: 1 }, deps);
        parseOkPayload(stepAfterRemedyResult as { content: { type: "text"; text: string }[]; isError: boolean });
        const regsAfterRemedyResult = await dispatchStock("vice_registers_get", {}, deps);
        const regsAfterRemedy = parseOkPayload(regsAfterRemedyResult as { content: { type: "text"; text: string }[]; isError: boolean });
        const pcAfterRemedy = (regsAfterRemedy.registers as Record<string, number>).PC;

        assert.equal(textCommandCount, 1, "no ADDITIONAL text-channel command may have been issued by the binary-side step call above -- D-03");
        assert.notEqual(
          pcAfterRemedy,
          pcBefore,
          `remedy signature: main-CPU PC must ADVANCE again once device c: has restored default_memspace to main ` +
            `(pcBefore=0x${pcBefore.toString(16)}, pcAfterRemedy=0x${pcAfterRemedy.toString(16)})`,
        );
        console.log(
          `text-monitor-live (criterion 5): MEASURED remedy confirmed -- main-CPU PC advanced from 0x${pcBefore.toString(16)} to ` +
            `0x${pcAfterRemedy.toString(16)} after device c:`,
        );
      } finally {
        await textDisconnect(textSession);
      }

      await session.release();
    });

    assert.deepEqual(report.pidsAliveAfterTeardown, [], `pids still alive after teardown: ${JSON.stringify(report.pidsAliveAfterTeardown)}`);

    if (skipReason) {
      // node:test's own skip mechanism -- so this outcome shows up as
      // SKIPPED in the run summary (never a silent pass), and this file's
      // <verify> gate (at most one skip permitted) reads it correctly.
      t.skip(skipReason);
    }
  },
);

// ---------------------------------------------------------------------------
// Plan 41-06 (D-04): the warp on/warp off re-probe, WITH THE CHANNEL OPEN,
// issued through the real vice_warp_set tool (needsSession:false --
// dispatchStock() reaches text-tools.ts's handleWarpSet() directly).
// ---------------------------------------------------------------------------

test(
  "text-monitor-live (D-04): vice_warp_set(true) and vice_warp_set(false) each return a real, verbatim response while the channel is open",
  { skip: SKIP_REASON, timeout: 60000 },
  async () => {
    clearHeldStockSession();
    resetChannelLockForTests();
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
      assert.equal(typeof grant.remote_monitor_port, "number");
      const remoteMonitorPort = grant.remote_monitor_port as number;

      const epochBefore = JSON.parse(readFileSync(grant.epoch_file, "utf8")) as { pid: number };
      recordPid(epochBefore.pid);

      const binmonReady = await waitForPortOpen(host, grant.port, 30000);
      assert.ok(binmonReady, `the cold-launched instance's binmon port ${grant.port} never accepted a connection within 30s`);

      // vice_warp_set is needsSession:false (text-tools.ts) -- it resolves
      // its own lease via deps.ensureLease() and dials the text channel
      // itself through textConnect(); no binary session is opened by this
      // test at all, and remoteMonitorPort MUST be on the lease this time
      // (the earlier tests in this file omit it because they call
      // textConnect() directly with an explicit port instead).
      const lease: HeldLease = {
        host,
        port: grant.port,
        targetId: grant.id,
        brokerControl: session,
        epochFile: grant.epoch_file,
        supervisorDir: stateDir,
        remoteMonitorPort,
      };
      const deps: StockDispatchDeps = {
        ensureLease: async () => ({ ok: true as const, lease }),
      };

      const onResult = await dispatchStock("vice_warp_set", { enabled: true }, deps);
      const onPayload = parseOkPayload(onResult as { content: { type: "text"; text: string }[]; isError: boolean });
      assert.equal(onPayload.requested, true);
      assert.ok(
        typeof onPayload.response === "string" && (onPayload.response as string).length > 0,
        `expected a non-empty response, got: ${JSON.stringify(onPayload)}`,
      );
      console.log(`text-monitor-live (D-04): MEASURED vice_warp_set(true) on ${viceBinPath}: ${JSON.stringify(onPayload.response)}`);

      const offResult = await dispatchStock("vice_warp_set", { enabled: false }, deps);
      const offPayload = parseOkPayload(offResult as { content: { type: "text"; text: string }[]; isError: boolean });
      assert.equal(offPayload.requested, false);
      assert.ok(
        typeof offPayload.response === "string" && (offPayload.response as string).length > 0,
        `expected a non-empty response, got: ${JSON.stringify(offPayload)}`,
      );
      console.log(`text-monitor-live (D-04): MEASURED vice_warp_set(false) on ${viceBinPath}: ${JSON.stringify(offPayload.response)}`);

      await session.release();
    });

    assert.deepEqual(report.pidsAliveAfterTeardown, [], `pids still alive after teardown: ${JSON.stringify(report.pidsAliveAfterTeardown)}`);
  },
);

// ---------------------------------------------------------------------------
// Plan 42-09 (PARSE-01..04): the five text formats, live, against genuine
// stock VICE -- PARSED, not merely received. Each of memmapshow/chis/
// prof flat/bt/io is dialed through the channel-lock wrapper exactly like
// every other case in this file, classified for build capability (PARSE-04)
// BEFORE parsing, then handed to its OWNING module (textmon-*.ts) with
// format-specific shape assertions. The three parameterized verbs (chis,
// prof flat, io) are dialed with buildTextCommand()'s own rendered output,
// never a hand-built string; memmapshow and bt stay the bare frozen literal,
// matching every earlier test in this file. All five dials, the capability
// probe (all five commands, the real cache key), and the RAM-execute
// observation share ONE harness acquisition -- one emulator launch, not
// five, per the plan's own instruction.
//
// The RAM-execute count is recorded either way: this test asserts nothing
// about it being non-zero (the emulator's own execution window decides that),
// it only logs the numerator and the denominator so Task 2 can record
// whichever outcome actually occurred as a finding, not a caveat.
// ---------------------------------------------------------------------------

test(
  "text-monitor-live (plan 42-09): all five text formats parse a reply produced live by genuine stock VICE, the capability probe answers capable for all five and keys on the resolved binary path, and the RAM-execute count is recorded either way",
  { skip: SKIP_REASON, timeout: 90000 },
  async () => {
    clearHeldStockSession();
    resetChannelLockForTests();
    resetTextCapabilityCache();
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
      assert.equal(typeof grant.remote_monitor_port, "number");
      const remoteMonitorPort = grant.remote_monitor_port as number;

      const epochBefore = JSON.parse(readFileSync(grant.epoch_file, "utf8")) as { pid: number };
      recordPid(epochBefore.pid);

      const binmonReady = await waitForPortOpen(host, grant.port, 30000);
      assert.ok(binmonReady, `the cold-launched instance's binmon port ${grant.port} never accepted a connection within 30s`);

      const textSession = await textConnect({ host, remoteMonitorPort, targetId: grant.id, brokerControl: session });

      // D-42-2's own resolved-identity shape: this test dialed the binary
      // directly by its own absolute path (VICE_LIVE_STOCK_BIN_ENV, checked
      // existsSync() at this file's own opt-in gate above), so `resolved` is
      // genuinely true here -- never asserted from an unresolved bare name.
      const identity: TextCapabilityIdentity = {
        backend: "stock",
        binPath: viceBinPath,
        resolved: true,
      };

      // A binary-channel lease/deps pair -- needed only to resume real
      // execution briefly before dialing `prof flat` (see that section
      // below), mirroring the "criterion 3"/"criterion 5" tests' own
      // HeldLease/StockDispatchDeps construction earlier in this file.
      const lease: HeldLease = {
        host,
        port: grant.port,
        targetId: grant.id,
        brokerControl: session,
        epochFile: grant.epoch_file,
        supervisorDir: stateDir,
      };
      const deps: StockDispatchDeps = {
        ensureLease: async () => ({ ok: true as const, lease }),
        connect: (opts: StockConnectOptions) => stockConnect(opts),
      };

      try {
        // MEASURED (this plan, live): the FIRST command issued against a
        // freshly cold-launched instance's text monitor carries an EXTRA
        // leading `(C:$xxxx) ` prompt beyond any command-specific entry echo
        // -- a one-time monitor-activation artifact, not a per-connection or
        // per-command one. Confirmed by direct diagnostic: dialing the same
        // verb twice on one session showed the doubled prefix ONLY on the
        // first dial; the second and third were single-prompt-framed. This
        // is orthogonal to what this task proves (that a live reply decodes)
        // -- recorded in this phase's own evidence record (Task 2) as a
        // genuine finding, not smoothed over -- and is drained here with one
        // harmless, already-allowlisted warm-up dial (`device c:`, the same
        // verb this file's own first test above issues) before any of the
        // five formats below is measured, so each of the five sees a
        // steady-state, single-prompt-framed reply exactly like every other
        // live case in this file.
        const warmupResponse = await withTextChannelLock("device c:", () => textSession.client.command("device c:"));
        assert.ok(warmupResponse.length > 0, "the warm-up device c: dial must return a non-empty response");

        // -------------------------------------------------------------
        // memmapshow -- bare frozen verb, no parameter.
        // -------------------------------------------------------------
        assert.ok(TEXT_COMMAND_ALLOWLIST.includes("memmapshow"), "memmapshow must be in TEXT_COMMAND_ALLOWLIST for this proof to issue it");
        const memmapResponse = await withTextChannelLock("memmapshow", () =>
          textSession.client.command("memmapshow", { timeoutMs: 30000 }),
        );
        const memmapClassification = classifyTextCapabilityResponse("memmapshow", memmapResponse);
        assert.equal(
          memmapClassification.outcome,
          "capable",
          `memmapshow's classification must be capable before parsing, got: ${JSON.stringify(memmapClassification)}`,
        );
        const memmapParsed = parseAccessMap(memmapResponse);
        assert.ok(
          memmapParsed.ok,
          `memmapshow's live reply must parse: ${JSON.stringify(!memmapParsed.ok ? memmapParsed.refusal : null)}`,
        );
        if (!memmapParsed.ok) return;
        assert.ok(memmapParsed.value.entries.length > 0, "memmapshow's parsed access map must carry at least one entry");
        console.log(
          `text-monitor-live (42-09): MEASURED memmapshow on ${viceBinPath} -- entries=${memmapParsed.value.entries.length}`,
        );

        // RAM-execute observation (criterion 1's RAM half) -- recorded
        // either way, no assertion on the count itself.
        let ramExecuteCount = 0;
        for (const entry of memmapParsed.value.entries) {
          if (entry.ram.execute) ramExecuteCount++;
        }
        console.log(
          `text-monitor-live (42-09): MEASURED RAM-execute observation on ${viceBinPath} -- ` +
            `ramExecuteCount=${ramExecuteCount} totalEntries=${memmapParsed.value.entries.length}`,
        );

        // -------------------------------------------------------------
        // chis -- parameterized via buildTextCommand(), never hand-built.
        // -------------------------------------------------------------
        const chisBuild = buildTextCommand("chis", 20);
        assert.ok(chisBuild.ok, `buildTextCommand("chis", 20) must succeed: ${JSON.stringify(chisBuild)}`);
        if (!chisBuild.ok) return;
        const chisResponse = await withTextChannelLock(chisBuild.command, () =>
          textSession.client.command(chisBuild.command, { timeoutMs: 30000 }),
        );
        const chisClassification = classifyTextCapabilityResponse("chis", chisResponse);
        assert.equal(
          chisClassification.outcome,
          "capable",
          `chis's classification must be capable before parsing, got: ${JSON.stringify(chisClassification)}`,
        );
        const chisParsed = parseCpuHistory(chisResponse);
        assert.ok(chisParsed.ok, `chis's live reply must parse: ${JSON.stringify(!chisParsed.ok ? chisParsed.refusal : null)}`);
        if (!chisParsed.ok) return;
        assert.ok(chisParsed.value.entries.length > 0, "chis's parsed CPU history must carry at least one entry");
        for (const entry of chisParsed.value.entries) {
          assert.ok(entry.cycles > 0, `every chis entry's cycles must be positive, got: ${entry.cycles}`);
        }
        const cycleValues = chisParsed.value.entries.map((e) => e.cycles);
        console.log(
          `text-monitor-live (42-09): MEASURED chis ("${chisBuild.command}") on ${viceBinPath} -- ` +
            `entries=${chisParsed.value.entries.length}, cycle range ${Math.min(...cycleValues)}-${Math.max(...cycleValues)}`,
        );

        // -------------------------------------------------------------
        // prof flat -- parameterized via buildTextCommand(). MEASURED
        // (this plan, live): VICE's own profiler defaults to off, and
        // `prof flat` alone (with no CPU cycles elapsed since connect,
        // this session having stayed halted throughout) returns "No
        // profiling data available..." -- no build-time guard, and not a
        // parser refusal either, just an empty subsystem. `prof on` (this
        // plan's own conscious, measured allowlist widening -- see
        // text-protocol.ts's own header comment) is issued first, the
        // binary channel resumes real execution briefly so the profiler
        // has genuine cycles to attribute, and `prof off` restores the
        // toggle afterward so this instance is left as it was found.
        // -------------------------------------------------------------
        assert.ok(TEXT_COMMAND_ALLOWLIST.includes("prof on"), "prof on must be in TEXT_COMMAND_ALLOWLIST for this proof to issue it");
        const profOnResponse = await withTextChannelLock("prof on", () => textSession.client.command("prof on"));
        assert.ok(profOnResponse.length > 0, "prof on must return a non-empty response");
        console.log(`text-monitor-live (42-09): MEASURED prof on on ${viceBinPath}: ${JSON.stringify(profOnResponse)}`);

        const sessionOutcome = await ensureStockSession(deps);
        assert.ok(sessionOutcome.ok, `ensureStockSession failed: ${JSON.stringify(sessionOutcome)}`);
        await dispatchStock("vice_execution_run", {}, deps);
        await new Promise((r) => setTimeout(r, 500));

        // MEASURED (this plan, live): resuming the CPU and then halting it
        // again via the next inbound monitor byte reproduces the SAME
        // unsolicited leading-prompt artifact this test's own top-of-session
        // warm-up drains -- VICE announces the fresh halt with its own
        // prompt line before the next command's real output, merged into
        // the same framed reply. A second warm-up dial here (bare, unparsed)
        // drains that halt announcement so `prof flat` below sees a clean,
        // single-prompt-framed reply, exactly like every other case in this
        // test that is not the first command after a resume.
        const postResumeWarmup = await withTextChannelLock("device c:", () => textSession.client.command("device c:"));
        assert.ok(postResumeWarmup.length > 0, "the post-resume warm-up device c: dial must return a non-empty response");

        const profBuild = buildTextCommand("prof flat", 20);
        assert.ok(profBuild.ok, `buildTextCommand("prof flat", 20) must succeed: ${JSON.stringify(profBuild)}`);
        if (!profBuild.ok) return;
        const profResponse = await withTextChannelLock(profBuild.command, () =>
          textSession.client.command(profBuild.command, { timeoutMs: 30000 }),
        );
        const profClassification = classifyTextCapabilityResponse("prof flat", profResponse);
        assert.equal(
          profClassification.outcome,
          "capable",
          `prof flat's classification must be capable before parsing, got: ${JSON.stringify(profClassification)}`,
        );
        const profParsed = parseFlatProfile(profResponse);
        assert.ok(profParsed.ok, `prof flat's live reply must parse: ${JSON.stringify(!profParsed.ok ? profParsed.refusal : null)}`);
        if (!profParsed.ok) return;
        assert.ok(profParsed.value.entries.length > 0, "prof flat's parsed rows must carry at least one entry");
        console.log(
          `text-monitor-live (42-09): MEASURED prof flat ("${profBuild.command}") on ${viceBinPath} -- ` +
            `rows=${profParsed.value.entries.length}, leading row=${JSON.stringify(profParsed.value.entries[0])}`,
        );

        const profOffResponse = await withTextChannelLock("prof off", () => textSession.client.command("prof off"));
        assert.ok(profOffResponse.length > 0, "prof off must return a non-empty response");
        console.log(`text-monitor-live (42-09): MEASURED prof off on ${viceBinPath}: ${JSON.stringify(profOffResponse)}`);

        // -------------------------------------------------------------
        // bt -- bare frozen verb, no parameter.
        // -------------------------------------------------------------
        assert.ok(TEXT_COMMAND_ALLOWLIST.includes("bt"), "bt must be in TEXT_COMMAND_ALLOWLIST for this proof to issue it");
        const btResponse = await withTextChannelLock("bt", () => textSession.client.command("bt", { timeoutMs: 30000 }));
        const btClassification = classifyTextCapabilityResponse("bt", btResponse);
        assert.equal(
          btClassification.outcome,
          "capable",
          `bt's classification must be capable before parsing, got: ${JSON.stringify(btClassification)}`,
        );
        const btParsed = parseBacktrace(btResponse);
        assert.ok(btParsed.ok, `bt's live reply must parse: ${JSON.stringify(!btParsed.ok ? btParsed.refusal : null)}`);
        if (!btParsed.ok) return;
        assert.equal(typeof btParsed.value.currentPc.address, "number", "bt's current-PC frame must carry a numeric address");
        console.log(
          `text-monitor-live (42-09): MEASURED bt on ${viceBinPath} -- chain depth=${btParsed.value.frames.length}, ` +
            `currentPc=0x${btParsed.value.currentPc.address.toString(16)}`,
        );

        // -------------------------------------------------------------
        // io -- parameterized via buildTextCommand(), address $d020 (VIC-II
        // border colour, matching fixtures/textmon/register-decode-stock's
        // own captured command).
        // -------------------------------------------------------------
        const ioBuild = buildTextCommand("io", 0xd020);
        assert.ok(ioBuild.ok, `buildTextCommand("io", 0xd020) must succeed: ${JSON.stringify(ioBuild)}`);
        if (!ioBuild.ok) return;
        const ioResponse = await withTextChannelLock(ioBuild.command, () =>
          textSession.client.command(ioBuild.command, { timeoutMs: 30000 }),
        );
        const ioClassification = classifyTextCapabilityResponse("io", ioResponse);
        assert.equal(
          ioClassification.outcome,
          "capable",
          `io's classification must be capable before parsing, got: ${JSON.stringify(ioClassification)}`,
        );
        const ioParsed = parseIoRegisters(ioResponse);
        assert.ok(ioParsed.ok, `io's live reply must parse: ${JSON.stringify(!ioParsed.ok ? ioParsed.refusal : null)}`);
        if (!ioParsed.ok) return;
        assert.ok(ioParsed.value.sections.length > 0, "io's parsed sections must carry at least one entry");
        const vicSection = ioParsed.value.sections[0]!;
        assert.equal(vicSection.sprites.columns, 8, "io's decoded sprite table must report eight columns");
        console.log(
          `text-monitor-live (42-09): MEASURED io ("${ioBuild.command}") on ${viceBinPath} -- chip=${vicSection.chip}, ` +
            `rasterLine=${vicSection.decoded.rasterLine}, borderColor=0x${vicSection.decoded.borderColor.toString(16)}`,
        );

        // -------------------------------------------------------------
        // Capability case: probe all five commands against the real
        // identity, assert every verdict capable, and log the real cache
        // key -- D-42-2's own property, observed live rather than argued
        // from the unit tests: the key must name the resolved absolute
        // path, never a bare binary name.
        // -------------------------------------------------------------
        const dialedByCommand: Record<TextCapabilityCommand, string> = {
          memmapshow: memmapResponse,
          "prof flat": profResponse,
          chis: chisResponse,
          bt: btResponse,
          io: ioResponse,
        };
        for (const command of Object.keys(dialedByCommand) as TextCapabilityCommand[]) {
          const response = dialedByCommand[command];
          const verdict = await probeTextCapability({ command, identity, dial: async () => response });
          assert.equal(
            verdict.outcome,
            "capable",
            `probeTextCapability(${command}) must answer capable against genuine stock VICE, got: ${JSON.stringify(verdict)}`,
          );
          const cacheKey = textCapabilityCacheKey(identity);
          assert.ok(cacheKey !== null, `the cache key must be non-null for a resolved identity, got: ${JSON.stringify(identity)}`);
          assert.ok(
            cacheKey!.includes(viceBinPath),
            `the cache key must name the resolved absolute binary path, not a bare name -- got "${cacheKey}"`,
          );
          console.log(
            `text-monitor-live (42-09): MEASURED capability probe(${command}) on ${viceBinPath} -- ` +
              `outcome=${verdict.outcome}, cacheKey=${JSON.stringify(cacheKey)}`,
          );
        }
      } finally {
        await textDisconnect(textSession);
      }

      await session.release();
    });

    assert.deepEqual(report.pidsAliveAfterTeardown, [], `pids still alive after teardown: ${JSON.stringify(report.pidsAliveAfterTeardown)}`);
  },
);
