#!/usr/bin/env node
// stock-broker-live.test.ts
//
// OPT-IN, MANUAL-ONLY. The FIRST test in this tree that launches genuine
// stock VICE through the REAL spawned broker artifact (resources/
// vice-broker.mjs) and dispatches vice_disk_attach / vice_autostart through
// dispatchStock() against the instance it granted -- so both buildViceArgs()
// AND the production makeLoggingSpawn() + withCrashSupervision() daemon
// composition are in the call path, not merely a hand-built argv string.
//
// WHY THIS FILE EXISTS (audit item I-2 / phase 8.2 plan 03): every existing
// live test (stock-live.test.ts, stock-live-triage.test.ts) spawns x64sc
// DIRECTLY with node:child_process and never calls buildViceArgs(),
// tryLaunchOne() or acquirePortAndLaunch() -- that gap is EXACTLY where the
// Drive8Type=0 defect (FINDING-C1, closed by plan 08.2-02) hid: no test,
// unit or live, ever exercised the argv the broker actually constructs and
// passes to spawn. Phase 8.1's own "-drive8type 1541 is sufficient" proof
// (08.1-WALKTHROUGH-EVIDENCE.md §4) was a STANDALONE hand-spawned probe --
// airtight evidence the FLAG works, not evidence the CODE PATH is fixed.
// This file closes that gap, and additionally settles the one question the
// ROADMAP assigns to item 1: does a bare .prg autostart hit the same
// Drive8Type=0 wall a .d64 load does, or bypass the drive entirely? See
// Task 2 below (the three tests: .d64, post-fix .prg, pre-fix .prg).
//
// A REAL, LIVE, UNPLANNED FINDING THIS FILE'S OWN DEVELOPMENT SURFACED
// (recorded in full in 08.2-BROKER-LIVE-EVIDENCE.md as FINDING-D1, NOT
// fixed here -- read before touching the fixture below or "simplifying" it
// away):
//
//   A raw machine-code .prg whose first two bytes at $0801 are NOT a valid
//   BASIC "next line" link pointer does NOT survive a LOAD+RUN autostart
//   byte-for-byte. VICE's own KERNAL-equivalent BASIC program relink (run
//   as part of AUTOSTART's simulated "RUN" keystroke) scans forward from
//   $0801 looking for a zero byte to compute a fresh link-pointer value,
//   and OVERWRITES the first two bytes of the loaded block with that
//   computed value -- confirmed empirically twice, with two DIFFERENT
//   payload contents (0xEA-filled and 0x41-filled) both landing on the
//   IDENTICAL computed override ($0812), which is one byte past this
//   fixture's own 16-byte block (the first non-loaded, i.e. zero, byte the
//   scan reaches). This is genuine, well-known C64 KERNAL/BASIC behaviour
//   (why every real SYS-based loader begins with a proper "10 SYS n" BASIC
//   stub rather than dropping raw code at $0801), NOT a defect in
//   stock-machine.ts's handleAutostart/handleDiskAttach (CLAUDE.md/
//   RESEARCH.md's own instruction: those handlers are correct as written;
//   the AUTOSTART wire command is sent exactly as it should be). The fix
//   here is in this file's OWN fixture design, not in source: the on-disk
//   file reserves its first two loaded bytes as a KERNAL-owned "sacrificial"
//   field (deliberately written as 0x00 0x00, expected to be overwritten,
//   NEVER asserted on) and the actual verified, recognisable 16-byte
//   NOP-run-ending-RTS payload starts two bytes later, at $0803 --
//   VERIFIED_PAYLOAD_ADDRESS below. This is still "the program's load
//   region upward", just offset by the two bytes that are demonstrably not
//   the file's own content once RUN executes -- and it is still a fully
//   discriminating, non-vacuous proof: pre-fix (Drive8Type=0), nothing
//   loads at all and this region never matches; post-fix, it matches
//   reliably within a few real seconds of run time.
//
// A SECOND LIVE FINDING, LOAD-BEARING FOR THE POLLING LOOP BELOW: the
// binary monitor halts the emulated CPU on ANY inbound byte (CLAUDE.md /
// stock-connect.ts's own CR-02 comment) and only vice_execution_run's EXIT
// resumes it. AUTOSTART's own wire handler resumes the machine itself as
// part of completing the load (confirmed live: the answer's own runState
// reads "running" immediately after both vice_disk_attach and
// vice_autostart) -- but this file's OWN subsequent vice_memory_read polls
// are ALSO inbound bytes and each one re-halts the machine the instant it
// arrives. A poll loop that reads memory back-to-back with no explicit
// resume between reads therefore starves the CPU of real run time almost
// entirely (confirmed empirically: reading immediately after resuming
// produces zero elapsed run time and the load never completes). The
// correct shape, used throughout this file, is: resume (vice_execution_run)
// -> sleep a real interval -> THEN read (which halts it again for the next
// iteration). This is not a defect either -- vice_execution_run's own
// header comment already documents it as "the ONE handler in the whole
// phase permitted to send EXIT" -- it is simply the live-timing discipline
// this file's poll loop must respect to observe the load actually finish.
//
// DEFAULT-SKIP IS MANDATORY, exactly like every sibling in this list: `npm
// test` globs this file via `*.test.*`, and CI has no VICE. SKIP_REASON is
// computed once at module scope, and EVERY test in this file passes it
// through node:test's own `{ skip }` option -- never a hand-rolled early
// return, which would report a false PASS rather than a SKIP.
//
// Opt in with:
//   VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-broker-live.test.ts
//
// Registered as the SEVENTH and, as of this plan, last MANUAL_ONLY_TESTS
// entry in test-gate.mjs: spawns a real broker daemon (resources/
// vice-broker.mjs, under bare node) AND a real emulator process per test
// case, default-SKIPs everywhere (never hangs CI), and is opted into
// exactly like its six siblings.
//
// WHAT NOT TO DO:
//   - Never hand-build an argv string for the launch under test. The whole
//     point of this file is exercising buildViceArgs()/tryLaunchOne()/the
//     spawned broker artifact for real -- a parallel hand-spawned x64sc
//     would silently reintroduce the exact gap this file exists to close.
//   - Never call acquirePortAndLaunch() in-process with spawn: nodeSpawn for
//     the .d64 or post-fix .prg cases -- that bypasses vice-broker.mts
//     entirely and would validate I-1's config isolation seam without ever
//     touching the real makeLoggingSpawn()/withCrashSupervision()
//     composition a production broker uses. Those two cases MUST launch
//     through the spawned resources/vice-broker.mjs artifact. Only the
//     pre-fix .prg baseline (Task 2) uses the in-process tryLaunchOne()
//     route, and only because a static VICE_ARGS cannot interpolate a
//     daemon-allocated port -- see that test's own inline comment.
//   - Never acquire a child process, socket, or scratch directory outside a
//     try/finally whose finally SIGTERMs-then-SIGKILLs the emulator and
//     rmSync()s every scratch dir -- stock VICE's binary monitor services
//     EXACTLY ONE client, and an orphaned emulator from a prior run holds
//     that slot and makes the NEXT run look wedged, not merely leak a
//     process.
//   - Never open a second monitor session against the same instance.
//   - Never touch CPUHISTORY_GET or any cycle history -- /usr/bin/x64sc is
//     VICE 3.9 and lacks opcode 0x86 entirely.
//   - Never touch anything under this repo's own .vice-supervisor/ -- every
//     path this file writes lives under mkdtempSync(join(tmpdir(), ...)).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

