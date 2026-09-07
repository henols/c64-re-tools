#!/usr/bin/env node
// -----------------------------------------------------------------------------
// cross-channel-resume-probe.mjs -- Phase 39, plan 39-04 (`CHAN-01`).
//
// WHAT THIS MEASURES
// -------------------
// `CROSS_CHANNEL_RESUME`: can a halt taken on ONE channel be read and
// released from the OTHER, in both directions? `SCHEMA.md` §2.4 is the
// binding derivation this script implements; it is not softened here.
//
// Direction one -- halt on TEXT, read and resume from BINARY:
//   Read the text-side monotonic cycle counter (`sw`) BEFORE anything else --
//   this command is itself the halting act (per the live-probe note, ANY
//   text-monitor command halts the machine until an explicit `x`). While
//   held halted, over the BINARY channel: read registers (REGISTERS_GET) and
//   a small memory window with side effects off (MEMORY_GET), then send the
//   binary resume opcode (EXIT, 0xaa). Wait >=1s, then read `sw` again on the
//   text channel. `clean` iff both binary reads succeeded, the resume was
//   accepted, and the text-side counter advanced between the two readings --
//   a monitor accepting a resume is not evidence the machine ran.
//
// Direction two -- halt on BINARY, read and resume from TEXT:
//   Arm a STOPPING exec checkpoint (stop_when_hit=true) at the frame anchor
//   -- a halt the binary client owns, waited on by the checkpoint's OWN
//   unsolicited hit event, never by a paused-state flag. Once halted, over
//   the TEXT channel: read the cycle counter and a register view, then send
//   the text monitor's exit (`x`) to release. Confirm resumption from the
//   BINARY channel via a SEPARATE non-stopping checkpoint's hit count
//   advancing across a passive bracket (mirroring 39-04 Task 1's corrected,
//   passive-only discipline -- an explicit CHECKPOINT_GET poll would
//   re-halt the CPU and manufacture a false reading, exactly as it did in
//   that task's first, voided run).
//
// Both directions are taken twice against ONE live instance. A disagreement
// between the two directions resolves to the WORSE value, never averaged,
// never smoothed, with both transcripts retained (README.md convention 6,
// this plan's own prohibitions).
//
// Every wire body this file sends comes from probe-harness.mjs's shipped-
// encoder re-exports (D-14); this file builds no frame itself. It spawns
// genuine stock x64sc DIRECTLY (D-12), touching no broker state whatsoever.
// -----------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import {
  CommandType,
  PROBE_DIR,
  VICE_STOCK,
  ViceMonitorClient,
  allocPorts,
  armNonStoppingExec,
  armStoppingExec,
  awaitFirstCheckpointHit,
  buildProbeArgs,
  connectWithRetry,
  deleteCheckpoint,
  log,
  memGetBody,
  memspaceBody,
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

const FRAME_ANCHOR = 0xea31;
const MEMSPACE_MAIN = 0x00;
/** A small, side-effect-free memory window read while halted -- content is
 * not compared to anything; only success/failure matters here. */
const SMALL_WINDOW_START = 0xe000;
const SMALL_WINDOW_END = 0xe00f;
/** Fixed passive-observation window for direction two's post-release
 * "machine running again" bracket. */
const BRACKET_WINDOW_MS = 1000;
/** Both directions are taken this many times against one live instance. */
const REPETITIONS = 2;

/** `Stopwatch:   <digits>` -- the text monitor's own monotonic cycle counter,
 * per .planning/notes/text-monitor-channel-live-probe.md's observed shape. */
const STOPWATCH_RE = /Stopwatch:\s*(\d+)/;

function parseStopwatch(text) {
  const m = STOPWATCH_RE.exec(text);
  return m ? Number(m[1]) : null;
}

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

