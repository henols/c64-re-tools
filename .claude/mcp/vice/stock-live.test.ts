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
import { createServer, connect as netConnect } from "node:net";

import { dispatchStock, clearHeldStockSession, type StockDispatchDeps } from "./stock-dispatch.ts";
import { ViceMonitorClient, CommandType } from "./stock-protocol.ts";
import { stockConnect, stockDisconnect, type StockConnectSession } from "./stock-connect.ts";
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

// ---------------------------------------------------------------------------
// 07-13: two more opt-in gates, one per resolved binary, so Gap 1's proofs
// (Tasks 1-2) and the contention proof (Task 3) can each name the SPECIFIC
// binary they need without depending on the shared before()/after() fixture
// above (which stays untouched -- 03-16/05-09/05-10/WR-01/WR-03/WR-06's
// cases all depend on it exactly as it is).
// ---------------------------------------------------------------------------

const VICE_LIVE_STOCK_BIN_39_DEFAULT = "/usr/bin/x64sc";
const resolvedBin39Path = process.env.VICE_LIVE_STOCK_BIN_39 ?? VICE_LIVE_STOCK_BIN_39_DEFAULT;
const SKIP_REASON_39: string | false = !process.env.VICE_LIVE_STOCK_BIN_39
  ? `07-13's genuine-VICE-3.9 proofs are opt-in and default-skipped -- set VICE_LIVE_STOCK_BIN_39=/usr/bin/x64sc ` +
    `(or another real, genuinely unpatched stock VICE 3.9 binary's absolute path) to run them. Defaults to ` +
    `${VICE_LIVE_STOCK_BIN_39_DEFAULT} when set to a truthy non-path value. A bare "x64sc" on PATH resolves to the ` +
    `fork build -- always name the stock binary by absolute path.`
  : !existsSync(resolvedBin39Path)
    ? `VICE_LIVE_STOCK_BIN_39="${resolvedBin39Path}" does not exist on disk -- opt-in requires a real, genuinely ` +
      `unpatched stock VICE 3.9 binary at that absolute path.`
    : false;

const VICE_LIVE_STOCK_BIN_310_DEFAULT = "/usr/local/bin/x64sc";
const resolvedBin310Path = process.env.VICE_LIVE_STOCK_BIN_310 ?? VICE_LIVE_STOCK_BIN_310_DEFAULT;
const SKIP_REASON_310: string | false = !process.env.VICE_LIVE_STOCK_BIN_310
  ? `07-13's genuine-VICE-3.10 proofs (Gap 1, CR-01's inversion) are opt-in and default-skipped -- set ` +
    `VICE_LIVE_STOCK_BIN_310=/usr/local/bin/x64sc (or another real VICE >= 3.10 binary's absolute path) to run ` +
    `them. Defaults to ${VICE_LIVE_STOCK_BIN_310_DEFAULT} when set to a truthy non-path value.`
  : !existsSync(resolvedBin310Path)
    ? `VICE_LIVE_STOCK_BIN_310="${resolvedBin310Path}" does not exist on disk -- opt-in requires a real VICE >= ` +
      `3.10 binary at that absolute path.`
    : false;

/** A fresh, minimal broker-control stub: `claimMonitor`/`releaseMonitor` both
 * resolve `{ ok: true }` unconditionally. Reused across every 07-13 test
 * below (rather than one instance per test) -- none of these tests exercise
 * broker-level contention (Task 3's contention is at the SOCKET, not the
 * broker claim; see that test's own header comment on what it does NOT
 * prove). */
const STOCK_LIVE_1313_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
} as unknown as BrokerControlSession;

