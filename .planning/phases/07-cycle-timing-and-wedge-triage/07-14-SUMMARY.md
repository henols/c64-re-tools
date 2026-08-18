---
phase: 07-cycle-timing-and-wedge-triage
plan: 14
subsystem: vice-mcp-stock-backend
tags: [vice-mcp, stock-vice, binary-monitor, run_until, checkpoint, wedge-triage]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "stock-run-until.ts's cleanup mechanism (temporary checkpoint, one CHECKPOINT_DELETE, ObjectMissing tolerance, MachineRestartedError skip) and stock-timing.ts's readCycleBaseline()/readProgramCounter() primitives"
provides:
  - "readProgramCounter() exported from stock-timing.ts as a reusable PC-read seam"
  - "handleRunUntil()'s already_gone timeout branch resolves reached from the program counter instead of asserting reached:false (WR-01)"
  - "Every vice_run_until answer states machineHalted and names vice_execution_run as the resume call (WR-02)"
  - "6 new regression tests plus 1 widened existing assertion in stock-run-until.test.ts (21/21 passing, up from 15/15)"
  - "The exact new field set (below) for 07-16 to fold into tools-manifest.stock.json's vice_run_until outputSchema"
affects: [07-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-family PC-read reuse: a private helper promoted to `export` in its owning file (stock-timing.ts) rather than a second implementation in the consumer (stock-run-until.ts)."
    - "Unconditional companion field: machineHalted is stamped on every non-error payload path, never only when true, so an absent key can never be misread as a negative answer."

key-files:
  created: []
  modified:
    - ".claude/mcp/vice/stock-timing.ts"
    - ".claude/mcp/vice/stock-run-until.ts"
    - ".claude/mcp/vice/stock-run-until.test.ts"

key-decisions:
  - "readProgramCounter()'s three throw messages were renamed from the readCycleBaseline: prefix to readProgramCounter: -- grep-verified beforehand that no test in the tree asserts the old strings."
  - "WR-02's alternative (resume once after cleanup) was rejected per the plan: reporting machineHalted preserves the caller's ability to inspect where the machine actually is, and stays truthful even on the reachedUnknown path where the PC read itself was attempted."
  - "The already_gone branch is the only branch that performs the PC read; the deleted and delete_failed branches keep asserting reached:false unconditionally, since the checkpoint provably still existed (or its state is reported separately via cleanupError)."

patterns-established:
  - "reachedUnknown as a sibling key, never a union value on reached: outputSchema keeps `reached: {type: boolean}`, so the honest unresolved state omits `reached` entirely and adds `reachedUnknown: true` instead of coercing it into a string enum."

requirements-completed: [TIME-02]

# Metrics
duration: 6min
completed: 2026-08-18
---

# Phase 07 Plan 14: Honest run_until race resolution and halted-machine reporting Summary

**`vice_run_until`'s already_gone cleanup race now resolves from a live program-counter read (or is declared genuinely unresolved) instead of asserting a false negative, and every answer states `machineHalted` plus the `vice_execution_run` resume call.**

## Performance

- **Duration:** ~6 min (861279a to 866f709)
- **Started:** 2026-08-18T12:55:02+02:00
- **Completed:** 2026-08-18T13:00:07+02:00
- **Tasks:** 3/3 completed
- **Files modified:** 3

## Accomplishments
- Closed **WR-01**: the `already_gone` cleanup-delete race is now resolved by reading the program counter via the newly-exported `readProgramCounter()` (stock-timing.ts) — `pc === address` asserts `reached: true`; `pc !== address` asserts `reached: false`; a failed PC read omits `reached` entirely and reports `reachedUnknown: true`. `reached: false` is never again asserted on an unresolvable race.
- Closed **WR-02**: every non-error `handleRunUntil()` answer (hit path and all three timeout branches) now carries `machineHalted: true` and a `machineHaltedNote` naming the cause and `vice_execution_run` as the resume call, emitted unconditionally so an absent key can never be misread as "not halted".
- No second resume was introduced — `CommandType.Exit`'s send count in `stock-run-until.ts` is unchanged at 1, and the cleanup mechanism (temporary checkpoint, one delete, ObjectMissing tolerance, restart skip) is untouched.
- `stock-run-until.test.ts` grew from 15/15 to 21/21 passing tests; `stock-dispatch.test.ts` (140 tests) and the full `test-gate.mjs` run (1533 tests) show no new failures beyond the pre-existing, already-documented `repo-root.test.ts` worktree-path failure.

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolve the already_gone race from the program counter instead of asserting reached:false** - `861279a` (fix)
2. **Task 2: Report the halted machine explicitly on every vice_run_until answer** - `62899fe` (feat)
3. **Task 3: Lock both behaviours into stock-run-until.test.ts without weakening the existing 15** - `866f709` (test)

_No separate plan-metadata commit — this SUMMARY.md is committed by the worktree executor's final commit step._

## Files Created/Modified
- `.claude/mcp/vice/stock-timing.ts` - `readProgramCounter()` promoted from a private helper to `export`ed; its three throw messages renamed from the misattributed `readCycleBaseline:` prefix to `readProgramCounter:`. No other change (route selection, caches, refusal wording untouched).
- `.claude/mcp/vice/stock-run-until.ts` - Imports `readProgramCounter` from `stock-timing.ts`. The `already_gone` cleanup branch now performs a PC read (own try/catch) and branches three ways instead of falling straight through to `reached: false`. Every non-error payload (hit path, and all three timeout `cleanup` branches) now carries `machineHalted: true` plus a `machineHaltedNote`. The timeout `explanation` string now also states the machine is stopped and needs `vice_execution_run`.
- `.claude/mcp/vice/stock-run-until.test.ts` - Added `registersAvailableWithPc()`/`registersGetWithPc()` stub fixtures and 6 new tests; widened 1 pre-existing assertion (see below).

## Decisions Made
- `readProgramCounter()`'s throw messages **were renamed** (`readCycleBaseline:` → `readProgramCounter:`). Verified via `grep -rn 'readCycleBaseline:' .claude/mcp/vice/*.test.ts` before renaming — the only two hits were test **titles** in `stock-timing.test.ts` describing `readCycleBaseline()` itself (a different function), not assertions on `readProgramCounter()`'s thrown text. Safe to rename.
- Rejected WR-02's alternative fix (resume once after cleanup) per the plan's own reasoning: a silent resume would destroy the state a timed-out caller frequently wants to inspect, and reporting is the only option that stays truthful when the halt is caused by the PC read itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened a pre-existing test assertion that Task 1's change made obsolete**
- **Found during:** Task 1 (immediately visible once the `already_gone` branch stopped asserting `reached: false` unconditionally)
- **Issue:** The pre-existing test `"run_until: a CheckpointDelete rejected with ObjectMissing is tolerated as already_gone, still a non-error result"` used a stub with no `REGISTERS_AVAILABLE`/`REGISTERS_GET` wiring, so Task 1's new PC read throws for that stub, landing on the `"unresolved"` branch — the test's `assert.equal(payload.reached, false)` then fails, because `reached` is correctly omitted rather than asserted false.
- **Fix:** Widened the assertion to the new honest shape: `"reached" in payload === false`, `reachedUnknown === true`, `raceResolved === "unresolved"`, `typeof pcReadError === "string"`. Retitled the test to note WR-01. This exact widening was anticipated and explicitly assigned to Task 3 by the plan's own action text ("If any existing assertion contradicts the new fields... widen that assertion... say which ones you touched in the SUMMARY").
- **Files modified:** `.claude/mcp/vice/stock-run-until.test.ts`
- **Verification:** `node --test stock-run-until.test.ts` — 21/21 pass.
- **Committed in:** `866f709` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, plan-anticipated)
**Impact on plan:** None — this is the exact widening the plan's Task 3 action text called out in advance as expected and assigned to this task. No scope creep.

