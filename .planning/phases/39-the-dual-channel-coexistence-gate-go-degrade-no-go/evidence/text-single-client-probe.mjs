#!/usr/bin/env node
// -----------------------------------------------------------------------------
// text-single-client-probe.mjs -- Phase 39, plan 39-06 (`CHAN-01`,
// `TEXT_SINGLE_CLIENT`, the milestone's OTHER blocking UNVERIFIED item).
//
// WHAT THIS MEASURES
// -------------------
// Does the stock text-monitor server serve a second client, refuse it, or
// accept it and go silent? `SCHEMA.md` section 2.7 is the binding
// derivation this script implements:
//
//   With client A connected and served (banner plus one successful
//   command), a second TCP connection B is opened to the same text port
//   under a stated 60s budget, and exactly one of three observations is
//   recorded as TEXT_SECOND_CONNECT_OBSERVATION:
//
//   - `accepted-and-served`  (B receives a banner and a command reply)
//                            maps to `multi`.
//   - `accepted-then-silent` (connect succeeds, no banner, no EOF within
//                            the budget) maps to `single`.
//   - `refused-outright`     (connection refused or reset) maps to
//                            `single`.
//
// A TIMEOUT ON B IS `single` VIA `accepted-then-silent`, NEVER `not-taken`
// ---------------------------------------------------------------------------
// This is the load-bearing trap this plan documents at length: a second
// connect() to a single-client server is documented as indistinguishable
// from a wedge under a short budget, and recording `not-taken` because a
// timeout expired would launder the real answer into silence. `not-taken`
// is reachable ONLY if client A itself could not be established.
//
// PASSIVE-THEN-CONFIRM SEQUENCING (the plan's own step ordering, read
// literally)
// ---------------------------------------------------------------------
// The plan's own step 3 requires waiting out the FULL 60s budget on
// connection B "without sending anything" -- a purely passive observation
// window, timestamping every connect/data/end/error/close event. Only
// AFTER that window is over does this probe send ONE confirming command on
// B (if, and only if, a banner was observed sometime during the passive
// window) to determine whether B is genuinely SERVED (a full round trip)
// as opposed to merely having been sent an initial banner with nothing
// following. This mirrors the established "capture before trusting"
// discipline this phase's throwaway text client documents for client A's
// own banner (D-13), extended here to the second connection.
//
// Reuses probe-harness.mjs and textmon-probe-client.mjs throughout (D-14):
// this file builds no wire frame itself for the binary channel and spawns
// genuine stock x64sc DIRECTLY (D-12), touching no broker state. Connection
// B is DELIBERATELY a bare `net.Socket`, not the throwaway text client
// wrapper -- so its raw behaviour is observed directly rather than through
// a wrapper that might time out on its own terms, per the plan's own
// requirement.
// -----------------------------------------------------------------------------
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import {
  PROBE_DIR,
  VICE_STOCK,
  allocPorts,
  buildProbeArgs,
  log,
  preflight,
  reapAll,
  sleep,
  spawnVice,
  testAutomatedBaseline,
  viceKind,
  viceVersion,
} from "./probe-harness.mjs";
import { awaitBanner, closeTextMonitor, connectTextMonitor, sendAndAwaitPrompt } from "./textmon-probe-client.mjs";

const SECOND_CONNECT_BUDGET_MS = 60000;
const FOLLOWUP_CONFIRM_BUDGET_MS = 10000;
const RUNS = 2;

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

/**
 * Open a bare `net.Socket` (never the wrapped throwaway client) to `port`,
 * and observe it for exactly `budgetMs` milliseconds WITHOUT sending
 * anything, recording every connect/data/end/error/close event timestamped
 * relative to the socket's own creation. Resolves the moment the budget
 * elapses, OR the moment the socket closes/errors before that (an early
 * refusal/reset does not need the rest of the budget to be meaningful).
 * Never resolves early merely because data arrived -- data is recorded,
 * not acted on, until the window itself is over (see file header).
 */