/**
 * Spawns `binPath` as its OWN, independent stock VICE instance -- never the
 * shared before()/after() fixture's process -- on a fresh ephemeral port and
 * a fresh scratch XDG_CONFIG_HOME, waits (bounded, via the same
 * connectWithRetry() idiom the shared fixture uses) until its binary monitor
 * is actually accepting connections, invokes `fn`, and ALWAYS tears the
 * instance down afterward: SIGKILL, a bounded wait for exit, and scratch-dir
 * removal. Teardown runs even when `fn` throws (T-07-13-02) -- this is the
 * leaked-resource failure mode this file's header already names.
 *
 * `-default` MUST precede `-binarymonitor` in the spawned argv or the
 * monitor never binds (MEMORY: "Stock VICE flag order") -- the shared
 * fixture's own before() above omits `-default` and must NOT be taken as
 * the pattern here.
 *
 * The readiness probe itself opens and then immediately disconnects a
 * throwaway ViceMonitorClient BEFORE `fn` runs, so `fn` (and, in
 * particular, Task 3's own "first" holding socket) is the first REAL client
 * the instance ever services.
 */
async function withOwnStockInstance<T>(binPath: string, fn: (info: { port: number; binPath: string }) => Promise<T>): Promise<T> {
  const port = await freeEphemeralPort();
  const scratchDir = mkdtempSync(join(tmpdir(), "gsd-0713-vicerc-"));
  const child = spawn(
    binPath,
    ["-default", "-binarymonitor", "-binarymonitoraddress", `ip4://127.0.0.1:${port}`],
    { stdio: "ignore", env: { ...process.env, XDG_CONFIG_HOME: scratchDir } },
  );
  child.once("error", (err) => {
    console.error(`stock-live.test.ts: withOwnStockInstance(${binPath}) spawned emulator process error: ${String(err)}`);
  });
  try {
    const probe = new ViceMonitorClient();
    await connectWithRetry(probe, "127.0.0.1", port);
    await probe.disconnect();
    return await fn({ port, binPath });
  } finally {
    child.kill("SIGKILL");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 3000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    rmSync(scratchDir, { recursive: true, force: true });
  }
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
  "stock-live (WR-06): vice_memory_search's bank argument genuinely changes the view it reads, and the answer names that view",
  { skip: SKIP_REASON },
  async () => {
    await ensureBooted();

    async function readByte(address: string, bank?: string): Promise<number> {
      const args: Record<string, unknown> = { address, size: 1, encoding: "array" };
      if (bank !== undefined) args.bank = bank;
      const result = await dispatchStock("vice_memory_read", args, liveDeps());
      const payload = parseOkPayload(result as { content: { type: "text"; text: string }[]; isError: boolean });
      return (payload.bytes as number[])[0]!;
    }

    // $E000 is KERNAL ROM in the CPU view under default banking ($01 = $37),
    // and RAM through the emulator's own `ram` bank -- the canonical
    // "RAM under ROM" case the fork's own bank description names.
    const cpuByte = await readByte("$e000");
    const ramByte = await readByte("$e000", "ram");
    console.log(`stock-live: $E000 -- cpu view: 0x${cpuByte.toString(16)}, ram bank: 0x${ramByte.toString(16)}`);
    assert.notEqual(cpuByte, ramByte, "non-vacuity: the two views must genuinely differ at $E000, or this case proves nothing about the bank argument");

    // Searching the same one-byte range for the CPU view's byte matches
    // through the default view and NOT through `ram`, and vice versa. This is
    // the capability WR-06 was about: before it, no bank argument existed and
    // the RAM under ROM was unsearchable.
    async function search(pattern: number, bank?: string): Promise<Record<string, unknown>> {
      const args: Record<string, unknown> = { start: "$e000", end: "$e000", pattern: [pattern] };
      if (bank !== undefined) args.bank = bank;
      const result = await dispatchStock("vice_memory_search", args, liveDeps());
      return parseOkPayload(result as { content: { type: "text"; text: string }[]; isError: boolean });
    }

    const defaultView = await search(cpuByte);
    console.log(`stock-live: search default view -> bank=${JSON.stringify(defaultView.bank)}, matches=${JSON.stringify(defaultView.matches)}`);
    assert.deepEqual(defaultView.matches, [0xe000], "the default (CPU) view must find the ROM byte");
    assert.equal(defaultView.bank, 0, "an omitted bank is still wire bank 0 -- reported, not inferred");
    assert.match(String(defaultView.bankView), /CPU view/);

    const ramView = await search(cpuByte, "ram");
    console.log(`stock-live: search ram bank -> bank=${JSON.stringify(ramView.bank)}, matches=${JSON.stringify(ramView.matches)}`);
    assert.deepEqual(ramView.matches, [], "the ROM byte must NOT be found through the ram bank -- the argument really changed the view");
    assert.equal((ramView.bank as { name: string }).name, "ram");
    assert.match(String(ramView.bankView), /"ram"/);

    const ramHit = await search(ramByte, "ram");
    assert.deepEqual(ramHit.matches, [0xe000], "the RAM-under-ROM byte IS findable through the ram bank -- previously unreachable");

    // vice_memory_compare reports the same view fields, applied to both ranges.
    const compare = await dispatchStock(
      "vice_memory_compare",
      { mode: "ranges", range1_start: "$e000", range1_end: "$e00f", range2_start: "$e010", bank: "ram" },
      liveDeps(),
    );
    const comparePayload = parseOkPayload(compare as { content: { type: "text"; text: string }[]; isError: boolean });
    assert.equal((comparePayload.bank as { name: string }).name, "ram");
    assert.match(String(comparePayload.bankView), /"ram"/);
  },
);

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

