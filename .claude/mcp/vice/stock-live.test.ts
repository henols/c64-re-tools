#!/usr/bin/env node
// stock-live.test.ts
//
// OPT-IN, MANUAL-ONLY. Turns 03-UAT.md test 5's ad-hoc live probe into a
// committed, repeatable gate: dispatches through the REAL dispatchStock()
// seam -- the same one vice-proxy.ts calls -- against a REAL stock VICE
// binary's binary monitor, over a REAL ViceMonitorClient socket. No stub
// anywhere in the path except `ensureLease`/`connect`, which hand back the
// live coordinates instead of asking a broker for them (this file owns its
// own emulator process, not a broker-managed one).
//
// WHY THIS FILE EXISTS: 03-14 fixed vice_registers_set's bits-vs-bytes
// blocker against a wire-shaped SYNTHETIC fixture (no emulator required).
// That proves the code is internally consistent with the wire spec; it does
// not prove a REAL build's REGISTERS_AVAILABLE/REGISTERS_SET actually
// behaves that way, and it cannot reach the flag-bit refusal path, which
// was never exercised live in 03-UAT.md test 5 (every call died on the
// width branch first). This file is the live re-verification plan 03-14
// deliberately deferred to plan 03-16 (see 03-14-SUMMARY.md's "Next Phase
// Readiness").
//
// Two environment facts, established by the plan and not re-discovered
// here:
//   - /usr/local/bin/x64sc (the fork build, has -mcpserver) SHADOWS
//     /usr/bin/x64sc (genuinely unpatched stock) on PATH. A bare `x64sc`
//     would silently exercise the WRONG binary -- always name the stock
//     binary by absolute path (VICE_LIVE_STOCK_BIN, defaulting to
//     /usr/bin/x64sc).
//   - Both builds share $HOME/.config/vice/vicerc, and the 3.10 build has
//     written it, so spawning 3.9 raises a modal "Configuration file
//     version mismatch" dialog. XDG_CONFIG_HOME is pointed at a per-run
//     mkdtempSync() scratch dir to silence it, never the shared config.
//
// DEFAULT-SKIP IS MANDATORY: `npm test` globs this file via `*.test.*`, and
// CI has no VICE. SKIP_REASON is computed once, and EVERY test in this file
// passes it through node:test's own `{ skip }` option -- this file must
// never fail or hang where no stock binary is available. It is registered
// in test-gate.mjs's MANUAL_ONLY_TESTS (the ONE list -- see that file's own
// header) as the fourth manual-only file, so `npm run test:automated` never
// runs it either.
//
// Opt in with:
//   VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts
//
// WHAT NOT TO DO:
//   - Never acquire the child process or the socket outside the try/after
//     pair below -- that is exactly the leaked-resource failure mode plan
//     03-15 fixed elsewhere in this test tree; teardown must run even when
//     a test throws.
//   - Never bind -binarymonitoraddress to 0.0.0.0 -- the binary monitor is
//     unauthenticated full machine control (T-03-16-01). 127.0.0.1 only.
//   - Never hardcode a register id or name from 03-UAT.md's recorded
//     catalog -- resolve everything from THIS run's own live
//     vice_registers_available answer, so a different build's ids/names
//     cannot silently desync this file from reality.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

import { dispatchStock, clearHeldStockSession, type StockDispatchDeps } from "./stock-dispatch.ts";
import { ViceMonitorClient } from "./stock-protocol.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { HeldLease, BrokerControlSession } from "./vice-broker-client.ts";
import { attachRunStateTracker, runStateFor } from "./stock-runstate.ts";

// ---------------------------------------------------------------------------
// Opt-in gate
// ---------------------------------------------------------------------------

const VICE_LIVE_STOCK_BIN_DEFAULT = "/usr/bin/x64sc";
const resolvedBinPath = process.env.VICE_LIVE_STOCK_BIN ?? VICE_LIVE_STOCK_BIN_DEFAULT;

/** Computed exactly once. Every test in this file passes this through
 * node:test's own `{ skip }` option -- never a hand-rolled early return,
 * which would report a false PASS rather than a SKIP. */
const SKIP_REASON: string | false = !process.env.VICE_LIVE_STOCK_BIN
  ? `stock-live.test.ts is opt-in and default-skipped -- set VICE_LIVE_STOCK_BIN=/usr/bin/x64sc ` +
    `(or another real, genuinely unpatched stock VICE binary's absolute path) to run it. Defaults to ` +
    `${VICE_LIVE_STOCK_BIN_DEFAULT} when set to a truthy non-path value. A bare "x64sc" on PATH resolves ` +
    `to the fork build (which has -mcpserver, not this stock binary monitor path) -- always name the ` +
    `stock binary by absolute path.`
  : !existsSync(resolvedBinPath)
    ? `VICE_LIVE_STOCK_BIN="${resolvedBinPath}" does not exist on disk -- opt-in requires a real stock VICE ` +
      `binary at that absolute path (e.g. /usr/bin/x64sc). A bare "x64sc" on PATH would resolve to the fork ` +
      `build at /usr/local/bin/x64sc instead of genuine stock.`
    : false;

// ---------------------------------------------------------------------------
// Lifecycle: spawn a real stock VICE, connect a real ViceMonitorClient,
// build the same StockConnectSession/StockDispatchDeps shape
// stock-dispatch.test.ts's own buildConformanceSession()/buildConformanceDeps()
// use for the conformance harness -- but with a REAL client substituted for
// the stub, and REAL live coordinates instead of a broker grant.
// ---------------------------------------------------------------------------

