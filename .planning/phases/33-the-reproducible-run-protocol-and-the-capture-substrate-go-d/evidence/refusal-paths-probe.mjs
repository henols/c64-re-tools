#!/usr/bin/env node
// reproducible-seam-probe.mjs
//
// UAT test 2 (part 2) for Phase 33. Exercises the three POST-REVIEW REFUSAL
// PATHS `33-VERIFICATION.md`'s behavior_unverified item names, against real
// stock VICE and through the SHIPPED seam. Sibling of
// reproducible-seam-probe.mjs, which covers the jitter triple.
//
// ORIGINAL HEADER (harness is shared verbatim):
// Exercises `vice_run_until` with
// `reproducible: true` + `frame_anchor` against REAL stock VICE 3.9, THROUGH
// THE SHIPPED SEAM -- `stock-run-until.ts`'s `handleRunUntil`, the module the
// MCP dispatch table actually routes `vice_run_until` to, which is the ONLY
// non-test caller of `runReproducible()`.
//
// WHY THIS FILE EXISTS. Every one of the phase's five live evidence probes
// drove the PIECES directly via `stock-protocol.ts` / `broker-launch.mts`;
// none imported `stock-reproducible-run.ts`. Its only coverage was 30 unit
// tests against scripted clients, and it was changed by three code-review-fix
// commits (edb5d7f, f00446b, d49a8ce) AFTER every live run (2b40040, 678da05,
// 01cfae9). The code that was measured was not the code that ships. This probe
// closes that gap by calling the shipped entry point.
//
// WHAT IT MEASURES. At pre-protocol jitter of 0 / 1500 / 4000 ms (free-run
// wall-clock between the emulator binding its monitor port and this client
// connecting), the protocol must produce ONE identical four-term stop identity
// (PC, hit_count, (LIN, CYC)) and ONE identical 64K sha256.
//
// -default MUST precede -binarymonitor or the monitor never binds.
// /usr/bin/x64sc is genuine unpatched stock 3.9; the fork shadows it at
// /usr/local/bin/x64sc and must NOT be used here.

import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, connect as netConnect } from "node:net";

import { ViceMonitorClient } from "../../../../src/mcp/vice/stock-protocol.ts";
import { attachRunStateTracker } from "../../../../src/mcp/vice/stock-runstate.ts";
import { handleRunUntil } from "../../../../src/mcp/vice/stock-run-until.ts";
import { handleMemoryRead } from "../../../../src/mcp/vice/stock-memory.ts";
import { compareCaptures, formatComparison, hex4 } from "../../../../src/mcp/vice/capture-predicate.ts";
// THE shipped determinism block, imported and never retyped (T-33-36). The
// broker emits it UNCONDITIONALLY on the stock branch, so a probe that spawns
// x64sc directly and omits it is measuring the WITHOUT-BLOCK arm, not the
// shipped launch -- which is exactly the mistake this probe made on its first
// run (1032 single-bit RAM flips from randomised power-on RAM init).
import { STOCK_DETERMINISM_FLAGS, STOCK_DETERMINISM_SEED } from "../../../../src/mcp/vice/broker-launch.mts";

const VICE_BIN = process.env.VICE_LIVE_STOCK_BIN ?? "/usr/bin/x64sc";
const TARGET = 0xea31;   // the KERNAL IRQ handler -- the measured green case
const ANCHOR = 0xea31;   // address === frameAnchor is the documented green config
const JITTERS = [0, 1500, 4000];
const RUN_TIMEOUT_MS = 20000;

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BROKER_STUB = { claimMonitor: async () => ({ ok: true }), releaseMonitor: async () => ({ ok: true }) };

