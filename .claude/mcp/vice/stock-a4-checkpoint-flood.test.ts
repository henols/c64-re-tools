#!/usr/bin/env node
// stock-a4-checkpoint-flood.test.ts
//
// OPT-IN, MANUAL-ONLY. Arms a genuine non-stopping (`stop:false`) checkpoint
// against a real, broker-launched genuine-stock VICE instance and drives
// sustained hit pressure past stock-checkpoints.ts's D-11 rate-limit guard
// (TRACE_HITS_PER_SECOND_LIMIT, currently 20/s) -- the ONE safety-critical
// probe this milestone's carried debt names and no prior phase armed: A4 of
// .planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md
// (the `setImmediate()` auto-disable deferral's race-freedom under a real,
// synchronous CHECKPOINT_INFO flood from inside VICE's own CPU loop) and
// 03-HUMAN-UAT.md scenario 3 (the same question, framed as a UAT gate) --
// closed by the SAME experiment; see plan 15-10's own objective.
//
// WHY GENTLE FIRST: CLAUDE.md's own Protocol constraint says a non-stopping
// checkpoint's CHECKPOINT_INFO hit frame is emitted SYNCHRONOUSLY, over the
// blocking socket, from inside the emulator's CPU loop
// (mon_breakpoint.c:557-562), BEFORE the stop flag is even checked -- on a
// hot address this can stall the emulator thread. This file therefore never
// starts with a tight loop. It starts by arming the checkpoint on the
// KERNAL's own default hardware-IRQ entry point (read from
// c64-memory-mapping's own memmap.json, never a typed literal -- see
// readKernalIrqAddress() below) -- a freshly booted, unmodified machine
// already executes this address at roughly 50-60Hz via the CIA1 timer IRQ
// (the jiffy-clock update), comfortably above the 20/s limit, with NO
// fixture, NO ACME, and NO autostart needed. Escalation to a genuinely tight
// loop (see ESCALATION_PROGRAM_SOURCE below) only happens if the gentle tier
// does not exceed the limit within its own bounded deadline, and only after
// this file records the wedge-triage recovery route it would use if the
// escalated tier stalls (see the console.log immediately before escalation,
// below).
//
// SAFETY DISCIPLINE (this file's own must-haves, mirrored from
// 15-10-PLAN.md's <threat_model>):
//   - Every wait below has an explicit, bounded deadline -- no `while (true)`
//     anywhere in this file, and every wire call this file makes already
//     carries stock-protocol.ts's own default 5000ms per-command timeout on
//     top of this file's own outer polling deadlines.
//   - The wait predicate that decides whether the checkpoint is firing reads
//     the checkpoint's own wire hit count (`vice_checkpoint_list`'s
//     `hitCount` field, sourced from CHECKPOINT_LIST's parsed wire response)
//     and the trace guard's own `autoDisables` report -- NEVER a
//     paused-state flag. Polling on paused state is the documented wrong
//     shape this project's own vice-sync.ts invariant forbids.
//   - Exactly one binary-monitor client is opened against the granted
//     instance for this entire test (one `openBrokerControl()` +
//     `stockConnect()` pair) -- stock VICE's monitor services exactly one
//     client, and a second connect is indistinguishable from a wedge.
//   - Every acquired process/scratch directory is recorded and torn down in
//     a `finally` block, mirroring stock-broker-live.test.ts's own
//     `withBrokerHarness()` shape (copied below, not imported -- none of
//     that file's harness helpers are exported).
//
// DEFAULT-SKIP IS MANDATORY, exactly like every sibling in test-gate.mjs's
// MANUAL_ONLY_TESTS list (this file is the NINTH entry -- see that file's
// header). `npm test` globs this file via `*.test.*`, and CI has no VICE.
//
// Opt in with:
//   VICE_LIVE_A4_FLOOD_BIN=/usr/bin/x64sc node --test stock-a4-checkpoint-flood.test.ts
//
// WHAT NOT TO DO:
//   - Never hand-build an argv string -- launch only through the real
//     spawned broker artifact (resources/vice-broker.mjs), exactly like
//     stock-broker-live.test.ts.
//   - Never open a second binary-monitor client against the instance this
//     file granted.
//   - Never poll on a paused-state flag to decide whether the checkpoint is
//     firing -- poll the wire hit count and the autoDisables report.
//   - Never retry a stalled wait indefinitely -- a deadline expiry is an
//     OBSERVATION (record it), not a reason to loop again.
//   - Never edit stock-checkpoints.ts, probe-binmon.mjs, or any other
//     production source from this file -- this plan's own instruction (and
//     15-10-PLAN.md's <verification>) is that no source file changes here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "./build.ts";
import { openBrokerControl, type BrokerControlSession, type AcquireGrant, type HeldLease } from "./vice-broker-client.ts";
import { dispatchStock, clearHeldStockSession, type StockDispatchDeps } from "./stock-dispatch.ts";
import { stockConnect, type StockConnectOptions } from "./stock-connect.ts";
import { probeReady } from "./broker-launch.mts";
import { TRACE_HITS_PER_SECOND_LIMIT } from "./stock-checkpoints.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");

