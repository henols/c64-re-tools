---
phase: 15-debt-and-review-disposition
plan: 08
subsystem: testing
tags: [vice-mcp, stock-vice, live-probe, acme, uat, snapshot, joystick, keyboard]

requires:
  - phase: 15-debt-and-review-disposition
    provides: "15-01's tracer-first disposition pattern for phase-carried UAT/review debt"
provides:
  - "03-HUMAN-UAT.md scenarios 1 and 2 closed with cited live evidence (pass / partial)"
  - "vice_snapshot_load round-trip case in stock-broker-live.test.ts, decided by byte comparison"
  - "A committed, deterministic keyboard-injection-into-a-running-program live test"
  - "15-UAT-EVIDENCE.md: the first live evidence document for this phase's UAT closures"
  - "A live, running-program cross-reference to Phase 13 A3's zero-delta JOYPORT_SET result"
affects: [03-direct-tools, 15-debt-and-review-disposition]

actuals:
  tokens: 11277
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Ad-hoc, uncommitted probe script (imports the same production modules as the committed test) for a live measurement that is not a deterministic pass/fail -- keeps the committed test suite free of assertions on values that may legitimately be zero"
    - "BASIC-stub-with-computed-SYS launch idiom (acme-build/template.a's own shape) for a genuinely-running hand-assembled fixture, distinct from this file's pre-existing raw-code-at-$0801 fixture (which needs FINDING-D1's sacrificial-bytes workaround; a valid BASIC stub does not)"
    - "PC-inside-loop-range register read as the running-state proof, computed from ACME's own .rep listing rather than assumed"

key-files:
  created:
    - .planning/phases/15-debt-and-review-disposition/15-UAT-EVIDENCE.md
  modified:
    - .claude/mcp/vice/stock-broker-live.test.ts
    - .planning/phases/03-direct-tools/03-HUMAN-UAT.md

key-decisions:
  - "Scenario 1's vice_snapshot_save/load cannot be redirected into the harness's own scratch directory -- stock-paths.ts's snapshotPathFor()/snapshotMetaPathFor() are fixed to <repoRoot()>/.vice-snapshots/<name>.{vsf,json} by design (T-3-05). The new test cleans up its own two artifacts explicitly in a finally block instead."
  - "Scenario 2's joystick measurement was deliberately kept OUT of the committed test file (a one-off, uncommitted probe script instead) because it reproduced a zero-delta result -- a measurement, not a pass/fail -- per this plan's own instruction not to commit a test that asserts whatever happened to be observed."
  - "The reacting program uses the standard BASIC-stub-with-SYS launch idiom, not a raw-code-at-$0801 fixture -- FINDING-D1's relink-corruption workaround does not apply to a well-formed BASIC program, confirmed empirically (the program runs correctly with no sacrificial-byte handling needed)."
  - "No [ASSUMED] label in stock-input.ts/stock-protocol.ts was touched: the joystick probe observed zero delta, so no bit-to-port mapping exists to record, and assumption-label-discipline.test.ts's all-or-nothing guard for A3 is untouched by design."

requirements-completed: [DEBT-03]

coverage:
  - id: D1
    description: "Scenario 1 (vice_autostart / vice_disk_attach / vice_snapshot_load) executed live against genuine stock VICE with a byte-comparison-decided snapshot round trip, recorded pass in 03-HUMAN-UAT.md"
    requirement: DEBT-03
    verification:
      - kind: manual_procedural
        ref: "VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-broker-live.test.ts (opt-in live run, this session: 5/5 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Scenario 2 (vice_keyboard_petscii / vice_joystick_set against a proven-running program) executed live; keyboard half deterministic pass, joystick half a genuine zero-delta negative result cross-referenced to Phase 13 A3"
    requirement: DEBT-03
    verification:
      - kind: manual_procedural
        ref: "VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-broker-live.test.ts (keyboard case, this session: pass); ad-hoc uncommitted probe script (joystick measurement, this session, recorded in 15-UAT-EVIDENCE.md)"
        status: pass
    human_judgment: true
    rationale: "The joystick half's verdict (partial, a genuine negative result) requires a human to confirm the evidence document's honesty -- that a zero-delta observation is recorded as a negative result with its A3 cross-reference, not dressed up as a pass. This is exactly the plan's own <human-check> requirement."

