#!/usr/bin/env node
// -----------------------------------------------------------------------------
// disconnect-recovery-probe.mjs -- Phase 39, plan 39-06 (`CHAN-01`,
// `DISCONNECT_RECOVERY`).
//
// WHAT THIS MEASURES
// -------------------
// Whether a halt held by an abruptly-killed TEXT client is ever released.
// `SCHEMA.md` section 2.5 is the binding derivation this script implements:
//
//   - `recovers`      within a stated 60s budget the machine is observed
//                     running again from the binary channel (a non-stopping
//                     checkpoint's hit_count advances) with NO further
//                     action of any kind.
//   - `leaves-halted` hit_count does not advance within the budget; a
//                     separate follow-up records whether a FRESH text
//                     connection plus `x` restores it, since that is the
//                     mechanism `R11`'s narrowing (D-10) names -- but that
//                     follow-up never changes the outcome line itself,
//                     because the frozen rule defines recovery as happening
//                     with NO further action.
//   - `not-taken`     the victim could not establish a halt at all.
//
// `DECISION-RULE.md`'s `R11` pre-mapped narrowing (D-10) was read in full
// BEFORE deriving the value below, per this plan's own requirement: a
// machine left permanently halted here is a MISSING MECHANISM, not proof of
// incompatibility -- the binary side's "connection close IS the release"
// (`broker-control.mts` ~line 522) has no known text-channel analogue, and
// only the broker outlives a killed client. This outcome, if reached, points
// AT the broker-lease shape Phase 41 must build, not away from coexistence.
//
// PASSIVE-ONLY DISCIPLINE, extended to the 60s recovery window
// --------------------------------------------------------------
// 39-04/39-05 both measured, live, that ANY command reaching the binary
// monitor -- not only EXIT -- re-halts the CPU once it is running, on this
// exact launch shape. An explicit "is it running" poll during the recovery
// window would therefore manufacture its own answer: sending a
// CHECKPOINT_GET to check whether the machine resumed would itself re-halt
// it the instant it had. Every liveness bracket in this probe -- the
// pre-victim confirmation, the post-victim confirmation, and the entire
// 60-second recovery series -- is therefore driven PURELY by the anchor
// checkpoint's own unsolicited CHECKPOINT_INFO pushes (no request from this
// client required), accumulated into a local counter and sampled at a fixed
// interval by a plain timer. No binary-channel command of any kind is sent
// between the pre-victim bracket and the follow-up step.
//
// THE VICTIM IS A SEPARATE PROCESS
// ---------------------------------
// textmon-kill-victim.mjs is spawned as a genuine child process and killed
// with SIGKILL -- never a same-process socket.destroy() -- because a clean
// application-level close exercises a release path a killed process cannot
// run, which is the whole distinction this experiment exists to draw.
//
// Reuses probe-harness.mjs and textmon-probe-client.mjs throughout (D-14):
// this file builds no wire frame itself and spawns genuine stock x64sc
// DIRECTLY (D-12), touching no broker state.
// -----------------------------------------------------------------------------
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROBE_DIR,
  VICE_STOCK,
  ViceMonitorClient,
  allocPorts,
  armNonStoppingExec,
  awaitFirstCheckpointHit,
  buildProbeArgs,
  connectWithRetry,
  deleteCheckpoint,
  log,
  pingReady,
  preflight,
  reapAll,
  resumeExecution,
  sleep,
  spawnVice,
  testAutomatedBaseline,
  viceKind,
  viceVersion,
} from "./probe-harness.mjs";
import { awaitBanner, closeTextMonitor, connectTextMonitor, sendAndAwaitPrompt } from "./textmon-probe-client.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VICTIM_SCRIPT = path.join(HERE, "textmon-kill-victim.mjs");

const FRAME_ANCHOR = 0xea31;
const PRE_VICTIM_WINDOW_MS = 1000;
const POST_VICTIM_WINDOW_MS = 1000;
const VICTIM_READY_BUDGET_MS = 15000;
const KILL_SIGNAL = "SIGKILL";
const RECOVERY_BUDGET_MS = 60000;
/** Cumulative sample points (ms since the kill) across the full budget.
 * Front-loaded finely (100ms steps out to 2s) so a near-instant recovery is
 * timed precisely rather than bucketed into a single "somewhere in the
 * first N seconds" reading, then coarser 5s steps out to the full 60s
 * budget -- still "no further action on either channel" throughout, since
 * every sample is a purely local read of the passively-accumulated
 * counter, never a network round trip. */