// ---------------------------------------------------------------------------
// Opt-in gate -- its OWN environment variable (VICE_LIVE_A4_FLOOD_BIN), never
// reusing a sibling's name, so this file's own opt-in is self-describing in
// isolation.
// ---------------------------------------------------------------------------

const VICE_LIVE_A4_FLOOD_BIN_DEFAULT = "/usr/bin/x64sc";
const resolvedBinPath = process.env.VICE_LIVE_A4_FLOOD_BIN ?? VICE_LIVE_A4_FLOOD_BIN_DEFAULT;

const SKIP_REASON: string | false = !process.env.VICE_LIVE_A4_FLOOD_BIN
  ? `stock-a4-checkpoint-flood.test.ts is opt-in and default-skipped -- set VICE_LIVE_A4_FLOOD_BIN=/usr/bin/x64sc ` +
    `(or another real, genuinely unpatched stock VICE binary's absolute path) to run it. This probe arms a real ` +
    `non-stopping (stop:false) checkpoint against a real emulator, which this project's own CLAUDE.md documents as ` +
    `able to stall the emulator thread on a hot address -- it must never run unattended in CI. A bare "x64sc" on ` +
    `PATH resolves to the fork build (no binary monitor); always name the stock binary by its absolute path.`
  : !existsSync(resolvedBinPath)
    ? `VICE_LIVE_A4_FLOOD_BIN="${resolvedBinPath}" does not exist on disk -- opt-in requires a real stock VICE ` +
      `binary at that absolute path (e.g. /usr/bin/x64sc).`
    : false;

// ---------------------------------------------------------------------------
// The armed address: read from c64-memory-mapping's own memmap.json, never a
// typed-from-memory literal. CINV ($0314/$0315) is the KERNAL's own hardware
// IRQ vector; its documented default target is the KERNAL's default IRQ
// service routine entry point, which a freshly booted, unmodified machine
// reaches on every CIA1 timer IRQ (the jiffy-clock update, ~50-60Hz) -- past
// TRACE_HITS_PER_SECOND_LIMIT with no fixture needed.
// ---------------------------------------------------------------------------

interface KernalIrqAddress {
  address: number;
  addressHex: string;
  source: string;
}

function readKernalIrqAddress(): KernalIrqAddress {
  const memmapPath = join(HERE, "..", "..", "..", "src", "skills", "c64-memory-mapping", "memmap.json");
  const parsed = JSON.parse(readFileSync(memmapPath, "utf8")) as { entries: Array<Record<string, unknown>> };
  const raw = parsed.entries;
  assert.ok(Array.isArray(raw), `${memmapPath} must carry an "entries" array -- got shape: ${JSON.stringify(Object.keys(parsed ?? {}))}`);
  const cinvEntry = raw.find(
    (e) => e.sym === "CINV" && typeof e.desc === "string" && (e.desc as string).includes("Hardware IRQ Interrupt Address"),
  );
  assert.ok(cinvEntry, `c64-memory-mapping/memmap.json must carry a CINV entry naming the default hardware IRQ interrupt address (checked at ${memmapPath})`);
  const desc = (cinvEntry as Record<string, unknown>).desc as string;
  const m = desc.match(/\$([0-9A-Fa-f]{2,4})/);
  assert.ok(m, `CINV's memmap.json desc field did not carry a "$hex" default address: "${desc}"`);
  const address = parseInt(m![1], 16);
  return {
    address,
    addressHex: `$${m![1].toUpperCase()}`,
    source:
      `c64-memory-mapping/memmap.json, sym "CINV": "${desc}" -- the KERNAL's documented default hardware-IRQ ` +
      `service routine entry point, reached via the $0314/$0315 vector on every CIA1 timer IRQ (the jiffy-clock ` +
      `update) unless a program has redirected it. A freshly booted, unmodified machine executes this address at ` +
      `roughly 50-60Hz, comfortably above the ${TRACE_HITS_PER_SECOND_LIMIT}/s auto-disable limit, with no fixture ` +
      `or autostart needed for the gentle tier.`,
  };
}