// ---------------------------------------------------------------------------
// 07-13 Task 1: prove stockConnect() completes on both real binaries, with
// the right capability on each -- the inversion of 07-VERIFICATION.md's own
// live reproduction (Gap 1 / CR-01). Each test owns its OWN spawned
// instance via withOwnStockInstance() above, entirely independent of the
// shared before()/after() fixture (which stubs capabilities.cpuHistory to a
// hardcoded "absent" and would prove nothing about a real handshake).
// ---------------------------------------------------------------------------

test(
  "stock-live (07-13 Task 1c, Gap 1): stockConnect() resolves against genuine VICE 3.9, with cpuHistory absent and a usable session",
  { skip: SKIP_REASON_39 },
  async () => {
    await withOwnStockInstance(resolvedBin39Path, async ({ port }) => {
      const session = await stockConnect({
        host: "127.0.0.1",
        port,
        targetId: "stock-live-1313-connect-39",
        brokerControl: STOCK_LIVE_1313_BROKER_CONTROL,
        deps: {},
      });
      try {
        assert.ok(session.client, "stockConnect() must resolve with a client");
        console.log(`stock-live: genuine VICE 3.9 versionQuad=${session.versionQuad}, capabilities=${JSON.stringify(session.capabilities)}`);
        assert.ok(
          session.versionQuad.startsWith("3.9"),
          `expected versionQuad to start with "3.9" on a genuine VICE 3.9 binary, got "${session.versionQuad}"`,
        );
        const observedCapability = session.capabilities.cpuHistory;
        assert.equal(
          observedCapability,
          "absent",
          `expected cpuHistory capability "absent" on genuine VICE 3.9, got "${observedCapability}"`,
        );
        // Send one PING to prove the session is actually usable, not just
        // constructed -- must not throw.
        await session.client.send(CommandType.Ping);
      } finally {
        await stockDisconnect(session);
      }
    });
  },
);