function assertNoOtherEmulator() {
  let alive = [];
  try {
    alive = execFileSync("pgrep", ["-x", "x64sc"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch { /* pgrep exits 1 when nothing matches */ }
  if (alive.length) throw new Error(`REFUSAL: ${alive.length} other x64sc process(es) alive (${alive.join(",")}). Kill them first.`);
}

async function freeEphemeralPort() {
  return await new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Waits until the monitor port ACCEPTS a raw TCP connection. Deliberately a
 * bare socket, not a ViceMonitorClient handshake: stock's binary monitor
 * services exactly ONE client, and a throwaway handshake would consume the
 * session the protocol is about to need. */
async function waitForPort(port, deadlineMs = 20000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < deadlineMs) {
    try {
      await new Promise((resolve, reject) => {
        const sock = netConnect({ host: "127.0.0.1", port });
        sock.once("connect", () => { sock.destroy(); resolve(); });
        sock.once("error", (e) => { sock.destroy(); reject(e); });
      });
      return Date.now() - start;
    } catch (e) { lastErr = e; await sleep(150); }
  }
  throw new Error(`waitForPort: 127.0.0.1:${port} never accepted within ${deadlineMs}ms (last: ${lastErr})`);
}

/** The handshake itself can still race the accept, so retry it -- the same
 * discipline stock-live.test.ts's own connectWithRetry() uses. */
async function connectWithRetry(client, host, port, deadlineMs = 10000) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < deadlineMs) {
    try { await client.connect(host, port, { timeoutMs: 1000 }); return; }
    catch (err) { lastErr = err; await sleep(200); }
  }
  throw new Error(`connectWithRetry: could not connect to ${host}:${port} within ${deadlineMs}ms (last: ${String(lastErr)})`);
}

function textOf(result) {
  return result?.content?.[0]?.text ?? "";
}

async function dump64k(session) {
  const parts = [];
  for (const [address, size] of [[0x0000, 0x8000], [0x8000, 0x8000]]) {
    const res = await handleMemoryRead({ address, size, encoding: "hex" }, session, {});
    if (res.isError) throw new Error(`memory_read(${address},${size}) failed: ${textOf(res)}`);
    const payload = JSON.parse(textOf(res));
    const buf = Buffer.from(payload.hex, "hex");
    if (buf.length !== size) throw new Error(`memory_read(${address},${size}) returned ${buf.length} bytes`);
    parts.push(buf);
  }
  const image = Buffer.concat(parts);
  if (image.length !== 65536) throw new Error(`assembled image is ${image.length} bytes, expected 65536`);
  return { sha256: createHash("sha256").update(image).digest("hex"), image };
}

async function oneRun(jitterMs) {
  assertNoOtherEmulator();
  const port = await freeEphemeralPort();
  const scratchDir = mkdtempSync(join(tmpdir(), "uat33-vicerc-"));
  const child = spawn(
    VICE_BIN,
    ["-default", ...STOCK_DETERMINISM_FLAGS, "-binarymonitor", "-binarymonitoraddress", `ip4://127.0.0.1:${port}`],
    { stdio: "ignore", env: { ...process.env, XDG_CONFIG_HOME: scratchDir } },
  );
  child.once("error", (e) => console.error(`spawn error: ${e}`));

  let client = null;
  try {
    const bindMs = await waitForPort(port);
    log(`  monitor port bound after ${bindMs}ms; free-running for ${jitterMs}ms of pre-protocol jitter`);
    await sleep(jitterMs);

    client = new ViceMonitorClient();
    await connectWithRetry(client, "127.0.0.1", port);
    attachRunStateTracker(client);

    const session = {
      client,
      versionQuad: "unknown",
      capabilities: { cpuHistory: "absent" },
      host: "127.0.0.1",
      port,
      targetId: `uat33-${port}`,
      brokerControl: BROKER_STUB,
      deps: {},
      baselineEpoch: null,
    };

    const t0 = Date.now();
    const result = await handleRunUntil(
      { address: TARGET, reproducible: true, frame_anchor: ANCHOR, timeout_ms: RUN_TIMEOUT_MS },
      session,
      {},
    );
    const elapsed = Date.now() - t0;
    const text = textOf(result);
    if (result.isError) return { jitterMs, ok: false, error: text, elapsed };

    const answer = JSON.parse(text);
    const { sha256, image } = await dump64k(session);
    return { jitterMs, ok: true, elapsed, answer, sha256, image };
  } finally {
    try { if (client) await client.disconnect(); } catch { /* child is about to die */ }
    child.kill("SIGKILL");
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 3000);
      child.once("exit", () => { clearTimeout(t); resolve(); });
    });
    rmSync(scratchDir, { recursive: true, force: true });
  }
}


/** One run with arbitrary target/anchor, returning the RAW answer (refusal text
 *  included) rather than asserting a certified stop. */