const POLL_SCHEDULE_MS = [100, 300, 600, 1000, 1500, 2000, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000];
const RUNS = 2;

/**
 * Retries a raw text-monitor connect within a budget -- ported from
 * foreign-halt-probe.mjs's own helper (not re-derived from scratch, same
 * body), used only for the leaves-halted follow-up's fresh connection.
 */
async function connectTextMonitorWithRetry(port, { budgetMs = 30000 } = {}) {
  const startedAt = Date.now();
  const deadline = startedAt + budgetMs;
  let lastErr = null;
  for (;;) {
    try {
      const sock = await connectTextMonitor(port, { timeoutMs: 5000 });
      return { sock, ms: Date.now() - startedAt };
    } catch (err) {
      lastErr = err;
      if (Date.now() >= deadline) {
        throw new Error(`text-monitor port ${port} never accepted a connection within ${budgetMs} ms: ${lastErr.message}`);
      }
      await sleep(150);
    }
  }
}

/** Spawn the victim as a genuine separate process; wait for its single
 * "VICTIM_READY" stdout line within a bounded budget. Never resolves on a
 * partial line; the parent reads stdout itself rather than trusting the
 * victim to do anything more than print that one line. */
function spawnVictim(textPort, { budgetMs = VICTIM_READY_BUDGET_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [VICTIM_SCRIPT, String(textPort)], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ child, ready: false, stdout, stderr, reason: `no VICTIM_READY line within ${budgetMs}ms` });
    }, budgetMs);
    child.stdout.on("data", (d) => {
      stdout += d.toString();
      if (!settled && /^VICTIM_READY /m.test(stdout)) {
        settled = true;
        clearTimeout(timer);
        resolve({ child, ready: true, stdout, stderr, readyLine: stdout.match(/^VICTIM_READY .*$/m)?.[0] ?? null });
      }
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ child, ready: false, stdout, stderr, reason: `victim exited early (code=${code}, signal=${signal}) before printing VICTIM_READY` });
    });
  });
}

/** Wait for the victim's own process 'exit' event, bounded. */
function awaitVictimExit(child, { budgetMs = 10000 } = {}) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve({ exited: true, code: child.exitCode, signal: child.signalCode });
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ exited: false, code: null, signal: null });
    }, budgetMs);
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exited: true, code, signal });
    });
  });
}

/**
 * One full run of the sequence: spawn a fresh emulator instance, establish
 * the victim's halt, kill it, poll for recovery, and (if leaves-halted) run
 * the fresh-connection follow-up. Returns a plain result object; never
 * throws for a within-experiment outcome (not-taken/leaves-halted are
 * recorded values, not exceptions) -- only an unexpected error propagates.
 */
