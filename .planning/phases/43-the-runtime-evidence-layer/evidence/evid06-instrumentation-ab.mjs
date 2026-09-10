#!/usr/bin/env node
// -----------------------------------------------------------------------------
// evid06-instrumentation-ab.mjs -- Phase 43, plan 43-01 (`EVID-06`).
//
// WHAT THIS MEASURES, AND THE RULE FIXED BEFORE THE MEASUREMENT
// ---------------------------------------------------------------
// Does recording runtime evidence during v0.8.0's S3 anchor-counted
// AUTOSTART sequence perturb the frame-exact, byte-identical capture that
// sequence produces through anchor hit 50? This phase keys its evidence rows
// by a reproducibility that instrumenting the run may itself destroy -- only
// a live A/B at the existing anchor sequence answers this, and the rule
// below is fixed BEFORE any run, exactly as 33-11's `frame-anchor-probe.mjs`
// fixed its own two-term-projection rule before measuring.
//
// PASS/FAIL RULE -- FIXED 2026-09-10, BEFORE ANY MEASUREMENT IS TAKEN
// ---------------------------------------------------------------------
// Fixed inputs, identical in both conditions: binary `/usr/bin/x64sc`
// (genuine unpatched stock, VICE 3.9 -- the fork at `/usr/local/bin/x64sc`
// shadows a bare `x64sc` and is never launched here); release
// `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64`,
// sha256 `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`;
// argv from `buildProbeArgs()` including `STOCK_DETERMINISM_FLAGS`
// unmodified, so the same `-seed`; zero pre-protocol jitter in every run;
// both monitor sockets connected in both conditions.
//
// Two conditions, at each of two anchor hit depths N in {10, 50}:
//
//   * Condition A, the control. The S3 sequence -- connect, arm a
//     non-temporary Exec checkpoint at $ea31 with stop:true while halted,
//     AUTOSTART with runAfter:true and fileIndex:0 on the release, count
//     CHECKPOINT_INFO hits to N with exactly one resume per observed hit,
//     REGISTERS_GET, DUMP. No RESET anywhere. The text socket is connected
//     and its banner drained, and NOTHING IS DIALED over it.
//   * Condition B, instrumented. Byte-identical to A except two dials over
//     the text channel: memmapzap during the halted pre-AUTOSTART window,
//     and memmapshow after the anchor stop at hit N and before DUMP.
//
// Both captures are sliced to flat 64K through the shipped vsf-slice.mjs
// CLI, port-normalised through normalisePorts() from each snapshot's own
// dirRead/dataRead, and compared with the shipped, unmodified
// compareCaptures(a, b, []) -- an EMPTY allow-list, because plan 33-03
// measured a pre-load frame-anchored stop as comparing equivalent with an
// empty allow-list at hits 1, 10 and 50.
//
//   * "no-perturbation" iff, at BOTH depths, compareCaptures().verdict is
//     "equivalent".
//   * "perturbation" iff at EITHER depth compareCaptures().verdict is
//     "not-equivalent".
//   * "not-exercised" iff a required input is absent, either condition
//     fails to reach the anchor stop at either depth, or the
//     control-of-the-control does not itself compare "equivalent".
//     "not-exercised" is NOT a pass: it forbids any claim of
//     "no-perturbation" and selects the "perturbation" labelling branch as
//     the conservative default.
//
// The control-of-the-control (A1 vs A2, both un-instrumented, at the same
// depth) is mandatory and runs first at each depth. Without it a
// "not-equivalent" A-versus-B result cannot be distinguished from baseline
// nondeterminism, and this repository's discipline is that a red with no
// green beside it is not a proof.
//
// FLAGGED ASSUMPTION -- the A/B does not isolate a toggle, and cannot
// -------------------------------------------------------------------
// EVID-06's wording is "turning the instrumentation on". VICE has no such
// toggle: `monitor_memmap_store()` records continuously and unconditionally
// once the binary carries `FEATURE_CPUMEMHISTORY` -- the same build flag
// `memmapshow` and `chis` already require -- and `memmapzap` is a full
// clear, not a pause. The recording therefore cannot be switched off on one
// arm. What this A/B measures is the observable difference this project can
// actually cause: the two extra text-monitor dials the evidence layer will
// issue on every instrumented run. A `no-perturbation` verdict licenses only
// the claim that this project's own instrumentation dials do not perturb
// frame-exactness at N of 50 or below -- it does not license a claim about
// `FEATURE_CPUMEMHISTORY` being absent, which no run in this phase can
// produce.
//
// WHAT NOT TO DO
// --------------
//   - Never re-derive binary resolution, port allocation, spawn/reap,
//     preflight, or connect-with-retry -- all of it comes from Phase 39's
//     `probe-harness.mjs`, imported below, never re-authored here.
//   - Never call `TextMonitorClient.command()` outside
//     `withTextChannelLock()` -- the shipped client itself refuses when the
//     text channel does not hold `channel-lock.ts`'s mutex (D-07).
//   - Never send RESET anywhere. AUTOSTART (0xdd) IS the power cycle
//     (`autostart.c:1437`); a RESET before or after it undoes the autostart
//     (33-03's own measured P11).
//   - Never poll on paused state, and never send more than one resume per
//     observed checkpoint hit (`vice-sync.ts`'s invariant, applied here per
//     wait rather than per count).
//   - Never write an artifact anywhere but this plan's own cache directory
//     under `$HOME/.cache/c64-re-tools/phase43/43-01/` -- never the system
//     temp directory (a 16 GiB RAM tmpfs with aging disabled on this host)
//     and never inside the checkout.
//   - Never choose the verdict by hand. It is derived in code, once, from
//     `compareCaptures().verdict` and printed as `DERIVED_EVID06_VERDICT`.
// -----------------------------------------------------------------------------
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// --- shipped seams (every wire body and helper this script uses comes from
// these imports, never retyped) -----------------------------------------------

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
const VSF_SLICE_CLI = path.join(REPO_ROOT, "src", "skills", "c64-ram-capture", "scripts", "vsf-slice.mjs");