import { build } from "./build.ts";
import { openBrokerControl, type BrokerControlSession, type HeldLease, type AcquireGrant } from "./vice-broker-client.ts";
import { dispatchStock, clearHeldStockSession, type StockDispatchDeps } from "./stock-dispatch.ts";
import { stockConnect, type StockConnectOptions } from "./stock-connect.ts";
import { probeReady } from "./broker-launch.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");

// ---------------------------------------------------------------------------
// Opt-in gate -- copied verbatim from stock-live.test.ts's own idiom, same
// env var name (this project's established name for "a real stock binary
// the current test opts into" -- reused rather than inventing a new one).
// ---------------------------------------------------------------------------

const VICE_LIVE_STOCK_BIN_DEFAULT = "/usr/bin/x64sc";
const resolvedBinPath = process.env.VICE_LIVE_STOCK_BIN ?? VICE_LIVE_STOCK_BIN_DEFAULT;

/** Computed exactly once. Every test in this file passes this (or
 * SKIP_REASON_D64 below) through node:test's own `{ skip }` option -- never
 * a hand-rolled early return, which would report a false PASS rather than a
 * SKIP. */
const SKIP_REASON: string | false = !process.env.VICE_LIVE_STOCK_BIN
  ? `stock-broker-live.test.ts is opt-in and default-skipped -- set VICE_LIVE_STOCK_BIN=/usr/bin/x64sc ` +
    `(or another real, genuinely unpatched stock VICE binary's absolute path) to run it. Defaults to ` +
    `${VICE_LIVE_STOCK_BIN_DEFAULT} when set to a truthy non-path value. A bare "x64sc" on PATH resolves ` +
    `to the fork build (which has -mcpserver, not this stock binary monitor path) -- always name the ` +
    `stock binary by absolute path.`
  : !existsSync(resolvedBinPath)
    ? `VICE_LIVE_STOCK_BIN="${resolvedBinPath}" does not exist on disk -- opt-in requires a real stock VICE ` +
      `binary at that absolute path (e.g. /usr/bin/x64sc). A bare "x64sc" on PATH would resolve to the fork ` +
      `build at /usr/local/bin/x64sc instead of genuine stock.`
    : false;

