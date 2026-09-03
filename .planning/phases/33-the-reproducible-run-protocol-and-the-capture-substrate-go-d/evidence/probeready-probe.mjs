#!/usr/bin/env node
// -----------------------------------------------------------------------------
// probeready-probe.mjs -- Phase 33, plan 33-11, Task 3 (`REPRO-05` / `D-18`).
//
// WHAT THIS MEASURES
// ------------------
// The wall-clock time from `execve` to a bound, ANSWERING binary monitor, across
// the four launch profiles `33-06` threads through the control plane:
//
//   (none)                  the argv a stock launch has always emitted
//   {warp: true}            adds `-warp`
//   {headless: true}        adds `-console`
//   {warp, headless}        both
//
// FIVE launches per profile, twenty in total, so the recorded number is a RANGE
// and not one observation. That is the point of the task: research's own
// `-console` datum ("not bound at 3000 ms, bound at 5000 ms") is recorded in
// `33-RESEARCH.md` P5 explicitly as ONE observation rather than a measured
// latency, and this probe must not confirm it by assuming it.
//
// WHAT IT DOES NOT REIMPLEMENT
// ----------------------------
//   - The argv. Built by the SHIPPED `buildViceArgs()` from broker-launch.mts,
//     so the argv under measurement is the one the broker actually emits --
//     including `-console`'s load-bearing position at index 1 and the
//     unconditional determinism block.
//   - The readiness check. `probeReady()` from the same module is called
//     directly. Time-to-bind is therefore the time until the SHIPPED probe
//     says ready, on the shipped route, not until some local socket test
//     agrees.
//   - The budget. Read out of `broker-launch.mts`'s own source text rather than
//     typed here, because `DEFAULT_PROBE_TIMEOUT_S` is not exported and a typed
//     copy would silently drift from the value the launcher uses.
//
// WHAT THIS TASK MUST NOT DO, AND DOES NOT
// ----------------------------------------
// If the verdict is `short`, this plan RECORDS it and does not change the
// budget. The budget lives in host-bound launcher code whose edit requires a
// regenerated `resources/*.mjs` artifact in the same commit, and a timing
// change made from inside the measuring plan would be a change made in the same
// breath as the measurement that justifies it (`T-33-38`). The task's own verify
// asserts `git status --porcelain -- src/mcp/vice/` is empty.
//
// `SCHEMA.md` § 3 declares `probeReady`'s budget as NEVER a gate input, so a
// `short` verdict does not move `GATE-01`.
//
// WHAT NOT TO DO
// --------------
//   - Never treat "the port accepted a connection" as ready. An accepted TCP
//     connection is not a serving monitor; the listen backlog accepts before
//     the monitor services. `probeReady`'s stock route requires an ANSWERED
//     ping, which is the whole difference between liveness and readiness.
//   - Never unset `DISPLAY` for the profiles that have no `-console`. Two of
//     the four profiles are windowed by design, and measuring them on a
//     display-less environment would measure a GTK failure instead of a launch.
//     The environment is recorded per launch instead.
//   - Never omit `preflight()`. `D-11` lives in code, not in a shell habit.
// -----------------------------------------------------------------------------
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// --- shipped seams -----------------------------------------------------------

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");
const BROKER_LAUNCH_SRC = path.join(MCP_DIR, "broker-launch.mts");

const launch = await import(BROKER_LAUNCH_SRC);
const { buildViceArgs, probeReady, STOCK_DETERMINISM_FLAGS } = launch;

// --- fixed inputs ------------------------------------------------------------

const VICE_BIN = "/usr/bin/x64sc";
const PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase33", "33-11");

/** Five launches per profile, so the recorded figure is a range. */
const LAUNCHES_PER_PROFILE = 5;

/** The four profiles, in the order `33-06` names them. `undefined` is the
 *  absent profile, which `buildViceArgs()` documents as producing exactly the
 *  same argv as `{}` or as one whose knobs are both `false`. */
const PROFILES = [
  { name: "none", profile: undefined },
  { name: "warp", profile: { warp: true } },
  { name: "headless", profile: { headless: true } },
  { name: "warp+headless", profile: { warp: true, headless: true } },
];

const BASE_PORT = 6540;

// --- small helpers -----------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...parts) => process.stdout.write(`${parts.join(" ")}\n`);

// --- D-11 in code ------------------------------------------------------------