const harness = await import(path.join(PHASE39_EVIDENCE, "probe-harness.mjs"));
const textProto = await import(path.join(MCP_DIR, "text-protocol.ts"));
const memmap = await import(path.join(MCP_DIR, "textmon-memmap.ts"));
const proto = await import(path.join(MCP_DIR, "stock-protocol.ts"));
const predicate = await import(path.join(MCP_DIR, "capture-predicate.ts"));

const {
  preflight,
  allocPorts,
  buildProbeArgs,
  spawnVice,
  connectWithRetry,
  pingReady,
  armStoppingExec,
  resumeExecution,
  reapAll,
  ViceMonitorClient,
  VICE_STOCK,
  sleep,
  log,
} = harness;
const { TextMonitorClient, withTextChannelLock } = textProto;
const { parseAccessMap } = memmap;
const { CommandType } = proto;

// --- fixed inputs (see PASS/FAIL RULE above) ---------------------------------

const RELEASE = path.join(
  REPO_ROOT,
  ".planning",
  "phases",
  "23-the-real-release-gate-go-degrade-no-go",
  "evidence",
  "corpus",
  "danish.d64",
);
const RELEASE_SHA256_EXPECTED = "1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5";
const FRAME_ANCHOR = 0xea31;
const MEMSPACE_MAIN = 0x00;
const DEPTHS = [10, 50];

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

// -----------------------------------------------------------------------------
// Task 2: the full A/B.
// -----------------------------------------------------------------------------

/** Resolve PC/LIN/CYC register ids BY NAME from the REGISTERS_AVAILABLE
 *  catalog -- wire ids are not stable across builds. Refuses by name if any
 *  of the three is absent. */
