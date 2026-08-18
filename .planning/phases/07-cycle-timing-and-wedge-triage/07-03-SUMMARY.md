---
phase: 07-cycle-timing-and-wedge-triage
plan: 03
subsystem: api
tags: [vice, binary-monitor, checkpoints, timeout, stock-backend, wedge-triage]

# Dependency graph
requires:
  - phase: 03-direct-tools
    provides: stock-checkpoints.ts (CHECKPOINT_SET/DELETE encoders, event-narrowing pattern), stock-handler.ts (stockAnswer/convertWireError/convertHandshakeError), stock-address.ts (parseAddress), stock-connect.ts (clampCpuHistoryCount precedent, MachineRestartedError plumbing)
provides:
  - handleRunUntil (StockSessionHandler) and waitForCheckpointHit() implementing vice_run_until for the stock backend
  - A stock-only, D-02 timeout_ms argument (default 30000, ceiling 600000) with clamp/refusal semantics
  - The tree's first temporary:true CHECKPOINT_SET caller, with three differentiated cleanup paths
affects: [07-08-dispatch-and-manifest-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Event-driven checkpoint wait with a bounded setTimeout race and a client 'close' fallback, cleaned up in a single finally (listener/timer hygiene)"
    - "Per-path cleanup differentiation (hit / timeout / machine-restarted) rather than one undifferentiated finally-delete"

key-files:
  created:
    - .claude/mcp/vice/stock-run-until.ts
    - .claude/mcp/vice/stock-run-until.test.ts
  modified: []

key-decisions:
  - "timeout_ms validation order: finiteness/type check first (refuse NaN/non-number), then Math.trunc, then a <=0 check on the truncated value (so 0.5 truncating to 0 is still refused) -- matches clampCpuHistoryCount()'s discipline"
  - "A MachineRestartedError (or any other error) surfacing from the resume/wait step is left uncaught in handleRunUntil rather than converted locally -- the one existing withStockSession try/catch (convertHandshakeError/convertWireError) produces the answer, avoiding a second converter"
  - "A close event mid-wait resolves waitForCheckpointHit() as a timeout rather than waiting out the full deadline; the timeout branch's own delete attempt then discovers the dead connection on its own terms"

requirements-completed: [TIME-02, TIME-03]

# Metrics
duration: ~25min
completed: 2026-08-18
---

# Phase 07 Plan 03: Stock vice_run_until with bounded timeout and three-path cleanup Summary

**Event-driven `vice_run_until` for stock VICE: a temporary stopping exec checkpoint, exactly one resume, a bounded `timeout_ms` (default 30000/ceiling 600000), and three distinct cleanup paths (hit/timeout/restarted) instead of vice-sync.ts's old unbounded polling wait.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-18T07:16:36Z
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both new)