test(
  'stock-live (07-13 Task 1d, Gap 1, CR-01): stockConnect() resolves against genuine VICE 3.10, inverting the previously live-reproduced failure "StockFramingError | response type 0x86 body is 52 byte(s), needs at least 65", with cpuHistory available',
  { skip: SKIP_REASON_310 },
  async () => {
    await withOwnStockInstance(resolvedBin310Path, async ({ port }) => {
      const session = await stockConnect({
        host: "127.0.0.1",
        port,
        targetId: "stock-live-1313-connect-310",
        brokerControl: STOCK_LIVE_1313_BROKER_CONTROL,
        deps: {},
      });
      try {
        assert.ok(session.client, "stockConnect() must resolve with a client -- CR-01's whole point: this used to REJECT");
        console.log(`stock-live: genuine VICE 3.10 versionQuad=${session.versionQuad}, capabilities=${JSON.stringify(session.capabilities)}`);
        assert.ok(
          session.versionQuad.startsWith("3.10"),
          `expected versionQuad to start with "3.10" on a genuine VICE >= 3.10 binary, got "${session.versionQuad}"`,
        );
        const observedCapability = session.capabilities.cpuHistory;
        // Do NOT relax this to "absent" if it fails -- that is exactly the
        // accommodation that produced this gap (07-13 Task 1's own
        // instruction). A failure here means 07-12's parser still cannot
        // decode the real reply; report it as a finding, do not soften it.
        assert.equal(
          observedCapability,
          "available",
          `expected cpuHistory capability "available" on genuine VICE >= 3.10 (07-12's re-derived parser should decode the real reply), got "${observedCapability}"`,
        );
        await session.client.send(CommandType.Ping);
      } finally {
        await stockDisconnect(session);
      }
    });
  },
);

// ---------------------------------------------------------------------------
// 07-13 Task 2: measure a real bracket on genuine VICE 3.10 through the
// real dispatchStock() seam -- Route A ("cpu_history"), the Manual-Only
// "Route A stopwatch on a >= 3.10 build" row 07-VALIDATION.md leaves
// outstanding. `deps.connect` is the REAL stockConnect (not the file's
// hardcoded-absent-capability before()/after() stub session, which would
// silently select Route B and prove nothing).
// ---------------------------------------------------------------------------

