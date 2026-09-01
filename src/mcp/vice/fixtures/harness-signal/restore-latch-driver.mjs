#!/usr/bin/env node
// src/mcp/vice/fixtures/harness-signal/restore-latch-driver.mjs
//
// WHY THIS FILE EXISTS: to settle `WR-03` by measurement instead of leaving it
// as a doubt.
//
// `scripts/audit-mutation-harness.mjs` guards `restoreAll()` with a `restored`
// boolean so that the signal handler's restore and the subsequent `exit`
// handler's restore do not both write. `WR-03` questions whether that second
// call is a GENUINE no-op or a second write, and plan 32-14 expected to exercise
// it by construction and could not, because the signal handler never ran at all.
//
// THE MEASUREMENT HAS TO BE DISCRIMINATING, AND THE OBVIOUS ONE IS NOT. Calling
// `restoreAll()` twice and observing that the file still holds the original
// bytes proves nothing: a real no-op and a re-write of the same original bytes
// produce identical results, so that observation cannot tell them apart. It
// would "pass" against the very state `WR-03` doubts.
//
// So this driver CHANGES THE FILE BETWEEN THE TWO CALLS. After the first
// `restoreAll()` it writes a distinct sentinel by hand, then calls
// `restoreAll()` again. Now the two hypotheses predict different bytes:
//
//   - a genuine no-op  -> the sentinel SURVIVES
//   - a second write   -> the sentinel is overwritten with the original
//
// The verdict is printed as JSON so the parent asserts on the observation rather
// than on this file's opinion of it, and a failing observation exits non-zero
// with the same JSON attached.
//
// WHAT NOT TO DO:
//
//   - Do NOT "fix" the latch here if the sentinel turns out to be overwritten.
//     That outcome is a FINDING to record, not a defect to repair inside a
//     fixture. The plan that added this file measures the latch; it does not
//     change it.
//   - Do NOT reach into the harness's internal map. The pending count comes from
//     the exported `pendingRestoreCount()` accessor, which returns the map's
//     size and nothing else, so this driver can observe the machinery without
//     acquiring the ability to mutate it.
//
// Like its sibling this file lives under `fixtures/`, which `test-gate.mjs`'s
// non-recursive glob does not reach -- importing the harness registers a SIGINT
// handler that calls `process.exit(130)`, which must never happen inside the
// test runner.

import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { plant, restoreAll, pendingRestoreCount } from "../../../../../scripts/audit-mutation-harness.mjs";

const TARGET_NAME = "latch-target.txt";
const FIND = "HARNESS_LATCH_TARGET_ORIGINAL";
const REPLACE = "HARNESS_LATCH_TARGET_PLANTED";

/** Written by hand BETWEEN the two `restoreAll()` calls. Its survival is the
 * whole measurement. */
const SENTINEL = "HARNESS_LATCH_SENTINEL_WRITTEN_BETWEEN_CALLS";

/** Same deliberately non-UTF-8 tail as the signal driver's target, so the byte
 * comparisons here are byte comparisons in the same strong sense. */
function targetBytes() {
  return Buffer.concat([
    Buffer.from("// harness restore-latch target, written by the driver\n", "latin1"),
    Buffer.from(`${FIND}\n`, "latin1"),
    Buffer.from([0x00, 0xff, 0xfe, 0x80, 0xc3, 0x28]),
    Buffer.from("\n// end of target\n", "latin1"),
  ]);
}

function main() {
  const scratchRoot = process.argv[2];
  if (typeof scratchRoot !== "string" || scratchRoot.length === 0) {
    process.stderr.write("restore-latch-driver: usage: <scratch-root>\n");
    process.exit(2);
  }

  const absTarget = join(scratchRoot, TARGET_NAME);
  writeFileSync(absTarget, targetBytes());
  const original = readFileSync(absTarget);

  const row = {
    historicalPath: "fixtures/harness-signal/restore-latch-driver.mjs",
    plant: { kind: "worktree", file: TARGET_NAME, find: FIND, replace: REPLACE },
  };

  plant(scratchRoot, row);

  const planted = readFileSync(absTarget);
  const plantReallyHappened = !planted.equals(original) && planted.includes(REPLACE);
  const pendingCountBeforeFirstCall = pendingRestoreCount();

  // --- first call -------------------------------------------------------
  restoreAll();
  const afterFirst = readFileSync(absTarget);
  const restoredToOriginalAfterFirstCall = afterFirst.equals(original);
  const pendingCountAfterFirstCall = pendingRestoreCount();

  // --- the hand-written change that makes the second call discriminating --
  const sentinelBytes = Buffer.from(`${SENTINEL}\n`, "latin1");
  writeFileSync(absTarget, sentinelBytes);

  // --- second call ------------------------------------------------------
  restoreAll();
  const afterSecond = readFileSync(absTarget);
  const sentinelIntactAfterSecondCall = afterSecond.equals(sentinelBytes);
  const secondCallRewroteOriginal = afterSecond.equals(original);

  const verdict = {
    plantReallyHappened,
    pendingCountBeforeFirstCall,
    restoredToOriginalAfterFirstCall,
    pendingCountAfterFirstCall,
    sentinelIntactAfterSecondCall,
    secondCallRewroteOriginal,
    originalSha: original.toString("base64").slice(0, 24),
    afterSecondSha: afterSecond.toString("base64").slice(0, 24),
  };

  const ok =
    plantReallyHappened &&
    pendingCountBeforeFirstCall === 1 &&
    restoredToOriginalAfterFirstCall &&
    pendingCountAfterFirstCall === 0 &&
    sentinelIntactAfterSecondCall &&
    !secondCallRewroteOriginal;

  process.stdout.write(`${JSON.stringify(verdict)}\n`);
  if (!ok) {
    process.stderr.write(
      "restore-latch-driver: the latch did NOT behave as a genuine no-op. This is a finding to " +
        "record, not something for this fixture to repair.\n",
    );
    process.exit(1);
  }
}

main();