function systemdBrokerState() {
  try {
    return execFileSync("systemctl", ["--user", "is-active", "vice-broker"], { encoding: "utf8" }).trim();
  } catch (err) {
    return (err.stdout ?? "").trim() || "inactive";
  }
}

/** `pgrep -x`, never `-f`: `-f` matches this script's own command line. */
function aliveX64sc() {
  try {
    return execFileSync("pgrep", ["-x", "x64sc"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function preflight() {
  const broker = systemdBrokerState();
  const alive = aliveX64sc();
  log(`PREFLIGHT_BROKER ${broker}`);
  log(`PREFLIGHT_X64SC ${alive.length ? alive.join(",") : "(none)"}`);
  if (broker !== "inactive") throw new Error(`D-11 REFUSAL: the vice-broker unit is "${broker}", expected "inactive".`);
  if (alive.length) throw new Error(`D-11 REFUSAL: ${alive.length} other x64sc process(es) alive (${alive.join(",")}).`);
}

const CHILDREN = new Set();
function reapAll() {
  for (const child of CHILDREN) {
    try {
      child.kill("SIGKILL");
    } catch {}
  }
  CHILDREN.clear();
  try {
    execFileSync("pkill", ["-x", "x64sc"]);
  } catch {}
}
process.on("exit", reapAll);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    reapAll();
    process.exit(130);
  });
}

// --- the budget, read out of the shipped source ------------------------------

/**
 * `probeReady`'s budget as the launcher actually resolves it.
 *
 * `DEFAULT_PROBE_TIMEOUT_S` is a module-private `const` in broker-launch.mts,
 * so it is read out of that file's own source text rather than retyped -- a
 * typed copy would silently drift from the value the launcher uses, which is
 * exactly the class of error this phase is measuring.
 *
 * The env override `VICE_BROKER_PROBE_TIMEOUT_S` is reported too, because the
 * resolved budget is `Number(env) || DEFAULT`, so an unset or unparseable env
 * value falls back to the default.
 */
function resolveBudgetMs() {
  const src = fs.readFileSync(BROKER_LAUNCH_SRC, "utf8");
  const m = /const DEFAULT_PROBE_TIMEOUT_S = (\d+);/.exec(src);
  if (!m) throw new Error(`could not find DEFAULT_PROBE_TIMEOUT_S in ${BROKER_LAUNCH_SRC} -- refusing to assume a budget`);
  const defaultS = Number(m[1]);
  const envRaw = process.env.VICE_BROKER_PROBE_TIMEOUT_S;
  const resolvedS = Number(envRaw) || defaultS;
  return { defaultS, envRaw: envRaw ?? "(unset)", resolvedS, resolvedMs: resolvedS * 1000 };
}

// --- one launch --------------------------------------------------------------

/**
 * Spawn one instance and time the SHIPPED `probeReady()` until it says ready.
 *
 * The clock starts immediately before `spawn()` and stops on the first
 * `probeReady() === true`. Failed attempts are counted, because
 * `probeReady()` has NO retry loop of its own -- a still-booting instance
 * simply fails that pass and is re-probed on the next one -- so the count is
 * how many launcher passes the instance would have failed.
 */
async function oneLaunch({ profileName, profile, port, index }) {
  const args = buildViceArgs(port, { backend: "stock", profile });
  const argv = [VICE_BIN, ...args];
  const label = `${profileName}-${index}`;

  log(`LAUNCH ${label}`);
  log(`LAUNCH_PROFILE ${profile === undefined ? "(absent)" : JSON.stringify(profile)}`);
  log(`LAUNCH_ARGV ${JSON.stringify(argv)}`);
  log(`LAUNCH_ENV DISPLAY=${process.env.DISPLAY ?? "(unset)"} WAYLAND_DISPLAY=${process.env.WAYLAND_DISPLAY ?? "(unset)"}`);

  const xdg = path.join(PROBE_DIR, "xdg", `probeready-${label}`);
  fs.rmSync(xdg, { recursive: true, force: true });
  fs.mkdirSync(xdg, { recursive: true });

  const record = { label, profileName, profile: profile ?? null, port, argv, ready: false };

  let exited = null;
  let stderr = "";
  const t0 = Date.now();
  const child = spawn(argv[0], argv.slice(1), {
    env: { ...process.env, XDG_CONFIG_HOME: xdg },
    stdio: ["ignore", "pipe", "pipe"],
  });
  CHILDREN.add(child);
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });
  child.on("exit", (code, signal) => {
    exited = { code, signal, atMs: Date.now() - t0 };
  });

  let attempts = 0;
  const deadline = t0 + 30000;
  while (Date.now() < deadline) {
    if (exited) break;
    attempts += 1;
    // The SHIPPED readiness route, called directly. `backend: "stock"` selects
    // the one-PING-then-EXIT binary-monitor exchange rather than the fork
    // path's HTTP POST.
    const ok = await probeReady(port, { backend: "stock" });
    if (ok) {
      record.ready = true;
      record.timeToBindMs = Date.now() - t0;
      record.failedAttempts = attempts - 1;
      break;
    }
    await sleep(50);
  }
  if (!record.ready) {
    record.timeToBindMs = null;
    record.failedAttempts = attempts;
  }

  record.alive = exited === null;
  record.exited = exited;
  record.stderrHead = stderr.trim() ? stderr.trim().split("\n").slice(0, 8).join(" | ") : null;

  log(`LAUNCH_READY ${record.ready ? "yes" : "NO"}`);
  log(`LAUNCH_TIME_TO_BIND_MS ${record.timeToBindMs ?? "(never bound within 30000 ms)"}`);
  log(`LAUNCH_FAILED_PROBE_ATTEMPTS ${record.failedAttempts}`);
  log(`LAUNCH_ALIVE ${record.alive ? "yes" : `no (exit code=${exited.code} signal=${exited.signal} at ${exited.atMs} ms)`}`);
  if (record.stderrHead) log(`LAUNCH_STDERR ${record.stderrHead}`);

  try {
    child.kill("SIGKILL");
  } catch {}
  CHILDREN.delete(child);
  await sleep(700);
  const after = aliveX64sc();
  log(`POST_X64SC ${after.length ? after.join(",") : "(none)"}`);
  if (after.length) {
    try {
      execFileSync("pkill", ["-x", "x64sc"]);
    } catch {}
    log(`POST_X64SC_SWEPT ${after.join(",")}`);
  }
  return record;
}

