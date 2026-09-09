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
import { TEXT_COMMAND_ALLOWLIST, withTextChannelLock } from "./text-protocol.ts";
import { dispatchStock, clearHeldStockSession, type StockDispatchDeps } from "./stock-dispatch.ts";
import { stockConnect, type StockConnectOptions } from "./stock-connect.ts";
import { resetChannelLockForTests } from "./channel-lock.ts";

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