/** /usr/bin/c1541 is a pre-existing system binary, addressed by absolute
 * path (never by bare "c1541" on PATH -- /usr/local/bin/c1541 is the fork
 * build's own copy). The .d64 case (only) needs it to wrap this file's
 * synthetic .prg into a disk image; if it is absent, that ONE case SKIPs
 * with a named reason -- it never silently falls through to a .prg-only
 * assertion that would look like the disk case passed. */
const C1541_BIN = "/usr/bin/c1541";
const SKIP_REASON_D64: string | false =
  SKIP_REASON ||
  (!existsSync(C1541_BIN)
    ? `stock-broker-live.test.ts's .d64 case additionally needs c1541 at the absolute path "${C1541_BIN}" to wrap ` +
      `the synthetic .prg fixture into a disk image -- it was not found on disk. A bare "c1541" on PATH would ` +
      `resolve to /usr/local/bin/c1541 (the fork build's own copy) instead.`
    : false);

// ---------------------------------------------------------------------------
// The synthetic fixture. Built in-process (raw bytes), never via the ACME
// cross-assembler -- Phase 8.1's own walkthrough was blocked a whole task by
// ACME's missing cbm/c64/*.a library (FINDING-A1), and that dependency is
// not worth inheriting inside a test file.
// ---------------------------------------------------------------------------

const PRG_LOAD_ADDRESS = 0x0801;
/** FINDING-D1 (this file's own header comment, and 08.2-BROKER-LIVE-
 * EVIDENCE.md): a LOAD+RUN autostart overwrites the FIRST TWO bytes at the
 * program's load address with a computed BASIC relink pointer, regardless
 * of their original content -- confirmed live with two different fixture
 * contents landing on the identical override. These two bytes are
 * therefore written as an explicit, never-asserted "sacrificial" field
 * (0x00 0x00) rather than pretending they are part of the verified
 * payload. */
const KERNAL_RELINK_BYTES = 2;
const VERIFIED_PAYLOAD_ADDRESS = PRG_LOAD_ADDRESS + KERNAL_RELINK_BYTES; // $0803

