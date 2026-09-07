#!/usr/bin/env node
// -----------------------------------------------------------------------------
// foreign-halt-probe.mjs -- Phase 39, plan 39-04 (`CHAN-01`).
//
// WHAT THIS MEASURES
// -------------------
// `FOREIGN_HALT_VISIBILITY`: with a non-stopping (`stop_when_hit=false`) exec
// checkpoint armed at the IRQ frame anchor `$EA31` on the binary channel, and
// a halting `memmapshow` issued on the text channel, is the resulting
// TEXT-OWNED halt visible to the binary client at all? `SCHEMA.md` §2.2 is
// the binding derivation this script implements; it is not softened here.
//
//   - `visible`    at least one of (a) an unsolicited STOPPED (0x62) frame
//                  arrives on the binary channel at request-id 0xffffffff,
//                  or (b) the measured bracket's hit-count reads zero while
//                  the control bracket in the same repetition read nonzero
//                  -- record WHICH.
//   - `invisible`  neither signal appears and the measured count is nonzero,
//                  matching the control's within run-to-run variation
//                  (recorded as the observed control spread across three
//                  repetitions).
//   - `corrupts`   the binary client desyncs, a pending request is resolved
//                  by an event, a request times out, or an otherwise
//                  unexplained client-side error occurs during a bracket.
//   - `not-taken`  the checkpoint could not be armed, or `memmapshow`
//                  produced no framed response.
//
// PASSIVE-ONLY DISCIPLINE (the load-bearing correction this file makes over
// its first draft -- see 39-04-SUMMARY.md Deviation 1)
// -------------------------------------------------------------------------
// probe-harness.mjs's resumeExecution() doc comment already recorded, from
// 39-03's own empirical finding, that on this exact launch shape ANY command
// reaching the binary monitor -- not just EXIT -- re-halts the CPU once it is
// running, and it stays halted until the NEXT command. A first draft of this
// probe used explicit CHECKPOINT_GET reads (checkpointHitCount()) as its
// "before/after" bracket mechanism, which is EXACTLY the self-inflicted halt
// this comment warns about: the "before" read halts the CPU, and the "after"
// read (sent to an already-halted machine, since nothing else resumed it)
// necessarily reads the SAME hit count, manufacturing a false zero-delta
// signal that has nothing to do with the text channel. Confirmed live: a run
// against a real emulator read `before=1 after=1` across a 500ms window
// immediately following a confirmed, passively-observed hit.
//
// The fix: after the ONE initial EXIT that starts the machine running, this
// probe issues NO FURTHER BINARY-CHANNEL COMMANDS until every control and
// measured bracket has been taken. Every bracket is a purely PASSIVE window:
// an event counter is reset, the window elapses (a plain sleep, or the text
// channel's own round trip), and the counter's accumulated value -- driven
// entirely by the checkpoint's own unsolicited CHECKPOINT_INFO pushes, which
// require no request from this client -- is read. `binClient.counters` (a
// local getter, not a network round trip) is safe to read at any time and is
// used for the desync/duplicate-reply bookkeeping around each window.
//
// A second, previously-unmeasured fact fell out of the first (voided) live
// run and is recorded here for the SUMMARY: an unsolicited REGISTER_INFO
// (0x31) frame arrives paired with every STOPPED (0x62) frame, not only "on
// every monitor open" as CLAUDE.md's constraint currently states -- observed
// pairs at the SAME millisecond timestamp on every halt transition in the
// captured event log, both when this probe's own commands halted the
// (then-halted) machine and when EXIT resumed it (paired with RESUMED).
//
// This plan runs in its own wave (39-04) because every probe in this phase
// refuses to start when any other emulator process is alive (D-16); see the
// plan's Serialization note. It spawns genuine stock x64sc DIRECTLY (D-12),
// touching no broker state whatsoever. Every wire body it sends comes from
// probe-harness.mjs's shipped-encoder re-exports (D-14); this file builds no
// frame itself.
// -----------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
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

const FRAME_ANCHOR = 0xea31;
/** Fixed observation window for each control/measured/release bracket. */
const BRACKET_WINDOW_MS = 1000;
/** How many control+measured pairs to take -- the plan requires three. */
const REPETITIONS = 3;

