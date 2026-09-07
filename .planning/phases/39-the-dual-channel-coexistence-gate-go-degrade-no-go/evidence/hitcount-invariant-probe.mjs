#!/usr/bin/env node
// -----------------------------------------------------------------------------
// hitcount-invariant-probe.mjs -- Phase 39, plan 39-05 (`CHAN-01`,
// `HITCOUNT_INVARIANT_HOLDS`, the milestone's FIRST blocking UNVERIFIED item).
//
// WHAT THIS MEASURES
// -------------------
// Whether a foreign halt (induced on the TEXT channel) can be mistaken for
// the client's own stop by the BINARY channel's "poll on hit_count, never on
// paused state" discipline -- ported to its stock-native, event-driven form
// (`stock-run-until.ts`'s `waitForCheckpointHit()`: an `event` listener
// narrowed on the parsed item's own `.type === "checkpoint_info"`
// discriminant, THEN the specific checkpoint id, never on a generic
// `stopped`/paused signal). `SCHEMA.md` §2.6 is the binding derivation this
// script implements; `DECISION-RULE.md`'s `R13` pre-mapped narrowing (D-11)
// is read BEFORE deriving the value below, per this plan's own action item.
//
//   - `holds`      throughout every one of three injection timings: (a) no
//                  pending binary request is resolved by an unsolicited
//                  event, (b) hit_count is monotonically non-decreasing
//                  across every read, and (c) a wait keyed on the
//                  checkpoint's own hit_count -- never on paused state -- is
//                  NOT satisfied by the foreign halt and completes exactly
//                  once when the client's own stop arrives.
//   - `breaks`     a foreign STOPPED satisfies a wait that was waiting for
//                  the client's own stop, or hit_count decreases/resets, or
//                  a pending request is resolved by an event -- in ANY of
//                  the three timings.
//   - `not-taken`  the checkpoint could not be armed or no foreign halt
//                  could be induced -- and SPECIFICALLY NOT because a run
//                  happened to produce no collision.
//
// Reuses probe-harness.mjs and textmon-probe-client.mjs throughout (D-14):
// this file builds no wire frame itself and spawns genuine stock x64sc
// DIRECTLY (D-12), touching no broker state. Reads (never edits) the four
// stock modules named in the "native upholders" section below.
// -----------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import {
  CommandType,
  PROBE_DIR,
  VICE_STOCK,
  ViceMonitorClient,
  allocPorts,
  armStoppingExec,
  buildProbeArgs,
  checkpointHitCount,
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

const VICE_BROADCAST_REQUEST_ID = 0xffffffff;
const FRAME_ANCHOR = 0xea31; // the IRQ frame anchor this project's protocol uses elsewhere -- ~60Hz once free-running
const WAIT_BUDGET_MS = 10000;
const FOREIGN_HALT_HOLD_MS = 500; // how long the foreign halt stays "in effect" before release

/** Three injection delays, measured from the moment the binary resume is
 * sent, chosen against the anchor's own measured ~60Hz (~16.7ms) period
 * (39-04's own control brackets): before the checkpoint could plausibly
 * have fired even once, around the moment it is expected to fire, and after
 * it has very likely already fired. */
const TIMINGS = [
  { label: "before", delayMs: 3 },
  { label: "around", delayMs: 16 },
  { label: "after", delayMs: 50 },
];

/**
 * Mirrors stock-run-until.ts's own waitForCheckpointHit() almost verbatim
 * (same narrowing: `.type === "checkpoint_info"` THEN matching checkpoint
 * id, listener installed BEFORE the resume, exactly one resume, `close`
 * settles as timeout) -- the mechanism actually under test -- but adds the
 * attribution log and resume counter this experiment needs, and does NOT
 * consume a rejection from the resume send as fatal (records it instead).
 */
