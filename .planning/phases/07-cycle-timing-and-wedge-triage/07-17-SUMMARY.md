---
phase: 07-cycle-timing-and-wedge-triage
plan: 17
subsystem: wedge-triage
tags: [vice_diagnose, stock-backend, live-verification, binary-monitor, node-test]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "07-15's deriveMachinePaused()/machinePausedSource on vice_diagnose; 07-11's decode-vs-transport capability-probe fix"
provides:
  - "stock-live-triage.test.ts -- opt-in, manual-only live proofs of three of vice_diagnose's five stock verdicts (checkpoint_trap, wedged, restarted) that 07-VALIDATION.md's own Manual-Only table recorded as never exercised against a real emulator"
  - "withTriageInstance() -- a per-test emulator harness dispatching through the real dispatchStock() seam, with thin capturing pass-throughs to the real stockConnect()/stockReconnect(), over a real ViceMonitorClient socket"
  - "resumeUntilCheckpointHits() -- a resume+verify+retry helper absorbing a genuine run-state-tracker staleness race discovered during this plan's own live execution"
  - "test-gate.mjs's MANUAL_ONLY_TESTS extended to five entries; test-gate.test.ts's drift guard updated to match"
affects: [07-18-skill-triage-table, vice-wedge-triage skill, 07-VALIDATION.md's Manual-Only table]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-test emulator lifecycle (not a shared file-level fixture) when a test's own mechanism (a kill-and-relaunch) would destroy a fixture for tests that ran after it"
    - "Thin pass-through deps.connect/deps.reconnect that call the REAL stockConnect()/stockReconnect() and capture the returned session, rather than hand-building a stub session -- needed whenever a live test's own assertions depend on genuinely resolved capabilities or a genuinely epoch-tracked session"
    - "Verify-then-retry around an event-tracker wait when the event source and the fact being waited for are two different signals that can race (a run-state transition vs. a specific checkpoint's hitCount)"

key-files:
  created:
    - .claude/mcp/vice/stock-live-triage.test.ts
  modified:
    - .claude/mcp/vice/test-gate.mjs
    - .claude/mcp/vice/test-gate.test.ts

key-decisions:
  - "Task 3's restarted proof uses the REAL stockReconnect()'s own epoch check (which runs before any wire traffic) rather than forcing handleDiagnoseStock()'s step-2 epoch-comparison branch specifically -- both real code paths produce byte-identical evidence shapes ({baselineEpoch, currentEpoch}), so the test asserts only the observable convergence point rather than which internal branch fired, since the race between them (whether the tracker still reports the old socket as connected) is not something the test needs to resolve to prove the verdict."
  - "Task 2's wedged mechanism is live-confirmed on BOTH capability routes: frame_position (VICE 3.9, LIN/CYC frozen at the jam) and cpu_history (VICE 3.10, the monotonic cycle counter frozen at the jam) -- both read the -jamaction 2 induced state as non-advancing for the same underlying reason (the monitor holds the machine stopped), so the fallback trace-flood mechanism was wired in but never needed."
  - "Added resumeUntilCheckpointHits() as a Rule-1 fix after repeated live runs showed a genuine race: waitForStoppedRunState() alone can return on a STALE 'stopped' tracker read (left over from the checkpoint's own arming halt) before the 'resumed' event for a later vice_execution_run has been processed, letting vice_diagnose fall through to the liveness bracket and report 'live' instead of 'checkpoint_trap'. The fix resumes+waits+verifies hitCount via a real read, retrying (bounded) on a stale read."

patterns-established:
  - "A live-test harness that captures the session/client a REAL production function (stockConnect/stockReconnect) itself constructs, via a thin wrapper on the one injected seam (deps.connect/deps.reconnect), rather than hand-building a stub session -- preserves 'no stub anywhere in the path except ensureLease/connect' while still exercising the real capability/epoch derivation."

requirements-completed: [TIME-04]

# Metrics
duration: ~55min
completed: 2026-08-18
---

# Phase 07 Plan 17: Live Triage Proofs for checkpoint_trap, wedged, restarted Summary

**All three previously-unit-only `vice_diagnose` verdicts (`checkpoint_trap`, `wedged`, `restarted`) are now live-proven against genuine unpatched stock VICE, closing 07-VALIDATION.md's Manual-Only gap and 07-VERIFICATION.md's `human_verification` item 1.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-18T11:52:50Z
- **Tasks:** 3 (all `type="auto"`, no checkpoints), plus one deviation fix
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **`checkpoint_trap` live-proven** (Task 1): a real stopping exec checkpoint armed at `$EA31` (the KERNAL IRQ entry) through the real `vice_checkpoint_add` tool, resumed via `vice_execution_run`, fires for real, and `vice_diagnose` answers `verdict: "checkpoint_trap"`, `machinePaused: true`, `machinePausedSource: "observed"` (WR-03's derivation, now proven against a real wire `stopped` event, not merely a synthetic fixture), with no `bracket` key in evidence and `trapReason: "pc"`.
- **`wedged` live-proven** (Task 2): a real CPU JAM held in the monitor (`-jamaction 2`) — the KIL opcode (`$02`) written to `$C000`, PC pointed at it, resumed once — produces `verdict: "wedged"` with `bracketsRun: 2` and both brackets `advanced: false`. Confirmed on **both** capability routes: genuine stock VICE 3.9 (`frame_position` — `LIN`/`CYC` frozen at the jam) and genuine VICE 3.10 (`cpu_history` — the monotonic cycle counter frozen at the jam). A documented fallback (non-stopping trace-flood checkpoint) and an honest dynamic `t.skip()` are wired in for the case the primary mechanism doesn't reproduce, though it was not needed on either binary.
- **`restarted` live-proven** (Task 3): a real epoch record (via `broker-epoch.mts`'s own `writeEpochRecord()`, never a hand-invented shape) establishes a session's `baselineEpoch`; a pre-condition dispatch confirms `verdict !== "restarted"` while the epoch is unchanged; a real `SIGKILL` + relaunch on the same port + epoch bump to `baselineEpoch + 1` then yields `verdict: "restarted"` with `evidence.baselineEpoch`/`evidence.currentEpoch` differing by exactly 1, no `bracket`/`checkpoints` keys (zero emulator cost), and `machinePausedSource: "no_session"` — confirming the real mechanism is `stockConnect.ts`'s own `stockReconnect()` epoch check, which runs **before** any wire traffic and throws `MachineRestartedError`.
- **A genuine live race found and fixed** (deviation, Rule 1): the `checkpoint_trap` test flaked to `verdict: "live"` on repeated runs. Root-caused (via an instrumented standalone probe against the real binary) to `waitForStoppedRunState()` observing a stale `"stopped"` tracker read — left over from the checkpoint's own arming halt (`CHECKPOINT_SET` itself halts on any inbound byte) — before the `"resumed"` event for the subsequent `vice_execution_run` had been processed. `resumeUntilCheckpointHits()` fixes this by verifying the checkpoint's real `hitCount` via a wire read after each wait, retrying the resume (bounded, 5 attempts) on a stale read. Verified stable across 6+ consecutive live runs after the fix, including the full 3-test suite together.
- All 5 `MANUAL_ONLY_TESTS` entries (including the new `stock-live-triage.test.ts`) correctly excluded from `npm run test:automated`; `node test-gate.mjs` shows 1558/1559 passing with only the pre-existing, already-documented `repo-root.test.ts` worktree-path failure.

## Task Commits

1. **Task 1: Stand up the live triage harness, register it in the gate, and prove checkpoint_trap live** - `02fab9e` (feat)
2. **Task 2: Induce a genuinely non-advancing emulator and prove the wedged verdict live** - `346c0fc` (feat)
3. **Task 3: Prove the restarted verdict against a real kill-and-relaunch with a bumped epoch** - `25a76e6` (feat)
4. **Deviation fix: absorb the stale-tracker race in the checkpoint_trap wait** - `c5ac707` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.claude/mcp/vice/stock-live-triage.test.ts` (created, 698 lines) — `withTriageInstance()` (per-test emulator lifecycle: spawn, probe-connect, `StockDispatchDeps` with capturing `connect`/`reconnect` pass-throughs to the real `stockConnect()`/`stockReconnect()`, `setEpochFile()`, `relaunch()`); `waitForStoppedRunState()`; `resumeUntilCheckpointHits()`; the three live test cases (`checkpoint_trap`, `wedged`, `restarted`) plus their supporting mechanism functions (`attemptJamMechanism()`, `attemptTraceFloodMechanism()`, `writeTestEpoch()`).
- `.claude/mcp/vice/test-gate.mjs` — `MANUAL_ONLY_TESTS` extended to 5 entries (added `"stock-live-triage.test.ts"`); header comment updated from "four" to "five".
- `.claude/mcp/vice/test-gate.test.ts` — drift guard's hardcoded expected list and test title updated for the fifth entry.

## Decisions Made

- **Task 3's mechanism identity is intentionally left as "whichever real path fires":** both `ensureStockSession()`'s reused-session step-2 epoch comparison and `stockReconnect()`'s own pre-dial epoch check produce the identical evidence shape (`{baselineEpoch, currentEpoch}`), so the test asserts the observable result rather than picking a winner in a race the production code itself doesn't need to resolve deterministically. The live run observed `machinePausedSource: "no_session"`, confirming the `stockReconnect()`/`MachineRestartedError` path fired.
- **Both capability routes proven for `wedged`, not just one:** ran the primary `-jamaction 2` mechanism against both `/usr/bin/x64sc` (3.9, `frame_position`) and `/usr/local/bin/x64sc` (3.10, `cpu_history`) during verification, confirming the induced non-advance reads correctly on either route rather than assuming route-independence.
- **`resumeUntilCheckpointHits()` retries rather than lengthening the wait timeout:** the observed race was a MISSED transition signal (a stale read), not a SLOW one — a longer `waitForStoppedRunState()` deadline would not have helped, since the stale value never changes on its own until something resumes the machine again.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Absorbed a stale run-state-tracker race in the checkpoint_trap wait**
- **Found during:** Task 1 verification (repeated `node --test` runs against the real binary)
- **Issue:** `waitForStoppedRunState()` alone could return on a stale `"stopped"` projection left over from the checkpoint's own arming halt (`CHECKPOINT_SET` itself halts the machine, per stock's "any inbound byte halts" rule), before the `"resumed"` event for the subsequent `vice_execution_run` had been processed by the client. `vice_diagnose` would then read `gatherStockCheckpointTrapEvidence()`'s `isTrap: false` (checkpoint truly never fired yet, `hitCount: 0`), fall through to the liveness bracket, which genuinely resumed and captured real advancement, reporting `"live"` instead of `"checkpoint_trap"`.
- **Fix:** Added `resumeUntilCheckpointHits()`, which resumes, waits via the tracker, then VERIFIES via a real `vice_checkpoint_list` read that the checkpoint's own `hitCount` actually advanced — retrying the resume (bounded, 5 attempts) on a stale read rather than accepting it. Root-caused via an instrumented standalone probe script run directly against `/usr/bin/x64sc` (not committed — scratch-only), which captured the exact event sequence (`resumed` at t+1ms in a successful run vs. an immediate stale `"stopped"` read with `hitCount` staying `0` for the full window in a failing one).
- **Files modified:** `.claude/mcp/vice/stock-live-triage.test.ts`
- **Verification:** Re-ran the `checkpoint_trap` test 6+ times consecutively (isolated and as part of the full 3-test suite) with zero flakes after the fix, versus an observed flake within the first 2 runs before it.
- **Committed in:** `c5ac707` (fix)

---

**Total deviations:** 1 auto-fixed (1 bug-class race condition)
**Impact on plan:** Necessary for the live proof to be trustworthy rather than flaky. No scope creep — the fix only touches the wait mechanism inside the file this plan itself created.

## Issues Encountered

- The initial `checkpoint_trap` test implementation assumed `waitForStoppedRunState()` alone was sufficient (matching `stock-live.test.ts`'s own precedent, which never needed to distinguish a checkpoint's own arming halt from a later resume-and-rehalt cycle). Live execution against the real binary disproved this assumption — see the deviation above.
- `writeTestEpoch()`'s `pid` field uses a fixed placeholder (`0`) rather than the spawned child's real pid — `readEpoch()` only type-checks this field (`typeof parsed.pid === "number"`) and nothing in the code path under test consumes its value, so threading the real child pid through the harness would have added surface with no verification benefit.

## User Setup Required

None — no external service configuration required. Live execution requires `VICE_LIVE_TRIAGE_BIN` set to a real stock VICE binary path (default `/usr/bin/x64sc`); both `/usr/bin/x64sc` (3.9) and `/usr/local/bin/x64sc` (3.10) were used during this plan's own verification and are genuinely present on this machine.

## Next Phase Readiness

- **07-18 (skill triage table)** can now cite all three of these verdicts as live-proven rather than unit-only when updating `vice-wedge-triage/SKILL.md` and `07-VALIDATION.md`'s Manual-Only table — the table's `checkpoint_trap`/`wedged`/`restarted` rows should move from "NOT exercised" to "exercised" with a reference to `stock-live-triage.test.ts`.
- **Two honest limits carried forward, to be stated (not implied away) wherever these results are cited:**
  1. The `restarted` respawn in Task 3 was performed by **this test**, not by the host broker's own supervision loop. This closes "a real kill-and-relaunch with a bumped epoch produces `restarted`" and does **not** close "the broker's supervision loop produces `restarted`" — that path remains unit-proven only.
  2. The broker-mediated `monitor_held_elsewhere` path (a second client contending for the same monitor socket) was out of scope for this plan (07-13 Task 3 owns that boundedness proof) and stays unit-proven only.
- The `resumeUntilCheckpointHits()` pattern (verify-then-retry around an event-tracker wait) is a reusable idiom worth naming if a future live test needs to wait for a SPECIFIC state change (not just any transition) — the general lesson is that a run-state tracker answers "is the machine paused right now", not "did THIS SPECIFIC thing cause the pause", and conflating the two is the exact race this plan found.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*