test(
  "stock-live (07-13 Task 2, Manual-Only Route A stopwatch): a real ~500ms bracket on genuine VICE 3.10 measures an exact, non-zero, plausible cycle count via route cpu_history, through the real dispatchStock() seam",
  { skip: SKIP_REASON_310 },
  async () => {
    await withOwnStockInstance(resolvedBin310Path, async ({ port }) => {
      const targetId = "stock-live-1313-routeA-310";
      const deps: StockDispatchDeps = {
        ensureLease: async () => ({
          ok: true as const,
          lease: {
            host: "127.0.0.1",
            port,
            targetId,
            brokerControl: STOCK_LIVE_1313_BROKER_CONTROL,
            epochFile: "",
            supervisorDir: "",
          } as HeldLease,
        }),
        connect: stockConnect,
      };
      try {
        // 1. reset -- also proves Route A was actually selected (can only
        //    hold if 07-12's parser decodes a real CPUHISTORY_GET reply).
        const resetResult = await dispatchStock("vice_cycles_stopwatch", { action: "reset" }, deps);
        const resetPayload = parseOkPayload(resetResult as { content: { type: "text"; text: string }[]; isError: boolean });
        assert.equal(
          resetPayload.route,
          "cpu_history",
          `expected Route A ("cpu_history") to be selected on genuine VICE 3.10, got "${resetPayload.route}"`,
        );

        // 2. one resume.
        const runResult = await dispatchStock("vice_execution_run", {}, deps);
        assert.equal(runResult.isError, false, `vice_execution_run must succeed, got: ${JSON.stringify(runResult)}`);

        // 3. a real wall-clock wait with NO calls at all -- 07-CONTEXT.md's
        //    own rule that runCycleBracket()'s ping-polling must not be
        //    ported: every inbound byte halts the machine on stock.
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 4. read.
        const readResult = await dispatchStock("vice_cycles_stopwatch", { action: "read" }, deps);
        const readPayload = parseOkPayload(readResult as { content: { type: "text"; text: string }[]; isError: boolean });
        assert.equal(readPayload.route, "cpu_history", `expected route "cpu_history" on read, got "${readPayload.route}"`);
        assert.equal(readPayload.measurable, true, `expected measurable:true, got: ${JSON.stringify(readPayload)}`);
        assert.equal(readPayload.exactness, "exact", `expected exactness:"exact", got "${readPayload.exactness}"`);
        assert.ok("cyclesExact" in readPayload, "measurable:true must carry cyclesExact");
        const cyclesExact = readPayload.cyclesExact as string;
        const cyclesExactBig = BigInt(cyclesExact);
        assert.ok(cyclesExactBig > 0n, `cyclesExact must parse to a positive BigInt, got "${cyclesExact}"`);
        const cycles = readPayload.cycles as number;
        assert.ok(typeof cycles === "number" && cycles > 0, `cycles must be a positive number, got ${JSON.stringify(cycles)}`);
        console.log(`stock-live: Route A measured ${cycles} cycles (${cyclesExact} exact) over a ~500ms wait`);

        // 5. sanity-bound (not pin) the figure -- a PAL C64 runs ~985,000
        //    cycles/s, so a 500ms wait should fall comfortably inside
        //    [100000, 5000000]. This band exists to catch a fabricated or
        //    wrongly-scaled number, not to pin timing.
        assert.ok(
          cycles >= 100000 && cycles <= 5000000,
          `measured cycles ${cycles} fall outside the sanity band [100000, 5000000] for a ~500ms wait -- this band ` +
            "catches a fabricated or wrongly-scaled figure, not exact timing",
        );

        // 6. TIME-03 honesty, asserted positively: cycles is never 0, and no
        //    "cycles" key exists on a measurable:false payload.
        assert.notEqual(cycles, 0, "cycles must never be 0 -- see this file's own header on the 258,504,308-cycle incident this rule prevents");

        // Anti-fabrication guard: a second immediate read (no resume, no
        // wait) must answer either a non-negative figure consistent with
        // "nothing ran in between" or an explicit measurable:false with a
        // reason -- never negative, never a fabricated large number.
        //
        // NOTE ON THE EXPECTED FIGURE (established empirically, not assumed):
        // plain "read" (as opposed to "reset_and_read") never moves the
        // stored baseline -- only "reset"/"reset_and_read" do (stock-timing.ts's
        // own handleCyclesStopwatch()). Because the FIRST read's own
        // CPUHISTORY_GET is itself a halting read (any inbound byte halts
        // the machine on stock) and nothing resumed it before this SECOND
        // read, no further execution occurred between the two reads -- so
        // the honest answer is the delta AGAINST THE SAME ORIGINAL "reset"
        // baseline, EXACTLY UNCHANGED from the first read's figure, not a
        // "small" number close to zero. An anti-fabrication bug would show
        // up as a DIFFERENT (especially larger) or negative figure here.
        const secondReadResult = await dispatchStock("vice_cycles_stopwatch", { action: "read" }, deps);
        const secondReadPayload = parseOkPayload(secondReadResult as { content: { type: "text"; text: string }[]; isError: boolean });
        console.log(`stock-live: second immediate read (no resume, no wait) -> ${JSON.stringify(secondReadPayload)}`);
        if (secondReadPayload.measurable === true) {
          const secondCycles = secondReadPayload.cycles as number;
          assert.ok(secondCycles >= 0, `a second immediate read must never be negative, got ${secondCycles}`);
          assert.equal(
            secondCycles,
            cycles,
            `a second immediate read with no resume and no wait in between must report the EXACT SAME cycle count as ` +
              `the first read (both measure the delta against the same unmoved "reset" baseline, and nothing ran in ` +
              `between) -- a different figure would mean the count is drifting/fabricating progress that did not ` +
              `happen. First read: ${cycles}, second read: ${secondCycles}`,
          );
        } else {
          assert.equal(secondReadPayload.measurable, false);
          assert.ok(
            !("cycles" in secondReadPayload),
            `a measurable:false payload must carry no "cycles" key (TIME-03 honesty), got: ${JSON.stringify(secondReadPayload)}`,
          );
          assert.ok(
            typeof secondReadPayload.reason === "string" && (secondReadPayload.reason as string).length > 0,
            "a measurable:false payload must carry a non-empty reason",
          );
        }
      } finally {
        clearHeldStockSession();
      }
    });
  },
);

