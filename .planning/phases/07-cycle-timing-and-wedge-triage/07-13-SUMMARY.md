---
phase: 07-cycle-timing-and-wedge-triage
plan: 13
subsystem: testing
tags: [vice-binary-monitor, stock-vice, live-verification, cpuhistory, cycles-stopwatch, vice-diagnose, node-test]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage plan 11
    provides: probeCpuHistory()/resolveCapabilities()'s decode-vs-transport classification guard (CR-01 fix)
  - phase: 07-cycle-timing-and-wedge-triage plan 12
    provides: the re-derived CPUHISTORY_GET parser that decodes real VICE >= 3.10 wire replies
  - phase: 07-cycle-timing-and-wedge-triage plan 15
    provides: diagnosis_unavailable's exact message prefix and monitor_acquisition_timeout reason class
provides:
  - "Live, non-fixture proof that stockConnect() resolves against BOTH genuine VICE 3.9 and genuine VICE 3.10, with the correct cpuHistory capability on each -- the exact inversion of 07-VERIFICATION.md's own live-reproduced CR-01 failure"
  - "Live proof that a real ~500ms bracket on genuine VICE 3.10, dispatched through the real dispatchStock() seam, measures an exact, non-zero, plausible cycle count via Route A (cpu_history) -- closes 07-VALIDATION.md's Manual-Only 'Route A stopwatch on a >= 3.10 build' row"
  - "Live proof that vice_diagnose settles well inside its configured session-acquisition bound when a real second client dials a monitor a first client already holds -- closes the socket-level half of 07-VERIFICATION.md's human_verification item 2 (the broker-mediated monitor_held_elsewhere half remains unit-proven only, stated explicitly)"
  - "withOwnStockInstance() -- a reusable per-test emulator-instance helper (own port, own scratch XDG_CONFIG_HOME, bounded readiness wait, guaranteed SIGKILL+scratch-dir teardown) independent of the file's shared before()/after() fixture"