/**
 * Retries a raw text-monitor connect within a budget, mirroring
 * probe-harness.mjs's connectWithRetry() but for the plain socket the
 * throwaway text client uses (idle-coexist-probe.mjs's own helper, ported
 * verbatim -- not re-derived, this file just avoids importing a private
 * helper from a sibling probe script).
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

async function main() {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const record = (line) => log(line);

  log(`PROBE foreign-halt-probe.mjs`);
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
  let foreignHaltVisibility = null;
  let foreignHaltReason = null;
  let observedSignal = null;

  // Every unsolicited (event-channel) frame observed on the binary client,
  // timestamped relative to process start -- captured from the FIRST byte,
  // per the plan's step 2 requirement. This is the primary evidence for the
  // whole experiment.
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

  // The anchor checkpoint's OWN unsolicited hit counter -- incremented only
  // by its own CHECKPOINT_INFO events (matched by id), which require no
  // request from this client at all. This is the PASSIVE bracket mechanism;
  // see the file header for why an explicit CHECKPOINT_GET poll cannot be
  // used instead.
  let anchorId = null;
  let anchorHits = 0;
  const onAnchorHit = (frame) => {
    if (frame.type === "checkpoint_info" && frame.checkpoint.id === anchorId) anchorHits += 1;
  };

  /** Reset the passive counter, wait `ms`, return what accumulated. Sends
   * NO binary-channel command -- this is the whole point. */
  async function passiveWindow(ms) {
    anchorHits = 0;
    await sleep(ms);
    return anchorHits;
  }

  const controlBrackets = [];
  const measuredBrackets = [];

  try {
    // Step 2 (continued): connect binary channel with retry, ping until
    // ready, THEN register listeners before anything else touches the
    // socket -- the event log must be capturing from the first byte.
    const binBindMs = await connectWithRetry(binClient, binaryPort, { budgetMs: 60000 });
    log(`BINARY_TIME_TO_BIND_MS ${binBindMs}`);
    binClient.on("event", onAnyEvent);
    binClient.on("event", onAnchorHit);
    binClient.on("desync", onDesync);
    binClient.on("protocol-error", onProtocolError);
    binClient.on("transport-error", onTransportError);
    await sleep(300);
    const pingAttempts = await pingReady(binClient);
    log(`BINARY_MONITOR_READY_AFTER_PINGS ${pingAttempts}`);

    // Step 3: arm a non-stopping exec checkpoint at the frame anchor. A
    // stock x64sc launched with -console + monitor flags starts CPU-HALTED
    // (39-03's discovery) and does not resume until an explicit EXIT is
    // sent. This CheckpointSet and the one EXIT below are the LAST binary
    // commands this probe sends until every bracket has been taken.
    const anchor = await armNonStoppingExec(binClient, { address: FRAME_ANCHOR });
    anchorId = anchor.checkpoint.id;
    log(`ANCHOR_CHECKPOINT_ID ${anchorId}`);

    await resumeExecution(binClient);
    log(`RESUMED_ONCE_FOR_BOOT_SETTLE`);

    const bootWait = await awaitFirstCheckpointHit(binClient, anchorId, { budgetMs: 30000 });
    log(`ANCHOR_FIRST_HIT ${JSON.stringify(bootWait)}`);

    if (!bootWait.hit) {
      foreignHaltVisibility = "not-taken";
      foreignHaltReason =
        "the anchor checkpoint never recorded its first hit within the boot-settle budget -- the checkpoint could not be confirmed armed and hitting";
      record(`VOID: ${foreignHaltReason}`);
    }

    if (foreignHaltVisibility === null) {
      // Step 5 (connect ahead of steps 3/4 in execution order, since the
      // text channel must be ready before any repetition can induce a
      // foreign halt): connect the text channel with retry, capture the
      // (empty, per 39-03) banner. Connecting and reading do not write
      // anything, so this cannot disturb the binary side's passive-only
      // invariant above.
      const { sock, ms: textBindMs } = await connectTextMonitorWithRetry(textPort, { budgetMs: 30000 });
      textSock = sock;
      log(`TEXT_TIME_TO_BIND_MS ${textBindMs}`);
      const bannerObs = await awaitBanner(textSock, { timeoutMs: 10000 });
      log(`TEXT_BANNER_HEX ${bannerObs.raw.toString("hex")}`);

      // Steps 3(sanity)/4/6/7/9: three (control, measured) bracket pairs.
      // Rep 1's control bracket also serves as step 3's "confirm it is
      // hitting" sanity check (>0 hits over a passive window is exactly
      // that confirmation, taken without a self-halting poll) -- folding
      // the two together rather than duplicating the same passive
      // observation under two names.
      for (let rep = 1; rep <= REPETITIONS && foreignHaltVisibility === null; rep += 1) {
        try {
          log(`--- repetition ${rep} of ${REPETITIONS} ---`);

          // Step 4 (+ step 3 sanity on rep 1): control bracket, no foreign
          // halt -- passive hit count over a fixed window with nothing sent
          // on either channel.
          const controlHits = await passiveWindow(BRACKET_WINDOW_MS);
          controlBrackets.push({ rep, hits: controlHits });
          record(`CONTROL_BRACKET_${rep}: hits=${controlHits}`);

          if (rep === 1 && controlHits === 0) {
            foreignHaltVisibility = "not-taken";
            foreignHaltReason =
              "the anchor checkpoint recorded zero hits during rep 1's control window -- it could not be confirmed hitting under the required passive discipline, so the control itself is void";
            record(`VOID: ${foreignHaltReason}`);
            break;
          }

          // Step 5: issue the halting memmapshow on the text channel and
          // await its full framed reply -- per the live-probe note
          // (.planning/notes/text-monitor-channel-live-probe.md), the stock
          // text monitor holds the CPU halted from the moment a command is
          // received until an explicit `x` (exit) is sent; the reply
          // arriving does NOT itself release the halt.
          const desyncBefore = binClient.counters.desyncBytes;
          const dupBefore = binClient.counters.duplicateReplies;
          const eventsBeforeWindow = eventLog.length;
          anchorHits = 0; // arm the passive counter before the halt-inducing write

          const memmapResult = await sendAndAwaitPrompt(textSock, "memmapshow", { timeoutMs: 15000 });
          log(`TEXT_MEMMAPSHOW_MATCHED_PROMPT ${memmapResult.matchedPromptRe}`);
          log(`TEXT_MEMMAPSHOW_REPLY_LEN ${memmapResult.raw.length}`);
          if (!memmapResult.matchedPromptRe) {
            foreignHaltVisibility = "not-taken";
            foreignHaltReason = `memmapshow produced no framed (prompt-terminated) response within budget on repetition ${rep}`;
            record(`VOID: ${foreignHaltReason}`);
            break;
          }

          // Step 6: measured bracket, foreign halt in effect -- the halt
          // induced by memmapshow above persists past its own reply until
          // `x` is sent below, so continuing to hold the passive window
          // here still observes the SAME halt, not a fresh one.
          await sleep(BRACKET_WINDOW_MS);
          const measuredHits = anchorHits;

          const desyncAfter = binClient.counters.desyncBytes;
          const dupAfter = binClient.counters.duplicateReplies;
          const eventsDuringWindow = eventLog.slice(eventsBeforeWindow);

          measuredBrackets.push({
            rep,
            hits: measuredHits,
            desyncDelta: desyncAfter - desyncBefore,
            duplicateDelta: dupAfter - dupBefore,
            unsolicitedDuringWindow: eventsDuringWindow,
          });
          record(
            `MEASURED_BRACKET_${rep}: hits=${measuredHits} desyncDelta=${desyncAfter - desyncBefore} dupDelta=${dupAfter - dupBefore} unsolicited=${eventsDuringWindow.length}`,
          );
          if (eventsDuringWindow.length > 0) {
            record(`UNSOLICITED_FRAMES_REP_${rep}: ${JSON.stringify(eventsDuringWindow)}`);
          }

          // Step 7: release the halt, confirm hit count resumes advancing
          // (transient, not terminal -- observed here, not gate-relevant),
          // again purely passively.
          anchorHits = 0;
          const releaseResult = await sendAndAwaitPrompt(textSock, "x", { timeoutMs: 10000 });
          log(`TEXT_RELEASE_MATCHED_PROMPT ${releaseResult.matchedPromptRe}`);
          const releaseHits = await passiveWindow(BRACKET_WINDOW_MS);
          log(`RELEASE_HITCOUNT_RESUMES_REP_${rep}: hits=${releaseHits} resumed=${releaseHits > 0}`);

          if (desyncAfter !== desyncBefore || dupAfter !== dupBefore) {
            foreignHaltVisibility = "corrupts";
            foreignHaltReason = `repetition ${rep}: desyncDelta=${desyncAfter - desyncBefore}, dupDelta=${dupAfter - dupBefore} (a client-side corruption signal was observed)`;
            break;
          }
        } catch (repErr) {
          // A pending binary request timing out, or being resolved by an
          // unsolicited event instead of its own reply (StockResponseMismatchError
          // when the demux's related-response accumulation misfires), is
          // SCHEMA.md §2.2's own `corrupts` bullet -- classified here rather
          // than falling through to the generic not-taken handler at the
          // bottom of main(), which is reserved for the two named not-taken
          // causes only.
          foreignHaltVisibility = "corrupts";
          foreignHaltReason = `repetition ${rep}: a binary-channel request errored during the bracket sequence: ${repErr.message}`;
          record(`VOID: ${foreignHaltReason}`);
          break;
        }
      }

      // Steps 8-9: derive strictly by the frozen rule once all reps (or an
      // early corrupts/not-taken break) have completed.
      if (foreignHaltVisibility === null) {
        const anyStoppedDuringWindow = measuredBrackets.some((b) => b.unsolicitedDuringWindow.some((e) => e.type === "stopped"));
        const anyZeroMeasuredAgainstNonzeroControl = measuredBrackets.some((mb) => {
          const cb = controlBrackets.find((c) => c.rep === mb.rep);
          return mb.hits === 0 && cb && cb.hits > 0;
        });
        const anyCorruptingSignal = measuredBrackets.some((b) => b.desyncDelta !== 0 || b.duplicateDelta !== 0);

        if (anyCorruptingSignal) {
          foreignHaltVisibility = "corrupts";
          foreignHaltReason = "at least one measured bracket recorded a desync byte or a duplicate reply";
        } else if (anyStoppedDuringWindow) {
          foreignHaltVisibility = "visible";
          observedSignal = "unsolicited STOPPED (0x62) frame at request-id 0xffffffff during the measured bracket window";
        } else if (anyZeroMeasuredAgainstNonzeroControl) {
          foreignHaltVisibility = "visible";
          observedSignal = "measured bracket hit count of zero against a non-zero control hit count in the same repetition";
        } else {
          // invisible requires the measured hit count to be nonzero, matching
          // the control's within run-to-run variation -- record the observed
          // control spread explicitly, per the plan's step 8 wording. The
          // zero-vs-nonzero and stopped-frame signals were already ruled out
          // above, so what remains is exactly the frozen rule's residual: the
          // anchor kept advancing through the foreign halt window at all.
          const controlCounts = controlBrackets.map((c) => c.hits);
          const measuredCounts = measuredBrackets.map((m) => m.hits);
          const controlSpread = `min=${Math.min(...controlCounts)} max=${Math.max(...controlCounts)}`;
          record(`OBSERVED_CONTROL_SPREAD_ACROSS_${REPETITIONS}_REPS: ${controlSpread}`);
          log(`MEASURED_HIT_COUNTS ${JSON.stringify(measuredCounts)}`);
          const allNonzero = measuredCounts.length === REPETITIONS && measuredCounts.every((h) => h > 0);
          if (allNonzero) {
            foreignHaltVisibility = "invisible";
          } else {
            // Ambiguous against the frozen rule: an incomplete set of
            // measured brackets with no earlier not-taken/corrupts cause
            // named. Per the plan's own instruction, this is recorded as an
            // ACCEPTED LIMIT and resolved to the WORSE admissible value,
            // never the tidier one.
            foreignHaltVisibility = "corrupts";
            foreignHaltReason = `ambiguous against the frozen rule: measured hit counts ${JSON.stringify(measuredCounts)} (expected ${REPETITIONS} nonzero values, control spread ${controlSpread}) -- resolved to the worse admissible value (corrupts) per the plan's explicit instruction not to pick the tidier reading`;
          }
        }
      }

      // Retire the anchor checkpoint before reap -- the first binary
      // command sent since the passive-only window opened above, and safe
      // now that every bracket has already been taken.
      try {
        await deleteCheckpoint(binClient, anchorId);
      } catch {}
    }
  } catch (err) {
    log(`PROBE_ERROR ${err.stack ?? err.message}`);
    if (foreignHaltVisibility === null) {
      foreignHaltVisibility = "not-taken";
      foreignHaltReason = `an unexpected error was thrown before either not-taken cause could be distinguished: ${err.message}`;
      record(`VOID: ${foreignHaltReason}`);
    }
  } finally {
    binClient.off("event", onAnyEvent);
    binClient.off("event", onAnchorHit);
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

  record(`FOREIGN_HALT_VISIBILITY: ${foreignHaltVisibility}`);
  if (foreignHaltReason) log(`FOREIGN_HALT_VISIBILITY_REASON ${foreignHaltReason}`);
  if (observedSignal) record(`FOREIGN_HALT_VISIBILITY_SIGNAL: ${observedSignal}`);

  log(`FULL_EVENT_LOG ${JSON.stringify(eventLog)}`);

  // Observed test:automated baseline (never assumed, README.md convention 4).
  log(`--- test:automated baseline ---`);
  const baseline = testAutomatedBaseline();
  record(`TEST_AUTOMATED_BASELINE: tests ${baseline.tests} / pass ${baseline.pass} / fail ${baseline.fail}`);
  record(`TEST_AUTOMATED_BASELINE_FILES: ${baseline.failingFiles.length ? baseline.failingFiles.join(", ") : "(none)"}`);

  const outPath = path.join(PROBE_DIR, "foreign-halt-run.json");
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        foreignHaltVisibility,
        foreignHaltReason,
        observedSignal,
        controlBrackets,
        measuredBrackets,
        eventLog,
        baseline,
      },
      null,
      2,
    )}\n`,
  );
  log(`RUN_RECORD ${outPath}`);

  return 0; // every outcome (including corrupts/not-taken) is a recorded fact, never a probe crash
}

process.exitCode = await main().catch((err) => {
  log(`FATAL ${err.stack ?? err.message}`);
  return 1;
});
