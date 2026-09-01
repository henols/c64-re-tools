#!/usr/bin/env node
// src/mcp/vice/fixtures/harness-signal/restore-disarm-driver.mjs
//
// WHY THIS FILE EXISTS: to open the SECOND window, which its two siblings never
// reach, and which is the one the machinery was measured to be blind in.
//
// `signal-window-driver.mjs` plants ONCE per child process and then awaits, so a
// signal arriving during its hold reaches a restore path that has never run
// before. `restore-latch-driver.mjs` calls the restore path twice but never
// signals. Neither combination can see the defect the round-3 verifier
// reproduced: once ONE restore cycle has completed in a process, a plant
// captured AFTER it was left on disk when the process was interrupted --
// `EXIT=130`, `pendingRestoreCount()` = 1, `FINAL ON DISK: PLANTED_TWO`
// (`CR-10`, gap 2).
//
// So this driver does what neither sibling does, in one process:
//
//   1. IMPORT the harness. Its `IS_ENTRY_POINT` guard keeps `main()` from
//      running on import while the four `process.on(...)` registrations at
//      module scope DO run, so the real `exit`, `SIGINT`, `SIGTERM` and
//      `uncaughtException` handlers are live here exactly as they are during a
//      real sweep.
//   2. PLANT a first mutation into a throwaway scratch root, through the
//      harness's own exported `plant()`.
//   3. COMPLETE a restore cycle through the exported `restoreAll()`, and record
//      that the target came back and that the pending count fell to zero.
//   4. PLANT A SECOND, TEXTUALLY DIFFERENT mutation into the same restored
//      target, so the parent can read WHICH plant is on disk rather than infer
//      it.
//   5. Emit ONE marker line -- only after the second plant has reached disk --
//      carrying the target path, the pre-plant bytes, the second replacement and
//      the three recorded pending counts.
//   6. AWAIT a timer. That is the second window.
//
// The harness is unmodified BY THIS FILE: no injected `await`, no flag, no
// environment variable, no hook, no test mode. (The plan that adds this driver
// does delete the latch inside the harness -- that is the fix this driver
// guards, not something this driver does.)
//
// WHAT NOT TO DO:
//
//   - Do NOT register a signal handler here. The whole point is that the handler
//     which runs is the HARNESS's. A handler in this file would satisfy the
//     parent's exit-code assertion while proving nothing at all.
//   - Do NOT call `main()`, and do not pass a real registry row. This driver
//     drives the restore machinery only: no guard is spawned, no registry is
//     read, no evidence file is written, no member of the audited set runs.
//   - Do NOT emit the marker before the SECOND plant. The parent uses the marker
//     as the driver's own statement that the second window is open, and then
//     independently confirms it by reading the second replacement off disk. A
//     marker emitted after the FIRST plant would let the parent signal in the
//     first window and record an attempt that proves only what
//     `signal-window-driver.mjs` already proves.
//   - Do NOT reach into the harness's internal map. The pending counts come from
//     the exported `pendingRestoreCount()` accessor, which returns the map's
//     size and nothing else, so this driver can observe the machinery without
//     acquiring the ability to mutate it.
//
// Like both siblings this file lives under `fixtures/` deliberately:
// `test-gate.mjs`'s `automatedTestFiles()` uses a NON-RECURSIVE `readdirSync`,
// so nothing here is ever collected as a test in its own right. That matters
// more than tidiness -- importing this module registers a SIGINT handler that
// calls `process.exit(130)`, which must never happen inside the test runner.

import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  plant,
  restoreAll,
  pendingRestoreCount,
} from "../../../../../scripts/audit-mutation-harness.mjs";

const TARGET_NAME = "disarm-target.txt";

/** Occurs exactly once in the target, which is what `plant()` requires -- and
 * occurs exactly once again after the first restore, which is what makes the
 * SECOND plant possible at all. */
const FIND = "HARNESS_DISARM_TARGET_ORIGINAL";

/** The first plant's replacement. Occurs ZERO times in the target before the
 * mutation and exactly once after, so `plant()`'s introduced-occurrence
 * post-condition computes 1. */
