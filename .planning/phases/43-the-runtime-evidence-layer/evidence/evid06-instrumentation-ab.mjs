#!/usr/bin/env node
// -----------------------------------------------------------------------------
// evid06-instrumentation-ab.mjs -- Phase 43, plan 43-01 (`EVID-06`).
//
// Task 1 (this commit): a standalone TRACER, runnable via `--tracer`, that
// proves `memmapzap` is dialable end-to-end through the SHIPPED
// `TextMonitorClient` (`text-protocol.ts`) against genuine stock VICE
// (`/usr/bin/x64sc`), and that a `memmapshow` reply taken afterward parses
// through the SHIPPED `parseAccessMap()` (`textmon-memmap.ts`) with a
// non-zero entry count. This is the real end-to-end verify a `type="tracer"`
// task requires before the full A/B (Task 2) is built on top of it.
//
// Task 2 will extend this file into the full instrumentation-perturbation
// A/B at two anchor-hit depths, with its own pass/fail rule and
// control-of-the-control, per this plan's PLAN.md `<objective>`.
//
// WHAT THIS TRACER DOES AND DOES NOT PROVE
// -----------------------------------------
// It proves the SHIPPED client and parser round-trip against a live
// instance -- nothing about instrumentation perturbing frame-exactness.
// That is Task 2's job, not this one's.
//
// WHAT NOT TO DO
// --------------
//   - Never re-derive binary resolution, port allocation, spawn/reap,
//     preflight, or connect-with-retry -- all of it comes from Phase 39's
//     `probe-harness.mjs`, imported below, never re-authored here.
//   - Never call `TextMonitorClient.command()` outside
//     `withTextChannelLock()` -- the shipped client itself refuses when the
//     text channel does not hold `channel-lock.ts`'s mutex (D-07).
//   - Never write an artifact anywhere but this plan's own cache directory
//     under `$HOME/.cache/c64-re-tools/phase43/43-01/` -- never the system
//     temp directory (a 16 GiB RAM tmpfs with aging disabled on this host)
//     and never inside the checkout.
// -----------------------------------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --- shipped seams (D-14-style: every wire body and helper this script uses
// comes from these imports, never retyped) -----------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");
const PHASE39_EVIDENCE = path.join(
  REPO_ROOT,
  ".planning",
  "phases",
  "39-the-dual-channel-coexistence-gate-go-degrade-no-go",
  "evidence",
);

const harness = await import(path.join(PHASE39_EVIDENCE, "probe-harness.mjs"));
const textProto = await import(path.join(MCP_DIR, "text-protocol.ts"));
const memmap = await import(path.join(MCP_DIR, "textmon-memmap.ts"));

const {
  preflight,
  allocPorts,
  buildProbeArgs,
  spawnVice,
  connectWithRetry,
  pingReady,
  resumeExecution,
  reapAll,
  ViceMonitorClient,
  VICE_STOCK,
  sleep,
  log,
} = harness;
const { TextMonitorClient, withTextChannelLock } = textProto;
const { parseAccessMap } = memmap;

// --- this plan's own cache directory (never /tmp, never the checkout) ------

const CACHE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase43", "43-01");
fs.mkdirSync(CACHE_DIR, { recursive: true });

/** Fresh, per-label XDG_CONFIG_HOME under this plan's cache dir, mirroring
 *  every prior phase's evidence-script convention (`frame-anchor-probe.mjs`,
 *  `capture-pair.mjs`): removed and recreated per run, DISPLAY/
 *  WAYLAND_DISPLAY stripped from the child environment. */
function bootEnv(label) {
  const xdg = path.join(CACHE_DIR, "xdg", label);
  fs.rmSync(xdg, { recursive: true, force: true });
  fs.mkdirSync(xdg, { recursive: true });
  const env = { ...process.env, XDG_CONFIG_HOME: xdg };
  delete env.DISPLAY;
  delete env.WAYLAND_DISPLAY;
  return env;
}

// -----------------------------------------------------------------------------
// Task 1: the tracer.
// -----------------------------------------------------------------------------

async function runTracer() {
  preflight();
  const { binaryPort, textPort } = await allocPorts();
  const args = buildProbeArgs({ binaryPort, textPort });
  const env = bootEnv("tracer");
  log(`TRACER_SPAWN ${VICE_STOCK} ${args.join(" ")}`);
  spawnVice(VICE_STOCK, args, { env });

  const binClient = new ViceMonitorClient();
  const textClient = new TextMonitorClient();
  let zapOk = false;
  let showParsed = false;
  let entries = 0;
  let executeEntries = 0;

  try {
    await connectWithRetry(binClient, binaryPort);
    await pingReady(binClient);
    await connectWithRetry(textClient, textPort);

    // Zap while the machine is still halted from launch (mirrors the A/B's
    // own "clear the bracket before anything runs" placement).
    await withTextChannelLock("tracer-zap", async () => {
      await textClient.command("memmapzap");
      zapOk = true;
    });
    log(`TRACER_ZAP_OK ${zapOk}`);

    // Free-run briefly so memmapshow has something real to report. Exactly
    // one resume, then nothing else sent to either monitor for the duration
    // of the free-run window (probe-harness.mjs's own resumeExecution()
    // header comment: sending any further command re-halts the machine).
    await resumeExecution(binClient);
    await sleep(3000);

    // Dialing memmapshow itself halts the machine again (the text monitor
    // halts on command, same as the binary side) -- this is the read.
    await withTextChannelLock("tracer-show", async () => {
      const reply = await textClient.command("memmapshow");
      const parsed = parseAccessMap(reply);
      if (!parsed.ok) {
        throw new Error(`memmapshow parse refusal: ${JSON.stringify(parsed.refusal)}`);
      }
      showParsed = true;
      entries = parsed.value.entries.length;
      executeEntries = parsed.value.entries.filter((e) => e.ram.execute || e.rom.execute || e.io.execute).length;
    });
    log(`TRACER_SHOW_PARSED ${showParsed}`);
    log(`TRACER_ENTRIES ${entries}`);
    log(`TRACER_EXECUTE_ENTRIES ${executeEntries}`);
  } finally {
    await textClient.disconnect().catch(() => {});
    try {
      binClient.disconnect?.();
    } catch {}
    reapAll();
  }
}

// --- CLI ----------------------------------------------------------------------

const cliArgs = process.argv.slice(2);
if (cliArgs.includes("--tracer")) {
  await runTracer();
} else {
  process.stderr.write(
    "usage: node evid06-instrumentation-ab.mjs --tracer   (the full A/B is Task 2 of this plan)\n",
  );
  process.exitCode = 1;
}