function passiveObserveConnectionB(port, { budgetMs = SECOND_CONNECT_BUDGET_MS } = {}) {
  return new Promise((resolve) => {
    const events = [];
    const t0 = Date.now();
    const push = (type, extra = {}) => events.push({ tMs: Date.now() - t0, type, ...extra });
    let settled = false;
    let connectFired = false;
    let gotBanner = false;
    let closedEarly = null;

    const sock = net.createConnection({ host: "127.0.0.1", port });

    const finish = (reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ reason, connectFired, gotBanner, closedEarly, events, sock });
    };

    sock.on("connect", () => {
      connectFired = true;
      push("connect");
    });
    sock.on("data", (chunk) => {
      gotBanner = true;
      push("data", { bytes: chunk.length, hex: chunk.toString("hex").slice(0, 400), text: chunk.toString("utf8").slice(0, 300) });
    });
    sock.on("end", () => push("end"));
    sock.on("close", (hadError) => {
      push("close", { hadError });
      if (!settled) {
        closedEarly = { hadError, whileWaitingForBanner: !gotBanner };
        finish("closed-during-window");
      }
    });
    sock.on("error", (err) => {
      push("error", { message: err.message, code: err.code });
      if (!settled) {
        closedEarly = { errorMessage: err.message, errorCode: err.code };
        finish("errored-during-window");
      }
    });

    const timer = setTimeout(() => {
      finish("budget-expired");
    }, budgetMs);
  });
}

/**
 * Send ONE confirming command on an already-open bare socket that showed a
 * banner during the passive window, and wait for a further `data` event
 * (the reply) within `budgetMs`. Only called AFTER the passive window is
 * over, per the plan's own step ordering.
 */
function confirmServed(sock, events, { budgetMs = FOLLOWUP_CONFIRM_BUDGET_MS } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const push = (type, extra = {}) => events.push({ tMs: Date.now() - t0, type, phase: "followup", ...extra });
    let settled = false;
    const onData = (chunk) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.off("data", onData);
      push("followup-data", { bytes: chunk.length, text: chunk.toString("utf8").slice(0, 300) });
      resolve({ replied: true });
    };
    sock.on("data", onData);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      sock.off("data", onData);
      resolve({ replied: false });
    }, budgetMs);
    push("followup-send", { command: "r" });
    try {
      sock.write("r\n");
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ replied: false, writeError: err.message });
      }
    }
  });
}

/** Classify the passive observation (plus the optional follow-up) into
 * exactly one of the three frozen enumerated members. */
