#!/usr/bin/env node
// 64-g643-g644-live-run.mjs
//
// The reproducible orchestration for plan 64-14's live measurement of G-64-3
// (the upload-publish race behind 0x8f on vice_disk_attach/vice_snapshot_load/
// vice_autostart) and G-64-4 (a cold session's first attach racing the
// freshly-launched emulator's own bind), against the real broker and the
// absolute /usr/bin/x64sc.
//
// Reuses the ONE spawn/transcript implementation this phase already committed
// (evidence/64-g641-live-driver.mjs's spawnLiveDriverSession()/parsedContentOf())
// rather than re-implementing stdio JSON-RPC framing a second time. Never
// asserts anything about pass/fail itself -- it prints a JSON summary per
// phase and the caller (this plan's own SUMMARY.md and the Task <verify>
// blocks) judges it.
//
// EMBEDS NO MACHINE-SPECIFIC PATH. Every path (proxy, subjects, per-session
// client-project directories, transcript directory) arrives on the command
// line, exactly like 64-g641-live-driver.mjs's own CLI contract.

import { spawnLiveDriverSession, parsedContentOf } from "./64-g641-live-driver.mjs";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function parseArgs(argv) {
  const opts = {
    phases: ["cold", "cold-text", "recycle", "loop", "autostart"],
    coldSessions: 5,
    coldTextSessions: 2,
    loopIterations: 15,
    autostartCount: 5,
    env: {},
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--proxy-path") opts.proxyPath = argv[++i];
    else if (a === "--scratch-root") opts.scratchRoot = argv[++i];
    else if (a === "--subjects-dir") opts.subjectsDir = argv[++i];
    else if (a === "--transcript-dir") opts.transcriptDir = argv[++i];
    else if (a === "--clients-dir") opts.clientsDir = argv[++i];
    else if (a === "--summary-out") opts.summaryOut = argv[++i];
    else if (a === "--phases") opts.phases = argv[++i].split(",").filter(Boolean);
    else if (a === "--cold-sessions") opts.coldSessions = Number(argv[++i]);
    else if (a === "--coldtext-sessions") opts.coldTextSessions = Number(argv[++i]);
    else if (a === "--loop-iterations") opts.loopIterations = Number(argv[++i]);
    else if (a === "--autostart-count") opts.autostartCount = Number(argv[++i]);
    else throw new Error(`unrecognised argument: ${a}`);
  }
  if (!opts.proxyPath || !opts.scratchRoot || !opts.subjectsDir || !opts.transcriptDir || !opts.clientsDir) {
    throw new Error(
      "usage: 64-g643-g644-live-run.mjs --proxy-path <path> --scratch-root <dir> --subjects-dir <dir> " +
        "--clients-dir <dir> --transcript-dir <dir> [--summary-out <file>] [--phases cold,cold-text,recycle,loop,autostart] " +
        "[--cold-sessions N] [--coldtext-sessions N] [--loop-iterations N] [--autostart-count N]",
    );
  }
  return opts;
}

/** Returns true iff `ps` currently shows no process whose command line
 * contains "x64sc" -- used only as a pacing signal between cold sessions
 * (never asserted as evidence itself; the journal's own `launching` line
 * count, read by this plan's Task <verify> blocks, is the actual proof that
 * each session cold-launched). */
function noX64scProcessRunning() {
  try {
    const out = execFileSync("ps", ["-eo", "pid,cmd"], { encoding: "utf8" });
    return !out
      .split("\n")
      .slice(1)
      .some((line) => /x64sc/.test(line));
  } catch {
    return true;
  }
}