affects: [07-18 (docs/stock-vice-parity.md and SKILL.md corrections consuming this plan's live findings)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-test emulator instance via withOwnStockInstance(), never the file's shared before()/after() fixture, whenever a test needs to observe a REAL capability/version quad rather than the fixture's hardcoded-absent stub session"
    - "A plain 'read' (vs 'reset_and_read') never moves the stopwatch's stored baseline -- two consecutive 'read' calls with no resume in between must report the EXACT SAME cycle count, not a 'small' one; this is the correct anti-fabrication invariant, verified empirically against real hardware rather than assumed from the plan text"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-live.test.ts

key-decisions:
  - "Task 2's anti-fabrication assertion was corrected from an assumed 'small non-negative figure' to an empirically-verified 'exact same figure as the first read' -- stock-timing.ts's handleCyclesStopwatch() only moves the baseline on reset/reset_and_read, never on a plain read, so a second immediate read (no resume in between, machine still halted from the first read's own halting CPUHISTORY_GET) correctly reports the SAME total delta against the unmoved baseline, not a value close to zero. Verified live: both reads reported 511061 cycles."
  - "Reused the existing CONFORMANCE_BROKER_CONTROL-shaped stub (STOCK_LIVE_1313_BROKER_CONTROL, a fresh instance with the same trivial claimMonitor/releaseMonitor:ok:true shape) across all three tasks -- none of these tests exercise BROKER-level contention; Task 3's contention is deliberately at the raw TCP socket, matching its own stated scope boundary."
  - "-default placed before -binarymonitor in withOwnStockInstance()'s spawn argv (the shared fixture's own before() omits -default and was left untouched, per the plan's explicit instruction not to touch it)."

requirements-completed: [TIME-01, TIME-03, TIME-04]

# Metrics
duration: ~30min
completed: 2026-08-18
---

# Phase 07 Plan 13: Live proofs of stockConnect(), Route A stopwatch, and bounded vice_diagnose contention Summary

**Three opt-in live tests added to stock-live.test.ts prove, against genuine VICE 3.9 and 3.10 binaries (never a fixture), that stockConnect() now resolves on both builds with the correct capability, that a real ~500ms Route A bracket on 3.10 measures an exact non-zero cycle count through the real dispatchStock() seam, and that vice_diagnose settles well inside its bound under real second-client socket contention.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-18T11:35:00Z (approximate)
- **Tasks:** 3 completed
- **Files modified:** 1

## Accomplishments

- **Task 1 (Gap 1, live inversion of CR-01):** `stockConnect()` now resolves against genuine `/usr/bin/x64sc` (VICE 3.9.0.0) with `cpuHistory: "absent"`, and against genuine `/usr/local/bin/x64sc` (VICE 3.10.0.0) with `cpuHistory: "available"` -- the exact inversion of 07-VERIFICATION.md's own live-reproduced failure (`StockFramingError | response type 0x86 body is 52 byte(s), needs at least 65`). Both sessions proven usable via a real `PING` after connect.
- **Task 2 (Manual-Only Route A stopwatch):** a real bracket (`reset` -> `vice_execution_run` -> a 500ms wall-clock wait with zero socket traffic -> `read`), dispatched through the real `dispatchStock()` seam with the REAL `stockConnect()` (not the file's hardcoded-absent-capability stub), measured **511,061 exact cycles** on one run and **530,713** on another -- both comfortably inside the documented sanity band `[100000, 5000000]` for a 500ms wait, both `route: "cpu_history"`, `exactness: "exact"`. A second immediate `read` (no resume, no wait) reported the identical figure both times, proving the count is not drifting or fabricating progress.
- **Task 3 (Gap 3/Gap 4, human_verification item 2's socket half):** with a real raw socket already holding genuine VICE 3.9's single-client binary monitor, a real second `stockConnect()` dial (`deps.connect: stockConnect`, not a stub) through `dispatchStock("vice_diagnose", ...)` settled in **~1501-1502ms** against a configured 1500ms bound (`VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS`) -- well inside the `< 5000ms` acceptance bound -- and answered the documented `vice_diagnose: diagnosis_unavailable (monitor_acquisition_timeout)` outcome on every observed run (the `monitor_held_elsewhere` alternative is accepted but was not the outcome this machine's timing happened to produce).
- Added `withOwnStockInstance()`, a reusable per-test helper that spawns its own stock VICE instance (own ephemeral port, own scratch `XDG_CONFIG_HOME`, `-default` before `-binarymonitor` per the flag-order gotcha) and guarantees SIGKILL + bounded exit wait + scratch-dir cleanup even when the test body throws -- independent of, and never touching, the file's existing shared `before()`/`after()` fixture.
- Default-skip preserved via two new gates (`SKIP_REASON_39`, `SKIP_REASON_310`), the same idiom as the file's existing `SKIP_REASON`; `node --test stock-live.test.ts` with no env vars reports all 14 tests SKIPPED, none failed.

## Task Commits

All three tasks landed in a single commit, `ac0cd57` (test) -- see "Deviations from Plan" below for why.

1. **Task 1: Prove stockConnect() completes on both real binaries, with the right capability on each** -- part of `ac0cd57`
2. **Task 2: Measure a real bracket on genuine VICE 3.10 through the real dispatchStock() seam** -- part of `ac0cd57`
3. **Task 3: Prove the diagnostician stays bounded when a second client holds the monitor** -- part of `ac0cd57`

## Files Created/Modified

- `.claude/mcp/vice/stock-live.test.ts` -- added `VICE_LIVE_STOCK_BIN_39`/`VICE_LIVE_STOCK_BIN_310` opt-in gates, `STOCK_LIVE_1313_BROKER_CONTROL`, `withOwnStockInstance()`, and four new opt-in tests (Task 1's two connect proofs, Task 2's Route A bracket proof, Task 3's contention proof).

## Decisions Made

See `key-decisions` in frontmatter. The most consequential: Task 2's anti-fabrication assertion for the second immediate `read` was corrected mid-execution from an assumed "small non-negative figure" to the empirically-correct "exact same figure as the first read" -- `handleCyclesStopwatch()` only advances the stored baseline on `reset`/`reset_and_read`, never on a plain `read`, so with no resume between two consecutive `read` calls the delta against the unmoved baseline is necessarily unchanged. This was discovered by running the live test, observing the real figure (530713 both times), and recognizing the original assumption was wrong -- not a bug in the implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Task 2's own anti-fabrication assertion (test-only, no production code changed)**
- **Found during:** Task 2's own `<verify>` run
- **Issue:** The test asserted a second immediate `vice_cycles_stopwatch` read (no resume, no wait) must be "small" (`< 500000`). Live run showed the real figure was 530713 -- identical to the first read -- because `action:"read"` never moves the stored baseline (only `reset`/`reset_and_read` do); with the machine still halted from the first read's own halting `CPUHISTORY_GET` and nothing resuming it in between, the honest delta against the unmoved baseline is unchanged, not small.
- **Fix:** Assertion now compares the second read's cycle figure for EXACT equality with the first read's figure (both are non-negative, and identical) -- the stronger and correct anti-fabrication invariant: a diverging or negative figure here would mean the count is drifting or fabricating progress that did not happen.
- **Files modified:** `.claude/mcp/vice/stock-live.test.ts` (single test, before the task's own commit)
- **Verification:** Re-ran `node --test --test-name-pattern="07-13" stock-live.test.ts` against both real binaries -- all 4 new tests pass, and the full 14-test file (10 existing + 4 new) passes together.
- **Committed in:** `ac0cd57` (the single commit covering all three tasks -- see the batching note below)

**2. [Process deviation, not a code deviation] All three tasks committed in one commit rather than three**
- **Reason:** All three tasks' additions live in the same single file (`stock-live.test.ts`) and were implemented, typechecked, and live-verified together as one coherent pass (the helper Task 1 introduces is a direct dependency of Tasks 2 and 3). Splitting the already-written, already-verified diff into three commits after the fact via hunk-level staging would risk introducing an inconsistent intermediate state with no corresponding verification run. A single `test(07-13): ...` commit lists all three tasks explicitly in its body.
- **Impact:** No functional impact; traceability is preserved via the commit body's explicit per-task breakdown and this SUMMARY's Task Commits section.

---

**Total deviations:** 1 auto-fixed test bug (found and fixed before commit, per Rule 1), 1 process deviation (single commit for a single-file, tightly-coupled 3-task plan).
**Impact on plan:** No scope creep. The test-assertion fix was required for the task's own `<verify>` step to pass and reflects genuinely correct system behavior, not a workaround.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None -- no external service configuration required. Live verification used the two VICE binaries already present on this machine (`/usr/bin/x64sc` VICE 3.9.0.0, `/usr/local/bin/x64sc` VICE 3.10.0.0); no packages were installed.

## What Remains Unit-Proven Only (explicit, per Task 3's own scope boundary)

Task 3 proves only the **socket-level** half of contention: a real second `stockConnect()` dial against a monitor port already held by a raw first socket. The **broker-mediated** `monitor_held_elsewhere` verdict path -- a real `claimMonitor()` refusal from a second, genuinely broker-managed session -- would require standing up the host broker control plane with two real acquired sessions, which this file's dispatch-level harness does not do. That half remains recorded as unit-proven only (see `stock-diagnose.test.ts`'s own `MonitorOwnershipError` coverage). Both outcomes (`monitor_held_elsewhere` verdict and `diagnosis_unavailable (monitor_acquisition_timeout)`) are accepted and documented as correct, and this plan's live runs consistently observed the second (socket-timeout) outcome on this machine.

This is exactly what 07-18's `07-VALIDATION.md`/`SKILL.md` corrections should carry forward: the socket-level contention bound is now live-proven; the broker-mediated `monitor_held_elsewhere` path is not, and should stay described as unit-proven only.

## Next Phase Readiness

- Gap 1 (07-VERIFICATION.md) is now live-proven closed on both real binaries this project has access to.
- 07-VALIDATION.md's Manual-Only "Route A stopwatch on a >= 3.10 build" row can move from OUTSTANDING to a recorded PASS, citing this plan's observed figures (511061 and 530713 cycles over ~500ms waits).
- 07-VERIFICATION.md's `human_verification` item 2 can be marked PASS for its socket-level half; its broker-mediated half must stay noted as unit-proven only -- do not let 07-18's docs imply otherwise.
- 07-18 (doc corrections) can now cite this plan's live-observed version quads (`3.9.0.0`, `3.10.0.0`), capabilities, and cycle figures directly.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-live.test.ts`
- FOUND: `.planning/phases/07-cycle-timing-and-wedge-triage/07-13-SUMMARY.md`
- FOUND commit: `ac0cd57` (Tasks 1-3, test)
- FOUND commit: `86b77b9` (SUMMARY)