async function classifyConnectionB(port, record, runIndex) {
  const passive = await passiveObserveConnectionB(port, { budgetMs: SECOND_CONNECT_BUDGET_MS });
  record(`CONNECTION_B_PASSIVE_WINDOW_RUN_${runIndex}: reason=${passive.reason} connectFired=${passive.connectFired} gotBanner=${passive.gotBanner}`);
  record(`CONNECTION_B_EVENT_LOG_RUN_${runIndex}: ${JSON.stringify(passive.events)}`);

  if (!passive.gotBanner) {
    if (passive.reason === "closed-during-window" || passive.reason === "errored-during-window") {
      try {
        passive.sock.destroy();
      } catch {}
      return { observation: "refused-outright", passive, followUp: null, acceptedLimit: false };
    }
    // budget-expired with no banner ever received -- accepted-then-silent
    // regardless of whether the TCP handshake itself completed
    // (connectFired): a socket that never connects at all within the
    // budget is functionally indistinguishable, for this experiment's
    // purposes, from one that connects and is never serviced -- both are
    // recorded, with connectFired stated explicitly alongside.
    try {
      passive.sock.destroy();
    } catch {}
    return { observation: "accepted-then-silent", passive, followUp: null, acceptedLimit: false };
  }

  // A banner WAS observed sometime during the passive window. Confirm
  // whether B is genuinely served with ONE follow-up send, now that the
  // passive window itself is over.
  const followUp = await confirmServed(passive.sock, passive.events, { budgetMs: FOLLOWUP_CONFIRM_BUDGET_MS });
  record(`CONNECTION_B_FOLLOWUP_RUN_${runIndex}: ${JSON.stringify(followUp)}`);

  if (followUp.replied) {
    return { observation: "accepted-and-served", passive, followUp, acceptedLimit: false };
  }
  // Banner arrived but the confirming send got no reply within budget -- an
  // ambiguous case the frozen three-way domain does not name directly.
  // Per SCHEMA.md's own carve-out (a gap in the pre-commitment is recorded
  // as an ## ACCEPTED LIMIT in this file, never invented as a new name),
  // resolved to `accepted-then-silent`: the connection was accepted and,
  // in the end, never demonstrably served a full round trip.
  try {
    passive.sock.destroy();
  } catch {}
  return { observation: "accepted-then-silent", passive, followUp, acceptedLimit: true };
}

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

  let sockA = null;
  const result = {
    runIndex,
    clientAServed: false,
    observation: null,
    value: null,
    interleave: null,
    postCloseAConfirmed: null,
    reason: null,
    voided: false,
  };

  try {
    // Step 2: establish client A as served (banner + one confirmed reply).
    // Note the binary channel is NOT touched anywhere in this probe -- this
    // gate input is measured purely on the text port, per the plan's own
    // scope.
    const { sock, ms: textBindMs } = await connectTextMonitorWithRetry(textPort, { budgetMs: 30000 });
    sockA = sock;
    log(`RUN_${runIndex}_CLIENT_A_TIME_TO_BIND_MS ${textBindMs}`);
    const banner = await awaitBanner(sockA, { timeoutMs: 10000 });
    record(`CLIENT_A_BANNER_RUN_${runIndex}: bytes=${banner.raw.length} matchedPromptRe=${banner.matchedPromptRe} hex=${banner.raw.toString("hex").slice(0, 200)}`);
    const reply = await sendAndAwaitPrompt(sockA, "r", { timeoutMs: 10000 });
    record(`CLIENT_A_COMMAND_REPLY_RUN_${runIndex}: matchedPromptRe=${reply.matchedPromptRe} replyLen=${reply.raw.length} text=${JSON.stringify(reply.text.slice(0, 200))}`);

    if (!reply.matchedPromptRe) {
      result.reason = "client A's own confirming command produced no framed (prompt-terminated) reply within budget -- client A itself could not be established as served";
      result.observation = "not-taken";
      result.value = "not-taken";
      result.voided = true;
      record(`VOID: run ${runIndex}: ${result.reason}`);
    } else {
      result.clientAServed = true;

      // Step 3-5: open connection B, observe passively for the full 60s
      // budget, classify.
      const classified = await classifyConnectionB(textPort, record, runIndex);
      result.observation = classified.observation;
      result.acceptedLimit = classified.acceptedLimit;
      record(`TEXT_SECOND_CONNECT_OBSERVATION: ${classified.observation}`);

      const mapping = { "accepted-and-served": "multi", "accepted-then-silent": "single", "refused-outright": "single" };
      result.value = mapping[classified.observation];
      record(`TEXT_SINGLE_CLIENT: ${result.value}`);

      // Step 6: where the observation is multi, additionally record
      // whether the two clients interleave coherently.
      if (classified.observation === "accepted-and-served") {
        const sockB = classified.passive.sock;
        try {
          const [replyA, replyB] = await Promise.all([
            sendAndAwaitPrompt(sockA, "r", { timeoutMs: 10000 }),
            (async () => {
              // sockB is a bare socket, not the wrapped client -- frame its
              // reply the same crude way (accumulate until PROMPT_RE, or
              // just take the first data chunk after the write since this
              // is a fact record, not a gate).
              return new Promise((resolve) => {
                let buf = Buffer.alloc(0);
                const onData = (chunk) => {
                  buf = Buffer.concat([buf, chunk]);
                  resolve({ raw: buf, text: buf.toString("utf8") });
                };
                sockB.once("data", onData);
                sockB.write("sw\n");
                setTimeout(() => resolve({ raw: buf, text: buf.toString("utf8"), timedOut: true }), 10000);
              });
            })(),
          ]);
          const aLooksLikeRegisters = /[A-Z]{1,2}:[0-9A-Fa-f]{2}/.test(replyA.text);
          const bLooksLikeStopwatch = /[Ss]topwatch/.test(replyB.text);
          result.interleave = {
            replyAText: replyA.text.slice(0, 200),
            replyBText: replyB.text.slice(0, 200),
            aLooksLikeRegisters,
            bLooksLikeStopwatch,
            correct: aLooksLikeRegisters && bLooksLikeStopwatch,
          };
          record(`INTERLEAVE_RUN_${runIndex}: ${JSON.stringify(result.interleave)}`);
        } catch (err) {
          result.interleave = { error: err.message };
          record(`INTERLEAVE_ERROR_RUN_${runIndex}: ${err.message}`);
        }
        try {
          sockB.destroy();
        } catch {}
      } else if (classified.passive.sock && !classified.passive.sock.destroyed) {
        try {
          classified.passive.sock.destroy();
        } catch {}
      }

      // Step 7: close B (already destroyed above in every branch), confirm
      // A is still served.
      const postCloseReply = await sendAndAwaitPrompt(sockA, "r", { timeoutMs: 10000 });
      result.postCloseAConfirmed = postCloseReply.matchedPromptRe === true;
      record(`CLIENT_A_POST_CLOSE_RECHECK_RUN_${runIndex}: matchedPromptRe=${postCloseReply.matchedPromptRe} text=${JSON.stringify(postCloseReply.text.slice(0, 200))}`);
    }
  } catch (err) {
    log(`RUN_${runIndex}_PROBE_ERROR ${err.stack ?? err.message}`);
    if (result.value === null) {
      result.value = "not-taken";
      result.observation = "not-taken";
      result.reason = `an unexpected error was thrown before client A could be confirmed served: ${err.message}`;
      result.voided = true;
      record(`VOID: run ${runIndex}: ${result.reason}`);
    }
  } finally {
    try {
      await closeTextMonitor(sockA);
    } catch {}
    reapAll();
    await sleep(500);
    if (emuStderr.trim()) log(`RUN_${runIndex}_EMULATOR_STDERR ${emuStderr.trim().split("\n").slice(0, 10).join(" | ")}`);
  }

  record(`RUN_${runIndex}_OUTCOME: observation=${result.observation} value=${result.value}`);
  return result;
}

