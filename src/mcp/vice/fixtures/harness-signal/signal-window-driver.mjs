#!/usr/bin/env node
// src/mcp/vice/fixtures/harness-signal/signal-window-driver.mjs
//
// WHY THIS FILE EXISTS: it creates the window `scripts/audit-mutation-harness.mjs`
// does not have, WITHOUT changing the harness.
//
// The harness advertises that a SIGINT or SIGTERM arriving while a plant is on
// disk exits 130 and restores every captured original. Plan 32-14 tried ten
// times to observe that -- five per signal, each one polling the planted file
// every 2 ms and signalling only once the mutation was visible on disk -- and
// all ten exited 0 with the handler never running. The cause it measured is
// structural, not a timing miss: `main()` and everything it calls are wholly
// synchronous, so Node has no opportunity to dispatch a JavaScript signal
// handler while that stack is on the CPU. The signal is queued, the stack
// unwinds, the `finally` blocks restore, and the process exits normally with the
// queued callback undelivered. "There is no window."
//
// There were exactly two ways forward, and this driver is the one that leaves
// the instrument alone. The rejected alternative was to inject an `await` into
// the harness's plant window -- changing how the instrument behaves when it is
// really run, in order to test how it behaves when it is really run. Instead:
//
//   1. IMPORT the harness. Its `IS_ENTRY_POINT` guard means `main()` does not
//      run on import, but the four `process.on(...)` registrations at module
//      scope DO. The real SIGINT handler, the real SIGTERM handler, the real
//      `exit` handler and the real `uncaughtException` handler are all live in
//      this process, exactly as they are during a real sweep.
//   2. PLANT for real, through the harness's own exported `plant()`, into a
//      throwaway scratch root the parent created and will delete.
//   3. Then AWAIT a timer. The stack unwinds to the event loop and stays there,
//      so a signal arriving now CAN be dispatched.
//
// The window is on this side of the boundary. The harness is unmodified: no
// injected `await`, no flag, no environment variable, no hook, no test mode.
//
// WHAT NOT TO DO:
//
//   - Do NOT register a signal handler here. The entire point is that the
//     handler which runs is the HARNESS's. A handler in this file would satisfy
//     the parent's exit-code assertion while proving nothing at all.
//   - Do NOT call `main()`, and do not pass a real registry row. This driver
//     drives the restore machinery only: no guard is spawned, no registry is
//     read, no evidence file is written, no member of the audited set runs.
//   - Do NOT emit the marker before the plant. The parent uses the marker as the
//     driver's own statement that the window is open, and then independently
//     confirms it by reading the planted bytes off disk. A marker emitted early
//     would let the parent signal outside the window and record an
//     uninterpretable attempt -- the failure mode plan 32-14's polling
//     discipline exists to prevent.
//
// This file lives under `fixtures/` deliberately: `test-gate.mjs`'s
// `automatedTestFiles()` uses a NON-RECURSIVE `readdirSync`, so nothing here is
// ever collected as a test in its own right. That matters more than tidiness --
// importing this module registers a SIGINT handler that calls
// `process.exit(130)`, which must never happen inside the test runner.

import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { plant } from "../../../../../scripts/audit-mutation-harness.mjs";

const TARGET_NAME = "plant-target.txt";

/** Occurs exactly once in the target, which is what `plant()` requires. */
const FIND = "HARNESS_SIGNAL_TARGET_ORIGINAL";

/** Occurs ZERO times in the target before the mutation and exactly once after,
 * so `plant()`'s introduced-occurrence post-condition computes 1. */
const REPLACE = "HARNESS_SIGNAL_TARGET_PLANTED";

const MARKER = "HARNESS-SIGNAL-DRIVER-PLANTED ";

/**
 * The target's bytes. The tail is deliberately NOT valid UTF-8 and carries a
 * NUL: `0x00` and the lone `0xFF 0xFE 0x80` bytes have no UTF-8 interpretation,
 * and `0xC3 0x28` is a truncated two-byte sequence. Decoding any of them as
 * UTF-8 and re-encoding yields U+FFFD (`EF BF BD`) instead, so a restore that is
 * merely TEXT-equal produces different bytes and the parent's Buffer comparison
 * catches it. This is the `[edge:CUT-04/encoding]` case made concrete rather
 * than asserted.
 */
function targetBytes() {
  return Buffer.concat([
    Buffer.from("// harness signal-window target, written by the driver\n", "latin1"),
    Buffer.from(`${FIND}\n`, "latin1"),
    Buffer.from([0x00, 0xff, 0xfe, 0x80, 0xc3, 0x28]),
    Buffer.from("\n// end of target\n", "latin1"),
  ]);
}

function main() {
  const scratchRoot = process.argv[2];
  const holdMs = Number(process.argv[3] ?? "30000");
  if (typeof scratchRoot !== "string" || scratchRoot.length === 0) {
    process.stderr.write("signal-window-driver: usage: <scratch-root> [hold-ms]\n");
    process.exit(2);
  }
  if (!Number.isFinite(holdMs) || holdMs <= 0) {
    process.stderr.write(`signal-window-driver: hold-ms must be a positive number\n`);
    process.exit(2);
  }

  const absTarget = join(scratchRoot, TARGET_NAME);
  writeFileSync(absTarget, targetBytes());
  const original = readFileSync(absTarget);

  // A row object built in code. `historicalPath` is used only in the harness's
  // error messages; `plant` is the descriptor it actually acts on.
  const row = {
    historicalPath: "fixtures/harness-signal/signal-window-driver.mjs",
    plant: { kind: "worktree", file: TARGET_NAME, find: FIND, replace: REPLACE },
  };

  // The real plant, through the real exported function, containment-checked
  // against the scratch root rather than against the repository root.
  plant(scratchRoot, row);

  // Emitted only now: the plant is on disk. Everything the parent needs for an
  // authoritative byte comparison rides on this one line, so it cannot compare
  // against bytes it guessed.
  process.stdout.write(
    `${MARKER}${JSON.stringify({
      target: absTarget,
      originalBase64: original.toString("base64"),
      replacement: REPLACE,
    })}\n`,
  );

  // THE WINDOW. The stack unwinds to the event loop and stays there. A signal
  // arriving during this timer is dispatched to the HARNESS's registered
  // handler, which restores and exits 130.
  //
  // If no signal arrives -- the parent's negative control -- the timer elapses,
  // this process runs out of work, and the harness's registered `exit` handler
  // restores on the way out. That path exits 0 with a byte-identical file, which
  // is exactly why the exit code rather than the byte comparison is the
  // discriminating evidence.
  setTimeout(() => {}, holdMs);
}

main();
