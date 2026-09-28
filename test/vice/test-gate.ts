#!/usr/bin/env node
// test-gate.ts
//
// WHY THIS FILE EXISTS: the ONE place naming which server test files (in
// this directory, test/vice/) are manual-only versus safe for the automated
// regression gate (`npm run test:automated` in src/mcp/vice). `npm test`
// globs every `*.test.*` file in this directory; the eleven MANUAL_ONLY_TESTS entries below are excluded from the
// automated gate because they need genuine manual host setup -- a real
// broker topology, a real emulator/display environment, or an installed
// external binary such as dxa or Ghidra -- and are default-SKIP behind an
// opt-in env var. Run them with `npm run test:manual`.
//
// `vice-proxy.test.ts` is the one exception: it needs no host dependency and
// terminates cleanly, but it spawns a real child process per test case and
// takes about 26-27 seconds per run. It stays manual-only for that per-run
// cost, which is unsuited to a gate meant to run on every edit.
//
// STANDING RULE: every payload shape a manual-only live suite depends on
// MUST have a mirror assertion in the automated set. A manual-only file is
// invisible to this gate by design, so a shape change with no automated
// mirror can red it silently.
//
// WHAT NOT TO DO:
//   - Never re-list these file names in a CI workflow, an npm script, or a
//     second test runner. A new manual-only file goes into MANUAL_ONLY_TESTS
//     below and nowhere else.
//   - Never add a manual-only suite without an automated mirror for the
//     payload shapes it depends on (see the STANDING RULE above).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The test files dispositioned as manual-only. Frozen: extend this array
 * (never add a parallel list) if another file needs the same treatment. */
export const MANUAL_ONLY_TESTS: readonly string[] = Object.freeze([
  "vice-broker-launch.test.ts",
  "vice-proxy.test.ts",
  "broker-e2e.test.ts",
  "stock-live.test.ts",
  "stock-broker-live.test.ts",
  "stock-a4-checkpoint-flood.test.ts",
  "dxa-live.test.ts",
  "ghidra-live.test.ts",
  "ghidra-opcode-live.test.ts",
  "text-monitor-live.test.ts",
  "stock-live-relay.test.ts",
]);

/** Every `*.test.*` entry in `dir`, sorted, with every MANUAL_ONLY_TESTS
 * member removed. This -- not a second glob anywhere else -- is exactly what
 * `npm run test:automated` runs. */
export function automatedTestFiles(dir: string): string[] {
  const all = readdirSync(dir).filter((f) => /\.test\.[a-zA-Z0-9]+$/.test(f));
  return all.filter((f) => !MANUAL_ONLY_TESTS.includes(f)).sort();
}

/** This file's own directory: the tests sit beside it, whatever the cwd. */
const HERE = dirname(fileURLToPath(import.meta.url));

/** Spawn `node --test <files>` with stdio inherited so the child's own TAP
 * output reaches the caller directly, and return its exit code. Always an
 * argv array -- never a shell string -- so a file name can never be
 * interpreted by a shell. */
function runNodeTest(files: readonly string[]): number {
  const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main(): void {
  const manual = process.argv.includes("--manual");
  const files = manual ? [...MANUAL_ONLY_TESTS] : automatedTestFiles(HERE);
  process.exit(runNodeTest(files.map((f) => join(HERE, f))));
}

// Only run when invoked directly (`node test-gate.ts` / `npm run
// test:automated`), never when imported.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