async function registerIds(client) {
  const reply = await client.send(CommandType.RegistersAvailable, proto.memspaceBody({ memspace: MEMSPACE_MAIN }));
  const byName = new Map(reply.registers.map((r) => [r.name.toUpperCase(), r.id]));
  for (const name of ["PC", "LIN", "CYC"]) {
    if (!byName.has(name)) {
      throw new Error(`register ${name} is absent from this build's REGISTERS_AVAILABLE catalog -- refusing`);
    }
  }
  return byName;
}

async function readRegisters(client, byName) {
  const reply = await client.send(CommandType.RegistersGet, proto.memspaceBody({ memspace: MEMSPACE_MAIN }));
  const byId = new Map(reply.registers.map((r) => [r.id, r.value]));
  const pick = (name) => {
    const id = byName.get(name);
    if (id === undefined || !byId.has(id)) {
      throw new Error(`register ${name} absent from this REGISTERS_GET reply -- refusing rather than zero-filling`);
    }
    return byId.get(id);
  };
  const out = { pc: pick("PC"), lin: pick("LIN"), cyc: pick("CYC") };
  for (const extra of ["00", "01"]) {
    const id = byName.get(extra);
    if (id !== undefined && byId.has(id)) out[extra] = byId.get(id);
  }
  return out;
}

/** Count `target` hits of checkpoint `cpId`, resuming EXACTLY once per
 *  observed hit -- keys on the checkpoint's own `hitCount` field carried on
 *  the unsolicited CHECKPOINT_INFO event, never on paused state. Mirrors
 *  `capture-pair.mjs`'s `countHits()` verbatim in shape. */
function countHits(client, cpId, target, { budgetMs = 180000 } = {}) {
  return new Promise((resolve) => {
    let last = 0;
    const resume = () => {
      client.send(CommandType.Exit, Buffer.alloc(0), { timeoutMs: 10000 }).catch(() => {});
    };
    const finish = (result) => {
      clearTimeout(timer);
      client.off("event", onEvent);
      resolve(result);
    };
    const onEvent = (frame) => {
      if (frame.type === "jam") {
        finish({ reached: false, hits: last, reason: "JAM (0x61, zero-length body) -- CPU jammed" });
        return;
      }
      if (frame.type !== "checkpoint_info" || frame.checkpoint.id !== cpId) return;
      last = frame.checkpoint.hitCount;
      if (last >= target) {
        finish({ reached: true, hits: last, reason: null });
        return;
      }
      resume();
    };
    const timer = setTimeout(
      () => finish({ reached: false, hits: last, reason: `budget ${budgetMs} ms exhausted at ${last} of ${target} hits` }),
      budgetMs,
    );
    client.on("event", onEvent);
    resume();
  });
}

/** Reach the flat 64K through the SHIPPED `vsf-slice` CLI entry point --
 *  never a hand-parsed snapshot offset. */
function sliceThroughShippedCli(vsfPath, outPath) {
  const argv = [VSF_SLICE_CLI, "slice", vsfPath, "--out", outPath, "--json"];
  log(`$ node ${argv.join(" ")}`);
  const run = spawnSync(process.execPath, argv, { encoding: "utf8" });
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.status !== 0) throw new Error(`vsf-slice exited ${run.status}: ${run.stderr || run.stdout}`);
  log(run.stdout.trim());
  return JSON.parse(run.stdout.trim());
}

/**
 * One full run of the S3 sequence, condition A (instrumented=false) or B
 * (instrumented=true), in the exact load-bearing order the PASS/FAIL RULE
 * above states. No RESET anywhere -- AUTOSTART is the only reset.
 */