async function main() {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const record = (line) => log(line);

  log(`PROBE cross-channel-resume-probe.mjs`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`DATE_UTC ${new Date().toISOString()}`);

  // Step 1: preflight, refused in code (D-16).
  const pf = preflight();
  record(`BROKER_STATE: ${pf.broker}`);

  // Step 2: allocate two ports, build argv, spawn stock baseline directly.
  const { binaryPort, textPort } = await allocPorts();
  log(`BINARY_PORT ${binaryPort}`);
  log(`TEXT_PORT ${textPort}`);
  const argv = buildProbeArgs({ binaryPort, textPort, headless: true, swapMonitorOrder: false });
  log(`SPAWN_ARGV ${JSON.stringify([VICE_STOCK, ...argv])}`);

  const kind = viceKind(VICE_STOCK);
  const version = viceVersion(VICE_STOCK);
  record(`VICE_BINARY: ${kind}:${VICE_STOCK}`);
  record(`VICE_VERSION_OBSERVED: ${version}`);

  const child = spawnVice(VICE_STOCK, argv);
  let childStderr = "";
  child.stderr.on("data", (d) => {
    childStderr += d.toString();
  });
  child.stdout.on("data", () => {});

  const binClient = new ViceMonitorClient();
  let textSock = null;
  let crossChannelResume = null;
  let crossChannelResumeReason = null;

  const eventLog = [];
  const t0 = Date.now();
  const onAnyEvent = (frame) => {
    eventLog.push({ tMs: Date.now() - t0, type: frame.type, requestId: frame.requestId });
  };
  const onDesync = (err) => {
    eventLog.push({ tMs: Date.now() - t0, type: "desync", message: err.message });
  };
  const onProtocolError = (err) => {
    eventLog.push({ tMs: Date.now() - t0, type: "protocol-error", message: err.message });
  };
  const onTransportError = (err) => {
    eventLog.push({ tMs: Date.now() - t0, type: "transport-error", message: err.message });
  };

  // A single passive hit counter, retargeted per checkpoint id as needed --
  // mirrors 39-04 Task 1's corrected, passive-only discipline: NO explicit
  // CHECKPOINT_GET poll is ever used to observe "is it still running".
  let watchedCheckpointId = null;
  let watchedHits = 0;
  const onCheckpointHit = (frame) => {
    if (frame.type === "checkpoint_info" && frame.checkpoint.id === watchedCheckpointId) watchedHits += 1;
  };
  async function passiveWindow(ms) {
    watchedHits = 0;
    await sleep(ms);
    return watchedHits;
  }

  const direction1Runs = [];
  const direction2Runs = [];

  try {
    const binBindMs = await connectWithRetry(binClient, binaryPort, { budgetMs: 60000 });
    log(`BINARY_TIME_TO_BIND_MS ${binBindMs}`);
    binClient.on("event", onAnyEvent);
    binClient.on("event", onCheckpointHit);
    binClient.on("desync", onDesync);
    binClient.on("protocol-error", onProtocolError);
    binClient.on("transport-error", onTransportError);
    await sleep(300);
    const pingAttempts = await pingReady(binClient);
    log(`BINARY_MONITOR_READY_AFTER_PINGS ${pingAttempts}`);

    // One non-stopping "is the machine alive at all" anchor, armed once and
    // reused across the whole run for boot-settle and for direction two's
    // post-release confirmation. A stock x64sc launched with -console plus
    // monitor flags starts CPU-HALTED (39-03's discovery); this ONE EXIT is
    // the only unconditional binary command sent before any bracket.
    const aliveAnchor = await armNonStoppingExec(binClient, { address: FRAME_ANCHOR });
    const aliveAnchorId = aliveAnchor.checkpoint.id;
    watchedCheckpointId = aliveAnchorId;
    log(`ALIVE_ANCHOR_CHECKPOINT_ID ${aliveAnchorId}`);

    await resumeExecution(binClient);
    log(`RESUMED_ONCE_FOR_BOOT_SETTLE`);

    const bootWait = await awaitFirstCheckpointHit(binClient, aliveAnchorId, { budgetMs: 30000 });
    log(`ALIVE_ANCHOR_FIRST_HIT ${JSON.stringify(bootWait)}`);
    if (!bootWait.hit) {
      crossChannelResume = "not-taken";
      crossChannelResumeReason = "the alive-anchor checkpoint never recorded its first hit within the boot-settle budget -- the machine could not be confirmed running before either direction was attempted";
      record(`VOID: ${crossChannelResumeReason}`);
    }

    if (crossChannelResume === null) {
      const { sock, ms: textBindMs } = await connectTextMonitorWithRetry(textPort, { budgetMs: 30000 });
      textSock = sock;
      log(`TEXT_TIME_TO_BIND_MS ${textBindMs}`);
      const bannerObs = await awaitBanner(textSock, { timeoutMs: 3000 });
      log(`TEXT_BANNER_MATCHED_PROMPT ${bannerObs.matchedPromptRe} len=${bannerObs.raw.length}`);

      for (let rep = 1; rep <= REPETITIONS; rep += 1) {
        // ================= DIRECTION ONE: halt on TEXT, resume from BINARY =================
        log(`=== direction one, repetition ${rep} of ${REPETITIONS} ===`);
        const d1 = { rep, direction: "text-halt-binary-resume" };
        try {
          // Halt from the text channel: `sw` is itself the halting act (any
          // command received traps the monitor) AND the reading we need.
          const swBeforeResult = await sendAndAwaitPrompt(textSock, "sw", { timeoutMs: 10000 });
          d1.swBeforeMatched = swBeforeResult.matchedPromptRe;
          d1.swBeforeText = swBeforeResult.text.trim();
          d1.swBefore = parseStopwatch(swBeforeResult.text);
          log(`D1_SW_BEFORE matched=${d1.swBeforeMatched} value=${d1.swBefore}`);

          if (!d1.swBeforeMatched || d1.swBefore === null) {
            d1.status = "not-taken";
            d1.reason = "the text-side halt (via `sw`) could not be established -- no framed reply or no parseable stopwatch value";
            log(`D1_STATUS not-taken: ${d1.reason}`);
          } else {
            // While held halted by the text channel: read registers and a
            // small memory window over the BINARY channel. Deliberately NOT
            // a `continue` above -- direction two still runs this
            // repetition regardless of direction one's outcome; each
            // direction's own halt-establishment failure is independent.
            const desyncBefore = binClient.counters.desyncBytes;
            const dupBefore = binClient.counters.duplicateReplies;
            let registersOk = false;
            let memoryOk = false;
            try {
              const regReply = await binClient.send(CommandType.RegistersGet, memspaceBody({ memspace: MEMSPACE_MAIN }));
              registersOk = regReply.type === "registers" && Array.isArray(regReply.registers) && regReply.registers.length > 0;
              log(`D1_REGISTERS_READ_WHILE_HALTED ok=${registersOk} count=${regReply.registers?.length}`);
            } catch (err) {
              log(`D1_REGISTERS_READ_FAILED ${err.message}`);
            }
            try {
              const memReply = await binClient.send(
                CommandType.MemoryGet,
                memGetBody({ sidefx: false, start: SMALL_WINDOW_START, end: SMALL_WINDOW_END, memspace: MEMSPACE_MAIN }),
              );
              memoryOk = memReply.type === "memory_get" && memReply.bytes.length === SMALL_WINDOW_END - SMALL_WINDOW_START + 1;
              log(`D1_MEMORY_READ_WHILE_HALTED ok=${memoryOk} len=${memReply.bytes?.length} hex=${Buffer.from(memReply.bytes ?? []).toString("hex")}`);
            } catch (err) {
              log(`D1_MEMORY_READ_FAILED ${err.message}`);
            }
            d1.registersOk = registersOk;
            d1.memoryOk = memoryOk;

            // Resume from the BINARY channel.
            let resumeAccepted = false;
            try {
              await resumeExecution(binClient);
              resumeAccepted = true;
            } catch (err) {
              log(`D1_RESUME_FAILED ${err.message}`);
            }
            d1.resumeAccepted = resumeAccepted;
            log(`D1_RESUME_ACCEPTED ${resumeAccepted}`);

            const desyncAfter = binClient.counters.desyncBytes;
            const dupAfter = binClient.counters.duplicateReplies;
            d1.desyncDelta = desyncAfter - desyncBefore;
            d1.duplicateDelta = dupAfter - dupBefore;

            // Wait >=1s, then read the text-side counter again -- the
            // independent liveness signal. This `sw` also re-halts the
            // machine via the text channel (expected, harmless here: we only
            // need the counter to have advanced).
            await sleep(1200);
            const swAfterResult = await sendAndAwaitPrompt(textSock, "sw", { timeoutMs: 10000 });
            d1.swAfterMatched = swAfterResult.matchedPromptRe;
            d1.swAfter = parseStopwatch(swAfterResult.text);
            log(`D1_SW_AFTER matched=${d1.swAfterMatched} value=${d1.swAfter}`);
            d1.machineRanAgain = d1.swAfterMatched && d1.swAfter !== null && d1.swBefore !== null && d1.swAfter > d1.swBefore;
            log(`D1_MACHINE_RAN_AGAIN ${d1.machineRanAgain}`);

            // Release the halt this second `sw` induced, so direction two
            // (and the next repetition) starts from a running machine again.
            await sendAndAwaitPrompt(textSock, "x", { timeoutMs: 10000 });

            if (d1.desyncDelta !== 0 || d1.duplicateDelta !== 0) {
              d1.status = "corrupts";
              d1.reason = `binary client counters moved during the window: desyncDelta=${d1.desyncDelta}, duplicateDelta=${d1.duplicateDelta}`;
            } else if (!registersOk || !memoryOk || !resumeAccepted || !d1.machineRanAgain) {
              d1.status = "corrupts";
              d1.reason = `registersOk=${registersOk} memoryOk=${memoryOk} resumeAccepted=${resumeAccepted} machineRanAgain=${d1.machineRanAgain}`;
            } else {
              d1.status = "clean";
            }
          }
          direction1Runs.push(d1);
          record(
            `DIRECTION1_REP_${rep}: status=${d1.status} registersOk=${d1.registersOk} memoryOk=${d1.memoryOk} resumeAccepted=${d1.resumeAccepted} swBefore=${d1.swBefore} swAfter=${d1.swAfter} machineRanAgain=${d1.machineRanAgain} desyncDelta=${d1.desyncDelta} dupDelta=${d1.duplicateDelta}`,
          );
        } catch (err) {
          d1.status = "corrupts";
          d1.reason = `unexpected error: ${err.message}`;
          direction1Runs.push(d1);
          record(`DIRECTION1_REP_${rep}: status=corrupts (unexpected error: ${err.message})`);
        }

        // ================= DIRECTION TWO: halt on BINARY, resume from TEXT =================
        log(`=== direction two, repetition ${rep} of ${REPETITIONS} ===`);
        const d2 = { rep, direction: "binary-halt-text-resume" };
        let stopAnchorId = null;
        try {
          // Arm a STOPPING checkpoint -- a halt the binary client owns.
          // Arming it is itself a binary command, which -- per the same
          // rule 39-04 Task 1 already measured (any command reaching the
          // monitor halts the CPU) -- halts the machine again, so an
          // explicit resume is required afterward exactly as after any
          // other command. Confirmed empirically while building this
          // probe: without this resume, the stopping checkpoint's hit
          // never arrived within a 15s budget because the CPU never ran
          // again to reach it, producing a false not-taken that had
          // nothing to do with the checkpoint itself.
          const stopAnchor = await armStoppingExec(binClient, { address: FRAME_ANCHOR });
          stopAnchorId = stopAnchor.checkpoint.id;
          watchedCheckpointId = stopAnchorId;
          log(`D2_STOP_ANCHOR_ID ${stopAnchorId}`);
          await resumeExecution(binClient);
          log(`D2_RESUMED_AFTER_ARMING_STOP`);

          // Wait for the stopping checkpoint's OWN unsolicited hit --
          // never a paused-state flag.
          const stopWait = await awaitFirstCheckpointHit(binClient, stopAnchorId, { budgetMs: 15000 });
          log(`D2_STOP_ANCHOR_HIT ${JSON.stringify(stopWait)}`);

          if (!stopWait.hit) {
            d2.status = "not-taken";
            d2.reason = "the stopping checkpoint never recorded its hit within budget -- no binary-owned halt could be established";
            direction2Runs.push(d2);
            record(`DIRECTION2_REP_${rep}: status=not-taken (${d2.reason})`);
            try {
              await deleteCheckpoint(binClient, stopAnchorId);
            } catch {}
            continue;
          }

          // Halted by the binary client's own stopping checkpoint. This
          // halt is itself visible on the TEXT channel -- confirmed live
          // while building this probe -- as an UNSOLICITED "monitor
          // entered" announcement (the same trace + stop-notification
          // banner a text console prints for any halt, from EITHER
          // channel), pushed the moment the checkpoint hits, before this
          // client sends anything. `textmon-probe-client.mjs`'s crude
          // framing (D-13, documented in its own header as NOT
          // distinguishing an unsolicited push from a command's own reply)
          // would otherwise conflate that banner with our next command's
          // reply, since both happen to end in the same prompt-shaped
          // string -- drain it explicitly first via awaitBanner(), exactly
          // as `idle-coexist-probe.mjs`'s "capture before trusting" step
          // does for the connect banner.
          const drained = await awaitBanner(textSock, { timeoutMs: 3000 });
          d2.drainedEntryBannerMatched = drained.matchedPromptRe;
          d2.drainedEntryBannerLen = drained.raw.length;
          log(`D2_DRAINED_ENTRY_BANNER matched=${drained.matchedPromptRe} len=${drained.raw.length}`);

          // Over the TEXT channel: read the cycle counter and a register view.
          const desyncBefore = binClient.counters.desyncBytes;
          const dupBefore = binClient.counters.duplicateReplies;

          const swResult = await sendAndAwaitPrompt(textSock, "sw", { timeoutMs: 10000 });
          d2.swMatched = swResult.matchedPromptRe;
          d2.sw = parseStopwatch(swResult.text);
          log(`D2_TEXT_SW matched=${d2.swMatched} value=${d2.sw}`);

          const regResult = await sendAndAwaitPrompt(textSock, "r", { timeoutMs: 10000 });
          d2.registerViewMatched = regResult.matchedPromptRe;
          d2.registerViewLen = regResult.raw.length;
          log(`D2_TEXT_REGISTER_VIEW matched=${d2.registerViewMatched} len=${d2.registerViewLen}`);

          d2.textReadsOk = Boolean(d2.swMatched) && d2.sw !== null && Boolean(d2.registerViewMatched) && d2.registerViewLen > 0;

          // Retire the stopping checkpoint BEFORE releasing from the text
          // channel -- not after. Deleting it is itself a binary command,
          // which is safe to send while the machine is still halted (it
          // does not require the CPU running and, unlike EXIT, does not
          // resume it either). If deleted only AFTER `x`, there is a race:
          // the machine could resume and re-hit this SAME stopping
          // checkpoint before the delete command arrives, halting it again
          // for a reason that has nothing to do with the text channel and
          // manufacturing a false "machine did not resume" reading -- the
          // exact class of self-inflicted artifact 39-04 Task 1's first,
          // voided run already taught this plan to guard against.
          await deleteCheckpoint(binClient, stopAnchorId);

          // Release from the TEXT channel. `x`'s own reply commonly fails
          // to frame within budget here (recorded as exitMatched=false, not
          // gated on below): the alive-anchor checkpoint is STILL ARMED and
          // resumes trace-flooding the text console the instant the CPU
          // runs again -- the identical, already-understood phenomenon
          // 39-04 Task 1 recorded for its own `x` release
          // (TEXT_RELEASE_MATCHED_PROMPT: false in every repetition there
          // too). The authoritative "did it resume" answer is the
          // independent binary-side passive bracket below, exactly as
          // SCHEMA.md §2.4 requires -- "a monitor accepting a resume is not
          // evidence the machine ran" cuts both ways: neither is a monitor
          // NOT framing a reply evidence that it didn't.
          const exitResult = await sendAndAwaitPrompt(textSock, "x", { timeoutMs: 10000 });
          d2.exitMatched = exitResult.matchedPromptRe;
          log(`D2_TEXT_EXIT matched=${d2.exitMatched}`);

          // Confirm from the BINARY channel that the machine is running
          // again, via a SEPARATE non-stopping checkpoint's hit count
          // advancing across a passive bracket. Retarget the shared passive
          // counter at the alive-anchor (still armed throughout).
          watchedCheckpointId = aliveAnchorId;
          const postReleaseHits = await passiveWindow(BRACKET_WINDOW_MS);
          d2.machineRanAgain = postReleaseHits > 0;
          log(`D2_POST_RELEASE_HITS ${postReleaseHits} machineRanAgain=${d2.machineRanAgain}`);

          const desyncAfter = binClient.counters.desyncBytes;
          const dupAfter = binClient.counters.duplicateReplies;
          d2.desyncDelta = desyncAfter - desyncBefore;
          d2.duplicateDelta = dupAfter - dupBefore;

          if (d2.desyncDelta !== 0 || d2.duplicateDelta !== 0) {
            d2.status = "corrupts";
            d2.reason = `binary client counters moved during the window: desyncDelta=${d2.desyncDelta}, duplicateDelta=${d2.duplicateDelta}`;
          } else if (!d2.textReadsOk || !d2.machineRanAgain) {
            d2.status = "corrupts";
            d2.reason = `textReadsOk=${d2.textReadsOk} machineRanAgain=${d2.machineRanAgain} (exitMatched=${d2.exitMatched}, recorded but not gated on -- see the comment above the "x" send)`;
          } else {
            d2.status = "clean";
          }
          direction2Runs.push(d2);
          record(
            `DIRECTION2_REP_${rep}: status=${d2.status} textReadsOk=${d2.textReadsOk} sw=${d2.sw} exitMatched=${d2.exitMatched} machineRanAgain=${d2.machineRanAgain} desyncDelta=${d2.desyncDelta} dupDelta=${d2.duplicateDelta}`,
          );
        } catch (err) {
          d2.status = "corrupts";
          d2.reason = `unexpected error: ${err.message}`;
          direction2Runs.push(d2);
          record(`DIRECTION2_REP_${rep}: status=corrupts (unexpected error: ${err.message})`);
          if (stopAnchorId !== null) {
            try {
              await deleteCheckpoint(binClient, stopAnchorId);
            } catch {}
          }
        } finally {
          watchedCheckpointId = aliveAnchorId;
        }
      }

      try {
        await deleteCheckpoint(binClient, aliveAnchorId);
      } catch {}

      // ---- Derivation ----
      // Per-direction aggregate over its own repetitions: `clean` requires
      // EVERY repetition to have read clean; a single `corrupts` anywhere
      // makes the whole direction `corrupts`; a `not-taken` repetition
      // alongside at least one real (clean/corrupts) repetition is a
      // partial data loss, not grounds to call the WHOLE direction
      // not-taken (that is reserved for "no halt could be established at
      // all") -- it cannot support `clean` either, so it is folded into
      // `corrupts`, the worse of the two remaining admissible values.
      function directionOverall(runs) {
        if (runs.length === 0) return "not-taken";
        const statuses = runs.map((r) => r.status);
        if (statuses.every((s) => s === "not-taken")) return "not-taken";
        if (statuses.every((s) => s === "clean")) return "clean";
        return "corrupts";
      }

      const direction1Overall = directionOverall(direction1Runs);
      const direction2Overall = directionOverall(direction2Runs);

      record(`DIRECTION1_OVERALL: ${direction1Overall}`);
      record(`DIRECTION2_OVERALL: ${direction2Overall}`);

      if (direction1Overall !== direction2Overall) {
        record(
          `## DIVERGENCE: direction one (text-halt, binary-resume) read ${direction1Overall}; direction two (binary-halt, text-resume) read ${direction2Overall}. Resolving to the worse value.`,
        );
      }

      // Combine the two directions: `not-taken` overall only if BOTH
      // directions could not be established at all; otherwise a direction
      // that individually read `not-taken` cannot support `clean` for the
      // combined result either, so it folds into `corrupts` there too.
      if (direction1Overall === "not-taken" && direction2Overall === "not-taken") {
        crossChannelResume = "not-taken";
        crossChannelResumeReason = "neither direction could establish a halt to originate from";
      } else {
        const effective = [direction1Overall, direction2Overall].map((c) => (c === "not-taken" ? "corrupts" : c));
        crossChannelResume = effective.includes("corrupts") ? "corrupts" : "clean";
      }
    }
  } catch (err) {
    log(`PROBE_ERROR ${err.stack ?? err.message}`);
    if (crossChannelResume === null) {
      crossChannelResume = "not-taken";
      crossChannelResumeReason = `an unexpected error was thrown before either direction could be evaluated: ${err.message}`;
      record(`VOID: ${crossChannelResumeReason}`);
    }
  } finally {
    binClient.off("event", onAnyEvent);
    binClient.off("event", onCheckpointHit);
    binClient.off("desync", onDesync);
    binClient.off("protocol-error", onProtocolError);
    binClient.off("transport-error", onTransportError);
    try {
      await closeTextMonitor(textSock);
    } catch {}
    try {
      await binClient.disconnect();
    } catch {}
    reapAll();
    await sleep(500);
    if (childStderr.trim()) log(`CHILD_STDERR ${childStderr.trim().split("\n").slice(0, 10).join(" | ")}`);
  }

  record(`CROSS_CHANNEL_RESUME: ${crossChannelResume}`);
  if (crossChannelResumeReason) log(`CROSS_CHANNEL_RESUME_REASON ${crossChannelResumeReason}`);

  log(`--- test:automated baseline ---`);
  const baseline = testAutomatedBaseline();
  record(`TEST_AUTOMATED_BASELINE: tests ${baseline.tests} / pass ${baseline.pass} / fail ${baseline.fail}`);
  record(`TEST_AUTOMATED_BASELINE_FILES: ${baseline.failingFiles.length ? baseline.failingFiles.join(", ") : "(none)"}`);

  const outPath = path.join(PROBE_DIR, "cross-channel-resume-run.json");
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        crossChannelResume,
        crossChannelResumeReason,
        direction1Runs,
        direction2Runs,
        eventLog,
        baseline,
      },
      null,
      2,
    )}\n`,
  );
  log(`RUN_RECORD ${outPath}`);

  return 0;
}

process.exitCode = await main().catch((err) => {
  log(`FATAL ${err.stack ?? err.message}`);
  return 1;
});