const CONFORMANCE_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
} as unknown as BrokerControlSession;

interface LiveFixture {
  child: ChildProcess;
  client: ViceMonitorClient;
  deps: StockDispatchDeps;
  scratchDir: string;
}

let fixture: LiveFixture | null = null;

/** Binds a throwaway server to 127.0.0.1:0, reads the OS-assigned port, and
 * closes it -- the standard "free ephemeral port" idiom. A small race window
 * exists between close() and the emulator's own bind, which is why connect
 * is retried below rather than attempted once. */
async function freeEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : null;
      srv.close(() => {
        if (port === null) reject(new Error("freeEphemeralPort: could not read an ephemeral port from address()"));
        else resolve(port);
      });
    });
  });
}

/** The emulator needs a moment to bind its listening socket after spawn.
 * Retries connect() in a bounded loop rather than a single attempt with a
 * long timeout, so a slow-starting emulator does not need one huge sleep
 * up front. */
async function connectWithRetry(client: ViceMonitorClient, host: string, port: number, deadlineMs = 10000): Promise<void> {
  const start = Date.now();
  let lastErr: unknown = null;
  while (Date.now() - start < deadlineMs) {
    try {
      await client.connect(host, port, { timeoutMs: 1000 });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`connectWithRetry: could not connect to ${host}:${port} within ${deadlineMs}ms (last error: ${String(lastErr)})`);
}

before(async () => {
  if (SKIP_REASON) return;

  const port = await freeEphemeralPort();
  const scratchDir = mkdtempSync(join(tmpdir(), "gsd-0316-vicerc-"));
  // Bind 127.0.0.1 only (T-03-16-01) -- the binary monitor is unauthenticated
  // full machine control; XDG_CONFIG_HOME silences the shared-vicerc version
  // mismatch dialog (T-03-16-04) without ever touching the real config.
  const child = spawn(
    resolvedBinPath,
    ["-binarymonitor", "-binarymonitoraddress", `ip4://127.0.0.1:${port}`],
    { stdio: "ignore", env: { ...process.env, XDG_CONFIG_HOME: scratchDir } },
  );
  child.once("error", (err) => {
    console.error(`stock-live.test.ts: spawned emulator process error: ${String(err)}`);
  });

  const client = new ViceMonitorClient();
  try {
    await connectWithRetry(client, "127.0.0.1", port);
  } catch (err) {
    // T-03-16-02: teardown must run even when setup itself fails partway.
    child.kill("SIGKILL");
    rmSync(scratchDir, { recursive: true, force: true });
    throw err;
  }
  attachRunStateTracker(client);

  const targetId = `stock-live-test-${port}`;
  const session = {
    client,
    versionQuad: "unknown",
    capabilities: { cpuHistory: "absent" as const },
    host: "127.0.0.1",
    port,
    targetId,
    brokerControl: CONFORMANCE_BROKER_CONTROL,
    deps: {},
    baselineEpoch: null,
  } as unknown as StockConnectSession;

  const deps: StockDispatchDeps = {
    ensureLease: async () => ({
      ok: true as const,
      lease: {
        host: session.host,
        port: session.port,
        targetId: session.targetId,
        brokerControl: session.brokerControl,
        epochFile: "",
        supervisorDir: "",
      } as HeldLease,
    }),
    connect: async () => session,
  };

  fixture = { child, client, deps, scratchDir };
});

after(async () => {
  if (!fixture) return;
  const { child, client, scratchDir } = fixture;
  fixture = null;
  clearHeldStockSession();
  try {
    await client.disconnect();
  } catch {
    // best-effort -- the child is about to be SIGKILLed regardless.
  }
  child.kill("SIGKILL");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  rmSync(scratchDir, { recursive: true, force: true });
});

function liveDeps(): StockDispatchDeps {
  if (!fixture) {
    throw new Error("stock-live.test.ts: fixture is not initialised -- SKIP_REASON should have prevented this test from running at all");
  }
  return fixture.deps;
}

/** Waits (bounded) until the tracker attached to `fixture.client` reports
 * "stopped" -- the binary monitor halts the machine on the first inbound
 * monitor byte (task 2 relies on this being true, live, rather than
 * asserted from documentation), but the STOPPED event's own arrival is
 * asynchronous relative to any command's reply. */
async function waitForStoppedRunState(deadlineMs = 5000): Promise<void> {
  if (!fixture) return;
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    if (runStateFor(fixture.client) === "stopped") return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`waitForStoppedRunState: runState never reached "stopped" within ${deadlineMs}ms (last seen: ${runStateFor(fixture.client)})`);
}