/** 16 bytes: 15 NOPs ($EA) then RTS ($60) -- "a short, recognisable payload
 * of at least 16 bytes ending in RTS", per this plan's own instruction.
 * Harmless if the CPU ever actually falls into it (a run of NOPs into a
 * plain return), and trivially distinguishable from "whatever was already
 * in fresh RAM" (typically 0x00 or a floating pattern, never a 15-long run
 * of 0xEA ending 0x60). */
const VERIFIED_PAYLOAD: readonly number[] = Object.freeze([...Array(15).fill(0xea), 0x60]);

interface PrgFixture {
  prgPath: string;
}

/** Writes the synthetic .prg into `dir`: 2-byte little-endian load address,
 * 2 sacrificial KERNAL-owned bytes, then VERIFIED_PAYLOAD. */
function writePrgFixture(dir: string): PrgFixture {
  const prgPath = join(dir, "brokerlive.prg");
  const header = Buffer.from([PRG_LOAD_ADDRESS & 0xff, (PRG_LOAD_ADDRESS >> 8) & 0xff]);
  const sacrificial = Buffer.from([0x00, 0x00]);
  const payload = Buffer.from(VERIFIED_PAYLOAD);
  writeFileSync(prgPath, Buffer.concat([header, sacrificial, payload]));
  return { prgPath };
}

/** Wraps `prgPath` into a single-file .d64 via the real, absolute-path
 * /usr/bin/c1541 -- never a hand-rolled disk-image writer. Emits the
 * harmless "OPENCBM: opening dynamic library libopencbm.so failed!" line on
 * stderr on every invocation; that is expected and not treated as an
 * error (only a non-zero exit is). */
function writeD64Fixture(dir: string, prgPath: string): string {
  const d64Path = join(dir, "brokerlive.d64");
  execFileSync(C1541_BIN, ["-format", "brokerlive,01", "d64", d64Path, "-write", prgPath, "brokerlive"], { stdio: "pipe" });
  return d64Path;
}

// ---------------------------------------------------------------------------
// Real-broker-artifact spawn/teardown -- stock-live-broker-monitor.test.ts's
// own startBroker()/stopBroker()/waitForBrokerJson() shape, trimmed to what
// this file needs (no crash-respawn machinery).
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
    // argv override in buildViceArgs() and would bypass it entirely, which
    // is exactly the gap this file exists to close.
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

/** Bounded-waits for stock VICE's binary monitor to actually ANSWER (a
 * one-PING-then-EXIT exchange, resuming whatever it halted) -- never a
 * fixed sleep. A cold acquire's grant is handed back the instant the
 * process is SPAWNED (handleAcquire()'s cold-launch arm), so this file, not
 * the broker, is what proves the emulator is actually listening before
 * dialling the real monitor session. */
async function waitForStockReady(port: number, deadlineMs = 30000): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (await probeReady(port, { backend: "stock" })) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/** Builds a REAL, production-shaped StockDispatchDeps for one grant --
 * `ensureLease` hands back the lease this grant already holds (never
 * re-acquiring), and `connect` is a thin pass-through to the real
 * stockConnect(). Mirrors stock-live-broker-monitor.test.ts's own
 * depsFor(). */
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

interface PollResult {
  matched: boolean;
  attempts: number;
  lastObserved: number[] | null;
}

/** The load-timing-aware poll loop this file's own header comment
 * documents: resume (vice_execution_run) -> sleep a real interval -> THEN
 * read (which halts the machine again for the next iteration's resume).
 * Reading immediately after resuming (no sleep) starves the CPU of real
 * run time almost entirely -- confirmed empirically while writing this
 * file. Never a fixed sleep alone: this polls until either the expected
 * bytes appear or `deadlineMs` elapses. */
