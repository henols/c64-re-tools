#!/usr/bin/env node
// -----------------------------------------------------------------------------
// fixture-capture.mjs -- Phase 39, plan 39-07 (`CHAN-01`, D-17, D-18, D-19, D-20).
//
// THE FIRST TEXT-CHANNEL FIXTURE BATCH.
// --------------------------------------
// Captures the raw response bytes for a fixed set of parseable text-monitor
// commands, from BOTH binaries on this host (genuine unpatched stock VICE 3.9
// at /usr/bin/x64sc, and the patched fork VICE 3.10 at /usr/local/bin/x64sc),
// with the same five-key provenance discipline the binary-monitor fixtures
// under fixtures/binmon/ already carry. This is the ONLY place in this phase
// that writes to src/mcp/vice/fixtures/textmon/.
//
// WHAT NOT TO DO
// --------------
//   - Never hand-write or edit a payload or a sidecar. Every fixture here is
//     written by THIS script from what the binary actually returned; a
//     fixture is regenerated, never corrected.
//   - Never supply the provenance kind token by hand or from an environment
//     variable. viceKind() derives it from the resolved absolute path -- the
//     binmon fixture tree's own recorded incident (a wrong kind token
//     mislabelling the fork as stock for over two months) is the reason.
//   - Never commit a capture of a coexistence interleaving. Only parseable
//     single-command outputs become fixtures; the phase's other evidence
//     files (39-idle-coexist.md etc.) are where an interleaving's transcript
//     belongs -- the five-key contract's `command` field is meaningless for
//     a trace with no single command.
//
// Reuses probe-harness.mjs and textmon-probe-client.mjs throughout (D-14):
// this script builds no wire frame itself and spawns both binaries DIRECTLY
// (D-12), touching no broker state, resolved by absolute path only.
// -----------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  PROBE_DIR,
  VICE_STOCK,
  VICE_FORK,
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
import { awaitBanner, closeTextMonitor, connectTextMonitor, PROMPT_RE } from "./textmon-probe-client.mjs";

/**
 * DEVIATION (Rule 1 -- bug found live on the first real run against this
 * launch shape): the throwaway client's own `sendAndAwaitPrompt()` resolves
 * on the FIRST time `PROMPT_RE` matches the accumulated buffer's end, which
 * this script's own live capture proved wrong for THIS phase's purpose --
 * the stock text monitor frames every reply as an IMMEDIATE entry-echo
 * prompt (the current halted PC, written before the command has actually
 * executed), THEN the command's real output, THEN a final exit prompt. When
 * the entry-echo and the rest of the reply arrive as separate TCP segments
 * (routine for any command slow enough to compute, e.g. `memmapshow`
 * scanning all 65536 addresses), `sendAndAwaitPrompt()` matches on the
 * entry-echo alone and returns a truncated capture -- observed live: a
 * captured "access-map" case of exactly 10 bytes (the bare entry prompt),
 * with the real ~1.6MB memmapshow dump then misattributed to the NEXT
 * command's own capture instead (the paused/buffered socket flushes it to
 * whichever listener attaches next). `textmon-probe-client.mjs`'s own file
 * header already documents this shape of hazard as explicitly out of that
 * file's scope ("does NOT distinguish a prompt-shaped substring... wrong for
 * a protocol implementation that has to be robust"); this script needs
 * byte-exact captures for a parser specification (D-17), a bar the
 * throwaway client's crude first-match framing does not clear. Fixed here,
 * locally, without modifying `textmon-probe-client.mjs` itself (D-13: that
 * file is a throwaway and does not survive this phase) -- this is exactly
 * the "improve without widening a shared seam" case D-18 asks for elsewhere.
 *
 * `sendAndAwaitSettledReply()` below waits for `PROMPT_RE` to match, THEN
 * requires the socket to go quiet for `settleMs` before finalizing -- any
 * further data arriving during the quiet window resets it. This correctly
 * spans double-prompt (entry+exit) framing and large/slow outputs alike,
 * confirmed live: re-running the exact memmapshow/prof-flat/chis/bt/io
 * sequence with this helper produced clean, correctly-bounded captures with
 * no cross-command bleed (see 39-fixture-batch.md's own transcript).
 */
