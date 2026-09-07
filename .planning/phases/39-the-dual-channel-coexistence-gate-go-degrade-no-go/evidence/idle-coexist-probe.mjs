#!/usr/bin/env node
// -----------------------------------------------------------------------------
// idle-coexist-probe.mjs -- Phase 39, plan 39-03 (`CHAN-01`, D-09's sole
// `no-go` trigger).
//
// WHAT THIS MEASURES
// ------------------
// `IDLE_COEXIST`: whether a non-halting MEMORY_GET on the binary channel,
// reading the invariant KERNAL ROM window `$E000-$E0FF`, returns
// byte-identical data whether or not a text-monitor client is connected and
// silent (issued no command since its banner). `SCHEMA.md` §2.1 is the
// binding derivation this script implements; it is not softened here.
//
//   - `clean`      three payloads read WITH a silent text client attached
//                  byte-match the three-way-agreeing control payloads taken
//                  with NO text client connected, with zero desync bytes,
//                  zero duplicate replies, and no unsolicited broadcast
//                  frame during the window.
//   - `corrupts`   any read errors, times out, differs, or the binary
//                  client's own counters move, or an unsolicited frame
//                  arrives.
//   - `not-taken`  the text port never accepted a connection, or the binary
//                  channel could not be established -- and ONLY those two
//                  causes. A timeout or unexpected payload is `corrupts`,
//                  never `not-taken`.
//
// This is the phase's first LIVE measurement and it spawns genuine stock
// x64sc DIRECTLY (D-12), touching no broker state whatsoever. Every wire
// body it sends comes from probe-harness.mjs's shipped-encoder re-exports
// (D-14); this file builds no frame itself.
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
  awaitFirstCheckpointHit,
  buildProbeArgs,
  connectWithRetry,
  deleteCheckpoint,
  log,
  memGetBody,
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
import { PROMPT_RE, awaitBanner, closeTextMonitor, connectTextMonitor, sendAndAwaitPrompt } from "./textmon-probe-client.mjs";

const MEMSPACE_MAIN = 0x00;
const WINDOW_START = 0xe000;
const WINDOW_END = 0xe0ff;
/** The KERNAL IRQ entry -- the once-per-frame anchor this project's protocol
 * uses elsewhere (33-11's own FRAME_ANCHOR), reused here as the site for the
 * non-stopping "is the machine still running?" checkpoint. */
const FRAME_ANCHOR = 0xea31;

const VICE_BROADCAST_REQUEST_ID = 0xffffffff;

function readWindow(client) {
  return client.send(CommandType.MemoryGet, memGetBody({ sidefx: false, start: WINDOW_START, end: WINDOW_END, memspace: MEMSPACE_MAIN }));
}

function hex(buf) {
  return buf.toString("hex");
}