/** Resolve two runs into one final value. Where they agree, that is the
 * answer. A voided (not-taken) run never overrides a genuinely measured
 * outcome from the other run. Where two genuinely measured runs disagree
 * (unexpected -- the underlying behaviour should be deterministic), the
 * disagreement is recorded loudly and resolved to `multi` -- the more
 * permissive/uncertain observation -- never averaged or silently dropped,
 * mirroring 39-04's own CROSS_CHANNEL_RESUME "resolves to the worse value"
 * rule applied to this gate's own domain. */
function resolveFinal(runs, record) {
  const measured = runs.filter((r) => r.value !== "not-taken");
  if (measured.length === 0) {
    record(`TEXT_SINGLE_CLIENT_RESOLUTION: both runs were not-taken -- final value is not-taken`);
    return { value: "not-taken", observation: "not-taken" };
  }
  if (measured.length === 1) {
    record(`TEXT_SINGLE_CLIENT_RESOLUTION: one run was not-taken (${runs.find((r) => r.value === "not-taken").reason}); the surviving run's outcome is authoritative`);
    return { value: measured[0].value, observation: measured[0].observation };
  }
  const values = new Set(measured.map((r) => r.value));
  if (values.size === 1) {
    return { value: measured[0].value, observation: measured[0].observation };
  }
  record(`TEXT_SINGLE_CLIENT_RESOLUTION: DISAGREEMENT between runs -- ${JSON.stringify(measured.map((r) => ({ run: r.runIndex, observation: r.observation, value: r.value })))}. Resolving to multi, never averaged.`);
  const multiRun = measured.find((r) => r.value === "multi");
  return { value: "multi", observation: multiRun.observation };
}

async function main() {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const record = (line) => log(line);

  log(`PROBE text-single-client-probe.mjs`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`DATE_UTC ${new Date().toISOString()}`);

  const pf = preflight();
  record(`BROKER_STATE: ${pf.broker}`);

  const runs = [];
  for (let i = 1; i <= RUNS; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const r = await runOnce(i, record);
    runs.push(r);
  }

  const resolved = resolveFinal(runs, record);
  record(`TEXT_SECOND_CONNECT_OBSERVATION: ${resolved.observation}`);
  record(`TEXT_SINGLE_CLIENT: ${resolved.value}`);

  log(`--- test:automated baseline ---`);
  const baseline = testAutomatedBaseline();
  record(`TEST_AUTOMATED_BASELINE: tests ${baseline.tests} / pass ${baseline.pass} / fail ${baseline.fail}`);
  record(`TEST_AUTOMATED_BASELINE_FILES: ${baseline.failingFiles.length ? baseline.failingFiles.join(", ") : "(none)"}`);

  const outPath = path.join(PROBE_DIR, "text-single-client-run.json");
  fs.writeFileSync(outPath, `${JSON.stringify({ runs, resolved, baseline }, null, 2)}\n`);
  log(`RUN_RECORD ${outPath}`);

  return 0;
}

process.exitCode = await main().catch((err) => {
  log(`FATAL ${err.stack ?? err.message}`);
  return 1;
});