const REPLACE_ONE = "HARNESS_DISARM_TARGET_PLANTED_ONE";

/** The second plant's replacement. TEXTUALLY DIFFERENT from the first on
 * purpose: the parent polls the target for THIS string, so a marker that arrived
 * while the first plant was still on disk could not satisfy it. Neither string
 * is a substring of the other. */
const REPLACE_TWO = "HARNESS_DISARM_TARGET_PLANTED_TWO";

const MARKER = "HARNESS-DISARM-DRIVER-PLANTED-TWICE ";

/**
 * The target's bytes. Same deliberately non-UTF-8 tail both siblings use:
 * `0x00` and the lone `0xFF 0xFE 0x80` bytes have no UTF-8 interpretation and
 * `0xC3 0x28` is a truncated two-byte sequence, so decoding any of them as UTF-8
 * and re-encoding yields U+FFFD (`EF BF BD`) instead. A restore that is merely
 * TEXT-equal therefore produces different bytes and the parent's Buffer
 * comparison catches it.
 */
function targetBytes() {
  return Buffer.concat([
    Buffer.from("// harness restore-disarm target, written by the driver\n", "latin1"),
    Buffer.from(`${FIND}\n`, "latin1"),
    Buffer.from([0x00, 0xff, 0xfe, 0x80, 0xc3, 0x28]),
    Buffer.from("\n// end of target\n", "latin1"),
  ]);
}

function rowFor(replacement) {
  // A row object built in code. `historicalPath` is used only in the harness's
  // error messages; `plant` is the descriptor it actually acts on.
  return {
    historicalPath: "fixtures/harness-signal/restore-disarm-driver.mjs",
    plant: { kind: "worktree", file: TARGET_NAME, find: FIND, replace: replacement },
  };
}

function main() {
  const scratchRoot = process.argv[2];
  const holdMs = Number(process.argv[3] ?? "30000");
  if (typeof scratchRoot !== "string" || scratchRoot.length === 0) {
    process.stderr.write("restore-disarm-driver: usage: <scratch-root> [hold-ms]\n");
    process.exit(2);
  }
  if (!Number.isFinite(holdMs) || holdMs <= 0) {
    process.stderr.write("restore-disarm-driver: hold-ms must be a positive number\n");
    process.exit(2);
  }

  const absTarget = join(scratchRoot, TARGET_NAME);
  writeFileSync(absTarget, targetBytes());
  const original = readFileSync(absTarget);

  // --- first plant -------------------------------------------------------
  plant(scratchRoot, rowFor(REPLACE_ONE));
  const pendingAfterFirstPlant = pendingRestoreCount();

  // --- the completed restore cycle that arms the defect ------------------
  restoreAll();
  const afterRestore = readFileSync(absTarget);
  const restoredAfterFirstCycle = afterRestore.equals(original);
  const pendingAfterRestore = pendingRestoreCount();

  // --- second plant, into the restored target ----------------------------
  plant(scratchRoot, rowFor(REPLACE_TWO));
  const pendingAfterSecondPlant = pendingRestoreCount();

  // Emitted only now: the SECOND plant is on disk. Everything the parent needs
  // for an authoritative byte comparison rides on this one line, so it cannot
  // compare against bytes it guessed.
  process.stdout.write(
    `${MARKER}${JSON.stringify({
      target: absTarget,
      originalBase64: original.toString("base64"),
      replacement: REPLACE_TWO,
      firstReplacement: REPLACE_ONE,
      restoredAfterFirstCycle,
      pendingAfterFirstPlant,
      pendingAfterRestore,
      pendingAfterSecondPlant,
    })}\n`,
  );

  // THE SECOND WINDOW. The stack unwinds to the event loop and stays there. A
  // signal arriving during this timer is dispatched to the HARNESS's registered
  // handler -- the same handler that has ALREADY run once in this process.
  //
  // If no signal arrives the timer elapses, this process runs out of work, and
  // the harness's registered `exit` handler restores on the way out. That is why
  // the parent signals rather than waiting: the ordinary path was never the
  // question.
  setTimeout(() => {}, holdMs);
}

main();