// --- the verdict -------------------------------------------------------------

/** The task's declared rule: `adequate` when EVERY observed time-to-bind
 *  across all four profiles is below the current budget; `short` when any
 *  profile's maximum exceeded it. A launch that never bound at all counts as
 *  exceeding. */
function deriveBudgetVerdict(byProfile, budgetMs) {
  const offenders = [];
  for (const [name, stats] of byProfile) {
    if (stats.max === null || stats.max >= budgetMs) {
      offenders.push({ name, max: stats.max, budgetMs });
    }
  }
  return { value: offenders.length === 0 ? "adequate" : "short", offenders };
}

function summarise(records) {
  const bound = records.filter((r) => r.ready).map((r) => r.timeToBindMs);
  const neverBound = records.filter((r) => !r.ready).length;
  return {
    n: records.length,
    bound: bound.length,
    neverBound,
    min: bound.length ? Math.min(...bound) : null,
    max: bound.length && neverBound === 0 ? Math.max(...bound) : null,
    observedMax: bound.length ? Math.max(...bound) : null,
    values: records.map((r) => (r.ready ? r.timeToBindMs : "never")),
    died: records.filter((r) => !r.alive).length,
  };
}

// --- CLI ---------------------------------------------------------------------

const USAGE = `usage: node probeready-probe.mjs <command>

  run        twenty launches -- ${LAUNCHES_PER_PROFILE} across each of the four
             profiles -- timing the shipped probeReady() to first ready, then
             the comparison against the current budget and the three outcome
             lines
  preflight  D-11 only
`;