async function runOnce(runIndex, record) {
  record(`=== RUN ${runIndex} of ${RUNS} ===`);

  const { binaryPort, textPort } = await allocPorts();
  log(`RUN_${runIndex}_BINARY_PORT ${binaryPort}`);
  log(`RUN_${runIndex}_TEXT_PORT ${textPort}`);
  const argv = buildProbeArgs({ binaryPort, textPort, headless: true });
  log(`RUN_${runIndex}_SPAWN_ARGV ${JSON.stringify([VICE_STOCK, ...argv])}`);

  if (runIndex === 1) {
    const kind = viceKind(VICE_STOCK);
    const version = viceVersion(VICE_STOCK);
    record(`VICE_BINARY: ${kind}:${VICE_STOCK}`);
    record(`VICE_VERSION_OBSERVED: ${version}`);
  }

  const emu = spawnVice(VICE_STOCK, argv);
  let emuStderr = "";
  emu.stderr.on("data", (d) => {
    emuStderr += d.toString();
  });
  emu.stdout.on("data", () => {});

  const binClient = new ViceMonitorClient();

  let anchorId = null;
  let anchorHits = 0;
  const onAnchorHit = (frame) => {
    if (frame.type === "checkpoint_info" && frame.checkpoint.id === anchorId) anchorHits += 1;
  };
  const eventLog = [];
  const t0 = Date.now();
  const onAnyEvent = (frame) => {
    eventLog.push({ tMs: Date.now() - t0, type: frame.type, requestId: frame.requestId });
  };

  /** Reset the passive counter, wait `ms`, return what accumulated -- sends
   * NO binary-channel command. Ported from foreign-halt-probe.mjs's own
   * passiveWindow(). */
  async function passiveWindow(ms) {
    anchorHits = 0;
    await sleep(ms);
    return anchorHits;
  }

  let victimChild = null;
  let outcome = null;
  let reason = null;
  const result = {
    runIndex,
    preVictimHits: null,
    victimReady: null,
    victimReadyLine: null,
    postVictimHits: null,
    killSignal: KILL_SIGNAL,
    victimExit: null,
    series: [],
    outcome: null,
    reason: null,
    followUp: null,
    voided: false,
  };

  try {
    const binBindMs = await connectWithRetry(binClient, binaryPort, { budgetMs: 60000 });
    log(`RUN_${runIndex}_BINARY_TIME_TO_BIND_MS ${binBindMs}`);
    binClient.on("event", onAnyEvent);
    binClient.on("event", onAnchorHit);
    await sleep(300);
    const pingAttempts = await pingReady(binClient);
    log(`RUN_${runIndex}_BINARY_MONITOR_READY_AFTER_PINGS ${pingAttempts}`);

    // Step 2: arm the non-stopping anchor checkpoint, resume once for the
    // boot settle, confirm the first hit. This is the LAST binary-channel
    // command sent until the pre-victim liveness bracket has been taken --
    // and, per the passive-only discipline above, no FURTHER binary command
    // is sent until the whole recovery window (including the leaves-halted
    // follow-up branch) has completed.
    const anchor = await armNonStoppingExec(binClient, { address: FRAME_ANCHOR });
    anchorId = anchor.checkpoint.id;
    log(`RUN_${runIndex}_ANCHOR_CHECKPOINT_ID ${anchorId}`);

    await resumeExecution(binClient);
    log(`RUN_${runIndex}_RESUMED_ONCE_FOR_BOOT_SETTLE`);

    const bootWait = await awaitFirstCheckpointHit(binClient, anchorId, { budgetMs: 30000 });
    log(`RUN_${runIndex}_ANCHOR_FIRST_HIT ${JSON.stringify(bootWait)}`);

    if (!bootWait.hit) {
      outcome = "not-taken";
      reason = "the anchor checkpoint never recorded its first hit within the boot-settle budget -- the liveness instrument could not be confirmed armed and hitting before the victim was even started";
      record(`VOID: run ${runIndex}: ${reason}`);
      result.voided = true;
    }

    if (outcome === null) {
      // Step 2 (continued): pre-victim liveness bracket -- the liveness
      // instrument for the whole experiment. If it is not advancing before
      // the victim starts, this run is void.
      const preVictimHits = await passiveWindow(PRE_VICTIM_WINDOW_MS);
      result.preVictimHits = preVictimHits;
      record(`PRE_VICTIM_LIVENESS_BRACKET_RUN_${runIndex}: hits=${preVictimHits}`);

      if (preVictimHits === 0) {
        outcome = "not-taken";
        reason = "the pre-victim liveness bracket recorded zero hits -- the liveness instrument was not confirmed advancing before the victim was started, so this run is void";
        record(`VOID: run ${runIndex}: ${reason}`);
        result.voided = true;
      }
    }

    if (outcome === null) {
      // Step 3: spawn the victim, bounded wait for its ready line.
      const spawned = await spawnVictim(textPort, { budgetMs: VICTIM_READY_BUDGET_MS });
      victimChild = spawned.child;
      log(`RUN_${runIndex}_VICTIM_STDOUT ${JSON.stringify(spawned.stdout)}`);
      if (spawned.stderr.trim()) log(`RUN_${runIndex}_VICTIM_STDERR ${JSON.stringify(spawned.stderr)}`);
      result.victimReady = spawned.ready;
      result.victimReadyLine = spawned.readyLine ?? null;
      record(`VICTIM_READY_RUN_${runIndex}: ${spawned.ready} ${spawned.readyLine ?? ""}`);

      if (!spawned.ready) {
        outcome = "not-taken";
        reason = spawned.reason ?? "the victim's ready line never arrived within budget -- the halt was never confirmed established";
        record(`VOID: run ${runIndex}: ${reason}`);
        result.voided = true;
      }
    }

    if (outcome === null) {
      // Step 4: confirm the halt from the binary side -- a bracket that now
      // shows zero advance where the pre-victim bracket showed a positive
      // one.
      const postVictimHits = await passiveWindow(POST_VICTIM_WINDOW_MS);
      result.postVictimHits = postVictimHits;
      record(`POST_VICTIM_LIVENESS_BRACKET_RUN_${runIndex}: hits=${postVictimHits} (pre-victim was ${result.preVictimHits})`);

      if (postVictimHits > 0) {
        outcome = "not-taken";
        reason = `the post-victim bracket recorded ${postVictimHits} hits despite the victim's ready line -- the halt was not confirmed on the binary side, so this run's halt could not be established as measured`;
        record(`VOID: run ${runIndex}: ${reason}`);
        result.voided = true;
      }
    }

    if (outcome === null) {
      // Step 5: terminate the victim with an uncatchable kill signal.
      const beforeKill = Date.now();
      victimChild.kill(KILL_SIGNAL);
      const exitInfo = await awaitVictimExit(victimChild, { budgetMs: 10000 });
      result.victimExit = { ...exitInfo, elapsedMs: Date.now() - beforeKill };
      record(`VICTIM_KILLED_RUN_${runIndex}: signal=${KILL_SIGNAL} exit=${JSON.stringify(result.victimExit)}`);

      // Step 6: poll for recovery across the full budget, with NO further
      // action on either channel. The series is sampled purely from the
      // locally-accumulated passive counter -- never a network read.
      const seriesStart = Date.now();
      anchorHits = 0;
      let lastElapsed = 0;
      for (const targetMs of POLL_SCHEDULE_MS) {
        const toSleep = targetMs - lastElapsed;
        if (toSleep > 0) await sleep(toSleep);
        const elapsed = Date.now() - seriesStart;
        result.series.push({ tMs: elapsed, cumulativeHits: anchorHits });
        lastElapsed = elapsed;
      }
      record(`RECOVERY_SERIES_RUN_${runIndex}: ${JSON.stringify(result.series)}`);

      const advanced = result.series.some((s) => s.cumulativeHits > 0);
      if (advanced) {
        const firstAdvance = result.series.find((s) => s.cumulativeHits > 0);
        outcome = "recovers";
        reason = `hit_count began advancing on its own at tMs=${firstAdvance.tMs} within the ${RECOVERY_BUDGET_MS}ms budget, with no further action on either channel`;
        record(`RECOVERY_OBSERVED_RUN_${runIndex}: first advance at tMs=${firstAdvance.tMs}`);
      } else {
        outcome = "leaves-halted";
        reason = `hit_count remained 0 across the full ${RECOVERY_BUDGET_MS}ms budget with no further action on either channel`;
        record(`NO_RECOVERY_OBSERVED_RUN_${runIndex}: series shows zero advance throughout`);

        // Step 7: the SEPARATE follow-up observation -- a fresh text
        // connection, an exit command, and whether the machine resumes.
        // This never changes the outcome line itself: the frozen rule
        // defines recovery as happening with NO further action.
        const followUp = { attempted: true, connected: false, exitSent: false, restored: false, error: null };
        try {
          const { sock, ms: textBindMs } = await connectTextMonitorWithRetry(textPort, { budgetMs: 15000 });
          followUp.connected = true;
          log(`RUN_${runIndex}_FOLLOWUP_TEXT_TIME_TO_BIND_MS ${textBindMs}`);
          const banner = await awaitBanner(sock, { timeoutMs: 10000 });
          log(`RUN_${runIndex}_FOLLOWUP_BANNER_HEX ${banner.raw.toString("hex")}`);
          const exitReply = await sendAndAwaitPrompt(sock, "x", { timeoutMs: 10000 });
          followUp.exitSent = true;
          log(`RUN_${runIndex}_FOLLOWUP_EXIT_MATCHED ${exitReply.matchedPromptRe} reply=${JSON.stringify(exitReply.text.slice(0, 200))}`);
          const followUpHits = await passiveWindow(1000);
          followUp.restored = followUpHits > 0;
          followUp.observedHits = followUpHits;
          record(`FOLLOWUP_RUN_${runIndex}: connected=${followUp.connected} exitSent=${followUp.exitSent} restored=${followUp.restored} observedHits=${followUpHits}`);
          await closeTextMonitor(sock);
        } catch (err) {
          followUp.error = err.message;
          record(`FOLLOWUP_RUN_${runIndex}_ERROR: ${err.message}`);
        }
        result.followUp = followUp;
      }
    }

    // Step 10 (partial, per run): retire the anchor checkpoint if it is
    // still readable -- best effort only, since a leaves-halted machine may
    // not answer at all. Not gate-relevant either way.
    try {
      await deleteCheckpoint(binClient, anchorId);
    } catch {}
  } catch (err) {
    log(`RUN_${runIndex}_PROBE_ERROR ${err.stack ?? err.message}`);
    if (outcome === null) {
      outcome = "not-taken";
      reason = `an unexpected error was thrown before the halt could be established or the recovery window measured: ${err.message}`;
      record(`VOID: run ${runIndex}: ${reason}`);
      result.voided = true;
    }
  } finally {
    binClient.off("event", onAnyEvent);
    binClient.off("event", onAnchorHit);
    // Reap the victim too, in case it somehow survived the kill above --
    // never leave an orphaned process, per this plan's own requirement.
    if (victimChild && victimChild.exitCode === null && victimChild.signalCode === null) {
      try {
        victimChild.kill("SIGKILL");
      } catch {}
    }
    try {
      await binClient.disconnect();
    } catch {}
    reapAll();
    await sleep(500);
    if (emuStderr.trim()) log(`RUN_${runIndex}_EMULATOR_STDERR ${emuStderr.trim().split("\n").slice(0, 10).join(" | ")}`);
  }

  result.outcome = outcome;
  result.reason = reason;
  result.eventLog = eventLog;
  record(`RUN_${runIndex}_OUTCOME: ${outcome} (${reason})`);
  return result;
}