// ---------------------------------------------------------------------------
// Escalation fixture (used ONLY if the gentle tier does not exceed the limit
// within its own bounded deadline). Identical BASIC-stub-with-computed-SYS
// prologue to stock-broker-live.test.ts's own REACTING_PROGRAM_SOURCE -- a
// fixed-length 13-byte header regardless of the entry address's actual digit
// count, since the digit bytes are always written by four unconditional
// modulo/division steps -- so ENTRY lands at the identical $080D and this
// program's own tight `loop: jmp loop` lands at the identical $080E, without
// needing to re-derive it from a fresh .rep listing.
// ---------------------------------------------------------------------------

const ESCALATION_PROGRAM_SOURCE = `!cpu 6510
* = $0801

        !word .eol, 10
        !byte $9e
        !byte '0' + entry % 10000 / 1000
        !byte '0' + entry %  1000 /  100
        !byte '0' + entry %   100 /   10
        !byte '0' + entry %    10
        !byte 0
.eol    !word 0

entry
        sei
loop
        jmp loop
`;
const ESCALATION_LOOP_ADDRESS = 0x080e;

function assembleEscalationProgram(dir: string): { prgPath: string; acmeVersion: string } {
  const acmeVersion = execFileSync("acme", ["--version"], { encoding: "utf8" }).trim();
  const srcPath = join(dir, "escalation.a");
  writeFileSync(srcPath, ESCALATION_PROGRAM_SOURCE);
  const prgPath = join(dir, "escalation.prg");
  execFileSync("acme", ["-v1", "-f", "cbm", "-o", prgPath, srcPath], { stdio: "pipe" });
  return { prgPath, acmeVersion };
}

// ---------------------------------------------------------------------------
// Real-broker-artifact spawn/teardown -- copied from stock-broker-live.
// test.ts's own startBroker()/stopBroker()/waitForBrokerJson()/isAlive()/
// waitForStockReady()/withBrokerHarness()/readGrantPid()/parseOkPayload()
// shape (none of that file's helpers are exported, per this plan's own
// read_first instruction: "Import from it if its helpers are exported;
// otherwise copy the shape and say so" -- they are not exported, so this is
// a copy, trimmed to what this probe needs -- no .d64/.prg blast-radius
// fixtures, since the gentle tier needs no program loaded at all).
// ---------------------------------------------------------------------------

interface BrokerHandle {
  child: ChildProcessWithoutNullStreams;
  stderr: string;
}

function startBroker(stateDir: string, viceBinPath: string, scratchDir: string): BrokerHandle {
  const merged: Record<string, string | undefined> = {
    ...process.env,
    // Deliberately omitted -- this genuinely runs on the host.
    VICE_SUPERVISOR_ALLOW_CONTAINER: undefined,
    VICE_BACKEND: "stock",
    VICE_BIN: viceBinPath,
    // MUST be unset, not merely omitted -- a non-empty VICE_ARGS is a FULL
    // argv override in buildViceArgs() and would bypass the real launch path.
    VICE_ARGS: undefined,
    VICE_BROKER_CONTROL_PORT: "0",
    VICE_BROKER_WARM_FLOOR: "0",
    VICE_BROKER_MAX: "1",
    VICE_BROKER_POLL_MS: "250",
    VICE_RESTART_BACKOFF_S: "1",
    // No persisted vicerc exists in this mkdtemp scratch dir, so the
    // 3.9-vs-3.10 "Configuration file version mismatch" modal cannot appear.
    XDG_CONFIG_HOME: scratchDir,
  };
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) env[key] = value;
  }
  const child = spawn(process.execPath, [BROKER_ARTIFACT, "--repo-root", scratchDir, "--state-dir", stateDir], { env }) as ChildProcessWithoutNullStreams;
  const handle: BrokerHandle = { child, stderr: "" };
  child.stderr.on("data", (chunk: Buffer) => {
    handle.stderr += chunk.toString("utf8");
  });
  return handle;
}