async function takeRun({ label, target, instrumented }) {
  const releaseBytes = fs.readFileSync(RELEASE);
  const releaseSha = createHash("sha256").update(releaseBytes).digest("hex");
  if (releaseSha !== RELEASE_SHA256_EXPECTED) {
    throw new Error(`release identity REFUSAL: ${RELEASE} digests to ${releaseSha}, expected ${RELEASE_SHA256_EXPECTED}`);
  }

  const env = bootEnv(label);
  const { binaryPort, textPort } = await allocPorts();
  const args = buildProbeArgs({ binaryPort, textPort });
  const fullArgv = [VICE_STOCK, ...args];
  log(`RUN_LABEL ${label} instrumented=${instrumented} target=${target}`);
  log(`SPAWN_ARGV ${JSON.stringify(fullArgv)}`);
  spawnVice(VICE_STOCK, args, { env });

  const binClient = new ViceMonitorClient();
  const textClient = new TextMonitorClient();
  const record = { label, instrumented, target, vsfPath: null, entries: null };

  try {
    // 1. connect the binary monitor with retry; pingReady.
    await connectWithRetry(binClient, binaryPort);
    await pingReady(binClient);

    // 2. resolve register ids; refuse by name if PC/LIN/CYC is absent.
    const byName = await registerIds(binClient);

    // 3. connect the text monitor with retry (D-13(a): zero bytes on
    // connect, so there is no banner to explicitly drain beyond D-13(b)'s
    // own internal passive-drain machinery).
    await connectWithRetry(textClient, textPort);

    // 4. condition B only: dial memmapzap during the halted pre-AUTOSTART
    // window.
    if (instrumented) {
      await withTextChannelLock(`${label}-zap`, () => textClient.command("memmapzap"));
      log(`${label}: memmapzap dialed pre-AUTOSTART`);
    }

    // 5. arm a non-temporary Exec checkpoint at $ea31, stop:true, while
    // halted.
    const armed = await armStoppingExec(binClient, { address: FRAME_ANCHOR });
    const cpId = armed.checkpoint.id;
    log(`${label}: ARMED cp=${cpId} start=$${FRAME_ANCHOR.toString(16)}`);

    // 6. AUTOSTART -- THIS is the reset. No RESET appears anywhere.
    const as = await binClient.send(
      CommandType.AutoStart,
      proto.autostartBody({ runAfter: true, fileIndex: 0, filename: RELEASE }),
      { timeoutMs: 60000 },
    );
    log(`${label}: AUTOSTART err=0x${as.errorCode.toString(16).padStart(2, "0")}`);

    // 7. assert the anchor survived AUTOSTART's power cycle -- an
    // assertion, never an inference.
    const survived = await binClient.send(CommandType.CheckpointList, Buffer.alloc(0));
    if (survived.total === 0) {
      throw new Error(`${label}: the frame anchor did not survive AUTOSTART's power cycle`);
    }

    // 8-10. count hits to N, one resume per observed hit.
    const counted = await countHits(binClient, cpId, target);
    log(`${label}: COUNTED reached=${counted.reached} hits=${counted.hits} target=${target} reason=${counted.reason ?? "-"}`);
    if (!counted.reached) {
      throw new Error(`${label}: anchor hit count did not reach ${target}: ${counted.reason}`);
    }
    record.hits = counted.hits;

    // 11. REGISTERS_GET.
    const regs = await readRegisters(binClient, byName);
    record.registers = regs;
    log(`${label}: STOP PC=$${regs.pc.toString(16)} hits=${counted.hits} LIN=${regs.lin} CYC=${regs.cyc}`);

    // 12. condition B only: dial memmapshow after the anchor stop, before
    // DUMP; refuse on a parse failure rather than absorb a partial map.
    //
    // MEASURED, this plan (not previously documented): every monitor
    // command reaching EITHER channel while the machine is halted at the
    // anchor -- including the REGISTERS_GET just above, on an ALREADY
    // halted machine -- causes VICE to push a fresh, unsolicited
    // single-line status notification ("#1 (Stop on  exec ea31)  .../$..,
    // .../$..") to the TEXT console, exactly like Phase 39's own
    // `39-foreign-halt.md` finding that "a checkpoint... causes VICE's
    // monitor subsystem to print... to the text monitor console" -- except
    // here the trigger is any command on EITHER channel, not only a
    // checkpoint hit. `TextMonitorClient`'s own D-13(b) passive-banner-drain
    // machinery already consumes and discards this text correctly (it is
    // exactly what that machinery exists for), but it needs its quiescence
    // window (`TEXT_QUIESCENCE_MS`, 50ms) to elapse with nothing further
    // arriving before it finalizes the drain. Dialing memmapshow immediately
    // after REGISTERS_GET, with zero settle time, is a race the first live
    // run of this script actually hit: the residual status line was still
    // `#pending`-outstanding-adjacent when this script's own write()
    // landed, and it was captured as memmapshow's own (refused) reply. A
    // fixed settle window comfortably longer than the quiescence window
    // removes the race without touching the shipped drain logic itself.
    const TEXT_SETTLE_MS = 300;
    if (instrumented) {
      await sleep(TEXT_SETTLE_MS);
      await withTextChannelLock(`${label}-show`, async () => {
        const reply = await textClient.command("memmapshow");
        const parsed = parseAccessMap(reply);
        if (!parsed.ok) {
          throw new Error(`${label}: memmapshow parse refusal: ${JSON.stringify(parsed.refusal)}`);
        }
        record.entries = parsed.value.entries.length;
      });
      log(`${label}: memmapshow parsed, entries=${record.entries}`);
    }

    // 13. DUMP to this plan's cache directory.
    const vsfPath = path.join(CACHE_DIR, `${label}.vsf`);
    await binClient.send(CommandType.Dump, proto.dumpBody({ saveRoms: false, saveDisks: false, filename: vsfPath }), {
      timeoutMs: 90000,
    });
    const vsfSize = fs.existsSync(vsfPath) ? fs.statSync(vsfPath).size : 0;
    if (vsfSize === 0) throw new Error(`${label}: snapshot ${vsfPath} was not written`);
    record.vsfPath = vsfPath;
    record.vsfBytes = vsfSize;
  } finally {
    await textClient.disconnect().catch(() => {});
    try {
      binClient.disconnect?.();
    } catch {}
    reapAll();
  }

  // 14. slice through the shipped CLI, then port-normalise in code from
  // THIS snapshot's own dirRead/dataRead.
  const binPath = path.join(CACHE_DIR, `${label}.bin`);
  const slice = sliceThroughShippedCli(record.vsfPath, binPath);
  const raw = fs.readFileSync(binPath);
  const normalised = Buffer.from(predicate.normalisePorts(raw, { dirRead: slice.dirRead, dataRead: slice.dataRead }));
  const normPath = path.join(CACHE_DIR, `${label}.norm.bin`);
  fs.writeFileSync(normPath, normalised);
  record.binPath = binPath;
  record.normalisedPath = normPath;
  record.normalisedSha256 = createHash("sha256").update(normalised).digest("hex");
  log(`${label}: IMAGE_NORMALISED sha256=${record.normalisedSha256}`);
  return record;
}