/** Resolve the two runs' outcomes to one DISCONNECT_RECOVERY value. Where
 * they agree, that value is the answer. Where they disagree, the
 * disagreement is recorded loudly (README.md's voided-run convention
 * applied to a between-run disagreement, mirroring 39-04's own
 * CROSS_CHANNEL_RESUME "resolves to the worse value" rule) and the WORSE
 * admissible value wins: leaves-halted is worse than recovers. A voided
 * (not-taken) run never overrides a genuinely measured outcome from the
 * other run -- not-taken means "the experiment could not be taken", and if
 * the OTHER run took it, the experiment was in fact taken. Only if BOTH
 * runs are void does the final value read not-taken. */
function resolveOutcome(runs, record) {
  const measured = runs.filter((r) => r.outcome !== "not-taken");
  if (measured.length === 0) {
    record(`DISCONNECT_RECOVERY_RESOLUTION: both runs were not-taken -- final value is not-taken`);
    return { value: "not-taken", reason: runs.map((r) => r.reason).join(" | ") };
  }
  if (measured.length === 1) {
    record(`DISCONNECT_RECOVERY_RESOLUTION: one run was not-taken (${runs.find((r) => r.outcome === "not-taken").reason}); the surviving run's outcome (${measured[0].outcome}) is authoritative`);
    return { value: measured[0].outcome, reason: measured[0].reason };
  }
  const values = new Set(measured.map((r) => r.outcome));
  if (values.size === 1) {
    return { value: measured[0].outcome, reason: "both runs agreed" };
  }
  record(`DISCONNECT_RECOVERY_RESOLUTION: DISAGREEMENT between runs -- ${JSON.stringify(measured.map((r) => ({ run: r.runIndex, outcome: r.outcome })))}. Resolving to the WORSE admissible value (leaves-halted), never averaged.`);
  return { value: "leaves-halted", reason: "the two runs disagreed; resolved to the worse admissible value per this plan's own rule" };
}