## Issues Encountered
- Task 1's own commit necessarily carried one known-and-documented interim test regression (the assertion above) between the Task 1 commit and the Task 3 commit that fixes it, since the plan splits the source change (Task 1) and the test-file change (Task 3) into separate atomic commits touching disjoint file sets. Both intermediate commit messages call this out explicitly; the plan's own top-level `<verification>` block is only asserted true after all three tasks are committed, which it now is.
- The worktree agent forked from a stale base commit (a known recurring issue in this project, per user memory `worktree-agents-fork-stale-base.md`) — corrected via `git reset --hard` to the intended base commit `2de47f3` before any file edits, per the mandatory `<worktree_branch_check>` step.

## User Setup Required
None - no external service configuration required.

## New Field Set for 07-16 (manifest `outputSchema` update)

`tools-manifest.stock.json`'s `vice_run_until` entry currently declares `reached: {"type": "boolean"}` in `required`. This plan's output requires 07-16 to:

1. **Remove `reached` from `required`** — the `"unresolved"` race-resolution branch omits it entirely by design (never a fabricated value, never a string-typed `"unknown"` sentinel, since `stock-schema-check.ts` supports no union types).
2. Add the following fields to the schema (all optional except where noted; `reached` stays `{"type": "boolean"}`, just no longer required):

| Field | Type | Present when |
|---|---|---|
| `reached` | `boolean` | hit path; timeout + `cleanup !== "already_gone"`; timeout + `already_gone` + PC read succeeded |
| `reachedUnknown` | `boolean` (`true`) | timeout + `already_gone` + PC read failed. **Never co-present with `reached`.** |
| `raceResolved` | `"pc_at_address" \| "pc_elsewhere" \| "unresolved"` | timeout + `cleanup === "already_gone"` only |
| `pcAtCleanup` | `number` | `raceResolved` is `"pc_at_address"` or `"pc_elsewhere"` |
| `pcReadError` | `string` | `raceResolved === "unresolved"` |
| `raceNote` | `string` | whenever `raceResolved` is present |
| `machineHalted` | `boolean` (`true` on every current path) | **every** non-error answer, unconditionally |
| `machineHaltedNote` | `string` | **every** non-error answer, unconditionally, whenever `machineHalted` is present |

Existing fields (`requested`, `address`, `timeoutMs`, `checkpointId`, `hitCount`, `timedOut`, `cleanup`, `cleanupError`, `explanation`, `timeoutClamped`, `runState`) are unchanged in shape.

## Next Phase Readiness
- 07-16 can proceed with the manifest `outputSchema` update using the field table above — no further investigation needed on this plan's output shape.
- The cleanup mechanism itself (temporary checkpoint arm/delete, ObjectMissing tolerance, restart-mid-wait skip) remains untouched and fully covered by its original 15 tests, now 21.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*

## Self-Check: PASSED

All created/modified files verified present and all task commit hashes (861279a, 62899fe,
866f709) plus this SUMMARY's own commit (b077979) verified present in `git log --oneline --all`.