async function pollUntilBytesMatch(deps: StockDispatchDeps, address: number, expected: readonly number[], deadlineMs: number, intervalMs = 500): Promise<PollResult> {
  const deadline = Date.now() + deadlineMs;
  let attempts = 0;
  let lastObserved: number[] | null = null;
  while (Date.now() < deadline) {
    attempts++;
    await dispatchStock("vice_execution_run", {}, deps);
    await new Promise((r) => setTimeout(r, intervalMs));
    const memResult = await dispatchStock(
      "vice_memory_read",
      { address: `$${address.toString(16)}`, size: expected.length, encoding: "array", sideEffects: false },
      deps,
    );
    const payload = parseOkPayload(memResult as { content: { type: "text"; text: string }[]; isError: boolean });
    lastObserved = payload.bytes as number[];
    if (JSON.stringify(lastObserved) === JSON.stringify(expected)) {
      return { matched: true, attempts, lastObserved };
    }
  }
  return { matched: false, attempts, lastObserved };
}

// ---------------------------------------------------------------------------
// Harness: everything acquired inside try, everything torn down in finally.
// ---------------------------------------------------------------------------

interface HarnessReport {
  recordedPids: number[];
  pidsAliveAfterTeardown: number[];
}

async function withBrokerHarness(fn: (ctx: { stateDir: string; scratchDir: string; recordPid: (pid: number) => void }) => Promise<void>): Promise<HarnessReport> {
  build(); // ensure resources/ is a fresh build of the current TypeScript source
  const scratchDir = mkdtempSync(join(tmpdir(), "stock-broker-live-"));
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
      console.error(`stock-broker-live: pids still alive after teardown: ${JSON.stringify(pidsAliveAfterTeardown)}`);
    }
  }
  return { recordedPids: [...recordedPids], pidsAliveAfterTeardown };
}

/** Reads the granted instance's own pid from its epoch.json (bounded retry
 * -- the real broker daemon writes it as part of its own cold-launch
 * composition, which can lag the grant response by a few milliseconds). */
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

/** `ps -o args=` for `pid`, split on whitespace -- reads the emulator's
 * ACTUAL argv back from the process table, never trusting the record the
 * broker itself built. */
function readProcessArgv(pid: number): string[] {
  const out = execFileSync("ps", ["-o", "args=", "-p", String(pid)]).toString("utf8").trim();
  return out.split(/\s+/);
}

/** Reads `/proc/<pid>/environ` (NUL-delimited) and returns the value of
 * `name`, or undefined if absent. */
function readProcessEnvVar(pid: number, name: string): string | undefined {
  const raw = readFileSync(`/proc/${pid}/environ`).toString("utf8").split("\0");
  const line = raw.find((entry) => entry.startsWith(`${name}=`));
  return line === undefined ? undefined : line.slice(name.length + 1);
}

function assertArgvCarriesFix(argv: string[]): void {
  const driveIdx = argv.indexOf("-drive8type");
  assert.ok(driveIdx !== -1, `argv must contain -drive8type, got: ${JSON.stringify(argv)}`);
  assert.equal(argv[driveIdx + 1], "1541", `argv's -drive8type value must be 1541, got: ${JSON.stringify(argv)}`);
  const defaultIdx = argv.indexOf("-default");
  const binmonIdx = argv.indexOf("-binarymonitor");
  assert.ok(defaultIdx !== -1 && binmonIdx !== -1, `argv must contain both -default and -binarymonitor, got: ${JSON.stringify(argv)}`);
  assert.ok(defaultIdx < binmonIdx, `-default (index ${defaultIdx}) must precede -binarymonitor (index ${binmonIdx}), got: ${JSON.stringify(argv)}`);
}

// ---------------------------------------------------------------------------
// Task 1: the .d64 case -- vice_disk_attach + vice_autostart through a real
// broker-launched genuine-stock instance.
// ---------------------------------------------------------------------------