async function waitFor(predicate: () => boolean, deadlineMs: number, pollMs = 100): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return predicate();
}

async function stopBroker(handle: BrokerHandle): Promise<void> {
  if (handle.child.exitCode !== null || handle.child.signalCode !== null) return;
  handle.child.kill("SIGTERM");
  const exited = await waitFor(() => handle.child.exitCode !== null || handle.child.signalCode !== null, 3000);
  if (!exited) handle.child.kill("SIGKILL");
}

async function waitForBrokerJson(stateDir: string, deadlineMs = 10000): Promise<Record<string, unknown>> {
  const path = join(stateDir, "broker.json");
  const appeared = await waitFor(() => existsSync(path) && typeof JSON.parse(readFileSync(path, "utf8")).control_port === "number", deadlineMs);
  assert.ok(appeared, "broker.json with a control_port did not appear within deadline");
  return JSON.parse(readFileSync(path, "utf8"));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Bounded-waits for stock VICE's binary monitor to actually ANSWER, never a
 * fixed sleep -- mirrors stock-broker-live.test.ts's own waitForStockReady(). */
async function waitForStockReady(port: number, deadlineMs = 30000): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (await probeReady(port, { backend: "stock" })) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function depsFor(host: string, grant: AcquireGrant, controlSession: BrokerControlSession, stateDir: string): StockDispatchDeps {
  const lease: HeldLease = {
    host,
    port: grant.port,
    targetId: grant.id,
    brokerControl: controlSession,
    epochFile: grant.epoch_file,
    supervisorDir: stateDir,
  };
  return {
    ensureLease: async () => ({ ok: true as const, lease }),
    connect: (opts: StockConnectOptions) => stockConnect(opts),
  };
}

function parseOkPayload(result: { content: { type: "text"; text: string }[]; isError: boolean }): Record<string, unknown> {
  assert.equal(result.isError, false, `expected an ok answer but got an error: ${result.content[0]?.text}`);
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

interface HarnessReport {
  recordedPids: number[];
  pidsAliveAfterTeardown: number[];
}

async function withBrokerHarness(fn: (ctx: { stateDir: string; scratchDir: string; recordPid: (pid: number) => void }) => Promise<void>): Promise<HarnessReport> {
  build(); // ensure resources/ is a fresh build of the current TypeScript source
  const scratchDir = mkdtempSync(join(tmpdir(), "stock-a4-checkpoint-flood-"));
  const stateDir = join(scratchDir, "state");
  const recordedPids = new Set<number>();
  const handle = startBroker(stateDir, resolvedBinPath, scratchDir);
  let pidsAliveAfterTeardown: number[] = [];
  try {
    await fn({ stateDir, scratchDir, recordPid: (pid: number) => recordedPids.add(pid) });
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
      console.error(`stock-a4-checkpoint-flood: pids still alive after teardown: ${JSON.stringify(pidsAliveAfterTeardown)}`);
    }
  }
  return { recordedPids: [...recordedPids], pidsAliveAfterTeardown };
}

/** Reads the granted instance's own pid from its epoch.json (bounded retry). */
async function readGrantPid(epochFile: string, deadlineMs = 5000): Promise<number> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (existsSync(epochFile)) {
      const epoch = JSON.parse(readFileSync(epochFile, "utf8")) as { pid: number };
      if (typeof epoch.pid === "number") return epoch.pid;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`readGrantPid: ${epochFile} never carried a pid within ${deadlineMs}ms`);
}

function findRegister(registers: Record<string, number>, name: string): number | undefined {
  const key = Object.keys(registers).find((k) => k.toUpperCase() === name);
  return key !== undefined ? registers[key] : undefined;
}