function sendAndAwaitSettledReply(sock, command, { settleMs = 800, maxMs = 30000 } = {}) {
  return new Promise((resolve) => {
    let buf = Buffer.alloc(0);
    let matchedOnce = false;
    let settleTimer = null;
    const hardTimer = setTimeout(() => {
      cleanup();
      resolve({ raw: buf, text: buf.toString("utf8"), matchedPromptRe: matchedOnce, timedOut: true });
    }, maxMs);
    const cleanup = () => {
      clearTimeout(hardTimer);
      if (settleTimer) clearTimeout(settleTimer);
      sock.removeListener("data", onData);
    };
    const armSettle = () => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        cleanup();
        resolve({ raw: buf, text: buf.toString("utf8"), matchedPromptRe: matchedOnce, timedOut: false });
      }, settleMs);
    };
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (PROMPT_RE.test(buf.toString("utf8"))) {
        matchedOnce = true;
        armSettle();
      }
    };
    sock.on("data", onData);
    if (command !== null) sock.write(`${command}\n`);
  });
}

/** connectTextMonitor() is a single-shot connect with no retry -- x64sc binds
 * its monitor sockets some time after execve() returns, not the instant it
 * returns (probe-harness.mjs's own connectWithRetry() doc comment, for the
 * binary port; every prior plan in this phase reproduces the same retry
 * shape locally for the text port, e.g. text-single-client-probe.mjs's
 * connectTextMonitorWithRetry()). Reused here rather than re-derived. */
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..");
const FIXTURE_DIR = path.join(REPO_ROOT, "src", "mcp", "vice", "fixtures", "textmon");

// The command set: the parseable outputs the next phase's parsers will
// consume, per the plan. `command: null` marks the one case captured from
// the connect banner itself, with nothing sent.
const COMMAND_SET = [
  { caseBase: "access-map", command: "memmapshow" },
  { caseBase: "flat-profile", command: "prof flat 5" },
  { caseBase: "cpu-history", command: "chis 4" },
  { caseBase: "backtrace", command: "bt" },
  { caseBase: "register-decode", command: "io $d020" },
  { caseBase: "connect-banner", command: null },
];

/** Text a monitor reply as an unsupported-command refusal. VICE's stock
 * refusal shapes are matched loosely and disclosed (with the exact matched
 * text) in the evidence file rather than assumed from documentation --
 * this function's return value is a candidate flag, not the final verdict;
 * the evidence file records the raw text either way. */
function looksUnsupported(text) {
  return /not supported|not available|unknown command|no such command|not implemented|disabled/i.test(text);
}

/** A bounded preview of a (possibly very large -- ~1.6MB for memmapshow)
 * captured reply, for the transcript. The full, authoritative bytes are
 * ALWAYS written verbatim to the committed <case>.txt fixture -- this
 * preview exists only so the evidence transcript stays readable; it is
 * never itself treated as the capture. */
