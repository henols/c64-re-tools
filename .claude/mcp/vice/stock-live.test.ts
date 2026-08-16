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
