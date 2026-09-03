#!/usr/bin/env node
// reproducible-seam-probe.mjs
//
// UAT test 2 for Phase 33. Exercises `vice_run_until` with
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

async function main() {
  log(`# UAT 33 test 2 -- vice_run_until reproducible+frame_anchor through the SHIPPED seam`);
  log(`# binary: ${VICE_BIN}`);
  log(`# target: $${TARGET.toString(16)}  frame_anchor: $${ANCHOR.toString(16)}  jitters: ${JITTERS.join("/")}ms`);
  log(`# determinism block (shipped, seed ${STOCK_DETERMINISM_SEED}): ${STOCK_DETERMINISM_FLAGS.join(" ")}\n`);

  const runs = [];
  for (const jitterMs of JITTERS) {
    log(`--- jitter ${jitterMs}ms ---`);
    const r = await oneRun(jitterMs);
    runs.push(r);
    if (!r.ok) { log(`  REFUSED/ERROR after ${r.elapsed}ms: ${r.error}\n`); continue; }
    const a = r.answer;
    log(`  reproducibleStop=${a.reproducibleStop} settled in ${r.elapsed}ms`);
    log(`  identity: PC=$${a.pc.toString(16)} hit_count=${a.hitCount} LIN=${a.line} CYC=${a.cycle}`);
    log(`  targetHitCount=${a.targetHitCount} anchorHitsObserved=${a.anchorHitsObserved} resumes=${a.resumes}`);
    log(`  anchorCleanup=${a.anchorCleanup} cleanup=${a.cleanup} machineHalted=${a.machineHalted} runState=${a.runState}`);
    log(`  sha256(64K)=${r.sha256}\n`);
    await sleep(500);
  }

  // ---- verdict -----------------------------------------------------------
  log(`=== VERDICT ===`);
  const failed = runs.filter((r) => !r.ok);
  if (failed.length) {
    log(`FAIL: ${failed.length}/${runs.length} run(s) did not produce a certified stop.`);
    process.exitCode = 1;
    return;
  }
  const idKey = (r) => `${r.answer.pc}|${r.answer.hitCount}|${r.answer.line}|${r.answer.cycle}`;
  const ids = new Set(runs.map(idKey));
  const shas = new Set(runs.map((r) => r.sha256));
  const resumes = new Set(runs.map((r) => r.answer.resumes));

  log(`distinct four-term stop identities across ${runs.length} jitters: ${ids.size} -> ${[...ids].join("  ")}`);
  log(`distinct 64K sha256 across ${runs.length} jitters:               ${shas.size} -> ${[...shas].join("  ")}`);
  log(`resumes per wait (must be exactly 1 on every run):               ${[...resumes].join(",")}`);

  // --- the difference census, through the phase's OWN predicate ----------
  // An empty allow-list means NOTHING is excused: this reports the RAW
  // divergence, which is the only honest first measurement. Naming the
  // addresses is what separates "3 known transients" from "the run is not
  // reproducible at all" -- a bare sha256 mismatch cannot tell them apart.
  const outDir = new URL("./uat-seam-images/", import.meta.url).pathname;
  mkdirSync(outDir, { recursive: true });
  for (const r of runs) writeFileSync(`${outDir}/jitter-${r.jitterMs}.bin`, r.image);
  log(`\n64K images written to ${outDir}`);

  const censusPairs = [[0, 1], [0, 2], [1, 2]];
  const unionDiff = new Set();
  for (const [i, j] of censusPairs) {
    const cmp = compareCaptures(runs[i].image, runs[j].image, []);
    for (const a of cmp.differing) unionDiff.add(a);
    log(`\n--- raw difference census (empty allow-list): jitter ${runs[i].jitterMs} vs ${runs[j].jitterMs} ---`);
    log(`  differing addresses: ${cmp.differing.length}`);
    log(formatComparison(cmp, 40).trimEnd());
  }
  const union = [...unionDiff].sort((x, y) => x - y);
  log(`\nUNION of differing addresses across all three pairs: ${union.length}`);
  log(`  ${union.map(hex4).join(" ")}`);
  log(`  allow-list cap is 64 -- this union is ${union.length <= 64 ? "WITHIN" : "OVER"} the committed cap.`);

  const pass = ids.size === 1 && shas.size === 1 && resumes.size === 1 && resumes.has(1);
  log(pass
    ? `\nPASS: one stop identity and one sha256 across the 0/1500/4000ms jitter triple, through the shipped seam.`
    : `\nRAW-SHA256 FAIL: the four-term identity reproduced, the raw 64K image did not. See the census above.`);
  process.exitCode = pass ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