// ---------------------------------------------------------------------------
// 07-13 Task 3: prove the diagnostician stays bounded when a second client
// holds the monitor (Gap 3 / Gap 4, 07-VERIFICATION.md human_verification
// item 2). Deliberately VICE 3.9 -- isolates the contention behaviour from
// anything version-gated.
//
// WHAT THIS TEST DOES NOT PROVE: the BROKER-MEDIATED monitor_held_elsewhere
// path via a real claimMonitor() refusal from a second broker-managed
// session still requires the host broker control plane running two real
// sessions, which this file's dispatch-level harness does not stand up.
// That half stays recorded as unit-proven only (see stock-diagnose.test.ts)
// -- this test proves only the SOCKET-level contention bound, via a real
// second stockConnect() dial against an already-held single-client monitor.
// ---------------------------------------------------------------------------

test(
  "stock-live (07-13 Task 3, Gap 3/Gap 4): vice_diagnose settles within its own bound when a second real client dials a monitor already held by a first",
  { skip: SKIP_REASON_39 },
  async () => {
    await withOwnStockInstance(resolvedBin39Path, async ({ port }) => {
      // --- 1. Open and hold a first raw socket -- the "other client"
      //        already occupying stock VICE's single-client monitor slot. ---
      const holdingSocket = netConnect({ host: "127.0.0.1", port });
      await new Promise<void>((resolve, reject) => {
        holdingSocket.once("connect", () => resolve());
        holdingSocket.once("error", reject);
      });

      const originalTimeout = process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS;
      process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS = "1500";
      try {
        const targetId = "stock-live-1313-contention-39";
        const deps: StockDispatchDeps = {
          ensureLease: async () => ({
            ok: true as const,
            lease: {
              host: "127.0.0.1",
              port,
              targetId,
              brokerControl: STOCK_LIVE_1313_BROKER_CONTROL,
              epochFile: "",
              supervisorDir: "",
            } as HeldLease,
          }),
          // The REAL stockConnect -- this is the second connect() that will
          // sit unserviced behind the holding socket above.
          connect: stockConnect,
        };
        clearHeldStockSession();

        const startedAt = Date.now();
        const result = await dispatchStock("vice_diagnose", {}, deps);
        const elapsedMs = Date.now() - startedAt;
        console.log(`stock-live: vice_diagnose under second-client contention settled in ${elapsedMs}ms (bound: 1500ms)`);
        assert.ok(
          elapsedMs < 5000,
          `vice_diagnose must settle well inside its bound -- expected < 5000ms for a 1500ms configured bound, took ${elapsedMs}ms`,
        );

        const text = (result as { content: { type: "text"; text: string }[] }).content[0]!.text;
        let observedOutcome: "monitor_held_elsewhere" | "diagnosis_unavailable_timeout" | "neither" = "neither";
        if (result.isError === false) {
          const payload = JSON.parse(text) as Record<string, unknown>;
          if (payload.verdict === "monitor_held_elsewhere") observedOutcome = "monitor_held_elsewhere";
          assert.notEqual(payload.verdict, "live", "vice_diagnose must not answer the live verdict under second-client contention");
        } else if (/^vice_diagnose: diagnosis_unavailable \(monitor_acquisition_timeout\)/.test(text)) {
          observedOutcome = "diagnosis_unavailable_timeout";
        }
        console.log(`stock-live: observed contention outcome -- ${observedOutcome}`);
        assert.notEqual(
          observedOutcome,
          "neither",
          `vice_diagnose must answer either the monitor_held_elsewhere verdict or an isError:true ` +
            `"diagnosis_unavailable (monitor_acquisition_timeout)" text under contention -- which of the two depends ` +
            `on whether the contention is detected at the broker claim or at the socket, and both are correct, ` +
            `documented outcomes; got isError=${result.isError}, text: ${text}`,
        );
      } finally {
        if (originalTimeout === undefined) delete process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS;
        else process.env.VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS = originalTimeout;
        holdingSocket.destroy();
        clearHeldStockSession();
      }
    });
  },
);