duration: 24min
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 08: Live-close Phase 03's UAT scenarios 1 and 2 against genuine stock VICE Summary

**Closed two of Phase 03's three pending UAT rows with live, cited evidence against genuine `/usr/bin/x64sc` (VICE 3.9): scenario 1 (snapshot round trip decided by byte comparison) passes; scenario 2 (keyboard/joystick injection against a proven-running program) is honestly partial, reproducing Phase 13 A3's zero-delta joystick result under a strictly stronger precondition.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-22T15:07:50Z
- **Completed:** 2026-08-22T15:31:01Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Added a `vice_snapshot_save` → perturb → `vice_snapshot_load` round-trip case to `stock-broker-live.test.ts`, run live through the real broker daemon against genuine stock VICE; the verdict rests on two byte comparisons (a perturbed scratch region returning to its exact pre-perturbation bytes, and the loaded program's own verified payload region still matching afterwards), never on the absence of an error.
- Hand-assembled a minimal ACME reacting program (BASIC-stub launch, hardware addresses as literals, no library) that loops copying the KERNAL keyboard buffer and both CIA1 port bytes into screen-memory observation cells; autostarted it live and proved it genuinely running via a register read landing the PC inside the program's own loop range, computed from ACME's real `.rep` output.
- Added a committed, deterministic test asserting an injected `vice_keyboard_petscii` byte lands in the reacting program's observation cell.
- Ran the joystick half of scenario 2 via a one-off, uncommitted probe script (a measurement, not a pass/fail): all five single-bit `JOYPORT_SET` rounds plus fire showed zero delta at both CIA1 port bytes, reproducing Phase 13 A3's exact result — this time against a program independently proven running, which eliminates A3's "running-program precondition" candidate explanation while leaving the other two open.
- Created `15-UAT-EVIDENCE.md`, recording the binary version/sha/fixture provenance and every scenario's raw payloads, observed deltas, and honest verdict.
- Recorded scenarios 1 and 2 in `03-HUMAN-UAT.md` with cited-evidence prose, new frontmatter (`resolved_by`, `driven_by`, `tested_artifact_sha`, `tested_artifact_route`, `vice_version`, `evidence`), and corrected Summary counts (1 pass / 1 issues / 1 pending), leaving scenario 3 explicitly for plan 15-10.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the vice_snapshot_load round trip to the live harness and run scenario 1 end to end** - `d050944` (feat)
2. **Task 2: Build a reacting program and run scenario 2's keyboard and joystick injection** - `51a7928` (feat)
3. **Task 3: Record scenarios 1 and 2 in 03-HUMAN-UAT.md with the established frontmatter and result shape** - `ec3f46c` (docs)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `.claude/mcp/vice/stock-broker-live.test.ts` — added the `vice_snapshot_save`/`vice_snapshot_load` round-trip test and the reacting-program keyboard test (both opt-in, default-skipped, `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc` to run)
- `.planning/phases/15-debt-and-review-disposition/15-UAT-EVIDENCE.md` — new: full live transcript for both scenarios, raw tool payloads, ACME source and version banner, cleanup confirmation
- `.planning/phases/03-direct-tools/03-HUMAN-UAT.md` — scenarios 1/2 results recorded, new frontmatter, corrected Summary counts

## Decisions Made

- `vice_snapshot_save`/`vice_snapshot_load`'s fixed `<repoRoot()>/.vice-snapshots/` path cannot be redirected into the test harness's own scratch directory (by design, T-3-05) — the new test cleans up its own two artifacts explicitly instead of relying on scratch-dir teardown.
- The joystick measurement was kept out of the committed test file entirely (an uncommitted, one-off probe script instead), because it is a measurement whose legitimate outcome may be zero delta — asserting on it would be exactly the "test that asserts whatever happened to be observed" this plan forbids.
- The reacting program uses a standard BASIC-stub-with-SYS launch (not raw code at `$0801`), since FINDING-D1's relink-corruption issue is specific to a non-BASIC raw-code fixture and does not apply to a well-formed BASIC program — confirmed empirically live.
- No `[ASSUMED]` label was touched in `stock-input.ts`/`stock-protocol.ts`: the joystick probe's zero-delta result gives no bit-to-port mapping to record, so `assumption-label-discipline.test.ts`'s all-or-nothing guard for row A3 stays exactly as it was (`git diff --stat .claude/mcp/vice/stock-input.ts` is empty).

## Deviations from Plan

None — plan executed exactly as written. The plan itself anticipated the joystick half's likely zero-delta outcome and instructed exactly this handling (keep it out of the committed test, record honestly as a negative result); that anticipated outcome is what occurred.

## Issues Encountered

None. All live runs (typecheck, default-skip run, opt-in live run against `/usr/bin/x64sc`, `npm run test:automated`) passed cleanly on every attempt; no wedge, no orphaned process, no leftover scratch directory or snapshot file.

## Live Evidence (this session)

**Binary under test:** `/usr/bin/x64sc`, self-reported `x64sc (VICE 3.9)` (`x64sc -version`; Debian package `3.9+dfsg-1`). **Artifact sha:** `d526f52068099de7fa9f950eaa8cf4cdb5d09bb9` (`local-checkout-HEAD`, resolves via `git cat-file -e`).

**Scenario 1 verdict: PASS.** `vice_autostart`/`vice_disk_attach`: verified payload region `$0803`-`$0812` landed `[234,234,...,96]` (15×NOP + RTS) after the load; `vice_disk_attach`'s own `runState: "running"` independently corroborates Phase 13 A5's finding that it resets+loads despite its advertised attach-only approximation (not a new finding — already-filed). `vice_snapshot_load`: `$C000` baseline `[255,255,0,0]` → perturbed `[222,173,190,239]` (`0xDEADBEEF`) → restored-after-load `[255,255,0,0]` (exact baseline, not the perturbation), with the program's own payload region still intact afterward.

**Scenario 2 verdict: PARTIAL.** Running-state proof: PC `$081E`, inside the reacting program's own loop range `[$080E, $0826]` (computed from ACME's real `.rep` listing, ACME `release 0.97 "Zem"`). Keyboard: `$0400` `32` → inject `0x41` → `$0400` `65` (exact match, deterministic pass). Joystick: all five single-bit rounds (`up`/`down`/`left`/`right`/`fire`) left `$DC00`=`127`/`$DC01`=`255` unchanged — byte-identical to Phase 13 A3's own zero-delta result, now against a program independently proven running, eliminating A3's "running-program precondition" candidate explanation. **No bit-to-port mapping observed — plan 15-12's `[ASSUMED]` label question does not apply this session** (nothing to hand it: the label stays exactly as it was).

