---
phase: 07-cycle-timing-and-wedge-triage
plan: 01
subsystem: stock-vice-backend
tags: [binary-monitor, cpuhistory, capability-detection, node-test]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: stockConnect() handshake and resolveCapabilities()/probeCpuHistory() (BACK-04)
provides:
  - probeCpuHistory() that no longer throws an unhandled StockProtocolError for InvalidParameter (0x81) on a real VICE >= 3.10 build
  - a committed regression fixture reproducing the live-captured 0x81 wire response
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CPUHISTORY_GET probes with count=1 (the minimum VICE accepts), never count=0"
    - "InvalidParameter (0x81) collapses to the same 'absent' capability answer as InvalidType (0x83), since resolveCapabilities()'s cache already treats absent/not_compiled_in as differing only in why, never in what to do next"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-connect.ts
    - .claude/mcp/vice/stock-connect.test.ts

key-decisions:
  - "count=1 chosen over a 0x81 -> 'available' mapping: 0x81 with a well-formed count=1 request cannot mean 'available', it means the build rejected a minimal legal request, so 'absent' is the honest answer"
  - "CpuHistoryCapability kept at exactly three members; 0x81 collapses into 'absent' rather than adding a fourth value, matching the plan's explicit constraint and resolveCapabilities()'s existing cache comment"

requirements-completed: [TIME-01]

# Metrics
duration: 12min
completed: 2026-08-18
---

# Phase 07 Plan 01: Fix probeCpuHistory()'s count=0 handshake blocker Summary

**`probeCpuHistory()` now sends `CPUHISTORY_GET` with `count=1` and classifies `InvalidParameter` (0x81) as `"absent"` instead of letting it escape `resolveCapabilities()` and fail the entire stock connect handshake on real VICE >= 3.10.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-18T08:57:02+02:00 (phase-start base commit)
- **Completed:** 2026-08-18T09:09:07+02:00
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `probeCpuHistory()` sends `count=1` (the minimum VICE accepts per `monitor_binary.c:1491-1497`) instead of `count=0`, matching the already-proven-live `probe-binmon.mjs` approach
- `ErrorCode.InvalidParameter` (0x81) is now a classified capability answer (`"absent"`), not a thrown error — the whole stock connect handshake completes on a genuine VICE >= 3.10 build instead of throwing at Step 5
- The live-captured 0x81 wire response (this session, 2026-08-18, against the fork's own genuine VICE 3.10.0.0 build) is a committed, named regression fixture, plus a wire-body assertion proving the request carries `count=1` and never `count=0`, plus a closed-classification-set regression guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Send count=1 and classify InvalidParameter in probeCpuHistory()** - `8df94d4` (fix)
2. **Task 2: Commit the live-captured 0x81 regression fixture** - `e90294f` (test)

**Plan metadata:** committed separately after this summary (see final commit)

## Files Created/Modified
- `.claude/mcp/vice/stock-connect.ts` - `probeCpuHistory()` now sends `count=1` via `clampCpuHistoryCount(1)` and classifies `ErrorCode.InvalidParameter` (0x81) as `"absent"`; updated the `clampCpuHistoryCount()`/`probeCpuHistory()` doc comments to describe the new call site and the four-way wire classification
- `.claude/mcp/vice/stock-connect.test.ts` - three new tests: the 0x81 -> `"absent"` regression fixture (named citing the live capture date and build), a wire-body assertion on the `CPUHISTORY_GET` request (`count=1`, both `=== 1` and `!== 0`), and a closed-classification-set guard (0x83/0x8f unchanged, 0x82 still rejects)

## Decisions Made
- 0x81 collapses to `"absent"` rather than a fourth `CpuHistoryCapability` member, per the plan's explicit constraint (the type is pinned by `vice_ping`'s answer shape and `backend-detect.mts`'s boolean cache schema)
- Kept the single clamping seam (`clampCpuHistoryCount()`) rather than a second inline clamp at the handshake's call site

## Deviations from Plan

None — plan executed exactly as written. All four acceptance-criteria greps pass, all `<verify>` blocks in both tasks pass, and the plan-level `<verification>` block passes (see below), with one unrelated pre-existing failure noted under Issues Encountered.

## Issues Encountered

`npm run test:automated` (part of the plan's `<verification>` block) reports 1 failure out of 1429 tests: `repo-root.test.ts`'s "path agreement" test, which asserts the launcher's `repo_root` agrees with Node's `supervisorDir()`/`dirname(EPOCH_FILE)` and is not under `.claude`. This is a pre-existing artifact of running inside a Claude Code git worktree (`.claude/worktrees/agent-*`), already documented as deferred for the `04-01` plan (commit `5499f10`) and the `260817-n6p` quick task (commit `ff87d94`) — not caused by this plan's changes to `stock-connect.ts` / `stock-connect.test.ts`. Logged in `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md` per the scope-boundary rule (pre-existing failures in unrelated files are out of scope for this task).

All other verification passed:
- `npx tsc --noEmit -p tsconfig.json` exits 0
- `node --test stock-connect.test.ts` passes (29/29)
- `grep -rn "clampCpuHistoryCount(0)" .claude/mcp/vice/` returns nothing

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The Wave-0 blocking defect is fixed: `resolveCapabilities()` no longer throws on a real VICE >= 3.10 connect, so `session.capabilities.cpuHistory` is reachable for every wire outcome, unblocking `vice_cycles_stopwatch`'s Route A gate and every other plan in Phase 7 that depends on this handshake completing. No blockers for 07-02 onward.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*