async function refusalRun({ label, address, frameAnchor, timeoutMs = 12000 }) {
  assertNoOtherEmulator();
  const port = await freeEphemeralPort();
  const scratchDir = mkdtempSync(join(tmpdir(), "uat33r-vicerc-"));
  const child = spawn(
    VICE_BIN,
    ["-default", ...STOCK_DETERMINISM_FLAGS, "-binarymonitor", "-binarymonitoraddress", `ip4://127.0.0.1:${port}`],
    { stdio: "ignore", env: { ...process.env, XDG_CONFIG_HOME: scratchDir } },
  );
  child.once("error", (e) => console.error(`spawn error: ${e}`));
  let client = null;
  try {
    await waitForPort(port);
    client = new ViceMonitorClient();
    await connectWithRetry(client, "127.0.0.1", port);
    attachRunStateTracker(client);
    const session = {
      client, versionQuad: "unknown", capabilities: { cpuHistory: "absent" },
      host: "127.0.0.1", port, targetId: `uat33r-${port}`,
      brokerControl: BROKER_STUB, deps: {}, baselineEpoch: null,
    };
    const result = await handleRunUntil(
      { address, reproducible: true, frame_anchor: frameAnchor, timeout_ms: timeoutMs }, session, {},
    );
    return { label, isError: result.isError, text: textOf(result) };
  } finally {
    try { if (client) await client.disconnect(); } catch { /* child dying */ }
    child.kill("SIGKILL");
    await new Promise((r) => { const t = setTimeout(r, 3000); child.once("exit", () => { clearTimeout(t); r(); }); });
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

async function main() {
  log(`# UAT 33 test 2 (part 2) -- the post-review refusal paths, live`);
  log(`# binary: ${VICE_BIN}   seed ${STOCK_DETERMINISM_SEED}\n`);
  const checks = [];

  // --- CR-02: the zero-hit refusal ---------------------------------------
  // The target must execute BEFORE the frame anchor has run even once. After
  // the protocol's hard RESET the CPU enters the KERNAL reset routine, and
  // $fda3 (IOINIT) runs there -- long before the first IRQ reaches $ea31. So
  // the target fires with the anchor's hit count still 0, which is exactly the
  // state CR-02 refuses rather than reporting a vacuous frame term.
  log(`--- CR-02: target $fda3 reached before anchor $ea31 ever fires ---`);
  const cr02 = await refusalRun({ label: "CR-02", address: 0xfda3, frameAnchor: 0xea31 });
  log(`  isError=${cr02.isError}`);
  log(`  ${cr02.text.slice(0, 400)}\n`);
  checks.push({
    name: "CR-02 zero-hit refusal",
    pass: cr02.isError === true
      && /frame term is 0|had executed even once/.test(cr02.text)
      && !/reproducibleStop/.test(cr02.text),
  });

  // --- WR-01: the anchor-stopped-first adjacency gate ---------------------
  // Anchor and target at DIFFERENT addresses, with the anchor reached first.
  // The anchor is armed stop:true, so it HALTS the machine; exactly one resume
  // is ever sent, so the target can never fire. WR-01 settles this as a
  // timeout AT ONCE rather than burning the whole deadline.
  log(`--- WR-01: anchor $ea31 fires first; target $c000 (never executed) ---`);
  const t0 = Date.now();
  const wr01 = await refusalRun({ label: "WR-01", address: 0xc000, frameAnchor: 0xea31, timeoutMs: 15000 });
  const wr01Elapsed = Date.now() - t0;
  log(`  isError=${wr01.isError}  wall-clock ${wr01Elapsed}ms (deadline was 15000ms)`);
  let wr01Answer = null;
  try { wr01Answer = JSON.parse(wr01.text); } catch { /* refusal text, not JSON */ }
  if (wr01Answer) {
    log(`  timedOut=${wr01Answer.timedOut} anchorStoppedFirst=${wr01Answer.anchorStoppedFirst}`);
    log(`  anchorHitsObserved=${wr01Answer.anchorHitsObserved} resumes=${wr01Answer.resumes}`);
    log(`  reproducibleStop=${wr01Answer.reproducibleStop} cleanup=${wr01Answer.cleanup} anchorCleanup=${wr01Answer.anchorCleanup}`);
    log(`  machineHalted=${wr01Answer.machineHalted}`);
    log(`  NO oracle term emitted: ${["pc","hitCount","line","cycle"].every((k) => wr01Answer[k] === undefined)}`);
  } else {
    log(`  ${wr01.text.slice(0, 300)}`);
  }
  log("");
  checks.push({
    name: "WR-01 anchor-stopped-first settles at once, emits no oracle term",
    pass: !!wr01Answer && wr01Answer.timedOut === true && wr01Answer.anchorStoppedFirst === true
      && wr01Answer.reproducibleStop === false && wr01Answer.resumes === 1
      && ["pc", "hitCount", "line", "cycle"].every((k) => wr01Answer[k] === undefined),
  });
  checks.push({
    name: "WR-01 does not burn the full deadline (settles well under 15000ms)",
    pass: wr01Elapsed < 13000,
  });

  log(`=== VERDICT ===`);
  for (const c of checks) log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
  log(`\nWR-02 (anchor cleanup on a live-socket resume failure) is NOT exercised here:`);
  log(`  it needs the EXIT reply to fail while the socket stays alive, which is a fault`);
  log(`  injection no real emulator produces on demand. It stays unit-covered in`);
  log(`  stock-reproducible-run.test.ts and is recorded as such rather than claimed live.`);
  const pass = checks.every((c) => c.pass);
  log(`\n${pass ? "PASS" : "FAIL"}: ${checks.filter((c) => c.pass).length}/${checks.length} live refusal-path checks.`);
  process.exitCode = pass ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