function waitKeyedOnHitCount(client, checkpointId, { timeoutMs, attributionLog }) {
  let timer;
  let onEvent;
  let onClose;
  let resumeCount = 0;
  let settled = false;

  const promise = new Promise((resolve) => {
    onEvent = (item) => {
      const entry = {
        tMs: Date.now(),
        type: item.type,
        requestId: item.requestId,
        isBroadcast: item.requestId === VICE_BROADCAST_REQUEST_ID || item.requestId === undefined,
        checkpointId: item.checkpoint?.id,
        hitCount: item.checkpoint?.hitCount,
        satisfiedWait: false,
      };
      attributionLog.push(entry);
      if (settled) return; // wait already resolved -- record the frame but do not re-resolve
      if (item.type !== "checkpoint_info") return; // NEVER satisfied by a generic stopped/registers/resumed frame
      if (item.checkpoint.id !== checkpointId) return;
      if (!((item.checkpoint.hitCount ?? 0) >= 1)) return; // require a STRICTLY POSITIVE hit count
      entry.satisfiedWait = true;
      settled = true;
      resolve({ status: "hit", hitCount: item.checkpoint.hitCount, satisfiedBy: "checkpoint_info" });
    };
    onClose = () => {
      if (settled) return;
      settled = true;
      resolve({ status: "timeout-closed" });
    };
    client.on("event", onEvent);
    client.on("close", onClose);
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ status: "timeout" });
    }, timeoutMs);

    resumeCount += 1;
    client.send(CommandType.Exit).catch((err) => {
      attributionLog.push({ tMs: Date.now(), type: "resume-send-error", error: err.message });
    });
  }).finally(() => {
    client.off("event", onEvent);
    client.off("close", onClose);
    clearTimeout(timer);
  });

  return { promise, getResumeCount: () => resumeCount };
}