/** Runs one physical launch and never lets a thrown refusal crash the whole
 *  A/B -- a failure to reach the anchor stop is exactly one of the named
 *  `not-exercised` causes, not an uncaught exception. */
async function safeTakeRun(opts) {
  try {
    const run = await takeRun(opts);
    return { ok: true, run };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log(`RUN_FAILED label=${opts.label} reason=${reason}`);
    return { ok: false, reason };
  }
}

/** Deletes the heavy per-run artifacts (.vsf, sliced .bin, .norm.bin) once a
 *  depth's comparisons have been taken -- this host's cache directory is not
 *  swept automatically and each snapshot is large. Only the sha256 values
 *  already logged above survive in the transcript. */
function cleanupRun(run) {
  if (!run) return;
  for (const p of [run.vsfPath, run.binPath, run.normalisedPath]) {
    if (p) fs.rmSync(p, { force: true });
  }
}

async function runFullAB() {
  preflight();
  const perDepth = {};

  for (const depth of DEPTHS) {
    const a1 = await safeTakeRun({ label: `d${depth}-a1`, target: depth, instrumented: false });
    const a2 = await safeTakeRun({ label: `d${depth}-a2`, target: depth, instrumented: false });
    const b1 = await safeTakeRun({ label: `d${depth}-b1`, target: depth, instrumented: true });

    if (!a1.ok || !a2.ok || !b1.ok) {
      const reason = [a1, a2, b1].find((r) => !r.ok)?.reason ?? "unknown run failure";
      perDepth[depth] = { failed: true, reason: `depth ${depth}: ${reason}` };
      for (const r of [a1, a2, b1]) if (r.ok) cleanupRun(r.run);
      continue;
    }

    const imgA1 = fs.readFileSync(a1.run.normalisedPath);
    const imgA2 = fs.readFileSync(a2.run.normalisedPath);
    const imgB1 = fs.readFileSync(b1.run.normalisedPath);

    const controlCmp = predicate.compareCaptures(imgA1, imgA2, []);
    const treatmentCmp = predicate.compareCaptures(imgA1, imgB1, []);

    log(`AB_CONTROL_VERDICT depth=${depth} ${controlCmp.verdict}`);
    log(`AB_TREATMENT_VERDICT depth=${depth} ${treatmentCmp.verdict}`);
    log(`AB_DIFFERING_COUNT depth=${depth} control=${controlCmp.differing.length} treatment=${treatmentCmp.differing.length}`);
    log(`AB_ALLOWED_COUNT depth=${depth} control=${controlCmp.allowed.length} treatment=${treatmentCmp.allowed.length}`);
    log(`-- control (A1 vs A2), depth ${depth} --`);
    log(predicate.formatComparison(controlCmp, 20));
    log(`-- treatment (A1 vs B1), depth ${depth} --`);
    log(predicate.formatComparison(treatmentCmp, 20));

    perDepth[depth] = { failed: false, controlCmp, treatmentCmp };

    cleanupRun(a1.run);
    cleanupRun(a2.run);
    cleanupRun(b1.run);
  }

  // Derive the verdict from the rule, never by hand.
  let notExercisedReason = null;
  for (const depth of DEPTHS) {
    const d = perDepth[depth];
    if (d.failed) {
      notExercisedReason = d.reason;
    } else if (d.controlCmp.verdict !== "equivalent") {
      notExercisedReason = `control-of-the-control (A1 vs A2) was not-equivalent at depth ${depth} -- a treatment result at this depth cannot be trusted`;
    }
  }

  let verdict;
  let cause = null;
  if (notExercisedReason) {
    verdict = "not-exercised";
    cause = notExercisedReason;
  } else if (DEPTHS.every((d) => perDepth[d].treatmentCmp.verdict === "equivalent")) {
    verdict = "no-perturbation";
  } else {
    verdict = "perturbation";
    const failingDepth = DEPTHS.find((d) => perDepth[d].treatmentCmp.verdict !== "equivalent");
    cause = `treatment (A1 vs B1) was not-equivalent at depth ${failingDepth}`;
  }

  log(`DERIVED_EVID06_VERDICT ${verdict}`);
  if (verdict !== "no-perturbation") {
    log(`DERIVED_EVID06_CAUSE ${cause}`);
  }
  const assumptionDeltaDecision = verdict === "no-perturbation" ? "no-change" : "promote";
  log(`DERIVED_ASSUMPTION_DELTA_DECISION ${assumptionDeltaDecision}`);

  return { verdict, cause, assumptionDeltaDecision, perDepth };
}

// --- CLI ----------------------------------------------------------------------

const cliArgs = process.argv.slice(2);
if (cliArgs.includes("--tracer")) {
  await runTracer();
} else {
  await runFullAB();
}