test(
  "stock-broker-live: a real broker-launched genuine-stock instance loads a real .d64 via vice_disk_attach + vice_autostart, and the granted process's own argv/XDG_CONFIG_HOME prove the launch went through buildViceArgs()/the real daemon composition",
  { skip: SKIP_REASON_D64, timeout: 60000 },
  async () => {
    clearHeldStockSession();
    let report: HarnessReport | null = null;
    report = await withBrokerHarness(async ({ stateDir, scratchDir, recordPid }) => {
      const { prgPath } = writePrgFixture(scratchDir);
      const d64Path = writeD64Fixture(scratchDir, prgPath);

      const brokerJson = await waitForBrokerJson(stateDir);
      const host = "127.0.0.1";
      const controlPort = Number(brokerJson.control_port);
      const token = String(brokerJson.control_token);
      assert.ok(Number.isFinite(controlPort) && token.length > 0, `broker.json must carry a real control_port/control_token, got: ${JSON.stringify(brokerJson)}`);

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

      // --- The non-bypassable proof for I-2: read the ACTUAL argv this
      // REAL broker-spawned process received back from the process table.
      const argv = readProcessArgv(pid);
      assertArgvCarriesFix(argv);

      // --- The live half of I-1's proof (the unit half is plan 08.2-06's
      // vice-broker-acquire.test.ts): the granted process's own
      // XDG_CONFIG_HOME must be a fresh scratch path, never the operator's
      // real one -- a REQUIRED-PASS assertion, not a recorded observation.
      const childXdgConfigHome = readProcessEnvVar(pid, "XDG_CONFIG_HOME");
      assert.ok(typeof childXdgConfigHome === "string" && childXdgConfigHome.length > 0, `the granted process's XDG_CONFIG_HOME must be a non-empty string, got: ${String(childXdgConfigHome)}`);
      assert.ok(childXdgConfigHome!.startsWith(tmpdir()), `the granted process's XDG_CONFIG_HOME must live under os.tmpdir(), got: ${childXdgConfigHome}`);
      assert.notEqual(childXdgConfigHome, process.env.XDG_CONFIG_HOME, `the granted process's XDG_CONFIG_HOME must differ from this test runner's own ambient value`);

      const ready = await waitForStockReady(grant.port);
      assert.ok(ready, `the broker-launched instance at port ${grant.port} never answered a binary-monitor probe within the deadline`);

      const deps = depsFor(host, grant, controlSession, stateDir);

      const diskAttachResult = await dispatchStock("vice_disk_attach", { unit: 8, path: d64Path }, deps);
      const diskAttachPayload = parseOkPayload(diskAttachResult as { content: { type: "text"; text: string }[]; isError: boolean });
      console.log(`stock-broker-live (.d64): vice_disk_attach -> ${JSON.stringify(diskAttachPayload)}`);

      const autostartResult = await dispatchStock("vice_autostart", { path: d64Path, run: true }, deps);
      const autostartPayload = parseOkPayload(autostartResult as { content: { type: "text"; text: string }[]; isError: boolean });
      console.log(`stock-broker-live (.d64): vice_autostart -> ${JSON.stringify(autostartPayload)}`);

      // --- Prove the load actually happened -- never trust the tool's own
      // success report alone. sidefx:false, polled with the resume-sleep-
      // read discipline this file's header comment documents.
      const poll = await pollUntilBytesMatch(deps, VERIFIED_PAYLOAD_ADDRESS, VERIFIED_PAYLOAD, 20000);
      console.log(
        `stock-broker-live (.d64): expected=${JSON.stringify(VERIFIED_PAYLOAD)} observed=${JSON.stringify(poll.lastObserved)} ` +
          `(${poll.attempts} attempts, matched=${poll.matched})`,
      );
      assert.ok(
        poll.matched,
        `expected the payload at $${VERIFIED_PAYLOAD_ADDRESS.toString(16)} to byte-equal ${JSON.stringify(VERIFIED_PAYLOAD)} after ${poll.attempts} attempts, ` +
          `got ${JSON.stringify(poll.lastObserved)}`,
      );

      await controlSession.release();
    });

    assert.ok(report !== null, "withBrokerHarness must have returned a report");
    assert.deepEqual(report!.pidsAliveAfterTeardown, [], `pids still alive after teardown: ${JSON.stringify(report!.pidsAliveAfterTeardown)} (recorded: ${JSON.stringify(report!.recordedPids)})`);
  },
);