// ---------------------------------------------------------------------------
// The flood poll loop -- the wait predicate this file's own must-haves
// require: reads the checkpoint's WIRE hit count (vice_checkpoint_list's own
// `hitCount` field) and the trace guard's own `autoDisables` report. NEVER a
// paused-state flag. Bounded by `deadlineMs`; a deadline expiry with no
// auto-disable is recorded as an observation and returned, never retried
// indefinitely.
// ---------------------------------------------------------------------------

interface CheckpointEntry {
  id: number;
  hitCount: number;
  enabled: boolean;
  [key: string]: unknown;
}

interface AutoDisableEntry {
  checkpointNum: number;
  reason: string;
  at: number;
  hitsPerSecond: number;
}

interface FloodPollResult {
  triggered: boolean;
  iterations: number;
  lastHitCount: number | null;
  firstNonZeroHitObservedAtIteration: number | null;
  autoDisableEntry: AutoDisableEntry | null;
  lastCheckpointEntry: CheckpointEntry | null;
}

async function pollForAutoDisable(
  deps: StockDispatchDeps,
  checkpointId: number,
  { pollIntervalMs, deadlineMs }: { pollIntervalMs: number; deadlineMs: number },
): Promise<FloodPollResult> {
  const deadline = Date.now() + deadlineMs;
  let iterations = 0;
  let lastHitCount: number | null = null;
  let firstNonZeroHitObservedAtIteration: number | null = null;
  let lastCheckpointEntry: CheckpointEntry | null = null;

  while (Date.now() < deadline) {
    iterations++;
    // Resume -- the CIA1 timer IRQ (or, in the escalated tier, the tight
    // loop) only advances while the machine is actually running.
    const runResult = await dispatchStock("vice_execution_run", {}, deps);
    if ((runResult as { isError: boolean }).isError) {
      console.log(`stock-a4-checkpoint-flood: vice_execution_run reported an error mid-poll (iteration ${iterations}): ${JSON.stringify(runResult)}`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    // Read -- this halts the machine again (every inbound byte does, on
    // stock), which is why the loop resumes again at the top of the next
    // iteration rather than trying to read while running.
    const listResult = await dispatchStock("vice_checkpoint_list", {}, deps);
    if ((listResult as { isError: boolean }).isError) {
      console.log(`stock-a4-checkpoint-flood: vice_checkpoint_list reported an error mid-poll (iteration ${iterations}): ${JSON.stringify(listResult)}`);
      continue;
    }
    const payload = parseOkPayload(listResult as { content: { type: "text"; text: string }[]; isError: boolean });
    const checkpoints = (payload.checkpoints as CheckpointEntry[]) ?? [];
    const cpEntry = checkpoints.find((c) => c.id === checkpointId) ?? null;
    lastCheckpointEntry = cpEntry;
    if (cpEntry) {
      lastHitCount = cpEntry.hitCount;
      if (firstNonZeroHitObservedAtIteration === null && cpEntry.hitCount > 0) {
        firstNonZeroHitObservedAtIteration = iterations;
      }
    }
    const autoDisables = (payload.autoDisables as AutoDisableEntry[]) ?? [];
    const entry = autoDisables.find((e) => e.checkpointNum === checkpointId) ?? null;
    console.log(
      `stock-a4-checkpoint-flood: poll iteration ${iterations} -- checkpoint ${checkpointId} hitCount=${cpEntry?.hitCount ?? "unknown"} ` +
        `enabled=${cpEntry?.enabled ?? "unknown"} autoDisableEntry=${entry ? JSON.stringify(entry) : "none yet"}`,
    );
    if (entry) {
      return { triggered: true, iterations, lastHitCount, firstNonZeroHitObservedAtIteration, autoDisableEntry: entry, lastCheckpointEntry: cpEntry };
    }
  }
  return { triggered: false, iterations, lastHitCount, firstNonZeroHitObservedAtIteration, autoDisableEntry: null, lastCheckpointEntry };
}

// ---------------------------------------------------------------------------
// The probe itself.
// ---------------------------------------------------------------------------

test(
  "stock-a4-checkpoint-flood: a real non-stopping checkpoint on a hot KERNAL address exceeds the D-11 rate limit, the auto-disable fires and reaches the wire, and the emulator keeps progressing afterwards",
  { skip: SKIP_REASON, timeout: 120000 },
  async () => {
    clearHeldStockSession();
    const kernalIrq = readKernalIrqAddress();
    console.log(`stock-a4-checkpoint-flood: armed address = ${kernalIrq.addressHex} (${kernalIrq.address}) -- ${kernalIrq.source}`);

    // A single mutable holder, rather than separate `let` bindings, for the
    // values this closure sets: TypeScript's control-flow narrowing tracks a
    // plain `let` variable's last DIRECTLY-VISIBLE assignment in its own
    // declaring scope, ignoring assignments made only inside a nested
    // closure -- which would narrow every one of these to their `null`
    // initialiser at the read sites below regardless of what the closure
    // actually does at runtime. Object-property assignment does not fall
    // into that trap.
    const outcome: {
      gentleResult: FloodPollResult | null;
      escalatedResult: FloodPollResult | null;
      escalationNeeded: boolean;
      escalationAcmeVersion: string | null;
      wireEnabledAfterDisable: boolean | null;
      progressPcSamples: number[];
    } = {
      gentleResult: null,
      escalatedResult: null,
      escalationNeeded: false,
      escalationAcmeVersion: null,
      wireEnabledAfterDisable: null,
      progressPcSamples: [],
    };

    const report = await withBrokerHarness(async ({ stateDir, scratchDir, recordPid }) => {
      const brokerJson = await waitForBrokerJson(stateDir);
      const host = "127.0.0.1";
      assert.ok(Number(brokerJson.control_port) > 0, `broker.json must carry a real control_port, got: ${JSON.stringify(brokerJson)}`);

      const opened = await openBrokerControl(stateDir);
      assert.ok(opened.ok, `openBrokerControl failed: ${JSON.stringify(opened)}`);
      if (!opened.ok) return;
      const controlSession = opened.session;

      const acquired = await controlSession.acquire();
      assert.ok(acquired.ok, `acquire failed: ${JSON.stringify(acquired)}`);
      if (!acquired.ok) return;
      const grant = acquired.grant;

      const pid = await readGrantPid(grant.epoch_file);
      recordPid(pid);

      const ready = await waitForStockReady(grant.port);
      assert.ok(ready, `the broker-launched instance at port ${grant.port} never answered a binary-monitor probe within the deadline`);

      const deps = depsFor(host, grant, controlSession, stateDir);

      // --- Step 1/2: arm the gentle-tier checkpoint on the freshly booted,
      // unmodified machine -- no autostart needed, the KERNAL IRQ fires on
      // its own via the CIA1 timer.
      const addResult = await dispatchStock(
        "vice_checkpoint_add",
        { start: kernalIrq.addressHex, stop: false, acknowledgeTraceRisk: true },
        deps,
      );
      const addPayload = parseOkPayload(addResult as { content: { type: "text"; text: string }[]; isError: boolean });
      console.log(`stock-a4-checkpoint-flood: vice_checkpoint_add (gentle tier, ${kernalIrq.addressHex}) -> ${JSON.stringify(addPayload)}`);
      const gentleCheckpointId = addPayload.id as number;
      assert.equal(
        addPayload.traceMode,
        true,
        `expected the gentle-tier checkpoint to be registered as a trace-mode (stop:false) checkpoint, got: ${JSON.stringify(addPayload)}`,
      );

      // --- Step 3/4: resume and poll, bounded, for the hit count to advance
      // and for the D-11 guard's autoDisables report to name this checkpoint.
      outcome.gentleResult = await pollForAutoDisable(deps, gentleCheckpointId, { pollIntervalMs: 600, deadlineMs: 9000 });
      console.log(`stock-a4-checkpoint-flood: gentle tier result = ${JSON.stringify(outcome.gentleResult)}`);

      let activeCheckpointId = gentleCheckpointId;
      let activeResult: FloodPollResult = outcome.gentleResult;

      if (!outcome.gentleResult.triggered) {
        // --- Escalation, only now, and only after recording the recovery
        // route this file would use if the escalated tier itself stalls:
        // per vice-wedge-triage/SKILL.md, a bracket that reads exactly zero
        // twice in a row with no epoch change is `wedged`, and the last
        // resort is `vice_recycle` with a reason. This harness has no
        // `vice_recycle` (it drives dispatchStock() directly, not the full
        // proxy's diagnose/recycle surface) -- its equivalent recovery
        // action is this test's OWN teardown: withBrokerHarness's `finally`
        // block SIGTERMs-then-SIGKILLs the granted process regardless of how
        // this function returns, which is the bounded substitute for
        // `vice_recycle` in this harness's own scope.
        console.log(
          "stock-a4-checkpoint-flood: gentle tier did not exceed the rate limit within its deadline -- escalating to a tight loop. " +
            "Recovery route if the escalated tier stalls: this test's own withBrokerHarness() teardown " +
            "(SIGTERM-then-SIGKILL of the granted process, unconditional in a finally block) is the bounded " +
            "substitute for vice_recycle in this harness's scope -- there is no vice_diagnose/vice_recycle surface " +
            "available here, since this file drives dispatchStock() directly rather than the full MCP proxy.",
        );
        outcome.escalationNeeded = true;

        // Delete the gentle-tier checkpoint first so it stops contributing
        // hits (and confusing the payload) once the tight loop is armed.
        await dispatchStock("vice_checkpoint_delete", { checkpoint_num: gentleCheckpointId }, deps);

        const { prgPath, acmeVersion } = assembleEscalationProgram(scratchDir);
        outcome.escalationAcmeVersion = acmeVersion;
        console.log(`stock-a4-checkpoint-flood: escalation -- acme --version -> ${acmeVersion}`);

        const autostartResult = await dispatchStock("vice_autostart", { path: prgPath, run: true }, deps);
        const autostartPayload = parseOkPayload(autostartResult as { content: { type: "text"; text: string }[]; isError: boolean });
        console.log(`stock-a4-checkpoint-flood: escalation -- vice_autostart -> ${JSON.stringify(autostartPayload)}`);

        const escAddResult = await dispatchStock(
          "vice_checkpoint_add",
          { start: `$${ESCALATION_LOOP_ADDRESS.toString(16)}`, stop: false, acknowledgeTraceRisk: true },
          deps,
        );
        const escAddPayload = parseOkPayload(escAddResult as { content: { type: "text"; text: string }[]; isError: boolean });
        console.log(
          `stock-a4-checkpoint-flood: vice_checkpoint_add (escalated tier, $${ESCALATION_LOOP_ADDRESS.toString(16)}) -> ${JSON.stringify(escAddPayload)}`,
        );
        const escalatedCheckpointId = escAddPayload.id as number;

        outcome.escalatedResult = await pollForAutoDisable(deps, escalatedCheckpointId, { pollIntervalMs: 200, deadlineMs: 6000 });
        console.log(`stock-a4-checkpoint-flood: escalated tier result = ${JSON.stringify(outcome.escalatedResult)}`);

        activeCheckpointId = escalatedCheckpointId;
        activeResult = outcome.escalatedResult;
      }

      // --- Step 5: verify the toggle actually reached the wire, not just
      // the local autoDisabled report -- re-list and read the checkpoint's
      // OWN enabled flag straight off CHECKPOINT_LIST's parsed wire
      // response. An entry in the local report with a still-enabled
      // checkpoint on the wire is precisely the A4 race.
      if (activeResult.triggered) {
        const verifyListResult = await dispatchStock("vice_checkpoint_list", {}, deps);
        const verifyPayload = parseOkPayload(verifyListResult as { content: { type: "text"; text: string }[]; isError: boolean });
        const verifyEntry = ((verifyPayload.checkpoints as CheckpointEntry[]) ?? []).find((c) => c.id === activeCheckpointId) ?? null;
        outcome.wireEnabledAfterDisable = verifyEntry?.enabled ?? null;
        console.log(
          `stock-a4-checkpoint-flood: wire-side re-check after auto-disable -- checkpoint ${activeCheckpointId} entry = ${JSON.stringify(verifyEntry)}`,
        );
      }

      // --- Step 6: verify the emulator is still alive and progressing --
      // resume, sleep a real interval, read the PC register, repeat a
      // bounded number of times, and confirm the PC is not stuck on a
      // single value. A dead or non-progressing emulator after the flood is
      // a fail -- exactly the hazard CLAUDE.md's own Protocol constraint
      // predicts. PC is used rather than LIN/vice_cycles_stopwatch: this
      // build's REGISTERS_GET consistently reported LIN=0 immediately after
      // every halt in a live spot-check (including in 15-08's own unrelated
      // evidence transcript), which reads like this monitor's halt point is
      // synchronised to the raster rather than LIN tracking real elapsed
      // time at the read granularity this file uses -- PC, sampled several
      // times, has no such ambiguity: the KERNAL/BASIC idle loop the machine
      // is running keeps moving regardless. This mirrors
      // stock-broker-live.test.ts's own scenario-2 running-state proof
      // (bounded resume/sleep/read attempts, PC as the observable).
      const PROGRESS_CHECK_ATTEMPTS = 5;
      const PROGRESS_CHECK_SLEEP_MS = 400;
      for (let attempt = 0; attempt < PROGRESS_CHECK_ATTEMPTS; attempt++) {
        await dispatchStock("vice_execution_run", {}, deps);
        await new Promise((r) => setTimeout(r, PROGRESS_CHECK_SLEEP_MS));
        const regsResult = await dispatchStock("vice_registers_get", {}, deps);
        const regsPayload = parseOkPayload(regsResult as { content: { type: "text"; text: string }[]; isError: boolean });
        const pc = findRegister(regsPayload.registers as Record<string, number>, "PC");
        outcome.progressPcSamples.push(pc ?? -1);
      }
      console.log(`stock-a4-checkpoint-flood: post-flood progress check -- PC samples over ${PROGRESS_CHECK_ATTEMPTS} bounded resume/sleep/read attempts = ${JSON.stringify(outcome.progressPcSamples)}`);

      // Clean up whichever checkpoint is still armed.
      await dispatchStock("vice_checkpoint_delete", { checkpoint_num: activeCheckpointId }, deps);

      await controlSession.release();
    });

    assert.ok(report !== null, "withBrokerHarness must have returned a report");
    assert.deepEqual(
      report!.pidsAliveAfterTeardown,
      [],
      `pids still alive after teardown: ${JSON.stringify(report!.pidsAliveAfterTeardown)} (recorded: ${JSON.stringify(report!.recordedPids)})`,
    );

    // --- The contracted assertions (this plan's own instruction: assert
    // only what the design CONTRACTS -- that a stop:false checkpoint
    // exceeding the limit produces an auto-disable entry, that the
    // checkpoint is disabled on the wire afterwards, and that the emulator
    // still progresses -- never the observed hits-per-second number, which
    // is a measurement of this host, not a contract).
    const finalResult = outcome.escalationNeeded ? outcome.escalatedResult : outcome.gentleResult;
    assert.ok(finalResult, "a flood poll result must exist by the time assertions run");
    assert.ok(
      finalResult.triggered,
      `expected the D-11 rate-limit guard's auto-disable to fire within the ${outcome.escalationNeeded ? "escalated" : "gentle"} tier's deadline, but it never did -- ` +
        `last observed: ${JSON.stringify(finalResult)}`,
    );
    assert.equal(
      outcome.wireEnabledAfterDisable,
      false,
      `expected the checkpoint's WIRE-side enabled flag to read false after the auto-disable -- a local-only disable with the checkpoint still ` +
        `enabled on the wire is precisely the A4 race, got: ${outcome.wireEnabledAfterDisable}`,
    );
    assert.ok(
      new Set(outcome.progressPcSamples).size > 1,
      `expected the emulator's PC to vary across ${outcome.progressPcSamples.length} bounded post-flood resume/sleep/read attempts (a stuck PC means the emulator ` +
        `stopped progressing) -- got: ${JSON.stringify(outcome.progressPcSamples)}`,
    );

    console.log(
      `stock-a4-checkpoint-flood: SUMMARY -- escalationNeeded=${outcome.escalationNeeded}${outcome.escalationAcmeVersion ? ` (acme ${outcome.escalationAcmeVersion})` : ""}, ` +
        `gentleResult=${JSON.stringify(outcome.gentleResult)}, escalatedResult=${JSON.stringify(outcome.escalatedResult)}, ` +
        `wireEnabledAfterDisable=${outcome.wireEnabledAfterDisable}, progressPcSamples=${JSON.stringify(outcome.progressPcSamples)}`,
    );
  },
);