async function waitForNoX64scProcess({ timeoutMs = 10000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (noX64scProcessRunning()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return noX64scProcessRunning();
}

/** Records one call's outcome in the shape every phase summary shares:
 * tool name, isError, elapsed milliseconds, and whether the result text
 * contains "0x8f" or "abandoned" -- the two textual signatures G-64-3 and
 * G-64-4 each name. `resp` is the raw tools/call JSON-RPC response;
 * `content` is `parsedContentOf(resp)` when parseable. */
function summarizeCall(tool, resp, elapsedMs, extra = {}) {
  const content = parsedContentOf(resp);
  const isError = resp && resp.result ? Boolean(resp.result.isError) : null;
  const rawText =
    resp && resp.result && Array.isArray(resp.result.content) && typeof resp.result.content[0]?.text === "string"
      ? resp.result.content[0].text
      : "";
  return {
    tool,
    isError,
    elapsedMs,
    contains0x8f: rawText.includes("0x8f"),
    containsAbandoned: rawText.includes("abandoned"),
    text: rawText,
    content,
    ...extra,
  };
}

async function timedCall(session, tool, args, opts) {
  const start = Date.now();
  const resp = await session.callTool(tool, args, opts);
  const elapsedMs = Date.now() - start;
  return summarizeCall(tool, resp, elapsedMs);
}

async function runColdPhase(opts, phaseName, sessionCount, toolName, toolArgs) {
  const results = [];
  for (let i = 1; i <= sessionCount; i++) {
    const clientDir = join(opts.clientsDir, `${phaseName}${i}`);
    mkdirSync(clientDir, { recursive: true });
    const transcriptPath = join(opts.transcriptDir, `${phaseName}-${i}.jsonl`);
    const session = spawnLiveDriverSession({
      proxyPath: opts.proxyPath,
      clientProjectDir: clientDir,
      transcriptPath,
    });
    await session.handshake();
    const call = await timedCall(session, toolName, toolArgs, { timeoutMs: 30000 });
    call.session = i;
    call.retried = false;
    results.push(call);
    await session.close();
    await waitForNoX64scProcess({ timeoutMs: 10000 });
  }
  return results;
}

async function runRecyclePhase(opts) {
  const clientDir = join(opts.clientsDir, "recycle");
  mkdirSync(clientDir, { recursive: true });
  const transcriptPath = join(opts.transcriptDir, "recycle.jsonl");
  const session = spawnLiveDriverSession({ proxyPath: opts.proxyPath, clientProjectDir: clientDir, transcriptPath });
  await session.handshake();

  const results = [];
  results.push({ step: "cold-ping", ...(await timedCall(session, "vice_ping", {}, { timeoutMs: 30000 })) });
  results.push({
    step: "recycle",
    ...(await timedCall(session, "vice_recycle", { reason: "64-14 G-64-3/G-64-4 live measurement: proving the first attach after a recycle" }, { timeoutMs: 30000 })),
  });
  results.push({ step: "post-recycle-ping", ...(await timedCall(session, "vice_ping", {}, { timeoutMs: 30000 })) });
  results.push({ step: "extra-ping", ...(await timedCall(session, "vice_ping", {}, { timeoutMs: 30000 })) });

  await session.close();
  await waitForNoX64scProcess({ timeoutMs: 10000 });
  return results;
}

async function runLoopPhase(opts) {
  const clientDir = join(opts.clientsDir, "loop");
  mkdirSync(clientDir, { recursive: true });
  const transcriptPath = join(opts.transcriptDir, "loop.jsonl");
  const session = spawnLiveDriverSession({ proxyPath: opts.proxyPath, clientProjectDir: clientDir, transcriptPath });
  await session.handshake();

  const results = [];
  const blankPath = join(opts.subjectsDir, "blank.d64");
  for (let iter = 1; iter <= opts.loopIterations; iter++) {
    for (let p = 1; p <= 3; p++) {
      results.push({
        iteration: iter,
        pair: p,
        ...(await timedCall(session, "vice_memory_read", { address: "$C000", size: 1 }, { timeoutMs: 30000 })),
      });
      results.push({
        iteration: iter,
        pair: p,
        ...(await timedCall(session, "vice_execution_run", {}, { timeoutMs: 30000 })),
      });
    }
    results.push({
      iteration: iter,
      ...(await timedCall(session, "vice_snapshot_save", { name: "g6434_loop" }, { timeoutMs: 30000 })),
    });
    results.push({
      iteration: iter,
      ...(await timedCall(session, "vice_snapshot_load", { name: "g6434_loop" }, { timeoutMs: 30000 })),
    });
    results.push({
      iteration: iter,
      ...(await timedCall(session, "vice_disk_attach", { unit: 8, path: blankPath }, { timeoutMs: 30000 })),
    });
  }

  await session.close();
  await waitForNoX64scProcess({ timeoutMs: 10000 });
  return results;
}

async function runAutostartPhase(opts) {
  const clientDir = join(opts.clientsDir, "autostart");
  mkdirSync(clientDir, { recursive: true });
  const transcriptPath = join(opts.transcriptDir, "autostart.jsonl");
  const session = spawnLiveDriverSession({ proxyPath: opts.proxyPath, clientProjectDir: clientDir, transcriptPath });
  await session.handshake();

  const subjectPath = join(opts.subjectsDir, "subject.d64");
  const results = [];
  for (let i = 1; i <= opts.autostartCount; i++) {
    results.push({
      attempt: i,
      ...(await timedCall(session, "vice_autostart", { path: subjectPath, run: true, index: 0 }, { timeoutMs: 30000 })),
    });
  }

  const poll = await session.pollTool(
    "vice_memory_read",
    { address: "$C000", size: 1 },
    (content) => content && (content.hex === "c9" || content.hex === "C9"),
    { timeoutMs: 90000, intervalMs: 2000, callTimeoutMs: 30000 },
  );

  await session.close();
  await waitForNoX64scProcess({ timeoutMs: 10000 });
  return { burst: results, sentinelPoll: { matched: poll.matched, attempts: poll.attempts, lastContent: poll.lastContent } };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(opts.transcriptDir, { recursive: true });
  mkdirSync(opts.clientsDir, { recursive: true });

  const summary = {};

  if (opts.phases.includes("cold")) {
    summary.cold = await runColdPhase(opts, "cold", opts.coldSessions, "vice_ping", {});
  }
  if (opts.phases.includes("cold-text")) {
    summary.coldText = await runColdPhase(opts, "coldtext", opts.coldTextSessions, "vice_warp_set", { enabled: false });
  }
  if (opts.phases.includes("recycle")) {
    summary.recycle = await runRecyclePhase(opts);
  }
  if (opts.phases.includes("loop")) {
    summary.loop = await runLoopPhase(opts);
  }
  if (opts.phases.includes("autostart")) {
    summary.autostart = await runAutostartPhase(opts);
  }

  const stagingDir = join(process.env.HOME ?? "", ".c64-re-tools", "staging");
  summary.stagingAfterRun = existsSync(stagingDir) ? readdirSync(stagingDir) : [];

  const out = JSON.stringify(summary, null, 2);
  process.stdout.write(out + "\n");
  if (opts.summaryOut) {
    writeFileSync(opts.summaryOut, out);
  }
}

main().catch((e) => {
  process.stderr.write(`64-g643-g644-live-run: ${e && e.stack ? e.stack : e}\n`);
  process.exitCode = 1;
});