**Process/scratch cleanup, every run this session:** `pgrep -af x64sc` showed no process from any run; `pgrep -af vice-broker` showed only a pre-existing, unrelated `broker-control.test.ts` singleton (confirmed via `ps -o lstart`, running ~4 hours before this session started). Every harness scratch directory and both `.vice-snapshots/brokerlive_roundtrip.{vsf,json}` artifacts were confirmed absent after each run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `03-HUMAN-UAT.md` now carries exactly one remaining `result: [pending]` (scenario 3, the hot non-stopping checkpoint auto-disable guard), explicitly owned by plan 15-10 — this plan did not touch it.
- Scenario 2's joystick null result is now cross-referenced live evidence, not merely Phase 13's original finding — a future plan probing A3's remaining two candidate explanations (no CIA1 effect on this build, or a different physical port) has this session's transcript to build on.
- No follow-up work is blocked by this plan's own execution: all cleanup confirmed, all automated gates green.

## Self-Check: PASSED

- `.claude/mcp/vice/stock-broker-live.test.ts` — FOUND (modified, git-tracked)
- `.planning/phases/15-debt-and-review-disposition/15-UAT-EVIDENCE.md` — FOUND (created, git-tracked)
- `.planning/phases/03-direct-tools/03-HUMAN-UAT.md` — FOUND (modified, git-tracked)
- Commit `d050944` — FOUND in `git log --oneline --all`
- Commit `51a7928` — FOUND in `git log --oneline --all`
- Commit `ec3f46c` — FOUND in `git log --oneline --all`
- All plan-level `<verification>` commands re-run this session: `npm run typecheck` (0), `npm run test:automated` (2103 pass / 0 fail / 5 pre-existing todo), default `node --test stock-broker-live.test.ts` (5/5 skip), opt-in live run (5/5 pass), `grep -c 'result: \[pending\]' 03-HUMAN-UAT.md` (1), `pgrep -af x64sc`/`pgrep -af vice-broker` (no orphan from this plan) — all PASS.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*