function previewText(text, { head = 300, tail = 300 } = {}) {
  if (text.length <= head + tail + 20) return JSON.stringify(text);
  return `${JSON.stringify(text.slice(0, head))} ...[elided ${text.length - head - tail} chars]... ${JSON.stringify(text.slice(-tail))}`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function writeFixture(caseName, rawBuffer, sidecar) {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const payloadPath = path.join(FIXTURE_DIR, `${caseName}.txt`);
  const jsonPath = path.join(FIXTURE_DIR, `${caseName}.json`);
  fs.writeFileSync(payloadPath, rawBuffer);
  fs.writeFileSync(jsonPath, `${JSON.stringify(sidecar, null, 2)}\n`);
  return { payloadPath, jsonPath, bytes: rawBuffer.length };
}

/** Drive one binary through the whole command set once, returning a map of
 * caseBase -> { raw, text, matchedPromptRe, refusalCandidate }. */
async function captureOneBinary(binPath, record) {
  const kind = viceKind(binPath);
  const version = viceVersion(binPath);
  record(`VICE_BINARY: ${kind}:${binPath}`);
  record(`VICE_VERSION_OBSERVED: ${version}`);

  const { binaryPort, textPort } = await allocPorts();
  const argv = buildProbeArgs({ binaryPort, textPort, headless: true });
  record(`$ ${binPath} ${argv.join(" ")}`);
  const emu = spawnVice(binPath, argv);
  let emuStderr = "";
  emu.stderr.on("data", (d) => {
    emuStderr += d.toString();
  });
  emu.stdout.on("data", () => {});

  const captured = {};
  let sock = null;
  try {
    const { sock: connectedSock, ms: bindMs } = await connectTextMonitorWithRetry(textPort, { budgetMs: 30000 });
    sock = connectedSock;
    record(`TEXT_BIND_MS_${kind.toUpperCase()}: ${bindMs}`);
    const banner = await awaitBanner(sock, { timeoutMs: 10000 });
    record(
      `CONNECT_BANNER_${kind.toUpperCase()}: bytes=${banner.raw.length} matchedPromptRe=${banner.matchedPromptRe} hex=${banner.raw.toString("hex").slice(0, 200)}`,
    );
    captured["connect-banner"] = { raw: banner.raw, text: banner.text, matchedPromptRe: banner.matchedPromptRe };

    // Turn profiling on while still halted (the flag itself does not need a
    // running CPU), then resume so the CPU actually executes and accumulates
    // real cycles/history/call-stack state before the rest of the command
    // set is captured. Per probe-harness.mjs's own EXIT documentation, this
    // is sent exactly once and nothing else is sent for the duration of the
    // free-running window that follows.
    const profOn = await sendAndAwaitSettledReply(sock, "prof on", { settleMs: 500, maxMs: 10000 });
    record(`SETUP_PROF_ON_${kind.toUpperCase()}: matchedPromptRe=${profOn.matchedPromptRe} text=${JSON.stringify(profOn.text.slice(0, 200))}`);
    sock.write("x\n");
    record(`SETUP_RESUME_${kind.toUpperCase()}: sent x (EXIT), no reply awaited -- free-running window follows`);
    await sleep(2500);

    for (const { caseBase, command } of COMMAND_SET) {
      if (command === null) continue; // connect-banner already captured above
      // eslint-disable-next-line no-await-in-loop
      const reply = await sendAndAwaitSettledReply(sock, command, { settleMs: 800, maxMs: 30000 });
      const refusalCandidate = looksUnsupported(reply.text);
      record(
        `CAPTURE_${kind.toUpperCase()}_${caseBase}: command=${JSON.stringify(command)} bytes=${reply.raw.length} sha256=${sha256(reply.raw)} matchedPromptRe=${reply.matchedPromptRe} refusalCandidate=${refusalCandidate}`,
      );
      record(`CAPTURE_${kind.toUpperCase()}_${caseBase}_TEXT: ${previewText(reply.text)}`);
      captured[caseBase] = { raw: reply.raw, text: reply.text, matchedPromptRe: reply.matchedPromptRe, refusalCandidate };
    }
  } finally {
    try {
      await closeTextMonitor(sock);
    } catch {}
    reapAll();
    await sleep(500);
    if (emuStderr.trim()) record(`EMULATOR_STDERR_${kind.toUpperCase()}: ${emuStderr.trim().split("\n").slice(0, 10).join(" | ")}`);
  }

  return captured;
}

async function main() {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const record = (line) => log(line);

  log(`PROBE fixture-capture.mjs`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`DATE_UTC ${new Date().toISOString()}`);

  const pf = preflight();
  record(`BROKER_STATE: ${pf.broker}`);

  const results = {};
  for (const binPath of [VICE_STOCK, VICE_FORK]) {
    // eslint-disable-next-line no-await-in-loop
    results[viceKind(binPath)] = await captureOneBinary(binPath, record);
  }

  // Write fixtures: one payload+sidecar pair per command per binary, plus the
  // connect-banner pair. Divergence check happens after both runs.
  const capturedAt = new Date().toISOString();
  const writtenCases = [];
  const allBytesFlat = [];
  const unsupportedCases = [];

  for (const { caseBase, command } of COMMAND_SET) {
    for (const kindName of ["stock", "fork"]) {
      const binPath = kindName === "stock" ? VICE_STOCK : VICE_FORK;
      const entry = results[kindName][caseBase];
      if (!entry) continue;
      const refusal = entry.refusalCandidate === true;
      const caseName = refusal ? `${caseBase}-unsupported-${kindName}` : `${caseBase}-${kindName}`;
      const sidecar = {
        capturedFrom: `${kindName}:${binPath}`,
        viceVersion: viceVersion(binPath),
        capturedAt,
        command: command === null ? "(connect banner, no command sent)" : command,
        synthetic: false,
      };
      if (refusal) {
        sidecar.note = `Real capture from the ${kindName} build (${binPath}), whose text monitor refused this command. Missing capability: the tracing/profiling support "${command}" needs. This support is opt-OUT at build time (the opposite of a version floor); this refusal says nothing about any other command's support on this or any other binary. Raw reply: ${JSON.stringify(entry.text.slice(0, 300))}`;
      }
      const written = writeFixture(caseName, entry.raw, sidecar);
      record(
        `FIXTURE_WRITTEN: case=${caseName} bytes=${written.bytes} sha256=${sha256(entry.raw)} payload=${path.relative(REPO_ROOT, written.payloadPath)} sidecar=${path.relative(REPO_ROOT, written.jsonPath)}`,
      );
      writtenCases.push({ caseBase, kindName, caseName, bytes: entry.raw, refusal, command });
      allBytesFlat.push(entry.raw);
      if (refusal) unsupportedCases.push(`${caseBase} (${kindName})`);
    }
  }

  // Divergence check: for each command, compare stock vs fork raw bytes.
  const divergent = [];
  for (const { caseBase } of COMMAND_SET) {
    const stockEntry = writtenCases.find((w) => w.caseBase === caseBase && w.kindName === "stock");
    const forkEntry = writtenCases.find((w) => w.caseBase === caseBase && w.kindName === "fork");
    if (!stockEntry || !forkEntry) continue;
    if (stockEntry.refusal !== forkEntry.refusal || !stockEntry.bytes.equals(forkEntry.bytes)) {
      divergent.push(caseBase);
      record(
        `DIVERGENCE_${caseBase}: stock refusal=${stockEntry.refusal} bytes=${stockEntry.bytes.length}; fork refusal=${forkEntry.refusal} bytes=${forkEntry.bytes.length}`,
      );
    }
  }

  const fixtureCount = writtenCases.length;
  const binariesUsed = new Set(writtenCases.map((w) => w.kindName)).size;
  const allByteArray = Buffer.concat(allBytesFlat);
  let hasHighBytes = false;
  for (const byte of allByteArray) {
    if (byte > 0x7f) {
      hasHighBytes = true;
      break;
    }
  }
  const encoding = hasHighBytes ? "has-high-bytes" : "ascii-7bit";

  record(`FIXTURE_COUNT: ${fixtureCount}`);
  record(`FIXTURE_BINARIES: ${binariesUsed}`);
  record(`FIXTURE_ENCODING: ${encoding}`);
  record(`FIXTURE_DIVERGENCE: ${divergent.length ? divergent.join(", ") : "none"}`);
  record(`FIXTURE_UNSUPPORTED: ${unsupportedCases.length ? unsupportedCases.join(", ") : "none"}`);

  log(`--- test:automated baseline ---`);
  const baseline = testAutomatedBaseline();
  record(`TEST_AUTOMATED_BASELINE: tests ${baseline.tests} / pass ${baseline.pass} / fail ${baseline.fail}`);
  record(`TEST_AUTOMATED_BASELINE_FILES: ${baseline.failingFiles.length ? baseline.failingFiles.join(", ") : "(none)"}`);

  const outPath = path.join(PROBE_DIR, "fixture-capture-run.json");
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        writtenCases: writtenCases.map((w) => ({ caseBase: w.caseBase, kindName: w.kindName, caseName: w.caseName, byteLength: w.bytes.length, refusal: w.refusal, command: w.command })),
        divergent,
        fixtureCount,
        binariesUsed,
        encoding,
        unsupportedCases,
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