function parseOkPayload(result: { content: { type: "text"; text: string }[]; isError: boolean }): Record<string, unknown> {
  assert.equal(result.isError, false, `expected an ok answer but got an error: ${result.content[0]?.text}`);
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Task 1's own smoke assertion: the wire reports BITS, live.
// ---------------------------------------------------------------------------

test(
  "stock-live: vice_registers_available reports a non-empty catalog with every width in {8,16} bits (never 1 or 2)",
  { skip: SKIP_REASON },
  async () => {
    const result = await dispatchStock("vice_registers_available", {}, liveDeps());
    const payload = parseOkPayload(result as { content: { type: "text"; text: string }[]; isError: boolean });
    const registers = payload.registers as Array<{ id: number; name: string; sizeBits: number }>;

    console.log(`stock-live: live REGISTERS_AVAILABLE catalog (${registers.length} entries):`);
    for (const reg of registers) {
      console.log(`  ${reg.name}(id${reg.id}, ${reg.sizeBits} bit(s))`);
    }

    assert.ok(registers.length > 0, "REGISTERS_AVAILABLE must enumerate at least one register");
    for (const reg of registers) {
      assert.ok(
        reg.sizeBits === 8 || reg.sizeBits === 16,
        `register "${reg.name}" reported sizeBits=${reg.sizeBits} -- expected 8 or 16 (never 1 or 2, the bits-vs-bytes bug 03-14 fixed)`,
      );
    }
  },
);

// ---------------------------------------------------------------------------
// Task 2: live re-verification of the register write and the flag-bit
// refusal -- the evidence 03-UAT.md test 5 could not produce, because every
// call there died on the width branch before reaching either.
// ---------------------------------------------------------------------------

/** The 6502 status-register flag-bit names and their conventional bit
 * positions, mirroring stock-registers.ts's own FLAG_BIT_POSITIONS table --
 * duplicated here (not imported) so this test proves the SHIPPED behaviour
 * against its OWN independent expectation, not merely that the module
 * agrees with itself. */
const FLAG_BIT_POSITIONS: Record<string, number> = { N: 7, V: 6, B: 4, D: 3, I: 2, Z: 1, C: 0 };

test(
  "stock-live: a register write round-trips, the 16-bit path works, range refusal holds, the flag-bit refusal fires for all seven flags naming the live status register, and every answer's runState is stopped",
  { skip: SKIP_REASON },
  async () => {
    // --- WIDTH CATALOG (also logged by Task 1's own test above; re-fetched
    //     here from the SAME cached session, so this is a free call) ---
    const availableResult = await dispatchStock("vice_registers_available", {}, liveDeps());
    const availablePayload = parseOkPayload(availableResult as { content: { type: "text"; text: string }[]; isError: boolean });
    const catalog = availablePayload.registers as Array<{ id: number; name: string; sizeBits: number }>;
    assert.equal(availablePayload.runState, "stopped", "vice_registers_available's runState must be stopped");

    const pcEntry = catalog.find((r) => r.name.toUpperCase() === "PC");
    assert.ok(pcEntry, "the live catalog must contain a PC register");
    assert.equal(pcEntry!.sizeBits, 16, `PC must report sizeBits=16, got ${pcEntry!.sizeBits}`);

    // The status-register candidate THIS build actually reports -- resolved
    // from the live catalog, never hardcoded, matching
    // stock-registers.ts's own STATUS_REGISTER_CANDIDATES resolution order.
    const STATUS_REGISTER_CANDIDATES = ["FL", "SR", "P", "STATUS", "FLAGS"];
    const statusEntry = STATUS_REGISTER_CANDIDATES.map((name) => catalog.find((r) => r.name.toUpperCase() === name)).find(Boolean);
    assert.ok(statusEntry, `the live catalog must contain a status register named one of: ${STATUS_REGISTER_CANDIDATES.join(", ")}`);
    console.log(`stock-live: this build's status register is "${statusEntry!.name}"`);

    // --- THE BLOCKER, LIVE: an ordinary 8-bit register write round-trips ---
    const preGetResult = await dispatchStock("vice_registers_get", {}, liveDeps());
    const prePayload = parseOkPayload(preGetResult as { content: { type: "text"; text: string }[]; isError: boolean });
    const preRegisters = prePayload.registers as Record<string, number>;
    const preA = preRegisters.A;
    console.log(`stock-live: A's pre-write value is ${preA}`);

    const setAResult = await dispatchStock("vice_registers_set", { register: "A", value: 42 }, liveDeps());
    const setAPayload = parseOkPayload(setAResult as { content: { type: "text"; text: string }[]; isError: boolean });
    console.log(`stock-live: vice_registers_set({register:"A", value:42}) -> ${JSON.stringify(setAPayload)}`);
    assert.equal(setAPayload.observedValue, 42, `vice_registers_set({register:"A", value:42}) must echo observedValue:42, got ${JSON.stringify(setAPayload)}`);
    assert.equal(setAPayload.runState, "stopped", "vice_registers_set's runState must be stopped");

    const postGetResult = await dispatchStock("vice_registers_get", {}, liveDeps());
    const postPayload = parseOkPayload(postGetResult as { content: { type: "text"; text: string }[]; isError: boolean });
    const postRegisters = postPayload.registers as Record<string, number>;
    assert.equal(postRegisters.A, 42, `vice_registers_get must independently show A===42 after the write, got ${postRegisters.A}`);

    // --- 16-BIT PATH: PC round-trips through the same width-derived check ---
    const setPcResult = await dispatchStock("vice_registers_set", { register: "PC", value: 0xc000 }, liveDeps());
    const setPcPayload = parseOkPayload(setPcResult as { content: { type: "text"; text: string }[]; isError: boolean });
    console.log(`stock-live: vice_registers_set({register:"PC", value:0xC000}) -> ${JSON.stringify(setPcPayload)}`);
    assert.equal(setPcPayload.observedValue, 0xc000, `vice_registers_set({register:"PC", value:0xC000}) must echo observedValue:0xC000, got ${JSON.stringify(setPcPayload)}`);

    // --- RANGE REFUSAL: an out-of-range 8-bit value is refused, and NO
    //     write reaches the emulator (A must still read 42 from above) ---
    const rangeResult = await dispatchStock("vice_registers_set", { register: "A", value: 256 }, liveDeps());
    assert.equal(rangeResult.isError, true, "vice_registers_set({register:\"A\", value:256}) must be refused");
    const rangeText = (rangeResult as { content: { type: "text"; text: string }[] }).content[0]!.text;
    console.log(`stock-live: range refusal message -> ${rangeText}`);
    assert.match(rangeText, /0\.\.0xff/, `range refusal must name the 0..0xff range, got: ${rangeText}`);

    const afterRangeGetResult = await dispatchStock("vice_registers_get", {}, liveDeps());
    const afterRangePayload = parseOkPayload(afterRangeGetResult as { content: { type: "text"; text: string }[]; isError: boolean });
    const afterRangeRegisters = afterRangePayload.registers as Record<string, number>;
    assert.equal(afterRangeRegisters.A, 42, `A must still read 42 after a refused out-of-range write reached no wire command, got ${afterRangeRegisters.A}`);

    // --- FLAG-BIT REFUSAL -- the never-reached path (03-UAT.md test 5) ---
    // Read the status register's value once before the loop, and assert it
    // is unchanged after: the refusal branch returns before REGISTERS_SET is
    // ever sent, so nothing in this loop may perturb it.
    const beforeFlagsGetResult = await dispatchStock("vice_registers_get", {}, liveDeps());
    const beforeFlagsPayload = parseOkPayload(beforeFlagsGetResult as { content: { type: "text"; text: string }[]; isError: boolean });
    const beforeFlagsRegisters = beforeFlagsPayload.registers as Record<string, number>;
    const statusBefore = beforeFlagsRegisters[statusEntry!.name];

    for (const [flagName, bitPosition] of Object.entries(FLAG_BIT_POSITIONS)) {
      const flagResult = await dispatchStock("vice_registers_set", { register: flagName, value: 1 }, liveDeps());
      assert.equal(flagResult.isError, true, `vice_registers_set({register:"${flagName}", value:1}) must be refused`);
      const flagText = (flagResult as { content: { type: "text"; text: string }[] }).content[0]!.text;
      console.log(`stock-live: flag-bit refusal for "${flagName}" -> ${flagText}`);
      assert.match(
        flagText,
        new RegExp(statusEntry!.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `flag-bit refusal for "${flagName}" must name the live status register "${statusEntry!.name}", got: ${flagText}`,
      );
      assert.match(
        flagText,
        new RegExp(`bit ${bitPosition}\\b`),
        `flag-bit refusal for "${flagName}" must name its own bit position ${bitPosition}, got: ${flagText}`,
      );
    }

    const afterFlagsGetResult = await dispatchStock("vice_registers_get", {}, liveDeps());
    const afterFlagsPayload = parseOkPayload(afterFlagsGetResult as { content: { type: "text"; text: string }[]; isError: boolean });
    const afterFlagsRegisters = afterFlagsPayload.registers as Record<string, number>;
    assert.equal(
      afterFlagsRegisters[statusEntry!.name],
      statusBefore,
      `the status register "${statusEntry!.name}" must be unchanged after all seven flag-bit refusals (no REGISTERS_SET reached the wire), before=${statusBefore} after=${afterFlagsRegisters[statusEntry!.name]}`,
    );

    // --- RUNSTATE (D-06): confirmed live throughout, not merely asserted
    //     per-answer above -- the tracker itself must agree. ---
    await waitForStoppedRunState();
  },
);

// ---------------------------------------------------------------------------
// 05-09's CR-01 live regression. `stock-vicii.test.ts`/`stock-cia.test.ts`
// prove the WIRING is right against a stub that answers exactly what the
// handler asks for -- but that stub was built from the SAME understanding
// as the fix, so it cannot catch "the fix reads the wrong bank and the stub
// happily agrees". Only a real emulator, banked genuinely wrong, can prove
// the fix survives contact with reality: `vice_vicii_get_state` and
// `vice_cia_get_state` used to hardcode `bank: 0x0000` (the CPU view, which
// follows $00/$01 banking) and would silently return the RAM underneath
// $D000-$DFFF once the running program banked I/O out -- a plausible,
// wrong, isError:false answer with an empty `unavailable` set. This section
// proves the fix reads through the emulator's own `io` bank instead, with
// an independent non-vacuity control proving the banking manipulation
// actually took effect (rather than a no-op write silently making every
// assertion below pass for the wrong reason).
//
// PREREQUISITE ESTABLISHED EMPIRICALLY (not assumed from the plan text): the
// shared fixture's own before() hook connects while the binary monitor
// halts the machine on the very first inbound byte -- at/near the reset
// vector, before the KERNAL has ever set $D020/$D021. Task 1/2's register
// probes above never advance execution either. So "the KERNAL defaults on
// a booted machine" requires actually booting it first: ensureBooted()
// hard-resets with run_after:true, waits long enough (real-time emulation,
// no warp) for the KERNAL to reach the ready prompt, then pauses again --
// done ONCE and cached, since both cases below depend on it and re-running
// it between them would perturb Case B's own $01 restore invariant.
// ---------------------------------------------------------------------------

let bootedOnce = false;

async function ensureBooted(): Promise<void> {
  if (bootedOnce) return;
  const resetResult = await dispatchStock("vice_machine_reset", { mode: "hard", run_after: true }, liveDeps());
  assert.equal(resetResult.isError, false, `vice_machine_reset({mode:"hard",run_after:true}) must succeed, got: ${JSON.stringify(resetResult)}`);
  // Real-time emulation, no -warp -- 3s comfortably covers the KERNAL's
  // boot sequence reaching the ready prompt (empirically confirmed against
  // this build: border/background were still unset at connect-time and
  // took a few real seconds of run time to reach their KERNAL defaults).
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const pauseResult = await dispatchStock("vice_execution_pause", {}, liveDeps());
  assert.equal(pauseResult.isError, false, `vice_execution_pause() must succeed, got: ${JSON.stringify(pauseResult)}`);
  await waitForStoppedRunState();
  bootedOnce = true;
}

test("stock-live (05-09, CR-01): default banking -- vice_vicii_get_state reports the io bank and the KERNAL-default border/background colours", { skip: SKIP_REASON }, async () => {
  await ensureBooted();
  const result = await dispatchStock("vice_vicii_get_state", {}, liveDeps());
  const payload = parseOkPayload(result as { content: { type: "text"; text: string }[]; isError: boolean });
  const bank = payload.bank as { id: number; name: string };
  console.log(`stock-live: vice_vicii_get_state resolved bank ${JSON.stringify(bank)}, registersHex=${payload.registersHex}`);
  assert.equal(bank.name, "io");
  assert.equal(typeof bank.id, "number");
  assert.equal(payload.borderColour, 14, `borderColour must be the KERNAL default 14 on a freshly booted machine, got ${payload.borderColour}`);
  assert.equal(payload.backgroundColour, 6, `backgroundColour must be the KERNAL default 6 on a freshly booted machine, got ${payload.backgroundColour}`);
  assert.equal(payload.runState, "stopped");
});

test(
  "stock-live (05-09, CR-01): with I/O banked out ($01=$34), vice_vicii_get_state and vice_cia_get_state still report true chip registers through the io bank",
  { skip: SKIP_REASON },
  async () => {
    await ensureBooted();

    // --- 1. Pre-condition control: read $D020 both ways before the banking change ---
    const preCpuRead = await dispatchStock("vice_memory_read", { address: "$d020", size: 1, encoding: "array" }, liveDeps());
    const preCpuPayload = parseOkPayload(preCpuRead as { content: { type: "text"; text: string }[]; isError: boolean });
    const preIoRead = await dispatchStock("vice_memory_read", { address: "$d020", size: 1, encoding: "array", bank: "io" }, liveDeps());
    const preIoPayload = parseOkPayload(preIoRead as { content: { type: "text"; text: string }[]; isError: boolean });
    console.log(`stock-live: pre-write $D020 -- cpu bank: ${JSON.stringify(preCpuPayload.bytes)}, io bank: ${JSON.stringify(preIoPayload.bytes)}`);

    try {
      // --- 2. MEM_SET $01 = $34 -- bank I/O out, exposing RAM underneath $D000-$DFFF to the CPU view ---
      const writeResult = await dispatchStock("vice_memory_write", { address: 1, data: [0x34] }, liveDeps());
      assert.equal(writeResult.isError, false, `vice_memory_write({address:1, data:[0x34]}) must succeed, got: ${JSON.stringify(writeResult)}`);

      // --- 3. Non-vacuity control: prove the banking manipulation actually took effect ---
      const postCpuRead = await dispatchStock("vice_memory_read", { address: "$d020", size: 1, encoding: "array" }, liveDeps());
      const postCpuPayload = parseOkPayload(postCpuRead as { content: { type: "text"; text: string }[]; isError: boolean });
      const postIoRead = await dispatchStock("vice_memory_read", { address: "$d020", size: 1, encoding: "array", bank: "io" }, liveDeps());
      const postIoPayload = parseOkPayload(postIoRead as { content: { type: "text"; text: string }[]; isError: boolean });
      const postCpuByte = (postCpuPayload.bytes as number[])[0];
      const postIoByte = (postIoPayload.bytes as number[])[0];
      console.log(`stock-live: post-write $D020 -- cpu bank: ${postCpuByte}, io bank: ${postIoByte}`);
      assert.equal(
        postCpuByte,
        255,
        `non-vacuity control failed: the CPU-view $D020 read must be 255 (uninitialised RAM) after $01=$34 -- ` +
          `the emulator did not honour the banking write, so the rest of this case would pass vacuously. Got ${postCpuByte}.`,
      );
      assert.notEqual(
        postIoByte,
        255,
        `non-vacuity control failed: the io-bank $D020 read must differ from the CPU-view's 255 after $01=$34 -- ` +
          `if they agree, the "io" bank argument is not actually resolving to a different view. Got ${postIoByte}.`,
      );

      // --- 4. THE FIX, LIVE: vice_vicii_get_state must still report true chip registers ---
      const viciiResult = await dispatchStock("vice_vicii_get_state", {}, liveDeps());
      const viciiPayload = parseOkPayload(viciiResult as { content: { type: "text"; text: string }[]; isError: boolean });
      const viciiBank = viciiPayload.bank as { id: number; name: string };
      console.log(`stock-live: with $01=$34, vice_vicii_get_state -> bank=${JSON.stringify(viciiBank)}, borderColour=${viciiPayload.borderColour}, backgroundColour=${viciiPayload.backgroundColour}`);
      assert.equal(viciiPayload.borderColour, 14, `borderColour must still be 14 with I/O banked out, got ${viciiPayload.borderColour}`);
      assert.equal(viciiPayload.backgroundColour, 6, `backgroundColour must still be 6 with I/O banked out, got ${viciiPayload.backgroundColour}`);
      assert.equal(viciiBank.name, "io");
      const registersHex = viciiPayload.registersHex as string;
      assert.ok(!/^f+$/.test(registersHex), `registersHex must not be all "f" characters (the CPU-view symptom) with I/O banked out, got ${registersHex}`);

      // --- 5. THE FIX, LIVE: vice_cia_get_state must still report true chip registers ---
      const ciaResult = await dispatchStock("vice_cia_get_state", { cia: 1 }, liveDeps());
      const ciaPayload = parseOkPayload(ciaResult as { content: { type: "text"; text: string }[]; isError: boolean });
      const ciaBank = ciaPayload.bank as { id: number; name: string };
      const cia1 = (ciaPayload.cias as Record<string, unknown>[])[0]!;
      const portBDirection = cia1.portBDirection as { raw: number };
      const timerAControl = cia1.timerAControl as { raw: number };
      console.log(`stock-live: with $01=$34, vice_cia_get_state({cia:1}) -> bank=${JSON.stringify(ciaBank)}, portBDirection.raw=${portBDirection.raw}, timerAControl.raw=${timerAControl.raw}`);
      assert.equal(portBDirection.raw, 0, `CIA1 portBDirection.raw must still be 0 (a booted machine's $DC03) with I/O banked out, got ${portBDirection.raw}`);
      assert.notEqual(timerAControl.raw, 0xff, `CIA1 timerAControl.raw must not be 0xff (the CPU-view symptom) with I/O banked out, got ${timerAControl.raw}`);
      assert.equal(ciaBank.name, "io");
    } finally {
      // --- 6. Restore $01 -- a mid-test failure must not leave the shared
      //        fixture's emulator banked out for the cases that follow. ---
      const restoreResult = await dispatchStock("vice_memory_write", { address: 1, data: [0x37] }, liveDeps());
      assert.equal(restoreResult.isError, false, `restoring $01=$37 must succeed, got: ${JSON.stringify(restoreResult)}`);
      const restoredCpuRead = await dispatchStock("vice_memory_read", { address: "$d020", size: 1, encoding: "array" }, liveDeps());
      const restoredCpuPayload = parseOkPayload(restoredCpuRead as { content: { type: "text"; text: string }[]; isError: boolean });
      const restoredByte = (restoredCpuPayload.bytes as number[])[0];
      assert.notEqual(restoredByte, 255, `the CPU-view $D020 read must no longer be 255 after restoring $01=$37, got ${restoredByte}`);
    }
  },
);

test("stock-live (05-09, CR-01): the refusal path's premise is reachable -- the live BANKS_AVAILABLE catalog names both io and ram", { skip: SKIP_REASON }, async () => {
  const result = await dispatchStock("vice_memory_banks", {}, liveDeps());
  const payload = parseOkPayload(result as { content: { type: "text"; text: string }[]; isError: boolean });
  const banks = payload.banks as Array<{ id: number; name: string }>;
  console.log(`stock-live: live BANKS_AVAILABLE catalog: ${JSON.stringify(banks)}`);
  assert.ok(
    banks.some((b) => b.name.toLowerCase() === "io"),
    `the live catalog must contain a bank named "io" (case-insensitively) -- both handlers' resolveRequiredBank() call depends on this; if a future VICE build drops it, this case documents that as the cause`,
  );
  assert.ok(
    banks.some((b) => b.name.toLowerCase() === "ram"),
    `the live catalog must contain a bank named "ram" (case-insensitively)`,
  );
});

test(
  "stock-live (WR-03): the CIA joystick `confounded` flag DISCRIMINATES -- a freshly-booted machine reads clean, and a driven-low direction pin reads confounded",
  { skip: SKIP_REASON },
  async () => {
    await ensureBooted();

    function joysticksOf(payload: Record<string, unknown>): { j2: Record<string, unknown>; j1: Record<string, unknown>; notes: string[] } {
      const cia1 = (payload.cias as Record<string, unknown>[])[0]!;
      return {
        j2: (cia1.portA as Record<string, unknown>).joystick2 as Record<string, unknown>,
        j1: (cia1.portB as Record<string, unknown>).joystick1 as Record<string, unknown>,
        notes: cia1.notes as string[],
      };
    }

    async function readCia1(): Promise<Record<string, unknown>> {
      const result = await dispatchStock("vice_cia_get_state", { cia: 1 }, liveDeps());
      return parseOkPayload(result as { content: { type: "text"; text: string }[]; isError: boolean });
    }

    // --- 1. Baseline: a booted C64 leaves DDRA = $FF permanently, which is
    //        exactly why the old `DDRA !== 0x00` predicate was true for ~100%
    //        of realistic reads. The bits that matter all read HIGH, so this
    //        must now report CLEAN. ---
    const basePayload = await readCia1();
    const base = joysticksOf(basePayload);
    const cia1 = (basePayload.cias as Record<string, unknown>[])[0]!;
    console.log(`stock-live: booted CIA1 registers = ${cia1.registersHex}`);
    console.log(`stock-live: booted joystick2 = ${JSON.stringify(base.j2)}`);
    assert.equal((cia1.portADirection as { raw: number }).raw, 0xff, "premise: the KERNAL leaves DDRA = $FF -- if this build does not, WR-03's whole point needs re-verifying");
    assert.equal(base.j2.confounded, false, "a booted machine with nothing pressed must NOT be flagged confounded, or the flag carries no information");
    assert.equal(base.j1.confounded, false);
    assert.deepEqual(base.j2.confoundedDirections, []);
    assert.deepEqual(base.j1.confoundedDirections, []);
    assert.deepEqual(base.notes, []);

    // --- 2. Non-vacuity control: drive port A bit 0 low. The machine is
    //        halted, so nothing rewrites $DC00 between the write and the read.
    //        The same five booleans now carry confounded:true for `up` only. ---
    const originalPra = (cia1.portA as { raw: number }).raw;
    try {
      const write = await dispatchStock("vice_memory_write", { address: "$dc00", data: [0xfe], bank: "io" }, liveDeps());
      assert.equal(write.isError, false, `driving $DC00 = 0xfe must succeed, got: ${JSON.stringify(write)}`);

      const driven = joysticksOf(await readCia1());
      console.log(`stock-live: with $DC00 driven to 0xfe, joystick2 = ${JSON.stringify(driven.j2)}`);
      assert.equal(driven.j2.up, true, "bit 0 low decodes as `up` -- the boolean is annotated, never altered");
      assert.equal(driven.j2.confounded, true, "a low bit on a pin DDRA configures as an output driving low IS confounded");
      assert.deepEqual(driven.j2.confoundedDirections, ["up"], "only the driven-low direction is suspect");
      assert.match(String(driven.j2.confoundedReason), /up/);
      assert.equal(driven.notes.length, 1);
    } finally {
      const restore = await dispatchStock("vice_memory_write", { address: "$dc00", data: [originalPra], bank: "io" }, liveDeps());
      assert.equal(restore.isError, false, `restoring $DC00 = 0x${originalPra.toString(16)} must succeed, got: ${JSON.stringify(restore)}`);
    }
  },
);

test(
  "stock-live (WR-01): vice_memory_banks reports the emulator's WHOLE enumeration -- aliases sharing a wire id included, and every reported name resolves",
  { skip: SKIP_REASON },
  async () => {
    const result = await dispatchStock("vice_memory_banks", {}, liveDeps());
    const payload = parseOkPayload(result as { content: { type: "text"; text: string }[]; isError: boolean });
    const banks = payload.banks as Array<{ id: number; name: string }>;

    assert.equal(payload.count, banks.length, "count must be the length of the reported list");

    // VICE 3.9 reports SIX (id, name) pairs over FIVE distinct ids -- both
    // `default` and `cpu` are wire id 0. The old handler enumerated an
    // id-keyed map, so one of the two vanished and `count` said 5. Pinning
    // both names is the whole point: a build that genuinely stopped reporting
    // one should fail here and be re-verified, not silently reported.
    const names = banks.map((b) => b.name.toLowerCase());
    for (const alias of ["default", "cpu"] as const) {
      assert.ok(names.includes(alias), `the live catalog must report "${alias}" -- if a future build drops it, re-verify WR-01 rather than deleting this case`);
    }
    const aliasIds = new Set(banks.filter((b) => ["default", "cpu"].includes(b.name.toLowerCase())).map((b) => b.id));
    assert.equal(aliasIds.size, 1, "default and cpu are expected to SHARE one wire id -- that sharing is what the old id-keyed map lost");
    assert.ok(banks.length > new Set(banks.map((b) => b.id)).size, "the answer must carry more (id, name) pairs than distinct ids, or nothing here is being exercised");

    // Every name the answer offers must actually resolve -- the same catalog
    // feeds resolveRequiredBank()'s "available banks: ..." refusal, so a name
    // reported here that refuses would be the WR-01 defect from the other end.
    for (const bank of banks) {
      const read = await dispatchStock("vice_memory_read", { address: "$1000", size: 1, bank: bank.name }, liveDeps());
      const readPayload = parseOkPayload(read as { content: { type: "text"; text: string }[]; isError: boolean });
      const reportedBank = readPayload.bank as { id: number; name: string };
      assert.equal(reportedBank.id, bank.id, `bank "${bank.name}" must resolve to the wire id the catalog reported`);
      assert.equal(reportedBank.name, bank.name, `vice_memory_read must echo the bank name that was ASKED for, not another alias of the same id`);
    }
  },
);

// ---------------------------------------------------------------------------
// 05-10's CR-02 and legend live regressions. stock-sprites.test.ts proves the
// WIRING is right against a stub built from the SAME understanding as the
// fix; only a real emulator can prove sprite geometry survives I/O being
// banked out, and that a live hi-res render actually carries a legend
// naming only the symbols it emits.
// ---------------------------------------------------------------------------

test(
  "stock-live (05-10, CR-02): sprite geometry survives I/O being banked out, with a non-vacuity control proving the banking actually changed",
  { skip: SKIP_REASON },
  async () => {
    await ensureBooted();

    // --- 1. Baseline: vice_sprite_get on the default-booted machine ---
    const preResult = await dispatchStock("vice_sprite_get", {}, liveDeps());
    const prePayload = parseOkPayload(preResult as { content: { type: "text"; text: string }[]; isError: boolean });
    console.log(
      `stock-live: pre-write vice_sprite_get -> vicBank=${prePayload.vicBank}, screenBase=${prePayload.screenBase}, ` +
        `pointerTableAddress=${prePayload.pointerTableAddress}, registerBank=${JSON.stringify(prePayload.registerBank)}, ` +
        `dataBank=${JSON.stringify(prePayload.dataBank)}, notes=${JSON.stringify(prePayload.notes)}`,
    );
    assert.equal(prePayload.vicBank, 0, `vicBank must be 0 on a default-booted machine, got ${prePayload.vicBank}`);
    assert.equal(prePayload.screenBase, 1024, `screenBase must be 1024 on a default-booted machine, got ${prePayload.screenBase}`);
    assert.equal(
      prePayload.pointerTableAddress,
      2040,
      `pointerTableAddress must be 2040 on a default-booted machine, got ${prePayload.pointerTableAddress}`,
    );
    const preRegisterBank = prePayload.registerBank as { id: number; name: string };
    const preDataBank = prePayload.dataBank as { id: number; name: string };
    assert.equal(preRegisterBank.name, "io");
    assert.equal(preDataBank.name, "ram");
    assert.equal(prePayload.runState, "stopped");
    const preCia2PortARaw = prePayload.cia2PortARaw;

    try {
      // --- 2. Bank I/O out ---
      const writeResult = await dispatchStock("vice_memory_write", { address: 1, data: [0x34] }, liveDeps());
      assert.equal(writeResult.isError, false, `vice_memory_write({address:1, data:[0x34]}) must succeed, got: ${JSON.stringify(writeResult)}`);

      // --- 3. Re-run vice_sprite_get -- the CR-02 regression ---
      const postResult = await dispatchStock("vice_sprite_get", {}, liveDeps());
      const postPayload = parseOkPayload(postResult as { content: { type: "text"; text: string }[]; isError: boolean });
      console.log(
        `stock-live: post-write ($01=0x34) vice_sprite_get -> vicBank=${postPayload.vicBank}, screenBase=${postPayload.screenBase}, ` +
          `pointerTableAddress=${postPayload.pointerTableAddress}, cia2PortARaw=${postPayload.cia2PortARaw}`,
      );
      assert.equal(
        postPayload.vicBank,
        prePayload.vicBank,
        `vicBank must be unchanged with I/O banked out: before=${prePayload.vicBank} after=${postPayload.vicBank}`,
      );
      assert.equal(
        postPayload.screenBase,
        prePayload.screenBase,
        `screenBase must be unchanged with I/O banked out: before=${prePayload.screenBase} after=${postPayload.screenBase}`,
      );
      assert.equal(
        postPayload.pointerTableAddress,
        prePayload.pointerTableAddress,
        `pointerTableAddress must be unchanged with I/O banked out: before=${prePayload.pointerTableAddress} after=${postPayload.pointerTableAddress}`,
      );
      assert.equal(
        postPayload.cia2PortARaw,
        preCia2PortARaw,
        `cia2PortARaw must be unchanged with I/O banked out: before=${preCia2PortARaw} after=${postPayload.cia2PortARaw}`,
      );

      // --- 4. Non-vacuity control: prove the banking manipulation actually took effect ---
      const defaultReadResult = await dispatchStock("vice_memory_read", { address: "$dd00", size: 1, encoding: "array" }, liveDeps());
      const defaultReadPayload = parseOkPayload(defaultReadResult as { content: { type: "text"; text: string }[]; isError: boolean });
      const defaultByte = (defaultReadPayload.bytes as number[])[0];
      const ioReadResult = await dispatchStock("vice_memory_read", { address: "$dd00", size: 1, encoding: "array", bank: "io" }, liveDeps());
      const ioReadPayload = parseOkPayload(ioReadResult as { content: { type: "text"; text: string }[]; isError: boolean });
      const ioByte = (ioReadPayload.bytes as number[])[0];
      console.log(`stock-live: non-vacuity control -- default-bank $dd00: ${defaultByte}, io-bank $dd00: ${ioByte}, reported cia2PortARaw: ${preCia2PortARaw}`);
      assert.equal(
        defaultByte,
        255,
        `non-vacuity control failed: the default-bank $DD00 read must be 255 (uninitialised RAM) after $01=$34, got ${defaultByte}`,
      );
      assert.equal(
        ioByte,
        preCia2PortARaw,
        `non-vacuity control failed: the io-bank $DD00 read (${ioByte}) must equal the reported cia2PortARaw (${preCia2PortARaw})`,
      );
    } finally {
      // --- 5. Restore $01 -- a mid-test failure must not leave the shared
      //        fixture's emulator banked out for the cases that follow. ---
      const restoreResult = await dispatchStock("vice_memory_write", { address: 1, data: [0x37] }, liveDeps());
      assert.equal(restoreResult.isError, false, `restoring $01=$37 must succeed, got: ${JSON.stringify(restoreResult)}`);
    }
  },
);

test("stock-live (05-10): the hi-res legend, live -- sprite 0's legend names only '.' and '#', never '@' or '%'", { skip: SKIP_REASON }, async () => {
  await ensureBooted();
  const result = await dispatchStock("vice_sprite_inspect", { sprite_number: 0, format: "ascii" }, liveDeps());
  const payload = parseOkPayload(result as { content: { type: "text"; text: string }[]; isError: boolean });
  const legend = payload.legend as string;
  const rows = payload.rows as string[];
  console.log(`stock-live: vice_sprite_inspect({sprite_number:0, format:"ascii"}) -- legend="${legend}"`);
  console.log(`stock-live: first three rendered rows: ${JSON.stringify(rows.slice(0, 3))}`);
  assert.equal(payload.multicolour, false, `sprite 0 must be hi-res on a default-booted machine, got multicolour=${payload.multicolour}`);
  assert.ok(legend.includes("#"), `legend must mention '#', got: ${legend}`);
  assert.ok(legend.includes("."), `legend must mention '.', got: ${legend}`);
  assert.ok(!legend.includes("@"), `hi-res legend must not mention '@', got: ${legend}`);
  assert.ok(!legend.includes("%"), `hi-res legend must not mention '%', got: ${legend}`);
  const distinctChars = new Set(rows.join(""));
  for (const ch of distinctChars) {
    assert.ok(legend.includes(ch), `every character actually rendered must be mentioned in the legend -- "${ch}" is missing from: ${legend}`);
  }
});
