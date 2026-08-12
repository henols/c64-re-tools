#!/usr/bin/env node
// The ONE place naming which .claude/mcp/vice test files are manual-only
// versus safe for the automated regression gate (`npm run test:automated`).
//
// WHY THIS FILE EXISTS: a bare `node --test '*.test.*'` (the `npm test`
// script) globs all test files in this directory, but three of them depend on
// manual host setup -- a real broker topology and a real emulator/display
// environment -- so they hang rather than report outside the devcontainer.
// This is a disposition, not a bug: see
// `.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`
// (user-dispositioned 2026-08-12: "not a bug to fix... exclude them from the
// automated gate and treat them as manual"). BACK-02's and BROK-03's "the
// existing suite passes unchanged" criterion had no mechanically-checkable
// signal until an automated subset existed that actually terminates -- this
// file, plus `npm run test:automated`, is that subset's single source of
// truth for the rest of this milestone.
//
// WHAT NOT TO DO: do not re-list these three file names in a CI workflow, an
// npm script, or a second test runner anywhere else in this repo. If a fourth
// file needs the same treatment, add it to MANUAL_ONLY_TESTS below and
// nowhere else -- test-gate.test.ts's drift guard fails the build if a test
// file ever escapes both this list and the automated set, so a silent second
// list would desync from that guard the moment it existed.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

/** The exact three test files dispositioned as manual-only. Frozen: extend
 * this array (never add a parallel list) if a fourth file needs the same
 * treatment. */
export const MANUAL_ONLY_TESTS = Object.freeze([
  "vice-broker-launch.test.ts",
  "vice-proxy.test.ts",
  "broker-e2e.test.ts",
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