async function main() {
  const cmd = process.argv[2];
  if (cmd === "preflight") {
    preflight();
    return 0;
  }
  if (cmd !== "run") {
    process.stderr.write(USAGE);
    return cmd ? 1 : 0;
  }

  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const budget = resolveBudgetMs();

  log(`PROBE probeready-probe.mjs`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`NODE ${process.version}`);
  log(`VICE_VERSION ${execFileSync(VICE_BIN, ["--version"], { encoding: "utf8" }).trim()}`);
  log(`STOCK_DETERMINISM_FLAGS ${JSON.stringify(STOCK_DETERMINISM_FLAGS)}`);
  log(`BUDGET_SOURCE ${BROKER_LAUNCH_SRC} -- const DEFAULT_PROBE_TIMEOUT_S = ${budget.defaultS};`);
  log(`BUDGET_ENV VICE_BROKER_PROBE_TIMEOUT_S=${budget.envRaw}`);
  log(`BUDGET_RESOLVED_MS ${budget.resolvedMs}`);
  log(`LAUNCHES_PER_PROFILE ${LAUNCHES_PER_PROFILE}`);
  preflight();

  const all = [];
  const byProfile = new Map();
  let portOffset = 0;
  for (const spec of PROFILES) {
    const records = [];
    for (let i = 1; i <= LAUNCHES_PER_PROFILE; i += 1) {
      log("");
      log(`--- ${spec.name} launch ${i} of ${LAUNCHES_PER_PROFILE} -----------------------------`);
      const port = BASE_PORT + portOffset;
      portOffset += 1;
      const rec = await oneLaunch({ profileName: spec.name, profile: spec.profile, port, index: i });
      records.push(rec);
      all.push(rec);
      await sleep(400);
    }
    byProfile.set(spec.name, summarise(records));
  }

  fs.writeFileSync(path.join(PROBE_DIR, "probeready.json"), `${JSON.stringify(all, null, 2)}\n`);

  log("");
  log(`--- per-profile summary ----------------------------------------------`);
  for (const [name, s] of byProfile) {
    log(`PROFILE ${name} n=${s.n} bound=${s.bound} never_bound=${s.neverBound} died=${s.died} min_ms=${s.min ?? "-"} max_ms=${s.observedMax ?? "-"} values=${JSON.stringify(s.values)}`);
  }

  log("");
  log(`--- the comparison against the current budget ------------------------`);
  const verdict = deriveBudgetVerdict(byProfile, budget.resolvedMs);
  log(`CURRENT_BUDGET_MS ${budget.resolvedMs}`);
  for (const [name, s] of byProfile) {
    const max = s.observedMax;
    const head = max === null ? "(never bound)" : `${budget.resolvedMs - max} ms`;
    log(`HEADROOM ${name} max_observed=${max ?? "never"} budget=${budget.resolvedMs} headroom=${head}${max !== null && max >= budget.resolvedMs ? " (SHORTFALL)" : ""}`);
  }

  // `-warp` groups both warped profiles; `-console` groups both headless ones.
  // `warp+headless` is in both groups, deliberately: it carries both flags, so
  // it is evidence about each.
  const groupMax = (names) => {
    const vals = names.flatMap((n) => byProfile.get(n).values).filter((v) => v !== "never");
    const anyNever = names.some((n) => byProfile.get(n).neverBound > 0);
    return { max: vals.length ? Math.max(...vals) : null, anyNever };
  };
  const warpGroup = groupMax(["warp", "warp+headless"]);
  const consoleGroup = groupMax(["headless", "warp+headless"]);
  log(`WARP_GROUP profiles=[warp, warp+headless] max_observed=${warpGroup.max ?? "never"} any_never_bound=${warpGroup.anyNever ? "yes" : "no"}`);
  log(`CONSOLE_GROUP profiles=[headless, warp+headless] max_observed=${consoleGroup.max ?? "never"} any_never_bound=${consoleGroup.anyNever ? "yes" : "no"}`);

  log("");
  log(`--- research's single -console observation ---------------------------`);
  // `33-RESEARCH.md` P5 recorded ONE `-console` launch not bound at 3000 ms and
  // bound at 5000 ms, explicitly as one observation and not a measured latency.
  // Reproduced or not, that is a fact this run reports rather than a baseline
  // it confirms.
  const consoleRecs = all.filter((r) => r.profileName === "headless" || r.profileName === "warp+headless");
  const over3000 = consoleRecs.filter((r) => !r.ready || r.timeToBindMs >= 3000).length;
  log(`CONSOLE_LAUNCHES_MEASURED ${consoleRecs.length}`);
  log(`CONSOLE_LAUNCHES_AT_OR_OVER_3000_MS ${over3000}`);
  log(`RESEARCH_SINGLE_OBSERVATION_REPRODUCED ${over3000 > 0 ? "yes" : "no"}`);

  log("");
  log(`--- the derivation ---------------------------------------------------`);
  log(`DERIVED_PROBEREADY_BUDGET ${verdict.value}`);
  for (const o of verdict.offenders) {
    log(`SHORTFALL profile=${o.name} max_observed=${o.max ?? "never bound"} budget=${o.budgetMs}`);
  }
  log(`DERIVED_WARP_TIME_TO_BIND_MS_MAX ${warpGroup.max ?? "(never bound)"}`);
  log(`DERIVED_CONSOLE_TIME_TO_BIND_MS_MAX ${consoleGroup.max ?? "(never bound)"}`);
  return 0;
}

process.exitCode = await main();
