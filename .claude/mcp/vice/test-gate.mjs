#!/usr/bin/env node
// The ONE place naming which .claude/mcp/vice test files are manual-only
// versus safe for the automated regression gate (`npm run test:automated`).
//
// WHY THIS FILE EXISTS: a bare `node --test '*.test.*'` (the `npm test`
// script) globs all test files in this directory, but seven of them depend on
// manual host setup -- a real broker topology and a real emulator/display
// environment -- so they hang or need an opt-in env var rather than report
// outside the devcontainer. This is a disposition, not a bug: see
// `.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`
// (user-dispositioned 2026-08-12: "not a bug to fix... exclude them from the
// automated gate and treat them as manual"). BACK-02's and BROK-03's "the
// existing suite passes unchanged" criterion had no mechanically-checkable
// signal until an automated subset existed that actually terminates -- this
// file, plus `npm run test:automated`, is that subset's single source of
// truth for the rest of this milestone. `stock-live.test.ts` (plan 03-16)
// joined this list as the fourth entry: it is default-SKIP everywhere (never
// hangs), but it spawns a real emulator process when opted in via
// VICE_LIVE_STOCK_BIN, which is exactly the "manual host setup" disposition
// the other three already share.
//
// WHAT NOT TO DO: do not re-list these seven file names in a CI workflow, an
// npm script, or a second test runner anywhere else in this repo. If an
// eighth file needs the same treatment, add it to MANUAL_ONLY_TESTS below and
// nowhere else -- test-gate.test.ts's drift guard fails the build if a test
// file ever escapes both this list and the automated set, so a silent second
// list would desync from that guard the moment it existed.
//
// `stock-live-triage.test.ts` (plan 07-17) joined this list as the fifth
// entry: like `stock-live.test.ts`, it is default-SKIP everywhere (never
// hangs) but spawns a real emulator process -- including, for one of its own
// cases, a genuine kill-and-relaunch -- when opted in via
// VICE_LIVE_TRIAGE_BIN. Concurrent plan 07-13's `stock-live.test.ts` sibling
// stays this list's fourth entry unchanged.
//
// `stock-live-broker-monitor.test.ts` (quick task 260818-obc) joined this
// list as the SIXTH entry: it spawns a real broker daemon (resources/
// vice-broker.mjs, under bare node) AND a real emulator process it kills and
// lets the broker itself respawn, live-proving the broker-mediated
// monitor_held_elsewhere verdict. Like every sibling above it is default-SKIP
// everywhere (opt in via VICE_LIVE_BROKER_BIN) and never hangs CI.
//
// `stock-broker-live.test.ts` (audit item I-2, phase 8.2 plan 03) joined this
// list as the SEVENTH entry: it spawns a real broker daemon (resources/
// vice-broker.mjs, under bare node) AND a real genuine-stock emulator process
// per test case, launched through the real `buildViceArgs()`/`tryLaunchOne()`
// primitive rather than a hand-spawned argv -- the first test in the tree to
// do so -- and dispatches `vice_disk_attach`/`vice_autostart` against it. Like
// every sibling above it is default-SKIP everywhere (opt in via
// VICE_LIVE_STOCK_BIN) and never hangs CI.
//
// STANDING RULE (added 2026-08-18, quick task 260818-nh5): every payload
// shape a manual-only live suite depends on MUST have a mirror assertion in
// the automated set. A manual-only file is invisible to this gate by
// design, so a shape change with no automated mirror can red it silently --
// exactly what happened on 2026-08-18: `88b9a15` (WR-04) additively widened
// the restarted verdict's evidence with `jamObserved`, and
// `stock-live-triage.test.ts`'s exact-key-set assertion for that verdict
// went red on both real stock binaries with zero signal from this gate
// (1624/0 the whole time), surfacing only as a UAT test-8 miss. The worked
// example fixing it is `stock-diagnose.test.ts`'s shape oracle for the
// restarted verdict's evidence ("both restarted branches carry EXACTLY
// {baselineEpoch, currentEpoch, jamObserved}") -- it needs no emulator, so
// it runs here, and it fails the moment the live suite's assumed shape
// would.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

/** The exact seven test files dispositioned as manual-only. Frozen: extend
 * this array (never add a parallel list) if an eighth file needs the same
 * treatment. */
export const MANUAL_ONLY_TESTS = Object.freeze([
  "vice-broker-launch.test.ts",
  "vice-proxy.test.ts",
  "broker-e2e.test.ts",
  "stock-live.test.ts",
  "stock-live-triage.test.ts",
  "stock-live-broker-monitor.test.ts",
  "stock-broker-live.test.ts",
]);

/** Every `*.test.*` entry in `dir`, sorted, with every MANUAL_ONLY_TESTS
 * member removed. This -- not a second glob anywhere else -- is exactly what
 * `npm run test:automated` runs. */
export function automatedTestFiles(dir) {
  const all = readdirSync(dir).filter((f) => /\.test\.[a-zA-Z0-9]+$/.test(f));
  return all.filter((f) => !MANUAL_ONLY_TESTS.includes(f)).sort();
}

/** Spawn `node --test <files>` with stdio inherited so the child's own TAP
 * output reaches the caller directly, and return its exit code. Always an
 * argv array -- never a shell string -- so a file name can never be
 * interpreted by a shell. */
function runNodeTest(files) {
  const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main() {
  const manual = process.argv.includes("--manual");
  const files = manual ? [...MANUAL_ONLY_TESTS] : automatedTestFiles(process.cwd());
  process.exit(runNodeTest(files));
}

// Only run when invoked directly (`node test-gate.mjs` / `npm run
// test:automated`), never when imported by test-gate.test.ts's drift guard.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
