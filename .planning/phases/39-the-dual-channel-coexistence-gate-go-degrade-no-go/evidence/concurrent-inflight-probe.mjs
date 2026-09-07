#!/usr/bin/env node
// -----------------------------------------------------------------------------
// concurrent-inflight-probe.mjs -- Phase 39, plan 39-05 (`CHAN-01`,
// `CONCURRENT_INFLIGHT`).
//
// WHAT THIS MEASURES
// -------------------
// `CONCURRENT_INFLIGHT`: whether two commands issued on the two DIFFERENT
// monitor channels, with BOTH socket writes performed before EITHER reply is
// awaited, interfere with one another. `SCHEMA.md` §2.3 is the binding
// derivation this script implements.
//
// THE HONEST CHARACTERISATION, STATED UP FRONT (this is what is and is not
// claimed): stock VICE services BOTH monitor servers from one single-threaded
// `monitor_vsync_hook()` poll loop (39-RESEARCH.md Open Question 2). True
// nanosecond-level, instruction-level simultaneity across two localhost
// sockets from two Node client objects in ONE process is not achievable from
// user space and is NOT what this probe claims to measure. What IS measured
// is the practical overlap that matters to a serialization-authority design:
// command B (the text channel's profiler report) is WRITTEN to its socket
// before channel A's in-flight command (the binary channel's single
// instruction advance) has been acknowledged by a reply. The actual
// wall-clock gap between the two `write()` calls is recorded
// (`CONCURRENT_WRITE_GAP_MS`) precisely so a reader can judge how tight that
// overlap really was -- a caveat, never a threshold (SCHEMA.md, README.md
// convention).
//
//   - `clean`      all six replies (3 reps x 2 channels) arrive within the
//                  15s budget, each matched to its own request, zero desync
//                  bytes, zero duplicate replies.
//   - `degraded`   every reply eventually arrives but at least one exceeded
//                  the budget, needed a retry, or the binary client counted
//                  (recovered) desync bytes.
//   - `corrupts`   a reply is lost, matched to the wrong request, resolved by
//                  an unsolicited event, or the machine jams.
//   - `not-taken`  the overlap could not be produced at all.
//
// Reuses probe-harness.mjs and textmon-probe-client.mjs throughout (D-14):
// this file builds no wire frame itself and spawns genuine stock x64sc
// DIRECTLY (D-12), touching no broker state.
// -----------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import {
  CommandType,
  PROBE_DIR,
  VICE_STOCK,
  ViceMonitorClient,
  advanceInstructionsBody,
  allocPorts,
  buildProbeArgs,
  connectWithRetry,
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

const VICE_BROADCAST_REQUEST_ID = 0xffffffff;
const OVERLAP_BUDGET_MS = 15000;
const RUN_WINDOW_MS = 600;
const REPETITIONS = 3;

/**
 * Retries a raw text-monitor connect within a budget (mirrors
 * connectWithRetry() but for the plain socket the throwaway text client
 * uses).
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

/** Whether a text-monitor reply looks like the command was not understood at
 * all (vs. a real profiler report), so an unsupported `prof` verb can be
 * detected and substituted rather than silently misread as a valid report. */
function looksUnsupported(text) {
  return /unimplemented|unknown command|not supported|no such command/i.test(text ?? "");
}