/**
 * Retries a raw text-monitor connect within a budget, mirroring
 * probe-harness.mjs's connectWithRetry() but for the plain socket the
 * throwaway text client uses rather than a ViceMonitorClient. Returns
 * `{ sock, ms }` so the caller owns the connected socket directly -- no
 * shared/global state.
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

  log(`PROBE idle-coexist-probe.mjs`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`DATE_UTC ${new Date().toISOString()}`);

  // Step 1: preflight, refused in code (D-16).
  const pf = preflight();
  record(`BROKER_STATE: ${pf.broker}`);

  // Step 2: allocate two ports, build argv, spawn stock baseline directly.
  const { binaryPort, textPort } = await allocPorts();
  log(`BINARY_PORT ${binaryPort}`);
  log(`TEXT_PORT ${textPort}`);
  let swapMonitorOrder = false;
  let argv = buildProbeArgs({ binaryPort, textPort, headless: true, swapMonitorOrder });
  log(`SPAWN_ARGV ${JSON.stringify([VICE_STOCK, ...argv])}`);

  const kind = viceKind(VICE_STOCK);
  const version = viceVersion(VICE_STOCK);
  record(`VICE_BINARY: ${kind}:${VICE_STOCK}`);
  record(`VICE_VERSION_OBSERVED: ${version}`);

  let child = spawnVice(VICE_STOCK, argv);
  let childStderr = "";
  child.stderr.on("data", (d) => {
    childStderr += d.toString();
  });
  child.stdout.on("data", () => {});

  const binClient = new ViceMonitorClient();
  let idleCoexist = null;
  let idleCoexistReason = null;
  let textSock = null;
  let bannerObs = null;
  let remoteMonitorFlagOrder = "default-first-assumed";
  let textPromptLiteralConfirmed = "no";
  let textBindBudgetMsMax = null;
  let idleTextClientHalts = null;
  let controlPayloads = [];
  let measuredPayloads = [];
  let postCommandPromptHex = null;
  const unsolicitedDuringWindow = [];

  try {
    // Step 3: connect binary channel with retry, ping until ready.
    const binBindMs = await connectWithRetry(binClient, binaryPort, { budgetMs: 60000 });
    log(`BINARY_TIME_TO_BIND_MS ${binBindMs}`);
    await sleep(300);
    const pingAttempts = await pingReady(binClient);
    log(`BINARY_MONITOR_READY_AFTER_PINGS ${pingAttempts}`);

    // Step 4: control leg, no text client connected. Three reads.
    for (let i = 0; i < 3; i += 1) {
      const reply = await readWindow(binClient);
      controlPayloads.push(Buffer.from(reply.bytes));
      log(`CONTROL_READ_${i} len=${reply.bytes.length} hex_prefix=${hex(reply.bytes).slice(0, 32)}`);
    }
    const controlAgree = controlPayloads.every((p) => p.equals(controlPayloads[0]));
    record(`CONTROL_THREE_READS_AGREE: ${controlAgree ? "yes" : "no"}`);
    if (!controlAgree) {
      idleCoexist = "not-taken";
      idleCoexistReason =
        "the control leg's own three no-text-client reads did not agree with each other -- the control itself is void, so no measured leg can be compared against a moving reference";
      record(`VOID: ${idleCoexistReason}`);
    }

    if (idleCoexist === null) {
      // Step 5: connect text channel with retry. Try the assumed flag order
      // first (already spawned with it); if the text port never binds within
      // budget, respawn once with the order swapped and record which bound.
      let textBindMs;
      try {
        const attempt = await connectTextMonitorWithRetry(textPort, { budgetMs: 30000 });
        textSock = attempt.sock;
        textBindMs = attempt.ms;
        remoteMonitorFlagOrder = "default-first-assumed";
      } catch (err) {
        log(`TEXT_CONNECT_FAILED_ASSUMED_ORDER ${err.message}`);
        record(
          `VOID: text-monitor port ${textPort} never accepted a connection under the assumed flag order within 30000 ms: ${err.message}`,
        );
        // Respawn with the swapped order to determine whether A1 is fixable.
        try {
          child.kill("SIGKILL");
        } catch {}
        await sleep(500);
        swapMonitorOrder = true;
        argv = buildProbeArgs({ binaryPort, textPort, headless: true, swapMonitorOrder });
        log(`RESPAWN_SWAPPED_ARGV ${JSON.stringify([VICE_STOCK, ...argv])}`);
        child = spawnVice(VICE_STOCK, argv);
        child.stdout.on("data", () => {});
        child.stderr.on("data", (d) => {
          childStderr += d.toString();
        });
        // Reconnect the binary client to the (new process's) binary port too --
        // the old process is dead.
        await binClient.disconnect();
        await connectWithRetry(binClient, binaryPort, { budgetMs: 60000 });
        await sleep(300);
        await pingReady(binClient);
        try {
          const attempt2 = await connectTextMonitorWithRetry(textPort, { budgetMs: 30000 });
          textSock = attempt2.sock;
          textBindMs = attempt2.ms;
          remoteMonitorFlagOrder = "order-irrelevant-measured";
          log(`TEXT_CONNECT_SUCCEEDED_SWAPPED_ORDER bindMs=${textBindMs}`);
        } catch (err2) {
          record(`VOID: text-monitor port ${textPort} never accepted a connection under EITHER flag order: ${err2.message}`);
          idleCoexist = "not-taken";
          idleCoexistReason = "the text port never accepted a connection under either flag order";
        }
      }

      if (idleCoexist === null) {
        textBindBudgetMsMax = textBindMs;
        log(`TEXT_TIME_TO_BIND_MS ${textBindMs}`);
        record(`TEXT_BIND_BUDGET_MS_MAX: ${textBindBudgetMsMax}`);
        log(`TEXT_NEEDED_MORE_BUDGET_THAN_BINARY: ${textBindBudgetMsMax > (binBindMs ?? 0) ? "yes" : "no"}`);

        // Capture before trusting: raw banner bytes, before any command sent.
        bannerObs = await awaitBanner(textSock, { timeoutMs: 10000 });
        record(`TEXT_BANNER_HEX: ${hex(bannerObs.raw)}`);
        record(`TEXT_BANNER_TEXT: ${JSON.stringify(bannerObs.text)}`);
        record(`TEXT_PROMPT_RE_ORIGINAL: ${PROMPT_RE.toString()}`);
        if (bannerObs.matchedPromptRe) {
          textPromptLiteralConfirmed = "yes";
          record(`TEXT_PROMPT_LITERAL_CONFIRMED: yes`);
        } else {
          textPromptLiteralConfirmed = "no";
          record(`TEXT_PROMPT_LITERAL_CONFIRMED: no`);
          record(
            `TEXT_PROMPT_RE_NOTE: the original matcher did not match the observed banner bytes within budget; the observed bytes are recorded above verbatim for a later plan to correct the matcher against`,
          );
        }

        // Step 6: is the machine still running with a silent text client attached?
        //
        // MEASURED while building this probe (recorded as a deviation in the
        // SUMMARY, not silently absorbed): a stock x64sc launched with
        // `-console` + monitor flags starts with the CPU HALTED and stays
        // halted until an explicit EXIT (0xaa) resume is sent -- none of the
        // control-leg reads above start it running, so this is the first
        // resume in the whole probe. Once resumed it free-runs
        // autonomously until the NEXT command reaches the monitor, so the
        // "is it still running" window below sends NOTHING while it is
        // open and counts the checkpoint's own UNSOLICITED CHECKPOINT_INFO
        // events (never an explicit CheckpointGet poll, which would itself
        // re-halt the CPU and manufacture a false "yes" every time).
        const anchor = await armNonStoppingExec(binClient, { address: FRAME_ANCHOR });
        const anchorId = anchor.checkpoint.id;
        log(`ANCHOR_CHECKPOINT_ID ${anchorId}`);

        let anchorHits = 0;
        const onAnchorHit = (frame) => {
          if (frame.type === "checkpoint_info" && frame.checkpoint.id === anchorId) anchorHits += 1;
        };
        binClient.on("event", onAnchorHit);

        await resumeExecution(binClient);
        log(`RESUMED_ONCE_FOR_HALT_CHECK`);

        // A cold C64 boot masks interrupts for its KERNAL RAM test --
        // MEASURED at ~2000ms on this host -- so wait for the anchor's
        // OWN first hit (generous 30s budget) before trusting a 1-second
        // sample; sampling immediately would read "halted" for a reason
        // that has nothing to do with the text channel.
        const bootWait = await awaitFirstCheckpointHit(binClient, anchorId, { budgetMs: 30000 });
        log(`ANCHOR_FIRST_HIT ${JSON.stringify(bootWait)}`);

        if (!bootWait.hit) {
          idleTextClientHalts = "not-taken";
          record(`IDLE_TEXT_CLIENT_HALTS: not-taken`);
          log(`IDLE_TEXT_CLIENT_HALTS_REASON the anchor checkpoint never recorded its first hit within the boot-settle budget`);
        } else {
          // Clean 1-second sample window: nothing sent, only the passive
          // event counter observed.
          anchorHits = 0;
          await sleep(1000);
          idleTextClientHalts = anchorHits > 0 ? "no" : "yes";
          record(`ANCHOR_HITS_DURING_1S_SAMPLE_WINDOW: ${anchorHits}`);
          record(`IDLE_TEXT_CLIENT_HALTS: ${idleTextClientHalts}`);
        }
        binClient.off("event", onAnchorHit);

        // Retire the diagnostic checkpoint before the measured leg below --
        // its own unsolicited hits would otherwise contaminate that leg's
        // "no unsolicited broadcast frame" check with an artifact of THIS
        // check rather than of the text channel.
        await deleteCheckpoint(binClient, anchorId);

        // Step 7: measured leg, text client connected and silent (no command
        // has been sent on it beyond the banner read, which sends nothing).
        const desyncBefore = binClient.counters.desyncBytes;
        const dupBefore = binClient.counters.duplicateReplies;
        const onEvent = (frame) => {
          if (frame.requestId === VICE_BROADCAST_REQUEST_ID || frame.requestId === undefined) {
            unsolicitedDuringWindow.push(frame.type);
          }
        };
        binClient.on("event", onEvent);
        for (let i = 0; i < 3; i += 1) {
          const reply = await readWindow(binClient);
          measuredPayloads.push(Buffer.from(reply.bytes));
          log(`MEASURED_READ_${i} len=${reply.bytes.length} hex_prefix=${hex(reply.bytes).slice(0, 32)}`);
        }
        binClient.off("event", onEvent);
        const desyncAfter = binClient.counters.desyncBytes;
        const dupAfter = binClient.counters.duplicateReplies;
        record(`DESYNC_BYTES_DELTA: ${desyncAfter - desyncBefore}`);
        record(`DUPLICATE_REPLIES_DELTA: ${dupAfter - dupBefore}`);
        record(`UNSOLICITED_BROADCAST_FRAMES_DURING_WINDOW: ${unsolicitedDuringWindow.length}`);

        const allMeasuredMatchControl = measuredPayloads.every((p) => p.equals(controlPayloads[0]));
        const noDesync = desyncAfter === desyncBefore;
        const noDup = dupAfter === dupBefore;
        const noUnsolicited = unsolicitedDuringWindow.length === 0;
        log(
          `DERIVATION_INPUTS allMeasuredMatchControl=${allMeasuredMatchControl} noDesync=${noDesync} noDup=${noDup} noUnsolicited=${noUnsolicited}`,
        );
        if (allMeasuredMatchControl && noDesync && noDup && noUnsolicited) {
          idleCoexist = "clean";
        } else {
          idleCoexist = "corrupts";
          idleCoexistReason = `allMeasuredMatchControl=${allMeasuredMatchControl} noDesync=${noDesync} noDup=${noDup} noUnsolicited=${noUnsolicited}`;
        }

        // Supplementary documentation ONLY, taken strictly AFTER the gate
        // measurement above has already concluded -- it does not feed
        // IDLE_COEXIST or IDLE_TEXT_CLIENT_HALTS. The connect banner
        // captured above was empty (the stock text monitor sends nothing
        // until it receives input), so PROMPT_RE could never be exercised
        // against it; this captures the first REAL prompt bytes in the
        // project's history by sending the most inert input possible (a
        // bare newline, no monitor command) so the acceptance criterion's
        // "connect banner AND prompt" is satisfied from an actual
        // transcript rather than left unconfirmed.
        log(`--- supplementary, documentation only, after the gate window closed above ---`);
        try {
          const postCmd = await sendAndAwaitPrompt(textSock, "", { timeoutMs: 5000 });
          postCommandPromptHex = hex(postCmd.raw);
          log(`POST_MEASUREMENT_PROMPT_HEX ${postCommandPromptHex}`);
          log(`POST_MEASUREMENT_PROMPT_TEXT ${JSON.stringify(postCmd.text)}`);
          log(`POST_MEASUREMENT_PROMPT_MATCHES_PROMPT_RE ${postCmd.matchedPromptRe}`);
        } catch (err) {
          log(`POST_MEASUREMENT_PROMPT_CAPTURE_FAILED ${err.message}`);
        }
      }
    }
  } catch (err) {
    log(`PROBE_ERROR ${err.stack ?? err.message}`);
    if (idleCoexist === null) {
      idleCoexist = "not-taken";
      idleCoexistReason = `an unexpected error was thrown before either not-taken cause could be distinguished: ${err.message}`;
      record(`VOID: ${idleCoexistReason}`);
    }
  } finally {
    record(`REMOTEMONITOR_FLAG_ORDER: ${remoteMonitorFlagOrder}`);
    // Step 10: reap, close text socket.
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

  record(`IDLE_COEXIST: ${idleCoexist}`);
  if (idleCoexistReason) log(`IDLE_COEXIST_REASON ${idleCoexistReason}`);

  // Observed test:automated baseline (never assumed, README.md convention 4).
  log(`--- test:automated baseline ---`);
  const baseline = testAutomatedBaseline();
  record(`TEST_AUTOMATED_BASELINE: tests ${baseline.tests} / pass ${baseline.pass} / fail ${baseline.fail}`);
  record(`TEST_AUTOMATED_BASELINE_FILES: ${baseline.failingFiles.length ? baseline.failingFiles.join(", ") : "(none)"}`);

  const outPath = path.join(PROBE_DIR, "idle-coexist-run.json");
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        idleCoexist,
        idleCoexistReason,
        controlPayloadsHex: controlPayloads.map(hex),
        measuredPayloadsHex: measuredPayloads.map(hex),
        bannerHex: bannerObs ? hex(bannerObs.raw) : null,
        postCommandPromptHex,
        remoteMonitorFlagOrder,
        textPromptLiteralConfirmed,
        textBindBudgetMsMax,
        idleTextClientHalts,
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