## Accomplishments
- `handleRunUntil` arms a temporary, stopping exec checkpoint at the requested address (the tree's first `temporary: true` `CHECKPOINT_SET` caller), resumes exactly once, and waits event-driven for that specific checkpoint's own `CHECKPOINT_INFO`, narrowed on the parsed event's `.type` discriminant before its id.
- Implements D-02: an optional, stock-only `timeout_ms` argument defaulting to `30000` (matching `VICE_MCP_TIMEOUT_MS`), refusing non-finite/non-positive values by name and clamping anything above `600000` with `timeoutClamped: true`.
- Three differentiated cleanup paths: hit (VICE already auto-deleted the checkpoint, no delete sent), timeout (exactly one `CHECKPOINT_DELETE`, tolerating `ObjectMissing` as `cleanup: "already_gone"`), machine-restarted-mid-wait (no delete attempted at all, error propagates to the existing error-converter seam).
- Refuses a cycles-only call (`{ cycles: N }`, no `address`) in the fork's own wording, `"cycles-only mode not yet implemented; provide an address"`, before arming anything.
- 15 unit tests against a synthetic DI-stub client covering wire body, hit path, event narrowing, timeout path, both delete-failure branches, machine-restarted propagation, full `timeout_ms` validation matrix, cycles-only refusal, and 20-call listener hygiene.

## Task Commits

Each task was committed atomically:

1. **Task 1: `waitForCheckpointHit()` and `handleRunUntil()` with three-path cleanup** - `c7fad95` (feat)
2. **Task 2: `stock-run-until.test.ts` -- wire body, call counts, three cleanup paths** - `e627552` (test)

## Files Created/Modified
- `.claude/mcp/vice/stock-run-until.ts` - `handleRunUntil` (StockSessionHandler) + module-local `waitForCheckpointHit()`, `RUN_UNTIL_DEFAULT_TIMEOUT_MS`/`RUN_UNTIL_MAX_TIMEOUT_MS`
- `.claude/mcp/vice/stock-run-until.test.ts` - 15 test cases against a synthetic EventEmitter-based client, no broker/socket/emulator

## Decisions Made
- `timeout_ms` validation truncates with `Math.trunc` *after* the finiteness check and re-checks `<= 0` on the truncated value (not the raw one), so a value like `0.5` that would pass a naive `raw > 0` check but truncate to `0` is still refused rather than silently becoming an instant spurious timeout.
- Chose not to write a second error converter for `MachineRestartedError`: the plan's own guidance was to let it propagate uncaught to the existing `convertHandshakeError`/`convertWireError` seam. Since `handleRunUntil` will be registered via `withStockSession` in plan 07-08 (not this plan's job), an error escaping the family handler is caught by that wrapper's own second `try/catch`, which calls `convertWireError` (not `convertHandshakeError`) for anything escaping the handler body -- this is the same path every other family handler's escaped exceptions already take, so no new behavior was introduced here; this plan's scope was only to avoid inventing a second conversion path, not to change which converter fires.
- Added a `cleanup: "deleted"` value for the ordinary (successful) delete case in the timeout branch, alongside the plan-specified `"already_gone"` and `"delete_failed"`, so the field is always present and self-describing rather than only appearing on the two exceptional outcomes.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 auto-fixes were needed; the only judgment calls made (documented above under Decisions Made) were filling in details the plan left to the implementer's discretion (the `cleanup: "deleted"` success value, and the exact `timeout_ms` truncate-then-refuse ordering), not corrections to a defect.

## Issues Encountered

`npx tsc`/`node --test` initially failed with "This is not the tsc command you are looking for" because this worktree had no `node_modules` yet (the SessionStart hook that provisions them via `scripts/ensure-mcp-deps.sh` had not run in this isolated worktree). Ran `npm ci --no-audit --no-fund` directly in `.claude/mcp/vice` to provision dependencies before typechecking/testing -- not a plan deviation, just environment setup local to this worktree.

`npm run test:automated` (the full 1272-line suite, 1441 tests) reports 1 pre-existing failure unrelated to this plan: `repo-root.test.ts`'s "path agreement (D-3, D-6...)" test, which compares repo-root resolution against `.claude`-relative paths and fails specifically because of this worktree's nested path structure (`.claude/worktrees/agent-.../`). This is out of this plan's scope per the standing scope-boundary rule (only auto-fix issues directly caused by the current task's changes) and is already tracked elsewhere in this project's history as a known, deferred worktree-path test failure -- not introduced by `stock-run-until.ts`/`stock-run-until.test.ts`, which are unrelated to repo-root resolution. All 15 of this plan's own tests pass, and the rest of the 1441-test suite (1435 pass, 5 pre-existing `todo`) is otherwise green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `handleRunUntil` is ready to be wired into `STOCK_DISPATCH_TABLE` and the stock tools manifest -- that registration is explicitly plan 07-08's job, not this one, per this plan's own `<objective>`.
- No blockers. The one pre-existing, out-of-scope test failure noted above (`repo-root.test.ts`'s path-agreement check under this nested worktree) does not affect `vice_run_until` and requires no action from this plan.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*