async function main() {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const record = (line) => log(line);

  log(`PROBE concurrent-inflight-probe.mjs`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`DATE_UTC ${new Date().toISOString()}`);

  const pf = preflight();
  record(`BROKER_STATE: ${pf.broker}`);

  const { binaryPort, textPort } = await allocPorts();
  log(`BINARY_PORT ${binaryPort}`);
  log(`TEXT_PORT ${textPort}`);
  const argv = buildProbeArgs({ binaryPort, textPort, headless: true });
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
  let concurrentInflight = null;
  let concurrentInflightReason = null;
  let profilerCommand = "prof flat 5";
  let profilerEnableCommand = "prof on";
  let substitutionReason = null;
  const repResults = [];
  const writeGapsMs = [];

  try {
    // Step 2: connect both channels with retry. Response/event/desync/
    // protocol-error/transport-error listeners registered FIRST, with
    // timestamps.
    const binBindMs = await connectWithRetry(binClient, binaryPort, { budgetMs: 60000 });
    log(`BINARY_TIME_TO_BIND_MS ${binBindMs}`);
    await sleep(300);

    binClient.on("response", (item) => log(`[t=${Date.now()}] EVT_RESPONSE ${JSON.stringify(item)}`));
    binClient.on("event", (item) => log(`[t=${Date.now()}] EVT_EVENT ${JSON.stringify(item)}`));
    binClient.on("desync", (err) => log(`[t=${Date.now()}] EVT_DESYNC ${err.message}`));
    binClient.on("protocol-error", (err) => log(`[t=${Date.now()}] EVT_PROTOCOL_ERROR ${JSON.stringify(err)}`));
    binClient.on("error", (err) => log(`[t=${Date.now()}] EVT_TRANSPORT_ERROR ${err.message}`));

    const pingAttempts = await pingReady(binClient);
    log(`BINARY_MONITOR_READY_AFTER_PINGS ${pingAttempts}`);

    const textConn = await connectTextMonitorWithRetry(textPort, { budgetMs: 30000 });
    textSock = textConn.sock;
    log(`TEXT_TIME_TO_BIND_MS ${textConn.ms}`);
    const banner = await awaitBanner(textSock, { timeoutMs: 3000 });
    log(`TEXT_BANNER_LEN ${banner.raw.length} matchedPromptRe=${banner.matchedPromptRe}`);

    // Step 3 (part 1): one initial resume so the machine is running before
    // any repetition begins (measured fact: stock x64sc launched with
    // -console + monitor flags starts CPU HALTED and stays halted until an
    // explicit EXIT). A cold boot masks interrupts for ~2000ms
    // (probe-harness.mjs's awaitFirstCheckpointHit doc comment) -- no
    // checkpoint is armed in this experiment, so settle by a generous fixed
    // wait instead of an event-driven confirmation.
    await resumeExecution(binClient);
    log(`RESUMED_ONCE_FOR_BOOT_SETTLE`);
    await sleep(2500);
    log(`BOOT_SETTLE_WAIT_MS 2500`);

    for (let rep = 1; rep <= REPETITIONS; rep += 1) {
      log(`--- repetition ${rep} of ${REPETITIONS} ---`);

      // Step 3 (part 2, per repetition): enable the profiler (a halting
      // text-side command), release the machine so it runs for a short
      // recorded window, then bring it back to a monitor prompt.
      const profOn = await sendAndAwaitPrompt(textSock, profilerEnableCommand, { timeoutMs: 10000 });
      log(`TEXT_${profilerEnableCommand.replace(/\s+/g, "_").toUpperCase()}_REP${rep} matched=${profOn.matchedPromptRe} text=${JSON.stringify(profOn.text)}`);
      if (rep === 1 && (looksUnsupported(profOn.text) || !profOn.matchedPromptRe)) {
        substitutionReason = `the profiler-enable command '${profilerEnableCommand}' did not produce a recognisable framed reply on this build (matched=${profOn.matchedPromptRe}, text=${JSON.stringify(profOn.text)}) -- substituting 'memmapshow' as the halting text-side command for the remainder of this run`;
        record(`SUBSTITUTION: ${substitutionReason}`);
        profilerCommand = "memmapshow";
        profilerEnableCommand = null; // no separate enable step needed for memmapshow
      }

      await resumeExecution(binClient); // one explicit binary-side resume per repetition
      log(`RESUMED_FOR_RUN_WINDOW_REP${rep}`);
      await sleep(RUN_WINDOW_MS);
      log(`RUN_WINDOW_MS_REP${rep} ${RUN_WINDOW_MS}`);

      const returnToPrompt = await sendAndAwaitPrompt(textSock, "r", { timeoutMs: 10000 });
      log(`TEXT_RETURN_TO_PROMPT_REP${rep} matched=${returnToPrompt.matchedPromptRe}`);

      // Step 4: both writes performed before either reply is awaited.
      const desyncBefore = binClient.counters.desyncBytes;
      const dupBefore = binClient.counters.duplicateReplies;
      const unsolicitedDuringWindow = [];
      const onEvent = (frame) => {
        if (frame.requestId === VICE_BROADCAST_REQUEST_ID || frame.requestId === undefined) {
          unsolicitedDuringWindow.push({ tMs: Date.now(), type: frame.type });
        }
      };
      binClient.on("event", onEvent);

      const capturedResponses = [];
      const onResponseCapture = (item) => capturedResponses.push({ tMs: Date.now(), type: item.type, requestId: item.requestId });
      binClient.on("response", onResponseCapture);

      const tBeforeBinaryWrite = process.hrtime.bigint();
      let binarySettled = null;
      const binaryPromise = binClient
        .send(CommandType.AdvanceInstructions, advanceInstructionsBody({ stepOver: false, count: 1 }), { timeoutMs: OVERLAP_BUDGET_MS })
        .then((reply) => (binarySettled = { ok: true, reply }))
        .catch((err) => (binarySettled = { ok: false, err }));
      const tAfterBinaryWrite = process.hrtime.bigint();

      let textSettled = null;
      const textPromise = sendAndAwaitPrompt(textSock, profilerCommand, { timeoutMs: OVERLAP_BUDGET_MS })
        .then((reply) => (textSettled = { ok: true, reply }))
        .catch((err) => (textSettled = { ok: false, err }));
      const tAfterTextWrite = process.hrtime.bigint();

      const gapMs = Number(tAfterTextWrite - tAfterBinaryWrite) / 1e6;
      writeGapsMs.push(gapMs);
      log(`WRITE_GAP_REP${rep}_MS ${gapMs.toFixed(3)}`);

      const startedAwait = Date.now();
      await Promise.all([binaryPromise, textPromise]);
      const totalElapsed = Date.now() - startedAwait;

      binClient.off("event", onEvent);
      binClient.off("response", onResponseCapture);
      const desyncAfter = binClient.counters.desyncBytes;
      const dupAfter = binClient.counters.duplicateReplies;

      const binaryOk = binarySettled?.ok === true;
      const binaryElapsedMs = totalElapsed; // both awaited together; per-command elapsed not separable without instrumenting resolve time individually
      const textOk = textSettled?.ok === true;
      const binaryMatchedReqId =
        binaryOk && capturedResponses.some((r) => r.requestId !== undefined && r.requestId !== VICE_BROADCAST_REQUEST_ID);

      log(
        `OVERLAP_RESULT_REP${rep} binaryOk=${binaryOk} textOk=${textOk} totalElapsedMs=${totalElapsed} binaryMatchedReqId=${binaryMatchedReqId} desyncDelta=${desyncAfter - desyncBefore} dupDelta=${dupAfter - dupBefore} unsolicitedCount=${unsolicitedDuringWindow.length}`,
      );
      log(`CAPTURED_RESPONSES_REP${rep} ${JSON.stringify(capturedResponses)}`);
      log(`UNSOLICITED_FRAMES_REP${rep} ${JSON.stringify(unsolicitedDuringWindow)}`);
      if (!binaryOk) log(`BINARY_ERROR_REP${rep} ${binarySettled?.err?.message ?? binarySettled?.err}`);
      if (!textOk) {
        log(`TEXT_ERROR_REP${rep} ${textSettled?.reply?.matchedPromptRe === false ? "reply did not frame within budget" : textSettled?.err?.message}`);
      } else {
        // The exact profiler report this repetition returned -- required by
        // the evidence conventions ("the exact profiler command sequence
        // used and what it returned"), not just a boolean.
        log(`TEXT_PROFILER_REPLY_REP${rep} matched=${textSettled.reply.matchedPromptRe} text=${JSON.stringify(textSettled.reply.text)}`);
      }

      // Drain step (mirrors 39-04's Deviation 3 discipline): the binary
      // channel's own AdvanceInstructions command halts the CPU again the
      // instant it completes its single step, and that halt pushes an
      // unsolicited "monitor entered"-shaped announcement to the TEXT
      // console too -- NOT induced by any text command about to read it.
      // The crude client's sendAndAwaitPrompt() for the NEXT text command
      // would otherwise race this announcement (first observed live in this
      // very probe's run 1: rep 2's "prof on" read consumed rep 1's stray
      // "prof off" cleanup reply instead of its own). Drain it here, before
      // any further text command is sent, and record what (if anything) was
      // drained.
      const drained = await awaitBanner(textSock, { timeoutMs: 400 });
      if (drained.raw.length > 0) {
        log(`TEXT_DRAIN_AFTER_OVERLAP_REP${rep} bytes=${drained.raw.length} text=${JSON.stringify(drained.text)}`);
      } else {
        log(`TEXT_DRAIN_AFTER_OVERLAP_REP${rep} bytes=0 (nothing pending)`);
      }

      repResults.push({
        rep,
        gapMs,
        binaryOk,
        textOk,
        totalElapsedMs: totalElapsed,
        binaryMatchedReqId,
        desyncDelta: desyncAfter - desyncBefore,
        dupDelta: dupAfter - dupBefore,
        unsolicitedCount: unsolicitedDuringWindow.length,
        unsolicitedFrames: unsolicitedDuringWindow,
        capturedResponses,
        exceededBudget: totalElapsed >= OVERLAP_BUDGET_MS,
        profilerReplyText: textOk ? textSettled.reply.text : null,
        drainedAfterOverlap: drained.raw.length > 0 ? drained.text : null,
      });

      // Disable the profiler between repetitions so each rep's report
      // reflects only that repetition's own run window, not accumulated
      // cycles from a prior repetition. Drain again afterward for the same
      // reason as above.
      if (profilerEnableCommand) {
        try {
          const profOffReply = await sendAndAwaitPrompt(textSock, "prof off", { timeoutMs: 5000 });
          log(`TEXT_PROF_OFF_CLEANUP_REP${rep} matched=${profOffReply.matchedPromptRe} text=${JSON.stringify(profOffReply.text)}`);
        } catch {
          /* best-effort cleanup between reps */
        }
      }
    }

    // Step 6: derive CONCURRENT_INFLIGHT strictly by the frozen rule.
    const allOk = repResults.every((r) => r.binaryOk && r.textOk);
    const anyCorrupt = repResults.some(
      (r) => r.binaryOk === false || r.textOk === false || r.desyncDelta > 0 && !allOk || r.unsolicitedCount > 0 && (r.binaryMatchedReqId === false),
    );
    const anyLostOrWrongId = repResults.some((r) => (r.binaryOk && !r.binaryMatchedReqId) || (r.binaryOk === false));
    const anyExceededBudgetOrDesync = repResults.some((r) => r.exceededBudget || r.desyncDelta > 0 || r.dupDelta > 0);

    if (repResults.length === 0) {
      concurrentInflight = "not-taken";
      concurrentInflightReason = "no repetition could be produced at all";
    } else if (anyLostOrWrongId || !allOk) {
      concurrentInflight = "corrupts";
      concurrentInflightReason = `at least one repetition did not resolve both replies successfully or a reply could not be attributed to its own request: ${JSON.stringify(repResults.map((r) => ({ rep: r.rep, binaryOk: r.binaryOk, textOk: r.textOk, binaryMatchedReqId: r.binaryMatchedReqId })))}`;
    } else if (anyExceededBudgetOrDesync) {
      concurrentInflight = "degraded";
      concurrentInflightReason = `all replies eventually arrived but at least one repetition exceeded the ${OVERLAP_BUDGET_MS}ms budget or recorded non-zero desync/duplicate counters: ${JSON.stringify(repResults.map((r) => ({ rep: r.rep, totalElapsedMs: r.totalElapsedMs, desyncDelta: r.desyncDelta, dupDelta: r.dupDelta })))}`;
    } else {
      concurrentInflight = "clean";
    }
  } catch (err) {
    log(`PROBE_ERROR ${err.stack ?? err.message}`);
    if (concurrentInflight === null) {
      concurrentInflight = "not-taken";
      concurrentInflightReason = `an unexpected error was thrown before the overlap could be produced at all: ${err.message}`;
      record(`VOID: ${concurrentInflightReason}`);
    }
  } finally {
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

  const maxGapMs = writeGapsMs.length ? Math.round(Math.max(...writeGapsMs)) : 0;
  record(`ALL_WRITE_GAPS_MS: ${JSON.stringify(writeGapsMs.map((g) => Math.round(g)))}`);
  record(`CONCURRENT_WRITE_GAP_MS: ${maxGapMs}`);
  record(
    `CONCURRENT_OVERLAP_CHARACTERISATION: stock VICE services both monitor servers from one single-threaded poll loop; the measured overlap is 'text-channel write issued before the binary channel's in-flight command was acknowledged', never instruction-level simultaneity`,
  );
  record(`CONCURRENT_INFLIGHT: ${concurrentInflight}`);
  if (concurrentInflightReason) log(`CONCURRENT_INFLIGHT_REASON ${concurrentInflightReason}`);

  log(`--- test:automated baseline ---`);
  const baseline = testAutomatedBaseline();
  record(`TEST_AUTOMATED_BASELINE: tests ${baseline.tests} / pass ${baseline.pass} / fail ${baseline.fail}`);
  record(`TEST_AUTOMATED_BASELINE_FILES: ${baseline.failingFiles.length ? baseline.failingFiles.join(", ") : "(none)"}`);

  const outPath = path.join(PROBE_DIR, "concurrent-inflight-run.json");
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      { concurrentInflight, concurrentInflightReason, repResults, writeGapsMs, substitutionReason, profilerCommand, baseline },
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