async function main() {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const record = (line) => log(line);

  log(`PROBE disconnect-recovery-probe.mjs`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`DATE_UTC ${new Date().toISOString()}`);

  // Step 1: preflight, refused in code (D-16).
  const pf = preflight();
  record(`BROKER_STATE: ${pf.broker}`);

  const runs = [];
  for (let i = 1; i <= RUNS; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const r = await runOnce(i, record);
    runs.push(r);
  }

  const resolved = resolveOutcome(runs, record);
  record(`DISCONNECT_RECOVERY: ${resolved.value}`);
  log(`DISCONNECT_RECOVERY_REASON ${resolved.reason}`);

  log(`--- test:automated baseline ---`);
  const baseline = testAutomatedBaseline();
  record(`TEST_AUTOMATED_BASELINE: tests ${baseline.tests} / pass ${baseline.pass} / fail ${baseline.fail}`);
  record(`TEST_AUTOMATED_BASELINE_FILES: ${baseline.failingFiles.length ? baseline.failingFiles.join(", ") : "(none)"}`);

  const outPath = path.join(PROBE_DIR, "disconnect-recovery-run.json");
  fs.writeFileSync(outPath, `${JSON.stringify({ runs, resolved, baseline }, null, 2)}\n`);
  log(`RUN_RECORD ${outPath}`);

  return 0;
}

process.exitCode = await main().catch((err) => {
  log(`FATAL ${err.stack ?? err.message}`);
  return 1;
});