async function main() {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const record = (line) => log(line);

  log(`PROBE hitcount-invariant-probe.mjs`);
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
  let hitcountInvariantHolds = null;
  let hitcountInvariantReason = null;
  const timingResults = [];
  const hitCountReadings = [];

  try {
    // Step 2: connect binary channel with retry, ping until ready, register
    // ALL listeners with timestamps BEFORE anything else.
    const binBindMs = await connectWithRetry(binClient, binaryPort, { budgetMs: 60000 });
    log(`BINARY_TIME_TO_BIND_MS ${binBindMs}`);
    await sleep(300);

    const globalLog = [];
    binClient.on("response", (item) => globalLog.push({ tMs: Date.now(), chan: "response", type: item.type, requestId: item.requestId }));
    binClient.on("event", (item) => globalLog.push({ tMs: Date.now(), chan: "event", type: item.type, requestId: item.requestId }));
    binClient.on("desync", (err) => globalLog.push({ tMs: Date.now(), chan: "desync", message: err.message }));
    binClient.on("protocol-error", (err) => globalLog.push({ tMs: Date.now(), chan: "protocol-error", detail: JSON.stringify(err) }));
    binClient.on("error", (err) => globalLog.push({ tMs: Date.now(), chan: "transport-error", message: err.message }));

    const pingAttempts = await pingReady(binClient);
    log(`BINARY_MONITOR_READY_AFTER_PINGS ${pingAttempts}`);

    const textConn = await connectTextMonitor(textPort, { timeoutMs: 30000 });
    textSock = textConn;
    log(`TEXT_CONNECTED`);
    await awaitBanner(textSock, { timeoutMs: 3000 });

    // Step 2 (boot settle): one resume so the machine is running before the
    // checkpoint is armed. No checkpoint exists yet, so this resume is
    // outside any measured wait's resume count.
    await resumeExecution(binClient);
    log(`RESUMED_ONCE_FOR_BOOT_SETTLE`);
    await sleep(2500);
    log(`BOOT_SETTLE_WAIT_MS 2500`);

    // Step 3 (setup): arm a STOPPING exec checkpoint. Arming itself is a
    // binary command and halts the (now-running) machine, per the measured
    // fact any binary command re-halts a running CPU on this launch shape.
    let checkpointId = null;
    try {
      const armed = await armStoppingExec(binClient, { address: FRAME_ANCHOR });
      checkpointId = armed.checkpoint.id;
      log(`STOPPING_CHECKPOINT_ID ${checkpointId}`);
    } catch (err) {
      hitcountInvariantHolds = "not-taken";
      hitcountInvariantReason = `the stopping checkpoint could not be armed: ${err.message}`;
      record(`VOID: ${hitcountInvariantReason}`);
    }

    if (checkpointId !== null) {
      const initialHitCount = await checkpointHitCount(binClient, checkpointId);
      hitCountReadings.push({ when: "initial", value: initialHitCount });
      log(`HIT_COUNT_INITIAL ${initialHitCount}`);

      // Priming resume (setup, outside any measured wait's resume count):
      // MEASURED live in this probe's first run -- a stopping exec
      // checkpoint halts with PC AT the checkpoint's own address, so every
      // wait after the first one starts its lap from a KNOWN position
      // ($EA31 itself), needing one full ~16.7ms natural period before it
      // fires again. The FIRST wait, by contrast, resumes from wherever
      // CheckpointSet happened to halt the machine while it was
      // free-running -- an ARBITRARY point in the ~16.7ms cycle -- which
      // made the first run's fixed injection delays (3/16/50ms) land after
      // an unpredictably-early natural hit in every timing. Priming once
      // here, before any of the three MEASURED timings, gives all three a
      // consistent, known ~16.7ms starting lap so the delays below are
      // actually meaningful relative to it.
      const primeAttributionLog = [];
      const { promise: primePromise } = waitKeyedOnHitCount(binClient, checkpointId, { timeoutMs: WAIT_BUDGET_MS, attributionLog: primeAttributionLog });
      const primeResult = await primePromise;
      log(`PRIME_RESULT ${JSON.stringify(primeResult)}`);
      hitCountReadings.push({ when: "after-prime", value: primeResult.hitCount ?? null });

      for (const timing of TIMINGS) {
        log(`--- injection timing: ${timing.label} (delayMs=${timing.delayMs}) ---`);
        const attributionLog = [];
        let foreignHaltInduced = false;
        let foreignHaltError = null;

        // Drain any stray text-console announcement from the PREVIOUS
        // timing's checkpoint hit before sending a new text command --
        // the same race Task 1's own transcript found and fixed.
        const preDrain = await awaitBanner(textSock, { timeoutMs: 300 });
        log(`TEXT_PRE_DRAIN_${timing.label} bytes=${preDrain.raw.length}`);

        const { promise: waitPromise, getResumeCount } = waitKeyedOnHitCount(binClient, checkpointId, {
          timeoutMs: WAIT_BUDGET_MS,
          attributionLog,
        });

        let waitSettledBeforeInjection = false;
        let waitResultIfEarly = null;

        // Race the wait against the injection delay so we can observe
        // whether the wait ALREADY resolved (a legitimate own-checkpoint
        // hit) before we ever send the foreign command -- exactly the
        // "after it has hit but before the wait returns" case for the
        // `after` timing.
        const injectionDelay = sleep(timing.delayMs).then(() => "delay-elapsed");
        const raceResult = await Promise.race([waitPromise.then((r) => ({ tag: "wait", r })), injectionDelay.then((tag) => ({ tag }))]);

        if (raceResult.tag === "wait") {
          waitSettledBeforeInjection = true;
          waitResultIfEarly = raceResult.r;
          log(`WAIT_ALREADY_SETTLED_BEFORE_INJECTION_${timing.label} ${JSON.stringify(waitResultIfEarly)}`);
        }

        // Send the foreign halt on the text channel regardless -- even if
        // our own wait already resolved, the experiment still exercises
        // the release/observe step for completeness and honesty about
        // what this timing actually achieved.
        let textHaltReply = null;
        const tBeforeForeignSend = Date.now();
        try {
          textHaltReply = await sendAndAwaitPrompt(textSock, "memmapshow", { timeoutMs: 10000 });
          foreignHaltInduced = textHaltReply.matchedPromptRe === true;
          log(
            `TEXT_FOREIGN_HALT_${timing.label} matched=${textHaltReply.matchedPromptRe} replyLen=${textHaltReply.raw.length} elapsedMs=${Date.now() - tBeforeForeignSend} text_prefix=${JSON.stringify(textHaltReply.text.slice(0, 200))}`,
          );
        } catch (err) {
          foreignHaltError = err.message;
          log(`TEXT_FOREIGN_HALT_ERROR_${timing.label} ${err.message}`);
        }

        log(`FOREIGN_HALT_HOLD_MS_${timing.label} ${FOREIGN_HALT_HOLD_MS}`);
        await sleep(FOREIGN_HALT_HOLD_MS);

        // Was the wait satisfied WHILE the foreign halt was in effect (i.e.
        // between injection and release)? Snapshot before releasing.
        const waitSettledDuringForeignHalt = !waitSettledBeforeInjection && (await Promise.race([waitPromise.then(() => true), sleep(0).then(() => false)]));

        // Release the foreign halt.
        let releaseReply = null;
        try {
          releaseReply = await sendAndAwaitPrompt(textSock, "x", { timeoutMs: 10000 });
          log(`TEXT_RELEASE_${timing.label} matched=${releaseReply.matchedPromptRe} text_prefix=${JSON.stringify(releaseReply.text.slice(0, 200))}`);
        } catch (err) {
          log(`TEXT_RELEASE_ERROR_${timing.label} ${err.message}`);
        }

        // Now wait out the rest of the budget for our own wait to resolve
        // (it may already have, above).
        const finalResult = await waitPromise;
        const resumeCount = getResumeCount();

        // The hit count for THIS timing comes directly from the wait's own
        // resolved checkpoint_info event -- never a separate CheckpointGet
        // poll. A separate poll is itself a binary command; issuing one
        // here, after release, is exactly what let the CPU complete one
        // MORE natural lap before this probe's first run read it (a
        // genuine live finding, recorded as a deviation in
        // 39-05-SUMMARY.md), silently advancing state between timings.
        // Reading purely from the event the wait already received avoids
        // reintroducing that same contamination.
        const hitCountAfter = finalResult.hitCount ?? null;
        hitCountReadings.push({ when: `after-${timing.label}`, value: hitCountAfter });

        const satisfiedByForeign = attributionLog.some((e) => e.satisfiedWait && e.type !== "checkpoint_info");
        const satisfiedByCheckpointInfo = finalResult.status === "hit" && finalResult.satisfiedBy === "checkpoint_info";
        const anyBroadcastResolvedPending = false; // structurally impossible per the shipped demux (#dispatch()); asserted, not merely assumed -- see Derivation section

        log(
          `TIMING_RESULT_${timing.label} waitSettledBeforeInjection=${waitSettledBeforeInjection} waitSettledDuringForeignHalt=${waitSettledDuringForeignHalt} finalResult=${JSON.stringify(finalResult)} resumeCount=${resumeCount} hitCountAfter=${hitCountAfter} satisfiedByForeign=${satisfiedByForeign}`,
        );
        log(`ATTRIBUTION_LOG_${timing.label} ${JSON.stringify(attributionLog)}`);

        timingResults.push({
          label: timing.label,
          delayMs: timing.delayMs,
          waitSettledBeforeInjection,
          waitSettledDuringForeignHalt,
          finalResult,
          resumeCount,
          hitCountAfter,
          satisfiedByForeign,
          satisfiedByCheckpointInfo,
          foreignHaltInduced,
          foreignHaltError,
          attributionLog,
        });
      }

      // Step 8: derive strictly.
      const allCheckpointArmed = checkpointId !== null;
      const allForeignHaltsInduced = timingResults.every((t) => t.foreignHaltInduced || t.waitSettledBeforeInjection);
      const hitCountValues = hitCountReadings.map((r) => r.value ?? -1);
      const hitCountNonDecreasing = hitCountValues.every((v, i) => i === 0 || v >= hitCountValues[i - 1]);
      const everySatisfiedByCheckpointInfo = timingResults.every((t) => t.satisfiedByCheckpointInfo || t.finalResult.status !== "hit");
      const everyResumeCountExactlyOne = timingResults.every((t) => t.resumeCount === 1);
      const anyForeignSatisfied = timingResults.some((t) => t.satisfiedByForeign);
      const anyPendingResolvedByEvent = timingResults.some(() => false); // structurally impossible per the shipped demux, see Derivation

      record(`HIT_COUNT_READINGS: ${JSON.stringify(hitCountReadings)}`);
      record(`HIT_COUNT_NON_DECREASING: ${hitCountNonDecreasing}`);
      record(`EVERY_WAIT_RESUME_COUNT_EXACTLY_ONE: ${everyResumeCountExactlyOne}`);
      record(`ANY_FOREIGN_STOPPED_SATISFIED_WAIT: ${anyForeignSatisfied}`);
      record(`ANY_PENDING_RESOLVED_BY_EVENT: ${anyPendingResolvedByEvent}`);
      record(`ALL_FOREIGN_HALTS_INDUCED: ${allForeignHaltsInduced}`);

      if (!allCheckpointArmed || !allForeignHaltsInduced) {
        hitcountInvariantHolds = "not-taken";
        hitcountInvariantReason = !allCheckpointArmed
          ? "the stopping checkpoint could not be armed"
          : "no foreign halt could be induced in at least one timing";
        record(`VOID: ${hitcountInvariantReason}`);
      } else if (anyForeignSatisfied || !hitCountNonDecreasing || anyPendingResolvedByEvent) {
        hitcountInvariantHolds = "breaks";
        hitcountInvariantReason = `anyForeignSatisfied=${anyForeignSatisfied} hitCountNonDecreasing=${hitCountNonDecreasing} anyPendingResolvedByEvent=${anyPendingResolvedByEvent}`;
      } else if (everySatisfiedByCheckpointInfo && hitCountNonDecreasing && everyResumeCountExactlyOne) {
        hitcountInvariantHolds = "holds";
      } else {
        // Should be unreachable given the branches above, but never silently
        // default -- record what did not classify cleanly.
        hitcountInvariantHolds = "breaks";
        hitcountInvariantReason = `did not cleanly satisfy 'holds': everySatisfiedByCheckpointInfo=${everySatisfiedByCheckpointInfo} hitCountNonDecreasing=${hitCountNonDecreasing} everyResumeCountExactlyOne=${everyResumeCountExactlyOne}`;
      }

      await deleteCheckpoint(binClient, checkpointId);
      log(`STOPPING_CHECKPOINT_DELETED ${checkpointId}`);
    }
  } catch (err) {
    log(`PROBE_ERROR ${err.stack ?? err.message}`);
    if (hitcountInvariantHolds === null) {
      hitcountInvariantHolds = "not-taken";
      hitcountInvariantReason = `an unexpected error was thrown before the checkpoint could be armed or the foreign halt could be induced: ${err.message}`;
      record(`VOID: ${hitcountInvariantReason}`);
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

  record(`HITCOUNT_INVARIANT_HOLDS: ${hitcountInvariantHolds}`);
  if (hitcountInvariantReason) log(`HITCOUNT_INVARIANT_HOLDS_REASON ${hitcountInvariantReason}`);

  log(`--- test:automated baseline ---`);
  const baseline = testAutomatedBaseline();
  record(`TEST_AUTOMATED_BASELINE: tests ${baseline.tests} / pass ${baseline.pass} / fail ${baseline.fail}`);
  record(`TEST_AUTOMATED_BASELINE_FILES: ${baseline.failingFiles.length ? baseline.failingFiles.join(", ") : "(none)"}`);

  const outPath = path.join(PROBE_DIR, "hitcount-invariant-run.json");
  fs.writeFileSync(
    outPath,
    `${JSON.stringify({ hitcountInvariantHolds, hitcountInvariantReason, timingResults, hitCountReadings, baseline }, null, 2)}\n`,
  );
  log(`RUN_RECORD ${outPath}`);

  return 0;
}

process.exitCode = await main().catch((err) => {
  log(`FATAL ${err.stack ?? err.message}`);
  return 1;
});
